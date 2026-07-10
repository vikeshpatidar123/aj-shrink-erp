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

// FlexiBot suggestions
interface SuggestionItem {
  text: string;
  query: string;
}
interface SuggestionGroup {
  category: string;
  label: string;
  icon: string;
  items: SuggestionItem[];
}

// ─── Quick prompt catalog ─────────────────────────────────────────────────────

interface QuickPrompt { icon: string; label: string; query: string; group: string }

const ALL_PROMPTS: QuickPrompt[] = [
  // Orders
  { group: "Orders",     icon: "📦", label: "Pending Orders",    query: "Show pending orders"               },
  { group: "Orders",     icon: "🕐", label: "Recent Orders",     query: "Show recent orders"                },
  { group: "Orders",     icon: "🔄", label: "Pend. Production",  query: "Show orders pending production"    },
  { group: "Orders",     icon: "🔗", label: "No Job Card",       query: "Show orders without job card"      },
  // Job Cards
  { group: "Job Cards",  icon: "🔧", label: "Open Job Cards",   query: "Show pending job cards"            },
  { group: "Job Cards",  icon: "✅", label: "Released Jobs",    query: "Show released jobs"                },
  { group: "Job Cards",  icon: "📅", label: "Await Schedule",   query: "Show jobs awaiting schedule"       },
  { group: "Job Cards",  icon: "🚨", label: "Stuck / Overdue",  query: "Show stuck overdue jobs"           },
  // Estimation
  { group: "Estimation", icon: "📝", label: "Pending Ests.",    query: "Show pending estimations"          },
  { group: "Estimation", icon: "🆕", label: "Recent Ests.",     query: "Show recent estimations"           },
  // Catalog
  { group: "Catalog",    icon: "📋", label: "All Catalogs",     query: "Show all catalogs"                 },
  { group: "Catalog",    icon: "👤", label: "By Client",        query: "catalog for client"                },
  // Artwork
  { group: "Artwork",    icon: "🎨", label: "Pending Artwork",  query: "Show pending artwork"              },
  { group: "Artwork",    icon: "⏳", label: "Shade Production", query: "Show pending shade production"     },
  // Dispatch
  { group: "Dispatch",   icon: "🚚", label: "Dispatch Pending", query: "Show dispatch pending"             },
  { group: "Dispatch",   icon: "📬", label: "Recent Dispatches",query: "Show recent dispatches"            },
  { group: "Dispatch",   icon: "⚡", label: "Dispatch Ready",   query: "Show dispatch ready completed jobs"},
  // Ink
  { group: "Ink",        icon: "🖌️", label: "Pending Ink SPR", query: "Show pending ink SPR"              },
  { group: "Ink",        icon: "⏳", label: "Shade Production", query: "Show pending shade production"     },
  // Inventory
  { group: "Inventory",  icon: "📊", label: "Browse Stock",     query: "Show stock items"                  },
  { group: "Inventory",  icon: "🏭", label: "All Machines",     query: "Show all machines"                 },
  // Workflow — cross-cutting status views (no entity number needed)
  { group: "Workflow",   icon: "🔗", label: "No Job Card",      query: "Show orders without job card"      },
  { group: "Workflow",   icon: "⚡", label: "Dispatch Ready",   query: "Show dispatch ready completed jobs"},
  { group: "Workflow",   icon: "📅", label: "Await Schedule",   query: "Show jobs awaiting schedule"       },
  { group: "Workflow",   icon: "🚨", label: "Stuck / Overdue",  query: "Show stuck overdue jobs"           },
  { group: "Workflow",   icon: "🎨", label: "Pending Artwork",  query: "Show pending artwork"              },
  { group: "Workflow",   icon: "🖨️", label: "Machine Load",    query: "Show machine load summary"         },
  // Manager — 6 daily-use prompts (3 rows, fits visible area without scrolling)
  { group: "Manager",    icon: "📊", label: "Ops Dashboard",      query: "Show operations summary"           },
  { group: "Manager",    icon: "⚡", label: "Dispatch Ready",     query: "Show dispatch ready completed jobs"},
  { group: "Manager",    icon: "🔧", label: "Open Job Cards",    query: "Show pending job cards"            },
  { group: "Manager",    icon: "🎨", label: "Pending Artwork",    query: "Show pending artwork"              },
  { group: "Manager",    icon: "🖨️", label: "Machine Load",      query: "Show machine load summary"         },
  { group: "Manager",    icon: "🏆", label: "Top Clients",        query: "Show top active clients"           },
];

const PROMPT_GROUPS = ["Manager", "Orders", "Job Cards", "Estimation", "Catalog", "Artwork", "Dispatch", "Ink", "Inventory", "Workflow"];

// Phase 6 — mode → visible group subset
const MODE_GROUPS: Record<ChatMode, string[]> = {
  all:        ["Manager", "Orders", "Job Cards", "Estimation", "Catalog", "Artwork", "Dispatch", "Ink", "Inventory", "Workflow"],
  manager:    ["Manager", "Workflow", "Orders", "Job Cards", "Dispatch", "Artwork", "Ink"],
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

function copyResultText(data: Record<string, unknown>[], intent: string) {
  const s = (v: unknown) => String(v ?? "—");
  let lines: string[];
  if (intent === "ops.machineLoad") {
    lines = data.map(r => `${s(r.MachineName)}: ${s(r.ActiveJobCount)} active, ${s(r.InProgressCount)} in-progress`);
  } else if (intent === "ops.topClients") {
    lines = data.map(r => `${s(r.CustomerName)}: ${s(r.ActiveJobCount)} jobs, ${s(r.DispatchReadyCount)} dispatch-ready`);
  } else if (intent.includes("order") || intent === "ops.oldestOrders" || intent === "ops.noJobCard") {
    lines = data.map(r => `${s(r.SalesOrderNo)} | ${s(r.CustomerName)} | ${s(r.Status ?? r.OrderStatus)} | ${s(r.OrderDate)}`);
  } else if (intent.startsWith("jobcard") || intent === "ops.stuckJobs" || intent === "ops.awaitSchedule"
          || intent === "ops.dispatchReady" || intent === "dispatch.pending") {
    lines = data.map(r => `${s(r.JobBookingNo ?? r.JobCardNo)} | ${s(r.CustomerName)} | ${s(r.JobStatus ?? r.Status)} | ${s(r.PlannedDate ?? r.OrderDate ?? "")}`);
  } else {
    lines = data.map(r => Object.values(r).slice(0, 4).map(v => s(v)).join(" | "));
  }
  try { navigator.clipboard.writeText(lines.join("\n")); } catch { /* ignore — clipboard API may be unavailable */ }
}

// ─── ERP navigation contract ─────────────────────────────────────────────────
// Maps chatbot intent + result row → filtered ERP page URL.
// All navigation logic lives here — no ad-hoc routing in individual cards.
function buildERPLink(intent: string, row: Record<string, unknown>): string | null {
  const enc = (v: string) => encodeURIComponent(v);
  const order   = String(row.SalesOrderNo ?? row.OrderNo ?? "").trim();
  const job     = String(row.JobBookingNo ?? row.JobCardNo ?? "").trim();
  const client  = String(row.CustomerName ?? "").trim();
  const cat     = String(row.CatalogNo ?? "").trim();
  const machine = String(row.MachineName ?? "").trim();

  // Orders
  if (intent.startsWith("order") || intent === "ops.oldestOrders" || intent === "ops.noJobCard" || intent === "client.orders") {
    if (order)  return `/gravure/orders?search=${enc(order)}`;
    if (client) return `/gravure/orders?search=${enc(client)}`;
    return "/gravure/orders";
  }
  // Schedule release — awaiting schedule or released jobs → job-schedule-release page
  if (intent === "ops.awaitSchedule" || intent === "schedule.released") {
    if (job) return `/gravure/job-schedule-release?search=${enc(job)}`;
    if (client) return `/gravure/job-schedule-release?search=${enc(client)}`;
    return "/gravure/job-schedule-release";
  }
  // Work orders / job cards
  if (intent.startsWith("jobcard") || intent === "ops.stuckJobs" || intent === "ops.dispatchReady"
   || intent === "client.activeJobs" || intent === "client.dispatchReady"
   || intent === "machine.activeJobs" || intent === "catalog.activeJobs") {
    if (job)     return `/gravure/workorder?search=${enc(job)}`;
    if (order)   return `/gravure/workorder?search=${enc(order)}`;
    if (machine) return `/gravure/workorder?search=${enc(machine)}`;
    if (client)  return `/gravure/workorder?search=${enc(client)}`;
    return "/gravure/workorder";
  }
  // Artwork
  if (intent.startsWith("artwork") || intent === "order.artworkStatus" || intent === "ops.artworkPending" || intent === "client.artworkPending") {
    if (job)    return `/gravure/artwork-management?search=${enc(job)}`;
    if (order)  return `/gravure/artwork-management?search=${enc(order)}`;
    if (client) return `/gravure/artwork-management?search=${enc(client)}`;
    return "/gravure/artwork-management";
  }
  // Dispatch
  if (intent.startsWith("dispatch")) {
    return "/gravure/dispatch";
  }
  // Catalog
  if (intent.startsWith("catalog")) {
    if (cat)    return `/gravure/product-catalog?search=${enc(cat)}`;
    if (client) return `/gravure/product-catalog?search=${enc(client)}`;
    return "/gravure/product-catalog";
  }
  // Estimation
  if (intent.startsWith("estimation")) {
    if (client) return `/gravure/estimation?search=${enc(client)}`;
    return "/gravure/estimation";
  }
  // Ink / Shade
  if (intent.startsWith("ink")) {
    return "/gravure/ink-kitchen";
  }
  // Machine load → show machine's active jobs in workorder page
  if (intent === "ops.machineLoad" || intent === "master.machine") {
    if (machine) return `/gravure/workorder?search=${enc(machine)}`;
    return "/gravure/workorder";
  }
  // Top clients → client's orders
  if (intent === "ops.topClients") {
    if (client) return `/gravure/orders?search=${enc(client)}`;
    return "/gravure/orders";
  }
  return null;
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

function OrderCard({ row, erpUrl }: { row: Record<string, unknown>; erpUrl?: string }) {
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
        <div className="flex items-center gap-2">
          {Number(row.AgeDays ?? 0) > 0 && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${Number(row.AgeDays) > 30 ? "bg-red-100 text-red-600" : Number(row.AgeDays) > 14 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
              {Number(row.AgeDays)}d old
            </span>
          )}
          {erpUrl && <Link href={erpUrl} className="text-[9px] text-teal-600 hover:text-teal-800 font-semibold">Open →</Link>}
        </div>
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

function JobCardCard({ row, erpUrl }: { row: Record<string, unknown>; erpUrl?: string }) {
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
      <div className="flex items-center justify-between mt-1">
        {Number(row.DaysOverdue ?? 0) > 0 ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-red-100 text-red-600">
            {Number(row.DaysOverdue)}d overdue
          </span>
        ) : <span />}
        {erpUrl && <Link href={erpUrl} className="text-[9px] text-teal-600 hover:text-teal-800 font-semibold">Open →</Link>}
      </div>
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
      <div className="flex items-center justify-between mt-1">
        <div className="flex gap-3 text-gray-400 flex-wrap text-[10px]">
          {!!row.SalesOrderNo  && <span>SO: {String(row.SalesOrderNo)}</span>}
          {!!row.CatalogNo     && <span>PC: {String(row.CatalogNo)}</span>}
          {Number(row.OrderQuantity ?? 0) > 0 && <span>{Number(row.OrderQuantity).toLocaleString()} {String(row.Unit ?? "")}</span>}
        </div>
        <Link href="/gravure/dispatch" className="text-[9px] text-teal-600 hover:text-teal-800 font-semibold shrink-0">Open →</Link>
      </div>
    </div>
  );
}

function ArtworkCard({ row, erpUrl }: { row: Record<string, unknown>; erpUrl?: string }) {
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
      {erpUrl && (
        <div className="mt-1 text-right">
          <Link href={erpUrl} className="text-[9px] text-pink-600 hover:text-pink-800 font-semibold">Open Artwork →</Link>
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

function ScheduleCard({ row, erpUrl }: { row: Record<string, unknown>; erpUrl?: string }) {
  const status = String(row.Status ?? "Open");
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-blue-700">{String(row.JobBookingNo ?? "—")}</span>
        <StatusBadge status={status} />
      </div>
      <div className="text-gray-800 font-medium truncate">{String(row.JobName ?? "—")}</div>
      <div className="text-gray-500 text-[10px] truncate">{String(row.CustomerName ?? "")}</div>
      <div className="flex items-center justify-between mt-1">
        <div className="flex gap-3 text-gray-400 flex-wrap text-[10px]">
          {!!row.MachineName && <span>🖨 {String(row.MachineName)}</span>}
          {!!row.PlannedDate  && <span>📅 {String(row.PlannedDate)}</span>}
          {Number(row.ReleasedProcessCount ?? 0) > 0 && (
            <span className="text-teal-600">{Number(row.ReleasedProcessCount)} released</span>
          )}
        </div>
        {erpUrl && <Link href={erpUrl} className="text-[9px] text-blue-600 hover:text-blue-800 font-semibold shrink-0">Open Schedule →</Link>}
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
    { label: "Dispatch Ready",  value: Number(row.DispatchReadyJobs ?? 0), color: "bg-green-50 text-green-700",   query: "Show dispatch pending"                     },
    { label: "Pending Est.",    value: Number(row.PendingEstimations ?? 0), color: "bg-purple-50 text-purple-700",query: "Show pending estimations"                  },
    { label: "Artwork Pending", value: Number(row.JobsWithPendingArtwork ?? 0), color: "bg-pink-50 text-pink-700", query: "Show pending artwork"                    },
    { label: "Await Schedule",  value: Number(row.JobsAwaitingSchedule ?? 0), color: "bg-yellow-50 text-yellow-700", query: "Show jobs awaiting schedule"            },
    { label: "No Job Card",     value: Number(row.OrdersWithoutJobCard ?? 0), color: "bg-red-50 text-red-600",   query: "Show orders without job card"              },
    { label: "Dispatch 7d",     value: Number(row.DispatchedLast7Days  ?? 0), color: "bg-blue-50 text-blue-700", query: "Show recent dispatches"                    },
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
        <button onClick={() => onQuery("Show top active clients")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-teal-50 hover:border-teal-300 text-gray-500 transition-colors">
          Top Clients
        </button>
        <button onClick={() => onQuery("Show machine load summary")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-violet-50 hover:border-violet-300 text-gray-500 transition-colors">
          Machine Load
        </button>
        <button onClick={() => onQuery("Show oldest open orders")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-red-50 hover:border-red-300 text-gray-500 transition-colors">
          Oldest Orders
        </button>
        <button onClick={() => onQuery("Show stuck overdue jobs")}
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
      <div className="flex gap-1 mt-1.5 flex-wrap items-center">
        <button onClick={() => onQuery(name + " active jobs")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-orange-50 hover:border-orange-300 text-gray-500 transition-colors">Jobs</button>
        {dispReady > 0 && (
          <button onClick={() => onQuery(name + " dispatch ready jobs")}
            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-teal-50 hover:border-teal-300 text-gray-500 transition-colors">Dispatch Ready</button>
        )}
        <button onClick={() => onQuery(name + " summary")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-purple-50 hover:border-purple-300 text-gray-500 transition-colors">Summary</button>
        <Link href={`/gravure/orders?search=${encodeURIComponent(name)}`}
          className="ml-auto text-[9px] text-teal-600 hover:text-teal-800 font-semibold">Open Orders →</Link>
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
      <div className="flex items-center gap-1 mt-1.5">
        <button onClick={() => onQuery(name + " active jobs")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-violet-50 hover:border-violet-300 text-gray-500 transition-colors">Active Jobs</button>
        <Link href={`/gravure/workorder?search=${encodeURIComponent(name)}`}
          className="ml-auto text-[9px] text-violet-600 hover:text-violet-800 font-semibold">Open Jobs →</Link>
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
      <div className="flex gap-1 mt-2 flex-wrap items-center">
        <button onClick={() => onQuery(soNo + " linked jobs")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-teal-50 hover:border-teal-300 text-gray-500 transition-colors">
          Linked Jobs
        </button>
        <button onClick={() => onQuery(soNo + " artwork status")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-pink-50 hover:border-pink-300 text-gray-500 transition-colors">
          Artwork
        </button>
        <button onClick={() => onQuery(soNo + " dispatch status")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-500 transition-colors">
          Dispatch
        </button>
        <Link href={`/gravure/orders?search=${encodeURIComponent(soNo)}`}
          className="ml-auto text-[9px] text-teal-600 hover:text-teal-800 font-semibold">
          Open Order →
        </Link>
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
      <div className="flex gap-1 flex-wrap items-center">
        {soNo && (
          <button onClick={() => onQuery(soNo + " workflow")}
            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-teal-50 hover:border-teal-300 text-gray-500 transition-colors">
            Order Flow
          </button>
        )}
        {client && (
          <button onClick={() => onQuery(client + " active jobs")}
            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-orange-50 hover:border-orange-300 text-gray-500 transition-colors">
            Client Jobs
          </button>
        )}
        <button onClick={() => onQuery(jcNo + " artwork status")}
          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-pink-50 hover:border-pink-300 text-gray-500 transition-colors">
          Artwork
        </button>
        <Link href={`/gravure/workorder?search=${encodeURIComponent(jcNo)}`}
          className="ml-auto text-[9px] text-orange-600 hover:text-orange-800 font-semibold">
          Open Job Card →
        </Link>
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

// ─── OrderDetailCard — grouped full order with product lines (Phase 7) ────────

function OrderDetailCard({ rows, onQuery }: { rows: Record<string, unknown>[]; onQuery: (q: string) => void }) {
  if (!rows.length) return null;
  const h           = rows[0];
  const soNo        = String(h.SalesOrderNo ?? "—");
  const customer    = String(h.CustomerName ?? "—");
  const orderDate   = String(h.OrderDate    ?? "");
  const status      = String(h.OrderStatus  ?? "");
  const poNo        = String(h.PONo         ?? "");
  const totalAmt    = Number(h.TotalAmount  ?? 0);
  const totalJobs   = Number(h.TotalJobCards  ?? 0);
  const doneJobs    = Number(h.CompletedJobs  ?? 0);
  const inProg      = Number(h.InProgressJobs ?? 0);

  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden text-xs">
      {/* Header */}
      <div className="bg-teal-50 px-3 py-2 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-teal-700">{soNo}</span>
          <StatusBadge status={status} />
        </div>
        <div className="text-gray-800 font-medium mt-0.5">{customer}</div>
        <div className="flex gap-3 text-[10px] text-gray-400 mt-1 flex-wrap">
          {orderDate && <span>📅 {orderDate}</span>}
          {poNo      && <span>PO: {poNo}</span>}
          {totalAmt > 0 && <span className="text-gray-700 font-semibold">₹{totalAmt.toLocaleString("en-IN")}</span>}
        </div>
        {totalJobs > 0 && (
          <div className="flex gap-2 mt-1 text-[10px]">
            <span className="text-gray-500">{totalJobs} job card{totalJobs > 1 ? "s" : ""}</span>
            {doneJobs > 0  && <span className="text-green-600">{doneJobs} done</span>}
            {inProg > 0    && <span className="text-blue-600">{inProg} in progress</span>}
          </div>
        )}
      </div>

      {/* Product lines */}
      <div className="divide-y divide-gray-50">
        {rows.map((row, idx) => {
          const name    = String(row.ProductName ?? "");
          const cat     = String(row.CatalogNo   ?? "");
          if (!name && !cat) return null;
          const qty     = Number(row.OrderQty    ?? 0);
          const unit    = String(row.Unit        ?? "Kg");
          const colors  = Number(row.NoOfColors  ?? 0);
          const w       = Number(row.JobWidth    ?? 0);
          const hh      = Number(row.JobHeight   ?? 0);
          const sub     = String(row.Substrate   ?? "");
          const struct  = String(row.StructureType ?? "");
          const del     = String(row.DeliveryDate  ?? "");
          const jtype   = String(row.JobType     ?? "");
          const prio    = String(row.JobPriority ?? "Normal");
          return (
            <div key={idx} className="px-3 py-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="font-medium text-gray-800 truncate">{name || cat}</span>
                {cat && <span className="text-[10px] font-mono text-indigo-600 shrink-0 ml-1">{cat}</span>}
              </div>
              <div className="flex gap-3 text-[10px] text-gray-400 mt-0.5 flex-wrap">
                {qty > 0    && <span className="font-semibold text-gray-700">{qty.toLocaleString()} {unit}</span>}
                {colors > 0 && <span>{colors}C</span>}
                {w > 0      && <span>{w}×{hh}mm</span>}
                {sub        && <span>{sub}</span>}
                {struct     && <span>{struct}</span>}
                {del        && <span>Del: {del}</span>}
                {jtype && jtype !== "New"     && <span className="text-orange-500">{jtype}</span>}
                {prio  && prio  !== "Normal"  && <span className="text-red-500">{prio}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex gap-1.5 px-3 py-2 border-t border-gray-100 bg-gray-50 flex-wrap">
        <button onClick={() => onQuery(soNo + " ink details")}
          className="text-[9px] px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors">
          🖌 Ink Details
        </button>
        <button onClick={() => onQuery(soNo + " job cards")}
          className="text-[9px] px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
          🔧 Job Cards
        </button>
        <button onClick={() => onQuery(soNo + " artwork status")}
          className="text-[9px] px-2 py-1 rounded bg-pink-100 text-pink-700 hover:bg-pink-200 transition-colors">
          🎨 Artwork
        </button>
        <button onClick={() => onQuery(soNo + " dispatch status")}
          className="text-[9px] px-2 py-1 rounded bg-teal-100 text-teal-700 hover:bg-teal-200 transition-colors">
          🚚 Dispatch
        </button>
      </div>
    </div>
  );
}

// ─── InkDetailCard — per-job-SPR row for order.inkDetail / job.inkDetail ──────

function InkDetailCard({ row }: { row: Record<string, unknown> }) {
  const isProduced    = Number(row.IsShadeProduced ?? 0) === 1;
  const hasSPR        = !!row.SPRNo && String(row.SPRNo) !== "";
  const pendingShades = Number(row.PendingShadeCount ?? 0);
  const readyShades   = Number(row.ReadyShadeCount   ?? 0);
  const jobStatus     = String(row.JobStatus ?? "Open");
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="font-bold text-orange-700">{String(row.JobNo ?? row.JobBookingNo ?? "—")}</span>
        <StatusBadge status={jobStatus} />
      </div>
      <div className="text-gray-800 font-medium truncate">{String(row.JobName ?? "—")}</div>
      <div className="text-gray-500 text-[10px] truncate">{String(row.CustomerName ?? "")}</div>

      {/* Color summary row */}
      <div className="flex gap-2 mt-1 text-[10px] flex-wrap">
        {Number(row.TotalColors ?? 0) > 0 && (
          <span className="text-gray-400">{Number(row.TotalColors)}C total</span>
        )}
        {readyShades > 0   && <span className="text-green-600 font-semibold">{readyShades} ready</span>}
        {pendingShades > 0 && <span className="text-red-500 font-semibold">{pendingShades} shade pending</span>}
        {!!row.SalesOrderNo && <span className="text-gray-400">SO: {String(row.SalesOrderNo)}</span>}
      </div>

      {/* SPR detail */}
      {hasSPR && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-orange-600 text-[10px]">{String(row.SPRNo)}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isProduced ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
              {isProduced ? "Produced" : "Pending"}
            </span>
          </div>
          <div className="text-gray-700 text-[10px] font-medium">{String(row.ShadeName ?? "")}</div>
          <div className="flex gap-3 text-gray-400 text-[10px] mt-0.5 flex-wrap">
            {!!row.InkCode    && <span className="font-mono">{String(row.InkCode)}</span>}
            {!!row.InkName    && <span>{String(row.InkName)}</span>}
            {Number(row.RequiredQty ?? 0) > 0 && <span>Qty: {Number(row.RequiredQty)} Kg</span>}
            {!!row.RequiredDate && <span>By: {String(row.RequiredDate)}</span>}
            {!!row.RecipeNo   && <span>Recipe: {String(row.RecipeNo)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PendingShadeCard — reuses InkCard shape but adds DaysOverdue ─────────────

function PendingShadeCard({ row }: { row: Record<string, unknown> }) {
  const days = Number(row.DaysOverdue ?? 0);
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-orange-600">{String(row.SPRNo ?? "—")}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700">Pending</span>
      </div>
      <div className="text-gray-800 font-medium truncate">{String(row.ShadeName ?? "—")}</div>
      <div className="flex gap-3 text-gray-400 mt-1 flex-wrap text-[10px]">
        {!!row.JobBookingNo  && <span>JC: {String(row.JobBookingNo)}</span>}
        {!!row.CustomerName  && <span>{String(row.CustomerName)}</span>}
        {!!row.InkCode       && <span className="font-mono">{String(row.InkCode)}</span>}
        {Number(row.RequiredQty ?? 0) > 0 && <span>Qty: {Number(row.RequiredQty)} Kg</span>}
        {!!row.RequiredDate  && <span>By: {String(row.RequiredDate)}</span>}
        {!!row.RecipeNo      && <span>Recipe: {String(row.RecipeNo)}</span>}
      </div>
      {days > 0 && (
        <div className="mt-1">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${days > 7 ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"}`}>
            {days}d overdue
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Result card dispatcher ───────────────────────────────────────────────────

function ResultCards({ result, onQuery }: { result: BotResult; onQuery: (q: string) => void }) {
  const data = Array.isArray(result.data) ? result.data : [];
  if (!data.length) return null;
  const i = result.intent ?? "";

  // Phase 4 workflow intents
  const isOrderWorkflow  = i === "order.workflow";
  const isLinkedJobs     = i === "order.linkedJobs";
  const isJobWorkflow    = i === "job.workflow";

  // Phase 5 ops/manager intents
  const isOpsSummary    = i === "ops.summary";
  const isTopClients    = i === "ops.topClients";
  const isMachineLoad   = i === "ops.machineLoad";

  // Phase 7 order/ink detail intents
  const isOrderDetail   = i === "order.detail";
  const isInkDetail     = i === "order.inkDetail" || i === "job.inkDetail";
  const isPendingShade  = i === "ink.pendingShades";

  // Standard + Phase 3 intents
  const isOrder          = (i.startsWith("order") && !isOrderWorkflow && !isLinkedJobs && !isOrderDetail) || i === "client.orders" || i === "ops.oldestOrders" || i === "ops.noJobCard";
  const isCatalog        = i.startsWith("catalog");
  const isClient         = i === "client.details";
  const isJobCard        = i.startsWith("jobcard") || i === "client.activeJobs" || i === "client.dispatchReady"
                        || i === "machine.activeJobs" || i === "catalog.activeJobs" || i === "client.artworkPending"
                        || i === "ops.stuckJobs" || i === "ops.awaitSchedule";
  const isEst            = i.startsWith("estimation");
  const isDispatchPending = i === "dispatch.pending" || i === "ops.dispatchReady";
  const isDispatchDone   = i === "dispatch.recent" || i === "dispatch.byOrder" || i === "dispatch.byClient" || i === "order.dispatchStatus";
  const isArtwork        = i.startsWith("artwork") || i === "order.artworkStatus" || i === "ops.artworkPending";
  const isInk            = i === "ink.pendingSPR";
  const isSchedule       = i.startsWith("schedule");
  const isStock          = i.startsWith("stock");
  const isMachine        = i === "master.machine";
  const isClientSummary  = i === "summary.client";

  const isDispatch = isDispatchPending || isDispatchDone;
  const known = isOrderWorkflow || isLinkedJobs || isJobWorkflow
             || isOpsSummary || isTopClients || isMachineLoad
             || isOrderDetail || isInkDetail || isPendingShade
             || isOrder || isCatalog || isClient || isJobCard || isEst || isDispatch
             || isArtwork || isInk || isSchedule || isStock || isMachine || isClientSummary;

  // ops.summary returns a single row — render directly without slice loop
  if (isOpsSummary && data.length > 0) {
    return (
      <div className="mt-2">
        <OpsSummaryCard row={data[0]} onQuery={onQuery} />
      </div>
    );
  }

  // order.detail — grouped single card showing all product lines
  if (isOrderDetail && data.length > 0) {
    return (
      <div className="mt-2">
        <OrderDetailCard rows={data} onQuery={onQuery} />
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      {data.slice(0, 10).map((row, idx) => {
        const erpUrl = buildERPLink(i, row) ?? undefined;
        return (
        <div key={idx}>
          {isOrderWorkflow && <OrderWorkflowCard  row={row} onQuery={onQuery} />}
          {isLinkedJobs    && <LinkedJobMiniCard  row={row} />}
          {isJobWorkflow   && <JobWorkflowCard    row={row} onQuery={onQuery} />}
          {isTopClients    && <ClientWorkloadCard row={row} onQuery={onQuery} />}
          {isMachineLoad   && <MachineLoadCard    row={row} onQuery={onQuery} />}
          {isOrder         && <OrderCard          row={row} erpUrl={erpUrl} />}
          {isCatalog       && <CatalogCard        row={row} />}
          {isClient        && <ClientCard         row={row} />}
          {isJobCard       && <JobCardCard        row={row} erpUrl={erpUrl} />}
          {isEst           && <EstimationCard     row={row} />}
          {isDispatchPending && <DispatchCard     row={row} />}
          {isDispatchDone  && <DispatchDoneCard   row={row} />}
          {isArtwork       && <ArtworkCard        row={row} erpUrl={erpUrl} />}
          {isInk           && <InkCard            row={row} />}
          {isInkDetail     && <InkDetailCard      row={row} />}
          {isPendingShade  && <PendingShadeCard   row={row} />}
          {isSchedule      && <ScheduleCard       row={row} erpUrl={erpUrl} />}
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
        );
      })}
      {data.length > 8 && (
        <div className="text-center text-[10px] text-gray-400 py-1">
          +{data.length - 8} more — open the module to see all
        </div>
      )}
      {!isOpsSummary && data.length >= 3 && (
        <div className="flex gap-1 mt-0.5 flex-wrap">
          <button
            onClick={() => downloadCSV(data, (result.intent ?? "export").replace(/\./g, "_") + ".csv")}
            className="text-[9px] text-gray-400 hover:text-teal-600 px-2 py-0.5 rounded border border-gray-200 hover:border-teal-300 transition-colors">
            📥 Download CSV ({data.length} rows)
          </button>
          {(isTopClients || isMachineLoad || isJobCard || isOrder || isDispatchPending) && (
            <button
              onClick={() => copyResultText(data, i)}
              className="text-[9px] text-gray-400 hover:text-teal-600 px-2 py-0.5 rounded border border-gray-200 hover:border-teal-300 transition-colors">
              📋 Copy list
            </button>
          )}
        </div>
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

function MessageBubble({ msg, onQuickReply, pinnedQueries, onTogglePin }: {
  msg: ChatMessage;
  onQuickReply: (q: string) => void;
  pinnedQueries?: string[];
  onTogglePin?: (q: string) => void;
}) {
  const isUser = msg.role === "user";
  const r = msg.result;
  const isPinned = pinnedQueries?.includes(msg.text) ?? false;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold mr-2 mt-0.5 shrink-0">
          AI
        </div>
      )}
      <div className={`max-w-[92%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        {isUser ? (
          <div className="group flex items-center gap-1">
            {onTogglePin && (
              <button
                onClick={() => onTogglePin(msg.text)}
                title={isPinned ? "Unpin" : "Pin this query"}
                className={`text-[11px] transition-opacity shrink-0 ${
                  isPinned
                    ? "text-amber-400 opacity-100"
                    : "text-gray-300 hover:text-amber-400 opacity-0 group-hover:opacity-100"
                }`}
              >
                📌
              </button>
            )}
            <div className="bg-teal-600 text-white text-xs px-3 py-2 rounded-2xl rounded-tr-sm shadow-sm">
              {msg.text}
            </div>
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
        Type anything — e.g. "ABC orders", "SO-1023 status", "pending artwork"
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

  // FlexiBot smart suggestions
  const [suggestionGroups, setSuggestionGroups]   = useState<SuggestionGroup[]>([]);
  const [activeSugCat, setActiveSugCat]           = useState<string>("");
  const [sugExpanded, setSugExpanded]             = useState(false);

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

  // Fetch personalized suggestions once when chat first opens
  useEffect(() => {
    if (!open || suggestionGroups.length > 0) return;
    apiGet<string>("api/chat/suggestions")
      .then(raw => {
        try {
          const parsed: SuggestionGroup[] = typeof raw === "string" ? JSON.parse(raw) : raw as unknown as SuggestionGroup[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSuggestionGroups(parsed);
            setActiveSugCat(parsed[0].category);
          }
        } catch {}
      })
      .catch(() => {});
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

  // Detect pure knowledge/explanation questions that should go directly to FlexiBot,
  // bypassing the ERP bot entirely. Pattern: "X kya hai?", "what is X", "explain X", etc.
  const isKnowledgeQuestion = (q: string): boolean => {
    const m = q.toLowerCase().trim();
    const KNOWLEDGE_PATTERNS = [
      /kya\s+h(ai|ota|oti|ote)\b/,   // kya hai, kya hota hai, kya hoti hai
      /kyaa\s+h(ai|ota|oti|ote)\b/,  // kyaa hai
      /\bwhat\s+is\b/,
      /\bwhat\s+are\b/,
      /\bhow\s+does\b/,
      /\bhow\s+do\b/,
      /\bexplain\b/,
      /\btell\s+me\s+about\b/,
      /\bdifference\s+between\b/,
      /\bsamjhao\b/,
      /\bbatao\b/,
      /\bwhy\s+is\b/,
      /\bwhen\s+to\s+use\b/,
      /\bkab\s+use\b/,
      /\bkya\s+hota\b/,
      /\bkaise\s+hota\b/,
      /\bkaise\s+kaam\b/,
    ];
    return KNOWLEDGE_PATTERNS.some(p => p.test(m));
  };

  const callFlexiBot = async (q: string): Promise<string | null> => {
    try {
      const raw = await apiPost<string>("api/chat/send-message", { message: q, mode: "general" });
      let parsed: { message?: string } | null = null;
      if (typeof raw === "string") {
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
      } else {
        parsed = raw as unknown as { message?: string };
      }
      return parsed?.message ?? null;
    } catch { return null; }
  };

  const sendQuery = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q || loading) return;
    setInput("");
    addMessage("user", q);
    setLoading(true);
    console.debug("[ChatBot] query:", q, "ctx:", ctx);
    try {
      // Knowledge question pattern detected → skip ERP bot, go directly to FlexiBot
      if (isKnowledgeQuestion(q)) {
        const flexiBotMsg = await callFlexiBot(q);
        if (flexiBotMsg) { addMessage("bot", flexiBotMsg); return; }
      }

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
      // Ensure data is always an array
      if (parsed && !Array.isArray(parsed.data)) parsed.data = [];
      if (parsed && !Array.isArray(parsed.quickReplies)) parsed.quickReplies = [];
      console.debug("[ChatBot] intent:", parsed?.intent, "rows:", parsed?.data?.length ?? 0);

      // ERP bot couldn't understand → fall back to FlexiBot
      if (parsed?.intent === "help" || parsed?.intent === "clarification") {
        const flexiBotMsg = await callFlexiBot(q);
        if (flexiBotMsg) { addMessage("bot", flexiBotMsg); return; }
      }

      // Only add to recent after a successful (non-null) response
      if (parsed) { addToRecent(q); updateCtx(parsed); }
      addMessage("bot", parsed?.message ?? "No response received.", parsed ?? undefined);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[ChatBot] request failed:", msg);
      addMessage("bot", "Request failed: " + msg);
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
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    onQuickReply={sendQuery}
                    pinnedQueries={pinnedQueries}
                    onTogglePin={togglePin}
                  />
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

          {/* Smart suggestion panel */}
          {suggestionGroups.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50/80 shrink-0">
              {/* Category tab strip */}
              <div className="flex items-center gap-0.5 px-2 pt-1.5 overflow-x-auto [scrollbar-width:none]">
                <span className="text-[9px] text-gray-400 font-medium mr-1 shrink-0">💡</span>
                {suggestionGroups.map(g => (
                  <button
                    key={g.category}
                    onClick={() => { setActiveSugCat(g.category); setSugExpanded(true); }}
                    className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full font-semibold transition-colors border ${
                      activeSugCat === g.category
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-gray-500 border-gray-200 hover:border-teal-400 hover:text-teal-600"
                    }`}
                  >
                    {g.icon} {g.label}
                  </button>
                ))}
                <button
                  onClick={() => setSugExpanded(e => !e)}
                  className="shrink-0 ml-auto text-[9px] text-gray-400 hover:text-teal-600 px-1"
                  title={sugExpanded ? "Collapse" : "Expand"}
                >
                  {sugExpanded ? "▲" : "▼"}
                </button>
              </div>

              {/* Active category chips */}
              {sugExpanded && (() => {
                const group = suggestionGroups.find(g => g.category === activeSugCat);
                if (!group) return null;
                const catColors: Record<string, string> = {
                  film:       "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
                  client:     "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
                  order:      "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
                  jobcard:    "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
                  estimation: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100",
                  artwork:    "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100",
                  dispatch:   "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
                  ink:        "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
                  machine:    "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
                  dashboard:  "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
                  knowledge:  "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100",
                };
                const cls = catColors[group.category] ?? "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100";
                return (
                  <div className="flex flex-wrap gap-1 px-2 pb-2 pt-1 max-h-[88px] overflow-y-auto [scrollbar-width:thin]">
                    {group.items.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => { sendQuery(s.query); setSugExpanded(false); }}
                        disabled={loading}
                        title={s.text}
                        className={`text-[9px] border rounded-full px-2 py-0.5 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed max-w-[200px] truncate ${cls}`}
                      >
                        {s.text}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Input row */}
          <div className="px-3 py-2.5 border-t border-gray-200 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="e.g. ABC orders, GRV-1234 ink details, pending artwork…"
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
