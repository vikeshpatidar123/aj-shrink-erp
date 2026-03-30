"use client";
import { useState, useMemo } from "react";
import {
  ChevronRight, ChevronLeft, Plus, X, Save, FileText, Settings,
  Trash2, Edit, Search, Eye, Filter, Download, MoreHorizontal, Check,
  Calculator, Pencil, ArrowRight
} from "lucide-react";
import {
  gravureEstimations as initData, customers, items, machines, processMasters,
  GravureEstimation, GravureEstimationMaterial, GravureEstimationProcess,
  SecondaryLayer, DryWeightRow, PlyConsumableItem,
  CATEGORY_GROUP_SUBGROUP,
  tools as allTools, toolInventory,
} from "@/data/dummyData";
import { useCategories }     from "@/context/CategoriesContext";
import { useEnquiries }      from "@/context/EnquiryContext";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

// ─── Master-filtered lists ────────────────────────────────────
const FILM_ITEMS     = items.filter(i => i.group === "Film"     && i.active);
const INK_ITEMS      = items.filter(i => i.group === "Ink"      && i.active);
const SOLVENT_ITEMS  = items.filter(i => i.group === "Solvent"  && i.active);
const ADHESIVE_ITEMS = items.filter(i => i.group === "Adhesive" && i.active);
const HARDNER_ITEMS  = items.filter(i => i.group === "Hardner"  && i.active);
const ALL_MAT_ITEMS  = [...FILM_ITEMS, ...INK_ITEMS, ...SOLVENT_ITEMS, ...ADHESIVE_ITEMS, ...HARDNER_ITEMS];

const PRINT_MACHINES  = machines.filter(m => m.department === "Printing");

const ROTO_PROCESSES  = processMasters.filter(p => p.module === "Rotogravure");

// ─── Tool inventory helpers ────────────────────────────────
const AVAILABLE_TOOL_IDS = new Set(
  toolInventory.filter(ti => ti.status === "Available").map(ti => ti.toolId)
);
const SLEEVE_TOOLS = allTools
  .filter(t => t.toolType === "Sleeve" && AVAILABLE_TOOL_IDS.has(t.id))
  .sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
const CYLINDER_TOOLS = allTools
  .filter(t => t.toolType === "Cylinder" && AVAILABLE_TOOL_IDS.has(t.id))
  .sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));

// ─── Blank form ───────────────────────────────────────────────
const blank: Omit<GravureEstimation, "id" | "estimationNo"> = {
  date: new Date().toISOString().slice(0, 10),
  categoryId: "", categoryName: "", content: "",
  enquiryId: "", enquiryNo: "",
  customerId: "", customerName: "",
  jobName: "",
  jobWidth: 0, jobHeight: 0, ups: 0,
  trimmingSize: 0,
  actualWidth: 0, actualHeight: 0,
  substrateItemId: "", substrateName: "",
  width: 0, noOfColors: 6, frontColors: 4, backColors: 2,
  printType: "Surface Print",
  quantity: 0, quantities: [], unit: "Kg",
  machineId: "", machineName: "",
  cylinderCostPerColor: 3500,
  cylinderRatePerSqInch: 2.5,
  sleeveWidth: 0,
  repeatLength: 0,
  wastagePct: 1,
  setupTime: 0,
  machineCostPerHour: 1350,
  minimumOrderValue: 0,
  sellingPrice: 0,
  materials: [],
  processes: [],
  overheadPct: 12, profitPct: 15,
  labourCost: 0, transportationCost: 0, interestCost: 0,
  materialCost: 0, processCost: 0, cylinderCost: 0,
  setupCost: 0,
  overheadAmt: 0, profitAmt: 0,
  totalAmount: 0, perMeterRate: 0, marginPct: 0,
  contribution: 0, breakEvenQty: 0,
  secondaryLayers: [],
  dryWeightRows: [],
  dryWeightTotal: 0,
  status: "Draft",
  remarks: "",
  salesPerson: "",
  salesType: "Local",
  concernPerson: "",
};

const STATUS_COLORS: Record<string, string> = {
  Draft:    "bg-gray-100 text-gray-600 border-gray-200",
  Approved: "bg-green-50 text-green-700 border-green-200",
  Sent:     "bg-blue-50 text-blue-700 border-blue-200",
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-600 border-red-200",
};

const GROUP_COLORS: Record<string, string> = {
  Film:     "bg-indigo-50 text-indigo-700 border-indigo-200",
  Ink:      "bg-blue-50  text-blue-700  border-blue-200",
  Adhesive: "bg-orange-50 text-orange-700 border-orange-200",
  Solvent:  "bg-purple-50 text-purple-700 border-purple-200",
  Hardner:  "bg-pink-50  text-pink-700  border-pink-200",
};

// ─── Auto qty for a process based on its chargeUnit ──────────
function autoProcessQty(chargeUnit: string, quantity: number, areaM2: number, noOfColors: number) {
  if (chargeUnit === "m²")       return areaM2;
  if (chargeUnit === "m")        return quantity;
  if (chargeUnit === "Cylinder") return noOfColors;
  if (chargeUnit === "1000 Pcs") return quantity / 1000;
  if (chargeUnit === "Job")      return 1;
  return 0;
}

// ─── Cost calculator ──────────────────────────────────────────
function calcCosts(form: typeof blank) {
  const areaM2 = form.quantity * (form.jobWidth / 1000);

  // 1. Material cost: film + consumables (with ink coverage logic)
  let plyMaterialCost = 0;
  form.secondaryLayers.forEach(l => {
    // Film substrate
    if (l.gsm > 0) {
      const filmRate = l.filmRate ?? parseFloat(FILM_ITEMS.find(i => i.subGroup === l.itemSubGroup)?.estimationRate || "0");
      if (filmRate > 0) plyMaterialCost += (l.gsm * areaM2 / 1000) * filmRate;
    }
    // Consumable items — apply coverage % for all consumables
    l.consumableItems.forEach(ci => {
      if (ci.gsm > 0 && ci.rate > 0) {
        const effectiveGsm = (ci.coveragePct ?? 100) < 100
          ? ci.gsm * ((ci.coveragePct ?? 100) / 100)
          : ci.gsm;
        plyMaterialCost += (effectiveGsm * areaM2 / 1000) * ci.rate;
      }
    });
  });
  const manualMatCost = form.materials.reduce((s, m) => s + m.amount, 0);
  const materialCost  = parseFloat((plyMaterialCost + manualMatCost).toFixed(2));

  // 2. Process cost: rate × qty + setupCharge
  const processCost = parseFloat(
    form.processes.reduce((s, p) => {
      const qty = p.qty > 0 ? p.qty : autoProcessQty(p.chargeUnit, form.quantity, areaM2, form.noOfColors);
      return s + (p.rate * qty + p.setupCharge);
    }, 0).toFixed(2)
  );

  // 3. Cylinder — always full cost (quotation assumes fresh production)
  const cylinderCost = form.cylinderCostPerColor * form.noOfColors;

  // 4. Machine setup cost
  const setupCost = form.setupTime > 0 && form.machineCostPerHour > 0
    ? parseFloat(((form.setupTime / 60) * form.machineCostPerHour).toFixed(2))
    : 0;

  const labourCost       = form.labourCost       || 0;
  const transportationCost = form.transportationCost || 0;
  const interestCost     = form.interestCost     || 0;

  const sub         = materialCost + processCost + cylinderCost + setupCost + labourCost + transportationCost + interestCost;
  const overheadAmt = parseFloat(((sub * form.overheadPct) / 100).toFixed(2));
  const profitBase  = sub + overheadAmt;
  const profitAmt   = parseFloat(((profitBase * form.profitPct) / 100).toFixed(2));
  let   totalAmount = parseFloat((profitBase + profitAmt).toFixed(2));

  // 5. Minimum order value floor
  if (form.minimumOrderValue > 0 && totalAmount < form.minimumOrderValue)
    totalAmount = form.minimumOrderValue;

  const perMeterRate = form.quantity > 0 ? parseFloat((totalAmount / form.quantity).toFixed(4)) : 0;
  const marginPct    = totalAmount > 0 ? parseFloat(((profitAmt / totalAmount) * 100).toFixed(1)) : 0;

  // 6. Contribution & break-even
  const variableCost   = form.quantity > 0 ? parseFloat(((materialCost + processCost) / form.quantity).toFixed(4)) : 0;
  const sellingPriceEff = form.sellingPrice > 0 ? form.sellingPrice : perMeterRate;
  const contribution   = parseFloat((sellingPriceEff - variableCost).toFixed(4));
  const fixedCost      = cylinderCost + setupCost + overheadAmt + labourCost + transportationCost + interestCost;
  const breakEvenQty   = contribution > 0 ? Math.ceil(fixedCost / contribution) : 0;

  return { materialCost, processCost, cylinderCost, setupCost, labourCost, transportationCost, interestCost, overheadAmt, profitAmt, totalAmount, perMeterRate, marginPct, contribution, breakEvenQty };
}

// ─── Detailed breakdown (for Tab 3 display) ──────────────────
type MatLine  = { plyNo: number; plyType: string; name: string; group: string; gsm: number; kg: number; rate: number; amount: number };
type ProcLine = { name: string; chargeUnit: string; qty: number; rate: number; setupCharge: number; amount: number };

function getCostBreakdown(form: typeof blank): { matLines: MatLine[]; procLines: ProcLine[]; areaM2: number } {
  const areaM2   = parseFloat((form.quantity * (form.jobWidth / 1000)).toFixed(2));
  const matLines: MatLine[]   = [];
  const procLines: ProcLine[] = [];

  form.secondaryLayers.forEach((l, idx) => {
    // Film
    if (l.gsm > 0) {
      const filmItem = FILM_ITEMS.find(i => i.subGroup === l.itemSubGroup);
      const rate = l.filmRate ?? parseFloat(filmItem?.estimationRate || "0");
      const kg       = parseFloat((l.gsm * areaM2 / 1000).toFixed(3));
      matLines.push({ plyNo: idx + 1, plyType: l.plyType || "Film", name: l.itemSubGroup || "Film Substrate", group: "Film", gsm: l.gsm, kg, rate, amount: parseFloat((kg * rate).toFixed(2)) });
    }
    // Consumables — apply coverage % for all consumables
    l.consumableItems.forEach(ci => {
      const effectiveGsm = (ci.coveragePct ?? 100) < 100
        ? parseFloat((ci.gsm * ((ci.coveragePct ?? 100) / 100)).toFixed(3))
        : ci.gsm;
      const kg     = parseFloat((effectiveGsm * areaM2 / 1000).toFixed(3));
      const amount = parseFloat((kg * ci.rate).toFixed(2));
      const label  = (ci.coveragePct ?? 100) < 100
        ? `${ci.itemName || ci.fieldDisplayName} (${ci.coveragePct}% cov.)`
        : (ci.itemName || ci.fieldDisplayName);
      matLines.push({ plyNo: idx + 1, plyType: l.plyType || "", name: label, group: ci.itemGroup, gsm: effectiveGsm, kg, rate: ci.rate, amount });
    });
  });

  // Manual extra materials
  form.materials.forEach(m => {
    matLines.push({ plyNo: 0, plyType: "Extra", name: m.itemName, group: m.group, gsm: 0, kg: m.qty, rate: m.rate, amount: m.amount });
  });

  // Processes
  form.processes.forEach(p => {
    const qty    = p.qty > 0 ? p.qty : parseFloat(autoProcessQty(p.chargeUnit, form.quantity, areaM2, form.noOfColors).toFixed(2));
    const amount = parseFloat((p.rate * qty + p.setupCharge).toFixed(2));
    procLines.push({ name: p.processName || "—", chargeUnit: p.chargeUnit, qty, rate: p.rate, setupCharge: p.setupCharge, amount });
  });

  return { matLines, procLines, areaM2 };
}

// ─── Section header ───────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">{label}</p>
  );
}

// Find distinct subGroups from FILM_ITEMS along with their density and available thicknesses
const FILM_SUBGROUPS = Array.from(
  new Map(
    FILM_ITEMS.filter(i => i.subGroup).map(i => [i.subGroup, { 
      subGroup: i.subGroup,
      density: parseFloat(i.density) || 0,
      thicknesses: new Set<number>() 
    }])
  ).entries()
).map(([subGroup, data]) => {
  FILM_ITEMS.filter(i => i.subGroup === subGroup).forEach(i => {
    const t = parseFloat(i.thickness);
    if (!isNaN(t) && t > 0) data.thicknesses.add(t);
  });
  return { subGroup, density: data.density, thicknesses: Array.from(data.thicknesses).sort((a,b)=>a-b) };
});


export default function GravureEstimationPage() {
  const { categories } = useCategories();   // ← live from Category Master
  const { enquiries: allEnquiries } = useEnquiries();  // ← live from Enquiry page
  const gravureEnqList = allEnquiries.filter(e => e.businessUnit === "Gravure");
  const [data, setData]       = useState<GravureEstimation[]>(initData);
  const [modalOpen, setModal] = useState(false);
  const [viewRow, setViewRow] = useState<GravureEstimation | null>(null);
  const [editing, setEditing] = useState<GravureEstimation | null>(null);
  const [form, setForm]       = useState<typeof blank>({ ...blank });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [showPlan, setShowPlan] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string>("");

  // Tab navigation states
  const [activeTab, setActiveTab] = useState<number>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isPlanApplied, setIsPlanApplied] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [planSort, setPlanSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "", dir: "asc" });
  const [extraQtys, setExtraQtys] = useState<number[]>([]);
  const [activeQtyIdx, setActiveQtyIdx] = useState<number>(0); // 0 = base qty
  const [qtyOverrides, setQtyOverrides] = useState<Array<{
    labourCost?: number; transportationCost?: number; interestCost?: number;
    overheadPct?: number; profitPct?: number;
  }>>([]);
  const setQtyOverride = (qi: number, field: string, val: number) => {
    setQtyOverrides(prev => {
      const next = [...prev];
      next[qi] = { ...(next[qi] ?? {}), [field]: val };
      return next;
    });
  };

  // Derived costs (live)
  const costs     = useMemo(() => calcCosts(form), [form]);
  const allQtys   = useMemo(() => [form.quantity, ...extraQtys.filter(q => q > 0)], [form.quantity, extraQtys]);
  const allCosts      = useMemo(() => allQtys.map((qty, qi) => {
    const ov = qtyOverrides[qi] ?? {};
    return calcCosts({
      ...form, quantity: qty,
      labourCost:         ov.labourCost         ?? form.labourCost,
      transportationCost: ov.transportationCost ?? form.transportationCost,
      interestCost:       ov.interestCost       ?? form.interestCost,
      overheadPct:        ov.overheadPct        ?? form.overheadPct,
      profitPct:          ov.profitPct          ?? form.profitPct,
    });
  }), [form, allQtys, qtyOverrides]);
  const allBreakdowns = useMemo(() => allQtys.map(qty => getCostBreakdown({ ...form, quantity: qty })), [form, allQtys]);
  const safeIdx     = Math.min(activeQtyIdx, allCosts.length - 1);
  const activeCosts = allCosts[safeIdx] ?? costs;
  const activeQty   = allQtys[safeIdx] ?? form.quantity;
  // breakdown always reflects the ACTIVE quantity row (Q1/Q2/Q3)
  const breakdown = useMemo(() => getCostBreakdown({ ...form, quantity: activeQty }), [form, activeQty]);

  // ── Production plan rows (Tab 2) ────────────────────────
  const totalPlyGSM = useMemo(() =>
    form.secondaryLayers.reduce((s, l) => s + l.gsm + l.consumableItems.reduce((cs, ci) => cs + (ci.gsm || 0), 0), 0),
    [form.secondaryLayers]);

  const allPlans = useMemo(() => {
    if (!form.actualWidth || form.actualWidth <= 0) return [];
    const machinesToPlan = form.machineId
      ? PRINT_MACHINES.filter(m => m.id === form.machineId)
      : PRINT_MACHINES;

    const rawPlans = machinesToPlan.flatMap(machine => {
      const machineMaxFilm = parseFloat(machine.maxWebWidth) || 1300;
      const baseCirc   = form.jobHeight ? Math.ceil(form.jobHeight / 12) * 12 : 450;
      const laneWidth  = form.actualWidth + (form.trimmingSize || 0);
      const costPerHour = parseFloat(machine.costPerHour as string) || 1350;
      const speed       = parseFloat(machine.speedMax) || 150;

      const trim = form.trimmingSize || 0;
      const repeatUPS = form.jobHeight > 0 ? Math.max(1, Math.floor(baseCirc / form.jobHeight)) : 10;

      // ── LOOP A: Sleeve in stock → find cylinder (or SPECIAL CYLINDER if missing) ──
      const loopA = SLEEVE_TOOLS.flatMap(sleeve => {
        const sleeveWidthVal = parseFloat(sleeve.printWidth);
        if (sleeveWidthVal > machineMaxFilm) return [];
        const maxAcUps = Math.floor(sleeveWidthVal / laneWidth);
        if (maxAcUps === 0) return [];

        return Array.from({ length: maxAcUps }, (_, i) => {
          const acUps         = i + 1;
          const printingWidth = acUps * laneWidth;
          const filmWidth     = printingWidth + 2 * trim;
          if (filmWidth > sleeveWidthVal) return [];

          const req    = filmWidth + 100;
          const minCyl = req < sleeveWidthVal ? req : sleeveWidthVal + 100;
          const validCylinders = CYLINDER_TOOLS.filter(t => parseFloat(t.printWidth) >= minCyl);
          const cylList = validCylinders.length > 0
            ? validCylinders.map(c => ({ id: c.id, name: c.name, code: c.code, printWidth: c.printWidth, repeatLength: c.repeatLength || String(baseCirc), isSpecial: false, isSpecialSleeve: false }))
            : [{ id: "SPECIAL-CYL", name: "Special Order", code: "SPL", printWidth: String(Math.ceil(minCyl)), repeatLength: String(baseCirc), isSpecial: true, isSpecialSleeve: false }];

          const sideWaste  = parseFloat((2 * trim).toFixed(1));
          const deadMargin = parseFloat((sleeveWidthVal - filmWidth).toFixed(1));
          const totalWaste = parseFloat((sideWaste + deadMargin).toFixed(1));
          const totalUPS   = acUps * repeatUPS;
          const reqRMT     = form.quantity > 0 ? Math.ceil(form.quantity / totalUPS) : 1;
          const totalRMT   = Math.ceil(reqRMT * 1.01);
          const totalWt    = parseFloat((totalRMT * (form.actualWidth / 1000) * totalPlyGSM / 1000).toFixed(3));
          const totalTime  = parseFloat((totalRMT / (speed * 60)).toFixed(2));
          const planCost   = parseFloat((totalTime * costPerHour).toFixed(2));

          return cylList.map(cylinder => {
            const cylinderWidthVal = parseFloat(cylinder.printWidth);
            const cylRepeatLength  = parseFloat(cylinder.repeatLength) || baseCirc;
            const cylAreaSqMm      = cylinderWidthVal * cylRepeatLength;
            const cylAreaSqInch    = parseFloat((cylAreaSqMm / 645.16).toFixed(2));
            const rate             = form.cylinderRatePerSqInch ?? 0;
            const cylCostByArea    = parseFloat((cylAreaSqInch * rate * form.noOfColors).toFixed(2));
            const cylCost          = rate > 0 ? cylCostByArea : (form.noOfColors * form.cylinderCostPerColor);
            const grandTotal       = parseFloat((planCost + costs.processCost + cylCost).toFixed(2));
            const unitPrice        = form.quantity > 0 ? parseFloat((grandTotal / form.quantity).toFixed(4)) : 0;
            return {
              planId: `PLAN-${machine.id}-${sleeve.id}-UPS${acUps}-${cylinder.id}`,
              machineId: machine.id, machineName: machine.name,
              filmSize: filmWidth, acUps, printingWidth,
              sleeveId: sleeve.id, sleeveName: sleeve.name, sleeveCode: sleeve.code, sleeveWidthVal,
              cylinderId: cylinder.id, cylinderName: cylinder.name, cylinderCode: cylinder.code,
              cylinderWidthVal, cylRepeatLength, cylAreaSqMm, cylAreaSqInch, cylCostByArea,
              usedWidth: printingWidth, sideWaste, deadMargin, totalWaste,
              cylCirc: baseCirc, repeatUPS, totalUPS,
              reqRMT, totalRMT, totalWt, totalTime, planCost, grandTotal, unitPrice,
              isSpecial: cylinder.isSpecial, isSpecialSleeve: false, isBest: false,
            };
          });
        }).flat();
      });

      // ── LOOP B: Cylinder in stock → find sleeve (or SPECIAL SLEEVE if no sleeve covers filmWidth) ──
      const loopB = CYLINDER_TOOLS.flatMap(cylinder => {
        const cylWidthVal = parseFloat(cylinder.printWidth);
        const maxAcUps    = Math.floor(cylWidthVal / laneWidth);
        if (maxAcUps === 0) return [];

        return Array.from({ length: maxAcUps }, (_, i) => {
          const acUps         = i + 1;
          const printingWidth = acUps * laneWidth;
          const filmWidth     = printingWidth + 2 * trim;
          if (filmWidth > machineMaxFilm) return []; // film too wide for machine

          // Check if any real sleeve already handles this filmWidth (Loop A covers it)
          const realSleeveExists = SLEEVE_TOOLS.some(s => {
            const sw  = parseFloat(s.printWidth);
            if (sw < filmWidth || sw > machineMaxFilm) return false;
            const req = filmWidth + 100;
            const minCyl = req < sw ? req : sw + 100;
            return cylWidthVal >= minCyl;
          });
          if (realSleeveExists) return []; // already in Loop A results

          // No real sleeve → SPECIAL ORDER SLEEVE (ideal width = filmWidth, zero dead margin)
          const specialSleeveW = filmWidth;
          // Validate cylinder for this special sleeve (CASE 2 since filmWidth+100 >= filmWidth)
          if (cylWidthVal < filmWidth + 100) return []; // cylinder too narrow

          const sideWaste  = parseFloat((2 * trim).toFixed(1));
          const deadMargin = 0; // special sleeve = exact filmWidth
          const totalWaste = sideWaste;
          const totalUPS   = acUps * repeatUPS;
          const reqRMT     = form.quantity > 0 ? Math.ceil(form.quantity / totalUPS) : 1;
          const totalRMT   = Math.ceil(reqRMT * 1.01);
          const totalWt    = parseFloat((totalRMT * (form.actualWidth / 1000) * totalPlyGSM / 1000).toFixed(3));
          const totalTime  = parseFloat((totalRMT / (speed * 60)).toFixed(2));
          const planCost   = parseFloat((totalTime * costPerHour).toFixed(2));
          const cylRepeatLength = parseFloat(cylinder.repeatLength) || baseCirc;
          const cylAreaSqMm    = cylWidthVal * cylRepeatLength;
          const cylAreaSqInch  = parseFloat((cylAreaSqMm / 645.16).toFixed(2));
          const rate           = form.cylinderRatePerSqInch ?? 0;
          const cylCostByArea  = parseFloat((cylAreaSqInch * rate * form.noOfColors).toFixed(2));
          const cylCost        = rate > 0 ? cylCostByArea : (form.noOfColors * form.cylinderCostPerColor);
          const grandTotal     = parseFloat((planCost + costs.processCost + cylCost).toFixed(2));
          const unitPrice      = form.quantity > 0 ? parseFloat((grandTotal / form.quantity).toFixed(4)) : 0;

          return [{
            planId: `PLAN-${machine.id}-SPLSLV-UPS${acUps}-${cylinder.id}`,
            machineId: machine.id, machineName: machine.name,
            filmSize: filmWidth, acUps, printingWidth,
            sleeveId: "SPECIAL-SLV", sleeveName: "Special Order", sleeveCode: "SPL-S",
            sleeveWidthVal: specialSleeveW,
            cylinderId: cylinder.id, cylinderName: cylinder.name, cylinderCode: cylinder.code,
            cylinderWidthVal: cylWidthVal, cylRepeatLength, cylAreaSqMm, cylAreaSqInch, cylCostByArea,
            usedWidth: printingWidth, sideWaste, deadMargin, totalWaste,
            cylCirc: baseCirc, repeatUPS, totalUPS,
            reqRMT, totalRMT, totalWt, totalTime, planCost, grandTotal, unitPrice,
            isSpecial: true, isSpecialSleeve: true, isBest: false,
          }];
        }).flat();
      });

      return [...loopA, ...loopB];
    });

    if (rawPlans.length === 0) return rawPlans;

    // ── Sort by waste (special plans mixed in — if waste is less, they come first) ──
    const sorted = [...rawPlans].sort((a, b) =>
      a.totalWaste  !== b.totalWaste  ? a.totalWaste  - b.totalWaste  :
      a.deadMargin  !== b.deadMargin  ? a.deadMargin  - b.deadMargin  :
      a.sideWaste   !== b.sideWaste   ? a.sideWaste   - b.sideWaste   :
      b.acUps       !== a.acUps       ? b.acUps        - a.acUps       :
      0
    );
    return sorted.map((p, idx) => ({ ...p, isBest: !(p.isSpecial) && idx === 0 }));
  }, [form.machineId, form.jobHeight, form.actualWidth, form.trimmingSize, form.quantity, form.noOfColors, form.cylinderCostPerColor, form.cylinderRatePerSqInch, totalPlyGSM, costs.processCost]);

  const selectedPlan = useMemo(() => allPlans.find(p => p.planId === selectedPlanId), [allPlans, selectedPlanId]);

  const visiblePlans = useMemo(() => {
    let rows = allPlans;
    if (planSearch.trim()) {
      const q = planSearch.toLowerCase();
      rows = rows.filter(p =>
        p.machineName.toLowerCase().includes(q) ||
        p.sleeveName.toLowerCase().includes(q) ||
        p.cylinderName.toLowerCase().includes(q) ||
        String(p.acUps).includes(q) ||
        String(p.totalUPS).includes(q) ||
        String(p.sleeveWidthVal).includes(q) ||
        String(p.cylinderWidthVal).includes(q)
      );
    }
    if (planSort.key) {
      rows = [...rows].sort((a, b) => {
        const av = (a as Record<string, unknown>)[planSort.key] as number;
        const bv = (b as Record<string, unknown>)[planSort.key] as number;
        return planSort.dir === "asc" ? av - bv : bv - av;
      });
    }
    return rows;
  }, [allPlans, planSearch, planSort]);

  const togglePlanSort = (key: string) =>
    setPlanSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  const f = (k: keyof typeof blank, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => {
    setEditing(null);
    setForm({ ...blank });
    setActiveTab(1); setExtraQtys([]); setActiveQtyIdx(0);
    setPreviewCode(generateCode(UNIT_CODE.Gravure, MODULE_CODE.Estimation, data.map(d => d.estimationNo)));
    setModal(true);
  };
  const openEdit = (row: GravureEstimation) => {
    setEditing(row);
    const { id, estimationNo, ...rest } = row;
    setForm(rest);
    setActiveTab(1); setExtraQtys([]); setActiveQtyIdx(0);
    setModal(true);
  };

  // ── Material row handlers ─────────────────────────────────
  const addMaterial = () =>
    setForm(p => ({
      ...p,
      materials: [...p.materials, { itemId: "", itemCode: "", itemName: "", group: "", unit: "Kg", rate: 0, qty: 0, amount: 0 }],
    }));

  const removeMaterial = (i: number) =>
    setForm(p => ({ ...p, materials: p.materials.filter((_, idx) => idx !== i) }));

  const updateMaterial = (i: number, patch: Partial<GravureEstimationMaterial>) =>
    setForm(p => ({
      ...p,
      materials: p.materials.map((m, idx) => {
        if (idx !== i) return m;
        const updated = { ...m, ...patch };
        updated.amount = parseFloat((updated.rate * updated.qty).toFixed(2));
        return updated;
      }),
    }));

  const selectMaterialItem = (i: number, itemId: string) => {
    const it = ALL_MAT_ITEMS.find(x => x.id === itemId);
    if (!it) return;
    updateMaterial(i, {
      itemId: it.id, itemCode: it.code, itemName: it.name,
      group: it.group, unit: it.stockUom,
      rate: parseFloat(it.estimationRate) || 0,
    });
  };

  // ── Process row handlers ──────────────────────────────────
  const addProcess = () =>
    setForm(p => ({
      ...p,
      processes: [...p.processes, { processId: "", processName: "", chargeUnit: "", rate: 0, qty: 0, setupCharge: 0, amount: 0 }],
    }));

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
    updateProcess(i, {
      processId: pm.id, processName: pm.name,
      chargeUnit: pm.chargeUnit, rate: parseFloat(pm.rate) || 0,
      setupCharge: pm.makeSetupCharges ? parseFloat(pm.setupChargeAmount) || 0 : 0,
    });
  };

  // ── Category auto-load ────────────────────────────────
  /** Apply a category: auto-build ply rows from its plyConsumables definition */
  const applyCategory = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    const plyOrder = ["Film", "Printing", "Lamination", "Coating"];
    const usedTypes = new Set((cat?.plyConsumables || []).map(pc => pc.plyType));
    const autoTypes = plyOrder.filter(pt => pt === "Film" || usedTypes.has(pt));
    const autoLayers: SecondaryLayer[] = autoTypes.map((plyType, i) => {
      const consumableItems: PlyConsumableItem[] = (cat?.plyConsumables || [])
        .filter(pc => pc.plyType === plyType)
        .map(pc => ({
          consumableId: pc.id,
          fieldDisplayName: pc.fieldDisplayName,
          itemGroup: pc.itemGroup,
          itemSubGroup: pc.itemSubGroup,
          itemId: "", itemName: "",
          gsm: pc.defaultValue,
          rate: 0,
        }));
      return { id: Math.random().toString(), layerNo: i + 1, plyType, itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems };
    });
    setForm(p => ({ ...p, categoryId, categoryName: cat?.name || "", content: "", secondaryLayers: autoLayers }));
  };

  // ── Ply helpers ───────────────────────────────────────
  /** When ply type changes: keep existing consumableItems, just update plyType */
  const onPlyTypeChange = (index: number, plyType: string) => {
    const layers = [...form.secondaryLayers];
    layers[index] = { ...layers[index], plyType };
    f("secondaryLayers", layers);
  };

  /** Add a blank consumable row to a ply (fully manual — no category dependency) */
  const addPlyConsumable = (layerIdx: number) => {
    const layers = [...form.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    layer.consumableItems = [...layer.consumableItems, {
      consumableId: Math.random().toString(),
      fieldDisplayName: "",
      itemGroup: "",
      itemSubGroup: "",
      itemId: "",
      itemName: "",
      gsm: 0,
      rate: 0,
    } as PlyConsumableItem];
    layers[layerIdx] = layer;
    f("secondaryLayers", layers);
  };

  /** Remove a consumable row from a ply */
  const removePlyConsumable = (layerIdx: number, ciIdx: number) => {
    const layers = [...form.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    layer.consumableItems = layer.consumableItems.filter((_, i) => i !== ciIdx);
    layers[layerIdx] = layer;
    f("secondaryLayers", layers);
  };

  /** Update a single field of one consumable item inside a ply */
  const updatePlyConsumable = (layerIdx: number, ciIdx: number, patch: Partial<PlyConsumableItem>) => {
    const layers = [...form.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    const ci = [...layer.consumableItems];
    ci[ciIdx] = { ...ci[ciIdx], ...patch };
    layer.consumableItems = ci;
    layers[layerIdx] = layer;
    f("secondaryLayers", layers);
  };

  // ── Save ─────────────────────────────────────────────────
  const save = () => {
    if (!form.customerId || !form.jobName || !form.machineId) {
      alert("Please fill required Basic Info & Machine."); return;
    }
    if (form.secondaryLayers.length === 0) {
      alert("Please configure Ply Details Composition."); return;
    }
    const substrateName = form.secondaryLayers.map(l => l.itemSubGroup).join(" + ") || "Multiple Plys";

    if (editing) {
      // Update single record — preserve quantities array
      const quantities: number[] = [form.quantity, ...extraQtys.filter(q => q > 0)];
      const record = { ...form, ...costs, substrateName, quantities };
      setData(d => d.map(r => r.id === editing.id ? { ...record, id: editing.id, estimationNo: editing.estimationNo } : r));
    } else {
      // Save single record with all quantities stored inside
      const quantities: number[] = [form.quantity, ...extraQtys.filter(q => q > 0)];
      setData(prev => {
        const estimationNo = generateCode(UNIT_CODE.Gravure, MODULE_CODE.Estimation, prev.map(d => d.estimationNo));
        const id = `GVES${String(prev.length + 1).padStart(3, "0")}`;
        return [...prev, { ...form, ...costs, substrateName, quantities, id, estimationNo }];
      });
    }
    setModal(false);
    setShowPlan(false);
  };

  // ── Stats ────────────────────────────────────────────────
  const stats = {
    total:    data.length,
    draft:    data.filter(e => e.status === "Draft").length,
    approved: data.filter(e => e.status === "Approved").length,
    sent:     data.filter(e => e.status === "Sent" || e.status === "Accepted").length,
    totalAmt: data.reduce((s, e) => s + e.totalAmount, 0),
  };

  const PLY_BADGE_CLS: Record<string, string> = {
    Film:       "bg-sky-100 text-sky-700 border-sky-200",
    Printing:   "bg-indigo-100 text-indigo-700 border-indigo-200",
    Lamination: "bg-orange-100 text-orange-700 border-orange-200",
    Coating:    "bg-green-100 text-green-700 border-green-200",
  };

  const columns: Column<GravureEstimation>[] = [
    { key: "estimationNo",  header: "Estimation No", sortable: true },
    { key: "date",          header: "Date",           sortable: true },
    { key: "customerName",  header: "Customer",       sortable: true },
    { key: "jobName",       header: "Job Name" },
    {
      key: "secondaryLayers", header: "Ply Structure",
      render: r => r.secondaryLayers.length === 0
        ? <span className="text-gray-300 text-xs">—</span>
        : (
          <div className="space-y-1 min-w-[200px]">
            {r.secondaryLayers.map((l, i) => (
              <div key={i} className="flex items-center gap-1 flex-wrap">
                <span className="px-1.5 py-0.5 bg-purple-600 text-white rounded text-[9px] font-black">P{l.layerNo}</span>
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${PLY_BADGE_CLS[l.plyType] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                  {l.plyType || "—"}
                </span>
                {l.itemSubGroup && (
                  <span className="text-[9px] text-gray-700 font-medium">{l.itemSubGroup}</span>
                )}
                {l.thickness > 0 && (
                  <span className="text-[9px] text-gray-400 font-mono">{l.thickness}μ</span>
                )}
                {l.gsm > 0 && (
                  <span className="text-[9px] font-bold text-indigo-600 font-mono">{l.gsm}g</span>
                )}
              </div>
            ))}
          </div>
        ),
    },
    { key: "noOfColors",    header: "Colors", render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "machineName",   header: "Machine", render: r => <span className="text-xs text-gray-600">{r.machineName}</span> },
    { key: "quantity",      header: "Qty", render: r => <span>{r.quantity.toLocaleString()} {r.unit}</span> },
    { key: "perMeterRate",  header: "₹/Kg", render: r => <span className="font-semibold">₹{r.perMeterRate}</span> },
    { key: "totalAmount",   header: "Total (₹)", render: r => <span className="font-bold text-gray-800">₹{r.totalAmount.toLocaleString()}</span> },
    { key: "status",        header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  // ── Inline table cell style ───────────────────────────────
  const cellInput = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Calculator size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Estimation</h2>
          </div>
          <p className="text-sm text-gray-500">{stats.total} estimations · ₹{stats.totalAmt.toLocaleString()} total value</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Estimation</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total",          val: stats.total,    cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Draft",          val: stats.draft,    cls: "bg-gray-50 text-gray-600 border-gray-200" },
          { label: "Approved",       val: stats.approved, cls: "bg-green-50 text-green-700 border-green-200" },
          { label: "Sent/Accepted",  val: stats.sent,     cls: "bg-purple-50 text-purple-700 border-purple-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["estimationNo", "customerName", "jobName"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleteId(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* ══ ADD / EDIT MODAL ══════════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => setModal(false)} title={editing ? "Edit Estimation" : "New Gravure Estimation"} size="xl">
        <div className="flex bg-gray-100 p-1.5 rounded-xl mb-4 sm:mb-6 shadow-inner gap-1 overflow-x-auto">
           <button onClick={() => setActiveTab(1)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${activeTab === 1 ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}><span className="hidden sm:inline">1. Basic Info</span><span className="sm:hidden">① Info</span></button>
           <button onClick={() => setActiveTab(2)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${activeTab === 2 ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}><span className="hidden sm:inline">2. View Plan (Production)</span><span className="sm:hidden">② Plan</span></button>
           <button onClick={() => setActiveTab(3)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${activeTab === 3 ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}><span className="hidden sm:inline">3. Cost Estimation</span><span className="sm:hidden">③ Cost</span></button>
        </div>

        <div>
          {/* TAB 1: BASIC INFO */}
          {activeTab === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* ── Category & Basic Info ─────────────────────────── */}
          <div>
             <SectionHeader label="Identification & Category" />

             {/* Auto-generated Estimation No + Date — always shown, non-editable */}
             <div className="mb-3 flex items-end gap-4 flex-wrap">
               <div>
                 <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1">Estimation No</label>
                 <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-xl w-fit">
                   <span className="text-xs font-mono font-bold text-purple-700 tracking-widest">
                     {editing ? editing.estimationNo : previewCode}
                   </span>
                   <span className="text-[9px] px-1.5 py-0.5 bg-purple-200 text-purple-700 rounded font-semibold">
                     {editing ? "EDITING" : "AUTO"}
                   </span>
                 </div>
               </div>
               <div>
                 <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1">Estimation Date</label>
                 <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 select-none">
                   {new Date(form.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                 </div>
               </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                 <Select
                   label="From Enquiry (optional)"
                   value={form.enquiryId}
                   onChange={e => {
                     const enq = gravureEnqList.find(x => x.id === e.target.value);
                     if (!enq) { f("enquiryId", ""); return; }

                     // ── Category & consumables helper (needs categories from context) ──
                     const plyTypeMap: Record<string, string> = {
                       film: "Film", ink: "Printing", adhesive: "Lamination",
                     };

                     // Build SecondaryLayers from enquiry plys (empty consumableItems — user adds manually)
                     const secondaryLayers: SecondaryLayer[] = (enq.plys || []).map((ply, i) => {
                       const plyType = plyTypeMap[ply.itemQuality] || "Film";
                       return {
                         id: Math.random().toString(),
                         layerNo: i + 1,
                         plyType,
                         itemSubGroup: "",
                         density: 0,
                         thickness: ply.thickness || 0,
                         gsm: ply.gsm || 0,
                         consumableItems: [],
                       };
                     });

                     // Build process rows from enquiry process names
                     const processRows: GravureEstimationProcess[] = (enq.processes || [])
                       .map(name => {
                         const pm = ROTO_PROCESSES.find(p => p.name === name);
                         if (!pm) return null;
                         return {
                           processId: pm.id,
                           processName: pm.name,
                           chargeUnit: pm.chargeUnit,
                           rate: parseFloat(pm.rate) || 0,
                           qty: 0,
                           setupCharge: pm.makeSetupCharges ? parseFloat(pm.setupChargeAmount) || 0 : 0,
                           amount: 0,
                         } as GravureEstimationProcess;
                       })
                       .filter((x): x is GravureEstimationProcess => x !== null);

                     // Total colors from plan window (fallback to noOfColors)
                     const totalColors = (enq.frontColors || 0) + (enq.backColors || 0) || enq.noOfColors;

                     const cat = categories.find(c => c.id === enq.categoryId);

                     setForm(p => ({
                       ...p,
                       enquiryId: enq.id,
                       enquiryNo: enq.enquiryNo,
                       customerId: enq.customerId,
                       customerName: enq.customerName,
                       jobName: enq.jobName,
                       // Category & Content
                       categoryId: enq.categoryId,
                       categoryName: enq.categoryName || cat?.name || "",
                       content: enq.selectedContent || "",
                       // Dimensions
                       jobWidth: enq.planWidth || enq.width || 0,
                       jobHeight: enq.planHeight || 0,
                       width: enq.planWidth || enq.width || 0,
                       actualWidth: (enq.planWidth || enq.width || 0),
                       actualHeight: (enq.planHeight || 0),
                       // Print info
                       noOfColors: totalColors,
                       printType: (["Surface Print", "Reverse Print", "Combination"].includes(enq.printType) ? enq.printType : "Surface Print") as "Surface Print" | "Reverse Print" | "Combination",
                       // Quantity
                       quantity: enq.quantity,
                       unit: enq.uom,
                       // Sales info
                       salesPerson: enq.salesPersonName || "",
                       salesType: enq.salesType === "Domestic" ? "Local" : enq.salesType === "Exporter" ? "Export" : enq.salesType || "Local",
                       concernPerson: enq.concernPerson || "",
                       // Allocation
                       secondaryLayers,
                       processes: processRows,
                     }));
                   }}
                   options={[{ value: "", label: "-- Direct Estimation --" }, ...gravureEnqList.map(e => ({ value: e.id, label: `${e.enquiryNo} – ${e.customerName}` }))]}
                 />
                 <Select
                   label="Customer *"
                   value={form.customerId}
                   onChange={e => {
                     const c = customers.find(x => x.id === e.target.value);
                     f("customerId", e.target.value);
                     if (c) f("customerName", c.name);
                   }}
                   options={[{ value: "", label: "-- Select Customer --" }, ...customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))]}
                 />
                 <Input label="Job Name *" value={form.jobName} onChange={e => f("jobName", e.target.value)} placeholder="Job / carton description" />
                 <Select
                   label="Select Category"
                   value={form.categoryId || ""}
                   onChange={e => {
                     const hasPlys = form.secondaryLayers.some(l => l.plyType || l.consumableItems.length > 0);
                     if (hasPlys && e.target.value) {
                       setPendingCategoryId(e.target.value);
                     } else {
                       applyCategory(e.target.value);
                     }
                   }}
                   options={[{ value: "", label: "-- Select Category --" }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
                 />
                 <Select
                   label="Select Product Type *"
                   value={form.content || ""}
                   onChange={e => f("content", e.target.value)}
                   options={[...(!form.categoryId ? [] : [{ value: "", label: "-- Select Product Type --" }]), ...(categories.find(c => c.id === form.categoryId)?.contents || []).map(ctx => ({ value: ctx, label: ctx }))]}
                   disabled={!form.categoryId || !(categories.find(c => c.id === form.categoryId)?.contents?.length)}
                 />
                  <Select
                    label="Sales Person *"
                    value={form.salesPerson}
                    onChange={e => f("salesPerson", e.target.value)}
                    options={[
                      { value: "", label: "-- Select Sales Person --" },
                      { value: "Rajesh Sharma", label: "Rajesh Sharma" },
                      { value: "Sanjay Gupta",  label: "Sanjay Gupta" },
                      { value: "Anita Desai",   label: "Anita Desai" },
                    ]}
                  />
                  <Select
                    label="Sales Type *"
                    value={form.salesType}
                    onChange={e => f("salesType", e.target.value)}
                    options={[
                      { value: "Local",      label: "Local" },
                      { value: "Inter-State", label: "Inter-State" },
                      { value: "Export",      label: "Export" },
                    ]}
                  />
                  <Input label="Concern Person" value={form.concernPerson} onChange={e => f("concernPerson", e.target.value)} placeholder="Name of concern person" />
             </div>
          </div>

          <div>
              {/* ── Section 1: Planning Specification ─────────────────────────── */}
              <div>
                <SectionHeader label="Planning Specification" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input label="No. of Plys *" type="number"
                    value={form.secondaryLayers.length || ""}
                    onChange={e => {
                      const n = Math.max(0, parseInt(e.target.value) || 0);
                      let layers = [...form.secondaryLayers];
                      if (n > layers.length) {
                        while(layers.length < n) {
                          layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                        }
                  } else if (n < layers.length) {
                    layers = layers.slice(0, n);
                  }
                  f("secondaryLayers", layers);
                }}
              />

                  <Input label="Job Width (mm)" type="number"
                    value={form.jobWidth || ""}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setForm(p => ({ ...p, jobWidth: v, width: v, actualWidth: v }));
                    }}
                  />
                  <Input label="Job Height (mm)" type="number"
                    value={form.jobHeight || ""}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setForm(p => ({ ...p, jobHeight: v, actualHeight: v }));
                    }}
                  />
                  <Input label="Trimming Size (mm)" type="number"
                    value={form.trimmingSize || ""}
                    onChange={e => f("trimmingSize", parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 118"
                  />
                  <Input label="Actual Width" type="number" value={form.actualWidth || ""} onChange={e => f("actualWidth", Number(e.target.value))} />
                  <Input label="Actual Height" type="number" value={form.actualHeight || ""} onChange={e => f("actualHeight", Number(e.target.value))} />
                  <Input label="Front Colors" type="number"
                    value={form.frontColors ?? ""}
                    onChange={e => {
                      const fc = Number(e.target.value) || 0;
                      setForm(p => ({ ...p, frontColors: fc, noOfColors: fc + (p.backColors ?? 0) }));
                    }}
                    min={0} max={12}
                  />
                  <Input label="Back Colors" type="number"
                    value={form.backColors ?? ""}
                    onChange={e => {
                      const bc = Number(e.target.value) || 0;
                      setForm(p => ({ ...p, backColors: bc, noOfColors: (p.frontColors ?? 0) + bc }));
                    }}
                    min={0} max={12}
                  />

              <Select label="Print Type" value={form.printType} onChange={e => f("printType", e.target.value)}
                options={[
                  { value: "Surface Print", label: "Surface Print" },
                  { value: "Reverse Print", label: "Reverse Print" },
                  { value: "Combination",   label: "Combination" },
                ]} />
              {/* ── Quantity directly in Planning section ── */}
              <Input
                label="Quantity (Q1) *"
                type="number"
                value={form.quantity || ""}
                onChange={e => { f("quantity", Number(e.target.value)); setActiveQtyIdx(0); }}
                placeholder="e.g. 200000"
              />
              <Select
                label="Unit"
                value={form.unit}
                onChange={e => f("unit", e.target.value)}
                options={[
                  { value: "Pcs", label: "Pcs" },
                  { value: "Kg",    label: "Kg" },
                ]}
              />
            </div>


            {/* ── Section: Ply Information ── */}
            {form.secondaryLayers.length > 0 && (
              <div className="mt-4 border-t border-purple-100 pt-4">
                <SectionHeader label="Ply Information" />
                <div className="space-y-3">
                  {form.secondaryLayers.map((l, index) => {
                    const thicknesses = FILM_SUBGROUPS.find(s => s.subGroup === l.itemSubGroup)?.thicknesses || [];

                    return (
                      <div key={l.id} className="bg-white border-2 border-purple-50 rounded-2xl shadow-sm relative overflow-hidden">
                        {/* Ply header */}
                        <div className="flex items-center justify-between bg-purple-50 px-4 py-2 border-b border-purple-100">
                          <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                            {l.layerNo === 1 ? "1st" : l.layerNo === 2 ? "2nd" : l.layerNo === 3 ? "3rd" : `${l.layerNo}th`} Ply
                          </span>
                        </div>

                        <div className="p-3 space-y-3">
                          {/* Ply Type select */}
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Ply Type *</label>
                            <select
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400"
                              value={l.plyType}
                              onChange={e => onPlyTypeChange(index, e.target.value)}
                            >
                              <option value="">-- Select Ply Type --</option>
                              <option value="Film">Ply 1</option>
                              <option value="Printing">Ply 2</option>
                              <option value="Lamination">Ply 3</option>
                              <option value="Coating">Ply 4</option>
                            </select>
                          </div>

                          {/* ── Film / Substrate section (always shown once ply type chosen) ── */}
                          {l.plyType && (
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Type</label>
                                <select
                                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
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
                              <div className="grid grid-cols-4 gap-2">
                                <Input label="Density" type="number" value={l.density || ""} readOnly className="bg-gray-50 text-gray-400 text-xs" />
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Thickness (μ)</label>
                                  <select
                                    className="w-full text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
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

                          {/* ── Consumable Items (fully manual — no category dependency) ── */}
                          {l.plyType && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Consumable Items ({l.consumableItems.length})</span>
                                <button
                                  onClick={() => addPlyConsumable(index)}
                                  className="flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 transition">
                                  <Plus size={10} /> Add Consumable
                                </button>
                              </div>

                              {l.consumableItems.map((ci, ciIdx) => {
                                const CONSUMABLE_GROUPS = ["Ink", "Solvent", "Adhesive", "Hardner"];
                                const subGroups = ci.itemGroup ? (CATEGORY_GROUP_SUBGROUP["Raw Material (RM)"]?.[ci.itemGroup] ?? []) : [];
                                const filteredItems = items.filter(it =>
                                  it.group === ci.itemGroup && it.active &&
                                  (!ci.itemSubGroup || it.subGroup === ci.itemSubGroup)
                                );

                                return (
                                  <div key={ci.consumableId} className="bg-teal-50/40 border border-teal-100 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10px] font-bold text-teal-700 uppercase">Consumable {ciIdx + 1}</span>
                                      <button onClick={() => removePlyConsumable(index, ciIdx)}
                                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                        <X size={12} />
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                                      {/* Item Group */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item Group</label>
                                        <select
                                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                          value={ci.itemGroup}
                                          onChange={e => updatePlyConsumable(index, ciIdx, { itemGroup: e.target.value, itemSubGroup: "", itemId: "", itemName: "", coveragePct: undefined })}
                                        >
                                          <option value="">-- Group --</option>
                                          {CONSUMABLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                      </div>
                                      {/* Item Sub Group */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Sub Group</label>
                                        <select
                                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                          value={ci.itemSubGroup}
                                          onChange={e => updatePlyConsumable(index, ciIdx, { itemSubGroup: e.target.value, itemId: "", itemName: "" })}
                                          disabled={!ci.itemGroup}
                                        >
                                          <option value="">-- Sub Group --</option>
                                          {subGroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                                        </select>
                                      </div>
                                      {/* Item from Master */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item (Master)</label>
                                        <select
                                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                          value={ci.itemId}
                                          onChange={e => {
                                            const it = filteredItems.find(x => x.id === e.target.value);
                                            updatePlyConsumable(index, ciIdx, {
                                              itemId: it?.id ?? "",
                                              itemName: it?.name ?? "",
                                              rate: parseFloat(it?.estimationRate ?? "0") || 0,
                                            });
                                          }}
                                          disabled={!ci.itemGroup}
                                        >
                                          <option value="">-- Select Item --</option>
                                          {filteredItems.map(it => (
                                            <option key={it.id} value={it.id}>{it.name}{it.estimationRate ? ` — ₹${it.estimationRate}/Kg` : ""}</option>
                                          ))}
                                        </select>
                                      </div>
                                      {/* GSM / Wet Weight */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">GSM / Wet Wt.</label>
                                        <input
                                          type="number" step={0.1} min={0}
                                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                          value={ci.gsm || ""}
                                          onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })}
                                        />
                                      </div>
                                      {/* Coverage % — always editable */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Coverage %</label>
                                        <input
                                          type="number" step={1} min={1} max={100}
                                          className="w-full text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-blue-50 outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                                          value={ci.coveragePct ?? 100}
                                          onChange={e => updatePlyConsumable(index, ciIdx, { coveragePct: Math.min(100, Math.max(1, Number(e.target.value))) })}
                                          placeholder="100"
                                        />
                                      </div>
                                      {/* Rate — editable, defaults from master */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Rate (₹/Kg)</label>
                                        <input
                                          type="number" step={0.01} min={0}
                                          className="w-full text-xs border border-orange-200 bg-orange-50 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                                          value={ci.rate || ""}
                                          onChange={e => updatePlyConsumable(index, ciIdx, { rate: Number(e.target.value) })}
                                          placeholder="₹/Kg"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {l.consumableItems.length === 0 && (
                                <p className="text-[10px] text-gray-400 italic text-center py-2">Click "+ Add Consumable" to add ink, solvent, adhesive, etc.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
               </div>
             </div>
          </div>
        )}

        {/* TAB 2: PRODUCTION PLAN */}
        {activeTab === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* ── Machine & Cylinder Cost ── */}
            <div>
              <SectionHeader label="Machine & Process Selection" />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <Select label="Printing Machine (Machine Master)"
                    value={form.machineId}
                    onChange={e => {
                      const m = PRINT_MACHINES.find(x => x.id === e.target.value);
                      setForm(p => ({
                        ...p,
                        machineId: e.target.value,
                        machineName: m?.name || "",
                        machineCostPerHour: parseFloat(m?.costPerHour as string) || p.machineCostPerHour,
                      }));
                    }}
                    options={[{ value: "", label: "-- All Machines --" }, ...PRINT_MACHINES.map(m => ({ value: m.id, label: `${m.name} (${m.status}) – ₹${m.costPerHour}/hr` }))]}
                  />
                </div>
                <Input label="Machine Cost / Hr (₹)" type="number" value={form.machineCostPerHour}
                  onChange={e => f("machineCostPerHour", Number(e.target.value))} />
              </div>

              {/* Cylinder cost fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <Input label="Cylinder Cost / Color (₹)" type="number"
                  value={form.cylinderCostPerColor}
                  onChange={e => f("cylinderCostPerColor", Number(e.target.value))} />
                <Input label="Cylinder Rate (₹/sq.inch)" type="number"
                  value={form.cylinderRatePerSqInch ?? ""}
                  onChange={e => f("cylinderRatePerSqInch", Number(e.target.value))}
                  placeholder="e.g. 2.5" />
              </div>

              {/* Summary badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                {(form.cylinderRatePerSqInch ?? 0) > 0 ? (
                  <span className="text-xs px-3 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-full font-semibold">
                    Cylinder costing: area × ₹{form.cylinderRatePerSqInch}/sq.in × {form.noOfColors} colors — shown per plan row
                  </span>
                ) : (
                  <span className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-semibold">
                    Cylinder Cost (per color): ₹{(form.cylinderCostPerColor * form.noOfColors).toLocaleString()} ({form.noOfColors}C × ₹{form.cylinderCostPerColor})
                  </span>
                )}
                {form.setupTime > 0 && (
                  <span className="text-xs px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-semibold">
                    Setup Cost: ₹{((form.setupTime / 60) * form.machineCostPerHour).toFixed(0)} ({form.setupTime} min × ₹{form.machineCostPerHour}/hr)
                  </span>
                )}
              </div>

              {!form.machineId && (
                <p className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  No machine selected — plans will be shown for all {PRINT_MACHINES.length} gravure machines.
                </p>
              )}
            </div>

            {/* ── Process List ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600">Process List (from Process Master)</p>
                <button onClick={addProcess} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition">
                  <Plus size={12} /> Add Process
                </button>
              </div>
              {form.processes.length > 0 ? (
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
                        <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-purple-700 uppercase">Process Cost</td>
                        <td className="px-3 py-2.5 text-sm font-bold text-purple-800 text-right">₹{costs.processCost.toLocaleString()}</td>
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

            {/* ── Production Plan Toggle ── */}
            <div className="flex justify-end">
              <Button onClick={() => { setShowPlan(!showPlan); setIsPlanApplied(false); setSelectedPlanId(null); }} variant="secondary" icon={<Eye size={14} />}>
                {showPlan ? "Hide Production Plan" : "View Production Plan"}
              </Button>
            </div>

            {/* ── Production Plan Selection Table ── */}
            {showPlan && !isPlanApplied && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800">Production Plan Selection</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{form.machineId ? `Machine: ${form.machineName}` : `Showing all ${PRINT_MACHINES.length} gravure machines`} · {visiblePlans.length}/{allPlans.length} plans</p>
                    </div>
                    {selectedPlanId && (
                      <Button onClick={() => setIsPlanApplied(true)} icon={<Check size={13} />}>Apply Selected Plan</Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                    <Search size={13} className="text-gray-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search machine, UPS, circ..."
                      value={planSearch}
                      onChange={e => setPlanSearch(e.target.value)}
                      className="flex-1 text-xs outline-none placeholder-gray-400 bg-transparent"
                    />
                    {planSearch && <button onClick={() => setPlanSearch("")} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
                  </div>
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full text-xs whitespace-nowrap">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 w-8" />
                        {([
                          { label: "Machine",           key: "" },
                          { label: "AC UPS",            key: "acUps" },
                          { label: "Printing W (mm)",   key: "printingWidth" },
                          { label: "Sleeve",            key: "" },
                          { label: "Sleeve W (mm)",     key: "sleeveWidthVal",   waste: true },
                          { label: "Side Waste (mm)",   key: "sideWaste",        waste: true },
                          { label: "Film Size (mm)",    key: "filmSize" },
                          { label: "Dead Margin (mm)",  key: "deadMargin",       waste: true },
                          { label: "Total Waste (mm)",  key: "totalWaste",       waste: true },
                          { label: "Cylinder",          key: "" },
                          { label: "Cylinder W (mm)",   key: "cylinderWidthVal" },
                          { label: "Cyl Circ (mm)",     key: "cylRepeatLength" },
                          { label: "Cyl Area (sq.in)",  key: "cylAreaSqInch" },
                          { label: "Rate (₹/sq.in)",    key: "" },
                          { label: "Cyl Cost (₹)",      key: "cylCostByArea" },
                          { label: "Repeat UPS",        key: "repeatUPS" },
                          { label: "Total UPS",         key: "totalUPS" },
                          { label: "Req. RMT",          key: "reqRMT" },
                          { label: "Total RMT",         key: "totalRMT" },
                          { label: "Total Wt (Kg)",     key: "totalWt" },
                          { label: "Total Time",        key: "totalTime" },
                          { label: "Plan Cost",         key: "planCost" },
                          { label: "Grand Total",       key: "grandTotal" },
                          { label: "Unit Price",        key: "unitPrice" },
                        ] as { label: string; key: string; waste?: boolean }[]).map(col => (
                          <th
                            key={col.label}
                            onClick={() => col.key && togglePlanSort(col.key)}
                            className={`px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider select-none ${col.waste && (form.sleeveWidth ?? 0) > 0 ? "text-orange-600 bg-orange-50" : "text-gray-500"} ${col.key ? "cursor-pointer hover:text-gray-800" : ""}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {col.key && (
                                <span className="text-[9px] text-gray-400">
                                  {planSort.key === col.key ? (planSort.dir === "asc" ? "▲" : "▼") : "⇅"}
                                </span>
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {visiblePlans.map(plan => {
                        const isSel = selectedPlanId === plan.planId;
                        return (
                          <tr key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)}
                            className={`cursor-pointer transition-colors ${(plan as any).isSpecialSleeve ? "bg-rose-50 hover:bg-rose-100" : (plan as any).isSpecial ? "bg-amber-50 hover:bg-amber-100" : plan.isBest ? "ring-2 ring-inset ring-green-400 bg-green-50" : isSel ? "bg-purple-50 hover:bg-purple-100" : "hover:bg-gray-50"}`}>
                            <td className="px-3 py-2.5 w-8">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSel ? "border-purple-600 bg-purple-600" : "border-gray-300"}`}>
                                {isSel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                              {plan.machineName}
                              {plan.isBest && <span className="ml-1.5 px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full">BEST</span>}
                              {(plan as any).isSpecial && !(plan as any).isSpecialSleeve && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">SPECIAL CYL</span>}
                              {(plan as any).isSpecialSleeve && <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full">SPECIAL SLV</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-indigo-700">{plan.acUps}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600 font-mono">{plan.printingWidth}</td>
                            {/* Sleeve */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className={`text-[10px] font-semibold ${(plan as any).isSpecialSleeve ? "text-rose-600" : "text-sky-700"}`}>{plan.sleeveCode}</span>
                                <span className={`text-[9px] truncate max-w-[140px] ${(plan as any).isSpecialSleeve ? "text-rose-500 font-semibold" : "text-gray-500"}`} title={plan.sleeveName}>{plan.sleeveName}</span>
                              </div>
                            </td>
                            <td className={`px-3 py-2.5 text-center font-mono font-semibold ${(plan as any).isSpecialSleeve ? "text-rose-600" : "text-sky-700"}`}>{plan.sleeveWidthVal}</td>
                            <td className={`px-3 py-2.5 text-center font-mono font-semibold ${plan.sideWaste > 30 ? "text-orange-600" : "text-green-600"}`}>{plan.sideWaste}</td>
                            <td className="px-3 py-2.5 text-center text-gray-500 font-mono">{plan.filmSize}</td>
                            <td className={`px-3 py-2.5 text-center font-mono font-semibold ${plan.deadMargin > 100 ? "text-orange-600" : "text-amber-600"}`}>{plan.deadMargin}</td>
                            <td className={`px-3 py-2.5 text-center font-bold ${plan.isBest ? "text-green-700" : plan.totalWaste > 300 ? "text-red-600" : "text-amber-600"}`}>{plan.totalWaste}</td>
                            {/* Cylinder */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className={`text-[10px] font-semibold ${(plan as any).isSpecial ? "text-amber-600" : "text-violet-700"}`}>{plan.cylinderCode}</span>
                                <span className={`text-[9px] truncate max-w-[140px] ${(plan as any).isSpecial ? "text-amber-500 font-semibold" : "text-gray-500"}`} title={plan.cylinderName}>{plan.cylinderName}</span>
                              </div>
                            </td>
                            <td className={`px-3 py-2.5 text-center font-mono font-semibold ${(plan as any).isSpecial ? "text-amber-600" : "text-violet-700"}`}>{plan.cylinderWidthVal}</td>
                            <td className="px-3 py-2.5 text-center font-mono text-gray-500">{plan.cylRepeatLength}</td>
                            <td className="px-3 py-2.5 text-center font-mono text-indigo-600 font-semibold">{plan.cylAreaSqInch}</td>
                            <td className="px-3 py-2.5 text-center text-gray-400 text-[10px]">₹{form.cylinderRatePerSqInch ?? 0}</td>
                            <td className={`px-3 py-2.5 text-center font-bold ${plan.isBest ? "text-green-700" : "text-violet-800"}`}>₹{plan.cylCostByArea.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{plan.repeatUPS}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-gray-800">{plan.totalUPS}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{plan.reqRMT}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{plan.totalRMT}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-blue-600">{plan.totalWt}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{plan.totalTime} hr</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">₹{plan.planCost.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-purple-700">₹{plan.grandTotal.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">₹{plan.unitPrice}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile / Tablet cards */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {visiblePlans.map(plan => {
                    const isSel = selectedPlanId === plan.planId;
                    return (
                      <div key={plan.planId} onClick={() => setSelectedPlanId(plan.planId)}
                        className={`p-3 cursor-pointer transition-colors ${(plan as any).isSpecial ? "bg-amber-50 hover:bg-amber-100" : isSel ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSel ? "border-purple-600 bg-purple-600" : "border-gray-300"}`}>
                              {isSel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-gray-800">{plan.machineName}</span>
                            {plan.isBest && <span className="px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full">BEST</span>}
                            {(plan as any).isSpecial && <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">SPECIAL</span>}
                          </div>
                          </div>
                          <span className={`text-xs font-bold ${isSel ? "text-purple-700" : "text-gray-500"}`}>₹{plan.unitPrice}/m</span>
                        </div>
                        <div className="mb-1.5 text-[10px] flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded border border-sky-200">{plan.sleeveCode} ({plan.sleeveWidthVal}mm)</span>
                          <span className={`px-1.5 py-0.5 rounded border ${(plan as any).isSpecial ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-violet-50 text-violet-700 border-violet-200"}`}>{plan.cylinderCode} ({plan.cylinderWidthVal}×{plan.cylRepeatLength}mm)</span>
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">{plan.cylAreaSqInch} in² · ₹{plan.cylCostByArea.toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-500">
                          <span>AC UPS: <b className="text-indigo-700">{plan.acUps}</b></span>
                          <span>Total UPS: <b className="text-gray-700">{plan.totalUPS}</b></span>
                          <span>RMT: <b className="text-gray-700">{plan.totalRMT}</b></span>
                          <span>Side Waste: <b className="text-orange-600">{plan.sideWaste}mm</b></span>
                          <span>Dead Margin: <b className="text-orange-600">{plan.deadMargin}mm</b></span>
                          <span>Total Waste: <b className={plan.isBest ? "text-green-700" : "text-red-600"}>{plan.totalWaste}mm</b></span>
                          <span>Wt: <b className="text-blue-600">{plan.totalWt} Kg</b></span>
                          <span>Time: <b className="text-gray-700">{plan.totalTime} hr</b></span>
                          <span>Total: <b className="text-purple-700">₹{plan.grandTotal.toLocaleString()}</b></span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedPlanId && (
                  <div className="border-t border-purple-200 bg-purple-50 px-4 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-purple-700 font-medium flex items-center gap-1.5"><Check size={12} className="text-green-600" /> Plan selected — Grand Total: <strong className="text-purple-900">₹{selectedPlan?.grandTotal.toLocaleString()}</strong></span>
                    <Button onClick={() => setIsPlanApplied(true)} icon={<Check size={13} />}>Apply Plan</Button>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* TAB 3: COST ESTIMATION */}
          {activeTab === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* ── Section 3: Multiple Quantity Costing ──────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-bold text-gray-700">Quantity Planning</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Add multiple quantities — each saves as a separate estimation record with its own plan</p>
                  </div>
                  <button
                    onClick={() => setExtraQtys(p => [...p, 0])}
                    className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-xl border border-purple-200 transition">
                    <Plus size={12} /> Add Quantity
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        {["#", "Quantity", "Unit", "Total Cost", "Rate/Kg", ""].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Base quantity row */}
                      <tr
                        onClick={() => setActiveQtyIdx(0)}
                        className={`cursor-pointer transition-colors ${activeQtyIdx === 0 ? "bg-purple-50 ring-1 ring-inset ring-purple-300" : "hover:bg-gray-50"}`}>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 bg-purple-600 text-white rounded text-[10px] font-bold">Q1</span>
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <input
                            type="number"
                            className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-400 bg-white font-mono"
                            value={form.quantity || ""}
                            onChange={e => { f("quantity", Number(e.target.value)); setActiveQtyIdx(0); }}
                            placeholder="Quantity"
                          />
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <select
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                            value={form.unit}
                            onChange={e => f("unit", e.target.value)}>
                            <option value="Pcs">Pcs</option>
                            <option value="Kg">Kg</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-gray-900">₹{allCosts[0]?.totalAmount.toLocaleString() ?? "—"}</td>
                        <td className="px-3 py-2.5 font-semibold text-blue-700">₹{allCosts[0]?.perMeterRate ?? "—"}</td>
                        <td className="px-3 py-2.5 text-[10px] text-purple-600 font-semibold">{activeQtyIdx === 0 ? "● Active" : ""}</td>
                      </tr>

                      {/* Extra quantity rows */}
                      {extraQtys.map((qty, i) => {
                        const c = allCosts[i + 1];
                        const isActive = activeQtyIdx === i + 1;
                        return (
                          <tr key={i}
                            onClick={() => setActiveQtyIdx(i + 1)}
                            className={`cursor-pointer transition-colors ${isActive ? "bg-purple-50 ring-1 ring-inset ring-purple-300" : "hover:bg-gray-50"}`}>
                            <td className="px-3 py-2.5">
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">Q{i + 2}</span>
                            </td>
                            <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                              <input
                                type="number"
                                className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-400 bg-white font-mono"
                                value={qty || ""}
                                onChange={e => {
                                  const v = Number(e.target.value);
                                  setExtraQtys(p => p.map((q, idx) => idx === i ? v : q));
                                  setActiveQtyIdx(i + 1);
                                }}
                                placeholder="Enter quantity"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-gray-500">{form.unit}</td>
                            <td className="px-3 py-2.5 font-bold text-gray-900">{qty > 0 ? `₹${c?.totalAmount.toLocaleString() ?? "—"}` : "—"}</td>
                            <td className="px-3 py-2.5 font-semibold text-blue-700">{qty > 0 ? `₹${c?.perMeterRate ?? "—"}` : "—"}</td>
                            <td className="px-3 py-2.5 flex items-center gap-2">
                              {isActive && <span className="text-[10px] text-purple-600 font-semibold">● Active</span>}
                              <button onClick={e => { e.stopPropagation(); setExtraQtys(p => p.filter((_, idx) => idx !== i)); if (isActive) setActiveQtyIdx(0); }}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                <X size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={7} className="px-3 py-2 text-[10px] text-gray-500">
                          {extraQtys.filter(q => q > 0).length === 0
                            ? "Add quantities above to compare costs at different volumes"
                            : `${1 + extraQtys.filter(q => q > 0).length} quantities — click a row to view its cost breakdown below`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

          {/* ── Material Cost Breakdown ──────────────────────── */}
          <div>
            <SectionHeader label={`Material Cost Breakdown — Area: ${(activeQty * (form.jobWidth / 1000)).toLocaleString()} m² · Qty: ${activeQty.toLocaleString()} ${form.unit}`} />
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
              <table className="min-w-full text-xs whitespace-nowrap">
                <thead style={{ background: "var(--erp-primary)" }} className="text-white">
                  <tr>
                    {["Ply", "Type", "Material / Item", "Group", "GSM / Wet Wt.", "Req. Mtr", "Req. SQM", "Req. Wt (Kg)", "Waste Mtr", "Waste SQM", "Waste Wt (Kg)", "Total Mtr", "Total SQM", "Total Wt (Kg)", "Rate (₹/Kg)", "Amount (₹)"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {breakdown.matLines.length === 0 ? (
                    <tr><td colSpan={16} className="px-4 py-6 text-center text-gray-400">No materials — select items in Ply Information (Tab 1)</td></tr>
                  ) : breakdown.matLines.map((m, i) => {
                    const sizeW = form.jobWidth || 340;
                    // Running meter: plan RMT scaled to activeQty, or activeQty directly
                    const basePlanRMT = isPlanApplied && selectedPlan
                      ? parseFloat((selectedPlan.totalRMT * (activeQty / (form.quantity || 1))).toFixed(2))
                      : activeQty;
                    const reqMtr   = m.plyNo > 0 ? parseFloat(basePlanRMT.toFixed(2)) : 0;
                    const reqSQM   = m.plyNo > 0 ? parseFloat((reqMtr * sizeW / 1000).toFixed(3)) : 0;
                    const reqWt    = m.plyNo > 0 && m.gsm > 0 ? parseFloat((reqSQM * m.gsm / 1000).toFixed(4)) : 0;
                    const wasteFrac = (form.wastagePct || 1) / 100;
                    const wasteMtr = m.plyNo > 0 ? parseFloat((reqMtr * wasteFrac).toFixed(2)) : 0;
                    const wasteSQM = m.plyNo > 0 ? parseFloat((wasteMtr * sizeW / 1000).toFixed(3)) : 0;
                    const wasteWt  = m.plyNo > 0 && m.gsm > 0 ? parseFloat((wasteSQM * m.gsm / 1000).toFixed(4)) : 0;
                    const totalMtr = m.plyNo > 0 ? parseFloat((reqMtr + wasteMtr).toFixed(2)) : 0;
                    const totalSQM = m.plyNo > 0 ? parseFloat((reqSQM + wasteSQM).toFixed(3)) : 0;
                    const totalWt  = m.plyNo > 0 ? parseFloat((reqWt + wasteWt).toFixed(4)) : 0;
                    const isExtra  = m.plyNo === 0;

                    return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold text-purple-700">{m.plyNo > 0 ? `P${m.plyNo}` : "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          m.plyType === "Printing" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          m.plyType === "Lamination" ? "bg-orange-50 text-orange-700 border-orange-200" :
                          m.plyType === "Extra" ? "bg-gray-100 text-gray-600 border-gray-300" :
                          "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>{m.plyType}</span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{m.name}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${GROUP_COLORS[m.group] || "bg-gray-100 text-gray-600"}`}>{m.group}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700">{m.gsm > 0 ? `${m.gsm} g/m²` : "—"}</td>
                      {/* Running Meter columns — only for ply materials, not Extra */}
                      <td className="px-3 py-2 font-mono text-gray-700">{isExtra ? "—" : reqMtr.toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{isExtra ? "—" : reqSQM.toLocaleString()}</td>
                      <td className="px-3 py-2 font-semibold text-blue-700">{isExtra ? m.kg.toFixed(3) : reqWt.toFixed(4)}</td>
                      <td className="px-3 py-2 font-mono text-amber-600">{isExtra ? "—" : wasteMtr.toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-amber-600">{isExtra ? "—" : wasteSQM.toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-amber-600">{isExtra ? "—" : wasteWt.toFixed(4)}</td>
                      <td className="px-3 py-2 font-bold text-gray-800">{isExtra ? "—" : totalMtr.toLocaleString()}</td>
                      <td className="px-3 py-2 font-bold text-gray-800">{isExtra ? "—" : totalSQM.toLocaleString()}</td>
                      <td className="px-3 py-2 font-bold text-purple-700 bg-purple-50/40">{isExtra ? m.kg.toFixed(3) : totalWt.toFixed(4)}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{m.rate > 0 ? `₹${m.rate}` : <span className="text-amber-600 font-semibold">— select item</span>}</td>
                      <td className="px-3 py-2 font-bold text-gray-900">{m.amount > 0 ? `₹${m.amount.toLocaleString()}` : "₹0"}</td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-purple-50 border-t-2 border-purple-200">
                  <tr>
                    <td colSpan={15} className="px-3 py-2.5 text-xs font-bold text-purple-700 uppercase text-right">Total Material Cost</td>
                    <td className="px-3 py-2.5 text-sm font-black text-purple-800">₹{activeCosts.materialCost.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
          </div>

          {/* ── Process Cost Breakdown ────────────────────────── */}
          {breakdown.procLines.length > 0 && (
          <div>
            <SectionHeader label="Process Cost Breakdown (from Process Master)" />
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full text-xs">
                <thead style={{ background: "var(--erp-primary)" }} className="text-white">
                  <tr>
                    {["Process Name", "Charge Unit", "Qty", "Rate (₹)", "Setup (₹)", "Amount (₹)"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {breakdown.procLines.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{p.name}</td>
                      <td className="px-3 py-2"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-mono text-[10px]">{p.chargeUnit}</span></td>
                      <td className="px-3 py-2 font-mono text-gray-700">{p.qty.toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">₹{p.rate}</td>
                      <td className="px-3 py-2 font-mono text-gray-500">{p.setupCharge > 0 ? `₹${p.setupCharge}` : "—"}</td>
                      <td className="px-3 py-2 font-bold text-gray-900">₹{p.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-indigo-700 uppercase text-right">Total Process Cost</td>
                    <td className="px-3 py-2.5 text-sm font-black text-indigo-800">₹{activeCosts.processCost.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          )}

          {/* ── Section 4: Overhead, Profit & Advanced ────────── */}
          <div>
            <SectionHeader label="Overhead, Profit & Pricing" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input label="Overhead (%)" type="number" value={form.overheadPct} onChange={e => f("overheadPct", Number(e.target.value))} />
              <Input label="Profit (%)" type="number" value={form.profitPct} onChange={e => f("profitPct", Number(e.target.value))} />
              <Input label="Wastage %" type="number" step={0.1} value={form.wastagePct}
                onChange={e => f("wastagePct", Number(e.target.value))}
                placeholder="Default 1%" />
              <Input label="Min. Order Value (₹)" type="number" value={form.minimumOrderValue || ""}
                onChange={e => f("minimumOrderValue", Number(e.target.value))}
                placeholder="Floor price" />
            </div>
            {/* Selling price for contribution / break-even */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-gray-100 pt-3">
              <Input label="Selling Price (₹/Kg)" type="number" step={0.01} value={form.sellingPrice || ""}
                onChange={e => f("sellingPrice", Number(e.target.value))}
                placeholder="Optional — for break-even" />
            </div>
          </div>

          {/* ── Section 5: Cost Summary — Comparison Table ──── */}
          <div>
            <SectionHeader label="Cost Summary — All Quantities" />
            <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-auto text-xs border-separate border-spacing-0">
                {/* HEADER */}
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-100 border-b-2 border-r-2 border-gray-300 px-3 py-2.5 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide w-[150px] min-w-[150px]">
                      Cost Item
                    </th>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <th key={qi} className={`border-b-2 border-r border-gray-200 px-3 py-2 text-center w-[180px] min-w-[180px] ${qi === 0 ? "bg-purple-100" : "bg-blue-100"}`}>
                        <div className={`text-[10px] font-black uppercase tracking-wide ${qi === 0 ? "text-purple-700" : "text-blue-700"}`}>
                          {qi === 0 ? "Q1 — Base" : `Q${qi + 1}`}
                          {qi === 0 && <span className="ml-1.5 text-[9px] bg-purple-300 text-purple-900 rounded-full px-1.5 py-0.5 normal-case">BASE</span>}
                        </div>
                        <div className="text-xs font-semibold text-gray-700 mt-0.5 normal-case">{qty.toLocaleString()} {form.unit}</div>
                      </th>
                    ) : null)}
                  </tr>
                </thead>
                <tbody>
                  {/* ── MATERIAL ROWS ── */}
                  {(allBreakdowns[0]?.matLines ?? []).map((m, mi) => (
                    <tr key={`mat-${mi}`} className="hover:bg-blue-50/40">
                      <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5">
                        <p className="font-semibold text-gray-800 truncate max-w-[140px]" title={m.name}>{m.name}</p>
                        {m.plyType && <p className="text-[9px] text-gray-400">{m.plyType}</p>}
                      </td>
                      {allQtys.map((qty, qi) => qty > 0 ? (
                        <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-blue-700 font-semibold">
                          ₹{(allBreakdowns[qi]?.matLines[mi]?.amount ?? 0).toLocaleString()}
                        </td>
                      ) : null)}
                    </tr>
                  ))}

                  {/* Total Material */}
                  <tr className="bg-blue-50">
                    <td className="sticky left-0 z-10 bg-blue-50 border-b-2 border-r-2 border-blue-200 px-3 py-2 text-[10px] font-black text-blue-700 uppercase tracking-wide">
                      Total Material
                    </td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b-2 border-r border-blue-100 px-3 py-2 text-right font-black text-blue-700">
                        ₹{(allCosts[qi]?.materialCost ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Process Cost */}
                  <tr className="hover:bg-purple-50/30">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-gray-700">Process Cost</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-purple-700 font-semibold">
                        ₹{(allCosts[qi]?.processCost ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Cylinder Cost */}
                  <tr className="hover:bg-indigo-50/30">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-gray-700">Cylinder ({form.noOfColors}C)</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-indigo-700 font-semibold">
                        ₹{(allCosts[qi]?.cylinderCost ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Setup Cost */}
                  <tr className="hover:bg-amber-50/30">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-gray-700">Setup Cost</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-amber-700 font-semibold">
                        ₹{(allCosts[qi]?.setupCost ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Labour Cost — editable per qty */}
                  <tr className="bg-lime-50/50">
                    <td className="sticky left-0 z-10 bg-lime-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-lime-800">Labour Cost (₹)</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                        <input
                          type="number" min={0} step={1} placeholder="0"
                          className="w-full text-right text-xs font-semibold text-lime-800 bg-white border border-lime-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-lime-400"
                          value={(qtyOverrides[qi]?.labourCost ?? form.labourCost) || ""}
                          onChange={e => setQtyOverride(qi, "labourCost", Number(e.target.value))}
                        />
                      </td>
                    ) : null)}
                  </tr>

                  {/* Transportation Cost — editable per qty */}
                  <tr className="bg-cyan-50/50">
                    <td className="sticky left-0 z-10 bg-cyan-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-cyan-800">Transport Cost (₹)</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                        <input
                          type="number" min={0} step={1} placeholder="0"
                          className="w-full text-right text-xs font-semibold text-cyan-800 bg-white border border-cyan-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                          value={(qtyOverrides[qi]?.transportationCost ?? form.transportationCost) || ""}
                          onChange={e => setQtyOverride(qi, "transportationCost", Number(e.target.value))}
                        />
                      </td>
                    ) : null)}
                  </tr>

                  {/* Interest Cost — editable per qty */}
                  <tr className="bg-rose-50/50">
                    <td className="sticky left-0 z-10 bg-rose-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-rose-800">Interest Cost (₹)</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                        <input
                          type="number" min={0} step={1} placeholder="0"
                          className="w-full text-right text-xs font-semibold text-rose-800 bg-white border border-rose-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-rose-400"
                          value={(qtyOverrides[qi]?.interestCost ?? form.interestCost) || ""}
                          onChange={e => setQtyOverride(qi, "interestCost", Number(e.target.value))}
                        />
                      </td>
                    ) : null)}
                  </tr>

                  {/* Overhead % — editable per qty */}
                  <tr className="bg-yellow-50/50">
                    <td className="sticky left-0 z-10 bg-yellow-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-yellow-800">Overhead %</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={0} step={0.5}
                            className="w-full text-right text-xs font-semibold text-yellow-800 bg-white border border-yellow-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            value={qtyOverrides[qi]?.overheadPct ?? form.overheadPct}
                            onChange={e => setQtyOverride(qi, "overheadPct", Number(e.target.value))}
                          />
                          <span className="text-[10px] text-yellow-700 font-bold flex-shrink-0">%</span>
                        </div>
                      </td>
                    ) : null)}
                  </tr>

                  {/* Overhead Amount */}
                  <tr className="bg-yellow-50">
                    <td className="sticky left-0 z-10 bg-yellow-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-semibold text-yellow-800 pl-5 text-[11px]">↳ Overhead Amt</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-yellow-100 px-3 py-1.5 text-right text-yellow-700 font-bold">
                        ₹{(allCosts[qi]?.overheadAmt ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Profit % — editable per qty */}
                  <tr className="bg-green-50/50">
                    <td className="sticky left-0 z-10 bg-green-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-green-800">Profit %</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={0} step={0.5}
                            className="w-full text-right text-xs font-semibold text-green-800 bg-white border border-green-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
                            value={qtyOverrides[qi]?.profitPct ?? form.profitPct}
                            onChange={e => setQtyOverride(qi, "profitPct", Number(e.target.value))}
                          />
                          <span className="text-[10px] text-green-700 font-bold flex-shrink-0">%</span>
                        </div>
                      </td>
                    ) : null)}
                  </tr>

                  {/* Profit Amount */}
                  <tr className="bg-green-50">
                    <td className="sticky left-0 z-10 bg-green-50 border-b-2 border-r-2 border-gray-200 px-3 py-1.5 font-semibold text-green-800 pl-5 text-[11px]">↳ Profit Amt</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b-2 border-r border-green-100 px-3 py-1.5 text-right text-green-700 font-bold">
                        ₹{(allCosts[qi]?.profitAmt ?? 0).toLocaleString()}
                      </td>
                    ) : null)}
                  </tr>

                  {/* TOTAL AMOUNT */}
                  <tr className="bg-purple-100">
                    <td className="sticky left-0 z-10 bg-purple-100 border-b-2 border-r-2 border-purple-300 px-3 py-2.5 font-black text-purple-800 uppercase text-[11px] tracking-wide">
                      Total Amount
                    </td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className={`border-b-2 border-r border-purple-200 px-3 py-2.5 text-right font-black text-lg ${qi === 0 ? "text-purple-800" : "text-blue-800"}`}>
                        ₹{(allCosts[qi]?.totalAmount ?? 0).toLocaleString()}
                        {form.minimumOrderValue > 0 && (allCosts[qi]?.totalAmount ?? 0) <= form.minimumOrderValue && (
                          <span className="block text-[9px] text-amber-700 font-bold">MOV</span>
                        )}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Rate / Unit */}
                  <tr className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-gray-700">Rate / Kg</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-gray-800 font-bold">
                        ₹{allCosts[qi]?.perMeterRate ?? "—"}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Contribution */}
                  <tr className="hover:bg-teal-50/30">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-teal-700">Contribution</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-teal-700 font-semibold">
                        {(allCosts[qi]?.contribution ?? 0) > 0 ? `₹${allCosts[qi]?.contribution}` : "—"}
                      </td>
                    ) : null)}
                  </tr>

                  {/* Break-even */}
                  <tr className="hover:bg-orange-50/30">
                    <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-orange-700">Break-even Qty</td>
                    {allQtys.map((qty, qi) => qty > 0 ? (
                      <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-orange-700 font-semibold">
                        {(allCosts[qi]?.breakEvenQty ?? 0) > 0 ? `${allCosts[qi]?.breakEvenQty?.toLocaleString()} ${form.unit}` : "—"}
                      </td>
                    ) : null)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

              <Textarea label="Remarks / Notes" value={form.remarks} onChange={e => f("remarks", e.target.value)} placeholder="Price validity, special terms, notes..." />
            </div>
          )}

        </div>

        <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200">
          <div>
            {activeTab > 1 && <Button variant="secondary" onClick={() => setActiveTab(activeTab - 1)}>Back</Button>}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            {activeTab < 3 ? (
              <Button onClick={() => setActiveTab(activeTab + 1)}>Next</Button>
            ) : (
              <>
                <Button icon={<Calculator size={14} />} onClick={save}>
                  {editing ? "Update Estimation" : "Save Estimation"}
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* ══ VIEW MODAL ════════════════════════════════════════════ */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`${viewRow.estimationNo} — ${viewRow.jobName}`} size="xl">
          <div className="space-y-5 text-sm">

            {/* Header status + date */}
            <div className="flex items-center justify-between">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[viewRow.status]}`}>{viewRow.status}</div>
              <span className="text-xs text-gray-400">{viewRow.date}</span>
            </div>

            {/* Basic Info */}
            <div>
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-2">Basic Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {([
                  ["Estimation No",   viewRow.estimationNo],
                  ["Customer",        viewRow.customerName],
                  ["Job Name",        viewRow.jobName],
                  ["Category",        viewRow.categoryName || "—"],
                  ["Job Size",         viewRow.content || "—"],
                  ["Sales Person",    viewRow.salesPerson || "—"],
                  ["Sales Type",      viewRow.salesType || "—"],
                  ["Concern Person",  viewRow.concernPerson || "—"],
                  ["Enquiry No",      viewRow.enquiryNo || "—"],
                  ["Repeat Length",   viewRow.repeatLength ? `${viewRow.repeatLength} mm` : "—"],
                  ["Wastage %",       `${viewRow.wastagePct ?? 1}%`],
                ] as [string,string][]).map(([k,v]) => (
                  <div key={k} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">{k}</p>
                    <p className="font-semibold text-gray-800 mt-0.5 text-xs">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Planning Specification */}
            <div>
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-2">Planning Specification</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {([
                  ["Job Width",       `${viewRow.jobWidth} mm`],
                  ["Job Height",      `${viewRow.jobHeight} mm`],
                  ["Trimming Size",   viewRow.trimmingSize ? `${viewRow.trimmingSize} mm` : "—"],
                  ["Act. Width",      `${viewRow.actualWidth} mm`],
                  ["Act. Height",     `${viewRow.actualHeight} mm`],
                  ["Front Colors",    `${viewRow.frontColors ?? "—"} C`],
                  ["Back Colors",     `${viewRow.backColors ?? "—"} C`],
                  ["Total Colors",    `${viewRow.noOfColors} C`],
                  ["Print Type",     viewRow.printType],
                  ["Repeat Length",  viewRow.repeatLength ? `${viewRow.repeatLength} mm` : "—"],
                  ["Machine",        viewRow.machineName],
                  ["Quantity",       `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
                  ["Wastage %",      `${viewRow.wastagePct ?? 1}%`],
                  ["Cyl Cost/Color", `₹${viewRow.cylinderCostPerColor}`],
                  ["No. of Plys",    `${viewRow.secondaryLayers.length} ply`],
                ] as [string,string][]).map(([k,v]) => (
                  <div key={k} className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">{k}</p>
                    <p className="font-semibold text-gray-800 mt-0.5 text-xs">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Ply Information */}
            {viewRow.secondaryLayers.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-2">Ply Information</p>
                <div className="space-y-2">
                  {viewRow.secondaryLayers.map((l, i) => (
                    <div key={l.id} className="border border-purple-100 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 bg-purple-50 px-3 py-2 border-b border-purple-100">
                        <span className="text-xs font-bold text-purple-700">Ply {l.layerNo}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          l.plyType === "Film" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                          l.plyType === "Printing" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          l.plyType === "Lamination" ? "bg-orange-50 text-orange-700 border-orange-200" :
                          "bg-green-50 text-green-700 border-green-200"}`}>{l.plyType}</span>
                        <span className="text-xs text-gray-500">{l.itemSubGroup}</span>
                        {l.thickness > 0 && <span className="text-xs text-gray-500">{l.thickness}μ</span>}
                        {l.gsm > 0 && <span className="text-xs font-bold text-purple-700">{l.gsm} GSM</span>}
                      </div>
                      {l.consumableItems.length > 0 && (
                        <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          {l.consumableItems.map((ci, ci_i) => (
                            <div key={ci_i} className="bg-teal-50 border border-teal-100 rounded-lg px-2 py-1.5">
                              <p className="text-[10px] text-gray-400 font-semibold">{ci.itemGroup}</p>
                              <p className="text-xs font-semibold text-gray-800">{ci.itemName || ci.itemSubGroup || "—"}</p>
                              <p className="text-[10px] text-teal-700 font-bold">{ci.gsm} GSM · ₹{ci.rate}/Kg</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Processes */}
            {viewRow.processes.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-2">Process List</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>{["Process", "Unit", "Rate", "Qty", "Setup", "Amount"].map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewRow.processes.map((pr, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-medium text-gray-800">{pr.processName}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-600">{pr.chargeUnit}</td>
                          <td className="px-3 py-2.5 text-gray-700">₹{pr.rate}</td>
                          <td className="px-3 py-2.5 text-gray-700">{pr.qty.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-gray-700">{pr.setupCharge > 0 ? `₹${pr.setupCharge}` : "—"}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-900">₹{pr.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-purple-50 border-t border-purple-200">
                      <tr><td colSpan={5} className="px-3 py-2 text-xs font-bold text-purple-700">Process Total</td><td className="px-3 py-2 font-bold text-purple-800">₹{viewRow.processCost.toLocaleString()}</td></tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Cost Summary */}
            <div>
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-2">Cost Summary</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Material Cost",   val: `₹${viewRow.materialCost.toLocaleString()}`,  cls: "bg-blue-50 border-blue-200" },
                  { label: "Process Cost",    val: `₹${viewRow.processCost.toLocaleString()}`,   cls: "bg-purple-50 border-purple-200" },
                  { label: `Cylinder (${viewRow.noOfColors}C × ₹${viewRow.cylinderCostPerColor})`, val: `₹${viewRow.cylinderCost.toLocaleString()}`, cls: "bg-indigo-50 border-indigo-200" },
                  { label: "Setup Cost",      val: `₹${(viewRow.setupCost || 0).toLocaleString()}`, cls: "bg-amber-50 border-amber-200" },
                  { label: `Overhead (${viewRow.overheadPct}%)`, val: `₹${viewRow.overheadAmt.toLocaleString()}`, cls: "bg-yellow-50 border-yellow-200" },
                  { label: `Profit (${viewRow.profitPct}%)`, val: `₹${viewRow.profitAmt.toLocaleString()}`, cls: "bg-green-50 border-green-200" },
                  { label: "Total Amount",    val: `₹${viewRow.totalAmount.toLocaleString()}`,   cls: "bg-white border-2 border-purple-400" },
                  { label: "Rate / Kg",        val: `₹${viewRow.perMeterRate}`,                   cls: "bg-gray-50 border-gray-200" },
                  { label: "Break-even Qty",  val: viewRow.breakEvenQty > 0 ? `${viewRow.breakEvenQty.toLocaleString()} ${viewRow.unit}` : "—", cls: "bg-orange-50 border-orange-200" },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-3 ${s.cls}`}>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">{s.label}</p>
                    <p className="font-bold text-gray-900 mt-0.5">{s.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {viewRow.remarks && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <strong>Remarks:</strong> {viewRow.remarks}
              </div>
            )}
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <div className="flex gap-2">
              <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => { setViewRow(null); openEdit(viewRow); }}>Edit</Button>
              {viewRow.status === "Approved" && <Button icon={<ArrowRight size={14} />}>Convert to Order</Button>}
            </div>
          </div>
        </Modal>
      )}

      {/* Category Replace Warning */}
      <Modal open={!!pendingCategoryId} onClose={() => setPendingCategoryId(null)} title="Replace Ply Configuration?" size="sm">
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            You have already added ply details. Selecting a category will<br/>
            <strong>reset your current ply configuration.</strong>
          </div>
          <p className="text-sm text-gray-600">Do you want to replace the ply details with the selected category?</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="secondary" onClick={() => setPendingCategoryId(null)}>No — Keep My Plys</Button>
            <Button onClick={() => {
              applyCategory(pendingCategoryId!);
              setPendingCategoryId(null);
            }}>Yes — Reset Plys</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Delete this estimation? This cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setData(d => d.filter(r => r.id !== deleteId)); setDeleteId(null); }}>Delete</Button>
        </div>
      </Modal>

    </div>
  );
}
