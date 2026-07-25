'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { Dropdown } from '@/components/forms/dropdown'

// ============================================================================
// OLD RADIX TABS (Keep for backwards compatibility with existing pages)
// ============================================================================
const TabsRoot = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-[rgb(var(--bg-subtle))] p-1 text-[rgb(var(--fg-muted))]',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-[rgb(var(--bg-surface))] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-primary))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[rgb(var(--bg-surface))] data-[state=active]:text-[rgb(var(--fg-default))] data-[state=active]:shadow-sm',
      className
    )}
    suppressHydrationWarning
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-[rgb(var(--bg-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-primary))] focus-visible:ring-offset-2',
      className
    )}
    suppressHydrationWarning
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

// ============================================================================
// NEW PILL TABS (Modern unified component)
// ============================================================================
export interface TabItem {
  id: string
  label: string
  icon?: LucideIcon
  /** Dropdown options for this tab (for time filter style) */
  dropdownOptions?: Array<{ value: string; label: string }>
}

export interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onTabChange: (tabId: string) => void
  fullWidth?: boolean
  className?: string
  /** Visual variant: 'pill' (default) or 'rounded' (square corners) */
  variant?: 'pill' | 'rounded'
  /** Size variant */
  size?: 'sm' | 'md'
  /** For dropdown mode: currently selected values per tab */
  dropdownValues?: Record<string, string[]>
  /** For dropdown mode: callback when dropdown selection changes */
  onDropdownChange?: (tabId: string, selectedValues: string[]) => void
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  fullWidth = false,
  className = '',
  variant = 'pill',
  size = 'md',
  dropdownValues,
  onDropdownChange
}: TabsProps) {
  const handleDropdownChange = React.useCallback((tabId: string) => (selected: string | number | string[]) => {
    const newValues = Array.isArray(selected) ? selected : [selected.toString()]
    onDropdownChange?.(tabId, newValues)
  }, [onDropdownChange])

  const containerClasses = cn(
    'inline-flex items-center max-w-full overflow-x-auto scrollbar-hide [-webkit-overflow-scrolling:touch]',
    variant === 'pill' && 'bg-[rgb(var(--bg-subtle))] rounded-full border border-[rgb(var(--bd-default))] p-px gap-0.5',
    variant === 'rounded' && 'rounded-lg border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] p-0.5',
    fullWidth && 'w-full',
    className
  )

  const getButtonClasses = (isActive: boolean) => cn(
    'tab-pill inline-flex items-center gap-1.5 font-medium transition-colors whitespace-nowrap flex-shrink-0',
    variant === 'pill' && 'rounded-full',
    variant === 'rounded' && 'rounded-md',
    size === 'sm' && 'px-2.5 py-1 text-xs',
    size === 'md' && 'px-3 py-1.5 text-xs leading-none sm:px-4 sm:py-1.5 sm:text-sm sm:leading-normal',
    fullWidth && 'flex-1 justify-center',
    isActive
      ? variant === 'pill'
        ? 'bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))]'
        : 'bg-[rgb(var(--color-primary))] text-white shadow-sm'
      : 'text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-subtle))]'
  )

  return (
    <div className={containerClasses}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        const hasDropdown = tab.dropdownOptions && tab.dropdownOptions.length > 0

        if (hasDropdown) {
          return (
            <Dropdown
              key={tab.id}
              options={tab.dropdownOptions!}
              value={dropdownValues?.[tab.id] || []}
              onValueChange={handleDropdownChange(tab.id)}
              onOpen={() => {
                if (!isActive) {
                  onTabChange(tab.id)
                }
              }}
              placeholder={tab.label}
              multiSelect
              searchable
              showOnlyButton
              customTrigger={
                <button type="button" className={getButtonClasses(isActive)}>
                  {Icon && <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />}
                  {tab.label}
                </button>
              }
            />
          )
        }

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={getButtonClasses(isActive)}
          >
            {Icon && <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// Export old Radix components for backwards compatibility
export { TabsRoot, TabsList, TabsTrigger, TabsContent }
// Also export TabsRoot as Tabs for legacy code that imports { Tabs }
export { TabsRoot as RadixTabs }