import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'
import Login from './pages/Login'
import RunPage from './pages/RunPage'
import UseCasePage from './pages/UseCasePage'
import UseCases from './pages/UseCases'

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  if (!auth.ready) return null
  if (!auth.signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<UseCases />} />
        <Route path="use-cases/:id" element={<UseCasePage />} />
        <Route path="runs/:id" element={<RunPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
