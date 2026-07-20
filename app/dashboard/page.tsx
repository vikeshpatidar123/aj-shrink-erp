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

export default function DashboardPage() {
  const companyName = useCompanyName("ERP");
  const [kpi, setKpi]       = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fd = todayMinus(30);
    apiGet<any>(`api/gravure/dashboard/management?fromDate=${fd}&toDate=${TODAY}`)
      .then(res => {
        const rows = parse(res?.kpi);
        setKpi(rows[0] ?? null);
      })
      .catch(() => setKpi(null))
      .finally(() => setLoading(false));
  }, []);

  const openOrders    = kpi ? n(kpi.OpenOrders)         : 0;
  const activeJobs    = kpi ? n(kpi.ActiveJobCards)      : 0;
  const dispatchReady = kpi ? n(kpi.DispatchReady)       : 0;
  const orderValue    = kpi ? n(kpi.OrderValuePeriod)    : 0;

  return (
    <div className="min-h-[80vh] flex flex-col">

      {/* Page heading */}
      <div className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
          {companyName}
        </p>
        <h1 className="text-3xl font-bold text-gray-800">Production Control Centre</h1>
        <p className="text-gray-400 text-sm mt-1">Select a production unit to view its dashboard</p>
      </div>

      {/* Unit cards */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">

          {/* Extrusion */}
          <Link href="/dashboard/extrusion" className="group block">
            <div className="relative overflow-hidden rounded-2xl border-2 border-blue-100 bg-white shadow-sm
              hover:border-blue-400 hover:shadow-xl transition-all duration-300 cursor-pointer p-8">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50 rounded-full -translate-y-12 translate-x-12 group-hover:bg-blue-100 transition-colors" />
              <div className="relative z-10 mb-6 w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Layers size={30} className="text-white" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-500">Unit 1</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Extrusion</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Extrusion</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Film production, recipe management and multi-layer extrusion operations
                </p>
                <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm group-hover:gap-3 transition-all">
                  Open Dashboard <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </Link>

          {/* Rotogravure */}
          <Link href="/dashboard/rotogravure" className="group block">
            <div className="relative overflow-hidden rounded-2xl border-2 border-violet-100 bg-white shadow-sm
              hover:border-violet-400 hover:shadow-xl transition-all duration-300 cursor-pointer p-8">
              <div className="absolute top-0 right-0 w-40 h-40 bg-violet-50 rounded-full -translate-y-12 translate-x-12 group-hover:bg-violet-100 transition-colors" />
              <div className="relative z-10 mb-6 w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Printer size={30} className="text-white" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-violet-500">Unit 2</span>
                  {loading ? (
                    <Loader2 size={14} className="animate-spin text-violet-400" />
                  ) : (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      activeJobs > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {activeJobs > 0 ? `${activeJobs} Active` : "Idle"}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Rotogravure</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Gravure printing, lamination, coating and finishing operations
                </p>

                {/* Mini stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-violet-50 rounded-xl p-3">
                    {loading ? (
                      <div className="h-6 w-10 bg-violet-100 rounded animate-pulse mb-1" />
                    ) : (
                      <p className="text-xl font-bold text-violet-700">{openOrders}</p>
                    )}
                    <p className="text-xs text-violet-500 font-medium">Open Orders</p>
                  </div>
                  <div className="bg-violet-50 rounded-xl p-3">
                    {loading ? (
                      <div className="h-6 w-10 bg-violet-100 rounded animate-pulse mb-1" />
                    ) : (
                      <p className="text-xl font-bold text-violet-700">{dispatchReady}</p>
                    )}
                    <p className="text-xs text-violet-500 font-medium">Dispatch Ready</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-violet-600 font-semibold text-sm group-hover:gap-3 transition-all">
                  Open Dashboard <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Bottom summary strip */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto w-full px-4">
        {[
          {
            icon: <Activity size={15} />, label: "Active Job Cards",
            value: loading ? "…" : String(activeJobs), color: "text-green-600",
          },
          {
            icon: <Package size={15} />, label: "Dispatch Ready",
            value: loading ? "…" : String(dispatchReady), color: "text-amber-600",
          },
          {
            icon: <Users size={15} />, label: "Open Orders",
            value: loading ? "…" : String(openOrders), color: "text-blue-600",
          },
          {
            icon: <TrendingUp size={15} />, label: "Order Value (30d)",
            value: loading ? "…" : `₹${(orderValue / 100000).toFixed(1)}L`, color: "text-teal-600",
          },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className={color}>{icon}</span>
            <div>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
