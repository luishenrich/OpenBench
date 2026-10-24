import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { FIXTURES } from './mode'
import { supabase } from './supabase'

interface AuthState {
  ready: boolean
  signedIn: boolean
  email: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signInDemo: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const DEMO_KEY = 'biy:demo-session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [demo, setDemo] = useState(() => {
    try { return FIXTURES && sessionStorage.getItem(DEMO_KEY) === '1' } catch { return false }
  })
  const [ready, setReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const state: AuthState = {
    ready,
    signedIn: demo || !!session,
    email: demo ? 'demo@biy.dev' : session?.user.email ?? null,
    async signIn(email, password) {
      if (!supabase) throw new Error('Supabase is not configured for this build.')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email, password) {
      if (!supabase) throw new Error('Supabase is not configured for this build.')
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      return { needsConfirmation: !data.session }
    },
    signInDemo() {
      try { sessionStorage.setItem(DEMO_KEY, '1') } catch { /* ignore */ }
      setDemo(true)
    },
    async signOut() {
      try { sessionStorage.removeItem(DEMO_KEY) } catch { /* ignore */ }
      setDemo(false)
      if (supabase) await supabase.auth.signOut()
    },
  }
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
