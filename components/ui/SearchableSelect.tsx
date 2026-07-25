"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

export interface SSOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  options: SSOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  allowFreeInput?: boolean;
  freeType?: boolean;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "-- Select --",
  className = "",
  disabled = false,
  allowEmpty = true,
  allowFreeInput = false,
  freeType = false,
}: Props) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos]       = useState({ top: 0, left: 0, width: 0 });

  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? ((allowFreeInput || freeType) ? value : "");

  // freeType mode: filter by current value; normal mode: filter by search
  const filterTerm = freeType ? value : search;
  const filtered = filterTerm
    ? options.filter(o => o.label.toLowerCase().includes(filterTerm.toLowerCase()))
    : options;

  const calcPos = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const dropH = Math.min(filtered.length * 34 + 8, 240);
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow < dropH && r.top > dropH ? r.top - dropH - 2 : r.bottom + 2;
    setPos({ top, left: r.left, width: r.width });
  };

  const openDrop = () => {
    if (disabled) return;
    calcPos();
    setOpen(true);
    if (!freeType) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  };

  const close = () => { setOpen(false); setSearch(""); };

  const pick = (val: string) => { onChange(val); close(); };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    close();
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) &&
          !dropRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const h = () => calcPos();
    window.addEventListener("scroll", h, true);
    window.addEventListener("resize", h);
    return () => { window.removeEventListener("scroll", h, true); window.removeEventListener("resize", h); };
  }, [open, filtered.length]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "Enter" && filtered.length === 1) { pick(filtered[0].value); return; }
    if (e.key === "Enter" && (allowFreeInput || freeType) && (search.trim() || value.trim())) {
      pick(freeType ? value.trim() : search.trim()); return;
    }
    if (e.key === "Enter" && filtered.length === 0 && allowEmpty) { pick(""); return; }
  };

  // freeType mode render
  if (freeType) {
    return (
      <>
        <div
          ref={wrapRef}
          onClick={() => inputRef.current?.focus()}
          className={`w-full flex items-center border rounded-xl px-3 py-2 bg-gray-50 transition cursor-text ${
            disabled ? "opacity-50 cursor-not-allowed bg-gray-100 pointer-events-none" : ""
          } ${open ? "border-blue-400 ring-2 ring-blue-200 bg-white" : "border-gray-200 hover:border-gray-300"} ${className}`}
        >
          <input
            ref={inputRef}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={e => { onChange(e.target.value); calcPos(); setOpen(true); }}
            onFocus={() => { calcPos(); setOpen(true); }}
            onBlur={() => { setTimeout(() => setOpen(false), 150); }}
            onKeyDown={onKey}
            className="flex-1 min-w-0 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400 cursor-text"
          />
          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
            {value && (
              <button type="button" onMouseDown={e => { e.preventDefault(); onChange(""); }}
                className="text-gray-300 hover:text-gray-500 p-0.5 rounded">
                <X size={12} />
              </button>
            )}
            <ChevronDown
              size={14}
              onMouseDown={e => { e.preventDefault(); open ? close() : openDrop(); }}
              className={`text-gray-400 transition-transform duration-150 cursor-pointer ${open ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {open && filtered.length > 0 && (
          <div
            ref={dropRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}
            className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
          >
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {filtered.map(o => (
                <div
                  key={o.value}
                  onMouseDown={() => pick(o.value)}
                  className={`px-3 py-2 text-sm cursor-pointer truncate select-none ${
                    o.value === value
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {o.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Trigger — looks like a native select; input inside for typing */}
      <div
        ref={wrapRef}
        onClick={open ? undefined : openDrop}
        className={`w-full flex items-center border rounded-xl px-3 py-2 bg-gray-50 transition cursor-pointer ${
          disabled ? "opacity-50 cursor-not-allowed bg-gray-100 pointer-events-none" : "hover:border-gray-300"
        } ${open ? "border-blue-400 ring-2 ring-blue-200 bg-white" : "border-gray-200"} ${className}`}
      >
        <input
          ref={inputRef}
          readOnly={!open}
          value={open ? search : displayLabel}
          placeholder={open ? "Type to search…" : placeholder}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={onKey}
          className={`flex-1 min-w-0 text-sm bg-transparent outline-none ${
            open
              ? "text-gray-900 placeholder-gray-400"
              : selected || displayLabel
              ? "text-gray-900 cursor-pointer"
              : "text-gray-400 cursor-pointer"
          }`}
        />
        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {value && !open && (
            <button
              type="button"
              onMouseDown={clear}
              className="text-gray-300 hover:text-gray-500 p-0.5 rounded"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Dropdown list — fixed positioned to escape overflow:hidden containers */}
      {open && (
        <div
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
        >
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {allowEmpty && (
              <div
                onMouseDown={() => pick("")}
                className="px-3 py-2 text-sm text-gray-400 cursor-pointer hover:bg-gray-50 select-none"
              >
                {placeholder}
              </div>
            )}
            {filtered.length === 0 && !allowFreeInput && (
              <div className="px-3 py-4 text-xs text-gray-400 text-center select-none">
                No matches{search ? ` for "${search}"` : ""}
              </div>
            )}
            {filtered.length === 0 && allowFreeInput && search.trim() && (
              <div
                onMouseDown={() => pick(search.trim())}
                className="px-3 py-2 text-sm cursor-pointer select-none text-blue-700 hover:bg-blue-50 flex items-center gap-2"
              >
                <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">NEW</span>
                {search.trim()}
              </div>
            )}
            {filtered.map(o => (
              <div
                key={o.value}
                onMouseDown={() => pick(o.value)}
                className={`px-3 py-2 text-sm cursor-pointer truncate select-none ${
                  o.value === value
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
