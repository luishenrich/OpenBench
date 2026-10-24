// The mark is a Pareto staircase: each step is a model that buys quality for cost; the coral node is the pick.
export function Mark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="#1e1a4d" stroke="#3a3480" />
      <path d="M7 24h5v-5h5v-5h5V9h3" fill="none" stroke="#fff" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <rect x="22.5" y="6.5" width="5" height="5" rx="1" fill="#ff6b3d" />
    </svg>
  )
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark className={size === 'lg' ? 'size-10' : 'size-7'} />
      <span className={`title ${size === 'lg' ? 'text-xl' : 'text-[15px]'}`}>BIY</span>
    </span>
  )
}
