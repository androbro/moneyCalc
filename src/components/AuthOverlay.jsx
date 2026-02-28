/**
 * AuthOverlay.jsx
 *
 * A modal overlay for owner login / logout.
 * Opened by clicking the lock icon in the sidebar footer.
 *
 * Props:
 *   open       – boolean
 *   onClose    – () => void
 *   onLogin    – async (password: string) => boolean  — returns true on success
 *   onLogout   – () => void
 *   isOwner    – boolean
 *   onReset    – async () => void — resets guest data to owner's Supabase snapshot
 */

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { authEnabled } from '../lib/auth'

export default function AuthOverlay({ open, onClose, onLogin, onLogout, isOwner, onReset }) {
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const inputRef = useRef(null)

  // Focus input when opened
  useEffect(() => {
    if (open && !isOwner) setTimeout(() => inputRef.current?.focus(), 80)
    if (!open) { setPassword(''); setError(''); setResetDone(false) }
  }, [open, isOwner])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError('')
    const ok = await onLogin(password)
    setLoading(false)
    if (ok) {
      setPassword('')
      onClose()
    } else {
      setError('Incorrect password.')
      setPassword('')
    }
  }

  const handleReset = async () => {
    setResetting(true)
    await onReset()
    setResetting(false)
    setResetDone(true)
    setTimeout(() => setResetDone(false), 3000)
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center
              ${isOwner ? 'bg-emerald-900/40 border border-emerald-700/40' : 'bg-slate-800 border border-slate-700'}`}>
              {isOwner ? <UnlockIcon /> : <LockIcon />}
            </div>
            <div>
              <p className="font-semibold text-white text-sm">
                {isOwner ? 'Owner Mode' : 'Guest Mode'}
              </p>
              <p className="text-xs text-slate-400">
                {isOwner ? 'Full access — changes saved to Supabase' : 'Changes saved to local storage only'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isOwner ? (
          /* ── Owner panel ── */
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              You are logged in as owner. Changes persist to Supabase and the Gemini AI chat is enabled.
            </p>
            <button
              onClick={onLogout}
              className="w-full py-2.5 rounded-xl border border-slate-600 text-sm text-slate-300
                         hover:text-white hover:border-slate-400 transition-colors"
            >
              Log out (switch to guest mode)
            </button>
          </div>
        ) : (
          /* ── Guest panel ── */
          <div className="space-y-4">
            {/* Guest info */}
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 space-y-1.5 text-xs text-slate-300">
              <p className="font-medium text-slate-200">You are in guest mode</p>
              <p className="text-slate-400 leading-relaxed">
                You can freely explore and edit all data — your changes are stored in
                this browser only and never touch the real database.
              </p>
              <p className="text-slate-400 leading-relaxed">
                Use the <span className="text-amber-300 font-medium">Reset button</span> below
                to reload a fresh copy of the owner's data at any time.
              </p>
            </div>

            {/* Reset button */}
            <button
              onClick={handleReset}
              disabled={resetting}
              className={`w-full py-2.5 rounded-xl border text-sm font-medium transition-colors
                ${resetDone
                  ? 'border-emerald-600 text-emerald-300 bg-emerald-900/20'
                  : 'border-amber-700/60 text-amber-300 hover:border-amber-500 hover:bg-amber-900/10'}`}
            >
              {resetting ? 'Resetting…' : resetDone ? 'Reset — done!' : 'Reset to owner\'s data'}
            </button>

            {/* Login */}
            {authEnabled() && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-slate-900 px-3 text-xs text-slate-500">owner login</span>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError('') }}
                      placeholder="Owner password"
                      className="input w-full pr-4"
                      autoComplete="current-password"
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-red-400">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !password.trim()}
                    className="btn-primary w-full disabled:opacity-40"
                  >
                    {loading ? 'Checking…' : 'Log in as owner'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function LockIcon() {
  return (
    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function UnlockIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  )
}
