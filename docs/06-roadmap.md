# ContentOS V0.1 Development Roadmap

Status: Draft — Phase 6 Development Roadmap

本文把 ContentOS V0.1 切分为可独立构建、验证与停止的开发阶段。它定义顺序、dependencies、migration grouping、acceptance criteria 与 verification，不包含代码、SQL、deployment 或具体 framework 选择。

## 1. Roadmap Principles

1. **Pilot before completeness**：真实 LKSoft 用户能够跑通 Idea → Manual Analytics 后即可开始 First Pilot；不等待所有 Library、Calendar、Dashboard 与 V0.1 polish 完成。
2. **Vertical, verifiable increments**：每个阶段必须产生可见、可操作、可验证的结果，而不是只建立 tables 或静态页面。
3. **No big-bang schema**：40 张 V0.1 tables 分成 first migration 与 feature migrations；每组只有在依赖与业务行为明确后才建立。
4. **Permissions from the start**：Workspace、Client 与 Role boundary 先于业务数据；Client isolation 不能留到最终阶段补做。
5. **Events are source records**：Workflow、Version、Approval、Publication 与 Analytics 的历史不可被 current-state UI 覆盖。
6. **Real workflow over demo data**：验收以真实动作、实际 timestamps、权限拒绝、external links 与 browser behavior 为准，不以页面能显示 mock data 为完成。
7. **No table-per-page**：UI 继续遵循 `docs/05-ui-spec.md`；Content-owned records 集中在 Content Detail tabs。
8. **Safe rollout**：每阶段先验证 schema ownership、权限、数据完整性与 error handling，再进入依赖它的阶段。
9. **V0.1 scope control**：Deferred 项目不会因为相邻功能正在开发就顺便加入。
10. **No production action implied**：本 Roadmap 不授权创建 Supabase production resources、部署 Cloudflare、commit 或 push。

## 2. Confirmed Implementation Defaults

以下 defaults 作为开发验收条件，不再留给实现阶段自行决定：

- Content Detail 使用 Tabs，并保留 persistent Summary / Primary Action。
- Calendar V0.1 提供 Month + Agenda；Week View deferred。
- Kanban drag 只有在复用同一套合法 workflow transition validation 时才可启用；否则 V0.1 只提供 Kanban view，drag deferred。
- Batch Category / Tag edit deferred。
- Complete Shooting 不强制即时填写 Asset location；允许 `location pending`，但系统必须显著提示后续补充。
- Client-visible Preview deferred。
- V0.1 sharing granularity 主要为 Notes、Asset、Media visibility；不建立任意 field-level sharing designer。
- Facebook / XHS V0.1 只做 Publication record、published URL 与 Manual Analytics Snapshot。
- Workspace default timezone 为 `Asia/Kuala_Lumpur`；scheduled 与 actual timestamps 必须明确区分。
- Mobile priority：Shooting、workflow update、First Cut、Review、Publishing。
- Desktop primary browsers：current Chrome 与 current Edge。
- Internal Manager 可 Create / Edit Client；Client Archive、User / Role / Access Management 仅 Super Admin。
- Required Approval 默认禁止 submitter self-approval；Super Admin override 必须记录 reason；V0.1 不做 second approver。
- External Approval 不建立 contacts table；只记录 Name、Channel、Time、Recorded By、Evidence，并关联当前 approved subject / version。
- Notes 分 Internal、Private Management、Client-visible；Workflow Events 内部可见。
- Asset / Media 只有明确 Client-visible 才向 Client 开放；Approval Evidence 默认内部。
- Client 默认不看 Contributor、Staff performance 或未共享资料；cross-client library 仅内部。
- Intern access V0.1 由 Super Admin 手动管理；Analytics 按 Client access 隔离。

## 3. Migration Strategy

### 3.1 Migration rules

- Migration group 必须小而有清楚业务 owner；不为尚未进入开发的功能预建全部 tables。
- 每组 migration 在进入下一组前验证：ownership、required relationships、uniqueness intent、archive / deactivate behavior、历史保留和 role scope。
- Feature UI 不得依赖尚未创建的 deferred table。
- 若上游 docs 对字段或 visibility 尚未一致，先更新设计决定并完成 migration readiness review；不得在 migration 中临时猜测。
- Migration rollback / recovery approach 必须在执行该 migration 前定义；本文件不提供 SQL。

### 3.2 Core / first migration

**M01 — Workspace Identity & RBAC Foundation**

First migration 只建立 authentication profile、Workspace membership 与 Role / Permission backbone：

1. `workspaces`
2. `user_profiles`
3. `roles`
4. `permissions`
5. `role_permissions`
6. `workspace_members`
7. `workspace_member_roles`

不在 M01 建立 Client、Content、Workflow 或 Library tables。M01 的目标是先证明 active membership、multiple roles、deactivation 与 Workspace boundary 可工作。

### 3.3 Feature migrations

| Migration | Feature boundary | Tables | Depends on |
|---|---|---|---|
| M02 | Clients & Client Access | `clients`, `client_members` | M01 |
| M03 | Classification Foundation | `content_categories`, `tags`, `platforms`, `contribution_roles` | M01; M02 for Client-scoped records |
| M04 | References & Ideas | `references`, `reference_clients`, `reference_tags`, `ideas`, `idea_references`, `idea_contributors` | M02, M03 |
| M05 | Content Core | `campaigns`, `contents`, `content_tags`, `content_contributors` | M02, M03, M04 |
| M06 | Workflow & Audit | `workflow_events`, `activity_logs` | M05 |
| M07 | Script, Media, Revision & Approval | `script_versions`, `media_versions`, `content_approval_requirements`, `approvals`, `revision_requests` | M05, M06 |
| M08 | Publications & Manual Analytics | `publications`, `analytics_snapshots` | M03 platforms, M05, M06 |
| M09 | Assets, Music & Editing Playbooks | `assets`, `content_assets`, `asset_tags`, `music_tracks`, `content_music`, `editing_playbooks`, `editing_style_versions` | M02, M03, M05 |
| M10 | Calendar | `calendar_events` | M02, M05, M08 for Publication-linked events |

M01–M10 合计覆盖逻辑 Schema 中的 40 张 V0.1 tables，但任何一次 migration 都不会创建全部 40 张。

### 3.4 Deferred tables

以下不进入 V0.1 migrations：

- `meetings`
- `tasks`
- `saved_views`
- `sla_rules`
- `reports` / `report_runs`
- `profit_sharing`
- `notifications`
- `api_integrations` / `integration_credentials`
- `social_accounts`
- `analytics_import_jobs`
- `asset_renditions`

## 4. Phase Dependency Map

```text
Phase 0  Foundation
  ↓
Phase 1  Auth / Workspace                 [M01]
  ↓
Phase 2  Users / Clients                  [M02]
  ↓
Phase 3  References / Ideas               [M03 + M04]
  ↓
Phase 4  Content Core                     [M05]
  ↓
Phase 5  Workflow / Contributors / Audit  [M06]
  ↓
Phase 6  Script / Media / Review           [M07]
  ↓
Phase 7  Publications / Manual Analytics  [M08]
  ↓
FIRST PILOT GATE
  ↓
Phase 8  Assets / Music / Playbook         [M09]
  ↓
Phase 9  Calendar                          [M10]
  ↓
Phase 10 Dashboard / Strong Filters
  ↓
Phase 11 Final QA / V0.1 Pilot Stabilization
```

Phase 8–10 完成完整 V0.1 experience，但不是 First Pilot 的启动前提。First Pilot 反馈可以影响这些阶段的排序细节，不能改变已确认的权限与数据隔离边界。

## 5. Development Phases

## Phase 0 — Foundation

**Dependencies**

- Phase 1–5 specifications approved as working drafts。
- 本地 repository rules 与 secret handling 已确认。

**功能**

- 建立可运行的 application foundation、environment contract、configuration validation 与基本 quality gates。
- 定义 local / test environment 边界；不接 production resources。
- 建立统一 date / time handling policy，Workspace default 为 `Asia/Kuala_Lumpur`。
- 建立 error reporting、loading / empty state conventions 与 browser support baseline。

**涉及 tables**

- None。

**UI**

- Application shell skeleton、global error surface 与 responsive layout proof。
- 不制作业务 Dashboard、demo charts 或未授权 modules。

**Acceptance Criteria**

- Fresh local setup 可以启动 application shell，并在缺少 required config 时给出安全、明确的错误。
- secrets 不进入 repository、client bundle、logs 或 sample data。
- Desktop shell 在 current Chrome / Edge 可用；mobile navigation structure 可缩放。
- timezone utility / display rule 对 scheduled 与 actual time 有统一定义。

**Verification**

- 在干净 local environment 重走 setup checklist。
- 检查 secret / config exposure 与 error logs。
- Chrome、Edge 与至少一个 narrow mobile viewport 做 shell smoke test。
- 验证 `Asia/Kuala_Lumpur` 的 date / time display、input 与 boundary cases。

## Phase 1 — Auth / Workspace

**Dependencies**

- Phase 0 complete。
- Auth provider 与 local / non-production environment 已明确，但不在本 Roadmap指定 vendor implementation。

**功能**

- Sign in / sign out、authenticated session、user profile、active Workspace membership。
- Predefined Roles 与 Permission catalog。
- Multiple roles per Workspace member。
- Deactivated membership / user access denial，同时保留历史 identity。

**涉及 tables**

- M01：`workspaces`, `user_profiles`, `roles`, `permissions`, `role_permissions`, `workspace_members`, `workspace_member_roles`。

**UI**

- Sign-in surface。
- Authenticated application shell。
- Current user / Role summary。
- Access Denied、Deactivated 与 No Workspace states。

**Acceptance Criteria**

- Unauthenticated user 不能进入受保护页面。
- Active Workspace member 可以进入自己的 Workspace。
- Deactivated user / membership 失去读取与写入权限。
- 同一 user 可以拥有多个 predefined Roles，历史 profile 不因 deactivation 删除。
- Workspace boundary 不依赖前端 selected state。

**Verification**

- Positive / negative session tests：active、deactivated、no membership、expired session。
- Verify direct URL access 仍执行 authorization。
- 检查 Role union 与 inactive boundary 的优先级。
- 在 Chrome / Edge 验证 sign-in、refresh、sign-out 与 session expiry。

## Phase 2 — Users / Clients

**Dependencies**

- Phase 1 / M01 complete。
- Initial Super Admin identity 与 Role seeds 可验证。

**功能**

- Super Admin Create / Edit / Activate / Deactivate User。
- Super Admin Assign Role 与 Client access。
- Super Admin 与 Internal Manager Create / Edit Client。
- Client Archive 仅 Super Admin；历史 records 不删除。
- Multi-Client ownership 与 active `client_members` access boundary。
- Intern access 由 Super Admin 手动分配 / 撤销。

**涉及 tables**

- M02：`clients`, `client_members`。
- 使用 M01 identity / RBAC tables。

**UI**

- Team list / User detail（Super Admin only）。
- Client list、Create / Edit Client、Client detail foundation。
- Client scope selector 只显示用户可访问 Clients。

**Acceptance Criteria**

- Internal Manager 可 Create / Edit Client，但看不到 Archive、User、Role 或 Access Management actions。
- 只有 Super Admin 可 Archive Client、管理 user lifecycle、roles 与 client access。
- Deactivated user / Client membership 立即失去新访问，历史 attribution 保留。
- User 不能通过 direct URL、search、count 或 selector 发现未授权 Client。
- Client code 在 Workspace 内稳定且可检测冲突。

**Verification**

- 以 Super Admin、Internal Manager、Intern 与无 Client access user 分别执行 permission matrix smoke tests。
- 建立至少两个 test Clients，验证 cross-client negative access。
- 验证 Archive / Deactivate 不 cascade delete history。
- 浏览器检查 Team 与 Client actions 的 enabled / disabled / hidden behavior，并验证后台实际拒绝。

## Phase 3 — References / Ideas

**Dependencies**

- Phase 2 / M02 complete。
- M03 lookup scope 与 seed list approved。

**功能**

- Workspace / Client-scoped Categories、Tags、Platforms 与 Contribution Roles foundation。
- Reference Account / Content basic library。
- Reference → Idea，保留 source relationship。
- Idea lifecycle：New、Evaluating、Approved、Converted、Rejected、Archived。
- Idea contributors 与 Client ownership。

**涉及 tables**

- M03：`content_categories`, `tags`, `platforms`, `contribution_roles`。
- M04：`references`, `reference_clients`, `reference_tags`, `ideas`, `idea_references`, `idea_contributors`。

**UI**

- Reference list / detail / filters / Convert to Idea drawer。
- Idea list / detail / lifecycle actions。
- Client-aware Category / Tag pickers。

**Acceptance Criteria**

- Reference 可独立存在，Convert 不修改或 archive Reference。
- 同一 Reference 可为不同 Client 建立不同 Ideas，且 Client ownership 清楚。
- Idea status transition 合法；Reject / Archive 保留 reason / history。
- Idea Creator、Reference relationships 与 conversion actor 不因后续转换丢失。
- Workspace-wide References 仅向有相应内部 scope 的用户显示，不进入 Client-facing surface。

**Verification**

- 运行 Reference → Idea happy path 与 cross-client negative cases。
- 验证 duplicate URL warning 不造成过严 global uniqueness。
- 验证 archived lookup / Reference 仍可解释历史关系。
- 以 Strategist、Manager、Intern 与 unauthorized user 验证 create / edit / view boundaries。

## Phase 4 — Content Core

**Dependencies**

- Phase 3 / M03–M04 complete。
- Content code sequence 与 conflict handling 在 migration 前决定。
- Private Management Notes 的 storage boundary 在 M05 readiness review 中补齐；不能把它混入 Internal Notes。

**功能**

- Create Content from approved Idea，并保留 source / Idea Creator。
- 允许授权用户 direct-create Content，并记录 reason / creator。
- Stable unique Content ID、Client、Category、Campaign、Format、Priority、owner、Hook、CTA 与 target publish metadata。
- Internal / Private Management / Client-visible Notes 的明确分离。
- Content contributors、tags 与 basic assignments。
- Content List basic filters 与 Content Detail foundation。

**涉及 tables**

- M05：`campaigns`, `contents`, `content_tags`, `content_contributors`。
- 使用 M03 lookup 与 M04 source relations。

**UI**

- Content List：Client、Category、Status、Priority、Campaign、Format basic filters。
- Content Detail：Tabs + persistent Summary / Primary Action；本阶段先提供 Overview 与可用 sections，不显示空的未实现 controls。
- Idea → Content guided flow 与 direct-create flow。
- Notes 使用明确 visibility labels。

**Acceptance Criteria**

- Content ID 唯一、稳定且不因 title edit 改变。
- Idea → Content 保留 Idea、Reference 与 Idea Contributor provenance。
- 所有 Content 必须有 Client ownership；filter / URL 不泄漏其他 Client。
- Notes 三种 visibility 不共用无分类的通用输入框。
- 多 Contributors / Roles 可记录，不加入 percentage、profit sharing 或 performance score。
- Content Detail summary 在 desktop 与 mobile 保持 Client、status、priority、owner 与 next action context。

**Verification**

- 建立来自 Idea 与 direct-created 的两种 Content，检查 provenance 与 Content ID invariants。
- 测试 concurrent / duplicate Content code handling。
- 用两个 Client 验证 filters、detail route 与 counts isolation。
- 验证 Notes visibility 的 positive / negative access，并检查 unauthorized fields 不在响应数据中。

## Phase 5 — Workflow / Contributors / Timeline

**Dependencies**

- Phase 4 / M05 complete。
- V0.1 state transition map 与 action actor rules 以 `docs/03-workflow.md` 为准。

**功能**

- Event-backed production transitions：Script Ready、Start / Complete Shooting、Start Editing、Blocked / Unblocked、Review entry、Cancel、Reopen 与 correction。
- Current status 与 append-only Workflow Events 同步。
- Assignment / contributor updates 与 Activity Log。
- Automatic timestamps 与基础 duration source data。
- Complete Shooting 允许 Asset location pending，不阻塞 action。
- Manager / Super Admin correction；override reason required。

**涉及 tables**

- M06：`workflow_events`, `activity_logs`。
- 使用 `contents`, `content_contributors` 与 assignment metadata。

**UI**

- Content Detail persistent Primary Action。
- Production action sheets 与 internal Timeline / Activity tab。
- Needs Attention states：Blocked、Overdue、Cancelled / Reopened。
- Kanban view 可开始读取 current status；drag 不在本阶段默认启用。

**Acceptance Criteria**

- 用户不能用任意 status dropdown 绕过合法 action。
- 每个关键 action 记录实际 actor、occurred time、from / to state 与关联 Content。
- Priority、deadline、assignment change 进入 Activity，但不伪装成 production transition。
- Re-enter stage 建立新 event，不覆盖旧 timestamp。
- Complete Shooting 在无 Asset location 时成功并显示 `Location pending` follow-up。
- Override / correction 保留原 event，并要求 before、after、reason、actor 与 time。

**Verification**

- 以 assigned Shooter / Editor / Manager 跑合法与非法 transition matrix。
- 比较 `contents.current_status` 与 event history，验证失败 action 不产生半完成状态。
- 验证 duplicate submit / refresh 不产生重复 business event。
- 验证 mobile Start / Complete Shooting、Start Editing 与 Mark Blocked。

## Phase 6 — Script / Media / Revision / Approval

**Dependencies**

- Phase 5 / M06 complete。
- Approval requirement、review target 与 self-approval rule confirmed。
- M07 readiness review 必须定义 Media visibility 与 Approval Evidence 默认 internal 的可执行数据边界；不能只靠 UI 隐藏。

**功能**

- Append-oriented Script Versions 与 current operational version。
- First Cut / Revision / Final Media Versions，仅保存 external URLs / paths 与 metadata。
- Approval Requirements：Topic、Script、Internal Video、Client、Final。
- Revision Requests、reason categories、resulting version links 与 review loop。
- Internal Approval、Client Approval 与 Record External Approval。
- Required Approval 禁止 submitter self-approval。
- Super Admin override reason required；V0.1 不做 second approver。

**涉及 tables**

- M07：`script_versions`, `media_versions`, `content_approval_requirements`, `approvals`, `revision_requests`。
- 使用 M06 Workflow Events / Activity Logs。

**UI**

- Content Detail `Script` 与 `Review & Revisions` tabs。
- Version history、Submit First Cut / Revision、Request Revision、Approve actions。
- External Approval form：Name、Channel、Time、Recorded By、Evidence；approved subject / version 来自 locked review context。
- Approval Evidence 显示 Internal badge。
- Mobile First Cut submit 与 review actions 优先可用。

**Acceptance Criteria**

- Submitted Script / Media Version 不可原地覆盖；每次 revision 建立新 Version。
- Approval 明确指向 Content / Script Version / Media Version / Publication target；新 Version 不继承旧 Approval。
- Required checkpoint 的 submitter 无法 Approve 自己提交的 subject，即使其同时有 Reviewer Role。
- External Approver 与 Recorded By 分开；不建立 contact identity / contacts table。
- Approval Evidence 默认 internal；Media 只有明确 Client-visible 才可进入未来 Client surface。
- Request Revision 指向审核版本、reason、requester 与 resulting version；提交后回到正确 review stage。
- Override 不是 Approval，不产生伪造 approver。

**Verification**

- 跑 V1 → Revision Request → V2 → Approve 的完整循环并检查 V1 history。
- 对 Script、Media 与 external approval 分别验证 target integrity。
- 执行 submitter self-approval negative test，以及独立 Reviewer positive test。
- 验证 internal evidence / unshared media 对无权限 user 不可读取，即使知道 record ID。
- 验证 failed / repeated submit 不创建重复 Version、Approval 或 Event。
- 在 mobile viewport 验证 link paste、First Cut submit、Approve / Request Revision。

## Phase 7 — Publications / Manual Analytics

**Dependencies**

- Phase 6 / M07 complete。
- Facebook / XHS activated in `platforms`。
- Initial Manual Analytics metric dictionary、units 与 validation rules confirmed。

**功能**

- Content → multiple independent Publications。
- Facebook / XHS Publication status、account text、assigned Publisher、scheduled time、actual published time 与 URL。
- Required Publication plan 与 derived Not / Partially / Fully Published summary。
- Publication Failed / Needs Attention。
- Manual Analytics Snapshots：24h、7d、30d、Current / Custom。
- Analytics data source、captured at、entered by 与 Client isolation。

**涉及 tables**

- M08：`publications`, `analytics_snapshots`。
- 使用 `platforms`, `contents`, `workflow_events`, `activity_logs`。

**UI**

- Content Detail `Publications & Analytics` tab。
- Facebook / XHS Publication cards、Open / Copy URL actions。
- Schedule / Reschedule、Mark Published、Mark Failed。
- Add Manual Snapshot drawer 与 basic Analytics work queue。
- Mobile publishing actions 与 URL paste 优先完成。

**Acceptance Criteria**

- 同一 Content 可有多个平台、同平台多 sequence records；一个平台 Published 不会把全部 Content 判为 Fully Published。
- Schedule 与 actual Published time 分开，以 `Asia/Kuala_Lumpur` 正确显示。
- Mark Published 只更新目标 Publication，并建立 Published event / activity。
- Failed Publication 不计为 Published，必须显示 reason / attention。
- Snapshot 必须绑定具体 Publication；Facebook 与 XHS metrics 不混写。
- Missing metric 使用 null，不强迫填 0；entered by、captured at、source 保留。
- Analytics list、counts 与 records 均按 Client access 隔离。

**Verification**

- 同一 Content 建立 Facebook + XHS required Publications，依次验证 Not → Partially → Fully Published。
- 测试 reschedule、failure、URL correction 与 duplicate URL warning。
- 为两平台分别录入 24h / 7d Snapshots，验证 source、actor 与 captured time。
- 用两个 Client 验证 Analytics direct URL、queue、aggregate 与 export absence 不泄漏。
- 在 Chrome / Edge 与 mobile viewport 跑 Publisher happy path。

### First Pilot Gate after Phase 7

Phase 7 验收通过后，不等待 M09、M10、Dashboard 或完整 V0.1 polish，即可按第 6 节开始 LKSoft First Pilot。后续阶段继续开发，但 Pilot feedback 优先用于修正已上线 workflow friction 与 data integrity defects，不用于临时扩大 scope。

## Phase 8 — Assets / Music / Editing Playbook

**Dependencies**

- Phase 7 complete 或 First Pilot 已启动且核心缺陷不阻塞。
- M09 readiness review 明确 Notes / Asset / Media visibility 与 cross-client internal-only rule。

**功能**

- Asset metadata index 与 Content relationships。
- Drive URL、Local / NAS path Open / Copy behavior。
- Music metadata、usage 与 selected by。
- Client Editing Playbooks 与 immutable Style Versions。
- Content 关联实际使用的 Music 与 Editing Style Version。
- Asset / Media explicit Client-visible flag / boundary；cross-client library internal only。

**涉及 tables**

- M09：`assets`, `content_assets`, `asset_tags`, `music_tracks`, `content_music`, `editing_playbooks`, `editing_style_versions`。

**UI**

- Assets、Music、Editing Playbook libraries。
- Content Detail `Assets & Standards` tab。
- Open Drive URL、Copy URL、Copy Local Path、Copy NAS Path。
- Playbook version list、Create New Version、authorized Activate action。
- Explicit visibility label / share confirmation；不做 Client-visible Preview。

**Acceptance Criteria**

- Database 不保存 large media binary。
- Local / NAS path 只 Copy，不显示为可靠 browser-open action。
- Asset 可关联多个同 Client Contents；普通 picker 不允许 cross-client Asset reuse。
- Workspace / cross-client References or Music 只向内部 authorized users 可见。
- Active / used Style Version 不原地覆盖；新 Content 可选择新 Version，历史 Content 保持旧关联。
- Asset / Media 默认 internal，只有明确 Client-visible 才可被未来 Client projection 读取。

**Verification**

- 用真实格式的 Drive URL、Local path、NAS path 验证 Open / Copy behavior。
- 测试 same-client reuse、cross-client negative case 与 archived Asset history。
- 建立 Playbook V1 → V2，确认使用 V1 的 Content 不被改写。
- 验证 unshared / shared Asset 与 Media 的 permission boundary，不只检查按钮隐藏。
- 在 current Chrome / Edge 验证 clipboard feedback 与长 path rendering。

## Phase 9 — Calendar

**Dependencies**

- Phase 8 complete；M10 依赖 Content 与 Publication ownership 已稳定。
- Workspace timezone fixed as `Asia/Kuala_Lumpur`。

**功能**

- Month + Agenda views。
- Shooting、First Cut Due、Review、Publishing、Meeting、Workshop / Event event types。
- Client、Event Type、Assignee filters。
- Content / Publication-linked events 与 standalone minimum events。
- Reschedule old / new summary 与 reason。

**涉及 tables**

- M10：`calendar_events`。

**UI**

- Calendar Month default 与 Agenda view。
- Event preview → Content Detail / Publication section。
- Event create / edit / reschedule action flow。
- Week View 不显示为未完成 control；deferred。

**Acceptance Criteria**

- Calendar 来自同一 event / Content / Publication records，不需要在月历与详情双写。
- Calendar Event 只表达 schedule；拖动或完成 event 不自动伪造 Shoot / Review / Published action。
- Month 同日可显示超过 3 个 events，并提供 `+N more` / Agenda。
- Reschedule 记录 old、new、actor、time 与 reason。
- 全部输入 / display 以 Workspace timezone 解释，actual timestamps 保持独立。
- Week View 与 Google Calendar sync 不进入 V0.1。

**Verification**

- 建立每种 event type，并验证 association 与 Client ownership。
- 对 DST-independent Malaysia dates、跨日 event、month boundary 与 timestamp round-trip 做 tests。
- 验证 Month / Agenda filters 与 direct navigation。
- 确认 reschedule 不改变 Content workflow state。
- 在 Chrome / Edge 与 mobile Agenda 验证实际可读性和操作。

## Phase 10 — Dashboard / Strong Filters

**Dependencies**

- Phase 9 complete；Content、Workflow、Publication、Analytics 与 Calendar source records 已稳定。
- Attention queue definitions 与 due-date semantics approved。

**功能**

- Dashboard What Needs Attention queues。
- Overdue、Blocked / Failed / No Response、Waiting Review、Ready for Next Stage、Analytics Due、Upcoming。
- Content strong filters：Client、Category、Status、Platform、Contributor、Editor、Shooter、Campaign、Date meaning / range、Priority、Format。
- Filtered list deep links from Dashboard。
- Kanban alternate view。

**涉及 tables**

- No new tables。
- 读取 `contents`, `workflow_events`, `publications`, `analytics_snapshots`, `calendar_events` 与 related lookup / contributor records。
- 不建立 `saved_views`。

**UI**

- Action-first Dashboard；不添加 vanity charts。
- Dense Content List、filter chips、Clear All、result count。
- Kanban cards 与 transition affordance。

**Acceptance Criteria**

- Dashboard queue counts 与 source records 可逐条解释，且点击进入相同 filtered list。
- Overdue 使用明确 date meaning，不混淆 scheduled 与 actual dates。
- 多条件 filters 可组合、清除，并保持 Client isolation。
- Kanban drag 只有在调用同一合法 transition engine、收集 required fields 并产生正确 event 时才启用；否则 drag 保持 disabled / deferred。
- Batch Category / Tag edit 与 Saved Views 不进入 V0.1。
- Dashboard 不显示 staff ranking、advanced efficiency 或无行动价值 charts。

**Verification**

- 用已知 fixtures 对每个 queue 做 record-level reconciliation，避免只检查数字出现。
- 测试 Product Spec 中的组合 filters 与 empty / filtered empty states。
- 用 unauthorized Client 验证 counts、filter options 与 search suggestions 不泄漏。
- 若启用 Kanban drag，重跑 Phase 5 transition / permission / duplicate-submit test suite；任一失败即关闭 drag。
- 对 large-enough pilot-like dataset 检查 filter response 与 table usability。

## Phase 11 — Final QA / V0.1 Pilot Stabilization

**Dependencies**

- Phase 1–10 acceptance criteria complete，或有明确批准的 deferred list。
- First Pilot feedback 已分类为 blocker、V0.1 fix、V0.x candidate。

**功能**

- End-to-end hardening、permission audit、data integrity、responsive polish、error recovery 与 pilot training material。
- 修复真实 Pilot 中阻塞日常操作的问题。
- 定义 V0.1 release checklist 与 rollback / support process；不在本阶段自动部署。

**涉及 tables**

- No new tables by default。
- 仅在已批准的 schema correction 必要时增加 narrow corrective migration；不得借 QA 扩大功能。

**UI**

- 完成 Empty / Loading / Error states。
- Desktop Chrome / Edge 与 mobile-priority flows polish。
- Permission-disabled reason、visibility label、copy / link feedback 与 conflict handling。

**Acceptance Criteria**

- Product Spec success path 从 Reference / Idea 到 Manual Analytics 可用。
- Client / Role negative-access suite 全部通过。
- Event、Version、Approval、Publication 与 Snapshot history 不被覆盖。
- First Pilot blocker 清零；已知非阻塞问题有 owner、severity 与 next step。
- V0.1 未出现 deferred controls、fake integrations、secret fields 或 unsupported promises。

**Verification**

- 使用真实角色账号在 current Chrome / Edge 完整跑 end-to-end acceptance。
- 在 mobile viewport 实测 Shooting、workflow update、First Cut、Review、Publishing。
- 数据库层核对 ownership、foreign relationships、current state / event consistency 与 historical retention。
- 执行 permission matrix、self-approval、override、cross-client、deactivation 与 visibility regression。
- 由真实 Pilot 用户完成 task-based walkthrough；记录完成率、阻塞点与错误，不只由开发者自测。

## 6. First Pilot Scope

### 6.1 Pilot timing

First Pilot 在 Phase 7 完成并通过 gate 后开始。Phase 8 Assets / Music / Playbook、Phase 9 Calendar、Phase 10 Dashboard / full filters 与 Phase 11 final polish 不作为启动条件。

### 6.2 Minimum users and setup

- 一个 internal Workspace。
- 一个真实 Pilot Client：LKSoft。
- 至少配置 Super Admin、Internal Manager / Strategist、Shooter、Editor、Reviewer、Publisher；同一 user 可持有多个 Role，但 self-approval rule 仍生效。
- Client access、Roles 与 Intern access 由 Super Admin 手动确认。
- Facebook / XHS 作为 active Publication platforms；不连接平台 API。

### 6.3 Minimum usable product

First Pilot 必须让真实用户完成：

1. Create Idea；可选择 Reference，但 Reference 不是每条 Pilot Content 的必填。
2. Approve Idea 并 Convert to Content，保留 Idea Creator / source。
3. 查看 stable Content ID、Client、priority、owner 与 Content Detail tabs / persistent action。
4. 编辑 / 提交 Script Version，并按 required checkpoint review。
5. Assign Shooter，执行 Start / Complete Shooting；Asset location 可以 pending。
6. Assign Editor，Start Editing，提交 First Cut external link / path。
7. Assigned Reviewer Approve 或 Request Revision；如 Revision，提交新 Version 并保留旧 Version。
8. 如审批在系统外发生，记录 Name、Channel、Time、Recorded By 与 Evidence。
9. 建立 Facebook / XHS Publication，Schedule / Mark Published，保存 published URL 与 actual time。
10. 为具体 Publication 手动录入至少一个 Analytics Snapshot。
11. 在 internal Timeline / Activity 中看到关键 actor、timestamp 与 history。

### 6.4 Minimum Pilot UI

- Authentication 与 role-aware shell。
- Client / User access setup。
- Idea list / detail / Convert flow。
- Content List basic Client、Status、Priority、Assignee filters。
- Content Detail Tabs + persistent Summary / Primary Action。
- Mobile-priority Shooting、First Cut、Review、Publishing actions。
- Publication cards 与 Manual Analytics form。
- Internal Timeline / Activity。

### 6.5 Not required to start Pilot

- 完整 Asset Library、Music Library 或 Editing Playbook management。
- Month / Agenda Calendar。
- Dashboard attention queues 与全部 strong filters。
- Kanban drag。
- Client-visible Preview / Client Portal。
- Batch actions、Saved Views、reports、automation 或 integrations。

### 6.6 Pilot acceptance run

至少以一条真实 LKSoft Content 完成：

```text
Idea
→ Content
→ Script
→ Shoot
→ Edit / First Cut
→ Review or Revision
→ Approval
→ Facebook or XHS Publication
→ Manual Analytics Snapshot
```

该 run 必须验证：

- provenance、Content ID、contributors 与 assignment 正确。
- 每个 workflow action 产生正确 event / timestamp。
- submitter 无法 self-approve required checkpoint。
- Revision history 未覆盖。
- publication 与 snapshot 绑定正确 Client / Platform。
- Manager 能找到 current state、next owner 与 blocker。
- mobile-priority action 至少由真实执行角色操作一次。
- 另以第二个隔离 test Client 做 negative access test；不要求第二个真实业务 Client 才能启动 Pilot。

## 7. Cross-Phase Verification Gates

每个阶段进入下一阶段前至少通过：

1. **Functional gate**：真实 UI action 完成该阶段主流程。
2. **Data gate**：source record、relationship、history 与 current summary 一致。
3. **Permission gate**：至少一个 allowed 与一个 denied role / scope case。
4. **Client isolation gate**：使用第二个 test Client 验证 direct ID、list、count、search 与 filter options。
5. **Failure gate**：validation、network / server failure、duplicate submit 与 stale update 不产生半完成状态。
6. **Browser gate**：current Chrome / Edge；相关 mobile-priority action 使用 narrow viewport 实测。
7. **Audit gate**：关键 action 能回答 actor、time、Client / Content、before / after 或 business target。
8. **Scope gate**：本阶段没有引入 Roadmap Deferred 项目。

“Build passes”或“table exists”不能单独视为阶段完成。

## 8. Deferred Items

### 8.1 Deferred from V0.1 UI / workflow

- Calendar Week View。
- Kanban drag（若合法 transition engine 不能完整复用）。
- Batch Category / Tag edit。
- Client-visible Preview、完整 Client Portal 与 Client self-registration。
- 更细的任意 field-level sharing designer；V0.1 只处理 Notes / Asset / Media visibility。
- Second approver。
- Intern automatic access expiry。
- Saved Views。
- Advanced efficiency、workload、SLA 与 staff performance dashboards。
- Complex reports / PDF generation。
- Meeting records beyond optional basic Calendar Event。
- Notifications / mentions automation。

### 8.2 Deferred integrations and automation

- Google Calendar API sync。
- Facebook / XHS publishing API。
- Facebook / XHS scraper 或 automated tracking。
- CSV Analytics import。
- Social account identity / account-level permission table，除非 Pilot 证明 V0.1 必须处理多个严格隔离账号并另行批准 scope change。
- AI script generation、AI analysis、recommendations 或 automated strategy。

### 8.3 Deferred platform / infrastructure scope

- Video upload、hosting、transcoding 或 editing。
- Full SaaS、billing、profit sharing、accounting、payroll。
- Native mobile app。
- Complex notification service、integration credentials UI 与 heavy media renditions。

## 9. Biggest Implementation Risks

| Risk | Why it matters | Required mitigation / gate |
|---|---|---|
| Client data leakage | Workspace-wide roles、libraries、counts、filters 或 direct IDs 可能泄漏其他 Clients。 | 每阶段执行 two-client negative tests；authorization 不依赖 UI selector。 |
| Visibility schema gaps | Current Schema 尚需明确 Private Management Notes、Asset / Media visibility 与 Approval Evidence internal boundary。 | 在 M05 / M07 / M09 前做 migration readiness review；未补齐前不得以 UI hiding 代替数据边界。 |
| Current status and event history divergence | UI 显示的 current status 可能与 append-only events 不一致。 | 所有 transition 经单一 action path；每阶段核对 current snapshot 与 events，失败不得部分提交。 |
| Invalid or duplicate workflow actions | Double submit、refresh、Kanban drag 或 stale state 可能重复建 event / version。 | Idempotency / stale-state validation 进入 workflow acceptance；drag 未通过同套 tests 就 deferred。 |
| Approval integrity | Self-approval、错误 target、旧 Version approval 沿用或 override 冒充 approval 会破坏审计。 | Required self-approval negative tests、target integrity、new-version reapproval 与 override audit gates。 |
| Content code generation | 并发创建或人工修正可能产生 duplicate / unstable IDs。 | M05 前确认 sequence rule并测试 concurrent create / correction，不以 title 生成 identity。 |
| Time semantics / timezone | Shoot、due、schedule、actual publish 混用会重现 Planner 日期差异。 | 统一 `Asia/Kuala_Lumpur` display；每个 filter / form 指明 date meaning；Calendar 不代表 actual action。 |
| Manual Analytics quality | 用户可能把不同 Publication、period、account 或 null / zero 混淆。 | 固定 Publication context、metric dictionary、unit validation、entered by / captured at / source。 |
| External link and path reality | Drive permissions、失效 URL、Local / NAS path 与 browser limitation 会影响真实使用。 | 用真实格式 links / paths 测试；Open / Copy 分开；path pending 不阻塞 shooting但进入 attention。 |
| Pilot adoption and status ownership | 功能正确但员工不执行 action，timeline 仍会失真。 | First Pilot 使用真实角色完成 task-based run；记录 friction，优先修复核心动作而非扩大功能。 |
| Big-bang migration / UI scope | 一次创建全部 tables 或页面会延迟验证并放大返工。 | 严格使用 M01–M10 gates；Pilot 在 Phase 7 启动；Deferred list 作为 scope stop rule。 |

## 10. Roadmap Exit Definition

V0.1 Roadmap 完成不以“40 张 tables 已存在”为标准，而以以下结果为准：

- First Pilot 已用真实 LKSoft Content 跑通核心 lifecycle。
- Phase 1–11 acceptance 与 verification 有可复查结果。
- Role、Client、Notes / Asset / Media visibility boundaries 经 negative tests 验证。
- Workflow、Version、Approval、Publication 与 Analytics history 可追踪。
- Dashboard、Filters 与 Calendar 来自 source records，不依赖人工双写。
- current Chrome / Edge 与 mobile-priority actions 通过实际使用验证。
- Deferred 项目没有被静默带入 V0.1。
- 任何尚未解决的问题都以明确 owner / next decision 记录，不由实现团队猜测。
