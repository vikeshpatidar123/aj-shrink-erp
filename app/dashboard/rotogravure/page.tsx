"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Printer, ArrowLeft, FileText, Truck, Zap, Loader2,
  RefreshCw, Package, AlertTriangle, CheckCircle,
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

function Stat({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-gray-100`}>
          <span className={color}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

const STATUS_CLR: Record<string, string> = {
  "Open":        "bg-blue-100 text-blue-700",
  "In Progress": "bg-amber-100 text-amber-700",
  "On Hold":     "bg-purple-100 text-purple-700",
  "Completed":   "bg-green-100 text-green-700",
};
function StatusPill({ s }: { s: string }) {
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLR[s] ?? "bg-gray-100 text-gray-600"}`}>{s}</span>;
}

function DeadlineBadge({ days }: { days: number }) {
  if (days > 7) return <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{days}d left</span>;
  if (days > 0) return <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">{days}d left</span>;
  if (days === 0) return <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Due today</span>;
  return <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{Math.abs(days)}d OD</span>;
}

export default function RotogravureDashboard() {
  const [mgmt, setMgmt]     = useState<any>(null);
  const [prod, setProd]     = useState<any>(null);
  const [disp, setDisp]     = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  const kpi     = parse(mgmt?.kpi)[0] ?? {};
  const dkpi    = parse(disp?.kpi)[0] ?? {};
  const machines = parse(mgmt?.machineLoad);
  const jobs    = parse(prod?.machineJobBoard);
  const dispatches = parse(mgmt?.recentDispatches);
  const statuses = parse(prod?.jobStatusDistribution);

  const runningCount = machines.filter(m => n(m.InProgress) > 0).length;
  const totalMachines = machines.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors">
            <ArrowLeft size={16} /> Dashboards
          </Link>
          <span className="text-gray-300">/</span>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <Printer size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Rotogravure Unit</h1>
              <p className="text-xs text-gray-400">Printing, lamination & finishing operations</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button onClick={load} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-green-100 text-green-700 rounded-full border border-green-200">
            <Zap size={12} /> Live
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <span className="text-red-700">{error}</span>
          <button onClick={load} className="ml-auto text-xs text-red-600 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* KPI Row */}
      {loading && !mgmt ? (
        <div className="flex items-center justify-center h-28">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Open Orders"     value={n(kpi.OpenOrders)}     sub="Confirmed"         color="text-violet-700" icon={<FileText size={20} />} />
            <Stat label="Active Jobs"     value={n(kpi.ActiveJobCards)} sub="In progress/queued" color="text-green-700"  icon={<Zap size={20} />} />
            <Stat label="Dispatch Ready"  value={n(kpi.DispatchReady)}  sub="Completed, not sent" color="text-amber-700"  icon={<Package size={20} />} />
            <Stat label="Dispatched Today" value={n(dkpi.DispatchToday)} sub="Shipments out"    color="text-teal-700"   icon={<Truck size={20} />} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Machine Load Chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Machine Load (Active Jobs)</h3>
              {machines.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No machine data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={machines} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="MachineName" type="category" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="InProgress" name="In Progress" fill="#F59E0B" stackId="a" />
                    <Bar dataKey="Queued"     name="Queued"      fill="#7C3AED" stackId="a" radius={[0, 3, 3, 0]} />
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
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {machines.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No machines found</p>
                ) : machines.map((m, i) => {
                  const running = n(m.InProgress) > 0;
                  const idle    = n(m.InProgress) === 0 && n(m.Queued) === 0;
                  return (
                    <div key={i} className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border ${
                      running ? "border-green-200 bg-green-50" : idle ? "border-gray-200 bg-gray-50" : "border-blue-100 bg-blue-50"
                    }`}>
                      <div>
                        <p className="text-xs font-bold text-gray-700">{str(m.MachineName)}</p>
                        <p className="text-xs text-gray-400">
                          {n(m.InProgress) > 0 ? `${n(m.InProgress)} running` : ""}{n(m.Queued) > 0 ? `${n(m.InProgress) > 0 ? " · " : ""}${n(m.Queued)} queued` : ""}
                          {idle ? "Idle" : ""}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        running ? "text-green-700 bg-green-100" : idle ? "text-gray-500 bg-gray-100" : "text-blue-700 bg-blue-100"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${running ? "bg-green-500" : idle ? "bg-gray-400" : "bg-blue-500"}`} />
                        {running ? "Running" : idle ? "Idle" : "Queued"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Status summary */}
              {statuses.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  {statuses.map((s, i) => {
                    const clr = STATUS_CLR[str(s.Status)] ?? "bg-gray-100 text-gray-600";
                    return (
                      <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${clr}`}>
                        {str(s.Status)}: {n(s.Count)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Active Jobs + Recent Dispatches */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Active Job Board */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700">Active Jobs ({jobs.length})</h3>
                <Link href="/gravure/workorder" className="text-xs text-violet-600 hover:underline font-medium">View all →</Link>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {jobs.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-gray-400">
                    <CheckCircle size={28} className="text-gray-300 mb-2" />
                    <p className="text-sm">No active jobs</p>
                  </div>
                ) : jobs.map((j, i) => (
                  <div key={i} className="px-3.5 py-3 bg-violet-50 rounded-xl border border-violet-100 hover:border-violet-300 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-gray-700">{str(j.JobBookingNo)}</p>
                          <span className="text-[10px] text-gray-400">{str(j.MachineCode)}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{str(j.CustomerName)}</p>
                        <p className="text-xs text-gray-400 truncate">{str(j.JobName)}</p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <StatusPill s={str(j.Status)} />
                        <div><DeadlineBadge days={n(j.DaysToDeadline)} /></div>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{str(j.MachineName)} · {n(j.OrderQty).toLocaleString()} {str(j.Unit)} · {n(j.NoOfColors)} colors</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Dispatches */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700">Recent Dispatches</h3>
                <Link href="/gravure/dispatch" className="text-xs text-violet-600 hover:underline font-medium">View all →</Link>
              </div>
              <div className="space-y-2">
                {dispatches.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No recent dispatches</p>
                ) : dispatches.map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-xs font-bold text-indigo-700">{str(d.VoucherNo)}</p>
                      <p className="text-xs text-gray-500">{str(d.CustomerName)}</p>
                      <p className="text-[10px] text-gray-400">{str(d.VoucherDate)} · {str(d.VehicleNo)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-700">{n(d.TotalQty).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">qty</p>
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
