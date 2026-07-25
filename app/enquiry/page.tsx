"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Eye, Pencil, Trash2, ClipboardList, ArrowRight, Check, X, RefreshCw, Copy } from "lucide-react";
import { PlyConsumableItem } from "@/data/dummyData";
import { useUnit } from "@/context/UnitContext";
import { useEnquiries, CombinedEnquiry, ProcessRef } from "@/context/EnquiryContext";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiGetSafe } from "@/lib/api";
import { DataGrid } from "@/components/datagrid/DataGrid";
import { createActionsColumn } from "@/components/datagrid/columns/ActionsColumn";
import { ColumnDef } from "@tanstack/react-table";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { DimensionDiagram, DimensionInputPanel, DimValues, CONTENT_TYPE_CONFIG } from "@/components/gravure/DimensionDiagram";
import { useMasters } from "@/context/MastersContext";
import SearchableSelect from "@/components/ui/SearchableSelect";

type BU = "Extrusion" | "Gravure";

// ─── Types ───────────────────────────────────────────────
type Customer = { LedgerID: string; LedgerName: string; MailingName?: string };
type Category = { CategoryID: string; CategoryName: string };
type Content  = { ContentID: string; ContentName: string; ContentCaption: string };
type SalesPerson = { LedgerID: string; LedgerName: string };
type Process = { ProcessID: string; ProcessName: string };

// ─── Blank form ───────────────────────────────────────────────
const blank: Omit<CombinedEnquiry, "id" | "enquiryNo"> = {
  date: new Date().toISOString().slice(0, 10),
  businessUnit: "Gravure",
  customerId: "", customerName: "",
  jobName: "", quantity: 0, uom: "Meter",
  status: "Pending", remarks: "",
  productId: "", productName: "", width: 0, thickness: 0,
  printingRequired: false, printingColors: 0,
  substrate: "", repeatLength: 0, noOfColors: 6,
  printType: "Surface Print", structureType: "",
  cylinderStatus: "New", designRef: "", specialFinish: "",
  categoryId: "", categoryName: "", selectedContent: "",
  salesPersonId: "", salesPersonName: "", salesType: "Domestic", concernPerson: "",
  planHeight: 0, planWidth: 0, frontColors: 4, backColors: 2,
  wastageType: "Machine Default", finishedFormat: "Roll Form", labelRoll: 0,
  topSeal: 0, bottomSeal: 0, sideSeal: 0, centerSeal: 0,
  gusset: 0, sideGusset: 0, sealWidth: 0, seamingArea: 0, transparentArea: 0,
  processes: [], plys: [], secondaryLayers: [],
};

const BU_BADGE: Record<BU, string> = {
  Extrusion: "bg-blue-50 text-blue-700 border-blue-200",
  Gravure: "bg-purple-50 text-purple-700 border-purple-200",
};

const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100 pb-1.5 mb-3">{label}</p>
);

const SALES_TYPES = ["Domestic", "Exporter", "Service", "Direct"];

export default function EnquiryPage() {
  const { unit: globalUnit } = useUnit();
  const { enquiries: data, loading: listLoading, saveEnquiry, deleteEnquiry, refreshEnquiries } = useEnquiries();
  const { showToast } = useToast();

  // ── Date filter state ──────────────────────────────────
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo,   setDateTo]   = useState<Date | null>(null);

  // ── Real item masters from API ─────────────────────────
  const { filmItems: apiFilmItems, inkItems: apiInkItems } = useMasters();

  const normalizeInkGroup = (g: string): string => {
    const u = (g || "").toUpperCase();
    if (u.includes("INK")) return "Ink";
    if (u.includes("SOLVENT")) return "Solvent";
    if (u.includes("ADHESIVE")) return "Adhesive";
    if (u.includes("HARDNER") || u.includes("HARDENER")) return "Hardner";
    return g;
  };

  const FILM_ITEMS = useMemo(() => {
    const seen = new Set<string>();
    return apiFilmItems
      .map(i => ({
        id: String(i.ItemID),
        name: i.ItemDisplayName || i.ItemName,
        group: "Film",
        subGroup: i.ItemSubGroupName,
        density: String(i.Density ?? 0),
        thickness: String(i.Thickness ?? 0),
        active: true,
      }))
      .filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
  }, [apiFilmItems]);

  const INK_ITEMS = useMemo(() => {
    const seen = new Set<string>();
    return apiInkItems
      .map(i => ({
        id: String(i.ItemID),
        name: i.ItemName + (i.InkColour ? "/" + i.InkColour : ""),
        group: normalizeInkGroup(i.ItemGroupName),
        subGroup: i.ItemSubGroupName,
        active: true,
        DryGsM: i.DryGsM,
        SolidPerc: i.SolidPerc,
      }))
      .filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
  }, [apiInkItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => [...FILM_ITEMS, ...INK_ITEMS], [FILM_ITEMS, INK_ITEMS]);

  // ── Master data from API ───────────────────────────────
  const [customers, setCustomers]       = useState<Customer[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [allProcesses, setAllProcesses] = useState<Process[]>([]);
  const [availableContents, setAvailableContents] = useState<Content[]>([]);
  const [nextEnquiryNo, setNextEnquiryNo] = useState("—");

  // ── Modal / form state ─────────────────────────────────
  const [modalOpen, setModal]     = useState(false);
  const [viewRow, setViewRow]     = useState<CombinedEnquiry | null>(null);
  const [editing, setEditing]     = useState<CombinedEnquiry | null>(null);
  const [form, setForm]           = useState<Omit<CombinedEnquiry, "id" | "enquiryNo">>({ ...blank });
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [dimValues, setDimValues] = useState<DimValues>({});

  const f = (k: keyof typeof blank, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const patchDim = (patch: Partial<DimValues>) => setDimValues(prev => ({ ...prev, ...patch }));

  const normalizeContentType = (content: string): string => {
    const c = (content || "").toLowerCase().trim();
    if (!c) return content;
    if (c === "flat bottom pouch")  return "Flat Bottom Pouch";
    if (c === "stand up pouch")     return "Stand Up Pouch";
    if (c === "3 side seal sachet") return "3 Side Seal Sachet";
    if (c === "gusset bag")         return "Gusset Bag";
    if (c === "center seal pouch")  return "Center Seal Pouch";
    if (c.includes("sleeve") && !c.includes("stretch"))                            return "Sleeve — Shrink";
    if (c.includes("sleeve") && c.includes("stretch"))                             return "Sleeve — Stretch";
    if (c.includes("wrap around"))                                                  return "Wrap Around Labels";
    if (c.includes("shrink label") || c.includes("shrink film"))                   return "Shrink Labels";
    if (c.includes("cut") && c.includes("stack"))                                  return "Cut & Stack Labels";
    if (c.includes("in-mould") || c.includes("in mould"))                         return "In-Mould Labels";
    if (c.includes("both side") && c.includes("gusset"))                           return "Gusset Bag";
    if (c.includes("flat bottom") || (c.includes("3d") && c.includes("pouch")))   return "Flat Bottom Pouch";
    if (c.includes("3 side") || c.includes("3-side") || c.includes("three side") || c.includes("sachet")) return "3 Side Seal Sachet";
    if (c.includes("center seal") || c.includes("centre seal"))                    return "Center Seal Pouch";
    if (c.includes("standup") || c.includes("stand up") || c.includes("stand-up")) return "Stand Up Pouch";
    if (c.includes("zipper") && !c.includes("stand"))                              return "Stand Up Pouch";
    if (c.includes("gusset") || c.includes("side gusset"))                         return "Gusset Bag";
    if (c.includes("pouch") || c.includes("doy"))                                  return "3 Side Seal Sachet";
    if (c.includes("lldpe") || c.includes("ldpe"))                                 return "Shrink Labels";
    if (c.includes("laminate"))                                                     return "Laminate Roll";
    if (c.includes("roll form") || c.includes("roll") || c.includes("film"))       return "Laminate Roll";
    if (c.includes("bag") || c.includes("sack"))                                   return "Gusset Bag";
    if (c.includes("label") || c.includes("sticker") || c.includes("tag"))         return "Wrap Around Labels";
    return content;
  };
  const getDisplayContentType = (content: string): string =>
    CONTENT_TYPE_CONFIG[content] ? content : normalizeContentType(content);

  // ── Load enquiries + masters on mount ─────────────────
  useEffect(() => { refreshEnquiries(); }, [refreshEnquiries]);

  useEffect(() => {
    apiGetSafe<Customer[]>("api/gravureestimationShrink/getcustomerlist")
      .then(d => setCustomers(Array.isArray(d) ? d : []));

    apiGetSafe<Category[]>("api/categorymasterShrink/getcategory")
      .then(d => setCategories(Array.isArray(d) ? d : []));

    apiGetSafe<SalesPerson[]>("api/gravureEnquiryShrink/getsalespersonlist")
      .then(d => setSalesPersons(Array.isArray(d) ? d : []));

    apiGetSafe<Process[]>("api/productcataloggravureShrink/getprocesslist")
      .then(d => setAllProcesses(Array.isArray(d) ? d : []));
  }, []);

  const fetchContents = useCallback(async (categoryId: string) => {
    setAvailableContents([]);
    if (!categoryId) return;
    const d = await apiGetSafe<Content[]>(`api/categorymasterShrink/getcategoryallocatedcontents/${categoryId}`);
    setAvailableContents(Array.isArray(d) ? d : []);
  }, []);

  // ── Ply helpers ──────────────────────────────────────────────
  const addPly = () => {
    const layers = [...(form.secondaryLayers || [])];
    layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
    f("secondaryLayers", layers);
  };
  const removePly = (idx: number) => {
    f("secondaryLayers", (form.secondaryLayers || []).filter((_, i) => i !== idx));
  };
  const onPlyTypeChange = (idx: number, plyType: string) => {
    const layers = [...(form.secondaryLayers || [])];
    layers[idx] = { ...layers[idx], plyType, itemId: "", itemName: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] };
    f("secondaryLayers", layers);
  };
  const addPlyConsumable = (idx: number) => {
    const layers = [...(form.secondaryLayers || [])];
    layers[idx].consumableItems = [...layers[idx].consumableItems, { consumableId: Math.random().toString(), fieldDisplayName: "", itemGroup: "", itemSubGroup: "", itemId: "", itemName: "", gsm: 0, rate: 0, coveragePct: 100 }];
    f("secondaryLayers", layers);
  };
  const removePlyConsumable = (plyIdx: number, ciIdx: number) => {
    const layers = [...(form.secondaryLayers || [])];
    layers[plyIdx].consumableItems = layers[plyIdx].consumableItems.filter((_, i) => i !== ciIdx);
    f("secondaryLayers", layers);
  };
  const updatePlyConsumable = (plyIdx: number, ciIdx: number, patch: Partial<PlyConsumableItem>) => {
    const layers = [...(form.secondaryLayers || [])];
    const ci = [...layers[plyIdx].consumableItems];
    ci[ciIdx] = { ...ci[ciIdx], ...patch };
    layers[plyIdx].consumableItems = ci;
    f("secondaryLayers", layers);
  };
  const clonePlyConsumable = (plyIdx: number, ciIdx: number) => {
    const layers = [...(form.secondaryLayers || [])];
    const layer = { ...layers[plyIdx] };
    const source = layer.consumableItems[ciIdx];
    const clone: PlyConsumableItem = { ...source, consumableId: Math.random().toString(), isClone: true };
    layer.consumableItems = [
      ...layer.consumableItems.slice(0, ciIdx + 1),
      clone,
      ...layer.consumableItems.slice(ciIdx + 1),
    ];
    layers[plyIdx] = layer;
    f("secondaryLayers", layers);
  };

  const contentSelected = !!form.selectedContent;

  // Filter table by global unit
  const displayData = data.filter(d => d.businessUnit === globalUnit);

  // Filter by date range
  const dateFilteredData = useMemo(() => {
    if (!dateFrom && !dateTo) return displayData;
    return displayData.filter(row => {
      if (!row.date) return true;
      const rowDate = new Date(row.date);
      if (dateFrom) {
        const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
        if (rowDate < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
        if (rowDate > to) return false;
      }
      return true;
    });
  }, [displayData, dateFrom, dateTo]);

  const openAdd = async () => {
    setEditing(null);
    setForm({ ...blank, businessUnit: "Gravure", uom: "Meter" });
    setAvailableContents([]);
    setDimValues({});
    setModal(true);
    try {
      const res = await apiGet<{ EnquiryNo: string }>("api/gravureEnquiryShrink/getenquiryno");
      setNextEnquiryNo(res?.EnquiryNo || "—");
    } catch { setNextEnquiryNo("—"); }
  };

  const openEdit = async (row: CombinedEnquiry) => {
    setEditing(row);
    const { id, enquiryNo, ...rest } = row;
    setForm(rest);
    setNextEnquiryNo(enquiryNo);
    setDimValues({
      width:           row.planWidth   || 0,
      layflatWidth:    row.planWidth   || 0,
      height:          row.planHeight  || 0,
      cutHeight:       row.planHeight  || 0,
      topSeal:         row.topSeal     || 0,
      bottomSeal:      row.bottomSeal  || 0,
      sideSeal:        row.sideSeal    || 0,
      centerSealWidth: row.centerSeal  || 0,
      gusset:          row.gusset      || 0,
      sideGusset:      row.sideGusset  || 0,
      sealWidth:       row.sealWidth   || 0,
      seamingArea:     row.seamingArea || 0,
      transparentArea: row.transparentArea || 0,
    });
    setModal(true);
    if (row.categoryId) fetchContents(row.categoryId);
    // Load processes + plys from getenquirybyid
    type FullEnquiry = {
      Processes?: { ProcessID: string; ProcessName: string }[];
      Plys?: {
        PlyID: string; LayerNo: number; PlyType: string; FilmSubGroup: string;
        Density: number; Thickness: number; FilmGSM: number; ItemID: string; ItemName: string;
        Consumables?: { ItemGroup: string; ItemSubGroup: string; ItemID: string; ItemName: string; FieldDisplayName: string; GSM: number; Rate: number; CoveragePct: number }[];
      }[];
    };
    const full = await apiGetSafe<FullEnquiry>(`api/gravureEnquiryShrink/getenquirybyid/${row.id}`);
    if (!full) return;

    setForm(prev => ({
      ...prev,
      ...(full.Processes?.length
        ? { processes: full.Processes!.map(p => ({ id: String(p.ProcessID), name: p.ProcessName })) }
        : {}),
      ...(full.Plys?.length
        ? {
            secondaryLayers: full.Plys!.map(p => ({
              id: String(p.PlyID ?? Math.random()),
              layerNo: Number(p.LayerNo ?? 1),
              plyType: String(p.PlyType ?? ""),
              itemSubGroup: String(p.FilmSubGroup ?? ""),
              density: parseFloat(String(p.Density ?? "0")) || 0,
              thickness: parseFloat(String(p.Thickness ?? "0")) || 0,
              gsm: parseFloat(String(p.FilmGSM ?? "0")) || 0,
              itemId: String(p.ItemID ?? ""),
              itemName: String(p.ItemName ?? ""),
              consumableItems: (p.Consumables ?? []).map(c => ({
                consumableId: String(Math.random()),
                fieldDisplayName: String(c.FieldDisplayName ?? ""),
                itemGroup: String(c.ItemGroup ?? ""),
                itemSubGroup: String(c.ItemSubGroup ?? ""),
                itemId: String(c.ItemID ?? ""),
                itemName: String(c.ItemName ?? ""),
                gsm: parseFloat(String(c.GSM ?? "0")) || 0,
                rate: parseFloat(String(c.Rate ?? "0")) || 0,
                coveragePct: parseFloat(String(c.CoveragePct ?? "100")) || 100,
              })),
            })),
          }
        : {}),
    }));
  };

  const save = async () => {
    if (!form.customerId) { showToast("error", "Validation", "Please select a Customer."); return; }
    if (!form.jobName.trim()) { showToast("error", "Validation", "Job Name is required."); return; }
    if (form.quantity <= 0) { showToast("error", "Validation", "Quantity must be greater than 0."); return; }

    setSaving(true);
    try {
      await saveEnquiry({ ...form, id: editing?.id || "", enquiryNo: editing?.enquiryNo || "" });
      showToast("success", "Saved", editing ? "Enquiry updated successfully." : "Enquiry saved successfully.");
      setModal(false);
    } catch (err) {
      showToast("error", "Save Error", String(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteEnquiry(deleteId);
      showToast("success", "Deleted", "Enquiry deleted.");
      setDeleteId(null);
    } catch (err) {
      showToast("error", "Delete Error", String(err));
    } finally {
      setDeleting(false);
    }
  };

  // Stats
  const total     = displayData.length;
  const pending   = displayData.filter(d => d.status === "Pending").length;
  const converted = displayData.filter(d => d.status === "Converted").length;

  const columns: ColumnDef<CombinedEnquiry>[] = [
    { accessorKey: "enquiryNo",      header: "Enquiry No" },
    { accessorKey: "date",           header: "Enquiry Date" },
    { accessorKey: "customerName",   header: "Customer Name" },
    { accessorKey: "jobName",        header: "Job Name" },
    { accessorKey: "salesPersonName",header: "Sales Person" },
    { accessorKey: "salesType",      header: "Sales Type" },
    {
      accessorKey: "planWidth",
      header: "Recom. Width (mm)",
      cell: ({ row }) => row.original.planWidth ? <span>{row.original.planWidth}</span> : <span className="text-[rgb(var(--fg-muted))]">—</span>,
    },
    {
      accessorKey: "planHeight",
      header: "Recom. Height (mm)",
      cell: ({ row }) => row.original.planHeight ? <span>{row.original.planHeight}</span> : <span className="text-[rgb(var(--fg-muted))]">—</span>,
    },
    {
      accessorKey: "quantity",
      header: "Qty",
      cell: ({ row }) => <span>{row.original.quantity?.toLocaleString()} {row.original.uom}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => statusBadge(row.original.status),
    },
    createActionsColumn<CombinedEnquiry>({
      onView:   (row) => setViewRow(row),
      onEdit:   (row) => openEdit(row),
      onDelete: (row) => setDeleteId(row.id),
      showView: true,
      showEdit: true,
      showDelete: true,
      mode: "buttons",
    }),
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-800">Enquiry</h2>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:bg-gray-100 active:scale-95 border border-gray-300 bg-white text-gray-700 shadow-sm"
        >
          <Plus size={15} /> Create
        </button>
      </div>

      {/* Table */}
      <DataGrid
        data={dateFilteredData}
        columns={columns}
        title="Enquiry List"
        loading={listLoading}
        enableSearch
        enableFiltering
        enableExport
        enableImport={false}
        enablePagination
        enableColumnResizing
        enableColumnVisibility
        enableSorting
        enableVisualization
        enableDateFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        enableRowSelection
        enableColumnReordering
        enableGrouping
        getRowId={(row) => row.id}
      />

      {/* ══ FORM MODAL ══════════════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => setModal(false)}
        title={editing ? "Edit Enquiry" : "Enquiry Creation"} size="xl">
        <div className="space-y-4">

          {/* ── 3 Section Cards ──────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Enquiry Info */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Enquiry Info</p>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Enquiry No</label>
                <input readOnly value={nextEnquiryNo}
                  className="w-full text-sm border border-gray-100 rounded-lg px-3 py-2 bg-gray-50 font-semibold text-teal-700 focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Enquiry Date</label>
                <input type="date" value={form.date} onChange={e => f("date", e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Sales Type</label>
                <select value={form.salesType} onChange={e => f("salesType", e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-400">
                  {SALES_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Customer Info */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer Info</p>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Lead / Customer Name <span className="text-red-500">*</span></label>
                <select value={form.customerId}
                  onChange={e => { const c = customers.find(x => x.LedgerID === e.target.value); f("customerId", e.target.value); f("customerName", c?.LedgerName || ""); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-400">
                  <option value="">Select Lead/Customer</option>
                  {customers.map(c => <option key={c.LedgerID} value={String(c.LedgerID ?? "")}>{c.LedgerName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Concern Person</label>
                <input value={form.concernPerson} onChange={e => f("concernPerson", e.target.value)}
                  placeholder="Select Concern Person"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Category</label>
                <select value={form.categoryId}
                  onChange={e => { const cat = categories.find(x => x.CategoryID === e.target.value); f("categoryId", e.target.value); f("categoryName", cat?.CategoryName || ""); f("selectedContent", ""); setDimValues({}); fetchContents(e.target.value); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-400">
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.CategoryID} value={String(c.CategoryID ?? "")}>{c.CategoryName}</option>)}
                </select>
              </div>
            </div>

            {/* Job Details */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Job Details</p>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Job Name <span className="text-red-500">*</span></label>
                <input value={form.jobName} onChange={e => f("jobName", e.target.value)}
                  placeholder="Enter job name"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 block mb-1">Quantity <span className="text-red-500">*</span></label>
                  <input type="number" value={form.quantity} onChange={e => f("quantity", Number(e.target.value))}
                    placeholder="e.g. 10000"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 block mb-1">UOM <span className="text-red-500">*</span></label>
                  <select value={form.uom} onChange={e => f("uom", e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-400">
                    <option value="Meter">Meter</option>
                    <option value="Kg">Kg</option>
                    <option value="Nos">Nos</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Sales Person <span className="text-red-500">*</span></label>
                <select value={form.salesPersonId}
                  onChange={e => { const s = salesPersons.find(x => x.LedgerID === e.target.value); f("salesPersonId", e.target.value); f("salesPersonName", s?.LedgerName || ""); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-400">
                  <option value="">Select sales person</option>
                  {salesPersons.map(s => <option key={s.LedgerID} value={String(s.LedgerID ?? "")}>{s.LedgerName}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Remark ──────────────────────────────────────── */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 block mb-1">Remark</label>
            <textarea value={form.remarks} onChange={e => f("remarks", e.target.value)}
              placeholder="Special requirements, urgency, other notes..."
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-blue-400" />
          </div>

          {/* Content Cards (shown after category is selected) */}
          {form.categoryId && (
            <div>
              <SH label={`Select Content — ${form.categoryName}`} />
              {form.selectedContent ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 p-3 rounded-xl border-2 border-teal-500 bg-teal-50 shadow-sm">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold leading-tight text-center bg-teal-600 text-white">
                      {form.selectedContent.slice(0, 4)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-tight truncate text-teal-700">{form.selectedContent}</p>
                      <p className="text-[11px] text-teal-600 mt-0.5 flex items-center gap-1"><Check size={11} /> Selected</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { f("selectedContent", ""); setDimValues({}); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <RefreshCw size={12} /> Change
                  </button>
                </div>
              ) : availableContents.length === 0 ? (
                <div className="text-xs text-gray-400 italic py-3 text-center">
                  {form.categoryId ? "No contents configured for this category." : "Select a category first."}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableContents.map(content => (
                    <button
                      key={content.ContentID}
                      type="button"
                      onClick={() => { f("selectedContent", content.ContentName); setDimValues({}); }}
                      className="flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all border-gray-200 bg-white hover:border-teal-300 hover:bg-gray-50"
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold leading-tight text-center bg-yellow-300 text-yellow-800">
                        {content.ContentName.slice(0, 4)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-tight truncate text-blue-700">{content.ContentName}</p>
                        {content.ContentCaption && (
                          <p className="text-[10px] text-gray-400 truncate">{content.ContentCaption}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Plan Window & Allocation — only shown after content is selected */}
          {contentSelected ? (
          <div className="pt-4 mt-2 border-t border-gray-100">
            <div className="flex items-start sm:items-center flex-wrap gap-2 mb-3">
              <SH label="Plan Window Details & Allocation" />
              <span className="sm:ml-auto px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-semibold rounded-full">
                {form.selectedContent}
              </span>
            </div>
            <div className="flex flex-col xl:flex-row gap-6">

              {/* Left: Plan Window Details */}
              <div className="flex-1 space-y-4">

                {/* Dimension Input + Live Diagram */}
                {CONTENT_TYPE_CONFIG[getDisplayContentType(form.selectedContent)] ? (
                  <div className="border border-blue-200 rounded-2xl overflow-hidden">
                    <div className="bg-[#f5f9fc] border-b border-[#e2e8f0] px-4 py-2.5 flex items-center gap-2 flex-wrap">
                      <span className="text-[#003366] text-xs font-semibold">Packaging Dimensions</span>
                      <span className="ml-auto text-gray-500 text-[10px] truncate max-w-[200px]">{getDisplayContentType(form.selectedContent)}</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-2">Enter Dimensions (mm)</p>
                        <DimensionInputPanel
                          contentType={getDisplayContentType(form.selectedContent)}
                          dims={dimValues}
                          onChange={patch => {
                            patchDim(patch);
                            if ("width"           in patch && patch.width           !== undefined) f("planWidth",       patch.width);
                            if ("layflatWidth"    in patch && patch.layflatWidth    !== undefined) f("planWidth",       patch.layflatWidth);
                            if ("height"          in patch && patch.height          !== undefined) f("planHeight",      patch.height);
                            if ("cutHeight"       in patch && patch.cutHeight       !== undefined) f("planHeight",      patch.cutHeight);
                            if ("topSeal"         in patch && patch.topSeal         !== undefined) f("topSeal",         patch.topSeal);
                            if ("bottomSeal"      in patch && patch.bottomSeal      !== undefined) f("bottomSeal",      patch.bottomSeal);
                            if ("sideSeal"        in patch && patch.sideSeal        !== undefined) f("sideSeal",        patch.sideSeal);
                            if ("centerSealWidth" in patch && patch.centerSealWidth !== undefined) f("centerSeal",      patch.centerSealWidth);
                            if ("gusset"          in patch && patch.gusset          !== undefined) f("gusset",          patch.gusset);
                            if ("sideGusset"      in patch && patch.sideGusset      !== undefined) f("sideGusset",      patch.sideGusset);
                            if ("sealWidth"       in patch && patch.sealWidth       !== undefined) f("sealWidth",       patch.sealWidth);
                            if ("seamingArea"     in patch && patch.seamingArea     !== undefined) f("seamingArea",     patch.seamingArea);
                            if ("transparentArea" in patch && patch.transparentArea !== undefined) f("transparentArea", patch.transparentArea);
                          }}
                        />
                      </div>
                      <DimensionDiagram contentType={getDisplayContentType(form.selectedContent)} dims={dimValues} />
                    </div>
                  </div>
                ) : (
                  /* Fallback: plain H/W inputs for unrecognized content types */
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Height (MM)</label>
                      <input type="number" value={form.planHeight || ""} onChange={e => f("planHeight", Number(e.target.value))}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Width (MM)</label>
                      <input type="number" value={form.planWidth || ""} onChange={e => f("planWidth", Number(e.target.value))}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
                    </div>
                  </div>
                )}

                {/* Colors, Wastage, Format, Label/Roll */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Front Colors</label>
                    <input type="number" min={0} max={12} value={form.frontColors || ""} onChange={e => f("frontColors", Number(e.target.value))}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400 font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Back Colors</label>
                    <input type="number" min={0} max={12} value={form.backColors || ""} onChange={e => f("backColors", Number(e.target.value))}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400 font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Label/Roll</label>
                    <input type="number" min={0} value={form.labelRoll || ""} onChange={e => f("labelRoll", Number(e.target.value))}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Wastage Type</label>
                    <SearchableSelect
                      value={form.wastageType || "Machine Default"}
                      onChange={val => f("wastageType", val)}
                      options={[
                        { value: "Machine Default", label: "Machine Default" },
                        { value: "Manual", label: "Manual" },
                      ]}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 outline-none"
                      allowEmpty={false}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Finished Format</label>
                    <SearchableSelect
                      value={form.finishedFormat || "Roll Form"}
                      onChange={val => f("finishedFormat", val)}
                      options={[
                        { value: "Roll Form", label: "Roll Form" },
                        { value: "Pouch Form", label: "Pouch Form" },
                      ]}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 outline-none"
                      allowEmpty={false}
                    />
                  </div>
                </div>

              </div>

              {/* Middle: Process Checklist */}
              <div className="w-full xl:w-1/3 space-y-4">
                <div className="flex bg-teal-700 text-white text-xs font-semibold rounded-t-lg mx-[1px]">
                  <div className="w-10 px-3 py-2 border-r border-teal-600 flex justify-center"><Check size={14} className="opacity-50" /></div>
                  <div className="flex-1 px-3 py-2">Process Name</div>
                </div>
                <div className="text-sm border border-gray-200 rounded-b-lg -mt-4 bg-white overflow-y-auto max-h-[350px] divide-y divide-gray-100">
                  {allProcesses.length === 0 ? (
                    <div className="text-xs text-gray-400 italic text-center py-4">Loading processes…</div>
                  ) : (
                    allProcesses.map(proc => {
                      const checked = (form.processes || []).some(p => String(p.id) === String(proc.ProcessID));
                      return (
                        <label key={proc.ProcessID} className="flex items-center cursor-pointer hover:bg-teal-50/50 transition-colors">
                          <div className="w-10 px-3 py-2 border-r border-gray-200 flex justify-center">
                            <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                              checked={checked}
                              onChange={e => {
                                const pList = form.processes || [];
                                if (e.target.checked) {
                                  f("processes", [...pList, { id: String(proc.ProcessID), name: proc.ProcessName } as ProcessRef]);
                                } else {
                                  f("processes", pList.filter((x: ProcessRef) => String(x.id) !== String(proc.ProcessID)));
                                }
                              }} />
                          </div>
                          <div className="flex-1 px-3 py-2 text-xs text-gray-700 select-none">{proc.ProcessName}</div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Ply Structure */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <SH label="Ply Structure & Consumables" />
                <button onClick={addPly}
                  className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition">
                  <Plus size={12} /> Add Ply
                </button>
              </div>
              {(() => {
                const GROUP_COLOR: Record<string, string> = {
                  Ink:      "bg-blue-50 text-blue-700 border-blue-200",
                  Solvent:  "bg-green-50 text-green-700 border-green-200",
                  Adhesive: "bg-orange-50 text-orange-700 border-orange-200",
                  Hardner:  "bg-rose-50 text-rose-700 border-rose-200",
                  Other:    "bg-gray-50 text-gray-600 border-gray-200",
                };
                return (
                  <div className="space-y-3">
                    {(form.secondaryLayers || []).map((l, index) => {
                      const ordinal = index === 0 ? "1st" : index === 1 ? "2nd" : index === 2 ? "3rd" : `${index + 1}th`;
                      return (
                        <div key={l.id} className="bg-white border-2 border-purple-50 rounded-2xl shadow-sm relative overflow-hidden">
                          {/* Ply header */}
                          <div className="flex items-center justify-between bg-purple-50 px-4 py-2 border-b border-purple-100">
                            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">{ordinal} Ply</span>
                            <button onClick={() => removePly(index)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                              <X size={14} />
                            </button>
                          </div>

                          <div className="p-3 space-y-3">
                            {/* Ply Type */}
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Ply Type *</label>
                              <SearchableSelect
                                value={l.plyType}
                                onChange={val => onPlyTypeChange(index, val)}
                                options={[
                                  { value: "Film", label: "Ply 1" },
                                  { value: "Printing", label: "Ply 2" },
                                  { value: "Lamination", label: "Ply 3" },
                                  { value: "Coating", label: "Ply 4" },
                                ]}
                                placeholder="-- Select Ply Type --"
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 outline-none"
                              />
                            </div>

                            {/* Film Item — single dropdown, auto-fills density/thickness/GSM */}
                            {l.plyType && (
                              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Item</label>
                                  <SearchableSelect
                                    value={l.itemId || ""}
                                    onChange={val => {
                                      const fi = FILM_ITEMS.find(x => x.id === val);
                                      const layers = [...(form.secondaryLayers || [])];
                                      if (!fi) { layers[index] = { ...l, itemId: "", itemName: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0 }; f("secondaryLayers", layers); return; }
                                      const thickness = parseFloat(fi.thickness) || 0;
                                      const density   = parseFloat(fi.density)   || 0;
                                      const gsm       = parseFloat((thickness * density).toFixed(3));
                                      layers[index]   = { ...l, itemId: fi.id, itemName: fi.name, itemSubGroup: fi.subGroup, density, thickness, gsm };
                                      f("secondaryLayers", layers);
                                    }}
                                    options={FILM_ITEMS.map(fi => ({ value: fi.id, label: fi.name }))}
                                    placeholder="-- Select Film Item --"
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Density</label>
                                    <input readOnly value={l.density || ""} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-400 font-mono" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Thickness (μ)</label>
                                    <input readOnly value={l.thickness || ""} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-400 font-mono" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film GSM</label>
                                    <input readOnly value={l.gsm || ""} className="w-full text-xs border border-purple-200 rounded-lg px-2 py-1.5 bg-purple-50 text-purple-800 font-bold font-mono" />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Consumable Items */}
                            {l.plyType && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Consumable Items ({l.consumableItems.length})</span>
                                  <button onClick={() => addPlyConsumable(index)}
                                    className="flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 transition">
                                    <Plus size={10} /> Add Consumable
                                  </button>
                                </div>
                                {l.consumableItems.map((ci, ciIdx) => {
                                  const CONSUMABLE_GROUPS = Array.from(new Set(items.filter(it => it.group !== "Film" && it.active).map(it => it.group))).sort();
                                  const subGroups = ci.itemGroup ? Array.from(new Set(items.filter(it => it.group === ci.itemGroup && it.active && it.subGroup).map(it => it.subGroup))).sort() : [];
                                  const filteredItems = items.filter(it => it.group === ci.itemGroup && it.active && (!ci.itemSubGroup || it.subGroup === ci.itemSubGroup));
                                  const hardenerGSM = (() => {
                                    const adh = l.consumableItems.find(x => x.itemGroup === "Adhesive");
                                    if (adh && adh.gsm > 0 && (adh.ohPct ?? 0) > 0 && (ci.ncoPct ?? 0) > 0)
                                      return ((adh.gsm * (adh.ohPct ?? 0)) / (ci.ncoPct ?? 1)).toFixed(3);
                                    return null;
                                  })();
                                  const groupBefore = l.consumableItems.slice(0, ciIdx).filter(x => x.itemGroup === ci.itemGroup).length;
                                  const ciLabel = ci.itemGroup || "Consumable";
                                  return (
                                    <div key={ci.consumableId} className="bg-teal-50/40 border border-teal-100 rounded-xl p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-teal-700 uppercase">{`${ciLabel} ${groupBefore + 1}`}</span>
                                        <div className="flex items-center gap-1">
                                          <button onClick={() => clonePlyConsumable(index, ciIdx)}
                                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-blue-200 rounded-lg transition">
                                            <Copy size={11} /> Clone
                                          </button>
                                          <button onClick={() => removePlyConsumable(index, ciIdx)}
                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                            <X size={12} />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {/* Item Group */}
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item Group</label>
                                          <SearchableSelect
                                            value={ci.itemGroup}
                                            onChange={val => updatePlyConsumable(index, ciIdx, { itemGroup: val, itemSubGroup: "", itemId: "", itemName: "", gsm: 0, ohPct: undefined, ncoPct: undefined })}
                                            options={CONSUMABLE_GROUPS.map(g => ({ value: g, label: g }))}
                                            placeholder="-- Group --"
                                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
                                          />
                                        </div>
                                        {/* Sub Group */}
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Sub Group</label>
                                          <SearchableSelect
                                            value={ci.itemSubGroup}
                                            onChange={val => updatePlyConsumable(index, ciIdx, { itemSubGroup: val, itemId: "", itemName: "" })}
                                            options={subGroups.map(sg => ({ value: sg, label: sg }))}
                                            placeholder="-- Sub Group --"
                                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
                                            disabled={!ci.itemGroup}
                                          />
                                        </div>
                                        {/* Item Master */}
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item (Master)</label>
                                          <SearchableSelect
                                            value={ci.itemId}
                                            onChange={val => {
                                              const it = filteredItems.find(x => x.id === val);
                                              const upd: Partial<PlyConsumableItem> = { itemId: it?.id ?? "", itemName: it?.name ?? "" };
                                              if (ci.itemGroup === "Ink" && it) {
                                                upd.gsm = parseFloat(String((it as any).DryGsM ?? 0)) || 0;
                                                upd.solidPct = parseFloat(String((it as any).SolidPerc ?? 40)) || 40;
                                              }
                                              updatePlyConsumable(index, ciIdx, upd);
                                            }}
                                            options={filteredItems.map(it => ({ value: it.id, label: it.name }))}
                                            placeholder="-- Select Item --"
                                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
                                            disabled={!ci.itemGroup}
                                          />
                                        </div>
                                        {/* Ink fields: Dry GSM + % Solid + Liquid GSM (auto) */}
                                        {ci.itemGroup === "Ink" && (<>
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Dry Ink GSM</label>
                                            <input type="number" step="any" min={0}
                                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                              value={ci.gsm || ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { gsm: parseFloat(e.target.value) || 0 })} />
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">% Solid</label>
                                            <input type="number" step={1} min={1} max={100}
                                              className="w-full text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                                              value={ci.solidPct ?? 40}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { solidPct: Number(e.target.value) || 40 })}
                                              placeholder="40" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-semibold text-purple-600 uppercase block mb-1">Liquid GSM</label>
                                            <div className="w-full text-xs border border-purple-200 rounded-lg px-2 py-1.5 bg-purple-50 font-mono font-bold text-purple-700 min-h-[30px]">
                                              {ci.gsm > 0 ? (ci.gsm / ((ci.solidPct ?? 40) / 100)).toFixed(2) : "—"}
                                            </div>
                                          </div>
                                        </>)}
                                        {/* Solvent: Ratio % */}
                                        {ci.itemGroup === "Solvent" && (
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Ratio (%)</label>
                                            <input type="number" step={0.1} min={0} max={100}
                                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                              value={ci.gsm || ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })}
                                              placeholder="e.g. 30" />
                                          </div>
                                        )}
                                        {/* Adhesive: GSM + OH% */}
                                        {ci.itemGroup === "Adhesive" && (<>
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Adhesive GSM</label>
                                            <input type="number" step={0.1} min={0}
                                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                              value={ci.gsm || ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })}
                                              placeholder="e.g. 4.5" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-semibold text-orange-600 uppercase block mb-1">OH %</label>
                                            <input type="number" step={0.1} min={0}
                                              className="w-full text-xs border border-orange-200 rounded-lg px-2 py-1.5 bg-orange-50 outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                                              value={ci.ohPct ?? ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { ohPct: Number(e.target.value) })}
                                              placeholder="e.g. 2.5" />
                                          </div>
                                        </>)}
                                        {/* Hardner: NCO% + auto GSM */}
                                        {ci.itemGroup === "Hardner" && (<>
                                          <div>
                                            <label className="text-[10px] font-semibold text-rose-600 uppercase block mb-1">NCO %</label>
                                            <input type="number" step={0.1} min={0}
                                              className="w-full text-xs border border-rose-200 rounded-lg px-2 py-1.5 bg-rose-50 outline-none focus:ring-2 focus:ring-rose-400 font-mono"
                                              value={ci.ncoPct ?? ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { ncoPct: Number(e.target.value) })}
                                              placeholder="e.g. 12.5" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Hardener GSM (Auto)</label>
                                            <div className="w-full text-xs border border-teal-200 rounded-lg px-2 py-1.5 bg-teal-50 font-mono font-bold text-teal-700 min-h-[30px]">
                                              {hardenerGSM !== null ? hardenerGSM : <span className="text-gray-400 font-normal">Set Adhesive GSM + OH% + NCO%</span>}
                                            </div>
                                          </div>
                                        </>)}
                                        {/* Generic GSM for any other group */}
                                        {!["Ink", "Solvent", "Adhesive", "Hardner"].includes(ci.itemGroup) && (
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">GSM</label>
                                            <input type="number" step={0.1} min={0}
                                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                              value={ci.gsm || ""}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {l.consumableItems.length === 0 && (
                                  <p className="text-[10px] text-gray-400 italic text-center py-2">Click &quot;+ Add Consumable&quot; to add ink, solvent, adhesive, etc.</p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Ply Summary strip */}
                          {l.consumableItems.length > 0 && (() => {
                            const groupCount: Record<string, number> = {};
                            l.consumableItems.forEach(ci => { const g = ci.itemGroup || "Other"; groupCount[g] = (groupCount[g] || 0) + 1; });
                            const inks = l.consumableItems.filter(ci => ci.itemGroup === "Ink");
                            const totalDryGSM = inks.reduce((sum, ci) => sum + (parseFloat(String(ci.gsm)) || 0), 0);
                            const avgSolid = inks.length > 0 ? inks.reduce((sum, ci) => sum + (ci.solidPct ?? 40), 0) / inks.length : 0;
                            return (
                              <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-slate-50 border-t border-slate-100 rounded-b-2xl">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ply Summary:</span>
                                {Object.entries(groupCount).map(([g, cnt]) => (
                                  <span key={g} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${GROUP_COLOR[g] ?? GROUP_COLOR.Other}`}>
                                    {g}: <strong>{cnt}</strong>
                                  </span>
                                ))}
                                {inks.length > 0 && (<>
                                  <span className="w-px h-3 bg-slate-300 mx-1" />
                                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                    Total Dry GSM: <strong>{totalDryGSM.toFixed(1)}</strong>
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                    Avg Solid: <strong>{avgSolid.toFixed(1)}%</strong>
                                  </span>
                                </>)}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                    {(!form.secondaryLayers || form.secondaryLayers.length === 0) && (
                      <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">No ply added. Click &quot;Add Ply&quot; to define the structure.</div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          ) : form.categoryId ? (
            <div className="pt-4 mt-2 border-t border-gray-100">
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-xl">☝️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Select a Content</p>
                  <p className="text-xs text-amber-600 mt-0.5">Choose a content type above — then Plan Window Details and Allocation will appear here.</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setModal(false)} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            <X size={14} /> Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: saving ? "#6b7280" : "rgb(var(--color-primary))" }}>
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? "Saving…" : editing ? "Update" : "Save"}
          </button>
        </div>
      </Modal>

      {/* ══ VIEW MODAL ════════════════════════════════════════ */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)}
          title={`Enquiry – ${viewRow.enquiryNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${BU_BADGE[viewRow.businessUnit]}`}>
                {viewRow.businessUnit}
              </span>
              {statusBadge(viewRow.status)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                ["Customer",      viewRow.customerName],
                ["Job Name",      viewRow.jobName],
                ["Quantity",      `${viewRow.quantity.toLocaleString()} ${viewRow.uom}`],
                ["Date",          viewRow.date],
                ["Sales Person",  viewRow.salesPersonName],
                ["Sales Type",    viewRow.salesType],
                ["Concern Person",viewRow.concernPerson],
                ["Category",      viewRow.categoryName],
                ["Content",       viewRow.selectedContent],
              ] as [string, string][]).map(([k, v]) => v ? (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
              ) : null)}
            </div>
            {viewRow.remarks && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Remarks:</strong> {viewRow.remarks}
              </div>
            )}
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            {viewRow.status === "Pending" && (
              <Button icon={<ArrowRight size={14} />}>Create Estimation</Button>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Delete this enquiry? This action cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
