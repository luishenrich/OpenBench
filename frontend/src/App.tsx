import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'
import Connections from './pages/Connections'
import Landing from './pages/Landing'
import Login from './pages/Login'
import OAuthConsent from './pages/OAuthConsent'
import RunPage from './pages/RunPage'
import Settings from './pages/Settings'
import UseCasePage from './pages/UseCasePage'
import UseCases from './pages/UseCases'

// Signed in: the app. Signed out: the landing page at "/", the login page everywhere else.
function Gate() {
  const auth = useAuth()
  const location = useLocation()
  if (!auth.ready) return null
  if (auth.signedIn) return <Layout />
  if (location.pathname === '/') return <Landing />
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/oauth/consent" element={<OAuthConsent />} />
      <Route path="/" element={<Gate />}>
        <Route index element={<UseCases />} />
        <Route path="use-cases/:id" element={<UseCasePage />} />
        <Route path="runs/:id" element={<RunPage />} />
        <Route path="connections" element={<Connections />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
