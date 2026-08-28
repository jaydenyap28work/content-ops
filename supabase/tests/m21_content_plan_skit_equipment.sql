-- Read-only M21 schema, security, and LKSoft pilot preservation verification.
with pilot_titles(title) as (values
 ('最近很多商家开始倒闭了，你怎样看？'),
 ('做过这么多家企业的系统，最喜欢怎样的顾客？什么样的顾客最难合作？'),
 ('不是已经有 SST 了吗？为什么安华又提 GST？'),
 ('你觉得一个企业里面，什么部门最重要？'),
 ('为什么公司名字叫 LKSOFT？'),
 ('你觉得怎样的企业或老板，会有很好的发展？'),
 ('很多人讲00后很难融入企业文化，你怎样看？')
), pilot as (
 select i.id idea_id,c.id content_id,c.content_code,c.current_status,c.planned_shoot_date,
   b.pack_segments,(c.source_idea_id=i.id) as has_provenance
 from pilot_titles p join public.ideas i on i.title=p.title
 join public.contents c on c.source_idea_id=i.id
 join public.idea_shooting_briefs b on b.idea_id=i.id
), segment_checks as (
 select p.idea_id,count(*)::integer segment_count,
   count(*) filter(where coalesce(btrim(segment->>'referenceScript'),'')<>'')::integer reference_script_count
 from pilot p cross join lateral jsonb_array_elements(p.pack_segments) segment group by p.idea_id
)
select jsonb_build_object(
 'idea_columns',(select jsonb_agg(column_name order by column_name) from information_schema.columns
   where table_schema='public' and table_name='ideas' and column_name in ('raw_content','content_format')),
 'content_source_raw_content',(select count(*)=1 from information_schema.columns
   where table_schema='public' and table_name='contents' and column_name='source_raw_content'),
 'equipment_table',to_regclass('public.equipment_proposals') is not null,
 'equipment_rls',coalesce((select relrowsecurity from pg_class where oid='public.equipment_proposals'::regclass),false),
 'anon_equipment_read_denied',not has_table_privilege('anon','public.equipment_proposals','select'),
 'rpcs',jsonb_build_object(
   'save_idea_v2',to_regprocedure('public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date,text,text,text)') is not null,
   'confirm_v2',to_regprocedure('public.confirm_idea_for_production_v2(uuid,jsonb)') is not null,
   'list_equipment',to_regprocedure('public.list_equipment_proposals(uuid)') is not null,
   'save_equipment',to_regprocedure('public.save_equipment_proposal(uuid,uuid,text,text,text,text[],text,numeric,text,date,text[],text)') is not null,
   'decide_equipment',to_regprocedure('public.decide_equipment_proposal(uuid,text,text)') is not null
 ),
 'anon_confirm_denied',not has_function_privilege('anon','public.confirm_idea_for_production_v2(uuid,jsonb)','execute'),
 'pilot_count',(select count(*) from pilot),
 'unique_content_count',(select count(distinct content_id) from pilot),
 'unique_code_count',(select count(distinct content_code) from pilot),
 'planned_shoot_dates',(select jsonb_agg(planned_shoot_date order by planned_shoot_date) from pilot),
 'workflow_preserved',(select bool_and(current_status is not null) from pilot),
 'briefs_preserved',(select bool_and(jsonb_array_length(pack_segments)>0) from pilot),
 'provenance_preserved',(select bool_and(has_provenance) from pilot),
 'reference_scripts',(select jsonb_build_object('segments',sum(segment_count),'scripts',sum(reference_script_count)) from segment_checks)
) as verification;
