import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ErrorNote, Loading } from '@/components/ui'
import { ProjectList } from '@/components/usecases/ProjectList'
import { LiveDot, WaitingForAgent, useFreshIds } from '@/components/usecases/live'
import { savingsOf } from '@/components/usecases/group'
import { api } from '@/lib/api'
import { usd } from '@/lib/format'

// Polls so the list fills up while the coding agent's scan creates use cases.
const LIVE_MS = 3000

export default function UseCases() {
  const q = useQuery({ queryKey: ['use-cases'], queryFn: api.useCases, refetchInterval: LIVE_MS })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const fresh = useFreshIds(q.data?.map((u) => u.id))
  const fallbackName = me.data?.workspace.name || 'Your project'
  const done = q.data?.filter((u) => u.latest_run?.status === 'done').length ?? 0
  const savings = q.data ? savingsOf(q.data) : 0

  return (
    // full width now that connecting lives on /connections; capped so rows don't stretch into emptiness
    <div className="mx-auto max-w-6xl">
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="display text-4xl sm:text-5xl">Use cases</h1>
            <p className="mt-3 max-w-lg text-muted">Every place your product calls an LLM, the model it uses today, and what the benchmark says.</p>
          </div>
          {!!q.data?.length && (
            <Link to="/connections" className="rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg">
              Connect another repo
            </Link>
          )}
        </div>
        {!!q.data?.length && (
          <p className="mt-5 flex flex-wrap items-center gap-x-2 text-sm text-faint" role="status">
            <LiveDot className="mr-0.5" />
            <span>{q.data.length} found, {done} benchmarked{savings > 0 && <>, <span className="text-win">~{usd(savings)}/month</span> to save</>}</span>
            <span aria-hidden>·</span>
            <span>updates live while your agent works</span>
          </p>
        )}

        <div className="mt-8">
          {q.isLoading && <Loading />}
          {q.error && !q.data && <ErrorNote error={q.error} />}
          {q.data?.length === 0 && <WaitingForAgent />}
          {!!q.data?.length && <ProjectList useCases={q.data} fallbackName={fallbackName} fresh={fresh} />}
        </div>
      </div>

    </div>
  )
}
