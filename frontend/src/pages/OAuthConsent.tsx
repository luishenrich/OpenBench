// OAuth consent screen for MCP clients (Claude Code, Cursor, ...). Supabase Auth's OAuth 2.1 server sends
// the browser here as /oauth/consent?authorization_id=…; we show who is asking and approve or deny it.
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Backdrop from '@/components/Backdrop'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { FIXTURES } from '@/lib/mode'
import { supabase } from '@/lib/supabase'

// Local copies of the supabase-js shapes (@supabase/auth-js lib/types.ts).
interface AuthorizationDetails {
  authorization_id: string
  redirect_uri: string
  client: { id: string; name: string; uri: string; logo_uri: string }
  user: { id: string; email: string }
  scope: string
}
type DetailsResult = { kind: 'consent'; details: AuthorizationDetails } | { kind: 'redirect'; url: string }

type Phase =
  | { step: 'idle' }
  | { step: 'busy'; action: 'approve' | 'deny' }
  | { step: 'done'; action: 'approve' | 'deny'; url: string }

const EXPIRED = 'This sign-in link expired. Start the connection again from your agent.'

class ConsentError extends Error {}

// Fixture mode: ?authorization_id=expired forces the error state, anything else shows a fake request.
const FAKE: AuthorizationDetails = {
  authorization_id: 'demo',
  redirect_uri: 'http://localhost:54321/callback',
  client: { id: '00000000-0000-0000-0000-000000000000', name: 'Claude Code', uri: 'https://claude.com/claude-code', logo_uri: '' },
  user: { id: 'demo', email: 'demo@biy.dev' },
  scope: 'openid email profile',
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchDetails(id: string): Promise<DetailsResult> {
  if (FIXTURES) {
    await wait(250)
    if (id === 'expired') throw new ConsentError(EXPIRED)
    return { kind: 'consent', details: { ...FAKE, authorization_id: id } }
  }
  if (!supabase) throw new ConsentError('Sign-in is not configured in this build.')
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id)
  if (error || !data) {
    if (error?.name === 'AuthSessionMissingError') throw new ConsentError('Your session ended. Sign in again, then start the connection again from your agent.')
    throw new ConsentError(EXPIRED)
  }
  if ('authorization_id' in data) return { kind: 'consent', details: data }
  return { kind: 'redirect', url: data.redirect_url } // already approved before: go straight back to the client
}

async function decide(id: string, action: 'approve' | 'deny'): Promise<string> {
  if (FIXTURES) {
    await wait(900)
    return `${FAKE.redirect_uri}?${action === 'approve' ? 'code=demo-code' : 'error=access_denied'}&state=demo`
  }
  if (!supabase) throw new ConsentError('Sign-in is not configured in this build.')
  const call = action === 'approve' ? supabase.auth.oauth.approveAuthorization : supabase.auth.oauth.denyAuthorization
  const { data, error } = await call(id, { skipBrowserRedirect: true })
  if (error || !data?.redirect_url) throw new ConsentError(EXPIRED)
  return data.redirect_url
}

/** "localhost:54321" for web redirects, "cursor://" for app schemes. */
function describeRedirect(uri: string): { label: string; local: boolean } {
  try {
    const u = new URL(uri)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return { label: u.host, local: ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) }
    }
    return { label: `${u.protocol}//`, local: true }
  } catch {
    return { label: uri, local: false }
  }
}

function hostOf(uri: string): string | null {
  try { return new URL(uri).host } catch { return null }
}

/** Send the browser back to the client. The page stays visible for app schemes and stays put in fixture mode. */
function follow(url: string) {
  if (!FIXTURES) window.location.assign(url)
}

const CAN = [
  'Read and create use cases and test cases',
  'Start benchmark runs. Runs cost money, so each one shows you an estimate and waits for your confirmation.',
  'Read results and recommendations',
]

export default function OAuthConsent() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const id = params.get('authorization_id') ?? ''
  const here = location.pathname + location.search
  const [phase, setPhase] = useState<Phase>({ step: 'idle' })
  const [actionError, setActionError] = useState<string | null>(null)

  const details = useQuery({
    queryKey: ['oauth-authorization', id],
    queryFn: () => fetchDetails(id),
    enabled: auth.signedIn && id !== '',
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: auth.signedIn, retry: false })

  const result = details.data
  useEffect(() => {
    if (result?.kind === 'redirect') follow(result.url)
  }, [result])

  if (!auth.ready) return null
  if (!auth.signedIn) return <Navigate to="/login" replace state={{ from: here }} />

  async function run(action: 'approve' | 'deny') {
    setActionError(null)
    setPhase({ step: 'busy', action })
    try {
      const url = await decide(id, action)
      setPhase({ step: 'done', action, url })
      follow(url)
    } catch (err) {
      setPhase({ step: 'idle' })
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  async function switchAccount() {
    await auth.signOut()
    navigate('/login', { replace: true, state: { from: here } })
  }

  let body: ReactNode
  if (!id) {
    body = <Problem title="Nothing to approve" text="This link is missing its sign-in request. Start the connection again from your agent." />
  } else if (details.isPending) {
    body = <p className="py-6 text-sm text-muted">Checking the request…</p>
  } else if (details.isError) {
    body = <Problem title="Link expired" text={details.error instanceof ConsentError ? details.error.message : EXPIRED} />
  } else if (result?.kind === 'redirect') {
    body = <Finished approved redirect={result.url} />
  } else if (phase.step === 'done') {
    body = <Finished approved={phase.action === 'approve'} redirect={phase.url} />
  } else {
    const d = result!.details
    const redirect = describeRedirect(d.redirect_uri)
    const site = d.client.uri ? hostOf(d.client.uri) : null
    const scopes = d.scope.split(/\s+/).filter(Boolean)
    const busy = phase.step === 'busy'
    body = (
      <>
        <div className="flex items-start gap-4">
          <ClientMark name={d.client.name} logo={d.client.logo_uri} />
          <div className="min-w-0">
            <h1 className="title text-xl leading-snug text-pretty">
              <span className="text-fg">{d.client.name || 'An MCP client'}</span>{' '}
              <span className="text-muted">wants to access your BIY workspace</span>
            </h1>
            <p className="mt-1.5 text-xs text-faint">
              {site && <>{site}<span className="mx-1.5">·</span></>}Redirects to <span className="font-mono text-muted">{redirect.label}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-line bg-bg px-3.5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm text-fg">{d.user.email || auth.email}</div>
            <div className="mt-0.5 truncate text-xs text-faint">
              {me.data ? <>Workspace <span className="text-muted">{me.data.workspace.name}</span></> : me.isPending ? 'Loading workspace…' : 'Your workspace'}
            </div>
          </div>
          <button type="button" onClick={switchAccount} className="shrink-0 text-xs text-muted hover:text-fg">Not you? Switch account</button>
        </div>

        <div className="mt-6">
          <h2 className="text-xs font-medium tracking-wide text-faint uppercase">It will be able to</h2>
          <ul className="mt-3 space-y-2.5">
            {CAN.map((line) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-muted">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-[1px] bg-win" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          {scopes.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-faint">Scopes</span>
              {scopes.map((s) => (
                <code key={s} className="rounded-[5px] border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">{s}</code>
              ))}
            </div>
          )}
        </div>

        {actionError && <p role="alert" className="mt-5 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{actionError}</p>}

        <div className="mt-7 flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={() => run('deny')} disabled={busy}>
            {busy && phase.action === 'deny' ? 'Denying…' : 'Deny'}
          </Button>
          <Button className="flex-1" onClick={() => run('approve')} disabled={busy} autoFocus>
            {busy && phase.action === 'approve' ? <><Spinner /> Connecting…</> : 'Allow'}
          </Button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-faint text-pretty">
          Only allow this if you just started the connection from your agent. The app name is provided by the app itself.
        </p>
      </>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Backdrop className="opacity-60" shift={[-5, 1]} />
      <div className="relative mx-auto flex max-w-[1240px] items-center px-4 py-5 sm:px-6">
        <Logo />
      </div>
      <main className="relative mx-auto flex max-w-[1240px] justify-center px-4 pt-10 pb-20 sm:px-6 lg:pt-16">
        <div className="w-full max-w-[460px] rounded-xl border border-line bg-panel/90 p-6 backdrop-blur sm:p-7">{body}</div>
      </main>
    </div>
  )
}

function ClientMark({ name, logo }: { name: string; logo: string }) {
  const [broken, setBroken] = useState(false)
  if (logo && !broken) {
    return <img src={logo} alt="" onError={() => setBroken(true)} className="size-11 shrink-0 rounded-lg border border-line bg-raised object-contain p-1.5" />
  }
  return (
    <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-lg font-semibold text-fg">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

function Spinner() {
  return <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
}

function Problem({ title, text }: { title: string; text: string }) {
  return (
    <div role="alert">
      <span className="inline-flex size-9 items-center justify-center rounded-lg border border-bad/40 bg-bad/10 text-bad" aria-hidden>!</span>
      <h1 className="title mt-4 text-xl">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">{text}</p>
    </div>
  )
}

function Finished({ approved, redirect }: { approved: boolean; redirect: string }) {
  const { local } = describeRedirect(redirect)
  return (
    <div role="status">
      <span
        aria-hidden
        className={`inline-flex size-9 items-center justify-center rounded-lg border ${approved ? 'border-win/40 bg-win/10 text-win' : 'border-line bg-raised text-muted'}`}
      >
        {approved ? '✓' : '×'}
      </span>
      <h1 className="title mt-4 text-xl">{approved ? 'Access granted' : 'Access denied'}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">
        {approved
          ? local ? 'Connected. You can close this tab and return to your agent.' : 'Connected. Taking you back to the app…'
          : 'Nothing was shared. You can close this tab.'}
      </p>
    </div>
  )
}
