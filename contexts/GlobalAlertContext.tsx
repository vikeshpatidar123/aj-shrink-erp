'use client'
import * as React from 'react'

interface GlobalAlert {
  showAlert: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
  showWarning: (title: string, message?: string, buttons?: any[]) => void
  showConfirm: (message: string, onConfirm: () => void, onCancel?: () => void) => void
  hideAlert: () => void
}

const GlobalAlertContext = React.createContext<GlobalAlert>({
  showAlert: (msg) => alert(msg),
  showWarning: (title, message) => { window.alert(`${title}\n${message ?? ''}`) },
  showConfirm: (msg, onConfirm) => { if (confirm(msg)) onConfirm() },
  hideAlert: () => {},
})

export function GlobalAlertProvider({ children }: { children: React.ReactNode }) {
  const showAlert = (message: string) => alert(message)
  const showWarning = (title: string, message?: string, _buttons?: any[]) => {
    window.alert(`${title}${message ? '\n' + message : ''}`)
  }
  const showConfirm = (message: string, onConfirm: () => void, onCancel?: () => void) => {
    if (window.confirm(message)) onConfirm()
    else onCancel?.()
  }
  const hideAlert = () => {}
  return (
    <GlobalAlertContext.Provider value={{ showAlert, showWarning, showConfirm, hideAlert }}>
      {children}
    </GlobalAlertContext.Provider>
  )
}

export function useGlobalAlert() {
  return React.useContext(GlobalAlertContext)
}
