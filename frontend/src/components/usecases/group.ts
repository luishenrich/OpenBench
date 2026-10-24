import type { UseCase, UseCaseKind } from '@/types'

// Where a use case is in its life, derived from existing fields (no contract change).
export type SetupState = 'setup' | 'cases' | 'ready' | 'running' | 'done' | 'failed'

export function setupState(uc: UseCase): SetupState {
  const s = uc.latest_run?.status
  if (s === 'done') return 'done'
  if (s === 'queued' || s === 'running' || s === 'scoring') return 'running'
  if (s === 'failed' || s === 'cancelled') return 'failed'
  if (uc.metrics.length === 0) return 'setup'
  if (uc.case_count === 0) return 'cases'
  return 'ready'
}

export const stateLabel: Record<SetupState, string> = {
  setup: 'Setting up',
  cases: 'Collecting cases',
  ready: 'Ready to benchmark',
  running: 'Running',
  done: 'Benchmarked',
  failed: 'Failed',
}

// Short words for the section summary
export const stateShort: Record<SetupState, string> = {
  done: 'benchmarked', running: 'running', failed: 'failed', ready: 'ready', cases: 'collecting cases', setup: 'setting up',
}

export const stateDot: Record<SetupState, string> = {
  setup: 'bg-line-strong',
  cases: 'bg-muted',
  ready: 'bg-front',
  running: 'bg-signal',
  done: 'bg-win',
  failed: 'bg-bad',
}

export const STATE_ORDER: SetupState[] = ['done', 'running', 'failed', 'ready', 'cases', 'setup']

// Fixed order keeps sections from jumping around while a scan adds use cases.
const KIND_ORDER: UseCaseKind[] = ['chat', 'agent', 'rag', 'extraction', 'classification', 'summarization', 'generation', 'batch', 'other']

export const kindLabel: Record<UseCaseKind, string> = {
  chat: 'Chat', agent: 'Agents', rag: 'Retrieval (RAG)', extraction: 'Extraction', classification: 'Classification',
  summarization: 'Summarization', generation: 'Generation', batch: 'Batch jobs', other: 'Other',
}

export interface KindGroup { key: string; kind: UseCaseKind; items: UseCase[] }
export interface ProjectGroup { key: string; name: string; items: UseCase[]; kinds: KindGroup[] }

const byPath = (a: UseCase, b: UseCase) => {
  const pa = a.source_refs[0]?.path ?? '', pb = b.source_refs[0]?.path ?? ''
  return pa.localeCompare(pb) || (a.source_refs[0]?.line ?? 0) - (b.source_refs[0]?.line ?? 0) || a.name.localeCompare(b.name)
}

export function groupUseCases(list: UseCase[], fallbackName: string): ProjectGroup[] {
  const projects = new Map<string, UseCase[]>()
  for (const uc of list) {
    const name = uc.source_refs[0]?.repo?.trim() || fallbackName
    projects.set(name, [...(projects.get(name) ?? []), uc])
  }
  return [...projects.entries()]
    // discovery order, so a project never jumps while a scan is running
    .map(([name, items]) => ({
      key: name,
      name,
      items,
      kinds: KIND_ORDER.map((kind) => ({
        key: `${name}::${kind}`,
        kind,
        items: items.filter((u) => u.kind === kind).sort(byPath),
      })).filter((k) => k.items.length > 0),
    }))
}

export function countStates(items: UseCase[]): Record<SetupState, number> {
  const c: Record<SetupState, number> = { setup: 0, cases: 0, ready: 0, running: 0, done: 0, failed: 0 }
  for (const u of items) c[setupState(u)]++
  return c
}

export const savingsOf = (items: UseCase[]) =>
  items.reduce((s, u) => s + (u.latest_run?.status === 'done' ? u.latest_run.est_monthly_savings_usd ?? 0 : 0), 0)
