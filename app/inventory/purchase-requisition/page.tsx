"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, X, Search, Check, List, ChevronRight, RefreshCw, Trash2, Download } from "lucide-react";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IndentLine {
  TransactionID: number;
  TransactionDetailID: number;
  VoucherNo: string | null;
  VoucherDate: string | null;
  ItemID: number;
  ItemGroupID: number;
  ItemGroupName: string | null;
  ItemSubGroupName: string | null;
  ItemCode: string | null;
  ItemName: string | null;
  ItemDescription: string | null;
  RequiredQuantity: number;
  RequiredQuantityPurchaseUnit: number;
  RequiredQuantityPacks: number;
  BookedStock: number;
  AllocatedStock: number;
  PhysicalStock: number;
  StockUnit: string | null;
  PurchaseUnit: string | null;
  WtPerPacking: number;
  UnitPerPacking: number;
  ConversionFactor: number;
  JobBookingContentNo: string | null;
  JobName: string | null;
}

interface ReqHeader {
  TransactionID: number;
  VoucherNo: string | null;
  VoucherDate: string | null;
  TotalQuantity: number;
  CreatedBy: string | null;
  Narration: string | null;
  FYear: string | null;
  NoOfItems: number;
}

interface PRLine {
  lineKey: string;
  ItemID: number;
  ItemGroupID: number;
  ItemGroupName: string;
  ItemSubGroupName: string;
  ItemCode: string;
  ItemName: string;
  IndentDetailID: number;
  IndentTxnID: number;
  IndentQty: number;
  BookedStock: number;
  AllocatedStock: number;
  PhysicalStock: number;
  StockUnit: string;
  PurchaseUnit: string;
  PhysicalStockInPU: number;
  WtPerPacking: number;
  UnitPerPacking: number;
  RequiredNoOfPacks: number;
  QuantityPerPack: number;
  POQtyInPU: number;
  POQtyInSU: number;
  JobContentNo: string;
  JobName: string;
}

interface OverflowItem {
  ItemID: number;
  ItemGroupID: number;
  ItemGroupName: string | null;
  ItemSubGroupName: string | null;
  ItemCode: string;
  ItemName: string;
  ItemDescription: string | null;
  BookedStock: number;
  AllocatedStock: number;
  PhysicalStock: number;
  StockUnit: string | null;
  PurchaseUnit: string | null;
  WtPerPacking: number;
  UnitPerPacking: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().split("T")[0];

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return "—";
  const p = new Date(d);
  return isNaN(p.getTime()) ? d : p.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const isoFromAny = (d: string): string => {
  const p = new Date(d);
  return isNaN(p.getTime()) ? todayISO() : p.toISOString().split("T")[0];
};

const unwrap = async (res: Response): Promise<any> => {
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
};

const toNum = (v: any) => Number(v ?? 0);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PurchaseRequisitionPage() {
  // view
  const [view, setView] = useState<"list" | "form">("list");
  const [tab, setTab] = useState<"indent" | "reqs">("indent");

  // list data
  const [indentLines, setIndentLines] = useState<IndentLine[]>([]);
  const [reqHeaders, setReqHeaders] = useState<ReqHeader[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState("");

  // indent selection (by TransactionDetailID)
  const [selKeys, setSelKeys] = useState<Set<number>>(new Set());

  // indent filter
  const [indentSearch, setIndentSearch] = useState("");
  const [indentGroup, setIndentGroup] = useState("All");

  // requisition filter
  const [reqSearch, setReqSearch] = useState("");

  // form state
  const [editTxnID, setEditTxnID] = useState<number | null>(null);
  const [voucherNo, setVoucherNo] = useState("");
  const [reqDate, setReqDate] = useState(todayISO());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<PRLine[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // item picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerItems, setPickerItems] = useState<OverflowItem[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerGroup, setPickerGroup] = useState("All");
  const [pickerLoading, setPickerLoading] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchLists = useCallback(async () => {
    setListLoading(true); setListErr("");
    try {
      const [ir, gr] = await Promise.all([
        fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/GetList?radioValue=Indent+List`, { headers: authHeaders() }),
        fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/GroupList`, { headers: authHeaders() }),
      ]);
      setIndentLines(await unwrap(ir));
      setReqHeaders(await unwrap(gr));
    } catch (e: any) {
      setListErr(e.message || "Failed to load");
    } finally { setListLoading(false); }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const fetchVoucherNo = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/GetVoucherID?prefix=REQ`, { headers: authHeaders() });
      const v = await unwrap(res);
      setVoucherNo(v?.VoucherNo ?? (typeof v === "string" ? v : "REQ-AUTO"));
    } catch { setVoucherNo("REQ-AUTO"); }
  };

  const fetchPickerItems = async () => {
    setPickerLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/ItemsForOverflow`, { headers: authHeaders() });
      setPickerItems(await unwrap(res));
    } catch (e: any) {
      alert("Failed to load items: " + e.message);
    } finally { setPickerLoading(false); }
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const openBlank = async () => {
    setEditTxnID(null);
    setLines([]); setReqDate(todayISO()); setNarration("");
    await fetchVoucherNo();
    setView("form");
  };

  const openFromIndent = async () => {
    if (selKeys.size === 0) return;
    const sel = indentLines.filter(l => selKeys.has(l.TransactionDetailID));
    setEditTxnID(null);
    setLines(sel.map(il2pr));
    setReqDate(todayISO()); setNarration("");
    await fetchVoucherNo();
    setView("form");
  };

  const openEdit = async (h: ReqHeader) => {
    setFormLoading(true);
    try {
      const res = await fetch(
        `${BASE_URL}/api/PurchaseRequisitionAJ/RetrieveData?transactionId=${h.TransactionID}`,
        { headers: authHeaders() }
      );
      const rows: any[] = await unwrap(res);

      // ErrMsg pattern — backend caught a SQL error
      if (rows.length > 0 && rows[0].ErrMsg) {
        alert("Failed to load items: " + rows[0].ErrMsg);
        return;
      }

      setEditTxnID(h.TransactionID);
      setVoucherNo(h.VoucherNo ?? "");
      setReqDate(h.VoucherDate ? isoFromAny(h.VoucherDate) : todayISO());
      setNarration(h.Narration ?? "");

      const ls: PRLine[] = rows.map((r: any, idx: number) => {
        const packs = toNum(r.RequiredNoOfPacks);
        const qpp   = toNum(r.QuantityPerPack);
        return {
          lineKey: `e${toNum(r.ItemID)}-${idx}`,
          ItemID:          toNum(r.ItemID),
          ItemGroupID:     toNum(r.ItemGroupID),
          ItemGroupName:   r.ItemGroupName   ?? "",
          ItemSubGroupName: r.ItemSubGroupName ?? "",
          ItemCode:        r.ItemCode        ?? "",
          ItemName:        r.ItemName        ?? "",
          IndentDetailID: 0, IndentTxnID: 0, IndentQty: 0,
          BookedStock:     toNum(r.BookedStock),
          AllocatedStock:  toNum(r.AllocatedStock),
          PhysicalStock:   toNum(r.PhysicalStock),
          StockUnit:       r.StockUnit       ?? "",
          PurchaseUnit:    r.PurchaseUnit    ?? "",
          PhysicalStockInPU: toNum(r.CurrentStockInPurchaseUnit),
          WtPerPacking:    toNum(r.WtPerPacking),
          UnitPerPacking:  toNum(r.UnitPerPacking),
          RequiredNoOfPacks: packs,
          QuantityPerPack:   qpp,
          POQtyInPU: packs * qpp || toNum(r.RequiredQuantity),
          POQtyInSU: toNum(r.RequiredQuantity),
          JobContentNo: r.RefJobCardContentNo ?? "",
          JobName: "",
        };
      });

      setLines(ls);
      setView("form");
    } catch (e: any) { alert("Load failed: " + e.message); }
    finally { setFormLoading(false); }
  };

  // IndentLine → PRLine
  const il2pr = (il: IndentLine): PRLine => ({
    lineKey: `il${il.TransactionDetailID}`,
    ItemID: il.ItemID, ItemGroupID: il.ItemGroupID,
    ItemGroupName: il.ItemGroupName ?? "",
    ItemSubGroupName: il.ItemSubGroupName ?? "",
    ItemCode: il.ItemCode ?? "", ItemName: il.ItemName ?? "",
    IndentDetailID: il.TransactionDetailID, IndentTxnID: il.TransactionID,
    IndentQty: il.RequiredQuantity,
    BookedStock: il.BookedStock, AllocatedStock: il.AllocatedStock,
    PhysicalStock: il.PhysicalStock, StockUnit: il.StockUnit ?? "",
    PurchaseUnit: il.PurchaseUnit ?? "",
    PhysicalStockInPU: il.PhysicalStock,
    WtPerPacking: il.WtPerPacking, UnitPerPacking: il.UnitPerPacking,
    RequiredNoOfPacks: il.RequiredQuantityPacks,
    QuantityPerPack: il.UnitPerPacking || il.WtPerPacking || 0,
    POQtyInPU: il.RequiredQuantityPurchaseUnit,
    POQtyInSU: il.RequiredQuantity,
    JobContentNo: il.JobBookingContentNo ?? "",
    JobName: il.JobName ?? "",
  });

  // ── Line ops ────────────────────────────────────────────────────────────────

  const addFromPicker = (item: OverflowItem) => {
    if (lines.some(l => l.ItemID === item.ItemID)) { alert("Item already in list."); return; }
    setLines(p => [...p, {
      lineKey: `pk${item.ItemID}${Date.now()}`,
      ItemID: item.ItemID, ItemGroupID: item.ItemGroupID,
      ItemGroupName: item.ItemGroupName ?? "",
      ItemSubGroupName: item.ItemSubGroupName ?? "",
      ItemCode: item.ItemCode, ItemName: item.ItemName,
      IndentDetailID: 0, IndentTxnID: 0, IndentQty: 0,
      BookedStock: item.BookedStock, AllocatedStock: item.AllocatedStock,
      PhysicalStock: item.PhysicalStock, StockUnit: item.StockUnit ?? "",
      PurchaseUnit: item.PurchaseUnit ?? "",
      PhysicalStockInPU: item.PhysicalStock,
      WtPerPacking: item.WtPerPacking, UnitPerPacking: item.UnitPerPacking,
      RequiredNoOfPacks: 0, QuantityPerPack: 0,
      POQtyInPU: 0, POQtyInSU: 0,
      JobContentNo: "", JobName: "",
    }]);
    setShowPicker(false); setPickerSearch(""); setPickerGroup("All");
  };

  const updateLine = (key: string, field: "RequiredNoOfPacks" | "QuantityPerPack", val: number) => {
    setLines(p => p.map(l => {
      if (l.lineKey !== key) return l;
      const pk = field === "RequiredNoOfPacks" ? val : l.RequiredNoOfPacks;
      const qp = field === "QuantityPerPack"   ? val : l.QuantityPerPack;
      return { ...l, [field]: val, POQtyInPU: pk * qp, POQtyInSU: pk * qp };
    }));
  };

  const removeLine = (key: string) => setLines(p => p.filter(l => l.lineKey !== key));

  // ── Save ────────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!lines.length) { alert("Add at least one item."); return; }
    const zeroQtyItems = lines.filter(l => l.POQtyInPU <= 0);
    if (zeroQtyItems.length) {
      alert(`Required quantity must be greater than 0 for: ${zeroQtyItems.map(l => l.ItemName).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      const totalQty = lines.reduce((s, l) => s + l.POQtyInPU, 0);
      const body: any = {
        prefix: "REQ",
        PRMain: { VoucherDate: reqDate, Narration: narration, TotalQuantity: totalQty },
        PRDetails: lines.map(l => ({
          ItemID: l.ItemID,
          RequiredQuantity: l.POQtyInPU,
          RequiredNoOfPacks: l.RequiredNoOfPacks,
          QuantityPerPack: l.QuantityPerPack,
          StockUnit: l.StockUnit,
          CurrentStockInStockUnit: l.PhysicalStock,
          CurrentStockInPurchaseUnit: l.PhysicalStockInPU,
          RefJobCardContentNo: l.JobContentNo,
          RefJobBookingJobCardContentsID: 0,
          IsVoucherItemApproved: 1,
        })),
        UpdateIndentDetails: lines
          .filter(l => l.IndentDetailID > 0)
          .map(l => ({ TransactionDetailID: l.IndentDetailID })),
        UserApprovalArray: lines.map(l => ({
          ItemID: l.ItemID,
          ItemName: l.ItemName,
          PurchaseQty: l.POQtyInPU,
        })),
      };
      if (editTxnID) {
        body.transactionId = String(editTxnID);
        body.ValidateUser = { userName: "", password: "", documentNo: voucherNo, transactionRemark: "" };
      }
      const url = `${BASE_URL}/api/PurchaseRequisitionAJ/${editTxnID ? "Update" : "Save"}`;
      const res = await fetch(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const result = await unwrap(res);
      if (result === "TransactionUsed") {
        alert("This requisition is linked to a Purchase Order and cannot be edited.");
        return;
      }
      if (result === "RequisitionApproved") {
        alert("One or more items are already approved. Cannot edit.");
        return;
      }
      alert(typeof result === "string" ? result : "Saved successfully!");
      await fetchLists();
      setSelKeys(new Set());
      setView("list"); setTab("reqs");
    } catch (e: any) { alert("Save failed: " + e.message); }
    finally { setSaving(false); }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const deleteReq = async (h: ReqHeader) => {
    if (!window.confirm(`Delete requisition ${h.VoucherNo ?? h.TransactionID}?\nThis cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/Delete`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ transactionId: String(h.TransactionID) }),
      });
      const result = await unwrap(res);
      if (result === "TransactionUsed") {
        alert("Cannot delete — this requisition is already linked to a Purchase Order.");
        return;
      }
      if (typeof result === "string" && result.startsWith("Error")) {
        alert(result);
        return;
      }
      await fetchLists();
    } catch (e: any) { alert("Delete failed: " + e.message); }
    finally { setDeleting(false); }
  };

  // ── Export CSV ───────────────────────────────────────────────────────────────

  const exportCSV = () => {
    if (!filteredReqs.length) { alert("No records to export."); return; }
    const header = ["Voucher No", "Date", "No. of Items", "Total Qty", "Created By", "Narration", "FYear"];
    const rows = filteredReqs.map(r => [
      r.VoucherNo ?? "",
      r.VoucherDate ?? "",
      r.NoOfItems,
      r.TotalQuantity,
      r.CreatedBy ?? "",
      `"${(r.Narration ?? "").replace(/"/g, '""')}"`,
      r.FYear ?? "",
    ].join(","));
    const csv = "﻿" + [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PurchaseRequisitions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Computed ─────────────────────────────────────────────────────────────────

  const totalPOQty = lines.reduce((s, l) => s + l.POQtyInPU, 0);

  const indentGroups = useMemo(() =>
    ["All", ...Array.from(new Set(indentLines.map(l => l.ItemGroupName ?? "").filter(Boolean)))],
    [indentLines]);

  const filteredIndent = useMemo(() => {
    const s = indentSearch.toLowerCase();
    return indentLines.filter(l =>
      (indentGroup === "All" || l.ItemGroupName === indentGroup) &&
      (!s ||
        (l.ItemName ?? "").toLowerCase().includes(s) ||
        (l.ItemCode ?? "").toLowerCase().includes(s) ||
        (l.VoucherNo ?? "").toLowerCase().includes(s))
    );
  }, [indentLines, indentSearch, indentGroup]);

  const filteredReqs = useMemo(() => {
    const s = reqSearch.toLowerCase();
    if (!s) return reqHeaders;
    return reqHeaders.filter(r =>
      (r.VoucherNo ?? "").toLowerCase().includes(s) ||
      (r.Narration ?? "").toLowerCase().includes(s) ||
      (r.CreatedBy ?? "").toLowerCase().includes(s)
    );
  }, [reqHeaders, reqSearch]);

  const pickerGroups = useMemo(() =>
    ["All", ...Array.from(new Set(pickerItems.map(i => i.ItemGroupName ?? "").filter(Boolean)))],
    [pickerItems]);

  const filteredPicker = useMemo(() => {
    const s = pickerSearch.toLowerCase();
    return pickerItems.filter(i =>
      (pickerGroup === "All" || i.ItemGroupName === pickerGroup) &&
      (!s ||
        (i.ItemName ?? "").toLowerCase().includes(s) ||
        (i.ItemCode ?? "").toLowerCase().includes(s))
    );
  }, [pickerItems, pickerSearch, pickerGroup]);

  // ════════════════════════════════════════════════════════════════════════════
  // FORM VIEW
  // ════════════════════════════════════════════════════════════════════════════

  if (view === "form") {
    return (
      <div className="w-full max-w-[1600px] mx-auto pb-10 px-1">

        {/* Header ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <h2 className="text-lg font-bold text-gray-800">Purchase Requisition</h2>
              {editTxnID && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Editing</span>
              )}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold text-blue-600 bg-blue-100 border border-blue-200">
                {voucherNo}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setView("list")}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <List size={15} />
              <span className="hidden sm:inline">List ({reqHeaders.length})</span>
              <span className="sm:hidden">List</span>
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Check size={15} /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Content card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Info bar */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/30 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Req. No.</label>
              <input
                readOnly value={voucherNo}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono font-semibold text-blue-700 bg-blue-50 focus:outline-none w-52"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</label>
              <input
                type="date" value={reqDate} onChange={e => setReqDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="ml-auto">
              <button
                onClick={async () => {
                  setShowPicker(true); setPickerSearch(""); setPickerGroup("All");
                  if (!pickerItems.length) await fetchPickerItems();
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: 1280 }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    { label: "Item\nCode",           right: false },
                    { label: "Item Group",           right: false },
                    { label: "Sub Group",            right: false },
                    { label: "Item Name",            right: false },
                    { label: "Indent\nQty",          right: true  },
                    { label: "Booked\nStock",        right: true  },
                    { label: "Allocated\nStock",     right: true  },
                    { label: "Curr.\nStock",         right: true  },
                    { label: "Stock\nUnit",          right: false },
                    { label: "Stock\n(In P.U.)",     right: true  },
                    { label: "Purchase\nUnit",       right: false },
                    { label: "No. Of\nPacks/Rolls",  right: true  },
                    { label: "Qty /\nPack/Roll",     right: true  },
                    { label: "P.O.Qty\n(P.U.)",      right: true  },
                    { label: "P.O.Qty\n(S.U.)",      right: true  },
                    { label: "",                     right: false },
                  ].map((c, i) => (
                    <th
                      key={i}
                      className={`px-3 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-pre-line leading-tight ${c.right ? "text-right" : "text-left"}`}
                      style={{ fontSize: 11 }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="text-center py-24 text-gray-400 text-sm">
                      No items — click &ldquo;+ Add Item&rdquo; to begin
                    </td>
                  </tr>
                ) : lines.map((l, idx) => (
                  <tr
                    key={l.lineKey}
                    className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                  >
                    <td className="px-3 py-2 font-mono text-blue-700 whitespace-nowrap">{l.ItemCode}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{l.ItemGroupName}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{l.ItemSubGroupName || "—"}</td>
                    <td className="px-3 py-2 text-gray-800" style={{ maxWidth: 200 }}>{l.ItemName}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{l.IndentQty || "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{l.BookedStock.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{l.AllocatedStock.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.PhysicalStock.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500">{l.StockUnit}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.PhysicalStockInPU.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500">{l.PurchaseUnit}</td>
                    <td className="px-2 py-1">
                      <input
                        type="number" min={0}
                        value={l.RequiredNoOfPacks || ""}
                        onChange={e => updateLine(l.lineKey, "RequiredNoOfPacks", Number(e.target.value))}
                        className="w-20 text-right px-2 py-1 border border-gray-300 rounded text-xs font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number" min={0}
                        value={l.QuantityPerPack || ""}
                        onChange={e => updateLine(l.lineKey, "QuantityPerPack", Number(e.target.value))}
                        className="w-24 text-right px-2 py-1 border border-gray-300 rounded text-xs font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-blue-700">{l.POQtyInPU.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-700">{l.POQtyInSU.toLocaleString()}</td>
                    <td className="px-2 py-1 text-center">
                      <button onClick={() => removeLine(l.lineKey)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {lines.length > 0 && (
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td colSpan={13} className="px-3 py-2 text-right text-xs font-bold text-blue-800">Total P.O. Qty (P.U.)</td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-blue-800">{totalPOQty.toLocaleString()}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile card view */}
          <div className="lg:hidden">
            {lines.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">Tap &ldquo;+ Add Item&rdquo; to begin</div>
            ) : (
              <div className="space-y-3 p-4">
                {lines.map(l => (
                  <div key={l.lineKey} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-bold text-blue-700">{l.ItemCode}</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{l.ItemName}</p>
                        <p className="text-xs text-gray-500">{l.ItemGroupName}{l.ItemSubGroupName ? ` · ${l.ItemSubGroupName}` : ""}</p>
                      </div>
                      <button onClick={() => removeLine(l.lineKey)} className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                      {[
                        { label: "Curr. Stock", val: `${l.PhysicalStock} ${l.StockUnit}` },
                        { label: "Allocated",   val: l.AllocatedStock.toLocaleString() },
                        { label: "Indent Qty",  val: l.IndentQty || "—" },
                      ].map(({ label, val }) => (
                        <div key={label} className="px-3 py-2.5 text-center">
                          <p className="text-xs text-gray-400 font-medium">{label}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{val}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 px-4 py-3 border-b border-gray-100">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">No. of Packs/Rolls</p>
                        <input
                          type="number" min={0} value={l.RequiredNoOfPacks || ""}
                          onChange={e => updateLine(l.lineKey, "RequiredNoOfPacks", Number(e.target.value))}
                          className="w-full text-right px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Qty / Pack/Roll</p>
                        <input
                          type="number" min={0} value={l.QuantityPerPack || ""}
                          onChange={e => updateLine(l.lineKey, "QuantityPerPack", Number(e.target.value))}
                          className="w-full text-right px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-100 bg-blue-50">
                      <div className="px-4 py-2.5 text-center">
                        <p className="text-xs text-blue-600 font-medium">P.O. Qty (P.U.)</p>
                        <p className="text-base font-bold text-blue-700">{l.POQtyInPU.toLocaleString()}</p>
                      </div>
                      <div className="px-4 py-2.5 text-center">
                        <p className="text-xs text-gray-600 font-medium">P.O. Qty (S.U.)</p>
                        <p className="text-base font-bold text-gray-800">{l.POQtyInSU.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bg-blue-600 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-100">Total P.O. Qty (P.U.)</span>
                  <span className="text-xl font-bold text-white">{totalPOQty.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Narration */}
          <div className="px-6 py-4 border-t border-gray-100">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Narration / Remark</label>
            <textarea
              value={narration} onChange={e => setNarration(e.target.value)} rows={2}
              placeholder="Optional notes…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Item picker modal */}
        {showPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[1200px] max-h-[88vh] flex flex-col overflow-hidden">
              <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-sm tracking-wide">Add Item to Requisition</h3>
                <button onClick={() => setShowPicker(false)} className="text-blue-200 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="px-5 py-3 border-b border-gray-100 space-y-2.5 shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                    placeholder="Search by item name or code…"
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {pickerGroups.map(g => (
                    <button
                      key={g} onClick={() => setPickerGroup(g)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${pickerGroup === g ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700"}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {pickerLoading ? (
                  <div className="text-center py-12 text-gray-400">Loading items…</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                      <tr>
                        {["Code", "Item Name", "Group", "Sub Group", "Curr. Stock", "Purch. Unit", "Stock UOM"].map((h, i) => (
                          <th key={i} className={`px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider ${i >= 4 ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPicker.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-12 text-gray-400">No items found</td></tr>
                      ) : filteredPicker.map(item => (
                        <tr
                          key={item.ItemID} onClick={() => addFromPicker(item)}
                          className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-blue-700 font-semibold block">{item.ItemCode}</span>
                            {item.ItemDescription && <span className="text-gray-400 text-xs block leading-tight mt-0.5">{item.ItemDescription}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-800 font-medium">{item.ItemName}</td>
                          <td className="px-4 py-2.5 text-gray-500">{item.ItemGroupName}</td>
                          <td className="px-4 py-2.5 text-gray-500">{item.ItemSubGroupName || "—"}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{toNum(item.PhysicalStock).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{item.PurchaseUnit}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{item.StockUnit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="px-5 py-2.5 border-t border-gray-100 text-right shrink-0">
                <p className="text-xs text-gray-400">Click any row to add item to requisition</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="w-full max-w-[1600px] mx-auto px-1 space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Purchase Requisition</h2>
          <p className="text-sm text-gray-500">
            {tab === "indent" ? `${filteredIndent.length} indent lines` : `${filteredReqs.length} requisitions`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLists}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          {tab === "reqs" && filteredReqs.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Export to CSV"
            >
              <Download size={14} /> Export
            </button>
          )}
          {tab === "indent" && selKeys.size > 0 && (
            <button
              onClick={openFromIndent}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              <ChevronRight size={15} /> Create Req. ({selKeys.size})
            </button>
          )}
          <button
            onClick={openBlank}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> New Requisition
          </button>
        </div>
      </div>

      {/* Tab panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-gray-200">
          {([
            { key: "indent" as const, label: "Indent List",         count: indentLines.length, amber: true  },
            { key: "reqs"   as const, label: "Requisition Records",  count: reqHeaders.length,  amber: false },
          ]).map(t => (
            <button
              key={t.key} onClick={() => setTab(t.key)}
              className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${tab === t.key ? "text-blue-600 border-blue-600 bg-white" : "text-gray-500 border-transparent hover:text-gray-700"}`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${t.amber ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {listLoading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : listErr ? (
          <div className="text-center py-16 text-sm">
            <span className="text-red-500">{listErr}</span>
            <button onClick={fetchLists} className="ml-2 text-blue-600 underline">Retry</button>
          </div>
        ) : tab === "indent" ? (

          /* ── INDENT LIST ──────────────────────────────────────────────────── */
          <div>
            <div className="px-5 py-3 border-b border-gray-100 space-y-2">
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  type="text" placeholder="Search indent lines…"
                  value={indentSearch} onChange={e => setIndentSearch(e.target.value)}
                  className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {indentGroups.map(g => (
                  <button
                    key={g} onClick={() => setIndentGroup(g)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${indentGroup === g ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700"}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={filteredIndent.length > 0 && filteredIndent.every(l => selKeys.has(l.TransactionDetailID))}
                        onChange={() => {
                          const allChecked = filteredIndent.every(l => selKeys.has(l.TransactionDetailID));
                          const next = new Set(selKeys);
                          filteredIndent.forEach(l => allChecked ? next.delete(l.TransactionDetailID) : next.add(l.TransactionDetailID));
                          setSelKeys(next);
                        }}
                        className="rounded"
                      />
                    </th>
                    {[
                      { h: "Indent No.",  r: false },
                      { h: "Date",        r: false },
                      { h: "Item Group",  r: false },
                      { h: "Sub Group",   r: false },
                      { h: "Item Code",   r: false },
                      { h: "Item Name",   r: false },
                      { h: "Indent Qty",  r: true  },
                      { h: "Curr. Stock", r: true  },
                      { h: "Unit",        r: false },
                      { h: "Booked",      r: true  },
                      { h: "Allocated",   r: true  },
                    ].map(({ h, r }, i) => (
                      <th key={i} className={`px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider ${r ? "text-right" : "text-left"}`} style={{ fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredIndent.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center py-16 text-gray-400 text-sm">No open indent lines found</td>
                    </tr>
                  ) : filteredIndent.map((l, idx) => {
                    const checked = selKeys.has(l.TransactionDetailID);
                    return (
                      <tr
                        key={`${l.TransactionDetailID}-${l.ItemID}-${idx}`}
                        onClick={() => {
                          const next = new Set(selKeys);
                          checked ? next.delete(l.TransactionDetailID) : next.add(l.TransactionDetailID);
                          setSelKeys(next);
                        }}
                        className={`border-t border-gray-100 cursor-pointer transition-colors ${checked ? "bg-green-50" : idx % 2 === 0 ? "bg-white hover:bg-blue-50/30" : "bg-gray-50/40 hover:bg-blue-50/30"}`}
                      >
                        <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox" checked={checked}
                            onChange={() => {
                              const next = new Set(selKeys);
                              checked ? next.delete(l.TransactionDetailID) : next.add(l.TransactionDetailID);
                              setSelKeys(next);
                            }}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-blue-700">{l.VoucherNo ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{fmtDate(l.VoucherDate)}</td>
                        <td className="px-3 py-2 text-gray-700">{l.ItemGroupName ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{l.ItemSubGroupName ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className="font-mono text-blue-600 block">{l.ItemCode}</span>
                          {l.ItemDescription && <span className="text-gray-400 text-xs block leading-tight mt-0.5">{l.ItemDescription}</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-800">{l.ItemName}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-800">{toNum(l.RequiredQuantity).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{toNum(l.PhysicalStock).toLocaleString()}</td>
                        <td className="px-3 py-2 text-gray-500">{l.StockUnit}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{toNum(l.BookedStock).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{toNum(l.AllocatedStock).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selKeys.size > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 bg-green-50 flex items-center justify-between">
                <span className="text-sm text-green-700 font-medium">
                  {selKeys.size} item{selKeys.size !== 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={openFromIndent}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <ChevronRight size={14} /> Create Requisition
                </button>
              </div>
            )}
          </div>

        ) : (

          /* ── REQUISITION RECORDS ──────────────────────────────────────────── */
          <div>
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  type="text" placeholder="Search by voucher no, narration, created by…"
                  value={reqSearch} onChange={e => setReqSearch(e.target.value)}
                  className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {[
                      { h: "Voucher No.",  r: false },
                      { h: "Date",         r: false },
                      { h: "Items",        r: true  },
                      { h: "Total Qty",    r: true  },
                      { h: "Created By",   r: false },
                      { h: "Narration",    r: false },
                      { h: "Actions",      r: true  },
                    ].map(({ h, r }, i) => (
                      <th key={i} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${r ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReqs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-gray-400 text-sm">No requisitions found</td>
                    </tr>
                  ) : filteredReqs.map((r, i) => (
                    <tr key={r.TransactionID} className={`border-t border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{r.VoucherNo ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(r.VoucherDate)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{r.NoOfItems}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700">{toNum(r.TotalQuantity).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{r.CreatedBy ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{r.Narration ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(r)}
                            disabled={formLoading || deleting}
                            className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors disabled:opacity-50"
                          >
                            {formLoading ? "…" : "Edit"}
                          </button>
                          <button
                            onClick={() => deleteReq(r)}
                            disabled={deleting || formLoading}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
