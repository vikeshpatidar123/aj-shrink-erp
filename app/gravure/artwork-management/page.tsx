"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Pencil, Trash2, X, Check, Loader2, Eye, EyeOff,
  FileText, Image as ImgIcon, Download, Paperclip, RefreshCw,
  Link2, ChevronDown, ChevronRight, ChevronLeft, Package, Filter, Library,
} from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { useCategories } from "@/context/CategoriesContext";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

// ─── API ─────────────────────────────────────────────────────────────────────
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in").replace(/\/$/, "");
const ART  = `${BASE}/api/artworkManagement`;
const CLDN = `${BASE}/api/cloudinary/sign`;

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

// ─── Cloudinary upload ────────────────────────────────────────────────────────
async function uploadFile(file: File) {
  const { signature, timestamp, cloudName, apiKey } = await (await fetch(CLDN, { headers: authHeaders() })).json();
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const resourceType = isPdf ? "raw" : "image";
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", apiKey);
  fd.append("timestamp", String(timestamp));
  fd.append("signature", signature);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: "POST", body: fd });
  const data = await r.json();
  return { url: data.secure_url as string, name: file.name, mimeType: file.type || (isPdf ? "application/pdf" : "image/png") };
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
});

// ─── Shared input style ───────────────────────────────────────────────────────
const iCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";
const lCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-3 pb-1 border-b border-indigo-100">{label}</p>
);

// ─── Attachment card ──────────────────────────────────────────────────────────
function AttCard({ att, onRemove, onPreview }: {
  att: AttachmentItem;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const isPdf = att.mimeType === "application/pdf" || att.url?.toLowerCase().endsWith(".pdf");
  const isImg = att.mimeType?.startsWith("image/");

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
      <div className="px-2 py-1.5">
        <p className="text-[11px] text-gray-700 truncate font-medium" title={att.name}>{att.name}</p>
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
  const [activeTab, setActiveTab] = useState<"master" | "management" | "library">("master");

  const { categories: catWithDetails } = useCategories();

  // ─── Data ─────────────────────────────────────────────────────────────────
  const [list,     setList]     = useState<ArtworkRow[]>([]);
  const [dropData, setDropData] = useState<DropdownData>({ clients: [], employees: [], categories: [] });
  const [loading,  setLoading]  = useState(false);

  // ─── Artwork Master - Form/Modal ──────────────────────────────────────────
  const [showModal,  setShowModal]  = useState(false);
  const [editMode,   setEditMode]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");
  const [form,       setForm]       = useState<FormState>(blankForm());
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading,  setUploading]  = useState(false);
  const [contentPickerOpen, setContentPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<AttachmentItem | null>(null);

  // ─── Artwork Management - detail panel ───────────────────────────────────
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, ArtworkRow>>({});
  const [attMap, setAttMap] = useState<Record<string, AttachmentItem[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

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
  };

  const ARTWORK_STAGES = [
    "Artwork Pending", "Artwork Received", "Design In Progress",
    "Brand Approval Sent", "Brand Approved", "LSD Shade Approved",
    "Cylinder Ordered", "Cylinder Received", "Released to Production",
  ];

  const [libRows,       setLibRows]       = useState<LibRow[]>([]);
  const [libLoading,    setLibLoading]    = useState(false);
  const [libLoaded,     setLibLoaded]     = useState(false);
  const [libShowFilter, setLibShowFilter] = useState(true);
  const [libSearch,     setLibSearch]     = useState("");
  const [libUpdating,   setLibUpdating]   = useState<string | null>(null);
  const [libFilters,    setLibFilters]    = useState({
    customer: "", jobName: "", brand: "", packSize: "", category: "",
    substrate: "", designType: "", noOfColors: "", colorName: "",
    machine: "", cylType: "", cylStatus: "", cylVendor: "",
    artworkStage: "", brandApproved: "", lsdApproved: "", cylReceived: "",
  });

  // ─── Search ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");

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
      ArtworkID:                row.ArtworkID                    ?? "",
      JobName:                  row.ProductName                  ?? "",
      LedgerID:                 row.LedgerID                     ?? "",
      CategoryID:               row.CategoryID                   ?? "",
      SalesEmployeeID:          row.SalesEmployeeID              ?? "",
      ClientArtWorkNo:          row.ClientArtWorkNo              ?? "",
      ArtWorkDescription:       row.ArtWorkDescription           ?? "",
      ArtworkCost:              row.ArtWorkCost                  ?? "",
      ReceivedDate:             row.ReceivedDate                 ?? "",
      ExpectedCompletionDate:   row.ExpectedCompletionDate       ?? "",
      DocumentType:             row.DocumentType                 || "Direct",
      DocumentNo:               row.DocumentNo                   ?? "",
      DocumentDate:             row.DocumentDate                 ?? "",
      JobQty:                   row.JobQty                       ?? "",
      JobSize:                  row.JobSize                      ?? "",
      PaperDetails:             row.PaperDetails                 ?? "",
      MachineName:              row.MachineName                  ?? "",
      DesignSide:               row.DesignSide                   || "Single Side",
      TypeOfProduct:            row.TypeOfProduct || dropData.categories.find(c => c.CategoryID === (row.CategoryID ?? ""))?.CategoryName || "",
      Content:                  row.Content                      ?? "",
      PackSize:                 row.PackSize                     ?? "",
      BrandName:                row.BrandName                    ?? "",
      ProductType:              row.ProductType                  ?? "",
      SkuType:                  row.SkuType                      ?? "",
      BottleType:               row.BottleType                   ?? "",
      AddressType:              row.AddressType                  ?? "",
      ArtworkName:              row.ArtworkName                  ?? "",
      SpecialSpecs:             row.SpecialSpecs                 ?? "",
    });

    // Load attachments for this artwork
    try {
      const atts = await apiFetch<{ FileID: string; AttachedFileName: string; AttachedFileRemark: string }[]>(
        `${ART}/attachments/${row.ArtworkID}`
      );
      setAttachments((Array.isArray(atts) ? atts : []).map(a => ({
        _id: a.FileID,
        name: a.AttachedFileName,
        url: a.AttachedFileName,
        mimeType: a.AttachedFileName.toLowerCase().endsWith(".pdf") ? "application/pdf"
                : /\.(jpe?g|png|gif|webp)$/i.test(a.AttachedFileName) ? "image/jpeg" : "application/octet-stream",
        remark: a.AttachedFileRemark,
      })));
    } catch { setAttachments([]); }
    setShowModal(true);
  };

  // ─── Upload files ─────────────────────────────────────────────────────────
  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newAtts: AttachmentItem[] = [];
    for (const file of Array.from(files)) {
      try {
        const { url, name, mimeType } = await uploadFile(file);
        newAtts.push({ _id: Math.random().toString(36).slice(2), name, url, mimeType, remark: "" });
      } catch { /* skip failed */ }
    }
    setAttachments(p => [...p, ...newAtts]);
    setUploading(false);
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.JobName.trim()) { setFormError("Product Name is required."); return; }
    if (!form.LedgerID) { setFormError("Client is required."); return; }
    if (!form.CategoryID) { setFormError("Category is required."); return; }

    setSaving(true); setFormError("");
    const payload = {
      ...form,
      Attachments: attachments.map(a => ({ AttachedFileName: a.url, AttachedFileRemark: a.remark })),
    };

    try {
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
      } catch {} finally { setLoadingDetail(null); }
    }
  };

  const rf = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

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
          <button onClick={activeTab === "library" ? loadLibrary : loadList}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
            <RefreshCw size={15} className={
              (libLoading && activeTab === "library") ? "animate-spin" : ""
            } />
          </button>
          {activeTab === "master" && (
            <Button icon={<Plus size={16} />} onClick={openAdd}>New Artwork</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ["master",     "Artwork Master"],
          ["management", "Artwork Management"],
          ["library",    "Artwork Library"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => {
            setActiveTab(key);
            if (key === "library" && !libLoaded) loadLibrary();
          }}
            className={`px-5 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Search — hidden on library tab (it has its own filters) */}
      {activeTab !== "library" && (
        <div className="flex items-center gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search artwork no., product name, client, category…"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      )}

      {/* ═══ TAB: Artwork Master ═══════════════════════════════════════════ */}
      {activeTab === "master" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No artworks found. Click "New Artwork" to create one.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Artwork No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Product Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Received</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Expected</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Catalog</th>
                  <th className="px-4 py-3 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.ArtworkID} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-indigo-700">{row.ArtworkNo}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{row.ProductName}</td>
                    <td className="px-4 py-3 text-gray-600">{row.ClientName}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">{row.CategoryName}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{row.ReceivedDate || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{row.ExpectedCompletionDate || "—"}</td>
                    <td className="px-4 py-3">
                      {row.ProductMasterID && String(row.ProductMasterID) !== "0" ? (
                        <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                          <Link2 size={11} /> Linked
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Not linked</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="sm" icon={<Pencil size={12} />} onClick={() => openEdit(row)}>Edit</Button>
                        <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => deleteArtwork(row)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
            const atts   = attMap[row.ArtworkID] ?? [];
            const hasPC  = detail && String(detail.ProductMasterID || 0) !== "0";

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
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Product Name</p>
                      <p className="font-semibold text-gray-800 text-sm truncate">{row.ProductName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Client</p>
                      <p className="text-gray-600 text-sm truncate">{row.ClientName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Category</p>
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">{row.CategoryName}</span>
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
                    <Button variant="ghost" size="sm" icon={<Pencil size={12} />} onClick={() => openEdit(row)}>Edit</Button>
                    <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => deleteArtwork(row)}>Del</Button>
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
                                <AttCard key={att._id} att={att} onRemove={() => {}}
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

        const uCustomers  = uniq("Customer");
        const uJobNames   = uniq("JobName");
        const uBrands     = uniq("Brand");
        const uPackSizes  = uniq("PackSize");
        const uCategories = uniq("CategoryName");
        const uSubstrates = uniq("Substrate");
        const uTypes      = uniq("TypeOfProduct");
        const uColors     = uniq("NoOfColors");
        const uColorNames = [...new Set(
          libRows.flatMap(r => (r.ColorName || "").split(",").map(c => c.trim()).filter(Boolean))
        )].sort();
        const uMachines   = uniq("Machine");
        const uCylTypes   = [...new Set(
          libRows.flatMap(r => (r.CylType || "").split(",").map(c => c.trim()).filter(Boolean))
        )].sort();
        const uCylStatuses= [...new Set(
          libRows.flatMap(r => (r.CylStatus || "").split(",").map(c => c.trim()).filter(Boolean))
        )].sort();
        const uVendors    = uniq("CylVendor");

        // ── apply all filters ─────────────────────────────────────────────
        const lf = libFilters;
        const filtered = libRows.filter(r => {
          const q = libSearch.toLowerCase();
          const matchSearch = !q || [r.WoNo,r.OrderNo,r.Customer,r.JobName,r.Brand,r.ArtworkNo,r.ColorName,r.ProductCode]
            .some(v => v?.toLowerCase().includes(q));
          const stage = r.ArtworkStage || "Artwork Pending";
          const brandAppr  = ARTWORK_STAGES.indexOf(stage) >= ARTWORK_STAGES.indexOf("Brand Approved");
          const lsdAppr    = ARTWORK_STAGES.indexOf(stage) >= ARTWORK_STAGES.indexOf("LSD Shade Approved");
          const cylRcvd    = ARTWORK_STAGES.indexOf(stage) >= ARTWORK_STAGES.indexOf("Cylinder Received");

          return matchSearch
            && (!lf.customer     || r.Customer    === lf.customer)
            && (!lf.brand        || r.Brand       === lf.brand)
            && (!lf.packSize     || r.PackSize    === lf.packSize)
            && (!lf.category     || r.CategoryName=== lf.category)
            && (!lf.substrate    || r.Substrate   === lf.substrate)
            && (!lf.designType   || r.TypeOfProduct=== lf.designType)
            && (!lf.noOfColors   || r.NoOfColors  === lf.noOfColors)
            && (!lf.colorName    || r.ColorName?.split(",").some(c => c.trim() === lf.colorName))
            && (!lf.machine      || r.Machine     === lf.machine)
            && (!lf.cylType      || r.CylType     === lf.cylType)
            && (!lf.cylStatus    || r.CylStatus?.split(",").some(c => c.trim() === lf.cylStatus))
            && (!lf.cylVendor    || r.CylVendor   === lf.cylVendor)
            && (!lf.artworkStage || stage          === lf.artworkStage)
            && (!lf.brandApproved || (lf.brandApproved === "Yes" ? brandAppr : !brandAppr))
            && (!lf.lsdApproved   || (lf.lsdApproved   === "Yes" ? lsdAppr   : !lsdAppr))
            && (!lf.cylReceived   || (lf.cylReceived    === "Yes" ? cylRcvd   : !cylRcvd));
        });

        // ── summary counts ────────────────────────────────────────────────
        const distinctArtworks = (stagePred: (s: string) => boolean) => {
          const seen = new Set<string>();
          libRows.forEach(r => {
            const s = r.ArtworkStage || "Artwork Pending";
            if (stagePred(s)) seen.add(r.ArtworkID);
          });
          return seen.size;
        };
        const totalColors    = libRows.reduce((sum, r) => sum + (Number(r.NoOfColors) || 0), 0);
        const artPending     = distinctArtworks(s => s === "Artwork Pending");
        const inProgress     = distinctArtworks(s => ["Artwork Received","Design In Progress","Brand Approval Sent"].includes(s));
        const brandApproved  = distinctArtworks(s => s === "Brand Approved");
        const cylReceived    = distinctArtworks(s => s === "Cylinder Received");
        const released       = distinctArtworks(s => s === "Released to Production");

        const setLF = (k: keyof typeof libFilters, v: string) =>
          setLibFilters(f => ({ ...f, [k]: v }));

        // ── stage badge color ────────────────────────────────────────────
        const stageBadge = (s: string) => {
          const idx = ARTWORK_STAGES.indexOf(s);
          if (idx < 0)  return "bg-gray-100 text-gray-500";
          if (idx === 0) return "bg-red-100 text-red-700";
          if (idx <= 2)  return "bg-yellow-100 text-yellow-700";
          if (idx <= 4)  return "bg-blue-100 text-blue-700";
          if (idx <= 6)  return "bg-purple-100 text-purple-700";
          return "bg-green-100 text-green-700";
        };

        const selCls = "px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-400 bg-white w-full";

        return (
          <div className="space-y-4">

            {/* ── 6 Summary Cards ── */}
            <div className="grid grid-cols-6 gap-3">
              {[
                { label: "TOTAL COLORS",   value: totalColors,   color: "from-indigo-500 to-indigo-600" },
                { label: "ART. PENDING",   value: artPending,    color: "from-red-400 to-red-500" },
                { label: "IN PROGRESS",    value: inProgress,    color: "from-yellow-400 to-orange-500" },
                { label: "BRAND APPROVED", value: brandApproved, color: "from-blue-500 to-blue-600" },
                { label: "CYL. RECEIVED",  value: cylReceived,   color: "from-purple-500 to-purple-600" },
                { label: "RELEASED",       value: released,      color: "from-green-500 to-green-600" },
              ].map(c => (
                <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-xl p-4 text-white shadow-sm`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{c.label}</p>
                  <p className="text-3xl font-black mt-1">{c.value}</p>
                </div>
              ))}
            </div>

            {/* ── Filter Panel ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* filter header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Filter size={14} className="text-indigo-500" />
                  Filters
                  {Object.values(libFilters).some(Boolean) && (
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full">
                      {Object.values(libFilters).filter(Boolean).length} active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {Object.values(libFilters).some(Boolean) && (
                    <button onClick={() => setLibFilters({
                      customer:"",jobName:"",brand:"",packSize:"",category:"",substrate:"",
                      designType:"",noOfColors:"",colorName:"",machine:"",cylType:"",
                      cylStatus:"",cylVendor:"",artworkStage:"",brandApproved:"",lsdApproved:"",cylReceived:"",
                    })} className="text-xs text-red-500 hover:text-red-700 font-medium">
                      Clear All
                    </button>
                  )}
                  <button onClick={() => setLibShowFilter(v => !v)}
                    className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:text-indigo-800">
                    {libShowFilter ? "Hide Filters" : "Show Filters"}
                    {libShowFilter ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                </div>
              </div>

              {libShowFilter && (
                <div className="p-4 space-y-3">
                  {/* Row 1: Search + Customer + Brand + Pack Size + Category + Substrate */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <input value={libSearch} onChange={e => setLibSearch(e.target.value)}
                      placeholder="Search WO, customer, brand, artwork…"
                      className="col-span-2 md:col-span-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-400" />
                    <select value={lf.customer} onChange={e => setLF("customer", e.target.value)} className={selCls}>
                      <option value="">All Customers</option>
                      {uCustomers.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={lf.brand} onChange={e => setLF("brand", e.target.value)} className={selCls}>
                      <option value="">All Brands</option>
                      {uBrands.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={lf.packSize} onChange={e => setLF("packSize", e.target.value)} className={selCls}>
                      <option value="">All Pack Sizes</option>
                      {uPackSizes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={lf.category} onChange={e => setLF("category", e.target.value)} className={selCls}>
                      <option value="">All Categories</option>
                      {uCategories.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={lf.substrate} onChange={e => setLF("substrate", e.target.value)} className={selCls}>
                      <option value="">All Substrates</option>
                      {uSubstrates.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  {/* Row 2: Design Type + No. of Colors + Color Name + Machine + Cyl. Type + Cyl. Status */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <select value={lf.designType} onChange={e => setLF("designType", e.target.value)} className={selCls}>
                      <option value="">All Design Types</option>
                      {uTypes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={lf.noOfColors} onChange={e => setLF("noOfColors", e.target.value)} className={selCls}>
                      <option value="">No. of Colors</option>
                      {uColors.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={lf.colorName} onChange={e => setLF("colorName", e.target.value)} className={selCls}>
                      <option value="">All Color Names</option>
                      {uColorNames.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={lf.machine} onChange={e => setLF("machine", e.target.value)} className={selCls}>
                      <option value="">All Machines</option>
                      {uMachines.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={lf.cylType} onChange={e => setLF("cylType", e.target.value)} className={selCls}>
                      <option value="">All Cyl. Types</option>
                      {uCylTypes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={lf.cylStatus} onChange={e => setLF("cylStatus", e.target.value)} className={selCls}>
                      <option value="">All Cyl. Status</option>
                      {uCylStatuses.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  {/* Row 3: Order Vendor + Artwork Stage + Brand Appr. + LSD Appr. + Cyl. Rcvd */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <select value={lf.cylVendor} onChange={e => setLF("cylVendor", e.target.value)} className={selCls}>
                      <option value="">All Order Vendors</option>
                      {uVendors.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={lf.artworkStage} onChange={e => setLF("artworkStage", e.target.value)} className={selCls}>
                      <option value="">All Artwork Stages</option>
                      {ARTWORK_STAGES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={lf.brandApproved} onChange={e => setLF("brandApproved", e.target.value)} className={selCls}>
                      <option value="">Brand Appr. (All)</option>
                      <option value="Yes">Brand Approved</option>
                      <option value="No">Not Approved</option>
                    </select>
                    <select value={lf.lsdApproved} onChange={e => setLF("lsdApproved", e.target.value)} className={selCls}>
                      <option value="">LSD Appr. (All)</option>
                      <option value="Yes">LSD Approved</option>
                      <option value="No">Not Approved</option>
                    </select>
                    <select value={lf.cylReceived} onChange={e => setLF("cylReceived", e.target.value)} className={selCls}>
                      <option value="">Cyl. Rcvd (All)</option>
                      <option value="Yes">Cyl. Received</option>
                      <option value="No">Not Received</option>
                    </select>
                  </div>

                  <p className="text-[10px] text-gray-400 pt-1">
                    Showing {filtered.length} of {libRows.length} records
                  </p>
                </div>
              )}
            </div>

            {/* ── Data Table ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
              {libLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={28} className="animate-spin text-gray-400" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Library size={36} className="mb-3 text-gray-300" />
                  <p className="text-sm">No artwork records found.</p>
                </div>
              ) : (
                <table className="w-full text-xs min-w-[2000px]">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      {[
                        "#","WO NO","DATE","ORDER NO","CUSTOMER","JOB NAME",
                        "BRAND","PRODUCT","ARTWORK","CATEGORY","SUBSTRATE",
                        "PACK SIZE","TYPE","# CLRS","REPEAT(MM)","WIDTH(MM)",
                        "HEIGHT(MM)","COLORS","STAGE","ACTIONS",
                      ].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const stage = r.ArtworkStage || "Artwork Pending";
                      const stageIdx = ARTWORK_STAGES.indexOf(stage);
                      const isUpdating = libUpdating === r.ArtworkID;
                      return (
                        <tr key={`${r.ArtworkID}-${i}`}
                          className={`border-t border-gray-100 hover:bg-indigo-50/20 ${i % 2 === 0 ? "" : "bg-gray-50/40"}`}>
                          <td className="px-3 py-2 text-gray-400 text-[10px]">{i + 1}</td>
                          <td className="px-3 py-2 font-bold text-indigo-700 whitespace-nowrap">{r.WoNo || "—"}</td>
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.CreatedDate || "—"}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.OrderNo || "—"}</td>
                          <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap max-w-[120px] truncate" title={r.Customer}>{r.Customer || "—"}</td>
                          <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate" title={r.JobName}>{r.JobName || "—"}</td>
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.Brand || "—"}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.ProductCode || "—"}</td>
                          <td className="px-3 py-2 text-indigo-600 font-medium whitespace-nowrap">{r.ArtworkNo || "—"}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded-full text-[10px] font-semibold whitespace-nowrap">{r.CategoryName || "—"}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.Substrate || "—"}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.PackSize || "—"}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.TypeOfProduct || "—"}</td>
                          <td className="px-3 py-2 text-center font-mono text-gray-700">{r.NoOfColors || "—"}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">{r.RepeatMM || "—"}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">{r.WidthMM || "—"}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">{r.HeightMM || "—"}</td>
                          <td className="px-3 py-2 max-w-[180px]">
                            {r.ColorName ? (
                              <div className="flex flex-wrap gap-1">
                                {r.ColorName.split(",").map((c, ci) => {
                                  const name = c.trim();
                                  return name ? (
                                    <span key={ci} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                                      style={{
                                        background: `hsl(${ci * 53 % 360},55%,90%)`,
                                        color: `hsl(${ci * 53 % 360},50%,28%)`,
                                      }}>
                                      {name}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${stageBadge(stage)}`}>
                              {stage}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              {isUpdating ? (
                                <Loader2 size={12} className="animate-spin text-indigo-400" />
                              ) : (
                                <>
                                  <button
                                    disabled={stageIdx <= 0}
                                    onClick={() => updateStage(r.ArtworkID, ARTWORK_STAGES[Math.max(0, stageIdx - 1)])}
                                    className="p-0.5 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed"
                                    title="Previous stage">
                                    <ChevronLeft size={14} />
                                  </button>
                                  <button
                                    disabled={stageIdx >= ARTWORK_STAGES.length - 1}
                                    onClick={() => updateStage(r.ArtworkID, ARTWORK_STAGES[Math.min(ARTWORK_STAGES.length - 1, stageIdx + 1)])}
                                    className="p-0.5 rounded text-gray-400 hover:text-green-600 disabled:opacity-20 disabled:cursor-not-allowed"
                                    title="Next stage">
                                    <ChevronRight size={14} />
                                  </button>
                                  <select
                                    value={stage}
                                    onChange={e => updateStage(r.ArtworkID, e.target.value)}
                                    className="text-[10px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-indigo-300 bg-white max-w-[110px]">
                                    {ARTWORK_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Workflow Pipeline Bar ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Workflow Pipeline</p>
              <div className="flex items-center gap-0 overflow-x-auto pb-1">
                {ARTWORK_STAGES.map((s, i) => {
                  const count = libRows.filter(r => (r.ArtworkStage || "Artwork Pending") === s).length;
                  const colors = [
                    "bg-gray-200 text-gray-600",
                    "bg-blue-100 text-blue-700",
                    "bg-yellow-100 text-yellow-700",
                    "bg-orange-100 text-orange-700",
                    "bg-blue-200 text-blue-800",
                    "bg-teal-100 text-teal-700",
                    "bg-purple-100 text-purple-700",
                    "bg-indigo-100 text-indigo-700",
                    "bg-green-200 text-green-800",
                  ];
                  return (
                    <div key={s} className="flex items-center shrink-0">
                      <div className={`flex flex-col items-center px-3 py-2 rounded-lg min-w-[110px] ${colors[i]}`}>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight">{s}</span>
                        <span className="text-lg font-black mt-0.5">{count}</span>
                      </div>
                      {i < ARTWORK_STAGES.length - 1 && (
                        <div className="w-5 h-0.5 bg-gray-300 relative flex items-center justify-center shrink-0">
                          <span className="absolute text-gray-400" style={{ fontSize: 10 }}>›</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ New / Edit Modal ═══════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[93vh] overflow-y-auto mx-4">
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

            <div className="p-6 space-y-6">
              {formError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
              )}

              {/* ── Basic Info ── */}
              <div>
                <SH label="Basic Information" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={lCls}>Product Name *</label>
                    <input value={form.JobName} onChange={e => rf("JobName", e.target.value)}
                      placeholder="e.g. Parle-G 100g Biscuit" className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>Client / Customer *</label>
                    <select value={form.LedgerID} onChange={e => rf("LedgerID", e.target.value)} className={iCls}>
                      <option value="">-- Select Client --</option>
                      {dropData.clients.map(c => <option key={c.LedgerID} value={c.LedgerID}>{c.LedgerName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Category (Type of Product) *</label>
                    <select value={form.CategoryID} onChange={e => {
                      rf("CategoryID", e.target.value);
                      rf("Content", "");
                      const cat = dropData.categories.find(c => c.CategoryID === e.target.value);
                      if (cat) rf("TypeOfProduct", cat.CategoryName);
                    }} className={iCls}>
                      <option value="">-- Select Category --</option>
                      {dropData.categories.map(c => <option key={c.CategoryID} value={c.CategoryID}>{c.CategoryName}</option>)}
                    </select>
                  </div>
                  {/* Sub Type (Content) picker — shown when category is selected */}
                  {form.CategoryID && (() => {
                    const selCat = catWithDetails.find(c => c.id === form.CategoryID);
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
                  <div>
                    <label className={lCls}>Sales Representative</label>
                    <select value={form.SalesEmployeeID} onChange={e => rf("SalesEmployeeID", e.target.value)} className={iCls}>
                      <option value="">-- Select Sales Rep --</option>
                      {dropData.employees.map(e => <option key={e.SalesEmployeeID} value={e.SalesEmployeeID}>{e.LedgerName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Client Artwork No.</label>
                    <input value={form.ClientArtWorkNo} onChange={e => rf("ClientArtWorkNo", e.target.value)}
                      placeholder="Client's reference number" className={iCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={lCls}>Artwork Description</label>
                    <textarea value={form.ArtWorkDescription} onChange={e => rf("ArtWorkDescription", e.target.value)}
                      rows={2} placeholder="Describe the artwork…" className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>Artwork Cost (₹)</label>
                    <input type="number" value={form.ArtworkCost} onChange={e => rf("ArtworkCost", e.target.value)}
                      placeholder="0.00" className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>Design Side</label>
                    <select value={form.DesignSide} onChange={e => rf("DesignSide", e.target.value)} className={iCls}>
                      <option value="Single Side">Single Side</option>
                      <option value="Double Side">Double Side</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Dates ── */}
              <div>
                <SH label="Dates" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lCls}>Received Date</label>
                    <input type="date" value={form.ReceivedDate} onChange={e => rf("ReceivedDate", e.target.value)} className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>Expected Completion Date</label>
                    <input type="date" value={form.ExpectedCompletionDate} onChange={e => rf("ExpectedCompletionDate", e.target.value)} className={iCls} />
                  </div>
                </div>
              </div>

              {/* ── Document Reference ── */}
              <div>
                <SH label="Document Reference" />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={lCls}>Document Type</label>
                    <select value={form.DocumentType} onChange={e => rf("DocumentType", e.target.value)} className={iCls}>
                      <option value="Direct">Direct</option>
                      <option value="Quotation">Quotation</option>
                      <option value="ProductionWorkOrder">Work Order</option>
                      <option value="Order">Order</option>
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Document No.</label>
                    <input value={form.DocumentNo} onChange={e => rf("DocumentNo", e.target.value)}
                      placeholder="Doc. reference no." className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>Document Date</label>
                    <input type="date" value={form.DocumentDate} onChange={e => rf("DocumentDate", e.target.value)} className={iCls} />
                  </div>
                </div>
              </div>

              {/* ── Job Details ── */}
              <div>
                <SH label="Job Details" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lCls}>Job Quantity</label>
                    <input value={form.JobQty} onChange={e => rf("JobQty", e.target.value)}
                      placeholder="e.g. 5000 pcs" className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>Job Size</label>
                    <input value={form.JobSize} onChange={e => rf("JobSize", e.target.value)}
                      placeholder="e.g. 200mm x 300mm" className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>Paper / Substrate Details</label>
                    <input value={form.PaperDetails} onChange={e => rf("PaperDetails", e.target.value)}
                      placeholder="e.g. BOPP 20μm" className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>Machine Name</label>
                    <input value={form.MachineName} onChange={e => rf("MachineName", e.target.value)}
                      placeholder="Machine to be used" className={iCls} />
                  </div>
                </div>
              </div>

              {/* ── Product Details ── */}
              <div>
                <SH label="Product Details" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lCls}>Type of Product</label>
                    <select value={form.TypeOfProduct} onChange={e => rf("TypeOfProduct", e.target.value)} className={iCls}>
                      <option value="">-- Select Type --</option>
                      {dropData.categories.map(c => <option key={c.CategoryID} value={c.CategoryName}>{c.CategoryName}</option>)}
                      {form.TypeOfProduct && !dropData.categories.some(c => c.CategoryName === form.TypeOfProduct) && (
                        <option value={form.TypeOfProduct}>{form.TypeOfProduct}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Pack Size</label>
                    <select value={form.PackSize} onChange={e => rf("PackSize", e.target.value)} className={iCls}>
                      <option value="">-- Select Pack Size --</option>
                      {fmOptions.packSizes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Brand Name</label>
                    <select value={form.BrandName} onChange={e => rf("BrandName", e.target.value)} className={iCls}>
                      <option value="">-- Select Brand --</option>
                      {fmOptions.brandNames.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Product Type</label>
                    <select value={form.ProductType} onChange={e => rf("ProductType", e.target.value)} className={iCls}>
                      <option value="">-- Select Product Type --</option>
                      {fmOptions.productTypes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>SKU Type</label>
                    <select value={form.SkuType} onChange={e => rf("SkuType", e.target.value)} className={iCls}>
                      <option value="">-- Select SKU Type --</option>
                      {fmOptions.skuTypes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Bottle Type</label>
                    <select value={form.BottleType} onChange={e => rf("BottleType", e.target.value)} className={iCls}>
                      <option value="">-- Select Bottle Type --</option>
                      {fmOptions.bottleTypes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Address Type</label>
                    <select value={form.AddressType} onChange={e => rf("AddressType", e.target.value)} className={iCls}>
                      <option value="">-- Select Address Type --</option>
                      {fmOptions.addressTypes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Artwork Name</label>
                    <input value={form.ArtworkName} onChange={e => rf("ArtworkName", e.target.value)}
                      placeholder="e.g. Parle-G Front Label v3" className={iCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={lCls}>Special Specifications</label>
                    <textarea value={form.SpecialSpecs} onChange={e => rf("SpecialSpecs", e.target.value)}
                      rows={2} placeholder="Any special requirements or notes…" className={iCls} />
                  </div>
                </div>
              </div>

              {/* ── Attachments ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <SH label="Attachments" />
                  <button onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 text-orange-600 hover:bg-orange-50 rounded-lg text-xs font-semibold transition-colors">
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    {uploading ? "Uploading…" : "Add Files"}
                  </button>
                  <input ref={fileRef} type="file" multiple accept="*" className="hidden"
                    onChange={e => addFiles(e.target.files)} />
                </div>

                {attachments.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {attachments.map(att => (
                      <AttCard key={att._id} att={att}
                        onRemove={() => setAttachments(p => p.filter(a => a._id !== att._id))}
                        onPreview={() => setPreview(att)} />
                    ))}
                  </div>
                ) : (
                  <div onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-orange-200 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                    <Paperclip size={22} className="text-orange-300 mx-auto mb-2" />
                    <p className="text-xs text-orange-400 font-medium">Drag & drop any file — JPG, PDF, AI, PSD, PNG, etc.</p>
                    <p className="text-[10px] text-orange-300 mt-1">or click to browse</p>
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
                  src={`/api/pdf-proxy?url=${encodeURIComponent(preview.url)}`}
                  title={preview.name}
                  className="w-full flex-1 rounded-xl border border-gray-200 shadow"
                  style={{ height: "calc(70vh - 48px)" }} />
                <a href={`/api/pdf-proxy?url=${encodeURIComponent(preview.url)}`} target="_blank" rel="noreferrer"
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
    </div>
  );
}
