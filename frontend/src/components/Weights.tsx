import type { Profile } from '@/types'
import TrianglePicker from '@/components/weights/TrianglePicker'
import { AXES, PRESETS, describe, sameMix, type Mix } from '@/components/weights/mix'

// How much quality, speed and cost matter. Three weights that always sum to 100, picked on a triangle.
export default function Weights({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const mix = profile.weights
  const set = (m: Mix) => onChange({ ...profile, weights: m })

  return (
    <div className="grid items-center gap-x-10 gap-y-6 md:grid-cols-[minmax(0,280px)_1fr]">
      <div className="mx-auto w-full max-w-[280px]">
        <TrianglePicker mix={mix} onChange={set} />
        <p className="mt-1 text-center text-xs text-faint">Drag the dot, or focus it and use the arrow keys</p>
      </div>

      <div className="min-w-0 space-y-6">
        <div>
          <div className="mb-2 text-xs text-faint">Presets</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const on = sameMix(p.mix, mix)
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={on}
                  title={`Quality ${p.mix.quality} · Speed ${p.mix.speed} · Cost ${p.mix.cost}`}
                  onClick={() => { if (!on) set(p.mix) }}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    on ? 'border-fg/70 bg-raised text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        <p className="title text-lg leading-snug text-fg" aria-live="polite">{describe(mix)}</p>

        <dl className="grid grid-cols-3 gap-4 border-t border-line pt-4">
          {AXES.map((a) => (
            <div key={a.key} className="min-w-0">
              <dt className="flex items-center gap-2 text-sm text-muted">
                <span className={`size-2 rounded-[2px] ${a.dot}`} />{a.label}
              </dt>
              <dd className="title mt-0.5 text-2xl tabular-nums">{mix[a.key]}</dd>
              <dd className="text-xs leading-snug text-faint">{a.hint}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
