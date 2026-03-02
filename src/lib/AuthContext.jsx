/**
 * AuthContext.jsx
 *
 * Provides the Supabase auth session throughout the app.
 *
 * Exports:
 *   AuthProvider  – wrap <App> with this
 *   useAuth()     – { session, user, loading, signOut }
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(undefined)  // undefined = still loading
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    // Grab the current session on mount (handles OAuth redirect callbacks too)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for sign-in / sign-out / token-refresh events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
