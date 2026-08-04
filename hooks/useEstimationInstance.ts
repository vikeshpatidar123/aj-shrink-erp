"use client";
/**
 * useEstimationInstance — the reusable "one Gravure Costing Estimation record"
 * engine. Extracted (logic unchanged) from the per-record state & handlers
 * that used to live inline in `app/gravure/costing-estimation/page.tsx`.
 *
 * Each estimation instance shown on screen (the base one, plus any produced
 * via "Clone Estimation") calls this hook exactly once. Shared master data
 * (machines, processes, film/ink lookups, rate maps) is NOT recomputed here —
 * it's read from `useCostingMasters()` and passed in via `opts.masters`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RETURNED BUNDLE — quick reference for consumers (accordions / panel):
 * ─────────────────────────────────────────────────────────────────────────
 *  Form & core state
 *    form, setForm, f(key, value)              — the estimation record being edited
 *    dimValues, patchDim                        — DimensionDiagram input state
 *    loadedFromCatalog, setLoadedFromCatalog     — catalogNo this record was seeded from (if any)
 *
 *  Costs (base quantity = form.quantity)
 *    costs                                       — calcCosts(form) live result
 *    breakdown                                    — getCostBreakdown() for the ACTIVE qty (matLines/procLines/areaM2)
 *    rateOpts, processMinChargeMap                — RateOptions fed into calcCosts/getCostBreakdown
 *
 *  Quantity clones (Q1/Q2/Q3 comparison)
 *    extraQtys, setExtraQtys                      — additional quantities beyond the base form.quantity
 *    allQtys                                       — [form.quantity, ...extraQtys>0]
 *    allCosts, allBreakdowns                       — calcCosts/getCostBreakdown per entry in allQtys
 *    activeQtyIdx, setActiveQtyIdx                 — which allQtys index is "active" (drives breakdown/activeCosts)
 *    activeCosts, activeQty                        — allCosts[activeQtyIdx] / allQtys[activeQtyIdx]
 *    qtyOverrides, setQtyOverride(qi, field, val)  — per-qty manual overrides (labourCost, cylinderCostOverride, etc.)
 *
 *  Cylinder
 *    cylAllocs, setCylAllocs                       — EstCylAlloc[] (per-color cylinder allocation rows)
 *    cylCostFromAllocs                             — total cylinder cost computed from cylAllocs' ToolMaster rates (null = fall back to per-color rate)
 *    cylCostBreakdown                              — display rows for cylAllocs with resolved rate/area/cost
 *    openEstCylinderMaster(), refreshEstFromCylinderMaster() — cross-tab Cylinder Master integration
 *
 *  Color shades
 *    colorShades, setColorShades                   — EstColorShade[] (per-color LAB/Pantone rows)
 *
 *  Attachments
 *    attachments, addAttachments(files), removeAttachment(id)
 *    editingAttachLabel, setEditingAttachLabel
 *    previewAttachment, setPreviewAttachment
 *
 *  Materials (manual "extra materials" rows)
 *    addMaterial, removeMaterial, updateMaterial, selectMaterialItem
 *
 *  Processes
 *    addProcess, removeProcess, updateProcess, selectProcess, updateProcessMachine
 *
 *  Ply / secondaryLayers
 *    onPlyTypeChange, addPlyConsumable, removePlyConsumable, updatePlyConsumable
 *    applyCategory(categoryId)                     — auto-builds ply rows from a CategoryMaster's plyConsumables
 *
 *  Loading data into the form
 *    applyEnquiry(enq)                              — fetch full enquiry detail + fill form
 *    loadFromCatalog(cat)                           — fill form from a GravureProductCatalog row
 *    hydrateFromRecord(id)                          — fetch by ID + normalize (called automatically when opts.estimationId is set)
 *    isHydrating                                     — true while hydrateFromRecord's fetch is in flight
 *
 *  Misc
 *    getStructureType(content)                      — "Label" | "Sleeve" | "Pouch"
 *    initEstPrepData()                               — (re)builds colorShades rows from form.noOfColors
 *
 *  Save
 *    saving, save()                                  — builds payload + POSTs to saveestimation/updateestimation
 * ─────────────────────────────────────────────────────────────────────────
 */
import { useState, useMemo, useEffect } from "react";
import {
  GravureEstimation, GravureEstimationMaterial, GravureEstimationProcess,
  SecondaryLayer, PlyConsumableItem, GravureProductCatalog,
  items,
} from "@/data/dummyData";
import { CombinedEnquiry } from "@/context/EnquiryContext";
import { apiGet, apiPost, API_BASE } from "@/lib/api";
import { authHeaders } from "@/lib/auth";
import { DimValues, CONTENT_TYPE_CONFIG } from "@/components/gravure/DimensionDiagram";
import {
  ALL_MAT_ITEMS, normalizeContentType, getDisplayContentType,
  CostingMasters,
} from "@/components/gravure/costing-estimation/CostingMastersContext";
import {
  blank, calcCosts, getCostBreakdown, resolveQuantities, autoProcessQty,
  RateOptions, MatLine, ProcLine, parseApiDate,
} from "./costingCalc";

export type { RateOptions, MatLine, ProcLine };

// ─── Cylinder Alloc / Color Shade / Attachment row types ───────────────────
export type EstCylAlloc = {
  colorNo:      number;
  colorName:    string;
  cylinderNo:   string;
  circumference:string;
  printWidth:   string;
  repeatUPS:    number;
  cylinderType: "New" | "Existing" | "Rechromed" | "Repeat";
  status:       "Pending" | "Available" | "In Use" | "Under Chrome" | "Ordered";
  remarks:      string;
  createdInMaster?: boolean;
  repeatUse?:   boolean;
  cylinderMasterID?: string;
  purchaseRate?: number;
  purchaseUnit?: string;
  consumableId?: string;
};

export type EstColorShade = {
  colorNo: number; colorName: string; inkType: "Spot" | "Process" | "Special";
  pantoneRef: string; labL: string; labA: string; labB: string;
  shadeCardRef: string; status: "Pending" | "Standard Received" | "Approved" | "Rejected";
  remarks: string; inkItemId?: string; inkGsm?: number; consumableId?: string;
};

export type EstAttachment = { id: string; name: string; size: number; mimeType: string; url: string; label?: string; fileObj?: File };

export type QtyOverride = {
  labourCost?: number; transportationCost?: number; interestCost?: number;
  overheadPct?: number; profitPct?: number;
  cylinderCostOverride?: number; setupCostOverride?: number; packingCostOverride?: number;
};

const COLOR_LAB: Record<string, { l: string; a: string; b: string }> = {
  "Red":     { l: "41.0",  a: "54.2",  b: "38.1"  },
  "Yellow":  { l: "89.3",  a: "-6.1",  b: "80.4"  },
  "Blue":    { l: "25.1",  a: "23.4",  b: "-52.8" },
  "Black":   { l: "16.0",  a: "0.1",   b: "0.0"   },
  "White":   { l: "95.2",  a: "-1.0",  b: "2.3"   },
  "Green":   { l: "46.3",  a: "-50.2", b: "30.1"  },
  "Cyan":    { l: "60.1",  a: "-38.2", b: "-31.4" },
  "Magenta": { l: "48.2",  a: "72.1",  b: "-10.3" },
  "Orange":  { l: "65.4",  a: "43.1",  b: "65.2"  },
  "Violet":  { l: "30.2",  a: "40.1",  b: "-42.3" },
};
const PROCESS_COLOURS = new Set(["Cyan", "Magenta", "Yellow", "Black"]);

// ─── Derive structureType from content string (same as product-catalog) ────
export function getStructureType(content: string): "Label" | "Sleeve" | "Pouch" {
  if (!content) return "Label";
  const c = content.toLowerCase();
  if (c.includes("sleeve")) return "Sleeve";
  if (c.includes("pouch") || c.includes("standup") || c.includes("zipper") || c.includes("3d") || c.includes("flat bottom") || c.includes("gusset") || c.includes("center seal") || c.includes("side seal")) return "Pouch";
  return "Label";
}

/** Builds DimValues from a content-type config + a row-shaped object of dimension fields. */
function dimsFromContent(content: string | undefined, jobWidth: number, jobHeight: number, rc: any): DimValues {
  if (!content) return {};
  const cfg = CONTENT_TYPE_CONFIG[normalizeContentType(content)];
  if (!cfg) return {};
  const dims: DimValues = {};
  if (cfg.fields.includes("layflatWidth")) dims.layflatWidth = jobWidth;
  else                                     dims.width        = jobWidth;
  if (cfg.fields.includes("cutHeight"))    dims.cutHeight    = jobHeight;
  else                                     dims.height       = jobHeight;
  if (cfg.fields.includes("gusset"))           dims.gusset          = rc.gusset          || 0;
  if (cfg.fields.includes("topSeal"))          dims.topSeal         = rc.topSeal         || 0;
  if (cfg.fields.includes("bottomSeal"))       dims.bottomSeal      = rc.bottomSeal      || 0;
  if (cfg.fields.includes("sideSeal"))         dims.sideSeal        = rc.sideSeal        || 0;
  if (cfg.fields.includes("centerSealWidth"))  dims.centerSealWidth = rc.centerSealWidth || 0;
  if (cfg.fields.includes("sideGusset"))       dims.sideGusset      = rc.sideGusset      || 0;
  if (cfg.fields.includes("seamingArea"))      dims.seamingArea     = rc.seamingArea     || 0;
  if (cfg.fields.includes("transparentArea"))  dims.transparentArea = rc.transparentArea || 0;
  dims.trimming       = rc.trimmingSize   || 0;
  dims.widthShrinkage = rc.widthShrinkage || 0;
  return dims;
}

export type UseEstimationInstanceOpts = {
  /** Seed the form from a partial record (used by "Clone Estimation" — a live-form snapshot of a sibling instance). */
  initialData?: Partial<GravureEstimation>;
  /** When set, the hook fetches the full record by ID (getestimationbyid) and hydrates form/qtys/colorShades/cylAllocs on mount. */
  estimationId?: string;
  /** Shared master data — from useCostingMasters(), computed once per page, passed in so it isn't refetched per instance. */
  masters: CostingMasters;
};

export function useEstimationInstance(opts: UseEstimationInstanceOpts) {
  const { masters } = opts;
  const { PRINT_MACHINES, ROTO_PROCESSES, apiFilmItems, apiInkItems, CYLINDER_TOOLS_LIVE, apiFilmRateBySubGroupName, categories } = masters;

  // ── Core form state ───────────────────────────────────────
  const [form, setForm] = useState<typeof blank>(() => ({ ...blank, ...(opts.initialData ?? {}) } as typeof blank));
  const f = (k: keyof typeof blank, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const [dimValues, setDimValues] = useState<DimValues>(() =>
    dimsFromContent(opts.initialData?.content, opts.initialData?.jobWidth ?? 0, opts.initialData?.jobHeight ?? 0, opts.initialData ?? {})
  );
  const patchDim = (patch: DimValues) => setDimValues(p => ({ ...p, ...patch }));

  const [loadedFromCatalog, setLoadedFromCatalog] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  // BookingID/estimationNo of the record being edited (set only by hydrateFromRecord) — determines insert vs update in save()
  const [editingMeta, setEditingMeta] = useState<{ id: string; estimationNo: string } | null>(null);

  // ── Quantity clones (Q1/Q2/Q3 comparison) ──────────────────
  const [extraQtys, setExtraQtys] = useState<number[]>([]);
  const [activeQtyIdx, setActiveQtyIdx] = useState<number>(0);
  const [qtyOverrides, setQtyOverrides] = useState<QtyOverride[]>([]);
  const setQtyOverride = (qi: number, field: keyof QtyOverride, val: number | undefined) => {
    setQtyOverrides(prev => {
      const next = [...prev];
      const entry: QtyOverride = { ...(next[qi] ?? {}) };
      if (val === undefined) { delete entry[field]; } else { entry[field] = val; }
      next[qi] = entry;
      return next;
    });
  };

  // ── Cylinder / color-shade / attachments ────────────────────
  const [cylAllocs, setCylAllocs] = useState<EstCylAlloc[]>([]);
  const [colorShades, setColorShades] = useState<EstColorShade[]>([]);
  const [attachments, setAttachments] = useState<EstAttachment[]>([]);
  const [editingAttachLabel, setEditingAttachLabel] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ name: string; url: string; mimeType: string } | null>(null);

  // ── Rate option maps for live API-driven cost calculation ──
  const processMinChargeMap = useMemo(() => {
    const map: Record<string, number> = {};
    ROTO_PROCESSES.forEach((p: any) => { if (p.minimumCharge > 0) map[String(p.id)] = p.minimumCharge; });
    return map;
  }, [ROTO_PROCESSES]);

  const rateOpts = useMemo((): RateOptions => ({
    filmRateMap: apiFilmRateBySubGroupName,
    processMinChargeMap,
  }), [apiFilmRateBySubGroupName, processMinChargeMap]);

  // ── Cylinder cost from ToolMaster (PurchaseRate × SQM area per cylinder) ──
  const cylCostFromAllocs = useMemo(() => {
    const billable = cylAllocs.filter(c => !c.repeatUse).map(c => {
      let rate = c.purchaseRate ?? 0;
      if (rate === 0 && c.cylinderMasterID) {
        const master = CYLINDER_TOOLS_LIVE.find((t: any) => t.id === String(c.cylinderMasterID));
        if (master) rate = master.purchaseRate ?? 0;
      }
      if (rate === 0 && c.cylinderNo) {
        const master = CYLINDER_TOOLS_LIVE.find((t: any) => t.code === c.cylinderNo);
        if (master) rate = master.purchaseRate ?? 0;
      }
      return { ...c, resolvedRate: rate };
    }).filter(c => c.resolvedRate > 0);
    if (billable.length === 0) return null; // null → fall back to cylinderCostPerColor × noOfColors
    return parseFloat(billable.reduce((sum, c) => {
      const pw   = parseFloat(String(c.printWidth   || 0)) / 1000;
      const circ = parseFloat(String(c.circumference || 0)) / 1000;
      return sum + c.resolvedRate * pw * circ;
    }, 0).toFixed(2));
  }, [cylAllocs, CYLINDER_TOOLS_LIVE]);

  // Cylinder cost breakdown rows (for display)
  const cylCostBreakdown = useMemo(() =>
    cylAllocs.map(c => {
      let rate = c.purchaseRate ?? 0;
      let unit = c.purchaseUnit ?? "SQM";
      if (rate === 0 && c.cylinderMasterID) {
        const master = CYLINDER_TOOLS_LIVE.find((t: any) => t.id === String(c.cylinderMasterID));
        if (master) { rate = master.purchaseRate ?? 0; unit = master.purchaseUnit ?? "SQM"; }
      }
      if (rate === 0 && c.cylinderNo) {
        const master = CYLINDER_TOOLS_LIVE.find((t: any) => t.code === c.cylinderNo);
        if (master) { rate = master.purchaseRate ?? 0; unit = master.purchaseUnit ?? "SQM"; }
      }
      if (rate === 0) return null;
      const pw   = parseFloat(String(c.printWidth   || 0)) / 1000;
      const circ = parseFloat(String(c.circumference || 0)) / 1000;
      const area = parseFloat((pw * circ).toFixed(4));
      const cost = parseFloat((rate * area).toFixed(2));
      return { colorName: c.colorName, cylinderNo: c.cylinderNo, pw: c.printWidth, circ: c.circumference, area, rate, unit, cost, repeatUse: c.repeatUse ?? false };
    }).filter(Boolean) as { colorName: string; cylinderNo: string; pw: string; circ: string; area: number; rate: number; unit: string; cost: number; repeatUse: boolean }[],
  [cylAllocs, CYLINDER_TOOLS_LIVE]);

  // Auto-correct machineId when PRINT_MACHINES loads from API
  // Saved records may store a dummy/catalog machine ID — resolve to real DB ID by machine name
  useEffect(() => {
    if ((PRINT_MACHINES as any[]).length === 0) return;
    setForm(prev => {
      if (!prev.machineId && !prev.machineName) return prev;
      if ((PRINT_MACHINES as any[]).find((m: any) => m.id === prev.machineId)) return prev;
      const byName = (PRINT_MACHINES as any[]).find((m: any) =>
        m.name === prev.machineName ||
        m.name?.toLowerCase() === (prev.machineName || "").toLowerCase()
      );
      if (!byName) return prev;
      return { ...prev, machineId: String((byName as any).id), machineName: String((byName as any).name) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PRINT_MACHINES]);

  // Auto-correct process IDs when ROTO_PROCESSES (re-)loads from API
  useEffect(() => {
    if (ROTO_PROCESSES.length === 0) return;
    setForm(prev => {
      let changed = false;
      const fixed = prev.processes.map(pr => {
        if ((ROTO_PROCESSES as any[]).find(p => p.id === pr.processId)) return pr;
        const byName = (ROTO_PROCESSES as any[]).find(p =>
          pr.processName && (
            p.name === pr.processName ||
            p.displayName === pr.processName ||
            p.name?.toLowerCase() === pr.processName?.toLowerCase()
          )
        );
        if (byName) {
          changed = true;
          return { ...pr, processId: byName.id, processName: byName.name };
        }
        return pr;
      });
      return changed ? { ...prev, processes: fixed } : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ROTO_PROCESSES]);

  // Auto-fill consumable rates from Item Master API when rate is 0 (e.g. loaded from old catalog)
  // Also auto-fills solidPct (Ink/Solvent) from ItemMaster.SolidPerc when unset — only fills when the
  // field is currently empty/zero, never overwrites a value the user (or a saved record) already has.
  useEffect(() => {
    if (apiInkItems.length === 0) return;
    setForm(prev => {
      let changed = false;
      const layers = prev.secondaryLayers.map(layer => {
        const consumableItems = layer.consumableItems.map(ci => {
          if (!ci.itemId) return ci;
          const apiIt = apiInkItems.find(x => String(x.ItemID) === String(ci.itemId));
          if (!apiIt) return ci;
          let next = ci;
          if (!(ci.rate > 0) && apiIt.EstimationRate > 0) {
            next = { ...next, rate: apiIt.EstimationRate, rateUnit: apiIt.EstimationUnit || "Kg" };
            changed = true;
          }
          if (!(next.solidPct && next.solidPct > 0) && (next.itemGroup === "Ink" || next.itemGroup === "Solvent")) {
            const defaultSolid = next.itemGroup === "Ink" ? 40 : 0;
            const fromMaster = apiIt.SolidPerc > 0 ? apiIt.SolidPerc : defaultSolid;
            if (fromMaster !== (next.solidPct || 0)) {
              next = { ...next, solidPct: fromMaster };
              changed = true;
            }
          }
          return next;
        });
        return { ...layer, consumableItems };
      });
      return changed ? { ...prev, secondaryLayers: layers } : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiInkItems]);

  // Derived costs (live)
  const costs   = useMemo(() => calcCosts(form, rateOpts), [form, rateOpts]);
  const allQtys = useMemo(() => [form.quantity, ...extraQtys.filter(q => q > 0)], [form.quantity, extraQtys]);

  // Priority: manual override → ToolMaster alloc rates → per-color fallback
  const allCosts = useMemo(() => allQtys.map((qty, qi) => {
    const ov = qtyOverrides[qi] ?? {};
    return calcCosts({
      ...form, quantity: qty,
      labourCost:           ov.labourCost           ?? form.labourCost,
      transportationCost:   ov.transportationCost   ?? form.transportationCost,
      interestCost:         ov.interestCost         ?? form.interestCost,
      overheadPct:          ov.overheadPct          ?? form.overheadPct,
      profitPct:            ov.profitPct            ?? form.profitPct,
      cylinderCostOverride: ov.cylinderCostOverride ?? (cylCostFromAllocs !== null ? cylCostFromAllocs : undefined),
      setupCostOverride:    ov.setupCostOverride,
      packingCostOverride:  ov.packingCostOverride,
    }, rateOpts);
  }), [form, allQtys, qtyOverrides, rateOpts, cylCostFromAllocs]);
  const allBreakdowns = useMemo(() => allQtys.map(qty => getCostBreakdown({ ...form, quantity: qty }, rateOpts)), [form, allQtys, rateOpts]);
  const safeIdx     = Math.min(activeQtyIdx, allCosts.length - 1);
  const activeCosts = allCosts[safeIdx] ?? costs;
  const activeQty   = allQtys[safeIdx] ?? form.quantity;
  const breakdown   = useMemo(() => getCostBreakdown({ ...form, quantity: activeQty }, rateOpts), [form, activeQty, rateOpts]);

  // ── Attachment helpers ──────────────────────────────────────
  const addAttachments = (files: FileList | null) => {
    if (!files) return;
    const newItems: EstAttachment[] = Array.from(files).map((file, i) => ({
      id: Math.random().toString(36).slice(2),
      name: file.name, size: file.size, mimeType: file.type,
      url: URL.createObjectURL(file),
      label: attachments.length === 0 && i === 0 ? "Master File" : undefined,
      fileObj: file,
    }));
    setAttachments(p => [...p, ...newItems]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(p => {
      const item = p.find(x => x.id === id);
      if (item?.url?.startsWith("blob:")) URL.revokeObjectURL(item.url);
      return p.filter(x => x.id !== id);
    });
  };

  // ── Init color shades from noOfColors ──────────────────────
  const initEstPrepData = () => {
    const n = form.noOfColors || 0;
    if (n > 0) {
      setColorShades(Array.from({ length: n }, (_, i) => ({
        colorNo: i + 1,
        colorName: `Color ${i + 1}`,
        inkType: "Spot" as const,
        pantoneRef: "",
        labL: "", labA: "", labB: "",
        shadeCardRef: "",
        status: "Pending" as const,
        remarks: "",
        inkItemId: "",
      })));
    }
  };

  // ── Auto-sync Color Shade + Cylinder rows when inks change in consumables ──
  // (Source page gated this on `modalOpen`; there is no modal in the new architecture —
  //  the instance panel is always "open" while mounted, so this now runs unconditionally.)
  useEffect(() => {
    const inkList = form.secondaryLayers.flatMap(l =>
      l.consumableItems
        .filter(ci => ci.itemGroup === "Ink")
        .map(ci => {
          const master = items.find(it => it.id === ci.itemId);
          return {
            consumableId: ci.consumableId,
            inkItemId: ci.itemId ?? "",
            inkName: ci.itemName || master?.name || "",
            colour: (master as any)?.colour || "",
            pantoneNo: (master as any)?.pantoneNo || "",
          };
        })
    );

    setColorShades(prev => inkList.map((ink, i) => {
      const existing = prev.find(c => (c as any).consumableId === ink.consumableId);
      if (existing) return { ...existing, colorNo: i + 1 };
      const lab = ink.colour ? (COLOR_LAB[ink.colour] ?? { l: "", a: "", b: "" }) : { l: "", a: "", b: "" };
      const autoType: EstColorShade["inkType"] = ink.colour && PROCESS_COLOURS.has(ink.colour) ? "Process" : "Spot";
      return {
        colorNo: i + 1,
        colorName: ink.colour || ink.inkName || `Color ${i + 1}`,
        inkType: autoType,
        pantoneRef: ink.pantoneNo,
        labL: lab.l, labA: lab.a, labB: lab.b,
        shadeCardRef: "", status: "Pending" as const, remarks: "",
        inkItemId: ink.inkItemId,
        consumableId: ink.consumableId,
      } as EstColorShade;
    }));

    setCylAllocs(prev => inkList.map((ink, i) => {
      const existing = prev.find(c => (c as any).consumableId === ink.consumableId);
      if (existing) return { ...existing, colorNo: i + 1, colorName: ink.colour || ink.inkName || existing.colorName };
      return {
        colorNo: i + 1,
        colorName: ink.colour || ink.inkName || `Color ${i + 1}`,
        cylinderNo: "",
        circumference: "",
        printWidth: "",
        repeatUPS: 1,
        cylinderType: "Existing" as const,
        status: "Pending" as const,
        remarks: "",
        createdInMaster: false,
        repeatUse: false,
        consumableId: ink.consumableId,
      } as EstCylAlloc;
    }));
    // noOfColors is driven by frontColors + backColors — do NOT override from ink list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.secondaryLayers]);

  // ── Open Cylinder Master from Estimation ─────────────────
  const openEstCylinderMaster = () => {
    const n = form.noOfColors || 0;
    if (n === 0) { alert("Set No. of Colors in Basic Info first."); return; }
    const _cn = loadedFromCatalog || "";
    const _m  = _cn.match(/(\d+)$/);
    const _pCode = _m ? `P${_m[1].padStart(4, "0")}` : `EST-${Date.now()}`;
    const nonRepeat = cylAllocs.filter(c => !c.repeatUse);
    if (nonRepeat.length === 0) { alert("All colors are marked as Repeat Use — nothing to create."); return; }
    const prefillData = {
      productCode:   _pCode,
      productName:   form.jobName || "—",
      customerName:  form.customerName,
      noOfColors:    nonRepeat.length,
      circumference: String(form.jobHeight || ""),
      printWidth:    String(form.actualWidth || form.jobWidth || ""),
      repeatUPS:     1,
      categoryName:  form.categoryName || "",
      jobWidth:      String(form.jobWidth || ""),
      jobHeight:     String(form.jobHeight || ""),
      colors:        nonRepeat.map((c, i) => c.colorName || `Color ${i + 1}`),
    };
    localStorage.setItem("ajsw_cylinder_prefill", JSON.stringify(prefillData));
    window.open("/masters/tools/create-cylinders", "_blank");
  };

  // ── Refresh cylinder codes from master ───────────────────
  const refreshEstFromCylinderMaster = () => {
    const _cn = loadedFromCatalog || "";
    const _m  = _cn.match(/(\d+)$/);
    const productCode = _m ? `P${_m[1].padStart(4, "0")}` : "";
    if (!productCode) return;
    try {
      const created: any[] = JSON.parse(localStorage.getItem("ajsw_cylinders_created") || "[]");
      const matching = created.filter(c => c.productCode === productCode);
      if (matching.length === 0) return;
      setCylAllocs(p => p.map(alloc => {
        const match = matching.find((m: any) => m.colorNo === alloc.colorNo);
        if (!match) return alloc;
        return { ...alloc, cylinderNo: match.cylinderCode || alloc.cylinderNo, createdInMaster: true, status: match.status || alloc.status };
      }));
    } catch { /* ignore */ }
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
      processes: [...p.processes, { processId: "", processName: "", chargeUnit: "", rate: 0, qty: 0, setupCharge: 0, amount: 0, machineId: "", machineName: "", runHours: 0, interestCost: 0, labourCost: 0 }],
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
    const pm = ROTO_PROCESSES.find((x: any) => x.id === processId);
    if (!pm) return;
    const pmMachineIds: string[] = (pm as any).machineIds || [];
    const autoMachineId = pmMachineIds.length === 1
      ? pmMachineIds[0]
      : (pmMachineIds.length === 0 ? ((pm as any).machineId || form.machineId || "") : "");
    const autoMachine = PRINT_MACHINES.find((m: any) => m.id === autoMachineId);
    const autoMachineName = autoMachine?.name || (pm as any).machineMasterName || form.machineName || "";
    updateProcess(i, {
      processId: (pm as any).id, processName: (pm as any).name,
      chargeUnit: (pm as any).chargeUnit, rate: parseFloat((pm as any).rate) || 0,
      setupCharge: (pm as any).makeSetupCharges ? parseFloat((pm as any).setupChargeAmount) || 0 : 0,
      machineId:   autoMachineId,
      machineName: autoMachineName,
      machineIds:  pmMachineIds,
    });
  };

  const updateProcessMachine = (i: number, machineId: string) => {
    const m = PRINT_MACHINES.find((x: any) => x.id === machineId);
    updateProcess(i, { machineId, machineName: m?.name || "" });
  };

  // ── Apply enquiry data to form ────────────────────────
  const applyEnquiry = async (enq: CombinedEnquiry) => {
    // Fetch full details (plys + consumables + processes) from detail endpoint
    let fullData: any = null;
    try {
      fullData = await apiGet<any>(`api/gravureEnquiryShrink/getenquirybyid/${enq.id}`);
    } catch { /* fallback to header-only data */ }

    const apiPlys: any[]  = fullData?.Plys      ?? [];
    const apiProcs: any[] = fullData?.Processes  ?? [];

    const secondaryLayers: SecondaryLayer[] = apiPlys.map((ply: any, i: number) => ({
      id: Math.random().toString(),
      layerNo: i + 1,
      plyType: String(ply.PlyType || "Film"),
      itemSubGroup: String(ply.FilmSubGroup || ""),
      density: Number(ply.Density) || 0,
      thickness: Number(ply.Thickness) || 0,
      gsm: Number(ply.FilmGSM) || 0,
      itemId: String(ply.ItemID || ""),
      itemName: String(ply.ItemName || ""),
      consumableItems: (ply.Consumables ?? []).map((c: any) => ({
        consumableId: Math.random().toString(),
        fieldDisplayName: String(c.FieldDisplayName || ""),
        itemGroup: String(c.ItemGroup || ""),
        itemSubGroup: String(c.ItemSubGroup || ""),
        itemId: String(c.ItemID || ""),
        itemName: String(c.ItemName || ""),
        gsm: Number(c.GSM) || 0,
        rate: Number(c.Rate) || 0,
        coveragePct: Number(c.CoveragePct) || 100,
      })),
    }));

    const processRows: GravureEstimationProcess[] = apiProcs
      .map((p: any) => {
        const procId = String(p.ProcessID || "");
        const pm = ROTO_PROCESSES.find((r: any) => r.id === procId);
        if (!pm) return null;
        const pmMachineIds: string[] = (pm as any).machineIds || [];
        const autoMachineId = pmMachineIds.length === 1
          ? pmMachineIds[0]
          : (pmMachineIds.length === 0 ? ((pm as any).machineId || "") : "");
        const autoMachine = PRINT_MACHINES.find((m: any) => m.id === autoMachineId);
        return {
          processId: (pm as any).id,
          processName: (pm as any).name,
          chargeUnit: (pm as any).chargeUnit,
          rate: parseFloat((pm as any).rate) || 0,
          qty: 0,
          setupCharge: (pm as any).makeSetupCharges ? parseFloat((pm as any).setupChargeAmount) || 0 : 0,
          amount: 0,
          machineId: autoMachineId,
          machineName: autoMachine?.name || (pm as any).machineMasterName || "",
          machineIds: pmMachineIds,
        } as GravureEstimationProcess;
      })
      .filter((x): x is GravureEstimationProcess => x !== null);

    const totalColors = (enq.frontColors || 0) + (enq.backColors || 0) || enq.noOfColors;
    const cat = categories.find(c => c.id === enq.categoryId);
    const contentType = getDisplayContentType(enq.selectedContent || "");
    const isSleeve = contentType.toLowerCase().includes("sleeve");

    patchDim({
      topSeal:         enq.topSeal         || 0,
      bottomSeal:      enq.bottomSeal      || 0,
      sideSeal:        enq.sideSeal        || 0,
      centerSealWidth: enq.centerSeal      || 0,
      gusset:          enq.gusset          || 0,
      sideGusset:      enq.sideGusset      || 0,
      sealWidth:       enq.sealWidth       || 0,
      seamingArea:     enq.seamingArea     || 0,
      transparentArea: enq.transparentArea || 0,
      ...(isSleeve
        ? { layflatWidth: enq.planWidth || 0, cutHeight: enq.planHeight || 0 }
        : { width: enq.planWidth || enq.width || 0, height: enq.planHeight || 0 }),
    });

    setForm(p => ({
      ...p,
      enquiryId: enq.id,
      enquiryNo: enq.enquiryNo,
      customerId: enq.customerId,
      customerName: enq.customerName,
      jobName: enq.jobName,
      categoryId: enq.categoryId,
      categoryName: enq.categoryName || cat?.name || "",
      content: enq.selectedContent || "",
      jobWidth: enq.planWidth || enq.width || 0,
      jobHeight: enq.planHeight || 0,
      width: enq.planWidth || enq.width || 0,
      actualWidth: enq.planWidth || enq.width || 0,
      actualHeight: enq.planHeight || 0,
      noOfColors: totalColors,
      printType: (["Surface Print", "Reverse Print", "Combination"].includes(enq.printType) ? enq.printType : "Surface Print") as "Surface Print" | "Reverse Print" | "Combination",
      quantity: enq.quantity,
      unit: enq.uom,
      salesPerson: enq.salesPersonName || "",
      salesType: enq.salesType === "Domestic" ? "Local" : enq.salesType === "Exporter" ? "Export" : enq.salesType || "Local",
      concernPerson: enq.concernPerson || "",
      topSeal:         enq.topSeal         || 0,
      bottomSeal:      enq.bottomSeal      || 0,
      sideSeal:        enq.sideSeal        || 0,
      centerSealWidth: enq.centerSeal      || 0,
      gusset:          enq.gusset          || 0,
      sideGusset:      enq.sideGusset      || 0,
      seamingArea:     enq.seamingArea     || 0,
      transparentArea: enq.transparentArea || 0,
      secondaryLayers: secondaryLayers.length > 0 ? secondaryLayers : p.secondaryLayers,
      processes: processRows.length > 0 ? processRows : p.processes,
    }));
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

  // ── Load from Product Catalog ─────────────────────────────
  const loadFromCatalog = (cat: GravureProductCatalog) => {
    setForm(p => ({
      ...p,
      customerId:   cat.customerId,
      customerName: cat.customerName,
      jobName:      cat.productName,
      categoryId:   cat.categoryId,
      categoryName: cat.categoryName,
      content:      cat.content,
      structureType: (cat as any).structureType || getStructureType(cat.content),
      jobWidth:     cat.jobWidth,
      jobHeight:    cat.jobHeight,
      actualWidth:  cat.actualWidth || cat.jobWidth,
      actualHeight: cat.actualHeight || cat.jobHeight,
      width:        cat.jobWidth,
      trimmingSize: cat.trimmingSize || 0,
      widthShrinkage: (cat as any).widthShrinkage || 0,
      noOfColors:   cat.noOfColors,
      frontColors:  cat.frontColors ?? cat.noOfColors,
      backColors:   cat.backColors ?? 0,
      printType:    cat.printType,
      machineId:    cat.machineId,
      machineName:  cat.machineName,
      cylinderCostPerColor: cat.cylinderCostPerColor,
      overheadPct:  cat.overheadPct,
      profitPct:    cat.profitPct,
      secondaryLayers: cat.secondaryLayers.map((l, i) => {
        const apiFilm = l.itemId ? apiFilmItems.find(f2 => String(f2.ItemID) === String(l.itemId)) : null;
        const filmRate = ((l.filmRate ?? 0) > 0) ? l.filmRate! : (apiFilm?.EstimationRate ?? 0);
        return {
          ...l,
          id: Math.random().toString(),
          layerNo: i + 1,
          filmRate,
          consumableItems: Array.isArray(l.consumableItems)
            ? l.consumableItems.map((c: any) => {
                const apiIt = c.itemId ? apiInkItems.find(x => String(x.ItemID) === String(c.itemId)) : null;
                const finalRate = (c.rate > 0) ? c.rate : (apiIt?.EstimationRate ?? 0);
                return {
                  ...c,
                  rate:     finalRate,
                  rateUnit: c.rateUnit || apiIt?.EstimationUnit || "Kg",
                };
              })
            : [],
        };
      }),
      processes: (cat.processes || []).map(pr => ({ ...pr })),
      substrateName: cat.substrate || "",
      unit:          cat.standardUnit || "Meter",
      remarks:       cat.remarks     || "",
      perMeterRate:  cat.perMeterRate || 0,
      sellingPrice:  cat.perMeterRate || 0,
      topSeal:         (cat as any).topSeal         ?? undefined,
      bottomSeal:      (cat as any).bottomSeal      ?? undefined,
      sideSeal:        (cat as any).sideSeal        ?? undefined,
      centerSealWidth: (cat as any).centerSealWidth ?? undefined,
      sideGusset:      (cat as any).sideGusset      ?? undefined,
      gusset:          (cat as any).gusset          ?? undefined,
      seamingArea:     (cat as any).seamingArea     ?? undefined,
      transparentArea: (cat as any).transparentArea ?? undefined,
      packSize:      (cat as any).packSize      ?? undefined,
      brandName:     (cat as any).brandName     ?? undefined,
      productType:   (cat as any).productType   ?? undefined,
      skuType:       (cat as any).skuType       ?? undefined,
      bottleType:    (cat as any).bottleType    ?? undefined,
      addressType:   (cat as any).addressType   ?? undefined,
      artworkName:   (cat as any).artworkName   ?? undefined,
      specialSpecs:  (cat as any).specialSpecs  ?? undefined,
      finalRollOD:     (cat as any).finalRollOD     ?? undefined,
      rollUnit:        (cat as any).rollUnit        ?? undefined,
      unwindDirection: (cat as any).unwindDirection ?? undefined,
      salesPerson:     (cat as any).salesPerson     ?? "",
      salesType:       (cat as any).salesType       ?? "Local",
      concernPerson:   (cat as any).concernPerson   ?? "",
    }));

    setDimValues(dimsFromContent(cat.content, cat.jobWidth, cat.jobHeight, cat as any));
    setLoadedFromCatalog(cat.catalogNo);

    const savedCylAllocs = (cat as any).savedCylAllocs as EstCylAlloc[] | undefined;
    if (savedCylAllocs && savedCylAllocs.length > 0) {
      setCylAllocs(savedCylAllocs.map(c => ({ ...c, createdInMaster: c.createdInMaster ?? false, repeatUse: c.repeatUse ?? false })));
    } else {
      const n = cat.noOfColors || 0;
      setCylAllocs(Array.from({ length: n }, (_, i) => ({
        colorNo:      i + 1,
        colorName:    `Color ${i + 1}`,
        cylinderNo:   "",
        circumference: String(cat.jobHeight || ""),
        printWidth:   String(cat.actualWidth || cat.jobWidth || ""),
        repeatUPS:    1,
        cylinderType: "New" as const,
        status:       "Pending" as const,
        remarks:      "",
        createdInMaster: false,
        repeatUse:    false,
      })));
    }
  };

  // ── Hydrate from a saved record (getestimationbyid) ─────────
  const hydrateFromRecord = async (id: string) => {
    setIsHydrating(true);
    try {
      const full = await apiGet<any[]>(`api/gravureestimationShrink/getestimationbyid/${id}`);
      if (!Array.isArray(full) || full.length === 0) return;
      const r = full[0];
      let layers: any[] = [];
      let processes: any[] = [];
      let materials: any[] = [];
      let qtyOverridesRaw: any[] = [];
      try { layers          = JSON.parse(r.GrvLayersJSON      || "[]"); } catch {}
      try { processes       = JSON.parse(r.GrvProcessesJSON   || "[]"); } catch {}
      try { materials       = JSON.parse(r.GrvMaterialsJSON   || "[]"); } catch {}
      try { qtyOverridesRaw = JSON.parse(r.GrvQtyOverridesJSON|| "[]"); } catch {}

      // Normalise layers — data may come from JobBookingContentsLayerDetail (DB table) or GrvLayersJSON (JSON blob).
      const normLayers = layers.map((l: any, i: number) => ({
        ...l,
        id:           Math.random().toString(),
        layerNo:      i + 1,
        plyType:      String(l.plyTypeLabel || l.plyType || ""),
        itemId:       String(l.itemId ?? ""),
        itemSubGroupId: String(l.itemSubGroupId ?? ""),
        itemSubGroup: String(l.itemSubGroup ?? ""),
        density:      Number(l.density ?? 0),
        gsm:          Number(l.gsm ?? 0),
        filmRate:     Number(l.filmRate ?? 0),
        thickness:    Number(l.thickness ?? 0),
        consumableItems: Array.isArray(l.consumableItems)
          ? l.consumableItems.map((c: any) => ({
              ...c,
              consumableId:   String(c.consumableId ?? Math.random()),
              itemId:         String(c.itemId ?? ""),
              itemGroup:      String(c.itemGroup ?? ""),
              itemSubGroupId: String(c.itemSubGroupId ?? ""),
              itemSubGroup:   String(c.itemSubGroup ?? ""),
              gsm:            Number(c.gsm ?? 0),
              liquidGsm:      Number(c.liquidGsm ?? 0),
              ratioPct:       Number(c.ratioPct ?? 0),
              coveragePct:    Number(c.coveragePct ?? 100),
              solidPct:       Number(c.solidPct > 0 ? c.solidPct : (c.solidPercentage > 0 ? c.solidPercentage : 40)),
              rate:           Number(c.rate ?? 0),
              fieldDisplayName: String(c.fieldDisplayName ?? ""),
            }))
          : [],
      }));

      const fullRow = {
        ...blank,
        estimationNo: String(r.GrvEstimationCode ?? ""),
        date:         parseApiDate(r.GrvEstimationDate),
        customerId:   String(r.CustomerID  ?? ""),
        customerName: String(r.CustomerName ?? ""),
        categoryId:   String(r.CategoryID  ?? ""),
        categoryName: String(r.CategoryName ?? ""),
        enquiryId:    String(r.EnquiryID   ?? ""),
        enquiryNo:    String(r.EnquiryNo   ?? ""),
        jobName:      String(r.JobName     ?? ""),
        content:      String(r.Content     ?? ""),
        jobWidth:     Number(r.JobWidth    ?? 0),
        jobHeight:    Number(r.JobHeight   ?? 0),
        actualWidth:  Number(r.ActualWidth ?? 0),
        actualHeight: Number(r.ActualHeight ?? 0),
        width:        Number(r.Width       ?? 0),
        noOfColors:   Number(r.NoOfColors  ?? 0),
        frontColors:  Number(r.FrontColors ?? 0),
        backColors:   Number(r.BackColors  ?? 0),
        printType:    String(r.PrintType   ?? "Surface Print") as any,
        substrateItemId: String(r.SubstrateItemId ?? ""),
        substrateName:   String(r.SubstrateName   ?? ""),
        quantity:     Number(r.Quantity    ?? 0),
        unit:         String(r.Unit        ?? "Kg") as any,
        machineId:    (() => {
          const savedId   = String(r.MachineID   ?? "");
          const savedName = String(r.MachineName ?? "");
          if (savedId && (PRINT_MACHINES as any[]).find((m: any) => m.id === savedId)) return savedId;
          if (savedName) {
            const byName = (PRINT_MACHINES as any[]).find((m: any) =>
              m.name === savedName || m.name?.toLowerCase() === savedName.toLowerCase()
            );
            if (byName) return String((byName as any).id);
          }
          return savedId;
        })(),
        machineName:  (() => {
          const savedId   = String(r.MachineID   ?? "");
          const savedName = String(r.MachineName ?? "");
          if (savedName && (PRINT_MACHINES as any[]).find((m: any) => m.id === savedId)) return savedName;
          if (savedName) {
            const byName = (PRINT_MACHINES as any[]).find((m: any) =>
              m.name === savedName || m.name?.toLowerCase() === savedName.toLowerCase()
            );
            if (byName) return String((byName as any).name);
          }
          return savedName;
        })(),
        cylinderCostPerColor:  Number(r.CylinderCostPerColor  ?? 3500),
        cylinderRatePerSqInch: Number(r.CylinderRatePerSqInch ?? 2.5),
        repeatLength:  Number(r.RepeatLength  ?? 0),
        trimmingSize:  Number(r.TrimmingSize  ?? 0),
        widthShrinkage:Number(r.WidthShrinkage ?? 0),
        sleeveWidth:   Number(r.SleeveWidth   ?? 0),
        wastagePct:    Number(r.WastagePct    ?? 1),
        setupTime:     Number(r.SetupTime     ?? 0),
        machineCostPerHour:     Number(r.MachineCostPerHour     ?? 1350),
        machineShiftHours:      Number(r.MachineShiftHours      ?? 8),
        machineBaseCostPerHour: Number(r.MachineBaseCostPerHour ?? 1350),
        minimumOrderValue:      Number(r.MinimumOrderValue      ?? 0),
        sellingPrice:  Number(r.SellingPrice  ?? 0),
        overheadPct:   Number(r.OverheadPct   ?? 12),
        profitPct:     Number(r.ProfitPct     ?? 15),
        materialCost:  Number(r.MaterialCost  ?? 0),
        processCost:   Number(r.ProcessCost   ?? 0),
        cylinderCost:  Number(r.CylinderCost  ?? 0),
        setupCost:     Number(r.SetupCost     ?? 0),
        packingCost:   Number(r.PackingCost   ?? 0),
        packingBoxRate:       Number(r.PackingBoxRate        ?? 80),
        packingCoilsPerBox:   Number(r.PackingCoilsPerBox   ?? 6),
        packingCoilWt:        Number(r.PackingCoilWt        ?? 15),
        packingPlugsPerBox:   Number(r.PackingPlugsPerBox   ?? 12),
        packingPlugRate:      Number(r.PackingPlugRate      ?? 2),
        packingTapeRate:      Number(r.PackingTapeRate      ?? 40),
        packingTapeMetres:    Number(r.PackingTapeMetres    ?? 10),
        packingStretchFilmGm: Number(r.PackingStretchFilmGm ?? 200),
        packingStretchFilmRate:Number(r.PackingStretchFilmRate ?? 90),
        cylinderCostOverride: r.CylinderCostOverride > 0 ? Number(r.CylinderCostOverride) : undefined,
        setupCostOverride:    r.SetupCostOverride    > 0 ? Number(r.SetupCostOverride)    : undefined,
        packingCostOverride:  r.PackingCostOverride  > 0 ? Number(r.PackingCostOverride)  : undefined,
        labourCost:          Number(r.LabourCost          ?? 0),
        transportationCost:  Number(r.TransportationCost  ?? 0),
        interestCost:        Number(r.InterestCost        ?? 0),
        depreciationCost:    Number(r.DepreciationCost    ?? 0),
        loanAmount:          Number(r.LoanAmount          ?? 0),
        loanInterestRatePct: Number(r.LoanInterestRatePct ?? 12),
        monthlyLabourSalary: Number(r.MonthlyLabourSalary ?? 0),
        workingDaysPerMonth: Number(r.WorkingDaysPerMonth ?? 25),
        jobRunHours:         Number(r.JobRunHours         ?? 0),
        overheadAmt:         Number(r.OverheadAmt         ?? 0),
        profitAmt:           Number(r.ProfitAmt           ?? 0),
        totalAmount:         Number(r.TotalAmount         ?? 0),
        perMeterRate:        Number(r.PerMeterRate        ?? 0),
        marginPct:           Number(r.MarginPct           ?? 0),
        contribution:        Number(r.Contribution        ?? 0),
        breakEvenQty:        Number(r.BreakEvenQty        ?? 0),
        topSeal:         r.TopSeal         ?? undefined,
        bottomSeal:      r.BottomSeal      ?? undefined,
        sideSeal:        r.SideSeal        ?? undefined,
        centerSealWidth: r.CenterSealWidth ?? undefined,
        sideGusset:      r.SideGusset      ?? undefined,
        gusset:          r.Gusset          ?? undefined,
        seamingArea:     r.SeamingArea     ?? undefined,
        transparentArea: r.TransparentArea ?? undefined,
        hasZipper:       Number(r.HasZipper      ?? 0) === 1,
        hasSpout:        Number(r.HasSpout       ?? 0) === 1,
        hasValve:        Number(r.HasValve       ?? 0) === 1,
        hasWindow:       Number(r.HasWindow      ?? 0) === 1,
        hasTearNotch:    Number(r.HasTearNotch   ?? 0) === 1,
        hasEuroHole:     Number(r.HasEuroHole    ?? 0) === 1,
        hasRoundCorner:  Number(r.HasRoundCorner ?? 0) === 1,
        laminationPlies: Number(r.LaminationPlies ?? 0),
        zipperWeight:    Number(r.ZipperWeight   ?? 0),
        spoutWeight:     Number(r.SpoutWeight    ?? 0),
        packSize:         r.PackSize        ?? undefined,
        brandName:        r.BrandName       ?? undefined,
        productType:      r.ProductType     ?? undefined,
        skuType:          r.SkuType         ?? undefined,
        bottleType:       r.BottleType      ?? undefined,
        addressType:      r.AddressType     ?? undefined,
        artworkName:      r.ArtworkName     ?? undefined,
        specialSpecs:     r.SpecialSpecs    ?? undefined,
        finalRollOD:      r.FinalRollOD     ?? undefined,
        rollUnit:         r.RollUnit        ?? undefined,
        unwindDirection:  r.UnwindDirection ?? undefined,
        status:     String(r.Status     ?? "Draft") as any,
        remarks:    String(r.Remarks    ?? ""),
        salesPerson:String(r.SalesPerson ?? ""),
        salesType:  String(r.SalesType   ?? "Local") as any,
        concernPerson: String(r.ConcernPerson ?? ""),
        secondaryLayers: normLayers,
        processes: Array.isArray(processes) ? processes.map((p: any) => {
          let pid   = String(p.processId   ?? "");
          let pname = String(p.processName ?? "");
          if ((!pid || pid === "0" || pid === "null") && pname && (ROTO_PROCESSES as any[]).length > 0) {
            const matched = (ROTO_PROCESSES as any[]).find((proc: any) =>
              proc.name === pname ||
              proc.displayName === pname ||
              (proc.name || "").toLowerCase() === pname.toLowerCase()
            );
            if (matched) { pid = String(matched.id); pname = String(matched.name); }
          }
          let mid   = String(p.machineId   ?? "");
          let mname = String(p.machineName ?? "");
          const pm  = (ROTO_PROCESSES as any[]).find((proc: any) => proc.id === pid);
          const pmMachineIds: string[] = pm?.machineIds || [];
          if (!mid || mid === "0" || mid === "null") {
            if (pmMachineIds.length === 1) {
              mid   = pmMachineIds[0];
              mname = (PRINT_MACHINES as any[]).find((m: any) => m.id === mid)?.name
                      || pm?.machineMasterName || mname;
            } else if (pmMachineIds.length === 0 && pm?.machineId) {
              mid   = String(pm.machineId);
              mname = (PRINT_MACHINES as any[]).find((m: any) => m.id === mid)?.name
                      || pm?.machineMasterName || mname;
            }
          }
          return {
            processId:   pid,
            processName: pname,
            chargeUnit:  String(p.chargeUnit  ?? ""),
            rate:        Number(p.rate        ?? 0),
            qty:         0,
            setupCharge: Number(p.setupCharge ?? 0),
            amount:      0,
            machineId:   mid,
            machineName: mname,
            machineIds:  pmMachineIds,
            runHours:    Number(p.runHours    ?? 0),
            interestCost:Number(p.interestCost ?? 0),
            labourCost:  Number(p.labourCost  ?? 0),
          };
        }) : [],
        materials: Array.isArray(materials) ? materials.map((m: any) => ({
          itemId:   String(m.itemId   ?? ""),
          itemCode: String(m.itemCode ?? ""),
          itemName: String(m.itemName ?? ""),
          group:    String(m.group    ?? ""),
          unit:     String(m.unit     ?? "Kg"),
          rate:     Number(m.rate     ?? 0),
          qty:      Number(m.qty      ?? 0),
          amount:   Number(m.amount   ?? 0),
        })) : [],
      } as unknown as typeof blank;

      setForm(fullRow);
      setEditingMeta({ id, estimationNo: String(r.GrvEstimationCode ?? "") });
      setExtraQtys([]);
      setActiveQtyIdx(0);
      setLoadedFromCatalog("");
      setDimValues(dimsFromContent(fullRow.content, fullRow.jobWidth, fullRow.jobHeight, fullRow as any));

      // Restore extra quantities (Q2, Q3...) from saved Quantities array
      try {
        const qtys: number[] = JSON.parse(r.QuantitiesJSON || "[]");
        if (Array.isArray(qtys) && qtys.length > 1)
          setExtraQtys(qtys.slice(1).map(Number).filter((q: number) => q > 0));
      } catch {}
      // Restore per-qty cost overrides from JobBookingGrvQtyOverrides
      try {
        if (Array.isArray(qtyOverridesRaw) && qtyOverridesRaw.length > 0) {
          const arr: QtyOverride[] = [];
          qtyOverridesRaw.forEach((ov: any) => {
            const idx = Number(ov.QtyIndex ?? ov.qtyIndex ?? 0);
            const entry: QtyOverride = {};
            if (ov.labourCost           != null) entry.labourCost           = Number(ov.labourCost);
            if (ov.transportationCost   != null) entry.transportationCost   = Number(ov.transportationCost);
            if (ov.interestCost         != null) entry.interestCost         = Number(ov.interestCost);
            if (ov.overheadPct          != null) entry.overheadPct          = Number(ov.overheadPct);
            if (ov.profitPct            != null) entry.profitPct            = Number(ov.profitPct);
            if (ov.cylinderCostOverride != null) entry.cylinderCostOverride = Number(ov.cylinderCostOverride);
            if (ov.setupCostOverride    != null) entry.setupCostOverride    = Number(ov.setupCostOverride);
            if (ov.packingCostOverride  != null) entry.packingCostOverride  = Number(ov.packingCostOverride);
            arr[idx] = entry;
          });
          setQtyOverrides(arr);
        }
      } catch {}
      // Restore color shades and cylinder allocs
      try { const s = JSON.parse(r.GrvColorShadesJSON || "[]"); if (Array.isArray(s) && s.length > 0) setColorShades(s); } catch {}
      try { const s = JSON.parse(r.GrvCylAllocsJSON   || "[]"); if (Array.isArray(s) && s.length > 0) setCylAllocs(s);   } catch {}
    } finally {
      setIsHydrating(false);
    }
  };

  // Auto-hydrate on mount when an estimationId is supplied
  useEffect(() => {
    if (opts.estimationId) { hydrateFromRecord(opts.estimationId); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.estimationId]);

  // ── Save ─────────────────────────────────────────────────
  const save = async () => {
    if (!form.customerId || !form.jobName || !form.machineId) {
      alert("Please fill required Basic Info & Machine."); return;
    }
    if (form.secondaryLayers.length === 0) {
      alert("Please configure Ply Details Composition."); return;
    }
    const substrateName = form.secondaryLayers.map(l => l.itemSubGroup).filter(Boolean).join(" + ") || "Multiple Plys";
    const quantities    = [form.quantity, ...extraQtys.filter(q => q > 0)];

    const payload: Record<string, any> = {
      EstimationSource: "GravureCosting",
      CustomerID:    form.customerId,
      CategoryID:    form.categoryId    || "",
      CategoryName:  form.categoryName  || "",
      EnquiryID:     form.enquiryId     || "",
      EnquiryNo:     form.enquiryNo     || "",
      JobName:       form.jobName,
      Content:       form.content       || "",
      JobWidth:      form.jobWidth      || 0,
      JobHeight:     form.jobHeight     || 0,
      ActualWidth:   form.actualWidth   || 0,
      ActualHeight:  form.actualHeight  || 0,
      Width:         form.width         || form.jobWidth || 0,
      NoOfColors:    form.noOfColors    || 0,
      FrontColors:   form.frontColors   || 0,
      BackColors:    form.backColors    || 0,
      PrintType:     form.printType     || "",
      SubstrateItemId: form.substrateItemId || "",
      SubstrateName: substrateName,
      Quantity:      form.quantity      || 0,
      Quantities:    quantities,
      Unit:          form.unit          || "Kg",
      MachineID:     form.machineId     || "",
      MachineName:   form.machineName   || "",
      CylinderCostPerColor:    form.cylinderCostPerColor    || 0,
      CylinderRatePerSqInch:   form.cylinderRatePerSqInch   || 2.5,
      RepeatLength:            form.repeatLength             || 0,
      TrimmingSize:            form.trimmingSize             || 0,
      WidthShrinkage:          form.widthShrinkage           || 0,
      SleeveWidth:             form.sleeveWidth              || 0,
      WastagePct:              form.wastagePct               || 0,
      SetupTime:               form.setupTime                || 0,
      MachineCostPerHour:      form.machineCostPerHour       || 0,
      MachineShiftHours:       form.machineShiftHours        || 0,
      MachineBaseCostPerHour:  form.machineBaseCostPerHour   || 0,
      MinimumOrderValue:       form.minimumOrderValue        || 0,
      SellingPrice:            form.sellingPrice || costs.perMeterRate || 0,
      OverheadPct:             form.overheadPct  || 0,
      ProfitPct:               form.profitPct    || 0,
      MaterialCost:            costs.materialCost,
      ProcessCost:             costs.processCost,
      CylinderCost:            costs.cylinderCost,
      SetupCost:               costs.setupCost,
      PackingCost:             costs.packingCost,
      PackingBoxRate:          form.packingBoxRate       || 0,
      PackingCoilsPerBox:      form.packingCoilsPerBox   || 0,
      PackingCoilWt:           form.packingCoilWt        || 0,
      PackingPlugsPerBox:      form.packingPlugsPerBox   || 0,
      PackingPlugRate:         form.packingPlugRate      || 0,
      PackingTapeRate:         form.packingTapeRate      || 0,
      PackingTapeMetres:       form.packingTapeMetres    || 0,
      PackingStretchFilmGm:    form.packingStretchFilmGm || 0,
      PackingStretchFilmRate:  form.packingStretchFilmRate || 0,
      CylinderCostOverride:    form.cylinderCostOverride || 0,
      SetupCostOverride:       form.setupCostOverride    || 0,
      PackingCostOverride:     form.packingCostOverride  || 0,
      LabourCost:              form.labourCost           || 0,
      TransportationCost:      form.transportationCost   || 0,
      InterestCost:            form.interestCost         || 0,
      DepreciationCost:        form.depreciationCost     || 0,
      LoanAmount:              form.loanAmount           || 0,
      LoanInterestRatePct:     form.loanInterestRatePct  || 0,
      MonthlyLabourSalary:     form.monthlyLabourSalary  || 0,
      WorkingDaysPerMonth:     form.workingDaysPerMonth  || 0,
      JobRunHours:             form.jobRunHours          || 0,
      OverheadAmt:             costs.overheadAmt,
      ProfitAmt:               costs.profitAmt,
      TotalAmount:             costs.totalAmount,
      PerMeterRate:            costs.perMeterRate,
      PerMeterRateWithoutProfit: costs.perMeterRateWithoutProfit,
      MarginPct:               costs.marginPct,
      Contribution:            costs.contribution,
      BreakEvenQty:            costs.breakEvenQty,
      TopSeal:         form.topSeal         || 0,
      BottomSeal:      form.bottomSeal      || 0,
      SideSeal:        form.sideSeal        || 0,
      CenterSealWidth: form.centerSealWidth || 0,
      SideGusset:      form.sideGusset      || 0,
      Gusset:          form.gusset          || 0,
      SeamingArea:     form.seamingArea     || 0,
      TransparentArea: form.transparentArea || 0,
      HasZipper:       (form as any).hasZipper       ? 1 : 0,
      HasSpout:        (form as any).hasSpout        ? 1 : 0,
      HasValve:        (form as any).hasValve        ? 1 : 0,
      HasWindow:       (form as any).hasWindow       ? 1 : 0,
      HasTearNotch:    (form as any).hasTearNotch    ? 1 : 0,
      HasEuroHole:     (form as any).hasEuroHole     ? 1 : 0,
      HasRoundCorner:  (form as any).hasRoundCorner  ? 1 : 0,
      LaminationPlies: (form as any).laminationPlies ?? 0,
      ZipperWeight:    (form as any).zipperWeight    ?? 0,
      SpoutWeight:     (form as any).spoutWeight     ?? 0,
      PackSize:        form.packSize        || "",
      BrandName:       form.brandName       || "",
      ProductType:     form.productType     || "",
      SkuType:         form.skuType         || "",
      BottleType:      form.bottleType      || "",
      AddressType:     form.addressType     || "",
      ArtworkName:     form.artworkName     || "",
      SpecialSpecs:    form.specialSpecs    || "",
      FinalRollOD:     form.finalRollOD     || 0,
      RollUnit:        form.rollUnit        || "",
      UnwindDirection: form.unwindDirection || "",
      Status:          form.status          || "Draft",
      Remarks:         form.remarks         || "",
      SalesPerson:     form.salesPerson     || "",
      SalesType:       form.salesType       || "Local",
      ConcernPerson:   form.concernPerson   || "",
      EstimationDate:  form.date            || new Date().toISOString().slice(0, 10),
      SourceProductMasterID: loadedFromCatalog || "",
      Attachments: [] as { name: string; mimeType: string; url: string; label: string }[],
      SecondaryLayers: form.secondaryLayers,
      Processes:       form.processes,
      ColorShades:     colorShades,
      CylAllocs:       cylAllocs,
      Materials:       form.materials,
      QtyOverrides:    allQtys.map((qty, i) => ({ qtyIndex: i, quantity: qty, ...(qtyOverrides[i] ?? {}) })),
    };

    setSaving(true);
    try {
      // Upload new attachments (with fileObj) to S3, keep existing S3 URLs as-is
      const uploadedAttachments = await Promise.all(
        attachments.map(async (a) => {
          if (a.fileObj) {
            try {
              const { "Content-Type": _ct, ...hdrs } = authHeaders();
              const fd = new FormData();
              fd.append("file", a.fileObj, a.fileObj.name);
              const uploadRes = await fetch(`${API_BASE}/api/gravureestimationShrink/upload`, { method: "POST", headers: hdrs, body: fd });
              if (uploadRes.ok) {
                const { publicUrl } = await uploadRes.json();
                return { name: a.name, mimeType: a.mimeType, url: publicUrl, label: a.label ?? "" };
              }
            } catch { /* keep existing url on error */ }
          }
          return { name: a.name, mimeType: a.mimeType, url: a.url, label: a.label ?? "" };
        })
      );
      payload.Attachments = uploadedAttachments;

      let res: any;
      if (editingMeta) {
        payload.BookingID        = editingMeta.id;
        payload.GrvEstimationCode = editingMeta.estimationNo;
        res = await apiPost("api/gravureestimationShrink/updateestimation", payload);
      } else {
        res = await apiPost("api/gravureestimationShrink/saveestimation", payload);
      }
      const parsed = Array.isArray(res) ? res[0] : res;
      if (parsed?.Status !== "success") {
        alert("Save failed: " + (parsed?.Message || "Unknown error"));
        return false;
      }
      return true;
    } catch (err: any) {
      alert("Save error: " + (err?.message || String(err)));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    // Core form
    form, setForm, f,
    dimValues, patchDim,
    loadedFromCatalog, setLoadedFromCatalog,
    editingMeta,

    // Costs
    costs, breakdown, rateOpts, processMinChargeMap,

    // Quantity clones
    extraQtys, setExtraQtys,
    allQtys, allCosts, allBreakdowns,
    activeQtyIdx, setActiveQtyIdx, activeCosts, activeQty,
    qtyOverrides, setQtyOverride,

    // Cylinder
    cylAllocs, setCylAllocs, cylCostFromAllocs, cylCostBreakdown,
    openEstCylinderMaster, refreshEstFromCylinderMaster,

    // Color shades
    colorShades, setColorShades,

    // Attachments
    attachments, setAttachments, addAttachments, removeAttachment,
    editingAttachLabel, setEditingAttachLabel,
    previewAttachment, setPreviewAttachment,

    // Materials
    addMaterial, removeMaterial, updateMaterial, selectMaterialItem,

    // Processes
    addProcess, removeProcess, updateProcess, selectProcess, updateProcessMachine,

    // Ply / category
    onPlyTypeChange, addPlyConsumable, removePlyConsumable, updatePlyConsumable,
    applyCategory,

    // Loading data
    applyEnquiry, loadFromCatalog, hydrateFromRecord, isHydrating,

    // Misc
    getStructureType, initEstPrepData,

    // Save
    saving, save,
  };
}

export type EstimationInstance = ReturnType<typeof useEstimationInstance>;
