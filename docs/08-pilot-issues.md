# First Real Pilot Issues

Status: Pilot Preparation / Live Walkthrough Pending

This document records First Real Pilot setup gaps and workflow friction without expanding product scope or prescribing schema changes. Findings marked **Code-audited** are supported by the current UI and RPC paths. Findings marked **Live verification pending** must be confirmed with an authenticated user and real LKSoft data.

## Pilot Setup Checklist

- [ ] Confirm or create active Client `LKSoft` with the real Client code, industry, description, and internal brand notes.
- [ ] Confirm the Facebook account name, handle/page identifier, and public URL.
- [ ] Confirm whether Xiaohongshu is part of this Pilot; if yes, record its account name, handle, and public URL.
- [ ] Confirm active users, Workspace roles, LKSoft Client access, and Content assignments for Strategist/Manager, Shooter, Editor, Reviewer, and Publisher.
- [ ] Confirm the required approval stages and assigned Reviewer before First Cut submission.
- [ ] Use one real Reference or explicitly confirm that the first Idea is direct.

## Blocker

### PILOT-B01 — Real LKSoft setup is not yet verified

- **Evidence:** Live verification pending.
- The repository contains no LKSoft seed or migration data. An authenticated browser session or approved work-environment query is required to confirm the actual Client and Social Account records.
- Do not create placeholder Client, account, Reference, Idea, or Content data to bypass this check.

### PILOT-B02 — Required execution identities must be confirmed

- **Evidence:** Code-audited; live verification pending.
- Shooting requires an active Shooter Workspace role plus an active Shooter assignment on the Content.
- Editing and version submission require an active Editor role plus active Editor assignment.
- Review requires an active Reviewer assignment and matching approval requirement.
- Publishing requires an active Publisher / Marketing role plus active Publisher assignment.
- A required approval cannot be completed by its submitter. The Pilot therefore needs a valid non-submitter Reviewer for each required checkpoint, even if one person holds several roles.

## Important

### PILOT-I01 — Social Account setup is only discoverable inside a Content

- **Evidence:** Code-audited.
- Facebook / Xiaohongshu account metadata is entered under `Content Detail → Publications & Analytics`.
- There is no Client-level Social Account setup entry. Preflight account setup therefore cannot be completed before a real Content reaches this page.

### PILOT-I02 — Ready for Publishing is coupled to publication planning

- **Evidence:** Code-audited.
- There is no separate visible `Mark Ready for Publishing` action.
- Creating the first Publication record advances approved Content into the publishing stage. The Pilot operator must understand that this setup action also advances workflow state.

### PILOT-I03 — Approval setup appears after the primary review controls

- **Evidence:** Code-audited.
- Approval Requirements are configured in `Review & Revisions`, while the top of the tab presents the current Primary Action.
- If requirements and Reviewers were not configured before First Cut, the next action can appear unavailable without an obvious setup sequence.

### PILOT-I04 — Publishing and analytics are dense on mobile

- **Evidence:** Code-audited; mobile verification pending.
- Social Account setup, Publication planning, scheduling, publishing, failure controls, and Analytics entry share one tab.
- Snapshot history uses a wide table with horizontal scrolling. Real Publisher mobile use must confirm that primary actions remain easy to locate and complete.

### PILOT-I05 — Critical reasons use browser prompts

- **Evidence:** Code-audited.
- Approval override reason, Publication cancellation reason, and completion note use native browser prompts.
- These preserve required input but may feel disconnected from the surrounding workflow, especially on mobile.

## Nice to Have

### PILOT-N01 — Reference capture is information-heavy

- **Evidence:** Code-audited; live verification pending.
- The New Reference drawer exposes analysis, classification, Client relationships, tags, and Gold Standard fields at once.
- Most are optional, but the Pilot should observe whether a user can quickly capture only URL, title, Client, and essential learning notes.

### PILOT-N02 — Idea approval adds an explicit evaluation step

- **Evidence:** Code-audited; live verification pending.
- A New Idea must first use `Start evaluation`, then `Approve Idea`.
- This is traceable and valid, but the Pilot should confirm whether the two-step rhythm matches daily planning meetings.

### PILOT-N03 — English operational labels need team validation

- **Evidence:** Code-audited; live verification pending.
- Workflow actions and field labels are currently English.
- Confirm whether the real LKSoft team finds terms such as `Mark Ready to Shoot`, `Submit First Cut`, and `Approval Requirements` natural during daily use.

## End-to-End UI Reachability Audit

| Step | Current UI path | Audit status |
|---|---|---|
| Reference | `References → New Reference` | Code-audited; live data needed |
| Reference → Idea | Reference detail → `Create Idea` | Code-audited |
| Approve Idea | `Ideas → Start evaluation → Approve Idea` | Code-audited |
| Convert to Content | Approved Idea → `Convert to Content` | Code-audited |
| Script | Content Detail → `Script → Create next version` | Code-audited |
| Ready to Shoot | Content Detail → `Production → Mark Ready to Shoot` | Code-audited |
| Shooting | Assigned Shooter → `Start Shooting` | Code-audited; role test pending |
| Complete Shooting | Assigned Shooter → `Complete Shooting` | Code-audited; role test pending |
| Start Editing | Assigned Editor → `Start Editing` | Code-audited; role test pending |
| Submit First Cut | `Review & Revisions → Submit First Cut` with media link/path | Code-audited; role test pending |
| Review | Assigned Reviewer → `Start Review` and version decision | Code-audited; role test pending |
| Revision | Reviewer → `Request revision`; Editor → `Start Revision → Submit Revision` | Code-audited; role test pending |
| Approval | Assigned Reviewer approval or recorded external approval | Code-audited; self-approval test pending |
| Ready for Publishing | Created implicitly with first Publication plan | Code-audited; clarity issue recorded |
| FB / XHS Publication | `Publications & Analytics` → account / Publication → schedule / publish | Code-audited; real account needed |
| Manual Analytics | Published Publication → `Add Manual Analytics Snapshot` | Code-audited; real metrics needed |

## Live Walkthrough Notes

Record each real task with:

- User and role
- Device / viewport
- Starting page and target action
- Completion or blocker
- Time taken
- Duplicate entry observed
- Confusing status or label
- Missing or excessive information
- Resulting workflow event / timestamp
- Follow-up severity: Blocker / Important / Nice to Have

## Resolved

### PILOT-R01 — Original Ideas card layout had lower planning visibility than Google Sheet

- **Evidence:** Pilot UX feedback; Planner implementation verified by responsive component tests, planned-date sorting tests, production record checks, and route smoke tests.
- **Status:** Resolved after verification.
- `/ideas` now defaults to a dense Planner table on desktop and compact planning rows on mobile. Planned date, topic, Idea status, linked Content production status, priority, owner/creator, source count, and next action are visible without opening every record.
- A lightweight Board remains available as a secondary view; Idea details open only when a row is selected.

## Pilot UX Round 2 — Daily Workflow Redesign (2026-08-22)

| Issue | Status | Verification / remaining scope |
|---|---|---|
| Idea Evaluating cannot undo | Resolved | M10 permits New ↔ Evaluating, Approved → Evaluating before conversion, and Rejected → Evaluating. Converted rollback is rejected; Idea Activity Log is retained. |
| Approved Idea lacks shooting value | Resolved | Approved/Converted Idea detail now exposes a Shooting Brief with Why Now, Hook, interview questions, talking directions, CTA, format, duration, talent, shoot date/location/shooter and References. Notes remain under More details. |
| Calendar empty despite planned dates | Resolved | Calendar is derived from Idea/Content plan dates, shoot schedule, and publication schedule/publish time. Production verification returned all seven LKSoft September plans; the converted record appears once as Content. |
| Creator vs Owner unclear | Resolved | Planner uses Owner as the operating field; Creator remains immutable historical attribution in Idea detail. |
| Owner cannot bulk assign | Resolved | Planner checkbox actions support Owner, Planned Date, Priority, Category and Tags. Status is intentionally excluded. Database RPC validates scope and writes Activity Log entries. |
| Dashboard unclear | Resolved | Workbench now surfaces Today/This Week, review/revision/approval/publication/analytics attention, production overview and direct actions. Empty states explain the next step. |
| References purpose unclear | Resolved | References is presented as Inspiration Library with Save Inspiration as the primary action, practical capture guidance, and retained Create Idea provenance. |
| Analytics empty/unclear | Resolved | Empty state explains the publication prerequisite; published data uses a dense Facebook/XHS snapshot table with Client, platform and date filters. |
| Assets unclear | Resolved for V0.1 | Empty state explains metadata indexing and that large files remain in Drive/NAS/Local. No upload feature was added. |
| Music unclear | Resolved for V0.1 | Empty state explains BGM source/style/use-history intent and keeps the module low priority. |
| Editing Playbook misplaced | Partially Resolved | Resources navigation is collapsible, Client detail links into a Client-context Playbook, and the eight required sections are visible. Persistent Playbook authoring remains deferred rather than inventing an unapproved schema. |
| Settings empty | Resolved | Personal language/profile/timezone and Super Admin Workspace name/default timezone are functional; timezone defaults to Asia/Kuala_Lumpur. |
| Login / invite flow unclear | Partially Resolved | Login is Google-first, invite-only, retains email/password and forgot-password, and denies unprovisioned accounts. Team invitation now collects Role, Client Access and an explicit Client access role; the Edge Function provisions these server-side. Google Provider OAuth Client ID/Secret still requires manual Supabase configuration. |
| Navigation organized by modules instead of daily workflow | Resolved | Navigation is grouped as Daily Work, Results, Management, collapsible Resources, and Settings; routes and data were preserved. |
| Chinese / English localization | Partially Resolved | zh-CN defaults and persists in localStorage; navigation, route names, status labels and the new daily-work surfaces have translation mapping without AppShell remount. Some established deep operational forms retain English labels and require a later translation-completeness pass. User-entered data is never translated. |

### Round 2 Verification Evidence

- Frontend: 7 test files / 13 tests passed; lint and production build passed.
- Database: M04–M10 schema/RLS/workflow rollback suites all passed with no residue.
- Calendar production check: seven LKSoft September 2026 PLAN entries returned on the expected dates; the converted 2026-09-02 Idea is represented by its linked Content only.
- Access boundary: authenticated Super Admin can read the authorized Calendar; anon execution is denied at the function grant boundary.
- Responsive contracts: desktop month Calendar, mobile Agenda, desktop Planner, compact mobile Idea rows, mobile drawer/navigation are implemented; final device usability remains a live Pilot observation item.
