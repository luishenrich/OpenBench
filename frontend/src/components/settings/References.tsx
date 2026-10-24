// Closed models every run also measures, for comparison only. Never ranked or recommended.
import type { ModelRef } from '@/types'
import { ModelIcon } from '@/components/ModelIcon'
import { EFFORTS, REFERENCE_CHOICES, modelLabel, sameModel } from './defaults'

const selectCls = 'rounded-md border border-line bg-bg px-2 py-1 text-xs text-muted hover:border-line-strong focus:outline-none'

export function References({ value, onChange }: { value: ModelRef[]; onChange: (v: ModelRef[]) => void }) {
  const missing = REFERENCE_CHOICES.filter((c) => !value.some((v) => sameModel(v, c)))
  const setEffort = (i: number, effort: string) =>
    onChange(value.map((m, j) => (j === i ? { ...m, params: { ...m.params, reasoning_effort: effort } } : m)))

  return (
    <div>
      {value.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
          {value.map((m, i) => {
            const label = modelLabel(m.model)
            const effort = typeof m.params?.reasoning_effort === 'string' ? (m.params.reasoning_effort as string) : 'medium'
            return (
              // On a phone the controls wrap under the name instead of squeezing it to "GPT-6…"
              <li key={`${m.provider}:${m.model}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                <div className="flex min-w-[12rem] flex-1 items-center gap-3">
                  <ModelIcon model={m.model} size={16} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-fg">{label}</div>
                    <div className="truncate font-mono text-[11px] text-faint">{m.provider}:{m.model}</div>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {i === 0 && value.length > 1 && <span className="hidden text-xs text-faint lg:inline">Pairwise opponent</span>}
                  <select aria-label={`Reasoning effort for ${label}`} value={effort} onChange={(e) => setEffort(i, e.target.value)} className={selectCls}>
                    {EFFORTS.map((e) => <option key={e} value={e}>Reasoning {e}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((_, j) => j !== i))}
                    className="rounded-md px-2 py-1 text-xs text-muted hover:bg-raised hover:text-fg"
                    aria-label={`Remove ${label}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3.5 py-3 text-sm text-muted">
          No references. Runs will rank open models without a closed-model baseline.
        </p>
      )}
      {missing.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-faint">Add</span>
          {missing.map((m) => (
            <button
              key={m.model}
              type="button"
              onClick={() => onChange([...value, structuredClone(m)])}
              className="inline-flex items-center gap-2 rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:border-line-strong hover:text-fg"
            >
              <ModelIcon model={m.model} size={12} />
              {modelLabel(m.model)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
