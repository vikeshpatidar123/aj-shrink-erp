"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BookMarked, Plus, Eye, Pencil, Trash2, Save, X,
  ChevronDown, ChevronUp, Layers, Package, RefreshCw,
  CheckCircle2, AlertCircle, ArrowRight, Printer,
} from "lucide-react";
import {
  orders as extOrders, costEstimations, recipes, rollMasters, rawMaterials, customers,
  Order, Recipe,
} from "@/data/dummyData";
import {
  useExtrusionCatalog,
  ExtrusionCatalogItem, ExtCatalogLayer, ExtCatalogMatLine,
} from "@/context/ExtrusionCatalogContext";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal  from "@/components/ui/Modal";

// ─── Micron distribution by layerRatio ───────────────────────
function distributeByRatio(totalMicron: number, ratioStr: string, layerCount: number): number[] {
  const parts = ratioStr.split(":").map(Number).filter(n => !isNaN(n) && n > 0);
  if (parts.length !== layerCount) {
    const each = parseFloat((totalMicron / layerCount).toFixed(2));
    return Array(layerCount).fill(each);
  }
  const total = parts.reduce((s, p) => s + p, 0);
  return parts.map(p => parseFloat(((p / total) * totalMicron).toFixed(2)));
}

// ─── Calculation helpers (same as Work Order) ─────────────────
function computeLayer(l: ExtCatalogLayer): ExtCatalogLayer {
  const totalPct = l.materials.reduce((s, m) => s + m.pct, 0);
  const norm     = totalPct > 0 ? 100 / totalPct : 1;
  const density  = parseFloat(l.materials.reduce((s, m) => s + m.density * (m.pct * norm) / 100, 0).toFixed(6));
  const gsm      = parseFloat((l.micron * density).toFixed(4));
  const consumptionPerSqM = parseFloat((gsm / 1000).toFixed(6));
  const blendRate  = parseFloat(l.materials.reduce((s, m) => s + m.rate * (m.pct * norm) / 100, 0).toFixed(4));
  const costPerSqM = parseFloat((consumptionPerSqM * blendRate).toFixed(4));
  return { ...l, blendDensity: density, gsm, consumptionPerSqM, blendRate, costPerSqM };
}

function buildLayersFromRecipe(recipe: Recipe, microns: number[]): ExtCatalogLayer[] {
  return recipe.layers.map((rl, i) => {
    const base: ExtCatalogLayer = {
      layerNo: rl.layerNo, layerName: rl.name,
      micron: microns[i] ?? 20,
      materials: rl.materials.map(m => ({
        name: m.rawMaterialName, pct: m.percentage,
        density: m.density, rate: m.rate,
      })),
      blendDensity: 0, gsm: 0, consumptionPerSqM: 0, blendRate: 0, costPerSqM: 0,
    };
    return computeLayer(base);
  });
}

// ─── Generate catalog number ──────────────────────────────────
function genCatalogNo(existing: string[]): string {
  const year = new Date().getFullYear();
  let max = 0;
  existing.forEach(n => {
    const m = n.match(/EPC-\d{4}-(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1]));
  });
  return `EPC-${year}-${String(max + 1).padStart(3, "0")}`;
}

// ─── Types ────────────────────────────────────────────────────
type CatalogForm = {
  catalogName: string;
  customerId: string; customerName: string;
  recipeId: string; recipeName: string;
  rollMasterId: string; rollWidth: number;
  layers: ExtCatalogLayer[];
  standardRate: number;
  unit: string;
  status: "Active" | "Inactive";
  createdFrom: "Work Order" | "Manual" | "Job Card";
  sourceWONo: string;
  sourceOrderId: string;
  sourceJobCardNo: string;
  remarks: string;
};

const blankForm = (): CatalogForm => ({
  catalogName: "", customerId: "", customerName: "",
  recipeId: "", recipeName: "", rollMasterId: "", rollWidth: 0,
  layers: [], standardRate: 0, unit: "Kg",
  status: "Active", createdFrom: "Manual",
  sourceWONo: "", sourceOrderId: "", sourceJobCardNo: "", remarks: "",
});

// ─── Small helpers ────────────────────────────────────────────
const KV = ({ label, val, cls = "" }: { label: string; val: string | number; cls?: string }) => (
  <div className={`rounded-lg border px-3 py-2 ${cls || "bg-gray-50 border-gray-200"}`}>
    <p className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-0.5">{label}</p>
    <p className="text-xs font-bold">{val || "—"}</p>
  </div>
);

const SH = ({ label, icon }: { label: string; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-2 mb-3">
    {icon && <span className="text-purple-600">{icon}</span>}
    <h3 className="text-xs font-bold text-purple-700 uppercase tracking-widest">{label}</h3>
    <div className="flex-1 h-px bg-purple-100" />
  </div>
);

// ── Helper: build microns from recipe + roll ──────────────────
function getMicrons(recipe: Recipe, rollMasterId: string): number[] {
  const roll = rollMasters.find(r => r.id === rollMasterId);
  if (roll && recipe.layerRatio) {
    return distributeByRatio(roll.micron, recipe.layerRatio, recipe.layers.length);
  }
  return recipe.layers.map(() => Math.round((roll?.micron ?? 40) / recipe.layers.length));
}

// ═══════════════════════════════════════════════════════════════
export default function ExtrusionProductCatalogPage() {
  const router = useRouter();
  const { catalog, saveCatalogItem, deleteCatalogItem, pendingFill, setPendingFill } = useExtrusionCatalog();

  const [activeTab,  setActiveTab]  = useState<"pending" | "catalog">("pending");
  const [formOpen,   setFormOpen]   = useState(false);
  const [editing,    setEditing]    = useState<ExtrusionCatalogItem | null>(null);
  const [viewRow,    setViewRow]    = useState<ExtrusionCatalogItem | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [form,       setForm]       = useState<CatalogForm>(blankForm());

  // Collapsible sections
  const [secOpen, setSecOpen] = useState({ info: true, layers: true, summary: true });
  const toggleSec = (k: keyof typeof secOpen) => setSecOpen(p => ({ ...p, [k]: !p[k] }));

  const f = <K extends keyof CatalogForm>(k: K, v: CatalogForm[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── Pick up pendingFill from Job Card ─────────────────────────
  useEffect(() => {
    if (pendingFill) {
      setEditing(null);
      setForm({
        ...blankForm(),
        catalogName:    pendingFill.catalogName,
        customerId:     pendingFill.customerId,
        customerName:   pendingFill.customerName,
        recipeId:       pendingFill.recipeId,
        recipeName:     pendingFill.recipeName,
        rollMasterId:   pendingFill.rollMasterId,
        rollWidth:      pendingFill.rollWidth,
        layers:         pendingFill.layers,
        standardRate:   pendingFill.standardRate,
        createdFrom:    "Job Card",
        sourceJobCardNo: pendingFill.sourceJobCardNo,
      });
      setPendingFill(null);
      setFormOpen(true);
    }
  }, [pendingFill, setPendingFill]);

  // ── Orders without a catalog entry (Pending) ─────────────────
  const catalogOrderIds = useMemo(() =>
    new Set(catalog.map(c => c.sourceOrderId).filter(Boolean)),
    [catalog]
  );
  const pendingOrders = useMemo(() =>
    extOrders.filter(o => !catalogOrderIds.has(o.id)),
    [catalogOrderIds]
  );

  // ── Computed from form layers ─────────────────────────────────
  const totalMicron = useMemo(() => form.layers.reduce((s, l) => s + l.micron, 0), [form.layers]);
  const totalGSM    = useMemo(() =>
    parseFloat(form.layers.reduce((s, l) => s + l.gsm, 0).toFixed(4)),
    [form.layers]
  );

  const matPctErrors = form.layers.map(
    l => Math.abs(l.materials.reduce((s, m) => s + m.pct, 0) - 100) > 0.1
  );
  const hasError = matPctErrors.some(Boolean);

  // ── Layer update helpers ──────────────────────────────────────
  const updateLayer = (li: number, updates: Partial<ExtCatalogLayer>) => {
    f("layers", form.layers.map((l, i) =>
      i === li ? computeLayer({ ...l, ...updates }) : l
    ));
  };

  const updateMaterial = (li: number, mi: number, updates: Partial<ExtCatalogMatLine>) => {
    f("layers", form.layers.map((l, i) => {
      if (i !== li) return l;
      const mats = l.materials.map((m, j) => j === mi ? { ...m, ...updates } : m);
      return computeLayer({ ...l, materials: mats });
    }));
  };

  const addLayer = () => {
    const newLayer: ExtCatalogLayer = {
      layerNo: form.layers.length + 1, layerName: `Layer ${form.layers.length + 1}`,
      micron: 20, materials: [{ name: "", pct: 100, density: 0.92, rate: 0 }],
      blendDensity: 0, gsm: 0, consumptionPerSqM: 0, blendRate: 0, costPerSqM: 0,
    };
    f("layers", [...form.layers, computeLayer(newLayer)]);
  };

  const removeLayer = (li: number) =>
    f("layers", form.layers.filter((_, i) => i !== li));

  const addMaterial = (li: number) => {
    const rm = rawMaterials[0];
    f("layers", form.layers.map((l, i) => {
      if (i !== li) return l;
      return computeLayer({ ...l, materials: [...l.materials, { name: rm?.name ?? "", pct: 0, density: rm?.density ?? 0.92, rate: rm?.rate ?? 0 }] });
    }));
  };

  const removeMaterial = (li: number, mi: number) => {
    f("layers", form.layers.map((l, i) => {
      if (i !== li) return l;
      return computeLayer({ ...l, materials: l.materials.filter((_, j) => j !== mi) });
    }));
  };

  // ── Fill from booked order ────────────────────────────────────
  const fillFromOrder = (order: Order) => {
    const est    = order.estimationId ? costEstimations.find(e => e.id === order.estimationId) : null;
    const recipe = recipes.find(r => r.id === order.recipeId);
    const roll   = rollMasters.find(r => r.id === order.rollMasterId);
    let layers: ExtCatalogLayer[] = [];
    if (recipe) {
      const microns = est?.layerMicrons ?? getMicrons(recipe, order.rollMasterId);
      layers = buildLayersFromRecipe(recipe, microns);
    }
    setForm(p => ({
      ...p,
      catalogName:  order.productName || order.jobName,
      customerId:   order.customerId, customerName: order.customerName,
      recipeId:     order.recipeId,   recipeName:   order.recipeName,
      rollMasterId: order.rollMasterId, rollWidth: roll?.width ?? 0,
      layers, createdFrom: "Manual",
      sourceOrderId: order.id,
      standardRate: est?.totalCostPerKg ?? 0,
    }));
    setFormOpen(true);
  };

  // ── Open / Close ──────────────────────────────────────────────
  const openNew = () => {
    setEditing(null);
    setForm(blankForm());
    setFormOpen(true);
  };

  const openEdit = (item: ExtrusionCatalogItem) => {
    setEditing(item);
    setForm({
      catalogName: item.catalogName, customerId: item.customerId, customerName: item.customerName,
      recipeId: item.recipeId, recipeName: item.recipeName,
      rollMasterId: item.rollMasterId ?? "", rollWidth: item.rollWidth,
      layers: item.layers, standardRate: item.standardRate, unit: item.unit,
      status: item.status, createdFrom: item.createdFrom,
      sourceWONo: item.sourceWONo, sourceOrderId: item.sourceOrderId,
      sourceJobCardNo: item.sourceJobCardNo ?? "", remarks: item.remarks,
    });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  // ── Save ──────────────────────────────────────────────────────
  const save = () => {
    if (!form.catalogName.trim()) { alert("Please enter a catalog name."); return; }
    if (form.layers.length === 0) { alert("Add at least one layer."); return; }
    if (hasError) { alert("Material % in all layers must total 100%."); return; }

    const item: ExtrusionCatalogItem = {
      id:          editing?.id ?? `EPC${String(catalog.length + 1).padStart(3, "0")}`,
      catalogNo:   editing?.catalogNo ?? genCatalogNo(catalog.map(c => c.catalogNo)),
      catalogName: form.catalogName,
      customerId:  form.customerId, customerName: form.customerName,
      recipeId:    form.recipeId,   recipeName:   form.recipeName,
      rollMasterId: form.rollMasterId, rollWidth: form.rollWidth,
      layers:      form.layers,
      totalMicron, totalGSM,
      standardRate: form.standardRate, unit: form.unit,
      status:       form.status,
      createdFrom:  form.createdFrom,
      sourceWONo:   form.sourceWONo,
      sourceOrderId: form.sourceOrderId,
      sourceJobCardNo: form.sourceJobCardNo,
      createdDate:  editing?.createdDate ?? new Date().toISOString().slice(0, 10),
      remarks:      form.remarks,
    };

    saveCatalogItem(item);
    closeForm();
    setActiveTab("catalog");
  };

  // ── Catalog list columns ──────────────────────────────────────
  const catalogCols: Column<ExtrusionCatalogItem>[] = [
    { key: "catalogNo",   header: "Catalog No",  sortable: true,
      render: r => <span className="font-mono text-xs font-bold text-purple-700">{r.catalogNo}</span> },
    { key: "catalogName", header: "Product Name", sortable: true,
      render: r => <span className="text-xs font-semibold text-gray-800">{r.catalogName}</span> },
    { key: "customerName", header: "Customer",    sortable: true,
      render: r => <span className="text-xs text-gray-700">{r.customerName || "—"}</span> },
    { key: "recipeName",  header: "Recipe",
      render: r => <span className="text-xs text-gray-600">{r.recipeName || "—"}</span> },
    { key: "totalGSM",    header: "GSM",
      render: r => <span className="text-xs font-bold text-blue-700">{r.totalGSM.toFixed(2)}</span> },
    { key: "totalMicron", header: "Micron",
      render: r => <span className="text-xs font-mono text-gray-700">{r.totalMicron} μ</span> },
    { key: "standardRate", header: "Std Rate",
      render: r => <span className="text-xs font-bold text-green-700">₹{r.standardRate}</span> },
    { key: "createdFrom", header: "Source",
      render: r => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          r.createdFrom === "Work Order"
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-gray-50 text-gray-700 border-gray-200"
        }`}>{r.createdFrom}</span>
      )},
    { key: "status", header: "Status",
      render: r => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          r.status === "Active"
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-gray-100 text-gray-500 border-gray-200"
        }`}>{r.status}</span>
      )},
    { key: "createdDate", header: "Created", sortable: true },
  ];

  const stats = {
    total:    catalog.length,
    active:   catalog.filter(c => c.status === "Active").length,
    fromWO:   catalog.filter(c => c.createdFrom === "Work Order").length,
    pending:  pendingOrders.length,
  };

  // ════════════════════════════════════════════════════════════
  // FORM VIEW (full page)
  // ════════════════════════════════════════════════════════════
  if (formOpen) {
    return (
      <div className="min-h-screen bg-gray-50">

        {/* ── Top bar ── */}
        <div className="bg-purple-800 text-white px-4 py-2 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <BookMarked size={16} />
            <span className="font-bold text-sm tracking-wide">
              {editing ? `Edit Catalog — ${editing.catalogNo}` : "New Extrusion Product Catalog"}
            </span>
            {form.createdFrom === "Work Order" && form.sourceWONo && (
              <span className="text-xs bg-purple-700 px-2 py-0.5 rounded font-semibold">
                WO: {form.sourceWONo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select value={form.status} onChange={e => f("status", e.target.value as "Active" | "Inactive")}
              className="text-xs px-2 py-1 bg-purple-700 border border-purple-600 rounded-lg text-white focus:outline-none">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <button onClick={save} disabled={hasError}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${hasError ? "bg-gray-500 cursor-not-allowed" : "bg-green-500 hover:bg-green-400"}`}>
              <Save size={13} />{editing ? "Update" : "Save Catalog"}
            </button>
            <button onClick={closeForm}
              className="flex items-center gap-1 text-purple-200 hover:text-white text-xs px-3 py-1.5 rounded hover:bg-purple-700 transition-colors">
              <X size={13} />Back
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-[1400px] mx-auto">

          {/* ══ SECTION 1: CATALOG INFO ════════════════════════════ */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggleSec("info")} className="w-full flex items-center justify-between px-4 py-3 bg-purple-700 text-white hover:bg-purple-600 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold"><BookMarked size={14} />① Catalog Information</span>
              {secOpen.info ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {secOpen.info && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Catalog Name *</label>
                    <input value={form.catalogName} onChange={e => f("catalogName", e.target.value)}
                      placeholder="e.g. LLDPE Shrink 40μ 3-Layer"
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Customer</label>
                    <select value={form.customerId}
                      onChange={e => {
                        const c = customers.find(x => x.id === e.target.value);
                        setForm(p => ({ ...p, customerId: e.target.value, customerName: c?.name || "" }));
                      }}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400">
                      <option value="">-- Generic / All Customers --</option>
                      {customers.filter(c => c.status === "Active").map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Recipe *</label>
                    <select value={form.recipeId}
                      onChange={e => {
                        const r = recipes.find(x => x.id === e.target.value);
                        if (!r) { setForm(p => ({ ...p, recipeId: "", recipeName: "", layers: [] })); return; }
                        // auto-select linked roll master
                        const linkedRollId = r.rollMasterId ?? form.rollMasterId;
                        const roll = rollMasters.find(x => x.id === linkedRollId);
                        const microns = getMicrons(r, linkedRollId);
                        const layers = buildLayersFromRecipe(r, microns);
                        setForm(p => ({
                          ...p, recipeId: r.id, recipeName: r.name,
                          rollMasterId: linkedRollId, rollWidth: roll?.width ?? p.rollWidth,
                          layers,
                        }));
                      }}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400">
                      <option value="">-- Select Recipe --</option>
                      {recipes.filter(r => r.status === "Active").map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.layers.length}-Layer)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Roll Master</label>
                    <select value={form.rollMasterId}
                      onChange={e => {
                        const roll = rollMasters.find(x => x.id === e.target.value);
                        const recipe = recipes.find(x => x.id === form.recipeId);
                        const microns = recipe ? getMicrons(recipe, e.target.value) : [];
                        const layers  = recipe ? buildLayersFromRecipe(recipe, microns) : form.layers;
                        setForm(p => ({
                          ...p, rollMasterId: e.target.value,
                          rollWidth: roll?.width ?? p.rollWidth, layers,
                        }));
                      }}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400">
                      <option value="">-- Select Roll --</option>
                      {rollMasters.filter(r => r.status === "Active").map(r => (
                        <option key={r.id} value={r.id}>{r.name} — {r.width}mm · {r.micron}μ</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Standard Rate (₹/Kg)</label>
                    <input type="number" value={form.standardRate || ""} onChange={e => f("standardRate", Number(e.target.value))}
                      step={0.01}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Unit</label>
                    <select value={form.unit} onChange={e => f("unit", e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400">
                      <option>Kg</option>
                      <option>Pcs</option>
                      <option>Nos</option>
                    </select>
                  </div>
                  <div className="lg:col-span-3">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Remarks</label>
                    <textarea value={form.remarks} onChange={e => f("remarks", e.target.value)}
                      rows={2} placeholder="Optional notes about this catalog entry…"
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
                  </div>
                </div>

                {/* Source info if from order */}
                {form.sourceOrderId && (
                  <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
                    <ArrowRight size={12} />
                    <span>Created from booked order. {form.sourceWONo && `Linked WO: ${form.sourceWONo}`}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ SECTION 2: LAYER STRUCTURE ═════════════════════════ */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggleSec("layers")} className="w-full flex items-center justify-between px-4 py-3 bg-indigo-700 text-white hover:bg-indigo-600 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Layers size={14} />② Layer Structure
                {form.layers.length > 0 && (
                  <span className="text-xs bg-indigo-600 px-2 py-0.5 rounded font-semibold ml-1">
                    {form.layers.length} layers · {totalMicron}μ · {totalGSM.toFixed(2)} g/m²
                  </span>
                )}
              </span>
              {secOpen.layers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {secOpen.layers && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3 mb-2">
                  <button onClick={addLayer}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
                    <Plus size={12} />Add Layer
                  </button>
                  {form.layers.length === 0 && (
                    <p className="text-xs text-gray-400">Select a recipe above to auto-fill layers, or add manually.</p>
                  )}
                </div>

                {form.layers.map((layer, li) => {
                  const matTotal = layer.materials.reduce((s, m) => s + m.pct, 0);
                  const pctOk = Math.abs(matTotal - 100) <= 0.1;
                  return (
                    <div key={li} className={`border-2 rounded-xl overflow-hidden ${pctOk ? "border-indigo-200" : "border-red-300"}`}>
                      {/* Layer header */}
                      <div className={`flex items-center justify-between px-4 py-2 ${pctOk ? "bg-indigo-50" : "bg-red-50"}`}>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs font-bold text-indigo-700">Layer {layer.layerNo}</span>
                          <input value={layer.layerName}
                            onChange={e => updateLayer(li, { layerName: e.target.value })}
                            className="text-xs border border-indigo-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28"
                            placeholder="Layer name" />
                          <div className="flex items-center gap-1">
                            <label className="text-[10px] text-gray-500 uppercase font-semibold">Micron</label>
                            <input type="number" value={layer.micron}
                              onChange={e => updateLayer(li, { micron: Number(e.target.value) })}
                              className="w-16 text-xs border border-indigo-200 rounded px-2 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          </div>
                          <span className="text-[10px] text-indigo-600 font-mono bg-indigo-100 px-2 py-0.5 rounded">
                            ρ={layer.blendDensity.toFixed(4)} · GSM={layer.gsm.toFixed(4)} · ₹/m²={layer.costPerSqM}
                          </span>
                          {!pctOk && (
                            <span className="flex items-center gap-1 text-[10px] text-red-600 font-semibold">
                              <AlertCircle size={11} />Mat% = {matTotal.toFixed(1)}% (must be 100%)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => addMaterial(li)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-0.5 hover:bg-indigo-100 rounded transition-colors">
                            + Material
                          </button>
                          <button onClick={() => removeLayer(li)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <X size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Materials table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead className="bg-indigo-800 text-white text-[10px] uppercase">
                            <tr>
                              <th className="px-3 py-1.5 text-left">Material</th>
                              <th className="px-3 py-1.5 text-center w-20">%</th>
                              <th className="px-3 py-1.5 text-center w-24">Density</th>
                              <th className="px-3 py-1.5 text-center w-24">Rate (₹/Kg)</th>
                              <th className="px-3 py-1.5 text-center w-24">kg/m²</th>
                              <th className="px-3 py-1.5 text-center w-24">₹/m²</th>
                              <th className="px-3 py-1.5 w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-indigo-50">
                            {layer.materials.map((mat, mi) => {
                              const contribConsumption = parseFloat((mat.pct / 100 * layer.consumptionPerSqM).toFixed(6));
                              const contribCost        = parseFloat((contribConsumption * mat.rate).toFixed(6));
                              return (
                                <tr key={mi} className={mi % 2 === 0 ? "bg-white" : "bg-indigo-50/30"}>
                                  <td className="px-2 py-1">
                                    <select value={mat.name}
                                      onChange={e => {
                                        const rm = rawMaterials.find(r => r.name === e.target.value);
                                        updateMaterial(li, mi, {
                                          name: e.target.value,
                                          density: rm?.density ?? mat.density,
                                          rate: rm?.rate ?? mat.rate,
                                        });
                                      }}
                                      className="w-full text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white min-w-[140px]">
                                      <option value="">-- Select Material --</option>
                                      {rawMaterials.map(r => (
                                        <option key={r.id} value={r.name}>{r.name}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-2 py-1">
                                    <input type="number" value={mat.pct}
                                      onChange={e => updateMaterial(li, mi, { pct: Number(e.target.value) })}
                                      className={`w-full text-center text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 ${pctOk ? "border-indigo-200 focus:ring-indigo-300" : "border-red-300 focus:ring-red-300 bg-red-50"}`}
                                      min={0} max={100} step={0.1} />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input type="number" value={mat.density}
                                      onChange={e => updateMaterial(li, mi, { density: Number(e.target.value) })}
                                      className="w-full text-center text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                      step={0.001} />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input type="number" value={mat.rate}
                                      onChange={e => updateMaterial(li, mi, { rate: Number(e.target.value) })}
                                      className="w-full text-center text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                      step={0.01} />
                                  </td>
                                  <td className="px-2 py-1 text-center font-mono text-gray-600">{contribConsumption}</td>
                                  <td className="px-2 py-1 text-center font-mono text-green-700">₹{contribCost}</td>
                                  <td className="px-2 py-1 text-center">
                                    <button onClick={() => removeMaterial(li, mi)}
                                      className="p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                      <X size={11} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {/* Layer total row */}
                          <tfoot>
                            <tr className="bg-indigo-700 text-white text-[10px] font-bold">
                              <td className="px-3 py-1.5">Total</td>
                              <td className={`px-3 py-1.5 text-center ${pctOk ? "" : "text-red-300"}`}>
                                {matTotal.toFixed(1)}%
                              </td>
                              <td className="px-3 py-1.5 text-center">{layer.blendDensity.toFixed(4)}</td>
                              <td className="px-3 py-1.5 text-center">₹{layer.blendRate.toFixed(4)}</td>
                              <td className="px-3 py-1.5 text-center">{layer.consumptionPerSqM}</td>
                              <td className="px-3 py-1.5 text-center">₹{layer.costPerSqM}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {/* Overall layer summary */}
                {form.layers.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    <KV label="Total Layers"  val={form.layers.length}       cls="bg-indigo-50 border-indigo-200 text-indigo-800" />
                    <KV label="Total Micron"  val={`${totalMicron} μ`}       cls="bg-blue-50 border-blue-200 text-blue-800" />
                    <KV label="Total GSM"     val={`${totalGSM.toFixed(4)} g/m²`} cls="bg-blue-50 border-blue-200 text-blue-800" />
                    <KV label="kg/m²"         val={(totalGSM / 1000).toFixed(6)} cls="bg-teal-50 border-teal-200 text-teal-800" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ SECTION 3: SUMMARY & ACTIONS ══════════════════════ */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggleSec("summary")} className="w-full flex items-center justify-between px-4 py-3 bg-purple-700 text-white hover:bg-purple-600 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold"><Package size={14} />③ Summary & Actions</span>
              {secOpen.summary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {secOpen.summary && (
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                  <KV label="Layers"        val={form.layers.length}            cls="bg-indigo-50 border-indigo-200 text-indigo-800" />
                  <KV label="Total Micron"  val={`${totalMicron} μ`}            cls="bg-blue-50 border-blue-200 text-blue-800" />
                  <KV label="Total GSM"     val={`${totalGSM.toFixed(2)} g/m²`} cls="bg-blue-50 border-blue-200 text-blue-800" />
                  <KV label="Consumption"   val={`${(totalGSM / 1000).toFixed(6)} kg/m²`} cls="bg-teal-50 border-teal-200 text-teal-800" />
                  <KV label="Std Rate"      val={`₹${form.standardRate}/Kg`}    cls="bg-amber-50 border-amber-200 text-amber-800" />
                  <KV label="Status"        val={form.status}                    cls={form.status === "Active" ? "bg-green-50 border-green-200 text-green-800" : "bg-gray-100 border-gray-200 text-gray-700"} />
                </div>

                {hasError && (
                  <div className="mb-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                    <AlertCircle size={14} />
                    Material % in one or more layers does not total 100%. Please fix before saving.
                  </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={save} disabled={hasError}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-colors ${hasError ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"}`}>
                    <Save size={15} />{editing ? "Update Catalog" : "Save to Catalog"}
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors">
                    <Printer size={15} />Print
                  </button>
                  <button onClick={closeForm}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <BookMarked size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Extrusion Product Catalog</h2>
          </div>
          <p className="text-sm text-gray-500">
            {stats.total} catalog entries · {stats.active} active · {stats.pending} orders without catalog
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openNew}>New Catalog</Button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Entries",   val: stats.total,   cls: "bg-purple-50 text-purple-700 border-purple-200" },
          { label: "Active",          val: stats.active,  cls: "bg-green-50 text-green-700 border-green-200" },
          { label: "From Work Order", val: stats.fromWO,  cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Orders Pending",  val: stats.pending, cls: "bg-amber-50 text-amber-700 border-amber-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-semibold">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-gray-100 p-1 rounded-xl gap-1 w-fit">
        {([
          { key: "pending", label: `⏳ Pending Orders (${stats.pending})` },
          { key: "catalog", label: `📋 Catalog (${stats.total})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all
              ${activeTab === t.key ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Pending Orders tab ── */}
      {activeTab === "pending" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {pendingOrders.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <CheckCircle2 size={40} className="mb-3 text-green-400" />
              <p className="font-semibold text-gray-600">All orders have catalog entries!</p>
              <p className="text-sm mt-1">Click "New Catalog" to add a new product catalog.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-purple-700 text-white text-[10px] uppercase tracking-wide">
                  <tr>
                    {["Order No", "Date", "Customer", "Job Name", "Product / Recipe", "Roll", "Qty", "Est. Linked", "Action"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingOrders.map((o, i) => {
                    const est = costEstimations.find(e => e.id === o.estimationId);
                    return (
                      <tr key={o.id} className={i % 2 === 0 ? "bg-white hover:bg-purple-50/30" : "bg-gray-50/40 hover:bg-purple-50/30"}>
                        <td className="px-3 py-2 font-mono font-semibold text-purple-700">{o.orderNo}</td>
                        <td className="px-3 py-2 text-gray-500">{o.date}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{o.customerName}</td>
                        <td className="px-3 py-2 text-gray-700">{o.jobName}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-800 text-[11px]">{o.productName}</p>
                          <p className="text-gray-400 text-[10px]">{o.recipeName}</p>
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-[11px]">{o.rollName}</td>
                        <td className="px-3 py-2 font-bold text-teal-700">{o.quantity.toLocaleString()} {o.unit}</td>
                        <td className="px-3 py-2">
                          {est
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-[10px] font-bold"><CheckCircle2 size={9} />{est.estimationNo}</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold"><AlertCircle size={9} />Direct</span>
                          }
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => fillFromOrder(o)}
                            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                            <ArrowRight size={11} />Create Catalog
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Catalog Entries tab ── */}
      {activeTab === "catalog" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          {catalog.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <BookMarked size={40} className="mb-3 opacity-30" />
              <p className="font-semibold text-gray-600">No catalog entries yet</p>
              <p className="text-sm mt-1">Create a catalog from a booked order or click "New Catalog".</p>
            </div>
          ) : (
            <DataTable
              data={catalog}
              columns={catalogCols}
              searchKeys={["catalogNo", "catalogName", "customerName", "recipeName"]}
              actions={row => (
                <div className="flex items-center gap-1.5 justify-end">
                  <button onClick={() => setViewRow(row)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition-colors">
                    <Eye size={11} />View
                  </button>
                  <button onClick={() => openEdit(row)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg transition-colors">
                    <Pencil size={11} />Edit
                  </button>
                  <button onClick={() => setDeleteId(row.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors">
                    <Trash2 size={11} />Del
                  </button>
                </div>
              )}
            />
          )}
        </div>
      )}

      {/* ── View Modal ── */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)}
          title={`Catalog — ${viewRow.catalogNo}`} size="xl">
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-sm">

            {/* Header info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <KV label="Catalog Name"  val={viewRow.catalogName}   cls="bg-purple-50 border-purple-200 text-purple-800" />
              <KV label="Customer"      val={viewRow.customerName || "Generic"} cls="bg-gray-50 border-gray-200 text-gray-800" />
              <KV label="Recipe"        val={viewRow.recipeName || "—"}     cls="bg-indigo-50 border-indigo-200 text-indigo-800" />
              <KV label="Total GSM"     val={`${viewRow.totalGSM.toFixed(2)} g/m²`} cls="bg-blue-50 border-blue-200 text-blue-800" />
              <KV label="Total Micron"  val={`${viewRow.totalMicron} μ`}    cls="bg-blue-50 border-blue-200 text-blue-800" />
              <KV label="Std Rate"      val={`₹${viewRow.standardRate}/Kg`} cls="bg-amber-50 border-amber-200 text-amber-800" />
              <KV label="Roll Width"    val={viewRow.rollWidth ? `${viewRow.rollWidth} mm` : "—"} cls="bg-gray-50 border-gray-200 text-gray-800" />
              <KV label="Created From"  val={viewRow.createdFrom}           cls="bg-gray-50 border-gray-200 text-gray-800" />
              <KV label="Created Date"  val={viewRow.createdDate}           cls="bg-gray-50 border-gray-200 text-gray-800" />
            </div>

            {/* Layer breakdown */}
            {viewRow.layers.length > 0 && (
              <div>
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-2">Layer Breakdown</p>
                {viewRow.layers.map((layer, li) => (
                  <div key={li} className="mb-3 border border-indigo-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2 bg-indigo-50 text-xs font-bold text-indigo-700">
                      <span>Layer {layer.layerNo}: {layer.layerName}</span>
                      <span className="font-mono">{layer.micron}μ</span>
                      <span>GSM: {layer.gsm.toFixed(4)}</span>
                      <span>ρ: {layer.blendDensity.toFixed(4)}</span>
                      <span className="ml-auto text-green-700">₹/m²: {layer.costPerSqM}</span>
                    </div>
                    <table className="min-w-full text-xs">
                      <thead className="bg-indigo-700 text-white">
                        <tr>
                          {["Material", "%", "Density", "Rate", "kg/m²", "₹/m²"].map(h => (
                            <th key={h} className="px-3 py-1.5 text-center font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {layer.materials.map((m, mi) => (
                          <tr key={mi} className={mi % 2 === 0 ? "bg-white" : "bg-indigo-50/30"}>
                            <td className="px-3 py-1.5 font-medium">{m.name || "—"}</td>
                            <td className="px-3 py-1.5 text-center">{m.pct}%</td>
                            <td className="px-3 py-1.5 text-center font-mono">{m.density}</td>
                            <td className="px-3 py-1.5 text-center">₹{m.rate}</td>
                            <td className="px-3 py-1.5 text-center font-mono">
                              {(m.pct / 100 * layer.consumptionPerSqM).toFixed(6)}
                            </td>
                            <td className="px-3 py-1.5 text-center text-green-700 font-bold">
                              ₹{(m.pct / 100 * layer.consumptionPerSqM * m.rate).toFixed(6)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {viewRow.remarks && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Remarks</p>
                <p className="text-sm text-gray-700">{viewRow.remarks}</p>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-5">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <Button variant="ghost" icon={<Pencil size={14} />} onClick={() => { setViewRow(null); openEdit(viewRow); }}>Edit</Button>
          </div>
        </Modal>
      )}

      {/* ── Delete confirmation ── */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Catalog Entry?" size="sm">
          <p className="text-sm text-gray-600 mb-4">This will permanently remove the catalog entry.</p>
          <div className="flex gap-3">
            <Button variant="danger" onClick={() => { deleteCatalogItem(deleteId); setDeleteId(null); }}>Delete</Button>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

    </div>
  );
}
