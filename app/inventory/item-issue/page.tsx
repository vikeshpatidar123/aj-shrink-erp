"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import jsQR from "jsqr";
import {
  FileText, X, Scan, QrCode, CheckCircle2, Pencil,
  Trash2, Plus, Camera, Keyboard, Search, PackageMinus, List,
  Users, RefreshCw, AlertCircle, ChevronRight,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";
import { Input, Select, Textarea } from "@/components/ui/Input";

// ─── Config ──────────────────────────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";

async function apiFetch(url: string): Promise<any> {
  const res = await fetch(url, { headers: authHeaders() });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function unwrap(raw: any): string {
  if (typeof raw !== "string") return String(raw ?? "");
  const t = raw.trim();
  if (t.startsWith('"') && t.endsWith('"')) { try { return JSON.parse(t); } catch { } }
  return t;
}

// ─── Helpers ─────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const nextSlipNo = (date: string, seq: number) =>
  `SLIP-${date.replace(/-/g, "")}-${String(seq).padStart(3, "0")}`;

// ─── Types ───────────────────────────────────────────────────
type Dept = { DepartmentID: number; DepartmentName: string };

type JobCardRow = {
  JobBookingID: number;
  JobBookingJobCardContentsID: number;
  JobCardContentNo: string;
  JobName: string;
  PlanContName: string;
  BookingNo: string;
  ClientName?: string;
  LedgerName?: string;
};

// One item requirement loaded from the job card picklist
type JobItem = {
  jobItemId: string;            // client-only key
  ItemID: number;
  ItemGroupID: number;
  ItemCode: string;
  ItemName: string;
  ItemGroup?: string;
  SubGroup?: string;
  StockUnit: string;
  BookedQuantity: number;
  PendingToPick: number;        // remaining to issue
  PhysicalStock: number;
  FreeStock: number;
  JobBookingJobCardContentsID: number;
  JobBookingID: number;
  ProcessID: number;
  MachineID: number;
  picklistTransactionID: number;
  picklistReleaseTransactionID: number;
};

// One confirmed batch scan — multiple per JobItem are allowed
type ScanLine = {
  lineId: string;
  jobItemId: string;            // links to JobItem.jobItemId, or "item-wise" / "edit-loaded"
  TransactionDetailID: number;  // set on edit-load; 0 for new
  // Item identity
  ItemID: number;
  ItemGroupID: number;
  ItemCode: string;
  ItemName: string;
  StockUnit: string;
  // Job card linkage
  JobBookingJobCardContentsID: number;
  JobBookingID: number;
  ProcessID: number;
  MachineID: number;
  picklistTransactionID: number;
  picklistReleaseTransactionID: number;
  // Batch scan result
  batchNo: string;
  supplierBatchNo: string;
  batchID: number;
  parentTransactionID: number;
  warehouseID: number;
  issueQty: number;
  availableQty: number;
  fromWarehouseName: string;
  fromBin: string;
  floorWarehouseID: number;
  floorWarehouseName: string;
  floorBin: string;
  slipNo: string;
  slipDate: string;
  collectedBy: string;
  jobCardContentNo: string;
  issueReason: string;
  jobBookingID: number;
  jobBookingNo: string;
  multiJobAllocations: { jobBookingID: number; jobBookingNo: string; allocatedQty: number }[];
};

type BatchInfo = {
  ItemID: number;
  ItemCode: string;
  ItemName: string;
  ItemGroupID: number;
  ItemGroupNameID: number;
  ItemSubGroupID: number;
  BatchID: number;
  BatchNo: string;
  SupplierBatchNo: string;
  BatchStock: number;
  IssueQuantity: number;
  StockUnit: string;
  PurchaseUnit: string;
  WarehouseID: number;
  Warehouse: string;
  Bin: string;
  ParentTransactionID: number;
  MfgDate?: string;
  ExpiryDate?: string;
  WtPerPacking: number;
  UnitPerPacking: number;
  ConversionFactor: number;
};

type FloorWarehouse = { Warehouse: string };
type FloorBin = { Bin: string; WarehouseID: number };
type Receiver = { LedgerID: number; LedgerName: string };
type JobBooking = { JobBookingID: number; JobBookingNo: string };
type AllocRow = {
  id: string;
  jobBookingID: number;
  jobBookingNo: string;
  search: string;
  allocatedQty: number;
  showDropdown: boolean;
};

type IssueRecord = {
  TransactionID: number;
  VoucherNo: string;
  VoucherDate: string;
  DepartmentID?: number;
  DepartmentName?: string;
  JobCardNo?: string;
  JobName?: string;
  ItemName?: string;
  IssueQuantity?: number;
  StockUnit?: string;
  UserName?: string;
  // aggregated on client
  _totalQty?: number;
  _itemCount?: number;
};

const ISSUE_REASONS = [
  "Exact Requirement",
  "For Multi Job Consumption",
  "Lot Size",
  "General Purpose",
] as const;
type IssueReason = typeof ISSUE_REASONS[number];

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
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
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
    if (code?.data) { stopCamera(); onScan(code.data); }
  }, [onScan, stopCamera]);

  useEffect(() => {
    let active = true;
    if (mode === "camera") {
      const initCamera = async () => {
        setCameraError("");
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setScanning(true);
            intervalRef.current = setInterval(scan, 150);
          }
        } catch {
          if (active) { setCameraError("Camera unavailable. Use manual entry."); setMode("manual"); }
        }
      };
      initCamera();
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
            <Textarea label="Enter / Paste value" autoFocus value={manual} onChange={(e) => setManual(e.target.value)} rows={3}
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

// ─── Job Card Picker Modal ───────────────────────────────────
function JobCardPickerModal({ onSelect, onClose }: {
  onSelect: (jc: JobCardRow) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<JobCardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`${BASE_URL}/api/ItemIssueDirectAJ/JobCardRender`)
      .then((d) => { if (Array.isArray(d)) setRows(d); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((j) => {
    const s = search.toLowerCase();
    return !s || (j.JobCardContentNo?.toLowerCase().includes(s) ||
      j.JobName?.toLowerCase().includes(s) ||
      j.PlanContName?.toLowerCase().includes(s) ||
      j.BookingNo?.toLowerCase().includes(s));
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[1000px] max-h-[80vh] flex flex-col overflow-hidden">
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
            <div className="text-center py-12 text-gray-400">Loading job cards…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No open job cards found</div>
          ) : filtered.map((jc, i) => (
            <div key={`${jc.JobBookingJobCardContentsID}-${i}`} onClick={() => onSelect(jc)}
              className="px-5 py-3.5 border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm font-bold text-blue-700">{jc.JobCardContentNo}</span>
                <span className="text-xs text-gray-400">#{jc.BookingNo}</span>
              </div>
              <p className="text-sm font-medium text-gray-800">{jc.JobName}</p>
              <p className="text-xs text-gray-500">{jc.PlanContName} · {jc.ClientName || jc.LedgerName || ""}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Batch Confirm Modal ──────────────────────────────────────
function BatchConfirmModal({
  batch, requiredQty, seq, issueMode, onConfirm, onClose,
}: {
  batch: BatchInfo; requiredQty: number; seq: number;
  issueMode: "Job-wise" | "Item-wise";
  onConfirm: (updates: Partial<ScanLine>) => void;
  onClose: () => void;
}) {
  const [issueQty, setIssueQty] = useState(
    Math.min(requiredQty > 0 ? requiredQty : batch.BatchStock, batch.BatchStock)
  );
  const [floorWarehouseName, setFloorWarehouseName] = useState("");
  const [floorBin, setFloorBin] = useState("");
  const [floorWarehouseID, setFloorWarehouseID] = useState(0);
  const jobCardContentNo = "";
  const [issueReason, setIssueReason] = useState<IssueReason | "">("");
  const [jobBookingID, setJobBookingID] = useState<number>(0);
  const [jobBookingNo, setJobBookingNo] = useState<string>("");
  const [jobBookingSearch, setJobBookingSearch] = useState("");
  const [jobBookings, setJobBookings] = useState<JobBooking[]>([]);
  const [showJBDropdown, setShowJBDropdown] = useState(false);
  const [showJBScanner, setShowJBScanner] = useState(false);
  const [allocations, setAllocations] = useState<AllocRow[]>([]);
  const [scanningAllocIdx, setScanningAllocIdx] = useState<number | null>(null);

  const [floorWarehouses, setFloorWarehouses] = useState<FloorWarehouse[]>([]);
  const [floorBins, setFloorBins] = useState<FloorBin[]>([]);
  const [loadingWH, setLoadingWH] = useState(false);
  const [loadingBins, setLoadingBins] = useState(false);

  useEffect(() => {
    setLoadingWH(true);
    apiFetch(`${BASE_URL}/api/ItemIssueDirectAJ/GetWarehouseList`)
      .then((d) => { if (Array.isArray(d)) setFloorWarehouses(d); })
      .finally(() => setLoadingWH(false));
  }, []);

  useEffect(() => {
    if (!floorWarehouseName) { setFloorBins([]); setFloorBin(""); setFloorWarehouseID(0); return; }
    setLoadingBins(true);
    apiFetch(`${BASE_URL}/api/ItemIssueDirectAJ/GetBinsList?warehousename=${encodeURIComponent(floorWarehouseName)}`)
      .then((d) => { if (Array.isArray(d)) { setFloorBins(d); if (d.length > 0) setFloorWarehouseID(d[0].WarehouseID); } })
      .finally(() => setLoadingBins(false));
  }, [floorWarehouseName]);

  const today = todayISO();
  const needsReason = requiredQty > 0 && issueQty > requiredQty * 1.1;
  const isMultiJob = issueReason === "For Multi Job Consumption";

  // Load job bookings for Multi Job allocations and Item-wise optional picker
  useEffect(() => {
    if ((!isMultiJob && issueMode !== "Item-wise") || jobBookings.length > 0) return;
    apiFetch(`${BASE_URL}/api/ItemIssueDirectAJ/GetJobBookingList`)
      .then((d) => { if (Array.isArray(d)) setJobBookings(d); });
  }, [isMultiJob, issueMode, jobBookings.length]);

  // Auto-add one empty allocation row when Multi Job is selected
  useEffect(() => {
    if (isMultiJob && allocations.length === 0) {
      setAllocations([{ id: Math.random().toString(36).slice(2), jobBookingID: 0, jobBookingNo: "", search: "", allocatedQty: 0, showDropdown: false }]);
    }
  }, [isMultiJob]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredJB = jobBookings.filter((jb) =>
    !jobBookingSearch || jb.JobBookingNo?.toLowerCase().includes(jobBookingSearch.toLowerCase())
  );

  const selectJobBooking = (jb: JobBooking) => {
    setJobBookingID(jb.JobBookingID);
    setJobBookingNo(jb.JobBookingNo);
    setJobBookingSearch(jb.JobBookingNo);
    setShowJBDropdown(false);
  };

  const validAllocs = allocations.filter((a) => (a.jobBookingID > 0 || a.search.trim() !== "") && a.allocatedQty > 0);
  const canConfirm = !!issueQty && issueQty > 0 && !!floorWarehouseName && !!floorBin &&
    !(needsReason && !issueReason) &&
    !(isMultiJob && validAllocs.length === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[1100px] min-h-[82vh] max-h-[94vh] flex flex-col overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-green-300" />
            <div>
              <p className="font-semibold text-sm">Batch Scanned — Confirm Issue</p>
              <p className="text-xs text-blue-200 font-mono">{batch.BatchNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Batch info card */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Item</p>
              <p className="font-semibold text-gray-800">{batch.ItemName}</p>
              <p className="font-mono text-blue-700">{batch.ItemCode}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Internal Batch No.</p>
              <p className="font-mono text-blue-700 font-bold">{batch.BatchNo}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Supplier Batch</p>
              <p className="font-mono text-gray-700">{batch.SupplierBatchNo || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Available Stock</p>
              <p className="font-bold text-green-700 text-sm">{batch.BatchStock.toLocaleString()} {batch.StockUnit}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">From Warehouse</p>
              <p className="text-gray-700">{batch.Warehouse}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">From Bin</p>
              <p className="text-gray-700 font-mono">{batch.Bin}</p>
            </div>
          </div>

          {/* Issue details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label={`Issue Qty (${batch.StockUnit}) *`} type="number" min={0.01} max={batch.BatchStock} step={0.01}
                value={issueQty}
                onChange={(e) => { setIssueQty(Number(e.target.value)); setIssueReason(""); }} />
            </div>
            <div>
              <Select label="To Floor / Warehouse *" value={floorWarehouseName}
                onChange={(e) => { setFloorWarehouseName(e.target.value); setFloorBin(""); }}
                disabled={loadingWH}
                options={[{ value: "", label: loadingWH ? "Loading…" : "Select floor warehouse…" }, ...floorWarehouses.map((w) => ({ value: w.Warehouse, label: w.Warehouse }))]} />
            </div>
            <div>
              <Select label="To Bin *" value={floorBin} onChange={(e) => setFloorBin(e.target.value)}
                disabled={!floorWarehouseName || loadingBins}
                options={[{ value: "", label: loadingBins ? "Loading…" : "Select bin…" }, ...floorBins.map((b) => ({ value: b.Bin, label: b.Bin }))]} />
            </div>
            {issueMode === "Item-wise" && (
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Job Booking No.
                  <span className="ml-1 text-gray-400 font-normal normal-case">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Input
                      type="text"
                      value={jobBookingSearch}
                      onChange={(e) => { setJobBookingSearch(e.target.value); setJobBookingID(0); setJobBookingNo(""); setShowJBDropdown(true); }}
                      onFocus={() => setShowJBDropdown(true)}
                      onBlur={() => setTimeout(() => setShowJBDropdown(false), 150)}
                      placeholder="Type to search Job Booking No…"
                    />
                    {showJBDropdown && filteredJB.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredJB.map((jb) => (
                          <button key={jb.JobBookingID} type="button"
                            onMouseDown={() => selectJobBooking(jb)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 font-mono text-blue-700 border-b border-gray-50 last:border-0">
                            {jb.JobBookingNo}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setShowJBScanner(true)}
                    className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors h-[38px]">
                    <Scan size={15} /> <span className="hidden sm:inline">Scan</span>
                  </button>
                </div>
                {jobBookingID > 0 && (
                  <p className="text-xs text-green-700 font-semibold mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={11} /> {jobBookingNo}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Issue Reason */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
              Issue Reason
              <span className="font-normal normal-case tracking-normal text-gray-400">
                {needsReason ? "— required, qty exceeds 110% of remaining" : "(optional)"}
              </span>
            </label>
            <Select value={issueReason}
              onChange={(e) => { setIssueReason(e.target.value as IssueReason | ""); setJobBookingID(0); setJobBookingNo(""); setJobBookingSearch(""); setAllocations([]); }}
              options={[{ value: "", label: "— Select reason —" }, ...ISSUE_REASONS.map((r) => ({ value: r, label: r }))]} />
          </div>

          {/* Multi Job — Multi-Row Allocation Table */}
          {isMultiJob && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-purple-700 uppercase tracking-widest flex items-center gap-2">
                  <Users size={13} /> Job Booking Allocations *
                </label>
                <button type="button"
                  onClick={() => setAllocations((prev) => [...prev, { id: Math.random().toString(36).slice(2), jobBookingID: 0, jobBookingNo: "", search: "", allocatedQty: 0, showDropdown: false }])}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-300 rounded-lg bg-white hover:bg-purple-50">
                  <Plus size={12} /> Add Row
                </button>
              </div>

              {/* Column headers */}
              <div className="grid gap-2 px-0.5" style={{ gridTemplateColumns: "1fr 36px 100px 28px" }}>
                <span className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider">Job Booking No.</span>
                <span />
                <span className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider">Qty</span>
                <span />
              </div>

              {allocations.map((alloc, idx) => (
                <div key={alloc.id} className="grid items-start gap-2" style={{ gridTemplateColumns: "1fr 36px 100px 28px" }}>
                  {/* Searchable job booking combobox */}
                  <div className="relative min-w-0">
                    <Input
                      type="text"
                      value={alloc.search}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, search: v, jobBookingID: 0, jobBookingNo: "", showDropdown: true } : a));
                      }}
                      onFocus={() => setAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, showDropdown: true } : a))}
                      onBlur={() => setTimeout(() => setAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, showDropdown: false } : a)), 150)}
                      placeholder="Search…"
                    />
                    {alloc.showDropdown && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {jobBookings
                          .filter((jb) => !alloc.search || jb.JobBookingNo?.toLowerCase().includes(alloc.search.toLowerCase()))
                          .map((jb) => (
                            <button key={jb.JobBookingID} type="button"
                              onMouseDown={() => setAllocations((prev) => prev.map((a, i) => i === idx
                                ? { ...a, jobBookingID: jb.JobBookingID, jobBookingNo: jb.JobBookingNo, search: jb.JobBookingNo, showDropdown: false }
                                : a))}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 font-mono text-blue-700 border-b border-gray-50 last:border-0">
                              {jb.JobBookingNo}
                            </button>
                          ))}
                      </div>
                    )}
                    {alloc.jobBookingID > 0 && (
                      <p className="text-[10px] text-green-700 font-semibold mt-0.5 flex items-center gap-1 truncate">
                        <CheckCircle2 size={9} /> {alloc.jobBookingNo}
                      </p>
                    )}
                  </div>
                  {/* Scan */}
                  <button type="button" onClick={() => setScanningAllocIdx(idx)}
                    className="flex items-center justify-center h-[38px] w-[36px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 flex-shrink-0">
                    <Scan size={14} />
                  </button>
                  {/* Qty */}
                  <Input type="number" min={0.01} step={0.01}
                    value={alloc.allocatedQty || ""}
                    onChange={(e) => setAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, allocatedQty: Number(e.target.value) } : a))}
                    placeholder="0"
                  />
                  {/* Remove row — invisible when only 1 row so grid stays stable */}
                  <button type="button" onClick={() => setAllocations((prev) => prev.filter((_, i) => i !== idx))}
                    className={`flex items-center justify-center h-[38px] w-7 text-red-400 hover:text-red-600 transition-colors ${allocations.length <= 1 ? "invisible" : ""}`}>
                    <X size={14} />
                  </button>
                </div>
              ))}

              {validAllocs.length === 0 && (
                <p className="text-xs text-red-500">At least one Job Booking with qty is required.</p>
              )}
              {validAllocs.length > 0 && (
                <p className="text-xs text-green-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} /> {validAllocs.length} allocation{validAllocs.length > 1 ? "s" : ""} ready
                </p>
              )}

              {/* Scanner for a specific allocation row */}
              {scanningAllocIdx !== null && (
                <ScannerModal title="Scan Job Booking No." hint="Scan QR or barcode on the job booking"
                  onScan={(val) => {
                    const capturedIdx = scanningAllocIdx;
                    setScanningAllocIdx(null);
                    const searchVal = (() => {
                      try { const d = JSON.parse(val); return d.JobBookingNo || d.jobBookingNo || val; } catch { return val; }
                    })();
                    const match = jobBookings.find((jb) => jb.JobBookingNo?.toLowerCase().includes(searchVal.toLowerCase()));
                    if (match) {
                      setAllocations((prev) => prev.map((a, i) => i === capturedIdx
                        ? { ...a, jobBookingID: match.JobBookingID, jobBookingNo: match.JobBookingNo, search: match.JobBookingNo, showDropdown: false }
                        : a));
                    } else {
                      setAllocations((prev) => prev.map((a, i) => i === capturedIdx ? { ...a, search: searchVal, showDropdown: true } : a));
                    }
                  }}
                  onClose={() => setScanningAllocIdx(null)}
                />
              )}
            </div>
          )}

          {/* Slip preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500 flex items-center justify-between">
            <span>Slip No: <span className="font-mono font-semibold text-blue-700">{nextSlipNo(today, seq)}</span></span>
            <span>Slip Date: <span className="font-semibold text-gray-700">{fmtDate(today)}</span></span>
          </div>
        </div>

        <div className="px-6 pb-5 flex items-center justify-between border-t border-gray-100 pt-4 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              onConfirm({
                ItemID: batch.ItemID,
                ItemGroupID: batch.ItemGroupID,
                ItemCode: batch.ItemCode,
                ItemName: batch.ItemName,
                StockUnit: batch.StockUnit,
                issueQty,
                batchNo: batch.BatchNo,
                supplierBatchNo: batch.SupplierBatchNo || "",
                batchID: batch.BatchID,
                parentTransactionID: batch.ParentTransactionID,
                warehouseID: batch.WarehouseID,
                availableQty: batch.BatchStock,
                fromWarehouseName: batch.Warehouse,
                fromBin: batch.Bin,
                floorWarehouseID,
                floorWarehouseName,
                floorBin,
                slipNo: nextSlipNo(today, seq),
                slipDate: today,
                collectedBy: "",
                jobCardContentNo: issueMode === "Item-wise" ? jobCardContentNo : "",
                issueReason: issueReason || "",
                jobBookingID: isMultiJob ? 0 : jobBookingID,
                jobBookingNo: isMultiJob ? "" : jobBookingNo,
                multiJobAllocations: isMultiJob
                  ? validAllocs.map((a) => ({ jobBookingID: a.jobBookingID, jobBookingNo: a.jobBookingNo || a.search.trim(), allocatedQty: a.allocatedQty }))
                  : [],
              });
            }}
            disabled={!canConfirm}>
            <PackageMinus size={15} /> Confirm Issue
          </Button>
        </div>
      </div>

      {showJBScanner && (
        <ScannerModal title="Scan Job Booking No." hint="Scan QR or barcode on the job booking"
          onScan={(val) => {
            setShowJBScanner(false);
            const searchVal = (() => {
              try { const d = JSON.parse(val); return d.JobBookingNo || d.jobBookingNo || val; } catch { return val; }
            })();
            const match = jobBookings.find((jb) => jb.JobBookingNo?.toLowerCase().includes(searchVal.toLowerCase()));
            if (match) { selectJobBooking(match); }
            else { setJobBookingSearch(searchVal); setShowJBDropdown(true); }
          }}
          onClose={() => setShowJBScanner(false)}
        />
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function ItemIssuePage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editingID, setEditingID] = useState<number | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(todayISO());
  const [activeTab, setActiveTab] = useState<"basic" | "scan" | "items">("basic");

  // List
  const [listData, setListData] = useState<IssueRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  // Form
  const [voucherDate, setVoucherDate] = useState(todayISO());
  const [issueMode, setIssueMode] = useState<"Job-wise" | "Item-wise">("Job-wise");
  const [departmentID, setDepartmentID] = useState<number>(0);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [selectedJobCard, setSelectedJobCard] = useState<JobCardRow | null>(null);
  const [jobItems, setJobItems] = useState<JobItem[]>([]);   // picklist items per job card
  const [lines, setLines] = useState<ScanLine[]>([]);         // one per confirmed batch scan
  const [remark, setRemark] = useState("");
  const [receivedById, setReceivedById] = useState<number>(0);
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [currentVoucherNo, setCurrentVoucherNo] = useState("…");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Scan / modal state
  const [showJobScanner, setShowJobScanner] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showItemScanner, setShowItemScanner] = useState<{
    jobItemId: string; itemCode?: string; remainingQty: number;
  } | null>(null);
  const [pendingBatch, setPendingBatch] = useState<{
    batch: BatchInfo; jobItemId: string; remainingQty: number;
  } | null>(null);
  const [recentScans, setRecentScans] = useState<ScanLine[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Total qty issued so far for a given job item
  const issuedForItem = useCallback((jobItemId: string) =>
    lines.filter((l) => l.jobItemId === jobItemId).reduce((s, l) => s + l.issueQty, 0),
    [lines]);

  // Load departments and receivers on mount
  useEffect(() => {
    apiFetch(`${BASE_URL}/api/ItemIssueDirectAJ/DepartmentName`)
      .then((d) => { if (Array.isArray(d)) setDepartments(d); });
    apiFetch(`${BASE_URL}/api/ItemIssueDirectAJ/GetReceiverList`)
      .then((d) => { if (Array.isArray(d)) setReceivers(d); });
  }, []);

  const loadVoucherNo = useCallback(async () => {
    const raw = await apiFetch(`${BASE_URL}/api/ItemIssueDirectAJ/GetIssueNO?prefix=IS`);
    setCurrentVoucherNo(unwrap(raw) || "IS-NEW");
  }, []);

  // ── Load list ─────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const d = await apiFetch(
        `${BASE_URL}/api/ItemIssueDirectAJ/Showlist?FromDate=${fromDate}&ToDate=${toDate}&isBatchWiseChecked=false`
      );
      if (Array.isArray(d)) {
        // Aggregate: one entry per voucher, summing qty across all items
        const map = new Map<number, { row: IssueRecord; totalQty: number; itemCount: number }>();
        d.forEach((r: IssueRecord) => {
          const ex = map.get(r.TransactionID);
          if (ex) {
            ex.totalQty += (r.IssueQuantity || 0);
            ex.itemCount += 1;
          } else {
            map.set(r.TransactionID, { row: r, totalQty: r.IssueQuantity || 0, itemCount: 1 });
          }
        });
        setListData(
          Array.from(map.values()).map((v) => ({
            ...v.row,
            _totalQty: v.totalQty,
            _itemCount: v.itemCount,
          }))
        );
      } else {
        setListError(typeof d === "string" ? d : "Error loading list");
      }
    } catch {
      setListError("Network error loading list");
    }
    setLoadingList(false);
  }, [fromDate, toDate]);

  useEffect(() => { if (view === "list") loadList(); }, [view, loadList]);

  // ── Load job card items ───────────────────────────────────
  const loadJobCardItems = async (jc: JobCardRow) => {
    setSelectedJobCard(jc);
    setShowJobPicker(false);
    setLoadingItems(true);
    setJobItems([]);
    setLines([]);
    try {
      const d = await apiFetch(
        `${BASE_URL}/api/ItemIssueDirectAJ/GetPickListGridData?JobCardContentNo=${encodeURIComponent(jc.JobCardContentNo)}`
      );
      if (Array.isArray(d) && d.length > 0) {
        setJobItems(d.map((item: any) => ({
          jobItemId: Math.random().toString(36).slice(2),
          ItemID: item.ItemID || 0,
          ItemGroupID: item.ItemGroupID || 0,
          ItemCode: item.ItemCode || "",
          ItemName: item.ItemName || "",
          ItemGroup: item.ItemGroup || item.ItemGroupName || "",
          SubGroup: item.SubGroup || item.ItemSubGroupName || "",
          StockUnit: item.StockUnit || "",
          BookedQuantity: parseFloat(item.BookedQuantity) || 0,
          PendingToPick: parseFloat(item.PendingToPick) || 0,
          PhysicalStock: parseFloat(item.PhysicalStock) || 0,
          FreeStock: parseFloat(item.FreeStock) || 0,
          JobBookingJobCardContentsID: item.JobBookingJobCardContentsID || jc.JobBookingJobCardContentsID,
          JobBookingID: item.JobBookingID || jc.JobBookingID,
          ProcessID: item.ProcessID || 0,
          MachineID: item.MachineID || 0,
          picklistTransactionID: item.PicklistTransactionID || 0,
          picklistReleaseTransactionID: item.PicklistReleaseTransactionID || 0,
        })));
        setActiveTab("scan");
      } else {
        setJobItems([]);
        alert("No pending items found for this Job Card.");
      }
    } catch {
      alert("Error loading job card items.");
    }
    setLoadingItems(false);
  };

  // ── Job card QR scan ──────────────────────────────────────
  const handleJobCardScan = async (raw: string) => {
    setShowJobScanner(false);
    let jobCardNo = raw.trim();
    try { const d = JSON.parse(raw); jobCardNo = d.jobCardNo || d.JobCardContentNo || raw.trim(); } catch { }
    const d = await apiFetch(
      `${BASE_URL}/api/ItemIssueDirectAJ/GetJobCardNoscan?JobCardContentNo=${encodeURIComponent(jobCardNo)}`
    );
    if (!Array.isArray(d) || d.length === 0) {
      alert(`Job card "${jobCardNo}" not found.`); return;
    }
    const jcRow = d[0];
    loadJobCardItems({
      JobBookingID: jcRow.JobBookingID || 0,
      JobBookingJobCardContentsID: jcRow.JobBookingJobCardContentsID || 0,
      JobCardContentNo: jcRow.JobCardContentNo || jobCardNo,
      JobName: jcRow.JobName || "",
      PlanContName: jcRow.PlanContName || "",
      BookingNo: jcRow.JobBookingNo || "",
    });
  };

  // ── Batch QR scan ─────────────────────────────────────────
  const handleBatchScan = async (raw: string, jobItemId: string, remainingQty: number) => {
    setShowItemScanner(null);

    let batchNo = raw.trim();
    let itemIDHint = "";
    try {
      const d = JSON.parse(raw);
      batchNo = d.BatchNo || d.batchNo || raw.trim();
      itemIDHint = String(d.ItemID || d.itemID || "");
    } catch { }

    const jobItem = jobItemId !== "item-wise" && jobItemId !== "edit-loaded"
      ? jobItems.find((j) => j.jobItemId === jobItemId)
      : null;
    const itemIDParam = itemIDHint || (jobItem ? String(jobItem.ItemID) : "");

    const d = await apiFetch(
      `${BASE_URL}/api/ItemIssueDirectAJ/GetQRBatchNO?BatchNO=${encodeURIComponent(batchNo)}&itemID=${itemIDParam}`
    );

    if (!Array.isArray(d) || d.length === 0) {
      alert(`Batch "${batchNo}" not found in stock. Check batch number and try again.`);
      return;
    }

    const b = d[0];
    const batch: BatchInfo = {
      ItemID: b.ItemID || 0,
      ItemCode: b.ItemCode || "",
      ItemName: b.ItemName || "",
      ItemGroupID: b.ItemGroupID || 0,
      ItemGroupNameID: b.ItemGroupNameID || 0,
      ItemSubGroupID: b.ItemSubGroupID || 0,
      BatchID: b.BatchID || 0,
      BatchNo: b.BatchNo || batchNo,
      SupplierBatchNo: b.SupplierBatchNo || "",
      BatchStock: parseFloat(b.BatchStock) || 0,
      IssueQuantity: parseFloat(b.IssueQuantity) || 0,
      StockUnit: b.StockUnit || "",
      PurchaseUnit: b.PurchaseUnit || "",
      WarehouseID: b.WarehouseID || 0,
      Warehouse: b.Warehouse || "",
      Bin: b.Bin || "",
      ParentTransactionID: b.ParentTransactionID || 0,
      MfgDate: b.MfgDate,
      ExpiryDate: b.ExpiryDate,
      WtPerPacking: b.WtPerPacking || 0,
      UnitPerPacking: b.UnitPerPacking || 1,
      ConversionFactor: b.ConversionFactor || 1,
    };

    // Validate item match in job-wise mode
    if (jobItem && jobItem.ItemID && jobItem.ItemID !== batch.ItemID) {
      if (!confirm(`Scanned item (${batch.ItemCode}) does not match expected item (${jobItem.ItemCode}). Continue anyway?`)) return;
    }

    setPendingBatch({ batch, jobItemId, remainingQty });
  };

  // ── Confirm batch — always creates a new ScanLine ─────────
  const confirmIssueLine = (jobItemId: string, updates: Partial<ScanLine>) => {
    setPendingBatch(null);
    const jobItem = jobItemId !== "item-wise" && jobItemId !== "edit-loaded"
      ? jobItems.find((j) => j.jobItemId === jobItemId)
      : null;

    const newLine: ScanLine = {
      lineId: Math.random().toString(36).slice(2),
      jobItemId,
      TransactionDetailID: 0,
      ItemID: jobItem?.ItemID ?? updates.ItemID ?? 0,
      ItemGroupID: jobItem?.ItemGroupID ?? updates.ItemGroupID ?? 0,
      ItemCode: jobItem?.ItemCode ?? updates.ItemCode ?? "",
      ItemName: jobItem?.ItemName ?? updates.ItemName ?? "",
      StockUnit: jobItem?.StockUnit ?? updates.StockUnit ?? "",
      JobBookingJobCardContentsID: jobItem?.JobBookingJobCardContentsID ?? 0,
      JobBookingID: jobItem?.JobBookingID ?? 0,
      ProcessID: jobItem?.ProcessID ?? 0,
      MachineID: jobItem?.MachineID ?? 0,
      picklistTransactionID: jobItem?.picklistTransactionID ?? 0,
      picklistReleaseTransactionID: jobItem?.picklistReleaseTransactionID ?? 0,
      batchNo: "", supplierBatchNo: "", batchID: 0, parentTransactionID: 0,
      warehouseID: 0, issueQty: 0, availableQty: 0,
      fromWarehouseName: "", fromBin: "",
      floorWarehouseID: 0, floorWarehouseName: "", floorBin: "",
      slipNo: "", slipDate: "", collectedBy: "",
      jobCardContentNo: "", issueReason: "",
      jobBookingID: 0, jobBookingNo: "",
      multiJobAllocations: [],
      ...updates,
    };
    setLines((prev) => [...prev, newLine]);
    setRecentScans((prev) => [newLine, ...prev].slice(0, 10));
  };

  const removeLine = (lineId: string) => setLines((prev) => prev.filter((l) => l.lineId !== lineId));

  // ── Save ──────────────────────────────────────────────────
  const save = async () => {
    if (lines.length === 0) { alert("No batch scans to issue."); return; }
    if (!departmentID) { alert("Please select a department."); setActiveTab("basic"); return; }

    // Warn if any job item has zero scans
    if (issueMode === "Job-wise" && jobItems.length > 0) {
      const unstarted = jobItems.filter((ji) => issuedForItem(ji.jobItemId) === 0);
      if (unstarted.length > 0) {
        if (!confirm(`${unstarted.length} item(s) have no batch scans yet. Continue saving anyway?`)) return;
      }
    }

    setSaving(true);
    setSaveError("");

    const totalIssuedQty = lines.reduce((s, l) => s + (l.issueQty || 0), 0);

    const jsonObjectsRecordMain = [{
      VoucherDate: voucherDate,
      TotalQuantity: totalIssuedQty,
      DepartmentID: departmentID,
      JobBookingJobCardContentsID: lines[0]?.JobBookingJobCardContentsID || 0,
      ReceivedBy: receivedById || 0,
      GateEntryNo: lines[0]?.slipNo || "",
      GateEntryDate: lines[0]?.slipDate || voucherDate,
      Narration: remark,
      IsDeletedTransaction: 0,
    }];

    const jsonObjectsRecordDetail = lines.map((line, idx) => ({
      TransID: idx + 1,
      PicklistTransactionID: line.picklistTransactionID || 0,
      PicklistReleaseTransactionID: line.picklistReleaseTransactionID || 0,
      ItemID: line.ItemID,
      ItemGroupID: line.ItemGroupID,
      BatchID: line.batchID || 0,
      BatchNo: line.batchNo || "",
      ParentTransactionID: line.parentTransactionID || 0,
      WarehouseID: line.warehouseID || 0,
      FloorWarehouseID: line.floorWarehouseID || 0,
      IssueQuantity: line.issueQty || 0,
      RequiredQuantity: line.issueQty || 0,
      StockUnit: line.StockUnit,
      JobBookingJobCardContentsID: line.JobBookingJobCardContentsID || 0,
      JobBookingID: line.jobBookingID || line.JobBookingID || 0,
      DepartmentID: departmentID,
      ProcessID: line.ProcessID || 0,
      MachineID: line.MachineID || 0,
      Remark: line.issueReason || "",
      IsDeletedTransaction: 0,
    }));

    const ObjectsConsumeMain = [{
      VoucherDate: voucherDate,
      TotalQuantity: totalIssuedQty,
      DepartmentID: departmentID,
      Narration: remark,
      JobBookingJobCardContentsID: lines[0]?.JobBookingJobCardContentsID || 0,
    }];

    const ObjectsConsumeDetails = lines.map((line, idx) => ({
      JobBookingJobCardContentsID: line.JobBookingJobCardContentsID || 0,
      JobBookingID: line.jobBookingID || line.JobBookingID || 0,
      MachineID: line.MachineID || 0,
      ProcessID: line.ProcessID || 0,
      DepartmentID: departmentID,
      ParentTransactionID: line.parentTransactionID || 0,
      ItemID: line.ItemID,
      ItemGroupID: line.ItemGroupID || 0,
      WarehouseID: line.warehouseID || 0,
      ReceivedQuantity: line.issueQty || 0,
      BatchNo: line.batchNo || "",
      BatchID: line.batchID || 0,
      StockUnit: line.StockUnit || "",
      FloorWarehouseID: line.floorWarehouseID || 0,
      TransID: idx + 1,
    }));

    // Build multi-job allocation rows keyed by lineIndex
    const ObjectsMultiJobAllocations = lines.flatMap((line, lineIdx) =>
      (line.multiJobAllocations || []).map((alloc) => ({
        LineIndex: lineIdx,
        JobBookingID: alloc.jobBookingID,
        JobBookingNo: alloc.jobBookingNo,
        AllocatedQty: alloc.allocatedQty,
      }))
    );

    try {
      const isUpdate = !!editingID;
      const url = isUpdate
        ? `${BASE_URL}/api/ItemIssueDirectAJ/UpdateIssue?TransactionID=${editingID}`
        : `${BASE_URL}/api/ItemIssueDirectAJ/SaveIssueData?prefix=IS`;

      const res = await fetch(url, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ jsonObjectsRecordMain, jsonObjectsRecordDetail, ObjectsConsumeMain, ObjectsConsumeDetails, ObjectsMultiJobAllocations }),
      });

      const raw = await res.text();
      const result = unwrap(raw);

      if (result === "Success" || /^\d+$/.test(result)) {
        alert(isUpdate ? "Issue updated successfully." : `Issue saved! Voucher: ${currentVoucherNo}`);
        resetForm();
        setView("list");
      } else if (result.toLowerCase().includes("not authorized")) {
        setSaveError(result);
      } else {
        setSaveError(result || "Unknown error from server.");
      }
    } catch (e: any) {
      setSaveError("Network error: " + e.message);
    }
    setSaving(false);
  };

  const openNew = async () => {
    setEditingID(null);
    resetForm();
    await loadVoucherNo();
    setView("form");
  };

  const openEdit = async (rec: IssueRecord) => {
    setEditingID(rec.TransactionID);
    resetForm();
    setCurrentVoucherNo(rec.VoucherNo || "");
    setVoucherDate(rec.VoucherDate ? rec.VoucherDate.split("T")[0] : todayISO());

    const [d, allocData] = await Promise.all([
      apiFetch(`${BASE_URL}/api/ItemIssueDirectAJ/GetIssueVoucherDetails?transactionID=${rec.TransactionID}`),
      apiFetch(`${BASE_URL}/api/ItemIssueDirectAJ/GetMultiJobAllocations?transactionID=${rec.TransactionID}`),
    ]);

    if (Array.isArray(d) && d.length > 0) {
      const firstRow = d[0];
      setDepartmentID(firstRow.DepartmentID || 0);
      setReceivedById(firstRow.ReceivedBy || 0);

      // Group allocations by TransactionDetailID
      const allocMap = new Map<number, { jobBookingID: number; jobBookingNo: string; allocatedQty: number }[]>();
      if (Array.isArray(allocData)) {
        allocData.forEach((alloc: any) => {
          const detId = alloc.TransactionDetailID || 0;
          if (!allocMap.has(detId)) allocMap.set(detId, []);
          allocMap.get(detId)!.push({
            jobBookingID: alloc.JobBookingID || 0,
            jobBookingNo: alloc.JobBookingNo || "",
            allocatedQty: parseFloat(alloc.AllocatedQty) || 0,
          });
        });
      }

      setLines(d.map((row: any) => {
        const detId = row.TransactionDetailID || 0;
        const multiAllocs = allocMap.get(detId) || [];
        const hasMultiJob = multiAllocs.length > 0;
        return {
          lineId: Math.random().toString(36).slice(2),
          jobItemId: "edit-loaded",
          TransactionDetailID: detId,
          ItemID: row.ItemID || 0,
          ItemGroupID: row.ItemGroupID || 0,
          ItemCode: row.ItemCode || "",
          ItemName: row.ItemName || "",
          StockUnit: row.StockUnit || "",
          JobBookingJobCardContentsID: row.JobBookingJobCardContentsID || 0,
          JobBookingID: 0,
          ProcessID: row.ProcessID || 0,
          MachineID: row.MachineID || 0,
          batchNo: row.BatchNo || "",
          supplierBatchNo: row.SupplierBatchNo || "",
          batchID: row.BatchID || 0,
          parentTransactionID: row.ParentTransactionID || 0,
          picklistTransactionID: row.PicklistTransactionID || 0,
          picklistReleaseTransactionID: row.PicklistReleaseTransactionID || 0,
          warehouseID: row.WarehouseID || 0,
          issueQty: parseFloat(row.IssueQuantity) || 0,
          availableQty: 0,
          fromWarehouseName: row.Warehouse || "",
          fromBin: row.Bin || "",
          floorWarehouseID: row.FloorWarehouseID || 0,
          floorWarehouseName: row.FloorWarehouseName || "",
          floorBin: row.FloorBin || "",
          slipNo: row.SlipNo || "",
          slipDate: row.SlipDate || "",
          collectedBy: "",
          jobCardContentNo: row.JobCardNo || "",
          issueReason: hasMultiJob ? "For Multi Job Consumption" : (row.IssueReason || ""),
          jobBookingID: hasMultiJob ? 0 : (row.JobBookingID || 0),
          jobBookingNo: "",
          multiJobAllocations: multiAllocs,
        };
      }));
    }
    setActiveTab("items");
    setView("form");
  };

  const handleDelete = async (transactionID: number) => {
    if (!confirm("Delete this Issue voucher?")) return;
    const url = `${BASE_URL}/api/ItemIssueDirectAJ/DeleteIssue?TransactionID=${transactionID}&JobContID=0`;
    const res = await fetch(url, { method: "POST", headers: authHeaders() });
    const raw = await res.text();
    const result = unwrap(raw);
    if (result === "Success") {
      await loadList();
      alert("Issue voucher deleted successfully.");
    } else {
      alert(result || "Failed to delete");
    }
  };

  const resetForm = () => {
    setVoucherDate(todayISO()); setIssueMode("Job-wise"); setDepartmentID(0); setReceivedById(0);
    setSelectedJobCard(null); setJobItems([]); setLines([]); setRemark(""); setRecentScans([]);
    setActiveTab("basic"); setSaveError("");
  };

  const filteredList = listData.filter((r) => {
    if (!listSearch) return true;
    const s = listSearch.toLowerCase();
    return (r.VoucherNo?.toLowerCase().includes(s) ||
      r.JobCardNo?.toLowerCase().includes(s) ||
      r.DepartmentName?.toLowerCase().includes(s) ||
      r.ItemName?.toLowerCase().includes(s));
  });

  const totalScans = lines.length;

  // ══════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════
  if (view === "list") {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-1 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Item Issue</h2>
            <p className="text-sm text-gray-500">{filteredList.length} issue vouchers</p>
          </div>
          <Button variant="secondary" pill icon={<Plus size={16} />} onClick={openNew}>New Issue</Button>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">From</span>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">To</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <button onClick={loadList} disabled={loadingList}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50">
              <RefreshCw size={12} className={loadingList ? "animate-spin" : ""} /> {loadingList ? "Loading…" : "Refresh"}
            </button>
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50">
            <Search size={14} className="text-gray-400 shrink-0" />
            <Input type="text" placeholder="Search by voucher no, job card, department, item…" value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              className="flex-1" />
          </div>
        </div>

        {listError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={15} /> {listError}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Voucher No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Job Card</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Issue Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created By</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr><td colSpan={8} className="text-center py-16 text-gray-400">Loading…</td></tr>
              ) : filteredList.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-gray-400">No issue vouchers found. Click &ldquo;New Issue&rdquo; to begin.</td></tr>
              ) : filteredList.map((iss, i) => (
                <tr key={iss.TransactionID} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{iss.VoucherNo}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(iss.VoucherDate)}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{iss.DepartmentName || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{iss.JobCardNo || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {(iss._itemCount ?? 1) > 1
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">{iss._itemCount} items</span>
                      : <span className="text-gray-800">{iss.ItemName || iss.JobName || "—"}</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                    {(iss._totalQty ?? iss.IssueQuantity ?? 0).toLocaleString()} {iss.StockUnit || ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{iss.UserName || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(iss)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors">
                        <Pencil size={11} /> Edit
                      </button>
                      <button onClick={() => handleDelete(iss.TransactionID)}
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
  const showScanTab = jobItems.length > 0;

  return (
    <div className="w-full max-w-[1600px] mx-auto pb-10 px-1">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs text-gray-400 font-medium">Inventory</p>
            <h2 className="text-lg font-bold text-gray-800 leading-tight">Item Issue</h2>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-mono text-xs font-semibold border border-blue-100">
            {currentVoucherNo}
          </span>
          {editingID && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
              Editing #{editingID}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("list")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <List size={13} /> List
          </button>
          <button onClick={save}
            disabled={lines.length === 0 || saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40">
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <PackageMinus size={13} />}
            {saving ? "Saving…" : `Issue${lines.length > 0 ? ` (${lines.length})` : ""}`}
          </button>
          {editingID && (
            <button onClick={() => handleDelete(editingID)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={15} /> {saveError}
        </div>
      )}

      {/* Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Tabs */}
        <div className="px-6 pt-5 border-b border-gray-200 bg-gray-50/30">
          <div className="flex gap-1">
            {([
              { id: "basic" as const, label: "Basic", show: true },
              { id: "scan" as const, label: `Scan Details${showScanTab ? ` (${jobItems.length})` : ""}`, show: showScanTab },
              { id: "items" as const, label: `Items${totalScans > 0 ? ` (${totalScans})` : ""}`, show: true },
            ] as const)
              .filter((t) => t.show)
              .map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors -mb-px border-b-2 ${activeTab === tab.id
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
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Issue Details</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Input label="Voucher No." readOnly value={currentVoucherNo} />
                  </div>
                  <div>
                    <Input label="Issue Date" type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
                  </div>
                  <div>
                    <Select label="Department *" value={String(departmentID)} onChange={(e) => setDepartmentID(Number(e.target.value))}
                      options={[{ value: "0", label: "Select Dept…" }, ...departments.map((d) => ({ value: String(d.DepartmentID), label: d.DepartmentName }))]} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Issue Mode</label>
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                      {(["Job-wise", "Item-wise"] as const).map((m) => (
                        <button key={m}
                          onClick={() => {
                            setIssueMode(m);
                            setSelectedJobCard(null);
                            setJobItems([]);
                            setLines([]);
                            if (m === "Item-wise") setActiveTab("items");
                          }}
                          className={`flex-1 px-4 py-2 text-sm font-semibold transition-colors ${issueMode === m ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-3">
                  <div>
                    <Select label="Received By" value={String(receivedById)} onChange={(e) => setReceivedById(Number(e.target.value))}
                      options={[{ value: "0", label: "Select…" }, ...receivers.map((r) => ({ value: String(r.LedgerID), label: r.LedgerName }))]} />
                  </div>
                </div>
              </div>

              {/* Job Card selector (Job-wise only) */}
              {issueMode === "Job-wise" && (
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Job Card</p>
                  <div className="flex items-end gap-3">
                    <div className="w-56">
                      <Input label="Job Card Content No." readOnly value={selectedJobCard?.JobCardContentNo ?? ""} placeholder="Scan or pick a job card…" />
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

                  {selectedJobCard && (
                    <div className="mt-4 flex items-center gap-6 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-blue-600" />
                        <span className="font-mono font-bold text-blue-700 text-sm">{selectedJobCard.JobCardContentNo}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold text-gray-700">{selectedJobCard.JobName}</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="text-gray-600">{selectedJobCard.PlanContName}</span>
                      </div>
                      {loadingItems && <span className="text-xs text-blue-600 animate-pulse">Loading items…</span>}
                      {jobItems.length > 0 && (
                        <button onClick={() => setActiveTab("scan")}
                          className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                          View {jobItems.length} items <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SCAN TAB (Job-wise: shows job items with multi-scan per item) ── */}
          {activeTab === "scan" && showScanTab && (
            <div className="space-y-5">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2">
                Job Card Items — Scan Batches
              </p>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-6">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Required Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Issued</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Remaining</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Batches</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobItems.map((item, idx) => {
                      const issued = issuedForItem(item.jobItemId);
                      const remaining = Math.max(0, item.PendingToPick - issued);
                      const batchCount = lines.filter((l) => l.jobItemId === item.jobItemId).length;
                      const isComplete = item.PendingToPick > 0 && issued >= item.PendingToPick;
                      const isPartial = !isComplete && issued > 0;
                      const pct = item.PendingToPick > 0 ? Math.min(100, Math.round((issued / item.PendingToPick) * 100)) : 0;

                      return (
                        <tr key={item.jobItemId}
                          className={`border-t border-gray-100 ${isComplete ? "bg-green-50/40" : isPartial ? "bg-orange-50/30" : "bg-white"}`}>
                          <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-800 text-sm">{item.ItemName}</p>
                            <p className="font-mono text-xs text-blue-600">{item.ItemCode}</p>
                            {/* progress bar */}
                            <div className="mt-1.5 h-1 w-40 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isComplete ? "bg-green-500" : "bg-blue-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400">{pct}%</span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 text-xs">{item.PendingToPick} {item.StockUnit}</td>
                          <td className="px-4 py-3 text-right font-bold text-blue-700 text-xs">{issued || "—"}</td>
                          <td className="px-4 py-3 text-right text-xs">
                            {isComplete
                              ? <span className="text-green-600 font-semibold">0</span>
                              : <span className="text-orange-600 font-semibold">{remaining}</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-600">
                            {batchCount > 0 ? `${batchCount} batch${batchCount > 1 ? "es" : ""}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isComplete
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                  <CheckCircle2 size={11} /> Complete
                                </span>
                              : isPartial
                              ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-xs font-semibold">Partial</span>
                              : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">Pending</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              disabled={isComplete}
                              onClick={() => setShowItemScanner({
                                jobItemId: item.jobItemId,
                                itemCode: item.ItemCode,
                                remainingQty: remaining,
                              })}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg mx-auto transition-colors ${
                                isComplete
                                  ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                                  : "text-white bg-blue-600 hover:bg-blue-700"
                              }`}>
                              <Scan size={12} />
                              {batchCount === 0 ? "Scan Batch" : "Add Batch"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Progress summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500 flex items-center gap-4">
                <span className="font-semibold text-gray-700">{jobItems.length} items</span>
                <span>·</span>
                <span className="text-green-600 font-semibold">
                  {jobItems.filter((ji) => issuedForItem(ji.jobItemId) >= ji.PendingToPick && ji.PendingToPick > 0).length} complete
                </span>
                <span>·</span>
                <span className="text-blue-600 font-semibold">{lines.length} batch scans</span>
                <span>·</span>
                <span>Total issued: <span className="font-semibold text-gray-800">{lines.reduce((s, l) => s + l.issueQty, 0).toLocaleString()}</span></span>
              </div>

              {/* Recently scanned */}
              {recentScans.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">Recently Scanned</p>
                  <div className="space-y-2">
                    {recentScans.map((line, i) => (
                      <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-xs">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                          <div>
                            <p className="font-semibold text-gray-800">{line.ItemName}</p>
                            <p className="font-mono text-blue-600">{line.batchNo}</p>
                          </div>
                        </div>
                        <div className="text-right text-gray-600">
                          <p className="font-bold text-blue-700">{line.issueQty} {line.StockUnit}</p>
                          <p className="text-gray-500">{line.floorWarehouseName} / {line.floorBin}</p>
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
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Scanned Batches</p>
                  {/* Allow adding item-wise scans in any mode */}
                  <button onClick={() => setShowItemScanner({ jobItemId: "item-wise", itemCode: undefined, remainingQty: 0 })}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                    <Scan size={14} /> Scan Item Batch
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs" style={{ minWidth: 1100 }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {[
                          { l: "Item Code", r: false }, { l: "Item Name", r: false },
                          { l: "Issue Qty", r: true }, { l: "Unit", r: false },
                          { l: "Internal Batch", r: false }, { l: "Supplier Batch", r: false },
                          { l: "Avail. Stock", r: true },
                          { l: "From Warehouse", r: false }, { l: "From Bin", r: false },
                          { l: "To Floor WH", r: false }, { l: "To Bin", r: false },
                          { l: "Slip No.", r: false },
                          { l: "Collected By", r: false },
                          { l: "JC Content No.", r: false },
                          { l: "Issue Reason", r: false },
                          { l: "", r: false },
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
                          <td colSpan={16} className="text-center py-20 text-gray-400">
                            {issueMode === "Job-wise" && jobItems.length === 0 && !editingID
                              ? "Load a Job Card on the Basic tab, then scan batches on the Scan Details tab."
                              : issueMode === "Job-wise" && jobItems.length > 0
                              ? <button onClick={() => setActiveTab("scan")}
                                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
                                  <Scan size={14} /> Go to Scan Details
                                </button>
                              : (
                                <div className="space-y-4 flex flex-col items-center">
                                  <QrCode size={36} className="text-gray-300" />
                                  <p className="text-sm font-medium text-gray-500">No items added yet.</p>
                                  <button onClick={() => setShowItemScanner({ jobItemId: "item-wise", itemCode: undefined, remainingQty: 0 })}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                                    <Scan size={15} /> Scan Your First Batch
                                  </button>
                                </div>
                              )
                            }
                          </td>
                        </tr>
                      ) : lines.map((line, idx) => (
                        <tr key={line.lineId} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                          <td className="px-3 py-2.5 font-mono text-blue-700 font-semibold whitespace-nowrap">{line.ItemCode}</td>
                          <td className="px-3 py-2.5 text-gray-800" style={{ maxWidth: 180 }}>{line.ItemName}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-blue-700">{line.issueQty || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-700">{line.StockUnit}</td>
                          <td className="px-3 py-2.5 font-mono text-blue-600 text-[10px] whitespace-nowrap max-w-[160px] truncate">{line.batchNo || "—"}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-600">{line.supplierBatchNo || "—"}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-green-700">
                            {line.availableQty ? line.availableQty.toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{line.fromWarehouseName || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-700 font-mono">{line.fromBin || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{line.floorWarehouseName || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-700 font-mono">{line.floorBin || "—"}</td>
                          <td className="px-3 py-2.5 font-mono text-blue-600 whitespace-nowrap">{line.slipNo || "—"}</td>
                          <td className="px-3 py-2.5">
                            {line.collectedBy
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-semibold whitespace-nowrap">{line.collectedBy}</span>
                              : <span className="text-gray-300 italic">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {line.jobCardContentNo
                              ? <span className="font-mono text-[10px] text-gray-700 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 whitespace-nowrap">{line.jobCardContentNo}</span>
                              : <span className="text-gray-300 italic text-[10px]">—</span>}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {line.issueReason
                              ? line.issueReason === "For Multi Job Consumption"
                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 text-purple-700 text-[10px] font-bold">
                                    <Users size={9} /> Multi-Job ({line.multiJobAllocations?.length || 0} jobs)
                                  </span>
                                : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-[10px] font-medium">{line.issueReason}</span>
                              : <span className="text-gray-300 italic text-[10px]">—</span>}
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
                <Input value={remark} onChange={(e) => setRemark(e.target.value)}
                  placeholder="Optional notes…" />
              </div>

              {/* Summary */}
              {lines.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500 flex items-center gap-4">
                  <span><span className="font-semibold text-blue-700">{lines.length}</span> batch scan{lines.length !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>Total issued: <span className="font-semibold text-gray-800">{lines.reduce((s, l) => s + l.issueQty, 0).toLocaleString()}</span></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}

      {showJobScanner && (
        <ScannerModal
          title="Scan Job Card" hint="Scan the Job Card QR or barcode"
          onScan={handleJobCardScan}
          onClose={() => setShowJobScanner(false)}
        />
      )}

      {showJobPicker && (
        <JobCardPickerModal onSelect={loadJobCardItems} onClose={() => setShowJobPicker(false)} />
      )}

      {showItemScanner && (
        <ScannerModal
          title="Scan Item Batch QR"
          hint={showItemScanner.itemCode ? `Scanning for: ${showItemScanner.itemCode}` : "Scan GRN-generated batch QR label"}
          onScan={(raw) => handleBatchScan(raw, showItemScanner.jobItemId, showItemScanner.remainingQty)}
          onClose={() => setShowItemScanner(null)}
        />
      )}

      {pendingBatch && (
        <BatchConfirmModal
          batch={pendingBatch.batch}
          requiredQty={pendingBatch.remainingQty}
          seq={lines.length + 1}
          issueMode={issueMode}
          onConfirm={(updates) => confirmIssueLine(pendingBatch.jobItemId, updates)}
          onClose={() => setPendingBatch(null)}
        />
      )}
    </div>
  );
}
