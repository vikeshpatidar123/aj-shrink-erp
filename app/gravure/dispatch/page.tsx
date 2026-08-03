"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, Plus, Pencil, Trash2, Truck, FileText,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";
import { DataTable } from "@/components/tables/DataTable";
import { downloadDeliveryChallan, type ChallanData } from "@/lib/deliveryChallan";
import CoaTab from "./CoaTab";
import InvoiceTab from "./InvoiceTab";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const API = "api/dispatchShrink";

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
    method: "POST", headers: authHeaders(), body: JSON.stringify(body),
  });
  return unwrap(await res.text()) as T;
}
function todayStr() { return new Date().toISOString().split("T")[0]; }
function daysAgoStr(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split("T")[0];
}
function num(v: unknown) { const p = parseFloat(String(v)); return isNaN(p) ? 0 : p; }
function parseDisplayDate(d: string): string {
  if (!d) return todayStr();
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const m = d.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})/);
  if (m) return `${m[3]}-${months[m[2]] ?? "01"}-${m[1]}`;
  return d.slice(0, 10);
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface PendingRow {
  CompanyID: number; LedgerID: number; ConsigneeID: number;
  OrderBookingID: number; OrderBookingDetailsID: number; JobBookingID: number;
  ProductMasterID: number; ClientName: string; ConsigneeName: string;
  JobBookingNo: string; JobBookingDate: string; SalesOrderNo: string;
  OrderBookingDate: string; ProductMasterCode: string; JobName: string;
  ProductCode: string; OrderQuantity: number; JCQty: number;
  FinishGoodsQty: number; DeliveredQuantity: number; PendingQuantity: number;
  FinishGoodsWt: number; TotalFGOuterCartons: number; HSNCode: string;
  PONo: string; CategoryName: string;
}

interface ProcessedRow {
  FGTransactionID: number; VoucherNo: string; VoucherDate: string;
  JobBookingID: number; JobBookingNo: string; JobName: string;
  LedgerID: number; LedgerName: string; ConsigneeID: number; ConsigneeName: string;
  TransporterID: number; TransporterName: string; VehicleNo: string;
  ModeOfTransport: string; PODNo: string; Narration: string;
  TotalOuterCarton: number; TotalQuantity: number; NetAmount: number;
  PONo: string; InvoiceNo: string;
}

interface FGStockRow {
  ParentFGTransactionID: number; ParentFGTransactionDetailID: number;
  SemiPackingMainID: number; SemiPackingDetailID: number;
  JobBookingID: number; JobBookingJobCardContentsID: number;
  ProductMasterID: number; OrderBookingID: number; OrderBookingDetailsID: number;
  WarehouseID: number; ProductHSNID: number; HSNCode: string;
  PackingNo: string; SalesOrderNo: string; JobBookingNo: string;
  ProductMasterCode: string; ProductCode: string; JobName: string;
  FGStock: number; TotalFGOuterCartons: number;
  InnerCarton: number; QuantityPerPack: number;
  PurchaseRate: number; PurchaseUnit: string;
  CFT: number; CBCM: number; ShipperLengthCM: number; ShipperWidthCM: number;
  ShipperHeightCM: number; WeightPerOuterCarton: number;
  WarehouseName: string; WarehouseBinName: string;
  GSTTaxPercentage: number; CGSTTaxPercentage: number;
  SGSTTaxPercentage: number; IGSTTaxPercentage: number;
  BatchNo: string;
}

// A unified editable dispatch line (built from FG stock or from a saved record)
interface Line {
  sn: number;
  ParentFGTransactionID: number; ParentFGTransactionDetailID: number;
  SemiPackingMainID: number; SemiPackingDetailID: number;
  JobBookingID: number; JobBookingJobCardContentsID: number;
  ProductMasterID: number; OrderBookingID: number; OrderBookingDetailsID: number;
  WarehouseID: number; ProductHSNID: number;
  ProductCode: string; ProductMasterCode: string; JobName: string;
  PackingNo: string; BatchNo: string; HSNCode: string;
  availableCartons: number; availableQty: number; qtyPerCarton: number;
  InnerCarton: number; QuantityPerPack: number;
  Rate: number; Unit: string;
  CFT: number; CBCM: number; ShipperLengthCM: number; ShipperWidthCM: number;
  ShipperHeightCM: number; WeightPerOuterCarton: number;
  GSTPercentage: number; CGSTPercentage: number; SGSTPercentage: number; IGSTPercentage: number;
  dispatchCartons: string;   // user input
}

interface JobCtx {
  LedgerID: number; ClientName: string; JobBookingID: number;
  JobBookingNo: string; JobName: string; SalesOrderNo: string;
}

interface LookupLedger { ConsigneeID?: number; ConsigneeName?: string; TransporterID?: number; TransporterName?: string; }

// ── CSS helpers ────────────────────────────────────────────────────────────────
const lbl = "block text-xs font-medium text-gray-600 mb-0.5";
const ro  = "w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-gray-50 text-gray-700";
const th  = "px-2 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-gray-50";
const td  = "px-2 py-1.5 text-sm text-gray-700 whitespace-nowrap";

// ── Column definitions for sort + filter ──────────────────────────────────────
const PEND_COLS: { h: string; key?: keyof PendingRow }[] = [
  { h: "#" },
  { h: "Job No",        key: "JobBookingNo" },
  { h: "Job Name",      key: "JobName" },
  { h: "Customer",      key: "ClientName" },
  { h: "Sales Order",   key: "SalesOrderNo" },
  { h: "PO No",         key: "PONo" },
  { h: "FG Stock Qty",  key: "FinishGoodsQty" },
  { h: "Boxes",         key: "TotalFGOuterCartons" },
  { h: "Pending Qty",   key: "PendingQuantity" },
  { h: "" },
];

const PROC_COLS: { h: string; key?: keyof ProcessedRow }[] = [
  { h: "#" },
  { h: "Note No",   key: "VoucherNo" },
  { h: "Date",      key: "VoucherDate" },
  { h: "Customer",  key: "LedgerName" },
  { h: "Job No",    key: "JobBookingNo" },
  { h: "Job Name",  key: "JobName" },
  { h: "Boxes",     key: "TotalOuterCarton" },
  { h: "Total Qty", key: "TotalQuantity" },
  { h: "Vehicle",   key: "VehicleNo" },
  { h: "Net Amt",   key: "NetAmount" },
  { h: "" },
];

// Compute the derived numbers for a dispatch line given carton count
function lineCalc(l: Line) {
  const cartons = num(l.dispatchCartons);
  const qty     = +(cartons * l.qtyPerCarton).toFixed(3);
  const weight  = +(cartons * l.WeightPerOuterCarton).toFixed(3);
  const basic   = +(qty * l.Rate).toFixed(2);
  const taxable = basic;
  const cgst    = +(taxable * l.CGSTPercentage / 100).toFixed(2);
  const sgst    = +(taxable * l.SGSTPercentage / 100).toFixed(2);
  const igst    = +(taxable * l.IGSTPercentage / 100).toFixed(2);
  const net     = +(taxable + cgst + sgst + igst).toFixed(2);
  return { cartons, qty, weight, basic, taxable, cgst, sgst, igst, net };
}

// ══════════════════════════════════════════════════════════════════════════════
export default function DispatchPage() {
  const { showToast } = useToast();

  // ── Module tab (Delivery Note / Challan · Certificate of Analysis · Invoice) ──
  const [moduleTab, setModuleTab]   = useState<"deliverynote" | "coa" | "invoice">("deliverynote");

  // ── List state ─────────────────────────────────────────────────────────────
  const [tab, setTab]               = useState<"pending" | "processed">("pending");
  const [fromDate, setFromDate]     = useState(daysAgoStr(30));
  const [toDate, setToDate]         = useState(todayStr());
  const [pendingList, setPendingList]     = useState<PendingRow[]>([]);
  const [processedList, setProcessedList] = useState<ProcessedRow[]>([]);
  const [listLoading, setListLoading]     = useState(false);
  const [pendSort,       setPendSort]       = useState<{ col: keyof PendingRow;   dir: "asc" | "desc" } | null>(null);
  const [pendColFilters, setPendColFilters] = useState<Partial<Record<keyof PendingRow,   string>>>({});
  const [procSort,       setProcSort]       = useState<{ col: keyof ProcessedRow; dir: "asc" | "desc" } | null>(null);
  const [procColFilters, setProcColFilters] = useState<Partial<Record<keyof ProcessedRow, string>>>({});

  // ── Modal meta ─────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen]   = useState(false);
  const [editMode, setEditMode]     = useState(false);
  const [editFGID, setEditFGID]     = useState<number | null>(null);
  const [jobCtx, setJobCtx]         = useState<JobCtx | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);

  // ── Form header ────────────────────────────────────────────────────────────
  const [noteNo, setNoteNo]               = useState("");
  const [noteDate, setNoteDate]           = useState(todayStr());
  const [consignees, setConsignees]       = useState<LookupLedger[]>([]);
  const [consigneeID, setConsigneeID]     = useState(0);
  const [transporters, setTransporters]   = useState<LookupLedger[]>([]);
  const [transporterID, setTransporterID] = useState(0);
  const [transporterName, setTransporterName] = useState("");
  const [vehicleNo, setVehicleNo]         = useState("");
  const [modeOfTransport, setModeOfTransport] = useState("");
  const [podNo, setPodNo]                 = useState("");
  const [narration, setNarration]         = useState("");

  // ── Lines ──────────────────────────────────────────────────────────────────
  const [lines, setLines]           = useState<Line[]>([]);

  // ── Load list ────────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      if (tab === "pending") {
        const data = await apiFetch<PendingRow[]>(`${API}/pending`);
        setPendingList(Array.isArray(data) ? data : []);
      } else {
        const data = await apiFetch<ProcessedRow[]>(
          `${API}/processed?fromDate=${fromDate}&toDate=${toDate}`
        );
        setProcessedList(Array.isArray(data) ? data : []);
      }
    } catch {
      showToast("error", "Failed to load list");
    } finally {
      setListLoading(false);
    }
  }, [tab, fromDate, toDate, showToast]);

  useEffect(() => { loadList(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset modal ──────────────────────────────────────────────────────────────
  const resetForm = () => {
    setLines([]); setNoteNo(""); setNoteDate(todayStr());
    setConsignees([]); setConsigneeID(0); setTransporters([]);
    setTransporterID(0); setTransporterName(""); setVehicleNo("");
    setModeOfTransport(""); setPodNo(""); setNarration("");
  };

  // ── Open NEW ─────────────────────────────────────────────────────────────────
  const openNew = async (row: PendingRow) => {
    resetForm();
    setEditMode(false); setEditFGID(null);
    setJobCtx({
      LedgerID: row.LedgerID, ClientName: row.ClientName,
      JobBookingID: row.JobBookingID, JobBookingNo: row.JobBookingNo,
      JobName: row.JobName, SalesOrderNo: row.SalesOrderNo,
    });
    setModalOpen(true); setModalLoading(true);
    try {
      const [fgData, vno, consData, transData] = await Promise.all([
        apiFetch<FGStockRow[]>(`${API}/fgstock?jobBookingID=${row.JobBookingID}`),
        apiFetch<string>(`${API}/noteno?prefix=DN`),
        apiFetch<LookupLedger[]>(`${API}/consignees?clientId=${row.LedgerID}`),
        apiFetch<LookupLedger[]>(`${API}/transporters`),
      ]);
      const stock = Array.isArray(fgData) ? fgData : [];
      setLines(stock.map((r, i) => fgToLine(r, i + 1)));
      setNoteNo(typeof vno === "string" ? vno : "");
      setConsignees(Array.isArray(consData) ? consData : []);
      setConsigneeID(row.ConsigneeID || 0);
      setTransporters(Array.isArray(transData) ? transData : []);
      if (stock.length === 0) showToast("error", "No finished-goods stock available for this job");
    } catch {
      showToast("error", "Failed to load dispatch data");
    } finally {
      setModalLoading(false);
    }
  };

  const fgToLine = (r: FGStockRow, sn: number): Line => {
    const availQty   = num(r.FGStock);
    const availCart  = num(r.TotalFGOuterCartons);
    const qtyPerCart = availCart > 0 ? availQty / availCart : availQty;
    return {
      sn,
      ParentFGTransactionID: num(r.ParentFGTransactionID),
      ParentFGTransactionDetailID: num(r.ParentFGTransactionDetailID),
      SemiPackingMainID: num(r.SemiPackingMainID), SemiPackingDetailID: num(r.SemiPackingDetailID),
      JobBookingID: num(r.JobBookingID), JobBookingJobCardContentsID: num(r.JobBookingJobCardContentsID),
      ProductMasterID: num(r.ProductMasterID), OrderBookingID: num(r.OrderBookingID),
      OrderBookingDetailsID: num(r.OrderBookingDetailsID), WarehouseID: num(r.WarehouseID),
      ProductHSNID: num(r.ProductHSNID),
      ProductCode: r.ProductCode || "", ProductMasterCode: r.ProductMasterCode || "", JobName: r.JobName || "",
      PackingNo: r.PackingNo || "", BatchNo: r.BatchNo || "", HSNCode: r.HSNCode || "",
      availableCartons: availCart, availableQty: availQty, qtyPerCarton: qtyPerCart,
      InnerCarton: num(r.InnerCarton), QuantityPerPack: num(r.QuantityPerPack),
      Rate: num(r.PurchaseRate), Unit: r.PurchaseUnit || "",
      CFT: num(r.CFT), CBCM: num(r.CBCM), ShipperLengthCM: num(r.ShipperLengthCM),
      ShipperWidthCM: num(r.ShipperWidthCM), ShipperHeightCM: num(r.ShipperHeightCM),
      WeightPerOuterCarton: num(r.WeightPerOuterCarton),
      GSTPercentage: num(r.GSTTaxPercentage), CGSTPercentage: num(r.CGSTTaxPercentage),
      SGSTPercentage: num(r.SGSTTaxPercentage), IGSTPercentage: num(r.IGSTTaxPercentage),
      dispatchCartons: "",
    };
  };

  // ── Print delivery challan (flexo-format PDF) ────────────────────────────────
  const printChallan = async (fgId: number) => {
    try {
      const data = await apiFetch<ChallanData>(`${API}/challandata/${fgId}`);
      if (!data || !data.Header) { showToast("error", "No challan data found"); return; }
      await downloadDeliveryChallan(data, fgId);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Failed to generate challan");
    }
  };

  // ── Open EDIT ────────────────────────────────────────────────────────────────
  const openEdit = async (row: ProcessedRow) => {
    resetForm();
    setEditMode(true); setEditFGID(row.FGTransactionID);
    setJobCtx({
      LedgerID: row.LedgerID, ClientName: row.LedgerName,
      JobBookingID: row.JobBookingID, JobBookingNo: row.JobBookingNo,
      JobName: row.JobName, SalesOrderNo: "",
    });
    setModalOpen(true); setModalLoading(true);
    try {
      const [mainArr, detArr, consData, transData] = await Promise.all([
        apiPost<Record<string, unknown>[]>(`${API}/retrievemain`, { FGTransactionID: row.FGTransactionID }),
        apiPost<Record<string, unknown>[]>(`${API}/retrieve`, { FGTransactionID: row.FGTransactionID }),
        apiFetch<LookupLedger[]>(`${API}/consignees?clientId=${row.LedgerID}`),
        apiFetch<LookupLedger[]>(`${API}/transporters`),
      ]);

      setConsignees(Array.isArray(consData) ? consData : []);
      setTransporters(Array.isArray(transData) ? transData : []);

      const main = Array.isArray(mainArr) && mainArr.length > 0 ? mainArr[0] : {};
      setNoteNo(String(main.VoucherNo ?? row.VoucherNo ?? ""));
      setNoteDate(parseDisplayDate(String(main.VoucherDate ?? row.VoucherDate ?? "")));
      setConsigneeID(num(main.ConsigneeLedgerID ?? row.ConsigneeID));
      setTransporterID(num(main.Transporter ?? row.TransporterID));
      setTransporterName(String(main.TransporterName ?? row.TransporterName ?? ""));
      setVehicleNo(String(main.VehicleNo ?? row.VehicleNo ?? ""));
      setModeOfTransport(String(main.ModeOfTransport ?? row.ModeOfTransport ?? ""));
      setPodNo(String(main.PODNo ?? row.PODNo ?? ""));
      setNarration(String(main.Narration ?? row.Narration ?? ""));

      const details = Array.isArray(detArr) ? detArr : [];
      setLines(details.map((d, i) => savedToLine(d, i + 1)));
    } catch {
      showToast("error", "Failed to load dispatch for edit");
    } finally {
      setModalLoading(false);
    }
  };

  const savedToLine = (d: Record<string, unknown>, sn: number): Line => {
    const cartons = num(d.IssueOuterCarton);
    const qty     = num(d.PurchaseQuantity);
    const qtyPerCart = cartons > 0 ? qty / cartons : qty;
    return {
      sn,
      ParentFGTransactionID: num(d.ParentFGTransactionID),
      ParentFGTransactionDetailID: num(d.ParentFGTransactionDetailID),
      SemiPackingMainID: num(d.SemiPackingMainID), SemiPackingDetailID: num(d.SemiPackingDetailID),
      JobBookingID: num(d.JobBookingID), JobBookingJobCardContentsID: num(d.JobBookingJobCardContentsID),
      ProductMasterID: num(d.ProductMasterID), OrderBookingID: num(d.OrderBookingID),
      OrderBookingDetailsID: num(d.OrderBookingDetailsID), WarehouseID: num(d.WarehouseID),
      ProductHSNID: num(d.ProductHSNID),
      ProductCode: String(d.ProductCode ?? ""), ProductMasterCode: String(d.ProductMasterCode ?? ""),
      JobName: String(d.JobName ?? ""), PackingNo: String(d.PackingNo ?? ""),
      BatchNo: String(d.BatchNo ?? ""), HSNCode: String(d.HSNCode ?? ""),
      availableCartons: cartons, availableQty: qty, qtyPerCarton: qtyPerCart,
      InnerCarton: num(d.InnerCarton), QuantityPerPack: num(d.QuantityPerPack),
      Rate: num(d.PurchaseRate), Unit: String(d.PurchaseUnit ?? ""),
      CFT: num(d.CFT), CBCM: num(d.CBCM), ShipperLengthCM: num(d.ShipperLengthCM),
      ShipperWidthCM: num(d.ShipperWidthCM), ShipperHeightCM: num(d.ShipperHeightCM),
      WeightPerOuterCarton: num(d.WeightPerOuterCarton),
      GSTPercentage: num(d.GSTTaxPercentage), CGSTPercentage: num(d.CGSTTaxPercentage),
      SGSTPercentage: num(d.SGSTTaxPercentage), IGSTPercentage: num(d.IGSTTaxPercentage),
      dispatchCartons: String(cartons || ""),
    };
  };

  // ── Build payload ──────────────────────────────────────────────────────────
  function buildPayload() {
    if (!jobCtx) return null;
    const active = lines.filter(l => num(l.dispatchCartons) > 0);
    if (active.length === 0) return null;

    let totOuter = 0, totQty = 0, totBasic = 0, totTax = 0, net = 0;
    const details = active.map((l, i) => {
      const c = lineCalc(l);
      totOuter += c.cartons; totQty += c.qty; totBasic += c.basic;
      totTax += c.cgst + c.sgst + c.igst; net += c.net;
      return {
        TransID: i + 1,
        ParentFGTransactionID: l.ParentFGTransactionID,
        ParentFGTransactionDetailID: l.ParentFGTransactionDetailID,
        SemiPackingMainID: l.SemiPackingMainID, SemiPackingDetailID: l.SemiPackingDetailID,
        JobBookingID: l.JobBookingID, JobBookingJobCardContentsID: l.JobBookingJobCardContentsID,
        ProductMasterID: l.ProductMasterID,
        OrderBookingID: l.OrderBookingID, OrderBookingDetailsID: l.OrderBookingDetailsID,
        DeliveryOrderBookingID: l.OrderBookingID, DeliveryOrderBookingDetailsID: l.OrderBookingDetailsID,
        DeliveryJobBookingID: l.JobBookingID, DeliveryJobBookingJobCardContentsID: l.JobBookingJobCardContentsID,
        WarehouseID: l.WarehouseID, ProductHSNID: l.ProductHSNID,
        IssueOuterCarton: c.cartons, InnerCarton: l.InnerCarton, QuantityPerPack: l.QuantityPerPack,
        IssueQuantity: c.qty,
        Rate: l.Rate, Unit: l.Unit, BasicAmount: c.basic, DiscountPercentage: 0, TaxableAmount: c.taxable,
        GSTPercentage: l.GSTPercentage, CGSTPercentage: l.CGSTPercentage,
        SGSTPercentage: l.SGSTPercentage, IGSTPercentage: l.IGSTPercentage,
        CGSTAmount: c.cgst, SGSTAmount: c.sgst, IGSTAmount: c.igst, NetAmount: c.net,
        CFT: l.CFT, CBCM: l.CBCM, ShipperLengthCM: l.ShipperLengthCM,
        ShipperWidthCM: l.ShipperWidthCM, ShipperHeightCM: l.ShipperHeightCM,
        WeightPerOuterCarton: l.WeightPerOuterCarton, TotalWeight: c.weight, IssueTotalWeight: c.weight,
        BatchNo: l.BatchNo, Remark: "",
      };
    });

    const main = {
      LedgerID: jobCtx.LedgerID, ConsigneeLedgerID: consigneeID,
      Transporter: transporterID, TransporterName: transporterName,
      VehicleNo: vehicleNo, ModeOfTransport: modeOfTransport, PODNo: podNo, Narration: narration,
      VoucherDate: noteDate,
      TotalOuterCarton: totOuter, TotalQuantity: +totQty.toFixed(3),
      TotalBasicAmount: +totBasic.toFixed(2), TotalDiscountAmount: 0,
      TotalTaxAmount: +totTax.toFixed(2), NetAmount: +net.toFixed(2),
    };
    return { prefix: "DN", main, details };
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload) { showToast("error", "Enter cartons to dispatch on at least one line"); return; }
    setSaving(true);
    try {
      const res = await apiPost<string>(`${API}/save`, payload);
      if (typeof res === "string" && res.startsWith("Success")) {
        showToast("success", "Dispatch saved");
        setModalOpen(false); loadList();
      } else {
        showToast("error", typeof res === "string" ? res : "Save failed");
      }
    } catch { showToast("error", "Save failed"); }
    finally { setSaving(false); }
  };

  // ── Update ─────────────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!editFGID) return;
    const payload = buildPayload();
    if (!payload) { showToast("error", "Enter cartons to dispatch on at least one line"); return; }
    setSaving(true);
    try {
      const res = await apiPost<string>(`${API}/update`, { FGTransactionID: editFGID, ...payload });
      if (typeof res === "string" && res.startsWith("Success")) {
        showToast("success", "Dispatch updated");
        setModalOpen(false); loadList();
      } else {
        showToast("error", typeof res === "string" ? res : "Update failed");
      }
    } catch { showToast("error", "Update failed"); }
    finally { setSaving(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!editFGID) return;
    if (!confirm("Delete this dispatch? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await apiPost<string>(`${API}/delete`, { FGTransactionID: editFGID });
      if (typeof res === "string" && res.startsWith("Success")) {
        showToast("success", "Deleted successfully");
        setModalOpen(false); loadList();
      } else {
        showToast("error", typeof res === "string" ? res : "Delete failed");
      }
    } catch { showToast("error", "Delete failed"); }
    finally { setDeleting(false); }
  };

  // ── Line input ───────────────────────────────────────────────────────────────
  const setCartons = (sn: number, v: string) =>
    setLines(p => p.map(l => l.sn === sn ? { ...l, dispatchCartons: v } : l));

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totals = lines.reduce((acc, l) => {
    const c = lineCalc(l);
    acc.cartons += c.cartons; acc.qty += c.qty; acc.weight += c.weight; acc.net += c.net;
    return acc;
  }, { cartons: 0, qty: 0, weight: 0, net: 0 });

  // ── Sort + column-filter computations ────────────────────────────────────────
  const pendFiltered = pendingList.filter(r =>
    Object.entries(pendColFilters).every(([k, v]) =>
      !v || String(r[k as keyof PendingRow] ?? "").toLowerCase().includes(v.toLowerCase())
    )
  );
  const pendSorted = pendSort
    ? [...pendFiltered].sort((a, b) => {
        const av = String(a[pendSort.col] ?? "");
        const bv = String(b[pendSort.col] ?? "");
        const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
        return pendSort.dir === "asc" ? cmp : -cmp;
      })
    : pendFiltered;

  const procFiltered = processedList.filter(r =>
    Object.entries(procColFilters).every(([k, v]) =>
      !v || String(r[k as keyof ProcessedRow] ?? "").toLowerCase().includes(v.toLowerCase())
    )
  );
  const procSorted = procSort
    ? [...procFiltered].sort((a, b) => {
        const av = String(a[procSort.col] ?? "");
        const bv = String(b[procSort.col] ?? "");
        const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
        return procSort.dir === "asc" ? cmp : -cmp;
      })
    : procFiltered;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Module tabs ── */}
      <div className="flex gap-1 p-1 rounded-lg bg-gray-100 w-fit border border-gray-200">
        {([
          ["deliverynote", "Delivery Note / Challan"],
          ["coa", "Certificate of Analysis"],
          ["invoice", "Invoice"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setModuleTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              moduleTab === key ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {moduleTab === "coa" && <CoaTab />}

      {moduleTab === "invoice" && <InvoiceTab />}

      {moduleTab === "deliverynote" && (
      <>

      {/* ── Header: Tabs + Filter ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 p-1 rounded-lg bg-gray-100 w-fit">
          {(["pending", "processed"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "pending" ? "Pending for Dispatch" : "Dispatched"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tab === "processed" && (
            <>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={loadList} disabled={listLoading}
            icon={listLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* ── List Table ── */}
      {tab === "pending" ? (
        <DataTable<PendingRow>
          data={pendingList}
          loading={listLoading}
          getRowId={r => String(r.OrderBookingDetailsID ?? r.JobBookingID)}
          columns={[
            {
              key: "JobBookingNo", header: "Job No.",
              render: r => <span className="font-medium text-blue-700">{r.JobBookingNo}</span>,
            },
            { key: "JobName", header: "Job Name" },
            { key: "ClientName", header: "Customer" },
            { key: "SalesOrderNo", header: "Sales Order" },
            { key: "PONo", header: "PO No." },
            {
              key: "FinishGoodsQty", header: "FG Stock Qty",
              render: r => <span className="font-medium text-green-700">{num(r.FinishGoodsQty).toLocaleString()}</span>,
            },
            {
              key: "TotalFGOuterCartons", header: "Boxes",
              render: r => <span>{num(r.TotalFGOuterCartons)}</span>,
            },
            {
              key: "PendingQuantity", header: "Pending Qty",
              render: r => <span>{num(r.PendingQuantity).toLocaleString()}</span>,
            },
          ]}
          actions={r => (
            <Button size="sm" variant="secondary" pill icon={<Plus size={12} />} onClick={() => openNew(r)}>
              Dispatch
            </Button>
          )}
        />
      ) : (
        <DataTable<ProcessedRow>
          data={processedList}
          loading={listLoading}
          getRowId={r => String(r.FGTransactionID)}
          columns={[
            {
              key: "VoucherNo", header: "Note No.",
              render: r => <span className="font-medium text-blue-700">{r.VoucherNo}</span>,
            },
            { key: "VoucherDate", header: "Date" },
            { key: "LedgerName", header: "Customer" },
            { key: "JobBookingNo", header: "Job No." },
            { key: "JobName", header: "Job Name" },
            {
              key: "TotalOuterCarton", header: "Boxes",
              render: r => <span>{num(r.TotalOuterCarton)}</span>,
            },
            {
              key: "TotalQuantity", header: "Total Qty",
              render: r => <span>{num(r.TotalQuantity).toLocaleString()}</span>,
            },
            { key: "VehicleNo", header: "Vehicle" },
            {
              key: "NetAmount", header: "Net Amt",
              render: r => <span>{num(r.NetAmount).toLocaleString()}</span>,
            },
          ]}
          actions={r => (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="secondary" pill icon={<Pencil size={12} />} onClick={() => openEdit(r)}>
                Edit
              </Button>
              <Button size="sm" variant="secondary" pill icon={<FileText size={12} />} onClick={() => printChallan(r.FGTransactionID)}>
                Print
              </Button>
            </div>
          )}
        />
      )}

      {/* ══ Dispatch Modal ══════════════════════════════════════════════════════ */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editMode ? `Edit Dispatch — ${noteNo}` : "New Dispatch"}
        size="xl"
      >
        {modalLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* ─ Job Info ─ */}
            <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Job Information</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><div className={lbl}>Job No</div><div className={ro}>{jobCtx?.JobBookingNo || "—"}</div></div>
                <div><div className={lbl}>Job Name</div><div className={ro}>{jobCtx?.JobName || "—"}</div></div>
                <div><div className={lbl}>Customer</div><div className={ro}>{jobCtx?.ClientName || "—"}</div></div>
                <div><div className={lbl}>Sales Order</div><div className={ro}>{jobCtx?.SalesOrderNo || "—"}</div></div>
              </div>
            </div>

            {/* ─ Header ─ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="Note No" value={noteNo} readOnly />
              <Input label="Note Date" type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)} />
              <Select label="Consignee" value={String(consigneeID)} onChange={e => setConsigneeID(Number(e.target.value))} options={[{value:"0",label:"— Same as customer —"}, ...consignees.map(c=>({value:String(c.ConsigneeID),label:c.ConsigneeName ?? ""}))]} />
              <Select label="Transporter" value={String(transporterID)} onChange={e => { const id=Number(e.target.value); setTransporterID(id); setTransporterName(transporters.find(t=>t.TransporterID===id)?.TransporterName ?? ""); }} options={[{value:"0",label:"— Select —"}, ...transporters.map(t=>({value:String(t.TransporterID),label:t.TransporterName ?? ""}))]} />
              <Input label="Vehicle No" value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} placeholder="e.g. MH-01-AB-1234" />
              <Input label="Mode of Transport" value={modeOfTransport} onChange={e => setModeOfTransport(e.target.value)} placeholder="Road / Rail / Air" />
              <Input label="POD / LR No" value={podNo} onChange={e => setPodNo(e.target.value)} />
              <Input label="Narration" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Remarks" />
            </div>

            {/* ─ FG Lines ─ */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                Enter cartons to dispatch for each finished-goods line
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      {["#", "Packing No", "Product / Job", "Batch", "Avail. Boxes", "Avail. Qty", "Dispatch Boxes", "Dispatch Qty", "Rate", "Weight", "Net Amt"].map(h => (
                        <th key={h} className={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-8 text-gray-400 text-sm">
                          No finished-goods stock lines
                        </td>
                      </tr>
                    ) : lines.map(l => {
                      const c = lineCalc(l);
                      const over = !editMode && c.cartons > l.availableCartons;
                      return (
                        <tr key={l.sn} className={c.cartons > 0 ? "bg-blue-50" : "hover:bg-gray-50"}>
                          <td className={td}>{l.sn}</td>
                          <td className={td}>{l.PackingNo}</td>
                          <td className={td}>
                            <span className="block max-w-[180px] truncate" title={l.ProductMasterCode || l.ProductCode || l.JobName}>
                              {l.ProductMasterCode || l.ProductCode || l.JobName}
                            </span>
                          </td>
                          <td className={td}>{l.BatchNo}</td>
                          <td className={`${td} text-right`}>{l.availableCartons}</td>
                          <td className={`${td} text-right`}>{l.availableQty.toLocaleString()}</td>
                          <td className={td}>
                            <Input type="number" min={0} max={editMode ? undefined : l.availableCartons} value={l.dispatchCartons} onChange={e => setCartons(l.sn, e.target.value)} className="w-20" />
                          </td>
                          <td className={`${td} text-right font-medium`}>{c.qty.toLocaleString()}</td>
                          <td className={`${td} text-right`}>{l.Rate}</td>
                          <td className={`${td} text-right`}>{c.weight}</td>
                          <td className={`${td} text-right`}>{c.net.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {lines.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td className={td} colSpan={6}>TOTAL</td>
                        <td className={`${td} text-right`}>{totals.cartons}</td>
                        <td className={`${td} text-right`}>{totals.qty.toLocaleString()}</td>
                        <td className={td} />
                        <td className={`${td} text-right`}>{totals.weight.toFixed(2)}</td>
                        <td className={`${td} text-right`}>{totals.net.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* ─ Actions ─ */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100 flex-wrap">
              {!editMode ? (
                <Button variant="primary" loading={saving} icon={<Truck size={14} />}
                  onClick={handleSave} disabled={saving || totals.cartons === 0}>
                  Save Dispatch
                </Button>
              ) : (
                <>
                  <Button variant="primary" loading={saving} onClick={handleUpdate} disabled={saving}>
                    Update
                  </Button>
                  <Button variant="danger" loading={deleting} onClick={handleDelete} disabled={deleting}
                    icon={<Trash2 size={14} />}>
                    Delete
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            </div>

          </div>
        )}
      </Modal>

      </>
      )}

    </div>
  );
}
