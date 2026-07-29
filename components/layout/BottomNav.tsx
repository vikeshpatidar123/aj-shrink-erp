'use client'
import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Calculator, BookMarked, Printer, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

const BOTTOM_TABS = [
  { name: 'Dashboard',  path: '/dashboard',               icon: LayoutDashboard },
  { name: 'Estimation', path: '/gravure/estimation',      icon: Calculator },
  { name: 'Catalog',    path: '/gravure/product-catalog', icon: BookMarked },
  { name: 'Work Order', path: '/gravure/workorder',       icon: Printer },
]

interface BottomNavProps {
  onOpenMenu?: () => void
}

export function BottomNav({ onOpenMenu }: BottomNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(path + '/')

  return (
    <nav
      id="mobile-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t"
      style={{
        background: 'var(--erp-sidebar-bg)',
        borderColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="relative flex h-14 px-1">
        {BOTTOM_TABS.map((tab) => {
          const active = isActive(tab.path)
          const Icon = tab.icon
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 flex-1 transition-all duration-200 touch-manipulation mx-0.5',
                active ? '-mt-3 h-[68px] rounded-t-2xl' : 'h-14'
              )}
              style={active ? {
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderBottom: 'none',
              } : undefined}
            >
              {/* Curved connectors */}
              {active && (
                <>
                  <div className="absolute -left-2 bottom-0 w-2 h-2 pointer-events-none">
                    <svg width="8" height="8" viewBox="0 0 8 8">
                      <path d="M8,0 Q8,8 0,8 L0,0 Z" fill="var(--erp-sidebar-bg)" />
                    </svg>
                  </div>
                  <div className="absolute -right-2 bottom-0 w-2 h-2 pointer-events-none">
                    <svg width="8" height="8" viewBox="0 0 8 8">
                      <path d="M0,0 Q0,8 8,8 L8,0 Z" fill="var(--erp-sidebar-bg)" />
                    </svg>
                  </div>
                </>
              )}

              <Icon
                size={18}
                className="shrink-0 transition-all duration-200"
                style={{ color: active ? 'var(--erp-primary)' : 'rgba(255,255,255,0.5)' }}
              />
              <span
                className={cn('text-[0.6rem] leading-none truncate max-w-full px-0.5', active ? 'font-semibold' : 'font-medium')}
                style={{ color: active ? 'var(--erp-primary)' : 'rgba(255,255,255,0.5)' }}
              >
                {tab.name}
              </span>
            </button>
          )
        })}

        {/* Menu button */}
        <button
          onClick={onOpenMenu}
          className="relative flex flex-col items-center justify-center gap-1 flex-1 h-14 touch-manipulation mx-0.5 hover:bg-white/5 rounded-lg transition-colors"
        >
          <Menu size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
          <span className="text-[0.6rem] leading-none font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Menu
          </span>
        </button>
      </div>
    </nav>
  )
}
