import type { UseCase, UseCaseKind } from '@/types'

// Where a use case is in its life, derived from existing fields (no contract change).
// 'data' = needs input only the user can give (page images, the full prompt); 'cases' = the agent can still add them.
export type SetupState = 'setup' | 'data' | 'cases' | 'ready' | 'running' | 'done' | 'failed'

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

export function setupState(uc: UseCase): SetupState {
  const s = uc.latest_run?.status
  if (s === 'done') return 'done'
  if (s === 'queued' || s === 'running' || s === 'scoring') return 'running'
  if (s === 'failed' || s === 'cancelled') return 'failed'
  // metrics come last in the agent's setup, so an empty list means it is still working on this one
  if (uc.metrics.length === 0) return 'setup'
  if (needsData(uc)) return 'data'
  if (uc.case_count === 0) return 'cases'
  return 'ready'
}

export const stateLabel: Record<SetupState, string> = {
  setup: 'Setting up',
  data: 'Needs data',
  cases: 'Collecting cases',
  ready: 'Ready to benchmark',
  running: 'Running',
  done: 'Benchmarked',
  failed: 'Failed',
}

// Short words for the section summary
export const stateShort: Record<SetupState, string> = {
  done: 'benchmarked', running: 'running', failed: 'failed', ready: 'ready', data: 'need data', cases: 'collecting cases', setup: 'setting up',
}

export const stateDot: Record<SetupState, string> = {
  setup: 'bg-line-strong',
  data: 'bg-front',
  cases: 'bg-muted',
  ready: 'bg-fg/60',
  running: 'bg-signal',
  done: 'bg-win',
  failed: 'bg-bad',
}

export const STATE_ORDER: SetupState[] = ['data', 'done', 'running', 'failed', 'ready', 'cases', 'setup']

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
// needs data → failed → setting up → collecting cases → ready → running → done
const ATTENTION: Record<SetupState, number> = { data: 0, failed: 1, setup: 2, cases: 3, ready: 4, running: 5, done: 6 }
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

export function countStates(items: UseCase[]): Record<SetupState, number> {
  const c: Record<SetupState, number> = { setup: 0, data: 0, cases: 0, ready: 0, running: 0, done: 0, failed: 0 }
  for (const u of items) c[setupState(u)]++
  return c
}

export const savingsOf = (items: UseCase[]) =>
  items.reduce((s, u) => s + (u.latest_run?.status === 'done' ? u.latest_run.est_monthly_savings_usd ?? 0 : 0), 0)
