"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  X, ArrowUpDown, ArrowUp, ArrowDown, Filter, Columns2, BarChart2,
  Check,
} from "lucide-react";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
};

// ── Advanced filter model ─────────────────────────────────────────────────────
type MatchType = "contains" | "equals" | "startsWith";
type ColAdvFilter = {
  text: string;
  matchType: MatchType;
  values: string[]; // selected values; empty = all shown
};
const defaultAdvFilter = (): ColAdvFilter => ({ text: "", matchType: "contains", values: [] });

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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ── Statistics helper ─────────────────────────────────────────────────────────
function computeStats(data: Record<string, unknown>[], key: string) {
  const vals  = data.map(r => r[key]).filter(v => v !== null && v !== undefined && v !== "");
  const count = vals.length;
  const nums  = vals.map(v => parseFloat(String(v))).filter(n => !isNaN(n));
  const unique = new Set(vals.map(v => String(v))).size;
  if (nums.length > 0) {
    const sum = nums.reduce((a, b) => a + b, 0);
    return { count, unique, sum, avg: sum / nums.length, min: Math.min(...nums), max: Math.max(...nums), isNum: true };
  }
  return { count, unique, isNum: false };
}

// ── Quick Filter Panel ────────────────────────────────────────────────────────
function FilterPanel({
  header, colKey, allValues, currentFilter,
  onApply, onClear, onClose,
}: {
  header: string;
  colKey: string;
  allValues: string[];
  currentFilter: ColAdvFilter;
  onApply: (f: ColAdvFilter) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [text,         setText]         = useState(currentFilter.text);
  const [matchType,    setMatchType]    = useState<MatchType>(currentFilter.matchType);
  const [selectedVals, setSelectedVals] = useState<string[]>(currentFilter.values);
  const [valSearch,    setValSearch]    = useState("");

  const displayedVals = useMemo(() => {
    if (!valSearch.trim()) return allValues;
    const q = valSearch.toLowerCase();
    return allValues.filter(v => v.toLowerCase().includes(q));
  }, [allValues, valSearch]);

  const toggleVal = (v: string) =>
    setSelectedVals(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const toggleAll = () =>
    setSelectedVals(selectedVals.length === displayedVals.length ? [] : [...displayedVals]);

  const apply = () => {
    onApply({ text, matchType, values: selectedVals });
    onClose();
  };
  const clear = () => { onClear(); onClose(); };

  const TABS: { key: MatchType; label: string }[] = [
    { key: "contains",   label: "Contains"    },
    { key: "equals",     label: "Equals"      },
    { key: "startsWith", label: "Starts With" },
  ];

  return (
    <div
      className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden"
      style={{ width: 260, boxShadow: "0 8px 30px rgba(0,0,0,0.14)" }}
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <span className="text-[12px] font-bold text-gray-800">Quick Filter</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Text filter */}
      <div className="px-3 pt-3 pb-2">
        <input
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={`Filter ${header}…`}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-gray-50"
        />
      </div>

      {/* Match type tabs */}
      <div className="px-3 pb-2 flex gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMatchType(tab.key)}
            className="flex-1 py-1 text-[10px] font-semibold rounded-md transition-colors"
            style={matchType === tab.key
              ? { background: "var(--erp-primary)", color: "#fff" }
              : { background: "#f3f4f6", color: "#6b7280" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 mx-3" />

      {/* Filter by values */}
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-700">Filter by Values</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
          {allValues.length} unique
        </span>
      </div>

      {/* Value search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          <input
            value={valSearch}
            onChange={e => setValSearch(e.target.value)}
            placeholder="Search values…"
            className="w-full border border-gray-200 rounded pl-7 pr-2 py-1 text-[11px] outline-none focus:border-blue-400 bg-gray-50"
          />
        </div>
      </div>

      {/* Values list */}
      <div className="mx-3 mb-1 border border-gray-100 rounded-lg overflow-hidden">
        {/* Select all row */}
        {displayedVals.length > 0 && (
          <button
            onClick={toggleAll}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 border-b border-gray-100 transition-colors"
          >
            <span
              className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0"
              style={{
                background:  selectedVals.length === displayedVals.length && displayedVals.length > 0 ? "var(--erp-primary)" : "#fff",
                borderColor: selectedVals.length === displayedVals.length && displayedVals.length > 0 ? "var(--erp-primary)" : "#d1d5db",
              }}
            >
              {selectedVals.length === displayedVals.length && displayedVals.length > 0 && <Check size={8} className="text-white" />}
            </span>
            (Select All)
          </button>
        )}

        {/* Scrollable list */}
        <div className="overflow-y-auto" style={{ maxHeight: 180 }}>
          {displayedVals.length === 0 ? (
            <p className="text-center py-4 text-[11px] text-gray-400">No values</p>
          ) : (
            displayedVals.map(v => {
              const checked = selectedVals.includes(v);
              return (
                <button
                  key={v}
                  onClick={() => toggleVal(v)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0"
                >
                  <span
                    className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0"
                    style={{
                      background:  checked ? "var(--erp-primary)" : "#fff",
                      borderColor: checked ? "var(--erp-primary)" : "#d1d5db",
                    }}
                  >
                    {checked && <Check size={8} className="text-white" />}
                  </span>
                  <span className="truncate flex-1 text-left">{v || "(blank)"}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Apply button */}
      <div className="px-3 pt-1 pb-2">
        <button
          onClick={apply}
          className="w-full py-1.5 text-[12px] font-semibold text-white rounded-lg transition-colors"
          style={{ background: "var(--erp-primary)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--erp-primary-dark)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--erp-primary)"; }}
        >
          Apply Filter ({selectedVals.length || (text ? 1 : 0)})
        </button>
      </div>

      {/* Clear filter */}
      <button
        onClick={clear}
        className="mx-3 mb-3 flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-red-500 transition-colors justify-center py-1"
      >
        <X size={11} /> Clear Filter
      </button>
    </div>
  );
}

// ── Column header context menu ────────────────────────────────────────────────
function ColMenu({
  header, colKey, sortKey, sortDir,
  allColumns, hiddenCols, advFilter,
  onSortAsc, onSortDesc, onClearSort,
  onToggleCol, onApplyFilter, onClearFilter,
  rawData,
}: {
  header: string;
  colKey: string;
  sortKey: string | null;
  sortDir: "asc" | "desc";
  allColumns: { key: string; header: string }[];
  hiddenCols: Set<string>;
  advFilter: ColAdvFilter;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onClearSort: () => void;
  onToggleCol: (key: string) => void;
  onApplyFilter: (f: ColAdvFilter) => void;
  onClearFilter: () => void;
  rawData: Record<string, unknown>[];
}) {
  const [open,       setOpen]       = useState(false);
  const [sortOpen,   setSortOpen]   = useState(false);
  const [colOpen,    setColOpen]    = useState(false);
  const [statOpen,   setStatOpen]   = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !filterOpen) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setSortOpen(false); setColOpen(false); setStatOpen(false); setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, filterOpen]);

  const isSorted  = sortKey === colKey;
  const hasFilter = advFilter.text || advFilter.values.length > 0;

  const stats = useMemo(
    () => (statOpen ? computeStats(rawData, colKey) : null),
    [statOpen, rawData, colKey]
  );

  const allValues = useMemo(
    () => [...new Set(rawData.map(r => String(r[colKey] ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [rawData, colKey]
  );

  const fmt = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toLocaleString("en-IN", { maximumFractionDigits: 4 });

  const closeAll = () => {
    setOpen(false); setSortOpen(false); setColOpen(false); setStatOpen(false); setFilterOpen(false);
  };

  const toggleSection = (s: "sort" | "col" | "stat") => {
    setSortOpen(s === "sort" ? (v => !v) : false);
    setColOpen (s === "col"  ? (v => !v) : false);
    setStatOpen(s === "stat" ? (v => !v) : false);
  };

  return (
    <div className="relative flex-1 min-w-0" ref={wrapRef}>
      {/* Header label */}
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setSortOpen(false); setColOpen(false); setStatOpen(false); setFilterOpen(false); }}
        className="w-full flex items-center gap-1.5 text-left group"
      >
        <span className="flex-1 text-xs font-semibold text-gray-600 uppercase tracking-wide leading-snug whitespace-nowrap truncate">
          {header}
        </span>
        {hasFilter && <Filter size={9} className="text-blue-500 flex-shrink-0" />}
        {isSorted ? (
          sortDir === "asc"
            ? <ArrowUp size={11} className="text-blue-500 flex-shrink-0" />
            : <ArrowDown size={11} className="text-blue-500 flex-shrink-0" />
        ) : (
          !hasFilter && <ArrowUpDown size={11} className="text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>

      {/* Wrapper for both main menu + filter panel side by side */}
      {(open || filterOpen) && (
        <div className="absolute left-0 top-full z-50 mt-1 flex items-start gap-1">

          {/* Main menu */}
          {open && (
            <div
              className="bg-white rounded-xl border border-gray-200 py-1 overflow-hidden flex-shrink-0"
              style={{ minWidth: 200, boxShadow: "0 8px 30px rgba(0,0,0,0.14)" }}
            >
              {/* Title */}
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-[12px] font-bold text-gray-800">{header}</p>
              </div>

              {/* Sort */}
              <button type="button" onClick={() => toggleSection("sort")}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors">
                <ArrowUpDown size={13} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-left">Sort</span>
                <ChevronRight size={12} className="text-gray-300 flex-shrink-0 transition-transform"
                  style={{ transform: sortOpen ? "rotate(90deg)" : "rotate(0deg)" }} />
              </button>
              {sortOpen && (
                <div className="bg-gray-50 border-y border-gray-100">
                  <button type="button" onClick={() => { onSortAsc(); closeAll(); }}
                    className="w-full flex items-center gap-2.5 pl-10 pr-4 py-2 text-[12px] text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                    <ArrowUp size={12} /> Sort Ascending
                  </button>
                  <button type="button" onClick={() => { onSortDesc(); closeAll(); }}
                    className="w-full flex items-center gap-2.5 pl-10 pr-4 py-2 text-[12px] text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                    <ArrowDown size={12} /> Sort Descending
                  </button>
                  {isSorted && (
                    <button type="button" onClick={() => { onClearSort(); closeAll(); }}
                      className="w-full flex items-center gap-2.5 pl-10 pr-4 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors">
                      <X size={12} /> Clear Sort
                    </button>
                  )}
                </div>
              )}

              {/* Filter */}
              <button type="button"
                onClick={() => { setFilterOpen(v => !v); setSortOpen(false); setColOpen(false); setStatOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                style={{ color: filterOpen ? "var(--erp-primary)" : undefined }}
              >
                <Filter size={13} className="flex-shrink-0" style={{ color: hasFilter ? "var(--erp-primary)" : "#9ca3af" }} />
                <span className="flex-1 text-left">Filter</span>
                {hasFilter && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
              </button>

              {/* Column */}
              <button type="button" onClick={() => toggleSection("col")}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors">
                <Columns2 size={13} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-left">Column</span>
                <ChevronRight size={12} className="text-gray-300 flex-shrink-0 transition-transform"
                  style={{ transform: colOpen ? "rotate(90deg)" : "rotate(0deg)" }} />
              </button>
              {colOpen && (
                <div className="bg-gray-50 border-y border-gray-100 max-h-48 overflow-y-auto">
                  {allColumns.map(col => {
                    const visible = !hiddenCols.has(col.key);
                    const isLast  = allColumns.filter(c => !hiddenCols.has(c.key)).length === 1 && visible;
                    return (
                      <button key={col.key} type="button" disabled={isLast} onClick={() => onToggleCol(col.key)}
                        className="w-full flex items-center gap-2.5 pl-4 pr-4 py-1.5 text-[12px] text-gray-700 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <span className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                          style={{ background: visible ? "var(--erp-primary)" : "#fff", borderColor: visible ? "var(--erp-primary)" : "#d1d5db" }}>
                          {visible && <Check size={9} className="text-white" />}
                        </span>
                        <span className="flex-1 text-left truncate">{col.header}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Statistics */}
              <button type="button" onClick={() => toggleSection("stat")}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors">
                <BarChart2 size={13} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-left">Statistics</span>
                <ChevronRight size={12} className="text-gray-300 flex-shrink-0 transition-transform"
                  style={{ transform: statOpen ? "rotate(90deg)" : "rotate(0deg)" }} />
              </button>
              {statOpen && stats && (
                <div className="bg-gray-50 border-y border-gray-100 px-4 py-2 space-y-1">
                  {[
                    { label: "Count",  val: stats.count  },
                    { label: "Unique", val: stats.unique },
                    ...(stats.isNum ? [
                      { label: "Sum", val: fmt(stats.sum!) },
                      { label: "Avg", val: fmt(stats.avg!) },
                      { label: "Min", val: fmt(stats.min!) },
                      { label: "Max", val: fmt(stats.max!) },
                    ] : []),
                  ].map(({ label, val }) => (
                    <div key={label} className="flex justify-between text-[11px]">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-semibold text-gray-700">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filter panel (flyout to the right) */}
          {filterOpen && (
            <FilterPanel
              header={header}
              colKey={colKey}
              allValues={allValues}
              currentFilter={advFilter}
              onApply={f => { onApplyFilter(f); setFilterOpen(false); setOpen(false); }}
              onClear={() => { onClearFilter(); setFilterOpen(false); setOpen(false); }}
              onClose={() => setFilterOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function DataTable<T>({
  data, columns, searchKeys = [], pageSize: defaultPageSize = 25, actions,
  stickyHeader = false, scrollContainerClass, toolbar, initialSearch = "",
}: DataTableProps<T>) {
  const [search,      setSearch]      = useState(initialSearch);
  const [sortKey,     setSortKey]     = useState<string | null>(null);
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">("asc");
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(defaultPageSize);
  const [hiddenCols,  setHiddenCols]  = useState<Set<string>>(new Set());
  const [advFilters,  setAdvFilters]  = useState<Record<string, ColAdvFilter>>({});

  useEffect(() => {
    if (initialSearch) { setSearch(initialSearch); setPage(1); }
  }, [initialSearch]);

  const sortAsc   = (key: string) => { setSortKey(key); setSortDir("asc");  setPage(1); };
  const sortDesc  = (key: string) => { setSortKey(key); setSortDir("desc"); setPage(1); };
  const clearSort = ()            => { setSortKey(null); setSortDir("asc"); };

  const applyAdvFilter = useCallback((key: string, f: ColAdvFilter) => {
    if (!f.text.trim() && f.values.length === 0) {
      setAdvFilters(p => { const n = { ...p }; delete n[key]; return n; });
    } else {
      setAdvFilters(p => ({ ...p, [key]: f }));
    }
    setPage(1);
  }, []);
  const clearAdvFilter = useCallback((key: string) => {
    setAdvFilters(p => { const n = { ...p }; delete n[key]; return n; }); setPage(1);
  }, []);

  const toggleCol = (key: string) =>
    setHiddenCols(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const visibleColumns = useMemo(() => columns.filter(c => !hiddenCols.has(String(c.key))), [columns, hiddenCols]);
  const allColDefs     = useMemo(() => columns.map(c => ({ key: String(c.key), header: c.header })), [columns]);

  // Apply all filters
  const filtered = useMemo(() => {
    let rows = data;

    // Global search
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(row => searchKeys.some(k => String(row[k] ?? "").toLowerCase().includes(q)));
    }

    // Advanced per-column filters
    Object.entries(advFilters).forEach(([key, f]) => {
      if (!f) return;
      // Value filter (whitelist)
      if (f.values.length > 0) {
        rows = rows.filter(row => f.values.includes(String((row as Record<string, unknown>)[key] ?? "")));
      }
      // Text filter
      if (f.text.trim()) {
        const q = f.text.toLowerCase();
        rows = rows.filter(row => {
          const cell = String((row as Record<string, unknown>)[key] ?? "").toLowerCase();
          if (f.matchType === "equals")     return cell === q;
          if (f.matchType === "startsWith") return cell.startsWith(q);
          return cell.includes(q);
        });
      }
    });

    return rows;
  }, [data, search, searchKeys, advFilters]);

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
  const safePage   = Math.min(page, totalPages);
  const paged      = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rawData    = data as Record<string, unknown>[];

  const hasAnyFilter = search.trim() !== "" || Object.keys(advFilters).length > 0;

  const clearAllFilters = () => { setSearch(""); setAdvFilters({}); setPage(1); };

  const getCellValue = (row: T, col: Column<T>): React.ReactNode =>
    col.render ? col.render(row) : String((row as Record<string, unknown>)[String(col.key)] ?? "");

  const titleCol    = visibleColumns[0] ?? columns[0];
  const bodyColumns = visibleColumns.slice(1);

  const pageNums = useMemo(() => {
    const arr: number[] = [];
    const start = Math.max(1, safePage - 2);
    const end   = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [safePage, totalPages]);

  const tableWrapClass = stickyHeader
    ? `overflow-auto rounded-lg border border-gray-200 ${scrollContainerClass ?? ""}`
    : "hidden lg:block overflow-x-auto rounded-lg border border-gray-200";

  return (
    <div className={`flex flex-col gap-3 ${stickyHeader ? "h-full min-h-0" : ""}`}>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        {searchKeys.length > 0 && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 sm:max-w-xs shadow-sm">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search…"
              className="bg-transparent text-sm text-gray-700 outline-none w-full placeholder-gray-400" />
            {search && <button onClick={() => { setSearch(""); setPage(1); }} className="text-gray-400 hover:text-gray-600"><X size={11} /></button>}
          </div>
        )}
        {hasAnyFilter && (
          <button onClick={clearAllFilters}
            className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition">
            <X size={11} /> Clear All Filters
          </button>
        )}
        {toolbar && <div className="ml-auto flex items-center gap-2 flex-shrink-0">{toolbar}</div>}
      </div>

      {/* ══ DESKTOP table ══ */}
      <div className={tableWrapClass} style={stickyHeader ? { flex: 1, minHeight: 0 } : {}}>
        <table className="min-w-full text-sm border-collapse">
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            <tr className="bg-gray-50 border-b border-gray-200">
              {visibleColumns.map(col => {
                const key = String(col.key);
                return (
                  <th key={key} className={`px-3 py-2.5 text-left border-r border-gray-200 last:border-r-0 ${col.width ?? ""}`}>
                    <ColMenu
                      header={col.header} colKey={key}
                      sortKey={sortKey} sortDir={sortDir}
                      allColumns={allColDefs} hiddenCols={hiddenCols}
                      advFilter={advFilters[key] ?? defaultAdvFilter()}
                      onSortAsc={() => sortAsc(key)} onSortDesc={() => sortDesc(key)} onClearSort={clearSort}
                      onToggleCol={toggleCol}
                      onApplyFilter={f => applyAdvFilter(key, f)}
                      onClearFilter={() => clearAdvFilter(key)}
                      rawData={rawData}
                    />
                  </th>
                );
              })}
              {actions && (
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (actions ? 1 : 0)} className="text-center py-14 text-gray-400 text-sm">
                  No records found.
                </td>
              </tr>
            ) : (
              paged.map((row, idx) => (
                <tr key={(row as Record<string, unknown>)["id"] as string ?? idx} className="hover:bg-blue-50/30 transition-colors">
                  {visibleColumns.map(col => (
                    <td key={String(col.key)} className="px-3 py-2.5 text-gray-700 text-sm border-r border-gray-100 last:border-r-0">
                      {getCellValue(row, col)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-3 py-2.5 text-center border-l border-gray-100">{actions(row)}</td>
                  )}
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
          ) : paged.map((row, idx) => (
            <div key={(row as Record<string, unknown>)["id"] as string ?? idx} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 flex items-center justify-between gap-3 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-800 truncate">{getCellValue(row, titleCol)}</span>
                {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions(row)}</div>}
              </div>
              <div className="divide-y divide-gray-50">
                {bodyColumns.map(col => (
                  <div key={String(col.key)} className="flex items-start px-4 py-2.5 gap-3">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-28 flex-shrink-0 pt-0.5">{col.header}</span>
                    <span className="text-sm text-gray-700 flex-1 min-w-0 break-words">{getCellValue(row, col)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between text-xs text-gray-500 flex-wrap gap-2 flex-shrink-0">
        <span>
          Showing {paged.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
          {sorted.length !== data.length && <span className="text-gray-400 ml-1">(filtered from {data.length})</span>}
        </span>
        <div className="flex items-center gap-1">
          <button disabled={safePage === 1} onClick={() => setPage(1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="First"><ChevronsLeft size={14} /></button>
          <button disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Previous"><ChevronLeft size={14} /></button>
          {pageNums[0] > 1 && <span className="px-1 text-gray-300">…</span>}
          {pageNums.map(p => (
            <button key={p} onClick={() => setPage(p)} className="w-7 h-7 rounded text-xs font-medium transition-all"
              style={p === safePage ? { background: "var(--erp-primary)", color: "#fff" } : { color: "#374151" }}
              onMouseEnter={e => { if (p !== safePage) (e.currentTarget as HTMLElement).style.background = "#f3f4f6"; }}
              onMouseLeave={e => { if (p !== safePage) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              {p}
            </button>
          ))}
          {pageNums[pageNums.length - 1] < totalPages && <span className="px-1 text-gray-300">…</span>}
          <button disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Next"><ChevronRight size={14} /></button>
          <button disabled={safePage === totalPages} onClick={() => setPage(totalPages)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Last"><ChevronsRight size={14} /></button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Show:</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 bg-white outline-none focus:border-blue-400 cursor-pointer">
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-gray-400">rows</span>
        </div>
      </div>
    </div>
  );
}
