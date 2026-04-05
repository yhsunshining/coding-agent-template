import { useState, useEffect, useRef } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'dashboard-theme'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

/**
 * When `externalTheme` is provided (embedded mode), it takes priority
 * and the dashboard no longer manages theme independently.
 */
export function useTheme(externalTheme?: Theme) {
  const [internalTheme, setInternalTheme] = useState<Theme>(getInitialTheme)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const theme = externalTheme ?? internalTheme

  // Apply data-theme to the scoped container (if provided) or documentElement
  useEffect(() => {
    const target = containerRef.current ?? document.documentElement
    target.setAttribute('data-theme', theme)
    if (!externalTheme) {
      localStorage.setItem(STORAGE_KEY, theme)
    }
  }, [theme, externalTheme])

  const toggleTheme = () => setInternalTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))

  return { theme, toggleTheme, containerRef }
}
