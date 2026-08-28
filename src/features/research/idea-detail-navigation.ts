import type { PlanningStatus } from './research-api'

export interface IdeaPlanViewState {
  search: string
  status: PlanningStatus | 'decision' | 'all'
  clientId: string
  categoryId: string
  reference: 'all' | 'with' | 'without'
  view: 'planner' | 'board'
}

const statuses = new Set(['decision','new','evaluating','confirmed','paused','rejected','archived','all'])

export function readIdeaPlanViewState(params: URLSearchParams): IdeaPlanViewState {
  const status = params.get('status') ?? 'decision'
  const reference = params.get('source') ?? 'all'
  const view = params.get('view') ?? 'planner'
  return {
    search: params.get('q') ?? '',
    status: (statuses.has(status) ? status : 'decision') as IdeaPlanViewState['status'],
    clientId: params.get('client') ?? 'all',
    categoryId: params.get('category') ?? 'all',
    reference: (['all','with','without'].includes(reference) ? reference : 'all') as IdeaPlanViewState['reference'],
    view: view === 'board' ? 'board' : 'planner',
  }
}

export function writeIdeaPlanViewState(state: IdeaPlanViewState) {
  const params = new URLSearchParams()
  if (state.search.trim()) params.set('q', state.search.trim())
  if (state.status !== 'decision') params.set('status', state.status)
  if (state.clientId !== 'all') params.set('client', state.clientId)
  if (state.categoryId !== 'all') params.set('category', state.categoryId)
  if (state.reference !== 'all') params.set('source', state.reference)
  if (state.view !== 'planner') params.set('view', state.view)
  return params
}

export function normalizeIdeaText(value: string | null | undefined) {
  return (value ?? '').replace(/\r\n?/g, '\n').replace(/\n[\t ]*\n(?:[\t ]*\n)+/g, '\n\n').trim()
}

export function safeIdeaPlanBackPath(value: unknown) {
  return typeof value === 'string' && (value === '/ideas' || value.startsWith('/ideas?')) ? value : '/ideas'
}