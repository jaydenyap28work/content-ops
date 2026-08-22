import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ChevronDown,
  Lightbulb,
  LoaderCircle,
  Plus,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { Button, Card, FormField, Input, Select, Textarea } from '../../components/ui'
import { useAuth } from '../auth/auth-context'
import {
  loadContributorOptions,
  saveIdea,
} from './research-api'
import type {
  ContributorOption,
  IdeaRecord,
  ReferenceRecord,
  ResearchCatalog,
} from './research-api'
import {
  findIdeaSuggestion,
  mergeSuggestedTags,
  applySuggestionIfEmpty,
} from './idea-suggestions'

type ContributorDraft = { userId: string; roleId: string }

interface IdeaFormState {
  clientId: string
  title: string
  sourceUrl: string
  originalTopic: string
  originalHook: string
  whyItWorks: string
  ourAngle: string
  categoryId: string
  suggestedFormat: string
  priority: string
  ownerUserId: string
  notes: string
  referenceIds: string[]
  tags: string
  contributors: Array<{ userId: string; roleId: string; notes: string }>
}

interface IdeaFormDrawerProps {
  workspaceId: string
  idea: IdeaRecord | null
  catalog: ResearchCatalog
  references: ReferenceRecord[]
  onClose: () => void
  onSaved: (message: string) => Promise<void>
}

const emptyForm: IdeaFormState = {
  clientId: '',
  title: '',
  sourceUrl: '',
  originalTopic: '',
  originalHook: '',
  whyItWorks: '',
  ourAngle: '',
  categoryId: '',
  suggestedFormat: '',
  priority: 'normal',
  ownerUserId: '',
  notes: '',
  referenceIds: [],
  tags: '',
  contributors: [],
}

function initialForm(
  idea: IdeaRecord | null,
  catalog: ResearchCatalog,
  currentUserId: string,
): IdeaFormState {
  if (!idea) {
    return {
      ...emptyForm,
      clientId: catalog.clients[0]?.id ?? '',
      ownerUserId: currentUserId,
    }
  }

  return {
    clientId: idea.client_id,
    title: idea.title,
    sourceUrl: idea.source_url ?? '',
    originalTopic: idea.original_topic ?? '',
    originalHook: idea.original_hook ?? '',
    whyItWorks: idea.why_it_works ?? '',
    ourAngle: idea.our_angle ?? '',
    categoryId: idea.category_id ?? '',
    suggestedFormat: idea.suggested_format ?? '',
    priority: idea.priority,
    ownerUserId: idea.owner_user_id ?? '',
    notes: idea.notes ?? '',
    referenceIds: idea.referenceIds,
    tags: idea.tags.join(', '),
    contributors: idea.contributors.map((contributor) => ({
      ...contributor,
      notes: contributor.notes ?? '',
    })),
  }
}

function parseTags(value: string) {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))]
}

function SuggestionItem({
  label,
  value,
  applied,
  actionLabel = 'Use suggestion',
  onApply,
}: {
  label: string
  value: string
  applied: boolean
  actionLabel?: string
  onApply: () => void
}) {
  return (
    <div className="rounded-lg border border-blue/20 bg-paper/75 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-blue">
            {label}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">{value}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={applied}
          onClick={onApply}
        >
          {applied ? 'Field already filled' : actionLabel}
        </Button>
      </div>
    </div>
  )
}

export function IdeaFormDrawer({
  workspaceId,
  idea,
  catalog,
  references,
  onClose,
  onSaved,
}: IdeaFormDrawerProps) {
  const { session } = useAuth()
  const [form, setForm] = useState(() =>
    initialForm(idea, catalog, session?.user.id ?? ''),
  )
  const [contributors, setContributors] = useState<ContributorOption[]>([])
  const [contributorDraft, setContributorDraft] = useState<ContributorDraft>({
    userId: '',
    roleId: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggestion = useMemo(() => findIdeaSuggestion(form.title), [form.title])
  const creatorRole = catalog.contributionRoles.find(
    (role) => role.code === 'idea_creator',
  )
  const additionalRoles = catalog.contributionRoles.filter(
    (role) => role.code !== 'idea_creator',
  )
  const automaticCreators = form.contributors.filter(
    (contributor) => contributor.roleId === creatorRole?.id,
  )
  const additionalContributors = form.contributors.filter(
    (contributor) => contributor.roleId !== creatorRole?.id,
  )

  useEffect(() => {
    let active = true
    if (!form.clientId) {
      return () => {
        active = false
      }
    }

    void loadContributorOptions(form.clientId)
      .then((options) => {
        if (active) setContributors(options)
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Could not load contributors',
          )
        }
      })

    return () => {
      active = false
    }
  }, [form.clientId])

  const scopedCategories = catalog.categories.filter(
    (category) =>
      category.client_id === null || category.client_id === form.clientId,
  )
  const scopedReferences = references.filter(
    (reference) =>
      form.clientId
      && (reference.client_id === null
        || reference.client_id === form.clientId
        || reference.relatedClientIds.includes(form.clientId)),
  )
  const filledDetailCount = [
    form.ourAngle,
    form.suggestedFormat,
    form.originalTopic,
    form.originalHook,
    form.sourceUrl,
    form.whyItWorks,
    form.notes,
    form.tags,
  ].filter((value) => value.trim()).length
    + form.referenceIds.length
    + additionalContributors.length

  function changeClient(clientId: string) {
    if (!clientId) setContributors([])
    setForm((current) => ({
      ...current,
      clientId,
      categoryId: '',
      referenceIds: current.referenceIds.filter((referenceId) => {
        const reference = references.find((item) => item.id === referenceId)
        return Boolean(
          reference
          && (reference.client_id === null
            || reference.client_id === clientId
            || reference.relatedClientIds.includes(clientId)),
        )
      }),
      contributors: current.contributors.filter(
        (contributor) => contributor.roleId === creatorRole?.id,
      ),
    }))
    setContributorDraft({ userId: '', roleId: '' })
  }

  function toggleReference(referenceId: string) {
    setForm((current) => ({
      ...current,
      referenceIds: current.referenceIds.includes(referenceId)
        ? current.referenceIds.filter((id) => id !== referenceId)
        : [...current.referenceIds, referenceId],
    }))
  }

  function addContributor() {
    if (
      !contributorDraft.userId
      || !contributorDraft.roleId
      || form.contributors.some(
        (contributor) =>
          contributor.userId === contributorDraft.userId
          && contributor.roleId === contributorDraft.roleId,
      )
    ) {
      return
    }

    setForm((current) => ({
      ...current,
      contributors: [
        ...current.contributors,
        { ...contributorDraft, notes: '' },
      ],
    }))
    setContributorDraft({ userId: '', roleId: '' })
  }

  function applyTextSuggestion(
    field: 'ourAngle' | 'suggestedFormat' | 'originalHook' | 'whyItWorks',
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: applySuggestionIfEmpty(current[field], value),
    }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      await saveIdea(workspaceId, {
        id: idea?.id,
        ...form,
        categoryId: form.categoryId || null,
        ownerUserId: form.ownerUserId || null,
        tags: parseTags(form.tags),
      })
      await onSaved(idea ? 'Idea updated.' : 'Idea created.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save Idea')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm">
      <section className="h-full w-full max-w-3xl overflow-y-auto bg-paper shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-paper/95 px-5 py-5 backdrop-blur sm:px-8">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-coral">
              Fast Idea intake
            </p>
            <h3 className="mt-2 font-display text-3xl font-semibold">
              {idea ? 'Edit Idea' : 'Capture an Idea'}
            </h3>
            <p className="mt-1 text-sm text-ink-muted">
              Start with the four planning essentials. Add context only when it helps.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close Idea form" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        <form className="space-y-6 px-5 py-6 sm:px-8 sm:py-8" onSubmit={handleSubmit}>
          {error ? (
            <div role="alert" className="rounded-lg border border-coral/30 bg-coral/8 px-4 py-3 text-sm text-coral-dark">
              {error}
            </div>
          ) : null}

          <div className="grid gap-5 rounded-xl border border-line bg-canvas-raised/55 p-5 sm:grid-cols-2">
            <FormField
              label="Client"
              htmlFor="idea-client"
              required
              hint={idea ? 'Client ownership is fixed after creation.' : undefined}
            >
              <Select
                id="idea-client"
                required
                disabled={Boolean(idea)}
                value={form.clientId}
                onChange={(event) => changeClient(event.target.value)}
              >
                <option value="">Choose Client</option>
                {catalog.clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Priority" htmlFor="idea-priority">
              <Select
                id="idea-priority"
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Idea Title" htmlFor="idea-title" required>
                <Input
                  id="idea-title"
                  required
                  autoFocus
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="What is the question or story worth exploring?"
                />
              </FormField>
            </div>
            <FormField label="Category" htmlFor="idea-category">
              <Select
                id="idea-category"
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              >
                <option value="">No category yet</option>
                {scopedCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </Select>
            </FormField>
            <div className="flex items-end">
              <div className="flex w-full items-center gap-3 rounded-lg border border-line bg-paper px-3.5 py-3 text-sm text-ink-muted">
                <UserRound className="size-4 shrink-0 text-coral" aria-hidden="true" />
                <span className="min-w-0">
                  Creator recorded automatically
                  {session?.user.email ? <span className="block truncate text-xs text-ink-faint">{session.user.email}</span> : null}
                </span>
              </div>
            </div>
          </div>

          {suggestion ? (
            <Card className="overflow-hidden border-blue/25 bg-blue/[0.035] p-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-blue/15 px-5 py-4">
                <div className="flex gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue text-white">
                    <Sparkles className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-bold">Prepared shooting suggestions</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted">
                      Apply only to empty fields, then edit freely in 更多资料. Steven keeps the final point of view.
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" disabled title="Reserved for a future approved AI provider">
                  <Sparkles className="size-3.5" /> AI Generate · Future
                </Button>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <SuggestionItem
                  label="Our Angle"
                  value={suggestion.ourAngle}
                  applied={Boolean(form.ourAngle.trim())}
                  onApply={() => applyTextSuggestion('ourAngle', suggestion.ourAngle)}
                />
                <SuggestionItem
                  label="Suggested Format"
                  value={suggestion.suggestedFormat}
                  applied={Boolean(form.suggestedFormat.trim())}
                  onApply={() => applyTextSuggestion('suggestedFormat', suggestion.suggestedFormat)}
                />
                <SuggestionItem
                  label="Hook"
                  value={suggestion.hook}
                  applied={Boolean(form.originalHook.trim())}
                  onApply={() => applyTextSuggestion('originalHook', suggestion.hook)}
                />
                <SuggestionItem
                  label="Why it works"
                  value={suggestion.whyItWorks}
                  applied={Boolean(form.whyItWorks.trim())}
                  onApply={() => applyTextSuggestion('whyItWorks', suggestion.whyItWorks)}
                />
                <div className="sm:col-span-2">
                  <SuggestionItem
                    label="Tags"
                    value={suggestion.tags.join(', ')}
                    applied={suggestion.tags.every((tag) =>
                      parseTags(form.tags).some(
                        (current) => current.toLocaleLowerCase('en') === tag.toLocaleLowerCase('en'),
                      ))}
                    actionLabel="Add suggested tags"
                    onApply={() => setForm((current) => ({
                      ...current,
                      tags: mergeSuggestedTags(current.tags, suggestion.tags),
                    }))}
                  />
                </div>
              </div>
            </Card>
          ) : form.title.trim() ? (
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-ink-muted">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold-dark" aria-hidden="true" />
              <p>
                No prepared suggestion matches this title yet. You can still save it now and add context later.
              </p>
            </div>
          ) : null}

          <details className="group rounded-xl border border-line bg-paper">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral">
              <div>
                <p className="font-bold">更多资料 · More details</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Angle, hook, sources and collaborators are optional at intake.
                  {filledDetailCount ? ` ${filledDetailCount} item${filledDetailCount === 1 ? '' : 's'} filled.` : ''}
                </p>
              </div>
              <ChevronDown className="size-5 shrink-0 text-ink-faint transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-5 border-t border-line px-5 py-5">
              <FormField label="Our Angle" htmlFor="idea-angle" hint="A shooting direction, not Steven's final answer.">
                <Textarea id="idea-angle" value={form.ourAngle} onChange={(event) => setForm({ ...form, ourAngle: event.target.value })} />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Suggested Format" htmlFor="idea-format">
                  <Input id="idea-format" value={form.suggestedFormat} onChange={(event) => setForm({ ...form, suggestedFormat: event.target.value })} />
                </FormField>
                <FormField label="Original Topic" htmlFor="idea-topic">
                  <Input id="idea-topic" value={form.originalTopic} onChange={(event) => setForm({ ...form, originalTopic: event.target.value })} />
                </FormField>
              </div>
              <FormField label="Hook" htmlFor="idea-hook">
                <Input id="idea-hook" value={form.originalHook} onChange={(event) => setForm({ ...form, originalHook: event.target.value })} />
              </FormField>
              <FormField label="Source URL" htmlFor="idea-url">
                <Input id="idea-url" type="url" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} />
              </FormField>
              <FormField label="Why it works" htmlFor="idea-why">
                <Textarea id="idea-why" value={form.whyItWorks} onChange={(event) => setForm({ ...form, whyItWorks: event.target.value })} />
              </FormField>
              <FormField label="Notes" htmlFor="idea-notes">
                <Textarea id="idea-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </FormField>
              <FormField label="Tags" htmlFor="idea-tags" hint="Comma-separated; existing tags are preserved when suggestions are added.">
                <Input id="idea-tags" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
              </FormField>

              <fieldset>
                <legend className="text-sm font-semibold">Source References</legend>
                <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
                  {scopedReferences.length ? scopedReferences.map((reference) => {
                    const retained = idea?.referenceIds.includes(reference.id) ?? false
                    return (
                      <label key={reference.id} className="flex gap-3 rounded-md border border-line p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={form.referenceIds.includes(reference.id)}
                          disabled={retained}
                          onChange={() => toggleReference(reference.id)}
                          className="size-4 accent-coral"
                        />
                        <span>
                          <span className="font-bold">{reference.title}</span>
                          {retained ? <span className="ml-2 text-xs text-coral">Retained provenance</span> : null}
                        </span>
                      </label>
                    )
                  }) : (
                    <p className="text-sm text-ink-muted">No eligible Reference for this Client.</p>
                  )}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold">Contributors</legend>
                <div className="mt-2 rounded-md border border-green/20 bg-green/5 p-3 text-sm text-ink-muted">
                  <span className="font-bold text-ink">Creator is automatic.</span>{' '}
                  {automaticCreators.length
                    ? 'The original creator record is retained and cannot be removed here.'
                    : 'The signed-in user will be recorded when this Idea is created.'}
                </div>
                <div className="mt-3 space-y-2">
                  {additionalContributors.map((contributor, index) => (
                    <div key={`${contributor.userId}-${contributor.roleId}`} className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
                      <div>
                        <p className="text-sm font-bold">
                          {contributors.find((person) => person.user_profile_id === contributor.userId)?.display_name ?? 'Workspace member'}
                        </p>
                        <p className="text-xs text-ink-faint">
                          {catalog.contributionRoles.find((role) => role.id === contributor.roleId)?.name ?? 'Contributor'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setForm((current) => ({
                          ...current,
                          contributors: current.contributors.filter(
                            (item) => item !== additionalContributors[index],
                          ),
                        }))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Select
                    aria-label="Contributor"
                    value={contributorDraft.userId}
                    onChange={(event) => setContributorDraft({ ...contributorDraft, userId: event.target.value })}
                  >
                    <option value="">Choose person</option>
                    {contributors.map((person) => (
                      <option key={person.user_profile_id} value={person.user_profile_id}>{person.display_name}</option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Contribution role"
                    value={contributorDraft.roleId}
                    onChange={(event) => setContributorDraft({ ...contributorDraft, roleId: event.target.value })}
                  >
                    <option value="">Choose role</option>
                    {additionalRoles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </Select>
                  <Button variant="secondary" disabled={!contributorDraft.userId || !contributorDraft.roleId} onClick={addContributor}>
                    <Plus className="size-4" /> Add
                  </Button>
                </div>
              </fieldset>
            </div>
          </details>

          <div className="sticky bottom-0 -mx-5 flex flex-wrap gap-3 border-t border-line bg-paper/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
            <Button type="submit" disabled={busy || !form.clientId || !form.title.trim()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Save Idea
            </Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </section>
    </div>
  )
}
