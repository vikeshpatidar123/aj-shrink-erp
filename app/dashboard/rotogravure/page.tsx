"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Printer, FileText, Truck, Zap, Loader2, RefreshCw,
  Package, AlertTriangle, CheckCircle,
} from "lucide-react";
import { apiGet } from "@/lib/api";

type Row = Record<string, unknown>;
function parse(v: unknown): Row[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as Row[];
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
  return [];
}
function n(v: unknown) { return Number(v ?? 0); }
function str(v: unknown) { return String(v ?? ""); }
function todayMinus(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
const TODAY = new Date().toISOString().slice(0, 10);

// ── Small decorative sparkline ─────────────────────────────────────────────
function Spark({ pts = "0,12 16,8 32,10 48,4 64,7 80,2", color = "#8B5CF6" }: {
  pts?: string; color?: string;
}) {
  return (
    <svg width="80" height="18" viewBox="0 0 80 18" className="opacity-60 shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Redesigned KPI card ────────────────────────────────────────────────────
function RotoKpiCard({ label, value, sub, icon: Icon, sparkPts, sparkColor = "#8B5CF6" }: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; sparkPts?: string; sparkColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-3xl font-bold text-gray-800 tabular-nums mt-1 leading-none">{value}</p>
        <Spark pts={sparkPts} color={sparkColor} />
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
      <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
        <Icon size={20} className="text-white" />
      </div>
    </div>
  );
}

// ── Status badge helpers ───────────────────────────────────────────────────
const STATUS_CLS: Record<string, string> = {
  "Open":        "bg-blue-100 text-blue-700",
  "In Progress": "bg-amber-100 text-amber-700",
  "On Hold":     "bg-purple-100 text-purple-700",
  "Completed":   "bg-green-100 text-green-700",
};
function StatusPill({ s }: { s: string }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[s] ?? "bg-gray-100 text-gray-600"}`}>{s}</span>
  );
}
function DeadlineBadge({ days }: { days: number }) {
  if (days > 7)  return <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{days}d left</span>;
  if (days > 0)  return <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">{days}d left</span>;
  if (days === 0) return <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Due today</span>;
  return <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">{Math.abs(days)}d OD</span>;
}

export default function RotogravureDashboard() {
  const [mgmt, setMgmt]     = useState<any>(null);
  const [prod, setProd]     = useState<any>(null);
  const [disp, setDisp]     = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const fd = todayMinus(30);
      const [m, p, d] = await Promise.all([
        apiGet<any>(`api/gravure/dashboard/management?fromDate=${fd}&toDate=${TODAY}`),
        apiGet<any>(`api/gravure/dashboard/production`),
        apiGet<any>(`api/gravure/dashboard/dispatch?fromDate=${fd}&toDate=${TODAY}`),
      ]);
      setMgmt(m); setProd(p); setDisp(d);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpi        = parse(mgmt?.kpi)[0] ?? {};
  const dkpi       = parse(disp?.kpi)[0] ?? {};
  const machines   = parse(mgmt?.machineLoad ?? prod?.machineLoad);
  const jobs       = parse(prod?.machineJobBoard);
  const dispatches = parse(mgmt?.recentDispatches);

  const runningCount  = machines.filter(m => n(m.InProgress) > 0).length;
  const totalMachines = machines.length;

  // For chart: use TotalJobs bar per machine
  const chartData = machines.map(m => ({
    name: str(m.MachineName).split(" ").slice(0, 3).join(" "),
    InProgress: n(m.InProgress),
    Queued:     n(m.Queued),
    total:      n(m.TotalJobs),
  }));

  const timeStr = lastUpdated?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) ?? "";

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center font-black text-sm text-gray-700 tracking-tight select-none">
            iN
          </div>
          <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
            <Printer size={17} className="text-gray-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-wide leading-none">ROTOGRAVURE UNIT</h1>
            <p className="text-xs text-gray-400 mt-0.5">Printing, lamination &amp; finishing operations</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">Last updated {timeStr}</span>
          )}
          <button onClick={load} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 transition-colors">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <button className="text-xs font-bold px-3 py-1.5 rounded-full border-2 border-green-500 text-green-600 hover:bg-green-50 transition-colors tracking-wider">
            LIVE
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <AlertTriangle size={15} className="text-red-500 shrink-0" />
          <span className="text-red-700 flex-1">{error}</span>
          <button onClick={load} className="text-xs text-red-600 underline">Retry</button>
        </div>
      )}

      {loading && !mgmt ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={32} className="animate-spin text-violet-400" />
        </div>
      ) : (
        <>
          {/* ── 4 KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <RotoKpiCard
              label="Open Orders"
              value={n(kpi.OpenOrders)}
              sub="Confirmed"
              icon={FileText}
              sparkPts="0,14 16,9 32,12 48,5 64,8 80,3"
              sparkColor="#7C3AED"
            />
            <RotoKpiCard
              label="Active Jobs"
              value={n(kpi.ActiveJobCards)}
              sub="In progress/queued"
              icon={Zap}
              sparkPts="0,12 16,7 32,10 48,3 64,6 80,1"
              sparkColor="#10B981"
            />
            <RotoKpiCard
              label="Dispatch Ready"
              value={n(kpi.DispatchReady)}
              sub="Completed, not sent"
              icon={Package}
              sparkPts="0,14 16,12 32,10 48,8 64,10 80,6"
              sparkColor="#F59E0B"
            />
            <RotoKpiCard
              label="Dispatched Today"
              value={n(dkpi.DispatchToday)}
              sub="Shipments out"
              icon={Truck}
              sparkPts="0,14 16,11 32,13 48,7 64,9 80,4"
              sparkColor="#0891B2"
            />
          </div>

          {/* ── Machine Load + Press Status ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Machine Load chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Machine Load (Active Jobs)</h3>
              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No machine data</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(120, chartData.length * 50)}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 5, right: 25, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={95} />
                    <Tooltip
                      formatter={(v: any, name: any) => [v, name === "InProgress" ? "Running" : "Queued"]}
                    />
                    <Bar dataKey="InProgress" name="In Progress" stackId="a" fill="#5B21B6" />
                    <Bar dataKey="Queued"     name="Queued"      stackId="a" fill="#A78BFA" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Press Status */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">Press Status</h3>
                <span className="text-xs text-gray-400">{runningCount}/{totalMachines} active</span>
              </div>
              {machines.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No machines found</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {machines.map((m, i) => {
                    const running = n(m.InProgress) > 0;
                    const queued  = n(m.Queued) > 0 && !running;
                    const idle    = !running && !queued;
                    return (
                      <div key={i} className={`border rounded-xl p-4
                        ${running ? "border-green-200 bg-white" : queued ? "border-amber-200 bg-white" : "border-gray-200 bg-gray-50"}`}>
                        <p className="text-xs font-bold text-gray-700 truncate mb-2">{str(m.MachineName)}</p>
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${running ? "bg-green-500 animate-pulse" : queued ? "bg-amber-400" : "bg-gray-300"}`} />
                          <span className={`text-xs font-bold uppercase tracking-wide ${running ? "text-green-600" : queued ? "text-amber-600" : "text-gray-400"}`}>
                            {running ? "RUNNING" : queued ? "QUEUED" : "IDLE"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-center">
                          <div>
                            <p className="text-lg font-bold text-gray-800 tabular-nums leading-none">{n(m.InProgress)}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Running</p>
                          </div>
                          <div className="w-px h-8 bg-gray-100" />
                          <div>
                            <p className="text-lg font-bold text-gray-800 tabular-nums leading-none">{n(m.Queued)}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Queued</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Active Jobs + Recent Dispatches ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Active Jobs */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700">Active Jobs ({jobs.length})</h3>
                <Link href="/gravure/workorder" className="text-xs text-violet-600 hover:text-violet-800 font-semibold">
                  View all →
                </Link>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {jobs.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-gray-400 gap-2">
                    <CheckCircle size={24} className="text-gray-300" />
                    <p className="text-sm">No active jobs</p>
                  </div>
                ) : jobs.map((j, i) => (
                  <div key={i} className="px-3.5 py-3 bg-white rounded-xl border border-gray-200 hover:border-violet-200 hover:bg-violet-50/30 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-800">{str(j.JobBookingNo)}</span>
                          <span className="text-[10px] text-gray-400 font-medium">{str(j.MachineCode)}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{str(j.CustomerName)}</p>
                        <p className="text-xs text-gray-400 truncate">{str(j.JobName)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusPill s={str(j.Status)} />
                        <DeadlineBadge days={n(j.DaysToDeadline)} />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5 truncate">
                      {str(j.MachineName)} · {n(j.OrderQty).toLocaleString()} {str(j.Unit)} · {n(j.NoOfColors)} colors
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Dispatches */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700">Recent Dispatches</h3>
                <Link href="/gravure/dispatch" className="text-xs text-violet-600 hover:text-violet-800 font-semibold">
                  View all →
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {dispatches.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-gray-400 gap-2">
                    <Package size={24} className="text-gray-300" />
                    <p className="text-sm">No recent dispatches</p>
                  </div>
                ) : dispatches.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-indigo-600">{str(d.VoucherNo)}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{str(d.CustomerName)}</p>
                      <p className="text-[10px] text-gray-400">{str(d.VoucherDate)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-gray-800 tabular-nums leading-none">
                        {n(d.TotalQty) === 0 ? "0" : n(d.TotalQty).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">qty</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
