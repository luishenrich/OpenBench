import type { ReactNode } from 'react'
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

export default function HowItWorks() {
  return (
    <section aria-labelledby="how-title" id="how" className="scroll-mt-16 border-b border-line/60 py-24 sm:py-32">
      <Container>
        <SectionHead id="how-title" badge="How it works" tone="signal" title="From your repo to a pick, in three steps." />
        <ol className="mt-16">
          {steps.map((s, i) => (
            <li key={s.n} className="relative grid gap-x-10 gap-y-5 border-t border-line py-10 pl-10 sm:pl-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              {/* Rail: grid nodes joined by a line, the last one coral like the pick on the front */}
              <span aria-hidden className={`absolute top-0 left-[5px] w-px bg-line-strong ${i === steps.length - 1 ? 'h-12' : 'bottom-0'}`} />
              <span aria-hidden className={`absolute top-[46px] left-0 size-[11px] ${s.pick ? 'bg-front' : 'border border-line-strong bg-bg'}`} />
              <div>
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-xs text-faint">{s.n}</span>
                  <h3 className="title text-2xl sm:text-3xl">{s.title}</h3>
                </div>
                <p className="mt-4 max-w-xl leading-relaxed text-muted">{s.body}</p>
              </div>
              <ul className="space-y-2.5 self-end font-mono text-[12px] tracking-[0.02em] text-muted lg:pt-12">
                {s.points.map((p) => (
                  <li key={p} className="flex items-center gap-3">
                    <span aria-hidden className={`size-[7px] shrink-0 rounded-[1.5px] ${s.pick ? 'bg-front' : 'bg-faint'}`} />
                    {p}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
