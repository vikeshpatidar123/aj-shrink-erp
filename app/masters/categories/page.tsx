"use client";
import { useState } from "react";
import {
  Plus, Pencil, Trash2, Save, List, Check, X, LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { CategoryMaster as Category, CATEGORY_GROUP_SUBGROUP } from "@/data/dummyData";
import { useCategories } from "@/context/CategoriesContext";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { inputCls } from "@/lib/styles";

// ─── Types ────────────────────────────────────────────────────

type DryWeightRow = {
  id: string; particular: string; grmPerM2: number;
  minValue: number; maxValue: number; isEditable: boolean;
};

type ConsumableRow = {
  id: string;
  plyType: string;           // "Film" | "Printing" | "Lamination" | "Coating"
  itemGroup: string;         // "Film" | "Ink" | "Solvent" | "Adhesive" | "Hardner"
  itemSubGroup: string;
  fieldName: string;
  calcFieldName: string;
  fieldDisplayName: string;
  defaultValue: number; minValue: number; maxValue: number;
  sharePercentageFormula: string;
};

type ContentCard = {
  id: string; name: string; selected: boolean; defaultContent: boolean;
};

type CoaRow = {
  id: string;
  coaWise: "Category wise" | "Client and category wise";
  test: string;
  specification: string;
  specFieldType: "Text Field" | "Data Field" | "Combo Field";
  specFieldDataFrom: string;
  specFieldValue: string;
  specFieldUnit: string;
  resultData: string;
  defaultValue: string;
  showIn: string;
};

type FullCategory = Category & {
  orientation: string; division: string; ply: string;
  contentCards: ContentCard[];
  coaRows: CoaRow[];
  dryWeightRows: DryWeightRow[];
  consumableRows: ConsumableRow[];
};

// ─── Constants ────────────────────────────────────────────────

const CONTENT_TEMPLATES: ContentCard[] = [
  { id: "c1", name: "Roto - Label", selected: true, defaultContent: true },
  { id: "c2", name: "Roto - Center Seal Pouch", selected: false, defaultContent: false },
  { id: "c3", name: "Roto - Zipper Pouch", selected: false, defaultContent: false },
  { id: "c4", name: "Roto - 3 Side Seal Pouch", selected: false, defaultContent: false },
  { id: "c5", name: "Roto - 4 Side Seal Pouch", selected: false, defaultContent: false },
  { id: "c6", name: "Roto - Stand Up Pouch", selected: false, defaultContent: false },
  { id: "c7", name: "Roto - Back Seal Pouch", selected: false, defaultContent: false },
  { id: "c8", name: "Roto - Laminated Roll", selected: false, defaultContent: false },
  { id: "c9", name: "Roto - Shrink Film", selected: false, defaultContent: false },
  { id: "c10", name: "Roto - Shrink Sleeve", selected: false, defaultContent: false },
  { id: "c11", name: "Roto - Wrap Around Label", selected: false, defaultContent: false },
  { id: "c12", name: "Roto - Flat Pouch", selected: false, defaultContent: false },
];

const TABS = [
  "Category Field",
  "Content Allocation",
  "Coa Parameter Allocation",
  "Dry Weight(GSM) Setting",
  "Ply Configuration",
];

const ORIENTATIONS = ["2D", "3D"];
const DIVISIONS = ["Gravure", "Digital"];
const PLYS = ["2 Ply", "3 Ply", "5 Ply", "Mono Ply"];
const PLY_TYPES = ["Film", "Printing", "Lamination", "Coating"];
const RM_GROUPS = Object.keys(CATEGORY_GROUP_SUBGROUP["Raw Material (RM)"] ?? {});

const uid = () => Math.random().toString(36).slice(2, 8);

const blankCategory = (): Omit<FullCategory, "id"> => ({
  name: "",
  description: "",
  status: "Active",
  orientation: "2D",
  division: "Gravure",
  ply: "2 Ply",
  contentCards: CONTENT_TEMPLATES.map(c => ({ ...c })),
  coaRows: [],
  dryWeightRows: [],
  consumableRows: [],
});

// ─── Sub-components ────────────────────────────────────────────

const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">
    {title}
  </h3>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-teal-800 uppercase tracking-wider">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const selectCls = `${inputCls} appearance-none cursor-pointer pr-8`;

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select className={selectCls} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      {value && (
        <button className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500" onClick={() => onChange("")}>
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// Card image placeholder for content types
function ContentIcon({ name }: { name: string }) {
  return (
    <div className="w-16 h-14 bg-yellow-300 rounded border border-yellow-400 flex items-center justify-center text-[8px] text-yellow-800 font-bold text-center px-1 leading-tight shadow-sm">
      {name.split(" ").slice(0, 2).join("\n")}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function CategoryMasterPage() {
  const { categories: ctxCategories, saveCategory: ctxSave, deleteCategory: ctxDelete } = useCategories();

  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<FullCategory[]>(
    ctxCategories.map(c => ({
      ...c,
      orientation: "2D", division: "Gravure", ply: "2 Ply",
      contentCards: CONTENT_TEMPLATES.map(x => ({ ...x })),
      coaRows: [], dryWeightRows: [],
      consumableRows: (c.plyConsumables ?? []).map(pc => ({
        id: pc.id, plyType: pc.plyType, itemGroup: pc.itemGroup,
        itemSubGroup: pc.itemSubGroup, fieldName: "", calcFieldName: "",
        fieldDisplayName: pc.fieldDisplayName, defaultValue: pc.defaultValue,
        minValue: pc.minValue, maxValue: pc.maxValue,
        sharePercentageFormula: pc.sharePercentageFormula,
      })),
    }))
  );
  const [editing, setEditing] = useState<FullCategory | null>(null);
  const [form, setForm] = useState<Omit<FullCategory, "id">>(blankCategory());
  const [activeTab, setActiveTab] = useState(0);

  // Drafts for grid rows
  const [coaDraft, setCoaDraft] = useState<Omit<CoaRow, "id">>({
    coaWise: "Category wise", test: "", specification: "",
    specFieldType: "Text Field", specFieldDataFrom: "",
    specFieldValue: "", specFieldUnit: "", resultData: "",
    defaultValue: "", showIn: "",
  });

  // DryWeight new row draft
  const [dryDraft, setDryDraft] = useState<Omit<DryWeightRow, "id">>({ particular: "", grmPerM2: 1, minValue: 0, maxValue: 10, isEditable: true });
  const [consDraft, setConsDraft] = useState<Omit<ConsumableRow, "id">>({ plyType: "", itemGroup: "", itemSubGroup: "", fieldName: "", calcFieldName: "", fieldDisplayName: "", defaultValue: 0, minValue: 0, maxValue: 10, sharePercentageFormula: "" });

  const f = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => {
    setEditing(null);
    setForm(blankCategory());
    setActiveTab(0);
    setView("form");
  };

  const openEdit = (row: FullCategory) => {
    setEditing(row);
    const { id, ...rest } = row;
    setForm(rest);
    setActiveTab(0);
    setView("form");
  };

  const save = () => {
    if (!form.name) return;
    // Map consumableRows → CategoryPlyConsumable[] for shared context
    const plyConsumables = form.consumableRows.map(r => ({
      id: r.id, plyType: r.plyType, itemGroup: r.itemGroup,
      itemSubGroup: r.itemSubGroup, fieldDisplayName: r.fieldDisplayName,
      defaultValue: r.defaultValue, minValue: r.minValue, maxValue: r.maxValue,
      sharePercentageFormula: r.sharePercentageFormula,
    }));
    const contents = form.contentCards.filter(c => c.selected).map(c => c.name);
    if (editing) {
      const updated: FullCategory = { ...form, id: editing.id };
      setData(d => d.map(r => r.id === editing.id ? updated : r));
      ctxSave({ id: editing.id, name: form.name, description: form.description, status: form.status, contents, plyConsumables });
    } else {
      const id = `CAT${String(data.length + 1).padStart(3, "0")}`;
      setData(d => [...d, { ...form, id }]);
      ctxSave({ id, name: form.name, description: form.description, status: form.status, contents, plyConsumables });
    }
    setView("list");
  };

  const deleteRow = (id: string) => {
    if (confirm("Delete this category?")) {
      setData(d => d.filter(r => r.id !== id));
      ctxDelete(id);
    }
  };

  const toggleCard = (idx: number, field: "selected" | "defaultContent") => {
    const cards = [...form.contentCards];
    cards[idx] = { ...cards[idx], [field]: !cards[idx][field] };
    f("contentCards", cards);
  };

  const columns: Column<FullCategory>[] = [
    { key: "id", header: "Code", sortable: true },
    { key: "name", header: "Category Name", sortable: true },
    { key: "division", header: "Division", render: r => <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">{r.division || "—"}</span> },
    { key: "ply", header: "Ply", render: r => <span className="text-xs text-gray-600">{r.ply || "—"}</span> },
    {
      key: "status", header: "Status", render: r => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${r.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.status}</span>
      )
    },
  ];

  // ── FORM VIEW ────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-6xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
            <h2 className="text-xl font-bold text-gray-800">Category Master Creation/Updation</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <List size={15} /> List ({data.length})
            </button>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors">
              <Plus size={15} /> New
            </button>
            <button onClick={save} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors shadow-sm">
              <Save size={15} /> Save
            </button>
            <button onClick={() => { setForm(blankCategory()); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors">
              Save As
            </button>
            <button onClick={() => editing && deleteRow(editing.id)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
              <Trash2 size={15} /> Delete
            </button>
            <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-500 rounded-lg hover:bg-gray-600 transition-colors">
              <X size={15} /> Close
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200 bg-gray-50">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-3 text-xs font-semibold tracking-wide transition-all whitespace-nowrap
                  ${activeTab === i
                    ? "bg-teal-700 text-white border-b-2 border-teal-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-teal-700"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ─── TAB 0: Category Field ─── */}
            {activeTab === 0 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {editing && (
                  <span className="inline-block px-3 py-1 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full">
                    Editing: {editing.name}
                  </span>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="sm:col-span-2">
                    <Field label="Category Name" required>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => f("name", e.target.value)}
                        placeholder="e.g. Gravure - Solvent Base 2 Layer"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <div>
                    <Field label="Orientation">
                      <SelectField value={form.orientation} onChange={v => f("orientation", v)} options={ORIENTATIONS} />
                    </Field>
                  </div>
                  <div>
                    <Field label="Division">
                      <SelectField value={form.division} onChange={v => f("division", v)} options={DIVISIONS} />
                    </Field>
                  </div>
                  <div>
                    <Field label="Ply">
                      <SelectField value={form.ply} onChange={v => f("ply", v)} options={PLYS} />
                    </Field>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => f("status", form.status === "Active" ? "Inactive" : "Active")}
                    className={`w-12 h-6 rounded-full transition-colors relative ${form.status === "Active" ? "bg-teal-500" : "bg-gray-300"}`}
                  >
                    <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${form.status === "Active" ? "left-7" : "left-1"}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">Active Category</span>
                </div>
              </div>
            )}

            {/* ─── TAB 1: Content Allocation ─── */}
            {activeTab === 1 && (
              <div className="animate-in fade-in duration-200">
                <SectionTitle title="All Contents" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {form.contentCards.map((card, idx) => (
                    <div key={card.id}
                      className={`rounded-xl border-2 p-3 transition-all bg-white
                        ${card.selected ? "border-teal-500 shadow-md" : "border-gray-200 hover:border-teal-300"}`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <ContentIcon name={card.name} />
                        <p className="text-xs font-semibold text-blue-700 leading-tight mt-1">{card.name}</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={card.selected}
                            onChange={() => toggleCard(idx, "selected")}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                          <span className="text-xs text-gray-600">Select Content</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={card.defaultContent}
                            onChange={() => toggleCard(idx, "defaultContent")}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                          <span className="text-xs text-gray-600">Default Content</span>
                        </label>
                        <button
                          onClick={() => {
                            const cards = [...form.contentCards];
                            cards[idx] = { ...cards[idx], selected: true };
                            f("contentCards", cards);
                          }}
                          className="w-full mt-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold rounded transition-colors"
                        >
                          Allocate Processes
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── TAB 2: Coa Parameter Allocation ─── */}
            {activeTab === 2 && (
              <div className="animate-in fade-in duration-200 space-y-4">

                {/* Radio: Category wise / Client and category wise */}
                <div className="flex items-center gap-6">
                  {(["Category wise", "Client and category wise"] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => setCoaDraft(p => ({ ...p, coaWise: opt }))}
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors
                          ${coaDraft.coaWise === opt ? "border-teal-600" : "border-gray-400"}`}
                      >
                        {coaDraft.coaWise === opt && <div className="w-2 h-2 rounded-full bg-teal-600" />}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>

                {/* Form row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Test</label>
                    <input
                      className={inputCls + " text-xs"}
                      placeholder="Test"
                      value={coaDraft.test}
                      onChange={e => setCoaDraft(p => ({ ...p, test: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Specification</label>
                    <div className="relative">
                      <select
                        className={selectCls + " text-xs"}
                        value={coaDraft.specFieldType}
                        onChange={e => setCoaDraft(p => ({ ...p, specFieldType: e.target.value as CoaRow["specFieldType"] }))}
                      >
                        <option value="">Select Specification</option>
                        <option value="Text Field">Text Field</option>
                        <option value="Data Field">Data Field</option>
                        <option value="Combo Field">Combo Field</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Specification Field Data From</label>
                    <div className="relative">
                      <select
                        className={selectCls + " text-xs"}
                        value={coaDraft.specFieldDataFrom}
                        onChange={e => setCoaDraft(p => ({ ...p, specFieldDataFrom: e.target.value }))}
                      >
                        <option value="">Select Spec Field Data From</option>
                        <option value="Recipe">Recipe</option>
                        <option value="Item Master">Item Master</option>
                        <option value="Manual">Manual</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Specification Field Value</label>
                    <div className="relative">
                      <select
                        className={selectCls + " text-xs"}
                        value={coaDraft.specFieldValue}
                        onChange={e => setCoaDraft(p => ({ ...p, specFieldValue: e.target.value }))}
                      >
                        <option value="">Select Specification Field Value</option>
                        <option value="GSM">GSM</option>
                        <option value="Thickness">Thickness</option>
                        <option value="Width">Width</option>
                        <option value="Length">Length</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Specification Field Unit</label>
                    <input
                      className={inputCls + " text-xs"}
                      placeholder="e.g. g/m², μm"
                      value={coaDraft.specFieldUnit}
                      onChange={e => setCoaDraft(p => ({ ...p, specFieldUnit: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Result Data</label>
                    <div className="relative">
                      <select
                        className={selectCls + " text-xs"}
                        value={coaDraft.resultData}
                        onChange={e => setCoaDraft(p => ({ ...p, resultData: e.target.value }))}
                      >
                        <option value="">Select Module</option>
                        <option value="Production">Production</option>
                        <option value="QC">QC</option>
                        <option value="Dispatch">Dispatch</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Default</label>
                    <input
                      className={inputCls + " text-xs"}
                      placeholder="Default value"
                      value={coaDraft.defaultValue}
                      onChange={e => setCoaDraft(p => ({ ...p, defaultValue: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        if (!coaDraft.test && !coaDraft.specFieldType) return;
                        const newRow: CoaRow = { id: uid(), ...coaDraft };
                        f("coaRows", [...form.coaRows, newRow]);
                        setCoaDraft(p => ({ ...p, test: "", specification: "", specFieldDataFrom: "", specFieldValue: "", specFieldUnit: "", resultData: "", defaultValue: "", showIn: "" }));
                      }}
                      className="w-full px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus size={13} /> Add Row
                    </button>
                  </div>
                </div>

                {/* Grid Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto mt-2">
                  <div className="min-w-[900px]">
                    {/* Header */}
                    <div className="grid bg-teal-800 text-white text-xs font-semibold"
                      style={{ gridTemplateColumns: "1fr 1.2fr 1.2fr 1.2fr 1fr 1fr 1fr 0.8fr 60px" }}>
                      {["Test", "Specification", "From Ta...", "Specification Field Value", "Specification Field Unit", "ResultData", "Default", "Show In", "Actions"].map(h => (
                        <div key={h} className="px-3 py-3 truncate">{h}</div>
                      ))}
                    </div>
                    {/* Rows */}
                    <div className="divide-y divide-gray-100 bg-white min-h-[120px]">
                      {form.coaRows.map(row => (
                        <div key={row.id}
                          className="grid hover:bg-gray-50 transition-colors text-xs"
                          style={{ gridTemplateColumns: "1fr 1.2fr 1.2fr 1.2fr 1fr 1fr 1fr 0.8fr 60px" }}
                        >
                          <div className="px-3 py-3 text-gray-700 font-medium truncate">{row.test || "—"}</div>
                          <div className="px-3 py-3 text-gray-600 truncate">{row.specFieldType}</div>
                          <div className="px-3 py-3 text-gray-600 truncate">{row.specFieldDataFrom || "—"}</div>
                          <div className="px-3 py-3 text-gray-600 truncate">{row.specFieldValue || "—"}</div>
                          <div className="px-3 py-3 text-gray-600 truncate">{row.specFieldUnit || "—"}</div>
                          <div className="px-3 py-3 text-gray-600 truncate">{row.resultData || "—"}</div>
                          <div className="px-3 py-3 text-gray-600 truncate">{row.defaultValue || "—"}</div>
                          <div className="px-3 py-3 text-gray-600 truncate">{row.showIn || "—"}</div>
                          <div className="px-3 py-3 flex justify-center">
                            <button
                              onClick={() => f("coaRows", form.coaRows.filter(r => r.id !== row.id))}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {form.coaRows.length === 0 && (
                        <div className="text-center text-xs text-gray-400 py-10 font-medium">No data</div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ─── TAB 3: Dry Weight (GSM) Setting ─── */}
            {activeTab === 3 && (
              <div className="animate-in fade-in duration-200 space-y-4">
                <div className="flex items-center justify-between">
                  <SectionTitle title="Division Layer Setting" />
                  <button
                    onClick={() => {
                      const newRow: DryWeightRow = { id: uid(), ...dryDraft };
                      f("dryWeightRows", [...form.dryWeightRows, newRow]);
                      setDryDraft({ particular: "", grmPerM2: 1, minValue: 0, maxValue: 10, isEditable: true });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-teal-700 bg-teal-50 border border-teal-300 rounded-lg text-sm hover:bg-teal-100 transition-colors mb-2"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>

                {/* New row input */}
                <div className="grid grid-cols-6 gap-2 bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs">
                  <input className={inputCls + " text-xs"} placeholder="Particular" value={dryDraft.particular} onChange={e => setDryDraft(p => ({ ...p, particular: e.target.value }))} />
                  <input className={inputCls + " text-xs"} type="number" placeholder="Grm/m²" value={dryDraft.grmPerM2} onChange={e => setDryDraft(p => ({ ...p, grmPerM2: Number(e.target.value) }))} />
                  <input className={inputCls + " text-xs"} type="number" placeholder="Min Value" value={dryDraft.minValue} onChange={e => setDryDraft(p => ({ ...p, minValue: Number(e.target.value) }))} />
                  <input className={inputCls + " text-xs"} type="number" placeholder="Max Value" value={dryDraft.maxValue} onChange={e => setDryDraft(p => ({ ...p, maxValue: Number(e.target.value) }))} />
                  <label className="flex items-center gap-2 px-2">
                    <input type="checkbox" checked={dryDraft.isEditable} onChange={e => setDryDraft(p => ({ ...p, isEditable: e.target.checked }))} className="w-4 h-4 text-teal-600" />
                    <span className="text-gray-600 text-xs">Editable</span>
                  </label>
                  <button
                    onClick={() => {
                      const newRow: DryWeightRow = { id: uid(), ...dryDraft };
                      f("dryWeightRows", [...form.dryWeightRows, newRow]);
                      setDryDraft({ particular: "", grmPerM2: 1, minValue: 0, maxValue: 10, isEditable: true });
                    }}
                    className="px-3 py-2 bg-teal-700 text-white text-xs rounded hover:bg-teal-800 transition-colors"
                  >
                    + Add
                  </button>
                </div>

                {/* Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-6 bg-teal-800 text-white text-xs font-semibold">
                    <div className="px-4 py-3">Particular</div>
                    <div className="px-4 py-3 text-center">Grm/m²</div>
                    <div className="px-4 py-3 text-center">Min. Value</div>
                    <div className="px-4 py-3 text-center">Max. Value</div>
                    <div className="px-4 py-3 text-center">Is Editable</div>
                    <div className="px-4 py-3 text-center">Action</div>
                  </div>
                  <div className="divide-y divide-gray-100 bg-white min-h-[80px]">
                    {form.dryWeightRows.map(row => (
                      <div key={row.id} className="grid grid-cols-6 text-sm hover:bg-gray-50 transition-colors">
                        <div className="px-4 py-3 font-medium text-gray-700">{row.particular}</div>
                        <div className="px-4 py-3 text-center text-gray-600">{row.grmPerM2}</div>
                        <div className="px-4 py-3 text-center text-gray-600">{row.minValue}</div>
                        <div className="px-4 py-3 text-center text-gray-600">{row.maxValue}</div>
                        <div className="px-4 py-3 flex justify-center">
                          {row.isEditable
                            ? <Check size={16} className="text-teal-600" />
                            : <X size={16} className="text-gray-400" />}
                        </div>
                        <div className="px-4 py-3 flex justify-center">
                          <button
                            onClick={() => f("dryWeightRows", form.dryWeightRows.filter(r => r.id !== row.id))}
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {form.dryWeightRows.length === 0 && (
                      <div className="text-center text-xs text-gray-400 py-8">No rows added. Use Add Row above.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 4: Ply Configuration ─── */}
            {activeTab === 4 && (
              <div className="animate-in fade-in duration-200 space-y-4">
                <SectionTitle title="Ply Configuration" />
                <p className="text-xs text-gray-500">Define consumables required for each ply. These drive automatic ply setup and item selection in Cost Estimation.</p>

                {/* ── Draft input row ── */}
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-3">
                  <p className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Add New Consumable Row</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Ply Type */}
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Ply Type *</label>
                      <div className="relative">
                        <select className={selectCls + " text-xs"} value={consDraft.plyType}
                          onChange={e => setConsDraft(p => ({ ...p, plyType: e.target.value }))}>
                          <option value="">-- Select Ply Type --</option>
                          {PLY_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                        </select>
                        <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    {/* Item Group */}
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Item Group *</label>
                      <div className="relative">
                        <select className={selectCls + " text-xs"} value={consDraft.itemGroup}
                          onChange={e => setConsDraft(p => ({ ...p, itemGroup: e.target.value, itemSubGroup: "" }))}>
                          <option value="">-- Select Item Group --</option>
                          {RM_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    {/* Item Sub Group (cascaded) */}
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Item Sub Group *</label>
                      <div className="relative">
                        <select className={selectCls + " text-xs"} value={consDraft.itemSubGroup}
                          onChange={e => setConsDraft(p => ({ ...p, itemSubGroup: e.target.value }))}
                          disabled={!consDraft.itemGroup}>
                          <option value="">-- Select Sub Group --</option>
                          {(CATEGORY_GROUP_SUBGROUP["Raw Material (RM)"]?.[consDraft.itemGroup] ?? []).map(sg => (
                            <option key={sg} value={sg}>{sg}</option>
                          ))}
                        </select>
                        <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Field Display Name</label>
                      <input className={inputCls + " text-xs"} placeholder="e.g. Ink Wet Weight" value={consDraft.fieldDisplayName}
                        onChange={e => setConsDraft(p => ({ ...p, fieldDisplayName: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Default GSM</label>
                      <input className={inputCls + " text-xs"} type="number" placeholder="0.00" value={consDraft.defaultValue}
                        onChange={e => setConsDraft(p => ({ ...p, defaultValue: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Min Value</label>
                      <input className={inputCls + " text-xs"} type="number" placeholder="0" value={consDraft.minValue}
                        onChange={e => setConsDraft(p => ({ ...p, minValue: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Max Value</label>
                      <input className={inputCls + " text-xs"} type="number" placeholder="10" value={consDraft.maxValue}
                        onChange={e => setConsDraft(p => ({ ...p, maxValue: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Share % Formula</label>
                      <input className={inputCls + " text-xs"} placeholder="e.g. ink_gsm / total_gsm * 100" value={consDraft.sharePercentageFormula}
                        onChange={e => setConsDraft(p => ({ ...p, sharePercentageFormula: e.target.value }))} />
                    </div>
                    <button
                      onClick={() => {
                        if (!consDraft.plyType || !consDraft.itemGroup || !consDraft.itemSubGroup) return;
                        const newRow: ConsumableRow = { id: uid(), ...consDraft };
                        f("consumableRows", [...form.consumableRows, newRow]);
                        setConsDraft({ plyType: "", itemGroup: "", itemSubGroup: "", fieldName: "", calcFieldName: "", fieldDisplayName: "", defaultValue: 0, minValue: 0, maxValue: 10, sharePercentageFormula: "" });
                      }}
                      className="px-5 py-2 bg-teal-700 text-white text-xs rounded-lg hover:bg-teal-800 transition-colors flex items-center gap-1.5 whitespace-nowrap h-[38px]"
                    >
                      <Plus size={13} /> Add Row
                    </button>
                  </div>
                </div>

                {/* ── Rows grouped by Ply Type ── */}
                {PLY_TYPES.map(pt => {
                  const rows = form.consumableRows.filter(r => r.plyType === pt);
                  if (rows.length === 0) return null;
                  return (
                    <div key={pt} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-teal-700 px-4 py-2 text-white text-xs font-bold uppercase tracking-widest">
                        {pt} — Consumables
                      </div>
                      <div className="overflow-x-auto">
                        <div className="min-w-[820px]">
                          <div className="grid bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider"
                            style={{ gridTemplateColumns: "1.2fr 1.2fr 1.4fr 0.8fr 0.6fr 0.6fr 1.2fr 44px" }}>
                            {["Item Group", "Item Sub Group", "Display Name", "Default", "Min", "Max", "Share % Formula", ""].map(h => (
                              <div key={h} className="px-3 py-2">{h}</div>
                            ))}
                          </div>
                          <div className="divide-y divide-gray-100 bg-white">
                            {rows.map(row => (
                              <div key={row.id} className="grid hover:bg-teal-50/30 transition-colors text-xs"
                                style={{ gridTemplateColumns: "1.2fr 1.2fr 1.4fr 0.8fr 0.6fr 0.6fr 1.2fr 44px" }}>
                                <div className="px-3 py-2.5">
                                  <span className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded text-[10px] font-semibold">{row.itemGroup}</span>
                                </div>
                                <div className="px-3 py-2.5 text-gray-700 font-medium">{row.itemSubGroup}</div>
                                <div className="px-3 py-2.5 text-gray-600">{row.fieldDisplayName || "—"}</div>
                                <div className="px-3 py-2.5 text-center text-gray-600 font-mono">{row.defaultValue}</div>
                                <div className="px-3 py-2.5 text-center text-gray-500 font-mono">{row.minValue}</div>
                                <div className="px-3 py-2.5 text-center text-gray-500 font-mono">{row.maxValue}</div>
                                <div className="px-3 py-2.5 text-gray-500 truncate">{row.sharePercentageFormula || "—"}</div>
                                <div className="px-2 py-2.5 flex justify-center">
                                  <button onClick={() => f("consumableRows", form.consumableRows.filter(r => r.id !== row.id))}
                                    className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
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

                {form.consumableRows.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-10 border-2 border-dashed border-gray-200 rounded-lg">
                    No consumable rows yet. Use the form above to define consumables for each ply type.
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Category Master</h2>
          <p className="text-sm text-gray-500">{data.length} categories defined</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors shadow-sm">
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {data.map(row => (
          <div key={row.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 font-medium">{row.id}</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{row.name}</p>
              </div>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${row.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>{row.status}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {row.division && (
                <span className="px-2 py-0.5 text-xs rounded bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                  {row.division}
                </span>
              )}
              {row.ply && (
                <span className="px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                  {row.ply}
                </span>
              )}
              {row.orientation && (
                <span className="px-2 py-0.5 text-xs rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                  {row.orientation}
                </span>
              )}
            </div>
            <div className="flex gap-2 pt-1 border-t border-gray-100">
              <button
                onClick={() => openEdit(row)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
              >
                <Pencil size={12} /> Edit
              </button>
              <button
                onClick={() => deleteRow(row.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            No categories yet. Click 'Add Category' to create one.
          </div>
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["name", "division", "ply"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteRow(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
