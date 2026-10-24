import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { effortOf, ms, pct, usd } from '@/lib/format'
import type { Case, CandidateResult, MetricSpec, ResultJudge, ResultOut } from '@/types'
import { Tag } from './ui'
import { LoadingRegion, Skeleton } from './Skeleton'
import { EffortChip, ModelName, prettyModel, rowEffort } from './run/ModelName'

// ---- helpers -------------------------------------------------------------------------------------

const metricLabel = (k: string) => k.replaceAll('_', ' ')
const scoreTone = (v: number) => (v >= 0.999 ? 'text-win' : v < 0.5 ? 'text-bad' : 'text-muted')

/** One-line preview of a case input: the first var, else the last message. */
function inputPreview(c: Case): string {
  const vars = Object.values(c.input.vars ?? {})
  const first = vars.find((v) => v != null && v !== '')
  if (first != null) return typeof first === 'string' ? first : JSON.stringify(first)
  const msgs = c.input.messages ?? []
  const last = msgs[msgs.length - 1] as { content?: unknown } | undefined
  if (last?.content != null) return typeof last.content === 'string' ? last.content : JSON.stringify(last.content)
  if (c.input.images?.length) return `${c.input.images.length} image${c.input.images.length === 1 ? '' : 's'}`
  return '(empty input)'
}

const answerText = (r: ResultOut) => (r.output.json != null ? JSON.stringify(r.output.json, null, 2) : r.output.text ?? (r.output.tool_calls ? JSON.stringify(r.output.tool_calls, null, 2) : ''))
const answerLine = (r: ResultOut) => (r.output.json != null ? JSON.stringify(r.output.json) : r.output.text ?? '').replace(/\s+/g, ' ')
const pretty = (x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x, null, 2))

/** The score shown on a tile: the heaviest-weighted metric of the use case that this result has, else the first. */
function mainMetric(r: ResultOut, specs: MetricSpec[]): [string, number] | null {
  const ordered = [...specs].sort((a, b) => b.weight - a.weight).map((m) => m.metric_id)
  const k = ordered.find((id) => id in r.scores) ?? Object.keys(r.scores)[0]
  return k != null ? [k, r.scores[k]] : null
}

const failedOf = (r: ResultOut) => r.error != null || Object.values(r.scores).some((v) => v < 0.5)

// ---- jury ----------------------------------------------------------------------------------------

// Every juror: score, reasoning collapsed; abstentions marked. Falls back to the single reasoning string.
function Jury({ judge }: { judge: ResultJudge }) {
  const jurors = judge.jurors ?? []
  const abstained = judge.abstained ?? []
  if (!jurors.length && !abstained.length) return judge.reasoning ? <p className="text-xs text-muted">Judge: {judge.reasoning}</p> : null
  return (
    <div className="rounded-lg border border-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-1.5 text-xs text-faint">
        <span>Jury{judge.mode ? `, ${judge.mode.replaceAll('_', ' ')}` : ''}</span>
        {judge.score != null && <span className="text-muted">score {pct(judge.score, 0)}</span>}
        {judge.winner && <span className="text-muted">winner: {judge.winner}</span>}
        {judge.agreement === true && <span className="text-win">jurors agree</span>}
        {judge.agreement === false && <span className="text-bad">jurors disagree</span>}
      </div>
      <ul className="divide-y divide-line">
        {jurors.map((j) => (
          <li key={j.key} className="text-xs">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 hover:bg-raised/50">
                <span className="text-faint transition-transform group-open:rotate-90" aria-hidden>›</span>
                <ModelName model={j.key} effort={null} size={13} nameClass="text-fg" />
                <EffortChip effort={j.reasoning_effort ?? effortOf(j.key)} />
                {j.score != null && <span className={`ml-auto shrink-0 font-medium ${scoreTone(j.score)}`}>{pct(j.score, 0)}</span>}
              </summary>
              <p className="px-3 pb-2.5 pl-8 text-muted">{j.reasoning ?? (j.winner ? `winner: ${j.winner}` : 'No reasoning returned.')}</p>
            </details>
          </li>
        ))}
        {abstained.map((k) => (
          <li key={k} className="flex flex-wrap items-center gap-2 px-3 py-2 pl-8 text-xs">
            <ModelName model={k} effort={null} size={13} nameClass="text-faint" />
            <span className="text-faint">abstained: same model family as the output</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---- modal ---------------------------------------------------------------------------------------

type Row = { key: string; name: string; effort: string | null; ref: boolean; pick: boolean }

function Block({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs text-faint"><h3>{title}</h3>{aside}</div>
      {children}
    </section>
  )
}

function Pre({ children, max = 'max-h-72' }: { children: string; max?: string }) {
  return <pre className={`${max} overflow-auto rounded-lg border border-line bg-bg p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-words text-muted`}>{children}</pre>
}

function ResultModal({ result, row, kase, caseLabel, onClose, onMove, pos }: {
  result: ResultOut | null; row: Row | undefined; kase: Case | undefined; caseLabel: string
  onClose: () => void; onMove: (dRow: number, dRep: number) => void; pos: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const open = result != null
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) { d.showModal(); closeRef.current?.focus() }
    if (!open && d.open) d.close()
  }, [open])
  const r = result
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={(e) => {
        const t = e.target as HTMLElement
        if (t.closest('summary, pre')) return
        const m: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
        if (m[e.key]) { e.preventDefault(); onMove(...m[e.key]) }
      }}
      aria-label={row ? `${row.name}, ${caseLabel}` : 'Output'}
      className="m-auto max-h-[calc(100vh-48px)] w-[min(920px,calc(100vw-32px))] overflow-hidden rounded-xl border border-line bg-panel p-0 text-fg backdrop:bg-black/65"
    >
      {r && row && (
        <div className="flex max-h-[calc(100vh-48px)] flex-col">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3">
            <ModelName model={row.key} effort={row.effort} />
            {row.ref && <Tag>reference</Tag>}
            {row.pick && <Tag tone="win">pick</Tag>}
            <span className="text-sm text-faint">{caseLabel}, repeat {r.repeat_idx + 1}</span>
            <span className="ml-auto flex items-center gap-1">
              <span className="mr-2 hidden text-xs text-faint sm:inline">{pos}</span>
              <button type="button" onClick={() => onMove(0, -1)} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-raised hover:text-fg" aria-label="Previous repeat">←</button>
              <button type="button" onClick={() => onMove(0, 1)} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-raised hover:text-fg" aria-label="Next repeat">→</button>
              <button type="button" onClick={() => onMove(-1, 0)} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-raised hover:text-fg" aria-label="Previous model">↑</button>
              <button type="button" onClick={() => onMove(1, 0)} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-raised hover:text-fg" aria-label="Next model">↓</button>
              <button ref={closeRef} type="button" onClick={onClose} className="ml-1 rounded-md px-2 py-1 text-sm text-muted hover:bg-raised hover:text-fg" aria-label="Close">✕</button>
            </span>
          </header>
          <div className="space-y-5 overflow-y-auto px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="text-muted">{ms(r.timing.e2e_ms)} <span className="text-faint">end to end</span></span>
              {r.timing.ttft_ms != null && <span className="text-muted">{ms(r.timing.ttft_ms)} <span className="text-faint">TTFT</span></span>}
              <span className="text-muted">{usd(r.cost_usd)} <span className="text-faint">this call</span></span>
              <span className="flex flex-wrap gap-1.5">
                {Object.entries(r.scores).map(([k, v]) => (
                  <span key={k} className={`rounded-md border border-line px-1.5 py-0.5 text-xs ${scoreTone(v)}`}>{metricLabel(k)} {pct(v, 0)}</span>
                ))}
              </span>
            </div>

            {kase && (
              <details className="group rounded-lg border border-line" open={inputPreview(kase).length < 220}>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-faint hover:text-muted">
                  <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>Case input
                  <span className="truncate text-muted group-open:hidden">{inputPreview(kase)}</span>
                </summary>
                <div className="px-3 pb-3"><Pre max="max-h-48">{pretty(kase.input.vars && Object.keys(kase.input.vars).length ? kase.input.vars : kase.input)}</Pre></div>
              </details>
            )}

            <div className={`grid gap-4 ${kase?.reference != null ? 'md:grid-cols-2' : ''}`}>
              <Block title="Answer">
                {r.error ? <p className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{r.error}</p> : <Pre max="max-h-[45vh]">{answerText(r) || '(empty)'}</Pre>}
              </Block>
              {kase?.reference != null && <Block title="Expected output"><Pre max="max-h-[45vh]">{pretty(kase.reference)}</Pre></Block>}
            </div>

            {r.judge && <Jury judge={r.judge} />}
          </div>
        </div>
      )}
    </dialog>
  )
}

// ---- the section ---------------------------------------------------------------------------------

export default function ResultsViewer({ runId, useCaseId, candidates, pickKey, repeats, metricSpecs = [] }: {
  runId: string
  useCaseId: string
  candidates: CandidateResult[]
  pickKey: string | null
  repeats: number
  metricSpecs?: MetricSpec[]
}) {
  const cases = useQuery({ queryKey: ['cases', useCaseId], queryFn: () => api.cases(useCaseId) })
  const list = cases.data ?? []
  const [idx, setIdx] = useState(0)
  const kase = list[Math.min(idx, Math.max(0, list.length - 1))]
  const q = useQuery({
    queryKey: ['results', runId, 'case', kase?.id],
    queryFn: () => api.results(runId, { case_id: kase!.id }),
    enabled: !!kase,
  })
  const items = useMemo(() => (q.data?.items ?? []).filter((r) => r.case_id === kase?.id), [q.data, kase?.id])

  // rows: the pick, then candidates by rank, then references (grey)
  const rows: Row[] = useMemo(() => {
    const name = (c: CandidateResult) => (c.reference_label === 'today' ? `${prettyModel(c.model)} (today)` : c.reference_label ?? prettyModel(c.model))
    const order = (c: CandidateResult) => (c.candidate_key === pickKey ? -1 : c.is_reference ? 1000 : c.rank ?? 500)
    return [...candidates].sort((a, b) => order(a) - order(b))
      .map((c) => ({ key: c.candidate_key, name: name(c), effort: rowEffort(c), ref: c.is_reference, pick: c.candidate_key === pickKey }))
  }, [candidates, pickKey])
  const nRep = Math.max(repeats, ...items.map((r) => r.repeat_idx + 1), 1)
  const cell = (key: string, rep: number) => items.find((r) => r.candidate_key === key && r.repeat_idx === rep)

  const [sel, setSel] = useState<{ row: number; rep: number } | null>(null)
  const selResult = sel ? cell(rows[sel.row]?.key, sel.rep) ?? null : null
  // move within the matrix, skipping empty cells
  const move = (dRow: number, dRep: number) => setSel((s) => {
    if (!s) return s
    let { row, rep } = s
    for (let i = 0; i < rows.length * nRep; i++) {
      row = (row + dRow + rows.length) % rows.length
      rep = (rep + dRep + nRep) % nRep
      if (cell(rows[row].key, rep)) return { row, rep }
    }
    return s
  })

  const go = (d: number) => { setIdx((i) => Math.min(list.length - 1, Math.max(0, i + d))); setSel(null) }
  const caseLabel = `Case ${idx + 1} of ${list.length}`
  const failures = items.filter(failedOf).length

  if (cases.isLoading) return <LoadingRegion label="Loading cases"><Skeleton className="h-[360px] rounded-xl" /></LoadingRegion>
  if (!list.length) return <p className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-sm text-muted">This use case has no cases.</p>

  return (
    <div className="rounded-xl border border-line bg-panel">
      {/* case selector */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} disabled={idx === 0} className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:border-line-strong hover:text-fg disabled:opacity-40" aria-label="Previous case">←</button>
          <button type="button" onClick={() => go(1)} disabled={idx >= list.length - 1} className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:border-line-strong hover:text-fg disabled:opacity-40" aria-label="Next case">→</button>
        </div>
        <label className="flex min-w-0 flex-1 items-center gap-3">
          <span className="shrink-0 text-sm font-medium">{caseLabel}</span>
          <select
            value={idx} onChange={(e) => { setIdx(Number(e.target.value)); setSel(null) }}
            className="min-w-0 flex-1 truncate rounded-md border border-line bg-bg px-2 py-1 text-sm text-muted"
            aria-label="Choose a case"
          >
            {list.map((c, i) => <option key={c.id} value={i}>{i + 1}. {inputPreview(c).slice(0, 110)}</option>)}
          </select>
        </label>
        {kase?.tags.length ? <span className="flex gap-1">{kase.tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}</span> : null}
      </div>

      {/* input and expected output, once, compact */}
      {kase && (
        <div className={`grid gap-x-6 gap-y-2 border-b border-line px-4 py-3 text-xs ${kase.reference != null ? 'md:grid-cols-2' : ''}`}>
          <div className="min-w-0">
            <div className="text-faint">Input</div>
            <p className="mt-1 line-clamp-2 font-mono text-[11.5px] text-muted" title={inputPreview(kase)}>{inputPreview(kase)}</p>
          </div>
          {kase.reference != null && (
            <div className="min-w-0">
              <div className="text-faint">Expected</div>
              <p className="mt-1 line-clamp-2 font-mono text-[11.5px] text-muted">{typeof kase.reference === 'string' ? kase.reference : JSON.stringify(kase.reference)}</p>
            </div>
          )}
        </div>
      )}

      {/* the matrix: models × repeats */}
      <div className="overflow-x-auto px-4 py-3">
        <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-x-1.5 border-spacing-y-1 text-xs">
          <thead>
            <tr className="text-left text-faint">
              <th className="w-[290px] px-1 pb-1 font-normal">Model</th>
              {Array.from({ length: nRep }, (_, i) => <th key={i} className="px-1 pb-1 font-normal">Repeat {i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.key} className={row.ref ? 'opacity-70' : ''}>
                <th scope="row" className={`rounded-md px-2 py-1.5 text-left font-normal ${row.pick ? 'bg-win/[0.07] shadow-[inset_2px_0_0_var(--color-win)]' : ''}`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <ModelName model={row.key} effort={null} size={14} nameClass={row.ref ? 'text-muted' : 'font-medium text-fg'} />
                    <EffortChip effort={row.effort} />
                    {row.pick && <span className="text-[10.5px] text-win">pick</span>}
                    {row.ref && <span className="text-[10.5px] text-faint">ref</span>}
                  </span>
                </th>
                {Array.from({ length: nRep }, (_, rep) => {
                  const r = cell(row.key, rep)
                  if (q.isLoading) return <td key={rep}><Skeleton className="h-[46px] rounded-md" /></td>
                  if (!r) return <td key={rep} className="rounded-md border border-dashed border-line px-2.5 text-faint">no output</td>
                  const main = mainMetric(r, metricSpecs)
                  const bad = failedOf(r)
                  return (
                    <td key={rep} className="p-0">
                      <button
                        type="button" onClick={() => setSel({ row: ri, rep })}
                        className={`block w-full min-w-0 rounded-md border px-2.5 py-1.5 text-left transition-colors hover:border-line-strong hover:bg-raised ${bad ? 'border-bad/40' : row.pick ? 'border-win/30' : 'border-line'} bg-bg/50`}
                        aria-label={`${row.name}, repeat ${rep + 1}${r.error ? ', error' : main ? `, ${metricLabel(main[0])} ${pct(main[1], 0)}` : ''}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`size-1.5 shrink-0 rounded-full ${r.error ? 'bg-bad' : bad ? 'bg-bad/70' : 'bg-win'}`} aria-hidden />
                          {r.error ? <span className="font-medium text-bad">error</span>
                            : main && <span className={`font-medium ${scoreTone(main[1])}`} title={metricLabel(main[0])}>{pct(main[1], 0)}</span>}
                          <span className="ml-auto text-faint">{ms(r.timing.e2e_ms)} · {usd(r.cost_usd)}</span>
                        </span>
                        <span className="mt-1 block truncate font-mono text-[11px] text-muted">{r.error ?? (answerLine(r) || '(empty)')}</span>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 px-1 text-xs text-faint">
          {items.length > 0 && <>Score on each tile: {metricLabel(mainMetric(items.find((r) => !r.error) ?? items[0], metricSpecs)?.[0] ?? 'quality')}. </>}
          {failures > 0 && <span className="text-bad/90">{failures} failed or below 50% on this case. </span>}
          Click a tile for the full answer, metrics and jury; arrow keys move between tiles.
        </p>
      </div>

      <ResultModal
        result={selResult} row={sel ? rows[sel.row] : undefined} kase={kase} caseLabel={caseLabel}
        onClose={() => setSel(null)} onMove={move}
        pos={sel ? `model ${sel.row + 1}/${rows.length} · repeat ${sel.rep + 1}/${nRep}` : ''}
      />
    </div>
  )
}
