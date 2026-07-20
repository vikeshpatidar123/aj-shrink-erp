"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { Search, ChevronLeft, ChevronRight, X, Filter, Check } from "lucide-react";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
};

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  pageSize?: number;
  actions?: (row: T) => React.ReactNode;
  stickyHeader?: boolean;
  scrollContainerClass?: string;
  toolbar?: React.ReactNode;
  initialSearch?: string;
}

// ── Inline funnel dropdown (self-contained) ───────────────────────────────────
function ColFunnel({ colKey, data, value, onChange }: {
  colKey: string;
  data: Record<string, unknown>[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const uniq = useMemo(() =>
    [...new Set(data.map(r => String(r[colKey] ?? "")).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    ), [data, colKey]);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className={`p-0.5 rounded transition-colors ${value ? "text-yellow-300" : open ? "text-white" : "text-white/70 hover:text-white"}`}
        title={value ? `Filter: ${value}` : "Filter"}
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
          {uniq.map(v => {
            const active = value === v;
            return (
              <button key={v}
                className={`w-full px-3 py-2 text-left text-[11px] flex items-center gap-2 transition-colors
                  ${active ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                onClick={() => { onChange(active ? "" : v); setOpen(false); }}
              >
                <span className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0
                  ${active ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                  {active && <Check size={8} className="text-white" />}
                </span>
                <span className="truncate">{v}</span>
              </button>
            );
          })}
          {uniq.length === 0 && <p className="px-3 py-2 text-[11px] text-gray-400">No values</p>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function DataTable<T>({
  data, columns, searchKeys = [], pageSize = 10, actions,
  stickyHeader = false, scrollContainerClass, toolbar, initialSearch = "",
}: DataTableProps<T>) {
  const [search,     setSearch]     = useState(initialSearch);
  useEffect(() => { if (initialSearch) { setSearch(initialSearch); setPage(1); } }, [initialSearch]);

  const [sortKey,    setSortKey]    = useState<string | null>(null);
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("asc");
  const [page,       setPage]       = useState(1);
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

  const setColFilter = (key: string, val: string) => { setColFilters(p => ({ ...p, [key]: val })); setPage(1); };
  const clearAllFilters = () => { setSearch(""); setColFilters({}); setPage(1); };
  const hasAnyFilter = search.trim() !== "" || Object.values(colFilters).some(v => v.trim() !== "");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") { setSortDir("desc"); }
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key); setSortDir("asc");
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let rows = data;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(row => searchKeys.some(k => String(row[k] ?? "").toLowerCase().includes(q)));
    }
    Object.entries(colFilters).forEach(([key, val]) => {
      if (!val.trim()) return;
      const q = val.toLowerCase();
      rows = rows.filter(row => String((row as Record<string, unknown>)[key] ?? "").toLowerCase().includes(q));
    });
    return rows;
  }, [data, search, searchKeys, colFilters]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortKey] ?? "");
      const bv = String((b as Record<string, unknown>)[sortKey] ?? "");
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged      = sorted.slice((page - 1) * pageSize, page * pageSize);

  const getCellValue = (row: T, col: Column<T>): React.ReactNode =>
    col.render ? col.render(row) : String((row as Record<string, unknown>)[String(col.key)] ?? "");

  const rawData = data as Record<string, unknown>[];
  const titleCol    = columns[0];
  const bodyColumns = columns.slice(1);

  const tableWrapClass = stickyHeader
    ? `overflow-x-auto overflow-y-auto rounded-lg border border-gray-200 shadow-sm ${scrollContainerClass ?? ""}`
    : "hidden lg:block overflow-x-auto rounded-lg border border-gray-200 shadow-sm";

  return (
    <div className={`flex flex-col gap-3 ${stickyHeader ? "h-full min-h-0" : ""}`}>

      {/* ── Search + toolbar ── */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 flex-1 sm:max-w-xs shadow-sm">
          <Search size={14} style={{ color: "var(--erp-primary)" }} className="flex-shrink-0" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search all columns..."
            className="bg-transparent text-sm text-gray-700 outline-none w-full" />
          {search && <button onClick={() => { setSearch(""); setPage(1); }} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
        </div>
        {hasAnyFilter && (
          <button onClick={clearAllFilters}
            className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition">
            <X size={11} /> Clear All Filters
          </button>
        )}
        {hasAnyFilter && <span className="text-xs text-gray-500 font-medium">{sorted.length} / {data.length} rows</span>}
        {toolbar && <div className="ml-auto flex items-center gap-2 flex-shrink-0">{toolbar}</div>}
      </div>

      {/* ══ DESKTOP table ══ */}
      <div className={tableWrapClass} style={stickyHeader ? { flex: 1, minHeight: 0 } : {}}>
        <table className="min-w-full text-sm">
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            {/* ── Column headers with sort ▲▼ + funnel ── */}
            <tr style={{ background: "var(--erp-primary)" }}>
              {columns.map(col => {
                const key        = String(col.key);
                const isSortActive = sortKey === key;
                const cfVal      = colFilters[key] ?? "";
                return (
                  <th key={key}
                    className={`relative px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white/90
                      ${col.sortable ? "cursor-pointer select-none hover:bg-white/10" : ""} ${col.width ?? ""}`}
                  >
                    <div className="flex items-center gap-1">
                      {/* Sort label */}
                      <span className="flex items-center gap-0.5 flex-1"
                        onClick={() => col.sortable && handleSort(key)}>
                        {col.header}
                        {col.sortable && (
                          <span className="flex flex-col leading-none ml-0.5">
                            <span className={`text-[7px] ${isSortActive && sortDir === "asc" ? "text-yellow-300" : "text-white/30"}`}>▲</span>
                            <span className={`text-[7px] ${isSortActive && sortDir === "desc" ? "text-yellow-300" : "text-white/30"}`}>▼</span>
                          </span>
                        )}
                      </span>
                      {/* Funnel icon */}
                      <ColFunnel colKey={key} data={rawData} value={cfVal} onChange={v => setColFilter(key, v)} />
                    </div>
                  </th>
                );
              })}
              {actions && (
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-white/90">
                  Actions
                </th>
              )}
            </tr>

            {/* ── Per-column text filter inputs ── */}
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map(col => {
                const key = String(col.key);
                const val = colFilters[key] ?? "";
                return (
                  <td key={key} className="px-2 py-1.5">
                    <div className="relative">
                      <input value={val} onChange={e => setColFilter(key, e.target.value)}
                        placeholder="Filter…"
                        className="w-full text-xs border rounded px-2 py-1 pr-5 outline-none bg-white
                          border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 placeholder-gray-300" />
                      {val && (
                        <button onClick={() => setColFilter(key, "")}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
              {actions && <td className="px-2 py-1.5" />}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-12 text-gray-400 text-sm">
                  No records found.
                </td>
              </tr>
            ) : (
              paged.map((row, idx) => (
                <tr key={(row as Record<string, unknown>)["id"] as string ?? idx} className="erp-table-row transition-colors">
                  {columns.map(col => (
                    <td key={String(col.key)} className="px-3 py-2.5 text-gray-700 text-sm">
                      {getCellValue(row, col)}
                    </td>
                  ))}
                  {actions && <td className="px-3 py-2.5 text-right">{actions(row)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ══ MOBILE cards ══ */}
      {!stickyHeader && (
        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
          {paged.length === 0 ? (
            <div className="col-span-full text-center py-16 text-gray-400 bg-white rounded-lg border border-gray-200 text-sm">No records found.</div>
          ) : (
            paged.map((row, idx) => (
              <div key={(row as Record<string, unknown>)["id"] as string ?? idx} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 flex items-center justify-between gap-3"
                  style={{ background: "var(--erp-primary-light)", borderBottom: "1px solid #c8dded" }}>
                  <span className="text-sm font-semibold text-gray-900 truncate">{getCellValue(row, titleCol)}</span>
                  {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions(row)}</div>}
                </div>
                <div className="divide-y divide-gray-50">
                  {bodyColumns.map(col => (
                    <div key={String(col.key)} className="flex items-start px-4 py-2.5 gap-3">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-28 flex-shrink-0 pt-0.5">{col.header}</span>
                      <span className="text-sm text-gray-800 flex-1 min-w-0 break-words">{getCellValue(row, col)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between text-xs text-gray-500 flex-wrap gap-2 flex-shrink-0">
        <span>Showing {paged.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}</span>
        <div className="flex items-center gap-1">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => Math.abs(p - page) <= 2)
            .map(p => (
              <button key={p} onClick={() => setPage(p)}
                className="w-7 h-7 rounded text-xs font-medium transition-all"
                style={p === page ? { background: "var(--erp-primary)", color: "#fff" } : { color: "#374151" }}
                onMouseEnter={e => { if (p !== page) (e.currentTarget as HTMLElement).style.background = "var(--erp-primary-light)"; }}
                onMouseLeave={e => { if (p !== page) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                {p}
              </button>
            ))}
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
