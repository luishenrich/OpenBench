import { type ReactNode, useEffect, useState } from 'react'
import { pct, usd } from '@/lib/format'
import type { Run } from '@/types'
import { isReference } from './ModelName'

const LIVE = new Set(['queued', 'running', 'scoring'])

function duration(s: number) {
  s = Math.max(0, Math.round(s))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h ? `${h}h ${m}m` : m ? `${m}m ${String(sec).padStart(2, '0')}s` : `${sec}s`
}

/** Ticks every second while the run is live, so "running for" moves. */
function useNow(live: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [live])
  return now
}

function Fact({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 text-base font-medium text-fg tabular-nums lg:whitespace-nowrap">{value}</dd>
      {/* the detail line is always there (one line, never wrapping), so the strip keeps its height while numbers arrive */}
      <dd className="mt-0.5 text-xs text-faint tabular-nums lg:truncate">{detail ?? '\u00a0'}</dd>
    </div>
  )
}

// One calm row of run figures: duration, cost vs estimate, calls, jury, model counts. While the run is live,
// a slim bar with the phase underneath.
/** "Calling models 335/540" or "Jury scoring 120/539", and how far that phase is. */
export function runPhase(r: Run): { text: string; frac: number; jurying: boolean } {
  const p = r.progress
  const jurying = r.status === 'scoring' || (p.total > 0 && p.done >= p.total && p.judge_total > 0)
  const frac = r.status === 'queued' ? 0 : jurying ? (p.judge_total ? p.judged / p.judge_total : 0) : p.total ? p.done / p.total : 0
  const text = r.status === 'queued' ? 'Queued, waiting for a worker'
    : jurying ? `Jury scoring ${p.judged.toLocaleString()}/${p.judge_total.toLocaleString()}`
    : `Calling models ${p.done.toLocaleString()}/${p.total.toLocaleString()}`
  return { text, frac, jurying }
}

export default function RunFacts({ run: r }: { run: Run }) {
  const live = LIVE.has(r.status)
  const now = useNow(live)
  const p = r.progress

  const start = r.started_at ? Date.parse(r.started_at) : null
  const end = r.finished_at ? Date.parse(r.finished_at) : null
  const dur = start == null ? null : (end ?? (live ? now : null)) != null ? ((end ?? now) - start) / 1000 : null

  // Model spend from the leaderboard (mean cost per call × calls, references included). Jury = the rest.
  // Only shown when it fits inside the actual cost; otherwise the per-call means are too rough to split by.
  const models = r.leaderboard.reduce((a, c) => a + c.cost_per_call_usd * c.n, 0)
  const split = p.judge_total > 0 && r.leaderboard.length > 0 && models > 0 && models <= r.actual_cost_usd * 1.02
  const jury = Math.max(0, r.actual_cost_usd - models)

  const cands = r.leaderboard.length ? r.leaderboard.filter((c) => !isReference(c)).length : r.candidates.length
  const refs = r.leaderboard.length ? r.leaderboard.filter(isReference).length : (r.references ?? []).length

  // Phase: calling models until every call is back, then the jury.
  const { text: phase, frac, jurying } = runPhase(r)

  return (
    <div className="mt-8 rounded-xl border border-line bg-panel px-5 py-4">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.45fr)_minmax(0,0.85fr)_minmax(0,1.05fr)_minmax(0,1.15fr)]">
        <Fact
          label={live ? 'Running for' : 'Duration'}
          value={dur == null ? '–' : duration(dur)}
          detail={!live && r.finished_at ? `finished ${new Date(r.finished_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : undefined}
        />
        <Fact
          label={live ? 'Spent so far' : 'Real cost'}
          value={<>{usd(r.actual_cost_usd)} <span className="font-normal text-muted">of {usd(r.est_cost_usd)} estimated</span></>}
          detail={split ? <span title="Derived: model spend = mean cost per call × calls for every model on the leaderboard, references included. Jury = real cost minus that.">models {usd(models)} · jury {usd(jury)}, derived</span> : undefined}
        />
        <Fact
          label="Calls"
          value={<>{p.done.toLocaleString()}<span className="font-normal text-muted">/{p.total.toLocaleString()}</span></>}
          detail={p.errors > 0 ? <span className="text-bad">{p.errors} {p.errors === 1 ? 'error' : 'errors'}</span> : 'no errors'}
        />
        <Fact
          label="Jury"
          value={p.judge_total > 0 ? <>{p.judged.toLocaleString()}<span className="font-normal text-muted">/{p.judge_total.toLocaleString()} judged</span></> : <span className="font-normal text-muted">no judge metric</span>}
          detail={r.judge_agreement != null ? `jurors agree on ${pct(r.judge_agreement, 0)}` : undefined}
        />
        <Fact
          label="Models"
          value={<>{cands} <span className="font-normal text-muted">{cands === 1 ? 'candidate' : 'candidates'}</span></>}
          detail={`${refs} closed ${refs === 1 ? 'reference' : 'references'}, ${r.repeats} repeats`}
        />
      </dl>
      {live && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="flex items-baseline justify-between gap-4 text-xs">
            <span className="text-muted tabular-nums">{phase}</span>
            <span className="text-faint tabular-nums">{Math.round(frac * 100)}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={phase} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)}>
            <div className={`h-full rounded-full transition-[width] duration-700 ${jurying ? 'bg-signal' : 'bg-front'}`} style={{ width: `${frac * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
