import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StartRun from '@/components/StartRun'
import { Button, ErrorNote, Loading, Panel, Section, StatusPill, Tag } from '@/components/ui'
import Weights from '@/components/Weights'
import { api } from '@/lib/api'
import { ago, shortModel, usd } from '@/lib/format'
import type { Case, MetricInfo, Profile } from '@/types'

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

  return (
    <div>
      <Link to="/" className="text-sm text-muted hover:text-ink">Use cases</Link>
      <div className="mt-2 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{u.name}</h1>
            <Tag>{u.kind}</Tag>
            {u.created_by === 'mcp' && <Tag tone="accent">found by agent</Tag>}
          </div>
          {u.description && <p className="mt-2 text-muted">{u.description}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {u.source_refs.map((r) => (
              <span key={`${r.path}:${r.line}`} className="text-muted">
                {r.repo ? `${r.repo}/` : ''}{r.path}{r.line ? `:${r.line}` : ''}{r.symbol ? ` (${r.symbol})` : ''}
              </span>
            ))}
            <span>Today: <span className="font-medium">{u.current_model ? `${shortModel(u.current_model.model)} via ${u.current_model.provider}` : 'not set'}</span></span>
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          <Section
            title="What matters for this job"
            aside={draft && (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
                <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save weights'}</Button>
              </div>
            )}
          >
            <Panel className="grid gap-8 p-5 md:grid-cols-2">
              <Weights profile={profile} onChange={setDraft} />
              <div className="space-y-5 text-sm">
                <div>
                  <h3 className="mb-2 font-medium">Must pass</h3>
                  {u.gates.length === 0 && <p className="text-muted">No gates.</p>}
                  <ul className="space-y-1">
                    {u.gates.map((g) => (
                      <li key={g.metric_id + g.op} className="flex justify-between gap-3">
                        <span>{metricName(g.metric_id)}</span>
                        <span className="text-muted">{g.op} {g.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 font-medium">Quality is measured by</h3>
                  <ul className="space-y-1">
                    {u.metrics.map((m) => (
                      <li key={m.metric_id} className="flex justify-between gap-3">
                        <span>{metricName(m.metric_id)}</span>
                        <span className="text-muted">weight {m.weight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Panel>
            {save.error && <div className="mt-3"><ErrorNote error={save.error} /></div>}
          </Section>

          <Section title="Test cases" aside={<span className="text-sm text-muted">{cases.data?.length ?? u.case_count} cases</span>}>
            {cases.isLoading && <Loading />}
            {cases.data?.length === 0 && (
              <p className="rounded-lg border border-dashed border-rule px-5 py-8 text-sm text-muted">
                No cases yet. Ask your agent to add cases from the repo's tests or fixtures, or to generate synthetic ones.
              </p>
            )}
            {!!cases.data?.length && (
              <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-rule text-muted">
                    <tr><th className="px-4 py-2 font-medium">Input</th><th className="px-4 py-2 font-medium">Expected</th><th className="px-4 py-2 font-medium">Source</th></tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {cases.data.map((c) => (
                      <tr key={c.id} className="align-top">
                        <td className="max-w-[360px] px-4 py-2.5">{caseInput(c)}</td>
                        <td className="max-w-[300px] px-4 py-2.5 text-muted">{preview(c.reference, 100)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <Tag>{c.source}</Tag> {c.tags.map((t) => <span key={t} className="ml-1 text-xs text-muted">{t}</span>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-8">
          <StartRun useCase={u} needsVision={needsVision} />
          <Section title="Past runs">
            {runs.data?.length === 0 && <p className="text-sm text-muted">No runs yet.</p>}
            <ul className="space-y-2">
              {runs.data?.map((r) => (
                <li key={r.id}>
                  <Link to={`/runs/${r.id}`} className="block rounded-lg border border-rule bg-surface p-3 text-sm hover:border-faint">
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill status={r.status} />
                      <span className="text-xs text-faint">{ago(r.finished_at)}</span>
                    </div>
                    {r.recommendation_headline && <p className="mt-2">{r.recommendation_headline}</p>}
                    {r.est_monthly_savings_usd != null && <p className="mt-1 text-win">saves ~{usd(r.est_monthly_savings_usd)}/month</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  )
}
