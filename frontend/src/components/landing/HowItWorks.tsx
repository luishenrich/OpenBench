import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { BenchmarkMock, DecideMock, DiscoverMock } from './Mockups'
import { d, useInView } from './motion'
import { Code, Container, SectionHead } from './shared'

type Step = { n: string; title: string; body: ReactNode; mock: (inView: boolean) => ReactNode; pick?: boolean }

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
    mock: () => <DiscoverMock />,
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
    mock: (inView) => <BenchmarkMock run={inView} />,
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
    mock: () => <DecideMock />,
    pick: true,
  },
]

// The node sits level with the step title: 52px down the row, 11px square, so its centre is 57.5px down.
const NODE_TOP = 52
const NODE_MID = NODE_TOP + 5.5

function StepRow({ s, lit, rowRef }: { s: Step; lit: boolean; rowRef: (el: HTMLLIElement | null) => void }) {
  const [ref, inView] = useInView<HTMLLIElement>(0.3)
  return (
    <li ref={(el) => { ref.current = el; rowRef(el) }} data-inview={inView}
      className="relative grid items-start gap-x-12 gap-y-8 border-t border-line pt-10 pb-12 pl-10 last:pb-0 grid-cols-[minmax(0,1fr)] sm:pl-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:pb-14">
      {/* the node lights when the rail's fill reaches it (coral and glowing for the pick) */}
      <span aria-hidden style={{ top: NODE_TOP }}
        className={`absolute left-0 z-10 size-[11px] transition-[background-color,border-color,box-shadow] duration-500 ${lit
          ? s.pick
            ? 'border border-front bg-front shadow-[0_0_0_4px_rgb(255_107_61/0.14),0_0_18px_2px_rgb(255_107_61/0.6)]'
            : 'border border-front bg-bg shadow-[0_0_12px_rgb(255_107_61/0.45)]'
          : 'border border-line-strong bg-bg'}`} />
      <div className="lp-t lp-slide" style={d(80)}>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-xs text-faint">{s.n}</span>
          <h3 className="title text-2xl sm:text-3xl">{s.title}</h3>
        </div>
        <p className="mt-4 max-w-xl leading-relaxed text-muted">{s.body}</p>
      </div>
      {s.mock(inView)}
    </li>
  )
}

// The rail fills top-down with scroll: from the top of step 1 to the Decide node, following a line
// 55% down the viewport. Transform-only (scaleY), measured on resize, updated at most once per frame.
// Reduced motion: drawn full, every node lit.
export default function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const rows = useRef<(HTMLLIElement | null)[]>([])
  const [railH, setRailH] = useState(0)
  const [litCount, setLitCount] = useState(steps.length)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let nodes: number[] = []
    let h = 0
    let frame = 0
    const measure = () => {
      nodes = rows.current.map((r) => (r ? r.offsetTop + NODE_MID : 0))
      h = nodes[nodes.length - 1] ?? 0
      setRailH(h)
    }
    const update = () => {
      frame = 0
      const fill = fillRef.current
      const tip = tipRef.current
      if (!fill || !tip || !h) return
      const top = list.getBoundingClientRect().top
      const reached = reduce ? h : Math.min(h, Math.max(0, window.innerHeight * 0.55 - top))
      fill.style.transform = `scaleY(${reached / h})`
      tip.style.transform = `translateY(${reached}px)`
      tip.style.opacity = reached > 0 && reached < h ? '1' : '0'
      setLitCount(nodes.filter((y) => y <= reached + 0.5).length)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    measure()
    update()
    const ro = new ResizeObserver(() => { measure(); onScroll() })
    ro.observe(list)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <section aria-labelledby="how-title" id="how" className="scroll-mt-16 border-b border-line/60 py-20 sm:py-28">
      <Container>
        <SectionHead id="how-title" badge="How it works" tone="signal" title="From your repo to a pick, in three steps." />
        <ol ref={listRef} className="relative mt-16">
          {/* rail: a faint track, the coral fill (scaleY from the top) and a small light at its tip */}
          <span aria-hidden className="absolute top-0 left-[5px] w-px bg-line" style={{ height: railH }} />
          <span ref={fillRef} aria-hidden className="absolute top-0 left-[5px] w-px origin-top bg-gradient-to-b from-front/25 via-front/70 to-front shadow-[0_0_8px_rgb(255_107_61/0.45)] will-change-transform"
            style={{ height: railH }} />
          <span ref={tipRef} aria-hidden className="pointer-events-none absolute top-0 left-[5px] z-10 -mt-[3px] -ml-[3px] size-[7px] rounded-full bg-[#ffd2c2] opacity-0 shadow-[0_0_10px_3px_rgb(255_107_61/0.7)] will-change-transform" />
          {steps.map((s, i) => (
            <StepRow key={s.n} s={s} lit={i < litCount} rowRef={(el) => { rows.current[i] = el }} />
          ))}
        </ol>
      </Container>
    </section>
  )
}
