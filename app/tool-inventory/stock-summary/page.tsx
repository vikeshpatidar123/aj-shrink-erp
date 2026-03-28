"use client";
import { useState, useMemo } from "react";
import { Wrench } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import {
  toolInventory as toolInventoryData, ToolInventory,
  ToolType, ToolStatus, ToolCondition,
} from "@/data/dummyData";

// ─── Constants ───────────────────────────────────────────────
const TOOL_TYPES: ToolType[] = ["Cylinder", "Sleeve", "Die", "Anilox Roll", "Doctor Blade", "Impression Roller", "Slitter Knife"];
const STATUSES: ToolStatus[] = ["Available", "In Use", "Under Maintenance", "Retired"];

// ─── Badge helpers ───────────────────────────────────────────
const STATUS_CLS: Record<ToolStatus, string> = {
  Available:          "bg-green-100 text-green-700",
  "In Use":           "bg-blue-100 text-blue-700",
  "Under Maintenance":"bg-amber-100 text-amber-700",
  Retired:            "bg-gray-100 text-gray-500",
};

const CONDITION_CLS: Record<ToolCondition, string> = {
  New:  "bg-green-100 text-green-700",
  Good: "bg-blue-100 text-blue-700",
  Fair: "bg-amber-100 text-amber-700",
  Worn: "bg-red-100 text-red-700",
};

const TYPE_CLS: Record<ToolType, string> = {
  Cylinder:           "bg-purple-100 text-purple-700",
  Sleeve:             "bg-indigo-100 text-indigo-700",
  Die:                "bg-pink-100 text-pink-700",
  "Anilox Roll":      "bg-cyan-100 text-cyan-700",
  "Doctor Blade":     "bg-orange-100 text-orange-700",
  "Impression Roller":"bg-teal-100 text-teal-700",
  "Slitter Knife":    "bg-red-100 text-red-700",
};

const Badge = ({ label, cls }: { label: string; cls: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
);

// ─── Columns ─────────────────────────────────────────────────
const columns: Column<ToolInventory>[] = [
  { key: "code",      header: "Code",        render: r => <span className="font-mono text-xs text-gray-700">{r.code}</span> },
  { key: "toolName",  header: "Tool Name",   render: r => <span className="font-medium text-gray-800">{r.toolName}</span> },
  { key: "toolType",  header: "Type",        render: r => <Badge label={r.toolType} cls={TYPE_CLS[r.toolType]} /> },
  { key: "serialNo",  header: "Serial No",   render: r => <span className="font-mono text-xs">{r.serialNo || "—"}</span> },
  { key: "condition", header: "Condition",   render: r => <Badge label={r.condition} cls={CONDITION_CLS[r.condition]} /> },
  { key: "status",    header: "Status",      render: r => <Badge label={r.status} cls={STATUS_CLS[r.status]} /> },
  { key: "location",  header: "Location",    render: r => <span className="text-xs text-gray-600">{r.location}</span> },
];

// ─── Main Component ───────────────────────────────────────────
export default function ToolStockSummaryPage() {
  const [typeFilter, setTypeFilter]     = useState<"All" | ToolType>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | ToolStatus>("All");

  const filtered = useMemo(() => {
    return toolInventoryData.filter(t => {
      if (typeFilter !== "All" && t.toolType !== typeFilter) return false;
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      return true;
    });
  }, [typeFilter, statusFilter]);

  const stats = useMemo(() => ({
    total:        toolInventoryData.length,
    available:    toolInventoryData.filter(t => t.status === "Available").length,
    inUse:        toolInventoryData.filter(t => t.status === "In Use").length,
    maintenance:  toolInventoryData.filter(t => t.status === "Under Maintenance").length,
    retired:      toolInventoryData.filter(t => t.status === "Retired").length,
  }), []);

  const chipCls = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
      active
        ? "bg-purple-600 text-white border-purple-600"
        : "bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600"
    }`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shadow">
          <Wrench size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Tool Stock Summary</h1>
          <p className="text-xs text-gray-500">Read-only view of all tool inventory records</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4 bg-gray-50 text-gray-700 border-gray-200">
          <p className="text-xs font-medium">Total Tools</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="rounded-xl border p-4 bg-green-50 text-green-700 border-green-200">
          <p className="text-xs font-medium">Available</p>
          <p className="text-2xl font-bold mt-1">{stats.available}</p>
        </div>
        <div className="rounded-xl border p-4 bg-blue-50 text-blue-700 border-blue-200">
          <p className="text-xs font-medium">In Use</p>
          <p className="text-2xl font-bold mt-1">{stats.inUse}</p>
        </div>
        <div className="rounded-xl border p-4 bg-amber-50 text-amber-700 border-amber-200">
          <p className="text-xs font-medium">Under Maintenance</p>
          <p className="text-2xl font-bold mt-1">{stats.maintenance}</p>
        </div>
      </div>

      {/* Type Filter Chips */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2">
          Filter by Type
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={chipCls(typeFilter === "All")} onClick={() => setTypeFilter("All")}>All</button>
          {TOOL_TYPES.map(t => (
            <button key={t} className={chipCls(typeFilter === t)} onClick={() => setTypeFilter(t)}>{t}</button>
          ))}
        </div>

        <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mt-2">
          Filter by Status
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={chipCls(statusFilter === "All")} onClick={() => setStatusFilter("All")}>All</button>
          {STATUSES.map(s => (
            <button key={s} className={chipCls(statusFilter === s)} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            Showing {filtered.length} of {toolInventoryData.length} records
          </span>
        </div>
        <DataTable data={filtered} columns={columns} />
      </div>
    </div>
  );
}
