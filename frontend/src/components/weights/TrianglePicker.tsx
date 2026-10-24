import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { AXES, nudge, sameMix, snap, type Mix } from './mix'

// Ternary picker: every point inside the triangle is one mix of quality / speed / cost that sums to 100.
// The point's distance to each corner is that weight (barycentric coordinates).
const W = 300
const SIDE = 240
const H = (SIDE * Math.sqrt(3)) / 2
const TOP = 30
const Q = { x: W / 2, y: TOP }
const S = { x: (W - SIDE) / 2, y: TOP + H }
const C = { x: (W + SIDE) / 2, y: TOP + H }
const VBH = TOP + H + 34

const toXY = (m: Mix) => ({
  x: (m.quality * Q.x + m.speed * S.x + m.cost * C.x) / 100,
  y: (m.quality * Q.y + m.speed * S.y + m.cost * C.y) / 100,
})

function fromXY(x: number, y: number): Mix {
  const d = (S.y - C.y) * (Q.x - C.x) + (C.x - S.x) * (Q.y - C.y)
  const q = ((S.y - C.y) * (x - C.x) + (C.x - S.x) * (y - C.y)) / d
  const s = ((C.y - Q.y) * (x - C.x) + (Q.x - C.x) * (y - C.y)) / d
  return snap({ quality: q, speed: s, cost: 1 - q - s })
}

const pts = (...p: { x: number; y: number }[]) => p.map((v) => `${v.x},${v.y}`).join(' ')

// Gridlines every 20 %: for each axis, the lines where that weight is 20, 40, 60, 80.
const GRID = [20, 40, 60, 80].flatMap((k) => [
  [toXY({ quality: k, speed: 100 - k, cost: 0 }), toXY({ quality: k, speed: 0, cost: 100 - k })],
  [toXY({ quality: 100 - k, speed: k, cost: 0 }), toXY({ quality: 0, speed: k, cost: 100 - k })],
  [toXY({ quality: 100 - k, speed: 0, cost: k }), toXY({ quality: 0, speed: 100 - k, cost: k })],
])
const CENTRE = { x: Q.x, y: TOP + (2 * H) / 3 }
const CORNERS = { quality: Q, speed: S, cost: C }

export default function TrianglePicker({ mix, onChange }: { mix: Mix; onChange: (m: Mix) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const p = toXY(mix)

  const sorted = AXES.map((a) => ({ ...a, w: mix[a.key] })).sort((a, b) => b.w - a.w)
  const lead = sorted[0].w > sorted[1].w ? sorted[0] : null

  function emit(m: Mix) { if (!sameMix(m, mix)) onChange(m) }

  function fromPointer(e: PointerEvent) {
    const r = svg.current!.getBoundingClientRect()
    emit(fromXY(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * VBH))
  }

  function onKey(e: KeyboardEvent) {
    if (!e.key.startsWith('Arrow')) return
    e.preventDefault()
    const next = nudge(mix, e.key, e.shiftKey ? 2 : 1)
    if (next) emit(next)
  }

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${VBH}`}
      className="group block w-full touch-none select-none"
      style={{ outline: 'none', cursor: dragging ? 'grabbing' : 'pointer' }}
      tabIndex={0}
      role="slider"
      aria-label="Trade-off between quality, speed and cost"
      aria-valuetext={`Quality ${mix.quality}, speed ${mix.speed}, cost ${mix.cost}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={mix.quality}
      onKeyDown={onKey}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); fromPointer(e) }}
      onPointerMove={(e) => { if (dragging) fromPointer(e) }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <defs>
        <clipPath id={`tri${uid}`}><polygon points={pts(Q, S, C)} /></clipPath>
        <radialGradient id={`glow${uid}`} gradientUnits="userSpaceOnUse" cx={p.x} cy={p.y} r={SIDE * 0.55}>
          <stop offset="0" stopColor={lead?.color ?? 'var(--color-fg)'} stopOpacity={lead ? 0.2 : 0.08} />
          <stop offset="1" stopColor={lead?.color ?? 'var(--color-fg)'} stopOpacity={0} />
        </radialGradient>
      </defs>

      <polygon points={pts(Q, S, C)} fill="var(--color-raised)" />
      <rect x={0} y={0} width={W} height={VBH} fill={`url(#glow${uid})`} clipPath={`url(#tri${uid})`} />

      {GRID.map(([a, b], i) => (
        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-line-strong)" strokeWidth={1} strokeOpacity={0.55} />
      ))}
      <polygon points={pts(Q, S, C)} fill="none" stroke="var(--color-line-strong)" strokeWidth={1.25} strokeLinejoin="round" />

      {/* centre = equal weights */}
      <g stroke="var(--color-faint)" strokeWidth={1.25}>
        <line x1={CENTRE.x - 4} y1={CENTRE.y} x2={CENTRE.x + 4} y2={CENTRE.y} />
        <line x1={CENTRE.x} y1={CENTRE.y - 4} x2={CENTRE.x} y2={CENTRE.y + 4} />
      </g>
      <text x={CENTRE.x} y={CENTRE.y + 16} textAnchor="middle" fontSize={10} fill="var(--color-faint)" style={{ letterSpacing: '0.06em' }}>
        EQUAL
      </text>

      {/* pull lines: brighter the more that corner weighs */}
      {AXES.map((a) => (
        <line
          key={a.key}
          x1={p.x} y1={p.y} x2={CORNERS[a.key].x} y2={CORNERS[a.key].y}
          stroke={a.color} strokeWidth={1.25} strokeOpacity={mix[a.key] === 0 ? 0 : 0.12 + (mix[a.key] / 100) * 0.55}
          strokeDasharray="2 3"
        />
      ))}

      {AXES.map((a) => {
        const c = CORNERS[a.key]
        return <circle key={a.key} cx={c.x} cy={c.y} r={3.5} fill={a.color} />
      })}
      <text x={Q.x} y={Q.y - 12} textAnchor="middle" fontSize={12.5} fontWeight={500} fill={AXES[0].color}>Quality</text>
      <text x={S.x} y={S.y + 22} textAnchor="middle" fontSize={12.5} fontWeight={500} fill={AXES[1].color}>Speed</text>
      <text x={C.x} y={C.y + 22} textAnchor="middle" fontSize={12.5} fontWeight={500} fill={AXES[2].color}>Cost</text>

      <g style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: dragging ? 'none' : 'transform 120ms ease-out' }}>
        <circle r={15} fill="none" stroke="var(--color-signal)" strokeWidth={2} className="opacity-0 group-focus-visible:opacity-100" />
        <circle r={9} fill="var(--color-fg)" stroke="var(--color-bg)" strokeWidth={3} />
      </g>
    </svg>
  )
}
