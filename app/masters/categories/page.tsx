"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List, X } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/categorymasterShrink`;

// Ã¢"â‚¬Ã¢"â‚¬ Unwrap triple-encoded JSON Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
function unwrap(raw: any): any {
  let r = raw;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

// Ã¢"â‚¬Ã¢"â‚¬ Shared UI Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
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

// Ã¢"â‚¬Ã¢"â‚¬ Types Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
type CategoryRow = {
  id: string;
  CategoryID: string;
  CategoryName: string;
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
  ShowIn: boolean;
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
  CategoryName: "", Layer: "", SegmentID: "", Remark: "",
  contents: [], processAllocations: [], coaRows: [], dryRows: [], plyRows: [],
});

// Layer string → max ply count
const layerToPlyCount = (layer: string): number => {
  if (!layer || layer.toLowerCase() === "mono") return 1;
  const m = layer.match(/(\d+)/);
  return m ? parseInt(m[1]) : 5;
};

const blankply = () => ({ PlyNumber: 1, ItemGroupID: "", ItemGroupName: "", ItemSubGroupName: "", FieldDisplayName: "", DefaultGSM: 0, MinimumValue: 0, MaximumValue: 0, SharePercentageFormula: "" });

const LAYERS = [
  { value: "Mono", label: "Mono" },
  { value: "2 Ply", label: "2 Ply" },
  { value: "3 Ply", label: "3 Ply" },
  { value: "4 Ply", label: "4 Ply" },
  { value: "5 Ply", label: "5 Ply" },
];

const blankcoa = () => ({
  TestParameterName: "", Specification: "", SpecificationFieldDataFromTable: "",
  SpecificationFieldValue: "", SpecificationFieldUnit: "",
  ResultDataFieldType: "", Defaults: "", ShowIn: false,
});
const blankdry = () => ({ Particular: "", GSM: 0, MinimumValue: 0, MaximumValue: 0, IsEditableField: true });

// Ã¢"â‚¬Ã¢"â‚¬ Page Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
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
  const [activeTab, setActiveTab] = useState<"detail" | "content" | "coa" | "ply">("detail");
  const [filterSegment, setFilterSegment] = useState("All");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [processModalContentId, setProcessModalContentId] = useState<string | null>(null);

  // Drafts
  const [coaDraft, setCoaDraft] = useState(blankcoa());
  const [dryDraft, setDryDraft] = useState(blankdry());
  const [plyDraft, setPlyDraft] = useState(blankply());
  const [plyDraftErr, setPlyDraftErr] = useState<Record<string, boolean>>({});
  const [itemGroupsFull, setItemGroupsFull] = useState<{ItemGroupID: string; ItemGroupName: string}[]>([]);
  const [itemSubGroups, setItemSubGroups] = useState<string[]>([]);
  const [allSubGroupsFull, setAllSubGroupsFull] = useState<{ItemSubGroupName: string; UnderSubGroupID: string}[]>([]);

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  // Ã¢"â‚¬Ã¢"â‚¬ Load list Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
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
    fetch(`${BASE_URL}/api/itemmasterShrink/group`, { headers: authHeaders() })
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

  // Ã¢"â‚¬Ã¢"â‚¬ Load content + process allocations Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
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

  // Ã¢"â‚¬Ã¢"â‚¬ Load COA rows for a category Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
  const fetchCoa = useCallback(async (categoryID: string): Promise<CoaRow[]> => {
    try {
      const res = await fetch(`${BASE}/categorywisegriddata/${categoryID}`, { headers: authHeaders() });
      const text = await res.text();
      console.log("fetchCoa raw response (CategoryID=" + categoryID + "):", text);
      const raw = unwrap(text);
      console.log("fetchCoa unwrapped:", raw);
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
        ShowIn: r.ShowIn === true || r.ShowIn === 1 || r.ShowIn === "1" || r.ShowIn === "true",
      }));
    } catch (e) {
      console.error("fetchCoa error:", e);
      return [];
    }
  }, []);

  // Ã¢"â‚¬Ã¢"â‚¬ Load ply configuration for a category Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
  const fetchPlyConfig = useCallback(async (categoryID: string, groups: {ItemGroupID: string; ItemGroupName: string}[]): Promise<PlyConfigRow[]> => {
    try {
      const res = await fetch(`${BASE}/getplyconfiguration/${categoryID}`, { headers: authHeaders() });
      const raw = unwrap(await res.text());
      const rows: any[] = Array.isArray(raw) ? raw : [];
      return rows.map(r => {
        const name = r.ItemGroupName ?? "";
        // ItemGroupID is not stored in CategoryPlyConfiguration — resolve it by matching name
        const grp = groups.find(g => g.ItemGroupName === name);
        return {
          id: uid(),
          PlyNumber: Number(r.PlyNumber ?? 1),
          ItemGroupID: grp ? String(grp.ItemGroupID) : "",
          ItemGroupName: name,
          ItemSubGroupName: r.ItemSubGroupName ?? "",
          FieldDisplayName: r.FieldDisplayName ?? "",
          DefaultGSM: Number(r.DefaultGSM ?? 0),
          MinimumValue: Number(r.MinimumValue ?? 0),
          MaximumValue: Number(r.MaximumValue ?? 0),
          SharePercentageFormula: r.SharePercentageFormula ?? "",
        };
      });
    } catch { return []; }
  }, []);

  // Ã¢"â‚¬Ã¢"â‚¬ Open add Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
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

  // Ã¢"â‚¬Ã¢"â‚¬ Open edit Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
  const openEdit = async (row: CategoryRow) => {
    setEditing(row);
    setError("");
    setActiveTab("detail");
    setFormLoading(true);
    setView("form");
    const [{ contents, processAllocations }, coaRows, plyRows] = await Promise.all([
      fetchContents(row.CategoryID),
      fetchCoa(row.CategoryID),
      fetchPlyConfig(row.CategoryID, itemGroupsFull),
    ]);
    
    console.log("COA Data on Edit Click (fetchCoa):", coaRows);

    setForm({
      CategoryName: row.CategoryName ?? "",
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

  // Ã¢"â‚¬Ã¢"â‚¬ Toggle content selection Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
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

  // Ã¢"â‚¬Ã¢"â‚¬ Toggle process allocation for a content Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
  const toggleProcessAllocation = (processID: string, contentID: string) => {
    setForm(p => {
      const exists = p.processAllocations.some(a => a.ProcessID === processID && a.ContentID === contentID);
      if (exists) {
        return { ...p, processAllocations: p.processAllocations.filter(a => !(a.ProcessID === processID && a.ContentID === contentID)) };
      }
      return { ...p, processAllocations: [...p.processAllocations, { ProcessID: processID, ContentID: contentID }] };
    });
  };

  // Ã¢"â‚¬Ã¢"â‚¬ Save Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
  const saveCategory = async () => {
    setSubmitAttempted(true);
    if (!form.CategoryName.trim()) { setError("Finish Goods Category Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const selectedContents = form.contents.filter(c => c.IsSelected);

      const masterRecord: Record<string, any> = {
        CategoryName: form.CategoryName,
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
        ShowIn: r.ShowIn ? 1 : 0,
      }));

      // Only send process allocations for selected contents
      const selectedContentIDs = new Set(selectedContents.map(c => c.ContentID));
      const processAllocPayload = form.processAllocations
        .filter(a => selectedContentIDs.has(a.ContentID))
        .map(a => ({ ProcessID: a.ProcessID, ContentID: a.ContentID }));

      // Note: 'id' (client uid) and 'ItemGroupID' excluded — neither exists as a column in CategoryPlyConfiguration
      const plyConfigPayload = form.plyRows.map(r => ({
        PlyNumber: r.PlyNumber,
        ItemGroupName: r.ItemGroupName,
        ItemSubGroupName: r.ItemSubGroupName,
        FieldDisplayName: r.FieldDisplayName,
        DefaultGSM: r.DefaultGSM,
        MinimumValue: r.MinimumValue,
        MaximumValue: r.MaximumValue,
        SharePercentageFormula: r.SharePercentageFormula,
      }));

      console.log("COA Payload rows:", coaPayload.length, coaPayload);

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

  // Ã¢"â‚¬Ã¢"â‚¬ Delete Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
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

  // Ã¢"â‚¬Ã¢"â‚¬ List derived Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
  const uniqueSegments = useMemo(() =>
    ["All", ...new Set(categories.map(c => c.SegmentName).filter(Boolean))],
    [categories]);

  const filtered = useMemo(() =>
    filterSegment === "All" ? categories : categories.filter(c => c.SegmentName === filterSegment),
    [categories, filterSegment]);

  // Ã¢"â‚¬Ã¢"â‚¬ Process modal Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
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

  // Ã¢"â‚¬Ã¢"â‚¬ FORM VIEW Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
  if (view === "form") {
    const tabs = [
      { key: "detail" as const, label: "Finish Goods Category Detail" },
      { key: "content" as const, label: "Content Allocation" },
      { key: "coa" as const, label: "COA Parameters" },
      { key: "ply" as const, label: "Ply Configuration" },
    ];

    return (
      <>
        <ProcessModal />
        <div className="max-w-5xl mx-auto pb-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div>
              <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">Finish Goods Category Master</p>
              <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit Finish Goods Category" : "New Finish Goods Category"}</h2>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <List size={16} /> Back to List
              </button>
              <button onClick={saveCategory} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Save Finish Goods Category
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
                  {/* Ã¢"â‚¬Ã¢"â‚¬ DETAIL TAB Ã¢"â‚¬Ã¢"â‚¬ */}
                  {activeTab === "detail" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div>
                        <SectionTitle title="Finish Goods Category Identity" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-2">
                            <Field label="Finish Goods Category Name" required>
                              <input type="text" value={form.CategoryName} onChange={e => f("CategoryName", e.target.value)}
                                placeholder="e.g. Gravure - Solvent Base 2 Ply" className={ic(submitAttempted && !form.CategoryName.trim())} />
                            </Field>
                          </div>
                          <div className="md:col-span-3">
                            <Field label="Remark">
                              <textarea value={form.Remark} onChange={e => f("Remark", e.target.value)} rows={2}
                                placeholder="Remarks..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                            </Field>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button onClick={() => setActiveTab("content")} className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                          Content Allocation →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ã¢"â‚¬Ã¢"â‚¬ CONTENT ALLOCATION TAB Ã¢"â‚¬Ã¢"â‚¬ */}
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
                                      onError={e => {
                                        const img = e.target as HTMLImageElement;
                                        const fallback = `/${card.ContentClosedHref.replace(/^\//, "")}`;
                                        if (img.src !== window.location.origin + fallback) { img.src = fallback; } else { img.style.display = "none"; }
                                      }}
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
                        <button onClick={() => setActiveTab("coa")} className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">COA Parameters →</button>
                      </div>
                    </div>
                  )}

                  {/* Ã¢"â‚¬Ã¢"â‚¬ COA PARAMETERS TAB Ã¢"â‚¬Ã¢"â‚¬ */}
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
                        ] as const).map(([label, key]) => (
                          <div key={key}>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">{label}</label>
                            <input className={inputCls + " text-xs"} value={(coaDraft as any)[key]}
                              onChange={e => setCoaDraft(p => ({ ...p, [key]: e.target.value }))} placeholder={label.replace(" *", "")} />
                          </div>
                        ))}
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Show In</label>
                          <label className="flex items-center gap-2 h-[38px] cursor-pointer">
                            <input type="checkbox" checked={coaDraft.ShowIn}
                              onChange={e => setCoaDraft(p => ({ ...p, ShowIn: e.target.checked }))}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                            <span className="text-xs text-gray-600">Show In Report</span>
                          </label>
                        </div>
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
                                <div className="px-3 py-3 text-gray-600 truncate">{row.ShowIn ? "Yes" : "No"}</div>
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
                        <button onClick={() => setActiveTab("ply")} className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Ply Configuration →</button>
                      </div>
                    </div>
                  )}

                  {/* Ã¢"â‚¬Ã¢"â‚¬ PLY CONFIGURATION TAB Ã¢"â‚¬Ã¢"â‚¬ */}
                  {activeTab === "ply" && (() => {
                    const maxPly = layerToPlyCount(form.Layer);
                    const plyNumbers = Array.from({ length: maxPly }, (_, i) => i + 1);
                    return (
                      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between">
                          <SectionTitle title="Ply Configuration" />
                          <span className="text-xs text-gray-400">Max Plies: <strong className="text-blue-600">{maxPly}</strong> (based on Ply: {form.Layer || "not set"})</span>
                        </div>

                        {/* Ply (Layer) Selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-2">
                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                              Ply <span className="text-red-500">*</span>
                            </label>
                            <select value={form.Layer} onChange={e => f("Layer", e.target.value)} className={inputCls}>
                              <option value="">Select Ply...</option>
                              {LAYERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* Draft input */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                          <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Add Consumable Layer</p>
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
                                className={(plyDraftErr.ItemGroupID ? ic(true) : inputCls) + " text-xs"}
                                value={plyDraft.ItemGroupID}
                                onChange={e => {
                                  const id = e.target.value;
                                  const grp = itemGroupsFull.find(g => String(g.ItemGroupID) === id);
                                  const name = grp?.ItemGroupName ?? "";
                                  setPlyDraft(p => ({ ...p, ItemGroupID: id, ItemGroupName: name, ItemSubGroupName: "" }));
                                  setPlyDraftErr(p => ({ ...p, ItemGroupID: false }));
                                  setItemSubGroups([]);
                                  if (id) {
                                    fetch(`${BASE}/getitemsubgroupsforply/${id}`, { headers: authHeaders() })
                                      .then(r => r.text())
                                      .then(text => {
                                        const raw = unwrap(text);
                                        if (Array.isArray(raw) && raw.length > 0) {
                                          setItemSubGroups(raw.map((s: any) => String(s.ItemSubGroupName ?? "")).filter(Boolean));
                                        } else {
                                          const fallback = allSubGroupsFull
                                            .filter(s => String(s.UnderSubGroupID) === String(id) && s.ItemSubGroupName)
                                            .map(s => s.ItemSubGroupName);
                                          setItemSubGroups(fallback);
                                        }
                                      })
                                      .catch(() => {
                                        const fallback = allSubGroupsFull
                                          .filter(s => String(s.UnderSubGroupID) === String(id) && s.ItemSubGroupName)
                                          .map(s => s.ItemSubGroupName);
                                        setItemSubGroups(fallback);
                                      });
                                  }
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
                                className={(plyDraftErr.ItemSubGroupName ? ic(true) : inputCls) + " text-xs"}
                                value={plyDraft.ItemSubGroupName}
                                onChange={e => { setPlyDraft(p => ({ ...p, ItemSubGroupName: e.target.value })); setPlyDraftErr(p => ({ ...p, ItemSubGroupName: false })); }}
                                disabled={!plyDraft.ItemGroupID}
                              >
                                <option value="">— Select Sub Group —</option>
                                {itemSubGroups.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Field Display Name *</label>
                              <input className={(plyDraftErr.FieldDisplayName ? ic(true) : inputCls) + " text-xs"} placeholder="e.g. Ink Wet Weight"
                                value={plyDraft.FieldDisplayName}
                                onChange={e => { setPlyDraft(p => ({ ...p, FieldDisplayName: e.target.value })); setPlyDraftErr(p => ({ ...p, FieldDisplayName: false })); }} />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Default Dry GSM *</label>
                              <input className={(plyDraftErr.DefaultGSM ? ic(true) : inputCls) + " text-xs"} type="number" placeholder="0.00"
                                value={plyDraft.DefaultGSM}
                                onChange={e => { setPlyDraft(p => ({ ...p, DefaultGSM: Number(e.target.value) })); setPlyDraftErr(p => ({ ...p, DefaultGSM: false })); }} />
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
                                const errs: Record<string, boolean> = {};
                                if (!plyDraft.ItemGroupID) errs.ItemGroupID = true;
                                if (!plyDraft.ItemSubGroupName) errs.ItemSubGroupName = true;
                                if (!plyDraft.FieldDisplayName.trim()) errs.FieldDisplayName = true;
                                if (!plyDraft.DefaultGSM || plyDraft.DefaultGSM <= 0) errs.DefaultGSM = true;
                                if (Object.keys(errs).length > 0) { setPlyDraftErr(errs); return; }
                                setPlyDraftErr({});
                                f("plyRows", [...form.plyRows, { id: uid(), ...plyDraft }]);
                                setPlyDraft(blankply());
                                setItemSubGroups([]);
                              }}
                              className="px-5 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 flex items-center gap-1.5 whitespace-nowrap h-[38px]">
                              <Plus size={13} /> + Add Layer
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
                                    {["Item Group", "Item Sub Group", "Display Name", "Default Dry GSM", "Min", "Max", "Share % Formula", ""].map(h => (
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
                          <button onClick={() => setActiveTab("coa")} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">← COA Parameters</button>
                          <button onClick={saveCategory} disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Save Finish Goods Category
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

  // Ã¢"â‚¬Ã¢"â‚¬ LIST VIEW Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬Ã¢"â‚¬
  const columns: Column<CategoryRow>[] = [
    { key: "CategoryID", header: "ID", sortable: true },
    { key: "CategoryName", header: "Finish Goods Category Name", sortable: true },
    { key: "Remark", header: "Remark", render: r => r.Remark ? <span className="text-xs text-gray-500">{r.Remark}</span> : <span className="text-gray-400">—</span> },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Finish Goods Category Master</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${filtered.length} of ${categories.length} categories`}
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Finish Goods Category
        </button>
      </div>


      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={filtered}
          columns={columns}
          searchKeys={["CategoryName"]}
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
