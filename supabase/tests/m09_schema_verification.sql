select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'ideas' and column_name = 'planned_date')
    or (table_name = 'contents' and column_name = 'planned_date'))
order by table_name;

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in ('ideas_client_planned_date_status_idx', 'contents_client_planned_date_status_idx')
order by indexname;

select proname, prosecdef
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('inherit_content_planned_date', 'list_idea_planner_context')
order by proname;
