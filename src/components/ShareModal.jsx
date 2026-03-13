/**
 * ShareModal.jsx
 *
 * Modal that lets the authenticated owner:
 *   - Generate a public share link (creates a share_token row)
 *   - Toggle which data groups are visible to viewers
 *   - Copy the link to clipboard
 *   - Revoke the link (deletes the token row)
 */

import { useState, useEffect } from 'react'
import {
  getShareToken,
  createShareToken,
  updateSharePermissions,
  revokeShareToken,
} from '../services/portfolioService'

const GROUPS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Overview, net worth summary and KPIs',
  },
  {
    key: 'properties',
    label: 'Properties',
    description: 'Property cards and individual detail pages',
  },
  {
    key: 'financials',
    label: 'Financials',
    description: 'Cash flow, projection chart, investments and growth planner',
  },
  {
    key: 'household',
    label: 'Household',
    description: 'Income, members and savings rate',
  },
]

export default function ShareModal({ onClose }) {
  const [tokenRow, setTokenRow]     = useState(null)   // { id, token, permissions } | null
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking]     = useState(false)
  const [copied, setCopied]         = useState(false)
  const [error, setError]           = useState('')

  // Draft permissions — kept in local state and synced to DB on toggle
  const [perms, setPerms] = useState({
    dashboard:  true,
    properties: true,
    financials: true,
    household:  false,
  })

  // ── Load existing token on mount ──────────────────────────────────────────
  useEffect(() => {
    getShareToken()
      .then(row => {
        if (row) {
          setTokenRow(row)
          setPerms(row.permissions)
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const shareUrl = tokenRow
    ? `${window.location.origin}/share/${tokenRow.token}`
    : null

  // ── Generate link ──────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const row = await createShareToken(perms)
      setTokenRow(row)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Toggle a permission group ──────────────────────────────────────────────
  const handleToggle = async (key) => {
    const next = { ...perms, [key]: !perms[key] }
    setPerms(next)
    if (tokenRow) {
      try {
        const updated = await updateSharePermissions(tokenRow.id, next)
        setTokenRow(updated)
      } catch (err) {
        // Revert on error
        setPerms(perms)
        setError(err.message)
      }
    }
  }

  // ── Copy link ──────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the input text
    }
  }

  // ── Revoke link ────────────────────────────────────────────────────────────
  const handleRevoke = async () => {
    if (!tokenRow) return
    setRevoking(true)
    setError('')
    try {
      await revokeShareToken(tokenRow.id)
      setTokenRow(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">Share portfolio</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Anyone with the link can view — but not edit — your data.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-900/30 border border-red-700/50 px-3 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Permission toggles */}
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
              What viewers can see
            </p>
            <div className="space-y-2">
              {GROUPS.map(group => (
                <button
                  key={group.key}
                  onClick={() => handleToggle(group.key)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl
                             bg-slate-800 hover:bg-slate-750 border border-slate-700
                             transition-colors text-left"
                >
                  <div>
                    <span className="text-sm font-medium text-white">{group.label}</span>
                    <p className="text-xs text-slate-400 mt-0.5">{group.description}</p>
                  </div>
                  {/* Toggle pill */}
                  <div className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ml-4
                                  ${perms[group.key] ? 'bg-brand-600' : 'bg-slate-600'}`}
                       style={{ height: '1.375rem', width: '2.5rem' }}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow
                                      transition-transform duration-200
                                      ${perms[group.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Link area */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tokenRow ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Your share link
              </p>
              {/* URL display + copy */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700
                                rounded-xl text-xs text-slate-300 font-mono truncate">
                  {shareUrl}
                </div>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-colors
                              ${copied
                                ? 'bg-emerald-700 text-white'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Permission changes above take effect immediately — no need to regenerate.
              </p>
              {/* Revoke */}
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="w-full py-2 rounded-xl text-sm font-medium
                           text-red-400 hover:text-red-300 hover:bg-red-900/20
                           border border-red-900/40 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {revoking ? 'Revoking…' : 'Revoke link'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </span>
              ) : (
                'Generate share link'
              )}
            </button>
          )}

        </div>
      </div>
    </div>
  )
}
