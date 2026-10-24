import { d } from './motion'

// Landing copy of components/Backdrop.tsx with the hero's load sequence and light added
// (the dashboard keeps the static original). Grid with nodes and a coral stepped path: a Pareto front on graph paper.
const STEP = 56
const DRAW_START = 250
const DRAW_MS = 1150

const nodes: [number, number][] = [[1, 2], [2, 2], [4, 1], [2, 4], [1, 5], [5, 5], [3, 6], [6, 2]]
const plus: [number, number][] = [[1, 3], [2, 3], [1, 6]]
// the front: right and up, ending at the pick
// The front sits one step further right than the dashboard Backdrop, so the one-line-wider headline clears it.
const DX = 1
const path: [number, number][] = ([[10, 8], [12, 8], [12, 7], [13, 7], [13, 6], [14, 6], [14, 4], [15, 4], [15, 2]] as [number, number][]).map(([x, y]) => [x + DX, y])
const frame: [number, number][] = ([[14, 1], [15, 1], [16, 1], [14, 2], [16, 2], [14, 3], [15, 3], [16, 3], [16, 5], [16, 6], [16, 7], [15, 8], [14, 8], [13, 8]] as [number, number][]).map(([x, y]) => [x + DX, y])
const PICK = path[path.length - 1]

// Where along the front each vertex sits (0..1), so its marker pops as the line reaches it.
const seg = path.map((p, i) => (i ? Math.abs(p[0] - path[i - 1][0]) + Math.abs(p[1] - path[i - 1][1]) : 0))
const total = seg.reduce((a, b) => a + b, 0)
const at = seg.map((_, i) => seg.slice(0, i + 1).reduce((a, b) => a + b, 0) / total)
// rough inverse of the draw easing (slow start, fast middle): good enough to land each pop on its corner
const reach = (f: number) => DRAW_START + DRAW_MS * (0.18 + 0.68 * f) - 60

const dPath = path.map(([x, y], i) => `${i ? 'L' : 'M'}${x * STEP} ${y * STEP}`).join(' ')

export default function HeroBackdrop() {
  const [px, py] = [PICK[0] * STEP, PICK[1] * STEP]
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox={`0 0 ${17 * STEP} ${10 * STEP}`} aria-hidden>
      <defs>
        <pattern id="lp-grid" width={STEP} height={STEP} patternUnits="userSpaceOnUse">
          <path d={`M ${STEP} 0 L 0 0 0 ${STEP}`} fill="none" stroke="#1d1d21" strokeWidth={1} />
        </pattern>
        <radialGradient id="lp-fade" cx="50%" cy="45%" r="65%">
          <stop offset="35%" stopColor="#fff" stopOpacity={1} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <mask id="lp-mask"><rect width="100%" height="100%" fill="url(#lp-fade)" /></mask>
        <radialGradient id="lp-pick-glow">
          <stop offset="0%" stopColor="#ff6b3d" stopOpacity={0.38} />
          <stop offset="35%" stopColor="#ff6b3d" stopOpacity={0.12} />
          <stop offset="100%" stopColor="#ff6b3d" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="lp-wash" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff6b3d" stopOpacity={0.07} />
          <stop offset="100%" stopColor="#ff6b3d" stopOpacity={0} />
        </radialGradient>
        <filter id="lp-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* a faint coral wash behind the staircase */}
      <ellipse className="lp-light" cx={(12.8 + DX) * STEP} cy={5 * STEP} rx={5 * STEP} ry={4 * STEP} fill="url(#lp-wash)" />

      <g mask="url(#lp-mask)">
        <rect className="lp-grid" width="100%" height="100%" fill="url(#lp-grid)" />
        {nodes.map(([x, y], i) => <rect key={`n${x}${y}`} className="lp-dim" style={d(120 + i * 40)} x={x * STEP - 2.5} y={y * STEP - 2.5} width={5} height={5} fill="#3a3a40" />)}
        {frame.map(([x, y], i) => <rect key={`f${x}${y}`} className="lp-dim" style={d(300 + i * 30)} x={x * STEP - 2.5} y={y * STEP - 2.5} width={5} height={5} fill="#4a4a52" />)}
        {plus.map(([x, y], i) => (
          <path key={`p${x}${y}`} className="lp-dim" style={d(200 + i * 60)} d={`M${x * STEP - 6} ${y * STEP}h12M${x * STEP} ${y * STEP - 6}v12`} stroke="#4a4a52" strokeWidth={1} />
        ))}

        {/* the front: a blurred copy underneath is its glow */}
        <path className="lp-draw" d={dPath} pathLength={1} fill="none" stroke="#ff6b3d" strokeOpacity={0.42} strokeWidth={4} filter="url(#lp-glow)" />
        <path className="lp-draw" d={dPath} pathLength={1} fill="none" stroke="#ff6b3d" strokeOpacity={0.85} strokeWidth={1.25} />
        {/* a light that runs along the front now and then (motion only) */}
        <path className="lp-comet" d={dPath} pathLength={1} fill="none" stroke="#ffb59c" strokeWidth={2.5} strokeLinecap="round" filter="url(#lp-glow)" />
        <path className="lp-comet" d={dPath} pathLength={1} fill="none" stroke="#fff3ee" strokeWidth={1.25} strokeLinecap="round" />

        {path.slice(0, -1).map(([x, y], i) => (
          <rect key={`q${x}${y}`} className="lp-mark" style={d(reach(at[i]))} x={x * STEP - 3} y={y * STEP - 3} width={6} height={6} fill="#09090b" stroke="#ff6b3d" strokeOpacity={0.9} />
        ))}
      </g>

      {/* the pick: halo, marker and crosshair land last */}
      <circle className="lp-halo" cx={px} cy={py} r={STEP * 1.6} fill="url(#lp-pick-glow)" />
      <g className="lp-pick">
        <rect x={px - 3.5} y={py - 3.5} width={7} height={7} fill="#ff6b3d" />
        <path d={`M${px - 9} ${py}h18M${px} ${py - 9}v18`} stroke="#ff6b3d" strokeWidth={1.25} />
      </g>
    </svg>
  )
}
