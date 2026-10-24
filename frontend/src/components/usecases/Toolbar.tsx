import { useEffect, useRef, useState } from 'react'
import type { UseCase } from '@/types'
import { type SetupState, type SortKey, setupState, sortLabel, stateDot } from './group'
import { Icon, focusRing } from './kit'

export type StatusFilter = 'all' | 'data' | 'ready' | 'running' | 'done'
const FILTERS: { key: StatusFilter; label: string; states: SetupState[] }[] = [
  { key: 'all', label: 'All', states: [] },
  { key: 'data', label: 'Needs data', states: ['data'] },
  { key: 'ready', label: 'Ready', states: ['ready'] },
  { key: 'running', label: 'Running', states: ['running'] },
  { key: 'done', label: 'Benchmarked', states: ['done'] },
]

export interface ListView { q: string; status: StatusFilter; sort: SortKey; group: 'kind' | 'none' }
const STORE = 'biy:use-case-view'
const DEFAULT: ListView = { q: '', status: 'all', sort: 'attention', group: 'kind' }

/** Filter, sort and grouping, remembered in this browser (the search text is not). */
export function useListView() {
  const [view, setView] = useState<ListView>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<ListView>
      return { ...DEFAULT, ...saved, q: '' }
    } catch {
      return DEFAULT
    }
  })
  const update = (p: Partial<ListView>) => setView((v) => {
    const next = { ...v, ...p }
    try {
      const { q: _q, ...keep } = next
      localStorage.setItem(STORE, JSON.stringify(keep))
    } catch { /* storage blocked: the choice lasts for this page view */ }
    return next
  })
  return [view, update] as const
}

export function applyView(list: UseCase[], view: ListView): UseCase[] {
  const f = FILTERS.find((x) => x.key === view.status)!
  const q = view.q.trim().toLowerCase()
  return list.filter((u) => {
    if (f.states.length && !f.states.includes(setupState(u))) return false
    if (!q) return true
    const hay = [u.name, u.kind, u.current_model?.model ?? '', ...u.source_refs.map((r) => `${r.path} ${r.symbol ?? ''} ${r.repo ?? ''}`)].join(' ').toLowerCase()
    return q.split(/\s+/).every((t) => hay.includes(t))
  })
}

export const isFiltering = (v: ListView) => v.q.trim() !== '' || v.status !== 'all'

export function Toolbar({ all, view, update }: { all: UseCase[]; view: ListView; update: (p: Partial<ListView>) => void }) {
  const search = useRef<HTMLInputElement>(null)
  // "/" focuses search, unless the user is typing somewhere
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key !== '/' || e.metaKey || e.ctrlKey || t.closest('input, textarea, select, [contenteditable=true]')) return
      e.preventDefault()
      search.current?.focus()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, f.states.length ? all.filter((u) => f.states.includes(setupState(u))).length : all.length]))

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
      <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-xs">
        <Icon name="search" className="pointer-events-none absolute left-2.5 size-3.5 text-faint" />
        <input
          ref={search} type="search" value={view.q} onChange={(e) => update({ q: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Escape') { update({ q: '' }); search.current?.blur() } }}
          placeholder="Search name, path or model" aria-label="Search use cases"
          className={`w-full rounded-md border border-line bg-panel py-1.5 pr-8 pl-8 text-sm text-fg placeholder:text-faint hover:border-line-strong ${focusRing}`}
        />
        <kbd className="pointer-events-none absolute right-2 rounded border border-line px-1 font-mono text-[10px] text-faint">/</kbd>
      </label>

      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const on = view.status === f.key
          return (
            <button
              key={f.key} type="button" role="radio" aria-checked={on} onClick={() => update({ status: f.key })}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] transition-colors ${on ? 'border-line-strong bg-raised text-fg' : 'border-transparent text-muted hover:text-fg'} ${focusRing}`}
            >
              {f.states[0] && <span className={`size-1.5 rounded-[1px] ${stateDot[f.states[0]]}`} />}
              {f.label}
              <span className={`tabular-nums ${on ? 'text-muted' : 'text-faint'}`}>{counts[f.key]}</span>
            </button>
          )
        })}
      </div>

      <div className="ml-auto flex items-center gap-2 text-[13px]">
        <label className="flex items-center gap-1.5 text-faint">
          Sort
          <select
            value={view.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}
            className={`rounded-md border border-line bg-panel px-2 py-1 text-fg hover:border-line-strong ${focusRing}`}
          >
            {(Object.keys(sortLabel) as SortKey[]).map((k) => <option key={k} value={k}>{sortLabel[k]}</option>)}
          </select>
        </label>
        <div className="flex rounded-md border border-line p-0.5" role="radiogroup" aria-label="Group by">
          {(['kind', 'none'] as const).map((g) => (
            <button
              key={g} type="button" role="radio" aria-checked={view.group === g} onClick={() => update({ group: g })}
              className={`rounded-[5px] px-2 py-0.5 transition-colors ${view.group === g ? 'bg-raised text-fg' : 'text-faint hover:text-fg'} ${focusRing}`}
            >
              {g === 'kind' ? 'By kind' : 'Flat'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
