-- M21: streamlined Idea intake, deterministic Skit packs, and lightweight equipment proposals.
-- Existing Content, codes, briefs, scripts, workflow, dates, scenes, provenance, assignments, Tasks, and Analytics are preserved.

alter table public.ideas
  add column raw_content text,
  add column content_format text check(content_format is null or content_format in
    ('q_and_a','talking_head','skit','product_demo','podcast','voice_over','event'));

alter table public.contents add column source_raw_content text;

alter table public.idea_shooting_briefs drop constraint idea_shooting_briefs_shooting_format_check;
alter table public.idea_shooting_briefs add constraint idea_shooting_briefs_shooting_format_check
  check(shooting_format in ('q_and_a','talking_head','skit','product_demo','podcast','voice_over','event'));

create or replace function public.save_idea(
  target_idea_id uuid,target_workspace_id uuid,target_client_id uuid,target_title text,target_source_url text,
  target_original_topic text,target_original_hook text,target_why_it_works text,target_our_angle text,target_category_id uuid,
  target_suggested_format text,target_priority text,target_owner_user_id uuid,target_notes text,target_reference_ids uuid[],
  target_tag_names text[],target_contributors jsonb,target_planned_date date,target_source_platform text,
  target_raw_content text,target_content_format text
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; normalized_format text:=nullif(lower(btrim(target_content_format)),'');
begin
  if normalized_format is not null and normalized_format not in ('q_and_a','talking_head','skit','product_demo','podcast','voice_over','event') then
    raise exception 'Unsupported Content format';
  end if;
  saved:=public.save_idea(target_idea_id,target_workspace_id,target_client_id,target_title,target_source_url,target_original_topic,
    target_original_hook,target_why_it_works,target_our_angle,target_category_id,target_suggested_format,target_priority,
    target_owner_user_id,target_notes,target_reference_ids,target_tag_names,target_contributors,target_planned_date,target_source_platform);
  update public.ideas set raw_content=nullif(btrim(target_raw_content),''),content_format=normalized_format where id=saved;
  return saved;
end; $$;
revoke all on function public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text,text,text) from public,anon;
grant execute on function public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text,text,text) to authenticated;

create or replace function public.confirm_idea_for_production_v2(target_idea_id uuid,target_skit_segments jsonb default null)
returns table(content_id uuid,content_code text,created_new boolean)
language plpgsql security definer set search_path='' as $$
declare source public.ideas%rowtype; existing public.contents%rowtype; converted record; segments jsonb:=coalesce(target_skit_segments,'[]'::jsonb);
begin
  select * into source from public.ideas where id=target_idea_id for update;
  if source.id is null or not public.can_manage_content_client(source.client_id) then raise exception 'Idea confirmation access denied'; end if;
  if source.planning_status='archived' then raise exception 'Archived Idea cannot be confirmed'; end if;
  if jsonb_typeof(segments)<>'array' or jsonb_array_length(segments)>50 then raise exception 'Skit segments must be an array of no more than 50 scenes'; end if;
  if source.content_format<>'skit' and jsonb_array_length(segments)>0 then raise exception 'Skit segments require Skit format'; end if;

  select * into existing from public.contents where source_idea_id=source.id for update;
  if existing.id is null then
    update public.ideas set planning_status='confirmed',status='approved',status_reason='Confirmed for production',archived_at=null where id=source.id;
    select * into converted from public.convert_idea_to_content(
      source.id,source.title,source.title,null,source.our_angle,source.owner_user_id,source.notes,'','','{}'::text[]
    );
    update public.contents set source_raw_content=source.raw_content where id=converted.content_id;
    content_id:=converted.content_id;content_code:=converted.content_code;created_new:=true;
  else
    update public.ideas set planning_status='confirmed',status='converted',archived_at=null where id=source.id;
    update public.contents set source_raw_content=coalesce(source.raw_content,source_raw_content) where id=existing.id;
    content_id:=existing.id;content_code:=existing.content_code;created_new:=false;
  end if;

  if source.content_format='skit' then
    insert into public.idea_shooting_briefs(
      idea_id,workspace_id,client_id,interview_questions,key_talking_points,b_roll_visual_suggestions,
      risk_fact_check_notes,generation_source,created_by,shooting_format,pack_segments
    ) values(source.id,source.workspace_id,source.client_id,'{}','{}','{}','{}','manual',auth.uid(),'skit',segments)
    on conflict(idea_id) do update set shooting_format='skit',
      pack_segments=case when public.idea_shooting_briefs.shooting_format<>'skit' or public.idea_shooting_briefs.pack_segments='[]'::jsonb
        then excluded.pack_segments else public.idea_shooting_briefs.pack_segments end,
      generation_source='manual';
  end if;
  return next;
end; $$;
revoke all on function public.confirm_idea_for_production_v2(uuid,jsonb) from public,anon;
grant execute on function public.confirm_idea_for_production_v2(uuid,jsonb) to authenticated;

create table public.equipment_proposals(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  title text not null check(nullif(btrim(title),'') is not null),
  upgrade_reason text,
  current_problem text,
  use_cases text[] not null default '{}',
  expected_value text,
  budget numeric(12,2) check(budget is null or budget>=0),
  priority text not null default 'medium' check(priority in ('low','medium','high')),
  desired_purchase_date date,
  reference_urls text[] not null default '{}',
  boss_feedback text,
  status text not null default 'draft' check(status in ('draft','pending_review','viewed','approved','paused','rejected','purchased')),
  proposed_by uuid not null references public.user_profiles(id) on delete restrict,
  decided_by uuid references public.user_profiles(id) on delete restrict,
  decided_at timestamptz,
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index equipment_proposals_workspace_status_priority_idx on public.equipment_proposals(workspace_id,status,priority,updated_at desc);
create trigger equipment_proposals_set_updated_at before update on public.equipment_proposals for each row execute function public.set_updated_at();
alter table public.equipment_proposals enable row level security;
create policy "Internal members can view Equipment Proposals" on public.equipment_proposals for select to authenticated
  using(public.is_internal_workspace_member(workspace_id));
revoke all on table public.equipment_proposals from anon;
revoke insert,update,delete,truncate,references,trigger on table public.equipment_proposals from authenticated;
grant select on table public.equipment_proposals to authenticated;

create or replace function public.list_equipment_proposals(target_workspace_id uuid)
returns table(id uuid,workspace_id uuid,title text,upgrade_reason text,current_problem text,use_cases text[],expected_value text,
 budget numeric,priority text,desired_purchase_date date,reference_urls text[],boss_feedback text,status text,
 proposed_by uuid,proposer_name text,decided_by uuid,decider_name text,decided_at timestamptz,purchased_at timestamptz,
 created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select ep.id,ep.workspace_id,ep.title,ep.upgrade_reason,ep.current_problem,ep.use_cases,ep.expected_value,
   ep.budget,ep.priority,ep.desired_purchase_date,ep.reference_urls,ep.boss_feedback,ep.status,
   ep.proposed_by,proposer.display_name,ep.decided_by,decider.display_name,ep.decided_at,ep.purchased_at,
   ep.created_at,ep.updated_at
 from public.equipment_proposals ep
 join public.user_profiles proposer on proposer.id=ep.proposed_by
 left join public.user_profiles decider on decider.id=ep.decided_by
 where ep.workspace_id=target_workspace_id and public.is_internal_workspace_member(target_workspace_id)
 order by (ep.status='pending_review') desc,case ep.priority when 'high' then 1 when 'medium' then 2 else 3 end,ep.updated_at desc;
$$;

create or replace function public.save_equipment_proposal(
 target_proposal_id uuid,target_workspace_id uuid,target_title text,target_upgrade_reason text,target_current_problem text,
 target_use_cases text[],target_expected_value text,target_budget numeric,target_priority text,target_desired_purchase_date date,
 target_reference_urls text[],target_status text default 'draft'
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; existing public.equipment_proposals%rowtype; can_manage boolean;
begin
  if not public.is_internal_workspace_member(target_workspace_id) then raise exception 'Equipment Proposal access denied'; end if;
  if nullif(btrim(target_title),'') is null then raise exception 'Proposal title is required'; end if;
  if target_priority not in ('low','medium','high') or target_status not in ('draft','pending_review') then raise exception 'Unsupported Proposal value'; end if;
  if target_budget is not null and target_budget<0 then raise exception 'Budget cannot be negative'; end if;
  if target_proposal_id is null then
    insert into public.equipment_proposals(workspace_id,title,upgrade_reason,current_problem,use_cases,expected_value,budget,priority,desired_purchase_date,reference_urls,status,proposed_by)
    values(target_workspace_id,btrim(target_title),nullif(btrim(target_upgrade_reason),''),nullif(btrim(target_current_problem),''),coalesce(target_use_cases,'{}'),nullif(btrim(target_expected_value),''),target_budget,target_priority,target_desired_purchase_date,coalesce(target_reference_urls,'{}'),target_status,auth.uid()) returning id into saved;
  else
    select * into existing from public.equipment_proposals where id=target_proposal_id for update;
    can_manage:=public.is_workspace_super_admin(target_workspace_id) or public.has_workspace_role(target_workspace_id,'internal_manager');
    if existing.id is null or existing.workspace_id<>target_workspace_id or (existing.proposed_by<>auth.uid() and not can_manage) then raise exception 'Equipment Proposal edit denied'; end if;
    if existing.status not in ('draft','pending_review','viewed','paused') and not can_manage then raise exception 'Decided Proposal cannot be edited'; end if;
    update public.equipment_proposals set title=btrim(target_title),upgrade_reason=nullif(btrim(target_upgrade_reason),''),
      current_problem=nullif(btrim(target_current_problem),''),use_cases=coalesce(target_use_cases,'{}'),expected_value=nullif(btrim(target_expected_value),''),
      budget=target_budget,priority=target_priority,desired_purchase_date=target_desired_purchase_date,
      reference_urls=coalesce(target_reference_urls,'{}'),status=target_status where id=target_proposal_id returning id into saved;
  end if;
  return saved;
end; $$;

create or replace function public.decide_equipment_proposal(target_proposal_id uuid,target_decision text,target_feedback text default null)
returns void language plpgsql security definer set search_path='' as $$
declare proposal public.equipment_proposals%rowtype;
begin
  select * into proposal from public.equipment_proposals where id=target_proposal_id for update;
  if proposal.id is null or not public.is_workspace_super_admin(proposal.workspace_id) then raise exception 'Only Super Admin can decide Equipment Proposals'; end if;
  if target_decision not in ('viewed','approved','paused','rejected','purchased') then raise exception 'Unsupported Proposal decision'; end if;
  update public.equipment_proposals set status=target_decision,boss_feedback=nullif(btrim(target_feedback),''),
    decided_by=auth.uid(),decided_at=now(),purchased_at=case when target_decision='purchased' then now() else purchased_at end
  where id=target_proposal_id;
end; $$;

revoke all on function public.list_equipment_proposals(uuid),public.save_equipment_proposal(uuid,uuid,text,text,text,text[],text,numeric,text,date,text[],text),public.decide_equipment_proposal(uuid,text,text) from public,anon;
grant execute on function public.list_equipment_proposals(uuid),public.save_equipment_proposal(uuid,uuid,text,text,text,text[],text,numeric,text,date,text[],text),public.decide_equipment_proposal(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
