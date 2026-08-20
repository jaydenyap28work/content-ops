# ContentOS Permissions

用途：定义 ContentOS V0.1 的角色、动作、数据可见性、Client 隔离及未来 RLS 边界。

Status: Draft — Phase 4 Permission Matrix

## 1. Permission Principles

1. 权限由 `Workspace membership + Client membership + Role permission + Action assignment + Data visibility` 共同决定，不能只看 Role 名称。
2. 所有 Client-bound 数据必须先通过 Workspace 与 Client scope 检查；同一 Workspace 内也不能自动访问所有 Client。
3. 管理权限不自动等于流程执行权。Super Admin 或 Internal Manager 不应因为管理身份而自动成为 Shooter、Editor、Reviewer 或 Publisher。
4. 流程动作由实际执行人记录。需要更正时保留原事件，以新的 correction / override 记录修正，不改写历史。
5. Approval 必须来自该审批阶段指定或获授权的 Reviewer。管理者的 override 不能伪装成正常 Approval。
6. Client Admin 与 Client Viewer 只可访问自己获授权 Client 的 client-visible 数据面，不能直接访问内部基础数据表或内部字段。
7. Intern 默认采用 Least Privilege，只取得完成指定任务所需的最小 Client、Content、资料与动作权限。
8. V0.1 以预设 Role permissions 为主；未来允许额外权限，但额外权限不得绕过 Workspace membership、Client membership、Client isolation 或 inactive 状态。
9. 停用用户保留历史 attribution，但立即失去新的读取与写入权限。
10. Archive 优先于 hard delete；历史内容、版本、审批、发布和活动记录不得因权限操作而被抹除。

## 2. Scope Model

| Code | Scope | Definition |
|---|---|---|
| `W` | Workspace | 当前 Workspace 内；不代表可跨 Workspace。仅在动作本身允许时覆盖 Workspace 下的数据。 |
| `C` | Assigned Client | 用户存在 active `client_members` record 的 Client。 |
| `T` | Assigned Content / Task | 用户被明确指派的 Content、Shooting、Editing、Review、Publication 或其他任务。 |
| `O` | Own actions | 用户本人创建或执行的 draft、event、submission、comment 等；不能改写其他人的历史动作。 |
| `V` | Client-visible data only | 仅限获授权 Client 中明确可向 Client 展示的字段、文件、版本、审批、发布、分析与报告。 |
| `R` | Assigned Reviewer | 仅限当前 required approval stage 指定或获授权的 Reviewer。 |
| `*` | Additional permission required | 除 Role 外，还必须有明确的额外 action permission；仍受 C/T/O/V 等 scope 约束。 |
| `—` | Not allowed by default | 该 Role 默认没有此动作。可以通过增加合适的 Role 或未来额外权限处理，但不能借用 override 绕过。 |

权限判定采用以下顺序：

1. 用户与 Workspace membership 必须 active。
2. Client-bound 数据必须满足 active Client membership；Super Admin 的 Workspace 管理范围除外。
3. Client role 必须进入 client-visible 数据面。
4. Role 或额外权限必须允许该 action。
5. 若 action 要求 assignment、ownership 或 reviewer，必须继续满足 `T`、`O` 或 `R`。
6. inactive、Client isolation、非 client-visible 等显式边界优先于任何 allow。

## 3. Role Boundaries

| Role | Default scope | Default responsibility and boundary |
|---|---|---|
| Super Admin | `W` | 管理 Workspace、用户、角色、Client access 与系统级规则；可执行有审计的 override。不会自动成为每项流程动作的执行人或 Reviewer。 |
| Internal Manager | `C` | 管理获授权 Client 的内容、人员安排、进度、优先级、期限与异常；可在 assigned Client 内执行有审计的 override。 |
| Strategist / Content Planner | `C` | 管理获授权 Client 的 Reference、Idea、Topic、Script 与 Content planning，并安排相关生产角色。 |
| Shooter | `T` + `O` | 读取指定拍摄任务所需资料，开始/完成拍摄并登记自己的拍摄动作与相关素材。 |
| Editor | `T` + `O` | 读取指定剪辑任务所需资料，开始剪辑、提交 First Cut / Revision 与版本链接。 |
| Publisher / Marketing | `T` + `O` | 准备、排期、标记发布以及维护指定 Publication 的基础 Analytics。 |
| Intern | `T` + `O` + `*` | 没有默认广泛 Client 权限；只能看到被授权任务所需资料，并执行明确授予的动作。 |
| Client Admin | `C` + `V` | 访问自己 Client 的 client-visible 内容；可在被指定为 Reviewer 时执行 Client Approval。不能管理内部用户或内部生产数据。 |
| Client Viewer | `C` + `V` | 只读访问自己 Client 的 client-visible 内容、发布、分析与报告；不能执行流程或审批动作。 |

一个用户可以同时持有多个 Role。有效权限取其 Role permissions 的并集，但只在该用户已经拥有的 Workspace / Client scope 内生效；Client isolation 与数据可见性限制不能被并集扩大。

## 4. Permission Matrix

下表定义 V0.1 默认权限。`C*`、`T*` 等表示必须同时满足 scope 与额外权限。业务管理动作与流程执行动作刻意分开，确保系统记录的 actor 是实际执行者。

| Action | Super Admin | Internal Manager | Strategist / Content Planner | Shooter | Editor | Publisher / Marketing | Intern | Client Admin | Client Viewer |
|---|---|---|---|---|---|---|---|---|---|
| Create Client | `W` | `W*` | — | — | — | — | — | — | — |
| Edit Client profile / settings | `W` | `C` | — | — | — | — | — | — | — |
| Archive Client | `W` | `C*` | — | — | — | — | — | — | — |
| Create / Edit Reference | `W` | `C` | `C` | — | — | — | `C*` | — | — |
| Create / Edit Idea | `W` | `C` | `C` | — | — | — | `C*` | — | — |
| Archive Idea | `W` | `C` | `C` | — | — | — | — | — | — |
| Convert Idea to Content | `W` | `C` | `C` | — | — | — | `C*` | — | — |
| Edit Topic / Content brief | `W` | `C` | `C` | — | — | — | `T*` | — | — |
| Edit Script / mark Script Ready | `W` | `C` | `C` | — | — | — | `T*` | — | — |
| Assign Shooter / Editor / Reviewer / Publisher | `W` | `C` | `C` | — | — | — | — | — | — |
| Change Priority / Deadline | `W` | `C` | `C` | — | — | — | — | — | — |
| Configure required approval stages / reviewers | `W` | `C` | `C` | — | — | — | — | — | — |
| Start / Complete Shooting | `T*` | `T*` | `T*` | `T` + `O` | — | — | `T*` + `O` | — | — |
| Start Editing | `T*` | `T*` | `T*` | — | `T` + `O` | — | `T*` + `O` | — | — |
| Submit First Cut / Revision | `T*` | `T*` | `T*` | — | `T` + `O` | — | `T*` + `O` | — | — |
| Approve / Request Revision | `R` | `R` | `R` | `R*` | `R*` | `R*` | `R*` | `R` + `V` | — |
| Record External Approval | `W` | `C` | `C*` | — | — | — | — | — | — |
| Create / prepare Publication | `W` | `C` | `C*` | — | — | `T` + `O` | `T*` + `O` | — | — |
| Schedule / reschedule Publication | `W` | `C` | `C*` | — | — | `T` + `O` | `T*` + `O` | — | — |
| Mark Published / record failure | `W` | `C` | — | — | — | `T` + `O` | `T*` + `O` | — | — |
| Update Analytics | `W` | `C` | `C` | — | — | `C` / `T` | `T*` | — | — |
| Archive / cancel Content | `W` | `C` | `C*` | — | — | — | — | — | — |
| Reopen Content / workflow | `W` | `C` | — | — | — | — | — | — | — |
| Create / update assigned Content assets | `W` | `C` | `C` | `T` + `O` | `T` + `O` | `T*` | `T*` + `O` | — | — |
| Manage shared Asset library | `W` | `C` | `C` | — | — | — | — | — | — |
| Manage Music library | `W` | `C` | `C` | — | `T*` | — | — | — | — |
| Select Music for assigned Content | `W` | `C` | `C` | — | `T` | — | `T*` | — | — |
| Create / edit Editing Playbook draft | `W` | `C` | `C` | — | `C*` | — | — | — | — |
| Activate / retire Editing Playbook version | `W` | `C*` | `C*` | — | — | — | — | — | — |
| View Content workflow timeline | `W` | `C` | `C` | `T` | `T` | `T` | `T*` | `V` | `V` |
| View internal Activity Log | `W` | `C` | `C` | `T*` | `T*` | `T*` | `O` | — | — |
| Manage users / roles | `W` | — | — | — | — | — | — | — | — |
| Activate / deactivate users | `W` | — | — | — | — | — | — | — | — |
| Assign / revoke Client access | `W` | `C*` | — | — | — | — | — | — | — |
| Override workflow | `W` | `C` | — | — | — | — | — | — | — |

### Matrix Interpretation Notes

- `Start / Complete Shooting`、`Start Editing`、`Submit First Cut / Revision` 的 `T*` 不表示管理员默认执行这些动作；只有在管理员本人被指派且获相应 action permission 时才可执行。否则应使用 assignment 或受控 override，而不是冒充执行者。
- `Approve / Request Revision` 的唯一默认前提是 `R`。Super Admin、Manager 或 Strategist 若不是该阶段 Reviewer，也不能提交正常 Approval。
- `Client Admin` 的 Approval 只限自己 Client、client-visible 的指定 approval stage；不能看内部 review、内部 revision notes 或内部 reviewer discussion。
- `Record External Approval` 必须记录外部 approver、实际 recorder、时间、channel 以及 notes / evidence。它不是由 recorder 代替 approver 作出决定。
- Strategist 的 assignment 只可从同一 Workspace、同一 Client 的 active members 中选择，不能借此授予 Client access。
- Publisher 可维护 Publication 与基础 Analytics，但不能因此修改 Script、Approval history 或 Editing versions。
- Client Viewer 所见的 workflow timeline 是经过 client-visible 投影后的只读 timeline，不是内部 Activity Log。

## 5. Visibility Matrix

`Full` 表示在其业务 scope 内可见；`Task` 表示只在 assigned Content / Task 中且为执行所需；`Client-visible` 表示仅可见明确对 Client 开放的投影；`Explicit` 表示必须另行授权；`None` 表示默认不可见。

| Data category | Super Admin | Internal Manager | Strategist | Shooter / Editor / Publisher | Intern | Client Admin | Client Viewer |
|---|---|---|---|---|---|---|---|
| Client profile / brand guide | Full | Full (`C`) | Full (`C`) | Task | Task / Explicit | Client-visible | Client-visible |
| Idea / Topic / Script | Full | Full (`C`) | Full (`C`) | Task | Task / Explicit | Client-visible only when shared | Client-visible only when shared |
| Client-visible Notes | Full | Full (`C`) | Full (`C`) | Task | Task | Client-visible | Client-visible |
| Internal Notes | Full | Full (`C`) | Full (`C`) | Explicit, task-only | Explicit, task-only | None | None |
| Private management notes | Full | Full (`C`) | None unless explicitly authorized | None | None | None | None |
| Raw footage / working files / local or NAS paths | Full | Full (`C`) | Full (`C`) | Task | Task / Explicit | None unless a review asset is intentionally shared | None unless a review asset is intentionally shared |
| Shared review media / approved versions | Full | Full (`C`) | Full (`C`) | Task | Task | Client-visible | Client-visible |
| Editing Playbook / internal production standards | Full | Full (`C`) | Full (`C`) | Task | Task / Explicit | None unless separately published as client-visible | None unless separately published as client-visible |
| Music library / licence notes | Full | Full (`C`) | Full (`C`) | Task for Editor | Task / Explicit | None | None |
| Assignments / contributor identities | Full | Full (`C`) | Full (`C`) | Task participants only | Own task only | None by default | None |
| Contribution records | Full | Full (`C`) | Assigned Content only if operationally needed | Own contribution only | Own contribution only | None | None |
| Staff performance / production efficiency | Full | Full (`C`) | None unless explicitly authorized | Own data only if a future feature exposes it | None | None | None |
| Financial / profit-sharing data | Full if introduced and authorized | Explicit if introduced | None | None | None | None | None |
| Internal Activity Log / security events | Full | Client-scoped operational log | Client-scoped content log | Task-scoped only when authorized | Own actions only | None | None |
| Approval evidence | Full | Full (`C`) | Full (`C`) | Task if needed | Task / Explicit | Client-visible approval evidence only | Client-visible only |
| Publication schedule / published links | Full | Full (`C`) | Full (`C`) | Task | Task / Explicit | Client-visible | Client-visible |
| Analytics / reports | Full | Full (`C`) | Full (`C`) | Assigned scope where needed | Explicit | Client-visible | Client-visible read-only |
| Other Clients | Workspace administration only | Only if separately assigned | Only if separately assigned | None | None | None | None |

“Internal” 不是一个可自动向所有员工开放的单一等级。执行角色与 Intern 只看到完成任务所需的内部资料；管理性、绩效性或敏感资料仍需另行隔离。

## 6. Client Isolation Rules

1. Client Admin / Viewer 必须同时拥有 active Workspace membership 与对应 Client 的 active Client membership。
2. 每次读取或写入 Client-bound 数据都必须以实际 `client_id` 检查 membership；不能只依赖前端筛选、URL 或当前选中的 Client。
3. Client Admin / Viewer 不得查询、搜索、统计、导出或通过关联关系推断其他 Client 的数据，包括名称、成员、内容数量与资产路径。
4. Client 数据面只能包含明确标记或投影为 client-visible 的数据。以下内容一律不进入 Client 数据面：
   - Internal Notes
   - Private management notes
   - Staff performance / production efficiency
   - Contribution records 与内部 attribution
   - Financial / profit-sharing data
   - 内部 Activity Log、security events 与 override discussion
   - Workspace user directory 与内部角色配置
   - Local / NAS path、未共享 raw footage、内部工作文件
   - 其他 Clients
5. Client Admin 可以在自己 Client 的指定 Client Approval stage 中 Approve / Request Revision；Client Viewer 永远只读。
6. 向 Client 共享 review media、版本、notes 或 evidence 必须是显式动作；“文件存在”或“内部用户可见”不等于 Client 可见。
7. Workspace-wide Asset、Music、Playbook 或 Reference library 不自动对 Client users 开放。需要对 Client 展示的资料必须有独立的 client-visible 表达。
8. Client-facing export、report 与 notification 必须使用相同的 Client scope 和 visibility 规则，不能绕过主应用的数据边界。
9. Client membership 被停用或移除后，访问立即终止；历史审批与操作记录仍保留原 actor attribution。

## 7. Intern Least Privilege

- Intern 不因 Role 本身获得整个 Workspace 或整个 Client 的浏览权。
- 每个 Intern assignment 至少要明确：Client、Content / Task、允许动作、可见资料与有效期或任务结束条件。
- 默认只可读取 client-visible brief、明确共享的 task instructions、指定 assets 与适用 playbook；Internal Notes、其他任务、其他 Client、绩效、贡献汇总和管理资料默认不可见。
- 若 Intern 实际承担 Shooting、Editing、Publishing 或 Idea / Script work，应通过明确 assignment 与对应 action permission 授权，并以 Intern 本人作为 actor。
- 完成或取消任务后，task-level access 应撤销或失效；历史 contribution 与 activity attribution 保留。
- Intern 不能分配人员、改变 Client access、审批自己的产出、修改历史事件或使用 override。

## 8. Override Rules

1. Super Admin 可在 Workspace 内 override；Internal Manager 只可在 assigned Client 内 override。
2. Override 用于更正错误状态、处理阻塞或恢复流程，不用于规避正常 assignment、approval 或 publication control。
3. 每次 override 必须生成不可静默删除的 Activity Log，并至少记录：
   - actor 与其当时的 Role / permission
   - Workspace、Client 与相关 entity
   - 原状态 / 原值与新状态 / 新值
   - reason
   - timestamp
   - 相关 workflow event 或 evidence（如适用）
4. Workflow lifecycle 的 override 应同时新增对应 workflow event；不能覆盖或删除原 event。
5. Override 不能跨 Workspace、绕过 Client isolation、读取非 client-visible 数据，或把 inactive user 的历史动作改归他人。
6. Override 不等于 Approval。若业务决定跳过 required approval，必须明确记录为“approval requirement changed / waived by override”，保留原因，不能伪造 Reviewer approval。
7. 对 published record、external approval、active playbook version 等高影响对象的 override 应要求明确 reason；是否需要 second approver 留作 Open Question。

## 9. Role + Additional Permissions

V0.1 使用稳定、可审计的权限目录和预设 Role，不建立复杂的自定义权限 UI。

- 一个用户可有多个 Role。
- 未来 additional permission 应采用显式、可撤销、可审计的 scoped grant，而不是复制一个新 Role 名称。
- grant 必须包含 action、scope、授予者、授予时间，以及可选的到期时间 / reason。
- additional permission 只能扩展动作能力，不能自动创建 Workspace membership、Client membership 或 Client-visible access。
- inactive membership、Client isolation 与数据分类限制始终优先。
- V0.1 若尚未实现 per-user permission grant，可通过增加预设 Role 或由 Super Admin 作明确 assignment 处理；不得用前端隐藏按钮代替后端授权。

## 10. Future RLS Guidance

本节只定义边界原则，不包含 RLS SQL、Policy 或 migration。

### 10.1 Workspace Membership Boundary

- 所有受保护请求先验证 authenticated user 对当前 Workspace 的 active membership。
- Workspace-scoped tables 以 `workspace_id` 为第一层隔离键。
- Super Admin 的 `W` 只在当前 Workspace 内有效，不构成跨 Workspace 权限。
- Deactivated user 或 inactive membership 不应继续读取或写入业务数据。

### 10.2 Client Membership Boundary

- Client-bound tables 必须验证 active `client_members` record，再结合 Role / permission 判断动作。
- Content child records 可通过 `content_id` 继承 Client ownership；高频表中保留的 `workspace_id` / `client_id` 应同时校验一致性。
- Super Admin 的 Workspace 管理访问必须是可辨识的管理路径；不能把 Client membership 检查从所有角色中整体移除。
- Client Admin / Viewer 只能命中自己的 Client UUID，并进入 client-visible projection。

### 10.3 Role / Permission Boundary

- `roles`、`permissions`、`role_permissions` 决定 action capability；membership 决定 scope；assignment / ownership / reviewer 决定具体 entity 上能否执行。
- 写入 policy 不能只检查“能否看见 row”，还要检查 action permission、assignment 与合法状态转换。
- 多 Role 权限可合并，但显式 boundary（inactive、wrong Client、non-client-visible）优先拒绝。
- 未来 per-user additional permission 需要独立、可审计的 scoped grant 设计；在数据库结构正式补充前不得假设已经存在。

### 10.4 Client-visible Data Boundary

- RLS 是 row-level 边界，不能单独保证同一 row 中 internal column 不泄漏。
- Client portal / API 应使用安全 view、受控 RPC 或独立 client-visible projection，只选择获准字段；Client role 不应直接读取包含 Internal Notes、local paths 或管理字段的 base tables。
- Workflow events、approval evidence、assets 和 reports 需要明确 visibility，避免仅靠 UI 隐藏。
- Service role 或后台任务必须自行带入并验证 Workspace / Client context，不应成为绕过 Client isolation 的通用访问路径。

## 11. Remaining Permission Questions

1. Internal Manager 在 V0.1 是否默认可 Create / Archive Client，还是必须由 Super Admin 逐项授予 `client.create` / `client.archive`？
2. Internal Manager 是否可 Assign / Revoke Client access，还是 V0.1 完全由 Super Admin 管理？
3. Strategist 是否默认可建立 Publication 与安排 Publisher，或这些动作应只属于 Manager / Publisher？
4. 哪些 approval stages 可由同一个人同时作为内容生产者与 Reviewer？哪些阶段必须禁止 self-approval？
5. Client Approval 是否只允许 Client Admin，还是也需要指定外部 Reviewer（未登录用户）的 identity / evidence 机制？
6. 谁可以把 required Publication 从计划中移除，或把 required approval 改成非 required？是否需要 second approver？
7. Workflow override、published record correction 与 Editing Playbook activation 是否需要 second approver 或更高等级审计？
8. `Internal Notes` 是否需要再拆成 operational internal notes 与 private management notes？当前单一字段不足以同时满足执行者所需信息与管理资料隔离。
9. Workflow event notes、approval evidence 与 assets 是否需要独立的 `internal / client-visible` visibility 属性？
10. Client users 是否可看 contributor display name，还是 Client 数据面只显示团队 / 状态而隐藏个人 attribution？
11. Client users 是否可以下载共享 review media、final asset 与 report，还是只允许在线查看？
12. Workspace-wide Asset、Music、Reference 与 Playbook 是否允许跨 Client 复用；若允许，哪些 metadata 可向 Client 展示？
13. Publisher 更新 Analytics 的范围是 assigned Publications，还是 assigned Client 下全部平台账号？同一平台多账号时是否需要 account-level permission？
14. Intern 的 task access 由谁授予、何时自动失效，以及能否由 Manager 以外的 task owner 撤销？
15. Activity Log 的保留期、敏感字段遮罩、Client-facing event projection 与导出权限如何定义？
