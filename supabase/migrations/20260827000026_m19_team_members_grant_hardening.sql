-- M19 hardening: keep Team Member roster unavailable to anon at the privilege layer.
revoke all on table public.team_members from anon;
revoke insert,update,delete,truncate,references,trigger on table public.team_members from authenticated;
grant select on table public.team_members to authenticated;