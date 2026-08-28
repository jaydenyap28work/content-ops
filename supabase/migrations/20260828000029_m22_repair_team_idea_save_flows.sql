-- M22: repair Team Member and Quick Idea save contracts without changing workflow data.

-- Keep the existing 3-argument RPC for older clients. The production UI uses this
-- explicit 4-argument overload so Email can remain optional and NULL.
create or replace function public.create_team_member(
  target_workspace_id uuid,
  target_name text,
  target_job_title text,
  target_email text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  saved uuid;
  clean_name text:=btrim(target_name);
  clean_title text:=nullif(btrim(target_job_title),'');
  clean_email text:=nullif(lower(btrim(target_email)),'');
begin
  if not public.is_workspace_super_admin(target_workspace_id) then raise exception 'Only Super Admin can create Team Members'; end if;
  if nullif(clean_name,'') is null then raise exception 'Team Member name is required'; end if;
  if clean_email is not null and clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Valid Email is required'; end if;

  select id into saved from public.team_members
    where workspace_id=target_workspace_id and lower(btrim(name))=lower(clean_name) for update;
  if saved is not null then
    update public.team_members set status='active',job_title=coalesce(clean_title,job_title),email=coalesce(email,clean_email)
      where id=saved;
    return saved;
  end if;

  insert into public.team_members(workspace_id,name,job_title,email,auth_user_id,login_status,status,created_by)
  values(target_workspace_id,clean_name,clean_title,clean_email,null,'not_enabled','active',auth.uid())
  returning id into saved;
  return saved;
end; $$;
revoke all on function public.create_team_member(uuid,text,text,text) from public,anon;
grant execute on function public.create_team_member(uuid,text,text,text) to authenticated;

-- Recreate the current M21 overload with explicit optional normalization.
-- Database priority remains stable at Normal when the optional UI field is blank.
create or replace function public.save_idea(
  target_idea_id uuid,target_workspace_id uuid,target_client_id uuid,target_title text,target_source_url text,
  target_original_topic text,target_original_hook text,target_why_it_works text,target_our_angle text,target_category_id uuid,
  target_suggested_format text,target_priority text,target_owner_user_id uuid,target_notes text,target_reference_ids uuid[],
  target_tag_names text[],target_contributors jsonb,target_planned_date date,target_source_platform text,
  target_raw_content text,target_content_format text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  saved uuid;
  clean_title text:=btrim(target_title);
  normalized_format text:=nullif(lower(btrim(target_content_format)),'');
  normalized_priority text:=coalesce(nullif(lower(btrim(target_priority)),''),'normal');
begin
  if nullif(clean_title,'') is null then raise exception 'Idea title is required'; end if;
  if normalized_format is not null and normalized_format not in ('q_and_a','talking_head','skit','product_demo','podcast','voice_over','event') then
    raise exception 'Unsupported Content format';
  end if;
  if normalized_priority not in ('low','normal','high','urgent') then raise exception 'Unsupported Idea priority'; end if;

  saved:=public.save_idea(target_idea_id,target_workspace_id,target_client_id,clean_title,target_source_url,target_original_topic,
    target_original_hook,target_why_it_works,target_our_angle,target_category_id,target_suggested_format,normalized_priority,
    target_owner_user_id,target_notes,target_reference_ids,target_tag_names,target_contributors,target_planned_date,target_source_platform);
  update public.ideas set raw_content=nullif(btrim(target_raw_content),''),content_format=normalized_format where id=saved;
  return saved;
end; $$;
revoke all on function public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text,text,text) from public,anon;
grant execute on function public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text,text,text) to authenticated;

notify pgrst,'reload schema';
