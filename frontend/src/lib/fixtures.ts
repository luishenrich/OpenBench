// In-memory API over contract/fixtures. Runs started here play back run_running → run_done over ~20 s,
// so the 2 s polling, the progress bar and the partial leaderboard can be built before the worker exists.
import casesJson from '@fixtures/cases.json'
import estimateJson from '@fixtures/estimate.json'
import meJson from '@fixtures/me.json'
import metricsJson from '@fixtures/metrics.json'
import modelsJson from '@fixtures/models.json'
import resultsJson from '@fixtures/results.json'
import runDoneJson from '@fixtures/run_done.json'
import runRunningJson from '@fixtures/run_running.json'
import useCasesJson from '@fixtures/use_cases.json'
import type {
  Case, CatalogModel, Estimate, Me, MetricInfo, ResultsPage, Run, RunBrief, RunIn, UseCase, UseCasePatch,
} from '@/types'

const clone = <T,>(x: T): T => structuredClone(x)
const wait = <T,>(x: T, delay = 180): Promise<T> => new Promise((r) => setTimeout(() => r(clone(x)), delay))

const useCases = clone(useCasesJson) as unknown as UseCase[]
const runDone = runDoneJson as unknown as Run
const runRunning = runRunningJson as unknown as Run
const PLAYBACK_MS = 20_000
const started = new Map<string, number>() // run id → playback start

function playback(id: string, useCaseId: string): Run {
  const t0 = started.get(id) ?? Date.now()
  started.set(id, t0)
  const f = Math.min(1, (Date.now() - t0) / PLAYBACK_MS)
  if (f >= 1) return { ...clone(runDone), id, use_case_id: useCaseId }
  const total = runDone.progress.total
  const done = Math.round(total * f)
  // partial leaderboard: same rows, n grows, recommendation withheld until done
  const leaderboard = f < 0.15 ? [] : clone(runDone.leaderboard).map((c) => ({
    ...c,
    n: Math.round(c.n * f),
    quality: { ...c.quality, n: Math.round(c.n * f), ci_low: c.quality.ci_low - 0.04 * (1 - f), ci_high: Math.min(1, c.quality.ci_high + 0.04 * (1 - f)) },
    rank: null,
  }))
  return {
    ...clone(runRunning),
    id,
    use_case_id: useCaseId,
    status: 'running',
    progress: { ...runRunning.progress, done, total, errors: f > 0.5 ? 1 : 0 },
    leaderboard,
    pareto_points: f < 0.15 ? [] : clone(runDone.pareto_points),
    recommendation: null,
    finished_at: null,
  }
}

function findUseCase(id: string): UseCase {
  const uc = useCases.find((u) => u.id === id)
  if (!uc) throw new Error('Use case not found')
  return uc
}

export const fixtureApi = {
  me: () => wait(meJson as unknown as Me),
  rotateMcpKey: () => wait({ key: 'biy_fixture_' + Math.random().toString(36).slice(2, 14) }),
  models: () => wait(modelsJson as unknown as CatalogModel[]),
  metrics: () => wait(metricsJson as unknown as MetricInfo[]),
  useCases: () => wait(useCases),
  useCase: async (id: string) => wait(findUseCase(id)),
  updateUseCase: async (id: string, patch: UseCasePatch) => {
    const uc = findUseCase(id)
    Object.assign(uc, patch)
    return wait(uc, 250)
  },
  cases: (id: string) => wait((casesJson as unknown as Case[]).filter((c) => c.use_case_id === id)),
  runs: async (id: string): Promise<RunBrief[]> => {
    const uc = findUseCase(id)
    return wait(uc.latest_run ? [uc.latest_run] : [])
  },
  estimate: (_req: RunIn) => wait(estimateJson as unknown as Estimate, 500),
  startRun: async (req: RunIn): Promise<Run> => {
    const id = crypto.randomUUID()
    started.set(id, Date.now())
    const uc = findUseCase(req.use_case_id)
    uc.latest_run = { id, status: 'running', finished_at: null, recommendation_headline: null, est_monthly_savings_usd: null }
    return wait(playback(id, req.use_case_id), 400)
  },
  run: async (id: string): Promise<Run> => {
    if (id === runDone.id) return wait(runDone)
    const uc = useCases.find((u) => u.latest_run?.id === id)
    const run = playback(id, uc?.id ?? runDone.use_case_id)
    if (uc && run.status === 'done') {
      uc.latest_run = {
        id, status: 'done', finished_at: run.finished_at,
        recommendation_headline: run.recommendation?.headline ?? null,
        est_monthly_savings_usd: run.recommendation?.est_monthly_savings_usd ?? null,
      }
    }
    return wait(run, 120)
  },
  cancelRun: async (id: string) => wait({ ...playback(id, runDone.use_case_id), status: 'cancelled' as const }),
  results: (_id: string, _params: { candidate_key?: string; case_id?: string; cursor?: string } = {}) =>
    wait(resultsJson as unknown as ResultsPage),
}
