"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import jsQR from "jsqr";
import {
  X, Scan, QrCode, CheckCircle2, Pencil, Trash2, Plus,
  Camera, Keyboard, List, ClipboardCheck, TrendingUp, TrendingDown,
  Minus, PackagePlus, Search,
} from "lucide-react";
import {
  grnRecords, GRNLine,
  WAREHOUSES,
  physicalVerifications as initData,
  PhysicalVerification, PhysicalVerificationLine,
} from "@/data/dummyData";
import { inputCls } from "@/lib/styles";

// ─── Helpers ─────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const nextVoucherNo = (list: PhysicalVerification[]) => {
  const yr = new Date().getFullYear();
  return `PV${String(list.length + 1).padStart(5, "0")}_${String(yr - 2000).padStart(2, "0")}_${String(yr - 1999).padStart(2, "0")}`;
};

const STATUS_STYLE: Record<PhysicalVerification["status"], string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Completed: "bg-green-100 text-green-700",
};

// Find a GRNLine by batchNo + itemCode across all GRN records
function findBatch(batchNo: string, itemCode?: string): { line: GRNLine; grnNo: string } | null {
  for (const grn of grnRecords) {
    const l = grn.lines.find(
      (x) => x.batchNo === batchNo && (itemCode ? x.itemCode === itemCode : true)
    );
    if (l) return { line: l, grnNo: grn.grnNo };
  }
  return null;
}

// Count existing physical batch serials for a given original batchNo
function nextPhysicalBatchNo(originalBatchNo: string): string {
  let max = 0;
  for (const grn of grnRecords) {
    for (const l of grn.lines) {
      if (l.batchNo.startsWith(originalBatchNo + "_")) {
        const suffix = l.batchNo.slice(originalBatchNo.length + 1);
        const num = parseInt(suffix, 10);
        if (!isNaN(num) && num > max) max = num;
      }
    }
  }
  return `${originalBatchNo}_${String(max + 1).padStart(3, "0")}`;
}

type ScannedBatchInfo = {
  batchNo: string; supplierBatchNo: string;
  itemCode: string; itemName: string; stockUnit: string;
  itemGroup: string; itemSubGroup: string;
  warehouseId: string; warehouseName: string; bin: string;
  grnNo: string; systemQty: number;
};

function parseQR(raw: string): ScannedBatchInfo | null {
  try {
    const d = JSON.parse(raw);
    if (!d.batchNo) return null;
    const found = findBatch(d.batchNo, d.itemCode);
    if (found) {
      return {
        batchNo: found.line.batchNo,
        supplierBatchNo: found.line.supplierBatchNo,
        itemCode: found.line.itemCode,
        itemName: found.line.itemName,
        stockUnit: found.line.stockUnit,
        itemGroup: found.line.itemGroup,
        itemSubGroup: found.line.subGroup,
        warehouseId: found.line.warehouseId,
        warehouseName: found.line.warehouseName,
        bin: found.line.bin,
        grnNo: found.grnNo,
        systemQty: found.line.receivedQty,
      };
    }
    // QR data fallback if not in records
    return null;
  } catch {
    return null;
  }
}

// ─── QR Scanner Modal ────────────────────────────────────────
function ScannerModal({ title, hint, onScan, onClose }: {
  title: string; hint: string;
  onScan: (val: string) => void; onClose: () => void;
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
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null; setScanning(false);
  }, []);

  const scan = useCallback(() => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
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
    } catch { setCameraError("Camera unavailable. Use manual entry."); setMode("manual"); }
  }, [scan]);

  useEffect(() => {
    if (mode === "camera") startCamera();
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] overflow-hidden">
        <div className="bg-blue-600 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode size={16} />
            <div><p className="font-semibold text-sm">{title}</p><p className="text-xs text-blue-200">{hint}</p></div>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex border-b border-gray-100">
          {[{ m: "camera" as const, icon: Camera, label: "Camera Scan" }, { m: "manual" as const, icon: Keyboard, label: "Manual Entry" }].map(({ m, icon: Icon, label }) => (
            <button key={m} onClick={() => { setMode(m); if (m !== "camera") stopCamera(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors ${mode === m ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>
              <Icon size={13} /> {label}
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
                    {["top-0 left-0 border-t-4 border-l-4 rounded-tl", "top-0 right-0 border-t-4 border-r-4 rounded-tr",
                      "bottom-0 left-0 border-b-4 border-l-4 rounded-bl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br",
                    ].map((cls, i) => <div key={i} className={`absolute w-6 h-6 border-blue-400 ${cls}`} />)}
                    {scanning && <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-400 animate-bounce" style={{ animationDuration: "1.5s" }} />}
                  </div>
                </div>
                <div className="absolute bottom-3 inset-x-0 text-center">
                  <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">Point at QR / Barcode</span>
                </div>
              </div>
            )}
            <p className="text-center text-xs text-gray-400 mt-2">Scan will auto-process</p>
          </div>
        )}
        {mode === "manual" && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-2">Enter / Paste value</label>
              <textarea autoFocus value={manual} onChange={(e) => setManual(e.target.value)} rows={3}
                placeholder="Paste QR data or type batch no…"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono" />
            </div>
            <button onClick={() => { if (manual.trim()) onScan(manual.trim()); }} disabled={!manual.trim()}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40">
              Use This Value
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New Batch Stock Modal ────────────────────────────────────
function NewBatchModal({
  scanned, onConfirm, onClose,
}: {
  scanned: ScannedBatchInfo;
  onConfirm: (line: Omit<PhysicalVerificationLine, "lineId">) => void;
  onClose: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState("");
  const [bin, setBin] = useState("");
  const [physicalQty, setPhysicalQty] = useState<number>(0);
  const wh = WAREHOUSES.find((w) => w.id === warehouseId);
  const newBatchNo = nextPhysicalBatchNo(scanned.batchNo);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PackagePlus size={16} className="text-green-300" />
            <div>
              <p className="font-semibold text-sm">New Physical Stock Entry</p>
              <p className="text-xs text-blue-200">Creates a new batch for this item</p>
            </div>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Item info */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Item</p>
                <p className="font-semibold text-gray-800">{scanned.itemName}</p>
                <p className="font-mono text-blue-700">{scanned.itemCode}</p>
              </div>
              <div>
                <p className="text-gray-400 font-semibold uppercase tracking-wider mb-0.5">New Batch No. (auto)</p>
                <p className="font-mono text-blue-700 font-bold break-all">{newBatchNo}</p>
              </div>
              <div>
                <p className="text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Original Batch</p>
                <p className="font-mono text-gray-600 text-[10px] break-all">{scanned.batchNo}</p>
              </div>
              <div>
                <p className="text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Group / Sub Group</p>
                <p className="text-gray-700">{scanned.itemGroup} / {scanned.itemSubGroup}</p>
              </div>
            </div>
          </div>

          {/* Entry fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Warehouse *</label>
              <select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setBin(""); }} className={inputCls}>
                <option value="">Select warehouse…</option>
                {WAREHOUSES.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Bin *</label>
              <select value={bin} onChange={(e) => setBin(e.target.value)} disabled={!wh} className={inputCls}>
                <option value="">Select bin…</option>
                {wh?.bins.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Physical Qty ({scanned.stockUnit}) *</label>
              <input type="number" min={0} step={0.01} value={physicalQty || ""}
                onChange={(e) => setPhysicalQty(Number(e.target.value))}
                className={inputCls} autoFocus />
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 flex items-center justify-between">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => {
              if (!physicalQty || !warehouseId || !bin) return;
              const w = WAREHOUSES.find((x) => x.id === warehouseId);
              // Push new GRNLine into grnRecords (live update)
              if (grnRecords.length > 0) {
                // Find GRN that has the original batch, or use first GRN
                let targetGrn = grnRecords.find((g) => g.lines.some((l) => l.batchNo === scanned.batchNo));
                if (!targetGrn) targetGrn = grnRecords[0];
                const origLine = targetGrn.lines.find((l) => l.batchNo === scanned.batchNo);
                const newLine: GRNLine = {
                  lineId: Math.random().toString(36).slice(2),
                  poRef: origLine?.poRef ?? "",
                  itemCode: scanned.itemCode,
                  itemGroup: scanned.itemGroup,
                  subGroup: scanned.itemSubGroup,
                  itemName: scanned.itemName,
                  orderedQty: physicalQty, receivedQty: physicalQty,
                  stockUnit: scanned.stockUnit, purchaseUnit: scanned.stockUnit,
                  rate: origLine?.rate ?? 0,
                  hsnCode: origLine?.hsnCode ?? "",
                  gstPct: origLine?.gstPct ?? 0,
                  batchNo: newBatchNo,
                  supplierBatchNo: "",
                  expiryDate: "",
                  warehouseId, warehouseName: w?.name ?? "", bin,
                  basicAmt: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, totalAmt: 0,
                };
                targetGrn.lines.push(newLine);
              }
              onConfirm({
                batchNo: newBatchNo,
                supplierBatchNo: "",
                itemCode: scanned.itemCode,
                itemName: scanned.itemName,
                stockUnit: scanned.stockUnit,
                itemGroup: scanned.itemGroup,
                itemSubGroup: scanned.itemSubGroup,
                warehouseId, warehouseName: w?.name ?? "", bin,
                grnNo: grnRecords.find((g) => g.lines.some((l) => l.batchNo === scanned.batchNo))?.grnNo ?? "",
                systemQty: 0,
                physicalQty,
                difference: physicalQty,
                isNewBatch: true,
                originalBatchNo: scanned.batchNo,
              });
            }}
            disabled={!physicalQty || !warehouseId || !bin}
            className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            <PackagePlus size={15} /> Create New Batch
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function PhysicalVerificationPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<PhysicalVerification[]>(initData);
  const [editing, setEditing] = useState<PhysicalVerification | null>(null);
  const [filterStatus, setFilterStatus] = useState<"All" | PhysicalVerification["status"]>("All");
  const [listSearch, setListSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"scan" | "lines">("scan");

  // Form state
  const [verificationDate, setVerificationDate] = useState(todayISO());
  const [lines, setLines] = useState<PhysicalVerificationLine[]>([]);
  const [remark, setRemark] = useState("");

  // Scan state
  const [showScanner, setShowScanner] = useState(false);
  const [scannedBatch, setScannedBatch] = useState<ScannedBatchInfo | null>(null);
  const [physicalQty, setPhysicalQty] = useState<number>(0);
  const [scanError, setScanError] = useState("");
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);

  const currentVoucherNo = editing ? editing.voucherNo : nextVoucherNo(data);
  const diff = scannedBatch ? physicalQty - scannedBatch.systemQty : 0;

  const resetForm = () => {
    setVerificationDate(todayISO());
    setLines([]); setRemark("");
    setScannedBatch(null); setPhysicalQty(0); setScanError("");
    setActiveTab("scan");
  };

  const openNew = () => { setEditing(null); resetForm(); setView("form"); };
  const openEdit = (pv: PhysicalVerification) => {
    setEditing(pv);
    setVerificationDate(pv.verificationDate);
    setLines(pv.lines.map((l) => ({ ...l })));
    setRemark(pv.remark);
    setScannedBatch(null); setPhysicalQty(0); setScanError("");
    setActiveTab("scan");
    setView("form");
  };
  const handleDelete = (id: string) => {
    if (confirm("Delete this Physical Verification?")) setData((d) => d.filter((r) => r.id !== id));
  };

  const handleScan = (raw: string) => {
    setShowScanner(false);
    setScanError("");
    // Try to parse as JSON QR first
    const info = parseQR(raw);
    if (!info) {
      // Try treating raw as a batch no directly
      const found = findBatch(raw.trim());
      if (found) {
        setScannedBatch({
          batchNo: found.line.batchNo, supplierBatchNo: found.line.supplierBatchNo,
          itemCode: found.line.itemCode, itemName: found.line.itemName,
          stockUnit: found.line.stockUnit, itemGroup: found.line.itemGroup,
          itemSubGroup: found.line.subGroup, warehouseId: found.line.warehouseId,
          warehouseName: found.line.warehouseName, bin: found.line.bin,
          grnNo: found.grnNo, systemQty: found.line.receivedQty,
        });
        setPhysicalQty(found.line.receivedQty);
      } else {
        setScanError(`Batch not found in system: "${raw.trim()}"`);
      }
      return;
    }
    setScannedBatch(info);
    setPhysicalQty(info.systemQty);
  };

  const addUpdateLine = () => {
    if (!scannedBatch) return;
    // Check if this batch is already in lines
    const existing = lines.find((l) => l.batchNo === scannedBatch.batchNo);
    if (existing) {
      // Update in place
      setLines((prev) => prev.map((l) =>
        l.batchNo === scannedBatch.batchNo
          ? { ...l, physicalQty, difference: physicalQty - scannedBatch.systemQty }
          : l
      ));
    } else {
      setLines((prev) => [...prev, {
        lineId: Math.random().toString(36).slice(2),
        batchNo: scannedBatch.batchNo, supplierBatchNo: scannedBatch.supplierBatchNo,
        itemCode: scannedBatch.itemCode, itemName: scannedBatch.itemName,
        stockUnit: scannedBatch.stockUnit, itemGroup: scannedBatch.itemGroup,
        itemSubGroup: scannedBatch.itemSubGroup, warehouseId: scannedBatch.warehouseId,
        warehouseName: scannedBatch.warehouseName, bin: scannedBatch.bin,
        grnNo: scannedBatch.grnNo, systemQty: scannedBatch.systemQty,
        physicalQty, difference: physicalQty - scannedBatch.systemQty,
        isNewBatch: false, originalBatchNo: scannedBatch.batchNo,
      }]);
    }
    setScannedBatch(null); setPhysicalQty(0); setScanError("");
  };

  const removeLine = (lineId: string) => setLines((prev) => prev.filter((l) => l.lineId !== lineId));

  const save = (status: PhysicalVerification["status"]) => {
    if (lines.length === 0) { alert("No verification lines added."); return; }
    // On Completed: mutate grnRecords batch quantities live
    if (status === "Completed") {
      for (const vl of lines) {
        if (!vl.isNewBatch) {
          for (const grn of grnRecords) {
            const l = grn.lines.find((x) => x.batchNo === vl.batchNo);
            if (l) { l.receivedQty = vl.physicalQty; break; }
          }
        }
        // New batches are already pushed into grnRecords at creation time
      }
    }
    const pv: PhysicalVerification = {
      id: editing ? editing.id : `PV${String(data.length + 1).padStart(3, "0")}`,
      voucherNo: currentVoucherNo, verificationDate,
      lines, remark, status,
    };
    if (editing) setData((d) => d.map((r) => r.id === editing.id ? pv : r));
    else setData((d) => [...d, pv]);
    setView("list");
  };

  const filteredData = (filterStatus === "All" ? data : data.filter((r) => r.status === filterStatus))
    .filter((r) => {
      if (!listSearch) return true;
      const s = listSearch.toLowerCase();
      return (
        r.voucherNo.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s) ||
        r.remark.toLowerCase().includes(s)
      );
    });

  // ══════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════
  if (view === "list") {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Physical Verification</h2>
            <p className="text-sm text-gray-500">{filteredData.length} verification records</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={16} /> New Verification
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Status</span>
            {(["All", "Draft", "Completed"] as const).map((s) => (
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
              placeholder="Search by voucher no, remark..."
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Voucher No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Lines</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Increases</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Decreases</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">New Batches</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-gray-400">No verification records. Click &ldquo;New Verification&rdquo; to begin.</td></tr>
              ) : filteredData.map((pv, i) => (
                <tr key={pv.id} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{pv.voucherNo}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(pv.verificationDate)}</td>
                  <td className="px-4 py-3 text-center font-medium text-gray-700">{pv.lines.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-green-700 font-semibold text-xs">{pv.lines.filter((l) => l.difference > 0).length}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-red-600 font-semibold text-xs">{pv.lines.filter((l) => l.difference < 0).length}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-blue-600 font-semibold text-xs">{pv.lines.filter((l) => l.isNewBatch).length}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[pv.status]}`}>{pv.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(pv)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors">
                        <Pencil size={11} /> Edit
                      </button>
                      <button onClick={() => handleDelete(pv.id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 size={11} />
                      </button>
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

  // ══════════════════════════════════════════════════════════
  // FORM VIEW
  // ══════════════════════════════════════════════════════════

  return (
    <div className="max-w-5xl mx-auto pb-10">

      {/* Header Ribbon */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs text-gray-400 font-medium">Inventory</p>
            <h2 className="text-lg font-bold text-gray-800 leading-tight">Physical Verification</h2>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-mono text-xs font-semibold border border-blue-100">
            {currentVoucherNo}
          </span>
          {editing && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[editing.status]}`}>
              {editing.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setView("list")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <List size={13} /> List
          </button>
          <button onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Plus size={13} /> New
          </button>
          <button onClick={() => save("Draft")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Draft
          </button>
          <button onClick={() => save("Completed")} disabled={lines.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40">
            <ClipboardCheck size={13} /> Complete
          </button>
          {editing && (
            <button onClick={() => handleDelete(editing.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Date bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 mb-4 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Verification Date</label>
          <input type="date" value={verificationDate} onChange={(e) => setVerificationDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto">
          <span>{lines.length} lines</span>
          {lines.filter((l) => l.difference > 0 && !l.isNewBatch).length > 0 && (
            <span className="text-green-600 font-semibold">
              ↑ {lines.filter((l) => l.difference > 0 && !l.isNewBatch).length} increases
            </span>
          )}
          {lines.filter((l) => l.difference < 0).length > 0 && (
            <span className="text-red-600 font-semibold">
              ↓ {lines.filter((l) => l.difference < 0).length} decreases
            </span>
          )}
          {lines.filter((l) => l.isNewBatch).length > 0 && (
            <span className="text-blue-600 font-semibold">
              + {lines.filter((l) => l.isNewBatch).length} new batches
            </span>
          )}
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Tab Header */}
        <div className="px-6 pt-5 border-b border-gray-200 bg-gray-50/30">
          <div className="flex gap-1">
            {([
              { id: "scan",  label: "Scan & Verify" },
              { id: "lines", label: `Verification Lines${lines.length > 0 ? ` (${lines.length})` : ""}` },
            ] as const).map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors -mb-px border-b-2 ${
                  activeTab === tab.id
                    ? "bg-white text-blue-700 border-blue-600"
                    : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/60"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">

          {/* ── SCAN TAB ── */}
          {activeTab === "scan" && (
            <div className="space-y-4">

              {/* Scan trigger */}
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">
                  Scan Item Batch
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={() => { setScanError(""); setShowScanner(true); }}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                    <Scan size={15} /> Scan Batch QR
                  </button>
                  <span className="text-xs text-gray-400">Scan a GRN batch QR label to load item details</span>
                </div>
                {scanError && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600">{scanError}</div>
                )}
              </div>

              {/* Scanned batch card */}
              {scannedBatch && (
                <div className="space-y-4">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2">
                    Batch Details
                  </p>

                  {/* Batch info grid */}
                  <div className="grid grid-cols-3 gap-3 bg-blue-50 border border-blue-100 rounded-xl p-5 text-xs">
                    <div className="col-span-3 pb-3 border-b border-blue-100">
                      <p className="text-gray-500 font-semibold uppercase tracking-wider mb-1">Internal Batch No.</p>
                      <p className="font-mono text-blue-700 font-bold text-sm break-all">{scannedBatch.batchNo}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Item</p>
                      <p className="font-semibold text-gray-800">{scannedBatch.itemName}</p>
                      <p className="font-mono text-blue-600 mt-0.5">{scannedBatch.itemCode}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Supplier Batch</p>
                      <p className="font-mono text-gray-700">{scannedBatch.supplierBatchNo || "—"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">GRN / Receipt</p>
                      <p className="font-mono text-blue-700">{scannedBatch.grnNo}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Item Group</p>
                      <p className="text-gray-700">{scannedBatch.itemGroup}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Sub Group</p>
                      <p className="text-gray-700">{scannedBatch.itemSubGroup}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Unit</p>
                      <p className="text-gray-700">{scannedBatch.stockUnit}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Warehouse</p>
                      <p className="text-gray-700">{scannedBatch.warehouseName}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Bin Location</p>
                      <p className="font-mono text-gray-700">{scannedBatch.bin}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">System Stock</p>
                      <p className="font-bold text-gray-800 text-sm">{scannedBatch.systemQty.toLocaleString()} {scannedBatch.stockUnit}</p>
                    </div>
                  </div>

                  {/* Physical qty entry */}
                  <div className="flex items-end gap-6">
                    <div className="flex-1 max-w-xs">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                        Physical Qty ({scannedBatch.stockUnit}) *
                      </label>
                      <input
                        type="number" min={0} step={0.01}
                        value={physicalQty || ""}
                        onChange={(e) => setPhysicalQty(Number(e.target.value))}
                        className={inputCls}
                        autoFocus
                      />
                    </div>

                    {/* Difference indicator */}
                    <div className="flex-1 max-w-xs">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Difference</label>
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-sm ${
                        diff > 0 ? "bg-green-50 border-green-200 text-green-700"
                        : diff < 0 ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-gray-50 border-gray-200 text-gray-500"
                      }`}>
                        {diff > 0 ? <TrendingUp size={16} /> : diff < 0 ? <TrendingDown size={16} /> : <Minus size={16} />}
                        {diff > 0 ? "+" : ""}{diff.toLocaleString()} {scannedBatch.stockUnit}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={addUpdateLine}
                      disabled={physicalQty === 0 && diff === 0}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40">
                      <CheckCircle2 size={15} />
                      {lines.some((l) => l.batchNo === scannedBatch.batchNo) ? "Update Line" : "Add to Verification"}
                    </button>
                    <button
                      onClick={() => setShowNewBatchModal(true)}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">
                      <PackagePlus size={15} /> New Stock
                    </button>
                    <button onClick={() => { setScannedBatch(null); setPhysicalQty(0); setScanError(""); }}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <X size={14} /> Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LINES TAB ── */}
          {activeTab === "lines" && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">
                  Verification Lines
                </p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs" style={{ minWidth: 1000 }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {[
                          "Batch No.", "Item Code", "Item Name", "Group", "Sub Group",
                          "Warehouse", "Bin", "GRN Ref.",
                          "System Qty", "Physical Qty", "Difference", "Type", "",
                        ].map((h, i) => (
                          <th key={i} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="text-center py-16 text-gray-400">
                            Go to the Scan & Verify tab to scan item batches.
                          </td>
                        </tr>
                      ) : lines.map((line, idx) => (
                        <tr key={line.lineId} className={`border-t border-gray-100 hover:bg-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-blue-700 font-semibold max-w-[180px]">
                            <span className="block truncate" title={line.batchNo}>{line.batchNo}</span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-blue-600 text-[10px] whitespace-nowrap">{line.itemCode}</td>
                          <td className="px-3 py-2.5 text-gray-800 max-w-[160px]">
                            <span className="block truncate">{line.itemName}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{line.itemGroup}</td>
                          <td className="px-3 py-2.5 text-gray-500 max-w-[120px]">
                            <span className="block truncate">{line.itemSubGroup}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{line.warehouseName}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{line.bin}</td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-blue-600">{line.grnNo || "—"}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600 font-semibold">
                            {line.isNewBatch ? "—" : line.systemQty.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-800">{line.physicalQty.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right">
                            {line.isNewBatch ? (
                              <span className="text-blue-600 font-semibold">New</span>
                            ) : (
                              <span className={`font-bold ${line.difference > 0 ? "text-green-600" : line.difference < 0 ? "text-red-600" : "text-gray-600"}`}>
                                {line.difference > 0 ? "+" : ""}{line.difference.toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {line.isNewBatch ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold whitespace-nowrap">
                                <PackagePlus size={9} /> New Batch
                              </span>
                            ) : line.difference > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">
                                <TrendingUp size={9} /> Increase
                              </span>
                            ) : line.difference < 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold">
                                <TrendingDown size={9} /> Decrease
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold">
                                Match
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={() => removeLine(line.lineId)} className="text-gray-300 hover:text-red-500">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remark */}
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Remark</p>
                <input value={remark} onChange={(e) => setRemark(e.target.value)}
                  placeholder="Optional notes…" className={inputCls} />
              </div>

              {/* Summary */}
              {lines.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-5 py-3 grid grid-cols-4 gap-3 text-xs">
                  <div className="text-center">
                    <p className="text-gray-500 uppercase tracking-wider mb-0.5">Total Lines</p>
                    <p className="font-bold text-gray-800 text-base">{lines.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 uppercase tracking-wider mb-0.5">Increases</p>
                    <p className="font-bold text-green-600 text-base">{lines.filter((l) => l.difference > 0 && !l.isNewBatch).length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 uppercase tracking-wider mb-0.5">Decreases</p>
                    <p className="font-bold text-red-600 text-base">{lines.filter((l) => l.difference < 0).length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 uppercase tracking-wider mb-0.5">New Batches</p>
                    <p className="font-bold text-blue-600 text-base">{lines.filter((l) => l.isNewBatch).length}</p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Modals ── */}
      {showScanner && (
        <ScannerModal title="Scan Batch QR" hint="Scan a GRN-generated batch QR label"
          onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {showNewBatchModal && scannedBatch && (
        <NewBatchModal
          scanned={scannedBatch}
          onConfirm={(line) => {
            setLines((prev) => [...prev, { lineId: Math.random().toString(36).slice(2), ...line }]);
            setShowNewBatchModal(false);
          }}
          onClose={() => setShowNewBatchModal(false)} />
      )}
    </div>
  );
}
