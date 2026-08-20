# ContentOS V0.1 Product Specification

Status: Draft

本文定义 ContentOS V0.1 的产品范围，不包含 Database Schema、技术架构或实现方案。

文档中的陈述按以下方式理解：

- **Current Fact**：来自 `docs/07-current-workflow.md` 的现状证据。
- **Product Requirement**：ContentOS 应满足的产品能力。
- **V0.x / Future**：不进入 V0.1 Must Have 的后续方向。
- **Open Question**：尚未确认，不应被实现团队自行猜测。

## 1. Product Vision

**Current Fact：** 现有 Marketing Planner 以月历和 Shooting Details 为核心，可记录日期、任务标题、Status、Priority 与 Notes，适合单老板、短周期的 Calendar / Shooting planning / Status 管理。它对当前流程有实际价值，不应被贬低或直接替代其工作习惯。

**Product Requirement：** ContentOS 定位为 **Internal Content / Personal IP Operations System**，不是单纯 Marketing Calendar。它要把以下 Content Lifecycle 串成可追踪的内部运营流程：

```text
Reference
→ Idea
→ Script
→ Shooting
→ Editing
→ Review / Revision
→ Publishing
→ Analytics
→ Reporting
```

ContentOS 的目标是让 Manager 能从一个系统看到内容来源、当前阶段、责任人、文件位置、审核历史、发布日期、表现数据与生产效率。第一阶段主要服务公司内部团队，但核心产品逻辑必须支持多个老板／Client，不能写死为 LKSoft 单一 Client。

平台优先级：

- **Tier 1：** Facebook、小红书
- **Later：** 其他平台按需求扩展

系统不储存大型视频文件。Raw Footage、First Cut、Revision、Final 等继续保存在 Google Drive、Local PC 或 NAS；ContentOS 仅保存 Metadata、Links、Local paths、Status、Contributors、Timestamps、Analytics、Notes 与 Relationships。

## 2. Primary Users

本节只定义 User Types，不定义权限数据库。

### Super Admin

系统最高管理员，管理 Users、Client access、Roles、可配置分类与系统级规则。

### Internal Manager

管理多个 Client、Content、人员、排期、交接、风险与整体进度。

### Strategist / Content Planner

管理 Reference、Idea、Script、内容策略、Campaign、Category、Hook 与 CTA，并推动 Idea 转为正式 Content。

### Shooter

查看和执行被分配的 Shooting 任务，更新拍摄进度、链接、路径与相关 Notes。

### Editor

负责 Editing、First Cut、Revision 与版本提交，记录文件链接、提交时间和返工信息。

### Publisher / Marketing

负责 Scheduling、Publishing、Published URL、基础 Analytics Snapshot 与账号运营相关记录。

### Intern

只参与被分配的基础任务；不因 Intern 身份自动获得所有 Client 或内部管理资料。

### Client Admin

未来供老板／Client 代表使用，查看自己 Client 的 Content、Approval 与 Report。该 User Type 必须被产品概念保留，但 Client Portal 不属于 V0.1 Must Have。

### Client Viewer

未来只读查看被授权的 Client 内容与报告，不可修改内部流程数据。

## 3. Client / Brand Model

**Product Requirement：** V0.1 从第一版支持多个 Client / Brand。即使 Pilot 主要使用 LKSoft，也不得以单 Client 假设设计产品行为。

示例：

- LKSoft
- Restaurant A
- Automotive B
- Beauty C

每个 Client 独立拥有或关联：

- Content
- Ideas
- References
- Brand Guide
- Editing Playbook
- Analytics
- Reports
- Contributors
- Calendar / Tasks

所有内容视图、筛选、链接、Notes 与 Analytics 都必须明确归属 Client。跨 Client 的内部人员可以协作，但 Client 未来看到的资料必须与其他 Client 隔离。

## 4. Reference Library

Reference Library 是标杆案例与学习资料库，不等于正式生产 Content。

### Reference Account

记录优秀老板 IP、Creator 或 Brand Account，至少支持：

- Platform
- Account
- URL
- Industry
- Country
- Content style
- Why it works
- What can be learned
- Suitable clients
- Tags
- Gold Standard
- Notes

### Reference Content

记录单条优秀 Video / Post，至少支持：

- Platform
- Account
- URL
- Industry
- Country
- Content style
- Format
- Why it works
- What can be learned
- Suitable clients
- Tags
- Gold Standard
- Notes

必须支持：

```text
Reference → Convert to Idea
```

转换后保留 Reference 与 Idea 的关系；Reference 本身不得自动进入 Production Lifecycle。

## 5. Idea Bank

Idea 是独立于正式 Content Production 的阶段，用于收集、评估、批准或淘汰内容方向。

每条 Idea 至少记录：

- Idea title
- Original source URL
- Reference
- Original topic
- Original Hook
- Why it works
- Our angle
- Suitable Client
- Content Category
- Suggested Format
- Idea Owner / Creator
- Priority
- Notes

Idea Status：

- New
- Evaluating
- Approved
- Converted
- Archived
- Rejected

必须支持：

```text
Convert Idea → Content
```

转换必须保留原始 Idea、Reference 与 Idea Creator，不得把转换操作视为新的无来源 Content，也不得因后续表现覆盖原始贡献事实。

## 6. Content Categories

Content Category 与 Tags 必须由授权 User 管理，不可把所有类别写死在产品中。

当前已知初始类别至少包括：

- 引流内容
- 老板 IP
- 转化／销售
- 办公室内容
- 产品教育
- 客户案例
- Workshop / Event
- Promotion

Super Admin 应能增加、修改、停用 Category；停用不应破坏历史 Content。Tags 用于补充跨类别主题、风格、场景或 Campaign 特征。

## 7. Content Record

Content 是 ContentOS 的核心对象。每条正式 Content 必须有唯一 Content ID，例如：

`LK-2026-001`

具体编号规则可在 Pilot 确认，但必须保证唯一、稳定且不因标题改变。

每条 Content 至少可记录：

- Client
- Title
- Content Category
- Campaign
- Platform
- Format
- Priority
- Script
- Hook
- CTA
- Publish target
- Owner
- Contributors
- Music
- Editing Style
- Assets
- Drive links
- Local paths
- Published URLs
- Analytics
- Internal Notes
- Client-visible Notes

一条 Content 可以来自一个 Idea，也可以在有明确原因时直接创建。它可以关联多个 Assets、Contributors、Revisions 与 Platform Publications。

## 8. Content Production Lifecycle

Idea Status 与 Production Status 必须分开。正式 Content 使用以下 Production Lifecycle：

```text
Draft / Script
→ Ready to Shoot
→ Shooting
→ Shot / Awaiting Edit
→ Editing
→ First Cut Submitted
→ Internal Review
→ Revision Required
→ Client Review
→ Approved
→ Scheduled
→ Published
→ Analytics Tracking
→ Reviewed / Completed
```

生命周期必须允许审核循环：

```text
Internal Review / Client Review
→ Revision Required
→ Editing
→ First Cut Submitted
→ Review
```

状态不是只能单向前进。系统应保留关键状态变化历史，并允许在有权限与原因的情况下纠正错误状态。V0.1 不要求复杂 Workflow Builder，但状态名称与基本转移必须一致。

Client Review 对没有外部 Client 审核的内部 Content 可以按明确规则跳过；跳过规则属于 Pilot 决策，不得静默假设。

## 9. Automatic Timeline / Production Events

当 User 改变关键状态或执行关键动作时，系统应自动记录 timestamp，不应要求员工手动填写全部时间。

至少包括：

- `content_created_at`
- `script_ready_at`
- `shooting_started_at`
- `shot_completed_at`
- `editing_started_at`
- `first_cut_submitted_at`
- `internal_review_started_at`
- `internal_approved_at`
- `client_review_started_at`
- `client_approved_at`
- `scheduled_at`
- `published_at`

时间记录应来自真实动作／状态事件，并保留历史；重新进入某阶段时不得简单覆盖所有先前事件。后续 Production Efficiency 以这些事件计算，不依赖员工事后回忆。

## 10. Contributors

一条 Content 可以有多个 Contributor，同一 Role 也允许多人共同参与。

贡献角色至少包括：

- Idea Creator
- Strategist
- Script Writer
- Shooter
- On-camera Talent
- Editor
- Reviewer
- Cover Designer
- Publisher
- Analytics / Strategy Review
- Client Communication

系统记录实际参与事实，并保留历史人员，即使 User 后续被 Deactivate。

V0.1 不自动计算 Profit Sharing，但贡献数据必须能支持未来 Contribution Analysis 与 Profit Sharing。

重要原则：

> **Content Performance ≠ Contributor Performance**

Views、Likes 或 Leads 不能被直接当作单一员工贡献评分；表现结果受到选题、账号、平台、投放、出镜、时机与多角色协作影响。
## 11. Production Efficiency

系统应根据 Timeline 自动计算或提供计算基础：

- Shoot → Editing Start
- Shoot → First Cut
- First Cut → Internal Approval
- Client Review Time
- Content Created → Published
- Revision Count
- On-time Delivery
- Average Cycle Time

未来分析维度：

- User
- Client
- Content Type
- Month

未来可配置 SLA，例如：

- Normal Talking Head：First Cut target = 24h
- Complex Content：First Cut target = 48h

**V0.1 边界：** 必须可靠记录事件与基础周期；复杂 SLA Engine、个人绩效评分和高级效率 Dashboard 不属于 V0.1 Must Have。

## 12. Revision Tracking

Revision 不可覆盖历史。每次 First Cut 或 Revision 至少记录：

- Version
- First Cut / Revision link
- Submitted by
- Submitted at
- Reviewer
- Revision reason
- Notes

Revision Reason 应支持分类：

- Subtitle
- Editing pace
- Hook
- Visual
- Brand style
- Information error
- Client request
- Audio
- Other

每次提交形成独立版本。Current Version 可以指向最新有效版本，但旧链接、提交人、时间、原因与 Notes 必须保留，以支持返工分析与争议追溯。

## 13. Asset Library

ContentOS 不储存大型原始素材；Asset Library 只做索引。

Asset 至少记录：

- Asset name
- Client
- File name
- Type
- Orientation
- Shoot date
- Local PC path
- NAS path
- Google Drive URL
- Tags
- Reusable
- Used in Content

路径示例：

`D:\Content Library\LKSoft\2026\08\Showroom\DJI_0182.MP4`

必须支持：

```text
Content ↔ Multiple Assets
```

同一 Asset 可以被多个 Content 使用，并保留使用关系。V0.1 首先实现查找与关联索引；常用素材、未使用素材和重复使用风险属于后续分析。

## 14. File / Drive Linking

每条 Content 可以保存：

- Project Drive Folder
- Raw Footage
- First Cut V1
- Revision versions
- Final Video

系统只保存链接或路径，不上传、转码或托管大型影片。

V0.1 UI 需要提供：

- Open Link
- Copy Link
- Copy Local Path

普通 Web Browser 无法可靠直接打开 Windows 本地路径，因此 V0.1 不要求 “Open Windows Folder”。本地路径必须作为可复制的 Metadata 保存，不应伪装成必然可点击的网页链接。

## 15. Editing Playbook

每个 Client 可以拥有自己的 Editing Playbook，并支持 Editing Style Version，例如：

`LKSoft Talking Head V1`

Playbook 至少覆盖：

- Font
- Font size
- Subtitle style
- Highlight style
- Safe area
- Transition
- Effects
- Zoom
- B-roll usage
- Music rules
- SFX
- Audio level
- Video pacing
- Cover style
- Export specs

后续可扩展：

- Correct examples
- Wrong examples
- Gold Standard
- QA Checklist

V0.1 必须能建立基础 Playbook、标记版本并将 Content 关联到所使用的 Editing Style；复杂 QA 自动化不在首版范围。

## 16. Music Library

Music 是可复用 Content Metadata，不是系统托管的音频文件。

至少记录：

- Track name
- Source
- URL / Local path
- Music type
- Mood
- Recommended usage
- Recommended volume
- Brand music
- Copyright / platform notes
- Selected by
- Used in Contents

Music Type 初始可包括：

- Business
- Light
- Emotional
- Funny
- Tension
- Vlog
- No Music

Music Type 应可扩展。未来可以研究音乐与 Content Performance 的关系，但 V0.1 只要求基础资料、选择人和使用关系。

## 17. Calendar

V0.1 需要 ContentOS 自己的基础 Calendar View，可显示：

- Shooting
- First Cut Deadline
- Review
- Publish
- Meeting
- Workshop / Event

Calendar 应来自同一 Content / Event 记录，避免像现有 Planner 一样依靠人工在详情与月历双写。

Google Calendar integration 属于 V0.x。产品必须预留概念关系：

```text
Content / Meeting ↔ Google Calendar Event
```

V0.1 不接 Google Calendar API，也不把 Google Calendar 是否已日常采用写成 Current Fact。

## 18. Meetings

Meeting 产品概念可以关联：

- Client
- Campaign
- Contents
- Calendar event
- Meeting Notes
- Decisions
- Action Items

Meeting 可以产生 Tasks / Content Actions，长期目标是减少开会时在多个系统之间切换。

**V0.1 边界：** Meeting 不是核心生命周期验收的 Must Have。若核心范围完成后仍有容量，可提供基础记录；复杂自动化、转录与自动生成任务归入 V0.x / Future。

## 19. Content Filters

系统必须有强 Filter，至少支持：

- Client
- Content Category
- Status
- Platform
- Contributor
- Editor
- Shooter
- Campaign
- Date
- Priority
- Format

组合示例：

```text
LKSoft + 老板 IP + Shot / Awaiting Edit
```

```text
Editor A + Internal Review
```

V0.1 必须支持多条件组合与清除筛选。Saved Views 属于 V0.x，不进入 V0.1 Must Have。

## 20. Analytics

Tier 1 平台为 Facebook 与小红书。每条 Published Content 可以关联多个 Platform Publication，因为同一内容可能在不同平台或账号发布。

Analytics 使用 Snapshot 模型，例如：

- 24 Hours
- 7 Days
- 30 Days
- Current

核心通用指标包括：

- Views / Reads
- Reach
- Likes / Reactions
- Comments
- Shares
- Saves
- Watch data
- Followers gained
- Leads

不同平台允许不同指标，不要求所有指标强行一致。每次数据记录必须标明：

- Snapshot time / period
- Platform Publication
- Captured at
- Data Source
- Entered by

Data Source：

- Manual
- CSV
- Scraper
- API
- Client Backend

**V0.1：** Manual entry 优先。CSV、Scraper、API 与自动 Tracking 均不属于 V0.1 Must Have。
## 21. Xiaohongshu Tracking Strategy

**V0.1：**

- 保存 XHS Note URL。
- 为每个 XHS Publication 人工录入 Analytics Snapshot。
- 清楚标记 Manual 或 Client Backend 来源。

**V0.x Research：** 研究 Public Tracker / Scraper，但公开数据与 Client Private Analytics 必须分开。

Public data 可包括：

- Likes
- Comments
- Saves
- Public engagement

Private data 可包括：

- Follower growth
- Audience
- Follower sources
- Account analytics

Private Data 不得假设可以公开抓取，也不得用未授权会话绕过平台限制。

## 22. Facebook Tracking Strategy

**V0.1：**

- 保存 Facebook Post / Reel URL。
- 人工录入核心 Performance Snapshot。
- 保留 Manual fallback。

**V0.x Research：**

- Owned Page 优先研究官方 API。
- Public Tracking 可以研究合规的公开技术。
- 不得以老板主账号 Cookie 作为核心或唯一方案。
- 任何 Scraper 都必须允许停用，并保留 Manual fallback。

## 23. Analytics Benchmarking

不同平台不得直接硬比较绝对数字。

基准原则：

- Facebook Content 与相同 Facebook Account 的历史／同期 Average 比较。
- XHS Content 与相同 XHS Account 的历史／同期 Average 比较。
- Client、Platform、Account、内容类型与时间窗口应保持可解释。

未来可显示：

- Top 10%
- Above Average
- Average
- Below Average

**V0.1 边界：** 保存足够的 Publication 与 Snapshot 数据；自动分位数和高级 Benchmark UI 属于 V0.x。

## 24. Reports

未来至少支持：

### Internal Weekly Report

- Production progress
- Delays
- Workload
- Upcoming shoots

### Client Monthly Report

- Published content
- Views / engagement
- Followers
- Top Content
- Key Findings
- Next Month Strategy

### Campaign Report

**V0.1 边界：** 不要求复杂 PDF generation 或完整 Report Builder；V0.1 的 Content、Timeline、Contributor、Publication 与 Analytics 数据必须足以支持后续报告。基础屏幕汇总可由 Dashboard 承担。

## 25. User Management

V0.1 的 Super Admin 必须能够在 UI：

- Create User
- Edit User
- Activate User
- Deactivate User
- Assign Client
- Assign Role

User 离开团队以后使用 **Deactivate**，不得 Delete。历史 Content、Activity、Revision 与 Contribution 必须继续显示原参与人。

V0.1 只要求基础 User Management；复杂组织架构、自定义权限设计器与 Client 自助注册不在范围内。

## 26. Activity Log

系统需要保留关键操作历史，至少包括：

- Created Content
- Changed Status
- Assigned User
- Submitted First Cut
- Requested Revision
- Approved
- Published
- Updated Analytics

每项 Activity 应能回答：谁、何时、对哪个 Client / Content、做了什么，以及必要时从什么值改为什么值。

Activity Log 用于：

- Audit
- Efficiency
- Contribution
- Dispute resolution

V0.1 必须有基础 Activity Log 与 Content 级查看能力；高级审计搜索和导出可后续增加。

## 27. Internal vs Client Visibility

未来 Client Portal 必须与内部资料隔离。Content Notes 至少在产品概念上区分：

- Internal Notes
- Client-visible Notes

Client 不应该看到：

- Internal staff comments
- Internal contribution
- Financial allocation
- Staff performance
- Private management notes

V0.1 即使尚未开放 Client Portal，也必须在产品要求中保留这条边界，避免未来把所有 Notes 当成可对外显示。V0.1 不要求完整 Client Portal UI。

## 28. Dashboard

V0.1 Dashboard 的目标是让 Manager 打开系统后立即知道：

> **What needs attention?**

至少概念上包含：

- Ready to Shoot
- Shot / Awaiting Edit
- Editing
- First Cut Review
- Overdue
- Scheduled
- Published This Month
- Analytics Due
- Upcoming Calendar Events

Dashboard 应以可行动队列、数量和直接进入 Filtered List 为主。不得为了视觉效果加入与决策无关的 Chart。高级效率、工作量和趋势分析属于 V0.x。

## 29. V0.1 Scope

以下为 V0.1 **MUST HAVE**，共同构成首版验收边界。

### Access and organization

- Authentication
- Basic User Management：Create、Edit、Activate、Deactivate、Assign Client、Assign Role
- Multi-Client / Brand 基础管理
- Internal role-aware access 基础边界
- Internal Notes 与 Client-visible Notes 概念分离

### Content lifecycle

- Reference Library basic
- Reference → Idea
- Idea Bank 与 Idea Status
- Idea → Content，并保留来源与 Contributor
- 唯一 Content ID
- Content Record
- Production Status 与 Review / Revision 循环
- Owner 与多 Contributor
- Automatic Timeline / Production Events
- Revision history 与 reason
- Drive / URL / Local / NAS path linking
- Asset index basic
- Calendar basic
- Strong Filters

### Standards and reusable metadata

- User-manageable Content Category / Tags basic
- Editing Playbook basic，包含 Style Version
- Music Library basic
- Client、Campaign、Platform、Format、Priority 等核心 Metadata

### Publishing and learning

- 多 Platform Publication
- Facebook / XHS Published URL
- Manual Analytics Snapshot
- Data Source 标记
- Activity Log basic
- Dashboard basic，以 attention queues 为主

### V0.1 explicit limits

- Google Calendar API integration 不在 V0.1。
- 自动 Scraper / API Analytics 不在 V0.1。
- Client Portal 不在 V0.1。
- 复杂 Reports / PDF generation 不在 V0.1。
- 高级 SLA、Workload 与 Efficiency Dashboard 不在 V0.1。
- Meetings 不是核心验收项；如实现，仅限基础记录。
- 不包含大型媒体上传、托管或转码。

## 30. V0.x / Near-term

核心生命周期稳定后，较快增加：

- Saved Views
- Advanced Efficiency Dashboard
- Google Calendar integration
- Better Reports
- Workload visibility
- SLA configuration / monitoring
- Client Portal
- CSV Analytics import
- Facebook public tracking research
- Xiaohongshu public tracking research
- Basic Meeting records and Meeting → Action workflows（若未在 V0.1 实现）
- 更完整的 Asset usage 与 Benchmark analysis

V0.x 项目必须基于 Pilot 数据与实际瓶颈排优先级，不因本 Spec 出现就自动进入 V0.1。
## 31. Future

以下明确归类为 Future，不进入 V0.1：

- AI script generation
- AI performance analysis
- AI recommendation
- Automated monthly strategy
- Automated Profit Sharing
- Billing
- Client self-registration
- Full SaaS
- Mobile native app
- Full social publishing
- Heavy media storage
- Complex notifications

Future Idea 只有在业务验证、数据质量、权限与成本边界清楚后才进入后续 Product Definition。

## 32. Non-Goals

V0.1 明确不做：

- Video hosting
- Video editing
- Replace Google Drive
- Replace CapCut / Jianying
- Full Social Media Publishing Platform
- Accounting system
- Payroll system

ContentOS 管理 Content Operations 的 Metadata、状态、责任与证据，不替代专业剪辑工具、文件存储系统或财务／人事系统。

## 33. Success Criteria

V0.1 成功标准不是功能数量，而是能以真实内部内容跑通：

```text
Reference
→ Idea
→ Convert to Content
→ Script
→ Assign Shooter
→ Shoot
→ Assign Editor
→ First Cut
→ Review / Revision
→ Approved
→ Published
→ Add FB/XHS Link
→ Record Analytics
```

流程完成时必须能验证：

- Reference、Idea 与 Content 的来源关系仍可追踪。
- Content ID 唯一且稳定。
- Shooter、Editor、Reviewer、Publisher 与其他实际 Contributor 可见。
- 关键状态改变自动留下 Timeline / Activity。
- Revision 历史没有被覆盖。
- Drive / Local / NAS links 或 paths 可找到。
- Facebook / XHS Publication 与 Manual Analytics Snapshot 可记录。
- Manager 可以 Filter。
- Manager 可以看到当前进度。
- Manager 可以看到谁负责。
- Manager 可以看到 Overdue Content。
- Manager 可以看到 Production Timeline。
- Dashboard 能把需要处理的内容带到可行动列表。
- 多 Client 数据不会被写死为 LKSoft 单一逻辑。

## 34. Open Questions

以下问题来自 `docs/07-current-workflow.md`。并非所有问题都会阻塞 Product Spec；只有影响 V0.1 核心行为、状态语义或访问边界的问题列为 Blocking。

### Resolved — Workflow Decisions

1. **[Resolved][CW-02] 状态维护责任：** 完成 Workflow Action 的人记录动作；Manager / Super Admin 可修正错误。Priority、Deadline 与 Assignment 主要由 Manager / Strategist 管理。关键动作自动产生 timestamp 与 Activity Log。
2. **[Resolved][CW-05] 日期语义：** 不使用单一 Content Date。Created、Due、Scheduled、Started、Completed、Approved 与 Actual Published 在 Workflow 概念上分别记录，Calendar 按 Event Type 展示。
3. **[Resolved][CW-08] 审核权：** Approval 不写死为固定人员。不同 Client / Content 可决定 Topic、Script、Internal Video、Client 与 Final Approval 是否 Required，并指定 Assigned Reviewer。
4. **[Resolved][CW-09] Publishing 责任：** Content 与 Publication 分离；每个平台 Publication 独立分配 Publisher、schedule、published time、URL、status 与 Analytics。
5. **[Resolved][CW-11] Source of truth：** ContentOS 是 Workflow 与管理 Metadata 的 Source of Truth；Google Drive 是 media files 的 Source of Truth；Google Calendar 是 schedule visualization / reminder layer。
6. **[Resolved][CW-16] Review 完成定义：** Approval 必须是明确 Event，并记录 Approved subject / version、Approver、Approved at 与 Notes。系统外 Approval 使用 Record External Approval 留存证据。

以上 6 项已在 `docs/03-workflow.md` 正式定义，不再阻塞后续设计。

### Can Be Decided During Pilot

1. **[CW-01] Planner 采用程度：** 当前 Marketing Planner 已真实投入日常使用，还是模板／试排？
2. **[CW-03] 日期差异：** `Shooting Details` 的 2026-09-02 与月历 9 月 3 日以哪个为准？
3. **[CW-04] 月历同步：** 为什么详情表已有 6 个具名选题而月历只显示 2 个？
4. **[CW-06] 提前制作规则：** 正式规则是提前 1 周还是滚动准备后续 2 周？
5. **[CW-07] 内容量：** “9 月每周 3 条”是全部内容还是老板 IP；新增内容如何计入现有剪辑产能？
6. **[CW-10] 账号状态：** 老板个人账号是否已开始发布？当前实际运营哪些平台与账号？
7. **[CW-12] 共享群：** 内容共享群是否已建立，使用 WhatsApp 还是其他平台，需要同步哪些固定信息？
8. **[CW-13] 人员身份：** Jayden 与阿辉是否为同一人？在确认前必须作为未确认事实处理。
9. **[CW-14] Editor 边界：** 专职 Editor 的职责、可接受产能与交付标准是什么？
10. **[CW-15] Playbook 现状：** 是否已有正式拍摄 SOP、字幕模板、剪辑标准或 Editing Playbook，存放在哪里？
11. **[CW-17] 未发布处理：** 已剪辑但因政策／平台变化未发布的内容，如何记录原因与后续动作？
12. **[CW-18] Drive 规范：** Google Drive 的脚本、原始素材、成片和样本是否已有统一目录、命名与权限规则？
13. **[CW-19] Planner 跳转：** “日历／任务详情”链接与实际工作表名称不同，在 Excel 或 Google Sheets 是否有效？

这些问题可在 LKSoft Pilot 中通过真实操作决定，不应因为尚未全部回答而阻塞 V0.1 Product Definition。
