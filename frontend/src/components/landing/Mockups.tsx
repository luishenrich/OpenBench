import type { CSSProperties, ReactNode } from 'react'
import { ModelIcon, ProviderIcon } from '@/components/ModelIcon'
import { d, useCountUp } from './motion'

// Small floating product mockups for "How it works". Illustrative UI, not live data.
// Inner details animate via landing.css when the parent step has data-inview="true";
// .lp-lift layers rise by different amounts on hover, which reads as depth.

const card =
  'lp-hairline rounded-xl border border-line bg-[#111113] shadow-[0_1px_0_0_rgb(255_255_255/0.035)_inset,0_28px_60px_-30px_rgb(0_0_0/0.95)]'
const floatCard =
  'lp-hairline rounded-lg border border-line bg-[#141416] shadow-[0_1px_0_0_rgb(255_255_255/0.05)_inset,0_18px_40px_-16px_rgb(0_0_0/0.95)]'

const lift = (px: number, extra: CSSProperties = {}) => ({ '--lift': `${px}px`, ...extra }) as CSSProperties

/** Mono brand mark from public/model-icons (Lobe Icons, MIT). */
function Mark({ name, size = 13, className = '' }: { name: string; size?: number; className?: string }) {
  return <img src={`/model-icons/${name}.svg`} alt="" aria-hidden width={size} height={size} draggable={false} className={`block shrink-0 opacity-85 ${className}`} />
}

function Chip({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span style={style} className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-[#151517] py-1 pr-2.5 pl-2 text-[11.5px] whitespace-nowrap text-muted shadow-[0_10px_24px_-12px_rgb(0_0_0/0.9)] ${className}`}>
      {children}
    </span>
  )
}

function Stage({ glow, children }: { glow: string; children: ReactNode }) {
  return (
    <div aria-hidden className="lp-stage relative mx-auto w-full max-w-[470px] lg:mx-0 lg:ml-auto" style={{ '--glow': glow } as CSSProperties}>
      {children}
    </div>
  )
}

/* ---------- 01 Discover ---------- */

const sites = [
  { at: 'src/billing/extract.ts:42', kind: 'extraction' },
  { at: 'src/support/triage.py:88', kind: 'classification' },
  { at: 'src/search/rerank.ts:17', kind: 'ranking' },
]

export function DiscoverMock() {
  return (
    <Stage glow="rgb(92 82 230 / 0.12)">
      <div className="relative pt-3.5 pb-8">
        {/* where it runs: the repo and the agents that call BIY */}
        <div className="lp-lift absolute top-0 right-3 z-10 flex gap-1.5" style={lift(-6)}>
          <Chip className="lp-t lp-up" style={d(80)}><Mark name="github" size={12} />acme/api</Chip>
          <Chip className="lp-t lp-up" style={d(150)}><Mark name="cursor" size={12} />Cursor</Chip>
          <span className="hidden sm:contents"><Chip className="lp-t lp-up" style={d(220)}><Mark name="claudecode" size={12} />Claude Code</Chip></span>
        </div>

        <div className={`lp-lift ${card}`} style={lift(-2)}>
          <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5 text-[12px] text-muted">
            <Mark name="claudecode" size={13} />
            Claude Code
            <span className="ml-auto font-mono text-[11px] text-faint">~/acme-api</span>
          </div>
          <div className="space-y-1.5 px-3.5 pt-3 pb-9 font-mono text-[11.5px] leading-5">
            <p className="text-fg"><span className="text-front">›</span> /mcp__biy__scan_repo</p>
            <p className="lp-t lp-fade text-faint" style={d(200)}>scanned 214 files · 3 LLM call sites</p>
            <ul className="space-y-1.5 pt-1">
              {sites.map((s, i) => (
                <li key={s.at} className="lp-t lp-slide flex items-center gap-3" style={d(380 + i * 140)}>
                  <span className="truncate text-fg/85">{s.at}</span>
                  <span className="ml-auto shrink-0 rounded border border-line px-1.5 text-[10.5px] text-muted">{s.kind}</span>
                </li>
              ))}
            </ul>
            <p className="lp-t lp-fade pt-1 text-faint" style={d(860)}>→ proposing use cases…</p>
          </div>
        </div>

        {/* the result lands as a card of its own */}
        <div className="lp-lift absolute right-3 bottom-0 z-10 w-[218px]" style={lift(-8)}>
          <div className={`lp-t lp-pop-in ${floatCard} px-3.5 py-3`} style={{ ...d(1000), rotate: '-1.2deg' }}>
            <p className="flex items-center gap-2 text-[11.5px] text-win">
              <span className="size-1.5 rounded-full bg-win shadow-[0_0_8px_rgb(61_214_140/0.8)]" />Use case created
            </p>
            <p className="mt-1 text-[13px] font-medium text-fg">Extract invoice fields</p>
            <p className="mt-0.5 font-mono text-[10.5px] text-muted">4 metrics · 1 gate · 50 cases</p>
          </div>
        </div>
      </div>
    </Stage>
  )
}

/* ---------- 02 Benchmark ---------- */

const runRows = [
  { id: 'zai-org/GLM-5.3-Flash', name: 'GLM-5.3-Flash', ttft: 0.18, e2e: 0.92 },
  { id: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', name: 'DeepSeek-V4.1-Flash', ttft: 0.21, e2e: 1.14 },
  { id: 'Qwen/Qwen3.8-27B', name: 'Qwen3.8-27B', ttft: 0.34, e2e: 1.58 },
  { id: 'moonshotai/Kimi-K3', name: 'Kimi-K3', ttft: 0.42, e2e: 2.06 },
  { id: 'MiniMaxAI/MiniMax-M3.1-Flash', name: 'MiniMax-M3.1-Flash', ttft: 0.29, e2e: null },
]
const MAX_S = 2.4

export function BenchmarkMock({ run }: { run: boolean }) {
  const billed = useCountUp(0.0412, run, 1600)
  return (
    <Stage glow="rgb(62 123 250 / 0.1)">
      <div className="relative pt-3.5 pb-8">
        <div className="lp-lift absolute top-0 right-3 z-10 flex gap-1.5" style={lift(-6)}>
          <Chip className="lp-t lp-up" style={d(80)}><ProviderIcon provider="nebius" size={11} />Nebius</Chip>
          <Chip className="lp-t lp-up" style={d(150)}><ProviderIcon provider="openrouter" size={11} />OpenRouter</Chip>
        </div>

        <div className={`lp-lift ${card} px-3.5 pt-3 pb-3.5`} style={lift(-2)}>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="relative flex size-1.5">
              <span className="lp-live absolute inset-0 rounded-full bg-signal" />
              <span className="relative size-1.5 rounded-full bg-signal" />
            </span>
            <span className="text-fg">Run</span>
            <span className="truncate text-muted">extract invoice fields · 5 models × 150 calls</span>
            <span className="ml-auto font-mono text-[11px] text-muted">62%</span>
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-raised">
            <div className="lp-t lp-grow-x h-full w-[62%] rounded-full bg-gradient-to-r from-signal/60 to-signal" style={{ ...d(150), '--dur': '1400ms' } as CSSProperties} />
          </div>

          <ul className="mt-3.5 space-y-2">
            {runRows.map((r, i) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_2.75rem] items-center gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2.75rem]">
                <span className="lp-t lp-fade flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-fg/85" style={d(200 + i * 90)}>
                  <ModelIcon model={r.id} size={11} />
                  <span className="truncate">{r.name}</span>
                </span>
                {/* first token, then the stream: both measured as the response arrives */}
                <span className="relative h-1.5 overflow-hidden rounded-full bg-raised">
                  <span className="lp-t lp-grow-x absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-fg/25 to-signal/60"
                    style={{ width: `${((r.e2e ?? 1.3) / MAX_S) * 100}%`, ...d(320 + i * 110), '--dur': r.e2e ? '900ms' : '1600ms' } as CSSProperties} />
                  <span className="lp-t lp-grow-x absolute inset-y-0 left-0 rounded-full bg-fg/80"
                    style={{ width: `${(r.ttft / MAX_S) * 100}%`, ...d(280 + i * 110), '--dur': '450ms' } as CSSProperties} />
                </span>
                <span className={`lp-t lp-fade text-right font-mono text-[11px] ${r.e2e ? 'text-muted' : 'text-signal'}`} style={d(700 + i * 110)}>
                  {r.e2e ? `${r.e2e.toFixed(2)}s` : 'live'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 mb-5 flex items-center justify-end gap-4 font-mono text-[10.5px] text-faint">
            <span className="flex items-center gap-1.5"><span className="h-1 w-3 rounded-full bg-fg/80" />first token</span>
            <span className="flex items-center gap-1.5"><span className="h-1 w-3 rounded-full bg-signal/60" />streaming</span>
          </p>
        </div>

        {/* what the provider actually charged, ticking up as calls finish */}
        <div className="lp-lift absolute bottom-0 left-3 z-10" style={lift(-8)}>
          <div className={`lp-t lp-pop-in ${floatCard} px-3.5 py-2.5`} style={{ ...d(600), rotate: '1deg' }}>
            <p className="text-[11px] text-muted">$ billed so far</p>
            <p className="title mt-0.5 font-mono text-[19px] text-fg tabular-nums">${billed.toFixed(4)}</p>
          </div>
        </div>
      </div>
    </Stage>
  )
}

/* ---------- 03 Decide ---------- */

// mini Pareto in a 300×116 box: x = cost, y = quality (up is better)
const pts = { pick: [44, 62], f1: [128, 46], f2: [196, 38], today: [272, 30], off: [96, 92], fail: [150, 104] } as const
const front = `M${pts.pick[0]} ${pts.pick[1]} H${pts.f1[0]} V${pts.f1[1]} H${pts.f2[0]} V${pts.f2[1]}`
const REF_Y = 16

export function DecideMock() {
  return (
    <Stage glow="rgb(255 107 61 / 0.1)">
      <div className="relative pt-3.5">
        {/* gates come before any ranking */}
        <div className="lp-lift absolute top-0 left-3 z-10 hidden sm:block" style={lift(-6)}>
          <Chip className="lp-t lp-pop-in" style={d(60)}>
            <svg viewBox="0 0 12 12" className="size-3 text-win"><path d="M2.5 6.5l2.2 2.2L9.5 3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
            Gates passed
          </Chip>
        </div>
        {/* the jury: three open judges, run in both orders */}
        <div className="lp-lift absolute top-0 right-3 z-10" style={lift(-6)}>
          <Chip className="lp-t lp-up gap-2" style={d(120)}>
            <span className="flex -space-x-1">
              {['openai', 'deepseek', 'zai'].map((m) => (
                <span key={m} className="flex size-[18px] items-center justify-center rounded-full border border-line bg-raised"><Mark name={m} size={10} /></span>
              ))}
            </span>
            3 judges · both orders
          </Chip>
        </div>

        <div className={`lp-lift ${card} overflow-hidden`} style={lift(-2)}>
          <div className="px-4 pt-6">
            <p className="flex items-center gap-2 text-[11.5px] text-win">
              <span className="size-1.5 rounded-full bg-win" />Verdict
              <span className="ml-auto font-mono text-[10.5px] text-faint">95% CI · 50 cases × 3</span>
            </p>
            <p className="title mt-2 flex items-center gap-2 text-[17px] text-fg">
              <ModelIcon model="zai-org/GLM-5.3-Flash" size={13} />
              Switch to <span className="text-front">GLM-5.3-Flash</span>
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              <span className="text-fg">98%</span> of quality · <span className="text-fg">5× cheaper</span> · −170 ms p95
            </p>
          </div>

          <div className="relative mx-4 mt-3 mb-3">
            <svg viewBox="0 0 300 116" className="block h-auto w-full">
              {[30, 62, 94].map((y) => <line key={y} x1={0} x2={300} y1={y} y2={y} stroke="#1d1d21" />)}
              {/* closed-model reference: where the ceiling is, not a candidate */}
              <line className="lp-t lp-grow-x" style={{ ...d(200), '--dur': '800ms' } as CSSProperties}
                x1={0} x2={300} y1={REF_Y} y2={REF_Y} stroke="#62626b" strokeDasharray="3 4" />
              <path className="lp-t lp-trace" style={{ ...d(650), '--dur': '700ms' } as CSSProperties} d={front} pathLength={1} fill="none" stroke="#ff6b3d" strokeWidth={1.5} />
              <circle className="lp-t lp-fade" style={{ ...d(1200), '--dur': '800ms' } as CSSProperties} cx={pts.pick[0]} cy={pts.pick[1]} r={18} fill="url(#lp-mock-glow)" />
              <defs>
                <radialGradient id="lp-mock-glow">
                  <stop offset="0%" stopColor="#ff6b3d" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#ff6b3d" stopOpacity={0} />
                </radialGradient>
              </defs>
              <rect className="lp-t lp-pt" style={d(350)} x={pts.off[0] - 2.5} y={pts.off[1] - 2.5} width={5} height={5} fill="#62626b" />
              <path className="lp-t lp-pt" style={d(400)} d={`M${pts.fail[0] - 3} ${pts.fail[1] - 3}l6 6M${pts.fail[0] + 3} ${pts.fail[1] - 3}l-6 6`} stroke="#f2555a" strokeWidth={1.25} />
              <rect className="lp-t lp-pt" style={d(450)} x={pts.today[0] - 3.5} y={pts.today[1] - 3.5} width={7} height={7} fill="#111113" stroke="#ededef" strokeWidth={1.25} />
              <rect className="lp-t lp-pt" style={d(500)} x={pts.f2[0] - 3} y={pts.f2[1] - 3} width={6} height={6} fill="#111113" stroke="#ff6b3d" strokeWidth={1.25} />
              <rect className="lp-t lp-pt" style={d(550)} x={pts.f1[0] - 3} y={pts.f1[1] - 3} width={6} height={6} fill="#111113" stroke="#ff6b3d" strokeWidth={1.25} />
              <rect className="lp-t lp-pt" style={d(600)} x={pts.pick[0] - 4} y={pts.pick[1] - 4} width={8} height={8} fill="#ff6b3d" />
            </svg>
            <span className="lp-t lp-fade absolute right-0 font-mono text-[10px] text-faint" style={{ top: `${(REF_Y / 116) * 100}%`, translate: '0 calc(-100% - 3px)', ...d(500) }}>Reference: GPT-6.1 Sol</span>
            <span className="lp-t lp-fade absolute font-mono text-[10px] text-front" style={{ left: `${(pts.pick[0] / 300) * 100}%`, top: `${((pts.pick[1] + 8) / 116) * 100}%`, ...d(900) }}>pick</span>
            <span className="lp-t lp-fade absolute font-mono text-[10px] text-muted" style={{ left: `${((pts.today[0] - 4) / 300) * 100}%`, top: `${((pts.today[1] + 7) / 116) * 100}%`, translate: '-50% 0', ...d(700) }}>today</span>
          </div>
          <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-muted">
            Interval overlaps DeepSeek-V4.1-Flash: the tie goes to the cheaper model.
          </p>
        </div>

      </div>
    </Stage>
  )
}
