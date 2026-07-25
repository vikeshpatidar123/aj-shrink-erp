"use client";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Pencil, Trash2, X, Check, Loader2, Eye, EyeOff,
  FileText, Image as ImgIcon, Download, Paperclip, RefreshCw,
  Link2, ChevronDown, ChevronRight, ChevronLeft, Package, Filter, Library,
  PlayCircle,
} from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { useCategories } from "@/context/CategoriesContext";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { DataTable } from "@/components/tables/DataTable";

// ─── API ─────────────────────────────────────────────────────────────────────
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in").replace(/\/$/, "");
const ART = `${BASE}/api/artworkManagement`;

function unwrap(v: unknown): unknown {
  let r = v;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(), ...opts });
  return unwrap(await res.json()) as T;
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return unwrap(await res.json()) as T;
}

// ─── S3 upload ────────────────────────────────────────────────────────────────
async function uploadFile(file: File) {
  const { "Content-Type": _ct, ...hdrs } = authHeaders();
  const fd = new FormData();
  fd.append("file", file, file.name);

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/artworkManagement/upload`, { method: "POST", headers: hdrs, body: fd });
  } catch (e: any) {
    throw new Error(`[Network] ${e.message} — ${BASE}/api/s3/upload`);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`[HTTP ${res.status}] ${errText}`);
  }
  const { publicUrl } = await res.json();
  return { url: publicUrl as string, name: file.name, mimeType: file.type };
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ArtworkRow = {
  ArtworkID: string;
  ArtworkNo: string;
  ClientArtWorkNo: string;
  ProductName: string;
  ArtWorkDescription: string;
  ArtWorkCost: string;
  ProductCode: string;
  JobQty: string;
  JobSize: string;
  PaperDetails: string;
  MachineName: string;
  DesignSide: string;
  // Artwork master own fields (from ArtworkMasterMain columns)
  TypeOfProduct: string;
  Content: string;
  PackSize: string;
  BrandName: string;
  ProductType: string;
  SkuType: string;
  BottleType: string;
  AddressType: string;
  ArtworkName: string;
  SpecialSpecs: string;
  LedgerID: string;
  ClientName: string;
  MobileNo: string;
  SalesEmployeeID: string;
  SalesEmployee: string;
  CategoryID: string;
  CategoryName: string;
  ReceivedDate: string;
  ExpectedCompletionDate: string;
  DocumentNo: string;
  DocumentType: string;
  DocumentDate: string;
  ProductMasterID: string;
  // From product catalog (if linked) — only available from getById
  CatalogCode: string;
  CatalogPackSize: string;
  CatalogBrandName: string;
  CatalogProductType: string;
  CatalogSkuType: string;
  CatalogBottleType: string;
  CatalogAddressType: string;
  CatalogArtworkName: string;
  CatalogSpecialSpecs: string;
  StructureType: string;
  ActualWidth: string;
  ActualHeight: string;
  NoOfColors: string;
  PrintType: string;
  Substrate: string;
  CatalogMachine: string;
  RepeatLength: string;
  FinalRollOD: string;
};

type AttachmentItem = {
  _id: string;
  name: string;
  url: string;
  mimeType: string;
  remark: string;
  fileObj?: File;
  uploading?: boolean;
  uploadError?: boolean;
};

type DropdownData = {
  clients: { LedgerID: string; LedgerName: string }[];
  employees: { SalesEmployeeID: string; LedgerName: string }[];
  categories: { CategoryID: string; CategoryName: string }[];
};

type FmOptions = {
  typeOfProducts: string[];
  packSizes: string[];
  brandNames: string[];
  productTypes: string[];
  skuTypes: string[];
  bottleTypes: string[];
  addressTypes: string[];
};

type FormState = {
  ArtworkID: string;
  JobName: string;
  LedgerID: string;
  CategoryID: string;
  SalesEmployeeID: string;
  ClientArtWorkNo: string;
  ArtWorkDescription: string;
  ArtworkCost: string;
  ReceivedDate: string;
  ExpectedCompletionDate: string;
  DocumentType: string;
  DocumentNo: string;
  DocumentDate: string;
  JobQty: string;
  JobSize: string;
  PaperDetails: string;
  MachineName: string;
  DesignSide: string;
  TypeOfProduct: string;
  Content: string;
  PackSize: string;
  BrandName: string;
  ProductType: string;
  SkuType: string;
  BottleType: string;
  AddressType: string;
  ArtworkName: string;
  SpecialSpecs: string;
  AttachmentFilesName: string;
};

const blankForm = (): FormState => ({
  ArtworkID: "", JobName: "", LedgerID: "", CategoryID: "", SalesEmployeeID: "",
  ClientArtWorkNo: "", ArtWorkDescription: "", ArtworkCost: "",
  ReceivedDate: new Date().toISOString().slice(0, 10),
  ExpectedCompletionDate: "",
  DocumentType: "Direct", DocumentNo: "", DocumentDate: "",
  JobQty: "", JobSize: "", PaperDetails: "", MachineName: "", DesignSide: "Single Side",
  TypeOfProduct: "", Content: "", PackSize: "", BrandName: "", ProductType: "",
  SkuType: "", BottleType: "", AddressType: "", ArtworkName: "", SpecialSpecs: "",
  AttachmentFilesName: "",
});

// ─── Shared input style ───────────────────────────────────────────────────────
const lCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-3 pb-1 border-b border-indigo-100">{label}</p>
);

// ─── Attachment card ──────────────────────────────────────────────────────────
function AttCard({ att, onRemove, onPreview, onRemarkChange }: {
  att: AttachmentItem;
  onRemove: () => void;
  onPreview: () => void;
  onRemarkChange?: (val: string) => void;
}) {
  const isPdf = att.mimeType === "application/pdf" || att.url?.toLowerCase().endsWith(".pdf");
  const isImg = att.mimeType?.startsWith("image/");

  if (att.uploading) {
    return (
      <div className="relative rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
        <div className="h-24 flex flex-col items-center justify-center gap-2">
          <Loader2 size={22} className="animate-spin text-orange-400" />
          <span className="text-[10px] text-orange-500 font-medium">Uploading…</span>
        </div>
        <div className="px-2 py-1.5">
          <p className="text-[11px] text-gray-500 truncate" title={att.name}>{att.name}</p>
        </div>
      </div>
    );
  }

  if (att.uploadError) {
    return (
      <div className="relative rounded-xl border border-red-200 bg-red-50 overflow-hidden">
        <div className="h-24 flex flex-col items-center justify-center gap-1 px-2">
          <X size={22} className="text-red-400" />
          <span className="text-[10px] text-red-500 font-medium text-center leading-tight">Remove & re-upload</span>
        </div>
        <div className="px-2 py-1.5 flex items-center justify-between">
          <p className="text-[11px] text-gray-500 truncate" title={att.name}>{att.name}</p>
          <button onClick={onRemove} className="p-0.5 text-red-400 hover:text-red-600"><X size={11} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      <div className="h-24 flex items-center justify-center bg-gray-100 cursor-pointer" onClick={onPreview}>
        {isImg ? (
          <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
        ) : isPdf ? (
          <div className="flex flex-col items-center gap-1 text-red-500">
            <FileText size={28} />
            <span className="text-[10px] font-bold text-red-600">PDF</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <Paperclip size={24} />
            <span className="text-[10px]">{att.name.split(".").pop()?.toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="px-2 pt-1.5 pb-1">
        <p className="text-[11px] text-gray-700 truncate font-medium" title={att.name}>{att.name}</p>
        {onRemarkChange !== undefined && (
          <Input value={att.remark} onChange={e => onRemarkChange(e.target.value)} onClick={e => e.stopPropagation()} placeholder="File label…" className="mt-1 w-full" />
        )}
      </div>
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onPreview}
          className="p-1 rounded-md bg-white/90 text-indigo-600 hover:bg-indigo-50 shadow" title="Preview">
          <Eye size={11} />
        </button>
        <a href={att.url} download={att.name} target="_blank" rel="noreferrer"
          className="p-1 rounded-md bg-white/90 text-blue-600 hover:bg-blue-50 shadow" title="Download">
          <Download size={11} />
        </a>
        <button onClick={onRemove}
          className="p-1 rounded-md bg-white/90 text-red-500 hover:bg-red-50 shadow" title="Remove">
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function ArtworkManagementPage() {
  const [activeTab, setActiveTab] = useState<"master" | "management" | "library" | "bbartwork">("master");
  const [showVideoModal, setShowVideoModal] = useState(false);

  const { categories: catWithDetails } = useCategories();

  // ─── Data ─────────────────────────────────────────────────────────────────
  const [list, setList] = useState<ArtworkRow[]>([]);
  const [dropData, setDropData] = useState<DropdownData>({ clients: [], employees: [], categories: [] });
  const [loading, setLoading] = useState(false);

  // ─── Artwork Master - Form/Modal ──────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<FormState>(blankForm());
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [contentPickerOpen, setContentPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<AttachmentItem | null>(null);

  // ─── Artwork Management - detail panel ───────────────────────────────────
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, ArtworkRow>>({});
  const [attMap, setAttMap] = useState<Record<string, AttachmentItem[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [masterAttOpen, setMasterAttOpen] = useState<string | null>(null);
  const [masterAttLoading, setMasterAttLoading] = useState<string | null>(null);

  // ─── FieldMaster dropdown options ────────────────────────────────────────
  const [fmOptions, setFmOptions] = useState<{
    typeOfProducts: string[]; packSizes: string[]; brandNames: string[];
    productTypes: string[]; skuTypes: string[]; bottleTypes: string[]; addressTypes: string[];
  }>({ typeOfProducts: [], packSizes: [], brandNames: [], productTypes: [], skuTypes: [], bottleTypes: [], addressTypes: [] });


  // ─── Artwork Library tab ──────────────────────────────────────────────────
  type LibRow = {
    ArtworkID: string; WoNo: string; CreatedDate: string; OrderNo: string;
    Customer: string; JobName: string; Brand: string; PackSize: string;
    TypeOfProduct: string; ArtworkNo: string; CategoryName: string;
    ProductCode: string; Substrate: string; StructureType: string;
    NoOfColors: string; RepeatMM: string; WidthMM: string; HeightMM: string;
    Machine: string; ColorName: string;
    CylType: string; CircumMM: string; CylLength: string; CylPrintWidth: string;
    CylVendor: string; CylStatus: string; ArtworkStage: string;
    AttachmentFilesName: string;
  };

  const ARTWORK_STAGES = [
    "Artwork Pending", "Artwork Received", "Under Process",
    "Pending Mail to MB", "Brand Approved", "LSD Shade Approved",
    "Engraving", "Cylinder Received", "Released to Production", "On Hold",
  ];

  const [libRows, setLibRows] = useState<LibRow[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libLoaded, setLibLoaded] = useState(false);
  const [libShowFilter, setLibShowFilter] = useState(true);
  const [libSearch, setLibSearch] = useState("");
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const [libUpdating, setLibUpdating] = useState<string | null>(null);
  const [openStageRow, setOpenStageRow] = useState<string | null>(null);
  const [libFilters, setLibFilters] = useState({
    customer: "", jobName: "", brand: "", packSize: "", category: "",
    substrate: "", designType: "", noOfColors: "", colorName: "",
    machine: "", cylType: "", cylStatus: "", cylVendor: "",
    artworkStage: "", brandApproved: "", lsdApproved: "", cylReceived: "",
    circum: "", cylLength: "", coilWidth: "", repeatLength: "",
  });
  const [libSort, setLibSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const [colFilterOpen, setColFilterOpen] = useState<string | null>(null);

  // ─── BB Artwork ───────────────────────────────────────────────────────────
  type BBArtworkRow = {
    BBArtworkID: string; BBArtworkNo: string; ArtworkID: string;
    ArtworkNo: string; ParentJobName: string; ClientName: string; CategoryName: string;
    BBArtworkName: string;
    LedgerID: string; JobName: string; ClientArtWorkNo: string; ArtWorkDescription: string;
    DocumentType: string; DocumentNo: string; DocumentDate: string;
    SalesEmployeeID: string; ArtworkCost: string;
    ReceivedDate: string; ExpectedCompletionDate: string;
    CategoryID: string; JobQty: string; JobSize: string; PaperDetails: string;
    MachineName: string; DesignSide: string; TypeOfProduct: string;
    Content: string; PackSize: string; BrandName: string; ProductType: string;
    SkuType: string; BottleType: string; AddressType: string;
    ArtworkName: string; SpecialSpecs: string; ArtworkStage: string; Remarks: string;
    AttachmentFilesName: string; CreatedDate: string;
  };
  type BBArtworkForm = {
    BBArtworkID: string; ArtworkID: string; BBArtworkName: string;
    LedgerID: string; JobName: string; ClientArtWorkNo: string; ArtWorkDescription: string;
    DocumentType: string; DocumentNo: string; DocumentDate: string;
    SalesEmployeeID: string; ArtworkCost: string;
    ReceivedDate: string; ExpectedCompletionDate: string;
    CategoryID: string; JobQty: string; JobSize: string; PaperDetails: string;
    MachineName: string; DesignSide: string; TypeOfProduct: string;
    Content: string; PackSize: string; BrandName: string; ProductType: string;
    SkuType: string; BottleType: string; AddressType: string;
    ArtworkName: string; SpecialSpecs: string; ArtworkStage: string; Remarks: string;
    AttachmentFilesName: string;
  };
  const blankSGForm = (): BBArtworkForm => ({
    BBArtworkID: "", ArtworkID: "", BBArtworkName: "",
    LedgerID: "", JobName: "", ClientArtWorkNo: "", ArtWorkDescription: "",
    DocumentType: "Direct", DocumentNo: "", DocumentDate: "",
    SalesEmployeeID: "", ArtworkCost: "",
    ReceivedDate: new Date().toISOString().slice(0, 10), ExpectedCompletionDate: "",
    CategoryID: "", JobQty: "", JobSize: "", PaperDetails: "",
    MachineName: "", DesignSide: "Single Side", TypeOfProduct: "",
    Content: "", PackSize: "", BrandName: "", ProductType: "",
    SkuType: "", BottleType: "", AddressType: "",
    ArtworkName: "", SpecialSpecs: "", ArtworkStage: "", Remarks: "",
    AttachmentFilesName: "",
  });

  const [sgList,        setSgList]        = useState<BBArtworkRow[]>([]);
  const [sgLoading,     setSgLoading]     = useState(false);
  const [sgLoaded,      setSgLoaded]      = useState(false);
  const [showSgModal,   setShowSgModal]   = useState(false);
  const [sgEditMode,    setSgEditMode]    = useState(false);
  const [sgSaving,      setSgSaving]      = useState(false);
  const [sgError,       setSgError]       = useState("");
  const [sgForm,        setSgForm]        = useState<BBArtworkForm>(blankSGForm());
  const [sgSearch,      setSgSearch]      = useState("");
  const [sgAttachments, setSgAttachments] = useState<AttachmentItem[]>([]);
  const sgFileRef = useRef<HTMLInputElement>(null);

  const loadSubGroups = async () => {
    setSgLoading(true);
    try {
      const raw = await apiFetch<BBArtworkRow[]>(`${ART}/bbartwork/list`);
      setSgList(Array.isArray(raw) ? raw : []);
      setSgLoaded(true);
    } catch { setSgList([]); } finally { setSgLoading(false); }
  };

  const openAddSG = () => {
    setSgForm(blankSGForm()); setSgEditMode(false); setSgError("");
    setSgAttachments([]); setShowSgModal(true);
  };
  const openEditSG = async (r: BBArtworkRow) => {
    setSgForm({
      BBArtworkID: String(r.BBArtworkID), ArtworkID: String(r.ArtworkID), BBArtworkName: r.BBArtworkName,
      LedgerID: r.LedgerID || "", JobName: r.JobName || "",
      ClientArtWorkNo: r.ClientArtWorkNo || "", ArtWorkDescription: r.ArtWorkDescription || "",
      DocumentType: r.DocumentType || "Direct", DocumentNo: r.DocumentNo || "",
      DocumentDate: r.DocumentDate || "", SalesEmployeeID: r.SalesEmployeeID || "",
      ArtworkCost: r.ArtworkCost || "", ReceivedDate: r.ReceivedDate || "",
      ExpectedCompletionDate: r.ExpectedCompletionDate || "",
      CategoryID: r.CategoryID || "", JobQty: r.JobQty || "", JobSize: r.JobSize || "",
      PaperDetails: r.PaperDetails || "", MachineName: r.MachineName || "",
      DesignSide: r.DesignSide || "Single Side", TypeOfProduct: r.TypeOfProduct || "",
      Content: r.Content || "", PackSize: r.PackSize || "", BrandName: r.BrandName || "",
      ProductType: r.ProductType || "", SkuType: r.SkuType || "", BottleType: r.BottleType || "",
      AddressType: r.AddressType || "", ArtworkName: r.ArtworkName || "",
      SpecialSpecs: r.SpecialSpecs || "", ArtworkStage: r.ArtworkStage || "",
      Remarks: r.Remarks || "",
      AttachmentFilesName: (r as any).AttachmentFilesName || "",
    });
    setSgEditMode(true); setSgError(""); setShowSgModal(true);
    // Load existing attachments
    try {
      const atts = await apiFetch<{ FileID: string; AttachedFileName: string; AttachedFileRemark: string }[]>(
        `${ART}/bbartwork/attachments/${r.BBArtworkID}`
      );
      setSgAttachments((Array.isArray(atts) ? atts : []).map(a => {
        const isBroken = a.AttachedFileName.startsWith("blob:");
        const name = a.AttachedFileName.startsWith("http")
          ? decodeURIComponent(a.AttachedFileName.split("/").pop()?.replace(/^\d+-/, "") ?? a.AttachedFileName)
          : isBroken ? "(broken — re-upload)" : a.AttachedFileName;
        return {
          _id: a.FileID, name, url: a.AttachedFileName,
          mimeType: a.AttachedFileName.toLowerCase().endsWith(".pdf") ? "application/pdf"
            : /\.(jpe?g|png|gif|webp|jpeg)$/i.test(a.AttachedFileName) ? "image/jpeg" : "application/octet-stream",
          remark: a.AttachedFileRemark,
          uploadError: isBroken,
        };
      }));
    } catch { setSgAttachments([]); }
  };

  // Auto-fill SubGroup form from parent artwork
  const autoFillSGFromArtwork = async (artworkId: string) => {
    const parent = list.find(a => String(a.ArtworkID) === String(artworkId));
    if (!parent) return;
    setSgForm(f => ({
      ...f,
      ArtworkID: artworkId,
      LedgerID: parent.LedgerID || "",
      JobName: parent.ProductName || "",
      ClientArtWorkNo: parent.ClientArtWorkNo || "",
      ArtWorkDescription: parent.ArtWorkDescription || "",
      DocumentType: parent.DocumentType || "Direct",
      DocumentNo: parent.DocumentNo || "",
      DocumentDate: parent.DocumentDate ? parent.DocumentDate.slice(0, 10) : "",
      SalesEmployeeID: parent.SalesEmployeeID || "",
      ArtworkCost: parent.ArtWorkCost || "",
      ReceivedDate: parent.ReceivedDate ? parent.ReceivedDate.slice(0, 10) : "",
      ExpectedCompletionDate: parent.ExpectedCompletionDate ? parent.ExpectedCompletionDate.slice(0, 10) : "",
      CategoryID: parent.CategoryID || "",
      JobQty: parent.JobQty || "",
      JobSize: parent.JobSize || "",
      PaperDetails: parent.PaperDetails || "",
      MachineName: parent.MachineName || "",
      DesignSide: parent.DesignSide || "Single Side",
      TypeOfProduct: parent.TypeOfProduct || "",
      Content: parent.Content || "",
      PackSize: parent.PackSize || "",
      BrandName: parent.BrandName || "",
      ProductType: parent.ProductType || "",
      SkuType: parent.SkuType || "",
      BottleType: parent.BottleType || "",
      AddressType: parent.AddressType || "",
      ArtworkName: parent.ArtworkName || "",
      SpecialSpecs: parent.SpecialSpecs || "",
      AttachmentFilesName: (parent as any).AttachmentFilesName || "",
    }));
    // Load master artwork attachments into child form
    try {
      const atts = await apiFetch<{ FileID: string; AttachedFileName: string; AttachedFileRemark: string }[]>(
        `${ART}/attachments/${artworkId}`
      );
      setSgAttachments((Array.isArray(atts) ? atts : []).map(a => {
        const isBroken = a.AttachedFileName.startsWith("blob:");
        const name = a.AttachedFileName.startsWith("http")
          ? decodeURIComponent(a.AttachedFileName.split("/").pop()?.replace(/^\d+-/, "") ?? a.AttachedFileName)
          : isBroken ? "(broken — re-upload)" : a.AttachedFileName;
        return {
          _id: a.FileID,
          name,
          url: a.AttachedFileName,
          mimeType: a.AttachedFileName.toLowerCase().endsWith(".pdf") ? "application/pdf"
            : /\.(jpe?g|png|gif|webp|jpeg)$/i.test(a.AttachedFileName) ? "image/jpeg" : "application/octet-stream",
          remark: a.AttachedFileRemark,
          uploadError: isBroken,
        };
      }));
    } catch { setSgAttachments([]); }
  };
  const saveSG = async () => {
    if (!sgForm.ArtworkID) { setSgError("Master Artwork is required."); return; }
    if (!sgForm.BBArtworkName.trim()) { setSgError("Child Artwork Name is required."); return; }
    setSgSaving(true); setSgError("");
    try {
      // Upload new files to S3, skip broken blobs
      const resolvedAtts = (await Promise.all(
        sgAttachments.map(async (a) => {
          if (a.fileObj) {
            try {
              const { "Content-Type": _ct, ...hdrs } = authHeaders();
              const fd = new FormData();
              fd.append("file", a.fileObj, a.fileObj.name);
              const res = await fetch(`${BASE}/api/artworkManagement/upload`, { method: "POST", headers: hdrs, body: fd });
              if (res.ok) {
                const { publicUrl } = await res.json();
                URL.revokeObjectURL(a.url);
                return { AttachedFileName: publicUrl as string, AttachedFileRemark: a.remark };
              }
            } catch { /* skip */ }
            return null;
          }
          if (a.url.startsWith("blob:")) return null;
          return { AttachedFileName: a.url, AttachedFileRemark: a.remark };
        })
      )).filter((a): a is { AttachedFileName: string; AttachedFileRemark: string } => a !== null);

      const res = await apiPost<{ Status: string } | string>(
        `${ART}/bbartwork/${sgEditMode ? "update" : "save"}`,
        { ...sgForm, Attachments: resolvedAtts }
      );
      const status = typeof res === "object" && res !== null ? (res as { Status: string }).Status : String(res);
      if (status === "success") { setShowSgModal(false); loadSubGroups(); }
      else setSgError(String(res));
    } catch (e) { setSgError(String(e)); } finally { setSgSaving(false); }
  };
  const deleteSG = async (r: BBArtworkRow) => {
    if (!confirm(`Delete Child Artwork "${r.BBArtworkNo} — ${r.BBArtworkName}"?`)) return;
    try {
      await apiPost(`${ART}/bbartwork/delete`, { BBArtworkID: r.BBArtworkID });
      loadSubGroups();
    } catch (e) { alert(String(e)); }
  };
  const rfSG = (k: keyof BBArtworkForm, v: string) => setSgForm(f => ({ ...f, [k]: v }));

  // ─── Search ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");

  // Close dropdowns on outside click
  useEffect(() => {
    if (!openStageRow && !colFilterOpen && !masterAttOpen) return;
    const handler = () => { setOpenStageRow(null); setColFilterOpen(null); setMasterAttOpen(null); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openStageRow, colFilterOpen, masterAttOpen]);

  // ─── Load list + dropdowns ────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, dd] = await Promise.all([
        apiFetch<ArtworkRow[]>(`${ART}/list`),
        apiFetch<Record<string, string>>(`${ART}/dropdowns`).then(r => {
          const parsed: Record<string, unknown> = {};
          for (const k in r) { try { parsed[k] = JSON.parse(r[k] as string); } catch { parsed[k] = r[k]; } }
          return parsed as unknown as DropdownData;
        }),
      ]);
      setList(Array.isArray(rows) ? rows : []);
      setDropData(dd);
    } catch { setList([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // ─── Load FieldMaster options once ───────────────────────────────────────
  useEffect(() => {
    const FM = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in").replace(/\/$/, "");
    const load = async (fieldName: string): Promise<string[]> => {
      try {
        const raw = await apiFetch<{ FieldValue: string }[]>(
          `${FM}/api/FieldMasterAJ/GetFieldValues?fieldName=${encodeURIComponent(fieldName)}`
        );
        return Array.isArray(raw) ? raw.map(r => r.FieldValue).filter(Boolean) : [];
      } catch { return []; }
    };
    Promise.all([
      load("Type of Product"),
      load("Standard Pack Sizes"),
      load("Brand Names"),
      load("Product Types"),
      load("SKU Types"),
      load("Bottle Type"),
      load("Product Address Type"),
    ]).then(([typeOfProducts, packSizes, brandNames, productTypes, skuTypes, bottleTypes, addressTypes]) => {
      setFmOptions({ typeOfProducts, packSizes, brandNames, productTypes, skuTypes, bottleTypes, addressTypes });
    });
  }, []);

  // ─── Load Artwork Library (lazy) ─────────────────────────────────────────
  const loadLibrary = async () => {
    setLibLoading(true);
    try {
      const raw = await apiFetch<LibRow[]>(`${ART}/artlibrary`);
      setLibRows(Array.isArray(raw) ? raw : []);
      setLibLoaded(true);
    } catch { setLibRows([]); } finally { setLibLoading(false); }
  };

  // ─── Update artwork stage ─────────────────────────────────────────────────
  const updateStage = async (artworkId: string, stage: string) => {
    setLibUpdating(artworkId);
    try {
      await apiPost(`${ART}/updatestage`, { ArtworkID: artworkId, ArtworkStage: stage });
      setLibRows(rows => rows.map(r => r.ArtworkID === artworkId ? { ...r, ArtworkStage: stage } : r));
    } catch { /* silent */ } finally { setLibUpdating(null); }
  };

  // ─── Open Add modal ───────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(blankForm());
    setAttachments([]);
    setFormError("");
    setEditMode(false);
    setShowModal(true);
  };

  // ─── Open Edit modal ──────────────────────────────────────────────────────
  const openEdit = async (row: ArtworkRow) => {
    setFormError("");
    setEditMode(true);
    setForm({
      ArtworkID: row.ArtworkID ?? "",
      JobName: row.ProductName ?? "",
      LedgerID: row.LedgerID ?? "",
      CategoryID: row.CategoryID ?? "",
      SalesEmployeeID: row.SalesEmployeeID ?? "",
      ClientArtWorkNo: row.ClientArtWorkNo ?? "",
      ArtWorkDescription: row.ArtWorkDescription ?? "",
      ArtworkCost: row.ArtWorkCost ?? "",
      ReceivedDate: row.ReceivedDate ?? "",
      ExpectedCompletionDate: row.ExpectedCompletionDate ?? "",
      DocumentType: row.DocumentType || "Direct",
      DocumentNo: row.DocumentNo ?? "",
      DocumentDate: row.DocumentDate ?? "",
      JobQty: row.JobQty ?? "",
      JobSize: row.JobSize ?? "",
      PaperDetails: row.PaperDetails ?? "",
      MachineName: row.MachineName ?? "",
      DesignSide: row.DesignSide || "Single Side",
      TypeOfProduct: row.TypeOfProduct || dropData.categories.find(c => c.CategoryID === (row.CategoryID ?? ""))?.CategoryName || "",
      Content: row.Content ?? "",
      PackSize: row.PackSize ?? "",
      BrandName: row.BrandName ?? "",
      ProductType: row.ProductType ?? "",
      SkuType: row.SkuType ?? "",
      BottleType: row.BottleType ?? "",
      AddressType: row.AddressType ?? "",
      ArtworkName: row.ArtworkName ?? "",
      SpecialSpecs: row.SpecialSpecs ?? "",
      AttachmentFilesName: (row as any).AttachmentFilesName ?? "",
    });

    // Load attachments for this artwork
    try {
      const atts = await apiFetch<{ FileID: string; AttachedFileName: string; AttachedFileRemark: string }[]>(
        `${ART}/attachments/${row.ArtworkID}`
      );
      setAttachments((Array.isArray(atts) ? atts : []).map(a => {
        const isBroken = a.AttachedFileName.startsWith("blob:");
        const name = a.AttachedFileName.startsWith("http")
          ? decodeURIComponent(a.AttachedFileName.split("/").pop()?.replace(/^\d+-/, "") ?? a.AttachedFileName)
          : isBroken ? "(broken — re-upload)" : a.AttachedFileName;
        return {
          _id: a.FileID,
          name,
          url: a.AttachedFileName,
          mimeType: a.AttachedFileName.toLowerCase().endsWith(".pdf") ? "application/pdf"
            : /\.(jpe?g|png|gif|webp|jpeg)$/i.test(a.AttachedFileName) ? "image/jpeg" : "application/octet-stream",
          remark: a.AttachedFileRemark,
          uploadError: isBroken,
        };
      }));
    } catch { setAttachments([]); }
    setShowModal(true);
  };

  // ─── Upload files ─────────────────────────────────────────────────────────
  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Store locally only — S3 upload happens on Save
    const newItems: AttachmentItem[] = Array.from(files).map(file => ({
      _id: Math.random().toString(36).slice(2),
      name: file.name,
      url: URL.createObjectURL(file),
      mimeType: file.type,
      remark: "",
      fileObj: file,
    }));
    setAttachments(p => [...p, ...newItems]);
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.JobName.trim()) { setFormError("Product Name is required."); return; }
    if (!form.CategoryID) { setFormError("Category is required."); return; }

    setSaving(true); setFormError("");
    try {
      // Upload only new files (fileObj present) to S3; existing server URLs stay as-is
      // Blob URLs without fileObj (broken records) are skipped entirely
      const resolvedAtts = (await Promise.all(
        attachments.map(async (a) => {
          if (a.fileObj) {
            try {
              const { "Content-Type": _ct, ...hdrs } = authHeaders();
              const fd = new FormData();
              fd.append("file", a.fileObj, a.fileObj.name);
              const res = await fetch(`${BASE}/api/artworkManagement/upload`, { method: "POST", headers: hdrs, body: fd });
              if (res.ok) {
                const { publicUrl } = await res.json();
                URL.revokeObjectURL(a.url);
                return { AttachedFileName: publicUrl as string, AttachedFileRemark: a.remark };
              }
            } catch { /* skip on error */ }
            return null;
          }
          // Skip broken blob URLs that have no fileObj (invalid local URLs)
          if (a.url.startsWith("blob:")) return null;
          return { AttachedFileName: a.url, AttachedFileRemark: a.remark };
        })
      )).filter((a): a is { AttachedFileName: string; AttachedFileRemark: string } => a !== null);

      const payload = { ...form, Attachments: resolvedAtts };

      const res = await apiPost<{ Status: string; ArtworkID: string; ArtworkNo: string } | string>(
        `${ART}/${editMode ? "update" : "save"}`, payload
      );
      const result = typeof res === "object" && res !== null ? (res as { Status: string }).Status : String(res);
      if (result === "success") { setShowModal(false); loadList(); }
      else setFormError(String(res));
    } catch (e) { setFormError(String(e)); } finally { setSaving(false); }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const deleteArtwork = async (row: ArtworkRow) => {
    if (!confirm(`Delete artwork "${row.ArtworkNo} — ${row.ProductName}"?`)) return;
    try {
      const res = await apiPost<string>(`${ART}/delete`, { ArtworkID: row.ArtworkID });
      if (String(res).startsWith("Error:")) alert(res);
      else loadList();
    } catch (e) { alert(String(e)); }
  };

  // ─── Expand row in Management tab ────────────────────────────────────────
  const toggleExpand = async (row: ArtworkRow) => {
    if (expanded === row.ArtworkID) { setExpanded(null); return; }
    setExpanded(row.ArtworkID);

    if (!detailMap[row.ArtworkID]) {
      setLoadingDetail(row.ArtworkID);
      try {
        const [detail, atts] = await Promise.all([
          apiFetch<ArtworkRow[]>(`${ART}/getById/${row.ArtworkID}`),
          apiFetch<{ FileID: string; AttachedFileName: string; AttachedFileRemark: string }[]>(
            `${ART}/attachments/${row.ArtworkID}`
          ),
        ]);
        if (Array.isArray(detail) && detail.length > 0)
          setDetailMap(m => ({ ...m, [row.ArtworkID]: detail[0] }));
        const mappedAtts = (Array.isArray(atts) ? atts : []).map(a => ({
          _id: a.FileID,
          name: a.AttachedFileName,
          url: a.AttachedFileName,
          mimeType: a.AttachedFileName.toLowerCase().endsWith(".pdf") ? "application/pdf"
            : /\.(jpe?g|png|gif|webp)$/i.test(a.AttachedFileName) ? "image/jpeg" : "application/octet-stream",
          remark: a.AttachedFileRemark,
        }));
        setAttMap(m => ({ ...m, [row.ArtworkID]: mappedAtts }));
      } catch { } finally { setLoadingDetail(null); }
    }
  };

  const rf = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  // ─── Eye icon handler (Master tab) ───────────────────────────────────────
  const openAttView = async (e: React.MouseEvent, row: ArtworkRow) => {
    e.stopPropagation();
    const id = row.ArtworkID;
    if (masterAttOpen === id) { setMasterAttOpen(null); return; }
    if (attMap[id] !== undefined) {
      const cached = attMap[id];
      if (cached.length === 1) { window.open(cached[0].url, "_blank"); }
      else { setMasterAttOpen(id); }
      return;
    }
    setMasterAttLoading(id);
    try {
      const atts = await apiFetch<{ FileID: string; AttachedFileName: string; AttachedFileRemark: string }[]>(
        `${ART}/attachments/${id}`
      );
      const mapped = (Array.isArray(atts) ? atts : []).map(a => ({
        _id: a.FileID,
        name: decodeURIComponent(a.AttachedFileName.split("/").pop()?.replace(/^\d+-/, "") ?? a.AttachedFileName),
        url: a.AttachedFileName,
        mimeType: a.AttachedFileName.toLowerCase().endsWith(".pdf") ? "application/pdf"
          : /\.(jpe?g|png|gif|webp|jpeg)$/i.test(a.AttachedFileName) ? "image/jpeg" : "application/octet-stream",
        remark: a.AttachedFileRemark,
      }));
      setAttMap(m => ({ ...m, [id]: mapped }));
      if (mapped.length === 0) { /* no attachments */ }
      else if (mapped.length === 1) { window.open(mapped[0].url, "_blank"); }
      else { setMasterAttOpen(id); }
    } catch { /* silent */ } finally { setMasterAttLoading(null); }
  };

  // ─── Filter ───────────────────────────────────────────────────────────────
  const filtered = list.filter(r => {
    const q = search.toLowerCase();
    return !q || r.ArtworkNo?.toLowerCase().includes(q) || r.ProductName?.toLowerCase().includes(q)
      || r.ClientName?.toLowerCase().includes(q) || r.CategoryName?.toLowerCase().includes(q);
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Artwork Management</h2>
          <p className="text-sm text-gray-500">
            {activeTab === "library"
              ? `${libRows.length} record${libRows.length !== 1 ? "s" : ""}`
              : `${filtered.length} artwork${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowVideoModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors">
            <PlayCircle size={15} />
            Tutorial
          </button>
          <button onClick={activeTab === "library" ? loadLibrary : loadList}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
            <RefreshCw size={15} className={
              (libLoading && activeTab === "library") ? "animate-spin" : ""
            } />
          </button>
          {activeTab === "master" && (
            <Button variant="secondary" pill icon={<Plus size={16} />} onClick={openAdd}>New Artwork</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ["master",     "Artwork Master"],
          ["bbartwork",  "Child Artwork"],
          ["management", "Artwork Management"],
          ["library",    "Artwork Library"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => {
            setActiveTab(key as typeof activeTab);
            if (key === "library"   && !libLoaded) loadLibrary();
            if (key === "bbartwork" && !sgLoaded)  loadSubGroups();
          }}
            className={`px-5 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === key ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>


      {/* ═══ TAB: Artwork Master ═══════════════════════════════════════════ */}
      {activeTab === "master" && (
        <DataTable<ArtworkRow>
          data={filtered}
          loading={loading}
          rowHeight={44}
          columns={[
            {
              key: "ArtworkNo",
              header: "Artwork No.",
              wrap: true,
              render: r => <span className="font-semibold text-indigo-700">{r.ArtworkNo}</span>,
            },
            {
              key: "ClientArtWorkNo",
              header: "File Name",
              wrap: true,
              size: 280,
              render: r => (
                <span className="text-gray-500 text-[11px] leading-snug break-all">
                  {(r as any).AttachmentFilesName || r.ClientArtWorkNo || "—"}
                </span>
              ),
            },
            {
              key: "ArtworkName",
              header: "Artwork Name",
              wrap: true,
              size: 280,
              render: r => (
                <span className="font-medium text-gray-800 leading-snug break-words">
                  {r.ArtworkName || r.ProductName || "—"}
                </span>
              ),
            },
            {
              key: "Content",
              header: "Sub Type (Content)",
              render: r => r.Content ? (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-full">{r.Content}</span>
              ) : <span className="text-gray-400">—</span>,
            },
            {
              key: "ProductMasterID",
              header: "Catalog",
              render: r => (r.ProductMasterID && String(r.ProductMasterID) !== "0") ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Linked</span>
              ) : (
                <span className="text-xs text-gray-400">Not linked</span>
              ),
            },
          ]}
          actions={row => (
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={e => { e.stopPropagation(); openAttView(e as any, row); }}
                className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-500 hover:text-indigo-700 transition-colors"
                title="View attachments"
              >
                {masterAttLoading === row.ArtworkID
                  ? <Loader2 size={15} className="animate-spin" />
                  : <Eye size={15} />}
              </button>
              <RowAction.Edit onClick={() => openEdit(row)} />
              <RowAction.Delete onClick={() => deleteArtwork(row)} />
            </div>
          )}
        />
      )}

      {/* ═══ TAB: Artwork Management ════════════════════════════════════════ */}
      {activeTab === "management" && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 text-center py-16 text-gray-400">No artworks found.</div>
          ) : filtered.map(row => {
            const isOpen = expanded === row.ArtworkID;
            const detail = detailMap[row.ArtworkID];
            const atts = attMap[row.ArtworkID] ?? [];
            const hasPC = detail && String(detail.ProductMasterID || 0) !== "0";

            return (
              <div key={row.ArtworkID} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Row header */}
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpand(row)}>
                  <div className="flex-shrink-0">
                    {isOpen ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                  </div>
                  <div className="flex-1 grid grid-cols-5 gap-4 min-w-0">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Artwork No.</p>
                      <p className="font-bold text-indigo-700 text-sm">{row.ArtworkNo}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Artwork Name</p>
                      <p className="font-semibold text-gray-800 text-sm truncate">{row.ArtworkName || row.ProductName}</p>
                    </div>
                    <div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Sub Type</p>
                      {row.Content ? (
                        <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">{row.Content}</span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Catalog Link</p>
                      {String(row.ProductMasterID || 0) !== "0" ? (
                        <span className="flex items-center gap-1 text-xs text-green-700 font-semibold">
                          <Link2 size={11} /> Product Catalog Linked
                        </span>
                      ) : <span className="text-xs text-gray-400">No catalog linked</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <RowAction.Edit onClick={() => openEdit(row)} />
                    <RowAction.Delete onClick={() => deleteArtwork(row)} />
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    {loadingDetail === row.ArtworkID ? (
                      <div className="flex items-center gap-2 py-4 text-gray-400">
                        <Loader2 size={16} className="animate-spin" /> Loading details…
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-5">

                        {/* ── Artwork Details ── */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-1">
                          <SH label="Artwork Details" />
                          <dl className="space-y-2 text-sm">
                            {[
                              ["Artwork No.", detail?.ArtworkNo || row.ArtworkNo],
                              ["Client Artwork No.", detail?.ClientArtWorkNo || "—"],
                              ["Description", detail?.ArtWorkDescription || "—"],
                              ["Cost", detail?.ArtWorkCost ? `₹ ${detail.ArtWorkCost}` : "—"],
                              ["Received Date", detail?.ReceivedDate || "—"],
                              ["Expected Date", detail?.ExpectedCompletionDate || "—"],
                              ["Document Type", detail?.DocumentType || "—"],
                              ["Document No.", detail?.DocumentNo || "—"],
                              ["Job Qty", detail?.JobQty || "—"],
                              ["Job Size", detail?.JobSize || "—"],
                              ["Paper Details", detail?.PaperDetails || "—"],
                              ["Machine", detail?.MachineName || "—"],
                              ["Design Side", detail?.DesignSide || "—"],
                              ["Type of Product", detail?.TypeOfProduct || "—"],
                              ["Sub Type (Content)", detail?.Content || "—"],
                              ["Pack Size", detail?.PackSize || "—"],
                              ["Brand Name", detail?.BrandName || "—"],
                              ["Product Type", detail?.ProductType || "—"],
                              ["SKU Type", detail?.SkuType || "—"],
                              ["Bottle Type", detail?.BottleType || "—"],
                              ["Address Type", detail?.AddressType || "—"],
                              ["Artwork Name", detail?.ArtworkName || "—"],
                              ["Special Specs", detail?.SpecialSpecs || "—"],
                            ].map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-3">
                                <dt className="text-gray-500 text-xs flex-shrink-0">{k}</dt>
                                <dd className="text-gray-800 text-xs font-medium text-right">{v}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>

                        {/* ── Product Catalog / Cylinder Details ── */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-1">
                          <SH label="Product Catalog Details" />
                          {hasPC ? (
                            <dl className="space-y-2 text-sm">
                              {[
                                ["Catalog Code", detail!.CatalogCode],
                                ["Structure Type", detail!.StructureType],
                                ["Pack Size", detail!.CatalogPackSize],
                                ["Brand Name", detail!.CatalogBrandName],
                                ["Product Type", detail!.CatalogProductType],
                                ["SKU Type", detail!.CatalogSkuType],
                                ["Bottle Type", detail!.CatalogBottleType],
                                ["Address Type", detail!.CatalogAddressType],
                                ["Print Type", detail!.PrintType],
                                ["Substrate", detail!.Substrate],
                                ["Machine", detail!.CatalogMachine],
                                ["Actual Width (mm)", detail!.ActualWidth],
                                ["Actual Height (mm)", detail!.ActualHeight],
                                ["No. of Colors", detail!.NoOfColors],
                                ["Repeat Length (mm)", detail!.RepeatLength],
                                ["Final Roll OD (mm)", detail!.FinalRollOD],
                                ["Artwork Name", detail!.CatalogArtworkName],
                                ["Special Specs", detail!.CatalogSpecialSpecs],
                              ].map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-3">
                                  <dt className="text-gray-500 text-xs flex-shrink-0">{k}</dt>
                                  <dd className="text-gray-800 text-xs font-medium text-right">{String(v || "—")}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                              <Package size={32} className="mb-2 text-gray-300" />
                              <p className="text-sm">No product catalog linked yet.</p>
                              <p className="text-xs mt-1">Create a Product Catalog and select this artwork to link it.</p>
                            </div>
                          )}
                        </div>

                        {/* ── Attachments ── */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-1">
                          <SH label="Attachments" />
                          {atts.length === 0 ? (
                            <div className="text-center py-6 text-gray-400 text-sm">No attachments.</div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {atts.map(att => (
                                <AttCard key={att._id} att={att} onRemove={() => { }}
                                  onPreview={() => setPreview(att)} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ TAB: Artwork Library ══════════════════════════════════════════ */}
      {activeTab === "library" && (() => {
        // ── derive unique filter options ──────────────────────────────────
        const uniq = (key: keyof LibRow) =>
          [...new Set(libRows.map(r => r[key] as string).filter(Boolean))].sort();

        const uCustomers = uniq("Customer");
        const uJobNames = uniq("JobName");
        const uBrands = uniq("Brand");
        const uPackSizes = uniq("PackSize");
        const uCategories = uniq("CategoryName");
        const uSubstrates = uniq("Substrate");
        const uTypes = uniq("TypeOfProduct");
        const uColors = uniq("NoOfColors");
        const uColorNames = [...new Set(
          libRows.flatMap(r => (r.ColorName || "").split(",").map(c => c.trim()).filter(Boolean))
        )].sort();
        const uMachines = uniq("Machine");
        const uCylTypes = [...new Set(
          libRows.flatMap(r => (r.CylType || "").split(",").map(c => c.trim()).filter(Boolean))
        )].sort();
        const uCylStatuses = [...new Set(
          libRows.flatMap(r => (r.CylStatus || "").split(",").map(c => c.trim()).filter(Boolean))
        )].sort();
        const uVendors = uniq("CylVendor");

        // ── apply all filters ─────────────────────────────────────────────
        const lf = libFilters;
        const filtered = libRows.filter(r => {
          const q = libSearch.toLowerCase();
          const matchSearch = !q || [r.WoNo, r.OrderNo, r.Customer, r.JobName, r.Brand, r.ArtworkNo, r.ColorName, r.ProductCode]
            .some(v => v?.toLowerCase().includes(q));
          const stage = r.ArtworkStage || "Artwork Pending";
          const brandAppr = ARTWORK_STAGES.indexOf(stage) >= ARTWORK_STAGES.indexOf("Brand Approved");
          const lsdAppr = ARTWORK_STAGES.indexOf(stage) >= ARTWORK_STAGES.indexOf("LSD Shade Approved");
          const cylRcvd = ARTWORK_STAGES.indexOf(stage) >= ARTWORK_STAGES.indexOf("Cylinder Received");

          const inc = (a: string | undefined | null, b: string) => (a || "").toLowerCase().includes(b.toLowerCase());
          return matchSearch
            && (!lf.customer || inc(r.Customer, lf.customer))
            && (!lf.brand || inc(r.Brand, lf.brand))
            && (!lf.packSize || inc(r.PackSize, lf.packSize))
            && (!lf.category || inc(r.CategoryName, lf.category))
            && (!lf.substrate || inc(r.Substrate, lf.substrate))
            && (!lf.designType || inc(r.TypeOfProduct, lf.designType))
            && (!lf.noOfColors || inc(r.NoOfColors, lf.noOfColors))
            && (!lf.colorName || r.ColorName?.split(",").some(c => c.trim().toLowerCase().includes(lf.colorName.toLowerCase())))
            && (!lf.machine || inc(r.Machine, lf.machine))
            && (!lf.cylType || inc(r.CylType, lf.cylType))
            && (!lf.cylStatus || r.CylStatus?.split(",").some(c => c.trim().toLowerCase().includes(lf.cylStatus.toLowerCase())))
            && (!lf.cylVendor || inc(r.CylVendor, lf.cylVendor))
            && (!lf.artworkStage || inc(stage, lf.artworkStage))
            && (!lf.brandApproved || (lf.brandApproved === "Yes" ? brandAppr : !brandAppr))
            && (!lf.lsdApproved || (lf.lsdApproved === "Yes" ? lsdAppr : !lsdAppr))
            && (!lf.cylReceived || (lf.cylReceived === "Yes" ? cylRcvd : !cylRcvd))
            && (!lf.jobName || inc(r.JobName, lf.jobName))
            && (!lf.circum || inc(r.CircumMM, lf.circum))
            && (!lf.cylLength || inc(r.CylLength, lf.cylLength))
            && (!lf.coilWidth || inc(r.CylPrintWidth, lf.coilWidth))
            && (!lf.repeatLength || inc(r.RepeatMM, lf.repeatLength))
            && (!kpiFilter || (() => {
              const s = r.ArtworkStage || "Artwork Pending";
              if (kpiFilter === "CYLINDER RECEIVED") return s === "Cylinder Received";
              if (kpiFilter === "ENGRAVING") return s === "Engraving";
              if (kpiFilter === "BRAND APPROVED") return s === "Brand Approved";
              if (kpiFilter === "UNDER PROCESS") return s === "Under Process";
              if (kpiFilter === "PENDING MAIL TO MB") return s === "Pending Mail to MB";
              if (kpiFilter === "ON HOLD") return s === "On Hold";
              return true;
            })());
        });

        // ── sort ─────────────────────────────────────────────────────────
        const COL_KEY: Record<string, (r: LibRow) => string> = {
          "JOB NAME": r => r.JobName || "",
          "SKU SIZE": r => r.PackSize || "",
          "MATERIAL": r => r.StructureType || "",
          "DESIGN TYPE": r => r.TypeOfProduct || "",
          "CURRENT STATUS": r => r.ArtworkStage || "",
          "CUSTOMER / PARTY": r => r.Customer || "",
          "CYL. MAKER": r => r.CylVendor || "",
          "COLORS": r => (parseInt(r.NoOfColors || "0") || 0).toString().padStart(5, "0"),
          "BRAND / PRODUCT": r => r.Brand || "",
          "SUBSTRATE": r => r.Substrate || "",
          "CYLINDER STATUS": r => r.CylStatus || "",
          "ARTWORK RECD.": r => r.CreatedDate || "",
        };
        const sortedRows = (libSort && COL_KEY[libSort.col])
          ? [...filtered].sort((a, b) => {
            const cmp = COL_KEY[libSort.col](a).localeCompare(COL_KEY[libSort.col](b), undefined, { numeric: true, sensitivity: "base" });
            return libSort.dir === "asc" ? cmp : -cmp;
          })
          : filtered;

        // column → filter mapping for Excel-style header dropdowns
        type CFEntry = { key: keyof typeof libFilters; getVal: (r: LibRow) => string };
        const COL_FILTER: Record<string, CFEntry> = {
          "JOB NAME": { key: "jobName", getVal: r => r.JobName || "" },
          "SKU SIZE": { key: "packSize", getVal: r => r.PackSize || "" },
          "DESIGN TYPE": { key: "designType", getVal: r => r.TypeOfProduct || "" },
          "CURRENT STATUS": { key: "artworkStage", getVal: r => r.ArtworkStage || "Artwork Pending" },
          "CUSTOMER / PARTY": { key: "customer", getVal: r => r.Customer || "" },
          "CYL. MAKER": { key: "cylVendor", getVal: r => r.CylVendor || "" },
          "COLORS": { key: "noOfColors", getVal: r => r.NoOfColors || "" },
          "BRAND / PRODUCT": { key: "brand", getVal: r => r.Brand || "" },
          "SUBSTRATE": { key: "substrate", getVal: r => r.Substrate || "" },
          "CYLINDER STATUS": { key: "cylStatus", getVal: r => r.CylStatus || "" },
          "MATERIAL": { key: "category", getVal: r => r.StructureType || "" },
        };

        // ── summary counts ────────────────────────────────────────────────
        const distinctArtworks = (stagePred: (s: string) => boolean) => {
          const seen = new Set<string>();
          libRows.forEach(r => {
            const s = r.ArtworkStage || "Artwork Pending";
            if (stagePred(s)) seen.add(r.ArtworkID);
          });
          return seen.size;
        };
        // Overall KPIs (all libRows)
        const totalJobs = new Set(libRows.map(r => r.ArtworkID)).size;
        const cylRcvdAll = distinctArtworks(s => s === "Cylinder Received");
        const engravingAll = distinctArtworks(s => s === "Engraving");
        const brandApprAll = distinctArtworks(s => s === "Brand Approved");
        const underProcAll = distinctArtworks(s => s === "Under Process");
        const pendMailAll = distinctArtworks(s => s === "Pending Mail to MB");
        const onHoldAll = distinctArtworks(s => s === "On Hold");

        // Filtered KPIs
        const distinctFiltered = (stagePred: (s: string) => boolean) => {
          const seen = new Set<string>();
          filtered.forEach(r => { const s = r.ArtworkStage || "Artwork Pending"; if (stagePred(s)) seen.add(r.ArtworkID); });
          return seen.size;
        };
        const fTotalJobs = new Set(filtered.map(r => r.ArtworkID)).size;
        const fCylRcvd = distinctFiltered(s => s === "Cylinder Received");
        const fEngraving = distinctFiltered(s => s === "Engraving");
        const fBrandAppr = distinctFiltered(s => s === "Brand Approved");
        const fUnderProc = distinctFiltered(s => s === "Under Process");
        const fPendMail = distinctFiltered(s => s === "Pending Mail to MB");
        const fOnHold = distinctFiltered(s => s === "On Hold");

        const hasFilter = Object.values(libFilters).some(Boolean) || !!libSearch || !!kpiFilter;

        const setLF = (k: keyof typeof libFilters, v: string) =>
          setLibFilters(f => ({ ...f, [k]: v }));

        // ── stage color map ───────────────────────────────────────────────
        const STAGE_COLORS: Record<string, { dot: string; bg: string; text: string; border: string }> = {
          "Artwork Pending": { dot: "#9ca3af", bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
          "Artwork Received": { dot: "#f59e0b", bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300" },
          "Under Process": { dot: "#0d9488", bg: "bg-teal-100", text: "text-teal-800", border: "border-teal-300" },
          "Pending Mail to MB": { dot: "#f59e0b", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300" },
          "Brand Approved": { dot: "#7c3aed", bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300" },
          "LSD Shade Approved": { dot: "#3b82f6", bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
          "Engraving": { dot: "#4f46e5", bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-300" },
          "Cylinder Received": { dot: "#16a34a", bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
          "Released to Production": { dot: "#15803d", bg: "bg-green-200", text: "text-green-900", border: "border-green-400" },
          "On Hold": { dot: "#dc2626", bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
        };
        const stageBadge = (s: string) => {
          const c = STAGE_COLORS[s];
          return c ? `${c.bg} ${c.text}` : "bg-gray-100 text-gray-500";
        };

        const selCls = "px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-400 bg-white w-full";

        // unique values for new filters
        const uCircums = [...new Set(libRows.map(r => r.CircumMM).filter(Boolean))].sort();
        const uCylLengths = [...new Set(libRows.map(r => r.CylLength).filter(Boolean))].sort();
        const uCoilWidths = [...new Set(libRows.map(r => r.CylPrintWidth).filter(Boolean))].sort();
        const uRepeatLens = [...new Set(libRows.map(r => r.RepeatMM).filter(Boolean))].sort();

        // KPI definitions — exact match to screenshot
        const KPI_DEF = [
          { label: "TOTAL JOBS", filLabel: "JOBS IN SELECTION", overall: totalJobs, fil: fTotalJobs, border: "border-t-blue-500", num: "text-gray-800", clickable: true },
          { label: "CYLINDER RECEIVED", filLabel: "CYLINDER RECEIVED", overall: cylRcvdAll, fil: fCylRcvd, border: "border-t-green-500", num: "text-green-600", clickable: true },
          { label: "ENGRAVING", filLabel: "ENGRAVING", overall: engravingAll, fil: fEngraving, border: "border-t-indigo-600", num: "text-indigo-700", clickable: true },
          { label: "BRAND APPROVED", filLabel: "BRAND APPROVED", overall: brandApprAll, fil: fBrandAppr, border: "border-t-purple-500", num: "text-purple-700", clickable: true },
          { label: "UNDER PROCESS", filLabel: "UNDER PROCESS", overall: underProcAll, fil: fUnderProc, border: "border-t-teal-500", num: "text-teal-700", clickable: true },
          { label: "PENDING MAIL TO MB", filLabel: "PENDING MAIL TO MB", overall: pendMailAll, fil: fPendMail, border: "border-t-amber-500", num: "text-amber-600", clickable: true },
          { label: "ON HOLD", filLabel: "ON HOLD", overall: onHoldAll, fil: fOnHold, border: "border-t-red-500", num: "text-red-600", clickable: true },
        ];

        return (
          <div className="space-y-4">

            {/* ── KPI Dashboard ── */}
            {/* OVERALL */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-[#1a2b4a] text-white text-[11px] font-bold rounded-md uppercase tracking-widest">■ OVERALL</span>
              </div>
              <div className="grid grid-cols-7 gap-3">
                {KPI_DEF.map(k => {
                  const isActive = kpiFilter === k.label;
                  return (
                    <button
                      key={k.label}
                      onClick={() => {
                        if (!k.clickable) return;
                        if (k.label === "TOTAL JOBS") { setKpiFilter(null); return; }
                        setKpiFilter(isActive ? null : k.label);
                      }}
                      className={`bg-white rounded-xl border border-gray-200 border-t-4 ${k.border} p-4 text-left shadow-sm transition-all
                        ${k.clickable ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "cursor-default"}
                        ${isActive ? "ring-2 ring-indigo-400 shadow-md" : ""}
                      `}
                    >
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-tight">{k.label}</p>
                      <p className={`text-3xl font-black mt-1 ${k.num}`}>{k.overall}</p>
                      {isActive ? (
                        <p className="text-[10px] text-red-500 font-semibold mt-0.5 flex items-center gap-0.5"><X size={9} /> Remove</p>
                      ) : k.label === "TOTAL JOBS" ? (
                        <p className="text-[10px] text-blue-500 mt-0.5">{kpiFilter ? "Click to show all" : "All records"}</p>
                      ) : (
                        <p className="text-[10px] text-blue-500 mt-0.5">Click to filter</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FILTERED SELECTION */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-md uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white inline-block"></span> FILTERED SELECTION
                </span>
                {!hasFilter && <span className="text-xs text-gray-400">No filter active</span>}
                {kpiFilter && (
                  <button onClick={() => setKpiFilter(null)}
                    className="flex items-center gap-1 text-[11px] text-white bg-red-500 hover:bg-red-600 rounded-full px-2.5 py-0.5 font-semibold">
                    <X size={10} /> Remove KPI filter
                  </button>
                )}
              </div>
              <div className="grid grid-cols-7 gap-3">
                {KPI_DEF.map(k => {
                  const isActive = kpiFilter === k.label;
                  return (
                    <div key={k.label}
                      className={`bg-white rounded-xl border border-gray-200 border-t-4 ${k.border} p-4 shadow-sm relative transition-all
                        ${isActive ? "ring-2 ring-indigo-400" : ""}
                      `}
                    >
                      <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded font-bold bg-green-100 text-green-700">
                        {isActive ? "active" : "All"}
                      </span>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-tight pr-6">{k.filLabel}</p>
                      <p className={`text-3xl font-black mt-1 ${k.num}`}>{k.fil}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">all records</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 4 Bar Chart Panels ── */}
            {(() => {
              const BAR_COLORS = [
                "#991b1b", "#166534", "#1e3a8a", "#78350f", "#581c87",
                "#0f766e", "#831843", "#3f6212", "#1d4ed8", "#92400e",
                "#15803d", "#6d28d9", "#0369a1", "#b45309", "#be123c",
              ];
              const SKU_COLORS = [
                "#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa",
                "#93c5fd", "#bfdbfe", "#dbeafe", "#065f46", "#047857",
                "#059669", "#10b981", "#34d399",
              ];
              const maxCount = (arr: [string, number][]) => arr.length ? Math.max(...arr.map(x => x[1])) : 1;

              const countBy = (key: keyof LibRow) =>
                Object.entries(
                  filtered.reduce((acc, r) => {
                    const k = (r[key] as string) || "—";
                    acc[k] = (acc[k] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1]);

              const byJobName = countBy("JobName").slice(0, 12);
              const bySkuSize = countBy("PackSize").slice(0, 12);
              const byProduct = countBy("CategoryName");
              const byStatus = [
                { label: "Cylinder received", stage: "Cylinder Received", color: "#16a34a" },
                { label: "Brand approved", stage: "Brand Approved", color: "#1d4ed8" },
                { label: "Under process", stage: "Under Process", color: "#78350f" },
                { label: "Engraving", stage: "Engraving", color: "#3b82f6" },
                { label: "On hold", stage: "On Hold", color: "#b91c1c" },
              ].map(s => ({ ...s, count: filtered.filter(r => (r.ArtworkStage || "Artwork Pending") === s.stage).length }));

              const BarPanel = ({
                title, rows, colors, onItemClick, activeVal, filterKey,
              }: {
                title: string;
                rows: [string, number][];
                colors: string[];
                onItemClick: (val: string) => void;
                activeVal: string;
                filterKey: string;
              }) => {
                const mx = maxCount(rows);
                return (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">{title}</p>
                      {activeVal && (
                        <button onClick={() => onItemClick("")}
                          className="flex items-center gap-0.5 text-[10px] text-red-500 hover:text-red-700 font-semibold">
                          <X size={9} /> clear
                        </button>
                      )}
                      {!activeVal && (
                        <span className="text-[10px] text-pink-400 font-medium flex items-center gap-0.5">
                          📌 click to filter
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {rows.map(([label, count], i) => {
                        const pct = Math.round((count / mx) * 100);
                        const color = colors[i % colors.length];
                        const isActive = activeVal === label;
                        return (
                          <button key={label} onClick={() => onItemClick(isActive ? "" : label)}
                            className={`w-full flex items-center gap-2 text-left group rounded px-1 py-0.5 transition-colors
                              ${isActive ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                            <span className="text-[11px] text-gray-700 w-[110px] flex-shrink-0 truncate" title={label}>{label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                            <span className="text-[11px] font-bold text-gray-700 w-5 text-right flex-shrink-0">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              return (
                <div className="grid grid-cols-4 gap-4">
                  <BarPanel
                    title="By Job Name" rows={byJobName}
                    colors={BAR_COLORS}
                    activeVal={libFilters.jobName}
                    filterKey="jobName"
                    onItemClick={v => setLF("jobName", v)}
                  />
                  <BarPanel
                    title="By SKU Size" rows={bySkuSize}
                    colors={SKU_COLORS}
                    activeVal={libFilters.packSize}
                    filterKey="packSize"
                    onItemClick={v => setLF("packSize", v)}
                  />
                  <BarPanel
                    title="By Product" rows={byProduct}
                    colors={["#dc2626", "#2563eb", "#16a34a", "#9333ea", "#f59e0b", "#0891b2"]}
                    activeVal={libFilters.category}
                    filterKey="category"
                    onItemClick={v => setLF("category", v)}
                  />
                  {/* BY STATUS */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">By Status</p>
                      {kpiFilter && (
                        <button onClick={() => setKpiFilter(null)}
                          className="flex items-center gap-0.5 text-[10px] text-red-500 hover:text-red-700 font-semibold">
                          <X size={9} /> clear
                        </button>
                      )}
                      {!kpiFilter && (
                        <span className="text-[10px] text-pink-400 font-medium flex items-center gap-0.5">
                          📌 click to filter
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {byStatus.map(s => {
                        const mx2 = Math.max(...byStatus.map(x => x.count), 1);
                        const pct = Math.round((s.count / mx2) * 100);
                        const isActive = kpiFilter === s.stage;
                        return (
                          <button key={s.stage} onClick={() => setKpiFilter(isActive ? null : s.stage)}
                            className={`w-full flex items-center gap-2 text-left rounded px-1 py-0.5 transition-colors
                              ${isActive ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                            <span className="text-[11px] text-gray-700 w-[110px] flex-shrink-0 truncate">{s.label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                            </div>
                            <span className="text-[11px] font-bold text-gray-700 w-5 text-right flex-shrink-0">{s.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Filter Panel ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Filter size={14} className="text-indigo-500" />
                  FILTERS
                  {hasFilter && (
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full">
                      {Object.values(libFilters).filter(Boolean).length + (libSearch ? 1 : 0) + (kpiFilter ? 1 : 0)} active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasFilter && (
                    <button onClick={() => {
                      setLibSearch("");
                      setKpiFilter(null);
                      setLibFilters({
                        customer: "", jobName: "", brand: "", packSize: "", category: "", substrate: "",
                        designType: "", noOfColors: "", colorName: "", machine: "", cylType: "",
                        cylStatus: "", cylVendor: "", artworkStage: "", brandApproved: "", lsdApproved: "", cylReceived: "",
                        circum: "", cylLength: "", coilWidth: "", repeatLength: "",
                      });
                    }} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50">
                      ↺ Reset
                    </button>
                  )}
                  <button onClick={() => setLibShowFilter(v => !v)}
                    className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:text-indigo-800">
                    {libShowFilter ? "Hide" : "Show"}
                    {libShowFilter ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                </div>
              </div>

              {libShowFilter && (
                <div className="p-4 space-y-3">
                  {/* Row 1: Search + Job Name + SKU Size + Brand + Product + Customer */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <div className="relative md:col-span-1">
                      <Input value={libSearch} onChange={e => setLibSearch(e.target.value)} placeholder="Job, SKU, brand, customer, file…" className="w-full pl-7 pr-2" />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">🔍</span>
                    </div>
                    <SearchableSelect
                      value={lf.jobName}
                      onChange={val => setLF("jobName", val)}
                      options={uJobNames.map(v => ({ value: v, label: v }))}
                      placeholder="All jobs"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.packSize}
                      onChange={val => setLF("packSize", val)}
                      options={uPackSizes.map(v => ({ value: v, label: v }))}
                      placeholder="All SKUs"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.brand}
                      onChange={val => setLF("brand", val)}
                      options={uBrands.map(v => ({ value: v, label: v }))}
                      placeholder="All brands"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.category}
                      onChange={val => setLF("category", val)}
                      options={uCategories.map(v => ({ value: v, label: v }))}
                      placeholder="All products"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.customer}
                      onChange={val => setLF("customer", val)}
                      options={uCustomers.map(v => ({ value: v, label: v }))}
                      placeholder="All customers"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                  </div>

                  {/* Row 2: Status + Cyl. Maker + Design Type + Substrate + No. of Colors + Cyl. Status */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <SearchableSelect
                      value={lf.artworkStage}
                      onChange={val => setLF("artworkStage", val)}
                      options={ARTWORK_STAGES.map(v => ({ value: v, label: v }))}
                      placeholder="All statuses"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.cylVendor}
                      onChange={val => setLF("cylVendor", val)}
                      options={uVendors.map(v => ({ value: v, label: v }))}
                      placeholder="All makers"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.designType}
                      onChange={val => setLF("designType", val)}
                      options={uTypes.map(v => ({ value: v, label: v }))}
                      placeholder="All types"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.substrate}
                      onChange={val => setLF("substrate", val)}
                      options={uSubstrates.map(v => ({ value: v, label: v }))}
                      placeholder="All substrates"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.noOfColors}
                      onChange={val => setLF("noOfColors", val)}
                      options={uColors.map(v => ({ value: v, label: v }))}
                      placeholder="All"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.cylStatus}
                      onChange={val => setLF("cylStatus", val)}
                      options={uCylStatuses.map(v => ({ value: v, label: v }))}
                      placeholder="All cyl. status"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                  </div>

                  {/* Row 3: Brand Approval + LSD Approval + Cyl. Received + Cyl. Type + Machine + Color Name */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <SearchableSelect
                      value={lf.brandApproved}
                      onChange={val => setLF("brandApproved", val)}
                      options={[{ value: "Yes", label: "Brand Approved" }, { value: "No", label: "Not Approved" }]}
                      placeholder="Brand Appr. (All)"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.lsdApproved}
                      onChange={val => setLF("lsdApproved", val)}
                      options={[{ value: "Yes", label: "LSD Approved" }, { value: "No", label: "Not Approved" }]}
                      placeholder="LSD Appr. (All)"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.cylReceived}
                      onChange={val => setLF("cylReceived", val)}
                      options={[{ value: "Yes", label: "Cyl. Received" }, { value: "No", label: "Not Received" }]}
                      placeholder="Cyl. Rcvd (All)"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.cylType}
                      onChange={val => setLF("cylType", val)}
                      options={uCylTypes.map(v => ({ value: v, label: v }))}
                      placeholder="All cyl. types"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.machine}
                      onChange={val => setLF("machine", val)}
                      options={uMachines.map(v => ({ value: v, label: v }))}
                      placeholder="All machines"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.colorName}
                      onChange={val => setLF("colorName", val)}
                      options={uColorNames.map(v => ({ value: v, label: v }))}
                      placeholder="All color names"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                  </div>

                  {/* Row 4: Coil Width + Repeat Length + Cyl. Circum + Cyl. Length */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <SearchableSelect
                      value={lf.coilWidth}
                      onChange={val => setLF("coilWidth", val)}
                      options={uCoilWidths.map(v => ({ value: v, label: `${v} mm` }))}
                      placeholder="Coil Width (MM) — All"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.repeatLength}
                      onChange={val => setLF("repeatLength", val)}
                      options={uRepeatLens.map(v => ({ value: v, label: `${v} mm` }))}
                      placeholder="Repeat Length (MM) — All"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.circum}
                      onChange={val => setLF("circum", val)}
                      options={uCircums.map(v => ({ value: v, label: `${v} mm` }))}
                      placeholder="Cylinder Circum (MM) — All"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                    <SearchableSelect
                      value={lf.cylLength}
                      onChange={val => setLF("cylLength", val)}
                      options={uCylLengths.map(v => ({ value: v, label: `${v} mm` }))}
                      placeholder="Cylinder Length (MM) — All"
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white w-full"
                    />
                  </div>

                  <p className="text-[10px] text-gray-400 pt-1">
                    Showing <strong>{filtered.length}</strong> of <strong>{libRows.length}</strong> records
                  </p>
                </div>
              )}
            </div>

            {/* ── Data Table ── */}
            <DataTable<LibRow>
              data={sortedRows}
              loading={libLoading}
              getRowId={r => String(r.ArtworkID)}
              rowHeight={52}
              columns={[
                {
                  key: "JobName", header: "Job Name", wrap: true, size: 220,
                  render: r => (
                    <div className="leading-snug">
                      <p className="font-semibold text-gray-800">{r.JobName || "—"}</p>
                      {r.ArtworkNo && <p className="text-[10px] text-gray-400 mt-0.5">{r.ArtworkNo}</p>}
                      {r.AttachmentFilesName && <p className="text-[10px] text-blue-400 mt-0.5 break-words">{r.AttachmentFilesName}</p>}
                    </div>
                  ),
                },
                {
                  key: "PackSize", header: "SKU Size",
                  render: r => <span className="font-medium text-gray-700">{r.PackSize || "—"}</span>,
                },
                {
                  key: "StructureType", header: "Material",
                  render: r => r.StructureType
                    ? <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold border border-slate-200">{r.StructureType}</span>
                    : <span className="text-gray-400">—</span>,
                },
                {
                  key: "TypeOfProduct", header: "Design Type", wrap: true, size: 160,
                  render: r => <span className="text-gray-700 leading-snug">{r.TypeOfProduct || "—"}</span>,
                },
                {
                  key: "ArtworkStage", header: "Current Status", size: 170,
                  render: r => {
                    const stage = r.ArtworkStage || "Artwork Pending";
                    const cls = (() => {
                      if (stage === "Cylinder Received") return "bg-green-100 text-green-800 border border-green-200";
                      if (stage === "Brand Approved") return "bg-blue-100 text-blue-800 border border-blue-200";
                      if (stage === "Engraving") return "bg-indigo-100 text-indigo-800 border border-indigo-200";
                      if (stage === "Under Process") return "bg-teal-100 text-teal-800 border border-teal-200";
                      if (stage === "Pending Mail to MB") return "bg-amber-50 text-amber-800 border border-amber-200";
                      if (stage === "On Hold") return "bg-red-100 text-red-800 border border-red-200";
                      if (stage === "Released to Production") return "bg-green-200 text-green-900 border border-green-300";
                      if (stage === "LSD Shade Approved") return "bg-purple-100 text-purple-800 border border-purple-200";
                      return "bg-gray-100 text-gray-600 border border-gray-200";
                    })();
                    return <span className={`inline-block px-2 py-1 rounded text-[10px] font-semibold leading-tight ${cls}`}>{stage}</span>;
                  },
                },
                {
                  key: "Customer", header: "Customer / Party", wrap: true, size: 140,
                  render: r => <span className="text-gray-700 text-[11px] leading-snug">{r.Customer || "—"}</span>,
                },
                {
                  key: "CylVendor", header: "Cyl. Maker",
                  render: r => <span className="text-gray-700 font-medium">{r.CylVendor || "—"}</span>,
                },
                {
                  key: "NoOfColors", header: "Colors",
                  render: r => <span className="font-bold text-gray-700">{r.NoOfColors || "—"}</span>,
                },
                {
                  key: "Brand", header: "Brand / Product", wrap: true, size: 140,
                  render: r => (
                    <div className="leading-snug">
                      <p className="font-bold text-red-600 text-[11px]">{r.Brand || "—"}</p>
                      <p className="text-gray-500 text-[10px] mt-0.5">{r.CategoryName || "—"}</p>
                    </div>
                  ),
                },
                {
                  key: "Substrate", header: "Substrate",
                  render: r => <span className="text-gray-600">{r.Substrate || "—"}</span>,
                },
                {
                  key: "CylStatus", header: "Cylinder Status",
                  render: r => r.CylStatus
                    ? <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-medium">{r.CylStatus}</span>
                    : <span className="text-gray-400">—</span>,
                },
                {
                  key: "CreatedDate", header: "Artwork Recd.",
                  render: r => <span className="text-gray-600 text-[11px]">{r.CreatedDate || "—"}</span>,
                },
              ]}
              actions={r => {
                const stage = r.ArtworkStage || "Artwork Pending";
                const stageIdx = ARTWORK_STAGES.indexOf(stage);
                const isUpdating = libUpdating === r.ArtworkID;
                return isUpdating ? (
                  <div className="flex items-center gap-1.5 text-indigo-500">
                    <Loader2 size={13} className="animate-spin" />
                    <span className="text-[10px]">Saving…</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button disabled={stageIdx <= 0}
                      onClick={() => updateStage(r.ArtworkID, ARTWORK_STAGES[Math.max(0, stageIdx - 1)])}
                      className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed">
                      <ChevronLeft size={13} />
                    </button>
                    <div className="relative">
                      <button
                        onClick={e => { e.stopPropagation(); setOpenStageRow(openStageRow === r.ArtworkID ? null : r.ArtworkID); }}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap
                          ${STAGE_COLORS[stage]?.bg || "bg-gray-100"}
                          ${STAGE_COLORS[stage]?.text || "text-gray-700"}
                          ${STAGE_COLORS[stage]?.border || "border-gray-300"}
                        `}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STAGE_COLORS[stage]?.dot || "#9ca3af" }} />
                        {stage}
                        <ChevronDown size={10} className="opacity-60" />
                      </button>
                      {openStageRow === r.ArtworkID && (
                        <div className="absolute z-50 left-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-2xl py-1 overflow-hidden">
                          {ARTWORK_STAGES.map(s => {
                            const c = STAGE_COLORS[s] || { dot: "#9ca3af", bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
                            const isCur = s === stage;
                            return (
                              <button key={s}
                                onClick={() => { updateStage(r.ArtworkID, s); setOpenStageRow(null); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] font-medium transition-colors
                                  ${isCur ? `${c.bg} ${c.text} font-bold` : "hover:bg-gray-50 text-gray-700"}`}
                              >
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
                                {s}
                                {isCur && <Check size={11} className="ml-auto" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button disabled={stageIdx >= ARTWORK_STAGES.length - 1}
                      onClick={() => updateStage(r.ArtworkID, ARTWORK_STAGES[Math.min(ARTWORK_STAGES.length - 1, stageIdx + 1)])}
                      className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-green-600 disabled:opacity-20 disabled:cursor-not-allowed">
                      <ChevronRight size={13} />
                    </button>
                  </div>
                );
              }}
            />

          </div>
        );
      })()}

      {/* ═══ New / Edit Modal ═══════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-stretch bg-black/40">
          <div className="bg-white w-full h-full overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-gray-800">
                {editMode ? "Edit Artwork" : "New Artwork Master"}
              </h3>
              <div className="flex items-center gap-3">
                <Button onClick={save} loading={saving} icon={<Check size={15} />}>
                  {editMode ? "Update" : "Save"}
                </Button>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto">
              {formError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
              )}

              {/* ── Two-column main area ── */}
              <div className="flex gap-6">
                {/* LEFT: Product Details */}
                <div className="flex-1 min-w-0">
                  <SH label="Product Details" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lCls}>Job Name</label>
                      <div className="relative">
                        <Input
                          value={form.JobName}
                          onChange={e => {
                            rf("JobName", e.target.value);
                            rf("ArtworkName", [e.target.value, form.PackSize, form.BottleType, form.AddressType, form.SkuType].filter(Boolean).join("-"));
                          }}
                          placeholder="Type or select…"
                          list="master-jobname-list"
                          autoComplete="off"
                          className="pr-8"
                        />
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <datalist id="master-jobname-list">
                          {[...new Set([
                            ...list.map(r => r.ProductName),
                            ...libRows.map(r => r.JobName),
                          ].filter(Boolean))].sort().map(name => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    <Input label="File Name" value={form.AttachmentFilesName} onChange={e => rf("AttachmentFilesName", e.target.value)} placeholder="Enter file name…" />
                    <div>
                      <label className={lCls}>Brand Name</label>
                      <SearchableSelect value={form.BrandName} onChange={val => rf("BrandName", val)}
                        options={fmOptions.brandNames.map(v => ({ value: v, label: v }))} placeholder="-- Select Brand --"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                    </div>
                    <div>
                      <label className={lCls}>Pack Size</label>
                      <SearchableSelect value={form.PackSize} onChange={val => { rf("PackSize", val); rf("ArtworkName", [form.JobName, val, form.BottleType, form.AddressType, form.SkuType].filter(Boolean).join("-")); }}
                        options={fmOptions.packSizes.map(v => ({ value: v, label: v }))} placeholder="-- Select Pack Size --"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                    </div>
                    <div>
                      <label className={lCls}>Product Type</label>
                      <SearchableSelect value={form.ProductType} onChange={val => rf("ProductType", val)}
                        options={fmOptions.productTypes.map(v => ({ value: v, label: v }))} placeholder="-- Select Product Type --"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                    </div>
                    <div>
                      <label className={lCls}>SKU Type</label>
                      <SearchableSelect value={form.SkuType} onChange={val => { rf("SkuType", val); rf("ArtworkName", [form.JobName, form.PackSize, form.BottleType, form.AddressType, val].filter(Boolean).join("-")); }}
                        options={fmOptions.skuTypes.map(v => ({ value: v, label: v }))} placeholder="-- Select SKU Type --"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                    </div>
                    <div>
                      <label className={lCls}>Bottle Type</label>
                      <SearchableSelect value={form.BottleType} onChange={val => { rf("BottleType", val); rf("ArtworkName", [form.JobName, form.PackSize, val, form.AddressType, form.SkuType].filter(Boolean).join("-")); }}
                        options={fmOptions.bottleTypes.map(v => ({ value: v, label: v }))} placeholder="-- Select Bottle Type --"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                    </div>
                    <div>
                      <label className={lCls}>Address Type</label>
                      <SearchableSelect value={form.AddressType} onChange={val => { rf("AddressType", val); rf("ArtworkName", [form.JobName, form.PackSize, form.BottleType, val, form.SkuType].filter(Boolean).join("-")); }}
                        options={fmOptions.addressTypes.map(v => ({ value: v, label: v }))} placeholder="-- Select Address Type --"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                    </div>
                    <div className="col-span-2"><Input label="Artwork Name (auto-generated)" value={form.ArtworkName} readOnly /></div>
                    <div className="col-span-2"><Textarea label="Special Specifications" value={form.SpecialSpecs} onChange={e => rf("SpecialSpecs", e.target.value)} rows={2} placeholder="Any special requirements or notes…" /></div>
                  </div>
                </div>

                {/* RIGHT: Dates + Basic Information */}
                <div className="w-[420px] flex-shrink-0 space-y-5">
                  {/* Dates */}
                  <div>
                    <SH label="Dates" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Received Date" type="date" value={form.ReceivedDate} onChange={e => rf("ReceivedDate", e.target.value)} />
                      <Input label="Expected Completion Date" type="date" value={form.ExpectedCompletionDate} onChange={e => rf("ExpectedCompletionDate", e.target.value)} />
                    </div>
                  </div>

                  {/* Basic Information */}
                  <div>
                    <SH label="Basic Information" />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lCls}>Finish Goods Category *</label>
                        <SearchableSelect
                          value={form.CategoryID}
                          onChange={val => { rf("CategoryID", val); rf("Content", ""); const cat = dropData.categories.find(c => c.CategoryID === val); if (cat) rf("TypeOfProduct", cat.CategoryName); }}
                          options={dropData.categories.map(c => ({ value: c.CategoryID, label: c.CategoryName }))}
                          placeholder="-- Select Finish Goods Category --"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none"
                        />
                      </div>
                      {/* Sub Type (Content) picker */}
                      {form.CategoryID && (() => {
                        const selCat = catWithDetails.find(c => String(c.id) === String(form.CategoryID));
                        const contentDetails = selCat?.contentDetails ?? [];
                        if (contentDetails.length === 0) return null;
                        const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:57214").replace(/\/$/, "");
                        return (
                          <div>
                            <label className={lCls}>Sub Type (Content)</label>
                            <button type="button" onClick={() => setContentPickerOpen(true)}
                              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 transition-colors outline-none focus:ring-2 focus:ring-indigo-400">
                              {form.Content
                                ? <span className="text-gray-800 font-medium truncate">{form.Content}</span>
                                : <span className="text-gray-400">Select Sub Type</span>}
                              <span className="ml-2 flex items-center gap-1 text-indigo-600 font-bold shrink-0">
                                <Plus size={13} /> Select
                              </span>
                            </button>
                            {form.Content && (
                              <p className="text-[10px] text-teal-600 mt-1 flex items-center gap-1">
                                <Check size={10} /> {form.Content}
                              </p>
                            )}
                        {contentPickerOpen && (
                          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40" onClick={() => setContentPickerOpen(false)}>
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <div>
                                  <h3 className="text-base font-bold text-gray-800">Select Sub Type</h3>
                                  <p className="text-xs text-gray-400 mt-0.5">{selCat?.name}</p>
                                </div>
                                <button onClick={() => setContentPickerOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
                              </div>
                              <div className="overflow-y-auto p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {contentDetails.map(cd => {
                                  const selected = form.Content === cd.name;
                                  return (
                                    <button key={cd.name} type="button"
                                      onClick={() => { rf("Content", cd.name); setContentPickerOpen(false); }}
                                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${selected ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40"}`}>
                                      {cd.imageUrl && (
                                        <img src={cd.imageUrl.startsWith("http") ? cd.imageUrl : `${apiBase}/${cd.imageUrl.replace(/^\//, "")}`}
                                          alt={cd.name} className="w-16 h-16 object-contain rounded"
                                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                      )}
                                      <span className={`text-xs font-semibold text-center leading-tight ${selected ? "text-indigo-700" : "text-gray-700"}`}>{cd.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <Input label="Client Artwork No." value={form.ClientArtWorkNo} onChange={e => rf("ClientArtWorkNo", e.target.value)} placeholder="Client's reference number" />
                  <div className="col-span-2"><Textarea label="Artwork Description" value={form.ArtWorkDescription} onChange={e => rf("ArtWorkDescription", e.target.value)} rows={3} placeholder="Describe the artwork…" /></div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Attachments (full width, bottom) ── */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <SH label="Attachments" />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 text-orange-600 hover:bg-orange-50 rounded-lg text-xs font-semibold transition-colors">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {uploading ? "Uploading…" : "Add Files"}
              </button>
              <input ref={fileRef} type="file" multiple accept="*" className="hidden" onChange={e => addFiles(e.target.files)} />
            </div>
            {attachments.length > 0 ? (
              <div className="grid grid-cols-6 gap-3">
                {attachments.map(att => (
                  <AttCard key={att._id} att={att}
                    onRemove={() => setAttachments(p => p.filter(a => a._id !== att._id))}
                    onPreview={() => setPreview(att)}
                    onRemarkChange={val => setAttachments(p => p.map(a => a._id === att._id ? { ...a, remark: val } : a))} />
                ))}
              </div>
            ) : (
              <div onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-orange-200 rounded-xl p-5 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                <Paperclip size={20} className="text-orange-300 mx-auto mb-1.5" />
                <p className="text-xs text-orange-400 font-medium">Drag & drop any file — JPG, PDF, AI, PSD, PNG, etc.</p>
                <p className="text-[10px] text-orange-300 mt-0.5">or click to browse</p>
              </div>
            )}
          </div>
        </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: BB Artwork ════════════════════════════════════════════════ */}
      {activeTab === "bbartwork" && (
        <DataTable<BBArtworkRow>
          data={sgList}
          loading={sgLoading}
          getRowId={r => String(r.BBArtworkID)}
          toolbar={
            <div className="flex items-center gap-2">
              <button onClick={loadSubGroups}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
                title="Refresh">
                <RefreshCw size={14} className={sgLoading ? "animate-spin" : ""} />
              </button>
              <Button variant="secondary" pill icon={<Plus size={15} />} onClick={openAddSG}>
                New Child Artwork
              </Button>
            </div>
          }
          columns={[
            {
              key: "BBArtworkNo", header: "Child Artwork No.",
              render: r => <span className="font-semibold text-indigo-700">{r.BBArtworkNo}</span>,
            },
            {
              key: "AttachmentFilesName", header: "File Name", wrap: true, size: 240,
              render: r => (
                <span className="text-gray-500 text-[11px] leading-snug break-all">
                  {r.AttachmentFilesName || "—"}
                </span>
              ),
            },
            {
              key: "ArtworkNo", header: "Master Artwork", wrap: true, size: 200,
              render: r => (
                <div className="leading-snug">
                  <span className="font-medium text-gray-800">{r.ArtworkNo}</span>
                  {r.ArtworkName && <span className="text-xs text-gray-500 block">{r.ArtworkName}</span>}
                </div>
              ),
            },
            {
              key: "BBArtworkName", header: "Child Artwork Name", wrap: true, size: 220,
              render: r => <span className="font-medium text-gray-800 leading-snug">{r.BBArtworkName || "—"}</span>,
            },
            {
              key: "Content", header: "Content",
              render: r => r.Content
                ? <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] font-semibold rounded-full">{r.Content}</span>
                : <span className="text-gray-400">—</span>,
            },
          ]}
          actions={r => (
            <>
              <RowAction.Edit onClick={() => openEditSG(r)} />
              <RowAction.Delete onClick={() => deleteSG(r)} />
            </>
          )}
        />
      )}

      {/* ═══ BB Artwork Modal ═══════════════════════════════════════════════ */}
      {showSgModal && (
        <div className="fixed inset-0 z-50 flex items-stretch bg-black/40">
          <div className="bg-white w-full h-full overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-gray-800">
                {sgEditMode ? "Edit Child Artwork" : "New Child Artwork"}
              </h3>
              <div className="flex items-center gap-3">
                <Button onClick={saveSG} loading={sgSaving} icon={<Check size={15} />}>
                  {sgEditMode ? "Update" : "Save"} Child Artwork
                </Button>
                <button onClick={() => setShowSgModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto">
              {sgError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{sgError}</div>
              )}

              {/* ── Two-column main area ── */}
              <div className="flex gap-6">
                {/* LEFT: Master Artwork + Product Details */}
                <div className="flex-1 min-w-0 space-y-4">
                  {/* Master Artwork */}
                  <div>
                    <SH label="Master Artwork" />
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className={lCls}>Master Artwork *</label>
                        <SearchableSelect
                          value={sgForm.ArtworkID}
                          onChange={val => {
                            rfSG("ArtworkID", val);
                            if (!sgEditMode) autoFillSGFromArtwork(val);
                          }}
                          disabled={sgEditMode}
                          options={list.map(a => ({ value: String(a.ArtworkID), label: `${a.ArtworkNo} — ${a.ArtworkName || a.ProductName}` }))}
                          placeholder="-- Select Master Artwork --"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none"
                        />
                        {!sgEditMode && sgForm.ArtworkID && (
                          <p className="text-[10px] text-teal-600 mt-1 flex items-center gap-1">
                            <Check size={10} /> Fields auto-filled from master artwork — edit as needed
                          </p>
                        )}
                      </div>
                      <Input label="Child Artwork Name / Variant Label *" value={sgForm.BBArtworkName} onChange={e => rfSG("BBArtworkName", e.target.value)} placeholder="e.g. 200ml Red Label Variant, Export Pack…" />
                    </div>
                  </div>

                  {/* Product Details */}
                  <div>
                    <SH label="Product Details" />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lCls}>Job Name</label>
                        <div className="relative">
                          <Input
                            value={sgForm.JobName}
                            onChange={e => {
                              rfSG("JobName", e.target.value);
                              rfSG("ArtworkName", [e.target.value, sgForm.PackSize, sgForm.BottleType, sgForm.AddressType, sgForm.SkuType].filter(Boolean).join("-"));
                            }}
                            placeholder="Type or select…"
                            list="child-jobname-list"
                            autoComplete="off"
                            className="pr-8"
                          />
                          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <datalist id="child-jobname-list">
                            {[...new Set([
                              ...list.map(r => r.ProductName),
                              ...sgList.map(r => r.JobName),
                              ...libRows.map(r => r.JobName),
                            ].filter(Boolean))].sort().map(name => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                      <Input label="File Name" value={sgForm.AttachmentFilesName} onChange={e => rfSG("AttachmentFilesName", e.target.value)} placeholder="Enter file name…" />
                      <div>
                        <label className={lCls}>Brand Name</label>
                        <SearchableSelect value={sgForm.BrandName} onChange={val => rfSG("BrandName", val)}
                          options={fmOptions.brandNames.map(v => ({ value: v, label: v }))} placeholder="-- Select Brand --"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                      </div>
                      <div>
                        <label className={lCls}>Pack Size</label>
                        <SearchableSelect value={sgForm.PackSize} onChange={val => { rfSG("PackSize", val); rfSG("ArtworkName", [sgForm.JobName, val, sgForm.BottleType, sgForm.AddressType, sgForm.SkuType].filter(Boolean).join("-")); }}
                          options={fmOptions.packSizes.map(v => ({ value: v, label: v }))} placeholder="-- Select Pack Size --"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                      </div>
                      <div>
                        <label className={lCls}>Product Type</label>
                        <SearchableSelect value={sgForm.ProductType} onChange={val => rfSG("ProductType", val)}
                          options={fmOptions.productTypes.map(v => ({ value: v, label: v }))} placeholder="-- Select Product Type --"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                      </div>
                      <div>
                        <label className={lCls}>SKU Type</label>
                        <SearchableSelect value={sgForm.SkuType} onChange={val => { rfSG("SkuType", val); rfSG("ArtworkName", [sgForm.JobName, sgForm.PackSize, sgForm.BottleType, sgForm.AddressType, val].filter(Boolean).join("-")); }}
                          options={fmOptions.skuTypes.map(v => ({ value: v, label: v }))} placeholder="-- Select SKU Type --"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                      </div>
                      <div>
                        <label className={lCls}>Bottle Type</label>
                        <SearchableSelect value={sgForm.BottleType} onChange={val => { rfSG("BottleType", val); rfSG("ArtworkName", [sgForm.JobName, sgForm.PackSize, val, sgForm.AddressType, sgForm.SkuType].filter(Boolean).join("-")); }}
                          options={fmOptions.bottleTypes.map(v => ({ value: v, label: v }))} placeholder="-- Select Bottle Type --"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                      </div>
                      <div>
                        <label className={lCls}>Address Type</label>
                        <SearchableSelect value={sgForm.AddressType} onChange={val => { rfSG("AddressType", val); rfSG("ArtworkName", [sgForm.JobName, sgForm.PackSize, sgForm.BottleType, val, sgForm.SkuType].filter(Boolean).join("-")); }}
                          options={fmOptions.addressTypes.map(v => ({ value: v, label: v }))} placeholder="-- Select Address Type --"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none" />
                      </div>
                      <div className="col-span-2"><Input label="Artwork Name (auto-generated)" value={sgForm.ArtworkName} readOnly placeholder="Auto-generated from fields above" /></div>
                      <div className="col-span-2"><Textarea label="Special Specifications" value={sgForm.SpecialSpecs} onChange={e => rfSG("SpecialSpecs", e.target.value)} rows={2} placeholder="Any special requirements or notes…" /></div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Dates + Basic Info */}
                <div className="w-[420px] flex-shrink-0 space-y-5">
                  {/* Dates */}
                  <div>
                    <SH label="Dates" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Received Date" type="date" value={sgForm.ReceivedDate} onChange={e => rfSG("ReceivedDate", e.target.value)} />
                      <Input label="Expected Completion Date" type="date" value={sgForm.ExpectedCompletionDate} onChange={e => rfSG("ExpectedCompletionDate", e.target.value)} />
                    </div>
                  </div>

                  {/* Basic Information */}
                  <div>
                    <SH label="Basic Information" />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lCls}>Finish Goods Category</label>
                        <SearchableSelect
                          value={sgForm.CategoryID}
                          onChange={val => { rfSG("CategoryID", val); const cat = dropData.categories.find(c => c.CategoryID === val); if (cat) rfSG("TypeOfProduct", cat.CategoryName); }}
                          options={dropData.categories.map(c => ({ value: c.CategoryID, label: c.CategoryName }))}
                          placeholder="-- Select Finish Goods Category --"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none"
                        />
                      </div>
                      <Input label="Sub Type (Content)" value={sgForm.Content} onChange={e => rfSG("Content", e.target.value)} placeholder="e.g. Pouch, Sachet…" />
                      <div className="col-span-2"><Textarea label="Artwork Description" value={sgForm.ArtWorkDescription} onChange={e => rfSG("ArtWorkDescription", e.target.value)} rows={3} placeholder="Describe the artwork…" /></div>
                      <div className="col-span-2"><Textarea label="Remarks" value={sgForm.Remarks} onChange={e => rfSG("Remarks", e.target.value)} rows={3} placeholder="Internal notes…" /></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Attachments (full width, bottom) ── */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <SH label="Attachments" />
                  <button onClick={() => sgFileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 text-orange-600 hover:bg-orange-50 rounded-lg text-xs font-semibold transition-colors">
                    <Plus size={12} /> Add Files
                  </button>
                  <input ref={sgFileRef} type="file" multiple accept="*" className="hidden"
                    onChange={e => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      const newItems: AttachmentItem[] = Array.from(files).map(file => ({
                        _id: Math.random().toString(36).slice(2),
                        name: file.name, url: URL.createObjectURL(file),
                        mimeType: file.type, remark: "", fileObj: file,
                      }));
                      setSgAttachments(p => [...p, ...newItems]);
                      e.target.value = "";
                    }} />
                </div>
                {sgAttachments.length > 0 ? (
                  <div className="grid grid-cols-6 gap-3">
                    {sgAttachments.map(att => (
                      <AttCard key={att._id} att={att}
                        onRemove={() => setSgAttachments(p => p.filter(a => a._id !== att._id))}
                        onPreview={() => setPreview(att)}
                        onRemarkChange={val => setSgAttachments(p => p.map(a => a._id === att._id ? { ...a, remark: val } : a))} />
                    ))}
                  </div>
                ) : (
                  <div onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const files = e.dataTransfer.files;
                      if (!files || files.length === 0) return;
                      const newItems: AttachmentItem[] = Array.from(files).map(file => ({
                        _id: Math.random().toString(36).slice(2),
                        name: file.name, url: URL.createObjectURL(file),
                        mimeType: file.type, remark: "", fileObj: file,
                      }));
                      setSgAttachments(p => [...p, ...newItems]);
                    }}
                    onClick={() => sgFileRef.current?.click()}
                    className="border-2 border-dashed border-orange-200 rounded-xl p-5 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                    <Paperclip size={20} className="text-orange-300 mx-auto mb-1.5" />
                    <p className="text-xs text-orange-400 font-medium">Drag & drop any file — JPG, PDF, AI, PSD, PNG, etc.</p>
                    <p className="text-[10px] text-orange-300 mt-0.5">or click to browse</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Attachment Preview Modal ═══════════════════════════════════════ */}
      {preview && (
        <Modal open onClose={() => setPreview(null)} title={preview.name} size="xl">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            {preview.mimeType?.startsWith("image/") ? (
              <img src={preview.url} alt={preview.name}
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg" />
            ) : preview.mimeType === "application/pdf" || preview.url?.toLowerCase().endsWith(".pdf") ? (
              <div className="w-full flex flex-col gap-3" style={{ height: "70vh" }}>
                <iframe
                  src={preview.url.startsWith("blob:") ? preview.url : `/api/pdf-proxy?url=${encodeURIComponent(preview.url)}`}
                  title={preview.name}
                  className="w-full flex-1 rounded-xl border border-gray-200 shadow"
                  style={{ height: "calc(70vh - 48px)" }} />
                <a href={preview.url.startsWith("blob:") ? preview.url : `/api/pdf-proxy?url=${encodeURIComponent(preview.url)}`} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition">
                  ↗ Open PDF in new tab
                </a>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Paperclip size={40} className="text-gray-300" />
                <p className="text-sm text-gray-500">Preview not available for this file type.</p>
                <a href={preview.url} download={preview.name}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition">
                  <Download size={14} /> Download {preview.name}
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── YouTube Tutorial Modal ─────────────────────────────────────────── */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-stretch bg-black/60">
          <div className="bg-white w-full h-full overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <PlayCircle size={20} className="text-red-500" />
                <h3 className="text-base font-bold text-gray-800">Artwork Management — Tutorial Videos</h3>
              </div>
              <button onClick={() => setShowVideoModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Videos */}
            <div className="p-6 space-y-6">
              {[
                {
                  title: "Artwork Master — Overview & How to Create",
                  videoId: "rh8tHmYkya0",
                  description: "Is video mein aap seekhenge ki Artwork Master kaise create karte hain, fields kya hain aur catalog se kaise link karte hain.",
                },
                // ↓ Aur videos add karne ke liye yahan copy karein
                // {
                //   title: "Artwork Management — Approval Flow",
                //   videoId: "YOUR_VIDEO_ID_HERE",
                //   description: "Description here",
                // },
              ].map((v, i) => (
                <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-semibold text-gray-800">{v.title}</p>
                    {v.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{v.description}</p>
                    )}
                  </div>
                  <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${v.videoId}?rel=0`}
                      title={v.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowVideoModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
