// Theme system TypeScript definitions

export type ColorMode = 'light' | 'dark'

export type ThemeVariant = 'default' | 'red' | 'green' | 'purple' | 'orange' | 'black' | 'custom'

export type FontFamily =
  | 'system'
  | 'roboto'
  | 'openSans'
  | 'lato'
  | 'poppins'
  | 'montserrat'
  | 'nunito'
  | 'sourceSansPro'
  | 'workSans'
  | 'ubuntu'

export type FontSize =
  | 'small'     // 87.5%
  | 'normal'    // 100%
  | 'large'     // 112.5%
  | 'extraLarge' // 125%

export type Theme = {
  variant: ThemeVariant
  mode: ColorMode
  fontFamily?: FontFamily
  fontSize?: FontSize
  fontScale?: number  // Custom font scale percentage (80-150)
}

export interface CustomThemeColors {
  accent: string
  accentHover: string
  accentSubtle: string
  accentMuted: string
}

export interface CustomTheme extends CustomThemeColors {
  name: string
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface ThemeContextValue {
  // Current theme state
  theme: Theme

  // Theme actions
  setTheme: (theme: Theme) => void
  setVariant: (variant: ThemeVariant) => void
  setMode: (mode: ColorMode) => void
  toggleMode: () => void

  // Font actions
  setFontFamily: (family: FontFamily) => void
  setFontSize: (size: FontSize) => void
  setFontScale: (scale: number) => void  // Custom font scale (80-150)

  // Custom theme management
  customTheme: CustomTheme | null
  setCustomTheme: (colors: CustomThemeColors, name?: string) => void
  removeCustomTheme: () => void

  // Utility functions
  isDark: boolean
  isSystemPreference: boolean

  // Theme metadata
  availableThemes: ThemeVariant[]
  currentThemeClass: string
}

export interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  enableSystem?: boolean
  attribute?: 'class' | 'data-theme'
  defaultMode?: ColorMode
}

// WCAG AA Contrast ratios
export const CONTRAST_RATIOS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3,
  AAA_NORMAL: 7,
  AAA_LARGE: 4.5,
} as const

// Theme configuration
export const THEME_CONFIG = {
  variants: ['default', 'red', 'green', 'purple', 'orange', 'black', 'custom'] as const,
  modes: ['light', 'dark'] as const,
  storageKey: 'erp-theme',
  attribute: 'class' as const,
} as const

// Font configuration interfaces
export interface FontFamilyConfig {
  name: string
  value: string  // CSS font-family value
  description: string
  requiresImport?: boolean  // If needs Google Fonts
}

export interface FontScaleConfig {
  name: string
  scale: number  // Multiplier (0.875 to 1.25)
  description: string
  minSize: string  // WCAG minimum (px)
}

// Font family configurations
export const FONT_FAMILIES: Record<FontFamily, FontFamilyConfig> = {
  system: {
    name: 'System Default',
    value: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    description: 'Inter font (default) - Modern and professional',
    requiresImport: true
  },
  roboto: {
    name: 'Roboto',
    value: '"Roboto", -apple-system, sans-serif',
    description: 'Clean and readable - Google design',
    requiresImport: true
  },
  openSans: {
    name: 'Open Sans',
    value: '"Open Sans", -apple-system, sans-serif',
    description: 'Friendly and approachable - Web standard',
    requiresImport: true
  },
  lato: {
    name: 'Lato',
    value: '"Lato", -apple-system, sans-serif',
    description: 'Elegant and versatile - Corporate',
    requiresImport: true
  },
  poppins: {
    name: 'Poppins',
    value: '"Poppins", -apple-system, sans-serif',
    description: 'Modern geometric - Startups',
    requiresImport: true
  },
  montserrat: {
    name: 'Montserrat',
    value: '"Montserrat", -apple-system, sans-serif',
    description: 'Bold and geometric - Headlines',
    requiresImport: true
  },
  nunito: {
    name: 'Nunito',
    value: '"Nunito", -apple-system, sans-serif',
    description: 'Rounded and friendly - Educational',
    requiresImport: true
  },
  sourceSansPro: {
    name: 'Source Sans Pro',
    value: '"Source Sans Pro", -apple-system, sans-serif',
    description: 'Professional and neutral - Adobe',
    requiresImport: true
  },
  workSans: {
    name: 'Work Sans',
    value: '"Work Sans", -apple-system, sans-serif',
    description: 'Modern and versatile - Digital products',
    requiresImport: true
  },
  ubuntu: {
    name: 'Ubuntu',
    value: '"Ubuntu", -apple-system, sans-serif',
    description: 'Humanist and technical - Linux inspired',
    requiresImport: true
  }
}

// Font scale configurations (WCAG 2.1 Level AA compliant)
export const FONT_SCALES: Record<FontSize, FontScaleConfig> = {
  small: {
    name: 'Small',
    scale: 0.875,
    description: 'Compact - More content visible',
    minSize: '12px'
  },
  normal: {
    name: 'Normal',
    scale: 1.0,
    description: 'Default - Balanced readability',
    minSize: '14px'
  },
  large: {
    name: 'Large',
    scale: 1.125,
    description: 'Comfortable - Easy reading',
    minSize: '16px'
  },
  extraLarge: {
    name: 'Extra Large',
    scale: 1.25,
    description: 'Accessible - Vision assistance',
    minSize: '18px'
  }
}

// Pre-defined theme colors (WCAG AA compliant)
export const THEME_COLORS: Record<Exclude<ThemeVariant, 'custom'>, {
  light: CustomThemeColors
  dark: CustomThemeColors
}> = {
  default: {
    light: {
      accent: '#003366',      // Your preferred navy blue
      accentHover: '#002244', // Darker navy blue
      accentSubtle: '#E6F0FF', // Light blue tint
      accentMuted: '#6699CC',  // Medium blue
    },
    dark: {
      accent: '#4D79A4',      // Lighter navy for dark mode
      accentHover: '#5D89B4', // Hover state for dark mode
      accentSubtle: '#001122', // Very dark navy
      accentMuted: '#336699',  // Muted navy
    }
  },
  red: {
    light: {
      accent: '#EF4444',      // Red-500
      accentHover: '#DC2626', // Red-600
      accentSubtle: '#FEE2E2', // Red-100
      accentMuted: '#FCA5A5',  // Red-300
    },
    dark: {
      accent: '#F87171',      // Red-400
      accentHover: '#EF4444', // Red-500
      accentSubtle: '#7F1D1D', // Red-900
      accentMuted: '#DC2626',  // Red-600
    }
  },
  green: {
    light: {
      accent: '#22C55E',      // Green-500
      accentHover: '#16A34A', // Green-600
      accentSubtle: '#DCFCE7', // Green-100
      accentMuted: '#86EFAC',  // Green-300
    },
    dark: {
      accent: '#4ADE80',      // Green-400
      accentHover: '#22C55E', // Green-500
      accentSubtle: '#14532D', // Green-900
      accentMuted: '#16A34A',  // Green-600
    }
  },
  purple: {
    light: {
      accent: '#A855F7',      // Purple-500
      accentHover: '#9333EA', // Purple-600
      accentSubtle: '#F3E8FF', // Purple-100
      accentMuted: '#C4B5FD',  // Purple-300
    },
    dark: {
      accent: '#C4B5FD',      // Purple-400
      accentHover: '#A855F7', // Purple-500
      accentSubtle: '#581C87', // Purple-900
      accentMuted: '#9333EA',  // Purple-600
    }
  },
  orange: {
    light: {
      accent: '#F97316',      // Orange-500
      accentHover: '#EA580C', // Orange-600
      accentSubtle: '#FED7AA', // Orange-200
      accentMuted: '#FB923C',  // Orange-400
    },
    dark: {
      accent: '#FB923C',      // Orange-400
      accentHover: '#F97316', // Orange-500
      accentSubtle: '#7C2D12', // Orange-900
      accentMuted: '#EA580C',  // Orange-600
    }
  },
  black: {
    light: {
      accent: '#000000',      // Pure Black
      accentHover: '#1F1F1F', // Gray-900
      accentSubtle: '#F5F5F5', // Gray-100
      accentMuted: '#737373',  // Gray-500
    },
    dark: {
      accent: '#404040',      // Gray-700
      accentHover: '#525252', // Gray-600
      accentSubtle: '#0A0A0A', // Almost black
      accentMuted: '#262626',  // Gray-800
    }
  }
}

// Utility type for theme class generation
export type ThemeClass = `theme-${ThemeVariant}` | `theme-${ThemeVariant}.${ColorMode}`

// Color manipulation utilities
export interface RGB {
  r: number
  g: number
  b: number
}

export interface HSL {
  h: number
  s: number
  l: number
}

// Theme validation
export interface ThemeValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  contrastRatio?: number
}

// Storage interface for multi-tenant support
export interface ThemeStorage {
  getTheme: (key: string) => Promise<Theme | null>
  setTheme: (key: string, theme: Theme) => Promise<void>
  getCustomTheme: (key: string) => Promise<CustomTheme | null>
  setCustomTheme: (key: string, theme: CustomTheme) => Promise<void>
  removeTheme: (key: string) => Promise<void>
}

// Local storage implementation
export class LocalThemeStorage implements ThemeStorage {
  async getTheme(key: string): Promise<Theme | null> {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  async setTheme(key: string, theme: Theme): Promise<void> {
    localStorage.setItem(key, JSON.stringify(theme))
  }

  async getCustomTheme(key: string): Promise<CustomTheme | null> {
    try {
      const stored = localStorage.getItem(`${key}-custom`)
      if (!stored) return null
      const parsed = JSON.parse(stored)
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      }
    } catch {
      return null
    }
  }

  async setCustomTheme(key: string, theme: CustomTheme): Promise<void> {
    localStorage.setItem(`${key}-custom`, JSON.stringify(theme))
  }

  async removeTheme(key: string): Promise<void> {
    localStorage.removeItem(key)
    localStorage.removeItem(`${key}-custom`)
  }
}