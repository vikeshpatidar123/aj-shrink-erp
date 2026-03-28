"use client";
import { useState, useMemo } from "react";
import {
  BookMarked, Eye, Trash2, Clock, CheckCircle2,
  ShoppingCart, CheckCircle, AlertCircle, Lock, ArrowRight,
  RefreshCw, Save, Plus, X, Calculator, Layers, Check, Pencil,
  ChevronRight, Eye as EyeIcon, Factory, Send, Package, Palette, Wrench, Archive,
} from "lucide-react";
import {
  gravureOrders, gravureWorkOrders as initWOs,
  GravureProductCatalog, GravureOrder, GravureWorkOrder,
  machines, processMasters, items, ledgers, GravureEstimationProcess,
  SecondaryLayer, PlyConsumableItem, CategoryPlyConsumable,
  CATEGORY_GROUP_SUBGROUP,
  tools as allTools, toolInventory,
} from "@/data/dummyData";
import { useCategories } from "@/context/CategoriesContext";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { PlanViewer, PlanInput } from "@/components/gravure/PlanViewer";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button   from "@/components/ui/Button";
import Modal    from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

// ─── Masters ──────────────────────────────────────────────────
const ROTO_PROCESSES    = processMasters.filter(p => p.module === "Rotogravure");
const PRINT_MACHINES    = machines.filter(m => m.department === "Printing");
const AVAILABLE_TOOL_IDS = new Set(toolInventory.filter(ti => ti.status === "Available").map(ti => ti.toolId));
const SLEEVE_TOOLS      = allTools.filter(t => t.toolType === "Sleeve"   && AVAILABLE_TOOL_IDS.has(t.id)).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
const CYLINDER_TOOLS    = allTools.filter(t => t.toolType === "Cylinder" && AVAILABLE_TOOL_IDS.has(t.id)).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
const FILM_ITEMS        = items.filter(i => i.group === "Film" && i.active);
const INK_ITEMS         = items.filter(i => i.group === "Ink" && i.active);
const VENDOR_LEDGERS    = ledgers.filter(l => (l.ledgerType === "Supplier" || l.ledgerType === "Vendor") && l.status === "Active");
const CYLINDER_TOOLS_ALL = allTools.filter(t => t.toolType === "Cylinder");
const FILM_SUBGROUPS = Array.from(
  new Map(FILM_ITEMS.filter(i => i.subGroup).map(i => [i.subGroup, { subGroup: i.subGroup, density: parseFloat(i.density) || 0, thicknesses: new Set<number>() }])).entries()
).map(([subGroup, data]) => {
  FILM_ITEMS.filter(i => i.subGroup === subGroup).forEach(i => { const t = parseFloat(i.thickness); if (!isNaN(t) && t > 0) data.thicknesses.add(t); });
  return { subGroup, density: data.density, thicknesses: Array.from(data.thicknesses).sort((a, b) => a - b) };
});

const DEFAULT_PLY_CONSUMABLES: Record<string, CategoryPlyConsumable[]> = {
  Printing:   [
    { id: "DEF_INK", plyType: "Printing",   itemGroup: "Ink",     itemSubGroup: "Solvent Based Ink",  fieldDisplayName: "Ink",     defaultValue: 3.5, minValue: 1,   maxValue: 8,   sharePercentageFormula: "" },
    { id: "DEF_SOL", plyType: "Printing",   itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", fieldDisplayName: "Solvent", defaultValue: 2.0, minValue: 0.5, maxValue: 5,   sharePercentageFormula: "" },
  ],
  Lamination: [
    { id: "DEF_ADH", plyType: "Lamination", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive",   fieldDisplayName: "Adhesive", defaultValue: 3.5, minValue: 2,   maxValue: 6,   sharePercentageFormula: "" },
    { id: "DEF_HRD", plyType: "Lamination", itemGroup: "Hardner",  itemSubGroup: "PU Hardener",   fieldDisplayName: "Hardener", defaultValue: 0.7, minValue: 0.3, maxValue: 1.5, sharePercentageFormula: "" },
  ],
  Coating: [
    { id: "DEF_CTG", plyType: "Coating",    itemGroup: "Adhesive", itemSubGroup: "Coating Adhesive", fieldDisplayName: "Coating", defaultValue: 3.0, minValue: 1, maxValue: 6, sharePercentageFormula: "" },
  ],
};

// ─── Section Header ───────────────────────────────────────────
const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2 pb-1.5 border-b border-purple-100">{label}</p>
);

const Pill = ({ label, value, cls = "bg-gray-50 text-gray-700 border-gray-200" }: { label: string; value: string; cls?: string }) => (
  <div className={`rounded-lg border px-3 py-2 ${cls}`}>
    <p className="text-[10px] font-semibold uppercase text-current opacity-50 mb-0.5">{label}</p>
    <p className="text-xs font-bold">{value || "—"}</p>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────
export default function ProductCatalogPage() {
  const { categories } = useCategories();
  const { catalog, saveCatalogItem, deleteCatalogItem } = useProductCatalog();
  const [workOrders] = useState<GravureWorkOrder[]>(initWOs);

  const [catalogTab, setCatalogTab] = useState<"pending" | "processed">("pending");
  const [viewPlanRow, setViewPlanRow] = useState<GravureProductCatalog | null>(null);
  const [deleteId,    setDeleteId]   = useState<string | null>(null);

  // ── Create Catalog state ──────────────────────────────────
  const [createOpen,  setCreateOpen]  = useState(false);
  const [sourceOrder, setSourceOrder] = useState<GravureOrder | null>(null);
  const [sourceWO,    setSourceWO]    = useState<GravureWorkOrder | null>(null);
  const [editName,   setEditName]   = useState("");
  const [editRate,   setEditRate]   = useState(0);
  const [editRemark, setEditRemark] = useState("");

  // ── Replan / Edit state ───────────────────────────────────
  const [replanOpen,    setReplanOpen]    = useState(false);
  const [replanForm,    setReplanForm]    = useState<GravureProductCatalog | null>(null);
  const [replanTab,     setReplanTab]     = useState<"info" | "planning" | "material">("info");
  const [isNewCatalog,  setIsNewCatalog]  = useState(false);

  type FilmRequisition = { source: "Extrusion" | "Purchase" | ""; status: "Pending" | "Requested" | "Available"; requiredDate?: string; spec?: string; priority?: string; vendor?: string; expectedRate?: number; remarks?: string; };
  type ColorShade      = { colorNo: number; colorName: string; inkType: "Spot" | "Process" | "Special"; pantoneRef: string; labL: string; labA: string; labB: string; deltaE: string; shadeCardRef: string; status: "Pending" | "Standard Received" | "Approved" | "Rejected"; remarks: string; };
  type MaterialAlloc   = { id: string; plyNo?: number; materialType: string; materialName: string; requiredQty: number; unit: string; allocatedQty: number; lotNo: string; location: string; status: "Pending" | "Partial" | "Allocated"; };
  type CylinderAlloc   = { colorNo: number; colorName: string; cylinderNo: string; circumference: string; cylinderType: "New" | "Existing" | "Rechromed"; status: "Pending" | "Available" | "In Use" | "Under Chrome" | "Ordered"; remarks: string; };
  const [catalogFilmReqs,   setCatalogFilmReqs]   = useState<FilmRequisition[]>([]);
  const [catalogColorShades,setCatalogColorShades] = useState<ColorShade[]>([]);
  const [catalogMatAllocs,  setCatalogMatAllocs]   = useState<MaterialAlloc[]>([]);
  const [catalogCylAllocs,  setCatalogCylAllocs]   = useState<CylinderAlloc[]>([]);
  const [catalogPrepTab,    setCatalogPrepTab]     = useState<"film" | "shade" | "material" | "tool">("film");
  const [replanShowPlan,      setReplanShowPlan]      = useState(false);
  const [replanIsPlanApplied, setReplanIsPlanApplied] = useState(false);
  const [replanPlanSearch,    setReplanPlanSearch]    = useState("");
  const [replanPlanSort,      setReplanPlanSort]      = useState<{ key: string; dir: "asc" | "desc" }>({ key: "", dir: "asc" });
  const [replanSelPlanId,     setReplanSelPlanId]     = useState("");

  const rf = <K extends keyof GravureProductCatalog>(k: K, v: GravureProductCatalog[K]) => {
    setReplanForm(p => {
      if (!p) return p;
      const next = { ...p, [k]: v };
      if (k === "frontColors" || k === "backColors") {
        next.noOfColors = ((k === "frontColors" ? v : p.frontColors) as number || 0) + ((k === "backColors" ? v : p.backColors) as number || 0);
      }
      return next;
    });
  };

  // ── Ply helpers ───────────────────────────────────────────
  const getCategoryConsumables = (categoryId: string, plyType: string): CategoryPlyConsumable[] => {
    if (!plyType || plyType === "Film") return [];
    const cat = categories.find(c => c.id === categoryId);
    const catDefs = cat?.plyConsumables?.filter(pc => pc.plyType === plyType) ?? [];
    return catDefs.length > 0 ? catDefs : (DEFAULT_PLY_CONSUMABLES[plyType] ?? []);
  };

  const onPlyTypeChange = (index: number, plyType: string) => {
    if (!replanForm) return;
    const consumables = getCategoryConsumables(replanForm.categoryId || "", plyType);
    const consumableItems: PlyConsumableItem[] = consumables.map(pc => ({
      consumableId: pc.id, fieldDisplayName: pc.fieldDisplayName,
      itemGroup: pc.itemGroup, itemSubGroup: pc.itemSubGroup,
      itemId: "", itemName: "", gsm: pc.defaultValue, rate: 0,
    }));
    const layers = [...replanForm.secondaryLayers];
    layers[index] = { ...layers[index], plyType, consumableItems };
    rf("secondaryLayers", layers);
  };

  const updatePlyConsumable = (layerIdx: number, ciIdx: number, patch: Partial<PlyConsumableItem>) => {
    if (!replanForm) return;
    const layers = [...replanForm.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    const ci = [...layer.consumableItems];
    ci[ciIdx] = { ...ci[ciIdx], ...patch };
    layer.consumableItems = ci;
    layers[layerIdx] = layer;
    rf("secondaryLayers", layers);
  };

  const addReplanProcess = () => {
    if (!replanForm) return;
    rf("processes", [...replanForm.processes, { processId: "", processName: "", chargeUnit: "", rate: 0, qty: 0, setupCharge: 0, amount: 0 }]);
  };

  const removeReplanProcess = (i: number) => {
    if (!replanForm) return;
    rf("processes", replanForm.processes.filter((_, idx) => idx !== i));
  };

  const updateReplanProcess = (i: number, patch: Partial<GravureEstimationProcess>) => {
    if (!replanForm) return;
    rf("processes", replanForm.processes.map((pr, idx) => {
      if (idx !== i) return pr;
      const updated = { ...pr, ...patch };
      updated.amount = parseFloat((updated.rate * updated.qty + updated.setupCharge).toFixed(2));
      return updated;
    }));
  };

  const selectReplanProcess = (i: number, processId: string) => {
    const pm = ROTO_PROCESSES.find(x => x.id === processId);
    if (!pm) return;
    updateReplanProcess(i, { processId: pm.id, processName: pm.name, chargeUnit: pm.chargeUnit, rate: parseFloat(pm.rate) || 0, setupCharge: pm.makeSetupCharges ? parseFloat(pm.setupChargeAmount) || 0 : 0 });
  };

  const cellInput = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

  // ── Live cost for replan ──────────────────────────────────
  type CatalogMatRow = { plyNo: number; plyType: string; itemName: string; group: string; gsm: number; reqMtr: number; reqSQM: number; reqWt: number; wasteMtr: number; wasteSQM: number; wasteWt: number; totalMtr: number; totalSQM: number; totalWt: number; rate: number; amount: number; };

  const replanCost = useMemo(() => {
    if (!replanForm) return null;
    const qty    = replanForm.standardQty || 0;
    const widthM = (replanForm.jobWidth || 0) / 1000;
    const areaM2 = qty * widthM;
    const WASTE  = 0.03;
    let filmCost = 0, consumableCost = 0;
    const materialRows: CatalogMatRow[] = [];

    replanForm.secondaryLayers.forEach(l => {
      const reqMtr = qty; const reqSQM = areaM2;
      if (l.itemSubGroup && l.gsm > 0) {
        const fi   = FILM_ITEMS.find(x => x.subGroup === l.itemSubGroup);
        const rate = l.filmRate !== undefined ? l.filmRate : (parseFloat(fi?.estimationRate || "0") || 0);
        const reqWt = (l.gsm / 1000) * reqSQM;
        const wasteMtr = reqMtr * WASTE; const wasteSQM = reqSQM * WASTE; const wasteWt = reqWt * WASTE;
        const totalWt = reqWt + wasteWt;
        filmCost += totalWt * rate;
        materialRows.push({ plyNo: l.layerNo, plyType: l.plyType || "Film", itemName: l.itemSubGroup, group: "Film", gsm: l.gsm, reqMtr, reqSQM, reqWt, wasteMtr, wasteSQM, wasteWt, totalMtr: reqMtr + wasteMtr, totalSQM: reqSQM + wasteSQM, totalWt, rate, amount: totalWt * rate });
      }
      (l.consumableItems || []).forEach(ci => {
        if (!ci.gsm && ci.gsm !== 0) return;
        const effGsm = (ci.coveragePct ?? 100) < 100 ? ci.gsm * ((ci.coveragePct ?? 100) / 100) : ci.gsm;
        const reqWt = (effGsm / 1000) * reqSQM;
        const wasteMtr = reqMtr * WASTE; const wasteSQM = reqSQM * WASTE; const wasteWt = reqWt * WASTE;
        const totalWt = reqWt + wasteWt; const amount = totalWt * (ci.rate || 0);
        consumableCost += amount;
        materialRows.push({ plyNo: l.layerNo, plyType: l.plyType || "", itemName: ci.itemName || ci.fieldDisplayName || ci.itemSubGroup, group: ci.itemGroup, gsm: ci.gsm || 0, reqMtr, reqSQM, reqWt, wasteMtr, wasteSQM, wasteWt, totalMtr: reqMtr + wasteMtr, totalSQM: reqSQM + wasteSQM, totalWt, rate: ci.rate || 0, amount });
      });
    });

    let processCost = 0;
    replanForm.processes.forEach(p => {
      const pQty = p.chargeUnit === "SQM" ? areaM2 : p.chargeUnit === "Meter" ? qty : p.chargeUnit === "Color" ? replanForm.noOfColors : 1;
      processCost += pQty * (p.rate || 0);
    });

    const cylinderCost = (replanForm.noOfColors || 0) * (replanForm.cylinderCostPerColor || 0);
    const materialCost = filmCost + consumableCost;
    const subtotal     = materialCost + processCost + cylinderCost;
    const overhead     = subtotal * ((replanForm.overheadPct || 0) / 100);
    const profit       = (subtotal + overhead) * ((replanForm.profitPct || 0) / 100);
    const total        = subtotal + overhead + profit;
    const perMeter     = qty > 0 ? total / qty : 0;
    return { filmCost, consumableCost, materialCost, processCost, cylinderCost, overhead, profit, total, perMeter, materialRows };
  }, [replanForm]);

  // ── Production Plan for Catalog (Sleeve × Cylinder based) ──
  const replanAllPlans = useMemo(() => {
    const planWidth = replanForm?.actualWidth || replanForm?.jobWidth || 0;
    if (!replanForm?.machineId || planWidth <= 0) return [];
    const machine = PRINT_MACHINES.find(m => m.id === replanForm.machineId);
    if (!machine) return [];

    const machineMaxFilm = parseFloat((machine as any).maxWebWidth) || 1300;
    const baseCirc  = replanForm.jobHeight > 0 ? Math.ceil(replanForm.jobHeight / 12) * 12 : 450;
    const laneWidth = planWidth + (replanForm.trimmingSize || 0);

    const trim      = replanForm.trimmingSize || 0;
    const repeatUPS = replanForm.jobHeight > 0 ? Math.max(1, Math.floor(baseCirc / replanForm.jobHeight)) : 10;

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
        const reqRMT     = replanForm.standardQty > 0 ? Math.ceil(replanForm.standardQty / totalUPS) : 1;
        const totalRMT   = Math.ceil(reqRMT * 1.01);
        return cylList.map(cylinder => ({
          planId: `CP-${machine.id}-${sleeve.id}-UPS${acUps}-${cylinder.id}`,
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
        const reqRMT     = replanForm.standardQty > 0 ? Math.ceil(replanForm.standardQty / totalUPS) : 1;
        const totalRMT   = Math.ceil(reqRMT * 1.01);
        return [{
          planId: `CP-${machine.id}-SPLSLV-UPS${acUps}-${cylinder.id}`,
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
  }, [replanForm?.machineId, replanForm?.actualWidth, replanForm?.jobWidth, replanForm?.jobHeight, replanForm?.trimmingSize, replanForm?.standardQty]);

  const replanVisiblePlans = useMemo(() => {
    let rows = replanAllPlans;
    const q = replanPlanSearch.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.machineName.toLowerCase().includes(q) || String(r.cylCirc).includes(q) || String(r.totalUPS).includes(q));
    if (replanPlanSort.key) {
      rows = [...rows].sort((a, b) => {
        const av = (a as any)[replanPlanSort.key] ?? 0; const bv = (b as any)[replanPlanSort.key] ?? 0;
        const diff = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
        return replanPlanSort.dir === "asc" ? diff : -diff;
      });
    }
    return rows;
  }, [replanAllPlans, replanPlanSearch, replanPlanSort]);

  const replanTogglePlanSort = (key: string) =>
    setReplanPlanSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  const replanSelectedPlan = useMemo(() =>
    replanAllPlans.find(p => p.planId === replanSelPlanId) || null,
    [replanAllPlans, replanSelPlanId]
  );

  // ── Auto-build plys from category (same as Estimation) ──────
  const [pendingReplanCategoryId, setPendingReplanCategoryId] = useState<string | null>(null);
  const applyReplanCategory = (categoryId: string) => {
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
    setReplanForm(p => p ? { ...p, categoryId, categoryName: cat?.name || "", secondaryLayers: autoLayers } : p);
  };

  const initCatalogPrepData = (rf: GravureProductCatalog) => {
    const n = rf.noOfColors || 0;
    setCatalogColorShades(Array.from({ length: n }, (_, i) => ({
      colorNo: i + 1, colorName: `Color ${i + 1}`, inkType: "Spot" as const,
      pantoneRef: "", labL: "", labA: "", labB: "", deltaE: "1.0",
      shadeCardRef: "", status: "Pending" as const, remarks: "",
    })));
    const reqSQM = (rf.standardQty || 0) * ((rf.jobWidth || 0) / 1000);
    const allocs: MaterialAlloc[] = [];
    rf.secondaryLayers.forEach((l, i) => {
      if (l.itemSubGroup) {
        const reqWt = l.gsm > 0 ? parseFloat(((l.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
        allocs.push({ id: `film-${i}`, plyNo: l.layerNo, materialType: "Film", materialName: l.itemSubGroup, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, lotNo: "", location: "", status: "Pending" });
      }
      (l.consumableItems || []).forEach((ci, j) => {
        const reqWt = ci.gsm > 0 ? parseFloat(((ci.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
        allocs.push({ id: `con-${i}-${j}`, plyNo: l.layerNo, materialType: ci.itemGroup, materialName: ci.itemName || ci.fieldDisplayName, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, lotNo: "", location: "", status: "Pending" });
      });
    });
    setCatalogMatAllocs(allocs);
    setCatalogCylAllocs(Array.from({ length: n }, (_, i) => ({
      colorNo: i + 1, colorName: `Color ${i + 1}`, cylinderNo: "",
      circumference: "", cylinderType: "Existing" as const, status: "Pending" as const, remarks: "",
    })));
  };

  const openReplan = (row: GravureProductCatalog) => {
    setIsNewCatalog(false);
    setReplanForm({ ...row });
    setReplanTab("info");
    setCatalogFilmReqs([]); setCatalogColorShades([]); setCatalogMatAllocs([]); setCatalogCylAllocs([]); setCatalogPrepTab("film");
    setReplanSelPlanId(""); setReplanShowPlan(false); setReplanIsPlanApplied(false); setReplanPlanSearch(""); setReplanPlanSort({ key: "", dir: "asc" });
    setReplanOpen(true);
  };

  const saveReplan = () => {
    if (!replanForm) return;
    const n = catalog.length + 1;
    const updated: GravureProductCatalog = {
      ...replanForm,
      perMeterRate: replanCost?.perMeter ?? replanForm.perMeterRate,
      ...(isNewCatalog && {
        id:        `GPC${String(n).padStart(3, "0")}`,
        catalogNo: `GRV-CAT-${String(n).padStart(3, "0")}`,
      }),
    };
    saveCatalogItem(updated);
    setReplanOpen(false);
    setReplanForm(null);
    if (isNewCatalog) { setIsNewCatalog(false); setCatalogTab("processed"); }
  };

  // ── Derived lists ─────────────────────────────────────────
  const catalogedOrderIds = useMemo(() => {
    const ids = new Set<string>();
    catalog.forEach(c => { if (c.sourceOrderId) ids.add(c.sourceOrderId); });
    return ids;
  }, [catalog]);

  const pendingOrders = useMemo(() =>
    gravureOrders.filter(o => !catalogedOrderIds.has(o.id)),
    [catalogedOrderIds]
  );

  const processedCatalog = useMemo(() =>
    catalog.filter(c => !!c.sourceOrderId),
    [catalog]
  );

  // ── Open Create — opens full 3-tab modal directly ─────────
  const openCreate = (order: GravureOrder) => {
    const wo   = workOrders.find(w => w.orderId === order.id) || null;
    const line = order.orderLines?.[0];
    const n    = catalog.length + 1;
    const draft: GravureProductCatalog = {
      id:          `GPC${String(n).padStart(3, "0")}-DRAFT`,
      catalogNo:   `GRV-CAT-${String(n).padStart(3, "0")}`,
      createdDate: new Date().toISOString().slice(0, 10),
      productName:  wo?.jobName || line?.productName || order.jobName || "",
      customerId:   order.customerId,
      customerName: order.customerName,
      categoryId: "", categoryName: "", content: "",
      jobWidth:    wo?.jobWidth  || line?.jobWidth  || order.jobWidth  || 0,
      jobHeight:   wo?.jobHeight || line?.jobHeight || order.jobHeight || 0,
      actualWidth:  wo?.actualWidth  || 0,
      actualHeight: wo?.actualHeight || 0,
      noOfColors:  wo?.noOfColors  || line?.noOfColors  || order.noOfColors  || 0,
      printType:   (wo?.printType  || line?.printType  || order.printType   || "Surface Print") as GravureProductCatalog["printType"],
      substrate:   wo?.substrate   || line?.substrate  || order.substrate   || "",
      secondaryLayers: [...(wo?.secondaryLayers || order.secondaryLayers || [])],
      processes:       [...(wo?.processes       || order.processes       || [])],
      machineId:   wo?.machineId   || "",
      machineName: wo?.machineName || "",
      cylinderCostPerColor: wo?.cylinderCostPerColor || 3500,
      overheadPct: wo?.overheadPct || 12,
      profitPct:   wo?.profitPct   || 15,
      perMeterRate: wo?.perMeterRate || line?.rate || order.perMeterRate || 0,
      standardQty:  wo?.quantity   || line?.orderQty || order.quantity || 0,
      standardUnit: wo?.unit       || line?.unit     || order.unit     || "Meter",
      sourceEstimationId: "", sourceEstimationNo: "",
      sourceOrderId:   order.id,
      sourceOrderNo:   order.orderNo,
      sourceWorkOrderId:  wo?.id         || "",
      sourceWorkOrderNo:  wo?.workOrderNo || "",
      trimmingSize: wo?.trimmingSize,
      frontColors:  wo?.frontColors,
      backColors:   wo?.backColors,
      status: "Active",
      remarks: wo?.specialInstructions || "",
    };
    setIsNewCatalog(true);
    setReplanForm(draft);
    setReplanTab("info");
    setCatalogFilmReqs([]); setCatalogColorShades([]); setCatalogMatAllocs([]); setCatalogCylAllocs([]); setCatalogPrepTab("film");
    setReplanSelPlanId(""); setReplanShowPlan(false); setReplanIsPlanApplied(false); setReplanPlanSearch(""); setReplanPlanSort({ key: "", dir: "asc" });
    setReplanOpen(true);
  };

  // ── Save Catalog ──────────────────────────────────────────
  const saveCatalog = () => {
    if (!sourceOrder || !editName.trim()) return;
    const wo   = sourceWO;
    const line = sourceOrder.orderLines?.[0];
    const n    = catalog.length + 1;
    const item: GravureProductCatalog = {
      id:          `GPC${String(n).padStart(3, "0")}`,
      catalogNo:   `GRV-CAT-${String(n).padStart(3, "0")}`,
      createdDate: new Date().toISOString().slice(0, 10),
      productName:  editName,
      customerId:   sourceOrder.customerId,
      customerName: sourceOrder.customerName,
      categoryId: "", categoryName: "", content: "",
      jobWidth:    wo?.jobWidth  || line?.jobWidth  || sourceOrder.jobWidth  || 0,
      jobHeight:   wo?.jobHeight || line?.jobHeight || sourceOrder.jobHeight || 0,
      actualWidth:  wo?.actualWidth  || 0,
      actualHeight: wo?.actualHeight || 0,
      noOfColors:  wo?.noOfColors  || line?.noOfColors  || sourceOrder.noOfColors  || 0,
      printType:   (wo?.printType  || line?.printType  || sourceOrder.printType   || "Surface Print") as GravureProductCatalog["printType"],
      substrate:   wo?.substrate   || line?.substrate  || sourceOrder.substrate   || "",
      secondaryLayers:      [...(wo?.secondaryLayers      || sourceOrder.secondaryLayers      || [])],
      processes:            [...(wo?.processes            || sourceOrder.processes            || [])],
      machineId:   wo?.machineId   || "",
      machineName: wo?.machineName || "",
      cylinderCostPerColor: wo?.cylinderCostPerColor || 3500,
      overheadPct: wo?.overheadPct || 12,
      profitPct:   wo?.profitPct   || 15,
      perMeterRate: editRate,
      standardQty:  wo?.quantity   || line?.orderQty || sourceOrder.quantity || 0,
      standardUnit: wo?.unit       || line?.unit     || sourceOrder.unit     || "Meter",
      sourceEstimationId: "", sourceEstimationNo: "",
      sourceOrderId:   sourceOrder.id,
      sourceOrderNo:   sourceOrder.orderNo,
      sourceWorkOrderId:  wo?.id         || "",
      sourceWorkOrderNo:  wo?.workOrderNo || "",
      trimmingSize: wo?.trimmingSize,
      frontColors:  wo?.frontColors,
      backColors:   wo?.backColors,
      status: "Active",
      remarks: editRemark,
    };
    saveCatalogItem(item);
    setCreateOpen(false);
    setCatalogTab("processed");
  };

  // ── Processed table columns ───────────────────────────────
  const processedCols: Column<GravureProductCatalog>[] = [
    { key: "catalogNo",    header: "Catalog No",   sortable: true },
    { key: "productName",  header: "Product Name", sortable: true },
    { key: "customerName", header: "Customer",     sortable: true },
    { key: "sourceOrderNo", header: "Order Ref",
      render: r => <span className="text-xs font-mono text-gray-500">{r.sourceOrderNo || "—"}</span> },
    { key: "sourceWorkOrderNo", header: "WO Ref",
      render: r => r.sourceWorkOrderNo
        ? <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold">{r.sourceWorkOrderNo}</span>
        : <span className="text-xs text-gray-400">—</span> },
    { key: "noOfColors", header: "Colors",
      render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "perMeterRate", header: "Rate/Unit",
      render: r => <span className="font-semibold">₹{r.perMeterRate.toFixed(2)}</span> },
    { key: "status", header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  const stats = { pending: pendingOrders.length, processed: processedCatalog.length };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <BookMarked size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Product Catalog</h2>
          </div>
          <p className="text-sm text-gray-500">
            {stats.pending} orders pending · {stats.processed} in catalog
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
          <Lock size={12} />
          Created from Work Order / Order only
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-4 bg-amber-50 text-amber-700 border-amber-200">
          <p className="text-xs font-medium">Pending (Orders)</p>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </div>
        <div className="rounded-xl border p-4 bg-green-50 text-green-700 border-green-200">
          <p className="text-xs font-medium">Processed (Catalog)</p>
          <p className="text-2xl font-bold mt-1">{stats.processed}</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-gray-100 p-1 rounded-xl gap-1 w-fit">
        {([
          { key: "pending",   label: "Pending",   Icon: Clock,        count: stats.pending   },
          { key: "processed", label: "Processed", Icon: CheckCircle2, count: stats.processed },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setCatalogTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-all
              ${catalogTab === t.key ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
            <t.Icon size={14} />
            {t.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold
              ${catalogTab === t.key ? "bg-purple-100 text-purple-700" : "bg-gray-200 text-gray-600"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ══ PENDING TAB ═══════════════════════════════════════════ */}
      {catalogTab === "pending" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {pendingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <CheckCircle2 size={40} className="text-green-400 mb-3" />
              <p className="font-semibold text-gray-600">All orders have catalog entries!</p>
              <p className="text-sm mt-1">Every order has been converted to a product catalog.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingOrders.map(order => {
                const wo   = workOrders.find(w => w.orderId === order.id);
                const line = order.orderLines?.[0];
                return (
                  <div key={order.id}
                    className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                        <ShoppingCart size={18} className="text-teal-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-800 text-sm truncate">
                          {line?.productName || order.jobName || "—"}
                        </p>
                        <span className="text-xs text-gray-400 font-mono flex-shrink-0">{order.orderNo}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{order.customerName}</span>
                        {(line?.substrate || order.substrate) && (
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                            {line?.substrate || order.substrate}
                          </span>
                        )}
                        <span>{line?.noOfColors || order.noOfColors || 0}C · {line?.printType || order.printType || "—"}</span>
                        <span>{(line?.orderQty || order.quantity || 0).toLocaleString()} {line?.unit || order.unit || "Meter"}</span>
                        <span className="text-gray-400">{order.date}</span>
                      </div>
                      <div className="mt-1.5">
                        {wo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold">
                            <CheckCircle2 size={10} />Work Order: {wo.workOrderNo} — Planning ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs">
                            <AlertCircle size={10} />No Work Order — basic catalog from order data
                          </span>
                        )}
                      </div>
                    </div>
                    {order.totalAmount > 0 && (
                      <div className="flex-shrink-0 text-right">
                        <p className="text-[10px] text-gray-400">Order Total</p>
                        <p className="font-bold text-gray-800 text-sm">₹{order.totalAmount.toLocaleString()}</p>
                        {(line?.rate || order.perMeterRate) > 0 && (
                          <p className="text-xs text-green-600">₹{(line?.rate || order.perMeterRate).toFixed(2)}/{order.unit || "Unit"}</p>
                        )}
                      </div>
                    )}
                    <div className="flex-shrink-0">
                      <Button icon={<BookMarked size={14} />} onClick={() => openCreate(order)}>
                        Create Catalog
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ PROCESSED TAB ═════════════════════════════════════════ */}
      {catalogTab === "processed" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          {processedCatalog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <BookMarked size={40} className="text-gray-300 mb-3" />
              <p className="font-semibold text-gray-600">No catalog entries yet</p>
              <p className="text-sm mt-1">Go to Pending and click Create Catalog on any order.</p>
            </div>
          ) : (
            <DataTable
              data={processedCatalog}
              columns={processedCols}
              searchKeys={["catalogNo", "productName", "customerName", "sourceOrderNo"]}
              actions={row => (
                <div className="flex items-center gap-1.5 justify-end flex-wrap">
                  <Button variant="ghost" size="sm" icon={<Eye size={13} />}
                    onClick={() => setViewPlanRow(row)}>View</Button>
                  <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />}
                    onClick={() => openReplan(row)}
                    className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50">
                    Replan
                  </Button>
                  <Button variant="ghost" size="sm" icon={<ArrowRight size={13} />}
                    onClick={() => window.location.href = "/gravure/orders"}
                    className="text-green-700 hover:text-green-800 hover:bg-green-50">
                    Use in Order
                  </Button>
                  <Button variant="danger" size="sm" icon={<Trash2 size={13} />}
                    onClick={() => setDeleteId(row.id)}>Delete</Button>
                </div>
              )}
            />
          )}
        </div>
      )}

      {/* ══ CREATE CATALOG MODAL ══════════════════════════════════ */}
      {createOpen && sourceOrder && (
        <Modal open={createOpen} onClose={() => setCreateOpen(false)}
          title="Create Product Catalog" size="xl">
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-4 flex flex-wrap gap-4 text-xs">
            <div><p className="text-[10px] text-teal-500 uppercase font-semibold">From Order</p>
              <p className="font-bold text-teal-800">{sourceOrder.orderNo}</p></div>
            <div><p className="text-[10px] text-teal-500 uppercase font-semibold">Customer</p>
              <p className="font-bold text-teal-800">{sourceOrder.customerName}</p></div>
            <div><p className="text-[10px] text-teal-500 uppercase font-semibold">Date</p>
              <p className="font-bold text-teal-800">{sourceOrder.date}</p></div>
            <div className="ml-auto">
              {sourceWO ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle size={13} className="text-green-600" />
                  <span className="text-green-700 font-semibold">Planning from WO: {sourceWO.workOrderNo}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle size={13} className="text-amber-600" />
                  <span className="text-amber-700 font-semibold">No Work Order — catalog from order data</span>
                </div>
              )}
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input label="Product Name *" value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Parle-G Biscuit 100g Wrap" />
              </div>
              <Input label="₹ / Meter Rate" type="number" value={editRate || ""} onChange={e => setEditRate(Number(e.target.value))} placeholder="e.g. 1.36" step={0.01} />
            </div>
            <Textarea label="Remarks / Notes" value={editRemark} onChange={e => setEditRemark(e.target.value)} placeholder="Special notes for this catalog template…" />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Planning Snapshot from Work Order</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded-full text-[10px] font-semibold">
                  <Lock size={9} />READ ONLY
                </span>
              </div>
              {sourceWO ? (
                <PlanViewer plan={{
                  title: "Work Order", refNo: sourceWO.workOrderNo,
                  jobWidth: sourceWO.jobWidth, jobHeight: sourceWO.jobHeight,
                  quantity: sourceWO.quantity, unit: sourceWO.unit,
                  noOfColors: sourceWO.noOfColors,
                  secondaryLayers: sourceWO.secondaryLayers,
                  processes: sourceWO.processes,
                  cylinderCostPerColor: sourceWO.cylinderCostPerColor,
                  overheadPct: sourceWO.overheadPct, profitPct: sourceWO.profitPct,
                  trimmingSize: sourceWO.trimmingSize, frontColors: sourceWO.frontColors, backColors: sourceWO.backColors,
                } satisfies PlanInput} />
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Pill label="Substrate"  value={sourceOrder.orderLines?.[0]?.substrate || sourceOrder.substrate || "—"} cls="bg-indigo-50 text-indigo-700 border-indigo-200" />
                    <Pill label="Print Type" value={sourceOrder.orderLines?.[0]?.printType || sourceOrder.printType || "—"} cls="bg-purple-50 text-purple-700 border-purple-200" />
                    <Pill label="Colors"     value={`${sourceOrder.noOfColors || 0} Colors`} cls="bg-blue-50 text-blue-700 border-blue-200" />
                    <Pill label="Job Width"  value={`${sourceOrder.jobWidth || 0} mm`} />
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                    No Work Order found — catalog will use basic order data. You can Replan after saving.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button icon={<BookMarked size={14} />} onClick={saveCatalog}
              className={!editName.trim() ? "opacity-50 cursor-not-allowed" : ""}>
              Save to Catalog
            </Button>
          </div>
        </Modal>
      )}

      {/* ══ REPLAN / CREATE CATALOG MODAL ═════════════════════════ */}
      {replanOpen && replanForm && (
        <Modal open={replanOpen} onClose={() => { setReplanOpen(false); setReplanForm(null); setIsNewCatalog(false); }}
          title={isNewCatalog ? `Create Catalog — ${replanForm.sourceOrderNo}` : `Replan — ${replanForm.catalogNo}`} size="xl">

          {/* Header info */}
          <div className={`border rounded-xl p-3 mb-4 flex flex-wrap gap-4 text-xs ${isNewCatalog ? "bg-teal-50 border-teal-200" : "bg-purple-50 border-purple-200"}`}>
            <div><p className={`text-[10px] uppercase font-semibold ${isNewCatalog ? "text-teal-500" : "text-purple-500"}`}>Product</p>
              <p className={`font-bold ${isNewCatalog ? "text-teal-800" : "text-purple-800"}`}>{replanForm.productName || "—"}</p></div>
            <div><p className={`text-[10px] uppercase font-semibold ${isNewCatalog ? "text-teal-500" : "text-purple-500"}`}>Customer</p>
              <p className={`font-bold ${isNewCatalog ? "text-teal-800" : "text-purple-800"}`}>{replanForm.customerName}</p></div>
            <div><p className={`text-[10px] uppercase font-semibold ${isNewCatalog ? "text-teal-500" : "text-purple-500"}`}>{isNewCatalog ? "From Order" : "Catalog No"}</p>
              <p className={`font-bold ${isNewCatalog ? "text-teal-800" : "text-purple-800"}`}>{isNewCatalog ? replanForm.sourceOrderNo : replanForm.catalogNo}</p></div>
            {isNewCatalog && replanForm.sourceWorkOrderNo && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-lg self-center">
                <CheckCircle size={12} className="text-green-600" />
                <span className="text-green-700 font-semibold text-[11px]">WO: {replanForm.sourceWorkOrderNo}</span>
              </div>
            )}
          </div>

          {/* Modal Tabs */}
          <div className="flex overflow-x-auto bg-gray-100 p-1 rounded-xl gap-1 mb-4">
            {([
              { key: "info",     label: "① Basic Info"        },
              { key: "planning", label: "② Planning"          },
              { key: "material", label: "③ Production Prep"   },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setReplanTab(t.key)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${replanTab === t.key ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-[65vh] overflow-y-auto pr-1">

            {/* ── Tab 1: Basic Info ── */}
            {replanTab === "info" && (
              <div className="space-y-4">
                <SH label="Product Details" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Input label="Product Name *" value={replanForm.productName}
                      onChange={e => rf("productName", e.target.value)} />
                  </div>
                  <Input label={`Rate / ${replanForm.standardUnit || "Unit"} (₹)`} type="number" value={replanForm.perMeterRate || ""}
                    onChange={e => rf("perMeterRate", Number(e.target.value))} step={0.001} />
                  <Input label="Job Width (mm)" type="number" value={replanForm.jobWidth || ""}
                    onChange={e => rf("jobWidth", Number(e.target.value))} />
                  <Input label="Job Height (mm)" type="number" value={replanForm.jobHeight || ""}
                    onChange={e => rf("jobHeight", Number(e.target.value))} />
                  <Input label="Trimming Size (mm)" type="number" value={replanForm.trimmingSize || ""}
                    onChange={e => rf("trimmingSize", Number(e.target.value))} placeholder="e.g. 118" />
                  <Input label="Front Colors" type="number" value={replanForm.frontColors || ""}
                    onChange={e => rf("frontColors", Number(e.target.value))} min={0} max={12} />
                  <Input label="Back Colors" type="number" value={replanForm.backColors || ""}
                    onChange={e => rf("backColors", Number(e.target.value))} min={0} max={12} />
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Total Colors (Auto)</label>
                    <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl text-sm font-bold text-purple-700">{replanForm.noOfColors} Colors</div>
                  </div>
                  <Select label="Print Type" value={replanForm.printType}
                    onChange={e => rf("printType", e.target.value as GravureProductCatalog["printType"])}
                    options={[{ value: "Surface Print", label: "Surface Print" }, { value: "Reverse Print", label: "Reverse Print" }, { value: "Combination", label: "Combination" }]} />
                  <Input label="Standard Qty" type="number" value={replanForm.standardQty || ""}
                    onChange={e => rf("standardQty", Number(e.target.value))} />
                  <Select label="Unit" value={replanForm.standardUnit}
                    onChange={e => rf("standardUnit", e.target.value)}
                    options={[{ value: "Pcs", label: "Pcs" }, { value: "Kg", label: "Kg" }]} />
                  {/* Category — auto-fills ply configuration */}
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Category (Auto-fill Plys)</label>
                    <select
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400"
                      value={replanForm.categoryId || ""}
                      onChange={e => {
                        if (!e.target.value) { setReplanForm(p => p ? { ...p, categoryId: "", categoryName: "" } : p); return; }
                        const hasPlys = replanForm.secondaryLayers.some(l => l.plyType || l.consumableItems.length > 0);
                        if (hasPlys) { setPendingReplanCategoryId(e.target.value); }
                        else { applyReplanCategory(e.target.value); }
                      }}>
                      <option value="">-- Select Category --</option>
                      {categories.filter(c => c.status === "Active").map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {replanForm.categoryName && (
                      <p className="text-[10px] text-purple-600 mt-1 flex items-center gap-1">
                        <Check size={10} /> {replanForm.categoryName} — {replanForm.secondaryLayers.length} plys auto-loaded
                      </p>
                    )}
                  </div>
                </div>
                <Textarea label="Remarks" value={replanForm.remarks}
                  onChange={e => rf("remarks", e.target.value)} placeholder="Special notes…" />
                <div className="flex justify-end">
                  <Button onClick={() => setReplanTab("planning")}>Next: Planning <ChevronRight size={14} className="ml-1" /></Button>
                </div>
              </div>
            )}

            {/* ── Tab 2: Planning ── */}
            {replanTab === "planning" && (
              <div className="space-y-4">
                {/* Machine */}
                <div>
                  <SH label="Machine" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select label="Printing Machine" value={replanForm.machineId}
                      onChange={e => { const m = PRINT_MACHINES.find(x => x.id === e.target.value); if (m) { rf("machineId", m.id); rf("machineName", m.name); } }}
                      options={[{ value: "", label: "-- Select Machine --" }, ...PRINT_MACHINES.map(m => ({ value: m.id, label: `${m.name} (${m.status})` }))]} />
                  </div>
                </div>

                {/* Process Planning */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <SH label="Process List (from Process Master)" />
                    <button onClick={addReplanProcess} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition">
                      <Plus size={12} /> Add Process
                    </button>
                  </div>
                  {replanForm.processes.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {["Process (Master)", "Charge Unit", "Rate (₹)", "Qty", "Setup (₹)", "Amount (₹)", ""].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {replanForm.processes.map((pr, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 min-w-[200px]">
                                <select value={pr.processId} onChange={e => selectReplanProcess(i, e.target.value)} className={cellInput}>
                                  <option value="">-- Select Process --</option>
                                  {ROTO_PROCESSES.map(pm => <option key={pm.id} value={pm.id}>{pm.name} ({pm.department})</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2"><span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-600 font-mono text-[10px]">{pr.chargeUnit || "—"}</span></td>
                              <td className="px-3 py-2 w-24"><input type="number" value={pr.rate} onChange={e => updateReplanProcess(i, { rate: Number(e.target.value) })} className={`${cellInput} text-right`} step={0.01} /></td>
                              <td className="px-3 py-2 w-24"><input type="number" value={pr.qty} onChange={e => updateReplanProcess(i, { qty: Number(e.target.value) })} className={`${cellInput} text-right`} /></td>
                              <td className="px-3 py-2 w-28"><input type="number" value={pr.setupCharge} onChange={e => updateReplanProcess(i, { setupCharge: Number(e.target.value) })} className={`${cellInput} text-right`} /></td>
                              <td className="px-3 py-2 w-32 text-right font-semibold text-gray-800">₹{pr.amount.toLocaleString()}</td>
                              <td className="px-3 py-2 w-8 text-center"><button onClick={() => removeReplanProcess(i)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><X size={13} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-purple-50 border-t border-purple-200">
                          <tr>
                            <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-purple-700 uppercase">Process Cost</td>
                            <td className="px-3 py-2.5 text-sm font-bold text-purple-800 text-right">₹{replanForm.processes.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl py-5 text-center text-xs text-gray-400">
                      No processes added yet. Click "+ Add Process" to add.
                    </div>
                  )}
                </div>

                {/* Ply Configuration */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <SH label={`Ply Configuration (${replanForm.secondaryLayers.length} plys)`} />
                    <button onClick={() => {
                      const layers = [...replanForm.secondaryLayers];
                      layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                      rf("secondaryLayers", layers);
                    }} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200">
                      <Plus size={12} /> Add Ply
                    </button>
                  </div>

                  {replanForm.secondaryLayers.length > 0 && (
                    <div className="space-y-3">
                      {replanForm.secondaryLayers.map((l, index) => {
                        const thicknesses = FILM_SUBGROUPS.find(s => s.subGroup === l.itemSubGroup)?.thicknesses || [];
                        const consumableDefs = getCategoryConsumables(replanForm.categoryId || "", l.plyType);
                        return (
                          <div key={l.id} className="bg-white border-2 border-purple-50 rounded-2xl shadow-sm relative overflow-hidden">
                            <div className="flex items-center justify-between bg-purple-50 px-4 py-2 border-b border-purple-100">
                              <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                                {l.layerNo === 1 ? "1st" : l.layerNo === 2 ? "2nd" : l.layerNo === 3 ? "3rd" : `${l.layerNo}th`} Ply
                              </span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => rf("secondaryLayers", replanForm.secondaryLayers.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
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
                                        const layers = [...replanForm.secondaryLayers];
                                        const masterRate = parseFloat(FILM_ITEMS.find(fi => fi.subGroup === subGroup)?.estimationRate || "0");
                                        layers[index] = { ...l, itemSubGroup: subGroup, density, thickness: 0, gsm: 0, filmRate: masterRate };
                                        rf("secondaryLayers", layers);
                                      }}>
                                      <option value="">Select Film Type</option>
                                      {FILM_SUBGROUPS.map(opt => <option key={opt.subGroup} value={opt.subGroup}>{opt.subGroup}</option>)}
                                    </select>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                    <Input label="Density" type="number" value={l.density || ""} readOnly className="bg-gray-50 text-gray-400 text-xs" />
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Thickness (μ)</label>
                                      <select className="w-full text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                        value={l.thickness}
                                        onChange={e => {
                                          const thickness = Number(e.target.value);
                                          const layers = [...replanForm.secondaryLayers];
                                          layers[index] = { ...l, thickness, gsm: parseFloat((thickness * l.density).toFixed(3)) };
                                          rf("secondaryLayers", layers);
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
                                          const layers = [...replanForm.secondaryLayers];
                                          layers[index] = { ...l, filmRate: Number(e.target.value) };
                                          rf("secondaryLayers", layers);
                                        }}
                                        placeholder="₹/Kg"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {consumableDefs.length > 0 && (
                                <div className="space-y-3">
                                  {consumableDefs.map((pc, ciIdx) => {
                                    const ci = l.consumableItems[ciIdx] ?? { consumableId: pc.id, fieldDisplayName: pc.fieldDisplayName, itemGroup: pc.itemGroup, itemSubGroup: pc.itemSubGroup, itemId: "", itemName: "", gsm: pc.defaultValue, rate: 0 };
                                    const subGroups: string[] = (CATEGORY_GROUP_SUBGROUP as Record<string, Record<string, string[]>>)["Raw Material (RM)"]?.[pc.itemGroup] ?? [];
                                    const filteredItems = items.filter(i => i.group === pc.itemGroup && i.active && (!ci.itemSubGroup || i.subGroup === ci.itemSubGroup));
                                    return (
                                      <div key={pc.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{pc.fieldDisplayName}</span>
                                          <span className="text-[9px] px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded font-semibold border border-teal-200">{pc.itemGroup}</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Sub Group</label>
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
                                              value={ci.gsm} step={0.1}
                                              onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
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
                {replanForm.machineId && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <SH label="Production Plan Selection" />
                      <div className="flex items-center gap-2">
                        {replanIsPlanApplied && (
                          <button onClick={() => { setReplanIsPlanApplied(false); setReplanShowPlan(true); }} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg border border-gray-200">
                            <RefreshCw size={11} /> Change Plan
                          </button>
                        )}
                        <button onClick={() => setReplanShowPlan(!replanShowPlan)}
                          className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200">
                          <Eye size={12} /> {replanShowPlan ? "Hide Plan" : "Select Plan"}
                        </button>
                      </div>
                    </div>

                    {replanIsPlanApplied && replanSelectedPlan && !replanShowPlan && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-green-700">
                        <CheckCircle2 size={14} className="text-green-600" />
                        Plan applied — UPS: <strong>{replanSelectedPlan.totalUPS}</strong> · Sleeve: {(replanSelectedPlan as any).sleeveCode} {(replanSelectedPlan as any).sleeveWidthVal}mm · Cylinder: {(replanSelectedPlan as any).cylinderCode} · Film: {replanSelectedPlan.filmSize}mm · Total Waste: {replanSelectedPlan.totalWaste}mm · RMT: {replanSelectedPlan.totalRMT}
                      </div>
                    )}

                    {replanShowPlan && !replanIsPlanApplied && (
                      <div className="border-2 border-indigo-100 rounded-2xl overflow-hidden shadow-lg">
                        <div className="bg-gradient-to-r from-indigo-800 to-purple-800 p-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-white font-bold text-xs uppercase tracking-wide">Select Production Plan</p>
                            <p className="text-indigo-200 text-[10px] mt-0.5">{replanForm.machineName} · {replanVisiblePlans.length}/{replanAllPlans.length} plans</p>
                          </div>
                          <input value={replanPlanSearch} onChange={e => setReplanPlanSearch(e.target.value)} placeholder="Search plans..."
                            className="bg-indigo-700 text-white placeholder-indigo-300 text-xs rounded-lg px-3 py-1.5 border border-indigo-500 outline-none focus:ring-2 focus:ring-indigo-400 w-36" />
                          {replanSelPlanId && (
                            <button onClick={() => { setReplanIsPlanApplied(true); setReplanShowPlan(false); }} className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg flex-shrink-0">Apply Plan</button>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-[10px] whitespace-nowrap border-collapse">
                            <thead className="bg-slate-800 text-slate-300">
                              <tr>
                                <th className="p-2 border border-slate-700 text-center">Select</th>
                                {[
                                  { key: "machineName",      label: "Machine" },
                                  { key: "acUps",            label: "AC UPS" },
                                  { key: "printingWidth",    label: "Printing W (mm)" },
                                  { key: "sleeveCode",       label: "Sleeve" },
                                  { key: "sleeveWidthVal",   label: "Sleeve W (mm)" },
                                  { key: "sideWaste",        label: "Side Waste (mm)" },
                                  { key: "filmSize",         label: "Film Size (mm)" },
                                  { key: "deadMargin",       label: "Dead Margin (mm)" },
                                  { key: "totalWaste",       label: "Total Waste (mm)" },
                                  { key: "cylinderCode",     label: "Cylinder" },
                                  { key: "cylinderWidthVal", label: "Cyl W (mm)" },
                                  { key: "totalUPS",         label: "Total UPS" },
                                  { key: "totalRMT",         label: "Total RMT" },
                                ].map(col => (
                                  <th key={col.key} className="p-2 border border-slate-700 text-center cursor-pointer select-none hover:bg-slate-700"
                                    onClick={() => replanTogglePlanSort(col.key)}>
                                    {col.label}{replanPlanSort.key === col.key ? (replanPlanSort.dir === "asc" ? " ▲" : " ▼") : " ⇅"}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                              {replanVisiblePlans.map(plan => {
                                const isSelected = replanSelPlanId === plan.planId;
                                const p = plan as any;
                                return (
                                  <tr key={plan.planId} onClick={() => setReplanSelPlanId(plan.planId)}
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
                              {replanVisiblePlans.length === 0 && (
                                <tr><td colSpan={9} className="p-4 text-center text-gray-400 text-xs">No plans match your search</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        {replanSelPlanId && (
                          <div className="bg-indigo-900 text-indigo-100 px-4 py-2.5 flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-2"><Check size={12} className="text-green-400" /> Plan selected — UPS: {replanSelectedPlan?.totalUPS}</span>
                            <button onClick={() => { setReplanIsPlanApplied(true); setReplanShowPlan(false); }} className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-lg">Apply</button>
                          </div>
                        )}
                      </div>
                    )}

                    {replanIsPlanApplied && replanSelectedPlan && replanForm.secondaryLayers.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-indigo-900">Ply / Layer Calculation — UPS: {replanSelectedPlan.totalUPS} · Film: {replanSelectedPlan.filmSize}mm · Wastage: {replanSelectedPlan.wastage}mm · RMT: {replanSelectedPlan.totalRMT}</p>
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
                                {replanForm.secondaryLayers.map((l, idx) => {
                                  const WASTE_PCT = 0.03;
                                  const rmt = replanSelectedPlan.totalRMT;
                                  const widthM = replanForm.jobWidth / 1000;
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
                                      <td className="p-2 border border-gray-100 text-center font-mono">{replanForm.jobWidth}</td>
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
                                    {replanForm.secondaryLayers.reduce((sum, l) => {
                                      const rmt = replanSelectedPlan.totalRMT;
                                      const reqSQM = rmt * replanForm.jobWidth / 1000;
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
                  <Button variant="secondary" onClick={() => setReplanTab("info")}>← Back</Button>
                  <Button onClick={() => { if (catalogColorShades.length === 0 && replanForm) initCatalogPrepData(replanForm); setCatalogPrepTab("film"); setReplanTab("material"); }}>Next: Production Prep <ChevronRight size={14} className="ml-1" /></Button>
                </div>
              </div>
            )}

            {/* ── Tab 3: Production Preparation ── */}
            {replanTab === "material" && replanForm && (
              <div className="space-y-3">
                {/* Sub-tab bar */}
                <div className="flex overflow-x-auto bg-gray-100 p-1 rounded-xl gap-1">
                  {([
                    { key: "film",     label: "Film Requisition"    },
                    { key: "shade",    label: "Color Shade & LAB"   },
                    { key: "material", label: "Material Allocation" },
                    { key: "tool",     label: "Tool / Cylinder"     },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => setCatalogPrepTab(t.key)}
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${catalogPrepTab === t.key ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ─── Film Requisition ─── */}
                {catalogPrepTab === "film" && (
                <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <Package size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-blue-800">Film & Material Requisition</p>
                    <p className="text-xs text-blue-700 mt-0.5">Select source for each ply — request from Extrusion Unit (internal) or raise a Purchase Request (external vendor).</p>
                  </div>
                </div>

                {replanForm.secondaryLayers.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-gray-400">
                    <Package size={36} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium text-gray-500">No plys configured</p>
                    <p className="text-xs mt-1">Go to Planning tab to add ply layers first.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {replanForm.secondaryLayers.map((l, idx) => {
                      const req: FilmRequisition = catalogFilmReqs[idx] ?? { source: "", status: "Pending" };
                      const reqSQM = (replanForm.standardQty || 0) * ((replanForm.jobWidth || 0) / 1000);
                      const reqWt  = l.gsm > 0 ? parseFloat(((l.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
                      const setReq = (patch: Partial<FilmRequisition>) =>
                        setCatalogFilmReqs(prev => {
                          const next = [...prev];
                          next[idx]  = { ...(next[idx] ?? { source: "", status: "Pending" }), ...patch };
                          return next;
                        });
                      const plyColor =
                        l.plyType === "Film"       ? { hdr: "bg-blue-50 border-blue-100",    badge: "bg-blue-100 text-blue-700 border-blue-200"    } :
                        l.plyType === "Printing"   ? { hdr: "bg-indigo-50 border-indigo-100", badge: "bg-indigo-100 text-indigo-700 border-indigo-200" } :
                        l.plyType === "Lamination" ? { hdr: "bg-orange-50 border-orange-100", badge: "bg-orange-100 text-orange-700 border-orange-200" } :
                                                     { hdr: "bg-green-50 border-green-100",   badge: "bg-green-100 text-green-700 border-green-200"   };
                      return (
                        <div key={l.id} className="bg-white border-2 border-gray-100 rounded-2xl shadow-sm overflow-hidden">
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
                                  <Input label="Required By" type="date" value={req.requiredDate || ""}
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
                                        <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Preferred Vendor</label>
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

                {replanForm.secondaryLayers.length > 0 && catalogFilmReqs.some(r => r?.source) && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-1.5">Requisition Summary</p>
                      <div className="flex gap-2 flex-wrap">
                        <span className="px-2.5 py-1 bg-teal-100 text-teal-700 rounded-full border border-teal-200 text-xs font-semibold">
                          {catalogFilmReqs.filter(r => r?.source === "Extrusion").length} → Extrusion
                        </span>
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full border border-blue-200 text-xs font-semibold">
                          {catalogFilmReqs.filter(r => r?.source === "Purchase").length} → Purchase
                        </span>
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full border border-green-200 text-xs font-semibold">
                          {catalogFilmReqs.filter(r => r?.status === "Requested").length}/{replanForm.secondaryLayers.length} Sent
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setCatalogFilmReqs(prev => prev.map(r => r?.source ? { ...r, status: "Requested" } : r))}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-indigo-700 text-white rounded-xl hover:bg-indigo-800 transition-colors">
                      <Send size={13} /> Send All Requests
                    </button>
                  </div>
                )}

                </div>
                )}

                {/* ─── Color Shade & LAB ─── */}
                {catalogPrepTab === "shade" && (
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
                          <tr>{["#", "Ink Item (Master)", "Color Name", "Type", "Pantone Ref", "L*", "a*", "b*", "ΔE Tol.", "Shade Card Ref", "Status", "Remarks"].map(h => (
                            <th key={h} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {catalogColorShades.map((cs, i) => (
                            <tr key={i} className="hover:bg-purple-50/20">
                              <td className="px-2 py-1.5 text-center font-black text-purple-700">{cs.colorNo}</td>
                              <td className="px-2 py-1.5 min-w-[160px]">
                                <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                  value={(cs as any).inkItemId ?? ""}
                                  onChange={e => {
                                    const ink = INK_ITEMS.find(x => x.id === e.target.value);
                                    setCatalogColorShades(p => p.map((c, ci) => ci === i ? {
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
                              <td className="px-2 py-1.5"><input className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.colorName} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, colorName: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-purple-400" value={cs.inkType} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, inkType: e.target.value as ColorShade["inkType"] } : c))}><option value="Spot">Spot</option><option value="Process">Process</option><option value="Special">Special</option></select></td>
                              <td className="px-2 py-1.5"><input placeholder="PMS 485 C" className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.pantoneRef} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, pantoneRef: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><input type="number" step={0.01} className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-purple-400" value={cs.labL} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, labL: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><input type="number" step={0.01} className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-purple-400" value={cs.labA} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, labA: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><input type="number" step={0.01} className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-purple-400" value={cs.labB} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, labB: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><input type="number" step={0.1} placeholder="1.0" className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-purple-400" value={cs.deltaE} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, deltaE: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><input placeholder="SC-001" className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.shadeCardRef} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, shadeCardRef: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-purple-400" value={cs.status} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, status: e.target.value as ColorShade["status"] } : c))}><option value="Pending">Pending</option><option value="Standard Received">Std. Received</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select></td>
                              <td className="px-2 py-1.5"><input placeholder="Notes…" className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.remarks} onChange={e => setCatalogColorShades(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} /></td>
                            </tr>
                          ))}
                          {catalogColorShades.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-gray-400 text-xs">No colors. Set No. of Colors in Basic Info tab first.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {catalogColorShades.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {(["Pending", "Standard Received", "Approved", "Rejected"] as const).map(s => {
                          const cnt = catalogColorShades.filter(c => c.status === s).length;
                          return cnt > 0 ? <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${s === "Approved" ? "bg-green-50 text-green-700 border-green-200" : s === "Standard Received" ? "bg-blue-50 text-blue-700 border-blue-200" : s === "Rejected" ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{cnt} {s}</span> : null;
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Material Allocation ─── */}
                {catalogPrepTab === "material" && (
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
                          <tr>{["Ply", "Type", "Material", "Req. Qty", "Alloc. Qty", "Unit", "Lot / Batch No.", "Store Location", "Status", "Action"].map(h => (
                            <th key={h} className="px-2 py-2 border border-teal-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {catalogMatAllocs.map((ma, i) => {
                            const itemsForType = items.filter(x => x.group === ma.materialType && x.active);
                            return (
                            <tr key={ma.id} className={`hover:bg-teal-50/20 ${ma.materialType === "Film" ? "bg-blue-50/30 font-medium" : ""}`}>
                              <td className="px-2 py-1.5 text-center font-bold text-teal-700">{ma.plyNo ?? "—"}</td>
                              <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${ma.materialType === "Film" ? "bg-blue-100 text-blue-700 border-blue-200" : ma.materialType === "Ink" ? "bg-violet-100 text-violet-700 border-violet-200" : ma.materialType === "Solvent" ? "bg-orange-100 text-orange-700 border-orange-200" : ma.materialType === "Adhesive" ? "bg-teal-100 text-teal-700 border-teal-200" : "bg-gray-100 text-gray-700 border-gray-200"}`}>{ma.materialType}</span></td>
                              <td className="px-2 py-1.5 min-w-[150px]">
                                <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                  value={(ma as any).itemId ?? ""}
                                  onChange={e => {
                                    const it = itemsForType.find(x => x.id === e.target.value);
                                    setCatalogMatAllocs(p => p.map((m, mi) => mi === i ? { ...m, itemId: it?.id ?? "", materialName: it?.name ?? m.materialName } as any : m));
                                  }}>
                                  <option value="">{ma.materialName || "-- Select Item --"}</option>
                                  {itemsForType.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-1.5 text-center font-mono text-blue-700 font-bold">{ma.requiredQty > 0 ? ma.requiredQty : "—"}</td>
                              <td className="px-2 py-1.5 text-center"><input type="number" step={0.001} className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-teal-400 text-center" value={ma.allocatedQty || ""} onChange={e => setCatalogMatAllocs(p => p.map((m, mi) => mi === i ? { ...m, allocatedQty: Number(e.target.value) } : m))} /></td>
                              <td className="px-2 py-1.5 text-center text-gray-500">{ma.unit}</td>
                              <td className="px-2 py-1.5"><input placeholder="LOT-001" className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-teal-400" value={ma.lotNo} onChange={e => setCatalogMatAllocs(p => p.map((m, mi) => mi === i ? { ...m, lotNo: e.target.value } : m))} /></td>
                              <td className="px-2 py-1.5"><input placeholder="Rack A-3" className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-teal-400" value={ma.location} onChange={e => setCatalogMatAllocs(p => p.map((m, mi) => mi === i ? { ...m, location: e.target.value } : m))} /></td>
                              <td className="px-2 py-1.5 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ma.status === "Allocated" ? "bg-green-50 text-green-700 border-green-200" : ma.status === "Partial" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{ma.status}</span></td>
                              <td className="px-2 py-1.5 text-center"><button onClick={() => setCatalogMatAllocs(p => p.map((m, mi) => mi === i ? { ...m, status: m.allocatedQty > 0 && m.allocatedQty >= m.requiredQty ? "Allocated" : m.allocatedQty > 0 ? "Partial" : "Pending" } : m))} className="px-2.5 py-1 text-[10px] font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-700 whitespace-nowrap">Allocate</button></td>
                            </tr>
                          ); })}
                          {catalogMatAllocs.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-gray-400 text-xs">No materials. Configure plys in Planning tab first.</td></tr>}
                        </tbody>
                        {catalogMatAllocs.length > 0 && (
                          <tfoot className="bg-teal-50 border-t-2 border-teal-200">
                            <tr>
                              <td colSpan={3} className="px-3 py-2 text-right text-teal-800 text-[10px] font-bold uppercase">Totals</td>
                              <td className="px-2 py-2 text-center font-bold text-teal-900 font-mono">{catalogMatAllocs.reduce((s, m) => s + m.requiredQty, 0).toFixed(3)} Kg</td>
                              <td className="px-2 py-2 text-center font-bold text-green-800 font-mono">{catalogMatAllocs.reduce((s, m) => s + m.allocatedQty, 0).toFixed(3)} Kg</td>
                              <td colSpan={5} className="px-3 py-2 text-right"><button onClick={() => setCatalogMatAllocs(p => p.map(m => ({ ...m, allocatedQty: m.requiredQty, status: "Allocated" as const })))} className="px-3 py-1 text-xs font-bold bg-teal-700 text-white rounded-lg hover:bg-teal-800">Allocate All</button></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                )}

                {/* ─── Tool / Cylinder Allocation ─── */}
                {catalogPrepTab === "tool" && (
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                      <Wrench size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-800">Tool & Cylinder Allocation</p>
                        <p className="text-xs text-amber-700 mt-0.5">Assign print cylinders to each color. Track cylinder status, type, and circumference.</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                      <table className="min-w-full text-[11px] border-collapse">
                        <thead className="bg-amber-700 text-white uppercase tracking-wider">
                          <tr>{["Color #", "Color Name", "Cylinder No.", "Circumference (mm)", "Type", "Status", "Remarks"].map(h => (
                            <th key={h} className="px-2 py-2 border border-amber-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {catalogCylAllocs.map((ca, i) => (
                            <tr key={i} className="hover:bg-amber-50/20">
                              <td className="px-2 py-1.5 text-center font-black text-amber-700">{ca.colorNo}</td>
                              <td className="px-2 py-1.5">
                                <div className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg min-w-[100px]">
                                  {catalogColorShades[i]?.colorName || ca.colorName}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 min-w-[200px]">
                                <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400"
                                  value={(ca as any).toolId ?? ""}
                                  onChange={e => {
                                    const tool = CYLINDER_TOOLS_ALL.find(t => t.id === e.target.value);
                                    setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? {
                                      ...c,
                                      toolId: tool?.id ?? "",
                                      cylinderNo: tool?.code ?? c.cylinderNo,
                                      circumference: replanSelectedPlan ? String(replanSelectedPlan.cylCirc) : c.circumference,
                                    } as any : c));
                                  }}>
                                  <option value="">{ca.cylinderNo || "-- Select Cylinder --"}</option>
                                  {CYLINDER_TOOLS_ALL.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name} ({t.printWidth}mm)</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-1.5"><input type="number" className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-amber-400 text-center" value={ca.circumference} onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, circumference: e.target.value } : c))} /></td>
                              <td className="px-2 py-1.5"><select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400" value={ca.cylinderType} onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, cylinderType: e.target.value as CylinderAlloc["cylinderType"] } : c))}><option value="Existing">Existing</option><option value="New">New</option><option value="Rechromed">Rechromed</option></select></td>
                              <td className="px-2 py-1.5"><select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400" value={ca.status} onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, status: e.target.value as CylinderAlloc["status"] } : c))}><option value="Pending">Pending</option><option value="Available">Available</option><option value="In Use">In Use</option><option value="Under Chrome">Under Chrome</option><option value="Ordered">Ordered</option></select></td>
                              <td className="px-2 py-1.5"><input placeholder="Notes…" className="w-32 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-amber-400" value={ca.remarks} onChange={e => setCatalogCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} /></td>
                            </tr>
                          ))}
                          {catalogCylAllocs.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-400 text-xs">No cylinders. Set No. of Colors in Basic Info tab first.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {catalogCylAllocs.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {(["Pending", "Available", "In Use", "Under Chrome", "Ordered"] as const).map(s => {
                          const cnt = catalogCylAllocs.filter(c => c.status === s).length;
                          return cnt > 0 ? <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${s === "Available" ? "bg-green-50 text-green-700 border-green-200" : s === "In Use" ? "bg-blue-50 text-blue-700 border-blue-200" : s === "Under Chrome" ? "bg-orange-50 text-orange-700 border-orange-200" : s === "Ordered" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{cnt} {s}</span> : null;
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="secondary" onClick={() => setReplanTab("planning")}>← Back</Button>
                  <Button icon={<BookMarked size={14} />} onClick={saveReplan}>{isNewCatalog ? "Save to Catalog" : "Save Changes"}</Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ══ VIEW MODAL ════════════════════════════════════════════ */}
      {viewPlanRow && (
        <Modal open={!!viewPlanRow} onClose={() => setViewPlanRow(null)}
          title={`Planning Template — ${viewPlanRow.catalogNo}`} size="xl">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-full font-semibold flex items-center gap-1">
              <Lock size={10} />Locked Template
            </span>
            <span className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-full">{viewPlanRow.customerName}</span>
            <span className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-700 rounded-full font-medium">{viewPlanRow.productName}</span>
            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full font-semibold">{viewPlanRow.noOfColors}C · {viewPlanRow.printType}</span>
            {viewPlanRow.machineName && (
              <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full">{viewPlanRow.machineName}</span>
            )}
            {viewPlanRow.sourceOrderNo && (
              <span className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-full">Order: {viewPlanRow.sourceOrderNo}</span>
            )}
            {viewPlanRow.sourceWorkOrderNo && (
              <span className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full font-semibold">WO: {viewPlanRow.sourceWorkOrderNo}</span>
            )}
          </div>

          {viewPlanRow.remarks && (
            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800">
              <strong>Remarks:</strong> {viewPlanRow.remarks}
            </div>
          )}

          <div className="max-h-[65vh] overflow-y-auto pr-1">
            {viewPlanRow.secondaryLayers?.length > 0 || viewPlanRow.processes?.length > 0 ? (
              <PlanViewer plan={{
                title: "Product Catalog", refNo: viewPlanRow.catalogNo,
                jobWidth:    viewPlanRow.jobWidth,
                jobHeight:   viewPlanRow.jobHeight,
                quantity:    viewPlanRow.standardQty || 1000,
                unit:        viewPlanRow.standardUnit,
                noOfColors:  viewPlanRow.noOfColors,
                secondaryLayers:      viewPlanRow.secondaryLayers,
                processes:            viewPlanRow.processes,
                cylinderCostPerColor: viewPlanRow.cylinderCostPerColor,
                overheadPct: viewPlanRow.overheadPct,
                profitPct:   viewPlanRow.profitPct,
                trimmingSize: viewPlanRow.trimmingSize,
                frontColors:  viewPlanRow.frontColors,
                backColors:   viewPlanRow.backColors,
              } satisfies PlanInput} />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Pill label="Substrate"   value={viewPlanRow.substrate || "—"}    cls="bg-indigo-50 text-indigo-700 border-indigo-200" />
                  <Pill label="Print Type"  value={viewPlanRow.printType || "—"}    cls="bg-purple-50 text-purple-700 border-purple-200" />
                  <Pill label="Colors"      value={`${viewPlanRow.noOfColors}C`}    cls="bg-blue-50 text-blue-700 border-blue-200" />
                  <Pill label="Machine"     value={viewPlanRow.machineName || "—"}  cls="bg-teal-50 text-teal-700 border-teal-200" />
                  <Pill label="Job Width"   value={`${viewPlanRow.jobWidth} mm`} />
                  <Pill label="Job Height"  value={`${viewPlanRow.jobHeight} mm`} />
                  <Pill label="Std Qty"     value={`${viewPlanRow.standardQty.toLocaleString()} ${viewPlanRow.standardUnit}`} />
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-500 text-center">
                  No ply / process detail available. Use Replan to add full planning.
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button icon={<RefreshCw size={14} />} variant="secondary"
              onClick={() => { setViewPlanRow(null); openReplan(viewPlanRow); }}>
              Replan
            </Button>
            <Button icon={<ArrowRight size={14} />} variant="secondary"
              onClick={() => window.location.href = "/gravure/orders"}>
              Use in Order
            </Button>
            <Button variant="secondary" onClick={() => setViewPlanRow(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {/* ══ CATEGORY CHANGE CONFIRM ═══════════════════════════════ */}
      {pendingReplanCategoryId && (
        <Modal open={!!pendingReplanCategoryId} onClose={() => setPendingReplanCategoryId(null)} title="Replace Ply Configuration?" size="sm">
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              Ply details already added. Selecting a new category will <strong>reset your current ply configuration</strong> with the new category&apos;s default plys.
            </div>
            <p className="text-sm text-gray-600">Do you want to replace the ply details with the selected category?</p>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setPendingReplanCategoryId(null)}>No — Keep My Plys</Button>
              <Button onClick={() => { applyReplanCategory(pendingReplanCategoryId!); setPendingReplanCategoryId(null); }}>Yes — Reset Plys</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ DELETE CONFIRM ════════════════════════════════════════ */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Catalog Item" size="sm">
          <p className="text-sm text-gray-600 mb-5">
            This catalog entry will be permanently deleted. The source order will move back to Pending.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteCatalogItem(deleteId); setDeleteId(null); }}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
