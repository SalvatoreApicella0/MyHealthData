import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'mhd.theme'

export function readTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // Storage can be unavailable: fall back to the system appearance.
  }
  return 'system'
}

export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement
  if (preference === 'system') {
    delete root.dataset.theme
  } else {
    root.dataset.theme = preference
  }
  root.style.colorScheme = preference === 'system' ? '' : preference
}

export function writeTheme(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Ignore unavailable storage.
  }
  applyTheme(preference)
}

/** Theme follows the iOS behaviour (system) unless the user overrides it. */
export function useTheme(): [ThemePreference, (next: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(() => readTheme())

  useEffect(() => {
    applyTheme(preference)
  }, [preference])

  const update = useCallback((next: ThemePreference) => {
    setPreference(next)
    writeTheme(next)
  }, [])

  return [preference, update]
}
