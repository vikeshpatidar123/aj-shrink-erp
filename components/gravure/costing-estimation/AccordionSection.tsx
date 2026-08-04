"use client";
/**
 * AccordionSection — controlled collapsible card used to group a costing
 * estimation form section (Materials, Processes, Cylinder, Colors, etc).
 *
 * Dumb/controlled: the parent owns `isOpen` (which section is currently
 * expanded) and passes `onToggle` to flip it. Built on Radix Collapsible
 * (`components/ui/display/collapsible.tsx`) with a framer-motion height/opacity
 * transition for the content.
 */
import { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/display/collapsible";

export interface AccordionSectionProps {
  title: string;
  icon?: ReactNode;
  amountLabel?: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Hint only — this component does not self-manage open state. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function AccordionSection({
  title, icon, amountLabel, isOpen, onToggle, children,
}: AccordionSectionProps) {
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={onToggle}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors
            ${isOpen ? "bg-[rgb(var(--color-primary-subtle))]" : "hover:bg-gray-50"}`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="flex-shrink-0 text-[rgb(var(--color-primary))]">{icon}</span>
            )}
            <span className="text-sm font-semibold text-[rgb(var(--color-primary))] truncate">
              {title}
            </span>
          </span>

          <span className="flex items-center gap-3 flex-shrink-0">
            {amountLabel && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[rgb(var(--color-primary))] text-white">
                {amountLabel}
              </span>
            )}
            <ChevronDown
              size={16}
              className={`text-[rgb(var(--color-primary))] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      </CollapsibleTrigger>

      <AnimatePresence initial={false}>
        {isOpen && (
          <CollapsibleContent forceMount asChild>
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div className="p-5 sm:p-6 border-t border-gray-100">
                {children}
              </div>
            </motion.div>
          </CollapsibleContent>
        )}
      </AnimatePresence>
    </Collapsible>
  );
}
