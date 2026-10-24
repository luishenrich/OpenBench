import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StartRun from '@/components/StartRun'
import { Button, ErrorNote, Loading, Panel, Section, StatusPill } from '@/components/ui'
import Weights from '@/components/Weights'
import { api } from '@/lib/api'
import { ago, effortOf, usd } from '@/lib/format'
import { briefVerdict } from '@/lib/verdict'
import type { Gate, MetricInfo, Profile, UseCasePatch } from '@/types'
import UseCaseHeader from '@/components/usecase/Header'
import CasesTable, { editedAfterRun } from '@/components/usecase/CasesTable'
import { InheritBadge, useEffective } from '@/components/settings/inherit'
import { Toaster } from '@/components/usecases/kit'
import { ProviderIcon } from '@/components/ModelIcon'
import { ModelName, juryNames } from '@/components/run/ModelName'
import SetupPanel from '@/components/usecase/SetupPanel'
import { hasJudgeMetric, readiness } from '@/components/usecase/readiness'

// Clamped to three lines; "Show more" only when it actually overflows
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 260
  return (
    <div className="mt-3 max-w-[70ch]">
      <p className={`text-[15px] leading-relaxed text-pretty text-muted ${open || !long ? '' : 'line-clamp-3'}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-sm text-fg/80 underline-offset-4 hover:underline">
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

const OP: Record<string, string> = { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '==': '=' }
const pctLabel = (v: number) => `${+(v * 100).toFixed(1)}%`

// A gate as a ruler. Thresholds near 0 or 1 (≥ 0.99, ≤ 0.02) would leave a 1–2 % sliver on a 0–100 % scale,
// so the ruler zooms to the last 10 % next to that end and labels both ends: zoomed, never stretched.
function GateRow({ gate, name }: { gate: Gate; name: string }) {
  const ratio = gate.value >= 0 && gate.value <= 1
  const passUp = gate.op === '>=' || gate.op === '>'
  const op = OP[gate.op] ?? gate.op
  const value = ratio ? pctLabel(gate.value) : String(gate.value)
  let lo = 0
  let hi = 1
  if (ratio && gate.value >= 0.9) lo = 0.9
  else if (ratio && gate.value <= 0.1) hi = 0.1
  const at = ((gate.value - lo) / (hi - lo)) * 100
  const zoomed = hi - lo < 1
  const passWidth = passUp ? 100 - at : at

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm">{name}</div>
          <div className="mt-0.5 text-xs text-faint">
            {ratio ? `passes at ${value} ${passUp ? 'or more' : 'or less'}` : `${gate.metric_id} ${op} ${gate.value}`}
          </div>
        </div>
        <div className="title shrink-0 text-2xl">
          <span className="mr-1 text-muted">{op}</span>{value}
        </div>
      </div>
      {ratio && (
        <div className="mt-3" aria-hidden>
          <div className="relative h-5 overflow-hidden rounded-[4px] bg-bad/[0.12] text-[10px] leading-5 font-medium">
            <div className="absolute inset-y-0 bg-win/30" style={passUp ? { left: `${at}%`, right: 0 } : { left: 0, width: `${at}%` }} />
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="absolute bottom-0 h-1.5 w-px bg-fg/15" style={{ left: `${(i + 1) * 10}%` }} />
            ))}
            <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-fg" style={{ left: `${at}%` }} />
            {passWidth >= 9 && (
              <span className="absolute inset-y-0 text-center text-win" style={passUp ? { left: `${at}%`, right: 0 } : { left: 0, width: `${at}%` }}>pass</span>
            )}
            <span className={`absolute inset-y-0 px-2 text-bad/90 ${passUp ? 'text-right' : ''}`} style={passUp ? { left: 0, width: `${at}%` } : { left: `${at}%`, right: 0 }}>fail</span>
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10.5px] text-faint">
            <span>{zoomed && lo > 0 ? '… ' : ''}{pctLabel(lo)}</span>
            <span>{pctLabel(hi)}{zoomed && hi < 1 ? ' …' : ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UseCasePage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const uc = useQuery({ queryKey: ['use-case', id], queryFn: () => api.useCase(id), refetchInterval: 4000 })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const cases = useQuery({ queryKey: ['cases', id], queryFn: () => api.cases(id), refetchInterval: 4000 })
  const runs = useQuery({ queryKey: ['runs', id], queryFn: () => api.runs(id) })
  const metrics = useQuery({ queryKey: ['metrics'], queryFn: api.metrics })
  const [draft, setDraft] = useState<Profile | null>(null)

  const save = useMutation({
    mutationFn: (profile: Profile) => api.updateUseCase(id, { profile }),
    onSuccess: (updated) => {
      qc.setQueryData(['use-case', id], updated)
      qc.invalidateQueries({ queryKey: ['use-cases'] })
      setDraft(null)
    },
  })

  const eff = useEffective(uc.data, me.data)
  const reset = useMutation({
    mutationFn: (patch: UseCasePatch) => api.updateUseCase(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData(['use-case', id], updated)
      qc.invalidateQueries({ queryKey: ['use-cases'] })
      setDraft(null)
    },
  })

  if (uc.isLoading) return <Loading />
  if (uc.error) return <ErrorNote error={uc.error} />
  const u = uc.data!
  const profile = draft ?? u.profile ?? me.data?.workspace.default_profile ?? { weights: { quality: 60, speed: 20, cost: 20 }, targets: {} }
  const metricName = (mid: string) => metrics.data?.find((m: MetricInfo) => m.id === mid || m.aliases.includes(mid))?.name ?? mid
  const ready = readiness(u, cases.data)
  const totalWeight = u.metrics.reduce((s, m) => s + m.weight, 0) || 1
  const ref = u.source_refs[0]
  const moreRefs = u.source_refs.length - 1
  const judged = hasJudgeMetric(u)
  const casesStale = (cases.data ?? []).some((c) => editedAfterRun(c, u))

  return (
    <div>
      <UseCaseHeader uc={u} />
      {u.description && <Description text={u.description} />}

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        <div className="min-w-0 bg-panel px-4 py-3">
          <dt className="text-xs text-faint">Called from</dt>
          <dd className="mt-1 truncate font-mono text-[12.5px]" title={u.source_refs.map((r) => `${r.path}:${r.line ?? ''}`).join('\n')}>
            {ref ? `${ref.path}${ref.line ? `:${ref.line}` : ''}` : '–'}
          </dd>
          <dd className="mt-0.5 truncate text-xs text-muted">
            {[ref?.symbol, moreRefs > 0 ? `+${moreRefs} more call ${moreRefs === 1 ? 'site' : 'sites'}` : null].filter(Boolean).join(' · ') || ' '}
          </dd>
        </div>
        <div className="min-w-0 bg-panel px-4 py-3">
          <dt className="text-xs text-faint">Model today</dt>
          <dd className="mt-1">
            {u.current_model
              ? <ModelName model={u.current_model.model} effort={effortOf(u.current_model.model, u.current_model.params)} size={15} nameClass="font-medium text-[15px]" />
              : <span className="text-muted">not set</span>}
          </dd>
          {u.current_model && <dd className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><ProviderIcon provider={u.current_model.provider} size={11} />via {u.current_model.provider}</dd>}
        </div>
        <div className="bg-panel px-4 py-3">
          <dt className="text-xs text-faint">Test cases</dt>
          <dd className={`title mt-1 text-2xl ${(cases.data?.length ?? u.case_count) === 0 ? 'text-front' : ''}`}>{cases.data?.length ?? u.case_count}</dd>
        </div>
        <div className="bg-panel px-4 py-3">
          <dt className="text-xs text-faint">Must pass</dt>
          <dd className="title mt-1 text-2xl">{u.gates.length} <span className="text-sm font-normal text-muted">{u.gates.length === 1 ? 'gate' : 'gates'}</span></dd>
        </div>
      </dl>

      <div className="mt-6">
        <SetupPanel uc={u} cases={cases.data} />
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-12">
          <Section
            title="What matters for this job"
            aside={draft ? (
              <span className="flex gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save weights'}</Button>
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {eff && <InheritBadge source={eff.profile.source} resetting={reset.isPending} onReset={() => reset.mutate({ profile: null })} />}
                <span>Drag the dot or pick a preset. The ranking uses these weights.</span>
              </span>
            )}
          >
            <Panel className="p-5 sm:p-6">
              <Weights profile={profile} onChange={setDraft} />
            </Panel>
            {save.error && <div className="mt-3"><ErrorNote error={save.error} /></div>}
          </Section>

          <div className="grid gap-6 md:grid-cols-2">
            <Section title="Must pass">
              <Panel className="divide-y divide-line">
                {u.gates.length === 0 && <p className="p-4 text-sm text-muted">No gates yet. Every model is ranked on the weights alone.</p>}
                {u.gates.map((g) => <GateRow key={g.metric_id + g.op} gate={g} name={metricName(g.metric_id)} />)}
              </Panel>
            </Section>
            <Section title="Quality is measured by">
              <Panel className="divide-y divide-line">
                {u.metrics.length === 0 && <p className="p-4 text-sm text-muted">Your agent is still choosing metrics.</p>}
                {u.metrics.map((m) => (
                  <div key={m.metric_id} className="p-4">
                    <div className="flex justify-between gap-3 text-sm">
                      <span>{metricName(m.metric_id)}</span>
                      <span className="text-muted">{Math.round((m.weight / totalWeight) * 100)}%</span>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-raised">
                      <div className="h-1 rounded-full bg-fg/80" style={{ width: `${(m.weight / totalWeight) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {judged && (
                  <p className="p-4 text-xs leading-relaxed text-muted">
                    Judged by <span className="text-fg">{juryNames(u, me.data?.workspace.default_judge)}</span>. Each judge abstains on its own model family; the score is the mean of the judges that vote.
                    {eff && <span className="mt-2 block"><InheritBadge source={eff.judge.source} resetting={reset.isPending} onReset={() => reset.mutate({ judge: null })} /></span>}
                  </p>
                )}
              </Panel>
            </Section>
          </div>

          <Section
            title="Test cases"
            aside={
              <span className="flex flex-wrap items-center gap-x-3">
                {casesStale && <span className="inline-flex items-center gap-1.5 text-xs text-front"><span className="size-1.5 rounded-[1px] bg-front" />Cases edited after the last run</span>}
                <span>{cases.data?.length ?? u.case_count} cases</span>
              </span>
            }
          >
            <CasesTable uc={u} cases={cases.data} loading={cases.isLoading} />
          </Section>
        </div>

        <div className="min-w-0 space-y-10">
          <StartRun useCase={u} needsVision={ready.vision} blocked={ready.blocked} />
          <Section title="Past runs">
            {runs.data?.length === 0 && <p className="text-sm text-muted">No runs yet.</p>}
            <ul className="space-y-2">
              {runs.data?.map((r) => {
                const v = briefVerdict(r)
                return (
                  <li key={r.id}>
                    <Link to={`/runs/${r.id}`} className="block rounded-xl border border-line bg-panel p-4 text-sm hover:bg-raised">
                      <div className="flex items-center justify-between gap-2">
                        <StatusPill status={r.status} />
                        <span className="text-xs text-faint">{ago(r.finished_at)}</span>
                      </div>
                      {r.recommendation_headline && <p className={`mt-2 ${v === 'keep' ? 'text-muted' : ''}`}>{r.recommendation_headline}</p>}
                      {r.est_monthly_savings_usd != null && r.est_monthly_savings_usd > 0 && <p className="mt-1 text-win">~{usd(r.est_monthly_savings_usd)}/month</p>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Section>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
