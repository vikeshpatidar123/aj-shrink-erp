'use client'

import React from 'react'
import { X, Save, XCircle, LucideIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Badge
} from '@/components/ui'
import { Footer } from '@/components/layout/footer'
import { cn } from '@/lib/utils'

export interface StandardModalProps {
  // Required props
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode

  // Optional props
  subtitle?: string
  badge?: {
    label: string
    variant?: 'default' | 'outline' | 'secondary' | 'destructive'
  }
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string

  // Footer configuration
  showFooter?: boolean
  footerActions?: React.ReactNode
  onSave?: () => void
  onCancel?: () => void
  saveLabel?: string
  cancelLabel?: string
  saveIcon?: LucideIcon
  cancelIcon?: LucideIcon
  saving?: boolean

  // Accessibility
  ariaDescribedBy?: string
  ariaDescription?: string
}

const sizeClasses = {
  sm: 'w-[500px] h-[400px]',
  md: 'w-[700px] h-[600px]',
  lg: 'w-[90vw] h-[80vh]',
  xl: 'w-[95vw] h-[90vh]',
  full: 'w-[98vw] h-[98vh]'
}

export function StandardModal({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  size = 'lg',
  className,
  showFooter = true,
  footerActions,
  onSave,
  onCancel,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  saveIcon: SaveIcon = Save,
  cancelIcon: CancelIcon = XCircle,
  saving = false,
  ariaDescribedBy = 'modal-description',
  ariaDescription
}: StandardModalProps) {

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      onClose()
    }
  }

  const defaultFooterActions = (onSave || onCancel) && (
    <>
      <Button
        variant="action-cancel"
        onClick={handleCancel}
        icon={CancelIcon}
        disabled={saving}
      >
        {cancelLabel}
      </Button>
      {onSave && (
        <Button
          variant="action-save"
          onClick={onSave}
          icon={SaveIcon}
          disabled={saving}
        >
          {saving ? 'Saving...' : saveLabel}
        </Button>
      )}
    </>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'max-w-none bg-[rgb(var(--bg-surface))] p-0 flex flex-col overflow-hidden',
          sizeClasses[size],
          className
        )}
        hideCloseButton={true}
        aria-describedby={ariaDescribedBy}
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 pt-3 pb-2 border-b border-[rgb(var(--bd-default))] bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <DialogTitle className="text-lg font-semibold text-[rgb(var(--fg-default))]">
                  {title}
                </DialogTitle>
                {subtitle && (
                  <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
              {badge && (
                <Badge variant={badge.variant || 'outline'} className="text-sm">
                  {badge.label}
                </Badge>
              )}
            </div>
            <button
              onClick={onClose}
              className="close-btn-md hover:bg-[rgb(var(--bg-subtle))] rounded transition-colors p-1"
              aria-label="Close modal"
            >
              <X className="h-5 w-5 text-[rgb(var(--fg-default))]" />
            </button>
          </div>
          {ariaDescription && (
            <div id={ariaDescribedBy} className="sr-only">
              {ariaDescription}
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        {showFooter && (
          <Footer
            variant="modal"
            gradient={true}
            actions={footerActions || defaultFooterActions}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
