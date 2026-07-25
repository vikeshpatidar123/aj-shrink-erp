'use client'

import { useEffect, useCallback, useState } from 'react'
import { Table } from '@tanstack/react-table'

export interface KeyboardNavigationConfig {
  enableArrowKeys?: boolean
  enableTabNavigation?: boolean
  enableEnterToEdit?: boolean
  enableSpaceToSelect?: boolean
  enableCtrlA?: boolean
}

export function useKeyboardNavigation<TData>(
  table: Table<TData>,
  config: KeyboardNavigationConfig = {}
) {
  const {
    enableArrowKeys = true,
    enableTabNavigation = true,
    enableEnterToEdit = true,
    enableSpaceToSelect = true,
    enableCtrlA = true
  } = config

  const [focusedCell, setFocusedCell] = useState<{
    rowIndex: number
    columnIndex: number
  } | null>(null)

  const rows = table.getRowModel().rows
  const columns = table.getAllColumns().filter(col => col.getIsVisible())

  const moveFocus = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!focusedCell) {
        // Start at first cell
        setFocusedCell({ rowIndex: 0, columnIndex: 0 })
        return
      }

      let { rowIndex, columnIndex } = focusedCell

      switch (direction) {
        case 'up':
          rowIndex = Math.max(0, rowIndex - 1)
          break
        case 'down':
          rowIndex = Math.min(rows.length - 1, rowIndex + 1)
          break
        case 'left':
          columnIndex = Math.max(0, columnIndex - 1)
          break
        case 'right':
          columnIndex = Math.min(columns.length - 1, columnIndex + 1)
          break
      }

      setFocusedCell({ rowIndex, columnIndex })
    },
    [focusedCell, rows.length, columns.length]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Arrow keys navigation
      if (enableArrowKeys) {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          moveFocus('up')
        } else if (event.key === 'ArrowDown') {
          event.preventDefault()
          moveFocus('down')
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault()
          moveFocus('left')
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          moveFocus('right')
        }
      }

      // Tab navigation
      if (enableTabNavigation && event.key === 'Tab') {
        event.preventDefault()
        if (event.shiftKey) {
          moveFocus('left')
        } else {
          moveFocus('right')
        }
      }

      // Space to select row
      if (enableSpaceToSelect && event.key === ' ') {
        if (focusedCell) {
          event.preventDefault()
          const row = rows[focusedCell.rowIndex]
          if (row) {
            row.toggleSelected()
          }
        }
      }

      // Ctrl+A disabled - users can use the select all checkbox instead
      // This allows Ctrl+A to work normally in input fields

      // Enter to edit (can be handled by parent component)
      if (enableEnterToEdit && event.key === 'Enter') {
        // This will be handled by the cell component
        // Just prevent default here
        event.preventDefault()
      }
    },
    [
      enableArrowKeys,
      enableTabNavigation,
      enableSpaceToSelect,
      enableCtrlA,
      enableEnterToEdit,
      focusedCell,
      moveFocus,
      rows,
      table
    ]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  const getCellClassName = useCallback(
    (rowIndex: number, columnIndex: number) => {
      if (
        focusedCell &&
        focusedCell.rowIndex === rowIndex &&
        focusedCell.columnIndex === columnIndex
      ) {
        return 'ring-2 ring-blue-500 bg-blue-50'
      }
      return ''
    },
    [focusedCell]
  )

  const setFocus = useCallback((rowIndex: number, columnIndex: number) => {
    setFocusedCell({ rowIndex, columnIndex })
  }, [])

  const clearFocus = useCallback(() => {
    setFocusedCell(null)
  }, [])

  return {
    focusedCell,
    setFocus,
    clearFocus,
    getCellClassName,
    moveFocus
  }
}
