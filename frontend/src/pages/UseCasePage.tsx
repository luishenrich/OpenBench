import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StartRun from '@/components/StartRun'
import { Badge, Button, ErrorNote, Loading, Panel, Section, StatusPill, Tag } from '@/components/ui'
import Weights from '@/components/Weights'
import { api } from '@/lib/api'
import { ago, shortModel, usd } from '@/lib/format'
import { briefVerdict } from '@/lib/verdict'
import type { Case, Gate, MetricInfo, Profile } from '@/types'
import { ModelIcon, ProviderIcon } from '@/components/ModelIcon'

function preview(x: unknown, max = 140): string {
  if (x == null) return '–'
  const s = typeof x === 'string' ? x : JSON.stringify(x)
  return s.length > max ? s.slice(0, max) + '…' : s
}

function caseInput(c: Case): string {
  if (c.input.images?.length) return `${c.input.images.length} image${c.input.images.length > 1 ? 's' : ''}`
  if (c.input.vars) return preview(Object.values(c.input.vars).join(' | '))
  return preview(c.input.messages)
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

  if (uc.isLoading) return <Loading />
  if (uc.error) return <ErrorNote error={uc.error} />
  const u = uc.data!
  const profile = draft ?? u.profile ?? me.data?.workspace.default_profile ?? { weights: { quality: 60, speed: 20, cost: 20 }, targets: {} }
  const metricName = (mid: string) => metrics.data?.find((m: MetricInfo) => m.id === mid || m.aliases.includes(mid))?.name ?? mid
  const needsVision = (cases.data ?? []).some((c) => (c.input.images?.length ?? 0) > 0)
  const totalWeight = u.metrics.reduce((s, m) => s + m.weight, 0) || 1
  const ref = u.source_refs[0]

  return (
    <div>
      <Link to="/" className="rounded-md border border-line bg-panel px-2.5 py-1 text-xs text-muted hover:text-fg">Use cases</Link>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Badge tone="front">{u.kind}</Badge>
        {u.created_by === 'mcp' && <Badge tone="signal">Found by agent</Badge>}
      </div>
      <h1 className="display mt-4 max-w-4xl text-4xl text-balance sm:text-6xl">{u.name}</h1>
      {u.description && <p className="mt-4 max-w-2xl text-lg text-muted">{u.description}</p>}

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        <div className="bg-panel p-4">
          <dt className="text-xs text-faint">Called from</dt>
          <dd className="mt-1 truncate font-mono text-[12.5px]" title={ref ? `${ref.path}:${ref.line ?? ''}` : ''}>
            {ref ? `${ref.path}${ref.line ? `:${ref.line}` : ''}` : '–'}
          </dd>
          {ref?.symbol && <dd className="text-xs text-muted">{ref.symbol}</dd>}
        </div>
        <div className="bg-panel p-4">
          <dt className="text-xs text-faint">Model today</dt>
          <dd className="mt-1 flex items-center gap-2 font-medium">{u.current_model && <ModelIcon model={u.current_model.model} size={16} />}{u.current_model ? shortModel(u.current_model.model) : 'not set'}</dd>
          {u.current_model && <dd className="mt-1 flex items-center gap-1.5 text-xs text-muted"><ProviderIcon provider={u.current_model.provider} size={11} />via {u.current_model.provider}</dd>}
        </div>
        <div className="bg-panel p-4">
          <dt className="text-xs text-faint">Test cases</dt>
          <dd className="title mt-1 text-2xl">{cases.data?.length ?? u.case_count}</dd>
        </div>
        <div className="bg-panel p-4">
          <dt className="text-xs text-faint">Must pass</dt>
          <dd className="title mt-1 text-2xl">{u.gates.length} <span className="text-sm font-normal text-muted">gates</span></dd>
        </div>
      </dl>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-12">
          <Section
            title="What matters for this job"
            aside={draft ? (
              <span className="flex gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save weights'}</Button>
              </span>
            ) : 'Drag the borders. The ranking uses these weights.'}
          >
            <Panel className="p-5 sm:p-6">
              <Weights profile={profile} onChange={setDraft} />
            </Panel>
            {save.error && <div className="mt-3"><ErrorNote error={save.error} /></div>}
          </Section>

          <div className="grid gap-6 md:grid-cols-2">
            <Section title="Must pass">
              <Panel className="divide-y divide-line">
                {u.gates.length === 0 && <p className="p-4 text-sm text-muted">No gates.</p>}
                {u.gates.map((g) => <GateRow key={g.metric_id + g.op} gate={g} name={metricName(g.metric_id)} />)}
              </Panel>
            </Section>
            <Section title="Quality is measured by">
              <Panel className="divide-y divide-line">
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
              </Panel>
            </Section>
          </div>

          <Section title="Test cases" aside={`${cases.data?.length ?? u.case_count} cases`}>
            {cases.isLoading && <Loading />}
            {cases.data?.length === 0 && (
              <p className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-sm text-muted">
                No cases yet. Ask your agent to add cases from the repo's tests or fixtures, or to generate synthetic ones.
              </p>
            )}
            {!!cases.data?.length && (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-panel text-xs text-faint">
                    <tr><th className="px-4 py-2.5 font-medium">Input</th><th className="px-4 py-2.5 font-medium">Expected</th><th className="px-4 py-2.5 font-medium">Source</th></tr>
                  </thead>
                  <tbody>
                    {cases.data.map((c) => (
                      <tr key={c.id} className="border-t border-line align-top">
                        <td className="max-w-[360px] px-4 py-3">{caseInput(c)}</td>
                        <td className="max-w-[300px] px-4 py-3 font-mono text-[12px] text-muted">{preview(c.reference, 100)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Tag>{c.source}</Tag> {c.tags.map((t) => <span key={t} className="ml-1 text-xs text-faint">{t}</span>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="min-w-0 space-y-10">
          <StartRun useCase={u} needsVision={needsVision} />
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
    </div>
  )
}
