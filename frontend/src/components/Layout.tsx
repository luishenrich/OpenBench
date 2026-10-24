import { Outlet } from 'react-router-dom'
import { AppShell } from './shell/AppShell'

// Signed-in app frame: sidebar (desktop) or top bar + drawer (below lg). /login, /landing and
// /oauth/consent render outside it (see App.tsx).
export default function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
