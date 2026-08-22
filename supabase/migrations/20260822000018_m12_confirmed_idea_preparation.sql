-- M12: Transaction-safe, idempotent preparation for confirmed Ideas.

create or replace function public.prepare_confirmed_ideas_for_production(target_idea_ids uuid[])
returns table(idea_id uuid, content_id uuid, content_created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  source public.ideas%rowtype;
  linked_content uuid;
  created_now boolean;
  processed integer := 0;
begin
  if coalesce(cardinality(target_idea_ids), 0) = 0 then
    raise exception 'Select at least one Idea';
  end if;
  if cardinality(target_idea_ids) > 100 then
    raise exception 'Prepare no more than 100 Ideas at once';
  end if;
  if cardinality(target_idea_ids) <> cardinality(array(select distinct unnest(target_idea_ids))) then
    raise exception 'Duplicate Idea IDs are not allowed';
  end if;

  for source in
    select * from public.ideas where id = any(target_idea_ids) order by id for update
  loop
    if not public.can_manage_research_client(source.client_id) then
      raise exception 'Idea production preparation access denied';
    end if;
    if source.status = 'new' then
      perform public.change_idea_status(source.id, 'evaluating', null);
      perform public.change_idea_status(source.id, 'approved', null);
    elsif source.status = 'evaluating' then
      perform public.change_idea_status(source.id, 'approved', null);
    elsif source.status not in ('approved','converted') then
      raise exception 'Idea % is not eligible for production preparation from status %', source.id, source.status;
    end if;

    select c.id into linked_content from public.contents c where c.source_idea_id = source.id;
    created_now := false;
    if linked_content is null then
      if (select i.status from public.ideas i where i.id = source.id) = 'converted' then
        raise exception 'Converted Idea % is missing linked Content', source.id;
      end if;
      select result.content_id into linked_content
      from public.convert_idea_to_content(
        source.id, '', '', null, '', coalesce(source.owner_user_id, auth.uid()), '', '', '', array[]::text[]
      ) result;
      created_now := true;
    end if;
    if linked_content is null then raise exception 'Content conversion failed for Idea %', source.id; end if;

    idea_id := source.id;
    content_id := linked_content;
    content_created := created_now;
    return next;
    processed := processed + 1;
  end loop;

  if processed <> cardinality(target_idea_ids) then
    raise exception 'One or more selected Ideas were not found';
  end if;
  if exists (
    select 1
    from public.ideas i
    join public.contents c on c.source_idea_id = i.id
    where i.id = any(target_idea_ids)
      and (i.status <> 'converted' or c.planned_date is distinct from i.planned_date)
  ) then
    raise exception 'Status, provenance, or planned date invariant failed';
  end if;
end;
$$;

revoke all on function public.prepare_confirmed_ideas_for_production(uuid[]) from public, anon;
grant execute on function public.prepare_confirmed_ideas_for_production(uuid[]) to authenticated;

notify pgrst, 'reload schema';
