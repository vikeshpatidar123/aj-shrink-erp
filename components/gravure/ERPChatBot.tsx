"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiPost, apiGet } from "@/lib/api";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatRole = "user" | "bot";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  result?: BotResult;
  ts: number;
}

interface BotResult {
  intent: string;
  title: string;
  message: string;
  data: Record<string, unknown>[];
  navigationUrl: string;
  quickReplies: string[];
  choices?: { label: string; query: string }[];
}

// Lightweight session context — sent with every request so the backend
// can resolve pronouns like "iska/uska/same client ke orders"
interface SessionCtx {
  clientName?: string;
  orderNo?: string;
  jobNo?: string;
  catalogNo?: string;
}

// Phase 6 — role-aware mode
type ChatMode = "all" | "manager" | "production" | "dispatch" | "sales";
interface UserCtx { userName: string; isAdmin: boolean; roleName: string; }

// ─── Quick prompt catalog ─────────────────────────────────────────────────────

interface QuickPrompt { icon: string; label: string; query: string; group: string }

const ALL_PROMPTS: QuickPrompt[] = [
  { group: "Orders",     icon: "📦", label: "Pending Orders",       query: "Show pending orders"              },
  { group: "Orders",     icon: "🕐", label: "Recent Orders",        query: "Show recent orders"               },
  { group: "Orders",     icon: "🔄", label: "Pending Production",   query: "Orders pending production dikhao" },
  { group: "Job Cards",  icon: "🔧", label: "Open Job Cards",       query: "Show pending job cards"           },
  { group: "Job Cards",  icon: "✅", label: "Released Jobs",        query: "Released jobs dikhao"             },
  { group: "Job Cards",  icon: "📅", label: "Unreleased Jobs",      query: "Pending schedule release dikhao"  },
  { group: "Estimation", icon: "📝", label: "Pending Estimations",  query: "Pending estimations dikhao"       },
  { group: "Estimation", icon: "🆕", label: "Recent Estimations",   query: "Recent estimations dikhao"        },
  { group: "Catalog",    icon: "📋", label: "Search Catalog",       query: "catalog"                          },
  { group: "Catalog",    icon: "👤", label: "Client Catalog",       query: "catalog by client"                },
  { group: "Artwork",    icon: "🎨", label: "Pending Artwork",      query: "Pending artwork dikhao"           },
  { group: "Dispatch",   icon: "🚚", label: "Dispatch Pending",     query: "Dispatch pending dikhao"          },
  { group: "Dispatch",   icon: "📬", label: "Recent Dispatches",    query: "Recent dispatches dikhao"         },
  { group: "Ink",        icon: "🖌️", label: "Pending Ink SPR",     query: "Pending ink SPR dikhao"           },
  { group: "Inventory",  icon: "📊", label: "Check Stock",          query: "stock"                            },
  { group: "Inventory",  icon: "🏭", label: "All Machines",         query: "All machines dikhao"              },
  { group: "Workflow",   icon: "🔗", label: "Orders No Job Card",   query: "Orders without job card dikhao"   },
  { group: "Workflow",   icon: "⚡", label: "Dispatch Ready Jobs",  query: "Dispatch ready completed jobs"    },
  { group: "Workflow",   icon: "🔍", label: "Job Workflow",         query: "job workflow"                     },
  { group: "Workflow",   icon: "📈", label: "Order Workflow",       query: "order workflow"                   },
  { group: "Manager",    icon: "📊", label: "Ops Dashboard",        query: "Aaj ka operations summary dikhao" },
  { group: "Manager",    icon: "🏆", label: "Top Active Clients",   query: "Top active clients dikhao"        },
  { group: "Manager",    icon: "🖨️", label: "Machine Load",        query: "Machine load summary dikhao"      },
  { group: "Manager",    icon: "🕰️", label: "Oldest Open Orders",  query: "Oldest open orders dikhao"        },
  { group: "Manager",    icon: "🚨", label: "Stuck / Overdue Jobs", query: "Stuck overdue jobs dikhao"        },
  { group: "Manager",    icon: "📅", label: "Await Schedule",       query: "Jobs awaiting schedule dikhao"    },
];

const PROMPT_GROUPS = ["Manager", "Orders", "Job Cards", "Estimation", "Catalog", "Artwork", "Dispatch", "Ink", "Inventory", "Workflow"];

// Phase 6 — mode → visible group subset
const MODE_GROUPS: Record<ChatMode, string[]> = {
  all:        ["Manager", "Orders", "Job Cards", "Estimation", "Catalog", "Artwork", "Dispatch", "Ink", "Inventory", "Workflow"],
  manager:    ["Manager", "Workflow", "Orders", "Job Cards", "Dispatch"],
  production: ["Job Cards", "Artwork", "Ink", "Inventory", "Workflow"],
  dispatch:   ["Dispatch", "Inventory", "Job Cards"],
  sales:      ["Orders", "Estimation", "Catalog"],
};
const MODE_LABELS: { mode: ChatMode; label: string; icon: string }[] = [
  { mode: "all",        label: "All",        icon: "⊞" },
  { mode: "manager",    label: "Manager",    icon: "📊" },
  { mode: "production", label: "Production", icon: "🖨" },
  { mode: "dispatch",   label: "Dispatch",   icon: "📦" },
  { mode: "sales",      label: "Sales",      icon: "💼" },
];

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const esc = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const csv = [headers.join(","), ...data.map(row => headers.map(h => esc(row[h])).join(","))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "Confirmed" || status === "Approved" ? "bg-green-100 text-green-700" :
    status === "Open"      || status === "Draft"    ? "bg-blue-100 text-blue-700"   :
    status === "Pending"   || status === "Quoted"   ? "bg-yellow-100 text-yellow-700" :
    status === "Completed" || status === "Released" ? "bg-teal-100 text-teal-700"   :
    status === "On Hold"   || status === "Cancelled"? "bg-red-100 text-red-600"     :
    "bg-gray-100 text-gray-600";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${color}`}>{status || "—"}</span>;
}

function StageBadge({ stage }: { stage: string }) {
  const color =
    stage === "Released"            ? "bg-teal-100 text-teal-700"     :
    stage === "Cylinder Received"   ? "bg-green-100 text-green-700"   :
    stage === "Cylinder Ordered"    ? "bg-blue-100 text-blue-700"     :
    stage === "Brand Approved" ||
    stage === "LSD Approved"        ? "bg-purple-100 text-purple-700" :
    "bg-yellow-100 text-yellow-700";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}>{stage}</span>;
}

// ─── Result card components ───────────────────────────────────────────────────

function OrderCard({ row }: { row: Record<string, unknown> }) {
  const status = String(row.Status ?? "");
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold text-teal-700">{String(row.SalesOrderNo ?? "—")}</span>
        <StatusBadge status={status} />
      </div>
      <div className="text-gray-700 font-medium truncate">{String(row.CustomerName ?? "—")}</div>
      <div className="flex justify-between text-gray-400 mt-1 text-[10px]">
        <span>{String(row.OrderDate ?? "")}</span>
        <span className="font-semibold text-gray-700">₹{Number(row.TotalAmount ?? 0).toLocaleString("en-IN")}</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="flex gap-3 text-gray-400 text-[10px]">
          {Number(row.LineCount ?? 0) > 0 && <span>{Number(row.LineCount)} item{Number(row.LineCount) > 1 ? "s" : ""}</span>}
          {String(row.PONo ?? "") && <span>PO: {String(row.PONo)}</span>}
        </div>
        {Number(row.AgeDays ?? 0) > 0 && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${Number(row.AgeDays) > 30 ? "bg-red-100 text-red-600" : Number(row.AgeDays) > 14 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
            {Number(row.AgeDays)}d old
          </span>
        )}
      </div>
    </div>
  );
}

function CatalogCard({ row }: { row: Record<string, unknown> }) {
  const active = Number(row.IsActive ?? 1);
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-indigo-700">{String(row.CatalogNo ?? "—")}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
          {active ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="text-gray-800 font-medium truncate">{String(row.ProductName ?? "—")}</div>
      <div className="text-gray-500 text-[10px] truncate">{String(row.CustomerName ?? "")}</div>
      <div className="flex gap-3 text-gray-400 mt-1 flex-wrap text-[10px]">
        {!!row.ContentType && <span>{String(row.ContentType)}</span>}
        {Number(row.JobWidth ?? 0) > 0 && <span>{Number(row.JobWidth)}×{Number(row.JobHeight)}mm</span>}
        {Number(row.NoOfColors ?? 0) > 0 && <span>{Number(row.NoOfColors)}C</span>}
        {!!row.Substrate && <span>{String(row.Substrate)}</span>}
      </div>
    </div>
  );
}

function ClientCard({ row }: { row: Record<string, unknown> }) {
  const city  = String(row.City  ?? "");
  const state = String(row.State ?? "");
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="font-bold text-gray-800 mb-1">{String(row.CustomerName ?? "—")}</div>
      {(city || state) && <div className="text-gray-500 text-[10px]">{[city, state].filter(Boolean).join(", ")}</div>}
      {!!row.GSTNumber && <div className="text-gray-400 font-mono text-[10px]">{String(row.GSTNumber)}</div>}
      {!!row.Mobile    && <div className="text-teal-600 text-[10px]">{String(row.Mobile)}</div>}
      {!!row.Email     && <div className="text-gray-400 text-[10px] truncate">{String(row.Email)}</div>}
    </div>
  );
}

function JobCardCard({ row }: { row: Record<string, unknown> }) {
  const status = String(row.Status ?? "Open");
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-orange-700">{String(row.JobBookingNo ?? "—")}</span>
        <StatusBadge status={status} />
      </div>
      <div className="text-gray-800 font-medium truncate">{String(row.JobName ?? "—")}</div>
      <div className="text-gray-500 text-[10px] truncate">{String(row.CustomerName ?? "")}</div>
      <div className="flex gap-3 text-gray-400 mt-1 flex-wrap text-[10px]">
        {!!row.MachineName && <span>🖨 {String(row.MachineName)}</span>}
        {!!row.PlannedDate  && <span>📅 {String(row.PlannedDate)}</span>}
        {Number(row.Quantity ?? 0) > 0 && <span>{Number(row.Quantity).toLocaleString()} {String(row.Unit ?? "")}</span>}
        {!!row.SalesOrderNo  && <span>SO: {String(row.SalesOrderNo)}</span>}
        {Number(row.NoOfColors ?? 0) > 0 && <span>{Number(row.NoOfColors)}C</span>}
      </div>
      {Number(row.DaysOverdue ?? 0) > 0 && (
        <div className="mt-1">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-red-100 text-red-600">
            {Number(row.DaysOverdue)}d overdue
          </span>
        </div>
      )}
    </div>
  );
}

function EstimationCard({ row }: { row: Record<string, unknown> }) {
  const status = String(row.Status ?? "Draft");
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-purple-700">{String(row.EstimationNo ?? "—")}</span>
        <StatusBadge status={status} />
      </div>
      <div className="text-gray-800 font-medium truncate">{String(row.JobName ?? "—")}</div>
      <div className="text-gray-500 text-[10px] truncate">{String(row.CustomerName ?? "")}</div>
      <div className="flex gap-3 text-gray-400 mt-1 flex-wrap text-[10px]">
        {!!row.EstDate     && <span>📅 {String(row.EstDate)}</span>}
        {!!row.ContentType && <span>{String(row.ContentType)}</span>}
        {Number(row.JobWidth ?? 0) > 0 && <span>{Number(row.JobWidth)}×{Number(row.JobHeight)}mm</span>}
        {Number(row.NoOfColors ?? 0) > 0 && <span>{Number(row.NoOfColors)}C</span>}
      </div>
      {Number(row.TotalAmount ?? 0) > 0 && (
        <div className="text-right text-[10px] text-gray-700 font-semibold mt-0.5">
          ₹{Number(row.TotalAmount).toLocaleString("en-IN")}
        </div>
      )}
    </div>
  );
}

function DispatchCard({ row }: { row: Record<string, unknown> }) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-teal-700">{String(row.JobBookingNo ?? "—")}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-700">Ready</span>
      </div>
      <div className="text-gray-800 font-medium truncate">{String(row.JobName ?? "—")}</div>
      <div className="text-gray-500 text-[10px] truncate">{String(row.CustomerName ?? "")}</div>
      <div className="flex gap-3 text-gray-400 mt-1 flex-wrap text-[10px]">
        {!!row.SalesOrderNo  && <span>SO: {String(row.SalesOrderNo)}</span>}
        {!!row.CatalogNo     && <span>PC: {String(row.CatalogNo)}</span>}
        {Number(row.OrderQuantity ?? 0) > 0 && <span>{Number(row.OrderQuantity).toLocaleString()} {String(row.Unit ?? "")}</span>}
      </div>
    </div>
  );
}

function ArtworkCard({ row }: { row: Record<string, unknown> }) {
  const stage    = String(row.Stage ?? row.CurrentStage ?? "Artwork Pending");
  const isGrouped = "TotalColors" in row;
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-pink-700">{String(row.JobBookingNo ?? "—")}</span>
        <StageBadge stage={stage} />
      </div>
      <div className="text-gray-800 font-medium truncate">{String(row.JobName ?? "—")}</div>
      <div className="text-gray-500 text-[10px] truncate">{String(row.CustomerName ?? "")}</div>
      {isGrouped ? (
        <div className="flex gap-3 mt-1 text-[10px]">
          <span className="text-gray-400">Total: {Number(row.TotalColors ?? 0)}C</span>
          <span className="text-teal-600">{Number(row.ReleasedColors ?? 0)}C released</span>
          <span className="text-yellow-600">{Number(row.PendingColors ?? 0)}C pending</span>
        </div>
      ) : (
        <div className="flex gap-3 text-gray-400 mt-1 flex-wrap text-[10px]">
          {!!row.ColorNo             && <span>Color {String(row.ColorNo)}</span>}
          {!!row.ArtworkReceivedDate && <span>Received: {String(row.ArtworkReceivedDate)}</span>}
          {!!row.CylinderExpectedDate && <span>Cyl ETA: {String(row.CylinderExpectedDate)}</span>}
        </div>
      )}
    </div>
  );
}

function InkCard({ row }: { row: Record<string, unknown> }) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-orange-600">{String(row.SPRNo ?? "—")}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700">Pending Mix</span>
      </div>
      <div className="text-gray-800 font-medium truncate">{String(row.ShadeName ?? "—")}</div>
      <div className="flex gap-3 text-gray-400 mt-1 flex-wrap text-[10px]">
        {!!row.JobBookingNo  && <span>JC: {String(row.JobBookingNo)}</span>}
        {!!row.CustomerName  && <span>{String(row.CustomerName)}</span>}
        {Number(row.RequiredQty ?? 0) > 0 && <span>Qty: {Number(row.RequiredQty)} Kg</span>}
        {!!row.RequiredDate  && <span>By: {String(row.RequiredDate)}</span>}
      </div>
    </div>
  );
}

function ScheduleCard({ row }: { row: Record<string, unknown> }) {
  const status = String(row.Status ?? "Open");
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-blue-700">{String(row.JobBookingNo ?? "—")}</span>
        <StatusBadge status={status} />
      </div>
      <div className="text-gray-800 font-medium truncate">{String(row.JobName ?? "—")}</div>
      <div className="text-gray-500 text-[10px] truncate">{String(row.CustomerName ?? "")}</div>
      <div className="flex gap-3 text-gray-400 mt-1 flex-wrap text-[10px]">
        {!!row.MachineName && <span>🖨 {String(row.MachineName)}</span>}
        {!!row.PlannedDate  && <span>📅 {String(row.PlannedDate)}</span>}
        {Number(row.ReleasedProcessCount ?? 0) > 0 && (
          <span className="text-teal-600">{Number(row.ReleasedProcessCount)} process released</span>
        )}
      </div>
    </div>
  );
}

function DispatchDoneCard({ row }: { row: Record<string, unknown> }) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-teal-700">{String(row.DispatchNo ?? "—")}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-700">Dispatched</span>
      </div>
      <div className="text-gray-700 font-medium truncate">{String(row.CustomerName ?? "—")}</div>
      <div className="flex gap-3 text-gray-400 mt-1 flex-wrap text-[10px]">
        {!!row.DispatchDate  && <span>📅 {String(row.DispatchDate)}</span>}
        {!!row.VehicleNo     && <span>🚚 {String(row.VehicleNo)}</span>}
        {!!row.Transporter   && <span>{String(row.Transporter)}</span>}
        {Number(row.LineCount ?? 0) > 0 && <span>{Number(row.LineCount)} line{Number(row.LineCount) > 1 ? "s" : ""}</span>}
        {Number(row.TotalQty ?? 0) > 0  && <span>Qty: {Number(row.TotalQty).toLocaleString()}</span>}
      </div>
      {!!row.JobBookingNo && (
        <div className="text-gray-400 text-[10px] mt-0.5">
          JC: {String(row.JobBookingNo)}
          {!!row.SalesOrderNo ? ` · SO: ${String(row.SalesOrderNo)}` : ""}
        </div>
      )}
    </div>
  );
}

function StockCard({ row }: { row: Record<string, unknown> }) {
  const avail  = Number(row.AvailableStock  ?? 0);
  const phys   = Number(row.PhysicalStock   ?? 0);
  const alloc  = Number(row.AllocatedStock  ?? 0);
  const incoming = Number(row.IncomingStock ?? 0);
  const lowStock = avail <= 0;
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-emerald-700 truncate">{String(row.ItemName ?? "—")}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${lowStock ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
          {lowStock ? "Low / Zero" : "In Stock"}
        </span>
      </div>
      {!!row.ItemCode && <div className="text-gray-400 font-mono text-[10px]">{String(row.ItemCode)}</div>}
      {!!row.ItemGroup && <div className="text-gray-500 text-[10px]">{String(row.ItemGroup)}</div>}
      <div className="grid grid-cols-3 gap-1 mt-1.5 text-center">
        <div className="bg-gray-50 rounded p-1">
          <div className="text-[9px] text-gray-400">Physical</div>
          <div className="font-semibold text-gray-700 text-[11px]">{phys.toLocaleString()}</div>
        </div>
        <div className="bg-yellow-50 rounded p-1">
          <div className="text-[9px] text-yellow-500">Allocated</div>
          <div className="font-semibold text-yellow-700 text-[11px]">{alloc.toLocaleString()}</div>
        </div>
        <div className={`${lowStock ? "bg-red-50" : "bg-emerald-50"} rounded p-1`}>
          <div className="text-[9px] text-emerald-600">Available</div>
          <div className={`font-bold text-[11px] ${lowStock ? "text-red-600" : "text-emerald-700"}`}>{avail.toLocaleString()}</div>
        </div>
      </div>
      {incoming > 0 && (
        <div className="text-[10px] text-blue-500 mt-0.5">Incoming: {incoming.toLocaleString()} {String(row.StockUnit ?? "")}</div>
      )}
    </div>
  );
}

function MachineCard({ row }: { row: Record<string, unknown> }) {
  const activeJobs = Number(row.ActiveJobs ?? 0);
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-violet-700">{String(row.MachineName ?? "—")}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${activeJobs > 0 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>
          {activeJobs > 0 ? `${activeJobs} active` : "Idle"}
        </span>
      </div>
      {!!row.MachineCode && <div className="text-gray-400 font-mono text-[10px]">{String(row.MachineCode)}</div>}
      <div className="flex gap-3 text-gray-400 mt-1 flex-wrap text-[10px]">
        {Number(row.MaxSpeed ?? 0) > 0    && <span>Max: {Number(row.MaxSpeed)} m/min</span>}
        {Number(row.WorkingWidth ?? 0) > 0 && <span>W: {Number(row.WorkingWidth)} mm</span>}
        {Number(row.Colors ?? 0) > 0       && <span>{Number(row.Colors)}C</span>}
      </div>
    </div>
  );
}

function ClientSummaryCard({ row }: { row: Record<string, unknown> }) {
  const city  = String(row.City  ?? "");
  const state = String(row.State ?? "");
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="font-bold text-gray-800 mb-1 truncate">{String(row.CustomerName ?? "—")}</div>
      {(city || state) && <div className="text-gray-500 text-[10px]">{[city, state].filter(Boolean).join(", ")}</div>}
      {!!row.GSTIN && <div className="text-gray-400 font-mono text-[10px]">{String(row.GSTIN)}</div>}
      {!!row.Mobile && <div className="text-teal-600 text-[10px]">{String(row.Mobile)}</div>}
      <div className="grid grid-cols-4 gap-1 mt-2 text-center">
        {[
          { label: "Orders",      value: Number(row.OpenOrders        ?? 0), color: "bg-teal-50 text-teal-700"    },
          { label: "Job Cards",   value: Number(row.OpenJobCards      ?? 0), color: "bg-orange-50 text-orange-700"},
          { label: "Estimations", value: Number(row.PendingEstimations ?? 0), color: "bg-purple-50 text-purple-700"},
          { label: "Catalogs",    value: Number(row.ActiveCatalogs    ?? 0), color: "bg-indigo-50 text-indigo-700"},
        ].map(({ label, value, color }) => (
          <div key={label} className={`${color} rounded p-1`}>
            <div className="text-[9px] opacity-70">{label}</div>
            <div className="font-bold text-[13px]">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Phase 5 — Ops/Manager Cards ─────────────────────────────────────────────

function OpsSummaryCard({ row, onQuery }: { row: Record<string, unknown>; onQuery: (q: string) => void }) {
  const metrics = [
    { label: "Open Orders",     value: Number(row.OpenOrders       ?? 0), color: "bg-teal-50 text-teal-700",     query: "Show pending orders"                       },
    { label: "Active Jobs",     value: Number(row.ActiveJobs        ?? 0), color: "bg-orange-50 text-orange-700", query: "Show pending job cards"                    },
    { label: "Dispatch Ready",  value: Number(row.DispatchReadyJobs ?? 0), color: "bg-green-50 text-green-700",   query: "Dispatch pending dikhao"                   },
    { label: "Pending Est.",    value: Number(row.PendingEstimations ?? 0), color: "bg-purple-50 text-purple-700",query: "Pending estimations dikhao"                },
    { label: "Artwork Pending", value: Number(row.JobsWithPendingArtwork ?? 0), color: "bg-pink-50 text-pink-700", query: "Pending artwork dikhao"                  },
    { label: "Await Schedule",  value: Number(row.JobsAwaitingSchedule ?? 0), color: "bg-yellow-50 text-yellow-700", query: "Jobs awaiting schedule dikhao"          },
    { label: "No Job Card",     value: Number(row.OrdersWithoutJobCard ?? 0), color: "bg-red-50 text-red-600",   query: "Orders without job card dikhao"            },
    { label: "Dispatch 7d",     value: Number(row.DispatchedLast7Days  ?? 0), color: "bg-blue-50 text-blue-700", query: "Recent dispatches dikhao"                  },
  ];
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-sm">
      <div className="text-[11px] font-semibold text-gray-500 mb-2">Gravure Operations Snapshot</div>
      <div className="grid grid-cols-4 gap-1">
        {metrics.map(({ label, value, color, query }) => (
          <button key={label} onClick={() => value > 0 ? onQuery(query) : undefined}
            className={`${color} rounded p-1.5 text-center transition-all ${value > 0 ? "cursor-pointer hover:opacity-80 active:scale-95" : "opacity-50 cursor-default"}`}>
            <div className="font-bold text-[16px]">{value}</div>
            <div className="text-[9px] leading-tight opacity-70 mt-0.5">{label}</div>
          </button>
        ))}
      </div>
      <div className="flex gap-1 mt-2 flex-wrap items-center">
        <button onClick={() => onQuery("Top active clients dikhao")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-teal-50 hover:border-teal-300 text-gray-500 transition-colors">
          Top Clients
        </button>
        <button onClick={() => onQuery("Machine load dikhao")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-violet-50 hover:border-violet-300 text-gray-500 transition-colors">
          Machine Load
        </button>
        <button onClick={() => onQuery("Oldest open orders dikhao")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-red-50 hover:border-red-300 text-gray-500 transition-colors">
          Oldest Orders
        </button>
        <button onClick={() => onQuery("Stuck overdue jobs dikhao")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-orange-50 hover:border-orange-300 text-gray-500 transition-colors">
          Stuck Jobs
        </button>
        <button
          onClick={() => {
            const lines = [
              "Gravure Ops Summary",
              "Open Orders: " + Number(row.OpenOrders ?? 0),
              "Active Jobs: " + Number(row.ActiveJobs ?? 0),
              "Dispatch Ready: " + Number(row.DispatchReadyJobs ?? 0),
              "Pending Estimations: " + Number(row.PendingEstimations ?? 0),
              "Artwork Pending Jobs: " + Number(row.JobsWithPendingArtwork ?? 0),
              "Awaiting Schedule: " + Number(row.JobsAwaitingSchedule ?? 0),
              "Orders w/o Job Card: " + Number(row.OrdersWithoutJobCard ?? 0),
              "Dispatched Last 7d: " + Number(row.DispatchedLast7Days ?? 0),
            ].join("\n");
            try { navigator.clipboard.writeText(lines); } catch {}
          }}
          className="ml-auto text-[9px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors">
          📋 Copy
        </button>
      </div>
    </div>
  );
}

function ClientWorkloadCard({ row, onQuery }: { row: Record<string, unknown>; onQuery: (q: string) => void }) {
  const name      = String(row.CustomerName   ?? "—");
  const active    = Number(row.ActiveJobCount  ?? 0);
  const inProg    = Number(row.InProgressCount ?? 0);
  const onHold    = Number(row.OnHoldCount     ?? 0);
  const openJobs  = Number(row.OpenCount       ?? 0);
  const dispReady = Number(row.DispatchReadyCount ?? 0);
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-gray-800 truncate">{name}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 shrink-0">{active} active</span>
      </div>
      {!!row.City && <div className="text-gray-400 text-[10px] mb-1">{String(row.City)}</div>}
      <div className="flex gap-1.5 flex-wrap">
        {inProg > 0    && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-700">{inProg} in progress</span>}
        {openJobs > 0  && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-100 text-gray-500">{openJobs} open</span>}
        {onHold > 0    && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-50 text-red-500">{onHold} on hold</span>}
        {dispReady > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-teal-50 text-teal-700">{dispReady} dispatch ready</span>}
      </div>
      <div className="flex gap-1 mt-1.5">
        <button onClick={() => onQuery(name + " ke active jobs")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-orange-50 hover:border-orange-300 text-gray-500 transition-colors">Jobs</button>
        {dispReady > 0 && (
          <button onClick={() => onQuery(name + " ke dispatch ready jobs")}
            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-teal-50 hover:border-teal-300 text-gray-500 transition-colors">Dispatch Ready</button>
        )}
        <button onClick={() => onQuery(name + " ka summary dikhao")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-purple-50 hover:border-purple-300 text-gray-500 transition-colors">Summary</button>
      </div>
    </div>
  );
}

function MachineLoadCard({ row, onQuery }: { row: Record<string, unknown>; onQuery: (q: string) => void }) {
  const name    = String(row.MachineName   ?? "—");
  const active  = Number(row.ActiveJobCount  ?? 0);
  const inProg  = Number(row.InProgressCount ?? 0);
  const openJobs = Number(row.OpenCount ?? 0);
  const earliest = String(row.EarliestPlannedDate ?? "");
  const highLoad = active > 5;
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="font-bold text-violet-700 truncate">{name}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${highLoad ? "bg-red-100 text-red-600" : active > 2 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>
          {active} jobs
        </span>
      </div>
      <div className="flex gap-2 text-[10px] text-gray-400 flex-wrap mt-0.5 mb-1">
        {!!row.MachineCode && <span className="font-mono">{String(row.MachineCode)}</span>}
        {Number(row.MaxSpeed ?? 0) > 0 && <span>{Number(row.MaxSpeed)}m/min</span>}
        {Number(row.Colors ?? 0) > 0   && <span>{Number(row.Colors)}C</span>}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {inProg > 0   && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-700">{inProg} in progress</span>}
        {openJobs > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-100 text-gray-500">{openJobs} open</span>}
        {earliest     && <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-50 text-amber-600">Next: {earliest}</span>}
      </div>
      <div className="mt-1.5">
        <button onClick={() => onQuery(name + " ke active jobs dikhao")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-violet-50 hover:border-violet-300 text-gray-500 transition-colors">Active Jobs</button>
      </div>
    </div>
  );
}

// ─── Phase 4 Workflow Cards ───────────────────────────────────────────────────

function OrderWorkflowCard({ row, onQuery }: { row: Record<string, unknown>; onQuery: (q: string) => void }) {
  const soNo   = String(row.SalesOrderNo ?? "—");
  const client = String(row.CustomerName ?? "");
  const status = String(row.OrderStatus  ?? "Confirmed");
  const total  = Number(row.TotalJobs    ?? 0);
  const active = Number(row.ActiveJobs   ?? 0);
  const done   = Number(row.CompletedJobs ?? 0);
  const unsch  = Number(row.UnscheduledJobs ?? 0);
  const pendArt= Number(row.PendingArtworkColors ?? 0);
  const disp   = Number(row.DispatchedJobCount ?? 0);
  const bot    = String(row.Bottleneck ?? "");
  const botIsOk = bot.includes("dispatch") && disp >= total && total > 0;

  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-bold text-teal-700 text-sm">{soNo}</span>
        <StatusBadge status={status} />
      </div>
      {client && <div className="text-gray-700 font-medium truncate mb-1.5">{client}</div>}

      {/* Job counts row */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        {[
          { label: "Total Jobs", value: total,  color: "bg-gray-50 text-gray-700" },
          { label: "Active",     value: active, color: "bg-orange-50 text-orange-700" },
          { label: "Completed",  value: done,   color: "bg-teal-50 text-teal-700" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`${color} rounded p-1 text-center`}>
            <div className="text-[9px] opacity-60">{label}</div>
            <div className="font-bold text-[13px]">{value}</div>
          </div>
        ))}
      </div>

      {/* Module status indicators */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${unsch > 0 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
          {unsch > 0 ? `${unsch} unscheduled` : "Scheduled ✓"}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${pendArt > 0 ? "bg-pink-100 text-pink-700" : "bg-green-100 text-green-700"}`}>
          {pendArt > 0 ? `${pendArt} artwork pending` : "Artwork ✓"}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${disp >= total && total > 0 ? "bg-teal-100 text-teal-700" : disp > 0 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
          {disp >= total && total > 0 ? "Dispatched ✓" : disp > 0 ? `${disp}/${total} dispatched` : "Not dispatched"}
        </span>
      </div>

      {/* Bottleneck */}
      <div className={`rounded px-2 py-1 text-[10px] font-semibold ${botIsOk ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
        {botIsOk ? "✓" : "⚠"} {bot}
      </div>

      {/* Quick drill-down */}
      <div className="flex gap-1 mt-2 flex-wrap">
        <button onClick={() => onQuery(soNo + " ke linked jobs dikhao")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-teal-50 hover:border-teal-300 text-gray-500 transition-colors">
          Linked Jobs
        </button>
        <button onClick={() => onQuery(soNo + " ka artwork status")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-pink-50 hover:border-pink-300 text-gray-500 transition-colors">
          Artwork
        </button>
        <button onClick={() => onQuery(soNo + " ka dispatch status")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-500 transition-colors">
          Dispatch
        </button>
        {client && (
          <button onClick={() => onQuery(client + " ka summary dikhao")}
            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-purple-50 hover:border-purple-300 text-gray-500 transition-colors">
            Client Summary
          </button>
        )}
      </div>
    </div>
  );
}

function JobWorkflowCard({ row, onQuery }: { row: Record<string, unknown>; onQuery: (q: string) => void }) {
  const jcNo   = String(row.JobBookingNo  ?? "—");
  const name   = String(row.JobName       ?? "");
  const client = String(row.CustomerName  ?? "");
  const status = String(row.Status        ?? "Open");
  const soNo   = String(row.SalesOrderNo  ?? "");
  const machine= String(row.MachineName   ?? "");
  const date   = String(row.PlannedDate   ?? "");
  const cat    = String(row.CatalogNo     ?? "");
  const sched  = Number(row.ScheduledProcesses  ?? 0);
  const totalArt = Number(row.TotalArtworkColors ?? 0);
  const pendArt  = Number(row.PendingArtworkColors ?? 0);
  const dispLines= Number(row.DispatchLines       ?? 0);
  const lastDisp = String(row.LastDispatchDate    ?? "");
  const bot    = String(row.Bottleneck   ?? "");
  const isDone = status === "Completed" && dispLines > 0;

  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-orange-700 text-sm">{jcNo}</span>
        <StatusBadge status={status} />
      </div>
      {name   && <div className="text-gray-800 font-medium truncate">{name}</div>}
      {client && <div className="text-gray-500 text-[10px] truncate">{client}</div>}

      <div className="flex gap-2 flex-wrap text-[10px] text-gray-400 mt-1 mb-2">
        {soNo    && <span>SO: {soNo}</span>}
        {machine && <span>🖨 {machine}</span>}
        {date    && <span>📅 {date}</span>}
        {cat     && <span>PC: {cat}</span>}
      </div>

      {/* Workflow steps */}
      <div className="space-y-1 mb-2">
        {[
          { label: "Schedule", ok: sched > 0,    val: sched > 0 ? `${sched} processes released` : "Not released" },
          { label: "Artwork",  ok: totalArt === 0 || pendArt === 0,
            val: totalArt === 0 ? "No artwork record" : pendArt === 0 ? "All colors released" : `${pendArt}/${totalArt} colors pending` },
          { label: "Dispatch", ok: isDone,
            val: isDone ? `Dispatched ${lastDisp}` : dispLines === 0 ? "Not dispatched" : `${dispLines} FG lines` },
        ].map(({ label, ok, val }) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`w-16 shrink-0 text-[10px] font-semibold ${ok ? "text-teal-600" : "text-gray-400"}`}>{label}</span>
            <span className={`flex-1 text-[10px] px-1.5 py-0.5 rounded ${ok ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
              {ok ? "✓ " : "⚠ "}{val}
            </span>
          </div>
        ))}
      </div>

      {/* Bottleneck */}
      <div className={`rounded px-2 py-1 text-[10px] font-semibold mb-2 ${isDone ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
        {isDone ? "✓" : "⚠"} {bot}
      </div>

      {/* Drill-down chips */}
      <div className="flex gap-1 flex-wrap">
        {soNo && (
          <button onClick={() => onQuery(soNo + " ka workflow dikhao")}
            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-teal-50 hover:border-teal-300 text-gray-500 transition-colors">
            Order Flow
          </button>
        )}
        {client && (
          <button onClick={() => onQuery(client + " ke active jobs")}
            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-orange-50 hover:border-orange-300 text-gray-500 transition-colors">
            Client Jobs
          </button>
        )}
        <button onClick={() => onQuery(jcNo + " ka artwork status dikhao")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-pink-50 hover:border-pink-300 text-gray-500 transition-colors">
          Artwork
        </button>
      </div>
    </div>
  );
}

function LinkedJobMiniCard({ row }: { row: Record<string, unknown> }) {
  const status  = String(row.Status ?? "Open");
  const sched   = Number(row.ScheduledProcesses  ?? 0);
  const pendArt = Number(row.PendingArtworkColors ?? 0);
  const dispLines = Number(row.DispatchLines      ?? 0);
  const bot     = String(row.Bottleneck           ?? "");
  const isDone  = status === "Completed" && dispLines > 0;

  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="font-bold text-orange-700">{String(row.JobBookingNo ?? "—")}</span>
        <StatusBadge status={status} />
      </div>
      <div className="text-gray-700 truncate">{String(row.JobName ?? "")}</div>
      <div className="flex gap-2 text-[10px] text-gray-400 mt-0.5 flex-wrap">
        {!!row.MachineName && <span>🖨 {String(row.MachineName)}</span>}
        {!!row.PlannedDate && <span>📅 {String(row.PlannedDate)}</span>}
        {!!row.CatalogNo   && <span>PC: {String(row.CatalogNo)}</span>}
      </div>
      <div className="flex gap-1.5 mt-1.5 flex-wrap">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${sched > 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
          {sched > 0 ? "Sched ✓" : "Unsched"}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${pendArt === 0 ? "bg-green-100 text-green-700" : "bg-pink-100 text-pink-700"}`}>
          {pendArt === 0 ? "Art ✓" : `${pendArt}C pending`}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${isDone ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500"}`}>
          {isDone ? "Dispatched" : "Not disp."}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold truncate max-w-[120px] ${isDone ? "bg-teal-50 text-teal-600" : "bg-amber-50 text-amber-700"}`}>
          {bot}
        </span>
      </div>
    </div>
  );
}

// ─── Result card dispatcher ───────────────────────────────────────────────────

function ResultCards({ result, onQuery }: { result: BotResult; onQuery: (q: string) => void }) {
  if (!result.data?.length) return null;
  const i = result.intent ?? "";

  // Phase 4 workflow intents
  const isOrderWorkflow  = i === "order.workflow";
  const isLinkedJobs     = i === "order.linkedJobs";
  const isJobWorkflow    = i === "job.workflow";

  // Phase 5 ops/manager intents
  const isOpsSummary    = i === "ops.summary";
  const isTopClients    = i === "ops.topClients";
  const isMachineLoad   = i === "ops.machineLoad";

  // Standard + Phase 3 intents
  const isOrder          = (i.startsWith("order") && !isOrderWorkflow && !isLinkedJobs) || i === "client.orders" || i === "ops.oldestOrders" || i === "ops.noJobCard";
  const isCatalog        = i.startsWith("catalog");
  const isClient         = i === "client.details";
  const isJobCard        = i.startsWith("jobcard") || i === "client.activeJobs" || i === "client.dispatchReady"
                        || i === "machine.activeJobs" || i === "catalog.activeJobs" || i === "client.artworkPending"
                        || i === "ops.stuckJobs" || i === "ops.awaitSchedule";
  const isEst            = i.startsWith("estimation");
  const isDispatchPending = i === "dispatch.pending" || i === "ops.dispatchReady";
  const isDispatchDone   = i === "dispatch.recent" || i === "dispatch.byOrder" || i === "dispatch.byClient" || i === "order.dispatchStatus";
  const isArtwork        = i.startsWith("artwork") || i === "order.artworkStatus" || i === "ops.artworkPending";
  const isInk            = i.startsWith("ink");
  const isSchedule       = i.startsWith("schedule");
  const isStock          = i.startsWith("stock");
  const isMachine        = i === "master.machine";
  const isClientSummary  = i === "summary.client";

  const isDispatch = isDispatchPending || isDispatchDone;
  const known = isOrderWorkflow || isLinkedJobs || isJobWorkflow
             || isOpsSummary || isTopClients || isMachineLoad
             || isOrder || isCatalog || isClient || isJobCard || isEst || isDispatch
             || isArtwork || isInk || isSchedule || isStock || isMachine || isClientSummary;

  // ops.summary returns a single row — render directly without slice loop
  if (isOpsSummary && result.data.length > 0) {
    return (
      <div className="mt-2">
        <OpsSummaryCard row={result.data[0]} onQuery={onQuery} />
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      {result.data.slice(0, 10).map((row, idx) => (
        <div key={idx}>
          {isOrderWorkflow && <OrderWorkflowCard  row={row} onQuery={onQuery} />}
          {isLinkedJobs    && <LinkedJobMiniCard  row={row} />}
          {isJobWorkflow   && <JobWorkflowCard    row={row} onQuery={onQuery} />}
          {isTopClients    && <ClientWorkloadCard row={row} onQuery={onQuery} />}
          {isMachineLoad   && <MachineLoadCard    row={row} onQuery={onQuery} />}
          {isOrder         && <OrderCard          row={row} />}
          {isCatalog       && <CatalogCard        row={row} />}
          {isClient        && <ClientCard         row={row} />}
          {isJobCard       && <JobCardCard        row={row} />}
          {isEst           && <EstimationCard     row={row} />}
          {isDispatchPending && <DispatchCard     row={row} />}
          {isDispatchDone  && <DispatchDoneCard   row={row} />}
          {isArtwork       && <ArtworkCard        row={row} />}
          {isInk           && <InkCard            row={row} />}
          {isSchedule      && <ScheduleCard       row={row} />}
          {isStock         && <StockCard          row={row} />}
          {isMachine       && <MachineCard        row={row} />}
          {isClientSummary && <ClientSummaryCard  row={row} />}
          {!known && (
            <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-[10px]">
              {Object.entries(row).slice(0, 6).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-gray-400 w-24 shrink-0">{k}</span>
                  <span className="text-gray-700 truncate">{String(v ?? "")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {result.data.length > 8 && (
        <div className="text-center text-[10px] text-gray-400 py-1">
          +{result.data.length - 8} more — open the module to see all
        </div>
      )}
      {!isOpsSummary && result.data.length >= 3 && (
        <button
          onClick={() => downloadCSV(result.data, (result.intent ?? "export").replace(/\./g, "_") + ".csv")}
          className="mt-0.5 text-[9px] text-gray-400 hover:text-teal-600 px-2 py-0.5 rounded border border-gray-200 hover:border-teal-300 transition-colors">
          📥 Download CSV ({result.data.length} rows)
        </button>
      )}
    </div>
  );
}

// ─── Clarification choice list ────────────────────────────────────────────────

function ClarificationCard({ result, onChoose }: { result: BotResult; onChoose: (q: string) => void }) {
  if (!result.choices?.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {result.choices.map((c, i) => (
        <button
          key={i}
          onClick={() => onChoose(c.query)}
          className="w-full text-left text-[11px] px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-teal-400 hover:bg-teal-50 transition-all duration-150 shadow-sm flex items-center gap-2"
        >
          <span className="text-teal-500 shrink-0">›</span>
          <span className="text-gray-700">{c.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onQuickReply }: { msg: ChatMessage; onQuickReply: (q: string) => void }) {
  const isUser = msg.role === "user";
  const r = msg.result;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold mr-2 mt-0.5 shrink-0">
          AI
        </div>
      )}
      <div className={`max-w-[92%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        {isUser ? (
          <div className="bg-teal-600 text-white text-xs px-3 py-2 rounded-2xl rounded-tr-sm shadow-sm">
            {msg.text}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 text-xs px-3 py-2 rounded-2xl rounded-tl-sm shadow-sm w-full">
            {r ? (
              <>
                <div className="font-semibold text-teal-700 mb-1">{r.title}</div>
                <div className="text-gray-700 leading-relaxed">{r.message}</div>
                {r.intent === "clarification"
                  ? <ClarificationCard result={r} onChoose={onQuickReply} />
                  : <ResultCards result={r} onQuery={onQuickReply} />
                }
                {r.navigationUrl && r.intent !== "clarification" && (
                  <Link
                    href={r.navigationUrl}
                    className="inline-flex items-center gap-1 mt-2 text-[10px] text-teal-600 hover:text-teal-800 font-semibold underline underline-offset-2"
                  >
                    Open in ERP →
                  </Link>
                )}
                {r.quickReplies?.length > 0 && r.intent !== "clarification" && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.quickReplies.slice(0, 3).map((q, i) => (
                      <button
                        key={i}
                        onClick={() => onQuickReply(q)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-700">{msg.text}</div>
            )}
          </div>
        )}
        <div className="text-[9px] text-gray-400 mt-0.5 px-1">
          {new Date(msg.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

// ─── Empty state with grouped quick prompts ───────────────────────────────────

interface EmptyStateProps {
  onSend: (q: string) => void;
  chatMode: ChatMode;
  setChatMode: (m: ChatMode) => void;
  visibleGroups: string[];
  recentQueries: string[];
  pinnedQueries: string[];
  onTogglePin: (q: string) => void;
  onClearRecent: () => void;
}

function EmptyState({ onSend, chatMode, setChatMode, visibleGroups, recentQueries, pinnedQueries, onTogglePin, onClearRecent }: EmptyStateProps) {
  const defaultGroup = visibleGroups[0] ?? "Orders";
  const [activeGroup, setActiveGroup] = useState(defaultGroup);
  const effectiveGroup = visibleGroups.includes(activeGroup) ? activeGroup : defaultGroup;
  const prompts = ALL_PROMPTS.filter(p => p.group === effectiveGroup);

  return (
    <div className="h-full flex flex-col px-1 py-2 overflow-y-auto">
      <div className="text-center mb-2">
        <div className="text-xl mb-1">👋</div>
        <div className="text-sm font-semibold text-gray-700">Gravure ERP Assistant</div>
      </div>

      {/* Pinned prompts */}
      {pinnedQueries.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] font-semibold text-gray-400 mb-1">📌 PINNED</div>
          <div className="flex gap-1 flex-wrap">
            {pinnedQueries.map(q => (
              <div key={q} className="flex items-center">
                <button onClick={() => onSend(q)}
                  className="text-[9px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-medium transition-colors max-w-[140px] truncate">
                  {q}
                </button>
                <button onClick={() => onTogglePin(q)}
                  className="text-gray-300 hover:text-red-400 text-[10px] transition-colors ml-0.5 shrink-0">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent prompts */}
      {recentQueries.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] font-semibold text-gray-400 mb-1 flex justify-between">
            <span>🕐 RECENT</span>
            <button onClick={onClearRecent} className="text-[9px] text-gray-300 hover:text-gray-500">Clear</button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {recentQueries.slice(0, 6).map(q => (
              <div key={q} className="flex items-center gap-0.5">
                <button onClick={() => onSend(q)}
                  className="text-[9px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors max-w-[130px] truncate">
                  {q}
                </button>
                <button onClick={() => onTogglePin(q)} title={pinnedQueries.includes(q) ? "Unpin" : "Pin"}
                  className={`text-[9px] transition-colors shrink-0 ${pinnedQueries.includes(q) ? "text-amber-400" : "text-gray-200 hover:text-amber-400"}`}>
                  📌
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group tabs — filtered by mode */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {visibleGroups.map(g => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
              effectiveGroup === g
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Prompt grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {prompts.map((p, i) => (
          <button
            key={i}
            onClick={() => onSend(p.query)}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-left hover:border-teal-400 hover:bg-teal-50 transition-all duration-150 shadow-sm"
          >
            <span className="text-base shrink-0">{p.icon}</span>
            <span className="text-[11px] text-gray-700 font-medium leading-tight">{p.label}</span>
          </button>
        ))}
      </div>

      <div className="text-center mt-3 text-[10px] text-gray-400">
        Hindi/English dono chalega — e.g. "ABC ke orders", "SO-1023 status"
      </div>
    </div>
  );
}

// ─── Main chatbot component ───────────────────────────────────────────────────

export default function ERPChatBot() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [ctx, setCtx]           = useState<SessionCtx>({});
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  // Phase 6 — role / mode
  const [chatMode, setChatMode]   = useState<ChatMode>("all");
  const [userCtx, setUserCtx]     = useState<UserCtx | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [pinnedQueries, setPinnedQueries] = useState<string[]>([]);

  // Load localStorage on mount
  useEffect(() => {
    try {
      setRecentQueries(JSON.parse(localStorage.getItem("grav_recent_v1") || "[]"));
      setPinnedQueries(JSON.parse(localStorage.getItem("grav_pinned_v1") || "[]"));
    } catch {}
  }, []);

  // Fetch user context and auto-detect mode from role
  useEffect(() => {
    apiGet<{ UserName: string; IsAdmin: boolean; RoleName: string }>(
      "api/gravure/chatbot/context"
    ).then(data => {
      setUserCtx({ userName: data.UserName, isAdmin: data.IsAdmin, roleName: data.RoleName });
      const role = data.RoleName.toLowerCase();
      if (data.IsAdmin) { setChatMode("all"); return; }
      if (role.includes("production") || role.includes("operator") || role.includes("shop floor")) { setChatMode("production"); return; }
      if (role.includes("dispatch") || role.includes("store") || role.includes("inventory") || role.includes("warehouse")) { setChatMode("dispatch"); return; }
      if (role.includes("sales") || role.includes("crm") || role.includes("marketing")) { setChatMode("sales"); return; }
      if (role.includes("manager") || role.includes("supervisor") || role.includes("head")) { setChatMode("manager"); return; }
    }).catch(() => {});
  }, []);

  const addToRecent = useCallback((q: string) => {
    setRecentQueries(prev => {
      const updated = [q, ...prev.filter(x => x !== q)].slice(0, 8);
      try { localStorage.setItem("grav_recent_v1", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const togglePin = useCallback((q: string) => {
    setPinnedQueries(prev => {
      const updated = prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q].slice(0, 8);
      try { localStorage.setItem("grav_pinned_v1", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentQueries([]);
    try { localStorage.removeItem("grav_recent_v1"); } catch {}
  }, []);

  const visibleGroups = MODE_GROUPS[chatMode];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const addMessage = (role: ChatRole, text: string, result?: BotResult) =>
    setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), role, text, result, ts: Date.now() }]);

  // Extract context from bot result for future pronoun resolution
  const updateCtx = useCallback((result: BotResult) => {
    if (!result?.data?.length) return;
    const r = result.data[0];
    const updates: SessionCtx = {};
    const client = String(r.CustomerName ?? "");
    const order  = String(r.SalesOrderNo ?? "");
    const job    = String(r.JobBookingNo ?? "");
    const cat    = String(r.CatalogNo    ?? "");
    if (client) updates.clientName = client;
    if (order)  updates.orderNo    = order;
    if (job)    updates.jobNo      = job;
    if (cat)    updates.catalogNo  = cat;
    if (Object.keys(updates).length) setCtx(prev => ({ ...prev, ...updates }));
  }, []);

  const sendQuery = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q || loading) return;
    addToRecent(q);
    setInput("");
    addMessage("user", q);
    setLoading(true);
    try {
      const raw = await apiPost<string>("api/gravure/chatbot/query", { query: q, ctx });
      // Backend double-wraps JSON — unwrap all layers
      let parsed: BotResult | null = null;
      if (typeof raw === "string") {
        try { parsed = JSON.parse(raw) as BotResult; } catch { parsed = null; }
      } else {
        parsed = raw as unknown as BotResult;
      }
      // data and choices may themselves be JSON strings (triple-wrapped)
      if (parsed && typeof parsed.data === "string") {
        try { parsed.data = JSON.parse(parsed.data as unknown as string); } catch { parsed.data = []; }
      }
      if (parsed && typeof parsed.choices === "string") {
        try { parsed.choices = JSON.parse(parsed.choices as unknown as string); } catch { parsed.choices = []; }
      }
      if (parsed) updateCtx(parsed);
      addMessage("bot", parsed?.message ?? "Kuch error aayi.", parsed ?? undefined);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      addMessage("bot", "Request fail ho gayi: " + msg);
    } finally {
      setLoading(false);
    }
  }, [loading, ctx, updateCtx, addToRecent]);

  const handleSend = () => sendQuery(input);
  const handleKey  = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };
  const clearChat  = () => { setMessages([]); setCtx({}); };

  const hasCtx = !!(ctx.clientName || ctx.orderNo || ctx.jobNo);

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open ERP Assistant"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ boxShadow: "0 4px 20px rgba(0,150,136,0.45)" }}
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {hasCtx && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-yellow-400 rounded-full border border-white" />
            )}
          </>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-5 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-gray-200"
          style={{ width: 360, height: 580, background: "#fff" }}
        >
          {/* Header */}
          <div className="bg-teal-600 px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">AI</div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm flex items-center gap-1.5">
                ERP Assistant
                {userCtx && (
                  <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-normal">
                    {userCtx.isAdmin ? "🔑 " : ""}{userCtx.userName}
                    {userCtx.roleName ? ` · ${userCtx.roleName}` : ""}
                  </span>
                )}
              </div>
              {hasCtx ? (
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {ctx.clientName && (
                    <span className="bg-white/20 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                      👤 {ctx.clientName.length > 14 ? ctx.clientName.slice(0, 14) + "…" : ctx.clientName}
                    </span>
                  )}
                  {ctx.orderNo && (
                    <span className="bg-white/20 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                      📦 {ctx.orderNo}
                    </span>
                  )}
                  {ctx.jobNo && !ctx.orderNo && (
                    <span className="bg-white/20 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                      🔧 {ctx.jobNo}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-teal-100 text-[10px]">Gravure ERP • Smart Search</div>
              )}
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                title="Clear chat"
                className="text-white/60 hover:text-white text-[10px] border border-white/30 rounded px-1.5 py-0.5 transition-colors shrink-0"
              >
                Clear
              </button>
            )}
          </div>

          {/* Mode switcher strip */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-100 bg-white shrink-0 overflow-x-auto [scrollbar-width:none]">
            {MODE_LABELS.map(({ mode, label, icon }) => (
              <button key={mode}
                onClick={() => setChatMode(mode)}
                className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                  chatMode === mode
                    ? "bg-teal-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 bg-gray-50/60">
            {messages.length === 0 ? (
              <EmptyState
                key={chatMode}
                onSend={sendQuery}
                chatMode={chatMode}
                setChatMode={setChatMode}
                visibleGroups={visibleGroups}
                recentQueries={recentQueries}
                pinnedQueries={pinnedQueries}
                onTogglePin={togglePin}
                onClearRecent={clearRecent}
              />
            ) : (
              <>
                {messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} onQuickReply={sendQuery} />
                ))}
                {loading && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0">AI</div>
                    <div className="bg-gray-100 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input row */}
          <div className="px-3 py-2.5 border-t border-gray-200 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="e.g. ABC estimation dikhao, SO-1023 status…"
                disabled={loading}
                className="flex-1 text-xs border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent disabled:opacity-50 bg-gray-50 placeholder:text-gray-400"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-9 h-9 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
            <div className="text-center text-[9px] text-gray-400 mt-1.5">
              Orders · Estimation · Job Cards · Artwork · Dispatch · Ink
            </div>
          </div>
        </div>
      )}
    </>
  );
}
