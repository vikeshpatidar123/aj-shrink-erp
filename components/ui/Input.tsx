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
      {label && (
        <label className="block text-xs font-medium text-[rgb(var(--fg-default))] mb-1">
          {label}
        </label>
      )}
      <input
        className={`h-10 w-full rounded-md border px-3 py-2 text-xs
          bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-subtle))]
          border-[rgb(var(--bd-default))] focus:border-[rgb(var(--color-primary))]
          focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/10
          disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[rgb(var(--bg-subtle))]
          transition-all duration-200
          ${error ? "border-red-400 focus:border-red-400" : ""} ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
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
      {label && (
        <label className="block text-xs font-medium text-[rgb(var(--fg-default))] mb-1">
          {label}
        </label>
      )}

      <div className={`h-10 w-full rounded-md border text-xs flex items-center
        bg-[rgb(var(--bg-surface))]
        ${disabled ? "opacity-60 cursor-not-allowed" : ""}
        ${error ? "border-red-400" : open
          ? "border-[rgb(var(--color-primary))] ring-2 ring-[rgb(var(--color-primary))]/10"
          : "border-[rgb(var(--bd-default))] hover:border-[rgb(var(--bd-medium,193,197,205))]"}
        transition-all duration-200
        ${className}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => { if (!disabled) setOpen(o => !o); }}
          className="flex-1 px-3 py-2 text-left flex items-center gap-2 min-w-0 outline-none h-full"
        >
          <span className={`truncate flex-1 ${selected && selected.value !== "" ? "text-[rgb(var(--fg-default))]" : "text-[rgb(var(--fg-subtle))]"}`}>
            {selected && selected.value !== "" ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={14}
            className={`text-[rgb(var(--fg-muted))] flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
        {selected && selected.value !== "" && !disabled && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleSelect(""); }}
            className="px-2 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))] rounded-r-md transition-colors flex-shrink-0 h-full flex items-center"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 z-[9999] w-full mt-1 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[rgb(var(--bd-default))]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-surface))] focus-within:border-[rgb(var(--color-primary))] transition-colors">
              <Search size={12} className="text-[rgb(var(--fg-muted))] flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex-1 text-xs bg-transparent outline-none text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-muted))] border-none ring-0 h-auto p-0 rounded-none"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[rgb(var(--fg-subtle))] text-center">No results found</div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => handleSelect(o.value)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 rounded-sm transition-colors
                    ${o.value === strValue
                      ? "bg-[rgb(var(--color-primary-subtle))] text-[rgb(var(--color-primary))] font-semibold"
                      : o.value === ""
                        ? "text-[rgb(var(--fg-subtle))] italic hover:bg-[rgb(var(--bg-hover))]"
                        : "text-[rgb(var(--fg-default))] hover:bg-[rgb(var(--bg-hover))]"
                    }`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === strValue && o.value !== "" && (
                    <Check size={12} className="text-[rgb(var(--color-primary))] flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
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
      {label && (
        <label className="block text-xs font-medium text-[rgb(var(--fg-default))] mb-1">
          {label}
        </label>
      )}
      <textarea
        rows={3}
        className={`w-full rounded-md border px-3 py-2 text-xs min-h-[80px]
          bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-subtle))]
          border-[rgb(var(--bd-default))] focus:border-[rgb(var(--color-primary))]
          focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/10
          disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[rgb(var(--bg-subtle))]
          transition-all duration-200 resize-none
          ${error ? "border-red-400 focus:border-red-400" : ""} ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}
