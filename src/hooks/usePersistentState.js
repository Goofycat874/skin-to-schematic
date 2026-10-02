import { useEffect, useState } from 'react'

export function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeStorage(key, value) {
  try {
    if (value === undefined) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be full or blocked; persistence is a convenience only.
  }
}

// useState that mirrors its value into localStorage. `merge` lets objects
// pick up keys added after the value was first saved.
export function usePersistentState(key, initial, { merge = false } = {}) {
  const [value, setValue] = useState(() => {
    const stored = readStorage(key, undefined)
    if (stored === undefined) return initial
    if (merge && stored && typeof stored === 'object' && !Array.isArray(stored)) {
      return { ...initial, ...stored }
    }
    return stored
  })

  useEffect(() => {
    writeStorage(key, value)
  }, [key, value])

  return [value, setValue]
}
