'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DropdownOption } from './types'
import { getDropdownClassName, dropdownSharedStyles, DropdownSearch, OptionImage } from './Dropdown'

interface MultiSelectProps {
  filteredOptions: DropdownOption[]
  selectedValues: string[]
  searchable: boolean
  searchTerm: string
  setSearchTerm: (term: string) => void
  loading: boolean
  emptyMessage: string
  showCreateOption: boolean
  effectiveCreateOption?: (inputValue: string) => DropdownOption | Promise<DropdownOption>
  isCreating: boolean
  allowCustomInput: boolean
  createOptionLabel: string
  handleCreateOption: () => void
  handleToggleOption: (value: string | number | string[]) => void
  customFooter?: React.ReactNode
  /** Header title for select all section */
  selectAllLabel?: string
  /** Show "ONLY" button on hover (like OTIF) */
  showOnlyButton?: boolean
  /** Callback to close the dropdown */
  onClose?: () => void
}

export function MultiSelect({
  filteredOptions,
  selectedValues,
  searchable,
  searchTerm,
  setSearchTerm,
  loading,
  emptyMessage,
  showCreateOption,
  effectiveCreateOption,
  isCreating,
  allowCustomInput,
  createOptionLabel,
  handleCreateOption,
  handleToggleOption,
  customFooter,
  selectAllLabel,
  showOnlyButton = false,
  onClose
}: MultiSelectProps) {
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const optionRefs = React.useRef<(HTMLLabelElement | null)[]>([])
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Reset highlighted index when filtered options change
  React.useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredOptions.length, searchTerm])

  // Scroll highlighted option into view
  React.useEffect(() => {
    if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [highlightedIndex])

  // Handle keyboard navigation
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!filteredOptions.length) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        )
        break
      case 'Tab':
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const option = filteredOptions[highlightedIndex]
          if (!option.disabled) {
            handleToggleOption(option.value)
          }
        }
        break
      case 'Escape':
        e.preventDefault()
        // Let parent handle close
        break
    }
  }, [filteredOptions, highlightedIndex, handleToggleOption])

  // Handle Select All / Deselect All
  const handleSelectAll = React.useCallback(() => {
    const allValues = filteredOptions
      .filter(option => !option.disabled && option.value !== '')
      .map(option => option.value.toString())

    // If all are selected, deselect all. Otherwise, select all.
    const allSelected = allValues.every(value => selectedValues.includes(value))

    if (allSelected) {
      // Deselect all from filtered options
      const newValues = selectedValues.filter(val => !allValues.includes(val))
      handleToggleOption(newValues)
    } else {
      // Select all filtered options
      const newValues = Array.from(new Set([...selectedValues, ...allValues]))
      handleToggleOption(newValues)
    }
  }, [filteredOptions, selectedValues, handleToggleOption])

  // Handle mouse wheel scrolling - prevent Radix Popover from blocking wheel events
  const handleWheel = React.useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Don't prevent default - let browser handle native scrolling
    // Just stop propagation to prevent Popover from interfering
    e.stopPropagation()
  }, [])

  const allSelected = filteredOptions.filter(opt => !opt.disabled && opt.value !== '').length > 0 &&
    filteredOptions
      .filter(opt => !opt.disabled && opt.value !== '')
      .every(opt => selectedValues.includes(opt.value.toString()))

  return (
    <div className="flex flex-col h-full overflow-hidden" onKeyDown={handleKeyDown}>
      {/* Select All / Deselect All - Header (FIRST, like dashboard) */}
      {!loading && filteredOptions.length > 0 && (
        <div
          className="bg-[rgb(var(--bg-subtle))] border-b border-[rgb(var(--bd-default))] px-3 py-2.5 flex-shrink-0"
          onMouseDown={(e) => e.preventDefault()}
        >
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <div className="relative flex items-center justify-center flex-shrink-0">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="peer sr-only"
              />
              <div className={cn(
                "w-4 h-4 rounded border-2 transition-all duration-150 flex items-center justify-center",
                allSelected
                  ? "bg-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]"
                  : "border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] group-hover:border-[rgb(var(--color-primary))]"
              )}>
                {allSelected && (
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                )}
              </div>
            </div>
            <span className="text-sm font-semibold text-[rgb(var(--fg-default))]">
              {selectAllLabel || (allSelected ? 'Deselect All' : 'Select All')}
            </span>
          </label>
        </div>
      )}

      {/* Search - SECOND, like dashboard */}
      {searchable && (
        <div className="flex-shrink-0">
          <DropdownSearch
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            stopAllKeyPropagation={true}
            resultCount={filteredOptions.filter(o => o.value !== '').length}
            inputRef={searchInputRef}
          />
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="p-1 bg-bg-surface flex-1 min-h-0 overflow-y-auto scrollbar-thin"
        onWheel={handleWheel}
        onMouseDown={(e) => {
          // Prevent focus from leaving the search input when clicking options
          e.preventDefault()
        }}
      >
        {/* Create Option Button */}
        {showCreateOption && effectiveCreateOption && (
          <button
            type="button"
            onClick={handleCreateOption}
            disabled={isCreating}
            className="w-full text-left px-2 py-1.5 text-sm text-primary hover:bg-blue-50 rounded-sm flex items-center gap-2 border-b border-gray-200 mb-1"
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
            {searchTerm ? emptyMessage : "No options available"}
          </div>
        ) : (
          filteredOptions
            .filter(option => option.value !== '') // Filter out empty values
            .map((option, index) => {
              const isChecked = selectedValues.includes(option.value.toString())
              return (
                <div
                  key={option.key || `${option.value}-${index}`}
                  className={cn(
                    "relative flex w-full items-center justify-between rounded-md py-2 px-3 text-xs transition-colors duration-150 group",
                    "hover:bg-[rgb(var(--bg-subtle))]",
                    highlightedIndex === index && "bg-[rgb(var(--bg-subtle))]",
                    option.disabled && "pointer-events-none opacity-50"
                  )}
                >
                  <label
                    ref={(el) => { optionRefs.current[index] = el }}
                    className="flex items-center gap-2.5 flex-1 cursor-pointer select-none"
                  >
                    <div className="relative flex items-center justify-center flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => !option.disabled && handleToggleOption(option.value)}
                        className="peer sr-only"
                        disabled={option.disabled}
                      />
                      <div className={cn(
                        "w-4 h-4 rounded border-2 transition-all duration-150 flex items-center justify-center",
                        isChecked
                          ? "bg-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]"
                          : "border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] group-hover:border-[rgb(var(--color-primary))]"
                      )}>
                        {isChecked && (
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        )}
                      </div>
                    </div>
                    {option.image && (
                      <OptionImage image={option.image} alt={option.label} className="ml-2" />
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="text-xs text-[rgb(var(--fg-default))] truncate">{option.label}</div>
                      {option.description && (
                        <div className="text-[0.625rem] text-[rgb(var(--fg-muted))] mt-0.5 truncate">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </label>
                  {/* ONLY button - appears on hover */}
                  {showOnlyButton && !option.disabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Select ONLY this option and close dropdown
                        handleToggleOption([option.value.toString()])
                        onClose?.()
                      }}
                      className={cn(
                        "text-[0.625rem] font-semibold px-2 py-0.5 rounded flex-shrink-0 ml-2",
                        "border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-subtle))]",
                        "text-[rgb(var(--fg-muted))]",
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        "hover:bg-[rgb(var(--color-primary))] hover:text-white hover:border-[rgb(var(--color-primary))]"
                      )}
                    >
                      ONLY
                    </button>
                  )}
                </div>
              )
            })
        )}
      </div>

      {/* Custom Footer */}
      {customFooter && customFooter}
    </div>
  )
}
