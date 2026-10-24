import { isVision, lastChangeAt, needsData, promptAttached, setupState } from '@/components/usecases/group'
import type { Case, UseCase } from '@/types'

export type StepStatus = 'ok' | 'warn' | 'block' | 'wait'
export interface Step { key: string; label: string; status: StepStatus; detail: string }

const JUDGE_METRICS = new Set(['rubric_score', 'pairwise_vs_baseline'])
export const hasJudgeMetric = (uc: UseCase) => uc.metrics.some((m) => JUDGE_METRICS.has(m.metric_id)) || uc.gates.some((g) => JUDGE_METRICS.has(g.metric_id))

export const promptTooLarge = (uc: UseCase) => /too (large|long|big)|tokens? of|not attached/i.test(uc.description)

export interface Readiness {
  steps: Step[]; ready: boolean; blocked: string | null; vision: boolean
  /** the coding agent is still attaching things (isAgentSettingUp): nothing is the user's job yet */
  settingUp: boolean
  lastChange: number
}

const AGENT_ADDING = 'Agent is adding…'

/** Same order and same rules as the status in the use-case list (components/usecases/group.ts). */
export function readiness(uc: UseCase, cases?: Case[], now = Date.now()): Readiness {
  const vision = isVision(uc, cases)
  const state = setupState(uc, now)
  const settingUp = state === 'setup'
  const refs = uc.source_refs
  const first = refs[0]
  const count = cases?.length ?? uc.case_count

  const steps: Step[] = [
    {
      key: 'site', label: 'Call site',
      status: refs.length ? 'ok' : 'warn',
      detail: first ? `${first.path}${first.line ? `:${first.line}` : ''}${refs.length > 1 ? ` +${refs.length - 1} more` : ''}` : 'Not linked to code',
    },
    {
      key: 'prompt', label: 'Prompt',
      status: promptAttached(uc) ? 'ok' : settingUp ? 'wait' : 'block',
      detail: promptAttached(uc) ? (uc.io_spec.system_prompt ? 'System prompt attached' : 'Template attached')
        : settingUp ? AGENT_ADDING : promptTooLarge(uc) ? 'Not attached: too large to send inline' : 'Not attached',
    },
    {
      key: 'metrics', label: 'Metrics and gates',
      status: uc.metrics.length === 0 ? 'wait' : uc.gates.length === 0 ? 'warn' : 'ok',
      detail: uc.metrics.length === 0
        ? settingUp ? AGENT_ADDING : 'Not chosen yet: ask your agent'
        : `${uc.metrics.length} ${uc.metrics.length === 1 ? 'metric' : 'metrics'}, ${uc.gates.length ? `${uc.gates.length} ${uc.gates.length === 1 ? 'gate' : 'gates'}` : 'no gates yet'}`,
    },
    {
      key: 'cases', label: 'Test cases',
      status: count > 0 ? 'ok' : settingUp ? 'wait' : vision ? 'block' : 'wait',
      detail: count > 0 ? `${count} ${count === 1 ? 'case' : 'cases'}` : settingUp ? AGENT_ADDING : vision ? 'Needs page images; none in the repo' : 'Needs test cases',
    },
  ]

  const blocked =
    settingUp ? 'Your agent is still setting this up.'
      : state === 'metrics' ? 'Waiting for your agent to choose metrics.'
      : needsData(uc, cases)?.images ? 'Add page images first: the repo has none to test with.'
        : needsData(uc, cases)?.prompt ? 'Waiting for the full prompt from your coding agent.'
          : count === 0 ? 'Add test cases first.'
            : null
  const ready = blocked === null
  steps.push({ key: 'ready', label: 'Ready', status: ready ? 'ok' : 'wait', detail: ready ? 'Ready to benchmark' : 'Not yet' })
  return { steps, ready, blocked, vision, settingUp, lastChange: lastChangeAt(uc) }
}
