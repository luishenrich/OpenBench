import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { Profile } from '@/types'

// One bar split into quality | speed | cost. The two handles are the borders, so the parts always sum to 100.
const SEGMENTS = [
  { key: 'quality', label: 'Quality', hint: 'metric scores on your cases', color: 'bg-fg' },
  { key: 'speed', label: 'Speed', hint: 'latency against your target', color: 'bg-signal' },
  { key: 'cost', label: 'Cost', hint: 'price per call against your target', color: 'bg-front' },
] as const

const STEP = 5
const snap = (v: number) => Math.max(0, Math.min(100, Math.round(v / STEP) * STEP))

export default function Weights({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const bar = useRef<HTMLDivElement>(null)
  const drag = useRef<0 | 1 | null>(null)
  const { quality: q, speed: s } = profile.weights
  const cuts = [q, q + s] // handle positions in %

  function set(handle: 0 | 1, pos: number) {
    const p = snap(pos)
    const [a, b] = handle === 0 ? [Math.min(p, cuts[1]), cuts[1]] : [cuts[0], Math.max(p, cuts[0])]
    onChange({ ...profile, weights: { quality: a, speed: b - a, cost: 100 - b } })
  }

  function posFrom(e: PointerEvent) {
    const r = bar.current!.getBoundingClientRect()
    return ((e.clientX - r.left) / r.width) * 100
  }

  function onKey(handle: 0 | 1, e: KeyboardEvent) {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? STEP : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -STEP : 0
    if (d) {
      e.preventDefault()
      set(handle, cuts[handle] + d)
    }
  }

  const values = [q, s, profile.weights.cost]
  return (
    <div>
      <div
        ref={bar}
        className="relative h-11 touch-none select-none"
        onPointerMove={(e) => { if (drag.current !== null) set(drag.current, posFrom(e)) }}
        onPointerUp={() => { drag.current = null }}
        onPointerLeave={() => { drag.current = null }}
      >
        <div className="absolute inset-x-0 top-3.5 flex h-4 overflow-hidden rounded-[4px]">
          {SEGMENTS.map((seg, i) => (
            <div key={seg.key} className={`${seg.color} h-full transition-[width] duration-75`} style={{ width: `${values[i]}%`, opacity: 0.85 }} />
          ))}
        </div>
        {/* ruler ticks every 10 % */}
        <div className="absolute inset-x-0 top-9 flex justify-between">
          {Array.from({ length: 11 }, (_, i) => <span key={i} className={`w-px ${i % 5 ? 'h-1 bg-line-strong' : 'h-2 bg-faint'}`} />)}
        </div>
        {([0, 1] as const).map((h) => (
          <button
            key={h}
            type="button"
            role="slider"
            aria-label={h === 0 ? 'Border between quality and speed' : 'Border between speed and cost'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={cuts[h]}
            onPointerDown={(e) => { drag.current = h; (e.target as HTMLElement).setPointerCapture?.(e.pointerId) }}
            onPointerMove={(e) => { if (drag.current === h) set(h, posFrom(e)) }}
            onPointerUp={() => { drag.current = null }}
            onKeyDown={(e) => onKey(h, e)}
            className="absolute top-1 h-9 w-3 -translate-x-1/2 cursor-ew-resize rounded-[3px] border border-bg bg-white shadow-[0_0_0_1px_var(--color-line-strong)]"
            style={{ left: `${cuts[h]}%` }}
          />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-4">
        {SEGMENTS.map((seg, i) => (
          <div key={seg.key}>
            <dt className="flex items-center gap-2 text-sm">
              <span className={`size-2 rounded-[2px] ${seg.color}`} />{seg.label}
            </dt>
            <dd className="title mt-1 text-3xl">{values[i]}</dd>
            <dd className="text-xs text-faint">{seg.hint}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
