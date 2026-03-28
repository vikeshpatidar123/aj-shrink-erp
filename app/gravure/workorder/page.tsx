"use client";
import { useState, useMemo } from "react";
import {
  Eye, Pencil, Trash2, Printer, CheckCircle2, ClipboardList,
  Clock, RefreshCw, Edit3, Calculator, BookMarked, ChevronRight,
  Layers, AlertCircle, ArrowRight, Plus, X, Check,
  Factory, Send, Package, ShoppingCart, Palette, Wrench, Archive,
} from "lucide-react";
import {
  gravureWorkOrders as initWOs, gravureOrders as initOrders,
  machines, employees, processMasters, items, customers, ledgers,
  GravureWorkOrder, GravureOrder, GravureEstimationProcess,
  SecondaryLayer, PlyConsumableItem, CategoryPlyConsumable, CATEGORY_GROUP_SUBGROUP,
  tools as allTools, toolInventory,
} from "@/data/dummyData";
import { useCategories } from "@/context/CategoriesContext";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { GravureProductCatalog } from "@/data/dummyData";
import { PlanViewer, PlanInput } from "@/components/gravure/PlanViewer";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge }       from "@/components/ui/Badge";
import Button    from "@/components/ui/Button";
import Modal     from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

const INK_COLORS = ["Cyan","Magenta","Yellow","Black","White","Red","Green","Blue","Orange","Gold","Silver","Violet","Brown","Pink"];
const INK_ITEMS     = items.filter(i => i.group === "Ink" && i.active);
const VENDOR_LEDGERS = ledgers.filter(l => (l.ledgerType === "Supplier" || l.ledgerType === "Vendor") && l.status === "Active");
const CYLINDER_TOOLS_ALL = allTools.filter(t => t.toolType === "Cylinder");
const SLEEVE_TOOLS_ALL   = allTools.filter(t => t.toolType === "Sleeve");
const ROTO_PROCESSES = processMasters.filter(p => p.module === "Rotogravure");
const PRINT_MACHINES = machines.filter(m => m.department === "Printing");
const AVAILABLE_TOOL_IDS = new Set(toolInventory.filter(ti => ti.status === "Available").map(ti => ti.toolId));
const SLEEVE_TOOLS   = allTools.filter(t => t.toolType === "Sleeve"   && AVAILABLE_TOOL_IDS.has(t.id)).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
const CYLINDER_TOOLS = allTools.filter(t => t.toolType === "Cylinder" && AVAILABLE_TOOL_IDS.has(t.id)).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
const FILM_ITEMS = items.filter(i => i.group === "Film" && i.active);
const FILM_SUBGROUPS = Array.from(
  new Map(FILM_ITEMS.filter(i => i.subGroup).map(i => [i.subGroup, { subGroup: i.subGroup, density: parseFloat(i.density) || 0, thicknesses: new Set<number>() }])).entries()
).map(([subGroup, data]) => {
  FILM_ITEMS.filter(i => i.subGroup === subGroup).forEach(i => { const t = parseFloat(i.thickness); if (!isNaN(t) && t > 0) data.thicknesses.add(t); });
  return { subGroup, density: data.density, thicknesses: Array.from(data.thicknesses).sort((a, b) => a - b) };
});

// Default consumables shown when category has none defined for that plyType
const DEFAULT_PLY_CONSUMABLES: Record<string, CategoryPlyConsumable[]> = {
  Printing: [
    { id: "DEF_INK",     plyType: "Printing",   itemGroup: "Ink",     itemSubGroup: "Solvent Based Ink",  fieldDisplayName: "Ink",     defaultValue: 3.5, minValue: 1,   maxValue: 8,   sharePercentageFormula: "" },
    { id: "DEF_SOL",     plyType: "Printing",   itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", fieldDisplayName: "Solvent", defaultValue: 2.0, minValue: 0.5, maxValue: 5,   sharePercentageFormula: "" },
  ],
  Lamination: [
    { id: "DEF_ADH",     plyType: "Lamination", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive",      fieldDisplayName: "Adhesive", defaultValue: 3.5, minValue: 2,   maxValue: 6,   sharePercentageFormula: "" },
    { id: "DEF_HRD",     plyType: "Lamination", itemGroup: "Hardner",  itemSubGroup: "PU Hardener",      fieldDisplayName: "Hardener", defaultValue: 0.7, minValue: 0.3, maxValue: 1.5, sharePercentageFormula: "" },
  ],
  Coating: [
    { id: "DEF_CTG",     plyType: "Coating",    itemGroup: "Adhesive", itemSubGroup: "Coating Adhesive", fieldDisplayName: "Coating", defaultValue: 3.0, minValue: 1,   maxValue: 6,   sharePercentageFormula: "" },
  ],
};

const STATUS_COLORS: Record<string, string> = {
  Open:          "bg-gray-50 text-gray-600 border-gray-200",
  "In Progress": "bg-yellow-50 text-yellow-700 border-yellow-200",
  Completed:     "bg-green-50 text-green-700 border-green-200",
  "On Hold":     "bg-red-50 text-red-700 border-red-200",
};

const blankWO: Omit<GravureWorkOrder, "id" | "workOrderNo"> = {
  date: new Date().toISOString().slice(0, 10),
  sourceOrderType: "Direct",
  orderId: "", orderNo: "",
  customerId: "", customerName: "",
  jobName: "", substrate: "", structure: "",
  categoryId: "", categoryName: "", content: "",
  jobWidth: 0, jobHeight: 0,
  actualWidth: 0, actualHeight: 0,
  width: 0, noOfColors: 6,
  printType: "Surface Print",
  machineId: "", machineName: "",
  cylinderCostPerColor: 3500,
  operatorId: "", operatorName: "",
  cylinderSet: "", inks: [],
  quantity: 0, unit: "Meter",
  plannedDate: "",
  processes: [], secondaryLayers: [],
  selectedPlanId: "", ups: 0,
  trimmingSize: 0, frontColors: 4, backColors: 2,
  overheadPct: 12, profitPct: 15,
  perMeterRate: 0, totalAmount: 0,
  specialInstructions: "",
  status: "Open",
};

// ─── Section Header ────────────────────────────────────────────
const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2 pb-2 border-b border-purple-100">{label}</p>
);

export default function GravureWorkOrderPage() {
  const { categories } = useCategories();
  const { catalog, saveCatalogItem } = useProductCatalog();
  const [workOrders, setWOs]     = useState<GravureWorkOrder[]>(initWOs);
  const [orders]                  = useState<GravureOrder[]>(initOrders);
  const [pageTab, setPageTab]    = useState<"pending" | "workorders">("pending");
  const [modalOpen, setModal]    = useState(false);
  const [viewRow,   setViewRow]  = useState<GravureWorkOrder | null>(null);
  const [editing,   setEditing]  = useState<GravureWorkOrder | null>(null);
  const [form,      setForm]     = useState<Omit<GravureWorkOrder, "id" | "workOrderNo">>(blankWO);
  const [replanOpen, setReplan]  = useState(false);
  const [deleteId,  setDeleteId] = useState<string | null>(null);
  const [modalTab,  setModalTab] = useState<"basic" | "planning" | "material">("basic");
  const [pendingWOCategoryId, setPendingWOCategoryId] = useState<string | null>(null);
  const [showPlan,      setShowPlan]      = useState(false);
  const [isPlanApplied, setIsPlanApplied] = useState(false);
  const [planSearch,    setPlanSearch]    = useState("");
  const [planSort,      setPlanSort]      = useState<{ key: string; dir: "asc" | "desc" }>({ key: "", dir: "asc" });

  // ── Production Preparation Types ────────────────────────────
  type FilmRequisition = { source: "Extrusion" | "Purchase" | ""; status: "Pending" | "Requested" | "Available"; requiredDate?: string; spec?: string; priority?: string; vendor?: string; expectedRate?: number; remarks?: string; };
  type ColorShade      = { colorNo: number; colorName: string; inkType: "Spot" | "Process" | "Special"; pantoneRef: string; labL: string; labA: string; labB: string; deltaE: string; shadeCardRef: string; status: "Pending" | "Standard Received" | "Approved" | "Rejected"; remarks: string; };
  type MaterialAlloc   = { id: string; plyNo?: number; materialType: string; materialName: string; requiredQty: number; unit: string; allocatedQty: number; lotNo: string; location: string; status: "Pending" | "Partial" | "Allocated"; };
  type CylinderAlloc   = { colorNo: number; colorName: string; cylinderNo: string; circumference: string; cylinderType: "New" | "Existing" | "Rechromed"; status: "Pending" | "Available" | "In Use" | "Under Chrome" | "Ordered"; remarks: string; };
  const [filmReqs,       setFilmReqs]       = useState<FilmRequisition[]>([]);
  const [colorShades,    setColorShades]    = useState<ColorShade[]>([]);
  const [materialAllocs, setMaterialAllocs] = useState<MaterialAlloc[]>([]);
  const [cylinderAllocs, setCylinderAllocs] = useState<CylinderAlloc[]>([]);
  const [prepTab,        setPrepTab]        = useState<"film" | "shade" | "material" | "tool">("film");

  // ── View Plan ─────────────────────────────────────────────
  const [viewPlanWO, setViewPlanWO]   = useState<GravureWorkOrder | null>(null);

  // ── Production Plan calculation (Sleeve × Cylinder based) ────
  const allPlans = useMemo(() => {
    const machine = PRINT_MACHINES.find(m => m.id === form.machineId);
    if (!machine || !form.actualWidth || form.actualWidth <= 0) return [];

    const machineMaxFilm = parseFloat((machine as any).maxWebWidth) || 1300;
    const baseCirc   = form.jobHeight > 0 ? Math.ceil(form.jobHeight / 12) * 12 : 450;
    const laneWidth  = form.actualWidth + (form.trimmingSize || 0);

    const trim      = form.trimmingSize || 0;
    const repeatUPS = form.jobHeight > 0 ? Math.max(1, Math.floor(baseCirc / form.jobHeight)) : 10;

    // ── LOOP A: Sleeve in stock → cylinder (or SPECIAL CYL) ──
    const loopA = SLEEVE_TOOLS.flatMap(sleeve => {
      const sleeveWidthVal = parseFloat(sleeve.printWidth);
      if (sleeveWidthVal > machineMaxFilm) return [];
      const maxAcUps = Math.floor(sleeveWidthVal / laneWidth);
      if (maxAcUps === 0) return [];
      return Array.from({ length: maxAcUps }, (_, i) => {
        const acUps = i + 1;
        const printingWidth = acUps * laneWidth;
        const filmWidth = printingWidth + 2 * trim;
        if (filmWidth > sleeveWidthVal) return [];
        const req    = filmWidth + 100;
        const minCyl = req < sleeveWidthVal ? req : sleeveWidthVal + 100;
        const validCylinders = CYLINDER_TOOLS.filter(t => parseFloat(t.printWidth) >= minCyl);
        const cylList = validCylinders.length > 0
          ? validCylinders.map(c => ({ id: c.id, code: c.code, name: c.name, printWidth: c.printWidth, isSpecial: false, isSpecialSleeve: false }))
          : [{ id: "SPECIAL-CYL", code: "SPL", name: "Special Order", printWidth: String(Math.ceil(minCyl)), isSpecial: true, isSpecialSleeve: false }];
        const sideWaste  = parseFloat((2 * trim).toFixed(1));
        const deadMargin = parseFloat((sleeveWidthVal - filmWidth).toFixed(1));
        const totalWaste = parseFloat((sideWaste + deadMargin).toFixed(1));
        const totalUPS   = acUps * repeatUPS;
        const reqRMT     = form.quantity > 0 ? Math.ceil(form.quantity / totalUPS) : 1;
        const totalRMT   = Math.ceil(reqRMT * 1.01);
        return cylList.map(cylinder => ({
          planId: `PLAN-${machine.id}-${sleeve.id}-UPS${acUps}-${cylinder.id}`,
          machineName: machine.name,
          filmSize: filmWidth, acUps, printingWidth,
          sleeveCode: sleeve.code, sleeveName: sleeve.name, sleeveWidthVal,
          cylinderCode: cylinder.code, cylinderName: cylinder.name,
          cylinderWidthVal: parseFloat(cylinder.printWidth),
          sideWaste, deadMargin, totalWaste,
          cylCirc: baseCirc, repeatUPS, totalUPS,
          reqRMT, totalRMT, wastage: totalWaste,
          isSpecial: cylinder.isSpecial, isSpecialSleeve: false, isBest: false,
        }));
      }).flat();
    });

    // ── LOOP B: Cylinder in stock → no sleeve available → SPECIAL SLEEVE ──
    const loopB = CYLINDER_TOOLS.flatMap(cylinder => {
      const cylWidthVal = parseFloat(cylinder.printWidth);
      const maxAcUps    = Math.floor(cylWidthVal / laneWidth);
      if (maxAcUps === 0) return [];
      return Array.from({ length: maxAcUps }, (_, i) => {
        const acUps = i + 1;
        const printingWidth = acUps * laneWidth;
        const filmWidth = printingWidth + 2 * trim;
        if (filmWidth > machineMaxFilm) return [];
        const realSleeveExists = SLEEVE_TOOLS.some(s => {
          const sw = parseFloat(s.printWidth);
          if (sw < filmWidth || sw > machineMaxFilm) return false;
          const req = filmWidth + 100;
          const minCyl = req < sw ? req : sw + 100;
          return cylWidthVal >= minCyl;
        });
        if (realSleeveExists) return [];
        if (cylWidthVal < filmWidth + 100) return [];
        const sideWaste  = parseFloat((2 * trim).toFixed(1));
        const deadMargin = 0;
        const totalWaste = sideWaste;
        const totalUPS   = acUps * repeatUPS;
        const reqRMT     = form.quantity > 0 ? Math.ceil(form.quantity / totalUPS) : 1;
        const totalRMT   = Math.ceil(reqRMT * 1.01);
        return [{
          planId: `PLAN-${machine.id}-SPLSLV-UPS${acUps}-${cylinder.id}`,
          machineName: machine.name,
          filmSize: filmWidth, acUps, printingWidth,
          sleeveCode: "SPL-S", sleeveName: "Special Order", sleeveWidthVal: filmWidth,
          cylinderCode: cylinder.code, cylinderName: cylinder.name,
          cylinderWidthVal: cylWidthVal,
          sideWaste, deadMargin, totalWaste,
          cylCirc: baseCirc, repeatUPS, totalUPS,
          reqRMT, totalRMT, wastage: totalWaste,
          isSpecial: true, isSpecialSleeve: true, isBest: false,
        }];
      }).flat();
    });

    const rawPlans = [...loopA, ...loopB];
    if (rawPlans.length === 0) return rawPlans;
    const sorted = [...rawPlans].sort((a, b) =>
      a.totalWaste  !== b.totalWaste  ? a.totalWaste  - b.totalWaste  :
      a.deadMargin  !== b.deadMargin  ? a.deadMargin  - b.deadMargin  :
      a.sideWaste   !== b.sideWaste   ? a.sideWaste   - b.sideWaste   :
      b.acUps       !== a.acUps       ? b.acUps        - a.acUps       : 0
    );
    return sorted.map((p, idx) => ({ ...p, isBest: !p.isSpecial && idx === 0 }));
  }, [form.machineId, form.actualWidth, form.jobHeight, form.trimmingSize, form.quantity]);

  const visiblePlans = useMemo(() => {
    let rows = allPlans;
    const q = planSearch.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.machineName.toLowerCase().includes(q) || String(r.cylCirc).includes(q) || String(r.totalUPS).includes(q) || String(r.filmSize).includes(q));
    if (planSort.key) {
      rows = [...rows].sort((a, b) => {
        const av = (a as any)[planSort.key] ?? 0;
        const bv = (b as any)[planSort.key] ?? 0;
        const diff = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
        return planSort.dir === "asc" ? diff : -diff;
      });
    }
    return rows;
  }, [allPlans, planSearch, planSort]);

  const togglePlanSort = (key: string) =>
    setPlanSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  const selectedPlan = useMemo(() => allPlans.find(p => p.planId === form.selectedPlanId) || null, [allPlans, form.selectedPlanId]);

  // ── Special tool detection ─────────────────────────────────
  const isSelectedPlanSpecial    = !!(selectedPlan && ((selectedPlan as any).isSpecial || (selectedPlan as any).isSpecialSleeve));
  const isSelectedPlanSpecialCyl = !!(selectedPlan && (selectedPlan as any).isSpecial && !(selectedPlan as any).isSpecialSleeve);
  const isSelectedPlanSpecialSlv = !!(selectedPlan && (selectedPlan as any).isSpecialSleeve);

  // Helper: check if a saved WO's selectedPlanId refers to a special plan
  const woHasSpecialPlan = (wo: GravureWorkOrder) =>
    wo.selectedPlanId?.includes("SPECIAL") || wo.selectedPlanId?.includes("SPLSLV") || false;


  // ── Save to Catalog ────────────────────────────────────────
  const [catSaveWO,   setCatSaveWO]   = useState<GravureWorkOrder | null>(null);
  const [catProdName, setCatProdName] = useState("");

  const openSaveToCatalog = (wo: GravureWorkOrder) => {
    setCatSaveWO(wo);
    setCatProdName(wo.jobName);
  };

  const confirmSaveToCatalog = () => {
    if (!catSaveWO) return;
    const n = catalog.length + 1;
    const item: GravureProductCatalog = {
      id: `GPC${String(n).padStart(3, "0")}`,
      catalogNo: `GRV-CAT-${String(n).padStart(3, "0")}`,
      createdDate: new Date().toISOString().slice(0, 10),
      productName: catProdName || catSaveWO.jobName,
      customerId: catSaveWO.customerId,
      customerName: catSaveWO.customerName,
      categoryId: catSaveWO.categoryId,
      categoryName: catSaveWO.categoryName,
      content: catSaveWO.content,
      jobWidth: catSaveWO.jobWidth,
      jobHeight: catSaveWO.jobHeight,
      actualWidth: catSaveWO.actualWidth,
      actualHeight: catSaveWO.actualHeight,
      noOfColors: catSaveWO.noOfColors,
      printType: catSaveWO.printType,
      substrate: catSaveWO.substrate,
      secondaryLayers: catSaveWO.secondaryLayers,
      processes: catSaveWO.processes,
      machineId: catSaveWO.machineId,
      machineName: catSaveWO.machineName,
      cylinderCostPerColor: catSaveWO.cylinderCostPerColor,
      overheadPct: catSaveWO.overheadPct,
      profitPct: catSaveWO.profitPct,
      perMeterRate: catSaveWO.perMeterRate,
      standardQty: catSaveWO.quantity,
      standardUnit: catSaveWO.unit,
      sourceEstimationId: "",
      sourceEstimationNo: "",
      sourceOrderId: catSaveWO.orderId || "",
      sourceOrderNo: catSaveWO.orderNo || "",
      sourceWorkOrderId: catSaveWO.id,
      sourceWorkOrderNo: catSaveWO.workOrderNo,
      trimmingSize: catSaveWO.trimmingSize,
      frontColors:  catSaveWO.frontColors,
      backColors:   catSaveWO.backColors,
      status: "Active",
      remarks: catSaveWO.specialInstructions || "",
    };
    saveCatalogItem(item);
    setCatSaveWO(null);
    alert(`Saved to Product Catalog as ${item.catalogNo}`);
  };

  const f = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => {
      const next = { ...p, [k]: v };
      if (k === "frontColors" || k === "backColors") {
        next.noOfColors = ((k === "frontColors" ? v : p.frontColors) as number || 0) + ((k === "backColors" ? v : p.backColors) as number || 0);
      }
      return next;
    });

  // ── Auto-build plys from category (same as Estimation) ──────
  const applyWOCategory = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    const plyOrder = ["Film", "Printing", "Lamination", "Coating"];
    const usedTypes = new Set((cat?.plyConsumables || []).map(pc => pc.plyType));
    const autoTypes = plyOrder.filter(pt => pt === "Film" || usedTypes.has(pt));
    const autoLayers: SecondaryLayer[] = autoTypes.map((plyType, i) => {
      const consumableItems: PlyConsumableItem[] = (cat?.plyConsumables || [])
        .filter(pc => pc.plyType === plyType)
        .map(pc => ({
          consumableId: pc.id, fieldDisplayName: pc.fieldDisplayName,
          itemGroup: pc.itemGroup, itemSubGroup: pc.itemSubGroup,
          itemId: "", itemName: "", gsm: pc.defaultValue, rate: 0,
        }));
      return { id: Math.random().toString(), layerNo: i + 1, plyType, itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems };
    });
    setForm(p => ({ ...p, categoryId, categoryName: cat?.name || "", content: "", secondaryLayers: autoLayers }));
  };

  // ── Ply helpers ─────────────────────────────────────────────
  const getCategoryConsumables = (categoryId: string, plyType: string): CategoryPlyConsumable[] => {
    if (!plyType || plyType === "Film") return [];
    const cat = categories.find(c => c.id === categoryId);
    const catDefs = cat?.plyConsumables?.filter(pc => pc.plyType === plyType) ?? [];
    // Use category-specific consumables if available, otherwise fall back to defaults
    return catDefs.length > 0 ? catDefs : (DEFAULT_PLY_CONSUMABLES[plyType] ?? []);
  };

  const onPlyTypeChange = (index: number, plyType: string) => {
    const consumables = getCategoryConsumables(form.categoryId || "", plyType);
    const consumableItems: PlyConsumableItem[] = consumables.map((pc: { id: string; fieldDisplayName: string; itemGroup: string; itemSubGroup: string; defaultValue: number }) => ({
      consumableId: pc.id, fieldDisplayName: pc.fieldDisplayName,
      itemGroup: pc.itemGroup, itemSubGroup: pc.itemSubGroup,
      itemId: "", itemName: "", gsm: pc.defaultValue, rate: 0,
    }));
    const layers = [...form.secondaryLayers];
    layers[index] = { ...layers[index], plyType, consumableItems };
    f("secondaryLayers", layers);
  };

  const updatePlyConsumable = (layerIdx: number, ciIdx: number, patch: Partial<PlyConsumableItem>) => {
    const layers = [...form.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    const ci = [...layer.consumableItems];
    ci[ciIdx] = { ...ci[ciIdx], ...patch };
    layer.consumableItems = ci;
    layers[layerIdx] = layer;
    f("secondaryLayers", layers);
  };

  // ── Init Production Preparation data ──────────────────────
  const initPrepData = (f: typeof form, plan: typeof selectedPlan) => {
    const n = f.noOfColors || 0;
    setColorShades(Array.from({ length: n }, (_, i) => ({
      colorNo: i + 1, colorName: `Color ${i + 1}`, inkType: "Spot" as const,
      pantoneRef: "", labL: "", labA: "", labB: "", deltaE: "1.0",
      shadeCardRef: "", status: "Pending" as const, remarks: "",
    })));
    const allocs: MaterialAlloc[] = [];
    const reqSQM = f.quantity * ((f.jobWidth || 0) / 1000);
    f.secondaryLayers.forEach((l, i) => {
      if (l.itemSubGroup) {
        const reqWt = l.gsm > 0 ? parseFloat(((l.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
        allocs.push({ id: `film-${i}`, plyNo: l.layerNo, materialType: "Film", materialName: l.itemSubGroup, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, lotNo: "", location: "", status: "Pending" });
      }
      (l.consumableItems || []).forEach((ci, j) => {
        const reqWt = ci.gsm > 0 ? parseFloat(((ci.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
        allocs.push({ id: `con-${i}-${j}`, plyNo: l.layerNo, materialType: ci.itemGroup, materialName: ci.itemName || ci.fieldDisplayName, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, lotNo: "", location: "", status: "Pending" });
      });
    });
    setMaterialAllocs(allocs);
    setCylinderAllocs(Array.from({ length: n }, (_, i) => ({
      colorNo: i + 1, colorName: `Color ${i + 1}`,
      cylinderNo: f.cylinderSet ? `${f.cylinderSet}-C${String(i + 1).padStart(2, "0")}` : "",
      circumference: plan ? String(plan.cylCirc) : "",
      cylinderType: "Existing" as const, status: "Pending" as const, remarks: "",
    })));
  };

  // ── Orders not yet converted to WO ────────────────────────
  const pendingOrders = useMemo(() =>
    orders.filter(o =>
      o.status !== "Dispatched" &&
      !workOrders.some(w => w.orderId === o.id)
    ),
    [orders, workOrders]
  );

  // ── Toggle ink ─────────────────────────────────────────────
  const toggleInk = (color: string) =>
    setForm(p => ({ ...p, inks: p.inks.includes(color) ? p.inks.filter(c => c !== color) : [...p.inks, color] }));


  const cellInput = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

  // ── Convert pending order to WO ────────────────────────────
  const convertToWO = (order: GravureOrder) => {
    setEditing(null);
    setForm({
      ...blankWO,
      sourceOrderType: order.sourceType || "Estimation",
      orderId:         order.id,
      orderNo:         order.orderNo,
      customerId:      order.customerId,
      customerName:    order.customerName,
      jobName:         order.jobName,
      substrate:       order.substrate,
      structure:       order.structure,
      categoryId:      order.categoryId,
      categoryName:    order.categoryName,
      content:         order.content,
      jobWidth:        order.jobWidth,
      jobHeight:       order.jobHeight,
      actualWidth:     order.jobWidth,
      actualHeight:    order.jobHeight,
      width:           order.jobWidth,
      noOfColors:      order.noOfColors,
      printType:       (order.printType as GravureWorkOrder["printType"]) || "Surface Print",
      quantity:        order.quantity,
      unit:            order.unit,
      cylinderSet:     order.cylinderSet,
      machineId:       order.machineId,
      machineName:     order.machineName,
      cylinderCostPerColor: 3500,
      processes:       order.processes,
      secondaryLayers: order.secondaryLayers,
      selectedPlanId:  "",
      ups:             0,
      overheadPct:     order.overheadPct,
      profitPct:       order.profitPct,
      perMeterRate:    order.perMeterRate,
      totalAmount:     order.totalAmount,
      trimmingSize:    (order as any).trimmingSize || 0,
      frontColors:     (order as any).frontColors || 0,
      backColors:      (order as any).backColors || 0,
    });
    setModalTab("basic");
    setShowPlan(false); setIsPlanApplied(false);
    setFilmReqs([]); setColorShades([]); setMaterialAllocs([]); setCylinderAllocs([]); setPrepTab("film");
    setModal(true);
  };


  // ── Process row handlers ──────────────────────────────────
  const addProcess = () =>
    setForm(p => ({ ...p, processes: [...p.processes, { processId: "", processName: "", chargeUnit: "", rate: 0, qty: 0, setupCharge: 0, amount: 0 }] }));

  const removeProcess = (i: number) =>
    setForm(p => ({ ...p, processes: p.processes.filter((_, idx) => idx !== i) }));

  const updateProcess = (i: number, patch: Partial<GravureEstimationProcess>) =>
    setForm(p => ({
      ...p,
      processes: p.processes.map((pr, idx) => {
        if (idx !== i) return pr;
        const updated = { ...pr, ...patch };
        updated.amount = parseFloat((updated.rate * updated.qty + updated.setupCharge).toFixed(2));
        return updated;
      }),
    }));

  const selectProcess = (i: number, processId: string) => {
    const pm = ROTO_PROCESSES.find(x => x.id === processId);
    if (!pm) return;
    updateProcess(i, { processId: pm.id, processName: pm.name, chargeUnit: pm.chargeUnit, rate: parseFloat(pm.rate) || 0, setupCharge: pm.makeSetupCharges ? parseFloat(pm.setupChargeAmount) || 0 : 0 });
  };

  // ── Replan ─────────────────────────────────────────────────
  const openReplan = (wo: GravureWorkOrder) => {
    setEditing(wo);
    setForm({ ...wo });
    setModalTab("planning");
    setShowPlan(false); setIsPlanApplied(false);
    setReplan(true);
  };

  // ── Edit ───────────────────────────────────────────────────
  const openEdit = (wo: GravureWorkOrder) => {
    setEditing(wo);
    setForm({ ...wo });
    setModalTab("basic");
    setShowPlan(false); setIsPlanApplied(false);
    setFilmReqs([]); setColorShades([]); setMaterialAllocs([]); setCylinderAllocs([]); setPrepTab("film");
    setModal(true);
  };

  // ── Save ───────────────────────────────────────────────────
  const save = () => {
    if (!form.customerId || !form.machineId) {
      alert("Customer and Machine are required."); return;
    }

    // Block save entirely if a special plan is applied — tool must be created in master first
    if (isSelectedPlanSpecial) {
      const toolType = isSelectedPlanSpecialCyl ? "Cylinder" : "Sleeve";
      const toolSize = isSelectedPlanSpecialCyl
        ? (selectedPlan as any)?.cylinderWidthVal
        : (selectedPlan as any)?.sleeveWidthVal;
      alert(
        `⚠ Cannot Save — Special ${toolType} Required!\n\n` +
        `This plan needs a ${toolType} (${toolSize}mm) that does NOT exist in inventory yet.\n\n` +
        `Steps:\n` +
        `1. Go to Masters → Tools\n` +
        `2. Add the new ${toolType} (${toolSize}mm)\n` +
        `3. Come back and click Replan\n` +
        `4. Select the newly added tool's plan\n` +
        `5. Save the Work Order`
      );
      return;
    }

    // When replanning a previously special-plan WO with a real plan → activate it
    const wasSpecialNowReal = editing && woHasSpecialPlan(editing) && !isSelectedPlanSpecial && isPlanApplied;

    const saveForm = wasSpecialNowReal
      ? { ...form, status: "Open" as const }
      : form;

    if (editing) {
      setWOs(d => d.map(r => r.id === editing.id ? { ...saveForm, id: editing.id, workOrderNo: editing.workOrderNo } : r));
    } else {
      const workOrderNo = generateCode(UNIT_CODE.Gravure, MODULE_CODE.WorkOrder, workOrders.map(d => d.workOrderNo));
      const id = `GVWO${String(workOrders.length + 1).padStart(3, "0")}`;
      setWOs(d => [...d, { ...saveForm, id, workOrderNo }]);
    }
    setModal(false);
    setReplan(false);
  };

  const stats = {
    pending:    pendingOrders.length,
    open:       workOrders.filter(w => w.status === "Open").length,
    inProgress: workOrders.filter(w => w.status === "In Progress").length,
    completed:  workOrders.filter(w => w.status === "Completed").length,
  };

  // ── Columns ────────────────────────────────────────────────
  const woColumns: Column<GravureWorkOrder>[] = [
    { key: "workOrderNo",  header: "Work Order No", sortable: true },
    { key: "orderId", header: "Type",
      render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${r.sourceOrderType !== "Direct" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>{r.sourceOrderType !== "Direct" ? "From Order" : "Direct"}</span>
    },
    { key: "date",         header: "Date",     sortable: true },
    { key: "customerName", header: "Customer", sortable: true },
    { key: "jobName",      header: "Job Name" },
    { key: "substrate",    header: "Substrate", render: r => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">{r.substrate || "—"}</span> },
    { key: "noOfColors",   header: "Colors",   render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "machineName",  header: "Machine" },
    { key: "plannedDate",  header: "Planned Date" },
    { key: "selectedPlanId", header: "Tool Status",
      render: r => woHasSpecialPlan(r)
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">⚠ Tool Pending</span>
        : r.selectedPlanId
          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">✓ Ready</span>
          : <span className="text-gray-300 text-xs">—</span>
    },
    { key: "status",       header: "Status",   render: r => statusBadge(r.status), sortable: true },
  ];

  // ── Form Modal inner content ───────────────────────────────
  const formContent = (
    <div className="space-y-4">
      {/* Modal tabs */}
      <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
        {(["basic", "planning", "material"] as const).map(t => (
          <button key={t} onClick={() => setModalTab(t)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${modalTab === t ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "basic" ? "1. Basic Info" : t === "planning" ? "2. Planning" : "3. Film Req."}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Basic Info ── */}
      {modalTab === "basic" && (
        <div className="space-y-4">
          {/* Source badge */}
          {form.sourceOrderType !== "Direct" && form.orderNo && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Calculator size={14} className="text-blue-600" />
              <span className="text-xs text-blue-700">From Order: <strong>{form.orderNo}</strong> — All fields pre-filled. Modify only if needed.</span>
            </div>
          )}
          {form.sourceOrderType === "Direct" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Edit3 size={14} className="text-amber-600" />
              <span className="text-xs text-amber-700">Direct work order — fill all details and plan the job in the Planning tab.</span>
            </div>
          )}

          <div>
            <SH label="Job Details" />

            {/* Source-specific top banner for non-Direct */}
            {form.sourceOrderType !== "Direct" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
                <div className={`rounded-xl border px-3 py-2 text-xs ${form.sourceOrderType === "Estimation" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-purple-50 border-purple-200 text-purple-700"}`}>
                  <p className="font-bold uppercase text-[10px] tracking-widest mb-0.5">Source</p>
                  <p className="font-semibold">{form.sourceOrderType === "Estimation" ? "📋 Estimation" : "📦 Catalog"}</p>
                </div>
                <div className="bg-gray-50 border rounded-xl px-3 py-2 text-xs">
                  <p className="font-bold uppercase text-[10px] tracking-widest text-gray-400 mb-0.5">Order No</p>
                  <p className="font-semibold text-gray-800">{form.orderNo || "—"}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs">
                  <p className="font-bold uppercase text-[10px] tracking-widest text-gray-400 mb-0.5">Plys Loaded</p>
                  <p className="font-semibold text-green-700">{form.secondaryLayers.length} ply{form.secondaryLayers.length !== 1 ? "s" : ""} · {form.processes.length} processes</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />

              {/* Customer — dropdown for Direct, read-only for order-linked */}
              {form.sourceOrderType === "Direct" ? (
                <Select label="Customer *" value={form.customerId}
                  onChange={e => {
                    const c = customers.find(x => x.id === e.target.value);
                    if (c) { f("customerId", c.id); f("customerName", c.name); }
                  }}
                  options={[{ value: "", label: "-- Select Customer --" }, ...customers.map(c => ({ value: c.id, label: c.name }))]}
                />
              ) : (
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Customer</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium">{form.customerName}</div>
                </div>
              )}

              <Input label="Job Name *" value={form.jobName} onChange={e => f("jobName", e.target.value)} />
              <Input label="Substrate" value={form.substrate} onChange={e => f("substrate", e.target.value)} placeholder="e.g. BOPP 20μ" />
              <Input label="Structure" value={form.structure} onChange={e => f("structure", e.target.value)} placeholder="e.g. BOPP + CPP" />

              {/* Category — dropdown from Category Master for Direct; locked display for order-linked */}
              {form.sourceOrderType === "Direct" ? (
                <Select label="Category *" value={form.categoryId}
                  onChange={e => {
                    if (!e.target.value) { setForm(p => ({ ...p, categoryId: "", categoryName: "", secondaryLayers: [] })); return; }
                    const hasPlys = form.secondaryLayers.some(l => l.plyType || l.consumableItems.length > 0);
                    if (hasPlys) { setPendingWOCategoryId(e.target.value); }
                    else { applyWOCategory(e.target.value); }
                  }}
                  options={[{ value: "", label: "-- Select Category --" }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
                />
              ) : (
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Category</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium">{form.categoryName || "—"}</div>
                </div>
              )}

              {/* No. of Plys — only for Direct, updates secondaryLayers count */}
              {form.sourceOrderType === "Direct" && form.categoryId && (
                <Input label="No. of Plys" type="number" min={1} max={6}
                  value={form.secondaryLayers.length || ""}
                  onChange={e => {
                    const n = Math.max(0, parseInt(e.target.value) || 0);
                    let layers = [...form.secondaryLayers];
                    if (n > layers.length) {
                      while (layers.length < n) {
                        layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] } as SecondaryLayer);
                      }
                    } else {
                      layers = layers.slice(0, n);
                    }
                    f("secondaryLayers", layers);
                  }}
                />
              )}

              <Input label="Job Width (mm)" type="number" value={form.jobWidth || ""} onChange={e => { const v = Number(e.target.value); setForm(p => ({ ...p, jobWidth: v, width: v, actualWidth: v })); }} />
              <Input label="Job Height (mm)" type="number" value={form.jobHeight || ""} onChange={e => { const v = Number(e.target.value); setForm(p => ({ ...p, jobHeight: v, actualHeight: v })); }} />
              <Input label="Trimming Size (mm)" type="number" value={form.trimmingSize || ""} onChange={e => f("trimmingSize", Number(e.target.value))} placeholder="e.g. 118" />
              <Input label="Front Colors" type="number" value={form.frontColors || ""} onChange={e => f("frontColors", Number(e.target.value))} min={0} max={12} />
              <Input label="Back Colors" type="number" value={form.backColors || ""} onChange={e => f("backColors", Number(e.target.value))} min={0} max={12} />
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Total Colors (Auto)</label>
                <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl text-sm font-bold text-purple-700">{form.noOfColors} Colors</div>
              </div>
              <Select label="Print Type" value={form.printType} onChange={e => f("printType", e.target.value as typeof form.printType)}
                options={[{ value: "Surface Print", label: "Surface Print" }, { value: "Reverse Print", label: "Reverse Print" }, { value: "Combination", label: "Combination" }]} />
              <Input label="Quantity" type="number" value={form.quantity || ""} onChange={e => f("quantity", Number(e.target.value))} />
              <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)}
                options={[{ value: "Pcs", label: "Pcs" }, { value: "Kg", label: "Kg" }]} />
              <Input label="Cylinder Set" value={form.cylinderSet} onChange={e => f("cylinderSet", e.target.value)} placeholder="e.g. CYL-P001" />
              <Input label="Planned Date" type="date" value={form.plannedDate} onChange={e => f("plannedDate", e.target.value)} />
              <Select label="Status" value={form.status} onChange={e => f("status", e.target.value as typeof form.status)}
                options={[{ value: "Open", label: "Open" }, { value: "In Progress", label: "In Progress" }, { value: "Completed", label: "Completed" }, { value: "On Hold", label: "On Hold" }]} />
            </div>
          </div>

          {form.totalAmount > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-50 border rounded-xl p-3"><p className="text-xs text-gray-400">Total Amount</p><p className="font-bold">₹{form.totalAmount.toLocaleString()}</p></div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3"><p className="text-xs text-gray-400">Rate / {form.unit || "Unit"}</p><p className="font-bold text-blue-700">₹{form.perMeterRate.toFixed(2)}</p></div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3"><p className="text-xs text-gray-400">Processes</p><p className="font-bold text-purple-700">{form.processes.length} steps</p></div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setModalTab("planning")}>Next: Planning <ChevronRight size={14} className="ml-1" /></Button>
          </div>
        </div>
      )}

      {/* ── Tab 2: Planning ── */}
      {modalTab === "planning" && (
        <div className="space-y-4">
          {form.sourceOrderType !== "Direct" && form.processes.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
              <AlertCircle size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">Planning loaded from order. Adjust processes or machine if needed. Use Replan to change plan after creation.</p>
            </div>
          )}

          {/* Machine */}
          <div>
            <SH label="Machine" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Select label="Printing Machine *" value={form.machineId}
                onChange={e => { const m = PRINT_MACHINES.find(x => x.id === e.target.value); if (m) { f("machineId", m.id); f("machineName", m.name); } }}
                options={[{ value: "", label: "-- Select Machine --" }, ...PRINT_MACHINES.map(m => ({ value: m.id, label: `${m.name} (${m.status})` }))]}
              />
              {form.totalAmount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Total Amount</p>
                  <p className="font-bold text-green-800">₹{form.totalAmount.toLocaleString()}</p>
                </div>
              )}
              {form.perMeterRate > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Rate / {form.unit || "Unit"}</p>
                  <p className="font-bold text-blue-800">₹{form.perMeterRate.toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Process List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <SH label="Process List" />
              <button onClick={addProcess} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition">
                <Plus size={12} /> Add Process
              </button>
            </div>
            {form.processes.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Process", "Charge Unit", "Rate (₹)", "Qty", "Setup (₹)", "Amount (₹)", ""].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.processes.map((pr, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 min-w-[200px]">
                          <select value={pr.processId} onChange={e => selectProcess(i, e.target.value)} className={cellInput}>
                            <option value="">-- Select Process --</option>
                            {ROTO_PROCESSES.map(pm => <option key={pm.id} value={pm.id}>{pm.name} ({pm.department})</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2"><span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-600 font-mono text-[10px]">{pr.chargeUnit || "—"}</span></td>
                        <td className="px-3 py-2 w-24"><input type="number" value={pr.rate} onChange={e => updateProcess(i, { rate: Number(e.target.value) })} className={`${cellInput} text-right`} step={0.01} /></td>
                        <td className="px-3 py-2 w-24"><input type="number" value={pr.qty} onChange={e => updateProcess(i, { qty: Number(e.target.value) })} className={`${cellInput} text-right`} /></td>
                        <td className="px-3 py-2 w-28"><input type="number" value={pr.setupCharge} onChange={e => updateProcess(i, { setupCharge: Number(e.target.value) })} className={`${cellInput} text-right`} /></td>
                        <td className="px-3 py-2 w-32 text-right font-semibold text-gray-800">₹{pr.amount.toLocaleString()}</td>
                        <td className="px-3 py-2 w-8 text-center"><button onClick={() => removeProcess(i)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><X size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-purple-50 border-t border-purple-200">
                    <tr>
                      <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-purple-700 uppercase">Total Process Cost</td>
                      <td className="px-3 py-2.5 text-sm font-bold text-purple-800 text-right">₹{form.processes.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-5 text-center text-xs text-gray-400">
                No processes added. Click &quot;+ Add Process&quot; to add.
              </div>
            )}
          </div>

          {/* Ply Information */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <SH label={`Ply Configuration (${form.secondaryLayers.length} plys)`} />
              <button onClick={() => {
                const layers = [...form.secondaryLayers];
                layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                f("secondaryLayers", layers);
              }} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200">
                <Plus size={12} /> Add Ply
              </button>
            </div>
            {form.secondaryLayers.length > 0 && (
              <div className="space-y-3">
                {form.secondaryLayers.map((l, index) => {
                  const thicknesses = FILM_SUBGROUPS.find(s => s.subGroup === l.itemSubGroup)?.thicknesses || [];
                  const consumableDefs = getCategoryConsumables(form.categoryId || "", l.plyType);
                  return (
                    <div key={l.id} className="bg-white border-2 border-purple-50 rounded-2xl shadow-sm relative overflow-hidden">
                      <div className="flex items-center justify-between bg-purple-50 px-4 py-2 border-b border-purple-100">
                        <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                          {l.layerNo === 1 ? "1st" : l.layerNo === 2 ? "2nd" : l.layerNo === 3 ? "3rd" : `${l.layerNo}th`} Ply
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => f("secondaryLayers", form.secondaryLayers.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                        </div>
                      </div>
                      <div className="p-3 space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Ply Type *</label>
                          <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400"
                            value={l.plyType} onChange={e => onPlyTypeChange(index, e.target.value)}>
                            <option value="">-- Select Ply Type --</option>
                            <option value="Film">Ply 1</option>
                            <option value="Printing">Ply 2</option>
                            <option value="Lamination">Ply 3</option>
                            <option value="Coating">Ply 4</option>
                          </select>
                        </div>
                        {l.plyType && (
                          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Type</label>
                              <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                value={l.itemSubGroup}
                                onChange={e => {
                                  const subGroup = e.target.value;
                                  const sg = FILM_SUBGROUPS.find(s => s.subGroup === subGroup);
                                  const density = sg ? sg.density : 0;
                                  const layers = [...form.secondaryLayers];
                                  const masterRate = parseFloat(FILM_ITEMS.find(fi => fi.subGroup === subGroup)?.estimationRate || "0");
                                  layers[index] = { ...l, itemSubGroup: subGroup, density, thickness: 0, gsm: 0, filmRate: masterRate };
                                  f("secondaryLayers", layers);
                                }}>
                                <option value="">Select Film Type</option>
                                {FILM_SUBGROUPS.map(opt => <option key={opt.subGroup} value={opt.subGroup}>{opt.subGroup}</option>)}
                              </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                              <Input label="Density" type="number" value={l.density || ""} readOnly className="bg-gray-50 text-gray-400 text-xs" />
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Thickness (μ)</label>
                                <select className="w-full text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                  value={l.thickness}
                                  onChange={e => {
                                    const thickness = Number(e.target.value);
                                    const layers = [...form.secondaryLayers];
                                    layers[index] = { ...l, thickness, gsm: parseFloat((thickness * l.density).toFixed(3)) };
                                    f("secondaryLayers", layers);
                                  }}>
                                  <option value={0}>Select</option>
                                  {thicknesses.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                              <Input label="Film GSM" type="number" value={l.gsm || ""} readOnly className="font-bold bg-purple-50 text-purple-800 border-purple-200 text-xs" />
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Rate (₹/Kg)</label>
                                <input
                                  type="number" step={0.01} min={0}
                                  className="w-full text-xs border border-orange-200 bg-orange-50 rounded-xl px-2 py-2 font-mono outline-none focus:ring-2 focus:ring-orange-400"
                                  value={l.filmRate !== undefined ? l.filmRate : (parseFloat(FILM_ITEMS.find(fi => fi.subGroup === l.itemSubGroup)?.estimationRate || "0") || "")}
                                  onChange={e => {
                                    const layers = [...form.secondaryLayers];
                                    layers[index] = { ...l, filmRate: Number(e.target.value) };
                                    f("secondaryLayers", layers);
                                  }}
                                  placeholder="₹/Kg"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        {consumableDefs.length > 0 && (
                          <div className="space-y-3">
                            {consumableDefs.map((pc: { id: string; fieldDisplayName: string; itemGroup: string; itemSubGroup: string; defaultValue: number; minValue?: number; maxValue?: number }, ciIdx: number) => {
                              const ci = l.consumableItems[ciIdx] ?? { consumableId: pc.id, fieldDisplayName: pc.fieldDisplayName, itemGroup: pc.itemGroup, itemSubGroup: pc.itemSubGroup, itemId: "", itemName: "", gsm: pc.defaultValue, rate: 0 };
                              const subGroups: string[] = (CATEGORY_GROUP_SUBGROUP as Record<string, Record<string, string[]>>)["Raw Material (RM)"]?.[pc.itemGroup] ?? [];
                              const filteredItems = items.filter(i => i.group === pc.itemGroup && i.active && (!ci.itemSubGroup || i.subGroup === ci.itemSubGroup));
                              return (
                                <div key={pc.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{pc.fieldDisplayName}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded font-semibold border border-teal-200">{pc.itemGroup}</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item Sub Group</label>
                                      <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                        value={ci.itemSubGroup} onChange={e => updatePlyConsumable(index, ciIdx, { itemSubGroup: e.target.value, itemId: "", itemName: "" })}>
                                        <option value="">-- Sub Group --</option>
                                        {subGroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item</label>
                                      <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                        value={ci.itemId}
                                        onChange={e => {
                                          const it = filteredItems.find(x => x.id === e.target.value);
                                          updatePlyConsumable(index, ciIdx, { itemId: it?.id ?? "", itemName: it?.name ?? "", rate: parseFloat(it?.estimationRate ?? "0") || 0 });
                                        }}>
                                        <option value="">-- Select Item --</option>
                                        {filteredItems.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">GSM / Wet Wt.</label>
                                      <input type="number" className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                        value={ci.gsm} step={0.1} onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Rate (₹/Kg)</label>
                                      <input type="number" step={0.01} min={0}
                                        className="w-full text-xs border border-orange-200 bg-orange-50 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                                        value={ci.rate || ""}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { rate: Number(e.target.value) })} placeholder="₹/Kg" />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Production Plan Selection */}
          {form.machineId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <SH label="Production Plan Selection" />
                <div className="flex items-center gap-2">
                  {isPlanApplied && (
                    <button onClick={() => { setIsPlanApplied(false); setShowPlan(true); }} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg border border-gray-200">
                      <RefreshCw size={11} /> Change Plan
                    </button>
                  )}
                  <button onClick={() => setShowPlan(!showPlan)}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200">
                    <Eye size={12} /> {showPlan ? "Hide Plan" : "Select Plan"}
                  </button>
                </div>
              </div>

              {isPlanApplied && selectedPlan && !showPlan && (
                isSelectedPlanSpecial ? (
                  <div className="bg-rose-50 border-2 border-rose-300 rounded-xl px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={15} className="text-rose-600 flex-shrink-0" />
                      <p className="text-xs font-bold text-rose-800 uppercase tracking-wide">
                        {isSelectedPlanSpecialCyl ? "Special Cylinder Required" : "Special Sleeve Required"}
                      </p>
                    </div>
                    <p className="text-xs text-rose-700 pl-5">
                      This plan uses a <strong>{isSelectedPlanSpecialCyl ? `cylinder (${(selectedPlan as any).cylinderWidthVal}mm)` : `sleeve (${(selectedPlan as any).sleeveWidthVal}mm)`}</strong> that is NOT in inventory.
                      The tool must be <strong>ordered / fabricated first</strong>. Work Order will be saved as <strong>On Hold</strong>.
                    </p>
                    <p className="text-xs text-rose-600 pl-5 font-semibold">
                      → Once the tool is received in inventory, open this WO and click <strong>Replan</strong> to select the real tool and activate production.
                    </p>
                    <div className="pl-5 pt-1 text-[10px] text-rose-500">
                      Plan: UPS {selectedPlan.totalUPS} · Sleeve {(selectedPlan as any).sleeveCode} · Cylinder {(selectedPlan as any).cylinderCode} · Film {selectedPlan.filmSize}mm · RMT {selectedPlan.totalRMT}
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-green-700">
                    <CheckCircle2 size={14} className="text-green-600" />
                    Plan applied — UPS: <strong>{selectedPlan.totalUPS}</strong> · Sleeve: {(selectedPlan as any).sleeveCode} {(selectedPlan as any).sleeveWidthVal}mm · Cylinder: {(selectedPlan as any).cylinderCode} · Film: {selectedPlan.filmSize}mm · Total Waste: {selectedPlan.totalWaste}mm · RMT: {selectedPlan.totalRMT}
                  </div>
                )
              )}

              {showPlan && !isPlanApplied && (
                <div className="border-2 border-indigo-100 rounded-2xl overflow-hidden shadow-lg">
                  <div className="bg-gradient-to-r from-indigo-800 to-purple-800 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-white font-bold text-xs uppercase tracking-wide">Select Production Plan</p>
                      <p className="text-indigo-200 text-[10px] mt-0.5">{form.machineName} · {visiblePlans.length}/{allPlans.length} plans</p>
                    </div>
                    <input value={planSearch} onChange={e => setPlanSearch(e.target.value)} placeholder="Search plans..."
                      className="bg-indigo-700 text-white placeholder-indigo-300 text-xs rounded-lg px-3 py-1.5 border border-indigo-500 outline-none focus:ring-2 focus:ring-indigo-400 w-36" />
                    {form.selectedPlanId && (() => {
                      const selP = allPlans.find(p => p.planId === form.selectedPlanId) as any;
                      const isSpecial = selP?.isSpecial || selP?.isSpecialSleeve;
                      return (
                        <button onClick={() => { setIsPlanApplied(true); setShowPlan(false); }}
                          className={`text-white text-xs font-bold px-4 py-1.5 rounded-lg flex-shrink-0 ${isSpecial ? "bg-rose-500 hover:bg-rose-600" : "bg-green-500 hover:bg-green-600"}`}>
                          {isSpecial ? "⚠ Apply (Tool Pending)" : "Apply Plan"}
                        </button>
                      );
                    })()}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-[10px] whitespace-nowrap border-collapse">
                      <thead className="bg-slate-800 text-slate-300">
                        <tr>
                          <th className="p-2 border border-slate-700 text-center">Select</th>
                          {[
                            { key: "machineName",     label: "Machine" },
                            { key: "acUps",           label: "AC UPS" },
                            { key: "printingWidth",   label: "Printing W (mm)" },
                            { key: "sleeveCode",      label: "Sleeve" },
                            { key: "sleeveWidthVal",  label: "Sleeve W (mm)" },
                            { key: "sideWaste",       label: "Side Waste (mm)" },
                            { key: "filmSize",        label: "Film Size (mm)" },
                            { key: "deadMargin",      label: "Dead Margin (mm)" },
                            { key: "totalWaste",      label: "Total Waste (mm)" },
                            { key: "cylinderCode",    label: "Cylinder" },
                            { key: "cylinderWidthVal",label: "Cyl W (mm)" },
                            { key: "totalUPS",        label: "Total UPS" },
                            { key: "totalRMT",        label: "Total RMT" },
                          ].map(col => (
                            <th key={col.key} className="p-2 border border-slate-700 text-center cursor-pointer select-none hover:bg-slate-700"
                              onClick={() => togglePlanSort(col.key)}>
                              {col.label}{planSort.key === col.key ? (planSort.dir === "asc" ? " ▲" : " ▼") : " ⇅"}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {visiblePlans.map(plan => {
                          const isSelected = form.selectedPlanId === plan.planId;
                          const p = plan as any;
                          return (
                            <tr key={plan.planId} onClick={() => { f("selectedPlanId", plan.planId); f("ups", plan.totalUPS); }}
                              className={`cursor-pointer transition-colors ${p.isSpecialSleeve ? "bg-rose-50 hover:bg-rose-100" : p.isSpecial ? "bg-amber-50 hover:bg-amber-100" : p.isBest ? "ring-2 ring-inset ring-green-400 bg-green-50" : isSelected ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                              <td className="p-2 border border-gray-100 text-center">
                                <div className={`w-4 h-4 rounded-full border-2 mx-auto flex items-center justify-center ${isSelected ? "border-indigo-600 bg-indigo-600" : "border-gray-300 bg-white"}`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </td>
                              <td className="p-2 border border-gray-100 font-medium text-gray-700">{plan.machineName}{p.isBest && <span className="ml-1.5 px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full">BEST</span>}{p.isSpecial && !p.isSpecialSleeve && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">SPECIAL CYL</span>}{p.isSpecialSleeve && <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full">SPECIAL SLV</span>}</td>
                              <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700">{plan.acUps}</td>
                              <td className="p-2 border border-gray-100 text-center font-mono">{p.printingWidth}</td>
                              <td className="p-2 border border-gray-100"><span className={`font-semibold ${p.isSpecialSleeve ? "text-rose-600" : "text-blue-600"}`}>{p.sleeveCode}</span><br/><span className={`text-[9px] ${p.isSpecialSleeve ? "text-rose-500" : "text-gray-400"}`}>{p.sleeveName}</span></td>
                              <td className={`p-2 border border-gray-100 text-center font-bold ${p.isSpecialSleeve ? "text-rose-600" : "text-blue-700"}`}>{p.sleeveWidthVal}</td>
                              <td className={`p-2 border border-gray-100 text-center font-bold ${p.sideWaste > 100 ? "text-red-600" : "text-amber-600"}`}>{p.sideWaste}</td>
                              <td className="p-2 border border-gray-100 text-center text-indigo-700">{plan.filmSize}</td>
                              <td className={`p-2 border border-gray-100 text-center font-bold ${p.deadMargin < 0 ? "text-red-600" : "text-orange-600"}`}>{p.deadMargin}</td>
                              <td className={`p-2 border border-gray-100 text-center font-bold ${p.isBest ? "text-green-700" : p.totalWaste > 300 ? "text-red-600" : "text-amber-600"}`}>{p.totalWaste}</td>
                              <td className="p-2 border border-gray-100"><span className={`font-semibold ${p.isSpecial ? "text-amber-600" : "text-violet-600"}`}>{p.cylinderCode}</span><br/><span className={`text-[9px] ${p.isSpecial ? "text-amber-500" : "text-gray-400"}`}>{p.cylinderName}</span></td>
                              <td className={`p-2 border border-gray-100 text-center font-bold ${p.isSpecial ? "text-amber-600" : "text-violet-700"}`}>{p.cylinderWidthVal}</td>
                              <td className="p-2 border border-gray-100 text-center font-bold">{plan.totalUPS}</td>
                              <td className="p-2 border border-gray-100 text-center text-blue-600 font-semibold">{plan.totalRMT}</td>
                            </tr>
                          );
                        })}
                        {visiblePlans.length === 0 && (
                          <tr><td colSpan={9} className="p-4 text-center text-gray-400 text-xs">No plans match your search</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {form.selectedPlanId && (() => {
                    const selP = allPlans.find(p => p.planId === form.selectedPlanId) as any;
                    const isSpecial = selP?.isSpecial || selP?.isSpecialSleeve;
                    return (
                      <div className={`px-4 py-2.5 flex items-center justify-between text-[11px] ${isSpecial ? "bg-rose-900 text-rose-100" : "bg-indigo-900 text-indigo-100"}`}>
                        <span className="flex items-center gap-2">
                          {isSpecial
                            ? <><AlertCircle size={12} className="text-rose-300" /> Special tool — WO will be On Hold until tool is in inventory</>
                            : <><Check size={12} className="text-green-400" /> Plan selected — UPS: {selectedPlan?.totalUPS}</>
                          }
                        </span>
                        <button onClick={() => { setIsPlanApplied(true); setShowPlan(false); }}
                          className={`text-white text-xs font-bold px-3 py-1 rounded-lg ${isSpecial ? "bg-rose-500 hover:bg-rose-600" : "bg-green-500 hover:bg-green-600"}`}>
                          {isSpecial ? "Apply & Hold" : "Apply"}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {isPlanApplied && selectedPlan && form.secondaryLayers.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-indigo-900">Ply / Layer Calculation — UPS: {selectedPlan.totalUPS} · Film: {selectedPlan.filmSize}mm · Wastage: {selectedPlan.wastage}mm · RMT: {selectedPlan.totalRMT}</p>
                  <div className="border-2 border-indigo-50 rounded-2xl overflow-hidden shadow-lg">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[10px] border-collapse">
                        <thead className="bg-indigo-700 text-white uppercase tracking-wider font-bold">
                          <tr>
                            {["Layer","Type","Film / Material","Thick (μ)","Density","GSM","Width (mm)","Req.Mtr","Req.SQM","Req.Wt (Kg)","Waste Mtr","Waste Wt","Total Mtr","Total Wt (Kg)"].map(h => (
                              <th key={h} className="p-2 border border-indigo-600/30 text-center whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {form.secondaryLayers.map((l, idx) => {
                            const WASTE_PCT = 0.03;
                            const rmt = selectedPlan.totalRMT;
                            const widthM = form.jobWidth / 1000;
                            const reqSQM = parseFloat((rmt * widthM).toFixed(3));
                            const reqWt  = l.gsm > 0 ? parseFloat((l.gsm * reqSQM / 1000).toFixed(4)) : 0;
                            const wasteMtr = parseFloat((rmt * WASTE_PCT).toFixed(2));
                            const wasteWt  = parseFloat((reqWt * WASTE_PCT).toFixed(4));
                            const totalMtr = parseFloat((rmt + wasteMtr).toFixed(2));
                            const totalWt  = parseFloat((reqWt + wasteWt).toFixed(4));
                            return (
                              <tr key={l.id} className="hover:bg-indigo-50/30">
                                <td className="p-2 border border-gray-100 text-center font-black text-indigo-900 bg-indigo-50/20">{idx + 1}</td>
                                <td className="p-2 border border-gray-100 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${l.plyType === "Printing" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : l.plyType === "Lamination" ? "bg-teal-50 text-teal-700 border-teal-200" : l.plyType === "Coating" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{l.plyType || "Film"}</span>
                                </td>
                                <td className="p-2 border border-gray-100 font-medium text-gray-700 min-w-[140px] whitespace-normal">{l.itemSubGroup || "—"}</td>
                                <td className="p-2 border border-gray-100 text-center font-mono">{l.thickness || "—"}</td>
                                <td className="p-2 border border-gray-100 text-center font-mono">{l.density || "—"}</td>
                                <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700">{l.gsm || "—"}</td>
                                <td className="p-2 border border-gray-100 text-center font-mono">{form.jobWidth}</td>
                                <td className="p-2 border border-gray-100 text-center font-mono">{rmt}</td>
                                <td className="p-2 border border-gray-100 text-center font-mono">{reqSQM}</td>
                                <td className="p-2 border border-gray-100 text-center font-bold text-blue-600">{reqWt}</td>
                                <td className="p-2 border border-gray-100 text-center font-mono text-orange-600">{wasteMtr}</td>
                                <td className="p-2 border border-gray-100 text-center font-mono text-orange-600">{wasteWt}</td>
                                <td className="p-2 border border-gray-100 text-center font-mono text-gray-700">{totalMtr}</td>
                                <td className="p-2 border border-gray-100 text-center font-black text-gray-900 bg-gray-50">{totalWt}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2 border-indigo-200">
                          <tr className="font-bold">
                            <td colSpan={13} className="p-3 text-right text-indigo-900 uppercase text-[10px]">Total Weight (Kg)</td>
                            <td className="p-3 text-center bg-indigo-100 text-indigo-900 text-xs">
                              {form.secondaryLayers.reduce((sum, l) => {
                                const rmt = selectedPlan.totalRMT;
                                const reqSQM = rmt * form.jobWidth / 1000;
                                const reqWt = l.gsm > 0 ? l.gsm * reqSQM / 1000 : 0;
                                return sum + parseFloat((reqWt * 1.03).toFixed(4));
                              }, 0).toFixed(3)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setModalTab("basic")}>← Back</Button>
            <Button onClick={() => { if (colorShades.length === 0) initPrepData(form, selectedPlan); setPrepTab("film"); setModalTab("material"); }}>Next: Production Prep <ChevronRight size={14} className="ml-1" /></Button>
          </div>
        </div>
      )}

      {/* ── Tab 3: Production Preparation ── */}
      {modalTab === "material" && (
        <div className="space-y-3">
          {/* Sub-tab bar */}
          <div className="flex overflow-x-auto bg-gray-100 p-1 rounded-xl gap-1">
            {([
              { key: "film",     label: "Film Requisition"    },
              { key: "shade",    label: "Color Shade & LAB"   },
              { key: "material", label: "Material Allocation" },
              { key: "tool",     label: "Tool / Cylinder"     },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setPrepTab(t.key)}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${prepTab === t.key ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ─── Film Requisition ─── */}
          {prepTab === "film" && (
          <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <Package size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-800">Film & Material Requisition</p>
              <p className="text-xs text-blue-700 mt-0.5">Select source for each ply — request from Extrusion Unit (internal) or raise a Purchase Request (external vendor).</p>
            </div>
          </div>

          {form.secondaryLayers.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <Package size={36} className="mb-3 opacity-30" />
              <p className="text-sm font-medium text-gray-500">No plys configured</p>
              <p className="text-xs mt-1">Go to Planning tab to add ply layers first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {form.secondaryLayers.map((l, idx) => {
                const req: FilmRequisition = filmReqs[idx] ?? { source: "", status: "Pending" };
                const reqSQM  = form.quantity * ((form.jobWidth || 0) / 1000);
                const reqWt   = l.gsm > 0 ? parseFloat(((l.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
                const setReq  = (patch: Partial<FilmRequisition>) =>
                  setFilmReqs(prev => {
                    const next = [...prev];
                    next[idx]  = { ...(next[idx] ?? { source: "", status: "Pending" }), ...patch };
                    return next;
                  });
                const plyColor =
                  l.plyType === "Film"       ? { hdr: "bg-blue-50 border-blue-100",   badge: "bg-blue-100 text-blue-700 border-blue-200"   } :
                  l.plyType === "Printing"   ? { hdr: "bg-indigo-50 border-indigo-100", badge: "bg-indigo-100 text-indigo-700 border-indigo-200" } :
                  l.plyType === "Lamination" ? { hdr: "bg-orange-50 border-orange-100", badge: "bg-orange-100 text-orange-700 border-orange-200" } :
                                               { hdr: "bg-green-50 border-green-100",   badge: "bg-green-100 text-green-700 border-green-200"   };
                return (
                  <div key={l.id} className="bg-white border-2 border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    {/* Ply header */}
                    <div className={`flex items-center justify-between px-4 py-2.5 border-b ${plyColor.hdr}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-800">Ply {idx + 1} — {l.itemSubGroup || "No film selected"}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span>GSM: <strong>{l.gsm || "—"}</strong></span>
                        <span>Thick: <strong>{l.thickness || "—"}μ</strong></span>
                        {reqWt > 0 && <span className="font-bold text-blue-700">~{reqWt} Kg</span>}
                        {req.source && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            req.status === "Available" ? "bg-green-50 text-green-700 border-green-200" :
                            req.status === "Requested" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-gray-50 text-gray-500 border-gray-200"
                          }`}>● {req.status}</span>
                        )}
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {/* Source selection */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Select Source *</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setReq({ source: "Extrusion", status: "Pending" })}
                            className={`py-3 px-4 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                              req.source === "Extrusion" ? "bg-teal-600 text-white border-teal-600 shadow-md" : "bg-white text-teal-700 border-teal-200 hover:border-teal-400"
                            }`}>
                            <Factory size={14} /> Extrusion Unit
                            <span className={`text-[10px] ${req.source === "Extrusion" ? "text-teal-100" : "text-gray-400"}`}>(Internal)</span>
                          </button>
                          <button onClick={() => setReq({ source: "Purchase", status: "Pending" })}
                            className={`py-3 px-4 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                              req.source === "Purchase" ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-blue-700 border-blue-200 hover:border-blue-400"
                            }`}>
                            <ShoppingCart size={14} /> Purchase Request
                            <span className={`text-[10px] ${req.source === "Purchase" ? "text-blue-100" : "text-gray-400"}`}>(External)</span>
                          </button>
                        </div>
                      </div>

                      {req.source && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Required Qty</p>
                              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm font-bold text-blue-700">{reqWt > 0 ? `${reqWt} Kg` : "—"}</div>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Film Type</p>
                              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-medium">{l.itemSubGroup || "—"}</div>
                            </div>
                            <Input label="Required By" type="date" value={req.requiredDate || form.plannedDate || ""}
                              onChange={e => setReq({ requiredDate: e.target.value })} />
                          </div>

                          {req.source === "Extrusion" && (
                            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-2">
                              <p className="text-[10px] font-bold text-teal-800 uppercase tracking-widest">Extrusion Request Details</p>
                              <div className="grid grid-cols-2 gap-2">
                                <Input label="Film Specification" value={req.spec ?? `${l.itemSubGroup || ""}${l.thickness ? ` ${l.thickness}μ` : ""}`}
                                  onChange={e => setReq({ spec: e.target.value })} />
                                <Select label="Priority" value={req.priority ?? "Normal"}
                                  onChange={e => setReq({ priority: e.target.value })}
                                  options={[{ value: "Normal", label: "Normal" }, { value: "Urgent", label: "Urgent" }, { value: "Critical", label: "Critical" }]} />
                              </div>
                            </div>
                          )}

                          {req.source === "Purchase" && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                              <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest">Purchase Request Details</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Preferred Vendor</label>
                                  <select className="w-full text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-400"
                                    value={req.vendor ?? ""}
                                    onChange={e => setReq({ vendor: e.target.value })}>
                                    <option value="">-- Select Vendor --</option>
                                    {VENDOR_LEDGERS.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                  </select>
                                </div>
                                <Input label="Expected Rate (₹/Kg)" type="number" value={req.expectedRate ?? ""}
                                  onChange={e => setReq({ expectedRate: Number(e.target.value) })} />
                              </div>
                            </div>
                          )}

                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <Input label="Remarks" value={req.remarks ?? ""}
                                onChange={e => setReq({ remarks: e.target.value })} placeholder="Special instructions…" />
                            </div>
                            <button onClick={() => setReq({ status: req.status === "Requested" ? "Pending" : "Requested" })}
                              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border transition-all whitespace-nowrap ${
                                req.status === "Requested"
                                  ? "bg-green-100 text-green-700 border-green-300"
                                  : "bg-purple-700 text-white border-purple-700 hover:bg-purple-800"
                              }`}>
                              <Send size={11} />
                              {req.status === "Requested" ? "✓ Sent" : req.source === "Extrusion" ? "Send to Extrusion" : "Raise PR"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary */}
          {form.secondaryLayers.length > 0 && filmReqs.some(r => r?.source) && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-1.5">Requisition Summary</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-2.5 py-1 bg-teal-100 text-teal-700 rounded-full border border-teal-200 text-xs font-semibold">
                    {filmReqs.filter(r => r?.source === "Extrusion").length} → Extrusion
                  </span>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full border border-blue-200 text-xs font-semibold">
                    {filmReqs.filter(r => r?.source === "Purchase").length} → Purchase
                  </span>
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full border border-green-200 text-xs font-semibold">
                    {filmReqs.filter(r => r?.status === "Requested").length}/{form.secondaryLayers.length} Sent
                  </span>
                </div>
              </div>
              <button onClick={() => setFilmReqs(prev => prev.map(r => r?.source ? { ...r, status: "Requested" } : r))}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-indigo-700 text-white rounded-xl hover:bg-indigo-800 transition-colors">
                <Send size={13} /> Send All Requests
              </button>
            </div>
          )}

          </div>
          )}

          {/* ─── Color Shade & LAB Values ─── */}
          {prepTab === "shade" && (
            <div className="space-y-3">
              <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <Palette size={14} className="text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-purple-800">Color Shade & LAB Standard</p>
                  <p className="text-xs text-purple-700 mt-0.5">Enter client-approved color standards with CIE LAB values for production color matching.</p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-[11px] border-collapse">
                  <thead className="bg-purple-700 text-white uppercase tracking-wider">
                    <tr>
                      {[
                        { label: "#" },
                        { label: "Ink Item (Master)" },
                        { label: "Color Name" },
                        { label: "Type" },
                        { label: "Pantone Ref" },
                        { label: "L*", sub: "0–100", cls: "text-blue-200" },
                        { label: "a*", sub: "-128–127", cls: "text-red-200" },
                        { label: "b*", sub: "-128–127", cls: "text-yellow-200" },
                        { label: "ΔE Tol." },
                        { label: "Shade Card Ref" },
                        { label: "Status" },
                        { label: "Remarks" },
                      ].map(h => (
                        <th key={h.label} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold">
                          <span>{h.label}</span>
                          {h.sub && <div className={`text-[9px] font-normal opacity-80 ${h.cls}`}>{h.sub}</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {colorShades.map((cs, i) => (
                      <tr key={i} className="hover:bg-purple-50/20">
                        <td className="px-2 py-1.5 text-center font-black text-purple-700">{cs.colorNo}</td>
                        {/* Ink Item from Item Master */}
                        <td className="px-2 py-1.5 min-w-[180px]">
                          <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                            value={(cs as any).inkItemId ?? ""}
                            onChange={e => {
                              const ink = INK_ITEMS.find(x => x.id === e.target.value);
                              setColorShades(p => p.map((c, ci) => ci === i ? {
                                ...c,
                                inkItemId: ink?.id ?? "",
                                colorName: ink?.colour || ink?.name || c.colorName,
                                pantoneRef: ink?.pantoneNo || c.pantoneRef,
                              } as any : c));
                            }}>
                            <option value="">-- Select Ink --</option>
                            {INK_ITEMS.map(ink => <option key={ink.id} value={ink.id}>{ink.name}{ink.colour ? ` (${ink.colour})` : ""}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5"><input className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.colorName} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, colorName: e.target.value } : c))} /></td>
                        <td className="px-2 py-1.5">
                          <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-purple-400" value={cs.inkType} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, inkType: e.target.value as ColorShade["inkType"] } : c))}>
                            <option value="Spot">Spot</option><option value="Process">Process</option><option value="Special">Special</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5"><input placeholder="PMS 485 C" className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.pantoneRef} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, pantoneRef: e.target.value } : c))} /></td>
                        <td className="px-2 py-1.5">
                          <input type="number" step={1} min={0} max={100} placeholder="0–100"
                            className="w-[72px] text-xs border border-blue-200 bg-blue-50 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-blue-400 text-blue-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            value={cs.labL}
                            onChange={e => {
                              const v = Math.min(100, Math.max(0, Number(e.target.value)));
                              setColorShades(p => p.map((c, ci) => ci === i ? { ...c, labL: String(v) } : c));
                            }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step={1} min={-128} max={127} placeholder="-128–127"
                            className="w-[72px] text-xs border border-red-200 bg-red-50 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-red-400 text-red-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            value={cs.labA}
                            onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, labA: e.target.value } : c))} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step={1} min={-128} max={127} placeholder="-128–127"
                            className="w-[72px] text-xs border border-yellow-300 bg-yellow-50 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-yellow-400 text-yellow-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            value={cs.labB}
                            onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, labB: e.target.value } : c))} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step={0.1} min={0} max={10} placeholder="1.0"
                            className="w-[60px] text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-purple-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            value={cs.deltaE}
                            onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, deltaE: e.target.value } : c))} />
                        </td>
                        <td className="px-2 py-1.5"><input placeholder="SC-001" className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.shadeCardRef} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, shadeCardRef: e.target.value } : c))} /></td>
                        <td className="px-2 py-1.5">
                          <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-purple-400" value={cs.status} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, status: e.target.value as ColorShade["status"] } : c))}>
                            <option value="Pending">Pending</option><option value="Standard Received">Std. Received</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5"><input placeholder="Notes…" className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.remarks} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} /></td>
                      </tr>
                    ))}
                    {colorShades.length === 0 && (
                      <tr><td colSpan={12} className="p-6 text-center text-gray-400 text-xs">No colors. Set No. of Colors in Basic Info tab first.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {colorShades.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {(["Pending", "Standard Received", "Approved", "Rejected"] as const).map(s => {
                    const cnt = colorShades.filter(c => c.status === s).length;
                    return cnt > 0 ? (
                      <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${s === "Approved" ? "bg-green-50 text-green-700 border-green-200" : s === "Standard Received" ? "bg-blue-50 text-blue-700 border-blue-200" : s === "Rejected" ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{cnt} {s}</span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── Material Allocation ─── */}
          {prepTab === "material" && (
            <div className="space-y-3">
              <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <Archive size={14} className="text-teal-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-teal-800">Material Allocation</p>
                  <p className="text-xs text-teal-700 mt-0.5">Allocate raw materials from stock — enter lot no., store location, and allocated qty for each item.</p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-[11px] border-collapse">
                  <thead className="bg-teal-700 text-white uppercase tracking-wider">
                    <tr>
                      {["Ply", "Type", "Item (Master)", "Req. Qty", "Alloc. Qty", "Unit", "Lot / Batch No.", "Store Location", "Status", "Action"].map(h => (
                        <th key={h} className="px-2 py-2 border border-teal-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {materialAllocs.map((ma, i) => {
                      const itemsForType = items.filter(x => x.group === ma.materialType && x.active);
                      return (
                      <tr key={ma.id} className={`hover:bg-teal-50/20 ${ma.materialType === "Film" ? "bg-blue-50/30 font-medium" : ""}`}>
                        <td className="px-2 py-1.5 text-center font-bold text-teal-700">{ma.plyNo ?? "—"}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${ma.materialType === "Film" ? "bg-blue-100 text-blue-700 border-blue-200" : ma.materialType === "Ink" ? "bg-violet-100 text-violet-700 border-violet-200" : ma.materialType === "Solvent" ? "bg-orange-100 text-orange-700 border-orange-200" : ma.materialType === "Adhesive" ? "bg-teal-100 text-teal-700 border-teal-200" : "bg-gray-100 text-gray-700 border-gray-200"}`}>{ma.materialType}</span>
                        </td>
                        <td className="px-2 py-1.5 min-w-[180px]">
                          <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                            value={(ma as any).itemId ?? ""}
                            onChange={e => {
                              const it = itemsForType.find(x => x.id === e.target.value);
                              setMaterialAllocs(p => p.map((m, mi) => mi === i ? { ...m, itemId: it?.id ?? "", materialName: it?.name ?? m.materialName } as any : m));
                            }}>
                            <option value="">{ma.materialName || "-- Select Item --"}</option>
                            {itemsForType.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono text-blue-700 font-bold">{ma.requiredQty > 0 ? ma.requiredQty : "—"}</td>
                        <td className="px-2 py-1.5 text-center">
                          <input type="number" step={0.001} className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-teal-400 text-center" value={ma.allocatedQty || ""} onChange={e => setMaterialAllocs(p => p.map((m, mi) => mi === i ? { ...m, allocatedQty: Number(e.target.value) } : m))} />
                        </td>
                        <td className="px-2 py-1.5 text-center text-gray-500">{ma.unit}</td>
                        <td className="px-2 py-1.5"><input placeholder="LOT-001" className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-teal-400" value={ma.lotNo} onChange={e => setMaterialAllocs(p => p.map((m, mi) => mi === i ? { ...m, lotNo: e.target.value } : m))} /></td>
                        <td className="px-2 py-1.5"><input placeholder="Rack A-3" className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-teal-400" value={ma.location} onChange={e => setMaterialAllocs(p => p.map((m, mi) => mi === i ? { ...m, location: e.target.value } : m))} /></td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ma.status === "Allocated" ? "bg-green-50 text-green-700 border-green-200" : ma.status === "Partial" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{ma.status}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => setMaterialAllocs(p => p.map((m, mi) => mi === i ? { ...m, status: m.allocatedQty > 0 && m.allocatedQty >= m.requiredQty ? "Allocated" : m.allocatedQty > 0 ? "Partial" : "Pending" } : m))}
                            className="px-2.5 py-1 text-[10px] font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-700 whitespace-nowrap">Allocate</button>
                        </td>
                      </tr>
                    ); })}
                    {materialAllocs.length === 0 && (
                      <tr><td colSpan={10} className="p-6 text-center text-gray-400 text-xs">No materials. Configure plys in Planning tab, then return here.</td></tr>
                    )}
                  </tbody>
                  {materialAllocs.length > 0 && (
                    <tfoot className="bg-teal-50 border-t-2 border-teal-200">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right text-teal-800 text-[10px] font-bold uppercase">Totals</td>
                        <td className="px-2 py-2 text-center font-bold text-teal-900 font-mono">{materialAllocs.reduce((s, m) => s + m.requiredQty, 0).toFixed(3)} Kg</td>
                        <td className="px-2 py-2 text-center font-bold text-green-800 font-mono">{materialAllocs.reduce((s, m) => s + m.allocatedQty, 0).toFixed(3)} Kg</td>
                        <td colSpan={5} className="px-3 py-2">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setMaterialAllocs(p => p.map(m => ({ ...m, allocatedQty: m.requiredQty, status: "Allocated" as const })))}
                              className="px-3 py-1 text-xs font-bold bg-teal-700 text-white rounded-lg hover:bg-teal-800">Allocate All</button>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ─── Tool / Cylinder Allocation ─── */}
          {prepTab === "tool" && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <Wrench size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-800">Tool & Cylinder Allocation</p>
                  <p className="text-xs text-amber-700 mt-0.5">Assign print cylinders to each color. Track cylinder status, type (New/Existing/Rechromed), and circumference.</p>
                </div>
              </div>
              {form.cylinderSet && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                  <span className="font-semibold text-gray-500">Cylinder Set:</span>
                  <span className="font-bold text-gray-800 font-mono">{form.cylinderSet}</span>
                  {selectedPlan && <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-semibold">Circ: {selectedPlan.cylCirc} mm</span>}
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-[11px] border-collapse">
                  <thead className="bg-amber-700 text-white uppercase tracking-wider">
                    <tr>
                      {["Color #", "Color Name", "Cylinder No.", "Circumference (mm)", "Type", "Status", "Remarks"].map(h => (
                        <th key={h} className="px-2 py-2 border border-amber-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cylinderAllocs.map((ca, i) => (
                      <tr key={i} className="hover:bg-amber-50/20">
                        <td className="px-2 py-1.5 text-center font-black text-amber-700">{ca.colorNo}</td>
                        <td className="px-2 py-1.5">
                          <div className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg min-w-[100px]">
                            {colorShades[i]?.colorName || ca.colorName}
                          </div>
                        </td>
                        {/* Cylinder from Tool Master */}
                        <td className="px-2 py-1.5 min-w-[200px]">
                          <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400"
                            value={(ca as any).toolId ?? ""}
                            onChange={e => {
                              const tool = CYLINDER_TOOLS_ALL.find(t => t.id === e.target.value);
                              setCylinderAllocs(p => p.map((c, ci) => ci === i ? {
                                ...c,
                                toolId: tool?.id ?? "",
                                cylinderNo: tool?.code ?? c.cylinderNo,
                                circumference: selectedPlan ? String(selectedPlan.cylCirc) : c.circumference,
                              } as any : c));
                            }}>
                            <option value="">{ca.cylinderNo || "-- Select Cylinder --"}</option>
                            {CYLINDER_TOOLS_ALL.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name} ({t.printWidth}mm)</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5"><input type="number" className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-amber-400 text-center" value={ca.circumference} onChange={e => setCylinderAllocs(p => p.map((c, ci) => ci === i ? { ...c, circumference: e.target.value } : c))} /></td>
                        <td className="px-2 py-1.5">
                          <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400" value={ca.cylinderType} onChange={e => setCylinderAllocs(p => p.map((c, ci) => ci === i ? { ...c, cylinderType: e.target.value as CylinderAlloc["cylinderType"] } : c))}>
                            <option value="Existing">Existing</option><option value="New">New</option><option value="Rechromed">Rechromed</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400" value={ca.status} onChange={e => setCylinderAllocs(p => p.map((c, ci) => ci === i ? { ...c, status: e.target.value as CylinderAlloc["status"] } : c))}>
                            <option value="Pending">Pending</option><option value="Available">Available</option><option value="In Use">In Use</option><option value="Under Chrome">Under Chrome</option><option value="Ordered">Ordered</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5"><input placeholder="Notes…" className="w-32 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-amber-400" value={ca.remarks} onChange={e => setCylinderAllocs(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} /></td>
                      </tr>
                    ))}
                    {cylinderAllocs.length === 0 && (
                      <tr><td colSpan={7} className="p-6 text-center text-gray-400 text-xs">No cylinders. Set No. of Colors in Basic Info tab first.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {cylinderAllocs.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {(["Pending", "Available", "In Use", "Under Chrome", "Ordered"] as const).map(s => {
                    const cnt = cylinderAllocs.filter(c => c.status === s).length;
                    return cnt > 0 ? (
                      <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${s === "Available" ? "bg-green-50 text-green-700 border-green-200" : s === "In Use" ? "bg-blue-50 text-blue-700 border-blue-200" : s === "Under Chrome" ? "bg-orange-50 text-orange-700 border-orange-200" : s === "Ordered" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{cnt} {s}</span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setModalTab("planning")}>← Back</Button>
            <Button icon={<Printer size={14} />} onClick={save} variant={isSelectedPlanSpecial ? "danger" : "primary"}>
              {editing ? "Update Work Order" : isSelectedPlanSpecial ? "⚠ Cannot Save — Create Tool First" : "Create Work Order"}
            </Button>
          </div>
        </div>
      )}

    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ClipboardList size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Production Work Order</h2>
          </div>
          <p className="text-sm text-gray-500">{stats.pending} pending · {workOrders.length} work orders</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pending Orders", val: stats.pending,    cls: "bg-orange-50 text-orange-700 border-orange-200" },
          { label: "Open WOs",       val: stats.open,       cls: "bg-gray-50 text-gray-600 border-gray-200" },
          { label: "In Progress",    val: stats.inProgress, cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { label: "Completed",      val: stats.completed,  cls: "bg-green-50 text-green-700 border-green-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* ── Page Tabs ── */}
      <div className="flex overflow-x-auto bg-gray-100 p-1.5 rounded-xl gap-1.5">
        <button onClick={() => setPageTab("pending")}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${pageTab === "pending" ? "bg-white shadow text-orange-600" : "text-gray-500 hover:text-gray-700"}`}>
          <Clock size={15} />
          Pending Orders
          {stats.pending > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white">{stats.pending}</span>
          )}
        </button>
        <button onClick={() => setPageTab("workorders")}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${pageTab === "workorders" ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
          <Printer size={15} />
          Work Orders
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-600">{workOrders.length}</span>
        </button>
      </div>

      {/* ── PENDING ORDERS TAB ──────────────────────────────────── */}
      {pageTab === "pending" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {pendingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <CheckCircle2 size={40} className="text-green-400 mb-3" />
              <p className="font-semibold text-gray-600">All orders have work orders!</p>
              <p className="text-sm mt-1">No pending orders waiting for production planning.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingOrders.map(order => (
                <div key={order.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  {/* Source badge */}
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                      ${order.sourceType === "Estimation" ? "bg-blue-100" : order.sourceType === "Catalog" ? "bg-purple-100" : "bg-gray-100"}`}>
                      {order.sourceType === "Estimation" ? <Calculator size={18} className="text-blue-600" />
                       : order.sourceType === "Catalog"   ? <BookMarked size={18} className="text-purple-600" />
                       : <Edit3 size={18} className="text-gray-500" />}
                    </div>
                  </div>

                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-800 text-sm truncate">{order.jobName}</p>
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0">{order.orderNo}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span>{order.customerName}</span>
                      {order.substrate && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">{order.substrate}</span>}
                      <span>{order.noOfColors}C · {order.printType}</span>
                      <span>{order.quantity.toLocaleString()} {order.unit}</span>
                      {order.deliveryDate && <span className="text-orange-600 font-medium">Due: {order.deliveryDate}</span>}
                      {order.sourceType === "Estimation" && order.processes.length > 0 && (
                        <span className="text-green-600">{order.processes.length} processes ready</span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  {order.totalAmount > 0 && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-gray-400">Amount</p>
                      <p className="font-bold text-gray-800">₹{order.totalAmount.toLocaleString()}</p>
                      {order.perMeterRate > 0 && <p className="text-xs text-green-600">₹{order.perMeterRate.toFixed(2)}/{order.unit || "unit"}</p>}
                    </div>
                  )}

                  {/* Action */}
                  <div className="flex-shrink-0">
                    <Button icon={<ArrowRight size={14} />} onClick={() => convertToWO(order)}>
                      Create Work Order
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── WORK ORDERS TAB ─────────────────────────────────────── */}
      {pageTab === "workorders" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <DataTable
            data={workOrders}
            columns={woColumns}
            searchKeys={["workOrderNo", "customerName", "jobName", "machineName"]}
            actions={row => (
              <div className="flex items-center gap-1.5 justify-end flex-wrap">
                <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
                <Button variant="ghost" size="sm" icon={<Layers size={13} />} onClick={() => setViewPlanWO(row)}>View Plan</Button>
                <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={() => openReplan(row)}>Replan</Button>
                <Button variant="ghost" size="sm" icon={<BookMarked size={13} />} onClick={() => openSaveToCatalog(row)}>Save to Catalog</Button>
                <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleteId(row.id)}>Delete</Button>
              </div>
            )}
          />
        </div>
      )}

      {/* ══ CREATE / EDIT MODAL ═══════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => setModal(false)}
        title={editing ? `Edit Work Order — ${editing.workOrderNo}` : form.sourceOrderType !== "Direct" ? `New Work Order — From ${form.orderNo}` : "New Direct Work Order"}
        size="xl">
        {formContent}
      </Modal>

      {/* ══ REPLAN MODAL ══════════════════════════════════════════ */}
      <Modal open={replanOpen} onClose={() => setReplan(false)}
        title={`Replan — ${editing?.workOrderNo}`} size="xl">
        {editing && woHasSpecialPlan(editing) ? (
          <div className="mb-4 bg-rose-50 border-2 border-rose-300 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600 flex-shrink-0" />
              <p className="text-xs font-bold text-rose-800 uppercase tracking-wide">Special Tool Was Required — Now Replanning</p>
            </div>
            <p className="text-xs text-rose-700 pl-5">
              This WO was previously held because a special cylinder/sleeve was needed. Now that the tool is available, select a plan using <strong>real inventory tools</strong> below. Avoid selecting any plan marked <strong>SPECIAL CYL</strong> or <strong>SPECIAL SLV</strong>.
            </p>
            <p className="text-xs text-rose-600 pl-5 font-semibold">
              After saving with a valid plan, the WO status will update to <strong>Open</strong> and production can begin.
            </p>
          </div>
        ) : (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <RefreshCw size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              <strong>Replan Mode:</strong> The original planning from {editing?.sourceOrderType === "Estimation" ? "Order Booking" : "Direct Entry"} is shown.
              Add/remove processes and change machine as needed.
            </p>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <SH label="Machine & Rate" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Select label="Printing Machine" value={form.machineId}
                onChange={e => { const m = PRINT_MACHINES.find(x => x.id === e.target.value); if (m) { f("machineId", m.id); f("machineName", m.name); } }}
                options={[{ value: "", label: "-- Select Machine --" }, ...PRINT_MACHINES.map(m => ({ value: m.id, label: `${m.name} (${m.status})` }))]}
              />
              <Input label={`Rate / ${form.unit || "Unit"} (₹)`} type="number" value={form.perMeterRate || ""} onChange={e => f("perMeterRate", Number(e.target.value))} />
              <Input label="Total Amount (₹)" type="number" value={form.totalAmount || ""} onChange={e => f("totalAmount", Number(e.target.value))} />
            </div>
          </div>

          {/* Process List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <SH label="Process List" />
              <button onClick={addProcess} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition">
                <Plus size={12} /> Add Process
              </button>
            </div>
            {form.processes.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Process", "Charge Unit", "Rate (₹)", "Qty", "Setup (₹)", "Amount (₹)", ""].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.processes.map((pr, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 min-w-[200px]">
                          <select value={pr.processId} onChange={e => selectProcess(i, e.target.value)} className={cellInput}>
                            <option value="">-- Select Process --</option>
                            {ROTO_PROCESSES.map(pm => <option key={pm.id} value={pm.id}>{pm.name} ({pm.department})</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2"><span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-600 font-mono text-[10px]">{pr.chargeUnit || "—"}</span></td>
                        <td className="px-3 py-2 w-24"><input type="number" value={pr.rate} onChange={e => updateProcess(i, { rate: Number(e.target.value) })} className={`${cellInput} text-right`} step={0.01} /></td>
                        <td className="px-3 py-2 w-24"><input type="number" value={pr.qty} onChange={e => updateProcess(i, { qty: Number(e.target.value) })} className={`${cellInput} text-right`} /></td>
                        <td className="px-3 py-2 w-28"><input type="number" value={pr.setupCharge} onChange={e => updateProcess(i, { setupCharge: Number(e.target.value) })} className={`${cellInput} text-right`} /></td>
                        <td className="px-3 py-2 w-32 text-right font-semibold text-gray-800">₹{pr.amount.toLocaleString()}</td>
                        <td className="px-3 py-2 w-8 text-center"><button onClick={() => removeProcess(i)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><X size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-purple-50 border-t border-purple-200">
                    <tr>
                      <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-purple-700 uppercase">Total Process Cost</td>
                      <td className="px-3 py-2.5 text-sm font-bold text-purple-800 text-right">₹{form.processes.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-5 text-center text-xs text-gray-400">
                No processes added. Click &quot;+ Add Process&quot; to add.
              </div>
            )}
          </div>

          <Textarea label="Special Instructions" value={form.specialInstructions} onChange={e => f("specialInstructions", e.target.value)} placeholder="Notes for this replan…" />
        </div>
        {/* If WO was on hold for special tool and user now has a valid plan → auto-activate */}
        {editing && woHasSpecialPlan(editing) && !isSelectedPlanSpecial && isPlanApplied && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-green-700">
            <CheckCircle2 size={14} className="text-green-600" />
            Valid plan selected — WO status will change to <strong>Open</strong> and production can begin.
          </div>
        )}
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="secondary" onClick={() => setReplan(false)}>Cancel</Button>
          <Button icon={<RefreshCw size={14} />} onClick={save}>
            {editing && woHasSpecialPlan(editing) && !isSelectedPlanSpecial && isPlanApplied ? "Activate & Save" : "Save Replan"}
          </Button>
        </div>
      </Modal>

      {/* ══ VIEW MODAL ════════════════════════════════════════════ */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Work Order — ${viewRow.workOrderNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${viewRow.sourceOrderType !== "Direct" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
              {viewRow.sourceOrderType !== "Direct" ? <Calculator size={12}/> : <Edit3 size={12}/>}
              {viewRow.sourceOrderType !== "Direct" ? `From Order: ${viewRow.orderNo}` : "Direct Work Order"}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {([
                ["Customer",    viewRow.customerName],
                ["Job Name",    viewRow.jobName],
                ["Substrate",   viewRow.substrate || "—"],
                ["Category",    viewRow.categoryName || "—"],
                ["Size",        `${viewRow.jobWidth}×${viewRow.jobHeight} mm`],
                ["Colors",      `${viewRow.noOfColors}C`],
                ["Print Type",  viewRow.printType],
                ["Machine",     viewRow.machineName || "—"],
                ["Operator",    viewRow.operatorName || "—"],
                ["Cylinder",    viewRow.cylinderSet || "—"],
                ["Quantity",    `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
                ["Planned",     viewRow.plannedDate || "—"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}><p className="text-[10px] text-gray-400 uppercase font-semibold">{k}</p><p className="font-medium text-gray-800">{v}</p></div>
              ))}
            </div>
            {viewRow.processes.length > 0 && (
              <div><p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Processes</p>
                <div className="flex flex-wrap gap-1.5">{viewRow.processes.map((p, i) => <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs">{p.processName}</span>)}</div>
              </div>
            )}
            {viewRow.inks.length > 0 && (
              <div><p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Ink Colors</p>
                <div className="flex flex-wrap gap-1.5">{viewRow.inks.map(c => <span key={c} className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-medium">{c}</span>)}</div>
              </div>
            )}
            {viewRow.specialInstructions && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800"><strong>Instructions:</strong> {viewRow.specialInstructions}</div>
            )}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[viewRow.status]}`}>{viewRow.status}</div>
          </div>
          <div className="flex justify-between mt-5">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <Button icon={<RefreshCw size={14} />} onClick={() => { setViewRow(null); openReplan(viewRow); }}>Replan</Button>
          </div>
        </Modal>
      )}

      {/* ══ DELETE CONFIRM ════════════════════════════════════════ */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Work Order" size="sm">
          <p className="text-sm text-gray-600 mb-5">This work order will be permanently deleted.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { setWOs(d => d.filter(r => r.id !== deleteId)); setDeleteId(null); }}>Delete</Button>
          </div>
        </Modal>
      )}

      {/* ══ VIEW PLAN MODAL ═══════════════════════════════════════ */}
      {viewPlanWO && (
        <Modal open={!!viewPlanWO} onClose={() => setViewPlanWO(null)}
          title={`Production Plan — ${viewPlanWO.workOrderNo}`} size="xl">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full font-semibold">Work Order</span>
            <span className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-full">{viewPlanWO.customerName}</span>
            <span className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-full">{viewPlanWO.jobName}</span>
            <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-full font-semibold">{viewPlanWO.noOfColors}C · {viewPlanWO.printType}</span>
            {viewPlanWO.machineName && <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full">{viewPlanWO.machineName}</span>}
          </div>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <PlanViewer plan={{
              title:   "Work Order",
              refNo:   viewPlanWO.workOrderNo,
              jobWidth:  viewPlanWO.jobWidth,
              jobHeight: viewPlanWO.jobHeight,
              quantity:  viewPlanWO.quantity,
              unit:      viewPlanWO.unit,
              noOfColors: viewPlanWO.noOfColors,
              secondaryLayers:     viewPlanWO.secondaryLayers,
              processes:           viewPlanWO.processes,
              cylinderCostPerColor: viewPlanWO.cylinderCostPerColor,
              overheadPct: viewPlanWO.overheadPct,
              profitPct:   viewPlanWO.profitPct,
            } satisfies PlanInput} />
          </div>
          <div className="flex justify-between mt-4">
            <Button variant="secondary" onClick={() => setViewPlanWO(null)}>Close</Button>
            <Button icon={<BookMarked size={14} />} onClick={() => { setViewPlanWO(null); openSaveToCatalog(viewPlanWO); }}>Save to Catalog</Button>
          </div>
        </Modal>
      )}

      {/* ══ CATEGORY CHANGE CONFIRM ══════════════════════════════ */}
      {pendingWOCategoryId && (
        <Modal open={!!pendingWOCategoryId} onClose={() => setPendingWOCategoryId(null)} title="Replace Ply Configuration?" size="sm">
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              Ply details already added. Selecting a new category will <strong>reset your current ply configuration</strong> with the new category&apos;s default plys.
            </div>
            <p className="text-sm text-gray-600">Do you want to replace the ply details with the selected category?</p>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setPendingWOCategoryId(null)}>No — Keep My Plys</Button>
              <Button onClick={() => { applyWOCategory(pendingWOCategoryId!); setPendingWOCategoryId(null); }}>Yes — Reset Plys</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ SAVE TO CATALOG MODAL ═════════════════════════════════ */}
      {catSaveWO && (
        <Modal open={!!catSaveWO} onClose={() => setCatSaveWO(null)} title="Save Work Order as Product Catalog Template" size="sm">
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-700">
              <p className="font-bold mb-1">Work Order: {catSaveWO.workOrderNo}</p>
              <p>Customer: {catSaveWO.customerName} · {catSaveWO.noOfColors}C · {catSaveWO.substrate || "—"}</p>
              <p className="mt-1">{catSaveWO.processes.length} processes · {catSaveWO.secondaryLayers.length} plys · ₹{catSaveWO.perMeterRate.toFixed(2)}/{catSaveWO.unit || "unit"}</p>
            </div>
            <Input
              label="Product Name in Catalog"
              value={catProdName}
              onChange={e => setCatProdName(e.target.value)}
              placeholder="e.g. Parle-G 100g Wrap"
            />
            <p className="text-xs text-gray-500">All planning (processes, ply structure, rates) will be saved as a reusable template. Orders can then be booked directly from this catalog item.</p>
          </div>
          <div className="flex justify-end gap-3 mt-5">
            <Button variant="secondary" onClick={() => setCatSaveWO(null)}>Cancel</Button>
            <Button icon={<BookMarked size={14} />} onClick={confirmSaveToCatalog}>Save to Catalog</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
