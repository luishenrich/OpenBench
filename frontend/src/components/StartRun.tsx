import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/api'
import { usd } from '@/lib/format'
import type { CatalogModel, Estimate, ModelRef, RunIn, UseCase } from '@/types'
import { ModelIcon, ProviderIcon } from './ModelIcon'
import { prettyModel } from './run/ModelName'
import { Badge, Button, ErrorNote, Panel } from './ui'

const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const
const DEFAULT_EFFORT = 'medium'

// Closed frontier models: measured next to the candidates for comparison, never ranked or recommended.
const REFERENCES: ModelRef[] = [
  { provider: 'openrouter', model: 'openai/gpt-6-luna' },
  { provider: 'openrouter', model: 'openai/gpt-6.1-sol' },
]
// Candidates are open-weight only. The catalogue may list closed models; they are never offered as candidates.
const CLOSED = /^(openai\/gpt-(?!oss)|openai\/o\d|anthropic\/|google\/gemini|x-ai\/)/i
const isClosed = (m: CatalogModel) => CLOSED.test(m.id) || m.role === 'reference'
const keyOf = (m: { provider: string; model?: string; id?: string }) => `${m.provider}:${m.model ?? m.id}`

function EffortSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <select
      aria-label={`Reasoning effort for ${label}`} value={value} onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 rounded-[5px] border border-line bg-bg px-1 py-0.5 text-[11px] text-muted hover:border-line-strong"
    >
      {EFFORTS.map((e) => <option key={e} value={e}>reasoning {e}</option>)}
    </select>
  )
}

export default function StartRun({ useCase, needsVision, blocked = null }: { useCase: UseCase; needsVision: boolean; blocked?: string | null }) {
  const navigate = useNavigate()
  const models = useQuery({ queryKey: ['models'], queryFn: api.models })
  const eligible = useMemo(
    () => (models.data ?? []).filter((m) => m.type !== 'embedding' && !isClosed(m) && (!needsVision || m.verified.vision)),
    [models.data, needsVision],
  )
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const selected = picked ?? new Set(eligible.filter((m) => m.role !== 'baseline').slice(0, 6).map((m) => keyOf(m)))
  const [efforts, setEfforts] = useState<Record<string, string>>({})
  const [refsOn, setRefsOn] = useState<Set<string>>(() => new Set(REFERENCES.map(keyOf)))
  const [repeats, setRepeats] = useState(3)
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const effort = (key: string) => efforts[key] ?? DEFAULT_EFFORT

  const candidates: ModelRef[] = eligible
    .filter((m) => selected.has(keyOf(m)))
    .map((m) => ({ provider: m.provider, model: m.id, params: m.verified.reasoning ? { reasoning_effort: effort(keyOf(m)) } : {} }))
  const references: ModelRef[] = REFERENCES.filter((r) => refsOn.has(keyOf(r))).map((r) => ({ ...r, params: { reasoning_effort: effort(keyOf(r)) } }))
  const req: RunIn = { use_case_id: useCase.id, candidates, references, include_references: references.length > 0, repeats }
  const todayClosed = !!useCase.current_model && CLOSED.test(useCase.current_model.model)

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
  function toggleRef(key: string) {
    const next = new Set(refsOn)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setRefsOn(next)
    setEstimate(null)
  }
  const setEffort = (key: string, v: string) => { setEfforts((e) => ({ ...e, [key]: v })); setEstimate(null) }

  return (
    <Panel className="p-5">
      <Badge tone="signal">New run</Badge>
      <h2 className="title mt-4 text-lg">Benchmark models</h2>
      {blocked ? (
        <p className="mt-1 flex items-start gap-2 text-sm text-front"><span className="mt-[7px] size-1.5 shrink-0 rounded-[1px] bg-front" />{blocked}</p>
      ) : (
        <p className="mt-1 text-sm text-muted">
          {useCase.case_count} cases × {repeats} repeats per model{needsVision ? '. Image input, so only models that passed our vision check.' : '.'}
        </p>
      )}

      <div className={blocked ? 'pointer-events-none opacity-45 select-none' : ''} aria-disabled={!!blocked} inert={!!blocked || undefined}>
        <p className="mt-4 text-xs text-faint">Open-weight candidates</p>
        <fieldset className="mt-1 max-h-72 space-y-0.5 overflow-y-auto pr-1">
          <legend className="sr-only">Candidate models</legend>
          {models.isLoading && <p className="text-sm text-muted">Loading models…</p>}
          {eligible.map((m) => {
            const key = keyOf(m)
            const on = selected.has(key)
            return (
              <label key={key} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-raised">
                <input type="checkbox" checked={on} onChange={() => toggle(key)} className="mt-[3px] accent-[var(--color-front)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <ModelIcon model={key} size={14} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium" title={m.name}>{m.name}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
                    {m.verified.reasoning && on && <EffortSelect value={effort(key)} onChange={(v) => setEffort(key, v)} label={m.name} />}
                    <span className="inline-flex items-center gap-1.5"><ProviderIcon provider={m.provider} size={11} />{m.provider}</span>
                    <span>${m.pricing_usd_per_1m.input ?? '?'} in, ${m.pricing_usd_per_1m.output ?? '?'} out per 1M</span>
                    {m.aa_index ? <span>AA index {m.aa_index}</span> : null}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>

        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs text-faint">Closed references, for comparison only. Never ranked or recommended.</p>
          <div className="mt-1 space-y-0.5">
            {REFERENCES.map((r) => {
              const key = keyOf(r)
              const on = refsOn.has(key)
              return (
                <label key={key} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-raised">
                  <input type="checkbox" checked={on} onChange={() => toggleRef(key)} className="accent-[var(--color-muted)]" />
                  <ModelIcon model={key} size={14} />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">{prettyModel(r.model)}</span>
                  {on && <EffortSelect value={effort(key)} onChange={(v) => setEffort(key, v)} label={prettyModel(r.model)} />}
                </label>
              )
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-sm">
          <label className="flex items-center gap-2">
            Repeats
            <select value={repeats} onChange={(e) => { setRepeats(Number(e.target.value)); setEstimate(null) }}
              className="rounded-md border border-line bg-bg px-2 py-1">
              {[1, 3, 5].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          {todayClosed && (
            <span className="text-xs text-faint">Today's model ({prettyModel(useCase.current_model!.model)}) runs as a reference too.</span>
          )}
        </div>
      </div>

      {estimate && !blocked && (
        <div className="mt-4 rounded-lg border border-line bg-bg p-3 text-sm">
          <div className="flex justify-between"><span>{estimate.calls.toLocaleString()} calls</span><span>{usd(estimate.est_cost_usd)}</span></div>
          {estimate.judge_cost_usd > 0 && <div className="flex justify-between text-muted"><span>Judges</span><span>{usd(estimate.judge_cost_usd)}</span></div>}
          <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold"><span>Estimated total</span><span>{usd(estimate.total_usd)}</span></div>
        </div>
      )}
      {(estimateM.error || startM.error) && <div className="mt-3"><ErrorNote error={estimateM.error ?? startM.error} /></div>}

      <div className="mt-4">
        {estimate && !blocked ? (
          <Button className="w-full" onClick={() => startM.mutate()} disabled={startM.isPending}>
            {startM.isPending ? 'Starting…' : `Start benchmark for ${usd(estimate.total_usd)}`}
          </Button>
        ) : (
          <Button className="w-full" onClick={() => estimateM.mutate()} disabled={!!blocked || candidates.length === 0 || estimateM.isPending || useCase.case_count === 0}>
            {estimateM.isPending ? 'Estimating…' : blocked ? 'Not ready to benchmark' : `Estimate cost for ${candidates.length} models`}
          </Button>
        )}
      </div>
    </Panel>
  )
}
