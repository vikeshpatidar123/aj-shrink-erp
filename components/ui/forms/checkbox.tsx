import React from 'react'
import { clsx } from 'clsx'
import { Check, Minus } from 'lucide-react'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  indeterminate?: boolean
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  className,
  indeterminate,
  checked,
  ...props
}) => {
  const checkboxRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate ?? false
    }
  }, [indeterminate])

  const isChecked = checked || (checkboxRef.current?.checked ?? false)

  return (
    <div className="flex items-center">
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={checked}
          className="sr-only peer"
          {...props}
        />
        <div className={clsx(
          'h-4 w-4 rounded-sm border flex items-center justify-center transition-colors',
          (isChecked || indeterminate)
            ? 'bg-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]'
            : 'border-gray-300 bg-white',
          className
        )}>
          {indeterminate ? (
            <Minus className="h-3 w-3 text-white" strokeWidth={3} />
          ) : isChecked ? (
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          ) : null}
        </div>
      </label>
      {label && (
        <label className="ml-2 block text-xs text-gray-700">
          {label}
        </label>
      )}
    </div>
  )
}
