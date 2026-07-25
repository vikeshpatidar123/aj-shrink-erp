import * as React from 'react'
import { DropdownOption } from '../types'

export function useDropdownCreate(
  allowTextInput: boolean,
  allowCustomInput: boolean,
  onCreateOption?: (inputValue: string) => DropdownOption | Promise<DropdownOption>
) {
  const [createdOptions, setCreatedOptions] = React.useState<DropdownOption[]>([])
  const [isCreating, setIsCreating] = React.useState(false)

  // Enable allowTextInput when allowCustomInput is true
  const enableTextInput = allowTextInput || allowCustomInput

  // Auto-create option handler for allowCustomInput mode
  const autoCreateOption = React.useCallback((inputValue: string): DropdownOption => {
    return {
      value: inputValue,
      label: inputValue
    }
  }, [])

  // Use provided onCreateOption or auto-create for allowCustomInput
  const effectiveCreateOption = onCreateOption || (allowCustomInput ? autoCreateOption : undefined)

  // Handle creating new option
  const handleCreateOption = React.useCallback(async (
    searchTerm: string,
    multiSelect: boolean,
    value: string | number | string[] | undefined,
    onValueChange: (value: string | number | string[]) => void,
    setSearchTerm: (term: string) => void,
    setOpen: (open: boolean) => void
  ) => {
    if (!effectiveCreateOption || !searchTerm.trim() || isCreating) return

    setIsCreating(true)
    try {
      const newOption = await effectiveCreateOption(searchTerm.trim())
      setCreatedOptions(prev => [...prev, newOption])

      // Auto-select the newly created option
      if (multiSelect) {
        const currentValues = Array.isArray(value) ? value.map(v => v.toString()) : []
        onValueChange([...currentValues, newOption.value.toString()])
      } else {
        onValueChange(newOption.value)
      }

      setSearchTerm('')
      if (!multiSelect) {
        setOpen(false)
      }
    } catch (error) {
      console.error('Failed to create option:', error)
    } finally {
      setIsCreating(false)
    }
  }, [effectiveCreateOption, isCreating])

  return {
    createdOptions,
    isCreating,
    enableTextInput,
    effectiveCreateOption,
    handleCreateOption
  }
}
