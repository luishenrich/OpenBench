import type { UseCase, UseCaseKind } from '@/types'

// Where a use case is in its life, derived from existing fields (no contract change).
// 'setup' = the coding agent is still attaching prompt, metrics and cases (see isAgentSettingUp);
// 'metrics' = the agent went quiet before choosing metrics;
// 'data' = needs input only the user can give (page images, the full prompt); 'cases' = the agent can still add them.
export type SetupState = 'setup' | 'metrics' | 'data' | 'cases' | 'ready' | 'running' | 'done' | 'failed'

const VISION_WORDS = /\b(vision|ocr|images?|photos?|screenshots?|scanned|page scans?)\b/i

/** Image input: cases carry images, or the use case says it reads images. */
export function isVision(uc: Pick<UseCase, 'kind' | 'name' | 'description'>, cases?: { input: { images?: string[] } }[]): boolean {
  if (cases?.some((c) => (c.input.images?.length ?? 0) > 0)) return true
  return VISION_WORDS.test(`${uc.name} ${uc.description}`)
}

export const promptAttached = (uc: UseCase) => !!(uc.io_spec?.system_prompt || uc.io_spec?.user_template)

/** What only the user can supply right now, or null. */
export function needsData(uc: UseCase, cases?: { input: { images?: string[] } }[]): { images: boolean; prompt: boolean } | null {
  const images = uc.case_count === 0 && isVision(uc, cases)
  const prompt = !promptAttached(uc)
  return images || prompt ? { images, prompt } : null
}

// --- the agent is still setting it up ------------------------------------------------------------
// A coding agent creates use cases over MCP in two passes: light fields first (name, kind, call site, model),
// then prompt, metrics/gates and cases one use case at a time. Until the second pass reaches a use case it
// looks unfinished, which is not the user's fault. There is no explicit flag yet, so it is inferred:
//   created over MCP, setup incomplete (no prompt, no metrics or no cases), last change under 5 minutes ago.
// TODO(backend): the API will send an explicit UseCase.setup_state; when present it wins over the inference.
export const AGENT_WINDOW_MS = 5 * 60_000

/** When the use case (or one of its cases) last changed, in ms. */
export const lastChangeAt = (uc: Pick<UseCase, 'updated_at' | 'created_at'>) => Date.parse(uc.updated_at || uc.created_at) || 0

export const setupIncomplete = (uc: UseCase) => !promptAttached(uc) || uc.metrics.length === 0 || uc.case_count === 0

/** The coding agent is still attaching prompt, metrics or cases to this use case. */
export function isAgentSettingUp(uc: UseCase, now = Date.now()): boolean {
  if (uc.setup_state === 'in_progress') return true
  if (uc.setup_state === 'complete') return false
  if (uc.created_by !== 'mcp' || uc.latest_run) return false
  return setupIncomplete(uc) && now - lastChangeAt(uc) < AGENT_WINDOW_MS
}

/** The agent touched this use case within the window (complete or not): a scan is going on. */
export const agentTouchedRecently = (uc: UseCase, now = Date.now()) =>
  uc.setup_state === 'in_progress' || (uc.created_by === 'mcp' && now - lastChangeAt(uc) < AGENT_WINDOW_MS)

/** "12s ago", "3 min ago" */
export function sinceLabel(t: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return `${Math.round(s / 3600)} h ago`
}

export function setupState(uc: UseCase, now = Date.now()): SetupState {
  const s = uc.latest_run?.status
  if (s === 'done') return 'done'
  if (s === 'queued' || s === 'running' || s === 'scoring') return 'running'
  if (s === 'failed' || s === 'cancelled') return 'failed'
  if (isAgentSettingUp(uc, now)) return 'setup'
  // metrics come last in the agent's setup: still none after the agent went quiet
  if (uc.metrics.length === 0) return 'metrics'
  if (needsData(uc)) return 'data'
  if (uc.case_count === 0) return 'cases'
  return 'ready'
}

export const stateLabel: Record<SetupState, string> = {
  setup: 'Setting up',
  metrics: 'No metrics yet',
  data: 'Needs data',
  cases: 'Collecting cases',
  ready: 'Ready to benchmark',
  running: 'Running',
  done: 'Benchmarked',
  failed: 'Failed',
}

// Short words for the section summary
export const stateShort: Record<SetupState, string> = {
  done: 'benchmarked', running: 'running', failed: 'failed', ready: 'ready', data: 'need data', cases: 'collecting cases', setup: 'setting up', metrics: 'no metrics',
}

export const stateDot: Record<SetupState, string> = {
  setup: 'bg-win/70',
  metrics: 'bg-line-strong',
  data: 'bg-front',
  cases: 'bg-muted',
  ready: 'bg-fg/60',
  running: 'bg-signal',
  done: 'bg-win',
  failed: 'bg-bad',
}

export const STATE_ORDER: SetupState[] = ['data', 'done', 'running', 'failed', 'ready', 'cases', 'metrics', 'setup']

// Fixed order keeps sections from jumping around while a scan adds use cases.
const KIND_ORDER: UseCaseKind[] = ['chat', 'agent', 'rag', 'extraction', 'classification', 'summarization', 'generation', 'batch', 'other']

export const kindLabel: Record<UseCaseKind, string> = {
  chat: 'Chat', agent: 'Agents', rag: 'Retrieval (RAG)', extraction: 'Extraction', classification: 'Classification',
  summarization: 'Summarization', generation: 'Generation', batch: 'Batch jobs', other: 'Other',
}

export interface KindGroup { key: string; kind: UseCaseKind | null; items: UseCase[] }
export interface ProjectGroup { key: string; name: string; items: UseCase[]; pinned: UseCase[]; kinds: KindGroup[] }

export type SortKey = 'attention' | 'recent' | 'name' | 'savings'
export const sortLabel: Record<SortKey, string> = { attention: 'Needs attention first', recent: 'Recently found', name: 'Name', savings: 'Savings' }
// needs data → failed → no metrics → setting up → collecting cases → ready → running → done
const ATTENTION: Record<SetupState, number> = { data: 0, failed: 1, metrics: 2, setup: 3, cases: 4, ready: 5, running: 6, done: 7 }
const savingOf = (u: UseCase) => (u.latest_run?.status === 'done' ? u.latest_run.est_monthly_savings_usd ?? 0 : 0)
const byPath = (a: UseCase, b: UseCase) => {
  const pa = a.source_refs[0]?.path ?? '', pb = b.source_refs[0]?.path ?? ''
  return pa.localeCompare(pb) || (a.source_refs[0]?.line ?? 0) - (b.source_refs[0]?.line ?? 0) || a.name.localeCompare(b.name)
}
export const SORTS: Record<SortKey, (a: UseCase, b: UseCase) => number> = {
  attention: (a, b) => ATTENTION[setupState(a)] - ATTENTION[setupState(b)] || byPath(a, b),
  recent: (a, b) => b.created_at.localeCompare(a.created_at) || byPath(a, b),
  name: (a, b) => a.name.localeCompare(b.name),
  savings: (a, b) => savingOf(b) - savingOf(a) || byPath(a, b),
}

export const projectOf = (uc: UseCase, fallbackName: string) => uc.source_refs[0]?.repo?.trim() || fallbackName

export function groupUseCases(list: UseCase[], fallbackName: string, opts: { sort?: SortKey; flat?: boolean; isPinned?: (u: UseCase) => boolean } = {}): ProjectGroup[] {
  const cmp = SORTS[opts.sort ?? 'attention']
  const pinnedFn = opts.isPinned ?? (() => false)
  const projects = new Map<string, UseCase[]>()
  for (const uc of list) {
    const name = projectOf(uc, fallbackName)
    projects.set(name, [...(projects.get(name) ?? []), uc])
  }
  return [...projects.entries()]
    // discovery order, so a project never jumps while a scan is running
    .map(([name, items]) => {
      const pinned = items.filter(pinnedFn).sort(cmp)
      const rest = items.filter((u) => !pinnedFn(u))
      const kinds: KindGroup[] = opts.flat
        ? [{ key: `${name}::all`, kind: null, items: [...rest].sort(cmp) }].filter((k) => k.items.length > 0)
        : KIND_ORDER.map((kind) => ({ key: `${name}::${kind}`, kind, items: rest.filter((u) => u.kind === kind).sort(cmp) })).filter((k) => k.items.length > 0)
      return { key: name, name, items, pinned, kinds }
    })
}

export function countStates(items: UseCase[], now = Date.now()): Record<SetupState, number> {
  const c: Record<SetupState, number> = { setup: 0, metrics: 0, data: 0, cases: 0, ready: 0, running: 0, done: 0, failed: 0 }
  for (const u of items) c[setupState(u, now)]++
  return c
}

/** Set up = nothing left to attach: ready, or already benchmarked. */
export const isSetUp = (s: SetupState) => s === 'ready' || s === 'running' || s === 'done' || s === 'failed'

export interface ScanActivity { projects: string[]; total: number; setUp: number; lastChange: number }
/** A workspace scan is in progress when the agent touched any use case within the window. Counts cover the
 *  projects it touched. null when it has been quiet for the whole window. */
export function scanActivity(list: UseCase[], fallbackName: string, now = Date.now()): ScanActivity | null {
  const touched = list.filter((u) => agentTouchedRecently(u, now))
  if (!touched.length) return null
  const projects = [...new Set(touched.map((u) => projectOf(u, fallbackName)))]
  const inScope = list.filter((u) => projects.includes(projectOf(u, fallbackName)))
  return {
    projects,
    total: inScope.length,
    setUp: inScope.filter((u) => isSetUp(setupState(u, now))).length,
    lastChange: Math.max(...touched.map(lastChangeAt)),
  }
}

export const savingsOf = (items: UseCase[]) =>
  items.reduce((s, u) => s + (u.latest_run?.status === 'done' ? u.latest_run.est_monthly_savings_usd ?? 0 : 0), 0)
