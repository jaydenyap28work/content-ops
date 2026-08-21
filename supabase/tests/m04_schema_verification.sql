with expected_tables(table_name) as (
  values
    ('content_categories'), ('tags'), ('platforms'), ('contribution_roles'),
    ('references'), ('reference_clients'), ('reference_tags'), ('ideas'),
    ('idea_references'), ('idea_contributors'), ('idea_tags')
), table_checks as (
  select
    expected_tables.table_name,
    c.oid is not null as exists,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    (
      select count(*)::integer
      from pg_constraint fk
      where fk.conrelid = c.oid and fk.contype = 'f'
    ) as foreign_key_count,
    (
      select count(*)::integer
      from pg_index ix
      where ix.indrelid = c.oid
    ) as index_count
  from expected_tables
  left join pg_class c
    on c.relname = expected_tables.table_name
   and c.relnamespace = 'public'::regnamespace
)
select jsonb_build_object(
  'tables', (select jsonb_agg(to_jsonb(table_checks) order by table_name) from table_checks),
  'all_tables_exist', (select bool_and(exists) from table_checks),
  'all_rls_enabled', (select bool_and(rls_enabled) from table_checks),
  'classification_seed', jsonb_build_object(
    'categories', (select count(*) from public.content_categories),
    'platforms', (select count(*) from public.platforms),
    'contribution_roles', (select count(*) from public.contribution_roles)
  ),
  'test_residue', jsonb_build_object(
    'clients', (select count(*) from public.clients where code like 'PHASE4-%'),
    'references', (select count(*) from public.references where title like 'Phase 4%'),
    'ideas', (select count(*) from public.ideas where title like 'Phase 4%')
  ),
  'rpc_acl', jsonb_build_object(
    'authenticated_save_reference', has_function_privilege(
      'authenticated',
      'public.save_reference(uuid,uuid,uuid,text,text,text,uuid,text,text,text,text,text,text,text,boolean,uuid[],text[])',
      'execute'
    ),
    'anon_save_reference', has_function_privilege(
      'anon',
      'public.save_reference(uuid,uuid,uuid,text,text,text,uuid,text,text,text,text,text,text,text,boolean,uuid[],text[])',
      'execute'
    ),
    'authenticated_save_idea', has_function_privilege(
      'authenticated',
      'public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb)',
      'execute'
    ),
    'anon_save_idea', has_function_privilege(
      'anon',
      'public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb)',
      'execute'
    )
  )
) as verification;
