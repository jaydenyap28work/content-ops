do $$
begin
  if to_regclass('public.access_requests') is null then raise exception 'access_requests missing'; end if;
  if to_regclass('public.access_request_audits') is null then raise exception 'access_request_audits missing'; end if;
  if not (select relrowsecurity from pg_class where oid='public.access_requests'::regclass) then raise exception 'access_requests RLS disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='public.access_request_audits'::regclass) then raise exception 'access_request_audits RLS disabled'; end if;
  if not exists(select 1 from pg_proc where proname='ensure_my_access_request') then raise exception 'ensure_my_access_request missing'; end if;
  if not exists(select 1 from pg_proc where proname='review_access_request') then raise exception 'review_access_request missing'; end if;
  if has_table_privilege('anon','public.access_requests','SELECT') then raise exception 'anon can read access_requests'; end if;
  if has_function_privilege('anon','public.ensure_my_access_request(uuid)','EXECUTE') then raise exception 'anon can submit Access Requests'; end if;
  if has_function_privilege('anon','public.review_access_request(uuid,text,text,uuid,boolean,text)','EXECUTE') then raise exception 'anon can review Access Requests'; end if;
end $$;
