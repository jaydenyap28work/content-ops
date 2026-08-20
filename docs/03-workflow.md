# ContentOS Workflow & State Machine

Status: Draft

本文定义 ContentOS V0.1 的业务 Workflow、State、Action、Event 与责任边界，不定义 Database Schema 或技术实现。它是 Product Requirement，不代表 `docs/07-current-workflow.md` 所记录的流程已经投入日常使用。

## 1. Workflow Principles

1. **Event-driven workflow**：状态变化必须由明确业务动作触发；不得仅凭字段被编辑就推断 Shooting、Approval 或 Publishing 已发生。
2. **Role-based actions**：完成动作的人记录该动作。Shooter 记录拍摄，Editor 提交版本，Reviewer 审核，Publisher 管理 Publication。
3. **Automatic timestamps**：关键 Action 自动产生 Business Event 与 timestamp，避免员工重复手填实际发生时间。
4. **Activity Log**：关键 Action、Assignment、Override、Approval、Revision 与 Publication 变化必须留下 Actor、时间与上下文。
5. **Revision-safe history**：First Cut 与每次 Revision 都是独立版本，历史不可覆盖。
6. **Multi-platform publishing**：Content 与 Publication 分离；Facebook 已发布不代表小红书已发布。
7. **Clear source-of-truth**：
   - ContentOS：Workflow、Status、Assignment、Responsibility、Timestamp、Approval、Contributor、Analytics 与管理 Metadata。
   - Google Drive：Raw Footage、Assets、First Cut、Revision 与 Final media files。
   - Google Calendar：Schedule visualization、Meeting 与 Reminder layer；未来由 ContentOS 向 Calendar 同步。
8. **Correction without erasure**：Manager / Super Admin 可以纠正错误状态，但必须说明原因并进入 Activity Log；纠正不得删除原 Event。
9. **Schedule is not status**：Deadline、预约与 Calendar Event 不等于动作已经完成。
10. **Derived state is explainable**：Content-level Publication Summary 必须能由关联 Publications 的状态解释，不使用单一 `Published = true/false`。

## 2. Reference Lifecycle

Reference 状态：

| State | 定义 | 常见动作 | 常见执行者 | Terminal |
| --- | --- | --- | --- | --- |
| Active | 可搜索、评估、关联或转换为 Idea 的有效 Reference。 | Convert to Idea、Edit Metadata、Archive | Strategist / Content Planner、Manager | No |
| Archived | 不再用于日常推荐，但保留来源、Notes、关系与历史。 | Restore to Active | Strategist / Content Planner、Manager | Normal-flow terminal；可受控恢复 |

规则：

- `Convert to Idea` 创建 Idea 并保留 Reference → Idea 关系。
- Convert 不删除、不归档也不修改 Reference 的来源事实。
- 同一 Reference 可以产生多个不同 Client / angle 的 Ideas。
- Archive 是可见性与使用状态，不是删除。

## 3. Idea Lifecycle

| State | 代表含义 | 通常可执行者 | Allowed next states | Terminal / Non-terminal |
| --- | --- | --- | --- | --- |
| New | 新收集、尚未正式评估的 Idea。 | Idea Creator、Strategist | Evaluating、Rejected、Archived | Non-terminal |
| Evaluating | 正在评估 Client fit、angle、format、timing 与可执行性。 | Strategist、Manager | Approved、Rejected、New、Archived | Non-terminal |
| Approved | 已批准进入内容规划，但尚未创建正式 Content。 | Strategist、Manager、Assigned Approver | Converted、Evaluating、Archived | Non-terminal |
| Converted | 已由该 Idea 建立正式 Content。 | Strategist、Manager | 正常流程无下一状态 | Terminal outcome |
| Rejected | 经评估不采用；必须保留原因与原 Contributor。 | Strategist、Manager、Assigned Approver | 正常流程无下一状态 | Terminal outcome |
| Archived | 暂不继续或失去时效，但不表示质量否定。 | Strategist、Manager | Restore to New / Evaluating | Normal-flow terminal；可受控恢复 |

关键 Action：

- **Start Evaluation**：New → Evaluating。
- **Approve Idea**：Evaluating → Approved。
- **Reject Idea**：New / Evaluating → Rejected，并记录 reason。
- **Convert Idea to Content**：Approved → Converted，同时创建 Content。
- **Archive Idea**：New / Evaluating / Approved → Archived。
- **Reopen / Restore**：Manager 对 Rejected / Archived 的受控纠正，必须进入 Activity Log。

Converted 后必须永久保留：

- Original Idea
- Original Reference（如有）
- Idea Creator / Contributors
- Conversion actor 与时间
- Created Content relationship

Terminal 表示正常业务流程不再推进，不表示记录可被删除。

## 4. Content Production Lifecycle

### 4.1 Core production states

```text
Draft / Script
→ Ready to Shoot
→ Shooting
→ Shot / Awaiting Edit
→ Editing
→ First Cut Submitted
→ Internal Review
→ Revision Required
↘ Client Review（如需要）
→ Approved
→ Ready / Scheduled for Publishing
→ Publication Summary: Not Published / Partially Published / Fully Published
→ Analytics Tracking
→ Reviewed / Completed
```

核心定义：

| State | 定义 |
| --- | --- |
| Draft / Script | 正式 Content 已建立，正在准备或修改 Script、Hook、CTA 与 Production brief。 |
| Ready to Shoot | 必要 Script / Topic Approval 已满足，拍摄资料与 Assignment 已准备好。 |
| Shooting | Shooter 已明确开始执行拍摄。 |
| Shot / Awaiting Edit | 拍摄已完成，素材位置已记录，等待 Editor 开始。 |
| Editing | 正在制作 First Cut 或 Revision。 |
| First Cut Submitted | First Cut V1 已作为不可覆盖版本提交，等待内部审核。 |
| Internal Review | 已进入 Internal Video Review；可能正在等待或进行审核。 |
| Revision Required | Reviewer 已明确提出 Revision，并记录原因与回到哪个 Review stage。 |
| Client Review | 该 Content 要求 Client Approval，已送交 Assigned Reviewer / Client contact。 |
| Approved | 所有适用的 Topic、Script、Internal Video、Client 与 Final Approval Requirement 已满足或明确标记为 Not Required。 |
| Ready / Scheduled for Publishing | Content 已 Approved；相关 Publications 正在建立、排程或等待发布。具体 Schedule 属于 Publication。 |
| Analytics Tracking | 至少一个 Publication 已发布，并正在收集所需 Snapshot；Publication Summary 仍独立显示。 |
| Reviewed / Completed | 所需 Publications 已处理，必要 Analytics / Strategy Review 已完成，并由授权人员明确关闭。 |

### 4.2 Publication-derived content status

Content 与 Publication 是不同对象。Content-level Publication Summary 只由“纳入本次发布计划的 Active / Required Publications”汇总：

- **Not Published**：尚无目标 Publication 为 Published。
- **Partially Published**：至少一个目标 Publication 已 Published，但仍有其他目标 Publication 未 Published。
- **Fully Published**：至少有一个目标 Publication，且所有目标 Publications 均为 Published；被明确取消或 Archived 的 Publication 是否仍算 Required，必须由授权人员明确处理。
- **Needs Attention**：任何 Required Publication 为 Failed / Needs Attention 时显示附加警示；它不把 Content 自动算作 Fully Published。

因此，Content 可以同时显示：

`Analytics Tracking · Partially Published`

当 Facebook 已发布而小红书仍 Scheduled 时，不得显示 Fully Published。Content 的 Reviewed / Completed 也不应仅由单个平台发布自动触发。

## 5. Allowed State Transitions

以下只定义业务 Action 与 Event，不定义 Database column。

| Current State | Action | Next State | Typical Actor | Automatic Event / Timestamp |
| --- | --- | --- | --- | --- |
| — | Create Content | Draft / Script | Strategist、Manager | Content Created / `content_created_at` |
| Draft / Script | Mark Script Ready | Ready to Shoot | Script Writer、Strategist、Assigned Approver | Script Ready / `script_ready_at` |
| Ready to Shoot | Start Shooting | Shooting | Assigned Shooter | Shoot Started / `shooting_started_at` |
| Shooting | Complete Shooting | Shot / Awaiting Edit | Assigned Shooter | Shoot Completed / `shooting_completed_at` |
| Shot / Awaiting Edit | Start Editing | Editing | Assigned Editor | Editing Started / `editing_started_at` |
| Editing | Submit First Cut | First Cut Submitted | Assigned Editor | First Cut Submitted / `first_cut_submitted_at`; create V1 |
| First Cut Submitted | Send / Start Internal Review | Internal Review | Reviewer、Manager | Internal Review Started / `internal_review_started_at` |
| Internal Review | Request Revision | Revision Required | Assigned Reviewer | Revision Requested / `revision_requested_at` |
| Revision Required | Start Revision | Editing | Assigned Editor | Revision Started / Activity Log |
| Editing | Submit Revision | Internal Review or Client Review that requested it | Assigned Editor | Revision Submitted / `revision_submitted_at`; create next version |
| Internal Review | Approve Internal Video | Client Review or Approved | Assigned Reviewer | Internal Approved / `internal_approved_at` |
| Internal Review | Send to Client Review | Client Review | Manager、Assigned Reviewer | Client Review Started / `client_review_started_at` |
| Client Review | Request Revision | Revision Required | Assigned Client Reviewer / authorized recorder | Revision Requested / `revision_requested_at` |
| Client Review | Approve | Approved or Final Approval checkpoint | Assigned Reviewer | Client Approved / `client_approved_at` |
| Any required Approval stage | Record External Approval | Next applicable checkpoint / Approved | Authorized Reviewer、Manager | External Approval Recorded / approval timestamp |
| Approved | Prepare Publications | Ready / Scheduled for Publishing | Publisher、Manager | Publication plan Activity |
| Ready / Scheduled for Publishing | Schedule Publication | Same content stage; Publication becomes Scheduled | Assigned Publisher | Publication Scheduled / `scheduled_at` |
| Ready / Scheduled for Publishing | Mark Publication Published | Derived Partially / Fully Published; Analytics may start | Assigned Publisher | Publication Published / `published_at` |
| Partially Published | Publish remaining Publication | Partially or Fully Published | Assigned Publisher | Publication Published / platform timestamp |
| Fully Published / Analytics Tracking | Complete Strategy Review | Reviewed / Completed | Analytics / Strategy Reviewer、Manager | Content Reviewed / Completed |
| Reviewed / Completed | Reopen Content | Appropriate prior stage | Manager / Super Admin | Content Reopened; reason required |
| Any non-terminal state | Cancel Content | Content Cancelled | Manager / Super Admin | Content Cancelled; reason required |

Transition rules：

- `Internal Review → Approved` 只在 Client Approval 与其他后续 Approval 均为 Not Required 或已满足时成立。
- Revision 提交后必须回到发出 Revision Request 的 Review stage；不得自动判定 Approved。
- Manager / Super Admin Override 可以修正错误状态，但必须记录 before、after、reason、actor 与 time。
- Priority、Deadline、Assignment 的变更不应伪装成 Production State transition，但必须进入 Activity Log。
## 6. Revision Loop

Revision 的最小业务循环：

```text
First Cut V1
→ Internal Review
→ Revision Request
→ Editing
→ Revision V2
→ Internal Review
→ Approved
```

如果 Client Review 要求修改：

```text
Client Review
→ Client Revision Request
→ Editing
→ Revision V3
→ Client Review
→ Client Approved
```

规则：

- 每次 First Cut / Revision 产生新 Version；V1、V2、V3 不可覆盖。
- Revision Request 必须记录 Reviewer、requested at、reason category、Notes 与所审核版本。
- Revision 必须记录 Submitted by、Submitted at、link / path 与回到 Internal 还是 Client Review。
- **Internal Revision**：由内部 Reviewer 提出，回到 Internal Review。
- **Client Revision**：由 Client Reviewer 提出，回到 Client Review；如内部规则要求，送 Client 前可先经过 Internal Review。
- Approved 必须指向明确 Approved Version；后续新 Revision 不得沿用旧版本的 Approval。
- Revision Count 从 Revision Events 推导，不由员工手填累计数。

## 7. Approval Workflow

Approval stage 至少包括：

- Topic Approval
- Script Approval
- Internal Video Approval
- Client Approval
- Final Approval

不同 Client / Content 可以有不同 Approval Requirement。V0.1 不要求复杂 Approval Configuration UI，但每个适用阶段必须能表达：

- Approval Required = Yes / No
- Assigned Reviewer
- Version / subject being reviewed
- Review Result：Approved / Revision Required

### Approve

Reviewer 对明确 Topic、Script 或 Version 执行 Approve。系统记录 Approver、Approved at、Notes 与 Approved subject / version，然后判断下一适用 checkpoint；不得直接跳过仍 Required 的 Approval。

### Request Revision

Reviewer 对当前 subject / version 提出修改，记录 Revision Reason 与 Notes，并把 Content 送入 Revision loop。Request Revision 本身不是修改后的新版本。

### Record External Approval

当 Approval 发生在 WhatsApp、Face-to-face 或 Call 等系统外渠道，授权人员可以记录 External Approval，必须包含：

- Approver
- Recorded by
- Approval timestamp
- Channel
- Notes
- Optional evidence / link
- Approved topic / script / version

Recorded by 不等于 Approver。系统不得仅凭状态改为 Approved 来推断已取得 Approval。

### Approval completion

Content 只有在所有 Required Approval checkpoints 已 Approved，且其他 checkpoint 明确为 Not Required 时，才进入 Approved。Revision 后，受影响版本的旧 Approval 不自动覆盖新版本。

## 8. Publishing Workflow

### 8.1 Content → Publications

一条 Content 可以拥有多个独立 Publication，例如 Facebook、XHS、Instagram、TikTok 或 YouTube。V0.1 Tier 1 为 Facebook 与 XHS，但 Workflow 不写死只允许两个平台。

每个 Publication 独立拥有：

- Platform
- Assigned Publisher
- Scheduled time
- Published time
- Published URL
- Publication status
- Analytics
- 与 Content 的关系

### 8.2 Publication states

| State | 定义 | Allowed actions |
| --- | --- | --- |
| Draft | 已建立目标平台 Publication，但未排程。 | Assign Publisher、Schedule、Archive |
| Scheduled | 已有目标发布时间，尚未确认实际发布。 | Reschedule、Mark Published、Mark Failed、Archive |
| Published | 已明确发布，并记录 actual time 与 URL。 | Add Analytics、Correct Metadata、Archive |
| Failed / Needs Attention | 发布失败、链接失效或需要人工处理；必须记录原因。 | Retry / Reschedule、Mark Published、Archive |
| Archived | 该 Publication 不再执行或仅保留历史。 | Restore by authorized user |

这是满足 V0.1 的最小状态集，不增加复杂 Social Publishing Engine。

### 8.3 Content derived publication summary

- **Not Published**：0 个 Required Publication 为 Published。
- **Partially Published**：部分但非全部 Required Publications 为 Published。
- **Fully Published**：全部 Required Publications 为 Published，且至少有 1 个。
- Failed / Needs Attention 使 Content 显示警示，但不等于 Published。
- Archived 只有在授权人员明确它不再属于 Required publication plan 后，才不影响 Fully Published 判断。
- 新增一个 Required Publication 后，原本 Fully Published 的 Content 可以重新派生为 Partially Published；该变化必须可解释并进入 Activity Log。

## 9. Analytics Lifecycle

每个 Published Publication 独立进入 Analytics Tracking：

```text
Published Publication
→ 24h Snapshot
→ 7d Snapshot
→ 30d Snapshot
→ Current Snapshot（按需更新）
→ Strategy Review
```

V0.1：

- 以 Manual entry 为优先。
- Snapshot 必须关联具体 Publication、统计窗口、captured at、entered by 与 Data Source。
- 同一 Content 的 Facebook 与 XHS Analytics 不混为一组。
- 缺少某平台不适用的指标不视为错误。
- 更正 Snapshot 时保留 Activity Log；不得静默覆盖来源与时间。

Data Source：

- Manual
- CSV
- Scraper
- API
- Client Backend

CSV、Scraper、API 是 V0.x / Future 来源，列入 Workflow 兼容范围不代表 V0.1 要实现自动导入或 Tracking。

## 10. Calendar Events

Calendar 是 Schedule View，不是 Production Status。事件日期不得被当作动作已完成的证据。

V0.1 Event Type：

| Event Type | 代表什么 | 典型关联 |
| --- | --- | --- |
| Shooting | 计划拍摄时间。 | Content、Shooter、Client |
| First Cut Due | First Cut 交付期限。 | Content、Editor |
| Review Due | Internal / Client Review 截止时间。 | Content、Reviewer |
| Publishing | 某个 Publication 的 scheduled time。 | Publication、Publisher、Platform |
| Meeting | 计划会议。 | Client、Campaign、Contents |
| Workshop / Event | 线下或线上活动安排。 | Client、Campaign、Content opportunities |

Date Model 必须区分：

- Content Created
- Script Due
- Script Ready
- Shoot Scheduled
- Shoot Started
- Shoot Completed
- Editing Started
- First Cut Due
- First Cut Submitted
- Review Due
- Review Started
- Approved
- Scheduled Publish
- Actual Published

Scheduled date 可 Reschedule，并记录旧值、新值、actor 与 reason。Actual timestamp 只由真实 workflow action 或明确的外部记录产生。
## 11. Responsibility Rules

基本原则：

> **The person completing the workflow action records the action.**

| Action family | Typical actor |
| --- | --- |
| Start / Complete Shooting | Assigned Shooter |
| Start Editing / Submit First Cut / Submit Revision | Assigned Editor |
| Start Review / Approve / Request Revision | Assigned Reviewer |
| Schedule / Mark Published / Publication failure handling | Assigned Publisher |
| Priority / Deadline / Assignment management | Manager / Strategist |
| Status correction / exceptional override | Manager / Super Admin |

规则：

- 不假设固定员工姓名；责任来自 Assignment 与 Role。
- 一人可承担多个 Role，但每个 Action 仍记录其当时的 action role。
- User 只记录自己真实完成或被授权代录的动作。
- 外部 Approval 由授权人员代录时，必须区分 Approver 与 Recorded by。
- Manager / Super Admin Override 必须记录原状态、新状态、原因、actor 与 timestamp。
- Override 用于纠错或异常处理，不得成为替员工日常维护状态的默认方式。
- Priority、Deadline、Assignment 主要由 Manager / Strategist 管理；变更必须进入 Activity Log。

## 12. Timeline & Efficiency Events

Workflow 至少产生以下 Business Events：

| Business Event | 触发动作 |
| --- | --- |
| Content Created | Create Content |
| Script Ready | Mark Script Ready |
| Shoot Scheduled / Rescheduled | Create / change Shooting Calendar Event |
| Shoot Started | Start Shooting |
| Shoot Completed | Complete Shooting |
| Editing Started | Start Editing / Start Revision |
| First Cut Due changed | Set / change First Cut Deadline |
| First Cut Submitted | Submit First Cut V1 |
| Revision Requested | Internal / Client Reviewer requests revision |
| Revision Submitted | Editor submits a new version |
| Internal Review Started | Send / start Internal Review |
| Internal Approved | Approve Internal Video |
| Client Review Started | Send to Client Review |
| Client Approved | Client Approval or Record External Approval |
| Final Approved | All required approval checkpoints completed |
| Publication Scheduled / Rescheduled | Schedule / reschedule a Publication |
| Publication Published | Mark a specific Publication Published |
| Analytics Snapshot Added | Record Publication Snapshot |
| Content Reviewed / Completed | Complete Strategy Review / close Content |
| Override / Correction | Manager / Super Admin corrects workflow |
| Content Reopened / Cancelled | Explicit exceptional action |

这些 Event 可以推导：

- Content Created → Script Ready
- Script Ready → Shoot Started
- Shoot Scheduled → Shoot Started variance
- Shoot Completed → Editing Started
- Shoot Completed → First Cut Submitted
- First Cut Submitted → Internal Approved
- Client Review Started → Client Approved
- Approved → first Publication Published
- Content Created → first / fully Published
- Revision Count
- On-time First Cut
- On-time Publication
- Average Cycle Time

规则：

- 重新进入同一阶段产生新 Event，不覆盖第一次或上一次记录。
- Cycle Time 必须说明使用 first、latest 还是每轮 Event；V0.1 可先展示明确的基础周期，不实现复杂 SLA Engine。
- Efficiency 是流程事实，不应自动等同于 Contributor performance rating。

## 13. Exception Handling

V0.1 只定义最小业务行为，不建立复杂 Error Engine。

| Exception | 最小业务行为 | State / Event effect |
| --- | --- | --- |
| Shoot Cancelled | Shooter 或 Manager 记录取消原因；决定重排或取消 Content。 | 若重排，回到 Ready to Shoot 并产生 Shoot Cancelled；若终止，Content Cancelled。 |
| Reschedule | 授权人员修改 Calendar Event，保留旧时间、新时间与 reason。 | Production State 通常不变；产生 Rescheduled Activity。 |
| Editing Blocked | Editor 标记 Blocked reason、需要谁处理及 follow-up。 | Content 保持 Editing，并显示 Needs Attention；解除时记录 Unblocked。 |
| Publication Failed | Publisher 记录平台、时间、reason 与下一步。 | Publication → Failed / Needs Attention；Content 不算 Fully Published。 |
| Content Cancelled | Manager / Super Admin 明确取消并记录 reason。 | 进入 Content Cancelled；保留所有历史、版本与关系。 |
| Client No Response | 记录 follow-up、等待时间与 next follow-up date。 | 保持 Client Review 并显示 Needs Attention；不得自动视为 Approved。 |
| Reopen Completed Content | Manager / Super Admin 记录 reason，并指定回到 Review、Revision、Publishing 或 Analytics。 | 产生 Content Reopened；历史 Completion 不删除。 |

补充规则：

- Failed、Blocked、No Response 是需要关注的业务情况，不应通过虚构正常状态来隐藏。
- 跳过 Client Approval 必须由授权人员把该 Approval Requirement 明确设为 Not Required，并留下 Activity Log。
- 取消或 Archived Publication 是否仍属于 Required publication plan，必须由授权人员明确决定。

## 14. Example End-to-End Scenario

以下为虚构的 LKSoft Boss IP 示例，不使用真实敏感选题。

1. **Reference**：Strategist 保存一条公开的专业型企业领导者短视频作为 Active Reference。
2. **Idea**：从 Reference 转换出 Idea“企业数字化常见误区”，保留 Reference 与 Idea Creator。
3. **Idea approval**：Idea 从 New → Evaluating → Approved，再 Convert to Content，建立唯一 Content ID。
4. **Script**：Script Writer 完成 Hook、三点内容与 CTA；Assigned Reviewer 完成 Script Approval，Content → Ready to Shoot。
5. **Shooting**：Calendar 建立 Shooting Event。Shooter 执行 Start Shooting 与 Complete Shooting，Content → Shot / Awaiting Edit；Google Drive 保存 Raw Footage，ContentOS 保存链接与路径。
6. **Editing V1**：Editor Start Editing，提交 First Cut V1，系统产生 First Cut Submitted Event。
7. **Internal Review**：Reviewer 认为字幕节奏需调整，执行 Request Revision，原因分类为 Subtitle / Editing pace。
8. **Revision V2**：Editor Start Revision，提交 V2；V1 保留。Content 回到 Internal Review。
9. **Approval**：Reviewer Approve V2；若该 Content 的 Client Approval Required = Yes，则送 Client Review。Client 在 Call 中批准，由授权人员 Record External Approval，记录 Approver、Recorded by、timestamp、Channel、Notes 与 Approved Version V2。
10. **Prepare Publications**：Publisher 建立 Facebook 与 XHS 两个 Required Publications，各自分配 Publisher 与 schedule。
11. **Facebook Publication**：Facebook 按时发布，记录 URL 与 actual published time。Content Publication Summary = Partially Published，并开始 Facebook 24h Analytics。
12. **XHS Publication**：XHS 后续发布，独立记录 URL 与时间。所有 Required Publications 已发布，Summary = Fully Published。
13. **Analytics**：Publisher / Analyst 人工录入 Facebook 与 XHS 的 24h、7d、30d Snapshots，分别标记 Manual Data Source。
14. **Completion**：完成必要 Strategy Review 后，Manager 明确将 Content 标记为 Reviewed / Completed。所有 Reference、Idea、Versions、Approvals、Publications、Snapshots 与 Contributors 仍可追踪。

## 15. Resolved Decisions

本轮以下 Workflow Decisions 视为 ContentOS V0.1 正式决定：

1. **Status Ownership**：完成 Workflow Action 的人记录动作；Manager / Super Admin 可修正错误。Priority、Deadline、Assignment 主要由 Manager / Strategist 管理。所有关键动作自动产生 timestamp 与 Activity Log。
2. **Date Model**：禁止单一 Content Date 同时表示拍摄和发布；Created、Due、Scheduled、Started、Completed、Approved 与 Actual Published 必须在 Workflow 概念上区分。
3. **Approval Model**：Approval 不写死为固定人员；不同 Client / Content 可决定 Topic、Script、Internal Video、Client 与 Final Approval 是否 Required，并分配 Reviewer。Revision 可以重新进入 Review。
4. **Publication Model**：Content 与 Publication 分离；每个平台拥有独立 Publisher、schedule、published time、URL、status 与 Analytics。Content Publication Summary 由目标 Publications 派生。
5. **Source of Truth**：ContentOS 管理 Workflow 与 Metadata；Google Drive 管理 media files；Google Calendar 是 visualization / reminder layer，未来由 ContentOS 向 Calendar 同步。
6. **Approval Evidence**：Approved 必须是明确 Event，并指向 Approved subject / version。系统外 Approval 通过 Record External Approval 记录 Approver、Recorded by、timestamp、Channel、Notes 与 optional evidence。

## 16. Remaining Open Questions

以下问题仍未决定，但可在 LKSoft Pilot 中处理，不阻塞当前 Workflow Definition 或后续 Database Design：

1. 当前 Marketing Planner 是正式日常工具，还是模板／试排？
2. Planner 中 2026-09-02 与月历 9 月 3 日的历史差异以哪个为准？
3. 为什么详情表有 6 个具名选题而月历只显示 2 个？
4. 实际运营希望提前 1 周还是滚动准备后续 2 周？
5. “每周 3 条”是全部 Content 还是老板 IP 增量；如何与现有剪辑产能对应？
6. 老板个人账号是否已投入使用，当前实际运营哪些平台与账号？
7. 内容共享群是否已建立、使用什么平台、需要同步哪些固定信息？
8. Jayden 与阿辉是否为同一人？
9. 专职 Editor 的实际职责边界、可接受产能与交付标准是什么？
10. 当前是否已有正式 Shooting SOP、字幕模板、Editing Standard 或 Playbook？
11. 已剪辑但因政策／平台变化未发布的历史内容，Pilot 中如何记录原因与下一步？
12. Google Drive 是否已有统一目录、命名与权限规则？
13. 现有 Planner 的“日历／任务详情”跳转在 Excel 或 Google Sheets 是否实际有效？

这些问题可以影响 Pilot 默认值、培训与迁移方式，但不得被实现团队擅自写成 Current Fact。
