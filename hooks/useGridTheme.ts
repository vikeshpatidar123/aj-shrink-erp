import { useState, useEffect, useCallback } from 'react'

export type GridTheme = 'light' | 'dark' | 'high-contrast' | 'auto'

interface ThemeConfig {
  theme: GridTheme
  customColors?: Record<string, string>
  autoDetectSystemTheme?: boolean
}

const DEFAULT_CONFIG: ThemeConfig = {
  theme: 'auto',
  autoDetectSystemTheme: true
}

/**
 * Hook for managing grid theme with system preference detection
 * and persistent storage
 */
export function useGridTheme(initialConfig: Partial<ThemeConfig> = {}) {
  const config = { ...DEFAULT_CONFIG, ...initialConfig }

  const [currentTheme, setCurrentTheme] = useState<GridTheme>(() => {
    if (typeof window === 'undefined') return config.theme

    try {
      const stored = localStorage.getItem('grid-theme')
      return (stored as GridTheme) || config.theme
    } catch {
      return config.theme
    }
  })

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  // Detect system theme changes
  useEffect(() => {
    if (!config.autoDetectSystemTheme || typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [config.autoDetectSystemTheme])

  // Determine the actual theme to apply
  const resolvedTheme = currentTheme === 'auto' ? systemTheme : currentTheme

  // Apply theme to document
  useEffect(() => {
    if (typeof document === 'undefined') return

    // Set theme attribute on document root
    document.documentElement.setAttribute('data-theme', resolvedTheme)

    // Also set a class for easier CSS targeting
    document.documentElement.className = document.documentElement.className
      .replace(/theme-\w+/g, '')
      .concat(` theme-${resolvedTheme}`)
      .trim()

    // Store preference
    try {
      localStorage.setItem('grid-theme', currentTheme)
    } catch {
      // Ignore localStorage errors
    }
  }, [currentTheme, resolvedTheme])

  // Apply custom colors
  useEffect(() => {
    if (!config.customColors || typeof document === 'undefined') return

    const root = document.documentElement

    if (config.customColors) {
      Object.entries(config.customColors).forEach(([property, value]) => {
        root.style.setProperty(`--grid-${property}`, value)
      })
    }

    return () => {
      // Cleanup custom properties
      if (config.customColors) {
        Object.keys(config.customColors).forEach(property => {
          root.style.removeProperty(`--grid-${property}`)
        })
      }
    }
  }, [config.customColors])

  // Change theme
  const setTheme = useCallback((newTheme: GridTheme) => {
    setCurrentTheme(newTheme)
  }, [])

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    setCurrentTheme(current => {
      if (current === 'auto') {
        return systemTheme === 'light' ? 'dark' : 'light'
      }
      return current === 'light' ? 'dark' : 'light'
    })
  }, [systemTheme])

  // Reset to auto/system theme
  const resetToSystemTheme = useCallback(() => {
    setCurrentTheme('auto')
  }, [])

  // Get CSS custom properties for the current theme
  const getThemeProperties = useCallback(() => {
    if (typeof window === 'undefined') return {}

    const computedStyle = getComputedStyle(document.documentElement)
    const properties: Record<string, string> = {}

    // Extract all grid-related CSS variables
    const rootStyle = document.documentElement.style
    for (let i = 0; i < rootStyle.length; i++) {
      const property = rootStyle[i]
      if (property.startsWith('--grid-')) {
        properties[property] = computedStyle.getPropertyValue(property).trim()
      }
    }

    return properties
  }, [])

  // Apply custom color overrides
  const setCustomColors = useCallback((colors: Record<string, string>) => {
    if (typeof document === 'undefined') return

    const root = document.documentElement

    Object.entries(colors).forEach(([property, value]) => {
      root.style.setProperty(`--grid-${property}`, value)
    })
  }, [])

  // Clear custom color overrides
  const clearCustomColors = useCallback(() => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const style = root.style

    // Remove all custom grid properties
    for (let i = style.length - 1; i >= 0; i--) {
      const property = style[i]
      if (property.startsWith('--grid-')) {
        style.removeProperty(property)
      }
    }
  }, [])

  // Check if system supports dark mode
  const systemSupportsDarkMode = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').media !== 'not all'

  // Get theme status information
  const themeInfo = {
    current: currentTheme,
    resolved: resolvedTheme,
    isAuto: currentTheme === 'auto',
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isHighContrast: resolvedTheme === 'high-contrast',
    systemTheme,
    systemSupportsDarkMode
  }

  return {
    ...themeInfo,
    setTheme,
    toggleTheme,
    resetToSystemTheme,
    getThemeProperties,
    setCustomColors,
    clearCustomColors
  }
}

// Utility function to get theme-aware CSS classes
export function getThemeClasses(theme: GridTheme = 'auto'): string {
  const classes = ['advanced-data-grid']

  if (theme !== 'auto') {
    classes.push(`theme-${theme}`)
  }

  return classes.join(' ')
}

// Predefined theme configurations
export const THEME_PRESETS = {
  default: {
    theme: 'auto' as GridTheme,
    autoDetectSystemTheme: true
  },

  corporate: {
    theme: 'light' as GridTheme,
    customColors: {
      'accent-primary': '#1e40af',
      'accent-secondary': '#1e3a8a',
      'header-bg': '#f8fafc',
      'border-primary': '#e2e8f0'
    }
  },

  minimal: {
    theme: 'light' as GridTheme,
    customColors: {
      'border-primary': '#f1f5f9',
      'header-bg': '#ffffff',
      'bg-hover': '#fafafa'
    }
  },

  vibrant: {
    theme: 'dark' as GridTheme,
    customColors: {
      'accent-primary': '#8b5cf6',
      'accent-secondary': '#a78bfa',
      'bg-selected': '#5b21b6'
    }
  }
} as const