/**
 * costingCalc — pure, side-effect-free cost calculation functions for the
 * Gravure Costing Estimation module. Extracted verbatim (unchanged logic)
 * from `app/gravure/costing-estimation/page.tsx`.
 *
 * These are consumed by `hooks/useEstimationInstance.ts`. Kept in a separate
 * file so the math can be unit-tested / reused without pulling in React.
 */
import { GravureEstimation } from "@/data/dummyData";
import { FILM_ITEMS } from "@/components/gravure/costing-estimation/CostingMastersContext";

// ─── Blank form ───────────────────────────────────────────────
export const blank: Omit<GravureEstimation, "id" | "estimationNo"> = {
  date: new Date().toISOString().slice(0, 10),
  categoryId: "", categoryName: "", content: "",
  enquiryId: "", enquiryNo: "",
  customerId: "", customerName: "",
  jobName: "",
  jobWidth: 0, jobHeight: 0, ups: 0,
  trimmingSize: 0, widthShrinkage: 0,
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
  machineShiftHours: 8,
  machineBaseCostPerHour: 1350,
  minimumOrderValue: 0,
  sellingPrice: 0,
  materials: [],
  processes: [],
  overheadPct: 12, profitPct: 15,
  labourCost: 0, transportationCost: 0, interestCost: 0, depreciationCost: 0,
  loanAmount: 0, loanInterestRatePct: 12,
  monthlyLabourSalary: 0, workingDaysPerMonth: 25,
  jobRunHours: 0,
  cylinderCostOverride: undefined as number | undefined,
  setupCostOverride:    undefined as number | undefined,
  packingCostOverride:  undefined as number | undefined,
  packingBoxRate: 80, packingCoilsPerBox: 6, packingCoilWt: 15,
  packingPlugsPerBox: 12, packingPlugRate: 2,
  packingTapeRate: 40, packingTapeMetres: 10,
  packingStretchFilmGm: 200, packingStretchFilmRate: 90,
  materialCost: 0, processCost: 0, cylinderCost: 0,
  setupCost: 0,
  overheadAmt: 0, profitAmt: 0,
  totalAmount: 0, perMeterRate: 0, marginPct: 0,
  contribution: 0, breakEvenQty: 0,
  // Pouch / Sleeve seal geometry
  topSeal: 0, bottomSeal: 0, sideSeal: 0, centerSealWidth: 0,
  sideGusset: 0, gusset: 0, seamingArea: 0, transparentArea: 0,
  // Pouch accessory flags
  hasZipper: false, hasSpout: false, hasValve: false,
  hasWindow: false, hasTearNotch: false, hasEuroHole: false, hasRoundCorner: false,
  laminationPlies: 0, zipperWeight: 0, spoutWeight: 0,
  // Product identity
  packSize: "", brandName: "", productType: "", skuType: "",
  bottleType: "", addressType: "", artworkName: "", specialSpecs: "",
  // Roll specs
  finalRollOD: 0, rollUnit: "", unwindDirection: "",
  secondaryLayers: [],
  dryWeightRows: [],
  dryWeightTotal: 0,
  plyStructureText: "",
  status: "Draft",
  remarks: "",
  salesPerson: "",
  salesType: "Local",
  concernPerson: "",
};

// ─── Auto qty for a process based on its chargeUnit ──────────
// lengthM = meters of film, areaM2 = m², weightKg = total weight in Kg
// Handles both raw units ("Kg") and Rate/X format from Process Master ("Rate/Kg")
export function autoProcessQty(chargeUnit: string, lengthM: number, areaM2: number, weightKg: number, noOfColors: number) {
  const u = (chargeUnit || "").toLowerCase().replace(/\s+/g, "");
  if (u.includes("kg"))                      return weightKg;
  if (u.includes("m²") || u.includes("sqm") || u.includes("m2")) return areaM2;
  if (u === "m" || u === "rate/m" || u === "per m" || u.endsWith("/m")) return lengthM;
  if (u.includes("cylinder") || u.includes("color") || u.includes("colour")) return noOfColors;
  if (u.includes("1000pcs") || u.includes("1000 pcs")) return lengthM / 1000;
  if (u.includes("job"))                     return 1;
  return 0; // unknown / custom → use manual p.qty
}

// ─── Convert form.quantity to meter/area/weight based on unit ─
export function resolveQuantities(form: { quantity: number; unit: string; jobWidth: number; secondaryLayers: { gsm: number; consumableItems: { gsm: number }[] }[] }) {
  const totalGSM = form.secondaryLayers.reduce((s, l) =>
    s + (l.gsm || 0) + l.consumableItems.reduce((cs, ci) => cs + (ci.gsm || 0), 0), 0);
  const w = form.jobWidth || 0;
  if (form.unit === "Kg") {
    const weightKg = form.quantity;
    const areaM2   = totalGSM > 0 ? weightKg * 1000 / totalGSM : 0;
    const lengthM  = w > 0 ? areaM2 * 1000 / w : 0;
    return { lengthM, areaM2, weightKg };
  }
  // Default: Meter
  const lengthM  = form.quantity;
  const areaM2   = lengthM * (w / 1000);
  const weightKg = totalGSM > 0 ? areaM2 * totalGSM / 1000 : 0;
  return { lengthM, areaM2, weightKg };
}

// ─── Rate option maps passed from component (live API rates) ──
export type RateOptions = {
  filmRateMap?: Record<string, number>;      // itemSubGroupName → EstimationRate
  processMinChargeMap?: Record<string, number>; // processId → MinimumCharges
};

// ─── Cost calculator ──────────────────────────────────────────
export function calcCosts(form: typeof blank, opts?: RateOptions) {
  const { lengthM, areaM2, weightKg } = resolveQuantities(form);

  // 1. Material cost: film + consumables (with ink coverage logic)
  let plyMaterialCost = 0;
  form.secondaryLayers.forEach(l => {
    // Film substrate — priority: user-entered filmRate → live API rate → dummy fallback
    if (l.gsm > 0) {
      const filmRate = (l.filmRate && l.filmRate > 0)
        ? l.filmRate
        : (opts?.filmRateMap?.[l.itemSubGroup] ?? parseFloat(FILM_ITEMS.find(i => i.subGroup === l.itemSubGroup)?.estimationRate || "0"));
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

  // 2. Process cost: rate × qty + setupCharge, floored by MinimumCharges from master
  const processCost = parseFloat(
    form.processes.reduce((s, p) => {
      const autoQty = autoProcessQty(p.chargeUnit, lengthM, areaM2, weightKg, form.noOfColors);
      const qty = autoQty > 0 ? autoQty : (p.qty || 0);
      const rawCost = p.rate * qty + (p.setupCharge || 0);
      const minCharge = opts?.processMinChargeMap?.[String(p.processId)] ?? 0;
      return s + Math.max(rawCost, minCharge);
    }, 0).toFixed(2)
  );

  // 3. Cylinder — area-based (rate/sqin × area × colors) when rate is set; else per-color fixed rate
  const cylinderCostByArea = (() => {
    const rate = (form as any).cylinderRatePerSqInch ?? 0;
    if (rate <= 0) return 0;
    const w    = (form as any).actualWidth || form.jobWidth || 0;
    // repeatLength is the cylinder circumference; fall back to jobHeight if not set
    const circ = (form as any).repeatLength || form.jobHeight || 0;
    if (w <= 0 || circ <= 0) return 0;
    const areaSqInch = parseFloat(((w * circ) / 645.16).toFixed(4));
    return parseFloat((areaSqInch * rate * form.noOfColors).toFixed(2));
  })();
  const cylinderCost = form.cylinderCostOverride !== undefined && form.cylinderCostOverride > 0
    ? form.cylinderCostOverride
    : cylinderCostByArea > 0
      ? cylinderCostByArea
      : form.cylinderCostPerColor * form.noOfColors;

  // 4. Machine setup cost; per-qty override supported
  const setupCostCalc = form.setupTime > 0 && form.machineCostPerHour > 0
    ? parseFloat(((form.setupTime / 60) * form.machineCostPerHour).toFixed(2))
    : 0;
  const setupCost = form.setupCostOverride !== undefined && form.setupCostOverride > 0
    ? form.setupCostOverride
    : setupCostCalc;

  const labourCost         = form.labourCost         || 0;
  const transportationCost = form.transportationCost || 0;
  const interestCost       = form.interestCost       || 0;
  const depreciationCost   = form.depreciationCost   || 0;

  // Packing cost (reference formula: box + plugs + tape + stretch film → ₹/kg → total)
  const boxWt           = (form.packingCoilsPerBox || 0) * (form.packingCoilWt || 0);
  const plugCostBox     = (form.packingPlugsPerBox || 0) * (form.packingPlugRate || 0);
  const tapeRolls       = (form.packingTapeMetres || 0) / 130;
  const tapeCostBox     = tapeRolls * (form.packingTapeRate || 0);
  const sfCostBox       = ((form.packingStretchFilmGm || 0) / 1000) * (form.packingStretchFilmRate || 0);
  const packPerBox      = (form.packingBoxRate || 0) + plugCostBox + tapeCostBox + sfCostBox;
  const packingPerKg    = boxWt > 0 ? packPerBox / boxWt : 0;
  const packingCostCalc = parseFloat((packingPerKg * weightKg).toFixed(2));
  const packingCost     = form.packingCostOverride !== undefined && form.packingCostOverride > 0
    ? form.packingCostOverride
    : packingCostCalc;

  const sub         = materialCost + processCost + cylinderCost + setupCost + labourCost + transportationCost + interestCost + packingCost + depreciationCost;
  const overheadAmt = parseFloat(((sub * form.overheadPct) / 100).toFixed(2));
  const profitBase  = sub + overheadAmt;
  const profitAmt   = parseFloat(((profitBase * form.profitPct) / 100).toFixed(2));
  let   totalAmount = parseFloat((profitBase + profitAmt).toFixed(2));

  // 5. Minimum order qty floor — if actual qty < min order qty, rate is based on min qty
  const effectiveQtyForRate = (form.minimumOrderValue > 0 && form.quantity > 0 && form.quantity < form.minimumOrderValue)
    ? form.minimumOrderValue
    : form.quantity;

  const perMeterRate = effectiveQtyForRate > 0 ? parseFloat((totalAmount / effectiveQtyForRate).toFixed(4)) : 0;
  const perMeterRateWithoutProfit = effectiveQtyForRate > 0 ? parseFloat(((totalAmount - profitAmt) / effectiveQtyForRate).toFixed(4)) : 0;
  const marginPct    = totalAmount > 0 ? parseFloat(((profitAmt / totalAmount) * 100).toFixed(1)) : 0;

  // 6. Contribution & break-even (per unit — same unit as form.quantity)
  const variableCost   = form.quantity > 0 ? parseFloat(((materialCost + processCost) / form.quantity).toFixed(4)) : 0;
  const sellingPriceEff = form.sellingPrice > 0 ? form.sellingPrice : perMeterRate;
  const contribution   = parseFloat((sellingPriceEff - variableCost).toFixed(4));
  const fixedCost      = cylinderCost + setupCost + overheadAmt + labourCost + transportationCost + interestCost + packingCost;
  const breakEvenQty   = contribution > 0 ? Math.ceil(fixedCost / contribution) : 0;

  return { materialCost, processCost, cylinderCost, setupCost, labourCost, transportationCost, interestCost, depreciationCost, packingCost, packingPerKg, packPerBox, overheadAmt, profitAmt, totalAmount, perMeterRate, perMeterRateWithoutProfit, marginPct, contribution, breakEvenQty };
}

// ─── Detailed breakdown (for Tab 3 display) ──────────────────
export type MatLine  = { plyNo: number; plyType: string; name: string; group: string; gsm: number; kg: number; rate: number; amount: number };
export type ProcLine = { name: string; chargeUnit: string; qty: number; rate: number; setupCharge: number; amount: number };

export function getCostBreakdown(form: typeof blank, opts?: RateOptions): { matLines: MatLine[]; procLines: ProcLine[]; areaM2: number } {
  const { lengthM, areaM2, weightKg } = resolveQuantities(form);
  const matLines: MatLine[]   = [];
  const procLines: ProcLine[] = [];

  form.secondaryLayers.forEach((l, idx) => {
    // Film — priority: user-entered filmRate → live API rate → dummy fallback
    if (l.gsm > 0) {
      const filmItem = FILM_ITEMS.find(i => i.subGroup === l.itemSubGroup);
      const rate = (l.filmRate && l.filmRate > 0)
        ? l.filmRate
        : (opts?.filmRateMap?.[l.itemSubGroup] ?? parseFloat(filmItem?.estimationRate || "0"));
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

  // Processes — apply MinimumCharges floor from master
  form.processes.forEach(p => {
    const _autoQty = autoProcessQty(p.chargeUnit, lengthM, areaM2, weightKg, form.noOfColors);
    const qty      = parseFloat((_autoQty > 0 ? _autoQty : (p.qty || 0)).toFixed(2));
    const rawAmt   = p.rate * qty + (p.setupCharge || 0);
    const minCharge = opts?.processMinChargeMap?.[String(p.processId)] ?? 0;
    const amount   = parseFloat(Math.max(rawAmt, minCharge).toFixed(2));
    procLines.push({ name: p.processName || "—", chargeUnit: p.chargeUnit, qty, rate: p.rate, setupCharge: p.setupCharge || 0, amount });
  });

  return { matLines, procLines, areaM2 };
}

// Parses SQL Server datetime strings returned by JavaScriptSerializer.
// Handles: /Date(1716489600000)/, ISO strings ("2024-05-16"), or "16 May 2024" style.
// Always returns a "yyyy-MM-dd" string safe for <input type="date"> and new Date().
export function parseApiDate(d: any): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  const s = String(d).trim();
  // Microsoft /Date(ms)/ format from JavaScriptSerializer
  const msMatch = s.match(/\/Date\((-?\d+)\)\//);
  if (msMatch) return new Date(parseInt(msMatch[1], 10)).toISOString().slice(0, 10);
  // ISO / yyyy-MM-dd / other parseable string
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}
