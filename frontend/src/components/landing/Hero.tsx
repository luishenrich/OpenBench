import { Link } from 'react-router-dom'
import Backdrop from '@/components/Backdrop'
import { Logo } from '@/components/Logo'
import { ProviderIcon } from '@/components/ModelIcon'
import { Badge } from '@/components/ui'
import { Container, linkPrimary, linkSecondary, pill } from './shared'

const anchors = [
  { href: '#how', label: 'How it works' },
  { href: '#metrics', label: 'Metrics' },
  { href: '#connect', label: 'Connect' },
]

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/75 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link to="/landing" aria-label="BIY home" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-1.5 md:flex">
          {anchors.map((a) => (
            <a key={a.href} href={a.href} className={pill}>{a.label}</a>
          ))}
        </nav>
        <Link to="/login" className="inline-flex items-center rounded-full bg-fg px-3.5 py-1.5 text-[13px] font-medium text-bg transition-colors hover:bg-white focus-visible:rounded-full">
          Sign in
        </Link>
      </Container>
    </header>
  )
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line/60">
      {/* At phone width the frame is kept wide and pinned right, so the coral front stays in view instead of being cropped away. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-full min-w-[980px] opacity-55 sm:opacity-100">
        <Backdrop />
      </div>
      {/* On laptops the hero fills the first screen (minus the nav), so the CTAs are always above the fold. */}
      <Container className="relative flex flex-col justify-center pt-20 pb-24 sm:pt-28 sm:pb-32 lg:min-h-[calc(100svh-4rem)] lg:py-16">
        <div className="lp-rise">
          <Badge tone="front">Benchmark it yourself</Badge>
        </div>
        <h1 id="hero-title" className="lp-rise display mt-7 max-w-[13ch] text-[44px] text-balance sm:text-7xl lg:text-[104px]" style={{ animationDelay: '60ms' }}>
          Find the open model that does your job.
        </h1>
        <p className="lp-rise mt-7 max-w-[34rem] text-lg leading-relaxed text-pretty text-muted sm:text-xl" style={{ animationDelay: '120ms' }}>
          BIY runs open-weight models on your own cases and measures quality, speed and cost. You get a recommendation you can defend.
        </p>
        <div className="lp-rise mt-10 flex flex-wrap items-center gap-3" style={{ animationDelay: '180ms' }}>
          <Link to="/login" className={linkPrimary}>Sign in</Link>
          <a href="#connect" className={linkSecondary}>Connect your agent</a>
        </div>
        <p className="lp-rise mt-14 flex flex-wrap items-center gap-x-2 gap-y-2 font-mono text-[11px] tracking-[0.08em] text-muted uppercase" style={{ animationDelay: '240ms' }}>
          <span>Runs on</span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><ProviderIcon provider="nebius" size={12} />Nebius Token Factory</span>
          <span>and</span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><ProviderIcon provider="openrouter" size={12} />OpenRouter</span>
        </p>
      </Container>
    </section>
  )
}
