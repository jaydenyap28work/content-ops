with expected(table_name) as(values('social_accounts'),('publications'),('analytics_snapshots')), checks as(
  select e.table_name,c.oid is not null exists,coalesce(c.relrowsecurity,false) rls_enabled,
    (select count(*) from pg_constraint k where k.conrelid=c.oid and k.contype='f') foreign_keys,
    (select count(*) from pg_index i where i.indrelid=c.oid) indexes
  from expected e left join pg_class c on c.relname=e.table_name and c.relnamespace='public'::regnamespace)
select jsonb_build_object(
  'tables',(select jsonb_agg(to_jsonb(checks) order by table_name) from checks),
  'all_tables_exist',(select bool_and(exists) from checks),'all_rls_enabled',(select bool_and(rls_enabled) from checks),
  'snapshot_immutable',exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname='analytics_snapshots' and t.tgname='analytics_snapshots_immutable' and not t.tgisinternal),
  'workflow_publication_link',exists(select 1 from information_schema.columns where table_schema='public' and table_name='workflow_events' and column_name='publication_id'),
  'anon_publish_rpc',has_function_privilege('anon','public.mark_publication_published(uuid,text,timestamptz,text,text)','execute'),
  'authenticated_publish_rpc',has_function_privilege('authenticated','public.mark_publication_published(uuid,text,timestamptz,text,text)','execute'),
  'residue',jsonb_build_object(
    'clients',(select count(*) from public.clients where code like 'PHASE8-%'),
    'publications',(select count(*) from public.publications p join public.contents c on c.id=p.content_id where c.title like 'Phase 8%'),
    'snapshots',(select count(*) from public.analytics_snapshots a join public.publications p on p.id=a.publication_id join public.contents c on c.id=p.content_id where c.title like 'Phase 8%'))
) verification;
