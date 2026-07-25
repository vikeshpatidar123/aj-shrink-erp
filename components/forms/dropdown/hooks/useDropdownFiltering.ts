import * as React from 'react'
import { DropdownOption } from '../types'

export function useDropdownFiltering(
  allOptions: DropdownOption[],
  searchTerm: string,
  enableTextInput: boolean
) {
  // Filter options based on search term
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return allOptions
    const term = searchTerm.toLowerCase()
    return allOptions.filter(option =>
      String(option.label).toLowerCase().includes(term) ||
      (option.description && option.description.toLowerCase().includes(term))
    )
  }, [allOptions, searchTerm])

  // Check if we should show "Create" option
  const showCreateOption = React.useMemo(() => {
    if (!enableTextInput || !searchTerm.trim()) return false
    const term = searchTerm.toLowerCase()
    const exactMatch = allOptions.some(
      opt => String(opt.label).toLowerCase() === term
    )
    return !exactMatch
  }, [enableTextInput, searchTerm, allOptions])

  return {
    filteredOptions,
    showCreateOption
  }
}
