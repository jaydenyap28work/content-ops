import{Activity,Archive,BookOpen,Building2,CalendarDays,FileText,FolderOpen,LayoutDashboard,Lightbulb,ListTodo,Music2,Settings,Store,Users}from'lucide-react'
import type{AppRouteDefinition,NavigationSection}from'../types/navigation'
export const routeDefinitions:AppRouteDefinition[]=[
{path:'/',title:'工作台',navigationLabel:'工作台',description:'今天与本周需要推进的内容。',foundationNote:'由真实排期与 workflow records 派生。',phase:'V0.1 Pilot',section:'Daily Work',icon:LayoutDashboard},
{path:'/ideas',title:'内容计划',navigationLabel:'内容计划',description:'Planner-first 选题与制作计划。',foundationNote:'选题、负责人、排期与来源。',phase:'V0.1 Pilot',section:'Daily Work',icon:Lightbulb},
{path:'/content',title:'制作中心',navigationLabel:'制作中心',description:'正式制作进度与执行。',foundationNote:'严格状态动作保持不变。',phase:'V0.1 Pilot',section:'Daily Work',icon:FileText},
{path:'/calendar',title:'日历',navigationLabel:'日历',description:'自动汇总计划、拍摄与发布。',foundationNote:'不建立第二套 event。',phase:'V0.1 Pilot',section:'Daily Work',icon:CalendarDays},
{path:'/brand/lksoft',title:'LKSoft 品牌中心',navigationLabel:'LKSoft 品牌中心',description:'LKSoft 内部品牌账号、素材与剪辑规范。',foundationNote:'Internal Brand operations。',phase:'V0.1 Pilot',section:'Brand',icon:Store},
{path:'/analytics',title:'数据分析',navigationLabel:'数据分析',description:'手动追踪已发布内容表现。',foundationNote:'24h / 7d / 30d。',phase:'V0.1 Pilot',section:'Results',icon:Activity},
{path:'/tasks',title:'待办',navigationLabel:'待办',description:'轻量执行事项与到期提醒',foundationNote:'不包含复杂项目管理',phase:'V0.1 Pilot',section:'Management',icon:ListTodo},
{path:'/clients',title:'客户',navigationLabel:'客户',description:'客户与品牌边界。',foundationNote:'Client-scoped。',phase:'V0.1 Pilot',section:'Management',icon:Building2},
{path:'/team',title:'团队',navigationLabel:'团队',description:'邀请、角色与客户权限。',foundationNote:'Invite-only。',phase:'V0.1 Pilot',section:'Management',icon:Users},
{path:'/references',title:'灵感库',navigationLabel:'灵感库',description:'保存值得参考的内容并转为自己的选题。',foundationNote:'不是文件资料库。',phase:'V0.1 Pilot',section:'Resources',icon:BookOpen},
{path:'/assets',title:'素材库',navigationLabel:'素材库',description:'外部素材索引。',foundationNote:'大文件留在 Drive / NAS / Local。',phase:'V0.1 Pilot',section:'Resources',icon:FolderOpen},
{path:'/music',title:'音乐库',navigationLabel:'音乐库',description:'BGM 来源与使用记录。',foundationNote:'低优先级。',phase:'V0.1 Pilot',section:'Resources',icon:Music2},
{path:'/editing-playbook',title:'剪辑规范',navigationLabel:'剪辑规范',description:'客户相关的剪辑标准。',foundationNote:'从 Client 上下文进入。',phase:'V0.1 Pilot',section:'Resources',icon:Archive},
{path:'/settings',title:'设置',navigationLabel:'设置',description:'个人与 Workspace 设置。',foundationNote:'不包含复杂权限编辑器。',phase:'V0.1 Pilot',section:'Settings',icon:Settings}]
export const navigationSections:NavigationSection[]=['Daily Work','Brand','Results','Management','Resources','Settings']
export function getRouteDefinition(pathname:string){return routeDefinitions.find(route=>route.path===pathname)}
