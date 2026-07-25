'use client'
import * as React from 'react'

interface LanguageContextValue {
  language: string
  setLanguage: (lang: string) => void
  t: (key: string, fallback?: string) => string
}

const LanguageContext = React.createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key, fallback) => fallback ?? key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = React.useState('en')
  const t = (key: string, fallback?: string) => fallback ?? key
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return React.useContext(LanguageContext)
}
