"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, Plus, Pencil, Trash2, Printer,
  ArrowDownToLine, Send, PackageCheck, Eye,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";
import { DataTable } from "@/components/tables/DataTable";
import RowAction from "@/components/ui/RowAction";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const API = "api/gravureOutsourceShrink";

// ── Helpers ──────────────────────────────────────────────────────────────────
function unwrap(raw: unknown): unknown {
  let r = raw;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}
async function apiFetch<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, { headers: authHeaders() });
  return unwrap(await res.text()) as T;
}
async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return unwrap(await res.text()) as T;
}
function todayStr() { return new Date().toISOString().split("T")[0]; }
function daysAgoStr(n: number) { return new Date(Date.now() - n * 86400000).toISOString().split("T")[0]; }
function num(v: unknown) { const p = parseFloat(String(v)); return isNaN(p) ? 0 : p; }

// ── Types ──────────────────────────────────────────────────────────────────────
interface Vendor   { LedgerID: string; LedgerName: string; City: string; GSTNo: string }
interface WorkOrder { JobBookingID: string; JobBookingNo: string; JobName: string; CustomerName: string }
interface Process  { ProcessID: string; ProcessName: string }
interface HSNItem  { ProductHSNID: string; HSNCode: string; DisplayName: string; GSTTaxPercentage: number; CGSTTaxPercentage: number; SGSTTaxPercentage: number; IGSTTaxPercentage: number }

interface SendRow {
  OutsourceID: number; VoucherNo: string; VoucherDate: string;
  VendorName: string; WorkOrderNo: string; JobName: string; CustomerName: string;
  ProcessName: string; QuantitySent: number; Unit: string;
  QuantityReceived: number; PendingQty: number; Status: string; Remark: string; UserID: number;
}
interface PendingGRN {
  OutsourceID: number; SendVoucherNo: string; SendDate: string;
  VendorName: string; LedgerID: number; WorkOrderNo: string; JobBookingID: number;
  JobName: string; ProcessID: number; ProcessName: string;
  QuantitySent: number; Unit: string; Rate: number; ProductHSNID: number;
  QuantityReceived: number; PendingQty: number;
}

interface DetailLine {
  processId: string; processName: string;
  qtySent: string; unit: string; rate: string; amount: string;
  productHsnId: string; taxableAmount: string;
  cgstPct: string; sgstPct: string; igstPct: string;
  cgstAmount: string; sgstAmount: string; igstAmount: string;
  netAmount: string; remark: string;
}

const blankLine = (): DetailLine => ({
  processId: "", processName: "", qtySent: "", unit: "Pcs",
  rate: "", amount: "0", productHsnId: "",
  taxableAmount: "0", cgstPct: "0", sgstPct: "0", igstPct: "0",
  cgstAmount: "0", sgstAmount: "0", igstAmount: "0", netAmount: "0", remark: "",
});

// ── Print helpers ─────────────────────────────────────────────────────────────
const PRINT_CSS = `
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 10px; color: #000; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #333; padding: 4px 6px; }
  th { background: #e8e8e8; font-weight: bold; text-align: center; }
  td { text-align: left; }
  .right { text-align: right; }
  .center { text-align: center; }
  h3 { margin: 0 0 4px 0; text-align: center; font-size: 14px; }
  h4 { margin: 0 0 6px 0; text-align: center; font-size: 12px; }
  .info-row { display: flex; gap: 16px; margin-bottom: 6px; }
  .info-cell { flex: 1; border: 1px solid #333; padding: 4px 6px; }
  .label { font-weight: bold; }
  @media print { * { -webkit-print-color-adjust: exact; } }
`;

function printSendSlip(row: SendRow, vendor: string) {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Outsource Send</title><style>${PRINT_CSS}</style></head><body>`);
  w.document.write(`<h3>INDUS ANALYTICS ERP</h3><h4>Gravure Outsource Send Slip</h4>`);
  w.document.write(`<div class="info-row">
    <div class="info-cell"><span class="label">Voucher No:</span> ${row.VoucherNo}</div>
    <div class="info-cell"><span class="label">Date:</span> ${row.VoucherDate}</div>
    <div class="info-cell"><span class="label">Status:</span> ${row.Status}</div>
  </div>`);
  w.document.write(`<div class="info-row">
    <div class="info-cell"><span class="label">Vendor:</span> ${row.VendorName}</div>
    <div class="info-cell"><span class="label">Work Order:</span> ${row.WorkOrderNo} — ${row.JobName}</div>
  </div>`);
  w.document.write(`<div class="info-row">
    <div class="info-cell"><span class="label">Customer:</span> ${row.CustomerName}</div>
    <div class="info-cell"><span class="label">Remark:</span> ${row.Remark}</div>
  </div>`);
  w.document.write(`<table>
    <thead><tr><th>#</th><th>Process</th><th>Qty Sent</th><th>Unit</th><th>Qty Received</th><th>Pending</th></tr></thead>
    <tbody>
      <tr>
        <td class="center">1</td>
        <td>${row.ProcessName}</td>
        <td class="right">${row.QuantitySent}</td>
        <td class="center">${row.Unit}</td>
        <td class="right">${row.QuantityReceived}</td>
        <td class="right">${row.PendingQty}</td>
      </tr>
    </tbody>
  </table>`);
  w.document.write(`<div style="margin-top:30px;display:flex;justify-content:space-between;">
    <div style="text-align:center;width:150px;border-top:1px solid #333;padding-top:4px;">Prepared By</div>
    <div style="text-align:center;width:150px;border-top:1px solid #333;padding-top:4px;">Checked By</div>
    <div style="text-align:center;width:150px;border-top:1px solid #333;padding-top:4px;">Vendor Sign</div>
  </div>`);
  w.document.write(`</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ s }: { s: string }) {
  const cfg: Record<string, string> = {
    Pending:  "bg-amber-50 text-amber-700 border border-amber-300",
    Partial:  "bg-blue-50 text-blue-700 border border-blue-300",
    Received: "bg-green-50 text-green-700 border border-green-300",
  };
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${cfg[s] ?? "bg-gray-100 text-gray-600"}`}>{s}</span>;
}

// ── Confirm delete modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, onConfirm, onClose, msg }: { open: boolean; onConfirm: () => void; onClose: () => void; msg: string }) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Confirm Delete">
      <p className="text-sm text-gray-600 mb-4">{msg}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>Delete</Button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
export default function GravureOutsourcePage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"list" | "send" | "grn">("list");

  // ── Dropdowns ────────────────────────────────────────────────────────────────
  const [vendors,    setVendors]    = useState<Vendor[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [processes,  setProcesses]  = useState<Process[]>([]);
  const [hsnList,    setHsnList]    = useState<HSNItem[]>([]);
  const [ddLoaded,   setDdLoaded]   = useState(false);

  // ── List ─────────────────────────────────────────────────────────────────────
  const [fromDate,  setFromDate]   = useState(daysAgoStr(30));
  const [toDate,    setToDate]     = useState(todayStr());
  const [listRows,  setListRows]   = useState<SendRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: "send" | "grn" } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Send form ─────────────────────────────────────────────────────────────────
  const [sendDate,       setSendDate]       = useState(todayStr());
  const [sendVendorId,   setSendVendorId]   = useState("");
  const [sendWOId,       setSendWOId]       = useState("");
  const [sendRemark,     setSendRemark]     = useState("");
  const [sendTransporter,setSendTransporter]= useState("");
  const [sendVehicle,    setSendVehicle]    = useState("");
  const [sendLines,      setSendLines]      = useState<DetailLine[]>([blankLine()]);
  const [sendSaving,     setSendSaving]     = useState(false);
  const [editSendId,     setEditSendId]     = useState<number | null>(null);

  // ── GRN form ─────────────────────────────────────────────────────────────────
  const [pendingGRN,    setPendingGRN]    = useState<PendingGRN[]>([]);
  const [pendingLoading,setPendingLoading]= useState(false);
  const [grnSendId,     setGrnSendId]     = useState<number | null>(null);
  const [grnSelected,   setGrnSelected]   = useState<PendingGRN | null>(null);
  const [grnDate,       setGrnDate]       = useState(todayStr());
  const [grnQtyReceived,setGrnQtyReceived]= useState("");
  const [grnQtyWaste,   setGrnQtyWaste]   = useState("0");
  const [grnDelivNote,  setGrnDelivNote]  = useState("");
  const [grnRecvBy,     setGrnRecvBy]     = useState("");
  const [grnRemark,     setGrnRemark]     = useState("");
  const [grnSaving,     setGrnSaving]     = useState(false);

  // ── Load dropdowns ────────────────────────────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    if (ddLoaded) return;
    try {
      const res = await apiFetch<{ vendors: Vendor[]; workOrders: WorkOrder[]; processes: Process[]; hsnList: HSNItem[] }>(
        `${API}/getdropdowns`
      );
      setVendors(res.vendors ?? []);
      setWorkOrders(res.workOrders ?? []);
      setProcesses(res.processes ?? []);
      setHsnList(res.hsnList ?? []);
      setDdLoaded(true);
    } catch { showToast("error", "Failed to load dropdowns"); }
  }, [ddLoaded, showToast]);

  // ── Load list ─────────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const rows = await apiFetch<SendRow[]>(`${API}/getlist?from=${fromDate}&to=${toDate}`);
      setListRows(Array.isArray(rows) ? rows : []);
    } catch { showToast("error", "Failed to load list"); }
    finally { setListLoading(false); }
  }, [fromDate, toDate, showToast]);

  // ── Load pending GRN ──────────────────────────────────────────────────────────
  const loadPendingGRN = useCallback(async () => {
    setPendingLoading(true);
    try {
      const rows = await apiFetch<PendingGRN[]>(`${API}/getpendinggrnlist`);
      setPendingGRN(Array.isArray(rows) ? rows : []);
    } catch { showToast("error", "Failed to load pending list"); }
    finally { setPendingLoading(false); }
  }, [showToast]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (tab === "send" || tab === "grn") loadDropdowns();
    if (tab === "grn") loadPendingGRN();
  }, [tab, loadDropdowns, loadPendingGRN]);

  // ── Send line helpers ─────────────────────────────────────────────────────────
  function updateLine(i: number, key: keyof DetailLine, val: string) {
    setSendLines(prev => {
      const lines = prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l);
      if (key === "qtySent" || key === "rate") {
        const l = lines[i];
        const qty   = parseFloat(l.qtySent) || 0;
        const rate  = parseFloat(l.rate) || 0;
        const amt   = qty * rate;
        const cgst  = (amt * (parseFloat(l.cgstPct) || 0)) / 100;
        const sgst  = (amt * (parseFloat(l.sgstPct) || 0)) / 100;
        const igst  = (amt * (parseFloat(l.igstPct) || 0)) / 100;
        const net   = amt + cgst + sgst + igst;
        lines[i] = { ...lines[i], amount: amt.toFixed(2), taxableAmount: amt.toFixed(2), cgstAmount: cgst.toFixed(2), sgstAmount: sgst.toFixed(2), igstAmount: igst.toFixed(2), netAmount: net.toFixed(2) };
      }
      if (key === "productHsnId") {
        const hsn = hsnList.find(h => h.ProductHSNID === val);
        if (hsn) {
          const l = lines[i];
          const qty  = parseFloat(l.qtySent) || 0;
          const rate = parseFloat(l.rate) || 0;
          const amt  = qty * rate;
          const cgst = (amt * hsn.CGSTTaxPercentage) / 100;
          const sgst = (amt * hsn.SGSTTaxPercentage) / 100;
          const igst = (amt * hsn.IGSTTaxPercentage) / 100;
          const net  = amt + cgst + sgst + igst;
          lines[i] = { ...lines[i], cgstPct: String(hsn.CGSTTaxPercentage), sgstPct: String(hsn.SGSTTaxPercentage), igstPct: String(hsn.IGSTTaxPercentage), cgstAmount: cgst.toFixed(2), sgstAmount: sgst.toFixed(2), igstAmount: igst.toFixed(2), taxableAmount: amt.toFixed(2), netAmount: net.toFixed(2) };
        }
      }
      return lines;
    });
  }

  function pickProcess(i: number, pid: string) {
    const proc = processes.find(p => p.ProcessID === pid);
    updateLine(i, "processId", pid);
    updateLine(i, "processName", proc?.ProcessName ?? "");
  }

  // ── Save Send ─────────────────────────────────────────────────────────────────
  async function saveSend() {
    if (!sendVendorId) { showToast("error", "Select a vendor"); return; }
    const valid = sendLines.filter(l => l.processId && (parseFloat(l.qtySent) || 0) > 0);
    if (valid.length === 0) { showToast("error", "Add at least one process line with quantity"); return; }
    setSendSaving(true);
    try {
      const body = {
        flagEdit: editSendId !== null ? "true" : "false",
        outsourceId: editSendId ?? 0,
        ledgerId: parseInt(sendVendorId),
        jobBookingId: parseInt(sendWOId) || 0,
        voucherDate: sendDate,
        remark: sendRemark,
        transporter: sendTransporter,
        vehicleNo: sendVehicle,
        details: valid.map(l => ({
          processId: parseInt(l.processId),
          qtySent: parseFloat(l.qtySent) || 0,
          unit: l.unit,
          rate: parseFloat(l.rate) || 0,
          amount: parseFloat(l.amount) || 0,
          taxableAmount: parseFloat(l.taxableAmount) || 0,
          cgstPct: parseFloat(l.cgstPct) || 0,
          sgstPct: parseFloat(l.sgstPct) || 0,
          igstPct: parseFloat(l.igstPct) || 0,
          cgstAmount: parseFloat(l.cgstAmount) || 0,
          sgstAmount: parseFloat(l.sgstAmount) || 0,
          igstAmount: parseFloat(l.igstAmount) || 0,
          netAmount: parseFloat(l.netAmount) || 0,
          productHsnId: parseInt(l.productHsnId) || 0,
          remark: l.remark,
        })),
      };
      const res = await apiPost<{ success?: boolean; error?: string }>(`${API}/savesend`, body);
      if (res.success) {
        showToast("success", editSendId ? "Send updated" : "Send saved successfully");
        resetSendForm();
        setTab("list");
        loadList();
      } else {
        showToast("error", res.error ?? "Save failed");
      }
    } catch (e) { showToast("error", "Save error"); }
    finally { setSendSaving(false); }
  }

  function resetSendForm() {
    setSendDate(todayStr()); setSendVendorId(""); setSendWOId("");
    setSendRemark(""); setSendTransporter(""); setSendVehicle("");
    setSendLines([blankLine()]); setEditSendId(null);
  }

  // ── Save GRN ──────────────────────────────────────────────────────────────────
  async function saveGRN() {
    if (!grnSendId || !grnSelected) { showToast("error", "Select a send reference"); return; }
    const qty = parseFloat(grnQtyReceived) || 0;
    if (qty <= 0) { showToast("error", "Received quantity must be > 0"); return; }
    setGrnSaving(true);
    try {
      const body = {
        parentSendId: grnSendId,
        ledgerId: grnSelected.LedgerID,
        jobBookingId: grnSelected.JobBookingID,
        processId: grnSelected.ProcessID,
        voucherDate: grnDate,
        qtyReceived: qty,
        qtyWastage: parseFloat(grnQtyWaste) || 0,
        deliveryNoteNo: grnDelivNote,
        receivedBy: grnRecvBy,
        remark: grnRemark,
      };
      const res = await apiPost<{ success?: boolean; grnVoucherNo?: string; error?: string }>(`${API}/savegrn`, body);
      if (res.success) {
        showToast("success", `GRN saved: ${res.grnVoucherNo}`);
        resetGRNForm();
        setTab("list");
        loadList();
      } else {
        showToast("error", res.error ?? "GRN save failed");
      }
    } catch { showToast("error", "GRN save error"); }
    finally { setGrnSaving(false); }
  }

  function resetGRNForm() {
    setGrnSendId(null); setGrnSelected(null); setGrnDate(todayStr());
    setGrnQtyReceived(""); setGrnQtyWaste("0"); setGrnDelivNote("");
    setGrnRecvBy(""); setGrnRemark("");
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  async function doDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiPost<{ success?: boolean; error?: string }>(`${API}/delete`, deleteTarget);
      if (res.success) { showToast("success", "Deleted"); loadList(); }
      else showToast("error", res.error ?? "Delete failed");
    } catch { showToast("error", "Delete error"); }
    finally { setDeleting(false); setDeleteTarget(null); }
  }

  // ── Load send for edit ────────────────────────────────────────────────────────
  async function loadForEdit(row: SendRow) {
    try {
      // Load dropdowns first so vendor/WO options exist before the form renders
      await loadDropdowns();

      const data = await apiFetch<{ main: Record<string, unknown>[] | null; details: Record<string, unknown>[] }>(`${API}/getbyid/${row.OutsourceID}`);

      // main is an array (ToJson always returns [{...}])
      const arr  = Array.isArray(data.main) ? data.main : [];
      const m    = arr[0];
      if (!m) { showToast("error", "Record not found"); return; }

      setSendDate(String(m.VoucherDate ?? todayStr()));
      // Guard against "0" so the select shows the placeholder when no value
      setSendVendorId(Number(m.LedgerID) > 0 ? String(m.LedgerID) : "");
      setSendWOId(Number(m.JobBookingID) > 0 ? String(m.JobBookingID) : "");
      setSendRemark(String(m.Remark ?? ""));
      setSendTransporter(String(m.Transporter ?? ""));
      setSendVehicle(String(m.VehicleNo ?? ""));

      const dets = Array.isArray(data.details) ? data.details : [];
      setSendLines(dets.length > 0 ? dets.map((d: Record<string, unknown>) => ({
        processId:    String(d.ProcessID ?? ""),
        processName:  String(d.ProcessName ?? ""),
        qtySent:      String(d.QuantitySent ?? ""),
        unit:         String(d.Unit ?? "Pcs"),
        rate:         String(d.Rate ?? ""),
        amount:       String(d.Amount ?? "0"),
        productHsnId: Number(d.ProductHSNID) > 0 ? String(d.ProductHSNID) : "",
        taxableAmount: String(d.TaxableAmount ?? "0"),
        cgstPct:      String(d.CGSTPercentage ?? "0"),
        sgstPct:      String(d.SGSTPercentage ?? "0"),
        igstPct:      String(d.IGSTPercentage ?? "0"),
        cgstAmount:   String(d.CGSTAmount ?? "0"),
        sgstAmount:   String(d.SGSTAmount ?? "0"),
        igstAmount:   String(d.IGSTAmount ?? "0"),
        netAmount:    String(d.NetAmount ?? "0"),
        remark:       String(d.Remark ?? ""),
      })) : [blankLine()]);

      setEditSendId(row.OutsourceID);
      setTab("send");
    } catch { showToast("error", "Load error"); }
  }

  // ── Grand totals ──────────────────────────────────────────────────────────────
  const grandTaxable = sendLines.reduce((s, l) => s + (parseFloat(l.taxableAmount) || 0), 0);
  const grandNet     = sendLines.reduce((s, l) => s + (parseFloat(l.netAmount) || 0), 0);

  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      {/* ── Toolbar ── */}
      <div className="text-white px-4 py-2.5 flex items-center gap-3 flex-wrap shadow-md" style={{ background: "var(--erp-primary)" }}>
        <Send size={16} className="text-blue-400" />
        <h1 className="text-sm font-semibold tracking-wide">Gravure Outsource</h1>
        {tab === "list" && listRows.length > 0 && (
          <span className="ml-3 text-xs text-slate-400">{listRows.length} records</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {tab === "list" && (
            <>
              <Button variant="secondary" pill icon={<Plus size={13} />} onClick={() => { resetSendForm(); setTab("send"); loadDropdowns(); }}>New Send</Button>
              <Button variant="secondary" pill icon={<ArrowDownToLine size={13} />} onClick={() => { resetGRNForm(); setTab("grn"); }}>New GRN</Button>
            </>
          )}
          {tab !== "list" && (
            <button
              onClick={() => { setTab("list"); resetSendForm(); resetGRNForm(); }}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
            >
              ← Back to List
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="bg-white border-b border-gray-200 px-4">
        <div className="flex gap-0">
          {([
            { key: "list", label: "Send List", icon: <PackageCheck size={13} /> },
            { key: "send", label: "New Send",  icon: <Send size={13} /> },
            { key: "grn",  label: "GRN",       icon: <ArrowDownToLine size={13} /> },
          ] as { key: "list" | "send" | "grn"; label: string; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.key}
              onClick={() => {
                if (t.key === "send") { loadDropdowns(); if (tab !== "send") resetSendForm(); }
                if (t.key === "grn")  { loadDropdowns(); loadPendingGRN(); if (tab !== "grn") resetGRNForm(); }
                setTab(t.key);
              }}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === t.key ? "border-blue-600 text-blue-700 bg-blue-50/40" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ LIST TAB ══════════ */}
      {tab === "list" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Slim filter strip */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-wrap">
            <label className="text-xs text-gray-500 font-medium">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <label className="text-xs text-gray-500 font-medium">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <button
              onClick={loadList}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs px-3 py-1.5 rounded transition-colors"
            >
              {listLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Load
            </button>
            <div className="ml-auto flex items-center gap-2">
              {(["Pending","Partial","Received"] as const).map(s => {
                const cnt = listRows.filter(r => r.Status === s).length;
                const cls = s === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200"
                          : s === "Partial"  ? "bg-blue-50 text-blue-700 border-blue-200"
                          :                    "bg-green-50 text-green-700 border-green-200";
                return cnt > 0 ? (
                  <span key={s} className={`text-xs px-2 py-0.5 rounded border font-medium ${cls}`}>{s}: {cnt}</span>
                ) : null;
              })}
            </div>
          </div>

          {/* Table */}
          <DataTable<SendRow>
            data={listRows}
            loading={listLoading}
            getRowId={r => String(r.OutsourceID)}
            columns={[
              {
                key: "VoucherNo", header: "Voucher No.",
                render: r => <span className="font-semibold text-blue-700">{r.VoucherNo}</span>,
              },
              { key: "VoucherDate", header: "Date" },
              { key: "VendorName", header: "Vendor" },
              { key: "WorkOrderNo", header: "Work Order" },
              { key: "JobName", header: "Job", wrap: true, size: 180 },
              { key: "ProcessName", header: "Process" },
              {
                key: "QuantitySent", header: "Qty Sent",
                render: r => <span className="tabular-nums">{num(r.QuantitySent).toLocaleString()} {r.Unit}</span>,
              },
              {
                key: "QuantityReceived", header: "Received",
                render: r => <span className="tabular-nums text-green-700">{num(r.QuantityReceived).toLocaleString()}</span>,
              },
              {
                key: "PendingQty", header: "Pending",
                render: r => <span className="tabular-nums text-amber-700 font-medium">{num(r.PendingQty).toLocaleString()}</span>,
              },
              {
                key: "Status", header: "Status",
                render: r => <StatusBadge s={r.Status} />,
              },
            ]}
            actions={r => (
              <>
                <button onClick={() => printSendSlip(r, r.VendorName)} title="Print"
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                  <Printer size={14} />
                </button>
                <RowAction.Edit onClick={() => loadForEdit(r)} />
                <RowAction.Delete onClick={() => setDeleteTarget({ id: r.OutsourceID, type: "send" })} />
              </>
            )}
          />
        </div>
      )}

      {/* ══════════ SEND TAB ══════════ */}
      {tab === "send" && (
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center gap-2">
              <Send size={14} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">
                {editSendId ? `Edit Send — GOS-${String(editSendId).padStart(4,"0")}` : "New Outsource Send"}
              </span>
            </div>

            <div className="p-4">
              {/* Header fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Date <span className="text-red-500">*</span></label>
                  <input type="date" value={sendDate} onChange={e => setSendDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Vendor <span className="text-red-500">*</span></label>
                  <select value={sendVendorId} onChange={e => setSendVendorId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                    <option value="">— Select Vendor —</option>
                    {vendors.map(v => <option key={v.LedgerID} value={v.LedgerID}>{v.LedgerName}{v.City ? ` (${v.City})` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Work Order</label>
                  <select value={sendWOId} onChange={e => setSendWOId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                    <option value="">— Select Work Order —</option>
                    {workOrders.map(w => <option key={w.JobBookingID} value={w.JobBookingID}>{w.JobBookingNo} — {w.JobName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Transporter</label>
                  <input value={sendTransporter} onChange={e => setSendTransporter(e.target.value)} placeholder="Transporter name"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Vehicle No</label>
                  <input value={sendVehicle} onChange={e => setSendVehicle(e.target.value)} placeholder="GJ-01 AB 1234"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Remark</label>
                  <input value={sendRemark} onChange={e => setSendRemark(e.target.value)} placeholder="Optional remark"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              {/* Process lines */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700">Process Details</span>
                  <button onClick={() => setSendLines(p => [...p, blankLine()])}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                    <Plus size={12} /> Add Row
                  </button>
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-2 py-2 text-left font-semibold text-gray-600 w-8">#</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600 min-w-[140px]">Process *</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600 w-20">Qty Sent *</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600 w-16">Unit</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600 w-20">Rate</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600 w-24">HSN</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-600 w-20">Amount</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-600 w-20">CGST</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-600 w-20">SGST</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-600 w-20">Net</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-600 min-w-[100px]">Remark</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sendLines.map((line, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-2 py-1.5">
                            <select value={line.processId} onChange={e => pickProcess(i, e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                              <option value="">— Process —</option>
                              {processes.map(p => <option key={p.ProcessID} value={p.ProcessID}>{p.ProcessName}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={line.qtySent} onChange={e => updateLine(i, "qtySent", e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={line.unit} onChange={e => updateLine(i, "unit", e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={line.rate} onChange={e => updateLine(i, "rate", e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={line.productHsnId} onChange={e => updateLine(i, "productHsnId", e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                              <option value="">None</option>
                              {hsnList.map(h => <option key={h.ProductHSNID} value={h.ProductHSNID}>{h.HSNCode} ({h.GSTTaxPercentage}%)</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-right text-gray-700">{line.amount}</td>
                          <td className="px-2 py-1.5 text-right text-gray-600">{line.cgstAmount}</td>
                          <td className="px-2 py-1.5 text-right text-gray-600">{line.sgstAmount}</td>
                          <td className="px-2 py-1.5 text-right font-medium text-gray-800">{line.netAmount}</td>
                          <td className="px-2 py-1.5">
                            <input value={line.remark} onChange={e => updateLine(i, "remark", e.target.value)} placeholder="…"
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-2 py-1.5">
                            {sendLines.length > 1 && (
                              <button onClick={() => setSendLines(p => p.filter((_, idx) => idx !== i))}
                                className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                        <td colSpan={6} className="px-3 py-2 text-right text-xs text-gray-600">Totals:</td>
                        <td colSpan={3} className="px-2 py-2 text-right text-xs text-gray-700">Taxable: {grandTaxable.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right text-xs text-gray-900">Net: {grandNet.toFixed(2)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button onClick={resetSendForm}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                  Reset
                </button>
                <button onClick={saveSend} disabled={sendSaving}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded transition-colors">
                  {sendSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {editSendId ? "Update Send" : "Save Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ GRN TAB ══════════ */}
      {tab === "grn" && (
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-green-50 border-b border-green-100 px-4 py-2.5 flex items-center gap-2">
              <ArrowDownToLine size={14} className="text-green-600" />
              <span className="text-sm font-semibold text-green-800">New GRN — Goods Receipt</span>
            </div>

            <div className="p-4">
              {/* Step 1: select pending send */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-700 mb-2 block">Step 1 — Select Send Reference <span className="text-red-500">*</span></label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-52">
                    {pendingLoading ? (
                      <div className="text-center py-6 text-gray-400 text-sm"><Loader2 size={16} className="animate-spin inline mr-2" />Loading…</div>
                    ) : pendingGRN.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-sm">No pending sends found</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-2 w-8"></th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Send No</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Date</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Vendor</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Process</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Sent</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Received</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600 text-amber-700">Pending</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingGRN.map(p => (
                            <tr
                              key={p.OutsourceID}
                              onClick={() => { setGrnSendId(p.OutsourceID); setGrnSelected(p); }}
                              className={`border-b border-gray-100 cursor-pointer transition-colors ${
                                grnSendId === p.OutsourceID ? "bg-green-50 border-l-2 border-l-green-500" : "hover:bg-gray-50"
                              }`}
                            >
                              <td className="px-3 py-2 text-center">
                                {grnSendId === p.OutsourceID
                                  ? <span className="w-4 h-4 bg-green-600 rounded-full inline-flex items-center justify-center"><Eye size={9} className="text-white" /></span>
                                  : <span className="w-4 h-4 border-2 border-gray-300 rounded-full inline-block" />}
                              </td>
                              <td className="px-3 py-2 font-medium text-blue-700">{p.SendVoucherNo}</td>
                              <td className="px-3 py-2 text-gray-600">{p.SendDate}</td>
                              <td className="px-3 py-2">{p.VendorName}</td>
                              <td className="px-3 py-2">{p.ProcessName}</td>
                              <td className="px-3 py-2 text-right">{num(p.QuantitySent).toLocaleString()} {p.Unit}</td>
                              <td className="px-3 py-2 text-right text-green-700">{num(p.QuantityReceived).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-semibold text-amber-700">{num(p.PendingQty).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2: GRN form */}
              {grnSelected && (
                <div>
                  <div className="mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs">
                    <span className="font-semibold text-blue-800">Selected: </span>
                    <span className="text-blue-700">{grnSelected.SendVoucherNo} — {grnSelected.VendorName} — {grnSelected.ProcessName}</span>
                    <span className="ml-3 font-medium text-amber-700">Pending: {num(grnSelected.PendingQty).toLocaleString()} {grnSelected.Unit}</span>
                  </div>

                  <label className="text-xs font-semibold text-gray-700 mb-2 block">Step 2 — GRN Details</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">GRN Date *</label>
                      <input type="date" value={grnDate} onChange={e => setGrnDate(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Qty Received * (max {num(grnSelected.PendingQty)})</label>
                      <input type="number" min="0" max={num(grnSelected.PendingQty)} value={grnQtyReceived} onChange={e => setGrnQtyReceived(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Wastage / Rejection</label>
                      <input type="number" min="0" value={grnQtyWaste} onChange={e => setGrnQtyWaste(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Delivery Note No</label>
                      <input value={grnDelivNote} onChange={e => setGrnDelivNote(e.target.value)} placeholder="DN-001"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Received By</label>
                      <input value={grnRecvBy} onChange={e => setGrnRecvBy(e.target.value)} placeholder="Name"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Remark</label>
                      <input value={grnRemark} onChange={e => setGrnRemark(e.target.value)} placeholder="Optional"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
                    <button onClick={resetGRNForm}
                      className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                      Reset
                    </button>
                    <button onClick={saveGRN} disabled={grnSaving}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded transition-colors">
                      {grnSaving ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}
                      Save GRN
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      <ConfirmModal
        open={!!deleteTarget}
        msg={`Delete this ${deleteTarget?.type === "grn" ? "GRN" : "Outsource Send"}? This cannot be undone.`}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={doDelete}
      />
    </div>
  );
}
