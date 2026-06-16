"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, Search, QrCode, ArrowLeft, Play, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle,
  ChevronRight, Settings, Check, RotateCcw, Trash2,
  ScanLine, Package, ShieldCheck, ClipboardList, Lock, Truck,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const API_START = "api/productionStartShrink";
const API_UPDATE = "api/productionUpdateShrink";
const API_FLEXO = "api/flexoproductionShrink";

// ── Helpers ────────────────────────────────────────────────────────────────────
function unwrap(raw: any): any {
  let r = raw;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}
async function apiFetch<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, { headers: authHeaders() });
  return unwrap(await res.text()) as T;
}
async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST", headers: authHeaders(), body: JSON.stringify(body),
  });
  return unwrap(await res.text()) as T;
}
function todayISO() { return new Date().toISOString().slice(0, 16); }

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS: Record<string, { bg: string; border: string; text: string; dot: string; pulse?: boolean }> = {
  "In Queue":     { bg: "bg-gray-50",      border: "border-gray-300",   text: "text-gray-500",    dot: "bg-gray-400" },
  "Running":      { bg: "bg-green-50",     border: "border-green-500",  text: "text-green-700",   dot: "bg-green-500", pulse: true },
  "Part Complete":{ bg: "bg-amber-50",     border: "border-amber-500",  text: "text-amber-700",   dot: "bg-amber-500" },
  "Complete":     { bg: "bg-emerald-50",   border: "border-emerald-600",text: "text-emerald-700", dot: "bg-emerald-600" },
  "Hold":         { bg: "bg-red-50",       border: "border-red-500",    text: "text-red-700",     dot: "bg-red-500" },
  "Shift Change": { bg: "bg-purple-50",    border: "border-purple-500", text: "text-purple-700",  dot: "bg-purple-500" },
};
function getStatus(s: string) { return STATUS[s] ?? STATUS["In Queue"]; }

// ── Update status options (no "Continuing") ────────────────────────────────────
const UPDATE_STATUSES = [
  { key: "Running",       label: "Running",       color: "bg-green-600 text-white" },
  { key: "Part Complete", label: "Part Complete", color: "bg-amber-500 text-white" },
  { key: "Complete",      label: "Complete",      color: "bg-emerald-600 text-white" },
  { key: "Hold",          label: "Hold",          color: "bg-red-600 text-white" },
  { key: "Shift Change",  label: "Shift Change",  color: "bg-purple-600 text-white" },
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface JobResult { JobBookingJobCardContentsID: number; JobBookingID: number; JobBookingNo: string; JobCardContentNo: string; JobName: string; ContentName: string; ClientName: string; PlanType: string; }
interface ContentDetail { JobBookingJobCardContentsID: number; JobBookingID: number; JobCardContentNo: string; PlanContName: string; JobName: string; ClientName: string; OrderQuantity: number; DeliveryDate: string; PlanType: string; CylinderCircumferenceMM: number; FeedValue: number; UpsL: number; UpsW: number; SizeW: number; GSM: number; PaperID: number; PaperName: string; TotalColors: number; RequiredRunningMeter: number; }
interface ProcessStatus { ProcessID: number; ProcessName: string; IsOnlineProcess: boolean; RateFactor: string; SequenceNo: number; ScheduleQty: number; MachineID: number; MachineName: string; Status: string; CompletedQty: number; RunningProductionID: number | null; IsBlocked: boolean; PaperConsumptionRequired: boolean; }
interface MachineForProcess { MachineID: number; MachineName: string; MachineCode: string; MachineSpeed: number; CurrentStatus: string; IsDefaultMachine: boolean; SpeedUnit: string; RunningJobName: string; }
interface PrevQty { ReceivedQty: number; BalanceQty: number; PrevProcessName: string; }
interface Batch { ProductionID: number; Status: string; ReadyQty: number; ProdQty: number; WastageQty: number; StartTime: string; EndTime: string; OperatorName: string; BatchNo: number; }
interface RunningJob { ProductionID: number; ProcessID: number; RateFactor: string; JobCardFormNo: string; ReceivedQuantity: number; ReadyQuantity: number; ProductionQuantity: number; WastageQuantity: number; Status: string; }
interface LCParam { LineClearanceParameterID: number; ParameterName: string; StandardValue: string; InputFieldType: string; FieldDataType: string; DefaultValue: string; SequenceNo: number; }
interface MaterialItem { BatchNo: string; SupplierBatchNo: string; ItemCode: string; ItemName: string; IssueQuantity: number; StockUnit: string; IssueTransactionID: number; }
interface JobListRow { JobBookingID: number; JobBookingNo: string; JobBookingJobCardContentsID: number; JobCardContentNo: string; JobName: string; ContentName: string; ClientName: string; BookingDate: string; OrderQuantity: number; IsClose: number; TotalProcess: number; CompletedProcess: number; FinishGoodsQty: number; DispatchedQty: number; HasQCPacking: number; HasDispatch: number; }
interface JobLock { HasQCPacking: number; HasDispatch: number; JobBookingID: number; }

// ══════════════════════════════════════════════════════════════════════════════
export default function JobProductionPage() {
  const { showToast } = useToast();

  // ── Step navigation ─────────────────────────────────────────────────────────
  type Step = "search" | "records" | "jobdetail";
  const [step, setStep] = useState<Step>("search");
  // Where the job detail was opened from, so "back" returns to the right screen
  const [detailOrigin, setDetailOrigin] = useState<"search" | "records">("search");

  // ── Job Search ───────────────────────────────────────────────────────────────
  const [searchTab, setSearchTab] = useState<"jobname" | "contentno" | "qr">("jobname");
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<JobResult[]>([]);

  // ── Records list (all/completed jobs) ─────────────────────────────────────────
  const [recFilters, setRecFilters] = useState({ jobCardNo: "", clientName: "", jobName: "", fromDate: "", toDate: "" });
  const [recRows, setRecRows] = useState<JobListRow[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recLoaded, setRecLoaded] = useState(false);

  // ── Job-level lock (QC/packing or dispatch done → deletion blocked) ───────────
  const [jobLock, setJobLock] = useState<JobLock | null>(null);
  const isJobLocked = !!jobLock && (jobLock.HasQCPacking === 1 || jobLock.HasDispatch === 1);

  // ── Delete-process (operation) state ──────────────────────────────────────────
  const [opDeleteConfirmId, setOpDeleteConfirmId] = useState<number | null>(null);
  const [opDeleting, setOpDeleting] = useState(false);

  // ── Selected Job ─────────────────────────────────────────────────────────────
  const [contentDetail, setContentDetail] = useState<ContentDetail | null>(null);
  const [processes, setProcesses] = useState<ProcessStatus[]>([]);
  const [processesLoading, setProcessesLoading] = useState(false);

  // ── Selected Process ─────────────────────────────────────────────────────────
  const [selectedProcess, setSelectedProcess] = useState<ProcessStatus | null>(null);
  const [machinesForProc, setMachinesForProc] = useState<MachineForProcess[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<MachineForProcess | null>(null);
  const [prevQty, setPrevQty] = useState<PrevQty | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [runningJob, setRunningJob] = useState<RunningJob | null>(null);

  // ── Operators ────────────────────────────────────────────────────────────────
  const [operators, setOperators] = useState<{ OperatorID: number; OperatorName: string }[]>([]);
  const [selectedOperator, setSelectedOperator] = useState(0);

  // ── Line Clearance ───────────────────────────────────────────────────────────
  const [lcParams, setLcParams] = useState<LCParam[]>([]);
  const [lcChecked, setLcChecked] = useState<Record<number, boolean>>({});
  const [observedValues, setObservedValues] = useState<Record<number, string>>({});

  // ── Material Consumption ─────────────────────────────────────────────────────
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
  const [verifiedBatches, setVerifiedBatches] = useState<Record<string, boolean>>({});
  const [qrScanRow, setQrScanRow] = useState<number | null>(null); // index of row being scanned
  const [qrScanValue, setQrScanValue] = useState("");
  const qrScanRef = useRef<HTMLInputElement>(null);

  // ── Start Production Modal ───────────────────────────────────────────────────
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [isMakeReady, setIsMakeReady] = useState(false);
  const [startTime, setStartTime] = useState(todayISO());
  const [starting, setStarting] = useState(false);

  // ── Update Production Modal ──────────────────────────────────────────────────
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [prodQty, setProdQty] = useState<string>("0");
  const [wastageQty, setWastageQty] = useState<string>("0");
  const [updateStatus, setUpdateStatus] = useState("Running");
  const [endTime, setEndTime] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [consumedQtys, setConsumedQtys] = useState<Record<number, string>>({}); // key = IssueTransactionID

  // ── Delete batch state ────────────────────────────────────────────────────────
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const qrInputRef = useRef<HTMLInputElement>(null);

  // ── Derived quantities ────────────────────────────────────────────────────────
  // BalanceQty from server already deducted this batch's ReadyQuantity — add it back
  const balanceQty = prevQty ? prevQty.BalanceQty + (runningJob?.ReadyQuantity ?? 0) : 0;
  const suspenseQty = balanceQty - parseFloat(prodQty || "0") - parseFloat(wastageQty || "0");

  // ── Predecessor / Next process ────────────────────────────────────────────────
  const predProcess = selectedProcess
    ? [...processes].filter(p => p.SequenceNo < selectedProcess.SequenceNo)
        .sort((a, b) => b.SequenceNo - a.SequenceNo)[0] ?? null
    : null;
  const nextProcess = selectedProcess
    ? [...processes].filter(p => p.SequenceNo > selectedProcess.SequenceNo)
        .sort((a, b) => a.SequenceNo - b.SequenceNo)[0] ?? null
    : null;

  // Cascading: if predecessor is Part Complete → Complete is disallowed for current
  const prevIsPartComplete = predProcess?.Status === "Part Complete";

  // Update button: show for Running/Hold/Shift Change always; for Part Complete only if next is In Queue
  const canUpdate = selectedProcess ? (
    ["Running", "Hold", "Shift Change"].includes(selectedProcess.Status) ||
    (selectedProcess.Status === "Part Complete" && (!nextProcess || nextProcess.Status === "In Queue"))
  ) : false;

  // LC + material validation
  const allLcChecked = lcParams.length === 0
    ? true
    : lcParams.every(p => (observedValues[p.LineClearanceParameterID] ?? "").trim() !== "");
  const allMaterialsVerified = materialItems.length === 0 || materialItems.every(m => verifiedBatches[m.BatchNo]);

  // ── Search Jobs ───────────────────────────────────────────────────────────────
  const searchJobs = useCallback(async (text: string) => {
    if (!text.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await apiFetch<JobResult[]>(`${API_FLEXO}/searchjobs?searchText=${encodeURIComponent(text)}`);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { showToast("error", "Error", "Search failed"); }
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (searchText.length >= 2) searchJobs(searchText); }, 400);
    return () => clearTimeout(t);
  }, [searchText, searchTab]);

  const handleQrInput = (val: string) => {
    setSearchText(val);
    if (val.length >= 3) searchJobs(val);
  };

  // ── Load Records list ─────────────────────────────────────────────────────────
  const loadRecords = useCallback(async () => {
    setRecLoading(true);
    try {
      const qs = new URLSearchParams();
      if (recFilters.jobCardNo)  qs.set("jobCardNo", recFilters.jobCardNo);
      if (recFilters.clientName) qs.set("clientName", recFilters.clientName);
      if (recFilters.jobName)    qs.set("jobName", recFilters.jobName);
      if (recFilters.fromDate)   qs.set("fromDate", recFilters.fromDate);
      if (recFilters.toDate)     qs.set("toDate", recFilters.toDate);
      const data = await apiFetch<JobListRow[]>(`${API_FLEXO}/joblist?${qs.toString()}`);
      setRecRows(Array.isArray(data) ? data : []);
    } catch { showToast("error", "Error", "Failed to load job records"); }
    setRecLoading(false);
    setRecLoaded(true);
  }, [recFilters, showToast]);

  const openRecords = () => {
    setStep("records");
    if (!recLoaded) loadRecords();
  };

  // ── Select a Job ──────────────────────────────────────────────────────────────
  const selectJob = async (job: { JobBookingJobCardContentsID: number }, origin: "search" | "records" = "search") => {
    setContentDetail(null); setProcesses([]); setSelectedProcess(null);
    setSelectedMachine(null); setBatches([]); setRunningJob(null);
    setSearchResults([]); setSearchText("");
    setJobLock(null); setOpDeleteConfirmId(null); setDeleteConfirmId(null);
    setDetailOrigin(origin);
    setProcessesLoading(true);
    setStep("jobdetail");
    try {
      const [detail, procs, lock] = await Promise.all([
        apiFetch<ContentDetail[]>(`${API_FLEXO}/contentdetails/${job.JobBookingJobCardContentsID}`),
        apiFetch<ProcessStatus[]>(`${API_FLEXO}/processstatuses/${job.JobBookingJobCardContentsID}`),
        apiFetch<JobLock[]>(`${API_FLEXO}/joblock/${job.JobBookingJobCardContentsID}`),
      ]);
      setContentDetail(Array.isArray(detail) && detail.length > 0 ? detail[0] : null);
      setProcesses(Array.isArray(procs) ? procs : []);
      setJobLock(Array.isArray(lock) && lock.length > 0 ? lock[0] : null);
    } catch { showToast("error", "Error", "Failed to load job details"); }
    setProcessesLoading(false);
  };

  // ── Refresh process statuses ──────────────────────────────────────────────────
  const refreshProcesses = async () => {
    if (!contentDetail) return;
    setProcessesLoading(true);
    try {
      const procs = await apiFetch<ProcessStatus[]>(`${API_FLEXO}/processstatuses/${contentDetail.JobBookingJobCardContentsID}`);
      setProcesses(Array.isArray(procs) ? procs : []);
    } catch { }
    setProcessesLoading(false);
  };

  // ── Select a Process card ─────────────────────────────────────────────────────
  const selectProcess = async (proc: ProcessStatus) => {
    if (proc.IsBlocked && proc.Status === "In Queue") return;
    setSelectedProcess(proc);
    setSelectedMachine(null);
    setBatches([]);
    setRunningJob(null);
    setLcParams([]);
    setLcChecked({});
    setMaterialItems([]);
    setVerifiedBatches({});

    const [macs, ops, batchData, lcData, matData] = await Promise.all([
      apiFetch<MachineForProcess[]>(`${API_FLEXO}/machines-for-process/${proc.ProcessID}`),
      apiFetch<{ OperatorID: number; OperatorName: string }[]>(`${API_FLEXO}/operators/${proc.MachineID || 0}`),
      apiFetch<Batch[]>(`${API_FLEXO}/batches/${contentDetail?.JobBookingJobCardContentsID}/${proc.ProcessID}`),
      apiFetch<LCParam[]>(`api/processmasterShrink/loadlineclearanceparameter?ProcessID=${proc.ProcessID}`),
      proc.PaperConsumptionRequired
        ? apiFetch<MaterialItem[]>(`${API_FLEXO}/papervalidation/${contentDetail?.JobBookingJobCardContentsID}/${proc.ProcessID}`)
        : Promise.resolve([]),
    ]);

    setMachinesForProc(Array.isArray(macs) ? macs : []);
    setOperators(Array.isArray(ops) ? ops : []);
    setBatches(Array.isArray(batchData) ? batchData : []);
    setLcParams(Array.isArray(lcData) ? lcData : []);
    setMaterialItems(Array.isArray(matData) ? matData : []);

    const macList = Array.isArray(macs) ? macs : [];
    const defaultMac = macList.find(m => m.MachineID === proc.MachineID)
      ?? macList.find(m => m.IsDefaultMachine)
      ?? macList[0] ?? null;
    if (defaultMac) {
      setSelectedMachine(defaultMac);
      loadPrevQtyAndRunning(proc, defaultMac);
    }
    if (Array.isArray(ops) && ops.length > 0) setSelectedOperator(ops[0].OperatorID);
  };

  const loadPrevQtyAndRunning = async (proc: ProcessStatus, mac: MachineForProcess) => {
    if (!contentDetail) return;
    const [pqData, rjData] = await Promise.all([
      apiFetch<PrevQty[]>(`${API_FLEXO}/previousreceiptqty/${contentDetail.JobBookingJobCardContentsID}/${proc.ProcessID}`),
      proc.RunningProductionID ? apiFetch<RunningJob[]>(`${API_FLEXO}/resumejob/${mac.MachineID}/${contentDetail.JobBookingJobCardContentsID}`) : Promise.resolve([]),
    ]);
    setPrevQty(Array.isArray(pqData) && pqData.length > 0 ? pqData[0] : null);
    const rj = Array.isArray(rjData)
      ? ([...rjData].sort((a, b) => b.ProductionID - a.ProductionID)
          .find(r => r.ProcessID === proc.ProcessID && r.Status !== "Complete") ?? null)
      : null;
    setRunningJob(rj);
    if (rj) {
      setProdQty(String(rj.ReadyQuantity || 0));
      setWastageQty(String(rj.WastageQuantity || 0));
    } else {
      setProdQty("0");
      setWastageQty("0");
    }
  };

  // ── Machine change ────────────────────────────────────────────────────────────
  const handleMachineChange = async (machineId: number) => {
    const mac = machinesForProc.find(m => m.MachineID === machineId) ?? null;
    setSelectedMachine(mac);
    if (mac && selectedProcess) loadPrevQtyAndRunning(selectedProcess, mac);
  };

  // ── Open Start Modal ──────────────────────────────────────────────────────────
  const openStartModal = () => {
    if (!selectedMachine) { showToast("warning", "Select Machine", "Please select a machine first"); return; }
    setIsMakeReady(false);
    setLcChecked({});
    const initObs: Record<number, string> = {};
    lcParams.forEach(p => { initObs[p.LineClearanceParameterID] = p.DefaultValue ?? ""; });
    setObservedValues(initObs);
    setVerifiedBatches({});
    setQrScanRow(null);
    setQrScanValue("");
    setStartTime(todayISO());
    setStartModalOpen(true);
  };

  // ── Open Update Modal ─────────────────────────────────────────────────────────
  const openUpdateModal = () => {
    setEndTime(todayISO());
    setUpdateStatus("Running");
    const initConsumed: Record<number, string> = {};
    materialItems.forEach(m => { initConsumed[m.IssueTransactionID] = "0"; });
    setConsumedQtys(initConsumed);
    setUpdateModalOpen(true);
  };

  // ── QR scan for material verification ────────────────────────────────────────
  const handleMaterialQrScan = (idx: number, raw: string) => {
    const parts = raw.trim().split("|");
    if (parts.length < 2) {
      showToast("warning", "Invalid QR", "Expected format: BatchNo|ItemCode"); return;
    }
    const [scannedBatch, scannedItem] = parts;
    const mat = materialItems[idx];
    if (!mat) return;
    if (mat.BatchNo.trim() !== scannedBatch.trim() || mat.ItemCode.trim() !== scannedItem.trim()) {
      showToast("error", "Mismatch", `QR does not match — expected ${mat.BatchNo}|${mat.ItemCode}`); return;
    }
    setVerifiedBatches(prev => ({ ...prev, [mat.BatchNo]: true }));
    setQrScanRow(null);
    setQrScanValue("");
    showToast("success", "Verified", `${mat.ItemName} verified`);
  };

  // ── Start Production ──────────────────────────────────────────────────────────
  const doStartProduction = async () => {
    if (!selectedProcess || !selectedMachine || !contentDetail) return;

    if (!allLcChecked) {
      showToast("warning", "Line Clearance", "All line clearance parameters must be confirmed"); return;
    }
    if (!allMaterialsVerified) {
      showToast("warning", "Material Verification", "All material batches must be QR-verified before starting"); return;
    }

    setStarting(true);
    try {
      const result = await apiPost<any>(`${API_FLEXO}/start`, {
        MachineID: selectedMachine.MachineID,
        ContentID: contentDetail.JobBookingJobCardContentsID,
        JobBookingID: contentDetail.JobBookingID,
        ProcessID: selectedProcess.ProcessID,
        RateFactor: selectedProcess.RateFactor,
        EmployeeID: selectedOperator || 0,
        ReceivedQty: prevQty?.ReceivedQty ?? selectedProcess.ScheduleQty,
        PaperID: contentDetail.PaperID ?? 0,
        FromTime: startTime,
        OnlineProcessIDs: [],
      });
      if (String(result).toLowerCase().startsWith("error")) {
        showToast("error", "Start Failed", String(result));
      } else {
        // Save line clearance results
        if (lcParams.length > 0 && result?.ProductionID) {
          await apiPost(`${API_FLEXO}/savelineclearance`, {
            ProcessID: selectedProcess.ProcessID,
            ContentID: contentDetail.JobBookingJobCardContentsID,
            JobBookingID: contentDetail.JobBookingID,
            MachineID: selectedMachine.MachineID,
            ProductionID: result.ProductionID,
            Params: lcParams.map(p => ({
              ParameterName: p.ParameterName,
              StandardValue: p.StandardValue,
              Result: observedValues[p.LineClearanceParameterID] ?? "",
            })),
          });
        }
        showToast("success", "Production Started", `${selectedProcess.ProcessName} started`);
        setStartModalOpen(false);
        await refreshProcesses();
        if (selectedProcess) selectProcess({ ...selectedProcess, Status: "Running", RunningProductionID: result?.ProductionID ?? null });
      }
    } catch { showToast("error", "Error", "Failed to start production"); }
    setStarting(false);
  };

  // ── Save Production Update ────────────────────────────────────────────────────
  const doSaveUpdate = async () => {
    if (!selectedProcess || !selectedMachine || !contentDetail || !runningJob) return;

    const prod = parseFloat(prodQty) || 0;
    const waste = parseFloat(wastageQty) || 0;

    if (prod < 0) { showToast("warning", "Invalid Qty", "Production qty cannot be negative"); return; }
    if (waste < 0) { showToast("warning", "Invalid Qty", "Wastage qty cannot be negative"); return; }
    if (updateStatus === "Complete" && prod <= 0) {
      showToast("warning", "Required", "Production qty is required to mark Complete"); return;
    }
    if (prevQty && (prod + waste) > balanceQty) {
      showToast("warning", "Exceeds Balance",
        `Prod (${prod}) + Wastage (${waste}) = ${(prod + waste).toFixed(2)} exceeds balance (${balanceQty.toFixed(2)})`);
      return;
    }
    if (updateStatus === "Part Complete" && suspenseQty <= 0) {
      showToast("warning", "Part Complete Invalid",
        "Suspense Qty must be > 0 to mark Part Complete. If all quantity is consumed, use Complete instead.");
      return;
    }
    if (updateStatus === "Complete" && prevIsPartComplete) {
      showToast("warning", "Cascading Constraint",
        `Previous process (${predProcess?.ProcessName}) is still Part Complete — current process cannot be Complete yet.`);
      return;
    }

    setSaving(true);
    try {
      const result = await apiPost<string>(`${API_UPDATE}/save`, {
        ProductionID: runningJob.ProductionID,
        ContentID: contentDetail.JobBookingJobCardContentsID,
        ProcessID: selectedProcess.ProcessID,
        MachineID: selectedMachine.MachineID,
        EmployeeID: selectedOperator || 0,
        ReadyQty: prod,
        ProdQty: prod,
        WastageQty: waste,
        SuspenseQty: suspenseQty,
        Status: updateStatus,
        ToTime: endTime,
        JobCardFormNo: runningJob.JobCardFormNo || "",
        EnablePaperConsumption: selectedProcess.PaperConsumptionRequired && materialItems.length > 0,
        PaperConsumptionItems: materialItems.map(m => ({
          IssueTransactionID: m.IssueTransactionID,
          ConsumeQuantity: parseFloat(consumedQtys[m.IssueTransactionID] || "0") || 0,
          BatchNo: m.BatchNo,
        })),
        OnlineProductionIDs: [],
      });
      if (String(result).toLowerCase().startsWith("error")) {
        showToast("error", "Save Failed", String(result));
      } else {
        showToast("success", "Updated", `Status: ${updateStatus}`);
        setUpdateModalOpen(false);
        await refreshProcesses();
        await selectProcess({ ...selectedProcess, Status: updateStatus });
      }
    } catch { showToast("error", "Error", "Failed to update production"); }
    setSaving(false);
  };

  // ── Delete a batch ────────────────────────────────────────────────────────────
  const doDeleteBatch = async (productionId: number) => {
    if (!contentDetail || !selectedProcess) return;
    setDeleting(true);
    try {
      const result = await apiPost<string>(`${API_FLEXO}/deletebatch/${productionId}`, {});
      if (String(result).toLowerCase().startsWith("error")) {
        showToast("error", "Delete Failed", String(result));
      } else {
        showToast("success", "Deleted", "Production entry removed");
        setDeleteConfirmId(null);
        setProcessesLoading(true);
        const updatedProcs = await apiFetch<ProcessStatus[]>(`${API_FLEXO}/processstatuses/${contentDetail.JobBookingJobCardContentsID}`);
        const procs = Array.isArray(updatedProcs) ? updatedProcs : [];
        setProcesses(procs);
        setProcessesLoading(false);
        const freshProc = procs.find(p => p.ProcessID === selectedProcess.ProcessID);
        if (freshProc) await selectProcess(freshProc);
      }
    } catch { showToast("error", "Error", "Failed to delete entry"); }
    setDeleting(false);
  };

  // ── Delete a whole process (operation) — only when un-produced (In Queue) ──────
  const doDeleteOperation = async (proc: ProcessStatus) => {
    if (!contentDetail) return;
    setOpDeleting(true);
    try {
      const qs = proc.RateFactor ? `?rateFactor=${encodeURIComponent(proc.RateFactor)}` : "";
      const result = await apiPost<string>(
        `${API_FLEXO}/deleteoperation/${contentDetail.JobBookingJobCardContentsID}/${proc.ProcessID}${qs}`, {});
      if (String(result).toLowerCase().startsWith("error")) {
        showToast("error", "Delete Failed", String(result));
      } else {
        showToast("success", "Deleted", `Process "${proc.ProcessName}" removed`);
        setOpDeleteConfirmId(null);
        if (selectedProcess?.ProcessID === proc.ProcessID) setSelectedProcess(null);
        await refreshProcesses();
      }
    } catch { showToast("error", "Error", "Failed to delete process"); }
    setOpDeleting(false);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ── RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-5xl mx-auto space-y-4">

      {/* ── STEP 1: JOB SEARCH ── */}
      {step === "search" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Job Production</h2>
              <p className="text-sm text-gray-500">Select a job to begin production</p>
            </div>
            <Button variant="secondary" size="md" icon={<ClipboardList size={15} />} onClick={openRecords}>
              Job Records
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-1 flex gap-1">
            {([
              { id: "jobname", label: "Job Name", icon: <Search size={14} /> },
              { id: "contentno", label: "Content No.", icon: <Settings size={14} /> },
              { id: "qr", label: "QR Scan", icon: <QrCode size={14} /> },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => { setSearchTab(tab.id); setSearchText(""); setSearchResults([]); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${searchTab === tab.id ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            {searchTab === "qr" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  <QrCode size={16} />
                  <span>Point QR scanner at job printout, or manually enter Content No.</span>
                </div>
                <input ref={qrInputRef} autoFocus type="text" value={searchText}
                  onChange={e => handleQrInput(e.target.value)}
                  placeholder="Scan QR or type Content No."
                  className="w-full px-4 py-3 border-2 border-blue-400 rounded-lg text-base focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
              </div>
            ) : (
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input autoFocus type="text" value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder={searchTab === "jobname" ? "Search by Job Name..." : "Search by Content No..."}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            )}

            {searching && (
              <div className="flex items-center gap-2 py-4 text-blue-600 text-sm justify-center">
                <Loader2 size={16} className="animate-spin" /> Searching...
              </div>
            )}
            {!searching && searchResults.length > 0 && (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {searchResults.map((job, i) => (
                  <button key={i} onClick={() => selectJob(job)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between group">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{job.JobName}</p>
                      <p className="text-xs text-gray-500">{job.JobCardContentNo} · {job.ContentName} · {job.ClientName}</p>
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">{job.PlanType || "Standard"}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </button>
                ))}
              </div>
            )}
            {!searching && searchText.length >= 2 && searchResults.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-4">No jobs found</p>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 1b: JOB RECORDS (all / completed jobs) ── */}
      {step === "records" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("search")}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Job Records</h2>
                <p className="text-xs text-gray-500">View, update and delete jobs &amp; their processes</p>
              </div>
            </div>
            <button onClick={loadRecords} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Refresh">
              <RefreshCw size={15} className={recLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              {([
                ["jobCardNo", "Job Card / Content No."],
                ["clientName", "Client Name"],
                ["jobName", "Job Name"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase">{label}</label>
                  <input type="text" value={recFilters[key]}
                    onChange={e => setRecFilters(f => ({ ...f, [key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") loadRecords(); }}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              ))}
              {([
                ["fromDate", "From Date"],
                ["toDate", "To Date"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase">{label}</label>
                  <input type="date" value={recFilters[key]}
                    onChange={e => setRecFilters(f => ({ ...f, [key]: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="primary" size="sm" icon={<Search size={14} />} onClick={loadRecords}>Apply Filters</Button>
              <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />}
                onClick={() => { setRecFilters({ jobCardNo: "", clientName: "", jobName: "", fromDate: "", toDate: "" }); }}>
                Clear
              </Button>
            </div>
          </div>

          {/* Results table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {recLoading ? (
              <div className="flex items-center justify-center py-12 text-blue-600">
                <Loader2 size={20} className="animate-spin mr-2" /> Loading records...
              </div>
            ) : recRows.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">No job records found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["Job Card No", "Job Name", "Content", "Client", "Booking", "Order Qty", "Processes", "FG Qty", "Dispatched", "Status", ""].map(h => (
                        <th key={h || "__act"} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recRows.map((r, i) => {
                      const allDone = r.TotalProcess > 0 && r.CompletedProcess >= r.TotalProcess;
                      const locked = r.HasQCPacking === 1 || r.HasDispatch === 1;
                      return (
                        <tr key={i} onClick={() => selectJob(r, "records")}
                          className="border-t border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors">
                          <td className="px-3 py-2 font-semibold text-blue-600 whitespace-nowrap">{r.JobCardContentNo || r.JobBookingNo}</td>
                          <td className="px-3 py-2 text-gray-800">{r.JobName}</td>
                          <td className="px-3 py-2 text-gray-500">{r.ContentName || "—"}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.ClientName}</td>
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.BookingDate || "—"}</td>
                          <td className="px-3 py-2 text-right font-semibold">{r.OrderQuantity}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">{r.CompletedProcess}/{r.TotalProcess}</td>
                          <td className="px-3 py-2 text-right">{r.FinishGoodsQty}</td>
                          <td className="px-3 py-2 text-right">{r.DispatchedQty}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              r.IsClose === 1 ? "bg-gray-200 text-gray-600"
                                : allDone ? "bg-emerald-50 text-emerald-700"
                                : "bg-blue-50 text-blue-700"}`}>
                              {r.IsClose === 1 ? "Closed" : allDone ? "Complete" : "In Progress"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {locked && (
                              <span title={r.HasDispatch === 1 ? "Dispatched — locked" : "QC/Packing done — locked"}>
                                <Lock size={13} className="inline text-amber-500" />
                              </span>
                            )}
                            <ChevronRight size={14} className="inline text-gray-400 ml-1" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 2: JOB DETAIL ── */}
      {step === "jobdetail" && (
        <div className="space-y-4">

          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => { setStep(detailOrigin); setContentDetail(null); setSelectedProcess(null); if (detailOrigin === "records") loadRecords(); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-lg font-bold text-gray-800">{contentDetail?.JobName ?? "Loading..."}</h2>
                <p className="text-xs text-gray-500">{contentDetail?.JobCardContentNo} · {contentDetail?.ClientName}</p>
              </div>
            </div>
            <button onClick={refreshProcesses} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <RefreshCw size={15} className={processesLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Job Info Cards */}
          {contentDetail && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                ["Content", contentDetail.PlanContName],
                ["Order Qty", contentDetail.OrderQuantity],
                ["Delivery", contentDetail.DeliveryDate],
                ["Plan Type", contentDetail.PlanType || "Standard"],
                ["Paper", contentDetail.PaperName],
                ["Colors", contentDetail.TotalColors],
                ["Reqd. RMT", contentDetail.RequiredRunningMeter],
                ["GSM", contentDetail.GSM],
              ].map(([label, value]) => (
                <div key={label as string} className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}</p>
                  <p className="text-xs font-semibold text-gray-700 mt-0.5">{value || "—"}</p>
                </div>
              ))}
            </div>
          )}

          {/* Deletion-lock banner */}
          {isJobLocked && (
            <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800">
              <Lock size={15} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Deletion locked for this job</p>
                <p className="mt-0.5">
                  {jobLock?.HasDispatch === 1 && <span className="inline-flex items-center gap-1 mr-2"><Truck size={11} /> Dispatched</span>}
                  {jobLock?.HasQCPacking === 1 && <span className="inline-flex items-center gap-1"><Package size={11} /> QC / Packing done</span>}
                  {" "}— processes and production batches can no longer be deleted. You can still view and update.
                </p>
              </div>
            </div>
          )}

          {/* Process Cards */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Processes</h3>
            {processesLoading ? (
              <div className="flex items-center justify-center py-10 text-blue-600">
                <Loader2 size={20} className="animate-spin mr-2" /> Loading...
              </div>
            ) : (
              <div className="space-y-2">
                {processes.map((proc, i) => {
                  const st = getStatus(proc.Status);
                  const isSelected = selectedProcess?.ProcessID === proc.ProcessID;
                  const isClickable = !proc.IsBlocked || proc.Status !== "In Queue";
                  // An un-produced process (still In Queue, nothing produced) can be removed
                  const canDeleteOp = !isJobLocked && proc.Status === "In Queue"
                    && proc.CompletedQty === 0 && !proc.RunningProductionID;
                  const isOpConfirming = opDeleteConfirmId === proc.ProcessID;

                  return (
                    <div key={i} onClick={() => isClickable && selectProcess(proc)}
                      className={`rounded-lg border-2 p-3 transition-all ${st.bg} ${st.border} ${isClickable ? "cursor-pointer hover:shadow-md" : "opacity-50 cursor-not-allowed"} ${isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold bg-white bg-opacity-70 rounded px-1.5 py-0.5 text-gray-600">#{proc.SequenceNo}</span>
                          <span className={`w-2 h-2 rounded-full ${st.dot} ${proc.Status === "Running" ? "animate-pulse" : ""}`} />
                          <span className={`text-sm font-semibold ${st.text}`}>{proc.ProcessName}</span>
                          {proc.IsOnlineProcess && (
                            <span className="text-[9px] font-bold bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded">ONLINE</span>
                          )}
                          {proc.PaperConsumptionRequired && (
                            <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">MATERIAL</span>
                          )}
                          {proc.IsBlocked && proc.Status === "In Queue" && (
                            <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">BLOCKED</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${st.text} bg-white bg-opacity-60`}>{proc.Status}</span>
                          <span className="text-gray-500 whitespace-nowrap">{proc.MachineName || "—"}</span>
                          {canDeleteOp && !isOpConfirming && (
                            <button onClick={(e) => { e.stopPropagation(); setOpDeleteConfirmId(proc.ProcessID); }}
                              title="Delete this process" className="p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          )}
                          {isOpConfirming && (
                            <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button onClick={(e) => { e.stopPropagation(); doDeleteOperation(proc); }} disabled={opDeleting}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                                {opDeleting ? "..." : "Delete"}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setOpDeleteConfirmId(null); }} disabled={opDeleting}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-600 hover:bg-gray-300">
                                Cancel
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-white bg-opacity-50 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${st.dot}`}
                            style={{ width: `${proc.ScheduleQty > 0 ? Math.min(100, (proc.CompletedQty / proc.ScheduleQty) * 100) : 0}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-500 whitespace-nowrap">{proc.CompletedQty} / {proc.ScheduleQty}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Process Panel */}
          {selectedProcess && (
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-blue-700">{selectedProcess.ProcessName}</h3>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatus(selectedProcess.Status).bg} ${getStatus(selectedProcess.Status).text} border ${getStatus(selectedProcess.Status).border}`}>
                  {selectedProcess.Status}
                </span>
              </div>

              {/* Machine */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Machine</label>
                <select value={selectedMachine?.MachineID ?? ""} onChange={e => handleMachineChange(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">-- Select Machine --</option>
                  {machinesForProc.map(m => (
                    <option key={m.MachineID} value={m.MachineID}>
                      {m.MachineName}{m.CurrentStatus === "Running" ? ` 🔴 [${m.RunningJobName || "Running"}]` : " 🟢 [Idle]"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Operator */}
              {operators.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Operator</label>
                  <select value={selectedOperator} onChange={e => setSelectedOperator(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value={0}>-- Select Operator --</option>
                    {operators.map(op => <option key={op.OperatorID} value={op.OperatorID}>{op.OperatorName}</option>)}
                  </select>
                </div>
              )}

              {/* Qty Summary */}
              {prevQty && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Schedule Qty", selectedProcess.ScheduleQty],
                    ["Received Qty", prevQty.ReceivedQty],
                    ["Balance Qty", prevQty.BalanceQty],
                  ].map(([label, value]) => (
                    <div key={label as string} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                      <p className="text-[10px] text-gray-400">{label}</p>
                      <p className="text-sm font-bold text-gray-700">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Cascading warning */}
              {prevIsPartComplete && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-700">
                  <AlertTriangle size={13} />
                  <span>Previous process <strong>{predProcess?.ProcessName}</strong> is Part Complete — Complete is blocked until it finishes.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {canUpdate && (
                  <Button variant="primary" size="md" icon={<RotateCcw size={15} />} onClick={openUpdateModal} className="flex-1">
                    Update Production
                  </Button>
                )}
                {(selectedProcess.Status === "In Queue" || selectedProcess.Status === "Part Complete") && (
                  <Button variant="success" size="md" icon={<Play size={15} />} onClick={openStartModal} className="flex-1">
                    {selectedProcess.Status === "Part Complete" ? "Start New Batch" : "Start Production"}
                  </Button>
                )}
                {selectedProcess.Status === "Complete" && (
                  <div className="flex-1 flex items-center justify-center py-2 text-emerald-700 font-semibold text-sm gap-2">
                    <CheckCircle2 size={16} /> Process Complete
                  </div>
                )}
              </div>

              {/* Batch History */}
              {batches.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Production Batches</p>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {["Batch", "Status", "Prod. Qty", "Wastage", "Start", "End", "Operator", ""].map(h => (
                            <th key={h || "__action"} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {batches.map((b, i) => {
                          const isDeletable = !isJobLocked && (b.Status === "Part Complete" || b.Status === "Complete");
                          const isConfirming = deleteConfirmId === b.ProductionID;
                          return (
                            <tr key={i} className={`border-t border-gray-100 hover:bg-gray-50 ${isConfirming ? "bg-red-50" : ""}`}>
                              <td className="px-3 py-1.5 font-bold text-blue-600">#{b.BatchNo}</td>
                              <td className="px-3 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getStatus(b.Status).bg} ${getStatus(b.Status).text}`}>{b.Status}</span>
                              </td>
                              <td className="px-3 py-1.5 text-right font-semibold">{b.ProdQty}</td>
                              <td className="px-3 py-1.5 text-right text-red-600">{b.WastageQty}</td>
                              <td className="px-3 py-1.5 text-gray-500">{b.StartTime || "—"}</td>
                              <td className="px-3 py-1.5 text-gray-500">{b.EndTime || "—"}</td>
                              <td className="px-3 py-1.5">{b.OperatorName || "—"}</td>
                              <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                {isDeletable && !isConfirming && (
                                  <button onClick={() => setDeleteConfirmId(b.ProductionID)} title="Delete"
                                    className="p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={12} />
                                  </button>
                                )}
                                {isConfirming && (
                                  <div className="flex items-center gap-1 justify-end">
                                    <button onClick={() => doDeleteBatch(b.ProductionID)} disabled={deleting}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                                      {deleting ? "..." : "Delete"}
                                    </button>
                                    <button onClick={() => setDeleteConfirmId(null)} disabled={deleting}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-600 hover:bg-gray-300">
                                      Cancel
                                    </button>
                                  </div>
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
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* START PRODUCTION MODAL                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal open={startModalOpen} onClose={() => setStartModalOpen(false)}
        title={`Start — ${selectedProcess?.ProcessName ?? ""}`} size="md">
        <div className="space-y-4">

          {/* Production Type */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Production Type</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setIsMakeReady(false)}
                className={`py-3 rounded-lg border-2 text-sm font-semibold transition-colors ${!isMakeReady ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}>
                <Play size={16} className="mx-auto mb-1" /> Direct Start
              </button>
              <button onClick={() => setIsMakeReady(true)}
                className={`py-3 rounded-lg border-2 text-sm font-semibold transition-colors ${isMakeReady ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}>
                <Settings size={16} className="mx-auto mb-1" /> Make Ready
              </button>
            </div>
          </div>

          {/* Line Clearance */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={13} /> Line Clearance
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {lcParams.length === 0 ? (
                <div className="flex items-center gap-3 p-3">
                  <button onClick={() => setLcChecked(prev => ({ ...prev, [0]: !prev[0] }))}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${lcChecked[0] ? "bg-green-600 border-green-600" : "border-gray-300"}`}>
                    {lcChecked[0] && <Check size={13} className="text-white" strokeWidth={3} />}
                  </button>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Line Clearance Confirmed</p>
                    <p className="text-xs text-gray-400">Machine is clean and ready for production</p>
                  </div>
                </div>
              ) : (
                lcParams.map((p, idx) => {
                  const val = observedValues[p.LineClearanceParameterID] ?? "";
                  const filled = val.trim() !== "";
                  return (
                    <div key={p.LineClearanceParameterID} className="px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-700">
                          <span className="text-gray-400 mr-1">{idx + 1}.</span>{p.ParameterName}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {p.StandardValue && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              Std: {p.StandardValue}
                            </span>
                          )}
                          {filled && <CheckCircle2 size={13} className="text-green-500" />}
                        </div>
                      </div>
                      {p.InputFieldType === "Combo Field" ? (
                        <select
                          value={val}
                          onChange={e => setObservedValues(prev => ({ ...prev, [p.LineClearanceParameterID]: e.target.value }))}
                          className={`w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none ${filled ? "border-green-300 bg-green-50" : "border-orange-300"}`}>
                          <option value="">-- Select --</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={e => setObservedValues(prev => ({ ...prev, [p.LineClearanceParameterID]: e.target.value }))}
                          placeholder="Enter observed value..."
                          className={`w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none ${filled ? "border-green-300 bg-green-50" : "border-orange-300 bg-orange-50"}`}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Material Consumption Grid */}
          {materialItems.length > 0 && (
            <div className="border border-orange-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-orange-50 border-b border-orange-200">
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={13} /> Material Verification
                </p>
                <span className="text-[10px] text-orange-600">
                  {Object.keys(verifiedBatches).length}/{materialItems.length} verified
                </span>
              </div>
              <div className="divide-y divide-orange-100">
                {materialItems.map((mat, idx) => {
                  const isVerified = !!verifiedBatches[mat.BatchNo];
                  const isScanning = qrScanRow === idx;
                  return (
                    <div key={idx} className={`p-3 ${isVerified ? "bg-green-50" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{mat.ItemName}</p>
                          <p className="text-[10px] text-gray-500">
                            {mat.ItemCode} · Batch: <span className="font-mono font-semibold text-gray-700">{mat.BatchNo}</span>
                            {mat.SupplierBatchNo ? ` · Supplier: ${mat.SupplierBatchNo}` : ""}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            Issued: <span className="font-semibold">{mat.IssueQuantity} {mat.StockUnit}</span>
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {isVerified ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 px-2 py-1 bg-green-100 rounded">
                              <CheckCircle2 size={12} /> Verified
                            </span>
                          ) : (
                            <button onClick={() => { setQrScanRow(idx); setQrScanValue(""); setTimeout(() => qrScanRef.current?.focus(), 50); }}
                              className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors">
                              <ScanLine size={12} /> Scan QR
                            </button>
                          )}
                        </div>
                      </div>
                      {isScanning && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            ref={qrScanRef}
                            type="text"
                            value={qrScanValue}
                            onChange={e => setQrScanValue(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleMaterialQrScan(idx, qrScanValue); }}
                            placeholder="Scan or type BatchNo|ItemCode"
                            className="flex-1 px-2 py-1.5 border-2 border-blue-400 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button onClick={() => handleMaterialQrScan(idx, qrScanValue)}
                            className="px-2 py-1.5 text-[10px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700">
                            Verify
                          </button>
                          <button onClick={() => { setQrScanRow(null); setQrScanValue(""); }}
                            className="px-2 py-1.5 text-[10px] font-bold bg-gray-200 text-gray-600 rounded hover:bg-gray-300">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Start Time */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Production Start Time</label>
            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Machine</span><span className="font-semibold text-gray-700">{selectedMachine?.MachineName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Schedule Qty</span><span className="font-semibold text-gray-700">{selectedProcess?.ScheduleQty}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Received Qty</span><span className="font-semibold text-gray-700">{prevQty?.ReceivedQty ?? "—"}</span></div>
            {prevQty && (
              <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                <span className="text-orange-600 font-semibold">Available Balance</span>
                <span className="font-bold text-orange-600">{prevQty.BalanceQty}</span>
              </div>
            )}
          </div>

          {/* Validation status */}
          {(lcParams.length > 0 || materialItems.length > 0) && (
            <div className="flex gap-2">
              {lcParams.length > 0 && (
                <div className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-semibold ${allLcChecked ? "bg-green-100 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {allLcChecked ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  Line Clearance {allLcChecked ? "OK" : "Incomplete"}
                </div>
              )}
              {materialItems.length > 0 && (
                <div className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-semibold ${allMaterialsVerified ? "bg-green-100 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {allMaterialsVerified ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  Materials {allMaterialsVerified ? "OK" : `${Object.keys(verifiedBatches).length}/${materialItems.length}`}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" size="md" onClick={() => setStartModalOpen(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" size="md" loading={starting} onClick={doStartProduction} className="flex-1"
              disabled={!allLcChecked || !allMaterialsVerified}>
              {starting ? "Starting..." : "Start Production"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* UPDATE PRODUCTION MODAL                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal open={updateModalOpen} onClose={() => setUpdateModalOpen(false)}
        title={`Update — ${selectedProcess?.ProcessName ?? ""}`} size="md">
        <div className="space-y-4">

          {/* Qty Display */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Schedule", selectedProcess?.ScheduleQty ?? 0, "text-blue-700"],
              ["Received", prevQty?.ReceivedQty ?? 0, "text-gray-700"],
              ["Balance", balanceQty, "text-orange-600"],
            ].map(([label, value, color]) => (
              <div key={label as string} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-[10px] text-gray-400">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Production + Wastage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Production Qty *</label>
              <input type="number" value={prodQty} onChange={e => setProdQty(e.target.value)} min={0}
                className="mt-1 w-full px-3 py-2.5 border-2 border-blue-400 rounded-lg text-lg font-bold text-center text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Wastage Qty</label>
              <input type="number" value={wastageQty} onChange={e => setWastageQty(e.target.value)} min={0}
                className="mt-1 w-full px-3 py-2.5 border-2 border-red-300 rounded-lg text-lg font-bold text-center text-red-600 focus:ring-2 focus:ring-red-400 outline-none" />
            </div>
          </div>

          {/* Suspense */}
          <div className={`rounded-lg border px-4 py-2 flex items-center justify-between ${suspenseQty < 0 ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${suspenseQty < 0 ? "text-red-600" : "text-gray-500"}`}>
              {suspenseQty < 0 ? "Exceeds Balance!" : "Suspense Qty (auto)"}
            </span>
            <span className={`text-sm font-bold ${suspenseQty < 0 ? "text-red-600" : "text-gray-700"}`}>{suspenseQty.toFixed(2)}</span>
          </div>

          {/* Material Consumption */}
          {selectedProcess?.PaperConsumptionRequired && materialItems.length > 0 && (
            <div className="border border-orange-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-orange-50 border-b border-orange-200">
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={13} /> Material Consumption
                </p>
                <span className="text-[10px] text-orange-600">{materialItems.length} item{materialItems.length > 1 ? "s" : ""} issued</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-orange-50 border-b border-orange-100">
                      <th className="px-3 py-2 text-left font-semibold text-orange-700">Item</th>
                      <th className="px-3 py-2 text-left font-semibold text-orange-700">Batch</th>
                      <th className="px-3 py-2 text-right font-semibold text-orange-700">Issued Qty</th>
                      <th className="px-3 py-2 text-right font-semibold text-orange-700 w-28">Consumed Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialItems.map((m, i) => (
                      <tr key={i} className="border-t border-orange-100 hover:bg-orange-50">
                        <td className="px-3 py-2">
                          <p className="font-semibold text-gray-800 truncate max-w-[120px]">{m.ItemName}</p>
                          <p className="text-[10px] text-gray-400">{m.ItemCode}</p>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-600">{m.BatchNo}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-700">
                          {m.IssueQuantity} <span className="text-gray-400 font-normal">{m.StockUnit}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={m.IssueQuantity}
                            value={consumedQtys[m.IssueTransactionID] ?? "0"}
                            onChange={e => setConsumedQtys(prev => ({ ...prev, [m.IssueTransactionID]: e.target.value }))}
                            className="w-24 px-2 py-1 border-2 border-orange-300 rounded text-right text-sm font-bold text-orange-700 focus:ring-2 focus:ring-orange-400 outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cascading warning */}
          {prevIsPartComplete && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-700">
              <AlertTriangle size={13} />
              <span><strong>Complete</strong> is blocked — previous process <strong>{predProcess?.ProcessName}</strong> is still Part Complete.</span>
            </div>
          )}

          {/* End time */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">End Time</label>
            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          {/* Status selection */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {UPDATE_STATUSES.map(st => {
                const isDisabled = st.key === "Complete" && prevIsPartComplete;
                return (
                  <button key={st.key}
                    onClick={() => !isDisabled && setUpdateStatus(st.key)}
                    disabled={isDisabled}
                    title={isDisabled ? "Blocked — previous process is Part Complete" : undefined}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-all
                      ${isDisabled ? "opacity-40 cursor-not-allowed border-gray-200 text-gray-400" :
                        updateStatus === st.key ? st.color + " border-transparent shadow-md scale-105" :
                        "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                    {st.label}
                  </button>
                );
              })}
            </div>
            {updateStatus === "Part Complete" && suspenseQty <= 0 && (
              <p className="mt-1.5 text-[10px] text-red-600 font-semibold">
                Part Complete requires Suspense &gt; 0. Use Complete if all qty is consumed.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" size="md" onClick={() => setUpdateModalOpen(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" size="md" loading={saving} onClick={doSaveUpdate} className="flex-1">
              {saving ? "Saving..." : "Save Update"}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
