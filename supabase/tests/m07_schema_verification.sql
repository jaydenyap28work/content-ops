with expected_tables(table_name) as (
  values ('script_versions'),('media_versions'),('content_approval_requirements'),('approvals'),('revision_requests')
), checks as (
  select e.table_name, c.oid is not null as exists, coalesce(c.relrowsecurity,false) as rls_enabled,
    (select count(*) from pg_constraint fk where fk.conrelid=c.oid and fk.contype='f') as foreign_keys,
    (select count(*) from pg_index ix where ix.indrelid=c.oid) as indexes
  from expected_tables e left join pg_class c on c.relname=e.table_name and c.relnamespace='public'::regnamespace
)
select jsonb_build_object(
  'tables',(select jsonb_agg(to_jsonb(checks) order by table_name) from checks),
  'all_tables_exist',(select bool_and(exists) from checks),
  'all_rls_enabled',(select bool_and(rls_enabled) from checks),
  'current_script_pointer',exists(select 1 from information_schema.columns where table_schema='public' and table_name='contents' and column_name='current_script_version_id'),
  'workflow_links',(select count(*)=4 from information_schema.columns where table_schema='public' and table_name='workflow_events' and column_name in ('script_version_id','media_version_id','revision_request_id','approval_id')),
  'immutability_triggers',(select count(*)=3 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and t.tgname in ('script_versions_immutable','media_versions_immutable','approvals_immutable')),
  'authenticated_rpc',has_function_privilege('authenticated','public.submit_first_cut(uuid,text,text,text,text,text)','execute'),
  'anon_rpc',has_function_privilege('anon','public.submit_first_cut(uuid,text,text,text,text,text)','execute'),
  'test_residue',jsonb_build_object(
    'scripts',(select count(*) from public.script_versions sv join public.contents c on c.id=sv.content_id where c.title like 'Phase 7%'),
    'media',(select count(*) from public.media_versions mv join public.contents c on c.id=mv.content_id where c.title like 'Phase 7%'),
    'revisions',(select count(*) from public.revision_requests rr join public.contents c on c.id=rr.content_id where c.title like 'Phase 7%'),
    'approvals',(select count(*) from public.approvals a join public.contents c on c.id=a.content_id where c.title like 'Phase 7%')
  )
) as verification;
