'use client'
import * as React from 'react'

interface PageAccess {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canExport: boolean
  canImport: boolean
  canSave: boolean
  canPrint: boolean
  canCancel: boolean
  isLoading: boolean
}

const defaultAccess: PageAccess = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canExport: true,
  canImport: true,
  canSave: true,
  canPrint: true,
  canCancel: true,
  isLoading: false,
}

const ModuleAuthContext = React.createContext<PageAccess>(defaultAccess)

export function ModuleAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ModuleAuthContext.Provider value={defaultAccess}>
      {children}
    </ModuleAuthContext.Provider>
  )
}

export function usePageAccess() {
  return React.useContext(ModuleAuthContext)
}
