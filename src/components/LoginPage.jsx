/**
 * LoginPage.jsx
 *
 * Full-page authentication screen.
 * Supports:
 *   - Email + password sign-in
 *   - Email + password sign-up (toggled)
 *   - Google OAuth (one-click)
 *
 * The OAuth redirect URL is derived from window.location so it works on
 * both localhost and the production Vercel deployment without hardcoding.
 */

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [mode, setMode]         = useState('signin')   // 'signin' | 'signup'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')

  const isSignUp = mode === 'signup'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('Check your email for a confirmation link before signing in.')
        setMode('signin')
        setPassword('')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // onAuthStateChange in AuthContext will update session automatically
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    const redirectTo = `${window.location.origin}/`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
    // On success the browser navigates away; no need to reset loading
  }

  return (
    <div className="min-h-screen bg-neo-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neo-text">MoneyCalc</h1>
            <p className="text-neo-muted text-sm">Real Estate Portfolio Tracker</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-neo-surface border border-white/60 rounded-3xl p-6 space-y-5 shadow-neo-lg">

          {/* Mode heading */}
          <div>
            <h2 className="text-lg font-semibold text-neo-text">
              {isSignUp ? 'Create an account' : 'Sign in'}
            </h2>
            <p className="text-neo-muted text-sm mt-0.5">
              {isSignUp
                ? 'Your data is private — only you can see it.'
                : 'Welcome back. Your portfolio is waiting.'}
            </p>
          </div>

          {/* Feedback banners */}
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200/80 px-3 py-2.5 text-sm text-red-800 shadow-neo-inset-sm">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200/80 px-3 py-2.5 text-sm text-emerald-800 shadow-neo-inset-sm">
              {info}
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-2xl
                       bg-neo-surface text-neo-text font-medium text-sm border border-white/60
                       shadow-neo-sm hover:shadow-neo active:shadow-neo-inset-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <span className="w-4 h-4 border-2 border-neo-border border-t-brand-600 rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neo-border/50 shadow-neo-inset-sm" />
            <span className="text-xs text-neo-subtle">or</span>
            <div className="flex-1 h-px bg-neo-border/50 shadow-neo-inset-sm" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-neo-muted mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neo-muted mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder={isSignUp ? 'At least 6 characters' : '••••••••'}
                required
                minLength={6}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="input w-full"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isSignUp ? 'Creating account…' : 'Signing in…'}
                </span>
              ) : (
                isSignUp ? 'Create account' : 'Sign in'
              )}
            </button>
          </form>

          {/* Toggle sign-in / sign-up */}
          <p className="text-center text-sm text-neo-muted">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setError(''); setInfo('') }}
              className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>

        {/* Guest mode note */}
        <p className="text-center text-xs text-neo-subtle">
          Just browsing?{' '}
          <button
            onClick={() => { window.history.pushState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')) }}
            className="text-neo-subtle hover:text-neo-muted underline transition-colors bg-transparent border-0 cursor-pointer"
          >
            Continue as guest
          </button>
          {' '}with demo data — no account needed.
        </p>

      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
