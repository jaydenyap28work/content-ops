import type { LucideIcon } from 'lucide-react'

export type NavigationSection = 'Daily Work' | 'Brand' | 'Results' | 'Management' | 'Resources' | 'Settings'

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
