import { useQuery } from '@tanstack/react-query'
import { Link, Outlet } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { FIXTURES } from '@/lib/mode'

export default function Layout() {
  const auth = useAuth()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <img src="/favicon.svg" alt="" className="size-6" />
            <span>BIY</span>
          </Link>
          <span className="hidden text-sm text-muted sm:inline">{me.data?.workspace.name}</span>
          {FIXTURES && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent" title="Data comes from contract/fixtures. Add ?fixtures=0 to the URL to use the real API.">
              Fixture data
            </span>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{auth.email}</span>
            <button onClick={auth.signOut} className="text-muted hover:text-ink">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
