import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  error?: string | boolean
  helper?: string
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
  onRightIconClick?: () => void
  selectOnFocus?: boolean // Auto-select all text when input is focused
  // Joined input group props
  position?: 'first' | 'middle' | 'last' | 'only' // Position in a joined group
  compact?: boolean // Compact mode for inline inputs (no wrapper, no label spacing)
  // Edit tracking props
  trackEdits?: boolean // Enable edit tracking and highlighting
  originalValue?: string | number // Original value from database/API (for comparison)
  isEdited?: boolean // External control: mark as edited (overrides internal tracking)
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type = "text",
    label,
    error,
    helper,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    onRightIconClick,
    onKeyDown,
    selectOnFocus = true,
    onFocus,
    position,
    compact = false,
    trackEdits = false,
    originalValue,
    isEdited: externalIsEdited,
    ...props
  }, ref) => {
    const hasError = !!error
    const generatedId = React.useId()
    const inputId = props.id || generatedId
    const inputName = props.name || inputId

    // Track if field has been edited
    const [hasBeenEdited, setHasBeenEdited] = React.useState(false)

    // Determine if field is edited
    const isEdited = React.useMemo(() => {
      // If external control is provided, use that
      if (externalIsEdited !== undefined) return externalIsEdited

      // If tracking is enabled and we have an original value
      if (trackEdits && originalValue !== undefined) {
        const currentValue = props.value !== undefined ? props.value : props.defaultValue
        // Compare values (handle string/number conversion)
        return String(currentValue) !== String(originalValue) || hasBeenEdited
      }

      return hasBeenEdited
    }, [trackEdits, originalValue, props.value, props.defaultValue, externalIsEdited, hasBeenEdited])

    // Track onChange to mark as edited
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (trackEdits) {
        setHasBeenEdited(true)
      }
      props.onChange?.(e)
    }

    // Handle focus event to select all text
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (selectOnFocus) {
        e.target.select()
      }
      onFocus?.(e)
    }

    // Handle key down for number inputs to prevent negative values
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (type === 'number') {
        if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
          e.preventDefault()
          return
        }
      }
      onKeyDown?.(e)
    }

    // Compact mode - just return the input without wrapper
    if (compact) {
      return (
        <input
          id={inputId}
          name={inputName}
          type={type}
          className={cn(
            "flex h-10 w-full border px-3 py-2 text-xs",
            "bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-subtle))]",
            "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/10",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all duration-200",
            type === "number" && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            // Joined group styling
            position === 'first' && "rounded-l border-r-0",
            position === 'middle' && "border-r-0",
            position === 'last' && "rounded-r",
            position === 'only' && "rounded",
            !position && "rounded",
            // Edited field highlighting
            isEdited && "bg-[rgb(var(--color-warning-subtle))] border-[rgb(var(--color-warning))]",
            // Border color
            hasError
              ? "border-[rgb(var(--color-danger))] focus:border-[rgb(var(--color-danger))]"
              : isEdited
                ? "border-[rgb(var(--color-warning))] focus:border-[rgb(var(--color-warning))] focus:ring-[rgb(var(--color-warning))]/20 focus:z-10"
                : "border-[rgb(var(--bd-default))] focus:border-[rgb(var(--color-primary))] focus:z-10",
            className
          )}
          ref={ref}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          min={type === 'number' ? 0 : undefined}
          {...props}
        />
      )
    }

    // Standard mode with wrapper
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-[rgb(var(--fg-default))] mb-1.5"
            suppressHydrationWarning
          >
            {label}
          </label>
        )}

        <div className="relative">
          {LeftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <LeftIcon className="h-4 w-4 text-[rgb(var(--fg-muted))]" />
            </div>
          )}

          <input
            id={inputId}
            name={inputName}
            type={type}
            className={cn(
              "flex h-10 w-full rounded-md border px-3 py-2 text-xs",
              "bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-subtle))]",
              "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/10",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[rgb(var(--bg-subtle))]",
              "transition-all duration-200",
              type === "number" && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              LeftIcon && "pl-10",
              RightIcon && "pr-10",
              // Edited field highlighting
              isEdited && !props.disabled && "bg-[rgb(var(--color-warning-subtle))] border-[rgb(var(--color-warning))]",
              // Border color
              hasError
                ? "border-[rgb(var(--color-danger))] focus:border-[rgb(var(--color-danger))]"
                : isEdited
                  ? "border-[rgb(var(--color-warning))] focus:border-[rgb(var(--color-warning))] focus:ring-[rgb(var(--color-warning))]/20"
                  : "border-[rgb(var(--bd-default))] focus:border-[rgb(var(--color-primary))]",
              className
            )}
            ref={ref}
            suppressHydrationWarning={label ? true : false}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            min={type === 'number' ? 0 : undefined}
            {...props}
          />

          {RightIcon && (
            <div
              className={cn(
                "absolute right-3 top-1/2 transform -translate-y-1/2",
                onRightIconClick && !props.disabled && "cursor-pointer",
                props.disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={props.disabled ? undefined : onRightIconClick}
            >
              <RightIcon className="h-4 w-4 text-[rgb(var(--fg-muted))]" />
            </div>
          )}
        </div>

        {error && typeof error === 'string' && (
          <p className="mt-1 text-sm text-[rgb(var(--color-danger))]">
            {error}
          </p>
        )}

        {helper && !error && (
          <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">
            {helper}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }