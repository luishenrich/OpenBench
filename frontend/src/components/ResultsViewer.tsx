import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { effortOf, ms, pct, usd } from '@/lib/format'
import type { CandidateResult, ResultJudge } from '@/types'
import { Loading, Tag } from './ui'
import { EffortChip, ModelName, prettyModel, rowEffort } from './run/ModelName'

// Both jurors: score and reasoning each, abstentions marked. Falls back to the single reasoning string.
function Jury({ judge }: { judge: ResultJudge }) {
  const jurors = judge.jurors ?? []
  const abstained = judge.abstained ?? []
  if (!jurors.length && !abstained.length) return judge.reasoning ? <p className="mt-2 text-xs text-muted">Judge: {judge.reasoning}</p> : null
  return (
    <div className="mt-3 rounded-lg border border-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-1.5 text-xs text-faint">
        <span>Jury{judge.mode ? `, ${judge.mode.replaceAll('_', ' ')}` : ''}</span>
        {judge.score != null && <span className="text-muted">score {pct(judge.score, 0)}</span>}
        {judge.winner && <span className="text-muted">winner: {judge.winner}</span>}
        {judge.agreement === true && <span className="text-win">jurors agree</span>}
        {judge.agreement === false && <span className="text-bad">jurors disagree</span>}
      </div>
      <ul className="divide-y divide-line">
        {jurors.map((j) => (
          <li key={j.key} className="grid gap-x-4 gap-y-1 px-3 py-2 text-xs sm:grid-cols-[300px_1fr]">
            <span className="flex min-w-0 items-center gap-2">
              <ModelName model={j.key} effort={null} size={13} nameClass="text-fg" />
              <EffortChip effort={j.reasoning_effort ?? effortOf(j.key)} />
              {j.score != null && <span className={`ml-auto shrink-0 font-medium ${j.score >= 0.999 ? 'text-win' : j.score < 0.5 ? 'text-bad' : 'text-muted'}`}>{pct(j.score, 0)}</span>}
            </span>
            <span className="text-muted">{j.reasoning ?? (j.winner ? `winner: ${j.winner}` : '')}</span>
          </li>
        ))}
        {abstained.map((k) => (
          <li key={k} className="grid gap-x-4 gap-y-1 px-3 py-2 text-xs sm:grid-cols-[300px_1fr]">
            <span className="flex items-center gap-2"><ModelName model={k} effort={null} size={13} nameClass="text-faint" /></span>
            <span className="text-faint">Abstained: same model family as the output it would judge.</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ResultsViewer({ runId, candidates }: { runId: string; candidates: CandidateResult[] }) {
  const [candidate, setCandidate] = useState('')
  const q = useQuery({
    queryKey: ['results', runId, candidate],
    queryFn: () => api.results(runId, candidate ? { candidate_key: candidate } : {}),
  })
  const items = (q.data?.items ?? []).filter((r) => !candidate || r.candidate_key === candidate)

  return (
    <div>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-muted">Model</span>
        <select value={candidate} onChange={(e) => setCandidate(e.target.value)} className="rounded-md border border-line bg-bg px-2 py-1">
          <option value="">All models</option>
          {candidates.map((c) => {
            const e = rowEffort(c)
            const label = `${c.reference_label === 'today' ? `${prettyModel(c.model)} (today)` : c.reference_label ?? prettyModel(c.model)}${e && e !== 'default' ? ` · reasoning ${e}` : ''}${c.is_reference ? ' · reference' : ''}`
            return <option key={c.candidate_key} value={c.candidate_key}>{label}</option>
          })}
        </select>
      </label>
      {q.isLoading && <Loading />}
      <ul className="space-y-2">
        {items.map((r) => {
          const scores = Object.entries(r.scores)
          const failed = r.error != null || scores.some(([, v]) => v < 0.5)
          const row = candidates.find((c) => c.candidate_key === r.candidate_key)
          return (
            <li key={r.id} className={`rounded-xl border bg-panel p-4 text-sm ${failed ? 'border-bad/40' : 'border-line'}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <ModelName model={r.candidate_key} effort={row ? rowEffort(row) : effortOf(r.candidate_key)} />
                {row?.is_reference && <Tag>reference</Tag>}
                <span className="text-faint">case {r.case_id.slice(-4)}, repeat {r.repeat_idx + 1}</span>
                <span className="text-muted">{ms(r.timing.e2e_ms)}</span>
                <span className="text-muted">{usd(r.cost_usd)}</span>
                <span className="ml-auto flex flex-wrap gap-3">
                  {scores.map(([k, v]) => (
                    <span key={k} className={v >= 0.999 ? 'text-win' : v < 0.5 ? 'text-bad' : 'text-muted'}>{k.replaceAll('_', ' ')} {pct(v, 0)}</span>
                  ))}
                </span>
              </div>
              {r.error ? (
                <p className="mt-2 text-bad">{r.error}</p>
              ) : (
                <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-bg p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-muted">
                  {r.output.json != null ? JSON.stringify(r.output.json, null, 2) : r.output.text ?? ''}
                </pre>
              )}
              {r.judge && <Jury judge={r.judge} />}
            </li>
          )
        })}
      </ul>
      {q.data?.next_cursor && <p className="mt-3 text-sm text-muted">Showing the first {items.length}.</p>}
    </div>
  )
}
