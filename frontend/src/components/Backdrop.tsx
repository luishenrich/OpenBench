// Grid with nodes and a coral stepped path: a Pareto front drawn on graph paper.
const STEP = 56

// shift moves the front and its frame (in grid steps) so it can sit beside the page's content instead of under it.
export default function Backdrop({ className = '', shift = [0, 0] }: { className?: string; shift?: [number, number] }) {
  const [dx, dy] = shift
  const nodes: [number, number][] = [[1, 2], [2, 2], [4, 1], [2, 4], [1, 5], [5, 5], [3, 6], [6, 2]]
  const plus: [number, number][] = [[1, 3], [2, 3], [1, 6]]
  // the front: right and up, ending at the pick
  const path = ([[10, 8], [12, 8], [12, 7], [13, 7], [13, 6], [14, 6], [14, 4], [15, 4], [15, 2]] as [number, number][]).map(([x, y]) => [x + dx, y + dy])
  const frame = ([[14, 1], [15, 1], [16, 1], [14, 2], [16, 2], [14, 3], [15, 3], [16, 3], [16, 5], [16, 6], [16, 7], [15, 8], [14, 8], [13, 8]] as [number, number][]).map(([x, y]) => [x + dx, y + dy])
  const d = path.map(([x, y], i) => `${i ? 'L' : 'M'}${x * STEP} ${y * STEP}`).join(' ')
  return (
    <svg className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} preserveAspectRatio="xMidYMid slice" viewBox={`0 0 ${17 * STEP} ${10 * STEP}`} aria-hidden>
      <defs>
        <pattern id="biy-grid" width={STEP} height={STEP} patternUnits="userSpaceOnUse">
          <path d={`M ${STEP} 0 L 0 0 0 ${STEP}`} fill="none" stroke="#1d1d21" strokeWidth={1} />
        </pattern>
        <radialGradient id="biy-fade" cx="50%" cy="45%" r="65%">
          <stop offset="35%" stopColor="#fff" stopOpacity={1} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <mask id="biy-mask"><rect width="100%" height="100%" fill="url(#biy-fade)" /></mask>
      </defs>
      <g mask="url(#biy-mask)">
        <rect width="100%" height="100%" fill="url(#biy-grid)" />
        {nodes.map(([x, y]) => <rect key={`n${x}${y}`} x={x * STEP - 2.5} y={y * STEP - 2.5} width={5} height={5} fill="#3a3a40" />)}
        {frame.map(([x, y]) => <rect key={`f${x}${y}`} x={x * STEP - 2.5} y={y * STEP - 2.5} width={5} height={5} fill="#4a4a52" />)}
        {plus.map(([x, y]) => (
          <path key={`p${x}${y}`} d={`M${x * STEP - 6} ${y * STEP}h12M${x * STEP} ${y * STEP - 6}v12`} stroke="#4a4a52" strokeWidth={1} />
        ))}
        <path d={d} fill="none" stroke="#ff6b3d" strokeOpacity={0.7} strokeWidth={1.25} />
        {path.map(([x, y]) => <rect key={`q${x}${y}`} x={x * STEP - 3} y={y * STEP - 3} width={6} height={6} fill="none" stroke="#ff6b3d" strokeOpacity={0.8} />)}
        <path d={`M${(15 + dx) * STEP - 7} ${(2 + dy) * STEP}h14M${(15 + dx) * STEP} ${(2 + dy) * STEP - 7}v14`} stroke="#ff6b3d" strokeWidth={1.25} />
      </g>
    </svg>
  )
}
