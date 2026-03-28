"use client";
import { useState, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
};

interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  pageSize?: number;
  actions?: (row: T) => React.ReactNode;
}

export function DataTable<T extends { id: string }>({
  data, columns, searchKeys = [], pageSize = 10, actions,
}: DataTableProps<T>) {
  const [search, setSearch]   = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage]       = useState(1);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q))
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortKey] ?? "");
      const bv = String((b as Record<string, unknown>)[sortKey] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged      = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const getCellValue = (row: T, col: Column<T>): React.ReactNode =>
    col.render
      ? col.render(row)
      : String((row as Record<string, unknown>)[String(col.key)] ?? "");

  const titleCol    = columns[0];
  const bodyColumns = columns.slice(1);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Search bar ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 w-full sm:max-w-xs shadow-sm">
        <Search size={14} style={{ color: "var(--erp-primary)" }} className="flex-shrink-0" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search..."
          className="bg-transparent text-sm text-gray-700 outline-none w-full"
        />
      </div>

      {/* ══════════════════════════════════════════════════════
          DESKTOP — full table (lg and above)
         ══════════════════════════════════════════════════════ */}
      <div className="hidden lg:block overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">

          {/* Themed header */}
          <thead>
            <tr style={{ background: "var(--erp-primary)" }}>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide
                    text-white/90 ${col.sortable ? "cursor-pointer select-none hover:text-white" : ""} ${col.width ?? ""}`}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === String(col.key) && (
                      sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-white/90">
                  Actions
                </th>
              )}
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
                <tr
                  key={row.id ?? idx}
                  className="erp-table-row transition-colors"
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-gray-700 text-sm">
                      {getCellValue(row, col)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right">{actions(row)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════
          TABLET (md)  — 2-column card grid
          MOBILE (sm)  — 1-column card grid
         ══════════════════════════════════════════════════════ */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
        {paged.length === 0 ? (
          <div className="col-span-full text-center py-16 text-gray-400 bg-white rounded-lg border border-gray-200 text-sm">
            No records found.
          </div>
        ) : (
          paged.map((row, idx) => (
            <div
              key={row.id ?? idx}
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Card header — primary-light tint */}
              <div
                className="px-4 py-2.5 flex items-center justify-between gap-3"
                style={{ background: "var(--erp-primary-light)", borderBottom: "1px solid #c8dded" }}
              >
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {getCellValue(row, titleCol)}
                </span>
                {actions && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {actions(row)}
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="divide-y divide-gray-50">
                {bodyColumns.map((col) => (
                  <div key={String(col.key)} className="flex items-start px-4 py-2.5 gap-3">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-28 flex-shrink-0 pt-0.5">
                      {col.header}
                    </span>
                    <span className="text-sm text-gray-800 flex-1 min-w-0 break-words">
                      {getCellValue(row, col)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-gray-500 flex-wrap gap-2">
        <span>
          Showing {paged.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - page) <= 2)
            .map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="w-7 h-7 rounded text-xs font-medium transition-all"
                style={
                  p === page
                    ? { background: "var(--erp-primary)", color: "#fff" }
                    : { color: "#374151" }
                }
                onMouseEnter={e => { if (p !== page) (e.currentTarget as HTMLElement).style.background = "var(--erp-primary-light)"; }}
                onMouseLeave={e => { if (p !== page) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {p}
              </button>
            ))}

          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
