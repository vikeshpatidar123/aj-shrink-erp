"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import jsQR from "jsqr";
import {
  X, Scan, QrCode, CheckCircle2, Pencil, Trash2, Plus,
  Camera, Keyboard, Search, Flame, RefreshCw, AlertCircle, History,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";
import { Input, Select, Textarea } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { DataTable, Column } from "@/components/tables/DataTable";

const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{title}</h3>
);

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
  if (t.startsWith('"') && t.endsWith('"')) { try { return JSON.parse(t); } catch {} }
  return t;
}

// ─── Helpers ─────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split("T")[0];

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const p = new Date(iso);
  return isNaN(p.getTime()) ? iso : p.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

// ─── Types ───────────────────────────────────────────────────

type ConsumptionRecord = {
  ConsumptionTransactionID: number;
  VoucherNo: string;
  VoucherDate: string;
  DepartmentName?: string;
  JobCardNo?: string;
  IssueNo?: string;
  ItemCode?: string;
  ItemName?: string;
  StockUnit?: string;
  ConsumeQuantity?: number;
  CreatedBy?: string;
  FYear?: string;
  IsJobWiseConsumption?: number;
  MachineName?: string;
  _itemCount?: number;
  _totalQty?: number;
};

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

// Items already issued to a job card (with remaining floor stock)
type IssuedItem = {
  issuedItemId: string;         // client-only key
  TransactionID: number;        // IssueTransactionID
  ItemID: number;
  ItemGroupID: number;
  ItemCode: string;
  ItemName: string;
  StockUnit: string;
  BatchID: number;
  BatchNo: string;
  SupplierBatchNo: string;
  IssueQuantity: number;
  FloorStock: number;           // remaining = IssueQuantity - already consumed
  JobBookingJobCardContentsID: number;
  JobBookingID: number;
  MachineID: number;
  ProcessID: number;
  DepartmentID: number;
  FloorWarehouseID: number;
  WarehouseName: string;
  ParentTransactionID: number;
};

// Batch info returned by GetIssuedBatchDetails (job-wise validation or item-wise lookup)
type BatchIssuedInfo = {
  TransactionID: number;
  ItemID: number;
  ItemCode: string;
  ItemName: string;
  ItemGroupID: number;
  BatchID: number;
  BatchNo: string;
  SupplierBatchNo: string;
  IssueQuantity: number;
  FloorStock: number;
  StockUnit: string;
  JobBookingJobCardContentsID: number;
  JobBookingID: number;
  MachineID: number;
  ProcessID: number;
  DepartmentID: number;
  FloorWarehouseID: number;
  WarehouseName: string;
  ParentTransactionID: number;
};

// One confirmed consumption line
type ConsumptionLine = {
  lineId: string;
  TransactionDetailID: number;  // 0 for new; set on edit-load
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
  IssuedQty: number;
  FloorStock: number;
  JobBookingJobCardContentsID: number;
  JobBookingID: number;
  MachineID: number;
  ProcessID: number;
  DepartmentID: number;
  FloorWarehouseID: number;
  ConsumeQuantity: number;
  batchConfirmed: boolean;
  jobCardContentNo: string;     // item-wise optional linkage
};

// ─── Scanner Modal ────────────────────────────────────────────
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
          {([
            { m: "camera" as const, icon: Camera, label: "Camera Scan" },
            { m: "manual" as const, icon: Keyboard, label: "Manual Entry" },
          ]).map(({ m, icon: Icon, label }) => (
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

// ─── Job Card Picker Modal ────────────────────────────────────
function JobCardPickerModal({ onSelect, onClose }: {
  onSelect: (jc: JobCardRow) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<JobCardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`${BASE_URL}/api/ItemConsumptionAJ/JobCardRender`)
      .then((d) => { if (Array.isArray(d)) setRows(d); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((j) => {
    const s = search.toLowerCase();
    return !s || (
      j.JobCardContentNo?.toLowerCase().includes(s) ||
      j.JobName?.toLowerCase().includes(s) ||
      j.PlanContName?.toLowerCase().includes(s) ||
      j.BookingNo?.toLowerCase().includes(s)
    );
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

// ─── Consume Confirm Modal ────────────────────────────────────
function ConsumeConfirmModal({
  batch, consumeMode, onConfirm, onClose,
}: {
  batch: BatchIssuedInfo;
  consumeMode: "Job-wise" | "Item-wise";
  onConfirm: (consumeQty: number, jobCardContentNo: string) => void;
  onClose: () => void;
}) {
  const maxQty = batch.FloorStock > 0 ? batch.FloorStock : batch.IssueQuantity;
  const [consumeQtyStr, setConsumeQtyStr] = useState(maxQty > 0 ? String(maxQty) : "");
  const [jobCardContentNo, setJobCardContentNo] = useState("");
  const [showJCScanner, setShowJCScanner] = useState(false);

  const consumeQty = parseFloat(consumeQtyStr) || 0;
  const exceedsIssued = batch.IssueQuantity > 0 && consumeQty > batch.IssueQuantity;
  const exceedsFloor = batch.FloorStock > 0 && consumeQty > batch.FloorStock;
  const canConfirm = consumeQty > 0 && !exceedsIssued && !exceedsFloor;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[800px] overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-green-300" />
            <div>
              <p className="font-semibold text-sm">Batch Confirmed — Enter Consumed Qty</p>
              <p className="text-xs text-blue-200 font-mono">{batch.BatchNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Batch / item info */}
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
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Issued Qty</p>
              <p className="font-bold text-orange-600 text-sm">{batch.IssueQuantity.toLocaleString()} {batch.StockUnit}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Remaining (Floor)</p>
              <p className={`font-bold text-sm ${batch.FloorStock > 0 ? "text-green-700" : "text-red-600"}`}>
                {batch.FloorStock > 0 ? `${batch.FloorStock.toLocaleString()} ${batch.StockUnit}` : "Fully consumed"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-wider mb-0.5">From Warehouse</p>
              <p className="text-gray-700">{batch.WarehouseName || "—"}</p>
            </div>
          </div>

          {/* Consumed qty */}
          <div>
            <Input
              label={`Consumed Qty (${batch.StockUnit}) *`}
              type="number" min={0.001} step={0.001}
              autoFocus
              value={consumeQtyStr}
              onChange={(e) => setConsumeQtyStr(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
            {exceedsIssued && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> Cannot exceed issued quantity ({batch.IssueQuantity} {batch.StockUnit})
              </p>
            )}
            {!exceedsIssued && exceedsFloor && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> Cannot exceed remaining floor stock ({batch.FloorStock} {batch.StockUnit})
              </p>
            )}
          </div>

          {/* Item-wise: optional job card content no */}
          {consumeMode === "Item-wise" && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Job Card / Content No.
                <span className="ml-1 text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={jobCardContentNo}
                  onChange={(e) => setJobCardContentNo(e.target.value)}
                  placeholder="e.g. JC-2024-00123…"
                  className="flex-1"
                />
                <button type="button" onClick={() => setShowJCScanner(true)}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors h-[38px]">
                  <Scan size={15} /><span className="hidden sm:inline">Scan</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex items-center justify-between">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => { if (canConfirm) onConfirm(consumeQty, jobCardContentNo); }}
            disabled={!canConfirm}>
            <Flame size={15} /> Confirm Consumption
          </Button>
        </div>
      </div>

      {showJCScanner && (
        <ScannerModal
          title="Scan Job Card / Content No." hint="Scan the QR or barcode"
          onScan={(val) => {
            setShowJCScanner(false);
            try {
              const d = JSON.parse(val);
              setJobCardContentNo(d.jobCardNo || d.JobCardContentNo || d.contentNo || val);
            } catch { setJobCardContentNo(val); }
          }}
          onClose={() => setShowJCScanner(false)}
        />
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function ItemConsumptionPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editingID, setEditingID] = useState<number | null>(null);

  // Date filter for list — handled entirely by the grid's own built-in date-filter icon
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // List state
  const [listData, setListData] = useState<ConsumptionRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  // Form state
  const [currentVoucherNo, setCurrentVoucherNo] = useState("…");
  const [voucherDate, setVoucherDate] = useState(todayISO());
  const [consumeMode, setConsumeMode] = useState<"Job-wise" | "Item-wise">("Job-wise");
  const [selectedJobCard, setSelectedJobCard] = useState<JobCardRow | null>(null);
  const [issuedItems, setIssuedItems] = useState<IssuedItem[]>([]);
  const [lines, setLines] = useState<ConsumptionLine[]>([]);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Job card manual entry
  const [manualJobCardNo, setManualJobCardNo] = useState("");

  // Scan / modal state
  const [showJobScanner, setShowJobScanner] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showItemScanner, setShowItemScanner] = useState<{
    issuedItemId: string;   // issued item id, or "new" for item-wise
    itemCode?: string;
    floorStock: number;
  } | null>(null);
  const [pendingBatch, setPendingBatch] = useState<{
    batch: BatchIssuedInfo;
    issuedItemId: string;
  } | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);

  // ── Load list — always loads the full history; the grid's own
  //    date-filter (below) narrows it down client-side. ───────
  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const d = await apiFetch(
        `${BASE_URL}/api/ItemConsumptionAJ/Showlist?FromDate=1900-01-01&ToDate=2099-12-31`
      );
      if (Array.isArray(d)) {
        // Aggregate per ConsumptionTransactionID
        const map = new Map<number, { row: ConsumptionRecord; totalQty: number; itemCount: number }>();
        d.forEach((r: ConsumptionRecord) => {
          const existing = map.get(r.ConsumptionTransactionID);
          if (existing) {
            existing.totalQty += r.ConsumeQuantity || 0;
            existing.itemCount += 1;
          } else {
            map.set(r.ConsumptionTransactionID, {
              row: r,
              totalQty: r.ConsumeQuantity || 0,
              itemCount: 1,
            });
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
  }, []);

  useEffect(() => { if (view === "list") loadList(); }, [view, loadList]);

  // ── Load voucher number ──────────────────────────────────
  const loadVoucherNo = useCallback(async () => {
    const raw = await apiFetch(`${BASE_URL}/api/ItemConsumptionAJ/GetConsumptionNO?prefix=CONS`);
    setCurrentVoucherNo(unwrap(raw) || "CONS-NEW");
  }, []);

  // ── Load issued items for a job card ─────────────────────
  const loadJobCardItems = async (jc: JobCardRow) => {
    setSelectedJobCard(jc);
    setShowJobPicker(false);
    setManualJobCardNo(jc.JobCardContentNo);
    setLoadingItems(true);
    setIssuedItems([]);
    setLines([]);
    try {
      const d = await apiFetch(
        `${BASE_URL}/api/ItemConsumptionAJ/GetJobCardPicklist?JobCardContentNo=${encodeURIComponent(jc.JobCardContentNo)}`
      );
      if (Array.isArray(d) && d.length > 0) {
        setIssuedItems(d.map((item: any) => ({
          issuedItemId: Math.random().toString(36).slice(2),
          TransactionID: item.TransactionID || 0,
          ItemID: item.ItemID || 0,
          ItemGroupID: item.ItemGroupID || 0,
          ItemCode: item.ItemCode || "",
          ItemName: item.ItemName || "",
          StockUnit: item.StockUnit || "",
          BatchID: item.BatchID || 0,
          BatchNo: item.BatchNo || "",
          SupplierBatchNo: item.SupplierBatchNo || "",
          IssueQuantity: parseFloat(item.IssueQuantity) || 0,
          FloorStock: parseFloat(item.FloorStock) || 0,
          JobBookingJobCardContentsID: item.JobBookingJobCardContentsID || jc.JobBookingJobCardContentsID,
          JobBookingID: item.JobBookingID || jc.JobBookingID,
          MachineID: item.MachineID || 0,
          ProcessID: item.ProcessID || 0,
          DepartmentID: item.DepartmentID || 0,
          FloorWarehouseID: item.FloorWarehouseID || 0,
          WarehouseName: item.WarehouseName || "",
          ParentTransactionID: item.ParentTransactionID || 0,
        })));
      } else {
        setIssuedItems([]);
        alert("No pending issued items found for this Job Card.");
      }
    } catch {
      alert("Error loading issued items for this job card.");
    }
    setLoadingItems(false);
  };

  // ── Job card QR scan ────────────────────────────────────
  const handleJobCardScan = async (raw: string) => {
    setShowJobScanner(false);
    let jobCardNo = raw.trim();
    try {
      const d = JSON.parse(raw);
      jobCardNo = d.jobCardNo || d.JobCardContentNo || raw.trim();
    } catch { }
    setManualJobCardNo(jobCardNo);
    await lookupJobCard(jobCardNo);
  };

  const lookupJobCard = async (jobCardNo: string) => {
    if (!jobCardNo.trim()) return;
    const d = await apiFetch(
      `${BASE_URL}/api/ItemConsumptionAJ/GetJobCardNoscan?JobCardContentNo=${encodeURIComponent(jobCardNo.trim())}`
    );
    if (!Array.isArray(d) || d.length === 0) {
      alert(`Job card "${jobCardNo}" not found.`); return;
    }
    const row = d[0];
    loadJobCardItems({
      JobBookingID: row.JobBookingID || 0,
      JobBookingJobCardContentsID: row.JobBookingJobCardContentsID || 0,
      JobCardContentNo: row.JobCardContentNo || jobCardNo,
      JobName: row.JobName || "",
      PlanContName: row.PlanContName || row.ContentName || "",
      BookingNo: row.BookingNo || row.JobBookingNo || "",
    });
  };

  // ── Batch QR scan ───────────────────────────────────────
  const handleBatchScan = async (raw: string, issuedItemId: string) => {
    setShowItemScanner(null);

    let batchNo = raw.trim();
    try {
      const d = JSON.parse(raw);
      batchNo = d.BatchNo || d.batchNo || raw.trim();
    } catch { }

    const issuedItem = issuedItemId !== "new"
      ? issuedItems.find((i) => i.issuedItemId === issuedItemId)
      : null;

    const jobCardContentNo = selectedJobCard?.JobCardContentNo || "";
    const itemIDParam = issuedItem ? String(issuedItem.ItemID) : "";
    const editParam = editingID ? `&editTransactionID=${editingID}` : "";

    const d = await apiFetch(
      `${BASE_URL}/api/ItemConsumptionAJ/GetIssuedBatchDetails?BatchNO=${encodeURIComponent(batchNo)}&JobCardContentNo=${encodeURIComponent(jobCardContentNo)}&itemID=${itemIDParam}${editParam}`
    );

    if (!Array.isArray(d) || d.length === 0) {
      alert(`Batch "${batchNo}" not found in issued floor stock. Ensure the batch was issued for this job card.`);
      return;
    }

    const b = d[0];
    const batchInfo: BatchIssuedInfo = {
      TransactionID: b.TransactionID || 0,
      ItemID: b.ItemID || 0,
      ItemCode: b.ItemCode || "",
      ItemName: b.ItemName || "",
      ItemGroupID: b.ItemGroupID || 0,
      BatchID: b.BatchID || 0,
      BatchNo: b.BatchNo || batchNo,
      SupplierBatchNo: b.SupplierBatchNo || "",
      IssueQuantity: parseFloat(b.IssueQuantity) || 0,
      FloorStock: parseFloat(b.FloorStock) || 0,
      StockUnit: b.StockUnit || "",
      JobBookingJobCardContentsID: b.JobBookingJobCardContentsID || 0,
      JobBookingID: b.JobBookingID || 0,
      MachineID: b.MachineID || 0,
      ProcessID: b.ProcessID || 0,
      DepartmentID: b.DepartmentID || 0,
      FloorWarehouseID: b.FloorWarehouseID || 0,
      WarehouseName: b.WarehouseName || "",
      ParentTransactionID: b.ParentTransactionID || 0,
    };

    // Validate item match in job-wise mode
    if (issuedItem && issuedItem.ItemID && issuedItem.ItemID !== batchInfo.ItemID) {
      if (!confirm(`Scanned item (${batchInfo.ItemCode}) does not match expected item (${issuedItem.ItemCode}). Continue anyway?`)) return;
    }

    setPendingBatch({ batch: batchInfo, issuedItemId });
  };

  // ── Confirm consumption line ────────────────────────────
  const confirmConsumptionLine = (issuedItemId: string, consumeQty: number, batch: BatchIssuedInfo, jobCardContentNo: string) => {
    setPendingBatch(null);
    const issuedItem = issuedItemId !== "new"
      ? issuedItems.find((i) => i.issuedItemId === issuedItemId)
      : null;

    const newLine: ConsumptionLine = {
      lineId: Math.random().toString(36).slice(2),
      TransactionDetailID: 0,
      IssueTransactionID: issuedItem?.TransactionID ?? batch.TransactionID,
      ParentTransactionID: issuedItem?.ParentTransactionID ?? batch.ParentTransactionID,
      ItemID: issuedItem?.ItemID ?? batch.ItemID,
      ItemGroupID: issuedItem?.ItemGroupID ?? batch.ItemGroupID,
      ItemCode: issuedItem?.ItemCode ?? batch.ItemCode,
      ItemName: issuedItem?.ItemName ?? batch.ItemName,
      StockUnit: issuedItem?.StockUnit ?? batch.StockUnit,
      BatchID: batch.BatchID,
      BatchNo: batch.BatchNo,
      SupplierBatchNo: batch.SupplierBatchNo,
      IssuedQty: batch.IssueQuantity,
      FloorStock: batch.FloorStock,
      JobBookingJobCardContentsID: issuedItem?.JobBookingJobCardContentsID ?? batch.JobBookingJobCardContentsID,
      JobBookingID: issuedItem?.JobBookingID ?? batch.JobBookingID,
      MachineID: issuedItem?.MachineID ?? batch.MachineID,
      ProcessID: issuedItem?.ProcessID ?? batch.ProcessID,
      DepartmentID: issuedItem?.DepartmentID ?? batch.DepartmentID,
      FloorWarehouseID: issuedItem?.FloorWarehouseID ?? batch.FloorWarehouseID,
      ConsumeQuantity: consumeQty,
      batchConfirmed: true,
      jobCardContentNo: jobCardContentNo || selectedJobCard?.JobCardContentNo || "",
    };

    setLines((prev) => [...prev, newLine]);
  };

  const removeLine = (lineId: string) => setLines((prev) => prev.filter((l) => l.lineId !== lineId));

  // ── Save ────────────────────────────────────────────────
  const save = async () => {
    if (lines.length === 0) { alert("No items to consume."); return; }

    setSaving(true);
    setSaveError("");

    const deptID = lines[0]?.DepartmentID || 0;
    const totalQty = lines.reduce((s, l) => s + l.ConsumeQuantity, 0);

    const jsonObjectsRecordMain = [{
      VoucherDate: voucherDate,
      TotalQuantity: totalQty,
      DepartmentID: deptID,
      JobBookingID: lines[0]?.JobBookingID || 0,
      JobBookingJobCardContentsID: lines[0]?.JobBookingJobCardContentsID || 0,
      IsJobWiseConsumption: consumeMode === "Job-wise" ? 1 : 0,
      Narration: remark,
      IsDeletedTransaction: 0,
    }];

    const jsonObjectsRecordDetail = lines.map((line, idx) => ({
      TransID: idx + 1,
      IssueTransactionID: line.IssueTransactionID,
      ParentTransactionID: line.ParentTransactionID || 0,
      ItemID: line.ItemID,
      ItemGroupID: line.ItemGroupID || 0,
      JobCardFormNo: line.jobCardContentNo || "",
      BatchID: line.BatchID || 0,
      BatchNo: line.BatchNo || "",
      IssueQuantity: line.IssuedQty || 0,
      FloorWarehouseID: line.FloorWarehouseID || 0,
      JobBookingJobCardContentsID: line.JobBookingJobCardContentsID || 0,
      JobBookingID: line.JobBookingID || 0,
      MachineID: line.MachineID || 0,
      ProcessID: line.ProcessID || 0,
      DepartmentID: line.DepartmentID || deptID,
      ConsumeQuantity: line.ConsumeQuantity,
      ReturnQuantity: 0,
      StockUnit: line.StockUnit || "",
      IsDeletedTransaction: 0,
    }));

    try {
      const isUpdate = !!editingID;
      const url = isUpdate
        ? `${BASE_URL}/api/ItemConsumptionAJ/UpdateConsumption?TransactionID=${editingID}`
        : `${BASE_URL}/api/ItemConsumptionAJ/SaveConsumption?prefix=CONS`;

      const res = await fetch(url, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ jsonObjectsRecordMain, jsonObjectsRecordDetail }),
      });

      const raw = await res.text();
      const result = unwrap(raw);

      if (result === "Success" || /^\d+$/.test(result)) {
        alert(isUpdate ? "Consumption updated successfully." : `Consumption saved! Voucher: ${currentVoucherNo}`);
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

  // ── Delete ──────────────────────────────────────────────
  const handleDelete = async (txnID: number) => {
    if (!confirm("Delete this Consumption voucher? This action cannot be undone.")) return;
    const res = await fetch(
      `${BASE_URL}/api/ItemConsumptionAJ/DeleteConsumption?TransactionID=${txnID}`,
      { method: "POST", headers: authHeaders() }
    );
    const raw = await res.text();
    const result = unwrap(raw);
    if (result === "Success") {
      if (view === "form") { resetForm(); setView("list"); }
      else { await loadList(); }
      alert("Consumption voucher deleted successfully.");
    } else {
      alert(result || "Failed to delete");
    }
  };

  // ── Open New ────────────────────────────────────────────
  const openNew = async () => {
    setEditingID(null);
    resetForm();
    await loadVoucherNo();
    setView("form");
  };

  // ── Open Edit ───────────────────────────────────────────
  const openEdit = async (rec: ConsumptionRecord) => {
    setEditingID(rec.ConsumptionTransactionID);
    resetForm();
    setCurrentVoucherNo(rec.VoucherNo || "");

    const d = await apiFetch(
      `${BASE_URL}/api/ItemConsumptionAJ/SelectedRow?transactionID=${rec.ConsumptionTransactionID}`
    );

    if (Array.isArray(d) && d.length > 0) {
      const firstRow = d[0];
      const isJobWise = Number(firstRow.IsJobWiseConsumption) === 1;
      setConsumeMode(isJobWise ? "Job-wise" : "Item-wise");
      setVoucherDate(firstRow.VoucherDateISO || todayISO());
      setRemark(firstRow.Narration || "");

      // Guard against backend JOIN fan-out: collapse duplicate detail rows by
      // ConsumptionTransactionDetailID so edit-load never shows duplicate lines
      // or double-posts quantities on save (rows without an id are kept as-is).
      const seenDetIds = new Set<number>();
      const uniqueRows = (d as any[]).filter((row: any) => {
        const detId = Number(row.ConsumptionTransactionDetailID) || 0;
        if (!detId) return true;
        if (seenDetIds.has(detId)) return false;
        seenDetIds.add(detId);
        return true;
      });

      setLines(uniqueRows.map((row: any) => ({
        lineId: Math.random().toString(36).slice(2),
        TransactionDetailID: row.ConsumptionTransactionDetailID || 0,
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
        IssuedQty: parseFloat(row.IssueQuantity) || 0,
        FloorStock: 0,
        JobBookingJobCardContentsID: row.JobBookingJobCardContentsID || 0,
        JobBookingID: row.JobBookingID || 0,
        MachineID: row.MachineID || 0,
        ProcessID: row.ProcessID || 0,
        DepartmentID: row.DepartmentID || 0,
        FloorWarehouseID: row.FloorWarehouseID || 0,
        ConsumeQuantity: parseFloat(row.ConsumeQuantity) || 0,
        batchConfirmed: true,
        jobCardContentNo: row.JobCardNo || "",
      })));

      if (isJobWise && firstRow.JobCardNo) {
        setManualJobCardNo(firstRow.JobCardNo);
      }
    }

    setView("form");
  };

  // ── Reset form ──────────────────────────────────────────
  const resetForm = () => {
    setVoucherDate(todayISO());
    setConsumeMode("Job-wise");
    setSelectedJobCard(null);
    setIssuedItems([]);
    setLines([]);
    setRemark("");
    setManualJobCardNo("");
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

  const showScanTab = consumeMode === "Job-wise" && issuedItems.length > 0;
  const totalConsumed = lines.reduce((s, l) => s + l.ConsumeQuantity, 0);

  // ── Consumption list columns (MASTER UI DataTable) ────────
  const consumptionColumns: Column<ConsumptionRecord>[] = useMemo(() => [
    { key: "VoucherNo", header: "Voucher No.", render: rec => <span className="font-mono text-xs font-semibold text-[rgb(var(--color-primary))]">{rec.VoucherNo}</span> },
    { key: "VoucherDate", header: "Date", render: rec => <span className="text-[rgb(var(--fg-muted))] text-xs">{fmtDate(rec.VoucherDate)}</span> },
    {
      key: "IsJobWiseConsumption", header: "Mode", render: rec =>
        Number(rec.IsJobWiseConsumption) === 1
          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[rgb(var(--color-primary-subtle))] text-[rgb(var(--color-primary))]">Job-wise</span>
          : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">Item-wise</span>
    },
    { key: "JobCardNo", header: "Job Card", render: rec => <span className="text-[rgb(var(--color-primary))] text-xs font-mono">{rec.JobCardNo || "—"}</span> },
    { key: "IssueNo", header: "Issue Voucher", render: rec => <span className="text-[rgb(var(--fg-muted))] text-xs">{rec.IssueNo || "—"}</span> },
    {
      key: "ItemName", header: "Items", render: rec =>
        (rec._itemCount ?? 1) > 1
          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgb(var(--color-primary-subtle))] text-[rgb(var(--color-primary))] font-semibold text-xs">{rec._itemCount} items</span>
          : <span className="text-[rgb(var(--fg-default))] text-xs">{rec.ItemName || "—"}</span>
    },
    { key: "_totalQty", header: "Total Consumed", render: rec => <span className="text-[rgb(var(--fg-default))] text-xs font-semibold">{(rec._totalQty ?? rec.ConsumeQuantity ?? 0).toLocaleString()} {rec.StockUnit || ""}</span> },
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
            <h2 className="text-xl font-bold text-[rgb(var(--fg-default))]">Item Consumption</h2>
            <p className="text-sm text-[rgb(var(--fg-muted))]">{filteredList.length} consumption vouchers</p>
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
          <Button variant="action-create" size="sm" icon={<Plus size={15} />} onClick={openNew}>New Consumption</Button>
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
            <div className="text-center py-14 text-[rgb(var(--fg-subtle))] text-sm">No consumption vouchers found. Click &ldquo;New Consumption&rdquo; to begin.</div>
          ) : (
            <div className="p-4">
              <DataTable
                data={filteredList}
                columns={consumptionColumns}
                getRowId={rec => String(rec.ConsumptionTransactionID)}
                loading={loadingList}
                dateFrom={fromDate ? new Date(fromDate) : null}
                dateTo={toDate ? new Date(toDate) : null}
                onDateFromChange={d => setFromDate(d ? d.toISOString().split("T")[0] : "")}
                onDateToChange={d => setToDate(d ? d.toISOString().split("T")[0] : "")}
                actions={rec => (
                  <div className="flex items-center gap-1.5 justify-center">
                    <Button variant="action-edit" size="xs" icon={<Pencil size={11} />} onClick={() => openEdit(rec)}>Edit</Button>
                    <Button variant="action-delete" size="xs" icon={<Trash2 size={11} />} onClick={() => handleDelete(rec.ConsumptionTransactionID)} />
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
      title={editingID ? `Edit Consumption — ${currentVoucherNo}` : "Item Consumption Creation"}
      size="2xl"
    >
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-5 flex flex-col">
        <div className="p-6 space-y-6">

          {saveError && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle size={15} /> {saveError}
            </div>
          )}

          {/* ── CONSUMPTION DETAILS ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <SectionTitle title="Consumption Details" />
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Input label="Voucher No." readOnly value={currentVoucherNo} />
              </div>
              <div>
                <Input label="Consumption Date" type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Consume Mode</label>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  {(["Job-wise", "Item-wise"] as const).map((m) => (
                    <button key={m}
                      onClick={() => {
                        setConsumeMode(m);
                        setSelectedJobCard(null);
                        setIssuedItems([]);
                        setLines([]);
                        setManualJobCardNo("");
                      }}
                      className={`flex-1 px-4 py-2 text-sm font-semibold transition-colors ${consumeMode === m ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Job card section — Job-wise only */}
          {consumeMode === "Job-wise" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <SectionTitle title="Job Card Selection" />
              <div className="flex items-end gap-3 flex-wrap">
                <div className="min-w-[240px] flex-1 max-w-sm">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Job Card Content No.
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={manualJobCardNo}
                      onChange={(e) => setManualJobCardNo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") lookupJobCard(manualJobCardNo); }}
                      placeholder="Enter / paste job card no…"
                      className="flex-1 font-mono"
                    />
                    <button
                      onClick={() => lookupJobCard(manualJobCardNo)}
                      disabled={!manualJobCardNo.trim()}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 h-[38px]">
                      <Search size={13} /> Find
                    </button>
                  </div>
                </div>
                <button onClick={() => setShowJobScanner(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                  <Scan size={15} /> Scan QR
                </button>
                <button onClick={() => setShowJobPicker(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap">
                  <Search size={15} /> Pick from List
                </button>
              </div>

              {loadingItems && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                  <RefreshCw size={14} className="animate-spin" /> Loading issued items…
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
                    {selectedJobCard.PlanContName && (
                      <span className="text-gray-500 ml-2 text-xs">· {selectedJobCard.PlanContName}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">#{selectedJobCard.BookingNo}</span>
                  <div className="ml-auto text-xs text-gray-500">
                    <span className="font-semibold text-blue-700">{issuedItems.length}</span> issued items loaded
                    {lines.length > 0 && (
                      <span className="ml-2 text-green-700 font-semibold">· {lines.length} consumed</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SCAN / ENTER ITEM BATCHES (Job-wise only, once items are loaded) ── */}
          {showScanTab && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <SectionTitle title={`Scan / Enter Item Batches (${issuedItems.length})`} />

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch No.</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Issued Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Floor Stock</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Consumed</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issuedItems.map((item, idx) => {
                      const consumed = lines
                        .filter((l) => l.ItemID === item.ItemID && l.BatchID === item.BatchID)
                        .reduce((s, l) => s + l.ConsumeQuantity, 0);
                      const fullyConsumed = item.FloorStock > 0 && consumed >= item.FloorStock;
                      return (
                        <tr key={item.issuedItemId}
                          className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-800 text-sm">{item.ItemName}</p>
                            <p className="font-mono text-xs text-blue-600">{item.ItemCode}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">
                            {item.BatchNo || <span className="text-gray-300 italic">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-600">
                            {item.IssueQuantity > 0 ? item.IssueQuantity.toLocaleString() : "—"} {item.StockUnit}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-orange-600">
                            {item.FloorStock > 0 ? item.FloorStock.toLocaleString() : "—"} {item.StockUnit}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-blue-700">
                            {consumed > 0 ? consumed.toLocaleString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {fullyConsumed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                <CheckCircle2 size={10} /> Done
                              </span>
                            ) : consumed > 0 ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold">Partial</span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-xs font-semibold">Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {!fullyConsumed && (
                              <button
                                onClick={() => setShowItemScanner({
                                  issuedItemId: item.issuedItemId,
                                  itemCode: item.ItemCode,
                                  floorStock: item.FloorStock,
                                })}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors mx-auto">
                                <Scan size={12} /> Scan Batch
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

          {/* ── CONSUMPTION LINES ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle title={`Consumption Lines${lines.length > 0 ? ` (${lines.length})` : ""}`} />
              {consumeMode === "Item-wise" && (
                <button
                  onClick={() => setShowItemScanner({ issuedItemId: "new", floorStock: 0 })}
                  className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors mb-4">
                  <Scan size={14} /> Scan Item Batch
                </button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs" style={{ minWidth: 1200 }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {[
                      { l: "Item Code", r: false }, { l: "Item Name", r: false },
                      { l: "Batch No.", r: false }, { l: "Supplier Batch", r: false },
                      { l: "Issued Qty", r: true }, { l: "Consumed Qty", r: true }, { l: "Unit", r: false },
                      { l: "Job Card No.", r: false },
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
                      <td colSpan={9} className="text-center py-16 text-gray-400">
                        {consumeMode === "Job-wise" ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-500">
                              {selectedJobCard
                                ? "Scan batches in the section above to add items here."
                                : "Load a Job Card above, then scan batches."}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4 max-w-sm mx-auto flex flex-col items-center">
                            <QrCode size={36} className="text-gray-300 mx-auto" />
                            <p className="text-sm font-medium text-gray-500">No items added yet.</p>
                            <button
                              onClick={() => setShowItemScanner({ issuedItemId: "new", floorStock: 0 })}
                              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                              <Scan size={15} /> Scan Your First Batch
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : lines.map((line, idx) => (
                    <tr key={line.lineId}
                      className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                      <td className="px-3 py-2.5 font-mono text-blue-700 font-semibold whitespace-nowrap">{line.ItemCode}</td>
                      <td className="px-3 py-2.5 text-gray-800">
                        <div className="truncate" style={{ maxWidth: 200 }} title={line.ItemName}>{line.ItemName}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-blue-600 text-[10px] whitespace-nowrap">{line.BatchNo || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-600">{line.SupplierBatchNo || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">{line.IssuedQty > 0 ? line.IssuedQty.toLocaleString() : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-blue-700 whitespace-nowrap">{line.ConsumeQuantity.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-gray-700">{line.StockUnit}</td>
                      <td className="px-3 py-2.5">
                        {line.jobCardContentNo ? (
                          <span className="font-mono text-[10px] text-gray-700 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                            {line.jobCardContentNo}
                          </span>
                        ) : <span className="text-gray-300 text-[10px] italic">—</span>}
                      </td>
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

            {/* Summary */}
            {lines.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500 flex items-center gap-4 flex-wrap">
                <span>{lines.length} item{lines.length !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span className="font-semibold text-blue-700">Total consumed: {totalConsumed.toLocaleString()}</span>
                {lines.some((l) => !l.batchConfirmed) && (
                  <>
                    <span>·</span>
                    <span className="text-orange-500">{lines.filter((l) => !l.batchConfirmed).length} pending batch</span>
                  </>
                )}
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
            icon={<Flame size={14} />}
            disabled={lines.length === 0}
            onClick={save}
          >
            {editingID ? "Update" : "Save"}{lines.length > 0 ? ` (${lines.length})` : ""}
          </Button>
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
        <JobCardPickerModal
          onSelect={loadJobCardItems}
          onClose={() => setShowJobPicker(false)}
        />
      )}

      {showItemScanner && (
        <ScannerModal
          title="Scan Item Batch QR"
          hint={showItemScanner.issuedItemId !== "new"
            ? `Scanning batch for: ${showItemScanner.itemCode ?? ""}`
            : "Scan issued batch QR label"}
          onScan={(raw) => handleBatchScan(raw, showItemScanner.issuedItemId)}
          onClose={() => setShowItemScanner(null)}
        />
      )}

      {pendingBatch && (
        <ConsumeConfirmModal
          batch={pendingBatch.batch}
          consumeMode={consumeMode}
          onConfirm={(consumeQty, jobCardContentNo) => {
            confirmConsumptionLine(pendingBatch.issuedItemId, consumeQty, pendingBatch.batch, jobCardContentNo);
          }}
          onClose={() => setPendingBatch(null)}
        />
      )}
    </Modal>
  );
}
