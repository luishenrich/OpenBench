import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/api'
import { usd } from '@/lib/format'
import type { Estimate, ModelRef, UseCase } from '@/types'
import { Badge, Button, ErrorNote, Panel } from './ui'

export default function StartRun({ useCase, needsVision }: { useCase: UseCase; needsVision: boolean }) {
  const navigate = useNavigate()
  const models = useQuery({ queryKey: ['models'], queryFn: api.models })
  const eligible = useMemo(
    () => (models.data ?? []).filter((m) => m.type !== 'embedding' && (!needsVision || m.verified.vision)),
    [models.data, needsVision],
  )
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const selected = picked ?? new Set(eligible.filter((m) => m.role !== 'baseline').slice(0, 6).map((m) => `${m.provider}:${m.id}`))
  const [repeats, setRepeats] = useState(3)
  const [baseline, setBaseline] = useState(true)
  const [estimate, setEstimate] = useState<Estimate | null>(null)

  const candidates: ModelRef[] = eligible
    .filter((m) => selected.has(`${m.provider}:${m.id}`))
    .map((m) => ({ provider: m.provider, model: m.id, params: {} }))
  const req = { use_case_id: useCase.id, candidates, repeats, include_baseline: baseline && !!useCase.current_model }

  const estimateM = useMutation({ mutationFn: () => api.estimate(req), onSuccess: setEstimate })
  const startM = useMutation({
    mutationFn: () => api.startRun({ ...req, confirm_cost_usd: estimate!.total_usd }),
    onSuccess: (run) => navigate(`/runs/${run.id}`),
    onError: (err) => {
      // 409: the price moved; show the new estimate and ask again
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { estimate?: Estimate } | null
        if (body?.estimate) setEstimate(body.estimate)
      }
    },
  })

  function toggle(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setPicked(next)
    setEstimate(null)
  }

  return (
    <Panel className="p-5">
      <Badge tone="signal">New run</Badge>
      <h2 className="title mt-4 text-lg">Benchmark models</h2>
      <p className="mt-1 text-sm text-muted">
        {useCase.case_count} cases × {repeats} repeats per model{needsVision ? '. Image input, so only models that passed our vision check.' : '.'}
      </p>

      <fieldset className="mt-4 max-h-72 space-y-1 overflow-y-auto pr-1">
        <legend className="sr-only">Candidate models</legend>
        {models.isLoading && <p className="text-sm text-muted">Loading models…</p>}
        {eligible.map((m) => {
          const key = `${m.provider}:${m.id}`
          return (
            <label key={key} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-raised">
              <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} className="accent-[var(--color-front)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{m.name}</span>
                <span className="block text-xs text-faint">
                  {m.provider}, ${m.pricing_usd_per_1m.input ?? '?'} in / ${m.pricing_usd_per_1m.output ?? '?'} out per 1M tokens{m.aa_index ? `, AA index ${m.aa_index}` : ''}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-sm">
        <label className="flex items-center gap-2">
          Repeats
          <select value={repeats} onChange={(e) => { setRepeats(Number(e.target.value)); setEstimate(null) }}
            className="rounded-md border border-line bg-bg px-2 py-1">
            {[1, 3, 5].map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        {useCase.current_model && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={baseline} onChange={(e) => { setBaseline(e.target.checked); setEstimate(null) }} className="accent-[var(--color-front)]" />
            Include today's model
          </label>
        )}
      </div>

      {estimate && (
        <div className="mt-4 rounded-lg border border-line bg-bg p-3 text-sm">
          <div className="flex justify-between"><span>{estimate.calls.toLocaleString()} calls</span><span>{usd(estimate.est_cost_usd)}</span></div>
          {estimate.judge_cost_usd > 0 && <div className="flex justify-between text-muted"><span>Judge</span><span>{usd(estimate.judge_cost_usd)}</span></div>}
          <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold"><span>Estimated total</span><span>{usd(estimate.total_usd)}</span></div>
        </div>
      )}
      {(estimateM.error || startM.error) && <div className="mt-3"><ErrorNote error={estimateM.error ?? startM.error} /></div>}

      <div className="mt-4">
        {estimate ? (
          <Button className="w-full" onClick={() => startM.mutate()} disabled={startM.isPending}>
            {startM.isPending ? 'Starting…' : `Start benchmark for ${usd(estimate.total_usd)}`}
          </Button>
        ) : (
          <Button className="w-full" onClick={() => estimateM.mutate()} disabled={candidates.length === 0 || estimateM.isPending || useCase.case_count === 0}>
            {estimateM.isPending ? 'Estimating…' : useCase.case_count === 0 ? 'Add cases first' : `Estimate cost for ${candidates.length} models`}
          </Button>
        )}
      </div>
    </Panel>
  )
}
