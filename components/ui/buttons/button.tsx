'use client'
import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon, CheckCircle, XCircle, Minus, Plus } from "lucide-react"

const STORAGE_KEY = 'fab-btn-pos'

function DraggableFAB({ onClick, disabled, tooltip, children }: {
  onClick?: React.MouseEventHandler
  disabled?: boolean
  tooltip?: string
  children: React.ReactNode
}) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)
  const dragging = React.useRef(false)
  const hasMoved = React.useRef(false)
  const startPointer = React.useRef({ x: 0, y: 0 })
  const startPos = React.useRef({ x: 0, y: 0 })
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) { setPos(JSON.parse(saved)); return }
    } catch {}
    setPos({ x: window.innerWidth - 72, y: window.innerHeight - 120 })
  }, [])

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    hasMoved.current = false
    startPointer.current = { x: e.clientX, y: e.clientY }
    const rect = ref.current!.getBoundingClientRect()
    startPos.current = { x: rect.left, y: rect.top }
    ref.current!.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - startPointer.current.x
    const dy = e.clientY - startPointer.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasMoved.current = true
    const newPos = {
      x: clamp(startPos.current.x + dx, 0, window.innerWidth - 56),
      y: clamp(startPos.current.y + dy, 0, window.innerHeight - 56),
    }
    setPos(newPos)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    if (pos) localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
    if (!hasMoved.current) onClick?.(e as any)
    e.preventDefault()
  }

  if (!pos) return null

  return (
    <button
      ref={ref}
      disabled={disabled}
      style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
      className={cn(
        "fixed z-50 lg:hidden",
        "h-14 w-14 rounded-xl shadow-lg rotate-45",
        "bg-[rgb(var(--color-primary))]/50 hover:bg-[rgb(var(--color-primary))]/65",
        "border-2 border-[rgb(var(--color-primary))]/60 hover:border-[rgb(var(--color-primary))]/75",
        "transition-colors duration-200 flex items-center justify-center",
        "disabled:opacity-50 disabled:cursor-not-allowed",
      )}
      title={tooltip}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
    </button>
  )
}

// Helper to check if value is a valid React element (already rendered JSX)
const isReactElement = (value: any): value is React.ReactElement => {
  return React.isValidElement(value)
}

// Helper to check if value is a React component (function or forwardRef)
const isReactComponent = (value: any): boolean => {
  return typeof value === 'function' || (value && typeof value === 'object' && '$$typeof' in value)
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'destructive' | 'footer-primary' | 'footer-secondary' |
            'action-create' | 'action-save' | 'action-save-as' | 'action-edit' | 'action-delete' | 'action-print' |
            'action-send' | 'action-mail' | 'action-download' | 'action-refresh' | 'action-cancel' | 'action-secondary' | 'action-apply' | 'action-back'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'footer'
  loading?: boolean
  icon?: LucideIcon | React.ReactNode
  iconPosition?: 'left' | 'right'
  /** When true, renders as circular icon-only button (36px × 36px) */
  iconOnly?: boolean
  /** Tooltip text for icon-only buttons */
  tooltip?: string
  /** When true, renders as inline button on desktop + floating action button on mobile (bottom-right, above bottom nav) */
  fab?: boolean
}

const buttonVariants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover focus-ring active:opacity-90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover focus-ring active:opacity-90",
  tertiary: "bg-tertiary text-tertiary-foreground hover:bg-tertiary-hover focus-ring active:opacity-90",
  outline: "border border-bd-default bg-bg-surface text-fg-default hover:bg-bg-hover focus-ring active:bg-bg-hover",
  ghost: "text-fg-default hover:bg-bg-hover focus-ring active:bg-bg-hover",
  destructive: "bg-error text-fg-inverse hover:bg-error-hover focus-ring-error active:opacity-90",
  // Footer-specific variants with inline primary color styles
  'footer-primary': "border-primary transition-opacity duration-200 hover:opacity-90 disabled:opacity-50",
  'footer-secondary': "transition-opacity duration-200 hover:opacity-80 disabled:opacity-50",
  // Action button variants with CSS variable colors (dark mode compatible)
  'action-create': "bg-[rgb(var(--color-primary))]/10 hover:bg-[rgb(var(--color-primary))]/20 text-[rgb(var(--color-primary))] border border-[rgb(var(--color-primary))]/20",
  'action-save': "bg-[rgb(var(--color-success))]/10 hover:bg-[rgb(var(--color-success))]/20 text-[rgb(var(--color-success))] border border-[rgb(var(--color-success))]/20",
  'action-save-as': "bg-[rgb(var(--color-sky))]/10 hover:bg-[rgb(var(--color-sky))]/20 text-[rgb(var(--color-sky))] border border-[rgb(var(--color-sky))]/20",
  'action-edit': "bg-[rgb(var(--color-warning))]/10 hover:bg-[rgb(var(--color-warning))]/20 text-[rgb(var(--color-warning))] border border-[rgb(var(--color-warning))]/20",
  'action-delete': "bg-[rgb(var(--color-error))]/10 hover:bg-[rgb(var(--color-error))]/20 text-[rgb(var(--color-error))] border border-[rgb(var(--color-error))]/20",
  'action-print': "bg-[rgb(var(--color-purple))]/10 hover:bg-[rgb(var(--color-purple))]/20 text-[rgb(var(--color-purple))] border border-[rgb(var(--color-purple))]/20",
  'action-send': "bg-[rgb(var(--color-info))]/10 hover:bg-[rgb(var(--color-info))]/20 text-[rgb(var(--color-info))] border border-[rgb(var(--color-info))]/20",
  'action-mail': "bg-[rgb(var(--color-error))]/10 hover:bg-[rgb(var(--color-error))]/20 text-[rgb(var(--color-error))] border border-[rgb(var(--color-error))]/20",
  'action-download': "bg-[rgb(var(--color-success))]/10 hover:bg-[rgb(var(--color-success))]/20 text-[rgb(var(--color-success))] border border-[rgb(var(--color-success))]/20",
  'action-refresh': "bg-[rgb(var(--color-neutral))]/10 hover:bg-[rgb(var(--color-neutral))]/20 text-[rgb(var(--color-neutral))] border border-[rgb(var(--color-neutral))]/20",
  'action-cancel': "bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] border border-[rgb(var(--bd-default))]",
  'action-secondary': "bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--fg-default))] border border-[rgb(var(--bd-default))]",
  'action-apply': "bg-[rgb(var(--color-teal))]/10 hover:bg-[rgb(var(--color-teal))]/20 text-[rgb(var(--color-teal))] border border-[rgb(var(--color-teal))]/20",
  'action-back': "bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] border border-[rgb(var(--bd-default))]"
}

const buttonSizes = {
  xs: "h-6 px-2 py-1 text-xs font-medium", // Extra small - for card headers, compact UI
  sm: "h-8 px-3 text-sm font-medium",
  md: "h-10 px-4 text-sm font-medium",
  lg: "h-12 px-6 text-base font-medium",
  footer: "px-3 py-1.5 text-xs font-medium", // Compact footer size
  action: "h-8 px-2 sm:px-3 text-[11px] sm:text-xs font-medium" // Action button size — compact on mobile
}

const iconOnlySizes = {
  xs: "w-6 h-6 text-sm",
  sm: "w-8 h-8 text-base",
  md: "w-9 h-9 text-lg",
  lg: "w-10 h-10 text-xl",
  footer: "w-8 h-8 text-base",
  action: "w-9 h-9 text-lg"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon: Icon,
    iconPosition = 'left',
    iconOnly = false,
    tooltip,
    fab = false,
    children,
    disabled,
    style,
    ...props
  }, ref) => {
    const isDisabled = disabled || loading

    // Check if it's an action button variant
    const isActionButton = variant?.startsWith('action-')

    // Automatically use 'action' size for action button variants
    const buttonSize = isActionButton && size === 'md' ? 'action' : size

    // Auto-assign icons for specific action variants if no icon provided
    let resolvedIcon = Icon
    if (!Icon) {
      if (variant === 'action-apply') resolvedIcon = CheckCircle
      if (variant === 'action-cancel') resolvedIcon = XCircle
    }

    // FAB mode: inline button on desktop + floating circular button on mobile
    if (fab && resolvedIcon) {
      // Parkbuddy style: icon is h-8 w-8 stroke-[3] with primary color text
      const fabIcon = isReactElement(resolvedIcon)
        ? resolvedIcon
        : isReactComponent(resolvedIcon)
        ? React.createElement(resolvedIcon as any, { className: 'h-8 w-8 -rotate-45 text-[rgb(var(--color-primary))] stroke-[1.5]' })
        : null

      return (
        <>
          {/* Desktop: normal inline button */}
          <button
            className={cn(
              "inline-flex items-center justify-center gap-2 transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
              isActionButton ? "rounded-lg" : "rounded-md",
              buttonVariants[variant],
              buttonSizes[buttonSize],
              "hidden lg:inline-flex",
              className
            )}
            ref={ref}
            disabled={isDisabled}
            style={style}
            title={tooltip}
            {...props}
          >
            {resolvedIcon && iconPosition === 'left' && !loading && (
              isReactElement(resolvedIcon) ? resolvedIcon
              : isReactComponent(resolvedIcon) ? React.createElement(resolvedIcon as any, { className: isActionButton ? 'h-4 w-4' : 'h-4 w-4' })
              : null
            )}
            {children}
          </button>

          {/* Mobile: draggable floating action button */}
          <DraggableFAB onClick={props.onClick} disabled={isDisabled} tooltip={tooltip}>
            {fabIcon}
          </DraggableFAB>
        </>
      )
    }

    // Icon-only mode: circular button with just icon
    if (iconOnly) {
      // For icon-only buttons, use ghost variant by default if not specified
      const iconOnlyVariant = variant === 'primary' ? 'ghost' : variant

      return (
        <button
          ref={ref}
          type="button"
          title={tooltip}
          disabled={isDisabled}
          className={cn(
            'inline-flex items-center justify-center',
            'rounded-full border-0',
            'transition-colors duration-150 ease-in-out',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-primary))] focus-visible:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
            iconOnlyVariant === 'ghost' && [
              'text-[rgb(var(--fg-muted))]',
              'hover:bg-[rgb(var(--bg-hover))]',
              'active:bg-[rgb(var(--bg-subtle))]'
            ],
            iconOnlyVariant !== 'ghost' && buttonVariants[iconOnlyVariant],
            iconOnlySizes[buttonSize],
            className
          )}
          style={style}
          {...props}
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          ) : Icon && isReactElement(Icon) ? (
            Icon
          ) : Icon && isReactComponent(Icon) ? (
            React.createElement(Icon as any, { className: buttonSize === 'footer' ? 'h-3.5 w-3.5' : 'h-5 w-5' })
          ) : null}
        </button>
      )
    }

    // Apply inline styles for footer variants (uses CSS variables)
    const footerStyles = variant === 'footer-primary'
      ? { backgroundColor: 'rgb(var(--color-primary))', color: 'rgb(var(--color-primary-foreground))', ...style }
      : variant === 'footer-secondary'
      ? { borderColor: 'rgb(var(--color-primary))', color: 'rgb(var(--color-primary))', ...style }
      : style

    // Action buttons: icon-only on mobile — ONLY when children is simple text
    // Buttons with complex children (badges, chevrons, JSX) keep their full layout
    const actionIconOnly = isActionButton && resolvedIcon && typeof children === 'string'

    return (
      <button
        className={cn(
          // Base styles
          "inline-flex items-center justify-center transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          // Gap — tighter on mobile for action buttons
          isActionButton ? "gap-1 sm:gap-1.5" : "gap-2",
          // Border radius - action buttons use rounded-lg, others use rounded-md
          isActionButton ? "rounded-lg" : "rounded-md",
          // Variant styles
          buttonVariants[variant],
          // Size styles
          buttonSizes[buttonSize],
          // Action buttons: square icon-only on mobile (< sm), icon + text on sm+
          actionIconOnly && "max-sm:px-0 max-sm:w-8 max-sm:h-8",
          className
        )}
        ref={ref}
        disabled={isDisabled}
        style={footerStyles}
        title={tooltip || (actionIconOnly && typeof children === 'string' ? children : undefined)}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        )}

        {resolvedIcon && iconPosition === 'left' && !loading && (
          isReactElement(resolvedIcon) ? (
            resolvedIcon
          ) : isReactComponent(resolvedIcon) ? (
            React.createElement(resolvedIcon as any, { className: size === 'xs' ? 'h-3 w-3' : size === 'footer' ? 'h-3.5 w-3.5' : isActionButton ? 'h-3.5 w-3.5 sm:h-4 sm:w-4' : 'h-4 w-4' })
          ) : null
        )}

        {/* Action buttons: hide text on very small screens when icon is present */}
        {actionIconOnly ? (
          <span className="hidden sm:inline">{children}</span>
        ) : (
          children
        )}

        {resolvedIcon && iconPosition === 'right' && !loading && (
          isReactElement(resolvedIcon) ? (
            resolvedIcon
          ) : isReactComponent(resolvedIcon) ? (
            React.createElement(resolvedIcon as any, { className: size === 'xs' ? 'h-3 w-3' : size === 'footer' ? 'h-3.5 w-3.5' : isActionButton ? 'h-3.5 w-3.5 sm:h-4 sm:w-4' : 'h-4 w-4' })
          ) : null
        )}
      </button>
    )
  }
)
Button.displayName = "Button"

/**
 * CheckboxButton - Toggle button with checkbox-style UI
 * Styled like "Set First Plan as Master"
 */
export interface CheckboxButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean
  onChange?: (checked: boolean) => void
  label: string
  size?: 'xs' | 'sm' | 'md'
}

export const CheckboxButton = React.forwardRef<HTMLButtonElement, CheckboxButtonProps>(
  ({ checked = false, onChange, label, size = 'md', className, ...props }, ref) => {
    const { Check } = require('lucide-react')

    const sizeClasses = {
      xs: 'h-6 px-2 text-[10px] gap-1.5',
      sm: 'h-8 px-2.5 text-xs gap-2',
      md: 'h-10 px-2.5 text-xs gap-2'
    }

    const checkboxSizeClasses = {
      xs: 'w-3 h-3',
      sm: 'w-4 h-4',
      md: 'w-4 h-4'
    }

    const checkIconClasses = {
      xs: 'h-2 w-2',
      sm: 'h-3 w-3',
      md: 'h-3 w-3'
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onChange?.(!checked)}
        className={cn(
          'inline-flex items-center rounded-full border font-medium transition-all duration-200',
          sizeClasses[size],
          checked
            ? 'bg-[rgb(var(--color-primary))]/10 hover:bg-[rgb(var(--color-primary))]/20 text-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]/20'
            : 'bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] border-[rgb(var(--bd-default))]',
          className
        )}
        {...props}
      >
        <div className={cn(
          'rounded flex items-center justify-center transition-all duration-200 flex-shrink-0',
          checkboxSizeClasses[size],
          checked
            ? 'bg-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]'
            : 'bg-transparent border border-[rgb(var(--bd-default))]'
        )}>
          {checked && (
            <Check className={cn(checkIconClasses[size], 'text-white')} strokeWidth={3} />
          )}
        </div>
        <span className="whitespace-nowrap">{label}</span>
      </button>
    )
  }
)
CheckboxButton.displayName = "CheckboxButton"

/**
 * InputButton - Inline input with label in bordered container
 * Styled like "Show Wastage upto: 30%"
 */
export interface InputButtonProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  size?: 'sm' | 'md'
  inputClassName?: string
  suffix?: string
  /** Show inline minus/plus stepper buttons around the input. */
  stepper?: boolean
  /** Called when stepper buttons are clicked. Receives 'inc' or 'dec'.
   *  Use this to advance to the next valid value (e.g. skip 4 → 5). */
  onStep?: (direction: 'inc' | 'dec') => void
  /** Optional gate for disabling the stepper buttons (e.g. at min/max). */
  canStep?: (direction: 'inc' | 'dec') => boolean
}

export const InputButton = React.forwardRef<HTMLInputElement, InputButtonProps>(
  ({ label, size = 'md', className, inputClassName, suffix, stepper, onStep, canStep, disabled, ...props }, ref) => {
    const decDisabled = !!disabled || (canStep ? !canStep('dec') : false)
    const incDisabled = !!disabled || (canStep ? !canStep('inc') : false)
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 px-2.5 rounded-lg border transition-all duration-200',
          'bg-[rgb(var(--bg-subtle))] hover:bg-[rgb(var(--bg-hover))] border-[rgb(var(--bd-default))]',
          'h-8',
          className
        )}
      >
        <span className={cn(
          'font-medium whitespace-nowrap text-[rgb(var(--fg-default))]',
          'text-xs'
        )}>
          {label}:
        </span>
        {stepper && (
          <button
            type="button"
            onClick={() => onStep?.('dec')}
            disabled={decDisabled}
            aria-label="Decrease"
            className="h-5 w-5 inline-flex items-center justify-center rounded-md border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-muted))] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Minus className="h-3 w-3" />
          </button>
        )}
        <input
          ref={ref}
          type="number"
          disabled={disabled}
          className={cn(
            'w-12 text-xs font-bold rounded-md px-1.5 text-center',
            'border-0 focus:outline-none focus:ring-0',
            'bg-[rgb(var(--bg-surface))]',
            'text-[rgb(var(--fg-default))]',
            'placeholder:text-[rgb(var(--fg-muted))]',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            'h-5',
            inputClassName
          )}
          {...props}
        />
        {stepper && (
          <button
            type="button"
            onClick={() => onStep?.('inc')}
            disabled={incDisabled}
            aria-label="Increase"
            className="h-5 w-5 inline-flex items-center justify-center rounded-md border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-muted))] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
        {suffix && (
          <span className="text-xs font-medium text-[rgb(var(--fg-default))]">
            {suffix}
          </span>
        )}
      </div>
    )
  }
)
InputButton.displayName = "InputButton"

/**
 * FilterPillButton - Status filter pill button with count
 * Used for filtering data by status (All, Pending, Approved, etc.)
 */
export type FilterPillVariant = 'primary' | 'warning' | 'success' | 'orange' | 'error'

export interface FilterPillButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  shortLabel?: string
  count: number
  variant: FilterPillVariant
  isSelected: boolean
}

const filterPillVariants: Record<FilterPillVariant, { selected: string; unselected: string }> = {
  primary: {
    selected: 'bg-[rgb(var(--color-primary))] text-white shadow-md',
    unselected: 'bg-[rgb(var(--color-primary-subtle))] text-[rgb(var(--color-primary))] hover:opacity-80'
  },
  warning: {
    selected: 'bg-[rgb(var(--color-warning))] text-white shadow-md',
    unselected: 'bg-[rgb(var(--color-warning-subtle))] text-[rgb(var(--color-warning))] hover:opacity-80'
  },
  success: {
    selected: 'bg-[rgb(var(--color-success))] text-white shadow-md',
    unselected: 'bg-[rgb(var(--color-success-subtle))] text-[rgb(var(--color-success))] hover:opacity-80'
  },
  orange: {
    selected: 'bg-[rgb(var(--color-orange))] text-white shadow-md',
    unselected: 'bg-[rgb(var(--color-orange-subtle))] text-[rgb(var(--color-orange))] hover:opacity-80'
  },
  error: {
    selected: 'bg-[rgb(var(--color-error))] text-white shadow-md',
    unselected: 'bg-[rgb(var(--color-error-subtle))] text-[rgb(var(--color-error))] hover:opacity-80'
  }
}

export const FilterPillButton = React.forwardRef<HTMLButtonElement, FilterPillButtonProps>(
  ({ label, shortLabel, count, variant, isSelected, className, ...props }, ref) => {
    const styles = filterPillVariants[variant]

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold transition-all',
          'hover:scale-105 cursor-pointer',
          isSelected ? styles.selected : styles.unselected,
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
)
FilterPillButton.displayName = "FilterPillButton"

export { Button }