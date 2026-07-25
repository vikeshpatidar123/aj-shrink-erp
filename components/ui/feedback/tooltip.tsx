"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

// Default tooltip - Glass style for simple text
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 5, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-lg bg-[rgb(var(--bg-surface)/0.8)] backdrop-blur-md text-[rgb(var(--fg-default))] text-xs px-3 py-1.5 border border-[rgb(var(--bd-default)/0.2)] shadow-xl animate-in fade-in-0 slide-in-from-bottom-1 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Detailed tooltip - Elevated surface with header + stacked action lines
interface TooltipDetailedProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
  title?: string
  actions?: Array<{ label: string; shortcut?: string }>
}

const TooltipDetailed = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipDetailedProps
>(({ className, title = "Actions", actions = [], sideOffset = 5, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-lg bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] text-left p-0 border border-[rgb(var(--bd-default))] shadow-lg animate-in fade-in-0 duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className
      )}
      {...props}
    >
      {title && (
        <div className="px-2.5 py-1 bg-[rgb(var(--bg-subtle))] border-b border-[rgb(var(--bd-default))]">
          <span className="text-[11px] font-semibold text-[rgb(var(--fg-default))]">{title}</span>
        </div>
      )}
      {actions.length > 0 ? (
        <div className="px-2.5 py-1.5 space-y-0.5">
          {actions.map((action, i) => (
            <p key={i} className="text-[11px] text-[rgb(var(--fg-muted))]">{action.label}</p>
          ))}
        </div>
      ) : (
        children && <div className="px-2.5 py-1.5">{children}</div>
      )}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
TooltipDetailed.displayName = "TooltipDetailed"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipDetailed, TooltipProvider }
