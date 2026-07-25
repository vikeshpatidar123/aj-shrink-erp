'use client'

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Search, X, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { DropdownProps, DropdownOption } from './types'
import { MultiSelect } from './MultiSelect'
import { SingleSelect } from './SingleSelect'
import { useDropdownState } from './hooks/useDropdownState'
import { useDropdownCreate } from './hooks/useDropdownCreate'
import { useDropdownFiltering } from './hooks/useDropdownFiltering'
import { ImageModal } from '@/components/modals/ImageModal'

/**
 * Utility: Check if a string is a base64 image
 * Detects both data URI format and raw base64 strings
 */
export function isBase64Image(str: string | undefined): boolean {
  if (!str) return false

  // Check for data URI format: data:image/...;base64,
  if (str.startsWith('data:image/')) return true

  // Check for raw base64 string (starts with common base64 image prefixes)
  // Common base64 image starts: /9j/ (JPEG), iVBOR (PNG), R0lG (GIF), UklG (WebP)
  const base64ImagePrefixes = ['/9j/', 'iVBOR', 'R0lG', 'UklG']
  return base64ImagePrefixes.some(prefix => str.startsWith(prefix))
}

/**
 * Utility: Convert raw base64 string to data URI
 * If already a data URI, returns as-is
 */
export function getImageSrc(imageString: string | undefined): string | undefined {
  if (!imageString) return undefined

  // Skip if it looks like regular text (not base64)
  if (imageString.length < 20 || /^[a-zA-Z\s]+$/.test(imageString)) {
    return undefined
  }

  // Already a data URI, return as-is
  if (imageString.startsWith('data:')) return imageString

  // Already a URL (http/https), return as-is
  if (imageString.startsWith('http://') || imageString.startsWith('https://')) return imageString

  // Assume it's a raw base64 string - convert to data URI
  // Try to detect image type from base64 prefix
  if (imageString.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${imageString}`
  } else if (imageString.startsWith('iVBOR')) {
    return `data:image/png;base64,${imageString}`
  } else if (imageString.startsWith('R0lG')) {
    return `data:image/gif;base64,${imageString}`
  } else if (imageString.startsWith('UklG')) {
    return `data:image/webp;base64,${imageString}`
  }

  // Default to PNG for unknown base64 (most common for backend-generated images)
  return `data:image/png;base64,${imageString}`
}

/**
 * Component: Render option image (handles base64 and URLs)
 * Click to expand in modal
 */
interface OptionImageProps {
  image: string
  alt: string
  className?: string
  expandable?: boolean
}

export function OptionImage({ image, alt, className, expandable = true }: OptionImageProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const imageSrc = getImageSrc(image)

  if (!imageSrc) return null

  const handleImageClick = (e: React.MouseEvent) => {
    if (expandable) {
      e.preventDefault()
      e.stopPropagation()
      setIsModalOpen(true)
    }
  }

  if (!expandable) {
    return (
      <img
        src={imageSrc}
        alt={alt}
        className={cn("h-6 w-6 rounded object-cover flex-shrink-0", className)}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }

  return (
    <ImageModal
      title={alt}
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      preview={
        <img
          src={imageSrc}
          alt={alt}
          className={cn(
            "h-6 w-6 rounded object-cover flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-[rgb(var(--color-primary))] transition-all",
            className
          )}
          onClick={handleImageClick}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      }
      previewContainerClassName="!border-0 !bg-transparent !h-auto !p-0"
    >
      <img
        src={imageSrc}
        alt={alt}
        className="max-w-full max-h-full object-contain"
        style={{ maxHeight: '70vh' }}
      />
    </ImageModal>
  )
}

/**
 * Shared clear button component for dropdowns
 * Uses div instead of button to avoid nested button issues in HTML
 */
interface ClearButtonProps {
  onClear: (e: React.MouseEvent) => void
  disabled?: boolean
  className?: string
}

export function ClearButton({ onClear, disabled = false, className }: ClearButtonProps) {
  return (
    <div
      tabIndex={-1}
      aria-label="Clear selection"
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) {
          onClear(e as any)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          if (!disabled) {
            const syntheticEvent = {
              ...e,
              preventDefault: () => e.preventDefault(),
              stopPropagation: () => e.stopPropagation()
            } as any
            onClear(syntheticEvent)
          }
        }
      }}
      className={cn(
        "p-0.5 hover:bg-[rgb(var(--bg-hover))] rounded cursor-pointer",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      <X className="h-2.5 w-2.5 text-[rgb(var(--fg-muted))]" />
    </div>
  )
}

/**
 * Shared styles for Dropdown components
 * Centralized styling to ensure consistency across SingleSelect and MultiSelect
 */
export const dropdownSharedStyles = {
  // Trigger (button) styles
  trigger: {
    base: "flex items-center justify-between rounded-md border bg-bg-surface cursor-pointer transition-all duration-200",
    focus: "focus-within:outline-none focus-within:border-[rgb(var(--color-primary))]",
    error: "border-[rgb(var(--color-error))] focus-within:border-[rgb(var(--color-error))]",
    normal: "border-[rgb(var(--bd-default))] hover:border-[rgb(var(--bd-hover))]",
    disabled: "cursor-not-allowed opacity-50",
    autoWidth: "w-fit max-w-80",
    fullWidth: "w-full",
    // Size variants
    sizes: {
      sm: "h-7 text-xs",
      md: "h-10 text-sm",
      lg: "h-12 text-base"
    },
    // Visual variants
    variants: {
      default: "",
      compact: "px-2",
      detailed: "shadow-sm"
    }
  },

  // Tag styles (for multi-select tags)
  tag: {
    base: "inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-[rgb(var(--color-primary)/0.1)] text-[rgb(var(--color-primary))] rounded-md border border-[rgb(var(--color-primary)/0.2)] flex-shrink-0",
    removeButton: "hover:bg-[rgb(var(--color-primary)/0.2)] rounded-full p-0.5 flex-shrink-0"
  },

  // Clear button
  clearButton: "absolute right-8 top-1/2 -translate-y-1/2 p-0.5 hover:bg-[rgb(var(--bg-hover))] rounded z-10",

  // Chevron icon
  chevron: {
    base: "h-4 w-4 text-[rgb(var(--fg-muted))] transition-transform duration-200",
    open: "rotate-180"
  },

  // Content (popup) styles
  content: {
    base: "relative z-[350] max-h-60 w-auto max-w-80 overflow-hidden rounded-xl border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] shadow-xl",
    animations: {
      open: "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98 data-[state=open]:duration-75",
      close: "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98 data-[state=closed]:duration-50",
      slide: "data-[side=bottom]:slide-in-from-top-0.5 data-[side=left]:slide-in-from-right-0.5 data-[side=right]:slide-in-from-left-0.5 data-[side=top]:slide-in-from-bottom-0.5"
    }
  },

  // Viewport (scrollable area) styles
  viewport: "p-1 bg-bg-surface max-h-60 overflow-y-auto scrollbar-thin",

  // Option/Item styles (for single-select)
  item: {
    base: "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs outline-none",
    states: "focus:bg-[rgb(var(--bg-hover))] focus:text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))] transition-colors duration-150",
    disabled: "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
    colors: "bg-bg-surface text-fg-default"
  },

  // Checkbox item styles (for multi-select)
  checkboxItem: {
    base: "relative flex w-full cursor-pointer select-none items-start rounded-sm py-1.5 px-2 text-xs transition-colors duration-150",
    states: "hover:bg-[rgb(var(--bg-hover))]",
    disabled: "disabled:opacity-50 disabled:cursor-not-allowed"
  },

  // Create option button
  createButton: "w-full text-left px-2 py-1.5 text-xs text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary)/0.05)] rounded-sm flex items-center gap-2 border-b border-[rgb(var(--bd-default))] mb-1",

  // Empty state
  empty: "py-6 text-center text-xs text-[rgb(var(--fg-muted))]"
} as const

/**
 * Helper functions to get full classNames
 */
export const getDropdownClassName = {
  content: () => {
    const { base, animations } = dropdownSharedStyles.content
    return `${base} ${animations.open} ${animations.close} ${animations.slide}`
  },
  item: () => {
    const { base, states, disabled, colors } = dropdownSharedStyles.item
    return `${base} ${states} ${disabled} ${colors}`
  },
  checkboxItem: () => {
    const { base, states, disabled } = dropdownSharedStyles.checkboxItem
    return `${base} ${states} ${disabled}`
  }
}

/**
 * DropdownSearch - Search input for filtering dropdown options
 */
interface DropdownSearchProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  placeholder?: string
  /** When true, stops ALL key propagation (for multi-select where no Radix handles navigation) */
  stopAllKeyPropagation?: boolean
  /** Total number of results to display as a badge */
  resultCount?: number
  /** Ref to imperatively focus the search input */
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export function DropdownSearch({ searchTerm, setSearchTerm, placeholder = "Type to search...", stopAllKeyPropagation = false, resultCount, inputRef }: DropdownSearchProps) {
  const internalRef = React.useRef<HTMLInputElement>(null)
  const searchInputRef = inputRef || internalRef

  // Sync callback ref to pass to <input>
  const setRef = React.useCallback((el: HTMLInputElement | null) => {
    (searchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el
  }, [searchInputRef])

  // Auto-focus search input when component mounts — desktop only
  // On mobile/touch devices, focusing opens the virtual keyboard which causes
  // viewport resize and Radix to detect it as an outside interaction, closing the dropdown
  React.useEffect(() => {
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    if (isTouchDevice) return
    const timer = setTimeout(() => {
      searchInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="px-3 py-2 border-b border-[rgb(var(--bd-default))]">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] transition-all">
        <Search className="w-3.5 h-3.5 text-[rgb(var(--fg-muted))] flex-shrink-0" />
        <input
          ref={setRef}
          type="text"
          placeholder={placeholder}
          className="w-full text-xs bg-transparent text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] focus:outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (stopAllKeyPropagation) {
              // In multi-select: stop all propagation except Escape (to close the dropdown)
              if (e.key !== 'Escape') {
                e.stopPropagation()
              }
              return
            }
            // Single-select (Radix): allow arrow keys and Enter to propagate for Radix UI navigation
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
              return
            }
            e.stopPropagation()
          }}
        />
        {resultCount != null && (
          <span className="text-[0.625rem] font-medium text-[rgb(var(--fg-muted))] bg-[rgb(var(--bg-subtle))] px-1.5 py-0.5 rounded-md flex-shrink-0 tabular-nums whitespace-nowrap">
            {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </span>
        )}
        {searchTerm && (
          <button
            onMouseDown={(e) => {
              // Use mousedown + preventDefault to avoid blurring the input
              e.preventDefault()
              setSearchTerm('')
              searchInputRef.current?.focus()
            }}
            className="p-0.5 hover:bg-[rgb(var(--bg-hover))] rounded cursor-pointer flex-shrink-0"
          >
            <X className="h-3 w-3 text-[rgb(var(--fg-muted))]" />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * DropdownTrigger - Trigger button for dropdown
 */
interface DropdownTriggerProps {
  selectedValues: string[]
  selectedOptions: DropdownOption[]
  placeholder: string
  disabled: boolean
  error: boolean
  clearable: boolean
  autoWidth: boolean
  triggerClassName?: string
  className?: string
  showAsTags: boolean
  showSelectedCount: boolean
  open: boolean
  onToggle: () => void
  onClear: (e: React.MouseEvent) => void
  onRemoveTag: (value: string | number) => void
  variant?: 'default' | 'compact' | 'detailed'
  size?: 'sm' | 'md' | 'lg'
}

export function DropdownTrigger({
  selectedValues,
  selectedOptions,
  placeholder,
  disabled,
  error,
  clearable,
  autoWidth,
  triggerClassName,
  className,
  showAsTags,
  showSelectedCount,
  open,
  onToggle,
  onClear,
  onRemoveTag,
  variant = 'default',
  size = 'md'
}: DropdownTriggerProps) {
  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={cn(
          "group",
          dropdownSharedStyles.trigger.base,
          dropdownSharedStyles.trigger.sizes[size],
          dropdownSharedStyles.trigger.variants[variant],
          dropdownSharedStyles.trigger.focus,
          error ? dropdownSharedStyles.trigger.error : dropdownSharedStyles.trigger.normal,
          autoWidth ? dropdownSharedStyles.trigger.autoWidth : dropdownSharedStyles.trigger.fullWidth,
          disabled && dropdownSharedStyles.trigger.disabled,
          triggerClassName,
          className
        )}
        onClick={() => {
          if (!disabled) {
            onToggle()
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!disabled) {
              onToggle()
            }
          }
        }}
      >
        <div className={cn(
          "min-w-0 px-3 h-full",
          autoWidth ? "flex-shrink" : "flex-1",
          showAsTags ? "flex gap-1 items-center overflow-hidden flex-nowrap" : "flex items-center"
        )}>
          {showAsTags ? (
            selectedValues.length > 0 ? (
              selectedValues.length <= 3 ? (
                // Show individual tags for 1-3 selections
                selectedOptions.map((option) => (
                  <span
                    key={option.value}
                    className={dropdownSharedStyles.tag.base}
                  >
                    {option.image && (
                      <OptionImage image={option.image} alt={option.label} className="h-4 w-4" />
                    )}
                    <span className="max-w-[10rem] truncate">{option.label}</span>
                    <ClearButton
                      onClear={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onRemoveTag(option.value)
                      }}
                      disabled={disabled}
                      className={dropdownSharedStyles.tag.removeButton}
                    />
                  </span>
                ))
              ) : (
                // Show compact count for 4+ selections
                <span
                  className={cn(dropdownSharedStyles.tag.base, "cursor-default")}
                  title={selectedOptions.map(opt => opt.label).join(', ')}
                >
                  <span>{selectedValues.length} selected</span>
                  <ClearButton
                    onClear={onClear}
                    disabled={disabled}
                    className={dropdownSharedStyles.tag.removeButton}
                  />
                </span>
              )
            ) : (
              <span className="text-[rgb(var(--fg-muted))] text-xs truncate">{placeholder}</span>
            )
          ) : (
            // Always show count for multi-select
            selectedValues.length > 0 ? (
              <span className="text-xs truncate text-fg-default">
                {`${selectedValues.length} selected`}
              </span>
            ) : (
              <span className="text-xs truncate text-[rgb(var(--fg-muted))]">
                {placeholder}
              </span>
            )
          )}
        </div>
        <div className="flex items-center gap-0.5 pr-2 pl-1 flex-shrink-0">
          {clearable && selectedValues.length > 0 && !disabled && (
            <ClearButton onClear={onClear} disabled={disabled} />
          )}
          <div
            onClick={(e) => {
              e.stopPropagation()
              if (!disabled) {
                onToggle()
              }
            }}
            className="hover:bg-[rgb(var(--bg-hover))] rounded transition-colors cursor-pointer pr-0.5"
          >
            <ChevronDown className={cn(
              dropdownSharedStyles.chevron.base,
              open && dropdownSharedStyles.chevron.open
            )} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function Dropdown({
  options = [],
  value,
  placeholder = "Select an option",
  onValueChange,
  onOpen,
  disabled = false,
  loading = false,
  searchable = true,
  clearable = true,
  className,
  error = false,
  label,
  labelExtra,
  required = false,
  emptyMessage = "No options found",
  triggerClassName,
  autoWidth = false,
  customFooter,
  multiSelect = false,
  maxSelections,
  showSelectedCount = true,
  showAsTags = false,
  allowTextInput = false,
  onCreateOption,
  createOptionLabel = "Create",
  allowCustomValues = false,
  allowCustomInput = false,
  variant = 'default',
  size = 'md',
  contentClassName,
  selectAllLabel,
  showOnlyButton = false,
  customTrigger
}: DropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const dropdownContentRef = React.useRef<HTMLDivElement>(null)

  // Custom hooks
  const {
    createdOptions,
    isCreating,
    enableTextInput,
    effectiveCreateOption,
    handleCreateOption: createOption
  } = useDropdownCreate(allowTextInput, allowCustomInput, onCreateOption)

  const {
    allOptions,
    selectedValues,
    selectedOptions,
    selectedOption
  } = useDropdownState(value, multiSelect, options, createdOptions)

  const {
    filteredOptions,
    showCreateOption
  } = useDropdownFiltering(allOptions, searchTerm, enableTextInput)

  // Smart positioning to prevent modal overflow
  const [dropdownAlign, setDropdownAlign] = React.useState<'left' | 'right'>('left')

  React.useEffect(() => {
    if (!open || !multiSelect || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const viewport = { width: window.innerWidth, height: window.innerHeight }

    // Check if dropdown would overflow on the right
    const dropdownWidth = Math.max(rect.width, 320) // min 20rem = 320px
    const spaceRight = viewport.width - rect.left

    // If there's not enough space on the right, align to the right edge of input
    setDropdownAlign(spaceRight >= dropdownWidth ? 'left' : 'right')
  }, [open, multiSelect])

  // Handle click outside to close dropdown for multi-select
  React.useEffect(() => {
    if (!open || !multiSelect) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      // Check if click is outside both the container AND the dropdown content
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target)
      const isOutsideDropdown = dropdownContentRef.current && !dropdownContentRef.current.contains(target)

      if (isOutsideContainer && isOutsideDropdown) {
        setOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, multiSelect])

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen && onOpen) {
      onOpen()
    }
    if (!newOpen) {
      // If allowCustomValues is enabled and there's a search term, accept it as the value
      if (allowCustomValues && searchTerm.trim()) {
        // Check if it's not already in the options
        const existingOption = allOptions.find(opt =>
          String(opt.label ?? '').toLowerCase() === searchTerm.toLowerCase()
        )
        if (!existingOption) {
          // Accept the custom value directly
          onValueChange(searchTerm.trim())
        }
      }
      setSearchTerm('')
    }
  }, [onOpen, allowCustomValues, searchTerm, allOptions, onValueChange])

  const handleClear = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (multiSelect) {
      onValueChange([])
    } else {
      onValueChange('')
    }
  }, [multiSelect, onValueChange])

  const handleToggleOption = React.useCallback((optionValue: string | number | string[]) => {
    if (!multiSelect) return

    // Handle bulk selection (for Select All / Deselect All)
    if (Array.isArray(optionValue)) {
      onValueChange(optionValue)
      return
    }

    const stringValue = optionValue.toString()
    const currentValues = Array.isArray(value) ? value.map(v => v.toString()) : []
    let newValues: string[]

    if (currentValues.includes(stringValue)) {
      newValues = currentValues.filter(v => v !== stringValue)
    } else {
      if (maxSelections && currentValues.length >= maxSelections) {
        return // Don't add if max selections reached
      }
      newValues = [...currentValues, stringValue]
    }

    onValueChange(newValues)
  }, [multiSelect, value, maxSelections, onValueChange])

  const handleRemoveTag = React.useCallback((optionValue: string | number) => {
    if (!multiSelect) return
    const stringValue = optionValue.toString()
    const currentValues = Array.isArray(value) ? value.map(v => v.toString()) : []
    const newValues = currentValues.filter(v => v !== stringValue)
    onValueChange(newValues)
  }, [multiSelect, value, onValueChange])

  const handleCreateOption = React.useCallback(() => {
    createOption(searchTerm, multiSelect, value, onValueChange, setSearchTerm, setOpen)
  }, [createOption, searchTerm, multiSelect, value, onValueChange])

  return (
    <div ref={containerRef} className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-[rgb(var(--fg-default))]">
            {label}
            {required && <span className="text-[rgb(var(--fg-default))] ml-1">*</span>}
          </label>
          {labelExtra}
        </div>
      )}

      {multiSelect ? (
        // Multi-select implementation with Radix Popover (same positioning as SingleSelect)
        <Popover.Root open={open} onOpenChange={handleOpenChange}>
          <Popover.Trigger asChild>
            <div ref={triggerRef}>
              {customTrigger || (
                <DropdownTrigger
                  selectedValues={selectedValues}
                  selectedOptions={selectedOptions}
                  placeholder={placeholder}
                  disabled={disabled}
                  error={!!error}
                  clearable={clearable}
                  autoWidth={autoWidth}
                  triggerClassName={triggerClassName}
                  className={className}
                  showAsTags={showAsTags}
                  showSelectedCount={showSelectedCount}
                  open={open}
                  onToggle={() => handleOpenChange(!open)}
                  onClear={handleClear}
                  onRemoveTag={handleRemoveTag}
                  variant={variant}
                  size={size}
                />
              )}
            </div>
          </Popover.Trigger>

          <Popover.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
            <Popover.Content
              ref={dropdownContentRef}
              className={cn(
                getDropdownClassName.content(),
                "flex flex-col max-h-60"
              )}
              side="bottom"
              align="start"
              sideOffset={4}
              avoidCollisions={true}
              sticky="always"
              collisionPadding={16}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <MultiSelect
                filteredOptions={filteredOptions}
                selectedValues={selectedValues}
                searchable={searchable}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                loading={loading}
                emptyMessage={emptyMessage}
                showCreateOption={showCreateOption}
                effectiveCreateOption={effectiveCreateOption}
                isCreating={isCreating}
                allowCustomInput={allowCustomInput}
                createOptionLabel={createOptionLabel}
                handleCreateOption={handleCreateOption}
                handleToggleOption={handleToggleOption}
                customFooter={customFooter}
                selectAllLabel={selectAllLabel}
                showOnlyButton={showOnlyButton}
                onClose={() => setOpen(false)}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        // Single-select implementation using Radix
        <SingleSelect
          value={value}
          onValueChange={onValueChange}
          open={open}
          onOpenChange={handleOpenChange}
          disabled={disabled}
          placeholder={placeholder}
          error={!!error}
          clearable={clearable}
          autoWidth={autoWidth}
          triggerClassName={triggerClassName}
          className={className}
          searchable={searchable}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filteredOptions={filteredOptions}
          allOptions={allOptions}
          loading={loading}
          emptyMessage={emptyMessage}
          showCreateOption={showCreateOption}
          effectiveCreateOption={effectiveCreateOption}
          isCreating={isCreating}
          allowCustomInput={allowCustomInput}
          createOptionLabel={createOptionLabel}
          handleCreateOption={handleCreateOption}
          handleClear={handleClear}
          customFooter={customFooter}
          variant={variant}
          size={size}
        />
      )}
    </div>
  )
}
