'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DropdownOption } from './types'
import { getDropdownClassName, dropdownSharedStyles, DropdownSearch, ClearButton, OptionImage } from './Dropdown'

interface SingleSelectProps {
  value?: string | number | string[]
  onValueChange: (value: string | number | string[]) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled: boolean
  placeholder: string
  error: boolean
  clearable: boolean
  autoWidth: boolean
  triggerClassName?: string
  className?: string
  searchable: boolean
  searchTerm: string
  setSearchTerm: (term: string) => void
  filteredOptions: DropdownOption[]
  allOptions: DropdownOption[] // Added: all options (including non-filtered)
  loading: boolean
  emptyMessage: string
  showCreateOption: boolean
  effectiveCreateOption?: (inputValue: string) => DropdownOption | Promise<DropdownOption>
  isCreating: boolean
  allowCustomInput: boolean
  createOptionLabel: string
  handleCreateOption: () => void
  handleClear: (e: React.MouseEvent) => void
  customFooter?: React.ReactNode
  variant?: 'default' | 'compact' | 'detailed'
  size?: 'sm' | 'md' | 'lg'
}

export function SingleSelect({
  value,
  onValueChange,
  open,
  onOpenChange,
  disabled,
  placeholder,
  error,
  clearable,
  autoWidth,
  triggerClassName,
  className,
  searchable,
  searchTerm,
  setSearchTerm,
  filteredOptions,
  allOptions,
  loading,
  emptyMessage,
  showCreateOption,
  effectiveCreateOption,
  isCreating,
  allowCustomInput,
  createOptionLabel,
  handleCreateOption,
  handleClear,
  customFooter,
  variant = 'default',
  size = 'md'
}: SingleSelectProps) {
  // Find selected option from ALL options (not just filtered) to show label in trigger
  // This ensures the selected value displays correctly even when options are still loading
  const selectedOption = React.useMemo(() => {
    return allOptions.find(opt => opt.value?.toString() === value?.toString())
  }, [allOptions, value])

  // For combobox mode with allowCustomInput, use direct input value
  const displayValue = React.useMemo(() => {
    if (allowCustomInput && value && !selectedOption) {
      // If there's a value but no matching option, it's a custom value
      return value.toString()
    }
    return selectedOption?.label || ''
  }, [allowCustomInput, value, selectedOption])

  // Track highlighted option index for keyboard navigation
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)

  // Reset highlighted index when options change or dropdown opens
  React.useEffect(() => {
    if (open) {
      const currentIndex = filteredOptions.findIndex(opt => opt.value?.toString() === value?.toString())
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : -1)
    }
  }, [open, filteredOptions, value])

  // When typing narrows list, reset to first result
  React.useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredOptions.length])

  // Handle keyboard navigation - works both when open and closed (like DevExtreme)
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    // When dropdown is CLOSED - cycle through options with arrow keys
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()

        // Use allOptions for closed navigation (not filtered)
        const options = allOptions.filter(opt => !opt.disabled && opt.value != null && opt.value !== '')
        if (options.length === 0) return

        // Find current index
        const currentIndex = options.findIndex(opt => opt.value?.toString() === value?.toString())

        let newIndex: number
        if (e.key === 'ArrowDown') {
          // Move to next option, or first if nothing selected or at end
          newIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % options.length
        } else {
          // Move to previous option, or last if nothing selected or at start
          newIndex = currentIndex < 0 ? options.length - 1 : (currentIndex - 1 + options.length) % options.length
        }

        const newOption = options[newIndex]
        if (newOption) {
          onValueChange(newOption.value)
        }
        return
      }
      return
    }

    // When dropdown is OPEN - navigate within filtered list
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (filteredOptions.length > 0) {
          setHighlightedIndex(prev => {
            const next = prev + 1
            return next >= filteredOptions.length ? 0 : next
          })
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (filteredOptions.length > 0) {
          setHighlightedIndex(prev => {
            const next = prev - 1
            return next < 0 ? filteredOptions.length - 1 : next
          })
        }
        break
      case 'Tab':
      case 'Enter':
        e.preventDefault()
        if (filteredOptions.length > 0) {
          // Select highlighted option from list
          const selectedOpt = filteredOptions[highlightedIndex]
          if (selectedOpt && !selectedOpt.disabled) {
            onValueChange(selectedOpt.value)
            onOpenChange(false)
          }
        } else if (allowCustomInput && searchTerm.trim()) {
          // No matching options but custom input allowed - create custom value
          handleCreateOption()
        }
        break
      case 'Escape':
        e.preventDefault()
        onOpenChange(false)
        break
    }
  }, [open, allOptions, filteredOptions, highlightedIndex, value, onValueChange, onOpenChange, allowCustomInput, searchTerm, handleCreateOption])

  // Combobox mode: allowCustomInput uses Popover instead of Radix Select
  // to avoid Radix's opinionated keyboard handling fighting with custom input
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const handleComboKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const validOptions = filteredOptions.filter(o => o.value != null && o.value !== '')
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev + 1 >= validOptions.length ? 0 : prev + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev - 1 < 0 ? validOptions.length - 1 : prev - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (validOptions.length > 0) {
        const opt = validOptions[highlightedIndex] || validOptions[0]
        if (opt && !opt.disabled) {
          onValueChange(opt.value)
          onOpenChange(false)
        }
      } else if (searchTerm.trim()) {
        handleCreateOption()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onOpenChange(false)
    }
  }, [filteredOptions, highlightedIndex, searchTerm, onValueChange, onOpenChange, handleCreateOption])

  if (allowCustomInput) {
    return (
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Trigger asChild>
          <div
            role="combobox"
            aria-expanded={open}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!disabled) onOpenChange(!open) }
            }}
            className={cn(
              "group relative flex items-center justify-between rounded-md border bg-bg-surface cursor-pointer transition-all duration-200",
              dropdownSharedStyles.trigger.sizes[size],
              dropdownSharedStyles.trigger.focus,
              error ? dropdownSharedStyles.trigger.error : dropdownSharedStyles.trigger.normal,
              autoWidth ? dropdownSharedStyles.trigger.autoWidth : dropdownSharedStyles.trigger.fullWidth,
              disabled && dropdownSharedStyles.trigger.disabled,
              triggerClassName,
              className
            )}
          >
            <span className={cn("pl-3 flex-1 truncate text-xs", !displayValue && "text-[rgb(var(--fg-subtle))] font-normal")}>
              {displayValue || placeholder}
            </span>
            <div className="flex items-center gap-0.5 pr-2 flex-shrink-0">
              {clearable && value && !disabled && (
                <ClearButton onClear={handleClear} disabled={disabled} />
              )}
              <ChevronDown className={cn("h-4 w-4 text-[rgb(var(--fg-muted))] transition-transform duration-200", open && "rotate-180")} />
            </div>
          </div>
        </Popover.Trigger>
        <Popover.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
          <Popover.Content
            className={cn(getDropdownClassName.content(), "flex flex-col !max-h-72 overflow-hidden")}
            side="bottom"
            align="start"
            sideOffset={4}
            avoidCollisions
            sticky="always"
            collisionPadding={16}
            onOpenAutoFocus={(e) => { e.preventDefault(); setTimeout(() => searchInputRef.current?.focus(), 50) }}
          >
            {/* Search input */}
            <div className="px-3 py-2 border-b border-[rgb(var(--bd-default))]">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))]">
                <Search className="w-3.5 h-3.5 text-[rgb(var(--fg-muted))] flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type to search..."
                  className="w-full text-xs bg-transparent text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleComboKeyDown}
                  autoFocus
                />
                {filteredOptions.length > 0 && (
                  <span className="text-[0.625rem] font-medium text-[rgb(var(--fg-muted))] bg-[rgb(var(--bg-subtle))] px-1.5 py-0.5 rounded-md flex-shrink-0 tabular-nums">
                    {filteredOptions.filter(o => o.value != null && o.value !== '').length} results
                  </span>
                )}
                {searchTerm && (
                  <button onMouseDown={(e) => { e.preventDefault(); setSearchTerm(''); searchInputRef.current?.focus() }} className="p-0.5 hover:bg-[rgb(var(--bg-hover))] rounded flex-shrink-0">
                    <X className="h-3 w-3 text-[rgb(var(--fg-muted))]" />
                  </button>
                )}
              </div>
            </div>

            <div
              className={dropdownSharedStyles.viewport}
              onWheel={(e) => e.stopPropagation()}
            >
              {/* Add custom value button */}
              {searchTerm.trim() && !filteredOptions.find(o => String(o.label ?? '').toLowerCase() === searchTerm.trim().toLowerCase()) && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleCreateOption() }}
                  className={dropdownSharedStyles.createButton}
                >
                  <span className="text-lg">+</span>
                  <span>Add &quot;{searchTerm}&quot;</span>
                </button>
              )}

              {loading ? (
                <div className="py-6 text-center text-xs text-[rgb(var(--fg-muted))]">Loading...</div>
              ) : filteredOptions.filter(o => o.value != null && o.value !== '').length === 0 && !searchTerm.trim() ? (
                <div className="py-6 text-center text-xs text-[rgb(var(--fg-muted))]">{emptyMessage}</div>
              ) : (
                filteredOptions.filter(o => o.value != null && o.value !== '').map((option, index) => (
                  <div
                    key={option.key || `${option.value}-${index}`}
                    onMouseDown={(e) => { e.preventDefault(); if (!option.disabled) { onValueChange(option.value); onOpenChange(false) } }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs outline-none transition-colors duration-150",
                      option.value?.toString() === value?.toString()
                        ? "bg-[rgb(var(--color-primary)/0.08)] text-[rgb(var(--color-primary))]"
                        : index === highlightedIndex ? "bg-[rgb(var(--bg-hover))]" : "hover:bg-[rgb(var(--bg-hover))]",
                      option.disabled && "opacity-50 pointer-events-none"
                    )}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      {option.value?.toString() === value?.toString() && <Check className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex items-center gap-2">
                      {option.image && <OptionImage image={option.image} alt={option.label} />}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{option.label}</div>
                        {option.description && <div className="text-xs text-[rgb(var(--fg-muted))] truncate">{option.description}</div>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <SelectPrimitive.Root
      value={value != null && value !== '' ? value.toString() : ''}
      onValueChange={(newValue: string) => onValueChange(newValue)}
      open={open}
      onOpenChange={onOpenChange}
      disabled={disabled}
    >
      <div className="relative" onKeyDownCapture={handleKeyDown}>
        <SelectPrimitive.Trigger
          suppressHydrationWarning
          className={cn(
            "group",
            dropdownSharedStyles.trigger.base,
            dropdownSharedStyles.trigger.sizes[size],
            dropdownSharedStyles.trigger.variants[variant],
            dropdownSharedStyles.trigger.focus,
            error ? dropdownSharedStyles.trigger.error : dropdownSharedStyles.trigger.normal,
            autoWidth ? dropdownSharedStyles.trigger.autoWidth : dropdownSharedStyles.trigger.fullWidth,
            disabled && dropdownSharedStyles.trigger.disabled,
            "pl-3 py-2 pr-1 [&>span]:line-clamp-1",
            className,
            triggerClassName
          )}
        >
          {displayValue ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {selectedOption?.image && (
                <OptionImage image={selectedOption.image} alt={displayValue} />
              )}
              <span className="truncate text-xs">{displayValue}</span>
            </div>
          ) : (
            <span className="text-[rgb(var(--fg-subtle))] font-normal text-xs">{placeholder}</span>
          )}
          <div className="flex items-center gap-0.5 flex-shrink-0 pr-1">
            {clearable && value && (
              <ClearButton onClear={handleClear} disabled={disabled} className="flex-shrink-0" />
            )}
            <SelectPrimitive.Icon asChild>
              <div className="pr-1 pl-0.5">
                <ChevronDown className="h-4 w-4 text-[rgb(var(--fg-muted))]" />
              </div>
            </SelectPrimitive.Icon>
          </div>
        </SelectPrimitive.Trigger>
      </div>

      <SelectPrimitive.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
        <SelectPrimitive.Content
          className={getDropdownClassName.content()}
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
          avoidCollisions={true}
          sticky="always"
          collisionPadding={16}
        >
          {searchable && (
            <DropdownSearch
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              resultCount={filteredOptions.filter(o => o.value != null && o.value !== '').length}
            />
          )}

          <SelectPrimitive.Viewport
            className={dropdownSharedStyles.viewport}
            onMouseDown={(e) => {
              // Prevent focus from leaving the search input when clicking options
              if (searchable) e.preventDefault()
            }}
          >
            {/* Create Option Button for Single Select */}
            {showCreateOption && effectiveCreateOption && (
              <button
                type="button"
                onClick={handleCreateOption}
                disabled={isCreating}
                className={dropdownSharedStyles.createButton}
              >
                {isCreating ? (
                  <>
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">+</span>
                    <span>{allowCustomInput ? 'Add' : createOptionLabel} &quot;{searchTerm}&quot;</span>
                  </>
                )}
              </button>
            )}

            {loading ? (
              <div className="py-6 text-center text-sm text-fg-muted bg-bg-surface">
                Loading...
              </div>
            ) : filteredOptions.length === 0 && !showCreateOption ? (
              <div className="py-6 text-center text-sm text-fg-muted bg-bg-surface">
                {emptyMessage}
              </div>
            ) : (
              (() => {
                // Performance: cap render count for very large lists. User can still search.
                const RENDER_CAP = 200
                const cleaned = filteredOptions.filter(option => option.value != null && option.value !== '')
                const visible = cleaned.slice(0, RENDER_CAP)
                const hiddenCount = cleaned.length - visible.length
                return (
                  <>
                    {visible.map((option, index) => {
                      const isHighlighted = index === highlightedIndex
                      return (
                        <SelectPrimitive.Item
                          key={option.key || `${option.value}-${index}`}
                          value={String(option.value)}
                          disabled={option.disabled}
                          className={cn(
                            getDropdownClassName.item(),
                            isHighlighted && "bg-[rgb(var(--bg-hover))]"
                          )}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                            <SelectPrimitive.ItemIndicator>
                              <Check className="h-4 w-4" />
                            </SelectPrimitive.ItemIndicator>
                          </span>
                          <SelectPrimitive.ItemText>
                            <div className="min-w-0 flex items-center gap-2">
                              {option.image && (
                                <OptionImage image={option.image} alt={option.label} />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{option.label}</div>
                                {option.description && (
                                  <div className="text-xs text-[rgb(var(--fg-muted))] truncate">
                                    {option.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </SelectPrimitive.ItemText>
                        </SelectPrimitive.Item>
                      )
                    })}
                    {hiddenCount > 0 && (
                      <div className="py-2 px-3 text-center text-[0.625rem] text-[rgb(var(--fg-muted))] border-t border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-subtle))]">
                        Showing {visible.length} of {cleaned.length}. Type to filter.
                      </div>
                    )}
                  </>
                )
              })()
            )}
          </SelectPrimitive.Viewport>

          {/* Custom Footer - isolated from Radix Select event handling */}
          {customFooter && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{ pointerEvents: 'auto' }}
            >
              {customFooter}
            </div>
          )}
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
