"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, defaultChecked, onCheckedChange, disabled, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState(defaultChecked ?? false)

    const checkedState = checked !== undefined ? checked : isChecked

    const handleClick = () => {
      if (disabled) return
      const newValue = !checkedState
      if (checked === undefined) {
        setIsChecked(newValue)
      }
      onCheckedChange?.(newValue)
    }

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checkedState}
        disabled={disabled}
        onClick={handleClick}
        ref={ref}
        className={cn(
          "peer inline-flex h-4 w-7 !min-h-0 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          checkedState
            ? "bg-[rgb(var(--color-primary))] hover:opacity-90"
            : "bg-gray-300 hover:bg-gray-400",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "pointer-events-none block h-3 w-3 rounded-full bg-white shadow-lg ring-0 transition-transform",
            checkedState ? "translate-x-3" : "translate-x-0"
          )}
        />
      </button>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }