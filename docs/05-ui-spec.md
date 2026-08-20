# ContentOS V0.1 UI / UX Specification

Status: Draft — Phase 5 UI / UX Specification

本文定义 ContentOS V0.1 的界面结构、核心页面、交互规则、权限表现与 responsive 要求。它不包含前端代码、技术框架、视觉品牌稿或 Database implementation。

## 1. UX Goals and Boundaries

### 1.1 Primary goal

ContentOS 是内部 Content Operations 工作系统。界面的首要目标是让用户快速回答：

- 现在什么最需要处理？
- 每条 Content 处于哪个真实阶段？
- 下一步由谁执行、何时到期？
- 当前 Script、Media Version、Approval、Publication 与文件在哪里？
- 哪些事项被阻塞、逾期、退回或发布失败？

Dashboard、List、Calendar 与 Content Detail 必须服务真实日常操作，不以装饰性图表或展示型数据占用首屏。

### 1.2 Product boundaries reflected in UI

- Content Detail 是核心工作页面；相关 Script、Production、Revision、Approval、Publication、Analytics、Assets 与 Activity 应集中在此处理。
- 不把 40 张 Database tables 机械转换为 40 个页面。Join、version、event、approval 与 audit records 应作为相关业务对象内的 sections、drawers、dialogs 或 timelines 出现。
- ContentOS 管理 metadata、workflow、assignments、timestamps 与 links；不上传、托管、播放或转码大型 media。
- Google Drive URL 可以 Open / Copy；Local / NAS path 只提供 Copy，不伪装成浏览器可可靠打开的链接。
- V0.1 不接 Google Calendar、Facebook 或 XHS API，不提供自动 publishing、scraping、CSV import、复杂 reports、SLA engine 或自定义 permission designer。
- Saved Views、advanced workload / efficiency dashboard、完整 Client Portal 与 native mobile app 不属于 V0.1 Must Have。

### 1.3 Interaction principles

1. **Action before decoration**：attention queue、责任人、deadline 与下一步动作优先于 charts。
2. **One record, multiple views**：List、Kanban、Calendar 与 Dashboard 必须引用同一 Content / Publication / Calendar Event，不允许人工双写。
3. **Explicit workflow actions**：Start、Complete、Submit、Approve、Schedule 与 Publish 必须是命名清楚的动作，不以随意编辑 status 代替。
4. **Event-backed updates**：关键动作成功后立即生成 workflow event、timestamp 与必要的 activity；UI 不另要求用户重复填写实际发生时间。
5. **History stays visible**：新 Script / Media Version、Revision 与 Correction 不覆盖旧记录。
6. **Permission is contextual**：用户看不到无权访问的 Client；对于看得到但不能执行的动作，应显示合理的 disabled state 与原因，而不是造成“按钮坏了”的感觉。
7. **Dense but readable**：桌面端以高信息密度 table、filters、status chips 与 side panels 支持频繁操作；详情按任务分组，避免一次展示所有字段。
8. **Safe sharing**：Internal、Private Management 与 Client-visible 数据在录入位置、标签、颜色与确认文案上必须明确区分。

## 2. Confirmed V0.1 Permission Defaults in UI

以下是本阶段已确认的 UI defaults，不再作为本文件的 Open Questions：

1. Internal Manager 可 Create / Edit Client；Client Archive 仅 Super Admin。
2. User、Role 与 Client Access Management 仅 Super Admin。Internal Manager 可以在 Content 内分配已拥有该 Client access 的执行人员，但不能借 assignment 授予 access。
3. Required Approval 默认禁止 submitter self-approval。若当前用户是被审版本的 submitter，Approve action 必须 disabled，并说明需要其他 Assigned Reviewer。
4. Super Admin 可 override，但必须通过独立 confirmation flow 填写 reason；override 不能伪装成正常 Approval。
5. External Approval 不建立联系人管理 UI；外部审批身份与证据只记录 Name、Channel、Approval Time、Recorded By 与 Evidence。Approved subject / version 由发起动作的当前 review context 明确关联。
6. V0.1 不做 second approver。
7. Notes 在 UI 明确分为：Internal、Private Management、Client-visible。不得放进一个没有 visibility 的通用 Notes box。
8. Workflow Events 与内部 Activity Log 只供内部用户按权限查看；Client-facing view 不显示原始内部 timeline。
9. Asset / Media 默认 internal，只有明确标记 Client-visible 才能向 Client 开放。
10. Approval Evidence 默认 internal；如未来允许分享，必须由授权用户显式标记，不能随 Approval 自动公开。
11. Client 默认看不到 Contributor、Staff performance、Contribution、内部 attribution 或内部人员讨论。
12. Client 只可访问明确共享的 Content、notes、media、publication、analytics 或 report data。
13. Cross-client / Workspace library 仅内部可见，不出现在 Client navigation 或 Client search。
14. Intern access 在 V0.1 由 Super Admin 手动管理；任务完成不会假设已实现自动 access expiry。
15. Analytics 按 active Client access 隔离；跨 Client 汇总只向拥有全部相关 Client scope 的内部角色显示。

## 3. Information Architecture and Global Layout

### 3.1 Internal main navigation

桌面端使用可收起的左侧 Sidebar。建议主导航顺序：

1. **Dashboard**
2. **Content**
3. **Calendar**
4. **Ideas**
5. **References**
6. **Analytics**
7. **Libraries**
   - Assets
   - Music
   - Editing Playbook
8. **Clients**
9. **Team** — 仅 Super Admin
10. **Settings** — 按权限显示可管理项目

Sidebar 顶部提供 Workspace identity；多 Client 用户可使用 Client scope selector。Scope selector 应显示 `All assigned clients` 与用户可访问的 Clients，不能列出无权 Client，也不能把 Client selection 当作安全边界。

Sidebar 底部显示当前用户、Role summary、Profile / Sign out。若用户持有多个 Role，只显示简短 summary；不让用户通过“切换 Role”绕过或缩小后台实际权限判断。

### 3.2 Global header

每个页面顶部保持一致：

- Page title 与必要的 breadcrumb
- 当前 Client scope（当页面不是固定 Client 时）
- Page-level primary action，例如 `New Content`、`New Idea`
- Search / Filter access（按页面需要）
- 当前用户可执行的 secondary actions

不在 Global Header 放置 V0.1 未定义的 notification center、AI assistant、social inbox 或 integration status。

### 3.3 Page hierarchy

主要 list 页面进入 detail；常用轻量编辑优先使用 side drawer，涉及不可逆或事件型动作使用 modal / dedicated action panel。

```text
Dashboard attention item
→ Filtered Content / Publication list
→ Content Detail
→ Contextual workflow action
→ Workflow Event + timestamp + Activity
```

### 3.4 Database entities that are not standalone pages

- Script Versions、Media Versions、Approval Requirements、Approvals、Revision Requests、Content Contributors、Content Assets、Content Music、Workflow Events 与 Content Activity 都嵌入 Content Detail。
- Publications 与 Analytics Snapshots 以 Content Detail 为主要入口；Analytics 可另有跨 Content 工作队列，但不复制数据。
- Lookup / join records 不显示为技术表页面。
- Workspace membership、Role 与 Client membership 统一由 Team management 表达，不展示数据库关系结构。

## 4. Dashboard — What Needs Attention

### 4.1 Default view

Dashboard 首屏按 urgency 与 actionability 排序，不以总 views、likes 或漂亮 charts 开场。默认模块：

1. **My Actions**：当前用户被分配且可执行的下一步。
2. **Overdue**：已超过 Script、Shoot、First Cut、Review 或 Publication deadline 的项目。
3. **Blocked / Failed / No Response**：Editing Blocked、Publication Failed、Client No Response 等异常。
4. **Waiting for Review**：First Cut、Revision、Script 或 Client Approval queues。
5. **Ready for Next Stage**：Ready to Shoot、Shot / Awaiting Edit、Approved waiting for Publication。
6. **Analytics Due**：已 Published 但缺少预期 Manual Snapshot 的 Publications。
7. **Upcoming**：未来 7 天 Shooting、Review、Publishing、Meeting、Workshop events。

`Published This Month` 可作为紧凑 summary，但不能挤占 attention queues；高级 efficiency、performance ranking 与 workload charts 不进入 V0.1。

### 4.2 Queue behavior

- 每个 queue 显示数量、最重要的若干 records、Client、Content ID、title、status、assignee、deadline 与 overdue duration。
- 点击 queue heading 进入已应用相同条件的 Content / Publication list。
- 点击 record 直接进入 Content Detail 的相关 section，例如 Review 或 Publication。
- 默认按 overdue severity、priority、deadline 排序；不能只按创建时间。
- Dashboard 遵循当前 Client scope 和用户 access；Client 间数据不能因 aggregate count 泄漏。
- 空 queue 使用简短完成状态，不显示无意义的零值 chart。

## 5. Clients

### 5.1 Client list

Client list 是内部管理页面，使用 table 或 compact cards 显示：

- Client name / code
- Industry
- Status
- 当前 active Content 数量
- Needs Attention 数量
- Upcoming nearest event
- Last updated

支持 name、code、status 与 assigned access 的基本 search / filter。Archived Clients 默认隐藏，但 Super Admin 可切换查看。

### 5.2 Create / edit / archive

- `Create Client` 对 Super Admin 与 Internal Manager 显示。
- `Edit Client` 对其 scope 内的 Super Admin 与 Internal Manager 显示。
- `Archive Client` 只对 Super Admin 显示，并放在 secondary danger area；确认画面必须说明历史数据不会删除。
- Internal Manager 不显示 Archive、User access 或 Role management controls。
- Client code 的 uniqueness / sequence handling 若发生冲突，应在保存前明确提示，不静默更改。

### 5.3 Client detail

Client Detail 不复制全部 ContentOS 模块，使用以下 tabs / sections：

- **Overview**：active Content、attention queues、upcoming events、brand summary。
- **Content**：预设该 Client filter 的 Content list。
- **Calendar**：预设该 Client filter 的 Calendar。
- **Brand & Planning**：brand notes、categories、campaigns 与可用 planning metadata。
- **Libraries**：该 Client 的 References、Assets、Music 与 Editing Playbooks shortcuts。

Client access 管理不放在 Internal Manager 可见的 Client Detail 中；仅 Super Admin 可从 Team management 进入相关 access controls。

## 6. Reference Library

### 6.1 List and search

Reference Library 使用可筛选 table / card toggle，至少支持：

- Reference Type：Account / Content
- Platform
- Client-specific / Workspace-wide
- Suitable Client
- Industry / Country
- Content style / Format
- Tags
- Gold Standard
- Status

每个 item 显示 title、account、platform、thumbnail placeholder（如只有 URL 不抓取媒体）、why it works 摘要、tags 与 scope。V0.1 不自动抓取页面 metadata 或 media。

### 6.2 Detail and actions

Detail drawer / page 显示 source URL、analysis、learning notes、suitable clients、tags 与 related Ideas。

Primary action：`Convert to Idea`。转换 flow 必须选择 Client、填写 Our Angle / title 等 Idea 必需信息，并在成功后保留 Reference relationship。转换不归档 Reference。

Workspace-wide 与 cross-client References 仅内部可搜索。Client-facing navigation 不提供 Reference Library。

## 7. Ideas

### 7.1 Idea list

Idea Bank 默认使用 dense table，并可按 status tabs 快速切换：New、Evaluating、Approved、Converted、Rejected、Archived。

至少支持 Client、Status、Category、Priority、Owner、Suggested Format、Reference presence 与 Date filter。主要 columns：Idea title、Client、source / reference indicator、status、priority、owner、updated time。

### 7.2 Idea detail and lifecycle

Idea Detail 显示：

- Original topic / Hook / source URL
- Related References
- Why it works
- Our angle
- Suitable Client / Category / Format
- Owner / Idea Contributors
- Priority
- Internal Notes
- Status history / Activity

Lifecycle actions 使用明确按钮：Start Evaluation、Approve Idea、Reject、Archive、Restore、Convert to Content。Reject / Archive 需要 reason 或 notes；Converted Idea 不提供删除来源关系的 UI。

`Convert to Content` 使用 guided drawer：确认 Client、Content title、Category、Campaign、Format、Priority、owner 与初始 Script / notes。提交后显示建立的 Content ID，并提供 `Open Content`。Idea Creator 与 source relationships 必须在确认摘要中显示。

## 8. Content List, Kanban and Filters

### 8.1 Default table

Content 的默认视图是适合高频操作的 table，而不是大卡片。默认 columns：

- Content ID
- Title
- Client
- Category / Format
- Current Status
- Priority
- Current Owner / next assignee
- Next deadline / scheduled event
- Publication summary
- Needs Attention indicator
- Updated time

Title 与 Content ID 固定在左侧；status、assignee 与 date 使用一致的 chips / formats。长 Notes 不直接铺在 table 中。

### 8.2 Strong filters

V0.1 至少支持组合过滤：

- Client
- Content Category
- Status
- Platform
- Contributor
- Editor
- Shooter
- Campaign
- Date field + date range
- Priority
- Format

Date filter 必须先选择 date meaning，例如 Shoot Scheduled、First Cut Due、Review Due、Scheduled Publish、Actual Published 或 Created；不能使用含义不清的单一 Date。

Filter bar 显示 active filter chips、结果数量与 `Clear all`。当选项很多时使用 searchable multi-select。V0.1 不实现 Saved Views；页面可在当前会话保留用户刚才使用的 filters，但不能把它宣传为 Saved View。

### 8.3 Kanban

Kanban 是同一 Content dataset 的 alternate view，按 production state 分列。Card 只显示 Content ID、title、Client、priority、assignee、deadline 与 attention warning。

- 拖动 card 不能静默写入新 status。
- 若 transition 合法，drop 后打开对应 action sheet，收集该动作必须的信息并显示将生成的 event / timestamp。
- 若 transition 需要 Version、Reviewer、Publication 或未满足 approval，禁止直接完成并说明缺少条件。
- 无权用户可以查看 card，但不能拖动。
- Correction / override 不通过普通 drag 完成。

### 8.4 Bulk actions

V0.1 不提供批量 status transition、批量 Approval 或批量 Mark Published。可考虑的安全 bulk actions仅限非生命周期 metadata，例如授权角色批量调整 Category / Tag；是否进入首版留作 Open UI Question。

## 9. Content Detail — Core Work Page

### 9.1 Header and persistent context

Content Detail header 始终显示：

- Content ID 与 title
- Client
- Current production status
- Publication summary
- Priority
- Current owner / next responsible role
- Nearest deadline
- Needs Attention / Blocked warning
- Primary next action（按权限与当前状态计算）

Header 提供 compact breadcrumb 回到原 filtered list，并尽可能保留 list context。Primary action 必须描述业务动作，例如 `Start Editing`，不能只写 `Update Status`。

### 9.2 Recommended detail structure

桌面端使用内容主区 + sticky contextual summary / action rail，内部 sections 可采用 tabs：

1. **Overview**
   - Content metadata、category、campaign、format、priority、owner
   - Reference → Idea → Content provenance
   - Hook、CTA、target publish
   - Assignments、contributors 与 next deadlines
2. **Script**
   - Current Script Version
   - version history、status、author、submitted time
   - Edit as new version / Submit / Mark Script Ready
3. **Production**
   - Shooting assignment / schedule / location / links
   - Editing assignment、blocked state、First Cut due
   - Media Versions 与 Drive / Local / NAS metadata
4. **Review & Revisions**
   - Approval requirements
   - current review target / reviewer
   - Approve、Request Revision、Record External Approval
   - Revision Requests 与 resolution links
5. **Publications & Analytics**
   - 独立 Facebook / XHS Publication cards
   - schedule、publisher、actual publish time、URL、status
   - Manual Analytics Snapshots
6. **Assets & Standards**
   - linked Assets、Music、Editing Playbook Version
   - Open / Copy links and paths
7. **Activity**
   - internal Workflow Events 与 Content-level Activity
   - filters for Workflow / Assignment / Approval / Publication / Correction

### 9.3 Notes and visibility

Notes 应作为清楚分隔的 fields / panels：

- **Internal Notes**：内部业务协作；Client 不可见。
- **Private Management Notes**：仅 Super Admin / authorized Internal Manager；避免放在执行角色常用区域。
- **Client-visible Notes**：明确标记“可向 Client 分享”；保存前保持可见提示。

三个 Notes 区域不得只靠颜色区分；必须同时使用文字 label、visibility icon 与 helper text。复制或移动 notes 到 Client-visible 时需要确认。

### 9.4 Editing and save behavior

- 普通 metadata 可 inline edit 或在 drawer 编辑；显示 unsaved state。
- Workflow state 不提供自由下拉直接改值；必须使用 action flow。
- 已提交 Script / Media Version 不可原地覆盖；编辑动作建立新 Version。
- 冲突或 stale data 时不得静默覆盖他人修改；提示 reload / review current value。
- Archive / Cancel / Reopen / Override 放在 secondary actions，要求 reason 与明确 confirmation。

## 10. Production Workflow Actions

### 10.1 Action pattern

所有 event-backed action 使用一致结构：

1. Action title 与当前 Content / Client。
2. Current state → resulting state preview。
3. 该动作需要的最小业务字段。
4. 将自动记录的 actor 与 timestamp。
5. 可能生成的 Version、Workflow Event、Activity 或 Calendar change。
6. Confirm button 使用具体动词。

动作成功后 UI 应：更新 current state、插入 timeline event、显示成功 feedback，并把焦点移到下一步信息；失败时不能显示假成功或先永久改变状态。

### 10.2 Shooting actions

- `Schedule / Reschedule Shoot`：日期时间、location、assigned Shooter；Reschedule 需要 reason 并显示 old / new time。
- `Start Shooting`：仅 assigned / authorized actor；自动记录 started time。
- `Complete Shooting`：要求至少确认素材位置或明确“link/path pending”，可补 Notes；自动记录 completed time。
- `Cancel Shoot`：reason、是否 reschedule 或 cancel Content；不能把 scheduled event 删除当作取消事实。

### 10.3 Editing actions

- `Start Editing`：仅 assigned / authorized Editor；自动记录 editing started time。
- `Mark Blocked`：reason、需要谁处理、next follow-up；Content 保持 Editing 并显示 attention warning。
- `Submit First Cut`：建立 V1，记录 Drive URL / Local / NAS path、notes；自动记录 submitter 与 time。
- `Start Revision`：关联 open Revision Request。
- `Submit Revision`：建立下一 Version，并返回提出该 Revision 的 review stage；不得自动 Approved。

### 10.4 Publishing actions

- `Prepare Publication`：建立独立 platform plan，不改变其他平台 Publication。
- `Schedule / Reschedule`：记录 scheduled time；Reschedule 显示 old / new time 与 reason。
- `Mark Published`：要求 actual published time 与 URL，或明确 missing-link reason；只更新该 Publication。
- `Mark Failed`：要求 failure reason 与 next action；显示 Needs Attention。
- `Archive Publication`：必须明确是否仍属于 required plan，并受权限限制。

## 11. Revision and Approval Experience

### 11.1 Version history

Review & Revisions 默认突出当前待审 subject / version，同时保留按时间倒序的完整 history。每个 Version row / card 显示：

- Version number 与 type
- Submitted by / submitted at
- Link / path actions
- Review status
- Related Revision Request
- Approved / superseded indicator

不能用一个会被覆盖的 `Current file link` 取代 Version history。旧 Version 保持可访问，但视觉上清楚区分 current operational version。

### 11.2 Request Revision

Request Revision drawer 必须显示当前审核对象，并要求：

- Review scope：Internal / Client
- Reason category
- Reason notes（`Other` 时必填）
- Return stage / intended reviewer context

提交后立即建立 Revision Request 与 Workflow Event，并让 Editor 在 Content Detail 看见明确的 open request。修改意见不可只存为没有归属的通用 Notes。

### 11.3 Approve

- Approve button 只对当前 Assigned Reviewer / authorized reviewer 显示或 enabled。
- Required Approval 默认禁止 submitter self-approval。若当前 reviewer 同时是该 subject / version 的 submitter，按钮 disabled，并显示 `Submitter cannot approve this required checkpoint`。
- Approval confirmation 显示 approval type、target、version、approver 与自动 timestamp。
- Approve 只完成当前 checkpoint；UI 应预览下一 required checkpoint，不得让用户误以为整个 Content 已全部 Approved。
- 新 Version 不沿用旧 Version approval；UI 必须重新显示 pending review。

### 11.4 Record External Approval

External Approval 使用单次记录 form，不建立 contacts / address book。字段：

- External Approver Name
- Channel：WhatsApp / Face-to-face / Call / Other
- Approval Time
- Recorded By：自动带入当前用户，不可伪装为 Approver
- Evidence URL / reference（optional）

Approved Subject / Script Version / Media Version / Publication 由进入此 action 的当前 review context 显示并锁定，不作为外部联系人资料，也不能由 recorder 随意切换。

Approval Evidence 默认为 Internal。界面必须显示 internal badge；不得因录入 External Approval 自动向 Client 开放 evidence。

### 11.5 Override

Super Admin 的 Override 位于 secondary admin action，不与 Approve 并列成普通 review 选择。必须输入 reason，并预览 before / after、将生成的 Override event 与 Activity Log。V0.1 不要求 second approver。

若 override 用于 waiver / 改变 required approval，UI 必须明确显示 `Approval requirement overridden`，不能生成伪造的 Reviewer Approval。

## 12. Publications and Facebook / XHS Links

### 12.1 Publication cards

每个 Publication 使用独立 card / row，至少显示：

- Platform 与 account text
- Required / optional indicator
- Assigned Publisher
- Status
- Scheduled time
- Actual published time
- Published URL
- Failure reason / attention state
- Latest Analytics Snapshot summary

Facebook 与 XHS 是 V0.1 active platforms，但 UI 结构不假设每条 Content 只能各有一个 Publication。同平台 repost 或不同 account 必须是独立 record。

### 12.2 Link handling

- URL 显示 `Open` 与 `Copy`，并保留完整值供编辑。
- Facebook / XHS URL 保存时进行基本 format warning，但不自动抓取或验证 private metrics。
- Duplicate URL 使用 warning，不做无解释的 hard block。
- Published URL 的修正必须进入 Activity；不能改写 actual published time 而不留记录。

### 12.3 Derived publication summary

Content header 显示 Not Published、Partially Published 或 Fully Published，并在需要时附加 Failed / Needs Attention。Summary 必须从 required Publications 派生；不能提供独立 Boolean toggle。

## 13. Analytics Manual Snapshot

### 13.1 Analytics queue

Analytics navigation 提供内部工作队列，按 Client access 隔离，重点显示：

- Published Publications missing 24h / 7d / 30d Snapshot
- Latest capture time
- Platform / account
- Assigned Publisher / responsible person
- Content / Publication link

它不是高级 performance dashboard，也不做跨平台排名或员工评分。

### 13.2 Add snapshot

从 Publication card 或 Analytics queue 打开 `Add Manual Snapshot` drawer。必须显示固定的 Client、Content、Platform 与 Publication context，避免把数据记到错误账号。

表单包括：

- Snapshot type：24h / 7d / 30d / Current / Custom
- Captured at
- Data Source：V0.1 默认 Manual；允许按已定义来源记录事实，但不显示未实现的 import / API controls
- Common metrics：Views / Reads、Reach、Likes / Reactions、Comments、Shares、Saves、Watch data、Followers gained、Leads
- 平台适用的额外 metrics
- Notes
- Entered by：自动记录

不适用指标保持空值，不强迫填 0。数值 validation 应区分 missing、zero 与 invalid。保存后新增 Snapshot；修正历史 Snapshot 必须保留 captured time、source 与 Activity。

### 13.3 Analytics visibility

- Internal users只看到其 Client scope 内的 Snapshots。
- Client-facing Analytics 只显示明确共享的 fields / reports，不公开 entered by、内部 Notes 或其他 Clients aggregate。
- Contributor / Staff performance 不得从 Analytics 页面推断或展示。

## 14. Calendar

### 14.1 Familiar planner behavior

Calendar 延续现有 Planner 易理解的 Month-first 使用方式：用户打开后可按月看到 Shooting、First Cut Due、Review、Publishing、Meeting、Workshop / Event。它改善人工双写，但不否定现有月历习惯。

提供：

- Month view（default）
- Week / Agenda view（若实现成本允许；Month view 为 V0.1 必须）
- Today
- Previous / Next period
- Client、Event Type、Assignee filters
- 清楚的 legend

颜色按 Event Type，而不是把所有 production status 混成颜色。Cancelled、Overdue 与 Needs Attention 使用额外 icon / treatment，不能只靠颜色。

### 14.2 Event behavior

- 点击 Content-linked event 打开 event preview，并可进入 Content Detail。
- 点击 Publication-linked publishing event进入对应 Publication section。
- Calendar Event 表示 schedule，不表示动作已经发生。
- Drag / resize reschedule 后必须确认新时间；高影响 events 要求 reason，并产生 Activity / applicable Workflow Event。
- 实际 Shoot Started、First Cut Submitted 或 Published 仍须在 workflow action 中完成。
- 不设每天最多 3 个任务位；同日较多 events 使用 `+N more` / agenda，不要求人工插行。

### 14.3 Create event

Create flow 先选 Event Type，再显示相关字段。Content / Publication association 使用 searchable picker，并自动带入 Client；不能把关联对象改到不同 Client。

Google Calendar connection、sync badge 与 external edit conflict 不进入 V0.1 UI。

## 15. Asset Library

### 15.1 Asset index

Asset Library 使用 dense table / searchable grid，支持：

- Client
- Asset type
- Orientation
- Shoot date
- Tags
- Reusable
- Linked / unlinked Content
- Archived state

Columns 包括 name、file name、Client、type、orientation、shoot date、location indicators、reusable 与 usage count。系统不生成大型 media preview；可使用 file-type icon 或手动 thumbnail placeholder，但不能假设 URL 可公开访问。

### 15.2 Asset detail and linking

Asset drawer 显示 Google Drive URL、Local path、NAS path、tags、notes 与 used-in Contents。操作：

- Open Drive URL
- Copy URL
- Copy Local Path
- Copy NAS Path
- Link / unlink Content（受权限与 Client scope 限制）

跨 Client asset reuse 默认不通过普通 picker 提供。Workspace / cross-client library 仅内部可见；Client users 不得搜索或推断 library inventory。

### 15.3 Client visibility

Asset / Media 默认 `Internal`。只有授权用户明确执行 `Share with Client` 或设置 client-visible，Client-facing view 才显示安全的 shared URL / representation。分享确认必须列出将开放的 item 与 Client；Local / NAS path 永不进入 Client view。

## 16. Music Library

Music Library 是 metadata index，不是播放器或托管系统。List 支持 Client / Workspace scope、Music Type、Mood、Brand Music、Copyright Notes 与 usage search。

Track detail 显示 source、URL / copyable local path、recommended usage / volume、copyright notes、selected by 与 used-in Contents。Content Detail 中的 `Select Music` 使用 scoped picker，可建立多首 Track relationship并记录 selected by。

Workspace-wide / cross-client Music 仅内部可见。V0.1 不加入 waveform、audio upload、automatic copyright check 或 performance recommendation。

## 17. Editing Playbook

### 17.1 Playbook list and versions

按 Client 显示 Playbooks，例如 Talking Head、Workshop Recap。每个 Playbook 显示 active version、status、last updated 与使用中的 Content 数量。

Playbook Detail 包含 version list，并将 style config 分成可读 sections：

- Typography / subtitles / highlight
- Safe area / cover
- Transition / effects / zoom
- B-roll
- Music / SFX / audio level
- Pacing
- Export specs
- QA notes

### 17.2 Version behavior

- Draft 可以编辑；Active / used version 不原地覆盖。
- `Create New Version` 从当前版本预填，但建立独立 Version。
- `Activate Version` 只向获授权角色显示；confirmation 提示旧 Content 继续关联旧 Version。
- Content Detail 显示实际采用的 style version，不只显示 Playbook 名称。
- V0.1 不实现自动 QA、correct / wrong example analysis 或 template generation。

Playbook 与 cross-client standards 仅内部可见，除非未来建立独立 client-visible published material；Client view 默认无入口。

## 18. Team and User Management

Team navigation 与管理 UI 仅 Super Admin 可见。Internal Manager、Strategist 与其他角色可在 assignment picker 看见当前 Client 已授权的可选人员，但不能进入 User / Role / Access Management。

### 18.1 User list

显示：

- Display name / email
- Active / Deactivated
- Roles
- Assigned Clients
- Joined / last updated

支持 status、Role 与 Client filters。Deactivated users 默认可查，以保证历史 attribution 可解释。

### 18.2 User detail

Super Admin 可以：

- Create / edit user profile
- Assign / remove predefined Roles
- Assign / revoke Client access
- Activate / deactivate user

V0.1 不提供 custom permission designer、organization chart、Client self-registration 或 bulk invitation。Intern 的 access 由 Super Admin 手动分配与撤销；UI 可显示 reminder text，但不假设自动 expiry 已实现。

Deactivate confirmation 必须说明：用户将失去访问，但历史 Content、Revision、Approval、Contribution 与 Activity attribution 保留。不得提供普通 Delete User。

## 19. Client-visible Views

完整 Client Portal 不属于 V0.1 Must Have。本节定义未来 Client-facing view 以及 V0.1 任何 preview / shared surface 都必须遵守的 contract，避免内部 UI 直接暴露给 Client。

### 19.1 Client navigation boundary

Client Admin / Viewer 只看到其 active Client membership 对应的简化 navigation：

- Shared Content
- Pending Client Approval（Client Admin only）
- Shared Publications / Analytics
- Shared Assets / Reports（只有明确共享 items）

不显示 References、Ideas、internal Calendar、Libraries、Team、Settings、Activity Log 或其他 Client selector。

### 19.2 Shared Content view

只显示明确共享的 Content fields：title、approved / client-facing status、Client-visible Notes、shared review media、assigned Client Approval、published links 与 shared Analytics。

默认隐藏：

- Contributor identities
- Staff performance / production efficiency
- Contribution
- Internal / Private Management Notes
- Workflow Events / Activity Log
- Internal Revision discussion
- Approval Evidence
- Local / NAS paths
- Unshared Script / Media Versions / Assets
- Cross-client library 与其他 Clients

Client-facing status 应是受控 projection，不显示内部 workflow event history。Client Viewer 全部只读；Client Admin 只有被指定的 Client Approval action。

### 19.3 Client approval experience

Client Admin 看到清楚的 subject / version、shared media、Client-visible Notes，以及 Approve / Request Revision。Request Revision 只进入 Client review scope。系统不能因 Client role 而显示 internal reviewer comments或 evidence。

所有 Client-facing empty states 必须避免透露“还有其他未共享项目”；只说明当前没有已共享内容或待处理审批。

## 20. Settings

Settings 按权限与 scope 分组，不建立无边界的系统后台：

- **Workspace Profile**：Super Admin。
- **Content Categories / Tags**：授权内部角色；停用而非破坏历史。
- **Platforms**：Super Admin 管理 active / inactive；V0.1 主要为 Facebook / XHS。
- **Contribution Roles**：Super Admin 管理 stable catalog。
- **Client Planning Metadata**：Super Admin / Internal Manager 在其 scope 内维护 Campaign 等基础配置。

Role assignment、User status 与 Client access 仍属于 Team，不在 Settings 重复。V0.1 不显示 Cloudflare、Supabase production、Google API、social API、scraper、billing、notification 或 secret management 页面。

## 21. Mobile Responsive Requirements

V0.1 是 responsive web application，不是 native mobile app。优先保证现场拍摄、快速查看、审批与状态动作可用。

### 21.1 Navigation and layout

- Sidebar 在窄屏收进 menu drawer；保留页面 title、Client context 与 primary action。
- Wide tables 转为 priority-based cards / stacked rows；Filters 使用 full-screen sheet，并持续显示 active count。
- Content Detail tabs 变为横向可滚动 tabs 或 section menu；primary next action 使用 sticky bottom action area，但不能遮挡表单。
- Modal 在 mobile 使用 full-screen action sheet，保留明确 Cancel / Confirm。

### 21.2 Mobile-critical tasks

必须能在 mobile 完成：

- 查看 My Actions / Overdue
- 搜索与过滤 Content
- 打开 Content Detail
- Start / Complete Shooting
- Start Editing / Mark Blocked
- Submit First Cut / Revision link
- Approve / Request Revision（符合权限与 no self-approval）
- Schedule / Mark Published 与粘贴 FB / XHS URL
- Copy / Open Drive link，Copy Local / NAS path
- 查看 Calendar agenda / event detail

大规模 library maintenance、Playbook version editing、User access management 可在 mobile 保持可读或提供基础操作，但首选 desktop。

### 21.3 Input and accessibility

- Touch targets 足够大；关键 action 不只依赖 hover。
- Status、warning 与 visibility 不只依赖颜色，同时使用 text / icon。
- Date / time input 显示 timezone context；避免 mobile browser 自动改变实际时间而无提示。
- Copy actions 提供明确成功反馈。
- 长 form 分组并保持已输入内容；validation 后不要把用户送回页面顶部且丢失 context。

## 22. Empty, Loading and Error States

### 22.1 Empty states

区分三类：

1. **True empty**：系统或 Client 尚无记录。向有权限用户提供单一合理 action，例如 `Create first Content`。
2. **Filtered empty**：有数据但当前 filters 无结果。显示 active filters 与 `Clear filters`，不要诱导重复创建。
3. **Permission-scoped empty**：用户没有被授权的 records。说明没有可访问项目，不透露其他 Clients 或未共享数量。

Library、Idea、Calendar、Analytics Due 与 Revision history 都使用与场景对应的文案，不使用通用 `No data`。

### 22.2 Loading states

- List / Dashboard 使用保持布局稳定的 skeleton，不用全屏 spinner 阻断整个应用。
- Content Detail header 与 sections 可分区加载，但 workflow action 在必要 context 未加载完成前保持 disabled。
- Action submit 显示进行中状态并防止 double submit；完成前不显示虚假 workflow event。
- 从 List 返回 Detail 时保留可用的 cached context，但必须在 stale 数据上清楚提示刷新。

### 22.3 Error states

- Validation error 放在相关字段附近，并在顶部给出简短 summary。
- Network / server error 保留用户输入，提供 Retry，不自动重复产生 event-backed action。
- Permission changed / access revoked 时停止显示受保护数据，说明 access 已变化并返回安全页面。
- Stale status / concurrent update 时显示 current server state，要求用户重新确认 action；不能覆盖最新 workflow。
- External URL 打不开不等于记录不存在；提供 Copy Link 与 edit metadata。
- Local / NAS path 无法由浏览器打开是预期限制，只提供 Copy，不显示系统故障。
- Publication、Analytics 或 Approval save 失败时不得先改变 derived Content summary。
- 404 / archived record 应区分 Not Found、Archived 与 No Access，外部 Client view 不应通过不同文案泄漏记录存在性。

## 23. Open UI Questions

1. Content Detail 在真实 Pilot 中应使用七个 tabs，还是将 Overview、Script 与 Production 合并成较长单页以减少切换？
2. Content table 的默认 columns、column density 与 row height 哪一组最适合 Manager 的日常操作？V0.1 是否需要基础 column show / hide？
3. Month Calendar 之外，Week view 与 Agenda view 哪一个应优先进入 V0.1？
4. Kanban drag 是否在 Pilot 中真正提升效率，还是只保留 view，所有 transition 都从 Content Detail 执行？
5. Manager / Strategist 是否需要安全的 bulk Category / Tag edit；若需要，首版允许哪些非生命周期字段？
6. `Complete Shooting` 在没有 Drive URL / path 时是否允许以 `Location pending` 完成，还是至少一个位置字段必须即时提供？
7. Client-facing preview 是否需要在 V0.1 提供给内部用户验证 sharing boundary，尽管完整 Client Portal 延后？
8. 哪些 Content fields 可被明确标记为 shared：Script body、Hook / CTA、target dates、review status 是否都需要独立 visibility control？
9. Approval Evidence 未来若允许分享，应由谁开启、是否需要在分享前遮罩内部信息？
10. Client Admin 在 future portal 中可否下载 shared review media / final assets，还是只允许 Open external link？
11. Internal、Private Management、Client-visible Notes 是否需要各自独立的 edit history / mention behavior？V0.1 不应在未确认前加入 notification system。
12. Workspace-wide References / Music 的内部 picker 应默认显示全部，还是需用户主动切换 `Include workspace library` 以减少误用？
13. Facebook / XHS Manual Analytics 的首批 platform-specific fields 与单位应由 Analytics research 最终确认。
14. 同一 Platform 多 account 的 picker 是否仅使用 free-text account，还是 Pilot 已需要提前引入 account-level选择与权限？
15. Mobile 首要使用场景是现场 Shooting、Manager approval 还是 Publisher 更新；Pilot 应据此决定 mobile 首页快捷动作排序。
16. 系统统一显示 Asia/Singapore，还是按用户 timezone 显示并同时保留 source timezone？
17. Accessibility target、支持的 desktop / mobile browsers 与最小 screen width 需要在 implementation planning 前确认。
