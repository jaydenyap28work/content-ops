import { useLocation } from 'react-router-dom'
import { getRouteDefinition } from '../lib/navigation'

export function useCurrentRoute() {
  const { pathname } = useLocation()

  return getRouteDefinition(pathname) ?? (pathname.startsWith('/content/') ? getRouteDefinition('/content') : pathname.startsWith('/ideas/') ? getRouteDefinition('/ideas') : undefined)
}
