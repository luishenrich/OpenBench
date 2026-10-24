// Loading skeletons: raised blocks with a slow sweep (the .skeleton class in index.css). Shown only on a
// query's first load, never on background refetches, and sized like the real content so nothing jumps.
import type { CSSProperties, ReactNode } from 'react'

/** One block. Size and shape come from className (h-*, w-*, rounded-*). */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={`skeleton block rounded-[5px] ${className}`} style={style} />
}

/**
 * A text line: a box as tall as the real line (`lh`, e.g. 'h-5' for text-sm) with a thinner bar in it,
 * so a skeleton line takes the same vertical space as the text it stands in for.
 */
export function Line({ lh = 'h-5', bar = 'h-2.5', className = 'w-full', style }: { lh?: string; bar?: string; className?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden className={`flex items-center ${lh} ${className}`} style={style}>
      <Skeleton className={`w-full ${bar}`} />
    </span>
  )
}

/** Several lines of a paragraph; the last one shorter. */
export function Lines({ n = 2, lh, bar, last = '60%', className = '' }: { n?: number; lh?: string; bar?: string; last?: string; className?: string }) {
  return (
    <span className={`block ${className}`}>
      {Array.from({ length: n }, (_, i) => (
        <Line key={i} lh={lh} bar={bar} className="w-full" style={i === n - 1 && n > 1 ? { width: last } : undefined} />
      ))}
    </span>
  )
}

/** Wraps a skeleton so screen readers hear one "Loading …" instead of nothing. */
export function LoadingRegion({ label = 'Loading', children, className = '' }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  )
}
