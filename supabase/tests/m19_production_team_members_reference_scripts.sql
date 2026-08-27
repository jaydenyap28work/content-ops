-- Read-only M19 schema, security, and LKSoft pilot preservation verification.
with pilot_titles(title) as (values
 ('最近很多商家开始倒闭了，你怎样看？'),
 ('做过这么多家企业的系统，最喜欢怎样的顾客？什么样的顾客最难合作？'),
 ('不是已经有 SST 了吗？为什么安华又提 GST？'),
 ('你觉得一个企业里面，什么部门最重要？'),
 ('为什么公司名字叫 LKSOFT？'),
 ('你觉得怎样的企业或老板，会有很好的发展？'),
 ('很多人讲00后很难融入企业文化，你怎样看？')
), pilot as (
 select i.id idea_id,i.title,c.id converted_content_id,c.content_code,c.current_status,c.planned_shoot_date,
   b.pack_segments,
   (c.source_idea_id=i.id) as has_reference_provenance
 from pilot_titles p join public.ideas i on i.title=p.title
 join public.contents c on c.source_idea_id=i.id
 join public.idea_shooting_briefs b on b.idea_id=i.id
), script_checks as (
 select p.idea_id,count(*)::integer segment_count,
  count(*) filter(where coalesce(btrim(segment->>'referenceScript'),'')<>'' and segment->>'referenceScript' not like '可参考以下表达重点展开：%')::integer real_script_count
 from pilot p cross join lateral jsonb_array_elements(p.pack_segments) segment group by p.idea_id
)
select jsonb_build_object(
 'team_members_table',to_regclass('public.team_members') is not null,
 'team_members_rls',coalesce((select relrowsecurity from pg_class where oid='public.team_members'::regclass),false),
 'team_member_columns',(select jsonb_agg(column_name order by column_name) from information_schema.columns where table_schema='public' and table_name='team_members'),
 'production_roles',(select jsonb_agg(code order by sort_order) from public.contribution_roles where code in ('owner','talent','director','shooter','editor','reviewer','publisher')),
 'rpcs',jsonb_build_object(
   'list_team',to_regprocedure('public.list_team_members(uuid)') is not null,
   'create_team',to_regprocedure('public.create_team_member(uuid,text,text)') is not null,
   'assign_team',to_regprocedure('public.assign_content_team_member(uuid,uuid,text,text)') is not null,
   'bulk_assign',to_regprocedure('public.bulk_assign_content_team_member(uuid[],uuid,text)') is not null,
   'link_auth',to_regprocedure('public.link_invited_team_member(uuid,uuid,text)') is not null
 ),
 'pilot_count',(select count(*) from pilot),
 'unique_content_count',(select count(distinct converted_content_id) from pilot),
 'unique_code_count',(select count(distinct content_code) from pilot),
 'planned_shoot_dates',(select jsonb_agg(planned_shoot_date order by planned_shoot_date) from pilot),
 'briefs_preserved',(select bool_and(jsonb_array_length(pack_segments)>0) from pilot),
 'workflow_preserved',(select bool_and(current_status is not null) from pilot),
 'provenance_preserved',(select bool_and(has_reference_provenance) from pilot),
 'reference_scripts',(select jsonb_build_object('segments',sum(segment_count),'real_scripts',sum(real_script_count),'all_real',bool_and(segment_count=real_script_count)) from script_checks),
 'anon_team_read_denied',not has_table_privilege('anon','public.team_members','select'),
 'authenticated_rpc_access',has_function_privilege('authenticated','public.assign_content_team_member(uuid,uuid,text,text)','execute')
) as verification;