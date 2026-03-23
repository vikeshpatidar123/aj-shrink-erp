"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Plus, X, Search, FileText, Scan, Printer, CheckCircle2,
  Camera, Keyboard, Trash2, Pencil, QrCode, List, Save, ArrowLeft
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

const genBatchNo = (itemCode: string, date: string, seq: number) => {
  const d = date.replace(/-/g, "");
  return `BATCH-${itemCode}-${d}-${String(seq).padStart(3, "0")}`;
};

const STATUS_STYLE: Record<GRN["status"], string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Completed: "bg-green-100 text-green-700",
  Verified:  "bg-blue-100 text-blue-700",
};

// ─── QR Slip Print ──────────────────────────────────────────
async function printQRSlip(line: GRNLine, grn: GRN) {
  const qrData = JSON.stringify({
    batchNo: line.batchNo,
    supplierBatchNo: line.supplierBatchNo,
    itemCode: line.itemCode,
    itemName: line.itemName,
    grnNo: grn.grnNo,
    qty: line.receivedQty,
    unit: line.stockUnit,
    supplier: grn.supplier,
    warehouseId: line.warehouseId,
    bin: line.bin,
  });

  const qrDataURL = await QRCode.toDataURL(qrData, {
    width: 200, margin: 1,
    color: { dark: "#0f4c5c", light: "#ffffff" },
  });

  const slipHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>GRN QR Slip</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
        .slip { width: 340px; border: 2px solid #0f4c5c; border-radius: 6px; overflow: hidden; }
        .header { background: #0f4c5c; color: white; padding: 8px 12px; text-align: center; }
        .header h2 { font-size: 13px; font-weight: bold; letter-spacing: 0.5px; }
        .header p { font-size: 9px; opacity: 0.8; margin-top: 2px; }
        .body { display: flex; padding: 10px; gap: 10px; }
        .qr img { width: 110px; height: 110px; border: 1px solid #ddd; border-radius: 4px; }
        .details { flex: 1; }
        .row { display: flex; flex-direction: column; margin-bottom: 5px; }
        .label { font-size: 8px; color: #666; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; }
        .value { font-size: 10px; font-weight: bold; color: #0f4c5c; word-break: break-all; }
        .batch-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px; padding: 6px; margin-bottom: 6px; }
        .batch-box .label { color: #0369a1; }
        .batch-box .value { font-size: 11px; color: #0369a1; font-family: monospace; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 5px 12px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="slip">
        <div class="header">
          <h2>${COMPANY}</h2>
          <p>Goods Receipt Note — Stock Label</p>
        </div>
        <div class="body">
          <div class="qr"><img src="${qrDataURL}" alt="QR" /></div>
          <div class="details">
            <div class="batch-box">
              <div class="label">Internal Batch No.</div>
              <div class="value">${line.batchNo}</div>
            </div>
            <div class="row">
              <div class="label">Supplier Batch No.</div>
              <div class="value">${line.supplierBatchNo || "—"}</div>
            </div>
            <div class="row">
              <div class="label">Item Code</div>
              <div class="value">${line.itemCode}</div>
            </div>
            <div class="row">
              <div class="label">Item Name</div>
              <div class="value" style="font-size:9px;color:#111;">${line.itemName}</div>
            </div>
            <div style="display:flex;gap:8px;">
              <div class="row" style="flex:1;">
                <div class="label">Received Qty</div>
                <div class="value">${line.receivedQty} ${line.stockUnit}</div>
              </div>
              <div class="row" style="flex:1;">
                <div class="label">Warehouse</div>
                <div class="value">${line.warehouseName}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px;">
              <div class="row" style="flex:1;">
                <div class="label">Bin</div>
                <div class="value">${line.bin}</div>
              </div>
              <div class="row" style="flex:1;">
                <div class="label">GRN No.</div>
                <div class="value" style="font-size:9px;">${grn.grnNo}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="footer">
          <span>Date: ${fmtDate(grn.grnDate)}</span>
          <span>Supplier: ${grn.supplier}</span>
          <span>HSN: ${line.hsnCode}</span>
        </div>
      </div>
    </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=420,height=450");
  if (!win) return;
  win.document.write(slipHTML);
  win.document.close();
  win.onload = () => { win.print(); };
}

// ─── QR Scanner Component ────────────────────────────────────
function QRScannerModal({
  onScan, onClose,
}: {
  onScan: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manual, setManual] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const scan = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) {
      stopCamera();
      onScan(code.data);
    }
  }, [onScan, stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        intervalRef.current = setInterval(scan, 150);
      }
    } catch {
      setCameraError("Camera access denied or not available. Use manual entry.");
      setMode("manual");
    }
  }, [scan]);

  useEffect(() => {
    if (mode === "camera") startCamera();
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode size={16} />
            <span className="font-semibold text-sm">QR / Barcode Scanner</span>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setMode("camera")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors ${mode === "camera" ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <Camera size={14} /> Camera Scan
          </button>
          <button
            onClick={() => { setMode("manual"); stopCamera(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors ${mode === "manual" ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <Keyboard size={14} /> Manual Entry
          </button>
        </div>

        {/* Camera view */}
        {mode === "camera" && (
          <div className="p-4">
            {cameraError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600 text-center">
                {cameraError}
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                {/* Scan overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-blue-400 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br" />
                    {scanning && (
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-400 animate-bounce" style={{ animationDuration: "1.5s" }} />
                    )}
                  </div>
                </div>
                <div className="absolute bottom-3 inset-x-0 text-center">
                  <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                    Point camera at QR / Barcode
                  </span>
                </div>
              </div>
            )}
            <p className="text-center text-xs text-gray-400 mt-3">
              Scanned value will auto-fill Supplier Batch No.
            </p>
          </div>
        )}

        {/* Manual entry */}
        {mode === "manual" && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-2">
                Enter / Paste Batch No. or Barcode
              </label>
              <textarea
                autoFocus
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                rows={3}
                placeholder="Scan or type supplier batch / barcode value here…"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
              />
            </div>
            <button
              onClick={() => { if (manual.trim()) onScan(manual.trim()); }}
              disabled={!manual.trim()}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Use This Value
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Line Edit Modal ─────────────────────────────────────────
function LineEditModal({
  line, sameState, onSave, onClose,
}: {
  line: GRNLine;
  sameState: boolean;
  onSave: (updated: GRNLine) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<GRNLine>({ ...line });
  const [showScanner, setShowScanner] = useState(false);

  const wh = WAREHOUSES.find((w) => w.id === form.warehouseId);
  const bins = wh?.bins ?? [];

  const f = (k: keyof GRNLine, v: string | number) => {
    setForm((p) => {
      const updated = { ...p, [k]: v };
      // Recalc amounts when receivedQty or rate changes
      const qty = k === "receivedQty" ? Number(v) : updated.receivedQty;
      const rate = k === "rate" ? Number(v) : updated.rate;
      const basic = qty * rate;
      const cgst = sameState ? basic * updated.gstPct / 2 / 100 : 0;
      const sgst = sameState ? basic * updated.gstPct / 2 / 100 : 0;
      const igst = !sameState ? basic * updated.gstPct / 100 : 0;
      return { ...updated, basicAmt: basic, cgstAmt: cgst, sgstAmt: sgst, igstAmt: igst, totalAmt: basic + cgst + sgst + igst };
    });
  };

  const onScanResult = (val: string) => {
    setForm((p) => ({ ...p, supplierBatchNo: val }));
    setShowScanner(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
            <div>
              <p className="font-semibold text-sm">{form.itemName}</p>
              <p className="text-xs text-blue-200 font-mono">{form.itemCode} · PO: {form.poRef}</p>
            </div>
            <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
          </div>

          <div className="overflow-y-auto p-6 space-y-6 flex-1">
            {/* Batch / Scan */}
            <div>
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">
                Batch Identification
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Internal Batch No.</label>
                  <input readOnly value={form.batchNo} className={`${inputCls} bg-blue-50 font-mono text-blue-700 text-xs`} />
                </div>
                <div>
                  <label className={labelCls}>Supplier Batch No. <span className="text-blue-600">(Scan / Enter)</span></label>
                  <div className="flex gap-2">
                    <input
                      value={form.supplierBatchNo}
                      onChange={(e) => f("supplierBatchNo", e.target.value)}
                      placeholder="Scan QR or type…"
                      className={`${inputCls} flex-1 font-mono`}
                    />
                    <button
                      onClick={() => setShowScanner(true)}
                      title="Open QR / Barcode Scanner"
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      <Scan size={14} /> Scan
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Qty / Expiry */}
            <div>
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">
                Receipt Details
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Ordered Qty ({form.stockUnit})</label>
                  <input readOnly value={form.orderedQty} className={`${inputCls} bg-gray-50 text-gray-500`} />
                </div>
                <div>
                  <label className={labelCls}>Received Qty ({form.stockUnit}) *</label>
                  <input
                    type="number" min={0} value={form.receivedQty || ""}
                    onChange={(e) => f("receivedQty", Number(e.target.value))}
                    className={inputCls} placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelCls}>Rate (₹/{form.purchaseUnit})</label>
                  <input
                    type="number" min={0} step={0.01} value={form.rate || ""}
                    onChange={(e) => f("rate", Number(e.target.value))}
                    className={inputCls} placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Expiry Date</label>
                  <input type="date" value={form.expiryDate}
                    onChange={(e) => f("expiryDate", e.target.value)}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>HSN Code</label>
                  <input readOnly value={form.hsnCode} className={`${inputCls} bg-gray-50 text-gray-500`} />
                </div>
                <div>
                  <label className={labelCls}>GST %</label>
                  <input readOnly value={`${form.gstPct}%`} className={`${inputCls} bg-gray-50 text-gray-500`} />
                </div>
              </div>
            </div>

            {/* Warehouse / Bin */}
            <div>
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">
                Storage Location
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Warehouse *</label>
                  <select value={form.warehouseId}
                    onChange={(e) => {
                      const w = WAREHOUSES.find((x) => x.id === e.target.value);
                      setForm((p) => ({ ...p, warehouseId: e.target.value, warehouseName: w?.name ?? "", bin: "" }));
                    }}
                    className={inputCls}>
                    <option value="">Select warehouse…</option>
                    {WAREHOUSES.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Bin *</label>
                  <select value={form.bin}
                    onChange={(e) => setForm((p) => ({ ...p, bin: e.target.value }))}
                    className={inputCls} disabled={bins.length === 0}>
                    <option value="">Select bin…</option>
                    {bins.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Amount preview */}
            <div className="bg-blue-50 rounded-xl p-4 grid grid-cols-4 gap-3 text-center">
              {[
                { label: "Basic Amt", value: fmtAmt(form.basicAmt), cls: "text-gray-800" },
                { label: sameState ? "CGST" : "—", value: sameState ? fmtAmt(form.cgstAmt) : "—", cls: "text-blue-700" },
                { label: sameState ? "SGST" : "IGST", value: sameState ? fmtAmt(form.sgstAmt) : fmtAmt(form.igstAmt), cls: "text-blue-700" },
                { label: "Total Amt", value: `₹${fmtAmt(form.totalAmt)}`, cls: "text-blue-800 font-bold text-base" },
              ].map((col) => (
                <div key={col.label}>
                  <p className="text-xs text-gray-500 mb-0.5">{col.label}</p>
                  <p className={`text-sm ${col.cls}`}>{col.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
            <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={!form.receivedQty || !form.warehouseId || !form.bin}
              className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle2 size={16} /> Confirm Receipt
            </button>
          </div>
        </div>
      </div>

      {showScanner && (
        <QRScannerModal onScan={onScanResult} onClose={() => setShowScanner(false)} />
      )}
    </>
  );
}

// ─── PO Picker Modal ─────────────────────────────────────────
function POPickerModal({
  supplier, supplierPOs, onAdd, onClose,
}: {
  supplier: string;
  supplierPOs: PurchaseOrder[];
  onAdd: (po: PurchaseOrder, line: POLine) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[750px] max-h-[82vh] flex flex-col overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold text-sm">Select Item from Purchase Order</h3>
            <p className="text-xs text-blue-200 mt-0.5">Supplier: {supplier}</p>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {supplierPOs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              No approved / pending purchase orders found for {supplier}
            </div>
          ) : supplierPOs.map((po) => (
            <div key={po.id}>
              <div className="bg-blue-50 px-5 py-2 flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-blue-700">{po.poNo}</span>
                <span className="text-xs text-gray-500">{fmtDate(po.poDate)}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${po.status === "Approved" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {po.status}
                </span>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Item Code</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Item Name</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-500">PO Qty</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-500">Rate (₹)</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((l) => (
                    <tr key={l.lineId} className="border-t border-gray-50 hover:bg-blue-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-blue-700 font-semibold">{l.itemCode}</td>
                      <td className="px-4 py-2.5 text-gray-800">{l.itemName}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 font-semibold">{l.poQtyInPU.toLocaleString()} {l.stockUnit}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">₹{fmtAmt(l.rate)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => onAdd(po, l)}
                          className="flex items-center gap-1 mx-auto px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                          <Plus size={11} /> Add &amp; Scan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div className="px-5 py-2.5 border-t border-gray-100 text-right shrink-0">
          <p className="text-xs text-gray-400">Click &ldquo;Add &amp; Scan&rdquo; to add item — QR scanner will open automatically</p>
        </div>
      </div>
    </div>
  );
}

// ─── Section Title ────────────────────────────────────────────
const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">
    {title}
  </h3>
);

// ─── Main Page ───────────────────────────────────────────────
export default function PurchaseGRNPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<GRN[]>(initData);
  const [editing, setEditing] = useState<GRN | null>(null);
  const [filterStatus, setFilterStatus] = useState<"All" | GRN["status"]>("All");
  const [listSearch, setListSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"basic" | "items" | "documents">("basic");

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

  // PO picker state
  const [showPOPicker, setShowPOPicker] = useState(false);

  // Line edit modal
  const [editingLine, setEditingLine] = useState<GRNLine | null>(null);

  // Derived: POs for selected supplier
  const supplierPOs = useMemo(
    () => purchaseOrders.filter((po) =>
      po.supplier === supplier &&
      (po.status === "Approved" || po.status === "Sent")
    ),
    [supplier]
  );

  const supplierInfo = SUPPLIERS.find((s) => s.name === supplier);
  const sameState = supplierInfo?.state === COMPANY_STATE;

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

  const addPOLine = (po: PurchaseOrder, poLine: POLine) => {
    const seq = lines.filter((l) => l.itemCode === poLine.itemCode).length + 1;
    const newLine: GRNLine = {
      lineId: Math.random().toString(36).slice(2),
      poRef: po.poNo,
      itemCode: poLine.itemCode, itemGroup: poLine.itemGroup,
      subGroup: poLine.subGroup, itemName: poLine.itemName,
      orderedQty: poLine.poQtyInPU, receivedQty: poLine.poQtyInPU,
      stockUnit: poLine.stockUnit, purchaseUnit: poLine.purchaseUnit,
      rate: poLine.rate, hsnCode: poLine.hsnCode, gstPct: poLine.gstPct,
      batchNo: genBatchNo(poLine.itemCode, grnDate, seq),
      supplierBatchNo: "", expiryDate: "",
      warehouseId: "", warehouseName: "", bin: "",
      basicAmt: poLine.basicAmt, cgstAmt: poLine.cgstAmt,
      sgstAmt: poLine.sgstAmt, igstAmt: poLine.igstAmt, totalAmt: poLine.totalAmt,
    };
    setLines((prev) => [...prev, newLine]);
    setShowPOPicker(false);
    setEditingLine(newLine);
  };

  const saveLineEdit = (updated: GRNLine) => {
    setLines((prev) => prev.map((l) => l.lineId === updated.lineId ? updated : l));
    setEditingLine(null);
  };

  const removeLine = (lineId: string) => setLines((prev) => prev.filter((l) => l.lineId !== lineId));

  const save = (status: GRN["status"]) => {
    if (!supplier) { alert("Select a supplier."); return; }
    if (lines.length === 0) { alert("Add at least one item line."); return; }
    const grn: GRN = {
      id: editing ? editing.id : `GRN${String(data.length + 1).padStart(3, "0")}`,
      grnNo: editing ? editing.grnNo : nextGRNNo(data),
      grnDate, supplier, supplierState: supplierInfo?.state ?? "",
      lines, invoiceNo, invoiceDate, eWayBillNo, eWayBillDate,
      gateEntryNo, gateEntryDate, lrVehicleNo, transporter, receivedBy, remark, status,
    };
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? grn : r));
    } else {
      setData((d) => [...d, grn]);
    }
    setView("list");
  };

  const currentGRNNo = editing ? editing.grnNo : nextGRNNo(data);
  const totalBasic = lines.reduce((s, l) => s + l.basicAmt, 0);
  const totalTax   = lines.reduce((s, l) => s + l.cgstAmt + l.sgstAmt + l.igstAmt, 0);
  const totalAmt   = lines.reduce((s, l) => s + l.totalAmt, 0);
  const filteredData = (filterStatus === "All" ? data : data.filter((r) => r.status === filterStatus))
    .filter((r) => {
      if (!listSearch) return true;
      const s = listSearch.toLowerCase();
      return (
        r.grnNo.toLowerCase().includes(s) ||
        r.supplier.toLowerCase().includes(s) ||
        r.invoiceNo.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
      );
    });
  const statuses: ("All" | GRN["status"])[] = ["All", "Draft", "Completed", "Verified"];

  // ══════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════
  if (view === "list") {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Title + New button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Purchase GRN</h2>
            <p className="text-sm text-gray-500">Goods Receipt Note — {filteredData.length} records</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={16} /> New GRN
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Status</span>
            {statuses.map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by GRN no, supplier, invoice no..."
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
            />
          </div>
        </div>

        {/* GRN Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">GRN No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice No.</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Basic Amt (₹)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Tax (₹)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total (₹)</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-16 text-gray-400">No GRN records found</td></tr>
              ) : filteredData.map((grn, i) => {
                const gBasic = grn.lines.reduce((s, l) => s + l.basicAmt, 0);
                const gTax   = grn.lines.reduce((s, l) => s + l.cgstAmt + l.sgstAmt + l.igstAmt, 0);
                const gTotal = grn.lines.reduce((s, l) => s + l.totalAmt, 0);
                return (
                  <tr key={grn.id} className="border-t border-gray-100 hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{grn.grnNo}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(grn.grnDate)}</td>
                    <td className="px-4 py-3 text-gray-800 text-xs font-medium">{grn.supplier}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs font-mono">{grn.invoiceNo || "—"}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700">{grn.lines.length}</td>
                    <td className="px-4 py-3 text-right text-gray-700 text-xs font-semibold">₹{fmtAmt(gBasic)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 text-xs">₹{fmtAmt(gTax)}</td>
                    <td className="px-4 py-3 text-right text-blue-700 text-xs font-bold">₹{fmtAmt(gTotal)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[grn.status]}`}>
                        {grn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-center">
                        <button onClick={() => openEdit(grn)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors">
                          <Pencil size={11} /> Edit
                        </button>
                        {/* Per-line QR print dropdown */}
                        <div className="relative group">
                          <button className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                            <Printer size={11} /> QR Slip ▾
                          </button>
                          <div className="absolute right-0 top-7 z-20 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg w-56 py-1">
                            {grn.lines.map((l) => (
                              <button key={l.lineId} onClick={() => printQRSlip(l, grn)}
                                className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors">
                                <QrCode size={12} />
                                <span className="truncate">{l.itemCode} — {l.batchNo.slice(-10)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => handleDelete(grn.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 size={11} />
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
  // FORM VIEW
  // ══════════════════════════════════════════════════════════
  return (
    <div className="max-w-5xl mx-auto pb-10">

      {/* Header Ribbon */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{COMPANY}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <h2 className="text-xl font-bold text-gray-800">Purchase GRN</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 font-mono">
              {currentGRNNo}
            </span>
            {editing && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[editing.status]}`}>
                {editing.status}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("list")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <List size={16} /> List ({data.length})
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
            <Plus size={16} /> New
          </button>
          <button onClick={() => save("Draft")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Save size={16} /> Draft
          </button>
          <button onClick={() => save("Completed")}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <CheckCircle2 size={16} /> Save
          </button>
          {editing && (
            <button onClick={() => { handleDelete(editing.id); setView("list"); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Tab Header */}
        <div className="px-6 pt-5 border-b border-gray-200 bg-gray-50/30">
          <div className="flex gap-8">
            {(["basic", "items", "documents"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 capitalize ${activeTab === tab ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}
              >
                {tab === "basic" ? "Basic" : tab === "items" ? "Items" : "Documents"}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">

          {/* ── BASIC TAB ── */}
          {activeTab === "basic" && (
            <div className="space-y-8">
              <div>
                <SectionTitle title="GRN Details" />
                <div className="grid grid-cols-3 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">GRN No.</label>
                    <input
                      readOnly value={currentGRNNo}
                      className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-blue-50 text-blue-700 font-mono font-semibold focus:outline-none w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">GRN Date</label>
                    <input
                      type="date" value={grnDate}
                      onChange={(e) => setGrnDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Supplier Name <span className="text-red-500">*</span>
                      {supplierInfo && (
                        <span className="ml-2 normal-case font-normal text-gray-400">
                          {supplierInfo.state}
                          {sameState
                            ? <span className="ml-1 text-green-600 font-semibold">CGST+SGST</span>
                            : <span className="ml-1 text-orange-600 font-semibold">IGST</span>}
                        </span>
                      )}
                    </label>
                    <select
                      value={supplier}
                      onChange={(e) => { setSupplier(e.target.value); setLines([]); }}
                      className={inputCls}
                    >
                      <option value="">Select Supplier…</option>
                      {SUPPLIERS.map((s) => <option key={s.name} value={s.name}>{s.name} — {s.state}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* GST type indicator */}
              {supplier && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium ${sameState ? "bg-green-50 border border-green-200 text-green-700" : "bg-orange-50 border border-orange-200 text-orange-700"}`}>
                  {sameState
                    ? `Intra-state supply — CGST + SGST will apply (Supplier: ${supplierInfo?.state})`
                    : `Inter-state supply — IGST will apply (Supplier: ${supplierInfo?.state})`}
                </div>
              )}

            </div>
          )}

          {/* ── ITEMS TAB ── */}
          {activeTab === "items" && (
            <div className="space-y-4">
              {/* Add from PO button */}
              <div className="flex items-center justify-between">
                <SectionTitle title="Line Items" />
                <button
                  onClick={() => { if (!supplier) { alert("Select a supplier first (Basic tab)."); return; } setShowPOPicker(true); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Plus size={14} /> Add from PO
                </button>
              </div>

              {/* Items table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs border-collapse" style={{ minWidth: 1100 }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {[
                        { l: "PO Ref", r: false }, { l: "Item Code", r: false }, { l: "Item Name", r: false },
                        { l: "Ordered Qty", r: true }, { l: "Received Qty", r: true }, { l: "Unit", r: false },
                        { l: "Rate (₹)", r: true }, { l: "Internal Batch No.", r: false },
                        { l: "Supplier Batch No.", r: false },
                        { l: "Expiry Date", r: false }, { l: "Warehouse", r: false }, { l: "Bin", r: false },
                        { l: "Basic Amt", r: true }, { l: "CGST", r: true }, { l: "SGST", r: true },
                        { l: "IGST", r: true }, { l: "Total Amt", r: true }, { l: "", r: false },
                      ].map((col, i) => (
                        <th key={i} className={`px-2 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-100 last:border-r-0 ${col.r ? "text-right" : "text-left"}`}>
                          {col.l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={18} className="text-center py-16 text-gray-400 text-sm">
                          {supplier
                            ? 'Click "+ Add from PO" to begin'
                            : "Select a supplier on the Basic tab to get started"}
                        </td>
                      </tr>
                    ) : lines.map((line, idx) => (
                      <tr key={line.lineId} className={`border-t border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                        <td className="px-2 py-2 font-mono text-blue-600 whitespace-nowrap text-[10px]">{line.poRef}</td>
                        <td className="px-2 py-2 font-mono text-blue-700 font-semibold whitespace-nowrap">{line.itemCode}</td>
                        <td className="px-2 py-2 text-gray-800" style={{ maxWidth: 160 }}>{line.itemName}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{line.orderedQty.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right font-semibold text-blue-700">{line.receivedQty.toLocaleString()}</td>
                        <td className="px-2 py-2 text-gray-700">{line.stockUnit}</td>
                        <td className="px-2 py-2 text-right text-gray-700">₹{fmtAmt(line.rate)}</td>
                        <td className="px-2 py-2 font-mono text-blue-600 text-[9px] whitespace-nowrap">{line.batchNo}</td>
                        <td className="px-2 py-2 font-mono text-gray-600">
                          {line.supplierBatchNo || <span className="text-orange-400 italic">Not set</span>}
                        </td>
                        <td className="px-2 py-2 text-gray-700">{line.expiryDate ? fmtDate(line.expiryDate) : "—"}</td>
                        <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{line.warehouseName || <span className="text-red-400 italic">Not set</span>}</td>
                        <td className="px-2 py-2 text-gray-600">{line.bin || "—"}</td>
                        <td className="px-2 py-2 text-right text-gray-700">{fmtAmt(line.basicAmt)}</td>
                        <td className="px-2 py-2 text-right text-blue-700">{fmtAmt(line.cgstAmt)}</td>
                        <td className="px-2 py-2 text-right text-blue-700">{fmtAmt(line.sgstAmt)}</td>
                        <td className="px-2 py-2 text-right text-orange-700">{fmtAmt(line.igstAmt)}</td>
                        <td className="px-2 py-2 text-right font-bold text-blue-800">{fmtAmt(line.totalAmt)}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setEditingLine(line)} title="Fill Details"
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors whitespace-nowrap">
                              <Scan size={11} /> Fill Details
                            </button>
                            <button onClick={() => removeLine(line.lineId)} title="Remove"
                              className="text-gray-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {lines.length > 0 && (
                    <tfoot>
                      <tr className="bg-blue-50 border-t-2 border-blue-200 text-xs font-bold">
                        <td colSpan={12} className="px-3 py-2.5 text-right text-blue-800">Totals</td>
                        <td className="px-2 py-2.5 text-right text-blue-800">{fmtAmt(totalBasic)}</td>
                        <td className="px-2 py-2.5 text-right text-blue-700">{fmtAmt(lines.reduce((s, l) => s + l.cgstAmt, 0))}</td>
                        <td className="px-2 py-2.5 text-right text-blue-700">{fmtAmt(lines.reduce((s, l) => s + l.sgstAmt, 0))}</td>
                        <td className="px-2 py-2.5 text-right text-orange-700">{fmtAmt(lines.reduce((s, l) => s + l.igstAmt, 0))}</td>
                        <td className="px-2 py-2.5 text-right text-blue-900 font-bold">₹{fmtAmt(totalAmt)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Summary footer */}
              {lines.length > 0 && (
                <div className="flex items-center justify-end text-sm text-gray-500 pt-1">
                  {lines.length} item{lines.length !== 1 ? "s" : ""} · Total:&nbsp;<span className="font-bold text-blue-700">₹{fmtAmt(totalAmt)}</span>
                </div>
              )}
            </div>
          )}

          {/* ── DOCUMENTS TAB ── */}
          {activeTab === "documents" && (
            <div className="space-y-8">
              <div>
                <SectionTitle title="Invoice Details" />
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice No.</label>
                    <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV/..." className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Date</label>
                    <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              <div>
                <SectionTitle title="E-Way Bill" />
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">E-Way Bill No.</label>
                    <input value={eWayBillNo} onChange={(e) => setEWayBillNo(e.target.value)} placeholder="EWB..." className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">E-Way Bill Date</label>
                    <input type="date" value={eWayBillDate} onChange={(e) => setEWayBillDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              <div>
                <SectionTitle title="Gate Entry" />
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gate Entry No.</label>
                    <input value={gateEntryNo} onChange={(e) => setGateEntryNo(e.target.value)} placeholder="GE-..." className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gate Entry Date</label>
                    <input type="date" value={gateEntryDate} onChange={(e) => setGateEntryDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              <div>
                <SectionTitle title="Transport & Receipt" />
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">LR No. / Vehicle No.</label>
                    <input value={lrVehicleNo} onChange={(e) => setLrVehicleNo(e.target.value)} placeholder="MH-XX-AB-1234" className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transporter</label>
                    <input value={transporter} onChange={(e) => setTransporter(e.target.value)} placeholder="Logistics name" className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Received By</label>
                    <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Staff name" className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Remark</label>
                    <input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Optional notes" className={inputCls} />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* PO Picker Modal */}
      {showPOPicker && (
        <POPickerModal
          supplier={supplier}
          supplierPOs={supplierPOs}
          onAdd={addPOLine}
          onClose={() => setShowPOPicker(false)}
        />
      )}

      {/* Line Edit Modal */}
      {editingLine && (
        <LineEditModal
          line={editingLine}
          sameState={sameState}
          onSave={saveLineEdit}
          onClose={() => setEditingLine(null)}
        />
      )}
    </div>
  );
}
