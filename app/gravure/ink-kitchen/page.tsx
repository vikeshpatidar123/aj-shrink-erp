"use client";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { useState, useEffect, useCallback } from "react";
import TutorialButton from "@/components/ui/TutorialButton";
import {
  Plus, Pencil, Trash2, Save, List, Check, FlaskConical,
  ClipboardList, Beaker, X, Search, ChevronDown, AlertCircle, RefreshCw,
  LayoutDashboard, TrendingUp, Package, Clock, CheckCircle2,
} from "lucide-react";
import { getCompanyName } from "@/lib/useCompanyName";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authHeaders } from "@/lib/auth";
import SearchableSelect from "@/components/ui/SearchableSelect";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";

function unwrap(r: unknown): unknown {
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

async function api(path: string, body?: object) {
  const res = await fetch(`${BASE}/api/inkKitchen/${path}`, {
    method: body ? "POST" : "GET",
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return unwrap(await res.text()) as Record<string, unknown>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface InkItem    { id: string; itemCode: string; itemName: string; shadeName: string; stock: number }
interface Warehouse  { id: string; name: string; bin: string }
interface Job        { id: string; jobNo: string; jobName: string; clientName: string }
interface ShadeName  { shadeName: string }

interface Dropdowns {
  inkItems: InkItem[];
  warehouses: Warehouse[];
  jobs: Job[];
  shadeNames: ShadeName[];
  films: FilmItem[];
}

interface Recipe {
  id: string;
  ShadeRecipeID: number;
  ShadeRecipeNo: string;
  ShadeRecipeName: string;
  InkCode: string;
  InkName: string;
  Reference: string;
  PaperQuality: string;
  PaperFinish: string;
  LabValueL: number;
  LabValueA: number;
  LabValueB: number;
  CreatedDate: string;
  Ingredients: string;
  IngCount: number;
  UsedInProduction: number;
}

interface RecipeDetail {
  ShadeRecipeDetailsID: number;
  SubItemID: number;
  SubItemCode: string;
  SubItemName: string;
  ShadePercentage: number;
  Stock: number;
}

interface SPR {
  SpecialShadeProductionID: number;
  SPRNo: string;
  SPRDate: string;
  RequiredQty: number;
  ShadeName: string;
  Reference: string;
  PaperQuality: string;
  PaperFinish: string;
  JobBookingID: number;
  JobNo: string;
  JobName: string;
  ClientName: string;
  InkID: number;
  InkCode: string;
  InkName: string;
  IsShadeProduced: number;
  RequiredDate: string;
  ShadeRecipeID: number;
  RecipeNo: string;
}

interface MixSPR extends SPR {
  RecipeName: string;
}

interface MixedSPR {
  SpecialShadeProductionID: number;
  SPRNo: string;
  SPRDate: string;
  ShadeName: string;
  RequiredQty: number;
  Reference: string;
  JobNo: string;
  JobName: string;
  ClientName: string;
  InkCode: string;
  InkName: string;
  BatchNo: string;
  MixedDate: string;
  ProducedQty: number;
  RecipeNo: string;
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">
    {title}
  </h3>
);

const Tab = ({ label, icon: Icon, active, onClick, count }: {
  label: string; icon: React.ElementType; active: boolean; onClick: () => void; count?: number;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
      active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
    }`}
  >
    <Icon size={15} />
    {label}
    {count !== undefined && (
      <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
        active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
      }`}>{count}</span>
    )}
  </button>
);

// ── RECIPE FORM ────────────────────────────────────────────────────────────────

const blankRecipeForm = {
  shadeRecipeName: "",
  itemId: "",
  reference: "",
  paperQuality: "",
  paperFinish: "",
  labL: "",
  labA: "",
  labB: "",
};

type IngredientRow = { subItemId: string; subItemCode: string; subItemName: string; percentage: string };

type FilmItem = {
  id: string; itemName: string; quality: string; finish: string;
  sizeW: number; thickness: number; density: number; manufacturer: string;
};

function RecipeForm({
  editing,
  form,
  setForm,
  ingredients,
  setIngredients,
  inkItems,
  films,
  saving,
  onSave,
  onBack,
}: {
  editing: Recipe | null;
  form: typeof blankRecipeForm;
  setForm: (f: typeof blankRecipeForm) => void;
  ingredients: IngredientRow[];
  setIngredients: (rows: IngredientRow[]) => void;
  inkItems: InkItem[];
  films: FilmItem[];
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
}) {
  const f = (k: keyof typeof blankRecipeForm, v: string) => setForm({ ...form, [k]: v });
  const totalPct = ingredients.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0);

  const addRow = () =>
    setIngredients([...ingredients, { subItemId: "", subItemCode: "", subItemName: "", percentage: "" }]);

  const removeRow = (i: number) => setIngredients(ingredients.filter((_, idx) => idx !== i));

  const updateRow = (i: number, patch: Partial<IngredientRow>) =>
    setIngredients(ingredients.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const setIngredientItem = (i: number, itemId: string) => {
    const ink = inkItems.find(x => x.id === itemId);
    if (ink) updateRow(i, { subItemId: itemId, subItemCode: ink.itemCode, subItemName: ink.itemName });
  };

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Sticky Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div>
          <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">{getCompanyName("Company")}</p>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <FlaskConical size={16} className="text-blue-600" />
            Shade Recipe {editing ? `— Edit ${editing.ShadeRecipeNo}` : "New"}
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setForm(blankRecipeForm); setIngredients([]); }}
            className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            Clear
          </button>
          <button onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <List size={15} /> Back
          </button>
          <button onClick={onSave} disabled={saving || !form.shadeRecipeName.trim() || ingredients.length === 0 || Math.abs(totalPct - 100) > 0.01}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm">
            <Save size={15} /> {saving ? "Saving…" : "Save Recipe"}
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex gap-6 p-6 flex-1 min-h-0">
        {/* LEFT: Recipe Details + Lab Values */}
        <div className="w-[480px] flex-shrink-0 space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <SectionTitle title="Recipe Details" />
            <Field label="Shade Recipe Name" required>
              <Input type="text" value={form.shadeRecipeName} onChange={e => f("shadeRecipeName", e.target.value)} placeholder="e.g. Pantone 485C Red" />
            </Field>
            <Field label="Target Ink Item" required>
              <SearchableSelect value={form.itemId} onChange={val => f("itemId", val)}
                options={inkItems.map(i => ({ value: i.id, label: `${i.itemCode} — ${i.itemName}` }))}
                placeholder="— select ink —" className="border-gray-300 rounded-lg text-sm text-gray-900" />
            </Field>
            <Field label="Reference (Pantone / Sample)">
              <Input type="text" value={form.reference} onChange={e => f("reference", e.target.value)} placeholder="Pantone 485C" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Film Item">
                <SearchableSelect value={form.paperQuality}
                  onChange={val => { const item = films.find(p => p.itemName === val); setForm({ ...form, paperQuality: val, paperFinish: item?.finish ?? "" }); }}
                  options={films.map(p => ({ value: p.itemName, label: `${p.itemName}${p.sizeW ? ` — ${p.sizeW}mm` : ""}${p.thickness ? ` × ${p.thickness}µ` : ""}` }))}
                  placeholder="— select film —" className="border-gray-300 rounded-lg text-sm text-gray-900" />
              </Field>
              <Field label="Film Finish">
                <SearchableSelect value={form.paperFinish} onChange={val => f("paperFinish", val)}
                  options={[...new Set(films.map(p => p.finish).filter(Boolean))].sort().map(fin => ({ value: fin, label: fin }))}
                  placeholder="— select finish —" className="border-gray-300 rounded-lg text-sm text-gray-900" />
              </Field>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <SectionTitle title="Lab Colour Values (L*a*b*)" />
            <div className="grid grid-cols-3 gap-4">
              {(["labL", "labA", "labB"] as const).map((k, i) => (
                <Field key={k} label={["L*", "A*", "B*"][i]}>
                  <Input type="number" step={0.01} value={form[k]} onChange={e => f(k, e.target.value)} />
                </Field>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Ink Ingredients */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <SectionTitle title="Ink Ingredients (must total 100%)" />
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${Math.abs(totalPct - 100) < 0.01 && ingredients.length > 0 ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  Total: {totalPct.toFixed(2)}%
                </span>
                <button onClick={addRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                  <Plus size={13} /> Add Ink
                </button>
              </div>
            </div>

            <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Ink Item</th>
                    <th className="px-3 py-2.5 text-right w-36">% Percentage</th>
                    <th className="px-3 py-2.5 text-right w-12">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ingredients.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-10 text-center text-gray-400 text-xs">No ingredients yet. Click "Add Ink" to begin.</td></tr>
                  )}
                  {ingredients.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <SearchableSelect value={row.subItemId} onChange={val => setIngredientItem(i, val)}
                          options={[
                            ...(row.subItemId && !inkItems.find(ink => ink.id === row.subItemId)
                              ? [{ value: row.subItemId, label: `${row.subItemCode} — ${row.subItemName}` }]
                              : []),
                            ...inkItems.map(ink => ({ value: ink.id, label: `${ink.itemCode} — ${ink.itemName}` })),
                          ]}
                          placeholder="— select —" className="border-gray-200 rounded-md px-2 py-1.5 text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" step={0.01} min={0} max={100} value={row.percentage} onChange={e => updateRow(i, { percentage: e.target.value })} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600">
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SPR FORM ───────────────────────────────────────────────────────────────────

const blankSprForm = {
  jobBookingId: "",
  inkId: "",
  shadeName: "",
  requiredQty: "",
  reference: "",
  paperQuality: "",
  paperFinish: "",
  requiredDate: "",
};

function SprForm({
  editing,
  form,
  setForm,
  inkItems,
  jobs,
  films,
  saving,
  onSave,
  onBack,
}: {
  editing: SPR | null;
  form: typeof blankSprForm;
  setForm: (f: typeof blankSprForm) => void;
  inkItems: InkItem[];
  jobs: Job[];
  films: FilmItem[];
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
}) {
  const f = (k: keyof typeof blankSprForm, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Sticky Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div>
          <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">{getCompanyName("Company")}</p>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList size={16} className="text-amber-600" />
            Production Request {editing ? `— Edit ${editing.SPRNo}` : "New"}
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setForm(blankSprForm)}
            className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            Clear
          </button>
          <button onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <List size={15} /> Back
          </button>
          <button onClick={onSave} disabled={saving || !form.inkId || !form.shadeName.trim() || !form.requiredQty}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm">
            <Save size={15} /> {saving ? "Saving…" : "Save Request"}
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex gap-6 p-6">
        {/* LEFT: Main fields */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <SectionTitle title="Production Request Details" />
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Production Work Order (PWO)">
                <SearchableSelect value={form.jobBookingId} onChange={val => f("jobBookingId", val)}
                  options={jobs.map(j => ({ value: j.id, label: `${j.jobNo} — ${j.jobName}` }))}
                  placeholder="— select PWO —" className="border-gray-300 rounded-lg text-sm text-gray-900" />
              </Field>
            </div>
            <Field label="Ink Item" required>
              <SearchableSelect value={form.inkId}
                onChange={val => { const ink = inkItems.find(i => i.id === val); setForm({ ...form, inkId: val, shadeName: ink?.shadeName ?? form.shadeName }); }}
                options={inkItems.map(i => ({ value: i.id, label: `${i.itemCode} — ${i.itemName}` }))}
                placeholder="— select ink —" className="border-gray-300 rounded-lg text-sm text-gray-900" />
            </Field>
            <Field label="Shade Name" required>
              <Input type="text" value={form.shadeName} onChange={e => f("shadeName", e.target.value)} placeholder="e.g. Red, Pantone 485C" />
            </Field>
            <Field label="Required Qty (kg)" required>
              <Input type="number" step={0.001} min={0} value={form.requiredQty} onChange={e => f("requiredQty", e.target.value)} placeholder="0.000" />
            </Field>
            <Field label="Required Date">
              <Input type="date" value={form.requiredDate} onChange={e => f("requiredDate", e.target.value)} />
            </Field>
          </div>
        </div>

        {/* RIGHT: Reference + Film */}
        <div className="w-[380px] flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <SectionTitle title="Reference & Film" />
            <Field label="Reference">
              <Input type="text" value={form.reference} onChange={e => f("reference", e.target.value)} placeholder="Pantone code / sample ref" />
            </Field>
            <Field label="Film Item">
              <SearchableSelect value={form.paperQuality}
                onChange={val => { const item = films.find(p => p.itemName === val); setForm({ ...form, paperQuality: val, paperFinish: item?.finish ?? "" }); }}
                options={films.map(p => ({ value: p.itemName, label: p.itemName }))}
                placeholder="— select film —" className="border-gray-300 rounded-lg text-sm text-gray-900" />
            </Field>
            <Field label="Film Finish">
              <SearchableSelect value={form.paperFinish} onChange={val => f("paperFinish", val)}
                options={[...new Set(films.map(p => p.finish).filter(Boolean))].sort().map(fin => ({ value: fin, label: fin }))}
                placeholder="— select finish —" className="border-gray-300 rounded-lg text-sm text-gray-900" />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MIXING MODAL ───────────────────────────────────────────────────────────────

interface MixIngRow { subItemId: number; subItemCode: string; subItemName: string; pct: number; stock: number; qty: string; warehouseId: string; batchNo: string }

function MixingModal({
  spr,
  warehouses,
  inkItems,
  onClose,
  onDone,
}: {
  spr: MixSPR;
  warehouses: Warehouse[];
  inkItems: InkItem[];
  onClose: () => void;
  onDone: (batchNo: string) => void;
}) {
  const [recipes, setRecipes]   = useState<{ ShadeRecipeID: number; ShadeRecipeNo: string; ShadeRecipeName: string; Ingredients: string }[]>([]);
  const [selRecipe, setSelRecipe] = useState(spr.ShadeRecipeID ? String(spr.ShadeRecipeID) : "");
  const [ingRows, setIngRows]   = useState<MixIngRow[]>([]);
  const [producedQty, setProducedQty] = useState(String(spr.RequiredQty));
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [batchNo, setBatchNo]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(true);

  // Load similar shade recipes
  useEffect(() => {
    (async () => {
      setLoadingRecipes(true);
      try {
        const data = await api("shade-recipe/list");
        setRecipes(Array.isArray(data) ? data.map((r: Recipe) => ({ ...r, id: String(r.ShadeRecipeID) })) : []);
      } finally { setLoadingRecipes(false); }
    })();
  }, [spr.ShadeName, spr.PaperFinish]);

  // Load recipe details when recipe selected
  useEffect(() => {
    if (!selRecipe) { setIngRows([]); return; }
    (async () => {
      try {
      const data = await api(`shade-recipe/${selRecipe}/details`) as { details?: RecipeDetail[] };
      const details = Array.isArray(data?.details) ? data.details : [];
      const qty = parseFloat(producedQty) || spr.RequiredQty;
      setIngRows(details.map(d => ({
        subItemId:   d.SubItemID,
        subItemCode: d.SubItemCode,
        subItemName: d.SubItemName,
        pct:         d.ShadePercentage,
        stock:       d.Stock,
        qty:         ((d.ShadePercentage / 100) * qty).toFixed(3),
        warehouseId: warehouses[0]?.id ?? "",
        batchNo:     "",
      })));
      } catch { setIngRows([]); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selRecipe]);

  const recalcQty = (newProdQty: string) => {
    setProducedQty(newProdQty);
    const qty = parseFloat(newProdQty) || 0;
    setIngRows(rows => rows.map(r => ({ ...r, qty: ((r.pct / 100) * qty).toFixed(3) })));
  };

  const updateIng = (i: number, patch: Partial<MixIngRow>) =>
    setIngRows(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const canSave = selRecipe && producedQty && warehouseId && ingRows.length > 0;

  const doSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const result = await api("mixing/save", {
        sprId:        spr.SpecialShadeProductionID,
        sprNo:        spr.SPRNo,
        shadeRecipeId: parseInt(selRecipe),
        producedQty:  parseFloat(producedQty),
        warehouseId:  parseInt(warehouseId),
        batchNo,
        ingredients: ingRows.map(r => ({
          subItemId:   r.subItemId,
          subItemName: r.subItemName,
          quantity:    parseFloat(r.qty) || 0,
          warehouseId: parseInt(r.warehouseId) || parseInt(warehouseId),
          batchNo:     r.batchNo,
        })),
      }) as { status: string; batchNo?: string; message?: string };

      if (result.status === "success") {
        onDone(result.batchNo ?? "");
      } else {
        alert("Mix failed: " + (result.message ?? "Unknown error"));
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/50">
      <div className="bg-white w-full h-full overflow-y-auto flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Beaker size={16} className="text-blue-600" />
              Mix Ink — {spr.SPRNo}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {spr.ShadeName} · {spr.RequiredQty} kg required · Job: {spr.JobNo || "—"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Recipe picker */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              Shade Recipe *
            </label>
            {loadingRecipes ? (
              <div className="text-xs text-gray-400 py-2">Loading recipes…</div>
            ) : (
              <SearchableSelect
                value={selRecipe}
                onChange={val => setSelRecipe(val)}
                options={recipes.map(r => ({ value: String(r.ShadeRecipeID), label: `${r.ShadeRecipeNo} — ${r.ShadeRecipeName}` }))}
                placeholder="— select recipe —"
                className="border-gray-300 rounded-lg text-sm text-gray-900"
              />
            )}
            {recipes.length === 0 && !loadingRecipes && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> No matching recipes found. Create one in Shade Library first.
              </p>
            )}
          </div>

          {/* Produced qty + warehouse */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Produced Qty (kg)" required>
              <Input type="number" step={0.001} min={0} value={producedQty} onChange={e => recalcQty(e.target.value)} />
            </Field>
            <Field label="Output Warehouse" required>
              <SearchableSelect
                value={warehouseId}
                onChange={val => setWarehouseId(val)}
                options={warehouses.map(w => ({ value: w.id, label: `${w.name}${w.bin ? " / " + w.bin : ""}` }))}
                placeholder="— select —"
                className="border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </Field>
          </div>

          <Field label="Batch / Lot No.">
            <Input type="text" value={batchNo} onChange={e => setBatchNo(e.target.value)} placeholder="Auto-assigned if blank" />
          </Field>

          {/* Ingredient consumption table */}
          {ingRows.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                Ingredients to Consume
              </label>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Ink</th>
                      <th className="px-2 py-2 text-right w-10">%</th>
                      <th className="px-2 py-2 text-right w-24">Qty (kg)</th>
                      <th className="px-2 py-2 text-right w-10">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ingRows.map((r, i) => (
                      <tr key={i} className={parseFloat(r.qty) > r.stock ? "bg-red-50" : ""}>
                        <td className="px-3 py-2 font-medium text-gray-800">{r.subItemName}</td>
                        <td className="px-2 py-2 text-right text-gray-500">{r.pct}%</td>
                        <td className="px-2 py-2">
                          <Input type="number" step={0.001} min={0} value={r.qty} onChange={e => updateIng(i, { qty: e.target.value })} />
                        </td>
                        <td className={`px-2 py-2 text-right font-medium ${parseFloat(r.qty) > r.stock ? "text-red-600" : "text-green-600"}`}>
                          {r.stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ingRows.some(r => parseFloat(r.qty) > r.stock) && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle size={11} /> Some ingredients have insufficient stock.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={doSave} disabled={!canSave || saving} loading={saving} icon={<Beaker size={15} />}>{saving ? "Saving…" : "Confirm Mix"}</Button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────

type MainTab = "dashboard" | "recipes" | "spr" | "mixing";
type RecipeView = "list" | "form";
type SprView    = "list" | "form";

export default function InkKitchenPage() {
  const [tab, setTab] = useState<MainTab>("dashboard");

  // ─── Dropdowns ───────────────────────────────────────────────────────────────
  const [drops, setDrops] = useState<Dropdowns>({ inkItems: [], warehouses: [], jobs: [], shadeNames: [], films: [] });
  const [dropsLoaded, setDropsLoaded] = useState(false);

  const loadDrops = useCallback(async () => {
    try {
      const d = await api("dropdowns") as Partial<Dropdowns>;
      setDrops({
        inkItems:   Array.isArray(d?.inkItems)   ? d.inkItems   : [],
        warehouses: Array.isArray(d?.warehouses) ? d.warehouses : [],
        jobs:       Array.isArray(d?.jobs)       ? d.jobs       : [],
        shadeNames: Array.isArray(d?.shadeNames) ? d.shadeNames : [],
        films:      Array.isArray(d?.films)      ? d.films      : [],
      });
    } catch { /* network unavailable, keep empty arrays */ }
    finally { setDropsLoaded(true); }
  }, []);

  useEffect(() => { loadDrops(); }, [loadDrops]);

  // ─── Recipes tab ─────────────────────────────────────────────────────────────
  const [recipeView, setRecipeView]     = useState<RecipeView>("list");
  const [recipes, setRecipes]           = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [editingRecipe, setEditingRecipe]   = useState<Recipe | null>(null);
  const [recipeForm, setRecipeForm]     = useState(blankRecipeForm);
  const [ingredients, setIngredients]   = useState<IngredientRow[]>([]);
  const [recipeSaving, setRecipeSaving] = useState(false);

  const loadRecipes = useCallback(async () => {
    setRecipesLoading(true);
    try {
      const data = await api("shade-recipe/list");
      setRecipes(Array.isArray(data) ? data.map((r: Recipe) => ({ ...r, id: String(r.ShadeRecipeID) })) : []);
    } catch { /* network unavailable */ } finally { setRecipesLoading(false); }
  }, []);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  const openNewRecipe = () => {
    setEditingRecipe(null);
    setRecipeForm(blankRecipeForm);
    setIngredients([]);
    setRecipeView("form");
  };

  const openEditRecipe = async (row: Recipe) => {
    const data = await api(`shade-recipe/${row.ShadeRecipeID}/details`) as {
      header: { ItemID: number; ShadeRecipeName: string; Reference: string; PaperQuality: string; PaperFinish: string; LabValueL: number; LabValueA: number; LabValueB: number }[] | null;
      details: RecipeDetail[];
    };
    if (!data.header) return;
    const h = Array.isArray(data.header) ? data.header[0] : data.header;
    setEditingRecipe(row);
    setRecipeForm({
      shadeRecipeName: h.ShadeRecipeName,
      itemId:          String(h.ItemID ?? ""),
      reference:       h.Reference,
      paperQuality:    h.PaperQuality,
      paperFinish:     h.PaperFinish,
      labL:            String(h.LabValueL ?? ""),
      labA:            String(h.LabValueA ?? ""),
      labB:            String(h.LabValueB ?? ""),
    });
    setIngredients((data.details ?? []).map(d => ({
      subItemId:   String(d.SubItemID),
      subItemCode: d.SubItemCode,
      subItemName: d.SubItemName,
      percentage:  String(d.ShadePercentage),
    })));
    setRecipeView("form");
  };

  const saveRecipe = async () => {
    setRecipeSaving(true);
    try {
      const payload = {
        ...recipeForm,
        itemId: parseInt(recipeForm.itemId) || 0,
        labL: parseFloat(recipeForm.labL) || 0,
        labA: parseFloat(recipeForm.labA) || 0,
        labB: parseFloat(recipeForm.labB) || 0,
        details: ingredients.map(r => ({
          subItemId:   parseInt(r.subItemId) || 0,
          subItemCode: r.subItemCode,
          subItemName: r.subItemName,
          percentage:  parseFloat(r.percentage) || 0,
        })),
      };
      const result = editingRecipe
        ? await api("shade-recipe/update", { shadeRecipeId: editingRecipe.ShadeRecipeID, ...payload })
        : await api("shade-recipe/save", payload);

      const r = result as { status: string; message?: string };
      if (r.status === "success") {
        await loadRecipes();
        setRecipeView("list");
      } else {
        alert(r.message ?? "Save failed");
      }
    } finally { setRecipeSaving(false); }
  };

  const deleteRecipe = async (row: Recipe) => {
    if (!confirm(`Delete recipe "${row.ShadeRecipeName}"?`)) return;
    const r = await api("shade-recipe/delete", { shadeRecipeId: row.ShadeRecipeID }) as { status: string; message?: string };
    if (r.status !== "success") { alert(r.message ?? "Delete failed"); return; }
    await loadRecipes();
  };

  // ─── SPR tab ─────────────────────────────────────────────────────────────────
  const [sprView, setSprView]       = useState<SprView>("list");
  const [sprs, setSprs]             = useState<SPR[]>([]);
  const [sprsLoading, setSprsLoading] = useState(true);
  const [editingSpr, setEditingSpr] = useState<SPR | null>(null);
  const [sprForm, setSprForm]       = useState(blankSprForm);
  const [sprSaving, setSprSaving]   = useState(false);

  const loadSprs = useCallback(async () => {
    setSprsLoading(true);
    try {
      const data = await api("spr/list");
      setSprs(Array.isArray(data) ? data : []);
    } catch { /* network unavailable */ } finally { setSprsLoading(false); }
  }, []);

  useEffect(() => { loadSprs(); }, [loadSprs]);

  const openNewSpr = () => {
    setEditingSpr(null);
    setSprForm(blankSprForm);
    setSprView("form");
  };

  const openEditSpr = (row: SPR) => {
    setEditingSpr(row);
    setSprForm({
      jobBookingId: String(row.JobBookingID || ""),
      inkId:        String(row.InkID || ""),
      shadeName:    row.ShadeName,
      requiredQty:  String(row.RequiredQty),
      reference:    row.Reference,
      paperQuality: row.PaperQuality,
      paperFinish:  row.PaperFinish,
      requiredDate: row.RequiredDate || "",
    });
    setSprView("form");
  };

  const saveSpr = async () => {
    setSprSaving(true);
    try {
      const payload = {
        jobBookingId: parseInt(sprForm.jobBookingId) || 0,
        inkId:        parseInt(sprForm.inkId) || 0,
        shadeName:    sprForm.shadeName,
        requiredQty:  parseFloat(sprForm.requiredQty) || 0,
        reference:    sprForm.reference,
        paperQuality: sprForm.paperQuality,
        paperFinish:  sprForm.paperFinish,
        requiredDate: sprForm.requiredDate,
      };
      const result = editingSpr
        ? await api("spr/update", { sprId: editingSpr.SpecialShadeProductionID, ...payload })
        : await api("spr/save", payload);

      const r = result as { status: string; message?: string };
      if (r.status === "success") {
        await loadSprs();
        setSprView("list");
      } else {
        alert(r.message ?? "Save failed");
      }
    } finally { setSprSaving(false); }
  };

  const deleteSpr = async (row: SPR) => {
    if (!confirm(`Delete SPR "${row.SPRNo}"?`)) return;
    const r = await api("spr/delete", { sprId: row.SpecialShadeProductionID }) as { status: string; message?: string };
    if (r.status !== "success") { alert(r.message ?? "Delete failed"); return; }
    await loadSprs();
  };

  // ─── Mixing tab ──────────────────────────────────────────────────────────────
  const [mixSubTab, setMixSubTab]   = useState<"pending" | "processed">("pending");
  const [pending, setPending]       = useState<MixSPR[]>([]);
  const [processed, setProcessed]   = useState<MixedSPR[]>([]);
  const [mixLoading, setMixLoading] = useState(false);
  const [mixModal, setMixModal]     = useState<MixSPR | null>(null);

  const loadMixing = useCallback(async () => {
    setMixLoading(true);
    try {
      const [pen, proc] = await Promise.all([
        api("mixing/pending"),
        api("mixing/processed"),
      ]);
      setPending(Array.isArray(pen) ? pen : []);
      setProcessed(Array.isArray(proc) ? proc : []);
    } catch { /* network unavailable */ } finally { setMixLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "mixing" || tab === "dashboard") loadMixing();
  }, [tab, loadMixing]);

  useEffect(() => { loadMixing(); }, [loadMixing]); // load on mount for dashboard KPIs

  // ─── Columns ─────────────────────────────────────────────────────────────────

  const recipeColumns: Column<Recipe>[] = [
    { key: "ShadeRecipeNo", header: "Recipe No", sortable: true,
      render: r => <span className="font-mono text-xs font-bold text-blue-700">{r.ShadeRecipeNo}</span> },
    { key: "ShadeRecipeName", header: "Shade Name", sortable: true,
      render: r => <span className="font-semibold text-gray-800">{r.ShadeRecipeName}</span> },
    { key: "InkName", header: "Ink", sortable: true,
      render: r => <span className="text-xs">{r.InkCode ? `${r.InkCode} — ` : ""}{r.InkName}</span> },
    { key: "Ingredients", header: "Ingredients",
      render: r => <span className="text-xs text-gray-500 max-w-[220px] truncate block">{r.Ingredients || "—"}</span> },
    { key: "PaperFinish", header: "Film Finish",
      render: r => r.PaperFinish ? <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{r.PaperFinish}</span> : <span className="text-gray-300">—</span> },
    { key: "UsedInProduction", header: "Status",
      render: r => r.UsedInProduction
        ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Used</span>
        : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">Draft</span> },
  ];

  const sprColumns: Column<SPR>[] = [
    { key: "SPRNo", header: "SPR No", sortable: true,
      render: r => <span className="font-mono text-xs font-bold text-amber-700">{r.SPRNo}</span> },
    { key: "SPRDate", header: "Date", sortable: true,
      render: r => <span className="text-xs">{r.SPRDate}</span> },
    { key: "JobNo", header: "PWO", sortable: true,
      render: r => <span className="text-xs font-medium">{r.JobNo || "—"}</span> },
    { key: "ShadeName", header: "Shade", sortable: true },
    { key: "InkName", header: "Ink",
      render: r => <span className="text-xs">{r.InkCode ? `${r.InkCode} — ` : ""}{r.InkName}</span> },
    { key: "RequiredQty", header: "Req. Qty",
      render: r => <span className="font-mono text-sm">{r.RequiredQty} kg</span> },
    { key: "RequiredDate", header: "Req. Date",
      render: r => <span className="text-xs">{r.RequiredDate}</span> },
    { key: "IsShadeProduced", header: "Status",
      render: r => r.IsShadeProduced
        ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Produced</span>
        : <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Pending</span> },
  ];

  const pendingColumns: Column<MixSPR>[] = [
    { key: "SPRNo", header: "SPR No",
      render: r => <span className="font-mono text-xs font-bold text-amber-700">{r.SPRNo}</span> },
    { key: "ShadeName", header: "Shade", sortable: true },
    { key: "JobNo", header: "PWO",
      render: r => <span className="text-xs">{r.JobNo || "—"}</span> },
    { key: "InkName", header: "Ink",
      render: r => <span className="text-xs">{r.InkCode ? `${r.InkCode} — ` : ""}{r.InkName || "—"}</span> },
    { key: "RequiredQty", header: "Req. Qty",
      render: r => <span className="font-mono text-sm font-semibold">{r.RequiredQty} kg</span> },
    { key: "RequiredDate", header: "Required By",
      render: r => <span className="text-xs">{r.RequiredDate}</span> },
    { key: "RecipeName", header: "Recipe",
      render: r => r.RecipeNo
        ? <span className="text-xs font-mono text-blue-700">{r.RecipeNo}</span>
        : <span className="text-xs text-gray-300">None assigned</span> },
  ];

  const processedColumns: Column<MixedSPR>[] = [
    { key: "SPRNo", header: "SPR No",
      render: r => <span className="font-mono text-xs font-bold text-green-700">{r.SPRNo}</span> },
    { key: "BatchNo", header: "Batch No",
      render: r => <span className="font-mono text-xs font-semibold text-blue-700">{r.BatchNo || "—"}</span> },
    { key: "ShadeName", header: "Shade", sortable: true },
    { key: "JobNo", header: "PWO",
      render: r => <span className="text-xs">{r.JobNo || "—"}</span> },
    { key: "InkName", header: "Ink",
      render: r => <span className="text-xs">{r.InkCode ? `${r.InkCode} — ` : ""}{r.InkName || "—"}</span> },
    { key: "ProducedQty", header: "Produced",
      render: r => <span className="font-mono text-sm font-semibold text-green-700">{r.ProducedQty} kg</span> },
    { key: "MixedDate", header: "Mixed On",
      render: r => <span className="text-xs">{r.MixedDate}</span> },
    { key: "RecipeNo", header: "Recipe",
      render: r => <span className="text-xs font-mono text-gray-600">{r.RecipeNo || "—"}</span> },
  ];

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  if (!dropsLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400">Loading Ink Kitchen…</div>
      </div>
    );
  }

  // Recipes — form view
  if (tab === "recipes" && recipeView === "form") {
    return (
      <RecipeForm
        editing={editingRecipe}
        form={recipeForm}
        setForm={setRecipeForm}
        ingredients={ingredients}
        setIngredients={setIngredients}
        inkItems={drops.inkItems}
        films={drops.films}
        saving={recipeSaving}
        onSave={saveRecipe}
        onBack={() => setRecipeView("list")}
      />
    );
  }

  // SPR — form view
  if (tab === "spr" && sprView === "form") {
    return (
      <SprForm
        editing={editingSpr}
        form={sprForm}
        setForm={setSprForm}
        inkItems={drops.inkItems}
        jobs={drops.jobs}
        films={drops.films}
        saving={sprSaving}
        onSave={saveSpr}
        onBack={() => setSprView("list")}
      />
    );
  }

  // List views
  return (
    <>
      {mixModal && (
        <MixingModal
          spr={mixModal}
          warehouses={drops.warehouses}
          inkItems={drops.inkItems}
          onClose={() => setMixModal(null)}
          onDone={async (batchNo) => {
            setMixModal(null);
            alert(`Ink mixed successfully! Batch: ${batchNo}`);
            await loadMixing();
          }}
        />
      )}

      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FlaskConical size={20} className="text-blue-600" />
              Ink Kitchen
            </h2>
            <p className="text-sm text-gray-500">Shade recipe library · Production requests · Mixing console</p>
          </div>
          <TutorialButton title="Ink Kitchen — Tutorial" />
          <button onClick={() => { loadRecipes(); loadSprs(); loadMixing(); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            <Tab label="Dashboard" icon={LayoutDashboard} active={tab === "dashboard"} onClick={() => setTab("dashboard")} />
            <Tab label="Shade Library" icon={FlaskConical} active={tab === "recipes"} onClick={() => setTab("recipes")} count={recipes.length} />
            <Tab label="Production Requests" icon={ClipboardList} active={tab === "spr"} onClick={() => setTab("spr")}
              count={sprs.length} />
            <Tab label="Mixing Console" icon={Beaker} active={tab === "mixing"} onClick={() => setTab("mixing")}
              count={pending.length} />
          </div>

          {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
          {tab === "dashboard" && (() => {
            const totalProducedKg = processed.reduce((s, r) => s + Number(r.ProducedQty || 0), 0);
            const pendingSprCount = sprs.filter(s => !s.IsShadeProduced).length;
            return (
              <div className="p-5 space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: "Shade Recipes",    val: recipes.length,    icon: FlaskConical,  color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-100" },
                    { label: "Pending Requests", val: pendingSprCount,   icon: Clock,         color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-100" },
                    { label: "Ink Produced (kg)",val: totalProducedKg.toFixed(2), icon: TrendingUp, color: "text-green-700", bg: "bg-green-50", border: "border-green-100" },
                    { label: "Batches Mixed",    val: processed.length,  icon: CheckCircle2,  color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-100" },
                    { label: "Pending Mixing",   val: pending.length,    icon: Package,       color: "text-red-700",    bg: "bg-red-50",    border: "border-red-100" },
                  ].map(k => (
                    <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-4 flex flex-col gap-2`}>
                      <div className="flex items-center gap-2">
                        <k.icon size={14} className={k.color} />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{k.label}</span>
                      </div>
                      <p className={`text-2xl font-black ${k.color}`}>{mixLoading ? "…" : k.val}</p>
                    </div>
                  ))}
                </div>

                {/* Pending Production Requests */}
                {pendingSprCount > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Clock size={12}/> Pending Production Requests
                    </h3>
                    <div className="border border-amber-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-amber-50 text-amber-700">
                          <tr>
                            {["SPR No","Date","Shade","Ink Item","Req. Qty","Required By","PWO / Job"].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {sprs.filter(s => !s.IsShadeProduced).map(r => (
                            <tr key={r.SpecialShadeProductionID} className="hover:bg-amber-50/50">
                              <td className="px-3 py-2 font-mono font-bold text-amber-700">{r.SPRNo}</td>
                              <td className="px-3 py-2 text-gray-500">{r.SPRDate}</td>
                              <td className="px-3 py-2 font-medium text-gray-800">{r.ShadeName}</td>
                              <td className="px-3 py-2 text-gray-600">{r.InkCode ? `${r.InkCode} — ` : ""}{r.InkName || "—"}</td>
                              <td className="px-3 py-2 font-mono font-semibold text-gray-800">{r.RequiredQty} kg</td>
                              <td className="px-3 py-2 text-gray-500">{r.RequiredDate || "—"}</td>
                              <td className="px-3 py-2 text-gray-600">{r.JobNo || "—"}{r.JobName ? ` / ${r.JobName}` : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Ink Production History */}
                <div>
                  <h3 className="text-xs font-bold text-green-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <TrendingUp size={12}/> Ink Production History — {processed.length} batches · {totalProducedKg.toFixed(2)} kg total
                  </h3>
                  {mixLoading ? (
                    <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
                  ) : processed.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-400">No ink batches produced yet.</div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-800 text-white">
                          <tr>
                            {["Batch No","SPR No","Mixed On","Shade Name","Ink Item","Recipe No","Produced (kg)","PWO / Job","Client"].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {processed.map((r, i) => (
                            <tr key={r.SpecialShadeProductionID} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="px-3 py-2">
                                <span className="font-mono font-bold text-blue-700">{r.BatchNo || "—"}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-mono text-green-700">{r.SPRNo}</span>
                              </td>
                              <td className="px-3 py-2 text-gray-500">{r.MixedDate}</td>
                              <td className="px-3 py-2 font-semibold text-gray-800">{r.ShadeName}</td>
                              <td className="px-3 py-2 text-gray-600">{r.InkCode ? `${r.InkCode} — ` : ""}{r.InkName || "—"}</td>
                              <td className="px-3 py-2">
                                <span className="font-mono text-purple-700">{r.RecipeNo || "—"}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-mono font-black text-green-700 text-sm">{r.ProducedQty} kg</span>
                              </td>
                              <td className="px-3 py-2 text-gray-600">{r.JobNo || "—"}{r.JobName ? ` / ${r.JobName}` : ""}</td>
                              <td className="px-3 py-2 text-gray-500">{r.ClientName || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-green-50 border-t-2 border-green-200">
                          <tr>
                            <td colSpan={6} className="px-3 py-2 text-xs font-bold text-green-700 uppercase tracking-wide">Total Produced</td>
                            <td className="px-3 py-2 font-mono font-black text-green-700 text-sm">{totalProducedKg.toFixed(2)} kg</td>
                            <td colSpan={2}/>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── RECIPES list ───────────────────────────────────────────────────── */}
          {tab === "recipes" && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">{recipes.length} shade recipes</p>
                <Button variant="secondary" pill icon={<Plus size={15} />} onClick={openNewRecipe}>New Recipe</Button>
              </div>
              {recipesLoading ? (
                <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
              ) : (
                <DataTable
                  data={recipes}
                  columns={recipeColumns}
                  searchKeys={["ShadeRecipeNo", "ShadeRecipeName", "InkName", "Ingredients", "Reference"]}
                  actions={row => (
                    <div className="flex items-center gap-2 justify-end">
                      <RowAction.Edit onClick={() => openEditRecipe(row)} />
                      <RowAction.Delete onClick={() => deleteRecipe(row)} />
                    </div>
                  )}
                />
              )}
            </div>
          )}

          {/* ── SPR list ───────────────────────────────────────────────────────── */}
          {tab === "spr" && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-3">
                  <p className="text-sm text-gray-500">{sprs.length} requests total</p>
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                    {sprs.filter(s => !s.IsShadeProduced).length} pending
                  </span>
                </div>
                <Button variant="secondary" pill icon={<Plus size={15} />} onClick={openNewSpr}>New Request</Button>
              </div>
              {sprsLoading ? (
                <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
              ) : (
                <DataTable
                  data={sprs}
                  columns={sprColumns}
                  searchKeys={["SPRNo", "ShadeName", "JobNo", "JobName", "InkCode", "InkName"]}
                  actions={row => (
                    <div className="flex items-center gap-2 justify-end">
                      {!row.IsShadeProduced && (
                        <RowAction.Edit onClick={() => openEditSpr(row)} />
                      )}
                      {!row.IsShadeProduced && (
                        <RowAction.Delete onClick={() => deleteSpr(row)} />
                      )}
                    </div>
                  )}
                />
              )}
            </div>
          )}

          {/* ── MIXING console ─────────────────────────────────────────────────── */}
          {tab === "mixing" && (
            <div className="p-5">
              {/* Sub-tabs */}
              <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
                {(["pending", "processed"] as const).map(st => (
                  <button key={st} onClick={() => setMixSubTab(st)}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      mixSubTab === st ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}>
                    {st === "pending" ? `Pending (${pending.length})` : `Processed (${processed.length})`}
                  </button>
                ))}
              </div>

              {mixLoading ? (
                <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
              ) : mixSubTab === "pending" ? (
                <>
                  {pending.length === 0 ? (
                    <div className="py-12 text-center text-sm text-gray-400">
                      No pending shade production requests.
                    </div>
                  ) : (
                    <DataTable
                      data={pending}
                      columns={pendingColumns}
                      searchKeys={["SPRNo", "ShadeName", "JobNo", "InkCode", "InkName"]}
                      actions={row => (
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setMixModal(row)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm">
                            <Beaker size={12} /> Mix Ink
                          </button>
                        </div>
                      )}
                    />
                  )}
                </>
              ) : (
                <DataTable
                  data={processed}
                  columns={processedColumns}
                  searchKeys={["SPRNo", "BatchNo", "ShadeName", "JobNo", "InkCode", "InkName"]}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
