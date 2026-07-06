"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Plus, Pencil, Trash2, Printer, FileText } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const API = "api/invoiceShrink";

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
function today() { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400000).toISOString().split("T")[0]; }
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }
function n(v: unknown) { const p = parseFloat(String(v)); return isNaN(p) ? 0 : p; }
function money(v: number) { return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ── Types ──────────────────────────────────────────────────────────────────────
interface PendingRow {
  FGTransactionID: number; FGTransactionDetailID: number; JobBookingID: number;
  LedgerID: number; ConsigneeLedgerID: number; SalesLedgerID: number;
  ProductMasterID: number; ProductHSNID: number; OrderBookingID: number; OrderBookingDetailsID: number;
  DeliveryNoteNo: string; DeliveryNoteDate: string; ClientName: string; ConsigneeName: string;
  ProductMasterCode: string; SalesOrderNo: string; JobBookingNo: string; ProductCode: string;
  HSNCode: string; JobName: string; TotalDeliveredQuantity: number; RateType: string; Rate: number;
  GSTPercentage: number; CGSTPercentage: number; SGSTPercentage: number; IGSTPercentage: number;
}
interface InvRow {
  InvoiceTransactionID: number; VoucherNo: string; VoucherDate: string; LedgerID: number;
  ClientName: string; ConsigneeName: string; TotalQuantity: number; TotalBasicAmount: number;
  TotalTaxAmount: number; NetAmount: number; IsCoaCreated: number; Narration: string;
}
interface Line {
  FGTransactionID: number; FGTransactionDetailID: number; JobBookingID: number; ProductMasterID: number;
  ProductHSNID: number; ProductCode: string; JobName: string; OrderBookingID: number; OrderBookingDetailsID: number;
  HSNCode: string; quantity: string; rate: string;
  gstPct: number; cgstPct: number; sgstPct: number; igstPct: number;
}

type Tax = "intra" | "inter";

const inputCls = "w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white";
const lbl = "text-[11px] font-semibold text-gray-500 uppercase tracking-wider";

function lineCalc(l: Line, tax: Tax) {
  const qty = n(l.quantity), rate = n(l.rate);
  const gross = qty * rate;
  const taxable = gross;
  const cgst = tax === "intra" ? taxable * l.cgstPct / 100 : 0;
  const sgst = tax === "intra" ? taxable * l.sgstPct / 100 : 0;
  const igst = tax === "inter" ? taxable * (l.igstPct || l.gstPct) / 100 : 0;
  const net = taxable + cgst + sgst + igst;
  return { gross, taxable, cgst, sgst, igst, net };
}

export default function InvoiceTab() {
  const { showToast } = useToast();
  const [sub, setSub] = useState<"pending" | "saved">("pending");
  const [fromDate, setFromDate] = useState(daysAgo(60));
  const [toDate, setToDate] = useState(today());
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [invoices, setInvoices] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(0);
  const [saving, setSaving] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(today());
  const [clientName, setClientName] = useState("");
  const [consigneeName, setConsigneeName] = useState("");
  const [ledgerID, setLedgerID] = useState(0);
  const [consigneeID, setConsigneeID] = useState(0);
  const [salesLedgerID, setSalesLedgerID] = useState(0);
  const [narration, setNarration] = useState("");
  const [tax, setTax] = useState<Tax>("intra");
  const [lines, setLines] = useState<Line[]>([]);

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (sub === "pending") setPending(arr<PendingRow>(await apiGet(`${API}/pending?fromDate=${fromDate}&toDate=${toDate}`)));
      else setInvoices(arr<InvRow>(await apiGet(`${API}/list?fromDate=${fromDate}&toDate=${toDate}`)));
    } catch { showToast("error", "Failed to load"); }
    setLoading(false);
  }, [sub, fromDate, toDate, showToast]);
  useEffect(() => { load(); }, [load]);

  // ── Create from a pending delivery-note row ──────────────────────────────────
  const createFrom = async (r: PendingRow) => {
    setEditMode(false); setEditId(0);
    setClientName(r.ClientName ?? ""); setConsigneeName(r.ConsigneeName ?? "");
    setLedgerID(r.LedgerID ?? 0); setConsigneeID(r.ConsigneeLedgerID ?? 0); setSalesLedgerID(r.SalesLedgerID ?? 0);
    setVoucherDate(today()); setNarration(""); setTax("intra");
    setLines([{
      FGTransactionID: r.FGTransactionID, FGTransactionDetailID: r.FGTransactionDetailID, JobBookingID: r.JobBookingID,
      ProductMasterID: r.ProductMasterID, ProductHSNID: r.ProductHSNID, ProductCode: r.ProductCode ?? "",
      JobName: r.JobName ?? "", OrderBookingID: r.OrderBookingID, OrderBookingDetailsID: r.OrderBookingDetailsID,
      HSNCode: r.HSNCode ?? "", quantity: String(r.TotalDeliveredQuantity ?? 0), rate: String(r.Rate || 0),
      gstPct: n(r.GSTPercentage), cgstPct: n(r.CGSTPercentage), sgstPct: n(r.SGSTPercentage), igstPct: n(r.IGSTPercentage),
    }]);
    try { setVoucherNo(String(await apiGet(`${API}/noteno?prefix=INV`))); } catch { setVoucherNo(""); }
    setModalOpen(true);
  };

  // ── Edit a saved invoice ─────────────────────────────────────────────────────
  const openEdit = async (inv: InvRow) => {
    setEditMode(true); setEditId(inv.InvoiceTransactionID);
    setVoucherNo(inv.VoucherNo ?? ""); setVoucherDate((inv.VoucherDate || "").slice(0, 10) || today());
    setClientName(inv.ClientName ?? ""); setConsigneeName(inv.ConsigneeName ?? "");
    setLedgerID(inv.LedgerID ?? 0); setNarration(inv.Narration ?? ""); setTax("intra");
    try {
      const det = arr<Record<string, unknown>>(await apiGet(`${API}/get/${inv.InvoiceTransactionID}`));
      setLines(det.map(d => ({
        FGTransactionID: n(d.FGTransactionID), FGTransactionDetailID: n(d.FGTransactionDetailID), JobBookingID: n(d.JobBookingID),
        ProductMasterID: n(d.ProductMasterID), ProductHSNID: n(d.ProductHSNID), ProductCode: String(d.ProductCode ?? ""),
        JobName: String(d.JobName ?? ""), OrderBookingID: n(d.OrderBookingID), OrderBookingDetailsID: n(d.OrderBookingDetailsID),
        HSNCode: String(d.HSNCode ?? ""), quantity: String(d.Quantity ?? 0), rate: String(d.Rate ?? 0),
        gstPct: n(d.GSTPercentage), cgstPct: n(d.CGSTPercentage), sgstPct: n(d.SGSTPercentage), igstPct: n(d.IGSTPercentage),
      })));
      if (det.some(d => n(d.IGSTAmount) > 0)) setTax("inter");
    } catch { showToast("error", "Failed to load invoice"); }
    setModalOpen(true);
  };

  // ── Totals ───────────────────────────────────────────────────────────────────
  const totals = lines.reduce((a, l) => {
    const c = lineCalc(l, tax);
    a.qty += n(l.quantity); a.basic += c.taxable; a.cgst += c.cgst; a.sgst += c.sgst; a.igst += c.igst; a.net += c.net;
    return a;
  }, { qty: 0, basic: 0, cgst: 0, sgst: 0, igst: 0, net: 0 });

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (lines.length === 0) { showToast("error", "No lines to invoice"); return; }
    if (totals.net <= 0) { showToast("error", "Enter rate to compute amount"); return; }
    setSaving(true);
    try {
      const payload = {
        Editflag: editMode, InvoiceTransactionID: editMode ? String(editId) : "",
        Main: {
          VoucherPrefix: "INV", VoucherDate: voucherDate,
          LedgerID: String(ledgerID), ConsigneeLedgerID: String(consigneeID), SalesLedgerID: String(salesLedgerID),
          TotalQuantity: String(totals.qty), TotalBasicAmount: String(totals.basic), TotalDiscountAmount: "0",
          TotalCGST: String(totals.cgst), TotalSGST: String(totals.sgst), TotalIGST: String(totals.igst),
          TotalTax: String(totals.cgst + totals.sgst + totals.igst), NetAmount: String(totals.net), Narration: narration,
        },
        Lines: lines.map(l => {
          const c = lineCalc(l, tax);
          return {
            FGTransactionID: String(l.FGTransactionID), FGTransactionDetailID: String(l.FGTransactionDetailID),
            JobBookingID: String(l.JobBookingID), ProductMasterID: String(l.ProductMasterID), ProductHSNID: String(l.ProductHSNID),
            JobName: l.JobName, ProductCode: l.ProductCode, OrderBookingID: String(l.OrderBookingID), OrderBookingDetailsID: String(l.OrderBookingDetailsID),
            Quantity: String(n(l.quantity)), RateType: "", Rate: String(n(l.rate)), GrossAmount: String(c.gross),
            DiscountPercentage: "0", DiscountAmount: "0", BasicAmount: String(c.taxable), TaxableAmount: String(c.taxable),
            GSTPercentage: String(l.gstPct), CGSTPercentage: String(tax === "intra" ? l.cgstPct : 0), SGSTPercentage: String(tax === "intra" ? l.sgstPct : 0),
            IGSTPercentage: String(tax === "inter" ? (l.igstPct || l.gstPct) : 0),
            CGSTAmount: String(c.cgst), SGSTAmount: String(c.sgst), IGSTAmount: String(c.igst), NetAmount: String(c.net),
          };
        }),
      };
      const res = await apiPost<string>(`${API}/save`, payload);
      if (String(res) === "Success") { showToast("success", editMode ? "Invoice updated" : "Invoice created"); setModalOpen(false); setSub("saved"); load(); }
      else showToast("error", "Save failed: " + res);
    } catch (e) { showToast("error", "Error: " + (e as Error).message); }
    setSaving(false);
  };

  const del = async (inv: InvRow) => {
    if (!confirm(`Delete invoice ${inv.VoucherNo}?`)) return;
    try {
      const res = await apiPost<string>(`${API}/delete`, { InvoiceTransactionID: String(inv.InvoiceTransactionID) });
      if (String(res) === "Success") { showToast("success", "Invoice deleted"); load(); }
      else showToast("error", "Delete failed: " + res);
    } catch (e) { showToast("error", "Error: " + (e as Error).message); }
  };

  const printInv = (inv: InvRow) => {
    apiGet<unknown>(`${API}/get/${inv.InvoiceTransactionID}`).then(d => {
      const det = arr<Record<string, unknown>>(d);
      const w = window.open("", "_blank", "width=900,height=700"); if (!w) return;
      const rows = det.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.ProductCode)}</td><td>${esc(p.HSNCode)}</td><td style="text-align:right">${esc(p.Quantity)}</td><td style="text-align:right">${esc(p.Rate)}</td><td style="text-align:right">${money(n(p.BasicAmount))}</td><td style="text-align:right">${money(n(p.CGSTAmount) + n(p.SGSTAmount) + n(p.IGSTAmount))}</td><td style="text-align:right">${money(n(p.NetAmount))}</td></tr>`).join("");
      const net = det.reduce((s, p) => s + n(p.NetAmount), 0);
      w.document.write(`<html><head><title>Invoice ${esc(inv.VoucherNo)}</title><style>body{font-family:Arial;padding:24px;color:#222}h2{margin:0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #888;padding:6px 8px;font-size:12px}th{background:#eef}</style></head><body><h2>Tax Invoice</h2><div><b>${esc(inv.VoucherNo)}</b> &nbsp; ${esc(inv.VoucherDate)}</div><div><b>Customer:</b> ${esc(inv.ClientName)} &nbsp; <b>Consignee:</b> ${esc(inv.ConsigneeName)}</div><table><thead><tr><th>#</th><th>Product</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Basic</th><th>Tax</th><th>Net</th></tr></thead><tbody>${rows}</tbody></table><h3 style="text-align:right;margin-top:12px">Net Amount: ₹ ${money(net)}</h3><script>window.onload=function(){window.print()}</script></body></html>`);
      w.document.close();
    });
  };

  const setLine = (i: number, patch: Partial<Line>) => setLines(p => p.map((l, j) => j === i ? { ...l, ...patch } : l));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex gap-1 p-1 rounded-lg bg-gray-100 w-fit">
          {(["pending", "saved"] as const).map(t => (
            <button key={t} onClick={() => setSub(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${sub === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t === "pending" ? "Pending for Invoice" : "Saved Invoices"}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div><div className={lbl}>From</div><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputCls} /></div>
          <div><div className={lbl}>To</div><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputCls} /></div>
          <Button variant="secondary" size="md" icon={<RefreshCw size={14} />} onClick={load}>Refresh</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 size={22} className="animate-spin text-blue-500" /></div>
        ) : sub === "pending" ? (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50"><tr>{["DN No", "Date", "Customer", "Job No", "Product", "HSN", "Qty", "GST%", ""].map(h =>
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {pending.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">No delivery notes pending invoice. (Create a dispatch / delivery note first.)</td></tr>
              ) : pending.map((r, i) => (
                <tr key={`${r.FGTransactionID}-${r.JobBookingID}-${i}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm font-semibold text-blue-700">{r.DeliveryNoteNo}</td>
                  <td className="px-3 py-2 text-sm">{r.DeliveryNoteDate}</td>
                  <td className="px-3 py-2 text-sm">{r.ClientName}</td>
                  <td className="px-3 py-2 text-sm">{r.JobBookingNo}</td>
                  <td className="px-3 py-2 text-sm">{r.ProductCode || r.ProductMasterCode}</td>
                  <td className="px-3 py-2 text-sm">{r.HSNCode}</td>
                  <td className="px-3 py-2 text-sm text-right">{r.TotalDeliveredQuantity}</td>
                  <td className="px-3 py-2 text-sm text-right">{n(r.GSTPercentage)}%</td>
                  <td className="px-3 py-2 text-right"><Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => createFrom(r)}>Create Invoice</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50"><tr>{["Invoice No", "Date", "Customer", "Qty", "Basic", "Tax", "Net Amount", "COA", ""].map(h =>
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">No invoices in the selected date range</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.InvoiceTransactionID} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm font-semibold text-blue-700">{inv.VoucherNo}</td>
                  <td className="px-3 py-2 text-sm">{inv.VoucherDate}</td>
                  <td className="px-3 py-2 text-sm">{inv.ClientName}</td>
                  <td className="px-3 py-2 text-sm text-right">{inv.TotalQuantity}</td>
                  <td className="px-3 py-2 text-sm text-right">{money(n(inv.TotalBasicAmount))}</td>
                  <td className="px-3 py-2 text-sm text-right">{money(n(inv.TotalTaxAmount))}</td>
                  <td className="px-3 py-2 text-sm text-right font-semibold">{money(n(inv.NetAmount))}</td>
                  <td className="px-3 py-2 text-sm text-center">{inv.IsCoaCreated ? "✓" : "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(inv)}>Edit</Button>
                      <Button variant="ghost" size="sm" icon={<Printer size={13} />} onClick={() => printInv(inv)}>Print</Button>
                      <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => del(inv)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* create / edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? `Edit Invoice — ${voucherNo}` : "New Invoice"} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><div className={lbl}>Invoice No</div><input value={voucherNo} readOnly className={inputCls + " bg-gray-50"} /></div>
            <div><div className={lbl}>Date</div><input type="date" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} className={inputCls} /></div>
            <div><div className={lbl}>Customer</div><input value={clientName} readOnly className={inputCls + " bg-gray-50"} /></div>
            <div><div className={lbl}>Consignee</div><input value={consigneeName} readOnly className={inputCls + " bg-gray-50"} /></div>
          </div>
          <div className="flex items-center gap-3">
            <span className={lbl}>Tax type</span>
            {(["intra", "inter"] as const).map(t => (
              <button key={t} onClick={() => setTax(t)} className={`px-3 py-1 rounded-md text-xs font-semibold border ${tax === t ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"}`}>
                {t === "intra" ? "CGST + SGST (intra-state)" : "IGST (inter-state)"}
              </button>
            ))}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50"><tr>{["Product", "HSN", "Qty", "Rate", "Basic", tax === "intra" ? "CGST" : "IGST", tax === "intra" ? "SGST" : "", "Net"].filter(Boolean).map(h =>
                <th key={h} className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l, i) => {
                  const c = lineCalc(l, tax);
                  return (
                    <tr key={i}>
                      <td className="px-2 py-1.5">{l.ProductCode || l.JobName}</td>
                      <td className="px-2 py-1.5">{l.HSNCode}</td>
                      <td className="px-2 py-1.5 w-24"><input type="number" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} className={inputCls} /></td>
                      <td className="px-2 py-1.5 w-24"><input type="number" value={l.rate} onChange={e => setLine(i, { rate: e.target.value })} className={inputCls} /></td>
                      <td className="px-2 py-1.5 text-right">{money(c.taxable)}</td>
                      {tax === "intra" ? <>
                        <td className="px-2 py-1.5 text-right">{money(c.cgst)}<span className="text-[10px] text-gray-400"> ({l.cgstPct}%)</span></td>
                        <td className="px-2 py-1.5 text-right">{money(c.sgst)}<span className="text-[10px] text-gray-400"> ({l.sgstPct}%)</span></td>
                      </> : <td className="px-2 py-1.5 text-right">{money(c.igst)}<span className="text-[10px] text-gray-400"> ({l.igstPct || l.gstPct}%)</span></td>}
                      <td className="px-2 py-1.5 text-right font-semibold">{money(c.net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-end gap-4">
            <div className="flex-1"><div className={lbl}>Narration</div><textarea rows={2} value={narration} onChange={e => setNarration(e.target.value)} className={inputCls} /></div>
            <div className="text-right text-sm space-y-0.5 min-w-48">
              <div className="flex justify-between gap-6"><span className="text-gray-500">Basic</span><span>{money(totals.basic)}</span></div>
              <div className="flex justify-between gap-6"><span className="text-gray-500">Tax</span><span>{money(totals.cgst + totals.sgst + totals.igst)}</span></div>
              <div className="flex justify-between gap-6 font-bold text-base border-t pt-1"><span>Net</span><span>₹ {money(totals.net)}</span></div>
            </div>
          </div>

          <div className="flex gap-2 pt-1 justify-end">
            <Button variant="secondary" size="md" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="md" loading={saving} icon={<FileText size={15} />} onClick={save}>{editMode ? "Update Invoice" : "Save Invoice"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function esc(s: unknown) { return String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c)); }
