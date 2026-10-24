import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CopyButton } from '@/components/connections/mcp'
import { listGrants } from '@/components/connections/grants'
import { api } from '@/lib/api'

// Small pulsing dot for "this updates live". The pulse is motion-safe only (and index.css also
// switches animations off under prefers-reduced-motion).
export function LiveDot({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex size-2 shrink-0 rounded-full bg-win shadow-[0_0_0_3px_rgb(61_214_140/0.15)] motion-safe:animate-pulse ${className}`} aria-hidden />
  )
}

// Empty list. Once an agent is connected (an OAuth grant, or a workspace key exists) the next step is
// the scan, not connecting again.
export function WaitingForAgent() {
  const grants = useQuery({ queryKey: ['oauth-grants'], queryFn: listGrants, retry: false })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const apps = grants.data?.map((g) => g.client.name) ?? []
  const key = me.data?.mcp_key_last4
  const connected = apps.length > 0 || !!key

  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
      {connected ? (
        <>
          <p className="title">Your agent is connected</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">Open your product repo in it and run the scan. Use cases show up here as it finds them.</p>
          <div className="mx-auto mt-5 flex max-w-sm items-center justify-between gap-3 rounded-lg border border-line bg-bg py-1.5 pr-1.5 pl-4 text-left">
            <code className="font-mono text-[13px] text-fg">/mcp__biy__scan_repo</code>
            <CopyButton text="/mcp__biy__scan_repo" />
          </div>
          <p className="mt-3 text-xs text-faint">
            Connected: {[...apps, ...(key ? [`key …${key}`] : [])].join(' · ')}
            {' · '}<Link to="/connections" className="underline decoration-line-strong underline-offset-2 hover:text-fg">Manage</Link>
          </p>
        </>
      ) : (
        <>
          <p className="title">No use cases yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">Connect your coding agent and run the scan. It creates the use cases for you.</p>
          <Link to="/connections" className="mt-5 inline-flex items-center justify-center rounded-md bg-fg px-3.5 py-2 text-sm font-medium text-bg transition-colors hover:bg-white">
            Connect your coding agent
          </Link>
        </>
      )}
      <div className="mt-6" role="status">
        <p className="inline-flex items-center gap-2.5 rounded-full border border-line bg-panel px-3.5 py-1.5 text-[13px] text-fg">
          <LiveDot /> {connected ? 'Waiting for the scan…' : 'Waiting for your agent…'}
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
