'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface BooleanBadgeProps {
  value: boolean
  variant?: 'success' | 'info' | 'primary'
  className?: string
}

const variantStyles = {
  success: {
    true: 'text-green-600 bg-green-100',
    false: 'text-gray-400 bg-gray-100',
  },
  info: {
    true: 'text-blue-600 bg-blue-100',
    false: 'text-gray-400 bg-gray-100',
  },
  primary: {
    true: 'text-[rgb(var(--color-primary))] bg-[color-mix(in_srgb,rgb(var(--color-primary))_10%,white)]',
    false: 'text-gray-400 bg-gray-100',
  },
}

export const BooleanBadge = React.forwardRef<HTMLSpanElement, BooleanBadgeProps>(
  ({ value, variant = 'success', className }, ref) => {
    const styles = variantStyles[variant]

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center w-5 h-5 rounded-full',
          value ? styles.true : styles.false,
          className
        )}
      >
        {value ? '✓' : '✗'}
      </span>
    )
  }
)

BooleanBadge.displayName = 'BooleanBadge'
