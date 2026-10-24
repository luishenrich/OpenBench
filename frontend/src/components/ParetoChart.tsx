import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, usePlotArea, useXAxisScale, useYAxisScale, XAxis, YAxis } from 'recharts'
import { ms, pct, usd } from '@/lib/format'
import { makerOf } from '@/lib/modelMakers'
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

type Box = { x0: number; y0: number; x1: number; y1: number }
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))

const radius = (p: Pt) => (p.is_baseline ? 7 : p.pareto ? (p.recommended ? 6 : 4.5) : 5)
const labelText = (p: Pt) => (p.is_baseline ? `${p.label} (today)` : p.label)
const labelFont = (p: Pt) => (p.pareto && !p.is_baseline ? { size: 12, weight: 600, fill: FG } : p.is_baseline ? { size: 12, weight: 500, fill: FG } : { size: 11, weight: 400, fill: MUTED })

let ctx: CanvasRenderingContext2D | null | undefined
function textWidth(text: string, size: number, weight: number): number {
  if (ctx === undefined) ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
  if (!ctx) return text.length * size * 0.6
  ctx.font = `${weight} ${size}px Geist, ui-sans-serif, system-ui, sans-serif`
  return ctx.measureText(text).width
}

// Recharts 3 skips the default symbol for these series, so every point draws its own dot. Labels are laid out
// separately (PointLabels) so they can dodge each other, the dots and the front.
function Dot(props: { cx?: number; cy?: number; payload?: Pt }) {
  const { cx = 0, cy = 0, payload: p } = props
  if (!p) return null
  const r = radius(p)
  if (p.is_baseline) return <circle cx={cx} cy={cy} r={r} fill="#09090b" stroke={FG} strokeWidth={2} />
  if (p.pareto) {
    return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={1.5} fill={p.recommended ? FRONT : '#09090b'} stroke={FRONT} strokeWidth={1.5} />
  }
  return <circle cx={cx} cy={cy} r={r} fill={FAINT} />
}

const PAD = 3
const ICON = 12
type Side = 'top' | 'bottom' | 'right' | 'left' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
const ORDER: Record<'front' | 'base' | 'other', Side[]> = {
  front: ['top', 'top-left', 'top-right', 'left', 'right', 'bottom', 'bottom-left', 'bottom-right'],
  base: ['bottom', 'right', 'left', 'top', 'bottom-left', 'bottom-right', 'top-left', 'top-right'],
  other: ['right', 'left', 'bottom', 'top', 'bottom-right', 'top-right', 'bottom-left', 'top-left'],
}

// Greedy placement: most important points first, each takes the first side that collides with nothing,
// else the side with the least overlap. Stays inside the plot area.
function PointLabels({ data, front }: { data: Pt[]; front: Pt[] }) {
  const xs = useXAxisScale()
  const ys = useYAxisScale()
  const area = usePlotArea()
  if (!xs || !ys || !area) return null
  const pos = (p: Pt) => ({ cx: xs(p.x) ?? 0, cy: ys(p.y) ?? 0 })
  const obstacles: Box[] = data.map((p) => {
    const { cx, cy } = pos(p)
    const r = radius(p) + 2
    return { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r }
  })
  // the staircase segments, as thin boxes
  for (let i = 1; i < front.length; i++) {
    const a = pos(front[i - 1])
    const b = pos(front[i])
    obstacles.push({ x0: a.cx, y0: a.cy - 1.5, x1: b.cx, y1: a.cy + 1.5 }, { x0: b.cx - 1.5, y0: Math.min(a.cy, b.cy), x1: b.cx + 1.5, y1: Math.max(a.cy, b.cy) })
  }
  const bounds: Box = { x0: area.x + 2, y0: area.y - 20, x1: area.x + area.width + 28, y1: area.y + area.height - 2 }
  const rank = (p: Pt) => (p.recommended ? 0 : p.is_baseline ? 1 : p.pareto ? 2 : 3)
  const placed: { p: Pt; x: number; top: number; h: number; icon: string | null; iw: number; lead: [number, number, number, number] | null }[] = []
  const taken: Box[] = []

  for (const p of [...data].sort((a, b) => rank(a) - rank(b) || a.x - b.x)) {
    const { cx, cy } = pos(p)
    const f = labelFont(p)
    const icon = makerOf(p.candidate_key).icon
    const iw = icon ? ICON + 4 : 0 // maker logo in front of the name
    const w = textWidth(labelText(p), f.size, f.weight) + iw
    const h = f.size
    const g = radius(p) + 5
    const sides = ORDER[p.is_baseline ? 'base' : p.pareto ? 'front' : 'other']
    let best: { box: Box; x: number; y: number; cost: number; lead: [number, number, number, number] | null } | null = null
    // level 0 hugs the point; levels 1–2 move the label further up or down with a leader line
    search: for (let level = 0; level < 3; level++) {
      for (const side of sides) {
        const vertical = side.startsWith('top') || side.startsWith('bottom')
        if (level > 0 && !vertical) continue
        const d = g + level * (h + 8)
        const v = side.startsWith('top') ? cy - d - h : side.startsWith('bottom') ? cy + d : cy - h / 2
        const hz = side.endsWith('right') ? (side === 'right' ? cx + g : cx + 2) : side.endsWith('left') ? (side === 'left' ? cx - g - w : cx - 2 - w) : cx - w / 2
        const box = { x0: hz - PAD, y0: v - PAD, x1: hz + w + PAD, y1: v + h + PAD } // padded, so labels keep air between them
        const outside = box.x0 + PAD < bounds.x0 || box.x1 - PAD > bounds.x1 || box.y0 + PAD < bounds.y0 || box.y1 - PAD > bounds.y1
        const cost = [...taken, ...obstacles].reduce((s, o) => s + overlap(box, o), 0) + (outside ? 1e6 : 0) + level * 40
        const lead: [number, number, number, number] | null = level > 0
          ? (side.startsWith('top') ? [cx, cy - radius(p) - 2, cx, v + h + 2] : [cx, cy + radius(p) + 2, cx, v - 2])
          : null
        if (!best || cost < best.cost) best = { box, x: hz, y: v, cost, lead }
        if (cost === level * 40) break search
      }
    }
    taken.push(best!.box)
    if (best!.lead) {
      const [x1, y1, , y2] = best!.lead
      taken.push({ x0: x1 - 1, y0: Math.min(y1, y2), x1: x1 + 1, y1: Math.max(y1, y2) })
    }
    placed.push({ p, x: best!.x, top: best!.y, h, icon, iw, lead: best!.lead })
  }

  return (
    <g pointerEvents="none">
      {placed.map(({ p, x, top, h, icon, iw, lead }) => {
        const f = labelFont(p)
        return (
          <g key={p.candidate_key}>
            {lead && <line x1={lead[0]} y1={lead[1]} x2={lead[2]} y2={lead[3]} stroke={FAINT} strokeWidth={1} />}
            {icon && <image href={icon} x={x} y={top + (h - ICON) / 2 - 0.5} width={ICON} height={ICON} opacity={p.pareto || p.is_baseline ? 1 : 0.7} />}
            <text x={x + iw} y={top + h * 0.8} fontSize={f.size} fontWeight={f.weight} fill={f.fill}>{labelText(p)}</text>
          </g>
        )
      })}
    </g>
  )
}

export default function ParetoChart({ points, recommended }: { points: ParetoPoint[]; recommended: string | null }) {
  const data: Pt[] = points
    .filter((p) => p.cost_per_success_usd != null && p.cost_per_success_usd > 0)
    .map((p) => ({ ...p, x: p.cost_per_success_usd!, y: p.quality, recommended: p.candidate_key === recommended }))
  if (data.length === 0) return null
  // today's model belongs on the front when nothing beats it (a "keep" verdict); it still draws as the white ring
  const front = data.filter((p) => p.pareto).sort((a, b) => a.x - b.x)
  const others = data.filter((p) => !p.pareto)
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
          {/* The front is a staircase, cheapest first: quality holds until the next model buys more of it. */}
          <Scatter data={front} shape={Dot} isAnimationActive={false}
            line={{ stroke: FRONT, strokeWidth: 1.25, strokeOpacity: 0.85 }} lineType="joint" lineJointType="stepAfter" />
          <Scatter data={others} shape={Dot} isAnimationActive={false} />
          <PointLabels data={data} front={front} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
