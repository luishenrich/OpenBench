import type { Axis } from '@/types'

export type Mix = Record<Axis, number>

export const AXES = [
  { key: 'quality', label: 'Quality', hint: 'metric scores on your cases', color: 'var(--color-fg)', dot: 'bg-fg' },
  { key: 'speed', label: 'Speed', hint: 'latency against your target', color: 'var(--color-signal)', dot: 'bg-signal' },
  { key: 'cost', label: 'Cost', hint: 'price per call against your target', color: 'var(--color-front)', dot: 'bg-front' },
] as const

export const PRESETS: { label: string; mix: Mix }[] = [
  { label: 'Balanced', mix: { quality: 60, speed: 20, cost: 20 } },
  { label: 'Quality first', mix: { quality: 80, speed: 10, cost: 10 } },
  { label: 'Real-time chat', mix: { quality: 50, speed: 40, cost: 10 } },
  { label: 'Cheap batch', mix: { quality: 40, speed: 0, cost: 60 } },
  { label: 'Fast and cheap', mix: { quality: 30, speed: 35, cost: 35 } },
]

export const STEP = 5
const UNITS = 100 / STEP

export const sameMix = (a: Mix, b: Mix) => a.quality === b.quality && a.speed === b.speed && a.cost === b.cost

/** Fractions (any sign, any sum) -> integer weights on the 5-step lattice that sum to 100 (largest remainder). */
export function snap(f: Mix): Mix {
  const keys: Axis[] = ['quality', 'speed', 'cost']
  const clamped = keys.map((k) => Math.max(0, f[k]))
  const total = clamped.reduce((a, b) => a + b, 0) || 1
  const raw = clamped.map((v) => (v / total) * UNITS)
  const base = raw.map(Math.floor)
  let left = UNITS - base.reduce((a, b) => a + b, 0)
  const order = raw.map((v, i) => [v - base[i], i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) { if (left <= 0) break; base[i]++; left-- }
  return { quality: base[0] * STEP, speed: base[1] * STEP, cost: base[2] * STEP }
}

/** Arrow keys walk the lattice: left/right trade speed for cost, up/down trade quality against the other two. */
export function nudge(m: Mix, key: string, units = 1): Mix | null {
  const d = STEP * units
  const n = { ...m }
  const take = (from: Axis, to: Axis) => {
    const amt = Math.min(d, n[from])
    if (amt <= 0) return null
    n[from] -= amt; n[to] += amt
    return n
  }
  switch (key) {
    case 'ArrowLeft': return take('cost', 'speed')
    case 'ArrowRight': return take('speed', 'cost')
    case 'ArrowUp': return take(n.speed > n.cost ? 'speed' : 'cost', 'quality')
    case 'ArrowDown': return take('quality', n.speed < n.cost ? 'speed' : n.cost < n.speed ? 'cost' : 'speed')
    default: return null
  }
}

const name = (k: Axis) => AXES.find((a) => a.key === k)!.label.toLowerCase()
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

function amount(w: number, plural = false) {
  if (w === 0) return plural ? 'are ignored' : 'is ignored'
  const v = plural ? 'count' : 'counts'
  if (w <= 10) return `barely ${v}`
  if (w <= 20) return `${v} a little`
  if (w <= 30) return `${v} a fair bit`
  return `${v} a lot`
}

/** A short plain-language reading of the weights. */
export function describe(m: Mix): string {
  const [a, b, c] = (['quality', 'speed', 'cost'] as Axis[]).map((k) => ({ k, w: m[k] })).sort((x, y) => y.w - x.w)
  if (a.w - c.w <= 5) return 'Quality, speed and cost count about equally.'
  if (a.w === 100) return `Ranking looks only at ${name(a.k)}. Nothing else counts.`
  const rest = b.w - c.w <= 5
    ? `${cap(name(b.k))} and ${name(c.k)} ${amount(Math.round((b.w + c.w) / 2), true)}.`
    : `${cap(name(b.k))} ${amount(b.w)}; ${name(c.k)} ${amount(c.w)}.`
  if (a.w >= 50 && a.w - b.w >= 30) return `Ranking cares mostly about ${name(a.k)}. ${rest}`
  if (a.w - b.w <= 5) return `${cap(name(a.k))} and ${name(b.k)} matter about equally; ${name(c.k)} ${amount(c.w)}.`
  if (b.w - c.w <= 5) return `${cap(name(a.k))} leads. ${rest}`
  return `${cap(name(a.k))} leads, ${a.w - b.w <= 10 ? 'closely followed by' : 'then'} ${name(b.k)}; ${name(c.k)} ${amount(c.w)}.`
}
