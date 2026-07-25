'use client'

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useDevice } from '@/contexts/DeviceContext'
import { Dropdown } from '@/components/forms/dropdown'

const badgeVariants = cva(
  "inline-flex items-center rounded-full border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 truncate",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Department-style badge with CSS variables
        department:
          "border-transparent bg-[color-mix(in_srgb,rgb(var(--color-primary))_10%,white)] text-[rgb(var(--color-primary))]",
        // Module type style badge
        module:
          "border-transparent bg-[color-mix(in_srgb,rgb(var(--color-purple))_10%,white)] text-[rgb(var(--color-purple))]",
        // Status badges
        success:
          "border-transparent bg-[rgb(var(--color-success-subtle))] text-[rgb(var(--color-success))]",
        warning:
          "border-transparent bg-yellow-100 text-yellow-800",
        danger:
          "border-transparent bg-red-100 text-red-800",
        info:
          "border-transparent bg-blue-100 text-blue-800",
        // Additional color variants for departments
        purple:
          "border-transparent bg-purple-100 text-purple-800",
        pink:
          "border-transparent bg-pink-100 text-pink-800",
        orange:
          "border-transparent bg-orange-100 text-orange-800",
        teal:
          "border-transparent bg-teal-100 text-teal-800",
        cyan:
          "border-transparent bg-cyan-100 text-cyan-800",
        indigo:
          "border-transparent bg-indigo-100 text-indigo-800",
        violet:
          "border-transparent bg-violet-100 text-violet-800",
        amber:
          "border-transparent bg-amber-100 text-amber-800",
        lime:
          "border-transparent bg-lime-100 text-lime-800",
        emerald:
          "border-transparent bg-emerald-100 text-emerald-800",
        sky:
          "border-transparent bg-sky-100 text-sky-800",
        rose:
          "border-transparent bg-rose-100 text-rose-800",
        // Clickable filter variants (selected state)
        'primary-selected':
          "border-transparent bg-[rgb(var(--color-primary))] text-white shadow-md",
        'warning-selected':
          "border-transparent bg-[rgb(var(--color-warning))] text-white shadow-md",
        'success-selected':
          "border-transparent bg-[rgb(var(--color-success))] text-white shadow-md",
        'orange-selected':
          "border-transparent bg-[rgb(var(--color-orange))] text-white shadow-md",
        'error-selected':
          "border-transparent bg-[rgb(var(--color-error))] text-white shadow-md",
        // Clickable filter variants (unselected state)
        'primary-unselected':
          "border-transparent bg-[rgb(var(--color-primary-subtle))] text-[rgb(var(--color-primary))] hover:opacity-80",
        'warning-unselected':
          "border-transparent bg-[rgb(var(--color-warning-subtle))] text-[rgb(var(--color-warning))] hover:opacity-80",
        'success-unselected':
          "border-transparent bg-[rgb(var(--color-success-subtle))] text-[rgb(var(--color-success))] hover:opacity-80",
        'orange-unselected':
          "border-transparent bg-[rgb(var(--color-orange-subtle))] text-[rgb(var(--color-orange))] hover:opacity-80",
        'error-unselected':
          "border-transparent bg-[rgb(var(--color-error-subtle))] text-[rgb(var(--color-error))] hover:opacity-80",
      },
      size: {
        default: "px-1.5 sm:px-2.5 py-0.5 text-[10px] sm:text-xs",
        sm: "px-1.5 py-0 text-[9px] leading-4",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

Badge.displayName = 'Badge'

/**
 * FilterBadge - Clickable badge for status filters
 * Responsive: smaller on mobile, full text on desktop
 */
export type FilterBadgeVariant = 'primary' | 'warning' | 'success' | 'orange' | 'error'

export interface FilterBadgeProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  shortLabel?: string
  count: number
  variant: FilterBadgeVariant
  selected?: boolean
}

function FilterBadge({
  label,
  shortLabel,
  count,
  variant,
  selected = false,
  className,
  ...props
}: FilterBadgeProps) {
  const selectedVariant = `${variant}-selected` as const
  const unselectedVariant = `${variant}-unselected` as const

  return (
    <button
      type="button"
      className={cn(
        badgeVariants({ variant: selected ? selectedVariant : unselectedVariant }),
        'px-2 sm:px-3 py-1 sm:py-1.5 font-semibold cursor-pointer hover:scale-105 transition-all',
        className
      )}
      {...props}
    >
      <span className="hidden sm:inline">{label}</span>
      {shortLabel && <span className="sm:hidden">{shortLabel}</span>}
      {!shortLabel && <span className="sm:hidden">{label}</span>}
      <span className="ml-0.5 sm:ml-1 opacity-75">({count})</span>
    </button>
  )
}

FilterBadge.displayName = 'FilterBadge'

/**
 * FilterBadgeGroup - Badges on desktop, compact dropdown on mobile
 */
export interface FilterBadgeItem {
  id: string
  label: string
  shortLabel?: string
  count: number
  variant: FilterBadgeVariant
}

export interface FilterBadgeGroupProps {
  items: FilterBadgeItem[]
  selected: string
  onSelect: (id: string) => void
  className?: string
}

const variantColorVar: Record<FilterBadgeVariant, string> = {
  primary: '--color-primary',
  warning: '--color-warning',
  success: '--color-success',
  orange: '--color-orange',
  error: '--color-error',
}

function FilterBadgeGroup({ items, selected, onSelect, className }: FilterBadgeGroupProps) {
  const { isMobile } = useDevice()

  if (isMobile) {
    const selectedItem = items.find(i => i.id === selected)
    const cssVar = selectedItem ? variantColorVar[selectedItem.variant] : '--color-primary'

    return (
      <div
        className={cn('rounded-full overflow-hidden [&_button]:!bg-transparent [&_button]:!border-transparent [&_button]:!text-white [&_button]:!shadow-none [&_svg]:!text-white', className)}
        style={{ backgroundColor: `rgb(var(${cssVar}))` }}
      >
        <Dropdown
          options={items.map(item => ({ value: item.id, label: `${item.label} (${item.count})` }))}
          value={selected}
          onValueChange={(val) => onSelect(val as string)}
          size="sm"
          clearable={false}
        />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-start gap-2 flex-wrap', className)}>
      {items.map(item => (
        <FilterBadge
          key={item.id}
          label={item.label}
          shortLabel={item.shortLabel}
          count={item.count}
          variant={item.variant}
          selected={selected === item.id}
          onClick={() => onSelect(item.id)}
        />
      ))}
    </div>
  )
}

FilterBadgeGroup.displayName = 'FilterBadgeGroup'

export { Badge, FilterBadge, FilterBadgeGroup, badgeVariants }