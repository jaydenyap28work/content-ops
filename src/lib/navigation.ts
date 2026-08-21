import {
  Activity,
  Archive,
  BookOpen,
  Building2,
  CalendarDays,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Lightbulb,
  Music2,
  Settings,
  Users,
} from 'lucide-react'
import type {
  AppRouteDefinition,
  NavigationSection,
} from '../types/navigation'

export const routeDefinitions: AppRouteDefinition[] = [
  {
    path: '/',
    title: 'Dashboard',
    navigationLabel: 'Dashboard',
    description:
      'The future attention desk for work that needs a decision, handoff, or follow-up.',
    foundationNote:
      'Attention queues will be built from real workflow records in a later phase. No demo metrics are shown.',
    phase: 'Roadmap Phase 10',
    section: 'Workspace',
    icon: LayoutDashboard,
  },
  {
    path: '/content',
    title: 'Content',
    navigationLabel: 'Content',
    description:
      'A Client-scoped ledger for stable Content records, provenance, Campaigns, and Draft planning.',
    foundationNote:
      'Content CRUD, basic filters, Campaigns, stable IDs, and Idea provenance are live; production workflow remains deferred.',
    phase: 'Roadmap Phase 4',
    section: 'Workspace',
    icon: FileText,
  },
  {
    path: '/calendar',
    title: 'Calendar',
    navigationLabel: 'Calendar',
    description:
      'A familiar month and agenda view for production schedules and deadlines.',
    foundationNote:
      'Calendar events will come from the same operational records rather than a second manual schedule.',
    phase: 'Roadmap Phase 9',
    section: 'Workspace',
    icon: CalendarDays,
  },
  {
    path: '/ideas',
    title: 'Ideas',
    navigationLabel: 'Ideas',
    description:
      'A Client-scoped bank for evaluating, approving, rejecting, and tracing Ideas before production.',
    foundationNote:
      'Idea lifecycle, contributors, Tags, Reference provenance, and transaction-safe conversion to Content are live.',
    phase: 'Roadmap Phase 3',
    section: 'Workspace',
    icon: Lightbulb,
  },
  {
    path: '/references',
    title: 'References',
    navigationLabel: 'References',
    description:
      'An internal, Client-aware library for accounts, examples, and reusable lessons.',
    foundationNote:
      'Reference analysis, multi-Client relationships, Tags, and conversion to Idea are live.',
    phase: 'Roadmap Phase 3',
    section: 'Workspace',
    icon: BookOpen,
  },
  {
    path: '/analytics',
    title: 'Analytics',
    navigationLabel: 'Analytics',
    description:
      'Publication-level manual snapshots for Facebook and Xiaohongshu.',
    foundationNote:
      'Analytics will remain manual in V0.1 and will be isolated by Client access. No charts or sample results are included here.',
    phase: 'Roadmap Phase 7',
    section: 'Workspace',
    icon: Activity,
  },
  {
    path: '/assets',
    title: 'Assets',
    navigationLabel: 'Assets',
    description:
      'A searchable metadata index for externally stored footage and reusable files.',
    foundationNote:
      'ContentOS will store links, paths, and relationships—not large media files.',
    phase: 'Roadmap Phase 8',
    section: 'Libraries',
    icon: FolderOpen,
  },
  {
    path: '/music',
    title: 'Music',
    navigationLabel: 'Music',
    description:
      'An internal catalogue of music choices, usage guidance, and copyright notes.',
    foundationNote:
      'Music metadata and Content relationships will be introduced with the reusable libraries phase.',
    phase: 'Roadmap Phase 8',
    section: 'Libraries',
    icon: Music2,
  },
  {
    path: '/editing-playbook',
    title: 'Editing Playbook',
    navigationLabel: 'Editing Playbook',
    description:
      'Versioned editing standards that keep delivery consistent for each Client.',
    foundationNote:
      'Playbook versions and Content associations are scheduled for the standards library phase.',
    phase: 'Roadmap Phase 8',
    section: 'Libraries',
    icon: Archive,
  },
  {
    path: '/clients',
    title: 'Clients',
    navigationLabel: 'Clients',
    description:
      'Create and maintain access-scoped Client and Brand boundaries.',
    foundationNote:
      'Client records are live. Operational content relationships arrive in later phases.',
    phase: 'Roadmap Phase 2',
    section: 'Administration',
    icon: Building2,
  },
  {
    path: '/team',
    title: 'Team',
    navigationLabel: 'Team',
    description:
      'The Super Admin workspace for invitations, profiles, roles, status, and Client access.',
    foundationNote:
      'Team access uses predefined roles and explicit Client assignments; custom permission design remains deferred.',
    phase: 'Roadmap Phase 2',
    section: 'Administration',
    icon: Users,
  },
  {
    path: '/settings',
    title: 'Settings',
    navigationLabel: 'Settings',
    description:
      'A controlled home for Workspace and operational configuration as each capability is introduced.',
    foundationNote:
      'No integrations, secrets, database controls, or custom permission designer are exposed in V0.1 Foundation.',
    phase: 'Roadmap Phases 2–3',
    section: 'Administration',
    icon: Settings,
  },
]

export const navigationSections: NavigationSection[] = [
  'Workspace',
  'Libraries',
  'Administration',
]

export function getRouteDefinition(pathname: string) {
  return routeDefinitions.find((route) => route.path === pathname)
}
