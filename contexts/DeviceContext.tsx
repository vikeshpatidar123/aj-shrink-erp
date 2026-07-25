'use client'

import * as React from 'react'

interface DeviceContextValue {
  deviceType: 'desktop' | 'mobile' | 'tablet'
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
}

const DeviceContext = React.createContext<DeviceContextValue>({
  deviceType: 'desktop',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
})

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [deviceType, setDeviceType] = React.useState<'desktop' | 'mobile' | 'tablet'>('desktop')

  React.useEffect(() => {
    const update = () => {
      const width = window.innerWidth

      // Use viewport width only — UA-based detection breaks DevTools responsive mode
      if (width <= 768) {
        setDeviceType('mobile')
      } else if (width <= 1024) {
        setDeviceType('tablet')
      } else {
        setDeviceType('desktop')
      }
    }

    update()

    const mql = window.matchMedia('(max-width: 768px)')
    const tabletMql = window.matchMedia('(max-width: 1024px)')

    const handler = () => update()
    mql.addEventListener('change', handler)
    tabletMql.addEventListener('change', handler)

    return () => {
      mql.removeEventListener('change', handler)
      tabletMql.removeEventListener('change', handler)
    }
  }, [])

  // Sync <meta name="theme-color"> from --color-primary CSS variable
  React.useEffect(() => {
    const syncThemeColor = () => {
      const rgb = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
      if (!rgb) return
      const [r, g, b] = rgb.split(/\s+/).map(Number)
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'theme-color'
        document.head.appendChild(meta)
      }
      meta.content = hex
    }

    syncThemeColor()
    // Re-sync when theme class changes on <html>
    const observer = new MutationObserver(syncThemeColor)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const value = React.useMemo(() => ({
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
  }), [deviceType])

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  )
}

export function useDevice() {
  return React.useContext(DeviceContext)
}
