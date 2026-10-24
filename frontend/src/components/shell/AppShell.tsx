import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Signature } from '@/components/Logo'
import { NavIcon } from './icons'
import { SidebarContent } from './Sidebar'

// App shell: a fixed 240px sidebar from `lg` up; below it a slim top bar whose menu button opens the same
// sidebar as an off-canvas drawer (Esc, the backdrop or any navigation closes it).
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
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
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-50 rounded-md bg-raised px-3 py-2 text-sm text-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>

      {/* desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-panel lg:block">
        <SidebarContent />
      </aside>

      {/* mobile: slim bar */}
      <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line bg-bg/85 px-2 backdrop-blur lg:hidden">
        <button
          ref={menuBtn} type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="app-drawer"
          className="grid size-9 place-items-center rounded-md text-muted transition-colors outline-none hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-signal/70"
        >
          <NavIcon name="menu" className="size-5" />
        </button>
        <Link to="/" aria-label="BIY, use cases" className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
          <Signature className="h-8 text-fg" />
        </Link>
      </header>

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

      <main id="main" className="lg:pl-60">
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  )
}
