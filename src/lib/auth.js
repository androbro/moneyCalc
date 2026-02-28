/**
 * auth.js
 *
 * Lightweight owner-only auth for the public demo deployment.
 *
 * Strategy:
 *   - The owner password lives in VITE_OWNER_PASSWORD (Vercel env var).
 *   - On login we hash the entered password with SHA-256 and compare to the
 *     hash of the env var password. If they match we store a token in
 *     sessionStorage so it survives page refreshes but clears when the tab closes.
 *   - This is soft security — the hash is visible in the bundle. The goal is
 *     to prevent casual visitors from burning the Gemini API key, not to stop
 *     a determined attacker who inspects the source.
 *   - Guests can still use the full app; their changes just stay in localStorage.
 */

const SESSION_KEY = 'mc_owner_authed'

/**
 * True when running on localhost / 127.0.0.1 / local network.
 * On localhost there is no need for guest/owner separation — you are always
 * the owner and the lock UI is hidden entirely.
 */
export function isLocalhost() {
  const { hostname } = window.location
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local')
  )
}

// ─── SHA-256 helper (Web Crypto — available in all modern browsers) ───────────

async function sha256(text) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  )
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true if the current session is authenticated as owner. */
export function isOwner() {
  if (isLocalhost()) return true   // always owner on localhost
  try {
    return sessionStorage.getItem(SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Attempt to authenticate with the given password.
 * Returns true on success, false on wrong password.
 */
export async function login(password) {
  const envPassword = import.meta.env.VITE_OWNER_PASSWORD
  if (!envPassword) {
    // No password configured — never grant owner access
    return false
  }
  const [enteredHash, expectedHash] = await Promise.all([
    sha256(password),
    sha256(envPassword),
  ])
  if (enteredHash === expectedHash) {
    try { sessionStorage.setItem(SESSION_KEY, 'true') } catch { /* ignore */ }
    return true
  }
  return false
}

/** Clear the owner session. */
export function logout() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}

/** True when a password has been configured in the environment. */
export function authEnabled() {
  return Boolean(import.meta.env.VITE_OWNER_PASSWORD)
}
