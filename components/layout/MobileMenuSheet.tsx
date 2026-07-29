'use client'
import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X, Search, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navItems, type FlatItem, type GroupItem } from './Sidebar'

interface MobileMenuSheetProps {
  open: boolean
  onClose: () => void
}

export function MobileMenuSheet({ open, onClose }: MobileMenuSheetProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>([])
  const searchRef = React.useRef<HTMLInputElement>(null)

  const topLevel = React.useMemo(() => navItems.filter((i): i is FlatItem => 'href' in i), [])
  const groups   = React.useMemo(() => navItems.filter((i): i is GroupItem => !('href' in i)), [])

  // Reset on open — expand the group that contains the current page
  React.useEffect(() => {
    if (!open) return
    setSearchQuery('')
    const active = groups.find(g => g.children.some(c => pathname === c.href || pathname?.startsWith(c.href + '/')))
    setExpandedGroups(active ? [active.label] : [])
  }, [open, pathname, groups])

  // Prevent body scroll when open
  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const query = searchQuery.toLowerCase().trim()

  const filteredTop = query
    ? topLevel.filter(i => i.label.toLowerCase().includes(query))
    : topLevel

  const filteredGroups = groups
    .map(g => ({
      ...g,
      children: query
        ? g.children.filter(c => c.label.toLowerCase().includes(query) || g.label.toLowerCase().includes(query))
        : g.children,
    }))
    .filter(g => g.children.length > 0)

  // Auto-expand all matching groups while searching
  React.useEffect(() => {
    if (query) setExpandedGroups(filteredGroups.map(g => g.label))
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (name: string) =>
    setExpandedGroups(prev => prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name])

  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(path + '/')

  const navigate = (path: string) => { onClose(); router.push(path) }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-[61] lg:hidden rounded-t-2xl shadow-2xl',
          'flex flex-col max-h-[85vh]',
          'transform transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ background: 'var(--erp-sidebar-bg)' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-white/80">AD</span>
          </div>
          <p className="text-sm font-semibold text-white flex-1 truncate">Admin</p>
          <button
            onClick={onClose}
            className="p-2 -mr-1 rounded-lg text-white/60 hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search modules..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg bg-white/10 border border-white/15 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); searchRef.current?.focus() }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Module list */}
        <div className="flex-1 overflow-y-auto px-2 pb-6">

          {/* Top-level flat items */}
          {filteredTop.map(item => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors min-h-[2.75rem] mb-0.5',
                  active ? 'bg-white/15' : 'hover:bg-white/[0.06]'
                )}
              >
                <Icon size={15} className="flex-shrink-0" style={{ color: active ? 'var(--erp-primary)' : 'rgba(255,255,255,0.6)' }} />
                <span className={cn('text-sm flex-1', active ? 'font-semibold text-white' : 'text-white/80')}>
                  {item.label}
                </span>
                {item.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/15 text-white/80">
                    {item.badge}
                  </span>
                )}
                {active && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--erp-primary)' }} />}
              </button>
            )
          })}

          {/* Group items */}
          {filteredGroups.map(group => {
            const GroupIcon = group.icon
            const isExpanded = expandedGroups.includes(group.label)
            return (
              <div key={group.label} className="mb-0.5">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-white/[0.06] transition-colors min-h-[2.75rem]"
                >
                  <GroupIcon size={15} className="text-white/50 flex-shrink-0" />
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wide flex-1">
                    {group.label}
                  </span>
                  {group.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/15 text-white/80">
                      {group.badge}
                    </span>
                  )}
                  <ChevronRight
                    size={13}
                    className={cn('text-white/30 transition-transform duration-200', isExpanded && 'rotate-90')}
                  />
                </button>

                {isExpanded && (
                  <div className="ml-5 pl-3 border-l border-white/15 mb-1">
                    {group.children.map(mod => {
                      const ModIcon = mod.icon
                      const active = isActive(mod.href)
                      return (
                        <button
                          key={mod.href}
                          onClick={() => navigate(mod.href)}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors min-h-[2.5rem]',
                            active ? 'bg-white/10' : 'hover:bg-white/[0.06]'
                          )}
                        >
                          <ModIcon size={13} className="flex-shrink-0" style={{ color: active ? 'var(--erp-primary)' : 'rgba(255,255,255,0.5)' }} />
                          <span className={cn('text-sm flex-1', active ? 'font-semibold text-white' : 'text-white/70')}>
                            {mod.label}
                          </span>
                          {active && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--erp-primary)' }} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {filteredTop.length === 0 && filteredGroups.length === 0 && (
            <div className="py-12 text-center">
              <Search size={28} className="mx-auto mb-2 text-white/20" />
              <p className="text-sm text-white/40">No modules found</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
