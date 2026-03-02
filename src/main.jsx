import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LoginPage from './components/LoginPage.jsx'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'

/**
 * RootRouter
 *
 * Handles two paths:
 *   /login  → LoginPage
 *   *       → App (main portfolio app, available to guests and authenticated users)
 *
 * No router library is used — the app has no deep linking requirements beyond /login.
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
