// The default jury. Jurors are read-only here (they come from the backend); the mode can change.
import type { JudgeConfig } from '@/types'
import { ModelIcon } from '@/components/ModelIcon'
import { makerOf } from '@/lib/modelMakers'
import { modelLabel } from './defaults'

const MODES: { key: JudgeConfig['mode']; label: string; hint: string }[] = [
  { key: 'rubric', label: 'Rubric', hint: 'Each juror scores every output against the rubric. The score is the mean.' },
  { key: 'pairwise', label: 'Pairwise', hint: 'Jurors compare each output with the first reference, in both orders. A win needs every juror to agree.' },
]

// The default third juror (contract JudgeConfig): a third family, so every output keeps two votes.
// Shown as planned only when a jury still has fewer than three jurors.
const PLANNED = { model: 'MiniMaxAI/MiniMax-M3.1-Flash', label: 'MiniMax-M3.1-Flash' }

export function Jury({ value, onChange }: { value: JudgeConfig; onChange: (v: JudgeConfig) => void }) {
  const planned = value.judges.length < 3 && !value.judges.some((j) => j.model.toLowerCase().includes('minimax'))
  return (
    <div className="space-y-5">
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
        {value.judges.map((j) => {
          const effort = typeof j.params?.reasoning_effort === 'string' ? `Reasoning ${j.params.reasoning_effort}` : 'Provider default'
          return (
            <li key={`${j.provider}:${j.model}`} className="flex items-center gap-3 px-3.5 py-2.5">
              <ModelIcon model={j.model} size={16} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-fg">{modelLabel(j.model)}</div>
                <div className="truncate text-[11px] text-faint">{makerOf(j.model).name} · via {j.provider === 'nebius' ? 'Nebius' : 'OpenRouter'}</div>
              </div>
              <span className="text-xs text-muted">{effort}</span>
            </li>
          )
        })}
        {planned && (
          <li className="flex items-center gap-3 px-3.5 py-2.5 opacity-60">
            <ModelIcon model={PLANNED.model} size={16} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-muted">{PLANNED.label}</div>
              <div className="truncate text-[11px] text-faint">{makerOf(PLANNED.model).name} · joins with the next backend update</div>
            </div>
            <span className="text-xs text-faint">Planned</span>
          </li>
        )}
      </ul>

      <div>
        <div className="mb-2 text-sm text-fg">Mode</div>
        <div role="radiogroup" aria-label="Judging mode" className="grid gap-2 sm:grid-cols-2">
          {MODES.map((m) => {
            const on = value.mode === m.key
            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange({ ...value, mode: m.key })}
                className={`flex flex-col items-start justify-start rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                  on ? 'border-fg/40 bg-raised' : 'border-line hover:border-line-strong'
                }`}
              >
                <div className={`flex items-center gap-2 text-sm ${on ? 'text-fg' : 'text-muted'}`}>
                  <span className={`size-2 rounded-full border ${on ? 'border-front bg-front' : 'border-line-strong'}`} />
                  {m.label}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-faint">{m.hint}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
