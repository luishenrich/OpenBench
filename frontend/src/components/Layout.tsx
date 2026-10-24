import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { FIXTURES } from '@/lib/mode'
import { Logo } from './Logo'

const pill = 'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors'

export default function Layout() {
  const auth = useAuth()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="BIY home"><Logo /></Link>
          <nav className="ml-3 flex items-center gap-1.5">
            <NavLink to="/" end className={({ isActive }) => `${pill} ${isActive ? 'border-line-strong bg-raised text-fg' : 'border-line bg-panel text-muted hover:text-fg'}`}>
              Use cases
            </NavLink>
          </nav>
          {FIXTURES && (
            <span className="badge hidden sm:inline-flex" title="Data comes from contract/fixtures. Add ?fixtures=0 to the URL to use the real API.">
              <span className="badge-dot text-signal" />Fixture data
            </span>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted md:inline">{me.data?.workspace.name}</span>
            <span className="hidden text-faint lg:inline">{auth.email}</span>
            <button onClick={auth.signOut} className={`${pill} border-line bg-panel text-muted hover:text-fg`}>Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
