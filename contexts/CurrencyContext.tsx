'use client'
import * as React from 'react'

interface CurrencyInfo {
  code: string
  symbol: string
  name: string
}

interface CurrencyContextValue {
  currency: string
  currencySymbol: string
  selectedCurrency: string
  formatAmount: (amount: number) => string
  getCurrencyInfo: (code: string) => CurrencyInfo
}

const defaultCurrencyInfo: CurrencyInfo = { code: 'INR', symbol: '₹', name: 'Indian Rupee' }

const CurrencyContext = React.createContext<CurrencyContextValue>({
  currency: 'INR',
  currencySymbol: '₹',
  selectedCurrency: 'INR',
  formatAmount: (amount) => `₹${amount.toLocaleString('en-IN')}`,
  getCurrencyInfo: (_code: string) => defaultCurrencyInfo,
})

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const formatAmount = (amount: number) => `₹${amount.toLocaleString('en-IN')}`
  const getCurrencyInfo = (_code: string): CurrencyInfo => defaultCurrencyInfo
  return (
    <CurrencyContext.Provider value={{ currency: 'INR', currencySymbol: '₹', selectedCurrency: 'INR', formatAmount, getCurrencyInfo }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return React.useContext(CurrencyContext)
}
