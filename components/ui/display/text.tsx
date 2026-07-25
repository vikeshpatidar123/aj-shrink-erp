'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const textVariants = cva(
  'transition-colors',
  {
    variants: {
      variant: {
        default: 'text-gray-900',
        muted: 'text-gray-500',
        primary: 'text-blue-600',
        secondary: 'text-gray-600',
        destructive: 'text-red-600',
        success: 'text-green-600',
        warning: 'text-orange-600',
        link: 'text-blue-600 hover:text-blue-800 underline cursor-pointer',
        'link-hover': 'text-black hover:text-blue-600 hover:underline cursor-pointer'
      },
      size: {
        xs: 'text-xs',
        sm: 'text-sm',
        base: 'text-base',
        lg: 'text-lg',
        xl: 'text-xl',
        '2xl': 'text-2xl',
        '3xl': 'text-3xl',
        '4xl': 'text-4xl'
      },
      weight: {
        normal: 'font-normal',
        medium: 'font-medium',
        semibold: 'font-semibold',
        bold: 'font-bold'
      },
      align: {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
        justify: 'text-justify'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'base',
      weight: 'normal',
      align: 'left'
    }
  }
)

export interface TextProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof textVariants> {
  as?: 'span' | 'p' | 'div' | 'label' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  truncate?: boolean
}

const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ className, variant, size, weight, align, as: Component = 'span', truncate, children, ...props }, ref) => {
    const textClasses = cn(
      textVariants({ variant, size, weight, align }),
      truncate && 'truncate',
      className
    )

    return React.createElement(
      Component,
      {
        className: textClasses,
        ref,
        ...props
      },
      children
    )
  }
)

Text.displayName = 'Text'

export { Text, textVariants }