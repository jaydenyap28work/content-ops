-- M07 hardening: keep Internal Review approval and Client handoff as distinct events.
create or replace function public.approve_content_stage(target_content_id uuid,target_approval_type text,target_type text,target_id uuid,expected_from_state text,target_note text default null,target_evidence_url text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.contents%rowtype; req public.content_approval_requirements%rowtype; submitter uuid; saved uuid; next_state text;
begin
  select * into c from public.contents where id=target_content_id for update;
  if c.id is null or c.current_status is distinct from expected_from_state then raise exception 'Stale Workflow Action'; end if;
  select * into req from public.content_approval_requirements where content_id=c.id and approval_type=target_approval_type for update;
  if req.id is null or not req.is_required or not public.is_assigned_reviewer(c.id,target_approval_type) then raise exception 'Assigned Reviewer permission required'; end if;
  perform public.m07_assert_target(c.id,target_type,target_id);
  submitter:=case target_type when 'script_version' then (select created_by from public.script_versions where id=target_id) when 'media_version' then (select submitted_by from public.media_versions where id=target_id) else c.created_by end;
  if submitter=auth.uid() then raise exception 'Required approval cannot be self-approved'; end if;
  insert into public.approvals(content_id,approval_requirement_id,approval_type,target_type,script_version_id,media_version_id,requested_reviewer_user_id,approver_user_id,result,recorded_by,note,evidence_url)
  values(c.id,req.id,target_approval_type,target_type,case when target_type='script_version' then target_id end,case when target_type='media_version' then target_id end,req.assigned_reviewer_user_id,auth.uid(),'approved',auth.uid(),nullif(btrim(target_note),''),nullif(btrim(target_evidence_url),'')) returning id into saved;
  update public.content_approval_requirements set status='approved',updated_at=now() where id=req.id;
  if target_approval_type='internal_video' then
    next_state:=case
      when exists(select 1 from public.content_approval_requirements where content_id=c.id and approval_type='client' and is_required and status not in ('approved','waived')) then c.current_status
      when exists(select 1 from public.content_approval_requirements where content_id=c.id and approval_type='final' and is_required and status not in ('approved','waived')) then 'client_review'
      else 'approved' end;
  elsif target_approval_type in ('client','final') then
    next_state:=case when exists(select 1 from public.content_approval_requirements where content_id=c.id and is_required and status not in ('approved','waived')) then c.current_status else 'approved' end;
  else next_state:=c.current_status; end if;
  if next_state is distinct from c.current_status then perform set_config('contentos.workflow_action','allowed',true); update public.contents set current_status=next_state where id=c.id; perform set_config('contentos.workflow_action','',true); end if;
  perform public.m07_insert_event(c,case when target_approval_type='final' then 'final_approved' else 'approval_recorded' end,next_state,target_note,case when target_type='media_version' then target_id end,null,saved); return saved;
end; $$;

revoke all on function public.approve_content_stage(uuid,text,text,uuid,text,text,text) from public,anon;
grant execute on function public.approve_content_stage(uuid,text,text,uuid,text,text,text) to authenticated;
