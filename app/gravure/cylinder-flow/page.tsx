"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Cylinder Flow — the operational hub for the cylinder-as-tool lifecycle.
//   • Lifecycle: every cylinder's current stage (Created → Requisitioned → PO → Received →
//     Issued → In Production → Life Over) + life meter, resolved live from the tool chain.
//   • Requisition: created cylinders awaiting procurement → raise a tool requisition (-115).
//   • Issue to Job: printing job-contents → issue the content's cylinders to the job so the
//     printing production gate (no start without cylinder issue) is satisfied.
// Backend: api/cylinderflowShrink/*.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Plus, Send, Package, Factory, X, RotateCcw } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";
import { DataTable } from "@/components/tables/DataTable";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const API = "api/cylinderflowShrink";

function unwrap(raw: unknown): unknown {
  let r = raw;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}
async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, { headers: authHeaders() });
  return unwrap(await res.text()) as T;
}
async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  return unwrap(await res.text()) as T;
}
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }
function n(v: unknown) { const p = parseFloat(String(v)); return isNaN(p) ? 0 : p; }

// ── Types ──────────────────────────────────────────────────────────────────────
interface LifeRow {
  ToolID: number; ToolCode: string; CylinderCode: string; ColorName: string; CylinderType: string;
  ProductMasterCode: string; RatedLifeMeters: number; UsedMeters: number; RemainingMeters: number;
  UsedPct: number; Stage: string; LifeLow: number;
}
interface ReqRow {
  ToolID: number; ToolGroupID: number; ToolCode: string; CylinderCode: string; ColorName: string;
  CylinderType: string; ProductMasterCode: string; RatedLifeMeters: number; PurchaseRate: number;
  StockUnit: string; VendorName: string; JobBookingID: number; JobBookingNo: string;
}
interface JobRow {
  JobBookingID: number; JobBookingNo: string; JobName: string; ContentID: number;
  RequiredCyl: number; IssuedCyl: number; PrintProcessID: number; PrintProcessName: string;
}
interface CylRow {
  ToolID: number; ToolGroupID: number; ToolCode: string; CylinderCode: string; ColorName: string;
  ColorSequenceNo: number; CylinderType: string; ProductMasterCode: string; ProductMasterID: number;
  RatedLifeMeters: number; StockUnit: string; AvailableStock: number; IssuedToJob: number;
}
interface StockRow { BatchNo: string; WarehouseID: number; WarehouseName: string; StockUnit: string; AvailableStock: number; }
interface RetRow {
  IssueTransactionID: number; ToolID: number; ToolGroupID: number; ToolCode: string; ColorName: string; ProductMasterCode: string;
  JobBookingID: number; JobBookingNo: string; ContentID: number; BatchNo: string; WarehouseID: number; WarehouseName: string;
  StockUnit: string; IssueNo: string; JobReference: string; ReturnableQty: number;
}

const stageColor = (s: string): string => {
  switch (s) {
    case "Life Over": return "bg-red-100 text-red-700";
    case "In Production": return "bg-violet-100 text-violet-700";
    case "Issued": return "bg-blue-100 text-blue-700";
    case "In Stock (Received)": return "bg-emerald-100 text-emerald-700";
    case "PO Raised": return "bg-amber-100 text-amber-700";
    case "Requisitioned": return "bg-cyan-100 text-cyan-700";
    default: return "bg-gray-100 text-gray-600";
  }
};

export default function CylinderFlowPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"lifecycle" | "requisition" | "issue" | "return">("lifecycle");
  const [loading, setLoading] = useState(false);

  const [life, setLife] = useState<LifeRow[]>([]);
  const [pending, setPending] = useState<ReqRow[]>([]);
  const [selReq, setSelReq] = useState<Set<number>>(new Set());
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [returnable, setReturnable] = useState<RetRow[]>([]);
  const [selRet, setSelRet] = useState<Set<string>>(new Set());

  // issue modal
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueJob, setIssueJob] = useState<JobRow | null>(null);
  const [cyls, setCyls] = useState<CylRow[]>([]);
  const [stockByTool, setStockByTool] = useState<Record<number, StockRow[]>>({});
  const [pick, setPick] = useState<Record<number, { batch: string; wh: number; qty: string; on: boolean }>>({});
  const [issuing, setIssuing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "lifecycle") setLife(arr<LifeRow>(await apiGet(`${API}/lifecycle`)));
      else if (tab === "requisition") { setPending(arr<ReqRow>(await apiGet(`${API}/pendingrequisition`))); setSelReq(new Set()); }
      else if (tab === "return") { setReturnable(arr<RetRow>(await apiGet(`${API}/returnablecylinders`))); setSelRet(new Set()); }
      else setJobs(arr<JobRow>(await apiGet(`${API}/jobsforissue`)));
    } catch { showToast("error", "Failed to load"); }
    setLoading(false);
  }, [tab, showToast]);
  useEffect(() => { load(); }, [load]);

  // ── Requisition ──────────────────────────────────────────────────────────────
  const createRequisition = async () => {
    const lines = pending.filter(p => selReq.has(p.ToolID)).map(p => ({
      ToolID: String(p.ToolID), ToolGroupID: String(p.ToolGroupID), RequiredQuantity: "1", StockUnit: p.StockUnit || "Nos",
      JobBookingID: String(p.JobBookingID || 0),
    }));
    if (lines.length === 0) { showToast("error", "Select at least one cylinder"); return; }
    try {
      const res = String(await apiPost(`${API}/createrequisition`, { Lines: lines }));
      if (res.startsWith("Success")) { showToast("success", "Requisition created: " + res.split(":")[1]); load(); }
      else showToast("error", res);
    } catch (e) { showToast("error", (e as Error).message); }
  };

  // ── Return ───────────────────────────────────────────────────────────────────
  const retKey = (r: RetRow) => `${r.IssueTransactionID}-${r.ToolID}-${r.BatchNo}`;
  const returnCylinders = async () => {
    const lines = returnable.filter(r => selRet.has(retKey(r))).map(r => ({
      IssueTransactionID: String(r.IssueTransactionID), ToolID: String(r.ToolID), ToolGroupID: String(r.ToolGroupID),
      JobBookingID: String(r.JobBookingID), ContentID: String(r.ContentID), BatchNo: r.BatchNo, WarehouseID: String(r.WarehouseID),
      ReceiptQuantity: String(r.ReturnableQty), StockUnit: r.StockUnit,
    }));
    if (lines.length === 0) { showToast("error", "Select cylinders to return"); return; }
    try {
      const res = String(await apiPost(`${API}/returntojob`, { Lines: lines, Narration: "Cylinder returned after print run" }));
      if (res.startsWith("Success")) { showToast("success", "Returned: " + res.split(":")[1]); load(); }
      else showToast("error", res);
    } catch (e) { showToast("error", (e as Error).message); }
  };

  // ── Issue ────────────────────────────────────────────────────────────────────
  const openIssue = async (j: JobRow) => {
    setIssueJob(j); setIssueOpen(true); setCyls([]); setStockByTool({}); setPick({});
    try {
      const rows = arr<CylRow>(await apiGet(`${API}/requiredcylinders/${j.JobBookingID}/${j.ContentID}/${j.PrintProcessID || 0}`));
      setCyls(rows);
      // preload per-cylinder stock
      const map: Record<number, StockRow[]> = {};
      const pk: Record<number, { batch: string; wh: number; qty: string; on: boolean }> = {};
      await Promise.all(rows.map(async r => {
        const s = arr<StockRow>(await apiGet(`${API}/cylinderstock/${r.ToolID}`));
        map[r.ToolID] = s;
        const first = s[0];
        pk[r.ToolID] = { batch: first?.BatchNo ?? "", wh: first?.WarehouseID ?? 0, qty: "1", on: r.IssuedToJob <= 0 && n(r.AvailableStock) > 0 };
      }));
      setStockByTool(map); setPick(pk);
    } catch { showToast("error", "Failed to load cylinders"); }
  };

  const submitIssue = async () => {
    if (!issueJob) return;
    const lines = cyls.filter(c => pick[c.ToolID]?.on && c.IssuedToJob <= 0).map(c => {
      const p = pick[c.ToolID];
      return { ToolID: String(c.ToolID), ToolGroupID: String(c.ToolGroupID), BatchNo: p.batch, WarehouseID: String(p.wh), IssueQuantity: p.qty || "1", StockUnit: c.StockUnit };
    });
    if (lines.length === 0) { showToast("error", "Select cylinders with stock to issue"); return; }
    setIssuing(true);
    try {
      const prodCode = cyls.find(c => c.ProductMasterCode)?.ProductMasterCode ?? "";
      const jobRef = `${issueJob.JobBookingNo}${prodCode ? " · " + prodCode : ""}`;
      const body = { Main: { JobBookingID: String(issueJob.JobBookingID), JobBookingJobCardContentsID: String(issueJob.ContentID), ProcessID: String(issueJob.PrintProcessID || 0), MachineID: "0", Particular: `Job ${issueJob.JobBookingNo}`, JobReference: jobRef, Narration: "Cylinder issue for printing" }, Lines: lines };
      const res = String(await apiPost(`${API}/issuetojob`, body));
      if (res.startsWith("Success")) { showToast("success", "Cylinders issued: " + res.split(":")[1]); setIssueOpen(false); load(); }
      else showToast("error", res);
    } catch (e) { showToast("error", (e as Error).message); }
    setIssuing(false);
  };

  const setP = (tool: number, patch: Partial<{ batch: string; wh: number; qty: string; on: boolean }>) =>
    setPick(p => ({ ...p, [tool]: { ...p[tool], ...patch } }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cylinder Flow</h1>
          <p className="text-xs text-gray-500">Cylinder = printing tool — requisition → PO → GRN → issue to job → production → life & return.</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={load}>Refresh</Button>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-gray-100 w-fit">
        {([["lifecycle", "Lifecycle", Factory], ["requisition", "Requisition", Package], ["issue", "Issue to Job", Send], ["return", "Return", RotateCcw]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "lifecycle" && (
        <DataTable<LifeRow>
          data={life} loading={loading} getRowId={r => String(r.ToolID)}
          columns={[
            { key: "ToolCode", header: "Cylinder", render: r => <span className="font-medium text-blue-700">{r.ToolCode}</span> },
            { key: "ColorName", header: "Color" },
            { key: "ProductMasterCode", header: "Product" },
            { key: "CylinderType", header: "Type" },
            { key: "Stage", header: "Stage", render: r => <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${stageColor(r.Stage)}`}>{r.Stage}</span> },
            {
              key: "UsedPct", header: "Life", render: r => (
                <div className="min-w-28">
                  <div className="flex justify-between text-[10px] text-gray-500"><span>{n(r.UsedMeters).toLocaleString()}m</span><span>{n(r.RatedLifeMeters).toLocaleString()}m</span></div>
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full ${r.LifeLow ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, n(r.UsedPct))}%` }} />
                  </div>
                </div>
              ),
            },
            { key: "LifeLow", header: "", render: r => r.LifeLow ? <span className="text-[10px] font-semibold text-red-600">LOW LIFE</span> : null },
          ]}
        />
      )}

      {tab === "requisition" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{selReq.size} selected — cylinders created, awaiting procurement.</p>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={createRequisition} disabled={selReq.size === 0}>Create Requisition</Button>
          </div>
          <DataTable<ReqRow>
            data={pending} loading={loading} getRowId={r => String(r.ToolID)}
            columns={[
              {
                key: "ToolID", header: "", render: r => (
                  <input type="checkbox" checked={selReq.has(r.ToolID)} onChange={e => setSelReq(s => { const c = new Set(s); if (e.target.checked) c.add(r.ToolID); else c.delete(r.ToolID); return c; })} />
                ),
              },
              { key: "ToolCode", header: "Cylinder", render: r => <span className="font-medium text-blue-700">{r.ToolCode}</span> },
              { key: "ColorName", header: "Color" },
              { key: "ProductMasterCode", header: "Product" },
              { key: "JobBookingNo", header: "For Job", render: r => r.JobBookingNo ? <span className="font-medium text-gray-700">{r.JobBookingNo}</span> : <span className="text-gray-400">—</span> },
              { key: "CylinderType", header: "Type" },
              { key: "RatedLifeMeters", header: "Rated Life", render: r => <span>{n(r.RatedLifeMeters).toLocaleString()} m</span> },
              { key: "PurchaseRate", header: "Rate", render: r => <span>{n(r.PurchaseRate).toLocaleString()}</span> },
              { key: "VendorName", header: "Vendor" },
            ]}
          />
        </div>
      )}

      {tab === "issue" && (
        <DataTable<JobRow>
          data={jobs} loading={loading} getRowId={r => `${r.JobBookingID}-${r.ContentID}`}
          columns={[
            { key: "JobBookingNo", header: "Job No", render: r => <span className="font-medium text-blue-700">{r.JobBookingNo}</span> },
            { key: "JobName", header: "Job Name" },
            { key: "PrintProcessName", header: "Printing Process", render: r => r.PrintProcessName || <span className="text-gray-400">—</span> },
            { key: "RequiredCyl", header: "Cylinders", render: r => <span>{r.RequiredCyl}</span> },
            {
              key: "IssuedCyl", header: "Issued", render: r => (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${r.IssuedCyl >= r.RequiredCyl ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {r.IssuedCyl}/{r.RequiredCyl} {r.IssuedCyl >= r.RequiredCyl ? "✓ ready" : "pending"}
                </span>
              ),
            },
          ]}
          actions={r => (
            <Button size="sm" variant="primary" pill icon={<Send size={12} />} onClick={() => openIssue(r)}>Issue Cylinders</Button>
          )}
        />
      )}

      {tab === "return" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{selRet.size} selected — cylinders on the floor, returnable to warehouse after the print run.</p>
            <Button variant="primary" size="sm" icon={<RotateCcw size={14} />} onClick={returnCylinders} disabled={selRet.size === 0}>Return Selected</Button>
          </div>
          <DataTable<RetRow>
            data={returnable} loading={loading} getRowId={r => retKey(r)}
            columns={[
              {
                key: "ToolID", header: "", render: r => (
                  <input type="checkbox" checked={selRet.has(retKey(r))} onChange={e => setSelRet(s => { const c = new Set(s); if (e.target.checked) c.add(retKey(r)); else c.delete(retKey(r)); return c; })} />
                ),
              },
              { key: "ToolCode", header: "Cylinder", render: r => <span className="font-medium text-blue-700">{r.ToolCode}</span> },
              { key: "ColorName", header: "Color" },
              { key: "JobBookingNo", header: "From Job", render: r => <span className="font-medium">{r.JobBookingNo || r.JobReference || "—"}</span> },
              { key: "ProductMasterCode", header: "Product" },
              { key: "BatchNo", header: "Batch" },
              { key: "IssueNo", header: "Issue No" },
              { key: "ReturnableQty", header: "On Floor", render: r => <span className="font-semibold text-amber-700">{n(r.ReturnableQty)}</span> },
            ]}
          />
        </div>
      )}

      {/* Issue modal */}
      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title={`Issue Cylinders — ${issueJob?.JobBookingNo ?? ""}`} size="xl">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Job <b>{issueJob?.JobBookingNo}</b> — {issueJob?.JobName}{cyls.find(c => c.ProductMasterCode) ? <> · Product <b>{cyls.find(c => c.ProductMasterCode)?.ProductMasterCode}</b></> : null}. Printing: <b>{issueJob?.PrintProcessName || "—"}</b>. In cylinders ko is job pe issue karo taaki printing production start ho sake.</p>
          {cyls.length === 0 ? (
            <div className="py-8 text-center text-gray-400"><Loader2 className="animate-spin inline" size={18} /> Loading cylinders…</div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-50"><tr>{["", "Cylinder", "Color", "Available", "Batch / Warehouse", "Qty", "Status"].map(h => <th key={h} className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase border border-gray-200">{h}</th>)}</tr></thead>
                <tbody>
                  {cyls.map(c => {
                    const p = pick[c.ToolID] ?? { batch: "", wh: 0, qty: "1", on: false };
                    const done = c.IssuedToJob > 0;
                    const stock = stockByTool[c.ToolID] ?? [];
                    const noStock = n(c.AvailableStock) <= 0;
                    return (
                      <tr key={c.ToolID} className={done ? "bg-emerald-50/40" : ""}>
                        <td className="px-2 py-1.5 border border-gray-200">
                          <input type="checkbox" disabled={done || noStock} checked={!!p.on} onChange={e => setP(c.ToolID, { on: e.target.checked })} />
                        </td>
                        <td className="px-2 py-1.5 border border-gray-200 font-medium">{c.ToolCode}</td>
                        <td className="px-2 py-1.5 border border-gray-200">{c.ColorName}</td>
                        <td className="px-2 py-1.5 border border-gray-200 text-right">{n(c.AvailableStock)}</td>
                        <td className="px-2 py-1.5 border border-gray-200">
                          {done ? "—" : noStock ? <span className="text-red-500 text-xs">no stock (GRN pending)</span> : (
                            <select className="px-2 py-1 border border-gray-300 rounded text-sm" value={`${p.batch}||${p.wh}`}
                              onChange={e => { const [b, w] = e.target.value.split("||"); setP(c.ToolID, { batch: b, wh: n(w) }); }}>
                              {stock.map((s, i) => <option key={i} value={`${s.BatchNo}||${s.WarehouseID}`}>{(s.BatchNo || "—")} @ {s.WarehouseName || "WH" + s.WarehouseID} ({n(s.AvailableStock)})</option>)}
                            </select>
                          )}
                        </td>
                        <td className="px-2 py-1.5 border border-gray-200 w-20">
                          {!done && !noStock && <input className="w-16 px-2 py-1 border border-gray-300 rounded text-sm" type="number" value={p.qty} onChange={e => setP(c.ToolID, { qty: e.target.value })} />}
                        </td>
                        <td className="px-2 py-1.5 border border-gray-200">
                          {done ? <span className="text-[11px] font-semibold text-emerald-700">Issued ✓</span> : noStock ? <span className="text-[11px] text-gray-400">pending stock</span> : <span className="text-[11px] text-amber-600">to issue</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="md" icon={<X size={14} />} onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button variant="primary" size="md" loading={issuing} icon={<Send size={15} />} onClick={submitIssue}>Issue Selected</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
