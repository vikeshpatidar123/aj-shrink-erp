"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  RefreshCw, Eye, AlertCircle, X,
  Filter, ArrowRight, Check, ChevronUp, ChevronDown, Search,
  Paperclip, FileText, Download,
} from "lucide-react";
import { apiGet, apiPost, API_BASE } from "@/lib/api";
import { authHeaders } from "@/lib/auth";

const CLDN_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
async function fetchSignature() {
  const res = await fetch(`${CLDN_BASE}/api/cloudinary/sign`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Could not get upload signature");
  return res.json() as Promise<{ signature: string; timestamp: number; cloudName: string; apiKey: string }>;
}
import { useMasters } from "@/context/MastersContext";
import { Input, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

// ─── 9-stage artwork pipeline ──────────────────────────────────────────────
const STAGES = [
  "Artwork Pending",
  "Artwork Received",
  "Design In Progress",
  "Brand Approval Sent",
  "Brand Approved",
  "LSD Shade Approved",
  "Cylinder Ordered",
  "Cylinder Received",
  "Released to Production",
] as const;

const STAGE_COLOR: Record<string, string> = {
  "Artwork Pending":        "bg-gray-100 text-gray-500",
  "Artwork Received":       "bg-blue-100 text-blue-700",
  "Design In Progress":     "bg-cyan-100 text-cyan-700",
  "Brand Approval Sent":    "bg-amber-100 text-amber-700",
  "Brand Approved":         "bg-lime-100 text-lime-700",
  "LSD Shade Approved":     "bg-teal-100 text-teal-700",
  "Cylinder Ordered":       "bg-purple-100 text-purple-700",
  "Cylinder Received":      "bg-indigo-100 text-indigo-700",
  "Released to Production": "bg-green-100 text-green-700",
};
const stageIdx = (s: string) => STAGES.indexOf(s as typeof STAGES[number]);

// ─── Types ─────────────────────────────────────────────────────────────────
type DashRow = {
  WorkOrderID: string;       WorkOrderNo: string;       WODate: string;
  CustomerID: string;        CustomerName: string;      JobName: string;
  Substrate: string;         CategoryName: string;      ContentType: string;
  NoOfColors: number;        PrintType: string;         StructureType: string;
  ActualWidth: number;       ActualHeight: number;
  MachineName: string;       WOStatus: string;          PlannedDate: string;
  ProductMasterID: string;   ProductMasterCode: string; OrderNo: string;
  BrandName: string;         ProductName: string;       ArtworkName: string;
  PackSize: string;          ProductType: string;       SkuType: string;
  CatalogSubstrate: string;  RepeatLength: number;      CatalogNoOfColors: number;
  SourceWorkOrderNo: string;
  ColorNo: number;           ColorName: string;         InkType: string;
  PantoneRef: string;        LabL: string;              LabA: string;
  LabB: string;              ShadeCardRef: string;
  WOCylinderNo: string;      WOCylinderType: string;    WOCylinderStatus: string;
  ShadeStatus: string;       ColorRemarks: string;
  CylToolID: string;         CylCode: string;           CylName: string;
  CylCircumMM: number;       CylPrintWidth: number;     CylSizeL: number;
  CylType: string;           CylShelfLife: number;      CylUsedMeters: number;
  CylTotalColors: number;    CylNoOfRepeats: number;
  CylVendorName: string;     CylRefCode: string;        CylLocation: string;
  ArtworkStatusID: string;   Stage: string;             SavedCylinderNo: string;
  ArtworkReceivedDate: string;   DesignDoneDate: string;
  BrandApprovalSentDate: string; BrandApprovalDate: string;
  LSDApprovalDate: string;       CylinderOrderDate: string;
  CylinderExpectedDate: string;  CylinderReceivedDate: string;
  CylinderVendor: string;        ReleasedDate: string;
  Remarks: string;               UpdatedDate: string;
  _key: string;
};

type CylRow = {
  ToolID: string; ToolCode: string; ToolName: string;
  CircumferenceMM: number; SizeW: number; CylinderType: string;
};

type Attachment = {
  AttachmentID: string; FileName: string; FilePath: string;
  FileSize: number; UploadedDate: string;
};

// ─── Section Header ────────────────────────────────────────────────────────
const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2 pb-1 border-b border-purple-100">
    {label}
  </p>
);

// ─── Filter Dropdown helper ─────────────────────────────────────────────────
const FDrop = ({ label, val, set, opts, w = "min-w-[130px]" }: {
  label: string; val: string; set: (v: string) => void; opts: readonly string[]; w?: string;
}) => (
  <div className={`flex flex-col gap-1 ${w}`}>
    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</label>
    <select value={val} onChange={e => set(e.target.value)}
      className={`text-xs border rounded-lg px-2 py-1.5 outline-none cursor-pointer transition
        ${val ? "border-blue-400 bg-blue-50 text-blue-800 font-semibold" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
      <option value="">All</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════
export default function ArtworkManagementPage() {
  const { vendorLedgers } = useMasters();

  // ── Data ─────────────────────────────────────────────────────────────
  const [rows,      setRows]      = useState<DashRow[]>([]);
  const [cylinders, setCylinders] = useState<CylRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  // ── Filters ──────────────────────────────────────────────────────────
  const [showFilters,    setShowFilters]    = useState(true);
  const [fSearch,        setFSearch]        = useState("");
  // Job / Product
  const [fCustomer,      setFCustomer]      = useState("");
  const [fJobName,       setFJobName]       = useState("");
  const [fBrand,         setFBrand]         = useState("");
  const [fProduct,       setFProduct]       = useState("");
  const [fSku,           setFSku]           = useState("");
  // Artwork classification
  const [fCategory,      setFCategory]      = useState("");
  const [fSubstrate,     setFSubstrate]     = useState("");
  const [fContentType,   setFContentType]   = useState("");
  const [fProductType,   setFProductType]   = useState("");
  const [fNoOfColors,    setFNoOfColors]    = useState("");
  // Cylinder details
  const [fCylMaker,      setFCylMaker]      = useState("");
  const [fCylType,       setFCylType]       = useState("");
  const [fCylStatus,     setFCylStatus]     = useState("");
  const [fCylCircum,     setFCylCircum]     = useState("");
  const [fCoilWidth,     setFCoilWidth]     = useState("");
  const [fRepeatLength,  setFRepeatLength]  = useState("");
  const [fCylLength,     setFCylLength]     = useState("");
  const [fMachine,       setFMachine]       = useState("");
  // Status / dates
  const [fStage,         setFStage]         = useState("");
  const [fWOStatus,      setFWOStatus]      = useState("");
  const [fColorName,     setFColorName]     = useState("");
  const [fBrandAppr,     setFBrandAppr]     = useState("");
  const [fLSDAppr,       setFLSDAppr]       = useState("");
  const [fCylReceived,   setFCylReceived]   = useState("");
  const [fCylVendor,     setFCylVendor]     = useState("");

  // ── Sort ─────────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState<keyof DashRow>("WorkOrderNo");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  // ── Modals ───────────────────────────────────────────────────────────
  const [updateModal, setUpdateModal] = useState(false);
  const [viewModal,   setViewModal]   = useState(false);
  const [selected,    setSelected]    = useState<DashRow | null>(null);
  const [form,        setForm]        = useState<Record<string, string>>({});
  const [saving,      setSaving]      = useState(false);
  const sf = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  // ── Attachments ───────────────────────────────────────────────────────
  const [attachments,   setAttachments]   = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Load work order data ─────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const raw = await apiGet<any[]>("api/gravure/artworkStatus/list");
      if (!Array.isArray(raw)) {
        const resp = raw as any;
        if (resp?.error) { setError(resp.error); setRows([]); return; }
        setRows([]);
        return;
      }
      const mapped: DashRow[] = raw.map((r: any) => ({
        WorkOrderID:          String(r.WorkOrderID ?? ""),
        WorkOrderNo:          String(r.WorkOrderNo ?? ""),
        WODate:               String(r.WODate ?? ""),
        CustomerID:           String(r.CustomerID ?? ""),
        CustomerName:         String(r.CustomerName ?? ""),
        JobName:              String(r.JobName ?? ""),
        Substrate:            String(r.Substrate ?? ""),
        CategoryName:         String(r.CategoryName ?? ""),
        ContentType:          String(r.ContentType ?? ""),
        NoOfColors:           Number(r.NoOfColors ?? 0),
        PrintType:            String(r.PrintType ?? ""),
        StructureType:        String(r.StructureType ?? ""),
        ActualWidth:          Number(r.ActualWidth ?? 0),
        ActualHeight:         Number(r.ActualHeight ?? 0),
        MachineName:          String(r.MachineName ?? ""),
        WOStatus:             String(r.WOStatus ?? "Open"),
        PlannedDate:          String(r.PlannedDate ?? ""),
        ProductMasterID:      String(r.ProductMasterID ?? ""),
        ProductMasterCode:    String(r.ProductMasterCode ?? ""),
        OrderNo:              String(r.OrderNo ?? ""),
        BrandName:            String(r.BrandName ?? ""),
        ProductName:          String(r.ProductName ?? ""),
        ArtworkName:          String(r.ArtworkName ?? ""),
        PackSize:             String(r.PackSize ?? ""),
        ProductType:          String(r.ProductType ?? ""),
        SkuType:              String(r.SkuType ?? ""),
        CatalogSubstrate:     String(r.CatalogSubstrate ?? ""),
        RepeatLength:         Number(r.RepeatLength ?? 0),
        CatalogNoOfColors:    Number(r.CatalogNoOfColors ?? 0),
        SourceWorkOrderNo:    String(r.SourceWorkOrderNo ?? ""),
        ColorNo:              Number(r.ColorNo ?? 0),
        ColorName:            String(r.ColorName ?? ""),
        InkType:              String(r.InkType ?? "Spot"),
        PantoneRef:           String(r.PantoneRef ?? ""),
        LabL:                 String(r.LabL ?? ""),
        LabA:                 String(r.LabA ?? ""),
        LabB:                 String(r.LabB ?? ""),
        ShadeCardRef:         String(r.ShadeCardRef ?? ""),
        WOCylinderNo:         String(r.WOCylinderNo ?? ""),
        WOCylinderType:       String(r.WOCylinderType ?? ""),
        WOCylinderStatus:     String(r.WOCylinderStatus ?? ""),
        ShadeStatus:          String(r.ShadeStatus ?? "Pending"),
        ColorRemarks:         String(r.ColorRemarks ?? ""),
        CylToolID:            String(r.CylToolID ?? ""),
        CylCode:              String(r.CylCode ?? ""),
        CylName:              String(r.CylName ?? ""),
        CylCircumMM:          Number(r.CylCircumMM ?? 0),
        CylPrintWidth:        Number(r.CylPrintWidth ?? 0),
        CylSizeL:             Number(r.CylSizeL ?? 0),
        CylType:              String(r.CylType ?? ""),
        CylShelfLife:         Number(r.CylShelfLife ?? 0),
        CylUsedMeters:        Number(r.CylUsedMeters ?? 0),
        CylTotalColors:       Number(r.CylTotalColors ?? 0),
        CylNoOfRepeats:       Number(r.CylNoOfRepeats ?? 0),
        CylVendorName:        String(r.CylVendorName ?? ""),
        CylRefCode:           String(r.CylRefCode ?? ""),
        CylLocation:          String(r.CylLocation ?? ""),
        ArtworkStatusID:      String(r.ArtworkStatusID ?? "0"),
        Stage:                String(r.Stage ?? "Artwork Pending"),
        SavedCylinderNo:      String(r.SavedCylinderNo ?? ""),
        ArtworkReceivedDate:  String(r.ArtworkReceivedDate ?? ""),
        DesignDoneDate:       String(r.DesignDoneDate ?? ""),
        BrandApprovalSentDate:String(r.BrandApprovalSentDate ?? ""),
        BrandApprovalDate:    String(r.BrandApprovalDate ?? ""),
        LSDApprovalDate:      String(r.LSDApprovalDate ?? ""),
        CylinderOrderDate:    String(r.CylinderOrderDate ?? ""),
        CylinderExpectedDate: String(r.CylinderExpectedDate ?? ""),
        CylinderReceivedDate: String(r.CylinderReceivedDate ?? ""),
        CylinderVendor:       String(r.CylinderVendor ?? ""),
        ReleasedDate:         String(r.ReleasedDate ?? ""),
        Remarks:              String(r.Remarks ?? ""),
        UpdatedDate:          String(r.UpdatedDate ?? ""),
        _key: `${r.WorkOrderID}_${r.ColorNo}`,
      }));
      setRows(mapped);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally { setLoading(false); }
  }, []);

  // ─── Load cylinder list from ToolMaster ───────────────────────────────
  const loadCylinders = useCallback(async () => {
    try {
      const data = await apiGet<CylRow[]>("api/gravure/artworkStatus/cylinders");
      if (Array.isArray(data)) setCylinders(data);
    } catch { /* silent — dropdown will be empty */ }
  }, []);

  useEffect(() => { load(); loadCylinders(); }, [load, loadCylinders]);

  // ─── Load attachments for a given WO + color ─────────────────────────
  const loadAttachments = useCallback(async (workOrderId: string, colorNo: number) => {
    try {
      const data = await apiGet<Attachment[]>(
        `api/gravure/artworkStatus/attachments?jobBookingId=${workOrderId}&colorNo=${colorNo}`
      );
      setAttachments(Array.isArray(data) ? data : []);
    } catch { setAttachments([]); }
  }, []);

  // ─── Upload file → Cloudinary, then save URL to DB ──────────────────
  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadingFile(true);
    try {
      const sig = await fetchSignature();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.apiKey);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
        { method: "POST", body: fd }
      );
      if (!uploadRes.ok) throw new Error("Cloudinary upload failed");
      const data = await uploadRes.json();
      await apiPost("api/gravure/artworkStatus/saveAttachmentUrl", {
        JobBookingID: selected.WorkOrderID,
        ColorNo: selected.ColorNo,
        FileName: file.name,
        CloudinaryUrl: data.secure_url,
        FileSize: file.size,
      });
      await loadAttachments(selected.WorkOrderID, selected.ColorNo);
    } catch { alert("Upload failed"); }
    finally { setUploadingFile(false); }
  };

  // ─── Download file ────────────────────────────────────────────────────
  const downloadAttachment = async (attachmentId: string, fileName: string, filePath: string) => {
    if (filePath?.startsWith("http")) {
      const a = document.createElement("a");
      a.href = filePath; a.download = fileName; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      return;
    }
    try {
      const { "Content-Type": _, ...hdrs } = authHeaders();
      const res = await fetch(
        `${API_BASE}/api/gravure/artworkStatus/downloadAttachment/${attachmentId}`,
        { headers: hdrs }
      );
      if (!res.ok) { alert("Download failed"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { alert("Download failed"); }
  };

  // ─── View file in new tab (images/PDF inline; others download) ───────
  const viewAttachment = async (attachmentId: string, fileName: string, filePath: string) => {
    if (filePath?.startsWith("http")) {
      window.open(filePath, "_blank");
      return;
    }
    try {
      const { "Content-Type": _, ...hdrs } = authHeaders();
      const res = await fetch(
        `${API_BASE}/api/gravure/artworkStatus/downloadAttachment/${attachmentId}`,
        { headers: hdrs }
      );
      if (!res.ok) { alert("Preview failed"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const ext  = fileName.split(".").pop()?.toLowerCase() ?? "";
      const viewable = ["pdf","png","jpg","jpeg","gif","bmp","webp","svg"].includes(ext);
      if (viewable) {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
      }
    } catch { alert("Preview failed"); }
  };

  // ─── Filtered + sorted rows ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = rows;
    if (fCustomer)      r = r.filter(x => x.CustomerName === fCustomer);
    if (fJobName)       r = r.filter(x => x.JobName === fJobName);
    if (fBrand)         r = r.filter(x => x.BrandName === fBrand);
    if (fProduct)       r = r.filter(x => x.ProductName === fProduct);
    if (fSku)           r = r.filter(x => x.PackSize === fSku);
    if (fCategory)      r = r.filter(x => x.CategoryName === fCategory);
    if (fSubstrate)     r = r.filter(x => (x.CatalogSubstrate || x.Substrate) === fSubstrate);
    if (fContentType)   r = r.filter(x => x.ContentType === fContentType);
    if (fProductType)   r = r.filter(x => x.ProductType === fProductType);
    if (fNoOfColors)    r = r.filter(x => String(x.CatalogNoOfColors || x.NoOfColors) === fNoOfColors);
    if (fCylMaker)      r = r.filter(x => x.CylVendorName === fCylMaker);
    if (fCylType)       r = r.filter(x => x.CylType === fCylType);
    if (fCylStatus)     r = r.filter(x => x.WOCylinderStatus === fCylStatus);
    if (fCylCircum)     r = r.filter(x => String(x.CylCircumMM) === fCylCircum);
    if (fCoilWidth)     r = r.filter(x => String(x.CylPrintWidth) === fCoilWidth);
    if (fRepeatLength)  r = r.filter(x => String(x.RepeatLength) === fRepeatLength);
    if (fCylLength)     r = r.filter(x => String(x.CylSizeL) === fCylLength);
    if (fMachine)       r = r.filter(x => x.MachineName === fMachine);
    if (fStage)         r = r.filter(x => x.Stage === fStage);
    if (fWOStatus)      r = r.filter(x => x.WOStatus === fWOStatus);
    if (fColorName)     r = r.filter(x => x.ColorName === fColorName);
    if (fCylVendor)     r = r.filter(x => x.CylinderVendor === fCylVendor);
    if (fBrandAppr === "yes") r = r.filter(x => !!x.BrandApprovalDate);
    if (fBrandAppr === "no")  r = r.filter(x => !x.BrandApprovalDate);
    if (fLSDAppr   === "yes") r = r.filter(x => !!x.LSDApprovalDate);
    if (fLSDAppr   === "no")  r = r.filter(x => !x.LSDApprovalDate);
    if (fCylReceived === "yes") r = r.filter(x => !!x.CylinderReceivedDate);
    if (fCylReceived === "no")  r = r.filter(x => !x.CylinderReceivedDate);
    if (fSearch.trim()) {
      const q = fSearch.toLowerCase();
      r = r.filter(x =>
        [x.WorkOrderNo, x.OrderNo, x.CustomerName, x.JobName, x.BrandName,
         x.ProductName, x.PackSize, x.ArtworkName, x.ColorName, x.PantoneRef,
         x.WOCylinderNo, x.SavedCylinderNo, x.CylCode, x.CylRefCode, x.CylName,
         x.CylType, x.CylVendorName, x.CylLocation, x.Stage, x.ContentType,
         x.ProductType, x.MachineName]
          .join(" ").toLowerCase().includes(q)
      );
    }
    return [...r].sort((a, b) => {
      const av = String((a as any)[sortCol] ?? "");
      const bv = String((b as any)[sortCol] ?? "");
      if (!isNaN(Number(av)) && !isNaN(Number(bv)))
        return (Number(av) - Number(bv)) * sortDir;
      return av.localeCompare(bv) * sortDir;
    });
  }, [rows, fCustomer, fJobName, fBrand, fProduct, fSku, fCategory, fSubstrate,
      fContentType, fProductType, fNoOfColors, fCylMaker, fCylType, fCylStatus,
      fCylCircum, fCoilWidth, fRepeatLength, fCylLength, fMachine,
      fStage, fWOStatus, fColorName, fCylVendor, fBrandAppr, fLSDAppr, fCylReceived,
      fSearch, sortCol, sortDir]);

  const anyFilter = !!(fCustomer || fJobName || fBrand || fProduct || fSku ||
    fCategory || fSubstrate || fContentType || fProductType || fNoOfColors ||
    fCylMaker || fCylType || fCylStatus || fCylCircum || fCoilWidth ||
    fRepeatLength || fCylLength || fMachine ||
    fStage || fWOStatus || fColorName || fCylVendor ||
    fBrandAppr || fLSDAppr || fCylReceived || fSearch);

  function resetFilters() {
    setFSearch(""); setFCustomer(""); setFJobName(""); setFBrand(""); setFProduct(""); setFSku("");
    setFCategory(""); setFSubstrate(""); setFContentType(""); setFProductType(""); setFNoOfColors("");
    setFCylMaker(""); setFCylType(""); setFCylStatus(""); setFCylCircum(""); setFCoilWidth("");
    setFRepeatLength(""); setFCylLength(""); setFMachine("");
    setFStage(""); setFWOStatus(""); setFColorName(""); setFCylVendor("");
    setFBrandAppr(""); setFLSDAppr(""); setFCylReceived("");
  }
  function handleSort(col: keyof DashRow) {
    if (sortCol === col) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortCol(col); setSortDir(1); }
  }

  // ─── KPI ─────────────────────────────────────────────────────────────
  const kpi = useMemo(() => ({
    total:       rows.length,
    pending:     rows.filter(r => r.Stage === "Artwork Pending").length,
    inProgress:  rows.filter(r => stageIdx(r.Stage) >= 1 && stageIdx(r.Stage) <= 5).length,
    brandApproved: rows.filter(r => !!r.BrandApprovalDate).length,
    cylRcvd:     rows.filter(r => stageIdx(r.Stage) >= 7).length,
    released:    rows.filter(r => r.Stage === "Released to Production").length,
  }), [rows]);

  const uniq = (fn: (r: DashRow) => string) =>
    [...new Set(rows.map(fn).filter(Boolean))].sort();

  // ─── Open update modal — all empty dates default to today ─────────────
  const openUpdate = (row: DashRow) => {
    const today = new Date().toISOString().split("T")[0];
    setSelected(row);
    setAttachments([]);
    loadAttachments(row.WorkOrderID, row.ColorNo);
    setForm({
      WorkOrderID:          row.WorkOrderID,
      WorkOrderNo:          row.WorkOrderNo,
      ColorNo:              String(row.ColorNo),
      ColorName:            row.ColorName,
      PantoneRef:           row.PantoneRef,
      CylinderNo:           row.SavedCylinderNo || row.WOCylinderNo || row.CylCode,
      Stage:                row.Stage,
      CylinderVendor:       row.CylinderVendor,
      ArtworkReceivedDate:  row.ArtworkReceivedDate  || today,
      DesignDoneDate:       row.DesignDoneDate        || today,
      BrandApprovalSentDate:row.BrandApprovalSentDate || today,
      BrandApprovalDate:    row.BrandApprovalDate     || today,
      LSDApprovalDate:      row.LSDApprovalDate       || today,
      CylinderOrderDate:    row.CylinderOrderDate     || today,
      CylinderExpectedDate: row.CylinderExpectedDate  || today,
      CylinderReceivedDate: row.CylinderReceivedDate  || today,
      ReleasedDate:         row.ReleasedDate          || today,
      Remarks:              row.Remarks,
    });
    setUpdateModal(true);
  };

  const saveStatus = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        ArtworkStatusID: selected.ArtworkStatusID || "0",
        WorkOrderID:     selected.WorkOrderID,
        ColorNo:         selected.ColorNo,
      };
      const endpoint = (selected.ArtworkStatusID && selected.ArtworkStatusID !== "0")
        ? "api/gravure/artworkStatus/update"
        : "api/gravure/artworkStatus/save";
      const res = await apiPost<any>(endpoint, payload);
      if (typeof res === "string" && (res as string).startsWith("Error:")) {
        alert(res); return;
      }
      setUpdateModal(false);
      await load();
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally { setSaving(false); }
  };

  // ─── Table header helper ──────────────────────────────────────────────
  const TH = ({ col, label }: { col: keyof DashRow; label: string }) => (
    <th onClick={() => handleSort(col)}
      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide
        text-white/90 cursor-pointer select-none hover:text-white whitespace-nowrap">
      <span className="flex items-center gap-1">
        {label}
        {sortCol === col && (sortDir === 1 ? <ChevronUp size={10}/> : <ChevronDown size={10}/>)}
      </span>
    </th>
  );

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full overflow-hidden flex flex-col -m-4 md:-m-6 lg:-m-7">
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">

        {/* ── KPI Cards ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Total Colors",   val: kpi.total,        color: "text-gray-800",   bg: "bg-white",      click: resetFilters },
            { label: "Art. Pending",   val: kpi.pending,      color: "text-gray-500",   bg: "bg-gray-50",    click: () => setFStage("Artwork Pending") },
            { label: "In Progress",    val: kpi.inProgress,   color: "text-amber-700",  bg: "bg-amber-50",   click: () => {} },
            { label: "Brand Approved", val: kpi.brandApproved,color: "text-lime-700",   bg: "bg-lime-50",    click: () => setFBrandAppr("yes") },
            { label: "Cyl. Received",  val: kpi.cylRcvd,      color: "text-indigo-700", bg: "bg-indigo-50",  click: () => setFCylReceived("yes") },
            { label: "Released",       val: kpi.released,     color: "text-green-700",  bg: "bg-green-50",   click: () => setFStage("Released to Production") },
          ].map(k => (
            <button key={k.label} onClick={k.click}
              className={`${k.bg} border border-gray-200 rounded-xl p-3 shadow-sm text-left hover:shadow-md transition-shadow`}>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1 leading-tight">{k.label}</p>
              <p className={`text-2xl font-black ${k.color}`}>{loading ? "…" : k.val}</p>
            </button>
          ))}
        </div>

        {/* ── Error ─────────────────────────────────────────────────── */}
        {error && (
          <div className="flex-shrink-0 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            <AlertCircle size={13}/>{error}
            <button onClick={load} className="ml-auto text-red-600 font-bold hover:underline">Retry</button>
          </div>
        )}

        {/* ── Filters ───────────────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-white border-2 border-blue-300 rounded-xl p-3 relative">
          <span className="absolute -top-2.5 left-4 bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
            Filters {anyFilter && `— ${filtered.length} / ${rows.length}`}
          </span>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setShowFilters(f => !f)}
              className="flex items-center gap-1 text-xs font-bold text-blue-700">
              <Filter size={12}/>{showFilters ? "Hide" : "Show"} Filters
              {anyFilter && <span className="ml-1 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">Active</span>}
            </button>
            {anyFilter && (
              <button onClick={resetFilters}
                className="text-xs font-bold text-red-600 border border-red-300 bg-white hover:bg-red-50 px-2.5 py-1 rounded-lg transition">
                ↺ Reset All
              </button>
            )}
          </div>
          {showFilters && (
            <div className="space-y-2">
              {/* Row 1 — Search + Job/Product identity */}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-[220px] max-w-xs shadow-sm">
                  <Search size={12} className="text-purple-400 flex-shrink-0"/>
                  <input value={fSearch} onChange={e => setFSearch(e.target.value)}
                    placeholder="Search WO, brand, cylinder, color…"
                    className="bg-transparent text-xs text-gray-700 outline-none w-full"/>
                  {fSearch && <button onClick={() => setFSearch("")} className="text-gray-400"><X size={10}/></button>}
                </div>
                {([
                  { label: "Customer / Party", val: fCustomer,    set: setFCustomer,    opts: uniq(r => r.CustomerName),                          w: "min-w-[180px]" },
                  { label: "Job Name",         val: fJobName,     set: setFJobName,     opts: uniq(r => r.JobName),                               w: "min-w-[150px]" },
                  { label: "Brand",            val: fBrand,       set: setFBrand,       opts: uniq(r => r.BrandName),                             w: "min-w-[130px]" },
                  { label: "Product",          val: fProduct,     set: setFProduct,     opts: uniq(r => r.ProductName),                           w: "min-w-[140px]" },
                  { label: "SKU Size",         val: fSku,         set: setFSku,         opts: uniq(r => r.PackSize),                              w: "min-w-[110px]" },
                ] as const).map(f => (
                  <FDrop key={f.label} label={f.label} val={f.val} set={f.set as (v:string)=>void} opts={f.opts} w={f.w}/>
                ))}
              </div>

              {/* Row 2 — Artwork classification */}
              <div className="flex flex-wrap gap-2 items-end">
                {([
                  { label: "Category",     val: fCategory,    set: setFCategory,    opts: uniq(r => r.CategoryName),                          w: "min-w-[130px]" },
                  { label: "Substrate",    val: fSubstrate,   set: setFSubstrate,   opts: uniq(r => r.CatalogSubstrate || r.Substrate),        w: "min-w-[130px]" },
                  { label: "Design Type",  val: fContentType, set: setFContentType, opts: uniq(r => r.ContentType),                           w: "min-w-[130px]" },
                  { label: "Application",  val: fProductType, set: setFProductType, opts: uniq(r => r.ProductType),                           w: "min-w-[120px]" },
                  { label: "No. of Colors",val: fNoOfColors,  set: setFNoOfColors,  opts: uniq(r => String(r.CatalogNoOfColors || r.NoOfColors)).filter(v=>v!=="0"), w: "min-w-[110px]" },
                  { label: "Color Name",   val: fColorName,   set: setFColorName,   opts: uniq(r => r.ColorName),                             w: "min-w-[140px]" },
                  { label: "Machine",      val: fMachine,     set: setFMachine,     opts: uniq(r => r.MachineName),                           w: "min-w-[120px]" },
                ] as const).map(f => (
                  <FDrop key={f.label} label={f.label} val={f.val} set={f.set as (v:string)=>void} opts={f.opts} w={f.w}/>
                ))}
              </div>

              {/* Row 3 — Cylinder details */}
              <div className="flex flex-wrap gap-2 items-end">
                {([
                  { label: "Cylinder Maker", val: fCylMaker,     set: setFCylMaker,     opts: uniq(r => r.CylVendorName),                     w: "min-w-[140px]" },
                  { label: "Cyl. Type",      val: fCylType,      set: setFCylType,      opts: uniq(r => r.CylType),                           w: "min-w-[110px]" },
                  { label: "Cyl. Status",    val: fCylStatus,    set: setFCylStatus,    opts: uniq(r => r.WOCylinderStatus),                  w: "min-w-[120px]" },
                  { label: "Circum (mm)",    val: fCylCircum,    set: setFCylCircum,    opts: uniq(r => r.CylCircumMM ? String(r.CylCircumMM) : "").filter(Boolean), w: "min-w-[110px]" },
                  { label: "Coil Width (mm)",val: fCoilWidth,    set: setFCoilWidth,    opts: uniq(r => r.CylPrintWidth ? String(r.CylPrintWidth) : "").filter(Boolean), w: "min-w-[120px]" },
                  { label: "Repeat (mm)",    val: fRepeatLength, set: setFRepeatLength, opts: uniq(r => r.RepeatLength ? String(r.RepeatLength) : "").filter(Boolean), w: "min-w-[110px]" },
                  { label: "Cyl. Length (mm)",val: fCylLength,   set: setFCylLength,    opts: uniq(r => r.CylSizeL ? String(r.CylSizeL) : "").filter(Boolean), w: "min-w-[120px]" },
                  { label: "Order Vendor",   val: fCylVendor,    set: setFCylVendor,    opts: uniq(r => r.CylinderVendor),                    w: "min-w-[130px]" },
                ] as const).map(f => (
                  <FDrop key={f.label} label={f.label} val={f.val} set={f.set as (v:string)=>void} opts={f.opts} w={f.w}/>
                ))}
              </div>

              {/* Row 4 — Status / approval flags */}
              <div className="flex flex-wrap gap-2 items-end">
                {([
                  { label: "Artwork Stage", val: fStage,    set: setFStage,    opts: [...STAGES],                                       w: "min-w-[160px]" },
                  { label: "WO Status",     val: fWOStatus, set: setFWOStatus, opts: ["Open","In Progress","Completed","On Hold"],       w: "min-w-[120px]" },
                ] as const).map(f => (
                  <FDrop key={f.label} label={f.label} val={f.val} set={f.set as (v:string)=>void} opts={f.opts} w={f.w}/>
                ))}
                {([
                  { label: "Brand Appr.", val: fBrandAppr,   set: setFBrandAppr },
                  { label: "LSD Appr.",   val: fLSDAppr,     set: setFLSDAppr },
                  { label: "Cyl. Rcvd",   val: fCylReceived, set: setFCylReceived },
                ] as const).map(f => (
                  <div key={f.label} className="flex flex-col gap-1 min-w-[100px]">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{f.label}</label>
                    <select value={f.val} onChange={e => (f.set as (v:string)=>void)(e.target.value)}
                      className={`text-xs border rounded-lg px-2 py-1.5 outline-none cursor-pointer transition
                        ${f.val ? "border-blue-400 bg-blue-50 text-blue-800 font-semibold" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
                      <option value="">All</option>
                      <option value="yes">✓ Yes</option>
                      <option value="no">✗ No</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Main Table ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2 flex-shrink-0">
            {anyFilter && (
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg">
                {filtered.length} of {rows.length} results
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {loading && (
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <RefreshCw size={10} className="animate-spin"/>Loading…
                </span>
              )}
              <Button variant="secondary" size="sm"
                icon={<RefreshCw size={12} className={loading ? "animate-spin" : ""}/>}
                onClick={load} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="flex-1 overflow-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-xs" style={{ minWidth: "2600px" }}>
              <thead className="sticky top-0 z-10">
                <tr style={{ background: "var(--erp-primary)" }}>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-white/90 whitespace-nowrap">#</th>
                  <TH col="WorkOrderNo"          label="WO No"/>
                  <TH col="WODate"               label="Date"/>
                  <TH col="OrderNo"              label="Order No"/>
                  <TH col="CustomerName"         label="Customer"/>
                  <TH col="JobName"              label="Job Name"/>
                  <TH col="BrandName"            label="Brand"/>
                  <TH col="ProductName"          label="Product"/>
                  <TH col="ArtworkName"          label="Artwork"/>
                  <TH col="CategoryName"         label="Category"/>
                  <TH col="Substrate"            label="Substrate"/>
                  <TH col="PackSize"             label="Pack Size"/>
                  <TH col="ProductType"          label="Type"/>
                  <TH col="NoOfColors"           label="# Clrs"/>
                  <TH col="RepeatLength"         label="Repeat (mm)"/>
                  <TH col="ActualWidth"          label="Width (mm)"/>
                  <TH col="ActualHeight"         label="Height (mm)"/>
                  <TH col="ColorNo"              label="Clr #"/>
                  <TH col="ColorName"            label="Color Name"/>
                  <TH col="InkType"              label="Ink Type"/>
                  <TH col="PantoneRef"           label="Pantone"/>
                  <TH col="WOCylinderNo"         label="Cyl. No (WO)"/>
                  <TH col="SavedCylinderNo"      label="Tracked Cyl."/>
                  <TH col="CylCode"              label="Tool Code"/>
                  <TH col="CylRefCode"           label="Ref. Code"/>
                  <TH col="CylName"              label="Cylinder Name"/>
                  <TH col="CylType"              label="Cyl. Type"/>
                  <TH col="CylCircumMM"          label="Circum (mm)"/>
                  <TH col="CylPrintWidth"        label="Print W (mm)"/>
                  <TH col="CylSizeL"             label="Size L (mm)"/>
                  <TH col="CylTotalColors"       label="Tot. Clrs"/>
                  <TH col="CylNoOfRepeats"       label="Repeats"/>
                  <TH col="CylShelfLife"         label="Life (m)"/>
                  <TH col="CylVendorName"        label="Cyl. Maker"/>
                  <TH col="CylLocation"          label="Location"/>
                  <TH col="CylinderVendor"       label="Order Vendor"/>
                  <TH col="Stage"                label="Artwork Stage"/>
                  <TH col="ArtworkReceivedDate"  label="Art. Rcvd"/>
                  <TH col="BrandApprovalSentDate"label="Appr. Sent"/>
                  <TH col="BrandApprovalDate"    label="Brand Appr."/>
                  <TH col="LSDApprovalDate"      label="LSD Appr."/>
                  <TH col="CylinderOrderDate"    label="Cyl. Ordrd"/>
                  <TH col="CylinderExpectedDate" label="Cyl. Expctd"/>
                  <TH col="CylinderReceivedDate" label="Cyl. Rcvd"/>
                  <TH col="ReleasedDate"         label="Released"/>
                  <TH col="WOStatus"             label="WO Status"/>
                  <TH col="MachineName"          label="Machine"/>
                  <TH col="PlannedDate"          label="Planned"/>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-white/90 whitespace-nowrap sticky right-0"
                      style={{ background: "var(--erp-primary)" }}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={50} className="text-center py-16 text-gray-400 text-sm">
                      {loading ? "Loading ERP data…" : anyFilter ? "No records match the filters." : "No Work Orders found — ensure colors are defined in Work Orders."}
                    </td>
                  </tr>
                ) : filtered.map((r, idx) => (
                  <tr key={r._key} className="hover:bg-purple-50/40 transition-colors group">
                    <td className="px-3 py-2 text-gray-400 text-[11px]">{idx + 1}</td>
                    <td className="px-3 py-2 font-bold text-purple-700 whitespace-nowrap">{r.WorkOrderNo}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.WODate || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{r.OrderNo || "—"}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{r.CustomerName}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[120px] truncate" title={r.JobName}>{r.JobName || "—"}</td>
                    <td className="px-3 py-2 text-blue-700 font-medium">{r.BrandName || "—"}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[110px] truncate" title={r.ProductName}>{r.ProductName || "—"}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[100px] truncate" title={r.ArtworkName}>{r.ArtworkName || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.CategoryName || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.CatalogSubstrate || r.Substrate || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.PackSize || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{r.ProductType || "—"}</td>
                    <td className="px-3 py-2 text-center font-bold text-purple-700">{r.NoOfColors || "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.RepeatLength || "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.ActualWidth || "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.ActualHeight || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="w-5 h-5 rounded-full bg-purple-100 inline-flex items-center justify-center text-[10px] font-bold text-purple-700">
                        {r.ColorNo}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800">{r.ColorName || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{r.InkType || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.PantoneRef || "—"}</td>
                    <td className="px-3 py-2 text-gray-600 font-mono text-[11px]">{r.WOCylinderNo || "—"}</td>
                    {/* Tracked cylinder (saved in artwork tracking) */}
                    <td className="px-3 py-2 font-mono text-[11px] font-bold text-indigo-700">
                      {r.SavedCylinderNo || "—"}
                    </td>
                    {/* ToolMaster cylinder details */}
                    <td className="px-3 py-2 font-mono text-[11px] font-semibold text-purple-700">{r.CylCode || "—"}</td>
                    <td className="px-3 py-2 text-gray-500 font-mono text-[11px]">{r.CylRefCode || "—"}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate" title={r.CylName}>{r.CylName || "—"}</td>
                    <td className="px-3 py-2">
                      {r.CylType ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">{r.CylType}</span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] text-gray-700 font-semibold">
                      {r.CylCircumMM ? `⌀ ${r.CylCircumMM}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] text-gray-700">
                      {r.CylPrintWidth || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] text-gray-600">
                      {r.CylSizeL || "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-[11px] font-bold text-gray-600">
                      {r.CylTotalColors || "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-[11px] text-gray-600">
                      {r.CylNoOfRepeats || "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-[11px] text-gray-500">
                      {r.CylShelfLife ? r.CylShelfLife.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-600 max-w-[120px] truncate" title={r.CylVendorName}>
                      {r.CylVendorName || "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-500">{r.CylLocation || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.CylinderVendor || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STAGE_COLOR[r.Stage] || "bg-gray-100 text-gray-500"}`}>
                        {r.Stage}
                      </span>
                    </td>
                    {[r.ArtworkReceivedDate, r.BrandApprovalSentDate, r.BrandApprovalDate,
                      r.LSDApprovalDate, r.CylinderOrderDate, r.CylinderExpectedDate,
                      r.CylinderReceivedDate, r.ReleasedDate].map((d, i) => (
                      <td key={i} className={`px-3 py-2 whitespace-nowrap ${d ? "text-gray-700 font-medium" : "text-gray-300"}`}>
                        {d || "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.WOStatus === "Completed"   ? "bg-green-100 text-green-700"
                        : r.WOStatus === "In Progress" ? "bg-amber-100 text-amber-700"
                        : r.WOStatus === "On Hold"     ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"}`}>{r.WOStatus}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.MachineName || "—"}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.PlannedDate || "—"}</td>
                    <td className="px-3 py-2 text-right sticky right-0 bg-white group-hover:bg-purple-50/40">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setSelected(r); setViewModal(true); }}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="View">
                          <Eye size={13}/>
                        </button>
                        <button onClick={() => openUpdate(r)}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors">
                          <ArrowRight size={11}/>
                          {r.ArtworkStatusID && r.ArtworkStatusID !== "0" ? "Update" : "Start"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stage legend / quick filter */}
          <div className="flex-shrink-0 flex flex-wrap gap-1.5 items-center mt-2 px-1">
            {STAGES.map((s, i) => (
              <React.Fragment key={s}>
                <button onClick={() => setFStage(f => f === s ? "" : s)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${STAGE_COLOR[s]}
                    ${fStage === s ? "ring-2 ring-offset-1 ring-purple-400" : "opacity-80 hover:opacity-100"}`}>
                  {s}
                </button>
                {i < STAGES.length - 1 && <ArrowRight size={9} className="text-gray-300 flex-shrink-0"/>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ══ UPDATE STATUS MODAL ══════════════════════════════════════════ */}
      {selected && (
        <Modal open={updateModal} onClose={() => setUpdateModal(false)}
          title={`${selected.WorkOrderNo} — Color ${selected.ColorNo}: ${selected.ColorName}`} size="xl">
          <div className="space-y-4">
            {/* Job info banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                ["Work Order",   selected.WorkOrderNo],
                ["Customer",     selected.CustomerName],
                ["Job Name",     selected.JobName],
                ["Color",        `#${selected.ColorNo} — ${selected.ColorName}${selected.PantoneRef ? ` (${selected.PantoneRef})` : ""}`],
                ["Brand",        selected.BrandName || "—"],
                ["Substrate",    selected.CatalogSubstrate || selected.Substrate || "—"],
                ["Cyl. (WO)",    selected.WOCylinderNo || selected.CylCode || "—"],
                ["Circum.",      selected.CylCircumMM ? `${selected.CylCircumMM} mm` : "—"],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wide mb-0.5">{l}</p>
                  <p className="font-bold text-blue-800">{v}</p>
                </div>
              ))}
            </div>

            {/* Stage selector */}
            <div>
              <SH label="Artwork Stage"/>
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map((s, i) => {
                  const cur   = stageIdx(form.Stage || "Artwork Pending");
                  const isCur = s === form.Stage, isPast = i < cur;
                  return (
                    <button key={s} onClick={() => sf("Stage", s)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all
                        ${isCur  ? "border-purple-400 bg-purple-100 text-purple-800 shadow scale-105"
                        : isPast ? "border-green-300 bg-green-50 text-green-700"
                        :          "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300"}`}>
                      {isPast && <Check size={9} className="inline mr-0.5"/>}{s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cylinder Details */}
            <div>
              <SH label="Cylinder Details"/>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Cylinder dropdown from ToolMaster */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Cylinder (Tool Master)
                  </label>
                  <select value={form.CylinderNo || ""}
                    onChange={e => sf("CylinderNo", e.target.value)}
                    className="w-full text-sm border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200">
                    <option value="">— Select Cylinder —</option>
                    {cylinders.map(c => (
                      <option key={c.ToolID} value={c.ToolCode}>
                        {c.ToolCode}{c.ToolName ? ` — ${c.ToolName}` : ""}
                        {c.CircumferenceMM ? ` (⌀${c.CircumferenceMM}mm)` : ""}
                      </option>
                    ))}
                  </select>
                  {form.CylinderNo && (
                    <p className="text-[10px] text-purple-600 font-bold mt-1">
                      ✓ {form.CylinderNo}
                    </p>
                  )}
                </div>
                {/* Vendor */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Cylinder Vendor</label>
                  <select value={form.CylinderVendor || ""} onChange={e => sf("CylinderVendor", e.target.value)}
                    className="w-full text-sm border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200">
                    <option value="">— Select Vendor —</option>
                    {vendorLedgers.map(v => <option key={v.LedgerID} value={v.LedgerName}>{v.LedgerName}</option>)}
                  </select>
                </div>
                {/* Expected date */}
                <Input label="Expected Receipt Date" type="date"
                  value={form.CylinderExpectedDate || ""}
                  onChange={e => sf("CylinderExpectedDate", e.target.value)}/>
              </div>
            </div>

            {/* Milestone Dates */}
            <div>
              <SH label="Milestone Dates"/>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Input label="Artwork Received"   type="date" value={form.ArtworkReceivedDate   || ""} onChange={e => sf("ArtworkReceivedDate",   e.target.value)}/>
                <Input label="Design Done"        type="date" value={form.DesignDoneDate         || ""} onChange={e => sf("DesignDoneDate",         e.target.value)}/>
                <Input label="Brand Appr. Sent"   type="date" value={form.BrandApprovalSentDate  || ""} onChange={e => sf("BrandApprovalSentDate",  e.target.value)}/>
                <Input label="Brand Approved"     type="date" value={form.BrandApprovalDate      || ""} onChange={e => sf("BrandApprovalDate",      e.target.value)}/>
                <Input label="LSD Shade Approved" type="date" value={form.LSDApprovalDate        || ""} onChange={e => sf("LSDApprovalDate",        e.target.value)}/>
                <Input label="Cylinder Ordered"   type="date" value={form.CylinderOrderDate      || ""} onChange={e => sf("CylinderOrderDate",      e.target.value)}/>
                <Input label="Cylinder Received"  type="date" value={form.CylinderReceivedDate   || ""} onChange={e => sf("CylinderReceivedDate",   e.target.value)}/>
                <Input label="Released to Prod."  type="date" value={form.ReleasedDate           || ""} onChange={e => sf("ReleasedDate",           e.target.value)}/>
              </div>
            </div>

            <Textarea label="Remarks" value={form.Remarks || ""} onChange={e => sf("Remarks", e.target.value)} rows={2}/>

            {/* ── Artwork Attachments ──────────────────────────────── */}
            <div>
              <SH label="Artwork Attachments"/>
              <div className="space-y-2">
                {/* Upload button */}
                <label className={`inline-flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold border transition
                  ${uploadingFile ? "bg-gray-50 border-gray-200 text-gray-400 cursor-wait"
                  : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"}`}>
                  <Paperclip size={13}/>
                  {uploadingFile ? "Uploading…" : "Attach File"}
                  <input ref={fileInputRef} type="file" className="hidden"
                    onChange={uploadFile} disabled={uploadingFile}
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.xlsx,.xls,.docx,.doc,.zip,.ai,.psd,.eps"/>
                </label>
                <p className="text-[10px] text-gray-400">
                  Supported: PDF, JPG, PNG, AI, PSD, EPS, Excel, Word, ZIP
                </p>
                {/* Attachment list */}
                {attachments.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mt-1">
                    {attachments.map(a => {
                      const ext = a.FileName.split(".").pop()?.toLowerCase() ?? "";
                      const isViewable = ["pdf","png","jpg","jpeg","gif","bmp","webp","svg"].includes(ext);
                      const isImage = ["png","jpg","jpeg","gif","bmp","webp","svg"].includes(ext);
                      return (
                        <div key={a.AttachmentID} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                          {isImage
                            ? <Eye size={13} className="text-purple-400 flex-shrink-0"/>
                            : <FileText size={13} className="text-gray-400 flex-shrink-0"/>}
                          <span className="text-xs text-gray-700 flex-1 truncate min-w-0" title={a.FileName}>
                            {a.FileName}
                          </span>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                            {a.UploadedDate.slice(0, 10)}
                          </span>
                          {isViewable && (
                            <button onClick={() => viewAttachment(a.AttachmentID, a.FileName, a.FilePath)}
                              className="flex items-center gap-1 text-[10px] text-purple-600 font-bold hover:underline flex-shrink-0 px-1">
                              <Eye size={11}/> View
                            </button>
                          )}
                          <button onClick={() => downloadAttachment(a.AttachmentID, a.FileName, a.FilePath)}
                            className="flex items-center gap-1 text-[10px] text-blue-600 font-bold hover:underline flex-shrink-0 px-1">
                            <Download size={11}/> Download
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">No attachments yet</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setUpdateModal(false)}>Cancel</Button>
              <Button onClick={saveStatus} loading={saving}>
                {selected.ArtworkStatusID && selected.ArtworkStatusID !== "0" ? "Update Status" : "Start Tracking"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ VIEW MODAL ════════════════════════════════════════════════ */}
      {selected && (
        <Modal open={viewModal} onClose={() => setViewModal(false)}
          title={`${selected.WorkOrderNo} — ${selected.ColorName}`} size="lg">
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {([
                ["Work Order",   selected.WorkOrderNo],
                ["Date",         selected.WODate],
                ["Order No",     selected.OrderNo],
                ["Customer",     selected.CustomerName],
                ["Job Name",     selected.JobName],
                ["Brand",        selected.BrandName],
                ["Product",      selected.ProductName],
                ["Artwork",      selected.ArtworkName],
                ["Pack Size",    selected.PackSize],
                ["Category",     selected.CategoryName],
                ["Substrate",    selected.CatalogSubstrate || selected.Substrate],
                ["Product Type", selected.ProductType],
                ["# Colors",     String(selected.NoOfColors)],
                ["Repeat (mm)",  String(selected.RepeatLength || "—")],
                ["Machine",      selected.MachineName],
                ["WO Status",    selected.WOStatus],
                ["Color #",      String(selected.ColorNo)],
                ["Color Name",   selected.ColorName],
                ["Ink Type",     selected.InkType],
                ["Pantone",      selected.PantoneRef],
                ["Cyl. (WO)",    selected.WOCylinderNo],
                ["Tracked Cyl.", selected.SavedCylinderNo],
                ["Tool Code",    selected.CylCode],
                ["Ref. Code",    selected.CylRefCode],
                ["Cyl. Name",    selected.CylName],
                ["Cyl. Type",    selected.CylType],
                ["Circum. (mm)", selected.CylCircumMM ? `⌀ ${selected.CylCircumMM}` : "—"],
                ["Print W (mm)", selected.CylPrintWidth ? String(selected.CylPrintWidth) : "—"],
                ["Size L (mm)",  selected.CylSizeL ? String(selected.CylSizeL) : "—"],
                ["Tot. Colors",  selected.CylTotalColors ? String(selected.CylTotalColors) : "—"],
                ["Repeats",      selected.CylNoOfRepeats ? String(selected.CylNoOfRepeats) : "—"],
                ["Life (m)",     selected.CylShelfLife ? selected.CylShelfLife.toLocaleString() : "—"],
                ["Maker/Vendor", selected.CylVendorName],
                ["Location",     selected.CylLocation],
                ["Order Vendor", selected.CylinderVendor],
              ] as [string,string][]).map(([l, v]) => (
                <div key={l} className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{l}</p>
                  <p className="text-sm font-semibold text-gray-800">{v || "—"}</p>
                </div>
              ))}
            </div>
            {/* Stage pipeline */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
              <p className="text-[10px] text-purple-500 font-bold uppercase tracking-widest mb-2">Artwork Progress</p>
              <div className="flex flex-wrap gap-1.5 items-center">
                {STAGES.map((s, i) => {
                  const isDone = i <= stageIdx(selected.Stage);
                  return (
                    <React.Fragment key={s}>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDone ? STAGE_COLOR[s] : "bg-gray-100 text-gray-300"}`}>
                        {isDone && <Check size={9} className="inline mr-0.5"/>}{s}
                      </span>
                      {i < STAGES.length - 1 && <ArrowRight size={9} className="text-gray-200"/>}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
            {/* Dates */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {([
                ["Art. Received",   selected.ArtworkReceivedDate],
                ["Brand Sent",      selected.BrandApprovalSentDate],
                ["Brand Approved",  selected.BrandApprovalDate],
                ["LSD Approved",    selected.LSDApprovalDate],
                ["Cyl. Ordered",    selected.CylinderOrderDate],
                ["Cyl. Expected",   selected.CylinderExpectedDate],
                ["Cyl. Received",   selected.CylinderReceivedDate],
                ["Released",        selected.ReleasedDate],
              ] as [string,string][]).map(([l, v]) => (
                <div key={l} className={`rounded-lg p-2 border ${v ? "border-green-200 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{l}</p>
                  <p className={`text-xs font-bold ${v ? "text-green-700" : "text-gray-300"}`}>{v || "—"}</p>
                </div>
              ))}
            </div>
            {selected.Remarks && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>Remarks:</strong> {selected.Remarks}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setViewModal(false)}>Close</Button>
              <Button onClick={() => { setViewModal(false); openUpdate(selected); }}>Update Status</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
