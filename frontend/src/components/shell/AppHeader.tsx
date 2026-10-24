import { useQuery } from '@tanstack/react-query'
import { Fragment, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { projectOf, scanActivity } from '@/components/usecases/group'
import { LiveDot, useNow } from '@/components/usecases/live'
import { api } from '@/lib/api'
import type { Run, UseCase } from '@/types'
import { NavIcon } from './icons'

type Crumb = { label: ReactNode; title?: string; to?: string | { pathname: string; search: string } }

const projectTo = (name: string) => ({ pathname: '/', search: `?project=${encodeURIComponent(name)}` })

/** "owner/" faint, "repo" in full, like the sidebar and the list headers. */
function ProjectName({ name }: { name: string }) {
  const cut = name.lastIndexOf('/') + 1
  return cut > 0 ? <><span className="text-faint">{name.slice(0, cut)}</span>{name.slice(cut)}</> : <>{name}</>
}

const when = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const pending = <span className="skeleton inline-block h-2.5 w-24 rounded-[4px] align-middle" aria-hidden />

/**
 * Where you are, from the route plus whatever TanStack Query already has: the use case (['use-case', id]),
 * the run (['run', id]) and its use case. These observers share the pages' queries (no polling of their own).
 */
function useCrumbs(): Crumb[] {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const list = useQuery({ queryKey: ['use-cases'], queryFn: api.useCases, staleTime: 10_000 })
  const workspace = me.data?.workspace.name || 'Your project'

  const ucId = pathname.match(/^\/use-cases\/([^/]+)/)?.[1]
  const runId = pathname.match(/^\/runs\/([^/]+)/)?.[1]
  const run = useQuery<Run>({ queryKey: ['run', runId], queryFn: () => api.run(runId!), enabled: !!runId, staleTime: 10_000 })
  const id = ucId ? decodeURIComponent(ucId) : run.data?.use_case_id
  const uc = useQuery<UseCase>({ queryKey: ['use-case', id], queryFn: () => api.useCase(id!), enabled: !!id, staleTime: 10_000 })
  const useCase = uc.data ?? list.data?.find((u) => u.id === id)

  if (pathname === '/') {
    const project = params.get('project')
    return [project ? { label: <ProjectName name={project} />, title: project } : { label: 'Use cases' }]
  }
  if (pathname.startsWith('/settings')) return [{ label: 'Settings' }]
  if (pathname.startsWith('/connections')) return [{ label: 'Connections' }]
  if (ucId || runId) {
    const project = useCase ? projectOf(useCase, workspace) : null
    const crumbs: Crumb[] = [
      project ? { label: <ProjectName name={project} />, title: project, to: projectTo(project) } : { label: pending, to: '/' },
      useCase ? { label: useCase.name, title: useCase.name, to: runId ? `/use-cases/${useCase.id}` : undefined } : { label: pending },
    ]
    if (runId) {
      const r = run.data
      const label = r ? `Run · ${r.finished_at ? when(r.finished_at) : r.status}` : null
      crumbs.push({ label: label ?? pending, title: label ?? undefined })
    }
    return crumbs
  }
  return []
}

export function Breadcrumb() {
  const crumbs = useCrumbs()
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          // earlier crumbs give way first, so the current page keeps the most room
          // on phones only the current page and its parent show
          const size = `${last ? 'min-w-0 shrink' : 'min-w-0 max-w-[40%] shrink-[3]'} ${i < crumbs.length - 2 ? 'max-sm:hidden' : ''}`
          return (
            <Fragment key={i}>
              {i > 0 && <li aria-hidden className={`shrink-0 text-faint ${i < crumbs.length - 1 ? 'max-sm:hidden' : ''}`}><NavIcon name="chevron" className="size-3.5" /></li>}
              <li className={`${size} flex`}>
                {c.to && !last ? (
                  <Link
                    to={c.to} title={c.title}
                    className="truncate rounded-sm text-muted transition-colors outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-signal/70"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined} title={c.title} className={`truncate ${last ? 'font-medium text-fg' : 'text-muted'}`}>{c.label}</span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

/** Small "Agent scanning" signal for the header's right side, while the agent is creating or filling use cases. */
export function ScanSignal() {
  // the list page has its own scan banner
  const onList = useLocation().pathname === '/'
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const list = useQuery({ queryKey: ['use-cases'], queryFn: api.useCases, staleTime: 10_000 })
  const now = useNow(5_000)
  const scan = scanActivity(list.data ?? [], me.data?.workspace.name || 'Your project', now)
  if (!scan || onList) return null
  return (
    <Link
      to="/" title={`Your agent is scanning · ${scan.setUp} of ${scan.total} set up`}
      className="hidden shrink-0 items-center gap-2 rounded-md px-2 py-1 text-xs text-muted transition-colors outline-none hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-signal/70 sm:inline-flex"
    >
      <LiveDot small />Agent scanning
      <span className="tabular-nums text-faint">{scan.setUp}/{scan.total}</span>
    </Link>
  )
}
