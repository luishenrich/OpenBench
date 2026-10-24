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

// contract/fixtures has three use cases; a real scan finds ~40. These extras (dashboard-only, not in the
// contract) give the grouped list something realistic to show: two projects, mixed kinds, half set up.
type Extra = [name: string, kind: UseCase['kind'], repo: string | null, path: string, line: number, model: string, metrics: number, cases: number, run?: RunBrief]
const EXTRAS: Extra[] = [
  ['Answer questions about a PDF', 'rag', 'studypdf', 'app/api/chat/route.ts', 31, 'openai/gpt-4.1-mini', 3, 40,
    { id: 'fx-run-1', status: 'done', finished_at: '2026-10-24T10:20:00Z', recommendation_headline: 'Switch to DeepSeek-V4.1-Flash: same answer quality at 1/6 of the cost', est_monthly_savings_usd: 238 }],
  ['Generate flashcards from a chapter', 'generation', 'studypdf', 'lib/flashcards.ts', 18, 'openai/gpt-4.1', 2, 24,
    { id: 'fx-run-2', status: 'done', finished_at: '2026-10-24T10:42:00Z', recommendation_headline: 'Keep gpt-4.1: no open model passed the card-format gate', est_monthly_savings_usd: null }],
  ['Summarize a chapter', 'summarization', 'studypdf', 'lib/summarize.ts', 12, 'openai/gpt-4.1-mini', 2, 30,
    { id: 'fx-run-3', status: 'running', finished_at: null, recommendation_headline: null, est_monthly_savings_usd: null }],
  ['Extract the table of contents', 'extraction', 'studypdf', 'lib/pdf/toc.ts', 54, 'openai/gpt-4.1-mini', 2, 18],
  ['Grade a quiz answer', 'classification', 'studypdf', 'app/api/quiz/grade/route.ts', 22, 'openai/gpt-4.1-mini', 1, 0],
  ['Write quiz questions', 'generation', 'studypdf', 'lib/quiz.ts', 40, 'openai/gpt-4.1', 0, 0],
  ['Tutor chat', 'chat', 'studypdf', 'app/api/tutor/route.ts', 15, 'openai/gpt-4.1', 2, 12],
  ['Detect the document language', 'classification', 'studypdf', 'lib/pdf/lang.ts', 9, 'openai/gpt-4.1-nano', 1, 20,
    { id: 'fx-run-4', status: 'done', finished_at: '2026-10-24T09:05:00Z', recommendation_headline: 'Switch to GLM-5.3-Flash: 99% of the accuracy at 1/3 of the cost', est_monthly_savings_usd: 41 }],
  ['Explain a highlighted passage', 'chat', 'studypdf', 'app/api/explain/route.ts', 27, 'openai/gpt-4.1-mini', 0, 0],
  ['Extract key terms', 'extraction', 'studypdf', 'lib/glossary.ts', 33, 'openai/gpt-4.1-mini', 2, 0],
  ['Classify incoming email', 'classification', null, 'services/inbox/classify.py', 48, 'openai/gpt-4.1-mini', 2, 60,
    { id: 'fx-run-5', status: 'done', finished_at: '2026-10-23T16:30:00Z', recommendation_headline: 'Switch to gpt-oss-120b: higher accuracy and 40% cheaper', est_monthly_savings_usd: 156 }],
  ['Draft a reply to a customer', 'generation', null, 'services/inbox/reply.py', 77, 'openai/gpt-4.1', 3, 25],
  ['Pull order numbers from email', 'extraction', null, 'services/inbox/extract.py', 21, 'openai/gpt-4.1-mini', 2, 35],
  ['Support agent with tools', 'agent', null, 'services/agent/loop.py', 112, 'openai/gpt-4.1', 3, 15],
  ['Search help-center articles', 'rag', null, 'services/help/search.py', 64, 'openai/gpt-4.1-mini', 0, 0],
  ['Summarize a support thread', 'summarization', null, 'services/support/summary.py', 19, 'openai/gpt-4.1-mini', 2, 0],
  ['Detect angry customers', 'classification', null, 'services/support/sentiment.py', 11, 'openai/gpt-4.1-nano', 1, 40],
  ['Translate replies', 'generation', null, 'services/i18n/translate.py', 30, 'google/gemini-2.5-flash', 0, 0],
  ['Nightly product tagging', 'batch', null, 'jobs/tag_products.py', 58, 'openai/gpt-4.1-mini', 2, 50,
    { id: 'fx-run-6', status: 'done', finished_at: '2026-10-23T22:10:00Z', recommendation_headline: 'Switch to Qwen3.6-35B-A3B: same tags at 1/8 of the cost', est_monthly_savings_usd: 520 }],
  ['Write product descriptions', 'batch', null, 'jobs/describe_products.py', 36, 'openai/gpt-4.1', 2, 0],
  ['Parse shipping addresses', 'extraction', null, 'services/orders/address.py', 25, 'openai/gpt-4.1-mini', 0, 0],
  ['Onboarding chat', 'chat', null, 'web/app/api/onboarding/route.ts', 14, 'openai/gpt-4.1-mini', 2, 20],
  ['Rewrite search queries', 'rag', null, 'services/help/rewrite.py', 8, 'openai/gpt-4.1-nano', 1, 30],
  ['Moderate user reviews', 'classification', null, 'services/reviews/moderate.py', 42, 'openai/gpt-4.1-mini', 2, 0],
  ['Fix up OCR text', 'other', null, 'services/docs/ocr_cleanup.py', 17, 'openai/gpt-4.1-mini', 0, 0],
  ['Score lead quality', 'classification', null, 'services/crm/leads.py', 66, 'openai/gpt-4.1-mini', 2, 45],
]

const METRIC_IDS = ['json_schema_valid', 'field_accuracy', 'llm_judge']
const extras: UseCase[] = EXTRAS.map(([name, kind, repo, path, line, model, metrics, cases, run], i) => ({
  id: `00000000-0000-0000-0000-0000000001${String(i).padStart(2, '0')}`,
  workspace_id: '00000000-0000-0000-0000-0000000000a1',
  name,
  kind,
  description: '',
  source_refs: [{ repo, path, line, symbol: null }],
  current_model: { provider: model.startsWith('google/') ? 'openrouter' : 'openai', model, params: {} },
  profile: null,
  gates: [],
  metrics: METRIC_IDS.slice(0, metrics).map((metric_id) => ({ metric_id, weight: 1, config: {} })),
  judge: null,
  io_spec: { system_prompt: null, user_template: null, response_schema: null, tools: null, params: {} },
  case_count: cases,
  latest_run: run ?? null,
  created_by: 'mcp',
  created_at: new Date(Date.parse('2026-10-24T09:00:00Z') + i * 60_000).toISOString(),
}))

const useCases = [...(clone(useCasesJson) as unknown as UseCase[]), ...extras]

// ?scan=1 plays a live scan: the list starts empty and gains one use case every 1.5 s, as if a coding
// agent were calling biy_use_cases_create. Only the list endpoint is affected.
let scanStart: number | null = null
function visibleUseCases(): UseCase[] {
  let scan = false
  try { scan = new URLSearchParams(window.location.search).get('scan') === '1' } catch { /* no window */ }
  if (!scan && scanStart == null) return useCases
  scanStart ??= Date.now()
  const n = Math.max(0, Math.floor((Date.now() - scanStart - 4000) / 1500))
  return useCases.slice(0, n)
}
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
  useCases: () => wait(visibleUseCases()),
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
