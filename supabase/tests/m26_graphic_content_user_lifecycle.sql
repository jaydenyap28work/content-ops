-- M26 schema/security verification (run against the linked work project).
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='ideas' and column_name='content_type') then raise exception 'ideas.content_type missing';end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='graphic_content_packs') then raise exception 'Graphic Pack missing';end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='customer_case_profiles') then raise exception 'Customer Case profile missing';end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('graphic_content_packs','customer_case_profiles','content_attribution_events','user_lifecycle_audits') and c.relrowsecurity) then raise exception 'M26 RLS missing';end if;
 if has_function_privilege('anon','public.hard_delete_test_team_member(uuid,text)','EXECUTE') then raise exception 'anon must not execute hard delete';end if;
 if not exists(select 1 from public.contribution_roles where code='copywriter') or not exists(select 1 from public.contribution_roles where code='designer') then raise exception 'Graphic roles missing';end if;
end $$;