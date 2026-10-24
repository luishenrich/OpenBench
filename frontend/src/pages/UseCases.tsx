import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import ConnectAgent from '@/components/ConnectAgent'
import { ErrorNote, Loading, StatusPill, Tag } from '@/components/ui'
import { api } from '@/lib/api'
import { ago, shortModel, usd } from '@/lib/format'

export default function UseCases() {
  const q = useQuery({ queryKey: ['use-cases'], queryFn: api.useCases })

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Use cases</h1>
          <p className="mt-1 text-muted">Every place your product calls an LLM, with the model it uses today.</p>
        </div>

        {q.isLoading && <Loading />}
        {q.error && <ErrorNote error={q.error} />}
        {q.data?.length === 0 && (
          <div className="rounded-lg border border-dashed border-rule px-6 py-12 text-center">
            <p className="font-medium">No use cases yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Connect your coding agent and run the scan. It creates the use cases for you.</p>
          </div>
        )}

        {!!q.data?.length && <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-surface">
          {q.data?.map((uc) => {
            const ref = uc.source_refs[0]
            const run = uc.latest_run
            return (
              <li key={uc.id}>
                <Link to={`/use-cases/${uc.id}`} className="block px-5 py-4 hover:bg-paper/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{uc.name}</span>
                    <Tag>{uc.kind}</Tag>
                    {uc.created_by === 'mcp' && <Tag tone="accent">found by agent</Tag>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    {ref && <span className="truncate">{ref.path}{ref.line ? `:${ref.line}` : ''}</span>}
                    <span>{uc.current_model ? `today: ${shortModel(uc.current_model.model)}` : 'no current model'}</span>
                    <span>{uc.case_count} cases</span>
                  </div>
                  {run && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <StatusPill status={run.status} />
                      {run.recommendation_headline ? (
                        <span className="text-ink">{run.recommendation_headline}</span>
                      ) : (
                        <span className="text-muted">{run.status === 'done' ? 'No recommendation' : 'Benchmark in progress'}</span>
                      )}
                      {run.est_monthly_savings_usd != null && (
                        <span className="text-win">saves ~{usd(run.est_monthly_savings_usd)}/month</span>
                      )}
                      {run.finished_at && <span className="text-faint">{ago(run.finished_at)}</span>}
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>}
      </div>

      <aside className="lg:pt-[4.5rem]">
        <ConnectAgent />
      </aside>
    </div>
  )
}
