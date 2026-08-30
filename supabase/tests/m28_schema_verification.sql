-- Run after M28 against content-ops. Read-only except the explicit rollback probe.
do $$ begin
  if not exists(select 1 from pg_tables where schemaname='public' and tablename='editing_presets') then raise exception 'editing_presets missing'; end if;
  if not exists(select 1 from pg_tables where schemaname='public' and tablename='content_editing_presets') then raise exception 'content_editing_presets missing'; end if;
  if not exists(select 1 from pg_tables where schemaname='public' and tablename='notifications') then raise exception 'notifications missing'; end if;
  if not exists(select 1 from pg_tables where schemaname='public' and tablename='notification_preferences') then raise exception 'notification_preferences missing'; end if;
  if (select count(*) from public.editing_presets where name in ('基本字幕','效果字幕','口播开场','资讯插入 / 人物缩小展示资讯'))<>4 then raise exception 'LKSoft preset seed mismatch'; end if;
  if not exists(select 1 from pg_trigger where tgname='content_editing_presets_immutable' and tgenabled<>'D') then raise exception 'snapshot immutability missing'; end if;
  if not exists(select 1 from pg_trigger where tgname='workflow_events_notify' and tgenabled<>'D') then raise exception 'workflow notification dispatch missing'; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename in ('editing_presets','content_editing_presets','notifications','notification_preferences') and roles::text like '%anon%') then raise exception 'anon policy detected'; end if;
end $$;

begin;
do $$ declare preset_id uuid; begin
  select id into preset_id from public.editing_presets limit 1;
  if preset_id is null then raise exception 'preset rollback probe unavailable'; end if;
end $$;
rollback;
