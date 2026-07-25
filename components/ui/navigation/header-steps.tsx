'use client'

import * as React from 'react'
import { CheckCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'

export interface HeaderStepItem {
  id: number
  label: string
  subtitle?: string
  icon?: LucideIcon
}

interface HeaderStepsProps {
  steps: HeaderStepItem[]
  currentStep: number
  onStepClick?: (stepId: number) => void
  className?: string
}

export function HeaderSteps({ steps, currentStep, onStepClick, className }: HeaderStepsProps) {
  const { t } = useLanguage()

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div className="flex min-w-max items-start justify-center gap-0 px-1 py-1 sm:min-w-0">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id
          const isCompleted = currentStep > step.id

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => { if (isCompleted) onStepClick?.(step.id) }}
                disabled={!isCompleted && !isActive}
                className={cn(
                  'group flex min-w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors sm:min-w-[6rem]',
                  isCompleted && 'cursor-pointer hover:bg-[rgb(var(--bg-hover))]'
                )}
              >
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all sm:h-9 sm:w-9 sm:text-sm',
                  isActive && 'bg-[rgb(var(--color-primary))] text-[rgb(var(--fg-inverse))] shadow-md',
                  isCompleted && 'bg-[rgb(var(--color-success))] text-[rgb(var(--fg-inverse))] shadow-sm',
                  !isActive && !isCompleted && 'border-2 border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-subtle))]'
                )}>
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : step.id}
                </div>
                <span className={cn(
                  'hidden whitespace-nowrap text-[10px] font-medium sm:block sm:text-[11px]',
                  isActive && 'text-[rgb(var(--color-primary))]',
                  isCompleted && 'text-[rgb(var(--color-success))]',
                  !isActive && !isCompleted && 'text-[rgb(var(--fg-subtle))]'
                )}>
                  {t(step.label)}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div className={cn(
                  'mt-5 h-px w-6 shrink-0 sm:w-12 lg:w-20',
                  currentStep > step.id ? 'bg-[rgb(var(--color-success))]' : 'bg-[rgb(var(--bd-default))]'
                )} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
