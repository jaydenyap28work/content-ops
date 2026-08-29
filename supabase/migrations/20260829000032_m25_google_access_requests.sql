-- M25: Google access request and atomic Super Admin approval flow.
-- Unknown authenticated users remain outside every Workspace data boundary.

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  email text not null check (btrim(email) <> '' and email = lower(btrim(email))),
  display_name text,
  avatar_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.user_profiles(id) on delete restrict,
  assigned_role_id uuid references public.roles(id) on delete restrict,
  linked_team_member_id uuid references public.team_members(id) on delete restrict,
  review_note text,
  constraint access_requests_workspace_auth_key unique(workspace_id,auth_user_id),
  constraint access_requests_review_state_check check (
    (status='pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('approved','rejected') and reviewed_at is not null and reviewed_by is not null)
  )
);

create index access_requests_workspace_status_requested_idx
  on public.access_requests(workspace_id,status,requested_at desc);
create index access_requests_normalized_email_idx
  on public.access_requests(workspace_id,email);
create trigger access_requests_set_updated_at before update on public.access_requests
  for each row execute function public.set_updated_at();
alter table public.access_requests enable row level security;
revoke all on table public.access_requests from anon;
revoke insert,update,delete on table public.access_requests from authenticated;
grant select on table public.access_requests to authenticated;

create policy "Applicants can view their own Access Request"
on public.access_requests for select to authenticated
using(auth_user_id=(select auth.uid()));

create policy "Super Admins can view Workspace Access Requests"
on public.access_requests for select to authenticated
using(public.is_workspace_super_admin(workspace_id));

create table public.access_request_audits (
  id uuid primary key default gen_random_uuid(), access_request_id uuid not null references public.access_requests(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  actor_user_id uuid not null references public.user_profiles(id) on delete restrict,
  subject_auth_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check(action in ('approved','rejected')),
  prior_role_codes text[] not null default '{}', assigned_role_code text,
  occurred_at timestamptz not null default now()
);
create index access_request_audits_workspace_occurred_idx on public.access_request_audits(workspace_id,occurred_at desc);
create trigger access_request_audits_immutable before update or delete on public.access_request_audits
  for each row execute function public.prevent_immutable_history_mutation();
alter table public.access_request_audits enable row level security;
revoke all on table public.access_request_audits from anon,authenticated;
grant select on table public.access_request_audits to authenticated;
create policy "Super Admins can view Access Request audits" on public.access_request_audits
  for select to authenticated using(public.is_workspace_super_admin(workspace_id));
create or replace function public.ensure_my_access_request(target_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor auth.users%rowtype;
  request_row public.access_requests%rowtype;
  clean_email text;
  clean_name text;
  avatar text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into actor from auth.users where id=auth.uid();
  clean_email:=lower(btrim(coalesce(actor.email,'')));
  if clean_email='' or actor.email_confirmed_at is null then raise exception 'A verified Email is required'; end if;
  if not exists(select 1 from public.workspaces where id=target_workspace_id and status='active') then
    raise exception 'Workspace is unavailable';
  end if;

  if public.is_active_workspace_member(target_workspace_id) then
    return jsonb_build_object('status','authorized','email',clean_email);
  end if;

  clean_name:=nullif(btrim(coalesce(actor.raw_user_meta_data->>'full_name',actor.raw_user_meta_data->>'name',split_part(clean_email,'@',1))), '');
  avatar:=nullif(btrim(coalesce(actor.raw_user_meta_data->>'avatar_url',actor.raw_user_meta_data->>'picture')), '');

  insert into public.access_requests(workspace_id,auth_user_id,email,display_name,avatar_url)
  values(target_workspace_id,auth.uid(),clean_email,clean_name,avatar)
  on conflict(workspace_id,auth_user_id) do update set
    email=excluded.email,
    display_name=coalesce(excluded.display_name,public.access_requests.display_name),
    avatar_url=coalesce(excluded.avatar_url,public.access_requests.avatar_url),
    requested_at=case when public.access_requests.status='pending' then now() else public.access_requests.requested_at end
  returning * into request_row;

  return jsonb_build_object(
    'id',request_row.id,'status',request_row.status,'email',request_row.email,
    'display_name',request_row.display_name,'requested_at',request_row.requested_at,
    'reviewed_at',request_row.reviewed_at,'review_note',request_row.review_note
  );
end; $$;

create or replace function public.review_access_request(
  target_request_id uuid,
  target_decision text,
  target_role_code text default null,
  target_team_member_id uuid default null,
  target_create_team_member boolean default false,
  target_review_note text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  request_row public.access_requests%rowtype;
  role_row public.roles%rowtype;
  member_row public.team_members%rowtype;
  membership_id uuid;
  clean_note text:=nullif(btrim(target_review_note),'');
  duplicate_profile_id uuid;
  prior_role_codes text[]:='{}';
begin
  select * into request_row from public.access_requests where id=target_request_id for update;
  if request_row.id is null then raise exception 'Access Request not found'; end if;
  if not public.is_workspace_super_admin(request_row.workspace_id) then raise exception 'Only Super Admin can review Access Requests'; end if;
  if request_row.status<>'pending' then raise exception 'Access Request was already reviewed'; end if;
  if target_decision not in ('approved','rejected') then raise exception 'Unsupported review decision'; end if;

  if target_decision='rejected' then
    update public.access_requests set status='rejected',reviewed_at=now(),reviewed_by=auth.uid(),review_note=clean_note
    where id=request_row.id returning * into request_row;
    insert into public.access_request_audits(access_request_id,workspace_id,actor_user_id,subject_auth_user_id,action,prior_role_codes)
    values(request_row.id,request_row.workspace_id,auth.uid(),request_row.auth_user_id,'rejected','{}');
    return jsonb_build_object('id',request_row.id,'status',request_row.status);
  end if;

  if target_role_code not in ('idea_contributor','publisher_marketing','internal_manager','super_admin') then
    raise exception 'Unsupported Access Request role';
  end if;
  select * into role_row from public.roles where workspace_id=request_row.workspace_id and code=target_role_code and is_active for share;
  if role_row.id is null then raise exception 'Assigned role is unavailable'; end if;

  select id into duplicate_profile_id from public.user_profiles
  where lower(btrim(email))=request_row.email and id<>request_row.auth_user_id limit 1;
  if duplicate_profile_id is not null then
    raise exception 'This Email belongs to another Auth identity. Link the Google identity to the existing account before approval.';
  end if;

  insert into public.user_profiles(id,display_name,email,avatar_url,status)
  values(request_row.auth_user_id,coalesce(nullif(btrim(request_row.display_name),''),split_part(request_row.email,'@',1)),request_row.email,request_row.avatar_url,'active')
  on conflict(id) do update set
    display_name=coalesce(nullif(public.user_profiles.display_name,''),excluded.display_name),
    email=excluded.email,
    avatar_url=coalesce(public.user_profiles.avatar_url,excluded.avatar_url),
    status='active',deactivated_at=null;

  if target_team_member_id is not null then
    select * into member_row from public.team_members where id=target_team_member_id for update;
    if member_row.id is null or member_row.workspace_id<>request_row.workspace_id then raise exception 'Team Member is outside this Workspace'; end if;
    if member_row.auth_user_id is not null and member_row.auth_user_id<>request_row.auth_user_id then raise exception 'Team Member is already linked to another login'; end if;
    if member_row.email is not null and lower(btrim(member_row.email))<>request_row.email then raise exception 'Team Member Email does not match the verified Google Email'; end if;
  else
    select * into member_row from public.team_members
    where workspace_id=request_row.workspace_id and email is not null and lower(btrim(email))=request_row.email
    order by created_at limit 1 for update;
    if member_row.id is null and not target_create_team_member then raise exception 'Choose an existing Team Member or allow a new Team Member'; end if;
    if member_row.id is null then
      insert into public.team_members(workspace_id,name,email,auth_user_id,login_status,status,created_by)
      values(request_row.workspace_id,coalesce(nullif(btrim(request_row.display_name),''),split_part(request_row.email,'@',1)),request_row.email,request_row.auth_user_id,'enabled','active',auth.uid())
      returning * into member_row;
    end if;
  end if;

  if member_row.auth_user_id is not null and member_row.auth_user_id<>request_row.auth_user_id then raise exception 'Team Member is already linked to another login'; end if;
  update public.team_members set auth_user_id=request_row.auth_user_id,email=request_row.email,login_status='enabled',status='active'
  where id=member_row.id returning * into member_row;

  insert into public.workspace_members(workspace_id,user_profile_id,status,deactivated_at)
  values(request_row.workspace_id,request_row.auth_user_id,'active',null)
  on conflict(workspace_id,user_profile_id) do update set status='active',deactivated_at=null,updated_at=now()
  returning id into membership_id;

  select coalesce(array_agg(r.code order by r.code),'{}') into prior_role_codes
  from public.workspace_member_roles wmr join public.roles r on r.id=wmr.role_id
  where wmr.workspace_member_id=membership_id;

  insert into public.workspace_member_roles(workspace_member_id,role_id,assigned_by)
  values(membership_id,role_row.id,auth.uid()) on conflict do nothing;

  update public.content_contributors set user_profile_id=request_row.auth_user_id
  where team_member_id=member_row.id and user_profile_id is null;
  update public.contents set current_owner_user_id=request_row.auth_user_id
  where owner_team_member_id=member_row.id and current_owner_user_id is null;

  update public.access_requests set status='approved',reviewed_at=now(),reviewed_by=auth.uid(),assigned_role_id=role_row.id,
    linked_team_member_id=member_row.id,review_note=clean_note
  where id=request_row.id returning * into request_row;

  insert into public.access_request_audits(access_request_id,workspace_id,actor_user_id,subject_auth_user_id,action,prior_role_codes,assigned_role_code)
  values(request_row.id,request_row.workspace_id,auth.uid(),request_row.auth_user_id,'approved',prior_role_codes,role_row.code);

  return jsonb_build_object('id',request_row.id,'status',request_row.status,'team_member_id',member_row.id,'membership_id',membership_id,'role',role_row.code);
end; $$;

revoke all on function public.ensure_my_access_request(uuid) from public,anon;
revoke all on function public.review_access_request(uuid,text,text,uuid,boolean,text) from public,anon;
grant execute on function public.ensure_my_access_request(uuid) to authenticated;
grant execute on function public.review_access_request(uuid,text,text,uuid,boolean,text) to authenticated;

notify pgrst,'reload schema';
