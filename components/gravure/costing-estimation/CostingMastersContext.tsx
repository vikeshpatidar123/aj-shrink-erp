"use client";
/**
 * CostingMastersContext — shared master-data derivations for the Gravure Costing
 * Estimation module, extracted verbatim (logic unchanged) from the legacy
 * `app/gravure/costing-estimation/page.tsx` (originally ~lines 37-129 for the
 * module-level statics and ~444-614 for the in-component `useMemo` derivations).
 *
 * This data is the SAME for every estimation instance on screen, so it is
 * computed ONCE here (via `CostingMastersProvider`) instead of being
 * recomputed inside every `useEstimationInstance()` call.
 *
 * Consume via `useCostingMasters()` inside any component wrapped by
 * `<CostingMastersProvider>`.
 */
import { createContext, useContext, useMemo, useState, useEffect, ReactNode } from "react";
import {
  items, machines, processMasters,
  tools as allTools, toolInventory,
} from "@/data/dummyData";
import { useMasters } from "@/context/MastersContext";
import { useCategories } from "@/context/CategoriesContext";
import { apiGet } from "@/lib/api";
import { CONTENT_TYPE_CONFIG } from "@/components/gravure/DimensionDiagram";

// ─── Master-filtered lists (module-level, same as source page.tsx) ─────────
export const FILM_ITEMS     = items.filter(i => i.group === "Film"     && i.active);
export const INK_ITEMS      = items.filter(i => i.group === "Ink"      && i.active);
export const SOLVENT_ITEMS  = items.filter(i => i.group === "Solvent"  && i.active);
export const ADHESIVE_ITEMS = items.filter(i => i.group === "Adhesive" && i.active);
export const HARDNER_ITEMS  = items.filter(i => i.group === "Hardner"  && i.active);
export const ALL_MAT_ITEMS  = [...FILM_ITEMS, ...INK_ITEMS, ...SOLVENT_ITEMS, ...ADHESIVE_ITEMS, ...HARDNER_ITEMS];

export const FINISH_GOODS_TYPES = [
  "3 Side Seal Sachet", "Center Seal Pouch", "Stand Up Pouch",
  "Gusset Bag", "Flat Bottom Pouch", "Sleeve — Shrink",
  "In-Mould Labels", "BOPP Label", "CSD", "Shrink Sleeve",
];

// Fallback static data (used when API not yet loaded)
export const STATIC_PRINT_MACHINES = machines.filter(m => m.department === "Printing");
export const STATIC_ROTO_PROCESSES = processMasters.filter(p => p.module === "Rotogravure");

// ─── Tool inventory helpers ────────────────────────────────
export const AVAILABLE_TOOL_IDS = new Set(
  toolInventory.filter(ti => ti.status === "Available").map(ti => ti.toolId)
);
export const SLEEVE_TOOLS = allTools
  .filter(t => t.toolType === "Sleeve" && AVAILABLE_TOOL_IDS.has(t.id))
  .sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
export const CYLINDER_TOOLS = allTools
  .filter(t => t.toolType === "Cylinder" && AVAILABLE_TOOL_IDS.has(t.id))
  .sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
export const CYLINDER_TOOLS_ALL = allTools
  .filter(t => t.toolType === "Cylinder")
  .sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));

// Maps any DB ContentMaster.ContentName → a CONTENT_TYPE_CONFIG key.
// Order matters: more-specific checks before general ones.
// If no pattern matches, returns the original string (may already be an exact config key).
export function normalizeContentType(content: string): string {
  const c = (content || "").toLowerCase().trim();
  if (!c) return content;

  // ── Sleeve (before "film" so "Shrink Sleeve Film" → Sleeve, not Labels) ──
  if (c.includes("sleeve") && !c.includes("stretch"))                   return "Sleeve — Shrink";
  if (c.includes("sleeve") && c.includes("stretch"))                    return "Sleeve — Stretch";

  // ── Label types ────────────────────────────────────────────────────────
  if (c.includes("wrap around"))                                         return "Wrap Around Labels";
  if (c.includes("shrink label") || c.includes("shrink film"))          return "Shrink Labels";
  if (c.includes("cut") && c.includes("stack"))                         return "Cut & Stack Labels";
  if (c.includes("in-mould") || c.includes("in mould"))                return "In-Mould Labels";

  // ── Pouch types (specific before generic) ─────────────────────────────
  if (c.includes("both side") && c.includes("gusset"))                  return "Both Side Gusset Pouch";
  if (c.includes("gusset") && c.includes("bag"))                        return "Both Side Gusset Pouch";
  if ((c.includes("flat bottom") || (c.includes("3d") && c.includes("pouch")))) return "3D Pouch / Flat Bottom";
  if (c.includes("3 side") || c.includes("three side") || c.includes("sachet")) return "Pouch — 3 Side Seal";
  if (c.includes("center seal") || c.includes("centre seal"))           return "Pouch — Center Seal";
  if (c.includes("standup") || c.includes("stand up") || c.includes("stand-up")) return "Standup Pouch";
  if (c.includes("zipper"))                                              return "Zipper Pouch";
  if (c.includes("pouch") || c.includes("doy"))                         return "Pouch — 3 Side Seal";

  // ── Film / roll types ─────────────────────────────────────────────────
  if (c.includes("lldpe") || c.includes("ldpe"))                        return "Shrink Labels";
  if (c.includes("laminate"))                                            return "Laminate Roll";
  if (c.includes("roll form") || c.includes("roll") || c.includes("film")) return "Laminate Roll";

  // ── Generic keyword fallbacks ─────────────────────────────────────────
  if (c.includes("bag") || c.includes("sack"))                          return "Both Side Gusset Pouch";
  if (c.includes("label") || c.includes("sticker") || c.includes("tag")) return "Wrap Around Labels";

  // Return as-is — may already be an exact CONTENT_TYPE_CONFIG key
  return content;
}

// Exact match first → falls back to normalizeContentType (for DimensionInputPanel/Diagram only)
export const getDisplayContentType = (content: string): string =>
  CONTENT_TYPE_CONFIG[content] ? content : normalizeContentType(content);

// Find distinct subGroups from FILM_ITEMS along with their density and available thicknesses
export const FILM_SUBGROUPS = Array.from(
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

// ─── Live API-derived masters (dedupe helper) ──────────────────────────────
function dedupe<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
}

export type CostingMasters = {
  /** Live (API) machines list — falls back to STATIC_PRINT_MACHINES when API not loaded. Each item carries loan/labour/depreciation fields used by the Loan & Labour Cost calculator. */
  PRINT_MACHINES: any[];
  /** Live (API) roto processes list — falls back to STATIC_ROTO_PROCESSES. */
  ROTO_PROCESSES: any[];
  /** Film rate lookup keyed by ItemSubGroupID (from live API). */
  apiFilmRateBySubGroupId: Record<string, number>;
  /** Film rate lookup keyed by ItemSubGroupName (from live API) — used by calcCosts/getCostBreakdown. */
  apiFilmRateBySubGroupName: Record<string, number>;
  /** Sleeve tools from Item Master (live) — falls back to static SLEEVE_TOOLS. */
  SLEEVE_TOOLS_LIVE: any[];
  /** Cylinder tools from Cylinder Master (live) — falls back to static CYLINDER_TOOLS_ALL. */
  CYLINDER_TOOLS_LIVE: any[];
  /** Film sub-groups (name + density + thicknesses) — live API version of FILM_SUBGROUPS. */
  apiFilmSubGroups: { subGroup: string; density: number; thicknesses: number[] }[];
  /** Normalizes a DB ItemGroupName → standard frontend group key (Ink/Solvent/Adhesive/Hardner). */
  normalizeConsumableGroup: (grp: string) => string;
  /** Consumable sub-groups from live API, keyed by normalized group name. */
  apiConsumableSubGroups: Record<string, string[]>;
  /** Pack Size / Brand Name / SKU Type dropdown options (Field Master API). */
  fmOptions: { packSizes: string[]; brandNames: string[]; skuTypes: string[] };
  /** Re-fetches fmOptions on demand. */
  refreshFmOptions: () => Promise<void>;
  /** Raw context passthroughs some downstream code needs directly. */
  apiMachines: ReturnType<typeof useMasters>["machines"];
  apiProcesses: ReturnType<typeof useMasters>["processes"];
  apiFilmItems: ReturnType<typeof useMasters>["filmItems"];
  apiInkItems: ReturnType<typeof useMasters>["inkItems"];
  apiSleeveItems: ReturnType<typeof useMasters>["sleeveItems"];
  apiCylindersRaw: ReturnType<typeof useMasters>["cylinderMaster"];
  categories: ReturnType<typeof useCategories>["categories"];
  refreshCategories: ReturnType<typeof useCategories>["refresh"];
  refreshMasters: ReturnType<typeof useMasters>["refresh"];
};

const CostingMastersCtx = createContext<CostingMasters | null>(null);

export function CostingMastersProvider({ children }: { children: ReactNode }) {
  const { categories, refresh: refreshCategories } = useCategories();
  const {
    machines: apiMachines, processes: apiProcesses, filmItems: apiFilmItems,
    inkItems: apiInkItems, sleeveItems: apiSleeveItems, cylinderMaster: apiCylindersRaw,
    refresh: refreshMasters,
  } = useMasters();

  // ── Field Master dropdown options (Pack Size / Brand Name / SKU Type) —
  //    fetched once on mount, same source as the Product Catalog module ──────
  const [fmOptions, setFmOptions] = useState<{ packSizes: string[]; brandNames: string[]; skuTypes: string[] }>({
    packSizes: [], brandNames: [], skuTypes: [],
  });
  const refreshFmOptions = async () => {
    const fetchField = (fieldName: string) =>
      apiGet<any[]>(`api/FieldMasterAJ/GetFieldValues?fieldName=${encodeURIComponent(fieldName)}`)
        .then(rows => (Array.isArray(rows) ? rows.map((r: any) => String(r.FieldValue ?? "")).filter(Boolean) : []))
        .catch(() => [] as string[]);
    const [packSizes, brandNames, skuTypes] = await Promise.all([
      fetchField("Standard Pack Sizes"),
      fetchField("Brand Names"),
      fetchField("SKU Types"),
    ]);
    setFmOptions({ packSizes, brandNames, skuTypes });
  };
  useEffect(() => { refreshFmOptions(); }, []);

  // ── Live API machines & processes (fall back to static if API not loaded) ──
  const PRINT_MACHINES = useMemo(() =>
    apiMachines.length > 0
      ? dedupe(apiMachines.map(m => ({
          id: String(m.MachineID), name: m.MachineName, department: "Printing",
          status: "Running",
          costPerHour: m.PerHourCost > 0 ? m.PerHourCost : 1350,
          maxWebWidth: m.MaxRollWidth, minWebWidth: m.MinRollWidth,
          repeatLengthMin: m.MinCircumference, repeatLengthMax: m.MaxCircumference,
          noOfColors: m.Colors,
          speedMax: m.Speed, speedUnit: m.SpeedUnit || "Meter/Min",
          // Loan / interest
          isOnLoan: m.IsOnLoan === 1,
          loanAmount: m.PurchaseCost ?? 0,
          loanInterestRatePct: m.AnnualInterestRate ?? 0,
          loanDuration: m.LoanDuration ?? 0,
          purchaseCost: m.PurchaseCost ?? 0,
          machineLifespan: m.MachineLifespan ?? 0,
          // Labour
          numberOfOperators: m.NumberOfOperators ?? 1,
          avgLaborSalaryPerYear: m.AvgLaborSalaryPerYear ?? 0,
          labourCharges: m.LabourCharges ?? 0,
          workingHoursPerDay: m.WorkingHoursPerDay ?? 8,
          workingDaysPerYear: m.WorkingDaysPerYear ?? 300,
          // Derived for estimation compatibility
          monthlyLabourSalary: m.AvgLaborSalaryPerYear > 0
            ? Math.round((m.AvgLaborSalaryPerYear * (m.NumberOfOperators || 1)) / 12)
            : 0,
          // LabourCharges is a DIRECT per-hour rate (not monthly) — used as fallback
          directLabourPerHr: m.LabourCharges > 0 ? m.LabourCharges : 0,
          // PerHourCost is direct machine cost per hour (depreciation + power) — fallback when PurchaseCost=0
          directCostPerHr: m.PerHourCost > 0 ? m.PerHourCost : 0,
          workingDaysPerMonth: m.WorkingDaysPerYear > 0 ? Math.round(m.WorkingDaysPerYear / 12) : 25,
          shiftHours: m.WorkingHoursPerDay ?? 8,
        } as any)))
      : STATIC_PRINT_MACHINES,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [apiMachines]);

  const ROTO_PROCESSES = useMemo(() =>
    apiProcesses.length > 0
      ? dedupe(apiProcesses.map(p => ({
          id: String(p.ProcessID), name: p.ProcessName, displayName: p.DisplayProcessName,
          module: "Rotogravure", department: p.DepartmentName,
          chargeUnit: p.TypeofCharges, rate: String(p.Rate),
          makeSetupCharges: Number(p.SetupCharges) > 0,
          setupChargeAmount: String(p.SetupCharges ?? 0),
          minimumCharge: Number(p.MinimumCharges ?? 0),
          minimumQty: Number(p.MinimumQuantityToBeCharged ?? 0),
          perHourCost: Number(p.PerHourCostingParameter ?? 0),
          startUnit: String(p.StartUnit || ""),
          endUnit: String(p.EndUnit || ""),
          machineIds: (() => {
            const alloc = String(p.AllocattedMachineID || "");
            const ids = alloc.split(",").map((s: string) => s.trim()).filter(Boolean);
            // Fall back to MachineID if AllocattedMachineID is empty
            if (ids.length === 0 && p.MachineID) ids.push(String(p.MachineID));
            return ids;
          })(),
          machineId: (() => {
            const alloc = String(p.AllocattedMachineID || "");
            const ids = alloc.split(",").map((s: string) => s.trim()).filter(Boolean);
            if (ids.length === 1) return ids[0];
            if (ids.length === 0) return String(p.MachineID || "");
            return ""; // multiple — require user to pick in loan/labour table
          })(),
          machineMasterName: String(p.MachineMasterName || ""),
        } as any)))
      : STATIC_ROTO_PROCESSES,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [apiProcesses]);

  // Film rate lookup: subGroupID → EstimationRate (from live API), fallback to subGroupName → rate
  const apiFilmRateBySubGroupId = useMemo(() => {
    const map: Record<string, number> = {};
    apiFilmItems.forEach(f => { if (f.ItemSubGroupID && f.EstimationRate > 0) map[f.ItemSubGroupID] = f.EstimationRate; });
    return map;
  }, [apiFilmItems]);
  const apiFilmRateBySubGroupName = useMemo(() => {
    const map: Record<string, number> = {};
    apiFilmItems.forEach(f => { if (f.ItemSubGroupName && f.EstimationRate > 0) map[f.ItemSubGroupName] = f.EstimationRate; });
    return map;
  }, [apiFilmItems]);

  // Sleeve tools from Item Master (SizeW = sleeve width mm)
  const SLEEVE_TOOLS_LIVE = useMemo(() =>
    apiSleeveItems.length > 0
      ? apiSleeveItems.filter(s => s.SizeW > 0).map(s => ({
          id: String(s.ItemID), code: s.ItemCode,
          name: s.ItemDisplayName || s.ItemName,
          printWidth: String(s.SizeW), toolType: "Sleeve" as const,
        })).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth))
      : SLEEVE_TOOLS,
  [apiSleeveItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cylinder tools from Cylinder Master (API)
  const CYLINDER_TOOLS_LIVE = useMemo(() =>
    apiCylindersRaw.length > 0
      ? apiCylindersRaw.map(c => ({
          id: String(c.CylinderID), code: c.CylinderCode,
          name: c.CylinderName,
          printWidth: String(c.PrintWidth),
          repeatLength: String(c.Circumference),
          purchaseRate: Number(c.PurchaseRate ?? 0),
          purchaseUnit: String(c.PurchaseUnit || "SQM"),
          toolType: "Cylinder" as const,
        })).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth))
      : CYLINDER_TOOLS_ALL,
  [apiCylindersRaw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Film sub-groups from live API (DB sub-group names + density/thicknesses per sub-group)
  const apiFilmSubGroups = useMemo(() => {
    if (apiFilmItems.length === 0) return FILM_SUBGROUPS;
    const map = new Map<string, { density: number; thicknesses: Set<number> }>();
    apiFilmItems.forEach(f => {
      if (!f.ItemSubGroupName) return;
      if (!map.has(f.ItemSubGroupName)) map.set(f.ItemSubGroupName, { density: f.Density || 0, thicknesses: new Set() });
      const t = parseFloat(String(f.Thickness));
      if (!isNaN(t) && t > 0) map.get(f.ItemSubGroupName)!.thicknesses.add(t);
    });
    return Array.from(map.entries()).map(([subGroup, d]) => ({
      subGroup, density: d.density,
      thicknesses: Array.from(d.thicknesses).sort((a, b) => a - b),
    }));
  }, [apiFilmItems]);

  // Normalize DB ItemGroupName → standard frontend group key (Ink / Solvent / Adhesive / Hardner)
  const normalizeConsumableGroup = (grp: string): string => {
    const g = (grp || "").toLowerCase();
    if (g.includes("ink"))      return "Ink";
    if (g.includes("solvent"))  return "Solvent";
    if (g.includes("adhesive")) return "Adhesive";
    if (g.includes("hardner") || g.includes("hardener")) return "Hardner";
    return grp;
  };

  // Consumable sub-groups from live API keyed by normalized group name
  const apiConsumableSubGroups = useMemo(() => {
    const map: Record<string, string[]> = {};
    apiInkItems.forEach(i => {
      if (!i.ItemGroupName || !i.ItemSubGroupName) return;
      const key = normalizeConsumableGroup(i.ItemGroupName);
      if (!map[key]) map[key] = [];
      if (!map[key].includes(i.ItemSubGroupName)) map[key].push(i.ItemSubGroupName);
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiInkItems]);

  const value: CostingMasters = {
    PRINT_MACHINES, ROTO_PROCESSES,
    apiFilmRateBySubGroupId, apiFilmRateBySubGroupName,
    SLEEVE_TOOLS_LIVE, CYLINDER_TOOLS_LIVE,
    apiFilmSubGroups, normalizeConsumableGroup, apiConsumableSubGroups,
    fmOptions, refreshFmOptions,
    apiMachines, apiProcesses, apiFilmItems, apiInkItems, apiSleeveItems, apiCylindersRaw,
    categories, refreshCategories, refreshMasters,
  };

  return <CostingMastersCtx.Provider value={value}>{children}</CostingMastersCtx.Provider>;
}

export function useCostingMasters(): CostingMasters {
  const ctx = useContext(CostingMastersCtx);
  if (!ctx) throw new Error("useCostingMasters() must be used within a <CostingMastersProvider>");
  return ctx;
}
