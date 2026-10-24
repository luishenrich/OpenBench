import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Signature } from '@/components/Logo'
import { Breadcrumb, ScanSignal } from './AppHeader'
import { NavIcon } from './icons'
import { SidebarContent } from './Sidebar'

const COLLAPSED_KEY = 'biy:sidebar-collapsed'
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false } }

/** Desktop sidebar, open (240px) or folded to a 56px icon rail; remembered in this browser. `[` or ⌘B toggles. */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1') } catch { /* storage blocked: lasts for this page view */ }
    return !c
  })
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = !!t.closest?.('input, textarea, select, [contenteditable=true], [contenteditable=""]')
      const cmdB = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b'
      const bracket = e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing
      if (!cmdB && !bracket) return
      if (cmdB && typing) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  return [collapsed, toggle] as const
}

// App shell: a fixed sidebar from `lg` up (240px, or a 56px rail when collapsed), and one sticky header over
// the main area with the breadcrumb. Below `lg` the header's menu button opens the sidebar as an off-canvas
// drawer (Esc, the backdrop or any navigation closes it). --sidebar-w is set for fixed bars that center
// over the main area (`lg:left-(--sidebar-w)`).
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [collapsed, toggleCollapsed] = useCollapsed()
  const location = useLocation()
  const menuBtn = useRef<HTMLButtonElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => setOpen(false), [location.pathname, location.search])

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      closeBtn.current?.focus()
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKey)
      return () => {
        document.body.style.overflow = prev
        window.removeEventListener('keydown', onKey)
      }
    }
    if (wasOpen.current) {
      wasOpen.current = false
      menuBtn.current?.focus()
    }
  }, [open])

  // the drawer is wider than lg, so a resize past it must not leave the page scroll-locked
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 64rem)')
    const on = () => { if (mq.matches) setOpen(false) }
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  return (
    <div className="min-h-screen" style={{ '--sidebar-w': collapsed ? '3.5rem' : '15rem' } as CSSProperties}>
      <a href="#main" className="sr-only z-50 rounded-md bg-raised px-3 py-2 text-sm text-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>

      {/* desktop: the inner box keeps its own width, so the content is revealed or covered while the width animates */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-w) overflow-hidden border-r border-line bg-panel transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block">
        <div className={`h-full ${collapsed ? 'w-14' : 'w-60'}`}>
          <SidebarContent rail={collapsed} />
        </div>
      </aside>

      {/* mobile: drawer (kept mounted so it can slide; `invisible` takes it out of the tab order when closed) */}
      <div className={`fixed inset-0 z-40 lg:hidden ${open ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setOpen(false)} aria-hidden
        />
        <div
          id="app-drawer" role="dialog" aria-modal="true" aria-label="Menu"
          className={`absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-line bg-panel shadow-2xl shadow-black/60 duration-200 ${open ? 'visible translate-x-0 transition-[translate]' : 'invisible -translate-x-full transition-[translate,visibility]'}`}
        >
          <SidebarContent
            header={
              <div className="flex items-start justify-between gap-2">
                <Link to="/" aria-label="BIY, use cases" className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
                  <Signature className="h-10 text-fg" />
                </Link>
                <button
                  ref={closeBtn} type="button" onClick={() => setOpen(false)} aria-label="Close menu"
                  className="grid size-8 place-items-center rounded-md text-muted transition-colors outline-none hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-signal/70"
                >
                  <NavIcon name="x" className="size-4" />
                </button>
              </div>
            }
          />
        </div>
      </div>

      <div className="transition-[padding] duration-200 ease-out motion-reduce:transition-none lg:pl-(--sidebar-w)">
        {/* one header for every page, same height everywhere: menu (mobile) or sidebar toggle (desktop), breadcrumb, scan signal */}
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line bg-bg/85 px-2 backdrop-blur sm:px-3 lg:px-4">
          <button
            ref={menuBtn} type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="app-drawer"
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors outline-none hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-signal/70 lg:hidden"
          >
            <NavIcon name="menu" className="size-[18px]" />
          </button>
          <button
            type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed}
            title={`${collapsed ? 'Expand' : 'Collapse'} sidebar  [  or  ⌘B`}
            className="-ml-1 hidden size-8 shrink-0 place-items-center rounded-md text-faint transition-colors outline-none hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-signal/70 lg:grid"
          >
            <NavIcon name="sidebar" className="size-4" />
          </button>
          <span aria-hidden className="mr-1 h-4 w-px shrink-0 bg-line" />
          <Breadcrumb />
          <ScanSignal />
        </header>

        <main id="main">
          <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
