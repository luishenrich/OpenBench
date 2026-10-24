import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { ms, pct, usd } from '@/lib/format'
import type { ParetoPoint } from '@/types'

const FG = '#ededef'
const FRONT = '#ff6b3d'
const FAINT = '#62626b'
const MUTED = '#9a9aa3'

type Pt = ParetoPoint & { x: number; y: number; recommended: boolean }

// 1, 2, 5 × 10^k ticks inside [lo, hi]
function logTicks(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** k
      if (v >= lo && v <= hi) out.push(v)
    }
  }
  return out
}

// Recharts 3 skips the default symbol and LabelList for these series, so every point draws its own dot and label.
function Dot(props: { cx?: number; cy?: number; payload?: Pt }) {
  const { cx = 0, cy = 0, payload: p } = props
  if (!p) return null
  if (p.is_baseline) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill="#09090b" stroke={FG} strokeWidth={2} />
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize={12} fill={FG}>{p.label} (today)</text>
      </g>
    )
  }
  if (p.pareto) {
    const r = p.recommended ? 6 : 4.5
    return (
      <g>
        <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={1.5} fill={p.recommended ? FRONT : "#09090b"} stroke={FRONT} strokeWidth={1.5} />
        <text x={cx} y={cy - r - 7} textAnchor="middle" fontSize={12} fontWeight={600} fill={FG}>{p.label}</text>
      </g>
    )
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={FAINT} />
      <text x={cx + 10} y={cy + 4} fontSize={11} fill={MUTED}>{p.label}</text>
    </g>
  )
}

export default function ParetoChart({ points, recommended }: { points: ParetoPoint[]; recommended: string | null }) {
  const data: Pt[] = points
    .filter((p) => p.cost_per_success_usd != null && p.cost_per_success_usd > 0)
    .map((p) => ({ ...p, x: p.cost_per_success_usd!, y: p.quality, recommended: p.candidate_key === recommended }))
  if (data.length === 0) return null
  const front = data.filter((p) => p.pareto && !p.is_baseline).sort((a, b) => a.x - b.x)
  const others = data.filter((p) => !p.pareto || p.is_baseline)
  const xs = data.map((d) => d.x)
  const xLo = Math.min(...xs) / 1.6
  const xHi = Math.max(...xs) * 1.6
  const yLo = Math.max(0, Math.floor((Math.min(...data.map((d) => d.y)) - 0.02) * 20) / 20)
  const yTicks = Array.from({ length: Math.round((1 - yLo) * 20) + 1 }, (_, i) => +(yLo + i * 0.05).toFixed(2))

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 24, right: 32, bottom: 28, left: 8 }}>
          <CartesianGrid stroke="#1f1f23" />
          <XAxis
            type="number" dataKey="x" scale="log" domain={[xLo, xHi]} ticks={logTicks(xLo, xHi)} tickFormatter={(v) => usd(v)}
            tick={{ fontSize: 12, fill: MUTED }} stroke="#3a3a40" allowDataOverflow
            label={{ value: 'Cost per successful call, log scale (cheaper is left)', position: 'bottom', offset: 10, fontSize: 12, fill: MUTED }}
          />
          <YAxis
            type="number" dataKey="y" domain={[yLo, 1]} ticks={yTicks} tickFormatter={(v) => pct(v, 0)}
            tick={{ fontSize: 12, fill: MUTED }} stroke="#3a3a40" width={44}
          />
          <Tooltip
            cursor={false}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as Pt | undefined
              if (!p) return null
              return (
                <div className="rounded-md border border-line bg-raised px-3 py-2 text-xs">
                  <div className="font-medium">{p.label}{p.is_baseline ? ' (today)' : ''}</div>
                  <div className="text-muted">quality {pct(p.quality)}, {usd(p.cost_per_success_usd)} per success, p95 {ms(p.latency_ms)}</div>
                </div>
              )
            }}
          />
          <Scatter data={front} shape={Dot} isAnimationActive={false}
            line={{ stroke: FRONT, strokeWidth: 1.25 }} lineType="joint" />
          <Scatter data={others} shape={Dot} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
