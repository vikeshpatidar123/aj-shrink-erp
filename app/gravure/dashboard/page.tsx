"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ComposedChart, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Package, Truck, AlertTriangle, Clock, CheckCircle,
  Users, Activity, RefreshCw, BarChart2, Layers, Zap, Calendar,
  FileText, LayoutDashboard, Factory, Palette,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import TutorialButton from "@/components/ui/TutorialButton";
import { Input } from "@/components/ui/Input";

// ── Helpers ───────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
function parse(v: unknown): Row[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as Row[];
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
  return [];
}
function n(v: unknown) { return Number(v ?? 0); }
function str(v: unknown) { return String(v ?? ""); }
function fmt(v: unknown) { return n(v).toLocaleString("en-IN"); }
function cur(v: unknown) {
  return "₹" + n(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

const CLR = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#F97316","#EC4899"];
const STATUS_CLR: Record<string, string> = {
  "Open": "#3B82F6", "In Progress": "#F59E0B",
  "On Hold": "#8B5CF6", "Completed": "#10B981", "Cancelled": "#EF4444",
};

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Stat({ label, value, icon: Ic, color, sub, alert }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; sub?: string; alert?: boolean;
}) {
  const isAlert = alert && n(value) > 0;
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 flex items-start justify-between ${isAlert ? "border-red-200" : "border-gray-100"}`}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${isAlert ? "text-red-600" : ""}`}
           style={isAlert ? {} : { color }}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="ml-3 p-2.5 rounded-xl shrink-0" style={{ backgroundColor: color + "18" }}>
        <Ic size={18} style={{ color }} />
      </div>
    </div>
  );
}

function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className ?? ""}`}>
      {title && (
        <div className="px-5 py-3.5 border-b border-gray-50 font-semibold text-gray-700 text-sm">{title}</div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

function TBL({ rows, cols, maxH = "max-h-72" }: {
  rows: Row[];
  cols: { key: string; label: string; render?: (v: unknown, r: Row) => React.ReactNode }[];
  maxH?: string;
}) {
  if (!rows.length) return <div className="py-8 text-center text-sm text-gray-400">No records</div>;
  return (
    <div className={`overflow-auto ${maxH}`}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="border-b border-gray-100">
            {cols.map(c => (
              <th key={c.key} className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
              {cols.map(c => (
                <td key={c.key} className="py-2 px-3 text-gray-700">
                  {c.render ? c.render(row[c.key], row) : str(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = STATUS_CLR[status] ?? "#6B7280";
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
          style={{ color, borderColor: color + "50", backgroundColor: color + "12" }}>
      {status}
    </span>
  );
}

function DeadlineBadge({ days }: { days: number }) {
  if (days > 7) return <span className="text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{days}d left</span>;
  if (days > 0) return <span className="text-xs font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">{days}d left</span>;
  if (days === 0) return <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Due today</span>;
  return <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{Math.abs(days)}d OD</span>;
}

function OverdueBadge({ days }: { days: number }) {
  if (days > 3) return <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{days}d</span>;
  return <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{days}d</span>;
}

function SevBadge({ sev }: { sev: string }) {
  const cls = sev === "HIGH"
    ? "bg-red-100 text-red-700 border-red-200"
    : "bg-amber-100 text-amber-700 border-amber-200";
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>{sev}</span>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-9 h-9 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

// ── Tab config ────────────────────────────────────────────────────────────────
type TabKey = "management" | "production" | "planning" | "dispatch" | "sales" | "command-center";

const TABS: { key: TabKey; label: string; icon: React.ElementType; color: string }[] = [
  { key: "management",     label: "Management",    icon: LayoutDashboard, color: "#3B82F6" },
  { key: "production",     label: "Production",    icon: Factory,         color: "#10B981" },
  { key: "planning",       label: "Planning",      icon: Calendar,        color: "#8B5CF6" },
  { key: "dispatch",       label: "Dispatch",      icon: Truck,           color: "#F59E0B" },
  { key: "sales",          label: "Sales",         icon: TrendingUp,      color: "#EF4444" },
  { key: "command-center", label: "Command Center",icon: Zap,             color: "#6366F1" },
];

// ── Dashboard Sections ────────────────────────────────────────────────────────

function ManagementDash({ data, loading }: { data: any; loading: boolean }) {
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const kpi       = parse(data.kpi)[0] ?? {};
  const trend     = parse(data.orderTrend);
  const customers = parse(data.topCustomers);
  const machines  = parse(data.machineLoad);
  const dispatches = parse(data.recentDispatches);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Open Orders"       value={fmt(kpi.OpenOrders)}     icon={FileText}  color="#3B82F6" />
        <Stat label="Active Job Cards"  value={fmt(kpi.ActiveJobCards)} icon={Layers}    color="#8B5CF6" />
        <Stat label="Dispatch Ready"    value={fmt(kpi.DispatchReady)}  icon={Package}   color="#10B981" />
        <Stat label="Dispatches (Period)" value={fmt(kpi.DispatchCount)} icon={Truck}    color="#06B6D4" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Order Value (Period)" value={cur(kpi.OrderValuePeriod)} icon={TrendingUp} color="#10B981" />
        <Stat label="Artwork Pending"   value={fmt(kpi.ArtworkPending)}   icon={Palette}   color="#F59E0B" alert />
        <Stat label="Awaiting Schedule" value={fmt(kpi.AwaitingSchedule)} icon={Clock}     color="#EF4444" alert />
        <Stat label="Pending Estimations" value={fmt(kpi.PendingEstimations)} icon={Activity} color="#6366F1" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Monthly Order Trend (6 Months)">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="MonthLabel" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="cnt" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="val" orientation="right" tick={{ fontSize: 10 }}
                     tickFormatter={v => "₹" + (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v, name) => name === "Orders" ? v : cur(v)} />
              <Legend />
              <Bar yAxisId="cnt" dataKey="OrderCount" name="Orders" fill="#3B82F6" radius={[4,4,0,0]} />
              <Area yAxisId="val" type="monotone" dataKey="OrderValue" name="Value (₹)"
                    stroke="#10B981" fill="#10B98115" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Machine Load">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={machines} layout="vertical" margin={{ left: 10, right: 15, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="MachineName" type="category" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Legend />
              <Bar dataKey="InProgress" name="In Progress" fill="#F59E0B" stackId="a" />
              <Bar dataKey="Queued"     name="Queued"      fill="#3B82F6" stackId="a" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Top Customers (by Job Count)">
          <TBL rows={customers} cols={[
            { key: "CustomerName", label: "Customer" },
            { key: "TotalJobs",  label: "Total",      render: v => <span className="font-bold text-blue-600">{str(v)}</span> },
            { key: "InProgress", label: "In Progress", render: v => <span className="text-amber-600 font-semibold">{str(v)}</span> },
            { key: "Completed",  label: "Completed",   render: v => <span className="text-green-600 font-semibold">{str(v)}</span> },
          ]} />
        </Card>
        <Card title="Recent Dispatches">
          <TBL rows={dispatches} cols={[
            { key: "VoucherNo",    label: "DN No",     render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
            { key: "VoucherDate",  label: "Date" },
            { key: "CustomerName", label: "Customer" },
            { key: "VehicleNo",    label: "Vehicle" },
            { key: "TotalQty",     label: "Qty",       render: v => <span className="font-semibold">{fmt(v)}</span> },
          ]} />
        </Card>
      </div>
    </div>
  );
}

function ProductionDash({ data, loading }: { data: any; loading: boolean }) {
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
                <Pie data={statuses} dataKey="Count" nameKey="Status"
                     cx="50%" cy="50%" outerRadius={80} innerRadius={48}>
                  {statuses.map((r, i) => (
                    <Cell key={i} fill={STATUS_CLR[str(r.Status)] ?? CLR[i % CLR.length]} />
                  ))}
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
                <span className="text-xs text-gray-400">Total</span>
                <span className="font-bold text-sm text-gray-700">{total}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card title={`Overdue Jobs (${overdue.length})`}>
          <TBL rows={overdue} cols={[
            { key: "JobBookingNo",  label: "Job #",    render: v => <span className="font-mono text-xs font-bold">{str(v)}</span> },
            { key: "CustomerName",  label: "Customer" },
            { key: "MachineName",   label: "Machine" },
            { key: "Status",        label: "Status",   render: v => <StatusPill status={str(v)} /> },
            { key: "DaysOverdue",   label: "Overdue",  render: v => <OverdueBadge days={n(v)} /> },
          ]} />
        </Card>
      </div>

      <Card title="Machine Job Board — Active Jobs">
        <TBL maxH="max-h-96" rows={board} cols={[
          { key: "MachineName",     label: "Machine",   render: v => <span className="font-semibold text-indigo-700 text-xs">{str(v)}</span> },
          { key: "JobBookingNo",    label: "Job #",     render: v => <span className="font-mono text-xs">{str(v)}</span> },
          { key: "CustomerName",    label: "Customer" },
          { key: "JobName",         label: "Job Name" },
          { key: "Status",          label: "Status",    render: v => <StatusPill status={str(v)} /> },
          { key: "NoOfColors",      label: "Colors" },
          { key: "OrderQty",        label: "Qty",       render: (v, r) => `${fmt(v)} ${str(r.Unit)}` },
          { key: "DaysToDeadline",  label: "Deadline",  render: (v, r) => (
            <span className="text-xs whitespace-nowrap">{str(r.PlannedDate)} <DeadlineBadge days={n(v)} /></span>
          )},
        ]} />
      </Card>

      <Card title="Pending Ink / SPR">
        <TBL rows={ink} cols={[
          { key: "SPRNo",       label: "SPR No",    render: v => <span className="font-mono text-xs font-bold">{str(v)}</span> },
          { key: "ShadeName",   label: "Shade" },
          { key: "JobNo",       label: "Job #" },
          { key: "CustomerName",label: "Customer" },
          { key: "RequiredQty", label: "Qty (kg)",  render: v => fmt(v) },
          { key: "RequiredDate",label: "Required" },
          { key: "DaysOverdue", label: "Status",    render: v => n(v) > 0 ? <OverdueBadge days={n(v)} /> : <span className="text-green-600 text-xs font-semibold">On time</span> },
        ]} />
      </Card>
    </div>
  );
}

function PlanningDash({ data, loading }: { data: any; loading: boolean }) {
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const schedule = parse(data.awaitingSchedule);
  const released = parse(data.releasedJobs);
  const artwork  = parse(data.artworkPending);
  const noJC     = parse(data.ordersNoJobCard);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Awaiting Schedule"  value={schedule.length} icon={Clock}        color="#EF4444" alert />
        <Stat label="Schedule Released"  value={released.length} icon={CheckCircle}  color="#10B981" />
        <Stat label="Artwork Pending"    value={artwork.length}  icon={Palette}      color="#F59E0B" alert />
        <Stat label="Orders — No JC"     value={noJC.length}     icon={FileText}     color="#8B5CF6" alert />
      </div>

      <Card title="Jobs Awaiting Schedule Release">
        <TBL maxH="max-h-80" rows={schedule} cols={[
          { key: "JobBookingNo",    label: "Job #",      render: v => <span className="font-mono text-xs font-bold">{str(v)}</span> },
          { key: "CustomerName",    label: "Customer" },
          { key: "MachineName",     label: "Machine" },
          { key: "Status",          label: "Status",     render: v => <StatusPill status={str(v)} /> },
          { key: "Colors",          label: "Colors" },
          { key: "PendingArtColors",label: "Art Pend",   render: v => n(v) > 0 ? <span className="text-orange-600 font-bold text-xs">{str(v)}</span> : <span className="text-green-600 text-xs font-semibold">✓</span> },
          { key: "PendingInkSPR",   label: "Ink Pend",   render: v => n(v) > 0 ? <span className="text-red-600 font-bold text-xs">{str(v)}</span> : <span className="text-green-600 text-xs font-semibold">✓</span> },
          { key: "DaysToDeadline",  label: "Deadline",   render: (v, r) => <span className="text-xs whitespace-nowrap">{str(r.PlannedDate)} <DeadlineBadge days={n(v)} /></span> },
        ]} />
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Artwork Pending">
          <TBL rows={artwork} cols={[
            { key: "JobBookingNo",  label: "Job #",         render: v => <span className="font-mono text-xs font-bold">{str(v)}</span> },
            { key: "CustomerName",  label: "Customer" },
            { key: "TotalColors",   label: "Total Colors" },
            { key: "PendingColors", label: "Pending",       render: v => <span className="text-orange-600 font-bold">{str(v)}</span> },
            { key: "CurrentStage",  label: "Stage",         render: v => <span className="text-xs text-gray-500 italic">{str(v)}</span> },
          ]} />
        </Card>
        <Card title="Orders Without Job Card">
          <TBL rows={noJC} cols={[
            { key: "SalesOrderNo",  label: "Order #",  render: v => <span className="font-mono text-xs font-bold">{str(v)}</span> },
            { key: "CustomerName",  label: "Customer" },
            { key: "OrderDate",     label: "Date" },
            { key: "DaysOld",       label: "Age",      render: v => <span className={`text-xs font-bold ${n(v) > 7 ? "text-red-600" : "text-amber-600"}`}>{str(v)}d</span> },
            { key: "OrderValue",    label: "Value",    render: v => cur(v) },
          ]} />
        </Card>
      </div>

      <Card title="Released (Scheduled) Jobs">
        <TBL rows={released} cols={[
          { key: "JobBookingNo",   label: "Job #",    render: v => <span className="font-mono text-xs font-bold">{str(v)}</span> },
          { key: "CustomerName",   label: "Customer" },
          { key: "MachineName",    label: "Machine" },
          { key: "Status",         label: "Status",   render: v => <StatusPill status={str(v)} /> },
          { key: "OrderQty",       label: "Qty",      render: (v, r) => `${fmt(v)} ${str(r.Unit)}` },
          { key: "DaysToDeadline", label: "Deadline", render: (v, r) => <span className="text-xs whitespace-nowrap">{str(r.PlannedDate)} <DeadlineBadge days={n(v)} /></span> },
        ]} />
      </Card>
    </div>
  );
}

function DispatchDash({ data, loading }: { data: any; loading: boolean }) {
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const kpi        = parse(data.kpi)[0] ?? {};
  const ready      = parse(data.dispatchReady);
  const dispatches = parse(data.recentDispatches);
  const byCustomer = parse(data.dispatchByCustomer);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pending Dispatch"    value={fmt(kpi.PendingDispatch)} icon={Package}     color="#EF4444" alert />
        <Stat label="Dispatches (Period)" value={fmt(kpi.DispatchCount)}   icon={Truck}       color="#3B82F6" />
        <Stat label="Dispatch Qty (Period)" value={fmt(kpi.DispatchQty)}    icon={TrendingUp}  color="#10B981" />
        <Stat label="Today's Dispatches"  value={fmt(kpi.DispatchToday)}   icon={CheckCircle} color="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Dispatch Ready — Completed Jobs">
          <TBL rows={ready} cols={[
            { key: "JobBookingNo",      label: "Job #",          render: v => <span className="font-mono text-xs font-bold text-green-700">{str(v)}</span> },
            { key: "CustomerName",      label: "Customer" },
            { key: "SalesOrderNo",      label: "SO #" },
            { key: "OrderQty",          label: "Qty",            render: (v, r) => `${fmt(v)} ${str(r.Unit)}` },
            { key: "DaysSinceDeadline", label: "Since Deadline", render: v => n(v) > 0 ? <OverdueBadge days={n(v)} /> : <span className="text-green-600 text-xs font-semibold">On time</span> },
          ]} />
        </Card>

        <Card title="Dispatches by Customer (Period)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byCustomer} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="CustomerName" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip />
              <Bar dataKey="DispatchCount" name="Dispatches" fill="#3B82F6" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Recent Dispatches">
        <TBL rows={dispatches} cols={[
          { key: "VoucherNo",    label: "DN No",      render: v => <span className="font-mono text-xs font-bold text-indigo-600">{str(v)}</span> },
          { key: "VoucherDate",  label: "Date" },
          { key: "CustomerName", label: "Customer" },
          { key: "VehicleNo",    label: "Vehicle" },
          { key: "Transporter",  label: "Transporter" },
          { key: "TotalQty",     label: "Qty",        render: v => <span className="font-semibold">{fmt(v)}</span> },
        ]} />
      </Card>
    </div>
  );
}

function SalesDash({ data, loading }: { data: any; loading: boolean }) {
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const kpi       = parse(data.kpi)[0] ?? {};
  const trend     = parse(data.orderTrend);
  const customers = parse(data.topCustomers);
  const noJC      = parse(data.ordersNoJobCard);
  const est       = parse(data.pendingEstimations);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="New Orders (Period)"  value={fmt(kpi.NewOrders)}          icon={TrendingUp} color="#10B981" />
        <Stat label="Order Value"          value={cur(kpi.OrderValue)}          icon={Activity}   color="#3B82F6" />
        <Stat label="Active Orders"        value={fmt(kpi.ActiveOrders)}        icon={Layers}     color="#8B5CF6" />
        <Stat label="Pending Estimations"  value={fmt(kpi.PendingEstimations)}  icon={FileText}   color="#F59E0B" />
        <Stat label="Unique Customers"     value={fmt(kpi.UniqueCustomers)}     icon={Users}      color="#06B6D4" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Monthly Order Trend (6 Months)">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="MonthLabel" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="cnt" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="val" orientation="right" tick={{ fontSize: 10 }}
                     tickFormatter={v => "₹" + (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v, name) => name === "Orders" ? v : cur(v)} />
              <Legend />
              <Bar  yAxisId="cnt" dataKey="OrderCount" name="Orders"   fill="#10B981" radius={[4,4,0,0]} />
              <Area yAxisId="val" dataKey="OrderValue" name="Value (₹)" type="monotone"
                    stroke="#3B82F6" fill="#3B82F615" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top Customers by Order Value">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={customers} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }}
                     tickFormatter={v => "₹" + (v / 1000).toFixed(0) + "k"} />
              <YAxis dataKey="CustomerName" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={v => cur(v)} />
              <Bar dataKey="TotalValue" name="Order Value" fill="#8B5CF6" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Pending Estimations">
          <TBL rows={est} cols={[
            { key: "EstimationNo",  label: "Est #",    render: v => <span className="font-mono text-xs font-bold">{str(v)}</span> },
            { key: "CustomerName",  label: "Customer" },
            { key: "JobName",       label: "Job" },
            { key: "Status",        label: "Status",   render: v => <StatusPill status={str(v)} /> },
            { key: "DaysOld",       label: "Age",      render: v => <span className={`text-xs font-bold ${n(v) > 14 ? "text-red-600" : "text-amber-600"}`}>{str(v)}d</span> },
          ]} />
        </Card>
        <Card title="Orders Without Job Card">
          <TBL rows={noJC} cols={[
            { key: "SalesOrderNo",  label: "Order #",  render: v => <span className="font-mono text-xs font-bold">{str(v)}</span> },
            { key: "CustomerName",  label: "Customer" },
            { key: "OrderDate",     label: "Date" },
            { key: "DaysOld",       label: "Age",      render: v => <span className={`text-xs font-bold ${n(v) > 7 ? "text-red-600" : "text-amber-600"}`}>{str(v)}d</span> },
            { key: "OrderValue",    label: "Value",    render: v => cur(v) },
          ]} />
        </Card>
      </div>
    </div>
  );
}

function CommandCenterDash({ data, loading }: { data: any; loading: boolean }) {
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const kpi      = parse(data.kpi)[0] ?? {};
  const pipeline = parse(data.factoryPipeline);
  const machines = parse(data.machineLoad);
  const overdue  = parse(data.overdueJobs);
  const alerts   = parse(data.alerts);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Open Orders"      value={fmt(kpi.OpenOrders)}         icon={FileText}      color="#3B82F6" />
        <Stat label="Active Jobs"      value={fmt(kpi.ActiveJobs)}         icon={Factory}       color="#8B5CF6" />
        <Stat label="Overdue Jobs"     value={fmt(kpi.OverdueJobs)}        icon={AlertTriangle} color="#EF4444" alert />
        <Stat label="Dispatch Ready"   value={fmt(kpi.DispatchReady)}      icon={Package}       color="#10B981" />
        <Stat label="Dispatched (7d)"  value={fmt(kpi.DispatchedLast7Days)} icon={Truck}        color="#06B6D4" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Awaiting Schedule" value={fmt(kpi.AwaitingSchedule)}   icon={Clock}    color="#F59E0B" alert />
        <Stat label="Artwork Pending"   value={fmt(kpi.ArtworkPending)}     icon={Palette}  color="#F97316" alert />
        <Stat label="Ink SPR Pending"   value={fmt(kpi.InkSPRPending)}      icon={Activity} color="#EF4444" alert />
        <Stat label="Orders — No JC"    value={fmt(kpi.OrdersNoJobCard)}    icon={Layers}   color="#6366F1" alert />
        <Stat label="Estimations Pending" value={fmt(kpi.PendingEstimations)} icon={FileText} color="#8B5CF6" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title={`Live Alerts (${alerts.length})`}>
          {alerts.length === 0 ? (
            <div className="py-8 text-center text-green-600 font-semibold text-sm">
              <CheckCircle className="mx-auto mb-2" size={28} />
              All systems normal
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                  str(a.Severity) === "HIGH" ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"
                }`}>
                  <AlertTriangle size={13} className={`mt-0.5 shrink-0 ${str(a.Severity) === "HIGH" ? "text-red-500" : "text-amber-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">{str(a.Description)}</p>
                    <p className="text-xs text-gray-400 mt-0.5 font-medium">{str(a.AlertType)}</p>
                  </div>
                  <SevBadge sev={str(a.Severity)} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Factory Pipeline">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pipeline} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="Stage" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="Count" name="Jobs" radius={[6,6,0,0]}>
                {pipeline.map((_, i) => <Cell key={i} fill={CLR[i % CLR.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Machine Load">
          <TBL rows={machines} cols={[
            { key: "MachineName",  label: "Machine",      render: v => <span className="font-semibold text-indigo-700">{str(v)}</span> },
            { key: "TotalJobs",   label: "Total",        render: v => <span className="font-bold text-gray-800">{str(v)}</span> },
            { key: "InProgress",  label: "Running",      render: v => n(v) > 0 ? <span className="text-amber-600 font-bold">{str(v)}</span> : <span className="text-gray-300">0</span> },
            { key: "Queued",      label: "Queued",       render: v => n(v) > 0 ? <span className="text-blue-600 font-semibold">{str(v)}</span> : <span className="text-gray-300">0</span> },
            { key: "OnHold",      label: "On Hold",      render: v => n(v) > 0 ? <span className="text-purple-600 font-semibold">{str(v)}</span> : <span className="text-gray-300">0</span> },
            { key: "NextDeadline",label: "Next Deadline" },
          ]} />
        </Card>

        <Card title="Overdue Jobs">
          <TBL rows={overdue} cols={[
            { key: "JobBookingNo",  label: "Job #",    render: v => <span className="font-mono text-xs font-bold">{str(v)}</span> },
            { key: "CustomerName",  label: "Customer" },
            { key: "MachineName",   label: "Machine" },
            { key: "Status",        label: "Status",   render: v => <StatusPill status={str(v)} /> },
            { key: "DaysOverdue",   label: "Overdue",  render: v => <OverdueBadge days={n(v)} /> },
          ]} />
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GravureDashboardPage() {
  const [tab, setTab]           = useState<TabKey>("management");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading]   = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dashData, setDashData] = useState<Partial<Record<TabKey, any>>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const hasDateFilter = (t: TabKey) => ["management", "dispatch", "sales"].includes(t);

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
        setFetchError("Cannot reach the backend server at localhost:57214. Make sure the .NET backend is running (rebuild & start in Visual Studio), then click Retry.");
      } else if (msg.includes("401") || msg.includes("Session expired")) {
        setFetchError("Session expired — please refresh the page or log in again.");
      } else {
        setFetchError("Error loading dashboard data: " + msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTab(tab, fromDate, toDate);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => fetchTab(tab, fromDate, toDate), 60_000);
    return () => clearInterval(timerRef.current);
  }, [tab, fromDate, toDate, fetchTab]);

  return (
    <div className="min-h-screen bg-gray-50/60">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white">
              <BarChart2 size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Gravure Dashboard</h1>
              {lastUpdated && (
                <p className="text-xs text-gray-400">
                  Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  {loading && <span className="ml-2 text-blue-500 animate-pulse">• Refreshing</span>}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {hasDateFilter(tab) && (
              <div className="flex items-center gap-2">
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <span className="text-xs text-gray-400">to</span>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            )}
            <TutorialButton title="Gravure Dashboard — Tutorial" />
            <button onClick={() => fetchTab(tab, fromDate, toDate)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-6 flex overflow-x-auto">
          {TABS.map(t => {
            const active = t.key === tab;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  active ? "border-current" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/60"
                }`}
                style={active ? { color: t.color, borderColor: t.color } : {}}>
                <t.icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="mx-6 mt-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">Dashboard unavailable</p>
            <p className="text-xs text-red-600 mt-0.5">{fetchError}</p>
          </div>
          <button onClick={() => fetchTab(tab, fromDate, toDate)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors shrink-0">
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Dashboard content */}
      <div className="p-6">
        {tab === "management"     && <ManagementDash    data={dashData.management}       loading={loading} />}
        {tab === "production"     && <ProductionDash    data={dashData.production}       loading={loading} />}
        {tab === "planning"       && <PlanningDash      data={dashData.planning}         loading={loading} />}
        {tab === "dispatch"       && <DispatchDash      data={dashData.dispatch}         loading={loading} />}
        {tab === "sales"          && <SalesDash         data={dashData.sales}            loading={loading} />}
        {tab === "command-center" && <CommandCenterDash data={dashData["command-center"]} loading={loading} />}
      </div>
    </div>
  );
}
