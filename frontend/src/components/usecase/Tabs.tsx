// Underline tabs for the use-case page. The active tab lives in the URL (?tab=), so reload and shared links
// keep it; Overview is the default and leaves the URL clean. Arrow keys, Home and End move between tabs.
import { useRef, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { focusRing } from '@/components/usecases/kit'
import { LiveDot } from '@/components/usecases/live'

export const TAB_KEYS = ['overview', 'cases', 'scoring', 'prompt', 'runs'] as const
export type TabKey = (typeof TAB_KEYS)[number]
export const TAB_LABEL: Record<TabKey, string> = { overview: 'Overview', cases: 'Test cases', scoring: 'Scoring', prompt: 'Prompt', runs: 'Runs' }

export function useTab(): [TabKey, (t: TabKey) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab = (TAB_KEYS as readonly string[]).includes(raw ?? '') ? (raw as TabKey) : 'overview'
  const set = (t: TabKey) => setParams((p) => {
    const next = new URLSearchParams(p)
    if (t === 'overview') next.delete('tab')
    else next.set('tab', t)
    return next
  }, { replace: true })
  return [tab, set]
}

export interface TabDef {
  key: TabKey
  count?: number | null
  /** attention: something only the user can supply (coral); live: the agent is working on it */
  marker?: 'attention' | 'live' | null
}

const tabId = (k: TabKey) => `uc-tab-${k}`
const panelId = (k: TabKey) => `uc-panel-${k}`

export function TabBar({ tabs, active, onChange }: { tabs: TabDef[]; active: TabKey; onChange: (t: TabKey) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (i: number) => {
    const j = (i + tabs.length) % tabs.length
    onChange(tabs[j].key)
    refs.current[j]?.focus()
  }
  return (
    <div role="tablist" aria-label="Use case" className="flex gap-7 overflow-x-auto border-b border-line">
      {tabs.map((t, i) => {
        const on = t.key === active
        return (
          <button
            key={t.key} ref={(el) => { refs.current[i] = el }}
            type="button" role="tab" id={tabId(t.key)} aria-selected={on} aria-controls={panelId(t.key)} tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => {
              const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
              if (k === undefined) return
              e.preventDefault()
              move(k)
            }}
            className={`-mb-px flex shrink-0 items-center gap-2 rounded-t-sm border-b-2 pt-1 pb-3 text-sm transition-colors ${on ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg'} ${focusRing}`}
          >
            {t.marker === 'live' && <><LiveDot small /><span className="sr-only">Your agent is setting this up:</span></>}
            {TAB_LABEL[t.key]}
            {t.count != null && <span className={`rounded-md px-1.5 py-px text-xs tabular-nums ${on ? 'bg-raised text-muted' : 'bg-raised/60 text-faint'}`}>{t.count}</span>}
            {t.marker === 'attention' && <><span className="size-1.5 rounded-[1px] bg-front" aria-hidden /><span className="sr-only">(needs your input)</span></>}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ tab, children }: { tab: TabKey; children: ReactNode }) {
  return (
    <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} tabIndex={0} className="mt-8 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-signal/40">
      {children}
    </div>
  )
}
