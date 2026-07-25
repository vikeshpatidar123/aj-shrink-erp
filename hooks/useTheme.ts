'use client'

import { useContext, useEffect, useState, useCallback } from 'react'
import type {
  Theme,
  ThemeVariant,
  ColorMode,
  CustomTheme,
  CustomThemeColors,
  ThemeContextValue,
  FontFamily,
  FontSize
} from '@/lib/theme/types'
import {
  getSystemTheme,
  applyCustomTheme,
  removeCustomTheme,
  getThemeClassName,
  validateTheme,
  generateColorVariants
} from '@/lib/theme/utils'
import { THEME_CONFIG, LocalThemeStorage, FONT_FAMILIES, FONT_SCALES } from '@/lib/theme/types'
import { ThemeContext } from '@/contexts/ThemeContext'

// Default theme
const DEFAULT_THEME: Theme = {
  variant: 'default',
  mode: 'light',
  fontFamily: 'system',
  fontSize: 'normal'
}

/**
 * Hook for managing theme state
 * This is the main interface for theme management in the application
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

/**
 * Low-level theme hook for internal use or when provider is not needed
 * Most components should use useTheme() instead
 */
export function useThemeState(
  defaultTheme: Theme = DEFAULT_THEME,
  storageKey: string = THEME_CONFIG.storageKey,
  enableSystem: boolean = true
) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [customTheme, setCustomThemeState] = useState<CustomTheme | null>(null)
  const [isSystemPreference, setIsSystemPreference] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Create storage instance only once to prevent infinite re-renders
  const storage = useState(() => new LocalThemeStorage())[0]

  // Initialize theme from storage or system preference
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        // Try to load saved theme
        const savedTheme = await storage.getTheme(storageKey)
        const savedCustomTheme = await storage.getCustomTheme(storageKey)

        if (savedTheme) {
          setThemeState(savedTheme)
          if (savedCustomTheme) {
            setCustomThemeState(savedCustomTheme)
            applyCustomTheme(savedCustomTheme)
          }
        } else if (enableSystem) {
          // Fall back to system preference
          const systemMode = getSystemTheme()
          const systemTheme: Theme = { ...defaultTheme, mode: systemMode }
          setThemeState(systemTheme)
          setIsSystemPreference(true)
        }
      } catch (error) {
        // Fall back to default
        setThemeState(defaultTheme)
      } finally {
        setIsInitialized(true)
      }
    }

    initializeTheme()
  }, [defaultTheme, storageKey, enableSystem, storage])

  // Apply theme to document
  useEffect(() => {
    if (!isInitialized) return

    const root = document.documentElement
    const themeClass = getThemeClassName(theme)

    // Remove all existing theme classes
    const existingClasses = Array.from(root.classList).filter(cls =>
      cls.startsWith('theme-') || cls === 'light' || cls === 'dark'
    )
    root.classList.remove(...existingClasses)

    // Add new theme classes
    root.classList.add(...themeClass.split(' '))

    // Apply custom theme if needed
    if (theme.variant === 'custom' && customTheme) {
      applyCustomTheme(customTheme)
    } else {
      removeCustomTheme()
    }

    // Apply font family CSS variable
    const fontFamily = theme.fontFamily || 'system'
    const fontConfig = FONT_FAMILIES[fontFamily]
    root.style.setProperty('--font-family-base', fontConfig.value)

    // Apply font size scale CSS variable
    // Priority: custom fontScale > fontSize preset
    if (theme.fontScale !== undefined) {
      const scale = theme.fontScale / 100
      root.style.setProperty('--font-scale', scale.toString())
    } else {
      const fontSize = theme.fontSize || 'normal'
      const scaleConfig = FONT_SCALES[fontSize]
      root.style.setProperty('--font-scale', scaleConfig.scale.toString())
    }
  }, [theme, customTheme, isInitialized])

  // Listen for system theme changes
  useEffect(() => {
    if (!enableSystem || !isSystemPreference) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      const newMode: ColorMode = e.matches ? 'dark' : 'light'
      setThemeState(prev => ({ ...prev, mode: newMode }))
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [enableSystem, isSystemPreference])

  // Theme setters
  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme)
    setIsSystemPreference(false)

    try {
      await storage.setTheme(storageKey, newTheme)
    } catch (error) {
      console.error('Failed to save theme:', error)
    }
  }, [storageKey, storage])

  const setVariant = useCallback((variant: ThemeVariant) => {
    setTheme({ ...theme, variant })
  }, [theme, setTheme])

  const setMode = useCallback((mode: ColorMode) => {
    setTheme({ ...theme, mode })
  }, [theme, setTheme])

  const toggleMode = useCallback(() => {
    const newMode: ColorMode = theme.mode === 'light' ? 'dark' : 'light'
    setMode(newMode)
  }, [theme.mode, setMode])

  const setFontFamily = useCallback((fontFamily: FontFamily) => {
    setTheme({ ...theme, fontFamily })
  }, [theme, setTheme])

  const setFontSize = useCallback((fontSize: FontSize) => {
    setTheme({ ...theme, fontSize, fontScale: undefined })  // Clear custom scale when using preset
  }, [theme, setTheme])

  const setFontScale = useCallback((scale: number) => {
    // Clamp scale to valid range (80-150)
    const clampedScale = Math.max(80, Math.min(150, scale))
    setTheme({ ...theme, fontScale: clampedScale, fontSize: undefined })  // Clear preset when using custom scale
  }, [theme, setTheme])

  // Custom theme management
  const setCustomTheme = useCallback(async (colors: CustomThemeColors, name?: string) => {
    // Validate the custom theme
    const validation = validateTheme(colors, theme.mode)
    if (!validation.isValid) {
      // You might want to show user feedback here
    }

    const newCustomTheme: CustomTheme = {
      ...colors,
      name: name || 'Custom Theme',
      id: `custom-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    setCustomThemeState(newCustomTheme)
    await setTheme({ ...theme, variant: 'custom' })

    try {
      await storage.setCustomTheme(storageKey, newCustomTheme)
    } catch (error) {
      console.error('Failed to save custom theme:', error)
    }
  }, [theme, setTheme, storageKey, storage])

  const removeCustomThemeCallback = useCallback(async () => {
    setCustomThemeState(null)
    removeCustomTheme()

    // Switch to default theme as fallback
    await setTheme({ ...theme, variant: 'default' })

    try {
      const currentTheme = await storage.getTheme(storageKey)
      if (currentTheme) {
        await storage.setTheme(storageKey, { ...currentTheme, variant: 'default' })
      }
    } catch (error) {
      console.error('Failed to remove custom theme:', error)
    }
  }, [theme, setTheme, storageKey, storage])

  return {
    theme,
    setTheme,
    setVariant,
    setMode,
    toggleMode,
    setFontFamily,
    setFontSize,
    setFontScale,
    customTheme,
    setCustomTheme,
    removeCustomTheme: removeCustomThemeCallback,
    isDark: theme.mode === 'dark',
    isSystemPreference,
    availableThemes: [...THEME_CONFIG.variants],
    currentThemeClass: getThemeClassName(theme),
  }
}

/**
 * Hook for generating custom themes from a base color
 */
export function useCustomThemeGenerator() {
  const { setCustomTheme } = useTheme()

  const generateFromColor = useCallback((baseColor: string, name?: string) => {
    try {
      const variants = generateColorVariants(baseColor)
      setCustomTheme(variants, name)
      return { success: true, variants }
    } catch (error) {
      console.error('Failed to generate custom theme:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [setCustomTheme])

  const validateColor = useCallback((colors: CustomThemeColors, mode: ColorMode = 'light') => {
    return validateTheme(colors, mode)
  }, [])

  return {
    generateFromColor,
    validateColor,
    generateColorVariants,
  }
}

/**
 * Hook for theme-aware animations
 */
export function useThemeTransitions() {
  const { isDark } = useTheme()
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    setIsTransitioning(true)
    const timeout = setTimeout(() => setIsTransitioning(false), 150)
    return () => clearTimeout(timeout)
  }, [isDark])

  return {
    isTransitioning,
    transitionClass: isTransitioning ? 'transition-colors duration-150' : ''
  }
}

/**
 * Hook for persisting theme across sessions (multi-tenant support)
 */
export function useThemePersistence(tenantId?: string) {
  const { theme, setTheme } = useTheme()
  const storageKey = tenantId ? `${THEME_CONFIG.storageKey}-${tenantId}` : THEME_CONFIG.storageKey

  const saveThemeForTenant = useCallback(async (theme: Theme) => {
    const storage = new LocalThemeStorage()
    await storage.setTheme(storageKey, theme)
  }, [storageKey])

  const loadThemeForTenant = useCallback(async (): Promise<Theme | null> => {
    const storage = new LocalThemeStorage()
    return await storage.getTheme(storageKey)
  }, [storageKey])

  return {
    saveThemeForTenant,
    loadThemeForTenant,
    currentStorageKey: storageKey,
  }
}