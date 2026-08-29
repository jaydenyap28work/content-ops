-- M27 follow-up: Idea Provider options reuse the canonical Active Team Member datasource.
create or replace function public.list_idea_provider_options(target_client_id uuid)
returns table(team_member_id uuid,display_name text,is_current_user boolean)
language sql stable security definer set search_path='' as $$
  with client_scope as (
    select c.id,c.workspace_id from public.clients c where c.id=target_client_id and c.status='active'
  ), options as (
    select active_member.id team_member_id,active_member.name display_name,
      active_member.auth_user_id=(select auth.uid()) is_current_user
    from client_scope c
    cross join lateral public.list_active_team_members(c.workspace_id,c.id) active_member
    where public.can_manage_research_client(c.id)
    union all
    select tm.id,tm.name,true
    from client_scope c join public.team_members tm on tm.workspace_id=c.workspace_id
    where not public.can_manage_research_client(c.id)
      and public.has_workspace_role(c.workspace_id,'idea_contributor')
      and tm.auth_user_id=(select auth.uid()) and tm.status='active'
  )
  select options.team_member_id,options.display_name,options.is_current_user
  from options order by options.is_current_user desc,options.display_name;
$$;
revoke all on function public.list_idea_provider_options(uuid) from public,anon;
grant execute on function public.list_idea_provider_options(uuid) to authenticated;
notify pgrst,'reload schema';
