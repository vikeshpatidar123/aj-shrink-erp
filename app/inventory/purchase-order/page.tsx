"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Trash2, X, Search, List,
  RefreshCw, FileText, History, Printer,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { authHeaders, getSession } from "@/lib/auth";
import { Input, Select, Textarea } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { DataTable, Column } from "@/components/tables/DataTable";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { statusBadge } from "@/components/ui/Badge";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const CURRENCIES = ["INR", "USD", "EUR"];
const TRANSPORT_MODES = ["Road", "Rail", "Air", "Sea", "Courier"];
const CALCU_ON = ["Value", "Qty", "Weight", "Fixed"];
const PAYMENT_TERMS_OPTIONS = ["15 Days", "30 Days", "45 Days", "60 Days"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Supplier {
  LedgerID: number;
  LedgerName: string;
  SupState: string;
  StateTinNo: number;
  CompanyStateTinNo: number;
  CurrencyCode: string;
  GSTNo: string;
}

interface ContactPerson {
  ConcernPersonID: number;
  Name: string;
}

interface ReqRow {
  TransactionDetailID: number;
  TransactionID: number;
  VoucherNo: string;
  VoucherDate: string;
  ItemID: number;
  ItemGroupID: number;
  ItemGroupNameID: number;
  ItemGroupName: string;
  ItemSubGroupName: string;
  ItemCode: string;
  ItemName: string;
  ItemDescription: string | null;
  PurchaseQuantity: number;
  PurchaseQuantityPacks: number;
  QuantityPerPack: number;
  RequiredQuantity: number;
  PurchaseUnit: string;
  StockUnit: string;
  OrderUnit: string;
  PurchaseRate: number;
  HSNCode: string;
  ProductHSNID: number;
  ProductHSNName: string;
  GSTTaxPercentage: number;
  CGSTTaxPercentage: number;
  SGSTTaxPercentage: number;
  IGSTTaxPercentage: number;
  WtPerPacking: number;
  UnitPerPacking: number;
  Tolerance: number;
  ExpectedDeliveryDate: string;
  Narration: string;
  GSM?: number;
  SizeW?: number;
  JobName?: string | null;
}

type POLineStatus = "Pending" | "Approved" | "Cancelled" | "Closed";

interface POLineRow {
  TransactionID: number;
  TransactionDetailID: number;
  VoucherNo: string;
  VoucherDate: string;
  LedgerName: string;
  ItemCode: string;
  ItemGroupName: string;
  ItemSubGroupName: string;
  ItemName: string;
  PREVoucherNo: string | null;
  PurchaseQuantity: number;
  PurchaseUnit: string;
  PurchaseRate: number;
  NetAmount: number;
  ExpectedDeliveryDate: string;
  IsVoucherItemApproved: number;
  IsCancelled: number;
  IsCompleted: number;
}

interface POHeader {
  TransactionID: number;
  VoucherNo: string;
  VoucherDate: string;
  LedgerID: number;
  LedgerName: string;
  BasicAmount: number;
  GSTTaxAmount: number;
  NetAmount: number;
  CurrencyCode: string;
  ContactPersonID: number;
  IsVoucherItemApproved: number;
  Narration?: string;
  DeliveryAddress?: string;
  TermsOfPayment?: string;
  ModeOfTransport?: string;
  VoucherPrefix?: string;
  FYear?: string;
}

interface OverflowItem {
  _uid: number; // synthetic per-row key (GetOverFlowGrid can repeat ItemID across rows)
  ItemID: number;
  ItemGroupID: number;
  ItemGroupNameID: number;
  ItemSubGroupID: number;
  ItemGroupName: string;
  ItemSubGroupName: string;
  ItemCode: string;
  ItemName: string;
  ItemDescription: string | null;
  StockUnit: string;
  PurchaseUnit: string;
  PurchaseRate: number;
  BookedStock: number;
  AllocatedStock: number;
  PhysicalStock: number;
  HSNCode: string;
  ProductHSNID: number;
  ProductHSNName: string;
  GSTTaxPercentage: number;
  CGSTTaxPercentage: number;
  SGSTTaxPercentage: number;
  IGSTTaxPercentage: number;
  WtPerPacking: number;
  UnitPerPacking: number;
  Tolerance: number;
}

interface ChargeLedger {
  LedgerID: number;
  LedgerName: string;
  TaxPercentage: number;
  TaxType: string;
  GSTApplicable: string;
  GSTLedgerType: string;
  ProductHSNID: number;
  HSNCode: string;
  GSTTaxPercentage: number;
  CGSTTaxPercentage: number;
  SGSTTaxPercentage: number;
  IGSTTaxPercentage: number;
  IsService: string;
}

interface ItemRate {
  ItemID: number;
  PurchaseRate: number;
  QuantityTolerance: number;
}

interface POLine {
  lineKey: string;
  ItemID: number;
  ItemGroupID: number;
  ItemGroupNameID: number;
  ItemSubGroupID: number;
  ItemGroupName: string;
  ItemSubGroupName: string;
  ItemCode: string;
  ItemName: string;
  ItemDescription: string | null;
  RequisitionTransactionID: number;
  ReqQtyInPU: number;
  StockUnit: string;
  PurchaseUnit: string;
  WtPerPacking: number;
  UnitPerPacking: number;
  NoOfPacks: number;
  QtyPerPack: number;
  POQtyInPU: number;
  POQtyInSU: number;
  ItemNarration: string;
  Rate: number;
  ProductHSNID: number;
  HSNCode: string;
  GSTPercentage: number;
  CGSTPercentage: number;
  SGSTPercentage: number;
  IGSTPercentage: number;
  ExpectedDelivery: string;
  Tolerance: number;
  SupplierGrade: string;
  GrossAmount: number;
  DiscPct: number;
  DiscAmount: number;
  BasicAmount: number;
  TaxableAmount: number;
  CGSTAmount: number;
  SGSTAmount: number;
  IGSTAmount: number;
  NetAmount: number;
}

interface POCharge {
  chargeKey: string;
  LedgerID: number;
  LedgerName: string;
  TaxPercentage: number;
  TaxType: string;
  CalcOn: string;
  GSTApplicable: boolean;
  InAmount: boolean;
  IsService: string;
  ProductHSNID: number;
  HSNCode: string;
  GSTTaxPercentage: number;
  CGSTTaxPercentage: number;
  SGSTTaxPercentage: number;
  IGSTTaxPercentage: number;
  CGSTAmount: number;
  SGSTAmount: number;
  IGSTAmount: number;
  Amount: number;
  TotalAmount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().split("T")[0];
const toNum = (v: any) => parseFloat(v) || 0;

// Converts "DD-Mon-YYYY", "DD Mon YYYY", or ISO strings to "YYYY-MM-DD" for date inputs
const parseDateToISO = (s: string): string => {
  if (!s || s === "—") return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split("T")[0];
  const d = new Date(s.replace(/-/g, " "));
  return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
};
const fmtDate = (d: string) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};
const fmtAmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const escapeHtml = (v: any) =>
  String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const poLineStatus = (l: POLineRow): POLineStatus =>
  l.IsCancelled ? "Cancelled" : l.IsCompleted ? "Closed" : l.IsVoucherItemApproved ? "Approved" : "Pending";

const recalcLine = (line: POLine, sameState: boolean): POLine => {
  const gross = line.POQtyInPU * line.Rate;
  const discAmt = gross * line.DiscPct / 100;
  const basic = gross - discAmt;
  const cgst = sameState ? basic * line.CGSTPercentage / 100 : 0;
  const sgst = sameState ? basic * line.SGSTPercentage / 100 : 0;
  const igst = !sameState ? basic * line.IGSTPercentage / 100 : 0;
  const net = basic + cgst + sgst + igst;
  return { ...line, GrossAmount: gross, DiscAmount: discAmt, BasicAmount: basic, TaxableAmount: basic, CGSTAmount: cgst, SGSTAmount: sgst, IGSTAmount: igst, NetAmount: net };
};

async function apiFetch(url: string): Promise<any> {
  const res = await fetch(url, { headers: authHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try {
    const parsed = JSON.parse(text);
    // Backend wraps ConvertDataTableToJsonString result with Ok(), causing double-encoding.
    // If parsed result is a string, try parsing it once more.
    if (typeof parsed === "string") {
      try { return JSON.parse(parsed); } catch { return parsed; }
    }
    return parsed;
  } catch { return text; }
}

// Unwrap a JSON-quoted string returned by ASP.NET Ok("literal").
// Ok("Success") produces "\"Success\"" on the wire; this strips those outer quotes.
function unwrapOk(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('"') && t.endsWith('"')) {
    try { return JSON.parse(t) as string; } catch { /* fall through */ }
  }
  return t;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{title}</h3>
);


// ─── Main Component ───────────────────────────────────────────────────────────

export default function PurchaseOrderPage() {
  // ── View state ──
  const [view, setView] = useState<"list" | "form">("list");
  const [listTab, setListTab] = useState<"reqs" | "pos">("reqs");
  const [editTxnID, setEditTxnID] = useState<number | null>(null);
  const [editVoucherNo, setEditVoucherNo] = useState("");

  // ── Data state ──
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [reqs, setReqs] = useState<ReqRow[]>([]);
  const [pos, setPos] = useState<POHeader[]>([]);
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [overflowItems, setOverflowItems] = useState<OverflowItem[]>([]);
  const [chargeLedgers, setChargeLedgers] = useState<ChargeLedger[]>([]);
  const [itemRates, setItemRates] = useState<ItemRate[]>([]);
  const [supplierGrades, setSupplierGrades] = useState<string[]>([]);

  // ── Loading state ──
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [loadingPos, setLoadingPos] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Selection state (for creating PO from reqs) ──
  const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());

  // ── Form state ──
  const [poDate, setPoDate] = useState(todayISO());
  const [poNo, setPoNo] = useState("");
  const [supplierID, setSupplierID] = useState<number>(0);
  const [currency, setCurrency] = useState("INR");
  const [contactPersonID, setContactPersonID] = useState<number>(0);
  const [narration, setNarration] = useState("");
  const [modeOfTransport, setModeOfTransport] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [termsOfPayment, setTermsOfPayment] = useState("");
  const [lines, setLines] = useState<POLine[]>([]);
  const [charges, setCharges] = useState<POCharge[]>([]);

  // ── Picker state ──
  const [showPicker, setShowPicker] = useState(false);
  const [pickerGroup, setPickerGroup] = useState("All");
  const [showChargeMenu, setShowChargeMenu] = useState(false);
  // multi-select in item picker (tracked by synthetic _uid)
  const [pickerSel, setPickerSel] = useState<Set<number>>(new Set());

  // ── Password modal (for Update/Delete) ──
  const [pwModal, setPwModal] = useState<"update" | "delete" | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwRemark, setPwRemark] = useState("");

  // ── List filters ──
  const [posSearch, setPosSearch] = useState("");

  // ── Item-level PO list (for Created POs tab) ──
  const [poLines, setPoLines] = useState<POLineRow[]>([]);
  const [loadingPoLines, setLoadingPoLines] = useState(false);
  const [poStatusFilter, setPoStatusFilter] = useState<"All" | POLineStatus>("All");
  const [viewPo, setViewPo] = useState<{ header: POHeader; rows: POLineRow[] } | null>(null);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.LedgerID === supplierID) ?? null,
    [suppliers, supplierID]
  );
  const sameState = selectedSupplier
    ? selectedSupplier.StateTinNo === selectedSupplier.CompanyStateTinNo && selectedSupplier.StateTinNo !== 0
    : true;

  const pickerGroups = useMemo(() => {
    const gs = Array.from(new Set(overflowItems.map(i => i.ItemGroupName).filter(Boolean)));
    return ["All", ...gs];
  }, [overflowItems]);

  const filteredPickerItems = useMemo(() => {
    return overflowItems.filter(i => pickerGroup === "All" || i.ItemGroupName === pickerGroup);
  }, [overflowItems, pickerGroup]);

  const poStatusCounts = useMemo(() => {
    const c: Record<"All" | POLineStatus, number> = { All: poLines.length, Pending: 0, Approved: 0, Cancelled: 0, Closed: 0 };
    poLines.forEach(l => { const s = poLineStatus(l); c[s] = (c[s] ?? 0) + 1; });
    return c;
  }, [poLines]);

  const filteredPoLines = useMemo(() => {
    const s = posSearch.trim().toLowerCase();
    return poLines.filter(l =>
      (poStatusFilter === "All" || poLineStatus(l) === poStatusFilter) &&
      (!s || [l.VoucherNo, l.ItemCode, l.ItemName, l.LedgerName].some(v => (v ?? "").toLowerCase().includes(s)))
    );
  }, [poLines, poStatusFilter, posSearch]);

  // Totals
  const totalBasic = lines.reduce((s, l) => s + l.BasicAmount, 0);
  const totalDisc = lines.reduce((s, l) => s + l.DiscAmount, 0);
  const totalCGST = lines.reduce((s, l) => s + l.CGSTAmount, 0);
  const totalSGST = lines.reduce((s, l) => s + l.SGSTAmount, 0);
  const totalIGST = lines.reduce((s, l) => s + l.IGSTAmount, 0);
  const totalGST = totalCGST + totalSGST + totalIGST;
  const totalCharges = charges.reduce((s, c) => s + c.Amount, 0);
  // BasicAmount is already AfterDisAmt (gross - disc), so don't subtract disc again
  const netAmount = totalBasic + totalGST + totalCharges;

  // ─── API loaders ───────────────────────────────────────────────────────────

  const fetchSuppliers = useCallback(async () => {
    try {
      const data = await apiFetch(`${BASE_URL}/api/PurchaseOrderAJ/GetSuppliers`);
      setSuppliers(Array.isArray(data) ? data : []);
    } catch { setSuppliers([]); }
  }, []);

  const fetchReqs = useCallback(async () => {
    setLoadingReqs(true);
    try {
      const data = await apiFetch(`${BASE_URL}/api/PurchaseOrderAJ/GetList?radioValue=Pending+Requisitions`);
      setReqs(Array.isArray(data) ? data : []);
    } catch { setReqs([]); }
    finally { setLoadingReqs(false); }
  }, []);

  const fetchPos = useCallback(async () => {
    setLoadingPos(true);
    try {
      const data = await apiFetch(
        `${BASE_URL}/api/PurchaseOrderAJ/ProcessList?fromDateValue=2000-01-01&toDateValue=2099-12-31&detail=False`
      );
      setPos(Array.isArray(data) ? data : []);
    } catch { setPos([]); }
    finally { setLoadingPos(false); }
  }, []);

  // Item-level rows for the "Created POs" tab — same data source, detail=True gives
  // one row per line (Item Code/Group/SubGroup/Name + PR No + real Status flags).
  const fetchPoLines = useCallback(async () => {
    setLoadingPoLines(true);
    try {
      const data = await apiFetch(
        `${BASE_URL}/api/PurchaseOrderAJ/ProcessList?fromDateValue=2000-01-01&toDateValue=2099-12-31&detail=True`
      );
      setPoLines(Array.isArray(data) ? data : []);
    } catch { setPoLines([]); }
    finally { setLoadingPoLines(false); }
  }, []);

  const cancelPoLine = useCallback(async (line: POLineRow) => {
    if (!window.confirm(`Cancel line "${line.ItemName || line.ItemCode}"?\nThis will mark it Cancelled.`)) return;
    try {
      const res = await fetch(`${BASE_URL}/api/PurchaseOrderAJ/CancelLine`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ transactionDetailId: line.TransactionDetailID }),
      });
      const text = unwrapOk(await res.text());
      if (text === "TransactionUsed") { alert("Cannot cancel — a GRN has already received against this line."); return; }
      if (text.startsWith("Error")) { alert("Cancel failed: " + text); return; }
      await Promise.all([fetchPos(), fetchPoLines()]);
    } catch (e: any) { alert("Cancel failed: " + e.message); }
  }, [fetchPos, fetchPoLines]);

  const openViewPo = useCallback((header: POHeader) => {
    setViewPo({ header, rows: poLines.filter(l => l.TransactionID === header.TransactionID) });
  }, [poLines]);

  const printPo = useCallback((header: POHeader) => {
    const rows = poLines.filter(l => l.TransactionID === header.TransactionID);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { alert("Popup blocked. Allow popups to print."); return; }
    const rowsHtml = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.ItemCode)}</td>
        <td>${escapeHtml(r.ItemName)}</td>
        <td style="text-align:right">${toNum(r.PurchaseQuantity).toLocaleString()}</td>
        <td>${escapeHtml(r.PurchaseUnit)}</td>
        <td style="text-align:right">${fmtAmt(toNum(r.PurchaseRate))}</td>
        <td style="text-align:right">${fmtAmt(toNum(r.NetAmount))}</td>
      </tr>`).join("");
    win.document.write(`<!doctype html><html><head><title>${escapeHtml(header.VoucherNo)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
        h2{margin:0 0 4px} p{margin:0 0 16px;color:#555;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left} th{background:#f3f4f6}
      </style></head><body>
      <h2>Purchase Order — ${escapeHtml(header.VoucherNo)}</h2>
      <p>Supplier: ${escapeHtml(header.LedgerName)} &nbsp;|&nbsp; Date: ${escapeHtml(fmtDate(header.VoucherDate))} &nbsp;|&nbsp; Net Amount: ₹${fmtAmt(toNum(header.NetAmount))}</p>
      <table><thead><tr><th>Item Code</th><th>Item Name</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }, [poLines]);

  const fetchContacts = useCallback(async (ledgerId: number) => {
    if (!ledgerId) { setContacts([]); return; }
    try {
      const data = await apiFetch(`${BASE_URL}/api/PurchaseOrderAJ/GetContactPerson?ledgerId=${ledgerId}`);
      setContacts(Array.isArray(data) ? data : []);
    } catch { setContacts([]); }
  }, []);

  const fetchOverflowItems = useCallback(async (ledgerId = 0) => {
    try {
      const url = ledgerId
        ? `${BASE_URL}/api/PurchaseOrderAJ/GetOverFlowGrid?selSupplierName=${ledgerId}`
        : `${BASE_URL}/api/PurchaseOrderAJ/GetOverFlowGrid`;
      const data = await apiFetch(url);
      setOverflowItems((Array.isArray(data) ? data : []).map((it: OverflowItem, i: number) => ({ ...it, _uid: i })));
    } catch { setOverflowItems([]); }
  }, []);

  const fetchChargeLedgers = useCallback(async (purchaseType = "") => {
    try {
      const data = await apiFetch(
        `${BASE_URL}/api/PurchaseOrderAJ/GetTaxLedgers?purchaseType=${purchaseType}`
      );
      setChargeLedgers(Array.isArray(data) ? data : []);
    } catch { setChargeLedgers([]); }
  }, []);

  const fetchItemRates = useCallback(async (ledgerId: number) => {
    if (!ledgerId) { setItemRates([]); return; }
    try {
      const data = await apiFetch(`${BASE_URL}/api/PurchaseOrderAJ/GetItemRate?ledgerId=${ledgerId}`);
      setItemRates(Array.isArray(data) ? data : []);
    } catch { setItemRates([]); }
  }, []);

  const fetchPaymentTerms = useCallback(async (ledgerId: number) => {
    if (!ledgerId) return;
    try {
      const data = await apiFetch(`${BASE_URL}/api/PurchaseOrderAJ/GetSupplierPaymentTerms?ledgerId=${ledgerId}`);
      if (typeof data === "string" && data) setTermsOfPayment(data);
    } catch { /* ignore */ }
  }, []);

  const fetchSupplierGrades = useCallback(async (ledgerId: number) => {
    if (!ledgerId) { setSupplierGrades([]); return; }
    try {
      const data = await apiFetch(`${BASE_URL}/api/FieldMasterAJ/GetSupplierGrades?ledgerID=${ledgerId}`);
      setSupplierGrades(Array.isArray(data) ? data : []);
    } catch { setSupplierGrades([]); }
  }, []);

  const fetchPONo = useCallback(async () => {
    try {
      const data = await apiFetch(`${BASE_URL}/api/PurchaseOrderAJ/GetPONo?prefix=PO&purchaseOrderVoucherId=-11`);
      setPoNo(typeof data === "string" ? data : "");
    } catch { setPoNo(""); }
  }, []);

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchSuppliers();
    fetchReqs();
    fetchPos();
    fetchPoLines();
  }, []);

  // ─── Form reset ────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setPoDate(todayISO());
    setPoNo("");
    setSupplierID(0);
    setCurrency("INR");
    setContactPersonID(0);
    setNarration("");
    setModeOfTransport("");
    setDeliveryAddress("");
    setTermsOfPayment("");
    setLines([]);
    setCharges([]);
    setContacts([]);
    setSupplierGrades([]);
    setEditTxnID(null);
    setEditVoucherNo("");
  }, []);

  // ─── Supplier change ───────────────────────────────────────────────────────

  const handleSupplierChange = useCallback(async (ledgerId: number) => {
    setSupplierID(ledgerId);
    setContactPersonID(0);
    if (ledgerId) {
      await Promise.all([
        fetchContacts(ledgerId),
        fetchOverflowItems(ledgerId),
        fetchItemRates(ledgerId),
        fetchPaymentTerms(ledgerId),
        fetchSupplierGrades(ledgerId),
      ]);
      const sup = suppliers.find(s => s.LedgerID === ledgerId);
      if (sup?.CurrencyCode) setCurrency(sup.CurrencyCode);
    } else {
      setContacts([]);
      setItemRates([]);
      setSupplierGrades([]);
      fetchOverflowItems(0);
    }
  }, [suppliers, fetchContacts, fetchOverflowItems, fetchItemRates, fetchPaymentTerms, fetchSupplierGrades]);

  // Apply supplier-wise rates to existing lines when supplier changes
  useEffect(() => {
    if (!itemRates.length || !lines.length) return;
    setLines(prev => prev.map(l => {
      const rate = itemRates.find(r => r.ItemID === l.ItemID);
      if (!rate) return l;
      const tolerance = rate.QuantityTolerance > 0 ? rate.QuantityTolerance : l.Tolerance;
      return recalcLine({ ...l, Rate: rate.PurchaseRate, Tolerance: tolerance }, sameState);
    }));
  }, [itemRates]);

  // Recalc GST type when supplier changes
  useEffect(() => {
    if (!lines.length) return;
    setLines(prev => prev.map(l => recalcLine(l, sameState)));
  }, [sameState]);

  // Load charge ledgers whenever the form is open and the supplier's GST state is known
  // (everything now renders in one continuous view, so there's no separate "terms tab" to enter).
  useEffect(() => {
    if (view === "form") fetchChargeLedgers(sameState ? "IntraState" : "InterState");
  }, [view, sameState, fetchChargeLedgers]);

  // ─── Open New ──────────────────────────────────────────────────────────────

  const openNew = useCallback(async () => {
    resetForm();
    await Promise.all([fetchPONo(), fetchOverflowItems(0)]);
    setView("form");
  }, [resetForm, fetchPONo, fetchOverflowItems]);

  // ─── Open from selected requisitions ──────────────────────────────────────

  const openFromSelectedReqs = useCallback(async () => {
    if (selectedReqIds.size === 0) {
      alert("Select at least one requisition item.");
      return;
    }
    resetForm();
    await fetchPONo();

    // Build the unique key: TransactionID-TransactionDetailID
    const selectedRows = reqs.filter(r =>
      selectedReqIds.has(`${r.TransactionID}-${r.TransactionDetailID}`)
    );

    const newLines: POLine[] = selectedRows.map((r, idx) => {
      const packs = toNum(r.PurchaseQuantityPacks);
      const qpp = toNum(r.QuantityPerPack);
      const poQty = toNum(r.PurchaseQuantity);
      return recalcLine({
        lineKey: `req-${r.TransactionDetailID}-${idx}`,
        ItemID: r.ItemID,
        ItemGroupID: r.ItemGroupID,
        ItemGroupNameID: toNum((r as any).ItemGroupNameID),
        ItemSubGroupID: toNum((r as any).ItemSubGroupID),
        ItemGroupName: r.ItemGroupName ?? "",
        ItemSubGroupName: r.ItemSubGroupName ?? "",
        ItemCode: r.ItemCode ?? "",
        ItemName: r.ItemName ?? "",
        ItemDescription: r.ItemDescription ?? null,
        ItemNarration: r.Narration ?? "",
        RequisitionTransactionID: r.TransactionID,
        ReqQtyInPU: poQty,
        StockUnit: r.StockUnit ?? r.OrderUnit ?? "",
        PurchaseUnit: r.PurchaseUnit ?? "",
        WtPerPacking: toNum(r.WtPerPacking),
        UnitPerPacking: toNum(r.UnitPerPacking),
        NoOfPacks: packs,
        QtyPerPack: qpp,
        POQtyInPU: poQty,
        POQtyInSU: poQty,
        Rate: toNum(r.PurchaseRate),
        ProductHSNID: toNum(r.ProductHSNID),
        HSNCode: r.HSNCode ?? "",
        GSTPercentage: toNum(r.GSTTaxPercentage),
        CGSTPercentage: toNum(r.CGSTTaxPercentage),
        SGSTPercentage: toNum(r.SGSTTaxPercentage),
        IGSTPercentage: toNum(r.IGSTTaxPercentage),
        ExpectedDelivery: parseDateToISO(r.ExpectedDeliveryDate ?? ""),
        Tolerance: toNum(r.Tolerance),
        SupplierGrade: "",
        GrossAmount: 0, DiscPct: 0, DiscAmount: 0,
        BasicAmount: 0, TaxableAmount: 0,
        CGSTAmount: 0, SGSTAmount: 0, IGSTAmount: 0, NetAmount: 0,
      }, true /* default same state until supplier chosen */);
    });

    setLines(newLines);
    setSelectedReqIds(new Set());
    setView("form");
    await fetchOverflowItems(0);
  }, [selectedReqIds, reqs, resetForm, fetchPONo, fetchOverflowItems]);

  // ─── Open Edit ─────────────────────────────────────────────────────────────

  const openEdit = useCallback(async (po: POHeader) => {
    resetForm();
    setFormLoading(true);
    try {
      const rows: any[] = await apiFetch(
        `${BASE_URL}/api/PurchaseOrderAJ/RetrieveData?transactionId=${po.TransactionID}`
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        alert("No data found for this Purchase Order.");
        return;
      }
      if (rows[0]?.ErrMsg) {
        alert("Failed to load PO: " + rows[0].ErrMsg);
        return;
      }

      setEditTxnID(po.TransactionID);
      setEditVoucherNo(po.VoucherNo ?? "");
      setPoNo(po.VoucherNo ?? "");

      // Header info from PO list row (po) and first detail row
      const first = rows[0];
      setPoDate(po.VoucherDate ? parseDateToISO(po.VoucherDate) || todayISO() : todayISO());
      setSupplierID(toNum(first.LedgerID));
      setCurrency(po.CurrencyCode ?? "INR");
      setContactPersonID(toNum(po.ContactPersonID));
      setNarration(first.Narration ?? "");
      setDeliveryAddress(po.DeliveryAddress ?? "");
      setTermsOfPayment(po.TermsOfPayment ?? "");
      setModeOfTransport(po.ModeOfTransport ?? "");

      // Fetch supplier-related data
      if (toNum(first.LedgerID)) {
        await Promise.all([
          fetchContacts(toNum(first.LedgerID)),
          fetchOverflowItems(toNum(first.LedgerID)),
          fetchItemRates(toNum(first.LedgerID)),
          fetchSupplierGrades(toNum(first.LedgerID)),
        ]);
      } else {
        await fetchOverflowItems(0);
      }

      const sup = suppliers.find(s => s.LedgerID === toNum(first.LedgerID));
      const ss = sup
        ? sup.StateTinNo === sup.CompanyStateTinNo && sup.StateTinNo !== 0
        : true;

      // Deduplicate by TransID in case backend returns multiple rows per line
      const seen = new Set<number>();
      const uniqueRows = rows.filter((r: any) => {
        if (seen.has(r.TransID)) return false;
        seen.add(r.TransID);
        return true;
      });

      const ls: POLine[] = uniqueRows.map((r: any, idx: number) => {
        const poQty = toNum(r.PurchaseQuantity);
        const packs = toNum(r.RequiredNoOfPacks);
        const qpp = toNum(r.QuantityPerPack);
        return {
          lineKey: `e${r.ItemID}-${idx}`,
          ItemID: toNum(r.ItemID),
          ItemGroupID: toNum(r.ItemGroupID),
          ItemGroupNameID: toNum(r.ItemGroupNameID),
          ItemSubGroupID: toNum(r.ItemSubGroupID),
          ItemGroupName: r.ItemGroupName ?? "",
          ItemSubGroupName: r.ItemSubGroupName ?? "",
          ItemCode: r.ItemCode ?? "",
          ItemName: r.ItemName ?? "",
          ItemDescription: r.ItemDescription ?? null,
          ItemNarration: r.ItemNarration ?? "",
          RequisitionTransactionID: toNum(r.RequisitionTransactionID),
          ReqQtyInPU: toNum(r.TotalRequiredQuantity),
          StockUnit: r.PurchaseStockUnit ?? "",
          PurchaseUnit: r.PurchaseUnit ?? "",
          WtPerPacking: toNum(r.WtPerPacking),
          UnitPerPacking: toNum(r.UnitPerPacking),
          NoOfPacks: packs,
          QtyPerPack: qpp,
          POQtyInPU: poQty,
          POQtyInSU: toNum(r.TotalRequiredQuantity),
          Rate: toNum(r.PurchaseRate),
          ProductHSNID: toNum(r.ProductHSNID),
          HSNCode: r.HSNCode ?? "",
          GSTPercentage: toNum(r.GSTTaxPercentage),
          CGSTPercentage: toNum(r.CGSTTaxPercentage),
          SGSTPercentage: toNum(r.SGSTTaxPercentage),
          IGSTPercentage: toNum(r.IGSTTaxPercentage),
          ExpectedDelivery: parseDateToISO(r.ExpectedDeliveryDate ?? ""),
          Tolerance: toNum(r.Tolerance),
          SupplierGrade: r.GradesOfSupplier ?? "",
          GrossAmount: toNum(r.BasicAmount),
          DiscPct: toNum(r.Disc),
          DiscAmount: toNum(r.DiscountAmount),
          BasicAmount: toNum(r.AfterDisAmt),
          TaxableAmount: toNum(r.TaxableAmount),
          CGSTAmount: toNum(r.CGSTAmt),
          SGSTAmount: toNum(r.SGSTAmt),
          IGSTAmount: toNum(r.IGSTAmt),
          NetAmount: toNum(r.TotalAmount),
        };
      });

      setLines(ls);

      // Load tax/charges
      try {
        const taxRows: any[] = await apiFetch(`${BASE_URL}/api/PurchaseOrderAJ/RetrieveTaxCharges?transactionId=${po.TransactionID}`);
        if (Array.isArray(taxRows) && taxRows.length > 0 && !taxRows[0]?.ErrMsg) {
          setCharges(taxRows.map((t: any, i: number) => ({
            chargeKey: `ec-${t.LedgerID}-${i}`,
            LedgerID: toNum(t.LedgerID),
            LedgerName: t.LedgerName ?? "",
            TaxPercentage: toNum(t.TaxRatePer),
            TaxType: t.TaxType ?? "",
            CalcOn: t.CalculateON ?? "Value",
            GSTApplicable: toNum(t.GSTApplicable) === 1,
            InAmount: toNum(t.InAmount) === 1,
            IsService: t.IsService ?? "No",
            ProductHSNID: toNum(t.ProductHSNID),
            HSNCode: t.HSNCode ?? "",
            GSTTaxPercentage: toNum(t.GSTTaxPercentage),
            CGSTTaxPercentage: toNum(t.CGSTTaxPercentage),
            SGSTTaxPercentage: toNum(t.SGSTTaxPercentage),
            IGSTTaxPercentage: toNum(t.IGSTTaxPercentage),
            CGSTAmount: toNum(t.CGSTAmount),
            SGSTAmount: toNum(t.SGSTAmount),
            IGSTAmount: toNum(t.IGSTAmount),
            Amount: toNum(t.ChargesAmount),
            TotalAmount: toNum(t.TotalAmount),
          })));
        }
      } catch { /* charges remain empty if API fails */ }

      setView("form");
      } catch (e: any) {
      alert("Failed to load PO: " + e.message);
    } finally {
      setFormLoading(false);
    }
  }, [resetForm, fetchContacts, fetchOverflowItems, fetchItemRates, suppliers]);

  // ─── Line operations ───────────────────────────────────────────────────────

  // Build a PO line from a picker item (shared by multi-select add).
  const buildLineFromItem = useCallback((item: OverflowItem, idx: number): POLine => {
    const rate = itemRates.find(r => r.ItemID === item.ItemID);
    return recalcLine({
      lineKey: `pick-${item.ItemID}-${idx}-${Date.now()}`,
      ItemID: item.ItemID,
      ItemGroupID: item.ItemGroupID,
      ItemGroupNameID: toNum(item.ItemGroupNameID),
      ItemSubGroupID: toNum(item.ItemSubGroupID),
      ItemGroupName: item.ItemGroupName ?? "",
      ItemSubGroupName: item.ItemSubGroupName ?? "",
      ItemCode: item.ItemCode ?? "",
      ItemName: item.ItemName ?? "",
      ItemDescription: item.ItemDescription ?? null,
      ItemNarration: "",
      RequisitionTransactionID: 0,
      ReqQtyInPU: 0,
      StockUnit: item.StockUnit ?? "",
      PurchaseUnit: item.PurchaseUnit ?? "",
      WtPerPacking: toNum(item.WtPerPacking),
      UnitPerPacking: toNum(item.UnitPerPacking),
      NoOfPacks: 0, QtyPerPack: 0, POQtyInPU: 0, POQtyInSU: 0,
      Rate: rate?.PurchaseRate ?? toNum(item.PurchaseRate),
      ProductHSNID: toNum(item.ProductHSNID),
      HSNCode: item.HSNCode ?? "",
      GSTPercentage: toNum(item.GSTTaxPercentage),
      CGSTPercentage: toNum(item.CGSTTaxPercentage),
      SGSTPercentage: toNum(item.SGSTTaxPercentage),
      IGSTPercentage: toNum(item.IGSTTaxPercentage),
      ExpectedDelivery: "", Tolerance: rate?.QuantityTolerance ?? toNum(item.Tolerance),
      SupplierGrade: "",
      GrossAmount: 0, DiscPct: 0, DiscAmount: 0, BasicAmount: 0,
      TaxableAmount: 0, CGSTAmount: 0, SGSTAmount: 0, IGSTAmount: 0, NetAmount: 0,
    }, sameState);
  }, [sameState, itemRates]);

  const togglePickerSel = (uid: number) =>
    setPickerSel(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });

  // Picker rows (by _uid) still addable — not already present in the grid.
  const pickerAddableIds = useMemo(
    () => filteredPickerItems.filter(i => !lines.some(l => l.ItemID === i.ItemID)).map(i => i._uid),
    [filteredPickerItems, lines]
  );
  const allPickerSelected = pickerAddableIds.length > 0 && pickerAddableIds.every(id => pickerSel.has(id));

  const toggleAllPicker = () =>
    setPickerSel(prev => {
      const allSelected = pickerAddableIds.length > 0 && pickerAddableIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) pickerAddableIds.forEach(id => next.delete(id));
      else pickerAddableIds.forEach(id => next.add(id));
      return next;
    });

  // Add every selected (and not-already-present) picker item at once.
  // Selection is tracked by _uid; still dedupe by ItemID so an item is never added twice.
  const addSelectedFromPicker = () => {
    const seen = new Set<number>();
    const toAdd = overflowItems.filter(i => {
      if (!pickerSel.has(i._uid)) return false;
      if (lines.some(l => l.ItemID === i.ItemID)) return false;
      if (seen.has(i.ItemID)) return false;
      seen.add(i.ItemID);
      return true;
    });
    if (!toAdd.length) { alert("No items selected."); return; }
    setLines(prev => [...prev, ...toAdd.map((it, i) => buildLineFromItem(it, prev.length + i))]);
    setShowPicker(false);
    setPickerGroup("All");
    setPickerSel(new Set());
  };

  const updateLineNum = useCallback((key: string, field: keyof POLine, value: number) => {
    setLines(prev => prev.map(l => {
      if (l.lineKey !== key) return l;
      let updated = { ...l, [field]: value };
      if (field === "NoOfPacks" || field === "QtyPerPack") {
        const packs = field === "NoOfPacks" ? value : l.NoOfPacks;
        const qpp = field === "QtyPerPack" ? value : l.QtyPerPack;
        updated.POQtyInPU = packs * qpp || l.POQtyInPU;
        updated.POQtyInSU = packs * qpp || l.POQtyInSU;
      } else if (field === "POQtyInPU") {
        updated.POQtyInSU = value;
      }
      return recalcLine(updated, sameState);
    }));
  }, [sameState]);

  const updateLineStr = useCallback((key: string, field: keyof POLine, value: string) => {
    setLines(prev => prev.map(l => l.lineKey !== key ? l : { ...l, [field]: value }));
  }, []);

  const removeLine = useCallback((key: string) =>
    setLines(prev => prev.filter(l => l.lineKey !== key)), []);

  // ─── Charge operations ─────────────────────────────────────────────────────

  const addCharge = useCallback((cl: ChargeLedger) => {
    setCharges(prev => [...prev, {
      chargeKey: `c-${cl.LedgerID}-${Date.now()}`,
      LedgerID: cl.LedgerID,
      LedgerName: cl.LedgerName,
      TaxPercentage: toNum(cl.TaxPercentage),
      TaxType: cl.TaxType ?? "",
      CalcOn: "Value",
      GSTApplicable: cl.GSTApplicable === "True",
      InAmount: false,
      IsService: cl.IsService ?? "No",
      ProductHSNID: toNum(cl.ProductHSNID),
      HSNCode: cl.HSNCode ?? "",
      GSTTaxPercentage: toNum(cl.GSTTaxPercentage),
      CGSTTaxPercentage: toNum(cl.CGSTTaxPercentage),
      SGSTTaxPercentage: toNum(cl.SGSTTaxPercentage),
      IGSTTaxPercentage: toNum(cl.IGSTTaxPercentage),
      CGSTAmount: 0, SGSTAmount: 0, IGSTAmount: 0,
      Amount: 0, TotalAmount: 0,
    }]);
    setShowChargeMenu(false);
  }, []);

  const updateCharge = useCallback((key: string, patch: Partial<POCharge>) =>
    setCharges(prev => prev.map(c => c.chargeKey !== key ? c : { ...c, ...patch })), []);

  const removeCharge = useCallback((key: string) =>
    setCharges(prev => prev.filter(c => c.chargeKey !== key)), []);

  // ─── Save ──────────────────────────────────────────────────────────────────

  const validateForm = useCallback((): string | null => {
    if (!supplierID) return "Please select a supplier.";
    if (lines.length === 0) return "Add at least one item to the PO.";
    if (!modeOfTransport) return "Please select Mode of Transport (in Tax & Terms tab).";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.POQtyInPU <= 0) return `Item ${i + 1} (${l.ItemCode}): Purchase quantity must be greater than 0.`;
      if (l.Rate <= 0) return `Item ${i + 1} (${l.ItemCode}): Rate must be greater than 0.`;
      if (l.TaxableAmount <= 0) return `Item ${i + 1} (${l.ItemCode}): Taxable amount is 0. Check quantity and rate.`;
      if (!l.ExpectedDelivery) return `Item ${i + 1} (${l.ItemCode}): Expected Delivery Date is required.`;
    }
    return null;
  }, [supplierID, lines, modeOfTransport]);

  const doSave = useCallback(async () => {
    const err = validateForm();
    if (err) { alert(err); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      const res = await fetch(`${BASE_URL}/api/PurchaseOrderAJ/Save`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const text = unwrapOk(await res.text());
      if (text.startsWith("Success|")) {
        const [, , newPoNo] = text.split("|");
        alert(`Purchase Order ${newPoNo} saved successfully.`);
        await Promise.all([fetchReqs(), fetchPos()]);
        setView("list");
        setListTab("pos");
      } else if (text.includes("not authorized")) {
        alert(text);
      } else {
        alert("Save failed: " + text);
      }
    } catch (e: any) {
      alert("Save error: " + e.message);
    } finally {
      setSaving(false);
    }
  }, [supplierID, lines, charges, poDate, currency, contactPersonID, narration,
      modeOfTransport, deliveryAddress, termsOfPayment, netAmount, totalGST, totalCharges,
      validateForm, fetchReqs, fetchPos, suppliers]);

  // ─── Update (needs password) ───────────────────────────────────────────────

  const doUpdate = useCallback(async (password: string, remark: string) => {
    const session = getSession();
    if (!session) { alert("Session expired."); return; }
    const err = validateForm();
    if (err) { alert(err); return; }
    setSaving(true);
    try {
      const payload = {
        ...buildPayload(),
        transactionId: String(editTxnID),
        voucherNo: editVoucherNo,
        ValidateUser: { userName: session.userName, password, transactionRemark: remark },
      };
      const res = await fetch(`${BASE_URL}/api/PurchaseOrderAJ/Update`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const text = unwrapOk(await res.text());
      if (text === "Success") {
        alert("Purchase Order updated successfully.");
        await Promise.all([fetchReqs(), fetchPos()]);
        setView("list");
        setListTab("pos");
      } else if (text === "TransactionUsed") {
        alert("This PO is already used in a GRN and cannot be updated.");
      } else if (text === "PurchaseOrderApproved") {
        alert("This PO has approved items and cannot be updated.");
      } else {
        alert("Update failed: " + text);
      }
    } catch (e: any) {
      alert("Update error: " + e.message);
    } finally {
      setSaving(false);
      setPwModal(null);
    }
  }, [editTxnID, editVoucherNo, supplierID, lines, charges, poDate, currency,
      contactPersonID, narration, modeOfTransport, deliveryAddress, termsOfPayment,
      netAmount, totalGST, totalCharges, validateForm, fetchReqs, fetchPos, suppliers]);

  // ─── Delete ────────────────────────────────────────────────────────────────

  const doDelete = useCallback(async (password: string, remark: string) => {
    const session = getSession();
    if (!session) { alert("Session expired."); return; }
    setDeleting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/PurchaseOrderAJ/Delete`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          transactionId: String(editTxnID),
          ValidateUser: { userName: session.userName, password, transactionRemark: remark },
        }),
      });
      const text = unwrapOk(await res.text());
      if (text === "Success") {
        alert("Purchase Order deleted successfully.");
        await Promise.all([fetchReqs(), fetchPos()]);
        setView("list");
        setListTab("pos");
      } else if (text === "InvalidUser") {
        alert("Invalid password. Please try again.");
      } else if (text === "TransactionUsed") {
        alert("This PO is linked to a GRN and cannot be deleted.");
      } else if (text === "PurchaseOrderApproved") {
        alert("This PO has approved items and cannot be deleted.");
      } else {
        alert(text);
      }
    } catch (e: any) {
      alert("Delete error: " + e.message);
    } finally {
      setDeleting(false);
      setPwModal(null);
    }
  }, [editTxnID]);

  // ─── Build payload ─────────────────────────────────────────────────────────

  const buildPayload = useCallback(() => {
    const afterDiscTotal = lines.reduce((s, l) => s + l.BasicAmount, 0);
    const cgstTotal = lines.reduce((s, l) => s + l.CGSTAmount, 0);
    const sgstTotal = lines.reduce((s, l) => s + l.SGSTAmount, 0);
    const igstTotal = lines.reduce((s, l) => s + l.IGSTAmount, 0);
    const gstTotal = cgstTotal + sgstTotal + igstTotal;
    const chargesTotal = charges.reduce((s, c) => s + c.Amount, 0);
    const net = afterDiscTotal + gstTotal + chargesTotal;

    const Main = {
      LedgerID: supplierID,
      VoucherDate: poDate,
      Narration: narration,
      ContactPersonID: contactPersonID || 0,
      ProductionUnitID: 0,
      CurrencyCode: currency,
      NetAmount: parseFloat(net.toFixed(2)),
      TotalBasicAmount: parseFloat(afterDiscTotal.toFixed(2)),
      TotalCGSTTaxAmount: parseFloat(cgstTotal.toFixed(2)),
      TotalSGSTTaxAmount: parseFloat(sgstTotal.toFixed(2)),
      TotalIGSTTaxAmount: parseFloat(igstTotal.toFixed(2)),
      TotalTaxAmount: parseFloat(gstTotal.toFixed(2)),
      TotalOverheadAmount: parseFloat(chargesTotal.toFixed(2)),
      TotalQuantity: lines.reduce((s, l) => s + l.POQtyInPU, 0),
      ModeOfTransport: modeOfTransport,
      DeliveryAddress: deliveryAddress,
      TermsOfPayment: termsOfPayment,
      PurchaseDivision: 0,
      PurchaseReferenceRemark: "",
      DealerID: 0,
      VoucherApprovalByEmployeeID: 0,
      PurchaseTerms: "",
      BillToProductionUnitID: 0,
    };

    const Detail = lines.map((l, idx) => ({
      TransID: idx + 1,
      ItemID: l.ItemID,
      ItemGroupID: l.ItemGroupID,
      ProductionUnitID: 0,
      PurchaseOrderQuantity: parseFloat(l.POQtyInPU.toFixed(2)),
      ChallanWeight: parseFloat(l.POQtyInSU.toFixed(2)),
      PurchaseUnit: l.PurchaseUnit,
      StockUnit: l.StockUnit,
      ItemDescription: l.ItemDescription ?? "",
      PurchaseRate: parseFloat(l.Rate.toFixed(4)),
      PurchaseTolerance: l.Tolerance,
      GrossAmount: parseFloat(l.GrossAmount.toFixed(2)),
      DiscountPercentage: parseFloat(l.DiscPct.toFixed(2)),
      DiscountAmount: parseFloat(l.DiscAmount.toFixed(2)),
      DistributedDiscount: 0,
      BasicAmount: parseFloat(l.BasicAmount.toFixed(2)),
      TaxableAmount: parseFloat(l.TaxableAmount.toFixed(2)),
      GSTPercentage: l.GSTPercentage,
      CGSTPercentage: l.CGSTPercentage,
      SGSTPercentage: l.SGSTPercentage,
      IGSTPercentage: l.IGSTPercentage,
      CGSTAmount: parseFloat(l.CGSTAmount.toFixed(2)),
      SGSTAmount: parseFloat(l.SGSTAmount.toFixed(2)),
      IGSTAmount: parseFloat(l.IGSTAmount.toFixed(2)),
      NetAmount: parseFloat(l.NetAmount.toFixed(2)),
      RequiredNoOfPacks: l.NoOfPacks,
      QuantityPerPack: l.QtyPerPack,
      RequiredQuantity: parseFloat(l.ReqQtyInPU.toFixed(3)),
      ExpectedDeliveryDate: l.ExpectedDelivery || null,
      ProductHSNID: l.ProductHSNID || 0,
      RequisitionTransactionID: l.RequisitionTransactionID,
      ItemNarration: l.ItemNarration ?? "",
      Remark: "",
      RefJobBookingJobCardContentsID: 0,
      RefJobCardContentNo: "",
      RefJobName: "",
      ClientID: 0,
      GradesOfSupplier: l.SupplierGrade ?? "",
    }));

    const Tax = charges.map((c, idx) => ({
      TransID: idx + 1,
      LedgerID: c.LedgerID,
      TaxPercentage: c.TaxPercentage,
      Amount: parseFloat(c.Amount.toFixed(2)),
      TaxInAmount: c.InAmount ? 1 : 0,
      IsComulative: 0,
      GSTApplicable: c.GSTApplicable ? 1 : 0,
      IsService: c.IsService,
      CalculatedON: c.CalcOn,
      ProductHSNID: c.ProductHSNID || 0,
      GSTPercentage: c.GSTTaxPercentage,
      CGSTPercentage: c.CGSTTaxPercentage,
      SGSTPercentage: c.SGSTTaxPercentage,
      IGSTPercentage: c.IGSTTaxPercentage,
      CGSTAmount: parseFloat(c.CGSTAmount.toFixed(2)),
      SGSTAmount: parseFloat(c.SGSTAmount.toFixed(2)),
      IGSTAmount: parseFloat(c.IGSTAmount.toFixed(2)),
      TotalAmount: parseFloat(c.TotalAmount.toFixed(2)),
    }));

    // Requisition links — only for lines that came from requisitions
    const Requisition = lines
      .filter(l => l.RequisitionTransactionID > 0)
      .map((l, idx) => ({
        TransID: idx + 1,
        RequisitionTransactionID: l.RequisitionTransactionID,
        ItemID: l.ItemID,
        RequisitionProcessQuantity: parseFloat(l.POQtyInPU.toFixed(3)),
        StockUnit: l.StockUnit,
      }));

    const supplierLedgerName = suppliers.find(s => s.LedgerID === supplierID)?.LedgerName ?? "";
    const UserApprovalProcess = lines.map(l => ({
      LedgerID: supplierID,
      LedgerName: supplierLedgerName,
      ItemID: l.ItemID,
      ItemName: l.ItemName,
      ItemCode: l.ItemCode,
      ItemRate: l.Rate,
      ItemAmount: l.NetAmount,
      PurchaseQty: l.POQtyInPU,
      ExpectedDeliveryDate: l.ExpectedDelivery || null,
    }));

    return {
      prefix: "PO",
      purchaseOrderVoucherId: "-11",
      txtNetAmt: String(parseFloat(net.toFixed(2))),
      currencyCode: currency,
      Main,
      Detail,
      Tax,
      Schedule: [],
      OverHead: [],
      Requisition,
      UserApprovalProcess,
    };
  }, [supplierID, poDate, narration, contactPersonID, currency, netAmount, totalGST, totalCharges,
      modeOfTransport, deliveryAddress, termsOfPayment, lines, charges, suppliers]);

  // ─── Req selection helpers ────────────────────────────────────────────────

  const reqKey = (r: ReqRow) => `${r.TransactionID}-${r.TransactionDetailID}`;

  const toggleReqRow = (r: ReqRow) => {
    const k = reqKey(r);
    setSelectedReqIds(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };

  // ─── List table columns ───────────────────────────────────────────────────

  const reqColumns: Column<ReqRow>[] = useMemo(() => [
    {
      key: "sel", header: "", width: "w-8", sortable: false,
      render: r => (
        <input
          type="checkbox"
          checked={selectedReqIds.has(reqKey(r))}
          onChange={() => toggleReqRow(r)}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 text-blue-600 rounded border-gray-300"
        />
      ),
    },
    { key: "VoucherNo", header: "Req. No.", render: r => <span className="font-mono text-blue-700 font-semibold whitespace-nowrap">{r.VoucherNo || "—"}</span> },
    { key: "VoucherDate", header: "Date", render: r => <span className="text-gray-600 whitespace-nowrap">{r.VoucherDate || "—"}</span> },
    {
      key: "ItemCode", header: "Item Code",
      render: r => (
        <div>
          <span className="font-mono text-blue-700 font-semibold">{r.ItemCode}</span>
          {r.ItemDescription && <span className="text-gray-400 block font-normal text-xs">{r.ItemDescription}</span>}
        </div>
      ),
    },
    { key: "ItemName", header: "Item Name", render: r => <span className="text-gray-800 font-medium">{r.ItemName}</span> },
    { key: "ItemGroupName", header: "Item Group", render: r => <span className="text-gray-600">{r.ItemGroupName}</span> },
    { key: "ItemSubGroupName", header: "Sub Group", render: r => <span className="text-gray-600">{r.ItemSubGroupName || "—"}</span> },
    { key: "GSM", header: "Face GSM", render: r => <span className="text-gray-600">{r.GSM || "—"}</span> },
    { key: "SizeW", header: "Width", render: r => <span className="text-gray-600">{r.SizeW || "—"}</span> },
    { key: "JobName", header: "Job Name", render: r => <span className="text-gray-600">{r.JobName || "—"}</span> },
    { key: "PurchaseQuantity", header: "Pending Qty", render: r => <span className="font-semibold text-gray-800">{toNum(r.PurchaseQuantity).toLocaleString()}</span> },
    { key: "PurchaseUnit", header: "P.Unit", render: r => <span className="text-gray-600">{r.PurchaseUnit}</span> },
    { key: "PurchaseRate", header: "Rate", render: r => <span className="text-gray-700">₹{toNum(r.PurchaseRate).toFixed(2)}</span> },
    { key: "ExpectedDeliveryDate", header: "Exp. Delivery", render: r => <span className="text-gray-600 whitespace-nowrap">{r.ExpectedDeliveryDate || "—"}</span> },
  ], [selectedReqIds]);

  const poLineColumns: Column<POLineRow>[] = useMemo(() => [
    { key: "LedgerName", header: "Supplier Name", render: r => <span className="text-gray-800 text-xs font-medium">{r.LedgerName}</span> },
    { key: "VoucherNo", header: "P.O. No", render: r => <span className="font-mono text-xs font-semibold text-blue-700">{r.VoucherNo}</span> },
    { key: "VoucherDate", header: "P.O. Date", render: r => <span className="text-gray-600 text-xs">{r.VoucherDate}</span> },
    { key: "PREVoucherNo", header: "P.R. No", render: r => <span className="font-mono text-gray-600 text-xs">{r.PREVoucherNo || "—"}</span> },
    { key: "ItemCode", header: "Item Code", render: r => <span className="font-mono text-xs text-blue-700">{r.ItemCode}</span> },
    { key: "ItemGroupName", header: "Item Group", render: r => <span className="text-gray-600 text-xs">{r.ItemGroupName}</span> },
    { key: "ItemSubGroupName", header: "Sub Group", render: r => <span className="text-gray-600 text-xs">{r.ItemSubGroupName || "—"}</span> },
    { key: "ItemName", header: "Item Name", render: r => <span className="text-gray-800 text-xs font-medium">{r.ItemName}</span> },
    { key: "Status", header: "Status", render: r => statusBadge(poLineStatus(r)) },
  ], []);

  const pickerColumns: Column<OverflowItem>[] = useMemo(() => [
    {
      key: "sel", header: "", width: "w-10", sortable: false,
      render: item => {
        const added = lines.some(l => l.ItemID === item.ItemID);
        return (
          <input
            type="checkbox"
            checked={added || pickerSel.has(item._uid)}
            disabled={added}
            onChange={() => !added && togglePickerSel(item._uid)}
            onClick={e => e.stopPropagation()}
            className="w-4 h-4 text-blue-600 rounded border-gray-300"
          />
        );
      },
    },
    {
      key: "ItemCode", header: "Code",
      render: item => (
        <div>
          <span className="font-mono text-blue-700 font-semibold">{item.ItemCode}</span>
          {item.ItemDescription && <span className="block text-gray-400 font-normal text-xs">{item.ItemDescription}</span>}
        </div>
      ),
    },
    {
      key: "ItemName", header: "Item Name",
      render: item => {
        const added = lines.some(l => l.ItemID === item.ItemID);
        return (
          <span className="text-gray-800 font-medium">
            {item.ItemName}
            {added && <span className="ml-2 text-[10px] font-semibold text-gray-400 uppercase">Added</span>}
          </span>
        );
      },
    },
    { key: "ItemGroupName", header: "Group", render: item => <span className="text-gray-600">{item.ItemGroupName}</span> },
    { key: "PurchaseUnit", header: "P.Unit", render: item => <span className="text-gray-600">{item.PurchaseUnit}</span> },
    { key: "PurchaseRate", header: "Purchase Rate", render: item => <span className="font-semibold text-gray-800">₹{toNum(item.PurchaseRate).toFixed(2)}</span> },
    { key: "GSTTaxPercentage", header: "GST%", render: item => <span className="text-gray-700">{toNum(item.GSTTaxPercentage)}%</span> },
    { key: "PhysicalStock", header: "Stock", render: item => <span className="text-gray-700">{toNum(item.PhysicalStock).toLocaleString()} {item.StockUnit}</span> },
  ], [lines, pickerSel]);

  // ─── Password modal submit ─────────────────────────────────────────────────

  const handlePwSubmit = () => {
    if (!pwInput) { alert("Enter your password."); return; }
    if (pwModal === "update") doUpdate(pwInput, pwRemark);
    else if (pwModal === "delete") doDelete(pwInput, pwRemark);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════

  if (view === "list") {
    return (
      <div className="w-full space-y-4">

        {/* Page heading */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="w-[124px] flex-shrink-0" />
          <div className="text-center flex-1">
            <h2 className="text-xl font-bold text-[rgb(var(--fg-default))]">Purchase Order</h2>
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              {listTab === "reqs" ? `${reqs.length} pending requisition lines` : `${filteredPoLines.length} purchase order lines`}
            </p>
          </div>
          <div className="w-[124px] flex-shrink-0 flex justify-end">
            <Button variant="secondary" size="sm" icon={<History size={14} />} onClick={() => alert("Audit Trail — coming soon")}>
              Audit Trail
            </Button>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">

          {/* Tab pills — segmented control */}
          <div className="flex items-center gap-1 p-1 bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--bd-default))] rounded-full">
            {([
              { key: "reqs" as const, label: "Pending Requisitions", icon: <List size={14} /> },
              { key: "pos" as const, label: "Purchase Orders", icon: <FileText size={14} /> },
            ]).map(t => (
              <button
                key={t.key} onClick={() => setListTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${listTab === t.key ? "bg-[rgb(var(--color-primary))] text-white shadow-sm" : "text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]"}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {listTab === "pos" && (
              <div className="flex items-center gap-2 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] rounded-lg px-3 py-2 shadow-sm">
                <Search size={14} className="text-[rgb(var(--fg-muted))] flex-shrink-0" />
                <input
                  value={posSearch} onChange={e => setPosSearch(e.target.value)}
                  placeholder="Search PO no., supplier…"
                  className="bg-transparent text-xs text-[rgb(var(--fg-default))] outline-none w-40 sm:w-56 border-none"
                />
                {posSearch && (
                  <button onClick={() => setPosSearch("")} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]">
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
            <Button
              variant="action-refresh" size="sm" icon={<RefreshCw size={14} />}
              onClick={() => (listTab === "reqs" ? fetchReqs() : Promise.all([fetchPos(), fetchPoLines()]))}
            />
            <Button
              variant="action-create" size="sm" icon={<Plus size={15} />}
              onClick={() => (listTab === "reqs" && selectedReqIds.size > 0 ? openFromSelectedReqs() : openNew())}
            >
              {listTab === "reqs" && selectedReqIds.size > 0 ? `Create (${selectedReqIds.size})` : "New Purchase Order"}
            </Button>
          </div>
        </div>

        {/* ── PENDING REQUISITIONS TAB ── */}
        {listTab === "reqs" && (
          <div className="bg-[rgb(var(--bg-surface))] rounded-xl border border-[rgb(var(--bd-default))] shadow-sm overflow-hidden">
            {loadingReqs ? (
              <div className="text-center py-14 text-[rgb(var(--fg-subtle))] text-sm">Loading requisitions…</div>
            ) : reqs.length === 0 ? (
              <div className="text-center py-14 text-[rgb(var(--fg-subtle))] text-sm">No pending requisitions found</div>
            ) : (
              <div className="p-4">
                <DataTable
                  data={reqs}
                  columns={reqColumns}
                  getRowId={r => reqKey(r)}
                  enableRowSelection={false}
                  toolbar={
                    selectedReqIds.size > 0 ? (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-[rgb(var(--color-primary))]">{selectedReqIds.size} selected</span>
                        <button onClick={() => setSelectedReqIds(new Set())} className="text-xs text-[rgb(var(--fg-muted))] hover:text-red-600 underline">Clear selection</button>
                      </div>
                    ) : undefined
                  }
                />
              </div>
            )}
          </div>
        )}

        {/* ── PURCHASE ORDERS TAB (item-level) ── */}
        {listTab === "pos" && (
          <div className="bg-[rgb(var(--bg-surface))] rounded-xl border border-[rgb(var(--bd-default))] shadow-sm overflow-hidden">
            {loadingPos || loadingPoLines ? (
              <div className="text-center py-14 text-[rgb(var(--fg-subtle))] text-sm">Loading purchase orders…</div>
            ) : (
              <div className="p-4">
                <DataTable
                  data={filteredPoLines}
                  columns={poLineColumns}
                  getRowId={r => String(r.TransactionDetailID)}
                  enableRowSelection={false}
                  actions={line => {
                    const header = pos.find(p => p.TransactionID === line.TransactionID);
                    const status = poLineStatus(line);
                    return (
                      <RowActions>
                        <RowAction.Print onClick={() => header && printPo(header)} disabled={!header} />
                        <RowAction.View onClick={() => header && openViewPo(header)} disabled={!header} />
                        <RowAction.Edit onClick={() => header && openEdit(header)} disabled={!header || formLoading} />
                        <RowAction.Reject
                          tooltip="Cancel line"
                          onClick={() => cancelPoLine(line)}
                          disabled={status === "Cancelled" || status === "Closed"}
                        />
                        <RowAction.Delete
                          onClick={() => {
                            if (!header) return;
                            setEditTxnID(header.TransactionID);
                            setEditVoucherNo(header.VoucherNo);
                            setPwInput(""); setPwRemark("");
                            setPwModal("delete");
                          }}
                          disabled={!header}
                        />
                      </RowActions>
                    );
                  }}
                  toolbar={
                    <div className="flex items-center gap-2 flex-wrap">
                      {([
                        { key: "All" as const, label: "All" },
                        { key: "Pending" as const, label: "Pending" },
                        { key: "Approved" as const, label: "Approved" },
                        { key: "Cancelled" as const, label: "Cancelled" },
                        { key: "Closed" as const, label: "Closed" },
                      ]).map(p => (
                        <button
                          key={p.key} onClick={() => setPoStatusFilter(p.key)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${poStatusFilter === p.key ? "bg-[rgb(var(--color-primary))] text-white border-[rgb(var(--color-primary))]" : "bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-muted))] border-[rgb(var(--bd-default))] hover:border-[rgb(var(--color-primary))] hover:text-[rgb(var(--color-primary))]"}`}
                        >
                          {p.label} ({poStatusCounts[p.key] ?? 0})
                        </button>
                      ))}
                    </div>
                  }
                />
              </div>
            )}
          </div>
        )}

        {/* Read-only view modal (eye icon) */}
        {viewPo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewPo(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-base font-semibold text-gray-800">View — {viewPo.header.VoucherNo}</h3>
                  <p className="text-xs text-gray-500">{viewPo.header.LedgerName} · {fmtDate(viewPo.header.VoucherDate)}</p>
                </div>
                <button onClick={() => setViewPo(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Item Code", "Item Name", "Qty", "Unit", "Rate", "Amount"].map((h, i) => (
                        <th key={i} className={`px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wider ${i >= 2 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewPo.rows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-blue-700">{r.ItemCode}</td>
                        <td className="px-4 py-2.5 text-gray-800">{r.ItemName}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{toNum(r.PurchaseQuantity).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-gray-600">{r.PurchaseUnit}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">₹{fmtAmt(toNum(r.PurchaseRate))}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-blue-700">₹{fmtAmt(toNum(r.NetAmount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FORM VIEW
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <Modal
      open={view === "form"}
      onClose={() => setView("list")}
      title={editTxnID ? `Edit Purchase Order — ${editVoucherNo}` : "Purchase Order Creation"}
      size="2xl"
    >
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-5 flex flex-col">

        {formLoading && (
          <div className="text-center py-8 text-gray-400 text-sm border-b border-gray-100">
            Loading Purchase Order data…
          </div>
        )}

        <div className="p-6 space-y-6">

          {/* ── ORDER DETAILS + SUPPLIER & CONTACT ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <Input label="PO No." readOnly value={poNo} />
              <Input label="PO Date" required type="date" value={poDate} onChange={e => setPoDate(e.target.value)} />
              <div className="md:col-span-2">
                <Select label="Supplier *" value={String(supplierID || "")}
                  onChange={e => handleSupplierChange(Number(e.target.value))}
                  options={[{ value: "", label: "Select Supplier…" }, ...suppliers.map(s => ({ value: String(s.LedgerID), label: s.LedgerName }))]} />
              </div>
              <Select label="Contact Person" value={String(contactPersonID || "")}
                onChange={e => setContactPersonID(Number(e.target.value))}
                disabled={!contacts.length}
                options={[{ value: "", label: "Select Contact…" }, ...contacts.map(c => ({ value: String(c.ConcernPersonID), label: c.Name }))]} />
              <Select label="Currency" value={currency} onChange={e => setCurrency(e.target.value)}
                options={CURRENCIES.map(c => ({ value: c, label: c }))} />
            </div>

            {selectedSupplier && (
              <div className="mt-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between flex-wrap gap-3 text-sm">
                <span className="text-green-800 font-medium">{selectedSupplier.SupState}</span>
                <span className={sameState ? "text-green-700 font-semibold" : "text-orange-700 font-semibold"}>
                  {sameState ? "CGST + SGST applicable" : "IGST applicable"}
                </span>
                {selectedSupplier.GSTNo && <span className="text-gray-500 font-mono">GST: {selectedSupplier.GSTNo}</span>}
              </div>
            )}
          </div>

          {/* ── ITEMS ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <SectionTitle title={`Purchase Order Items (${lines.length})`} />
              <button
                onClick={() => { setShowPicker(true); setPickerGroup("All"); setPickerSel(new Set()); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm border-collapse" style={{ minWidth: 2300 }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {[
                        "Group", "Item Code", "Item Name",
                        "Req.Qty\n(P.U.)", "No. of\nPacks", "Qty/\nPack", "PO Qty\n(P.U.)", "PO Qty\n(S.U.)",
                        "Rate", "P.Unit", "HSN", "Exp.Del.", "Tol.%", "Item Narration", "Sup.Grade",
                        "Gross\nAmt", "Disc\n%", "After\nDisc", "CGST\nAmt", "SGST\nAmt", "IGST\nAmt",
                        "Taxable\nAmt", "Net\nAmt", "",
                      ].map((col, i) => (
                        <th key={i} className={`px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0 whitespace-pre-line leading-tight ${i >= 3 && i <= 23 ? "text-right" : "text-left"}`}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr><td colSpan={24} className="text-center py-16 text-gray-400 text-sm">No items — click "Add Item" or create from requisitions</td></tr>
                    ) : lines.map((l, idx) => (
                      <tr key={l.lineKey} className={`border-b border-gray-100 hover:bg-blue-50/20 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{l.ItemGroupName}</td>
                        <td className="px-2 py-1.5 font-mono text-blue-700 whitespace-nowrap">
                          {l.ItemCode}
                          {l.ItemDescription && <span className="text-gray-400 block font-normal text-xs">{l.ItemDescription}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-gray-800" style={{ maxWidth: 150 }}>{l.ItemName}</td>
                        <td className="px-2 py-1.5 text-right text-gray-600">{l.ReqQtyInPU || "—"}</td>

                        {/* No. of packs */}
                        <td className="px-1 py-1">
                          <Input type="number" min={0} value={l.NoOfPacks || ""} placeholder="0"
                            onChange={e => updateLineNum(l.lineKey, "NoOfPacks", Number(e.target.value))}
                            className="w-16 text-right" />
                        </td>
                        {/* Qty/pack */}
                        <td className="px-1 py-1">
                          <Input type="number" min={0} value={l.QtyPerPack || ""} placeholder="0"
                            onChange={e => updateLineNum(l.lineKey, "QtyPerPack", Number(e.target.value))}
                            className="w-20 text-right" />
                        </td>

                        {/* PO Qty (P.U.) — directly editable */}
                        <td className="px-1 py-1">
                          <Input type="number" min={0} step={0.001} value={l.POQtyInPU || ""} placeholder="0"
                            onChange={e => updateLineNum(l.lineKey, "POQtyInPU", Number(e.target.value))}
                            className="w-20 text-right font-semibold text-blue-700" />
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{l.POQtyInSU.toFixed(3)}</td>

                        {/* Rate */}
                        <td className="px-1 py-1">
                          <Input type="number" min={0} step={0.01} value={l.Rate || ""} placeholder="0.00"
                            onChange={e => updateLineNum(l.lineKey, "Rate", Number(e.target.value))}
                            className="w-20 text-right" />
                        </td>
                        <td className="px-2 py-1.5 text-gray-700">{l.PurchaseUnit}</td>

                        {/* HSN */}
                        <td className="px-2 py-1.5 text-gray-600 font-mono">{l.HSNCode || "—"}</td>

                        {/* Expected delivery */}
                        <td className="px-1 py-1">
                          <Input type="date" value={l.ExpectedDelivery}
                            onChange={e => updateLineStr(l.lineKey, "ExpectedDelivery", e.target.value)}
                            className="w-32" />
                        </td>

                        {/* Tolerance */}
                        <td className="px-1 py-1">
                          <Input type="number" min={0} max={100} value={l.Tolerance || ""} placeholder="0"
                            onChange={e => updateLineNum(l.lineKey, "Tolerance", Number(e.target.value))}
                            className="w-12 text-right" />
                        </td>

                        {/* Item Narration */}
                        <td className="px-1 py-1">
                          <Input type="text" value={l.ItemNarration} placeholder="Remark…"
                            onChange={e => updateLineStr(l.lineKey, "ItemNarration", e.target.value)}
                            className="w-28" />
                        </td>

                        {/* Supplier Grade */}
                        <td className="px-1 py-1">
                          <Select value={l.SupplierGrade}
                            onChange={e => updateLineStr(l.lineKey, "SupplierGrade", e.target.value)}
                            options={[{ value: "", label: "— Select —" }, ...supplierGrades.map(g => ({ value: g, label: g }))]}
                            className="w-24" />
                        </td>

                        <td className="px-2 py-1.5 text-right font-semibold text-gray-700">{fmtAmt(l.GrossAmount)}</td>

                        {/* Disc % */}
                        <td className="px-1 py-1">
                          <Input type="number" min={0} max={100} step={0.01} value={l.DiscPct || ""} placeholder="0"
                            onChange={e => updateLineNum(l.lineKey, "DiscPct", Number(e.target.value))}
                            className="w-12 text-right" />
                        </td>

                        <td className="px-2 py-1.5 text-right text-gray-700">{fmtAmt(l.BasicAmount)}</td>
                        <td className="px-2 py-1.5 text-right text-blue-700">{fmtAmt(l.CGSTAmount)}</td>
                        <td className="px-2 py-1.5 text-right text-blue-700">{fmtAmt(l.SGSTAmount)}</td>
                        <td className="px-2 py-1.5 text-right text-orange-700">{fmtAmt(l.IGSTAmount)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{fmtAmt(l.TaxableAmount)}</td>
                        <td className="px-2 py-1.5 text-right font-bold text-blue-800">{fmtAmt(l.NetAmount)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => removeLine(l.lineKey)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {lines.length > 0 && (
                    <tfoot>
                      <tr className="bg-blue-50 border-t-2 border-blue-200 text-xs font-bold">
                        <td colSpan={15} className="px-3 py-2 text-right text-blue-800">Totals</td>
                        <td className="px-2 py-2 text-right text-blue-800">{fmtAmt(lines.reduce((s, l) => s + l.GrossAmount, 0))}</td>
                        <td />
                        <td className="px-2 py-2 text-right text-blue-800">{fmtAmt(totalBasic)}</td>
                        <td className="px-2 py-2 text-right text-blue-700">{fmtAmt(totalCGST)}</td>
                        <td className="px-2 py-2 text-right text-blue-700">{fmtAmt(totalSGST)}</td>
                        <td className="px-2 py-2 text-right text-orange-700">{fmtAmt(totalIGST)}</td>
                        <td className="px-2 py-2 text-right text-blue-800">{fmtAmt(lines.reduce((s, l) => s + l.TaxableAmount, 0))}</td>
                        <td className="px-2 py-2 text-right text-blue-900">{fmtAmt(lines.reduce((s, l) => s + l.NetAmount, 0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

            </div>

          {/* ── PAYMENT TERMS · TAX & CHARGES · AMOUNT SUMMARY ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* Payment Terms */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <SectionTitle title="Payment Terms" />
              <Select
                value={termsOfPayment}
                onChange={e => setTermsOfPayment(e.target.value)}
                options={[
                  { value: "", label: "Select payment terms…" },
                  ...PAYMENT_TERMS_OPTIONS.map(t => ({ value: t, label: t })),
                  ...(termsOfPayment && !PAYMENT_TERMS_OPTIONS.includes(termsOfPayment)
                    ? [{ value: termsOfPayment, label: termsOfPayment }] : []),
                ]}
              />
              <div className="flex gap-2 flex-wrap mt-4">
                {PAYMENT_TERMS_OPTIONS.map(t => (
                  <button
                    key={t} onClick={() => setTermsOfPayment(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${termsOfPayment === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-blue-50"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Tax & Charge Ledgers */}
            <div className="lg:col-span-6 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle title="Tax & Additional Charges" />
                <div className="relative">
                  <button
                    onClick={() => setShowChargeMenu(p => !p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                  >
                    <Plus size={14} /> Add Charge
                  </button>
                  {showChargeMenu && (
                    <div className="absolute right-0 top-10 z-30 bg-white border border-gray-200 rounded-lg shadow-xl w-64 py-1 max-h-72 overflow-y-auto">
                      {chargeLedgers.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-400">Loading…</p>
                      ) : chargeLedgers.map(cl => (
                        <button key={cl.LedgerID} onClick={() => addCharge(cl)}
                          className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700">
                          {cl.LedgerName}
                          {cl.TaxType && <span className="ml-1 text-gray-400">({cl.TaxType})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 580 }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["Ledger", "Tax %", "Calc. On", "GST", "In Amt", "Amount", ""].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {charges.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm italic">No charges added</td></tr>
                    ) : charges.map((c, idx) => (
                      <tr key={c.chargeKey} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                        <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{c.LedgerName}</td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min={0} value={c.TaxPercentage || ""} placeholder="0"
                            onChange={e => updateCharge(c.chargeKey, { TaxPercentage: Number(e.target.value) })}
                            className="w-14 text-right" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select value={c.CalcOn} onChange={e => updateCharge(c.chargeKey, { CalcOn: e.target.value })}
                            options={CALCU_ON.map(t => ({ value: t, label: t }))}
                            className="w-20" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={c.GSTApplicable}
                            onChange={e => updateCharge(c.chargeKey, { GSTApplicable: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={c.InAmount}
                            onChange={e => updateCharge(c.chargeKey, { InAmount: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min={0} step={0.01} value={c.Amount || ""} placeholder="0.00"
                            onChange={e => updateCharge(c.chargeKey, { Amount: Number(e.target.value), TotalAmount: Number(e.target.value) })}
                            className="w-24 text-right" />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => removeCharge(c.chargeKey)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Amount Summary */}
            <div className="lg:col-span-3 bg-blue-50 rounded-xl border border-blue-100 p-5 space-y-2">
              <SectionTitle title="Amount Summary" />
              {[
                { label: "Gross Amount (before disc)", value: lines.reduce((s, l) => s + l.GrossAmount, 0), cls: "text-gray-700" },
                { label: "Discount Amount", value: totalDisc, cls: "text-red-600" },
                { label: "Basic Amount (after disc)", value: totalBasic, cls: "text-gray-800 font-bold" },
                { label: "CGST", value: totalCGST, cls: "text-blue-600" },
                { label: "SGST", value: totalSGST, cls: "text-blue-600" },
                { label: "IGST", value: totalIGST, cls: "text-orange-600" },
                { label: "Additional Charges", value: totalCharges, cls: "text-gray-700" },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-1 border-b border-blue-100/70 last:border-0">
                  <span className="text-sm text-gray-500">{row.label}</span>
                  <span className={`text-sm font-semibold font-mono ${row.cls}`}>₹{fmtAmt(row.value)}</span>
                </div>
              ))}
              <div className="pt-3 flex justify-between border-t-2 border-blue-200">
                <span className="text-base font-bold text-blue-800">Net Amount</span>
                <span className="text-base font-bold text-blue-800 font-mono">₹{fmtAmt(netAmount)}</span>
              </div>
            </div>
          </div>

          {/* ── DELIVERY & REMARK ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <SectionTitle title="Delivery & Remark" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <Select label="Mode of Transport *" value={modeOfTransport} onChange={e => setModeOfTransport(e.target.value)}
                  options={[{ value: "", label: "Select…" }, ...TRANSPORT_MODES.map(m => ({ value: m, label: m }))]} />
                <Input label="Delivery Address" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Delivery location" />
              </div>
              <Textarea label="Purchase Remark"
                value={narration}
                onChange={e => setNarration(e.target.value)}
                rows={5}
                placeholder="Optional notes…"
              />
            </div>
          </div>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={() => setView("list")}>
            Close
          </Button>
          {editTxnID != null && (
            <Button
              variant="secondary" size="sm" icon={<Printer size={14} />}
              onClick={() => { const h = pos.find(p => p.TransactionID === editTxnID); if (h) printPo(h); }}
            >
              Print
            </Button>
          )}
          {editTxnID != null && (
            <Button variant="action-cancel" size="sm" loading={deleting}
              onClick={() => { setPwInput(""); setPwRemark(""); setPwModal("delete"); }}
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={resetForm}>
            Clear
          </Button>
          {editTxnID ? (
            <Button variant="action-save" size="sm" loading={saving}
              onClick={() => { setPwInput(""); setPwRemark(""); setPwModal("update"); }}
            >
              Update
            </Button>
          ) : (
            <Button variant="action-save" size="sm" loading={saving} onClick={doSave}>
              Save
            </Button>
          )}
        </div>
      </div>

      {/* ── ITEM PICKER MODAL ── */}
      <Modal open={showPicker} onClose={() => setShowPicker(false)} title="Select Item" size="xl">
        <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-5 flex flex-col">
          <div className="p-4">
            <DataTable
              data={filteredPickerItems}
              columns={pickerColumns}
              getRowId={item => String(item._uid)}
              enableRowSelection={false}
              toolbar={
                <div className="flex items-center gap-2 flex-wrap">
                  {pickerGroups.map(g => (
                    <button key={g} onClick={() => setPickerGroup(g)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${pickerGroup === g ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-blue-50"}`}>
                      {g}
                    </button>
                  ))}
                  {pickerAddableIds.length > 0 && (
                    <button onClick={toggleAllPicker} className="text-xs text-blue-600 hover:text-blue-800 underline ml-1">
                      {allPickerSelected ? "Deselect all" : "Select all"}
                    </button>
                  )}
                </div>
              }
            />
          </div>
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-3 sticky bottom-0 bg-white">
            <p className="text-xs text-gray-400">
              {pickerSel.size > 0 ? `${pickerSel.size} item${pickerSel.size > 1 ? "s" : ""} selected` : "Select items to add"}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowPicker(false)}>
                Cancel
              </Button>
              <Button
                variant="action-save" size="sm" icon={<Plus size={14} />}
                onClick={addSelectedFromPicker}
                disabled={pickerSel.size === 0}
              >
                Add{pickerSel.size > 0 ? ` (${pickerSel.size})` : ""}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── PASSWORD CONFIRMATION MODAL ── */}
      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-800 mb-1">
              {pwModal === "delete" ? "Confirm Deletion" : "Confirm Update"}
            </h3>
            <p className="text-xs text-gray-500 mb-5">
              {pwModal === "delete"
                ? "Enter your password to permanently soft-delete this Purchase Order."
                : "Enter your password to save changes to this Purchase Order."}
            </p>
            <div className="space-y-4">
              <Input label="Password" required type="password" value={pwInput} onChange={e => setPwInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handlePwSubmit()}
                autoFocus placeholder="Your login password" />
              <Input label="Remark" value={pwRemark} onChange={e => setPwRemark(e.target.value)}
                placeholder="Reason for this action (optional)" />
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <Button variant="secondary" onClick={() => setPwModal(null)}>Cancel</Button>
              <Button variant={pwModal === "delete" ? "danger" : "primary"} onClick={handlePwSubmit}
                disabled={saving || deleting}>
                {(saving || deleting) ? "Processing…" : pwModal === "delete" ? "Delete" : "Update"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Close charge menu on outside click */}
      {showChargeMenu && <div className="fixed inset-0 z-20" onClick={() => setShowChargeMenu(false)} />}
    </Modal>
  );
}
