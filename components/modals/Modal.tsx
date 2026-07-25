'use client'

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X, ChevronLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

// =============================================================================
// SIZE PRESETS
// On mobile (<md): sm/md/lg/xl go full-screen for better usability
// =============================================================================
const modalSizes = {
  sm: 'max-w-md w-full mx-4 h-auto max-md:max-w-full max-md:h-full max-md:mx-0 max-md:rounded-none',
  md: 'max-w-lg w-full mx-4 h-auto max-md:max-w-full max-md:h-full max-md:mx-0 max-md:rounded-none',
  lg: 'max-w-2xl w-full mx-4 h-auto max-md:max-w-full max-md:h-full max-md:mx-0 max-md:rounded-none',
  xl: 'max-w-4xl w-full mx-4 h-auto max-md:max-w-full max-md:h-full max-md:mx-0 max-md:rounded-none',
  master: 'w-[90vw] h-[90vh] max-w-none max-md:w-full max-md:h-full max-md:rounded-none',
  fullscreen: 'w-[98vw] h-[98vh] max-w-none'
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * SSR-safe mobile detection hook
 * @param breakpoint - Pixel width threshold (default 768)
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])

  return isMobile
}

/**
 * Stable ref wrapper — prevents React 19 infinite update loop caused by
 * @radix-ui/react-presence creating a new callback ref every render.
 */
function useStableRef<T>(forwardedRef: React.ForwardedRef<T>) {
  const forwardedRefRef = React.useRef(forwardedRef)
  React.useEffect(() => { forwardedRefRef.current = forwardedRef })
  const stableCallback = React.useCallback((node: T | null) => {
    const ref = forwardedRefRef.current
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }, [])
  return stableCallback
}

// =============================================================================
// MODAL CONTEXT — lets ModalTitle register its text for the mobile page header
// =============================================================================
const ModalMobileContext = React.createContext<{
  isMobilePage: boolean
  onClose?: () => void
}>({ isMobilePage: false })

// =============================================================================
// CORE COMPONENTS
// =============================================================================

/**
 * Modal wrapper — intercepts the device back button in standalone PWA mode.
 * When a modal opens, a history entry is pushed. Pressing the device back
 * button fires `popstate` which closes the modal instead of navigating away.
 */
function Modal({ open, onOpenChange, ...props }: DialogPrimitive.DialogProps) {
  const openRef = React.useRef(open)
  const onOpenChangeRef = React.useRef(onOpenChange)
  openRef.current = open
  onOpenChangeRef.current = onOpenChange

  React.useEffect(() => {
    if (!open) return

    // Only manage history on mobile — desktop doesn't need back-button interception
    const isMobileDevice = window.matchMedia('(max-width: 768px)').matches
    if (!isMobileDevice) return

    // Push a sentinel state so the device back button triggers popstate
    const sentinel = { __modal: true, ts: Date.now() }
    window.history.pushState(sentinel, '')

    const onPopState = () => {
      // Back button pressed while modal is open — close the modal
      if (openRef.current) {
        onOpenChangeRef.current?.(false)
      }
    }

    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      // If modal is closing normally (not via back button), remove the sentinel entry
      const state = window.history.state
      if (state && state.__modal) {
        window.history.back()
      }
    }
  }, [open])

  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props} />
}

/**
 * ADAPTIVE TRIGGER
 *
 * On desktop: opens the modal dialog as normal.
 * On mobile + mobilePageUrl: navigates to a dedicated page instead,
 * so users get native back-button support and full-screen real estate.
 */
const ModalTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger> & {
    mobilePageUrl?: string
    onMobileNavigate?: (url: string) => void
    mobileBreakpoint?: number
  }
>(({ className, mobilePageUrl, onMobileNavigate, mobileBreakpoint = 768, onClick, ...props }, ref) => {
  const router = useRouter()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (mobilePageUrl && typeof window !== 'undefined') {
      const isMobile = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches
      if (isMobile) {
        e.preventDefault()
        e.stopPropagation()
        onMobileNavigate?.(mobilePageUrl)
        router.push(mobilePageUrl)
        return
      }
    }
    onClick?.(e)
  }

  return (
    <DialogPrimitive.Trigger
      ref={ref}
      className={className}
      onClick={handleClick}
      {...props}
    />
  )
})
ModalTrigger.displayName = "ModalTrigger"

const ModalPortal = DialogPrimitive.Portal
const ModalClose = DialogPrimitive.Close

// Overlay with backdrop blur
const ModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px]",
      className
    )}
    {...props}
  />
))
ModalOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * ADAPTIVE MODAL CONTENT
 *
 * Desktop: standard Radix dialog overlay (unchanged)
 * Mobile: renders as a full-screen page with a back-arrow header.
 *         No Radix overlay/portal — just a fixed div on top of everything.
 *         ModalHeader/ModalTitle inside become the page header automatically.
 */
const ModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideCloseButton?: boolean
    disableOutsideClick?: boolean
    size?: keyof typeof modalSizes
  }
>(({ className, children, hideCloseButton, disableOutsideClick, size, ...props }, ref) => {
  const stableRef = useStableRef(ref)
  const isMobile = useIsMobile()

  // On mobile: render as a full-screen page
  if (isMobile) {
    return (
      <DialogPrimitive.Portal>
        {/* No overlay on mobile — the page IS the modal */}
        <DialogPrimitive.Content
          ref={stableRef}
          aria-describedby={undefined}
          className={cn(
            "fixed inset-0 z-[100] flex flex-col",
            "bg-[rgb(var(--bg-surface))]",
            className
          )}
          // Always block outside click on mobile — there's nothing "outside"
          onInteractOutside={(e) => e.preventDefault()}
          {...props}
        >
          <ModalMobileContext.Provider value={{ isMobilePage: true, onClose: undefined }}>
            {children}
          </ModalMobileContext.Provider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    )
  }

  // Desktop: unchanged Radix dialog
  return (
    <ModalPortal>
      <ModalOverlay />
      <DialogPrimitive.Content
        ref={stableRef}
        aria-describedby={undefined}
        className={cn(
          "fixed left-[50%] top-[50%] z-[100] grid translate-x-[-50%] translate-y-[-50%]",
          "gap-3 sm:gap-4",
          "border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] shadow-lg",
          "rounded-lg sm:rounded-lg",
          size ? modalSizes[size] : "max-w-lg w-full mx-4 h-auto max-h-[85vh]",
          size !== 'master' && size !== 'fullscreen' && !className?.includes('p-0') && "p-4 sm:p-6",
          className
        )}
        onInteractOutside={(e) => {
          if (disableOutsideClick) {
            e.preventDefault()
          }
        }}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close className="absolute right-2 top-2 sm:right-4 sm:top-4 rounded-sm opacity-70 ring-offset-[rgb(var(--bg-surface))] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-[rgb(var(--bg-hover))] data-[state=open]:text-[rgb(var(--fg-muted))]">
            <X className="h-4 w-4 sm:h-5 sm:w-5 text-[rgb(var(--color-icon))]" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </ModalPortal>
  )
})
ModalContent.displayName = DialogPrimitive.Content.displayName

/**
 * ADAPTIVE HEADER
 *
 * Desktop: renders as normal header div
 * Mobile page mode: renders as a sticky top bar with a back arrow (ChevronLeft)
 *                   that closes the modal, plus the title inline
 */
const ModalHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const { isMobilePage } = React.useContext(ModalMobileContext)

  if (isMobilePage) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-3 border-b border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] shrink-0",
          className
        )}
        {...props}
      >
        <DialogPrimitive.Close className="p-1.5 -ml-1 rounded-lg text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))] transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </DialogPrimitive.Close>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props}>
      {children}
    </div>
  )
}
ModalHeader.displayName = "ModalHeader"

const ModalFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
ModalFooter.displayName = "ModalFooter"

const ModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight text-[rgb(var(--fg-default))]", className)}
    {...props}
  />
))
ModalTitle.displayName = DialogPrimitive.Title.displayName

const ModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-[rgb(var(--fg-muted))]", className)}
    {...props}
  />
))
ModalDescription.displayName = DialogPrimitive.Description.displayName

// Backwards compatibility aliases
export const Dialog = Modal
export const DialogTrigger = ModalTrigger
export const DialogPortal = ModalPortal
export const DialogClose = ModalClose
export const DialogOverlay = ModalOverlay
export const DialogContent = ModalContent
export const DialogHeader = ModalHeader
export const DialogFooter = ModalFooter
export const DialogTitle = ModalTitle
export const DialogDescription = ModalDescription

export {
  Modal,
  ModalPortal,
  ModalOverlay,
  ModalClose,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
}
