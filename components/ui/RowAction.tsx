"use client";
import {
  Eye, Pencil, Trash2, Printer, Download, Plus, Copy, Check, X,
  FileText, RefreshCw, Send, Search, ArrowRight, ExternalLink,
} from "lucide-react";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { tooltip?: string };

const base =
  "p-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0";

function Btn({ className = "", tooltip, children, type = "button", ...props }: BtnProps) {
  return (
    <button type={type as "button"} {...props} className={`${base} ${className}`} title={tooltip}>
      {children}
    </button>
  );
}

const S = 15; // icon size

function mkAction(defaults: string, Icon: React.ElementType, defaultTooltip: string) {
  return ({ className = "", tooltip, ...p }: BtnProps) => (
    <Btn {...p} tooltip={tooltip ?? defaultTooltip} className={`${defaults} ${className}`}>
      <Icon size={S} />
    </Btn>
  );
}

export const RowAction = {
  View:     mkAction("text-gray-400 hover:text-blue-600 hover:bg-blue-50",     Eye,         "View"),
  Edit:     mkAction("text-gray-400 hover:text-orange-500 hover:bg-orange-50", Pencil,      "Edit"),
  Delete:   mkAction("text-gray-400 hover:text-red-500 hover:bg-red-50",       Trash2,      "Delete"),
  Print:    mkAction("text-gray-400 hover:text-purple-600 hover:bg-purple-50", Printer,     "Print"),
  Download: mkAction("text-gray-400 hover:text-green-600 hover:bg-green-50",   Download,    "Download"),
  Copy:     mkAction("text-gray-400 hover:text-blue-600 hover:bg-blue-50",     Copy,        "Copy"),
  Approve:  mkAction("text-gray-400 hover:text-green-600 hover:bg-green-50",   Check,       "Approve"),
  Reject:   mkAction("text-gray-400 hover:text-red-500 hover:bg-red-50",       X,           "Reject"),
  Add:      mkAction("text-gray-400 hover:text-blue-600 hover:bg-blue-50",     Plus,        "Add"),
  Send:     mkAction("text-gray-400 hover:text-blue-600 hover:bg-blue-50",     Send,        "Send"),
  Refresh:  mkAction("text-gray-400 hover:text-gray-700 hover:bg-gray-100",    RefreshCw,   "Refresh"),
  Detail:   mkAction("text-gray-400 hover:text-blue-600 hover:bg-blue-50",     FileText,    "Detail"),
  Go:       mkAction("text-gray-400 hover:text-green-600 hover:bg-green-50",   ArrowRight,  "Open"),
  External: mkAction("text-gray-400 hover:text-blue-600 hover:bg-blue-50",     ExternalLink,"Open Link"),
  Search:   mkAction("text-gray-400 hover:text-blue-600 hover:bg-blue-50",     Search,      "Search"),
};

export function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 justify-center">{children}</div>;
}
