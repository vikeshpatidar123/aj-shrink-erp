"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Plus, X, Scan, Printer, CheckCircle2,
  Camera, Keyboard, Trash2, QrCode,
  Layers, Package, ArrowLeft, FileText, ChevronRight
} from "lucide-react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {
  purchaseOrders, PurchaseOrder, POLine,
  grnRecords as initData, GRN, GRNLine,
  SUPPLIERS, WAREHOUSES,
} from "@/data/dummyData";
import { inputCls, labelCls } from "@/lib/styles";

// ─── Constants ───────────────────────────────────────────────
const COMPANY = "AJ Shrink Wrap Pvt Ltd";
const COMPANY_STATE = "Maharashtra";

const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtAmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const nextGRNNo = (list: GRN[]) => {
  const yr = new Date().getFullYear();
  return `GRN${String(list.length + 1).padStart(5, "0")}_${String(yr - 2000).padStart(2, "0")}_${String(yr - 1999).padStart(2, "0")}`;
};

const genBatchNo = (itemCode: string, date: string, seq: number) =>
  `BATCH-${itemCode}-${date.replace(/-/g, "")}-${String(seq).padStart(3, "0")}`;

const STATUS_STYLE: Record<GRN["status"], string> = {
  Draft: "bg-gray-100 text-gray-600",
  Completed: "bg-green-100 text-green-700",
  Verified: "bg-blue-100 text-blue-700",
};

// ─── QR Slip Print ──────────────────────────────────────────
async function printQRSlip(line: GRNLine, grn: GRN) {
  const qrData = JSON.stringify({
    batchNo: line.batchNo, supplierBatchNo: line.supplierBatchNo,
    itemCode: line.itemCode, itemName: line.itemName,
    grnNo: grn.grnNo, qty: line.receivedQty, unit: line.stockUnit,
    supplier: grn.supplier, warehouseId: line.warehouseId, bin: line.bin,
  });
  const qrDataURL = await QRCode.toDataURL(qrData, { width: 200, margin: 1, color: { dark: "#0f4c5c", light: "#ffffff" } });
  const slipHTML = `<!DOCTYPE html><html><head><title>GRN QR Slip</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; font-size:11px; color:#111; background:#fff; }
    .slip { width:340px; border:2px solid #0f4c5c; border-radius:6px; overflow:hidden; }
    .header { background:#0f4c5c; color:white; padding:8px 12px; text-align:center; }
    .header h2 { font-size:13px; font-weight:bold; letter-spacing:0.5px; }
    .header p { font-size:9px; opacity:0.8; margin-top:2px; }
    .body { display:flex; padding:10px; gap:10px; }
    .qr img { width:110px; height:110px; border:1px solid #ddd; border-radius:4px; }
    .details { flex:1; }
    .row { display:flex; flex-direction:column; margin-bottom:5px; }
    .label { font-size:8px; color:#666; text-transform:uppercase; letter-spacing:0.4px; font-weight:600; }
    .value { font-size:10px; font-weight:bold; color:#0f4c5c; word-break:break-all; }
    .batch-box { background:#f0f9ff; border:1px solid #bae6fd; border-radius:4px; padding:6px; margin-bottom:6px; }
    .batch-box .label { color:#0369a1; }
    .batch-box .value { font-size:11px; color:#0369a1; font-family:monospace; }
    .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:5px 12px; font-size:9px; color:#64748b; display:flex; justify-content:space-between; }
  </style></head><body>
  <div class="slip">
    <div class="header"><h2>${COMPANY}</h2><p>Goods Receipt Note — Stock Label</p></div>
    <div class="body">
      <div class="qr"><img src="${qrDataURL}" alt="QR"/></div>
      <div class="details">
        <div class="batch-box"><div class="label">Internal Batch No.</div><div class="value">${line.batchNo}</div></div>
        <div class="row"><div class="label">Supplier Batch No.</div><div class="value">${line.supplierBatchNo || "—"}</div></div>
        <div class="row"><div class="label">Item Code</div><div class="value">${line.itemCode}</div></div>
        <div class="row"><div class="label">Item Name</div><div class="value" style="font-size:9px;color:#111;">${line.itemName}</div></div>
        <div style="display:flex;gap:8px;">
          <div class="row" style="flex:1;"><div class="label">Received Qty</div><div class="value">${line.receivedQty} ${line.stockUnit}</div></div>
          <div class="row" style="flex:1;"><div class="label">Warehouse</div><div class="value">${line.warehouseName}</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <div class="row" style="flex:1;"><div class="label">Bin</div><div class="value">${line.bin}</div></div>
          <div class="row" style="flex:1;"><div class="label">GRN No.</div><div class="value" style="font-size:9px;">${grn.grnNo}</div></div>
        </div>
      </div>
    </div>
    <div class="footer">
      <span>Date: ${fmtDate(grn.grnDate)}</span>
      <span>Supplier: ${grn.supplier}</span>
      <span>HSN: ${line.hsnCode}</span>
    </div>
  </div>
  </body></html>`;
  const win = window.open("", "_blank", "width=420,height=450");
  if (!win) return;
  win.document.write(slipHTML);
  win.document.close();
  win.onload = () => { win.print(); };
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
    } catch { setCameraError("Camera access denied or not available. Use manual entry."); setMode("manual"); }
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
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-2">Enter / Paste Batch No. or Barcode</label>
              <textarea autoFocus value={manual} onChange={(e) => setManual(e.target.value)}
                rows={3} placeholder="Scan or type supplier batch / barcode value here…"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono" />
            </div>
            <button onClick={() => { if (manual.trim()) onScan(manual.trim()); }}
              disabled={!manual.trim()}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Use This Value
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bulk Roll Entry Modal ────────────────────────────────────
interface RollRow { id: string; supplierBatchNo: string; qty: number; }

function BulkRollEntryModal({
  po, poLine, grnDate, sameState, existingLineCount, onAdd, onClose,
}: {
  po: PurchaseOrder; poLine: POLine; grnDate: string; sameState: boolean;
  existingLineCount: number; onAdd: (lines: GRNLine[]) => void; onClose: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState("");
  const [bin, setBin] = useState("");
  const [rate, setRate] = useState(poLine.rate);
  const [rollCountInput, setRollCountInput] = useState("10");
  const [rolls, setRolls] = useState<RollRow[]>([]);
  const [scanningRollId, setScanningRollId] = useState<string | null>(null);

  const wh = WAREHOUSES.find((w) => w.id === warehouseId);
  const bins = wh?.bins ?? [];
  const filledRolls = rolls.filter((r) => r.qty > 0);

  const generateRows = () => {
    const count = Math.min(parseInt(rollCountInput) || 0, 500);
    if (count < 1) return;
    setRolls(Array.from({ length: count }, () => ({
      id: Math.random().toString(36).slice(2), supplierBatchNo: "", qty: 0,
    })));
  };

  const updateRoll = (id: string, field: keyof RollRow, value: string | number) =>
    setRolls((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const handleAdd = () => {
    if (!warehouseId || !bin) { alert("Please select Warehouse and Bin."); return; }
    if (filledRolls.length === 0) { alert("Enter quantity for at least one roll."); return; }
    const newLines: GRNLine[] = filledRolls.map((roll, i) => {
      const seq = existingLineCount + i + 1;
      const basic = roll.qty * rate;
      const cgst = sameState ? (basic * poLine.gstPct) / 2 / 100 : 0;
      const sgst = sameState ? (basic * poLine.gstPct) / 2 / 100 : 0;
      const igst = !sameState ? (basic * poLine.gstPct) / 100 : 0;
      return {
        lineId: Math.random().toString(36).slice(2),
        poRef: po.poNo, itemCode: poLine.itemCode, itemGroup: poLine.itemGroup,
        subGroup: poLine.subGroup, itemName: poLine.itemName,
        orderedQty: poLine.poQtyInPU, receivedQty: roll.qty,
        stockUnit: poLine.stockUnit, purchaseUnit: poLine.purchaseUnit,
        rate, hsnCode: poLine.hsnCode, gstPct: poLine.gstPct,
        batchNo: genBatchNo(poLine.itemCode, grnDate, seq),
        supplierBatchNo: roll.supplierBatchNo, expiryDate: "",
        warehouseId, warehouseName: wh?.name ?? "", bin,
        basicAmt: basic, cgstAmt: cgst, sgstAmt: sgst, igstAmt: igst,
        totalAmt: basic + cgst + sgst + igst,
      };
    });
    onAdd(newLines);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-[720px] max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2.5"><Layers size={16} /><span className="font-bold text-sm">Bulk Roll Entry</span></div>
              <p className="text-xs text-blue-200 mt-0.5">
                <span className="font-semibold">{poLine.itemName}</span>
                <span className="mx-1.5 opacity-50">·</span>
                <span className="font-mono">{po.poNo}</span>
              </p>
            </div>
            <button onClick={onClose}><X size={18} className="text-blue-200 hover:text-white" /></button>
          </div>

          {/* Common settings */}
          <div className="px-6 py-3.5 bg-blue-50 border-b border-blue-100 shrink-0">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2.5">
              Common — same for all rolls
            </p>
            <div className="grid grid-cols-4 gap-3 items-end">
              <div>
                <label className={labelCls}>Warehouse *</label>
                <select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setBin(""); }} className={inputCls}>
                  <option value="">Select…</option>
                  {WAREHOUSES.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Bin *</label>
                <select value={bin} onChange={(e) => setBin(e.target.value)} className={inputCls} disabled={!warehouseId || bins.length === 0}>
                  <option value="">Select…</option>
                  {bins.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Rate (₹/{poLine.purchaseUnit})</label>
                <input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} className={inputCls} min={0} step={0.01} />
              </div>
              <div>
                <label className={labelCls}>No. of Rolls</label>
                <div className="flex gap-1.5">
                  <input type="number" min={1} max={500} value={rollCountInput}
                    onChange={(e) => setRollCountInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && generateRows()}
                    className={`${inputCls} w-20`} placeholder="10" />
                  <button onClick={generateRows}
                    className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                    Generate
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Rolls table */}
          <div className="flex-1 overflow-y-auto">
            {rolls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <Layers size={36} className="text-gray-300" />
                <p className="text-sm">Enter number of rolls and click <strong className="text-gray-600">Generate</strong></p>
                <p className="text-xs text-gray-400">All rolls share the same Warehouse, Bin and Rate set above</p>
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 w-10">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Supplier Batch No. / Barcode</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-500 w-36">Qty ({poLine.stockUnit})</th>
                    <th className="px-3 py-2.5 text-center w-14">Scan</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rolls.map((roll, i) => (
                    <tr key={roll.id} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="px-3 py-1.5 text-gray-400 text-[10px] font-mono">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        <input value={roll.supplierBatchNo}
                          onChange={(e) => updateRoll(roll.id, "supplierBatchNo", e.target.value)}
                          placeholder="Scan QR or type batch no…"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" min={0} step={0.001} value={roll.qty || ""}
                          onChange={(e) => updateRoll(roll.id, "qty", Number(e.target.value))}
                          placeholder="0.000"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-right font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button onClick={() => setScanningRollId(roll.id)}
                          className="p-1.5 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors" title="Scan">
                          <Scan size={12} />
                        </button>
                      </td>
                      <td className="pr-3 py-1.5">
                        <button onClick={() => setRolls((p) => p.filter((r) => r.id !== roll.id))}
                          className="text-gray-300 hover:text-red-500 transition-colors"><X size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {rolls.length > 0 && (
            <div className="px-6 py-3.5 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
              <div className="text-xs text-gray-500">
                <span className="font-bold text-blue-700">{filledRolls.length}</span>
                <span className="text-gray-400">/{rolls.length}</span> rolls filled ·
                Total: <span className="font-bold text-blue-800">
                  {rolls.reduce((s, r) => s + r.qty, 0).toLocaleString("en-IN", { maximumFractionDigits: 3 })} {poLine.stockUnit}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleAdd}
                  disabled={filledRolls.length === 0 || !warehouseId || !bin}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <CheckCircle2 size={15} />
                  Add {filledRolls.length} Roll{filledRolls.length !== 1 ? "s" : ""} to GRN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {scanningRollId && (
        <QRScannerModal
          onScan={(val) => { updateRoll(scanningRollId, "supplierBatchNo", val); setScanningRollId(null); }}
          onClose={() => setScanningRollId(null)}
        />
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────
type Tab = "basic" | "po" | "receiving" | "documents";

export default function PurchaseGRNPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<GRN[]>(initData);
  const [editing, setEditing] = useState<GRN | null>(null);
  const [filterStatus, setFilterStatus] = useState<"All" | "Completed" | "Verified">("All");
  const [activeTab, setActiveTab] = useState<Tab>("basic");

  // Form state
  const [grnDate, setGrnDate] = useState(todayISO());
  const [supplier, setSupplier] = useState("");
  const [lines, setLines] = useState<GRNLine[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [eWayBillNo, setEWayBillNo] = useState("");
  const [eWayBillDate, setEWayBillDate] = useState("");
  const [gateEntryNo, setGateEntryNo] = useState("");
  const [gateEntryDate, setGateEntryDate] = useState("");
  const [lrVehicleNo, setLrVehicleNo] = useState("");
  const [transporter, setTransporter] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [remark, setRemark] = useState("");

  // Modal state
  const [scanningLineId, setScanningLineId] = useState<string | null>(null);
  const [bulkTarget, setBulkTarget] = useState<{ po: PurchaseOrder; poLine: POLine } | null>(null);

  // Derived
  const supplierInfo = SUPPLIERS.find((s) => s.name === supplier);
  const sameState = supplierInfo?.state === COMPANY_STATE;

  const supplierPOs = useMemo(
    () => purchaseOrders.filter((po) => po.supplier === supplier && (po.status === "Approved" || po.status === "Sent")),
    [supplier]
  );

  // Qty already received in saved (non-editing) GRNs
  const receivedFromSavedGRNs = useMemo(() => {
    const map: Record<string, number> = {};
    data.filter((g) => g.status !== "Draft" && (!editing || g.id !== editing.id)).forEach((g) => {
      g.lines.forEach((l) => {
        const key = `${l.poRef}|${l.itemCode}`;
        map[key] = (map[key] ?? 0) + l.receivedQty;
      });
    });
    return map;
  }, [data, editing]);

  // Pending = PO qty − saved received − already in current form lines
  const getPendingQty = (poNo: string, itemCode: string, poQty: number) => {
    const saved = receivedFromSavedGRNs[`${poNo}|${itemCode}`] ?? 0;
    const inForm = lines.filter((l) => l.poRef === poNo && l.itemCode === itemCode).reduce((s, l) => s + l.receivedQty, 0);
    return Math.max(0, poQty - saved - inForm);
  };

  // POs with at least one pending line
  const pendingPOs = useMemo(() =>
    supplierPOs.map((po) => ({
      ...po,
      lines: po.lines.filter((l) => {
        const saved = receivedFromSavedGRNs[`${po.poNo}|${l.itemCode}`] ?? 0;
        return l.poQtyInPU - saved > 0;
      }),
    })).filter((po) => po.lines.length > 0),
    [supplierPOs, receivedFromSavedGRNs]
  );

  // ── Form helpers ──────────────────────────────────────────
  const openNew = () => {
    setEditing(null);
    setGrnDate(todayISO()); setSupplier(""); setLines([]);
    setInvoiceNo(""); setInvoiceDate(""); setEWayBillNo(""); setEWayBillDate("");
    setGateEntryNo(""); setGateEntryDate(""); setLrVehicleNo("");
    setTransporter(""); setReceivedBy(""); setRemark("");
    setActiveTab("basic");
    setView("form");
  };

  const openEdit = (grn: GRN) => {
    setEditing(grn);
    setGrnDate(grn.grnDate); setSupplier(grn.supplier);
    setLines(grn.lines.map((l) => ({ ...l })));
    setInvoiceNo(grn.invoiceNo); setInvoiceDate(grn.invoiceDate);
    setEWayBillNo(grn.eWayBillNo); setEWayBillDate(grn.eWayBillDate);
    setGateEntryNo(grn.gateEntryNo); setGateEntryDate(grn.gateEntryDate);
    setLrVehicleNo(grn.lrVehicleNo); setTransporter(grn.transporter);
    setReceivedBy(grn.receivedBy); setRemark(grn.remark);
    setActiveTab("basic");
    setView("form");
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this GRN?")) setData((d) => d.filter((r) => r.id !== id));
  };

  const addSingleLine = (po: PurchaseOrder, poLine: POLine) => {
    const seq = lines.filter((l) => l.itemCode === poLine.itemCode).length + 1;
    setLines((prev) => [...prev, {
      lineId: Math.random().toString(36).slice(2),
      poRef: po.poNo, itemCode: poLine.itemCode, itemGroup: poLine.itemGroup,
      subGroup: poLine.subGroup, itemName: poLine.itemName,
      orderedQty: poLine.poQtyInPU, receivedQty: 0,
      stockUnit: poLine.stockUnit, purchaseUnit: poLine.purchaseUnit,
      rate: poLine.rate, hsnCode: poLine.hsnCode, gstPct: poLine.gstPct,
      batchNo: genBatchNo(poLine.itemCode, grnDate, seq),
      supplierBatchNo: "", expiryDate: "",
      warehouseId: "", warehouseName: "", bin: "",
      basicAmt: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, totalAmt: 0,
    }]);
  };

  const addBulkLines = (newLines: GRNLine[]) => {
    setLines((prev) => [...prev, ...newLines]);
    setBulkTarget(null);
  };

  const updateLine = (lineId: string, updates: Partial<GRNLine>) => {
    setLines((prev) => prev.map((l) => {
      if (l.lineId !== lineId) return l;
      const updated = { ...l, ...updates };
      if ("receivedQty" in updates || "rate" in updates) {
        const basic = updated.receivedQty * updated.rate;
        const cgst = sameState ? (basic * updated.gstPct) / 2 / 100 : 0;
        const sgst = sameState ? (basic * updated.gstPct) / 2 / 100 : 0;
        const igst = !sameState ? (basic * updated.gstPct) / 100 : 0;
        return { ...updated, basicAmt: basic, cgstAmt: cgst, sgstAmt: sgst, igstAmt: igst, totalAmt: basic + cgst + sgst + igst };
      }
      return updated;
    }));
  };

  const updateLineWarehouse = (lineId: string, warehouseId: string) => {
    const wh = WAREHOUSES.find((w) => w.id === warehouseId);
    updateLine(lineId, { warehouseId, warehouseName: wh?.name ?? "", bin: "" });
  };

  const removeLine = (lineId: string) => setLines((prev) => prev.filter((l) => l.lineId !== lineId));

  const save = () => {
    if (!supplier) { alert("Select a supplier."); setActiveTab("basic"); return; }
    if (lines.length === 0) { alert("Add at least one item line."); setActiveTab("receiving"); return; }
    const grn: GRN = {
      id: editing ? editing.id : `GRN${String(data.length + 1).padStart(3, "0")}`,
      grnNo: editing ? editing.grnNo : nextGRNNo(data),
      grnDate, supplier, supplierState: supplierInfo?.state ?? "",
      lines, invoiceNo, invoiceDate, eWayBillNo, eWayBillDate,
      gateEntryNo, gateEntryDate, lrVehicleNo, transporter, receivedBy, remark,
      status: "Completed",
    };
    if (editing) { setData((d) => d.map((r) => r.id === editing.id ? grn : r)); }
    else { setData((d) => [...d, grn]); }
    setView("list");
  };

  const currentGRNNo = editing ? editing.grnNo : nextGRNNo(data);
  const totalBasic = lines.reduce((s, l) => s + l.basicAmt, 0);
  const totalTax = lines.reduce((s, l) => s + l.cgstAmt + l.sgstAmt + l.igstAmt, 0);
  const totalAmt = lines.reduce((s, l) => s + l.totalAmt, 0);

  const filteredData = useMemo(() => {
    const nonDraft = data.filter((g) => g.status !== "Draft");
    return filterStatus === "All" ? nonDraft : nonDraft.filter((g) => g.status === filterStatus);
  }, [data, filterStatus]);

  // ══════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════
  if (view === "list") {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Purchase GRN</h2>
            <p className="text-sm text-gray-500">Goods Receipt Note · {filteredData.length} records</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={16} /> New GRN
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
            {(["All", "Completed", "Verified"] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["GRN No.", "Date", "Supplier", "Invoice No.", "Batches", "Total (₹)", "Status", "Actions"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${i >= 4 && i <= 5 ? "text-right" : i === 4 || i >= 6 ? "text-center" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-gray-400">No GRN records found</td></tr>
              ) : filteredData.map((grn) => {
                const gTotal = grn.lines.reduce((s, l) => s + l.totalAmt, 0);
                return (
                  <tr key={grn.id} className="border-t border-gray-100 hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{grn.grnNo}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(grn.grnDate)}</td>
                    <td className="px-4 py-3 text-gray-800 text-xs font-medium">{grn.supplier}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs font-mono">{grn.invoiceNo || "—"}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700 text-xs">{grn.lines.length}</td>
                    <td className="px-4 py-3 text-right text-blue-700 text-xs font-bold">₹{fmtAmt(gTotal)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[grn.status]}`}>{grn.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-center">
                        <button onClick={() => openEdit(grn)}
                          className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors">
                          Edit
                        </button>
                        <div className="relative group">
                          <button className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                            <Printer size={11} /> QR ▾
                          </button>
                          <div className="absolute right-0 top-7 z-20 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg w-56 py-1">
                            {grn.lines.map((l) => (
                              <button key={l.lineId} onClick={() => printQRSlip(l, grn)}
                                className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 flex items-center gap-2 transition-colors">
                                <QrCode size={11} />
                                <span className="truncate">{l.itemCode} · {l.batchNo.slice(-10)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => handleDelete(grn.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // FORM VIEW — TABS
  // ══════════════════════════════════════════════════════════
  return (
    <div className="max-w-5xl mx-auto pb-10">

      {/* ── Header Ribbon ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 bg-white px-5 py-3.5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={15} /> List
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{COMPANY}</p>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h2 className="text-base font-bold text-gray-800">Purchase GRN</h2>
              <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-bold text-blue-700 font-mono">
                {currentGRNNo}
              </span>
              {editing && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[editing.status]}`}>
                  {editing.status}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing && (
            <button onClick={() => { handleDelete(editing.id); setView("list"); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button onClick={save}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <CheckCircle2 size={15} /> Save GRN
          </button>
        </div>
      </div>

      {/* ── Tab Card ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Tab Header */}
        <div className="flex border-b border-gray-200 bg-gray-50/40">
          {([
            { id: "basic", label: "GRN Details", desc: supplier ? supplier : "Date & Supplier" },
            { id: "po", label: "Purchase Orders", desc: pendingPOs.length > 0 ? `${pendingPOs.reduce((s, p) => s + p.lines.length, 0)} pending item${pendingPOs.reduce((s, p) => s + p.lines.length, 0) !== 1 ? "s" : ""}` : supplier ? "Select Items" : "Select Items" },
            { id: "receiving", label: "Receiving Lines", desc: lines.length > 0 ? `${lines.length} line${lines.length !== 1 ? "s" : ""} added` : "Qty & Storage" },
            { id: "documents", label: "Documents", desc: "Invoice & Transport" },
          ] as { id: Tab; label: string; desc: string }[]).map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3.5 text-left transition-colors border-b-2 ${activeTab === tab.id ? "border-blue-600 bg-white" : "border-transparent hover:bg-gray-50"}`}>
              <p className={`text-xs font-bold ${activeTab === tab.id ? "text-blue-700" : "text-gray-500"}`}>{tab.label}</p>
              <p className={`text-[10px] mt-0.5 ${activeTab === tab.id ? "text-blue-500" : "text-gray-400"}`}>{tab.desc}</p>
            </button>
          ))}
        </div>

        {/* ── TAB 1: BASIC ─────────────────────────────────── */}
        {activeTab === "basic" && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-5">
              <div>
                <label className={labelCls}>GRN No.</label>
                <input readOnly value={currentGRNNo}
                  className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-blue-50 text-blue-700 font-mono font-semibold focus:outline-none w-full" />
              </div>
              <div>
                <label className={labelCls}>GRN Date</label>
                <input type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Supplier <span className="text-red-500">*</span></label>
                <select value={supplier}
                  onChange={(e) => { setSupplier(e.target.value); setLines([]); }}
                  className={inputCls}>
                  <option value="">Select supplier…</option>
                  {SUPPLIERS.map((s) => <option key={s.name} value={s.name}>{s.name} — {s.state}</option>)}
                </select>
              </div>
            </div>

            {/* Supplier info badge (subtle) */}
            {supplier && supplierInfo && (
              <div className="flex items-center gap-3 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                <span className="font-semibold text-gray-700">{supplierInfo.name}</span>
                <span className="text-gray-300">|</span>
                <span>{supplierInfo.state}</span>
                <span className="text-gray-300">|</span>
                <span>GST: <span className="font-mono">{supplierInfo.gst}</span></span>
                <span className="text-gray-300">|</span>
                <span className={`font-semibold ${sameState ? "text-green-600" : "text-orange-600"}`}>
                  {sameState ? "CGST + SGST" : "IGST (Inter-State)"}
                </span>
              </div>
            )}

            {/* CTA to next tab */}
            {supplier && (
              <div className="flex justify-end">
                <button onClick={() => setActiveTab("po")}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  View Purchase Orders <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: PURCHASE ORDERS ───────────────────────── */}
        {activeTab === "po" && (
          <div className="p-6 space-y-5">
            {!supplier ? (
              <div className="text-center py-16">
                <Package size={36} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500 font-medium">Please select a supplier on the <strong>GRN Details</strong> tab first</p>
                <button onClick={() => setActiveTab("basic")}
                  className="mt-3 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  ← Go to GRN Details
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Pending Purchase Orders — {supplier}
                </p>

                {pendingPOs.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center text-sm text-green-700">
                    <CheckCircle2 size={24} className="mx-auto mb-2 text-green-400" />
                    All purchase orders for <strong>{supplier}</strong> are fully received.
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {pendingPOs.map((po) => (
                      <div key={po.id}>
                        <div className="px-4 py-2 bg-gray-50 flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-blue-700">{po.poNo}</span>
                          <span className="text-xs text-gray-400">{fmtDate(po.poDate)}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${po.status === "Approved" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                            {po.status}
                          </span>
                        </div>
                        {po.lines.map((poLine) => {
                          const saved = receivedFromSavedGRNs[`${po.poNo}|${poLine.itemCode}`] ?? 0;
                          const pending = getPendingQty(po.poNo, poLine.itemCode, poLine.poQtyInPU);
                          return (
                            <div key={poLine.lineId}
                              className="px-4 py-3 flex items-center gap-4 hover:bg-blue-50/30 transition-colors border-t border-gray-50">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-bold text-blue-600">{poLine.itemCode}</span>
                                  <span className="text-sm font-medium text-gray-800">{poLine.itemName}</span>
                                </div>
                                <div className="flex items-center gap-5 mt-1 text-[11px] text-gray-500 flex-wrap">
                                  <span>PO Qty: <strong className="text-gray-700">{poLine.poQtyInPU.toLocaleString()} {poLine.stockUnit}</strong></span>
                                  {saved > 0 && <span>Already Received: <strong className="text-green-600">{saved.toLocaleString()}</strong></span>}
                                  <span>Pending: <strong className="text-orange-600">{pending.toLocaleString()} {poLine.stockUnit}</strong></span>
                                  <span>Rate: <strong className="text-gray-700">₹{fmtAmt(poLine.rate)}/{poLine.purchaseUnit}</strong></span>
                                  <span className="text-gray-400">HSN: {poLine.hsnCode} · GST {poLine.gstPct}%</span>
                                </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button
                                  onClick={() => { addSingleLine(po, poLine); setActiveTab("receiving"); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                                  <Plus size={12} /> Add Single
                                </button>
                                <button onClick={() => setBulkTarget({ po, poLine })}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                                  <Layers size={12} /> Bulk Roll Entry
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

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

        {/* ── TAB 3: RECEIVING LINES ───────────────────────── */}
        {activeTab === "receiving" && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Receiving Lines</p>
                {lines.length > 0 && (
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{lines.length}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {lines.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Basic ₹{fmtAmt(totalBasic)} · Tax ₹{fmtAmt(totalTax)} ·{" "}
                    <span className="font-bold text-blue-700">Total ₹{fmtAmt(totalAmt)}</span>
                  </p>
                )}
                <button onClick={() => setActiveTab("po")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  + Add More Items
                </button>
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-xl text-center py-14">
                <Package size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-400">No items added yet</p>
                <button onClick={() => setActiveTab("po")}
                  className="mt-3 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  ← Go to Purchase Orders
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-xs border-collapse" style={{ minWidth: 960 }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-8">#</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-28">PO Ref</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Item</th>
                      <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase w-24">PO Qty</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase" style={{ minWidth: 210 }}>Supplier Batch No.</th>
                      <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase w-28">Received Qty</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-40">Warehouse</th>
                      <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase w-28">Bin</th>
                      <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase w-24">Amount</th>
                      <th className="px-2 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const wh = WAREHOUSES.find((w) => w.id === line.warehouseId);
                      const bins = wh?.bins ?? [];
                      const incomplete = !line.receivedQty || !line.warehouseId || !line.bin;
                      return (
                        <tr key={line.lineId}
                          className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} ${incomplete ? "border-l-2 border-l-orange-300" : "border-l-2 border-l-transparent"}`}>
                          <td className="px-2 py-1.5 text-gray-400 text-[10px] font-mono">{idx + 1}</td>
                          <td className="px-2 py-1.5 font-mono text-blue-600 text-[10px] whitespace-nowrap">{line.poRef}</td>
                          <td className="px-2 py-1.5">
                            <div className="font-mono text-blue-700 font-semibold text-[10px]">{line.itemCode}</div>
                            <div className="text-gray-500 text-[10px] truncate max-w-[160px]">{line.itemName}</div>
                          </td>
                          <td className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">{line.orderedQty.toLocaleString()} {line.stockUnit}</td>
                          <td className="px-2 py-1.5">
                            <div className="flex gap-1.5">
                              <input value={line.supplierBatchNo}
                                onChange={(e) => updateLine(line.lineId, { supplierBatchNo: e.target.value })}
                                placeholder="Scan or type…"
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0 bg-white" />
                              <button onClick={() => setScanningLineId(line.lineId)}
                                className="p-1.5 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shrink-0" title="Scan QR">
                                <Scan size={11} />
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min={0} step={0.001} value={line.receivedQty || ""}
                              onChange={(e) => updateLine(line.lineId, { receivedQty: Number(e.target.value) })}
                              placeholder="0"
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-right font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={line.warehouseId} onChange={(e) => updateLineWarehouse(line.lineId, e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                              <option value="">Select…</option>
                              {WAREHOUSES.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={line.bin} onChange={(e) => updateLine(line.lineId, { bin: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                              disabled={bins.length === 0}>
                              <option value="">Select…</option>
                              {bins.map((b) => <option key={b}>{b}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-right text-blue-700 font-semibold whitespace-nowrap">₹{fmtAmt(line.totalAmt)}</td>
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => removeLine(line.lineId)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={13} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50 border-t-2 border-blue-200">
                      <td colSpan={8} className="px-3 py-2 text-right text-xs font-bold text-blue-700">
                        {lines.length} line{lines.length !== 1 ? "s" : ""} · Basic ₹{fmtAmt(totalBasic)} · Tax ₹{fmtAmt(totalTax)}
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-bold text-blue-900">₹{fmtAmt(totalAmt)}</td>
                      <td />
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

        {/* ── TAB 4: DOCUMENTS ─────────────────────────────── */}
        {activeTab === "documents" && (
          <div className="p-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5 flex items-center gap-2">
              <FileText size={13} className="text-gray-400" /> Invoice &amp; Transport Details
              <span className="text-[10px] font-normal text-gray-400 normal-case ml-1">(optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-5">
              {[
                { label: "Invoice No.", value: invoiceNo, set: setInvoiceNo, ph: "INV/...", type: "text" },
                { label: "Invoice Date", value: invoiceDate, set: setInvoiceDate, ph: "", type: "date" },
                { label: "E-Way Bill No.", value: eWayBillNo, set: setEWayBillNo, ph: "EWB...", type: "text" },
                { label: "E-Way Bill Date", value: eWayBillDate, set: setEWayBillDate, ph: "", type: "date" },
                { label: "Gate Entry No.", value: gateEntryNo, set: setGateEntryNo, ph: "GE-...", type: "text" },
                { label: "Gate Entry Date", value: gateEntryDate, set: setGateEntryDate, ph: "", type: "date" },
                { label: "LR No. / Vehicle No.", value: lrVehicleNo, set: setLrVehicleNo, ph: "MH-XX-AB-1234", type: "text" },
                { label: "Transporter", value: transporter, set: setTransporter, ph: "Logistics name", type: "text" },
                { label: "Received By", value: receivedBy, set: setReceivedBy, ph: "Staff name", type: "text" },
                { label: "Remark", value: remark, set: setRemark, ph: "Optional notes", type: "text" },
              ].map((f) => (
                <div key={f.label}>
                  <label className={labelCls}>{f.label}</label>
                  <input type={f.type} value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} className={inputCls} />
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={save}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                <CheckCircle2 size={16} /> Save GRN
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      {scanningLineId && (
        <QRScannerModal
          onScan={(val) => { updateLine(scanningLineId, { supplierBatchNo: val }); setScanningLineId(null); }}
          onClose={() => setScanningLineId(null)}
        />
      )}
      {bulkTarget && (
        <BulkRollEntryModal
          po={bulkTarget.po} poLine={bulkTarget.poLine}
          grnDate={grnDate} sameState={sameState}
          existingLineCount={lines.filter((l) => l.itemCode === bulkTarget.poLine.itemCode).length}
          onAdd={addBulkLines}
          onClose={() => setBulkTarget(null)}
        />
      )}
    </div>
  );
}
