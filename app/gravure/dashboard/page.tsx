"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ComposedChart, BarChart, Bar, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Package, Truck, AlertTriangle, Clock, CheckCircle,
  Users, Activity, RefreshCw, BarChart2, Layers, Zap, Calendar,
  FileText, LayoutDashboard, Factory, Palette, ChevronRight,
  ArrowRight, AlertCircle, Gauge, X, Maximize2, Minimize2, Pause, Droplet,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import TutorialButton from "@/components/ui/TutorialButton";
import { Input } from "@/components/ui/Input";
import { DataTable } from "@/components/tables/DataTable";

// ── Helpers ───────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
type TabKey = "management" | "production" | "planning" | "dispatch" | "sales" | "command-center";

function parse(v: unknown): Row[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as Row[];
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
  return [];
}
function n(v: unknown) { return Number(v ?? 0); }
function str(v: unknown) { return String(v ?? ""); }
function fmt(v: unknown) { return n(v).toLocaleString("en-IN"); }
function cur(v: unknown) { return "₹" + n(v).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }
function fmtCr(v: unknown): string {
  const val = n(v);
  if (val >= 10_000_000) return "₹" + (val / 10_000_000).toFixed(2) + " Cr";
  if (val >= 100_000)    return "₹" + (val / 100_000).toFixed(1) + " L";
  return "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

const STATUS_CLR: Record<string, string> = {
  "Open": "#2563EB", "In Progress": "#D97706",
  "On Hold": "#C2410C", "Completed": "#16A34A", "Cancelled": "#DC2626",
};
const CLR = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#F97316","#EC4899"];

// ── Shared UI ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: _Ic, color, sub, alert, onClick, compact }: {
  label: string; value: string | number; icon?: React.ElementType;
  color?: string; sub?: string; alert?: boolean; onClick?: () => void; compact?: boolean;
}) {
  const isAlert = alert && n(value) > 0;
  const accentColor = isAlert ? "#DC2626" : (color ?? "#4F46E5");
  const valueColor  = isAlert ? "#DC2626" : (color ?? "#374151");
  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border border-gray-100 overflow-hidden transition-all select-none
        ${isAlert ? "bg-red-50/10" : ""}
        ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0" : ""}`}
      style={{ borderLeftWidth: "3px", borderLeftColor: accentColor }}>
      <div className={compact ? "px-3 py-3" : "px-4 py-3.5"}>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{label}</p>
        <p className={`font-bold tabular-nums mt-1 ${compact ? "text-xl" : "text-2xl"}`}
           style={{ color: valueColor }}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function KpiStrip({ metrics }: {
  metrics: Array<{
    label: string; value: string | number;
    color?: string; sub?: string; alert?: boolean; onClick?: () => void;
  }>;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="flex divide-x divide-gray-100">
        {metrics.map((m, i) => {
          const isAlert = m.alert && n(m.value) > 0;
          const col = isAlert ? "#DC2626" : (m.color ?? "#374151");
          return (
            <button key={i}
              onClick={m.onClick}
              disabled={!m.onClick}
              className={`flex-1 min-w-0 px-3 py-3.5 flex flex-col items-center text-center transition-colors
                ${m.onClick ? "cursor-pointer hover:bg-gray-50/70" : "cursor-default"}
                ${isAlert ? "bg-red-50/20" : ""}`}>
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">{m.label}</span>
              <span className="text-2xl font-bold tabular-nums leading-none my-1.5" style={{ color: col }}>
                {m.value}
              </span>
              {m.sub && <span className="text-[9px] text-gray-400 whitespace-nowrap">{m.sub}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Card({ title, children, className, action }: {
  title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className ?? ""}`}>
      {title && (
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <span className="font-semibold text-gray-700 text-sm">{title}</span>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = STATUS_CLR[status] ?? "#6B7280";
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap"
          style={{ color, borderColor: color + "40", backgroundColor: color + "10" }}>{status}</span>
  );
}

function DeadlineBadge({ days }: { days: number }) {
  if (days > 7)   return <span className="text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{days}d left</span>;
  if (days > 0)   return <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{days}d left</span>;
  if (days === 0) return <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Due today</span>;
  return <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{Math.abs(days)}d OD</span>;
}

function OverdueBadge({ days }: { days: number }) {
  if (days > 7) return <span className="text-xs font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">{days}d CRIT</span>;
  if (days > 3) return <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{days}d HIGH</span>;
  return <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{days}d</span>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-9 h-9 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ icon: Ic, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="py-10 text-center">
      <Ic size={28} className="mx-auto mb-2 text-gray-300" />
      <p className="text-sm font-semibold text-gray-400">{title}</p>
      {sub && <p className="text-xs text-gray-300 mt-1">{sub}</p>}
    </div>
  );
}

// ── Clickable IDs ─────────────────────────────────────────────────────────────
function JobLink({ no, router }: { no: string; router: ReturnType<typeof useRouter> }) {
  if (!no) return <span className="text-xs text-gray-300">—</span>;
  return (
    <button onClick={e => { e.stopPropagation(); router.push("/gravure/workorder"); }}
      className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
      {no}
    </button>
  );
}

function OrderLink({ no, router }: { no: string; router: ReturnType<typeof useRouter> }) {
  if (!no) return <span className="text-xs text-gray-300">—</span>;
  return (
    <button onClick={e => { e.stopPropagation(); router.push("/gravure/orders"); }}
      className="font-mono text-xs font-bold text-slate-600 hover:text-slate-900 hover:underline">
      {no}
    </button>
  );
}

// ── TBL wrapper ───────────────────────────────────────────────────────────────
type ColDef = { key: string; label: string; render?: (v: unknown, r: Row) => React.ReactNode };

function TBL({ rows, cols }: { rows: Row[]; cols: ColDef[] }) {
  const columns = cols.map(c => ({
    key: c.key,
    header: c.label,
    render: c.render ? (row: Row) => c.render!(row[c.key], row) : undefined,
  }));
  return (
    <DataTable data={rows} columns={columns as any} pageSize={10} searchKeys={cols.map(c => c.key) as any} />
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────
type DrawerConfig = { title: string; subtitle?: string; rows: Row[]; cols: ColDef[] };

function Drawer({ cfg, onClose }: { cfg: DrawerConfig | null; onClose: () => void }) {
  useEffect(() => {
    if (!cfg) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [cfg, onClose]);

  if (!cfg) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white z-50 shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-base">{cfg.title}</h2>
            {cfg.subtitle && <p className="text-xs text-gray-400 mt-0.5">{cfg.subtitle}</p>}
          </div>
          <button onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors mt-0.5 shrink-0">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {cfg.rows.length === 0
            ? <EmptyState icon={CheckCircle} title="No items to show" sub="Data may still be loading — try again in a moment" />
            : <TBL rows={cfg.rows} cols={cfg.cols} />
          }
        </div>
        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/60 shrink-0">
          <p className="text-xs text-gray-400">{cfg.rows.length} record{cfg.rows.length !== 1 ? "s" : ""} — press Esc to close</p>
        </div>
      </div>
    </>
  );
}

// ── Drill-down types & builder ────────────────────────────────────────────────
type DrillTarget = "overdue" | "schedule" | "dispatch-ready" | "artwork" | "ink" | "no-jc" | "estimations";

const DRILL_TARGET_TAB: Partial<Record<DrillTarget, TabKey>> = {
  schedule:         "planning",
  "dispatch-ready": "dispatch",
  artwork:          "planning",
  ink:              "production",
  "no-jc":          "planning",
  estimations:      "sales",
};

function buildDrawer(target: DrillTarget, data: Partial<Record<TabKey, any>>): DrawerConfig {
  const cc = data["command-center"];
  const pl = data.planning;
  const pr = data.production;
  const di = data.dispatch;
  const sl = data.sales;

  switch (target) {
    case "overdue":
      return {
        title: "Overdue Jobs",
        subtitle: "Jobs past their planned completion date",
        rows: parse(cc?.overdueJobs ?? pr?.overdueJobs),
        cols: [
          { key: "JobBookingNo", label: "Job #",    render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
          { key: "CustomerName", label: "Customer" },
          { key: "MachineName",  label: "Machine" },
          { key: "Status",       label: "Status",  render: v => <StatusPill status={str(v)} /> },
          { key: "PlannedDate",  label: "Planned" },
          { key: "DaysOverdue",  label: "Overdue", render: v => <OverdueBadge days={n(v)} /> },
        ],
      };
    case "schedule":
      return {
        title: "Jobs Awaiting Schedule Release",
        subtitle: "Approved jobs not yet released to the production floor",
        rows: parse(pl?.awaitingSchedule),
        cols: [
          { key: "JobBookingNo",     label: "Job #",    render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
          { key: "CustomerName",     label: "Customer" },
          { key: "MachineName",      label: "Machine" },
          { key: "Status",           label: "Status",   render: v => <StatusPill status={str(v)} /> },
          { key: "PendingArtColors", label: "Art",      render: v => n(v) > 0 ? <span className="text-orange-600 font-bold text-xs">{str(v)}</span> : <span className="text-green-600 text-xs font-bold">✓</span> },
          { key: "PendingInkSPR",    label: "Ink",      render: v => n(v) > 0 ? <span className="text-red-600 font-bold text-xs">{str(v)}</span> : <span className="text-green-600 text-xs font-bold">✓</span> },
          { key: "DaysToDeadline",   label: "Deadline", render: (v, r) => <span className="text-xs whitespace-nowrap">{str(r.PlannedDate)} <DeadlineBadge days={n(v)} /></span> },
        ],
      };
    case "dispatch-ready":
      return {
        title: "Dispatch Ready",
        subtitle: "Completed jobs awaiting dispatch",
        rows: parse(di?.dispatchReady),
        cols: [
          { key: "JobBookingNo",      label: "Job #",          render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
          { key: "CustomerName",      label: "Customer" },
          { key: "SalesOrderNo",      label: "SO #",           render: v => <span className="font-mono text-xs font-bold text-purple-600">{str(v)}</span> },
          { key: "OrderQty",          label: "Qty",            render: (v, r) => `${fmt(v)} ${str(r.Unit)}` },
          { key: "DaysSinceDeadline", label: "Since Deadline", render: v => n(v) > 0 ? <OverdueBadge days={n(v)} /> : <span className="text-green-600 text-xs font-semibold">On time</span> },
        ],
      };
    case "artwork":
      return {
        title: "Artwork Pending",
        subtitle: "Jobs with pending artwork colors",
        rows: parse(pl?.artworkPending),
        cols: [
          { key: "JobBookingNo",  label: "Job #",   render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
          { key: "CustomerName",  label: "Customer" },
          { key: "TotalColors",   label: "Total" },
          { key: "PendingColors", label: "Pending", render: v => <span className="text-orange-600 font-bold">{str(v)}</span> },
          { key: "CurrentStage",  label: "Stage",   render: v => <span className="text-xs text-gray-500 italic">{str(v)}</span> },
        ],
      };
    case "ink":
      return {
        title: "Ink / SPR Pending",
        subtitle: "Ink shades not yet produced",
        rows: parse(pr?.pendingInk),
        cols: [
          { key: "SPRNo",        label: "SPR No",   render: v => <span className="font-mono text-xs font-bold">{str(v)}</span> },
          { key: "ShadeName",    label: "Shade" },
          { key: "JobNo",        label: "Job #",    render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
          { key: "CustomerName", label: "Customer" },
          { key: "RequiredQty",  label: "Qty (kg)", render: v => fmt(v) },
          { key: "RequiredDate", label: "Required" },
        ],
      };
    case "no-jc":
      return {
        title: "Orders Without Job Card",
        subtitle: "Sales orders with no job card created yet",
        rows: parse(pl?.ordersNoJobCard ?? sl?.ordersNoJobCard),
        cols: [
          { key: "SalesOrderNo",  label: "Order #", render: v => <span className="font-mono text-xs font-bold text-purple-600">{str(v)}</span> },
          { key: "CustomerName",  label: "Customer" },
          { key: "OrderDate",     label: "Date" },
          { key: "DaysOld",       label: "Age",     render: v => <span className={`text-xs font-bold ${n(v) > 7 ? "text-red-600" : "text-amber-600"}`}>{str(v)}d</span> },
          { key: "OrderValue",    label: "Value",   render: v => cur(v) },
        ],
      };
    case "estimations":
      return {
        title: "Pending Estimations",
        subtitle: "Estimations in draft / pending / quoted state",
        rows: parse(sl?.pendingEstimations),
        cols: [
          { key: "EstimationNo",  label: "Est #",   render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
          { key: "CustomerName",  label: "Customer" },
          { key: "JobName",       label: "Job" },
          { key: "Status",        label: "Status",  render: v => <StatusPill status={str(v)} /> },
          { key: "DaysOld",       label: "Age",     render: v => <span className={`text-xs font-bold ${n(v) > 14 ? "text-red-600" : "text-amber-600"}`}>{str(v)}d</span> },
        ],
      };
  }
}

// ── Upcoming Deadlines ────────────────────────────────────────────────────────
const DEADLINE_GROUPS = [
  { label: "Overdue",     color: "#EF4444", test: (d: number) => d < 0 },
  { label: "Due Today",   color: "#DC2626", test: (d: number) => d === 0 },
  { label: "Tomorrow",    color: "#F97316", test: (d: number) => d === 1 },
  { label: "Next 3 Days", color: "#F59E0B", test: (d: number) => d >= 2 && d <= 3 },
  { label: "Next 7 Days", color: "#3B82F6", test: (d: number) => d >= 4 && d <= 7 },
];

function UpcomingDeadlines({ prodData }: { prodData: any }) {
  const board = parse(prodData?.machineJobBoard ?? []);
  const grouped = useMemo(() => {
    const sorted = [...board]
      .filter(r => n(r.DaysToDeadline) <= 7)
      .sort((a, b) => n(a.DaysToDeadline) - n(b.DaysToDeadline));
    return DEADLINE_GROUPS
      .map(g => ({ ...g, items: sorted.filter(r => g.test(n(r.DaysToDeadline))) }))
      .filter(g => g.items.length > 0);
  }, [board]);

  if (!prodData) {
    return (
      <div className="py-6 text-center">
        <div className="w-5 h-5 border-2 border-blue-100 border-t-blue-400 rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-gray-400">Loading deadline data…</p>
      </div>
    );
  }
  if (grouped.length === 0) {
    return <EmptyState icon={CheckCircle} title="No urgent deadlines" sub="All jobs have more than 7 days remaining" />;
  }
  return (
    <div className="space-y-3">
      {grouped.map(group => (
        <div key={group.label}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: group.color }}>
              {group.label}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold text-white leading-none"
                  style={{ backgroundColor: group.color }}>{group.items.length}</span>
          </div>
          <div className="space-y-1">
            {group.items.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-100 hover:border-gray-200 bg-white transition-colors">
                <DeadlineBadge days={n(r.DaysToDeadline)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{str(r.JobBookingNo)}</p>
                  <p className="text-xs text-gray-500 truncate">{str(r.CustomerName)} · {str(r.MachineName)}</p>
                </div>
                <StatusPill status={str(r.Status)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Bottleneck Bar ────────────────────────────────────────────────────────────
function BottleneckBar({ machines, kpi }: { machines: Row[]; kpi: Row }) {
  const items: { label: string; desc: string; color: string; sev: "crit" | "warn" }[] = [];

  machines
    .filter(m => n(m.TotalJobs) >= 15)
    .forEach(m => items.push({
      label: str(m.MachineName), desc: `${n(m.TotalJobs)} jobs queued`, color: "#EF4444", sev: "crit",
    }));

  if (n(kpi.AwaitingSchedule) >= 5)
    items.push({ label: "Schedule Release", desc: `${n(kpi.AwaitingSchedule)} jobs waiting`,  color: "#F59E0B", sev: "warn" });
  if (n(kpi.ArtworkPending) >= 3)
    items.push({ label: "Artwork",          desc: `${n(kpi.ArtworkPending)} jobs blocked`,    color: "#F97316", sev: "warn" });
  if (n(kpi.InkSPRPending) >= 3)
    items.push({ label: "Ink / SPR",        desc: `${n(kpi.InkSPRPending)} shades pending`,   color: "#EF4444", sev: "crit" });

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl border border-green-100">
        <CheckCircle size={13} className="text-green-500 shrink-0" />
        <span className="text-xs font-semibold text-green-700">No bottlenecks detected — factory flowing normally</span>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {items.map((b, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl border"
          style={{ borderColor: b.color + "40", backgroundColor: b.color + "08" }}>
          <div className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: b.color }} />
          <span className="text-xs font-bold text-gray-800 flex-1 truncate">{b.label}</span>
          <span className="text-xs text-gray-500">{b.desc}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${b.sev === "crit" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
            {b.sev === "crit" ? "CRIT" : "WARN"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Factory Pipeline ──────────────────────────────────────────────────────────
const PIPELINE_CFG = [
  { key: "Orders (No JC)",   label: "No Job Card",      icon: AlertCircle, color: "#EF4444", href: "/gravure/orders" },
  { key: "Job Cards (Open)", label: "Queued",            icon: Layers,      color: "#8B5CF6", href: "/gravure/workorder" },
  { key: "In Production",    label: "In Production",     icon: Factory,     color: "#F59E0B", href: "/gravure/production/job-production" },
  { key: "Pending Dispatch", label: "Ready to Dispatch", icon: Package,     color: "#10B981", href: "/gravure/dispatch" },
  { key: "Dispatched (7d)",  label: "Dispatched (7d)",   icon: Truck,       color: "#06B6D4", href: "/gravure/dispatch" },
];

function FactoryPipeline({ data, router, onStageClick }: {
  data: Row[]; router: ReturnType<typeof useRouter>; onStageClick?: (key: string) => void;
}) {
  const countMap = useMemo(() => {
    const m: Record<string, number> = {};
    data.forEach(r => { m[str(r.Stage)] = n(r.Count); });
    return m;
  }, [data]);

  const DRILLABLE = new Set(["Orders (No JC)", "Pending Dispatch", "In Production", "Job Cards (Open)"]);

  return (
    <div className="flex items-stretch gap-0 overflow-x-auto">
      {PIPELINE_CFG.map((stage, i) => {
        const count    = countMap[stage.key] ?? 0;
        const isAlert  = (stage.key === "Orders (No JC)" || stage.key === "Pending Dispatch") && count > 0;
        const hasDrill = DRILLABLE.has(stage.key) && !!onStageClick;
        return (
          <React.Fragment key={stage.key}>
            <button onClick={() => hasDrill ? onStageClick!(stage.key) : router.push(stage.href)}
              className={`flex-1 min-w-[100px] flex flex-col items-center p-3 rounded-xl border-2 transition-all hover:shadow-md cursor-pointer
                ${isAlert ? "border-red-200 bg-red-50/40" : "border-gray-100 bg-gray-50/40 hover:border-gray-200"}`}>
              <div className="p-2 rounded-lg mb-2" style={{ backgroundColor: stage.color + "18" }}>
                <stage.icon size={17} style={{ color: stage.color }} />
              </div>
              <p className="text-xl font-bold" style={{ color: stage.color }}>{count}</p>
              <p className="text-xs font-semibold text-gray-600 text-center leading-tight mt-0.5">{stage.label}</p>
              {hasDrill && <p className="text-xs text-gray-400 mt-0.5">↗ details</p>}
            </button>
            {i < PIPELINE_CFG.length - 1 && (
              <div className="shrink-0 flex items-center px-1">
                <ArrowRight size={15} className="text-gray-300" />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Machine Load Cards ────────────────────────────────────────────────────────
function MachineLoadCards({ data, router, onMachineClick }: {
  data: Row[]; router: ReturnType<typeof useRouter>; onMachineClick?: (name: string) => void;
}) {
  if (data.length === 0) return <EmptyState icon={Gauge} title="No active machine jobs" />;
  return (
    <div className="space-y-2.5">
      {data.map((m, i) => {
        const total   = n(m.TotalJobs);
        const running = n(m.InProgress);
        const queued  = n(m.Queued);
        const onHold  = n(m.OnHold);
        const loadPct = Math.min(100, total > 0 ? Math.round(total / 25 * 100) : 0);
        const heavy   = total >= 15;
        return (
          <div key={i} className="p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {heavy && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
                {onMachineClick ? (
                  <button onClick={() => onMachineClick(str(m.MachineName))}
                    className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 hover:underline truncate max-w-[160px] text-left">
                    {str(m.MachineName)}
                  </button>
                ) : (
                  <span className="text-sm font-semibold text-gray-800 truncate max-w-[160px]">{str(m.MachineName)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs shrink-0">
                {running > 0 && <span className="font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">▶ {running}</span>}
                <span className={`font-bold ${heavy ? "text-red-600" : "text-gray-500"}`}>{total} jobs</span>
                <button onClick={() => router.push("/gravure/workorder")}
                  className="text-gray-300 hover:text-indigo-500 transition-colors">
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: loadPct + "%", backgroundColor: heavy ? "#EF4444" : queued > 10 ? "#F59E0B" : "#3B82F6" }} />
              </div>
              <span className="text-xs text-gray-400 shrink-0">{loadPct}%</span>
            </div>
            <div className="flex gap-3 mt-1 text-xs text-gray-400">
              {queued > 0 && <span><b className="text-blue-600">{queued}</b> queued</span>}
              {onHold > 0 && <span><b className="text-purple-600">{onHold}</b> on hold</span>}
              {str(m.NextDeadline) && <span className="ml-auto">Next: {str(m.NextDeadline)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Alert Center ──────────────────────────────────────────────────────────────
type AlertFilter = "ALL" | "HIGH" | "MEDIUM";

function alertActionHref(alert: Row): string | null {
  const type = str(alert.AlertType).toLowerCase();
  const link = str(alert.LinkUrl);
  if (type.includes("overdue"))                         return "/gravure/workorder";
  if (type.includes("schedule"))                        return "/gravure/job-schedule-release";
  if (type.includes("artwork"))                         return "/gravure/artwork-management";
  if (type.includes("ink") || type.includes("spr"))     return "/gravure/ink-kitchen";
  if (type.includes("dispatch"))                        return "/gravure/dispatch";
  if (type.includes("no jc") || type.includes("no-jc")) return "/gravure/orders";
  if (type.includes("estimat"))                         return "/gravure/estimation";
  if (type.includes("order"))                           return "/gravure/orders";
  return link || null;
}

function AlertCenter({ alerts, router }: { alerts: Row[]; router: ReturnType<typeof useRouter> }) {
  const [filter, setFilter] = useState<AlertFilter>("ALL");
  const filtered = useMemo(
    () => filter === "ALL" ? alerts : alerts.filter(a => str(a.Severity) === filter),
    [alerts, filter]
  );
  const highCnt = alerts.filter(a => str(a.Severity) === "HIGH").length;
  const medCnt  = alerts.filter(a => str(a.Severity) === "MEDIUM").length;

  if (alerts.length === 0) return (
    <div className="py-8 text-center">
      <CheckCircle size={28} className="mx-auto mb-2 text-green-500" />
      <p className="text-sm font-semibold text-green-600">All systems normal</p>
      <p className="text-xs text-gray-400 mt-1">No alerts requiring attention</p>
    </div>
  );

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {([["ALL", alerts.length, "text-gray-600"], ["HIGH", highCnt, "text-red-600"], ["MEDIUM", medCnt, "text-amber-600"]] as const).map(([key, cnt, cls]) => (
          <button key={key} onClick={() => setFilter(key as AlertFilter)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${filter === key ? "bg-gray-100 text-gray-800" : "text-gray-500 hover:bg-gray-50"}`}>
            {key === "ALL" ? "All" : key === "HIGH" ? "Critical" : "Warning"}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${filter === key ? cls : "text-gray-400"}`}>{cnt}</span>
          </button>
        ))}
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {filtered.map((a, i) => {
          const isHigh = str(a.Severity) === "HIGH";
          const href   = alertActionHref(a);
          return (
            <div key={i}
              className={`flex items-start gap-3 p-3 rounded-xl border
                ${isHigh ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}>
              <AlertTriangle size={12} className={`mt-0.5 shrink-0 ${isHigh ? "text-red-500" : "text-amber-500"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700">{str(a.AlertType)}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{str(a.Description)}</p>
              </div>
              {href ? (
                <button onClick={() => router.push(href)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    isHigh ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  }`}>
                  View →
                </button>
              ) : (
                <ChevronRight size={11} className="text-gray-300 mt-0.5 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Attention Required ────────────────────────────────────────────────────────
function AttentionRequired({ kpi, router }: { kpi: Row; router: ReturnType<typeof useRouter> }) {
  const items = [
    { label: "Overdue Jobs",      value: n(kpi.OverdueJobs),     color: "#EF4444", icon: AlertTriangle, href: "/gravure/workorder" },
    { label: "Awaiting Schedule", value: n(kpi.AwaitingSchedule),color: "#F59E0B", icon: Clock,         href: "/gravure/job-schedule-release" },
    { label: "Orders Without JC", value: n(kpi.OrdersNoJobCard), color: "#8B5CF6", icon: FileText,      href: "/gravure/orders" },
    { label: "Artwork Pending",   value: n(kpi.ArtworkPending),  color: "#F97316", icon: Palette,       href: "/gravure/artwork-management" },
    { label: "Ink SPR Pending",   value: n(kpi.InkSPRPending),   color: "#EF4444", icon: Activity,      href: "/gravure/ink-kitchen" },
    { label: "Dispatch Ready",    value: n(kpi.DispatchReady),   color: "#10B981", icon: Package,       href: "/gravure/dispatch" },
  ].filter(it => it.value > 0);

  if (items.length === 0) return (
    <EmptyState icon={CheckCircle} title="Nothing requires attention" sub="All operations are on track" />
  );

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <button key={i} onClick={() => router.push(it.href)}
          className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all group">
          <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: it.color + "18" }}>
            <it.icon size={13} style={{ color: it.color }} />
          </div>
          <span className="text-sm text-gray-700 flex-1">{it.label}</span>
          <span className="text-sm font-bold" style={{ color: it.color }}>{it.value}</span>
          <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
        </button>
      ))}
    </div>
  );
}

// ── IssueFeed ─────────────────────────────────────────────────────────────────
// Unified priority-issues panel for Command Center: merges KPI alerts + backend alerts
function IssueFeed({ kpi, alerts, router, onDrillDown }: {
  kpi: Row; alerts: Row[];
  router: ReturnType<typeof useRouter>;
  onDrillDown: (t: DrillTarget) => void;
}) {
  type Issue = { level: "HIGH" | "MEDIUM"; title: string; detail: string; action: () => void };
  const issues: Issue[] = [
    ...(n(kpi.OverdueJobs)      > 0 ? [{ level: "HIGH"   as const, title: `${fmt(kpi.OverdueJobs)} jobs overdue`,           detail: "Past planned delivery date — needs immediate action", action: () => onDrillDown("overdue")   }] : []),
    ...(n(kpi.OrdersNoJobCard)  > 0 ? [{ level: "HIGH"   as const, title: `${fmt(kpi.OrdersNoJobCard)} orders without JC`,  detail: "Sales orders with no job card created yet",           action: () => onDrillDown("no-jc")     }] : []),
    ...(n(kpi.AwaitingSchedule) > 0 ? [{ level: "MEDIUM" as const, title: `${fmt(kpi.AwaitingSchedule)} awaiting schedule`, detail: "Jobs approved but not yet released to production",    action: () => onDrillDown("schedule")  }] : []),
    ...(n(kpi.ArtworkPending)   > 0 ? [{ level: "MEDIUM" as const, title: `${fmt(kpi.ArtworkPending)} artwork pending`,     detail: "Jobs with unresolved artwork colors",                 action: () => onDrillDown("artwork")   }] : []),
    ...(n(kpi.InkSPRPending)    > 0 ? [{ level: "MEDIUM" as const, title: `${fmt(kpi.InkSPRPending)} ink/SPR pending`,     detail: "Shade production requests not yet fulfilled",         action: () => onDrillDown("ink")       }] : []),
    ...alerts
      .filter(a => str(a.Severity) === "HIGH" || str(a.Severity) === "MEDIUM")
      .slice(0, 3)
      .map(a => ({
        level: (str(a.Severity) === "HIGH" ? "HIGH" : "MEDIUM") as "HIGH" | "MEDIUM",
        title: str(a.AlertType),
        detail: str(a.Description),
        action: () => { const href = str(a.LinkUrl); if (href) router.push(href); },
      })),
  ];

  if (issues.length === 0) return (
    <div className="flex items-center gap-2.5 py-6 px-4 bg-green-50/50 rounded-xl border border-green-100">
      <CheckCircle size={16} className="text-green-500 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-green-700">All systems normal</p>
        <p className="text-xs text-green-600/70 mt-0.5">No issues requiring attention right now</p>
      </div>
    </div>
  );

  return (
    <div>
      {issues.map((issue, i) => (
        <React.Fragment key={i}>
          <button onClick={issue.action}
            className="w-full flex items-start gap-3 py-2.5 px-1.5 hover:bg-gray-50 rounded-lg -mx-1.5 text-left transition-colors group">
            <span className={`mt-0.5 shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
              issue.level === "HIGH"
                ? "bg-red-100 text-red-700"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}>
              {issue.level === "HIGH" ? "CRIT" : "WARN"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{issue.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">{issue.detail}</p>
            </div>
            <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500 mt-0.5 shrink-0 transition-colors" />
          </button>
          {i < issues.length - 1 && <div className="h-px bg-gray-100 mx-1.5" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS: { key: TabKey; label: string; icon: React.ElementType; color: string }[] = [
  { key: "management",     label: "Management",     icon: LayoutDashboard, color: "#3B82F6" },
  { key: "production",     label: "Production",     icon: Factory,         color: "#10B981" },
  { key: "planning",       label: "Planning",       icon: Calendar,        color: "#8B5CF6" },
  { key: "dispatch",       label: "Dispatch",       icon: Truck,           color: "#F59E0B" },
  { key: "sales",          label: "Sales",          icon: TrendingUp,      color: "#EF4444" },
  { key: "command-center", label: "Command Center", icon: Zap,             color: "#6366F1" },
];

// ── Dashboard Sections ────────────────────────────────────────────────────────
function MgmtKpiCard({ label, value, sub, icon: Icon, iconBg, onClick }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; iconBg: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 p-4
        ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" : ""}`}>
      <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
           style={{ backgroundColor: iconBg }}>
        <Icon size={28} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 truncate">{label}</p>
        <p className="text-3xl font-bold tabular-nums text-gray-800 leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function ManagementDash({ data, loading, router }: { data: any; loading: boolean; router: ReturnType<typeof useRouter> }) {
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const kpi        = parse(data.kpi)[0] ?? {};
  const trend      = parse(data.orderTrend);
  const customers  = parse(data.topCustomers);
  const dispatches = parse(data.recentDispatches);

  const maxJobs = Math.max(1, ...customers.map((r: Row) => n(r.TotalJobs)));

  return (
    <div className="space-y-5">
      {/* KPI Cards — big icon left */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MgmtKpiCard label="Open Orders"    value={fmt(kpi.OpenOrders)}         sub="Active pipeline"        icon={BarChart2}  iconBg="#2563EB" onClick={() => router.push("/gravure/orders")} />
        <MgmtKpiCard label="Order Value"    value={fmtCr(kpi.OrderValuePeriod)} sub={cur(kpi.OrderValuePeriod)} icon={TrendingUp} iconBg="#1D4ED8" onClick={() => router.push("/gravure/orders")} />
        <MgmtKpiCard label="Active Jobs"    value={fmt(kpi.ActiveJobCards)}      sub="In spass / production"  icon={Layers}     iconBg="#4F46E5" onClick={() => router.push("/gravure/workorder")} />
        <MgmtKpiCard label="Dispatch Ready" value={fmt(kpi.DispatchReady)}       sub="Awaiting dispatch"      icon={Clock}      iconBg="#0D9488" onClick={() => router.push("/gravure/dispatch")} />
        <MgmtKpiCard label="Dispatched"     value={fmt(kpi.DispatchCount)}       sub="In period"              icon={Truck}      iconBg="#2563EB" onClick={() => router.push("/gravure/dispatch")} />
      </div>

      <Card title="Monthly Order Trend (6 Months)">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="MonthLabel" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="cnt" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="val" orientation="right" tick={{ fontSize: 10 }}
                   tickFormatter={v => "₹" + (v / 100000).toFixed(0) + "L"} />
            <Tooltip formatter={(v: any, name: any) => name === "Orders" ? v : cur(v)} />
            <Legend />
            <Bar  yAxisId="cnt" dataKey="OrderCount" name="Orders"    fill="#2563EB" radius={[4,4,0,0]} />
            <Area yAxisId="val" type="monotone" dataKey="OrderValue" name="Value (₹)" stroke="#16A34A" fill="#16A34A10" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Top Customers (by Job Count)">
          <DataTable
            data={customers}
            pageSize={10}
            columns={[
              {
                key: "CustomerName", header: "Customer",
                render: (row: Row) => {
                  const pct = Math.min(100, (n(row.TotalJobs) / maxJobs) * 100);
                  return (
                    <div>
                      <p className="text-sm text-gray-800 font-medium">{str(row.CustomerName)}</p>
                      <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden w-32">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: pct + "%" }} />
                      </div>
                    </div>
                  );
                },
              },
              { key: "TotalJobs",  header: "Total",       render: (r: Row) => <span className="font-bold text-gray-800 tabular-nums">{str(r.TotalJobs)}</span> },
              { key: "InProgress", header: "In Progress",  render: (r: Row) => <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">{str(r.InProgress)}</span> },
              { key: "Completed",  header: "Completed",    render: (r: Row) => <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">{str(r.Completed)}</span> },
              { key: "OnHold",     header: "Total",        render: (r: Row) => <span className="font-semibold tabular-nums text-gray-500">{str(r.OnHold ?? 0)}</span> },
            ]}
          />
        </Card>
        <Card title="Recent Dispatches">
          <DataTable
            data={dispatches}
            pageSize={10}
            columns={[
              { key: "VoucherNo",    header: "DN No",    render: (r: Row) => <span className="font-mono text-xs font-bold text-indigo-600">{str(r.VoucherNo)}</span> },
              { key: "VoucherDate",  header: "Date",     render: (r: Row) => <span className="text-sm text-gray-600">{str(r.VoucherDate)}</span> },
              { key: "CustomerName", header: "Customer", render: (r: Row) => <span className="text-sm text-gray-800">{str(r.CustomerName)}</span> },
              { key: "VehicleNo",    header: "Vehicle",  render: (r: Row) => <span className="text-sm text-gray-600">{str(r.VehicleNo)}</span> },
              { key: "TotalQty",     header: "Qty",      render: (r: Row) => <span className="font-semibold tabular-nums text-gray-800">{fmt(r.TotalQty)}</span> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

// ── Production Control Tower helpers ─────────────────────────────────────────
function queuePressure(queued: number): { label: string; color: string } {
  if (queued <= 4)  return { label: "LOW",      color: "#6B7280" };
  if (queued <= 9)  return { label: "MODERATE", color: "#3B82F6" };
  if (queued <= 14) return { label: "HIGH",     color: "#F59E0B" };
  return             { label: "CRITICAL",       color: "#EF4444" };
}

type MachineConsole = {
  name: string; code: string;
  running: number; queued: number; onHold: number; total: number;
  runningJob: Row | null; nextQueuedJob: Row | null;
  nextDeadlineDays: number | null;
};

function buildMachineConsoles(board: Row[]): MachineConsole[] {
  const map: Record<string, MachineConsole> = {};
  board.forEach(r => {
    const name = str(r.MachineName);
    if (!name) return;
    if (!map[name]) map[name] = {
      name, code: str(r.MachineCode),
      running: 0, queued: 0, onHold: 0, total: 0,
      runningJob: null, nextQueuedJob: null, nextDeadlineDays: null,
    };
    const m = map[name];
    m.total++;
    const status = str(r.Status);
    if (status === "In Progress") { m.running++; if (!m.runningJob) m.runningJob = r; }
    if (status === "Open") {
      m.queued++;
      const d = n(r.DaysToDeadline);
      if (m.nextDeadlineDays === null || d < m.nextDeadlineDays) {
        m.nextDeadlineDays = d;
        m.nextQueuedJob = r;
      }
    }
    if (status === "On Hold") m.onHold++;
  });
  return Object.values(map).sort((a, b) => {
    if (a.running > 0 && b.running === 0) return -1;
    if (b.running > 0 && a.running === 0) return 1;
    return a.name.localeCompare(b.name);
  });
}

function relTime(d: Date | null): string {
  if (!d) return "—";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

// ── MachineConsoleCard ────────────────────────────────────────────────────────
function MachineConsoleCard({ machine, onViewQueue, dark = false }: {
  machine: MachineConsole; onViewQueue?: (name: string) => void; dark?: boolean;
}) {
  const isRunning   = machine.running > 0;
  const isOnHold    = !isRunning && machine.onHold > 0;
  const pq          = queuePressure(machine.queued);
  const accentColor = isRunning ? "#22C55E" : isOnHold ? "#F97316" : (dark ? "#374151" : "#9CA3AF");

  if (!dark) return (
    <div className="relative overflow-hidden rounded-xl bg-white border border-gray-100 shadow-sm"
         style={{ borderLeft: `3px solid ${accentColor}` }}>

      {/* State + queue header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            isRunning ? "bg-green-500 animate-pulse" : isOnHold ? "bg-amber-400" : "bg-gray-300"
          }`} />
          <span className="text-[9px] font-bold uppercase tracking-widest"
                style={{ color: isRunning ? "#059669" : isOnHold ? "#D97706" : "#9CA3AF" }}>
            {isRunning ? "RUNNING" : isOnHold ? "ON HOLD" : "IDLE"}
          </span>
        </div>
        {machine.queued > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ color: pq.color, backgroundColor: pq.color + "18" }}>
            {pq.label} QUEUE
          </span>
        )}
      </div>

      {/* Machine name */}
      <div className="px-4 pt-2.5 pb-1">
        <h3 className="text-sm font-bold text-gray-800 leading-snug">{machine.name}</h3>
      </div>

      {/* Current / next job */}
      <div className="px-4 pb-3 pt-2 min-h-[96px] border-b border-gray-100">
        {isRunning && machine.runningJob ? (
          <>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-green-600">NOW PRINTING</p>
            <p className="font-mono text-xs font-bold text-indigo-600">
              {str(machine.runningJob.JobBookingNo)}
            </p>
            <p className="text-sm font-semibold mt-0.5 truncate text-gray-800">
              {str(machine.runningJob.CustomerName)}
            </p>
            <p className="text-xs truncate mt-0.5 text-gray-400">
              {str(machine.runningJob.JobName)}
            </p>
            <div className="mt-2">
              <DeadlineBadge days={n(machine.runningJob.DaysToDeadline)} />
            </div>
          </>
        ) : machine.nextQueuedJob ? (
          <>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-gray-400">NEXT QUEUED</p>
            <p className="font-mono text-xs font-bold text-indigo-500">
              {str(machine.nextQueuedJob.JobBookingNo)}
            </p>
            <p className="text-sm font-semibold mt-0.5 truncate text-gray-700">
              {str(machine.nextQueuedJob.CustomerName)}
            </p>
            <div className="mt-2">
              <DeadlineBadge days={n(machine.nextQueuedJob.DaysToDeadline)} />
            </div>
          </>
        ) : (
          <p className="text-sm py-7 text-center text-gray-300">No jobs assigned</p>
        )}
      </div>

      {/* Footer: counts + pressure + action */}
      <div className="px-4 py-3">
        <div className="text-[11px] mb-2.5 flex items-center gap-2 flex-wrap text-gray-400">
          {machine.running > 0 && <span className="font-semibold text-green-600">{machine.running} running</span>}
          {machine.queued  > 0 && <span className="text-blue-500">{machine.queued} queued</span>}
          {machine.onHold  > 0 && <span className="text-amber-500">{machine.onHold} on hold</span>}
          {machine.total === 0  && <span>No active jobs</span>}
        </div>

        {machine.queued > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase tracking-wide text-gray-400">Queue Pressure</span>
              <span className="text-[9px] font-bold" style={{ color: pq.color }}>
                {pq.label} · {machine.queued} jobs
              </span>
            </div>
            <div className="h-0.5 rounded-full overflow-hidden bg-gray-100">
              <div className="h-full rounded-full transition-all"
                   style={{
                     width: Math.min(100, (machine.queued / 20) * 100) + "%",
                     backgroundColor: pq.color,
                   }} />
            </div>
          </div>
        )}

        {onViewQueue && machine.total > 0 && (
          <button onClick={() => onViewQueue(machine.name)}
            className="w-full py-1.5 text-[11px] font-semibold rounded-lg transition-colors text-gray-500 border border-gray-200 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50">
            View Queue →
          </button>
        )}
      </div>
    </div>
  );

  // ── Dark variant ──────────────────────────────────────────────────────────
  const statusBadge = isRunning ? (
    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-green-400">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> RUNNING
    </span>
  ) : isOnHold ? (
    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400">⏸ ON HOLD</span>
  ) : (
    <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">IDLE</span>
  );

  return (
    <div className="relative overflow-hidden rounded-xl bg-[#131929] border border-white/[0.07]"
         style={{ borderLeft: `3px solid ${accentColor}` }}>
      {/* Header row */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {statusBadge}
        <div className="flex items-center gap-2">
          {machine.queued > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ color: pq.color, backgroundColor: pq.color + "20" }}>
              {pq.label} QUEUE
            </span>
          )}
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white/30 bg-white/[0.06]">
            {isRunning ? "RUNNING" : isOnHold ? "ON HOLD" : "IDLE"}
          </span>
        </div>
      </div>

      {/* Machine name */}
      <div className="px-4 pt-3 pb-1">
        <h3 className="text-sm font-bold text-white leading-snug">{machine.name}</h3>
      </div>

      {/* Job detail */}
      <div className="px-4 pb-3 pt-1.5 min-h-[96px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {isRunning && machine.runningJob ? (
          <>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-green-400/60">NOW PRINTING</p>
            <p className="font-mono text-xs font-bold text-indigo-300">{str(machine.runningJob.JobBookingNo)}</p>
            <p className="text-sm font-semibold mt-0.5 truncate text-white/85">{str(machine.runningJob.CustomerName)}</p>
            <p className="text-xs truncate mt-0.5 text-white/35">{str(machine.runningJob.JobName)}</p>
            <div className="mt-2"><DeadlineBadge days={n(machine.runningJob.DaysToDeadline)} /></div>
          </>
        ) : machine.nextQueuedJob ? (
          <>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-white/22">NEXT QUEUED</p>
            <p className="font-mono text-xs font-bold text-indigo-300">{str(machine.nextQueuedJob.JobBookingNo)}</p>
            <p className="text-sm font-semibold mt-0.5 truncate text-white/72">{str(machine.nextQueuedJob.CustomerName)}</p>
            <div className="mt-2"><DeadlineBadge days={n(machine.nextQueuedJob.DaysToDeadline)} /></div>
          </>
        ) : (
          <p className="text-sm py-7 text-center text-white/18">No jobs assigned</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3">
        <div className="text-[11px] mb-2.5 flex items-center gap-2 flex-wrap" style={{ color: "rgba(255,255,255,0.35)" }}>
          {machine.running > 0 && <span className="font-semibold text-green-400">{machine.running} running</span>}
          {machine.queued  > 0 && <span style={{ color: "#93C5FD" }}>{machine.queued} queued</span>}
          {machine.onHold  > 0 && <span style={{ color: "#FCD34D" }}>{machine.onHold} on hold</span>}
          {machine.total === 0  && <span>No active jobs</span>}
        </div>
        {machine.queued > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase tracking-wide text-white/22">Queue Pressure</span>
              <span className="text-[9px] font-bold" style={{ color: pq.color }}>{pq.label} · {machine.queued} jobs</span>
            </div>
            <div className="h-0.5 rounded-full overflow-hidden bg-white/[0.08]">
              <div className="h-full rounded-full transition-all"
                   style={{ width: Math.min(100, (machine.queued / 20) * 100) + "%", backgroundColor: pq.color }} />
            </div>
          </div>
        )}
        {onViewQueue && machine.total > 0 && (
          <button onClick={() => onViewQueue(machine.name)}
            className="w-full py-1.5 text-[11px] font-semibold rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.08)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.72)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.40)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
            View Queue →
          </button>
        )}
      </div>
    </div>
  );
}

// ── ProductionHeroBand ────────────────────────────────────────────────────────
function ProductionHeroBand({ machineCount, runningCount, totalQueue, lastUpdated, loading, focusMode, onRefresh, onToggleFocus, onToggleFullscreen }: {
  machineCount: number; runningCount: number; totalQueue: number;
  lastUpdated: Date | null; loading: boolean; focusMode: boolean;
  onRefresh: () => void; onToggleFocus: () => void; onToggleFullscreen: () => void;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-5 py-3 flex items-center gap-4 shadow-sm">
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-bold text-gray-900">Production Control Tower</h2>
        <p className="text-xs text-gray-400 mt-0.5">Live factory floor &amp; job execution</p>
      </div>
      <div className="flex items-center gap-6 shrink-0">
        {[
          { label: "MACHINES", value: machineCount, color: "#374151" },
          { label: "RUNNING",  value: runningCount, color: runningCount > 0 ? "#16A34A" : "#D1D5DB" },
          { label: "QUEUED",   value: totalQueue,   color: totalQueue > 0   ? "#2563EB" : "#D1D5DB" },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className="text-xl font-bold tabular-nums leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0 pl-4 border-l border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mr-1">
          <span className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-green-400"}`} />
          {loading ? "Refreshing…" : lastUpdated ? relTime(lastUpdated) : "Live"}
        </div>
        <button onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
        <button onClick={onToggleFocus}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
            focusMode
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}>
          {focusMode ? "Exit Focus" : "Focus"}
        </button>
        <button onClick={onToggleFullscreen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          <Maximize2 size={10} />
          Full Screen
        </button>
      </div>
    </div>
  );
}

// ── ProductionPulseStrip ──────────────────────────────────────────────────────
function ProductionPulseStrip({ runningJobs, queuedJobs, overdueCount, dueTodayCount, onHoldCount, inkBlockCount, onDrillDown }: {
  runningJobs: number; queuedJobs: number; overdueCount: number;
  dueTodayCount: number; onHoldCount: number; inkBlockCount: number;
  onDrillDown: (t: DrillTarget) => void;
}) {
  const tiles = [
    { key: "running",  label: "RUNNING",   value: runningJobs,   color: "#22C55E", sub: "Live",   alert: false, icon: Activity, action: undefined as (() => void) | undefined },
    { key: "queued",   label: "QUEUED",    value: queuedJobs,    color: "#3B82F6", sub: "Total",  alert: false, icon: Layers,   action: undefined as (() => void) | undefined },
    { key: "overdue",  label: "OVERDUE",   value: overdueCount,  color: "#EF4444", sub: "Risk",   alert: true,  icon: AlertTriangle, action: () => onDrillDown("overdue") },
    { key: "today",    label: "DUE TODAY", value: dueTodayCount, color: "#F59E0B", sub: "Today",  alert: true,  icon: Calendar, action: () => onDrillDown("overdue") },
    { key: "hold",     label: "ON HOLD",   value: onHoldCount,   color: "#F97316", sub: "Paused", alert: false, icon: Pause,    action: undefined as (() => void) | undefined },
    { key: "ink",      label: "INK BLOCK", value: inkBlockCount, color: "#EF4444", sub: "Action", alert: true,  icon: Droplet,  action: () => onDrillDown("ink") },
  ];
  return (
    <div className="grid grid-cols-6 gap-3">
      {tiles.map(t => {
        const empty = t.value === 0;
        const col   = empty ? "#D1D5DB" : t.color;
        const Icon  = t.icon;
        return (
          <button key={t.key}
            onClick={t.action}
            disabled={!t.action}
            className={`bg-white border rounded-xl px-3 py-4 flex flex-col items-center gap-1.5 shadow-sm transition-all
              ${t.action ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "cursor-default"}
              ${t.alert && !empty ? "border-red-100 bg-red-50/30" : "border-gray-100"}`}>
            <Icon size={16} style={{ color: col }} />
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{t.label}</span>
            <span className="text-5xl font-bold tabular-nums leading-none" style={{ color: col }}>
              {String(t.value).padStart(2, "0")}
            </span>
            <span className="text-[9px] text-gray-400">{t.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── FactoryFloorSection ───────────────────────────────────────────────────────
type FloorFilter = "all" | "running" | "idle" | "attention";

function FactoryFloorSection({ consoles, filter, onFilterChange, onViewQueue }: {
  consoles: MachineConsole[];
  filter: FloorFilter;
  onFilterChange: (f: FloorFilter) => void;
  onViewQueue: (name: string) => void;
}) {
  const runningCount = consoles.filter(m => m.running > 0).length;
  const filtered = consoles.filter(m => {
    if (filter === "running")   return m.running > 0;
    if (filter === "idle")      return m.running === 0 && m.onHold === 0;
    if (filter === "attention") {
      const pqLabel = queuePressure(m.queued).label;
      return m.running === 0 || pqLabel === "CRITICAL" || pqLabel === "HIGH";
    }
    return true;
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Factory Floor</span>
          <span className="text-xs">
            <span className="font-bold" style={{ color: "#16A34A" }}>{runningCount}</span>
            <span className="text-gray-400"> / {consoles.length} running</span>
          </span>
        </div>
        <div className="flex items-center gap-1 bg-gray-100/70 rounded-lg p-0.5">
          {(["all", "running", "idle", "attention"] as const).map(f => (
            <button key={f} onClick={() => onFilterChange(f)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold capitalize transition-colors
                ${filter === f ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {f === "attention" ? "Attention" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={Factory} title="No machines match this filter" />
      ) : (
        <div className={`grid gap-4 ${filtered.length === 1 ? "grid-cols-1 max-w-lg" : "grid-cols-1 xl:grid-cols-2"}`}>
          {filtered.map(m => <MachineConsoleCard key={m.name} machine={m} onViewQueue={onViewQueue} />)}
        </div>
      )}
    </div>
  );
}

// ── NeedsAttentionFeed ────────────────────────────────────────────────────────
type AttentionItem = {
  level: "CRITICAL" | "HIGH" | "MEDIUM";
  title: string; detail: string; color: string;
  href?: string; actionLabel?: string;
};

function buildAttentionItems(overdue: Row[], consoles: MachineConsole[], inkCount: number): AttentionItem[] {
  const items: AttentionItem[] = [];
  [...overdue]
    .sort((a, b) => n(b.DaysOverdue) - n(a.DaysOverdue))
    .slice(0, 4)
    .forEach(r => {
      const d = n(r.DaysOverdue);
      items.push({
        level: d > 30 ? "CRITICAL" : d > 14 ? "HIGH" : "MEDIUM",
        title: `${str(r.JobBookingNo)} — ${d}d overdue`,
        detail: `${str(r.CustomerName)} · ${str(r.MachineName)}`,
        color: d > 30 ? "#DC2626" : "#EF4444",
        href: "/gravure/workorder", actionLabel: "Open Job →",
      });
    });
  consoles.forEach(m => {
    if (queuePressure(m.queued).label === "CRITICAL") {
      items.push({
        level: "HIGH",
        title: `${m.name} — ${m.queued} queued jobs`,
        detail: "Critical queue pressure — machine overloaded",
        color: "#EF4444",
        href: "/gravure/workorder", actionLabel: "View Queue →",
      });
    }
  });
  if (inkCount > 0) {
    items.push({
      level: inkCount >= 5 ? "HIGH" : "MEDIUM",
      title: `${inkCount} ink/SPR ${inkCount === 1 ? "shade" : "shades"} pending`,
      detail: "Ink not ready — production may be blocked",
      color: inkCount >= 5 ? "#EF4444" : "#F97316",
      href: "/gravure/ink-kitchen", actionLabel: "View Ink →",
    });
  }
  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
  return items.sort((a, b) => order[a.level] - order[b.level]);
}

function NeedsAttentionFeed({ items, router }: {
  items: AttentionItem[]; router: ReturnType<typeof useRouter>;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <div className="flex items-start gap-2.5 py-3 hover:bg-gray-50/60 rounded-lg transition-colors px-1 -mx-1">
            <span className="mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap"
                  style={{ color: item.color, backgroundColor: item.color + "18" }}>
              {item.level}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 leading-tight">{item.title}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{item.detail}</p>
            </div>
            {item.href && item.actionLabel && (
              <button onClick={() => router.push(item.href!)}
                className="shrink-0 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap mt-0.5 transition-colors">
                {item.actionLabel}
              </button>
            )}
          </div>
          {i < items.length - 1 && <div className="h-px bg-gray-100 mx-1" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── NeedsAttentionPanel (light right sidebar) ─────────────────────────────────
function NeedsAttentionPanel({ attnItems, router, board, overdue }: {
  attnItems: AttentionItem[]; router: ReturnType<typeof useRouter>;
  board: Row[]; overdue: Row[];
}) {
  const dueToday = board.filter(r => n(r.DaysToDeadline) === 0);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-100">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Needs Attention</span>
        {attnItems.length > 0 && (
          <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
            {attnItems.length} {attnItems.length === 1 ? "issue" : "issues"}
          </span>
        )}
      </div>
      {/* TODAY summary */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">TODAY</p>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-gray-800 tabular-nums">{dueToday.length}
            <span className="text-gray-400 font-normal text-xs ml-1">due today</span>
          </span>
          <span className="text-sm font-bold text-red-600 tabular-nums">{overdue.length}
            <span className="text-gray-400 font-normal text-xs ml-1">overdue</span>
          </span>
        </div>
      </div>
      {/* Items */}
      <div className="px-4 py-2 max-h-[500px] overflow-y-auto">
        {attnItems.length === 0 ? (
          <div className="flex items-center gap-2.5 py-4">
            <CheckCircle size={14} className="text-green-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-green-700">No critical issues</p>
              <p className="text-[10px] text-gray-400 mt-0.5">All within normal parameters</p>
            </div>
          </div>
        ) : (
          <NeedsAttentionFeed items={attnItems} router={router} />
        )}
      </div>
    </div>
  );
}

// ── TodaySection ──────────────────────────────────────────────────────────────
function TodaySection({ board, overdue, router }: {
  board: Row[]; overdue: Row[]; router: ReturnType<typeof useRouter>;
}) {
  const dueToday        = board.filter(r => n(r.DaysToDeadline) === 0);
  const dueTodayRunning = dueToday.filter(r => str(r.Status) === "In Progress").length;
  const STATUS_DOT: Record<string, string> = {
    "In Progress": "#10B981", "Open": "#3B82F6", "On Hold": "#F97316",
  };
  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <span className="text-xs font-semibold px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-lg">
          {dueToday.length} due today
        </span>
        {dueTodayRunning > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 bg-green-50 text-green-700 border border-green-100 rounded-lg">
            {dueTodayRunning} running
          </span>
        )}
        <span className="text-xs font-semibold px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-100 rounded-lg">
          {overdue.length} overdue
        </span>
      </div>
      {dueToday.length === 0 ? (
        <EmptyState icon={CheckCircle} title="No jobs due today" sub="Check the job board for upcoming deadlines" />
      ) : (
        <div>
          {dueToday.map((r, i) => {
            const status = str(r.Status);
            return (
              <React.Fragment key={i}>
                <div className="flex items-center gap-3 py-2.5 px-1 hover:bg-gray-50/60 rounded-lg -mx-1 transition-colors">
                  <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: STATUS_DOT[status] ?? "#6B7280" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold font-mono text-indigo-700">{str(r.JobBookingNo)}</p>
                    <p className="text-xs text-gray-500 truncate">{str(r.CustomerName)}</p>
                  </div>
                  <StatusPill status={status} />
                </div>
                {i < dueToday.length - 1 && <div className="h-px bg-gray-100 mx-1" />}
              </React.Fragment>
            );
          })}
          <button onClick={() => router.push("/gravure/workorder")}
            className="w-full text-center text-xs text-indigo-500 hover:text-indigo-700 font-semibold pt-2.5 mt-1 transition-colors">
            View all jobs →
          </button>
        </div>
      )}
    </div>
  );
}

// ── ProductionControlTower ────────────────────────────────────────────────────
function ProductionControlTower({
  data, loading, router, lastUpdated, onDrillDown, onOpenDrawer, onRefresh, ccData,
}: {
  data: any; loading: boolean; router: ReturnType<typeof useRouter>;
  lastUpdated: Date | null; onDrillDown: (t: DrillTarget) => void;
  onOpenDrawer: (cfg: DrawerConfig) => void; onRefresh: () => void;
  ccData?: any;
}) {
  const [floorFilter, setFloorFilter] = useState<FloorFilter>("all");
  const [focusMode,   setFocusMode]   = useState(false);
  const [fullscreen,  setFullscreen]  = useState(false);

  const board   = useMemo(() => parse(data?.machineJobBoard ?? []), [data]);
  const overdue = useMemo(() => parse(data?.overdueJobs ?? []),     [data]);
  const ink     = useMemo(() => parse(data?.pendingInk ?? []),      [data]);
  const ccKpi   = useMemo(() => ccData ? (parse(ccData.kpi)[0] ?? {}) : {}, [ccData]);

  const consoles      = useMemo(() => buildMachineConsoles(board), [board]);
  const runningJobs   = useMemo(() => board.filter(r => str(r.Status) === "In Progress").length, [board]);
  const queuedJobs    = useMemo(() => board.filter(r => str(r.Status) === "Open").length, [board]);
  const onHoldJobs    = useMemo(() => board.filter(r => str(r.Status) === "On Hold").length, [board]);
  const dueTodayCount = useMemo(() => board.filter(r => n(r.DaysToDeadline) === 0).length, [board]);
  const attnItems     = useMemo(() => buildAttentionItems(overdue, consoles, ink.length), [overdue, consoles, ink]);

  function openMachineQueueDrawer(machineName: string) {
    const jobs = [...board.filter(r => str(r.MachineName) === machineName)]
      .sort((a, b) => {
        const ap = str(a.Status) === "In Progress" ? 0 : 1;
        const bp = str(b.Status) === "In Progress" ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return n(a.DaysToDeadline) - n(b.DaysToDeadline);
      });
    const mc = consoles.find(c => c.name === machineName);
    onOpenDrawer({
      title: `Machine: ${machineName}`,
      subtitle: mc ? `${mc.total} total · ${mc.running} running · ${mc.queued} queued` : undefined,
      rows: jobs,
      cols: [
        { key: "JobBookingNo",   label: "Job #",    render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
        { key: "CustomerName",   label: "Customer" },
        { key: "JobName",        label: "Job Name" },
        { key: "Status",         label: "Status",   render: v => <StatusPill status={str(v)} /> },
        { key: "DaysToDeadline", label: "Deadline", render: (v, r) => <span className="text-xs whitespace-nowrap">{str(r.PlannedDate)} <DeadlineBadge days={n(v)} /></span> },
      ],
    });
  }

  if (loading && !data) return <Spinner />;
  if (!data) return null;

  return (
    <>
      {fullscreen && (
        <FullScreenProduction
          consoles={consoles} board={board} overdue={overdue} ink={ink}
          attnItems={attnItems} loading={loading} lastUpdated={lastUpdated}
          onExit={() => setFullscreen(false)}
        />
      )}

      <div className="space-y-4">
        {/* 1. Hero Band */}
        <ProductionHeroBand
          machineCount={consoles.length}
          runningCount={consoles.filter(c => c.running > 0).length}
          totalQueue={queuedJobs}
          lastUpdated={lastUpdated}
          loading={loading}
          focusMode={focusMode}
          onRefresh={onRefresh}
          onToggleFocus={() => setFocusMode(f => !f)}
          onToggleFullscreen={() => setFullscreen(true)}
        />

        {/* 2. Pulse Strip (KPI tiles) */}
        <ProductionPulseStrip
          runningJobs={runningJobs}
          queuedJobs={queuedJobs}
          overdueCount={overdue.length}
          dueTodayCount={dueTodayCount}
          onHoldCount={onHoldJobs}
          inkBlockCount={ink.length}
          onDrillDown={onDrillDown}
        />

        {/* 3. Two-column layout: main left + Needs Attention right */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-4 min-w-0">
            {/* 3a. Factory Floor */}
            <FactoryFloorSection
              consoles={consoles}
              filter={floorFilter}
              onFilterChange={setFloorFilter}
              onViewQueue={openMachineQueueDrawer}
            />

            {/* 3b–d. Blockers, Comparison, Job Board — hidden in Focus Mode */}
            {!focusMode && (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Production Blockers</p>
                    <ProductionBlockers ink={ink} ccKpi={ccKpi} router={router} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Machine Comparison</p>
                    <MachineComparisonTable consoles={consoles} onViewQueue={openMachineQueueDrawer} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Job Board</p>
                    <span className="text-xs text-gray-400">{board.length} active jobs</span>
                  </div>
                  <EnhancedJobBoard board={board} router={router} />
                </div>
              </>
            )}
          </div>

          {/* ── RIGHT COLUMN: Needs Attention ── */}
          <div className="xl:sticky xl:top-4">
            <NeedsAttentionPanel
              attnItems={attnItems}
              router={router}
              board={board}
              overdue={overdue}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ── ProductionBlockers ────────────────────────────────────────────────────────
function ProductionBlockers({ ink, ccKpi, router }: {
  ink: Row[]; ccKpi: Row; router: ReturnType<typeof useRouter>;
}) {
  const items = [
    { label: "Awaiting Schedule", count: n(ccKpi.AwaitingSchedule), color: "#D97706", href: "/gravure/job-schedule-release" },
    { label: "Artwork Pending",   count: n(ccKpi.ArtworkPending),   color: "#D97706", href: "/gravure/artwork-management" },
    { label: "Ink / SPR",         count: ink.length,                 color: "#DC2626", href: "/gravure/ink-kitchen" },
  ];
  const maxCount = Math.max(...items.map(i => i.count), 1);
  const inkCount = ink.length;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
      <div className="flex gap-4">
        {/* Bar rows */}
        <div className="flex-1 space-y-3.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-32 shrink-0">{item.label}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                     style={{
                       width: item.count > 0 ? `${Math.max(6, Math.round((item.count / maxCount) * 100))}%` : "0%",
                       backgroundColor: item.color,
                     }} />
              </div>
              <button onClick={() => router.push(item.href)}
                className="text-xs font-bold w-12 text-right shrink-0 hover:underline transition-colors"
                style={{ color: item.count > 0 ? item.color : "#D1D5DB" }}>
                {item.count > 0 ? `${item.count}` : "—"}
              </button>
            </div>
          ))}
          {items.every(i => i.count === 0) && (
            <p className="text-xs text-gray-400 text-center pt-1">No active blockers</p>
          )}
        </div>

        {/* Ink Blocked info box */}
        {inkCount > 0 && (
          <button onClick={() => router.push("/gravure/ink-kitchen")}
            className="shrink-0 flex flex-col items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">
            <Droplet size={20} className="text-red-500" />
            <p className="text-[10px] font-bold text-red-600 whitespace-nowrap">Ink Blocked</p>
            <p className="text-sm font-bold text-red-600 tabular-nums">({inkCount} jobs)</p>
          </button>
        )}
      </div>
    </div>
  );
}

// ── MachineComparisonTable ────────────────────────────────────────────────────
function MachineComparisonTable({ consoles, onViewQueue }: {
  consoles: MachineConsole[];
  onViewQueue: (name: string) => void;
}) {
  if (consoles.length === 0) return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
      <EmptyState icon={Factory} title="No machine data" />
    </div>
  );
  const pressureColors: Record<string, { text: string; bg: string }> = {
    "LOW":      { text: "#6B7280", bg: "#F3F4F6" },
    "MODERATE": { text: "#2563EB", bg: "#EFF6FF" },
    "HIGH":     { text: "#D97706", bg: "#FFFBEB" },
    "CRITICAL": { text: "#DC2626", bg: "#FEF2F2" },
  };
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {["Machine", "State", "Run", "Queue", "Hold", "Pressure"].map(h => (
                <th key={h} className="py-2 px-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide first:pl-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {consoles.map((m, i) => {
              const pq   = queuePressure(m.queued);
              const pClr = pressureColors[pq.label] ?? pressureColors["LOW"];
              const isRunning = m.running > 0;
              return (
                <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="py-2.5 pl-4 pr-3">
                    <button onClick={() => onViewQueue(m.name)}
                      className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline text-left">
                      {m.name}
                    </button>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-[10px] font-bold ${
                      isRunning ? "text-green-600" : m.onHold > 0 ? "text-amber-600" : "text-gray-400"
                    }`}>
                      {isRunning ? "RUNNING" : m.onHold > 0 ? "ON HOLD" : "IDLE"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 tabular-nums font-semibold" style={{ color: m.running > 0 ? "#16A34A" : "#D1D5DB" }}>{m.running}</td>
                  <td className="py-2.5 px-3 tabular-nums font-semibold" style={{ color: m.queued > 0  ? "#2563EB" : "#D1D5DB" }}>{m.queued}</td>
                  <td className="py-2.5 px-3 tabular-nums"               style={{ color: m.onHold > 0  ? "#D97706" : "#D1D5DB" }}>{m.onHold}</td>
                  <td className="py-2.5 px-3">
                    {m.queued > 0
                      ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                               style={{ color: pClr.text, backgroundColor: pClr.bg }}>{pq.label}</span>
                      : <span className="text-gray-300 text-[10px]">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── EnhancedJobBoard ──────────────────────────────────────────────────────────
type JobFilter = "all" | "running" | "queued" | "today" | "overdue" | "hold";

function EnhancedJobBoard({ board, router }: {
  board: Row[]; router: ReturnType<typeof useRouter>;
}) {
  const [jobFilter, setJobFilter] = useState<JobFilter>("all");

  const counts = useMemo(() => ({
    all:     board.length,
    running: board.filter(r => str(r.Status) === "In Progress").length,
    queued:  board.filter(r => str(r.Status) === "Open").length,
    today:   board.filter(r => n(r.DaysToDeadline) === 0).length,
    overdue: board.filter(r => n(r.DaysToDeadline) < 0).length,
    hold:    board.filter(r => str(r.Status) === "On Hold").length,
  }), [board]);

  const filtered = useMemo(() => {
    const sorted = [...board].sort((a, b) => {
      const ap = str(a.Status) === "In Progress" ? 0 : 1;
      const bp = str(b.Status) === "In Progress" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return n(a.DaysToDeadline) - n(b.DaysToDeadline);
    });
    switch (jobFilter) {
      case "running": return sorted.filter(r => str(r.Status) === "In Progress");
      case "queued":  return sorted.filter(r => str(r.Status) === "Open");
      case "today":   return sorted.filter(r => n(r.DaysToDeadline) === 0);
      case "overdue": return sorted.filter(r => n(r.DaysToDeadline) < 0);
      case "hold":    return sorted.filter(r => str(r.Status) === "On Hold");
      default:        return sorted;
    }
  }, [board, jobFilter]);

  const CHIPS: Array<{ key: JobFilter; label: string; count: number; alert?: boolean }> = [
    { key: "all",     label: "All",       count: counts.all },
    { key: "running", label: "Running",   count: counts.running },
    { key: "queued",  label: "Queued",    count: counts.queued },
    { key: "today",   label: "Due Today", count: counts.today,   alert: counts.today > 0 },
    { key: "overdue", label: "Overdue",   count: counts.overdue, alert: counts.overdue > 0 },
    { key: "hold",    label: "On Hold",   count: counts.hold },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
      <div className="px-4 pt-4 pb-3 flex gap-1.5 flex-wrap border-b border-gray-50">
        {CHIPS.map(chip => (
          <button key={chip.key}
            onClick={() => setJobFilter(chip.key)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap
              ${jobFilter === chip.key
                ? chip.alert ? "bg-red-600 text-white" : "bg-gray-800 text-white"
                : chip.alert && chip.count > 0
                  ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
            {chip.label}{chip.count > 0 ? ` (${chip.count})` : ""}
          </button>
        ))}
      </div>
      <div className="p-4">
        {filtered.length === 0
          ? <EmptyState icon={CheckCircle} title={`No ${jobFilter === "all" ? "active" : jobFilter} jobs`} />
          : <TBL rows={filtered} cols={[
              { key: "JobBookingNo",   label: "Job #",    render: v => <JobLink no={str(v)} router={router} /> },
              { key: "CustomerName",   label: "Customer" },
              { key: "MachineName",    label: "Machine",  render: v => <span className="text-xs font-medium text-gray-600">{str(v)}</span> },
              { key: "Status",         label: "Status",   render: v => <StatusPill status={str(v)} /> },
              { key: "DaysToDeadline", label: "Deadline", render: (v, r) => (
                <span className="text-xs whitespace-nowrap">{str(r.PlannedDate)} <DeadlineBadge days={n(v)} /></span>
              )},
            ]} />
        }
      </div>
    </div>
  );
}

// ── FullScreenProduction ──────────────────────────────────────────────────────
function FullScreenProduction({ consoles, board, overdue, ink, attnItems, loading, lastUpdated, onExit }: {
  consoles: MachineConsole[]; board: Row[]; overdue: Row[]; ink: Row[];
  attnItems: AttentionItem[]; loading: boolean; lastUpdated: Date | null;
  onExit: () => void;
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onExit(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onExit]);

  const runningCount = consoles.filter(c => c.running > 0).length;
  const queuedCount  = board.filter(r => str(r.Status) === "Open").length;
  const dueToday     = board.filter(r => n(r.DaysToDeadline) === 0);

  const METRICS = [
    { label: "MACHINES",  value: consoles.length, clr: "text-white/70" },
    { label: "RUNNING",   value: runningCount,    clr: runningCount > 0   ? "text-green-400"  : "text-white/25" },
    { label: "QUEUED",    value: queuedCount,     clr: queuedCount > 0    ? "text-blue-400"   : "text-white/25" },
    { label: "OVERDUE",   value: overdue.length,  clr: overdue.length > 0 ? "text-red-400"    : "text-white/25" },
    { label: "DUE TODAY", value: dueToday.length, clr: dueToday.length > 0 ? "text-amber-400" : "text-white/25" },
    { label: "INK BLOCK", value: ink.length,      clr: ink.length > 0     ? "text-red-400"    : "text-white/25" },
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-3.5 border-b border-white/[0.07] shrink-0">
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight uppercase">Production Control Tower</h1>
          <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-widest">AJ Shrink Industries — Gravure Division</p>
        </div>
        <div className="flex items-center gap-6">
          <span className={`flex items-center gap-1.5 text-xs ${loading ? "text-amber-400" : "text-green-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-green-400"}`} />
            {loading ? "Refreshing" : lastUpdated ? relTime(lastUpdated) : "LIVE"}
          </span>
          <div className="text-right">
            <p className="text-xl font-bold text-white tabular-nums tracking-tight">
              {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-[9px] text-white/30 uppercase tracking-widest">
              {now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </p>
          </div>
          <button onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-xs font-semibold text-white/50 hover:text-white hover:border-white/40 transition-colors">
            <Minimize2 size={11} />
            Exit (Esc)
          </button>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="flex shrink-0 divide-x divide-white/[0.06] border-b border-white/[0.07]">
        {METRICS.map(m => (
          <div key={m.label} className="flex-1 py-4 text-center">
            <p className={`text-3xl font-bold tabular-nums ${m.clr}`}>{m.value}</p>
            <p className="text-[9px] text-white/30 uppercase tracking-widest mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Factory Floor */}
        <div className="flex-[3] p-6 overflow-y-auto border-r border-white/[0.07] min-h-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-5">Factory Floor</p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {consoles.map(m => <MachineConsoleCard key={m.name} machine={m} />)}
          </div>
        </div>
        {/* Right panel */}
        <div className="flex-[2] flex flex-col min-h-0">
          <div className="flex-1 p-6 overflow-y-auto border-b border-white/[0.07] min-h-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-4">
              Needs Attention{attnItems.length > 0 && <span className="text-red-400 ml-1">({attnItems.length})</span>}
            </p>
            {attnItems.length === 0
              ? <div className="flex items-center gap-2 text-green-400/80 text-sm"><CheckCircle size={14} /><span>No critical issues</span></div>
              : attnItems.map((item, i) => (
                <div key={i} className="mb-3">
                  <p className="text-sm font-semibold" style={{ color: item.color }}>{item.title}</p>
                  <p className="text-xs text-white/35 mt-0.5">{item.detail}</p>
                </div>
              ))
            }
          </div>
          <div className="flex-1 p-6 overflow-y-auto min-h-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-4">
              Due Today — {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }).toUpperCase()}
            </p>
            {dueToday.length === 0
              ? <p className="text-sm text-white/20">No jobs due today</p>
              : dueToday.map((r, i) => (
                <div key={i} className="flex items-center gap-2.5 mb-2.5">
                  <span className="font-mono text-xs font-bold text-indigo-300">{str(r.JobBookingNo)}</span>
                  <span className="text-xs text-white/40 flex-1 truncate">{str(r.CustomerName)}</span>
                  <StatusPill status={str(r.Status)} />
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── (Legacy) ProductionDash ───────────────────────────────────────────────────
function ProductionDash({ data, loading, router }: { data: any; loading: boolean; router: ReturnType<typeof useRouter> }) {
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const statuses = parse(data.jobStatusDistribution);
  const board    = parse(data.machineJobBoard);
  const overdue  = parse(data.overdueJobs);
  const ink      = parse(data.pendingInk);
  const total    = statuses.reduce((s, r) => s + n(r.Count), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Job Status Distribution">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="45%" height={190}>
              <PieChart>
                <Pie data={statuses} dataKey="Count" nameKey="Status" cx="50%" cy="50%" outerRadius={80} innerRadius={48}>
                  {statuses.map((r, i) => <Cell key={i} fill={STATUS_CLR[str(r.Status)] ?? CLR[i % CLR.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {statuses.map((r, i) => {
                const color = STATUS_CLR[str(r.Status)] ?? CLR[i % CLR.length];
                const pct = total ? Math.round(n(r.Count) / total * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm text-gray-600 flex-1">{str(r.Status)}</span>
                    <span className="font-bold text-sm" style={{ color }}>{str(r.Count)}</span>
                    <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
              <div className="pt-1 border-t border-gray-100 flex justify-between">
                <span className="text-xs text-gray-400">Total Active</span>
                <span className="font-bold text-sm text-gray-700">{total}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card title={`Overdue Jobs (${overdue.length})`} action={
          <button onClick={() => router.push("/gravure/workorder")} className="text-xs text-red-500 hover:text-red-700 font-semibold">View all →</button>
        }>
          {overdue.length === 0
            ? <EmptyState icon={CheckCircle} title="No overdue jobs" sub="All jobs are on track" />
            : <TBL rows={overdue} cols={[
                { key: "JobBookingNo", label: "Job #",    render: v => <JobLink no={str(v)} router={router} /> },
                { key: "CustomerName", label: "Customer" },
                { key: "MachineName",  label: "Machine" },
                { key: "Status",       label: "Status",  render: v => <StatusPill status={str(v)} /> },
                { key: "DaysOverdue",  label: "Overdue", render: v => <OverdueBadge days={n(v)} /> },
              ]} />
          }
        </Card>
      </div>

      <Card title="Machine Job Board — Active Jobs">
        <TBL rows={board} cols={[
          { key: "MachineName",    label: "Machine",  render: v => <span className="font-semibold text-indigo-700 text-xs">{str(v)}</span> },
          { key: "JobBookingNo",   label: "Job #",    render: v => <JobLink no={str(v)} router={router} /> },
          { key: "CustomerName",   label: "Customer" },
          { key: "JobName",        label: "Job Name" },
          { key: "Status",         label: "Status",   render: v => <StatusPill status={str(v)} /> },
          { key: "NoOfColors",     label: "Colors" },
          { key: "OrderQty",       label: "Qty",      render: (v, r) => `${fmt(v)} ${str(r.Unit)}` },
          { key: "DaysToDeadline", label: "Deadline", render: (v, r) => (
            <span className="text-xs whitespace-nowrap">{str(r.PlannedDate)} <DeadlineBadge days={n(v)} /></span>
          )},
        ]} />
      </Card>

      <Card title="Pending Ink / SPR">
        <TBL rows={ink} cols={[
          { key: "SPRNo",        label: "SPR No",   render: v => <span className="font-mono text-xs font-bold">{str(v)}</span> },
          { key: "ShadeName",    label: "Shade" },
          { key: "JobNo",        label: "Job #",    render: v => <JobLink no={str(v)} router={router} /> },
          { key: "CustomerName", label: "Customer" },
          { key: "RequiredQty",  label: "Qty (kg)", render: v => fmt(v) },
          { key: "RequiredDate", label: "Required" },
          { key: "DaysOverdue",  label: "Status",   render: v => n(v) > 0 ? <OverdueBadge days={n(v)} /> : <span className="text-green-600 text-xs font-semibold">On time</span> },
        ]} />
      </Card>
    </div>
  );
}

// ── Planning KPI gradient card ─────────────────────────────────────────────────
function PlanningKpiCard({ label, value, sub, gradient, icon: Icon, onClick }: {
  label: string; value: number; sub: string;
  gradient: string; icon: React.ElementType; onClick: () => void;
}) {
  return (
    <div onClick={onClick}
      className={`${gradient} rounded-xl px-5 py-4 cursor-pointer relative overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all min-h-[120px] flex flex-col justify-between`}>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/65">{label}</p>
        <p className="text-[52px] font-bold text-white tabular-nums leading-none mt-1.5">{value}</p>
      </div>
      <p className="text-xs text-white/50 leading-snug">{sub}</p>
      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
        <Icon size={90} className="text-white/12" strokeWidth={1.5} />
      </div>
    </div>
  );
}

// ── Customer avatar (initial-based) ───────────────────────────────────────────
function CustAvatar({ name }: { name: string }) {
  const COLS = ["#2563EB","#DC2626","#D97706","#16A34A","#7C3AED","#DB2777","#0891B2"];
  const bg   = COLS[(name.charCodeAt(0) + name.length) % COLS.length];
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-[9px] font-bold"
         style={{ backgroundColor: bg }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function PlanningDash({ data, loading, router }: { data: any; loading: boolean; router: ReturnType<typeof useRouter> }) {
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const schedule = parse(data.awaitingSchedule);
  const released = parse(data.releasedJobs);
  const artwork  = parse(data.artworkPending);
  const noJC     = parse(data.ordersNoJobCard);

  return (
    <div className="space-y-5">
      {/* ── 4 Gradient KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <PlanningKpiCard
          label="Awaiting Schedule"
          value={schedule.length}
          sub="Jobs with missing schedule cards"
          gradient="bg-gradient-to-br from-teal-400 to-teal-700"
          icon={Clock}
          onClick={() => router.push("/gravure/job-schedule-release")}
        />
        <PlanningKpiCard
          label="Schedule Released"
          value={released.length}
          sub="Scheduled and released to floor"
          gradient="bg-gradient-to-br from-slate-600 to-slate-900"
          icon={CheckCircle}
          onClick={() => router.push("/gravure/job-schedule-release")}
        />
        <PlanningKpiCard
          label="Artwork Pending"
          value={artwork.length}
          sub="Blocked due to missing artwork"
          gradient="bg-gradient-to-br from-rose-400 to-red-700"
          icon={Palette}
          onClick={() => router.push("/gravure/artwork-management")}
        />
        <PlanningKpiCard
          label="Orders — No Job Card"
          value={noJC.length}
          sub="Orders requiring job cards"
          gradient="bg-gradient-to-br from-red-700 to-rose-950"
          icon={AlertCircle}
          onClick={() => router.push("/gravure/orders")}
        />
      </div>

      {/* ── Middle row: Schedule table (left) + Orders No JC (right) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Jobs Awaiting Schedule Release */}
        <Card title="Jobs Awaiting Schedule Release" action={
          <button onClick={() => router.push("/gravure/job-schedule-release")}
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors">
            Schedule Now →
          </button>
        }>
          {schedule.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle size={24} className="text-green-500" />
              </div>
              <p className="text-sm font-semibold text-gray-600">All jobs are scheduled</p>
              <p className="text-xs text-gray-400">No jobs awaiting schedule release</p>
            </div>
          ) : (
            <DataTable
              data={schedule}
              pageSize={8}
              columns={[
                { key: "JobBookingNo", header: "Job #",
                  render: (r: Row) => <button onClick={() => router.push("/gravure/workorder")}
                    className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline">{str(r.JobBookingNo)}</button> },
                { key: "CustomerName", header: "Customer",
                  render: (r: Row) => (
                    <div className="flex items-center gap-2">
                      <CustAvatar name={str(r.CustomerName)} />
                      <span className="text-sm text-gray-700 truncate max-w-[100px]">{str(r.CustomerName)}</span>
                    </div>
                  ) },
                { key: "MachineName", header: "Machine",
                  render: (r: Row) => <span className="text-xs text-gray-600">{str(r.MachineName)}</span> },
                { key: "Status",      header: "Status",
                  render: (r: Row) => <StatusPill status={str(r.Status)} /> },
              ]}
            />
          )}
        </Card>

        {/* Orders Without Job Card */}
        <Card title="Orders Without Job Card">
          {noJC.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle size={24} className="text-green-500" />
              </div>
              <p className="text-sm font-semibold text-gray-600">All orders have job cards</p>
            </div>
          ) : (
            <DataTable
              data={noJC}
              pageSize={8}
              columns={[
                { key: "SalesOrderNo",  header: "Order #",
                  render: (r: Row) => <button onClick={() => router.push("/gravure/orders")}
                    className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline">{str(r.SalesOrderNo)}</button> },
                { key: "CustomerName",  header: "Customer",
                  render: (r: Row) => (
                    <div className="flex items-center gap-2">
                      <CustAvatar name={str(r.CustomerName)} />
                      <span className="text-sm text-gray-700 truncate max-w-[90px]">{str(r.CustomerName)}</span>
                    </div>
                  ) },
                { key: "OrderDate",     header: "Date",
                  render: (r: Row) => <span className="text-xs text-gray-500">{str(r.OrderDate)}</span> },
                { key: "DaysOld",       header: "Age",
                  render: (r: Row) => {
                    const d   = n(r.DaysOld);
                    const col = d > 30 ? "#DC2626" : d > 14 ? "#D97706" : "#16A34A";
                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold tabular-nums" style={{ color: col }}>{d}d</span>
                        <span className="inline-block w-5 h-3 rounded-sm shrink-0"
                              style={{ backgroundColor: col }} />
                      </div>
                    );
                  } },
                { key: "OrderValue",    header: "Value",
                  render: (r: Row) => <span className="text-xs font-semibold text-gray-700">{cur(r.OrderValue)}</span> },
              ]}
            />
          )}
        </Card>
      </div>

      {/* ── Bottom row: Artwork Pending (left) + Released Jobs (right) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Artwork Pending List */}
        <Card title="Artwork Pending List">
          {artwork.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center">
                <Palette size={24} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No pending artwork</p>
            </div>
          ) : (
            <DataTable
              data={artwork}
              pageSize={8}
              columns={[
                { key: "JobBookingNo",  header: "Job #",
                  render: (r: Row) => <button onClick={() => router.push("/gravure/workorder")}
                    className="font-mono text-xs font-bold text-indigo-600 hover:underline">{str(r.JobBookingNo)}</button> },
                { key: "CustomerName",  header: "Customer",
                  render: (r: Row) => <span className="text-sm text-gray-700">{str(r.CustomerName)}</span> },
                { key: "TotalColors",   header: "Total",
                  render: (r: Row) => <span className="text-xs font-semibold text-gray-600">{str(r.TotalColors)}</span> },
                { key: "PendingColors", header: "Pending",
                  render: (r: Row) => <span className="text-xs font-bold text-orange-600">{str(r.PendingColors)}</span> },
                { key: "CurrentStage",  header: "Stage",
                  render: (r: Row) => <span className="text-xs text-gray-400 italic">{str(r.CurrentStage)}</span> },
              ]}
            />
          )}
        </Card>

        {/* Released (Scheduled) Jobs Monitor */}
        <Card title="Released (Scheduled) Jobs Monitor">
          {released.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No released jobs" />
          ) : (
            <DataTable
              data={released}
              pageSize={8}
              columns={[
                { key: "JobBookingNo",   header: "Job #",
                  render: (r: Row) => <button onClick={() => router.push("/gravure/workorder")}
                    className="font-mono text-xs font-bold text-indigo-600 hover:underline">{str(r.JobBookingNo)}</button> },
                { key: "CustomerName",   header: "Customer",
                  render: (r: Row) => <span className="text-sm text-gray-700">{str(r.CustomerName)}</span> },
                { key: "MachineName",    header: "Machine",
                  render: (r: Row) => <span className="text-xs text-gray-600">{str(r.MachineName)}</span> },
                { key: "Status",         header: "Status",
                  render: (r: Row) => <StatusPill status={str(r.Status)} /> },
                { key: "OrderQty",       header: "Qty",
                  render: (r: Row) => <span className="text-xs font-semibold tabular-nums">{fmt(r.OrderQty)} {str(r.Unit)}</span> },
                { key: "DaysToDeadline", header: "Deadline",
                  render: (r: Row) => <span className="text-xs whitespace-nowrap text-gray-500">{str(r.PlannedDate)} <DeadlineBadge days={n(r.DaysToDeadline)} /></span> },
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Dispatch / Sales / Command-Center KPI card (icon right, white bg) ───────
function DispatchKpiCard({ label, value, sub, color, icon: Icon, onClick, alert: isAlertProp = false }: {
  label: string; value: string | number; sub: string;
  color: string; icon: React.ElementType; onClick: () => void; alert?: boolean;
}) {
  const isAlert = isAlertProp && n(value) > 0;
  return (
    <div onClick={onClick}
      className={`border rounded-xl shadow-sm px-5 py-4 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[110px] hover:shadow-md hover:-translate-y-0.5 transition-all
        ${isAlert ? "bg-red-50/40 border-red-200" : "bg-white border-gray-100"}`}>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-4xl font-bold tabular-nums mt-1.5 leading-none" style={{ color }}>{value}</p>
      </div>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <Icon size={80} style={{ color, opacity: 0.13 }} strokeWidth={1.5} />
      </div>
    </div>
  );
}

// ── Command Center alert block (compact, icon right) ─────────────────────────
function CmdAlertBlock({ label, value, sub, color, icon: Icon, onClick }: {
  label: string; value: string | number; sub: string;
  color: string; icon: React.ElementType; onClick: () => void;
}) {
  const isActive = n(value) > 0;
  return (
    <button onClick={onClick}
      className={`w-full text-left border rounded-xl px-4 py-3 relative overflow-hidden flex items-center gap-3 shadow-sm hover:shadow-md transition-all
        ${isActive ? "bg-amber-50/30 border-amber-200" : "bg-white border-gray-100"}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 truncate">{label}</p>
        <p className="text-2xl font-bold tabular-nums mt-0.5 leading-none"
           style={{ color: isActive ? color : "#9CA3AF" }}>{value}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
      </div>
      <Icon size={38} style={{ color: isActive ? color : "#D1D5DB", opacity: isActive ? 0.25 : 0.5 }} strokeWidth={1.5} />
    </button>
  );
}

function DispatchDash({ data, loading, router }: { data: any; loading: boolean; router: ReturnType<typeof useRouter> }) {
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const kpi        = parse(data.kpi)[0] ?? {};
  const ready      = parse(data.dispatchReady);
  const dispatches = parse(data.recentDispatches);
  const byCustomer = parse(data.dispatchByCustomer);

  const pendingCount = n(kpi.PendingDispatch);

  return (
    <div className="space-y-5">
      {/* ── 4 KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <DispatchKpiCard
          label="Pending Dispatch"
          value={fmt(pendingCount)}
          sub={pendingCount > 0 ? `${pendingCount} Job(s) Pending Dispatch` : "Awaiting dispatch details"}
          color="#F59E0B"
          icon={Package}
          onClick={() => router.push("/gravure/dispatch")}
        />
        <DispatchKpiCard
          label="Dispatches (Period)"
          value={fmt(kpi.DispatchCount)}
          sub="In period"
          color="#3B82F6"
          icon={Truck}
          onClick={() => router.push("/gravure/dispatch")}
        />
        <DispatchKpiCard
          label="Qty Dispatched"
          value={fmt(kpi.DispatchQty)}
          sub="Units in period"
          color="#16A34A"
          icon={BarChart2}
          onClick={() => router.push("/gravure/dispatch")}
        />
        <DispatchKpiCard
          label="Today's Dispatches"
          value={fmt(kpi.DispatchToday)}
          sub="Today"
          color="#D97706"
          icon={Clock}
          onClick={() => router.push("/gravure/dispatch")}
        />
      </div>

      {/* ── Ready for dispatch + Bar chart ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Populated Jobs Ready for Dispatch" action={
          ready.length > 0 && (
            <button onClick={() => router.push("/gravure/dispatch")}
              className="text-xs font-semibold text-green-600 hover:text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-lg transition-colors">
              Process dispatch →
            </button>
          )
        }>
          {ready.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <Package size={24} className="text-green-400" />
              </div>
              <p className="text-sm text-gray-500 font-medium">No jobs ready for dispatch</p>
              <p className="text-xs text-gray-400">Completed production jobs will appear here</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {["Job ID", "Customer", "Vehicle", "Qty"].map(h => (
                        <th key={h} className="py-2 px-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide first:pl-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ready.map((r, i) => {
                      const done = str(r.Status) === "Completed";
                      return (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                          <td className="py-2.5 pl-4 pr-3">
                            <div className="flex items-center gap-2">
                              {done
                                ? <CheckCircle size={13} className="text-green-500 shrink-0" />
                                : <Clock size={13} className="text-amber-400 shrink-0" />
                              }
                              <button onClick={() => router.push("/gravure/workorder")}
                                className="font-mono text-xs font-bold text-indigo-600 hover:underline">
                                {str(r.JobBookingNo)}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-gray-700">{str(r.CustomerName)}</td>
                          <td className="py-2.5 px-3 text-gray-500">{str(r.VehicleNo) || "—"}</td>
                          <td className="py-2.5 px-3 font-semibold tabular-nums text-gray-700">{fmt(r.OrderQty)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end pt-3 border-t border-gray-50 mt-2">
                <button onClick={() => router.push("/gravure/dispatch")}
                  className="text-xs font-semibold text-green-600 hover:text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 px-4 py-1.5 rounded-lg transition-colors">
                  Process dispatch →
                </button>
              </div>
            </>
          )}
        </Card>

        <Card title="Dispatches by Customer (Period)">
          {byCustomer.length === 0
            ? <EmptyState icon={Truck} title="No dispatches in period" />
            : <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byCustomer} layout="vertical" margin={{ left: 10, right: 50, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="CustomerName" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip formatter={(v: any) => [fmt(v), "Dispatches"]} />
                  <Bar dataKey="DispatchCount" name="Dispatches" fill="#3B82F6" radius={[0,4,4,0]}
                       label={{ position: "right", fontSize: 11, fill: "#374151", formatter: (v: any) => fmt(v) }} />
                </BarChart>
              </ResponsiveContainer>
          }
        </Card>
      </div>

      {/* ── Recent Dispatches DataTable ── */}
      <Card title="Recent Dispatches">
        <DataTable
          data={dispatches}
          pageSize={10}
          columns={[
            { key: "VoucherNo",    header: "DN No",
              render: (r: Row) => <span className="font-mono text-xs font-bold text-indigo-600">{str(r.VoucherNo)}</span> },
            { key: "VoucherDate",  header: "Date",
              render: (r: Row) => <span className="text-xs text-gray-500">{str(r.VoucherDate)}</span> },
            { key: "CustomerName", header: "Customer",
              render: (r: Row) => <span className="text-sm text-gray-700">{str(r.CustomerName)}</span> },
            { key: "StatusName",   header: "Status",
              render: (r: Row) => {
                const s = str(r.StatusName) || str(r.Status) || "Processing";
                const isCompleted = s.toLowerCase().includes("complet");
                return (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold
                    ${isCompleted ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {isCompleted ? "Completed" : "Processing"}
                  </span>
                );
              } },
            { key: "VehicleNo",    header: "Vehicle",
              render: (r: Row) => (
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-blue-400 shrink-0" />
                  <span className="text-xs text-gray-600">{str(r.VehicleNo) || "—"}</span>
                </div>
              ) },
            { key: "Transporter",  header: "Transporter",
              render: (r: Row) => <span className="text-xs text-gray-500">{str(r.Transporter) || "—"}</span> },
            { key: "TotalQty",     header: "Qty",
              render: (r: Row) => <span className="font-semibold tabular-nums text-gray-700">{fmt(r.TotalQty)}</span> },
          ]}
        />
      </Card>
    </div>
  );
}

function SalesDash({ data, loading, router }: { data: any; loading: boolean; router: ReturnType<typeof useRouter> }) {
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const kpi       = parse(data.kpi)[0] ?? {};
  const trend     = parse(data.orderTrend);
  const customers = parse(data.topCustomers);
  const noJC      = parse(data.ordersNoJobCard);
  const est       = parse(data.pendingEstimations);

  function salesAgeColor(days: number) {
    if (days > 60) return "#DC2626";
    if (days > 30) return "#F59E0B";
    if (days > 14) return "#D97706";
    return "#6B7280";
  }

  return (
    <div className="space-y-5">
      {/* ── 5 illustrated KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <DispatchKpiCard
          label="New Orders"
          value={fmt(kpi.NewOrders)}
          sub="In period"
          color="#16A34A"
          icon={TrendingUp}
          onClick={() => router.push("/gravure/orders")}
        />
        <DispatchKpiCard
          label="Order Value"
          value={fmtCr(kpi.OrderValue)}
          sub={cur(kpi.OrderValue)}
          color="#D97706"
          icon={BarChart2}
          onClick={() => router.push("/gravure/orders")}
        />
        <DispatchKpiCard
          label="Active Orders"
          value={fmt(kpi.ActiveOrders)}
          sub="Open / confirmed"
          color="#4F46E5"
          icon={Package}
          onClick={() => router.push("/gravure/orders")}
        />
        <DispatchKpiCard
          label="Pending Estimations"
          value={fmt(kpi.PendingEstimations)}
          sub="Draft / quoted"
          color="#0891B2"
          icon={FileText}
          onClick={() => router.push("/gravure/estimation")}
        />
        <DispatchKpiCard
          label="Unique Customers"
          value={fmt(kpi.UniqueCustomers)}
          sub="In period"
          color="#DB2777"
          icon={Users}
          onClick={() => router.push("/gravure/orders")}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Monthly Order Trend (6 Months)">
          {trend.length === 0
            ? <EmptyState icon={TrendingUp} title="No trend data" />
            : <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={trend} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="MonthLabel" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="cnt" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="val" orientation="right" tick={{ fontSize: 10 }}
                         tickFormatter={v => "₹" + (v / 100000).toFixed(0) + "L"} />
                  <Tooltip formatter={(v: any, name: any) => name === "Orders" ? [v, name] : [cur(v), name]} />
                  <Legend />
                  <Bar  yAxisId="cnt" dataKey="OrderCount" name="Orders"    fill="#10B981" radius={[4,4,0,0]} />
                  <Area yAxisId="val" dataKey="OrderValue" name="Value (₹)" type="monotone" stroke="#3B82F6" fill="#3B82F615" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
          }
        </Card>

        <Card title="Top Customers by Order Value">
          {customers.length === 0
            ? <EmptyState icon={Users} title="No customer data" />
            : <ResponsiveContainer width="100%" height={220}>
                <BarChart data={customers} layout="vertical" margin={{ left: 10, right: 65, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => "₹" + (v / 100000).toFixed(0) + "L"} />
                  <YAxis dataKey="CustomerName" type="category" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip formatter={(v: any) => [cur(v), "Order Value"]} />
                  <Bar dataKey="TotalValue" name="Order Value" fill="#4F46E5" radius={[0,4,4,0]}
                       label={{ position: "right", fontSize: 10, fill: "#374151",
                                formatter: (v: any) => "₹" + (v / 100000).toFixed(0) + "L" }} />
                </BarChart>
              </ResponsiveContainer>
          }
        </Card>
      </div>

      {/* ── Bottom DataTables ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Pending Estimations">
          <DataTable
            data={est}
            pageSize={8}
            columns={[
              { key: "EstimationNo", header: "Est #",
                render: (r: Row) => (
                  <button onClick={() => router.push("/gravure/estimation")}
                    className="font-mono text-xs font-bold text-indigo-600 hover:underline">
                    {str(r.EstimationNo)}
                  </button>
                ) },
              { key: "CustomerName", header: "Customer",
                render: (r: Row) => (
                  <div className="flex items-center gap-2">
                    <CustAvatar name={str(r.CustomerName) || "?"} />
                    <span className="text-xs text-gray-700 truncate max-w-[110px]">{str(r.CustomerName)}</span>
                  </div>
                ) },
              { key: "JobName", header: "Job",
                render: (r: Row) => <span className="text-xs text-gray-500 truncate max-w-[80px] block">{str(r.JobName)}</span> },
              { key: "Status", header: "Status",
                render: (r: Row) => {
                  const s = str(r.Status) || "Draft";
                  return (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold
                      ${s === "Draft"   ? "bg-indigo-100 text-indigo-700"
                      : s === "Quoted" ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-600"}`}>
                      {s}
                    </span>
                  );
                } },
              { key: "DaysOld", header: "Age",
                render: (r: Row) => {
                  const d = n(r.DaysOld);
                  const col = salesAgeColor(d);
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-5 h-3 rounded-sm shrink-0" style={{ backgroundColor: col }} />
                      <span className="text-xs font-bold tabular-nums" style={{ color: col }}>{d}d</span>
                    </div>
                  );
                } },
            ]}
          />
        </Card>

        <Card title="Orders Without Job Card">
          <DataTable
            data={noJC}
            pageSize={8}
            columns={[
              { key: "SalesOrderNo", header: "Order #",
                render: (r: Row) => (
                  <button onClick={() => router.push("/gravure/orders")}
                    className="font-mono text-xs font-bold text-indigo-600 hover:underline">
                    {str(r.SalesOrderNo)}
                  </button>
                ) },
              { key: "CustomerName", header: "Customer",
                render: (r: Row) => (
                  <div className="flex items-center gap-2">
                    <CustAvatar name={str(r.CustomerName) || "?"} />
                    <span className="text-xs text-gray-700 truncate max-w-[90px]">{str(r.CustomerName)}</span>
                  </div>
                ) },
              { key: "OrderDate", header: "Date",
                render: (r: Row) => <span className="text-xs text-gray-500">{str(r.OrderDate)}</span> },
              { key: "DaysOld", header: "Age",
                render: (r: Row) => {
                  const d = n(r.DaysOld);
                  const col = salesAgeColor(d);
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-5 h-3 rounded-sm shrink-0" style={{ backgroundColor: col }} />
                      <span className="text-xs font-bold tabular-nums" style={{ color: col }}>{d}d</span>
                    </div>
                  );
                } },
              { key: "OrderValue", header: "Value",
                render: (r: Row) => <span className="text-xs font-semibold tabular-nums text-gray-700">{cur(r.OrderValue)}</span> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function CommandCenterDash({
  data, loading, router, prodData, onDrillDown, onOpenDrawer,
}: {
  data: any; loading: boolean; router: ReturnType<typeof useRouter>;
  prodData: any; onDrillDown: (t: DrillTarget) => void; onOpenDrawer: (cfg: DrawerConfig) => void;
}) {
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const kpi      = parse(data.kpi)[0] ?? {};
  const pipeline = parse(data.factoryPipeline);
  const machines = parse(data.machineLoad);
  const overdue  = parse(data.overdueJobs);
  const alerts   = parse(data.alerts);

  function handleStageClick(stageKey: string) {
    if (stageKey === "Orders (No JC)")   { onDrillDown("no-jc"); return; }
    if (stageKey === "Pending Dispatch") { onDrillDown("dispatch-ready"); return; }
    if (stageKey === "In Production") {
      const board = parse(prodData?.machineJobBoard ?? []);
      const rows  = board.filter(r => str(r.Status) === "In Progress");
      onOpenDrawer({
        title: "Jobs In Production",
        subtitle: "All jobs currently running on machines",
        rows,
        cols: [
          { key: "MachineName",    label: "Machine",  render: v => <span className="font-semibold text-indigo-700 text-xs">{str(v)}</span> },
          { key: "JobBookingNo",   label: "Job #",    render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
          { key: "CustomerName",   label: "Customer" },
          { key: "Status",         label: "Status",   render: v => <StatusPill status={str(v)} /> },
          { key: "DaysToDeadline", label: "Deadline", render: (v, r) => <span className="text-xs whitespace-nowrap">{str(r.PlannedDate)} <DeadlineBadge days={n(v)} /></span> },
        ],
      });
      return;
    }
    if (stageKey === "Job Cards (Open)") {
      const board = parse(prodData?.machineJobBoard ?? []);
      const rows  = board.filter(r => str(r.Status) === "Open" || str(r.Status) === "Queued");
      onOpenDrawer({
        title: "Queued Job Cards",
        subtitle: "Jobs approved but not yet started",
        rows,
        cols: [
          { key: "MachineName",    label: "Machine",  render: v => <span className="font-semibold text-indigo-700 text-xs">{str(v)}</span> },
          { key: "JobBookingNo",   label: "Job #",    render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
          { key: "CustomerName",   label: "Customer" },
          { key: "Status",         label: "Status",   render: v => <StatusPill status={str(v)} /> },
          { key: "DaysToDeadline", label: "Deadline", render: (v, r) => <span className="text-xs whitespace-nowrap">{str(r.PlannedDate)} <DeadlineBadge days={n(v)} /></span> },
        ],
      });
      return;
    }
    const stage = PIPELINE_CFG.find(s => s.key === stageKey);
    if (stage) router.push(stage.href);
  }

  function openMachineView(machineName: string) {
    const board = parse(prodData?.machineJobBoard ?? []);
    const jobs  = [...board.filter(r => str(r.MachineName) === machineName)]
      .sort((a, b) => {
        const ap = str(a.Status) === "In Progress" ? 0 : 1;
        const bp = str(b.Status) === "In Progress" ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return n(a.DaysToDeadline) - n(b.DaysToDeadline);
      });
    const mRow = machines.find(m => str(m.MachineName) === machineName) ?? {};
    onOpenDrawer({
      title: `Machine: ${machineName}`,
      subtitle: `${n(mRow.TotalJobs)} total · ${n(mRow.InProgress)} in progress · ${n(mRow.Queued)} queued${n(mRow.OnHold) > 0 ? ` · ${n(mRow.OnHold)} on hold` : ""}`,
      rows: jobs,
      cols: [
        { key: "JobBookingNo",   label: "Job #",    render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
        { key: "CustomerName",   label: "Customer" },
        { key: "JobName",        label: "Job Name" },
        { key: "Status",         label: "Status",   render: v => <StatusPill status={str(v)} /> },
        { key: "OrderQty",       label: "Qty",      render: (v, r) => `${fmt(v)} ${str(r.Unit)}` },
        { key: "DaysToDeadline", label: "Deadline", render: (v, r) => <span className="text-xs whitespace-nowrap">{str(r.PlannedDate)} <DeadlineBadge days={n(v)} /></span> },
      ],
    });
  }

  const overdueCount = n(kpi.OverdueJobs);

  return (
    <div className="space-y-5">
      {/* ── 5 illustrated KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <DispatchKpiCard
          label="Open Orders"
          value={fmt(kpi.OpenOrders)}
          sub="Active"
          color="#2563EB"
          icon={Activity}
          onClick={() => router.push("/gravure/orders")}
        />
        <DispatchKpiCard
          label="Active Jobs"
          value={fmt(kpi.ActiveJobs)}
          sub="Queue + running"
          color="#4F46E5"
          icon={Layers}
          onClick={() => router.push("/gravure/workorder")}
        />
        <DispatchKpiCard
          label="Overdue"
          value={fmt(overdueCount)}
          sub="Past date"
          color="#DC2626"
          icon={Clock}
          onClick={() => onDrillDown("overdue")}
          alert
        />
        <DispatchKpiCard
          label="Dispatch Ready"
          value={fmt(kpi.DispatchReady)}
          sub="Ship now"
          color="#16A34A"
          icon={Package}
          onClick={() => onDrillDown("dispatch-ready")}
        />
        <DispatchKpiCard
          label="Dispatched (7D)"
          value={fmt(kpi.DispatchedLast7Days)}
          sub="Last 7 days"
          color="#10B981"
          icon={CheckCircle}
          onClick={() => router.push("/gravure/dispatch")}
        />
      </div>

      {/* ── 4 operational alert blocks ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CmdAlertBlock
          label="Awaiting Schedule"
          value={fmt(kpi.AwaitingSchedule)}
          sub="Need release"
          color="#D97706"
          icon={Calendar}
          onClick={() => onDrillDown("schedule")}
        />
        <CmdAlertBlock
          label="Artwork Pending"
          value={fmt(kpi.ArtworkPending)}
          sub="Pending art"
          color="#F59E0B"
          icon={Palette}
          onClick={() => onDrillDown("artwork")}
        />
        <CmdAlertBlock
          label="INK-SPR Pending"
          value={fmt(kpi.InkSPRPending)}
          sub="SPR not done"
          color="#EF4444"
          icon={Droplet}
          onClick={() => onDrillDown("ink")}
        />
        <CmdAlertBlock
          label="Orders - No JC"
          value={fmt(kpi.OrdersNoJobCard)}
          sub="No job card"
          color="#0891B2"
          icon={FileText}
          onClick={() => onDrillDown("no-jc")}
        />
      </div>

      {/* ── Factory Pipeline ── */}
      <Card title="Factory Pipeline" action={<span className="text-xs text-gray-400">Click a stage to drill in</span>}>
        <FactoryPipeline data={pipeline} router={router} onStageClick={handleStageClick} />
      </Card>

      {/* ── 3-column bottom: Issues | Machine Load | Overdue Jobs ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_2fr] gap-5">
        <Card title="Priority Issues" action={
          overdueCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">OVERDUE {overdueCount}</span>
              <span className="text-xs text-gray-400">from Production board</span>
            </div>
          )
        }>
          <IssueFeed kpi={kpi} alerts={alerts} router={router} onDrillDown={onDrillDown} />
        </Card>

        <Card title="Machine Load" action={<span className="text-xs text-gray-400">Click to drill in</span>}>
          <MachineLoadCards data={machines} router={router} onMachineClick={openMachineView} />
        </Card>

        <Card title={`Overdue Jobs (${overdue.length})`} action={
          <button onClick={() => onDrillDown("overdue")} className="text-xs text-red-500 hover:text-red-700 font-semibold">View all →</button>
        }>
          {overdue.length === 0
            ? <EmptyState icon={CheckCircle} title="No overdue jobs" sub="All jobs are on or ahead of schedule" />
            : <DataTable
                data={overdue}
                pageSize={8}
                columns={[
                  { key: "JobBookingNo", header: "Job #",
                    render: (r: Row) => (
                      <button onClick={() => router.push("/gravure/workorder")}
                        className="font-mono text-xs font-bold text-indigo-600 hover:underline">
                        {str(r.JobBookingNo)}
                      </button>
                    ) },
                  { key: "CustomerName", header: "Customer",
                    render: (r: Row) => <span className="text-xs text-gray-700">{str(r.CustomerName)}</span> },
                  { key: "MachineName",  header: "Machine",
                    render: (r: Row) => <span className="text-xs font-semibold text-indigo-700">{str(r.MachineName)}</span> },
                  { key: "Status",       header: "Status",
                    render: (r: Row) => <StatusPill status={str(r.Status)} /> },
                  { key: "PlannedDate",  header: "Planned",
                    render: (r: Row) => <span className="text-xs text-gray-500">{str(r.PlannedDate)}</span> },
                  { key: "DaysOverdue",  header: "Overdue",
                    render: (r: Row) => <OverdueBadge days={n(r.DaysOverdue)} /> },
                ]}
              />
          }
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GravureDashboardPage() {
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("management");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading]       = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dashData, setDashData]     = useState<Partial<Record<TabKey, any>>>({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [drawer, setDrawer]         = useState<DrawerConfig | null>(null);

  const timerRef   = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const bgFetched  = useRef<Set<string>>(new Set());

  const hasDateFilter = (t: TabKey) => ["management", "dispatch", "sales"].includes(t);

  // ── Restore preferences (URL param wins over localStorage) ──────────────
  useEffect(() => {
    try {
      const params  = new URLSearchParams(window.location.search);
      const urlTab  = params.get("tab") as TabKey;
      if (urlTab && TABS.find(t => t.key === urlTab)) {
        setTab(urlTab);
      } else {
        const savedTab = localStorage.getItem("gravure-dash-tab") as TabKey;
        if (savedTab && TABS.find(t => t.key === savedTab)) setTab(savedTab);
      }
      const savedAR = localStorage.getItem("gravure-dash-ar");
      if (savedAR !== null) setAutoRefresh(savedAR !== "false");
    } catch {}
  }, []);

  // ── Keyboard shortcut: R = refresh ───────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        fetchTab(tab, fromDate, toDate);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, fromDate, toDate]);

  const fetchTab = useCallback(async (t: TabKey, fd: string, td: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const qs = hasDateFilter(t) ? `?fromDate=${fd}&toDate=${td}` : "";
      const res = await apiGet<any>(`api/gravure/dashboard/${t}${qs}`);
      setDashData(prev => ({ ...prev, [t]: res }));
      setLastUpdated(new Date());
    } catch (e: any) {
      const msg = e?.message ?? "Unknown error";
      if (msg.includes("Failed to fetch") || msg.includes("fetch")) {
        setFetchError("Cannot reach backend. Make sure the .NET server is running, then Retry.");
      } else if (msg.includes("401") || msg.includes("Session expired")) {
        setFetchError("Session expired — please refresh or log in again.");
      } else {
        setFetchError("Error loading dashboard: " + msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Main tab fetch + auto-refresh interval ────────────────────────────────
  useEffect(() => {
    fetchTab(tab, fromDate, toDate);
    clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(() => fetchTab(tab, fromDate, toDate), 60_000);
    }
    return () => clearInterval(timerRef.current);
  }, [tab, fromDate, toDate, autoRefresh, fetchTab]);

  // ── Background-load cc data when on Production (for blockers ccKpi) ─────
  useEffect(() => {
    if (tab === "production" && !bgFetched.current.has("command-center")) {
      bgFetched.current.add("command-center");
      apiGet<any>("api/gravure/dashboard/command-center")
        .then(res => setDashData(prev => ({ ...prev, "command-center": res })))
        .catch(() => {});
    }
  }, [tab]);

  // ── Background-load production data when on Command Center ───────────────
  useEffect(() => {
    if (tab === "command-center" && !bgFetched.current.has("production")) {
      bgFetched.current.add("production");
      apiGet<any>("api/gravure/dashboard/production")
        .then(res => setDashData(prev => ({ ...prev, production: res })))
        .catch(() => {});
    }
  }, [tab]);

  function changeTab(newTab: TabKey) {
    setTab(newTab);
    try {
      localStorage.setItem("gravure-dash-tab", newTab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }

  function setPreset(days: number) {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to.toISOString().slice(0, 10));
  }

  function toggleAutoRefresh() {
    const next = !autoRefresh;
    setAutoRefresh(next);
    try { localStorage.setItem("gravure-dash-ar", String(next)); } catch {}
    if (!next) clearInterval(timerRef.current);
  }

  // ── Drill-down opener ─────────────────────────────────────────────────────
  const openDrillDown = useCallback(async (target: DrillTarget) => {
    const needsTab = DRILL_TARGET_TAB[target] as TabKey | undefined;
    let currentData = dashData;

    if (needsTab && !dashData[needsTab]) {
      const qs = hasDateFilter(needsTab) ? `?fromDate=${fromDate}&toDate=${toDate}` : "";
      try {
        const res = await apiGet<any>(`api/gravure/dashboard/${needsTab}${qs}`);
        currentData = { ...dashData, [needsTab]: res };
        setDashData(currentData);
      } catch {}
    }
    setDrawer(buildDrawer(target, currentData));
  }, [dashData, fromDate, toDate]);

  // ── Tab badge counts (from cached command-center data) ────────────────────
  const ccData   = dashData["command-center"];
  const ccKpi    = ccData ? (parse(ccData.kpi)[0] ?? {}) : {};
  const ccAlerts = ccData ? parse(ccData.alerts) : [];

  const tabBadge: Partial<Record<TabKey, number>> = {
    "production":     n(ccKpi.OverdueJobs),
    "planning":       n(ccKpi.AwaitingSchedule),
    "command-center": ccAlerts.length,
  };

  return (
    <div className="min-h-screen bg-gray-50/60">
      {/* Drawer */}
      <Drawer cfg={drawer} onClose={() => setDrawer(null)} />

      {/* Sticky header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
              <BarChart2 size={17} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">Gravure Command Center</h1>
              <p className="text-xs text-gray-400 leading-tight">
                {lastUpdated
                  ? <>Last sync {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}{loading && <span className="ml-2 text-blue-500 animate-pulse">• Refreshing</span>}</>
                  : loading ? "Loading..." : "Not yet loaded"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hasDateFilter(tab) && (
              <>
                <div className="flex items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-lg p-0.5">
                  {([["7D", 7], ["30D", 30], ["90D", 90]] as const).map(([label, days]) => (
                    <button key={label} onClick={() => setPreset(days)}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold text-gray-600 hover:bg-white hover:shadow-sm transition-all">
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                  <span className="text-xs text-gray-400">to</span>
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
              </>
            )}
            <button onClick={toggleAutoRefresh}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                autoRefresh ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}>
              <Activity size={11} />
              {autoRefresh ? "Live" : "Paused"}
            </button>
            <TutorialButton title="Gravure Dashboard — Tutorial" />
            <button onClick={() => fetchTab(tab, fromDate, toDate)}
              title="Refresh (R)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-5 flex overflow-x-auto border-t border-gray-50">
          {TABS.map(t => {
            const active = t.key === tab;
            const badge  = tabBadge[t.key];
            return (
              <button key={t.key} onClick={() => changeTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  active ? "border-current" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/60"
                }`}
                style={active ? { color: t.color, borderColor: t.color } : {}}>
                <t.icon size={13} />
                {t.label}
                {!!badge && badge > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-white font-bold leading-none"
                    style={{ backgroundColor: "#EF4444", fontSize: "10px" }}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="mx-5 mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">Dashboard unavailable</p>
            <p className="text-xs text-red-600 mt-0.5">{fetchError}</p>
          </div>
          <button onClick={() => fetchTab(tab, fromDate, toDate)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors shrink-0">
            <RefreshCw size={11} />
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {tab === "management"     && <ManagementDash    data={dashData.management}        loading={loading} router={router} />}
        {tab === "production"     && (
          <ProductionControlTower
            data={dashData.production}
            loading={loading}
            router={router}
            lastUpdated={lastUpdated}
            onDrillDown={openDrillDown}
            onOpenDrawer={setDrawer}
            onRefresh={() => fetchTab(tab, fromDate, toDate)}
            ccData={dashData["command-center"]}
          />
        )}
        {tab === "planning"       && <PlanningDash      data={dashData.planning}          loading={loading} router={router} />}
        {tab === "dispatch"       && <DispatchDash      data={dashData.dispatch}          loading={loading} router={router} />}
        {tab === "sales"          && <SalesDash         data={dashData.sales}             loading={loading} router={router} />}
        {tab === "command-center" && (
          <CommandCenterDash
            data={dashData["command-center"]}
            loading={loading}
            router={router}
            prodData={dashData.production}
            onDrillDown={openDrillDown}
            onOpenDrawer={setDrawer}
          />
        )}
      </div>
    </div>
  );
}
