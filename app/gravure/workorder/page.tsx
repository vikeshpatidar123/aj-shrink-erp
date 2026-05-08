"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Eye, Pencil, Trash2, Printer, CheckCircle2, ClipboardList,
  Clock, RefreshCw, Edit3, Calculator, BookMarked, ChevronRight,
  Layers, AlertCircle, ArrowRight, Plus, X, Check, Search,
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
import { DimensionDiagram, DimensionInputPanel, DimValues, CONTENT_TYPE_CONFIG } from "@/components/gravure/DimensionDiagram";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { apiGet, apiPost } from "@/lib/api";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

const INK_COLORS = ["Cyan", "Magenta", "Yellow", "Black", "White", "Red", "Green", "Blue", "Orange", "Gold", "Silver", "Violet", "Brown", "Pink"];

// ─── COLOR QC — MODULAR FUNCTIONS ────────────────────────────────────────────

/** 1. ΔE CIE 1976 */
function calculateDeltaE(
  stdL: string, stdA: string, stdB: string,
  measL: string, measA: string, measB: string,
): string {
  if (!stdL || !stdA || !stdB || !measL || !measA || !measB) return "--";
  const dL = Number(stdL) - Number(measL);
  const da = Number(stdA) - Number(measA);
  const db = Number(stdB) - Number(measB);
  return Math.sqrt(dL * dL + da * da + db * db).toFixed(2);
}

/** 2. Individual channel deltas (std − meas) */
type DeltaLAB = { dL: number; da: number; db: number } | null;
function calculateDeltaLAB(
  stdL: string, stdA: string, stdB: string,
  measL: string, measA: string, measB: string,
): DeltaLAB {
  if (!stdL || !stdA || !stdB || !measL || !measA || !measB) return null;
  return {
    dL: parseFloat((Number(stdL) - Number(measL)).toFixed(2)),
    da: parseFloat((Number(stdA) - Number(measA)).toFixed(2)),
    db: parseFloat((Number(stdB) - Number(measB)).toFixed(2)),
  };
}

/** 3. QC Status — strict threshold logic */
type QCStatus = "PASS" | "WARNING" | "FAIL" | "NOT MEASURED";
function getStatus(deltaE: string, tol: string): QCStatus {
  if (deltaE === "--") return "NOT MEASURED";
  const de = Number(deltaE), t = Number(tol) || 1;
  if (de < t) return "PASS";
  if (Math.abs(de - t) < 0.005) return "WARNING"; // de ≈ tolerance
  return "FAIL";
}

/** 4. Severity level based on ΔE magnitude */
type Severity = "Low" | "Medium" | "High";
function getSeverity(deltaE: string): Severity | null {
  if (deltaE === "--") return null;
  const de = Number(deltaE);
  if (de <= 1.0) return "Low";
  if (de <= 3.0) return "Medium";
  return "High";
}

/** 5. Priority-based color correction insights */
type InsightEntry = { axis: string; val: number; suggestion: string; inkAdj: string; cls: string };
type InsightResult = { primary: InsightEntry | null; secondary: InsightEntry[] };
function getColorInsight(
  stdL: string, stdA: string, stdB: string,
  measL: string, measA: string, measB: string,
): InsightResult {
  const d = calculateDeltaLAB(stdL, stdA, stdB, measL, measA, measB);
  if (!d) return { primary: null, secondary: [] };
  const THR = 0.5;
  // ΔL = std − meas: positive → measured darker; negative → measured lighter
  const candidates: InsightEntry[] = [
    d.dL > THR ? { axis: "ΔL", val: d.dL, suggestion: "Too Dark", inkAdj: `Reduce ink ~${Math.min(50, Math.round(Math.abs(d.dL) * 2))}%`, cls: "text-slate-700  bg-slate-50  border-slate-300" } : null,
    d.dL < -THR ? { axis: "ΔL", val: d.dL, suggestion: "Too Light", inkAdj: `Increase ink ~${Math.min(50, Math.round(Math.abs(d.dL) * 2))}%`, cls: "text-orange-700 bg-orange-50 border-orange-300" } : null,
    d.da > THR ? { axis: "Δa", val: d.da, suggestion: "Too Red", inkAdj: "Add green pigment", cls: "text-red-700   bg-red-50    border-red-300" } : null,
    d.da < -THR ? { axis: "Δa", val: d.da, suggestion: "Too Green", inkAdj: "Add red pigment", cls: "text-green-700 bg-green-50  border-green-300" } : null,
    d.db > THR ? { axis: "Δb", val: d.db, suggestion: "Too Yellow", inkAdj: "Add blue pigment", cls: "text-yellow-700 bg-yellow-50 border-yellow-300" } : null,
    d.db < -THR ? { axis: "Δb", val: d.db, suggestion: "Too Blue", inkAdj: "Add yellow pigment", cls: "text-blue-700  bg-blue-50   border-blue-300" } : null,
  ].filter(Boolean) as InsightEntry[];

  if (candidates.length === 0) return { primary: null, secondary: [] };
  candidates.sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
  const [primary, ...secondary] = candidates;
  return { primary, secondary };
}

// Keep alias so existing onChange handlers compile without change
const calcDeltaE = calculateDeltaE;
const INK_ITEMS = items.filter(i => i.group === "Ink" && i.active);
const VENDOR_LEDGERS = ledgers.filter(l => (l.ledgerType === "Supplier" || l.ledgerType === "Vendor") && l.status === "Active");
const CYLINDER_TOOLS_ALL = allTools.filter(t => t.toolType === "Cylinder");
const SLEEVE_TOOLS_ALL = allTools.filter(t => t.toolType === "Sleeve");
const ROTO_PROCESSES = processMasters.filter(p => p.module === "Rotogravure");
const PRINT_MACHINES = machines.filter(m => m.department === "Printing");
const AVAILABLE_TOOL_IDS = new Set(toolInventory.filter(ti => ti.status === "Available").map(ti => ti.toolId));
const SLEEVE_TOOLS = allTools.filter(t => t.toolType === "Sleeve" && AVAILABLE_TOOL_IDS.has(t.id)).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
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
    { id: "DEF_INK", plyType: "Printing", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", fieldDisplayName: "Ink", defaultValue: 3.5, minValue: 1, maxValue: 8, sharePercentageFormula: "" },
    { id: "DEF_SOL", plyType: "Printing", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", fieldDisplayName: "Solvent", defaultValue: 2.0, minValue: 0.5, maxValue: 5, sharePercentageFormula: "" },
  ],
  Lamination: [
    { id: "DEF_ADH", plyType: "Lamination", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive", fieldDisplayName: "Adhesive", defaultValue: 3.5, minValue: 2, maxValue: 6, sharePercentageFormula: "" },
    { id: "DEF_HRD", plyType: "Lamination", itemGroup: "Hardner", itemSubGroup: "PU Hardener", fieldDisplayName: "Hardener", defaultValue: 0.7, minValue: 0.3, maxValue: 1.5, sharePercentageFormula: "" },
  ],
  Coating: [
    { id: "DEF_CTG", plyType: "Coating", itemGroup: "Adhesive", itemSubGroup: "Coating Adhesive", fieldDisplayName: "Coating", defaultValue: 3.0, minValue: 1, maxValue: 6, sharePercentageFormula: "" },
  ],
};

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-gray-50 text-gray-600 border-gray-200",
  "In Progress": "bg-yellow-50 text-yellow-700 border-yellow-200",
  Completed: "bg-green-50 text-green-700 border-green-200",
  "On Hold": "bg-red-50 text-red-700 border-red-200",
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
  // Structure & dimension extras
  structureType: undefined,
  trimmingSize: 0, widthShrinkage: 0,
  gusset: 0, topSeal: 0, bottomSeal: 0,
  sideSeal: 0, centerSealWidth: 0, sideGusset: 0,
  seamingArea: 0, transparentArea: 0,
  finalRollOD: undefined, rollUnit: "Meter",
  unwindDirection: 0,
  frontColors: 4, backColors: 2,
  salesPerson: "", salesType: "Local",
  machineId: "", machineName: "",
  cylinderCostPerColor: 3500,
  operatorId: "", operatorName: "",
  cylinderSet: "", inks: [],
  quantity: 0, unit: "Meter",
  wastagePct: 1,
  plannedDate: "",
  processes: [], secondaryLayers: [],
  selectedPlanId: "", ups: 0,
  overheadPct: 12, profitPct: 15,
  perMeterRate: 0, totalAmount: 0,
  specialInstructions: "",
  status: "Open",
};

// ─── Auto-process qty helper (mirrors estimation) ────────────
function autoProcessQty(chargeUnit: string, qty: number, areaM2: number, colors: number): number {
  if (chargeUnit === "m²") return parseFloat(areaM2.toFixed(4));
  if (chargeUnit === "Meter") return qty;
  if (chargeUnit === "Cylinder") return colors;
  return 0;
}

// ─── Section Header ────────────────────────────────────────────
const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2 pb-2 border-b border-purple-100">{label}</p>
);


export default function GravureWorkOrderPage() {
  const { categories } = useCategories();
  const { catalog, saveCatalogItem } = useProductCatalog();
  const [workOrders, setWOs] = useState<GravureWorkOrder[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [apiPrefix, setApiPrefix] = useState("GRV");
  const [orders, setOrders] = useState<GravureOrder[]>([]);
  const [pageTab, setPageTab] = useState<"pending" | "workorders">("pending");
  const [modalOpen, setModal] = useState(false);
  const [viewRow, setViewRow] = useState<GravureWorkOrder | null>(null);
  const [printWO, setPrintWO] = useState<GravureWorkOrder | null>(null);
  const [editing, setEditing] = useState<GravureWorkOrder | null>(null);
  const [form, setForm] = useState<Omit<GravureWorkOrder, "id" | "workOrderNo">>(blankWO);
  const [replanOpen, setReplan] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<"basic" | "planning" | "material">("basic");
  const [pendingWOCategoryId, setPendingWOCategoryId] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [isPlanApplied, setIsPlanApplied] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [planSort, setPlanSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "", dir: "asc" });
  const [planColFilters, setPlanColFilters] = useState<Record<string, Set<string>>>({});
  const [planFilterOpen, setPlanFilterOpen] = useState<string | null>(null);
  const [planFilterSearch, setPlanFilterSearch] = useState<Record<string, string>>({});
  const [planFilterDraft, setPlanFilterDraft] = useState<Record<string, Set<string>>>({});

  // DB machines fetched from API (replaces dummyData PRINT_MACHINES for dropdowns)
  const [dbMachines, setDbMachines] = useState<{ id: string; name: string; maxWebWidth: number; minWebWidth: number; maxCirc: number; minCirc: number; speed: number }[]>([]);

  // Holds savedPlan object from product catalog for planId reconciliation
  const catalogSavedPlanRef = useRef<any>(null);
  const pendingPWOOrderRef = useRef<any>(null);

  // ── Production Preparation Types ────────────────────────────
  type FilmRequisition = { source: "Extrusion" | "Purchase" | ""; status: "Pending" | "Requested" | "Available"; requiredDate?: string; spec?: string; priority?: string; vendor?: string; expectedRate?: number; remarks?: string; };
  type ColorShade = { colorNo: number; colorName: string; inkType: "Spot" | "Process" | "Special"; pantoneRef: string; labL: string; labA: string; labB: string; labLMeas: string; labAMeas: string; labBMeas: string; deltaE: string; deltaETol: string; shadeCardRef: string; status: "Pending" | "Standard Received" | "Approved" | "Rejected"; remarks: string; };
  type MaterialAlloc = { id: string; plyNo?: number; materialType: string; materialName: string; requiredQty: number; unit: string; allocatedQty: number; lotNo: string; location: string; status: "Pending" | "Partial" | "Allocated"; };
  type CylinderAlloc = { colorNo: number; colorName: string; cylinderNo: string; circumference: string; cylinderType: "New" | "Existing" | "Rechromed"; status: "Pending" | "Available" | "In Use" | "Under Chrome" | "Ordered"; remarks: string; };
  const [filmReqs, setFilmReqs] = useState<FilmRequisition[]>([]);
  const [colorShades, setColorShades] = useState<ColorShade[]>([]);
  const [materialAllocs, setMaterialAllocs] = useState<MaterialAlloc[]>([]);
  const [cylinderAllocs, setCylinderAllocs] = useState<CylinderAlloc[]>([]);
  const [prepTab, setPrepTab] = useState<"film" | "shade" | "material" | "tool">("film");
  // ── New Cylinder Modal (for life-expired cylinder replacement) ─
  type NewCylModalState = { rowIdx: number; fromTool: typeof CYLINDER_TOOLS_ALL[number] };
  const [newCylModal, setNewCylModal] = useState<NewCylModalState | null>(null);
  const [newCylForm, setNewCylForm] = useState({ code: "", name: "", printWidth: "", repeatLength: "", shelfLifeMeters: "25000", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome" });
  const [extraCyls, setExtraCyls] = useState<(typeof CYLINDER_TOOLS_ALL[number])[]>([]);

  // ── Dimension diagram state ───────────────────────────────
  const [dimValues, setDimValues] = useState<DimValues>({});
  const patchDim = (patch: DimValues) => setDimValues(p => ({ ...p, ...patch }));

  // ── Pending order pre-fill (set on mount, applied when catalog loads) ──
  const [pendingPWOOrder, setPendingPWOOrder] = useState<any>(null);

  // ── Load work orders from API on mount; also check sessionStorage pre-fill ──
  useEffect(() => {
    // Load dropdown prefix
    apiGet<any>("api/gravureWorkOrderShrink/getdropdowns")
      .then(dd => { if (dd?.prefix) setApiPrefix(dd.prefix); })
      .catch(() => { });

    // Load real DB machines — try getmachinelist first, fallback to getdropdowns
    const mapMachine = (m: any) => ({
      id: String(m.MachineID ?? m.id ?? ""),
      name: String(m.MachineName ?? m.name ?? ""),
      maxWebWidth: Number(m.MaxRollWidth ?? m.MaxWidth ?? 1300),
      minWebWidth: Number(m.MinRollWidth ?? m.MinWidth ?? 0),
      maxCirc: Number(m.MaxCircumference ?? m.MaxLength ?? 9999),
      minCirc: Number(m.MinCircumference ?? m.MinLength ?? 0),
      speed: Number(m.Speed ?? 150),
    });
    const applyMachines = (mapped: ReturnType<typeof mapMachine>[]) => {
      setDbMachines(mapped);

      // Auto-fill machineName if form has machineId but empty name
      setForm(prev => {
        if (prev.machineId && !prev.machineName) {
          const found = mapped.find(m => m.id === prev.machineId);
          if (found) return { ...prev, machineName: found.name };
        }
        return prev;
      });
    };
    apiGet<any[]>("api/productcataloggravureShrink/getmachinelist")
      .then(rows => {
        if (Array.isArray(rows) && rows.length > 0) {
          applyMachines(rows.map(mapMachine));
        } else {
          // Fallback: pull machines from getdropdowns endpoint
          apiGet<any>("api/gravureWorkOrderShrink/getdropdowns")
            .then(dd => {
              if (Array.isArray(dd?.machines) && dd.machines.length > 0)
                applyMachines(dd.machines.map(mapMachine));
            })
            .catch(() => { });
        }
      })
      .catch(() => {
        apiGet<any>("api/gravureWorkOrderShrink/getdropdowns")
          .then(dd => {
            if (Array.isArray(dd?.machines) && dd.machines.length > 0)
              applyMachines(dd.machines.map(mapMachine));
          })
          .catch(() => { });
      });

    // Load work order list — replace dummy data only when API responds with real rows
    apiGet<any[]>("api/gravureWorkOrderShrink/getworkorders")
      .then(rows => {
        if (Array.isArray(rows)) setWOs(rows.map(mapApiToWO));
      })
      .catch(() => { /* keep initWOs on API error */ });

    // Pre-fill from Order Booking "Create PWO" button — save for catalog-aware effect
    try {
      const raw = sessionStorage.getItem("createPWOFromOrder");
      if (raw) {
        sessionStorage.removeItem("createPWOFromOrder");
        const src = JSON.parse(raw);
        pendingPWOOrderRef.current = src;
        setPendingPWOOrder(src);
        // Basic fill immediately so modal opens with customer info
        setForm(f => ({
          ...f,
          sourceOrderType: "Catalog",
          orderId: String(src.orderId ?? ""),
          orderNo: String(src.orderNo ?? ""),
          customerId: String(src.customerId ?? ""),
          customerName: String(src.customerName ?? ""),
          salesType: String(src.salesType ?? ""),
        }));
        setModal(true);
        setModalTab("basic");
      }
    } catch { /* ignore */ }
  }, []);

  // ── When pendingPWOOrder is set, fetch all catalog data directly from API ──
  useEffect(() => {
    const src = pendingPWOOrder ?? pendingPWOOrderRef.current;
    if (!src) return;
    const lines: any[] = Array.isArray(src.lines) ? src.lines : [];
    const line = lines[0];
    if (!line) {
      pendingPWOOrderRef.current = null;
      setPendingPWOOrder(null);
      return;
    }

    const parseMaybeArray = (value: unknown): any[] => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string" && value.trim()) {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    };
    const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();
    const findFilmMeta = (layer: any) => {
      const safeLayer = layer ?? {};
      const byId = FILM_ITEMS.find(i => String(i.id) === String(safeLayer.itemId ?? ""));
      if (byId) {
        return {
          subGroup: byId.subGroup || safeLayer.itemSubGroup || "",
          density: parseFloat(byId.density) || 0,
          thickness: parseFloat(byId.thickness) || 0,
          itemName: byId.name || safeLayer.itemName || "",
        };
      }
      const byName = FILM_ITEMS.find(i =>
        norm(i.name) === norm(safeLayer.itemName) &&
        (!safeLayer.itemSubGroup || norm(i.subGroup) === norm(safeLayer.itemSubGroup))
      );
      if (byName) {
        return {
          subGroup: byName.subGroup || safeLayer.itemSubGroup || "",
          density: parseFloat(byName.density) || 0,
          thickness: parseFloat(byName.thickness) || 0,
          itemName: byName.name || safeLayer.itemName || "",
        };
      }
      const subGroupMeta = FILM_SUBGROUPS.find(s => norm(s.subGroup) === norm(safeLayer.storedSubGroup || safeLayer.itemSubGroup || ""));
      return {
        subGroup: String(safeLayer.storedSubGroup || safeLayer.itemSubGroup || ""),
        density: Number(safeLayer.filmDensity ?? safeLayer.density ?? subGroupMeta?.density ?? 0),
        thickness: Number(safeLayer.thickness ?? 0),
        itemName: String(safeLayer.itemName ?? ""),
      };
    };
    const consumableSemanticKey = (c: any) => [
      norm(c.itemId),
      norm(c.itemGroup ?? c.consumableType ?? c.itemGroupName),
      norm(c.itemSubGroup ?? c.itemSubGroupName),
      norm(c.itemName),
      norm(c.fieldDisplayName),
      Number(c.gsm ?? c.dryGSM ?? 0),
      Number(c.solidPct ?? c.solidPercentage ?? 40),
    ].join("|");
    const normalizeConsumables = (items: any[], layerKey: string) => {
      const mapped = (Array.isArray(items) ? items : []).filter(Boolean).map((c: any, idx: number) => ({
        ...c,
        consumableId: String(c?.consumableId ?? c?.ConsumableID ?? `${layerKey}-con-${idx + 1}`),
        itemId: String(c?.itemId ?? ""),
        itemName: String(c?.itemName ?? c?.ItemName ?? ""),
        fieldDisplayName: String(c?.fieldDisplayName ?? c?.itemName ?? c?.ItemName ?? ""),
        itemGroup: c?.itemGroup ?? c?.consumableType ?? c?.itemGroupName ?? "",
        itemGroupName: c?.itemGroupName ?? c?.itemGroup ?? c?.consumableType ?? "",
        itemSubGroup: c?.itemSubGroup ?? c?.itemSubGroupName ?? "",
        itemSubGroupName: c?.itemSubGroupName ?? c?.itemSubGroup ?? "",
        itemGroupId: String(c?.itemGroupId ?? ""),
        itemSubGroupId: String(c?.itemSubGroupId ?? ""),
        gsm: Number(c?.gsm ?? c?.dryGSM ?? 0),
        dryGSM: Number(c?.dryGSM ?? c?.gsm ?? 0),
        solidPct: Number(c?.solidPct ?? c?.solidPercentage ?? 40),
        solidPercentage: Number(c?.solidPercentage ?? c?.solidPct ?? 40),
      }));
      const seen = new Set<string>();
      return mapped.filter(c => {
        const key = consumableSemanticKey(c);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map((c, idx) => ({
        ...c,
        consumableId: `${layerKey}-con-${idx + 1}`,
      }));
    };
    const normalizeLayers = (items: any[]) => {
      const normalizedMapped = (Array.isArray(items) ? items : []).filter(Boolean).map((l: any, idx: number) => {
        const film = findFilmMeta(l);
        const thickness = Number(l.thickness ?? film.thickness ?? 0);
        const density = Number(l.filmDensity ?? l.density ?? film.density ?? 0);
        const gsm = Number(l.gsm ?? l.filmGSM ?? 0) || (thickness > 0 && density > 0 ? parseFloat((thickness * density).toFixed(3)) : 0);
        return {
          ...l,
          layerNo: Number(l.layerNo ?? idx + 1) || idx + 1,
          plyType: String(l.plyType ?? ""),
          itemId: String(l.itemId ?? ""),
          itemName: String(l.itemName ?? film.itemName ?? ""),
          itemSubGroup: String(l.storedSubGroup ?? l.itemSubGroup ?? film.subGroup ?? ""),
          gsm,
          thickness,
          density,
          filmGSM: gsm,
          filmRate: Number(l.rate ?? l.filmRate ?? 0),
          consumableItems: normalizeConsumables(l.consumableItems ?? l.Consumables ?? l.consumables ?? [], `layer-${idx + 1}`),
        };
      });
      const merged = new Map<number, any>();
      normalizedMapped.forEach((layer, idx) => {
        const key = layer.layerNo || idx + 1;
        if (!merged.has(key)) {
          merged.set(key, {
            ...layer,
            id: `ply-${key}`,
            layerNo: key,
          });
          return;
        }
        const prev = merged.get(key);
        const nextConsumables = normalizeConsumables(
          [...(prev.consumableItems || []), ...(layer.consumableItems || [])],
          `ply-${key}`
        );
        merged.set(key, {
          ...prev,
          ...layer,
          id: `ply-${key}`,
          layerNo: key,
          plyType: prev.plyType || layer.plyType,
          itemId: prev.itemId || layer.itemId,
          itemName: prev.itemName || layer.itemName,
          itemSubGroup: prev.itemSubGroup || layer.itemSubGroup,
          gsm: prev.gsm || layer.gsm,
          thickness: prev.thickness || layer.thickness,
          density: prev.density || layer.density,
          filmGSM: prev.filmGSM || layer.filmGSM,
          filmRate: prev.filmRate || layer.filmRate,
          consumableItems: nextConsumables,
        });
      });
      return Array.from(merged.values()).sort((a, b) => a.layerNo - b.layerNo);
    };
    const normalizeProcesses = (items: any[]) => {
      const mapped = (Array.isArray(items) ? items : []).map((p: any) => {
        const pid = String(p.processId ?? "").trim();
        const pname = String(p.processName ?? "").trim();
        const pm = ROTO_PROCESSES.find(x => x.id === pid) || ROTO_PROCESSES.find(x => x.name === pname);
        return {
          processId: pm?.id ?? pid,
          processName: (pm?.name ?? pname) || pid,
          chargeUnit: pm?.chargeUnit ?? String(p.chargeUnit ?? ""),
          rate: Number(p.rate ?? 0),
          qty: Number(p.qty ?? 0),
          setupCharge: pm?.makeSetupCharges ? parseFloat(pm.setupChargeAmount || "0") || 0 : Number(p.setupCharge ?? 0),
          amount: Number(p.amount ?? 0),
        };
      });
      const seen = new Set<string>();
      return mapped.filter(p => {
        const key = `${p.processId}|${norm(p.processName)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const safeNormalizeLayers = (items: any[], fallback: SecondaryLayer[] = []) => {
      try {
        return normalizeLayers(items);
      } catch {
        return fallback;
      }
    };
    const safeNormalizeProcesses = (items: any[], fallback: GravureEstimationProcess[] = []) => {
      try {
        return normalizeProcesses(items);
      } catch {
        return fallback;
      }
    };
    const parseNestedJson = (value: unknown) => {
      if (Array.isArray(value)) return value;
      if (typeof value !== "string" || !value.trim()) return null;
      try {
        const first = JSON.parse(value);
        if (Array.isArray(first)) return first;
        if (typeof first === "string" && first.trim()) {
          const second = JSON.parse(first);
          return Array.isArray(second) ? second : null;
        }
        return first;
      } catch {
        return null;
      }
    };
    const mapCatalogApiRow = (row: any) => {
      if (!row) return null;
      const layers = parseMaybeArray(row.SavedLayersJSON ?? row.savedLayersJSON ?? row.secondaryLayers);
      const processes = parseMaybeArray(row.SavedProcessesJSON ?? row.savedProcessesJSON ?? row.processes);
      return {
        id: String(row.ProductMasterID ?? row.productMasterID ?? row.id ?? ""),
        catalogNo: String(row.ProductMasterCode ?? row.catalogNo ?? ""),
        productName: String(row.ProductName ?? row.productName ?? ""),
        customerId: String(row.CustomerID ?? row.customerId ?? ""),
        customerName: String(row.CustomerName ?? row.customerName ?? ""),
        categoryId: String(row.CategoryID ?? row.categoryId ?? ""),
        categoryName: String(row.CategoryName ?? row.categoryName ?? ""),
        content: String(row.Content ?? row.content ?? ""),
        structureType: String(row.StructureType ?? row.structureType ?? ""),
        substrate: String(row.Substrate ?? row.substrate ?? ""),
        jobWidth: Number(row.JobWidth ?? row.jobWidth ?? 0),
        jobHeight: Number(row.JobHeight ?? row.jobHeight ?? 0),
        actualWidth: Number(row.ActualWidth ?? row.actualWidth ?? 0),
        actualHeight: Number(row.ActualHeight ?? row.actualHeight ?? 0),
        noOfColors: Number(row.NoOfColors ?? row.noOfColors ?? 0),
        frontColors: Number(row.FrontColors ?? row.frontColors ?? 0),
        backColors: Number(row.BackColors ?? row.backColors ?? 0),
        printType: String(row.PrintType ?? row.printType ?? ""),
        trimmingSize: Number(row.TrimmingSize ?? row.trimmingSize ?? 0),
        widthShrinkage: Number(row.WidthShrinkage ?? row.widthShrinkage ?? 0),
        gusset: Number(row.Gusset ?? row.gusset ?? 0),
        topSeal: Number(row.TopSeal ?? row.topSeal ?? 0),
        bottomSeal: Number(row.BottomSeal ?? row.bottomSeal ?? 0),
        sideSeal: Number(row.SideSeal ?? row.sideSeal ?? 0),
        centerSealWidth: Number(row.CenterSealWidth ?? row.centerSealWidth ?? 0),
        sideGusset: Number(row.SideGusset ?? row.sideGusset ?? 0),
        transparentArea: Number(row.TransparentArea ?? row.transparentArea ?? 0),
        seamingArea: Number(row.SeamingArea ?? row.seamingArea ?? 0),
        machineId: String(row.MachineID ?? row.GrvMachineID ?? row.machineId ?? ""),
        machineName: String(row.MachineName ?? row.GrvMachineName ?? row.machineName ?? ""),
        savedPlanId: String(row.SavedPlanID ?? row.savedPlanId ?? ""),
        savedPlan: parseNestedJson(row.ContentSizeValues ?? row.GrvSavedPlanJSON ?? row.savedPlanJSON),
        standardUnit: String(row.StandardUnit ?? row.standardUnit ?? "Meter"),
        secondaryLayers: layers,
        processes,
      };
    };

    const fallbackContent = String(src.content || line.content || "");
    const fallbackStructureType = String(src.structureType || line.structureType || (fallbackContent ? getStructureType(fallbackContent) : ""));
    const fallbackCategoryId = String(src.categoryId || line.categoryId || "");
    const snapshotCatalogItem = src.catalogSnapshot || null;
    const fallbackCategoryName = String(
      src.categoryName ||
      line.categoryName ||
      snapshotCatalogItem?.categoryName ||
      categories.find(c => c.id === fallbackCategoryId)?.name ||
      ""
    );

    setForm(f => ({
      ...f,
      sourceOrderType: "Catalog",
      orderId: String(src.orderId ?? ""),
      orderNo: String(src.orderNo ?? ""),
      customerId: String(src.customerId ?? ""),
      customerName: String(src.customerName ?? ""),
      salesType: String(src.salesType ?? ""),
      jobName: String(line.productName ?? f.jobName ?? ""),
      categoryId: fallbackCategoryId,
      categoryName: fallbackCategoryName,
      content: String(snapshotCatalogItem?.content || fallbackContent),
      structure: String(snapshotCatalogItem?.structureType || fallbackStructureType),
      structureType: String(snapshotCatalogItem?.structureType || fallbackStructureType) as any,
      substrate: String(snapshotCatalogItem?.substrate || line.substrate || f.substrate || ""),
      jobWidth: Number(snapshotCatalogItem?.jobWidth || line.jobWidth || f.jobWidth || 0),
      jobHeight: Number(snapshotCatalogItem?.jobHeight || line.jobHeight || f.jobHeight || 0),
      noOfColors: Number(snapshotCatalogItem?.noOfColors || line.noOfColors || f.noOfColors || 0),
      printType: (snapshotCatalogItem?.printType || line.printType || f.printType || "Surface Print") as any,
      quantity: Number(line.orderQty ?? f.quantity ?? 0),
      unit: String(line.unit || snapshotCatalogItem?.standardUnit || f.unit || "Meter"),
      trimmingSize: Number(snapshotCatalogItem?.trimmingSize || line.trimmingSize || f.trimmingSize || 0),
      widthShrinkage: Number(snapshotCatalogItem?.widthShrinkage || line.widthShrinkage || f.widthShrinkage || 0),
      gusset: Number(snapshotCatalogItem?.gusset || line.gusset || f.gusset || 0),
      topSeal: Number(snapshotCatalogItem?.topSeal || line.topSeal || f.topSeal || 0),
      bottomSeal: Number(snapshotCatalogItem?.bottomSeal || line.bottomSeal || f.bottomSeal || 0),
      sideSeal: Number(snapshotCatalogItem?.sideSeal || line.sideSeal || f.sideSeal || 0),
      centerSealWidth: Number(snapshotCatalogItem?.centerSealWidth || line.centerSealWidth || f.centerSealWidth || 0),
      sideGusset: Number(snapshotCatalogItem?.sideGusset || line.sideGusset || f.sideGusset || 0),
      transparentArea: Number(snapshotCatalogItem?.transparentArea || line.transparentArea || f.transparentArea || 0),
      seamingArea: Number(snapshotCatalogItem?.seamingArea || line.seamingArea || f.seamingArea || 0),
      machineId: String(snapshotCatalogItem?.machineId || f.machineId || ""),
      machineName: String(snapshotCatalogItem?.machineName || f.machineName || ""),
      secondaryLayers: Array.isArray(snapshotCatalogItem?.secondaryLayers)
        ? safeNormalizeLayers(snapshotCatalogItem.secondaryLayers, f.secondaryLayers)
        : f.secondaryLayers,
      processes: Array.isArray(snapshotCatalogItem?.processes)
        ? safeNormalizeProcesses(snapshotCatalogItem.processes, f.processes)
        : f.processes,
      selectedPlanId: String(snapshotCatalogItem?.savedPlanId || f.selectedPlanId || ""),
    } as any));

    if (snapshotCatalogItem?.savedPlanId) {
      catalogSavedPlanRef.current = snapshotCatalogItem.savedPlan ?? null;
      setIsPlanApplied(true);
      setShowPlan(false);
    }

    if (snapshotCatalogItem?.content || fallbackContent) {
      setDimValues({
        width: Number(snapshotCatalogItem?.jobWidth || line.jobWidth) || undefined,
        height: Number(snapshotCatalogItem?.jobHeight || line.jobHeight) || undefined,
        widthShrinkage: Number(snapshotCatalogItem?.widthShrinkage || line.widthShrinkage) || undefined,
        topSeal: Number(snapshotCatalogItem?.topSeal || line.topSeal) || undefined,
        bottomSeal: Number(snapshotCatalogItem?.bottomSeal || line.bottomSeal) || undefined,
        sideSeal: Number(snapshotCatalogItem?.sideSeal || line.sideSeal) || undefined,
        gusset: Number(snapshotCatalogItem?.gusset || line.gusset) || undefined,
        sideGusset: Number(snapshotCatalogItem?.sideGusset || line.sideGusset) || undefined,
        centerSealWidth: Number(snapshotCatalogItem?.centerSealWidth || line.centerSealWidth) || undefined,
        seamingArea: Number(snapshotCatalogItem?.seamingArea || line.seamingArea) || undefined,
        transparentArea: Number(snapshotCatalogItem?.transparentArea || line.transparentArea) || undefined,
        layflatWidth: Number(snapshotCatalogItem?.jobWidth || line.jobWidth) || undefined,
        cutHeight: Number(snapshotCatalogItem?.jobHeight || line.jobHeight) || undefined,
      });
    }

    const srcCatalogId = String(src.catalogId || line.catalogId || "");
    Promise.all([
      apiGet<any>(`api/gravureWorkOrderShrink/getpwoinitdata/${line.id}`).catch(() => null),
      srcCatalogId ? apiGet<any>(`api/productcataloggravureShrink/getcatalogbyid/${srcCatalogId}`).catch(() => null) : Promise.resolve(null),
    ])
      .then(([cat, catalogByIdRaw]) => {
        const catalogByIdRows = parseNestedJson(catalogByIdRaw);
        const catalogById = mapCatalogApiRow(Array.isArray(catalogByIdRows) ? catalogByIdRows[0] : catalogByIdRows);
        const catRow = cat || {};
        if (!cat && !catalogById) return;

        const catalogItem =
          snapshotCatalogItem ||
          catalogById ||
          catalog.find(c => c.id === String(catRow.productMasterID || line.catalogId || src.catalogId || "")) ||
          catalog.find(c => c.catalogNo === String(catRow.catalogNo || line.catalogNo || "")) ||
          catalog.find(c => c.catalogNo === String(src.catalogNo || "")) ||
          catalog.find(c => c.sourceOrderId === String(src.orderId || "")) ||
          catalog.find(c => norm(c.sourceOrderNo) === norm(src.orderNo)) ||
          catalog.find(c =>
            norm(c.customerId) === norm(src.customerId) &&
            norm(c.productName) === norm(catRow.productName || line.productName || src.productName)
          ) ||
          catalog.find(c =>
            norm(c.customerName) === norm(src.customerName) &&
            norm(c.productName) === norm(catRow.productName || line.productName || src.productName) &&
            (!fallbackCategoryName || norm(c.categoryName) === norm(fallbackCategoryName))
          );
        const hasApiCatalogPayload = Boolean(
          catRow.machineId || catRow.machineName || catRow.savedPlanId || catRow.savedPlanJSON || catRow.contentSizeValues
        ) || parseMaybeArray(catRow.processesJSON).length > 0 || parseMaybeArray(catRow.layersJSON).length > 0;

        // Map secondaryLayers from layersJSON
        const rawLayers: any[] = parseMaybeArray(catRow.layersJSON);
        const secondaryLayers = safeNormalizeLayers(
          rawLayers.length > 0
            ? rawLayers.map((l: any) => {
              const sg = (l.storedSubGroup || l.itemSubGroup)
                ? FILM_SUBGROUPS.find(s => s.subGroup === (l.storedSubGroup || l.itemSubGroup))
                : null;
              return {
                layerNo: Number(l.layerNo ?? 0),
                plyType: String(l.plyType ?? ""),
                itemId: String(l.itemId ?? ""),
                itemName: String(l.itemName ?? ""),
                itemSubGroup: String(l.storedSubGroup || l.itemSubGroup || ""),
                gsm: Number(l.gsm ?? 0),
                thickness: 0,
                density: (Number(l.filmDensity) > 0) ? Number(l.filmDensity) : (sg?.density ?? 0),
                rate: Number(l.rate ?? 0),
                consumableItems: l.consumableItems ?? [],
              };
            })
            : (catalogItem?.secondaryLayers || [])
        );

        // Map processes from processesJSON
        const rawProcs: any[] = parseMaybeArray(catRow.processesJSON);
        const processes = safeNormalizeProcesses(rawProcs.length > 0 ? rawProcs : (catalogItem?.processes || []), catalogItem?.processes || []);

        // Map colorShades from colorShadesJSON
        const rawShades: any[] = parseMaybeArray(catRow.colorShadesJSON);
        setColorShades(rawShades.map((s: any) => ({
          colorNo: Number(s.colorNo ?? 0),
          colorName: String(s.colorName ?? ""),
          inkType: (s.inkType || "Spot") as ColorShade["inkType"],
          pantoneRef: String(s.pantoneRef ?? ""),
          labL: String(s.labL ?? ""),
          labA: String(s.labA ?? ""),
          labB: String(s.labB ?? ""),
          labLMeas: "",
          labAMeas: "",
          labBMeas: "",
          deltaE: "--",
          deltaETol: "",
          shadeCardRef: "",
          status: "Pending" as ColorShade["status"],
          remarks: String(s.remarks ?? ""),
        })));

        // Map cylinderAllocs from cylAllocsJSON
        const rawCyls: any[] = parseMaybeArray(catRow.cylAllocsJSON);
        setCylinderAllocs(rawCyls.map((c: any) => ({
          colorNo: Number(c.colorNo ?? 0),
          colorName: String(c.colorName ?? ""),
          cylinderNo: String(c.cylinderNo ?? ""),
          circumference: String(c.circumference ?? ""),
          cylinderType: (c.cylinderType || "New") as CylinderAlloc["cylinderType"],
          status: (c.status || "Pending") as CylinderAlloc["status"],
          remarks: String(c.remarks ?? ""),
        })));

        // Store saved plan for planId reconciliation (CP- → WO- prefix fix)
        try {
          catalogSavedPlanRef.current =
            catalogItem?.savedPlan ??
            JSON.parse(catRow.contentSizeValues || catRow.savedPlanJSON || "null");
        } catch {
          catalogSavedPlanRef.current = catalogItem?.savedPlan ?? null;
        }

        setForm(f => ({
          ...f,
          sourceOrderType: "Catalog",
          orderId: String(src.orderId ?? ""),
          orderNo: String(src.orderNo ?? ""),
          customerId: String(src.customerId ?? ""),
          customerName: String(src.customerName ?? ""),
          salesType: String(catRow.salesType || src.salesType || ""),
          jobName: String(catRow.productName || catalogItem?.productName || line.productName || ""),
          categoryId: String(catRow.categoryId || catalogItem?.categoryId || fallbackCategoryId || ""),
          categoryName: String(catRow.categoryName || catalogItem?.categoryName || fallbackCategoryName || ""),
          substrate: String(catRow.substrate || catalogItem?.substrate || line.substrate || ""),
          jobWidth: Number(catRow.jobWidth || catalogItem?.jobWidth || line.jobWidth || 0),
          jobHeight: Number(catRow.jobHeight || catalogItem?.jobHeight || line.jobHeight || 0),
          noOfColors: Number(catRow.noOfColors || catalogItem?.noOfColors || line.noOfColors || 0),
          frontColors: Number(catRow.frontColors || catalogItem?.frontColors || 0),
          backColors: Number(catRow.backColors || catalogItem?.backColors || 0),
          printType: (catRow.printType || catalogItem?.printType || line.printType || "Surface Print") as any,
          quantity: Number(catRow.orderQty || line.orderQty || 0),
          unit: String(catRow.unit || line.unit || catalogItem?.standardUnit || "Meter"),
          productMasterID: Number(catRow.productMasterID || catalogItem?.id || 0),
          productMasterCode: String(catRow.catalogNo || catalogItem?.catalogNo || ""),
          structure: String(catRow.structureType || catalogItem?.structureType || fallbackStructureType || ""),
          structureType: String(catRow.structureType || catalogItem?.structureType || fallbackStructureType || "") as any,
          content: String(catRow.content || catalogItem?.content || fallbackContent || ""),
          trimmingSize: Number(catRow.trimmingSize || catalogItem?.trimmingSize || line.trimmingSize || 0),
          machineId: String(catRow.machineId || catalogItem?.machineId || ""),
          machineName: String(catRow.machineName || catalogItem?.machineName || ""),
          actualWidth: Number(catRow.actualWidth || catalogItem?.actualWidth || catRow.jobWidth || catalogItem?.jobWidth || line.jobWidth || 0),
          actualHeight: Number(catRow.actualHeight || catalogItem?.actualHeight || catRow.jobHeight || catalogItem?.jobHeight || line.jobHeight || 0),
          widthShrinkage: Number(catRow.widthShrinkage || catalogItem?.widthShrinkage || line.widthShrinkage || 0),
          gusset: Number(catRow.gusset || catalogItem?.gusset || line.gusset || 0),
          topSeal: Number(catRow.topSeal || catalogItem?.topSeal || line.topSeal || 0),
          bottomSeal: Number(catRow.bottomSeal || catalogItem?.bottomSeal || line.bottomSeal || 0),
          sideSeal: Number(catRow.sideSeal || catalogItem?.sideSeal || line.sideSeal || 0),
          centerSealWidth: Number(catRow.centerSealWidth || catalogItem?.centerSealWidth || line.centerSealWidth || 0),
          sideGusset: Number(catRow.sideGusset || catalogItem?.sideGusset || line.sideGusset || 0),
          transparentArea: Number(catRow.transparentArea || catalogItem?.transparentArea || line.transparentArea || 0),
          seamingArea: Number(catRow.seamingArea || catalogItem?.seamingArea || line.seamingArea || 0),
          cylinderCostPerColor: Number(catRow.cylinderCostPerColor || 0),
          overheadPct: Number(catRow.overheadPct || 0),
          profitPct: Number(catRow.profitPct || 0),
          perMeterRate: Number(catRow.perMeterRate || 0),
          secondaryLayers: secondaryLayers as any,
          processes,
          selectedPlanId: String(catRow.savedPlanId || catalogItem?.savedPlanId || ""),
        } as any));

        if (catRow.savedPlanId || catalogItem?.savedPlanId) {
          setIsPlanApplied(true);
          setShowPlan(false);
        }

        setDimValues({
          width: Number(catRow.jobWidth || catalogItem?.jobWidth || line.jobWidth) || undefined,
          height: Number(catRow.jobHeight || catalogItem?.jobHeight || line.jobHeight) || undefined,
          widthShrinkage: Number(catRow.widthShrinkage || catalogItem?.widthShrinkage || line.widthShrinkage) || undefined,
          topSeal: Number(catRow.topSeal || catalogItem?.topSeal || line.topSeal) || undefined,
          bottomSeal: Number(catRow.bottomSeal || catalogItem?.bottomSeal || line.bottomSeal) || undefined,
          sideSeal: Number(catRow.sideSeal || catalogItem?.sideSeal || line.sideSeal) || undefined,
          gusset: Number(catRow.gusset || catalogItem?.gusset || line.gusset) || undefined,
          sideGusset: Number(catRow.sideGusset || catalogItem?.sideGusset || line.sideGusset) || undefined,
          centerSealWidth: Number(catRow.centerSealWidth || catalogItem?.centerSealWidth || line.centerSealWidth) || undefined,
          seamingArea: Number(catRow.seamingArea || catalogItem?.seamingArea || line.seamingArea) || undefined,
          transparentArea: Number(catRow.transparentArea || catalogItem?.transparentArea || line.transparentArea) || undefined,
          layflatWidth: Number(catRow.jobWidth || catalogItem?.jobWidth || line.jobWidth) || undefined,
          cutHeight: Number(catRow.jobHeight || catalogItem?.jobHeight || line.jobHeight) || undefined,
        });

        // Keep the source alive until either API catalog payload arrives or catalog context is available.
        if (hasApiCatalogPayload || catalogItem) {
          pendingPWOOrderRef.current = null;
          setPendingPWOOrder(null);
        }
      })
      .catch(() => { /* sessionStorage fallback already applied above */ })
      .finally(() => {
        const srcCatalogId = String(src.catalogId || line.catalogId || "");
        const srcCatalogNo = String(src.catalogNo || line.catalogNo || "");
        const srcProductName = String(src.productName || line.productName || "");
        const resolvedCatalog =
          snapshotCatalogItem ||
          catalog.find(c => c.id === srcCatalogId) ||
          catalog.find(c => c.catalogNo === srcCatalogNo) ||
          catalog.find(c =>
            norm(c.customerId) === norm(src.customerId) &&
            norm(c.productName) === norm(srcProductName)
          ) ||
          catalog.find(c =>
            norm(c.customerName) === norm(src.customerName) &&
            norm(c.productName) === norm(srcProductName)
          );
        if (resolvedCatalog) {
          pendingPWOOrderRef.current = null;
          setPendingPWOOrder(null);
        }
      });
  }, [pendingPWOOrder, categories, catalog]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper: map API row → GravureOrder shape (for pending orders)
  function mapApiToOrder(r: any): GravureOrder {
    let lines = Array.isArray(r.orderLines) ? r.orderLines : [];
    if (lines.length === 0 && typeof r.linesJSON === "string") {
      try { lines = JSON.parse(r.linesJSON); } catch { lines = []; }
    }
    const firstLine = lines[0] || {};
    return {
      id: String(r.orderId || r.OrderBookingID || ""),
      orderNo: String(r.orderNo || r.SalesOrderNo || r.OrderBookingNo || ""),
      date: String(r.date || r.OrderBookingDate || ""),
      customerId: String(r.customerId || r.LedgerID || ""),
      customerName: String(r.customerName || r.CustomerName || ""),
      jobName: String(r.jobName || firstLine.productName || ""),
      substrate: String(r.substrate || firstLine.substrate || ""),
      structure: String(r.structure || firstLine.structureType || ""),
      categoryId: String(r.categoryId || firstLine.categoryId || ""),
      categoryName: String(r.categoryName || firstLine.categoryName || ""),
      content: String(r.content || firstLine.content || ""),
      jobWidth: Number(r.jobWidth || firstLine.jobWidth || 0),
      jobHeight: Number(r.jobHeight || firstLine.jobHeight || 0),
      width: Number(r.jobWidth || firstLine.jobWidth || 0),
      noOfColors: Number(r.noOfColors || firstLine.noOfColors || 0),
      printType: String(r.printType || firstLine.printType || "Surface Print"),
      quantity: Number(r.quantity || firstLine.orderQty || 0),
      unit: String(r.unit || firstLine.unit || "Meter"),
      deliveryDate: String(r.deliveryDate || firstLine.deliveryDate || ""),
      sourceType: (r.sourceType || "Direct") as any,
      totalAmount: Number(r.totalAmount || 0),
      perMeterRate: Number(r.perMeterRate || 0),
      processes: [],
      secondaryLayers: [],
      overheadPct: 12,
      profitPct: 15,
      orderLines: lines,
      status: (r.status || "Confirmed") as any,
    } as unknown as GravureOrder;
  }

  // Helper: map API row → GravureWorkOrder shape
  function mapApiToWO(r: any): GravureWorkOrder {
    const layers: SecondaryLayer[] = (() => {
      if (!Array.isArray(r.savedLayersJSON)) return [];
      const merged = new Map<number, SecondaryLayer>();
      r.savedLayersJSON.forEach((l: any, idx: number) => {
        const layerNo = Number(l.layerNo ?? idx + 1) || idx + 1;
        const arr = Array.isArray(l.consumableItems)
          ? l.consumableItems
          : (() => { try { return JSON.parse(l.consumableItems || "[]"); } catch { return []; } })();
        const consumables = arr.map((c: any, cIdx: number) => ({
          ...c,
          consumableId: String(c.consumableId ?? c.ConsumableID ?? `ply-${layerNo}-con-${cIdx + 1}`),
          itemId: String(c.itemId ?? ""),
          itemGroup: c.itemGroup ?? c.consumableType ?? c.itemGroupName ?? "",
          itemSubGroup: c.itemSubGroup ?? c.itemSubGroupName ?? "",
          gsm: c.gsm ?? c.dryGSM ?? 0,
          solidPct: (c.solidPct > 0 ? c.solidPct : (c.solidPercentage > 0 ? c.solidPercentage : 40)),
        }));
        if (!merged.has(layerNo)) {
          merged.set(layerNo, {
            id: `ply-${layerNo}`,
            layerNo,
            plyType: String(l.plyType ?? ""),
            itemId: String(l.itemId ?? ""),
            itemName: String(l.itemName ?? ""),
            itemSubGroup: String(l.itemSubGroup ?? ""),
            gsm: Number(l.gsm ?? 0),
            thickness: Number(l.thickness ?? 0),
            density: Number(l.density ?? 0),
            filmRate: Number(l.rate ?? l.filmRate ?? 0),
            consumableItems: consumables,
          });
          return;
        }
        const prev = merged.get(layerNo)!;
        const seen = new Set((prev.consumableItems || []).map((ci: PlyConsumableItem) => [
          String(ci.itemId ?? "").trim().toLowerCase(),
          String(ci.itemGroup ?? "").trim().toLowerCase(),
          String(ci.itemSubGroup ?? "").trim().toLowerCase(),
          String(ci.itemName ?? "").trim().toLowerCase(),
          String(ci.fieldDisplayName ?? "").trim().toLowerCase(),
          Number(ci.gsm ?? 0),
          Number(ci.solidPct ?? 40),
        ].join("|")));
        const nextConsumables = [...(prev.consumableItems || [])];
        consumables.forEach((ci: PlyConsumableItem) => {
          const key = [
            String(ci.itemId ?? "").trim().toLowerCase(),
            String(ci.itemGroup ?? "").trim().toLowerCase(),
            String(ci.itemSubGroup ?? "").trim().toLowerCase(),
            String(ci.itemName ?? "").trim().toLowerCase(),
            String(ci.fieldDisplayName ?? "").trim().toLowerCase(),
            Number(ci.gsm ?? 0),
            Number(ci.solidPct ?? 40),
          ].join("|");
          if (!seen.has(key)) {
            seen.add(key);
            nextConsumables.push(ci);
          }
        });
        merged.set(layerNo, {
          ...prev,
          plyType: prev.plyType || String(l.plyType ?? ""),
          itemId: prev.itemId || String(l.itemId ?? ""),
          itemName: prev.itemName || String(l.itemName ?? ""),
          itemSubGroup: prev.itemSubGroup || String(l.itemSubGroup ?? ""),
          gsm: prev.gsm || Number(l.gsm ?? 0),
          thickness: prev.thickness || Number(l.thickness ?? 0),
          density: prev.density || Number(l.density ?? 0),
          filmRate: prev.filmRate || Number(l.rate ?? l.filmRate ?? 0),
          consumableItems: nextConsumables,
        });
      });
      return Array.from(merged.values()).sort((a, b) => a.layerNo - b.layerNo);
    })();

    const processes: GravureEstimationProcess[] = Array.isArray(r.savedProcessesJSON)
      ? r.savedProcessesJSON.map((p: any) => {
        const pid = String(p.processId ?? p.id ?? "").trim();
        const pname = String(p.processName ?? p.name ?? "").trim();
        const pm = ROTO_PROCESSES.find(x => x.id === pid)
          || ROTO_PROCESSES.find(x => x.name === pname);
        return {
          processId: pm?.id ?? pid,
          processName: (pm?.name ?? pname) || pid,
          chargeUnit: pm?.chargeUnit ?? String(p.chargeUnit ?? ""),
          rate: Number(p.rate ?? 0),
          qty: Number(p.qty ?? 0),
          setupCharge: pm?.makeSetupCharges ? parseFloat(pm.setupChargeAmount || "0") || 0 : Number(p.setupCharge ?? 0),
          amount: Number(p.amount ?? 0),
        };
      })
      : [];

    return {
      id: String(r.JobBookingID ?? r.jobBookingId ?? ""),
      workOrderNo: String(r.JobBookingNo ?? r.workOrderNo ?? ""),
      date: String(r.date ?? ""),
      orderId: String(r.orderId ?? ""),
      orderNo: String(r.orderNo ?? ""),
      sourceOrderType: (r.sourceOrderType ?? "Direct") as any,
      customerId: String(r.customerId ?? ""),
      customerName: String(r.customerName ?? ""),
      jobName: String(r.jobName ?? ""),
      substrate: String(r.substrate ?? ""),
      structure: String(r.structure ?? ""),
      categoryId: String(r.categoryId ?? ""),
      categoryName: String(r.categoryName ?? ""),
      content: String(r.content ?? ""),
      jobWidth: Number(r.jobWidth ?? 0),
      jobHeight: Number(r.jobHeight ?? 0),
      actualWidth: Number(r.actualWidth ?? 0),
      actualHeight: Number(r.actualHeight ?? 0),
      width: Number(r.actualWidth ?? 0),
      noOfColors: Number(r.noOfColors ?? 0),
      printType: (r.printType ?? "Surface Print") as any,
      structureType: r.structureType || undefined,
      trimmingSize: Number(r.trimmingSize ?? 0),
      widthShrinkage: Number(r.widthShrinkage ?? 0),
      gusset: Number(r.gusset ?? 0),
      topSeal: Number(r.topSeal ?? 0),
      bottomSeal: Number(r.bottomSeal ?? 0),
      sideSeal: Number(r.sideSeal ?? 0),
      centerSealWidth: Number(r.centerSealWidth ?? 0),
      sideGusset: Number(r.sideGusset ?? 0),
      seamingArea: Number(r.seamingArea ?? 0),
      transparentArea: Number(r.transparentArea ?? 0),
      finalRollOD: r.finalRollOD ? Number(r.finalRollOD) : undefined,
      rollUnit: (r.rollUnit ?? "Meter") as any,
      unwindDirection: Number(r.unwindDirection ?? 0),
      frontColors: Number(r.frontColors ?? 0),
      backColors: Number(r.backColors ?? 0),
      salesPerson: String(r.salesPerson ?? ""),
      salesType: String(r.salesType ?? ""),
      machineId: String(r.machineId ?? ""),
      machineName: String(r.machineName ?? ""),
      cylinderCostPerColor: Number(r.cylinderCostPerColor ?? 3500),
      overheadPct: Number(r.overheadPct ?? 12),
      profitPct: Number(r.profitPct ?? 15),
      perMeterRate: Number(r.perMeterRate ?? 0),
      totalAmount: Number(r.totalAmount ?? 0),
      processes,
      secondaryLayers: layers,
      selectedPlanId: String(r.selectedPlanId ?? ""),
      ups: Number(r.ups ?? 0),
      operatorId: String(r.operatorId ?? ""),
      operatorName: String(r.operatorName ?? ""),
      cylinderSet: String(r.cylinderSet ?? ""),
      inks: [],
      quantity: Number(r.quantity ?? 0),
      unit: (r.unit ?? "Meter") as any,
      wastagePct: Number(r.wastagePct ?? 1),
      plannedDate: String(r.plannedDate ?? ""),
      specialInstructions: String(r.specialInstructions ?? ""),
      status: (r.status ?? "Open") as any,
    };
  }

  // ── Derive structureType from content string ──────────────
  const getStructureType = (content: string): "Label" | "Sleeve" | "Pouch" | "MultiPackShrink" => {
    if (!content) return "Label";
    const c = content.toLowerCase();
    if (c.includes("lldpe") || c.includes("ldpe")) return "MultiPackShrink";
    if (c.includes("sleeve")) return "Sleeve";
    if (c.includes("pouch") || c.includes("standup") || c.includes("zipper") || c.includes("3d") || c.includes("flat bottom") || c.includes("gusset") || c.includes("center seal") || c.includes("side seal")) return "Pouch";
    return "Label";
  };

  // ── Maps DB ContentName → CONTENT_TYPE_CONFIG key ─────────
  const normalizeContentType = (content: string): string => {
    const c = (content || "").toLowerCase();
    if (c.includes("wrap around")) return "Wrap Around Labels";
    if (c === "shrink sleeve" || (c.includes("sleeve") && c.includes("shrink") && !c.includes("stretch"))) return "Sleeve — Shrink";
    if (c.includes("sleeve") && c.includes("stretch")) return "Sleeve — Stretch";
    if (c.includes("shrink label")) return "Shrink Labels";
    if (c.includes("cut") && c.includes("stack")) return "Cut & Stack Labels";
    if (c.includes("in-mould") || c.includes("in mould")) return "In-Mould Labels";
    return content;
  };

  // ── View Plan (WO list) ────────────────────────────────────
  const [viewPlanWO, setViewPlanWO] = useState<GravureWorkOrder | null>(null);

  // ── UPS Layout preview (plan selection table) ─────────────
  const [woUpsPreview, setWoUpsPreview] = useState<any>(null);

  // ── Total ply GSM (for weight calculation in plan rows) ─────
  const totalPlyGSM = useMemo(() =>
    form.secondaryLayers.reduce((s, l) => s + l.gsm + l.consumableItems.reduce((cs, ci) => cs + (ci.gsm || 0), 0), 0),
    [form.secondaryLayers]);

  // ── Production Plan calculation — content/structureType aware (mirrors estimation) ──
  const allPlans = useMemo(() => {
    const _sTypeEarly = (form as any).structureType || getStructureType(form.content || "");
    const _planWidthEarly = _sTypeEarly === "Sleeve"
      ? (form.jobWidth || 0)
      : ((form as any).actualWidth || form.jobWidth || 0);
    if (!form.machineId || _planWidthEarly <= 0) return [];

    // Try DB machine first, fall back to dummyData PRINT_MACHINES
    const dbM = dbMachines.find(m => m.id === form.machineId);
    const dummyM = PRINT_MACHINES.find(m => m.id === form.machineId);

    const machineMaxFilm = dbM ? (dbM.maxWebWidth || 1300) : (parseFloat((dummyM as any)?.maxWebWidth) || 1300);
    const machineMinFilm = dbM ? (dbM.minWebWidth || 0) : (parseFloat((dummyM as any)?.minWebWidth) || 0);
    const machineMinCirc = dbM ? (dbM.minCirc || 0) : (parseFloat((dummyM as any)?.repeatLengthMin) || 0);
    const machineMaxCirc = dbM ? (dbM.maxCirc || 9999) : (parseFloat((dummyM as any)?.repeatLengthMax) || 9999);

    const sType = (form as any).structureType || getStructureType(form.content || "");
    const content = form.content || "";
    const trim = form.trimmingSize || 0;
    const shrink = (form as any).widthShrinkage || 0;
    const gusset = (form as any).gusset || 0;
    const topSeal = (form as any).topSeal || 0;
    const btmSeal = (form as any).bottomSeal || 0;
    const sideSeal = (form as any).sideSeal || 0;
    const ctrSeal = (form as any).centerSealWidth || 0;
    const sideGust = (form as any).sideGusset || 0;
    const slvTransp = (form as any).transparentArea || 0;
    const slvSeam = (form as any).seamingArea || 0;
    const speed = dbM ? (dbM.speed || 150) : (parseFloat((dummyM as any)?.speedMax) || 150);
    const plyGSM = totalPlyGSM;
    // Sleeve: jobW = layflat (jobWidth). Label/Pouch: jobW = actualWidth.
    const jobW = sType === "Sleeve"
      ? (form.jobWidth || 0)
      : ((form as any).actualWidth || form.jobWidth || 0);
    const jobH = form.jobHeight || 0;

    // ── Lane width per UPS (matches estimation logic) ──
    let laneWidth: number;
    if (sType === "Sleeve") {
      laneWidth = jobW * 2 + slvTransp + slvSeam;
    } else if (content === "Pouch — 3 Side Seal" || content === "Standup Pouch" || content === "Zipper Pouch") {
      laneWidth = jobW + 2 * sideSeal;
    } else if (content === "Pouch — Center Seal") {
      laneWidth = jobW * 2 + ctrSeal;
    } else if (content === "Both Side Gusset Pouch" || content === "3D Pouch / Flat Bottom") {
      laneWidth = jobW + 2 * sideGust;
    } else {
      laneWidth = jobW;
    }
    if (laneWidth <= 0) laneWidth = jobW > 0 ? jobW : 1;

    // ── Effective repeat (cylinder circumference direction) ──
    const sleeveCutLength = sType === "Sleeve" ? jobH + shrink : 0;
    let effectiveRepeat: number;
    if (sType === "Sleeve") {
      effectiveRepeat = sleeveCutLength;
    } else if (content === "Pouch — 3 Side Seal" || content === "Pouch — Center Seal" || content === "Both Side Gusset Pouch") {
      effectiveRepeat = jobH + topSeal + btmSeal + shrink;
    } else if (content === "Standup Pouch" || content === "Zipper Pouch" || content === "3D Pouch / Flat Bottom") {
      effectiveRepeat = jobH + topSeal + (gusset > 0 ? gusset / 2 : 0) + shrink;
    } else {
      effectiveRepeat = jobH + shrink;
    }

    const calcRepeatUPS = (cylCirc: number) => {
      if (effectiveRepeat <= 0) return 1;
      return Math.round(cylCirc / effectiveRepeat);
    };

    const isValidCircumference = (cylCirc: number) => {
      if (cylCirc < machineMinCirc || cylCirc > machineMaxCirc) return false;
      if (sType === "Sleeve") {
        if (sleeveCutLength <= 0) return false;
        const rem = cylCirc % sleeveCutLength;
        return rem < 1 || (sleeveCutLength - rem) < 1;
      }
      if (effectiveRepeat <= 0) return true;
      const rem = cylCirc % effectiveRepeat;
      return rem < 0.5 || (effectiveRepeat - rem) < 0.5;
    };

    // ── LOOP A: Sleeve in stock → cylinder ──
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
        if (filmWidth < machineMinFilm) return [];
        const req = filmWidth + 100;
        const minCyl = req < sleeveWidthVal ? req : sleeveWidthVal + 100;
        const validCylinders = CYLINDER_TOOLS.filter(t => {
          if (parseFloat(t.printWidth) < minCyl) return false;
          const circ = parseFloat(t.repeatLength || "450") || 450;
          return isValidCircumference(circ);
        });
        const specialCylinders = (() => {
          if (sType === "Sleeve") {
            if (effectiveRepeat < machineMinCirc || effectiveRepeat > machineMaxCirc) return [];
            return [{ id: "SPECIAL-CYL-SLEEVE", code: "SPL", name: `Special Order Sleeve Cyl (${effectiveRepeat}mm)`, printWidth: String(Math.ceil(minCyl)), repeatLength: String(effectiveRepeat), isSpecial: true }];
          }
          if (effectiveRepeat <= 0) return [{ id: "SPECIAL-CYL-1", code: "SPL", name: "Special Order", printWidth: String(Math.ceil(minCyl)), repeatLength: "450", isSpecial: true }];
          const results = [];
          for (let mult = 1; mult * effectiveRepeat <= machineMaxCirc; mult++) {
            const circ = mult * effectiveRepeat;
            if (circ < machineMinCirc) continue;
            results.push({ id: `SPECIAL-CYL-${mult}`, code: "SPL", name: `Special Order (${mult}×${effectiveRepeat}mm)`, printWidth: String(Math.ceil(minCyl)), repeatLength: String(circ), isSpecial: true });
          }
          return results.length > 0 ? results : [];
        })();
        const cylList = validCylinders.length > 0
          ? validCylinders.map(c => ({ id: c.id, code: c.code, name: c.name, printWidth: c.printWidth, repeatLength: c.repeatLength || "450", isSpecial: false, isSpecialSleeve: false }))
          : specialCylinders.map(c => ({ ...c, isSpecialSleeve: false }));
        const sideWaste = parseFloat((2 * trim).toFixed(1));
        const deadMargin = parseFloat((sleeveWidthVal - filmWidth).toFixed(1));
        const totalWaste = parseFloat((sideWaste + deadMargin).toFixed(1));
        return cylList.flatMap(cylinder => {
          const cylWidthV = parseFloat(cylinder.printWidth);
          if (cylWidthV < sleeveWidthVal + 100) return [];
          if (cylWidthV < machineMinFilm || cylWidthV > machineMaxFilm) return [];
          const cylCirc = parseFloat(cylinder.repeatLength) || 450;
          const repeatUPS = calcRepeatUPS(cylCirc);
          const totalUPS = acUps * repeatUPS;
          const reqRMT = form.quantity > 0 ? Math.ceil(form.quantity / totalUPS) : 1;
          const totalRMT = Math.ceil(reqRMT * 1.01);
          const cylAreaSqMm = cylWidthV * cylCirc;
          const cylAreaSqInch = parseFloat((cylAreaSqMm / 645.16).toFixed(2));
          const totalWt = parseFloat((totalRMT * (jobW / 1000) * plyGSM / 1000).toFixed(3));
          const totalTime = parseFloat((totalRMT / (speed * 60)).toFixed(2));
          return [{
            planId: `WO-${form.machineId}-${sleeve.id}-UPS${acUps}-${cylinder.id}`,
            machineName: form.machineName,
            filmSize: filmWidth, acUps, printingWidth,
            sleeveCode: sleeve.code, sleeveName: sleeve.name, sleeveWidthVal,
            cylinderCode: cylinder.code, cylinderName: cylinder.name,
            cylinderWidthVal: cylWidthV,
            sideWaste, deadMargin, totalWaste,
            cylCirc, cylRepeatLength: cylCirc, cylAreaSqMm, cylAreaSqInch,
            repeatUPS, totalUPS,
            reqRMT, totalRMT, totalWt, totalTime, wastage: totalWaste,
            isSpecial: cylinder.isSpecial, isSpecialSleeve: false, isBest: false,
          }];
        }).flat();
      }).flat();
    });

    // ── LOOP B: Cylinder in stock → no sleeve available → SPECIAL SLEEVE ──
    const loopB = CYLINDER_TOOLS.flatMap(cylinder => {
      const cylWidthVal = parseFloat(cylinder.printWidth);
      if (cylWidthVal < machineMinFilm || cylWidthVal > machineMaxFilm) return [];
      const maxAcUps = Math.floor(cylWidthVal / laneWidth);
      if (maxAcUps === 0) return [];
      return Array.from({ length: maxAcUps }, (_, i) => {
        const acUps = i + 1;
        const printingWidth = acUps * laneWidth;
        const filmWidth = printingWidth + 2 * trim;
        if (filmWidth > machineMaxFilm) return [];
        if (filmWidth < machineMinFilm) return [];
        const realSleeveExists = SLEEVE_TOOLS.some(s => {
          const sw = parseFloat(s.printWidth);
          if (sw < filmWidth || sw > machineMaxFilm) return false;
          const req = filmWidth + 100;
          const minCyl = req < sw ? req : sw + 100;
          return cylWidthVal >= minCyl;
        });
        if (realSleeveExists) return [];
        if (cylWidthVal < filmWidth + 100) return [];
        const cylCirc = parseFloat(cylinder.repeatLength || "450") || 450;
        if (!isValidCircumference(cylCirc)) return [];
        const sideWaste = parseFloat((2 * trim).toFixed(1));
        const deadMargin = 0;
        const totalWaste = sideWaste;
        const repeatUPS = calcRepeatUPS(cylCirc);
        const totalUPS = acUps * repeatUPS;
        const reqRMT = form.quantity > 0 ? Math.ceil(form.quantity / totalUPS) : 1;
        const totalRMT = Math.ceil(reqRMT * 1.01);
        const cylAreaSqMm = cylWidthVal * cylCirc;
        const cylAreaSqInch = parseFloat((cylAreaSqMm / 645.16).toFixed(2));
        const totalWt = parseFloat((totalRMT * (jobW / 1000) * plyGSM / 1000).toFixed(3));
        const totalTime = parseFloat((totalRMT / (speed * 60)).toFixed(2));
        return [{
          planId: `WO-${form.machineId}-SPLSLV-UPS${acUps}-${cylinder.id}`,
          machineName: form.machineName,
          filmSize: filmWidth, acUps, printingWidth,
          sleeveCode: "SPL-S", sleeveName: "Special Order Sleeve", sleeveWidthVal: filmWidth,
          cylinderCode: cylinder.code, cylinderName: cylinder.name,
          cylinderWidthVal: cylWidthVal,
          sideWaste, deadMargin, totalWaste,
          cylCirc, cylRepeatLength: cylCirc, cylAreaSqMm, cylAreaSqInch,
          repeatUPS, totalUPS,
          reqRMT, totalRMT, totalWt, totalTime, wastage: totalWaste,
          isSpecial: true, isSpecialSleeve: true, isBest: false,
        }];
      }).flat();
    });

    // ── LOOP S: Sleeve products — no print sleeve needed, direct cylinder planning ──
    // Film = layflat width. Cylinder circ = cuttingLength × N. UPS across from machineMaxFilm.
    const loopS = sType === "Sleeve" ? (() => {
      if (sleeveCutLength <= 0) return [];
      const maxAcUps = Math.floor((machineMaxFilm - 2 * trim) / laneWidth);
      if (maxAcUps === 0) return [];
      const maxRepeatCount = Math.floor(machineMaxCirc / sleeveCutLength);
      if (maxRepeatCount === 0) return [];
      const plans: any[] = [];
      for (let repeatCount = 1; repeatCount <= maxRepeatCount; repeatCount++) {
        const cylinderCirc = sleeveCutLength * repeatCount;
        if (cylinderCirc < machineMinCirc) continue;
        if (cylinderCirc > machineMaxCirc) break;
        const realCyls = CYLINDER_TOOLS_ALL.filter(t => {
          const circ = parseFloat(t.repeatLength || "0") || 0;
          return Math.abs(circ - cylinderCirc) < 1;
        }).map(c => ({ id: c.id, code: c.code, name: c.name, printWidth: c.printWidth, repeatLength: c.repeatLength || String(cylinderCirc), isSpecial: false }));
        const specialCyl = {
          id: `SPECIAL-CYL-SLEEVE-R${repeatCount}`, code: "SPL",
          name: `Special Order (${cylinderCirc}mm = ${sleeveCutLength}×${repeatCount})`,
          printWidth: "1500", repeatLength: String(cylinderCirc), isSpecial: true,
        };
        const cylList = realCyls.length > 0 ? realCyls : [specialCyl];
        for (let acUps = 1; acUps <= maxAcUps; acUps++) {
          const printingWidth = acUps * laneWidth;
          const filmWidth = printingWidth + 2 * trim;
          if (filmWidth > machineMaxFilm) break;
          if (filmWidth < machineMinFilm) continue;
          const deadMargin = parseFloat((machineMaxFilm - filmWidth).toFixed(1));
          for (const cyl of cylList) {
            const cylWidthV = parseFloat(cyl.printWidth) || 0;
            const reqRMT = form.quantity > 0 ? Math.ceil(form.quantity / (acUps * repeatCount)) : 1;
            const totalRMT = Math.ceil(reqRMT * 1.01);
            const cylAreaSqMm = cylWidthV * cylinderCirc;
            const cylAreaSqInch = parseFloat((cylAreaSqMm / 645.16).toFixed(2));
            const totalWt = parseFloat((totalRMT * (jobW / 1000) * plyGSM / 1000).toFixed(3));
            const totalTime = parseFloat((totalRMT / (speed * 60)).toFixed(2));
            plans.push({
              planId: `WO-SLEEVE-${form.machineId}-R${repeatCount}-${acUps}UPS-${cyl.id}`,
              machineName: form.machineName,
              filmSize: filmWidth, acUps, printingWidth,
              sleeveCode: "—", sleeveName: "No Print Sleeve Required", sleeveWidthVal: filmWidth,
              cylinderCode: cyl.code, cylinderName: cyl.name, cylinderWidthVal: cylWidthV,
              sideWaste: 0, deadMargin, totalWaste: deadMargin,
              cylCirc: cylinderCirc, cylRepeatLength: cylinderCirc, cylAreaSqMm, cylAreaSqInch,
              repeatUPS: repeatCount, totalUPS: acUps * repeatCount,
              reqRMT, totalRMT, totalWt, totalTime, wastage: deadMargin,
              isSpecial: cyl.isSpecial, isSpecialSleeve: false, isBest: false,
              sleeveCutLength, repeatCount,
            });
          }
        }
      }
      return plans;
    })() : [];

    const rawPlans = sType === "Sleeve" ? loopS : [...loopA, ...loopB];
    if (rawPlans.length === 0) return rawPlans;
    const sorted = [...rawPlans].sort((a, b) =>
      a.totalWaste !== b.totalWaste ? a.totalWaste - b.totalWaste :
        a.deadMargin !== b.deadMargin ? a.deadMargin - b.deadMargin :
          a.sideWaste !== b.sideWaste ? a.sideWaste - b.sideWaste :
            b.acUps !== a.acUps ? b.acUps - a.acUps : 0
    );
    return sorted.map((p, idx) => ({ ...p, isBest: !p.isSpecial && idx === 0 }));
  }, [form.machineId, form.actualWidth, form.jobWidth, form.jobHeight, form.trimmingSize, form.quantity, form.content, (form as any).structureType, (form as any).widthShrinkage, (form as any).gusset, (form as any).topSeal, (form as any).bottomSeal, (form as any).sideSeal, (form as any).centerSealWidth, (form as any).sideGusset, (form as any).seamingArea, (form as any).transparentArea, dbMachines, totalPlyGSM]); // eslint-disable-line react-hooks/exhaustive-deps

  const catalogSavedPlanMatch = useMemo(() => {
    if (allPlans.length === 0) return null;
    if (form.selectedPlanId) {
      const direct = allPlans.find(p => p.planId === form.selectedPlanId);
      if (direct) return direct;
    }
    const sp = catalogSavedPlanRef.current as any;
    if (!sp?.filmSize) return null;
    return allPlans.find(p =>
      (p as any).filmSize === sp.filmSize &&
      (p as any).acUps === sp.acUps &&
      (p as any).sleeveCode === sp.sleeveCode &&
      (p as any).cylinderCode === sp.cylinderCode
    ) || null;
  }, [allPlans, form.selectedPlanId]);

  // Reconcile catalog planId (CP- prefix) with generated workorder planIds (WO- prefix)
  useEffect(() => {
    if (!catalogSavedPlanMatch) return;
    if (form.selectedPlanId === catalogSavedPlanMatch.planId && form.ups === catalogSavedPlanMatch.totalUPS) return;
    setForm(prev => ({ ...prev, selectedPlanId: catalogSavedPlanMatch.planId, ups: catalogSavedPlanMatch.totalUPS }));
  }, [catalogSavedPlanMatch, form.selectedPlanId, form.ups]); // eslint-disable-line react-hooks/exhaustive-deps

  const visiblePlans = useMemo(() => {
    let rows = allPlans;
    const q = planSearch.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.machineName.toLowerCase().includes(q) || String(r.cylCirc).includes(q) || String(r.totalUPS).includes(q) || String(r.filmSize).includes(q));
    // Apply column filters (Excel-style, mirrors estimation)
    Object.entries(planColFilters).forEach(([key, vals]) => {
      if (vals.size > 0) {
        rows = rows.filter(r => vals.has(String((r as any)[key] ?? "")));
      }
    });
    if (planSort.key) {
      rows = [...rows].sort((a, b) => {
        const av = (a as any)[planSort.key] ?? 0;
        const bv = (b as any)[planSort.key] ?? 0;
        const diff = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
        return planSort.dir === "asc" ? diff : -diff;
      });
    } else if (catalogSavedPlanMatch) {
      rows = [
        catalogSavedPlanMatch,
        ...rows.filter(r => r.planId !== catalogSavedPlanMatch.planId),
      ];
    }
    return rows;
  }, [allPlans, planSearch, planSort, planColFilters, catalogSavedPlanMatch]);

  const togglePlanSort = (key: string) =>
    setPlanSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  const selectedPlan = useMemo(() => allPlans.find(p => p.planId === form.selectedPlanId) || null, [allPlans, form.selectedPlanId]);

  // ── Special tool detection ─────────────────────────────────
  const isSelectedPlanSpecial = !!(selectedPlan && ((selectedPlan as any).isSpecial || (selectedPlan as any).isSpecialSleeve));
  const isSelectedPlanSpecialCyl = !!(selectedPlan && (selectedPlan as any).isSpecial && !(selectedPlan as any).isSpecialSleeve);
  const isSelectedPlanSpecialSlv = !!(selectedPlan && (selectedPlan as any).isSpecialSleeve);

  // Helper: check if a saved WO's selectedPlanId refers to a special plan
  const woHasSpecialPlan = (wo: GravureWorkOrder) =>
    wo.selectedPlanId?.includes("SPECIAL") || wo.selectedPlanId?.includes("SPLSLV") || false;

  // ── Live cost calculation (mirrors estimation calcCosts) ───
  const liveCost = useMemo(() => {
    const areaM2 = form.quantity * (form.jobWidth / 1000);
    let plyMaterialCost = 0;
    form.secondaryLayers.forEach(l => {
      if (l.gsm > 0) {
        const filmItem = FILM_ITEMS.find(i => i.subGroup === l.itemSubGroup);
        const fr = filmItem ? parseFloat((filmItem as any).estimationRate || "0") : 0;
        if (fr > 0) plyMaterialCost += (l.gsm * areaM2 / 1000) * fr;
      }
      l.consumableItems.forEach(ci => {
        if (ci.gsm > 0 && ci.rate > 0) {
          const pct = (ci as any).coveragePct ?? 100;
          const effectiveGsm = pct < 100 ? ci.gsm * (pct / 100) : ci.gsm;
          plyMaterialCost += (effectiveGsm * areaM2 / 1000) * ci.rate;
        }
      });
    });
    const materialCost = parseFloat(plyMaterialCost.toFixed(2));
    const processCost = parseFloat(form.processes.reduce((s, p) => {
      const qty = p.qty > 0 ? p.qty : autoProcessQty(p.chargeUnit, form.quantity, areaM2, form.noOfColors);
      return s + (p.rate * qty + p.setupCharge);
    }, 0).toFixed(2));
    const cylinderCost = form.cylinderCostPerColor * form.noOfColors;
    const sub = materialCost + processCost + cylinderCost;
    const overheadAmt = parseFloat(((sub * form.overheadPct) / 100).toFixed(2));
    const profitAmt = parseFloat((((sub + overheadAmt) * form.profitPct) / 100).toFixed(2));
    const totalAmount = parseFloat((sub + overheadAmt + profitAmt).toFixed(2));
    const perMeterRate = form.quantity > 0 ? parseFloat((totalAmount / form.quantity).toFixed(4)) : 0;
    return { materialCost, processCost, cylinderCost, overheadAmt, profitAmt, totalAmount, perMeterRate };
  }, [form.quantity, form.jobWidth, form.secondaryLayers, form.processes, form.cylinderCostPerColor, form.noOfColors, form.overheadPct, form.profitPct]);

  // ── Plan column filter helpers (mirrors estimation) ─────────
  const openPlanFilter = (key: string) => {
    setPlanFilterDraft(d => ({ ...d, [key]: new Set(planColFilters[key] ?? []) }));
    setPlanFilterOpen(key);
  };
  const applyPlanFilter = (key: string) => {
    const draft = planFilterDraft[key];
    if (!draft || draft.size === 0) { setPlanColFilters(f => { const n = { ...f }; delete n[key]; return n; }); }
    else { setPlanColFilters(f => ({ ...f, [key]: new Set(draft) })); }
    setPlanFilterOpen(null);
  };
  const clearPlanFilter = (key: string) => {
    setPlanColFilters(f => { const n = { ...f }; delete n[key]; return n; });
    setPlanFilterDraft(d => { const n = { ...d }; delete n[key]; return n; });
    setPlanFilterOpen(null);
  };
  const togglePlanFilterVal = (key: string, val: string) =>
    setPlanFilterDraft(d => {
      const s = new Set(d[key] ?? []);
      s.has(val) ? s.delete(val) : s.add(val);
      return { ...d, [key]: s };
    });
  const togglePlanFilterAll = (key: string, allVals: string[]) =>
    setPlanFilterDraft(d => {
      const s = d[key] ?? new Set<string>();
      const newSet = s.size === allVals.length ? new Set<string>() : new Set(allVals);
      return { ...d, [key]: newSet };
    });

  // ── Save to Catalog ────────────────────────────────────────
  const [catSaveWO, setCatSaveWO] = useState<GravureWorkOrder | null>(null);
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
      frontColors: catSaveWO.frontColors,
      backColors: catSaveWO.backColors,
      status: "Active",
      isActive: true,
      isActiveReason: "",
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
    const layers = [...form.secondaryLayers];
    layers[index] = { ...layers[index], plyType, consumableItems: [] };
    f("secondaryLayers", layers);
  };

  const addPlyConsumable = (layerIdx: number) => {
    const layers = [...form.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    layer.consumableItems = [...layer.consumableItems, {
      consumableId: Math.random().toString(),
      fieldDisplayName: "", itemGroup: "", itemSubGroup: "",
      itemId: "", itemName: "", gsm: 0, rate: 0,
    } as PlyConsumableItem];
    layers[layerIdx] = layer;
    f("secondaryLayers", layers);
  };

  const removePlyConsumable = (layerIdx: number, ciIdx: number) => {
    const layers = [...form.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    layer.consumableItems = layer.consumableItems.filter((_, i) => i !== ciIdx);
    layers[layerIdx] = layer;
    f("secondaryLayers", layers);
  };

  const clonePlyConsumable = (layerIdx: number, ciIdx: number) => {
    const layers = [...form.secondaryLayers];
    const layer = { ...layers[layerIdx] };
    const clone: PlyConsumableItem = { ...layer.consumableItems[ciIdx], consumableId: Math.random().toString(), isClone: true };
    layer.consumableItems = [
      ...layer.consumableItems.slice(0, ciIdx + 1),
      clone,
      ...layer.consumableItems.slice(ciIdx + 1),
    ];
    layers[layerIdx] = layer;
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
      pantoneRef: "", labL: "", labA: "", labB: "",
      labLMeas: "", labAMeas: "", labBMeas: "",
      deltaE: "--", deltaETol: "1.0",
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

  // ── Auto-sync colorShades + cylinderAllocs with inks in ply layers ──
  // Runs whenever ply consumables change; preserves user-entered LAB data by consumableId
  useEffect(() => {
    if (!modalOpen) return;
    const inkList = form.secondaryLayers.flatMap((l, li) =>
      l.consumableItems
        .filter(ci => ci.itemGroup === "Ink")
        .map(ci => ({
          consumableId: ci.consumableId,
          inkItemId: ci.itemId ?? "",
          inkName: ci.itemName || ci.fieldDisplayName || `Ink ${li + 1}`,
        }))
    );

    setColorShades(prev =>
      inkList.map((ink, i) => {
        const existing = prev.find(c => (c as any).consumableId === ink.consumableId);
        if (existing) return { ...existing, colorNo: i + 1 };
        const inkItem = INK_ITEMS.find(x => x.id === ink.inkItemId);
        return {
          colorNo: i + 1,
          colorName: inkItem?.colour || inkItem?.name || ink.inkName,
          inkType: "Spot" as const,
          pantoneRef: (inkItem as any)?.pantoneNo || "",
          labL: "", labA: "", labB: "",
          labLMeas: "", labAMeas: "", labBMeas: "",
          deltaE: "--", deltaETol: "1.0",
          shadeCardRef: "", status: "Pending" as const, remarks: "",
          consumableId: ink.consumableId,
          inkItemId: ink.inkItemId,
        } as any;
      })
    );

    setCylinderAllocs(prev =>
      inkList.map((ink, i) => {
        const existing = prev.find(c => (c as any).consumableId === ink.consumableId);
        if (existing) return { ...existing, colorNo: i + 1, colorName: ink.inkName };
        return {
          colorNo: i + 1,
          colorName: ink.inkName,
          cylinderNo: form.cylinderSet ? `${form.cylinderSet}-C${String(i + 1).padStart(2, "0")}` : "",
          circumference: selectedPlan ? String(selectedPlan.cylCirc) : "",
          cylinderType: "Existing" as const,
          status: "Pending" as const,
          remarks: "",
          consumableId: ink.consumableId,
        } as any;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.secondaryLayers, form.cylinderSet, modalOpen]);

  const cellInput = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

  // ── Convert pending order to WO ────────────────────────────
  const convertToWO = (order: GravureOrder) => {
    setEditing(null);
    const o = order as any;
    const sType: GravureWorkOrder["structureType"] = o.structureType || undefined;
    setForm({
      ...blankWO,
      sourceOrderType: order.sourceType || "Estimation",
      orderId: order.id,
      orderNo: order.orderNo,
      customerId: order.customerId,
      customerName: order.customerName,
      jobName: order.jobName,
      substrate: order.substrate,
      structure: order.structure,
      categoryId: order.categoryId,
      categoryName: order.categoryName,
      content: order.content,
      jobWidth: order.jobWidth,
      jobHeight: order.jobHeight,
      actualWidth: o.actualWidth || order.jobWidth,
      actualHeight: o.actualHeight || order.jobHeight,
      width: order.jobWidth,
      noOfColors: order.noOfColors,
      printType: (order.printType as GravureWorkOrder["printType"]) || "Surface Print",
      quantity: order.quantity,
      unit: order.unit,
      cylinderSet: order.cylinderSet,
      machineId: order.machineId,
      machineName: order.machineName,
      cylinderCostPerColor: 3500,
      processes: order.processes,
      secondaryLayers: order.secondaryLayers,
      // ── Planning fields from estimation ──
      selectedPlanId: o.selectedPlanId || "",
      ups: 0,
      structureType: sType,
      trimmingSize: o.trimmingSize || 0,
      widthShrinkage: o.widthShrinkage || 0,
      gusset: o.gusset || 0,
      topSeal: o.topSeal || 0,
      bottomSeal: o.bottomSeal || 0,
      sideSeal: o.sideSeal || 0,
      centerSealWidth: o.centerSealWidth || 0,
      sideGusset: o.sideGusset || 0,
      seamingArea: o.seamingArea || 0,
      transparentArea: o.transparentArea || 0,
      finalRollOD: o.finalRollOD || undefined,
      rollUnit: o.rollUnit || "Meter",
      unwindDirection: o.unwindDirection || 0,
      frontColors: o.frontColors || 0,
      backColors: o.backColors || 0,
      salesPerson: o.salesPerson || order.salesPerson || "",
      salesType: o.salesType || order.salesType || "Local",
      overheadPct: order.overheadPct,
      profitPct: order.profitPct,
      perMeterRate: order.perMeterRate,
      totalAmount: order.totalAmount,
    });
    // Pre-populate dimValues from order fields
    setDimValues({
      width: o.actualWidth || order.jobWidth || undefined,
      height: o.actualHeight || order.jobHeight || undefined,
      layflatWidth: sType === "Sleeve" ? (o.actualWidth || order.jobWidth || undefined) : undefined,
      cutHeight: sType === "Sleeve" ? (o.actualHeight || order.jobHeight || undefined) : undefined,
      gusset: o.gusset || undefined,
      topSeal: o.topSeal || undefined,
      bottomSeal: o.bottomSeal || undefined,
      sideSeal: o.sideSeal || undefined,
      centerSealWidth: o.centerSealWidth || undefined,
      sideGusset: o.sideGusset || undefined,
      seamingArea: o.seamingArea || undefined,
      transparentArea: o.transparentArea || undefined,
      widthShrinkage: o.widthShrinkage || undefined,
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
    // Restore dimValues from saved WO fields
    const w = wo as any;
    setDimValues({
      width: wo.actualWidth || undefined,
      height: wo.actualHeight || undefined,
      layflatWidth: w.structureType === "Sleeve" ? (wo.actualWidth || undefined) : undefined,
      cutHeight: w.structureType === "Sleeve" ? (wo.actualHeight || undefined) : undefined,
      gusset: w.gusset || undefined,
      topSeal: w.topSeal || undefined,
      bottomSeal: w.bottomSeal || undefined,
      sideSeal: w.sideSeal || undefined,
      centerSealWidth: w.centerSealWidth || undefined,
      sideGusset: w.sideGusset || undefined,
      seamingArea: w.seamingArea || undefined,
      transparentArea: w.transparentArea || undefined,
      widthShrinkage: w.widthShrinkage || undefined,
    });
    setModalTab("basic");
    setShowPlan(false); setIsPlanApplied(!!wo.selectedPlanId);
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

    // Persist live-calculated cost into the saved WO
    const formWithCost = {
      ...form,
      totalAmount: liveCost.totalAmount > 0 ? liveCost.totalAmount : form.totalAmount,
      perMeterRate: liveCost.perMeterRate > 0 ? liveCost.perMeterRate : form.perMeterRate,
    };

    const saveForm = wasSpecialNowReal
      ? { ...formWithCost, status: "Open" as const }
      : formWithCost;

    // ── API save ──────────────────────────────────────────────
    const payload = {
      FlagEdit: editing ? "true" : "false",
      JobBookingID: editing ? Number(editing.id) : 0,
      Prefix: apiPrefix,
      ...saveForm,
      // Align field names to what backend expects
      customerId: saveForm.customerId,
      ledgerId: saveForm.customerId,
      machineId: Number(saveForm.machineId) || 0,
      operatorId: Number(saveForm.operatorId) || 0,
      categoryId: Number(saveForm.categoryId) || 0,
      orderId: Number(saveForm.orderId) || 0,
      quantity: saveForm.quantity,
      colorShades,
    };

    apiPost<any>("api/gravureWorkOrderShrink/saveworkorder", payload)
      .then(res => {
        if (res?.success) {
          const newId = String(res.jobBookingId ?? res.id ?? "");
          const newNo = String(res.workOrderNo ?? res.no ?? "");
          if (editing) {
            setWOs(d => d.map(r => r.id === editing.id
              ? { ...saveForm, id: editing.id, workOrderNo: editing.workOrderNo }
              : r));
          } else {
            setWOs(d => [...d, { ...saveForm, id: newId, workOrderNo: newNo }]);
          }
          setModal(false);
          setReplan(false);
        } else {
          alert("Save failed. Please try again.");
        }
      })
      .catch(() => {
        // Fallback to local state so UI is not broken if API is down
        if (editing) {
          setWOs(d => d.map(r => r.id === editing.id
            ? { ...saveForm, id: editing.id, workOrderNo: editing.workOrderNo }
            : r));
        } else {
          const workOrderNo = generateCode(UNIT_CODE.Gravure, MODULE_CODE.WorkOrder, workOrders.map(d => d.workOrderNo));
          const id = `GVWO${String(workOrders.length + 1).padStart(3, "0")}`;
          setWOs(d => [...d, { ...saveForm, id, workOrderNo }]);
        }
        setModal(false);
        setReplan(false);
      });
  };

  const stats = {
    pending: pendingOrders.length,
    open: workOrders.filter(w => w.status === "Open").length,
    inProgress: workOrders.filter(w => w.status === "In Progress").length,
    completed: workOrders.filter(w => w.status === "Completed").length,
  };

  // ── Columns ────────────────────────────────────────────────
  const woColumns: Column<GravureWorkOrder>[] = [
    { key: "workOrderNo", header: "Work Order No", sortable: true },
    {
      key: "orderId", header: "Type",
      render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${r.sourceOrderType !== "Direct" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>{r.sourceOrderType !== "Direct" ? "From Order" : "Direct"}</span>
    },
    { key: "date", header: "Date", sortable: true },
    { key: "customerName", header: "Customer", sortable: true },
    { key: "jobName", header: "Job Name" },
    { key: "substrate", header: "Substrate", render: r => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">{r.substrate || "—"}</span> },
    { key: "noOfColors", header: "Colors", render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "machineName", header: "Machine" },
    { key: "plannedDate", header: "Planned Date" },
    {
      key: "selectedPlanId", header: "Tool Status",
      render: r => woHasSpecialPlan(r)
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">⚠ Tool Pending</span>
        : r.selectedPlanId
          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">✓ Ready</span>
          : <span className="text-gray-300 text-xs">—</span>
    },
    { key: "status", header: "Status", render: r => statusBadge(r.status), sortable: true },
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

              {/* Category — editable for Direct, and also editable for order-linked fallback when catalog mapping is missing */}
              {form.sourceOrderType === "Direct" || !form.categoryId ? (
                <Select label="Category *" value={form.categoryId}
                  onChange={e => {
                    setDimValues({});
                    if (!e.target.value) { setForm(p => ({ ...p, categoryId: "", categoryName: "", content: "", structureType: undefined, secondaryLayers: [] } as any)); return; }
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

              {/* Content Type — dropdown for Direct and for order-linked fallback when content is missing */}
              {(form.sourceOrderType === "Direct" || (form.categoryId && !form.content)) && form.categoryId ? (
                <Select label="Content Type *" value={form.content}
                  onChange={e => {
                    const content = e.target.value;
                    const sType = getStructureType(content);
                    setForm(p => ({ ...p, content, structureType: sType } as any));
                    setDimValues({});
                  }}
                  options={[
                    { value: "", label: "-- Select Content Type --" },
                    ...(categories.find(c => c.id === form.categoryId)?.contents || []).map(ct => ({ value: ct, label: ct })),
                  ]}
                />
              ) : form.sourceOrderType !== "Direct" && form.content ? (
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Content Type</label>
                  <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700 font-medium">{form.content}</div>
                </div>
              ) : null}

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
              <Input label="Wastage %" type="number" value={form.wastagePct ?? 1} onChange={e => f("wastagePct", Number(e.target.value) || 1)} placeholder="1" />
              <Input label="Planned Date" type="date" value={form.plannedDate} onChange={e => f("plannedDate", e.target.value)} />
              <Select label="Status" value={form.status} onChange={e => f("status", e.target.value as typeof form.status)}
                options={[{ value: "Open", label: "Open" }, { value: "In Progress", label: "In Progress" }, { value: "Completed", label: "Completed" }, { value: "On Hold", label: "On Hold" }]} />
            </div>
          </div>

          {/* ── Dimension Setup + Live Diagram (when content type is known) ── */}
          {form.content && CONTENT_TYPE_CONFIG[normalizeContentType(form.content)] && (
            <div className="border border-indigo-200 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 flex items-center gap-2">
                <Calculator size={14} className="text-white" />
                <p className="text-xs font-bold text-white uppercase tracking-widest">Dimension Setup — {form.content}</p>
                {(form as any).structureType && (
                  <span className="ml-auto px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full uppercase">
                    {(form as any).structureType}
                  </span>
                )}
              </div>

              {/* Sleeve / Pouch specs bar */}
              {(() => {
                const sType = (form as any).structureType || getStructureType(form.content);
                if (sType === "Sleeve" && form.jobWidth > 0) {
                  const lf = form.jobWidth || 0;
                  const sh = (form as any).widthShrinkage || 0;
                  const sa = (form as any).seamingArea || 0;
                  const ta = (form as any).transparentArea || 0;
                  const dc = lf * 2 + sa + ta;
                  return (
                    <div className="px-4 pt-3">
                      <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-[10px]">
                        <div className="flex items-center gap-1.5 text-blue-700 font-bold uppercase tracking-wide"><Layers size={12} /> Sleeve Planning</div>
                        <div className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg font-bold text-blue-700">Layflat = {lf} mm</div>
                        <div className="flex flex-col px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-[10px] leading-tight">
                          <span>Design Circ</span><span>{lf}×2{ta > 0 ? `+${ta}` : ""}{sa > 0 ? `+${sa}` : ""} = {dc} mm</span>
                        </div>
                        <div className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-blue-600">Cut Length = {form.jobHeight} mm</div>
                        {sh > 0 && <div className="px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-700 font-bold ml-auto text-[10px]">Shrinkage +{sh}mm per sleeve</div>}
                      </div>
                    </div>
                  );
                }
                if (sType === "Pouch" && form.jobWidth > 0) {
                  const c = form.content;
                  const jW = form.jobWidth; const jH = form.jobHeight;
                  const tS = (form as any).topSeal || 0; const bS = (form as any).bottomSeal || 0;
                  const sS = (form as any).sideSeal || 0; const cS = (form as any).centerSealWidth || 0;
                  const sG = (form as any).sideGusset || 0; const gus = (form as any).gusset || 0;
                  let lane = jW, repeat = jH;
                  if (c === "Pouch — 3 Side Seal" || c === "Standup Pouch" || c === "Zipper Pouch") lane = jW + 2 * sS;
                  else if (c === "Pouch — Center Seal") lane = jW * 2 + cS;
                  else if (c === "Both Side Gusset Pouch" || c === "3D Pouch / Flat Bottom") lane = jW + 2 * sG;
                  if (c === "Pouch — 3 Side Seal" || c === "Pouch — Center Seal" || c === "Both Side Gusset Pouch") repeat = jH + tS + bS;
                  else if (c === "Standup Pouch" || c === "Zipper Pouch" || c === "3D Pouch / Flat Bottom") repeat = jH + tS + (gus > 0 ? gus / 2 : 0);
                  return (
                    <div className="px-4 pt-3">
                      <div className="flex flex-wrap items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl text-[10px]">
                        <div className="flex items-center gap-1.5 text-orange-700 font-bold uppercase tracking-wide"><Package size={12} /> Pouch Specs</div>
                        <div className="ml-auto flex gap-2">
                          <div className="px-3 py-1.5 bg-white border border-orange-200 rounded-lg font-bold text-orange-700">Lane = {lane} mm</div>
                          <div className="px-3 py-1.5 bg-white border border-orange-200 rounded-lg text-orange-600">Repeat = {repeat} mm</div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: dimension inputs */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-1">Packaging Dimensions</p>
                  <DimensionInputPanel
                    contentType={normalizeContentType(form.content)}
                    dims={dimValues}
                    onChange={patch => {
                      patchDim(patch);
                      if ("width" in patch && patch.width !== undefined) setForm(p => ({ ...p, jobWidth: patch.width!, width: patch.width!, actualWidth: patch.width! }));
                      if ("layflatWidth" in patch && patch.layflatWidth !== undefined) setForm(p => ({ ...p, jobWidth: patch.layflatWidth!, width: patch.layflatWidth!, actualWidth: patch.layflatWidth! }));
                      if ("height" in patch && patch.height !== undefined) setForm(p => ({ ...p, jobHeight: patch.height!, actualHeight: patch.height! }));
                      if ("cutHeight" in patch && patch.cutHeight !== undefined) setForm(p => ({ ...p, jobHeight: patch.cutHeight!, actualHeight: patch.cutHeight! }));
                      if ("gusset" in patch && patch.gusset !== undefined) setForm(p => ({ ...p, gusset: patch.gusset } as any));
                      if ("seamingArea" in patch && patch.seamingArea !== undefined) setForm(p => ({ ...p, seamingArea: patch.seamingArea } as any));
                      if ("transparentArea" in patch && patch.transparentArea !== undefined) setForm(p => ({ ...p, transparentArea: patch.transparentArea } as any));
                      if ("topSeal" in patch && patch.topSeal !== undefined) setForm(p => ({ ...p, topSeal: patch.topSeal } as any));
                      if ("bottomSeal" in patch && patch.bottomSeal !== undefined) setForm(p => ({ ...p, bottomSeal: patch.bottomSeal } as any));
                      if ("sideSeal" in patch && patch.sideSeal !== undefined) setForm(p => ({ ...p, sideSeal: patch.sideSeal } as any));
                      if ("centerSealWidth" in patch && patch.centerSealWidth !== undefined) setForm(p => ({ ...p, centerSealWidth: patch.centerSealWidth } as any));
                      if ("sideGusset" in patch && patch.sideGusset !== undefined) setForm(p => ({ ...p, sideGusset: patch.sideGusset } as any));
                    }}
                  />
                  {/* Shrinkage */}
                  <div>
                    {(() => {
                      const isSl = ((form as any).structureType || getStructureType(form.content)) === "Sleeve";
                      return (
                        <>
                          <label className="text-[10px] font-semibold text-rose-500 uppercase block mb-1">
                            {isSl ? <>Length Shrinkage (mm) <span className="normal-case text-gray-400 font-normal">— per sleeve</span></> : <>Repeat Shrinkage (mm) <span className="normal-case text-gray-400 font-normal">— optional</span></>}
                          </label>
                          <input type="number" min={0} max={isSl ? 10 : 1.5} step={0.1}
                            placeholder={isSl ? "e.g. 3" : "e.g. 1"}
                            value={(form as any).widthShrinkage || ""}
                            onChange={e => { const v = Math.min(isSl ? 10 : 1.5, Math.max(0, Number(e.target.value) || 0)); patchDim({ widthShrinkage: v }); setForm(p => ({ ...p, widthShrinkage: v } as any)); }}
                            className="w-full text-sm border border-rose-200 rounded-xl px-3 py-2 bg-rose-50 focus:bg-white outline-none focus:ring-2 focus:ring-rose-400 font-mono" />
                        </>
                      );
                    })()}
                  </div>
                  {/* Roll OD + Roll Unit + Unwind Direction */}
                  <div className="border-t border-indigo-100 pt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Final Roll OD (mm)</label>
                      <input type="number" min={0} placeholder="e.g. 200"
                        className="w-full text-sm border border-teal-200 rounded-xl px-3 py-2 bg-teal-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                        value={(form as any).finalRollOD ?? ""}
                        onChange={e => setForm(p => ({ ...p, finalRollOD: Number(e.target.value) || undefined } as any))} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Roll Qty Unit</label>
                      <div className="flex gap-2 mt-0.5">
                        {(["Meter", "KG"] as const).map(u => (
                          <button key={u} type="button" onClick={() => setForm(p => ({ ...p, rollUnit: u } as any))}
                            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${((form as any).rollUnit ?? "Meter") === u ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-400"}`}>{u}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Unwind Direction */}
                  <div className="border-t border-indigo-100 pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-widest">Unwind Direction (Pifa)</p>
                      <span className="text-[9px] text-gray-400">AJSW Printing &amp; Winding Chart</span>
                    </div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Printed ACROSS the Roll</p>
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                      {([
                        { n: 1, label: "Outside · Across\nTop off first" },
                        { n: 2, label: "Inside · Across\nTop off first" },
                        { n: 3, label: "Outside · Across\nBottom off first" },
                        { n: 4, label: "Inside · Across\nBottom off first" },
                      ]).map(({ n, label }) => {
                        const sel = ((form as any).unwindDirection ?? 0) === n;
                        return (
                          <button key={n} type="button" onClick={() => setForm(p => ({ ...p, unwindDirection: n } as any))}
                            title={label.replace("\n", " ")}
                            className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl border-2 text-center transition-all ${sel ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white hover:border-orange-300"}`}>
                            <span className={`text-[11px] font-black ${sel ? "text-orange-600" : "text-gray-700"}`}>#{n}</span>
                            <span className={`text-[7px] font-medium leading-tight whitespace-pre-line ${sel ? "text-orange-500" : "text-gray-400"}`}>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Printed WITH the Roll</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        { n: 5, label: "Outside · With Roll\nRight off first" },
                        { n: 6, label: "Inside · With Roll\nRight off first" },
                        { n: 7, label: "Outside · With Roll\nLeft off first" },
                        { n: 8, label: "Inside · With Roll\nLeft off first" },
                      ]).map(({ n, label }) => {
                        const sel = ((form as any).unwindDirection ?? 0) === n;
                        return (
                          <button key={n} type="button" onClick={() => setForm(p => ({ ...p, unwindDirection: n } as any))}
                            title={label.replace("\n", " ")}
                            className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl border-2 text-center transition-all ${sel ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white hover:border-orange-300"}`}>
                            <span className={`text-[11px] font-black ${sel ? "text-orange-600" : "text-gray-700"}`}>#{n}</span>
                            <span className={`text-[7px] font-medium leading-tight whitespace-pre-line ${sel ? "text-orange-500" : "text-gray-400"}`}>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {(form as any).unwindDirection > 0 && (
                      <p className="mt-1.5 text-[10px] text-orange-600 font-semibold flex items-center gap-1">
                        <Check size={10} /> Direction #{(form as any).unwindDirection} — {[
                          "#1 Outside · Across · Top off first", "#2 Inside · Across · Top off first",
                          "#3 Outside · Across · Bottom off first", "#4 Inside · Across · Bottom off first",
                          "#5 Outside · With Roll · Right off first", "#6 Inside · With Roll · Right off first",
                          "#7 Outside · With Roll · Left off first", "#8 Inside · With Roll · Left off first",
                        ][((form as any).unwindDirection ?? 1) - 1]}
                      </p>
                    )}
                  </div>
                </div>
                {/* Right: live diagram */}
                <DimensionDiagram contentType={normalizeContentType(form.content)} dims={dimValues} />
              </div>
            </div>
          )}


          {/* ── LDPE / LLDPE Multi-Pack Shrink Film Layout ── */}
          {getStructureType(form.content) === "MultiPackShrink" && (() => {
            const mpFilmW = form.jobWidth || 0;
            const mpRepeat = (form as any).repeatLength || 0;
            const mpPackW = (form as any).packWidth || 0;
            const mpPackH = (form as any).packHeight || 0;
            const mpHMargin = (form as any).hMargin || 0;
            const mpVMargin = (form as any).vMargin || 0;
            const unitW = mpPackW > 0 && mpHMargin > 0 ? mpPackW + 2 * mpHMargin : 0;
            const unitH = mpPackH > 0 && mpVMargin > 0 ? mpPackH + 2 * mpVMargin : 0;
            const mpAcross = unitW > 0 && mpFilmW > 0 ? Math.floor(mpFilmW / unitW) : 0;
            const mpVert = unitH > 0 && mpRepeat > 0 ? Math.floor(mpRepeat / unitH) : 0;
            const mpTotal = mpAcross * mpVert;
            const mpPrinted = (form as any).printedLength || 0;
            const mpEyeMark = (form as any).eyeMarkLength ?? 3;
            const mpGap = (form as any).gapLength || 0;
            const repeatSum = mpPrinted + mpEyeMark + mpGap;
            const repeatOK = mpRepeat > 0 && mpPrinted > 0 && Math.abs(repeatSum - mpRepeat) < 0.1;
            return (
              <div className="border border-emerald-200 rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 flex items-center gap-2">
                  <Layers size={14} className="text-white" />
                  <p className="text-xs font-bold text-white uppercase tracking-widest">Multi-Pack Shrink Film Layout</p>
                  <span className="ml-auto px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full uppercase">LDPE / LLDPE</span>
                </div>
                <div className="p-4 space-y-4">

                  {/* Film Dimensions */}
                  <div>
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2">Film Dimensions</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Width (mm) *</label>
                        <input type="number" min={0} step={1} placeholder="e.g. 463"
                          value={form.jobWidth || ""}
                          onChange={e => f("jobWidth", Number(e.target.value))}
                          className="w-full text-sm border border-emerald-200 rounded-xl px-3 py-2 bg-emerald-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                        <p className="text-[9px] text-gray-400 mt-0.5">Full flat film width</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Repeat Length (mm) *</label>
                        <input type="number" min={0} step={0.1} placeholder="e.g. 477"
                          value={(form as any).repeatLength || ""}
                          onChange={e => f("repeatLength" as any, Number(e.target.value))}
                          className="w-full text-sm border border-emerald-200 rounded-xl px-3 py-2 bg-emerald-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                        <p className="text-[9px] text-gray-400 mt-0.5">Eye mark to eye mark</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Repeat Shrinkage (mm)</label>
                        <input type="number" min={0} step={0.1} placeholder="e.g. 0"
                          value={(form as any).repeatShrinkage || ""}
                          onChange={e => f("repeatShrinkage" as any, parseFloat(e.target.value) || 0)}
                          className="w-full text-sm border border-amber-200 rounded-xl px-3 py-2 bg-amber-50 focus:bg-white outline-none focus:ring-2 focus:ring-amber-400 font-mono" />
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {(() => { const rs = (form as any).repeatShrinkage || 0; return rs > 0 ? `Cyl repeat = ${mpRepeat} + ${rs} = ${mpRepeat + rs} mm` : "Extra mm for shrinkage"; })()}
                        </p>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Colors</label>
                        <div className="flex gap-1.5">
                          <div className="flex-1">
                            <label className="text-[9px] text-gray-400 block mb-0.5">Front</label>
                            <input type="number" min={0} max={12} placeholder="0"
                              value={form.frontColors || ""}
                              onChange={e => f("frontColors", Number(e.target.value))}
                              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[9px] text-gray-400 block mb-0.5">Back</label>
                            <input type="number" min={0} max={12} placeholder="0"
                              value={form.backColors || ""}
                              onChange={e => f("backColors", Number(e.target.value))}
                              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Total Colors</label>
                        <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl text-sm font-bold text-purple-700 text-center mt-[18px]">{form.noOfColors} Colors</div>
                      </div>
                    </div>
                  </div>

                  {/* Pack Size & Margins */}
                  <div>
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2">Individual Pack Size &amp; Margin — UPS Auto-Calculated</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Pack Width (mm) *</label>
                        <input type="number" min={0} step={0.1} placeholder="e.g. 97"
                          value={(form as any).packWidth || ""}
                          onChange={e => f("packWidth" as any, parseFloat(e.target.value) || 0)}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                        <p className="text-[9px] text-gray-400 mt-0.5">Width of 1 pack</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Pack Height (mm) *</label>
                        <input type="number" min={0} step={0.1} placeholder="e.g. 70"
                          value={(form as any).packHeight || ""}
                          onChange={e => f("packHeight" as any, parseFloat(e.target.value) || 0)}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                        <p className="text-[9px] text-gray-400 mt-0.5">Height of 1 pack</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">H-Margin / Side Gap (mm) *</label>
                        <input type="number" min={0} step={0.1} placeholder="e.g. 66.5"
                          value={(form as any).hMargin || ""}
                          onChange={e => f("hMargin" as any, parseFloat(e.target.value) || 0)}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                        <p className="text-[9px] text-gray-400 mt-0.5">Each side (across)</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">V-Margin / Top-Bot Gap (mm) *</label>
                        <input type="number" min={0} step={0.1} placeholder="e.g. 94.9"
                          value={(form as any).vMargin || ""}
                          onChange={e => f("vMargin" as any, parseFloat(e.target.value) || 0)}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                        <p className="text-[9px] text-gray-400 mt-0.5">Each side (vertical)</p>
                      </div>
                    </div>
                    {mpPackW > 0 && mpPackH > 0 && mpHMargin > 0 && mpVMargin > 0 && mpFilmW > 0 && mpRepeat > 0 ? (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center justify-center gap-1 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Across UPS</span>
                          <span className="text-2xl font-black text-emerald-700">{mpAcross}</span>
                          <span className="text-[9px] text-emerald-500">{mpFilmW} ÷ {unitW.toFixed(1)} = {mpAcross}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center gap-1 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Vertical UPS</span>
                          <span className="text-2xl font-black text-emerald-700">{mpVert}</span>
                          <span className="text-[9px] text-emerald-500">{mpRepeat} ÷ {unitH.toFixed(1)} = {mpVert}</span>
                        </div>
                        <div className={`flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-xl border-2 ${mpTotal > 0 ? "bg-emerald-600 border-emerald-700" : "bg-gray-100 border-gray-200"}`}>
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${mpTotal > 0 ? "text-emerald-100" : "text-gray-400"}`}>Total UPS / Repeat</span>
                          <span className={`text-3xl font-black ${mpTotal > 0 ? "text-white" : "text-gray-300"}`}>{mpTotal || "—"}</span>
                          {mpTotal > 0 && <span className="text-[9px] text-emerald-200">{mpAcross} Across × {mpVert} Vertical</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                        Enter Film Width, Repeat Length, Pack Width, Pack Height, H-Margin and V-Margin to auto-calculate UPS.
                      </div>
                    )}
                  </div>

                  {/* Repeat Breakdown */}
                  <div>
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2">Repeat Breakdown (Optional — for validation)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Printed Length (mm)</label>
                        <input type="number" min={0} step={0.1} placeholder="e.g. 474"
                          value={(form as any).printedLength || ""}
                          onChange={e => f("printedLength" as any, parseFloat(e.target.value) || 0)}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Eye Mark Length (mm)</label>
                        <input type="number" min={0} step={0.1} placeholder="default 3"
                          value={mpEyeMark || ""}
                          onChange={e => f("eyeMarkLength" as any, parseFloat(e.target.value) || 3)}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Gap Length (mm)</label>
                        <input type="number" min={0} step={0.1} placeholder="e.g. 0"
                          value={(form as any).gapLength || ""}
                          onChange={e => f("gapLength" as any, parseFloat(e.target.value) || 0)}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
                      </div>
                    </div>
                    {mpRepeat > 0 && mpPrinted > 0 && (
                      <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${repeatOK ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                        {repeatOK ? <Check size={13} /> : <X size={13} />}
                        <span>
                          {repeatOK
                            ? `Repeat OK: ${mpPrinted} + ${mpEyeMark} + ${mpGap} = ${repeatSum} mm = Repeat ${mpRepeat} mm`
                            : `Mismatch: ${mpPrinted} + ${mpEyeMark} + ${mpGap} = ${repeatSum.toFixed(1)} mm ≠ Repeat ${mpRepeat} mm`}
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })()}

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
                onChange={e => {
                  const dbM = dbMachines.find(x => x.id === e.target.value);
                  const name = dbM?.name || e.target.value;
                  f("machineId", e.target.value); f("machineName", name);
                }}
                options={[
                  { value: "", label: "-- Select Machine --" },
                  ...(form.machineId && !dbMachines.find(m => m.id === form.machineId)
                    ? [{ value: form.machineId, label: form.machineName || form.machineId }]
                    : []),
                  ...dbMachines.map(m => ({ value: m.id, label: m.name }))
                ]}
              />
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
              <div className="flex items-center gap-2">
                {/* Bulk add */}
                {(() => {
                  let inputRef: HTMLInputElement | null = null;
                  const addBulk = (el: HTMLInputElement | null) => {
                    const n = Math.min(10, Math.max(1, parseInt(el?.value ?? "1") || 1));
                    const layers = [...form.secondaryLayers];
                    for (let k = 0; k < n; k++) layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                    f("secondaryLayers", layers);
                    if (el) el.value = "";
                  };
                  return (
                    <div className="flex items-center gap-0 border border-purple-300 rounded-lg overflow-hidden bg-white">
                      <span className="text-[10px] font-semibold text-purple-600 px-2 bg-purple-50 whitespace-nowrap border-r border-purple-200 py-1.5">Add</span>
                      <input type="number" min={1} max={10} placeholder="1" ref={el => { inputRef = el; }}
                        className="w-12 text-xs font-mono text-center border-none outline-none px-1 py-1.5 bg-white"
                        onKeyDown={e => { if (e.key === "Enter") addBulk(e.target as HTMLInputElement); }} />
                      <button onClick={() => addBulk(inputRef)}
                        className="text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-2 py-1.5 whitespace-nowrap transition">+ Plys</button>
                    </div>
                  );
                })()}
                <button onClick={() => {
                  const layers = [...form.secondaryLayers];
                  layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                  f("secondaryLayers", layers);
                }} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200">
                  <Plus size={12} /> Add Ply
                </button>
              </div>
            </div>
            {form.secondaryLayers.length > 0 && (
              <div className="space-y-3">
                {form.secondaryLayers.map((l, index) => {
                  const thicknesses = FILM_SUBGROUPS.find(s => s.subGroup === l.itemSubGroup)?.thicknesses || [];
                  return (
                    <div key={l.id ?? l.layerNo ?? index} className="bg-white border-2 border-purple-50 rounded-2xl shadow-sm relative overflow-hidden">
                      <div className="flex items-center justify-between bg-purple-50 px-4 py-2 border-b border-purple-100">
                        <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                          {l.layerNo === 1 ? "1st" : l.layerNo === 2 ? "2nd" : l.layerNo === 3 ? "3rd" : `${l.layerNo}th`} Ply
                        </span>
                        <button onClick={() => f("secondaryLayers", form.secondaryLayers.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                      </div>
                      <div className="p-3 space-y-3">
                        {/* Ply Type */}
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
                        {/* Film Substrate */}
                        {l.plyType && (
                          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Type</label>
                              <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                value={l.itemSubGroup}
                                onChange={e => {
                                  const subGroup = e.target.value;
                                  const sg = FILM_SUBGROUPS.find(s => s.subGroup === subGroup);
                                  const layers = [...form.secondaryLayers];
                                  layers[index] = { ...l, itemSubGroup: subGroup, density: sg?.density ?? 0, thickness: 0, gsm: 0 };
                                  f("secondaryLayers", layers);
                                }}>
                                <option value="">Select Film Type</option>
                                {l.itemSubGroup && !FILM_SUBGROUPS.find(s => s.subGroup === l.itemSubGroup) && (
                                  <option value={l.itemSubGroup}>{l.itemSubGroup} {l.itemName ? `(${l.itemName})` : "(from catalog)"}</option>
                                )}
                                {FILM_SUBGROUPS.map(opt => <option key={opt.subGroup} value={opt.subGroup}>{opt.subGroup}</option>)}
                              </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                            </div>
                          </div>
                        )}
                        {/* Consumable Items — free-form (same as Product Catalog) */}
                        {l.plyType && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Consumable Items ({l.consumableItems.length})</span>
                              <button onClick={() => addPlyConsumable(index)}
                                className="flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 transition">
                                <Plus size={10} /> Add Consumable
                              </button>
                            </div>
                            {(() => {
                              const groupSerials: number[] = [];
                              const groupCounter: Record<string, number> = {};
                              l.consumableItems.forEach(ci => {
                                const g = ci.itemGroup || "Consumable";
                                groupCounter[g] = (groupCounter[g] || 0) + 1;
                                groupSerials.push(groupCounter[g]);
                              });
                              const CONSUMABLE_GROUPS = ["Ink", "Solvent", "Adhesive", "Hardner"];
                              return l.consumableItems.map((ci, ciIdx) => {
                                const subGroups = ci.itemGroup ? (CATEGORY_GROUP_SUBGROUP["Raw Material (RM)"]?.[ci.itemGroup] ?? []) : [];
                                const filteredItems = items.filter(it => it.group === ci.itemGroup && it.active && (!ci.itemSubGroup || it.subGroup === ci.itemSubGroup));
                                const ciLabel = ci.itemGroup || "Consumable";
                                const ciSerial = groupSerials[ciIdx] ?? 1;
                                // Ink calcs
                                const liquidGSM = ci.itemGroup === "Ink" && ci.gsm > 0 && (ci.solidPct ?? 40) > 0
                                  ? parseFloat((ci.gsm / ((ci.solidPct ?? 40) / 100)).toFixed(2)) : 0;
                                // Hardener auto-calc
                                const adhesiveCI = l.consumableItems.find(x => x.itemGroup === "Adhesive");
                                const hardenerGSM = ci.itemGroup === "Hardner" && (ci.ncoPct ?? 0) > 0
                                  ? parseFloat((((adhesiveCI?.gsm ?? 0) * (adhesiveCI?.ohPct ?? 0)) / ci.ncoPct!).toFixed(3)) : null;
                                const colCount = ci.itemGroup === "Ink" ? 6 : ci.itemGroup === "Adhesive" ? 5 : ci.itemGroup === "Hardner" ? 5 : 4;
                                return (
                                  <div key={ci.consumableId ?? ci.itemId ?? ciIdx} className="bg-teal-50/40 border border-teal-100 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10px] font-bold text-teal-700 uppercase">{ciLabel} {ciSerial}</span>
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => clonePlyConsumable(index, ciIdx)}
                                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition">
                                          Clone
                                        </button>
                                        <button onClick={() => removePlyConsumable(index, ciIdx)}
                                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><X size={12} /></button>
                                      </div>
                                    </div>
                                    <div className={`grid grid-cols-2 gap-2 sm:grid-cols-${colCount}`}>
                                      {/* Item Group */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item Group</label>
                                        <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                          value={ci.itemGroup}
                                          onChange={e => updatePlyConsumable(index, ciIdx, { itemGroup: e.target.value, itemSubGroup: "", itemId: "", itemName: "", gsm: 0, solidPct: undefined, ohPct: undefined, ncoPct: undefined })}>
                                          <option value="">-- Group --</option>
                                          {CONSUMABLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                      </div>
                                      {/* Sub Group */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Sub Group</label>
                                        <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                          value={ci.itemSubGroup}
                                          onChange={e => updatePlyConsumable(index, ciIdx, { itemSubGroup: e.target.value, itemId: "", itemName: "" })}
                                          disabled={!ci.itemGroup}>
                                          <option value="">-- Sub Group --</option>
                                          {subGroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                                        </select>
                                      </div>
                                      {/* Item Master */}
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item (Master)</label>
                                        <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                          value={ci.itemId}
                                          onChange={e => {
                                            const it = filteredItems.find(x => x.id === e.target.value);
                                            updatePlyConsumable(index, ciIdx, { itemId: it?.id ?? "", itemName: it?.name ?? "" });
                                          }}
                                          disabled={!ci.itemGroup}>
                                          <option value="">-- Select Item --</option>
                                          {filteredItems.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                                        </select>
                                      </div>
                                      {/* Ink */}
                                      {ci.itemGroup === "Ink" && (<>
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Dry Ink GSM</label>
                                          <input type="number" step={0.1} min={0}
                                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                            value={ci.gsm || ""}
                                            onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">% Solid</label>
                                          <input type="number" step={1} min={1} max={100}
                                            className="w-full text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                                            value={ci.solidPct ?? 40}
                                            onChange={e => updatePlyConsumable(index, ciIdx, { solidPct: Number(e.target.value) || 40 })}
                                            placeholder="40" />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-semibold text-purple-600 uppercase block mb-1">Liquid GSM</label>
                                          <div className="w-full text-xs border border-purple-200 rounded-lg px-2 py-1.5 bg-purple-50 font-mono font-bold text-purple-700 min-h-[30px]">
                                            {liquidGSM > 0 ? liquidGSM : "—"}
                                          </div>
                                        </div>
                                      </>)}
                                      {/* Solvent */}
                                      {ci.itemGroup === "Solvent" && (
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Ratio (%)</label>
                                          <input type="number" step={0.1} min={0} max={100}
                                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                            value={ci.gsm || ""} placeholder="e.g. 30"
                                            onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                        </div>
                                      )}
                                      {/* Adhesive */}
                                      {ci.itemGroup === "Adhesive" && (<>
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Adhesive GSM</label>
                                          <input type="number" step={0.1} min={0}
                                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                            value={ci.gsm || ""} placeholder="e.g. 4.5"
                                            onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-semibold text-orange-600 uppercase block mb-1">OH %</label>
                                          <input type="number" step={0.1} min={0}
                                            className="w-full text-xs border border-orange-200 rounded-lg px-2 py-1.5 bg-orange-50 outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                                            value={ci.ohPct ?? ""} placeholder="e.g. 2.5"
                                            onChange={e => updatePlyConsumable(index, ciIdx, { ohPct: Number(e.target.value) })} />
                                        </div>
                                      </>)}
                                      {/* Hardner */}
                                      {ci.itemGroup === "Hardner" && (<>
                                        <div>
                                          <label className="text-[10px] font-semibold text-rose-600 uppercase block mb-1">NCO %</label>
                                          <input type="number" step={0.1} min={0}
                                            className="w-full text-xs border border-rose-200 rounded-lg px-2 py-1.5 bg-rose-50 outline-none focus:ring-2 focus:ring-rose-400 font-mono"
                                            value={ci.ncoPct ?? ""} placeholder="e.g. 12.5"
                                            onChange={e => updatePlyConsumable(index, ciIdx, { ncoPct: Number(e.target.value) })} />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Hardener GSM (Auto)</label>
                                          <div className="w-full text-xs border border-teal-200 rounded-lg px-2 py-1.5 bg-teal-50 font-mono font-bold text-teal-700 min-h-[30px]">
                                            {hardenerGSM !== null ? hardenerGSM : <span className="text-gray-400 font-normal">Set Adhesive GSM + OH% + NCO%</span>}
                                          </div>
                                        </div>
                                      </>)}
                                      {/* Other */}
                                      {!["Ink", "Solvent", "Adhesive", "Hardner"].includes(ci.itemGroup) && (
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">GSM</label>
                                          <input type="number" step={0.1} min={0}
                                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                            value={ci.gsm || ""}
                                            onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                            {l.consumableItems.length === 0 && (
                              <p className="text-[10px] text-gray-400 italic text-center py-2">Click &quot;+ Add Consumable&quot; to add ink, solvent, adhesive, etc.</p>
                            )}
                            {/* Ply Summary Strip */}
                            {l.consumableItems.length > 0 && (() => {
                              const groupCount: Record<string, number> = {};
                              l.consumableItems.forEach(ci => { const g = ci.itemGroup || "Other"; groupCount[g] = (groupCount[g] || 0) + 1; });
                              const inks = l.consumableItems.filter(ci => ci.itemGroup === "Ink");
                              const totalDryGSM = inks.reduce((s, ci) => s + (parseFloat(String(ci.gsm)) || 0), 0);
                              const avgSolid = inks.length > 0 ? inks.reduce((s, ci) => s + (ci.solidPct ?? 40), 0) / inks.length : 0;
                              const GROUP_COLOR: Record<string, string> = { Ink: "bg-blue-100 text-blue-700 border-blue-200", Solvent: "bg-teal-100 text-teal-700 border-teal-200", Adhesive: "bg-violet-100 text-violet-700 border-violet-200", Hardner: "bg-orange-100 text-orange-700 border-orange-200", Other: "bg-gray-100 text-gray-600 border-gray-200" };
                              return (
                                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl mt-2">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ply Summary:</span>
                                  {Object.entries(groupCount).map(([g, cnt]) => (
                                    <span key={g} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${GROUP_COLOR[g] ?? GROUP_COLOR.Other}`}>{g}: <strong>{cnt}</strong></span>
                                  ))}
                                  {inks.length > 0 && (<>
                                    <span className="w-px h-3 bg-slate-300 mx-1" />
                                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Total Dry GSM: <strong>{totalDryGSM.toFixed(1)}</strong></span>
                                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Avg Solid: <strong>{avgSolid.toFixed(1)}%</strong></span>
                                  </>)}
                                </div>
                              );
                            })()}
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
                      <p className="text-indigo-200 text-[10px] mt-0.5">
                        {form.machineName} · {visiblePlans.length}/{allPlans.length} plans
                        {Object.keys(planColFilters).length > 0 && (
                          <button onClick={() => setPlanColFilters({})}
                            className="ml-2 px-1.5 py-0.5 bg-yellow-400 text-yellow-900 text-[9px] font-bold rounded-full hover:bg-yellow-300">
                            ✕ {Object.keys(planColFilters).length} filter{Object.keys(planColFilters).length > 1 ? "s" : ""} active
                          </button>
                        )}
                      </p>
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
                          <th className="p-2 border border-slate-700 text-center w-8">View</th>
                          {([
                            { key: "machineName", label: "Machine" },
                            { key: "acUps", label: "AC UPS" },
                            { key: "printingWidth", label: "Printing W (mm)" },
                            { key: "sleeveCode", label: "Sleeve" },
                            { key: "sleeveWidthVal", label: "Sleeve W (mm)" },
                            { key: "sideWaste", label: "Side Waste (mm)" },
                            { key: "filmSize", label: "Film Size (mm)" },
                            { key: "deadMargin", label: "Dead Margin (mm)" },
                            { key: "totalWaste", label: "Total Waste (mm)" },
                            { key: "cylinderCode", label: "Cylinder" },
                            { key: "cylinderWidthVal", label: "Cyl W (mm)" },
                            { key: "cylExtra", label: "Cyl Extra (mm)" },
                            { key: "cylRepeatLength", label: "Cyl Circ (mm)" },
                            { key: "cylAreaSqInch", label: "Cyl Area (sq.in)" },
                            { key: "repeatUPS", label: "Repeat UPS" },
                            { key: "totalUPS", label: "Total UPS" },
                            { key: "reqRMT", label: "Req. RMT" },
                            { key: "totalRMT", label: "Total RMT" },
                            { key: "totalWt", label: "Total Wt (Kg)" },
                            { key: "totalTime", label: "Total Time" },
                          ] as { key: string; label: string }[]).map(col => {
                            const isFiltered = !!(planColFilters[col.key]?.size);
                            const isOpen = planFilterOpen === col.key;
                            const uniqueVals = Array.from(new Set(allPlans.map(r => String((r as any)[col.key] ?? "")))).sort((a, b) => isNaN(+a) ? a.localeCompare(b) : +a - +b);
                            const fSearch = planFilterSearch[col.key] ?? "";
                            const visVals = fSearch ? uniqueVals.filter(v => v.toLowerCase().includes(fSearch.toLowerCase())) : uniqueVals;
                            const draft = planFilterDraft[col.key] ?? new Set<string>();
                            return (
                              <th key={col.key} className="p-0 border border-slate-700 text-center relative">
                                <div className="flex items-center justify-between px-2 py-2 gap-1 cursor-pointer hover:bg-slate-700 select-none"
                                  onClick={() => togglePlanSort(col.key)}>
                                  <span className="text-[10px]">{col.label}{planSort.key === col.key ? (planSort.dir === "asc" ? " ▲" : " ▼") : ""}</span>
                                  <button
                                    onClick={e => { e.stopPropagation(); isOpen ? setPlanFilterOpen(null) : openPlanFilter(col.key); }}
                                    className={`flex-shrink-0 p-0.5 rounded transition-colors ${isFiltered ? "text-yellow-300" : "text-slate-400 hover:text-white"}`}
                                    title="Filter">▼</button>
                                </div>
                                {isOpen && (
                                  <div className="absolute top-full left-0 z-50 bg-white border border-gray-300 rounded-xl shadow-2xl min-w-[200px] text-gray-800"
                                    onClick={e => e.stopPropagation()}>
                                    <div className="p-2 border-b border-gray-100">
                                      <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                                        <Search size={11} className="text-gray-400 flex-shrink-0" />
                                        <input autoFocus value={fSearch}
                                          onChange={e => setPlanFilterSearch(s => ({ ...s, [col.key]: e.target.value }))}
                                          placeholder="Search…"
                                          className="text-xs bg-transparent outline-none w-full text-gray-700" />
                                        {fSearch && <button onClick={() => setPlanFilterSearch(s => ({ ...s, [col.key]: "" }))} className="text-gray-400"><X size={10} /></button>}
                                      </div>
                                    </div>
                                    <div className="px-3 py-1.5 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                                      onClick={() => togglePlanFilterAll(col.key, visVals)}>
                                      <input type="checkbox" readOnly checked={draft.size === visVals.length && visVals.length > 0} className="accent-indigo-600 cursor-pointer" />
                                      <span className="text-xs font-semibold text-gray-600">Select All</span>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                      {visVals.map(v => (
                                        <div key={v} className="px-3 py-1.5 hover:bg-indigo-50 cursor-pointer flex items-center gap-2"
                                          onClick={() => togglePlanFilterVal(col.key, v)}>
                                          <input type="checkbox" readOnly checked={draft.has(v)} className="accent-indigo-600 cursor-pointer" />
                                          <span className="text-xs text-gray-700">{v || "(blank)"}</span>
                                        </div>
                                      ))}
                                      {visVals.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">No matches</div>}
                                    </div>
                                    <div className="flex gap-2 p-2 border-t border-gray-100">
                                      <button onClick={() => applyPlanFilter(col.key)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 rounded-lg">OK</button>
                                      <button onClick={() => clearPlanFilter(col.key)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-1.5 rounded-lg">Clear</button>
                                    </div>
                                  </div>
                                )}
                              </th>
                            );
                          })}
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
                              <td className="p-2 border border-gray-100 text-center" onClick={e => e.stopPropagation()}>
                                <button onClick={e => { e.stopPropagation(); setWoUpsPreview(plan); }}
                                  className="p-1 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition" title="View UPS Layout">
                                  <Eye size={13} />
                                </button>
                              </td>
                              <td className="p-2 border border-gray-100 font-medium text-gray-700">{plan.machineName}{p.isBest && <span className="ml-1.5 px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full">BEST</span>}{p.isSpecial && !p.isSpecialSleeve && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">SPECIAL CYL</span>}{p.isSpecialSleeve && <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full">SPECIAL SLV</span>}</td>
                              <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700">{plan.acUps}</td>
                              <td className="p-2 border border-gray-100 text-center font-mono">{p.printingWidth}</td>
                              <td className="p-2 border border-gray-100"><span className={`font-semibold ${p.isSpecialSleeve ? "text-rose-600" : "text-blue-600"}`}>{p.sleeveCode}</span><br /><span className={`text-[9px] ${p.isSpecialSleeve ? "text-rose-500" : "text-gray-400"}`}>{p.sleeveName}</span></td>
                              <td className={`p-2 border border-gray-100 text-center font-bold ${p.isSpecialSleeve ? "text-rose-600" : "text-blue-700"}`}>{p.sleeveWidthVal}</td>
                              <td className={`p-2 border border-gray-100 text-center font-bold ${p.sideWaste > 100 ? "text-red-600" : "text-amber-600"}`}>{p.sideWaste}</td>
                              <td className="p-2 border border-gray-100 text-center text-indigo-700">{plan.filmSize}</td>
                              <td className={`p-2 border border-gray-100 text-center font-bold ${p.deadMargin < 0 ? "text-red-600" : "text-orange-600"}`}>{p.deadMargin}</td>
                              <td className={`p-2 border border-gray-100 text-center font-bold ${p.isBest ? "text-green-700" : p.totalWaste > 300 ? "text-red-600" : "text-amber-600"}`}>{p.totalWaste}</td>
                              <td className="p-2 border border-gray-100 whitespace-nowrap"><span className={`font-semibold ${p.isSpecial ? "text-amber-600" : "text-violet-600"}`}>{p.cylinderCode}</span><br /><span className={`text-[9px] ${p.isSpecial ? "text-amber-500" : "text-gray-400"}`}>{p.cylinderName}</span></td>
                              <td className={`p-2 border border-gray-100 text-center font-bold ${p.isSpecial ? "text-amber-600" : "text-violet-700"}`}>{p.cylinderWidthVal}</td>
                              <td className="p-2 border border-gray-100 text-center font-bold">
                                {(() => {
                                  const extra = Math.round(p.cylinderWidthVal - p.sleeveWidthVal - 100);
                                  return extra > 0 ? <span className="text-orange-600">+{extra}</span> : <span className="text-gray-400">0</span>;
                                })()}
                              </td>
                              <td className="p-2 border border-gray-100 text-center font-mono text-gray-500">{p.cylRepeatLength}</td>
                              <td className="p-2 border border-gray-100 text-center font-mono text-indigo-600 font-semibold">{p.cylAreaSqInch}</td>
                              <td className="p-2 border border-gray-100 text-center text-gray-600">{p.repeatUPS}</td>
                              <td className="p-2 border border-gray-100 text-center font-bold">{plan.totalUPS}</td>
                              <td className="p-2 border border-gray-100 text-center text-gray-600">{p.reqRMT}</td>
                              <td className="p-2 border border-gray-100 text-center text-blue-600 font-semibold">{plan.totalRMT}</td>
                              <td className="p-2 border border-gray-100 text-center font-semibold text-blue-600">{p.totalWt}</td>
                              <td className="p-2 border border-gray-100 text-center text-gray-600">{p.totalTime} hr</td>
                            </tr>
                          );
                        })}
                        {visiblePlans.length === 0 && (
                          <tr><td colSpan={22} className="p-4 text-center text-gray-400 text-xs">No plans match your search</td></tr>
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
                            {["Ply", "Type", "Film / Material", "Group", "GSM", "Width (mm)", "Req. Mtr", "Req. SQM", "Req. Wt (Kg)", "Waste Mtr", "Waste SQM", "Waste Wt", "Total Mtr", "Total SQM", "Total Wt (Kg)"].map(h => (
                              <th key={h} className="p-2 border border-indigo-600/30 text-center whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(() => {
                            const rmt = selectedPlan.totalRMT;
                            const widthMm = form.jobWidth || 0;
                            const widthM = widthMm / 1000;
                            const wasteFrac = (form.wastagePct ?? 1) / 100;
                            const reqSQMBase = parseFloat((rmt * widthM).toFixed(3));
                            const wasteMtrBase = parseFloat((rmt * wasteFrac).toFixed(2));
                            const wasteSQMBase = parseFloat((wasteMtrBase * widthM).toFixed(3));
                            const totalMtrBase = parseFloat((rmt + wasteMtrBase).toFixed(2));
                            const totalSQMBase = parseFloat((reqSQMBase + wasteSQMBase).toFixed(3));

                            // Build flat matLines: film + consumables per ply (matching estimation logic, no cost)
                            type WOMatLine = { plyNo: number; plyType: string; name: string; group: string; gsm: number };
                            const matLines: WOMatLine[] = [];
                            form.secondaryLayers.forEach((l, idx) => {
                              if (l.gsm > 0 || l.itemSubGroup) {
                                matLines.push({ plyNo: idx + 1, plyType: l.plyType || "Film", name: l.itemSubGroup || "Film Substrate", group: "Film", gsm: l.gsm });
                              }
                              l.consumableItems.forEach(ci => {
                                const effGsm = (ci.coveragePct ?? 100) < 100
                                  ? parseFloat((ci.gsm * ((ci.coveragePct ?? 100) / 100)).toFixed(3))
                                  : ci.gsm;
                                const label = (ci.coveragePct ?? 100) < 100
                                  ? `${ci.itemName || ci.fieldDisplayName} (${ci.coveragePct}% cov.)`
                                  : (ci.itemName || ci.fieldDisplayName);
                                matLines.push({ plyNo: idx + 1, plyType: l.plyType || "", name: label, group: ci.itemGroup, gsm: effGsm });
                              });
                            });

                            const GROUP_CLS: Record<string, string> = {
                              Film: "bg-blue-50 text-blue-700 border-blue-200",
                              Ink: "bg-violet-50 text-violet-700 border-violet-200",
                              Adhesive: "bg-teal-50 text-teal-700 border-teal-200",
                              Solvent: "bg-orange-50 text-orange-700 border-orange-200",
                              Hardner: "bg-pink-50 text-pink-700 border-pink-200",
                            };
                            const PLY_CLS: Record<string, string> = {
                              Film: "bg-blue-50 text-blue-700 border-blue-200",
                              Printing: "bg-indigo-50 text-indigo-700 border-indigo-200",
                              Lamination: "bg-teal-50 text-teal-700 border-teal-200",
                              Coating: "bg-amber-50 text-amber-700 border-amber-200",
                            };

                            return matLines.map((m, i) => {
                              const reqWt = m.gsm > 0 ? parseFloat((m.gsm * reqSQMBase / 1000).toFixed(4)) : 0;
                              const wasteWt = m.gsm > 0 ? parseFloat((m.gsm * wasteSQMBase / 1000).toFixed(4)) : 0;
                              const totalWt = parseFloat((reqWt + wasteWt).toFixed(4));
                              return (
                                <tr key={i} className={`hover:bg-indigo-50/30 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                                  <td className="p-2 border border-gray-100 text-center font-black text-indigo-900 bg-indigo-50/20">P{m.plyNo}</td>
                                  <td className="p-2 border border-gray-100 text-center">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${PLY_CLS[m.plyType] || "bg-gray-100 text-gray-600 border-gray-200"}`}>{m.plyType || "—"}</span>
                                  </td>
                                  <td className="p-2 border border-gray-100 font-medium text-gray-700 min-w-[140px] whitespace-normal">{m.name}</td>
                                  <td className="p-2 border border-gray-100 text-center">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${GROUP_CLS[m.group] || "bg-gray-100 text-gray-600 border-gray-200"}`}>{m.group}</span>
                                  </td>
                                  <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700">{m.gsm > 0 ? `${m.gsm} g/m²` : "—"}</td>
                                  <td className="p-2 border border-gray-100 text-center font-mono">{widthMm}</td>
                                  <td className="p-2 border border-gray-100 text-center font-mono">{rmt.toLocaleString()}</td>
                                  <td className="p-2 border border-gray-100 text-center font-mono">{reqSQMBase.toLocaleString()}</td>
                                  <td className="p-2 border border-gray-100 text-center font-bold text-blue-600">{m.gsm > 0 ? reqWt : "—"}</td>
                                  <td className="p-2 border border-gray-100 text-center font-mono text-orange-500">{wasteMtrBase.toLocaleString()}</td>
                                  <td className="p-2 border border-gray-100 text-center font-mono text-orange-500">{wasteSQMBase.toLocaleString()}</td>
                                  <td className="p-2 border border-gray-100 text-center font-mono text-orange-500">{m.gsm > 0 ? wasteWt : "—"}</td>
                                  <td className="p-2 border border-gray-100 text-center font-mono text-gray-700">{totalMtrBase.toLocaleString()}</td>
                                  <td className="p-2 border border-gray-100 text-center font-mono text-gray-700">{totalSQMBase.toLocaleString()}</td>
                                  <td className="p-2 border border-gray-100 text-center font-black text-gray-900 bg-gray-50">{m.gsm > 0 ? totalWt : "—"}</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2 border-indigo-200">
                          <tr className="font-bold">
                            <td colSpan={14} className="p-3 text-right text-indigo-900 uppercase text-[10px]">Total Weight (Kg)</td>
                            <td className="p-3 text-center bg-indigo-100 text-indigo-900 text-xs">
                              {(() => {
                                const rmt = selectedPlan.totalRMT;
                                const widthM = (form.jobWidth || 0) / 1000;
                                const wasteFrac = (form.wastagePct ?? 1) / 100;
                                const reqSQM = rmt * widthM;
                                const wasteSQM = rmt * wasteFrac * widthM;
                                const totalSQM = reqSQM + wasteSQM;
                                return form.secondaryLayers.reduce((sum, l) => {
                                  const filmWt = l.gsm > 0 ? l.gsm * totalSQM / 1000 : 0;
                                  const ciWt = l.consumableItems.reduce((cs, ci) => {
                                    const effGsm = (ci.coveragePct ?? 100) < 100 ? ci.gsm * ((ci.coveragePct ?? 100) / 100) : ci.gsm;
                                    return cs + (effGsm > 0 ? effGsm * totalSQM / 1000 : 0);
                                  }, 0);
                                  return sum + filmWt + ciWt;
                                }, 0).toFixed(3);
                              })()}
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
              { key: "film", label: "Film Requisition" },
              { key: "shade", label: "Color Shade & LAB" },
              { key: "material", label: "Material Allocation" },
              { key: "tool", label: "Tool / Cylinder" },
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
                    const reqSQM = form.quantity * ((form.jobWidth || 0) / 1000);
                    const reqWt = l.gsm > 0 ? parseFloat(((l.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
                    const setReq = (patch: Partial<FilmRequisition>) =>
                      setFilmReqs(prev => {
                        const next = [...prev];
                        next[idx] = { ...(next[idx] ?? { source: "", status: "Pending" }), ...patch };
                        return next;
                      });
                    const plyColor =
                      l.plyType === "Film" ? { hdr: "bg-blue-50 border-blue-100", badge: "bg-blue-100 text-blue-700 border-blue-200" } :
                        l.plyType === "Printing" ? { hdr: "bg-indigo-50 border-indigo-100", badge: "bg-indigo-100 text-indigo-700 border-indigo-200" } :
                          l.plyType === "Lamination" ? { hdr: "bg-orange-50 border-orange-100", badge: "bg-orange-100 text-orange-700 border-orange-200" } :
                            { hdr: "bg-green-50 border-green-100", badge: "bg-green-100 text-green-700 border-green-200" };
                    return (
                      <div key={l.id ?? l.layerNo ?? idx} className="bg-white border-2 border-gray-100 rounded-2xl shadow-sm overflow-hidden">
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
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${req.status === "Available" ? "bg-green-50 text-green-700 border-green-200" :
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
                                className={`py-3 px-4 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${req.source === "Extrusion" ? "bg-teal-600 text-white border-teal-600 shadow-md" : "bg-white text-teal-700 border-teal-200 hover:border-teal-400"
                                  }`}>
                                <Factory size={14} /> Extrusion Unit
                                <span className={`text-[10px] ${req.source === "Extrusion" ? "text-teal-100" : "text-gray-400"}`}>(Internal)</span>
                              </button>
                              <button onClick={() => setReq({ source: "Purchase", status: "Pending" })}
                                className={`py-3 px-4 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${req.source === "Purchase" ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-blue-700 border-blue-200 hover:border-blue-400"
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
                                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border transition-all whitespace-nowrap ${req.status === "Requested"
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
                      {["#", "Ink Item (Master)", "Color Name", "Type", "Pantone Ref"].map(h => (
                        <th key={h} rowSpan={2} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold align-middle">{h}</th>
                      ))}
                      <th colSpan={3} className="px-2 py-1.5 border border-purple-600/30 text-center text-xs font-semibold bg-blue-900/30 text-blue-200">Standard LAB (Reference)</th>
                      <th colSpan={3} className="px-2 py-1.5 border border-purple-600/30 text-center text-xs font-semibold bg-green-900/30 text-green-200">Measured LAB (Actual)</th>
                      <th rowSpan={2} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold align-middle">
                        ΔE<div className="text-[9px] font-normal opacity-70 text-green-200">CIE 1976</div>
                      </th>
                      <th rowSpan={2} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold align-middle">
                        ΔE Tol.<div className="text-[9px] font-normal opacity-70">max allowed</div>
                      </th>
                      <th rowSpan={2} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold align-middle">
                        QC Result<div className="text-[9px] font-normal opacity-70">PASS/FAIL</div>
                      </th>
                      <th rowSpan={2} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold align-middle min-w-[140px]">
                        Insight<div className="text-[9px] font-normal opacity-70">color correction</div>
                      </th>
                      {["Shade Card Ref", "Status", "Remarks"].map(h => (
                        <th key={h} rowSpan={2} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold align-middle">{h}</th>
                      ))}
                    </tr>
                    <tr>
                      {[
                        { label: "L*", sub: "0–100", cls: "text-blue-300", bg: "bg-blue-900/20" },
                        { label: "a*", sub: "-128–127", cls: "text-red-300", bg: "bg-blue-900/20" },
                        { label: "b*", sub: "-128–127", cls: "text-yellow-300", bg: "bg-blue-900/20" },
                        { label: "L*", sub: "0–100", cls: "text-blue-300", bg: "bg-green-900/20" },
                        { label: "a*", sub: "-128–127", cls: "text-red-300", bg: "bg-green-900/20" },
                        { label: "b*", sub: "-128–127", cls: "text-yellow-300", bg: "bg-green-900/20" },
                      ].map((h, i) => (
                        <th key={i} className={`px-2 py-1.5 border border-purple-600/30 text-center whitespace-nowrap font-semibold ${h.bg}`}>
                          <span>{h.label}</span>
                          <div className={`text-[9px] font-normal opacity-80 ${h.cls}`}>{h.sub}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {colorShades.map((cs, i) => {
                      const dlabs = calculateDeltaLAB(cs.labL, cs.labA, cs.labB, cs.labLMeas, cs.labAMeas, cs.labBMeas);
                      const qcSt = getStatus(cs.deltaE, cs.deltaETol);
                      const sev = getSeverity(cs.deltaE);
                      const insight = getColorInsight(cs.labL, cs.labA, cs.labB, cs.labLMeas, cs.labAMeas, cs.labBMeas);
                      const fmtD = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
                      return (
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
                                setColorShades(p => p.map((c, ci) => {
                                  if (ci !== i) return c;
                                  const de = calcDeltaE(String(v), c.labA, c.labB, c.labLMeas, c.labAMeas, c.labBMeas);
                                  return { ...c, labL: String(v), deltaE: de };
                                }));
                              }} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" step={1} min={-128} max={127} placeholder="-128–127"
                              className="w-[72px] text-xs border border-red-200 bg-red-50 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-red-400 text-red-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              value={cs.labA}
                              onChange={e => {
                                const v = e.target.value;
                                setColorShades(p => p.map((c, ci) => {
                                  if (ci !== i) return c;
                                  const de = calcDeltaE(c.labL, v, c.labB, c.labLMeas, c.labAMeas, c.labBMeas);
                                  return { ...c, labA: v, deltaE: de };
                                }));
                              }} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" step={1} min={-128} max={127} placeholder="-128–127"
                              className="w-[72px] text-xs border border-yellow-300 bg-yellow-50 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-yellow-400 text-yellow-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              value={cs.labB}
                              onChange={e => {
                                const v = e.target.value;
                                setColorShades(p => p.map((c, ci) => {
                                  if (ci !== i) return c;
                                  const de = calcDeltaE(c.labL, c.labA, v, c.labLMeas, c.labAMeas, c.labBMeas);
                                  return { ...c, labB: v, deltaE: de };
                                }));
                              }} />
                          </td>
                          {/* Measured LAB */}
                          <td className="px-2 py-1.5 bg-green-50/30">
                            <input type="number" step={1} min={0} max={100} placeholder="0–100"
                              className="w-[68px] text-xs border border-green-300 bg-green-50 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-green-400 text-green-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              value={cs.labLMeas}
                              onChange={e => {
                                const v = String(Math.min(100, Math.max(0, Number(e.target.value))));
                                setColorShades(p => p.map((c, ci) => {
                                  if (ci !== i) return c;
                                  const de = calcDeltaE(c.labL, c.labA, c.labB, v, c.labAMeas, c.labBMeas);
                                  return { ...c, labLMeas: v, deltaE: de };
                                }));
                              }} />
                          </td>
                          <td className="px-2 py-1.5 bg-green-50/30">
                            <input type="number" step={1} min={-128} max={127} placeholder="-128–127"
                              className="w-[68px] text-xs border border-green-300 bg-green-50 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-green-400 text-green-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              value={cs.labAMeas}
                              onChange={e => {
                                const v = e.target.value;
                                setColorShades(p => p.map((c, ci) => {
                                  if (ci !== i) return c;
                                  const de = calcDeltaE(c.labL, c.labA, c.labB, c.labLMeas, v, c.labBMeas);
                                  return { ...c, labAMeas: v, deltaE: de };
                                }));
                              }} />
                          </td>
                          <td className="px-2 py-1.5 bg-green-50/30">
                            <input type="number" step={1} min={-128} max={127} placeholder="-128–127"
                              className="w-[68px] text-xs border border-green-300 bg-green-50 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-green-400 text-green-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              value={cs.labBMeas}
                              onChange={e => {
                                const v = e.target.value;
                                setColorShades(p => p.map((c, ci) => {
                                  if (ci !== i) return c;
                                  const de = calcDeltaE(c.labL, c.labA, c.labB, c.labLMeas, c.labAMeas, v);
                                  return { ...c, labBMeas: v, deltaE: de };
                                }));
                              }} />
                          </td>
                          {/* ΔE auto-computed */}
                          <td className="px-2 py-1.5 text-center">
                            {cs.deltaE !== "--" ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold font-mono border ${qcSt === "PASS" ? "bg-green-50 text-green-700 border-green-300"
                                  : qcSt === "WARNING" ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                                    : "bg-red-50 text-red-600 border-red-300"
                                  }`}>{cs.deltaE}</span>
                                {sev && (
                                  <span className={`text-[9px] font-semibold px-1.5 rounded-full ${sev === "Low" ? "bg-green-100 text-green-700" : sev === "Medium" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                                    }`}>{sev}</span>
                                )}
                                {dlabs && (
                                  <div className="text-[9px] font-mono text-gray-400 leading-tight mt-0.5">
                                    <span>ΔL{fmtD(dlabs.dL)}</span>
                                    <span className="mx-0.5">Δa{fmtD(dlabs.da)}</span>
                                    <span>Δb{fmtD(dlabs.db)}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300 font-mono">--</span>
                            )}
                          </td>
                          {/* ΔE Tolerance (manual) */}
                          <td className="px-2 py-1.5">
                            <input type="number" step={0.1} min={0} max={10} placeholder="1.0"
                              className="w-[56px] text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-purple-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              value={cs.deltaETol}
                              onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, deltaETol: e.target.value } : c))} />
                          </td>
                          {/* QC Result */}
                          <td className="px-2 py-1.5 text-center">
                            {qcSt === "NOT MEASURED" ? (
                              <span className="text-[10px] text-gray-400 font-medium italic">Not Measured</span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${qcSt === "PASS" ? "bg-green-100 text-green-800 border-green-400"
                                : qcSt === "WARNING" ? "bg-yellow-100 text-yellow-800 border-yellow-400"
                                  : "bg-red-100 text-red-700 border-red-400"
                                }`}>
                                {qcSt === "PASS" ? "✓" : qcSt === "WARNING" ? "⚠" : "✗"} {qcSt}
                              </span>
                            )}
                          </td>
                          {/* Production Insight — priority-based */}
                          <td className="px-2 py-1.5 min-w-[160px]">
                            {!insight.primary ? (
                              <span className="text-[10px] text-gray-300">
                                {cs.deltaE === "--" ? "Enter measured LAB" : "Within tolerance ✓"}
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {/* Primary issue — bold, prominent */}
                                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${insight.primary.cls}`}>
                                  <span className="opacity-70">{insight.primary.axis} = {fmtD(insight.primary.val)}</span>
                                  <span className="mx-1">→</span>
                                  <span>{insight.primary.suggestion}</span>
                                  <div className="font-normal opacity-80 mt-0.5">↳ {insight.primary.inkAdj}</div>
                                </div>
                                {/* Secondary issues — smaller */}
                                {insight.secondary.map((s, si) => (
                                  <span key={si} className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${s.cls}`}>
                                    {s.axis} = {fmtD(s.val)} → {s.suggestion}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5"><input placeholder="SC-001" className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.shadeCardRef} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, shadeCardRef: e.target.value } : c))} /></td>
                          <td className="px-2 py-1.5">
                            <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-purple-400" value={cs.status} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, status: e.target.value as ColorShade["status"] } : c))}>
                              <option value="Pending">Pending</option><option value="Standard Received">Std. Received</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="px-2 py-1.5"><input placeholder="Notes…" className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.remarks} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} /></td>
                        </tr>
                      );
                    })}
                    {colorShades.length === 0 && (
                      <tr><td colSpan={18} className="p-6 text-center text-gray-400 text-xs">No colors. Set No. of Colors in Basic Info tab first.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {colorShades.length > 0 && (
                <div className="flex gap-2 flex-wrap items-center">
                  {/* Approval status */}
                  {(["Pending", "Standard Received", "Approved", "Rejected"] as const).map(s => {
                    const cnt = colorShades.filter(c => c.status === s).length;
                    return cnt > 0 ? (
                      <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${s === "Approved" ? "bg-green-50 text-green-700 border-green-200" : s === "Standard Received" ? "bg-blue-50 text-blue-700 border-blue-200" : s === "Rejected" ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{cnt} {s}</span>
                    ) : null;
                  })}
                  <span className="text-gray-300 text-xs">|</span>
                  {/* QC counts */}
                  {(["PASS", "WARNING", "FAIL"] as const).map(q => {
                    const cnt = colorShades.filter(c => getStatus(c.deltaE, c.deltaETol) === q).length;
                    return cnt > 0 ? (
                      <span key={q} className={`px-2.5 py-1 rounded-full text-xs font-bold border ${q === "PASS" ? "bg-green-100 text-green-800 border-green-400" : q === "WARNING" ? "bg-yellow-100 text-yellow-800 border-yellow-400" : "bg-red-100 text-red-700 border-red-400"}`}>
                        {q === "PASS" ? "✓" : q === "WARNING" ? "⚠" : "✗"} {cnt} {q}
                      </span>
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
                      );
                    })}
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
                        <td className="px-2 py-1.5 min-w-[220px]">
                          <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400"
                            value={(ca as any).toolId ?? ""}
                            onChange={e => {
                              const tool = [...CYLINDER_TOOLS_ALL, ...extraCyls].find(t => t.id === e.target.value);
                              setCylinderAllocs(p => p.map((c, ci) => ci === i ? {
                                ...c,
                                toolId: tool?.id ?? "",
                                cylinderNo: tool?.code ?? c.cylinderNo,
                                circumference: selectedPlan ? String(selectedPlan.cylCirc) : c.circumference,
                              } as any : c));
                            }}>
                            <option value="">{ca.cylinderNo || "-- Select Cylinder --"}</option>
                            {[...CYLINDER_TOOLS_ALL, ...extraCyls].map(t => {
                              const rem = t.shelfLifeMeters ? t.shelfLifeMeters - (t.usedMeters ?? 0) : null;
                              const lifeBadge = rem !== null ? ` [${rem.toLocaleString()}m left]` : "";
                              return <option key={t.id} value={t.id}>{t.code} — {t.name} ({t.printWidth}mm){lifeBadge}</option>;
                            })}
                          </select>
                          {/* ── Cylinder Life Info + Check ── */}
                          {(() => {
                            const toolId = (ca as any).toolId;
                            if (!toolId) return null;
                            const tool = [...CYLINDER_TOOLS_ALL, ...extraCyls].find(t => t.id === toolId);
                            if (!tool) return null;
                            const remaining = tool.shelfLifeMeters ? tool.shelfLifeMeters - (tool.usedMeters ?? 0) : null;
                            const reqRMT = selectedPlan?.reqRMT ?? 0;
                            const lifeOk = remaining === null || reqRMT === 0 || remaining >= reqRMT;
                            const isExhausted = remaining !== null && remaining <= 0;
                            const pct = tool.shelfLifeMeters && remaining !== null ? Math.round((remaining / tool.shelfLifeMeters) * 100) : null;
                            // Life bar color
                            const barColor = isExhausted ? "bg-red-500" : pct !== null && pct < 20 ? "bg-orange-400" : "bg-green-400";
                            return (
                              <div className="mt-1.5 space-y-1">
                                {/* Always-visible shelf life strip */}
                                {tool.shelfLifeMeters && remaining !== null && (
                                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[10px]">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-semibold text-gray-600">Shelf Life</span>
                                      <span className={`font-bold ${isExhausted ? "text-red-600" : pct !== null && pct < 20 ? "text-orange-600" : "text-green-700"}`}>
                                        {remaining.toLocaleString()} m left
                                        {pct !== null && <span className="font-normal text-gray-400 ml-1">({pct}%)</span>}
                                      </span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                      <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.max(0, pct ?? 100)}%` }} />
                                    </div>
                                    <div className="flex justify-between mt-0.5 text-[9px] text-gray-400">
                                      <span>Used: {(tool.usedMeters ?? 0).toLocaleString()} m</span>
                                      <span>Total: {tool.shelfLifeMeters.toLocaleString()} m</span>
                                    </div>
                                    {reqRMT > 0 && (
                                      <div className="mt-0.5 text-[9px] text-gray-500">
                                        This job: <strong className="text-blue-600">{reqRMT.toLocaleString()} m</strong>
                                        {!lifeOk && <span className="ml-1 text-red-500 font-bold">— insufficient!</span>}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Actions only when life is insufficient */}
                                {!lifeOk && (
                                  <div className={`rounded-lg border px-2.5 py-1.5 text-[10px] space-y-1 ${isExhausted ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                                    <p className={`font-bold ${isExhausted ? "text-red-700" : "text-amber-700"}`}>
                                      {isExhausted ? "⛔ Life Exhausted" : "⚠ Low Cylinder Life"}
                                    </p>
                                    <div className="flex gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => setCylinderAllocs(p => p.map((c, ci) => ci === i ? {
                                          ...c,
                                          cylinderType: "Rechromed" as const,
                                          status: "Under Chrome" as const,
                                          remarks: `Sent for rework — ${remaining?.toLocaleString()} m remaining (${pct}% life)`,
                                        } : c))}
                                        className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-[10px] transition">
                                        Send for Rework
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNewCylForm({
                                            code: `${tool.code}-R`,
                                            name: `${tool.name} (New)`,
                                            printWidth: tool.printWidth,
                                            repeatLength: tool.repeatLength,
                                            shelfLifeMeters: "25000",
                                            cylinderMaterial: tool.cylinderMaterial || "Steel",
                                            surfaceFinish: tool.surfaceFinish || "Hard Chrome",
                                          });
                                          setNewCylModal({ rowIdx: i, fromTool: tool });
                                        }}
                                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] transition">
                                        + New Cylinder
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
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
          { label: "Pending Orders", val: stats.pending, cls: "bg-orange-50 text-orange-700 border-orange-200" },
          { label: "Open WOs", val: stats.open, cls: "bg-gray-50 text-gray-600 border-gray-200" },
          { label: "In Progress", val: stats.inProgress, cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { label: "Completed", val: stats.completed, cls: "bg-green-50 text-green-700 border-green-200" },
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
                        : order.sourceType === "Catalog" ? <BookMarked size={18} className="text-purple-600" />
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
                      {order.perMeterRate > 0 && <p className="text-xs text-green-600">₹{order.perMeterRate.toFixed(2)}/Kg</p>}
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
                <Button variant="ghost" size="sm" icon={<Printer size={13} />} onClick={() => setPrintWO(row)}>Job Card</Button>
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
            <SH label="Machine" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Select label="Printing Machine" value={form.machineId}
                onChange={e => {
                  const dbM = dbMachines.find(x => x.id === e.target.value);
                  const name = dbM?.name || e.target.value;
                  f("machineId", e.target.value); f("machineName", name);
                }}
                options={[
                  { value: "", label: "-- Select Machine --" },
                  ...(form.machineId && !dbMachines.find(m => m.id === form.machineId)
                    ? [{ value: form.machineId, label: form.machineName || form.machineId }]
                    : []),
                  ...dbMachines.map(m => ({ value: m.id, label: m.name }))
                ]}
              />
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
              {viewRow.sourceOrderType !== "Direct" ? <Calculator size={12} /> : <Edit3 size={12} />}
              {viewRow.sourceOrderType !== "Direct" ? `From Order: ${viewRow.orderNo}` : "Direct Work Order"}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {([
                ["Customer", viewRow.customerName],
                ["Job Name", viewRow.jobName],
                ["Substrate", viewRow.substrate || "—"],
                ["Category", viewRow.categoryName || "—"],
                ["Size", `${viewRow.jobWidth}×${viewRow.jobHeight} mm`],
                ["Colors", `${viewRow.noOfColors}C`],
                ["Print Type", viewRow.printType],
                ["Machine", viewRow.machineName || "—"],
                ["Operator", viewRow.operatorName || "—"],
                ["Cylinder", viewRow.cylinderSet || "—"],
                ["Quantity", `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
                ["Planned", viewRow.plannedDate || "—"],
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

      {/* ══ JOB CARD PRINT MODAL ═══════════════════════════════════ */}
      {printWO && (() => {
        const wo = printWO;
        // Gather all inks from all plies
        const allInks = wo.secondaryLayers.flatMap(l =>
          l.consumableItems.filter(ci => ci.itemGroup === "Ink").map((ci, idx) => ({ ...ci, plyType: l.plyType, plyNo: l.layerNo }))
        );
        const allSolvents = wo.secondaryLayers.flatMap(l =>
          l.consumableItems.filter(ci => ci.itemGroup === "Solvent").map(ci => ({ ...ci, plyType: l.plyType, plyNo: l.layerNo }))
        );
        const allAdhesives = wo.secondaryLayers.flatMap(l =>
          l.consumableItems.filter(ci => ci.itemGroup === "Adhesive" || ci.itemGroup === "Hardner").map(ci => ({ ...ci, plyType: l.plyType, plyNo: l.layerNo }))
        );
        const filmLayers = wo.secondaryLayers.filter(l => l.itemSubGroup);
        const reqMtr = wo.quantity || 0;
        const reqSQM = reqMtr * ((wo.width || wo.jobWidth || 0) / 1000);
        const waste = (wo.wastagePct ?? 3) / 100;

        const handlePrint = () => {
          const el = document.getElementById("wo-job-card-print");
          if (!el) return;
          const orig = document.body.innerHTML;
          document.body.innerHTML = el.innerHTML;
          window.print();
          document.body.innerHTML = orig;
          window.location.reload();
        };

        return (
          <>
            <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={() => setPrintWO(null)} />
            <div className="fixed z-[71] inset-4 sm:inset-8 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 bg-gray-900 text-white flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Printer size={18} className="text-orange-400" />
                  <span className="font-bold text-sm">Job Card Preview — {wo.workOrderNo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition">
                    <Printer size={14} /> Print Job Card
                  </button>
                  <button onClick={() => setPrintWO(null)}
                    className="p-2 hover:bg-white/10 rounded-lg transition"><X size={16} /></button>
                </div>
              </div>

              {/* Scrollable preview */}
              <div className="flex-1 overflow-auto bg-gray-100 p-4 sm:p-8">
                <div id="wo-job-card-print" className="bg-white mx-auto shadow-lg" style={{ width: "210mm", minHeight: "297mm", padding: "12mm", fontFamily: "Arial, sans-serif", fontSize: "9pt", color: "#111" }}>

                  {/* ── PAGE HEADER ── */}
                  <div style={{ borderBottom: "3px solid #1e3a8a", paddingBottom: "6px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "16pt", fontWeight: "900", color: "#1e3a8a", letterSpacing: "1px" }}>AJ SHRINK INDUSTRIES</div>
                        <div style={{ fontSize: "7.5pt", color: "#555", marginTop: "2px" }}>Gravure Printing &amp; Flexible Packaging</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "13pt", fontWeight: "800", color: "#b45309", letterSpacing: "2px" }}>PRODUCTION JOB CARD</div>
                        <div style={{ fontSize: "7.5pt", color: "#555", marginTop: "2px" }}>Gravure Module</div>
                      </div>
                    </div>
                  </div>

                  {/* ── WO IDENTITY STRIP ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0", border: "2px solid #1e3a8a", marginBottom: "8px" }}>
                    {[
                      ["WO Number", wo.workOrderNo],
                      ["WO Date", wo.date],
                      ["Status", wo.status],
                      ["Order Ref", wo.orderNo || "Direct"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ padding: "5px 8px", borderRight: "1px solid #cdd6f4" }}>
                        <div style={{ fontSize: "6.5pt", color: "#6b7280", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>{k}</div>
                        <div style={{ fontSize: "9pt", fontWeight: "800", color: "#1e3a8a" }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── CUSTOMER & JOB ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "8px" }}>
                    <div style={{ border: "1px solid #d1d5db", borderRadius: "4px", padding: "6px 8px", background: "#f8fafc" }}>
                      <div style={{ fontSize: "6.5pt", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>Customer</div>
                      <div style={{ fontSize: "11pt", fontWeight: "800", color: "#111" }}>{wo.customerName}</div>
                    </div>
                    <div style={{ border: "1px solid #d1d5db", borderRadius: "4px", padding: "6px 8px", background: "#f8fafc" }}>
                      <div style={{ fontSize: "6.5pt", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>Job Name / Product</div>
                      <div style={{ fontSize: "11pt", fontWeight: "800", color: "#111" }}>{wo.jobName}</div>
                    </div>
                  </div>

                  {/* ── PRODUCT SPECIFICATION ── */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ background: "#1e3a8a", color: "white", padding: "3px 8px", fontSize: "7.5pt", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "0" }}>Product Specification</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d1d5db" }}>
                      <tbody>
                        <tr>
                          {[
                            ["Job Size (mm)", `${wo.jobWidth} × ${wo.jobHeight}`],
                            ["Actual Size (mm)", `${wo.actualWidth} × ${wo.actualHeight}`],
                            ["Film Width (mm)", `${wo.width || wo.jobWidth}`],
                            ["No. of Colors", `${wo.noOfColors}C`],
                          ].map(([k, v]) => (
                            <td key={k} style={{ padding: "4px 7px", border: "1px solid #e5e7eb", width: "25%" }}>
                              <div style={{ fontSize: "6.5pt", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>{k}</div>
                              <div style={{ fontWeight: "700" }}>{v}</div>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          {[
                            ["Print Type", wo.printType],
                            ["Content / Structure", wo.content || wo.categoryName || "—"],
                            ["Substrate", wo.substrate || "—"],
                            ["Category", wo.categoryName || "—"],
                          ].map(([k, v]) => (
                            <td key={k} style={{ padding: "4px 7px", border: "1px solid #e5e7eb", width: "25%" }}>
                              <div style={{ fontSize: "6.5pt", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>{k}</div>
                              <div style={{ fontWeight: "700" }}>{v}</div>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          {[
                            ["Machine", wo.machineName || "—"],
                            ["Operator", wo.operatorName || "—"],
                            ["Cylinder Set", wo.cylinderSet || "—"],
                            ["UPS", wo.ups || 1],
                          ].map(([k, v]) => (
                            <td key={k} style={{ padding: "4px 7px", border: "1px solid #e5e7eb", width: "25%" }}>
                              <div style={{ fontSize: "6.5pt", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>{k}</div>
                              <div style={{ fontWeight: "700" }}>{v}</div>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          {[
                            ["Quantity", `${wo.quantity.toLocaleString("en-IN")} ${wo.unit}`],
                            ["Planned Date", wo.plannedDate || "—"],
                            ["Wastage %", `${wo.wastagePct ?? 3}%`],
                            ["Req. SQM (approx.)", `${reqSQM.toFixed(1)} m²`],
                          ].map(([k, v]) => (
                            <td key={k} style={{ padding: "4px 7px", border: "1px solid #e5e7eb", width: "25%" }}>
                              <div style={{ fontSize: "6.5pt", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>{k}</div>
                              <div style={{ fontWeight: "700" }}>{v}</div>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* ── FILM / PLY STRUCTURE ── */}
                  {filmLayers.length > 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ background: "#1e3a8a", color: "white", padding: "3px 8px", fontSize: "7.5pt", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Film / Ply Structure</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d1d5db" }}>
                        <thead>
                          <tr style={{ background: "#eff6ff" }}>
                            {["Ply #", "Type", "Film / Material", "Thickness (μ)", "GSM", "Req. Wt. (Kg)"].map(h => (
                              <th key={h} style={{ padding: "3px 6px", border: "1px solid #d1d5db", fontSize: "6.5pt", fontWeight: "700", textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filmLayers.map((l, li) => {
                            const reqWt = l.gsm > 0 ? ((l.gsm / 1000) * reqSQM * (1 + waste)) : 0;
                            return (
                              <tr key={l.id ?? l.layerNo ?? li}>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", fontWeight: "700", textAlign: "center" }}>{l.layerNo}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb" }}>{l.plyType}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", fontWeight: "700" }}>{l.itemSubGroup}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", textAlign: "center" }}>{l.thickness || "—"}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", textAlign: "center" }}>{l.gsm || "—"}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", textAlign: "center", fontWeight: "700" }}>{reqWt > 0 ? reqWt.toFixed(2) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── INK / COLOR TABLE ── */}
                  {allInks.length > 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ background: "#1e40af", color: "white", padding: "3px 8px", fontSize: "7.5pt", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Ink Details (Color-wise)</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d1d5db" }}>
                        <thead>
                          <tr style={{ background: "#eff6ff" }}>
                            {["#", "Ply", "Ink Item", "Sub Group", "Dry GSM", "% Solid", "Liquid GSM", "Coverage %", "Req. Wt. (Kg)"].map(h => (
                              <th key={h} style={{ padding: "3px 5px", border: "1px solid #d1d5db", fontSize: "6.5pt", fontWeight: "700", textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {allInks.map((ci, i) => {
                            const solid = ci.solidPct ?? 40;
                            const dryGSM = ci.gsm || 0;
                            const liqGSM = solid > 0 ? parseFloat((dryGSM / (solid / 100)).toFixed(2)) : 0;
                            const effGSM = dryGSM * ((ci.coveragePct ?? 100) / 100);
                            const reqWt = effGSM > 0 ? ((effGSM / 1000) * reqSQM * (1 + waste)) : 0;
                            return (
                              <tr key={ci.consumableId} style={{ background: i % 2 === 0 ? "#fff" : "#f8faff" }}>
                                <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", fontWeight: "700", textAlign: "center" }}>{i + 1}</td>
                                <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", fontSize: "7.5pt" }}>{ci.plyType}</td>
                                <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", fontWeight: "700" }}>{ci.itemName || ci.fieldDisplayName || "—"}</td>
                                <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", fontSize: "7.5pt" }}>{ci.itemSubGroup || "—"}</td>
                                <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "center" }}>{dryGSM || "—"}</td>
                                <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "center" }}>{solid}%</td>
                                <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "center", fontWeight: "700", color: "#6d28d9" }}>{liqGSM || "—"}</td>
                                <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "center" }}>{ci.coveragePct ?? 100}%</td>
                                <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "center", fontWeight: "700" }}>{reqWt > 0 ? reqWt.toFixed(3) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── SOLVENT TABLE ── */}
                  {allSolvents.length > 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ background: "#5b21b6", color: "white", padding: "3px 8px", fontSize: "7.5pt", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Solvent Details</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d1d5db" }}>
                        <thead>
                          <tr style={{ background: "#f5f3ff" }}>
                            {["#", "Ply", "Solvent Item", "Sub Group", "Ratio (%)", "Req. Wt. (Kg)"].map(h => (
                              <th key={h} style={{ padding: "3px 6px", border: "1px solid #d1d5db", fontSize: "6.5pt", fontWeight: "700", textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {allSolvents.map((ci, i) => {
                            const reqWt = ci.gsm > 0 ? ((ci.gsm / 1000) * reqSQM * (1 + waste)) : 0;
                            return (
                              <tr key={ci.consumableId}>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", textAlign: "center" }}>{i + 1}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb" }}>{ci.plyType}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", fontWeight: "700" }}>{ci.itemName || "—"}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb" }}>{ci.itemSubGroup || "—"}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", textAlign: "center" }}>{ci.gsm || "—"}%</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", textAlign: "center", fontWeight: "700" }}>{reqWt > 0 ? reqWt.toFixed(3) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── ADHESIVE / HARDNER TABLE ── */}
                  {allAdhesives.length > 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ background: "#7c3aed", color: "white", padding: "3px 8px", fontSize: "7.5pt", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Adhesive / Hardener Details</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d1d5db" }}>
                        <thead>
                          <tr style={{ background: "#faf5ff" }}>
                            {["#", "Ply", "Group", "Item", "Sub Group", "GSM / NCO%", "Req. Wt. (Kg)"].map(h => (
                              <th key={h} style={{ padding: "3px 6px", border: "1px solid #d1d5db", fontSize: "6.5pt", fontWeight: "700", textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {allAdhesives.map((ci, i) => {
                            const reqWt = ci.gsm > 0 ? ((ci.gsm / 1000) * reqSQM * (1 + waste)) : 0;
                            return (
                              <tr key={ci.consumableId}>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", textAlign: "center" }}>{i + 1}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb" }}>{ci.plyType}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", fontWeight: "700" }}>{ci.itemGroup}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", fontWeight: "700" }}>{ci.itemName || "—"}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb" }}>{ci.itemSubGroup || "—"}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", textAlign: "center" }}>{ci.itemGroup === "Hardner" ? `NCO: ${ci.ncoPct ?? "—"}%` : `${ci.gsm || "—"} GSM / OH: ${ci.ohPct ?? "—"}%`}</td>
                                <td style={{ padding: "3px 6px", border: "1px solid #e5e7eb", textAlign: "center", fontWeight: "700" }}>{reqWt > 0 ? reqWt.toFixed(3) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── PROCESSES ── */}
                  {wo.processes.length > 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ background: "#065f46", color: "white", padding: "3px 8px", fontSize: "7.5pt", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Production Processes (In Order)</div>
                      <div style={{ border: "1px solid #d1d5db", padding: "6px 8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {wo.processes.map((p, i) => (
                          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", border: "1px solid #6ee7b7", background: "#ecfdf5", borderRadius: "20px", fontSize: "7.5pt", fontWeight: "700", color: "#065f46" }}>
                            <span style={{ background: "#065f46", color: "white", borderRadius: "50%", width: "14px", height: "14px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "6.5pt", fontWeight: "900" }}>{i + 1}</span>
                            {p.processName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── SPECIAL INSTRUCTIONS ── */}
                  {wo.specialInstructions && (
                    <div style={{ marginBottom: "8px", border: "2px solid #f59e0b", borderRadius: "4px", padding: "6px 10px", background: "#fffbeb" }}>
                      <div style={{ fontSize: "7pt", fontWeight: "800", color: "#b45309", textTransform: "uppercase", marginBottom: "3px" }}>⚠ Special Instructions</div>
                      <div style={{ fontSize: "8.5pt", color: "#78350f" }}>{wo.specialInstructions}</div>
                    </div>
                  )}

                  {/* ── SIGN-OFF ── */}
                  <div style={{ marginTop: "12px", borderTop: "2px solid #1e3a8a", paddingTop: "8px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        <tr>
                          {["Prepared By", "Approved By", "Machine Operator", "Quality Check"].map(role => (
                            <td key={role} style={{ width: "25%", padding: "4px 8px", border: "1px solid #d1d5db", textAlign: "center" }}>
                              <div style={{ height: "30px" }} />
                              <div style={{ borderTop: "1px solid #333", paddingTop: "3px", fontSize: "7pt", fontWeight: "700", color: "#374151" }}>{role}</div>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* ── FOOTER ── */}
                  <div style={{ marginTop: "6px", display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e7eb", paddingTop: "4px", fontSize: "6.5pt", color: "#9ca3af" }}>
                    <span>Printed: {new Date().toLocaleString("en-IN")}</span>
                    <span>AJ Shrink Industries — Gravure Production Job Card</span>
                    <span>{wo.workOrderNo}</span>
                  </div>

                </div>{/* end print area */}
              </div>
            </div>
          </>
        );
      })()}

      {/* ══ DELETE CONFIRM ════════════════════════════════════════ */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Work Order" size="sm">
          <p className="text-sm text-gray-600 mb-5">This work order will be permanently deleted.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => {
              const id = deleteId!;
              apiPost("api/gravureWorkOrderShrink/deleteworkorder", { JobBookingID: Number(id) })
                .catch(() => { })
                .finally(() => {
                  setWOs(d => d.filter(r => r.id !== id));
                  setDeleteId(null);
                });
            }}>Delete</Button>
          </div>
        </Modal>
      )}

      {/* ══ UPS LAYOUT DESIGN MODAL (plan selection eye icon) ══ */}
      {woUpsPreview && (() => {
        const plan = woUpsPreview as any;
        const isSleeve = ((form as any).structureType || getStructureType(form.content || "")) === "Sleeve";
        const jobW = form.actualWidth || form.jobWidth || 0;
        const shrink = (form as any).widthShrinkage || 0;
        const trim = form.trimmingSize || 0;
        const slvTransp = isSleeve ? ((form as any).transparentArea || 0) : 0;
        const slvSeam = isSleeve ? ((form as any).seamingArea || 0) : 0;
        const sleeveFilmWidth = isSleeve ? (jobW * 2 + slvTransp + slvSeam) : 0;
        const acUps = plan.acUps as number;
        const filmW = plan.filmSize as number;
        const content = form.content || "";
        const gusset = (form as any).gusset || 0;
        const topSeal = (form as any).topSeal || 0;
        const btmSeal = (form as any).bottomSeal || 0;
        const sideSeal = (form as any).sideSeal || 0;
        const ctrSeal = (form as any).centerSealWidth || 0;
        const sideGusset = (form as any).sideGusset || 0;

        // Effective repeat per content type
        let effRepeat: number;
        if (isSleeve) {
          effRepeat = (plan.cylCirc as number) / (plan.repeatUPS as number);
        } else if (content === "Pouch — 3 Side Seal" || content === "Pouch — Center Seal" || content === "Both Side Gusset Pouch") {
          effRepeat = (form.jobHeight || 0) + topSeal + btmSeal + shrink;
        } else if (content === "Standup Pouch" || content === "Zipper Pouch" || content === "3D Pouch / Flat Bottom") {
          effRepeat = (form.jobHeight || 0) + topSeal + (gusset > 0 ? gusset / 2 : 0) + shrink;
        } else {
          effRepeat = (form.jobHeight || 0) + shrink;
        }

        // Lane width per content type
        let diagLaneW: number;
        if (isSleeve) {
          diagLaneW = jobW * 2 + slvTransp + slvSeam;
        } else if (content === "Pouch — 3 Side Seal" || content === "Standup Pouch" || content === "Zipper Pouch") {
          diagLaneW = jobW + 2 * sideSeal;
        } else if (content === "Pouch — Center Seal") {
          diagLaneW = jobW * 2 + ctrSeal;
        } else if (content === "Both Side Gusset Pouch" || content === "3D Pouch / Flat Bottom") {
          diagLaneW = jobW + 2 * sideGusset;
        } else {
          diagLaneW = jobW;
        }

        const repeatUPS = plan.repeatUPS as number;
        const cylCirc = plan.cylCirc as number;
        const jobH = form.jobHeight || 0;

        const SVG_W = 730; const SVG_H = 415;
        const RULER_LEFT = 36; const RULER_BTM = 22;
        const drawW = 660 - RULER_LEFT; const drawH = 360 - RULER_BTM;
        const sx = (mm: number) => mm * (drawW / (filmW || 1));
        const sy = (mm: number) => mm * (drawH / (cylCirc || 1));
        const trimPx = sx(trim);
        const lanePx = isSleeve ? sx(sleeveFilmWidth) : sx(diagLaneW);
        const repPx = sy(effRepeat);
        const C_TRIM = "#fed7aa"; const C_LANE = ["#dbeafe", "#bfdbfe"];
        const C_DASH = "#6366f1";

        return (
          <Modal open onClose={() => setWoUpsPreview(null)} title="UPS Layout Design" size="xl">
            <div className="space-y-4">
              {/* Stats row */}
              <div className="flex flex-wrap gap-2 text-xs">
                {(() => {
                  const dc = jobW * 2 + slvSeam + slvTransp;
                  const cutWithShrink = jobH + shrink;
                  const baseStats = [
                    { l: "Film Width", v: `${filmW} mm`, cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                    { l: "AC UPS", v: String(acUps), cls: "bg-purple-50 text-purple-700 border-purple-200" },
                    { l: isSleeve ? "Layflat" : "Job Width", v: `${jobW} mm`, cls: "bg-blue-50 text-blue-700 border-blue-200" },
                  ];
                  const typeStats = isSleeve ? [
                    { l: "Design Circ", v: (() => { const p = [`${jobW}×2`]; if (slvTransp > 0) p.push(`+${slvTransp}`); if (slvSeam > 0) p.push(`+${slvSeam}`); return `${p.join("")} = ${dc} mm`; })(), cls: "bg-blue-100 text-blue-800 border-blue-300" },
                    { l: "Cut Length", v: shrink > 0 ? `${jobH}+${shrink} = ${cutWithShrink} mm` : `${jobH} mm`, cls: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
                    { l: "Repeat Count", v: `${repeatUPS}×`, cls: "bg-teal-50 text-teal-700 border-teal-200" },
                    { l: "Cyl. Circ", v: `${cutWithShrink}×${repeatUPS} = ${cylCirc} mm`, cls: "bg-emerald-50 text-emerald-800 border-emerald-300" },
                  ] : [
                    { l: "Length Shrink", v: shrink > 0 ? `+${shrink} mm` : "—", cls: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
                    { l: "Trimming", v: trim > 0 ? `${trim}+${trim} mm` : "—", cls: "bg-orange-50 text-orange-700 border-orange-200" },
                    { l: "Repeat UPS", v: String(repeatUPS), cls: "bg-teal-50 text-teal-700 border-teal-200" },
                    { l: "Cyl. Circ", v: `${cylCirc} mm`, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  ];
                  return [...baseStats, ...typeStats,
                  { l: "Total Pieces", v: String(plan.totalUPS), cls: "bg-green-50 text-green-700 border-green-200" },
                  { l: "Cylinder", v: plan.cylinderCode, cls: "bg-violet-50 text-violet-700 border-violet-200" },
                  { l: "Machine", v: plan.machineName, cls: "bg-gray-50 text-gray-700 border-gray-200" },
                  ];
                })().map(s => (
                  <div key={s.l} className={`px-2.5 py-1.5 rounded-lg border font-medium ${s.cls}`}>
                    <span className="opacity-60 text-[10px] uppercase tracking-wider block leading-none mb-0.5">{s.l}</span>
                    <span className="font-bold">{s.v}</span>
                  </div>
                ))}
              </div>

              {/* 2D Layout SVG */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Full Layout — {acUps} AC UPS × {repeatUPS} Repeat UPS = {plan.totalUPS} Total Pieces &nbsp;|&nbsp; Film {filmW}mm × Cyl. Circ {cylCirc}mm
                </p>
                <svg width={SVG_W} height={SVG_H} className="w-full" viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
                  <defs>
                    <pattern id="wo-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="5" stroke="#f97316" strokeWidth="1.5" opacity="0.4" />
                    </pattern>
                    <marker id="wo-dim-end" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#374151" />
                    </marker>
                    <marker id="wo-dim-start" markerWidth="7" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
                      <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#374151" />
                    </marker>
                  </defs>
                  {Array.from({ length: repeatUPS }, (_, ri) => {
                    const ry = RULER_LEFT + ri * repPx;
                    let cx = 0;
                    const cells = [];
                    if (trim > 0) cells.push(<rect key={`lt-${ri}`} x={cx} y={ry} width={trimPx} height={repPx} fill={C_TRIM} stroke="#f97316" strokeWidth={0.5} />);
                    cx += trimPx;
                    for (let li = 0; li < acUps; li++) {
                      const bg = C_LANE[li % 2];
                      const lsX = cx;
                      cells.push(
                        <g key={`l-${ri}-${li}`}>
                          <rect x={cx} y={ry} width={lanePx} height={repPx} fill={bg} stroke="#6366f1" strokeWidth={0.4} />
                          {lanePx > 30 && repPx > 18 && (() => {
                            const ax1 = lsX + 5; const ax2 = lsX + lanePx - 5; const ay = ry + repPx / 2;
                            return (
                              <g>
                                <line x1={ax1} y1={ay} x2={ax2} y2={ay} stroke="#1e40af" strokeWidth="1.3" markerStart="url(#wo-dim-start)" markerEnd="url(#wo-dim-end)" />
                                <rect x={lsX + lanePx / 2 - 22} y={ay - 8} width={44} height={12} fill="rgba(255,255,255,0.85)" rx={2} />
                                <text x={lsX + lanePx / 2} y={ay + 3} textAnchor="middle" fontSize={8} fill="#1e40af" fontWeight="700">{diagLaneW} mm</text>
                              </g>
                            );
                          })()}
                        </g>
                      );
                      cx += lanePx;
                    }
                    if (trim > 0) { cells.push(<rect key={`rt-${ri}`} x={cx} y={ry} width={trimPx} height={repPx} fill={C_TRIM} stroke="#f97316" strokeWidth={0.5} />); cx += trimPx; }
                    const dashLine = ri < repeatUPS - 1 ? <line key={`dh-${ri}`} x1={0} y1={ry + repPx} x2={cx} y2={ry + repPx} stroke={C_DASH} strokeWidth={1} strokeDasharray="4 3" /> : null;
                    const rulerLabel = repPx > 20 ? (
                      <g key={`rl-${ri}`}>
                        <line x1={15} y1={ry + 4} x2={15} y2={ry + repPx - 4} stroke="#374151" strokeWidth="1.3" markerStart="url(#wo-dim-start)" markerEnd="url(#wo-dim-end)" />
                        <rect x={2} y={ry + repPx / 2 - 22} width={14} height={44} fill="white" />
                        <text x={15} y={ry + repPx / 2} textAnchor="middle" fontSize={8} fill="#111827" fontWeight="700" transform={`rotate(-90, 15, ${ry + repPx / 2})`}>{effRepeat} mm</text>
                      </g>
                    ) : null;
                    return <React.Fragment key={`rep-${ri}`}>{rulerLabel}{cells}{dashLine}</React.Fragment>;
                  })}
                  {/* Bottom ruler */}
                  {(() => {
                    const ry = RULER_LEFT + repeatUPS * repPx + 4; let cx = 0; const ticks = [];
                    ticks.push(<text key="t0" x={cx} y={ry + 8} fontSize={7} fill="#9ca3af">0</text>);
                    if (trim > 0) { cx += trimPx; ticks.push(<text key="tt" x={cx} y={ry + 8} fontSize={7} fill="#f97316" textAnchor="middle">{trim}</text>); }
                    for (let li = 0; li <= acUps; li++) {
                      const xmm = trim + li * diagLaneW; const xpx = sx(xmm);
                      ticks.push(<g key={`bt-${li}`}><line x1={xpx} y1={ry - 2} x2={xpx} y2={ry + 2} stroke="#9ca3af" strokeWidth={0.8} />{(li === 0 || li === acUps || li === Math.floor(acUps / 2)) && <text x={xpx} y={ry + 9} fontSize={7} fill="#6b7280" textAnchor="middle">{xmm}</text>}</g>);
                    }
                    ticks.push(<text key="total" x={sx(filmW)} y={ry + 9} fontSize={7} fill="#6b7280" textAnchor="end">{filmW}mm</text>);
                    return ticks;
                  })()}
                  {/* Bottom dim arrow */}
                  {(() => {
                    const arrowY = RULER_LEFT + repeatUPS * repPx + RULER_BTM + 14; const midX = drawW / 2;
                    return (
                      <g>
                        <line x1={0} y1={arrowY} x2={drawW} y2={arrowY} stroke="#374151" strokeWidth="1.4" markerStart="url(#wo-dim-start)" markerEnd="url(#wo-dim-end)" />
                        <line x1={0} y1={arrowY - 6} x2={0} y2={arrowY + 6} stroke="#374151" strokeWidth="1" />
                        <line x1={drawW} y1={arrowY - 6} x2={drawW} y2={arrowY + 6} stroke="#374151" strokeWidth="1" />
                        <rect x={midX - 42} y={arrowY - 7} width={84} height={13} fill="white" />
                        <text x={midX} y={arrowY + 4} textAnchor="middle" fontSize={10} fill="#111827" fontWeight="700">Total Film Width: {filmW} mm</text>
                      </g>
                    );
                  })()}
                  {/* Right dim arrow — Cyl Circ */}
                  {(() => {
                    const arrX = drawW + 34; const y1 = RULER_LEFT; const y2 = RULER_LEFT + repeatUPS * repPx; const midY = (y1 + y2) / 2;
                    return (
                      <g>
                        <line x1={arrX} y1={y1} x2={arrX} y2={y2} stroke="#374151" strokeWidth="1.4" markerStart="url(#wo-dim-start)" markerEnd="url(#wo-dim-end)" />
                        <line x1={arrX - 6} y1={y1} x2={arrX + 6} y2={y1} stroke="#374151" strokeWidth="1" />
                        <line x1={arrX - 6} y1={y2} x2={arrX + 6} y2={y2} stroke="#374151" strokeWidth="1" />
                        <rect x={arrX - 6} y={midY - 38} width={12} height={76} fill="white" />
                        <text x={arrX} y={midY} textAnchor="middle" fontSize={10} fill="#111827" fontWeight="700" transform={`rotate(-90, ${arrX}, ${midY})`}>Cyl. Circ: {cylCirc} mm</text>
                      </g>
                    );
                  })()}
                </svg>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-gray-200">
                  {[
                    { color: "#dbeafe", border: "#6366f1", label: `Job cell — ${diagLaneW}mm wide × ${effRepeat}mm repeat length` },
                    ...(trim > 0 ? [{ color: C_TRIM, border: "#f97316", label: `Trim both sides (${trim}mm each)` }] : []),
                    ...(shrink > 0 ? [{ color: "#fae8ff", border: "#a21caf", label: `Shrinkage +${shrink}mm on repeat length` }] : []),
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded border-2 flex-shrink-0" style={{ background: l.color, borderColor: l.border }} />
                      <span className="text-[11px] text-gray-600">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* UPS-by-UPS Width breakdown */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">UPS-by-UPS Breakdown — Width Direction</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>{["Position", "Type", "Width (mm)", "Color"].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {trim > 0 && <tr><td className="px-3 py-1.5 text-gray-500">Left Bleed</td><td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#fff7ed", color: "#c2410c" }}>Trim</span></td><td className="px-3 py-1.5 font-mono font-bold text-orange-600">{trim}</td><td className="px-3 py-1.5"><div className="w-5 h-3 rounded" style={{ background: "#fed7aa", border: "1px solid #c2410c" }} /></td></tr>}
                      {Array.from({ length: acUps }, (_, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-gray-500">{i + 1} UPS{isSleeve && <span className="ml-1 text-[10px] text-gray-400">(LF×2+T+S)</span>}</td>
                          <td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#e0e7ff", color: "#4338ca" }}>{isSleeve ? "Sleeve Lane (LF×2+T+S)" : diagLaneW !== jobW ? "Pouch Lane (W+seals/gusset)" : "Job Width"}</span></td>
                          <td className="px-3 py-1.5 font-mono font-bold text-indigo-600">{isSleeve ? sleeveFilmWidth : diagLaneW}</td>
                          <td className="px-3 py-1.5"><div className="w-5 h-3 rounded" style={{ background: "#e0e7ff", border: "1px solid #6366f1" }} /></td>
                        </tr>
                      ))}
                      {trim > 0 && <tr><td className="px-3 py-1.5 text-gray-500">Right Bleed</td><td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#fff7ed", color: "#c2410c" }}>Trim</span></td><td className="px-3 py-1.5 font-mono font-bold text-orange-600">{trim}</td><td className="px-3 py-1.5"><div className="w-5 h-3 rounded" style={{ background: "#fed7aa", border: "1px solid #c2410c" }} /></td></tr>}
                      {plan.deadMargin > 0 && <tr><td className="px-3 py-1.5 text-gray-400 italic">Dead Margin</td><td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">Waste</span></td><td className="px-3 py-1.5 font-mono text-gray-400">{plan.deadMargin}</td><td className="px-3 py-1.5"><div className="w-5 h-3 rounded bg-gray-200 border border-gray-400" /></td></tr>}
                      <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-200"><td className="px-3 py-2 text-indigo-800" colSpan={2}>Total Film Width</td><td className="px-3 py-2 font-mono text-indigo-700">{filmW} mm</td><td /></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Repeat Height breakdown */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Repeat UPS Breakdown — Repeat Length Direction</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>{["Component", "Value", "Note"].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      <tr><td className="px-3 py-1.5 text-gray-600">Repeat Height</td><td className="px-3 py-1.5 font-mono font-bold text-indigo-700">{jobH} mm</td><td className="px-3 py-1.5 text-gray-400 text-[10px]">As entered</td></tr>
                      {topSeal > 0 && <tr><td className="px-3 py-1.5 text-gray-600">+ Top Seal</td><td className="px-3 py-1.5 font-mono font-bold text-orange-600">+{topSeal} mm</td><td className="px-3 py-1.5 text-gray-400 text-[10px]">Top seal added to repeat</td></tr>}
                      {btmSeal > 0 && (content === "Pouch — 3 Side Seal" || content === "Pouch — Center Seal" || content === "Both Side Gusset Pouch") && <tr><td className="px-3 py-1.5 text-gray-600">+ Bottom Seal</td><td className="px-3 py-1.5 font-mono font-bold text-orange-600">+{btmSeal} mm</td><td className="px-3 py-1.5 text-gray-400 text-[10px]">Bottom seal added to repeat</td></tr>}
                      {gusset > 0 && (content === "Standup Pouch" || content === "Zipper Pouch" || content === "3D Pouch / Flat Bottom") && <tr><td className="px-3 py-1.5 text-gray-600">+ Bottom Gusset / 2</td><td className="px-3 py-1.5 font-mono font-bold text-orange-600">+{gusset / 2} mm</td><td className="px-3 py-1.5 text-gray-400 text-[10px]">Bottom gusset folds into repeat</td></tr>}
                      {shrink > 0 && <tr><td className="px-3 py-1.5 text-gray-600">+ Shrinkage</td><td className="px-3 py-1.5 font-mono font-bold text-fuchsia-600">+{shrink} mm</td><td className="px-3 py-1.5 text-gray-400 text-[10px]">Applied to repeat length only</td></tr>}
                      <tr className="bg-teal-50"><td className="px-3 py-1.5 font-bold text-teal-800">= Effective Repeat</td><td className="px-3 py-1.5 font-mono font-bold text-teal-700">{effRepeat} mm</td><td className="px-3 py-1.5 text-teal-600 text-[10px]">Used for cylinder circumference matching</td></tr>
                      <tr><td className="px-3 py-1.5 text-gray-600">Cylinder Circumference</td><td className="px-3 py-1.5 font-mono font-bold text-emerald-700">{cylCirc} mm</td><td className="px-3 py-1.5 text-gray-400 text-[10px]">{plan.cylinderCode} — {plan.cylinderName}</td></tr>
                      <tr className="bg-green-50 border-t-2 border-green-200"><td className="px-3 py-2 font-bold text-green-800">÷ Repeat UPS</td><td className="px-3 py-2 font-mono font-bold text-green-700 text-sm">{repeatUPS}×</td><td className="px-3 py-2 text-green-600 text-[10px]">{cylCirc} ÷ {effRepeat} = {repeatUPS} repeats per revolution</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={() => setWoUpsPreview(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl border border-gray-200 transition">Close</button>
              </div>
            </div>
          </Modal>
        );
      })()}

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
              title: "Work Order",
              refNo: viewPlanWO.workOrderNo,
              jobWidth: viewPlanWO.jobWidth,
              jobHeight: viewPlanWO.jobHeight,
              quantity: viewPlanWO.quantity,
              unit: viewPlanWO.unit,
              noOfColors: viewPlanWO.noOfColors,
              secondaryLayers: viewPlanWO.secondaryLayers,
              processes: viewPlanWO.processes,
              cylinderCostPerColor: viewPlanWO.cylinderCostPerColor,
              overheadPct: viewPlanWO.overheadPct,
              profitPct: viewPlanWO.profitPct,
            } satisfies PlanInput} />
          </div>
          <div className="flex justify-between mt-4">
            <Button variant="secondary" onClick={() => setViewPlanWO(null)}>Close</Button>
            <Button icon={<BookMarked size={14} />} onClick={() => { setViewPlanWO(null); openSaveToCatalog(viewPlanWO); }}>Save to Catalog</Button>
          </div>
        </Modal>
      )}

      {/* ══ NEW CYLINDER MASTER MODAL ════════════════════════════ */}
      {newCylModal && (
        <Modal open onClose={() => setNewCylModal(null)} title="Create New Cylinder Master" size="sm">
          <div className="space-y-3">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-700">
              Creating a replacement cylinder for <strong>{newCylModal.fromTool.code}</strong>. Specs are pre-filled — update code and name, then save.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Cylinder Code *</label>
                <input className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400"
                  value={newCylForm.code} onChange={e => setNewCylForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. CYL-P001-R" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Cylinder Name *</label>
                <input className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400"
                  value={newCylForm.name} onChange={e => setNewCylForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Parle – Reprint – 8C" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Print Width (mm)</label>
                <input type="number" className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                  value={newCylForm.printWidth} onChange={e => setNewCylForm(p => ({ ...p, printWidth: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Repeat Length (mm)</label>
                <input type="number" className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                  value={newCylForm.repeatLength} onChange={e => setNewCylForm(p => ({ ...p, repeatLength: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Shelf Life (meters)</label>
                <input type="number" className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                  value={newCylForm.shelfLifeMeters} onChange={e => setNewCylForm(p => ({ ...p, shelfLifeMeters: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Material</label>
                <select className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-400"
                  value={newCylForm.cylinderMaterial} onChange={e => setNewCylForm(p => ({ ...p, cylinderMaterial: e.target.value }))}>
                  <option>Steel</option><option>Aluminium</option><option>Copper</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setNewCylModal(null)}>Cancel</Button>
              <Button onClick={() => {
                if (!newCylForm.code.trim() || !newCylForm.name.trim()) { alert("Code and Name are required"); return; }
                const newId = `EXTRA-CYL-${Date.now()}`;
                const newTool = {
                  ...newCylModal.fromTool,
                  id: newId,
                  code: newCylForm.code.trim(),
                  name: newCylForm.name.trim(),
                  printWidth: newCylForm.printWidth,
                  repeatLength: newCylForm.repeatLength,
                  shelfLifeMeters: parseInt(newCylForm.shelfLifeMeters) || 25000,
                  usedMeters: 0,
                  cylinderMaterial: newCylForm.cylinderMaterial,
                  surfaceFinish: newCylForm.surfaceFinish,
                  chromeStatus: "Plated" as const,
                  status: "Active" as const,
                };
                setExtraCyls(p => [...p, newTool]);
                const rowIdx = newCylModal.rowIdx;
                setCylinderAllocs(p => p.map((c, ci) => ci === rowIdx ? {
                  ...c,
                  toolId: newId,
                  cylinderNo: newCylForm.code.trim(),
                  cylinderType: "New" as const,
                  status: "Pending" as const,
                  remarks: `New cylinder created — replaces ${newCylModal.fromTool.code}`,
                  circumference: selectedPlan ? String(selectedPlan.cylCirc) : c.circumference,
                } as any : c));
                setNewCylModal(null);
              }}>Save & Allocate</Button>
            </div>
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
