-- Supabase may add explicit API-role EXECUTE grants when public functions are
-- created. The RLS helpers are only needed by authenticated policies.

revoke execute on function public.is_active_workspace_member(uuid) from anon;
revoke execute on function public.is_own_active_workspace_member(uuid) from anon;
revoke execute on function public.is_workspace_super_admin(uuid) from anon;
