"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Eye, Pencil, Trash2, CheckCircle2, Clock, ClipboardList,
  Save, X, Layers, Factory, User, AlertCircle, ShoppingCart,
  BookMarked, ArrowRight, ChevronDown, ChevronUp, Package,
  RefreshCw, FileText, Printer,
} from "lucide-react";
import {
  orders as extOrders, costEstimations, rawMaterials, machines, employees,
  recipes, rollMasters, extrusionWorkOrders,
  Order, CostEstimation, ExtrusionWorkOrder, Recipe,
} from "@/data/dummyData";
import { useExtrusionCatalog, ExtrusionCatalogItem, CatalogPrefill } from "@/context/ExtrusionCatalogContext";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal  from "@/components/ui/Modal";

// ─── Types ────────────────────────────────────────────────────
type WOMatLine = {
  rawMaterialId: string; name: string;
  pct: number; density: number; rate: number;
};

type WOLayer = {
  layerNo: number; layerName: string; micron: number;
  materials: WOMatLine[];
  // computed
  blendDensity: number; gsm: number; consumptionPerSqM: number;
  blendRate: number; costPerSqM: number;
};

type MatAlloc = {
  materialName: string;
  requiredKg: number; rate: number; totalCost: number;
  stockAvailable: number; allocatedKg: number; shortageKg: number;
};

type PReqLine = { materialName: string; shortageKg: number; rate: number; estimatedCost: number };

type WOForm = {
  date: string;
  orderId: string; orderNo: string;
  estimationId: string; estimationNo: string;
  customerId: string; customerName: string;
  jobName: string; productName: string;
  recipeId: string; recipeName: string;
  rollMasterId: string; rollName: string; rollWidth: number;
  orderQty: number; unit: string; deliveryDate: string;
  // Planning
  woLayers: WOLayer[];
  totalMicron: number; totalGSM: number;
  matAllocs: MatAlloc[];
  purchaseRequests: PReqLine[];
  // Production
  machineId: string; machineName: string;
  operatorId: string; operatorName: string;
  plannedDate: string; productionDays: number;
  shiftPlan: string; targetPerShift: number;
  // Financials
  totalCostPerKg: number; sellingPricePerKg: number; totalAmount: number;
  // Meta
  status: "Pending" | "In Production" | "Completed";
  specialInstructions: string;
};

// ─── Constants ────────────────────────────────────────────────
const EXT_MACHINES  = machines.filter(m =>
  m.department?.toLowerCase().includes("extrusion") ||
  m.machineType?.toLowerCase().includes("extrusion") ||
  m.name?.toLowerCase().includes("extrusion")
);
const EXT_OPERATORS = employees.filter(e => e.department === "Extrusion" && e.status === "Active");
const SHIFTS = ["A", "B", "C", "General"];

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

// ─── Layer computation ────────────────────────────────────────
function computeLayer(l: WOLayer): WOLayer {
  const totalPct = l.materials.reduce((s, m) => s + m.pct, 0);
  const norm = totalPct > 0 ? 100 / totalPct : 1;
  const density   = parseFloat(l.materials.reduce((s, m) => s + m.density * (m.pct * norm) / 100, 0).toFixed(6));
  const gsm       = parseFloat((l.micron * density).toFixed(4));
  const consumptionPerSqM = parseFloat((gsm / 1000).toFixed(6));
  const blendRate = parseFloat(l.materials.reduce((s, m) => s + m.rate * (m.pct * norm) / 100, 0).toFixed(4));
  const costPerSqM = parseFloat((consumptionPerSqM * blendRate).toFixed(4));
  return { ...l, blendDensity: density, gsm, consumptionPerSqM, blendRate, costPerSqM };
}

// ─── Build layers from recipe ─────────────────────────────────
function buildLayersFromRecipe(recipe: Recipe, estMicrons: number[]): WOLayer[] {
  return recipe.layers.map((rl, i) => {
    const micron = estMicrons[i] ?? 20;
    const base: WOLayer = {
      layerNo: rl.layerNo, layerName: rl.name, micron,
      materials: rl.materials.map(m => ({
        rawMaterialId: m.rawMaterialId, name: m.rawMaterialName,
        pct: m.percentage, density: m.density, rate: m.rate,
      })),
      blendDensity: 0, gsm: 0, consumptionPerSqM: 0, blendRate: 0, costPerSqM: 0,
    };
    return computeLayer(base);
  });
}

// ─── Compute material allocations ────────────────────────────
function buildMatAllocs(layers: WOLayer[], orderQty: number, totalGSM: number): MatAlloc[] {
  if (totalGSM === 0 || orderQty === 0) return [];
  const totalAreaSqM = (orderQty * 1000) / totalGSM;
  const map = new Map<string, { name: string; kg: number; rate: number }>();
  layers.forEach(l => {
    l.materials.forEach(m => {
      const kg = parseFloat((m.pct / 100 * l.consumptionPerSqM * totalAreaSqM).toFixed(2));
      if (map.has(m.name)) {
        map.get(m.name)!.kg += kg;
      } else {
        map.set(m.name, { name: m.name, kg, rate: m.rate });
      }
    });
  });
  return Array.from(map.values()).map(({ name, kg, rate }) => {
    const rm = rawMaterials.find(r => r.name.toLowerCase().includes(name.toLowerCase().slice(0, 10)));
    const stock = rm?.currentStock ?? 0;
    const allocated = Math.min(kg, stock);
    return {
      materialName: name,
      requiredKg: parseFloat(kg.toFixed(2)),
      rate: rate || rm?.rate || 0,
      totalCost: parseFloat((kg * (rate || rm?.rate || 0)).toFixed(2)),
      stockAvailable: stock,
      allocatedKg: parseFloat(allocated.toFixed(2)),
      shortageKg: parseFloat(Math.max(0, kg - stock).toFixed(2)),
    };
  });
}

// ─── Blank form ───────────────────────────────────────────────
const blankForm = (): WOForm => ({
  date: new Date().toISOString().slice(0, 10),
  orderId: "", orderNo: "",
  estimationId: "", estimationNo: "",
  customerId: "", customerName: "",
  jobName: "", productName: "",
  recipeId: "", recipeName: "",
  rollMasterId: "", rollName: "", rollWidth: 0,
  orderQty: 0, unit: "Kg", deliveryDate: "",
  woLayers: [], totalMicron: 0, totalGSM: 0,
  matAllocs: [], purchaseRequests: [],
  machineId: "", machineName: "",
  operatorId: "", operatorName: "",
  plannedDate: "", productionDays: 1,
  shiftPlan: "A", targetPerShift: 0,
  totalCostPerKg: 0, sellingPricePerKg: 0, totalAmount: 0,
  status: "Pending",
  specialInstructions: "",
});

// ─── Small label/value pair ──────────────────────────────────
const KV = ({ label, val, cls = "" }: { label: string; val: string | number; cls?: string }) => (
  <div className={`rounded-lg border px-3 py-2 ${cls || "bg-gray-50 border-gray-200"}`}>
    <p className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-0.5">{label}</p>
    <p className="text-xs font-bold">{val || "—"}</p>
  </div>
);

const SH = ({ label, icon }: { label: string; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-2 mb-3">
    {icon && <span className="text-blue-600">{icon}</span>}
    <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest">{label}</h3>
    <div className="flex-1 h-px bg-blue-100" />
  </div>
);

// ═══════════════════════════════════════════════════════════════
export default function ExtrusionWorkOrderPage() {
  const { saveCatalogItem, catalog, setPendingFill } = useExtrusionCatalog();
  const router = useRouter();

  // ── Data state ───────────────────────────────────────────────
  const [workOrders, setWOs]       = useState<ExtrusionWorkOrder[]>(extrusionWorkOrders);
  const [activeTab, setActiveTab]  = useState<"pending" | "processed">("pending");
  const [formOpen, setFormOpen]    = useState(false);
  const [editing,  setEditing]     = useState<ExtrusionWorkOrder | null>(null);
  const [viewRow,  setViewRow]     = useState<ExtrusionWorkOrder | null>(null);
  const [deleteId, setDeleteId]    = useState<string | null>(null);
  const [form,     setForm]        = useState<WOForm>(blankForm());

  // Collapsible section state
  const [secOpen, setSecOpen] = useState({ order: true, replan: true, alloc: true, prod: true, summary: true });
  const toggleSec = (k: keyof typeof secOpen) => setSecOpen(p => ({ ...p, [k]: !p[k] }));

  // Generated PRs (in-session)
  const [genPRs, setGenPRs] = useState<{ woRef: string; items: PReqLine[] }[]>([]);

  const f = <K extends keyof WOForm>(k: K, v: WOForm[K]) => setForm(p => ({ ...p, [k]: v }));

  // ── Orders without a WO (Pending list) ──────────────────────
  const woOrderIds = useMemo(() => new Set(workOrders.map(w => w.orderId)), [workOrders]);
  const pendingOrders = useMemo(() => extOrders.filter(o => !woOrderIds.has(o.id)), [woOrderIds]);

  // ── Computed totals ──────────────────────────────────────────
  const totalMicron = useMemo(() => form.woLayers.reduce((s, l) => s + l.micron, 0), [form.woLayers]);
  const totalGSM    = useMemo(() => parseFloat(form.woLayers.reduce((s, l) => s + l.gsm, 0).toFixed(4)), [form.woLayers]);
  const totalCostPerSqM = useMemo(() => parseFloat(form.woLayers.reduce((s, l) => s + l.costPerSqM, 0).toFixed(4)), [form.woLayers]);
  const totalAreaSqM    = useMemo(() => totalGSM > 0 ? parseFloat((form.orderQty * 1000 / totalGSM).toFixed(2)) : 0, [form.orderQty, totalGSM]);
  const totalMaterialCost = useMemo(() => form.matAllocs.reduce((s, m) => s + m.totalCost, 0), [form.matAllocs]);
  const shortageItems = useMemo(() => form.matAllocs.filter(m => m.shortageKg > 0), [form.matAllocs]);

  // ── Fill order data ──────────────────────────────────────────
  const fillFromOrder = (order: Order, overrideRecipeId?: string, overrideRollId?: string) => {
    const est    = order.estimationId ? costEstimations.find(e => e.id === order.estimationId) : null;
    const recipeId = overrideRecipeId ?? order.recipeId;
    const rollId   = overrideRollId   ?? order.rollMasterId;
    const recipe = recipes.find(r => r.id === recipeId);
    const roll   = rollMasters.find(r => r.id === rollId);
    let layers: WOLayer[] = [];
    if (recipe) {
      const microns = est?.layerMicrons
        ?? (recipe.layerRatio && roll
            ? distributeByRatio(roll.micron, recipe.layerRatio, recipe.layers.length)
            : recipe.layers.map(() => parseFloat(((roll?.micron ?? 40) / recipe.layers.length).toFixed(2))));
      layers = buildLayersFromRecipe(recipe, microns);
    }
    const gsm = parseFloat(layers.reduce((s, l) => s + l.gsm, 0).toFixed(4));
    const allocs = buildMatAllocs(layers, order.quantity, gsm);
    setForm(p => ({
      ...p,
      orderId: order.id, orderNo: order.orderNo,
      estimationId: est?.id ?? "", estimationNo: est?.estimationNo ?? "",
      customerId: order.customerId, customerName: order.customerName,
      jobName: order.jobName, productName: order.productName,
      recipeId: recipe?.id ?? order.recipeId, recipeName: recipe?.name ?? order.recipeName,
      rollMasterId: roll?.id ?? order.rollMasterId, rollName: roll?.name ?? order.rollName,
      rollWidth: roll?.width ?? 0,
      orderQty: order.quantity, unit: order.unit, deliveryDate: order.deliveryDate,
      totalCostPerKg: est?.totalCostPerKg ?? 0,
      sellingPricePerKg: est?.sellingPricePerKg ?? 0,
      totalAmount: order.totalAmount,
      woLayers: layers, totalMicron: layers.reduce((s, l) => s + l.micron, 0),
      totalGSM: gsm, matAllocs: allocs, purchaseRequests: [],
    }));
  };

  // ── Replan: update layer ─────────────────────────────────────
  const updateLayer = (li: number, updates: Partial<WOLayer>) => {
    setForm(p => {
      const layers = p.woLayers.map((l, i) => i === li ? computeLayer({ ...l, ...updates }) : l);
      const gsm = parseFloat(layers.reduce((s, l) => s + l.gsm, 0).toFixed(4));
      const allocs = buildMatAllocs(layers, p.orderQty, gsm);
      return { ...p, woLayers: layers, totalGSM: gsm, matAllocs: allocs };
    });
  };

  const updateMaterial = (li: number, mi: number, updates: Partial<WOMatLine>) => {
    setForm(p => {
      const layers = p.woLayers.map((l, i) => {
        if (i !== li) return l;
        const mats = l.materials.map((m, j) => j === mi ? { ...m, ...updates } : m);
        return computeLayer({ ...l, materials: mats });
      });
      const gsm = parseFloat(layers.reduce((s, l) => s + l.gsm, 0).toFixed(4));
      const allocs = buildMatAllocs(layers, p.orderQty, gsm);
      return { ...p, woLayers: layers, totalGSM: gsm, matAllocs: allocs };
    });
  };

  const recomputeAllocs = () => {
    const allocs = buildMatAllocs(form.woLayers, form.orderQty, totalGSM);
    f("matAllocs", allocs);
  };

  // ── Open / Close Form ────────────────────────────────────────
  const openNew = (order?: Order) => {
    setEditing(null);
    setForm(blankForm());
    if (order) setTimeout(() => fillFromOrder(order), 0);
    setFormOpen(true);
  };

  const openEdit = (wo: ExtrusionWorkOrder) => {
    setEditing(wo);
    const order = extOrders.find(o => o.id === wo.orderId);
    const recipe = recipes.find(r => r.id === wo.recipeId);
    let layers: WOLayer[] = [];
    if (recipe) {
      layers = buildLayersFromRecipe(recipe, wo.layerMicrons);
    }
    const gsm = parseFloat(layers.reduce((s, l) => s + l.gsm, 0).toFixed(4));
    const allocs = buildMatAllocs(layers, wo.quantity, gsm);
    setForm({
      date: wo.date,
      orderId: wo.orderId, orderNo: wo.orderNo,
      estimationId: wo.estimationId, estimationNo: wo.estimationNo,
      customerId: wo.customerId, customerName: wo.customerName,
      jobName: wo.jobName, productName: wo.productName,
      recipeId: wo.recipeId, recipeName: wo.recipeName,
      rollMasterId: wo.rollMasterId, rollName: wo.rollName, rollWidth: wo.rollWidth,
      orderQty: wo.quantity, unit: wo.unit, deliveryDate: wo.deliveryDate,
      woLayers: layers, totalMicron: wo.totalMicron, totalGSM: gsm,
      matAllocs: allocs, purchaseRequests: [],
      machineId: wo.machineId, machineName: wo.machineName,
      operatorId: wo.operatorId, operatorName: wo.operatorName,
      plannedDate: wo.plannedDate, productionDays: 1,
      shiftPlan: "A", targetPerShift: 0,
      totalCostPerKg: wo.totalCostPerKg, sellingPricePerKg: wo.sellingPricePerKg,
      totalAmount: wo.totalAmount,
      status: wo.status as WOForm["status"],
      specialInstructions: wo.specialInstructions,
    });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  // ── Make Catalog from Work Order row ─────────────────────────
  const makeCatalogFromWO = (wo: ExtrusionWorkOrder) => {
    const recipe = recipes.find(r => r.id === wo.recipeId);
    if (!recipe) return;
    const layers = wo.layerResults.map((lr, i) => {
      const recLayer = recipe.layers[i];
      const mats = recLayer?.materials?.map(m => ({
        name: m.rawMaterialName, pct: m.percentage, density: m.density, rate: m.rate,
      })) ?? [];
      return {
        layerNo: lr.layerNo, layerName: lr.layerName, micron: lr.micron,
        materials: mats, blendDensity: lr.density, gsm: lr.gsm,
        consumptionPerSqM: lr.consumptionPerSqM, blendRate: lr.blendRate, costPerSqM: lr.costPerSqM,
      };
    });
    const fill: CatalogPrefill = {
      catalogName: wo.productName, customerId: wo.customerId, customerName: wo.customerName,
      recipeId: wo.recipeId, recipeName: wo.recipeName,
      rollMasterId: wo.rollMasterId, rollWidth: wo.rollWidth,
      layers, standardRate: wo.sellingPricePerKg,
      sourceJobCardNo: "",
    };
    setPendingFill(fill);
    router.push("/extrusion/product-catalog");
  };

  // ── Save ─────────────────────────────────────────────────────
  const save = () => {
    if (!form.orderId) { alert("Please select a source order."); return; }
    if (!form.machineId) { alert("Please assign a machine."); return; }

    const payload: Omit<ExtrusionWorkOrder, "id" | "workOrderNo"> = {
      date: form.date,
      orderId: form.orderId, orderNo: form.orderNo,
      estimationId: form.estimationId, estimationNo: form.estimationNo,
      customerId: form.customerId, customerName: form.customerName,
      jobName: form.jobName, productName: form.productName,
      recipeId: form.recipeId, recipeName: form.recipeName,
      rollMasterId: form.rollMasterId, rollName: form.rollName, rollWidth: form.rollWidth,
      totalMicron, layerMicrons: form.woLayers.map(l => l.micron),
      layerResults: form.woLayers.map(l => ({
        layerNo: l.layerNo, layerName: l.layerName, micron: l.micron,
        density: l.blendDensity, gsm: l.gsm, consumptionPerSqM: l.consumptionPerSqM,
        blendRate: l.blendRate, costPerSqM: l.costPerSqM,
      })),
      totalGSM,
      requiredMaterials: form.matAllocs.map(m => ({
        materialName: m.materialName, quantityKg: m.requiredKg,
        ratePerKg: m.rate, totalCost: m.totalCost,
      })),
      totalCostPerKg: form.totalCostPerKg,
      sellingPricePerKg: form.sellingPricePerKg,
      totalAmount: form.totalAmount,
      machineId: form.machineId, machineName: form.machineName,
      operatorId: form.operatorId, operatorName: form.operatorName,
      quantity: form.orderQty, unit: form.unit,
      plannedDate: form.plannedDate, deliveryDate: form.deliveryDate,
      status: form.status === "In Production" ? "Pending" : form.status,
      specialInstructions: form.specialInstructions,
    };

    if (editing) {
      setWOs(ws => ws.map(w => w.id === editing.id ? { ...payload, id: editing.id, workOrderNo: editing.workOrderNo } : w));
    } else {
      const workOrderNo = generateCode(UNIT_CODE.Extrusion, MODULE_CODE.WorkOrder, workOrders.map(w => w.workOrderNo));
      const id = `EXWO${String(workOrders.length + 1).padStart(3, "0")}`;
      setWOs(ws => [...ws, { ...payload, id, workOrderNo }]);
    }
    closeForm();
    setActiveTab("processed");
  };

  // ── Generate Purchase Request ────────────────────────────────
  const generatePR = () => {
    const prItems: PReqLine[] = shortageItems.map(m => ({
      materialName: m.materialName,
      shortageKg: m.shortageKg,
      rate: m.rate,
      estimatedCost: parseFloat((m.shortageKg * m.rate).toFixed(2)),
    }));
    if (prItems.length === 0) { alert("No shortage items found."); return; }
    f("purchaseRequests", prItems);
    setGenPRs(p => [...p, { woRef: form.orderNo || "New WO", items: prItems }]);
    alert(`Purchase Request generated for ${prItems.length} item(s). Total: ₹${prItems.reduce((s, i) => s + i.estimatedCost, 0).toLocaleString()}`);
  };

  // ── Columns for Processed tab ────────────────────────────────
  const processedCols: Column<ExtrusionWorkOrder>[] = [
    { key: "workOrderNo",  header: "WO No", sortable: true,
      render: r => <span className="font-mono text-xs font-bold text-blue-700">{r.workOrderNo}</span> },
    { key: "date",         header: "Date",  sortable: true },
    { key: "orderNo",      header: "Order Ref",
      render: r => <span className="text-xs font-mono text-gray-500">{r.orderNo}</span> },
    { key: "customerName", header: "Customer", sortable: true,
      render: r => <span className="text-xs font-semibold text-gray-800">{r.customerName}</span> },
    { key: "jobName",      header: "Job", render: r => <span className="text-xs text-gray-600">{r.jobName}</span> },
    { key: "recipeName",   header: "Recipe", render: r => <span className="text-xs text-gray-700">{r.recipeName}</span> },
    { key: "totalGSM",     header: "GSM",
      render: r => <span className="text-xs font-bold text-blue-700">{r.totalGSM.toFixed(2)}</span> },
    { key: "quantity",     header: "Qty",
      render: r => <span className="text-xs font-bold">{r.quantity.toLocaleString()} {r.unit}</span> },
    { key: "machineName",  header: "Machine",
      render: r => <span className="text-xs text-gray-600">{r.machineName || "—"}</span> },
    { key: "plannedDate",  header: "Planned", sortable: true },
    { key: "status",       header: "Status",
      render: r => r.status === "Completed"
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-[10px] font-bold"><CheckCircle2 size={10} />Done</span>
        : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold"><Clock size={10} />Pending</span>
    },
  ];

  // ════════════════════════════════════════════════════════════
  // FORM VIEW
  // ════════════════════════════════════════════════════════════
  if (formOpen) {
    const matPctErrors = form.woLayers.map(l => Math.abs(l.materials.reduce((s, m) => s + m.pct, 0) - 100) > 0.1);
    const hasError = matPctErrors.some(Boolean);

    return (
      <div className="min-h-screen bg-gray-50">

        {/* ── Top bar ── */}
        <div className="bg-blue-800 text-white px-4 py-2 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <ClipboardList size={16} />
            <span className="font-bold text-sm tracking-wide">
              {editing ? `Edit Work Order — ${editing.workOrderNo}` : "New Extrusion Work Order"}
            </span>
            {form.estimationNo && (
              <span className="text-xs bg-blue-700 px-2 py-0.5 rounded font-semibold">
                EST: {form.estimationNo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select value={form.status} onChange={e => f("status", e.target.value as WOForm["status"])}
              className="text-xs px-2 py-1 bg-blue-700 border border-blue-600 rounded-lg text-white focus:outline-none">
              {["Pending", "In Production", "Completed"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={save} disabled={hasError}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${hasError ? "bg-gray-500 cursor-not-allowed" : "bg-green-500 hover:bg-green-400"}`}>
              <Save size={13} />{editing ? "Update" : "Save WO"}
            </button>
            <button onClick={closeForm}
              className="flex items-center gap-1 text-blue-200 hover:text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 transition-colors">
              <X size={13} />Back
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-[1400px] mx-auto">

          {/* ══ SECTION 1: ORDER INFO ══════════════════════════════ */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggleSec("order")} className="w-full flex items-center justify-between px-4 py-3 bg-blue-700 text-white hover:bg-blue-600 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold"><ShoppingCart size={14} />① Order Information</span>
              {secOpen.order ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {secOpen.order && (
              <div className="p-4 space-y-4">

                {/* Order select + date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Source Order *</label>
                    <select value={form.orderId}
                      onChange={e => {
                        const o = extOrders.find(x => x.id === e.target.value);
                        if (o) fillFromOrder(o);
                        else f("orderId", "");
                      }}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="">-- Select Booked Order --</option>
                      {editing && !pendingOrders.find(o => o.id === editing.orderId) && (
                        <option value={editing.orderId}>{editing.orderNo} — {editing.customerName}</option>
                      )}
                      {pendingOrders.map(o => (
                        <option key={o.id} value={o.id}>{o.orderNo} — {o.customerName} · {o.recipeName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">WO Date</label>
                    <input type="date" value={form.date} onChange={e => f("date", e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>

                {/* Auto-filled info */}
                {form.orderId && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    <KV label="Customer"   val={form.customerName}  cls="bg-blue-50 border-blue-200 text-blue-800" />
                    <KV label="Job Name"   val={form.jobName}       cls="bg-gray-50 border-gray-200 text-gray-800" />
                    <KV label="Recipe"     val={form.recipeName}    cls="bg-indigo-50 border-indigo-200 text-indigo-800" />
                    <KV label="Roll"       val={`${form.rollName}`} cls="bg-gray-50 border-gray-200 text-gray-800" />
                    <KV label="Order Qty"  val={`${form.orderQty.toLocaleString()} ${form.unit}`} cls="bg-teal-50 border-teal-200 text-teal-800" />
                    <KV label="Estimation" val={form.estimationNo || "Direct Order"} cls={form.estimationNo ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"} />
                  </div>
                )}

                {/* Pricing */}
                {form.totalCostPerKg > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <KV label="Cost/Kg"     val={`₹${form.totalCostPerKg}`}          cls="bg-amber-50 border-amber-200 text-amber-800" />
                    <KV label="Selling/Kg"  val={`₹${form.sellingPricePerKg}`}       cls="bg-green-50 border-green-200 text-green-800" />
                    <KV label="Order Value" val={`₹${form.totalAmount.toLocaleString()}`} cls="bg-purple-50 border-purple-200 text-purple-800" />
                    <KV label="Delivery"    val={form.deliveryDate}                  cls="bg-gray-50 border-gray-200 text-gray-800" />
                  </div>
                )}

                {!form.estimationNo && form.orderId && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 text-xs text-amber-800">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <p>This order has no linked estimation. You can do <strong>Full Planning</strong> below by defining layers and materials manually.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ SECTION 2: MATERIAL PLANNING (REPLAN) ═════════════ */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggleSec("replan")} className="w-full flex items-center justify-between px-4 py-3 bg-indigo-700 text-white hover:bg-indigo-600 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Layers size={14} />
                ② Material Planning {form.estimationNo ? "(Replan)" : "(Full Planning)"}
                {form.woLayers.length > 0 && (
                  <span className="text-xs bg-indigo-600 px-2 py-0.5 rounded">
                    {form.woLayers.length} layers · {totalMicron}μ · {totalGSM.toFixed(2)} GSM
                  </span>
                )}
              </span>
              {secOpen.replan ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {secOpen.replan && (
              <div className="p-4 space-y-4">

                {/* ── Recipe * and Roll Master selects — always visible ── */}
                {form.orderId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Recipe *</label>
                      <select value={form.recipeId}
                        onChange={e => {
                          const r = recipes.find(x => x.id === e.target.value);
                          if (!r) return;
                          const linkedRoll = rollMasters.find(x => x.id === r.rollMasterId);
                          const rollId = linkedRoll?.id ?? form.rollMasterId;
                          const currentOrder = extOrders.find(o => o.id === form.orderId);
                          if (currentOrder) fillFromOrder(currentOrder, r.id, rollId);
                        }}
                        className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-400">
                        <option value="">-- Select Recipe --</option>
                        {recipes.filter(r => r.status === "Active").map(r => (
                          <option key={r.id} value={r.id}>{r.name} ({r.layers.length} layers)</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Roll Master</label>
                      <select value={form.rollMasterId}
                        onChange={e => {
                          const currentOrder = extOrders.find(o => o.id === form.orderId);
                          if (currentOrder) fillFromOrder(currentOrder, form.recipeId, e.target.value);
                        }}
                        className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-400">
                        <option value="">-- Select Roll --</option>
                        {rollMasters.filter(r => r.status === "Active").map(r => (
                          <option key={r.id} value={r.id}>{r.name} — {r.width}mm · {r.micron}μ</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {!form.orderId ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl py-12 text-center">
                    <Layers size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">Select a source order first to load layer plan</p>
                    <p className="text-xs text-gray-400 mt-1">Recipe layers will appear here for editing</p>
                  </div>
                ) : form.woLayers.length === 0 ? (
                  <div className="border-2 border-dashed border-indigo-100 rounded-xl py-8 text-center">
                    <Layers size={28} className="mx-auto mb-2 text-indigo-300" />
                    <p className="text-sm text-gray-500">Select Recipe above to load layers</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hasError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 flex items-center gap-2 text-xs text-red-700">
                        <AlertCircle size={13} />
                        Material % must total 100% in each layer before saving
                      </div>
                    )}

                    {/* Summary row */}
                    <div className="grid grid-cols-4 gap-2">
                      <KV label="Total Micron" val={`${totalMicron} μ`}          cls="bg-indigo-50 border-indigo-200 text-indigo-800" />
                      <KV label="Total GSM"    val={`${totalGSM.toFixed(3)} g/m²`} cls="bg-blue-50 border-blue-200 text-blue-800" />
                      <KV label="Total Area"   val={`${totalAreaSqM.toLocaleString()} m²`} cls="bg-teal-50 border-teal-200 text-teal-800" />
                      <KV label="Cost/m²"     val={`₹${totalCostPerSqM}`}        cls="bg-amber-50 border-amber-200 text-amber-800" />
                    </div>

                    {/* Layer cards */}
                    {form.woLayers.map((layer, li) => {
                      const layerPctTotal = layer.materials.reduce((s, m) => s + m.pct, 0);
                      const pctOk = Math.abs(layerPctTotal - 100) <= 0.1;
                      return (
                        <div key={li} className={`border-2 rounded-xl overflow-hidden ${pctOk ? "border-gray-200" : "border-red-300"}`}>
                          {/* Layer header */}
                          <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                            <span className="text-xs font-black text-indigo-700 bg-indigo-100 rounded px-2 py-0.5">L{layer.layerNo}</span>
                            <span className="text-sm font-bold text-gray-800 flex-1">{layer.layerName}</span>
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-semibold text-gray-500">Micron (μ)</label>
                              <input type="number" min={1} max={200}
                                value={layer.micron}
                                onChange={e => updateLayer(li, { micron: Number(e.target.value) })}
                                className="w-20 text-center text-sm font-bold border border-indigo-300 rounded-lg px-2 py-1 bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                            </div>
                            <div className="text-right text-xs">
                              <p className="text-gray-500">GSM: <span className="font-bold text-blue-700">{layer.gsm.toFixed(3)}</span></p>
                              <p className="text-gray-500">Density: <span className="font-bold text-gray-700">{layer.blendDensity.toFixed(4)}</span></p>
                            </div>
                            <div className="text-right text-xs">
                              <p className="text-gray-500">Rate: <span className="font-bold text-amber-700">₹{layer.blendRate}/kg</span></p>
                              <p className="text-gray-500">Cost: <span className="font-bold text-green-700">₹{layer.costPerSqM}/m²</span></p>
                            </div>
                          </div>

                          {/* Materials table */}
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead className="bg-indigo-600 text-white text-[10px] uppercase">
                                <tr>
                                  <th className="px-3 py-1.5 text-left">Material</th>
                                  <th className="px-3 py-1.5 text-center w-28">% Share</th>
                                  <th className="px-3 py-1.5 text-center w-24">Density</th>
                                  <th className="px-3 py-1.5 text-center w-28">Rate (₹/kg)</th>
                                  <th className="px-3 py-1.5 text-right w-32">Req. Kg</th>
                                </tr>
                              </thead>
                              <tbody>
                                {layer.materials.map((mat, mi) => {
                                  const reqKg = totalAreaSqM > 0
                                    ? parseFloat((mat.pct / 100 * layer.consumptionPerSqM * totalAreaSqM).toFixed(2))
                                    : 0;
                                  return (
                                    <tr key={mi} className={mi % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                      <td className="px-3 py-1.5 font-medium text-gray-800">{mat.name}</td>
                                      <td className="px-2 py-1">
                                        <div className="flex items-center gap-1">
                                          <input type="number" min={0} max={100} step={0.5}
                                            value={mat.pct}
                                            onChange={e => updateMaterial(li, mi, { pct: Number(e.target.value) })}
                                            className="w-full text-center text-xs font-bold border border-indigo-300 rounded px-1.5 py-1 bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                                          <span className="text-gray-400 text-[10px]">%</span>
                                        </div>
                                      </td>
                                      <td className="px-3 py-1.5 text-center font-mono text-gray-600">{mat.density.toFixed(4)}</td>
                                      <td className="px-2 py-1">
                                        <input type="number" min={0} step={0.01}
                                          value={mat.rate}
                                          onChange={e => updateMaterial(li, mi, { rate: Number(e.target.value) })}
                                          className="w-full text-center text-xs font-bold border border-amber-200 rounded px-1.5 py-1 bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-bold text-teal-700">
                                        {reqKg.toLocaleString()} kg
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className={`text-xs font-bold border-t-2 ${pctOk ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                                  <td className="px-3 py-1.5 text-right text-gray-600">Total %</td>
                                  <td className={`px-3 py-1.5 text-center ${pctOk ? "text-green-700" : "text-red-700"}`}>
                                    {layerPctTotal.toFixed(1)}%
                                    {!pctOk && <span className="ml-1 text-[9px]">(must be 100%)</span>}
                                  </td>
                                  <td colSpan={3} />
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ SECTION 3: MATERIAL ALLOCATION ════════════════════ */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggleSec("alloc")} className="w-full flex items-center justify-between px-4 py-3 bg-teal-700 text-white hover:bg-teal-600 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Package size={14} />
                ③ Material Allocation & Stock Check
                {shortageItems.length > 0 && (
                  <span className="text-xs bg-red-500 px-2 py-0.5 rounded animate-pulse">
                    {shortageItems.length} shortage{shortageItems.length > 1 ? "s" : ""}
                  </span>
                )}
              </span>
              {secOpen.alloc ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {secOpen.alloc && (
              <div className="p-4">
                {form.matAllocs.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center text-sm text-gray-400">
                    <Package size={28} className="mx-auto mb-2 text-gray-300" />
                    Complete Material Planning first to see allocation
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500">
                        Order: <strong>{form.orderQty.toLocaleString()} {form.unit}</strong>
                        {totalAreaSqM > 0 && <> · Area: <strong>{totalAreaSqM.toLocaleString()} m²</strong></>}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={recomputeAllocs}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg transition-colors">
                          <RefreshCw size={11} />Recompute
                        </button>
                        {shortageItems.length > 0 && (
                          <button onClick={generatePR}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                            <FileText size={11} />Generate PR ({shortageItems.length})
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="min-w-full text-xs border-collapse">
                        <thead className="bg-teal-700 text-white text-[10px] uppercase tracking-wide">
                          <tr>
                            <th className="px-3 py-2 text-left">Material</th>
                            <th className="px-3 py-2 text-right">Required (Kg)</th>
                            <th className="px-3 py-2 text-right">Rate (₹/kg)</th>
                            <th className="px-3 py-2 text-right">Total Cost</th>
                            <th className="px-3 py-2 text-right">In Stock (Kg)</th>
                            <th className="px-3 py-2 text-right">Allocated (Kg)</th>
                            <th className="px-3 py-2 text-right">Shortage (Kg)</th>
                            <th className="px-3 py-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {form.matAllocs.map((m, i) => (
                            <tr key={i} className={m.shortageKg > 0 ? "bg-red-50/50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                              <td className="px-3 py-2 font-medium text-gray-800">{m.materialName}</td>
                              <td className="px-3 py-2 text-right font-bold text-blue-700">{m.requiredKg.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-600">₹{m.rate}</td>
                              <td className="px-3 py-2 text-right font-bold text-teal-700">₹{m.totalCost.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{m.stockAvailable.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-semibold text-green-700">{m.allocatedKg.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-bold text-red-700">{m.shortageKg > 0 ? m.shortageKg.toLocaleString() : "—"}</td>
                              <td className="px-3 py-2 text-center">
                                {m.shortageKg > 0
                                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 rounded-full"><AlertCircle size={9} />Short</span>
                                  : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 rounded-full"><CheckCircle2 size={9} />OK</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t-2 border-gray-200 font-bold text-xs">
                          <tr>
                            <td className="px-3 py-2 text-right text-gray-600 uppercase">Total</td>
                            <td className="px-3 py-2 text-right text-blue-700">
                              {form.matAllocs.reduce((s, m) => s + m.requiredKg, 0).toFixed(2)} Kg
                            </td>
                            <td />
                            <td className="px-3 py-2 text-right text-teal-700">
                              ₹{totalMaterialCost.toLocaleString()}
                            </td>
                            <td colSpan={4} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Generated PRs */}
                    {form.purchaseRequests.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1">
                          <FileText size={12} />Purchase Request Generated
                        </p>
                        <div className="space-y-1">
                          {form.purchaseRequests.map((pr, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-amber-700 py-0.5 border-b border-amber-100 last:border-0">
                              <span className="font-medium">{pr.materialName}</span>
                              <span>{pr.shortageKg.toLocaleString()} kg · ₹{pr.estimatedCost.toLocaleString()}</span>
                            </div>
                          ))}
                          <p className="text-right text-xs font-bold text-amber-900 mt-1">
                            Total PR Value: ₹{form.purchaseRequests.reduce((s, p) => s + p.estimatedCost, 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ SECTION 4: PRODUCTION PLANNING ════════════════════ */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggleSec("prod")} className="w-full flex items-center justify-between px-4 py-3 bg-gray-700 text-white hover:bg-gray-600 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold"><Factory size={14} />④ Production Planning</span>
              {secOpen.prod ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {secOpen.prod && (
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Machine *</label>
                    <select value={form.machineId}
                      onChange={e => {
                        const m = machines.find(x => x.id === e.target.value);
                        f("machineId", e.target.value);
                        if (m) f("machineName", m.name);
                      }}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="">-- Select Machine --</option>
                      {EXT_MACHINES.map(m => <option key={m.id} value={m.id}>{m.name} ({m.status})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Operator</label>
                    <select value={form.operatorId}
                      onChange={e => {
                        const emp = EXT_OPERATORS.find(x => x.id === e.target.value);
                        f("operatorId", e.target.value);
                        if (emp) f("operatorName", emp.name);
                      }}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="">-- Select --</option>
                      {EXT_OPERATORS.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Planned Date</label>
                    <input type="date" value={form.plannedDate} onChange={e => f("plannedDate", e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Delivery Date</label>
                    <input type="date" value={form.deliveryDate} onChange={e => f("deliveryDate", e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Production Days</label>
                    <input type="number" min={1} value={form.productionDays} onChange={e => f("productionDays", Number(e.target.value))}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Shift</label>
                    <select value={form.shiftPlan} onChange={e => f("shiftPlan", e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-400">
                      {SHIFTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Target/Shift (Kg)</label>
                    <input type="number" min={0} value={form.targetPerShift || ""} onChange={e => f("targetPerShift", Number(e.target.value))}
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Optional" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Special Instructions</label>
                    <textarea value={form.specialInstructions} onChange={e => f("specialInstructions", e.target.value)}
                      rows={3} placeholder="Production notes, quality checks, special requirements…"
                      className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ══ SECTION 5: SUMMARY ════════════════════════════════ */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggleSec("summary")} className="w-full flex items-center justify-between px-4 py-3 bg-purple-700 text-white hover:bg-purple-600 transition-colors">
              <span className="flex items-center gap-2 text-sm font-bold"><FileText size={14} />⑤ Summary & Actions</span>
              {secOpen.summary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {secOpen.summary && (
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                  <KV label="Layers"        val={`${form.woLayers.length}`}               cls="bg-indigo-50 border-indigo-200 text-indigo-800" />
                  <KV label="Total Micron"  val={`${totalMicron} μ`}                      cls="bg-blue-50 border-blue-200 text-blue-800" />
                  <KV label="Total GSM"     val={`${totalGSM.toFixed(2)} g/m²`}          cls="bg-blue-50 border-blue-200 text-blue-800" />
                  <KV label="Area"          val={`${totalAreaSqM.toLocaleString()} m²`}  cls="bg-teal-50 border-teal-200 text-teal-800" />
                  <KV label="Material Cost" val={`₹${totalMaterialCost.toLocaleString()}`} cls="bg-amber-50 border-amber-200 text-amber-800" />
                  <KV label="Order Value"   val={`₹${form.totalAmount.toLocaleString()}`} cls="bg-purple-50 border-purple-200 text-purple-800" />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={save} disabled={hasError}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-colors ${hasError ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"}`}>
                    <Save size={15} />{editing ? "Update Work Order" : "Save Work Order"}
                  </button>
                  <button
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
                    disabled={form.woLayers.length === 0 || hasError}
                    onClick={() => {
                      if (form.woLayers.length === 0) { alert("Add at least one layer before creating a catalog."); return; }
                      const woNo = editing?.workOrderNo || "";
                      const year = new Date().getFullYear();
                      const max  = catalog.reduce((m, c) => { const n = parseInt(c.catalogNo.match(/EPC-\d{4}-(\d+)/)?.[1] ?? "0"); return Math.max(m, n); }, 0);
                      const catalogNo = `EPC-${year}-${String(max + 1).padStart(3, "0")}`;
                      const item: ExtrusionCatalogItem = {
                        id: `EPC${String(catalog.length + 1).padStart(3, "0")}`,
                        catalogNo,
                        catalogName: form.productName || form.jobName,
                        customerId: form.customerId, customerName: form.customerName,
                        recipeId: form.recipeId,     recipeName: form.recipeName,
                        rollWidth: form.rollWidth,
                        layers: form.woLayers.map(l => ({
                          layerNo: l.layerNo, layerName: l.layerName, micron: l.micron,
                          materials: l.materials.map(m => ({ name: m.name, pct: m.pct, density: m.density, rate: m.rate })),
                          blendDensity: l.blendDensity, gsm: l.gsm,
                          consumptionPerSqM: l.consumptionPerSqM, blendRate: l.blendRate, costPerSqM: l.costPerSqM,
                        })),
                        totalMicron, totalGSM,
                        standardRate: form.totalCostPerKg,
                        unit: form.unit,
                        status: "Active",
                        createdFrom: "Work Order",
                        sourceWONo: woNo,
                        sourceOrderId: form.orderId,
                        rollMasterId: form.rollMasterId,
                        sourceJobCardNo: "",
                        createdDate: new Date().toISOString().slice(0, 10),
                        remarks: "",
                      };
                      saveCatalogItem(item);
                      alert(`✅ Product Catalog created: ${catalogNo}\nYou can view it in the Extrusion Product Catalog page.`);
                    }}>
                    <BookMarked size={15} />Create Product Catalog
                  </button>
                  <button
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors">
                    <Printer size={15} />Print WO
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
  const stats = {
    pending:   pendingOrders.length,
    processed: workOrders.length,
    inProd:    workOrders.filter(w => w.status === "Pending").length,
    done:      workOrders.filter(w => w.status === "Completed").length,
  };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ClipboardList size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Extrusion Production Work Orders</h2>
          </div>
          <p className="text-sm text-gray-500">
            {stats.pending} orders pending · {stats.processed} work orders · {stats.done} completed
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => openNew()}>New Work Order</Button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending Orders",   val: stats.pending,   cls: "bg-amber-50 text-amber-700 border-amber-200" },
          { label: "Work Orders",      val: stats.processed, cls: "bg-blue-50 text-blue-700 border-blue-200"    },
          { label: "In Production",    val: stats.inProd,    cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
          { label: "Completed",        val: stats.done,      cls: "bg-green-50 text-green-700 border-green-200"  },
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
          { key: "pending",   label: `⏳ Pending Orders (${stats.pending})`   },
          { key: "processed", label: `✅ Work Orders (${stats.processed})`    },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all
              ${activeTab === t.key ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
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
              <p className="font-semibold text-gray-600">All orders processed!</p>
              <p className="text-sm mt-1">No pending orders awaiting work order creation.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-blue-700 text-white text-[10px] uppercase tracking-wide">
                  <tr>
                    {["Order No", "Date", "Customer", "Job Name", "Product / Recipe", "Roll", "Qty", "Delivery", "Est. Linked", "Action"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingOrders.map((o, i) => {
                    const est = costEstimations.find(e => e.id === o.estimationId);
                    return (
                      <tr key={o.id} className={i % 2 === 0 ? "bg-white hover:bg-blue-50/30" : "bg-gray-50/40 hover:bg-blue-50/30"}>
                        <td className="px-3 py-2 font-mono font-semibold text-blue-700">{o.orderNo}</td>
                        <td className="px-3 py-2 text-gray-500">{o.date}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{o.customerName}</td>
                        <td className="px-3 py-2 text-gray-700">{o.jobName}</td>
                        <td className="px-3 py-2">
                          <div>
                            <p className="font-medium text-gray-800 text-[11px]">{o.productName}</p>
                            <p className="text-gray-400 text-[10px]">{o.recipeName}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-[11px]">{o.rollName}</td>
                        <td className="px-3 py-2 font-bold text-teal-700">{o.quantity.toLocaleString()} {o.unit}</td>
                        <td className="px-3 py-2 text-gray-500">{o.deliveryDate}</td>
                        <td className="px-3 py-2">
                          {est
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-[10px] font-bold"><CheckCircle2 size={9} />{est.estimationNo}</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold"><AlertCircle size={9} />Direct</span>
                          }
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => openNew(o)}
                            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                            <ArrowRight size={11} />Create WO
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

      {/* ── Processed Work Orders tab ── */}
      {activeTab === "processed" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          {workOrders.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <ClipboardList size={40} className="mb-3 opacity-30" />
              <p className="font-semibold text-gray-600">No work orders yet</p>
              <p className="text-sm mt-1">Go to Pending Orders tab and click "Create WO" to begin.</p>
            </div>
          ) : (
            <DataTable
              data={workOrders}
              columns={processedCols}
              searchKeys={["workOrderNo", "customerName", "jobName", "recipeName", "orderNo"]}
              actions={row => (
                <div className="flex items-center gap-1.5 justify-end">
                  <button onClick={() => setViewRow(row)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors">
                    <Eye size={11} />View
                  </button>
                  <button onClick={() => openEdit(row)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg transition-colors">
                    <Pencil size={11} />Edit
                  </button>
                  <button onClick={() => makeCatalogFromWO(row)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition-colors">
                    <BookMarked size={11} />Catalog
                  </button>
                  {row.status !== "Completed" && (
                    <button onClick={() => setWOs(ws => ws.map(w => w.id === row.id ? { ...w, status: "Completed" } : w))}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                      <CheckCircle2 size={11} />Done
                    </button>
                  )}
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
          title={`Work Order — ${viewRow.workOrderNo}`} size="xl">
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <KV label="Customer"   val={viewRow.customerName}                              cls="bg-blue-50 border-blue-200 text-blue-800" />
              <KV label="Job"        val={viewRow.jobName}                                   cls="bg-gray-50 border-gray-200 text-gray-800" />
              <KV label="Recipe"     val={viewRow.recipeName}                                cls="bg-indigo-50 border-indigo-200 text-indigo-800" />
              <KV label="Machine"    val={viewRow.machineName}                               cls="bg-teal-50 border-teal-200 text-teal-800" />
              <KV label="Operator"   val={viewRow.operatorName || "—"}                       cls="bg-gray-50 border-gray-200 text-gray-800" />
              <KV label="Qty"        val={`${viewRow.quantity.toLocaleString()} ${viewRow.unit}`} cls="bg-green-50 border-green-200 text-green-800" />
              <KV label="Total GSM"  val={`${viewRow.totalGSM.toFixed(2)} g/m²`}           cls="bg-purple-50 border-purple-200 text-purple-800" />
              <KV label="Total μ"   val={`${viewRow.totalMicron} μ`}                        cls="bg-blue-50 border-blue-200 text-blue-800" />
              <KV label="Planned"    val={viewRow.plannedDate}                               cls="bg-gray-50 border-gray-200 text-gray-800" />
              <KV label="Delivery"   val={viewRow.deliveryDate}                              cls="bg-gray-50 border-gray-200 text-gray-800" />
              <KV label="Cost/Kg"    val={`₹${viewRow.totalCostPerKg}`}                     cls="bg-amber-50 border-amber-200 text-amber-800" />
              <KV label="Order Ref"  val={viewRow.orderNo}                                   cls="bg-gray-50 border-gray-200 text-gray-800" />
            </div>

            {viewRow.layerResults.length > 0 && (
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Layer Breakdown</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-blue-700 text-white">
                      <tr>{["#", "Layer", "μ", "Density", "GSM", "kg/m²", "Rate", "₹/m²"].map(h => (
                        <th key={h} className="px-3 py-1.5 text-center font-semibold">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewRow.layerResults.map((lr, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-1.5 text-center font-bold text-blue-700">{lr.layerNo}</td>
                          <td className="px-3 py-1.5">{lr.layerName}</td>
                          <td className="px-3 py-1.5 text-center font-mono">{lr.micron}</td>
                          <td className="px-3 py-1.5 text-center font-mono">{lr.density}</td>
                          <td className="px-3 py-1.5 text-center font-bold text-blue-700">{lr.gsm}</td>
                          <td className="px-3 py-1.5 text-center font-mono">{lr.consumptionPerSqM}</td>
                          <td className="px-3 py-1.5 text-center font-mono">₹{lr.blendRate}</td>
                          <td className="px-3 py-1.5 text-center font-bold text-green-700">₹{lr.costPerSqM}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {viewRow.requiredMaterials.length > 0 && (
              <div>
                <p className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-2">Required Materials</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-teal-700 text-white">
                      <tr>{["Material", "Qty (Kg)", "Rate (₹/Kg)", "Total Cost"].map(h => (
                        <th key={h} className="px-3 py-1.5 text-center font-semibold">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewRow.requiredMaterials.map((m, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-1.5 font-medium">{m.materialName}</td>
                          <td className="px-3 py-1.5 text-center font-bold text-blue-700">{m.quantityKg.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-center">₹{m.ratePerKg}</td>
                          <td className="px-3 py-1.5 text-center font-bold text-green-700">₹{m.totalCost.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {viewRow.specialInstructions && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Special Instructions</p>
                <p className="text-sm text-gray-700">{viewRow.specialInstructions}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Delete confirmation ── */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Work Order?" size="sm">
          <p className="text-sm text-gray-600 mb-4">This action cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="danger" onClick={() => { setWOs(ws => ws.filter(w => w.id !== deleteId)); setDeleteId(null); }}>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

    </div>
  );
}
