import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Backdrop from '@/components/Backdrop'
import { Logo } from '@/components/Logo'
import { Badge, Button, ErrorNote } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { FIXTURES } from '@/lib/mode'
import { supabase } from '@/lib/supabase'

const field = 'mt-1.5 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-line-strong'

export default function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (auth.signedIn) return <Navigate to={from} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signin') {
        await auth.signIn(email, password)
        navigate(from, { replace: true })
      } else {
        const { needsConfirmation } = await auth.signUp(email, password)
        if (needsConfirmation) setNotice(`Check ${email} for a confirmation link, then sign in.`)
        else navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Backdrop className="opacity-90" shift={[-5, 1]} />
      <div className="relative mx-auto flex max-w-[1240px] items-center px-4 py-5 sm:px-6">
        <Logo />
      </div>

      <div className="relative mx-auto grid max-w-[1240px] gap-14 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.25fr_400px] lg:items-center lg:pt-24">
        <div>
          <Badge tone="signal">Benchmark it yourself</Badge>
          <h1 className="display mt-6 text-5xl sm:text-7xl">Which open model should do this job?</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            BIY finds the LLM calls in your repo and runs open-weight models on your own cases. Quality, speed and cost side by
            side, with a recommendation you can defend.
          </p>
          <dl className="mt-12 grid max-w-xl gap-6 text-sm sm:grid-cols-3">
            <div><dt className="font-medium">Discover</dt><dd className="mt-1 text-muted">Your coding agent scans the repo through the BIY MCP server.</dd></div>
            <div><dt className="font-medium">Benchmark</dt><dd className="mt-1 text-muted">Candidates run on Nebius and OpenRouter, several times per case.</dd></div>
            <div><dt className="font-medium">Decide</dt><dd className="mt-1 text-muted">Gates, the Pareto front and confidence intervals pick the winner.</dd></div>
          </dl>
        </div>

        <div className="rounded-xl border border-line bg-panel/90 p-6 backdrop-blur">
          <h2 className="title text-xl">{mode === 'signin' ? 'Sign in' : 'Create an account'}</h2>
          <p className="mt-1 text-sm text-muted">
            {mode === 'signin' ? 'Use the email your workspace was set up with.' : 'A workspace is created for you on first sign-in.'}
          </p>

          {supabase ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm">
                <span className="text-muted">Email</span>
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Password</span>
                <input type="password" required minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
              </label>
              {error != null && <ErrorNote error={error} />}
              {notice && <p className="rounded-md border border-win/40 bg-win/10 px-3 py-2 text-sm text-win">{notice}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
              <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="w-full text-sm text-muted hover:text-fg">
                {mode === 'signin' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
              </button>
            </form>
          ) : (
            <p className="mt-6 text-sm text-muted">Sign-in is not configured in this build (no Supabase URL).</p>
          )}

          {(FIXTURES || import.meta.env.DEV) && (
            <div className="mt-6 border-t border-line pt-5">
              <Button variant="secondary" className="w-full" onClick={() => { auth.signInDemo(); navigate(from, { replace: true }) }}>
                {FIXTURES ? 'Continue with fixture data' : 'Continue without sign-in'}
              </Button>
              <p className="mt-2 text-xs text-faint">
                {FIXTURES ? 'Shows contract/fixtures without calling the API.' : 'Dev only: needs a local API started with BIY_DEV_NO_AUTH=1.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
