// Theme utility functions

import type {
  RGB,
  HSL,
  ThemeValidationResult,
  CustomThemeColors,
  Theme,
  ThemeVariant,
  ColorMode
} from './types'
import { CONTRAST_RATIOS, THEME_COLORS } from './types'

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16)
    return hex.length === 1 ? "0" + hex : hex
  }).join("")
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h: number, s: number, l: number

  l = (max + min) / 2

  if (max === min) {
    h = s = 0 // achromatic
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
      default: h = 0
    }

    h /= 6
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360
  s /= 100
  l /= 100

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }

  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

/**
 * Calculate relative luminance of a color (WCAG formula)
 */
export function getLuminance(rgb: RGB): number {
  const { r, g, b } = rgb

  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors (WCAG formula)
 */
export function getContrastRatio(rgb1: RGB, rgb2: RGB): number {
  const lum1 = getLuminance(rgb1)
  const lum2 = getLuminance(rgb2)

  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)

  return (brightest + 0.05) / (darkest + 0.05)
}

/**
 * Check if a color combination meets WCAG AA standards
 */
export function meetsContrastRequirement(
  foreground: RGB,
  background: RGB,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  const requirement = level === 'AA'
    ? (isLargeText ? CONTRAST_RATIOS.AA_LARGE : CONTRAST_RATIOS.AA_NORMAL)
    : (isLargeText ? CONTRAST_RATIOS.AAA_LARGE : CONTRAST_RATIOS.AAA_NORMAL)

  return ratio >= requirement
}

/**
 * Generate a darker shade of a color
 */
export function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  hsl.l = Math.max(0, hsl.l - amount)

  const darkened = hslToRgb(hsl.h, hsl.s, hsl.l)
  return rgbToHex(darkened.r, darkened.g, darkened.b)
}

/**
 * Generate a lighter shade of a color
 */
export function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  hsl.l = Math.min(100, hsl.l + amount)

  const lightened = hslToRgb(hsl.h, hsl.s, hsl.l)
  return rgbToHex(lightened.r, lightened.g, lightened.b)
}

/**
 * Generate color variants from a base accent color
 */
export function generateColorVariants(baseHex: string): CustomThemeColors {
  // Ensure we have a valid hex color
  const rgb = hexToRgb(baseHex)
  if (!rgb) {
    throw new Error(`Invalid hex color: ${baseHex}`)
  }

  return {
    accent: baseHex,
    accentHover: darkenColor(baseHex, 10),
    accentSubtle: lightenColor(baseHex, 45),
    accentMuted: lightenColor(baseHex, 25),
  }
}

/**
 * Validate a custom theme for accessibility compliance
 */
export function validateTheme(colors: CustomThemeColors, mode: ColorMode = 'light'): ThemeValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Define background colors for contrast testing
  const backgrounds = {
    light: { r: 255, g: 255, b: 255 }, // white
    dark: { r: 15, g: 23, b: 42 },     // slate-900
  }

  const textColors = {
    light: { r: 17, g: 24, b: 39 },    // gray-900
    dark: { r: 248, g: 250, b: 252 },  // slate-50
  }

  const background = backgrounds[mode]
  const textColor = textColors[mode]

  // Validate accent color
  const accentRgb = hexToRgb(colors.accent)
  if (!accentRgb) {
    errors.push('Invalid accent color format')
    return { isValid: false, errors, warnings }
  }

  // Check contrast ratios
  const accentBgContrast = getContrastRatio(accentRgb, background)
  const accentTextContrast = getContrastRatio(textColor, accentRgb)

  let contrastRatio = Math.min(accentBgContrast, accentTextContrast)

  if (!meetsContrastRequirement(textColor, accentRgb, 'AA', false)) {
    errors.push(`Accent color fails WCAG AA contrast requirement (${contrastRatio.toFixed(2)}:1, minimum 4.5:1)`)
  }

  if (!meetsContrastRequirement(textColor, accentRgb, 'AAA', false)) {
    warnings.push(`Accent color fails WCAG AAA contrast requirement (${contrastRatio.toFixed(2)}:1, minimum 7:1)`)
  }

  // Validate other color variants
  const variants = ['accentHover', 'accentSubtle', 'accentMuted'] as const
  for (const variant of variants) {
    const rgb = hexToRgb(colors[variant])
    if (!rgb) {
      errors.push(`Invalid ${variant} color format`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    contrastRatio
  }
}

/**
 * Get system color scheme preference
 */
export function getSystemTheme(): ColorMode {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Generate CSS custom properties string for a theme
 */
export function generateCustomPropertiesString(colors: CustomThemeColors, mode: ColorMode): string {
  const rgb = (hex: string) => {
    const color = hexToRgb(hex)
    return color ? `${color.r} ${color.g} ${color.b}` : '59 130 246' // fallback to blue
  }

  const prefix = mode === 'dark' ? '--custom-accent-dark' : '--custom-accent'

  return `
    ${prefix}: ${rgb(colors.accent)};
    ${prefix}-hover: ${rgb(colors.accentHover)};
    ${prefix}-subtle: ${rgb(colors.accentSubtle)};
    ${prefix}-muted: ${rgb(colors.accentMuted)};
  `.trim()
}

/**
 * Generate harmonious secondary color by rotating hue
 */
function generateSecondaryColor(hex: string): string {
  const rgbColor = hexToRgb(hex)
  if (!rgbColor) return hex

  const hsl = rgbToHsl(rgbColor.r, rgbColor.g, rgbColor.b)
  // Rotate hue by 30 degrees for analogous harmony
  hsl.h = (hsl.h + 30) % 360
  // Slightly adjust saturation
  hsl.s = Math.max(20, hsl.s - 10)

  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l)
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b)
}

/**
 * Generate harmonious tertiary color by rotating hue opposite direction
 */
function generateTertiaryColor(hex: string): string {
  const rgbColor = hexToRgb(hex)
  if (!rgbColor) return hex

  const hsl = rgbToHsl(rgbColor.r, rgbColor.g, rgbColor.b)
  // Rotate hue by -30 degrees for analogous harmony
  hsl.h = (hsl.h - 30 + 360) % 360
  // Slightly adjust saturation and lightness
  hsl.s = Math.max(20, hsl.s - 10)
  hsl.l = Math.min(90, hsl.l + 5)

  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l)
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b)
}

/**
 * Apply custom theme CSS variables to document
 */
export function applyCustomTheme(colors: CustomThemeColors): void {
  if (typeof document === 'undefined') return

  const rgb = (hex: string) => {
    const color = hexToRgb(hex)
    return color ? `${color.r} ${color.g} ${color.b}` : '59 130 246'
  }

  // Generate secondary and tertiary colors using color theory
  const primary = colors.accent
  const primaryHover = colors.accentHover
  const secondary = generateSecondaryColor(primary)
  const secondaryHover = darkenColor(secondary, 10)
  const tertiary = generateTertiaryColor(primary)
  const tertiaryHover = darkenColor(tertiary, 10)

  let styleEl = document.getElementById('custom-theme-vars') as HTMLStyleElement
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'custom-theme-vars'
    document.head.appendChild(styleEl)
  }

  // Apply to both light and dark modes
  styleEl.textContent = `
    :root.theme-custom.light,
    :root.theme-custom.dark {
      --color-primary: ${rgb(primary)};
      --color-primary-hover: ${rgb(primaryHover)};
      --color-primary-subtle: ${rgb(colors.accentSubtle)};
      --color-primary-muted: ${rgb(colors.accentMuted)};

      --color-secondary: ${rgb(secondary)};
      --color-secondary-hover: ${rgb(secondaryHover)};
      --color-secondary-subtle: ${rgb(lightenColor(secondary, 40))};
      --color-secondary-muted: ${rgb(lightenColor(secondary, 20))};

      --color-tertiary: ${rgb(tertiary)};
      --color-tertiary-hover: ${rgb(tertiaryHover)};
      --color-tertiary-subtle: ${rgb(lightenColor(tertiary, 40))};
      --color-tertiary-muted: ${rgb(lightenColor(tertiary, 20))};

      --color-accent: ${rgb(primary)};
      --bd-accent: ${rgb(primary)};
    }
  `
}

/**
 * Remove custom theme CSS variables
 */
export function removeCustomTheme(): void {
  if (typeof document === 'undefined') return

  const styleEl = document.getElementById('custom-theme-vars')
  if (styleEl) {
    styleEl.remove()
  }
}

/**
 * Generate theme class name
 */
export function getThemeClassName(theme: Theme): string {
  return `theme-${theme.variant} ${theme.mode}`
}

/**
 * Get predefined theme colors
 */
export function getThemeColors(variant: ThemeVariant, mode: ColorMode): CustomThemeColors | null {
  if (variant === 'custom') return null
  return THEME_COLORS[variant][mode]
}

/**
 * Check if device prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}