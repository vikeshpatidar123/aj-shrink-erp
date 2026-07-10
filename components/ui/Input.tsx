"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...rest }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-gray-600">{label}</label>}
      <input
        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition
          ${error ? "border-red-400" : ""} ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface SelectProps {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  value?: string | number | readonly string[];
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function Select({ label, error, options, value, onChange, disabled, className = "" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const strValue = value !== undefined && value !== null ? String(value) : "";
  const selected = options.find(o => o.value === strValue);

  // The first option is often a placeholder like "-- Select --"
  const placeholder = options[0]?.value === "" ? options[0].label : "-- Select --";

  const filtered = options.filter(o =>
    (o.label ?? "").toLowerCase().includes((search ?? "").toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleSelect = (optValue: string) => {
    if (onChange) {
      const syntheticEvent = { target: { value: optValue } } as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="flex flex-col gap-1 relative" ref={ref}>
      {label && <label className="text-xs font-medium text-gray-600">{label}</label>}

      <div className={`w-full border border-gray-300 rounded-lg text-sm flex items-center bg-white
        ${disabled ? "bg-gray-50 opacity-60 cursor-not-allowed" : ""}
        ${error ? "border-red-400" : ""}
        ${open ? "border-blue-500 ring-2 ring-blue-500/20" : "hover:border-gray-400"}
        ${className}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => { if (!disabled) setOpen(o => !o); }}
          className="flex-1 px-3 py-2 text-left flex items-center gap-2 min-w-0 outline-none"
        >
          <span className={`truncate flex-1 ${selected && selected.value !== "" ? "text-gray-800" : "text-gray-400"}`}>
            {selected && selected.value !== "" ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={14}
            className={`text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
        {selected && selected.value !== "" && !disabled && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleSelect(""); }}
            className="px-2 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-r-lg transition-colors flex-shrink-0"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {/* Search box */}
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-md border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition">
              <Search size={12} className="text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">No results found</div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => handleSelect(o.value)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors
                    ${o.value === strValue
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : o.value === ""
                        ? "text-gray-400 italic hover:bg-gray-50"
                        : "text-gray-700 hover:bg-blue-50"
                    }`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === strValue && o.value !== "" && (
                    <Check size={12} className="text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = "", ...rest }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-gray-600">{label}</label>}
      <textarea
        rows={3}
        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none
          ${error ? "border-red-400" : ""} ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
