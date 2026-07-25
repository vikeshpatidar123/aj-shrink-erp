export interface DropdownOption {
  value: string | number
  label: string
  disabled?: boolean
  description?: string
  key?: string // Unique key for React rendering to prevent duplicate key warnings
  image?: string // Optional: image URL or base64 string (will auto-detect base64 format)
}

export interface DropdownProps {
  options: DropdownOption[]
  value?: string | number | string[]
  placeholder?: string
  onValueChange: (value: string | number | string[]) => void
  onOpen?: () => void
  disabled?: boolean
  loading?: boolean
  searchable?: boolean
  clearable?: boolean
  className?: string
  error?: boolean | string
  label?: React.ReactNode
  labelExtra?: React.ReactNode
  required?: boolean
  emptyMessage?: string
  triggerClassName?: string
  autoWidth?: boolean
  customFooter?: React.ReactNode
  multiSelect?: boolean
  maxSelections?: number
  showSelectedCount?: boolean
  showAsTags?: boolean

  // Text Input / Creatable features
  allowTextInput?: boolean
  onCreateOption?: (inputValue: string) => DropdownOption | Promise<DropdownOption>
  createOptionLabel?: string
  allowCustomValues?: boolean

  // Simple custom input (alias for allowTextInput with auto-creation)
  allowCustomInput?: boolean

  // Edit tracking props
  trackEdits?: boolean // Enable edit tracking and highlighting
  originalValue?: string | number | string[] // Original value from database/API (for comparison)
  isEdited?: boolean // External control: mark as edited (overrides internal tracking)

  // Visual customization
  variant?: 'default' | 'compact' | 'detailed'
  size?: 'sm' | 'md' | 'lg'
  contentClassName?: string // Additional class for dropdown content/popover

  // Multi-select specific
  /** Header title for select all section */
  selectAllLabel?: string
  /** Show "ONLY" button on hover (like OTIF) */
  showOnlyButton?: boolean

  // Custom trigger
  /** Custom trigger element - replaces default trigger button */
  customTrigger?: React.ReactNode
}
