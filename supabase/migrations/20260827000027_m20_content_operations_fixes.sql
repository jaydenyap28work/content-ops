-- M20: operational fixes for Team Members, Idea sources, lightweight tasks, and analytics imports.
-- Existing Content, Shooting Packs, dates, workflow, scenes, assignments, and provenance are preserved.

-- A name-only Team Member create must be stable and must never create a duplicate person.
create unique index if not exists team_members_workspace_lower_name_key
  on public.team_members(workspace_id,lower(btrim(name)));

create or replace function public.create_team_member(target_workspace_id uuid,target_name text,target_job_title text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; clean_name text:=btrim(target_name); clean_title text:=nullif(btrim(target_job_title),'');
begin
  if not public.is_workspace_super_admin(target_workspace_id) then raise exception 'Only Super Admin can create Team Members'; end if;
  if nullif(clean_name,'') is null then raise exception 'Team Member name is required'; end if;
  select id into saved from public.team_members
    where workspace_id=target_workspace_id and lower(btrim(name))=lower(clean_name) for update;
  if saved is not null then
    update public.team_members set status='active',job_title=coalesce(clean_title,job_title) where id=saved;
    return saved;
  end if;
  insert into public.team_members(workspace_id,name,job_title,email,auth_user_id,login_status,status,created_by)
  values(target_workspace_id,clean_name,clean_title,null,null,'not_enabled','active',auth.uid()) returning id into saved;
  return saved;
end; $$;

-- Keep source input optional while retaining a normalized platform hint.
alter table public.ideas add column source_platform text;
alter table public.ideas add constraint ideas_source_platform_check check(source_platform is null or source_platform in
 ('douyin','xhs','tiktok','instagram','facebook','threads','youtube','lemon8','web'));

create or replace function public.save_idea(
  target_idea_id uuid,target_workspace_id uuid,target_client_id uuid,target_title text,target_source_url text,
  target_original_topic text,target_original_hook text,target_why_it_works text,target_our_angle text,target_category_id uuid,
  target_suggested_format text,target_priority text,target_owner_user_id uuid,target_notes text,target_reference_ids uuid[],
  target_tag_names text[],target_contributors jsonb,target_planned_date date,target_source_platform text
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; normalized_platform text:=nullif(lower(btrim(target_source_platform)),'');
begin
  if normalized_platform is not null and normalized_platform not in ('douyin','xhs','tiktok','instagram','facebook','threads','youtube','lemon8','web') then
    raise exception 'Unsupported source platform';
  end if;
  saved:=public.save_idea(target_idea_id,target_workspace_id,target_client_id,target_title,target_source_url,target_original_topic,
    target_original_hook,target_why_it_works,target_our_angle,target_category_id,target_suggested_format,target_priority,
    target_owner_user_id,target_notes,target_reference_ids,target_tag_names,target_contributors,target_planned_date);
  update public.ideas set source_platform=normalized_platform where id=saved;
  return saved;
end; $$;
revoke all on function public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text) from public,anon;
grant execute on function public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text) to authenticated;

-- Lightweight operational tasks, intentionally without subtasks, dependencies, sprints, or Gantt data.
create table public.tasks(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  content_id uuid references public.contents(id) on delete restrict,
  title text not null check(nullif(btrim(title),'') is not null),
  notes text,
  assigned_team_member_id uuid references public.team_members(id) on delete restrict,
  due_date date,
  status text not null default 'pending' check(status in ('pending','in_progress','completed')),
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_completion_check check((status='completed' and completed_at is not null) or (status<>'completed' and completed_at is null))
);
create index tasks_workspace_status_due_idx on public.tasks(workspace_id,status,due_date);
create index tasks_assignee_status_due_idx on public.tasks(assigned_team_member_id,status,due_date);
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
alter table public.tasks enable row level security;
create policy "Internal members can view Workspace Tasks" on public.tasks for select to authenticated
  using(public.is_internal_workspace_member(workspace_id) and (content_id is null or public.can_view_content(content_id)));
revoke all on table public.tasks from anon;
revoke insert,update,delete,truncate,references,trigger on table public.tasks from authenticated;
grant select on table public.tasks to authenticated;

create or replace function public.list_tasks(target_workspace_id uuid)
returns table(id uuid,workspace_id uuid,content_id uuid,content_title text,title text,notes text,assigned_team_member_id uuid,
 assigned_name text,due_date date,status text,is_mine boolean,created_by uuid,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select t.id,t.workspace_id,t.content_id,c.title,t.title,t.notes,t.assigned_team_member_id,tm.name,t.due_date,t.status,
   (tm.auth_user_id=auth.uid()),t.created_by,t.created_at,t.updated_at
 from public.tasks t left join public.contents c on c.id=t.content_id left join public.team_members tm on tm.id=t.assigned_team_member_id
 where t.workspace_id=target_workspace_id and public.is_internal_workspace_member(target_workspace_id)
   and (t.content_id is null or public.can_view_content(t.content_id))
 order by (t.status='completed'),t.due_date nulls last,t.created_at desc;
$$;

create or replace function public.save_task(target_task_id uuid,target_workspace_id uuid,target_title text,target_notes text,
 target_assigned_team_member_id uuid,target_due_date date,target_status text,target_content_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; clean_title text:=btrim(target_title); content_scope uuid; member_scope uuid; existing_scope uuid;
begin
  if not public.is_internal_workspace_member(target_workspace_id) then raise exception 'Task access denied'; end if;
  if nullif(clean_title,'') is null then raise exception 'Task title is required'; end if;
  if target_status not in ('pending','in_progress','completed') then raise exception 'Unsupported task status'; end if;
  if target_content_id is not null then
    select workspace_id into content_scope from public.contents where id=target_content_id and record_status='active';
    if content_scope is distinct from target_workspace_id or not public.can_view_content(target_content_id) then raise exception 'Task Content access denied'; end if;
  end if;
  if target_assigned_team_member_id is not null then
    select workspace_id into member_scope from public.team_members where id=target_assigned_team_member_id and status='active';
    if member_scope is distinct from target_workspace_id then raise exception 'Task assignee must be an active Workspace Team Member'; end if;
  end if;
  if target_task_id is null then
    insert into public.tasks(workspace_id,content_id,title,notes,assigned_team_member_id,due_date,status,created_by,completed_at)
    values(target_workspace_id,target_content_id,clean_title,nullif(btrim(target_notes),''),target_assigned_team_member_id,target_due_date,target_status,auth.uid(),case when target_status='completed' then now() else null end)
    returning id into saved;
  else
    select workspace_id into existing_scope from public.tasks where id=target_task_id for update;
    if existing_scope is distinct from target_workspace_id then raise exception 'Task ownership scope cannot be changed'; end if;
    update public.tasks set content_id=target_content_id,title=clean_title,notes=nullif(btrim(target_notes),''),
      assigned_team_member_id=target_assigned_team_member_id,due_date=target_due_date,status=target_status,
      completed_at=case when target_status='completed' then coalesce(completed_at,now()) else null end where id=target_task_id returning id into saved;
  end if;
  return saved;
end; $$;

create or replace function public.delete_task(target_task_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare task_row public.tasks%rowtype;
begin
  select * into task_row from public.tasks where id=target_task_id for update;
  if task_row.id is null then raise exception 'Task not found'; end if;
  if not public.is_internal_workspace_member(task_row.workspace_id) then raise exception 'Task access denied'; end if;
  if task_row.created_by<>auth.uid() and not public.is_workspace_super_admin(task_row.workspace_id)
    and not public.has_workspace_role(task_row.workspace_id,'internal_manager') then raise exception 'Only the creator or management can delete this Task'; end if;
  delete from public.tasks where id=target_task_id;
end; $$;

revoke all on function public.list_tasks(uuid),public.save_task(uuid,uuid,text,text,uuid,date,text,uuid),public.delete_task(uuid) from public,anon;
grant execute on function public.list_tasks(uuid),public.save_task(uuid,uuid,text,text,uuid,date,text,uuid),public.delete_task(uuid) to authenticated;

-- CSV/Paste imports reuse immutable Analytics Snapshots and preserve blank metrics as NULL.
create or replace function public.add_imported_analytics_snapshot(target_publication_id uuid,target_captured_at timestamptz,
 target_data_source text,target_views_or_plays bigint default null,target_reach bigint default null,target_likes bigint default null,
 target_comments bigint default null,target_shares bigint default null,target_saves_or_collects bigint default null,target_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.publications%rowtype; saved uuid;
begin
  select * into p from public.publications where id=target_publication_id and status='published';
  if p.id is null then raise exception 'Published Publication required'; end if;
  if not public.can_update_publication_analytics(p.id) then raise exception 'Analytics access denied'; end if;
  if target_data_source not in ('manual','csv') then raise exception 'Unsupported Analytics data source'; end if;
  insert into public.analytics_snapshots(workspace_id,client_id,publication_id,captured_at,snapshot_type,data_source,
    views_or_plays,reach,likes,comments,shares,saves_or_collects,platform_metrics,entered_by,note)
  values(p.workspace_id,p.client_id,p.id,target_captured_at,'current',target_data_source,target_views_or_plays,target_reach,
    target_likes,target_comments,target_shares,target_saves_or_collects,'{}'::jsonb,auth.uid(),nullif(btrim(target_note),'')) returning id into saved;
  return saved;
end; $$;
revoke all on function public.add_imported_analytics_snapshot(uuid,timestamptz,text,bigint,bigint,bigint,bigint,bigint,bigint,text) from public,anon;
grant execute on function public.add_imported_analytics_snapshot(uuid,timestamptz,text,bigint,bigint,bigint,bigint,bigint,bigint,text) to authenticated;

notify pgrst,'reload schema';