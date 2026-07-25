import { Loader2 } from "lucide-react";

type Variant =
  | "primary" | "secondary" | "danger" | "ghost" | "success"
  | "action-create" | "action-save" | "action-edit" | "action-delete"
  | "action-print" | "action-download" | "action-send" | "action-refresh"
  | "action-cancel" | "action-secondary" | "action-apply" | "action-back"
  | "action-info";

type Size = "xs" | "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary:           "erp-btn-primary text-white",
  secondary:         "bg-white text-gray-700 hover:bg-gray-100 border-gray-300 shadow-sm",
  danger:            "bg-[rgba(239,68,68,0.09)] text-[#b91c1c] hover:bg-[rgba(239,68,68,0.16)] border-[rgba(239,68,68,0.22)] shadow-sm",
  ghost:             "bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800 border-transparent",
  success:           "bg-[rgba(34,197,94,0.09)] text-[#15803d] hover:bg-[rgba(34,197,94,0.16)] border-[rgba(34,197,94,0.22)] shadow-sm",
  "action-create":   "indas-btn-create",
  "action-save":     "indas-btn-save",
  "action-edit":     "indas-btn-edit",
  "action-delete":   "indas-btn-delete",
  "action-print":    "indas-btn-print",
  "action-download": "indas-btn-download",
  "action-send":     "indas-btn-info",
  "action-refresh":  "indas-btn-secondary",
  "action-cancel":   "indas-btn-secondary",
  "action-secondary":"indas-btn-secondary",
  "action-apply":    "indas-btn-save",
  "action-back":     "indas-btn-secondary",
  "action-info":     "indas-btn-info",
};

const sizeStyles: Record<Size, string> = {
  xs: "px-2 py-1 text-[11px]",
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  pill?: boolean;
}

export default function Button({
  variant = "primary", size = "md", loading, icon, children,
  className = "", disabled, pill = false, ...rest
}: ButtonProps) {
  const isAction = variant?.startsWith("action-");
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center gap-1.5 transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        ${pill ? "font-semibold active:scale-95" : "font-medium"}
        ${isAction ? "" : `${pill ? "rounded-full" : "rounded-md"} border`}
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
