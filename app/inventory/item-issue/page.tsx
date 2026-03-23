"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import jsQR from "jsqr";
import {
  FileText, X, Scan, QrCode, CheckCircle2, Pencil,
  Trash2, Plus, Camera, Keyboard, Search, PackageMinus, List,
} from "lucide-react";
import {
  grnRecords,
  issueJobCards, IssueJobCard,
  itemIssues as initData, ItemIssue, ItemIssueLine,
  FLOOR_AREAS,
} from "@/data/dummyData";
import { inputCls } from "@/lib/styles";

// ─── Helpers ─────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const nextVoucherNo = (list: ItemIssue[]) => {
  const yr = new Date().getFullYear();
  return `ISS${String(list.length + 1).padStart(5, "0")}_${String(yr - 2000).padStart(2, "0")}_${String(yr - 1999).padStart(2, "0")}`;
};
const nextSlipNo = (date: string, seq: number) =>
  `SLIP-${date.replace(/-/g, "")}-${String(seq).padStart(3, "0")}`;

const STATUS_STYLE: Record<ItemIssue["status"], string> = {
  Draft:  "bg-gray-100 text-gray-600",
  Issued: "bg-green-100 text-green-700",
};

// ─── Parse scanned QR data ───────────────────────────────────
type ScannedBatch = {
  batchNo: string; supplierBatchNo: string;
  itemCode: string; itemName: string;
  grnNo: string; qty: number; unit: string;
  warehouseId: string; bin: string; warehouseName?: string;
};

function parseQR(raw: string): ScannedBatch | null {
  try {
    const d = JSON.parse(raw);
    if (!d.batchNo || !d.itemCode) return null;
    // Find the GRN line for richer data
    for (const grn of grnRecords) {
      const l = grn.lines.find((x) => x.batchNo === d.batchNo && x.itemCode === d.itemCode);
      if (l) {
        return {
          batchNo: l.batchNo, supplierBatchNo: l.supplierBatchNo,
          itemCode: l.itemCode, itemName: l.itemName,
          grnNo: grn.grnNo, qty: l.receivedQty, unit: l.stockUnit,
          warehouseId: l.warehouseId, bin: l.bin, warehouseName: l.warehouseName,
        };
      }
    }
    // Fallback: use QR data directly
    return {
      batchNo: d.batchNo, supplierBatchNo: d.supplierBatchNo ?? "",
      itemCode: d.itemCode, itemName: d.itemName ?? "",
      grnNo: d.grnNo ?? "", qty: d.qty ?? 0, unit: d.unit ?? "Kg",
      warehouseId: d.warehouseId ?? "", bin: d.bin ?? "",
    };
  } catch {
    return null;
  }
}

function parseJobCardQR(raw: string): { jobCardNo: string } | null {
  try {
    const d = JSON.parse(raw);
    if (d.jobCardNo) return { jobCardNo: d.jobCardNo };
  } catch { /* plain text */ }
  // Try plain text job card number
  if (raw.startsWith("JC-") || raw.startsWith("JC")) return { jobCardNo: raw.trim() };
  return null;
}

// ─── QR Scanner Modal ────────────────────────────────────────
function ScannerModal({
  title, hint, onScan, onClose,
}: {
  title: string; hint: string;
  onScan: (val: string) => void;
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
    setScanning(false);
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        intervalRef.current = setInterval(scan, 150);
      }
    } catch {
      setCameraError("Camera unavailable. Use manual entry.");
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
        <div className="bg-blue-600 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode size={16} />
            <div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-xs text-blue-200">{hint}</p>
            </div>
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
                      "bottom-0 left-0 border-b-4 border-l-4 rounded-bl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br"
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
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-2">
                Enter / Paste value
              </label>
              <textarea autoFocus value={manual} onChange={(e) => setManual(e.target.value)} rows={3}
                placeholder="Paste QR data or type value…"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono" />
            </div>
            <button onClick={() => { if (manual.trim()) onScan(manual.trim()); }}
              disabled={!manual.trim()}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40">
              Use This Value
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Job Card Picker Modal ────────────────────────────────────
function JobCardPickerModal({ onSelect, onClose }: {
  onSelect: (jc: IssueJobCard) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = issueJobCards.filter(
    (j) => j.status !== "Completed" &&
      (j.jobCardNo.toLowerCase().includes(search.toLowerCase()) ||
       j.product.toLowerCase().includes(search.toLowerCase()) ||
       j.customer.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-sm">Select Job Card</h3>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by job card no, product, customer…"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No open job cards found</div>
          ) : filtered.map((jc) => (
            <div key={jc.id} onClick={() => onSelect(jc)}
              className="px-5 py-3.5 border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm font-bold text-blue-700">{jc.jobCardNo}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${jc.status === "Open" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {jc.status}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-800">{jc.product}</p>
              <p className="text-xs text-gray-500">{jc.customer} · {fmtDate(jc.jobDate)} · {jc.machine}</p>
              <p className="text-xs text-gray-400 mt-1">{jc.items.length} items required</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Batch Confirm Modal ──────────────────────────────────────
function BatchConfirmModal({
  batch, requiredQty, seq, onConfirm, onClose,
}: {
  batch: ScannedBatch; requiredQty: number; seq: number;
  onConfirm: (line: Partial<ItemIssueLine>) => void;
  onClose: () => void;
}) {
  const [issueQty, setIssueQty] = useState(Math.min(requiredQty || batch.qty, batch.qty));
  const [toFloorId, setToFloorId] = useState("");
  const [toBin, setToBin] = useState("");

  const floor = FLOOR_AREAS.find((f) => f.id === toFloorId);
  const today = todayISO();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[540px] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-green-300" />
            <div>
              <p className="font-semibold text-sm">Batch Scanned — Confirm Issue</p>
              <p className="text-xs text-blue-200 font-mono">{batch.batchNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Batch info card */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Item</p>
              <p className="font-semibold text-gray-800">{batch.itemName}</p>
              <p className="font-mono text-blue-700">{batch.itemCode}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Internal Batch No.</p>
              <p className="font-mono text-blue-700 font-bold text-xs">{batch.batchNo}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Supplier Batch</p>
              <p className="font-mono text-gray-700">{batch.supplierBatchNo || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Available Stock</p>
              <p className="font-bold text-green-700 text-sm">{batch.qty.toLocaleString()} {batch.unit}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">From Warehouse</p>
              <p className="text-gray-700">{batch.warehouseName || batch.warehouseId}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">From Bin</p>
              <p className="text-gray-700 font-mono">{batch.bin}</p>
            </div>
          </div>

          {/* Issue details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Issue Qty ({batch.unit}) * <span className="text-gray-400 font-normal">max {batch.qty}</span>
              </label>
              <input type="number" min={0.01} max={batch.qty} step={0.01}
                value={issueQty}
                onChange={(e) => setIssueQty(Math.min(Number(e.target.value), batch.qty))}
                className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Slip No.</label>
              <input readOnly value={nextSlipNo(today, seq)} className={`${inputCls} bg-gray-50 font-mono text-blue-700`} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">To Floor / Work Area *</label>
              <select value={toFloorId} onChange={(e) => { setToFloorId(e.target.value); setToBin(""); }} className={inputCls}>
                <option value="">Select floor…</option>
                {FLOOR_AREAS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">To Bin *</label>
              <select value={toBin} onChange={(e) => setToBin(e.target.value)} disabled={!floor} className={inputCls}>
                <option value="">Select bin…</option>
                {floor?.bins.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* Slip info preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500 flex items-center justify-between">
            <span>Slip No: <span className="font-mono font-semibold text-blue-700">{nextSlipNo(today, seq)}</span></span>
            <span>Slip Date: <span className="font-semibold text-gray-700">{fmtDate(today)}</span></span>
          </div>
        </div>

        <div className="px-6 pb-5 flex items-center justify-between">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => {
              const f = FLOOR_AREAS.find((x) => x.id === toFloorId);
              onConfirm({
                itemCode: batch.itemCode, itemName: batch.itemName,
                batchNo: batch.batchNo, supplierBatchNo: batch.supplierBatchNo,
                grnNo: batch.grnNo, availableQty: batch.qty,
                issueQty, stockUnit: batch.unit,
                fromWarehouseId: batch.warehouseId,
                fromWarehouseName: batch.warehouseName ?? batch.warehouseId,
                fromBin: batch.bin,
                toFloorId, toFloorName: f?.name ?? "", toBin,
                slipNo: nextSlipNo(today, seq), slipDate: today,
                batchScanned: true,
              });
            }}
            disabled={!issueQty || !toFloorId || !toBin}
            className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            <PackageMinus size={15} /> Confirm Issue
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function ItemIssuePage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<ItemIssue[]>(initData);
  const [editing, setEditing] = useState<ItemIssue | null>(null);
  const [filterStatus, setFilterStatus] = useState<"All" | ItemIssue["status"]>("All");
  const [listSearch, setListSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"basic" | "scan" | "items">("basic");

  // Form state
  const [voucherDate, setVoucherDate] = useState(todayISO());
  const [issueMode, setIssueMode] = useState<"Job-wise" | "Item-wise">("Job-wise");
  const [jobCard, setJobCard] = useState<IssueJobCard | null>(null);
  const [lines, setLines] = useState<ItemIssueLine[]>([]);
  const [remark, setRemark] = useState("");

  // Scan / modal state
  const [showJobScanner, setShowJobScanner] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showItemScanner, setShowItemScanner] = useState<{ lineId: string | "new"; itemCode?: string } | null>(null);
  const [pendingBatch, setPendingBatch] = useState<{ batch: ScannedBatch; lineId: string | "new"; requiredQty: number } | null>(null);
  const [recentScans, setRecentScans] = useState<ItemIssueLine[]>([]);

  const currentVoucherNo = editing ? editing.voucherNo : nextVoucherNo(data);

  const resetForm = () => {
    setVoucherDate(todayISO()); setIssueMode("Job-wise"); setJobCard(null);
    setLines([]); setRemark(""); setRecentScans([]); setActiveTab("basic");
  };
  const openNew = () => { setEditing(null); resetForm(); setView("form"); };
  const openEdit = (iss: ItemIssue) => {
    setEditing(iss);
    setVoucherDate(iss.voucherDate); setIssueMode(iss.issueMode);
    setJobCard(iss.jobCardRef ? issueJobCards.find((j) => j.jobCardNo === iss.jobCardRef) ?? null : null);
    setLines(iss.lines.map((l) => ({ ...l })));
    setRemark(iss.remark);
    setRecentScans([]);
    setActiveTab("basic");
    setView("form");
  };
  const handleDelete = (id: string) => {
    if (confirm("Delete this Issue voucher?")) setData((d) => d.filter((r) => r.id !== id));
  };

  // Job card scanned / picked
  const handleJobCardScan = (raw: string) => {
    setShowJobScanner(false);
    const parsed = parseJobCardQR(raw);
    if (!parsed) { alert("Could not read job card from scan. Try manual entry."); return; }
    const jc = issueJobCards.find((j) => j.jobCardNo === parsed.jobCardNo);
    if (!jc) { alert(`Job card ${parsed.jobCardNo} not found.`); return; }
    loadJobCard(jc);
  };

  const loadJobCard = (jc: IssueJobCard) => {
    setJobCard(jc);
    setShowJobPicker(false);
    // Create pending lines for each job card item (batch not yet scanned)
    setLines(jc.items.map((item) => ({
      lineId: Math.random().toString(36).slice(2),
      itemCode: item.itemCode, itemName: item.itemName,
      itemGroup: "", subGroup: "",
      requiredQty: item.requiredQty, issueQty: 0, stockUnit: item.unit,
      batchNo: "", supplierBatchNo: "", grnNo: "", availableQty: 0,
      fromWarehouseId: "", fromWarehouseName: "", fromBin: "",
      toFloorId: "", toFloorName: "", toBin: "",
      slipNo: "", slipDate: "", batchScanned: false,
    })));
  };

  // Item batch scanned (from GRN QR)
  const handleBatchScan = (raw: string, lineId: string | "new", requiredQty: number) => {
    setShowItemScanner(null);
    const batch = parseQR(raw);
    if (!batch) {
      alert("Could not parse batch QR. Ensure you are scanning a GRN-generated QR label.");
      return;
    }
    // In job-wise mode, validate itemCode matches expected line
    if (lineId !== "new") {
      const line = lines.find((l) => l.lineId === lineId);
      if (line && line.itemCode && line.itemCode !== batch.itemCode) {
        if (!confirm(`Scanned item (${batch.itemCode}) does not match expected item (${line.itemCode}). Continue anyway?`)) return;
      }
    }
    setPendingBatch({ batch, lineId, requiredQty });
  };

  // Confirm issue from batch modal
  const confirmIssueLine = (lineId: string | "new", updates: Partial<ItemIssueLine>) => {
    setPendingBatch(null);
    if (lineId === "new") {
      // Item-wise: add new line
      const newLine: ItemIssueLine = {
        lineId: Math.random().toString(36).slice(2),
        itemCode: "", itemName: "", itemGroup: "", subGroup: "",
        requiredQty: 0, issueQty: 0, stockUnit: "Kg",
        batchNo: "", supplierBatchNo: "", grnNo: "", availableQty: 0,
        fromWarehouseId: "", fromWarehouseName: "", fromBin: "",
        toFloorId: "", toFloorName: "", toBin: "",
        slipNo: "", slipDate: "", batchScanned: false,
        ...updates,
      };
      setLines((prev) => [...prev, newLine]);
      setRecentScans((prev) => [newLine, ...prev].slice(0, 10));
    } else {
      setLines((prev) => prev.map((l) => {
        if (l.lineId === lineId) {
          const updated = { ...l, ...updates };
          setRecentScans((rs) => [updated, ...rs].slice(0, 10));
          return updated;
        }
        return l;
      }));
    }
  };

  const removeLine = (lineId: string) => setLines((prev) => prev.filter((l) => l.lineId !== lineId));

  const save = (status: ItemIssue["status"]) => {
    if (lines.length === 0) { alert("No items to issue."); return; }
    const iss: ItemIssue = {
      id: editing ? editing.id : `ISS${String(data.length + 1).padStart(3, "0")}`,
      voucherNo: currentVoucherNo, voucherDate,
      issueMode, jobCardRef: jobCard?.jobCardNo ?? "",
      jobCardData: jobCard ? { product: jobCard.product, customer: jobCard.customer, machine: jobCard.machine } : null,
      lines, remark, status,
    };
    if (editing) setData((d) => d.map((r) => r.id === editing.id ? iss : r));
    else setData((d) => [...d, iss]);
    setView("list");
  };

  const filteredData = (filterStatus === "All" ? data : data.filter((r) => r.status === filterStatus))
    .filter((r) => {
      if (!listSearch) return true;
      const s = listSearch.toLowerCase();
      return (
        r.voucherNo.toLowerCase().includes(s) ||
        r.jobCardRef.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
      );
    });
  const scannedCount = lines.filter((l) => l.batchScanned).length;

  // ══════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════
  if (view === "list") {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Item Issue</h2>
            <p className="text-sm text-gray-500">{filteredData.length} issue vouchers</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={16} /> New Issue
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Status</span>
            {(["All", "Draft", "Issued"] as const).map((s) => (
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
              placeholder="Search by voucher no, job card..."
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
            />
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Voucher No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Job Card</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product / Customer</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-gray-400">No issue vouchers found. Click &ldquo;New Issue&rdquo; to begin.</td></tr>
              ) : filteredData.map((iss, i) => (
                <tr key={iss.id} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{iss.voucherNo}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(iss.voucherDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${iss.issueMode === "Job-wise" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {iss.issueMode}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{iss.jobCardRef || "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {iss.jobCardData ? (
                      <div>
                        <p className="font-medium text-gray-800">{iss.jobCardData.product}</p>
                        <p className="text-gray-700">{iss.jobCardData.customer}</p>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-gray-700">{iss.lines.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[iss.status]}`}>{iss.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(iss)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors">
                        <Pencil size={11} /> Edit
                      </button>
                      <button onClick={() => handleDelete(iss.id)}
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
        {/* Left: company name, title, voucher badge, status badge */}
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs text-gray-400 font-medium">Inventory</p>
            <h2 className="text-lg font-bold text-gray-800 leading-tight">Item Issue</h2>
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

        {/* Right: action buttons */}
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
          <button onClick={() => save("Issued")}
            disabled={lines.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40">
            <PackageMinus size={13} /> Issue
          </button>
          {editing && (
            <button onClick={() => handleDelete(editing.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Content Card with Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Tab Header */}
        <div className="px-6 pt-5 border-b border-gray-200 bg-gray-50/30">
          <div className="flex gap-1">
            {([
              { id: "basic", label: "Basic" },
              { id: "scan",  label: "Scan" },
              { id: "items", label: `Items${lines.length > 0 ? ` (${lines.length})` : ""}` },
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

        {/* Tab Content */}
        <div className="p-6">

          {/* ── BASIC TAB ── */}
          {activeTab === "basic" && (
            <div className="space-y-4">
              {/* Section: Issue Details */}
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">
                  Issue Details
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Voucher No.</label>
                    <input readOnly value={currentVoucherNo}
                      className={`${inputCls} bg-blue-50 text-blue-700 font-mono font-semibold`} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Issue Date</label>
                    <input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Issue Mode</label>
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                      {(["Job-wise", "Item-wise"] as const).map((m) => (
                        <button key={m} onClick={() => { setIssueMode(m); setJobCard(null); setLines([]); }}
                          className={`flex-1 px-4 py-2 text-sm font-semibold transition-colors ${issueMode === m ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Job Card (Job-wise only) */}
              {issueMode === "Job-wise" && (
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">
                    Job Card
                  </p>
                  <div className="flex items-end gap-3">
                    <div className="w-56">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Job Card No.</label>
                      <input readOnly value={jobCard?.jobCardNo ?? ""} placeholder="Scan or pick a job card…"
                        className={`${inputCls} bg-gray-50 font-mono text-blue-700`} />
                    </div>
                    <button onClick={() => setShowJobScanner(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                      <Scan size={15} /> Scan QR
                    </button>
                    <button onClick={() => setShowJobPicker(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap">
                      <Search size={15} /> Pick
                    </button>
                  </div>

                  {/* Job card info card */}
                  {jobCard && (
                    <div className="mt-4 flex items-center gap-6 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-blue-600" />
                        <span className="font-mono font-bold text-blue-700 text-sm">{jobCard.jobCardNo}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold text-gray-700">{jobCard.product}</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="text-gray-600">{jobCard.customer}</span>
                      </div>
                      <div className="text-xs text-gray-500">{jobCard.machine} · {jobCard.operator}</div>
                      <div className="text-xs text-gray-500">{fmtDate(jobCard.jobDate)}</div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">{jobCard.status}</span>
                      <div className="ml-auto text-xs text-gray-500">
                        <span className="font-semibold text-blue-700">{scannedCount}/{lines.length}</span> batches scanned
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SCAN TAB ── */}
          {activeTab === "scan" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">
                  Scan Item Batches
                </p>

                {/* Item-wise: global scan button */}
                {issueMode === "Item-wise" && (
                  <div className="mb-5">
                    <button onClick={() => setShowItemScanner({ lineId: "new", itemCode: undefined })}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                      <Scan size={15} /> Scan Item Batch
                    </button>
                  </div>
                )}

                {/* Job-wise: show items list with per-row scan buttons */}
                {issueMode === "Job-wise" && (
                  <>
                    {!jobCard ? (
                      <div className="text-center py-12 text-gray-400 text-sm">
                        Go to the Basic tab to load a Job Card first.
                      </div>
                    ) : lines.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 text-sm">No items on this job card.</div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Required Qty</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue Qty</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch No.</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((line, idx) => (
                              <tr key={line.lineId} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-gray-800 text-sm">{line.itemName}</p>
                                  <p className="font-mono text-xs text-blue-600">{line.itemCode}</p>
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600">{line.requiredQty || "—"}</td>
                                <td className="px-4 py-3 text-right font-bold text-blue-700">{line.issueQty || "—"}</td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                                  {line.batchNo || <span className="text-gray-300 italic">Pending scan…</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {line.batchScanned ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                      <CheckCircle2 size={11} /> Scanned
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-xs font-semibold">
                                      Pending
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {!line.batchScanned && (
                                    <button onClick={() => setShowItemScanner({ lineId: line.lineId, itemCode: line.itemCode })}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors mx-auto">
                                      <Scan size={12} /> Scan
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Recently scanned batches */}
              {recentScans.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">
                    Recently Scanned Batches
                  </p>
                  <div className="space-y-2">
                    {recentScans.map((line, i) => (
                      <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-xs">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                          <div>
                            <p className="font-semibold text-gray-800">{line.itemName}</p>
                            <p className="font-mono text-blue-600">{line.batchNo}</p>
                          </div>
                        </div>
                        <div className="text-right text-gray-600">
                          <p className="font-bold text-blue-700">{line.issueQty} {line.stockUnit}</p>
                          <p className="text-gray-600">{line.slipNo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ITEMS TAB ── */}
          {activeTab === "items" && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">
                  Scanned Items
                </p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs" style={{ minWidth: 1200 }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {[
                          { l: "Item Code", r: false }, { l: "Item Name", r: false },
                          { l: "Req. Qty", r: true }, { l: "Issue Qty", r: true }, { l: "Unit", r: false },
                          { l: "Internal Batch No.", r: false }, { l: "Supplier Batch", r: false },
                          { l: "Avail. Stock", r: true },
                          { l: "From Warehouse", r: false }, { l: "From Bin", r: false },
                          { l: "To Floor / Area", r: false }, { l: "To Bin", r: false },
                          { l: "Slip No.", r: false }, { l: "Slip Date", r: false },
                          { l: "Status", r: false }, { l: "", r: false },
                        ].map((col, i) => (
                          <th key={i} className={`px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${col.r ? "text-right" : "text-left"}`}>
                            {col.l}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={16} className="text-center py-16 text-gray-400">
                            {issueMode === "Job-wise"
                              ? jobCard ? "Go to Scan tab to scan batch QR codes" : "Load a Job Card on the Basic tab"
                              : "Go to Scan tab to add items by scanning GRN QR labels"
                            }
                          </td>
                        </tr>
                      ) : lines.map((line, idx) => (
                        <tr key={line.lineId} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                          <td className="px-3 py-2.5 font-mono text-blue-700 font-semibold whitespace-nowrap">{line.itemCode}</td>
                          <td className="px-3 py-2.5 text-gray-800" style={{ maxWidth: 180 }}>{line.itemName}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600">{line.requiredQty || "—"}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-blue-700">{line.issueQty || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-700">{line.stockUnit}</td>
                          <td className="px-3 py-2.5 font-mono text-blue-600 text-[10px] whitespace-nowrap max-w-[160px] truncate">
                            {line.batchNo || <span className="text-gray-300 italic">Pending scan…</span>}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-gray-600">{line.supplierBatchNo || "—"}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-green-700">
                            {line.availableQty ? line.availableQty.toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{line.fromWarehouseName || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-700 font-mono">{line.fromBin || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{line.toFloorName || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-700 font-mono">{line.toBin || "—"}</td>
                          <td className="px-3 py-2.5 font-mono text-blue-600 whitespace-nowrap">{line.slipNo || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-700">{line.slipDate ? fmtDate(line.slipDate) : "—"}</td>
                          <td className="px-3 py-2.5">
                            {line.batchScanned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">
                                <CheckCircle2 size={10} /> Scanned
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-semibold">
                                Pending
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
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">
                  Remark
                </p>
                <input value={remark} onChange={(e) => setRemark(e.target.value)}
                  placeholder="Optional notes…"
                  className={inputCls} />
              </div>

              {/* Summary */}
              {lines.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500 flex items-center gap-4">
                  <span>{lines.length} items total</span>
                  <span>·</span>
                  <span className="font-semibold text-blue-700">{scannedCount}</span> scanned
                  {scannedCount < lines.length && (
                    <>
                      <span>·</span>
                      <span className="text-orange-500">{lines.length - scannedCount} pending</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Modals ── */}

      {/* Job Card Scanner */}
      {showJobScanner && (
        <ScannerModal
          title="Scan Job Card" hint="Scan the Job Card QR or barcode"
          onScan={handleJobCardScan}
          onClose={() => setShowJobScanner(false)}
        />
      )}

      {/* Job Card Picker */}
      {showJobPicker && (
        <JobCardPickerModal onSelect={loadJobCard} onClose={() => setShowJobPicker(false)} />
      )}

      {/* Item Batch Scanner */}
      {showItemScanner && (
        <ScannerModal
          title="Scan Item Batch QR"
          hint={showItemScanner.itemCode ? `Scanning for: ${showItemScanner.itemCode}` : "Scan GRN-generated batch QR label"}
          onScan={(raw) => handleBatchScan(raw, showItemScanner.lineId, lines.find((l) => l.lineId === showItemScanner.lineId)?.requiredQty ?? 0)}
          onClose={() => setShowItemScanner(null)}
        />
      )}

      {/* Batch Confirm Modal */}
      {pendingBatch && (
        <BatchConfirmModal
          batch={pendingBatch.batch}
          requiredQty={pendingBatch.requiredQty}
          seq={lines.filter((l) => l.batchScanned).length + 1}
          onConfirm={(updates) => confirmIssueLine(pendingBatch.lineId, updates)}
          onClose={() => setPendingBatch(null)}
        />
      )}
    </div>
  );
}
