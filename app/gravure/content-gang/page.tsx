"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Layers, ClipboardList, Plus, Trash2, RefreshCw, Printer,
  Search, X, CheckCircle2, AlertCircle, ChevronRight, Eye,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import TutorialButton from "@/components/ui/TutorialButton";
import { ColFilterIcon } from "@/components/tables/ColFilterIcon";

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

const PLAN_COLS: { h: string; key?: keyof GangPlan }[] = [
  { h: "Gang No",    key: "GangWorkOrderNo" },
  { h: "Date",       key: "GangDate" },
  { h: "Primary Job", key: "PrimaryJobName" },
  { h: "Client",     key: "PrimaryClientName" },
  { h: "Film",       key: "Quality" },
  { h: "Total GSM",  key: "TotalGSM" },
  { h: "Ups L×W" },
  { h: "Cyl (in)",   key: "CylinderCircumferenceInch" },
  { h: "Jobs",       key: "SecondaryJobCount" },
  { h: "Created By", key: "CreatedBy" },
  { h: "Actions" },
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

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const roCls    = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ContentGangPage() {
  const [tab, setTab] = useState<"planning" | "list">("planning");

  // Plan list state
  const [planList, setPlanList]   = useState<GangPlan[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch]   = useState("");

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
  const [planSort,       setPlanSort]       = useState<{ col: keyof GangPlan;   dir: "asc" | "desc" } | null>(null);
  const [planColFilters, setPlanColFilters] = useState<Partial<Record<keyof GangPlan, string>>>({});

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

  const filteredPlans = useMemo(() => {
    const q = listSearch.toLowerCase();
    let rows = q
      ? planList.filter(p =>
          p.GangWorkOrderNo.toLowerCase().includes(q) ||
          p.PrimaryJobName.toLowerCase().includes(q) ||
          p.PrimaryClientName.toLowerCase().includes(q) ||
          p.Quality.toLowerCase().includes(q)
        )
      : planList;
    rows = applyColFilter(rows, planColFilters);
    return applySort(rows, planSort);
  }, [planList, listSearch, planColFilters, planSort]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Layers size={22} className="text-blue-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Content Gang Planning</h1>
              <p className="text-xs text-gray-500">Roto Gravure · Film Gang</p>
            </div>
          </div>
          <TutorialButton title="Content Gang — Tutorial" />
          <button onClick={() => { loadPlanList(); generateNo(); }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-300 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex">
        <Tab label="Gang Planning" icon={Layers}      active={tab === "planning"}
          onClick={() => setTab("planning")} />
        <Tab label="Planned Gang List" icon={ClipboardList} active={tab === "list"}
          onClick={() => { setTab("list"); loadPlanList(); }} count={planList.length} />
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
                <input readOnly value={gangNo} className={roCls} />
              </Field>
              <Field label="Gang Date">
                <input type="date" value={gangDate}
                  onChange={e => setGangDate(e.target.value)}
                  disabled={isViewMode}
                  className={isViewMode ? roCls : inputCls} />
              </Field>
              <Field label="Type">
                <input readOnly value="Roto Gravure Gang (GPWOF)" className={roCls} />
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
                  <input readOnly value={primaryJob.JobCardContentNo} className={roCls}/>
                </Field>
                <Field label="Client" span="col-span-2">
                  <input readOnly value={primaryJob.LedgerName} className={roCls}/>
                </Field>
                <Field label="Job Name" span="col-span-2">
                  <input readOnly value={primaryJob.JobName} className={roCls}/>
                </Field>
                <Field label="Film Quality" span="col-span-2">
                  <input readOnly value={primaryJob.Quality} className={roCls}/>
                </Field>
                <Field label="Total GSM">
                  <input readOnly value={primaryJob.TotalGSM} className={roCls}/>
                </Field>
                <Field label="Total Ups">
                  <input readOnly value={primaryJob.TotalUps} className={roCls}/>
                </Field>
                <Field label="Cyl. Circum. (inch)">
                  <input readOnly value={primaryJob.CylinderCircumferenceInch} className={roCls}/>
                </Field>
                <Field label="Cyl. Circum. (mm)">
                  <input readOnly value={primaryJob.CylinderCircumferenceMM} className={roCls}/>
                </Field>
                <Field label="Across Ups (UpsL)">
                  <input readOnly value={primaryJob.UpsL} className={roCls}/>
                </Field>
                <Field label="Around Ups (UpsW)">
                  <input readOnly value={primaryJob.UpsW} className={roCls}/>
                </Field>
                <Field label="Primary Job Ups *">
                  <input type="number" min={1} max={primaryJob.TotalUps - 1}
                    value={primaryJobUps}
                    onChange={e => setPrimaryJobUps(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={isViewMode}
                    className={isViewMode ? roCls : inputCls}
                    placeholder="Enter"/>
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
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-xs">
                    <thead style={{ background: "var(--erp-primary)" }}>
                      <tr>
                        {SIM_COLS.map(({ h, key }, ci) => {
                          const isSortActive = key && simSort?.col === key;
                          const uniqVals = key ? [...new Set(similarJobs.map(r => String(r[key] ?? "")).filter(Boolean))].sort() : [];
                          return (
                            <th key={ci} className="px-3 py-2 text-left font-semibold whitespace-nowrap text-white/90">
                              {key ? (
                                <div className="flex items-center gap-1">
                                  <span className="flex items-center gap-0.5 flex-1 cursor-pointer select-none"
                                    onClick={() => setSimSort(p => p?.col === key ? p.dir === "asc" ? { col: key, dir: "desc" } : null : { col: key, dir: "asc" })}>
                                    {h}
                                    <span className="flex flex-col leading-none ml-0.5">
                                      <span className={`text-[7px] ${isSortActive && simSort!.dir === "asc" ? "text-yellow-300" : "text-white/30"}`}>▲</span>
                                      <span className={`text-[7px] ${isSortActive && simSort!.dir === "desc" ? "text-yellow-300" : "text-white/30"}`}>▼</span>
                                    </span>
                                  </span>
                                  <ColFilterIcon values={uniqVals} active={simColFilters[key] ?? ""}
                                    onChange={v => setSimColFilters(p => ({ ...p, [key]: v }))} />
                                </div>
                              ) : h}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {simSorted.map((j, i) => (
                        <tr key={j.JobBookingJobCardContentsID}
                          onClick={() => setSelectedSimilar(j)}
                          className={`cursor-pointer border-b border-gray-100 transition-colors
                            ${selectedSimilar?.JobBookingJobCardContentsID === j.JobBookingJobCardContentsID
                              ? "bg-blue-50 border-blue-200"
                              : i % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}`}>
                          <td className="px-3 py-2">
                            <input type="radio" readOnly
                              checked={selectedSimilar?.JobBookingJobCardContentsID === j.JobBookingJobCardContentsID}/>
                          </td>
                          <td className="px-3 py-2 font-mono text-blue-700">{j.JobCardContentNo}</td>
                          <td className="px-3 py-2">{j.LedgerName}</td>
                          <td className="px-3 py-2">{j.JobName}</td>
                          <td className="px-3 py-2">{j.PlanContName}</td>
                          <td className="px-3 py-2">{j.SalesOrderNo}</td>
                          <td className="px-3 py-2 text-right">{j.OrderQuantity?.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">{j.TotalRequiredRunningMeter?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                    <input type="number" min={1}
                      value={gangUpsInput}
                      onChange={e => setGangUpsInput(e.target.value === "" ? "" : Number(e.target.value))}
                      className={`${inputCls} w-28`}
                      placeholder="Enter"/>
                  </Field>
                  <Field label="Req. Sheets (auto)">
                    <input readOnly value={reqSheetsCalc || ""} className={`${roCls} w-28`}/>
                  </Field>
                  <button onClick={addToGang}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2 self-end transition-colors">
                    <Plus size={14}/> Add to Gang
                  </button>
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
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead style={{ background: "var(--erp-primary)" }}>
                    <tr>
                      {GANG_COLS.map(({ h, key }, ci) => {
                        const isSortActive = key && gangSort?.col === key;
                        const uniqVals = key ? [...new Set(gangRows.map(r => String(r[key] ?? "")).filter(Boolean))].sort() : [];
                        return (
                          <th key={ci} className="px-3 py-2 text-left font-semibold whitespace-nowrap text-white/90">
                            {key ? (
                              <div className="flex items-center gap-1">
                                <span className="flex items-center gap-0.5 flex-1 cursor-pointer select-none"
                                  onClick={() => setGangSort(p => p?.col === key ? p.dir === "asc" ? { col: key, dir: "desc" } : null : { col: key, dir: "asc" })}>
                                  {h}
                                  <span className="flex flex-col leading-none ml-0.5">
                                    <span className={`text-[7px] ${isSortActive && gangSort!.dir === "asc" ? "text-yellow-300" : "text-white/30"}`}>▲</span>
                                    <span className={`text-[7px] ${isSortActive && gangSort!.dir === "desc" ? "text-yellow-300" : "text-white/30"}`}>▼</span>
                                  </span>
                                </span>
                                <ColFilterIcon values={uniqVals} active={gangColFilters[key] ?? ""}
                                  onChange={v => setGangColFilters(p => ({ ...p, [key]: v }))} />
                              </div>
                            ) : h}
                          </th>
                        );
                      })}
                      {!isViewMode && <th className="px-3 py-2 text-white/90"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {gangSorted.map((r, i) => (
                      <tr key={r.JobBookingJobCardContentsID}
                        className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-blue-700">{r.JobCardContentNo || r.JobBookingNo}</td>
                        <td className="px-3 py-2">{r.ClientName}</td>
                        <td className="px-3 py-2">{r.JobName}</td>
                        <td className="px-3 py-2">{r.ContentName}</td>
                        <td className="px-3 py-2">{r.SalesOrderNo}</td>
                        <td className="px-3 py-2 text-right">{r.OrderQuantity?.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700">{r.GangUps}</td>
                        <td className="px-3 py-2 text-right">{r.RequiredSheets}</td>
                        <td className="px-3 py-2 text-right">{r.TotalRequiredRunningMeter?.toFixed(2)}</td>
                        {!isViewMode && (
                          <td className="px-3 py-2">
                            <button onClick={() => setGangRows(prev => prev.filter(x => x.JobBookingJobCardContentsID !== r.JobBookingJobCardContentsID))}
                              className="text-red-500 hover:text-red-700 transition-colors">
                              <Trash2 size={13}/>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-semibold text-xs">
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-gray-600">Total</td>
                      <td className="px-3 py-2 text-right">{gangRows.reduce((s,r) => s+r.OrderQuantity,0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{usedUps}</td>
                      <td className="px-3 py-2 text-right">{gangRows.reduce((s,r) => s+r.RequiredSheets,0)}</td>
                      <td className="px-3 py-2 text-right">{gangRows.reduce((s,r) => s+(r.TotalRequiredRunningMeter||0),0).toFixed(2)}</td>
                      {!isViewMode && <td/>}
                    </tr>
                  </tfoot>
                </table>
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
                <button onClick={() => deleteGang(loadedGangNo)} disabled={deleting}
                  className="flex items-center gap-2 text-sm font-semibold text-red-600 border border-red-300 rounded-lg px-4 py-2 hover:bg-red-50 disabled:opacity-50 transition-colors">
                  <Trash2 size={14}/> {deleting ? "Deleting…" : "Delete"}
                </button>
              )}
              {!isViewMode && (
                <button onClick={saveGang} disabled={saving}
                  className="flex items-center gap-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2 disabled:opacity-50 transition-colors">
                  <CheckCircle2 size={14}/> {saving ? "Saving…" : loadedGangNo ? "Update Gang" : "Save Gang"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PLANNED GANG LIST TAB ────────────────────────────────────────── */}
      {tab === "list" && (
        <div className="p-6">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">Planned Gang List — {planList.length} plans</h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={listSearch} onChange={e => setListSearch(e.target.value)}
                  placeholder="Search…"
                  className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"/>
              </div>
            </div>

            {listLoading ? (
              <div className="text-center text-sm text-gray-400 py-12">Loading…</div>
            ) : filteredPlans.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-12">No gang plans found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead style={{ background: "var(--erp-primary)" }}>
                    <tr>
                      {PLAN_COLS.map(({ h, key }, ci) => {
                        const isSortActive = key && planSort?.col === key;
                        const uniqVals = key ? [...new Set(planList.map(r => String(r[key] ?? "")).filter(Boolean))].sort() : [];
                        return (
                          <th key={ci} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap text-white/90">
                            {key ? (
                              <div className="flex items-center gap-1">
                                <span className="flex items-center gap-0.5 flex-1 cursor-pointer select-none"
                                  onClick={() => setPlanSort(p => p?.col === key ? p.dir === "asc" ? { col: key, dir: "desc" } : null : { col: key, dir: "asc" })}>
                                  {h}
                                  <span className="flex flex-col leading-none ml-0.5">
                                    <span className={`text-[7px] ${isSortActive && planSort!.dir === "asc" ? "text-yellow-300" : "text-white/30"}`}>▲</span>
                                    <span className={`text-[7px] ${isSortActive && planSort!.dir === "desc" ? "text-yellow-300" : "text-white/30"}`}>▼</span>
                                  </span>
                                </span>
                                <ColFilterIcon values={uniqVals} active={planColFilters[key] ?? ""}
                                  onChange={v => setPlanColFilters(p => ({ ...p, [key]: v }))} />
                              </div>
                            ) : h}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlans.map((p, i) => (
                      <tr key={p.GangWorkOrderNo}
                        className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                        <td className="px-3 py-2 font-mono font-bold text-blue-700">{p.GangWorkOrderNo}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{p.GangDate}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate">{p.PrimaryJobName}</td>
                        <td className="px-3 py-2 max-w-[120px] truncate">{p.PrimaryClientName}</td>
                        <td className="px-3 py-2">{p.Quality}</td>
                        <td className="px-3 py-2 text-right">{p.TotalGSM}</td>
                        <td className="px-3 py-2 text-center">{p.UpsL}×{p.UpsW}</td>
                        <td className="px-3 py-2 text-center">{p.CylinderCircumferenceInch}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                            {p.SecondaryJobCount}
                          </span>
                        </td>
                        <td className="px-3 py-2">{p.CreatedBy}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button onClick={() => loadPlan(p)}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold">
                              <Eye size={12}/> View
                            </button>
                            <button onClick={() => openCuttingSlip(p.GangWorkOrderNo)}
                              className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold">
                              <Printer size={12}/> Print
                            </button>
                            <button onClick={() => deleteGang(p.GangWorkOrderNo)}
                              className="flex items-center gap-1 text-red-500 hover:text-red-700 font-semibold">
                              <Trash2 size={12}/> Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PRIMARY JOB PICKER MODAL ─────────────────────────────────────── */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
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
