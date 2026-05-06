"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus, X, Scan, Printer, CheckCircle2,
  Camera, Keyboard, Trash2, QrCode,
  Layers, Package, ArrowLeft, FileText, ChevronRight, ChevronDown, RefreshCw,
} from "lucide-react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { authHeaders, getSession } from "@/lib/auth";
import { inputCls, labelCls } from "@/lib/styles";

// ─── Config ──────────────────────────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";


async function apiFetch(url: string): Promise<any> {
  const res = await fetch(url, { headers: authHeaders() });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function unwrap(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('"') && t.endsWith('"')) { try { return JSON.parse(t); } catch { } }
  return t;
}

// ─── Types ───────────────────────────────────────────────────
interface Supplier  { LedgerID: number; LedgerName: string; }
interface WH        { Warehouse: string; }
interface BinRow    { Bin: string; WarehouseID: number; }
interface Receiver  { LedgerID: number; LedgerName: string; }

interface PendingPOItem {
  TransactionID: number;
  PurchaseVoucherNo: string;
  PurchaseVoucherDate: string;
  LedgerID: number;
  LedgerName: string;
  ItemID: number;
  ItemGroupID: number;
  ItemSubGroupID: number;
  ItemCode: string;
  ItemName: string;
  PurchaseOrderQuantity: number;
  ReceiptQuantity: number;
  PendingQty: number;
  PurchaseTolerance: number;
  PurchaseUnit: string;
  StockUnit: string;
  GradesOfSupplier: string;
  PurchaseRate: number;
}

interface GRNListRow {
  TransactionID: number;
  PurchaseTransactionID: number;
  LedgerID: number;
  LedgerName: string;
  ReceiptVoucherNo: string;
  ReceiptVoucherDate: string;
  PurchaseVoucherNo: string;
  ChallanQuantity: number;
  DeliveryNoteNo: string;
  DeliveryNoteDate: string;
  GateEntryNo: string;
  GateEntryDate: string;
  EWayBillNumber: string;
  EWayBillDate: string;
  LRNoVehicleNo: string;
  Transporter: string;
  ReceiverName: string;
  Narration: string;
  ReceivedBy: number;
  IsGRNApprovalRequired: boolean;
}

interface GRNLine {
  lineId: string;
  poTransactionId: number;
  poVoucherNo: string;
  itemId: number;
  itemGroupId: number;
  itemCode: string;
  itemName: string;
  purchaseOrderQty: number;
  pendingQty: number;
  challanQty: number;
  purchaseUnit: string;
  stockUnit: string;
  supplierBatchNo: string;
  batchNo: string;
  itemTagNo: string;
  supplierGrade: string;
  warehouseId: number;
  warehouseName: string;
  bin: string;
  mfgDate: string;
  expiryDate: string;
  purchaseRate: number;
}

// ─── Helpers ─────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function toInputDate(s: string | undefined | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function genBatchNo(poVoucherNo: string, itemId: number, seq: number): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `_${poVoucherNo}_${itemId}_${String(seq).padStart(3, "0")}`;
}

// ─── QR Slip Print ────────────────────────────────────────────
type PrintLine = Pick<GRNLine, "batchNo" | "itemCode" | "itemName" | "supplierBatchNo" | "itemTagNo" | "supplierGrade" | "challanQty" | "stockUnit" | "warehouseName" | "bin">;

// Compact slip — 2 columns × 3 rows fits exactly on A4 (each slip ~96mm × 88mm)
const QR_SLIP_STYLES = `
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,sans-serif;font-size:9px;background:#fff;}
.slip{border:1.5px solid #0f4c5c;border-radius:5px;overflow:hidden;break-inside:avoid;}
.hdr{background:#0f4c5c;color:#fff;padding:3px 8px;text-align:center;font-size:7.5px;font-weight:700;letter-spacing:.3px;}
.batch{background:#dbeafe;border-bottom:1.5px solid #93c5fd;padding:4px 8px;text-align:center;}
.batch .bl{font-size:6.5px;font-weight:700;color:#1e40af;text-transform:uppercase;}
.batch .bv{font-size:10px;font-weight:900;color:#1e3a8a;font-family:monospace;word-break:break-all;line-height:1.2;}
.body{display:flex;align-items:flex-start;}
.qrc{padding:5px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;}
.qrc img{width:72px;height:72px;border:1px solid #cbd5e1;border-radius:3px;display:block;}
.qrc span{font-size:5.5px;color:#94a3b8;text-align:center;line-height:1.2;}
.info{flex:1;padding:4px 6px;min-width:0;}
.row{margin-bottom:2.5px;}
.lbl{font-size:6px;color:#64748b;text-transform:uppercase;font-weight:700;line-height:1;}
.val{font-size:8px;font-weight:700;color:#0f172a;word-break:break-word;line-height:1.2;}
hr{border:none;border-top:1px dashed #e2e8f0;margin:3px 0;}
.ftr{background:#f1f5f9;border-top:1px solid #e2e8f0;padding:3px 8px;display:flex;justify-content:space-between;font-size:6.5px;color:#64748b;}
@media print{body{margin:0;}}`;

function buildSlipHtml(line: PrintLine, qrDataURL: string, grnNo: string, supplier: string): string {
  return `<div class="slip">
    <div class="hdr">Goods Receipt Note — Stock Label</div>
    <div class="batch"><div class="bl">Batch No.</div><div class="bv">${line.batchNo}</div></div>
    <div class="body">
      <div class="qrc"><img src="${qrDataURL}" alt="QR"/><span>Scan: Batch·Item·Batch</span></div>
      <div class="info">
        <div class="row"><div class="lbl">Item</div><div class="val">${line.itemName}</div></div>
        <div class="row"><div class="lbl">Item Code</div><div class="val" style="font-family:monospace">${line.itemCode}</div></div>
        <hr/>
        <div class="row"><div class="lbl">Supplier Batch No.</div><div class="val" style="font-family:monospace">${line.supplierBatchNo || "—"}</div></div>
        <div class="row"><div class="lbl">Tag No.</div><div class="val">${line.itemTagNo || "—"}</div></div>
        <div class="row"><div class="lbl">Grade</div><div class="val">${line.supplierGrade || "—"}</div></div>
        <hr/>
        <div class="row"><div class="lbl">Warehouse / Bin</div><div class="val">${line.warehouseName} / ${line.bin || "—"}</div></div>
        <div class="row"><div class="lbl">Received Qty</div><div class="val">${line.challanQty} ${line.stockUnit}</div></div>
      </div>
    </div>
    <div class="ftr"><span>GRN: <strong>${grnNo}</strong></span><span>${supplier}</span></div>
  </div>`;
}

function openPrintTab(html: string) {
  const printableHtml = html.replace(
    "</head>",
    "<script>window.onload=function(){window.print();}<\/script></head>"
  );
  const blob = new Blob([printableHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank");
  if (!tab) alert("Pop-up blocked. Please allow pop-ups for this site.");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function printQRSlips(lines: PrintLine[], grnNo: string, supplier: string, eachPage: boolean) {
  const slipHtmls = await Promise.all(lines.map(async (line) => {
    const qrDataURL = await QRCode.toDataURL(
      JSON.stringify({ batchNo: line.batchNo, itemCode: line.itemCode, supplierBatchNo: line.supplierBatchNo }),
      { width: 120, margin: 1, color: { dark: "#0f4c5c", light: "#ffffff" } }
    );
    return buildSlipHtml(line, qrDataURL, grnNo, supplier);
  }));

  const GRID_STYLES = `
    @media print{@page{size:A4 portrait;margin:6mm;}body{padding:0;}}
    body{padding:4px;}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;}`;

  if (eachPage) {
    // One slip per page — wrap each in the same 2-col grid so slip width matches "Print All"
    const body = slipHtmls
      .map((s, i) => `<div class="grid" style="page-break-after:${i < slipHtmls.length - 1 ? "always" : "auto"}">${s}</div>`)
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>GRN Labels — ${grnNo}</title>
    <style>${QR_SLIP_STYLES}${GRID_STYLES}</style>
    </head><body>${body}</body></html>`;
    openPrintTab(html);
  } else {
    // Multiple slips — 2 columns × N rows grid
    const body = slipHtmls.join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>GRN Labels — ${grnNo}</title>
    <style>${QR_SLIP_STYLES}${GRID_STYLES}</style>
    </head><body><div class="grid">${body}</div></body></html>`;
    openPrintTab(html);
  }
}

// ─── QR Scanner Modal ────────────────────────────────────────
function QRScannerModal({ onScan, onClose }: { onScan: (v: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manual, setManual] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const scan = useCallback(() => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) { stopCamera(); onScan(code.data); }
  }, [onScan, stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        intervalRef.current = setInterval(scan, 150);
      }
    } catch { setCameraError("Camera access denied. Use manual entry."); setMode("manual"); }
  }, [scan]);

  useEffect(() => { if (mode === "camera") startCamera(); return () => stopCamera(); }, [mode, startCamera, stopCamera]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] overflow-hidden">
        <div className="bg-blue-600 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2"><QrCode size={16} /><span className="font-semibold text-sm">QR / Barcode Scanner</span></div>
          <button onClick={onClose}><X size={18} className="text-blue-200 hover:text-white" /></button>
        </div>
        <div className="flex border-b border-gray-100">
          {(["camera", "manual"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); if (m === "manual") stopCamera(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors ${mode === m ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>
              {m === "camera" ? <><Camera size={14} /> Camera Scan</> : <><Keyboard size={14} /> Manual Entry</>}
            </button>
          ))}
        </div>
        {mode === "camera" && (
          <div className="p-4">
            {cameraError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600 text-center">{cameraError}</div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-blue-400 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br" />
                    {scanning && <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-400 animate-bounce" style={{ animationDuration: "1.5s" }} />}
                  </div>
                </div>
                <div className="absolute bottom-3 inset-x-0 text-center">
                  <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">Point camera at QR / Barcode</span>
                </div>
              </div>
            )}
            <p className="text-center text-xs text-gray-400 mt-3">Scanned value will auto-fill Supplier Batch No.</p>
          </div>
        )}
        {mode === "manual" && (
          <div className="p-5 space-y-4">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-2">Enter / Paste Batch No. or Barcode</label>
            <textarea autoFocus value={manual} onChange={(e) => setManual(e.target.value)}
              rows={3} placeholder="Scan or type supplier batch / barcode value here…"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono" />
            <button onClick={() => { if (manual.trim()) onScan(manual.trim()); }}
              disabled={!manual.trim()}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              Use This Value
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bulk Roll Entry Modal ────────────────────────────────────
interface RollRow { id: string; itemTagNo: string; supplierBatchNo: string; qty: number; grade: string; }

function BulkRollEntryModal({
  poItem, warehouses, supplierGrades, onAdd, onClose,
}: {
  poItem: PendingPOItem;
  warehouses: WH[];
  supplierGrades: string[];
  onAdd: (lines: GRNLine[], warehouseName: string, bins: BinRow[]) => void;
  onClose: () => void;
}) {
  const [warehouseName, setWarehouseName] = useState("");
  const [bins, setBins] = useState<BinRow[]>([]);
  const [bin, setBin]   = useState("");
  const [rate, setRate] = useState(poItem.PurchaseRate || 0);
  const [tagPrefix, setTagPrefix] = useState("TAG-");
  const [tagStartNo, setTagStartNo] = useState("101");
  const [count, setCount] = useState("5");
  const [commonGrade, setCommonGrade] = useState(poItem.GradesOfSupplier || "");
  const [rolls, setRolls] = useState<RollRow[]>([]);
  const [scanningId, setScanningId] = useState<string | null>(null);

  useEffect(() => {
    if (!warehouseName) { setBins([]); setBin(""); return; }
    apiFetch(`${BASE_URL}/api/PurchaseGrnAJ/GetBinsList?warehouseName=${encodeURIComponent(warehouseName)}`)
      .then((d) => { if (Array.isArray(d) && !d[0]?.ErrMsg) { setBins(d); setBin(""); } });
  }, [warehouseName]);

  const generateRows = () => {
    const n = Math.min(parseInt(count) || 0, 500);
    if (n < 1) return;
    const start = parseInt(tagStartNo) || 1;
    setRolls(Array.from({ length: n }, (_, i) => ({
      id: Math.random().toString(36).slice(2),
      itemTagNo: tagPrefix ? `${tagPrefix}${String(start + i).padStart(3, "0")}` : String(start + i),
      supplierBatchNo: "",
      qty: 0,
      grade: commonGrade,
    })));
  };

  const upd = (id: string, field: keyof RollRow, val: string | number) =>
    setRolls((p) => p.map((r) => r.id === id ? { ...r, [field]: val } : r));

  const handleAdd = () => {
    if (!warehouseName || !bin) { alert("Please select Warehouse and Bin."); return; }
    const filled = rolls.filter((r) => r.qty > 0);
    if (!filled.length) { alert("Enter quantity for at least one item."); return; }
    const totalQty = filled.reduce((s, r) => s + r.qty, 0);
    const maxAllowed = poItem.PendingQty + poItem.PurchaseOrderQuantity * (poItem.PurchaseTolerance / 100);
    if (poItem.PendingQty > 0 && totalQty > maxAllowed) {
      alert(`Total qty (${totalQty}) exceeds pending qty + tolerance (${maxAllowed.toFixed(3)} ${poItem.StockUnit}). Reduce quantities.`);
      return;
    }
    const lines: GRNLine[] = filled.map((r, i) => ({
      lineId: Math.random().toString(36).slice(2),
      poTransactionId: poItem.TransactionID,
      poVoucherNo: poItem.PurchaseVoucherNo,
      itemId: poItem.ItemID,
      itemGroupId: poItem.ItemGroupID,
      itemCode: poItem.ItemCode,
      itemName: poItem.ItemName,
      purchaseOrderQty: poItem.PurchaseOrderQuantity,
      pendingQty: poItem.PendingQty,
      challanQty: r.qty,
      purchaseUnit: poItem.PurchaseUnit,
      stockUnit: poItem.StockUnit,
      supplierBatchNo: r.supplierBatchNo,
      batchNo: genBatchNo(poItem.PurchaseVoucherNo, poItem.ItemID, i + 1),
      itemTagNo: r.itemTagNo,
      supplierGrade: r.grade,
      warehouseId: bins.find((b) => b.Bin === bin)?.WarehouseID ?? 0,
      warehouseName,
      bin,
      mfgDate: "",
      expiryDate: "",
      purchaseRate: rate,
    }));
    onAdd(lines, warehouseName, bins);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1200px] max-h-[92vh] flex flex-col overflow-hidden">
          <div className="bg-blue-700 text-white px-7 py-4 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2.5"><Layers size={16} /><span className="font-bold text-sm">Bulk Entry</span></div>
              <p className="text-xs text-blue-200 mt-0.5">
                <span className="font-semibold">{poItem.ItemName}</span>
                <span className="mx-1.5 opacity-50">·</span>
                <span className="font-mono">{poItem.PurchaseVoucherNo}</span>
                <span className="mx-1.5 opacity-50">·</span>
                <span>PO: <strong>{poItem.PurchaseOrderQuantity}</strong></span>
                {(poItem.ReceiptQuantity || 0) > 0 && (
                  <><span className="mx-1.5 opacity-50">·</span><span className="text-green-300">Received: <strong>{poItem.ReceiptQuantity}</strong></span></>
                )}
                <span className="mx-1.5 opacity-50">·</span>
                <span className="text-yellow-300">Pending: <strong>{poItem.PendingQty} {poItem.StockUnit}</strong></span>
              </p>
            </div>
            <button onClick={onClose}><X size={18} className="text-blue-200 hover:text-white" /></button>
          </div>

          {/* Common settings */}
          <div className="px-7 py-4 bg-blue-50 border-b border-blue-100 shrink-0">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3">Common — same for all items</p>
            {/* Row 1: warehouse / bin / rate / grade */}
            <div className="grid grid-cols-4 gap-4 items-end mb-3">
              <div>
                <label className={labelCls}>Warehouse *</label>
                <select value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {warehouses.map((w) => <option key={w.Warehouse}>{w.Warehouse}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Bin *</label>
                <select value={bin} onChange={(e) => setBin(e.target.value)} className={inputCls} disabled={!bins.length}>
                  <option value="">Select…</option>
                  {bins.map((b) => <option key={b.Bin}>{b.Bin}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Rate (₹/{poItem.PurchaseUnit})</label>
                <input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} className={inputCls} min={0} step={0.01} />
              </div>
              <div>
                <label className={labelCls}>Grade of Supplier</label>
                <select value={commonGrade}
                  onChange={(e) => { setCommonGrade(e.target.value); setRolls((p) => p.map((r) => ({ ...r, grade: e.target.value }))); }}
                  className={inputCls}>
                  <option value="">— Select —</option>
                  {supplierGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            {/* Row 2: tag prefix / start no / count / generate */}
            <div className="flex items-end gap-4">
              <div className="flex-none">
                <label className={labelCls}>Tag Prefix</label>
                <input value={tagPrefix} onChange={(e) => setTagPrefix(e.target.value)} placeholder="TAG-"
                  className={inputCls} style={{ width: "8rem" }} />
              </div>
              <div className="flex-none">
                <label className={labelCls}>Start No.</label>
                <input value={tagStartNo} onChange={(e) => setTagStartNo(e.target.value)} placeholder="101"
                  className={inputCls} style={{ width: "7rem" }} />
              </div>
              <div className="flex-none">
                <label className={labelCls}>No. of Items</label>
                <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generateRows()}
                  className={inputCls} style={{ width: "7rem" }} />
              </div>
              <div className="flex-none pb-0">
                <button onClick={generateRows}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                  Generate Rows
                </button>
              </div>
            </div>
          </div>

          {/* Rows table */}
          <div className="flex-1 overflow-y-auto overflow-x-auto">
            {rolls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <Layers size={36} className="text-gray-300" />
                <p className="text-sm">Enter count and click <strong className="text-gray-600">Generate</strong></p>
              </div>
            ) : (
              <table className="w-full text-xs border-collapse" style={{ minWidth: 780 }}>
                <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 w-10">#</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 w-44">Tag No.</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 w-36">Grade of Supplier</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Supplier Batch No. / Barcode</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-500 w-36">Qty ({poItem.StockUnit})</th>
                    <th className="px-4 py-2.5 text-center w-14">Scan</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rolls.map((r, i) => (
                    <tr key={r.id} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                      <td className="px-4 py-2 text-gray-400 font-mono text-[10px]">{i + 1}</td>
                      <td className="px-4 py-2">
                        <input value={r.itemTagNo} onChange={(e) => upd(r.id, "itemTagNo", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                      </td>
                      <td className="px-4 py-2">
                        <select value={r.grade} onChange={(e) => upd(r.id, "grade", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                          <option value="">— Select —</option>
                          {supplierGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input value={r.supplierBatchNo} onChange={(e) => upd(r.id, "supplierBatchNo", e.target.value)}
                          placeholder="Scan QR or type…"
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" min={0} step={0.001} value={r.qty || ""}
                          onChange={(e) => upd(r.id, "qty", Number(e.target.value))}
                          placeholder="0.000"
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-right font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => setScanningId(r.id)}
                          className="p-1.5 text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100">
                          <Scan size={12} />
                        </button>
                      </td>
                      <td className="pr-4 py-2">
                        <button onClick={() => setRolls((p) => p.filter((x) => x.id !== r.id))}
                          className="text-gray-300 hover:text-red-500 transition-colors"><X size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {rolls.length > 0 && (
            <div className="px-7 py-3.5 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
              <div className="text-xs text-gray-500">
                <span className="font-bold text-blue-700">{rolls.filter((r) => r.qty > 0).length}</span>/{rolls.length} filled ·
                Total: <span className="font-bold text-blue-800">
                  {rolls.reduce((s, r) => s + r.qty, 0).toFixed(3)} {poItem.StockUnit}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleAdd}
                  disabled={rolls.filter((r) => r.qty > 0).length === 0 || !warehouseName || !bin}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  <CheckCircle2 size={15} />
                  Add {rolls.filter((r) => r.qty > 0).length} Item{rolls.filter((r) => r.qty > 0).length !== 1 ? "s" : ""} to GRN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {scanningId && (
        <QRScannerModal
          onScan={(val) => { upd(scanningId, "supplierBatchNo", val); setScanningId(null); }}
          onClose={() => setScanningId(null)}
        />
      )}
    </>
  );
}

// ─── Password Modal ───────────────────────────────────────────
function PwModal({
  title, onConfirm, onClose, busy,
}: { title: string; onConfirm: (pw: string, remark: string) => void; onClose: () => void; busy: boolean }) {
  const [pw, setPw] = useState("");
  const [rm, setRm] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-96 overflow-hidden">
        <div className="bg-red-600 text-white px-5 py-3.5 flex items-center justify-between">
          <span className="font-semibold text-sm">{title}</span>
          <button onClick={onClose}><X size={18} className="text-red-200 hover:text-white" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Your Password</label>
            <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)}
              className={inputCls} placeholder="Enter password…" />
          </div>
          <div>
            <label className={labelCls}>Remark (optional)</label>
            <input value={rm} onChange={(e) => setRm(e.target.value)} className={inputCls} placeholder="Reason…" />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={() => onConfirm(pw, rm)} disabled={!pw || busy}
              className="px-5 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {busy ? "Processing…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
type TabId = "basic" | "po" | "receiving" | "documents";

export default function PurchaseGRNPage() {
  // ── Master data ─────────────────────────────────────────────
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<WH[]>([]);
  const [receivers, setReceivers]   = useState<Receiver[]>([]);

  // ── GRN list ────────────────────────────────────────────────
  const [grnList, setGrnList]       = useState<GRNListRow[]>([]);
  const [fromDate, setFromDate]     = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(todayISO);
  const [listLoading, setListLoading] = useState(false);

  // ── Pending POs ─────────────────────────────────────────────
  const [pendingItems, setPendingItems] = useState<PendingPOItem[]>([]);
  const [poLoading, setPoLoading]       = useState(false);

  // ── Bins per selection ──────────────────────────────────────
  const [binsMap, setBinsMap] = useState<Record<string, BinRow[]>>({});

  // ── View ────────────────────────────────────────────────────
  const [view, setView]         = useState<"list" | "form">("list");
  const [editTxnId, setEditTxnId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("basic");

  // ── Form state ──────────────────────────────────────────────
  const [grnNo, setGrnNo]           = useState("");
  const [grnDate, setGrnDate]       = useState(todayISO);
  const [supplierId, setSupplierId] = useState<number>(0);
  const [receivedById, setReceivedById] = useState<number>(0);
  const [invoiceNo, setInvoiceNo]   = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [eWayBillNo, setEWayBillNo] = useState("");
  const [eWayBillDate, setEWayBillDate] = useState("");
  const [gateEntryNo, setGateEntryNo] = useState("");
  const [gateEntryDate, setGateEntryDate] = useState("");
  const [lrVehicleNo, setLrVehicleNo] = useState("");
  const [transporter, setTransporter] = useState("");
  const [remark, setRemark]         = useState("");
  const [lines, setLines]           = useState<GRNLine[]>([]);

  // ── Bins for lines ──────────────────────────────────────────
  const [lineBins, setLineBins] = useState<Record<string, BinRow[]>>({});

  // ── Supplier grades (dynamic from LedgerMaster) ─────────────
  const [supplierGrades, setSupplierGrades] = useState<string[]>([]);

  useEffect(() => {
    if (!supplierId) { setSupplierGrades([]); return; }
    apiFetch(`${BASE_URL}/api/FieldMasterAJ/GetSupplierGrades?ledgerID=${supplierId}`)
      .then(data => setSupplierGrades(Array.isArray(data) ? data : []))
      .catch(() => setSupplierGrades([]));
  }, [supplierId]);

  // ── Modals ──────────────────────────────────────────────────
  const [scanningLineId, setScanningLineId] = useState<string | null>(null);
  const [bulkTarget, setBulkTarget] = useState<PendingPOItem | null>(null);
  const [pwModal, setPwModal]       = useState<"update" | "delete" | null>(null);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);

  // ── QR print from list ──────────────────────────────────────
  const [qrMenuGrnId, setQrMenuGrnId] = useState<number | null>(null);
  const [qrPrinting, setQrPrinting]   = useState<number | null>(null);

  const supplierName = useMemo(
    () => suppliers.find((s) => s.LedgerID === supplierId)?.LedgerName ?? "",
    [suppliers, supplierId]
  );

  // ── Grouped pending POs ─────────────────────────────────────
  const groupedPOs = useMemo(() => {
    const map = new Map<number, { txnId: number; voucherNo: string; date: string; items: PendingPOItem[] }>();
    pendingItems.forEach((item) => {
      if (!map.has(item.TransactionID)) {
        map.set(item.TransactionID, {
          txnId: item.TransactionID,
          voucherNo: item.PurchaseVoucherNo,
          date: item.PurchaseVoucherDate,
          items: [],
        });
      }
      const group = map.get(item.TransactionID)!;
      if (!group.items.some((i) => i.ItemID === item.ItemID)) {
        group.items.push(item);
      }
    });
    return Array.from(map.values());
  }, [pendingItems]);

  // ── Fetch master data once ──────────────────────────────────
  useEffect(() => {
    apiFetch(`${BASE_URL}/api/PurchaseGrnAJ/GetPurchaseSuppliersList`)
      .then((d) => Array.isArray(d) && !d[0]?.ErrMsg && setSuppliers(d));
    apiFetch(`${BASE_URL}/api/PurchaseGrnAJ/GetWarehouseList`)
      .then((d) => Array.isArray(d) && !d[0]?.ErrMsg && setWarehouses(d));
    apiFetch(`${BASE_URL}/api/PurchaseGrnAJ/GetReceiverList`)
      .then((d) => Array.isArray(d) && !d[0]?.ErrMsg && setReceivers(d));
  }, []);

  // ── Fetch GRN list ──────────────────────────────────────────
  const fetchGrnList = useCallback(async () => {
    setListLoading(true);
    try {
      const d = await apiFetch(`${BASE_URL}/api/PurchaseGrnAJ/GetReceiptNoteList?fromDateValue=${fromDate}&toDateValue=${toDate}`);
      if (Array.isArray(d) && !d[0]?.ErrMsg) setGrnList(d);
      else setGrnList([]);
    } finally { setListLoading(false); }
  }, [fromDate, toDate]);

  useEffect(() => { fetchGrnList(); }, [fetchGrnList]);

  // Close QR dropdown on outside click (bubble phase so button onClick fires first)
  useEffect(() => {
    if (!qrMenuGrnId) return;
    const handler = () => setQrMenuGrnId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [qrMenuGrnId]);

  // ── Fetch pending POs when supplier changes ─────────────────
  useEffect(() => {
    if (!supplierId) { setPendingItems([]); return; }
    setPoLoading(true);
    apiFetch(`${BASE_URL}/api/PurchaseGrnAJ/GetPendingOrdersList?ledgerId=${supplierId}`)
      .then((d) => { if (Array.isArray(d) && !d[0]?.ErrMsg) setPendingItems(d); else setPendingItems([]); })
      .finally(() => setPoLoading(false));
  }, [supplierId]);

  // ── Fetch bins for a warehouse ──────────────────────────────
  const fetchBins = useCallback(async (whName: string): Promise<BinRow[]> => {
    if (!whName) return [];
    if (binsMap[whName]) return binsMap[whName];
    const d = await apiFetch(`${BASE_URL}/api/PurchaseGrnAJ/GetBinsList?warehouseName=${encodeURIComponent(whName)}`);
    const bins = Array.isArray(d) && !d[0]?.ErrMsg ? d : [];
    setBinsMap((prev) => ({ ...prev, [whName]: bins }));
    return bins;
  }, [binsMap]);

  // ── Fetch GRN No ────────────────────────────────────────────
  const fetchGrnNo = useCallback(async () => {
    const res = await apiFetch(`${BASE_URL}/api/PurchaseGrnAJ/GetReceiptNo?prefix=GRN`);
    setGrnNo(typeof res === "string" ? unwrap(res) : "");
  }, []);

  // ── Open new form ───────────────────────────────────────────
  const openNew = useCallback(async () => {
    setEditTxnId(null);
    setGrnDate(todayISO()); setSupplierId(0); setReceivedById(0);
    setInvoiceNo(""); setInvoiceDate(""); setEWayBillNo(""); setEWayBillDate("");
    setGateEntryNo(""); setGateEntryDate(""); setLrVehicleNo("");
    setTransporter(""); setRemark(""); setLines([]); setLineBins({});
    await fetchGrnNo();
    setActiveTab("basic");
    setView("form");
  }, [fetchGrnNo]);

  // ── Open edit form ──────────────────────────────────────────
  const openEdit = useCallback(async (row: GRNListRow) => {
    setEditTxnId(row.TransactionID);
    setGrnDate(toInputDate(row.ReceiptVoucherDate) || todayISO());
    setSupplierId(row.LedgerID);
    setReceivedById(row.ReceivedBy ?? 0);
    setInvoiceNo(row.DeliveryNoteNo ?? "");
    setInvoiceDate(toInputDate(row.DeliveryNoteDate));
    setEWayBillNo(row.EWayBillNumber ?? "");
    setEWayBillDate(toInputDate(row.EWayBillDate));
    setGateEntryNo(row.GateEntryNo ?? "");
    setGateEntryDate(toInputDate(row.GateEntryDate));
    setLrVehicleNo(row.LRNoVehicleNo ?? "");
    setTransporter(row.Transporter ?? "");
    setRemark(row.Narration ?? "");
    setGrnNo(row.ReceiptVoucherNo ?? "");

    // Load batch detail lines
    const detail = await apiFetch(`${BASE_URL}/api/PurchaseGrnAJ/GetReceiptVoucherBatchDetail?transactionId=${row.TransactionID}`);
    if (Array.isArray(detail) && !detail[0]?.ErrMsg) {
      // Deduplicate by TransID — SQL JOIN fan-out can return the same GRN row multiple times
      // if the source PO has the same ItemID on multiple detail rows.
      const seenTransIds = new Set<number>();
      const uniqueDetail = detail.filter((d: any) => {
        const tid = Number(d.TransID);
        if (seenTransIds.has(tid)) return false;
        seenTransIds.add(tid);
        return true;
      });
      const loaded: GRNLine[] = uniqueDetail.map((d: any, i: number) => ({
        lineId: `edit-${i}`,
        poTransactionId: Number(d.PurchaseTransactionID) || 0,
        poVoucherNo: d.PurchaseVoucherNo ?? "",
        itemId: Number(d.ItemID) || 0,
        itemGroupId: Number(d.ItemGroupID) || 0,
        itemCode: d.ItemCode ?? "",
        itemName: d.ItemName ?? "",
        purchaseOrderQty: Number(d.PurchaseOrderQuantity) || 0,
        pendingQty: 0,
        challanQty: Number(d.ChallanQuantity) || 0,
        purchaseUnit: d.PurchaseUnit ?? "",
        stockUnit: d.StockUnit ?? "",
        supplierBatchNo: d.SupplierBatchNo ?? "",
        batchNo: d.BatchNo ?? "",
        itemTagNo: d.ItemTagNo ?? "",
        supplierGrade: d.GradesOfSupplier ?? "",
        warehouseId: Number(d.WarehouseID) || 0,
        warehouseName: d.Warehouse ?? "",
        bin: d.Bin ?? "",
        mfgDate: d.MfgDate ?? "",
        expiryDate: d.ExpiryDate ?? "",
        purchaseRate: Number(d.PurchaseRate) || 0,
      }));
      setLines(loaded);

      // Pre-load bins for each warehouse used
      const uniqueWH = [...new Set(loaded.map((l) => l.warehouseName).filter(Boolean))];
      const newBinsMap: Record<string, BinRow[]> = {};
      await Promise.all(uniqueWH.map(async (wh) => {
        const bins = await fetchBins(wh);
        newBinsMap[wh] = bins;
      }));
      setLineBins(newBinsMap);
    } else {
      setLines([]);
    }

    setActiveTab("basic");
    setView("form");
  }, [fetchBins]);

  // ── Line helpers ────────────────────────────────────────────
  const addSingleLine = useCallback((item: PendingPOItem) => {
    const seq = lines.filter((l) => l.itemId === item.ItemID && l.poTransactionId === item.TransactionID).length + 1;
    setLines((prev) => [...prev, {
      lineId: Math.random().toString(36).slice(2),
      poTransactionId: item.TransactionID,
      poVoucherNo: item.PurchaseVoucherNo,
      itemId: item.ItemID,
      itemGroupId: item.ItemGroupID,
      itemCode: item.ItemCode,
      itemName: item.ItemName,
      purchaseOrderQty: item.PurchaseOrderQuantity,
      pendingQty: item.PendingQty,
      challanQty: 0,
      purchaseUnit: item.PurchaseUnit,
      stockUnit: item.StockUnit,
      supplierBatchNo: "",
      batchNo: genBatchNo(item.PurchaseVoucherNo, item.ItemID, seq),
      itemTagNo: "",
      supplierGrade: item.GradesOfSupplier ?? "",
      warehouseId: 0,
      warehouseName: "",
      bin: "",
      mfgDate: "",
      expiryDate: "",
      purchaseRate: item.PurchaseRate || 0,
    }]);
    setActiveTab("receiving");
  }, [lines]);

  const addBulkLines = useCallback((newLines: GRNLine[], wh: string, whBins: BinRow[]) => {
    setLines((prev) => [...prev, ...newLines]);
    if (wh && whBins.length) {
      setLineBins((prev) => ({ ...prev, [wh]: whBins }));
    }
    setBulkTarget(null);
    setActiveTab("receiving");
  }, []);

  const updateLine = useCallback((lineId: string, field: keyof GRNLine, val: any) =>
    setLines((prev) => prev.map((l) => l.lineId === lineId ? { ...l, [field]: val } : l)), []);

  const updateLineWarehouse = useCallback(async (lineId: string, whName: string) => {
    const bins = await fetchBins(whName);
    setLineBins((prev) => ({ ...prev, [whName]: bins }));
    const warehouseId = bins[0]?.WarehouseID ?? 0;
    setLines((prev) => prev.map((l) => l.lineId === lineId ? { ...l, warehouseName: whName, warehouseId, bin: "" } : l));
  }, [fetchBins]);

  const updateLineBin = useCallback((lineId: string, bin: string, whName: string) => {
    const warehouseId = (lineBins[whName] ?? []).find((b) => b.Bin === bin)?.WarehouseID ?? 0;
    setLines((prev) => prev.map((l) => l.lineId === lineId ? { ...l, bin, warehouseId } : l));
  }, [lineBins]);

  const removeLine = useCallback((lineId: string) => setLines((prev) => prev.filter((l) => l.lineId !== lineId)), []);

  // ── QR print handler (list view) ───────────────────────────
  const handleQRPrint = useCallback(async (row: GRNListRow, mode: "each" | "all") => {
    setQrMenuGrnId(null);
    setQrPrinting(row.TransactionID);
    try {
      const detail = await apiFetch(`${BASE_URL}/api/PurchaseGrnAJ/GetReceiptVoucherBatchDetail?transactionId=${row.TransactionID}`);
      if (!Array.isArray(detail) || detail[0]?.ErrMsg) { alert("Could not load GRN detail."); return; }
      const seenTransIds = new Set<number>();
      const printLines: PrintLine[] = detail
        .filter((d: any) => {
          const tid = Number(d.TransID);
          if (seenTransIds.has(tid)) return false;
          seenTransIds.add(tid);
          return true;
        })
        .map((d: any) => ({
          batchNo: d.BatchNo ?? "",
          itemCode: d.ItemCode ?? "",
          itemName: d.ItemName ?? "",
          supplierBatchNo: d.SupplierBatchNo ?? "",
          itemTagNo: d.ItemTagNo ?? "",
          supplierGrade: d.GradesOfSupplier ?? "",
          challanQty: Number(d.ChallanQuantity) || 0,
          stockUnit: d.StockUnit ?? "",
          warehouseName: d.Warehouse ?? "",
          bin: d.Bin ?? "",
        }));
      if (!printLines.length) { alert("No batch lines found for this GRN."); return; }
      await printQRSlips(printLines, row.ReceiptVoucherNo, row.LedgerName, mode === "each");
    } catch (e: any) { alert("Print error: " + e.message); }
    finally { setQrPrinting(null); }
  }, []);

  // ── Build payload ───────────────────────────────────────────
  const buildPayload = useCallback((prefix = "GRN") => {
    const Main = {
      VoucherID: -14,
      VoucherDate: grnDate,
      LedgerID: supplierId,
      TotalQuantity: lines.reduce((s, l) => s + l.challanQty, 0).toString(),
      Particular: "Receipt Note",
      ProductionUnitID: 0,
      ReceivedBy: receivedById || 0,
      DeliveryNoteNo: invoiceNo,
      DeliveryNoteDate: invoiceDate || null,
      EWayBillNumber: eWayBillNo,
      EWayBillDate: eWayBillDate || null,
      GateEntryNo: gateEntryNo,
      GateEntryDate: gateEntryDate || null,
      LRNoVehicleNo: lrVehicleNo,
      Transporter: transporter,
      Narration: remark,
    };
    const Detail = lines.map((l, i) => ({
      TransID: i + 1,
      ItemID: l.itemId,
      ItemGroupID: l.itemGroupId,
      ChallanQuantity: l.challanQty.toString(),
      ChallanWeight: l.challanQty.toString(),
      BatchNo: l.batchNo,
      StockUnit: l.stockUnit,
      ProductionUnitID: 0,
      SupplierBatchNo: l.supplierBatchNo || "-",
      MFGdate: l.mfgDate || null,
      ExpiryDate: l.expiryDate || null,
      ReceiptWtPerPacking: "0",
      WarehouseID: l.warehouseId,
      PurchaseTransactionID: l.poTransactionId,
      GradesOfSupplier: l.supplierGrade,
      ItemTagNo: l.itemTagNo,
      PurchaseRate: l.purchaseRate,
    }));
    const PO = lines.reduce<{ PurchaseTransactionID: number; ItemID: number }[]>((acc, l) => {
      if (!acc.find((x) => x.PurchaseTransactionID === l.poTransactionId && x.ItemID === l.itemId))
        acc.push({ PurchaseTransactionID: l.poTransactionId, ItemID: l.itemId });
      return acc;
    }, []);
    return { prefix, voucherid: -14, Main, Detail, PO };
  }, [grnDate, supplierId, receivedById, invoiceNo, invoiceDate, eWayBillNo, eWayBillDate, gateEntryNo, gateEntryDate, lrVehicleNo, transporter, remark, lines]);

  // ── Save ────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (!supplierId) { alert("Please select a supplier."); setActiveTab("basic"); return; }
    if (!lines.length) { alert("Add at least one receiving line."); setActiveTab("po"); return; }
    if (lines.some((l) => !l.challanQty)) { alert("All lines must have a quantity."); setActiveTab("receiving"); return; }
    if (lines.some((l) => !l.warehouseId)) { alert("All lines must have a Warehouse and Bin."); setActiveTab("receiving"); return; }

    // Validate total qty per item against pending qty + tolerance (create mode only)
    if (!editTxnId) {
      const qtyByItem = new Map<string, { total: number; line: GRNLine }>();
      lines.forEach((l) => {
        const key = `${l.poTransactionId}-${l.itemId}`;
        const cur = qtyByItem.get(key);
        qtyByItem.set(key, { total: (cur?.total ?? 0) + l.challanQty, line: l });
      });
      for (const { total, line } of qtyByItem.values()) {
        if (line.pendingQty <= 0) continue; // edit-loaded lines skip validation
        const poItem = pendingItems.find((p) => p.TransactionID === line.poTransactionId && p.ItemID === line.itemId);
        if (!poItem) continue;
        const maxAllowed = poItem.PendingQty + poItem.PurchaseOrderQuantity * (poItem.PurchaseTolerance / 100);
        if (total > maxAllowed) {
          alert(`${line.itemName}: Total qty (${total}) exceeds pending qty + tolerance (${maxAllowed.toFixed(3)} ${line.stockUnit}). Please reduce.`);
          setActiveTab("receiving");
          return;
        }
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/PurchaseGrnAJ/SaveReceiptData`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const text = unwrap(await res.text());
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { }
      const result = parsed?.result ?? text;
      if (result === "Success") {
        alert(`GRN saved successfully! GRN No: ${parsed?.voucherNo ?? grnNo}`);
        await fetchGrnList();
        setView("list");
      } else {
        alert(text);
      }
    } catch (e: any) { alert("Save error: " + e.message); }
    finally { setSaving(false); }
  }, [supplierId, lines, buildPayload, fetchGrnList, grnNo]);

  // ── Update ──────────────────────────────────────────────────
  const doUpdate = useCallback(async (password: string, remarkPw: string) => {
    const session = getSession();
    if (!session) { alert("Session expired."); return; }
    setSaving(true);
    try {
      const payload = {
        TransactionID: String(editTxnId),
        ValidateUser: { userName: session.userName, password, transactionRemark: remarkPw },
        ...buildPayload(),
      };
      const res = await fetch(`${BASE_URL}/api/PurchaseGrnAJ/UpdateReceiptData`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = unwrap(await res.text());
      if (text === "Success") {
        alert("GRN updated successfully.");
        await fetchGrnList();
        setView("list");
      } else if (text === "InvalidUser") {
        alert("Invalid password.");
      } else if (text === "Exist") {
        alert("This GRN cannot be updated — it is used in a further process.");
      } else {
        alert(text);
      }
    } catch (e: any) { alert("Update error: " + e.message); }
    finally { setSaving(false); setPwModal(null); }
  }, [editTxnId, buildPayload, fetchGrnList]);

  // ── Delete ──────────────────────────────────────────────────
  const doDelete = useCallback(async (password: string, remarkPw: string) => {
    const session = getSession();
    if (!session) { alert("Session expired."); return; }
    setDeleting(true);
    const PO = lines.reduce<{ PurchaseTransactionID: number; ItemID: number }[]>((acc, l) => {
      if (!acc.find((x) => x.PurchaseTransactionID === l.poTransactionId && x.ItemID === l.itemId))
        acc.push({ PurchaseTransactionID: l.poTransactionId, ItemID: l.itemId });
      return acc;
    }, []);
    try {
      const res = await fetch(`${BASE_URL}/api/PurchaseGrnAJ/DeletePGRN`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          TransactionID: String(editTxnId),
          ObjvalidateLoginUser: { userName: session.userName, password, transactionRemark: remarkPw },
          PurchaseTransactionID: lines[0]?.poTransactionId?.toString() ?? "0",
          jsonObjectsPO: PO,
        }),
      });
      const text = unwrap(await res.text());
      if (text === "Success") {
        alert("GRN deleted successfully.");
        await fetchGrnList();
        setView("list");
      } else if (text === "InvalidUser") {
        alert("Invalid password.");
      } else {
        alert(text);
      }
    } catch (e: any) { alert("Delete error: " + e.message); }
    finally { setDeleting(false); setPwModal(null); }
  }, [editTxnId, lines, fetchGrnList]);

  // ══════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════
  if (view === "list") {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Purchase GRN</h2>
            <p className="text-sm text-gray-500">Goods Receipt Note · {grnList.length} records</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={16} /> New GRN
          </button>
        </div>

        {/* Date filter */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex items-center gap-4">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Date Range</span>
          <div className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
          </div>
          <button onClick={fetchGrnList} disabled={listLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <RefreshCw size={12} className={listLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["GRN No.", "Date", "Supplier", "PO Ref.", "Invoice No.", "Transporter", "Actions"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${i >= 6 ? "text-center" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
              ) : grnList.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-400">No GRN records found</td></tr>
              ) : grnList.map((g) => (
                <tr key={g.TransactionID}
                  className="border-t border-gray-100 hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{g.ReceiptVoucherNo}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(g.ReceiptVoucherDate)}</td>
                  <td className="px-4 py-3 text-gray-800 text-xs font-medium">{g.LedgerName}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">{g.PurchaseVoucherNo}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">{g.DeliveryNoteNo || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{g.Transporter || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-center">
                      <button onClick={() => openEdit(g)}
                        className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors">
                        Edit
                      </button>
                      {/* QR Print dropdown */}
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setQrMenuGrnId(qrMenuGrnId === g.TransactionID ? null : g.TransactionID); }}
                          disabled={qrPrinting === g.TransactionID}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors disabled:opacity-50">
                          {qrPrinting === g.TransactionID
                            ? <><RefreshCw size={11} className="animate-spin" /> Printing…</>
                            : <><QrCode size={11} /> QR <ChevronDown size={10} /></>}
                        </button>
                        {qrMenuGrnId === g.TransactionID && (
                          <div className="absolute right-0 top-full mt-1 z-[999] bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-52">
                            <button
                              onClick={() => handleQRPrint(g, "each")}
                              className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                              <Printer size={12} />
                              Print Each QR (Individual)
                            </button>
                            <button
                              onClick={() => handleQRPrint(g, "all")}
                              className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                              <QrCode size={12} />
                              Print All QR (Single Page)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // FORM VIEW
  // ══════════════════════════════════════════════════════════════
  const totalQty = lines.reduce((s, l) => s + l.challanQty, 0);

  return (
    <div className="max-w-5xl mx-auto pb-10">
      {/* Header ribbon */}
      <div className="flex items-center justify-between mb-5 bg-white px-5 py-3.5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={15} /> List
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h2 className="text-base font-bold text-gray-800">Purchase GRN</h2>
              <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-bold text-blue-700 font-mono">
                {grnNo || "…"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editTxnId ? (
            <>
              <button onClick={() => setPwModal("delete")} disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={14} /> Delete
              </button>
              <button onClick={() => setPwModal("update")} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                <CheckCircle2 size={15} /> {saving ? "Saving…" : "Update GRN"}
              </button>
            </>
          ) : (
            <button onClick={doSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60">
              <CheckCircle2 size={15} /> {saving ? "Saving…" : "Save GRN"}
            </button>
          )}
        </div>
      </div>

      {/* Tab card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tab header */}
        <div className="flex border-b border-gray-200 bg-gray-50/40">
          {([
            { id: "basic", label: "GRN Details", desc: supplierId ? supplierName : "Date & Supplier" },
            { id: "po", label: "Purchase Orders", desc: poLoading ? "Loading…" : groupedPOs.length > 0 ? `${pendingItems.length} pending items` : "Select Items" },
            { id: "receiving", label: "Receiving Lines", desc: lines.length > 0 ? `${lines.length} line${lines.length !== 1 ? "s" : ""} · ${totalQty.toFixed(3)} qty` : "Qty & Storage" },
            { id: "documents", label: "Documents", desc: "Invoice & Transport" },
          ] as { id: TabId; label: string; desc: string }[]).map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3.5 text-left transition-colors border-b-2 ${activeTab === tab.id ? "border-blue-600 bg-white" : "border-transparent hover:bg-gray-50"}`}>
              <p className={`text-xs font-bold ${activeTab === tab.id ? "text-blue-700" : "text-gray-500"}`}>{tab.label}</p>
              <p className={`text-[10px] mt-0.5 ${activeTab === tab.id ? "text-blue-500" : "text-gray-400"}`}>{tab.desc}</p>
            </button>
          ))}
        </div>

        {/* ── TAB 1: BASIC ───────────────────────────────────── */}
        {activeTab === "basic" && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-3 gap-5">
              <div>
                <label className={labelCls}>GRN No.</label>
                <input readOnly value={grnNo || "…"}
                  className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-blue-50 text-blue-700 font-mono font-semibold focus:outline-none w-full" />
              </div>
              <div>
                <label className={labelCls}>GRN Date *</label>
                <input type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Supplier *</label>
                <select value={supplierId} onChange={(e) => { setSupplierId(Number(e.target.value)); setLines([]); }}
                  className={inputCls} disabled={!!editTxnId}>
                  <option value={0}>Select supplier…</option>
                  {suppliers.map((s) => <option key={s.LedgerID} value={s.LedgerID}>{s.LedgerName}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div>
                <label className={labelCls}>Received By</label>
                <select value={receivedById} onChange={(e) => setReceivedById(Number(e.target.value))} className={inputCls}>
                  <option value={0}>Select…</option>
                  {receivers.map((r) => <option key={r.LedgerID} value={r.LedgerID}>{r.LedgerName}</option>)}
                </select>
              </div>
            </div>
            {supplierId > 0 && (
              <div className="flex justify-end">
                <button onClick={() => setActiveTab("po")}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  View Purchase Orders <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: PURCHASE ORDERS ─────────────────────────── */}
        {activeTab === "po" && (
          <div className="p-6 space-y-5">
            {!supplierId ? (
              <div className="text-center py-16">
                <Package size={36} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">Select a supplier on the <strong>GRN Details</strong> tab first</p>
                <button onClick={() => setActiveTab("basic")}
                  className="mt-3 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                  ← Go to GRN Details
                </button>
              </div>
            ) : poLoading ? (
              <div className="text-center py-16 text-gray-400">Loading pending orders…</div>
            ) : groupedPOs.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center text-sm text-green-700">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-green-400" />
                All POs for <strong>{supplierName}</strong> are fully received.
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Pending Purchase Orders — {supplierName}
                </p>
                <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                  {groupedPOs.map((po) => (
                    <div key={po.txnId}>
                      <div className="px-4 py-2 bg-gray-50 flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-blue-700">{po.voucherNo}</span>
                        <span className="text-xs text-gray-400">{fmtDate(po.date)}</span>
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded">ID: {po.txnId}</span>
                      </div>
                      {po.items.map((item, idx) => {
                        const inThisGrn = lines
                          .filter((l) => l.itemId === item.ItemID && l.poTransactionId === item.TransactionID)
                          .reduce((s, l) => s + l.challanQty, 0);
                        const pendingAfterThis = Math.max(0, item.PendingQty - inThisGrn);
                        const isComplete = item.PendingQty <= 0;
                        const isPartial = !isComplete && (item.ReceiptQuantity || 0) > 0;
                        return (
                          <div key={`${item.TransactionID}-${item.ItemID}-${idx}`}
                            className={`px-4 py-3 flex items-center gap-4 border-t border-gray-50 transition-colors ${isComplete ? "bg-green-50/40" : "hover:bg-blue-50/30"}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-blue-600">{item.ItemCode}</span>
                                <span className={`text-sm font-medium ${isComplete ? "text-gray-400" : "text-gray-800"}`}>{item.ItemName}</span>
                                {isComplete && (
                                  <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded">Complete</span>
                                )}
                                {isPartial && (
                                  <span className="text-[10px] bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded">Partial</span>
                                )}
                              </div>
                              <div className="flex items-center gap-5 mt-1 text-[11px] text-gray-500 flex-wrap">
                                <span>PO Qty: <strong className="text-gray-700">{item.PurchaseOrderQuantity} {item.StockUnit}</strong></span>
                                {(item.ReceiptQuantity || 0) > 0 && (
                                  <span>Received: <strong className="text-green-600">{item.ReceiptQuantity} {item.StockUnit}</strong></span>
                                )}
                                {!isComplete && (
                                  <span>Pending: <strong className="text-orange-600">{item.PendingQty} {item.StockUnit}</strong></span>
                                )}
                                {inThisGrn > 0 && (
                                  <span>In this GRN: <strong className="text-blue-600">{inThisGrn}</strong>
                                    {pendingAfterThis > 0 && <span className="text-gray-400"> · Still pending: {pendingAfterThis.toFixed(3)}</span>}
                                  </span>
                                )}
                                {item.PurchaseTolerance > 0 && (
                                  <span className="text-gray-400">Tolerance: {item.PurchaseTolerance}%</span>
                                )}
                                {item.GradesOfSupplier && (
                                  <span>Grade: <strong className="text-purple-700">{item.GradesOfSupplier}</strong></span>
                                )}
                              </div>
                            </div>
                            {!isComplete && (
                              <div className="flex gap-2 shrink-0">
                                <button onClick={() => addSingleLine(item)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                                  <Plus size={12} /> Single Entry
                                </button>
                                <button onClick={() => setBulkTarget(item)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                                  <Layers size={12} /> Bulk Entry
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {lines.length > 0 && (
                  <div className="flex justify-end">
                    <button onClick={() => setActiveTab("receiving")}
                      className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                      View Receiving Lines ({lines.length}) <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB 3: RECEIVING LINES ─────────────────────────── */}
        {activeTab === "receiving" && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Receiving Lines</p>
                {lines.length > 0 && (
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{lines.length}</span>
                )}
              </div>
              <button onClick={() => setActiveTab("po")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                + Add More Items
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-xl text-center py-14">
                <Package size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-400">No items added yet</p>
                <button onClick={() => setActiveTab("po")}
                  className="mt-3 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                  ← Go to Purchase Orders
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-xs border-collapse" style={{ minWidth: 1100 }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-8">#</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-24">PO Ref</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Item</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-28">Tag No.</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-24">Grade</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase" style={{ minWidth: 180 }}>Supplier Batch No.</th>
                      <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase w-28">Qty</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-36">Warehouse</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-28">Bin</th>
                      <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase w-24">Rate</th>
                      <th className="px-2 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const whBins = lineBins[line.warehouseName] ?? [];
                      const incomplete = !line.challanQty || !line.warehouseId || !line.bin;
                      return (
                        <tr key={line.lineId}
                          className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} ${incomplete ? "border-l-2 border-l-orange-300" : "border-l-2 border-l-transparent"}`}>
                          <td className="px-2 py-1.5 text-gray-400 text-[10px] font-mono">{idx + 1}</td>
                          <td className="px-2 py-1.5 font-mono text-blue-600 text-[10px] whitespace-nowrap truncate">{line.poVoucherNo}</td>
                          <td className="px-2 py-1.5">
                            <div className="font-mono text-blue-700 font-semibold text-[10px]">{line.itemCode}</div>
                            <div className="text-gray-500 text-[10px] truncate max-w-[150px]">{line.itemName}</div>
                            <div className="text-gray-400 text-[9px] font-mono">{line.batchNo}</div>
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={line.itemTagNo} onChange={(e) => updateLine(line.lineId, "itemTagNo", e.target.value)}
                              placeholder="Tag…"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={line.supplierGrade} onChange={(e) => updateLine(line.lineId, "supplierGrade", e.target.value)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                              <option value="">—</option>
                              {supplierGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex gap-1">
                              <input value={line.supplierBatchNo} onChange={(e) => updateLine(line.lineId, "supplierBatchNo", e.target.value)}
                                placeholder="Scan or type…"
                                className="flex-1 border border-gray-200 rounded px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0 bg-white" />
                              <button onClick={() => setScanningLineId(line.lineId)}
                                className="p-1.5 text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 shrink-0">
                                <Scan size={10} />
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            {(() => {
                              const isOver = line.pendingQty > 0 && line.challanQty > line.pendingQty;
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <input type="number" min={0} step={0.001} value={line.challanQty || ""}
                                    onChange={(e) => updateLine(line.lineId, "challanQty", Number(e.target.value))}
                                    placeholder="0.000"
                                    className={`w-full border rounded px-2 py-1 text-xs text-right font-semibold focus:outline-none focus:ring-1 bg-white ${isOver ? "border-red-400 focus:ring-red-400 text-red-600" : "border-gray-200 focus:ring-blue-500"}`} />
                                  <span className="text-[9px] text-right" style={{ color: isOver ? "#ef4444" : "#9ca3af" }}>
                                    {line.stockUnit}{line.pendingQty > 0 ? ` · max ${line.pendingQty}` : ""}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={line.warehouseName}
                              onChange={(e) => updateLineWarehouse(line.lineId, e.target.value)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                              <option value="">Select…</option>
                              {warehouses.map((w) => <option key={w.Warehouse}>{w.Warehouse}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={line.bin}
                              onChange={(e) => updateLineBin(line.lineId, e.target.value, line.warehouseName)}
                              disabled={!whBins.length}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                              <option value="">Select…</option>
                              {whBins.map((b) => <option key={b.Bin}>{b.Bin}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min={0} step={0.01} value={line.purchaseRate || ""}
                              onChange={(e) => updateLine(line.lineId, "purchaseRate", Number(e.target.value))}
                              placeholder="0.00"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-[10px] text-right focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => removeLine(line.lineId)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={13} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50 border-t-2 border-blue-200">
                      <td colSpan={6} className="px-3 py-2 text-right text-xs font-bold text-blue-700">
                        {lines.length} line{lines.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-bold text-blue-900">{totalQty.toFixed(3)}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {lines.length > 0 && (
              <div className="flex justify-end">
                <button onClick={() => setActiveTab("documents")}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  Go to Documents <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: DOCUMENTS ───────────────────────────────── */}
        {activeTab === "documents" && (
          <div className="p-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5 flex items-center gap-2">
              <FileText size={13} className="text-gray-400" /> Invoice &amp; Transport Details
              <span className="text-[10px] font-normal text-gray-400 normal-case ml-1">(optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-5">
              {[
                { label: "Invoice No. (Delivery Note No.)", value: invoiceNo, set: setInvoiceNo, type: "text", ph: "INV/DN-..." },
                { label: "Invoice Date", value: invoiceDate, set: setInvoiceDate, type: "date", ph: "" },
                { label: "E-Way Bill No.", value: eWayBillNo, set: setEWayBillNo, type: "text", ph: "EWB..." },
                { label: "E-Way Bill Date", value: eWayBillDate, set: setEWayBillDate, type: "date", ph: "" },
                { label: "Gate Entry No.", value: gateEntryNo, set: setGateEntryNo, type: "text", ph: "GE-..." },
                { label: "Gate Entry Date", value: gateEntryDate, set: setGateEntryDate, type: "date", ph: "" },
                { label: "LR No. / Vehicle No.", value: lrVehicleNo, set: setLrVehicleNo, type: "text", ph: "MH-XX-AB-1234" },
                { label: "Transporter", value: transporter, set: setTransporter, type: "text", ph: "Logistics name" },
                { label: "Narration / Remark", value: remark, set: setRemark, type: "text", ph: "Optional notes" },
              ].map((f) => (
                <div key={f.label}>
                  <label className={labelCls}>{f.label}</label>
                  <input type={f.type} value={f.value} onChange={(e) => f.set(e.target.value)}
                    placeholder={f.ph} className={inputCls} />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              {editTxnId ? (
                <button onClick={() => setPwModal("update")} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
                  <CheckCircle2 size={16} /> {saving ? "Saving…" : "Update GRN"}
                </button>
              ) : (
                <button onClick={doSave} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
                  <CheckCircle2 size={16} /> {saving ? "Saving…" : "Save GRN"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────── */}
      {scanningLineId && (
        <QRScannerModal
          onScan={(val) => { updateLine(scanningLineId, "supplierBatchNo", val); setScanningLineId(null); }}
          onClose={() => setScanningLineId(null)}
        />
      )}
      {bulkTarget && (
        <BulkRollEntryModal
          poItem={bulkTarget}
          warehouses={warehouses}
          supplierGrades={supplierGrades}
          onAdd={addBulkLines}
          onClose={() => setBulkTarget(null)}
        />
      )}
      {pwModal === "update" && (
        <PwModal
          title="Confirm Update"
          onConfirm={(pw, rm) => doUpdate(pw, rm)}
          onClose={() => setPwModal(null)}
          busy={saving}
        />
      )}
      {pwModal === "delete" && (
        <PwModal
          title="Confirm Deletion"
          onConfirm={(pw, rm) => doDelete(pw, rm)}
          onClose={() => setPwModal(null)}
          busy={deleting}
        />
      )}
    </div>
  );
}
