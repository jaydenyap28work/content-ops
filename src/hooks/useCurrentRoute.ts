import { useLocation } from 'react-router-dom'
import { getRouteDefinition } from '../lib/navigation'

export function useCurrentRoute() {
  const { pathname } = useLocation()

  return getRouteDefinition(pathname)
}
