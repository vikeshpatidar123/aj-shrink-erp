"use client";

import { RowAction } from "@/components/ui/RowAction";
import { useState, useEffect, useCallback } from "react";
import { Plus, FileText, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";
import { DataTable } from "@/components/tables/DataTable";
import { downloadTaxInvoice, amountInWords, type TaxInvoiceData } from "@/lib/taxInvoice";

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
function addDays(d: string, x: number) { const dt = new Date(d); dt.setDate(dt.getDate() + x); return dt.toISOString().split("T")[0]; }
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
  HSNCode: string; quantity: string; rate: string; discPct: string;
  gstPct: number; cgstPct: number; sgstPct: number; igstPct: number;
}
interface Charge { LedgerID: number; LedgerName: string; ProductHSNID: number; amount: string; gstPct: string; }
interface Lookup { LedgerID?: number; LedgerName?: string; TypeID?: number; InvoiceType?: string;
  CurrencyID?: number; CurrencyCode?: string; CurrencyName?: string; ConversionValue?: number;
  Country?: string; PortID?: number; PortName?: string; PortCode?: string; GSTApplicable?: number; }
interface Lookups {
  InvoiceTypes: Lookup[]; Currencies: Lookup[]; Countries: Lookup[]; Ports: Lookup[];
  SalesLedgers: Lookup[]; ChargeLedgers: Lookup[]; Banks: Lookup[]; Transporters: Lookup[];
}

type Tax = "intra" | "inter";
const lbl = "text-[11px] font-semibold text-gray-500 uppercase tracking-wider";
const fld = "w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white";

function lineCalc(l: Line, tax: Tax) {
  const gross = n(l.quantity) * n(l.rate);
  const disc = gross * n(l.discPct) / 100;
  const taxable = gross - disc;
  const cgst = tax === "intra" ? taxable * l.cgstPct / 100 : 0;
  const sgst = tax === "intra" ? taxable * l.sgstPct / 100 : 0;
  const igst = tax === "inter" ? taxable * (l.igstPct || l.gstPct) / 100 : 0;
  return { gross, disc, taxable, cgst, sgst, igst, net: taxable + cgst + sgst + igst };
}
function chargeCalc(c: Charge, tax: Tax) {
  const base = n(c.amount), g = n(c.gstPct);
  const cgst = tax === "intra" ? base * g / 200 : 0;
  const sgst = tax === "intra" ? base * g / 200 : 0;
  const igst = tax === "inter" ? base * g / 100 : 0;
  return { base, cgst, sgst, igst, total: base + cgst + sgst + igst };
}

export default function InvoiceTab() {
  const { showToast } = useToast();
  const [sub, setSub] = useState<"pending" | "saved">("pending");
  // Wide range → load all pending / saved; DataTable's own search + pagination handle filtering.
  const fromDate = "2000-01-01";
  const toDate = "2100-12-31";
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [invoices, setInvoices] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lk, setLk] = useState<Lookups | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(0);
  const [saving, setSaving] = useState(false);

  // header
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(today());
  const [invoiceType, setInvoiceType] = useState("");
  const [clientName, setClientName] = useState("");
  const [consigneeName, setConsigneeName] = useState("");
  const [ledgerID, setLedgerID] = useState(0);
  const [consigneeID, setConsigneeID] = useState(0);
  const [salesLedgerID, setSalesLedgerID] = useState(0);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [isExport, setIsExport] = useState(false);
  const [tax, setTax] = useState<Tax>("intra");
  const [narration, setNarration] = useState("");
  const [creditDays, setCreditDays] = useState(0);
  // export
  const [currencyCode, setCurrencyCode] = useState("");
  const [currConv, setCurrConv] = useState("1");
  const [originCountry, setOriginCountry] = useState("India");
  const [destCountry, setDestCountry] = useState("");
  const [loadingPort, setLoadingPort] = useState("");
  const [dischargePort, setDischargePort] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [bankerID, setBankerID] = useState(0);
  // transport
  const [transporterID, setTransporterID] = useState(0);
  const [vehicleNo, setVehicleNo] = useState("");
  const [freight, setFreight] = useState("");
  const [ewayNo, setEwayNo] = useState("");
  const [ewayDate, setEwayDate] = useState("");
  const [destination, setDestination] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [roundOff, setRoundOff] = useState("0");

  const [lines, setLines] = useState<Line[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);

  // ── Load list + lookups ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (sub === "pending") setPending(arr<PendingRow>(await apiGet(`${API}/pending?fromDate=${fromDate}&toDate=${toDate}`)));
      else setInvoices(arr<InvRow>(await apiGet(`${API}/list?fromDate=${fromDate}&toDate=${toDate}`)));
    } catch { showToast("error", "Failed to load"); }
    setLoading(false);
  }, [sub, fromDate, toDate, showToast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiGet<Lookups>(`${API}/lookups`).then(l => setLk(l as Lookups)).catch(() => {}); }, []);

  const resetForm = () => {
    setReverseCharge(false); setIsExport(false); setTax("intra"); setNarration(""); setRoundOff("0");
    setCurrencyCode(""); setCurrConv("1"); setOriginCountry("India"); setDestCountry(""); setLoadingPort(""); setDischargePort("");
    setDeliveryTerms(""); setPaymentTerms(""); setBankerID(0); setTransporterID(0); setVehicleNo(""); setFreight("");
    setEwayNo(""); setEwayDate(""); setDestination(""); setNetWeight(""); setGrossWeight(""); setCharges([]); setCreditDays(0);
    setInvoiceType(lk?.InvoiceTypes?.[0]?.InvoiceType ?? "");
  };

  // ── Create from a pending DN row ─────────────────────────────────────────────
  const createFrom = async (r: PendingRow) => {
    setEditMode(false); setEditId(0); resetForm();
    setClientName(r.ClientName ?? ""); setConsigneeName(r.ConsigneeName ?? "");
    setLedgerID(r.LedgerID ?? 0); setConsigneeID(r.ConsigneeLedgerID ?? 0); setSalesLedgerID(r.SalesLedgerID ?? 0);
    setVoucherDate(today());
    setLines([{
      FGTransactionID: r.FGTransactionID, FGTransactionDetailID: r.FGTransactionDetailID, JobBookingID: r.JobBookingID,
      ProductMasterID: r.ProductMasterID, ProductHSNID: r.ProductHSNID, ProductCode: r.ProductCode ?? "",
      JobName: r.JobName ?? "", OrderBookingID: r.OrderBookingID, OrderBookingDetailsID: r.OrderBookingDetailsID,
      HSNCode: r.HSNCode ?? "", quantity: String(r.TotalDeliveredQuantity ?? 0), rate: String(r.Rate || 0), discPct: "0",
      gstPct: n(r.GSTPercentage), cgstPct: n(r.CGSTPercentage), sgstPct: n(r.SGSTPercentage), igstPct: n(r.IGSTPercentage),
    }]);
    try { setVoucherNo(String(await apiGet(`${API}/noteno?prefix=INV`))); } catch { setVoucherNo(""); }
    try { const cd = n(await apiGet(`${API}/creditdays/${r.LedgerID}`)); setCreditDays(cd); if (cd > 0) setPaymentTerms(`${cd} days credit`); } catch {}
    setModalOpen(true);
  };

  // ── Edit a saved invoice ─────────────────────────────────────────────────────
  const openEdit = async (inv: InvRow) => {
    setEditMode(true); setEditId(inv.InvoiceTransactionID); resetForm();
    try {
      const mArr = arr<Record<string, unknown>>(await apiGet(`${API}/getmain/${inv.InvoiceTransactionID}`));
      const m = mArr[0] ?? {};
      setVoucherNo(String(m.VoucherNo ?? inv.VoucherNo ?? ""));
      setVoucherDate((String(m.VoucherDate ?? "")).match(/^\d{4}-\d{2}-\d{2}/) ? String(m.VoucherDate).slice(0, 10) : today());
      setClientName(String(m.ClientName ?? inv.ClientName ?? "")); setConsigneeName(String(m.ConsigneeName ?? ""));
      setLedgerID(n(m.LedgerID)); setConsigneeID(n(m.ConsigneeLedgerID)); setSalesLedgerID(n(m.SalesLedgerID));
      setInvoiceType(String(m.InvoiceType ?? "")); setReverseCharge(String(m.ReverseCharge) === "Y"); setIsExport(String(m.IsExport) === "Y");
      setCurrencyCode(String(m.CurrencyCode ?? "")); setCurrConv(String(m.CurrConversionValue ?? "1"));
      setOriginCountry(String(m.OriginCountry ?? "")); setDestCountry(String(m.DestinationCountry ?? ""));
      setLoadingPort(String(m.LoadingPort ?? "")); setDischargePort(String(m.DischargePort ?? ""));
      setDeliveryTerms(String(m.DeliveryTerms ?? "")); setPaymentTerms(String(m.PaymentTerms ?? "")); setBankerID(n(m.BankerID));
      setTransporterID(n(m.TransporterID)); setVehicleNo(String(m.VehicleNo ?? "")); setFreight(String(m.Freight ?? ""));
      setEwayNo(String(m.EWayBillNumber ?? "")); setDestination(String(m.Destination ?? ""));
      setNetWeight(String(m.NetWeight ?? "")); setGrossWeight(String(m.GrossWeight ?? "")); setRoundOff(String(m.RoundOffTax ?? "0"));
      setNarration(String(m.Narration ?? ""));

      const det = arr<Record<string, unknown>>(await apiGet(`${API}/get/${inv.InvoiceTransactionID}`));
      setLines(det.map(d => ({
        FGTransactionID: n(d.FGTransactionID), FGTransactionDetailID: n(d.FGTransactionDetailID), JobBookingID: n(d.JobBookingID),
        ProductMasterID: n(d.ProductMasterID), ProductHSNID: n(d.ProductHSNID), ProductCode: String(d.ProductCode ?? ""),
        JobName: String(d.JobName ?? ""), OrderBookingID: n(d.OrderBookingID), OrderBookingDetailsID: n(d.OrderBookingDetailsID),
        HSNCode: String(d.HSNCode ?? ""), quantity: String(d.Quantity ?? 0), rate: String(d.Rate ?? 0), discPct: String(d.DiscountPercentage ?? 0),
        gstPct: n(d.GSTPercentage), cgstPct: n(d.CGSTPercentage), sgstPct: n(d.SGSTPercentage), igstPct: n(d.IGSTPercentage),
      })));
      if (det.some(d => n(d.IGSTAmount) > 0)) setTax("inter");

      const ch = arr<Record<string, unknown>>(await apiGet(`${API}/getcharges/${inv.InvoiceTransactionID}`));
      setCharges(ch.map(c => ({ LedgerID: n(c.LedgerID), LedgerName: String(c.LedgerName ?? ""), ProductHSNID: n(c.ProductHSNID), amount: String(c.Amount ?? 0), gstPct: String(c.GSTPercentage ?? 0) })));
    } catch { showToast("error", "Failed to load invoice"); }
    setModalOpen(true);
  };

  // ── Totals (lines + charges + round off) ─────────────────────────────────────
  const t = lines.reduce((a, l) => { const c = lineCalc(l, tax); a.qty += n(l.quantity); a.basic += c.taxable; a.cgst += c.cgst; a.sgst += c.sgst; a.igst += c.igst; return a; },
    { qty: 0, basic: 0, cgst: 0, sgst: 0, igst: 0 });
  charges.forEach(c => { const cc = chargeCalc(c, tax); t.basic += cc.base; t.cgst += cc.cgst; t.sgst += cc.sgst; t.igst += cc.igst; });
  const totalTax = t.cgst + t.sgst + t.igst;
  const net = t.basic + totalTax + n(roundOff);
  const dueDate = creditDays > 0 ? addDays(voucherDate, creditDays) : "";

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (lines.length === 0) { showToast("error", "No lines to invoice"); return; }
    if (net <= 0) { showToast("error", "Enter rate to compute amount"); return; }
    setSaving(true);
    try {
      const payload = {
        Editflag: editMode, InvoiceTransactionID: editMode ? String(editId) : "",
        Main: {
          VoucherPrefix: "INV", VoucherDate: voucherDate,
          LedgerID: String(ledgerID), ConsigneeLedgerID: String(consigneeID), SalesLedgerID: String(salesLedgerID),
          TotalQuantity: String(t.qty), TotalBasicAmount: String(t.basic), TotalDiscountAmount: "0",
          TotalCGST: String(t.cgst), TotalSGST: String(t.sgst), TotalIGST: String(t.igst),
          TotalTax: String(totalTax), RoundOffTax: String(n(roundOff)), NetAmount: String(net), AmountInWords: amountInWords(net),
          InvoiceType: invoiceType, DocumentType: isExport ? "Export" : "Domestic", ReverseCharge: reverseCharge ? "Y" : "N",
          IsExport: isExport ? "Y" : "N", CurrencyCode: isExport ? currencyCode : "", CurrConversionValue: isExport ? String(n(currConv) || 1) : "1",
          OriginCountry: isExport ? originCountry : "", DestinationCountry: isExport ? destCountry : "",
          LoadingPort: isExport ? loadingPort : "", DischargePort: isExport ? dischargePort : "",
          DeliveryTerms: deliveryTerms, PaymentTerms: paymentTerms, BankerID: String(bankerID),
          TransporterID: String(transporterID), VehicleNo: vehicleNo, Freight: freight,
          EWayBillNumber: ewayNo, EWayBillDate: ewayDate || "", Destination: destination,
          NetWeight: String(n(netWeight)), GrossWeight: String(n(grossWeight)), OtherRemarks: "", Narration: narration,
        },
        Lines: lines.map(l => {
          const c = lineCalc(l, tax);
          return {
            FGTransactionID: String(l.FGTransactionID), FGTransactionDetailID: String(l.FGTransactionDetailID),
            JobBookingID: String(l.JobBookingID), ProductMasterID: String(l.ProductMasterID), ProductHSNID: String(l.ProductHSNID),
            JobName: l.JobName, ProductCode: l.ProductCode, OrderBookingID: String(l.OrderBookingID), OrderBookingDetailsID: String(l.OrderBookingDetailsID),
            Quantity: String(n(l.quantity)), RateType: "", Rate: String(n(l.rate)), GrossAmount: String(c.gross),
            DiscountPercentage: String(n(l.discPct)), DiscountAmount: String(c.disc), BasicAmount: String(c.taxable), TaxableAmount: String(c.taxable),
            GSTPercentage: String(l.gstPct), CGSTPercentage: String(tax === "intra" ? l.cgstPct : 0), SGSTPercentage: String(tax === "intra" ? l.sgstPct : 0),
            IGSTPercentage: String(tax === "inter" ? (l.igstPct || l.gstPct) : 0),
            CGSTAmount: String(c.cgst), SGSTAmount: String(c.sgst), IGSTAmount: String(c.igst), NetAmount: String(c.net),
          };
        }),
        Charges: charges.filter(c => c.LedgerID > 0).map(c => {
          const cc = chargeCalc(c, tax);
          return {
            LedgerID: String(c.LedgerID), ProductHSNID: String(c.ProductHSNID || 0), Amount: String(cc.base), GSTPercentage: String(n(c.gstPct)),
            CGSTPercentage: String(tax === "intra" ? n(c.gstPct) / 2 : 0), SGSTPercentage: String(tax === "intra" ? n(c.gstPct) / 2 : 0), IGSTPercentage: String(tax === "inter" ? n(c.gstPct) : 0),
            CGSTAmount: String(cc.cgst), SGSTAmount: String(cc.sgst), IGSTAmount: String(cc.igst), TotalAmount: String(cc.total), IsService: "Y",
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

  const printInv = async (inv: InvRow) => {
    try {
      const data = await apiGet<TaxInvoiceData>(`${API}/printdata/${inv.InvoiceTransactionID}`);
      if (!data || !data.Header) { showToast("error", "No invoice data"); return; }
      downloadTaxInvoice(data);
    } catch (e) { showToast("error", (e as Error).message); }
  };

  const setLine = (i: number, patch: Partial<Line>) => setLines(p => p.map((l, j) => j === i ? { ...l, ...patch } : l));
  const setCharge = (i: number, patch: Partial<Charge>) => setCharges(p => p.map((c, j) => j === i ? { ...c, ...patch } : c));
  const addCharge = () => setCharges(p => [...p, { LedgerID: 0, LedgerName: "", ProductHSNID: 0, amount: "0", gstPct: "0" }]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex gap-1 p-1 rounded-lg bg-gray-100 w-fit">
          {(["pending", "saved"] as const).map(x => (
            <button key={x} onClick={() => setSub(x)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${sub === x ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {x === "pending" ? "Pending for Invoice" : "Saved Invoices"}
            </button>
          ))}
        </div>
      </div>

      {sub === "pending" ? (
        <DataTable<PendingRow>
          data={pending}
          loading={loading}
          getRowId={r => `${r.FGTransactionID}-${r.JobBookingID}`}
          columns={[
            { key: "DeliveryNoteNo", header: "DN No", render: r => <span className="font-medium text-blue-700">{r.DeliveryNoteNo}</span> },
            { key: "DeliveryNoteDate", header: "Date" },
            { key: "ClientName", header: "Customer" },
            { key: "JobBookingNo", header: "Job No" },
            { key: "ProductCode", header: "Product", render: r => <span>{r.ProductCode || r.ProductMasterCode}</span> },
            { key: "HSNCode", header: "HSN" },
            { key: "TotalDeliveredQuantity", header: "Qty", render: r => <span>{n(r.TotalDeliveredQuantity).toLocaleString()}</span> },
            { key: "GSTPercentage", header: "GST%", render: r => <span>{n(r.GSTPercentage)}%</span> },
          ]}
          actions={r => (
            <Button variant="primary" size="sm" pill icon={<Plus size={13} />} onClick={() => createFrom(r)}>Create Invoice</Button>
          )}
        />
      ) : (
        <DataTable<InvRow>
          data={invoices}
          loading={loading}
          getRowId={r => String(r.InvoiceTransactionID)}
          columns={[
            { key: "VoucherNo", header: "Invoice No", render: r => <span className="font-medium text-blue-700">{r.VoucherNo}</span> },
            { key: "VoucherDate", header: "Date" },
            { key: "ClientName", header: "Customer" },
            { key: "TotalQuantity", header: "Qty", render: r => <span>{n(r.TotalQuantity).toLocaleString()}</span> },
            { key: "TotalBasicAmount", header: "Basic", render: r => <span>{money(n(r.TotalBasicAmount))}</span> },
            { key: "TotalTaxAmount", header: "Tax", render: r => <span>{money(n(r.TotalTaxAmount))}</span> },
            { key: "NetAmount", header: "Net Amount", render: r => <span className="font-semibold">{money(n(r.NetAmount))}</span> },
            { key: "IsCoaCreated", header: "COA", render: r => <span>{r.IsCoaCreated ? "✓" : "—"}</span> },
          ]}
          actions={r => (
            <div className="flex items-center gap-1 justify-end">
              <RowAction.Edit onClick={() => openEdit(r)} />
              <RowAction.Print onClick={() => printInv(r)} />
              <RowAction.Delete onClick={() => del(r)} />
            </div>
          )}
        />
      )}

      {/* create / edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? `Edit Invoice — ${voucherNo}` : "New Tax Invoice"} size="xl">
        <div className="space-y-4">
          {/* header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input label="Invoice No" value={voucherNo} readOnly />
            <Input label="Date" type="date" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} />
            <div>
              <label className={lbl}>Invoice Type</label>
              <select className={fld} value={invoiceType} onChange={e => setInvoiceType(e.target.value)}>
                <option value="">— Select —</option>
                {lk?.InvoiceTypes?.map(o => <option key={o.TypeID} value={o.InvoiceType}>{o.InvoiceType}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Sales Ledger</label>
              <select className={fld} value={salesLedgerID} onChange={e => setSalesLedgerID(n(e.target.value))}>
                <option value={0}>— Select —</option>
                {lk?.SalesLedgers?.map(o => <option key={o.LedgerID} value={o.LedgerID}>{o.LedgerName}</option>)}
              </select>
            </div>
            <Input label="Customer" value={clientName} readOnly />
            <Input label="Consignee" value={consigneeName} readOnly />
            <div className="flex items-end gap-4 col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={reverseCharge} onChange={e => setReverseCharge(e.target.checked)} /> Reverse Charge</label>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={isExport} onChange={e => setIsExport(e.target.checked)} /> Export Invoice</label>
              <div className="flex items-center gap-2">
                {(["intra", "inter"] as const).map(x => (
                  <button key={x} onClick={() => setTax(x)} className={`px-3 py-1 rounded-md text-xs font-semibold border ${tax === x ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"}`}>
                    {x === "intra" ? "CGST+SGST" : "IGST"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* export block */}
          {isExport && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div>
                <label className={lbl}>Currency</label>
                <select className={fld} value={currencyCode} onChange={e => { setCurrencyCode(e.target.value); const c = lk?.Currencies?.find(x => x.CurrencyCode === e.target.value); if (c) setCurrConv(String(c.ConversionValue ?? 1)); }}>
                  <option value="">— Select —</option>
                  {lk?.Currencies?.map(o => <option key={o.CurrencyID} value={o.CurrencyCode}>{o.CurrencyCode} — {o.CurrencyName}</option>)}
                </select>
              </div>
              <Input label="Conv. Rate (₹)" type="number" value={currConv} onChange={e => setCurrConv(e.target.value)} />
              <div>
                <label className={lbl}>Origin Country</label>
                <select className={fld} value={originCountry} onChange={e => setOriginCountry(e.target.value)}>
                  <option value="">—</option>{lk?.Countries?.map(o => <option key={o.Country} value={o.Country}>{o.Country}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Destination Country</label>
                <select className={fld} value={destCountry} onChange={e => setDestCountry(e.target.value)}>
                  <option value="">—</option>{lk?.Countries?.map(o => <option key={o.Country} value={o.Country}>{o.Country}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Loading Port</label>
                <select className={fld} value={loadingPort} onChange={e => setLoadingPort(e.target.value)}>
                  <option value="">—</option>{lk?.Ports?.map(o => <option key={o.PortID} value={o.PortName}>{o.PortName}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Discharge Port</label>
                <select className={fld} value={dischargePort} onChange={e => setDischargePort(e.target.value)}>
                  <option value="">—</option>{lk?.Ports?.map(o => <option key={o.PortID} value={o.PortName}>{o.PortName}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Banker</label>
                <select className={fld} value={bankerID} onChange={e => setBankerID(n(e.target.value))}>
                  <option value={0}>—</option>{lk?.Banks?.map(o => <option key={o.LedgerID} value={o.LedgerID}>{o.LedgerName}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* line grid */}
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50"><tr>{["Product", "HSN", "Qty", "Rate", "Disc%", "Taxable", tax === "intra" ? "CGST" : "IGST", tax === "intra" ? "SGST" : "", "Net"].filter(Boolean).map(h =>
                <th key={h} className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l, i) => {
                  const c = lineCalc(l, tax);
                  return (
                    <tr key={i}>
                      <td className="px-2 py-1.5">{l.ProductCode || l.JobName}</td>
                      <td className="px-2 py-1.5">{l.HSNCode}</td>
                      <td className="px-2 py-1.5 w-20"><input className={fld} type="number" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} /></td>
                      <td className="px-2 py-1.5 w-20"><input className={fld} type="number" value={l.rate} onChange={e => setLine(i, { rate: e.target.value })} /></td>
                      <td className="px-2 py-1.5 w-16"><input className={fld} type="number" value={l.discPct} onChange={e => setLine(i, { discPct: e.target.value })} /></td>
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

          {/* additional charges */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={lbl}>Additional Charges (freight / packing / insurance…)</span>
              <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={addCharge}>Add Charge</Button>
            </div>
            {charges.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50"><tr>{["Charge Ledger", "Amount", "GST%", tax === "intra" ? "CGST" : "IGST", tax === "intra" ? "SGST" : "", "Total", ""].filter(Boolean).map(h =>
                    <th key={h} className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {charges.map((c, i) => {
                      const cc = chargeCalc(c, tax);
                      return (
                        <tr key={i}>
                          <td className="px-2 py-1.5 w-56">
                            <select className={fld} value={c.LedgerID} onChange={e => { const id = n(e.target.value); const nm = lk?.ChargeLedgers?.find(x => x.LedgerID === id)?.LedgerName ?? ""; setCharge(i, { LedgerID: id, LedgerName: nm }); }}>
                              <option value={0}>— Select —</option>
                              {lk?.ChargeLedgers?.map(o => <option key={o.LedgerID} value={o.LedgerID}>{o.LedgerName}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 w-24"><input className={fld} type="number" value={c.amount} onChange={e => setCharge(i, { amount: e.target.value })} /></td>
                          <td className="px-2 py-1.5 w-16"><input className={fld} type="number" value={c.gstPct} onChange={e => setCharge(i, { gstPct: e.target.value })} /></td>
                          {tax === "intra" ? <>
                            <td className="px-2 py-1.5 text-right">{money(cc.cgst)}</td>
                            <td className="px-2 py-1.5 text-right">{money(cc.sgst)}</td>
                          </> : <td className="px-2 py-1.5 text-right">{money(cc.igst)}</td>}
                          <td className="px-2 py-1.5 text-right font-semibold">{money(cc.total)}</td>
                          <td className="px-2 py-1.5 text-right"><button onClick={() => setCharges(p => p.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700"><X size={15} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* transport */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div>
              <label className={lbl}>Transporter</label>
              <select className={fld} value={transporterID} onChange={e => setTransporterID(n(e.target.value))}>
                <option value={0}>— Select —</option>{lk?.Transporters?.map(o => <option key={o.LedgerID} value={o.LedgerID}>{o.LedgerName}</option>)}
              </select>
            </div>
            <Input label="Vehicle No" value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} />
            <Input label="E-Way Bill No" value={ewayNo} onChange={e => setEwayNo(e.target.value)} />
            <Input label="E-Way Date" type="date" value={ewayDate} onChange={e => setEwayDate(e.target.value)} />
            <Input label="Destination" value={destination} onChange={e => setDestination(e.target.value)} />
            <Input label="Net Weight" type="number" value={netWeight} onChange={e => setNetWeight(e.target.value)} />
            <Input label="Gross Weight" type="number" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} />
            <Input label="Delivery Terms" value={deliveryTerms} onChange={e => setDeliveryTerms(e.target.value)} />
            <Input label="Payment Terms" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} />
            {dueDate && <div><label className={lbl}>Due Date</label><div className="px-2.5 py-1.5 text-sm text-gray-700">{dueDate} <span className="text-gray-400">({creditDays}d)</span></div></div>}
          </div>

          {/* totals + narration */}
          <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div className="flex-1 w-full"><Textarea label="Narration" rows={2} value={narration} onChange={e => setNarration(e.target.value)} /></div>
            <div className="text-right text-sm space-y-0.5 min-w-64">
              <div className="flex justify-between gap-6"><span className="text-gray-500">Taxable</span><span>{money(t.basic)}</span></div>
              {tax === "intra" ? <>
                <div className="flex justify-between gap-6"><span className="text-gray-500">CGST</span><span>{money(t.cgst)}</span></div>
                <div className="flex justify-between gap-6"><span className="text-gray-500">SGST</span><span>{money(t.sgst)}</span></div>
              </> : <div className="flex justify-between gap-6"><span className="text-gray-500">IGST</span><span>{money(t.igst)}</span></div>}
              <div className="flex justify-between gap-6 items-center"><span className="text-gray-500">Round Off</span>
                <input className={`${fld} w-20 text-right`} type="number" value={roundOff} onChange={e => setRoundOff(e.target.value)} /></div>
              <div className="flex justify-between gap-6 font-bold text-base border-t pt-1"><span>Net</span><span>₹ {money(net)}</span></div>
              <div className="text-[11px] text-gray-400 italic max-w-64">{amountInWords(net)}</div>
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
