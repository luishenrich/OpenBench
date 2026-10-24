import type { CSSProperties, ReactNode } from 'react'
import { d, useInView } from './motion'
import { Code, Container, SectionHead } from './shared'

type Step = { n: string; title: string; body: ReactNode; points: string[]; pick?: boolean }

const steps: Step[] = [
  {
    n: '01',
    title: 'Discover',
    body: (
      <>
        Your coding agent (Claude Code, Cursor…) connects to the BIY MCP server and runs <Code>/mcp__biy__scan_repo</Code>. It finds the
        places your code calls an LLM and proposes use cases, each with metrics, gates and test cases.
      </>
    ),
    points: ['LLM call sites in your repo', 'Use cases with metrics and gates', 'Test cases drawn from your code'],
  },
  {
    n: '02',
    title: 'Benchmark',
    body: (
      <>
        Candidates run on Nebius Token Factory and OpenRouter, several repeats per case. Every call streams, so we measure the response as it
        arrives and record what the provider actually billed.
      </>
    ),
    points: ['Time to first token', 'End-to-end latency', 'Tokens per second', 'Real billed cost'],
  },
  {
    n: '03',
    title: 'Decide',
    body: (
      <>
        Gates come first, for example JSON schema validity. Then the Pareto front of quality against cost, then your own quality, speed and cost
        weights. Where there is no exact answer, an LLM judge scores by rubric or pairwise, run in both orders.
      </>
    ),
    points: ['95% bootstrap confidence intervals', 'Statistical ties go to the cheaper model', 'Judge runs both orders to cancel position bias'],
    pick: true,
  },
]

// One step. When it scrolls in, its stretch of the rail fills, its node lights (coral for the pick)
// and the copy and points slide in from the rail, so the three steps read as a progression.
function StepRow({ s, last }: { s: Step; last: boolean }) {
  const [ref, inView] = useInView<HTMLLIElement>(0.35)
  return (
    <li ref={ref} data-inview={inView}
      className="relative grid gap-x-10 gap-y-5 border-t border-line py-10 pl-10 sm:pl-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Rail: a faint track, a lit segment that fills as the step arrives, and the step's node */}
      <span aria-hidden className={`absolute top-0 left-[5px] w-px bg-line ${last ? 'h-[57px]' : 'bottom-0'}`} />
      <span aria-hidden style={{ '--dur': '900ms' } as CSSProperties}
        className={`lp-t lp-grow-y absolute top-0 left-[5px] w-px ${last ? 'h-[57px] bg-gradient-to-b from-line-strong to-front' : 'bottom-0 bg-gradient-to-b from-line-strong via-muted/50 to-line-strong'}`} />
      <span aria-hidden className={`absolute top-[52px] left-0 size-[11px] ${s.pick ? 'bg-front' : 'border border-line-strong bg-bg'}`} />
      <span aria-hidden style={d(350)}
        className={`lp-t lp-node-glow absolute top-[52px] left-0 size-[11px] ${s.pick
          ? 'bg-front shadow-[0_0_0_4px_rgb(255_107_61/0.12),0_0_18px_2px_rgb(255_107_61/0.55)]'
          : 'border border-muted bg-bg shadow-[0_0_14px_rgb(237_237_239/0.18)]'}`} />
      <div className="lp-t lp-slide" style={d(120)}>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-xs text-faint">{s.n}</span>
          <h3 className="title text-2xl sm:text-3xl">{s.title}</h3>
        </div>
        <p className="mt-4 max-w-xl leading-relaxed text-muted">{s.body}</p>
      </div>
      <ul className="space-y-2.5 self-end font-mono text-[12px] tracking-[0.02em] text-muted lg:pt-12">
        {s.points.map((p, i) => (
          <li key={p} className="lp-t lp-slide flex items-center gap-3" style={d(320 + i * 70)}>
            <span aria-hidden className={`size-[7px] shrink-0 rounded-[1.5px] ${s.pick ? 'bg-front shadow-[0_0_8px_rgb(255_107_61/0.6)]' : 'bg-faint'}`} />
            {p}
          </li>
        ))}
      </ul>
    </li>
  )
}

export default function HowItWorks() {
  return (
    <section aria-labelledby="how-title" id="how" className="scroll-mt-16 border-b border-line/60 py-24 sm:py-32">
      <Container>
        <SectionHead id="how-title" badge="How it works" tone="signal" title="From your repo to a pick, in three steps." />
        <ol className="mt-16">
          {steps.map((s, i) => <StepRow key={s.n} s={s} last={i === steps.length - 1} />)}
        </ol>
      </Container>
    </section>
  )
}
