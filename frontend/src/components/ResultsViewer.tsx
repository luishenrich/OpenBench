import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { ms, pct, shortModel, usd } from '@/lib/format'
import type { CandidateResult } from '@/types'
import { Loading } from './ui'

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
          {candidates.map((c) => <option key={c.candidate_key} value={c.candidate_key}>{shortModel(c.model)}</option>)}
        </select>
      </label>
      {q.isLoading && <Loading />}
      <ul className="space-y-2">
        {items.map((r) => {
          const scores = Object.entries(r.scores)
          const failed = r.error != null || scores.some(([, v]) => v < 0.5)
          return (
            <li key={r.id} className={`rounded-xl border bg-panel p-4 text-sm ${failed ? 'border-bad/40' : 'border-line'}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-medium">{shortModel(r.candidate_key)}</span>
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
              {r.judge?.reasoning && <p className="mt-2 text-xs text-muted">Judge: {r.judge.reasoning}</p>}
            </li>
          )
        })}
      </ul>
      {q.data?.next_cursor && <p className="mt-3 text-sm text-muted">Showing the first {items.length}.</p>}
    </div>
  )
}
