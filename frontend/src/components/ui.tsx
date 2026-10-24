import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { RunStatus } from '@/types'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-[#252f47] disabled:bg-faint',
  secondary: 'bg-surface text-ink border border-rule hover:border-faint disabled:text-faint',
  ghost: 'text-muted hover:text-ink hover:bg-white/60',
  danger: 'bg-surface text-bad border border-rule hover:border-bad',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  )
}

const statusStyle: Record<RunStatus, string> = {
  queued: 'bg-paper text-muted',
  running: 'bg-accent-soft text-accent',
  scoring: 'bg-accent-soft text-accent',
  done: 'bg-win-soft text-win',
  failed: 'bg-bad-soft text-bad',
  cancelled: 'bg-paper text-muted',
}

export function StatusPill({ status }: { status: RunStatus }) {
  const live = status === 'running' || status === 'scoring' || status === 'queued'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[status]}`}>
      {live && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {status}
    </span>
  )
}

export function Tag({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'win' | 'bad' | 'accent' }) {
  const t = { plain: 'bg-paper text-muted', win: 'bg-win-soft text-win', bad: 'bg-bad-soft text-bad', accent: 'bg-accent-soft text-accent' }[tone]
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${t}`}>{children}</span>
}

export function Section({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-rule bg-surface ${className}`}>{children}</div>
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <p className="py-10 text-sm text-muted">{label}…</p>
}

export function ErrorNote({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <div className="rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">
      {msg}
    </div>
  )
}
