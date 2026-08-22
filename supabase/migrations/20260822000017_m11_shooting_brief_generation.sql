-- M11: Complete, reusable Shooting Brief generation. Existing production workflow remains unchanged.

alter table public.idea_shooting_briefs
  add column if not exists key_takeaway text,
  add column if not exists b_roll_visual_suggestions text[] not null default '{}',
  add column if not exists risk_fact_check_notes text[] not null default '{}',
  add column if not exists generation_source text check (generation_source in ('template','manual')),
  add column if not exists generated_at timestamptz;

create or replace function public.save_complete_idea_shooting_brief(
  target_idea_id uuid,
  target_why_now text,
  target_interview_questions text[],
  target_key_talking_points text[],
  target_key_takeaway text,
  target_suggested_cta text,
  target_target_duration text,
  target_b_roll_visual_suggestions text[],
  target_risk_fact_check_notes text[],
  target_talent text,
  target_shoot_date date,
  target_location text,
  target_shooter_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare source public.ideas%rowtype;
begin
  select * into source from public.ideas where id = target_idea_id for update;
  if source.id is null or not public.can_manage_research_client(source.client_id) then
    raise exception 'Shooting Brief access denied';
  end if;
  if source.status not in ('approved','converted') then
    raise exception 'Shooting Brief requires an Approved or Converted Idea';
  end if;
  if cardinality(coalesce(target_interview_questions, '{}')) > 5 then
    raise exception 'Use no more than five Interview Questions';
  end if;
  if target_shooter_user_id is not null and not exists (
    select 1
    from public.workspace_members wm
    join public.workspace_member_roles wmr on wmr.workspace_member_id = wm.id
    join public.roles r on r.id = wmr.role_id
    where wm.workspace_id = source.workspace_id
      and wm.user_profile_id = target_shooter_user_id
      and wm.status = 'active'
      and r.code = 'shooter'
      and r.is_active
      and (
        exists (select 1 from public.client_members cm where cm.workspace_member_id = wm.id and cm.client_id = source.client_id and cm.status = 'active')
        or public.is_workspace_super_admin(source.workspace_id)
      )
  ) then
    raise exception 'Shooter does not have an active Shooter role and Client access';
  end if;

  insert into public.idea_shooting_briefs (
    idea_id, workspace_id, client_id, why_now, interview_questions, key_talking_points,
    key_takeaway, suggested_cta, target_duration, b_roll_visual_suggestions,
    risk_fact_check_notes, talent, shoot_date, location, shooter_user_id,
    generation_source, created_by
  ) values (
    source.id, source.workspace_id, source.client_id, nullif(btrim(target_why_now), ''),
    coalesce(target_interview_questions, '{}'), coalesce(target_key_talking_points, '{}'),
    nullif(btrim(target_key_takeaway), ''), nullif(btrim(target_suggested_cta), ''),
    nullif(btrim(target_target_duration), ''), coalesce(target_b_roll_visual_suggestions, '{}'),
    coalesce(target_risk_fact_check_notes, '{}'), nullif(btrim(target_talent), ''),
    target_shoot_date, nullif(btrim(target_location), ''), target_shooter_user_id,
    'manual', auth.uid()
  )
  on conflict (idea_id) do update set
    why_now = excluded.why_now,
    interview_questions = excluded.interview_questions,
    key_talking_points = excluded.key_talking_points,
    key_takeaway = excluded.key_takeaway,
    suggested_cta = excluded.suggested_cta,
    target_duration = excluded.target_duration,
    b_roll_visual_suggestions = excluded.b_roll_visual_suggestions,
    risk_fact_check_notes = excluded.risk_fact_check_notes,
    talent = excluded.talent,
    shoot_date = excluded.shoot_date,
    location = excluded.location,
    shooter_user_id = excluded.shooter_user_id,
    generation_source = 'manual';

  insert into public.activity_logs (
    workspace_id, client_id, content_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    source.workspace_id, source.client_id, null, auth.uid(), 'idea', source.id,
    'shooting_brief_saved', jsonb_build_object('source', 'manual')
  );
end;
$$;

create or replace function public.generate_idea_shooting_briefs(target_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  source public.ideas%rowtype;
  target_idea_id uuid;
  questions text[];
  points text[];
  visuals text[];
  fact_checks text[];
  generated_count integer := 0;
begin
  if jsonb_typeof(target_items) <> 'array' or jsonb_array_length(target_items) = 0 then
    raise exception 'Select at least one Idea';
  end if;
  if jsonb_array_length(target_items) > 100 then
    raise exception 'Generate no more than 100 Shooting Briefs at once';
  end if;

  for item in select value from jsonb_array_elements(target_items)
  loop
    target_idea_id := nullif(item ->> 'ideaId', '')::uuid;
    select * into source from public.ideas where id = target_idea_id for update;
    if source.id is null or not public.can_manage_research_client(source.client_id) then
      raise exception 'Shooting Brief generation access denied';
    end if;
    if source.status not in ('approved','converted') then
      raise exception 'Idea % must be Approved before generating a Shooting Brief', source.id;
    end if;

    select coalesce(array_agg(value), '{}') into questions
    from jsonb_array_elements_text(coalesce(item -> 'interviewQuestions', '[]'::jsonb));
    select coalesce(array_agg(value), '{}') into points
    from jsonb_array_elements_text(coalesce(item -> 'keyTalkingPoints', '[]'::jsonb));
    select coalesce(array_agg(value), '{}') into visuals
    from jsonb_array_elements_text(coalesce(item -> 'bRollVisualSuggestions', '[]'::jsonb));
    select coalesce(array_agg(value), '{}') into fact_checks
    from jsonb_array_elements_text(coalesce(item -> 'riskFactCheckNotes', '[]'::jsonb));

    if cardinality(questions) < 3 or cardinality(questions) > 5 then
      raise exception 'Generated Shooting Brief requires 3–5 Interview Questions';
    end if;
    if cardinality(points) = 0 then
      raise exception 'Generated Shooting Brief requires Key Talking Points';
    end if;

    insert into public.idea_shooting_briefs (
      idea_id, workspace_id, client_id, why_now, interview_questions, key_talking_points,
      key_takeaway, suggested_cta, target_duration, b_roll_visual_suggestions,
      risk_fact_check_notes, generation_source, generated_at, created_by
    ) values (
      source.id, source.workspace_id, source.client_id, nullif(btrim(item ->> 'whyNow'), ''),
      questions, points, nullif(btrim(item ->> 'keyTakeaway'), ''),
      nullif(btrim(item ->> 'suggestedCta'), ''), nullif(btrim(item ->> 'targetDuration'), ''),
      visuals, fact_checks, 'template', now(), auth.uid()
    )
    on conflict (idea_id) do update set
      why_now = case when nullif(btrim(idea_shooting_briefs.why_now), '') is null then excluded.why_now else idea_shooting_briefs.why_now end,
      interview_questions = case when cardinality(idea_shooting_briefs.interview_questions) = 0 then excluded.interview_questions else idea_shooting_briefs.interview_questions end,
      key_talking_points = case when cardinality(idea_shooting_briefs.key_talking_points) = 0 then excluded.key_talking_points else idea_shooting_briefs.key_talking_points end,
      key_takeaway = case when nullif(btrim(idea_shooting_briefs.key_takeaway), '') is null then excluded.key_takeaway else idea_shooting_briefs.key_takeaway end,
      suggested_cta = case when nullif(btrim(idea_shooting_briefs.suggested_cta), '') is null then excluded.suggested_cta else idea_shooting_briefs.suggested_cta end,
      target_duration = case when nullif(btrim(idea_shooting_briefs.target_duration), '') is null then excluded.target_duration else idea_shooting_briefs.target_duration end,
      b_roll_visual_suggestions = case when cardinality(idea_shooting_briefs.b_roll_visual_suggestions) = 0 then excluded.b_roll_visual_suggestions else idea_shooting_briefs.b_roll_visual_suggestions end,
      risk_fact_check_notes = case when cardinality(idea_shooting_briefs.risk_fact_check_notes) = 0 then excluded.risk_fact_check_notes else idea_shooting_briefs.risk_fact_check_notes end,
      generation_source = case when idea_shooting_briefs.generation_source = 'manual' then 'manual' else 'template' end,
      generated_at = now();

    insert into public.activity_logs (
      workspace_id, client_id, content_id, actor_user_id, entity_type, entity_id, action, metadata
    ) values (
      source.workspace_id, source.client_id, null, auth.uid(), 'idea', source.id,
      'shooting_brief_generated', jsonb_build_object('source', 'template', 'filled_blank_fields_only', true)
    );
    generated_count := generated_count + 1;
  end loop;
  return generated_count;
end;
$$;

revoke all on function public.save_complete_idea_shooting_brief(uuid,text,text[],text[],text,text,text,text[],text[],text,date,text,uuid) from public, anon;
revoke all on function public.generate_idea_shooting_briefs(jsonb) from public, anon;
grant execute on function public.save_complete_idea_shooting_brief(uuid,text,text[],text[],text,text,text,text[],text[],text,date,text,uuid) to authenticated;
grant execute on function public.generate_idea_shooting_briefs(jsonb) to authenticated;

notify pgrst, 'reload schema';
