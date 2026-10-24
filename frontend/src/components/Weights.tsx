import type { Axis, Profile } from '@/types'

const AXES: { key: Axis; label: string; hint: string }[] = [
  { key: 'quality', label: 'Quality', hint: 'Metric scores on your cases' },
  { key: 'speed', label: 'Speed', hint: 'Latency against your target' },
  { key: 'cost', label: 'Cost', hint: 'Price per call against your target' },
]

// Moving one slider rescales the other two so the weights always sum to 100.
function rebalance(weights: Record<Axis, number>, changed: Axis, value: number): Record<Axis, number> {
  const others = AXES.map((a) => a.key).filter((k) => k !== changed)
  const rest = 100 - value
  const otherSum = others.reduce((s, k) => s + weights[k], 0)
  const next = { ...weights, [changed]: value }
  if (otherSum === 0) {
    next[others[0]] = Math.floor(rest / 2)
    next[others[1]] = rest - Math.floor(rest / 2)
  } else {
    next[others[0]] = Math.round((weights[others[0]] / otherSum) * rest)
    next[others[1]] = rest - next[others[0]]
  }
  return next
}

export default function Weights({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  return (
    <div className="space-y-4">
      {AXES.map((a) => (
        <label key={a.key} className="grid grid-cols-[120px_1fr_36px] items-center gap-3">
          <span>
            <span className="block text-sm font-medium">{a.label}</span>
            <span className="block text-xs text-muted">{a.hint}</span>
          </span>
          <input
            type="range" min={0} max={100} step={5} value={profile.weights[a.key]}
            onChange={(e) => onChange({ ...profile, weights: rebalance(profile.weights, a.key, Number(e.target.value)) })}
            aria-label={`${a.label} weight`}
          />
          <span className="text-right text-sm font-medium">{profile.weights[a.key]}</span>
        </label>
      ))}
    </div>
  )
}
