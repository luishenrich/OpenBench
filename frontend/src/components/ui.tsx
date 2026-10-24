import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { RunStatus } from '@/types'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-fg text-bg hover:bg-white disabled:bg-line-strong disabled:text-faint',
  secondary: 'bg-raised text-fg border border-line hover:border-line-strong disabled:text-faint',
  ghost: 'text-muted hover:text-fg hover:bg-raised',
  danger: 'bg-raised text-bad border border-line hover:border-bad/60',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  )
}

// Mono eyebrow badge with a coloured square, as in the brand reference
export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'signal' | 'win' | 'bad' | 'front' }) {
  const color = { muted: 'text-faint', signal: 'text-signal', win: 'text-win', bad: 'text-bad', front: 'text-front' }[tone]
  return (
    <span className="badge">
      <span className={`badge-dot ${color}`} />
      {children}
    </span>
  )
}

const statusTone: Record<RunStatus, string> = {
  queued: 'text-muted', running: 'text-signal', scoring: 'text-signal', done: 'text-win', failed: 'text-bad', cancelled: 'text-faint',
}

export function StatusPill({ status }: { status: RunStatus }) {
  const live = status === 'running' || status === 'scoring' || status === 'queued'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-0.5 text-xs font-medium ${statusTone[status]}`}>
      <span className={`size-1.5 rounded-[1px] bg-current ${live ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  )
}

export function Tag({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'win' | 'bad' | 'front' | 'signal' }) {
  const t = {
    plain: 'border-line text-muted',
    win: 'border-win/40 text-win',
    bad: 'border-bad/40 text-bad',
    front: 'border-front/40 text-front',
    signal: 'border-signal/40 text-signal',
  }[tone]
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>
}

export function Section({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="title text-lg">{title}</h2>
        {aside && <div className="text-sm text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-panel ${className}`}>{children}</div>
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <p className="py-10 text-sm text-muted">{label}…</p>
}

export function ErrorNote({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error)
  return <div className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{msg}</div>
}
