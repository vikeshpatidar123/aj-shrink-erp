"use client";
import { useState, useEffect, useRef } from "react";
import { Filter, Check } from "lucide-react";

interface ColFilterIconProps {
  values: string[];
  active: string;
  onChange: (v: string) => void;
}

export function ColFilterIcon({ values, active, onChange }: ColFilterIconProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative inline-block flex-shrink-0" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className={`p-0.5 rounded transition-colors ${active ? "text-yellow-300" : open ? "text-white" : "text-white/70 hover:text-white"}`}
        title={active ? `Filter: ${active}` : "Filter"}
      >
        <Filter size={9} />
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 mt-0.5 bg-white border border-gray-200 rounded-xl shadow-2xl py-1 min-w-[180px] max-h-[260px] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-2 text-left text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 border-b border-gray-100"
            onClick={() => { onChange(""); setOpen(false); }}
          >
            — All (Clear Filter) —
          </button>
          {values.map(v => {
            const isActive = active === v;
            return (
              <button
                key={v}
                className={`w-full px-3 py-2 text-left text-[11px] flex items-center gap-2 transition-colors
                  ${isActive ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                onClick={() => { onChange(isActive ? "" : v); setOpen(false); }}
              >
                <span className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0
                  ${isActive ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                  {isActive && <Check size={8} className="text-white" />}
                </span>
                <span className="truncate">{v}</span>
              </button>
            );
          })}
          {values.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-gray-400">No values</p>
          )}
        </div>
      )}
    </div>
  );
}
