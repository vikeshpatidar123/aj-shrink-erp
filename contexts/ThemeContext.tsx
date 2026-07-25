'use client'

import React, { createContext, useEffect } from 'react'
import type { ThemeContextValue, ThemeProviderProps, Theme } from '@/lib/theme/types'
import { useThemeState } from '@/hooks/useTheme'
import { THEME_CONFIG } from '@/lib/theme/types'

// Create the theme context
export const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Theme Provider Component
 *
 * Provides theme context to the entire application.
 * Should be placed at the root of your app, typically in layout.tsx
 *
 * @example
 * ```tsx
 * <ThemeProvider defaultTheme={{ variant: 'blue', mode: 'light' }}>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({
  children,
  defaultTheme = { variant: 'default', mode: 'light' },
  storageKey = THEME_CONFIG.storageKey,
  enableSystem = true,
  attribute = THEME_CONFIG.attribute,
  defaultMode = 'light'
}: ThemeProviderProps) {
  const themeState = useThemeState(defaultTheme, storageKey, enableSystem)

  // Prevent hydration mismatch by not rendering until theme is initialized
  const [isMounted, setIsMounted] = React.useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Provide a stable context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => themeState, [themeState])

  if (!isMounted) {
    // Return a div with the default theme class to prevent flash
    return (
      <div className={`theme-${defaultTheme.variant} ${defaultTheme.mode}`}>
        {children}
      </div>
    )
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Theme Script Component
 *
 * Injects a script to prevent flash of incorrect theme on page load.
 * Should be placed in the <head> of your document, typically in layout.tsx
 *
 * @example
 * ```tsx
 * <html>
 *   <head>
 *     <ThemeScript />
 *   </head>
 *   <body>...</body>
 * </html>
 * ```
 */
export function ThemeScript({
  storageKey = THEME_CONFIG.storageKey,
  defaultTheme = 'default',
  defaultMode = 'light'
}: {
  storageKey?: string
  defaultTheme?: string
  defaultMode?: string
}) {
  const script = `
    (function() {
      try {
        // Get saved theme or use default - no system detection
        var savedTheme;
        try {
          savedTheme = JSON.parse(localStorage.getItem('${storageKey}'));
        } catch (e) {
          savedTheme = null;
        }

        // Force light theme with default variant - this is hardcoded
        var mode = 'light';
        var variant = 'default';

        // Always use default light theme, no exceptions

        // Remove any existing theme classes
        var html = document.documentElement;
        var classList = html.classList;
        var classesToRemove = [];
        for (var i = 0; i < classList.length; i++) {
          var className = classList[i];
          if (className.startsWith('theme-') || className === 'light' || className === 'dark') {
            classesToRemove.push(className);
          }
        }
        classesToRemove.forEach(function(className) {
          html.classList.remove(className);
        });

        // Add new theme classes
        html.classList.add('theme-' + variant, mode);

        // CSS variables are handled by CSS classes, no need to set them here
      } catch (e) {
        // Fallback: ensure we have default classes
        var html = document.documentElement;
        var classList = html.classList;
        var classesToRemove = [];
        for (var i = 0; i < classList.length; i++) {
          var className = classList[i];
          if (className.startsWith('theme-') || className === 'light' || className === 'dark') {
            classesToRemove.push(className);
          }
        }
        classesToRemove.forEach(function(className) {
          html.classList.remove(className);
        });
        html.classList.add('theme-${defaultTheme}', '${defaultMode}');
      }
    })()
  `

  return <script dangerouslySetInnerHTML={{ __html: script }} />
}

/**
 * Higher-Order Component for theme-aware components
 *
 * @example
 * ```tsx
 * const ThemedButton = withTheme(({ theme, ...props }) => (
 *   <button className={theme.isDark ? 'dark-button' : 'light-button'} {...props} />
 * ))
 * ```
 */
export function withTheme<P extends object>(
  Component: React.ComponentType<P & { theme: ThemeContextValue }>
): React.ComponentType<P> {
  return function ThemedComponent(props: P) {
    return (
      <ThemeContext.Consumer>
        {(theme) => {
          if (!theme) {
            throw new Error('withTheme must be used within a ThemeProvider')
          }
          return <Component {...props} theme={theme} />
        }}
      </ThemeContext.Consumer>
    )
  }
}

/**
 * Theme Debug Component
 *
 * Displays current theme information for development purposes.
 * Only renders in development mode.
 *
 * @example
 * ```tsx
 * <ThemeDebug />
 * ```
 */
export function ThemeDebug() {
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <ThemeContext.Consumer>
      {(theme) => {
        if (!theme) return null

        return (
          <div className="fixed bottom-4 right-4 bg-surface border border-bd-default rounded-lg p-4 shadow-lg text-xs font-mono max-w-xs z-50">
            <div className="font-semibold text-fg-default mb-2">Theme Debug</div>
            <div className="space-y-1 text-fg-muted">
              <div>Variant: <span className="text-accent">{theme.theme.variant}</span></div>
              <div>Mode: <span className="text-accent">{theme.theme.mode}</span></div>
              <div>Dark: <span className="text-accent">{theme.isDark.toString()}</span></div>
              <div>System: <span className="text-accent">{theme.isSystemPreference.toString()}</span></div>
              <div>Class: <span className="text-accent">{theme.currentThemeClass}</span></div>
              {theme.customTheme && (
                <div>Custom: <span className="text-accent">{theme.customTheme.name}</span></div>
              )}
            </div>
          </div>
        )
      }}
    </ThemeContext.Consumer>
  )
}