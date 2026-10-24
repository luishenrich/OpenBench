import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button, ErrorNote } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { FIXTURES } from '@/lib/mode'
import { supabase } from '@/lib/supabase'

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
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col justify-between bg-ink px-6 py-10 text-white sm:px-12 lg:py-14">
        <div className="flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="" className="size-7" />
          <span>BIY</span>
        </div>
        <div className="my-14 max-w-xl">
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight [font-stretch:88%] sm:text-[3.4rem]">
            Which open model should do this job?
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">
            BIY finds the LLM calls in your repo and runs open-weight models on your own cases. You get quality, speed
            and cost side by side, and a recommendation you can defend.
          </p>
        </div>
        <ol className="grid max-w-xl gap-4 text-sm text-white/60 sm:grid-cols-3">
          <li><span className="block font-medium text-white">Discover</span>Your coding agent scans the repo through the BIY MCP server.</li>
          <li><span className="block font-medium text-white">Benchmark</span>Candidates run on Nebius and OpenRouter, several times per case.</li>
          <li><span className="block font-medium text-white">Decide</span>Gates, Pareto front and confidence intervals pick the winner.</li>
        </ol>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">{mode === 'signin' ? 'Sign in' : 'Create an account'}</h2>
          <p className="mt-1 text-sm text-muted">
            {mode === 'signin' ? 'Use the email your workspace was set up with.' : 'A workspace is created for you on first sign-in.'}
          </p>

          {supabase ? (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Email</span>
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-rule bg-surface px-3 py-2 outline-none focus:border-accent" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Password</span>
                <input type="password" required minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-rule bg-surface px-3 py-2 outline-none focus:border-accent" />
              </label>
              {error != null && <ErrorNote error={error} />}
              {notice && <p className="rounded-md bg-win-soft px-3 py-2 text-sm text-win">{notice}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
              <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="w-full text-sm text-muted hover:text-ink">
                {mode === 'signin' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
              </button>
            </form>
          ) : (
            <p className="mt-8 text-sm text-muted">Sign-in is not configured in this build (no Supabase URL).</p>
          )}

          {(FIXTURES || import.meta.env.DEV) && (
            <div className="mt-8 border-t border-rule pt-6">
              <Button variant="secondary" className="w-full" onClick={() => { auth.signInDemo(); navigate(from, { replace: true }) }}>
                {FIXTURES ? 'Continue with fixture data' : 'Continue without sign-in'}
              </Button>
              <p className="mt-2 text-xs text-muted">
                {FIXTURES ? 'Shows contract/fixtures without calling the API.' : 'Dev only: needs a local API started with BIY_DEV_NO_AUTH=1.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
