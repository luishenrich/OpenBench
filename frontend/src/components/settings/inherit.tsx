// Use cases inherit their profile, judge and references from the workspace and override only what differs.
// In the contract, UseCase.profile = null and UseCase.judge = null mean "use the workspace default".
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { JudgeConfig, Me, ModelRef, Profile, UseCase } from '@/types'
import { DEFAULT_REFERENCES } from './defaults'

export type Source = 'workspace' | 'custom'
export interface Inherited<T> { value: T; source: Source }
export interface Effective {
  /** Weights and targets the run scores against. */
  profile: Inherited<Profile>
  /** The jury that grades outputs. */
  judge: Inherited<JudgeConfig>
  /** Closed comparison models. Use cases can't override these yet, so the source is always 'workspace'. */
  references: Inherited<ModelRef[]>
}

/** Pure version of useEffective. Returns null until both the use case and the workspace are loaded. */
export function effective(useCase: UseCase | null | undefined, me: Me | null | undefined): Effective | null {
  if (!useCase || !me) return null
  const w = me.workspace
  return {
    profile: useCase.profile ? { value: useCase.profile, source: 'custom' } : { value: w.default_profile, source: 'workspace' },
    judge: useCase.judge ? { value: useCase.judge, source: 'custom' } : { value: w.default_judge, source: 'workspace' },
    references: { value: w.default_references ?? DEFAULT_REFERENCES, source: 'workspace' },
  }
}

/**
 * The settings a use case actually runs with, and where each one comes from.
 *
 *   const me = useQuery({ queryKey: ['me'], queryFn: api.me })
 *   const eff = useEffective(uc.data, me.data)
 *   eff?.profile.value   // what to show and score against
 *   eff?.profile.source  // 'workspace' (profile is null) or 'custom'
 */
export function useEffective(useCase: UseCase | null | undefined, me: Me | null | undefined): Effective | null {
  return useMemo(() => effective(useCase, me), [useCase, me])
}

export interface InheritBadgeProps {
  /** 'workspace': shows "Inherited from workspace" with a link to /settings. 'custom': shows "Custom · Reset". */
  source: Source
  /** Called by Reset. Usually `api.updateUseCase(id, { profile: null })` (or `{ judge: null }`), then invalidate the use case. */
  onReset?: () => void
  /** Disables Reset while the reset request is in flight. */
  resetting?: boolean
  className?: string
}

/** Small inline marker next to a use-case setting: inherited from the workspace, or overridden here. */
export function InheritBadge({ source, onReset, resetting = false, className = '' }: InheritBadgeProps) {
  if (source === 'workspace') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-faint ${className}`}>
        <span aria-hidden className="size-1.5 rounded-[1px] bg-line-strong" />
        Inherited from{' '}
        <Link to="/settings" className="text-muted underline decoration-line-strong underline-offset-2 hover:text-fg">workspace</Link>
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-muted ${className}`}>
      <span aria-hidden className="size-1.5 rounded-[1px] bg-front" />
      Custom
      {onReset && (
        <>
          <span aria-hidden className="text-faint">·</span>
          <button
            type="button"
            onClick={onReset}
            disabled={resetting}
            title="Use the workspace default again"
            className="text-muted underline decoration-line-strong underline-offset-2 hover:text-fg disabled:cursor-wait disabled:text-faint"
          >
            {resetting ? 'Resetting…' : 'Reset'}
          </button>
        </>
      )}
    </span>
  )
}
