begin;
do $$
declare
  actor uuid;
  target_workspace uuid;
  target_client uuid;
  first_idea uuid;
  second_idea uuid;
  third_idea uuid;
  generated integer;
  before_creator uuid;
begin
  select up.id into actor from public.user_profiles up where lower(up.email) = 'jaydenyap28work@gmail.com';
  select wm.workspace_id into target_workspace from public.workspace_members wm where wm.user_profile_id = actor and wm.status = 'active' limit 1;
  insert into public.clients (workspace_id, code, name, status)
  values (target_workspace, 'M11-ROLLBACK', 'M11 rollback client', 'active') returning id into target_client;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  first_idea := public.save_idea(null,target_workspace,target_client,'M11 first','','','','','',null,'','normal',actor,'','{}','{}','[]','2026-09-25');
  second_idea := public.save_idea(null,target_workspace,target_client,'M11 second','','','','','',null,'','normal',actor,'','{}','{}','[]','2026-09-26');
  third_idea := public.save_idea(null,target_workspace,target_client,'M11 new denied','','','','','',null,'','normal',actor,'','{}','{}','[]','2026-09-27');
  select created_by into before_creator from public.ideas where id = first_idea;
  perform public.change_idea_status(first_idea, 'evaluating', null);
  perform public.change_idea_status(first_idea, 'approved', null);
  perform public.change_idea_status(second_idea, 'evaluating', null);
  perform public.change_idea_status(second_idea, 'approved', null);

  select public.generate_idea_shooting_briefs(jsonb_build_array(
    jsonb_build_object('ideaId',first_idea,'whyNow','Why now 1','interviewQuestions',jsonb_build_array('Q1','Q2','Q3'),'keyTalkingPoints',jsonb_build_array('P1'),'keyTakeaway','Takeaway 1','suggestedCta','CTA 1','targetDuration','60 sec','bRollVisualSuggestions',jsonb_build_array('Visual 1'),'riskFactCheckNotes',jsonb_build_array('Fact Check Required')),
    jsonb_build_object('ideaId',second_idea,'whyNow','Why now 2','interviewQuestions',jsonb_build_array('Q1','Q2','Q3','Q4'),'keyTalkingPoints',jsonb_build_array('P2'),'keyTakeaway','Takeaway 2','suggestedCta','CTA 2','targetDuration','90 sec','bRollVisualSuggestions',jsonb_build_array('Visual 2'),'riskFactCheckNotes',jsonb_build_array('Risk 2'))
  )) into generated;
  if generated <> 2 then raise exception 'Bulk generation count mismatch'; end if;
  if exists (
    select 1 from public.idea_shooting_briefs b where b.idea_id in (first_idea, second_idea)
      and (b.why_now is null or cardinality(b.interview_questions) < 3 or b.key_takeaway is null
        or cardinality(b.b_roll_visual_suggestions) = 0 or cardinality(b.risk_fact_check_notes) = 0)
  ) then raise exception 'Generated brief is incomplete'; end if;
  if exists (
    select 1 from public.idea_shooting_briefs b where b.idea_id in (first_idea, second_idea)
      and (b.talent is not null or b.shooter_user_id is not null or b.location is not null or b.shoot_date is not null)
  ) then raise exception 'Generator populated unknown execution details'; end if;

  perform public.generate_idea_shooting_briefs(jsonb_build_array(
    jsonb_build_object('ideaId',first_idea,'whyNow','Do not overwrite','interviewQuestions',jsonb_build_array('N1','N2','N3'),'keyTalkingPoints',jsonb_build_array('NP'),'keyTakeaway','New takeaway','suggestedCta','New CTA','targetDuration','120 sec','bRollVisualSuggestions',jsonb_build_array('New visual'),'riskFactCheckNotes',jsonb_build_array('New risk'))
  ));
  if (select why_now from public.idea_shooting_briefs where idea_id = first_idea) <> 'Why now 1' then
    raise exception 'Generator overwrote an existing brief field';
  end if;
  if (select created_by from public.ideas where id = first_idea) <> before_creator then
    raise exception 'Creator attribution changed';
  end if;
  if (select count(*) from public.activity_logs where entity_type = 'idea' and entity_id in (first_idea, second_idea) and action = 'shooting_brief_generated') <> 3 then
    raise exception 'Shooting Brief generation Activity Log mismatch';
  end if;

  begin
    perform public.generate_idea_shooting_briefs(jsonb_build_array(
      jsonb_build_object('ideaId',third_idea,'whyNow','Denied','interviewQuestions',jsonb_build_array('Q1','Q2','Q3'),'keyTalkingPoints',jsonb_build_array('P'),'keyTakeaway','T','suggestedCta','C','targetDuration','60 sec','bRollVisualSuggestions',jsonb_build_array('V'),'riskFactCheckNotes',jsonb_build_array('R'))
    ));
    raise exception 'New Idea generation was accepted';
  exception when others then
    if sqlerrm = 'New Idea generation was accepted' then raise; end if;
  end;
end $$;
rollback;
