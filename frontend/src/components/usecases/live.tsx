import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CopyButton } from '@/components/connections/mcp'
import { listGrants } from '@/components/connections/grants'
import { api } from '@/lib/api'
import type { UseCase } from '@/types'
import { scanActivity, sinceLabel } from './group'

// Small pulsing dot for "this updates live". The pulse is motion-safe only (and index.css also
// switches animations off under prefers-reduced-motion).
export function LiveDot({ className = '', small = false }: { className?: string; small?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full bg-win motion-safe:animate-pulse ${small ? 'size-1.5 shadow-[0_0_0_2px_rgb(61_214_140/0.15)]' : 'size-2 shadow-[0_0_0_3px_rgb(61_214_140/0.15)]'} ${className}`} aria-hidden />
  )
}

/** Current time, re-read every `ms`, so time-based states (the agent's 5-minute window) flip on their own. */
export function useNow(ms = 15_000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

// Slim banner over the list while the coding agent is creating or filling in use cases. It goes away by
// itself once nothing has changed for 5 minutes (AGENT_WINDOW_MS).
export function ScanBanner({ list, fallbackName }: { list: UseCase[]; fallbackName: string }) {
  const now = useNow(1000)
  const a = scanActivity(list, fallbackName, now)
  if (!a) return null
  const manyProjects = new Set(list.map((u) => u.source_refs[0]?.repo?.trim() || fallbackName)).size > 1
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-panel px-4 py-2.5 text-sm">
      <LiveDot className="mr-1" />
      <span role="status" className="contents">
        <span className="font-medium text-fg">Your agent is scanning</span>
        {manyProjects && <><span aria-hidden className="text-faint">·</span><span className="text-muted">{a.projects.join(', ')}</span></>}
        <span aria-hidden className="text-faint">·</span>
        <span className="tabular-nums text-muted">{a.setUp} of {a.total} set up</span>
      </span>
      <span aria-hidden className="text-faint">·</span>
      <span className="tabular-nums text-faint">last change {sinceLabel(a.lastChange, now)}</span>
    </div>
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
