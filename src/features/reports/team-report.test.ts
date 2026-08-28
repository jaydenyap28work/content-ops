import { describe,expect,it } from 'vitest'
import { aggregateTeamReport,reportDateRange } from './team-report'
import type { TeamReportData } from './team-report'

const base={occurredAt:'2026-08-05T04:00:00Z',entityType:'content' as const,entityId:'content-1',contentId:'content-1',title:'LKSoft Topic',result:'completed'}
describe('team report aggregation',()=>{
  it('deduplicates overview events while preserving role contributions',()=>{
    const data:TeamReportData={members:[{id:'a',name:'Jayden',status:'active'},{id:'b',name:'Intern',status:'active'}],actions:[
      {...base,eventKey:'shoot-1',metric:'shoots_completed',teamMemberId:null,roleCode:'unassigned',actionCode:'shoot_completed'},
      {...base,eventKey:'shoot-1',metric:'shoots_completed',teamMemberId:'a',roleCode:'director',actionCode:'shoot_completed'},
      {...base,eventKey:'shoot-1',metric:'shoots_completed',teamMemberId:'b',roleCode:'shooter',actionCode:'shoot_completed'},
      {...base,eventKey:'idea-1',metric:'ideas_submitted',teamMemberId:'a',roleCode:'idea_provider',actionCode:'idea_submitted'},
      {...base,eventKey:'idea-2',metric:'ideas_submitted',teamMemberId:'b',roleCode:'idea_provider',actionCode:'idea_submitted'},
      {...base,eventKey:'confirm-1',metric:'ideas_confirmed',teamMemberId:'a',roleCode:'idea_provider',actionCode:'confirmed_for_production'},
    ]}
    const result=aggregateTeamReport(data)
    expect(result.overview.shoots_completed).toBe(1)
    expect(result.contributions.find(item=>item.member.id==='a')).toMatchObject({ideasSubmitted:1,ideasConfirmed:1,directed:1,adoptionRate:1})
    expect(result.contributions.find(item=>item.member.id==='b')).toMatchObject({shot:1,adoptionRate:0})
  })
  it('uses a dash-ready null rate when submitted count is zero',()=>{
    const result=aggregateTeamReport({members:[{id:'a',name:'Jayden',status:'active'}],actions:[]})
    expect(result.contributions[0].adoptionRate).toBeNull()
  })
})

describe('team report date ranges',()=>{
  it('builds Malaysia month and last-month boundaries with an exclusive end',()=>{
    expect(reportDateRange('month',new Date('2026-08-28T12:00:00Z'))).toMatchObject({from:'2026-08-01',to:'2026-08-28',toIso:'2026-08-29T00:00:00+08:00'})
    expect(reportDateRange('last_month',new Date('2026-08-28T12:00:00Z'))).toMatchObject({from:'2026-07-01',to:'2026-07-31',toIso:'2026-08-01T00:00:00+08:00'})
  })
})
