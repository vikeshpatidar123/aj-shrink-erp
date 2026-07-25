'use client'
import * as React from 'react'

interface SearchPreferences {
  searchType: 'advanced' | 'new'
  defaultSearchType: 'advanced' | 'new'
  setSearchType: (type: 'advanced' | 'new') => void
}

const SearchPreferencesContext = React.createContext<SearchPreferences>({
  searchType: 'advanced',
  defaultSearchType: 'advanced',
  setSearchType: () => {},
})

export function SearchPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [searchType, setSearchType] = React.useState<'advanced' | 'new'>('advanced')
  return (
    <SearchPreferencesContext.Provider value={{ searchType, defaultSearchType: 'advanced', setSearchType }}>
      {children}
    </SearchPreferencesContext.Provider>
  )
}

export function useSearchPreferences() {
  return React.useContext(SearchPreferencesContext)
}
