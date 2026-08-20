# ContentOS V0.1 Database Schema

Status: Draft

本文定义 ContentOS V0.1 的逻辑 Supabase / PostgreSQL Schema。它不包含 SQL、migration、RLS Policy 或实际 Supabase 资源。

## 1. Design Principles

1. **Multi-client from day one**：所有 Client 业务数据归属于轻量 Workspace ownership root，不写死 LKSoft。
2. **Lightweight Workspace**：V0.1 预计只有一个 `ContentOS / Internal Team` Workspace；Workspace 只提供 ownership boundary，不实现 Multi-tenant SaaS。
3. **Content is the core**：Reference 与 Idea 是上游来源；Script、Workflow、Media、Approval、Publication、Analytics 与 Assets 围绕 Content 关联。
4. **Media stays external**：Database 只保存 Google Drive URL、Local / NAS path 与 Metadata，不保存大型视频 binary。
5. **History is append-oriented**：Workflow Event、Script Version、Media Version、Approval、Revision、Analytics Snapshot 与 Activity Log 不被新状态覆盖。
6. **Current state plus history**：`contents.current_status` 支持列表与 Dashboard；`workflow_events` 是 Lifecycle history 的 Source of Truth。
7. **Approval targets evidence**：Approval 指向明确 Content、Script Version、Media Version 或 Publication，不使用单一 `approved = true`。
8. **Publication is separate**：同一 Content 可以有多个平台、账号、排期、URL 与 Analytics；Content + Platform 不假设唯一。
9. **Analytics belongs to Publication**：Facebook 与 XHS Snapshot 不直接混在 Content。
10. **Derived efficiency**：Cycle time、Revision Count、On-time 与 Publication Aggregate 从 Source Records 推导。
11. **Contribution is not performance**：记录参与事实，不以 Views 自动评价 Contributor，也不在 V0.1 计算 Profit Sharing。
12. **No destructive history defaults**：历史业务记录优先 Deactivate、Archive、Cancel，不默认 Cascade Delete。
13. **RLS-ready ownership**：常用和高流量实体直接保留 Workspace / Client boundary；简单子表通过 Content / Publication 继承 ownership。
14. **Relational first**：使用清楚 FK 与 Join Table；JSONB 只用于频繁变化的 Editing Style、平台特有 Analytics 与审计摘要。
15. **No generic framework**：不设计 EAV、generic entity system、polymorphic everything 或复杂 Event Sourcing。Workflow Events 仅记录业务生命周期。

命名约定：

- PostgreSQL table / field 使用 `snake_case`。
- Table 使用复数名词。
- 主业务实体以 UUID `id` 为 Primary Key。
- Human-readable code 与 UUID 分开。
- 时间使用带时区 timestamp 概念；本文不指定 SQL type 语法。

## 2. Entity Overview

| Domain | Primary entities | Purpose |
| --- | --- | --- |
| Workspace & Identity | `workspaces`, `user_profiles`, `workspace_members` | Ownership root 与 User lifecycle |
| RBAC foundation | `roles`, `permissions`, `role_permissions`, `workspace_member_roles` | 基础 Role / Permission 关系，具体矩阵留到 Phase 4 |
| Client access | `clients`, `client_members` | Client ownership 与访问范围 |
| Classification | `content_categories`, `tags`, `platforms`, `contribution_roles` | User-manageable 或稳定 lookup |
| Research | `references`, `reference_clients`, `reference_tags` | Reference Account / Content 与适用 Client |
| Ideation | `ideas`, `idea_references`, `idea_contributors` | Idea lifecycle、来源与贡献 |
| Planning | `campaigns`, `contents`, `content_tags` | Content core、业务 ID、分类与 Campaign |
| Production | `script_versions`, `workflow_events`, `media_versions` | 不可覆盖的生产历史 |
| Review | `content_approval_requirements`, `approvals`, `revision_requests` | Requirement、Decision 与 Revision 分离 |
| Publishing | `publications`, `analytics_snapshots` | 多平台发布与 Snapshot |
| Assets | `assets`, `content_assets`, `asset_tags` | 外部文件索引与复用 |
| Music | `music_tracks`, `content_music` | 多 Track 使用关系 |
| Standards | `editing_playbooks`, `editing_style_versions` | Client Editing Standard 与 immutable version |
| Schedule | `calendar_events` | Calendar View，不代表 Workflow Status |
| Audit | `activity_logs` | 通用操作审计 |

页面／能力的数据来源：

- Dashboard / Filters：`contents` + `workflow_events` + `publications` + `calendar_events`。
- Reference / Idea：Reference 与 Idea domain tables。
- Content detail：Content core 及所有 Content-owned child tables。
- Review / Revision：Approval 与 Revision tables，关联 Script / Media Versions。
- Publishing / Analytics：`publications` → `analytics_snapshots`。
- Playbook / Music / Asset：各 Library 与 Join Tables。
- User / Client management：Workspace、RBAC 与 Client access tables。

## 3. Workspace & Users

### 3.1 `workspaces`

Workspace 是最上层数据 ownership root，不代表 V0.1 要做 SaaS tenancy。

最低字段：

- `id`
- `name`
- `status`：Active / Archived
- `created_at`
- `updated_at`

V0.1 只需一条 Workspace，但所有 Client 与 Membership 必须引用它。

### 3.2 `user_profiles`

未来与 Supabase `auth.users` 一对一对应；`id` 使用相同 User UUID。不得保存 password、token、Authentication secret 或 service role key。

字段：

- `id`
- `display_name`
- `email`
- `avatar_url`
- `job_title`
- `status`：Active / Deactivated
- `created_at`
- `updated_at`
- `deactivated_at`

User 不 hard delete；历史 Contribution 与 Activity 保留 Profile 引用。

### 3.3 `roles`

Workspace-scoped Role definition，例如 Super Admin、Internal Manager、Strategist、Shooter、Editor、Publisher、Intern、Client Admin、Client Viewer。

字段：

- `id`
- `workspace_id`
- `code`
- `name`
- `description`
- `is_active`
- `created_at`
- `updated_at`

本阶段只定义结构，不定义完整 Role matrix。

### 3.4 `permissions`

稳定 Permission catalog，例如内容查看、内容编辑、审核、发布或 User 管理的 permission key。

字段：

- `id`
- `code`
- `name`
- `description`
- `is_active`

Permission catalog 属于系统级稳定配置；具体 keys 与允许范围在 `docs/04-permissions.md` 定义。

### 3.5 `role_permissions`

Role ↔ Permission many-to-many：

- `role_id`
- `permission_id`
- `created_at`

同一 Role / Permission pair 唯一。历史 Role 停用不删除其关系记录。

### 3.6 `workspace_members`

表达 User 在 Workspace 中的 Membership，不把 Role 或 User 状态混为一体。

字段：

- `id`
- `workspace_id`
- `user_profile_id`
- `status`：Active / Deactivated
- `joined_at`
- `updated_at`
- `deactivated_at`

同一 User 在同一 Workspace 只有一条 Membership。

### 3.7 `workspace_member_roles`

允许同一人同时是 Strategist + Shooter 或 Editor + Publisher，避免 `workspace_members.role_id` 限制单一 Role。

字段：

- `workspace_member_id`
- `role_id`
- `assigned_at`
- `assigned_by`

同一 Membership / Role pair 唯一；Role 必须属于相同 Workspace。

## 4. Clients & Access

### 4.1 `clients`

字段：

- `id`
- `workspace_id`
- `name`
- `code`：例如 `LK`，用于 Human Content Code
- `industry`
- `description`
- `status`：Active / Archived
- `brand_notes`
- `created_at`
- `updated_at`
- `archived_at`

`code` 在 Workspace 内唯一、短且稳定；不得写死为 LKSoft。

### 4.2 `client_members`

控制 Internal User 或未来 Client User 可访问哪些 Client。

字段：

- `id`
- `client_id`
- `workspace_member_id`
- `role_id`：该 Client 范围内的 Role / Access
- `status`：Active / Deactivated
- `assigned_at`
- `assigned_by`
- `deactivated_at`

规则：

- Workspace Member、Role 与 Client 必须属于同一 Workspace。
- 同一 Client / Member / Role pair 唯一。
- V0.1 不写真正 RLS Policy；该关系为未来 RLS 的 Client access input。
- Client User 也必须先是 Workspace Member，不建立第二套 User identity。

## 5. Reference Library

### 5.1 `references`

统一承载 Reference Account 与 Reference Content，`reference_type = account / content` 足够满足 V0.1。Reference Content 可通过 `parent_reference_id` 关联 Reference Account。

字段：

- `id`
- `workspace_id`
- `client_id` optional：为空表示 Workspace library；有值表示 Client-specific
- `reference_type`
- `parent_reference_id` optional
- `title`
- `account_name` optional
- `platform_id` optional
- `url`
- `industry`
- `country`
- `content_style`
- `format`
- `why_it_works`
- `learning_notes`
- `gold_standard`
- `status`：Active / Archived
- `created_by`
- `created_at`
- `updated_at`
- `archived_at`

规则：

- `parent_reference_id` 只允许 Content Reference 指向同 Workspace 的 Account Reference。
- Convert to Idea 不删除或改变 Reference lifecycle。
- URL 可以重复用于不同分析角度，不设置过严的全局唯一。

### 5.2 `reference_clients`

Reference 的 ownership scope 与“适合哪些 Client”不是同一概念。此 Join Table 表达 Suitable Clients：

- `reference_id`
- `client_id`
- `notes`
- `created_at`

同一 Reference / Client pair 唯一，且 Workspace 必须一致。

### 5.3 `tags`

统一 Tag catalog，供 Reference、Content 与 Asset 使用：

- `id`
- `workspace_id`
- `client_id` optional
- `name`
- `is_active`
- `sort_order`
- `created_at`
- `updated_at`

Scope 选择：`workspace_id` 必填；`client_id = null` 为 Workspace-wide Tag，非空为 Client-specific Tag。这样保留共享 Tag，同时避免独立 global tenant。

### 5.4 `reference_tags`

- `reference_id`
- `tag_id`
- `created_at`

同一 pair 唯一；Tag scope 必须允许该 Reference 使用。Tag 不使用 JSON array 或逗号字符串。

## 6. Ideas

### 6.1 `ideas`

V0.1 Idea 直接归属一个 Client。若同一 Reference 适合多个 Client，应建立各自 angle 的 Idea，使 ownership 与执行策略清楚。

字段：

- `id`
- `workspace_id`
- `client_id`
- `title`
- `source_url`
- `original_topic`
- `original_hook`
- `why_it_works`
- `our_angle`
- `category_id` optional
- `suggested_format`
- `priority`
- `status`：New / Evaluating / Approved / Converted / Rejected / Archived
- `owner_user_id`
- `notes`
- `created_by`
- `created_at`
- `updated_at`
- `archived_at`

不在 Ideas 保存 `converted_content_id`。由 `contents.source_idea_id` 指回 Idea，避免双向必填与不必要循环；Idea 是否 Converted 可由明确 Action 更新 status，并从 Content 关系验证。一个 Idea 可在有业务需要时产生多条 Content，因此不对 `source_idea_id` 设唯一。

### 6.2 `idea_references`

Idea 可来自多个 References：

- `idea_id`
- `reference_id`
- `relationship_notes`
- `created_at`

同一 pair 唯一；Reference 必须在相同 Workspace，且其 scope 对 Idea Client 可见。

### 6.3 `idea_contributors`

- `idea_id`
- `user_profile_id`
- `contribution_role_id`
- `notes`
- `created_at`

不加入 percentage / weight。V0.1 只记录参与事实，Profit Sharing 留到 Future。

## 7. Content Core

### 7.1 `content_categories`

User-manageable Category，不使用 PostgreSQL Enum。

字段：

- `id`
- `workspace_id`
- `client_id` optional
- `name`
- `description`
- `is_active`
- `sort_order`
- `created_at`
- `updated_at`

Scope 与 Tags 相同：Workspace-wide 或 Client-specific。停用 Category 不影响历史 Content。

### 7.2 `campaigns`

V0.1 加入最小 Campaign table，因为 Product Spec 要求 Campaign Filter、Campaign Report 数据基础，以及多个 Content 的一致分组；使用自由文本会产生拼写分裂。

字段：

- `id`
- `workspace_id`
- `client_id`
- `name`
- `code` optional
- `status`：Active / Archived
- `starts_at` optional
- `ends_at` optional
- `notes`
- `created_at`
- `updated_at`
- `archived_at`

不在 V0.1 增加 Budget、复杂目标或 Campaign automation。

### 7.3 `contents`

核心字段：

- `id`：UUID Primary Key
- `workspace_id`
- `client_id`
- `source_idea_id` optional
- `content_code`：例如 `LK-2026-001`
- `title`
- `category_id` optional
- `campaign_id` optional
- `format`
- `priority`
- `current_status`
- `hook`
- `cta`
- `current_owner_user_id` optional
- `current_script_version_id` optional
- `editing_style_version_id` optional
- `target_publish_at` optional：早期内容目标；实际平台 schedule 在 Publications
- `internal_notes`
- `client_visible_notes`
- `cancelled_at` optional
- `cancelled_by` optional
- `cancellation_reason` optional
- `archived_at` optional
- `created_by`
- `created_at`
- `updated_at`

设计决定：

- UUID 负责稳定关系；`content_code` 是 Human-readable business ID。
- `content_code` 在 Workspace 内唯一；Client code + year + sequence 是显示策略，不以字符串替代 Client FK。
- `current_status` 为查询快照；Lifecycle history 由 `workflow_events` 保留。
- Platform 不直接写成单值；计划与实际平台存在 `publications`。
- `current_script_version_id` 值得在 V0.1 使用，指向当前被选定继续编辑／执行的 operational version；它必须属于同一 Content。最新有效 Approved Script 由明确 Approval 记录识别，不增加第二个缓存指针。
- Editing Style 指向明确 Version，保证 Playbook 更新后历史可解释。

### 7.4 `content_tags`

- `content_id`
- `tag_id`
- `created_at`

同一 pair 唯一；Tag scope 必须覆盖 Content Client。

## 8. Contributors

### 8.1 `contribution_roles`

Lookup Table，而不是把每个 Role 变成 `contents` 上的固定 user column。

字段：

- `id`
- `workspace_id`
- `code`
- `name`
- `description`
- `is_active`
- `sort_order`

Seed 至少包括 Idea Creator、Strategist、Script Writer、Shooter、Talent、Editor、Reviewer、Cover Designer、Publisher、Analytics、Client Communication。Workspace 可停用或增加 Role；历史关系保留。

### 8.2 `content_contributors`

Content ↔ User ↔ Contribution Role：

- `id`
- `content_id`
- `user_profile_id`
- `contribution_role_id`
- `notes`
- `added_by`
- `created_at`

同一 Content / User / Contribution Role pair 唯一。允许同一 Role 多人、同一人多个 Role。不保存 Profit percentage 或自动 performance score。

`idea_contributors` 与 `content_contributors` 共用 `contribution_roles`，但 Convert Idea 时必须明确复制／建立实际 Content contribution，而不是假设所有 Idea Contributor 自动参与生产。

## 9. Script Versioning

### 9.1 `script_versions`

字段：

- `id`
- `content_id`
- `version_number`
- `body`
- `status`：Draft / Submitted / Approved / Superseded
- `created_by`
- `submitted_by` optional
- `created_at`
- `submitted_at` optional
- `notes`

规则：

- `content_id + version_number` 唯一。
- 新修改建立新 Version，不覆盖旧 body。
- Script Approval 必须指向具体 `script_version_id`。
- `contents.current_script_version_id` 是明确的当前工作／已采用版本指针；更新指针产生 Activity Log。
- Current pointer 与 Version status 不取代 Approval record。
- Hook / CTA 可以作为 Content-level operational metadata；若某版本脚本修改它们，更新行为仍应留 Activity。

## 10. Workflow Events

### 10.1 `workflow_events`

Lifecycle history 的 Source of Truth。它不是通用 Event Sourcing framework，也不代替所有实体表。

字段：

- `id`
- `workspace_id`
- `client_id`
- `content_id`
- `event_type`
- `actor_user_id`
- `occurred_at`
- `from_state` optional
- `to_state` optional
- `notes`
- Narrow optional relationships：
  - `script_version_id`
  - `media_version_id`
  - `approval_id`
  - `revision_request_id`
  - `publication_id`
  - `calendar_event_id`
- `metadata` optional JSONB：仅放 event-specific small context，不代替核心 FK
- `created_at`

Event types 至少覆盖：

- Content Created
- Script Ready
- Shoot Scheduled / Rescheduled
- Shoot Started / Completed / Cancelled
- Editing Started
- Editing Blocked
- Editing Unblocked
- First Cut Submitted
- Internal Review Started
- Revision Requested / Submitted
- Internal Approved
- Client Review Started / Client Approved
- External Approval Recorded
- Publication Scheduled / Published / Failed
- Analytics Snapshot Added
- Content Cancelled
- Content Reopened
- Content Completed
- Override / Correction

设计：

- `contents.current_status` 与最新有效 Workflow Action 同步，用于快速筛选。
- Event 不因状态修正而删除；Override 建立新 Event，记录 before / after 与 reason。
- `workspace_id` / `client_id` 在此高频跨 Content 查询表直接保留，便于效率 Dashboard 与未来 RLS；必须与 Content ownership 一致。
- Event related links 使用有限、明确 FK，不采用任意 `entity_type + entity_id` 替代所有关系。

## 11. Media Versions

### 11.1 `media_versions`

First Cut、Revision、Final 统一为 Media Version 是合理的：它们共享外部文件位置、Version、提交人与审核关系，并按 `version_type` 区分。

字段：

- `id`
- `content_id`
- `version_number`
- `version_type`：First Cut / Revision / Final
- `drive_url` optional
- `local_path` optional
- `nas_path` optional
- `submitted_by`
- `submitted_at`
- `notes`
- `created_at`

规则：

- `content_id + version_number` 唯一。
- Database 不保存 binary。
- Approval 与 Revision Request 指向明确 Media Version。
- Final 是业务标记，不允许覆盖此前 V1 / V2。
- 若同一 Content 有不同平台裁切版，可建立独立 Media Version 并在 Notes / type 中说明；复杂 rendition model 延后。

## 12. Approval & Revision

### 12.1 `content_approval_requirements`

Approval decision 之前必须先知道哪些 checkpoint Required。

字段：

- `id`
- `content_id`
- `approval_type`：Topic / Script / Internal Video / Client / Final
- `is_required`
- `assigned_reviewer_user_id` optional
- `notes`
- `configured_by`
- `created_at`
- `updated_at`

同一 Content / Approval Type 唯一。V0.1 在 Content 层配置，不增加复杂 Client default rules UI；未来可从 Client defaults 预填。

### 12.2 `approvals`

字段：

- `id`
- `content_id`
- `approval_type`
- `target_type`：Content / Script Version / Media Version / Publication
- Explicit target FKs, as applicable：
  - `script_version_id`
  - `media_version_id`
  - `publication_id`
- `requested_reviewer_user_id` optional
- `approver_user_id` optional
- `external_approver_name` optional
- `result` optional until decided：Approved / Revision Required
- `requested_at` optional
- `decided_at` optional until decided
- `channel`：ContentOS / WhatsApp / Face-to-face / Call / Other
- `recorded_by_user_id`
- `notes`
- `evidence_url` optional
- `created_at`

规则：

- Content target 不需要额外 target id；Content FK 已存在。
- Script / Media / Publication target 必须填对应明确 FK，且属于同一 Content。
- External Approval 区分 Approver 与 Recorded by。
- 新 Version 不继承旧 Version Approval。
- 不使用单一 Boolean 作为 Approval history。

### 12.3 `revision_requests`

保留独立 Table。虽然 Approval 与 Workflow Event 能记录“要求修改”，独立 Revision Request 才能可靠分析 Version、Reason、Resolution time 与 resulting version。

字段：

- `id`
- `content_id`
- `review_scope`：Internal / Client
- `target_type`：Script Version / Media Version
- `source_script_version_id` optional
- `source_media_version_id` optional
- `requested_by_user_id` optional
- `external_reviewer_name` optional
- `reason_code`：Subtitle / Pacing / Hook / Visual / Brand / Information / Client Request / Audio / Other
- `reason_notes`
- `requested_at`
- `status`：Open / Resolved / Cancelled
- `resolved_at` optional
- `resulting_script_version_id` optional
- `resulting_media_version_id` optional
- `created_at`
- `updated_at`

Reason codes 是稳定的系统级分析维度，V0.1 使用 constrained value；`Other` 必须有 Notes。若 Pilot 证明需要 User-managed reasons，再迁移为 Lookup，不提前增加配置表。

Workflow Event 记录生命周期发生；Revision Request 保存可分析的业务对象。两者通过 `revision_request_id` 关联而不重复职责。

## 13. Publications

### 13.1 `platforms`

Lookup Table，避免 PostgreSQL Enum 阻碍未来增加平台。

字段：

- `id`
- `code`：facebook / xhs / instagram / tiktok / youtube
- `name`
- `is_active`
- `sort_order`

V0.1 激活 Facebook 与 XHS；其他可保留 inactive 或后续新增。

### 13.2 `publications`

字段：

- `id`
- `workspace_id`
- `client_id`
- `content_id`
- `platform_id`
- `platform_account` optional
- `publication_sequence`：同 Content / Platform 的 repost 顺序
- `is_required`
- `assigned_publisher_user_id` optional
- `status`：Draft / Scheduled / Published / Failed / Archived
- `scheduled_at` optional
- `published_at` optional
- `url` optional
- `platform_post_id` optional
- `notes`
- `failure_reason` optional
- `created_at`
- `updated_at`
- `archived_at` optional

规则：

- 不对 `content_id + platform_id` 设唯一；允许 repost 或同平台不同账号。
- 建议 `content_id + platform_id + publication_sequence` 唯一。
- 当 `platform_post_id` 存在时，可在 Platform + Account 范围防止重复；Account 缺失时不要过严。
- URL 采用 duplicate warning，通常不做全局 hard unique；同一 URL 可能因迁移、追踪参数或修正重复出现。
- Content-level Not / Partially / Fully Published 从 `is_required + status` 派生，不手填 Boolean。
- 直接保留 Workspace / Client，支持发布队列、平台 Dashboard 与 RLS；必须与 Content 一致。

## 14. Analytics

### 14.1 `analytics_snapshots`

字段：

- `id`
- `workspace_id`
- `client_id`
- `publication_id`
- `snapshot_type`：24h / 7d / 30d / Current / Custom
- `captured_at`
- `data_source`：Manual / CSV / Scraper / API / Client Backend
- `entered_by_user_id`
- Common nullable metrics：
  - `views_or_reads`
  - `reach`
  - `likes_or_reactions`
  - `comments`
  - `shares`
  - `saves`
  - `watch_time_seconds`
  - `average_watch_time_seconds`
  - `followers_gained`
  - `leads`
- `platform_metrics` JSONB
- `notes`
- `created_at`
- `updated_at`

混合设计理由：

- Common columns 支持跨平台筛选、汇总、Report 与基准计算。
- JSONB 只保存平台独有或未来变化快的 metrics，避免每新增一个平台指标就 migration。
- 全部 JSONB 会削弱类型、索引与常用分析；全部 columns 会产生大量平台无关 nullable fields。
- JSONB key 需要平台级文档与单位说明，不能放身份、ownership 或核心通用指标。

同一 Publication / Snapshot Type 可以有多次 capture 或 correction，不设置过严唯一；`captured_at` 与 Activity Log 解释历史。Analytics 高频且通过 Publication → Content 是两层关系，因此直接保留 Workspace / Client 便于 RLS 和报表，并强制 ownership 一致。

## 15. Asset Library

### 15.1 `assets`

只保存外部文件索引：

- `id`
- `workspace_id`
- `client_id`
- `name`
- `file_name`
- `asset_type`
- `orientation`
- `shoot_date`
- `local_path` optional
- `nas_path` optional
- `drive_url` optional
- `reusable`
- `notes`
- `created_by`
- `created_at`
- `updated_at`
- `archived_at` optional

至少一个位置字段存在才算可用 Asset，但允许先建立待补链接的 Draft index。Asset 不保存 binary。

### 15.2 `content_assets`

Content ↔ Asset many-to-many：

- `content_id`
- `asset_id`
- `usage_notes`
- `created_at`

同一 pair 唯一。Asset 与 Content 必须属于同一 Workspace；跨 Client 复用默认不允许，若未来需要共享素材必须有明确授权规则。

### 15.3 `asset_tags`

- `asset_id`
- `tag_id`
- `created_at`

同一 pair 唯一；使用统一 `tags` catalog，不保存逗号字符串。

## 16. Music Library

### 16.1 `music_tracks`

字段：

- `id`
- `workspace_id`
- `client_id` optional：为空为 Workspace library
- `title`
- `source`
- `source_url` optional
- `local_path` optional
- `music_type`
- `mood`
- `recommended_usage`
- `recommended_volume` optional
- `brand_music`
- `copyright_notes`
- `created_by`
- `created_at`
- `updated_at`
- `archived_at` optional

Music Type 在 V0.1 使用可编辑 text / suggestion，而不是 hard enum，避免阻碍团队新增分类。

### 16.2 `content_music`

允许一条 Content 使用多首 Track：

- `id`
- `content_id`
- `music_track_id`
- `selected_by_user_id`
- `usage_notes`
- `volume` optional
- `segment` optional
- `created_at`

不对 Content 设置单 Track 唯一。Track scope 必须允许 Content Client 使用。

## 17. Editing Playbooks

### 17.1 `editing_playbooks`

每个 Client 可有多个 Playbook，例如 Talking Head、Workshop Recap。

字段：

- `id`
- `workspace_id`
- `client_id`
- `name`
- `description`
- `status`：Active / Archived
- `created_by`
- `created_at`
- `updated_at`
- `archived_at` optional

### 17.2 `editing_style_versions`

字段：

- `id`
- `editing_playbook_id`
- `version_number`
- `name` optional
- `style_config` JSONB
- `qa_notes`
- `created_by`
- `created_at`
- `published_at` optional
- `status`：Draft / Active / Superseded / Archived

`style_config` 可表达 fonts、subtitle、highlight、safe area、transition、effects、zoom、B-roll、music、SFX、audio level、pacing、cover 与 export specs。

JSONB 在这里合理，因为 Style config 会频繁演化、不同 Content format 需要不同结构，且历史 Version 整体应保持 immutable。关键 identity、Client ownership、Version、status 与时间仍使用 relational columns。已被 Content 使用的 Active Version 不原地改写；建立新 Version，并由 `contents.editing_style_version_id` 记录当时标准。

## 18. Calendar

### 18.1 `calendar_events`

字段：

- `id`
- `workspace_id`
- `client_id` optional
- `content_id` optional
- `publication_id` optional
- `event_type`：Shooting / First Cut Due / Review Due / Publishing / Meeting / Workshop Event
- `title`
- `starts_at`
- `ends_at` optional
- `assigned_user_id` optional
- `location`
- `notes`
- `external_calendar_id` optional：Future sync
- `status`：Scheduled / Completed / Cancelled
- `created_by`
- `created_at`
- `updated_at`
- `cancelled_at` optional

规则：

- Standalone Meeting / Workshop 可以只归属 Workspace / Client。
- Publishing Event 应优先关联 Publication；Shooting / Due Event 关联 Content。
- Calendar Event 表示 Schedule，不代表 Shoot、Review 或 Publish 已实际发生。
- Reschedule 更新当前 schedule 并通过 Activity Log / Workflow Event 保留 old/new summary。
- Google Calendar future integration 只同步 schedule，Workflow status 仍由 ContentOS Action 决定。

## 19. Activity Logging

### 19.1 `activity_logs`

通用 Audit Trail：

- `id`
- `workspace_id`
- `actor_user_id` optional：系统动作可为空并标明 actor type
- `client_id` optional
- `entity_type`
- `entity_id`
- `action`
- `before_summary` optional JSONB
- `after_summary` optional JSONB
- `metadata` optional JSONB
- `created_at`

### Workflow Events vs Activity Logs

- **Workflow Events**：只记录 Content Lifecycle 的业务事件，可用于状态历史与 Efficiency，例如 Shoot Completed、Revision Submitted、Published。
- **Activity Logs**：记录所有关键 Audit 行为，例如修改 Priority、Assign User、Deactivate User、更新 Tag、修正 Analytics 或 Override。
- 一个 Action 可以同时产生 Workflow Event 与 Activity Log，但两者用途不同；它们通过 Content / entity 与 timestamp 关联，不要求复制完整 payload。
- Activity Log 的 `entity_type + entity_id` 是受控的通用审计例外，因为 Audit 必须覆盖多种实体；核心业务关系仍使用明确 FK，不把整个 Schema 设计成 polymorphic system。
- Before / After JSONB 只存必要摘要，不能成为业务实体的唯一 Source of Truth。
- Activity Log append-only，不提供普通 User 删除。

## 20. ER Relationship Summary

```text
Workspace
├── Workspace Members ── User Profiles
│   └── Member Roles ── Roles ── Role Permissions ── Permissions
├── Clients
│   ├── Client Members ── Workspace Members
│   ├── Content Categories
│   ├── Campaigns
│   ├── References
│   │   ├── Reference Clients ── Clients
│   │   └── Reference Tags ── Tags
│   ├── Ideas
│   │   ├── Idea References ── References
│   │   ├── Idea Contributors ── Users / Contribution Roles
│   │   └── Contents (via source_idea_id)
│   ├── Contents
│   │   ├── Content Contributors ── Users / Contribution Roles
│   │   ├── Content Tags ── Tags
│   │   ├── Script Versions
│   │   ├── Workflow Events
│   │   ├── Media Versions
│   │   ├── Approval Requirements
│   │   ├── Approvals ── Script / Media / Publication target
│   │   ├── Revision Requests ── Source / Resulting Versions
│   │   ├── Publications ── Platforms
│   │   │   └── Analytics Snapshots
│   │   ├── Content Assets ── Assets ── Asset Tags ── Tags
│   │   ├── Content Music ── Music Tracks
│   │   └── Editing Style Version ── Editing Playbook
│   ├── Calendar Events ── Content / Publication
│   └── Activity Logs
└── Workspace-wide Tags / Music / References
```

关键 cardinality：

- Workspace 1 → many Clients / Members / Roles。
- Client 1 → many Ideas / Contents / Assets / Playbooks / Campaigns。
- Reference many ↔ many Ideas；Reference many ↔ many Suitable Clients。
- Idea 1 → zero or many Contents；Content → zero or one Source Idea。
- Content 1 → many Contributors、Versions、Events、Approvals、Revisions、Publications、Assets 与 Music。
- Publication 1 → many Analytics Snapshots。
- Asset / Music / Tag 可通过 Join Tables 被多个 Content 使用。

## 21. Ownership / Future RLS Boundary

本节只定义 ownership boundary，不写真正 Supabase RLS Policy。

### 21.1 Workspace-owned

直接 `workspace_id`：

- workspaces
- roles
- workspace_members
- clients
- content_categories
- tags
- references
- ideas
- campaigns
- contents
- assets
- music_tracks
- editing_playbooks
- calendar_events
- activity_logs

`user_profiles` 是 Auth identity profile；它通过 Workspace Membership 获得访问边界。Permissions 是系统 catalog，Role 通过 Workspace 归属。

### 21.2 Client-owned

直接 `client_id`：

- clients
- client_members（通过 client）
- client-scoped categories / tags / references
- ideas
- campaigns
- contents
- assets
- client-scoped music
- editing_playbooks
- calendar_events when Client-specific
- activity_logs when Client-specific

Workspace-wide Reference、Tag、Music 的 `client_id` 可以为空，但仍必须有 Workspace ownership。

### 21.3 Content-owned children

以下通过 `content_id` 一层继承 Workspace / Client，不重复 `client_id`：

- content_contributors
- content_tags
- script_versions
- media_versions
- content_approval_requirements
- approvals
- revision_requests
- content_assets
- content_music

这类记录通常只在单一 Content 上下文使用，一层 ownership join 清楚且不值得重复。

### 21.4 Direct ownership on high-value child tables

直接保留 `workspace_id` / `client_id`：

- `workflow_events`：跨 Content timeline、efficiency 与 RLS 高频。
- `publications`：平台发布队列与 Client 隔离高频。
- `analytics_snapshots`：Publication → Content 原本需要两层 join，数据量可能最大。
- `activity_logs`：跨实体 Audit 查询。

重复 ownership 必须与父 Content / Publication 一致；它是受控 denormalization，不允许独立编辑成不同 Client。

### 21.5 Future RLS inputs

未来 RLS 应根据：

- Active workspace membership
- Active client membership
- Role / permission
- Internal vs Client-visible field / view
- Entity workspace / client ownership

限制访问。Client Admin / Viewer 不能仅凭知道 UUID 跨 Client 读取数据。具体 Policy 与 Permission Matrix 留到 Phase 4。

## 22. Archive / Delete Strategy

### 22.1 禁止一般 hard delete

以下历史业务数据默认禁止 hard delete：

- User profiles with historical contribution
- Workspace / Client Membership history
- Clients with business records
- Ideas converted to Content
- Contents
- Script Versions
- Workflow Events
- Media Versions
- Approval Requirements and Approvals
- Revision Requests
- Publications
- Analytics Snapshots
- Assets referenced by Content
- Editing Style Versions used by Content
- Activity Logs

使用 Deactivated、Archived、Cancelled、Superseded 或 Reopened 等明确状态。

### 22.2 可停用的 lookup / config

优先 `is_active`：

- Roles
- Permissions
- Content Categories
- Contribution Roles
- Tags
- Platforms

若从未被引用且属于错误创建，授权管理员可以安全删除；一旦存在历史引用，应停用而非删除。

### 22.3 Join relationships

Current classification / assignment join（例如 Content Tag、Member Role）可在授权操作下解除，但必须进入 Activity Log。Contributor、Approval 与历史 Version 关系不得为“整理界面”而删除。

### 22.4 No historical cascade

不得从删除 Client、Content、Publication 或 User 级联删除历史事件、Analytics、Approvals 或 Contributions。Foreign-key delete behavior 应优先 Restrict；真正隐私删除需求需单独治理，不在 V0.1 默认流程。

## 23. Constraints & Index Intent

本节描述 intent，不是 SQL。

### 23.1 Key uniqueness

- Workspace name 不要求全系统唯一。
- `workspace_members`：Workspace + User unique。
- `workspace_member_roles`：Membership + Role unique。
- `clients`：Workspace + Client code unique；建议 Workspace + normalized active name duplicate warning。
- `content_categories` / `tags`：Workspace + scope Client + normalized name unique。
- `roles` / `contribution_roles`：Workspace + code unique。
- `content_code`：Workspace 内 unique。
- `script_versions` / `media_versions` / `editing_style_versions`：Parent + version number unique。
- `content_approval_requirements`：Content + Approval Type unique。
- `publications`：Content + Platform + publication_sequence unique。
- Join Tables：各 FK pair / triple unique。

### 23.2 Integrity intent

- 所有关联实体必须在相同 Workspace；Client-owned children 必须与 parent Client 一致。
- Content source Idea、Category、Campaign、Style Version 必须对该 Client 可用。
- Current Script pointer 必须指向同 Content。
- Approval target FK 必须符合 target_type，且只填适用 target。
- Revision Request source / resulting Version 必须属于同 Content。
- Published Publication 应有 `published_at` 与 URL 或明确 missing-link reason。
- Failed Publication 应有 failure reason。
- Cancelled Content 应有 cancellation reason / actor / time。
- Calendar `ends_at` 不早于 `starts_at`。
- Count / duration metrics 不接受无意义负值；允许 unavailable = null。
- Version number 与 publication_sequence 为正数。

### 23.3 Query / index intent

- Contents：Workspace + Client + current_status。
- Contents：Client + Category、Campaign、Priority、target_publish_at。
- Content Contributor：User + Role + Content。
- Workflow Events：Content + occurred_at；Workspace / Client + event_type + occurred_at。
- Script / Media Version：Content + version_number。
- Approvals：Content + approval_type + decided_at；Reviewer + result。
- Revision Requests：Content + status + requested_at；reason_code。
- Publications：Client + status + scheduled_at；Platform + published_at；Publisher + status。
- Analytics：Publication + captured_at；Client + snapshot_type + captured_at。
- Assets：Client + asset_type + shoot_date；reusable。
- Calendar：Workspace / Client + starts_at；assigned user + starts_at。
- Activity Logs：Entity type + entity id + created_at；Workspace / Client + created_at。
- Ideas：Client + status + priority。
- References：Workspace / Client + type + status + platform。

### 23.4 Uniqueness intentionally not over-strict

- Content + Platform 不 unique：允许 repost 与不同账号。
- Publication URL 不做全局 hard unique：允许修正、追踪参数与历史重复；使用 duplicate warning。
- Platform Post ID 只在 Platform + Account context 存在时考虑 unique。
- Reference URL 不全局 unique：允许不同 Client angle / analysis。
- Analytics Snapshot Type 不 unique：允许多次 capture / correction。
- Idea source URL 不 unique：同一来源可产生不同 Client Idea。
- Asset file name 不 unique：不同路径与 shoot 可以同名。

## 24. Enum vs Lookup vs JSONB

### 24.1 Stable constrained values / PostgreSQL Enum candidates

适合 stable enum 或 constrained value：

- Workspace / Membership status
- Reference type and lifecycle status
- Idea lifecycle status
- Content production status
- Workflow event type
- Script / Media version status and type
- Approval type, target type, result
- Revision request status / review scope / reason code
- Publication status
- Snapshot type / data source
- Calendar event type / status

这些值驱动系统行为，User 不应任意改名。实现阶段可在 PostgreSQL Enum 与 constrained text 之间选择；逻辑上必须受控。

### 24.2 Lookup Tables

适合 Lookup：

- Content Categories：User-manageable
- Tags：User-manageable、多实体可筛选
- Roles / Permissions：Phase 4 管理
- Contribution Roles：允许 Workspace 扩展
- Platforms：未来增加平台而无需改状态逻辑

User 会修改、停用或排序的内容不要写死为 Enum。

### 24.3 Free text

适合 text：

- Notes / descriptions
- Hook / CTA
- URLs / local / NAS paths
- Format（V0.1）
- Industry / country
- Music mood / usage
- External approver name
- Failure / cancellation reason details

### 24.4 Justified JSONB

- `editing_style_versions.style_config`：结构随 format / version 演化，整体版本化。
- `analytics_snapshots.platform_metrics`：平台独有且变化快的 metrics。
- `activity_logs.before_summary / after_summary / metadata`：通用审计摘要。
- `workflow_events.metadata`：少量 event-specific context。

不得把 Client ownership、Status、User relationships、common Analytics 或可筛选 Tags 塞入 JSONB。

## 25. Derived Data

以下不应由员工手动维护为唯一 Source of Truth：

| Derived value | Source records |
| --- | --- |
| Shoot → Editing Start | Workflow Events |
| Shoot → First Cut duration | Shoot Completed + First Cut Submitted Events |
| First Cut → Approval duration | First Cut Submitted + Approval / Workflow Events |
| Client Review Time | Client Review Started + Client Approved Events |
| Revision Count | Revision Requests / Revision Submitted Events |
| On-time Status | Due Calendar Event / target + actual Workflow Event |
| Not / Partially / Fully Published | Required Publications and their statuses |
| Content Created → Published | Content Created + Publication Published Events |
| Average Cycle Time | Event-derived durations across filtered Contents |
| Content Performance percentile | Analytics Snapshots compared within same Client / Platform / Account / window |
| Asset usage count | Content Assets |
| Music usage count | Content Music |

Derived values可以在 View、query、report 或 cache 中计算，但 Source Records 必须保留。若未来为了性能缓存，缓存要可重建并标明计算时间，不得反过来覆盖 Events / Snapshots。

## 26. V0.1 Tables

真正进入 V0.1 逻辑范围的 tables：

### Workspace / access

1. `workspaces`
2. `user_profiles`
3. `roles`
4. `permissions`
5. `role_permissions`
6. `workspace_members`
7. `workspace_member_roles`
8. `clients`
9. `client_members`

### Lookup / classification

10. `content_categories`
11. `tags`
12. `platforms`
13. `contribution_roles`

### Reference / Idea / Content

14. `references`
15. `reference_clients`
16. `reference_tags`
17. `ideas`
18. `idea_references`
19. `idea_contributors`
20. `campaigns`
21. `contents`
22. `content_tags`
23. `content_contributors`

### Production / review

24. `script_versions`
25. `workflow_events`
26. `media_versions`
27. `content_approval_requirements`
28. `approvals`
29. `revision_requests`

### Publication / analytics

30. `publications`
31. `analytics_snapshots`

### Libraries / schedule / audit

32. `assets`
33. `content_assets`
34. `asset_tags`
35. `music_tracks`
36. `content_music`
37. `editing_playbooks`
38. `editing_style_versions`
39. `calendar_events`
40. `activity_logs`

40 张表包含 17 个 join / lookup / access support tables；它不是 40 个独立复杂模块。每张表都对应 Product Spec 的 V0.1 lifecycle、筛选、版本、访问或 Library 要求。

## 27. Deferred Tables

不自动加入 V0.1：

- `meetings`：Meeting 不是核心验收项；可先用 Calendar Event + Notes。
- `tasks`：Workflow Assignment 与 Calendar 已覆盖首版核心 action。
- `saved_views`：V0.x。
- `sla_rules`：V0.x；首版从 Events 推导基础周期。
- `reports` / `report_runs`：V0.x；首版数据可支持报告。
- `profit_sharing`：Future；Contribution 不等于自动分润。
- `notifications`：Future / V0.x。
- `api_integrations` / `integration_credentials`：V0.x；不得存未定义 secrets。
- `social_accounts`：V0.1 Publication 先使用 `platform_account` text；多账号权限与 API integration 后再独立建模。
- `analytics_import_jobs`：CSV / API / Scraper 尚未进入 V0.1。
- `asset_renditions`：复杂媒体 rendition 延后。

`campaigns` 没有 Deferred：它以最小 table 进入 V0.1，因为 Campaign Filter 和一致分组已是 Product Requirement；不扩展 Budget 或 Automation。

## 28. Open Schema Questions

以下问题在进入实际 migration 前需要确认或在下一阶段定义：

1. **Permission Matrix**：Phase 4 需要明确每个 Role 的 Permission keys、Client scope 与 Internal / Client-visible access。
2. **Content Code sequence**：序号按 Workspace + Client + Year 重置，还是 Workspace 全局递增？需要定义并发生成与人工更正规则。
3. **Social accounts**：Pilot 是否会在同一 Platform 使用多个账号并需要严格账号权限？若是，`social_accounts` 可能需要提前进入 V0.1。
4. **External reviewers**：Client Portal 前，External Approver 只保存 name / channel 是否足够，还是需要轻量 contact identity？
5. **Required Publications**：Archived / Cancelled Publication 何时从 Required plan 移除，谁有权决定？
6. **Style Version activation**：谁可把 Draft Style Version 标为 Active；已使用版本是否允许修正文案类错误？
7. **Analytics metric dictionary**：Facebook / XHS 的 platform-specific JSONB keys、单位和 Manual entry validation 需要在 Analytics research 中定义。
8. **Workspace-wide vs Client-specific libraries**：Reference、Tag、Music 从 Workspace scope 提供给所有 Client 时，Client User 是否可见，需由 Phase 4 权限决定。
9. **Cross-client Asset reuse**：是否完全禁止，或允许 Manager 明确授权共享品牌中立素材？
10. **Activity retention**：Activity Log 的长期 retention、敏感 metadata redaction 与 export 规则尚未定义。
11. **Historical Planner migration**：现有 Excel 日期、状态与坏链接如何映射为 Content / Calendar / Workflow Event，需在 migration planning 时决定，不应猜测历史事件。
