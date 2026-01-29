import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'theme'
export type Theme = 'light' | 'dark'

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return 'light'
}

function applyTheme(value: Theme) {
  document.documentElement.dataset.theme = value
}

export function useTheme(): [Theme, (value: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    applyTheme(getStoredTheme())
  }, [])

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value)
    document.documentElement.dataset.theme = value
    localStorage.setItem(STORAGE_KEY, value)
  }, [])

  return [theme, setTheme]
}
