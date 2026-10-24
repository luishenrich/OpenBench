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

// A gate on a 0–1 ruler: the shaded side passes.
function GateRuler({ gate }: { gate: Gate }) {
  const ratio = gate.value >= 0 && gate.value <= 1
  if (!ratio) return <span className="font-mono text-xs text-muted">{gate.op} {gate.value}</span>
  const x = gate.value * 100
  const passRight = gate.op === '>=' || gate.op === '>'
  return (
    <div className="relative h-4 w-40" aria-hidden>
      <div className="absolute inset-x-0 top-[7px] h-px bg-line-strong" />
      <div className="absolute top-[5px] h-[5px] rounded-[1px] bg-win/50" style={passRight ? { left: `${x}%`, right: 0 } : { left: 0, width: `${x}%` }} />
      <div className="absolute top-0 h-4 w-px bg-fg" style={{ left: `${x}%` }} />
    </div>
  )
}

export default function UseCasePage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const uc = useQuery({ queryKey: ['use-case', id], queryFn: () => api.useCase(id) })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const cases = useQuery({ queryKey: ['cases', id], queryFn: () => api.cases(id) })
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
      <h1 className="display mt-4 max-w-4xl text-4xl sm:text-6xl">{u.name}</h1>
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
          <dd className="mt-1 font-medium">{u.current_model ? shortModel(u.current_model.model) : 'not set'}</dd>
          {u.current_model && <dd className="text-xs text-muted">via {u.current_model.provider}</dd>}
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
        <div className="space-y-12">
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
                {u.gates.map((g) => (
                  <div key={g.metric_id + g.op} className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <div className="text-sm">{metricName(g.metric_id)}</div>
                      <div className="font-mono text-[11.5px] text-faint">{g.op} {g.value}</div>
                    </div>
                    <GateRuler gate={g} />
                  </div>
                ))}
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
                <table className="w-full text-left text-sm">
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

        <div className="space-y-10">
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
