"use client";
import Link from "next/link";
import { Layers, Printer, ArrowRight, Activity, Package, Users, TrendingUp } from "lucide-react";
import { dashboardStats, orders, jobCards } from "@/data/dummyData";
import { useCompanyName } from "@/lib/useCompanyName";

const activeExt  = jobCards.filter(j => j.status === "In Progress" && !j.rotoJobId).length;
const activeRoto = jobCards.filter(j => j.status === "In Progress" && j.rotoJobId).length;

export default function DashboardPage() {
  const companyName = useCompanyName("ERP");
  return (
    <div className="min-h-[80vh] flex flex-col">

      {/* ── Page heading ─────────────────────────────────── */}
      <div className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
          {companyName}
        </p>
        <h1 className="text-3xl font-bold text-gray-800">Production Control Centre</h1>
        <p className="text-gray-400 text-sm mt-1">Select a production unit to view its dashboard</p>
      </div>

      {/* ── Two unit cards ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">

          {/* ── Extrusion ── */}
          <Link href="/dashboard/extrusion" className="group block">
            <div className="relative overflow-hidden rounded-2xl border-2 border-blue-100 bg-white shadow-sm
              hover:border-blue-400 hover:shadow-xl transition-all duration-300 cursor-pointer p-8">

              {/* Background accent */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50 rounded-full -translate-y-12 translate-x-12 group-hover:bg-blue-100 transition-colors" />

              {/* Icon */}
              <div className="relative z-10 mb-6 w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center
                shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Layers size={30} className="text-white" />
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-500">Unit 1</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${activeExt > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {activeExt > 0 ? `${activeExt} Active` : "Idle"}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Extrusion</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Film production, recipe management and multi-layer extrusion operations
                </p>

                {/* Mini stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-xl font-bold text-blue-700">{dashboardStats.extrusionOutput.toLocaleString()}</p>
                    <p className="text-xs text-blue-500 font-medium">Kg Today</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-xl font-bold text-blue-700">3</p>
                    <p className="text-xs text-blue-500 font-medium">Lines Running</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm
                  group-hover:gap-3 transition-all">
                  Open Dashboard <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </Link>

          {/* ── Rotogravure ── */}
          <Link href="/dashboard/rotogravure" className="group block">
            <div className="relative overflow-hidden rounded-2xl border-2 border-violet-100 bg-white shadow-sm
              hover:border-violet-400 hover:shadow-xl transition-all duration-300 cursor-pointer p-8">

              {/* Background accent */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-violet-50 rounded-full -translate-y-12 translate-x-12 group-hover:bg-violet-100 transition-colors" />

              {/* Icon */}
              <div className="relative z-10 mb-6 w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center
                shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Printer size={30} className="text-white" />
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-violet-500">Unit 2</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${activeRoto > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {activeRoto > 0 ? `${activeRoto} Active` : "Idle"}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Rotogravure</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Gravure printing, lamination, coating and finishing operations
                </p>

                {/* Mini stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-violet-50 rounded-xl p-3">
                    <p className="text-xl font-bold text-violet-700">{dashboardStats.rotoOutput.toLocaleString()}</p>
                    <p className="text-xs text-violet-500 font-medium">Kg Today</p>
                  </div>
                  <div className="bg-violet-50 rounded-xl p-3">
                    <p className="text-xl font-bold text-violet-700">{dashboardStats.activeRotoJobs}</p>
                    <p className="text-xs text-violet-500 font-medium">Roto Jobs</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-violet-600 font-semibold text-sm
                  group-hover:gap-3 transition-all">
                  Open Dashboard <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Bottom summary strip ──────────────────────────── */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto w-full px-4">
        {[
          { icon: <Activity size={15} />, label: "Active Job Cards", value: dashboardStats.activeJobCards, color: "text-green-600" },
          { icon: <Package size={15} />,  label: "Pending Orders",   value: dashboardStats.pendingOrders, color: "text-amber-600" },
          { icon: <Users size={15} />,    label: "Total Customers",  value: dashboardStats.totalCustomers, color: "text-blue-600" },
          { icon: <TrendingUp size={15} />, label: "Revenue (Month)", value: `₹${(dashboardStats.monthlyRevenue / 100000).toFixed(1)}L`, color: "text-teal-600" },
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
