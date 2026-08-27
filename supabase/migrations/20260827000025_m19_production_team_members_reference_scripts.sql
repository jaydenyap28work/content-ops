-- M19: Auth-optional Team Members, production team roles, and safe LKSoft reference-script completion.
-- Existing Content, Ideas, codes, workflow, dates, scenes, briefs, and provenance are preserved.

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null check(btrim(name)<>''),
  job_title text,
  email text,
  auth_user_id uuid unique references public.user_profiles(id) on delete restrict,
  login_status text not null default 'not_enabled' check(login_status in ('not_enabled','invited','enabled')),
  status text not null default 'active' check(status in ('active','inactive')),
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_members_workspace_name_key unique(workspace_id,name),
  constraint team_members_login_state_check check(
    (login_status='not_enabled' and auth_user_id is null)
    or (login_status='invited' and email is not null)
    or (login_status='enabled' and email is not null and auth_user_id is not null)
  )
);
create index team_members_workspace_status_idx on public.team_members(workspace_id,status,name);
create unique index team_members_workspace_email_key on public.team_members(workspace_id,lower(email)) where email is not null;
create trigger team_members_set_updated_at before update on public.team_members for each row execute function public.set_updated_at();
alter table public.team_members enable row level security;
create policy "Internal members can view Team Members" on public.team_members for select to authenticated using(public.is_internal_workspace_member(workspace_id));
revoke insert,update,delete on public.team_members from anon,authenticated;

insert into public.team_members(workspace_id,name,job_title,email,auth_user_id,login_status,status,created_by)
select wm.workspace_id,up.display_name,up.job_title,lower(up.email),up.id,'enabled',
  case when wm.status='active' then 'active' else 'inactive' end,up.id
from public.workspace_members wm join public.user_profiles up on up.id=wm.user_profile_id
on conflict(workspace_id,name) do update set auth_user_id=excluded.auth_user_id,email=excluded.email,
  job_title=coalesce(public.team_members.job_title,excluded.job_title),login_status='enabled';

insert into public.team_members(workspace_id,name,login_status,status,created_by)
select w.id,'Steven','not_enabled','active',
  (select wm.user_profile_id from public.workspace_members wm join public.workspace_member_roles wmr on wmr.workspace_member_id=wm.id
   join public.roles r on r.id=wmr.role_id where wm.workspace_id=w.id and wm.status='active' and r.code='super_admin' limit 1)
from public.workspaces w where w.name='ContentOS'
on conflict(workspace_id,name) do nothing;

insert into public.contribution_roles(workspace_id,code,name,description,sort_order)
select id,'owner','Content Owner','Owns the Content from planning through publishing',15 from public.workspaces
on conflict(workspace_id,code) do update set name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,is_active=true;
insert into public.contribution_roles(workspace_id,code,name,description,sort_order)
select id,'director','Director','Directs questions, pacing, scenes, B-roll, and on-set execution',35 from public.workspaces
on conflict(workspace_id,code) do update set name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,is_active=true;
update public.contribution_roles set name=case code when 'talent' then 'Talent' when 'shooter' then 'Shooter' when 'editor' then 'Editor' when 'reviewer' then 'Reviewer' when 'publisher' then 'Publisher' else name end
where code in ('talent','shooter','editor','reviewer','publisher');

alter table public.contents add column owner_team_member_id uuid references public.team_members(id) on delete restrict;
update public.contents c set owner_team_member_id=tm.id from public.team_members tm
where tm.workspace_id=c.workspace_id and tm.auth_user_id=c.current_owner_user_id and c.owner_team_member_id is null;
create index contents_owner_team_member_idx on public.contents(owner_team_member_id,current_status);

alter table public.content_contributors add column team_member_id uuid references public.team_members(id) on delete restrict;
update public.content_contributors cc set team_member_id=tm.id
from public.contents c join public.team_members tm on tm.workspace_id=c.workspace_id
where c.id=cc.content_id and tm.auth_user_id=cc.user_profile_id and cc.team_member_id is null;
alter table public.content_contributors alter column user_profile_id drop not null;
alter table public.content_contributors drop constraint content_contributors_unique_fact;
alter table public.content_contributors add constraint content_contributors_team_role_key unique(content_id,team_member_id,contribution_role_id);
alter table public.content_contributors add constraint content_contributors_identity_check check(team_member_id is not null);
create index content_contributors_team_role_idx on public.content_contributors(team_member_id,contribution_role_id,content_id);
insert into public.content_contributors(content_id,user_profile_id,team_member_id,contribution_role_id,notes,added_by)
select c.id,tm.auth_user_id,tm.id,cr.id,null,c.created_by
from public.contents c join public.team_members tm on tm.id=c.owner_team_member_id
join public.contribution_roles cr on cr.workspace_id=c.workspace_id and cr.code='owner' and cr.is_active
where c.owner_team_member_id is not null
on conflict(content_id,team_member_id,contribution_role_id) do nothing;

create or replace function public.enforce_content_contributor_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare content_workspace uuid; role_workspace uuid; member_workspace uuid; linked_user uuid;
begin
  select workspace_id into content_workspace from public.contents where id=new.content_id;
  select workspace_id into role_workspace from public.contribution_roles where id=new.contribution_role_id and is_active;
  select workspace_id,auth_user_id into member_workspace,linked_user from public.team_members where id=new.team_member_id and status='active';
  if content_workspace is null or content_workspace is distinct from role_workspace or content_workspace is distinct from member_workspace then
    raise exception 'Team Member and role must belong to the Content Workspace';
  end if;
  if new.user_profile_id is distinct from linked_user then raise exception 'Assignment Auth link does not match Team Member'; end if;
  return new;
end; $$;

create or replace function public.list_production_team_members(target_workspace_id uuid,target_client_id uuid)
returns table(id uuid,name text,job_title text,email text,auth_user_id uuid,login_status text,status text)
language sql stable security definer set search_path='' as $$
  select tm.id,tm.name,tm.job_title,tm.email,tm.auth_user_id,tm.login_status,tm.status
  from public.team_members tm
  where tm.workspace_id=target_workspace_id and tm.status='active'
    and public.is_internal_workspace_member(target_workspace_id)
    and exists(select 1 from public.clients c where c.id=target_client_id and c.workspace_id=target_workspace_id)
  order by tm.name;
$$;

create or replace function public.list_team_members(target_workspace_id uuid)
returns table(id uuid,name text,job_title text,email text,auth_user_id uuid,login_status text,status text,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select tm.id,tm.name,tm.job_title,tm.email,tm.auth_user_id,tm.login_status,tm.status,tm.created_at,tm.updated_at
  from public.team_members tm
  where tm.workspace_id=target_workspace_id and public.is_workspace_super_admin(target_workspace_id)
  order by (tm.status='active') desc,tm.name;
$$;

create or replace function public.create_team_member(target_workspace_id uuid,target_name text,target_job_title text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid;
begin
  if not public.is_workspace_super_admin(target_workspace_id) then raise exception 'Only Super Admin can create Team Members'; end if;
  if nullif(btrim(target_name),'') is null then raise exception 'Team Member name is required'; end if;
  insert into public.team_members(workspace_id,name,job_title,created_by)
  values(target_workspace_id,btrim(target_name),nullif(btrim(target_job_title),''),auth.uid())
  returning id into saved;
  return saved;
end; $$;

create or replace function public.update_team_member(target_team_member_id uuid,target_name text,target_job_title text,target_active boolean)
returns void language plpgsql security definer set search_path='' as $$
declare scope uuid;
begin
  select workspace_id into scope from public.team_members where id=target_team_member_id;
  if scope is null or not public.is_workspace_super_admin(scope) then raise exception 'Only Super Admin can update Team Members'; end if;
  update public.team_members set name=btrim(target_name),job_title=nullif(btrim(target_job_title),''),
    status=case when target_active then 'active' else 'inactive' end where id=target_team_member_id;
end; $$;

create or replace function public.prepare_team_member_invite(target_team_member_id uuid,target_email text)
returns void language plpgsql security definer set search_path='' as $$
declare scope uuid;
begin
  select workspace_id into scope from public.team_members where id=target_team_member_id;
  if scope is null or not public.is_workspace_super_admin(scope) then raise exception 'Only Super Admin can enable Team login'; end if;
  if lower(btrim(target_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Valid Email is required'; end if;
  update public.team_members set email=lower(btrim(target_email)),login_status='invited' where id=target_team_member_id and auth_user_id is null;
  if not found then raise exception 'Team Member is already linked'; end if;
end; $$;

create or replace function public.link_invited_team_member(target_team_member_id uuid,target_auth_user_id uuid,target_email text)
returns void language plpgsql security definer set search_path='' as $$
declare member public.team_members%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  select * into member from public.team_members where id=target_team_member_id for update;
  if member.id is null or member.auth_user_id is not null then raise exception 'Team Member cannot be linked'; end if;
  if lower(member.email)<>lower(btrim(target_email)) then raise exception 'Invitation Email does not match Team Member'; end if;
  update public.team_members set auth_user_id=target_auth_user_id,login_status='enabled' where id=member.id;
  update public.content_contributors set user_profile_id=target_auth_user_id where team_member_id=member.id;
  update public.contents set current_owner_user_id=target_auth_user_id where owner_team_member_id=member.id;
end; $$;

create or replace function public.assign_content_team_member(target_content_id uuid,target_team_member_id uuid,target_role_code text,target_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; content_scope public.contents%rowtype; member public.team_members%rowtype; role_id uuid; prior uuid;
begin
  select * into content_scope from public.contents where id=target_content_id for update;
  if content_scope.id is null or not public.can_manage_content_assignments(target_content_id) then raise exception 'Production assignment access denied'; end if;
  if target_role_code not in ('owner','talent','director','shooter','editor','reviewer','publisher') then raise exception 'Unsupported production role'; end if;
  select * into member from public.team_members where id=target_team_member_id and workspace_id=content_scope.workspace_id and status='active';
  select id into role_id from public.contribution_roles where workspace_id=content_scope.workspace_id and code=target_role_code and is_active;
  if member.id is null or role_id is null then raise exception 'Team Member or role unavailable'; end if;
  for prior in select id from public.content_contributors where content_id=target_content_id and contribution_role_id=role_id and status='active' and team_member_id<>member.id loop
    update public.content_contributors set status='removed',removed_at=now(),removed_by=auth.uid() where id=prior;
  end loop;
  insert into public.content_contributors(content_id,user_profile_id,team_member_id,contribution_role_id,notes,added_by)
  values(target_content_id,member.auth_user_id,member.id,role_id,nullif(btrim(target_notes),''),auth.uid())
  on conflict(content_id,team_member_id,contribution_role_id) do update set status='active',removed_at=null,removed_by=null,
    user_profile_id=excluded.user_profile_id,notes=excluded.notes,added_by=auth.uid(),created_at=now()
  returning id into saved;
  if target_role_code='owner' then update public.contents set owner_team_member_id=member.id,current_owner_user_id=member.auth_user_id where id=target_content_id; end if;
  insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
  values(content_scope.workspace_id,content_scope.client_id,content_scope.id,auth.uid(),'content_contributor',saved,'contributor_assigned',
    jsonb_build_object('team_member_id',member.id,'user_name',member.name,'contribution_role',target_role_code));
  return saved;
end; $$;

create or replace function public.bulk_assign_content_team_member(target_content_ids uuid[],target_team_member_id uuid,target_role_code text)
returns integer language plpgsql security definer set search_path='' as $$
declare content_id uuid; changed integer:=0;
begin
  if coalesce(cardinality(target_content_ids),0)=0 then raise exception 'Select at least one Content'; end if;
  foreach content_id in array target_content_ids loop
    perform public.assign_content_team_member(content_id,target_team_member_id,target_role_code,null);
    changed:=changed+1;
  end loop;
  return changed;
end; $$;

drop function public.list_content_contributors(uuid);

create or replace function public.list_content_contributors(target_content_id uuid)
returns table(id uuid,user_profile_id uuid,team_member_id uuid,display_name text,contribution_role_id uuid,contribution_role_code text,
 contribution_role_name text,notes text,status text,added_by uuid,created_at timestamptz,removed_at timestamptz,removed_by uuid)
language sql stable security definer set search_path='' as $$
 select cc.id,cc.user_profile_id,cc.team_member_id,tm.name,cc.contribution_role_id,cr.code,cr.name,cc.notes,cc.status,
   cc.added_by,cc.created_at,cc.removed_at,cc.removed_by
 from public.content_contributors cc join public.team_members tm on tm.id=cc.team_member_id
 join public.contribution_roles cr on cr.id=cc.contribution_role_id
 where cc.content_id=target_content_id and public.can_view_content(cc.content_id)
 order by (cc.status='active') desc,cr.sort_order,tm.name;
$$;

-- Populate real, editable speaking references only where the M18 placeholder or blank remains.
with scripts(title,lines) as (values
('最近很多商家开始倒闭了，你怎样看？',jsonb_build_array(
'我最近听到这类讨论比较多，但我不会直接说整个市场一定变差。比较实际的做法，是先回到自己的 Business 看数据：Sales 有没有持续下滑、Cash Flow 会不会越来越紧、顾客回款有没有变慢。先看清自己的状况，才知道问题在哪里。',
'企业通常不是今天正常、明天突然出问题。老板往往会先看到一些信号，例如 Sales 连续几个月下降、Cash Flow 不够顺、应收账款越来越久、Stock 越压越多，或者老顾客回来的次数变少。这些变化如果一起出现，就要认真看了。',
'我不会只看 Sales。Sales 有做出来，不代表 Cash Flow 一定健康；毛利太低也可能越卖越辛苦。AR 收不回来、Stock 又压着钱，最后公司账面有生意，手上却没有现金。所以这些数字要放在一起看。',
'第一步不是马上乱砍成本，而是先把最近几个月的数字整理出来，确认钱从哪里进、卡在哪里、哪些 Stock 很久没有动。找到最明显的问题后，再决定要追款、调整采购、改善 Sales，还是重新安排开销。',
'如果老板发现账目一直对不上、Cash Flow 已经影响日常付款，或者自己看不懂数字，就不要拖。可以尽快找会计、顾问或 System partner 一起把资料整理清楚。越早看见问题，能选择的做法通常越多。')),
('做过这么多家企业的系统，最喜欢怎样的顾客？什么样的顾客最难合作？',jsonb_build_array(
'我觉得最好合作的顾客，不一定是什么都答应，而是他愿意把目标讲清楚，也愿意安排一个负责人跟进。大家遇到问题可以直接讲，决定了以后也愿意一起执行，这种项目通常会顺很多。',
'这三个都重要，不过如果一定要选，我会先看愿不愿意沟通。需求一开始不可能百分百清楚，但只要双方愿意讲、愿意确认，很多事情可以慢慢整理。最怕的是没有人做决定，反馈又一直停着。',
'最容易卡住的情况，是公司想上 System，但内部没有负责人，资料没有准备，流程也没有人确认。最后每个人都有不同意见，供应商改来改去，项目当然会慢。所以问题不一定是谁难合作，而是合作方式没有定清楚。',
'有不同意见很正常。我通常会先回到最初目标：这个 System 到底要解决什么 Business 问题。把影响、时间和选择讲清楚，再请双方确认下一步。不要一直争谁对谁错，要让项目继续往前走。',
'我最希望老板先确认三件事：为什么要做、谁负责、什么时候可以做决定。内部资料也要准备好。这样供应商才能给正确建议，员工也知道不是买了 System 就会自动解决所有问题。')),
('不是已经有 SST 了吗？为什么安华又提 GST？',jsonb_build_array(
'这一题一定要先看拍摄当天的官方资料。我可以分享的是，企业老板要分清楚现在正在执行的制度，和政府或市场正在讨论的方向。讨论不等于已经决定，所以不要看到一个 headline 就马上当成政策已经改变。',
'简单来说，两种制度的征收流程和企业需要保存的记录方式不一样。但具体范围、税率和执行细节必须以 RMCD、MOF 等最新官方说明为准。我们这里先帮助老板理解流程，不替代会计师或税务顾问的判断。',
'为什么又会讨论 GST 的机制，需要引用当时官方讲话的完整背景，不能只看一段新闻标题。站在 Business 角度，老板更应该关注的是：如果制度改变，采购、Sales、invoice、accounting 和 System records 能不能衔接。',
'现在不需要因为讨论就马上更换做法。老板可以先确保交易资料完整、invoice 清楚、purchase 和 sales records 对得上。真正需要采取什么行动，要等正式政策和实施细节公布后，再和会计或税务顾问确认。',
'无论最后是维持 SST，还是未来有其他调整，企业都应该先把 Purchase、Sales、Stock、e-Invoice 和 Accounting records 做完整。资料越清楚，政策真的改变时，企业越容易评估影响和准备。')),
('你觉得一个企业里面，什么部门最重要？',jsonb_build_array(
'我觉得没有一个答案适合所有公司。刚开始的公司可能最需要 Sales，把市场做起来；有订单以后，Operations 要交付，Finance 要确保钱收得到。重点不是选一个永远最重要的部门，而是看公司现在卡在哪里。',
'不同阶段真的不一样。初创期要先找到顾客和产品方向；成长期常常卡在流程、团队和 Cash Flow；稳定以后可能要加强管理和效率。老板要看当前 bottleneck，不是照别人公司的组织图。',
'最常见的断点，是 Sales 答应了顾客，但 Operations 不知道；货出了，Finance 不清楚怎么收款；需要人手时 HR 又太迟才知道。每个部门各自很忙，但资料没有连起来，公司还是会卡。',
'可以看问题是不是每次都发生在交接。如果一个部门自己做得不错，但一交给下一个部门就延误、资料不完整或责任不清，那通常不是单一部门能力问题，而是流程和协作没有设计好。',
'我会建议每周至少一起看 Sales pipeline、订单交付、Cash Flow、AR 和重要 Stock，再看团队有没有关键 blocker。大家看同一组资料，才比较容易围绕同一个 Business 目标做决定。')),
('为什么公司名字叫 LKSOFT？',jsonb_build_array(
'需 Steven 补充真实经历：请说明 LKSoft 这个名字最初是谁提出，以及当时公司处于什么阶段。不要由制作团队代写答案。',
'需 Steven 补充真实经历：请亲自确认“LK”和“Soft”各自的真实含义。如果记忆需要查证，可以先说要回看旧资料，不要为了拍摄效果猜一个版本。',
'需 Steven 补充真实经历：请分享当时为什么选择这个名字、有没有考虑其他名称，以及最终决定的真实原因。',
'需 Steven 补充真实经历：请从本人记忆说明公司早期做什么，以及哪些方向延续到今天。创立年份、业务与人物资料拍摄前需要核对。',
'需 Steven 补充真实经历：请用自己的话说，现在回头看 LKSoft 这个名字代表什么。最终版本以 Steven 本人确认的故事为准。')),
('你觉得怎样的企业或老板，会有很好的发展？',jsonb_build_array(
'以我的观察，发展比较稳定的老板通常愿意学习，也愿意面对真实情况。他不会只听好消息，会看 Business 数据、听团队反馈，然后决定下一步。当然这只是经验观察，不是说有这些特质就一定成功。',
'我觉得不是三选一。愿意学习让老板可以调整，敢做决定让公司可以前进，看数据则帮助决定不要只靠感觉。真正关键的是把这几件事连起来：看清情况、做决定、执行后再复盘。',
'发展比较好的老板，不会把错误一直藏着。他会尽快问为什么发生、损失在哪里、下次流程怎样避免。坏消息越早讲，团队越有机会处理；如果每个人只报喜不报忧，问题通常会越来越大。',
'老板不可能永远自己做完所有事情。要先把目标、责任和标准讲清楚，再让团队负责。授权不是完全不管，而是给空间，同时保留清楚的 checkpoint 和 feedback。',
'今天可以先培养一个很简单的习惯：每周固定看几项最重要的 Business 数据，也固定问团队现在最大的 blocker 是什么。持续做，比偶尔很有冲劲更容易形成长期改善。')),
('很多人讲00后很难融入企业文化，你怎样看？',jsonb_build_array(
'我不太认同只用出生年份来判断一个人。每一代都有不同的沟通习惯，但工作表现还是要看个人、团队和公司的管理方式。把问题全部归给00后，可能会忽略公司自己需要改善的地方。',
'有些差异可能来自年龄和经验，有些是沟通方式，也有些是公司制度没有讲清楚。以前大家习惯“做了再说”，年轻员工可能更想知道为什么、标准是什么。这不一定是谁对谁错，而是需要把期待说具体。',
'年轻员工通常需要公司说清楚目标、工作标准、反馈方式和成长路径。不是每件事都要有很长解释，但他至少要知道什么叫做好、什么时候会收到 feedback，以及遇到问题可以找谁。',
'管理者也要检查自己是不是只说“以前我们都是这样做”，却没有解释现在的 Business 需要。还有一种情况是平时没有 feedback，出问题才一次过责怪。这样的管理方式，不只年轻员工会难投入。',
'双方都可以更实际一点：公司把目标、边界和标准讲清楚，员工则主动确认、按时反馈和承担结果。企业文化不是单方面服从，而是大家知道怎样一起把工作做好。'))
), target as (
 select b.idea_id,s.lines from public.idea_shooting_briefs b join public.ideas i on i.id=b.idea_id join scripts s on s.title=i.title
)
update public.idea_shooting_briefs b set pack_segments=(
 select jsonb_agg(case when coalesce(btrim(segment->>'referenceScript'),'')='' or segment->>'referenceScript' like '可参考以下表达重点展开：%'
   then jsonb_set(segment,'{referenceScript}',to_jsonb(target.lines->>((ordinality-1)::integer)),true) else segment end order by ordinality)
 from jsonb_array_elements(b.pack_segments) with ordinality as parts(segment,ordinality)
) from target where target.idea_id=b.idea_id;

-- Keep legacy callers safe while all UI paths move to Team Member ids.
create or replace function public.assign_content_contributor(target_content_id uuid,target_user_id uuid,target_contribution_role_id uuid,target_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare member_id uuid; role_code text;
begin
  select tm.id into member_id from public.team_members tm join public.contents c on c.workspace_id=tm.workspace_id
  where c.id=target_content_id and tm.auth_user_id=target_user_id and tm.status='active';
  select code into role_code from public.contribution_roles where id=target_contribution_role_id;
  if member_id is null or role_code is null then raise exception 'Linked Team Member or contribution role not found'; end if;
  return public.assign_content_team_member(target_content_id,member_id,role_code,target_notes);
end; $$;

create or replace function public.remove_content_contributor(target_contributor_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare contributor public.content_contributors%rowtype; content_scope public.contents%rowtype; role_name text; member_name text;
begin
  select * into contributor from public.content_contributors where id=target_contributor_id for update;
  if contributor.id is null then raise exception 'Content contributor not found'; end if;
  select * into content_scope from public.contents where id=contributor.content_id;
  if not public.can_manage_content_assignments(contributor.content_id) then raise exception 'Contributor removal access denied'; end if;
  if contributor.status<>'active' then raise exception 'Content contributor is already removed'; end if;
  select name into role_name from public.contribution_roles where id=contributor.contribution_role_id;
  select name into member_name from public.team_members where id=contributor.team_member_id;
  update public.content_contributors set status='removed',removed_at=now(),removed_by=auth.uid() where id=target_contributor_id;
  insert into public.activity_logs(workspace_id,client_id,content_id,actor_user_id,entity_type,entity_id,action,metadata)
  values(content_scope.workspace_id,content_scope.client_id,contributor.content_id,auth.uid(),'content_contributor',contributor.id,'contributor_removed',
    jsonb_build_object('team_member_id',contributor.team_member_id,'user_id',contributor.user_profile_id,'user_name',member_name,
      'contribution_role_id',contributor.contribution_role_id,'contribution_role',role_name));
end; $$;
revoke all on function public.list_production_team_members(uuid,uuid),public.list_team_members(uuid),public.create_team_member(uuid,text,text),
 public.update_team_member(uuid,text,text,boolean),public.prepare_team_member_invite(uuid,text),
 public.link_invited_team_member(uuid,uuid,text),public.assign_content_team_member(uuid,uuid,text,text),
 public.bulk_assign_content_team_member(uuid[],uuid,text),public.list_content_contributors(uuid),
 public.assign_content_contributor(uuid,uuid,uuid,text),public.remove_content_contributor(uuid) from public,anon;
grant execute on function public.list_production_team_members(uuid,uuid),public.list_team_members(uuid),
 public.create_team_member(uuid,text,text),public.update_team_member(uuid,text,text,boolean),
 public.prepare_team_member_invite(uuid,text),public.assign_content_team_member(uuid,uuid,text,text),
 public.bulk_assign_content_team_member(uuid[],uuid,text),public.list_content_contributors(uuid),
 public.assign_content_contributor(uuid,uuid,uuid,text),public.remove_content_contributor(uuid) to authenticated;
grant execute on function public.link_invited_team_member(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
