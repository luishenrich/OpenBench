import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ErrorNote } from '@/components/ui'
import { ListSkeleton, ToolbarSkeleton } from '@/components/usecases/ListSkeleton'
import { ProjectList, type ListOps } from '@/components/usecases/ProjectList'
import { LiveDot, ScanBanner, WaitingForAgent, useFreshIds, useNow } from '@/components/usecases/live'
import { projectOf, savingsOf } from '@/components/usecases/group'
import { ConfirmDialog, Icon, Toaster, focusRing } from '@/components/usecases/kit'
import { usePins, useDeleteUseCases, useRename } from '@/components/usecases/ops'
import { Toolbar, ViewControls, applyView, isFiltering, useListView } from '@/components/usecases/Toolbar'
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
  const everything = q.data ?? []
  // ?project=<name> (from the sidebar) narrows the page to one project; everything below works on that scope
  const [params, setParams] = useSearchParams()
  const project = params.get('project')
  const all = project ? everything.filter((u) => projectOf(u, fallbackName) === project) : everything
  const done = all.filter((u) => u.latest_run?.status === 'done').length
  const savings = savingsOf(all)
  const clearProject = () => setParams((p) => { p.delete('project'); return p })
  const [owner, repo] = project?.includes('/') ? [project.slice(0, project.lastIndexOf('/') + 1), project.slice(project.lastIndexOf('/') + 1)] : ['', project ?? '']

  const [view, update] = useListView()
  // re-evaluates "setting up" without new data, so a use case flips once the agent's 5-minute window passes
  const now = useNow(15_000)
  const shown = applyView(all, view, now)
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
    <div className="pb-20">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="display min-w-0 truncate text-3xl">
          {project ? <>{owner && <span className="text-faint">{owner}</span>}{repo}</> : 'Use cases'}
        </h1>
        {project && (
          <button
            type="button" onClick={clearProject}
            className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-panel py-1 pr-3 pl-2 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg ${focusRing}`}
          >
            <Icon name="x" className="size-3" />All projects
          </button>
        )}
        {all.length > 0 && (
          <p className="flex items-center gap-x-2 text-sm text-faint" role="status" title="Updates live while your agent works">
            <LiveDot small className="mr-0.5" />
            <span className="tabular-nums">
              {all.length} found<span aria-hidden> · </span>{done} benchmarked
              {savings > 0 && <><span aria-hidden> · </span><span className="text-win">~{usd(savings)}/month</span> to save</>}
            </span>
          </p>
        )}
        {all.length > 0 && <ViewControls view={view} update={update} className="ml-auto" />}
      </header>

      {/* Three states, each its own block (keyed), so going from the skeleton to the empty state or the list,
          or from the empty state to the first use case, swaps blocks instead of pushing a shared one around. */}
      {q.isLoading ? (
        <div key="loading">
          <ToolbarSkeleton />
          <div className="mt-6"><ListSkeleton /></div>
        </div>
      ) : all.length === 0 ? (
        <div key="empty" className="mt-6">
          {q.error && !q.data && <ErrorNote error={q.error} />}
          {q.data?.length === 0 && <WaitingForAgent />}
          {project && everything.length > 0 && (
            <div className="rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
              <p className="title">No use cases in “{project}”</p>
              <p className="mt-1 text-sm text-muted">The project may have been renamed, or its use cases deleted.</p>
              <button type="button" onClick={clearProject} className={`mt-4 rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-fg hover:border-line-strong ${focusRing}`}>
                Show all projects
              </button>
            </div>
          )}
        </div>
      ) : (
        <div key="list">
          {/* the banner slides open and shut (it carries its own top spacing), so the list moves smoothly */}
          <ScanBanner list={all} fallbackName={fallbackName} />
          <div className="mt-5"><Toolbar all={all} view={view} update={update} now={now} controls={false} /></div>
          <div className="mt-6">
            {shown.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
                <p className="title">No use cases match</p>
                <p className="mt-1 text-sm text-muted">Nothing fits {view.q.trim() ? <>“{view.q.trim()}”</> : 'this filter'}.</p>
                <button type="button" onClick={() => update({ q: '', status: 'all' })} className={`mt-4 rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-fg hover:border-line-strong ${focusRing}`}>
                  Clear filters
                </button>
              </div>
            ) : (
              <ProjectList
                useCases={shown} all={all} fallbackName={fallbackName} fresh={fresh}
                sort={view.sort} flat={view.group === 'none'} filtering={isFiltering(view)} ops={ops}
                single={!!project}
              />
            )}
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 lg:left-(--sidebar-w)" role="region" aria-label="Bulk actions">
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
