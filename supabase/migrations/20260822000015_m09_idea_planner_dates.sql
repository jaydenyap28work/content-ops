-- M09: Planner-first Idea dates and linked production context.
-- planned_date is a date-only planning signal. It is not an actual publish timestamp.

alter table public.ideas
  add column if not exists planned_date date;

alter table public.contents
  add column if not exists planned_date date;

comment on column public.ideas.planned_date is
  'Planned production/publication date for planning. Not created_at or actual published_at.';
comment on column public.contents.planned_date is
  'Date-only planning target inherited from an Idea when converted. Not actual published_at.';

create index if not exists ideas_client_planned_date_status_idx
  on public.ideas(client_id, planned_date, status);
create index if not exists contents_client_planned_date_status_idx
  on public.contents(client_id, planned_date, current_status);

create or replace function public.inherit_content_planned_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_idea_id is not null and new.planned_date is null then
    select i.planned_date
      into new.planned_date
      from public.ideas i
      where i.id = new.source_idea_id;
  end if;
  return new;
end;
$$;

revoke all on function public.inherit_content_planned_date() from public, anon, authenticated;

drop trigger if exists contents_inherit_planned_date on public.contents;
create trigger contents_inherit_planned_date
before insert on public.contents
for each row execute function public.inherit_content_planned_date();

-- Overload the existing save function so an older deployed client remains usable
-- while the Planner UI can persist planned_date in the same transaction.
create or replace function public.save_idea(
  target_idea_id uuid,
  target_workspace_id uuid,
  target_client_id uuid,
  target_title text,
  target_source_url text,
  target_original_topic text,
  target_original_hook text,
  target_why_it_works text,
  target_our_angle text,
  target_category_id uuid,
  target_suggested_format text,
  target_priority text,
  target_owner_user_id uuid,
  target_notes text,
  target_reference_ids uuid[],
  target_tag_names text[],
  target_contributors jsonb,
  target_planned_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  saved_id := public.save_idea(
    target_idea_id,
    target_workspace_id,
    target_client_id,
    target_title,
    target_source_url,
    target_original_topic,
    target_original_hook,
    target_why_it_works,
    target_our_angle,
    target_category_id,
    target_suggested_format,
    target_priority,
    target_owner_user_id,
    target_notes,
    target_reference_ids,
    target_tag_names,
    target_contributors
  );

  update public.ideas
    set planned_date = target_planned_date
    where id = saved_id;

  return saved_id;
end;
$$;

revoke all on function public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date) from public, anon;
grant execute on function public.save_idea(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text,uuid,text,uuid[],text[],jsonb,date) to authenticated;

create or replace function public.list_idea_planner_context(target_workspace_id uuid)
returns table(
  idea_id uuid,
  owner_name text,
  creator_name text,
  linked_content_id uuid,
  linked_content_code text,
  linked_content_status text,
  linked_content_record_status text,
  linked_content_planned_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    owner_profile.display_name,
    creator_profile.display_name,
    c.id,
    c.content_code,
    c.current_status,
    c.record_status,
    c.planned_date
  from public.ideas i
  left join public.user_profiles owner_profile on owner_profile.id = i.owner_user_id
  left join public.user_profiles creator_profile on creator_profile.id = i.created_by
  left join public.contents c
    on c.source_idea_id = i.id
    and public.can_manage_content_client(c.client_id)
  where i.workspace_id = target_workspace_id
    and public.can_view_idea(i.id)
  order by i.planned_date nulls last, i.updated_at desc;
$$;

revoke all on function public.list_idea_planner_context(uuid) from public, anon;
grant execute on function public.list_idea_planner_context(uuid) to authenticated;

notify pgrst, 'reload schema';
