/**
 * AJ Shrink ERP — Global Shared Style Constants
 *
 * Import these in every page instead of defining local style strings.
 * All focus/color effects come from globals.css via CSS variables.
 * No hardcoded blue — theme is controlled by --erp-primary in :root.
 */

// ── Form inputs & selects ───────────────────────────────────────────────────
export const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 bg-white outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

// Wider padding variant (for modals / detail forms)
export const inputLgCls =
  "w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm text-gray-800 bg-white outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

// Compact inline input
export const inputSmCls =
  "w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm text-gray-800 bg-white outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

// ── Labels ──────────────────────────────────────────────────────────────────
export const labelCls =
  "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

// ── Section titles inside panels / modals ──────────────────────────────────
// Uses .erp-section-title CSS class (color = var(--erp-primary))
export const sectionTitleCls = "erp-section-title";

// ── Cards & panels ─────────────────────────────────────────────────────────
export const cardCls =
  "bg-white rounded-lg border border-gray-200 shadow-sm p-5";

export const panelHeaderCls =
  "flex items-center justify-between mb-5 pb-3 border-b border-gray-100";

// ── Status badge helpers (LEGACY — DO NOT USE IN NEW CODE) ─────────────────
// Use statusBadge() from components/ui/Badge.tsx instead.
// This version returns a CSS class string; the canonical version returns JSX.
// Kept for backward-compat with pages that have not yet been migrated.
// Usage: <span className={statusBadge("Active")}>{status}</span>
const STATUS_MAP: Record<string, string> = {
  // Generic
  active:    "erp-badge erp-badge-success",
  inactive:  "erp-badge erp-badge-neutral",
  draft:     "erp-badge erp-badge-neutral",
  pending:   "erp-badge erp-badge-warning",
  cancelled: "erp-badge erp-badge-danger",
  rejected:  "erp-badge erp-badge-danger",

  // Inventory / procurement
  submitted: "erp-badge erp-badge-primary",
  approved:  "erp-badge erp-badge-success",
  ordered:   "erp-badge erp-badge-purple",
  completed: "erp-badge erp-badge-success",
  issued:    "erp-badge erp-badge-success",
  verified:  "erp-badge erp-badge-teal",
  sent:      "erp-badge erp-badge-primary",
  closed:    "erp-badge erp-badge-neutral",

  // Production
  "in progress": "erp-badge erp-badge-primary",
  dispatched:    "erp-badge erp-badge-teal",
};

export const statusBadge = (status: string): string =>
  STATUS_MAP[status.toLowerCase()] ?? "erp-badge erp-badge-neutral";
