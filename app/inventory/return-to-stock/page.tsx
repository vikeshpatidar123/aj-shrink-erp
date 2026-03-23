"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import jsQR from "jsqr";
import {
  X, Scan, QrCode, CheckCircle2, Pencil,
  Trash2, Plus, Camera, Keyboard, Search, RotateCcw, List, FileText,
} from "lucide-react";
import {
  grnRecords,
  itemGroups, ItemGroup,
  subGroups,
  rawMaterials,
  issueJobCards, IssueJobCard,
  itemIssues,
  WAREHOUSES,
  returnToStocks as initData, ReturnToStock, ReturnToStockLine,
} from "@/data/dummyData";
import { inputCls } from "@/lib/styles";

// ─── Helpers ─────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const nextVoucherNo = (list: ReturnToStock[]) => {
  const yr = new Date().getFullYear();
  return `RTS${String(list.length + 1).padStart(5, "0")}_${String(yr - 2000).padStart(2, "0")}_${String(yr - 1999).padStart(2, "0")}`;
};

const STATUS_STYLE: Record<ReturnToStock["status"], string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Completed: "bg-green-100 text-green-700",
};

// Lookup batch info from GRN records by batchNo or itemCode
type ScannedItem = {
  itemCode: string; itemName: string; stockUnit: string; batchNo: string;
};
function parseScanQR(raw: string): ScannedItem | null {
  try {
    const d = JSON.parse(raw);
    if (!d.itemCode) return null;
    for (const grn of grnRecords) {
      const l = grn.lines.find((x) => x.batchNo === d.batchNo && x.itemCode === d.itemCode);
      if (l) return { itemCode: l.itemCode, itemName: l.itemName, stockUnit: l.stockUnit, batchNo: l.batchNo };
    }
    return { itemCode: d.itemCode, itemName: d.itemName ?? "", stockUnit: d.unit ?? "Kg", batchNo: d.batchNo ?? "" };
  } catch {
    // Try as plain item code
    const rm = rawMaterials.find((r) => r.code === raw.trim());
    if (rm) return { itemCode: rm.code, itemName: rm.name, stockUnit: rm.stockUnit, batchNo: "" };
    return null;
  }
}

function parseJobCardQR(raw: string): { jobCardNo: string } | null {
  try {
    const d = JSON.parse(raw);
    if (d.jobCardNo) return { jobCardNo: d.jobCardNo };
  } catch { /* plain text */ }
  if (raw.startsWith("JC-") || raw.startsWith("JC")) return { jobCardNo: raw.trim() };
  return null;
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
    streamRef.current = null;
    setScanning(false);
  }, []);

  const scan = useCallback(() => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) return;
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
                placeholder="Paste QR data or type value…"
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

// ─── Job Card Picker Modal ────────────────────────────────────
function JobCardPickerModal({ onSelect, onClose }: {
  onSelect: (jc: IssueJobCard) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = issueJobCards.filter(
    (j) => j.jobCardNo.toLowerCase().includes(search.toLowerCase()) ||
      j.product.toLowerCase().includes(search.toLowerCase()) ||
      j.customer.toLowerCase().includes(search.toLowerCase())
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
          {filtered.length === 0
            ? <div className="text-center py-12 text-gray-400">No job cards found</div>
            : filtered.map((jc) => (
              <div key={jc.id} onClick={() => onSelect(jc)}
                className="px-5 py-3.5 border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm font-bold text-blue-700">{jc.jobCardNo}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${jc.status === "Open" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{jc.status}</span>
                </div>
                <p className="text-sm font-medium text-gray-800">{jc.product}</p>
                <p className="text-xs text-gray-500">{jc.customer} · {fmtDate(jc.jobDate)} · {jc.machine}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Return Line Confirm Modal ────────────────────────────────
function ReturnLineModal({
  item, jobCardRef, onConfirm, onClose,
}: {
  item: ScannedItem; jobCardRef: string;
  onConfirm: (line: Omit<ReturnToStockLine, "lineId">) => void;
  onClose: () => void;
}) {
  const [returnQty, setReturnQty] = useState<number>(0);
  const [warehouseId, setWarehouseId] = useState("");
  const [bin, setBin] = useState("");
  const [lineRemark, setLineRemark] = useState("");

  const wh = WAREHOUSES.find((w) => w.id === warehouseId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[500px] overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-green-300" />
            <div>
              <p className="font-semibold text-sm">Confirm Return to Stock</p>
              <p className="text-xs text-blue-200 font-mono">{item.itemCode}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Item info */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Item</p>
              <p className="font-semibold text-gray-800">{item.itemName}</p>
              <p className="font-mono text-blue-700">{item.itemCode}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Batch No.</p>
              <p className="font-mono text-blue-700 font-bold">{item.batchNo || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Unit</p>
              <p className="text-gray-700">{item.stockUnit}</p>
            </div>
            {jobCardRef && (
              <div>
                <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Job Card Ref.</p>
                <p className="font-mono text-blue-600">{jobCardRef}</p>
              </div>
            )}
          </div>

          {/* Return details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Return Qty ({item.stockUnit}) *</label>
              <input type="number" min={0.01} step={0.01} value={returnQty || ""}
                onChange={(e) => setReturnQty(Number(e.target.value))}
                className={inputCls} autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Warehouse *</label>
              <select value={warehouseId}
                onChange={(e) => { setWarehouseId(e.target.value); setBin(""); }}
                className={inputCls}>
                <option value="">Select warehouse…</option>
                {WAREHOUSES.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Bin *</label>
              <select value={bin} onChange={(e) => setBin(e.target.value)} disabled={!wh}
                className={inputCls}>
                <option value="">Select bin…</option>
                {wh?.bins.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Line Remark</label>
              <input value={lineRemark} onChange={(e) => setLineRemark(e.target.value)}
                placeholder="Optional…" className={inputCls} />
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 flex items-center justify-between">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => {
              if (!returnQty || !warehouseId || !bin) return;
              const w = WAREHOUSES.find((x) => x.id === warehouseId);
              onConfirm({
                itemCode: item.itemCode, itemName: item.itemName, stockUnit: item.stockUnit,
                batchNo: item.batchNo, returnQty, warehouseId,
                warehouseName: w?.name ?? "", bin, jobCardRef, remark: lineRemark,
              });
            }}
            disabled={!returnQty || !warehouseId || !bin}
            className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            <RotateCcw size={15} /> Add to Return
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Item Search Modal (Item-wise) ────────────────────────────
function ItemSearchModal({ groupId, subGroupId, onSelect, onClose }: {
  groupId: string; subGroupId: string;
  onSelect: (item: ScannedItem) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = rawMaterials.filter((r) => {
    const sg = subGroupId ? r.subGroupId === subGroupId : true;
    const grpName = itemGroups.find((g) => g.id === groupId)?.name ?? "";
    const grp = groupId ? (subGroups.find((s) => s.id === r.subGroupId)?.group === grpName) : true;
    const q = search.toLowerCase();
    const matchSearch = !search || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
    return sg && grp && matchSearch && r.status === "Active";
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[620px] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-sm">Select Item</h3>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item code or name…"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0
            ? <div className="text-center py-12 text-gray-400">No items found</div>
            : filtered.map((r) => (
              <div key={r.id} onClick={() => onSelect({ itemCode: r.code, itemName: r.name, stockUnit: r.stockUnit, batchNo: "" })}
                className="px-5 py-3 border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-blue-700 w-32 shrink-0">{r.code}</span>
                  <span className="text-sm text-gray-800">{r.name}</span>
                  <span className="ml-auto text-xs text-gray-400">{r.stockUnit}</span>
                </div>
                <p className="text-xs text-gray-400 ml-[140px]">{r.subGroupName}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function ReturnToStockPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<ReturnToStock[]>(initData);
  const [editing, setEditing] = useState<ReturnToStock | null>(null);
  const [filterStatus, setFilterStatus] = useState<"All" | ReturnToStock["status"]>("All");
  const [listSearch, setListSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"basic" | "scan" | "lines">("basic");

  // Form state
  const [returnDate, setReturnDate] = useState(todayISO());
  const [returnMode, setReturnMode] = useState<"Job-wise" | "Item-wise">("Job-wise");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedSubGroupId, setSelectedSubGroupId] = useState("");
  const [jobCard, setJobCard] = useState<IssueJobCard | null>(null);
  const [lines, setLines] = useState<ReturnToStockLine[]>([]);
  const [remark, setRemark] = useState("");

  // Modal state
  const [showJobScanner, setShowJobScanner] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showItemScanner, setShowItemScanner] = useState(false);
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [pendingItem, setPendingItem] = useState<ScannedItem | null>(null);

  const currentVoucherNo = editing ? editing.voucherNo : nextVoucherNo(data);

  // Derived
  const selectedGroup = itemGroups.find((g) => g.id === selectedGroupId);
  const filteredSubGroups = subGroups.filter(
    (s) => selectedGroup ? s.group === selectedGroup.name : true
  );

  // Job card issued items (for job-wise return)
  const issuedLinesForJob = jobCard
    ? itemIssues.filter((iss) => iss.jobCardRef === jobCard.jobCardNo).flatMap((iss) => iss.lines)
    : [];

  const resetForm = () => {
    setReturnDate(todayISO()); setReturnMode("Job-wise");
    setSelectedGroupId(""); setSelectedSubGroupId("");
    setJobCard(null); setLines([]); setRemark("");
    setActiveTab("basic");
  };

  const openNew = () => { setEditing(null); resetForm(); setView("form"); };
  const openEdit = (rec: ReturnToStock) => {
    setEditing(rec);
    setReturnDate(rec.returnDate); setReturnMode(rec.returnMode);
    setSelectedGroupId(rec.itemGroupId); setSelectedSubGroupId(rec.itemSubGroupId);
    setJobCard(rec.jobCardRef ? issueJobCards.find((j) => j.jobCardNo === rec.jobCardRef) ?? null : null);
    setLines(rec.lines.map((l) => ({ ...l })));
    setRemark(rec.remark);
    setActiveTab("basic");
    setView("form");
  };
  const handleDelete = (id: string) => {
    if (confirm("Delete this Return to Stock voucher?")) setData((d) => d.filter((r) => r.id !== id));
  };

  const handleJobCardScan = (raw: string) => {
    setShowJobScanner(false);
    const parsed = parseJobCardQR(raw);
    if (!parsed) { alert("Could not read job card from scan. Try manual entry."); return; }
    const jc = issueJobCards.find((j) => j.jobCardNo === parsed.jobCardNo);
    if (!jc) { alert(`Job card ${parsed.jobCardNo} not found.`); return; }
    setJobCard(jc); setLines([]);
  };

  const handleItemScan = (raw: string) => {
    setShowItemScanner(false);
    const item = parseScanQR(raw);
    if (!item) { alert("Could not parse item from scan. Try manual entry or pick from list."); return; }
    setPendingItem(item);
  };

  const addLine = (lineData: Omit<ReturnToStockLine, "lineId">) => {
    setPendingItem(null);
    setLines((prev) => [...prev, { lineId: Math.random().toString(36).slice(2), ...lineData }]);
  };

  const removeLine = (lineId: string) => setLines((prev) => prev.filter((l) => l.lineId !== lineId));

  const save = (status: ReturnToStock["status"]) => {
    if (lines.length === 0) { alert("No return lines added."); return; }
    const rec: ReturnToStock = {
      id: editing ? editing.id : `RTS${String(data.length + 1).padStart(3, "0")}`,
      voucherNo: currentVoucherNo, returnDate, returnMode,
      itemGroupId: selectedGroupId,
      itemGroupName: selectedGroup?.name ?? "",
      itemSubGroupId: selectedSubGroupId,
      itemSubGroupName: filteredSubGroups.find((s) => s.id === selectedSubGroupId)?.name ?? "",
      jobCardRef: jobCard?.jobCardNo ?? "",
      jobCardData: jobCard ? { product: jobCard.product, customer: jobCard.customer, machine: jobCard.machine } : null,
      lines, remark, status,
    };
    if (editing) setData((d) => d.map((r) => r.id === editing.id ? rec : r));
    else setData((d) => [...d, rec]);
    setView("list");
  };

  const filteredData = (filterStatus === "All" ? data : data.filter((r) => r.status === filterStatus))
    .filter((r) => {
      if (!listSearch) return true;
      const s = listSearch.toLowerCase();
      return (
        r.voucherNo.toLowerCase().includes(s) ||
        r.jobCardRef.toLowerCase().includes(s) ||
        r.itemGroupName.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
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
            <h2 className="text-xl font-bold text-gray-800">Return to Stock</h2>
            <p className="text-sm text-gray-500">{filteredData.length} return vouchers</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={16} /> New Return
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
              placeholder="Search by voucher no, job card, item group..."
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
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item Group</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Job Card</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Lines</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-gray-400">No return vouchers found. Click &ldquo;New Return&rdquo; to begin.</td></tr>
              ) : filteredData.map((rec, i) => (
                <tr key={rec.id} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{rec.voucherNo}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(rec.returnDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${rec.returnMode === "Job-wise" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {rec.returnMode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {rec.itemGroupName || "—"}
                    {rec.itemSubGroupName && <span className="text-gray-600"> / {rec.itemSubGroupName}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{rec.jobCardRef || "—"}</td>
                  <td className="px-4 py-3 text-center font-medium text-gray-700">{rec.lines.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[rec.status]}`}>{rec.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(rec)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors">
                        <Pencil size={11} /> Edit
                      </button>
                      <button onClick={() => handleDelete(rec.id)}
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
            <h2 className="text-lg font-bold text-gray-800 leading-tight">Return to Stock</h2>
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
            <RotateCcw size={13} /> Save
          </button>
          {editing && (
            <button onClick={() => handleDelete(editing.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Tab Header */}
        <div className="px-6 pt-5 border-b border-gray-200 bg-gray-50/30">
          <div className="flex gap-1">
            {([
              { id: "basic", label: "Basic" },
              { id: "scan",  label: "Scan / Add" },
              { id: "lines", label: `Lines${lines.length > 0 ? ` (${lines.length})` : ""}` },
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

          {/* ── BASIC TAB ── */}
          {activeTab === "basic" && (
            <div className="space-y-4">

              {/* Return Details */}
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Return Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Voucher No.</label>
                    <input readOnly value={currentVoucherNo} className={`${inputCls} bg-blue-50 text-blue-700 font-mono font-semibold`} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Return Date</label>
                    <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Item Classification */}
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Item Classification</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Item Group</label>
                    <select value={selectedGroupId}
                      onChange={(e) => { setSelectedGroupId(e.target.value); setSelectedSubGroupId(""); }}
                      className={inputCls}>
                      <option value="">All Groups</option>
                      {itemGroups.filter((g) => g.status === "Active").map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Item Sub Group</label>
                    <select value={selectedSubGroupId} onChange={(e) => setSelectedSubGroupId(e.target.value)}
                      disabled={!selectedGroupId}
                      className={inputCls}>
                      <option value="">All Sub Groups</option>
                      {filteredSubGroups.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Return Mode */}
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Return Mode</p>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden w-64">
                  {(["Job-wise", "Item-wise"] as const).map((m) => (
                    <button key={m} onClick={() => { setReturnMode(m); setJobCard(null); setLines([]); }}
                      className={`flex-1 px-4 py-2 text-sm font-semibold transition-colors ${returnMode === m ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Job Card (Job-wise only) */}
              {returnMode === "Job-wise" && (
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Job Card</p>
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
                      <div className="text-xs text-gray-500">{jobCard.machine}</div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${jobCard.status === "Open" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                        {jobCard.status}
                      </span>
                      {issuedLinesForJob.length > 0 && (
                        <div className="ml-auto text-xs text-gray-500">
                          <span className="font-semibold text-blue-700">{issuedLinesForJob.length}</span> issued item lines
                        </div>
                      )}
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
                  {returnMode === "Job-wise" ? "Add Items from Job Card" : "Scan / Pick Item"}
                </p>

                {/* Job-wise: show issued items table */}
                {returnMode === "Job-wise" && (
                  <>
                    {!jobCard ? (
                      <div className="text-center py-12 text-gray-400 text-sm">Go to the Basic tab to load a Job Card first.</div>
                    ) : issuedLinesForJob.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm">
                        No issued items found for this job card. Use Item-wise mode to add items manually.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch No.</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Issued Qty</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {issuedLinesForJob.map((il, idx) => {
                              const alreadyAdded = lines.some((l) => l.batchNo === il.batchNo && l.itemCode === il.itemCode);
                              return (
                                <tr key={idx} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"} ${alreadyAdded ? "opacity-50" : ""}`}>
                                  <td className="px-4 py-3">
                                    <p className="font-semibold text-gray-800 text-sm">{il.itemName}</p>
                                    <p className="font-mono text-xs text-blue-600">{il.itemCode}</p>
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{il.batchNo || "—"}</td>
                                  <td className="px-4 py-3 text-right text-gray-600">{il.issueQty}</td>
                                  <td className="px-4 py-3 text-gray-500 text-xs">{il.stockUnit}</td>
                                  <td className="px-4 py-3 text-center">
                                    {alreadyAdded ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                        <CheckCircle2 size={10} /> Added
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => setPendingItem({
                                          itemCode: il.itemCode, itemName: il.itemName,
                                          stockUnit: il.stockUnit, batchNo: il.batchNo,
                                        })}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors mx-auto">
                                        <Plus size={12} /> Return
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* Item-wise: scan / pick buttons */}
                {returnMode === "Item-wise" && (
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowItemScanner(true)}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                      <Scan size={15} /> Scan Item QR
                    </button>
                    <button onClick={() => setShowItemSearch(true)}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">
                      <Search size={15} /> Pick from List
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── LINES TAB ── */}
          {activeTab === "lines" && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Return Lines</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {[
                          { l: "Item Code" }, { l: "Item Name" },
                          { l: "Batch No." }, { l: "Return Qty", r: true }, { l: "Unit" },
                          { l: "Warehouse" }, { l: "Bin" }, { l: "Job Card Ref." }, { l: "Remark" }, { l: "" },
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
                          <td colSpan={10} className="text-center py-16 text-gray-400">
                            Go to the Scan / Add tab to add return lines.
                          </td>
                        </tr>
                      ) : lines.map((line, idx) => (
                        <tr key={line.lineId} className={`border-t border-gray-100 hover:bg-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                          <td className="px-3 py-2.5 font-mono text-blue-700 font-semibold whitespace-nowrap">{line.itemCode}</td>
                          <td className="px-3 py-2.5 text-gray-800" style={{ maxWidth: 180 }}>{line.itemName}</td>
                          <td className="px-3 py-2.5 font-mono text-blue-600 text-[10px]">{line.batchNo || "—"}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-blue-700">{line.returnQty}</td>
                          <td className="px-3 py-2.5 text-gray-500">{line.stockUnit}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{line.warehouseName}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{line.bin}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-blue-600">{line.jobCardRef || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-700">{line.remark || "—"}</td>
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

              {lines.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500">
                  {lines.length} return line{lines.length > 1 ? "s" : ""} ·{" "}
                  Total:{" "}
                  <span className="font-semibold text-blue-700">
                    {lines.reduce((s, l) => s + l.returnQty, 0).toLocaleString()} units
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Modals ── */}

      {showJobScanner && (
        <ScannerModal title="Scan Job Card" hint="Scan the Job Card QR or barcode"
          onScan={handleJobCardScan} onClose={() => setShowJobScanner(false)} />
      )}

      {showJobPicker && (
        <JobCardPickerModal onSelect={(jc) => { setJobCard(jc); setLines([]); setShowJobPicker(false); }}
          onClose={() => setShowJobPicker(false)} />
      )}

      {showItemScanner && (
        <ScannerModal title="Scan Item QR" hint="Scan GRN batch QR or item barcode"
          onScan={handleItemScan} onClose={() => setShowItemScanner(false)} />
      )}

      {showItemSearch && (
        <ItemSearchModal
          groupId={selectedGroupId} subGroupId={selectedSubGroupId}
          onSelect={(item) => { setShowItemSearch(false); setPendingItem(item); }}
          onClose={() => setShowItemSearch(false)} />
      )}

      {pendingItem && (
        <ReturnLineModal
          item={pendingItem}
          jobCardRef={returnMode === "Job-wise" ? (jobCard?.jobCardNo ?? "") : ""}
          onConfirm={addLine}
          onClose={() => setPendingItem(null)} />
      )}
    </div>
  );
}
