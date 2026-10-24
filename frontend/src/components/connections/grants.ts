// OAuth grants: the MCP clients (Claude Code, Cursor, ...) the user approved on /oauth/consent.
// Supabase Auth is the OAuth 2.1 server; listing and revoking go through supabase.auth.oauth.
// Fixture mode keeps two fake grants in memory so the section can be screenshotted.
import type { OAuthGrant } from '@supabase/supabase-js'
import { slowFor } from '@/lib/fixtures'
import { FIXTURES } from '@/lib/mode'
import { supabase } from '@/lib/supabase'

export type { OAuthGrant }

/** OAuth server off, or this supabase-js build has no grants API: shown as a quiet note, not an error. */
export class GrantsUnavailable extends Error {
  constructor() {
    super('Connected apps are not available on this server.')
    this.name = 'GrantsUnavailable'
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

let fake: OAuthGrant[] = [
  {
    client: { id: '11111111-1111-4111-8111-111111111111', name: 'Claude Code', uri: 'https://claude.com/claude-code', logo_uri: '' },
    scopes: ['openid', 'email', 'profile'],
    granted_at: hoursAgo(2),
  },
  {
    client: { id: '22222222-2222-4222-8222-222222222222', name: 'Cursor', uri: 'https://cursor.com', logo_uri: '' },
    scopes: ['openid', 'email'],
    granted_at: hoursAgo(26 * 3),
  },
]

type AuthErr = { name?: string; message?: string; status?: number; code?: string }

function isOff(e: AuthErr): boolean {
  if (e.status === 404 || e.status === 501) return true
  return /oauth.*(disabled|not enabled|not available)/i.test(e.message ?? '')
}

function plain(e: AuthErr, doing: string): Error {
  if (e.name === 'AuthSessionMissingError') return new Error(`Your session ended. Sign in again to ${doing}.`)
  return new Error(`Couldn't ${doing}${e.message ? `: ${e.message}` : '.'}`)
}

function oauthApi() {
  const api = supabase?.auth.oauth
  if (!api || typeof api.listGrants !== 'function' || typeof api.revokeGrant !== 'function') throw new GrantsUnavailable()
  return api
}

export async function listGrants(): Promise<OAuthGrant[]> {
  if (FIXTURES) {
    await wait(300 + slowFor('grants'))
    return [...fake]
  }
  const { data, error } = await oauthApi().listGrants()
  if (error) throw isOff(error) ? new GrantsUnavailable() : plain(error, 'load your connected apps')
  return [...(data ?? [])].sort((a, b) => b.granted_at.localeCompare(a.granted_at))
}

export async function revokeGrant(clientId: string): Promise<void> {
  if (FIXTURES) {
    await wait(400)
    fake = fake.filter((g) => g.client.id !== clientId)
    return
  }
  const { error } = await oauthApi().revokeGrant({ clientId })
  if (error) throw plain(error, 'revoke this app')
}

/** "just now", "12 min ago", "3 h ago", "4 days ago", else "on 2 Oct" */
export function connectedAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  const d = Math.round(s / 86400)
  if (d < 30) return d === 1 ? 'yesterday' : `${d} days ago`
  return `on ${new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined })}`
}

/** "claude.com" from "https://claude.com/claude-code"; null when there is no usable URI */
export function hostOf(uri: string | null | undefined): string | null {
  if (!uri) return null
  try {
    return new URL(uri).host.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

/** Our own icon for the clients we know by name. */
export function knownIcon(name: string): string | null {
  const n = name.toLowerCase()
  if (n.includes('claude code') || n === 'claude') return '/model-icons/claudecode.svg'
  if (n.includes('cursor')) return '/model-icons/cursor.svg'
  return null
}
