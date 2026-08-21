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

Status: Application Foundation

## Local development

Prerequisites:

- Node.js 20.19 or later
- pnpm 10 or later

Install dependencies and start the local development server:

```bash
pnpm install
pnpm dev
```

Quality checks:

```bash
pnpm lint
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

The current application contains the responsive ContentOS shell, shared UI conventions, and registered placeholder routes only. It does not connect to Supabase, create a database, implement authentication, or include business demo data.
