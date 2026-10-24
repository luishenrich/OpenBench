import type { ReactNode } from 'react'
import { Badge } from '@/components/ui'

// Landing-only building blocks. Colours come from the theme tokens in index.css.

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-4 sm:px-6 ${className}`}>{children}</div>
}

// Small dark pill used for the top nav anchors.
export const pill =
  'inline-flex items-center rounded-full border border-line bg-panel/80 px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-fg focus-visible:rounded-full'

// Primary / secondary link styles that mirror Button in ui.tsx, for <a> and <Link>.
export const linkPrimary =
  'inline-flex items-center justify-center gap-2 rounded-md bg-fg px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:bg-white'
export const linkSecondary =
  'inline-flex items-center justify-center gap-2 rounded-md border border-line bg-raised px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-line-strong'

export function SectionHead({ id, badge, tone = 'muted', title, lede }: {
  id?: string
  badge: string
  tone?: 'muted' | 'signal' | 'win' | 'bad' | 'front'
  title: ReactNode
  lede?: ReactNode
}) {
  return (
    <div>
      <Badge tone={tone}>{badge}</Badge>
      <h2 id={id} className="display mt-5 max-w-[18ch] text-4xl text-balance sm:text-5xl">{title}</h2>
      {lede && <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted sm:text-lg">{lede}</p>}
    </div>
  )
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-raised px-1 py-0.5 font-mono text-[0.85em] text-fg">{children}</code>
}
