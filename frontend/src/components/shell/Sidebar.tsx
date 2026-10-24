import { useQuery } from '@tanstack/react-query'
import { useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Logo, Mark } from '@/components/Logo'
import { groupUseCases, isAgentSettingUp, projectOf, scanActivity, setupState } from '@/components/usecases/group'
import { LiveDot, useNow } from '@/components/usecases/live'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { FIXTURES } from '@/lib/mode'
import { NavIcon, type NavIconName } from './icons'

export const SIDEBAR_W = 'w-60'

/** `/?project=<name>`: the use-case list filtered to one project. */
export const projectHref = (name: string) => ({ pathname: '/', search: `?project=${encodeURIComponent(name)}` })

const item = 'group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-signal/70'
const itemOn = 'bg-raised text-fg'
const itemOff = 'text-muted hover:bg-raised/60 hover:text-fg'

function NavItem({ to, icon, label, count, active, current }: {
  to: string | { pathname: string; search: string }; icon: NavIconName; label: string; count?: number; active: boolean; current: boolean
}) {
  return (
    <Link to={to} aria-current={current ? 'page' : undefined} className={`${item} ${active ? itemOn : itemOff}`}>
      <NavIcon name={icon} className={`size-4 ${active ? 'text-fg' : 'text-faint group-hover:text-muted'}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && count > 0 && <span className="text-xs tabular-nums text-faint">{count}</span>}
    </Link>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <p className="mb-1 px-2.5 text-[11px] font-medium tracking-wide text-faint uppercase">{title}</p>
      <div className="space-y-px">{children}</div>
    </div>
  )
}

/** Sidebar content, shared by the fixed desktop sidebar and the mobile drawer. */
export function SidebarContent({ header, rail = false }: { header?: ReactNode; rail?: boolean }) {
  const auth = useAuth()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  // same key as the list page (which polls every 3 s there); no polling of its own
  const ucs = useQuery({ queryKey: ['use-cases'], queryFn: api.useCases })
  const now = useNow(5_000)
  const fallbackName = me.data?.workspace.name || 'Your project'
  const all = ucs.data ?? []
  const projects = groupUseCases(all, fallbackName)
  const scan = scanActivity(all, fallbackName, now)

  const onList = pathname === '/'
  const project = onList ? params.get('project') : null
  // on a use-case page, its project is highlighted (not aria-current: the page is the use case)
  const ucMatch = pathname.match(/^\/use-cases\/([^/]+)/)
  const ucProject = ucMatch ? (() => { const u = all.find((x) => x.id === decodeURIComponent(ucMatch[1])); return u ? projectOf(u, fallbackName) : null })() : null
  const onUseCases = onList || !!ucMatch || pathname.startsWith('/runs/')

  if (rail) {
    return (
      <Rail
        items={[
          { to: '/', icon: 'list', label: `Use cases${all.length ? ` · ${all.length}` : ''}`, active: onUseCases, current: onList && !project },
          { to: '/connections', icon: 'plug', label: 'Connections', active: pathname.startsWith('/connections'), current: pathname.startsWith('/connections') },
          { to: '/settings', icon: 'gear', label: 'Settings', active: pathname.startsWith('/settings'), current: pathname.startsWith('/settings') },
        ]}
        projects={projects.map((p) => {
          const needInput = p.items.filter((u) => setupState(u, now) === 'data').length
          const settingUp = p.items.some((u) => isAgentSettingUp(u, now))
          const repo = p.name.slice(p.name.lastIndexOf('/') + 1)
          const notes = [`${p.items.length} use ${p.items.length === 1 ? 'case' : 'cases'}`, needInput ? `${needInput} need input` : '', settingUp ? 'setting up' : ''].filter(Boolean)
          return {
            key: p.key, name: p.name, initial: (repo.match(/[a-z0-9]/i)?.[0] ?? '?').toUpperCase(), needInput: needInput > 0, settingUp,
            label: `${p.name} · ${notes.join(' · ')}`,
            on: project === p.name || (!project && ucProject === p.name), current: project === p.name,
          }
        })}
        scan={scan ? `Your agent is scanning · ${scan.setUp} of ${scan.total} set up` : null}
        email={auth.email}
        onSignOut={auth.signOut}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        {header ?? (
          <Link to="/" aria-label="BIY, use cases" className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
            <Logo />
          </Link>
        )}
        <p className="mt-1.5 truncate px-0.5 text-xs text-faint" title={me.data?.workspace.name}>{me.data?.workspace.name ?? ' '}</p>
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-2.5 pt-5 pb-4">
        <div className="space-y-px">
          <NavItem to="/" icon="list" label="Use cases" count={all.length} active={onUseCases} current={onList && !project} />
          <NavItem to="/connections" icon="plug" label="Connections" active={pathname.startsWith('/connections')} current={pathname.startsWith('/connections')} />
          <NavItem to="/settings" icon="gear" label="Settings" active={pathname.startsWith('/settings')} current={pathname.startsWith('/settings')} />
        </div>

        {projects.length > 0 && (
          <Section title="Projects">
            {projects.length > 1 && (
              <Link to="/" aria-current={onList && !project ? 'true' : undefined} className={`${item} ${onList && !project ? 'text-fg' : itemOff}`}>
                <NavIcon name="stack" className="size-4 text-faint" />
                <span className="min-w-0 flex-1 truncate">All projects</span>
              </Link>
            )}
            {projects.map((p) => {
              const needInput = p.items.filter((u) => setupState(u, now) === 'data').length
              const settingUp = p.items.some((u) => isAgentSettingUp(u, now))
              const on = project === p.name || (!project && ucProject === p.name)
              const owner = p.name.includes('/') ? p.name.slice(0, p.name.lastIndexOf('/') + 1) : ''
              const repo = p.name.slice(owner.length)
              return (
                <Link
                  key={p.key} to={projectHref(p.name)} aria-current={project === p.name ? 'page' : undefined}
                  title={p.name} className={`${item} h-auto py-1.5 ${on ? itemOn : itemOff}`}
                >
                  <NavIcon name="repo" className={`size-4 self-start mt-0.5 ${on ? 'text-fg' : 'text-faint group-hover:text-muted'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{owner && <span className="text-faint">{owner}</span>}{repo}</span>
                    {(needInput > 0 || settingUp) && (
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs whitespace-nowrap">
                        {needInput > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-front">
                            <span className="size-1.5 rounded-full bg-front" aria-hidden />{needInput} need input
                          </span>
                        )}
                        {settingUp && (
                          <span className="inline-flex items-center gap-1.5 text-muted">
                            <LiveDot small />setting up
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="self-start mt-px text-xs tabular-nums text-faint">{p.items.length}</span>
                </Link>
              )
            })}
          </Section>
        )}
      </nav>

      {scan && (
        <div className="mx-3 mb-3 rounded-lg border border-line bg-bg/60 px-3 py-2.5 text-[13px]" role="status">
          <p className="flex items-center gap-2 font-medium text-fg"><LiveDot small />Your agent is scanning</p>
          <p className="mt-1 pl-3.5 tabular-nums text-muted">{scan.setUp} of {scan.total} set up</p>
          <div className="mt-2 ml-3.5 h-1 overflow-hidden rounded-full bg-raised" aria-hidden>
            <span className="block h-full bg-win/80 transition-[width] duration-700" style={{ width: `${scan.total ? (scan.setUp / scan.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <div className="border-t border-line px-3 py-3">
        {FIXTURES && (
          <span className="badge mb-2.5" title="Data comes from contract/fixtures. Add ?fixtures=0 to the URL to use the real API.">
            <span className="badge-dot text-signal" />Fixture data
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted" title={auth.email ?? undefined}>{auth.email}</span>
          <button
            type="button" onClick={auth.signOut} title="Sign out"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors outline-none hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-signal/70"
          >
            <NavIcon name="out" className="size-3.5" />Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

type RailItem = { to: string; icon: NavIconName; label: string; active: boolean; current: boolean }
type RailProject = { key: string; name: string; initial: string; label: string; needInput: boolean; settingUp: boolean; on: boolean; current: boolean }

const railBtn = 'relative grid size-9 place-items-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-signal/70'

/** The collapsed sidebar: a 56px rail of icons. Labels show as a tooltip to the right on hover and focus. */
function Rail({ items, projects, scan, email, onSignOut }: {
  items: RailItem[]; projects: RailProject[]; scan: string | null; email: string | null | undefined; onSignOut: () => void
}) {
  const [tip, setTip] = useState<{ label: string; y: number } | null>(null)
  const tipFor = (label: string) => {
    const show = (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect()
      setTip({ label, y: r.top + r.height / 2 })
    }
    return { 'aria-label': label, onMouseEnter: show, onFocus: show, onMouseLeave: () => setTip(null), onBlur: () => setTip(null) }
  }

  return (
    <div className="flex h-full flex-col items-center">
      <Link to="/" className="mt-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-signal/70" {...tipFor('BIY, use cases')}>
        <Mark className="size-8" />
      </Link>

      <nav aria-label="Main" className="mt-5 flex min-h-0 w-full flex-1 flex-col items-center gap-px overflow-y-auto overflow-x-hidden pb-4">
        {items.map((it) => (
          <Link key={it.to} to={it.to} aria-current={it.current ? 'page' : undefined} className={`${railBtn} ${it.active ? itemOn : itemOff}`} {...tipFor(it.label)}>
            <NavIcon name={it.icon} className="size-4" />
          </Link>
        ))}
        {projects.length > 0 && <span aria-hidden className="my-3 h-px w-6 bg-line" />}
        {projects.map((p) => (
          <Link
            key={p.key} to={projectHref(p.name)} aria-current={p.current ? 'page' : undefined}
            className={`${railBtn} ${p.on ? 'bg-raised' : 'hover:bg-raised/60'}`} {...tipFor(p.label)}
          >
            <span className={`grid size-6 place-items-center rounded-md border text-[11px] font-semibold ${p.on ? 'border-line-strong bg-bg text-fg' : 'border-line text-muted'}`}>{p.initial}</span>
            {(p.needInput || p.settingUp) && (
              <span className="absolute top-1 right-1 flex">
                {p.needInput ? <span className="size-1.5 rounded-full bg-front ring-2 ring-panel" /> : <LiveDot small />}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {scan && (
        <span role="status" tabIndex={0} className={`${railBtn} mb-2`} {...tipFor(scan)}>
          <LiveDot />
        </span>
      )}

      <div className="flex w-full flex-col items-center gap-1 border-t border-line py-3">
        {FIXTURES && <span className="size-1.5 rounded-[1px] bg-signal" title="Fixture data" aria-label="Fixture data" />}
        <button type="button" onClick={onSignOut} className={`${railBtn} text-muted hover:bg-raised hover:text-fg`} {...tipFor(email ? `Sign out ${email}` : 'Sign out')}>
          <NavIcon name="out" className="size-4" />
        </button>
      </div>

      {tip && (
        <div
          role="tooltip" style={{ top: tip.y }}
          className="pointer-events-none fixed left-[64px] z-50 -translate-y-1/2 rounded-md whitespace-nowrap border border-line bg-raised px-2 py-1 text-xs text-fg shadow-lg shadow-black/40"
        >
          {tip.label}
        </div>
      )}
    </div>
  )
}
