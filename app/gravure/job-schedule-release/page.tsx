"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2, List, RefreshCw, Trash2, CheckCircle2, X,
} from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const API = "api/jobschedulereleaseShrink";

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrap(raw: any): any {
  let result = raw;
  while (typeof result === "string") {
    try { result = JSON.parse(result); } catch { break; }
  }
  return result;
}

async function apiFetch<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, { headers: authHeaders() });
  const text = await res.text();
  return unwrap(text) as T;
}

async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return unwrap(text) as T;
}

function todayStr() { return new Date().toISOString().split("T")[0]; }
function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

// ── Business Logic (migrated from legacy JS) ──────────────────────────────────

function calculateFlexoMeters(
  qty: number, sizeW: number, gsm: number,
  upsL: number, upsW: number, cylCirc: number, feedValue: number
): number {
  if (!sizeW || !gsm || !upsL || !upsW || !cylCirc) return 0;
  const widthInMM = sizeW;
  const areaPerPiece = (upsL * upsW) / 1000000;
  const weightPerPiece = areaPerPiece * gsm;
  const piecesFromQty = qty * 1000 / weightPerPiece;
  const repeatsNeeded = Math.ceil(piecesFromQty / upsL);
  return Number((repeatsNeeded * (cylCirc + feedValue) / 1000).toFixed(2));
}

function calculateScheduleQtyRMT(
  scheduleQty: number, scheduleQtyUnit: string,
  planType: string, cutL: number, speedUnit: string,
  sizeW: number, gsm: number, upsL: number, upsW: number,
  cylCircMM: number, feedValue: number
): number {
  if (speedUnit !== "RMT") return 0;
  if (planType !== "Flexo Planning") {
    return Number(((scheduleQty * cutL) / 1000).toFixed(2));
  }
  const unit = (scheduleQtyUnit || "").toLowerCase();
  if (unit.includes("meter")) return Number(scheduleQty.toFixed(2));
  if (unit.includes("kg")) {
    return calculateFlexoMeters(scheduleQty, sizeW, gsm, upsL, upsW, cylCircMM, feedValue);
  }
  return 0;
}

function calculateTotalTime(
  scheduleQty: number, scheduleQtyRMT: number,
  machineSpeed: number, isOnlineProcess: boolean
): number {
  if (isOnlineProcess) return 1;
  if (!machineSpeed || machineSpeed === 0) return 0;
  return scheduleQtyRMT > 0
    ? Number((scheduleQtyRMT / machineSpeed).toFixed(4))
    : Number((scheduleQty / machineSpeed).toFixed(4));
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Job {
  JobBookingJobCardContentsID: number;
  JobBookingID: number;
  JobCardContentNo: string;
  PlanContName: string;
  JobBookingNo: string;
  LedgerName: string;
  SalesOrderNO: string;
  PONO: string;
  CategoryName: string;
  JobBookingDate: string;
  JobName: string;
  OrderQuantity: number;
  DeliveryDate: string;
  ProductCode: string;
  JobPriority: string;
  BookingNo: string;
  ProductMasterCode: string;
  ReceiptStockQuantity: number;
}

interface ContentDetail {
  JobBookingJobCardContentsID: number;
  JobBookingID: number;
  JobCardContentNo: string;
  PlanContName: string;
  JobName: string;
  LedgerName: string;
  OrderQuantity: number;
  DeliveryDate: string;
  ProductCode: string;
  JobType: string;
  ItemCode: string;
  ItemType: string;
  ItemName: string;
  FullSheets: number;
  ActualSheets: number;
  TotalRequiredRunningMeter: number;
  RequiredRunningMeter: number;
  TotalPaperWeightInKg: number;
  PlanningMachine: string;
  PlanType: string;
  CutL: number;
  CylinderCircumferenceMM: number;
  FeedValue: number;
  UpsL: number;
  UpsW: number;
  SizeW: number;
  GSM: number;
  MachineID: number;
}

interface ProcessRow {
  SequenceNo: number;
  ProcessID: number;
  ProcessName: string;
  RateFactor: string;
  JobCardFormNo: string;
  ToBeProduceQty: number;
  TotalProduceQty: number;
  ScheduleQty: number;
  ScheduleQtyRMT: number;
  ScheduleQtyUnit: string;
  MachineID: number;
  MachineSpeed: number;
  IsOnlineProcess: boolean;
  DryingTime: number;
  TotalTimeToBeTaken: number;
  JobBookingJobCardContentsID: number;
  Processed?: boolean;
}

interface Machine {
  MachineID: number;
  MachineName: string;
  MachineSpeed: number;
  ProcessID: number;
  SpeedUnit: string;
  IsDefaultMachine: boolean;
}

interface MachineLoad {
  MachineID: number;
  MachineName: string;
  MachineLoadInHr: string;
  MachineLoad: number;
}

interface ReleasedJob {
  ScheduleID: number;
  JobBookingJobCardContentsID: number;
  JobCardContentNo: string;
  PlanContName: string;
  JobName: string;
  LedgerName: string;
  JobBookingNo: string;
  ReleasedDate: string;
  ReleasedBy: string;
  DeliveryDate: string;
  IsScheduled: boolean;
  JobPriority: string;
  PONo: string;
}

interface ReleasedDetail {
  SequenceNo: number;
  ProcessName: string;
  RateFactor: string;
  JobCardFormNo: string;
  ScheduleQty: number;
  ScheduleQtyRMT: number;
  MachineSpeed: number;
  MachineName: string;
  DryingTime: number;
}

// ── Input helpers ─────────────────────────────────────────────────────────────


// ── Main Page ─────────────────────────────────────────────────────────────────

export default function JobScheduleReleasePage() {
  const initSearch = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("search") ?? "";
  const { showToast } = useToast();

  // ── Job List State ─────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const [jcDateFrom, setJcDateFrom] = useState(thirtyDaysAgo());
  const [jcDateTo, setJcDateTo] = useState(todayStr());
  const [delDateFrom, setDelDateFrom] = useState(thirtyDaysAgo());
  const [delDateTo, setDelDateTo] = useState(todayStr());
  const [checkB, setCheckB] = useState(true);
  const [checkD, setCheckD] = useState(false);

  // ── Schedule Release Modal State ───────────────────────────────────────────
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [contentDetails, setContentDetails] = useState<ContentDetail[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentDetail | null>(null);
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineLoads, setMachineLoads] = useState<MachineLoad[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingProcess, setLoadingProcess] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Show List Modal State ──────────────────────────────────────────────────
  const [showListOpen, setShowListOpen] = useState(false);
  const [releasedJobs, setReleasedJobs] = useState<ReleasedJob[]>([]);
  const [releasedDetail, setReleasedDetail] = useState<ReleasedDetail[]>([]);
  const [selectedReleased, setSelectedReleased] = useState<ReleasedJob | null>(null);
  const [showListLoading, setShowListLoading] = useState(false);
  const [releaseDateFrom, setReleaseDateFrom] = useState(thirtyDaysAgo());
  const [releaseDateTo, setReleaseDateTo] = useState(todayStr());
  const [checkRelease, setCheckRelease] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Break Qty Modal State ──────────────────────────────────────────────────
  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [breakRowIndex, setBreakRowIndex] = useState(-1);
  const [breakQtys, setBreakQtys] = useState<string[]>(["", "", "", "", ""]);

  // ── Load Machines Once ─────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<Machine[]>(`${API}/machines`)
      .then(data => { if (Array.isArray(data)) setMachines(data); })
      .catch(() => { });
  }, []);

  // ── Fetch Job List ─────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const params = new URLSearchParams({
        jcDateFrom, jcDateTo,
        checkB: String(checkB),
        checkD: String(checkD),
        delDateFrom, delDateTo,
      });
      const data = await apiFetch<Job[]>(`${API}/joblist?${params}`);
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      showToast("error", "Error", "Failed to load job list");
    }
    setJobsLoading(false);
  }, [jcDateFrom, jcDateTo, checkB, checkD, delDateFrom, delDateTo]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadJobs(); }, []);

  // ── Load Process Rows for a Content ───────────────────────────────────────
  // Defined before openScheduleModal so the closure captures the correct reference
  const loadProcessRows = useCallback(async (content: ContentDetail, contentsId: number) => {
    setLoadingProcess(true);
    try {
      const rows = await apiFetch<ProcessRow[]>(`${API}/formwiseprocess/${contentsId}`);
      if (!Array.isArray(rows)) { setProcessRows([]); return; }

      const enriched = rows.map(row => {
        const machineForRow = findBestMachine(row.ProcessID, row.MachineID || content.MachineID, machines);
        const machineId = machineForRow?.MachineID ?? 0;
        const machineSpeed = machineForRow?.MachineSpeed ?? 0;
        const speedUnit = machineForRow?.SpeedUnit ?? "";

        const scheduleQtyRMT = calculateScheduleQtyRMT(
          row.ScheduleQty, row.ScheduleQtyUnit ?? "",
          content.PlanType, content.CutL,
          speedUnit, content.SizeW, content.GSM,
          content.UpsL, content.UpsW,
          content.CylinderCircumferenceMM, content.FeedValue
        );

        const totalTime = calculateTotalTime(row.ScheduleQty, scheduleQtyRMT, machineSpeed, !!row.IsOnlineProcess);

        return {
          ...row,
          MachineID: machineId,
          MachineSpeed: machineSpeed,
          ScheduleQtyRMT: scheduleQtyRMT,
          TotalTimeToBeTaken: totalTime,
          JobBookingJobCardContentsID: contentsId,
        };
      });

      setProcessRows(enriched);
    } catch {
      showToast("error", "Error", "Failed to load process details");
    }
    setLoadingProcess(false);
  }, [machines]);

  // ── Open Schedule Modal ────────────────────────────────────────────────────
  // OLD flow: modal opens → content table loads → user clicks content row → process grid loads
  // Process grid is intentionally left empty until the user selects a content row
  const openScheduleModal = useCallback(async (job: Job) => {
    setSelectedJob(job);
    setContentDetails([]);
    setSelectedContent(null);
    setProcessRows([]);
    setMachineLoads([]);
    setScheduleModalOpen(true);
    setLoadingContent(true);

    try {
      const contents = await apiFetch<ContentDetail[]>(`${API}/scheduleplanner/${job.JobBookingID}`);
      setContentDetails(Array.isArray(contents) ? contents : []);
    } catch {
      showToast("error", "Error", "Failed to load content details");
    }
    setLoadingContent(false);
  }, []);

  // ── Find Best Machine for a Process ───────────────────────────────────────
  function findBestMachine(processId: number, preferredMachineId: number, allMachines: Machine[]): Machine | null {
    if (preferredMachineId > 0) {
      const exact = allMachines.find(m => m.MachineID === preferredMachineId && m.ProcessID === processId);
      if (exact) return exact;
    }
    const defaultMachine = allMachines.find(m => m.ProcessID === processId && m.IsDefaultMachine);
    if (defaultMachine) return defaultMachine;
    return allMachines.find(m => m.ProcessID === processId) ?? null;
  }

  // ── Update a Process Row Field ─────────────────────────────────────────────
  const updateProcessRow = useCallback((index: number, field: keyof ProcessRow, value: any) => {
    setProcessRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      if (field === "MachineID") {
        const m = machines.find(m => m.MachineID === Number(value) && m.ProcessID === row.ProcessID);
        if (m) row.MachineSpeed = m.MachineSpeed;
      }

      if (field === "ScheduleQty" || field === "MachineID" || field === "MachineSpeed") {
        const m = machines.find(m => m.MachineID === row.MachineID && m.ProcessID === row.ProcessID);
        const speedUnit = m?.SpeedUnit ?? "";
        const content = selectedContent;
        if (content) {
          row.ScheduleQtyRMT = calculateScheduleQtyRMT(
            Number(row.ScheduleQty), row.ScheduleQtyUnit ?? "",
            content.PlanType, content.CutL, speedUnit,
            content.SizeW, content.GSM, content.UpsL, content.UpsW,
            content.CylinderCircumferenceMM, content.FeedValue
          );
        }
      }

      row.TotalTimeToBeTaken = calculateTotalTime(
        Number(row.ScheduleQty), Number(row.ScheduleQtyRMT),
        Number(row.MachineSpeed), !!row.IsOnlineProcess
      );

      updated[index] = row;
      return updated;
    });
  }, [machines, selectedContent]);

  // ── Machine Loads for Selected Process ─────────────────────────────────────
  const loadMachineLoads = useCallback(async (processId: number) => {
    try {
      const data = await apiFetch<MachineLoad[]>(`${API}/machineloads/${processId}`);
      setMachineLoads(Array.isArray(data) ? data : []);
    } catch { }
  }, []);

  // ── Validate & Save Schedule ───────────────────────────────────────────────
  const saveSchedule = async () => {
    if (!selectedContent || processRows.length === 0) {
      showToast("warning", "Warning", "No process data to save");
      return;
    }

    // Validate: for each process+rateFactor group, scheduleQty sum >= toBeProduceQty
    const groupMap = new Map<string, { total: number; toBeProduceQty: number; processName: string }>();
    for (const row of processRows) {
      const key = `${row.ProcessID}_${row.RateFactor}`;
      const existing = groupMap.get(key) ?? { total: 0, toBeProduceQty: row.ToBeProduceQty, processName: row.ProcessName };
      existing.total += Number(row.ScheduleQty) || 0;
      groupMap.set(key, existing);
    }

    for (const [, group] of groupMap) {
      if (group.total < group.toBeProduceQty) {
        showToast("warning", "Validation", `Schedule qty for '${group.processName}' is less than required (${group.toBeProduceQty})`);
        return;
      }
    }

    // Validate all rows have machine assigned
    const noMachine = processRows.find(r => !r.MachineID || r.MachineID === 0);
    if (noMachine) {
      showToast("warning", "Validation", `Please assign a machine for process '${noMachine.ProcessName}'`);
      return;
    }

    setSaving(true);
    try {
      const finalGridDetail = processRows.map((row, i) => ({
        JobBookingJobCardContentsID: selectedContent.JobBookingJobCardContentsID,
        JobBookingID: selectedContent.JobBookingID,
        ProcessID: row.ProcessID,
        ProcessName: row.ProcessName,
        MachineID: row.MachineID,
        ScheduleQty: Number(row.ScheduleQty) || 0,
        MachineSpeed: Number(row.MachineSpeed) || 0,
        DryingTime: Number(row.DryingTime) || 0,
        TotalTimeToBeTaken: Number(row.TotalTimeToBeTaken) || 0,
        RateFactor: row.RateFactor,
        IsOnlineProcess: row.IsOnlineProcess ? 1 : 0,
        ScheduleQtyRMT: Number(row.ScheduleQtyRMT) || 0,
        JobCardFormNo: row.JobCardFormNo,
        SequenceNo: i + 1,
        JobName: selectedContent.JobName,
        ContentName: selectedContent.PlanContName,
        JobCardContentNo: selectedContent.JobCardContentNo,
      }));

      const objUpdateDataSeq = [{ JobBookingJobCardContentsID: selectedContent.JobBookingJobCardContentsID }];

      const result = await apiPost<string>(`${API}/save`, { FinalGridDetail: finalGridDetail, Obj_UpdateDataSeq: objUpdateDataSeq });

      if (String(result).toLowerCase().startsWith("error")) {
        showToast("error", "Save Failed", String(result));
      } else {
        showToast("success", "Success", "Schedule released successfully");
        setScheduleModalOpen(false);
        loadJobs();
      }
    } catch {
      showToast("error", "Error", "Failed to save schedule");
    }
    setSaving(false);
  };

  // ── Show List: Load Released Schedules ────────────────────────────────────
  const loadReleasedList = useCallback(async () => {
    setShowListLoading(true);
    setReleasedDetail([]);
    setSelectedReleased(null);
    try {
      const params = new URLSearchParams({
        releaseDateFrom, releaseDateTo, checkB: String(checkRelease),
      });
      const data = await apiFetch<ReleasedJob[]>(`${API}/showlist?${params}`);
      setReleasedJobs(Array.isArray(data) ? data : []);
    } catch {
      showToast("error", "Error", "Failed to load released schedules");
    }
    setShowListLoading(false);
  }, [releaseDateFrom, releaseDateTo, checkRelease]);

  const openShowList = () => {
    setShowListOpen(true);
    loadReleasedList();
  };

  const selectReleasedRow = async (row: ReleasedJob) => {
    setSelectedReleased(row);
    try {
      const detail = await apiFetch<ReleasedDetail[]>(`${API}/releaseddetail/${row.ScheduleID}`);
      setReleasedDetail(Array.isArray(detail) ? detail : []);
    } catch { }
  };

  const deleteReleasedSchedule = async () => {
    if (!selectedReleased) { showToast("warning", "Select a schedule to delete"); return; }
    if (!confirm(`Delete schedule for "${selectedReleased.JobName}"? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const result = await apiPost<string>(`${API}/delete`, {
        JobScheduleID: selectedReleased.ScheduleID,
        JobContentsID: selectedReleased.JobBookingJobCardContentsID,
      });
      if (String(result).toLowerCase().startsWith("error")) {
        showToast("error", "Delete Failed", String(result));
      } else {
        showToast("success", "Deleted", "Schedule deleted successfully");
        setSelectedReleased(null);
        setReleasedDetail([]);
        loadReleasedList();
        loadJobs();
      }
    } catch {
      showToast("error", "Error", "Failed to delete schedule");
    }
    setDeleting(false);
  };

  // ── Break Qty Logic ────────────────────────────────────────────────────────
  const openBreakModal = (rowIndex: number) => {
    const row = processRows[rowIndex];
    if (!row) return;
    setBreakRowIndex(rowIndex);
    setBreakQtys([String(row.ToBeProduceQty), "", "", "", ""]);
    setBreakModalOpen(true);
  };

  const breakTotalQty = breakQtys.reduce((acc, q) => acc + (parseFloat(q) || 0), 0);

  const applyBreak = () => {
    const quantities = breakQtys.map(q => parseFloat(q) || 0).filter(q => q > 0);
    if (quantities.length === 0) { setBreakModalOpen(false); return; }

    const totalQty = quantities.reduce((a, b) => a + b, 0);
    const originalRow = processRows[breakRowIndex];
    const newRows = quantities.map((qty, i) => ({
      ...originalRow,
      ScheduleQty: qty,
      ToBeProduceQty: qty,
      TotalProduceQty: totalQty,
      ScheduleQtyRMT: 0,
      Processed: true,
      SequenceNo: originalRow.SequenceNo + i,
    }));

    setProcessRows(prev => {
      const copy = [...prev];
      copy.splice(breakRowIndex, 1, ...newRows);
      return copy;
    });
    setBreakModalOpen(false);
  };

  // ── Machines filtered by ProcessID ────────────────────────────────────────
  function machinesForProcess(processId: number): Machine[] {
    return machines.filter(m => m.ProcessID === processId);
  }

  // ── Job List Columns ───────────────────────────────────────────────────────
  const jobColumns = useMemo((): Column<Job>[] => [
    { key: "JobCardContentNo", header: "Content No", sortable: true },
    { key: "JobName", header: "Job Name", sortable: true },
    { key: "PlanContName", header: "Content Name", sortable: true },
    { key: "LedgerName", header: "Client", sortable: true },
    { key: "JobBookingNo", header: "JC No", sortable: true },
    { key: "JobBookingDate", header: "JC Date", sortable: true },
    { key: "OrderQuantity", header: "JC Qty", sortable: true },
    { key: "DeliveryDate", header: "Delivery Date", sortable: true },
    { key: "JobPriority", header: "Priority", sortable: true },
    {
      key: "ReceiptStockQuantity", header: "Material Rcvd",
      render: (row) => <span className={Number(row.ReceiptStockQuantity) > 0 ? "text-green-600 font-semibold" : "text-gray-400"}>{row.ReceiptStockQuantity || 0}</span>
    },
  ], []);

  // ── Released Jobs Columns ─────────────────────────────────────────────────
  const releasedCols = useMemo((): Column<ReleasedJob>[] => [
    { key: "JobCardContentNo", header: "Content No" },
    { key: "JobName", header: "Job Name" },
    { key: "PlanContName", header: "Content" },
    { key: "LedgerName", header: "Client" },
    { key: "ReleasedDate", header: "Released On" },
    { key: "ReleasedBy", header: "Released By" },
    { key: "DeliveryDate", header: "Delivery Date" },
    {
      key: "IsScheduled", header: "Scheduled",
      render: (row) => row.IsScheduled
        ? <CheckCircle2 size={16} className="text-green-500" />
        : <span className="text-gray-400 text-xs">—</span>
    },
  ], []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Job Schedule Release</h2>
          <p className="text-sm text-gray-500">{jobs.length} pending jobs</p>
        </div>
        <Button variant="secondary" size="sm" icon={<List size={15} />} onClick={openShowList}>
          Show List
        </Button>
      </div>

      {/* ── Date Filters ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3">
        <div className="flex flex-wrap items-center gap-4">
          {/* Booking Date filter */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="chkB" checked={checkB} onChange={e => setCheckB(e.target.checked)}
              className="w-4 h-4 accent-blue-600" />
            <label htmlFor="chkB" className="text-xs font-semibold text-gray-600">Booking Date</label>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">From</label>
            <Input type="date" value={jcDateFrom} onChange={e => setJcDateFrom(e.target.value)} disabled={!checkB} />
            <label className="text-xs text-gray-500">To</label>
            <Input type="date" value={jcDateTo} onChange={e => setJcDateTo(e.target.value)} disabled={!checkB} />
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* Delivery Date filter */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="chkD" checked={checkD} onChange={e => setCheckD(e.target.checked)}
              className="w-4 h-4 accent-blue-600" />
            <label htmlFor="chkD" className="text-xs font-semibold text-gray-600">Delivery Date</label>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">From</label>
            <Input type="date" value={delDateFrom} onChange={e => setDelDateFrom(e.target.value)} disabled={!checkD} />
            <label className="text-xs text-gray-500">To</label>
            <Input type="date" value={delDateTo} onChange={e => setDelDateTo(e.target.value)} disabled={!checkD} />
          </div>

          <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={loadJobs} loading={jobsLoading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Job List Grid ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        {jobsLoading ? (
          <div className="flex items-center justify-center py-16 text-blue-600">
            <Loader2 size={24} className="animate-spin mr-2" /> Loading jobs...
          </div>
        ) : (
          <DataTable
            data={jobs.map(j => ({ ...j, id: String(j.JobBookingJobCardContentsID) }))}
            columns={jobColumns}
            searchKeys={["JobName", "LedgerName", "JobBookingNo", "JobCardContentNo", "PlanContName"]}
            initialSearch={initSearch}
            actions={(row) => (
              <Button variant="primary" size="sm" onClick={() => openScheduleModal(row as unknown as Job)}>
                Schedule Release
              </Button>
            )}
          />
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Schedule Release Modal ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={selectedJob ? `Schedule Release — ${selectedJob.JobName}` : "Schedule Release"}
        size="xl"
      >
        <div className="space-y-4">

          {/* Job Info Summary */}
          {selectedJob && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              {[
                ["Client", selectedJob.LedgerName],
                ["JC No", selectedJob.JobBookingNo],
                ["JC Date", selectedJob.JobBookingDate],
                ["Delivery", selectedJob.DeliveryDate],
                ["Order Qty", selectedJob.OrderQuantity],
                ["Priority", selectedJob.JobPriority],
                ["SalesOrder", selectedJob.SalesOrderNO],
                ["PO No", selectedJob.PONO],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}</p>
                  <p className="text-xs font-semibold text-gray-700">{value || "—"}</p>
                </div>
              ))}
            </div>
          )}

          {/* Content Details Table (gridScheduleList) — user must click a row to load process grid */}
          <div>
            <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">
              Content Details
              <span className="ml-2 text-gray-400 font-normal normal-case tracking-normal">
                {!selectedContent && !loadingContent && contentDetails.length > 0 && "← Click a row to load processes"}
              </span>
            </h3>
            {loadingContent ? (
              <div className="flex items-center justify-center py-8 text-blue-600">
                <Loader2 size={18} className="animate-spin mr-2" /> Loading content details...
              </div>
            ) : contentDetails.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#42909A] text-white">
                      {["Content No", "Content Name", "Item Code", "Item Type", "Item Name", "Full Sheets", "Actual Sheets", "RMT", "Total RMT", "Machine"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contentDetails.map((c, i) => (
                      <tr
                        key={i}
                        onClick={() => {
                          setSelectedContent(c);
                          setProcessRows([]);
                          setMachineLoads([]);
                          loadProcessRows(c, c.JobBookingJobCardContentsID);
                        }}
                        className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors ${selectedContent?.JobBookingJobCardContentsID === c.JobBookingJobCardContentsID ? "bg-blue-100 font-semibold" : ""}`}
                      >
                        <td className="px-3 py-1.5 font-medium text-blue-700">{c.JobCardContentNo}</td>
                        <td className="px-3 py-1.5">{c.PlanContName}</td>
                        <td className="px-3 py-1.5">{c.ItemCode}</td>
                        <td className="px-3 py-1.5">{c.ItemType}</td>
                        <td className="px-3 py-1.5">{c.ItemName}</td>
                        <td className="px-3 py-1.5 text-right">{c.FullSheets}</td>
                        <td className="px-3 py-1.5 text-right">{c.ActualSheets}</td>
                        <td className="px-3 py-1.5 text-right">{c.RequiredRunningMeter}</td>
                        <td className="px-3 py-1.5 text-right">{c.TotalRequiredRunningMeter}</td>
                        <td className="px-3 py-1.5">{c.PlanningMachine}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          {/* Process Grid + Machine Loads — side by side (matches old layout) */}
          <div className="flex gap-3 items-start">

            {/* Left: gridFormWiseDetail (~70%) */}
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Process-wise Schedule</h3>
              {loadingProcess ? (
                <div className="flex items-center justify-center py-10 text-blue-600 border border-dashed border-gray-200 rounded-lg">
                  <Loader2 size={20} className="animate-spin mr-2" /> Loading process details...
                </div>
              ) : processRows.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                  {selectedContent ? "No processes found for this content." : "Select a content row above."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#42909A] text-white">
                        {["#", "Process Name", "Rate Factor", "Ref Form No", "To Be Produce Qty", "Schedule Qty", "Schedule Qty(RMT)", "Machine", "Machine Speed", "Break", "Is Online Process", "Curing Time(min)", "Ttl Time"].map(h => (
                          <th key={h} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {processRows.map((row, i) => {
                        const processMachines = machinesForProcess(row.ProcessID);
                        return (
                          <tr
                            key={i}
                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                            onClick={() => loadMachineLoads(row.ProcessID)}
                          >
                            <td className="px-2 py-1.5 text-gray-400 text-center">{i + 1}</td>
                            <td className="px-2 py-1.5 font-medium text-gray-700 whitespace-nowrap">{row.ProcessName}</td>
                            <td className="px-2 py-1.5 text-gray-600 text-center">{row.RateFactor}</td>
                            <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{row.JobCardFormNo}</td>
                            <td className="px-2 py-1.5 font-semibold text-blue-700 text-right">{row.ToBeProduceQty}</td>

                            <td className="px-1 py-1 min-w-[80px]" onClick={e => e.stopPropagation()}>
                              <Input
                                type="number"
                                value={row.ScheduleQty}
                                onChange={e => updateProcessRow(i, "ScheduleQty", parseFloat(e.target.value) || 0)}
                                min={0}
                              />
                            </td>

                            <td className="px-1 py-1 min-w-[80px]" onClick={e => e.stopPropagation()}>
                              <Input
                                type="number"
                                value={row.ScheduleQtyRMT}
                                onChange={e => updateProcessRow(i, "ScheduleQtyRMT", parseFloat(e.target.value) || 0)}
                                min={0}
                              />
                            </td>

                            <td className="px-1 py-1 min-w-[150px]" onClick={e => e.stopPropagation()}>
                              <Select
                                value={String(row.MachineID || "")}
                                onChange={e => updateProcessRow(i, "MachineID", Number(e.target.value))}
                                options={[{value: "", label: "-- Select --"}, ...processMachines.map(m => ({value: String(m.MachineID), label: m.MachineName}))]}
                              />
                            </td>

                            <td className="px-1 py-1 min-w-[70px]" onClick={e => e.stopPropagation()}>
                              <Input
                                type="number"
                                value={row.MachineSpeed}
                                onChange={e => updateProcessRow(i, "MachineSpeed", parseFloat(e.target.value) || 0)}
                                min={0}
                              />
                            </td>

                            <td className="px-2 py-1.5 text-center">
                              <button
                                onClick={e => { e.stopPropagation(); if (!row.Processed) openBreakModal(i); }}
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${row.Processed ? "bg-red-100 text-red-500 cursor-default" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}
                              >
                                {row.Processed ? "Split" : "Break"}
                              </button>
                            </td>

                            <td className="px-2 py-1.5 text-center">
                              {row.IsOnlineProcess
                                ? <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                                : <span className="text-gray-300">—</span>}
                            </td>

                            <td className="px-1 py-1 min-w-[70px]" onClick={e => e.stopPropagation()}>
                              <Input
                                type="number"
                                value={row.DryingTime || 0}
                                onChange={e => updateProcessRow(i, "DryingTime", parseFloat(e.target.value) || 0)}
                                min={0}
                              />
                            </td>

                            <td className="px-2 py-1.5 text-right text-gray-600 whitespace-nowrap">
                              {Number(row.TotalTimeToBeTaken).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right: Machine Loads (~30%) — always visible, matches old chart area */}
            <div className="w-64 flex-shrink-0">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Machine Loads (HH:MM)</h3>
              <div className="border border-gray-200 rounded-lg min-h-[180px] bg-gray-50 p-2">
                {machineLoads.length === 0 ? (
                  <div className="flex items-center justify-center h-36 text-gray-300 text-xs">
                    Click a process row
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {machineLoads.map(ml => (
                      <div key={ml.MachineID} className="text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-gray-600 truncate pr-1" title={ml.MachineName}>{ml.MachineName}</span>
                          <span className="text-[10px] font-bold text-gray-700 whitespace-nowrap">{ml.MachineLoadInHr}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-teal-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (ml.MachineLoad / (Math.max(...machineLoads.map(m => m.MachineLoad)) || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
            <Button variant="secondary" size="md" onClick={() => setScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" loading={saving} onClick={saveSchedule}>
              {saving ? "Saving..." : "Save Schedule"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Show List Modal (Released Schedules) ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={showListOpen}
        onClose={() => setShowListOpen(false)}
        title="Released Scheduled Quantity"
        size="xl"
      >
        <div className="space-y-4">
          {/* Release date filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="chkRelease" checked={checkRelease} onChange={e => setCheckRelease(e.target.checked)}
                className="w-4 h-4 accent-blue-600" />
              <label htmlFor="chkRelease" className="text-xs font-semibold text-gray-600">Release Date</label>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">From</label>
              <Input type="date" value={releaseDateFrom} onChange={e => setReleaseDateFrom(e.target.value)} disabled={!checkRelease} />
              <label className="text-xs text-gray-500">To</label>
              <Input type="date" value={releaseDateTo} onChange={e => setReleaseDateTo(e.target.value)} disabled={!checkRelease} />
            </div>
            <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={loadReleasedList} loading={showListLoading}>
              Refresh
            </Button>
          </div>

          {/* Released Jobs Grid */}
          {showListLoading ? (
            <div className="flex items-center justify-center py-10 text-blue-600">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading...
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#42909A] text-white">
                    {["Content No", "Job Name", "Content", "Client", "Released On", "Released By", "Delivery Date", "Scheduled"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {releasedJobs.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">No released schedules found</td></tr>
                  ) : releasedJobs.map((r, i) => (
                    <tr
                      key={i}
                      onClick={() => selectReleasedRow(r)}
                      className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors ${selectedReleased?.ScheduleID === r.ScheduleID ? "bg-blue-100" : ""}`}
                    >
                      <td className="px-3 py-1.5 font-medium text-blue-700">{r.JobCardContentNo}</td>
                      <td className="px-3 py-1.5">{r.JobName}</td>
                      <td className="px-3 py-1.5">{r.PlanContName}</td>
                      <td className="px-3 py-1.5">{r.LedgerName}</td>
                      <td className="px-3 py-1.5">{r.ReleasedDate}</td>
                      <td className="px-3 py-1.5">{r.ReleasedBy}</td>
                      <td className="px-3 py-1.5">{r.DeliveryDate}</td>
                      <td className="px-3 py-1.5 text-center">
                        {r.IsScheduled ? <CheckCircle2 size={14} className="text-green-500 mx-auto" /> : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Scheduled Qty Detail */}
          {releasedDetail.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Scheduled Quantity Breakdown</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      {["#", "Process", "Rate Factor", "Form No", "Machine", "Speed", "Schedule Qty", "RMT", "Curing (min)"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {releasedDetail.map((d, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-gray-500">{d.SequenceNo}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-700">{d.ProcessName}</td>
                        <td className="px-3 py-1.5">{d.RateFactor}</td>
                        <td className="px-3 py-1.5">{d.JobCardFormNo}</td>
                        <td className="px-3 py-1.5">{d.MachineName}</td>
                        <td className="px-3 py-1.5 text-right">{d.MachineSpeed}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-blue-700">{d.ScheduleQty}</td>
                        <td className="px-3 py-1.5 text-right">{d.ScheduleQtyRMT}</td>
                        <td className="px-3 py-1.5 text-right">{d.DryingTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-200">
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={14} />}
              loading={deleting}
              onClick={deleteReleasedSchedule}
              disabled={!selectedReleased}
            >
              Delete
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowListOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Break Qty Modal ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={breakModalOpen}
        onClose={() => setBreakModalOpen(false)}
        title="Break QTY"
        size="sm"
      >
        <div className="space-y-3 px-1">
          <Input
            label="Qty To Be Produce"
            type="text"
            value={processRows[breakRowIndex]?.ToBeProduceQty ?? ""}
            readOnly
          />

          {["Qty BreakUp 1", "Qty BreakUp 2", "Qty BreakUp 3", "Qty BreakUp 4", "Qty BreakUp 5"].map((breakLabel, idx) => (
            <Input
              key={idx}
              label={breakLabel}
              type="number"
              value={breakQtys[idx]}
              onChange={e => setBreakQtys(prev => { const c = [...prev]; c[idx] = e.target.value; return c; })}
              min={0}
              placeholder="0"
            />
          ))}

          <Input
            label="Total Qty"
            type="text"
            value={breakTotalQty || ""}
            readOnly
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setBreakModalOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={applyBreak}>Apply</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
