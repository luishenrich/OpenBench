import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/api'
import { effortOf, usd } from '@/lib/format'
import type { CatalogModel, Estimate, ModelRef, RunIn, UseCase } from '@/types'
import { ModelIcon, ProviderIcon } from './ModelIcon'
import { EffortChip, prettyModel } from './run/ModelName'
import { LiveDot } from '@/components/usecases/live'
import { Badge, Button, ErrorNote, Panel } from './ui'
import { LoadingRegion, Skeleton } from '@/components/Skeleton'

const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const
const DEFAULT_EFFORT = 'medium'

// Closed frontier models a run can compare against: never ranked or recommended.
const REFERENCE_CHOICES: ModelRef[] = [
  { provider: 'openrouter', model: 'openai/gpt-6.1-sol', params: { reasoning_effort: 'medium' } },
  { provider: 'openrouter', model: 'openai/gpt-6-luna', params: { reasoning_effort: 'medium' } },
]
// Candidates are open-weight only. The catalogue may list closed models; they are never offered as candidates.
const CLOSED = /^(openai\/gpt-(?!oss)|openai\/o\d|anthropic\/|google\/gemini|x-ai\/)/i
const isClosed = (m: CatalogModel) => CLOSED.test(m.id) || m.role === 'reference'
// Nebius serves reasoning models at the provider's default effort (contract); only OpenRouter pins it.
const pinsEffort = (m: CatalogModel) => m.verified.reasoning && m.provider !== 'nebius'
const keyOf = (m: { provider: string; model?: string; id?: string }) => `${m.provider}:${m.model ?? m.id}`
const refNames = (refs: ModelRef[]) => refs.map((r) => prettyModel(r.model).replace(/^GPT-[\d.]+ /, '')).join(' + ') || 'none'

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

function ModelLine({ m }: { m: ModelRef }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <ModelIcon model={`${m.provider}:${m.model}`} size={12} />
      <span className="truncate">{prettyModel(m.model)}</span>
      <EffortChip effort={effortOf(m.model, m.params) ?? (m.provider === 'nebius' ? 'default' : null)} />
    </span>
  )
}

/**
 * Candidates, repeats and references inherit the workspace unless changed here: candidates [] auto-picks
 * from the workspace pool, repeats / references null use the workspace defaults.
 */
const AGENT_WORKING = /agent is still setting this up/i

export default function StartRun({ useCase, needsVision, blocked = null }: { useCase: UseCase; needsVision: boolean; blocked?: string | null }) {
  const navigate = useNavigate()
  const models = useQuery({ queryKey: ['models'], queryFn: api.models })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const ws = me.data?.workspace
  const wsRepeats = ws?.default_repeats ?? 3
  const wsRefs = ws?.default_references ?? REFERENCE_CHOICES
  const eligible = useMemo(
    () => (models.data ?? []).filter((m) => m.type !== 'embedding' && !isClosed(m) && (!needsVision || m.verified.vision)),
    [models.data, needsVision],
  )

  // null = inherit from the workspace
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [repeats, setRepeats] = useState<number | null>(null)
  const [refsOverride, setRefsOverride] = useState<ModelRef[] | null>(null)
  const [efforts, setEfforts] = useState<Record<string, string>>({})
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const effort = (key: string) => efforts[key] ?? DEFAULT_EFFORT
  const reset = () => setEstimate(null)

  const candidates: ModelRef[] = picked
    ? eligible.filter((m) => picked.has(keyOf(m))).map((m) => ({ provider: m.provider, model: m.id, params: pinsEffort(m) ? { reasoning_effort: effort(keyOf(m)) } : {} }))
    : []
  const req: RunIn = {
    use_case_id: useCase.id,
    candidates,
    repeats,
    references: refsOverride,
    include_references: refsOverride ? refsOverride.length > 0 : true,
  }

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
    const next = new Set(picked ?? [])
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setPicked(next)
    reset()
  }
  function toggleRef(r: ModelRef) {
    const cur = refsOverride ?? wsRefs
    const has = cur.some((x) => keyOf(x) === keyOf(r))
    setRefsOverride(has ? cur.filter((x) => keyOf(x) !== keyOf(r)) : [...cur, { ...r, params: { reasoning_effort: effort(keyOf(r)) } }])
    reset()
  }
  function setRefEffort(r: ModelRef, v: string) {
    setEfforts((e) => ({ ...e, [keyOf(r)]: v }))
    const cur = refsOverride ?? wsRefs
    setRefsOverride(cur.map((x) => (keyOf(x) === keyOf(r) ? { ...x, params: { ...x.params, reasoning_effort: v } } : x)))
    reset()
  }
  const setEffort = (key: string, v: string) => { setEfforts((e) => ({ ...e, [key]: v })); reset() }
  const overCap = !!estimate?.over_cap
  const refsShown = refsOverride ?? wsRefs
  const link = 'text-muted underline decoration-line-strong underline-offset-2 hover:text-fg'

  return (
    <Panel className="flex flex-1 flex-col p-5">
      <div><Badge tone="signal">New run</Badge></div>
      <h2 className="title mt-4 text-lg">Benchmark models</h2>
      {blocked ? (
        // the agent still filling the use case in is a wait, not a problem: neutral with a live dot
        AGENT_WORKING.test(blocked)
          ? <p className="mt-1 flex items-center gap-2 text-sm text-muted"><LiveDot small />{blocked}</p>
          : <p className="mt-1 flex items-start gap-2 text-sm text-front"><span className="mt-[7px] size-1.5 shrink-0 rounded-[1px] bg-front" />{blocked}</p>
      ) : (
        <p className="mt-1 text-sm text-muted">
          {useCase.case_count} {useCase.case_count === 1 ? 'case' : 'cases'} × {repeats ?? wsRepeats} repeats per model{needsVision ? '. Image input, so only models that passed our vision check.' : '.'}
        </p>
      )}

      <div className={blocked ? 'pointer-events-none opacity-45 select-none' : ''} aria-disabled={!!blocked} inert={!!blocked || undefined}>
        <p className="mt-4 rounded-md border border-line bg-bg/50 px-3 py-2 text-xs text-faint">
          Workspace default: <span className="text-muted">{wsRepeats} repeats · {refNames(wsRefs)}</span> · candidates auto-picked from the pool. <Link to="/settings" className={link}>Settings</Link>
        </p>

        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-faint">Open-weight candidates</span>
          <span className="flex gap-1" role="radiogroup" aria-label="How candidates are chosen">
            {([['auto', 'Auto-pick'], ['pick', 'Choose']] as const).map(([k, label]) => {
              const on = (k === 'auto') === (picked === null)
              return (
                <button key={k} type="button" role="radio" aria-checked={on}
                  onClick={() => { setPicked(k === 'auto' ? null : new Set(eligible.filter((m) => m.role !== 'baseline').slice(0, 4).map(keyOf))); reset() }}
                  className={`rounded-md px-2 py-0.5 ${on ? 'bg-raised text-fg' : 'text-muted hover:text-fg'}`}>{label}</button>
              )
            })}
          </span>
        </div>
        {picked === null ? (
          <p className="mt-1.5 text-sm text-muted">The run picks open-weight models from the workspace pool{needsVision ? ' that read images' : ''}. The estimate shows which.</p>
        ) : (
          <fieldset className="mt-1 max-h-72 space-y-0.5 overflow-y-auto pr-1">
            <legend className="sr-only">Candidate models</legend>
            {models.isLoading && (
              <LoadingRegion label="Loading models">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 px-2 py-1.5" aria-hidden>
                    <Skeleton className="mt-[3px] size-3.5 rounded-[3px]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><Skeleton className="size-3.5 rounded-full" /><Skeleton className="h-2.5" style={{ width: `${55 - i * 7}%` }} /></div>
                      <Skeleton className="mt-2 h-2 w-[70%]" />
                    </div>
                  </div>
                ))}
              </LoadingRegion>
            )}
            {eligible.map((m) => {
              const key = keyOf(m)
              const on = picked.has(key)
              return (
                <label key={key} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-raised">
                  <input type="checkbox" checked={on} onChange={() => toggle(key)} className="mt-[3px] accent-[var(--color-front)]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <ModelIcon model={key} size={14} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={m.name}>{m.name}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
                      {pinsEffort(m) && on && <EffortSelect value={effort(key)} onChange={(v) => setEffort(key, v)} label={m.name} />}
                      {m.verified.reasoning && m.provider === 'nebius' && <EffortChip effort="default" />}
                      <span className="inline-flex items-center gap-1.5"><ProviderIcon provider={m.provider} size={11} />{m.provider}</span>
                      <span>${m.pricing_usd_per_1m.input ?? '?'} in, ${m.pricing_usd_per_1m.output ?? '?'} out per 1M</span>
                    </span>
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}

        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-faint">Closed references, for comparison only</span>
            {refsOverride
              ? <button type="button" className={link} onClick={() => { setRefsOverride(null); reset() }}>Use workspace default</button>
              : <button type="button" className={link} onClick={() => setRefsOverride(wsRefs)}>Override</button>}
          </div>
          {refsOverride === null ? (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">{wsRefs.map((r) => <ModelLine key={keyOf(r)} m={r} />)}</div>
          ) : (
            <div className="mt-1 space-y-0.5">
              {REFERENCE_CHOICES.map((r) => {
                const key = keyOf(r)
                const cur = refsShown.find((x) => keyOf(x) === key)
                return (
                  <label key={key} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-raised">
                    <input type="checkbox" checked={!!cur} onChange={() => toggleRef(r)} className="accent-[var(--color-muted)]" />
                    <ModelIcon model={key} size={14} />
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">{prettyModel(r.model)}</span>
                    {cur && <EffortSelect value={effortOf(cur.model, cur.params) ?? DEFAULT_EFFORT} onChange={(v) => setRefEffort(r, v)} label={prettyModel(r.model)} />}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-sm">
          <label className="flex items-center gap-2">
            Repeats
            <select value={repeats ?? ''} onChange={(e) => { setRepeats(e.target.value === '' ? null : Number(e.target.value)); reset() }}
              className="rounded-md border border-line bg-bg px-2 py-1">
              <option value="">{wsRepeats} (workspace)</option>
              {[1, 3, 5, 10].filter((n) => n !== wsRepeats).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {!!useCase.current_model && CLOSED.test(useCase.current_model.model) && (
            <span className="text-xs text-faint">Today's model ({prettyModel(useCase.current_model.model)}) runs as a reference too.</span>
          )}
        </div>
      </div>

      {estimate && !blocked && (
        <div className="mt-4 rounded-lg border border-line bg-bg p-3 text-sm">
          <div className="space-y-1.5 border-b border-line pb-2.5 text-xs text-muted">
            <div><span className="text-faint">Candidates </span><span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">{estimate.candidates.map((m) => <ModelLine key={keyOf(m)} m={m} />)}</span></div>
            <div><span className="text-faint">References </span><span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">{estimate.references.length ? estimate.references.map((m) => <ModelLine key={keyOf(m)} m={m} />) : 'none'}</span></div>
            <div className="text-faint">{estimate.repeats} repeats</div>
          </div>
          <div className="mt-2 flex justify-between"><span>{estimate.calls.toLocaleString()} calls</span><span>{usd(estimate.est_cost_usd)}</span></div>
          {estimate.judge_cost_usd > 0 && <div className="flex justify-between text-muted"><span>Judges</span><span>{usd(estimate.judge_cost_usd)}</span></div>}
          <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold"><span>Estimated total</span><span>{usd(estimate.total_usd)}</span></div>
          {overCap && (
            <p className="mt-2 text-xs text-bad">
              Estimate {usd(estimate.total_usd)} is over the workspace cap {usd(estimate.max_run_cost_usd)} (<Link to="/settings" className="underline underline-offset-2">Settings</Link>).
            </p>
          )}
        </div>
      )}
      {(estimateM.error || startM.error) && <div className="mt-3"><ErrorNote error={estimateM.error ?? startM.error} /></div>}

      {/* pinned to the bottom when the panel is stretched to the row; the estimate fills the slack above it */}
      <div className="mt-auto pt-4">
        {estimate && !blocked ? (
          <Button className="w-full" onClick={() => startM.mutate()} disabled={startM.isPending || overCap}>
            {startM.isPending ? 'Starting…' : overCap ? 'Over the workspace cap' : `Start benchmark for ${usd(estimate.total_usd)}`}
          </Button>
        ) : (
          <Button className="w-full" onClick={() => estimateM.mutate()} disabled={!!blocked || (picked !== null && candidates.length === 0) || estimateM.isPending || useCase.case_count === 0}>
            {estimateM.isPending ? 'Estimating…' : blocked ? 'Not ready to benchmark' : picked === null ? 'Estimate cost' : `Estimate cost for ${candidates.length} models`}
          </Button>
        )}
      </div>
    </Panel>
  )
}
