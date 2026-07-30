// ── Badge component — single source of truth for all status colors ──────────
// IMPORTANT: Always import statusBadge from HERE (components/ui/Badge), not from lib/styles.ts.
// lib/styles.ts has a legacy version that returns className strings — do NOT use in new code.

type BadgeVariant = "green" | "red" | "yellow" | "blue" | "purple" | "gray" | "orange" | "teal";

const VARIANT_CLS: Record<BadgeVariant, string> = {
  green:  "bg-green-100 text-green-700",
  red:    "bg-red-100 text-red-700",
  yellow: "bg-yellow-100 text-yellow-700",
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  gray:   "bg-gray-100 text-gray-600",
  orange: "bg-orange-100 text-orange-700",
  teal:   "bg-teal-100 text-teal-700",
};

export function Badge({ label, variant = "gray" }: { label: string; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${VARIANT_CLS[variant]}`}>
      {label}
    </span>
  );
}

// Maps status strings (case-insensitive) → colored <Badge>.
// Covers all statuses used across Gravure ERP modules.
// Usage: {statusBadge(row.Status)}
const STATUS_MAP: Record<string, BadgeVariant> = {
  // Generic
  active:        "green",
  inactive:      "red",
  draft:         "gray",
  pending:       "yellow",
  cancelled:     "red",
  rejected:      "red",
  closed:        "gray",

  // Approval / procurement
  submitted:     "blue",
  approved:      "green",
  "po created":  "blue",
  proceed:       "blue",
  ordered:       "purple",
  completed:     "green",
  issued:        "green",
  verified:      "teal",
  sent:          "blue",

  // Production
  "in progress": "yellow",
  running:       "green",
  idle:          "gray",
  maintenance:   "yellow",
  "on hold":     "orange",
  "in transit":  "blue",
  delivered:     "green",
  dispatched:    "teal",

  // Order / job status
  open:          "gray",
  confirmed:     "blue",
  estimated:     "blue",
  converted:     "green",
  ready:         "purple",
  "in production": "yellow",

  // Other
  a:             "blue",
  b:             "purple",
  c:             "orange",
  partial:       "yellow",
  received:      "green",
  hold:          "orange",
};

export function statusBadge(status: string) {
  const variant = STATUS_MAP[status?.toLowerCase?.() ?? ""] ?? "gray";
  return <Badge label={status} variant={variant} />;
}
