with expected_tables(table_name) as (
  values ('campaigns'), ('contents'), ('content_tags'), ('content_contributors')
), table_checks as (
  select
    expected_tables.table_name,
    c.oid is not null as exists,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    (select count(*)::integer from pg_constraint fk where fk.conrelid = c.oid and fk.contype = 'f') as foreign_key_count,
    (select count(*)::integer from pg_index ix where ix.indrelid = c.oid) as index_count
  from expected_tables
  left join pg_class c on c.relname = expected_tables.table_name and c.relnamespace = 'public'::regnamespace
)
select jsonb_build_object(
  'tables', (select jsonb_agg(to_jsonb(table_checks) order by table_name) from table_checks),
  'all_tables_exist', (select bool_and(exists) from table_checks),
  'all_rls_enabled', (select bool_and(rls_enabled) from table_checks),
  'idea_conversion_unique_index', exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'contents' and indexname = 'contents_source_idea_once_idx'
  ),
  'rpc_acl', jsonb_build_object(
    'authenticated_list_contents', has_function_privilege('authenticated', 'public.list_contents(uuid,uuid)', 'execute'),
    'anon_list_contents', has_function_privilege('anon', 'public.list_contents(uuid,uuid)', 'execute'),
    'authenticated_save_content', has_function_privilege('authenticated', 'public.save_content(uuid,uuid,uuid,text,text,uuid,uuid,text,text,uuid,text,text,text,text,text[])', 'execute'),
    'anon_save_content', has_function_privilege('anon', 'public.save_content(uuid,uuid,uuid,text,text,uuid,uuid,text,text,uuid,text,text,text,text,text[])', 'execute'),
    'authenticated_convert_idea', has_function_privilege('authenticated', 'public.convert_idea_to_content(uuid,text,text,uuid,text,uuid,text,text,text,text[])', 'execute'),
    'anon_convert_idea', has_function_privilege('anon', 'public.convert_idea_to_content(uuid,text,text,uuid,text,uuid,text,text,text,text[])', 'execute')
  ),
  'test_residue', jsonb_build_object(
    'clients', (select count(*) from public.clients where code like 'PHASE5-%'),
    'campaigns', (select count(*) from public.campaigns where name like 'Phase 5%'),
    'contents', (select count(*) from public.contents where title like 'Phase 5%'),
    'ideas', (select count(*) from public.ideas where title like 'Phase 5%')
  )
) as verification;
