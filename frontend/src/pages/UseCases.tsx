import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import ConnectAgent from '@/components/ConnectAgent'
import { ErrorNote, Loading, StatusPill, Tag } from '@/components/ui'
import { api } from '@/lib/api'
import { ago, shortModel, usd } from '@/lib/format'
import { briefVerdict } from '@/lib/verdict'

const verdictDot = { switch: 'bg-win', keep: 'bg-muted', use: 'bg-front' } as const

export default function UseCases() {
  const q = useQuery({ queryKey: ['use-cases'], queryFn: api.useCases })
  const done = q.data?.filter((u) => u.latest_run?.status === 'done').length ?? 0
  const savings = q.data?.reduce((s, u) => s + (u.latest_run?.est_monthly_savings_usd ?? 0), 0) ?? 0

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        <h1 className="display text-4xl sm:text-5xl">Use cases</h1>
        <p className="mt-3 max-w-lg text-muted">Every place your product calls an LLM, the model it uses today, and what the benchmark says.</p>
        {!!q.data?.length && (
          <p className="mt-5 text-sm text-faint">
            {q.data.length} found, {done} benchmarked{savings > 0 && <>, <span className="text-win">~{usd(savings)}/month</span> to save</>}
          </p>
        )}

        <div className="mt-8">
          {q.isLoading && <Loading />}
          {q.error && <ErrorNote error={q.error} />}
          {q.data?.length === 0 && (
            <div className="rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
              <p className="title">No use cases yet</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">Connect your coding agent and run the scan. It creates the use cases for you.</p>
            </div>
          )}

          {!!q.data?.length && (
            <ul className="overflow-hidden rounded-xl border border-line">
              {q.data.map((uc, i) => {
                const ref = uc.source_refs[0]
                const run = uc.latest_run
                const v = run && briefVerdict(run)
                return (
                  <li key={uc.id} className={i ? 'border-t border-line' : ''}>
                    <Link to={`/use-cases/${uc.id}`} className="group grid gap-3 bg-panel px-5 py-5 transition-colors hover:bg-raised sm:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="title text-[17px]">{uc.name}</span>
                          <Tag>{uc.kind}</Tag>
                          {uc.created_by === 'mcp' && <Tag tone="front">found by agent</Tag>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                          {ref && <span className="truncate font-mono text-[12px] text-faint">{ref.path}{ref.line ? `:${ref.line}` : ''}</span>}
                          <span>{uc.current_model ? `today ${shortModel(uc.current_model.model)}` : 'no current model'}</span>
                          <span>{uc.case_count} cases</span>
                        </div>
                        {run && (
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            {run.status === 'done' && v ? (
                              <>
                                <span className={`size-2 rounded-[2px] ${verdictDot[v]}`} />
                                <span className={v === 'keep' ? 'text-muted' : 'text-fg'}>{run.recommendation_headline}</span>
                              </>
                            ) : (
                              <StatusPill status={run.status} />
                            )}
                            {run.est_monthly_savings_usd != null && run.est_monthly_savings_usd > 0 && (
                              <span className="text-win">~{usd(run.est_monthly_savings_usd)}/month</span>
                            )}
                            {run.finished_at && <span className="text-faint">{ago(run.finished_at)}</span>}
                          </div>
                        )}
                      </div>
                      <span className="hidden self-center text-faint transition-colors group-hover:text-fg sm:block" aria-hidden>
                        <svg viewBox="0 0 16 16" className="size-4"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <aside className="lg:pt-2">
        <ConnectAgent />
      </aside>
    </div>
  )
}
