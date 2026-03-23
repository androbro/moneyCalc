import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LoginPage from './components/LoginPage.jsx'
import SharedPortfolioPage from './components/SharedPortfolioPage.jsx'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'

/**
 * RootRouter
 *
 * Handles the following paths:
 *   /login          → LoginPage
 *   /share/:token   → SharedPortfolioPage (public, no auth required)
 *   *               → App (main portfolio app, available to guests and authenticated users)
 *
 * No router library is used — routing is purely path-based with popstate events.
 */
function RootRouter() {
  const { session, loading } = useAuth()
  const [path, setPath] = useState(window.location.pathname)

  // Listen for pushState / popstate so navigation is reactive
  useEffect(() => {
    const handler = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const isLoginRoute = path === '/login'

  // /share/:token — public, no auth check needed
  const shareMatch = path.match(/^\/share\/(.+)$/)
  if (shareMatch) {
    return <SharedPortfolioPage token={shareMatch[1]} />
  }

  // If the user is already signed in and tries to visit /login, redirect home
  if (!loading && session && isLoginRoute) {
    window.history.replaceState(null, '', '/')
    setPath('/')
    return null
  }

  if (isLoginRoute) {
    return <LoginPage />
  }

  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RootRouter />
    </AuthProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error)
    })
  })
}
