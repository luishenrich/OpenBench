import { ModelIcon } from '@/components/ModelIcon'
import { Container, SectionHead } from './shared'

// Static copy of contract/fixtures/run_done.json (example data, not a live run).
type Row = { id: string; name: string; q: number; lo: number; hi: number; cost: number; kind: 'pick' | 'front' | 'off' | 'failed' | 'today' }
const rows: Row[] = [
  { id: 'nebius:zai-org/GLM-5.3-Flash', name: 'GLM-5.3-Flash', q: 0.962, lo: 0.952, hi: 0.972, cost: 0.09, kind: 'pick' },
  { id: 'nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017', name: 'DeepSeek-V4.1-Flash', q: 0.971, lo: 0.962, hi: 0.98, cost: 0.21, kind: 'front' },
  { id: 'openrouter:xiaomi/mimo-v2.6-pro', name: 'MiMo-v2.6-pro', q: 0.975, lo: 0.967, hi: 0.983, cost: 0.31, kind: 'front' },
  { id: 'nebius:openai/gpt-oss-120b', name: 'gpt-oss-120b', q: 0.918, lo: 0.903, hi: 0.933, cost: 0.1, kind: 'off' },
  { id: 'nebius:MiniMaxAI/MiniMax-M3.1-Flash', name: 'MiniMax-M3.1-Flash', q: 0.884, lo: 0.864, hi: 0.904, cost: 0.11, kind: 'failed' },
  { id: 'openrouter:openai/gpt-4.1-mini', name: 'gpt-4.1-mini', q: 0.981, lo: 0.974, hi: 0.988, cost: 0.46, kind: 'today' },
]

const figures = [
  { value: '98%', label: 'of gpt-4.1-mini quality' },
  { value: '5.0×', label: 'cheaper per call' },
  { value: '−170 ms', label: 'p95 latency' },
  { value: '~$412', label: 'saved per month' },
]

const Q0 = 0.86
const Q1 = 1.0
const qPct = (q: number) => ((q - Q0) / (Q1 - Q0)) * 100

// Pareto chart geometry, in viewBox units. Labels are HTML placed by percentage so text stays a real 11px at any width.
const W = 420
const H = 320
const P = { l: 40, r: 14, t: 14, b: 34 }
const C1 = 0.5 // $ per 1k calls
const px = (cost: number) => P.l + (cost / C1) * (W - P.l - P.r)
const py = (q: number) => P.t + (1 - (q - Q0) / (Q1 - Q0)) * (H - P.t - P.b)

const yTicks = [0.88, 0.92, 0.96, 1.0]
const xTicks = [0, 0.1, 0.2, 0.3, 0.4, 0.5]

const labelPos: Record<string, { dx: number; dy: number; align: 'left' | 'right' | 'center' }> = {
  'GLM-5.3-Flash': { dx: -6, dy: 16, align: 'left' },
  'DeepSeek-V4.1-Flash': { dx: 0, dy: -18, align: 'center' },
  'MiMo-v2.6-pro': { dx: 9, dy: 2, align: 'left' },
  'gpt-oss-120b': { dx: 10, dy: 0, align: 'left' },
  'MiniMax-M3.1-Flash': { dx: 10, dy: 0, align: 'left' },
  'gpt-4.1-mini': { dx: 8, dy: -17, align: 'right' },
}

const tone: Record<Row['kind'], string> = {
  pick: 'text-front',
  front: 'text-fg',
  off: 'text-muted',
  failed: 'text-bad',
  today: 'text-fg',
}

function ParetoMini() {
  const front = rows.filter((r) => r.kind === 'pick' || r.kind === 'front').sort((a, b) => a.cost - b.cost)
  const d = front
    .map((r, i) => (i === 0 ? `M${px(r.cost)} ${py(r.q)}` : `H${px(r.cost)} V${py(r.q)}`))
    .join(' ')
  const pick = rows[0]
  return (
    <figure>
      <figcaption className="flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium">Quality vs cost</span>
        <span className="font-mono text-[11px] text-muted">$ per 1k calls</span>
      </figcaption>
      <div className="relative mt-3 aspect-[420/320] w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" role="img"
          aria-label="Scatter of quality against cost. GLM-5.3-Flash is the cheapest model on the Pareto front.">
          {yTicks.map((q) => (
            <g key={q}>
              <line x1={P.l} x2={W - P.r} y1={py(q)} y2={py(q)} stroke="#1d1d21" />
            </g>
          ))}
          {xTicks.map((c) => (
            <g key={c}>
              <line x1={px(c)} x2={px(c)} y1={P.t} y2={H - P.b} stroke="#1d1d21" />
            </g>
          ))}
          <path d={d} fill="none" stroke="#ff6b3d" strokeWidth={1.5} />
          {rows.map((r) => {
            const x = px(r.cost)
            const y = py(r.q)
            if (r.kind === 'failed')
              return <path key={r.name} d={`M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8`} stroke="#f2555a" strokeWidth={1.5} />
            if (r.kind === 'today') return <rect key={r.name} x={x - 4.5} y={y - 4.5} width={9} height={9} fill="#09090b" stroke="#ededef" strokeWidth={1.5} />
            if (r.kind === 'pick') return <rect key={r.name} x={x - 4.5} y={y - 4.5} width={9} height={9} fill="#ff6b3d" />
            if (r.kind === 'front') return <rect key={r.name} x={x - 3.5} y={y - 3.5} width={7} height={7} fill="#09090b" stroke="#ff6b3d" strokeWidth={1.25} />
            return <rect key={r.name} x={x - 3} y={y - 3} width={6} height={6} fill="#62626b" />
          })}
          <path d={`M${px(pick.cost) - 10} ${py(pick.q)}h20M${px(pick.cost)} ${py(pick.q) - 10}v20`} stroke="#ff6b3d" strokeWidth={1} strokeOpacity={0.6} />
        </svg>
        {yTicks.map((q) => (
          <span key={q} aria-hidden className="absolute -translate-x-full -translate-y-1/2 pr-2 font-mono text-[10px] text-muted"
            style={{ left: `${(P.l / W) * 100}%`, top: `${(py(q) / H) * 100}%` }}>{q.toFixed(2)}</span>
        ))}
        {xTicks.map((c) => (
          <span key={c} aria-hidden className="absolute -translate-x-1/2 pt-2 font-mono text-[10px] text-muted"
            style={{ left: `${(px(c) / W) * 100}%`, top: `${((H - P.b) / H) * 100}%` }}>{c.toFixed(1)}</span>
        ))}
        {rows.map((r) => {
          const pos = labelPos[r.name]
          const shift = pos.align === 'center' ? '-50%' : pos.align === 'right' ? '-100%' : '0%'
          return (
            <span key={r.name} aria-hidden
              className={`absolute inline-flex items-center gap-1.5 font-mono text-[10.5px] leading-none whitespace-nowrap ${tone[r.kind]}`}
              style={{
                left: `${(px(r.cost) / W) * 100}%`,
                top: `${(py(r.q) / H) * 100}%`,
                transform: `translate(calc(${shift} + ${pos.dx}px), calc(-50% + ${pos.dy}px))`,
              }}>
              {/* icons only from sm up: on a phone the labels need every pixel */}
              <span className="hidden sm:contents"><ModelIcon model={r.id} size={11} /></span>
              {r.kind === 'today' ? `${r.name}, today` : r.name}
            </span>
          )
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted" aria-label="Legend">
        <li className="flex items-center gap-2"><span aria-hidden className="size-[8px] bg-front" />pick</li>
        <li className="flex items-center gap-2"><span aria-hidden className="size-[8px] border border-front" />Pareto front</li>
        <li className="flex items-center gap-2"><span aria-hidden className="size-[8px] border border-fg" />today's model</li>
        <li className="flex items-center gap-2"><span aria-hidden className="size-[7px] bg-faint" />off the front</li>
        <li className="flex items-center gap-2 text-bad"><span aria-hidden>×</span>failed a gate</li>
      </ul>
    </figure>
  )
}

// Phone: name and cost on one line, the interval full width under it. sm and up: one row of three columns.
const track = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2.75rem]'

function ForestMini() {
  const pick = rows[0]
  return (
    <figure>
      <figcaption className="flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium">Quality, 95% CI</span>
        <span className="font-mono text-[11px] text-muted">$ / 1k</span>
      </figcaption>
      <div className="relative mt-4">
        {/* the pick's interval as one band down the plot: any overlap with it is a statistical tie */}
        <div aria-hidden className="pointer-events-none absolute -inset-y-1.5 left-0 right-0 sm:left-[calc(11rem+0.75rem)] sm:right-[calc(2.75rem+0.75rem)]">
          <span className="absolute inset-y-0 bg-front/[0.08]" style={{ left: `${qPct(pick.lo)}%`, width: `${qPct(pick.hi) - qPct(pick.lo)}%` }} />
        </div>
        <ul className="relative space-y-3 sm:space-y-3" aria-label="Quality with 95% confidence intervals per model">
          {rows.map((r) => (
            <li key={r.name} className={track}>
              <span className={`order-1 flex min-w-0 items-center gap-2 font-mono text-[11px] ${tone[r.kind]}`} title={r.name}>
                <ModelIcon model={r.id} size={12} />
                <span className="truncate">{r.name}</span>
              </span>
              <span className={`order-2 text-right font-mono text-[11px] sm:order-3 ${r.kind === 'pick' ? 'text-front' : 'text-muted'}`}>{r.cost.toFixed(2)}</span>
              <span className="relative order-3 col-span-2 h-4 sm:order-2 sm:col-span-1 sm:h-5" aria-label={`${r.name}: ${r.q.toFixed(3)}, 95% CI ${r.lo.toFixed(3)} to ${r.hi.toFixed(3)}`}>
                <span aria-hidden className="absolute top-1/2 h-px -translate-y-1/2"
                  style={{ left: `${qPct(r.lo)}%`, width: `${qPct(r.hi) - qPct(r.lo)}%`, background: r.kind === 'pick' ? '#ff6b3d' : r.kind === 'failed' ? '#f2555a' : '#9a9aa3' }} />
                <span aria-hidden className={`absolute top-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 ${
                  r.kind === 'pick' ? 'bg-front' : r.kind === 'failed' ? 'bg-bad' : r.kind === 'today' ? 'border border-fg bg-bg' : 'bg-muted'}`}
                  style={{ left: `${qPct(r.q)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div aria-hidden className={`mt-3 font-mono text-[10px] text-muted ${track}`}>
        <span className="hidden sm:block" />
        <span className="col-span-2 flex justify-between sm:col-span-1"><span>0.86</span><span>0.93</span><span>1.00</span></span>
      </div>
    </figure>
  )
}

export default function ExampleResult() {
  return (
    <section aria-labelledby="example-title" className="border-b border-line/60 py-24 sm:py-32">
      <Container>
        <SectionHead id="example-title" badge="Example · from our fixtures" tone="front" title="A recommendation you can defend."
          lede="Every pick comes with the numbers behind it: the front it sits on, the intervals it was compared with, and what you save." />

        <div className="mt-16 overflow-hidden rounded-xl border border-line bg-panel">
          <div className="border-b border-line p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Use case: extract invoice fields · 50 cases × 3 repeats</p>
            <h3 className="title mt-3 max-w-3xl text-2xl leading-tight text-balance sm:text-[32px]">
              Switch to <span className="text-front">GLM-5.3-Flash</span>: 98% of today's quality at 1/5 of the cost
            </h3>
            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
              {figures.map((f) => (
                <div key={f.label} className="bg-panel px-4 py-4">
                  <dt className="sr-only">{f.label}</dt>
                  <dd className="title text-2xl sm:text-3xl">{f.value}</dd>
                  <dd className="mt-1 text-[13px] text-muted">{f.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid gap-10 p-6 sm:p-8 lg:grid-cols-2 lg:gap-12">
            <ParetoMini />
            <div>
              <ForestMini />
              <ul className="mt-8 space-y-2 border-t border-line pt-5 text-sm text-muted">
                <li>Passes every gate: schema valid 100%, no errors.</li>
                <li>Its interval overlaps DeepSeek-V4.1-Flash, so the cheaper model wins the tie.</li>
                <li>MiniMax-M3.1-Flash failed the schema gate and is out before ranking.</li>
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
