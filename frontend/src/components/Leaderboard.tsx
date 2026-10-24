import { ms, num, pct, usd } from '@/lib/format'
import type { CandidateResult, MetricInfo } from '@/types'
import { Tag } from './ui'
import { LiveDot } from '@/components/usecases/live'
import { ProviderIcon } from '@/components/ModelIcon'
import { ModelName, isReference, isToday, notScored, prettyModel, reasoningNote, rowEffort } from './run/ModelName'

// A forest plot: one lane per model on a shared quality axis. The band is the 95% CI, the tick is the mean,
// the dashed line is today's model. Overlapping bands mean the difference is not significant.

// rank | model (name, tags, reasoning; provider, n, per-metric chips) | quality lane (≤ 200px, ≤ 20%) | mean ± std | p95 latency | cost | errors
// The model column takes the slack so names and chips stay on two lines; the lane stays a compact forest plot.
export const LEADERBOARD_COLS = 'grid-cols-[20px_minmax(300px,1fr)_minmax(150px,min(20%,200px))_64px_92px_72px_40px]'
const COLS = LEADERBOARD_COLS

function axis(rows: CandidateResult[]) {
  const lo = Math.min(...rows.map((r) => r.quality.ci_low))
  const hi = Math.max(...rows.map((r) => r.quality.ci_high))
  const min = Math.max(0, Math.floor((lo - 0.01) * 50) / 50)
  const max = Math.min(1, Math.ceil((hi + 0.01) * 50) / 50)
  const span = max - min || 1
  const step = span > 0.3 ? 0.1 : span > 0.12 ? 0.05 : 0.02
  const ticks: number[] = []
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) ticks.push(+t.toFixed(3))
  return { min, max, x: (v: number) => ((v - min) / span) * 100, ticks }
}

function Lane({ r, x, baseX, refXs, recommended, running }: {
  r: CandidateResult; x: (v: number) => number; baseX: number | null; refXs: number[]; recommended: boolean; running: boolean
}) {
  // references are grey whatever their gates say: they are measured, never judged as candidates
  const color = recommended ? 'var(--color-front)' : isToday(r) ? 'var(--color-fg)' : isReference(r) ? 'var(--color-faint)' : r.passed_gates || running ? 'var(--color-muted)' : 'var(--color-bad)'
  return (
    <div className="relative h-9">
      {refXs.map((rx, i) => <div key={i} className="absolute top-0 bottom-0 border-l border-dotted border-line-strong" style={{ left: `${rx}%` }} />)}
      {baseX != null && <div className="absolute top-0 bottom-0 border-l border-dashed border-faint" style={{ left: `${baseX}%` }} />}
      <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-line" />
      <div
        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-[2px]"
        style={{ left: `${x(r.quality.ci_low)}%`, width: `${Math.max(0.8, x(r.quality.ci_high) - x(r.quality.ci_low))}%`, background: color, opacity: running ? 0.25 : 0.35 }}
      />
      <div className="absolute top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-[1px]" style={{ left: `${x(r.quality.mean)}%`, background: color }} />
    </div>
  )
}

export default function Leaderboard({ rows, metrics, recommended, closest = null, running, order = [] }: {
  rows: CandidateResult[]
  metrics: MetricInfo[]
  recommended: string | null
  /** on a "keep" verdict: the best challenger, tagged but not highlighted as the pick */
  closest?: string | null
  running: boolean
  /** "provider:model" of the run's candidates: while running, rows keep this order instead of jumping with live scores */
  order?: string[]
}) {
  const slot = (r: CandidateResult) => { const i = order.indexOf(r.candidate_key.split('@')[0]); return i < 0 ? 999 : i }
  const sorted = running
    ? [...rows].sort((a, b) => slot(a) - slot(b) || a.candidate_key.localeCompare(b.candidate_key))
    : [...rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.scores.utility - a.scores.utility)
  // Open-weight candidates are ranked. Closed references (incl. "today") are measured but never ranked, and
  // their failed_gates is informative only. Candidates no juror could score are unranked too.
  const base = sorted.find(isToday)
  const refs = sorted.filter((r) => isReference(r) && !isToday(r)).sort((a, b) => (running ? 0 : b.quality.mean - a.quality.mean))
  const cands = sorted.filter((r) => !isReference(r))
  // While the run is live nothing is final: unjudged rows aren't "not scored", failed gates are provisional.
  // Every candidate stays in one list, in order; the groups only appear once the run is done.
  const passed = running ? cands : cands.filter((r) => r.passed_gates && !notScored(r))
  const failed = running ? [] : cands.filter((r) => !r.passed_gates && !notScored(r))
  const unscored = running ? [] : cands.filter(notScored)
  const scoredRows = sorted.filter((r) => !notScored(r))
  const { x, ticks } = axis(scoredRows.length ? scoredRows : sorted)
  const baseX = base ? x(base.quality.mean) : null
  const refXs = refs.map((r) => x(r.quality.mean))
  const name = (id: string) => metrics.find((m) => m.id === id || m.aliases.includes(id))?.name ?? id.replaceAll('_', ' ')
  // "json_schema_valid >= 0.99" → "JSON Schema validity ≥ 0.99"
  const gateText = (g: string) => {
    const [id, op, ...rest] = g.split(' ')
    return [name(id), { '>=': '≥', '<=': '≤' }[op ?? ''] ?? op, ...rest].filter(Boolean).join(' ')
  }

  const row = (r: CandidateResult) => {
    const isRec = r.candidate_key === recommended && !isReference(r)
    const ref = isReference(r)
    const today = isToday(r)
    const unscoredRow = notScored(r)
    const failedIds = ref || running ? new Set<string>() : new Set(r.failed_gates.map((g) => g.split(' ')[0]))
    const note = reasoningNote(r)
    return (
      <div key={r.candidate_key} className={`grid ${COLS} items-center gap-x-2.5 border-t border-line px-4 py-2.5 ${isRec ? 'bg-front/[0.06]' : ''} ${ref ? 'text-muted' : ''}`}>
        <span className={`title text-lg tabular-nums ${isRec ? 'text-front' : r.rank && !ref ? 'text-fg' : 'text-faint'}`}>{ref ? '–' : r.rank ?? '–'}</span>
        <div className="@container min-w-0">
          {/* line 1: name, tags and how much it reasons (a property of the model, like its effort) */}
          <div className="flex min-w-0 items-center gap-1.5 [&>*]:shrink-0">
            <ModelName model={r.candidate_key} effort={rowEffort(r)} nameClass={ref && !today ? 'font-medium text-muted' : 'font-medium'} />
            {today ? <Tag>today</Tag> : ref && <Tag>reference</Tag>}
            {isRec && <Tag tone="front">pick</Tag>}
            {r.candidate_key === closest && <Tag>closest challenger</Tag>}
            {r.pareto && !isRec && !ref && !(running && unscoredRow) && <Tag tone="signal">Pareto</Tag>}
            {note && <span className="ml-0.5 hidden min-w-0 !shrink truncate text-xs text-faint @[460px]:inline" title={note}>{note}</span>}
          </div>
          {/* line 2: provider and n, then the per-metric chips */}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-faint">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><ProviderIcon provider={r.provider} size={11} />via {r.provider}, n = {r.n}</span>
            {/* in a narrow model column the reasoning note moves here instead of being cut off on line 1 */}
            {note && <span className="whitespace-nowrap @[460px]:hidden">· {note}</span>}
            {!!r.dropped_params?.length && (
              <span title="This model does not accept these settings, so it ran at the provider's default">
                · {r.dropped_params.join(', ')} not supported, ran at provider default
              </span>
            )}
            {Object.entries(r.metrics).map(([k, v]) => {
              const bad = failedIds.has(k)
              return (
                <span key={k} className={`inline-flex items-baseline gap-1.5 rounded-[5px] border px-1.5 py-[3px] text-[11px] leading-none whitespace-nowrap ${bad ? 'border-bad/40 text-bad' : 'border-line text-faint'}`}>
                  {name(k)}<span className={`font-medium tabular-nums ${bad ? '' : 'text-muted'}`}>{pct(v.mean, 0)}</span>
                </span>
              )
            })}
          </div>
          {ref && !r.passed_gates && <div className="mt-1 text-xs text-faint">Below {r.failed_gates.map(gateText).join(', ')} (for information)</div>}
          {!r.passed_gates && !ref && !unscoredRow && (running
            ? <div className="mt-1 text-xs text-faint">Below {r.failed_gates.map(gateText).join(', ')} so far</div>
            : <div className="mt-1 text-xs text-bad">Failed {r.failed_gates.map(gateText).join(', ')}</div>)}
          {!running && !!r.unmeasured_gates?.length && (
            <div className="mt-1 text-xs text-faint" title="No model produced a value for these metrics, so the gate was skipped">
              Not evaluated (never measured): {r.unmeasured_gates.map(gateText).join(', ')}
            </div>
          )}
        </div>
        <div className="min-w-0">
          {unscoredRow && running
            ? <p className="flex items-center gap-2 text-xs text-muted"><LiveDot small />Not scored yet</p>
            : unscoredRow
            ? <p className="text-xs text-faint">Quality not scored: every juror abstained on this model's family.</p>
            : <Lane r={r} x={x} baseX={baseX} refXs={refXs} recommended={isRec} running={running} />}
        </div>
        <div className="text-right tabular-nums">
          <div className="text-sm font-medium">{unscoredRow ? '–' : pct(r.quality.mean)}</div>
          <div className="text-[11px] text-faint">{unscoredRow ? ' ' : `± ${pct(r.quality.std)}`}</div>
        </div>
        <div className="text-right text-sm whitespace-nowrap tabular-nums">
          {ms(r.e2e_ms.p95)}
          {r.ttft_ms && <div className="text-[11px] text-faint">first token {ms(r.ttft_ms.p95)}</div>}
        </div>
        <div className="text-right text-sm tabular-nums">{usd(r.cost_per_call_usd)}</div>
        <div className={`text-right text-sm tabular-nums ${r.error_rate > 0 ? 'text-bad' : 'text-faint'}`}>{pct(r.error_rate, r.error_rate ? 1 : 0)}</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <div className="min-w-[860px]">
        <div className={`grid ${COLS} items-end gap-x-2.5 px-4 pt-3 pb-2 text-xs text-faint`}>
          <span>#</span>
          <span>Model</span>
          <div className="relative h-8 min-w-0">
            <span className="absolute top-0 left-0 whitespace-nowrap">Quality, 95% CI</span>
            {scoredRows.length > 0 && ticks.map((t) => (
              <span key={t} className={`absolute bottom-0 text-[10.5px] tabular-nums ${x(t) > 94 ? '-translate-x-full' : x(t) < 6 ? '' : '-translate-x-1/2'}`} style={{ left: `${x(t)}%` }}>{num(t * 100, 0)}</span>
            ))}
          </div>
          <span className="text-right whitespace-nowrap">mean ± std</span>
          <span className="text-right">p95 latency</span>
          <span className="text-right">cost / call</span>
          <span className="text-right">errors</span>
        </div>
        {passed.map(row)}
        {failed.length > 0 && (
          <>
            <div className="border-t border-line bg-bg/40 px-4 py-2 text-xs text-bad">Failed a gate, not ranked</div>
            {failed.map(row)}
          </>
        )}
        {unscored.length > 0 && (
          <>
            <div className="border-t border-line bg-bg/40 px-4 py-2 text-xs text-faint">Quality not scored, not ranked</div>
            {unscored.map(row)}
          </>
        )}
        {(base || refs.length > 0) && (
          <>
            <div className="border-t border-line bg-bg/40 px-4 py-2 text-xs text-faint">
              Closed references, not ranked: {[base && "today's model is the line savings are measured from", refs.length > 0 && 'frontier models for comparison']
                .filter(Boolean).join('; ')}
            </div>
            {base && row(base)}
            {refs.map(row)}
          </>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-4 py-2.5 text-xs text-faint">
          <span className="flex items-center gap-2"><span className="h-2.5 w-6 rounded-[2px] bg-muted/35" /> 95% confidence interval</span>
          <span className="flex items-center gap-2"><span className="h-3.5 w-[3px] rounded-[1px] bg-muted" /> mean</span>
          {base && <span className="flex items-center gap-2"><span className="h-3.5 border-l border-dashed border-faint" /> {prettyModel(base.model)} today, {pct(base.quality.mean)}</span>}
          {refs.length > 0 && <span className="flex items-center gap-2"><span className="h-3.5 border-l border-dotted border-line-strong" /> {refs.map((r) => r.reference_label ?? prettyModel(r.model)).join(', ')} (reference)</span>}
          <span>Overlapping bands: the difference is not significant.</span>
        </div>
      </div>
    </div>
  )
}
