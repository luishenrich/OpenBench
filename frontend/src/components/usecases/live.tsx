import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// Small pulsing dot for "this updates live". The pulse is motion-safe only (and index.css also
// switches animations off under prefers-reduced-motion).
export function LiveDot({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex size-2 shrink-0 rounded-full bg-win shadow-[0_0_0_3px_rgb(61_214_140/0.15)] motion-safe:animate-pulse ${className}`} aria-hidden />
  )
}

export function WaitingForAgent() {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="title">No use cases yet</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">Connect your coding agent and run the scan. It creates the use cases for you.</p>
      <Link to="/connections" className="mt-5 inline-flex items-center justify-center rounded-md bg-fg px-3.5 py-2 text-sm font-medium text-bg transition-colors hover:bg-white">
        Connect your coding agent
      </Link>
      <div className="mt-6" role="status">
        <p className="inline-flex items-center gap-2.5 rounded-full border border-line bg-panel px-3.5 py-1.5 text-[13px] text-fg">
          <LiveDot /> Waiting for your agent…
        </p>
        <p className="mt-2 text-xs text-faint">This list updates live as the scan finds LLM calls.</p>
      </div>
    </div>
  )
}

// Ids that showed up since the first load, for a brief highlight. The first load highlights nothing.
export function useFreshIds(ids: string[] | undefined, ms = 2600): Set<string> {
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())
  const timers = useRef<number[]>([])
  const key = ids?.join(',')

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    if (!ids) return
    if (!seen.current) {
      seen.current = new Set(ids)
      return
    }
    const added = ids.filter((id) => !seen.current!.has(id))
    if (!added.length) return
    added.forEach((id) => seen.current!.add(id))
    setFresh((f) => new Set([...f, ...added]))
    // not cleared when more ids arrive, or earlier rows would stay highlighted
    timers.current.push(window.setTimeout(() => setFresh((f) => {
      const next = new Set(f)
      added.forEach((id) => next.delete(id))
      return next
    }), ms))
  }, [key])

  return fresh
}
