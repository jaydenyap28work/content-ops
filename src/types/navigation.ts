import type { LucideIcon } from 'lucide-react'

export type NavigationSection = 'Workspace' | 'Libraries' | 'Administration'

export interface AppRouteDefinition {
  path: string
  title: string
  navigationLabel: string
  description: string
  foundationNote: string
  phase: string
  section: NavigationSection
  icon: LucideIcon
}
