begin;

select 1 / case when exists(
  select 1 from information_schema.columns where table_schema='public' and table_name='contents' and column_name='planned_shoot_date' and data_type='date'
) then 1 else 0 end as contents_planned_shoot_date_is_date;

select 1 / case when exists(
  select 1 from information_schema.columns where table_schema='public' and table_name='ideas' and column_name='planned_shoot_date' and data_type='date'
) then 1 else 0 end as ideas_planned_shoot_date_is_date;

select 1 / case when (select count(*) from public.contents c join public.clients cl on cl.id=c.client_id
  where cl.ownership_type='internal_brand' and cl.is_default_brand and c.planned_shoot_date in
  ('2026-09-02','2026-09-04','2026-09-09','2026-09-11','2026-09-16','2026-09-18','2026-09-23') and c.planned_date is null)=7 then 1 else 0 end as seven_content_dates_correct;

select 1 / case when (select count(*) from public.ideas i join public.clients cl on cl.id=i.client_id
  where cl.ownership_type='internal_brand' and cl.is_default_brand and i.planned_shoot_date in
  ('2026-09-02','2026-09-04','2026-09-09','2026-09-11','2026-09-16','2026-09-18','2026-09-23') and i.planned_date is null)=7 then 1 else 0 end as seven_idea_dates_correct;

select 1 / case when (select count(*) from public.contents c join public.clients cl on cl.id=c.client_id
  where cl.ownership_type='internal_brand' and cl.is_default_brand and c.record_status='active')>=7 then 1 else 0 end as content_records_preserved;

select 1 / case when (select count(*) from public.idea_shooting_briefs b join public.ideas i on i.id=b.idea_id join public.clients cl on cl.id=i.client_id
  where cl.ownership_type='internal_brand' and cl.is_default_brand and cardinality(b.interview_questions)>=3)>=7 then 1 else 0 end as shooting_briefs_preserved;

select 1 / case when (select count(*) from public.social_accounts sa join public.clients cl on cl.id=sa.client_id join public.platforms p on p.id=sa.platform_id
  where cl.ownership_type='internal_brand' and cl.is_default_brand and p.code in ('facebook','instagram','youtube','tiktok') and sa.external_url is not null)=4 then 1 else 0 end as official_social_accounts_present;

select 1 / case when (select count(*) from public.social_accounts sa join public.clients cl on cl.id=sa.client_id join public.platforms p on p.id=sa.platform_id
  where cl.ownership_type='internal_brand' and cl.is_default_brand and p.code in ('xhs','threads','lemon8'))=0 then 1 else 0 end as uncertain_accounts_not_created;

rollback;