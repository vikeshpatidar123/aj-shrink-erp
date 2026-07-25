"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, Plus, Pencil, Trash2, ShieldCheck,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const API = "api/jobqcpackingShrink";

// ── Helpers ────────────────────────────────────────────────────────────────────
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
function n(v: unknown) { const p = parseFloat(String(v)); return isNaN(p) ? 0 : p; }
function parseDisplayDate(d: string): string {
  if (!d) return todayStr();
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const m = d.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) return `${m[3]}-${months[m[2]] ?? "01"}-${m[1]}`;
  return d.slice(0, 10);
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface PendingRow {
  SemiPackingMainID: number; SemiPackingNo: string; SemiPackingDate: string;
  JobBookingNo: string; JobBookingID: number; JobName: string;
  LedgerName: string; SalesOrderNo: string; OrderQuantity: number;
  SemiPackedQuantity: number; QCApprovedQuantity: number;
  JobBookingJobCardContentsID: number; ProductMasterID: number;
  BookingID: number; OrderBookingID: number; OrderBookingDetailsID: number;
  LedgerID: number; ResortingTransactionID: number;
  ExpectedDeliveryDate: string; PONo: string; ProductCode: string;
  JobCardQuantity: number;
}

interface ProcessedRow {
  FGTransactionID: number; VoucherNo: string; VoucherDate: string;
  JobBookingNo: string; JobName: string; LedgerName: string;
  TotalQuantity: number; TotalOuterCarton: number; TotalInnerCarton: number;
  CheckedBy: string; PONo: string; ProductCode: string; JobBookingID: number;
}

interface SemiPackingRow {
  SemiPackingMainID: number; SemiPackingDetailID: number;
  JobBookingID: number; JobBookingJobCardContentsID: number;
  OrderBookingID: number; OrderBookingDetailsID: number;
  SemiPackingNo: string; InnerCarton: number;
  QuantityPerPack: number; PackedQuantity: number;
  PackedInnerCarton: number; PackingDescription: string;
  TransID: number; ProductMasterID: number; BookingID: number;
  ResortingTransactionID: number;
  sameBox: boolean; bundlesPerBox: string;
}

interface PwoBatchRow {
  JobBookingID: number; Quantity: number; BatchNo: string;
  MfgDate: string; ExpDate: string; selected: boolean;
}

interface QcPackingRow {
  sn: number;
  SemiPackingMainID: number; SemiPackingDetailID: number;
  JobBookingID: number; JobBookingJobCardContentsID: number;
  ProductMasterID: number; BookingID: number;
  OrderBookingID: number; OrderBookingDetailsID: number;
  OuterCarton: number; InnerCarton: number;
  QuantityPerPack: string; ReceiptQuantity: number;
  WeightPerOuterCarton: number; TotalWeight: number;
  ShipperLengthCM: number; ShipperWidthCM: number; ShipperHeightCM: number;
  CBCM: number; CFT: number; TotalCFT: number;
  BatchNo: string; WarehouseID: number; PackingDescription: string;
}

interface SemiPackingTempRow {
  sn: number;
  SemiPackingMainID: number; SemiPackingDetailID: number;
  JobBookingID: number; ProductMasterID: number; BookingID: number;
  OrderBookingID: number; OrderBookingDetailsID: number;
  JobBookingJobCardContentsID: number;
  OuterCarton: number; InnerCarton: number;
  QuantityPerPack: number; QuantityPerOuter: number;
  PackedQuantity: number; BatchNo: string;
}

interface JobContext {
  SemiPackingMainID: number; JobBookingID: number; JobBookingNo: string;
  JobName: string; LedgerName: string; LedgerID: number;
  OrderQuantity: number; SemiPackedQuantity: number;
  JobBookingJobCardContentsID: number; ProductMasterID: number;
  BookingID: number; OrderBookingID: number; OrderBookingDetailsID: number;
  ResortingTransactionID: number;
}

// ── CSS helpers ────────────────────────────────────────────────────────────────
const lbl = "block text-xs font-medium text-gray-600 mb-0.5";
const inp = "w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white";
const ro  = "w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-gray-50 text-gray-700";
const th  = "px-2 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-gray-50";
const td  = "px-2 py-1.5 text-sm text-gray-700 whitespace-nowrap";

// ══════════════════════════════════════════════════════════════════════════════
export default function QcPackingPage() {
  const { showToast } = useToast();

  // ── List state ─────────────────────────────────────────────────────────────
  const [tab, setTab]               = useState<"pending" | "processed">("pending");
  const [fromDate, setFromDate]     = useState(daysAgoStr(15));
  const [toDate, setToDate]         = useState(todayStr());
  const [pendingList, setPendingList]     = useState<PendingRow[]>([]);
  const [processedList, setProcessedList] = useState<ProcessedRow[]>([]);
  const [listLoading, setListLoading]     = useState(false);

  // ── Modal meta ─────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen]   = useState(false);
  const [editMode, setEditMode]     = useState(false);
  const [editFGID, setEditFGID]     = useState<number | null>(null);
  const [jobCtx, setJobCtx]         = useState<JobContext | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);

  // ── Form header ────────────────────────────────────────────────────────────
  const [voucherNo, setVoucherNo]   = useState("");
  const [voucherDate, setVoucherDate] = useState(todayStr());
  const [checkedBy, setCheckedBy]   = useState("");
  const [narration, setNarration]   = useState("");

  // ── Warehouse / Bin ────────────────────────────────────────────────────────
  const [warehouses, setWarehouses]     = useState<string[]>([]);
  const [warehouseName, setWarehouseName] = useState("");
  const [bins, setBins]                 = useState<{ WarehouseID: number; Bin: string }[]>([]);
  const [warehouseID, setWarehouseID]   = useState(0);
  const [binName, setBinName]           = useState("");

  // ── Semi-packing source ────────────────────────────────────────────────────
  const [semiRows, setSemiRows]     = useState<SemiPackingRow[]>([]);

  // ── Batch ─────────────────────────────────────────────────────────────────
  const [batchRows, setBatchRows]   = useState<PwoBatchRow[]>([]);

  // ── CFC inputs ────────────────────────────────────────────────────────────
  const [qcAppro, setQcAppro]       = useState("1");
  const [weight, setWeight]         = useState("");
  const [cfcL, setCfcL]             = useState("");
  const [cfcW, setCfcW]             = useState("");
  const [cfcH, setCfcH]             = useState("");

  // ── Output rows ───────────────────────────────────────────────────────────
  const [qcRows, setQcRows]         = useState<QcPackingRow[]>([]);
  const [tempDet, setTempDet]       = useState<SemiPackingTempRow[]>([]);

  // ── Re-adjust ─────────────────────────────────────────────────────────────
  const [raOpen, setRaOpen]         = useState(false);
  const [raSN, setRaSN]             = useState<number | null>(null);
  const [raEdits, setRaEdits]       = useState<Record<number, string>>({});

  // ── Derived ───────────────────────────────────────────────────────────────
  const cbcm = n(cfcL) * n(cfcW) * n(cfcH);
  const cft  = cbcm > 0 ? cbcm / 28316.85 : 0;

  // ── Load list ──────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      if (tab === "pending") {
        const data = await apiFetch<PendingRow[]>(
          `${API}/pending?fromDate=${fromDate}&toDate=${toDate}`
        );
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

  // ── Warehouse change ───────────────────────────────────────────────────────
  const handleWarehouseChange = async (name: string) => {
    setWarehouseName(name);
    setBinName(""); setWarehouseID(0); setBins([]);
    if (!name) return;
    const data = await apiFetch<{ WarehouseID: number; Bin: string }[]>(
      `${API}/bins?warehouseName=${encodeURIComponent(name)}`
    );
    setBins(Array.isArray(data) ? data : []);
  };

  // ── Reset modal state ──────────────────────────────────────────────────────
  const resetForm = () => {
    setQcRows([]); setTempDet([]); setSemiRows([]); setBatchRows([]);
    setVoucherNo(""); setVoucherDate(todayStr()); setCheckedBy(""); setNarration("");
    setWarehouseName(""); setWarehouseID(0); setBinName(""); setBins([]);
    setQcAppro("1"); setWeight(""); setCfcL(""); setCfcW(""); setCfcH("");
  };

  // ── Open new modal ─────────────────────────────────────────────────────────
  const openNew = async (row: PendingRow) => {
    resetForm();
    setEditMode(false); setEditFGID(null);
    setJobCtx({
      SemiPackingMainID: row.SemiPackingMainID, JobBookingID: row.JobBookingID,
      JobBookingNo: row.JobBookingNo, JobName: row.JobName,
      LedgerName: row.LedgerName, LedgerID: row.LedgerID,
      OrderQuantity: row.OrderQuantity, SemiPackedQuantity: row.SemiPackedQuantity,
      JobBookingJobCardContentsID: row.JobBookingJobCardContentsID,
      ProductMasterID: row.ProductMasterID, BookingID: row.BookingID,
      OrderBookingID: row.OrderBookingID, OrderBookingDetailsID: row.OrderBookingDetailsID,
      ResortingTransactionID: row.ResortingTransactionID,
    });
    setModalOpen(true); setModalLoading(true);
    try {
      const [spData, bData, vno, whData] = await Promise.all([
        apiFetch<SemiPackingRow[]>(`${API}/semipackingdetails/${row.SemiPackingMainID}`),
        apiFetch<PwoBatchRow[]>(`${API}/pwobatchdetails/${row.JobBookingID}`),
        apiFetch<string>(`${API}/voucherno`),
        apiFetch<{ Warehouse: string }[]>(`${API}/warehouses`),
      ]);
      setSemiRows((Array.isArray(spData) ? spData : []).map(r => ({ ...r, sameBox: false, bundlesPerBox: "" })));
      setBatchRows((Array.isArray(bData) ? bData : []).map(r => ({ ...r, selected: false })));
      setVoucherNo(typeof vno === "string" ? vno : "");
      setWarehouses(Array.isArray(whData) ? whData.map((d: { Warehouse: string }) => d.Warehouse) : []);
    } catch {
      showToast("error", "Failed to load modal data");
    } finally {
      setModalLoading(false);
    }
  };

  // ── Open edit modal ────────────────────────────────────────────────────────
  const openEdit = async (row: ProcessedRow) => {
    resetForm();
    setEditMode(true); setEditFGID(row.FGTransactionID);
    setModalOpen(true); setModalLoading(true);
    try {
      const [detData, spSaved, whData] = await Promise.all([
        apiPost<Record<string, unknown>[]>(`${API}/retrieve`, { FGTransactionID: row.FGTransactionID }),
        apiPost<Record<string, unknown>[]>(`${API}/retrievesemipacking`, { FGTransactionID: row.FGTransactionID }),
        apiFetch<{ Warehouse: string }[]>(`${API}/warehouses`),
      ]);

      setWarehouses(Array.isArray(whData) ? whData.map((d: { Warehouse: string }) => d.Warehouse) : []);
      const details = Array.isArray(detData) ? detData : [];
      const savedSP = Array.isArray(spSaved) ? spSaved : [];

      if (details.length === 0) { showToast("error", "No data found for this record"); return; }

      const first = details[0];
      const smpID = n(first.FGM_SemiPackingMainID || first.SemiPackingMainID);
      const jbID  = n(first.JobBookingID || row.JobBookingID);

      setJobCtx({
        SemiPackingMainID: smpID, JobBookingID: jbID,
        JobBookingNo: String(first.JobBookingNo ?? row.JobBookingNo ?? ""),
        JobName: String(first.JobName ?? row.JobName ?? ""),
        LedgerName: String(first.LedgerName ?? row.LedgerName ?? ""),
        LedgerID: n(first.LedgerID), OrderQuantity: n(first.OrderQuantity),
        SemiPackedQuantity: n(first.SemiPackedQuantity),
        JobBookingJobCardContentsID: n(first.JobBookingJobCardContentsID),
        ProductMasterID: n(first.ProductMasterID), BookingID: n(first.BookingID),
        OrderBookingID: n(first.OrderBookingID),
        OrderBookingDetailsID: n(first.OrderBookingDetailsID),
        ResortingTransactionID: n(first.ResortingTransactionID),
      });

      setVoucherNo(String(first.VoucherNo ?? ""));
      setVoucherDate(parseDisplayDate(String(first.VoucherDate ?? "")));
      setCheckedBy(String(first.CheckedBy ?? ""));
      setNarration(String(first.Narration ?? ""));

      const wn = String(first.WarehouseName ?? "");
      setWarehouseName(wn); setBinName(String(first.BinName ?? "")); setWarehouseID(n(first.WarehouseID));

      if (wn) {
        const binData = await apiFetch<{ WarehouseID: number; Bin: string }[]>(
          `${API}/bins?warehouseName=${encodeURIComponent(wn)}`
        );
        setBins(Array.isArray(binData) ? binData : []);
      }

      const built: QcPackingRow[] = details.map((d, i) => ({
        sn: i + 1,
        SemiPackingMainID: n(d.SemiPackingMainID), SemiPackingDetailID: n(d.SemiPackingDetailID),
        JobBookingID: n(d.JobBookingID), JobBookingJobCardContentsID: n(d.JobBookingJobCardContentsID),
        ProductMasterID: n(d.ProductMasterID), BookingID: n(d.BookingID),
        OrderBookingID: n(d.OrderBookingID), OrderBookingDetailsID: n(d.OrderBookingDetailsID),
        OuterCarton: n(d.OuterCarton), InnerCarton: n(d.InnerCarton),
        QuantityPerPack: String(d.PackingDescription ?? d.QuantityPerPack ?? ""),
        ReceiptQuantity: n(d.PackedQuantity),
        WeightPerOuterCarton: n(d.WeightPerOuter), TotalWeight: n(d.TotalWeight),
        ShipperLengthCM: n(d.CFCLength), ShipperWidthCM: n(d.CFCWidth), ShipperHeightCM: n(d.CFCHeight),
        CBCM: n(d.CBCM), CFT: n(d.CFT), TotalCFT: n(d.TotalCFT),
        BatchNo: String(d.BatchNo ?? ""), WarehouseID: n(d.WarehouseID),
        PackingDescription: String(d.PackingDescription ?? ""),
      }));
      setQcRows(built);

      const builtTemp: SemiPackingTempRow[] = savedSP.map((sp) => ({
        sn: n(sp.SN),
        SemiPackingMainID: n(sp.SemiPackingMainID), SemiPackingDetailID: n(sp.SemiPackingDetailID),
        JobBookingID: n(sp.JobBookingID), ProductMasterID: n(sp.ProductMasterID),
        BookingID: n(sp.BookingID), OrderBookingID: n(sp.OrderBookingID),
        OrderBookingDetailsID: n(sp.OrderBookingDetailsID),
        JobBookingJobCardContentsID: n(sp.JobBookingJobCardContentsID),
        OuterCarton: n(sp.OuterCarton), InnerCarton: n(sp.InnerCarton),
        QuantityPerPack: n(sp.QuantityPerPack), QuantityPerOuter: n(sp.QuantityPerOuter),
        PackedQuantity: n(sp.PackedQuantity), BatchNo: String(sp.BatchNo ?? ""),
      }));
      setTempDet(builtTemp);

      const [spSrc, bData] = await Promise.all([
        apiFetch<SemiPackingRow[]>(`${API}/semipackingdetails/${smpID}`),
        apiFetch<PwoBatchRow[]>(`${API}/pwobatchdetails/${jbID}`),
      ]);
      setSemiRows((Array.isArray(spSrc) ? spSrc : []).map(r => ({ ...r, sameBox: false, bundlesPerBox: "" })));
      setBatchRows((Array.isArray(bData) ? bData : []).map(r => ({ ...r, selected: false })));
    } catch (e) {
      showToast("error", "Failed to load edit data");
    } finally {
      setModalLoading(false);
    }
  };

  // ── Add CFC ────────────────────────────────────────────────────────────────
  const addCFC = () => {
    const batch = batchRows.find(b => b.selected);
    if (!batch) { showToast("error", "Select a batch first"); return; }
    const appro = parseInt(qcAppro) || 0;
    const wt    = n(weight);
    if (appro <= 0) { showToast("error", "Enter QC Approved Boxes ≥ 1"); return; }
    if (wt <= 0)    { showToast("error", "Enter weight per box"); return; }

    const checked = semiRows.filter(r => r.sameBox && parseInt(r.bundlesPerBox) >= 1);
    if (checked.length === 0) {
      showToast("error", "Check at least one semi-packing row and enter bundles ≥ 1");
      return;
    }

    for (const row of checked) {
      const bundles  = parseInt(row.bundlesPerBox);
      const used     = tempDet
        .filter(t => t.SemiPackingDetailID === row.SemiPackingDetailID)
        .reduce((s, t) => s + t.InnerCarton, 0);
      const available = row.InnerCarton - row.PackedInnerCarton - used;
      if (appro * bundles > available) {
        showToast(
          "error",
          `Row ${row.SemiPackingDetailID}: need ${appro * bundles} bundles but only ${available} available`
        );
        return;
      }
    }

    const sn           = qcRows.length + 1;
    const qppStr       = checked.map(r => `${r.bundlesPerBox} Bndls X ${r.QuantityPerPack} Qty`).join(" + ");
    const totalInner   = checked.reduce((s, r) => s + parseInt(r.bundlesPerBox), 0);
    const qtyPerBox    = checked.reduce((s, r) => s + parseInt(r.bundlesPerBox) * r.QuantityPerPack, 0);
    const cbcmVal      = n(cfcL) * n(cfcW) * n(cfcH);
    const cftVal       = cbcmVal > 0 ? cbcmVal / 28316.85 : 0;
    const first        = checked[0];

    const newRow: QcPackingRow = {
      sn,
      SemiPackingMainID: first.SemiPackingMainID,
      SemiPackingDetailID: first.SemiPackingDetailID,
      JobBookingID: first.JobBookingID,
      JobBookingJobCardContentsID: first.JobBookingJobCardContentsID,
      ProductMasterID: first.ProductMasterID, BookingID: first.BookingID,
      OrderBookingID: first.OrderBookingID, OrderBookingDetailsID: first.OrderBookingDetailsID,
      OuterCarton: appro, InnerCarton: totalInner,
      QuantityPerPack: qppStr, ReceiptQuantity: appro * qtyPerBox,
      WeightPerOuterCarton: wt, TotalWeight: appro * wt,
      ShipperLengthCM: n(cfcL), ShipperWidthCM: n(cfcW), ShipperHeightCM: n(cfcH),
      CBCM: cbcmVal, CFT: cftVal, TotalCFT: cftVal * appro,
      BatchNo: batch.BatchNo, WarehouseID: warehouseID,
      PackingDescription: `${appro} Box - ${qppStr}`,
    };

    const newTemp: SemiPackingTempRow[] = checked.map(r => ({
      sn,
      SemiPackingMainID: r.SemiPackingMainID, SemiPackingDetailID: r.SemiPackingDetailID,
      JobBookingID: r.JobBookingID, ProductMasterID: r.ProductMasterID,
      BookingID: r.BookingID, OrderBookingID: r.OrderBookingID,
      OrderBookingDetailsID: r.OrderBookingDetailsID,
      JobBookingJobCardContentsID: r.JobBookingJobCardContentsID,
      OuterCarton: appro, InnerCarton: parseInt(r.bundlesPerBox),
      QuantityPerPack: r.QuantityPerPack,
      QuantityPerOuter: parseInt(r.bundlesPerBox) * r.QuantityPerPack,
      PackedQuantity: appro * parseInt(r.bundlesPerBox) * r.QuantityPerPack,
      BatchNo: batch.BatchNo,
    }));

    setQcRows(p => [...p, newRow]);
    setTempDet(p => [...p, ...newTemp]);
    setQcAppro("1"); setWeight(""); setCfcL(""); setCfcW(""); setCfcH("");
    setSemiRows(p => p.map(r => ({ ...r, sameBox: false, bundlesPerBox: "" })));
  };

  // ── Build save payload ─────────────────────────────────────────────────────
  function buildPayload() {
    if (!jobCtx) return null;
    const totalOuter = qcRows.reduce((s, r) => s + r.OuterCarton, 0);
    const totalInner = qcRows.reduce((s, r) => s + r.InnerCarton, 0);
    const totalQty   = qcRows.reduce((s, r) => s + r.ReceiptQuantity, 0);

    const main = {
      SemiPackingMainID: jobCtx.SemiPackingMainID, JobBookingID: jobCtx.JobBookingID,
      JobBookingJobCardContentsID: jobCtx.JobBookingJobCardContentsID,
      ProductMasterID: jobCtx.ProductMasterID, BookingID: jobCtx.BookingID,
      OrderBookingID: jobCtx.OrderBookingID, OrderBookingDetailsID: jobCtx.OrderBookingDetailsID,
      LedgerID: jobCtx.LedgerID, ResortingTransactionID: jobCtx.ResortingTransactionID,
      TotalQuantity: totalQty, TotalOuterCarton: totalOuter, TotalInnerCarton: totalInner,
      Narration: narration, CheckedBy: checkedBy,
    };
    const details = qcRows.map(r => ({
      TransID: r.sn, SemiPackingMainID: r.SemiPackingMainID,
      SemiPackingDetailID: r.SemiPackingDetailID, JobBookingID: r.JobBookingID,
      JobBookingJobCardContentsID: r.JobBookingJobCardContentsID,
      ProductMasterID: r.ProductMasterID, BookingID: r.BookingID,
      OrderBookingID: r.OrderBookingID, OrderBookingDetailsID: r.OrderBookingDetailsID,
      ReceiptQuantity: r.ReceiptQuantity, OuterCarton: r.OuterCarton, InnerCarton: r.InnerCarton,
      QuantityPerPack: r.QuantityPerPack, WeightPerOuterCarton: r.WeightPerOuterCarton,
      TotalWeight: r.TotalWeight, ShipperLengthCM: r.ShipperLengthCM,
      ShipperWidthCM: r.ShipperWidthCM, ShipperHeightCM: r.ShipperHeightCM,
      CBCM: r.CBCM, CFT: r.CFT, TotalCFT: r.TotalCFT,
      BatchNo: r.BatchNo, WarehouseID: warehouseID, PackingDescription: r.PackingDescription,
    }));
    const semiPacking = tempDet.map(t => ({
      SemiPackingMainID: t.SemiPackingMainID, SemiPackingDetailID: t.SemiPackingDetailID,
      JobBookingID: t.JobBookingID, ProductMasterID: t.ProductMasterID,
      BookingID: t.BookingID, OrderBookingID: t.OrderBookingID,
      OrderBookingDetailsID: t.OrderBookingDetailsID,
      JobBookingJobCardContentsID: t.JobBookingJobCardContentsID,
      OuterCarton: t.OuterCarton, InnerCarton: t.InnerCarton,
      QuantityPerPack: t.QuantityPerPack, QuantityPerOuter: t.QuantityPerOuter,
      PackedQuantity: t.PackedQuantity, BatchNo: t.BatchNo, SN: t.sn,
    }));
    return { main, details, semiPacking };
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (qcRows.length === 0) { showToast("error", "Add at least one CFC row"); return; }
    if (!warehouseID)        { showToast("error", "Select warehouse and bin"); return; }
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    try {
      const res = await apiPost<string>(`${API}/save`, payload);
      if (typeof res === "string" && res.startsWith("Success")) {
        showToast("success", "QC Packing saved");
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
    if (qcRows.length === 0) { showToast("error", "Add at least one CFC row"); return; }
    if (!warehouseID)        { showToast("error", "Select warehouse and bin"); return; }
    const payload = buildPayload();
    if (!payload) return;
    const totalOuter = qcRows.reduce((s, r) => s + r.OuterCarton, 0);
    const totalInner = qcRows.reduce((s, r) => s + r.InnerCarton, 0);
    const totalQty   = qcRows.reduce((s, r) => s + r.ReceiptQuantity, 0);
    setSaving(true);
    try {
      const res = await apiPost<string>(`${API}/update`, {
        FGTransactionID: editFGID,
        main: { TotalQuantity: totalQty, TotalOuterCarton: totalOuter, TotalInnerCarton: totalInner, Narration: narration, CheckedBy: checkedBy },
        details: payload.details,
        semiPacking: payload.semiPacking,
      });
      if (typeof res === "string" && res.startsWith("Success")) {
        showToast("success", "QC Packing updated");
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
    if (!confirm("Delete this QC Packing record? This cannot be undone.")) return;
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

  // ── Re-adjust ──────────────────────────────────────────────────────────────
  const raRows = raSN !== null ? tempDet.filter(t => t.sn === raSN) : [];

  const openReadjust = (sn: number) => {
    setRaSN(sn); setRaEdits({}); setRaOpen(true);
  };

  const saveReadjust = async () => {
    if (raRows.length === 0) return;
    const spDetailIDs = raRows.map(r => r.SemiPackingDetailID).join(",");
    const spMainIDs   = raRows.map(r => r.SemiPackingMainID).join(",");
    const innerCartons = raRows.map((r, i) => raEdits[i] ?? r.InnerCarton).join(",");
    const qtyPerPacks  = raRows.map(r => r.QuantityPerPack).join(",");
    const packedQtys   = raRows.map((r, i) => {
      const ic = n(raEdits[i] ?? r.InnerCarton);
      return ic * r.QuantityPerPack;
    }).join(",");
    try {
      const res = await apiPost<string>(`${API}/updatesemipackingdetails`, {
        InnerCarton: innerCartons, PackedQuantity: packedQtys, QuantityPerPack: qtyPerPacks,
        SemiPackingMainID: spMainIDs, SemiPackingDetailID: spDetailIDs,
      });
      if (typeof res === "string" && res === "Success") {
        showToast("success", "Bundle adjustments saved");
        setRaOpen(false);
      } else {
        showToast("error", typeof res === "string" ? res : "Failed to save adjustments");
      }
    } catch { showToast("error", "Failed to save adjustments"); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Header: Tabs + Filter ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 p-1 rounded-lg bg-gray-100 w-fit">
          {(["pending", "processed"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "pending" ? "Pending for QC" : "QC Packed Jobs"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <Button size="sm" variant="secondary" onClick={loadList} disabled={listLoading}
            icon={listLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* ── List Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {listLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : tab === "pending" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr>
                  {["#", "Semi-Packing No", "Packing Date", "Customer", "Job No", "Job Name", "Order Qty", "Semi-Packed Qty", "QC Approved Qty", ""].map(h => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-gray-400 text-sm">
                      No pending jobs found in the selected date range
                    </td>
                  </tr>
                ) : pendingList.map((row, i) => (
                  <tr key={row.SemiPackingMainID}
                    className="hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => openNew(row)}>
                    <td className={td}>{i + 1}</td>
                    <td className={td}>
                      <span className="font-medium text-blue-700">{row.SemiPackingNo}</span>
                    </td>
                    <td className={td}>{row.SemiPackingDate}</td>
                    <td className={td}>{row.LedgerName}</td>
                    <td className={td}>{row.JobBookingNo}</td>
                    <td className={td}>{row.JobName}</td>
                    <td className={`${td} text-right`}>{row.OrderQuantity?.toLocaleString()}</td>
                    <td className={`${td} text-right`}>{row.SemiPackedQuantity?.toLocaleString()}</td>
                    <td className={`${td} text-right`}>{row.QCApprovedQuantity?.toLocaleString()}</td>
                    <td className={td}>
                      <Button size="sm" variant="primary"
                        icon={<Plus size={12} />}
                        onClick={e => { e.stopPropagation(); openNew(row); }}>
                        Create
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr>
                  {["#", "Voucher No", "Date", "Customer", "Job No", "Job Name", "Boxes", "Total Qty", "Checked By", ""].map(h => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {processedList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-gray-400 text-sm">
                      No QC packed records found in the selected date range
                    </td>
                  </tr>
                ) : processedList.map((row, i) => (
                  <tr key={row.FGTransactionID} className="hover:bg-gray-50 transition-colors">
                    <td className={td}>{i + 1}</td>
                    <td className={td}>
                      <span className="font-medium text-blue-700">{row.VoucherNo}</span>
                    </td>
                    <td className={td}>{row.VoucherDate}</td>
                    <td className={td}>{row.LedgerName}</td>
                    <td className={td}>{row.JobBookingNo}</td>
                    <td className={td}>{row.JobName}</td>
                    <td className={`${td} text-right`}>{row.TotalOuterCarton}</td>
                    <td className={`${td} text-right`}>{row.TotalQuantity?.toLocaleString()}</td>
                    <td className={td}>{row.CheckedBy}</td>
                    <td className={td}>
                      <Button size="sm" variant="secondary"
                        icon={<Pencil size={12} />}
                        onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ QC Packing Modal ════════════════════════════════════════════════════ */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editMode ? `Edit QC Packing — ${voucherNo}` : "New QC Packing"}
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
                <div><div className={lbl}>Customer</div><div className={ro}>{jobCtx?.LedgerName || "—"}</div></div>
                <div><div className={lbl}>Order Qty</div><div className={ro}>{jobCtx?.OrderQuantity?.toLocaleString() || "—"}</div></div>
              </div>
            </div>

            {/* ─ Voucher Header ─ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="Voucher No" value={voucherNo} readOnly />
              <Input label="Voucher Date" type="date" value={voucherDate}
                onChange={e => setVoucherDate(e.target.value)} />
              <Input label="Checked By" value={checkedBy} onChange={e => setCheckedBy(e.target.value)}
                placeholder="Inspector name" />
              <Input label="Narration" value={narration} onChange={e => setNarration(e.target.value)}
                placeholder="Remarks" />
            </div>

            {/* ─ Semi-Packing Source Table ─ */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                Step 1 — Select semi-packing bundles to combine into a box
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className={th}>Same Box</th>
                      <th className={th}>Bundles/Box</th>
                      <th className={th}>Packing No</th>
                      <th className={th}>Total Bundles</th>
                      <th className={th}>Qty/Bundle</th>
                      <th className={th}>Total Packed</th>
                      <th className={th}>Already QC&apos;d</th>
                      <th className={th}>Available</th>
                      <th className={th}>Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {semiRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-gray-400 text-sm">
                          No semi-packing rows available for this job
                        </td>
                      </tr>
                    ) : semiRows.map((row, i) => {
                      const usedInSession = tempDet
                        .filter(t => t.SemiPackingDetailID === row.SemiPackingDetailID)
                        .reduce((s, t) => s + t.InnerCarton, 0);
                      const available = row.InnerCarton - row.PackedInnerCarton - usedInSession;
                      return (
                        <tr key={row.SemiPackingDetailID}
                          className={row.sameBox ? "bg-blue-50" : "hover:bg-gray-50"}>
                          <td className={td}>
                            <input type="checkbox" checked={row.sameBox}
                              disabled={available <= 0}
                              onChange={e => setSemiRows(p => p.map((r, j) =>
                                j === i ? { ...r, sameBox: e.target.checked, bundlesPerBox: e.target.checked ? r.bundlesPerBox : "" } : r
                              ))}
                              className="w-4 h-4 rounded accent-blue-600" />
                          </td>
                          <td className={td}>
                            {row.sameBox && (
                              <Input type="number" min="1" max={available}
                                value={row.bundlesPerBox}
                                onChange={e => setSemiRows(p => p.map((r, j) =>
                                  j === i ? { ...r, bundlesPerBox: e.target.value } : r
                                ))}
                                className="w-16" />
                            )}
                          </td>
                          <td className={td}>{row.SemiPackingNo}</td>
                          <td className={`${td} text-right`}>{row.InnerCarton}</td>
                          <td className={`${td} text-right`}>{row.QuantityPerPack}</td>
                          <td className={`${td} text-right`}>{row.PackedQuantity?.toLocaleString()}</td>
                          <td className={`${td} text-right font-medium text-amber-600`}>{row.PackedInnerCarton}</td>
                          <td className={`${td} text-right font-semibold ${available > 0 ? "text-green-700" : "text-red-500"}`}>
                            {available}
                          </td>
                          <td className={td}>{row.PackingDescription}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─ PWO Batch ─ */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                Step 2 — Select batch
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className={th}>Select</th>
                      <th className={th}>Batch No</th>
                      <th className={th}>Quantity</th>
                      <th className={th}>Mfg Date</th>
                      <th className={th}>Exp Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {batchRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-5 text-gray-400 text-sm">No batch data</td>
                      </tr>
                    ) : batchRows.map((row, i) => (
                      <tr key={i}
                        className={`cursor-pointer ${row.selected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                        onClick={() => setBatchRows(p => p.map((r, j) => ({ ...r, selected: j === i })))}>
                        <td className={td}>
                          <input type="radio" readOnly checked={row.selected} className="accent-blue-600" />
                        </td>
                        <td className={td}>{row.BatchNo}</td>
                        <td className={`${td} text-right`}>{row.Quantity}</td>
                        <td className={td}>{row.MfgDate}</td>
                        <td className={td}>{row.ExpDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─ CFC Input Panel ─ */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-800 mb-3">
                Step 3 — Enter CFC dimensions and click Add CFC
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <Input label="QC Approved Boxes" type="number" min="1" value={qcAppro}
                  onChange={e => setQcAppro(e.target.value)} />
                <Input label="Weight / Box (kg)" type="number" value={weight}
                  onChange={e => setWeight(e.target.value)} placeholder="0.000" />
                <Input label="Length (CM)" type="number" value={cfcL}
                  onChange={e => setCfcL(e.target.value)} placeholder="0" />
                <Input label="Width (CM)" type="number" value={cfcW}
                  onChange={e => setCfcW(e.target.value)} placeholder="0" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <Input label="Height (CM)" type="number" value={cfcH}
                  onChange={e => setCfcH(e.target.value)} placeholder="0" />
                <Input label="CB CM (L × W × H)" readOnly value={cbcm > 0 ? cbcm.toFixed(4) : "0"} />
                <Input label="CFT (CB CM ÷ 28316.85)" readOnly value={cft > 0 ? cft.toFixed(6) : "0"} />
                <Button variant="primary" onClick={addCFC} icon={<Plus size={14} />}>
                  Add CFC
                </Button>
              </div>
            </div>

            {/* ─ QC Packing Detail Table ─ */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                QC Packing Output ({qcRows.length} row{qcRows.length !== 1 ? "s" : ""})
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      {["#", "Description", "Boxes", "Bdls/Box", "Qty/Pack", "Total Qty", "Weight", "L", "W", "H", "CB CM", "CFT", "Total CFT", "Batch", ""].map(h => (
                        <th key={h} className={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {qcRows.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="text-center py-10 text-gray-400 text-sm">
                          No rows yet — complete Steps 1–3 and click Add CFC
                        </td>
                      </tr>
                    ) : qcRows.map(row => (
                      <tr key={row.sn} className="hover:bg-gray-50">
                        <td className={td}>{row.sn}</td>
                        <td className={td}>
                          <div className="max-w-[180px]">
                            <span className="block text-xs text-gray-700 truncate" title={row.PackingDescription}>
                              {row.PackingDescription}
                            </span>
                            <button
                              onClick={() => openReadjust(row.sn)}
                              className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline mt-0.5">
                              Re-adjust bundles
                            </button>
                          </div>
                        </td>
                        <td className={`${td} text-right`}>{row.OuterCarton}</td>
                        <td className={`${td} text-right`}>{row.InnerCarton}</td>
                        <td className={`${td} text-xs`}>{row.QuantityPerPack}</td>
                        <td className={`${td} text-right font-medium`}>{row.ReceiptQuantity.toLocaleString()}</td>
                        <td className={`${td} text-right`}>{row.TotalWeight.toFixed(2)}</td>
                        <td className={`${td} text-right`}>{row.ShipperLengthCM}</td>
                        <td className={`${td} text-right`}>{row.ShipperWidthCM}</td>
                        <td className={`${td} text-right`}>{row.ShipperHeightCM}</td>
                        <td className={`${td} text-right`}>{row.CBCM.toFixed(2)}</td>
                        <td className={`${td} text-right`}>{row.CFT.toFixed(4)}</td>
                        <td className={`${td} text-right`}>{row.TotalCFT.toFixed(4)}</td>
                        <td className={td}>{row.BatchNo}</td>
                        <td className={td}>
                          <button onClick={() => {
                            setQcRows(p => p.filter(r => r.sn !== row.sn));
                            setTempDet(p => p.filter(t => t.sn !== row.sn));
                          }}
                            className="text-red-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {qcRows.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td className={td} colSpan={2}>TOTAL</td>
                        <td className={`${td} text-right`}>
                          {qcRows.reduce((s, r) => s + r.OuterCarton, 0)}
                        </td>
                        <td className={`${td} text-right`}>
                          {qcRows.reduce((s, r) => s + r.InnerCarton, 0)}
                        </td>
                        <td className={td} />
                        <td className={`${td} text-right`}>
                          {qcRows.reduce((s, r) => s + r.ReceiptQuantity, 0).toLocaleString()}
                        </td>
                        <td className={`${td} text-right`}>
                          {qcRows.reduce((s, r) => s + r.TotalWeight, 0).toFixed(2)}
                        </td>
                        <td colSpan={4} className={td} />
                        <td className={`${td} text-right`}>
                          {qcRows.reduce((s, r) => s + r.TotalCFT, 0).toFixed(4)}
                        </td>
                        <td colSpan={3} className={td} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* ─ Warehouse / Bin ─ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Warehouse *"
                value={warehouseName}
                onChange={e => handleWarehouseChange(e.target.value)}
                options={[
                  { value: "", label: "— Select Warehouse —" },
                  ...warehouses.map(w => ({ value: w, label: w })),
                ]}
              />
              <Select
                label="Bin *"
                value={binName}
                onChange={e => {
                  const sel = bins.find(b => b.Bin === e.target.value);
                  setBinName(e.target.value);
                  setWarehouseID(sel?.WarehouseID ?? 0);
                }}
                options={[
                  { value: "", label: "— Select Bin —" },
                  ...bins.map(b => ({ value: b.Bin, label: b.Bin })),
                ]}
              />
              <Input label="Warehouse ID" readOnly value={warehouseID || ""} />
            </div>

            {/* ─ Actions ─ */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100 flex-wrap">
              {!editMode ? (
                <Button variant="primary" loading={saving}
                  icon={<ShieldCheck size={14} />}
                  onClick={handleSave} disabled={saving || qcRows.length === 0}>
                  Save QC Packing
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

      {/* ══ Re-adjust Modal ════════════════════════════════════════════════════ */}
      <Modal open={raOpen} onClose={() => setRaOpen(false)} title="Re-adjust Bundle Distribution" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Edit bundle counts for each semi-packing row in this CFC entry. Changes are written back to
            <code className="text-xs bg-gray-100 px-1 rounded mx-1">JobSemiPackingDetail</code>.
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className={th}>SemiPacking Detail ID</th>
                  <th className={th}>Current Bundles</th>
                  <th className={th}>Qty / Bundle</th>
                  <th className={th}>New Bundles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {raRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-5 text-gray-400 text-sm">No rows</td>
                  </tr>
                ) : raRows.map((row, i) => (
                  <tr key={i}>
                    <td className={td}>{row.SemiPackingDetailID}</td>
                    <td className={`${td} text-right`}>{row.InnerCarton}</td>
                    <td className={`${td} text-right`}>{row.QuantityPerPack}</td>
                    <td className={td}>
                      <Input type="number" min="1"
                        value={raEdits[i] ?? row.InnerCarton}
                        onChange={e => setRaEdits(p => ({ ...p, [i]: e.target.value }))}
                        className="w-20" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <Button variant="primary" onClick={saveReadjust}>Save Adjustments</Button>
            <Button variant="secondary" onClick={() => setRaOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
