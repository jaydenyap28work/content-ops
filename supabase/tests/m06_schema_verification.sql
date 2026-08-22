with expected_tables(table_name) as (
  values ('workflow_events'), ('activity_logs')
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
  'production_columns', (
    select count(*) = 4 from information_schema.columns
    where table_schema = 'public' and table_name = 'contents'
      and column_name in ('shoot_scheduled_at', 'shooting_started_at', 'shooting_completed_at', 'editing_started_at')
  ),
  'contributor_lifecycle_columns', (
    select count(*) = 3 from information_schema.columns
    where table_schema = 'public' and table_name = 'content_contributors'
      and column_name in ('status', 'removed_at', 'removed_by')
  ),
  'immutability_triggers', (
    select count(*) = 2 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
      and t.tgname in ('workflow_events_immutable', 'activity_logs_immutable')
  ),
  'status_guard_trigger', exists (
    select 1 from information_schema.triggers
    where trigger_schema = 'public' and trigger_name = 'contents_status_transition_guard'
  ),
  'rpc_acl', jsonb_build_object(
    'authenticated_workflow_action', has_function_privilege('authenticated', 'public.perform_content_workflow_action(uuid,text,text,text)', 'execute'),
    'anon_workflow_action', has_function_privilege('anon', 'public.perform_content_workflow_action(uuid,text,text,text)', 'execute'),
    'authenticated_assign_contributor', has_function_privilege('authenticated', 'public.assign_content_contributor(uuid,uuid,uuid,text)', 'execute'),
    'anon_assign_contributor', has_function_privilege('anon', 'public.assign_content_contributor(uuid,uuid,uuid,text)', 'execute'),
    'authenticated_timeline', has_function_privilege('authenticated', 'public.list_workflow_events(uuid)', 'execute'),
    'anon_timeline', has_function_privilege('anon', 'public.list_workflow_events(uuid)', 'execute')
  ),
  'test_residue', jsonb_build_object(
    'clients', (select count(*) from public.clients where code like 'PHASE6-%'),
    'contents', (select count(*) from public.contents where title like 'Phase 6%'),
    'workflow_events', (select count(*) from public.workflow_events we join public.contents c on c.id = we.content_id where c.title like 'Phase 6%'),
    'activity_logs', (select count(*) from public.activity_logs al join public.contents c on c.id = al.content_id where c.title like 'Phase 6%')
  )
) as verification;
