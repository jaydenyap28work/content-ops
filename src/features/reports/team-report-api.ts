import { supabase } from '../../lib/supabase'
import type { TeamReportData } from './team-report'

export async function loadTeamReport(workspaceId:string,fromIso:string,toIso:string,teamMemberId:string|null){
  const {data,error}=await supabase.rpc('list_team_report',{
    target_workspace_id:workspaceId,target_from:fromIso,target_to:toIso,target_team_member_id:teamMemberId,
  })
  if(error)throw new Error(error.message)
  const report=(data??{}) as Partial<TeamReportData>
  return {members:report.members??[],actions:report.actions??[]} satisfies TeamReportData
}
