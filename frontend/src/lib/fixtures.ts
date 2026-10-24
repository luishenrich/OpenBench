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
  Case, CaseIn, CasePatch, CatalogModel, GenerateCasesIn, Estimate, Me, MetricInfo, ResultsPage, Run, RunBrief, RunIn, UseCase, UseCasePatch,
} from '@/types'
import type { Workspace, WorkspacePatch } from '@/types'

const clone = <T,>(x: T): T => structuredClone(x)
// ?slow=3000 adds 3 s to every fixture response, to look at loading states; ?slow=3000&slow_only=cases,runs
// slows only those calls (the api method names), so a page loads and its sub-queries stay pending.
const slowQ = (() => { try { return new URLSearchParams(window.location.search) } catch { return new URLSearchParams() } })()
const SLOW_ONLY = slowQ.get('slow_only')?.split(',')
export const slowFor = (name: string) => (!SLOW_ONLY || SLOW_ONLY.includes(name) ? Number(slowQ.get('slow')) || 0 : 0)
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
  // as in the StudyPDF rehearsal: vision, no page images in the repo, prompt too large to send inline
  ['Page OCR (vision transcription)', 'extraction', 'studypdf', 'lib/pdf/ocr.ts', 88, 'openai/gpt-6-luna', 2, 0],
  // the agent's second pass is still running on these (see AGENT_RECENT): nothing attached yet, cases pending, done
  ['Suggest a study plan', 'generation', 'studypdf', 'lib/plan.ts', 21, 'openai/gpt-4.1-mini', 0, 0],
  ['Rate answer confidence', 'classification', 'studypdf', 'app/api/chat/confidence.ts', 44, 'openai/gpt-4.1-nano', 2, 0],
  ['Turn notes into an outline', 'summarization', 'studypdf', 'lib/outline.ts', 16, 'openai/gpt-4.1-mini', 2, 12],
]

// Overrides for single extras: the OCR one carries the rehearsal's long description and no prompt;
// "Draft a reply" has cases but its prompt is assembled at runtime, so the agent could not attach it.
const NO_PROMPT = new Set(['Page OCR (vision transcription)', 'Draft a reply to a customer', 'Suggest a study plan'])

// Use cases the agent touched moments ago (seconds before page load), so the "setting up" state and the
// scan banner can be seen. ?agent_ago=<minutes> pushes them back in time to see the state after the
// 5-minute window (?agent_ago=6 → "Action required" again).
const AGENT_RECENT: Record<string, number> = { 'Suggest a study plan': 40_000, 'Rate answer confidence': 12_000, 'Turn notes into an outline': 90_000 }
const AGENT_AGO_MS = (() => {
  try { return (Number(new URLSearchParams(window.location.search).get('agent_ago')) || 0) * 60_000 } catch { return 0 }
})()
const loadedAt = Date.now()
const DESCRIPTIONS: Record<string, string> = {
  'Page OCR (vision transcription)':
    'Transcribes each page image of an uploaded PDF into plain text when the PDF has no text layer (scanned books, photographed handouts). ' +
    'Called once per page from the upload pipeline with gpt-6-luna at reasoning medium; the output feeds chunking and every downstream feature, ' +
    'so transcription errors show up later as wrong answers in chat and wrong flashcards. The system prompt is about 9,000 tokens of formatting rules ' +
    '(tables, footnotes, math as LaTeX, two-column layouts, handwriting) and was too large to attach inline. The repo has no sample page images; ' +
    'tests mock the model call. Quality matters more than speed here: a missed line silently breaks a student\'s notes.',
}
// A few templates with several variables, so the case editor shows one field per {{var}}.
const TEMPLATES: Record<string, string> = {
  'Grade a quiz answer': 'Question: {{question}}\nStudent answer: {{answer}}\nRubric: {{rubric}}\nReturn one label: correct, partly_correct or wrong.',
}
const EFFORT: Record<string, string> = { 'openai/gpt-6-luna': 'medium' }

const METRIC_IDS = ['json_schema_valid', 'field_accuracy', 'llm_judge']
const extras: UseCase[] = EXTRAS.map(([name, kind, repo, path, line, model, metrics, cases, run], i) => ({
  id: `00000000-0000-0000-0000-0000000001${String(i).padStart(2, '0')}`,
  workspace_id: '00000000-0000-0000-0000-0000000000a1',
  name,
  kind,
  description: DESCRIPTIONS[name] ?? '',
  source_refs: [{ repo, path, line, symbol: null }],
  current_model: {
    provider: model.startsWith('google/') || model.includes('gpt-6') ? 'openrouter' : 'openai',
    model,
    params: EFFORT[model] ? { reasoning_effort: EFFORT[model] } : {},
  },
  profile: null,
  gates: [],
  metrics: METRIC_IDS.slice(0, metrics).map((metric_id) => ({ metric_id, weight: 1, config: {} })),
  judge: null,
  io_spec: { system_prompt: null, user_template: NO_PROMPT.has(name) ? null : TEMPLATES[name] ?? '{{input}}', response_schema: null, tools: null, params: {} },
  case_count: cases,
  latest_run: run ?? null,
  created_by: 'mcp',
  pinned: false,
  pinned_at: null,
  updated_at: name in AGENT_RECENT ? new Date(loadedAt - AGENT_AGO_MS - AGENT_RECENT[name]).toISOString() : null,
  created_at: name in AGENT_RECENT
    ? new Date(loadedAt - AGENT_AGO_MS - 4 * 60_000).toISOString()
    : new Date(Date.parse('2026-10-24T09:00:00Z') + i * 60_000).toISOString(),
}))

const useCases = [...(clone(useCasesJson) as unknown as UseCase[]), ...extras]
const cases = clone(casesJson) as unknown as Case[]

// A judge metric on "Extract invoice fields" so its run shows the jury (judge null = workspace default jury).
// Case counts follow the cases that actually exist in the fixtures (the contract said 50 for invoices but ships 3).
for (const uc of useCases) {
  const n = cases.filter((c) => c.use_case_id === uc.id).length
  if (n) uc.case_count = n
}
// the extras get placeholder cases, so the page and the list agree on the count
for (const uc of extras) {
  for (let i = 0; i < uc.case_count; i++) {
    cases.push({ id: `${uc.id.slice(0, -3)}${String(i).padStart(3, '0')}-c`, use_case_id: uc.id, input: { vars: { input: `${uc.name}: example ${i + 1}` } }, reference: null, tags: [], source: i % 3 ? 'repo' : 'synthetic' })
  }
}
const invoices = useCases[0]
invoices.metrics = [...invoices.metrics, { metric_id: 'rubric_score', weight: 1, config: {} }]

// ?scan=1 plays a live scan: the list starts empty and gains one use case every 1.5 s, as if a coding
// agent were calling biy_use_cases_create. Only the list endpoint is affected.
let scanStart: number | null = null
function visibleUseCases(): UseCase[] {
  let scan = false
  try { scan = new URLSearchParams(window.location.search).get('scan') === '1' } catch { /* no window */ }
  if (!scan && scanStart == null) return useCases
  scanStart ??= Date.now()
  const n = Math.max(0, Math.floor((Date.now() - scanStart - 4000) / 1500))
  // each use case counts as touched by the agent when it appears, so the scan banner and "Setting up" show
  useCases.slice(0, n).forEach((u, i) => { u.updated_at ??= new Date(scanStart! + 4000 + (i + 1) * 1500).toISOString() })
  return useCases.slice(0, n)
}
// run_done.json carries references, effort and judge agreement. The fixture use case has no judge metric, so
// "Extract invoice fields" gets rubric_score above and the run shows its jury as judged.
const runDone: Run = (() => {
  const run = clone(runDoneJson) as unknown as Run
  run.progress = { ...run.progress, judged: run.progress.total, judge_total: run.progress.total }
  return run
})()
const runRunning = runRunningJson as unknown as Run
const results = clone(resultsJson) as unknown as ResultsPage
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
    candidates: clone(runDone.candidates),
    references: clone(runDone.references),
    progress: { ...runRunning.progress, done, total, errors: f > 0.5 ? 1 : 0, judged: Math.round(done * 0.9), judge_total: total },
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

// The signed-in user; updateWorkspace edits its workspace in memory.
const me = clone(meJson) as unknown as Me

const unslowed: typeof import('./api').api = {
  me: () => wait(me),
  updateWorkspace: async (patch: WorkspacePatch): Promise<Workspace> => {
    Object.assign(me.workspace, patch)
    return wait(me.workspace, 300)
  },
  rotateMcpKey: () => wait({ key: 'biy_fixture_' + Math.random().toString(36).slice(2, 14) }),
  models: () => wait(modelsJson as unknown as CatalogModel[]),
  metrics: () => wait(metricsJson as unknown as MetricInfo[]),
  useCases: () => wait(visibleUseCases()),
  useCase: async (id: string) => wait(findUseCase(id)),
  updateUseCase: async (id: string, patch: UseCasePatch) => {
    const uc = findUseCase(id)
    Object.assign(uc, patch, { updated_at: new Date().toISOString() })
    if (patch.pinned !== undefined) uc.pinned_at = patch.pinned ? new Date().toISOString() : null
    return wait(uc, 250)
  },
  deleteUseCase: async (id: string): Promise<void> => {
    const i = useCases.findIndex((u) => u.id === id)
    if (i < 0) throw new Error('Use case not found')
    useCases.splice(i, 1)
    for (let j = cases.length - 1; j >= 0; j--) if (cases[j].use_case_id === id) cases.splice(j, 1)
    return wait(undefined, 250)
  },
  cases: (id: string) => wait(cases.filter((c) => c.use_case_id === id)),
  updateCase: async (useCaseId: string, caseId: string, patch: CasePatch): Promise<Case> => {
    const c = cases.find((x) => x.id === caseId && x.use_case_id === useCaseId)
    if (!c) throw new Error('Case not found')
    const { input, reference, tags } = patch
    Object.assign(c, input !== undefined ? { input } : {}, 'reference' in patch ? { reference } : {}, tags !== undefined ? { tags } : {}, { updated_at: new Date().toISOString() })
    findUseCase(useCaseId).updated_at = c.updated_at
    return wait(c, 250)
  },
  deleteCase: async (useCaseId: string, caseId: string): Promise<void> => {
    const i = cases.findIndex((x) => x.id === caseId && x.use_case_id === useCaseId)
    if (i < 0) throw new Error('Case not found')
    cases.splice(i, 1)
    findUseCase(useCaseId).case_count = cases.filter((c) => c.use_case_id === useCaseId).length
    return wait(undefined, 200)
  },
  addCases: async (id: string, input: CaseIn[]): Promise<Case[]> => {
    const uc = findUseCase(id)
    const now = new Date().toISOString()
    const added: Case[] = input.map((c) => ({
      id: crypto.randomUUID(), use_case_id: id, input: c.input, reference: c.reference ?? null, tags: c.tags ?? [], source: c.source ?? 'upload', updated_at: now,
    }))
    cases.push(...added)
    uc.case_count = cases.filter((c) => c.use_case_id === id).length
    uc.updated_at = now
    return wait(added, 400)
  },
  generateCases: async (id: string, body: GenerateCasesIn = {}): Promise<Case[]> => {
    const n = body.n ?? 20
    return fixtureApi.addCases(id, Array.from({ length: n }, (_, i) => ({ input: { vars: { input: `Synthetic example ${i + 1}` } }, source: 'synthetic' as const, tags: ['synthetic'] })))
  },
  runs: async (id: string): Promise<RunBrief[]> => {
    const uc = findUseCase(id)
    return wait(uc.latest_run ? [uc.latest_run] : [])
  },
  // Echoes what the run would use after inheritance, and applies the workspace cap like the API.
  estimate: (req: RunIn) => {
    const base = estimateJson as unknown as Estimate
    const w = me.workspace
    const auto = (modelsJson as unknown as CatalogModel[]).filter((m) => m.shortlist && m.role !== 'baseline' && !w.candidate_pool?.exclude_providers?.includes(m.provider))
      .slice(0, 4).map((m) => ({ provider: m.provider, model: m.id, params: m.provider === 'openrouter' && m.verified.reasoning ? { reasoning_effort: 'medium' } : {} }))
    const candidates = req.candidates?.length ? req.candidates : auto
    const references = req.include_references === false ? [] : req.references ?? w.default_references ?? []
    const repeats = req.repeats ?? w.default_repeats ?? 3
    const scale = ((candidates.length + references.length) * repeats) / (5 * 3)
    const total = +(base.total_usd * scale + references.length * 0.6 * (repeats / 3)).toFixed(2)
    const cap = w.max_run_cost_usd ?? null
    return wait({
      ...base, calls: Math.round(base.calls * scale), est_cost_usd: total, total_usd: total,
      candidates, references, repeats, max_run_cost_usd: cap, over_cap: cap != null && total > cap,
    }, 500)
  },
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
    // finished runs of the extra use cases replay the finished fixture instead of starting a playback
    if (uc && !started.has(id) && uc.latest_run?.status === 'done') return wait({ ...clone(runDone), id, use_case_id: uc.id })
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
    wait(results),
}

export const fixtureApi = Object.fromEntries(Object.entries(unslowed).map(([name, fn]) => [name, async (...args: unknown[]) => {
  const res = await (fn as (...a: unknown[]) => Promise<unknown>)(...args)
  const ms = slowFor(name)
  if (ms) await new Promise((r) => setTimeout(r, ms))
  return res
}])) as typeof unslowed
