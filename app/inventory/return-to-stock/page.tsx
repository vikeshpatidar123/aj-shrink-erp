"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import jsQR from "jsqr";
import {
  X, Scan, QrCode, CheckCircle2, Pencil, Trash2, Plus,
  Camera, Keyboard, Search, RotateCcw, RefreshCw, AlertCircle,
  History,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";
import { Input, Select, Textarea } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { DataTable, Column } from "@/components/tables/DataTable";

const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{title}</h3>
);

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";

async function apiFetch(url: string): Promise<any> {
  const res = await fetch(url, { headers: authHeaders() });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}
function unwrap(raw: any): string {
  if (typeof raw !== "string") return String(raw ?? "");
  const t = raw.trim();
  if (t.startsWith('"') && t.endsWith('"')) { try { return JSON.parse(t); } catch {} }
  return t;
}
const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const p = new Date(iso);
  return isNaN(p.getTime()) ? iso : p.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Types ───────────────────────────────────────────────────

type RTSRecord = {
  TransactionID: number;
  VoucherNo: string;
  VoucherDate: string;
  JobCardNo?: string;
  JobName?: string;
  DepartmentName?: string;
  ItemCode?: string;
  ItemName?: string;
  StockUnit?: string;
  ReturnQuantity?: number;
  BatchNo?: string;
  Warehouse?: string;
  CreatedBy?: string;
  Narration?: string;
  IssueVoucherNo?: string;
  _itemCount?: number;
  _totalQty?: number;
};

type JobCardRow = {
  JobBookingID: number;
  JobBookingJobCardContentsID: number;
  JobCardContentNo: string;
  JobName: string;
  PlanContName: string;
  JobBookingNo?: string;
};

type FloorStockItem = {
  rowId: string;
  TransactionID: number;
  ParentTransactionID: number;
  ItemID: number;
  ItemGroupID: number;
  ItemCode: string;
  ItemName: string;
  StockUnit: string;
  BatchID: number;
  BatchNo: string;
  SupplierBatchNo: string;
  MfgDate: string;
  ExpiryDate: string;
  IssueQuantity: number;
  ConsumeQuantity: number;
  FloorStock: number;
  JobBookingID: number;
  JobBookingJobCardContentsID: number;
  MachineID: number;
  ProcessID: number;
  DepartmentID: number;
  FloorWarehouseID: number;
  WarehouseName: string;
  Bin: string;
  JobCardNo: string;
  VoucherNo: string;
};

type ReturnLine = {
  lineId: string;
  TransactionDetailID: number;
  IssueTransactionID: number;
  ParentTransactionID: number;
  ItemID: number;
  ItemGroupID: number;
  ItemCode: string;
  ItemName: string;
  StockUnit: string;
  BatchID: number;
  BatchNo: string;
  SupplierBatchNo: string;
  MfgDate: string;
  ExpiryDate: string;
  FloorStock: number;
  JobBookingID: number;
  JobBookingJobCardContentsID: number;
  MachineID: number;
  ProcessID: number;
  DepartmentID: number;
  FloorWarehouseID: number;
  ReturnQuantity: number;
  DestWarehouseID: number;
  DestWarehouseName: string;
  DestBinName: string;
  IssueVoucherNo: string;
  JobCardNo: string;
};

type WarehouseOption = { Warehouse: string };
type BinOption = { Bin: string; WarehouseID: number };

// ─── Scanner Modal ────────────────────────────────────────────
function ScannerModal({ title, hint, onScan, onClose }: {
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
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
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

  useEffect(() => {
    let active = true;
    if (mode === "camera") {
      setCameraError("");
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().then(() => {
              setScanning(true);
              intervalRef.current = setInterval(scan, 150);
            });
          }
        })
        .catch(() => { if (active) { setCameraError("Camera unavailable. Use manual entry."); setMode("manual"); } });
    }
    return () => { active = false; stopCamera(); };
  }, [mode, scan, stopCamera]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[700px] overflow-hidden">
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
          {([{ m: "camera" as const, icon: Camera, label: "Camera Scan" }, { m: "manual" as const, icon: Keyboard, label: "Manual Entry" }])
            .map(({ m, icon: Icon, label }) => (
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
              </div>
            )}
          </div>
        )}
        {mode === "manual" && (
          <div className="p-5 space-y-4">
            <Textarea autoFocus value={manual} onChange={(e) => setManual(e.target.value)} rows={3}
              placeholder="Paste QR data or type value…" />
            <Button className="w-full" onClick={() => { if (manual.trim()) onScan(manual.trim()); }} disabled={!manual.trim()}>
              Use This Value
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Job Card Picker Modal ────────────────────────────────────
function JobCardPickerModal({ onSelect, onClose }: {
  onSelect: (jc: JobCardRow) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<JobCardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`${BASE_URL}/api/ReturntoStockAJ/JobCardRender`)
      .then((d) => { if (Array.isArray(d)) setRows(d); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((j) => {
    const s = search.toLowerCase();
    return !s || j.JobCardContentNo?.toLowerCase().includes(s) || j.JobName?.toLowerCase().includes(s) || j.PlanContName?.toLowerCase().includes(s);
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[1300px] max-h-[85vh] flex flex-col overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-sm">Select Job Card</h3>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by job card no, job name, content…"
              className="w-full pl-9" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No job cards found</div>
          ) : filtered.map((jc, i) => (
            <div key={`${jc.JobBookingJobCardContentsID}-${i}`} onClick={() => onSelect(jc)}
              className="px-5 py-3.5 border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-mono text-sm font-bold text-blue-700">{jc.JobCardContentNo}</span>
                <span className="text-xs text-gray-400">#{jc.JobBookingNo}</span>
              </div>
              <p className="text-sm font-medium text-gray-800">{jc.JobName}</p>
              <p className="text-xs text-gray-500">{jc.PlanContName}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Return Confirm Modal ─────────────────────────────────────
function ReturnConfirmModal({ item, warehouses, onConfirm, onClose }: {
  item: FloorStockItem;
  warehouses: WarehouseOption[];
  onConfirm: (returnQty: number, warehouseID: number, warehouseName: string, binName: string) => void;
  onClose: () => void;
}) {
  const [returnQtyStr, setReturnQtyStr] = useState(String(item.FloorStock > 0 ? item.FloorStock : ""));
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [bins, setBins] = useState<BinOption[]>([]);
  const [selectedBinID, setSelectedBinID] = useState(0);
  const [selectedBinName, setSelectedBinName] = useState("");
  const [loadingBins, setLoadingBins] = useState(false);

  const returnQty = parseFloat(returnQtyStr) || 0;
  const exceedsFloor = item.FloorStock > 0 && returnQty > item.FloorStock;
  const canConfirm = returnQty > 0 && !exceedsFloor && selectedWarehouse && selectedBinID > 0;

  const loadBins = async (wh: string) => {
    setSelectedWarehouse(wh);
    setSelectedBinID(0);
    setSelectedBinName("");
    setBins([]);
    if (!wh) return;
    setLoadingBins(true);
    const d = await apiFetch(`${BASE_URL}/api/ReturntoStockAJ/GetBinsList?warehousename=${encodeURIComponent(wh)}`);
    if (Array.isArray(d)) setBins(d);
    setLoadingBins(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[700px] overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <RotateCcw size={16} className="text-blue-200" />
            <div>
              <p className="font-semibold text-sm">Return to Stock — Enter Details</p>
              <p className="text-xs text-blue-200 font-mono">{item.BatchNo || item.ItemCode}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Item info */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Item</p>
              <p className="font-semibold text-gray-800">{item.ItemName}</p>
              <p className="font-mono text-blue-700">{item.ItemCode}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Batch No.</p>
              <p className="font-mono text-blue-700 font-bold">{item.BatchNo || "—"}</p>
              {item.SupplierBatchNo && <p className="text-gray-500">{item.SupplierBatchNo}</p>}
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Issue Voucher</p>
              <p className="font-mono text-gray-700">{item.VoucherNo || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Issued Qty</p>
              <p className="font-bold text-gray-700 text-sm">{item.IssueQuantity.toLocaleString()} {item.StockUnit}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Consumed</p>
              <p className="font-bold text-orange-600 text-sm">{item.ConsumeQuantity.toLocaleString()} {item.StockUnit}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Floor Stock (Available)</p>
              <p className={`font-bold text-sm ${item.FloorStock > 0 ? "text-green-700" : "text-red-600"}`}>
                {item.FloorStock > 0 ? `${item.FloorStock.toLocaleString()} ${item.StockUnit}` : "No stock"}
              </p>
            </div>
          </div>

          {/* Return Qty */}
          <div>
            <Input label={`Return Qty (${item.StockUnit}) *`} type="number" min={0.001} step={0.001} autoFocus
              value={returnQtyStr}
              onChange={(e) => setReturnQtyStr(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
            {exceedsFloor && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> Cannot exceed floor stock ({item.FloorStock} {item.StockUnit})
              </p>
            )}
          </div>

          {/* Destination Warehouse */}
          <Select label="Destination Warehouse *" value={selectedWarehouse} onChange={(e) => loadBins(e.target.value)}
            options={[{ value: "", label: "— Select Warehouse —" }, ...warehouses.map((w) => ({ value: w.Warehouse, label: w.Warehouse }))]} />

          {/* Destination Bin */}
          <Select label="Destination Bin *" value={String(selectedBinID)}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedBinID(id);
              const bin = bins.find((b) => b.WarehouseID === id);
              setSelectedBinName(bin?.Bin || "");
            }}
            disabled={!selectedWarehouse || loadingBins}
            options={[{ value: "0", label: loadingBins ? "Loading…" : "— Select Bin —" }, ...bins.map((b) => ({ value: String(b.WarehouseID), label: b.Bin }))]} />
        </div>

        <div className="px-6 pb-5 flex items-center justify-between">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (canConfirm) onConfirm(returnQty, selectedBinID, selectedWarehouse, selectedBinName); }}
            disabled={!canConfirm}>
            <RotateCcw size={15} /> Confirm Return
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function ReturnToStockPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editingID, setEditingID] = useState<number | null>(null);

  // List — date filter handled entirely by the grid's own built-in date-filter icon
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [listData, setListData] = useState<RTSRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  // Form
  const [currentVoucherNo, setCurrentVoucherNo] = useState("…");
  const [voucherDate, setVoucherDate] = useState(todayISO());
  const [returnMode, setReturnMode] = useState<"Job-wise" | "Item-wise">("Job-wise");
  const [remark, setRemark] = useState("");
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Job card
  const [selectedJobCard, setSelectedJobCard] = useState<JobCardRow | null>(null);
  const [manualJobCardNo, setManualJobCardNo] = useState("");
  const [floorItems, setFloorItems] = useState<FloorStockItem[]>([]);
  const [loadingFloor, setLoadingFloor] = useState(false);

  // Item-wise batch search
  const [batchSearch, setBatchSearch] = useState("");
  const [batchResults, setBatchResults] = useState<FloorStockItem[]>([]);
  const [allFloorItems, setAllFloorItems] = useState<FloorStockItem[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  // Warehouses (loaded once)
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  // Modals
  const [showJobScanner, setShowJobScanner] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showBatchScanner, setShowBatchScanner] = useState(false);
  const [pendingReturn, setPendingReturn] = useState<FloorStockItem | null>(null);

  // ── Load list — always loads the full history; the grid's own
  //    date-filter (below) narrows it down client-side. ───────
  const loadList = useCallback(async () => {
    setLoadingList(true); setListError("");
    try {
      const d = await apiFetch(`${BASE_URL}/api/ReturntoStockAJ/Showlist?fromDateValue=1900-01-01&ToDateValue=2099-12-31`);
      if (Array.isArray(d)) {
        const map = new Map<number, { row: RTSRecord; totalQty: number; count: number }>();
        d.forEach((r: RTSRecord) => {
          const ex = map.get(r.TransactionID);
          if (ex) { ex.totalQty += r.ReturnQuantity || 0; ex.count += 1; }
          else map.set(r.TransactionID, { row: r, totalQty: r.ReturnQuantity || 0, count: 1 });
        });
        setListData(Array.from(map.values()).map((v) => ({ ...v.row, _totalQty: v.totalQty, _itemCount: v.count })));
      } else {
        setListError(typeof d === "string" ? d : "Error loading list");
      }
    } catch { setListError("Network error"); }
    setLoadingList(false);
  }, []);

  useEffect(() => { if (view === "list") loadList(); }, [view, loadList]);

  // ── Load voucher no ────────────────────────────────────────
  const loadVoucherNo = useCallback(async () => {
    const raw = await apiFetch(`${BASE_URL}/api/ReturntoStockAJ/GetRTSVoucherNO?prefix=RTS`);
    setCurrentVoucherNo(unwrap(raw) || "RTS-NEW");
  }, []);

  // ── Load warehouses ────────────────────────────────────────
  const loadWarehouses = useCallback(async () => {
    const d = await apiFetch(`${BASE_URL}/api/ReturntoStockAJ/GetWarehouseList`);
    if (Array.isArray(d)) setWarehouses(d);
  }, []);

  // ── Parse floor stock API response ────────────────────────
  const parseFloorItem = (item: any): FloorStockItem => ({
    rowId: Math.random().toString(36).slice(2),
    TransactionID: item.TransactionID || 0,
    ParentTransactionID: item.ParentTransactionID || 0,
    ItemID: item.ItemID || 0,
    ItemGroupID: item.ItemGroupID || 0,
    ItemCode: item.ItemCode || "",
    ItemName: item.ItemName || "",
    StockUnit: item.StockUnit || "",
    BatchID: item.BatchID || 0,
    BatchNo: item.BatchNo || "",
    SupplierBatchNo: item.SupplierBatchNo || "",
    MfgDate: item.MfgDate || "",
    ExpiryDate: item.ExpiryDate || "",
    IssueQuantity: parseFloat(item.IssueQuantity) || 0,
    ConsumeQuantity: parseFloat(item.ConsumeQuantity) || 0,
    FloorStock: parseFloat(item.FloorStock) || 0,
    JobBookingID: item.JobBookingID || 0,
    JobBookingJobCardContentsID: item.JobBookingJobCardContentsID || 0,
    MachineID: item.MachineID || 0,
    ProcessID: item.ProcessID || 0,
    DepartmentID: item.DepartmentID || 0,
    FloorWarehouseID: item.FloorWarehouseID || 0,
    WarehouseName: item.WarehouseName || "",
    Bin: item.Bin || "",
    JobCardNo: item.JobCardNo || "",
    VoucherNo: item.VoucherNo || "",
  });

  // ── Load floor stock for job card ──────────────────────────
  const loadJobCardItems = async (jc: JobCardRow) => {
    setSelectedJobCard(jc);
    setShowJobPicker(false);
    setManualJobCardNo(jc.JobCardContentNo);
    setLoadingFloor(true);
    setFloorItems([]);
    try {
      const d = await apiFetch(`${BASE_URL}/api/ReturntoStockAJ/JobPendingVouchers?Options=JobIssueVouchers`);
      if (Array.isArray(d)) {
        const filtered = d
          .map(parseFloorItem)
          .filter((it) => it.JobCardNo === jc.JobCardContentNo && it.FloorStock > 0);
        setFloorItems(filtered);
        if (filtered.length === 0) alert("No items with available floor stock found for this Job Card.");
      }
    } catch { alert("Error loading floor stock items."); }
    setLoadingFloor(false);
  };

  // ── Job card QR scan ───────────────────────────────────────
  const handleJobCardScan = async (raw: string) => {
    setShowJobScanner(false);
    let jcNo = raw.trim();
    try { const d = JSON.parse(raw); jcNo = d.jobCardNo || d.JobCardContentNo || raw.trim(); } catch { }
    setManualJobCardNo(jcNo);
    // Find in job cards list
    const d = await apiFetch(`${BASE_URL}/api/ReturntoStockAJ/JobCardRender`);
    if (Array.isArray(d)) {
      const found = d.find((j: any) => j.JobCardContentNo === jcNo);
      if (found) {
        loadJobCardItems({
          JobBookingID: found.JobBookingID || 0,
          JobBookingJobCardContentsID: found.JobBookingJobCardContentsID || 0,
          JobCardContentNo: found.JobCardContentNo || jcNo,
          JobName: found.JobName || "",
          PlanContName: found.PlanContName || "",
        });
      } else {
        alert(`Job Card "${jcNo}" not found.`);
      }
    }
  };

  // ── Load all items (item-wise) ─────────────────────────────
  const loadAllForItemWise = useCallback(async () => {
    if (allFloorItems.length > 0) return;
    setLoadingAll(true);
    try {
      const d = await apiFetch(`${BASE_URL}/api/ReturntoStockAJ/JobPendingVouchers?Options=AllIssueVouchers`);
      if (Array.isArray(d)) setAllFloorItems(d.map(parseFloorItem).filter((it) => it.FloorStock > 0));
    } catch {}
    setLoadingAll(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Batch search (item-wise) ───────────────────────────────
  const searchBatch = (val: string) => {
    setBatchSearch(val);
    if (!val.trim()) { setBatchResults([]); return; }
    const lower = val.toLowerCase();
    setBatchResults(
      allFloorItems.filter((it) =>
        it.BatchNo.toLowerCase().includes(lower) ||
        it.ItemCode.toLowerCase().includes(lower) ||
        it.ItemName.toLowerCase().includes(lower)
      )
    );
  };

  const handleBatchScan = (raw: string) => {
    setShowBatchScanner(false);
    let batchNo = raw.trim();
    try { const d = JSON.parse(raw); batchNo = d.BatchNo || d.batchNo || raw.trim(); } catch {}
    searchBatch(batchNo);
    setBatchSearch(batchNo);
  };

  // ── Confirm return line ────────────────────────────────────
  const confirmReturn = (item: FloorStockItem, returnQty: number, warehouseID: number, warehouseName: string, binName: string) => {
    setPendingReturn(null);
    const newLine: ReturnLine = {
      lineId: Math.random().toString(36).slice(2),
      TransactionDetailID: 0,
      IssueTransactionID: item.TransactionID,
      ParentTransactionID: item.ParentTransactionID,
      ItemID: item.ItemID,
      ItemGroupID: item.ItemGroupID,
      ItemCode: item.ItemCode,
      ItemName: item.ItemName,
      StockUnit: item.StockUnit,
      BatchID: item.BatchID,
      BatchNo: item.BatchNo,
      SupplierBatchNo: item.SupplierBatchNo,
      MfgDate: item.MfgDate,
      ExpiryDate: item.ExpiryDate,
      FloorStock: item.FloorStock,
      JobBookingID: item.JobBookingID,
      JobBookingJobCardContentsID: item.JobBookingJobCardContentsID,
      MachineID: item.MachineID,
      ProcessID: item.ProcessID,
      DepartmentID: item.DepartmentID,
      FloorWarehouseID: item.FloorWarehouseID,
      ReturnQuantity: returnQty,
      DestWarehouseID: warehouseID,
      DestWarehouseName: warehouseName,
      DestBinName: binName,
      IssueVoucherNo: item.VoucherNo,
      JobCardNo: item.JobCardNo,
    };
    setLines((prev) => [...prev, newLine]);
  };

  const removeLine = (lineId: string) => setLines((prev) => prev.filter((l) => l.lineId !== lineId));

  // ── Save ───────────────────────────────────────────────────
  const save = async () => {
    if (lines.length === 0) { alert("No items to return."); return; }
    setSaving(true); setSaveError("");

    const deptID = lines[0]?.DepartmentID || 0;
    const totalQty = lines.reduce((s, l) => s + l.ReturnQuantity, 0);
    const jcID = lines[0]?.JobBookingJobCardContentsID || 0;

    const jsonObjectsRecordMain = [{
      VoucherID: -25,
      VoucherDate: voucherDate,
      DepartmentID: deptID,
      TotalQuantity: totalQty,
      JobBookingJobCardContentsID: jcID,
      Narration: remark,
      IsDeletedTransaction: 0,
    }];

    const jsonObjectsRecordDetail = lines.map((line, idx) => ({
      TransID: idx + 1,
      IssueTransactionID: line.IssueTransactionID,
      ParentTransactionID: line.ParentTransactionID,
      ItemID: line.ItemID,
      ItemGroupID: line.ItemGroupID,
      JobBookingID: line.JobBookingID,
      JobBookingJobCardContentsID: line.JobBookingJobCardContentsID,
      MachineID: line.MachineID,
      ProcessID: line.ProcessID,
      ReceiptQuantity: line.ReturnQuantity,
      BatchID: line.BatchID,
      BatchNo: line.BatchNo,
      SupplierBatchNo: line.SupplierBatchNo,
      MfgDate: line.MfgDate,
      ExpiryDate: line.ExpiryDate,
      FloorWarehouseID: line.FloorWarehouseID,
      WarehouseID: line.DestWarehouseID,
      StockUnit: line.StockUnit,
      IsDeletedTransaction: 0,
    }));

    const jsonObjectsConsumptionMain = [{
      VoucherDate: voucherDate,
      DepartmentID: deptID,
      IsJobWiseConsumption: returnMode === "Job-wise" ? 1 : 0,
      Narration: remark,
      IsDeletedTransaction: 0,
    }];

    const jsonObjectsConsumptionDetail = lines.map((line, idx) => ({
      TransID: idx + 1,
      IssueTransactionID: line.IssueTransactionID,
      ParentTransactionID: line.ParentTransactionID,
      DepartmentID: line.DepartmentID || deptID,
      ItemID: line.ItemID,
      ItemGroupID: line.ItemGroupID,
      JobBookingID: line.JobBookingID,
      JobBookingJobCardContentsID: line.JobBookingJobCardContentsID,
      MachineID: line.MachineID,
      ProcessID: line.ProcessID,
      ReturnQuantity: line.ReturnQuantity,
      ConsumeQuantity: 0,
      IssueQuantity: 0,
      BatchID: line.BatchID,
      BatchNo: line.BatchNo,
      FloorWarehouseID: line.FloorWarehouseID,
      WarehouseID: line.DestWarehouseID,
      StockUnit: line.StockUnit,
      IsDeletedTransaction: 0,
    }));

    try {
      const isUpdate = !!editingID;
      const url = isUpdate
        ? `${BASE_URL}/api/ReturntoStockAJ/UpdateRTS?TransactionID=${editingID}`
        : `${BASE_URL}/api/ReturntoStockAJ/SaveRTSData?prefix=RTS`;

      const res = await fetch(url, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ jsonObjectsRecordMain, jsonObjectsRecordDetail, jsonObjectsConsumptionMain, jsonObjectsConsumptionDetail }),
      });

      const raw = await res.text();
      const result = unwrap(raw);

      if (result === "Success") {
        alert(isUpdate ? "Return to Stock updated successfully." : `Return to Stock saved! Voucher: ${currentVoucherNo}`);
        resetForm();
        setView("list");
      } else {
        setSaveError(result || "Unknown error from server.");
      }
    } catch (e: any) {
      setSaveError("Network error: " + e.message);
    }
    setSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (txnID: number) => {
    if (!confirm("Delete this Return to Stock voucher? This cannot be undone.")) return;
    const res = await fetch(
      `${BASE_URL}/api/ReturntoStockAJ/DeleteRTS?TransactionID=${txnID}`,
      { method: "POST", headers: authHeaders() }
    );
    const raw = await res.text();
    const result = unwrap(raw);
    if (result === "Success") {
      if (view === "form") { resetForm(); setView("list"); }
      else await loadList();
      alert("Voucher deleted successfully.");
    } else if (result === "EXIST") {
      alert("Cannot delete: this voucher is referenced by subsequent transactions.");
    } else {
      alert(result || "Failed to delete");
    }
  };

  // ── Open New ───────────────────────────────────────────────
  const openNew = async () => {
    setEditingID(null);
    resetForm();
    await Promise.all([loadVoucherNo(), loadWarehouses()]);
    setView("form");
  };

  // ── Open Edit ──────────────────────────────────────────────
  const openEdit = async (rec: RTSRecord) => {
    setEditingID(rec.TransactionID);
    resetForm();
    setCurrentVoucherNo(rec.VoucherNo || "");
    await loadWarehouses();

    const d = await apiFetch(`${BASE_URL}/api/ReturntoStockAJ/SelectedRow?transactionID=${rec.TransactionID}`);
    if (Array.isArray(d) && d.length > 0) {
      const first = d[0];
      setVoucherDate(first.ReturnVoucherDate
        ? (() => { const p = new Date(first.ReturnVoucherDate); return isNaN(p.getTime()) ? todayISO() : p.toISOString().split("T")[0]; })()
        : todayISO());
      setRemark(first.Narration || "");
      const hasJob = d.some((r: any) => r.JobCardNo);
      setReturnMode(hasJob ? "Job-wise" : "Item-wise");
      if (hasJob && first.JobCardNo) {
        setManualJobCardNo(first.JobCardNo);
        setSelectedJobCard({
          JobBookingID: first.JobBookingID || 0,
          JobBookingJobCardContentsID: first.JobBookingJobCardContentsID || 0,
          JobCardContentNo: first.JobCardNo,
          JobName: first.JobName || "",
          PlanContName: first.ContentName || "",
        });
      }
      // Guard against backend JOIN fan-out: collapse duplicate detail rows by
      // TransactionDetailID so edit-load never shows duplicate lines or
      // double-posts quantities on save (rows without an id are kept as-is).
      const seenDetIds = new Set<number>();
      const uniqueRows = (d as any[]).filter((row: any) => {
        const detId = Number(row.TransactionDetailID) || 0;
        if (!detId) return true;
        if (seenDetIds.has(detId)) return false;
        seenDetIds.add(detId);
        return true;
      });
      setLines(uniqueRows.map((row: any) => ({
        lineId: Math.random().toString(36).slice(2),
        TransactionDetailID: row.TransactionDetailID || 0,
        IssueTransactionID: row.TransactionID || 0,
        ParentTransactionID: row.ParentTransactionID || 0,
        ItemID: row.ItemID || 0,
        ItemGroupID: row.ItemGroupID || 0,
        ItemCode: row.ItemCode || "",
        ItemName: row.ItemName || "",
        StockUnit: row.StockUnit || "",
        BatchID: row.BatchID || 0,
        BatchNo: row.BatchNo || "",
        SupplierBatchNo: row.SupplierBatchNo || "",
        MfgDate: row.MfgDate || "",
        ExpiryDate: row.ExpiryDate || "",
        FloorStock: parseFloat(row.FloorStock) || 0,
        JobBookingID: row.JobBookingID || 0,
        JobBookingJobCardContentsID: row.JobBookingJobCardContentsID || 0,
        MachineID: row.MachineID || 0,
        ProcessID: row.ProcessID || 0,
        DepartmentID: row.DepartmentID || 0,
        FloorWarehouseID: row.FloorWarehouseID || 0,
        ReturnQuantity: parseFloat(row.FloorStock) || 0,
        DestWarehouseID: row.BinID || 0,
        DestWarehouseName: row.WarehouseName || "",
        DestBinName: row.Bin || "",
        IssueVoucherNo: row.VoucherNo || "",
        JobCardNo: row.JobCardNo || "",
      })));
    }
    setView("form");
  };

  // ── Reset ──────────────────────────────────────────────────
  const resetForm = () => {
    setVoucherDate(todayISO());
    setReturnMode("Job-wise");
    setSelectedJobCard(null);
    setFloorItems([]);
    setAllFloorItems([]);
    setBatchResults([]);
    setBatchSearch("");
    setManualJobCardNo("");
    setLines([]);
    setRemark("");
    setSaveError("");
  };

  // Client-side date filter applied on top of the fully-loaded list
  // (text search is handled by the grid's own built-in search box).
  const filteredList = listData.filter((r) => {
    if (!r.VoucherDate) return true;
    const d = new Date(r.VoucherDate).toISOString().split("T")[0];
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });

  const showPicklistTab = returnMode === "Job-wise" && floorItems.length > 0;
  const totalReturnQty = lines.reduce((s, l) => s + l.ReturnQuantity, 0);

  // ── Return to Stock list columns (MASTER UI DataTable) ────
  const returnColumns: Column<RTSRecord>[] = useMemo(() => [
    { key: "VoucherNo", header: "Voucher No.", render: rec => <span className="font-mono text-xs font-semibold text-[rgb(var(--color-primary))]">{rec.VoucherNo}</span> },
    { key: "VoucherDate", header: "Date", render: rec => <span className="text-[rgb(var(--fg-muted))] text-xs">{fmtDate(rec.VoucherDate)}</span> },
    { key: "JobCardNo", header: "Job Card", render: rec => <span className="text-[rgb(var(--color-primary))] text-xs font-mono">{rec.JobCardNo || "—"}</span> },
    { key: "IssueVoucherNo", header: "Issue Voucher", render: rec => <span className="text-[rgb(var(--fg-muted))] text-xs">{rec.IssueVoucherNo || "—"}</span> },
    {
      key: "ItemName", header: "Items", render: rec =>
        (rec._itemCount ?? 1) > 1
          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgb(var(--color-primary-subtle))] text-[rgb(var(--color-primary))] font-semibold text-xs">{rec._itemCount} items</span>
          : <span className="text-[rgb(var(--fg-default))] text-xs">{rec.ItemName || "—"}</span>
    },
    { key: "_totalQty", header: "Total Return Qty", render: rec => <span className="text-[rgb(var(--fg-default))] text-xs font-semibold whitespace-nowrap">{(rec._totalQty ?? rec.ReturnQuantity ?? 0).toLocaleString()} {rec.StockUnit || ""}</span> },
    { key: "Warehouse", header: "Warehouse", render: rec => <span className="text-[rgb(var(--fg-muted))] text-xs">{rec.Warehouse || "—"}</span> },
    { key: "CreatedBy", header: "Created By", render: rec => <span className="text-[rgb(var(--fg-muted))] text-xs">{rec.CreatedBy || "—"}</span> },
  ], []);

  // ══════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════
  if (view === "list") {
    return (
      <div className="w-full space-y-4">

        {/* Page heading */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="w-[124px] flex-shrink-0" />
          <div className="text-center flex-1">
            <h2 className="text-xl font-bold text-[rgb(var(--fg-default))]">Return to Stock</h2>
            <p className="text-sm text-[rgb(var(--fg-muted))]">{filteredList.length} return vouchers</p>
          </div>
          <div className="w-[124px] flex-shrink-0 flex justify-end">
            <Button variant="secondary" size="sm" icon={<History size={14} />} onClick={() => alert("Audit Trail — coming soon")}>
              Audit Trail
            </Button>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <Button variant="action-refresh" size="sm" icon={<RefreshCw size={14} className={loadingList ? "animate-spin" : ""} />} onClick={loadList} />
          <Button variant="action-create" size="sm" icon={<Plus size={15} />} onClick={openNew}>New Return</Button>
        </div>

        {listError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={15} /> {listError}
          </div>
        )}

        <div className="bg-[rgb(var(--bg-surface))] rounded-xl border border-[rgb(var(--bd-default))] shadow-sm overflow-hidden">
          {loadingList ? (
            <div className="text-center py-14 text-[rgb(var(--fg-subtle))] text-sm">Loading…</div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-14 text-[rgb(var(--fg-subtle))] text-sm">No return vouchers found. Click &ldquo;New Return&rdquo; to begin.</div>
          ) : (
            <div className="p-4">
              <DataTable
                data={filteredList}
                columns={returnColumns}
                getRowId={rec => String(rec.TransactionID)}
                loading={loadingList}
                dateFrom={fromDate ? new Date(fromDate) : null}
                dateTo={toDate ? new Date(toDate) : null}
                onDateFromChange={d => setFromDate(d ? d.toISOString().split("T")[0] : "")}
                onDateToChange={d => setToDate(d ? d.toISOString().split("T")[0] : "")}
                actions={rec => (
                  <div className="flex items-center gap-1.5 justify-center">
                    <Button variant="action-edit" size="xs" icon={<Pencil size={11} />} onClick={() => openEdit(rec)}>Edit</Button>
                    <Button variant="action-delete" size="xs" icon={<Trash2 size={11} />} onClick={() => handleDelete(rec.TransactionID)} />
                  </div>
                )}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // FORM VIEW
  // ══════════════════════════════════════════════════════════
  return (
    <Modal
      open={view === "form"}
      onClose={() => setView("list")}
      title={editingID ? `Edit Return — ${currentVoucherNo}` : "Return to Stock Creation"}
      size="2xl"
    >
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-5 flex flex-col">
        <div className="p-6 space-y-6">

          {saveError && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle size={15} /> {saveError}
            </div>
          )}

          {/* ── RETURN DETAILS ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <SectionTitle title="Return Details" />
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Input label="Voucher No." readOnly value={currentVoucherNo} />
              </div>
              <div>
                <Input label="Return Date" type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Return Mode</label>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  {(["Job-wise", "Item-wise"] as const).map((m) => (
                    <button key={m} onClick={() => {
                      setReturnMode(m);
                      setSelectedJobCard(null);
                      setFloorItems([]);
                      setLines([]);
                      setManualJobCardNo("");
                      setBatchResults([]);
                      setBatchSearch("");
                      if (m === "Item-wise") loadAllForItemWise();
                    }}
                      className={`flex-1 px-4 py-2 text-sm font-semibold transition-colors ${returnMode === m ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Job-wise: job card selection */}
          {returnMode === "Job-wise" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <SectionTitle title="Job Card Selection" />
              <div className="flex items-end gap-3 flex-wrap">
                <div className="min-w-[240px] flex-1 max-w-sm">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Job Card Content No.</label>
                  <div className="flex gap-2">
                    <Input type="text" value={manualJobCardNo}
                      onChange={(e) => setManualJobCardNo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && manualJobCardNo.trim()) handleJobCardScan(manualJobCardNo); }}
                      placeholder="Enter job card no…"
                      className="flex-1 font-mono" />
                    <button onClick={() => handleJobCardScan(manualJobCardNo)}
                      disabled={!manualJobCardNo.trim()}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 h-[38px]">
                      <Search size={13} /> Find
                    </button>
                  </div>
                </div>
                <button onClick={() => setShowJobScanner(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 whitespace-nowrap">
                  <Scan size={15} /> Scan QR
                </button>
                <button onClick={() => setShowJobPicker(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 whitespace-nowrap">
                  <Search size={15} /> Pick from List
                </button>
              </div>

              {loadingFloor && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                  <RefreshCw size={14} className="animate-spin" /> Loading floor stock…
                </div>
              )}

              {selectedJobCard && (
                <div className="mt-4 flex items-center gap-6 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span className="font-mono font-bold text-blue-700 text-sm">{selectedJobCard.JobCardContentNo}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-gray-700">{selectedJobCard.JobName}</span>
                    {selectedJobCard.PlanContName && <span className="text-gray-500 ml-2 text-xs">· {selectedJobCard.PlanContName}</span>}
                  </div>
                  <div className="ml-auto text-xs text-gray-500">
                    <span className="font-semibold text-blue-700">{floorItems.length}</span> items with floor stock
                    {lines.length > 0 && <span className="ml-2 text-blue-700 font-semibold">· {lines.length} in return list</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Item-wise: batch search */}
          {returnMode === "Item-wise" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <SectionTitle title="Batch / Item Search" />
              <div className="flex items-end gap-3 flex-wrap">
                <div className="min-w-[280px] flex-1 max-w-md">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Batch No. / Item Code / Name</label>
                  <div className="flex gap-2">
                    <Input type="text" value={batchSearch}
                      onChange={(e) => { setBatchSearch(e.target.value); searchBatch(e.target.value); }}
                      placeholder="Search batch no, item code or name…"
                      className="flex-1 font-mono" />
                    <button onClick={() => setShowBatchScanner(true)}
                      className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 h-[38px]">
                      <Scan size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {loadingAll && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                  <RefreshCw size={14} className="animate-spin" /> Loading available stock…
                </div>
              )}

              {batchSearch && batchResults.length === 0 && !loadingAll && (
                <div className="mt-4 text-sm text-gray-400">No items found matching &ldquo;{batchSearch}&rdquo;</div>
              )}

              {batchResults.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch No.</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue Voucher</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Floor Stock</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.map((it) => (
                        <tr key={it.rowId} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-gray-800 text-sm">{it.ItemName}</p>
                            <p className="font-mono text-xs text-blue-600">{it.ItemCode}</p>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{it.BatchNo || "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">{it.VoucherNo || "—"}</td>
                          <td className="px-4 py-2.5 text-right text-xs font-bold text-blue-700">
                            {it.FloorStock.toLocaleString()} {it.StockUnit}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button onClick={() => setPendingReturn(it)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 mx-auto">
                              <RotateCcw size={12} /> Return
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── PICKLIST (Job-wise, once floor stock is loaded) ── */}
          {showPicklistTab && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <SectionTitle title={`Floor Stock for Job Card — ${selectedJobCard?.JobCardContentNo} (${floorItems.length})`} />
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch No.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue Voucher</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Issued</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Consumed</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Floor Stock</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Returning</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {floorItems.map((item, idx) => {
                      const returning = lines
                        .filter((l) => l.ItemID === item.ItemID && l.BatchID === item.BatchID)
                        .reduce((s, l) => s + l.ReturnQuantity, 0);
                      const done = returning >= item.FloorStock;
                      return (
                        <tr key={item.rowId}
                          className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-800 text-sm">{item.ItemName}</p>
                            <p className="font-mono text-xs text-blue-600">{item.ItemCode}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.BatchNo || "—"}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{item.VoucherNo || "—"}</td>
                          <td className="px-4 py-3 text-right text-xs text-gray-600">
                            {item.IssueQuantity > 0 ? `${item.IssueQuantity.toLocaleString()} ${item.StockUnit}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-orange-600 font-semibold">
                            {item.ConsumeQuantity > 0 ? `${item.ConsumeQuantity.toLocaleString()} ${item.StockUnit}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-blue-700">
                            {item.FloorStock.toLocaleString()} {item.StockUnit}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-blue-700">
                            {returning > 0 ? `${returning.toLocaleString()} ${item.StockUnit}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {done ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                <CheckCircle2 size={10} /> Done
                              </span>
                            ) : (
                              <button onClick={() => setPendingReturn(item)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 mx-auto">
                                <RotateCcw size={12} /> Return
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── RETURN LINES ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <SectionTitle title={`Return Lines${lines.length > 0 ? ` (${lines.length})` : ""}`} />

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs" style={{ minWidth: 1200 }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Item Code", "Item Name", "Batch No.", "Sup. Batch", "Issue Voucher", "Floor Stk", "Return Qty", "Unit", "Dest. Warehouse", "Dest. Bin", ""].map((l, i) => (
                      <th key={i} className={`px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${["Floor Stk", "Return Qty"].includes(l) ? "text-right" : "text-left"}`}>
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-16 text-gray-400">
                        <div className="space-y-2 flex flex-col items-center">
                          <RotateCcw size={36} className="text-gray-300" />
                          <p className="text-sm font-medium text-gray-500">
                            {returnMode === "Job-wise"
                              ? (showPicklistTab ? "Return items from the picklist above." : "Load a Job Card above, then return items from its floor stock.")
                              : "Search a batch or item above, then return it."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : lines.map((line, idx) => (
                    <tr key={line.lineId}
                      className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                      <td className="px-3 py-2.5 font-mono text-blue-700 font-semibold whitespace-nowrap">{line.ItemCode}</td>
                      <td className="px-3 py-2.5 text-gray-800">
                        <div className="truncate" style={{ maxWidth: 180 }} title={line.ItemName}>{line.ItemName}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-blue-600 text-[10px] whitespace-nowrap">{line.BatchNo || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-600">{line.SupplierBatchNo || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-600">{line.IssueVoucherNo || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">{line.FloorStock > 0 ? line.FloorStock.toLocaleString() : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-blue-700 whitespace-nowrap">{line.ReturnQuantity.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-gray-700">{line.StockUnit}</td>
                      <td className="px-3 py-2.5 text-gray-700">{line.DestWarehouseName || "—"}</td>
                      <td className="px-3 py-2.5 text-gray-600">{line.DestBinName || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => removeLine(line.lineId)}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {lines.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500 flex items-center gap-4 flex-wrap">
                <span>{lines.length} item{lines.length !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span className="font-semibold text-blue-700">Total return: {totalReturnQty.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* ── REMARK ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <SectionTitle title="Remark / Narration" />
            <Input value={remark} onChange={(e) => setRemark(e.target.value)}
              placeholder="Optional notes…" />
          </div>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={() => setView("list")}>
            Close
          </Button>
          {editingID != null && (
            <Button variant="action-cancel" size="sm" onClick={() => handleDelete(editingID)}>
              Delete
            </Button>
          )}
          <Button
            variant="action-save" size="sm" loading={saving}
            icon={<RotateCcw size={14} />}
            disabled={lines.length === 0}
            onClick={save}
          >
            {editingID ? "Update" : "Save"}{lines.length > 0 ? ` (${lines.length})` : ""}
          </Button>
        </div>
      </div>

      {/* Modals */}
      {showJobScanner && (
        <ScannerModal title="Scan Job Card" hint="Scan the Job Card QR or barcode"
          onScan={handleJobCardScan} onClose={() => setShowJobScanner(false)} />
      )}
      {showJobPicker && (
        <JobCardPickerModal onSelect={loadJobCardItems} onClose={() => setShowJobPicker(false)} />
      )}
      {showBatchScanner && (
        <ScannerModal title="Scan Batch QR" hint="Scan the batch QR label"
          onScan={handleBatchScan} onClose={() => setShowBatchScanner(false)} />
      )}
      {pendingReturn && (
        <ReturnConfirmModal
          item={pendingReturn}
          warehouses={warehouses}
          onConfirm={(qty, wid, wname, bname) => confirmReturn(pendingReturn, qty, wid, wname, bname)}
          onClose={() => setPendingReturn(null)}
        />
      )}
    </Modal>
  );
}
