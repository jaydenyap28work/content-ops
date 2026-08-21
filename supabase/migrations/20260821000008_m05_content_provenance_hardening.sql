-- M05 hardening: historical Idea Creator attribution must survive deactivation.

create or replace function public.enforce_content_contributor_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare content_workspace uuid; content_client uuid; role_workspace uuid;
begin
  select workspace_id, client_id into content_workspace, content_client from public.contents where id = new.content_id;
  select workspace_id into role_workspace from public.contribution_roles where id = new.contribution_role_id and is_active;
  if content_workspace is null or content_workspace is distinct from role_workspace or not (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = content_workspace and wm.user_profile_id = new.user_profile_id and wm.status = 'active'
        and (
          exists (
            select 1 from public.workspace_member_roles wmr
            join public.roles r on r.id = wmr.role_id
            where wmr.workspace_member_id = wm.id and r.code = 'super_admin' and r.is_active
          )
          or exists (
            select 1 from public.client_members cm
            where cm.workspace_member_id = wm.id and cm.client_id = content_client and cm.status = 'active'
          )
        )
    )
    or exists (
      select 1
      from public.contents c
      join public.idea_contributors ic on ic.idea_id = c.source_idea_id
      where c.id = new.content_id
        and ic.user_profile_id = new.user_profile_id
        and ic.contribution_role_id = new.contribution_role_id
    )
  ) then
    raise exception 'Contributor must be authorized for the Content Client or retained from the source Idea';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_content_contributor_scope() from public, anon, authenticated;

create or replace function public.convert_idea_to_content(
  target_idea_id uuid,
  target_title text,
  target_working_title text,
  target_campaign_id uuid,
  target_objective text,
  target_owner_user_id uuid,
  target_internal_notes text,
  target_private_management_notes text,
  target_client_visible_notes text,
  target_tag_names text[]
)
returns table(content_id uuid, content_code text) language plpgsql security definer set search_path = '' as $$
declare
  source_idea public.ideas%rowtype;
  saved_content_id uuid;
  saved_content_code text;
  resolved_owner uuid;
  tag_name text;
  tag_id uuid;
  can_manage_private boolean;
begin
  select * into source_idea from public.ideas where id = target_idea_id for update;
  if source_idea.id is null then raise exception 'Idea not found'; end if;
  if not public.can_manage_content_client(source_idea.client_id) then raise exception 'Idea conversion access denied'; end if;
  can_manage_private := public.can_archive_content_client(source_idea.client_id);
  if not can_manage_private and nullif(btrim(target_private_management_notes), '') is not null then raise exception 'Private Management Notes access denied'; end if;
  if source_idea.status <> 'approved' then raise exception 'Only an Approved Idea can be converted'; end if;
  if exists (select 1 from public.contents where source_idea_id = target_idea_id) then raise exception 'Idea has already been converted'; end if;

  resolved_owner := target_owner_user_id;
  if resolved_owner is null and source_idea.owner_user_id is not null and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = source_idea.workspace_id and wm.user_profile_id = source_idea.owner_user_id and wm.status = 'active'
      and (
        exists (
          select 1 from public.workspace_member_roles wmr
          join public.roles r on r.id = wmr.role_id
          where wmr.workspace_member_id = wm.id and r.code = 'super_admin' and r.is_active
        )
        or exists (
          select 1 from public.client_members cm
          where cm.workspace_member_id = wm.id and cm.client_id = source_idea.client_id and cm.status = 'active'
        )
      )
  ) then
    resolved_owner := source_idea.owner_user_id;
  end if;
  resolved_owner := coalesce(resolved_owner, auth.uid());

  insert into public.contents(
    workspace_id, client_id, source_idea_id, content_code, title, working_title, category_id, campaign_id,
    objective, priority, current_owner_user_id, internal_notes, private_management_notes, client_visible_notes, created_by
  ) values (
    source_idea.workspace_id, source_idea.client_id, source_idea.id,
    public.next_content_code(source_idea.workspace_id, source_idea.client_id),
    coalesce(nullif(btrim(target_title), ''), source_idea.title),
    coalesce(nullif(btrim(target_working_title), ''), source_idea.title),
    source_idea.category_id, target_campaign_id,
    coalesce(nullif(btrim(target_objective), ''), source_idea.our_angle), source_idea.priority,
    resolved_owner,
    nullif(btrim(target_internal_notes), ''), case when can_manage_private then nullif(btrim(target_private_management_notes), '') else null end,
    nullif(btrim(target_client_visible_notes), ''), auth.uid()
  ) returning id, contents.content_code into saved_content_id, saved_content_code;

  insert into public.content_tags(content_id, tag_id)
  select saved_content_id, it.tag_id from public.idea_tags it where it.idea_id = source_idea.id
  on conflict do nothing;

  foreach tag_name in array coalesce(target_tag_names, '{}'::text[]) loop
    if btrim(tag_name) <> '' then
      select id into tag_id from public.tags
      where workspace_id = source_idea.workspace_id and client_id is not distinct from source_idea.client_id
        and lower(btrim(name)) = lower(btrim(tag_name)) limit 1;
      if tag_id is null then
        insert into public.tags(workspace_id, client_id, name)
        values(source_idea.workspace_id, source_idea.client_id, btrim(tag_name)) on conflict do nothing returning id into tag_id;
      end if;
      if tag_id is null then
        select id into tag_id from public.tags
        where workspace_id = source_idea.workspace_id and client_id is not distinct from source_idea.client_id
          and lower(btrim(name)) = lower(btrim(tag_name)) limit 1;
      end if;
      insert into public.content_tags(content_id, tag_id) values(saved_content_id, tag_id) on conflict do nothing;
    end if;
  end loop;

  insert into public.content_contributors(content_id, user_profile_id, contribution_role_id, notes, added_by)
  select saved_content_id, ic.user_profile_id, ic.contribution_role_id,
    coalesce(ic.notes, 'Preserved from source Idea'), auth.uid()
  from public.idea_contributors ic
  join public.contribution_roles cr on cr.id = ic.contribution_role_id
  where ic.idea_id = source_idea.id and cr.code = 'idea_creator'
  on conflict do nothing;

  update public.ideas
  set status = 'converted', status_reason = 'Converted to ' || saved_content_code, archived_at = null
  where id = source_idea.id;

  return query select saved_content_id, saved_content_code;
end;
$$;

revoke all on function public.convert_idea_to_content(uuid,text,text,uuid,text,uuid,text,text,text,text[]) from public, anon;
grant execute on function public.convert_idea_to_content(uuid,text,text,uuid,text,uuid,text,text,text,text[]) to authenticated;
