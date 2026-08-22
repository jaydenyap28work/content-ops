import { useEffect } from 'react'

const mountCounts = new Map<string, number>()

export function devAuthLog(
  event: string,
  details: Record<string, string | number | boolean | null | undefined> = {},
) {
  if (!import.meta.env.DEV) return
  console.debug(`[ContentOS auth] ${event}`, details)
}

export function useDevMountCounter(componentName: string) {
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const count = (mountCounts.get(componentName) ?? 0) + 1
    mountCounts.set(componentName, count)
    console.debug('[ContentOS mount]', { component: componentName, count, action: 'mounted' })

    return () => {
      console.debug('[ContentOS mount]', { component: componentName, count, action: 'unmounted' })
    }
  }, [componentName])
}
