"use client";
// ───────────────────────────────────────────────────────────────────────────
// Production Module — Module 1: Production
// Landing (Scheduled Job Cards grid + QR scan job selection) → Create →
// Production Entry (header, machine/operator, auto-process, material QR
// verification, line clearance, make ready, production start).
// On start the job moves into the In-Process QC module (Pending QC entry).
// ───────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, ScanLine, LayoutGrid, CheckCircle2, AlertTriangle,
  Factory, Play, ShieldCheck, PackageCheck, Wrench, ArrowRight, ArrowLeft,
  LayoutDashboard, ChevronRight, Clock, User, RefreshCw, Trash2, GitBranch, Download, FileText, Tag,
} from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { Select, Input, Textarea } from "@/components/ui/Input";
import { statusBadge, Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import QrScanner from "@/components/ui/QrScanner";
import { QRCodeCanvas } from "qrcode.react";
import { downloadRollLabels } from "@/lib/rollLabel";
import { downloadSpoolSlips } from "@/lib/spoolSlip";
import { downloadLcChecksheet } from "@/lib/lcChecksheet";
import { downloadJobReport } from "@/lib/jobReport";
import { apiGet, apiPost } from "@/lib/api";

const API = "api/productionModule";

// ── Types ────────────────────────────────────────────────────────────────
interface ScheduledRow {
  ScheduleSequenceID: number;
  JobBookingID: number;
  JobBookingNo: string;
  ContentID: number;
  JobCardContentNo: string;
  PlanContName: string;
  PlanType: string;
  Client: string;
  Product: string;
  MachineID: number;
  MachineName: string;
  ProcessID: number;
  ProcessName: string;
  RateFactor: string;
  JobCardFormNo: string;
  ScheduleQty: number;
  ScheduleDate: string;
  CurrentStatus: string;
  MaterialStatus: string;
  SequenceNo: number;
  MaterialRequired: number;
  PrevAllComplete: number;
}
interface ProcCtx {
  ProcessName: string; RateFactor: string; ScheduleSequenceID: number; JobCardFormNo: string;
  SequenceNo: number; ScheduleQty: number; Status: string; MaterialRequired: number;
  ProcessProductionType: string; StartUnit: string; EndUnit: string;
  UnitConversion: string; CylMM: number; FeedValue: number; TotalUps: number;
  PrevProcessName: string; PrevProductionQty: number; IsFirst: number; PrevComplete: number; IsLast: number;
  BalanceQty: number; ProducedSoFar: number;
}

// Unit-conversion engine (mirrors backend ComputeReadyQty). prod (start unit) → output (end unit).
function computeReady(uc: string, prod: number, cyl: number, feed: number, ups: number): number {
  const u = (uc || "").trim().toUpperCase();
  const impr = cyl > 0 ? cyl : (feed > 0 ? feed : 0);
  const up = ups > 0 ? ups : 1;
  switch (u) {
    case "FORMS": return prod;
    case "SLITTING AC": return impr > 0 ? Math.round((prod * 1000 / impr) * up) : prod;
    case "SHEET UNIT": return cyl > 0 ? Math.round(prod * 1000 / cyl) : prod;
    case "UPS":
    case "CUTS": return prod * up;
    default: return prod;
  }
}
interface Machine { MachineID: number; MachineName: string; MachineCode: string; DepartmentID: number; CurrentStatus: string; }
interface Operator { OperatorID: number; OperatorName: string; }
interface AutoProcess {
  ProcessID: number; ProcessName: string; RateFactor: string; ProcessProductionType: string;
  IsOnlineProcess: number; JobCardFormNo: string; ScheduleSequenceID: number; ScheduleQty: number;
  MaterialRequired: number; MatchType: string;
}
interface MaterialRow {
  TransactionDetailID: number; ItemID: number; ItemName: string; BatchNo: string; BatchID: number;
  RequiredQty: number; IssuedQty: number; StockUnit: string;
  verified?: boolean; consumedQty?: number;
}
interface LcParam { ParameterName: string; StandardValue: string; FieldType: string; DefaultValue: string; DropDownVal: string; Result: string; }
interface LcData { Required: boolean; LcDone: boolean; LcNo: string; Params: LcParam[]; }
interface QcData { Required: boolean; Done: boolean; VoucherNo: string; Params: LcParam[]; }
interface OnlineProc { ProcessID: number; ProcessName: string; UnitConversion: string; StartUnit: string; EndUnit: string; Status: string; }
interface JobTool { ToolID: number; ToolCode: string; ToolName: string; RequiredToolType: string; ToolBatchNo: string; IssueTransactionID: number; RatedLifeMeters: number; UsedMeters: number; UsedImpressions: number; }
interface PrevRating { PrevProcessID: number; PrevProcessName: string; ExistingRating: number; ExistingRemark: string; }
interface ProdComment { CommentID: number; Title: string; CommentType: string; Description: string; CreatedByName: string; CreatedDate: string; }

interface RunningInfo {
  ProductionID: number; Status: string; ScheduleQty: number; ProducedSoFar: number;
  WastageSoFar: number; EmployeeID: number; QCStatus: string; QCEntryID: number;
  JobBookingNo: string; ProcessName: string; MaterialRequired: number;
}

const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
// A process is createable only if: it is In Queue, ALL previous-sequence processes
// are Complete, and (material not required OR material issued).
const isSelectable = (r: ScheduledRow) =>
  r.CurrentStatus === "In Queue" &&
  num(r.PrevAllComplete) === 1 &&
  (num(r.MaterialRequired) !== 1 || r.MaterialStatus === "Issued");
const blockReason = (r: ScheduledRow) =>
  num(r.PrevAllComplete) !== 1 ? "Pehle previous process complete karo, fir ye chalegi"
    : (num(r.MaterialRequired) === 1 && r.MaterialStatus !== "Issued") ? "Material not issued — cannot start"
    : "";
const RUNNING_LIKE = ["Running", "Part Complete", "Hold"];
const isRunningLike = (r: ScheduledRow) => RUNNING_LIKE.includes(r.CurrentStatus);

export default function ProductionPage() {
  const { showToast } = useToast();
  const [mode, setMode] = useState<"grid" | "qr" | "dashboard">("grid");
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ScheduledRow | null>(null);
  const [jobScannerOpen, setJobScannerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateRow, setUpdateRow] = useState<ScheduledRow | null>(null);

  // ── Load scheduled job cards ──────────────────────────────────────────
  const loadScheduled = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<ScheduledRow[]>(`${API}/scheduled`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast("error", "Failed to load", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadScheduled(); }, [loadScheduled]);

  // ── QR job selection ──────────────────────────────────────────────────
  const handleJobScan = async (raw: string) => {
    setJobScannerOpen(false);
    let jobNo = raw.trim();
    try { const p = JSON.parse(raw); jobNo = p.JobBookingNo ?? p.jobBookingNo ?? p.JobCardNo ?? raw; } catch { /* plain text */ }

    try {
      showToast("info", "Job Found", "Checking schedule & material status…");
      const data = await apiGet<ScheduledRow[]>(`${API}/jobbyqr/${encodeURIComponent(jobNo)}`);
      const list = Array.isArray(data) ? data : [];
      if (list.length === 0) { showToast("error", "Not Scheduled", `Job Card ${jobNo} is not scheduled.`); return; }
      const pick = list.find(isSelectable);
      if (!pick) {
        const r = list[0];
        if (r.MaterialStatus !== "Issued") showToast("error", "Material not issued", "Cannot start production.");
        else showToast("warning", "Not available", `Job is ${r.CurrentStatus}.`);
        return;
      }
      setSelected(pick);
      showToast("success", "Job Selected", `${pick.JobBookingNo} — ${pick.PlanContName || pick.JobCardContentNo}`);
    } catch (e) {
      showToast("error", "Scan failed", (e as Error).message);
    }
  };

  const openCreate = (r: ScheduledRow) => {
    if (!isSelectable(r)) return;
    setSelected(r);
    setCreateOpen(true);
  };

  const columns: Column<ScheduledRow>[] = [
    { key: "JobBookingNo", header: "Job Card No", sortable: true,
      render: (r) => <span className="font-medium">{r.JobBookingNo}</span> },
    { key: "Client", header: "Client", sortable: true },
    { key: "Product", header: "Product", sortable: true },
    { key: "MachineName", header: "Machine (Scheduled)", render: (r) => r.MachineName || "—" },
    { key: "ScheduleQty", header: "Sched. Qty", render: (r) => num(r.ScheduleQty).toLocaleString("en-IN") },
    { key: "ScheduleDate", header: "Schedule Date", render: (r) => r.ScheduleDate || "—" },
    { key: "CurrentStatus", header: "Status", render: (r) => statusBadge(r.CurrentStatus) },
    { key: "MaterialStatus", header: "Material", render: (r) =>
        r.MaterialStatus === "Issued"
          ? <Badge label="Issued" variant="green" />
          : <span title="Material not issued — cannot start production"><Badge label="Not Issued" variant="red" /></span> },
  ];

  // Inline Production Update view (Module 2) for a running job process.
  if (updateRow) {
    return (
      <ProductionUpdate
        row={updateRow}
        onClose={() => setUpdateRow(null)}
        onDone={() => { setUpdateRow(null); loadScheduled(); }}
      />
    );
  }

  // Inline full-page Create view — renders inside the AppShell content area
  // (keeps the sidebar + topbar visible), NOT a full-screen modal overlay.
  if (createOpen && selected) {
    return (
      <ProductionEntry
        job={selected}
        onClose={() => setCreateOpen(false)}
        onStarted={() => { setCreateOpen(false); setSelected(null); loadScheduled(); }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 flex-wrap"
        style={{ background: "var(--erp-primary)", minHeight: 44 }}>
        <div className="flex items-center gap-2 text-white">
          <Factory size={16} />
          <h1 className="text-sm font-semibold">Production</h1>
        </div>

        {/* Grid / QR / Dashboard toggle */}
        <div className="flex items-center rounded-lg overflow-hidden border border-white/25 ml-2">
          {([
            { m: "grid" as const, icon: LayoutGrid, label: "Grid Selection" },
            { m: "qr" as const, icon: ScanLine, label: "QR Scanner" },
            { m: "dashboard" as const, icon: LayoutDashboard, label: "Dashboard" },
          ]).map(({ m, icon: Icon, label }) => (
            <button key={m} onClick={() => setMode(m)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ background: mode === m ? "#fff" : "transparent", color: mode === m ? "var(--erp-primary)" : "#fff" }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <a href="/gravure/production/qr-tracking"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white/90 hover:text-white hover:bg-white/10 ml-1">
          <GitBranch size={13} /> QR Tracking
        </a>

        {mode === "qr" && selected && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-white/90 bg-white/15 rounded-md px-2 py-1">
              Selected: <b>{selected.JobBookingNo}</b> · {selected.PlanContName || selected.JobCardContentNo}
            </span>
            <Button variant="primary" size="sm" icon={<Plus size={14} />}
              onClick={() => setCreateOpen(true)}
              style={{ background: "#fff", color: "var(--erp-primary)" }}>
              Create Production
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {mode === "dashboard" ? (
        <ProductionDashboard />
      ) : mode === "qr" ? (
        <div className="flex-1 overflow-auto bg-white flex items-center justify-center">
          <div className="text-center max-w-md p-8">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--erp-primary-light)" }}>
              <ScanLine size={30} style={{ color: "var(--erp-primary)" }} />
            </div>
            <h2 className="text-base font-semibold text-gray-800">Scan Job Card QR</h2>
            <p className="text-sm text-gray-500 mt-1">
              Scan the QR on the job printout. We verify it is scheduled and material is issued before selecting.
            </p>
            <div className="mt-5">
              <Button variant="primary" icon={<ScanLine size={15} />} onClick={() => setJobScannerOpen(true)}>
                Open Scanner
              </Button>
            </div>
            {selected && (
              <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-left">
                <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                  <CheckCircle2 size={16} /> Job selected
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {selected.JobBookingNo} · {selected.Client} · {selected.Product}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-white">
          <DataTable
            data={rows}
            columns={columns}
            loading={loading}
            pageSize={25}
            enableRowSelection={false}
            searchKeys={["JobBookingNo", "Client", "Product", "MachineName"]}
            actions={(r) => (
              isRunningLike(r) ? (
                <Button size="xs" variant="primary" icon={<Play size={12} />} onClick={() => setUpdateRow(r)}>
                  Update
                </Button>
              ) : (
                <Button size="xs" variant="primary" icon={<Plus size={12} />}
                  disabled={!isSelectable(r)}
                  title={!isSelectable(r) ? (blockReason(r) || `Job is ${r.CurrentStatus}`) : "Create production for this job"}
                  onClick={() => openCreate(r)}>
                  Create
                </Button>
              )
            )}
          />
        </div>
      )}

      {/* Footer */}
      {mode !== "dashboard" && (
        <div className="flex-shrink-0 px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-500">
          {loading ? "Loading…" : `${rows.length} scheduled job card${rows.length === 1 ? "" : "s"} · ${rows.filter(isSelectable).length} ready to start`}
        </div>
      )}

      {jobScannerOpen && (
        <QrScanner title="Scan Job Card" hint="QR contains the Job Card Number"
          onScan={handleJobScan} onClose={() => setJobScannerOpen(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  PRODUCTION DASHBOARD (Module 3) — active + completed productions as cards
// ═══════════════════════════════════════════════════════════════════════════
interface DashRow {
  JobBookingID: number; JobBookingNo: string; Client: string; Product: string;
  ContentID: number; JobCardContentNo: string; PlanContName: string;
  ProcessID: number; ProcessName: string; RateFactor: string;
  MachineID: number; MachineName: string; ScheduleQty: number; Status: string;
  ScheduleSequenceID: number; SequenceNo: number;
  ProductionID: number; ProducedQty: number; WastageQty: number; OperatorName: string;
  StartTime: string | null; EndTime: string | null; QCStatus: string;
}
interface UpdRec {
  ProductionUpdateID: number; UpdatedOn: string; ProductionQuantity: number;
  WastageQuantity: number; Status: string; Remark: string;
}

function ProductionDashboard() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<DashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "Running" | "Complete" | "In Queue" | "Hold">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<DashRow[]>(`${API}/dashboard`);
      setRows(Array.isArray(d) ? d : []);
    } catch (e) { showToast("error", "Dashboard", (e as Error).message); }
    finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const closeJob = async (jobBookingId: number) => {
    if (!window.confirm("Is job ko CLOSE karein? (IsClose=1 — grid/scheduling se hat jayega)")) return;
    try {
      const res = await apiPost<{ Success?: boolean }>(`${API}/closejob`, { JobBookingID: jobBookingId, Close: true });
      if (res && typeof res === "object" && res.Success) { showToast("success", "Job closed", ""); load(); }
      else showToast("error", "Failed", String(res).replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "Failed", (e as Error).message); }
  };

  // group rows by content into cards
  const cards = useMemo(() => {
    const map = new Map<number, DashRow[]>();
    for (const r of rows) {
      if (!map.has(r.ContentID)) map.set(r.ContentID, []);
      map.get(r.ContentID)!.push(r);
    }
    return Array.from(map.values()).map((procs) => {
      const sorted = [...procs].sort((a, b) => (a.SequenceNo || a.ScheduleSequenceID) - (b.SequenceNo || b.ScheduleSequenceID));
      const total = sorted.length;
      const completed = sorted.filter((p) => p.Status === "Complete").length;
      const running = sorted.find((p) => p.Status === "Running");
      const hold = sorted.find((p) => p.Status === "Hold");
      const current = running || hold || sorted.find((p) => p.Status !== "Complete") || sorted[total - 1];
      // partial progress (some processes done but not all) counts as Running/in-progress
      const overall = completed === total ? "Complete"
        : running ? "Running"
        : hold ? "Hold"
        : completed > 0 ? "Running"
        : "In Queue";
      const head = sorted[0];
      return { head, sorted, total, completed, current, overall };
    }).filter((c) => filter === "all" || c.overall === filter);
  }, [rows, filter]);

  const statusColors: Record<string, string> = {
    Complete: "#16a34a", Running: "#ca8a04", Hold: "#ea580c", "In Queue": "#94a3b8", "Part Complete": "#ca8a04",
  };

  return (
    <div className="flex-1 overflow-auto" style={{ background: "var(--background)" }}>
      {/* Sub-toolbar: filters + refresh */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
        {(["all", "Running", "In Queue", "Hold", "Complete"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
            style={{
              background: filter === f ? "var(--erp-primary)" : "#fff",
              color: filter === f ? "#fff" : "#475569",
              borderColor: filter === f ? "var(--erp-primary)" : "#e2e8f0",
            }}>
            {f === "all" ? "All" : f}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-1">{cards.length} job{cards.length === 1 ? "" : "s"}</span>
        <Button size="xs" variant="secondary" icon={<RefreshCw size={12} />} onClick={load} className="ml-auto">Refresh</Button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading dashboard…</div>
      ) : cards.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No production found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
          {cards.map((c) => {
            const isOpen = expanded.has(c.head.ContentID);
            const schedule = num(c.head.ScheduleQty);
            const produced = num(c.current?.ProducedQty);
            const pct = c.total ? Math.round((c.completed / c.total) * 100) : 0;
            return (
              <div key={c.head.ContentID} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Card header */}
                <button onClick={() => setExpanded((s) => { const n = new Set(s); n.has(c.head.ContentID) ? n.delete(c.head.ContentID) : n.add(c.head.ContentID); return n; })}
                  className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight size={16} className="text-gray-400 transition-transform flex-shrink-0"
                        style={{ transform: isOpen ? "rotate(90deg)" : "none" }} />
                      <span className="font-bold text-gray-800 text-sm">{c.head.JobBookingNo}</span>
                      <span className="text-xs text-gray-400 truncate">· {c.head.JobCardContentNo}</span>
                    </div>
                    {statusBadge(c.overall)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{c.head.Client || "—"} · {c.head.Product || c.head.PlanContName || "—"}</p>
                </button>

                {/* Card body */}
                <div className="px-4 py-3 space-y-3">
                  {/* progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{c.completed}/{c.total} processes</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--erp-primary)" }} />
                    </div>
                  </div>

                  {/* current process summary */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400">Current Process</p>
                      <p className="font-medium text-gray-800 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: statusColors[c.current?.Status] ?? "#94a3b8" }} />
                        {c.current?.ProcessName || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Machine</p>
                      <p className="font-medium text-gray-800 truncate">{c.current?.MachineName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Produced / Schedule</p>
                      <p className="font-medium text-gray-800">{produced.toLocaleString("en-IN")} / {schedule.toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Operator</p>
                      <p className="font-medium text-gray-800 truncate">{c.current?.OperatorName || "—"}</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button onClick={(e) => { e.stopPropagation(); closeJob(c.head.JobBookingID); }}
                      className="text-[11px] flex items-center gap-1 text-gray-500 hover:text-red-600">
                      <CheckCircle2 size={12} /> Close Job
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); downloadJobReport(c.head.ContentID).catch(() => showToast("error", "Report failed", "Could not generate report")); }}
                      className="text-[11px] flex items-center gap-1 text-gray-500 hover:text-[color:var(--erp-primary)]">
                      <FileText size={12} /> Production Report (PDF)
                    </button>
                  </div>

                  {/* expanded process list */}
                  {isOpen && (
                    <div className="mt-2 border-t border-gray-100 pt-2 space-y-1">
                      {c.sorted.map((p) => (
                        <DashProcessRow key={p.ScheduleSequenceID} p={p} onChanged={load} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── One process row in a dashboard card: detail + records + delete ────────
function DashProcessRow({ p, onChanged }: { p: DashRow; onChanged: () => void }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [recs, setRecs] = useState<UpdRec[]>([]);
  const [busy, setBusy] = useState(false);
  const hasProd = p.ProductionID > 0;

  const loadRecs = useCallback(async () => {
    if (!hasProd) return;
    const d = await apiGet<UpdRec[]>(`${API}/updatehistory/${p.ProductionID}`).catch(() => []);
    setRecs(Array.isArray(d) ? d : []);
  }, [p.ProductionID, hasProd]);
  useEffect(() => { if (open) loadRecs(); }, [open, loadRecs]);

  const delLatest = async (id: number) => {
    setBusy(true);
    try {
      const res = await apiPost<string>(`${API}/deleteupdate`, { ID: id });
      if (String(res ?? "").startsWith("Success")) { showToast("success", "Record deleted", ""); await loadRecs(); onChanged(); }
      else showToast("error", "Delete failed", String(res).replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "Delete failed", (e as Error).message); }
    finally { setBusy(false); }
  };

  const delProcess = async () => {
    setBusy(true);
    try {
      const res = await apiPost<string>(`${API}/deleteprocess`, { ID: p.ProductionID });
      if (String(res ?? "").startsWith("Success")) { showToast("success", "Process deleted", "Re-entry ke liye ready."); onChanged(); }
      else showToast("error", "Cannot delete", String(res).replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "Delete failed", (e as Error).message); }
    finally { setBusy(false); }
  };

  // Admin: force a process status (JSR + JBJP + ProductionEntry).
  const changeStatus = async (st: string) => {
    if (!st) return;
    setBusy(true);
    try {
      const res = await apiPost<{ Success?: boolean }>(`${API}/changestatus`, { ContentID: p.ContentID, ProcessID: p.ProcessID, Status: st });
      if (res && typeof res === "object" && res.Success) { showToast("success", "Status changed", `${p.ProcessName} → ${st}`); onChanged(); }
      else showToast("error", "Failed", String(res).replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "Failed", (e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-gray-100">
      <button onClick={() => hasProd && setOpen((o) => !o)}
        className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 ${hasProd ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"}`}>
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-800">
          {hasProd
            ? <ChevronRight size={12} className="text-gray-400 transition-transform" style={{ transform: open ? "rotate(90deg)" : "none" }} />
            : <span className="w-3" />}
          {p.ProcessName}
        </span>
        {statusBadge(p.Status)}
      </button>

      <div className="px-3 pb-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
        <span><Factory size={10} className="inline mr-1" />{p.MachineName || "—"}</span>
        <span><User size={10} className="inline mr-1" />{p.OperatorName || "—"}</span>
        <span>Produced: <b className="text-gray-700">{num(p.ProducedQty).toLocaleString("en-IN")}</b>{num(p.WastageQty) > 0 ? ` · Waste ${num(p.WastageQty).toLocaleString("en-IN")}` : ""}</span>
        <span>{p.QCStatus ? `QC: ${p.QCStatus}` : ""}</span>
        {p.StartTime && <span><Clock size={10} className="inline mr-1" />Start: {p.StartTime}</span>}
        {p.EndTime && <span><Clock size={10} className="inline mr-1" />End: {p.EndTime}</span>}
      </div>

      {open && hasProd && (
        <div className="px-3 pb-3">
          {recs.length > 0 ? (
            <div className="rounded border border-gray-100 overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-left">
                    <th className="px-2 py-1">Time</th>
                    <th className="px-2 py-1 text-right">Qty</th>
                    <th className="px-2 py-1 text-right">Waste</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1 text-right">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {recs.map((rec, i) => (
                    <tr key={rec.ProductionUpdateID} className="border-t border-gray-100">
                      <td className="px-2 py-1 text-gray-500">{rec.UpdatedOn}</td>
                      <td className="px-2 py-1 text-right">{num(rec.ProductionQuantity).toLocaleString("en-IN")}</td>
                      <td className="px-2 py-1 text-right">{num(rec.WastageQuantity).toLocaleString("en-IN")}</td>
                      <td className="px-2 py-1">{rec.Status}</td>
                      <td className="px-2 py-1 text-right">
                        {i === 0 ? (
                          <button onClick={() => delLatest(rec.ProductionUpdateID)} disabled={busy}
                            title="Delete this (latest) record" className="text-red-500 hover:text-red-700 disabled:opacity-40">
                            <Trash2 size={12} />
                          </button>
                        ) : (
                          <span title="Latest record pehle delete hoga" className="text-gray-300"><Trash2 size={12} /></span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400">No update records yet.</p>
          )}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <button onClick={delProcess} disabled={busy}
              className="text-[11px] text-red-600 hover:text-red-800 disabled:opacity-40 flex items-center gap-1">
              <Trash2 size={12} /> Delete Process &amp; Re-enter
            </button>
            <span className="text-[11px] text-gray-300">|</span>
            <label className="text-[11px] text-gray-400 flex items-center gap-1">
              Admin status:
              <select value="" onChange={(e) => changeStatus(e.target.value)} disabled={busy}
                className="text-[11px] rounded border border-gray-300 px-1.5 py-0.5">
                <option value="">change…</option>
                {["In Queue", "Running", "Part Complete", "Hold", "Complete"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  PRODUCTION ENTRY (Create) — full-screen flow
// ═══════════════════════════════════════════════════════════════════════════
function ProductionEntry({ job, onClose, onStarted }: {
  job: ScheduledRow; onClose: () => void; onStarted: () => void;
}) {
  const { showToast } = useToast();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineId, setMachineId] = useState<number | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [operatorId, setOperatorId] = useState<number | null>(null);
  // Process is FIXED for the selected row (sequence-enforced); it never changes
  // when the machine changes — only the operator list reloads.
  const [ctx, setCtx] = useState<ProcCtx | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [matScanTarget, setMatScanTarget] = useState<MaterialRow | null>(null);
  const [inputRolls, setInputRolls] = useState<InRoll[]>([]);
  const [scannedRolls, setScannedRolls] = useState<number[]>([]);
  const [rollScanOpen, setRollScanOpen] = useState(false);

  const [onlineChain, setOnlineChain] = useState<OnlineProc[]>([]);
  const [lcData, setLcData] = useState<LcData | null>(null);
  const [lcResults, setLcResults] = useState<Record<string, string>>({});
  const [lcSaved, setLcSaved] = useState(false);
  const [lcNo, setLcNo] = useState("");
  const [lcSaving, setLcSaving] = useState(false);

  const [mkStart, setMkStart] = useState<string | null>(null);
  const [mkEnd, setMkEnd] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [starting, setStarting] = useState(false);

  // Load process context (schedule/balance qty, material-required), machines of
  // the process department, line-clearance params, and issued materials — once.
  useEffect(() => {
    (async () => {
      setCtxLoading(true);
      try {
        const [ctxArr, m] = await Promise.all([
          apiGet<ProcCtx[]>(`${API}/processcontext/${job.ContentID}/${job.ProcessID}`),
          apiGet<Machine[]>(`${API}/machines/${job.ProcessID}`),
        ]);
        const c = Array.isArray(ctxArr) && ctxArr.length ? ctxArr[0] : null;
        setCtx(c);
        const list = Array.isArray(m) ? m : [];
        setMachines(list);
        apiGet<OnlineProc[]>(`${API}/onlineprocesses/${job.ContentID}/${job.ProcessID}`).then((ol) => setOnlineChain(Array.isArray(ol) ? ol : [])).catch(() => {});
        if (c && num(c.MaterialRequired) === 1) {
          const mats = await apiGet<MaterialRow[]>(`${API}/materialverification/${job.ContentID}`);
          setMaterials((Array.isArray(mats) ? mats : []).map((mm) => ({ ...mm, verified: false, consumedQty: num(mm.IssuedQty) })));
        }
        // Later processes: load previous-process output rolls as available input.
        if (c && num(c.IsFirst) !== 1) {
          const ir = await apiGet<InRoll[]>(`${API}/inputrolls/${job.ContentID}/${job.ProcessID}`).catch(() => []);
          setInputRolls(Array.isArray(ir) ? ir : []);
        }
        // pre-select the scheduled machine if it belongs to this department
        if (job.MachineID && list.some((x) => x.MachineID === job.MachineID)) {
          setMachineId(job.MachineID);
          const ops = await apiGet<Operator[]>(`${API}/operators/${job.MachineID}`);
          setOperators(Array.isArray(ops) ? ops : []);
        }
      } catch (e) { showToast("error", "Load failed", (e as Error).message); }
      finally { setCtxLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.ContentID, job.ProcessID]);

  // Line Clearance is machine-specific → (re)load its params + any saved results
  // whenever the chosen machine changes.
  useEffect(() => {
    if (!machineId) { setLcData(null); setLcResults({}); setLcSaved(false); setLcNo(""); return; }
    (async () => {
      const d = await apiGet<LcData>(`${API}/lcparams/${job.ContentID}/${job.ProcessID}/${machineId}`).catch(() => null);
      if (d && typeof d === "object") {
        setLcData(d);
        const init: Record<string, string> = {};
        (d.Params || []).forEach((p) => { init[p.ParameterName] = p.Result ?? ""; });
        setLcResults(init);
        setLcSaved(!!d.LcDone);
        setLcNo(d.LcNo || "");
      } else { setLcData(null); setLcResults({}); setLcSaved(false); setLcNo(""); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, job.ContentID, job.ProcessID]);

  // Machine change → reload OPERATORS only. Process stays the same.
  const onMachineChange = async (id: number) => {
    setMachineId(id);
    setOperatorId(null);
    setOperators([]);
    if (!id) return;
    try {
      const ops = await apiGet<Operator[]>(`${API}/operators/${id}`);
      setOperators(Array.isArray(ops) ? ops : []);
    } catch (e) { showToast("error", "Operators", (e as Error).message); }
  };

  // Material QR verification
  const handleMaterialScan = (raw: string) => {
    const target = matScanTarget;
    setMatScanTarget(null);
    if (!target) return;
    let batchNo = raw.trim();
    try { const p = JSON.parse(raw); batchNo = p.batchNo ?? p.BatchNo ?? raw; } catch { /* plain */ }
    if (batchNo.trim() === (target.BatchNo || "").trim()) {
      setMaterials((cur) => cur.map((m) => m.TransactionDetailID === target.TransactionDetailID ? { ...m, verified: true } : m));
      showToast("success", "Verified", `${target.ItemName} · ${target.BatchNo}`);
    } else {
      showToast("error", "Mismatch", `Scanned batch does not match ${target.BatchNo}.`);
    }
  };

  // Scan/verify an input roll (previous process output) at Start.
  const handleRollScan = async (raw: string) => {
    setRollScanOpen(false);
    let rid = 0, bn = raw.trim();
    try { const p = JSON.parse(raw); rid = Number(p.rid ?? p.RollID ?? 0); bn = p.bn ?? p.batchNo ?? bn; } catch { /* plain */ }
    const roll = inputRolls.find((x) => x.RollID === rid) || inputRolls.find((x) => x.BatchNo === bn);
    if (!roll) { showToast("error", "Not found", "Ye roll is process ke input mein nahi"); return; }
    try {
      const v = await apiGet<Array<{ Validation: string }>>(`${API}/validateroll/${roll.RollID}/${job.ContentID}/${job.ProcessID}`);
      const val = Array.isArray(v) && v.length ? v[0].Validation : "Not found";
      if (val !== "OK") { showToast("error", "Invalid roll", String(val)); return; }
      setScannedRolls((cur) => cur.includes(roll.RollID) ? cur : [...cur, roll.RollID]);
      showToast("success", "Roll added", roll.BatchNo);
    } catch (e) { showToast("error", "Validate failed", (e as Error).message); }
  };

  const materialRequired = ctx ? num(ctx.MaterialRequired) === 1 : false;
  const allVerified = !materialRequired || (materials.length > 0 && materials.every((m) => m.verified));
  const lcRequired = !!lcData?.Required;
  const lcAllFilled = !lcData || (lcData.Params || []).every((p) => (lcResults[p.ParameterName] ?? "").trim() !== "");
  const lcOk = !lcRequired || lcSaved;

  // Save Line Clearance (pre-start → ProductionID=0; re-linked to the run at Start).
  const saveLineClearance = async () => {
    if (!lcData || !machineId) return;
    if (!lcAllFilled) { showToast("warning", "Fill all", "Har parameter ka result bharo."); return; }
    setLcSaving(true);
    try {
      const payload = {
        ContentID: job.ContentID, ProcessID: job.ProcessID, MachineID: machineId, ProductionID: 0,
        JobBookingID: job.JobBookingID, LcNo: lcNo,
        Parameters: (lcData.Params || []).map((p) => ({ ParameterName: p.ParameterName, StandardValue: p.StandardValue, Result: lcResults[p.ParameterName] ?? "" })),
      };
      const res = await apiPost<{ Success?: boolean; LcNo?: string }>(`${API}/savelineclearance`, payload);
      if (res && typeof res === "object" && res.Success) {
        setLcSaved(true); setLcNo(res.LcNo || lcNo);
        showToast("success", "Line clearance saved", res.LcNo || "");
      } else showToast("error", "Save failed", String(res).replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "Save failed", (e as Error).message); }
    finally { setLcSaving(false); }
  };
  const inputRequired = ctx ? num(ctx.IsFirst) !== 1 && inputRolls.length > 0 : false;
  const inputOk = !inputRequired || scannedRolls.length > 0;
  const gate1 = !!machineId && !!operatorId && !!ctx && allVerified && lcOk && inputOk; // enables Make Ready + Start
  const canStart = gate1 && !!mkEnd;
  const gateHint = !ctx ? "Loading process…"
    : !machineId ? "Select a machine"
    : !operatorId ? "Select an operator"
    : !inputOk ? "Input roll(s) scan/select karo"
    : !allVerified ? "Verify all issued materials"
    : !lcOk ? "Complete line clearance"
    : "";

  const nowStr = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  // ── Make Ready timer (real MachineCurrentStatusEntry interval) ─────────────
  // Live elapsed while the interval is open; resumes from the server after refresh.
  useEffect(() => {
    if (!mkStart || mkEnd) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [mkStart, mkEnd]);
  const mkElapsed = (() => {
    if (!mkStart) return "";
    const start = new Date(mkStart.replace(" ", "T")).getTime();
    const end = mkEnd ? new Date(mkEnd.replace(" ", "T")).getTime() : Date.now();
    void tick;
    const s = Math.max(0, Math.floor((end - start) / 1000));
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(Math.floor(s / 60))}:${p(s % 60)}`;
  })();

  // Resume an already-open setup for the chosen machine (after refresh/crash).
  useEffect(() => {
    if (!machineId) { setMkStart(null); setMkEnd(null); return; }
    (async () => {
      const rows = await apiGet<Array<{ StartTime: string }>>(`${API}/opensetup/${machineId}`).catch(() => []);
      if (Array.isArray(rows) && rows.length && rows[0].StartTime) { setMkStart(rows[0].StartTime); setMkEnd(null); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId]);

  const doMkStart = async () => {
    if (!machineId || !ctx) return;
    setSetupBusy(true);
    try {
      const res = await apiPost<{ TransactionID?: number }>(`${API}/setupstart`, { MachineID: machineId, ContentID: job.ContentID, ProcessID: job.ProcessID, OperatorID: operatorId ?? 0 });
      if (res && typeof res === "object") { setMkStart(nowStr()); setMkEnd(null); }
      else showToast("error", "Setup failed", String(res).replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "Setup failed", (e as Error).message); }
    finally { setSetupBusy(false); }
  };
  const doMkComplete = async () => {
    if (!machineId) return;
    setSetupBusy(true);
    try {
      const res = await apiPost<{ Result?: string }>(`${API}/setupend`, { MachineID: machineId });
      const result = res && typeof res === "object" ? res.Result : "";
      setMkEnd(nowStr());
      if (result === "discarded") showToast("info", "Setup discarded", "60 sec se kam — mis-click maana gaya (par aage badh sakte ho).");
      else showToast("success", "Make ready complete", mkElapsed ? `Setup time: ${mkElapsed}` : "");
    } catch (e) { showToast("error", "Setup failed", (e as Error).message); }
    finally { setSetupBusy(false); }
  };

  const doStart = async () => {
    if (!ctx || !machineId || !operatorId) return;
    setStarting(true);
    try {
      const body = {
        MachineID: machineId,
        ContentID: job.ContentID,
        JobBookingID: job.JobBookingID,
        ProcessID: job.ProcessID,
        RateFactor: ctx.RateFactor || job.RateFactor,
        EmployeeID: operatorId,
        ReceivedQty: num(ctx.ScheduleQty || job.ScheduleQty),
        ScheduleQty: num(ctx.ScheduleQty || job.ScheduleQty),
        PaperID: 0,
        ScheduleSequenceID: ctx.ScheduleSequenceID || job.ScheduleSequenceID,
        JobCardFormNo: ctx.JobCardFormNo || job.JobCardFormNo,
        FromTime: nowStr(),
        MakeReadyStartTime: mkStart ?? "",
        MakeReadyEndTime: mkEnd ?? "",
        MaterialVerificationStatus: materialRequired ? "Verified" : "NotRequired",
        LineClearanceStatus: lcRequired ? "Completed" : "NotRequired",
        ScannedRolls: scannedRolls,
        OnlineProcessIDs: [] as number[],
      };
      const res = await apiPost<string>(`${API}/start`, body);
      const txt = String(res ?? "");
      if (txt.startsWith("Success")) {
        showToast("success", "Production Started", "Job moved to In-Process QC (Pending).");
        onStarted();
      } else {
        showToast("error", "Start failed", txt.replace(/^Error:\s*/, "") || "Unknown error");
      }
    } catch (e) {
      showToast("error", "Start failed", (e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const HeaderCell = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-white/60">{label}</p>
      <p className="text-sm font-semibold text-white truncate">{value}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2"
        style={{ background: "var(--erp-primary)", minHeight: 44 }}>
        <button onClick={onClose} className="flex items-center gap-1 text-white/90 hover:text-white text-xs font-medium">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="w-px h-4 bg-white/25" />
        <h1 className="text-sm font-semibold text-white">Create Production</h1>
        <span className="text-xs text-white/80 bg-white/15 rounded-md px-2 py-1 hidden md:inline">
          {job.JobBookingNo} · {job.PlanContName || job.JobCardContentNo}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" icon={<Play size={14} />} loading={starting}
            disabled={!canStart} onClick={doStart}
            style={{ background: "#fff", color: "var(--erp-primary)", opacity: canStart ? 1 : 0.5 }}>
            Production Start
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 py-3" style={{ background: "var(--background)" }}>
        <div className="w-full space-y-3">
        {/* ── Header: selected job ─────────────────────────────────── */}
        <div className="rounded-lg px-4 py-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3"
          style={{ background: "var(--erp-sidebar-bg)" }}>
          <HeaderCell label="Job Card" value={job.JobBookingNo} />
          <HeaderCell label="Client" value={job.Client || "—"} />
          <HeaderCell label="Product" value={job.Product || "—"} />
          <HeaderCell label="Schedule Qty" value={num(ctx?.ScheduleQty ?? job.ScheduleQty).toLocaleString("en-IN")} />
          <HeaderCell label="Balance Qty" value={num(ctx?.BalanceQty ?? job.ScheduleQty).toLocaleString("en-IN")} />
          <HeaderCell label="Current Process" value={ctx?.ProcessName || job.ProcessName || "—"} />
          <HeaderCell label="Status" value={job.CurrentStatus} />
        </div>

        {/* ── Step 1: Machine & Operator ───────────────────────────── */}
        <StepCard n={1} title="Machine & Operator" icon={<Factory size={16} />}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label="Machine" value={machineId ? String(machineId) : ""}
              onChange={(e) => onMachineChange(Number(e.target.value))}
              options={[{ value: "", label: "-- Select Machine --" },
                ...machines.map((m) => ({ value: String(m.MachineID), label: `${m.MachineName}${m.CurrentStatus && m.CurrentStatus !== "Idle" ? ` (${m.CurrentStatus})` : ""}` }))]} />
            <Select label="Operator" value={operatorId ? String(operatorId) : ""}
              onChange={(e) => setOperatorId(Number(e.target.value))} disabled={!machineId}
              options={[{ value: "", label: "-- Select Operator --" },
                ...operators.map((o) => ({ value: String(o.OperatorID), label: o.OperatorName }))]} />
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Process (fixed by sequence)</label>
              <div className="h-[38px] flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm">
                {ctxLoading ? <span className="text-gray-400">Loading…</span>
                  : ctx ? (
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{ctx.ProcessName}</span>
                      <Badge label={`Seq ${num(ctx.SequenceNo)}`} variant="blue" />
                    </span>
                  ) : <span className="text-gray-400">—</span>}
              </div>
            </div>
          </div>
        </StepCard>

        {/* ── Input Rolls (later process consumes previous process output) ─── */}
        {ctx && num(ctx.IsFirst) !== 1 && (
          <StepCard n={2} title="Input Rolls" icon={<GitBranch size={16} />}
            right={inputRolls.length ? <Badge label={`${scannedRolls.length}/${inputRolls.length} selected`} variant={scannedRolls.length ? "green" : "yellow"} /> : <Badge label="None" variant="gray" />}>
            {inputRolls.length === 0 ? (
              <p className="text-sm text-gray-500">No input rolls available from the previous process.</p>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Pichli process ke jo rolls consume ho rahe hain, scan/select karo</span>
                  <Button size="xs" variant="secondary" icon={<ScanLine size={12} />} onClick={() => setRollScanOpen(true)}>Scan Roll</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {inputRolls.map((rr) => {
                    const on = scannedRolls.includes(rr.RollID);
                    return (
                      <button key={rr.RollID} onClick={() => setScannedRolls((cur) => on ? cur.filter((x) => x !== rr.RollID) : [...cur, rr.RollID])}
                        className="text-xs rounded-md border px-2 py-1 font-mono"
                        style={{ background: on ? "var(--erp-primary-light)" : "#fff", borderColor: on ? "var(--erp-primary)" : "#e2e8f0" }}>
                        {on && <CheckCircle2 size={11} className="inline mr-1 text-green-600" />}{rr.BatchNo} · {num(rr.RemainingQuantity).toLocaleString("en-IN")} {rr.RollUnit}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </StepCard>
        )}

        {/* ── Step 2: Material Verification ─────────────────────────── */}
        {ctx && (
          <StepCard n={3} title="Material Verification"
            icon={<PackageCheck size={16} />}
            right={materialRequired
              ? <Badge label={allVerified ? "All Verified" : `${materials.filter((m) => m.verified).length}/${materials.length} verified`} variant={allVerified ? "green" : "yellow"} />
              : <Badge label="Not Required" variant="gray" />}>
            {!materialRequired ? (
              <p className="text-sm text-gray-500">This process does not require material consumption.</p>
            ) : materials.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle size={15} /> No issued materials found for this content.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-600" style={{ background: "var(--erp-primary-light)" }}>
                      <th className="px-3 py-2 font-semibold">Material</th>
                      <th className="px-3 py-2 font-semibold">Batch</th>
                      <th className="px-3 py-2 font-semibold text-right">Required</th>
                      <th className="px-3 py-2 font-semibold text-right">Issued</th>
                      <th className="px-3 py-2 font-semibold text-right">Consumed</th>
                      <th className="px-3 py-2 font-semibold text-center">Status</th>
                      <th className="px-3 py-2 font-semibold text-center">Verify</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => (
                      <tr key={m.TransactionDetailID} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-800">{m.ItemName || `Item #${m.ItemID}`}</td>
                        <td className="px-3 py-2 font-mono text-gray-600">{m.BatchNo || "—"}</td>
                        <td className="px-3 py-2 text-right">{num(m.RequiredQty).toLocaleString("en-IN")} {m.StockUnit}</td>
                        <td className="px-3 py-2 text-right">{num(m.IssuedQty).toLocaleString("en-IN")} {m.StockUnit}</td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" value={m.consumedQty ?? 0} disabled={!m.verified}
                            onChange={(e) => setMaterials((cur) => cur.map((x) => x.TransactionDetailID === m.TransactionDetailID ? { ...x, consumedQty: Number(e.target.value) } : x))}
                            className="w-24 text-right rounded border border-gray-300 px-2 py-1 disabled:bg-gray-50" />
                        </td>
                        <td className="px-3 py-2 text-center">{m.verified ? <Badge label="Verified" variant="green" /> : <Badge label="Pending" variant="yellow" />}</td>
                        <td className="px-3 py-2 text-center">
                          <Button size="xs" variant={m.verified ? "success" : "secondary"} disabled={m.verified}
                            icon={<ScanLine size={12} />} onClick={() => setMatScanTarget(m)}>
                            {m.verified ? "Done" : "Scan"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </StepCard>
        )}

        {ctx && onlineChain.length > 0 && (
          <div className="rounded-lg border px-3 py-2 flex items-start gap-2 text-xs"
            style={{ background: "var(--erp-primary-light)", borderColor: "var(--erp-primary)" }}>
            <GitBranch size={14} className="mt-0.5" style={{ color: "var(--erp-primary)" }} />
            <div className="text-gray-700">
              <b>Online processes auto-chained:</b> {onlineChain.map((o) => o.ProcessName).join(", ")}.{" "}
              Ye is process ke saath cascade hongi — Start pe placeholder banega, Update pe auto-produce hoga.
            </div>
          </div>
        )}

        {/* ── Step 3: Line Clearance ────────────────────────────────── */}
        {ctx && (
          <StepCard n={4} title="Line Clearance" icon={<ShieldCheck size={16} />}
            right={!machineId ? <Badge label="Select machine" variant="gray" />
              : lcRequired ? <Badge label={lcSaved ? `Completed${lcNo ? " · " + lcNo : ""}` : "Required"} variant={lcSaved ? "green" : "orange"} />
              : <Badge label="Not Required" variant="gray" />}>
            {!machineId ? (
              <p className="text-sm text-gray-500">Select a machine first — line clearance is machine-specific.</p>
            ) : !lcRequired ? (
              <p className="text-sm text-gray-500">No line clearance parameters configured for this process.</p>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-600" style={{ background: "var(--erp-primary-light)" }}>
                        <th className="px-3 py-2 font-semibold">Parameter</th>
                        <th className="px-3 py-2 font-semibold">Standard</th>
                        <th className="px-3 py-2 font-semibold w-40">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(lcData?.Params || []).map((p, i) => {
                        const opts = (p.DropDownVal || p.DefaultValue || "").split("|").map((s) => s.trim()).filter(Boolean);
                        const isCombo = /combo/i.test(p.FieldType) || (p.DefaultValue || "").includes("|");
                        const val = lcResults[p.ParameterName] ?? "";
                        const setVal = (v: string) => { setLcResults((r) => ({ ...r, [p.ParameterName]: v })); setLcSaved(false); };
                        return (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-800">{p.ParameterName}</td>
                            <td className="px-3 py-2 text-gray-500">{p.StandardValue || "—"}</td>
                            <td className="px-3 py-2">
                              {isCombo && opts.length ? (
                                <select value={val} onChange={(e) => setVal(e.target.value)}
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs">
                                  <option value="">— select —</option>
                                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input value={val} onChange={(e) => setVal(e.target.value)}
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs" placeholder="Result" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="xs" variant="primary" loading={lcSaving} disabled={!lcAllFilled}
                    onClick={saveLineClearance}>{lcSaved ? "Update line clearance" : "Save line clearance"}</Button>
                  {lcSaved && (
                    <Button size="xs" variant="secondary" icon={<FileText size={12} />}
                      onClick={() => downloadLcChecksheet({
                        JobCardNo: job.JobBookingNo, ContentNo: job.JobCardContentNo || String(job.ContentID), ProcessName: ctx.ProcessName || job.ProcessName,
                        MachineName: machines.find((m) => m.MachineID === machineId)?.MachineName || "",
                        OperatorName: operators.find((o) => o.OperatorID === operatorId)?.OperatorName || "",
                        LcNo: lcNo, Params: (lcData?.Params || []).map((p) => ({ ParameterName: p.ParameterName, StandardValue: p.StandardValue, Result: lcResults[p.ParameterName] ?? "" })),
                      })}>Print checksheet</Button>
                  )}
                  {!lcSaved && <span className="text-xs text-amber-600">Save required before Make Ready.</span>}
                </div>
              </div>
            )}
          </StepCard>
        )}

        {/* ── Step 4: Make Ready ────────────────────────────────────── */}
        {ctx && (
          <StepCard n={5} title="Make Ready" icon={<Wrench size={16} />}
            right={mkEnd ? <Badge label="Completed" variant="green" /> : mkStart ? <Badge label="In Progress" variant="yellow" /> : <Badge label="Pending" variant="gray" />}>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="secondary" disabled={!gate1 || !!mkStart} loading={setupBusy && !mkStart}
                onClick={doMkStart}>
                Make Ready Start
              </Button>
              <ArrowRight size={14} className="text-gray-300" />
              <Button size="sm" variant="secondary" disabled={!mkStart || !!mkEnd} loading={setupBusy && !!mkStart}
                onClick={doMkComplete}>
                Make Ready Complete
              </Button>
              {mkStart && !mkEnd && (
                <span className="text-sm font-mono font-semibold px-2 py-0.5 rounded" style={{ background: "var(--erp-primary-light)", color: "var(--erp-primary)" }}>
                  ⏱ {mkElapsed}
                </span>
              )}
              {mkEnd && <span className="text-xs text-green-700 font-medium">Setup time: {mkElapsed}</span>}
              {!gate1 && <span className="text-xs text-amber-600">{gateHint} to enable Make Ready.</span>}
            </div>
          </StepCard>
        )}

          {!canStart && (
            <p className="text-xs text-gray-400 text-right pb-4">
              Complete machine, operator, material verification &amp; line clearance, then Make Ready to enable Production Start.
            </p>
          )}
        </div>
      </div>

      {matScanTarget && (
        <QrScanner title="Verify Material" hint={`Scan batch for ${matScanTarget.ItemName}`}
          onScan={handleMaterialScan} onClose={() => setMatScanTarget(null)} />
      )}
      {rollScanOpen && (
        <QrScanner title="Scan Input Roll" hint="Pichli process ka roll QR scan karo"
          onScan={handleRollScan} onClose={() => setRollScanOpen(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  PRODUCTION UPDATE (Module 2) — In-Process QC gate + production update
// ═══════════════════════════════════════════════════════════════════════════
function ProductionUpdate({ row, onClose, onDone }: {
  row: ScheduledRow; onClose: () => void; onDone: () => void;
}) {
  const { showToast } = useToast();
  const [info, setInfo] = useState<RunningInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [saving, setSaving] = useState(false);

  const [actual, setActual] = useState<string>("");
  const [machineWaste, setMachineWaste] = useState<string>("");
  const [processWaste, setProcessWaste] = useState<string>("");
  const [status, setStatus] = useState("Part Complete");
  const [reason, setReason] = useState("");
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [pctx, setPctx] = useState<ProcCtx | null>(null);
  const [qtyPerBundle, setQtyPerBundle] = useState("");
  const [noOfBundles, setNoOfBundles] = useState("");
  const [useSemi, setUseSemi] = useState(true);
  const [ctqOk, setCtqOk] = useState(true);
  const [fpaOk, setFpaOk] = useState(true);
  const [onlineProcs, setOnlineProcs] = useState<OnlineProc[]>([]);
  const [tools, setTools] = useState<JobTool[]>([]);
  const [toolInput, setToolInput] = useState<Record<number, { meter: string; impr: string }>>({});
  const [prevRating, setPrevRating] = useState<PrevRating | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingRemark, setRatingRemark] = useState("");
  const [comments, setComments] = useState<ProdComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const noop = useCallback(() => {}, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, cx, ol, tl, pr, cm] = await Promise.all([
        apiGet<RunningInfo[]>(`${API}/running/${row.ContentID}/${row.ProcessID}/${row.MachineID}`),
        apiGet<ProcCtx[]>(`${API}/processcontext/${row.ContentID}/${row.ProcessID}`).catch(() => []),
        apiGet<OnlineProc[]>(`${API}/onlineprocesses/${row.ContentID}/${row.ProcessID}`).catch(() => []),
        apiGet<JobTool[]>(`${API}/jobcardtools/${row.ContentID}/${row.ProcessID}`).catch(() => []),
        apiGet<PrevRating[]>(`${API}/prevrating/${row.ContentID}/${row.ProcessID}`).catch(() => []),
        apiGet<ProdComment[]>(`${API}/comments/${row.ContentID}/${row.ProcessID}`).catch(() => []),
      ]);
      const inf = Array.isArray(d) && d.length ? d[0] : null;
      setInfo(inf);
      setPctx(Array.isArray(cx) && cx.length ? cx[0] : null);
      setOnlineProcs(Array.isArray(ol) ? ol : []);
      setTools(Array.isArray(tl) ? tl : []);
      const prev = Array.isArray(pr) && pr.length ? pr[0] : null;
      setPrevRating(prev);
      setRatingStars(prev ? num(prev.ExistingRating) : 0);
      setRatingRemark(prev ? prev.ExistingRemark : "");
      setComments(Array.isArray(cm) ? cm : []);
      // Only load material consumption if THIS process requires material.
      if (inf && num(inf.MaterialRequired) === 1) {
        const mats = await apiGet<MaterialRow[]>(`${API}/materialverification/${row.ContentID}`).catch(() => []);
        setMaterials((Array.isArray(mats) ? mats : []).map((m) => ({ ...m, consumedQty: num(m.IssuedQty) })));
      } else {
        setMaterials([]);
      }
    } catch (e) { showToast("error", "Load failed", (e as Error).message); }
    finally { setLoading(false); }
  }, [row.ContentID, row.ProcessID, row.MachineID, showToast]);
  useEffect(() => { load(); }, [load]);

  const totalConsumed = materials.reduce((s, m) => s + num(m.consumedQty), 0);

  const scheduleQty = pctx ? num(pctx.ScheduleQty) : (info ? num(info.ScheduleQty) : 0);
  const producedSoFar = info ? num(info.ProducedSoFar) : 0;
  const balanceBase = pctx ? num(pctx.BalanceQty) : scheduleQty; // first=schedule, else prev production
  const balance = balanceBase - producedSoFar;
  const prevComplete = pctx ? num(pctx.PrevComplete) === 1 : true;
  const isLast = pctx ? num(pctx.IsLast) === 1 : false;
  const semiActive = isLast && useSemi;
  const semiTotal = num(qtyPerBundle) * num(noOfBundles);
  const actualQty = semiActive ? semiTotal : num(actual);
  const qcDone = info?.QCStatus === "Done";
  const totalProduced = actualQty + num(machineWaste) + num(processWaste);
  const overProduction = actualQty > balance;
  const holdOrOver = status === "Hold" || overProduction;
  // Complete requires CTQ + FPA captured (cards report readiness). Part Complete/Hold don't.
  const qcCompleteOk = status !== "Complete" || (ctqOk && fpaOk);
  const canSave = qcDone && actualQty > 0 && (!holdOrOver || reason.trim().length > 0)
    && !(status === "Complete" && !prevComplete) && qcCompleteOk;
  const readyOut = pctx ? computeReady(pctx.UnitConversion, actualQty, num(pctx.CylMM), num(pctx.FeedValue), num(pctx.TotalUps)) : actualQty;
  const converts = actualQty > 0 && readyOut !== actualQty;

  const approveQc = async () => {
    if (!info) return;
    setApproving(true);
    try {
      const res = await apiPost<string>(`${API}/qcapprove`, { ProductionID: info.ProductionID });
      if (String(res ?? "").startsWith("Success")) {
        showToast("success", "QC Approved", "Ab production update kar sakte ho.");
        load();
      } else showToast("error", "QC failed", String(res).replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "QC failed", (e as Error).message); }
    finally { setApproving(false); }
  };

  const save = async () => {
    if (!info) return;
    setSaving(true);
    try {
      const toolImpr = tools.map((t) => {
        const inp = toolInput[t.ToolID];
        const meter = inp?.meter != null && inp.meter !== "" ? num(inp.meter) : actualQty;
        const impr = num(inp?.impr);
        return { ToolID: t.ToolID, RunningMeter: meter, NumberOfImpression: impr, ToolBatchNo: t.ToolBatchNo, IssueTransactionID: t.IssueTransactionID };
      }).filter((x) => x.RunningMeter > 0 || x.NumberOfImpression > 0);
      const res = await apiPost<string>(`${API}/update`, {
        ProductionID: info.ProductionID,
        ActualQty: actualQty, MachineWastage: num(machineWaste), ProcessWastage: num(processWaste),
        ConsumedQty: totalConsumed, Status: status, Reason: reason,
        SemiPacking: semiActive, QtyPerBundle: num(qtyPerBundle), NoOfBundles: num(noOfBundles),
        ToolImpressions: toolImpr,
        Rating: (status === "Complete" && prevRating && num(prevRating.ExistingRating) === 0) ? ratingStars : 0,
        RatedProcessID: prevRating?.PrevProcessID ?? 0,
        RatingRemark: ratingRemark,
      });
      const txt = String(res ?? "");
      if (txt.startsWith("Success")) {
        showToast("success", "Production Updated", `${row.JobBookingNo} — ${status}`);
        onDone();
      } else showToast("error", "Update failed", txt.replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "Update failed", (e as Error).message); }
    finally { setSaving(false); }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    setCommentBusy(true);
    try {
      const res = await apiPost<{ Success?: boolean }>(`${API}/comment`, {
        ProductionID: info?.ProductionID ?? 0, JobBookingID: row.JobBookingID, ContentID: row.ContentID,
        ProcessID: row.ProcessID, Title: "", CommentType: "Note", Description: newComment.trim(),
      });
      if (res && typeof res === "object" && res.Success) {
        setNewComment("");
        const cm = await apiGet<ProdComment[]>(`${API}/comments/${row.ContentID}/${row.ProcessID}`).catch(() => []);
        setComments(Array.isArray(cm) ? cm : []);
      } else showToast("error", "Comment failed", String(res).replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "Comment failed", (e as Error).message); }
    finally { setCommentBusy(false); }
  };

  const HeaderCell = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-white/60">{label}</p>
      <p className="text-sm font-semibold text-white truncate">{value}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2"
        style={{ background: "var(--erp-primary)", minHeight: 44 }}>
        <button onClick={onClose} className="flex items-center gap-1 text-white/90 hover:text-white text-xs font-medium">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="w-px h-4 bg-white/25" />
        <h1 className="text-sm font-semibold text-white">Update Production</h1>
        <span className="text-xs text-white/80 bg-white/15 rounded-md px-2 py-1 hidden md:inline">
          {row.JobBookingNo} · {row.ProcessName}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" icon={<CheckCircle2 size={14} />} loading={saving}
            disabled={!canSave} onClick={save}
            style={{ background: "#fff", color: "var(--erp-primary)", opacity: canSave ? 1 : 0.5 }}>
            Save Update
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 py-3" style={{ background: "var(--background)" }}>
        <div className="w-full space-y-3">
          {loading ? (
            <div className="text-center text-gray-400 py-16">Loading…</div>
          ) : !info ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-700">
              No running production found for this job process.
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="rounded-lg px-4 py-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
                style={{ background: "var(--erp-sidebar-bg)" }}>
                <HeaderCell label="Job Card" value={row.JobBookingNo} />
                <HeaderCell label="Process" value={info.ProcessName || row.ProcessName} />
                <HeaderCell label="Schedule Qty" value={scheduleQty.toLocaleString("en-IN")} />
                <HeaderCell label="Produced" value={producedSoFar.toLocaleString("en-IN")} />
                <HeaderCell label="Balance Qty" value={balance.toLocaleString("en-IN")} />
                <HeaderCell label="Status" value={info.Status} />
              </div>

              {/* Step 1: In-Process QC */}
              <StepCard n={1} title="In-Process QC" icon={<ShieldCheck size={16} />}
                right={<Badge label={qcDone ? "QC Done" : "Pending"} variant={qcDone ? "green" : "orange"} />}>
                {qcDone ? (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 size={15} /> QC approved — production update allowed.
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-gray-500">
                      QC parameters are bypassed for now. Approve QC to enable production update.
                    </p>
                    <Button size="sm" variant="success" loading={approving} onClick={approveQc}>
                      Approve QC
                    </Button>
                  </div>
                )}
              </StepCard>

              {/* Step 2: Production Update */}
              <StepCard n={2} title="Production Update" icon={<Factory size={16} />}
                right={!qcDone ? <Badge label="Locked until QC" variant="gray" /> : undefined}>
                <div className={qcDone ? "" : "opacity-50 pointer-events-none"}>
                  {isLast && (
                    <label className="flex items-center gap-2 text-xs text-gray-700 mb-3 cursor-pointer">
                      <input type="checkbox" checked={useSemi} onChange={(e) => setUseSemi(e.target.checked)} />
                      <span>Last process — enter as <b>Semi-packing</b> (Qty/bundle × No. of bundles). Goes to QC &amp; packing pending.</span>
                    </label>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {semiActive ? (
                      <>
                        <Input label="Qty / Bundle" type="number" value={qtyPerBundle} onChange={(e) => setQtyPerBundle(e.target.value)} />
                        <Input label="No. of Bundles" type="number" value={noOfBundles} onChange={(e) => setNoOfBundles(e.target.value)} />
                      </>
                    ) : (
                      <Input label="Actual Qty" type="number" value={actual} onChange={(e) => setActual(e.target.value)} />
                    )}
                    <Input label="Machine Wastage" type="number" value={machineWaste}
                      onChange={(e) => setMachineWaste(e.target.value)} />
                    <Input label="Process Wastage" type="number" value={processWaste}
                      onChange={(e) => setProcessWaste(e.target.value)} />
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">{semiActive ? "Packed Qty (total)" : "Total Produced"}</label>
                      <div className="h-10 flex items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm font-semibold">
                        {(semiActive ? semiTotal : totalProduced).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                  {converts && (
                    <p className="text-[11px] mt-1" style={{ color: "var(--erp-primary)" }}>
                      Unit conversion (<b>{pctx?.UnitConversion}</b>): {actualQty.toLocaleString("en-IN")} {pctx?.StartUnit} → <b>{readyOut.toLocaleString("en-IN")} {pctx?.EndUnit}</b> — ye next process ka input banega.
                    </p>
                  )}
                  {semiActive && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      {num(qtyPerBundle).toLocaleString("en-IN")} × {num(noOfBundles).toLocaleString("en-IN")} bundles = <b>{semiTotal.toLocaleString("en-IN")}</b> qty · will create a semi-packing entry for QC/packing.
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}
                        options={[
                          ...(prevComplete ? [{ value: "Complete", label: "Complete" }] : []),
                          { value: "Part Complete", label: "Part Complete" },
                          { value: "Hold", label: "Hold" },
                        ]} />
                      {!prevComplete && <p className="text-[11px] text-amber-600 mt-1">Previous process abhi complete nahi — sirf Part Complete.</p>}
                    </div>
                    <div className="md:col-span-2">
                      <Textarea
                        label={`Reason ${(status === "Hold" || overProduction) ? "(mandatory)" : "(optional)"}`}
                        value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                        placeholder={status === "Hold" ? "Why is the job on hold?" : overProduction ? "Reason for over-production" : "Remarks"} />
                    </div>
                  </div>

                  {/* Rate previous process (saved on Complete) */}
                  {prevRating && prevRating.PrevProcessID > 0 && (
                    <div className="mt-4 rounded-lg border border-gray-200 p-3">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Rate previous process — {prevRating.PrevProcessName}</p>
                      {num(prevRating.ExistingRating) > 0 ? (
                        <div className="text-sm text-amber-600">
                          {"★".repeat(num(prevRating.ExistingRating))}<span className="text-gray-300">{"★".repeat(5 - num(prevRating.ExistingRating))}</span>
                          {prevRating.ExistingRemark ? <span className="text-gray-500 text-xs"> · {prevRating.ExistingRemark}</span> : null}
                          <span className="text-[10px] text-gray-400 ml-1">(already rated)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button key={s} type="button" onClick={() => setRatingStars(s)} className="text-lg leading-none"
                                style={{ color: s <= ratingStars ? "#f59e0b" : "#d1d5db" }}>★</button>
                            ))}
                          </div>
                          <input value={ratingRemark} onChange={(e) => setRatingRemark(e.target.value)} placeholder="Remark (optional)"
                            className="flex-1 min-w-[150px] rounded border border-gray-300 px-2 py-1 text-xs" />
                          <span className="text-[10px] text-gray-400">saves on Complete</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Material consumption */}
                  {materials.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                        <PackageCheck size={13} /> Material Consumption
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-600" style={{ background: "var(--erp-primary-light)" }}>
                              <th className="px-3 py-2 font-semibold">Material</th>
                              <th className="px-3 py-2 font-semibold">Batch</th>
                              <th className="px-3 py-2 font-semibold text-right">Required</th>
                              <th className="px-3 py-2 font-semibold text-right">Issued</th>
                              <th className="px-3 py-2 font-semibold text-right">Consumed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {materials.map((m) => (
                              <tr key={m.TransactionDetailID} className="border-t border-gray-100">
                                <td className="px-3 py-2 text-gray-800">{m.ItemName || `Item #${m.ItemID}`}</td>
                                <td className="px-3 py-2 font-mono text-gray-600">{m.BatchNo || "—"}</td>
                                <td className="px-3 py-2 text-right">{num(m.RequiredQty).toLocaleString("en-IN")} {m.StockUnit}</td>
                                <td className="px-3 py-2 text-right">{num(m.IssuedQty).toLocaleString("en-IN")} {m.StockUnit}</td>
                                <td className="px-3 py-2 text-right">
                                  <input type="number" value={m.consumedQty ?? 0}
                                    onChange={(e) => setMaterials((cur) => cur.map((x) => x.TransactionDetailID === m.TransactionDetailID ? { ...x, consumedQty: Number(e.target.value) } : x))}
                                    className="w-24 text-right rounded border border-gray-300 px-2 py-1" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">Total consumed: <b className="text-gray-600">{totalConsumed.toLocaleString("en-IN")}</b></p>
                    </div>
                  )}

                  {overProduction && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 mt-2">
                      <AlertTriangle size={14} /> Actual Qty ({num(actual).toLocaleString("en-IN")}) exceeds Balance ({balance.toLocaleString("en-IN")}) — reason required.
                    </div>
                  )}
                </div>
              </StepCard>

              {qcDone && (() => {
                const qcHeader = { JobCardNo: row.JobBookingNo, ContentNo: row.JobCardContentNo || String(row.ContentID),
                  ProcessName: info.ProcessName || row.ProcessName, MachineName: row.MachineName, OperatorName: "" };
                const qcCommon = { contentId: row.ContentID, processId: row.ProcessID, machineId: row.MachineID,
                  productionId: info.ProductionID, jobBookingId: row.JobBookingID, header: qcHeader };
                return (
                  <>
                    <QcParamsCard type="CTQ" title="CTQ (Critical To Quality)" voucherLabel="CTQ No" stepNo={3} {...qcCommon} onDoneChange={setCtqOk} />
                    <QcParamsCard type="FPA" title="First Part Approval" voucherLabel="FPA No" stepNo={4} {...qcCommon} onDoneChange={setFpaOk} />
                    <QcParamsCard type="INSPECTION" title="In-Process Inspection" voucherLabel="Inspection No" stepNo={5} {...qcCommon} onDoneChange={noop} />
                  </>
                );
              })()}

              {qcDone && !qcCompleteOk && status === "Complete" && (
                <div className="flex items-center gap-2 text-xs text-amber-600 px-1">
                  <AlertTriangle size={14} /> Complete karne se pehle CTQ &amp; First Part Approval save karo.
                </div>
              )}

              {qcDone && tools.length > 0 && (
                <StepCard n={6} title="Tool Impressions / Plate Life" icon={<Wrench size={16} />}
                  right={<Badge label={`${tools.length} tool${tools.length === 1 ? "" : "s"}`} variant="blue" />}>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Har tool ka running meter / impressions is update pe log hoga. Plate life = rated − used.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-600" style={{ background: "var(--erp-primary-light)" }}>
                          <th className="px-3 py-2 font-semibold">Tool</th>
                          <th className="px-3 py-2 font-semibold text-right">Rated (m)</th>
                          <th className="px-3 py-2 font-semibold text-right">Used (m)</th>
                          <th className="px-3 py-2 font-semibold text-right">Remaining</th>
                          <th className="px-3 py-2 font-semibold w-28">Meter (this)</th>
                          <th className="px-3 py-2 font-semibold w-28">Impressions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tools.map((t) => {
                          const inp = toolInput[t.ToolID] || { meter: "", impr: "" };
                          const meterShown = inp.meter !== "" ? num(inp.meter) : actualQty;
                          const remaining = num(t.RatedLifeMeters) - num(t.UsedMeters) - meterShown;
                          const low = num(t.RatedLifeMeters) > 0 && remaining < num(t.RatedLifeMeters) * 0.1;
                          const setInp = (k: "meter" | "impr", v: string) => setToolInput((s) => ({ ...s, [t.ToolID]: { ...(s[t.ToolID] || { meter: "", impr: "" }), [k]: v } }));
                          return (
                            <tr key={t.ToolID} className="border-t border-gray-100">
                              <td className="px-3 py-2">
                                <div className="font-medium text-gray-800">{t.ToolCode || `Tool ${t.ToolID}`}</div>
                                <div className="text-[10px] text-gray-400">{t.ToolName}{t.ToolBatchNo ? ` · ${t.ToolBatchNo}` : ""}</div>
                              </td>
                              <td className="px-3 py-2 text-right text-gray-500">{num(t.RatedLifeMeters).toLocaleString("en-IN")}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{num(t.UsedMeters).toLocaleString("en-IN")}</td>
                              <td className={`px-3 py-2 text-right font-semibold ${low ? "text-red-600" : "text-green-700"}`}>
                                {remaining.toLocaleString("en-IN")}{low ? " ⚠" : ""}
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" value={inp.meter} onChange={(e) => setInp("meter", e.target.value)}
                                  placeholder={actualQty ? String(actualQty) : "0"}
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-right" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" value={inp.impr} onChange={(e) => setInp("impr", e.target.value)}
                                  placeholder="0" className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-right" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </StepCard>
              )}

              {qcDone && onlineProcs.length > 0 && (
                <StepCard n={6} title="Online Processes (auto-chained)" icon={<GitBranch size={16} />}
                  right={<Badge label={`${onlineProcs.length} chained`} variant="blue" />}>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Ye online process(es) is main process ke saath chalti hain — Save karte hi inka output auto-produce hoga (apni unit conversion se). Inhe alag se run nahi karna padta.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-600" style={{ background: "var(--erp-primary-light)" }}>
                          <th className="px-3 py-2 font-semibold">Online Process</th>
                          <th className="px-3 py-2 font-semibold">Conversion</th>
                          <th className="px-3 py-2 font-semibold text-right">Output (this update)</th>
                          <th className="px-3 py-2 font-semibold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {onlineProcs.map((op) => {
                          const out = pctx ? computeReady(op.UnitConversion, readyOut, num(pctx.CylMM), num(pctx.FeedValue), num(pctx.TotalUps)) : readyOut;
                          return (
                            <tr key={op.ProcessID} className="border-t border-gray-100">
                              <td className="px-3 py-2 text-gray-800">{op.ProcessName}</td>
                              <td className="px-3 py-2 text-gray-500">{op.UnitConversion?.trim() || "— (passthrough)"}</td>
                              <td className="px-3 py-2 text-right font-medium">{num(out).toLocaleString("en-IN")} {op.EndUnit || pctx?.EndUnit}</td>
                              <td className="px-3 py-2 text-center">{statusBadge(op.Status)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </StepCard>
              )}

              {qcDone && <OutputRollsSection productionId={info.ProductionID} contentId={row.ContentID} processId={row.ProcessID} processName={info.ProcessName || row.ProcessName} />}

              <UpdateHistory productionId={info.ProductionID} refreshKey={loading} />

              <MachineStatusCard machineId={row.MachineID} processId={row.ProcessID} contentId={row.ContentID}
                productionId={info.ProductionID} operatorId={info.EmployeeID || 0} />

              <StepCard n={10} title="Comments" icon={<FileText size={16} />}
                right={<Badge label={`${comments.length}`} variant="gray" />}>
                <div className="flex items-end gap-2 mb-3">
                  <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment / note…" className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") addComment(); }} />
                  <Button size="sm" variant="secondary" loading={commentBusy} disabled={!newComment.trim()} onClick={addComment}>Add</Button>
                </div>
                {comments.length > 0 ? (
                  <div className="space-y-2">
                    {comments.map((c) => (
                      <div key={c.CommentID} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <p className="text-sm text-gray-800">{c.Description}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{c.CreatedByName || "—"} · {c.CreatedDate}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-gray-400">No comments yet.</p>}
              </StepCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Machine status: downtime / breakdown logging + timeline ──────────────
interface MStatus { MachineStatusID: number; MachineStatus: string; StatusActionType: string; StatusCssClass: string; }
interface MHist { Status: string; Details: string; OtherRemark: string; StartTime: string; EndTime: string; Minutes: number | null; }
function MachineStatusCard({ machineId, processId, contentId, productionId, operatorId }: {
  machineId: number; processId: number; contentId: number; productionId: number; operatorId: number;
}) {
  const { showToast } = useToast();
  const [reasons, setReasons] = useState<MStatus[]>([]);
  const [history, setHistory] = useState<MHist[]>([]);
  const [reason, setReason] = useState("");
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [rl, hl] = await Promise.all([
      apiGet<MStatus[]>(`${API}/machinestatuslist`).catch(() => []),
      apiGet<MHist[]>(`${API}/machinestatushistory/${machineId}`).catch(() => []),
    ]);
    setReasons(Array.isArray(rl) ? rl : []);
    setHistory(Array.isArray(hl) ? hl : []);
  }, [machineId]);
  useEffect(() => { load(); }, [load]);

  const post = async (status: string, details: string, rmk: string) => {
    setBusy(true);
    try {
      const res = await apiPost<{ Success?: boolean }>(`${API}/machinestatus`, {
        MachineID: machineId, ProcessID: processId, ContentID: contentId, ProductionID: productionId,
        OperatorID: operatorId, Status: status, Details: details, OtherRemark: rmk,
      });
      if (res && typeof res === "object" && res.Success) {
        showToast("success", "Machine status logged", status);
        setReason(""); setRemark(""); await load();
      } else showToast("error", "Failed", String(res).replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "Failed", (e as Error).message); }
    finally { setBusy(false); }
  };

  const openHist = history.find((h) => !h.EndTime && h.Status !== "Active" && h.Status !== "Idle");

  return (
    <StepCard n={9} title="Machine Status / Downtime" icon={<AlertTriangle size={16} />}
      right={openHist ? <Badge label={openHist.Status} variant="orange" /> : <Badge label="Running" variant="green" />}>
      <div className="flex items-end gap-2 flex-wrap mb-3">
        <div className="min-w-[220px]">
          <label className="text-[11px] text-gray-500 block mb-0.5">Downtime / Breakdown reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">— select reason —</option>
            {["Breakdown", "Downtime"].map((grp) => {
              const items = reasons.filter((r) => (r.StatusActionType || "").toLowerCase() === grp.toLowerCase());
              if (!items.length) return null;
              return (
                <optgroup key={grp} label={grp}>
                  {items.map((r) => <option key={r.MachineStatusID} value={r.MachineStatus}>{r.MachineStatus}</option>)}
                </optgroup>
              );
            })}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[11px] text-gray-500 block mb-0.5">Remark (optional)</label>
          <input value={remark} onChange={(e) => setRemark(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder="Details" />
        </div>
        <Button size="sm" variant="secondary" loading={busy} disabled={!reason}
          onClick={() => post(reason, remark, remark)}>Log Status</Button>
        {openHist && (
          <Button size="sm" variant="success" loading={busy}
            onClick={() => post("Resume", "Resumed", "")}>Resume (machine free)</Button>
        )}
      </div>
      {history.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-600" style={{ background: "var(--erp-primary-light)" }}>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Detail</th>
                <th className="px-3 py-2 font-semibold">From</th>
                <th className="px-3 py-2 font-semibold">To</th>
                <th className="px-3 py-2 font-semibold text-right">Mins</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 8).map((h, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-800">{h.Status}</td>
                  <td className="px-3 py-2 text-gray-500">{h.Details || h.OtherRemark || "—"}</td>
                  <td className="px-3 py-2 text-gray-500">{h.StartTime || "—"}</td>
                  <td className="px-3 py-2 text-gray-500">{h.EndTime || <span className="text-amber-600">open</span>}</td>
                  <td className="px-3 py-2 text-right">{h.Minutes == null ? "—" : h.Minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StepCard>
  );
}

// ── QC param capture (CTQ / FPA / Inspection) — reusable ─────────────────
//  Loads generic qcparams for the given type; renders a per-param result form
//  (dropdown/text by FieldType) + Save + voucher no + Print checksheet. Reports
//  its satisfied-state up (onDoneChange) so the parent can gate Complete.
function QcParamsCard({ type, title, voucherLabel, stepNo, contentId, processId, machineId, productionId, jobBookingId, header, onDoneChange }: {
  type: "CTQ" | "FPA" | "INSPECTION"; title: string; voucherLabel: string; stepNo: number;
  contentId: number; processId: number; machineId: number; productionId: number; jobBookingId: number;
  header: { JobCardNo: string; ContentNo: string; ProcessName: string; MachineName: string; OperatorName: string };
  onDoneChange: (ok: boolean) => void;
}) {
  const { showToast } = useToast();
  const [data, setData] = useState<QcData | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [saving, setSaving] = useState(false);

  const required = !!data?.Required;
  const allFilled = !data || (data.Params || []).every((p) => (results[p.ParameterName] ?? "").trim() !== "");

  useEffect(() => {
    (async () => {
      const d = await apiGet<QcData>(`${API}/qcparams/${type}/${contentId}/${processId}/${machineId}/${productionId}`).catch(() => null);
      if (d && typeof d === "object") {
        setData(d);
        const init: Record<string, string> = {};
        (d.Params || []).forEach((p) => { init[p.ParameterName] = p.Result ?? ""; });
        setResults(init); setSaved(!!d.Done); setVoucherNo(d.VoucherNo || "");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, contentId, processId, machineId, productionId]);

  // Report satisfied-state: not required → always ok; required → ok once saved.
  useEffect(() => { onDoneChange(!required || saved); }, [required, saved, onDoneChange]);

  const save = async () => {
    if (!data) return;
    if (!allFilled) { showToast("warning", "Fill all", "Har parameter ka result bharo."); return; }
    setSaving(true);
    try {
      const res = await apiPost<{ Success?: boolean; VoucherNo?: string }>(`${API}/saveqcparams`, {
        Type: type, ContentID: contentId, ProcessID: processId, MachineID: machineId, ProductionID: productionId,
        JobBookingID: jobBookingId, VoucherNo: voucherNo,
        Parameters: (data.Params || []).map((p) => ({ ParameterName: p.ParameterName, StandardValue: p.StandardValue, Result: results[p.ParameterName] ?? "" })),
      });
      if (res && typeof res === "object" && res.Success) {
        setSaved(true); setVoucherNo(res.VoucherNo || voucherNo);
        showToast("success", `${title} saved`, res.VoucherNo || "");
      } else showToast("error", "Save failed", String(res).replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "Save failed", (e as Error).message); }
    finally { setSaving(false); }
  };

  if (data && !required) return null;   // no params configured → hide

  return (
    <StepCard n={stepNo} title={title} icon={<ShieldCheck size={16} />}
      right={<Badge label={saved ? `Done${voucherNo ? " · " + voucherNo : ""}` : "Required"} variant={saved ? "green" : "orange"} />}>
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-600" style={{ background: "var(--erp-primary-light)" }}>
                <th className="px-3 py-2 font-semibold">Parameter</th>
                <th className="px-3 py-2 font-semibold">Standard</th>
                <th className="px-3 py-2 font-semibold w-40">Result</th>
              </tr>
            </thead>
            <tbody>
              {(data?.Params || []).map((p, i) => {
                const opts = (p.DropDownVal || p.DefaultValue || "").split("|").map((s) => s.trim()).filter(Boolean);
                const isCombo = /combo/i.test(p.FieldType) || (p.DefaultValue || "").includes("|");
                const val = results[p.ParameterName] ?? "";
                const setVal = (v: string) => { setResults((r) => ({ ...r, [p.ParameterName]: v })); setSaved(false); };
                return (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{p.ParameterName}</td>
                    <td className="px-3 py-2 text-gray-500">{p.StandardValue || "—"}</td>
                    <td className="px-3 py-2">
                      {isCombo && opts.length ? (
                        <select value={val} onChange={(e) => setVal(e.target.value)}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs">
                          <option value="">— select —</option>
                          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input value={val} onChange={(e) => setVal(e.target.value)}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs" placeholder="Result" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="xs" variant="primary" loading={saving} disabled={!allFilled}
            onClick={save}>{saved ? `Update ${title}` : `Save ${title}`}</Button>
          {saved && (
            <Button size="xs" variant="secondary" icon={<FileText size={12} />}
              onClick={() => downloadLcChecksheet({
                Title: `${title} Checksheet`, VoucherLabel: voucherLabel, LcNo: voucherNo,
                JobCardNo: header.JobCardNo, ContentNo: header.ContentNo, ProcessName: header.ProcessName,
                MachineName: header.MachineName, OperatorName: header.OperatorName,
                Params: (data?.Params || []).map((p) => ({ ParameterName: p.ParameterName, StandardValue: p.StandardValue, Result: results[p.ParameterName] ?? "" })),
              })}>Print checksheet</Button>
          )}
        </div>
      </div>
    </StepCard>
  );
}

// ── Output Rolls (QR genealogy capture) ──────────────────────────────────
interface OutRoll { RollID: number; BatchNo: string; Quantity: number; RemainingQuantity: number; RollUnit: string; WidthMM: number; SpoolID: string; Status: string; QRCode: string; }
interface InRoll { RollID: number; BatchNo: string; Quantity: number; RemainingQuantity: number; RollUnit: string; Status: string; ProcessName: string; }

interface SlitPlan { IsSlitting: boolean; AcrossUps: number; ReadyQty: number; Unit: string; Rolls: Array<{ Lane: string; Qty: number }>; }
// Lane letter for slit position i (1-based): A..Z, AA… (base-26, backend parity).
const laneLetter = (i: number) => { let s = "", n = i; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };

function OutputRollsSection({ productionId, contentId, processId, processName }: { productionId: number; contentId: number; processId: number; processName?: string; }) {
  const { showToast } = useToast();
  const isSlittingName = /slit/i.test(processName || "");
  const laneAt = (i: number) => laneLetter(i + 1);
  const [rolls, setRolls] = useState<OutRoll[]>([]);
  const [inputs, setInputs] = useState<InRoll[]>([]);
  const [parents, setParents] = useState<number[]>([]);
  const [plan, setPlan] = useState<SlitPlan | null>(null);
  const [units, setUnits] = useState<Array<{ qty: string; unit: string; width: string; spool: string }>>([{ qty: "", unit: "KG", width: "", spool: isSlittingName ? "A" : "" }]);
  const [busy, setBusy] = useState(false);
  const isSlitting = isSlittingName || !!plan?.IsSlitting;

  // Build the units grid from the slitting plan (N lanes, perRoll/remainder qty).
  const applyPlan = useCallback((p: SlitPlan) => {
    if (!p?.Rolls?.length) return;
    setUnits(p.Rolls.map((r) => ({ qty: String(r.Qty), unit: p.Unit || "Pcs", width: "", spool: r.Lane })));
  }, []);

  const load = useCallback(async () => {
    const [rr, ir, pl] = await Promise.all([
      apiGet<OutRoll[]>(`${API}/outputrolls/${productionId}`).catch(() => []),
      apiGet<InRoll[]>(`${API}/inputrolls/${contentId}/${processId}`).catch(() => []),
      apiGet<SlitPlan>(`${API}/slitplan/${productionId}`).catch(() => null),
    ]);
    const created = Array.isArray(rr) ? rr : [];
    setRolls(created);
    setInputs(Array.isArray(ir) ? ir : []);
    if (pl && typeof pl === "object") {
      setPlan(pl);
      // Auto-fill the grid with the slit lanes when nothing has been generated yet.
      if (pl.IsSlitting && pl.Rolls?.length > 1 && created.length === 0) applyPlan(pl);
    }
  }, [productionId, contentId, processId, applyPlan]);
  useEffect(() => { load(); }, [load]);

  const setU = (i: number, k: string, v: string) => setUnits((a) => a.map((x, j) => j === i ? { ...x, [k]: v } : x));

  // ── P8 roll actions: send-to-packing (with slitting warn) / return-to-store / semi-finish / undo ──
  const doPack = async (roll: OutRoll) => {
    const warn = await apiPost<Array<{ BatchNo: string; ProcessName: string }>>(`${API}/slittingpending`, { RollIDs: [roll.RollID] }).catch(() => []);
    if (Array.isArray(warn) && warn.length) {
      if (!window.confirm(`Roll ${roll.BatchNo} abhi slitting pending hai (${warn[0].ProcessName}). Phir bhi packing bhejein?`)) return;
    }
    const res = await apiPost<{ Success?: boolean }>(`${API}/sendtopacking`, { RollIDs: [roll.RollID] });
    if (res && typeof res === "object" && res.Success) { showToast("success", "Sent to packing", roll.BatchNo); await load(); }
    else showToast("error", "Failed", String(res).replace(/^Error:\s*/, ""));
  };
  const doReturn = async (roll: OutRoll) => {
    if (!window.confirm(`Roll ${roll.BatchNo} ko store return karein? (remaining qty stock-in ke liye Pending jayega)`)) return;
    const res = await apiPost<{ Success?: boolean }>(`${API}/rollreturn`, { RollID: roll.RollID, Remark: "" });
    if (res && typeof res === "object" && res.Success) { showToast("success", "Returned to store", roll.BatchNo); await load(); }
    else showToast("error", "Failed", String(res).replace(/^Error:\s*/, ""));
  };
  const doSemi = async (roll: OutRoll) => {
    const res = await apiPost<{ Success?: boolean }>(`${API}/semifinish`, { RollIDs: [roll.RollID] });
    if (res && typeof res === "object" && res.Success) { showToast("success", "Semi-finished", roll.BatchNo); await load(); }
    else showToast("error", "Failed", String(res).replace(/^Error:\s*/, ""));
  };
  const doUndoPack = async (roll: OutRoll) => {
    const res = await apiPost<{ Success?: boolean }>(`${API}/undopacking`, { RollIDs: [roll.RollID] });
    if (res && typeof res === "object" && res.Success) { showToast("success", "Removed from packing", roll.BatchNo); await load(); }
    else showToast("error", "Failed", String(res).replace(/^Error:\s*/, ""));
  };

  const generate = async () => {
    const payloadRolls = units.filter((u) => num(u.qty) > 0)
      .map((u) => ({ Qty: num(u.qty), Unit: u.unit, WidthMM: num(u.width), SpoolLane: u.spool }));
    if (!payloadRolls.length) { showToast("warning", "Add output", "At least one output roll qty."); return; }
    setBusy(true);
    try {
      const res = await apiPost<unknown>(`${API}/outputrolls`, { ProductionID: productionId, Status: "Complete", ParentRollIDs: parents, Rolls: payloadRolls });
      if (Array.isArray(res)) {
        showToast("success", "Rolls created", `${res.length} roll QR generated`);
        setUnits([{ qty: "", unit: "KG", width: "", spool: isSlitting ? "A" : "" }]);
        setParents([]);
        await load();
      } else showToast("error", "Failed", String(res).replace(/^Error:\s*/, ""));
    } catch (e) { showToast("error", "Failed", (e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <StepCard n={7} title="Output Rolls (QR)" icon={<PackageCheck size={16} />}
      right={<Badge label={`${rolls.length} roll${rolls.length === 1 ? "" : "s"}`} variant="blue" />}>
      {inputs.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">Input rolls consumed (parents)</p>
          <div className="flex flex-wrap gap-2">
            {inputs.map((r) => {
              const on = parents.includes(r.RollID);
              return (
                <button key={r.RollID} onClick={() => setParents((p) => on ? p.filter((x) => x !== r.RollID) : [...p, r.RollID])}
                  className="text-xs rounded-md border px-2 py-1"
                  style={{ background: on ? "var(--erp-primary-light)" : "#fff", borderColor: on ? "var(--erp-primary)" : "#e2e8f0" }}>
                  {r.BatchNo} · {num(r.RemainingQuantity).toLocaleString("en-IN")} {r.RollUnit}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isSlitting && plan && plan.Rolls?.length > 1 && (
        <div className="mb-3 rounded-lg border px-3 py-2 flex items-center justify-between gap-2 flex-wrap"
          style={{ background: "var(--erp-primary-light)", borderColor: "var(--erp-primary)" }}>
          <div className="text-xs text-gray-700">
            <span className="font-semibold">Slitting 1-to-{plan.AcrossUps}</span> · ready{" "}
            <span className="font-mono">{num(plan.ReadyQty).toLocaleString("en-IN")} {plan.Unit}</span>{" "}
            → {plan.Rolls.length} lanes (
            {plan.Rolls.map((r) => `${r.Lane}:${num(r.Qty).toLocaleString("en-IN")}`).join(", ")})
          </div>
          <Button size="xs" variant="secondary" onClick={() => applyPlan(plan)}>Apply auto-split</Button>
        </div>
      )}

      <div className="space-y-2">
        {units.map((u, i) => (
          <div key={i} className="flex items-end gap-2 flex-wrap">
            <div className="w-28"><label className="text-[11px] text-gray-500 block">Qty</label>
              <input type="number" value={u.qty} onChange={(e) => setU(i, "qty", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" /></div>
            <div className="w-20"><label className="text-[11px] text-gray-500 block">Unit</label>
              <input value={u.unit} onChange={(e) => setU(i, "unit", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" /></div>
            <div className="w-24"><label className="text-[11px] text-gray-500 block">Width (mm)</label>
              <input type="number" value={u.width} onChange={(e) => setU(i, "width", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" /></div>
            <div className="w-20"><label className="text-[11px] text-gray-500 block">Spool</label>
              <input value={u.spool} onChange={(e) => setU(i, "spool", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" /></div>
            {units.length > 1 && <button onClick={() => setUnits((a) => a.filter((_, j) => j !== i))} className="text-red-500 pb-1.5"><Trash2 size={14} /></button>}
          </div>
        ))}
        <div className="flex gap-2 pt-1 flex-wrap">
          <Button size="xs" variant="secondary" onClick={() => setUnits((a) => [...a, { qty: "", unit: "KG", width: "", spool: isSlitting ? laneAt(a.length) : "" }])}>+ Add roll</Button>
          <Button size="xs" variant="primary" loading={busy} onClick={generate}>Generate QR Rolls</Button>
          {rolls.length > 0 && (
            <Button size="xs" variant="secondary" icon={<Download size={12} />}
              onClick={() => downloadRollLabels(rolls.map((r) => ({ BatchNo: r.BatchNo, Quantity: r.Quantity, RollUnit: r.RollUnit, SpoolID: r.SpoolID, QRCode: r.QRCode })), { fileName: `RollLabels_${productionId}.pdf` })}>
              Download all labels
            </Button>
          )}
          {rolls.some((r) => r.SpoolID) && (
            <Button size="xs" variant="secondary" icon={<Tag size={12} />}
              onClick={() => downloadSpoolSlips(rolls.map((r) => ({ BatchNo: r.BatchNo, Quantity: r.Quantity, RollUnit: r.RollUnit, SpoolID: r.SpoolID, QRCode: r.QRCode })), { fileName: `SpoolSlips_${productionId}.pdf` })}>
              Spool slips
            </Button>
          )}
        </div>
      </div>

      {rolls.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-600" style={{ background: "var(--erp-primary-light)" }}>
                <th className="px-3 py-2 font-semibold">Roll Batch (QR)</th>
                <th className="px-3 py-2 font-semibold text-right">Qty</th>
                <th className="px-3 py-2 font-semibold">Spool</th>
                <th className="px-3 py-2 font-semibold text-center">Status</th>
                <th className="px-3 py-2 font-semibold text-center">QR</th>
                <th className="px-3 py-2 font-semibold text-center">Label</th>
                <th className="px-3 py-2 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rolls.map((r) => {
                const done = /returned to store|semi finished/i.test(r.Status);
                const packed = /sent to packing/i.test(r.Status);
                return (
                <tr key={r.RollID} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-gray-700">{r.BatchNo}</td>
                  <td className="px-3 py-2 text-right">{num(r.Quantity).toLocaleString("en-IN")} {r.RollUnit}</td>
                  <td className="px-3 py-2 text-gray-600">{r.SpoolID || "—"}</td>
                  <td className="px-3 py-2 text-center">{statusBadge(r.Status)}</td>
                  <td className="px-3 py-2 text-center"><QRCodeCanvas value={r.QRCode || r.BatchNo} size={38} /></td>
                  <td className="px-3 py-2 text-center">
                    <button title="Download QR label" className="text-gray-500 hover:text-[color:var(--erp-primary)]"
                      onClick={() => downloadRollLabels([{ BatchNo: r.BatchNo, Quantity: r.Quantity, RollUnit: r.RollUnit, SpoolID: r.SpoolID, QRCode: r.QRCode }])}>
                      <Download size={14} />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    {done ? <span className="text-[10px] text-gray-400">—</span> : packed ? (
                      <button onClick={() => doUndoPack(r)} className="text-[11px] px-2 py-0.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-50">Undo pack</button>
                    ) : (
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <button onClick={() => doPack(r)} title="Send to packing" className="text-[11px] px-2 py-0.5 rounded border border-green-300 text-green-700 hover:bg-green-50">Pack</button>
                        <button onClick={() => doReturn(r)} title="Return to store" className="text-[11px] px-2 py-0.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50">Return</button>
                        <button onClick={() => doSemi(r)} title="Convert to semi-finish" className="text-[11px] px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Semi</button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </StepCard>
  );
}

// ── Production update history (transaction log) ──────────────────────────
interface HistRow { ProductionUpdateID: number; UpdatedOn: string; ProductionQuantity: number; WastageQuantity: number; Status: string; Remark: string; }
function UpdateHistory({ productionId, refreshKey }: { productionId: number; refreshKey: boolean }) {
  const [rows, setRows] = useState<HistRow[]>([]);
  useEffect(() => {
    (async () => {
      const d = await apiGet<HistRow[]>(`${API}/updatehistory/${productionId}`).catch(() => []);
      setRows(Array.isArray(d) ? d : []);
    })();
  }, [productionId, refreshKey]);

  if (!rows.length) return null;
  return (
    <StepCard n={8} title="Production History" icon={<PackageCheck size={16} />}>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-600" style={{ background: "var(--erp-primary-light)" }}>
              <th className="px-3 py-2 font-semibold">Date/Time</th>
              <th className="px-3 py-2 font-semibold text-right">Production Qty</th>
              <th className="px-3 py-2 font-semibold text-right">Wastage</th>
              <th className="px-3 py-2 font-semibold text-center">Status</th>
              <th className="px-3 py-2 font-semibold">Remark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.ProductionUpdateID} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-600">{h.UpdatedOn}</td>
                <td className="px-3 py-2 text-right">{num(h.ProductionQuantity).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 text-right">{num(h.WastageQuantity).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 text-center">{statusBadge(h.Status)}</td>
                <td className="px-3 py-2 text-gray-600">{h.Remark || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StepCard>
  );
}

// ── Small step-card wrapper ──────────────────────────────────────────────
function StepCard({ n, title, icon, right, children }: {
  n: number; title: string; icon: React.ReactNode; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center text-white"
            style={{ background: "var(--erp-primary)" }}>{n}</span>
          <span className="text-gray-500">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        {right}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}
