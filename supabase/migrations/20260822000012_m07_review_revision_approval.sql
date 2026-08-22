-- ContentOS M07: immutable Script/Media versions and DB-enforced review workflow.

create table public.script_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  body text not null check (btrim(body) <> ''),
  status text not null default 'draft' check (status in ('draft','submitted','approved','superseded')),
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  note text,
  unique(content_id, version_number)
);

create table public.media_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  version_type text not null check (version_type in ('first_cut','revision','final')),
  external_url text,
  local_path text,
  nas_path text,
  submitted_by uuid not null references public.user_profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  note text,
  is_client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  constraint media_version_location_check check (
    nullif(btrim(external_url),'') is not null or nullif(btrim(local_path),'') is not null or nullif(btrim(nas_path),'') is not null
  ),
  unique(content_id, version_number)
);

create table public.content_approval_requirements (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete restrict,
  approval_type text not null check (approval_type in ('topic','script','internal_video','client','final')),
  is_required boolean not null default false,
  assigned_reviewer_user_id uuid references public.user_profiles(id) on delete restrict,
  status text not null default 'not_required' check (status in ('not_required','pending','approved','revision_required','waived')),
  notes text,
  configured_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(content_id, approval_type),
  constraint approval_requirement_state_check check (
    (not is_required and status = 'not_required') or
    (is_required and assigned_reviewer_user_id is not null and status <> 'not_required')
  )
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete restrict,
  approval_requirement_id uuid not null references public.content_approval_requirements(id) on delete restrict,
  approval_type text not null check (approval_type in ('topic','script','internal_video','client','final')),
  target_type text not null check (target_type in ('content','script_version','media_version')),
  script_version_id uuid references public.script_versions(id) on delete restrict,
  media_version_id uuid references public.media_versions(id) on delete restrict,
  requested_reviewer_user_id uuid references public.user_profiles(id) on delete restrict,
  approver_user_id uuid references public.user_profiles(id) on delete restrict,
  external_approver_name text,
  result text not null check (result in ('approved','revision_required')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz not null default now(),
  channel text not null default 'contentos' check (channel in ('contentos','whatsapp','face_to_face','call','other')),
  recorded_by uuid not null references public.user_profiles(id) on delete restrict,
  note text,
  evidence_url text,
  evidence_visibility text not null default 'internal' check (evidence_visibility = 'internal'),
  created_at timestamptz not null default now(),
  constraint approval_actor_check check (
    (channel = 'contentos' and approver_user_id is not null and external_approver_name is null)
    or (channel <> 'contentos' and approver_user_id is null and nullif(btrim(external_approver_name),'') is not null)
  ),
  constraint approval_target_check check (
    (target_type='content' and script_version_id is null and media_version_id is null)
    or (target_type='script_version' and script_version_id is not null and media_version_id is null)
    or (target_type='media_version' and media_version_id is not null and script_version_id is null)
  )
);

create table public.revision_requests (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete restrict,
  review_scope text not null check (review_scope in ('internal','client')),
  target_type text not null check (target_type in ('script_version','media_version')),
  script_version_id uuid references public.script_versions(id) on delete restrict,
  media_version_id uuid references public.media_versions(id) on delete restrict,
  requested_by uuid references public.user_profiles(id) on delete restrict,
  external_reviewer_name text,
  reason_code text not null check (reason_code in ('subtitle','pacing','hook','visual','brand','information','client_request','audio','other')),
  reason_notes text,
  requested_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','resolved','cancelled')),
  resolved_at timestamptz,
  resolution_note text,
  resulting_script_version_id uuid references public.script_versions(id) on delete restrict,
  resulting_media_version_id uuid references public.media_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint revision_target_check check (
    (target_type='script_version' and script_version_id is not null and media_version_id is null)
    or (target_type='media_version' and media_version_id is not null and script_version_id is null)
  ),
  constraint revision_requester_check check (requested_by is not null or nullif(btrim(external_reviewer_name),'') is not null),
  constraint revision_other_reason_check check (reason_code <> 'other' or nullif(btrim(reason_notes),'') is not null),
  constraint revision_resolution_check check (
    (status='open' and resolved_at is null) or (status<>'open' and resolved_at is not null)
  )
);

alter table public.contents add column current_script_version_id uuid references public.script_versions(id) on delete restrict;
alter table public.workflow_events drop constraint workflow_events_event_type_check;
alter table public.workflow_events add constraint workflow_events_event_type_check check (event_type in (
  'marked_ready_to_shoot','shoot_started','shoot_completed','editing_started',
  'first_cut_submitted','review_started','revision_requested','revision_started','revision_submitted',
  'sent_to_client_review','approval_recorded','final_media_submitted','final_approved','approval_overridden'
));
alter table public.workflow_events
  add column script_version_id uuid references public.script_versions(id) on delete restrict,
  add column media_version_id uuid references public.media_versions(id) on delete restrict,
  add column revision_request_id uuid references public.revision_requests(id) on delete restrict,
  add column approval_id uuid references public.approvals(id) on delete restrict;
alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check check (entity_type in (
  'content','content_contributor','script_version','media_version','revision_request','approval_requirement','approval'
));

create index script_versions_content_version_idx on public.script_versions(content_id, version_number desc);
create index media_versions_content_version_idx on public.media_versions(content_id, version_number desc);
create index approval_requirements_content_stage_idx on public.content_approval_requirements(content_id, approval_type);
create index approvals_content_stage_decided_idx on public.approvals(content_id, approval_type, decided_at desc);
create index revision_requests_content_status_idx on public.revision_requests(content_id, status, requested_at desc);

create trigger script_versions_immutable before update or delete on public.script_versions
for each row execute function public.prevent_immutable_history_mutation();
create trigger media_versions_immutable before update or delete on public.media_versions
for each row execute function public.prevent_immutable_history_mutation();
create trigger approvals_immutable before update or delete on public.approvals
for each row execute function public.prevent_immutable_history_mutation();

alter table public.script_versions enable row level security;
alter table public.media_versions enable row level security;
alter table public.content_approval_requirements enable row level security;
alter table public.approvals enable row level security;
alter table public.revision_requests enable row level security;

create policy "Authorized internal users can view Script Versions" on public.script_versions
for select to authenticated using (public.can_view_content(content_id));
create policy "Authorized internal users can view Media Versions" on public.media_versions
for select to authenticated using (public.can_view_content(content_id));
create policy "Authorized internal users can view Approval Requirements" on public.content_approval_requirements
for select to authenticated using (public.can_view_content(content_id));
create policy "Authorized internal users can view Approvals" on public.approvals
for select to authenticated using (public.can_view_content(content_id));
create policy "Authorized internal users can view Revision Requests" on public.revision_requests
for select to authenticated using (public.can_view_content(content_id));

revoke insert,update,delete on public.script_versions, public.media_versions,
  public.content_approval_requirements, public.approvals, public.revision_requests from anon, authenticated;

create or replace function public.is_assigned_reviewer(target_content_id uuid, target_stage text, target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.content_approval_requirements ar
    where ar.content_id=target_content_id and ar.approval_type=target_stage and ar.is_required
      and ar.assigned_reviewer_user_id=target_user_id
      and public.has_active_content_assignment(target_content_id,'reviewer',target_user_id)
  );
$$;

create or replace function public.m07_assert_target(target_content_id uuid, target_type text, target_id uuid)
returns void language plpgsql stable security definer set search_path='' as $$
begin
  if target_type='content' then
    if target_id is distinct from target_content_id then raise exception 'Approval target is not this Content'; end if;
  elsif target_type='script_version' then
    if not exists(select 1 from public.script_versions where id=target_id and content_id=target_content_id) then raise exception 'Script target is not part of this Content'; end if;
  elsif target_type='media_version' then
    if not exists(select 1 from public.media_versions where id=target_id and content_id=target_content_id) then raise exception 'Media target is not part of this Content'; end if;
  else raise exception 'Unsupported approval target type'; end if;
end;
$$;

create or replace function public.create_script_version(target_content_id uuid, target_body text, target_status text default 'draft', target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; saved uuid; next_version integer;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.record_status<>'active' then raise exception 'Active Content not found'; end if;
  if not public.can_manage_content_assignments(c.id) then raise exception 'Script version access denied'; end if;
  if nullif(btrim(target_body),'') is null then raise exception 'Script body is required'; end if;
  if target_status not in ('draft','submitted') then raise exception 'New Script status must be Draft or Submitted'; end if;
  select coalesce(max(version_number),0)+1 into next_version from public.script_versions where content_id=c.id;
  insert into public.script_versions(content_id,version_number,body,status,created_by,note)
  values(c.id,next_version,btrim(target_body),target_status,auth.uid(),nullif(btrim(target_note),'')) returning id into saved;
  update public.contents set current_script_version_id=saved where id=c.id;
  insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
  values(c.workspace_id,c.client_id,c.id,auth.uid(),'script_version',saved,'script_version_created',jsonb_build_object('version',next_version,'status',target_status));
  return saved;
end; $$;

create or replace function public.configure_approval_requirement(target_content_id uuid,target_approval_type text,target_required boolean,target_reviewer_user_id uuid default null,target_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; saved uuid; next_status text;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or not public.can_manage_content_assignments(c.id) then raise exception 'Approval configuration access denied'; end if;
  if target_approval_type not in ('topic','script','internal_video','client','final') then raise exception 'Unsupported approval type'; end if;
  if target_required and (target_reviewer_user_id is null or not public.has_active_content_assignment(c.id,'reviewer',target_reviewer_user_id)) then
    raise exception 'Required approval needs an active assigned Reviewer';
  end if;
  next_status:=case when target_required then 'pending' else 'not_required' end;
  insert into public.content_approval_requirements(content_id,approval_type,is_required,assigned_reviewer_user_id,status,notes,configured_by)
  values(c.id,target_approval_type,target_required,case when target_required then target_reviewer_user_id end,next_status,nullif(btrim(target_notes),''),auth.uid())
  on conflict(content_id,approval_type) do update set is_required=excluded.is_required,
    assigned_reviewer_user_id=excluded.assigned_reviewer_user_id,status=next_status,notes=excluded.notes,configured_by=auth.uid(),updated_at=now()
  returning id into saved;
  insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
  values(c.workspace_id,c.client_id,c.id,auth.uid(),'approval_requirement',saved,'approval_requirement_configured',jsonb_build_object('approval_type',target_approval_type,'required',target_required,'reviewer_user_id',target_reviewer_user_id));
  return saved;
end; $$;

create or replace function public.m07_insert_event(c public.contents,event_name text,next_state text,target_note text default null,target_media uuid default null,target_revision uuid default null,target_approval uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid;
begin
  insert into public.workflow_events(workspace_id,client_id,content_id,actor_user_id,event_type,from_state,to_state,occurred_at,notes,media_version_id,revision_request_id,approval_id)
  values(c.workspace_id,c.client_id,c.id,auth.uid(),event_name,c.current_status,next_state,now(),nullif(btrim(target_note),''),target_media,target_revision,target_approval)
  returning id into saved; return saved;
end; $$;

create or replace function public.submit_first_cut(target_content_id uuid,expected_from_state text,target_external_url text default null,target_local_path text default null,target_nas_path text default null,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; saved uuid;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.current_status is distinct from expected_from_state then raise exception 'Stale Workflow Action'; end if;
  if expected_from_state<>'editing' then raise exception 'First Cut can only be submitted from Editing'; end if;
  if not(public.has_workspace_role(c.workspace_id,'editor') and public.has_active_content_assignment(c.id,'editor')) then raise exception 'Assigned Editor permission required'; end if;
  if exists(select 1 from public.media_versions where content_id=c.id) then raise exception 'First Cut already exists'; end if;
  insert into public.media_versions(content_id,version_number,version_type,external_url,local_path,nas_path,submitted_by,note)
  values(c.id,1,'first_cut',nullif(btrim(target_external_url),''),nullif(btrim(target_local_path),''),nullif(btrim(target_nas_path),''),auth.uid(),nullif(btrim(target_note),'')) returning id into saved;
  perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status='first_cut_submitted' where id=c.id; perform set_config('contentos.workflow_action','',true);
  perform public.m07_insert_event(c,'first_cut_submitted','first_cut_submitted',target_note,saved);
  return saved;
end; $$;

create or replace function public.start_content_review(target_content_id uuid,expected_from_state text,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; saved uuid;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.current_status is distinct from expected_from_state then raise exception 'Stale Workflow Action'; end if;
  if expected_from_state<>'first_cut_submitted' then raise exception 'Review can only start after First Cut'; end if;
  if not public.is_assigned_reviewer(c.id,'internal_video') then raise exception 'Assigned Internal Video Reviewer required'; end if;
  perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status='internal_review' where id=c.id; perform set_config('contentos.workflow_action','',true);
  saved:=public.m07_insert_event(c,'review_started','internal_review',target_note); return saved;
end; $$;

create or replace function public.request_content_revision(target_content_id uuid,expected_from_state text,target_reason_code text,target_reason_notes text default null,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; stage text; scope_name text; media_id uuid; saved uuid; approval_id uuid; req_id uuid;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.current_status is distinct from expected_from_state then raise exception 'Stale Workflow Action'; end if;
  stage:=case expected_from_state when 'internal_review' then 'internal_video' when 'client_review' then 'client' else null end;
  scope_name:=case when stage='client' then 'client' else 'internal' end;
  if stage is null then raise exception 'Revision cannot be requested from this state'; end if;
  if not public.is_assigned_reviewer(c.id,stage) then raise exception 'Assigned Reviewer permission required'; end if;
  select id into media_id from public.media_versions where content_id=c.id order by version_number desc limit 1;
  if media_id is null then raise exception 'No Media Version to revise'; end if;
  if exists(select 1 from public.media_versions where id=media_id and submitted_by=auth.uid()) then raise exception 'Required approval cannot be self-reviewed'; end if;
  insert into public.revision_requests(content_id,review_scope,target_type,media_version_id,requested_by,reason_code,reason_notes)
  values(c.id,scope_name,'media_version',media_id,auth.uid(),target_reason_code,nullif(btrim(target_reason_notes),'')) returning id into saved;
  select id into req_id from public.content_approval_requirements where content_id=c.id and approval_type=stage;
  insert into public.approvals(content_id,approval_requirement_id,approval_type,target_type,media_version_id,requested_reviewer_user_id,approver_user_id,result,recorded_by,note)
  values(c.id,req_id,stage,'media_version',media_id,auth.uid(),auth.uid(),'revision_required',auth.uid(),nullif(btrim(target_note),'')) returning id into approval_id;
  update public.content_approval_requirements set status='revision_required',updated_at=now() where id=req_id;
  perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status='revision_required' where id=c.id; perform set_config('contentos.workflow_action','',true);
  perform public.m07_insert_event(c,'revision_requested','revision_required',target_note,media_id,saved,approval_id); return saved;
end; $$;

create or replace function public.start_content_revision(target_content_id uuid,expected_from_state text,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; saved uuid;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.current_status is distinct from expected_from_state then raise exception 'Stale Workflow Action'; end if;
  if expected_from_state<>'revision_required' or not(public.has_workspace_role(c.workspace_id,'editor') and public.has_active_content_assignment(c.id,'editor')) then raise exception 'Assigned Editor permission required'; end if;
  if not exists(select 1 from public.revision_requests where content_id=c.id and status='open') then raise exception 'No open Revision Request'; end if;
  perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status='editing' where id=c.id; perform set_config('contentos.workflow_action','',true);
  saved:=public.m07_insert_event(c,'revision_started','editing',target_note); return saved;
end; $$;

create or replace function public.submit_content_revision(target_content_id uuid,expected_from_state text,target_external_url text default null,target_local_path text default null,target_nas_path text default null,target_note text default null,target_resolution_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; saved uuid; request_row public.revision_requests%rowtype; next_version integer; next_state text;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.current_status is distinct from expected_from_state then raise exception 'Stale Workflow Action'; end if;
  if expected_from_state<>'editing' or not(public.has_workspace_role(c.workspace_id,'editor') and public.has_active_content_assignment(c.id,'editor')) then raise exception 'Assigned Editor permission required'; end if;
  select * into request_row from public.revision_requests where content_id=c.id and status='open' order by requested_at desc limit 1 for update;
  if request_row.id is null then raise exception 'No open Revision Request'; end if;
  select coalesce(max(version_number),0)+1 into next_version from public.media_versions where content_id=c.id;
  insert into public.media_versions(content_id,version_number,version_type,external_url,local_path,nas_path,submitted_by,note)
  values(c.id,next_version,'revision',nullif(btrim(target_external_url),''),nullif(btrim(target_local_path),''),nullif(btrim(target_nas_path),''),auth.uid(),nullif(btrim(target_note),'')) returning id into saved;
  update public.revision_requests set status='resolved',resolved_at=now(),resolution_note=nullif(btrim(target_resolution_note),''),resulting_media_version_id=saved,updated_at=now() where id=request_row.id;
  next_state:=case when request_row.review_scope='client' then 'client_review' else 'internal_review' end;
  update public.content_approval_requirements set status='pending',updated_at=now() where content_id=c.id and approval_type=case when request_row.review_scope='client' then 'client' else 'internal_video' end;
  perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status=next_state where id=c.id; perform set_config('contentos.workflow_action','',true);
  perform public.m07_insert_event(c,'revision_submitted',next_state,target_note,saved,request_row.id); return saved;
end; $$;

create or replace function public.approve_content_stage(target_content_id uuid,target_approval_type text,target_type text,target_id uuid,expected_from_state text,target_note text default null,target_evidence_url text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; req public.content_approval_requirements%rowtype; submitter uuid; saved uuid; next_state text;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.current_status is distinct from expected_from_state then raise exception 'Stale Workflow Action'; end if;
  select * into req from public.content_approval_requirements where content_id=c.id and approval_type=target_approval_type for update;
  if req.id is null or not req.is_required or not public.is_assigned_reviewer(c.id,target_approval_type) then raise exception 'Assigned Reviewer permission required'; end if;
  perform public.m07_assert_target(c.id,target_type,target_id);
  submitter:=case target_type when 'script_version' then (select created_by from public.script_versions where id=target_id) when 'media_version' then (select submitted_by from public.media_versions where id=target_id) else c.created_by end;
  if submitter=auth.uid() then raise exception 'Required approval cannot be self-approved'; end if;
  insert into public.approvals(content_id,approval_requirement_id,approval_type,target_type,script_version_id,media_version_id,requested_reviewer_user_id,approver_user_id,result,recorded_by,note,evidence_url)
  values(c.id,req.id,target_approval_type,target_type,case when target_type='script_version' then target_id end,case when target_type='media_version' then target_id end,req.assigned_reviewer_user_id,auth.uid(),'approved',auth.uid(),nullif(btrim(target_note),''),nullif(btrim(target_evidence_url),'')) returning id into saved;
  update public.content_approval_requirements set status='approved',updated_at=now() where id=req.id;
  if target_approval_type='internal_video' then
    next_state:=case when exists(select 1 from public.content_approval_requirements where content_id=c.id and approval_type in ('client','final') and is_required and status not in ('approved','waived')) then 'client_review' else 'approved' end;
  elsif target_approval_type in ('client','final') then
    next_state:=case when exists(select 1 from public.content_approval_requirements where content_id=c.id and is_required and status not in ('approved','waived')) then c.current_status else 'approved' end;
  else next_state:=c.current_status; end if;
  if next_state is distinct from c.current_status then perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status=next_state where id=c.id; perform set_config('contentos.workflow_action','',true); end if;
  perform public.m07_insert_event(c,case when target_approval_type='final' then 'final_approved' else 'approval_recorded' end,next_state,target_note,case when target_type='media_version' then target_id end,null,saved); return saved;
end; $$;

create or replace function public.record_external_approval(target_content_id uuid,target_approval_type text,target_type text,target_id uuid,expected_from_state text,target_name text,target_channel text,target_decided_at timestamptz,target_note text default null,target_evidence_url text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; req public.content_approval_requirements%rowtype; saved uuid; next_state text;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.current_status is distinct from expected_from_state then raise exception 'Stale Workflow Action'; end if;
  if not(public.is_workspace_super_admin(c.workspace_id) or (public.has_workspace_role(c.workspace_id,'internal_manager') and public.has_active_client_access(c.client_id))) then raise exception 'External approval recording access denied'; end if;
  if target_channel not in ('whatsapp','face_to_face','call','other') or nullif(btrim(target_name),'') is null or target_decided_at is null then raise exception 'External approval identity, channel, and time are required'; end if;
  select * into req from public.content_approval_requirements where content_id=c.id and approval_type=target_approval_type for update;
  if req.id is null or not req.is_required then raise exception 'Required approval stage not found'; end if;
  perform public.m07_assert_target(c.id,target_type,target_id);
  insert into public.approvals(content_id,approval_requirement_id,approval_type,target_type,script_version_id,media_version_id,requested_reviewer_user_id,external_approver_name,result,decided_at,channel,recorded_by,note,evidence_url)
  values(c.id,req.id,target_approval_type,target_type,case when target_type='script_version' then target_id end,case when target_type='media_version' then target_id end,req.assigned_reviewer_user_id,btrim(target_name),'approved',target_decided_at,target_channel,auth.uid(),nullif(btrim(target_note),''),nullif(btrim(target_evidence_url),'')) returning id into saved;
  update public.content_approval_requirements set status='approved',updated_at=now() where id=req.id;
  next_state:=case when exists(select 1 from public.content_approval_requirements where content_id=c.id and is_required and status not in ('approved','waived')) then c.current_status else 'approved' end;
  if next_state is distinct from c.current_status then perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status=next_state where id=c.id; perform set_config('contentos.workflow_action','',true); end if;
  perform public.m07_insert_event(c,'approval_recorded',next_state,target_note,case when target_type='media_version' then target_id end,null,saved); return saved;
end; $$;

create or replace function public.override_approval_requirement(target_requirement_id uuid,target_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare req public.content_approval_requirements%rowtype; c public.contents%rowtype; saved uuid; next_state text;
begin
  if nullif(btrim(target_reason),'') is null then raise exception 'Override reason is required'; end if;
  select * into req from public.content_approval_requirements where id=target_requirement_id for update;
  select * into c from public.contents where id=req.content_id for update;
  if req.id is null or not public.is_workspace_super_admin(c.workspace_id) then raise exception 'Super Admin override required'; end if;
  update public.content_approval_requirements set status='waived',updated_at=now() where id=req.id;
  insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
  values(c.workspace_id,c.client_id,c.id,auth.uid(),'approval_requirement',req.id,'approval_overridden',jsonb_build_object('approval_type',req.approval_type,'reason',btrim(target_reason))) returning id into saved;
  next_state:=case when c.current_status in ('internal_review','client_review') and not exists(select 1 from public.content_approval_requirements where content_id=c.id and is_required and status not in ('approved','waived')) then 'approved' else c.current_status end;
  if next_state is distinct from c.current_status then perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status=next_state where id=c.id; perform set_config('contentos.workflow_action','',true); end if;
  perform public.m07_insert_event(c,'approval_overridden',next_state,target_reason); return saved;
end; $$;

create or replace function public.send_content_to_client_review(target_content_id uuid,expected_from_state text,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; saved uuid;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.current_status is distinct from expected_from_state then raise exception 'Stale Workflow Action'; end if;
  if expected_from_state<>'internal_review' or not public.is_assigned_reviewer(c.id,'internal_video') then raise exception 'Assigned Internal Reviewer required'; end if;
  if not exists(select 1 from public.content_approval_requirements where content_id=c.id and approval_type='internal_video' and status='approved') then raise exception 'Internal Video approval is required first'; end if;
  if not exists(select 1 from public.content_approval_requirements where content_id=c.id and approval_type='client' and is_required) then raise exception 'Client approval is not required'; end if;
  perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status='client_review' where id=c.id; perform set_config('contentos.workflow_action','',true);
  saved:=public.m07_insert_event(c,'sent_to_client_review','client_review',target_note); return saved;
end; $$;

create or replace function public.submit_final_media(target_content_id uuid,expected_from_state text,target_external_url text default null,target_local_path text default null,target_nas_path text default null,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; saved uuid; next_version integer;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.current_status is distinct from expected_from_state then raise exception 'Stale Workflow Action'; end if;
  if expected_from_state<>'client_review' or not(public.has_workspace_role(c.workspace_id,'editor') and public.has_active_content_assignment(c.id,'editor')) then raise exception 'Assigned Editor permission required'; end if;
  if not exists(select 1 from public.content_approval_requirements where content_id=c.id and approval_type='final' and is_required and status='pending') then raise exception 'Pending Final approval is required'; end if;
  select coalesce(max(version_number),0)+1 into next_version from public.media_versions where content_id=c.id;
  insert into public.media_versions(content_id,version_number,version_type,external_url,local_path,nas_path,submitted_by,note)
  values(c.id,next_version,'final',nullif(btrim(target_external_url),''),nullif(btrim(target_local_path),''),nullif(btrim(target_nas_path),''),auth.uid(),nullif(btrim(target_note),'')) returning id into saved;
  perform public.m07_insert_event(c,'final_media_submitted',c.current_status,target_note,saved); return saved;
end; $$;

create or replace function public.guard_content_status_transition()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.current_status is distinct from new.current_status and coalesce(current_setting('contentos.workflow_action',true),'')<>'allowed' then
    raise exception 'Content status can only change through an authorized Workflow Action';
  end if;
  if old.current_status='draft' and new.current_status='ready_to_shoot' and exists(
    select 1 from public.content_approval_requirements where content_id=old.id and approval_type in ('topic','script') and is_required and status not in ('approved','waived')
  ) then raise exception 'Required Topic and Script approvals must be complete'; end if;
  return new;
end; $$;

revoke all on function public.is_assigned_reviewer(uuid,text,uuid), public.m07_assert_target(uuid,text,uuid), public.m07_insert_event(public.contents,text,text,text,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.create_script_version(uuid,text,text,text), public.configure_approval_requirement(uuid,text,boolean,uuid,text), public.submit_first_cut(uuid,text,text,text,text,text), public.start_content_review(uuid,text,text), public.request_content_revision(uuid,text,text,text,text), public.start_content_revision(uuid,text,text), public.submit_content_revision(uuid,text,text,text,text,text,text), public.approve_content_stage(uuid,text,text,uuid,text,text,text), public.record_external_approval(uuid,text,text,uuid,text,text,text,timestamptz,text,text), public.override_approval_requirement(uuid,text), public.send_content_to_client_review(uuid,text,text), public.submit_final_media(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.create_script_version(uuid,text,text,text), public.configure_approval_requirement(uuid,text,boolean,uuid,text), public.submit_first_cut(uuid,text,text,text,text,text), public.start_content_review(uuid,text,text), public.request_content_revision(uuid,text,text,text,text), public.start_content_revision(uuid,text,text), public.submit_content_revision(uuid,text,text,text,text,text,text), public.approve_content_stage(uuid,text,text,uuid,text,text,text), public.record_external_approval(uuid,text,text,uuid,text,text,text,timestamptz,text,text), public.override_approval_requirement(uuid,text), public.send_content_to_client_review(uuid,text,text), public.submit_final_media(uuid,text,text,text,text,text) to authenticated;
