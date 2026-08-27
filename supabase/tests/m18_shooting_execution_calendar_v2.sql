-- Read-only M18 schema and security verification. Run only after M18 is applied.
with expected_tables(table_name) as (
  values ('shoot_scenes'), ('marketing_calendar_events')
), table_checks as (
  select expected_tables.table_name, c.oid is not null as exists,
    coalesce(c.relrowsecurity,false) as rls_enabled,
    (select count(*)::integer from pg_constraint fk where fk.conrelid=c.oid and fk.contype='f') as foreign_key_count,
    (select count(*)::integer from pg_index ix where ix.indrelid=c.oid) as index_count
  from expected_tables
  left join pg_class c on c.relname=expected_tables.table_name and c.relnamespace='public'::regnamespace
), brief_columns as (
  select column_name from information_schema.columns
  where table_schema='public' and table_name='idea_shooting_briefs'
    and column_name in ('shooting_format','pack_segments','recommended_scene_id','confirmed_scene_id','backup_scene_id')
), functions as (
  select
    to_regprocedure('public.save_shoot_scene(uuid,uuid,text,text[],text,text[],text[],text,text,text,text,text,boolean,text)') is not null as save_scene,
    to_regprocedure('public.save_shooting_pack(uuid,text,jsonb,uuid,uuid,uuid)') is not null as save_pack,
    to_regprocedure('public.mark_shooting_pack_segment(uuid,text,boolean)') is not null as mark_segment,
    to_regprocedure('public.save_marketing_calendar_event(uuid,uuid,uuid,text,text,timestamptz,timestamptz,boolean,text,text,text)') is not null as save_calendar,
    to_regprocedure('public.list_calendar_events(uuid,date,date)') is not null as list_calendar
)
select jsonb_build_object(
  'tables', (select jsonb_agg(to_jsonb(table_checks) order by table_name) from table_checks),
  'all_tables_exist', (select bool_and(exists) from table_checks),
  'all_rls_enabled', (select bool_and(rls_enabled) from table_checks),
  'shooting_brief_columns', (select jsonb_agg(column_name order by column_name) from brief_columns),
  'all_shooting_brief_columns_exist', (select count(*)=5 from brief_columns),
  'functions', (select to_jsonb(functions) from functions),
  'authenticated_rpc_access', jsonb_build_object(
    'save_scene', has_function_privilege('authenticated','public.save_shoot_scene(uuid,uuid,text,text[],text,text[],text[],text,text,text,text,text,boolean,text)','execute'),
    'save_pack', has_function_privilege('authenticated','public.save_shooting_pack(uuid,text,jsonb,uuid,uuid,uuid)','execute'),
    'mark_segment', has_function_privilege('authenticated','public.mark_shooting_pack_segment(uuid,text,boolean)','execute'),
    'save_calendar', has_function_privilege('authenticated','public.save_marketing_calendar_event(uuid,uuid,uuid,text,text,timestamptz,timestamptz,boolean,text,text,text)','execute')
  ),
  'anon_rpc_denied', jsonb_build_object(
    'save_scene', not has_function_privilege('anon','public.save_shoot_scene(uuid,uuid,text,text[],text,text[],text[],text,text,text,text,text,boolean,text)','execute'),
    'save_pack', not has_function_privilege('anon','public.save_shooting_pack(uuid,text,jsonb,uuid,uuid,uuid)','execute'),
    'save_calendar', not has_function_privilege('anon','public.save_marketing_calendar_event(uuid,uuid,uuid,text,text,timestamptz,timestamptz,boolean,text,text,text)','execute')
  )
) as verification;
