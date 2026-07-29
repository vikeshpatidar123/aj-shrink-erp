"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Layers, Printer, ArrowRight, Activity, Package, Users, TrendingUp, Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api";
import { useCompanyName } from "@/lib/useCompanyName";

type Row = Record<string, unknown>;
function n(v: unknown) { return Number(v ?? 0); }
function parse(v: unknown): Row[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as Row[];
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
  return [];
}
function todayMinus(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
const TODAY = new Date().toISOString().slice(0, 10);

// ── Decorative sparkline ────────────────────────────────────────────────────
function Sparkline({ color = "#3B82F6", pts }: { color?: string; pts?: string }) {
  const p = pts ?? "0,16 14,10 28,14 42,5 56,9 70,3 84,7";
  return (
    <svg width="80" height="20" viewBox="0 0 84 20" className="shrink-0 opacity-70">
      <polyline points={p} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Global Status stat cell ─────────────────────────────────────────────────
function GlobalStat({ label, value, color, pts, loading }: {
  label: string; value: string; color: string; pts?: string; loading: boolean;
}) {
  return (
    <div className="pl-6 first:pl-0 first:border-l-0 border-l border-gray-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {loading
          ? <div className="h-7 w-14 bg-gray-100 rounded animate-pulse" />
          : <span className="text-2xl font-bold text-gray-800 tabular-nums">{value}</span>
        }
        <Sparkline color={color} pts={pts} />
      </div>
    </div>
  );
}

// ── Metric bar row (Efficiency / OEE) ──────────────────────────────────────
function MetricBar({ label, pct, color, sparkPts }: {
  label: string; pct: number; color: string; sparkPts?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <Sparkline color={color} pts={sparkPts} />
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-bold shrink-0" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function DashboardPage() {
  const companyName = useCompanyName("ERP");
  const [kpi, setKpi]     = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fd = todayMinus(30);
    apiGet<any>(`api/gravure/dashboard/management?fromDate=${fd}&toDate=${TODAY}`)
      .then(res => { const rows = parse(res?.kpi); setKpi(rows[0] ?? null); })
      .catch(() => setKpi(null))
      .finally(() => setLoading(false));
  }, []);

  const openOrders    = kpi ? n(kpi.OpenOrders)      : 0;
  const activeJobs    = kpi ? n(kpi.ActiveJobCards)   : 0;
  const dispatchReady = kpi ? n(kpi.DispatchReady)    : 0;
  const orderValue    = kpi ? n(kpi.OrderValuePeriod) : 0;
  const valueLabel    = `₹${(orderValue / 100000).toFixed(1)}L`;

  return (
    <div className="space-y-5">
      {/* ── Page heading ── */}
      <div className="text-center pt-2 pb-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{companyName}</p>
        <h1 className="text-3xl font-bold text-gray-800 mt-1">Production Control Centre</h1>
        <p className="text-sm text-gray-400 mt-1">Select a production unit to view its dashboard</p>
      </div>

      {/* ── Global Status bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex items-center gap-6">
        <span className="text-base font-bold text-gray-700 shrink-0">Global Status</span>
        <div className="flex-1 grid grid-cols-4">
          <GlobalStat label="Active Jobs"         value={loading ? "…" : String(activeJobs)}    color="#2563EB" loading={loading}
            pts="0,16 14,12 28,14 42,5 56,10 70,6 84,9" />
          <GlobalStat label="Open Orders"         value={loading ? "…" : String(openOrders)}    color="#6366F1" loading={loading}
            pts="0,14 14,9 28,12 42,6 56,11 70,4 84,8" />
          <GlobalStat label="Units Operational"   value="2/2"                                   color="#10B981" loading={false}
            pts="0,8 14,10 28,6 42,8 56,5 70,7 84,4" />
          <GlobalStat label="Total Value (30D)"   value={loading ? "…" : valueLabel}            color="#0891B2" loading={loading}
            pts="0,18 14,13 28,15 42,8 56,12 70,6 84,10" />
        </div>
      </div>

      {/* ── Unit Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* UNIT 1 — Extrusion */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 flex gap-4 flex-1">
            {/* Decorative illustration */}
            <div className="shrink-0 flex items-center justify-center w-28">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-2xl bg-blue-100" style={{ transform: "rotate(-8deg) scale(0.9)" }} />
                <div className="absolute inset-0 rounded-2xl bg-blue-200" style={{ transform: "rotate(-4deg) scale(0.95)" }} />
                <div className="absolute inset-0 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg">
                  <Layers size={38} className="text-white" />
                </div>
                {/* Small pipe element */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-gray-300 rounded-sm" />
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-5 h-4 bg-gray-400 rounded-sm" />
              </div>
            </div>

            {/* Unit info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">UNIT 1</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Extrusion</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-0.5">Extrusion</h2>
              <p className="text-xs text-gray-400 leading-snug mb-3">
                Film production, recipe management and multi-layer extrusion line monitoring
              </p>
              <div className="space-y-2">
                <MetricBar label="Efficiency:" pct={98} color="#16A34A"
                  sparkPts="0,14 14,9 28,11 42,4 56,7 70,2 84,5" />
                <MetricBar label="OEE:" pct={85} color="#3B82F6"
                  sparkPts="0,14 14,11 28,13 42,7 56,9 70,5 84,8" />
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
            <Link href="/dashboard/extrusion"
              className="flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-gray-700 active:bg-gray-800 text-white rounded-xl py-2.5 text-sm font-bold uppercase tracking-wider transition-colors">
              Go to Extrusion Dashboard <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* UNIT 2 — Rotogravure */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 flex gap-4 flex-1">
            {/* Unit info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">UNIT 2</span>
                {loading
                  ? <Loader2 size={13} className="animate-spin text-gray-400" />
                  : <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full
                      ${activeJobs > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {activeJobs > 0 ? `${activeJobs} Active` : "Idle"}
                    </span>
                }
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-0.5">Rotogravure</h2>
              <p className="text-xs text-gray-400 leading-snug mb-3">
                Gravure printing, lamination, coating and finishing operations
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded-xl p-3 ${activeJobs > 0 ? "bg-green-50 border border-green-100" : "bg-gray-50 border border-gray-100"}`}>
                  {loading
                    ? <div className="h-6 w-10 bg-gray-200 rounded animate-pulse mb-1" />
                    : <p className={`text-xl font-bold ${activeJobs > 0 ? "text-green-700" : "text-gray-700"}`}>{activeJobs}</p>
                  }
                  <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <Package size={9} /> Active Job Cards
                  </p>
                </div>
                <div className={`rounded-xl p-3 ${dispatchReady > 0 ? "bg-red-50 border border-red-100" : "bg-gray-50 border border-gray-100"}`}>
                  {loading
                    ? <div className="h-6 w-10 bg-gray-200 rounded animate-pulse mb-1" />
                    : <p className={`text-xl font-bold ${dispatchReady > 0 ? "text-red-700" : "text-gray-700"}`}>{dispatchReady}</p>
                  }
                  <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <Users size={9} /> Dispatch Ready
                  </p>
                </div>
              </div>
            </div>

            {/* Production flow diagram */}
            <div className="shrink-0 flex flex-col items-center gap-0 pt-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Production Flow</p>
              <div className="flex flex-col items-center gap-1">
                <div className="w-[78px] h-10 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center shadow-sm">
                  <span className="text-[10px] font-bold text-blue-700">Coating</span>
                </div>
                <div className="w-px h-3 bg-gray-300" />
                <div className="w-[78px] h-10 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center shadow-sm">
                  <span className="text-[9px] font-bold text-violet-700">Lamination</span>
                </div>
                <div className="w-px h-3 bg-gray-300" />
                <div className="w-[78px] h-10 rounded-lg bg-green-100 border border-green-200 flex items-center justify-center shadow-sm">
                  <span className="text-[10px] font-bold text-green-700">Finishing</span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
            <Link href="/dashboard/rotogravure"
              className="flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-gray-700 active:bg-gray-800 text-white rounded-xl py-2.5 text-sm font-bold uppercase tracking-wider transition-colors">
              Go to Rotogravure Dashboard <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Activity,   label: "Active Job Cards", value: loading ? "…" : String(activeJobs),  color: "#10B981" },
          { icon: Package,    label: "Dispatch Ready",   value: loading ? "…" : String(dispatchReady), color: "#F59E0B" },
          { icon: Users,      label: "Open Orders",      value: loading ? "…" : String(openOrders),  color: "#3B82F6" },
          { icon: TrendingUp, label: "Value",            value: loading ? "…" : valueLabel,           color: "#0891B2" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <Icon size={16} style={{ color }} />
            <div>
              <p className="text-xl font-bold leading-tight tabular-nums" style={{ color }}>{value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
