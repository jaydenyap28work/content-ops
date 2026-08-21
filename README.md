# ContentOS

ContentOS 是一套内部 Content / Personal IP Operations System。

目标是统一管理：

- Client / Brand
- Idea
- Script
- Shooting
- Editing
- Review
- Publishing
- Analytics
- Reports
- Team Contribution
- Production Efficiency
- Assets
- Editing Playbook

Status: Auth Foundation

## Local development

Prerequisites:

- Node.js 20.19 or later
- pnpm 10 or later

Install dependencies and start the local development server:

```bash
pnpm install
pnpm dev
```

### Supabase environment

Copy `.env.example` to `.env.local`, then provide the URL and anon key for the intended non-production Supabase environment:

```dotenv
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

`.env.local` is ignored by Git. Only the public anon key belongs in the frontend configuration; never use a `service_role` key in the browser application. This repository does not create or connect to a cloud Supabase project automatically.

Public self-registration is intentionally unavailable. A Supabase administrator must create the initial Auth user in Dashboard, confirm the work email, and then run `supabase/bootstrap/first-super-admin.sql` in the SQL Editor to bind that identity to the seeded ContentOS Workspace and Super Admin role. The bootstrap script accepts only the designated work email and contains no password or credential.

Quality checks:

```bash
pnpm lint
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

The current application contains Supabase password sign-in/sign-out, an active Workspace membership gate, the responsive ContentOS shell, shared UI conventions, and registered placeholder routes. It does not offer public registration or include business demo data.
