import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNote, Loading } from '@/components/ui'
import { ProjectList, type ListOps } from '@/components/usecases/ProjectList'
import { LiveDot, WaitingForAgent, useFreshIds } from '@/components/usecases/live'
import { savingsOf } from '@/components/usecases/group'
import { ConfirmDialog, Icon, Toaster, focusRing } from '@/components/usecases/kit'
import { usePins, useDeleteUseCases, useRename } from '@/components/usecases/ops'
import { Toolbar, applyView, isFiltering, useListView } from '@/components/usecases/Toolbar'
import { api } from '@/lib/api'
import { usd } from '@/lib/format'
import type { UseCase } from '@/types'

// Polls so the list fills up while the coding agent's scan creates use cases.
const LIVE_MS = 3000

export default function UseCases() {
  const q = useQuery({ queryKey: ['use-cases'], queryFn: api.useCases, refetchInterval: LIVE_MS })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const fresh = useFreshIds(q.data?.map((u) => u.id))
  const fallbackName = me.data?.workspace.name || 'Your project'
  const all = q.data ?? []
  const done = all.filter((u) => u.latest_run?.status === 'done').length
  const savings = savingsOf(all)

  const [view, update] = useListView()
  const shown = applyView(all, view)
  const pins = usePins(me.data?.workspace.id, q.data)
  const rename = useRename()
  const del = useDeleteUseCases()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<UseCase[] | null>(null)
  // drop ids that disappeared (deleted elsewhere, or by the agent)
  const selected = new Set([...sel].filter((id) => all.some((u) => u.id === id)))
  const selectedItems = all.filter((u) => selected.has(u.id))

  const ops: ListOps = {
    selected,
    setSelected: (ids, v) => setSel((s) => {
      const next = new Set(s)
      ids.forEach((id) => (v ? next.add(id) : next.delete(id)))
      return next
    }),
    isPinned: pins.isPinned,
    setPinned: (ids, v) => { void pins.setPinned(ids, v) },
    rename: (id, name) => rename.mutate({ id, name }),
    remove: (items) => setConfirm(items),
  }
  const confirmCases = confirm?.reduce((s, u) => s + u.case_count, 0) ?? 0
  const allPinned = selectedItems.length > 0 && selectedItems.every(pins.isPinned)

  return (
    // full width now that connecting lives on /connections; capped so rows don't stretch into emptiness
    <div className="mx-auto max-w-6xl pb-20">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="display text-4xl sm:text-5xl">Use cases</h1>
          <p className="mt-3 max-w-lg text-muted">Every place your product calls an LLM, the model it uses today, and what the benchmark says.</p>
        </div>
        {all.length > 0 && (
          <Link to="/connections" className={`rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg ${focusRing}`}>
            Connect another repo
          </Link>
        )}
      </div>
      {all.length > 0 && (
        <p className="mt-5 flex flex-wrap items-center gap-x-2 text-sm text-faint" role="status">
          <LiveDot className="mr-0.5" />
          <span>{all.length} found, {done} benchmarked{savings > 0 && <>, <span className="text-win">~{usd(savings)}/month</span> to save</>}</span>
          <span aria-hidden>·</span>
          <span>updates live while your agent works</span>
        </p>
      )}

      {all.length > 0 && <div className="mt-7"><Toolbar all={all} view={view} update={update} /></div>}

      <div className="mt-6">
        {q.isLoading && <Loading />}
        {q.error && !q.data && <ErrorNote error={q.error} />}
        {q.data?.length === 0 && <WaitingForAgent />}
        {all.length > 0 && shown.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="title">No use cases match</p>
            <p className="mt-1 text-sm text-muted">Nothing fits {view.q.trim() ? <>“{view.q.trim()}”</> : 'this filter'}.</p>
            <button type="button" onClick={() => update({ q: '', status: 'all' })} className={`mt-4 rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-fg hover:border-line-strong ${focusRing}`}>
              Clear filters
            </button>
          </div>
        )}
        {shown.length > 0 && (
          <ProjectList
            useCases={shown} all={all} fallbackName={fallbackName} fresh={fresh}
            sort={view.sort} flat={view.group === 'none'} filtering={isFiltering(view)} ops={ops}
          />
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4" role="region" aria-label="Bulk actions">
          <div className="flex items-center gap-1 rounded-xl border border-line-strong bg-raised py-1.5 pr-1.5 pl-4 text-sm shadow-2xl shadow-black/50">
            <span className="mr-2 tabular-nums text-fg">{selected.size} selected</span>
            <button type="button" onClick={() => ops.setPinned([...selected], !allPinned)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted hover:bg-line hover:text-fg ${focusRing}`}>
              <Icon name="pin" className="size-3.5" />{allPinned ? 'Unpin' : 'Pin'}
            </button>
            <button type="button" onClick={() => setConfirm(selectedItems)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-bad hover:bg-bad/15 ${focusRing}`}>
              <Icon name="trash" className="size-3.5" />Delete
            </button>
            <span className="mx-1 h-5 w-px bg-line" aria-hidden />
            <button type="button" onClick={() => setSel(new Set())} className={`rounded-md px-2.5 py-1.5 text-muted hover:bg-line hover:text-fg ${focusRing}`}>Clear</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.length === 1 ? `Delete “${confirm[0].name}”?` : `Delete ${confirm?.length ?? 0} use cases?`}
        body={
          confirm?.length === 1
            ? <>This also deletes its {confirmCases} test {confirmCases === 1 ? 'case' : 'cases'} and its runs. It can't be undone.</>
            : <>This also deletes their {confirmCases} test {confirmCases === 1 ? 'case' : 'cases'} and all their runs. It can't be undone.</>
        }
        confirmLabel={confirm?.length === 1 ? 'Delete use case' : `Delete ${confirm?.length ?? 0} use cases`}
        busy={del.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const items = confirm ?? []
          del.mutate(items, {
            onSettled: () => {
              setConfirm(null)
              setSel((s) => new Set([...s].filter((id) => !items.some((u) => u.id === id))))
            },
          })
        }}
      />
      <Toaster />
    </div>
  )
}
