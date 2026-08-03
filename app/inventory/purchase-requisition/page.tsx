"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, X, Search, List, RefreshCw, Boxes, Download, FileText, History, Printer } from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { statusBadge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { getCompanyName } from "@/lib/useCompanyName";
import { PRINT_DOC_CSS, printHeaderHtml, sectionHtml, signOffHtml, footerNoteHtml, openPrintWindow, writeAndPrint, fmtQty } from "@/lib/printDoc";

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
  GSM: number | null;
  SizeW: number | null;
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

type ReqLineStatus = "Pending" | "Approved" | "PO Created" | "Closed";

interface ReqLine {
  TransactionDetailID: number;
  TransactionID: number;
  VoucherNo: string | null;
  VoucherDate: string | null;
  ItemGroupID: number;
  ItemGroupName: string | null;
  ItemSubGroupName: string | null;
  ItemCode: string | null;
  ItemName: string | null;
  GSM: number;
  SizeW: number;
  RequiredQuantity: number;
  IsVoucherItemApproved: number;
  IsCancelled: number;
  Status: ReqLineStatus;
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
  JobBookingJobCardContentsID: number;
  GSM: number;
  SizeW: number;
  ItemNarration: string;
  ExpectedDelivery: string;
  CustomerName: string;
  PWONo: string;
}

interface JobCardOption {
  JobBookingID: number;
  JobBookingJobCardContentsID: number;
  JobCardContentNo: string;
  JobName: string | null;
  PlanContName: string | null;
  PWONo: string | null;
  CustomerName: string | null;
}

interface OverflowItem {
  _uid: number; // synthetic per-row key (ItemsForOverflow can repeat ItemID across rows)
  ItemID: number;
  ItemGroupID: number;
  ItemGroupName: string | null;
  ItemSubGroupName: string | null;
  ItemCode: string;
  ItemName: string;
  ItemDescription: string | null;
  GSM: number | null;
  SizeW: number | null;
  BookedStock: number;
  AllocatedStock: number;
  PhysicalStock: number;
  StockUnit: string | null;
  PurchaseUnit: string | null;
  WtPerPacking: number;
  UnitPerPacking: number;
}

interface IndentRow extends IndentLine {
  Source: "Job Card" | "Stock";
  FreeStock: number;
}

interface BatchApiResult {
  BatchID: number;
  BatchNo: string;
  SupplierBatchNo: string;
  ItemID: number;
  ItemCode: string;
  ItemName: string;
  StockUnit: string;
  ItemGroup: string;
  WarehouseID: number;
  WarehouseName: string;
  Bin: string;
  GRNNo: string;
  SystemQty: number;
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

const escapeHtml = (v: any) =>
  String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PurchaseRequisitionPage() {
  const { showToast } = useToast();

  // view
  const [view, setView] = useState<"list" | "form">("list");
  const [tab, setTab] = useState<"indent" | "reqs">("indent");

  // global search (list view header)
  const [search, setSearch] = useState("");

  // job cards (for per-line job selection)
  const [jobCards, setJobCards] = useState<JobCardOption[]>([]);

  // list data
  const [indentLines, setIndentLines] = useState<IndentLine[]>([]);
  const [reqHeaders, setReqHeaders] = useState<ReqHeader[]>([]);
  const [reqLines, setReqLines] = useState<ReqLine[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState("");

  // Created Requisitions — status filter tab
  const [reqStatus, setReqStatus] = useState<"All" | ReqLineStatus>("All");

  // read-only view modal (eye icon)
  const [viewReq, setViewReq] = useState<{ header: ReqHeader; rows: any[] } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // indent selection (by TransactionDetailID)
  const [selKeys, setSelKeys] = useState<Set<number>>(new Set());

  // indent filter
  const [indentSource, setIndentSource] = useState<"All" | "Job Card" | "Stock">("All");

  // stock quick-view modal
  const [stockView, setStockView] = useState<{ itemCode: string; itemName: string } | null>(null);
  const [stockBatches, setStockBatches] = useState<BatchApiResult[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

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
  // multi-select in item picker (by ItemID)
  const [pickerSel, setPickerSel] = useState<Set<number>>(new Set());

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchLists = useCallback(async () => {
    setListLoading(true); setListErr("");
    try {
      const [ir, gr, rl] = await Promise.all([
        fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/GetList?radioValue=Indent+List`, { headers: authHeaders() }),
        fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/GroupList`, { headers: authHeaders() }),
        fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/RequisitionLines`, { headers: authHeaders() }),
      ]);
      setIndentLines(await unwrap(ir));
      setReqHeaders(await unwrap(gr));
      setReqLines(await unwrap(rl));
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
      const data = await unwrap(res);
      setPickerItems((Array.isArray(data) ? data : []).map((it: OverflowItem, i: number) => ({ ...it, _uid: i })));
    } catch (e: any) {
      showToast("error", "Failed to load items", e.message);
    } finally { setPickerLoading(false); }
  };

  const ensureJobCards = async () => {
    if (jobCards.length) return;
    try {
      const res = await fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/JobCards`, { headers: authHeaders() });
      const data = await unwrap(res);
      setJobCards(Array.isArray(data) ? data : []);
    } catch { /* non-fatal */ }
  };

  const openStockView = async (row: IndentRow) => {
    setStockView({ itemCode: row.ItemCode ?? "", itemName: row.ItemName ?? "" });
    setStockLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/ItemPhy/batches?search=${encodeURIComponent(row.ItemCode ?? "")}`, { headers: authHeaders() });
      setStockBatches(await unwrap(res));
    } catch (e: any) {
      showToast("error", "Failed to load stock", e.message);
      setStockBatches([]);
    } finally { setStockLoading(false); }
  };

  // Close an indent line — its remaining qty is no longer required, so it drops
  // out of the pending indent list (backend sets IsCompleted=1).
  const closeIndent = async (row: IndentRow) => {
    if (!window.confirm(`Close indent for ${row.ItemCode || row.ItemName}?\nIt will be removed from the pending indent list.`)) return;
    try {
      const res = await fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/CloseIndent`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ transactionDetailId: row.TransactionDetailID }),
      });
      const result = await unwrap(res);
      if (typeof result === "string" && result.startsWith("Error")) {
        showToast("error", "Close failed", result);
        return;
      }
      showToast("success", "Indent closed");
      setSelKeys(prev => { const n = new Set(prev); n.delete(row.TransactionDetailID); return n; });
      await fetchLists();
    } catch (e: any) { showToast("error", "Close failed", e.message); }
  };

  // Cancel a single requisition line — sets it to "Closed" without touching the rest of the voucher.
  const cancelLine = async (line: ReqLine) => {
    if (!window.confirm(`Cancel line "${line.ItemName || line.ItemCode}"?\nThis will mark it Closed and it can no longer be purchased against.`)) return;
    try {
      const res = await fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/CancelLine`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ transactionDetailId: line.TransactionDetailID }),
      });
      const result = await unwrap(res);
      if (result === "TransactionUsed") {
        showToast("warning", "Cannot cancel", "A Purchase Order has already been raised against this line.");
        return;
      }
      if (typeof result === "string" && result.startsWith("Error")) {
        showToast("error", "Cancel failed", result);
        return;
      }
      showToast("success", "Line cancelled");
      await fetchLists();
    } catch (e: any) { showToast("error", "Cancel failed", e.message); }
  };

  const fetchReqDetailRows = async (transactionId: number) => {
    const res = await fetch(`${BASE_URL}/api/PurchaseRequisitionAJ/RetrieveData?transactionId=${transactionId}`, { headers: authHeaders() });
    return unwrap(res);
  };

  const openView = async (h: ReqHeader) => {
    setViewLoading(true);
    try {
      const rows = await fetchReqDetailRows(h.TransactionID);
      setViewReq({ header: h, rows: Array.isArray(rows) ? rows : [] });
    } catch (e: any) { showToast("error", "Failed to load", e.message); }
    finally { setViewLoading(false); }
  };

  const printReq = (h: ReqHeader) => {
    // Open synchronously (before the async fetch below) so the browser doesn't
    // treat it as a blocked pop-up — it isn't a direct response to the click otherwise.
    const win = openPrintWindow();
    if (!win) { showToast("warning", "Popup blocked", "Allow popups to print."); return; }
    win.document.write(`<!doctype html><html><head><title>${escapeHtml(h.VoucherNo)}</title><style>${PRINT_DOC_CSS}</style></head><body><p style="padding:20px;color:#666">Loading…</p></body></html>`);

    (async () => {
      try {
        const rows = await fetchReqDetailRows(h.TransactionID);
        const list: any[] = Array.isArray(rows) ? rows : [];
        const companyName = getCompanyName();
        const totalQty = list.reduce((s, r) => s + toNum(r.RequiredQuantity), 0);

        const rowsHtml = list.map((r, i) => `
          <tr style="background:${i % 2 === 0 ? "#fff" : "#f7f7f7"}">
            <td class="c">${i + 1}</td>
            <td style="font-weight:700">${escapeHtml(r.ItemCode)}</td>
            <td>${escapeHtml(r.ItemName)}</td>
            <td>${escapeHtml(r.ItemGroupName ?? "")}${r.ItemSubGroupName ? " / " + escapeHtml(r.ItemSubGroupName) : ""}</td>
            <td class="r" style="font-weight:700">${fmtQty(toNum(r.RequiredQuantity))}</td>
            <td>${escapeHtml(r.StockUnit)}</td>
            <td>${escapeHtml(r.RefJobCardContentNo ?? "—")}</td>
            <td>${r.ExpectedDeliveryDate ? escapeHtml(fmtDate(r.ExpectedDeliveryDate)) : "—"}</td>
            <td>${escapeHtml(r.ItemNarration ?? "")}</td>
          </tr>`).join("");

        const body = `
          ${printHeaderHtml({
            companyName,
            companyTag: "FLEXIBLE PACKAGING · GRAVURE PRINTING",
            docTitle: "Purchase Requisition",
            docSubtitle: "Material Indent / Requisition Note",
            meta: [
              ["Requisition No", h.VoucherNo ?? "—"],
              ["Requisition Date", fmtDate(h.VoucherDate)],
              ["Total Items", String(list.length)],
              ["Total Qty", fmtQty(totalQty)],
              ["Prepared By", h.CreatedBy ?? "—"],
            ],
          })}

          ${sectionHtml("A", "Items Required")}
          <table class="doc-table">
            <thead><tr>
              <th class="c" style="width:4%">#</th>
              <th style="width:11%">Item Code</th>
              <th style="width:20%">Item Name</th>
              <th style="width:14%">Group / Sub Group</th>
              <th class="r" style="width:8%">Qty</th>
              <th style="width:6%">Unit</th>
              <th style="width:11%">Job Card Ref.</th>
              <th style="width:10%">Exp. Delivery</th>
              <th>Remark</th>
            </tr></thead>
            <tbody>${rowsHtml || `<tr><td colspan="9" class="c" style="padding:12px;color:#999">No items</td></tr>`}</tbody>
          </table>

          ${h.Narration ? `${sectionHtml("B", "Narration")}<div style="border:1px solid #999;padding:5px 8px;margin-bottom:3px;font-size:8pt">${escapeHtml(h.Narration)}</div>` : ""}

          ${signOffHtml(["Requested By", "Approved By", "Store Keeper", "Purchase Dept."])}
          ${footerNoteHtml("Purchase Requisition", companyName)}
        `;

        writeAndPrint(win, `${h.VoucherNo ?? "Requisition"}`, body);
      } catch (e: any) {
        try { win.document.body.innerHTML = `<p style="padding:20px;color:#c00">Failed to load: ${escapeHtml(e.message)}</p>`; } catch { /* window may be closed */ }
        showToast("error", "Print failed", e.message);
      }
    })();
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const openBlank = async () => {
    setEditTxnID(null);
    setLines([]); setReqDate(todayISO()); setNarration("");
    await fetchVoucherNo();
    void ensureJobCards();
    setView("form");
    // Note: item picker no longer opens automatically — user clicks "Add Item".
  };

  const openPicker = async () => {
    setShowPicker(true);
    setPickerSearch(""); setPickerGroup("All"); setPickerSel(new Set());
    if (!pickerItems.length) await fetchPickerItems();
  };

  const openFromIndent = async () => {
    if (selKeys.size === 0) return;
    const sel = indentLines.filter(l => selKeys.has(l.TransactionDetailID));
    setEditTxnID(null);
    setLines(enrichWithJobs(sel.map(il2pr), jobCards));
    setReqDate(todayISO()); setNarration("");
    await fetchVoucherNo();
    void ensureJobCards();
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

      if (rows.length > 0 && rows[0].ErrMsg) {
        showToast("error", "Failed to load", rows[0].ErrMsg);
        return;
      }

      setEditTxnID(h.TransactionID);
      setVoucherNo(h.VoucherNo ?? "");
      setReqDate(h.VoucherDate ? isoFromAny(h.VoucherDate) : todayISO());
      setNarration(h.Narration ?? "");

      const ls: PRLine[] = rows.map((r: any, idx: number) => {
        const packs = toNum(r.RequiredNoOfPacks);
        const qpp = toNum(r.QuantityPerPack);
        return {
          lineKey: `e${toNum(r.ItemID)}-${idx}`,
          ItemID: toNum(r.ItemID),
          ItemGroupID: toNum(r.ItemGroupID),
          ItemGroupName: r.ItemGroupName ?? "",
          ItemSubGroupName: r.ItemSubGroupName ?? "",
          ItemCode: r.ItemCode ?? "",
          ItemName: r.ItemName ?? "",
          IndentDetailID: 0, IndentTxnID: 0, IndentQty: 0,
          BookedStock: toNum(r.BookedStock),
          AllocatedStock: toNum(r.AllocatedStock),
          PhysicalStock: toNum(r.PhysicalStock),
          StockUnit: r.StockUnit ?? "",
          PurchaseUnit: r.PurchaseUnit ?? "",
          PhysicalStockInPU: toNum(r.CurrentStockInPurchaseUnit),
          WtPerPacking: toNum(r.WtPerPacking),
          UnitPerPacking: toNum(r.UnitPerPacking),
          RequiredNoOfPacks: packs,
          QuantityPerPack: qpp,
          POQtyInPU: packs * qpp || toNum(r.RequiredQuantity),
          POQtyInSU: toNum(r.RequiredQuantity),
          JobContentNo: r.RefJobCardContentNo ?? "",
          JobName: "",
          JobBookingJobCardContentsID: toNum(r.RefJobBookingJobCardContentsID),
          GSM: toNum(r.GSM),
          SizeW: toNum(r.SizeW),
          ItemNarration: r.ItemNarration ?? "",
          ExpectedDelivery: r.ExpectedDeliveryDate ? isoFromAny(r.ExpectedDeliveryDate) : "",
          CustomerName: "",
          PWONo: "",
        };
      });

      setLines(enrichWithJobs(ls, jobCards));
      void ensureJobCards();
      setView("form");
    } catch (e: any) { showToast("error", "Load failed", e.message); }
    finally { setFormLoading(false); }
  };

  const il2pr = (il: IndentLine, idx: number = 0): PRLine => ({
    lineKey: `il${il.TransactionDetailID}-${idx}`,
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
    JobBookingJobCardContentsID: 0,
    GSM: toNum(il.GSM),
    SizeW: toNum(il.SizeW),
    ItemNarration: "",
    ExpectedDelivery: "",
    CustomerName: "",
    PWONo: "",
  });

  // ── Line ops ────────────────────────────────────────────────────────────────

  const buildLineFromItem = (item: OverflowItem, idx: number): PRLine => ({
    lineKey: `pk${item.ItemID}-${idx}-${Date.now()}`,
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
    JobBookingJobCardContentsID: 0,
    GSM: toNum(item.GSM), SizeW: toNum(item.SizeW),
    ItemNarration: "", ExpectedDelivery: "",
    CustomerName: "", PWONo: "",
  });

  const togglePickerSel = (id: number) =>
    setPickerSel(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAllPicker = () =>
    setPickerSel(prev => {
      const allSelected = pickerAddableIds.length > 0 && pickerAddableIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) pickerAddableIds.forEach(id => next.delete(id));
      else pickerAddableIds.forEach(id => next.add(id));
      return next;
    });

  // Add every selected (and not-already-present) picker item to the grid at once.
  // Selection is tracked by _uid (ItemsForOverflow can repeat ItemID), but we still
  // dedupe by ItemID so the same item is never added to the grid twice.
  const addSelectedFromPicker = () => {
    const seen = new Set<number>();
    const toAdd = pickerItems.filter(i => {
      if (!pickerSel.has(i._uid)) return false;
      if (lines.some(l => l.ItemID === i.ItemID)) return false;
      if (seen.has(i.ItemID)) return false;
      seen.add(i.ItemID);
      return true;
    });
    if (!toAdd.length) { showToast("warning", "No items selected"); return; }
    setLines(p => [...p, ...toAdd.map((it, i) => buildLineFromItem(it, p.length + i))]);
    setShowPicker(false); setPickerSearch(""); setPickerGroup("All"); setPickerSel(new Set());
  };

  const updateLine = (key: string, field: "RequiredNoOfPacks" | "QuantityPerPack", val: number) => {
    setLines(p => p.map(l => {
      if (l.lineKey !== key) return l;
      const pk = field === "RequiredNoOfPacks" ? val : l.RequiredNoOfPacks;
      const qp = field === "QuantityPerPack" ? val : l.QuantityPerPack;
      return { ...l, [field]: val, POQtyInPU: pk * qp, POQtyInSU: pk * qp };
    }));
  };

  const removeLine = (key: string) => setLines(p => p.filter(l => l.lineKey !== key));

  const updateLineStr =(key: string, field: "ItemNarration" | "ExpectedDelivery", val: string) =>
    setLines(p => p.map(l => l.lineKey === key ? { ...l, [field]: val } : l));

  const enrichWithJobs = useCallback((arr: PRLine[], cards: JobCardOption[]): PRLine[] => {
    if (!cards.length) return arr;
    let changed = false;
    const next = arr.map(l => {
      if (!l.JobContentNo) return l;
      const jc = cards.find(j => j.JobCardContentNo === l.JobContentNo);
      if (!jc) return l;
      if (l.CustomerName === (jc.CustomerName ?? "") &&
        l.JobName === (jc.JobName ?? l.JobName) &&
        l.JobBookingJobCardContentsID === jc.JobBookingJobCardContentsID) return l;
      changed = true;
      return {
        ...l,
        JobBookingJobCardContentsID: jc.JobBookingJobCardContentsID,
        JobName: jc.JobName ?? l.JobName,
        CustomerName: jc.CustomerName ?? "",
        PWONo: jc.PWONo ?? "",
      };
    });
    return changed ? next : arr;
  }, []);

  useEffect(() => {
    setLines(prev => enrichWithJobs(prev, jobCards));
  }, [jobCards, enrichWithJobs]);

  // ── Save ────────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!lines.length) { showToast("warning", "Add at least one item"); return; }
    const zeroQtyItems = lines.filter(l => l.POQtyInPU <= 0);
    if (zeroQtyItems.length) {
      showToast("warning", "Quantity required", `Set qty > 0 for: ${zeroQtyItems.map(l => l.ItemName).join(", ")}`);
      return;
    }
    if (!editTxnID) {
      const noDateItems = lines.filter(l => !l.ExpectedDelivery);
      if (noDateItems.length) {
        showToast("warning", "Expected Delivery Date required", noDateItems.map(l => l.ItemName).join(", "));
        return;
      }
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
          RefJobBookingJobCardContentsID: l.JobBookingJobCardContentsID ?? 0,
          ItemNarration: l.ItemNarration,
          ExpectedDeliveryDate: l.ExpectedDelivery || null,
          IsVoucherItemApproved: 1,
          // Partial-fulfilment: link this requisition line back to its source indent
          // line and record the stock-unit qty it consumes (used to reverse on delete).
          SourceIndentDetailID: l.IndentDetailID > 0 ? l.IndentDetailID : 0,
          RequisitionedQuantity: l.IndentDetailID > 0 ? l.POQtyInSU : 0,
        })),
        UpdateIndentDetails: lines
          .filter(l => l.IndentDetailID > 0)
          .map(l => ({ TransactionDetailID: l.IndentDetailID, Qty: l.POQtyInSU })),
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
        showToast("warning", "Cannot edit", "This requisition is linked to a Purchase Order.");
        return;
      }
      if (result === "RequisitionApproved") {
        showToast("warning", "Cannot edit", "One or more items are already approved.");
        return;
      }
      showToast("success", typeof result === "string" ? result : "Saved successfully!");
      await fetchLists();
      setSelKeys(new Set());
      setView("list"); setTab("reqs");
    } catch (e: any) { showToast("error", "Save failed", e.message); }
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
        showToast("warning", "Cannot delete", "This requisition is already linked to a Purchase Order.");
        return;
      }
      if (typeof result === "string" && result.startsWith("Error")) {
        showToast("error", "Delete failed", result);
        return;
      }
      showToast("success", "Deleted successfully");
      await fetchLists();
    } catch (e: any) { showToast("error", "Delete failed", e.message); }
    finally { setDeleting(false); }
  };

  // ── Export CSV ───────────────────────────────────────────────────────────────

  const exportCSV = () => {
    if (!filteredReqLines.length) { showToast("info", "No records to export"); return; }
    const header = ["Req.No", "Req.Date", "Item Code", "Item Group", "Sub Group", "Item Name", "Face GSM", "Width (mm)", "Qty", "Status"];
    const rows = filteredReqLines.map(r => [
      r.VoucherNo ?? "",
      r.VoucherDate ?? "",
      r.ItemCode ?? "",
      r.ItemGroupName ?? "",
      r.ItemSubGroupName ?? "",
      `"${(r.ItemName ?? "").replace(/"/g, '""')}"`,
      r.GSM,
      r.SizeW,
      r.RequiredQuantity,
      r.Status,
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

  const augmentedIndent: IndentRow[] = useMemo(() =>
    indentLines.map(l => ({
      ...l,
      Source: l.JobBookingContentNo ? "Job Card" : "Stock",
      FreeStock: toNum(l.PhysicalStock) - toNum(l.AllocatedStock),
    })),
    [indentLines]);

  const jobCardCount = useMemo(() => augmentedIndent.filter(r => r.Source === "Job Card").length, [augmentedIndent]);
  const stockCount   = useMemo(() => augmentedIndent.filter(r => r.Source === "Stock").length, [augmentedIndent]);

  const filteredIndent = useMemo(() => {
    const s = search.trim().toLowerCase();
    return augmentedIndent.filter(l =>
      (indentSource === "All" || l.Source === indentSource) &&
      (!s || [l.ItemName, l.ItemCode, l.VoucherNo, l.ItemGroupName, l.ItemSubGroupName]
        .some(v => (v ?? "").toLowerCase().includes(s)))
    );
  }, [augmentedIndent, indentSource, search]);

  const reqStatusCounts = useMemo(() => {
    const c: Record<"All" | ReqLineStatus, number> = { All: reqLines.length, Pending: 0, Approved: 0, "PO Created": 0, Closed: 0 };
    reqLines.forEach(l => { c[l.Status] = (c[l.Status] ?? 0) + 1; });
    return c;
  }, [reqLines]);

  const filteredReqLines = useMemo(() => {
    const s = search.trim().toLowerCase();
    return reqLines.filter(l =>
      (reqStatus === "All" || l.Status === reqStatus) &&
      (!s || [l.VoucherNo, l.ItemCode, l.ItemName, l.ItemGroupName, l.ItemSubGroupName]
        .some(v => (v ?? "").toLowerCase().includes(s)))
    );
  }, [reqLines, reqStatus, search]);

  const toggleSel = (id: number) => {
    setSelKeys(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const indentColumns: Column<IndentRow>[] = useMemo(() => [
    {
      key: "sel", header: "", width: "w-8",
      render: row => (
        <input
          type="checkbox" checked={selKeys.has(row.TransactionDetailID)}
          onChange={() => toggleSel(row.TransactionDetailID)}
          onClick={e => e.stopPropagation()}
          className="rounded border-none"
        />
      ),
    },
    { key: "VoucherNo", header: "Indent No.", render: r => <span className="font-mono text-[rgb(var(--color-primary))]">{r.VoucherNo ?? "—"}</span> },
    { key: "VoucherDate", header: "Indent Date", render: r => fmtDate(r.VoucherDate) },
    { key: "ItemGroupName", header: "Item Group", render: r => r.ItemGroupName ?? "—" },
    { key: "ItemSubGroupName", header: "Sub Group", render: r => r.ItemSubGroupName ?? "—" },
    {
      key: "ItemCode", header: "Item Code",
      render: r => (
        <div>
          <span className="font-mono text-[rgb(var(--color-primary))] block">{r.ItemCode}</span>
          {r.ItemDescription && <span className="text-[rgb(var(--fg-muted))] text-xs block leading-tight mt-0.5">{r.ItemDescription}</span>}
        </div>
      ),
    },
    { key: "ItemName", header: "Item Name", render: r => r.ItemName ?? "—" },
    { key: "GSM", header: "Face GSM", render: r => r.GSM ?? "—" },
    { key: "SizeW", header: "Width (mm)", render: r => r.SizeW ?? "—" },
    { key: "RequiredQuantity", header: "Indent Qty", render: r => toNum(r.RequiredQuantity).toLocaleString() },
    { key: "PhysicalStock", header: "Current Stock", render: r => toNum(r.PhysicalStock).toLocaleString() },
    { key: "BookedStock", header: "Booked Stock", render: r => toNum(r.BookedStock).toLocaleString() },
    { key: "FreeStock", header: "Free Stock", render: r => toNum(r.FreeStock).toLocaleString() },
    { key: "StockUnit", header: "Stock Unit", render: r => r.StockUnit ?? "—" },
    {
      key: "Source", header: "Source",
      render: r => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.Source === "Job Card" ? "bg-[rgb(var(--color-primary-subtle))] text-[rgb(var(--color-primary))]" : "bg-amber-100 text-amber-700"}`}>
          {r.Source}
        </span>
      ),
    },
  ], [selKeys]);

  const reqLineColumns: Column<ReqLine>[] = useMemo(() => [
    { key: "VoucherNo", header: "Req.No.", render: r => <span className="font-mono text-[rgb(var(--color-primary))] font-semibold">{r.VoucherNo ?? "—"}</span> },
    { key: "VoucherDate", header: "Req.Date", render: r => fmtDate(r.VoucherDate) },
    { key: "ItemCode", header: "Item Code", render: r => <span className="font-mono text-[rgb(var(--color-primary))]">{r.ItemCode ?? "—"}</span> },
    { key: "ItemGroupName", header: "Item Group", render: r => r.ItemGroupName ?? "—" },
    { key: "ItemSubGroupName", header: "Sub Group", render: r => r.ItemSubGroupName ?? "—" },
    { key: "ItemName", header: "Item Name", render: r => r.ItemName ?? "—" },
    { key: "GSM", header: "Face GSM", render: r => r.GSM || "—" },
    { key: "SizeW", header: "Width (mm)", render: r => r.SizeW || "—" },
    { key: "Status", header: "Status", render: r => statusBadge(r.Status) },
  ], []);

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

  // Picker rows (by _uid) that can still be added (not already in the grid)
  const pickerAddableIds = useMemo(
    () => filteredPicker.filter(i => !lines.some(l => l.ItemID === i.ItemID)).map(i => i._uid),
    [filteredPicker, lines]
  );
  const allPickerSelected = pickerAddableIds.length > 0 && pickerAddableIds.every(id => pickerSel.has(id));

  // ════════════════════════════════════════════════════════════════════════════
  // FORM VIEW
  // ════════════════════════════════════════════════════════════════════════════

  const creationModal = (
    <Modal
      open={view === "form"}
      onClose={() => setView("list")}
      title={editTxnID ? `Edit Purchase Requisition — ${voucherNo}` : "Purchase Requisition Creation"}
      size="xl"
    >
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-5 flex flex-col">

        {/* Content card */}
        <div className="bg-[rgb(var(--bg-surface))] overflow-hidden">

          {/* Info bar */}
          <div className="px-6 py-3 border-b border-[rgb(var(--bd-default))] bg-[rgb(var(--bg-subtle))] flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider whitespace-nowrap">Req. No.</label>
              <input
                readOnly value={voucherNo}
                className="border border-[rgb(var(--bd-default))] rounded-md px-3 py-1.5 text-xs font-mono font-semibold text-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-subtle))] focus:outline-none w-48"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider whitespace-nowrap">Date</label>
              <input
                type="date" value={reqDate} onChange={e => setReqDate(e.target.value)}
                className="border border-[rgb(var(--bd-default))] rounded-md px-3 py-1.5 text-xs text-[rgb(var(--fg-default))] bg-[rgb(var(--bg-surface))]"
              />
            </div>
            <div className="ml-auto">
              <Button
                variant="action-create" size="sm" icon={<Plus size={14} />}
                onClick={openPicker}
              >
                Add Item
              </Button>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: 2280 }}>
              <thead>
                <tr className="bg-[rgb(var(--bg-subtle))] border-b border-[rgb(var(--bd-default))]">
                  {[
                    { label: "Item\nCode", right: false },
                    { label: "Item Group", right: false },
                    { label: "Sub Group", right: false },
                    { label: "Item Name", right: false },
                    { label: "Face\nGSM", right: true },
                    { label: "Width", right: true },
                    { label: "No. Of\nPacks/Rolls", right: true },
                    { label: "Qty /\nPack/Roll", right: true },
                    { label: "Purchase\nQuantity (In SU)", right: true },
                    { label: "Purchase\nQuantity (In PU)", right: true },
                    { label: "Item\nRemark", right: false },
                    { label: "Indent\nQty", right: true },
                    { label: "Booked\nStock", right: true },
                    { label: "Current Stock\n(In S.U.)", right: true },
                    { label: "Stock\nUnit", right: false },
                    { label: "Current Stock\n(In P.U.)", right: true },
                    { label: "Purchase\nUnit", right: false },
                    { label: "Expec.\nDel.Date *", right: false },
                    { label: "", right: false },
                  ].map((c, i) => (
                    <th
                      key={i}
                      className={`px-3 py-2.5 font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider whitespace-pre-line leading-tight ${c.right ? "text-right" : "text-left"}`}
                      style={{ fontSize: 10 }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={23} className="text-center py-24 text-[rgb(var(--fg-subtle))] text-sm">
                      No items — click &ldquo;+ Add Item&rdquo; to begin
                    </td>
                  </tr>
                ) : lines.map((l, idx) => (
                  <tr
                    key={l.lineKey}
                    className={`border-b border-[rgb(var(--bd-default))] hover:bg-[rgb(var(--bg-hover))] transition-colors ${idx % 2 === 0 ? "bg-[rgb(var(--bg-surface))]" : "bg-[rgb(var(--bg-subtle))]"}`}
                  >
                    <td className="px-3 py-2 font-mono text-[rgb(var(--color-primary))] whitespace-nowrap">{l.ItemCode}</td>
                    <td className="px-3 py-2 text-[rgb(var(--fg-default))] whitespace-nowrap">{l.ItemGroupName}</td>
                    <td className="px-3 py-2 text-[rgb(var(--fg-muted))] whitespace-nowrap">{l.ItemSubGroupName || "—"}</td>
                    <td className="px-3 py-2 text-[rgb(var(--fg-default))]" style={{ maxWidth: 200 }}>{l.ItemName}</td>
                    <td className="px-3 py-2 text-right text-[rgb(var(--fg-muted))]">{l.GSM || "—"}</td>
                    <td className="px-3 py-2 text-right text-[rgb(var(--fg-muted))]">{l.SizeW || "—"}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number" min={0}
                        value={l.RequiredNoOfPacks || ""}
                        onChange={e => updateLine(l.lineKey, "RequiredNoOfPacks", Number(e.target.value))}
                        onWheel={e => (e.currentTarget as HTMLInputElement).blur()}
                        className="no-spinner w-20 text-right px-2 py-1 border border-[rgb(var(--bd-default))] rounded-md text-xs font-semibold text-[rgb(var(--fg-default))] bg-[rgb(var(--bg-surface))]"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number" min={0}
                        value={l.QuantityPerPack || ""}
                        onChange={e => updateLine(l.lineKey, "QuantityPerPack", Number(e.target.value))}
                        onWheel={e => (e.currentTarget as HTMLInputElement).blur()}
                        className="no-spinner w-24 text-right px-2 py-1 border border-[rgb(var(--bd-default))] rounded-md text-xs font-semibold text-[rgb(var(--fg-default))] bg-[rgb(var(--bg-surface))]"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-[rgb(var(--color-primary))]">{l.POQtyInSU.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-[rgb(var(--color-primary))]">{l.POQtyInPU.toLocaleString()}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={l.ItemNarration}
                        onChange={e => updateLineStr(l.lineKey, "ItemNarration", e.target.value)}
                        className="w-28 px-2 py-1 border border-[rgb(var(--bd-default))] rounded-md text-xs text-[rgb(var(--fg-default))] bg-[rgb(var(--bg-surface))]"
                        placeholder="Remark…"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-[rgb(var(--fg-muted))]">{l.IndentQty || "—"}</td>
                    <td className="px-3 py-2 text-right text-[rgb(var(--fg-muted))]">{l.BookedStock.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-[rgb(var(--fg-default))]">{l.PhysicalStock.toLocaleString()}</td>
                    <td className="px-3 py-2 text-[rgb(var(--fg-muted))]">{l.StockUnit}</td>
                    <td className="px-3 py-2 text-right text-[rgb(var(--fg-default))]">{l.PhysicalStockInPU.toLocaleString()}</td>
                    <td className="px-3 py-2 text-[rgb(var(--fg-muted))]">{l.PurchaseUnit}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={l.ExpectedDelivery}
                        onChange={e => updateLineStr(l.lineKey, "ExpectedDelivery", e.target.value)}
                        className={`w-32 px-2 py-1 border rounded-md text-xs text-[rgb(var(--fg-default))] bg-[rgb(var(--bg-surface))] ${l.ExpectedDelivery ? "border-[rgb(var(--bd-default))]" : "border-red-300"}`}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => removeLine(l.lineKey)} className="text-[rgb(var(--fg-subtle))] hover:text-red-500 transition-colors p-1 rounded">
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {lines.length > 0 && (
                <tfoot>
                  <tr className="bg-[rgb(var(--color-primary-subtle))] border-t-2 border-[rgb(var(--color-primary))]">
                    <td colSpan={9} className="px-3 py-2 text-right text-xs font-bold text-[rgb(var(--color-primary))]">Total Purchase Qty (In PU)</td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-[rgb(var(--color-primary))]">{totalPOQty.toLocaleString()}</td>
                    <td colSpan={9} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile card view */}
          <div className="lg:hidden">
            {lines.length === 0 ? (
              <div className="text-center py-16 text-[rgb(var(--fg-subtle))] text-sm">Tap &ldquo;+ Add Item&rdquo; to begin</div>
            ) : (
              <div className="space-y-3 p-4">
                {lines.map(l => (
                  <div key={l.lineKey} className="bg-[rgb(var(--bg-surface))] rounded-xl border border-[rgb(var(--bd-default))] shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-[rgb(var(--bg-subtle))] border-b border-[rgb(var(--bd-default))] flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-bold text-[rgb(var(--color-primary))]">{l.ItemCode}</p>
                        <p className="text-sm font-semibold text-[rgb(var(--fg-default))] truncate">{l.ItemName}</p>
                        <p className="text-xs text-[rgb(var(--fg-muted))]">{l.ItemGroupName}{l.ItemSubGroupName ? ` · ${l.ItemSubGroupName}` : ""}</p>
                      </div>
                      <button onClick={() => removeLine(l.lineKey)} className="flex-shrink-0 p-2 rounded-lg text-[rgb(var(--fg-subtle))] hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-[rgb(var(--bd-default))] border-b border-[rgb(var(--bd-default))]">
                      {[
                        { label: "Curr. Stock", val: `${l.PhysicalStock} ${l.StockUnit}` },
                        { label: "Allocated", val: l.AllocatedStock.toLocaleString() },
                        { label: "Indent Qty", val: l.IndentQty || "—" },
                      ].map(({ label, val }) => (
                        <div key={label} className="px-3 py-2.5 text-center">
                          <p className="text-xs text-[rgb(var(--fg-subtle))] font-medium">{label}</p>
                          <p className="text-sm font-semibold text-[rgb(var(--fg-default))] mt-0.5">{val}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 px-4 py-3 border-b border-[rgb(var(--bd-default))]">
                      <div>
                        <p className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase mb-1.5">No. of Packs/Rolls</p>
                        <input
                          type="number" min={0} value={l.RequiredNoOfPacks || ""}
                          onChange={e => updateLine(l.lineKey, "RequiredNoOfPacks", Number(e.target.value))}
                          onWheel={e => (e.currentTarget as HTMLInputElement).blur()}
                          className="no-spinner w-full text-right px-3 py-2 border border-[rgb(var(--bd-default))] rounded-md text-sm font-semibold text-[rgb(var(--fg-default))] bg-[rgb(var(--bg-surface))]"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase mb-1.5">Qty / Pack/Roll</p>
                        <input
                          type="number" min={0} value={l.QuantityPerPack || ""}
                          onChange={e => updateLine(l.lineKey, "QuantityPerPack", Number(e.target.value))}
                          onWheel={e => (e.currentTarget as HTMLInputElement).blur()}
                          className="no-spinner w-full text-right px-3 py-2 border border-[rgb(var(--bd-default))] rounded-md text-sm font-semibold text-[rgb(var(--fg-default))] bg-[rgb(var(--bg-surface))]"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase mb-1.5">Item Remark</p>
                        <input
                          type="text" value={l.ItemNarration}
                          onChange={e => updateLineStr(l.lineKey, "ItemNarration", e.target.value)}
                          className="w-full px-3 py-2 border border-[rgb(var(--bd-default))] rounded-md text-sm text-[rgb(var(--fg-default))] bg-[rgb(var(--bg-surface))]"
                          placeholder="Remark…"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[rgb(var(--fg-muted))] uppercase mb-1.5">Expec. Del. Date <span className="text-red-500">*</span></p>
                        <input
                          type="date" value={l.ExpectedDelivery}
                          onChange={e => updateLineStr(l.lineKey, "ExpectedDelivery", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md text-sm text-[rgb(var(--fg-default))] bg-[rgb(var(--bg-surface))] ${l.ExpectedDelivery ? "border-[rgb(var(--bd-default))]" : "border-red-300"}`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-[rgb(var(--bd-default))] bg-[rgb(var(--color-primary-subtle))]">
                      <div className="px-4 py-2.5 text-center">
                        <p className="text-xs text-[rgb(var(--color-primary))] font-medium">P.O. Qty (P.U.)</p>
                        <p className="text-base font-bold text-[rgb(var(--color-primary))]">{l.POQtyInPU.toLocaleString()}</p>
                      </div>
                      <div className="px-4 py-2.5 text-center">
                        <p className="text-xs text-[rgb(var(--fg-muted))] font-medium">P.O. Qty (S.U.)</p>
                        <p className="text-base font-bold text-[rgb(var(--fg-default))]">{l.POQtyInSU.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bg-[rgb(var(--color-primary))] rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/80">Total P.O. Qty (P.U.)</span>
                  <span className="text-xl font-bold text-white">{totalPOQty.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Narration */}
          <div className="px-6 py-4 border-t border-[rgb(var(--bd-default))]">
            <Textarea
              label="Narration / Remark"
              value={narration}
              onChange={e => setNarration(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-[rgb(var(--bg-surface))] border-t border-[rgb(var(--bd-default))] px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={() => setView("list")}>
            Close
          </Button>
          {editTxnID != null && (
            <Button
              variant="secondary" size="sm" icon={<Printer size={14} />}
              onClick={() => { const h = reqHeaders.find(x => x.TransactionID === editTxnID); if (h) printReq(h); }}
            >
              Print
            </Button>
          )}
          {editTxnID != null && (
            <Button variant="action-cancel" size="sm" loading={deleting}
              onClick={() => { const h = reqHeaders.find(x => x.TransactionID === editTxnID); if (h) deleteReq(h); }}
            >
              Delete
            </Button>
          )}
          <Button variant="action-save" size="sm" loading={saving} onClick={save}>
            {editTxnID ? "Update" : "Save"}
          </Button>
        </div>

        {/* Item picker modal */}
        <Modal
          open={showPicker}
          onClose={() => setShowPicker(false)}
          title="Add Item to Requisition"
          size="xl"
        >
          <div className="flex flex-col gap-3 -mx-4 -mt-4 sm:-mx-6 sm:-mt-5">
            <div className="px-5 py-3 border-b border-[rgb(var(--bd-default))] space-y-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-muted))]" />
                <input
                  autoFocus value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Search by item name or code…"
                  className="w-full pl-9 pr-4 py-2 border border-[rgb(var(--bd-default))] rounded-md text-xs bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] placeholder:text-[rgb(var(--fg-subtle))]"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {pickerGroups.map(g => (
                  <button
                    key={g} onClick={() => setPickerGroup(g)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${pickerGroup === g ? "bg-[rgb(var(--color-primary))] text-white border-[rgb(var(--color-primary))]" : "bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-muted))] border-[rgb(var(--bd-default))] hover:border-[rgb(var(--color-primary))] hover:text-[rgb(var(--color-primary))]"}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "55vh" }}>
              {pickerLoading ? (
                <div className="text-center py-12 text-[rgb(var(--fg-subtle))]">Loading items…</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[rgb(var(--bg-subtle))] border-b border-[rgb(var(--bd-default))]">
                    <tr>
                      <th className="px-3 py-2 text-center w-10">
                        <input
                          type="checkbox"
                          checked={allPickerSelected}
                          onChange={toggleAllPicker}
                          disabled={pickerAddableIds.length === 0}
                          className="rounded border-none"
                          title="Select all"
                        />
                      </th>
                      {["Code", "Item Name", "Group", "Sub Group", "Curr. Stock", "Purch. Unit", "Stock UOM"].map((h, i) => (
                        <th key={i} className={`px-4 py-2 font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider ${i >= 4 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPicker.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-[rgb(var(--fg-subtle))]">No items found</td></tr>
                    ) : filteredPicker.map(item => {
                      const added = lines.some(l => l.ItemID === item.ItemID);
                      const selected = pickerSel.has(item._uid);
                      return (
                        <tr
                          key={item._uid}
                          onClick={() => !added && togglePickerSel(item._uid)}
                          className={`border-b border-[rgb(var(--bd-default))] transition-colors ${added ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-[rgb(var(--bg-hover))]"} ${selected ? "bg-[rgb(var(--color-primary-subtle))]" : ""}`}
                        >
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={added || selected}
                              disabled={added}
                              readOnly
                              className="rounded border-none pointer-events-none"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-[rgb(var(--color-primary))] font-semibold block">{item.ItemCode}</span>
                            {item.ItemDescription && <span className="text-[rgb(var(--fg-subtle))] text-xs block leading-tight mt-0.5">{item.ItemDescription}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-[rgb(var(--fg-default))] font-medium">
                            {item.ItemName}
                            {added && <span className="ml-2 text-[10px] font-semibold text-[rgb(var(--fg-subtle))] uppercase">Added</span>}
                          </td>
                          <td className="px-4 py-2.5 text-[rgb(var(--fg-muted))]">{item.ItemGroupName}</td>
                          <td className="px-4 py-2.5 text-[rgb(var(--fg-muted))]">{item.ItemSubGroupName || "—"}</td>
                          <td className="px-4 py-2.5 text-right text-[rgb(var(--fg-default))]">{toNum(item.PhysicalStock).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-[rgb(var(--fg-muted))]">{item.PurchaseUnit}</td>
                          <td className="px-4 py-2.5 text-right text-[rgb(var(--fg-muted))]">{item.StockUnit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[rgb(var(--bd-default))] flex items-center justify-between gap-3">
              <p className="text-xs text-[rgb(var(--fg-subtle))]">
                {pickerSel.size > 0 ? `${pickerSel.size} item${pickerSel.size > 1 ? "s" : ""} selected` : "Select items to add"}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowPicker(false)}>Cancel</Button>
                <Button
                  variant="action-create" size="sm" icon={<Plus size={14} />}
                  onClick={addSelectedFromPicker}
                  disabled={pickerSel.size === 0}
                >
                  Add{pickerSel.size > 0 ? ` (${pickerSel.size})` : ""}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </Modal>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="w-full space-y-4">

      {/* Page heading */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="w-[124px] flex-shrink-0" />
        <div className="text-center flex-1">
          <h2 className="text-xl font-bold text-[rgb(var(--fg-default))]">Purchase Requisition</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            {tab === "indent" ? `${filteredIndent.length} indent lines` : `${filteredReqLines.length} requisition lines`}
          </p>
        </div>
        <div className="w-[124px] flex-shrink-0 flex justify-end">
          <Button variant="secondary" size="sm" icon={<History size={14} />} onClick={() => showToast("info", "Audit Trail", "Coming soon")}>
            Audit Trail
          </Button>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">

        {/* Tab pills — segmented control */}
        <div className="flex items-center gap-1 p-1 bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--bd-default))] rounded-full">
          {([
            { key: "indent" as const, label: "Indent List", icon: <List size={14} /> },
            { key: "reqs" as const, label: "Created Requisitions", icon: <FileText size={14} /> },
          ]).map(t => (
            <button
              key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${tab === t.key ? "bg-[rgb(var(--color-primary))] text-white shadow-sm" : "text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]"}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] rounded-lg px-3 py-2 shadow-sm">
            <Search size={14} className="text-[rgb(var(--fg-muted))] flex-shrink-0" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="bg-transparent text-xs text-[rgb(var(--fg-default))] outline-none w-40 sm:w-56 border-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]">
                <X size={12} />
              </button>
            )}
          </div>
          <Button variant="action-refresh" size="sm" icon={<RefreshCw size={14} />} onClick={fetchLists} />
          {tab === "reqs" && filteredReqLines.length > 0 && (
            <Button variant="action-download" size="sm" icon={<Download size={14} />} onClick={exportCSV}>
              Export
            </Button>
          )}
          <Button
            variant="action-create" size="sm" icon={<Plus size={15} />}
            onClick={() => (tab === "indent" && selKeys.size > 0 ? openFromIndent() : openBlank())}
          >
            Create{tab === "indent" && selKeys.size > 0 ? ` (${selKeys.size})` : ""}
          </Button>
        </div>
      </div>

      {/* Content panel */}
      <div className="bg-[rgb(var(--bg-surface))] rounded-xl border border-[rgb(var(--bd-default))] shadow-sm overflow-hidden">

        {listLoading ? (
          <div className="text-center py-16 text-[rgb(var(--fg-subtle))]">Loading…</div>
        ) : listErr ? (
          <div className="text-center py-16 text-sm">
            <span className="text-red-500">{listErr}</span>
            <button onClick={fetchLists} className="ml-2 text-[rgb(var(--color-primary))] underline">Retry</button>
          </div>
        ) : tab === "indent" ? (

          /* ── INDENT LIST ──────────────────────────────────── */
          <div className="p-4">
            <DataTable
              data={filteredIndent}
              columns={indentColumns}
              getRowId={r => String(r.TransactionDetailID)}
              enableRowSelection={false}
              actions={row => (
                <div className="flex items-center gap-1">
                  <Button variant="secondary" size="xs" icon={<Boxes size={12} />} onClick={() => openStockView(row)}>
                    Stock
                  </Button>
                  {row.TransactionDetailID > 0 && (
                    <Button variant="action-cancel" size="xs" icon={<X size={12} />} onClick={() => closeIndent(row)}>
                      Close
                    </Button>
                  )}
                </div>
              )}
              toolbar={
                <div className="flex items-center gap-2 flex-wrap">
                  {([
                    { key: "All" as const, label: `All (${augmentedIndent.length})` },
                    { key: "Job Card" as const, label: `Job Card (${jobCardCount})` },
                    { key: "Stock" as const, label: `Stock (${stockCount})` },
                  ]).map(p => (
                    <button
                      key={p.key} onClick={() => setIndentSource(p.key)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${indentSource === p.key ? "bg-[rgb(var(--color-primary))] text-white border-[rgb(var(--color-primary))]" : "bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-muted))] border-[rgb(var(--bd-default))] hover:border-[rgb(var(--color-primary))] hover:text-[rgb(var(--color-primary))]"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                  {selKeys.size > 0 && (
                    <button onClick={() => setSelKeys(new Set())} className="text-xs text-[rgb(var(--fg-muted))] hover:text-red-600 underline ml-1">
                      Clear selection
                    </button>
                  )}
                </div>
              }
            />
          </div>

        ) : (

          /* ── CREATED REQUISITIONS (item-level) ────────────── */
          <div className="p-4">
            <DataTable
              data={filteredReqLines}
              columns={reqLineColumns}
              getRowId={r => String(r.TransactionDetailID)}
              enableRowSelection={false}
              actions={line => {
                const header = reqHeaders.find(h => h.TransactionID === line.TransactionID);
                return (
                  <RowActions>
                    <RowAction.Print onClick={() => header && printReq(header)} disabled={!header} />
                    <RowAction.View onClick={() => header && openView(header)} disabled={!header || viewLoading} />
                    <RowAction.Edit onClick={() => header && openEdit(header)} disabled={!header || formLoading || deleting} />
                    <RowAction.Reject
                      tooltip="Cancel line"
                      onClick={() => cancelLine(line)}
                      disabled={line.Status === "Closed"}
                    />
                    <RowAction.Delete onClick={() => header && deleteReq(header)} disabled={!header || deleting || formLoading} />
                  </RowActions>
                );
              }}
              toolbar={
                <div className="flex items-center gap-2 flex-wrap">
                  {([
                    { key: "All" as const, label: "All" },
                    { key: "Pending" as const, label: "Pending" },
                    { key: "Approved" as const, label: "Approved" },
                    { key: "PO Created" as const, label: "Proceed" },
                    { key: "Closed" as const, label: "Closed" },
                  ]).map(p => (
                    <button
                      key={p.key} onClick={() => setReqStatus(p.key)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${reqStatus === p.key ? "bg-[rgb(var(--color-primary))] text-white border-[rgb(var(--color-primary))]" : "bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-muted))] border-[rgb(var(--bd-default))] hover:border-[rgb(var(--color-primary))] hover:text-[rgb(var(--color-primary))]"}`}
                    >
                      {p.label} ({reqStatusCounts[p.key] ?? 0})
                    </button>
                  ))}
                </div>
              }
            />
          </div>
        )}
      </div>

      {creationModal}

      {/* Read-only view modal (eye icon) */}
      <Modal
        open={!!viewReq}
        onClose={() => setViewReq(null)}
        title={viewReq ? `View — ${viewReq.header.VoucherNo}` : "View Requisition"}
        size="lg"
        subHeader={viewReq && (
          <p className="text-xs text-[rgb(var(--fg-muted))] pb-2">
            {fmtDate(viewReq.header.VoucherDate)}{viewReq.header.Narration ? ` · ${viewReq.header.Narration}` : ""}
          </p>
        )}
      >
        {!viewReq || viewReq.rows.length === 0 ? (
          <div className="text-center py-12 text-[rgb(var(--fg-subtle))] text-sm">No items found</div>
        ) : (
          <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[rgb(var(--bg-subtle))] border-b border-[rgb(var(--bd-default))]">
                <tr>
                  {["Item Code", "Item Name", "Qty", "Unit", "Remark"].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider ${i === 2 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewReq.rows.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-[rgb(var(--bd-default))] hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[rgb(var(--color-primary))]">{r.ItemCode}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--fg-default))]">{r.ItemName}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[rgb(var(--fg-default))]">{toNum(r.RequiredQuantity).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--fg-muted))]">{r.StockUnit}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--fg-muted))]">{r.ItemNarration || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Stock quick-view modal */}
      <Modal
        open={!!stockView}
        onClose={() => setStockView(null)}
        title={stockView ? `Stock — ${stockView.itemName}` : "Stock"}
        size="lg"
        subHeader={stockView && (
          <p className="text-xs text-[rgb(var(--fg-muted))] font-mono pb-2">{stockView.itemCode}</p>
        )}
      >
        {stockLoading ? (
          <div className="text-center py-12 text-[rgb(var(--fg-subtle))]">Loading…</div>
        ) : stockBatches.length === 0 ? (
          <div className="text-center py-12 text-[rgb(var(--fg-subtle))] text-sm">No batches found for this item</div>
        ) : (
          <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[rgb(var(--bg-subtle))] border-b border-[rgb(var(--bd-default))]">
                <tr>
                  {["Batch No.", "Warehouse", "Bin", "System Qty"].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 font-semibold text-[rgb(var(--fg-muted))] uppercase tracking-wider ${i === 3 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stockBatches.map((b, i) => (
                  <tr key={`${b.BatchID}-${b.WarehouseID}-${b.Bin}-${i}`} className="border-b border-[rgb(var(--bd-default))] hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[rgb(var(--color-primary))]">{b.BatchNo}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--fg-muted))]">{b.WarehouseName}</td>
                    <td className="px-4 py-2.5 text-[rgb(var(--fg-muted))]">{b.Bin}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[rgb(var(--fg-default))]">{toNum(b.SystemQty).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
