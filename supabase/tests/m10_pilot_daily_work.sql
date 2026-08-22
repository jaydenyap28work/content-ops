begin;
do $$
declare actor uuid; workspace uuid; client uuid; category uuid; creator_before uuid; first_idea uuid; second_idea uuid; linked uuid; events integer;
begin
  select up.id into actor from public.user_profiles up where lower(up.email)='jaydenyap28work@gmail.com';
  select wm.workspace_id into workspace from public.workspace_members wm where wm.user_profile_id=actor and wm.status='active' limit 1;
  insert into public.clients(workspace_id,code,name,status) values(workspace,'M10-ROLLBACK','M10 rollback client','active') returning id into client;
  select cc.id into category from public.content_categories cc where cc.workspace_id=workspace and cc.is_active order by cc.sort_order limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true); perform set_config('request.jwt.claim.role','authenticated',true); set local role authenticated;
  first_idea:=public.save_idea(null,workspace,client,'M10 first','','','','','',null,'','normal',actor,'','{}','{}','[]','2026-09-05');
  second_idea:=public.save_idea(null,workspace,client,'M10 second','','','','','',null,'','normal',actor,'','{}','{}','[]','2026-09-06');
  select created_by into creator_before from public.ideas where id=first_idea;
  perform public.change_idea_status(first_idea,'evaluating',null); perform public.change_idea_status(first_idea,'new',null);
  perform public.change_idea_status(first_idea,'evaluating',null); perform public.change_idea_status(first_idea,'approved',null); perform public.change_idea_status(first_idea,'evaluating',null);
  perform public.bulk_update_ideas(array[first_idea,second_idea],'owner',array[actor::text]);
  perform public.bulk_update_ideas(array[first_idea,second_idea],'planned_date',array['2026-09-20']);
  perform public.bulk_update_ideas(array[first_idea,second_idea],'priority',array['high']);
  perform public.bulk_update_ideas(array[first_idea,second_idea],'category',array[category::text]);
  perform public.bulk_update_ideas(array[first_idea,second_idea],'tags',array['Pilot','Boss IP']);
  if exists(select 1 from public.ideas where id in(first_idea,second_idea) and (owner_user_id<>actor or planned_date<>'2026-09-20' or priority<>'high' or category_id<>category)) then raise exception 'Bulk edit failed'; end if;
  if (select created_by from public.ideas where id=first_idea)<>creator_before then raise exception 'Creator changed'; end if;
  perform public.change_idea_status(first_idea,'approved',null);
  perform public.save_idea_shooting_brief(first_idea,'Timely',array['Question 1','Question 2'],array['Direction 1'],'CTA','60 sec','Steven','2026-09-21','Office',null);
  select content_id into linked from public.convert_idea_to_content(first_idea,'','',null,'',actor,'','','','{}');
  begin perform public.change_idea_status(first_idea,'evaluating',null); raise exception 'Converted rollback was accepted'; exception when others then if sqlerrm='Converted rollback was accepted' then raise; end if; end;
  select count(*) into events from public.list_calendar_events(workspace,'2026-09-01','2026-09-30') e where e.entity_id=linked and e.event_type='PLAN';
  if events<>1 then raise exception 'Converted Plan dedupe failed'; end if;
end $$;
rollback;
