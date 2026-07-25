"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Layers, ClipboardList, Plus, Trash2, RefreshCw, Printer,
  Search, X, CheckCircle2, AlertCircle, ChevronRight, Eye,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import TutorialButton from "@/components/ui/TutorialButton";
import { ColFilterIcon } from "@/components/tables/ColFilterIcon";
import { DataTable } from "@/components/tables/DataTable";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// ─── Types ───────────────────────────────────────────────────────────────────
type PrimaryJob = {
  JobBookingID: number; JobBookingJobCardContentsID: number;
  JobBookingNo: string; LedgerName: string; JobCardContentNo: string;
  ProductMasterCode: string; SalesOrderNo: string; PONo: string; PODate: string;
  JobName: string; PlanContName: string; OrderQuantity: number;
  Quality: string; GSM: number; TotalGSM: number;
  UpsL: number; UpsW: number; TotalUps: number;
  CylinderCircumferenceInch: number; CylinderCircumferenceMM: number;
  WastageRunningMeter: number; TotalRequiredRunningMeter: number;
  TotalRequiredSquareMeter: number; TotalRollWeightInKg: number;
  OrderBookingID: number; BookingID: number; ProductMasterID: number;
  LedgerID: number; PrimaryProductCode: string; PrimaryClientName: string;
  PrimaryContentName: string;
};

type SimilarJob = {
  JobBookingID: number; JobBookingJobCardContentsID: number;
  JobBookingNo: string; LedgerName: string; JobCardContentNo: string;
  ProductMasterCode: string; ProductCode: string; SalesOrderNo: string;
  JobName: string; PlanContName: string; OrderQuantity: number;
  TotalRequiredRunningMeter: number; TotalRequiredSquareMeter: number;
  TotalRollWeightInKg: number; WastageSheets: number; ActualSheets: number;
  SOMainRemark: string; JobDetailsRemark: string;
  OrderBookingID: number; BookingID: number; ProductMasterID: number;
  LedgerID: number;
};

type GangRow = SimilarJob & {
  GangUps: number; ExpectedQuantity: number; RequiredSheets: number;
  ClientName: string; ContentName: string; orderOty: number;
};

type GangPlan = {
  GangWorkOrderID: number; GangWorkOrderNo: string;
  PrimaryJobName: string; PrimaryClientName: string; PrimaryProductCode: string;
  Quality: string; TotalGSM: number;
  PrimaryJobUps: number; TotalUps: number;
  CylinderCircumferenceInch: number; GangDate: string;
  CreatedBy: string; SecondaryJobCount: number;
  PrimaryJobBookingID: number; PrimaryJobBookingJobCardContentsID: number;
  PrimaryJobBookingNo: string; PrimaryJobBookingJobCardContentsNo: string;
  MaxGangWorkOrderNo: number; UpsL: number; UpsW: number;
};

type DetailRow = {
  JobBookingID: number; JobBookingJobCardContentsID: number;
  JobBookingNo: string; ClientName: string; JobName: string;
  PlanContName: string; SalesOrderNo: string; OrderQuantity: number;
  GangUps: number; ExpectedJCQty: number; ExpectedReqFullSheets: number;
  TotalRequiredRunningMeter: number; TotalRequiredSquareMeter: number;
  TotalRollWeightInKg: number; WastageSheets: number; ActualSheets: number;
  ProductMasterCode: string; PCodeAWCode: string; TransID: number;
  PrimaryJobBookingNo: string; PrimaryJobBookingJobCardContentsNo: string;
  TotalUps: number; PrimaryJobUps: number;
};

// ─── Column definitions for sort + funnel ────────────────────────────────────
const SIM_COLS: { h: string; key?: keyof SimilarJob }[] = [
  { h: "Select" },
  { h: "JC No",    key: "JobCardContentNo" },
  { h: "Client",   key: "LedgerName" },
  { h: "Job Name", key: "JobName" },
  { h: "Content",  key: "PlanContName" },
  { h: "SO No",    key: "SalesOrderNo" },
  { h: "Qty",      key: "OrderQuantity" },
  { h: "Run.Mtr",  key: "TotalRequiredRunningMeter" },
];

const GANG_COLS: { h: string; key?: keyof GangRow }[] = [
  { h: "#" },
  { h: "JC No.",      key: "JobCardContentNo" },
  { h: "Client",      key: "ClientName" },
  { h: "Job Name",    key: "JobName" },
  { h: "Content",     key: "ContentName" },
  { h: "SO No.",      key: "SalesOrderNo" },
  { h: "Order Qty",   key: "OrderQuantity" },
  { h: "Gang Ups",    key: "GangUps" },
  { h: "Req. Sheets", key: "RequiredSheets" },
  { h: "Run. Mtr",    key: "TotalRequiredRunningMeter" },
];

// ─── Tab component ───────────────────────────────────────────────────────────
const Tab = ({ label, icon: Icon, active, onClick, count }: {
  label: string; icon: React.ElementType; active: boolean;
  onClick: () => void; count?: number;
}) => (
  <button onClick={onClick}
    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
      ${active ? "border-blue-600 text-blue-700 bg-blue-50"
               : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
    <Icon size={15} />
    {label}
    {count !== undefined && (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
        ${active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}>
        {count}
      </span>
    )}
  </button>
);

// ─── Field wrapper ────────────────────────────────────────────────────────────
const Field = ({ label, children, span }: {
  label: string; children: React.ReactNode; span?: string;
}) => (
  <div className={span ?? ""}>
    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
      {label}
    </label>
    {children}
  </div>
);


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ContentGangPage() {
  const [tab, setTab] = useState<"planning" | "list">("planning");

  // Plan list state
  const [planList, setPlanList]   = useState<GangPlan[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Planning state
  const [gangNo, setGangNo]           = useState("");
  const [gangDate, setGangDate]       = useState(new Date().toISOString().slice(0, 10));
  const [primaryJob, setPrimaryJob]   = useState<PrimaryJob | null>(null);
  const [primaryJobUps, setPrimaryJobUps] = useState<number | "">(""); // user enters this
  const [gangRows, setGangRows]       = useState<GangRow[]>([]);
  const [isViewMode, setIsViewMode]   = useState(false);
  const [loadedGangNo, setLoadedGangNo] = useState("");

  // Primary job picker modal
  const [showPicker, setShowPicker]   = useState(false);
  const [eligibleJobs, setEligibleJobs] = useState<PrimaryJob[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);

  // Similar jobs
  const [similarJobs, setSimilarJobs] = useState<SimilarJob[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [selectedSimilar, setSelectedSimilar] = useState<SimilarJob | null>(null);
  const [gangUpsInput, setGangUpsInput] = useState<number | "">("");

  // Messages
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg]           = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Sort + column filters
  const [simSort,        setSimSort]        = useState<{ col: keyof SimilarJob; dir: "asc" | "desc" } | null>(null);
  const [simColFilters,  setSimColFilters]  = useState<Partial<Record<keyof SimilarJob, string>>>({});
  const [gangSort,       setGangSort]       = useState<{ col: keyof GangRow;    dir: "asc" | "desc" } | null>(null);
  const [gangColFilters, setGangColFilters] = useState<Partial<Record<keyof GangRow, string>>>({});

  // ── Sort + filter helpers ─────────────────────────────────────────────────
  function applySort<T>(arr: T[], sort: { col: keyof T; dir: "asc" | "desc" } | null): T[] {
    if (!sort) return arr;
    return [...arr].sort((a, b) => {
      const av = String(a[sort.col] ?? "");
      const bv = String(b[sort.col] ?? "");
      const c  = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      return sort.dir === "asc" ? c : -c;
    });
  }
  function applyColFilter<T>(arr: T[], filters: Partial<Record<keyof T, string>>): T[] {
    return arr.filter(r =>
      Object.entries(filters).every(([k, v]) =>
        !v || String(r[k as keyof T] ?? "").toLowerCase().includes((v as string).toLowerCase())
      )
    );
  }

  const simSorted  = useMemo(() => applySort(applyColFilter(similarJobs, simColFilters), simSort),
    [similarJobs, simColFilters, simSort]);
  const gangSorted = useMemo(() => applySort(applyColFilter(gangRows, gangColFilters), gangSort),
    [gangRows, gangColFilters, gangSort]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const totalUps = primaryJob ? primaryJob.TotalUps : 0;

  const usedUps = useMemo(() =>
    gangRows.reduce((s, r) => s + r.GangUps, 0),
  [gangRows]);

  const upsOk = useMemo(() => {
    if (!primaryJob || primaryJobUps === "") return false;
    return Number(primaryJobUps) + usedUps === totalUps;
  }, [primaryJob, primaryJobUps, usedUps, totalUps]);

  const reqSheetsCalc = useMemo(() => {
    if (!primaryJob || !selectedSimilar || gangUpsInput === "" || !primaryJobUps) return 0;
    const qty = selectedSimilar.OrderQuantity;
    // For Roto Gravure: RequiredSheets = Quantity / TotalUps
    if (!totalUps) return 0;
    return Math.round(qty / totalUps);
  }, [primaryJob, selectedSimilar, gangUpsInput, primaryJobUps, totalUps]);

  // ── Load plan list ────────────────────────────────────────────────────────
  const loadPlanList = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await apiGet<GangPlan[]>("api/gravure/contentGang/gang-list");
      setPlanList(Array.isArray(data) ? data : []);
    } catch { setPlanList([]); }
    finally { setListLoading(false); }
  }, []);

  // ── Generate gang no ──────────────────────────────────────────────────────
  const generateNo = useCallback(async () => {
    try {
      const r = await apiGet<{ gangNo: string }>("api/gravure/contentGang/generate-no");
      setGangNo(r?.gangNo ?? "");
    } catch {}
  }, []);

  useEffect(() => { generateNo(); loadPlanList(); }, [generateNo, loadPlanList]);

  // ── Open primary job picker ───────────────────────────────────────────────
  const openPicker = useCallback(async () => {
    setShowPicker(true);
    setPickerSearch("");
    setPickerLoading(true);
    try {
      const data = await apiGet<PrimaryJob[]>("api/gravure/contentGang/eligible-primary-jobs");
      setEligibleJobs(Array.isArray(data) ? data : []);
    } catch { setEligibleJobs([]); }
    finally { setPickerLoading(false); }
  }, []);

  // ── Select primary job ────────────────────────────────────────────────────
  const selectPrimary = useCallback(async (job: PrimaryJob) => {
    setPrimaryJob(job);
    setPrimaryJobUps("");
    setGangRows([]);
    setSelectedSimilar(null);
    setGangUpsInput("");
    setShowPicker(false);

    // Load similar jobs
    setSimilarLoading(true);
    try {
      const data = await apiGet<SimilarJob[]>(
        `api/gravure/contentGang/similar-jobs?quality=${encodeURIComponent(job.Quality)}&totalGsm=${job.TotalGSM}&excludeContentId=${job.JobBookingJobCardContentsID}`
      );
      setSimilarJobs(Array.isArray(data) ? data : []);
    } catch { setSimilarJobs([]); }
    finally { setSimilarLoading(false); }
  }, []);

  // ── Add secondary job to gang ─────────────────────────────────────────────
  const addToGang = useCallback(() => {
    if (!selectedSimilar || gangUpsInput === "" || Number(gangUpsInput) <= 0) {
      setMsg({ type: "err", text: "Secondary job aur Gang Ups enter karo." });
      return;
    }
    const already = gangRows.find(r =>
      r.JobBookingJobCardContentsID === selectedSimilar.JobBookingJobCardContentsID
    );
    if (already) {
      setMsg({ type: "err", text: "Yeh job already gang mein hai." });
      return;
    }
    const newUps = usedUps + Number(gangUpsInput);
    const primaryUps = Number(primaryJobUps) || 0;
    if (primaryUps + newUps > totalUps) {
      setMsg({ type: "err", text: `Ups exceed ho rahe hain! Primary(${primaryUps}) + Gang(${newUps}) > Total(${totalUps})` });
      return;
    }
    const row: GangRow = {
      ...selectedSimilar,
      GangUps: Number(gangUpsInput),
      ExpectedQuantity: selectedSimilar.OrderQuantity,
      RequiredSheets: reqSheetsCalc,
      ClientName: selectedSimilar.LedgerName,
      ContentName: selectedSimilar.PlanContName,
      orderOty: selectedSimilar.OrderQuantity,
    };
    setGangRows(prev => [...prev, row]);
    setSelectedSimilar(null);
    setGangUpsInput("");
    setMsg(null);
  }, [selectedSimilar, gangUpsInput, gangRows, usedUps, primaryJobUps, totalUps, reqSheetsCalc]);

  // ── Save gang ─────────────────────────────────────────────────────────────
  const saveGang = useCallback(async () => {
    if (!primaryJob) { setMsg({ type: "err", text: "Primary job select karo." }); return; }
    if (primaryJobUps === "" || Number(primaryJobUps) <= 0) {
      setMsg({ type: "err", text: "Primary Job Ups enter karo." }); return;
    }
    if (gangRows.length === 0) {
      setMsg({ type: "err", text: "Kam se kam ek secondary job add karo." }); return;
    }
    if (!upsOk) {
      setMsg({ type: "err", text: `Ups match nahi ho raha! Primary(${primaryJobUps}) + Gang(${usedUps}) ≠ Total(${totalUps})` });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const body = {
        gangWorkOrderNo: loadedGangNo || undefined,
        primaryJobBookingID:                primaryJob.JobBookingID,
        primaryJobBookingJobCardContentsID: primaryJob.JobBookingJobCardContentsID,
        primaryJobBookingNo:                primaryJob.JobBookingNo,
        primaryJobBookingJobCardContentsNo: primaryJob.JobCardContentNo,
        primaryJobUps:          Number(primaryJobUps),
        totalUps,
        gangDate,
        primaryOrderID:         primaryJob.BookingID,
        primaryProductMasterID: primaryJob.ProductMasterID,
        primaryLedgerID:        primaryJob.LedgerID,
        primaryClientName:      primaryJob.PrimaryClientName,
        primaryJobName:         primaryJob.JobName,
        primaryContentName:     primaryJob.PrimaryContentName,
        primaryBookingID:       primaryJob.BookingID,
        primaryOrderBookingID:  primaryJob.OrderBookingID,
        primarySalesOrderNo:    primaryJob.SalesOrderNo,
        quantity:               primaryJob.OrderQuantity,
        totalRequiredRunningMeter:  primaryJob.TotalRequiredRunningMeter,
        totalRequiredSquareMeter:   primaryJob.TotalRequiredSquareMeter,
        totalRollWeightInKg:        primaryJob.TotalRollWeightInKg,
        wastageRunningMeter:        primaryJob.WastageRunningMeter,
        cylinderCircumferenceInch:  primaryJob.CylinderCircumferenceInch,
        cylinderCircumferenceMM:    primaryJob.CylinderCircumferenceMM,
        acrossUps: primaryJob.UpsL,
        aroundUps: primaryJob.UpsW,
        printingImpressions: 0,
        details: gangRows.map((r, i) => ({
          jobBookingID:                  r.JobBookingID,
          jobBookingJobCardContentsID:   r.JobBookingJobCardContentsID,
          gangUps:                       r.GangUps,
          expectedQuantity:              r.ExpectedQuantity,
          requiredSheets:                r.RequiredSheets,
          orderOty:                      r.orderOty,
          orderBookingID:                r.OrderBookingID,
          productMasterID:               r.ProductMasterID,
          ledgerID:                      r.LedgerID,
          clientName:                    r.ClientName,
          jobName:                       r.JobName,
          contentName:                   r.ContentName,
          jobBookingNo:                  r.JobBookingNo,
          salesOrderNo:                  r.SalesOrderNo,
          bookingID:                     r.BookingID,
          totalRequiredRunningMeter:     r.TotalRequiredRunningMeter,
          totalRequiredSquareMeter:      r.TotalRequiredSquareMeter,
          totalRollWeightInKg:           r.TotalRollWeightInKg,
        })),
      };

      const endpoint = loadedGangNo
        ? "api/gravure/contentGang/update"
        : "api/gravure/contentGang/save";

      const res = await apiPost<{ status: string; gangNo: string; message?: string }>(endpoint, body);
      if (res?.status === "success") {
        setMsg({ type: "ok", text: `Gang ${res.gangNo} saved successfully!` });
        clearPlanning();
        loadPlanList();
        generateNo();
      } else {
        setMsg({ type: "err", text: res?.message ?? "Save failed." });
      }
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message ?? "Save failed." });
    }
    setSaving(false);
  }, [primaryJob, primaryJobUps, gangRows, upsOk, usedUps, totalUps, gangDate, loadedGangNo, loadPlanList, generateNo]);

  // ── Delete gang ───────────────────────────────────────────────────────────
  const deleteGang = useCallback(async (no: string) => {
    if (!confirm(`Gang ${no} delete karna chahte ho?`)) return;
    setDeleting(true);
    try {
      const res = await apiPost<{ status: string; message?: string }>(
        "api/gravure/contentGang/delete", { gangWorkOrderNo: no }
      );
      if (res?.status === "success") {
        setMsg({ type: "ok", text: `Gang ${no} deleted.` });
        loadPlanList();
        if (loadedGangNo === no) clearPlanning();
      } else {
        setMsg({ type: "err", text: res?.message ?? "Delete failed." });
      }
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message ?? "Delete failed." });
    }
    setDeleting(false);
  }, [loadedGangNo, loadPlanList]);

  // ── Load existing plan into planning tab ──────────────────────────────────
  const loadPlan = useCallback(async (plan: GangPlan) => {
    try {
      const rows = await apiGet<DetailRow[]>(
        `api/gravure/contentGang/gang-detail/${encodeURIComponent(plan.GangWorkOrderNo)}`
      );
      if (!Array.isArray(rows) || rows.length === 0) return;

      const first = rows[0];
      // Reconstruct primaryJob from plan header fields
      const pj: PrimaryJob = {
        JobBookingID:                    plan.PrimaryJobBookingID,
        JobBookingJobCardContentsID:     plan.PrimaryJobBookingJobCardContentsID,
        JobBookingNo:                    plan.PrimaryJobBookingNo,
        LedgerName:                      plan.PrimaryClientName,
        JobCardContentNo:                plan.PrimaryJobBookingJobCardContentsNo,
        ProductMasterCode:               plan.PrimaryProductCode,
        SalesOrderNo:                    "",
        PONo: "", PODate: "",
        JobName:                         plan.PrimaryJobName,
        PlanContName:                    "",
        OrderQuantity:                   first.OrderQuantity,
        Quality:                         plan.Quality,
        GSM:                             0,
        TotalGSM:                        plan.TotalGSM,
        UpsL:                            plan.UpsL,
        UpsW:                            plan.UpsW,
        TotalUps:                        first.TotalUps,
        CylinderCircumferenceInch:       plan.CylinderCircumferenceInch,
        CylinderCircumferenceMM:         0,
        WastageRunningMeter:             0,
        TotalRequiredRunningMeter:       0,
        TotalRequiredSquareMeter:        0,
        TotalRollWeightInKg:             0,
        OrderBookingID:                  0,
        BookingID:                       0,
        ProductMasterID:                 0,
        LedgerID:                        0,
        PrimaryProductCode:              plan.PrimaryProductCode,
        PrimaryClientName:               plan.PrimaryClientName,
        PrimaryContentName:              "",
      };
      setPrimaryJob(pj);
      setPrimaryJobUps(first.PrimaryJobUps);
      setGangNo(plan.GangWorkOrderNo);
      setLoadedGangNo(plan.GangWorkOrderNo);
      setIsViewMode(true);

      const loaded: GangRow[] = rows.map(r => ({
        JobBookingID:                  r.JobBookingID,
        JobBookingJobCardContentsID:   r.JobBookingJobCardContentsID,
        JobBookingNo:                  r.JobBookingNo,
        LedgerName:                    r.ClientName,
        JobCardContentNo:              "",
        ProductMasterCode:             r.ProductMasterCode,
        ProductCode:                   r.PCodeAWCode,
        SalesOrderNo:                  r.SalesOrderNo,
        JobName:                       r.JobName,
        PlanContName:                  r.PlanContName,
        OrderQuantity:                 r.OrderQuantity,
        TotalRequiredRunningMeter:     r.TotalRequiredRunningMeter,
        TotalRequiredSquareMeter:      r.TotalRequiredSquareMeter,
        TotalRollWeightInKg:           r.TotalRollWeightInKg,
        WastageSheets:                 r.WastageSheets,
        ActualSheets:                  r.ActualSheets,
        SOMainRemark: "", JobDetailsRemark: "",
        OrderBookingID:                0,
        BookingID:                     0,
        ProductMasterID:               0,
        LedgerID:                      0,
        GangUps:                       r.GangUps,
        ExpectedQuantity:              r.ExpectedJCQty,
        RequiredSheets:                r.ExpectedReqFullSheets,
        ClientName:                    r.ClientName,
        ContentName:                   r.PlanContName,
        orderOty:                      r.OrderQuantity,
      }));
      setGangRows(loaded);
      setSimilarJobs([]);
      setTab("planning");
    } catch {}
  }, []);

  // ── Clear planning form ───────────────────────────────────────────────────
  const clearPlanning = useCallback(() => {
    setPrimaryJob(null);
    setPrimaryJobUps("");
    setGangRows([]);
    setSelectedSimilar(null);
    setGangUpsInput("");
    setSimilarJobs([]);
    setIsViewMode(false);
    setLoadedGangNo("");
    setMsg(null);
  }, []);

  const enableEdit = useCallback(() => {
    setIsViewMode(false);
  }, []);

  // ── Open cutting slip ─────────────────────────────────────────────────────
  const openCuttingSlip = useCallback((no: string) => {
    window.open(`/gravure/content-gang/cutting-slip?gangNo=${encodeURIComponent(no)}`,
      "_blank", `width=${window.innerWidth},height=${window.innerHeight}`);
  }, []);

  // ── Picker filter ─────────────────────────────────────────────────────────
  const filteredPicker = useMemo(() => {
    const q = pickerSearch.toLowerCase();
    if (!q) return eligibleJobs;
    return eligibleJobs.filter(j =>
      j.JobCardContentNo.toLowerCase().includes(q) ||
      j.JobName.toLowerCase().includes(q) ||
      j.LedgerName.toLowerCase().includes(q) ||
      j.Quality.toLowerCase().includes(q)
    );
  }, [eligibleJobs, pickerSearch]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Content Gang Planning</h2>
          <p className="text-sm text-gray-500">Roto Gravure · Film Gang</p>
        </div>
        <div className="flex items-center gap-2">
          <TutorialButton title="Content Gang — Tutorial" />
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={() => { loadPlanList(); generateNo(); }}>Refresh</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button onClick={() => setTab("planning")} className={`px-5 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === "planning" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Gang Planning</button>
        <button onClick={() => { setTab("list"); loadPlanList(); }} className={`px-5 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === "list" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Planned Gang List {planList.length > 0 && <span className="ml-1 text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">{planList.length}</span>}
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div className={`mx-6 mt-3 px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium
          ${msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.type === "ok" ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto"><X size={14}/></button>
        </div>
      )}

      {/* ── PLANNING TAB ─────────────────────────────────────────────────── */}
      {tab === "planning" && (
        <div className="p-6 space-y-5">

          {/* Header row */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                Gang Plan Header
              </h2>
              <div className="flex gap-2">
                {isViewMode && (
                  <button onClick={enableEdit}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-50">
                    <ChevronRight size={13}/> Edit Mode
                  </button>
                )}
                <button onClick={clearPlanning}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                  <X size={13}/> New
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Gang No.">
                <Input readOnly value={gangNo} />
              </Field>
              <Field label="Gang Date">
                <Input type="date" value={gangDate} onChange={e => setGangDate(e.target.value)} disabled={isViewMode} />
              </Field>
              <Field label="Type">
                <Input readOnly value="Roto Gravure Gang (GPWOF)" />
              </Field>
              {!isViewMode && (
                <div className="flex items-end">
                  <button onClick={openPicker}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors">
                    <Plus size={14}/> Select Primary Job
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Primary job details (shows after selection) */}
          {primaryJob && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
                Primary Job
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <Field label="Job Card No." span="col-span-2">
                  <Input readOnly value={primaryJob.JobCardContentNo} />
                </Field>
                <Field label="Client" span="col-span-2">
                  <Input readOnly value={primaryJob.LedgerName} />
                </Field>
                <Field label="Job Name" span="col-span-2">
                  <Input readOnly value={primaryJob.JobName} />
                </Field>
                <Field label="Film Quality" span="col-span-2">
                  <Input readOnly value={primaryJob.Quality} />
                </Field>
                <Field label="Total GSM">
                  <Input readOnly value={primaryJob.TotalGSM} />
                </Field>
                <Field label="Total Ups">
                  <Input readOnly value={primaryJob.TotalUps} />
                </Field>
                <Field label="Cyl. Circum. (inch)">
                  <Input readOnly value={primaryJob.CylinderCircumferenceInch} />
                </Field>
                <Field label="Cyl. Circum. (mm)">
                  <Input readOnly value={primaryJob.CylinderCircumferenceMM} />
                </Field>
                <Field label="Across Ups (UpsL)">
                  <Input readOnly value={primaryJob.UpsL} />
                </Field>
                <Field label="Around Ups (UpsW)">
                  <Input readOnly value={primaryJob.UpsW} />
                </Field>
                <Field label="Primary Job Ups *">
                  <Input type="number" min={1} max={primaryJob.TotalUps - 1}
                    value={primaryJobUps}
                    onChange={e => setPrimaryJobUps(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={isViewMode}
                    placeholder="Enter" />
                </Field>
                <div className="flex items-end">
                  <div className={`w-full text-center text-xs font-bold py-2 rounded-lg
                    ${upsOk ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    Ups: {Number(primaryJobUps)||0} + {usedUps} / {totalUps}
                    {upsOk ? " ✓" : ""}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Similar jobs (secondary selection) */}
          {primaryJob && !isViewMode && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                Similar Jobs (same Film · same TotalGSM)
              </h2>

              {similarLoading ? (
                <div className="text-center text-sm text-gray-400 py-8">Loading similar jobs…</div>
              ) : similarJobs.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-8">No similar jobs found.</div>
              ) : (
                <DataTable<SimilarJob>
                  data={similarJobs}
                  getRowId={j => String(j.JobBookingJobCardContentsID)}
                  columns={[
                    {
                      key: "JobCardContentNo", header: "JC No.",
                      render: j => <span className="font-mono text-blue-700">{j.JobCardContentNo}</span>,
                    },
                    { key: "LedgerName", header: "Client" },
                    { key: "JobName", header: "Job Name" },
                    { key: "PlanContName", header: "Content" },
                    { key: "SalesOrderNo", header: "SO No." },
                    {
                      key: "OrderQuantity", header: "Qty",
                      render: j => <span>{j.OrderQuantity?.toLocaleString()}</span>,
                    },
                    {
                      key: "TotalRequiredRunningMeter", header: "Run. Mtr",
                      render: j => <span>{j.TotalRequiredRunningMeter?.toFixed(2)}</span>,
                    },
                  ]}
                  actions={j => (
                    <button
                      onClick={() => setSelectedSimilar(j)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors
                        ${selectedSimilar?.JobBookingJobCardContentsID === j.JobBookingJobCardContentsID
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"}`}
                    >
                      {selectedSimilar?.JobBookingJobCardContentsID === j.JobBookingJobCardContentsID ? "✓ Selected" : "Select"}
                    </button>
                  )}
                />
              )}

              {/* Add secondary job controls */}
              {selectedSimilar && (
                <div className="mt-4 bg-blue-50 rounded-lg p-4 flex flex-wrap items-end gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Selected</p>
                    <p className="text-sm font-semibold text-blue-800">
                      {selectedSimilar.JobName} — {selectedSimilar.PlanContName}
                    </p>
                    <p className="text-xs text-gray-500">{selectedSimilar.LedgerName} · Qty: {selectedSimilar.OrderQuantity?.toLocaleString()}</p>
                  </div>
                  <Field label="Gang Ups *">
                    <Input type="number" min={1}
                      value={gangUpsInput}
                      onChange={e => setGangUpsInput(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-28"
                      placeholder="Enter" />
                  </Field>
                  <Field label="Req. Sheets (auto)">
                    <Input readOnly value={reqSheetsCalc || ""} className="w-28" />
                  </Field>
                  <Button variant="primary" onClick={addToGang} icon={<Plus size={14}/>}>Add to Gang</Button>
                </div>
              )}
            </div>
          )}

          {/* Gang list (secondary jobs added) */}
          {gangRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                  Gang List — {gangRows.length} job{gangRows.length > 1 ? "s" : ""}
                </h2>
                {!isViewMode && (
                  <div className={`text-xs font-bold px-3 py-1 rounded-full
                    ${upsOk ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {upsOk ? "✓ Ups balanced" : `Remaining: ${totalUps - Number(primaryJobUps||0) - usedUps} ups`}
                  </div>
                )}
              </div>
              <DataTable<GangRow>
                data={gangRows}
                getRowId={r => String(r.JobBookingJobCardContentsID)}
                columns={[
                  {
                    key: "JobCardContentNo", header: "JC No.",
                    render: r => <span className="font-mono text-blue-700">{r.JobCardContentNo || r.JobBookingNo}</span>,
                  },
                  { key: "ClientName", header: "Client" },
                  { key: "JobName", header: "Job Name" },
                  { key: "ContentName", header: "Content" },
                  { key: "SalesOrderNo", header: "SO No." },
                  {
                    key: "OrderQuantity", header: "Order Qty",
                    render: r => <span>{r.OrderQuantity?.toLocaleString()}</span>,
                  },
                  {
                    key: "GangUps", header: "Gang Ups",
                    render: r => <span className="font-bold text-blue-700">{r.GangUps}</span>,
                  },
                  {
                    key: "RequiredSheets", header: "Req. Sheets",
                    render: r => <span>{r.RequiredSheets}</span>,
                  },
                  {
                    key: "TotalRequiredRunningMeter", header: "Run. Mtr",
                    render: r => <span>{r.TotalRequiredRunningMeter?.toFixed(2)}</span>,
                  },
                ]}
                actions={!isViewMode ? r => (
                  <button onClick={() => setGangRows(prev => prev.filter(x => x.JobBookingJobCardContentsID !== r.JobBookingJobCardContentsID))}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 size={13} />
                  </button>
                ) : undefined}
              />
              {/* Totals strip */}
              <div className="flex items-center gap-6 px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs font-semibold text-gray-700 rounded-b-lg">
                <span>Total Qty: <span className="text-gray-900">{gangRows.reduce((s,r) => s+r.OrderQuantity,0).toLocaleString()}</span></span>
                <span>Gang Ups Used: <span className="text-blue-700">{usedUps}</span></span>
                <span>Req. Sheets: <span className="text-gray-900">{gangRows.reduce((s,r) => s+r.RequiredSheets,0)}</span></span>
                <span>Run. Mtr: <span className="text-gray-900">{gangRows.reduce((s,r) => s+(r.TotalRequiredRunningMeter||0),0).toFixed(2)}</span></span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {primaryJob && (
            <div className="flex gap-3 justify-end">
              {loadedGangNo && (
                <button onClick={() => openCuttingSlip(loadedGangNo)}
                  className="flex items-center gap-2 text-sm font-semibold text-indigo-600 border border-indigo-300 rounded-lg px-4 py-2 hover:bg-indigo-50 transition-colors">
                  <Printer size={14}/> Cutting Slip
                </button>
              )}
              {loadedGangNo && (
                <Button variant="danger" onClick={() => deleteGang(loadedGangNo)} disabled={deleting} loading={deleting} icon={<Trash2 size={14}/>}>{deleting ? "Deleting…" : "Delete"}</Button>
              )}
              {!isViewMode && (
                <Button variant="primary" onClick={saveGang} disabled={saving} loading={saving} icon={<CheckCircle2 size={14}/>}>{saving ? "Saving…" : loadedGangNo ? "Update Gang" : "Save Gang"}</Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PLANNED GANG LIST TAB ────────────────────────────────────────── */}
      {tab === "list" && (
        <DataTable
          data={planList}
          loading={listLoading}
          title="Planned Gang List"
          columns={[
            { key: "GangWorkOrderNo", header: "Gang No.", render: r => <span className="font-mono font-bold text-blue-700">{r.GangWorkOrderNo}</span> },
            { key: "GangDate", header: "Date" },
            { key: "PrimaryJobName", header: "Primary Job" },
            { key: "PrimaryClientName", header: "Client" },
            { key: "Quality", header: "Quality" },
            { key: "TotalGSM", header: "GSM" },
            { key: "UpsL", header: "UPS", render: r => `${r.UpsL}×${r.UpsW}` },
            { key: "CylinderCircumferenceInch", header: "Circ (in)" },
            { key: "SecondaryJobCount", header: "Jobs", render: r => <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full text-xs">{r.SecondaryJobCount}</span> },
            { key: "CreatedBy", header: "Created By" },
          ]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <RowAction.View onClick={() => loadPlan(row)} />
              <RowAction.Print onClick={() => openCuttingSlip(row.GangWorkOrderNo)} />
              <RowAction.Delete onClick={() => deleteGang(row.GangWorkOrderNo)} />
            </div>
          )}
        />
      )}

      {/* ── PRIMARY JOB PICKER MODAL ─────────────────────────────────────── */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-stretch z-50">
          <div className="bg-white w-full h-full flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#0f2746] rounded-t-2xl">
              <h3 className="text-white font-bold text-base">Select Primary Job Card</h3>
              <button onClick={() => setShowPicker(false)} className="text-white/70 hover:text-white">
                <X size={20}/>
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input autoFocus value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Search by JC No, Job Name, Client, Film quality…"
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            </div>

            <div className="overflow-auto flex-1">
              {pickerLoading ? (
                <div className="text-center text-sm text-gray-400 py-12">Loading eligible jobs…</div>
              ) : filteredPicker.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-12">No eligible jobs found.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      {["JC No","Sales Order","Client","Job Name","Content","Film Quality","TotalGSM","Ups L×W","Cyl(in)","Run.Mtr",""].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPicker.map((j, i) => (
                      <tr key={j.JobBookingJobCardContentsID}
                        className={`border-b border-gray-100 cursor-pointer transition-colors
                          ${i % 2 === 0 ? "bg-white hover:bg-blue-50" : "bg-gray-50 hover:bg-blue-50"}`}
                        onClick={() => selectPrimary(j)}>
                        <td className="px-3 py-2 font-mono text-blue-700 font-bold">{j.JobCardContentNo}</td>
                        <td className="px-3 py-2">{j.SalesOrderNo}</td>
                        <td className="px-3 py-2">{j.LedgerName}</td>
                        <td className="px-3 py-2 max-w-[140px] truncate">{j.JobName}</td>
                        <td className="px-3 py-2">{j.PlanContName}</td>
                        <td className="px-3 py-2">{j.Quality}</td>
                        <td className="px-3 py-2 text-right">{j.TotalGSM}</td>
                        <td className="px-3 py-2 text-center">{j.UpsL}×{j.UpsW}</td>
                        <td className="px-3 py-2 text-center">{j.CylinderCircumferenceInch}</td>
                        <td className="px-3 py-2 text-right">{j.TotalRequiredRunningMeter?.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Select
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowPicker(false)}
                className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-4 py-1.5">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
