import { useRef, useState } from 'react'
import { usd } from '@/lib/format'
import type { UseCase } from '@/types'
import {
  type KindGroup, type ProjectGroup, STATE_ORDER, countStates, groupUseCases, kindLabel, savingsOf, stateDot, stateShort,
} from './group'
import { ROW_GRID, UseCaseRow } from './UseCaseRow'

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

export function ProjectList({ useCases, fallbackName, fresh }: { useCases: UseCase[]; fallbackName: string; fresh: Set<string> }) {
  const projects = groupUseCases(useCases, fallbackName)
  const [prefs, setPrefs] = useState(loadPrefs)
  // A section's default is decided the first time it shows up and then kept, so sections don't
  // fold shut under the user's eyes when a live scan pushes the count past the threshold.
  const defaults = useRef(new Map<string, boolean>())
  let index = 0
  for (const p of projects) for (const k of p.kinds) {
    if (!defaults.current.has(k.key)) defaults.current.set(k.key, useCases.length <= OPEN_ALL_UP_TO || index < OPEN_FIRST)
    index++
  }
  const isOpen = (key: string) => prefs[key] ?? defaults.current.get(key) ?? false
  const toggle = (key: string) => {
    const next = { ...prefs, [key]: !isOpen(key) }
    setPrefs(next)
    savePrefs(next)
  }

  return (
    <div className="space-y-10">
      {projects.map((p) => <Project key={p.key} project={p} isOpen={isOpen} toggle={toggle} fresh={fresh} />)}
    </div>
  )
}

function Project({ project, isOpen, toggle, fresh }: { project: ProjectGroup; isOpen: (k: string) => boolean; toggle: (k: string) => void; fresh: Set<string> }) {
  const n = project.items.length
  const c = countStates(project.items)
  const setUp = c.ready + c.running + c.done + c.failed
  const savings = savingsOf(project.items)
  const [owner, repo] = project.name.includes('/') ? [project.name.slice(0, project.name.lastIndexOf('/') + 1), project.name.slice(project.name.lastIndexOf('/') + 1)] : ['', project.name]

  return (
    <section aria-label={project.name}>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <h2 className="title truncate text-xl">
            {owner && <span className="text-faint">{owner}</span>}{repo}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {n} LLM {n === 1 ? 'call' : 'calls'} found · {setUp} of {n} set up · {c.done} benchmarked
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
        {project.kinds.some((k) => isOpen(k.key)) && (
          <div className={`hidden gap-x-4 border-b border-line bg-bg px-4 py-2 text-xs text-faint md:grid ${ROW_GRID}`}>
            <span>Use case</span><span>Today</span><span className="text-right">Cases</span><span>Status</span><span />
          </div>
        )}
        {project.kinds.map((k, i) => (
          <KindSection key={k.key} group={k} first={i === 0} open={isOpen(k.key)} onToggle={() => toggle(k.key)} fresh={fresh} />
        ))}
      </div>
    </section>
  )
}

function KindSection({ group, first, open, onToggle, fresh }: { group: KindGroup; first: boolean; open: boolean; onToggle: () => void; fresh: Set<string> }) {
  const c = countStates(group.items)
  const newHere = group.items.filter((u) => fresh.has(u.id)).length
  const bodyId = `uc-section-${group.key.replace(/[^a-z0-9]+/gi, '-')}`

  return (
    <div className={first ? '' : 'border-t border-line'}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={`flex w-full items-center gap-3 bg-panel px-4 py-2.5 text-left transition-colors hover:bg-raised ${open ? 'border-b border-line' : ''}`}
      >
        <svg viewBox="0 0 16 16" className={`size-3.5 shrink-0 text-faint transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>
          <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="text-sm font-medium text-fg">{kindLabel[group.kind]}</span>
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
      {open && (
        <ul id={bodyId} className="divide-y divide-line">
          {group.items.map((uc) => <li key={uc.id}><UseCaseRow uc={uc} fresh={fresh.has(uc.id)} /></li>)}
        </ul>
      )}
    </div>
  )
}
