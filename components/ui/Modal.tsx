"use client";
import { X } from "lucide-react";
import React, { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  subHeader?: React.ReactNode;
  bodyRef?: React.RefObject<HTMLDivElement | null>;
}

const SIZE_CLASS: Record<string, string> = {
  sm:   "w-full sm:max-w-md",
  md:   "w-full sm:max-w-lg",
  lg:   "w-full sm:max-w-2xl",
  xl:   "w-[92vw]",
  "2xl": "w-[97vw] min-h-[88vh]",
  full: "w-full h-full",
};

export default function Modal({ open, onClose, title, children, size = "md", subHeader, bodyRef }: ModalProps) {
  const isFullScreen = size === "full";

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-50 flex ${isFullScreen ? "items-stretch p-0" : "items-center justify-center p-4"}`}>
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={isFullScreen ? undefined : onClose} />

      {/* Modal panel */}
      <div
        className={`relative bg-white shadow-2xl flex flex-col ${
          isFullScreen
            ? "w-full h-full rounded-none"
            : `${SIZE_CLASS[size] ?? SIZE_CLASS.md} rounded-2xl max-h-[90vh]`
        }`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0 border-b"
          style={{ background: "#f5f9fc", borderColor: "#e2e8f0" }}
        >
          <h3 className="text-sm sm:text-base font-semibold truncate pr-4" style={{ color: "var(--erp-primary)" }}>{title}</h3>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sub-header (sticky tabs etc) */}
        {subHeader && (
          <div className="flex-shrink-0 px-4 sm:px-6 pt-3 pb-0 border-b border-gray-100 bg-white">
            {subHeader}
          </div>
        )}

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">{children}</div>
      </div>
    </div>
  );
}
