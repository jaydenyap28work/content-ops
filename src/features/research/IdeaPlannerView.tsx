import { ArrowUpRight, CalendarDays, ChevronRight } from 'lucide-react'
import { StatusBadge } from '../../components/ui'
import type { ResearchCatalog, IdeaRecord, IdeaStatus } from './research-api'
import {
  formatPlannedDate,
  getDisplayedProductionStatus,
  getNextActionLabel,
  ideaStatusLabels,
} from './idea-planner'

function tone(status: IdeaStatus) {
  if (status === 'approved' || status === 'converted') return 'success' as const
  if (status === 'rejected') return 'critical' as const
  if (status === 'evaluating') return 'warning' as const
  return 'neutral' as const
}

function ownerLabel(idea: IdeaRecord) {
  return idea.owner_name || idea.creator_name || 'Unassigned'
}

function statusCell(idea: IdeaRecord) {
  const production = getDisplayedProductionStatus(idea)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone={tone(idea.status)}>{ideaStatusLabels[idea.status]}</StatusBadge>
      {production ? <StatusBadge tone="warning">{production}</StatusBadge> : null}
    </div>
  )
}

export function IdeaPlannerView({
  ideas,
  catalog,
  onSelect,
}: {
  ideas: IdeaRecord[]
  catalog: ResearchCatalog
  onSelect: (idea: IdeaRecord) => void
}) {
  return (
    <>
      <div data-testid="idea-planner-desktop" className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[72rem] border-collapse text-left">
          <thead className="border-b border-line bg-canvas-raised/80 text-[0.68rem] font-extrabold uppercase tracking-[0.13em] text-ink-faint">
            <tr>
              <th className="w-36 px-4 py-3">Planned Date</th>
              <th className="px-4 py-3">Idea Title</th>
              <th className="w-36 px-4 py-3">Category</th>
              <th className="w-60 px-4 py-3">Status</th>
              <th className="w-24 px-4 py-3">Priority</th>
              <th className="w-40 px-4 py-3">Owner / Creator</th>
              <th className="w-24 px-4 py-3 text-center">Sources</th>
              <th className="w-44 px-4 py-3">Next Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ideas.map((idea) => (
              <tr
                key={idea.id}
                tabIndex={0}
                onClick={() => onSelect(idea)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelect(idea)
                }}
                className="group cursor-pointer bg-paper transition hover:bg-canvas-raised focus:bg-canvas-raised focus:outline-none"
              >
                <td className="px-4 py-3 align-top font-mono text-xs font-bold text-ink-soft">
                  {formatPlannedDate(idea.planned_date)}
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="line-clamp-2 font-bold leading-5 text-ink group-hover:text-coral-dark">{idea.title}</p>
                </td>
                <td className="px-4 py-3 align-top text-sm text-ink-soft">
                  {catalog.categories.find((item) => item.id === idea.category_id)?.name ?? '—'}
                </td>
                <td className="px-4 py-3 align-top">{statusCell(idea)}</td>
                <td className="px-4 py-3 align-top"><StatusBadge>{idea.priority}</StatusBadge></td>
                <td className="max-w-40 truncate px-4 py-3 align-top text-sm text-ink-soft">{ownerLabel(idea)}</td>
                <td className="px-4 py-3 text-center align-top text-sm font-bold text-ink-muted">{idea.referenceIds.length}</td>
                <td className="px-4 py-3 align-top text-sm font-bold text-blue">
                  <span className="inline-flex items-center gap-1.5">{getNextActionLabel(idea)}<ArrowUpRight className="size-3.5" /></span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div data-testid="idea-planner-mobile" className="divide-y divide-line lg:hidden">
        {ideas.map((idea) => (
          <button key={idea.id} type="button" onClick={() => onSelect(idea)} className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-3 px-4 py-3.5 text-left transition hover:bg-canvas-raised">
            <div className="pt-0.5">
              <p className="font-mono text-xs font-extrabold text-coral-dark">{formatPlannedDate(idea.planned_date, true)}</p>
              <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint">{idea.planned_date?.slice(0, 4) ?? 'No date'}</p>
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-bold leading-5">{idea.title}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{statusCell(idea)}<StatusBadge>{idea.priority}</StatusBadge></div>
            </div>
            <ChevronRight className="mt-1 size-4 text-ink-faint" aria-hidden="true" />
          </button>
        ))}
      </div>
    </>
  )
}

export function IdeaBoardView({ ideas, onSelect }: { ideas: IdeaRecord[]; onSelect: (idea: IdeaRecord) => void }) {
  const columns: IdeaStatus[] = ['new', 'evaluating', 'approved', 'converted', 'rejected', 'archived']
  return (
    <div className="flex gap-4 overflow-x-auto p-4" data-testid="idea-board">
      {columns.map((status) => {
        const columnIdeas = ideas.filter((idea) => idea.status === status)
        return (
          <section key={status} className="w-72 shrink-0 rounded-xl border border-line bg-canvas-raised/55">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em]">{ideaStatusLabels[status]}</p>
              <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-bold text-ink-muted">{columnIdeas.length}</span>
            </header>
            <div className="space-y-2 p-2.5">
              {columnIdeas.map((idea) => (
                <button key={idea.id} type="button" onClick={() => onSelect(idea)} className="w-full rounded-lg border border-line bg-paper p-3 text-left shadow-sm transition hover:border-coral/40">
                  <div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-wider text-ink-faint">
                    <CalendarDays className="size-3.5" />{formatPlannedDate(idea.planned_date, true)}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm font-bold leading-5">{idea.title}</p>
                  {getDisplayedProductionStatus(idea) ? <p className="mt-2 text-xs font-bold text-gold-dark">{getDisplayedProductionStatus(idea)}</p> : null}
                </button>
              ))}
              {!columnIdeas.length ? <p className="px-2 py-6 text-center text-xs text-ink-faint">No Ideas</p> : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
