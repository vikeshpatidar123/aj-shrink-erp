"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List, X } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/categorymaster`;

// ── Unwrap triple-encoded JSON ─────────────────────────────────────────────────
function unwrap(raw: any): any {
  let r = raw;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

// ── Shared UI ──────────────────────────────────────────────────────────────────
const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{title}</h3>
);
const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";
const ic = (err: boolean) => err ? inputCls.replace("border-gray-300", "border-red-400 bg-red-50/50") : inputCls;

// ── Types ──────────────────────────────────────────────────────────────────────
type CategoryRow = {
  id: string;
  CategoryID: string;
  CategoryName: string;
  Orientation: string;
  Layer: string;
  Remark: string;
  SegmentID: string;
  SegmentName: string;
};

type ContentItem = {
  ContentID: string;
  ContentName: string;
  ContentCaption: string;
  ContentClosedHref: string;
  ContentOpenHref: string;
  IsSelected: boolean;
  IsDefault: boolean;
};

type ProcessAllocation = {
  ProcessID: string;
  ContentID: string;
};

type ProcessItem = {
  ProcessID: string;
  ProcessName: string;
  TypeofCharges: string;
};

type CoaRow = {
  id: string;
  TestParameterName: string;
  Specification: string;
  SpecificationFieldDataFromTable: string;
  SpecificationFieldValue: string;
  SpecificationFieldUnit: string;
  ResultDataFieldType: string;
  Defaults: string;
  ShowIn: string;
};

type DryRow = {
  id: string;
  Particular: string;
  GSM: number;
  MinimumValue: number;
  MaximumValue: number;
  IsEditableField: boolean;
};

type SegmentItem = { SegmentID: string; SegmentName: string };

type PlyConfigRow = {
  id: string;
  PlyNumber: number;
  ItemGroupID: string;
  ItemGroupName: string;
  ItemSubGroupName: string;
  FieldDisplayName: string;
  DefaultGSM: number;
  MinimumValue: number;
  MaximumValue: number;
  SharePercentageFormula: string;
};

type FormState = {
  CategoryName: string;
  Orientation: string;
  Layer: string;
  SegmentID: string;
  Remark: string;
  contents: ContentItem[];
  processAllocations: ProcessAllocation[];
  coaRows: CoaRow[];
  dryRows: DryRow[];
  plyRows: PlyConfigRow[];
};

const uid = () => Math.random().toString(36).slice(2, 8);

const blank = (): FormState => ({
  CategoryName: "", Orientation: "2D", Layer: "", SegmentID: "", Remark: "",
  contents: [], processAllocations: [], coaRows: [], dryRows: [], plyRows: [],
});

// Layer string → max ply count
const layerToPlyCount = (layer: string): number => {
  if (!layer || layer.toLowerCase() === "mono") return 1;
  const m = layer.match(/(\d+)/);
  return m ? parseInt(m[1]) : 5;
};

const blankply = () => ({ PlyNumber: 1, ItemGroupID: "", ItemGroupName: "", ItemSubGroupName: "", FieldDisplayName: "", DefaultGSM: 0, MinimumValue: 0, MaximumValue: 0, SharePercentageFormula: "" });

const ORIENTATIONS = [
  { value: "2D", label: "2D" },
  { value: "3D", label: "3D" },
  { value: "BOOK", label: "BOOK" },
];
const LAYERS = ["Mono", "2 Layer", "3 Layer", "4 Layer", "5 Layer"].map(v => ({ value: v, label: v }));

const blankcoa = () => ({
  TestParameterName: "", Specification: "", SpecificationFieldDataFromTable: "",
  SpecificationFieldValue: "", SpecificationFieldUnit: "",
  ResultDataFieldType: "", Defaults: "", ShowIn: "",
});
const blankdry = () => ({ Particular: "", GSM: 0, MinimumValue: 0, MaximumValue: 0, IsEditableField: true });

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CategoryMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [allProcesses, setAllProcesses] = useState<ProcessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [activeTab, setActiveTab] = useState<"detail" | "content" | "coa" | "dryweight" | "ply">("detail");
  const [filterSegment, setFilterSegment] = useState("All");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [processModalContentId, setProcessModalContentId] = useState<string | null>(null);

  // Drafts
  const [coaDraft, setCoaDraft] = useState(blankcoa());
  const [dryDraft, setDryDraft] = useState(blankdry());
  const [plyDraft, setPlyDraft] = useState(blankply());
  const [itemGroupsFull, setItemGroupsFull] = useState<{ItemGroupID: string; ItemGroupName: string}[]>([]);
  const [itemSubGroups, setItemSubGroups] = useState<string[]>([]);
  const [allSubGroupsFull, setAllSubGroupsFull] = useState<{ItemSubGroupName: string; UnderSubGroupID: string}[]>([]);

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  // ── Load list ──────────────────────────────────────────────────────────────────
  const loadList = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}/getcategory`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setCategories(Array.isArray(raw) ? raw.map((r: any) => ({ ...r, id: String(r.CategoryID) })) : []);
      })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  const loadSegments = useCallback(() => {
    fetch(`${BASE}/getsegment`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setSegments(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setSegments([]));
  }, []);

  const loadProcesses = useCallback(() => {
    fetch(`${BASE}/processgrid`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setAllProcesses(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setAllProcesses([]));
  }, []);

  const loadItemGroups = useCallback(() => {
    fetch(`${BASE}/getitemgroupsforply`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setItemGroupsFull(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setItemGroupsFull([]));
  }, []);

  const loadAllSubGroups = useCallback(() => {
    fetch(`${BASE_URL}/api/itemmaster/group`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setAllSubGroupsFull(Array.isArray(raw) ? raw.map((s: any) => ({
          ItemSubGroupName: String(s.ItemSubGroupName ?? ""),
          UnderSubGroupID: String(s.UnderSubGroupID ?? ""),
        })) : []);
      })
      .catch(() => setAllSubGroupsFull([]));
  }, []);

  useEffect(() => { loadList(); loadSegments(); loadProcesses(); loadItemGroups(); loadAllSubGroups(); }, [loadList, loadSegments, loadProcesses, loadItemGroups, loadAllSubGroups]);

  // ── Load content + process allocations ────────────────────────────────────────
  const fetchContents = useCallback(async (categoryID: string): Promise<{ contents: ContentItem[]; processAllocations: ProcessAllocation[] }> => {
    try {
      const res = await fetch(`${BASE}/getallcontents/${categoryID}`, { headers: authHeaders() });
      const raw = unwrap(await res.text());
      let contRows: any[] = [];
      let procRows: any[] = [];
      if (raw && typeof raw === "object" && Array.isArray(raw.Contents)) {
        contRows = raw.Contents;
        procRows = Array.isArray(raw.Process) ? raw.Process : [];
      } else if (Array.isArray(raw)) {
        contRows = raw;
      }
      const contents: ContentItem[] = contRows.map((c: any) => ({
        ContentID: String(c.ContentID ?? ""),
        ContentName: c.ContentName ?? "",
        ContentCaption: c.ContentCaption ?? "",
        ContentClosedHref: c.ContentClosedHref ?? "",
        ContentOpenHref: c.ContentOpenHref ?? "",
        IsSelected: Number(c.IsSelected) !== 0,
        IsDefault: false,
      }));
      const processAllocations: ProcessAllocation[] = procRows
        .filter((p: any) => p.ContentID && Number(p.ContentID) !== 0)
        .map((p: any) => ({
          ProcessID: String(p.ProcessID),
          ContentID: String(p.ContentID),
        }));
      return { contents, processAllocations };
    } catch { return { contents: [], processAllocations: [] }; }
  }, []);

  // ── Load COA rows for a category ──────────────────────────────────────────────
  const fetchCoa = useCallback(async (categoryID: string): Promise<CoaRow[]> => {
    try {
      const res = await fetch(`${BASE}/categorywisegriddata/${categoryID}`, { headers: authHeaders() });
      const raw = unwrap(await res.text());
      const rows: any[] = Array.isArray(raw) ? raw : [];
      return rows.map(r => ({
        id: uid(),
        TestParameterName: r.TestParameterName ?? "",
        Specification: r.Specification ?? "",
        SpecificationFieldDataFromTable: r.SpecificationFieldDataFromTable ?? "",
        SpecificationFieldValue: r.SpecificationFieldValue ?? "",
        SpecificationFieldUnit: r.SpecificationFieldUnit ?? "",
        ResultDataFieldType: r.ResultDataFieldType ?? "",
        Defaults: r.Defaults ?? "",
        ShowIn: r.ShowIn ?? "",
      }));
    } catch { return []; }
  }, []);

  // ── Load ply configuration for a category ──────────────────────────────────────
  const fetchPlyConfig = useCallback(async (categoryID: string): Promise<PlyConfigRow[]> => {
    try {
      const res = await fetch(`${BASE}/getplyconfiguration/${categoryID}`, { headers: authHeaders() });
      const raw = unwrap(await res.text());
      const rows: any[] = Array.isArray(raw) ? raw : [];
      return rows.map(r => ({
        id: uid(),
        PlyNumber: Number(r.PlyNumber ?? 1),
        ItemGroupID: r.ItemGroupID ? String(r.ItemGroupID) : "",
        ItemGroupName: r.ItemGroupName ?? "",
        ItemSubGroupName: r.ItemSubGroupName ?? "",
        FieldDisplayName: r.FieldDisplayName ?? "",
        DefaultGSM: Number(r.DefaultGSM ?? 0),
        MinimumValue: Number(r.MinimumValue ?? 0),
        MaximumValue: Number(r.MaximumValue ?? 0),
        SharePercentageFormula: r.SharePercentageFormula ?? "",
      }));
    } catch { return []; }
  }, []);

  // ── Open add ───────────────────────────────────────────────────────────────────
  const openAdd = async () => {
    setEditing(null);
    setError("");
    setActiveTab("detail");
    setFormLoading(true);
    setView("form");
    const { contents } = await fetchContents("0");
    setForm({ ...blank(), contents });
    setFormLoading(false);
  };

  // ── Open edit ──────────────────────────────────────────────────────────────────
  const openEdit = async (row: CategoryRow) => {
    setEditing(row);
    setError("");
    setActiveTab("detail");
    setFormLoading(true);
    setView("form");
    const [{ contents, processAllocations }, coaRows, plyRows] = await Promise.all([
      fetchContents(row.CategoryID),
      fetchCoa(row.CategoryID),
      fetchPlyConfig(row.CategoryID),
    ]);
    setForm({
      CategoryName: row.CategoryName ?? "",
      Orientation: row.Orientation ?? "2D",
      Layer: row.Layer ?? "",
      SegmentID: String(row.SegmentID ?? ""),
      Remark: row.Remark ?? "",
      contents,
      processAllocations,
      coaRows,
      dryRows: [],
      plyRows,
    });
    setFormLoading(false);
  };

  // ── Toggle content selection ───────────────────────────────────────────────────
  const toggleContent = (idx: number, field: "IsSelected" | "IsDefault") => {
    const items = [...form.contents];
    items[idx] = { ...items[idx], [field]: !items[idx][field] };
    if (field === "IsSelected" && !items[idx].IsSelected) {
      // Deselected — remove process allocations for this content
      const contentID = items[idx].ContentID;
      setForm(p => ({
        ...p,
        contents: items,
        processAllocations: p.processAllocations.filter(a => a.ContentID !== contentID),
      }));
      return;
    }
    f("contents", items);
  };

  // ── Toggle process allocation for a content ────────────────────────────────────
  const toggleProcessAllocation = (processID: string, contentID: string) => {
    setForm(p => {
      const exists = p.processAllocations.some(a => a.ProcessID === processID && a.ContentID === contentID);
      if (exists) {
        return { ...p, processAllocations: p.processAllocations.filter(a => !(a.ProcessID === processID && a.ContentID === contentID)) };
      }
      return { ...p, processAllocations: [...p.processAllocations, { ProcessID: processID, ContentID: contentID }] };
    });
  };

  // ── Save ───────────────────────────────────────────────────────────────────────
  const saveCategory = async () => {
    setSubmitAttempted(true);
    if (!form.CategoryName.trim()) { setError("Category Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const selectedContents = form.contents.filter(c => c.IsSelected);

      const masterRecord: Record<string, any> = {
        CategoryName: form.CategoryName,
        Orientation: form.Orientation || null,
        Layer: form.Layer || null,
        SegmentID: form.SegmentID ? Number(form.SegmentID) : null,
        Remark: form.Remark || null,
        MinimumAroundGap: 0, MaximumAroundGap: 0, DefaultAroundGap: 0,
        MinimumAcrossGap: 0, MaximumAcrossGap: 0, DefaultAcrossGap: 0,
        MinimumPlateBearer: 0, MaximumPlateBearer: 0, DefaultPlateBearer: 0,
        MinimumSideStrip: 0, MaximumSideStrip: 0, DefaultSideStrip: 0,
        DefaultPrintingMarginTop: 0, DefaultPrintingMarginBottom: 0,
        DefaultPrintingMarginLeft: 0, DefaultPrintingMarginRight: 0,
        DefaultStrippingMarginTop: 0, DefaultStrippingMarginBottom: 0,
        DefaultStrippingMarginLeft: 0, DefaultStrippingMarginRight: 0,
        DefaultJobTrimmingTop: 0, DefaultJobTrimmingBottom: 0,
        DefaultJobTrimmingLeft: 0, DefaultJobTrimmingRight: 0,
        ProcessIDString: "",
        ContentsIDString: selectedContents.map(c => c.ContentID).join(","),
        RotoGSMContributionSettingJSON: JSON.stringify(
          form.dryRows.map(r => ({
            Particular: r.Particular, GSM: r.GSM,
            MinimumValue: r.MinimumValue, MaximumValue: r.MaximumValue,
            IsEditableField: r.IsEditableField,
          }))
        ),
        GravureWetGSMJSONConfig: "[]",
      };

      const contentAlloc = selectedContents.map(c => ({ ContentID: c.ContentID }));

      const coaPayload = form.coaRows.map((r, i) => ({
        TestParameterName: r.TestParameterName,
        TransID: i + 1,
        Specification: r.Specification,
        SpecificationFieldDataFromTable: r.SpecificationFieldDataFromTable,
        SpecificationFieldValue: r.SpecificationFieldValue,
        SpecificationFieldUnit: r.SpecificationFieldUnit,
        ResultDataFieldType: r.ResultDataFieldType,
        Defaults: r.Defaults,
        ShowIn: r.ShowIn,
      }));

      // Only send process allocations for selected contents
      const selectedContentIDs = new Set(selectedContents.map(c => c.ContentID));
      const processAllocPayload = form.processAllocations
        .filter(a => selectedContentIDs.has(a.ContentID))
        .map(a => ({ ProcessID: a.ProcessID, ContentID: a.ContentID }));

      const plyConfigPayload = form.plyRows.map(r => ({
        PlyNumber: r.PlyNumber,
        ItemGroupID: r.ItemGroupID,
        ItemGroupName: r.ItemGroupName,
        ItemSubGroupName: r.ItemSubGroupName,
        FieldDisplayName: r.FieldDisplayName,
        DefaultGSM: r.DefaultGSM,
        MinimumValue: r.MinimumValue,
        MaximumValue: r.MaximumValue,
        SharePercentageFormula: r.SharePercentageFormula,
      }));

      const payload: any = {
        CostingDataGroupMaster: [masterRecord],
        CategoryName: form.CategoryName,
        CategoryWiseContentAllocation: contentAlloc,
        CategoryWiseContentProcessAllocation: processAllocPayload,
        COA: coaPayload,
        COA1: [],
        SelectedLedgerID: null,
        ProcessAllocatedMaterialDetail: [],
        CategoryWiseMaterialDetail: [],
        PlyConfigurationRows: plyConfigPayload,
      };

      if (editing) {
        payload.TxtCategoryID = editing.CategoryID;
      }

      const url = editing ? `${BASE}/updatcategorydata` : `${BASE}/savecategorydata`;
      const res = await fetch(url, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = unwrap(await res.text());
      if (result === "Success") {
        loadList();
        setView("list");
      } else if (result === "Exist") {
        setError("A category with this name already exists.");
      } else {
        setError("Save failed: " + result);
      }
    } catch (e: any) {
      setError("Error: " + e.message);
    }
    setSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────────
  const deleteCategory = async (CategoryID: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      const res = await fetch(`${BASE}/deletecategorymasterdata/${CategoryID}`, { headers: authHeaders() });
      const raw = await res.text();
      let result: string;
      try { result = unwrap(raw); } catch { result = raw; }
      if (result === "Success") loadList();
      else alert("Delete failed: " + result);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // ── List derived ───────────────────────────────────────────────────────────────
  const uniqueSegments = useMemo(() =>
    ["All", ...new Set(categories.map(c => c.SegmentName).filter(Boolean))],
    [categories]);

  const filtered = useMemo(() =>
    filterSegment === "All" ? categories : categories.filter(c => c.SegmentName === filterSegment),
    [categories, filterSegment]);

  // ── Process modal ──────────────────────────────────────────────────────────────
  const activeContent = processModalContentId
    ? form.contents.find(c => c.ContentID === processModalContentId)
    : null;

  const ProcessModal = () => {
    if (!processModalContentId || !activeContent) return null;
    const allocatedForContent = form.processAllocations.filter(a => a.ContentID === processModalContentId);
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Process Allocation</p>
              <h3 className="text-sm font-bold text-gray-800">
                {activeContent.ContentCaption || activeContent.ContentName}
              </h3>
            </div>
            <button onClick={() => setProcessModalContentId(null)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {allProcesses.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8 italic">No processes available.</p>
            ) : (
              allProcesses.map(p => {
                const checked = form.processAllocations.some(
                  a => a.ProcessID === String(p.ProcessID) && a.ContentID === processModalContentId
                );
                return (
                  <label key={p.ProcessID}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300 group-hover:border-blue-400"}`}
                      onClick={() => toggleProcessAllocation(String(p.ProcessID), processModalContentId)}>
                      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-sm text-gray-700 flex-1"
                      onClick={() => toggleProcessAllocation(String(p.ProcessID), processModalContentId)}>
                      {p.ProcessName}
                    </span>
                    {p.TypeofCharges && (
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{p.TypeofCharges}</span>
                    )}
                  </label>
                );
              })
            )}
          </div>
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-blue-600 font-medium">
              {allocatedForContent.length} process{allocatedForContent.length !== 1 ? "es" : ""} selected
            </span>
            <button onClick={() => setProcessModalContentId(null)}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── FORM VIEW ──────────────────────────────────────────────────────────────────
  if (view === "form") {
    const tabs = [
      { key: "detail" as const, label: "Category Detail" },
      { key: "content" as const, label: "Content Allocation" },
      { key: "coa" as const, label: "COA Parameters" },
      { key: "dryweight" as const, label: "Dry Weight (GSM)" },
      { key: "ply" as const, label: "Ply Configuration" },
    ];

    return (
      <>
        <ProcessModal />
        <div className="max-w-5xl mx-auto pb-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div>
              <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">Category Master</p>
              <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit Category" : "New Category"}</h2>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <List size={16} /> Back to List
              </button>
              <button onClick={saveCategory} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Save Category
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Tab bar */}
            <div className="px-6 pt-5 pb-0 border-b border-gray-200 bg-gray-50/30">
              {editing && (
                <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                  ID: {editing.CategoryID}
                </span>
              )}
              <div className="flex gap-8">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === t.key ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8">
              {formLoading ? (
                <div className="flex items-center justify-center py-20 text-gray-400">
                  <Loader2 size={24} className="animate-spin mr-3" /> Loading...
                </div>
              ) : (

                <>
                  {/* ── DETAIL TAB ── */}
                  {activeTab === "detail" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div>
                        <SectionTitle title="Category Identity" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-2">
                            <Field label="Category Name" required>
                              <input type="text" value={form.CategoryName} onChange={e => f("CategoryName", e.target.value)}
                                placeholder="e.g. Gravure - Solvent Base 2 Layer" className={ic(submitAttempted && !form.CategoryName.trim())} />
                            </Field>
                          </div>
                          <Field label="Orientation">
                            <select value={form.Orientation} onChange={e => f("Orientation", e.target.value)} className={inputCls}>
                              <option value="">Select...</option>
                              {ORIENTATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Layer">
                            <select value={form.Layer} onChange={e => f("Layer", e.target.value)} className={inputCls}>
                              <option value="">Select...</option>
                              {LAYERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Segment">
                            <select value={form.SegmentID} onChange={e => f("SegmentID", e.target.value)} className={inputCls}>
                              <option value="">Select Segment...</option>
                              {segments.map(s => (
                                <option key={s.SegmentID} value={String(s.SegmentID)}>{s.SegmentName}</option>
                              ))}
                            </select>
                          </Field>
                          <div className="md:col-span-3">
                            <Field label="Remark">
                              <textarea value={form.Remark} onChange={e => f("Remark", e.target.value)} rows={2}
                                placeholder="Remarks..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                            </Field>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button onClick={() => setActiveTab("content")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900">
                          Content Allocation →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── CONTENT ALLOCATION TAB ── */}
                  {activeTab === "content" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center justify-between">
                        <SectionTitle title="Content Allocation" />
                        {form.contents.length > 0 && (
                          <span className="text-xs text-blue-600 font-medium mb-4">
                            {form.contents.filter(c => c.IsSelected).length} of {form.contents.length} selected
                          </span>
                        )}
                      </div>
                      {form.contents.length === 0 ? (
                        <div className="flex items-center justify-center py-14 text-sm text-gray-400 italic border-2 border-dashed border-gray-200 rounded-xl">
                          No contents available. Add contents in Content Master first.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {form.contents.map((card, idx) => {
                            const procCount = form.processAllocations.filter(a => a.ContentID === card.ContentID).length;
                            return (
                              <div key={card.ContentID}
                                className={`rounded-xl border-2 transition-all bg-white flex flex-col ${card.IsSelected ? "border-blue-500 shadow-sm" : "border-gray-200 hover:border-blue-300"}`}>

                                {/* Image area */}
                                <div
                                  className="relative flex items-center justify-center p-3 cursor-pointer bg-gray-50 rounded-t-xl min-h-[100px]"
                                  onClick={() => toggleContent(idx, "IsSelected")}>
                                  {card.ContentClosedHref ? (
                                    <img
                                      src={card.ContentClosedHref.startsWith("http") ? card.ContentClosedHref : `${BASE_URL}/${card.ContentClosedHref.replace(/^\//, "")}`}
                                      alt={card.ContentCaption || card.ContentName}
                                      className="w-20 h-20 object-contain"
                                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                  ) : (
                                    <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-[10px] text-center leading-tight px-1">
                                      No Image
                                    </div>
                                  )}
                                  {/* Selection badge */}
                                  <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${card.IsSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}>
                                    {card.IsSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                  </div>
                                </div>

                                {/* Name */}
                                <div className="px-3 py-2 cursor-pointer" onClick={() => toggleContent(idx, "IsSelected")}>
                                  <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">
                                    {card.ContentCaption || card.ContentName}
                                  </p>
                                </div>

                                {/* Controls when selected */}
                                {card.IsSelected && (
                                  <div className="px-3 pb-3 space-y-2">
                                    <label className="flex items-center gap-1.5 cursor-pointer" onClick={e => e.stopPropagation()}>
                                      <input type="checkbox" checked={card.IsDefault} onChange={() => toggleContent(idx, "IsDefault")}
                                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 cursor-pointer" />
                                      <span className="text-[10px] text-gray-500">Default Content</span>
                                    </label>
                                    <button
                                      onClick={e => { e.stopPropagation(); setProcessModalContentId(card.ContentID); }}
                                      className="w-full text-[10px] px-2 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 font-semibold transition-colors">
                                      Allocate Processes {procCount > 0 ? `(${procCount})` : ""}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <button onClick={() => setActiveTab("detail")} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">← Detail</button>
                        <button onClick={() => setActiveTab("coa")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900">COA Parameters →</button>
                      </div>
                    </div>
                  )}

                  {/* ── COA PARAMETERS TAB ── */}
                  {activeTab === "coa" && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <SectionTitle title="COA Parameter Allocation" />

                      {/* Add row */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {([
                          ["Test Parameter *", "TestParameterName"],
                          ["Specification", "Specification"],
                          ["Data From Table", "SpecificationFieldDataFromTable"],
                          ["Field Value", "SpecificationFieldValue"],
                          ["Field Unit", "SpecificationFieldUnit"],
                          ["Result Data Type", "ResultDataFieldType"],
                          ["Default Value", "Defaults"],
                          ["Show In", "ShowIn"],
                        ] as const).map(([label, key]) => (
                          <div key={key}>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">{label}</label>
                            <input className={inputCls + " text-xs"} value={(coaDraft as any)[key]}
                              onChange={e => setCoaDraft(p => ({ ...p, [key]: e.target.value }))} placeholder={label.replace(" *", "")} />
                          </div>
                        ))}
                        <div className="flex items-end">
                          <button onClick={() => {
                            if (!coaDraft.TestParameterName.trim()) return;
                            f("coaRows", [...form.coaRows, { id: uid(), ...coaDraft }]);
                            setCoaDraft(blankcoa());
                          }} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5">
                            <Plus size={13} /> Add Row
                          </button>
                        </div>
                      </div>

                      {/* Grid */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                        <div className="min-w-[860px]">
                          <div className="grid bg-blue-700 text-white text-xs font-semibold"
                            style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr 0.7fr 1fr 0.7fr 0.7fr 48px" }}>
                            {["Test Parameter", "Specification", "Data From", "Field Value", "Unit", "Result Type", "Default", "Show In", ""].map((h, i) => (
                              <div key={i} className="px-3 py-3 truncate">{h}</div>
                            ))}
                          </div>
                          <div className="divide-y divide-gray-100 bg-white min-h-[100px]">
                            {form.coaRows.map(row => (
                              <div key={row.id} className="grid hover:bg-gray-50 text-xs"
                                style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr 0.7fr 1fr 0.7fr 0.7fr 48px" }}>
                                <div className="px-3 py-3 font-medium text-gray-700 truncate">{row.TestParameterName || "—"}</div>
                                <div className="px-3 py-3 text-gray-600 truncate">{row.Specification || "—"}</div>
                                <div className="px-3 py-3 text-gray-600 truncate">{row.SpecificationFieldDataFromTable || "—"}</div>
                                <div className="px-3 py-3 text-gray-600 truncate">{row.SpecificationFieldValue || "—"}</div>
                                <div className="px-3 py-3 text-gray-600 truncate">{row.SpecificationFieldUnit || "—"}</div>
                                <div className="px-3 py-3 text-gray-600 truncate">{row.ResultDataFieldType || "—"}</div>
                                <div className="px-3 py-3 text-gray-600 truncate">{row.Defaults || "—"}</div>
                                <div className="px-3 py-3 text-gray-600 truncate">{row.ShowIn || "—"}</div>
                                <div className="px-3 py-3 flex justify-center">
                                  <button onClick={() => f("coaRows", form.coaRows.filter(r => r.id !== row.id))}
                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                            {form.coaRows.length === 0 && (
                              <div className="text-center text-xs text-gray-400 py-10">No COA parameters added yet.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <button onClick={() => setActiveTab("content")} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">← Content</button>
                        <button onClick={() => setActiveTab("dryweight")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900">Dry Weight →</button>
                      </div>
                    </div>
                  )}

                  {/* ── DRY WEIGHT TAB ── */}
                  {activeTab === "dryweight" && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <SectionTitle title="Dry GSM Layer Setting (RotoGSMContributionSetting)" />

                      {/* Input */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-6 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Particular</label>
                          <input className={inputCls + " text-xs"} placeholder="e.g. Ink" value={dryDraft.Particular}
                            onChange={e => setDryDraft(p => ({ ...p, Particular: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">GSM</label>
                          <input className={inputCls + " text-xs"} type="number" placeholder="0" value={dryDraft.GSM}
                            onChange={e => setDryDraft(p => ({ ...p, GSM: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Min</label>
                          <input className={inputCls + " text-xs"} type="number" placeholder="0" value={dryDraft.MinimumValue}
                            onChange={e => setDryDraft(p => ({ ...p, MinimumValue: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Max</label>
                          <input className={inputCls + " text-xs"} type="number" placeholder="0" value={dryDraft.MaximumValue}
                            onChange={e => setDryDraft(p => ({ ...p, MaximumValue: Number(e.target.value) }))} />
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={dryDraft.IsEditableField}
                              onChange={e => setDryDraft(p => ({ ...p, IsEditableField: e.target.checked }))}
                              className="w-4 h-4 text-blue-600" />
                            <span className="text-xs text-gray-600">Editable</span>
                          </label>
                        </div>
                        <div className="flex items-end">
                          <button onClick={() => {
                            if (!dryDraft.Particular.trim()) return;
                            f("dryRows", [...form.dryRows, { id: uid(), ...dryDraft }]);
                            setDryDraft(blankdry());
                          }} className="w-full px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                            + Add
                          </button>
                        </div>
                      </div>

                      {/* Table */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-6 bg-blue-700 text-white text-xs font-semibold">
                          {["Particular", "GSM", "Min", "Max", "Editable", "Action"].map(h => (
                            <div key={h} className="px-4 py-3">{h}</div>
                          ))}
                        </div>
                        <div className="divide-y divide-gray-100 bg-white min-h-[80px]">
                          {form.dryRows.map(row => (
                            <div key={row.id} className="grid grid-cols-6 text-sm hover:bg-gray-50">
                              <div className="px-4 py-3 font-medium text-gray-700">{row.Particular}</div>
                              <div className="px-4 py-3 text-gray-600">{row.GSM}</div>
                              <div className="px-4 py-3 text-gray-600">{row.MinimumValue}</div>
                              <div className="px-4 py-3 text-gray-600">{row.MaximumValue}</div>
                              <div className="px-4 py-3">
                                {row.IsEditableField ? <Check size={15} className="text-blue-600" /> : <span className="text-gray-400">—</span>}
                              </div>
                              <div className="px-4 py-3">
                                <button onClick={() => f("dryRows", form.dryRows.filter(r => r.id !== row.id))}
                                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {form.dryRows.length === 0 && (
                            <div className="text-center text-xs text-gray-400 py-8">No rows. Use form above to add.</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <button onClick={() => setActiveTab("coa")} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">← COA</button>
                        <button onClick={() => setActiveTab("ply")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900">Ply Configuration →</button>
                      </div>
                    </div>
                  )}
                  {/* ── PLY CONFIGURATION TAB ── */}
                  {activeTab === "ply" && (() => {
                    const maxPly = layerToPlyCount(form.Layer);
                    const plyNumbers = Array.from({ length: maxPly }, (_, i) => i + 1);
                    return (
                      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between">
                          <SectionTitle title="Ply Configuration" />
                          <span className="text-xs text-gray-400">Max Plies: <strong className="text-blue-600">{maxPly}</strong> (based on Layer: {form.Layer || "not set"})</span>
                        </div>

                        {/* Draft input */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                          <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Add Consumable Row</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Ply Number */}
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Ply Number *</label>
                              <select className={inputCls + " text-xs"} value={plyDraft.PlyNumber}
                                onChange={e => setPlyDraft(p => ({ ...p, PlyNumber: Number(e.target.value) }))}>
                                {plyNumbers.map(n => <option key={n} value={n}>Ply {n}</option>)}
                              </select>
                            </div>
                            {/* Item Group */}
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Item Group *</label>
                              <select
                                className={inputCls + " text-xs"}
                                value={plyDraft.ItemGroupID}
                                onChange={e => {
                                  const id = e.target.value;
                                  const grp = itemGroupsFull.find(g => String(g.ItemGroupID) === id);
                                  const name = grp?.ItemGroupName ?? "";
                                  setPlyDraft(p => ({ ...p, ItemGroupID: id, ItemGroupName: name, ItemSubGroupName: "" }));
                                  if (id) {
                                    const filtered = allSubGroupsFull
                                      .filter(s => s.UnderSubGroupID === id && s.ItemSubGroupName)
                                      .map(s => s.ItemSubGroupName);
                                    setItemSubGroups(filtered);
                                  } else setItemSubGroups([]);
                                }}
                              >
                                <option value="">— Select Group —</option>
                                {itemGroupsFull.map(g => (
                                  <option key={g.ItemGroupID} value={String(g.ItemGroupID)}>{g.ItemGroupName}</option>
                                ))}
                              </select>
                            </div>
                            {/* Item Sub Group */}
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Item Sub Group *</label>
                              <select
                                className={inputCls + " text-xs"}
                                value={plyDraft.ItemSubGroupName}
                                onChange={e => setPlyDraft(p => ({ ...p, ItemSubGroupName: e.target.value }))}
                                disabled={!plyDraft.ItemGroupID}
                              >
                                <option value="">— Select Sub Group —</option>
                                {itemSubGroups.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Field Display Name</label>
                              <input className={inputCls + " text-xs"} placeholder="e.g. Ink Wet Weight"
                                value={plyDraft.FieldDisplayName}
                                onChange={e => setPlyDraft(p => ({ ...p, FieldDisplayName: e.target.value }))} />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Default GSM</label>
                              <input className={inputCls + " text-xs"} type="number" placeholder="0.00"
                                value={plyDraft.DefaultGSM}
                                onChange={e => setPlyDraft(p => ({ ...p, DefaultGSM: Number(e.target.value) }))} />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Min Value</label>
                              <input className={inputCls + " text-xs"} type="number" placeholder="0"
                                value={plyDraft.MinimumValue}
                                onChange={e => setPlyDraft(p => ({ ...p, MinimumValue: Number(e.target.value) }))} />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Max Value</label>
                              <input className={inputCls + " text-xs"} type="number" placeholder="10"
                                value={plyDraft.MaximumValue}
                                onChange={e => setPlyDraft(p => ({ ...p, MaximumValue: Number(e.target.value) }))} />
                            </div>
                          </div>
                          <div className="flex items-end gap-3">
                            <div className="flex-1">
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Share % Formula</label>
                              <input className={inputCls + " text-xs"} placeholder="e.g. ink_gsm / total_gsm * 100"
                                value={plyDraft.SharePercentageFormula}
                                onChange={e => setPlyDraft(p => ({ ...p, SharePercentageFormula: e.target.value }))} />
                            </div>
                            <button
                              onClick={() => {
                                if (!plyDraft.ItemGroupName || !plyDraft.ItemSubGroupName) return;
                                f("plyRows", [...form.plyRows, { id: uid(), ...plyDraft }]);
                                setPlyDraft(blankply());
                                setItemSubGroups([]);
                              }}
                              className="px-5 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 flex items-center gap-1.5 whitespace-nowrap h-[38px]">
                              <Plus size={13} /> Add Row
                            </button>
                          </div>
                        </div>

                        {/* Rows grouped by ply */}
                        {plyNumbers.map(plyNum => {
                          const rows = form.plyRows.filter(r => r.PlyNumber === plyNum);
                          if (rows.length === 0) return null;
                          return (
                            <div key={plyNum} className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-blue-700 px-4 py-2 text-white text-xs font-bold uppercase tracking-widest">
                                Ply {plyNum} — Consumables
                              </div>
                              <div className="overflow-x-auto">
                                <div className="min-w-[820px]">
                                  <div className="grid bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider"
                                    style={{ gridTemplateColumns: "1.2fr 1.2fr 1.4fr 0.8fr 0.6fr 0.6fr 1.2fr 44px" }}>
                                    {["Item Group", "Item Sub Group", "Display Name", "Default GSM", "Min", "Max", "Share % Formula", ""].map(h => (
                                      <div key={h} className="px-3 py-2">{h}</div>
                                    ))}
                                  </div>
                                  <div className="divide-y divide-gray-100 bg-white">
                                    {rows.map(row => (
                                      <div key={row.id} className="grid hover:bg-blue-50/30 text-xs"
                                        style={{ gridTemplateColumns: "1.2fr 1.2fr 1.4fr 0.8fr 0.6fr 0.6fr 1.2fr 44px" }}>
                                        <div className="px-3 py-2.5">
                                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-semibold">{row.ItemGroupName}</span>
                                        </div>
                                        <div className="px-3 py-2.5 text-gray-700 font-medium">{row.ItemSubGroupName}</div>
                                        <div className="px-3 py-2.5 text-gray-600">{row.FieldDisplayName || "—"}</div>
                                        <div className="px-3 py-2.5 text-center text-gray-600 font-mono">{row.DefaultGSM}</div>
                                        <div className="px-3 py-2.5 text-center text-gray-500 font-mono">{row.MinimumValue}</div>
                                        <div className="px-3 py-2.5 text-center text-gray-500 font-mono">{row.MaximumValue}</div>
                                        <div className="px-3 py-2.5 text-gray-500 truncate">{row.SharePercentageFormula || "—"}</div>
                                        <div className="px-2 py-2.5 flex justify-center">
                                          <button onClick={() => f("plyRows", form.plyRows.filter(r => r.id !== row.id))}
                                            className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {form.plyRows.length === 0 && (
                          <div className="text-center text-xs text-gray-400 py-10 border-2 border-dashed border-gray-200 rounded-lg">
                            No consumable rows yet. Use the form above to define consumables for each ply.
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                          <button onClick={() => setActiveTab("dryweight")} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">← Dry Weight</button>
                          <button onClick={saveCategory} disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Save Category
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────────
  const columns: Column<CategoryRow>[] = [
    { key: "CategoryID", header: "ID", sortable: true },
    { key: "CategoryName", header: "Category Name", sortable: true },
    {
      key: "SegmentName", header: "Segment",
      render: r => r.SegmentName
        ? <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{r.SegmentName}</span>
        : <span className="text-gray-400">—</span>,
    },
    { key: "Orientation", header: "Orientation", render: r => r.Orientation || <span className="text-gray-400">—</span> },
    { key: "Layer", header: "Layer", render: r => r.Layer || <span className="text-gray-400">—</span> },
    { key: "Remark", header: "Remark", render: r => r.Remark ? <span className="text-xs text-gray-500">{r.Remark}</span> : <span className="text-gray-400">—</span> },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Category Master</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${filtered.length} of ${categories.length} categories`}
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Segment filter pills */}
      {uniqueSegments.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Segment</span>
            {uniqueSegments.map(s => (
              <button key={s} onClick={() => setFilterSegment(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterSegment === s ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {s === "All" ? "All Segments" : s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={filtered}
          columns={columns}
          searchKeys={["CategoryName", "SegmentName"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteCategory(row.CategoryID)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
