import { useRef, useState } from 'react'
import { usd } from '@/lib/format'
import type { UseCase } from '@/types'
import {
  type KindGroup, type ProjectGroup, type SortKey, STATE_ORDER, countStates, groupUseCases, kindLabel, projectOf, savingsOf, setupState, stateDot, stateShort,
} from './group'
import { Checkbox, Icon } from './kit'
import { MENU_W, ROW_GRID, ROW_INDENT, SELECT_W, UseCaseRow } from './UseCaseRow'

const STORE = 'biy:use-case-sections'
const OPEN_ALL_UP_TO = 12 // at or below this many use cases every section starts open
const OPEN_FIRST = 2 // above it, only the first sections start open

function loadPrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORE)
    const v = raw ? JSON.parse(raw) : {}
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function savePrefs(p: Record<string, boolean>) {
  try {
    localStorage.setItem(STORE, JSON.stringify(p))
  } catch {
    // storage blocked: the choice lasts for this page view only
  }
}

export interface ListOps {
  selected: Set<string>
  setSelected: (ids: string[], v: boolean) => void
  isPinned: (u: UseCase) => boolean
  setPinned: (ids: string[], v: boolean) => void
  rename: (id: string, name: string) => void
  remove: (items: UseCase[]) => void
}

export function ProjectList({ useCases, all, fallbackName, fresh, sort, flat, filtering, ops }: {
  /** after search and status filter */
  useCases: UseCase[]
  /** everything, for the project header numbers */
  all: UseCase[]
  fallbackName: string
  fresh: Set<string>
  sort: SortKey
  flat: boolean
  /** a search or filter is active: every section opens so matches are visible */
  filtering: boolean
  ops: ListOps
}) {
  const projects = groupUseCases(useCases, fallbackName, { sort, flat, isPinned: ops.isPinned })
  const [prefs, setPrefs] = useState(loadPrefs)
  // A section's default is decided the first time it shows up and then kept, so sections don't
  // fold shut under the user's eyes when a live scan pushes the count past the threshold.
  const defaults = useRef(new Map<string, boolean>())
  let index = 0
  for (const p of projects) for (const k of p.kinds) {
    if (!defaults.current.has(k.key)) defaults.current.set(k.key, all.length <= OPEN_ALL_UP_TO || index < OPEN_FIRST)
    index++
  }
  const isOpen = (key: string) => filtering || key.endsWith('::all') || (prefs[key] ?? defaults.current.get(key) ?? false)
  const toggle = (key: string) => {
    const next = { ...prefs, [key]: !isOpen(key) }
    setPrefs(next)
    savePrefs(next)
  }
  const openAll = (keys: string[]) => {
    const next = { ...prefs, ...Object.fromEntries(keys.map((k) => [k, true])) }
    setPrefs(next)
    savePrefs(next)
  }

  return (
    <div className="space-y-10">
      {projects.map((p) => (
        <Project
          key={p.key} project={p} projectAll={all.filter((u) => projectOf(u, fallbackName) === p.name)}
          isOpen={isOpen} toggle={toggle} openAll={openAll} fresh={fresh} ops={ops}
        />
      ))}
    </div>
  )
}

function ColumnHeader() {
  return (
    <div className="hidden border-b border-line bg-bg py-2 text-xs text-faint md:flex">
      <span className={`shrink-0 ${SELECT_W}`} />
      <div className={`grid min-w-0 flex-1 gap-x-4 pr-1 ${ROW_INDENT} ${ROW_GRID}`}>
        <span>Use case</span><span>Today</span><span className="text-right">Cases</span><span>Status</span>
      </div>
      <span className={`shrink-0 ${MENU_W}`} />
    </div>
  )
}

function Project({ project, projectAll, isOpen, toggle, openAll, fresh, ops }: {
  project: ProjectGroup; projectAll: UseCase[]; isOpen: (k: string) => boolean; toggle: (k: string) => void; openAll: (keys: string[]) => void
  fresh: Set<string>; ops: ListOps
}) {
  const n = projectAll.length
  const c = countStates(projectAll)
  const setUp = c.ready + c.running + c.done + c.failed
  const savings = savingsOf(projectAll)
  const [owner, repo] = project.name.includes('/') ? [project.name.slice(0, project.name.lastIndexOf('/') + 1), project.name.slice(project.name.lastIndexOf('/') + 1)] : ['', project.name]
  const anyOpen = project.pinned.length > 0 || project.kinds.some((k) => isOpen(k.key))

  return (
    <section aria-label={project.name}>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <h2 className="title truncate text-xl">
            {owner && <span className="text-faint">{owner}</span>}{repo}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {n} LLM {n === 1 ? 'call' : 'calls'} found · {setUp} of {n} set up · {c.done} benchmarked
            {c.data > 0 && (
              <>
                {' · '}
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-sm font-medium text-front underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-signal/70"
                  title="Open the sections that need your input"
                  onClick={() => {
                    const keys = project.kinds.filter((k) => k.items.some((u) => setupState(u) === 'data')).map((k) => k.key)
                    openAll(keys)
                    requestAnimationFrame(() => document.getElementById(`uc-section-${keys[0]?.replace(/[^a-z0-9]+/gi, '-')}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
                  }}
                >
                  <span className="size-1.5 rounded-[1px] bg-front" />{c.data} need your input
                </button>
              </>
            )}
          </p>
        </div>
        {savings > 0 && <p className="text-sm text-win">~{usd(savings)}/month to save</p>}
      </header>

      {/* progress: benchmarked, running, ready, still being set up */}
      <div className="mb-4 flex h-1 overflow-hidden rounded-full bg-raised" aria-hidden>
        {(['done', 'running', 'ready'] as const).map((s) => c[s] > 0 && (
          <span key={s} className={`${stateDot[s]} transition-[width] duration-700`} style={{ width: `${(c[s] / n) * 100}%` }} />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        {anyOpen && <ColumnHeader />}
        {project.pinned.length > 0 && (
          <div>
            <div className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2 text-xs text-muted">
              <Icon name="pin" className="size-3.5 text-front" /> Pinned
              <span className="rounded-md bg-raised px-1.5 py-px tabular-nums">{project.pinned.length}</span>
            </div>
            <ul className="divide-y divide-line border-b border-line">
              {project.pinned.map((uc) => <li key={uc.id}><Row uc={uc} fresh={fresh} ops={ops} /></li>)}
            </ul>
          </div>
        )}
        {project.kinds.map((k, i) => (
          k.kind === null
            ? <ul key={k.key} className="divide-y divide-line">{k.items.map((uc) => <li key={uc.id}><Row uc={uc} fresh={fresh} ops={ops} /></li>)}</ul>
            : <KindSection key={k.key} group={k} first={i === 0 && !project.pinned.length} open={isOpen(k.key)} onToggle={() => toggle(k.key)} fresh={fresh} ops={ops} />
        ))}
      </div>
    </section>
  )
}

function Row({ uc, fresh, ops }: { uc: UseCase; fresh: Set<string>; ops: ListOps }) {
  const pinned = ops.isPinned(uc)
  return (
    <UseCaseRow
      uc={uc} fresh={fresh.has(uc.id)}
      actions={{
        selected: ops.selected.has(uc.id),
        selecting: ops.selected.size > 0,
        onSelect: (v) => ops.setSelected([uc.id], v),
        pinned,
        onPin: (v) => ops.setPinned([uc.id], v),
        onRename: (name) => ops.rename(uc.id, name),
        onDelete: () => ops.remove([uc]),
      }}
    />
  )
}

function KindSection({ group, first, open, onToggle, fresh, ops }: {
  group: KindGroup; first: boolean; open: boolean; onToggle: () => void; fresh: Set<string>; ops: ListOps
}) {
  const c = countStates(group.items)
  const newHere = group.items.filter((u) => fresh.has(u.id)).length
  const bodyId = `uc-section-${group.key.replace(/[^a-z0-9]+/gi, '-')}`
  const ids = group.items.map((u) => u.id)
  const nSel = ids.filter((id) => ops.selected.has(id)).length

  return (
    <div className={first ? '' : 'border-t border-line'}>
      <div className={`group/sec flex items-center bg-panel transition-colors hover:bg-raised ${open ? 'border-b border-line' : ''}`}>
        <div className={`grid shrink-0 place-items-center self-stretch ${SELECT_W}`}>
          <Checkbox
            checked={nSel > 0 && nSel === ids.length} indeterminate={nSel > 0 && nSel < ids.length}
            onChange={(v) => ops.setSelected(ids, v)} label={`Select all ${group.kind ? kindLabel[group.kind] : ''} use cases`}
            className={ops.selected.size > 0 ? '' : 'opacity-0 group-hover/sec:opacity-100 focus-visible:opacity-100'}
          />
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-sm py-2.5 pr-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
        >
          <svg viewBox="0 0 16 16" className={`size-3.5 shrink-0 text-faint transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>
            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="text-sm font-medium text-fg">{group.kind ? kindLabel[group.kind] : 'All'}</span>
          <span className="rounded-md bg-raised px-1.5 py-px text-xs tabular-nums text-muted">{group.items.length}</span>
          {newHere > 0 && <span className="text-xs text-front">{newHere} new</span>}
          <span className="ml-auto flex min-w-0 flex-wrap justify-end gap-x-3 gap-y-0.5 text-xs text-faint">
            {STATE_ORDER.filter((s) => c[s] > 0).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className={`size-1.5 rounded-[1px] ${stateDot[s]}`} />{c[s]} {stateShort[s]}
              </span>
            ))}
          </span>
        </button>
      </div>
      {open && (
        <ul id={bodyId} className="divide-y divide-line">
          {group.items.map((uc) => <li key={uc.id}><Row uc={uc} fresh={fresh} ops={ops} /></li>)}
        </ul>
      )}
    </div>
  )
}
