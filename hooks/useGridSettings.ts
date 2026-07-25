import { useState, useEffect, useCallback } from 'react'

interface GridSettings {
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  frozenColumns: string[]
  pageSize: number
  searchType: 'advanced' | 'new'
  sortingState: any[]
  filterState: any[]
}

const DEFAULT_SETTINGS: GridSettings = {
  columnVisibility: {},
  columnOrder: [],
  frozenColumns: [],
  pageSize: 50,
  searchType: 'advanced',
  sortingState: [],
  filterState: []
}

/**
 * Hook for persistent grid settings using localStorage
 * @param gridId - Unique identifier for the grid instance
 */
export function useGridSettings(gridId: string) {
  const storageKey = `grid-settings-${gridId}`

  const [settings, setSettings] = useState<GridSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS

    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS
    } catch (error) {
      return DEFAULT_SETTINGS
    }
  })

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: Partial<GridSettings>) => {
    const updatedSettings = { ...settings, ...newSettings }
    setSettings(updatedSettings)

    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedSettings))
    } catch (error) {
    }
  }, [settings, storageKey])

  // Individual setting updaters
  const updateColumnVisibility = useCallback((visibility: Record<string, boolean>) => {
    saveSettings({ columnVisibility: visibility })
  }, [saveSettings])

  const updateColumnOrder = useCallback((order: string[]) => {
    saveSettings({ columnOrder: order })
  }, [saveSettings])

  const updateFrozenColumns = useCallback((frozen: string[]) => {
    saveSettings({ frozenColumns: frozen })
  }, [saveSettings])

  const updatePageSize = useCallback((size: number) => {
    saveSettings({ pageSize: size })
  }, [saveSettings])

  const updateSearchType = useCallback((type: 'advanced' | 'new') => {
    saveSettings({ searchType: type })
  }, [saveSettings])

  const updateSortingState = useCallback((sorting: any[]) => {
    saveSettings({ sortingState: sorting })
  }, [saveSettings])

  const updateFilterState = useCallback((filters: any[]) => {
    saveSettings({ filterState: filters })
  }, [saveSettings])

  // Clear all settings
  const clearSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    try {
      localStorage.removeItem(storageKey)
    } catch (error) {
    }
  }, [storageKey])

  return {
    settings,
    updateColumnVisibility,
    updateColumnOrder,
    updateFrozenColumns,
    updatePageSize,
    updateSearchType,
    updateSortingState,
    updateFilterState,
    clearSettings,
    saveSettings
  }
}