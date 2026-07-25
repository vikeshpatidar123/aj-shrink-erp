'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

interface FooterProps {
  children?: React.ReactNode
  className?: string
  variant?: string
  gradient?: boolean
  actions?: React.ReactNode
}

export function Footer({ children, className }: FooterProps) {
  return (
    <div className={cn("flex items-center gap-2 px-4 py-3 border-t border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))]", className)}>
      {children}
    </div>
  )
}

export default Footer
