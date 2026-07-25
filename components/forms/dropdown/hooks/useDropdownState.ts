import * as React from 'react'
import { DropdownOption } from '../types'

export function useDropdownState(
  value: string | number | string[] | undefined,
  multiSelect: boolean,
  options: DropdownOption[],
  createdOptions: DropdownOption[]
) {
  // Combine created options with provided options
  const allOptions = React.useMemo(() => {
    return [...createdOptions, ...options]
  }, [createdOptions, options])

  // Handle both single and multi-select values
  const selectedValues = React.useMemo(() => {
    if (multiSelect) {
      return Array.isArray(value) ? value.map(v => v.toString()) : []
    }
    return value ? [value.toString()] : []
  }, [value, multiSelect])

  const selectedOptions = React.useMemo(() => {
    return allOptions.filter(option => option.value != null && selectedValues.includes(option.value.toString()))
  }, [allOptions, selectedValues])

  const selectedOption = React.useMemo(() => {
    return allOptions.find(option => option.value != null && option.value.toString() === value?.toString())
  }, [allOptions, value])

  return {
    allOptions,
    selectedValues,
    selectedOptions,
    selectedOption
  }
}
