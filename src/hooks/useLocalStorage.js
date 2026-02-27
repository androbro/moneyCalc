import { useState, useEffect } from 'react'

/**
 * Generic hook that syncs a state value to localStorage.
 * Swap the read/write calls here to migrate to another storage backend.
 *
 * @param {string} key   - localStorage key
 * @param {*}      initial - initial value if key doesn't exist yet
 */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (err) {
      console.error('[useLocalStorage] Failed to persist:', err)
    }
  }, [key, value])

  return [value, setValue]
}
