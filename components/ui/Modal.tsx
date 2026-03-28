"use client";
import { X } from "lucide-react";
import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

// Wider sizes so less scrolling is needed
const sizes = {
  sm: "sm:max-w-lg",
  md: "sm:max-w-3xl",
  lg: "sm:max-w-5xl",
  xl: "sm:max-w-[92vw]",
};

export default function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-3">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal panel */}
      <div
        className={`relative bg-white w-full ${sizes[size]}
          rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col
          max-h-[94dvh] sm:max-h-[95vh]`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 truncate pr-4">{title}</h3>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">{children}</div>
      </div>
    </div>
  );
}
