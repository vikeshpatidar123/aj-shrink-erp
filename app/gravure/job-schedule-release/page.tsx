"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2, Clock, RefreshCw, Trash2, CheckCircle2, Eye, CalendarClock, Search, X,
} from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { DatePicker } from "@/components/forms/date-picker";
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
  JobBookingID: number;
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
  OrderQuantity: number;
  RequiredRunningMeter: number;
  TotalRequiredRunningMeter: number;
  PlanningMachine: string;
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

  // ── List tab (Unreleased / Released) ────────────────────────────────────────
  const [listTab, setListTab] = useState<"unreleased" | "released">("unreleased");

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
  // When true, the modal shows an already-released schedule read-only
  // (opened from the Released tab's View action) instead of the create flow.
  const [viewMode, setViewMode] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [contentDetails, setContentDetails] = useState<ContentDetail[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentDetail | null>(null);
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [processSearch, setProcessSearch] = useState("");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineLoads, setMachineLoads] = useState<MachineLoad[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingProcess, setLoadingProcess] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Released Tab State ──────────────────────────────────────────────────────
  const [releasedJobs, setReleasedJobs] = useState<ReleasedJob[]>([]);
  const [releasedDetail, setReleasedDetail] = useState<ReleasedDetail[]>([]);
  const [selectedReleased, setSelectedReleased] = useState<ReleasedJob | null>(null);
  const [showListLoading, setShowListLoading] = useState(false);
  const [releaseDateFrom, setReleaseDateFrom] = useState(thirtyDaysAgo());
  const [releaseDateTo, setReleaseDateTo] = useState(todayStr());
  const [checkRelease, setCheckRelease] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Break Qty Modal State ──────────────────────────────────────────────────

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
    setViewMode(false);
    setSelectedJob(job);
    setContentDetails([]);
    setSelectedContent(null);
    setProcessRows([]);
    setProcessSearch("");
    setMachineLoads([]);
    setReleasedDetail([]);
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

  useEffect(() => { if (listTab === "released") loadReleasedList(); }, [listTab, loadReleasedList]);

  // ── Open the Schedule Release modal in read-only view mode for an
  //    already-released schedule (Released tab → Eye icon). ─────────────────
  const openViewReleased = useCallback(async (row: ReleasedJob) => {
    setViewMode(true);
    setSelectedReleased(row);
    setSelectedJob({
      JobBookingJobCardContentsID: row.JobBookingJobCardContentsID,
      JobBookingID: row.JobBookingID,
      JobCardContentNo: row.JobCardContentNo,
      PlanContName: row.PlanContName,
      JobBookingNo: row.JobBookingNo,
      LedgerName: row.LedgerName,
      SalesOrderNO: "",
      PONO: row.PONo,
      CategoryName: "",
      JobBookingDate: "",
      JobName: row.JobName,
      OrderQuantity: row.OrderQuantity,
      DeliveryDate: row.DeliveryDate,
      ProductCode: "",
      JobPriority: row.JobPriority,
      BookingNo: "",
      ProductMasterCode: "",
      ReceiptStockQuantity: 0,
    });
    // scheduleplanner/{jobBookingId} only returns content that is NOT YET released
    // (backend filters WHERE IsRelease<>1), so it always comes back empty for an
    // already-released schedule. Build the single content row straight from the
    // showlist row we already have instead of calling an endpoint that can't return it.
    setContentDetails([{
      JobBookingJobCardContentsID: row.JobBookingJobCardContentsID,
      JobBookingID: row.JobBookingID,
      JobCardContentNo: row.JobCardContentNo,
      PlanContName: row.PlanContName,
      JobName: row.JobName,
      LedgerName: row.LedgerName,
      OrderQuantity: row.OrderQuantity,
      DeliveryDate: row.DeliveryDate,
      ProductCode: "",
      JobType: "",
      ItemCode: "",
      ItemType: "",
      ItemName: "",
      FullSheets: 0,
      ActualSheets: 0,
      TotalRequiredRunningMeter: row.TotalRequiredRunningMeter,
      RequiredRunningMeter: row.RequiredRunningMeter,
      TotalPaperWeightInKg: 0,
      PlanningMachine: row.PlanningMachine,
      PlanType: "",
      CutL: 0,
      CylinderCircumferenceMM: 0,
      FeedValue: 0,
      UpsL: 0,
      UpsW: 0,
      SizeW: 0,
      GSM: 0,
      MachineID: 0,
    }]);
    setSelectedContent(null);
    setProcessRows([]);
    setProcessSearch("");
    setMachineLoads([]);
    setReleasedDetail([]);
    setScheduleModalOpen(true);
    setLoadingContent(true);
    try {
      const detail = await apiFetch<ReleasedDetail[]>(`${API}/releaseddetail/${row.ScheduleID}`);
      setReleasedDetail(Array.isArray(detail) ? detail : []);
    } catch {
      showToast("error", "Error", "Failed to load released schedule");
    }
    setLoadingContent(false);
  }, []);

  const deleteReleasedSchedule = async (rowOverride?: ReleasedJob) => {
    const target = rowOverride ?? selectedReleased;
    if (!target) { showToast("warning", "Select a schedule to delete"); return; }
    if (!confirm(`Delete schedule for "${target.JobName}"? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const result = await apiPost<string>(`${API}/delete`, {
        JobScheduleID: target.ScheduleID,
        JobContentsID: target.JobBookingJobCardContentsID,
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

  // ── Machines filtered by ProcessID ────────────────────────────────────────
  function machinesForProcess(processId: number): Machine[] {
    return machines.filter(m => m.ProcessID === processId);
  }

  // ── Job List Columns ───────────────────────────────────────────────────────
  const jobColumns = useMemo((): Column<Job>[] => [
    { key: "LedgerName", header: "Client Name", sortable: true },
    { key: "JobBookingNo", header: "PWO No.", sortable: true },
    { key: "JobBookingDate", header: "PWO Date", sortable: true },
    { key: "SalesOrderNO", header: "SO No.", sortable: true },
    { key: "JobName", header: "Job Name", sortable: true },
    { key: "PlanContName", header: "Content Name", sortable: true },
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
    { key: "ReleasedDate", header: "Released Date" },
    { key: "LedgerName", header: "Client Name" },
    { key: "JobBookingNo", header: "PWO No." },
    { key: "JobName", header: "Job Name" },
    { key: "PlanContName", header: "Content" },
    { key: "ReleasedBy", header: "Released By" },
    { key: "DeliveryDate", header: "Delivery Date" },
    {
      key: "IsScheduled", header: "Scheduled",
      render: (row) => row.IsScheduled
        ? <CheckCircle2 size={16} className="text-green-500" />
        : <span className="text-gray-400 text-xs">—</span>
    },
  ], []);

  // Single source of truth for picking a content row — used by both the row click
  // and the radio indicator, guarded so re-clicking the same row is a no-op (no refetch).
  const selectContent = useCallback((c: ContentDetail) => {
    if (viewMode) return;
    if (selectedContent?.JobBookingJobCardContentsID === c.JobBookingJobCardContentsID) return;
    setSelectedContent(c);
    setProcessRows([]);
    setMachineLoads([]);
    loadProcessRows(c, c.JobBookingJobCardContentsID);
  }, [viewMode, selectedContent, loadProcessRows]);

  // ── Content Details ("BOM Details") Columns — used inside the modal ───────
  const contentColumns = useMemo((): Column<ContentDetail>[] => [
    {
      key: "sel", header: "", width: "w-10", sortable: false,
      render: c => (
        <input
          type="radio"
          checked={selectedContent?.JobBookingJobCardContentsID === c.JobBookingJobCardContentsID}
          disabled={viewMode}
          readOnly
          className="w-4 h-4 pointer-events-none"
        />
      ),
    },
    { key: "JobCardContentNo", header: "PWO No.", render: () => selectedJob?.JobBookingNo ?? "—" },
    { key: "LedgerName", header: "Client Name", render: () => selectedJob?.LedgerName ?? "—" },
    { key: "SalesOrderNO", header: "SO No.", render: () => selectedJob?.SalesOrderNO ?? "—" },
    { key: "JobName", header: "Job Name", render: () => selectedJob?.JobName ?? "—" },
    { key: "PlanContName", header: "Content Name" },
    { key: "OrderQuantity", header: "Order Qty", render: () => selectedJob?.OrderQuantity ?? "—" },
    { key: "RequiredRunningMeter", header: "RMT" },
    { key: "TotalRequiredRunningMeter", header: "Total RMT" },
    { key: "PlanningMachine", header: "Machine" },
  ], [selectedContent, viewMode, selectedJob]);

  // ── Released Detail (read-only Process-wise Schedule for view mode) ───────
  const releasedDetailColumns = useMemo((): Column<ReleasedDetail>[] => [
    { key: "SequenceNo", header: "#" },
    { key: "ProcessName", header: "Process Name" },
    { key: "RateFactor", header: "Rate Factor" },
    { key: "JobCardFormNo", header: "Ref Form No" },
    { key: "MachineName", header: "Machine" },
    { key: "MachineSpeed", header: "Machine Speed" },
    { key: "ScheduleQty", header: "Schedule Qty", render: d => <span className="font-semibold text-blue-700">{d.ScheduleQty}</span> },
    { key: "ScheduleQtyRMT", header: "Schedule Qty(RMT)" },
    { key: "DryingTime", header: "Curing Time(min)" },
  ], []);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Shared range-picker change handler — updates the two string date states
  // (and an optional "enabled" checkbox flag the backend expects) from a DateRange.
  const handleRangeChange = (
    setFrom: (v: string) => void, setTo: (v: string) => void, setCheck?: (v: boolean) => void
  ) => (range: unknown) => {
    if (range && typeof range === "object" && "from" in range) {
      const r = range as { from?: Date; to?: Date };
      setFrom(r.from ? r.from.toISOString().split("T")[0] : "");
      setTo(r.to ? r.to.toISOString().split("T")[0] : "");
      setCheck?.(!!(r.from || r.to));
    }
  };
  const asDateRange = (from: string, to: string) => ({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">

      {/* ── Page Header ── */}
      <div className="text-center pt-1">
        <h2 className="text-xl font-bold text-gray-800">Schedule Release</h2>
      </div>

      {/* ── Tabs + Refresh ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-gray-100 border border-gray-200 rounded-full">
          {([
            { id: "unreleased" as const, label: "Unreleased", icon: <Clock size={14} /> },
            { id: "released" as const, label: "Released", icon: <CheckCircle2 size={14} /> },
          ]).map(t => (
            <button key={t.id} onClick={() => setListTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${listTab === t.id ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <Button
          variant="secondary" size="sm" icon={<RefreshCw size={14} />}
          onClick={listTab === "unreleased" ? loadJobs : loadReleasedList}
          loading={listTab === "unreleased" ? jobsLoading : showListLoading}
        />
      </div>

      {listTab === "unreleased" ? (
        <>
          {/* ── Date Filters ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">PWO Date</label>
                <DatePicker mode="range" value={asDateRange(jcDateFrom, jcDateTo)}
                  onChange={handleRangeChange(setJcDateFrom, setJcDateTo, setCheckB)}
                  placeholder="Start Date → End Date" />
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Delivery Date</label>
                <DatePicker mode="range" value={asDateRange(delDateFrom, delDateTo)}
                  onChange={handleRangeChange(setDelDateFrom, setDelDateTo, setCheckD)}
                  placeholder="Start Date → End Date" />
              </div>
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
                  <button
                    onClick={() => openScheduleModal(row as unknown as Job)}
                    title="Schedule Release"
                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <CalendarClock size={16} />
                  </button>
                )}
              />
            )}
          </div>
        </>
      ) : (
        <>
          {/* ── Release Date Filter ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Released Date</label>
              <DatePicker mode="range" value={asDateRange(releaseDateFrom, releaseDateTo)}
                onChange={handleRangeChange(setReleaseDateFrom, setReleaseDateTo, setCheckRelease)}
                placeholder="Start Date → End Date" />
            </div>
          </div>

          {/* ── Released List Grid ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            {showListLoading ? (
              <div className="flex items-center justify-center py-16 text-blue-600">
                <Loader2 size={24} className="animate-spin mr-2" /> Loading...
              </div>
            ) : (
              <DataTable
                data={releasedJobs.map(r => ({ ...r, id: String(r.ScheduleID) }))}
                columns={releasedCols}
                searchKeys={["JobName", "LedgerName", "JobBookingNo", "JobCardContentNo", "PlanContName"]}
                actions={(row) => (
                  <div className="flex items-center gap-1 justify-center">
                    <button onClick={() => openViewReleased(row as unknown as ReleasedJob)}
                      title="View schedule"
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors">
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => deleteReleasedSchedule(row as unknown as ReleasedJob)}
                      title="Delete schedule"
                      disabled={deleting}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              />
            )}
          </div>

        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Schedule Release Modal ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={selectedJob ? `Release Scheduled Quantity — ${selectedJob.JobName}` : "Release Scheduled Quantity"}
        size="2xl"
      >
        <div className="space-y-4">

          {/* Content Details ("BOM Details") Grid — carries the job-level fields too, single unified grid */}
          <div>
            <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">
              Job Card Details
              <span className="ml-2 text-gray-400 font-normal normal-case tracking-normal">
                {!viewMode && !selectedContent && !loadingContent && contentDetails.length > 0 && "← Select a row to load processes"}
              </span>
            </h3>
            {loadingContent ? (
              <div className="flex items-center justify-center py-8 text-blue-600">
                <Loader2 size={18} className="animate-spin mr-2" /> Loading content details...
              </div>
            ) : contentDetails.length > 0 ? (
              <DataTable
                data={contentDetails.map((c, i) => ({ ...c, id: String(c.JobBookingJobCardContentsID || i) }))}
                columns={contentColumns}
                getRowId={c => String(c.JobBookingJobCardContentsID)}
                enableRowSelection={false}
                enableRowClickSelection={false}
                onRowClick={selectContent}
              />
            ) : null}
          </div>

          {/* Process Grid + Machine Loads — side by side (matches old layout) */}
          <div className="flex gap-3 items-stretch">

            {/* Left: gridFormWiseDetail (~60%) */}
            <div className="flex-[3] min-w-0 flex flex-col">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Process-wise Schedule</h3>

              <div className="flex-1 flex flex-col min-h-0">
              {viewMode ? (
                // ── Read-only released schedule (no MachineID/ProcessID available to edit) ──
                releasedDetail.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                    {loadingContent ? "Loading…" : "No scheduled processes found."}
                  </div>
                ) : (
                  <DataTable
                    data={releasedDetail.map((d, i) => ({ ...d, id: String(d.SequenceNo ?? i) }))}
                    columns={releasedDetailColumns}
                    getRowId={d => String(d.SequenceNo)}
                    enableRowSelection={false}
                    stickyHeader
                  />
                )
              ) : loadingProcess ? (
                <div className="flex-1 flex items-center justify-center text-blue-600 border border-dashed border-gray-200 rounded-lg">
                  <Loader2 size={20} className="animate-spin mr-2" /> Loading process details...
                </div>
              ) : processRows.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                  {selectedContent ? "No processes found for this content." : "Select a content row above."}
                </div>
              ) : (
                <>
                  {/* Search toolbar */}
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-2 shadow-sm">
                    <Search size={14} className="text-gray-400 flex-shrink-0" />
                    <input
                      value={processSearch}
                      onChange={e => setProcessSearch(e.target.value)}
                      placeholder="Search process name…"
                      className="bg-transparent text-xs text-gray-700 outline-none w-full border-none"
                    />
                    {processSearch && (
                      <button onClick={() => setProcessSearch("")} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[color-mix(in_srgb,rgb(var(--color-primary))_10%,white)] border-b border-gray-200">
                          {["#", "Process Name", "Schedule Qty", "Machine", "Machine Speed", "Online", "Ttl Time"].map(h => (
                            <th key={h} className="px-2 py-2 text-left font-semibold whitespace-nowrap text-gray-600 text-[11px] uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                      {processRows
                        .map((row, i) => ({ row, i }))
                        .filter(({ row }) => !processSearch || row.ProcessName.toLowerCase().includes(processSearch.toLowerCase()))
                        .map(({ row, i }) => {
                        const processMachines = machinesForProcess(row.ProcessID);
                        return (
                          <tr
                            key={i}
                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                            onClick={() => loadMachineLoads(row.ProcessID)}
                          >
                            <td className="px-2 py-1.5 text-gray-400 text-center">{i + 1}</td>
                            <td className="px-2 py-1.5 font-medium text-gray-700 whitespace-nowrap">{row.ProcessName}</td>

                            <td className="px-1 py-1 min-w-[80px]" onClick={e => e.stopPropagation()}>
                              <Input
                                type="number"
                                value={row.ScheduleQty}
                                onChange={e => updateProcessRow(i, "ScheduleQty", parseFloat(e.target.value) || 0)}
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
                              {row.IsOnlineProcess
                                ? <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                                : <span className="text-gray-300">—</span>}
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
                </>
              )}
              </div>
            </div>

            {/* Right: Machine Loads (~40%) — hidden in view mode (no ProcessID to load loads for) */}
            {!viewMode && (
              <div className="flex-[2] min-w-[280px] flex flex-col">
                <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Machine Loads (HH:MM)</h3>
                <div className="border border-gray-200 rounded-lg min-h-[180px] bg-gray-50 p-2 flex-1">
                  {machineLoads.length === 0 ? (
                    <div className="flex items-center justify-center h-36 text-gray-300 text-xs">
                      Click a process row
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {machineLoads.map(ml => {
                        const maxLoad = Math.max(...machineLoads.map(m => m.MachineLoad)) || 1;
                        const pct = Math.max(8, Math.min(100, (ml.MachineLoad / maxLoad) * 100));
                        return (
                          <div key={ml.MachineID} className="text-xs">
                            <p className="text-gray-600 truncate mb-1" title={ml.MachineName}>{ml.MachineName}</p>
                            <div className="relative w-full bg-gray-200 rounded-full h-5">
                              <div
                                className="absolute inset-y-0 left-0 bg-teal-400 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                              <span className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-full bg-rose-200 text-rose-800 text-[10px] font-bold whitespace-nowrap">
                                {ml.MachineLoadInHr}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="flex justify-between items-center gap-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" onClick={() => showToast("info", "Booked Detail", "Coming soon")}>
                Booked Detail
              </Button>
              <Button variant="secondary" size="md" onClick={() => showToast("info", "Delivery Detail", "Coming soon")}>
                Delivery Detail
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {!viewMode && (
                <Button variant="primary" size="md" loading={saving} onClick={saveSchedule}>
                  {saving ? "Saving..." : "Save Schedule"}
                </Button>
              )}
              <Button variant="secondary" size="md" onClick={() => setScheduleModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
}
