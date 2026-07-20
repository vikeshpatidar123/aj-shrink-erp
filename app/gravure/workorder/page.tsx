"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import TutorialButton from "@/components/ui/TutorialButton";
import { QRCodeSVG } from "qrcode.react";
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
import { useMasters } from "@/context/MastersContext";
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
  hasZipper: 0, hasSpout: 0, hasValve: 0,
  hasWindow: 0, hasTearNotch: 0, hasEuroHole: 0, hasRoundCorner: 0,
  laminationPlies: 0, zipperWeight: 0, spoutWeight: 0,
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
// qty = weightKg (for Kg-based units) or meters (for m-based units)
function autoProcessQty(chargeUnit: string, qty: number, areaM2: number, colors: number): number {
  const u = (chargeUnit || "").toLowerCase().replace(/\s+/g, "");
  if (u.includes("kg"))                                              return qty;
  if (u.includes("m²") || u.includes("sqm") || u.includes("m2"))   return parseFloat(areaM2.toFixed(4));
  if (u === "m" || u === "rate/m" || u === "per m" || u === "meter" || u.endsWith("/m")) return qty;
  if (u.includes("cylinder") || u.includes("color") || u.includes("colour")) return colors;
  if (u.includes("1000pcs") || u.includes("1000 pcs"))              return qty / 1000;
  if (u.includes("job"))                                             return 1;
  return 0;
}

// ─── Section Header ────────────────────────────────────────────
const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2 pb-2 border-b border-purple-100">{label}</p>
);


export default function GravureWorkOrderPage() {
  const initSearch = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("search") ?? "";
  const { categories } = useCategories();
  const { catalog, saveCatalogItem } = useProductCatalog();
  const { inkItems: apiInkItems, sleeveItems: apiSleeveItems, cylinderMaster: apiCylindersRaw, filmItems: apiFilmItems, processes: apiProcesses } = useMasters();

  const normalizeConsumableGroup = (grp: string): string => {
    const g = (grp || "").toLowerCase();
    if (g.includes("ink"))      return "Ink";
    if (g.includes("solvent"))  return "Solvent";
    if (g.includes("adhesive")) return "Adhesive";
    if (g.includes("hardner") || g.includes("hardener")) return "Hardner";
    return grp;
  };

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

  // Live ink items from API (replaces static INK_ITEMS dummy data)
  const INK_ITEMS_LIVE = useMemo(() =>
    apiInkItems.length > 0
      ? apiInkItems
          .filter((i, idx, arr) => arr.findIndex(x => String(x.ItemID) === String(i.ItemID)) === idx)
          .map(i => ({
            id: String(i.ItemID),
            name: i.ItemName,
            colour: i.InkColour || "",
            pantoneNo: "",
          }))
      : INK_ITEMS,
  [apiInkItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live processes from API (replaces static ROTO_PROCESSES dummy data)
  const ROTO_PROCESSES_LIVE = useMemo(() =>
    apiProcesses.length > 0
      ? apiProcesses.map(p => ({
          id: String(p.ProcessID),
          name: p.DisplayProcessName || p.ProcessName,
          department: p.DepartmentName || "",
          chargeUnit: p.TypeofCharges || "",
          rate: String(p.Rate ?? 0),
          setupChargeAmount: String(p.SetupCharges ?? 0),
          makeSetupCharges: (p.SetupCharges ?? 0) > 0,
        }))
      : ROTO_PROCESSES,
  [apiProcesses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cylinder tools from Cylinder Master (API)
  const CYLINDER_TOOLS_LIVE = useMemo(() =>
    apiCylindersRaw.length > 0
      ? apiCylindersRaw.map(c => ({
          id: String(c.CylinderID), code: c.CylinderCode,
          name: c.CylinderName,
          printWidth: String(c.PrintWidth),
          repeatLength: String(c.Circumference),
          toolType: "Cylinder" as const,
        })).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth))
      : CYLINDER_TOOLS_ALL,
  [apiCylindersRaw]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const [workOrders, setWOs] = useState<GravureWorkOrder[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [apiPrefix, setApiPrefix] = useState("GRV");
  const [orders, setOrders] = useState<GravureOrder[]>([]);
  const [pageTab, setPageTab] = useState<"pending" | "workorders">("pending");
  const [modalOpen, setModal] = useState(false);
  const [viewRow, setViewRow] = useState<GravureWorkOrder | null>(null);
  const [printWO, setPrintWO] = useState<GravureWorkOrder | null>(null);
  const [editing, setEditing] = useState<GravureWorkOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState<{ type: "success" | "error"; title: string; msg: string } | null>(null);
  const [form, setForm] = useState<Omit<GravureWorkOrder, "id" | "workOrderNo">>(blankWO);
  const [replanOpen, setReplan] = useState(false);
  const [unwindPreview, setUnwindPreview] = useState<number | null>(null);
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

  // Saved plan from product catalog's GrvSavedPlanJSON — shown exclusively when present
  const [catalogSavedPlan, setCatalogSavedPlan] = useState<any>(null);

  // DB machines fetched from API (replaces dummyData PRINT_MACHINES for dropdowns)
  const [dbMachines, setDbMachines] = useState<{ id: string; name: string; maxWebWidth: number; minWebWidth: number; maxCirc: number; minCirc: number; speed: number }[]>([]);

  // DB vendors fetched from API (replaces dummyData VENDOR_LEDGERS for Film Requisition)
  const [dbVendors, setDbVendors] = useState<{ id: string; name: string }[]>([]);

  // DB cylinders fetched from ToolMaster API (replaces CYLINDER_TOOLS_ALL dummy data)
  const [dbCylinders, setDbCylinders] = useState<{ id: string; code: string; name: string; printWidth: string; circumferenceMM: number; cylinderType: string; shelfLifeMeters: number; usedMeters: number; repeatLength: string; }[]>([]);

  // Holds savedPlan object from product catalog for planId reconciliation
  const catalogSavedPlanRef = useRef<any>(null);
  const pendingPWOOrderRef = useRef<any>(null);

  // ── Production Preparation Types ────────────────────────────
  type FilmRequisition = { source: "Extrusion" | "Purchase" | ""; status: "Pending" | "Requested" | "Available"; requiredDate?: string; spec?: string; priority?: string; vendor?: string; expectedRate?: number; remarks?: string; };
  type ColorShade = { colorNo: number; colorName: string; inkType: "Spot" | "Process" | "Special"; pantoneRef: string; labL: string; labA: string; labB: string; labLMeas: string; labAMeas: string; labBMeas: string; deltaE: string; deltaETol: string; shadeCardRef: string; status: "Pending" | "Standard Received" | "Approved" | "Rejected"; remarks: string; };
  type MaterialAlloc = { id: string; plyNo?: number; materialType: string; materialName: string; requiredQty: number; unit: string; allocatedQty: number; batchId: string; lotNo: string; location: string; status: "Pending" | "Partial" | "Allocated"; };
  type CylinderAlloc = { colorNo: number; colorName: string; cylinderNo: string; circumference: string; cylinderType: "New" | "Existing" | "Rechromed"; status: "Pending" | "Available" | "In Use" | "Under Chrome" | "Ordered"; remarks: string; };
  const [filmReqs, setFilmReqs] = useState<FilmRequisition[]>([]);
  const [colorShades, setColorShades] = useState<ColorShade[]>([]);
  const [materialAllocs, setMaterialAllocs] = useState<MaterialAlloc[]>([]);
  const [batchOptions, setBatchOptions] = useState<Record<string, any[]>>({}); // key=ma.id → batches
  const [binOptions, setBinOptions] = useState<Record<string, any[]>>({});     // key=ma.id → bins
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
  // Tracks the OrderBookingDetailsID of the line being converted to a WO
  const orderDetIdRef = React.useRef<number>(0);

  // ── Cache helpers (localStorage, 5-min TTL, stale-while-revalidate) ──
  function cacheGet(key: string) {
    try {
      const s = localStorage.getItem(key);
      if (!s) return null;
      const { ts, data } = JSON.parse(s);
      if (Date.now() - ts < 5 * 60_000) return data;
    } catch { /* ignore */ }
    return null;
  }
  function cacheSet(key: string, data: any) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch { /* ignore */ }
  }
  function cacheInvalidate(...keys: string[]) {
    keys.forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  }

  // ── Load work orders from API on mount; also check sessionStorage pre-fill ──
  useEffect(() => {
    // ── Work Orders: show stale immediately, refresh in background ──
    const cachedWOs = cacheGet("wo_workorders");
    if (cachedWOs) setWOs(cachedWOs.map(mapApiToWO));
    apiGet<any[]>("api/gravureWorkOrderShrink/getworkorders")
      .then(rows => {
        if (Array.isArray(rows)) { setWOs(rows.map(mapApiToWO)); cacheSet("wo_workorders", rows); }
      })
      .catch((err: any) => { console.error("getworkorders failed:", err?.message || err); });

    // ── Pending Orders: show stale immediately, refresh in background ──
    const cachedOrders = cacheGet("wo_orders");
    if (cachedOrders) setOrders(cachedOrders.map(mapApiToOrder));
    apiGet<any>("api/gravureOrderBookingShrink/getorders")
      .then(raw => {
        const rows: any[] = Array.isArray(raw) ? raw : [];
        if (rows.length > 0) { setOrders(rows.map(mapApiToOrder)); cacheSet("wo_orders", rows); }
      })
      .catch(() => { /* keep empty on API error */ });

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

  // ── Lazy-load dropdowns/cylinders/machines only when modal first opens ──
  const dropdownsLoadedRef = React.useRef(false);
  useEffect(() => {
    if (!modalOpen || dropdownsLoadedRef.current) return;
    dropdownsLoadedRef.current = true;

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
      setForm(prev => {
        if (prev.machineId && !prev.machineName) {
          const found = mapped.find(m => m.id === prev.machineId);
          if (found) return { ...prev, machineName: found.name };
        }
        return prev;
      });
    };

    Promise.all([
      apiGet<any>("api/gravureWorkOrderShrink/getdropdowns").catch(() => null),
      apiGet<any[]>("api/gravureWorkOrderShrink/getcylinders").catch(() => null),
      apiGet<any[]>("api/productcataloggravureShrink/getmachinelist").catch(() => null),
    ]).then(([dd, cylinders, machines]) => {
      if (dd?.prefix) setApiPrefix(dd.prefix);
      if (Array.isArray(dd?.vendors) && dd.vendors.length > 0)
        setDbVendors(dd.vendors.map((v: any) => ({ id: String(v.id ?? ""), name: String(v.name ?? "") })));
      if (Array.isArray(cylinders) && cylinders.length > 0)
        setDbCylinders(cylinders.map((r: any) => ({
          id: String(r.id ?? ""), code: String(r.code ?? ""), name: String(r.name ?? ""),
          printWidth: String(r.printWidth ?? "0"), circumferenceMM: Number(r.circumferenceMM ?? 0),
          cylinderType: String(r.cylinderType ?? "New"), shelfLifeMeters: Number(r.shelfLifeMeters ?? 0),
          usedMeters: Number(r.usedMeters ?? 0), repeatLength: String(r.circumferenceMM ?? "0"),
        })));
      if (Array.isArray(machines) && machines.length > 0) {
        applyMachines(machines.map(mapMachine));
      } else if (Array.isArray(dd?.machines) && dd.machines.length > 0) {
        applyMachines(dd.machines.map(mapMachine));
      }
    });
  }, [modalOpen]);

  // ── When pendingPWOOrder is set, fetch all catalog data directly from API ──
  useEffect(() => {
    const src = pendingPWOOrder ?? pendingPWOOrderRef.current;
    if (!src) return;
    const lines: any[] = Array.isArray(src.orderLines) ? src.orderLines : (Array.isArray(src.lines) ? src.lines : []);
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
        const pm = ROTO_PROCESSES_LIVE.find(x => x.id === pid) || ROTO_PROCESSES_LIVE.find(x => x.name === pname);
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
        hasZipper:      Number(row.HasZipper      ?? row.hasZipper      ?? 0),
        hasSpout:       Number(row.HasSpout       ?? row.hasSpout       ?? 0),
        hasValve:       Number(row.HasValve       ?? row.hasValve       ?? 0),
        hasWindow:      Number(row.HasWindow      ?? row.hasWindow      ?? 0),
        hasTearNotch:   Number(row.HasTearNotch   ?? row.hasTearNotch   ?? 0),
        hasEuroHole:    Number(row.HasEuroHole    ?? row.hasEuroHole    ?? 0),
        hasRoundCorner: Number(row.HasRoundCorner ?? row.hasRoundCorner ?? 0),
        laminationPlies: Number(row.LaminationPlies ?? row.laminationPlies ?? 0),
        zipperWeight: Number(row.ZipperWeight ?? row.zipperWeight ?? 0),
        spoutWeight: Number(row.SpoutWeight ?? row.spoutWeight ?? 0),
        machineId: String(row.MachineID ?? row.GrvMachineID ?? row.machineId ?? ""),
        machineName: String(row.MachineName ?? row.GrvMachineName ?? row.machineName ?? ""),
        savedPlanId: String(row.SavedPlanID ?? row.savedPlanId ?? ""),
        savedPlan: parseNestedJson(row.ContentSizeValues ?? row.GrvSavedPlanJSON ?? row.savedPlanJSON),
        standardUnit: String(row.StandardUnit ?? row.standardUnit ?? "Meter"),
        unwindDirection: Number(row.UnwindDirection ?? row.unwindDirection ?? 0),
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
      unwindDirection: Number((snapshotCatalogItem as any)?.unwindDirection || 0),
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
    // enquiryId returned by updated getorders API; fallback to estimationId for older responses
    const srcEstimationId = String(line.enquiryId || line.estimationId || "");
    Promise.all([
      apiGet<any>(`api/gravureWorkOrderShrink/getpwoinitdata/${line.id}`).catch(() => null),
      srcCatalogId ? apiGet<any>(`api/productcataloggravureShrink/getcatalogbyid/${srcCatalogId}`).catch(() => null) : Promise.resolve(null),
      (srcEstimationId && !srcCatalogId) ? apiGet<any>(`api/gravureEnquiryShrink/getenquirybyid/${srcEstimationId}`).catch(() => null) : Promise.resolve(null),
    ])
      .then(([cat, catalogByIdRaw, enqRaw]) => {
        // ── Estimation-sourced order: map estimation data into form ──
        if (srcEstimationId && !srcCatalogId && enqRaw) {
          const enq = typeof enqRaw === "string" ? (() => { try { return JSON.parse(enqRaw); } catch { return enqRaw; } })() : enqRaw;
          const apiPlys: any[] = enq?.Plys ?? [];
          const apiProcs: any[] = enq?.Processes ?? [];

          const estimationLayers = safeNormalizeLayers(apiPlys.map((ply: any, i: number) => ({
            layerNo: Number(ply.LayerNo ?? i + 1),
            plyType: String(ply.PlyType ?? "Film"),
            itemSubGroup: String(ply.FilmSubGroup ?? ""),
            density: Number(ply.Density ?? 0),
            thickness: Number(ply.Thickness ?? 0),
            gsm: Number(ply.FilmGSM ?? 0),
            itemId: String(ply.ItemID ?? ""),
            itemName: String(ply.ItemName ?? ""),
            consumableItems: (ply.Consumables ?? []).map((c: any, ci: number) => ({
              consumableId: `enq-${i + 1}-con-${ci + 1}`,
              fieldDisplayName: String(c.FieldDisplayName ?? ""),
              itemGroup: String(c.ItemGroup ?? ""),
              itemSubGroup: String(c.ItemSubGroup ?? ""),
              itemId: String(c.ItemID ?? ""),
              itemName: String(c.ItemName ?? ""),
              gsm: Number(c.GSM ?? 0),
              rate: Number(c.Rate ?? 0),
              coveragePct: Number(c.CoveragePct ?? 100),
            })),
          })));

          const estimationProcs = safeNormalizeProcesses(apiProcs.map((p: any) => ({
            processId: String(p.ProcessID ?? ""),
            processName: String(p.ProcessName ?? ""),
            chargeUnit: "",
            rate: 0,
            qty: 0,
            setupCharge: 0,
            amount: 0,
          })));

          const enqJobWidth    = Number(enq?.GrvPlanWidth    ?? enq?.GrvWidth ?? 0);
          const enqJobHeight   = Number(enq?.GrvPlanHeight   ?? 0);
          const enqTopSeal     = Number(enq?.GrvTopSeal      ?? 0);
          const enqBottomSeal  = Number(enq?.GrvBottomSeal   ?? 0);
          const enqSideSeal    = Number(enq?.GrvSideSeal     ?? 0);
          const enqCenterSeal  = Number(enq?.GrvCenterSeal   ?? 0);
          const enqGusset      = Number(enq?.GrvGusset       ?? 0);
          const enqSideGusset  = Number(enq?.GrvSideGusset   ?? 0);
          const enqSeamingArea = Number(enq?.GrvSeamingArea  ?? 0);
          const enqTranspArea  = Number(enq?.GrvTransparentArea ?? 0);
          const enqNoOfColors  = Number(enq?.GrvNoOfColors   ?? 0);
          const enqContent     = String(enq?.GrvSelectedContent ?? "");
          const enqSubstrate   = String(enq?.GrvSubstrate    ?? "");
          const enqPrintType   = String(enq?.GrvPrintType    ?? "Surface Print");
          const enqStructure   = String(enq?.GrvStructureType ?? "");

          setForm(f => ({
            ...f,
            sourceOrderType: "Estimation" as any,
            content: enqContent || f.content,
            structureType: ((enqStructure || f.structureType) as any),
            structure: enqStructure || f.structure,
            substrate: enqSubstrate || f.substrate,
            jobWidth: enqJobWidth || f.jobWidth,
            jobHeight: enqJobHeight || f.jobHeight,
            noOfColors: enqNoOfColors || f.noOfColors,
            printType: ((enqPrintType || f.printType) as any),
            topSeal: enqTopSeal,
            bottomSeal: enqBottomSeal,
            sideSeal: enqSideSeal,
            centerSealWidth: enqCenterSeal,
            gusset: enqGusset,
            sideGusset: enqSideGusset,
            seamingArea: enqSeamingArea,
            transparentArea: enqTranspArea,
            secondaryLayers: estimationLayers.length > 0 ? (estimationLayers as any) : f.secondaryLayers,
            processes: estimationProcs.length > 0 ? estimationProcs : f.processes,
          } as any));

          setDimValues({
            width: enqJobWidth || undefined,
            height: enqJobHeight || undefined,
            topSeal: enqTopSeal || undefined,
            bottomSeal: enqBottomSeal || undefined,
            sideSeal: enqSideSeal || undefined,
            centerSealWidth: enqCenterSeal || undefined,
            gusset: enqGusset || undefined,
            sideGusset: enqSideGusset || undefined,
            seamingArea: enqSeamingArea || undefined,
            transparentArea: enqTranspArea || undefined,
            layflatWidth: enqJobWidth || undefined,
            cutHeight: enqJobHeight || undefined,
          });

          // Auto-apply estimation's saved plan if backend returned GrvPlanJSON
          try {
            const rawEstPlan = (enq as any)?.GrvPlanJSON;
            if (rawEstPlan) {
              const sp = typeof rawEstPlan === "string" ? JSON.parse(rawEstPlan) : rawEstPlan;
              if (sp?.planId) {
                const woId = sp.planId.startsWith("CP-") ? "WO-" + sp.planId.slice(3)
                  : sp.planId.startsWith("SLEEVE-") ? "WO-SLEEVE-" + sp.planId.slice(7)
                  : sp.planId;
                setCatalogSavedPlan({
                  ...sp, planId: woId,
                  isBest: true, isFromCatalog: false,
                  isSpecial: false, isSpecialSleeve: false,
                });
                // Auto-generate cylinder allocs from estimation plan
                const nC = enqNoOfColors || 0;
                if (nC > 0) {
                  setCylinderAllocs(Array.from({ length: nC }, (_, idx) => ({
                    colorNo: idx + 1,
                    colorName: `Color ${idx + 1}`,
                    cylinderNo: sp.cylinderCode || "",
                    circumference: sp.cylCirc ? String(sp.cylCirc) : "",
                    cylinderType: "Existing" as const,
                    status: "Pending" as const,
                    remarks: "",
                    cylinderMasterID: String(sp.cylinderId ?? ""),
                  } as any)));
                }
              }
            }
          } catch { /* ignore parse error */ }

          pendingPWOOrderRef.current = null;
          setPendingPWOOrder(null);
          return;
        }
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

        // Map cylinderAllocs from cylAllocsJSON; if empty, auto-generate from plan + noOfColors
        const rawCyls: any[] = parseMaybeArray(catRow.cylAllocsJSON);
        // Top-level plan cylinder code/id from PMC (fallback when row-level cylinderNo is empty)
        const topPlanCylCode = String(catRow.planCylCode ?? "").trim();
        const topPlanCylId   = String(catRow.planCylId ?? "").trim();
        // Also try savedPlanJSON / contentSizeValues
        const rawSp0 = catRow.savedPlanJSON || catRow.contentSizeValues;
        const sp0 = rawSp0 ? (typeof rawSp0 === "string" ? (() => { try { return JSON.parse(rawSp0); } catch { return null; } })() : rawSp0) : null;
        const spCylCode = String(sp0?.cylinderCode ?? sp0?.PlanCylCode ?? "").trim();
        const spCylId   = String(sp0?.cylinderId ?? sp0?.CylinderID ?? "").trim();
        // Don't use SPL as fallback — it's a placeholder for special-order, not a real ToolMaster code
        const fallbackCylCode = (!topPlanCylCode.startsWith("SPL") ? topPlanCylCode : "") || (!spCylCode.startsWith("SPL") ? spCylCode : "");
        const fallbackCylId   = topPlanCylId   || spCylId;
        if (rawCyls.length > 0) {
          console.log("[CYL-DEBUG] rawCyls from DB:", rawCyls.map((c:any) => ({ cylinderNo: c.cylinderNo, cylinderMasterID: c.cylinderMasterID, planCylCode: c.planCylCode })));
          console.log("[CYL-DEBUG] dbCylinders count:", dbCylinders.length, "sample ids:", dbCylinders.slice(0,3).map(t=>({id:t.id,code:t.code})));
          setCylinderAllocs(rawCyls.map((c: any) => {
            const rowCylNo = String(c.cylinderNo ?? "").trim();
            const rowMasterId = String(c.cylinderMasterID ?? "").trim();
            const rowPlanCode = String(c.planCylCode ?? "").trim();
            return {
              colorNo: Number(c.colorNo ?? 0),
              colorName: String(c.colorName ?? ""),
              cylinderNo: rowCylNo || fallbackCylCode,
              circumference: String(c.circumference ?? ""),
              cylinderType: (c.cylinderType || "New") as CylinderAlloc["cylinderType"],
              status: (c.status || "Pending") as CylinderAlloc["status"],
              remarks: String(c.remarks ?? ""),
              cylinderMasterID: rowMasterId || fallbackCylId,
              planCylCode: rowPlanCode || fallbackCylCode,
            } as any;
          }));
          const missingFromDb = rawCyls
            .map((c: any) => ({ id: String(c.cylinderMasterID ?? "").trim(), code: String(c.cylinderNo ?? "").trim(), circ: Number(c.circumference ?? 0) }))
            .filter(c => c.id && c.code && !dbCylinders.some(t => String(t.id) === c.id || t.code === c.code));
          console.log("[CYL-DEBUG] missingFromDb:", missingFromDb);
          if (missingFromDb.length > 0) {
            setExtraCyls(prev => {
              const existingIds = new Set((prev as any[]).map((e: any) => String(e.id)));
              const toAdd = missingFromDb.filter(c => !existingIds.has(c.id)).map(c => ({
                id: c.id, code: c.code, name: c.code, printWidth: "0",
                circumferenceMM: c.circ, repeatLength: String(c.circ),
                cylinderType: "New", shelfLifeMeters: 0, usedMeters: 0, toolType: "Cylinder", active: true,
              }));
              console.log("[CYL-DEBUG] adding to extraCyls:", toAdd);
              return toAdd.length > 0 ? [...prev, ...toAdd as any] : prev;
            });
          }
        } else {
          // Auto-generate one cylinder row per color using the catalog's saved plan cylinder
          const nColors = Number(catRow.noOfColors || (catalogItem as any)?.noOfColors || 0);
          const rawSp = catRow.savedPlanJSON || catRow.contentSizeValues;
          const sp = rawSp ? (typeof rawSp === "string" ? (() => { try { return JSON.parse(rawSp); } catch { return null; } })() : rawSp) : (catalogItem?.savedPlan ?? null);
          const rawCylCode = sp?.cylinderCode ?? "";
          // Don't use SPL as cylinder code — it's a special-order placeholder, not a real cylinder
          const planCylCode = rawCylCode.startsWith("SPL") ? "" : rawCylCode;
          const planCylName = sp?.cylinderName ?? "";
          const planCylSet = planCylCode || catRow.cylinderSet || "";
          const planCirc = sp?.cylCirc ? String(sp.cylCirc) : "";
          setCylinderAllocs(Array.from({ length: nColors }, (_, i) => ({
            colorNo: i + 1,
            colorName: `Color ${i + 1}`,
            cylinderNo: planCylCode,
            circumference: planCirc,
            cylinderType: "New" as const,
            status: "Pending" as const,
            remarks: "",
          })));
        }

        // Auto-generate material allocations from ply/consumable data
        {
          const qty = Number(catRow.orderQty || line.orderQty || 0);
          const unit = String(catRow.unit || line.unit || "Meter");
          const wid = Number(catRow.jobWidth || (catalogItem as any)?.jobWidth || line.jobWidth || 0);
          const filmGsm = (secondaryLayers[0] as any)?.gsm ?? 0;
          // If unit is Kg, convert to area via film GSM; otherwise treat qty as meters
          const sqm = (unit === "Kg" && filmGsm > 0)
            ? (qty * 1000) / filmGsm
            : qty * (wid / 1000);
          const matAllocs: MaterialAlloc[] = [];
          secondaryLayers.forEach((l: any, idx: number) => {
            const matName = String(l.itemSubGroup || l.itemName || "");
            if (matName) {
              const reqWt = l.gsm > 0 ? parseFloat(((l.gsm / 1000) * sqm * 1.03).toFixed(3)) : 0;
              matAllocs.push({ id: `film-${idx}`, plyNo: l.layerNo, materialType: "Film", materialName: matName, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, lotNo: "", location: "", status: "Pending", batchId: "" });
            }
            (l.consumableItems || []).forEach((ci: any, j: number) => {
              const ciName = String(ci.itemName || ci.fieldDisplayName || "");
              if (ciName) {
                const reqWt = ci.gsm > 0 ? parseFloat(((ci.gsm / 1000) * sqm * 1.03).toFixed(3)) : 0;
                matAllocs.push({ id: `con-${idx}-${j}`, plyNo: l.layerNo, materialType: String(ci.itemGroup || ""), materialName: ciName, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, lotNo: "", location: "", status: "Pending", batchId: "" });
              }
            });
          });
          if (matAllocs.length > 0) setMaterialAllocs(matAllocs);
        }

        // Parse GrvSavedPlanJSON from product catalog and store directly
        try {
          const rawSp = catRow.savedPlanJSON || catRow.contentSizeValues;
          const sp = rawSp
            ? (typeof rawSp === "string" ? JSON.parse(rawSp) : rawSp)
            : (catalogItem?.savedPlan ?? null);
          catalogSavedPlanRef.current = sp;
          if (sp?.planId) {
            const woId = sp.planId.startsWith("CP-") ? "WO-" + sp.planId.slice(3)
              : sp.planId.startsWith("SLEEVE-") ? "WO-SLEEVE-" + sp.planId.slice(7)
              : sp.planId;
            const cylW = Number(sp.cylinderWidthVal || 0);
            const circ = Number(sp.cylCirc || 0);
            setCatalogSavedPlan({
              ...sp,
              planId: woId,
              cylRepeatLength: circ,
              cylAreaSqMm: cylW * circ,
              cylAreaSqInch: parseFloat(((cylW * circ) / 645.16).toFixed(2)),
              totalWt: 0,
              totalTime: 0,
              isBest: true,
              isFromCatalog: true,
              // Catalog handles cylinder creation — never block WO as "special"
              isSpecial: false,
              isSpecialSleeve: false,
            });
          } else {
            setCatalogSavedPlan(null);
          }
        } catch {
          catalogSavedPlanRef.current = catalogItem?.savedPlan ?? null;
          setCatalogSavedPlan(null);
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
          hasZipper:      Number(catRow.hasZipper      || catalogItem?.hasZipper      || 0),
          hasSpout:       Number(catRow.hasSpout       || catalogItem?.hasSpout       || 0),
          hasValve:       Number(catRow.hasValve       || catalogItem?.hasValve       || 0),
          hasWindow:      Number(catRow.hasWindow      || catalogItem?.hasWindow      || 0),
          hasTearNotch:   Number(catRow.hasTearNotch   || catalogItem?.hasTearNotch   || 0),
          hasEuroHole:    Number(catRow.hasEuroHole    || catalogItem?.hasEuroHole    || 0),
          hasRoundCorner: Number(catRow.hasRoundCorner || catalogItem?.hasRoundCorner || 0),
          laminationPlies: Number(catRow.laminationPlies || catalogItem?.laminationPlies || 0),
          zipperWeight: Number(catRow.zipperWeight || catalogItem?.zipperWeight || 0),
          spoutWeight: Number(catRow.spoutWeight || catalogItem?.spoutWeight || 0),
          cylinderCostPerColor: Number(catRow.cylinderCostPerColor || 0),
          overheadPct: Number(catRow.overheadPct || 0),
          profitPct: Number(catRow.profitPct || 0),
          perMeterRate: Number(catRow.perMeterRate || 0),
          // MultiPack Shrink Film fields
          repeatLength: Number((catRow as any).repeatLength || catalogItem?.repeatLength || 0),
          packWidth: Number((catRow as any).packWidth || catalogItem?.packWidth || 0),
          packHeight: Number((catRow as any).packHeight || catalogItem?.packHeight || 0),
          hMargin: Number((catRow as any).hMargin || catalogItem?.hMargin || 0),
          vMargin: Number((catRow as any).vMargin || catalogItem?.vMargin || 0),
          printedLength: Number((catRow as any).printedLength || catalogItem?.printedLength || 0),
          eyeMarkLength: Number((catRow as any).eyeMarkLength || catalogItem?.eyeMarkLength || 3),
          gapLength: Number((catRow as any).gapLength || catalogItem?.gapLength || 0),
          secondaryLayers: secondaryLayers as any,
          processes,
          selectedPlanId: String(catRow.savedPlanId || catalogItem?.savedPlanId || ""),
          unwindDirection: Number(catRow.unwindDirection || (catalogItem as any)?.unwindDirection || 0),
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
    if (lines.length === 0) {
      const raw = r.LinesJSON ?? r.linesJSON ?? r.linesJson ?? "";
      if (typeof raw === "string" && raw.trim()) {
        try { lines = JSON.parse(raw); } catch { lines = []; }
      } else if (Array.isArray(raw)) {
        lines = raw;
      }
    }
    const firstLine = lines[0] || {};
    const hasCatalog = lines.some((l: any) => l.catalogId && String(l.catalogId) !== "0" && String(l.catalogId) !== "");
    const hasEstimation = lines.some((l: any) => l.estimationId && String(l.estimationId) !== "0" && String(l.estimationId) !== "");
    return {
      id: String(r.orderId || r.OrderBookingID || ""),
      orderNo: String(r.orderNo || r.SalesOrderNo || r.OrderBookingNo || ""),
      date: String(r.date || r.OrderBookingDate || ""),
      customerId: String(r.customerId || r.LedgerID || ""),
      customerName: String(r.customerName || r.CustomerName || ""),
      salesType: String(r.salesType || r.SalesType || ""),
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
      unit: String(r.unit || firstLine.unit || "Kg"),
      deliveryDate: String(r.deliveryDate || firstLine.deliveryDate || ""),
      sourceType: (r.sourceType || (hasCatalog ? "Catalog" : hasEstimation ? "Estimation" : "Direct")) as any,
      totalAmount: Number(r.totalAmount || r.TotalAmount || 0),
      perMeterRate: Number(r.perMeterRate || 0),
      processes: [],
      secondaryLayers: [],
      overheadPct: 12,
      profitPct: 15,
      orderLines: lines,
      unwindDirection: Number(firstLine.unwindDirection ?? 0),
      status: (r.status || r.Status || "Confirmed") as any,
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
        const pm = ROTO_PROCESSES_LIVE.find(x => x.id === pid)
          || ROTO_PROCESSES_LIVE.find(x => x.name === pname);
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

    // ── Extract cylinder allocs: prefer cylAllocsJSON, fall back to color shade cylinder fields
    const cylAllocsFromJson: CylinderAlloc[] = Array.isArray(r.cylAllocsJSON)
      ? r.cylAllocsJSON.map((ca: any) => ({
          colorNo: Number(ca.colorNo ?? 0),
          colorName: String(ca.colorName ?? ""),
          cylinderNo: String(ca.cylinderNo ?? ""),
          circumference: String(ca.circumference ?? ""),
          cylinderType: (ca.cylinderType || "New") as CylinderAlloc["cylinderType"],
          status: (ca.status || "Pending") as CylinderAlloc["status"],
          remarks: String(ca.remarks ?? ""),
          cylinderMasterID: String(ca.cylinderMasterID ?? ""),
          toolId: String(ca.toolId ?? ""),
        } as any))
      : [];
    const cylAllocsFromColor: CylinderAlloc[] = Array.isArray(r.savedColorShadesJSON)
      ? r.savedColorShadesJSON
          .filter((cs: any) => cs.cylinderNo && String(cs.cylinderNo).trim() !== "")
          .map((cs: any) => ({
            colorNo: Number(cs.colorNo ?? 0),
            colorName: String(cs.colorName ?? ""),
            cylinderNo: String(cs.cylinderNo ?? ""),
            circumference: "",
            cylinderType: (cs.cylinderType || "New") as CylinderAlloc["cylinderType"],
            status: (cs.cylinderStatus || "Pending") as CylinderAlloc["status"],
            remarks: String(cs.remarks ?? ""),
          }))
      : [];
    const restoredCylAllocs = cylAllocsFromJson.length > 0 ? cylAllocsFromJson : cylAllocsFromColor;

    // ── Extract film reqs and material allocs
    const restoredFilmReqs: FilmRequisition[] = Array.isArray(r.filmReqsJSON)
      ? r.filmReqsJSON.map((fr: any) => ({
          source: (fr.source || "") as FilmRequisition["source"],
          status: (fr.status || "Pending") as FilmRequisition["status"],
          requiredDate: String(fr.requiredDate ?? ""),
          spec: String(fr.spec ?? ""),
          priority: String(fr.priority ?? ""),
          vendor: String(fr.vendor ?? ""),
          expectedRate: Number(fr.expectedRate ?? 0),
          remarks: String(fr.remarks ?? ""),
        }))
      : [];
    const restoredMatAllocs: MaterialAlloc[] = Array.isArray(r.materialAllocJSON)
      ? r.materialAllocJSON.map((ma: any, idx: number) => ({
          id: String(ma.id ?? `mat-${idx}`),
          plyNo: Number(ma.plyNo ?? 0) || undefined,
          materialType: String(ma.materialType ?? ""),
          materialName: String(ma.materialName ?? ""),
          requiredQty: Number(ma.requiredQty ?? 0),
          unit: String(ma.unit ?? "Kg"),
          allocatedQty: Number(ma.allocatedQty ?? 0),
          lotNo: String(ma.lotNo ?? ""),
          location: String(ma.location ?? ""),
          status: (ma.status || "Pending") as MaterialAlloc["status"],
        }))
      : [];

    // ── Parse saved plan JSON for edit-mode restore
    let restoredSavedPlan: any = null;
    const rawPlanStr = r.savedPlanJSON;
    if (rawPlanStr && typeof rawPlanStr === "string" && rawPlanStr.trim()) {
      try { restoredSavedPlan = JSON.parse(rawPlanStr); } catch { restoredSavedPlan = null; }
    } else if (rawPlanStr && typeof rawPlanStr === "object") {
      restoredSavedPlan = rawPlanStr;
    }

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
      repeatLength: Number(r.repeatLength ?? 0),
      packWidth: Number(r.packWidth ?? 0),
      packHeight: Number(r.packHeight ?? 0),
      hMargin: Number(r.hMargin ?? 0),
      vMargin: Number(r.vMargin ?? 0),
      printedLength: Number(r.printedLength ?? 0),
      eyeMarkLength: Number(r.eyeMarkLength ?? 3),
      gapLength: Number(r.gapLength ?? 0),
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
      // ── Catalog integration data (used by openEdit to restore states)
      colorShades: Array.isArray(r.savedColorShadesJSON)
        ? r.savedColorShadesJSON.map((cs: any) => ({
            colorNo: Number(cs.colorNo ?? 0),
            colorName: String(cs.colorName ?? ""),
            inkType: (cs.inkType || "Spot") as any,
            pantoneRef: String(cs.pantoneRef ?? ""),
            labL: String(cs.labL ?? ""), labA: String(cs.labA ?? ""), labB: String(cs.labB ?? ""),
            labLMeas: "", labAMeas: "", labBMeas: "",
            deltaE: "--", deltaETol: String(cs.deltaETol ?? ""),
            shadeCardRef: String(cs.shadeCardRef ?? ""),
            status: (cs.status || "Pending") as any,
            remarks: String(cs.remarks ?? ""),
          }))
        : [],
      cylinderAllocs: restoredCylAllocs,
      filmReqs: restoredFilmReqs,
      materialAllocs: restoredMatAllocs,
      // Extra field for plan restore (not in type, accessed via cast in openEdit)
      _savedPlanJSON: restoredSavedPlan,
    } as any as GravureWorkOrder;
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
    } else if (content === "Pouch — 3 Side Seal" || content === "3 Side Seal Sachet" || content === "3-Side Seal Sachet - Standard" || content === "3-Side Seal Sachet - Tear Notch" || content === "Standup Pouch" || content === "Stand Up Pouch" || content === "Stand Up Pouch - No Zipper" || content === "Stand Up Pouch - With Zipper" || content === "Stand Up Pouch - With Spout" || content === "Zipper Pouch") {
      laneWidth = jobW + 2 * sideSeal;
    } else if (content === "Pouch — Center Seal" || content === "Center Seal Pouch") {
      laneWidth = jobW * 2 + ctrSeal;
    } else if (content === "Both Side Gusset Pouch" || content === "Gusset Bag" || content === "Gusset Bag - Side Gusset" || content === "3D Pouch / Flat Bottom" || content === "Flat Bottom Pouch" || content === "Flat Bottom Pouch - Standard" || content === "Flat Bottom Pouch - With Zipper" || content === "Flat Bottom Pouch - With Valve") {
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
    } else if (content === "Pouch — 3 Side Seal" || content === "3 Side Seal Sachet" || content === "3-Side Seal Sachet - Standard" || content === "3-Side Seal Sachet - Tear Notch" || content === "Pouch — Center Seal" || content === "Center Seal Pouch" || content === "Both Side Gusset Pouch" || content === "Gusset Bag" || content === "Gusset Bag - Side Gusset") {
      effectiveRepeat = jobH + topSeal + btmSeal + shrink;
    } else if (content === "Standup Pouch" || content === "Stand Up Pouch" || content === "Stand Up Pouch - No Zipper" || content === "Stand Up Pouch - With Zipper" || content === "Stand Up Pouch - With Spout" || content === "Zipper Pouch" || content === "3D Pouch / Flat Bottom" || content === "Flat Bottom Pouch" || content === "Flat Bottom Pouch - Standard" || content === "Flat Bottom Pouch - With Zipper" || content === "Flat Bottom Pouch - With Valve") {
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

    // Ply film width from secondary layer 0 → Item Master WebWidth
    const ply1ItemId = String((form as any).secondaryLayers?.[0]?.itemId ?? "");
    const plyFilm = ply1ItemId ? apiFilmItems.find(f => String(f.ItemID) === ply1ItemId) : null;
    const plyFilmSizeW = plyFilm ? Number(plyFilm.WebWidth ?? 0) : 0;

    // ── LOOP A: Label / Pouch ──
    // Sleeve width = film width (±10mm). Sleeve from Item Master; special if none match.
    // Cylinder ≥ sleeveWidth + 100mm. One row per valid circumference multiple.
    // filmWidth fixed from Ply when plyFilmSizeW > 0; else iterate freely.
    const loopA = sType !== "Sleeve" ? (() => {
      const plans: any[] = [];

      const generateForFilmWidth = (filmWidth: number, acUps: number) => {
        if (filmWidth < machineMinFilm || filmWidth > machineMaxFilm) return;
        // Prefer narrowest sleeve that fully covers filmWidth; fall back to nearest within 50mm
        let slvCandidates = SLEEVE_TOOLS_LIVE.filter(s => parseFloat(s.printWidth) >= filmWidth).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
        if (slvCandidates.length === 0) slvCandidates = SLEEVE_TOOLS_LIVE.filter(s => Math.abs(parseFloat(s.printWidth) - filmWidth) <= 50).sort((a, b) => Math.abs(parseFloat(a.printWidth) - filmWidth) - Math.abs(parseFloat(b.printWidth) - filmWidth));
        const slv = slvCandidates.length > 0 ? slvCandidates[0] : null;
        const sleeveWidthVal = slv ? parseFloat(slv.printWidth) : filmWidth;
        const sleeveCode = slv ? slv.code : "SPL-S";
        const sleeveName = slv ? slv.name : "Special Order Sleeve";
        const isSpecialSleeve = !slv;
        const minCylWidth = sleeveWidthVal + 100;

        const cylList: any[] = [];
        if (effectiveRepeat <= 0) {
          cylList.push({ id: "SPECIAL-CYL-1", code: "SPL", name: "Special Order", printWidth: String(Math.ceil(minCylWidth)), repeatLength: "450", isSpecial: true });
        } else {
          for (let mult = 1; mult * effectiveRepeat <= machineMaxCirc; mult++) {
            const circ = mult * effectiveRepeat;
            if (circ < machineMinCirc) continue;
            const real = CYLINDER_TOOLS_LIVE.filter(t => (parseFloat(t.printWidth) || 0) >= minCylWidth && Math.abs((parseFloat(t.repeatLength || "0") || 0) - circ) < 0.5);
            if (real.length > 0) real.forEach(c => cylList.push({ id: c.id, code: c.code, name: c.name, printWidth: c.printWidth, repeatLength: c.repeatLength || String(circ), isSpecial: false }));
            else cylList.push({ id: `SPECIAL-CYL-${mult}`, code: "SPL", name: `Special Order (${mult}×${effectiveRepeat}mm)`, printWidth: String(Math.ceil(minCylWidth)), repeatLength: String(circ), isSpecial: true });
          }
        }
        if (cylList.length === 0) return;

        const printingWidth = acUps * laneWidth;
        const sideWaste = parseFloat((2 * trim).toFixed(1));
        const deadMargin = parseFloat((sleeveWidthVal - filmWidth).toFixed(1));
        const totalWaste = parseFloat((sideWaste + Math.max(0, deadMargin)).toFixed(1));

        for (const cylinder of cylList) {
          const cylWidthV = parseFloat(cylinder.printWidth);
          if (cylWidthV < minCylWidth) continue;
          const cylCirc = parseFloat(cylinder.repeatLength) || 450;
          const repeatUPS = calcRepeatUPS(cylCirc);
          const totalUPS = acUps * repeatUPS;
          const reqRMT = form.quantity > 0 ? Math.ceil(form.quantity / totalUPS) : 1;
          const totalRMT = Math.ceil(reqRMT * 1.01);
          const cylAreaSqMm = cylWidthV * cylCirc;
          const cylAreaSqInch = parseFloat((cylAreaSqMm / 645.16).toFixed(2));
          const totalWt = parseFloat((totalRMT * (jobW / 1000) * plyGSM / 1000).toFixed(3));
          const totalTime = parseFloat((totalRMT / (speed * 60)).toFixed(2));
          plans.push({
            planId: `WO-${form.machineId}-${slv ? slv.id : "SPLS"}-UPS${acUps}-${cylinder.id}`,
            machineName: form.machineName,
            filmSize: filmWidth, acUps, printingWidth,
            sleeveCode, sleeveName, sleeveWidthVal,
            cylinderCode: cylinder.code, cylinderName: cylinder.name,
            cylinderWidthVal: cylWidthV,
            sideWaste, deadMargin, totalWaste,
            cylCirc, cylRepeatLength: cylCirc, cylAreaSqMm, cylAreaSqInch,
            repeatUPS, totalUPS,
            reqRMT, totalRMT, totalWt, totalTime, wastage: totalWaste,
            isSpecial: cylinder.isSpecial, isSpecialSleeve, isBest: false,
          });
        }
      };

      if (plyFilmSizeW > 0) {
        const filmWidth = plyFilmSizeW;
        const acUps = Math.floor((filmWidth - 2 * trim) / laneWidth);
        if (acUps >= 1) generateForFilmWidth(filmWidth, acUps);
      } else {
        const maxAcUps = Math.floor((machineMaxFilm - 2 * trim) / laneWidth);
        for (let acUps = 1; acUps <= maxAcUps; acUps++) {
          const filmWidth = acUps * laneWidth + 2 * trim;
          generateForFilmWidth(filmWidth, acUps);
        }
      }
      return plans;
    })() : [];

    // ── LOOP S: Shrink Sleeve products ──
    // Rubber impression sleeve from Item Master (SizeW ≈ filmWidth ±10mm); special if none.
    // Cylinder ≥ sleeveWidth + 100mm. filmWidth from Ply when set; else iterate.
    const loopS = sType === "Sleeve" ? (() => {
      if (sleeveCutLength <= 0) return [];
      const maxRepeatCount = Math.floor(machineMaxCirc / sleeveCutLength);
      if (maxRepeatCount === 0) return [];
      const plans: any[] = [];
      for (let repeatCount = 1; repeatCount <= maxRepeatCount; repeatCount++) {
        const cylinderCirc = sleeveCutLength * repeatCount;
        if (cylinderCirc < machineMinCirc) continue;
        if (cylinderCirc > machineMaxCirc) break;

        const cylsByCirc = CYLINDER_TOOLS_LIVE.filter(t => {
          const circ = parseFloat(t.repeatLength || "0") || 0;
          return Math.abs(circ - cylinderCirc) < 1;
        }).map(c => ({ id: c.id, code: c.code, name: c.name, printWidth: c.printWidth, repeatLength: c.repeatLength || String(cylinderCirc), isSpecial: false }));

        const pushPlan = (acUps: number, filmWidth: number, deadMargin: number) => {
          // Prefer narrowest sleeve that fully covers filmWidth; fall back to nearest within 50mm
          let slvCandidates = SLEEVE_TOOLS_LIVE.filter(s => parseFloat(s.printWidth) >= filmWidth).sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));
          if (slvCandidates.length === 0) slvCandidates = SLEEVE_TOOLS_LIVE.filter(s => Math.abs(parseFloat(s.printWidth) - filmWidth) <= 50).sort((a, b) => Math.abs(parseFloat(a.printWidth) - filmWidth) - Math.abs(parseFloat(b.printWidth) - filmWidth));
          const slv = slvCandidates.length > 0 ? slvCandidates[0] : null;
          const sleeveWidthVal = slv ? parseFloat(slv.printWidth) : filmWidth;
          const sleeveCode = slv ? slv.code : "SPL-S";
          const sleeveName = slv ? slv.name : "Special Order Sleeve";
          const isSpecialSleeve = !slv;
          const minCylWidth = sleeveWidthVal + 100;
          const validRealCyls = cylsByCirc.filter(c => (parseFloat(c.printWidth) || 0) >= minCylWidth);
          const cylList = validRealCyls.length > 0
            ? validRealCyls
            : [{ id: `SPECIAL-CYL-SLEEVE-R${repeatCount}`, code: "SPL", name: `Special Order (${cylinderCirc}mm = ${sleeveCutLength}×${repeatCount})`, printWidth: String(Math.ceil(minCylWidth)), repeatLength: String(cylinderCirc), isSpecial: true }];
          const printingWidth = acUps * laneWidth;
          for (const cyl of cylList) {
            const cylWidthV = parseFloat(cyl.printWidth) || 0;
            const totalUPS = acUps * repeatCount;
            const reqRMT = form.quantity > 0 ? Math.ceil(form.quantity / totalUPS) : 1;
            const totalRMT = Math.ceil(reqRMT * 1.01);
            const cylAreaSqMm = cylWidthV * cylinderCirc;
            const cylAreaSqInch = parseFloat((cylAreaSqMm / 645.16).toFixed(2));
            const totalWt = parseFloat((totalRMT * (jobW / 1000) * plyGSM / 1000).toFixed(3));
            const totalTime = parseFloat((totalRMT / (speed * 60)).toFixed(2));
            plans.push({
              planId: `WO-SLEEVE-${form.machineId}-R${repeatCount}-${acUps}UPS-${cyl.id}`,
              machineName: form.machineName,
              filmSize: filmWidth, acUps, printingWidth,
              sleeveCode, sleeveName, sleeveWidthVal,
              cylinderCode: cyl.code, cylinderName: cyl.name, cylinderWidthVal: cylWidthV,
              sideWaste: 0, deadMargin, totalWaste: deadMargin,
              cylCirc: cylinderCirc, cylRepeatLength: cylinderCirc, cylAreaSqMm, cylAreaSqInch,
              repeatUPS: repeatCount, totalUPS,
              reqRMT, totalRMT, totalWt, totalTime, wastage: deadMargin,
              isSpecial: cyl.isSpecial, isSpecialSleeve, isBest: false,
              sleeveCutLength, repeatCount,
            });
          }
        };

        if (plyFilmSizeW > 0) {
          const filmWidth = plyFilmSizeW;
          if (filmWidth < machineMinFilm || filmWidth > machineMaxFilm) continue;
          const acUps = Math.floor((filmWidth - 2 * trim) / laneWidth);
          if (acUps < 1) continue;
          const deadMargin = parseFloat((filmWidth - acUps * laneWidth - 2 * trim).toFixed(1));
          pushPlan(acUps, filmWidth, deadMargin);
        } else {
          const maxAcUps = Math.floor((machineMaxFilm - 2 * trim) / laneWidth);
          for (let acUps = 1; acUps <= maxAcUps; acUps++) {
            const filmWidth = acUps * laneWidth + 2 * trim;
            if (filmWidth > machineMaxFilm) break;
            if (filmWidth < machineMinFilm) continue;
            const deadMargin = parseFloat((machineMaxFilm - filmWidth).toFixed(1));
            pushPlan(acUps, filmWidth, deadMargin);
          }
        }
      }
      return plans;
    })() : [];

    const rawPlans = sType === "Sleeve" ? loopS : loopA;
    if (rawPlans.length === 0) return rawPlans;
    const sorted = [...rawPlans].sort((a, b) =>
      a.totalWaste !== b.totalWaste ? a.totalWaste - b.totalWaste :
        a.deadMargin !== b.deadMargin ? a.deadMargin - b.deadMargin :
          a.sideWaste !== b.sideWaste ? a.sideWaste - b.sideWaste :
            b.acUps !== a.acUps ? b.acUps - a.acUps : 0
    );
    return sorted.map((p, idx) => ({ ...p, isBest: !p.isSpecial && idx === 0 }));
  }, [form.machineId, form.actualWidth, form.jobWidth, form.jobHeight, form.trimmingSize, form.quantity, form.content, (form as any).structureType, (form as any).widthShrinkage, (form as any).gusset, (form as any).topSeal, (form as any).bottomSeal, (form as any).sideSeal, (form as any).centerSealWidth, (form as any).sideGusset, (form as any).seamingArea, (form as any).transparentArea, dbMachines, totalPlyGSM, SLEEVE_TOOLS_LIVE, CYLINDER_TOOLS_LIVE, apiFilmItems, form.secondaryLayers]); // eslint-disable-line react-hooks/exhaustive-deps

  const catalogSavedPlanMatch = useMemo(() => {
    if (allPlans.length === 0) return null;
    if (form.selectedPlanId) {
      // Direct match (works if planId wasn't modified)
      const direct = allPlans.find(p => p.planId === form.selectedPlanId);
      if (direct) return direct;
      // CP- prefix (catalog loop A/B) → WO- prefix (workorder) — same structure after prefix
      if (form.selectedPlanId.startsWith("CP-")) {
        const woEquivalent = "WO-" + form.selectedPlanId.slice(3);
        const byConverted = allPlans.find(p => p.planId === woEquivalent);
        if (byConverted) return byConverted;
      }
      // SLEEVE- prefix (catalog sleeve loop) → WO-SLEEVE- prefix
      if (form.selectedPlanId.startsWith("SLEEVE-")) {
        const woEquivalent = "WO-SLEEVE-" + form.selectedPlanId.slice(7);
        const byConverted = allPlans.find(p => p.planId === woEquivalent);
        if (byConverted) return byConverted;
      }
    }
    // Fuzzy match by saved plan properties (type-safe Number/String coercion)
    const sp = catalogSavedPlanRef.current as any;
    if (!sp?.filmSize) return null;
    return allPlans.find(p =>
      Math.abs(Number((p as any).filmSize) - Number(sp.filmSize)) < 0.5 &&
      Number((p as any).acUps) === Number(sp.acUps) &&
      String((p as any).sleeveCode).toLowerCase() === String(sp.sleeveCode).toLowerCase() &&
      String((p as any).cylinderCode).toLowerCase() === String(sp.cylinderCode).toLowerCase()
    ) || null;
  }, [allPlans, form.selectedPlanId]);

  // Auto-apply catalog saved plan (direct from GrvSavedPlanJSON) or reconcile CP-→WO- prefix
  useEffect(() => {
    if (catalogSavedPlan) {
      if (form.selectedPlanId !== catalogSavedPlan.planId || form.ups !== catalogSavedPlan.totalUPS) {
        setForm(prev => ({ ...prev, selectedPlanId: catalogSavedPlan.planId, ups: catalogSavedPlan.totalUPS }));
        setIsPlanApplied(true);
        setShowPlan(false);
      }
      return;
    }
    if (!catalogSavedPlanMatch) return;
    if (form.selectedPlanId === catalogSavedPlanMatch.planId && form.ups === catalogSavedPlanMatch.totalUPS) return;
    setForm(prev => ({ ...prev, selectedPlanId: catalogSavedPlanMatch.planId, ups: catalogSavedPlanMatch.totalUPS }));
  }, [catalogSavedPlan, catalogSavedPlanMatch, form.selectedPlanId, form.ups]); // eslint-disable-line react-hooks/exhaustive-deps

  const visiblePlans = useMemo(() => {
    // When a catalog saved plan exists → show only that 1 plan (no full plan list)
    if (catalogSavedPlan) return [catalogSavedPlan];

    // Show all plans — same as product catalog (includes special cylinder plans)
    let rows = [...allPlans];
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
  }, [allPlans, planSearch, planSort, planColFilters, catalogSavedPlanMatch, catalogSavedPlan]);

  const togglePlanSort = (key: string) =>
    setPlanSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  const selectedPlan = useMemo(() => {
    if (catalogSavedPlan && form.selectedPlanId === catalogSavedPlan.planId) return catalogSavedPlan;
    return allPlans.find(p => p.planId === form.selectedPlanId) || null;
  }, [allPlans, form.selectedPlanId, catalogSavedPlan]);

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
    const filmGsmInit = f.secondaryLayers[0]?.gsm ?? 0;
    const reqSQM = (f.unit === "Kg" && filmGsmInit > 0)
      ? (f.quantity * 1000) / filmGsmInit
      : f.quantity * ((f.jobWidth || 0) / 1000);
    f.secondaryLayers.forEach((l, i) => {
      if (l.itemSubGroup) {
        const reqWt = l.gsm > 0 ? parseFloat(((l.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
        allocs.push({ id: `film-${i}`, plyNo: l.layerNo, materialType: "Film", materialName: l.itemSubGroup, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, lotNo: "", location: "", status: "Pending", batchId: "" });
      }
      (l.consumableItems || []).forEach((ci, j) => {
        const reqWt = ci.gsm > 0 ? parseFloat(((ci.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
        allocs.push({ id: `con-${i}-${j}`, plyNo: l.layerNo, materialType: ci.itemGroup, materialName: ci.itemName || ci.fieldDisplayName, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, lotNo: "", location: "", status: "Pending", batchId: "" });
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
        const inkItem = INK_ITEMS_LIVE.find(x => x.id === ink.inkItemId);
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
        // 1. Match by consumableId (most reliable — same ink across re-renders)
        const byConsumable = prev.find(c => (c as any).consumableId === ink.consumableId);
        if (byConsumable) return { ...byConsumable, colorNo: i + 1, colorName: ink.inkName };
        // 2. Match by colorNo — preserves cylinder data loaded from catalog/estimation
        const byColorNo = prev.find(c => c.colorNo === i + 1);
        if (byColorNo) return { ...byColorNo, colorName: ink.inkName, consumableId: ink.consumableId } as any;
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

  // ── Auto-generate materialAllocs when layers are loaded but allocs are empty ──
  useEffect(() => {
    if (!modalOpen || materialAllocs.length > 0 || form.secondaryLayers.length === 0) return;
    const filmGsmAuto = form.secondaryLayers[0]?.gsm ?? 0;
    const reqSQM = (form.unit === "Kg" && filmGsmAuto > 0)
      ? (form.quantity * 1000) / filmGsmAuto
      : form.quantity * ((form.jobWidth || 0) / 1000);
    const allocs: MaterialAlloc[] = [];
    form.secondaryLayers.forEach((l, i) => {
      const matName = String(l.itemSubGroup || l.itemName || "");
      if (matName) {
        const reqWt = l.gsm > 0 ? parseFloat(((l.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
        allocs.push({ id: `film-${i}`, plyNo: l.layerNo, materialType: "Film", materialName: matName, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, batchId: "", lotNo: "", location: "", status: "Pending" } as any);
      }
      l.consumableItems.forEach((ci, j) => {
        const ciName = String(ci.itemName || ci.fieldDisplayName || "");
        if (ciName) {
          const reqWt = ci.gsm > 0 ? parseFloat(((ci.gsm / 1000) * reqSQM * 1.03).toFixed(3)) : 0;
          allocs.push({ id: `con-${i}-${j}`, plyNo: l.layerNo, materialType: String(ci.itemGroup || ""), materialName: ciName, requiredQty: reqWt, unit: "Kg", allocatedQty: 0, batchId: "", lotNo: "", location: "", status: "Pending", itemId: String(ci.itemId || "") } as any);
        }
      });
    });
    if (allocs.length > 0) setMaterialAllocs(allocs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.secondaryLayers, form.quantity, form.jobWidth, modalOpen, materialAllocs.length]);

  // ── Auto-resolve toolId for cylinder allocs when cylinder master loads ──
  useEffect(() => {
    if (cylinderAllocs.length === 0) return;
    const allCyls = dbCylinders.length > 0 ? dbCylinders as any[] : CYLINDER_TOOLS_LIVE;
    if (allCyls.length === 0) return;
    const needsResolve = cylinderAllocs.some(ca => !(ca as any).toolId && ((ca as any).cylinderMasterID || (ca as any).cylinderNo || (ca as any).planCylCode));
    console.log("[CYL-RESOLVE] needsResolve:", needsResolve, "allCyls:", allCyls.length, "allocs:", cylinderAllocs.map((ca:any)=>({cylinderNo:ca.cylinderNo,cylinderMasterID:ca.cylinderMasterID,toolId:ca.toolId})));
    if (!needsResolve) return;
    setCylinderAllocs(prev => {
      const next = prev.map(ca => {
        if ((ca as any).toolId) return ca;
        // 1. Match by cylinderMasterID (ToolID from DB) — most reliable
        const masterId = String((ca as any).cylinderMasterID || "").trim();
        console.log("[CYL-RESOLVE] trying masterId:", masterId, "in allCyls:", allCyls.slice(0,3).map((t:any)=>({id:t.id,code:t.code})));
        if (masterId) {
          const match = allCyls.find(t => String(t.id) === masterId);
          if (match) return { ...ca, toolId: match.id, cylinderNo: match.code, circumference: match.repeatLength || String(match.circumferenceMM) || ca.circumference } as any;
        }
        // 2. Match by planCylCode (direct code, e.g. "CUC-034") — skip SPL
        const planCode = String((ca as any).planCylCode || "").trim();
        if (planCode && !planCode.startsWith("SPL")) {
          const match = allCyls.find(t => t.code === planCode);
          if (match) return { ...ca, toolId: match.id, cylinderNo: match.code, circumference: match.repeatLength || String(match.circumferenceMM) || ca.circumference } as any;
        }
        // 3. Fallback: match by cylinderNo code (strip "-C01" suffix: "CUC-034-C01" → "CUC-034")
        const code = String((ca as any).cylinderNo || "").trim();
        if (!code || code.startsWith("SPL")) return ca;
        const baseCode = code.replace(/-C\d+$/, "");
        const match = allCyls.find(t => t.code === code) || allCyls.find(t => t.code === baseCode);
        if (!match) return ca;
        return { ...ca, toolId: match.id, cylinderNo: match.code, circumference: match.repeatLength || String(match.circumferenceMM) || ca.circumference } as any;
      });
      // Return prev if nothing changed — prevents infinite re-render loop
      return next.some((v, i) => v !== prev[i]) ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbCylinders, CYLINDER_TOOLS_LIVE, cylinderAllocs]);

  // ── Auto-fetch batches for material allocs when Material tab opens ──
  useEffect(() => {
    if (prepTab !== "material" || materialAllocs.length === 0) return;
    materialAllocs.forEach(ma => {
      const itemId = (ma as any).itemId;
      if (!itemId || batchOptions[ma.id]) return; // already loaded
      apiGet<any[]>(`api/gravureWorkOrderShrink/getbatchesbyitem?itemId=${itemId}`)
        .then(res => setBatchOptions(p => ({ ...p, [ma.id]: Array.isArray(res) ? res : [] })))
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepTab, materialAllocs]);

  // ── Recalculate requiredQty when quantity or unit changes (allocs already exist) ──
  useEffect(() => {
    if (!modalOpen || form.secondaryLayers.length === 0 || materialAllocs.length === 0) return;
    const filmGsm = form.secondaryLayers[0]?.gsm ?? 0;
    const reqSQM = (form.unit === "Kg" && filmGsm > 0)
      ? (form.quantity * 1000) / filmGsm
      : form.quantity * ((form.jobWidth || 0) / 1000);
    setMaterialAllocs(prev => prev.map(ma => {
      let gsm = 0;
      for (const layer of form.secondaryLayers) {
        if (ma.materialType === "Film" && ma.materialName === (layer.itemSubGroup || layer.itemName || "")) {
          gsm = (layer as any).gsm ?? 0; break;
        }
        for (const ci of layer.consumableItems) {
          if (ma.materialName === (ci.itemName || ci.fieldDisplayName || "")) {
            gsm = (ci as any).gsm ?? 0; break;
          }
        }
      }
      const newReqQty = gsm > 0 ? parseFloat(((gsm / 1000) * reqSQM * 1.03).toFixed(3)) : ma.requiredQty;
      return { ...ma, requiredQty: newReqQty };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.quantity, form.unit, form.jobWidth, modalOpen]);

  const cellInput = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

  // ── Convert pending order to WO ────────────────────────────
  const convertToWO = (order: GravureOrder) => {
    setEditing(null);
    const o = order as any;
    const lines: any[] = Array.isArray(o.orderLines) ? o.orderLines : [];
    const firstLine = lines[0] || {};
    const hasCatalog = lines.some((l: any) => l.catalogId && String(l.catalogId) !== "0" && String(l.catalogId) !== "");

    // Capture line-item ID so backend can mark the order line as booked on save
    orderDetIdRef.current = Number(firstLine.id) || 0;

    setFilmReqs([]); setColorShades([]); setMaterialAllocs([]); setCylinderAllocs([]); setPrepTab("film");
    setShowPlan(false); setIsPlanApplied(false); setCatalogSavedPlan(null);
    setModalTab("basic");

    if (hasCatalog) {
      // Match the catalog item from in-memory store — same as Order Booking "Create PWO" button
      const firstCatalogLine = lines.find((l: any) => l.catalogId && String(l.catalogId) !== "0");
      const matchedCatalog =
        catalog.find(c => c.id === String(firstCatalogLine?.catalogId || "")) ||
        catalog.find(c => c.catalogNo === String(firstCatalogLine?.catalogNo || "")) ||
        catalog.find(c =>
          String(c.customerId || "") === String(order.customerId || "") &&
          String(c.productName || "").trim().toLowerCase() === String(firstCatalogLine?.productName || order.jobName || "").trim().toLowerCase()
        );

      const pwoData = {
        orderId: order.id,
        orderNo: order.orderNo,
        customerId: order.customerId,
        customerName: order.customerName,
        salesType: o.salesType || o.SalesType || "",
        catalogId: String(firstCatalogLine?.catalogId || ""),
        catalogNo: String(firstCatalogLine?.catalogNo || ""),
        productName: String(firstCatalogLine?.productName || order.jobName || ""),
        catalogSnapshot: matchedCatalog ?? null,
        lines: lines.map((l: any) => ({
          id: String(l.id ?? ""),
          catalogId: String(l.catalogId ?? ""),
          catalogNo: String(l.catalogNo ?? ""),
          productName: String(l.productName ?? ""),
          orderQty: Number(l.orderQty ?? 0),
          unit: String(l.unit ?? "Meter"),
          jobWidth: Number(l.jobWidth ?? 0),
          jobHeight: Number(l.jobHeight ?? 0),
          substrate: String(l.substrate ?? ""),
          structureType: String(l.structureType ?? ""),
          content: String(l.content ?? ""),
          categoryId: String(l.categoryId ?? ""),
          categoryName: String(l.categoryName ?? ""),
          noOfColors: Number(l.noOfColors ?? 0),
          printType: String(l.printType ?? ""),
          trimmingSize: Number(l.trimmingSize ?? 0),
          widthShrinkage: Number(l.widthShrinkage ?? 0),
          gusset: Number(l.gusset ?? 0),
          topSeal: Number(l.topSeal ?? 0),
          bottomSeal: Number(l.bottomSeal ?? 0),
          sideSeal: Number(l.sideSeal ?? 0),
          centerSealWidth: Number(l.centerSealWidth ?? 0),
          sideGusset: Number(l.sideGusset ?? 0),
          seamingArea: Number(l.seamingArea ?? 0),
          transparentArea: Number(l.transparentArea ?? 0),
          deliveryDate: String(l.deliveryDate ?? ""),
        })),
      };
      pendingPWOOrderRef.current = pwoData;
      setPendingPWOOrder(pwoData);
      setForm(f => ({
        ...blankWO,
        sourceOrderType: "Catalog",
        orderId: order.id,
        orderNo: order.orderNo,
        customerId: order.customerId,
        customerName: order.customerName,
        salesType: o.salesType || "",
        jobName: String(firstLine.productName ?? order.jobName ?? ""),
        quantity: Number(firstLine.orderQty ?? order.quantity ?? 0),
        unit: String(firstLine.unit ?? order.unit ?? "Meter"),
        deliveryDate: String(firstLine.deliveryDate ?? ""),
      } as any));
      setModal(true);
      return;
    }

    // No catalog — direct/estimation order, fill all fields immediately
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
      hasZipper:      Number(o.hasZipper      || 0),
      hasSpout:       Number(o.hasSpout       || 0),
      hasValve:       Number(o.hasValve       || 0),
      hasWindow:      Number(o.hasWindow      || 0),
      hasTearNotch:   Number(o.hasTearNotch   || 0),
      hasEuroHole:    Number(o.hasEuroHole    || 0),
      hasRoundCorner: Number(o.hasRoundCorner || 0),
      laminationPlies: Number(o.laminationPlies || 0),
      zipperWeight: Number(o.zipperWeight || 0),
      spoutWeight: Number(o.spoutWeight || 0),
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
    setModal(true);

    // If this is an estimation-sourced order, fetch estimation detail and overlay planning data
    const firstEstimationId = String(firstLine.estimationId || "");
    if (firstEstimationId && firstEstimationId !== "0") {
      apiGet<any>(`api/gravureEnquiryShrink/getenquirybyid/${firstEstimationId}`)
        .then(enqRaw => {
          if (!enqRaw) return;
          const enq = typeof enqRaw === "string"
            ? (() => { try { return JSON.parse(enqRaw); } catch { return null; } })()
            : enqRaw;
          if (!enq) return;
          const apiPlys: any[] = enq.Plys ?? [];
          const apiProcs: any[] = enq.Processes ?? [];

          const estimationLayers: any[] = apiPlys.map((ply: any, i: number) => ({
            id: `ply-${i + 1}`,
            layerNo: Number(ply.LayerNo ?? i + 1),
            plyType: String(ply.PlyType ?? "Film"),
            itemSubGroup: String(ply.FilmSubGroup ?? ""),
            density: Number(ply.Density ?? 0),
            thickness: Number(ply.Thickness ?? 0),
            gsm: Number(ply.FilmGSM ?? 0),
            filmGSM: Number(ply.FilmGSM ?? 0),
            filmRate: 0,
            itemId: String(ply.ItemID ?? ""),
            itemName: String(ply.ItemName ?? ""),
            consumableItems: (ply.Consumables ?? []).map((c: any, ci: number) => ({
              consumableId: `enq-${i + 1}-con-${ci + 1}`,
              fieldDisplayName: String(c.FieldDisplayName ?? ""),
              itemGroup: String(c.ItemGroup ?? ""),
              itemGroupName: String(c.ItemGroup ?? ""),
              itemSubGroup: String(c.ItemSubGroup ?? ""),
              itemSubGroupName: String(c.ItemSubGroup ?? ""),
              itemId: String(c.ItemID ?? ""),
              itemName: String(c.ItemName ?? ""),
              gsm: Number(c.GSM ?? 0),
              dryGSM: Number(c.GSM ?? 0),
              rate: Number(c.Rate ?? 0),
              coveragePct: Number(c.CoveragePct ?? 100),
              solidPct: Number(c.CoveragePct ?? 100),
              solidPercentage: Number(c.CoveragePct ?? 100),
              itemGroupId: "",
              itemSubGroupId: "",
            })),
          }));

          const estimationProcs = apiProcs.map((p: any) => {
            const procId = String(p.ProcessID ?? "");
            const procName = String(p.ProcessName ?? "");
            const pm = ROTO_PROCESSES_LIVE.find((r: any) => r.id === procId);
            return {
              processId: pm?.id ?? procId,
              processName: (pm?.name ?? procName) || procId,
              chargeUnit: pm?.chargeUnit ?? "",
              rate: parseFloat((pm as any)?.rate ?? "0") || 0,
              qty: 0,
              setupCharge: (pm as any)?.makeSetupCharges ? parseFloat((pm as any).setupChargeAmount || "0") || 0 : 0,
              amount: 0,
            };
          }).filter((p: any) => p.processId);

          const enqJobWidth    = Number(enq.GrvPlanWidth    ?? enq.GrvWidth ?? 0);
          const enqJobHeight   = Number(enq.GrvPlanHeight   ?? 0);
          const enqTopSeal     = Number(enq.GrvTopSeal      ?? 0);
          const enqBottomSeal  = Number(enq.GrvBottomSeal   ?? 0);
          const enqSideSeal    = Number(enq.GrvSideSeal     ?? 0);
          const enqCenterSeal  = Number(enq.GrvCenterSeal   ?? 0);
          const enqGusset      = Number(enq.GrvGusset       ?? 0);
          const enqSideGusset  = Number(enq.GrvSideGusset   ?? 0);
          const enqSeamingArea = Number(enq.GrvSeamingArea  ?? 0);
          const enqTranspArea  = Number(enq.GrvTransparentArea ?? 0);
          const enqNoOfColors  = Number(enq.GrvNoOfColors   ?? 0);
          const enqContent     = String(enq.GrvSelectedContent ?? "");
          const enqSubstrate   = String(enq.GrvSubstrate    ?? "");
          const enqPrintType   = String(enq.GrvPrintType    ?? "Surface Print");
          const enqStructure   = String(enq.GrvStructureType ?? "");

          setForm(f => ({
            ...f,
            sourceOrderType: "Estimation" as any,
            content: enqContent || f.content,
            structureType: ((enqStructure || f.structureType) as any),
            structure: enqStructure || f.structure,
            substrate: enqSubstrate || f.substrate,
            jobWidth: enqJobWidth || f.jobWidth,
            jobHeight: enqJobHeight || f.jobHeight,
            noOfColors: enqNoOfColors || f.noOfColors,
            printType: ((enqPrintType || f.printType) as any),
            topSeal: enqTopSeal,
            bottomSeal: enqBottomSeal,
            sideSeal: enqSideSeal,
            centerSealWidth: enqCenterSeal,
            gusset: enqGusset,
            sideGusset: enqSideGusset,
            seamingArea: enqSeamingArea,
            transparentArea: enqTranspArea,
            secondaryLayers: estimationLayers.length > 0 ? estimationLayers : f.secondaryLayers,
            processes: estimationProcs.length > 0 ? estimationProcs : f.processes,
          } as any));

          setDimValues({
            width: enqJobWidth || undefined,
            height: enqJobHeight || undefined,
            topSeal: enqTopSeal || undefined,
            bottomSeal: enqBottomSeal || undefined,
            sideSeal: enqSideSeal || undefined,
            centerSealWidth: enqCenterSeal || undefined,
            gusset: enqGusset || undefined,
            sideGusset: enqSideGusset || undefined,
            seamingArea: enqSeamingArea || undefined,
            transparentArea: enqTranspArea || undefined,
            layflatWidth: enqJobWidth || undefined,
            cutHeight: enqJobHeight || undefined,
          });
        })
        .catch(() => { /* modal already open with basic order data */ });
    }
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
    const pm = ROTO_PROCESSES_LIVE.find(x => x.id === processId);
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
    const w = wo as any;

    // Restore dimValues from saved WO fields
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

    // Restore Production Prep states from saved data
    setCylinderAllocs(Array.isArray(w.cylinderAllocs) && w.cylinderAllocs.length > 0
      ? w.cylinderAllocs : []);
    setFilmReqs(Array.isArray(w.filmReqs) && w.filmReqs.length > 0
      ? w.filmReqs : []);
    setMaterialAllocs(Array.isArray(w.materialAllocs) && w.materialAllocs.length > 0
      ? w.materialAllocs : []);

    // Restore color shades — mapped into wo.colorShades by mapApiToWO
    const savedShades = Array.isArray(wo.colorShades) ? wo.colorShades as ColorShade[] : [];
    setColorShades(savedShades);

    // Restore saved plan if present (catalog plan or previously saved plan)
    if (w._savedPlanJSON) {
      setCatalogSavedPlan({ ...w._savedPlanJSON, isFromCatalog: true, isSpecial: false, isSpecialSleeve: false });
      setIsPlanApplied(true);
      setShowPlan(false);
    } else {
      setCatalogSavedPlan(null);
      setIsPlanApplied(!!wo.selectedPlanId);
      setShowPlan(false);
    }

    setModalTab("basic");
    setPrepTab("film");
    setModal(true);
  };

  // ── Save ───────────────────────────────────────────────────
  const save = () => {
    if (!form.customerId || !form.machineId) {
      setNotif({ type: "error", title: "Validation Error", msg: "Customer and Machine are required." });
      return;
    }

    // Block save entirely if a special plan is applied — tool must be created in master first
    if (isSelectedPlanSpecial) {
      const toolType = isSelectedPlanSpecialCyl ? "Cylinder" : "Sleeve";
      const toolSize = isSelectedPlanSpecialCyl
        ? (selectedPlan as any)?.cylinderWidthVal
        : (selectedPlan as any)?.sleeveWidthVal;
      setNotif({
        type: "error",
        title: `Cannot Save — Special ${toolType} Required`,
        msg:
          `This plan needs a ${toolType} (${toolSize}mm) that does NOT exist in inventory yet.\n\n` +
          `Steps:\n` +
          `1. Go to Masters → Tools\n` +
          `2. Add the new ${toolType} (${toolSize}mm)\n` +
          `3. Come back and click Replan\n` +
          `4. Select the newly added tool's plan\n` +
          `5. Save the Work Order`,
      });
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
    const planForSave = catalogSavedPlan ?? selectedPlan ?? null;
    const savedPlanJSONStr = planForSave ? JSON.stringify(planForSave) : "";

    const payload = {
      FlagEdit: editing ? "true" : "false",
      JobBookingID: editing ? Number(editing.id) : 0,
      Prefix: apiPrefix,
      ...saveForm,
      customerId: saveForm.customerId,
      ledgerId: saveForm.customerId,
      machineId: Number(saveForm.machineId) || 0,
      operatorId: Number(saveForm.operatorId) || 0,
      categoryId: Number(saveForm.categoryId) || 0,
      orderId: Number(saveForm.orderId) || 0,
      orderBookingDetailsId: orderDetIdRef.current,
      quantity: saveForm.quantity,
      colorShades,
      cylinderAllocs,
      filmReqs,
      materialAllocs,
      savedPlanJSON: savedPlanJSONStr,
      cylAllocsJSON: JSON.stringify(cylinderAllocs),
    };

    setSaving(true);
    apiPost<any>("api/gravureWorkOrderShrink/saveworkorder", payload)
      .then(res => {
        if (res?.success) {
          const newId = String(res.jobBookingId ?? res.id ?? "");
          const newNo = String(res.workOrderNo ?? res.no ?? "");
          setModal(false);
          setReplan(false);
          orderDetIdRef.current = 0;
          // Refresh WO list + orders from API so pending tab updates immediately
          apiGet<any[]>("api/gravureWorkOrderShrink/getworkorders")
            .then(rows => { if (Array.isArray(rows)) setWOs(rows.map(mapApiToWO)); })
            .catch((err: any) => {
              console.error("getworkorders refresh failed:", err?.message || err);
              // Optimistic fallback
              if (editing) {
                setWOs(d => d.map(r => r.id === editing.id
                  ? { ...saveForm, id: editing.id, workOrderNo: editing.workOrderNo }
                  : r));
              } else {
                setWOs(d => [...d, { ...saveForm, id: newId, workOrderNo: newNo }]);
              }
            });
          cacheInvalidate("wo_workorders", "wo_orders");
          apiGet<any>("api/gravureOrderBookingShrink/getorders")
            .then(raw => {
              const rows: any[] = Array.isArray(raw) ? raw : [];
              if (rows.length > 0) setOrders(rows.map(mapApiToOrder));
              else if (!editing && saveForm.orderId)
                setOrders(d => d.filter(o => o.id !== saveForm.orderId));
            })
            .catch(() => {
              if (!editing && saveForm.orderId)
                setOrders(d => d.filter(o => o.id !== saveForm.orderId));
            });
          setNotif({
            type: "success",
            title: editing ? "Work Order Updated" : "Work Order Created",
            msg: res.message || (editing
              ? `Work Order ${editing.workOrderNo} updated successfully. All records saved.`
              : `Work Order ${newNo} created successfully. All records saved.`),
          });
        } else {
          setNotif({
            type: "error",
            title: "Save Failed",
            msg: res?.message || "Server returned an error. No data was saved — transaction rolled back.",
          });
        }
      })
      .catch((err: any) => {
        setNotif({
          type: "error",
          title: "API Error — Work Order NOT Saved",
          msg: (err?.message || String(err)) + "\n\nAll changes have been rolled back. Please try again.",
        });
      })
      .finally(() => setSaving(false));
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
    { key: "noOfColors", header: "Colors", render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "machineName", header: "Machine" },
    { key: "plannedDate", header: "Planned Date" },
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
              <Select label="Unit" value={form.unit} onChange={e => { f("unit", e.target.value); }}
                options={[{ value: "Meter", label: "Meter" }, { value: "Kg", label: "Kg" }, { value: "Pcs", label: "Pcs" }]} />
              <Input label="Planned Date" type="date" value={form.plannedDate} onChange={e => f("plannedDate", e.target.value)} />
              <Select label="Status" value={form.status} onChange={e => f("status", e.target.value as typeof form.status)}
                options={[{ value: "Open", label: "Open" }, { value: "In Progress", label: "In Progress" }, { value: "Completed", label: "Completed" }, { value: "On Hold", label: "On Hold" }]} />
            </div>
          </div>

          {/* ── Pouch Accessories — toggle chips ── */}
          {form.content && getStructureType(form.content) === "Pouch" && (
            <div className="border border-purple-200 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 flex items-center gap-2">
                <Wrench size={14} className="text-white" />
                <p className="text-xs font-bold text-white uppercase tracking-widest">Pouch Accessories &amp; Features</p>
              </div>
              <div className="p-4 bg-purple-50/40">
                <div className="flex flex-wrap gap-2 mb-3">
                  {([
                    { key: "hasZipper",      label: "Zipper",       color: "indigo" },
                    { key: "hasSpout",       label: "Spout",        color: "cyan"   },
                    { key: "hasValve",       label: "Valve",        color: "orange" },
                    { key: "hasWindow",      label: "Window",       color: "sky"    },
                    { key: "hasTearNotch",   label: "Tear Notch",   color: "rose"   },
                    { key: "hasEuroHole",    label: "Euro Hole",    color: "violet" },
                    { key: "hasRoundCorner", label: "Round Corner", color: "teal"   },
                  ] as { key: string; label: string; color: string }[]).map(({ key, label, color }) => {
                    const active = !!((form as any)[key]);
                    const cls: Record<string, string> = {
                      indigo: active ? "bg-indigo-600 text-white border-indigo-600"  : "bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50",
                      cyan:   active ? "bg-cyan-600 text-white border-cyan-600"      : "bg-white text-cyan-600 border-cyan-300 hover:bg-cyan-50",
                      orange: active ? "bg-orange-500 text-white border-orange-500"  : "bg-white text-orange-600 border-orange-300 hover:bg-orange-50",
                      sky:    active ? "bg-sky-600 text-white border-sky-600"        : "bg-white text-sky-600 border-sky-300 hover:bg-sky-50",
                      rose:   active ? "bg-rose-600 text-white border-rose-600"      : "bg-white text-rose-600 border-rose-300 hover:bg-rose-50",
                      violet: active ? "bg-violet-600 text-white border-violet-600"  : "bg-white text-violet-600 border-violet-300 hover:bg-violet-50",
                      teal:   active ? "bg-teal-600 text-white border-teal-600"      : "bg-white text-teal-600 border-teal-300 hover:bg-teal-50",
                    };
                    return (
                      <button key={key} type="button"
                        onClick={() => f(key as any, active ? 0 : 1)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all ${cls[color]}`}>
                        {active && <Check size={11} />}
                        {label}
                      </button>
                    );
                  })}
                </div>
                {((form as any).hasZipper || (form as any).hasSpout) && (
                  <div className="flex flex-wrap gap-4 p-3 bg-white border border-purple-200 rounded-xl">
                    {(form as any).hasZipper ? (
                      <div>
                        <label className="text-[10px] font-semibold text-indigo-600 uppercase block mb-1">Zipper Weight (g)</label>
                        <input type="number" min={0} step={0.1} placeholder="e.g. 2.5"
                          value={(form as any).zipperWeight || ""}
                          onChange={e => f("zipperWeight" as any, parseFloat(e.target.value) || 0)}
                          className="w-28 text-sm border border-indigo-300 rounded-lg px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-400 font-mono" />
                      </div>
                    ) : null}
                    {(form as any).hasSpout ? (
                      <div>
                        <label className="text-[10px] font-semibold text-cyan-600 uppercase block mb-1">Spout Weight (g)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min={0} step={0.1} placeholder="e.g. 8"
                            value={(form as any).spoutWeight || ""}
                            onChange={e => f("spoutWeight" as any, parseFloat(e.target.value) || 0)}
                            className="w-28 text-sm border border-cyan-300 rounded-lg px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-cyan-400 font-mono" />
                          <button type="button" onClick={() => f("spoutWeight" as any, 8)}
                            className="text-[10px] px-2 py-1.5 bg-cyan-100 border border-cyan-300 text-cyan-700 rounded-lg font-bold hover:bg-cyan-200">
                            8g (Std)
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Dimension Setup + Live Diagram (when content type is known) ── */}
          {form.content && CONTENT_TYPE_CONFIG[normalizeContentType(form.content)] && (
            <div className="border border-indigo-200 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 flex items-center gap-2 flex-wrap">
                <Calculator size={14} className="text-white" />
                <p className="text-xs font-bold text-white uppercase tracking-widest">Dimension Setup — {form.content}</p>
                {(form as any).hasZipper      ? <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">Zipper</span> : null}
                {(form as any).hasSpout       ? <span className="px-2 py-0.5 rounded-full bg-cyan-400/80 text-white text-[10px] font-bold">Spout</span> : null}
                {(form as any).hasValve       ? <span className="px-2 py-0.5 rounded-full bg-orange-400/80 text-white text-[10px] font-bold">Valve</span> : null}
                {(form as any).hasTearNotch   ? <span className="px-2 py-0.5 rounded-full bg-rose-400/80 text-white text-[10px] font-bold">Tear Notch</span> : null}
                {(form as any).hasEuroHole    ? <span className="px-2 py-0.5 rounded-full bg-violet-400/80 text-white text-[10px] font-bold">Euro Hole</span> : null}
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
                  const is3Side = c === "Pouch — 3 Side Seal" || c === "3 Side Seal Sachet" || c === "3-Side Seal Sachet - Standard" || c === "3-Side Seal Sachet - Tear Notch";
                  const isCenter = c === "Pouch — Center Seal" || c === "Center Seal Pouch";
                  const isStandup = c === "Standup Pouch" || c === "Stand Up Pouch" || c === "Stand Up Pouch - No Zipper" || c === "Stand Up Pouch - With Zipper" || c === "Stand Up Pouch - With Spout" || c === "Zipper Pouch";
                  const isGusset = c === "Both Side Gusset Pouch" || c === "Gusset Bag" || c === "Gusset Bag - Side Gusset";
                  const isFlatBottom = c === "3D Pouch / Flat Bottom" || c === "Flat Bottom Pouch" || c === "Flat Bottom Pouch - Standard" || c === "Flat Bottom Pouch - With Zipper" || c === "Flat Bottom Pouch - With Valve";
                  if (is3Side || isStandup) lane = jW + 2 * sS;
                  else if (isCenter) lane = jW * 2 + cS;
                  else if (isGusset || isFlatBottom) lane = jW + 2 * sG;
                  if (is3Side || isCenter || isGusset) repeat = jH + tS + bS;
                  else if (isStandup || isFlatBottom) repeat = jH + tS + (gus > 0 ? gus / 2 : 0);
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
                </div>
                {/* Right: live diagram */}
                <DimensionDiagram contentType={normalizeContentType(form.content)} dims={dimValues} />
              </div>
              {/* Unwind Direction — full width */}
              <div className="border-t border-indigo-100 px-4 pt-3 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-widest">Unwind Direction (Pifa)</p>
                      <span className="text-[9px] text-gray-400">AJSW Printing &amp; Winding Chart</span>
                    </div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Printed ACROSS the Roll</p>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      {([
                        { n: 1, label: "Outside · Across\nTop off first" },
                        { n: 2, label: "Inside · Across\nTop off first" },
                        { n: 3, label: "Outside · Across\nBottom off first" },
                        { n: 4, label: "Inside · Across\nBottom off first" },
                      ]).map(({ n, label }) => {
                        const sel = ((form as any).unwindDirection ?? 0) === n;
                        return (
                          <div key={n} className={`relative rounded-xl border-2 overflow-hidden transition-all ${sel ? "border-orange-500 shadow-md" : "border-gray-200 hover:border-orange-300"}`}>
                            <button type="button" onClick={() => setForm(p => ({ ...p, unwindDirection: n } as any))} title={label.replace("\n", " ")} className="w-full block">
                              <img src={`/images/Unwind_Direction_${n}.png`} alt={`Direction ${n}`} className={`w-full h-40 object-contain ${sel ? "bg-orange-50" : "bg-gray-50"}`} />
                              <div className={`px-1 pb-2 pt-1 flex flex-col items-center gap-0.5 ${sel ? "bg-orange-50" : "bg-white"}`}>
                                <span className={`text-[12px] font-black leading-none ${sel ? "text-orange-600" : "text-gray-700"}`}>#{n}</span>
                                <span className={`text-[7.5px] font-medium text-center leading-tight whitespace-pre-line ${sel ? "text-orange-500" : "text-gray-400"}`}>{label}</span>
                              </div>
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setUnwindPreview(n); }}
                              className="absolute top-1.5 right-1.5 p-1 rounded-md bg-white/90 hover:bg-orange-100 border border-gray-200 hover:border-orange-300 transition-all shadow-sm"
                              title="Preview full size">
                              <Eye size={11} className="text-gray-500 hover:text-orange-500" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Printed WITH the Roll</p>
                    <div className="grid grid-cols-4 gap-3">
                      {([
                        { n: 5, label: "Outside · With Roll\nRight off first" },
                        { n: 6, label: "Inside · With Roll\nRight off first" },
                        { n: 7, label: "Outside · With Roll\nLeft off first" },
                        { n: 8, label: "Inside · With Roll\nLeft off first" },
                      ]).map(({ n, label }) => {
                        const sel = ((form as any).unwindDirection ?? 0) === n;
                        return (
                          <div key={n} className={`relative rounded-xl border-2 overflow-hidden transition-all ${sel ? "border-orange-500 shadow-md" : "border-gray-200 hover:border-orange-300"}`}>
                            <button type="button" onClick={() => setForm(p => ({ ...p, unwindDirection: n } as any))} title={label.replace("\n", " ")} className="w-full block">
                              <img src={`/images/Unwind_Direction_${n}.png`} alt={`Direction ${n}`} className={`w-full h-40 object-contain ${sel ? "bg-orange-50" : "bg-gray-50"}`} />
                              <div className={`px-1 pb-2 pt-1 flex flex-col items-center gap-0.5 ${sel ? "bg-orange-50" : "bg-white"}`}>
                                <span className={`text-[12px] font-black leading-none ${sel ? "text-orange-600" : "text-gray-700"}`}>#{n}</span>
                                <span className={`text-[7.5px] font-medium text-center leading-tight whitespace-pre-line ${sel ? "text-orange-500" : "text-gray-400"}`}>{label}</span>
                              </div>
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setUnwindPreview(n); }}
                              className="absolute top-1.5 right-1.5 p-1 rounded-md bg-white/90 hover:bg-orange-100 border border-gray-200 hover:border-orange-300 transition-all shadow-sm"
                              title="Preview full size">
                              <Eye size={11} className="text-gray-500 hover:text-orange-500" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {/* ── Full-size image preview modal ── */}
                    {unwindPreview !== null && (
                      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setUnwindPreview(null)}>
                        <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-sm font-bold text-gray-800">Direction #{unwindPreview}</p>
                              <p className="text-xs text-gray-400">{[
                                "Outside · Across · Top off first",
                                "Inside · Across · Top off first",
                                "Outside · Across · Bottom off first",
                                "Inside · Across · Bottom off first",
                                "Outside · With Roll · Right off first",
                                "Inside · With Roll · Right off first",
                                "Outside · With Roll · Left off first",
                                "Inside · With Roll · Left off first",
                              ][unwindPreview - 1]}</p>
                            </div>
                            <button type="button" onClick={() => setUnwindPreview(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all">
                              <X size={16} />
                            </button>
                          </div>
                          <img src={`/images/Unwind_Direction_${unwindPreview}.png`} alt={`Direction ${unwindPreview}`} className="w-full h-auto object-contain rounded-lg border border-gray-100" />
                          <button type="button" onClick={() => { setForm(p => ({ ...p, unwindDirection: unwindPreview } as any)); setUnwindPreview(null); }}
                            className="mt-3 w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all">
                            Select Direction #{unwindPreview}
                          </button>
                        </div>
                      </div>
                    )}
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
                      {["Process", ""].map(h => (
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
                            {ROTO_PROCESSES_LIVE.map(pm => <option key={pm.id} value={pm.id}>{pm.name} ({pm.department})</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 w-8 text-center"><button onClick={() => removeProcess(i)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><X size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
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
                                const subGroups = ci.itemGroup
                                  ? (apiConsumableSubGroups[ci.itemGroup]?.length
                                      ? apiConsumableSubGroups[ci.itemGroup]
                                      : CATEGORY_GROUP_SUBGROUP["Raw Material (RM)"]?.[ci.itemGroup] ?? [])
                                  : [];
                                const filteredApiItems = apiInkItems
                                  .filter(it => normalizeConsumableGroup(it.ItemGroupName) === ci.itemGroup && (!ci.itemSubGroup || it.ItemSubGroupName === ci.itemSubGroup))
                                  .filter((it, idx, arr) => arr.findIndex(x => String(x.ItemID) === String(it.ItemID)) === idx);
                                const filteredStaticItems = items.filter(it => it.group === ci.itemGroup && it.active && (!ci.itemSubGroup || it.subGroup === ci.itemSubGroup));
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
                                            const apiIt = filteredApiItems.find(x => String(x.ItemID) === e.target.value);
                                            const staticIt = filteredStaticItems.find(x => x.id === e.target.value);
                                            const patch: Record<string, unknown> = {
                                              itemId:   e.target.value,
                                              itemName: apiIt?.ItemName ?? staticIt?.name ?? "",
                                            };
                                            if (ci.itemGroup === "Ink" && apiIt) {
                                              patch.gsm = parseFloat(String(apiIt.DryGsM ?? 0)) || 0;
                                              patch.solidPct = parseFloat(String(apiIt.SolidPerc ?? 40)) || 40;
                                            }
                                            updatePlyConsumable(index, ciIdx, patch);
                                          }}
                                          disabled={!ci.itemGroup}>
                                          <option value="">-- Select Item --</option>
                                          {filteredApiItems.length > 0
                                            ? filteredApiItems.map(it => <option key={it.ItemID} value={String(it.ItemID)}>{it.ItemName}</option>)
                                            : filteredStaticItems.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
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
                    <button onClick={() => { setIsPlanApplied(false); setShowPlan(true); setCatalogSavedPlan(null); }} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg border border-gray-200">
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
                        {form.machineName} · {catalogSavedPlan ? "1 plan (from catalog)" : `${visiblePlans.length}/${allPlans.length} plans`}
                        {!catalogSavedPlan && Object.keys(planColFilters).length > 0 && (
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
                      const selP = (catalogSavedPlan?.planId === form.selectedPlanId ? catalogSavedPlan : allPlans.find(p => p.planId === form.selectedPlanId)) as any;
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
                    const filmGsmFilm = form.secondaryLayers[0]?.gsm ?? 0;
                    const reqSQM = (form.unit === "Kg" && filmGsmFilm > 0)
                      ? (form.quantity * 1000) / filmGsmFilm
                      : form.quantity * ((form.jobWidth || 0) / 1000);
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
                                        {(dbVendors.length > 0 ? dbVendors : VENDOR_LEDGERS).map(v => (
                                          <option key={v.id} value={v.name}>{v.name}</option>
                                        ))}
                                        {req.vendor && !(dbVendors.length > 0 ? dbVendors : VENDOR_LEDGERS).some(v => v.name === req.vendor) && (
                                          <option value={req.vendor}>{req.vendor}</option>
                                        )}
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
                      {["#", "Ink Item (Master)", "Color Name", "Remarks"].map(h => (
                        <th key={h} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {colorShades.map((cs, i) => (
                        <tr key={i} className="hover:bg-purple-50/20">
                          <td className="px-2 py-1.5 text-center font-black text-purple-700">{cs.colorNo}</td>
                          <td className="px-2 py-1.5 min-w-[180px]">
                            <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                              value={(cs as any).inkItemId ?? ""}
                              onChange={e => {
                                const ink = INK_ITEMS_LIVE.find(x => x.id === e.target.value);
                                setColorShades(p => p.map((c, ci) => ci === i ? {
                                  ...c,
                                  inkItemId: ink?.id ?? "",
                                  colorName: ink?.colour || ink?.name || c.colorName,
                                } as any : c));
                              }}>
                              <option value="">-- Select Ink --</option>
                              {INK_ITEMS_LIVE.map(ink => <option key={ink.id} value={ink.id}>{ink.name}{ink.colour ? ` (${ink.colour})` : ""}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5"><input className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.colorName} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, colorName: e.target.value } : c))} /></td>
                          <td className="px-2 py-1.5"><input placeholder="Notes…" className="w-36 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.remarks} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} /></td>
                        </tr>
                      ))}
                    {colorShades.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-gray-400 text-xs">No colors. Set No. of Colors in Basic Info tab first.</td></tr>
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
                      {["Ply", "Type", "Item (Master)", "Req. Qty", "Alloc. Qty", "Unit", "Batch No.", "Bin / Location", "Status", "Action"].map(h => (
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
                              onChange={async e => {
                                const it = itemsForType.find(x => x.id === e.target.value);
                                setMaterialAllocs(p => p.map((m, mi) => mi === i ? { ...m, itemId: it?.id ?? "", materialName: it?.name ?? m.materialName, batchId: "", lotNo: "", location: "" } as any : m));
                                setBatchOptions(p => ({ ...p, [ma.id]: [] }));
                                setBinOptions(p => ({ ...p, [ma.id]: [] }));
                                if (e.target.value) {
                                  try {
                                    const res = await apiGet<any[]>(`api/gravureWorkOrderShrink/getbatchesbyitem?itemId=${e.target.value}`);
                                    setBatchOptions(p => ({ ...p, [ma.id]: Array.isArray(res) ? res : [] }));
                                  } catch { /* ignore */ }
                                }
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
                          <td className="px-2 py-1.5 min-w-[140px]">
                            <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                              value={(ma as any).batchId ?? ""}
                              onChange={async e => {
                                const batch = (batchOptions[ma.id] || []).find((b: any) => String(b.BatchID) === e.target.value);
                                setMaterialAllocs(p => p.map((m, mi) => mi === i ? { ...m, batchId: e.target.value, lotNo: batch?.BatchNo ?? e.target.value, location: "" } as any : m));
                                setBinOptions(p => ({ ...p, [ma.id]: [] }));
                                if (e.target.value) {
                                  try {
                                    const res = await apiGet<any[]>(`api/gravureWorkOrderShrink/getbinsbybatch?batchId=${e.target.value}`);
                                    setBinOptions(p => ({ ...p, [ma.id]: Array.isArray(res) ? res : [] }));
                                  } catch { /* ignore */ }
                                }
                              }}>
                              <option value="">{ma.lotNo || "-- Select Batch --"}</option>
                              {(batchOptions[ma.id] || []).map((b: any) => (
                                <option key={b.BatchID} value={String(b.BatchID)}>{b.BatchNo}{b.SupplierBatchNo ? ` (${b.SupplierBatchNo})` : ""}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 min-w-[130px]">
                            <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                              value={ma.location}
                              onChange={e => setMaterialAllocs(p => p.map((m, mi) => mi === i ? { ...m, location: e.target.value } : m))}>
                              <option value="">{ma.location || "-- Select Bin --"}</option>
                              {(binOptions[ma.id] || []).map((b: any) => (
                                <option key={b.BinID} value={b.WarehouseName + (b.BinName ? ` / ${b.BinName}` : "")}>{b.WarehouseName}{b.BinName ? ` / ${b.BinName}` : ""}</option>
                              ))}
                            </select>
                          </td>
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
                          {(() => {
                            const allToolsRaw = [...(dbCylinders.length > 0 ? dbCylinders as any[] : CYLINDER_TOOLS_ALL), ...extraCyls];
                            const currentToolId = String((ca as any).toolId ?? "");
                            // Deduplicate by code — prefer the entry whose id matches currentToolId, then highest remaining life
                            const seenCodes = new Map<string, any>();
                            allToolsRaw.forEach(t => {
                              const existing = seenCodes.get(t.code);
                              if (!existing) { seenCodes.set(t.code, t); return; }
                              // If current alloc's toolId matches this entry, always prefer it
                              if (t.id === currentToolId) { seenCodes.set(t.code, t); return; }
                              if (existing.id === currentToolId) return; // keep existing if it matches
                              const remNew = t.shelfLifeMeters ? t.shelfLifeMeters - (t.usedMeters ?? 0) : 0;
                              const remOld = existing.shelfLifeMeters ? existing.shelfLifeMeters - (existing.usedMeters ?? 0) : 0;
                              if (remNew > remOld) seenCodes.set(t.code, t);
                            });
                            const dedupedTools = Array.from(seenCodes.values()).sort((a, b) => a.code.localeCompare(b.code));
                            return (
                              <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-amber-400"
                                value={currentToolId}
                                onChange={e => {
                                  const tool = allToolsRaw.find(t => t.id === e.target.value);
                                  setCylinderAllocs(p => p.map((c, ci) => ci === i ? {
                                    ...c,
                                    toolId: tool?.id ?? "",
                                    cylinderNo: tool?.code ?? c.cylinderNo,
                                    circumference: selectedPlan ? String(selectedPlan.cylCirc) : ((tool as any)?.repeatLength ? String((tool as any).repeatLength) : c.circumference),
                                  } as any : c));
                                }}>
                                <option value="">{ca.cylinderNo || "-- Select Cylinder --"}</option>
                                {dedupedTools.map(t => {
                                  const circ = t.circumferenceMM || t.repeatLength || "";
                                  return <option key={t.id} value={t.id}>{t.code}{circ ? ` (${circ}mm)` : ""}</option>;
                                })}
                              </select>
                            );
                          })()}
                          {/* ── Cylinder Life Info + Check ── */}
                          {(() => {
                            const toolId = (ca as any).toolId;
                            if (!toolId) return null;
                            const tool = [...(dbCylinders.length > 0 ? dbCylinders as any[] : CYLINDER_TOOLS_ALL), ...extraCyls].find(t => t.id === toolId);
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
            <Button icon={saving ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={14} />}
              onClick={save} variant={isSelectedPlanSpecial ? "danger" : "primary"}
              disabled={saving}>
              {saving ? "Saving…" : editing ? "Update Work Order" : isSelectedPlanSpecial ? "⚠ Cannot Save — Create Tool First" : "Create Work Order"}
            </Button>
          </div>
        </div>
      )}

    </div>
  );

  return (
    <div className="h-full overflow-hidden flex flex-col -m-4 md:-m-6 lg:-m-7">

      {/* ══ CONTENT AREA ══════════════════════════════════════════ */}
      <div className="flex-1 overflow-hidden flex flex-col">

      {/* ── Tab switcher snippet (reused in both toolbar slots) ── */}
      {/* ── PENDING ORDERS TAB ─────────────────────────────────── */}
      {pageTab === "pending" && (
        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
          {/* Toolbar row — mirrors DataTable search-bar row */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 flex-1 sm:max-w-xs shadow-sm">
              <Clock size={14} className="text-orange-500 flex-shrink-0" />
              <span className="text-sm text-gray-400 select-none">Pending orders</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5">
                <button onClick={() => setPageTab("pending")}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap bg-white shadow text-orange-600">
                  <Clock size={12} />Pending
                  {stats.pending > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600">{stats.pending}</span>}
                </button>
                <button onClick={() => setPageTab("workorders")}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap text-gray-500 hover:text-gray-700">
                  <Printer size={12} />Work Orders
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600">{workOrders.length}</span>
                </button>
              </div>
              {[
                { label: "Open",        val: stats.open,       cls: "bg-gray-100 text-gray-600" },
                { label: "In Progress", val: stats.inProgress, cls: "bg-yellow-100 text-yellow-700" },
                { label: "Completed",   val: stats.completed,  cls: "bg-green-100 text-green-700" },
              ].map(s => (
                <span key={s.label} className={`hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>
                  {s.label} {s.val}
                </span>
              ))}
            </div>
          </div>
          {/* List container */}
          <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          {pendingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <CheckCircle2 size={36} className="text-green-400 mb-3" />
              <p className="font-semibold text-gray-600">All orders have work orders!</p>
              <p className="text-sm mt-1">No pending orders waiting for production planning.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingOrders.map(order => (
                <div key={order.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                      ${order.sourceType === "Estimation" ? "bg-blue-100" : order.sourceType === "Catalog" ? "bg-purple-100" : "bg-gray-100"}`}>
                      {order.sourceType === "Estimation" ? <Calculator size={14} className="text-blue-600" />
                        : order.sourceType === "Catalog" ? <BookMarked size={14} className="text-purple-600" />
                          : <Edit3 size={14} className="text-gray-500" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-800 text-sm truncate">{order.jobName}</p>
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0">{order.orderNo}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                      <span>{order.customerName}</span>
                      {order.substrate && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px]">{order.substrate}</span>}
                      <span>{order.noOfColors}C · {order.printType}</span>
                      <span>{order.quantity.toLocaleString()} {order.unit}</span>
                      {order.deliveryDate && <span className="text-orange-600 font-medium">Due: {order.deliveryDate}</span>}
                      {order.sourceType === "Estimation" && order.processes.length > 0 && (
                        <span className="text-green-600">{order.processes.length} processes</span>
                      )}
                    </div>
                  </div>
                  {order.totalAmount > 0 && (
                    <div className="flex-shrink-0 text-right hidden sm:block">
                      <p className="text-[10px] text-gray-400">Amount</p>
                      <p className="font-bold text-gray-800 text-xs">₹{order.totalAmount.toLocaleString()}</p>
                    </div>
                  )}
                  <div className="flex-shrink-0">
                    <Button size="sm" icon={<ArrowRight size={13} />} onClick={() => convertToWO(order)}>
                      Create WO
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* ── WORK ORDERS TAB ────────────────────────────────────── */}
      {pageTab === "workorders" && (
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          <DataTable
            data={workOrders}
            columns={woColumns}
            searchKeys={["workOrderNo", "customerName", "jobName", "machineName"]}
            initialSearch={initSearch}
            stickyHeader
            scrollContainerClass="flex-1"
            toolbar={
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5">
                  <button onClick={() => setPageTab("pending")}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap text-gray-500 hover:text-gray-700">
                    <Clock size={12} />Pending
                    {stats.pending > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600">{stats.pending}</span>}
                  </button>
                  <button onClick={() => setPageTab("workorders")}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap bg-white shadow text-purple-700">
                    <Printer size={12} />Work Orders
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">{workOrders.length}</span>
                  </button>
                </div>
                {[
                  { label: "Open",        val: stats.open,       cls: "bg-gray-100 text-gray-600" },
                  { label: "In Progress", val: stats.inProgress, cls: "bg-yellow-100 text-yellow-700" },
                  { label: "Completed",   val: stats.completed,  cls: "bg-green-100 text-green-700" },
                ].map(s => (
                  <span key={s.label} className={`hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>
                    {s.label} {s.val}
                  </span>
                ))}
                <TutorialButton title="Work Order — Tutorial" />
              </div>
            }
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

      </div>

      {/* ══ CREATE / EDIT MODAL ═══════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => {
        setModal(false); setCatalogSavedPlan(null); setEditing(null);
        setFilmReqs([]); setColorShades([]); setMaterialAllocs([]); setCylinderAllocs([]);
        setIsPlanApplied(false); setShowPlan(false);
        orderDetIdRef.current = 0;
      }}
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
                      {["Process", ""].map(h => (
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
                            {ROTO_PROCESSES_LIVE.map(pm => <option key={pm.id} value={pm.id}>{pm.name} ({pm.department})</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 w-8 text-center"><button onClick={() => removeProcess(i)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><X size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
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
          <Button icon={saving ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing && woHasSpecialPlan(editing) && !isSelectedPlanSpecial && isPlanApplied ? "Activate & Save" : "Save Replan"}
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
        const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        const companyName = (typeof window !== "undefined" ? localStorage.getItem("companyName") : null) || "Company";

        const woCyls: any[] = Array.isArray((wo as any).cylAllocsJSON) ? (wo as any).cylAllocsJSON
          : Array.isArray((wo as any).savedCylAllocs) ? (wo as any).savedCylAllocs
          : Array.isArray(wo.cylinderAllocs) ? wo.cylinderAllocs : [];

        const qrData = JSON.stringify({ wo: wo.workOrderNo, job: wo.jobName, cyls: woCyls.map((c: any) => ({ no: c.colorNo, code: c.cylinderNo || c.code || "" })).filter((c: any) => c.code) });

        const allInks = wo.secondaryLayers.flatMap(l =>
          l.consumableItems.filter(ci => ci.itemGroup === "Ink").map(ci => ({ ...ci, plyType: l.plyType, plyNo: l.layerNo }))
        );
        const allSolvents = wo.secondaryLayers.flatMap(l =>
          l.consumableItems.filter(ci => ci.itemGroup === "Solvent").map(ci => ({ ...ci, plyType: l.plyType, plyNo: l.layerNo }))
        );
        const allAdhesives = wo.secondaryLayers.flatMap(l =>
          l.consumableItems.filter(ci => ci.itemGroup === "Adhesive" || ci.itemGroup === "Hardner").map(ci => ({ ...ci, plyType: l.plyType, plyNo: l.layerNo }))
        );
        const filmLayers = wo.secondaryLayers.filter(l => l.itemSubGroup);

        const reqMtr = wo.quantity || 0;
        const woFilmGsm = wo.secondaryLayers[0]?.gsm ?? 0;
        const woPlanFilmWidth: number = (wo as any)._savedPlanJSON?.filmSize || 0;
        const woFilmWidth = woPlanFilmWidth > 0 ? woPlanFilmWidth : (wo.jobWidth || 0);
        const reqSQM = (wo.unit === "Kg" && woFilmGsm > 0)
          ? (reqMtr * 1000) / woFilmGsm
          : reqMtr * (woFilmWidth / 1000);
        const waste = (wo.wastagePct ?? 3) / 100;
        const totalFilmReq = reqMtr * (1 + waste);

        // Build per-color-station rows: cylinder + matched ink by index
        type ColorStation = { colorNo: number; colorName: string; cylCode: string; circ: string; cylType: string; cylStatus: string; inkName: string; dryGSM: number; liqGSM: number; reqWtKg: number; };
        const colorStations: ColorStation[] = (() => {
          if (woCyls.length > 0) {
            return woCyls.map((c: any, i: number) => {
              const ink = allInks[i];
              const dryGSM = ink?.gsm ?? 0;
              const solidPct = ink?.solidPct ?? 40;
              const liqGSM = dryGSM > 0 && solidPct > 0 ? parseFloat((dryGSM / (solidPct / 100)).toFixed(2)) : 0;
              const reqWtKg = dryGSM > 0 ? parseFloat(((dryGSM / 1000) * reqSQM * (1 + waste)).toFixed(3)) : 0;
              return { colorNo: c.colorNo ?? i + 1, colorName: c.colorName || `Color ${i + 1}`, cylCode: c.cylinderNo || c.code || "—", circ: String(c.circumference || "—"), cylType: c.cylinderType || "—", cylStatus: c.status || "—", inkName: ink?.itemName || ink?.fieldDisplayName || "—", dryGSM, liqGSM, reqWtKg };
            });
          }
          return allInks.map((ink, i) => {
            const dryGSM = ink.gsm ?? 0;
            const solidPct = ink.solidPct ?? 40;
            const liqGSM = dryGSM > 0 && solidPct > 0 ? parseFloat((dryGSM / (solidPct / 100)).toFixed(2)) : 0;
            const reqWtKg = dryGSM > 0 ? parseFloat(((dryGSM / 1000) * reqSQM * (1 + waste)).toFixed(3)) : 0;
            return { colorNo: i + 1, colorName: ink.fieldDisplayName || ink.itemName || `Color ${i + 1}`, cylCode: "—", circ: "—", cylType: "—", cylStatus: "—", inkName: ink.itemName || "—", dryGSM, liqGSM, reqWtKg };
          });
        })();

        const totalInkKg  = colorStations.reduce((s, r) => s + r.reqWtKg, 0);
        const totalSolvKg = allSolvents.reduce((s, ci) => s + (ci.gsm > 0 ? (ci.gsm / 1000) * reqSQM * (1 + waste) : 0), 0);
        const totalAdhKg  = allAdhesives.filter(ci => ci.itemGroup === "Adhesive").reduce((s, ci) => s + (ci.gsm > 0 ? (ci.gsm / 1000) * reqSQM * (1 + waste) : 0), 0);
        const totalHrdKg  = allAdhesives.filter(ci => ci.itemGroup === "Hardner").reduce((s, ci) => s + (ci.gsm > 0 ? (ci.gsm / 1000) * reqSQM * (1 + waste) : 0), 0);

        const PRINT_CSS = `*{margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif;}body{padding:8mm 10mm;color:#000;background:#fff;font-size:8pt;}table{width:100%;border-collapse:collapse;}td,th{border:1px solid #999;padding:2px 4px;vertical-align:middle;color:#000;}th{background:#efefef;font-weight:700;text-align:left;white-space:nowrap;font-size:6pt;text-transform:uppercase;}@media print{body{padding:7mm 8mm;}@page{margin:6mm;size:A4 portrait;}}`;

        const handlePrint = () => {
          const el = document.getElementById("wo-job-card-print");
          if (!el) return;
          const pw = window.open("", "_blank", "width=1050,height=820");
          if (!pw) return;
          pw.document.write(`<!DOCTYPE html><html><head><title>Work Order — ${wo.workOrderNo}</title><style>${PRINT_CSS}</style></head><body>${el.innerHTML}</body></html>`);
          pw.document.close();
          pw.focus();
          setTimeout(() => { pw.print(); }, 400);
        };

        const PH: React.CSSProperties = { background: "#fff", color: "#000", fontWeight: 900, fontSize: "7.5pt", letterSpacing: "0.5px", padding: "2px 0", textTransform: "uppercase", borderBottom: "2px solid #000", marginTop: "4px", marginBottom: "2px", display: "block" };
        const TH: React.CSSProperties = { padding: "2px 4px", border: "1px solid #999", background: "#efefef", fontWeight: 700, fontSize: "6pt", textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap", color: "#000" };
        const TD: React.CSSProperties = { padding: "2px 4px", border: "1px solid #bbb", fontSize: "7.5pt", verticalAlign: "middle", color: "#000" };

        return (
          <>
            <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={() => setPrintWO(null)} />
            <div className="fixed z-[71] inset-2 sm:inset-6 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Printer size={17} className="text-orange-400" />
                  <span className="font-bold text-sm">Work Order — {wo.workOrderNo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${wo.status === "Completed" ? "bg-green-600" : wo.status === "In Progress" ? "bg-yellow-600" : wo.status === "On Hold" ? "bg-red-600" : "bg-gray-600"}`}>{wo.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm font-bold rounded-xl transition">
                    <Printer size={14} /> Print Job Card
                  </button>
                  <button onClick={() => setPrintWO(null)} className="p-2 hover:bg-white/10 rounded-lg transition"><X size={16} /></button>
                </div>
              </div>

              {/* A4 Preview */}
              <div className="flex-1 overflow-auto bg-slate-200 p-6">
                <div id="wo-job-card-print" className="bg-white mx-auto shadow-xl"
                  style={{ width: "210mm", minHeight: "297mm", padding: "8mm 10mm", fontFamily: "Arial, sans-serif", fontSize: "8pt", color: "#000" }}>

                  {/* ── HEADER ── */}
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px", border: "2px solid #000" }}>
                    <tbody>
                      <tr>
                        <td style={{ border: "none", borderRight: "1px solid #000", padding: "5px 8px", width: "35%", verticalAlign: "middle" }}>
                          <div style={{ fontSize: "14pt", fontWeight: 900, color: "#000", letterSpacing: "0.5px", lineHeight: 1.1 }}>{companyName}</div>
                          <div style={{ fontSize: "6.5pt", color: "#000", fontWeight: 700, marginTop: "2px" }}>FLEXIBLE PACKAGING · GRAVURE PRINTING</div>
                        </td>
                        <td style={{ border: "none", borderRight: "1px solid #000", textAlign: "center", padding: "5px 8px", width: "28%", verticalAlign: "middle" }}>
                          <div style={{ fontSize: "13pt", fontWeight: 900, color: "#000", letterSpacing: "1px", textTransform: "uppercase" as const, lineHeight: 1.1 }}>PRODUCTION WORK ORDER</div>
                          <div style={{ fontSize: "6.5pt", color: "#444", marginTop: "3px", fontWeight: 600 }}>GRAVURE MODULE · SHOP FLOOR JOB CARD</div>
                        </td>
                        <td style={{ border: "none", padding: "5px 8px", width: "37%", verticalAlign: "top" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <table style={{ flex: 1, borderCollapse: "collapse" }}>
                              <tbody>
                                {[["WO Number", wo.workOrderNo], ["WO Date", today], ["Order Ref", wo.orderNo || "Direct"], ["Planned Date", wo.plannedDate || "—"], ["Status", wo.status]].map(([k, v]) => (
                                  <tr key={k}><td style={{ border: "none", padding: "1px 0", fontSize: "7pt", fontWeight: 700, whiteSpace: "nowrap" as const }}>{k}</td><td style={{ border: "none", padding: "1px 2px", fontSize: "7pt" }}>: {v}</td></tr>
                                ))}
                              </tbody>
                            </table>
                            <div style={{ marginLeft: "8px", flexShrink: 0 }}>
                              <QRCodeSVG value={qrData} size={56} level="M" />
                              <div style={{ fontSize: "5pt", textAlign: "center", color: "#555", marginTop: "1px" }}>{wo.workOrderNo}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* ── A · JOB IDENTITY ── */}
                  <span style={PH}>A · Job Identity</span>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "3px" }}>
                    <tbody>
                      <tr>
                        <th style={{ ...TH, width: "11%" }}>Customer</th>
                        <td style={{ ...TD, fontWeight: 800, fontSize: "8.5pt", width: "22%" }}>{wo.customerName || "—"}</td>
                        <th style={{ ...TH, width: "11%" }}>Job Name</th>
                        <td style={{ ...TD, fontWeight: 800, fontSize: "8.5pt", width: "22%" }}>{wo.jobName || "—"}</td>
                        <th style={{ ...TH, width: "11%" }}>Category</th>
                        <td style={TD}>{wo.categoryName || "—"}</td>
                      </tr>
                      <tr>
                        <th style={TH}>Machine</th>
                        <td style={{ ...TD, fontWeight: 700 }}>{wo.machineName || "—"}</td>
                        <th style={TH}>Operator</th>
                        <td style={TD}>{wo.operatorName || "—"}</td>
                        <th style={TH}>Sales Person</th>
                        <td style={TD}>{wo.salesPerson || "—"}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* ── B · PRODUCT SPECIFICATION ── */}
                  <span style={PH}>B · Product Specification</span>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "3px" }}>
                    <tbody>
                      <tr>
                        <th style={{ ...TH, width: "11%" }}>Structure Type</th>
                        <td style={{ ...TD, width: "14%" }}>{wo.structureType || "—"}</td>
                        <th style={{ ...TH, width: "9%" }}>Content</th>
                        <td style={{ ...TD, width: "14%" }}>{wo.content || "—"}</td>
                        <th style={{ ...TH, width: "9%" }}>Print Type</th>
                        <td style={{ ...TD, width: "11%" }}>{wo.printType || "—"}</td>
                        <th style={{ ...TH, width: "5%" }}>UPS</th>
                        <td style={{ ...TD, textAlign: "center", width: "7%" }}>{wo.ups || 1}</td>
                        <th style={{ ...TH, width: "8%" }}>Unwind Dir.</th>
                        <td style={{ ...TD, textAlign: "center" }}>{wo.unwindDirection === 1 ? "Bottom" : wo.unwindDirection === 2 ? "Top" : "—"}</td>
                      </tr>
                      <tr>
                        <th style={TH}>Job W×H (mm)</th>
                        <td style={{ ...TD, fontWeight: 700 }}>{wo.jobWidth}×{wo.jobHeight}</td>
                        <th style={TH}>Film Width (mm)</th>
                        <td style={{ ...TD, fontWeight: 700 }}>{woFilmWidth || "—"}</td>
                        <th style={TH}>Colors (F+B)</th>
                        <td style={{ ...TD, fontWeight: 700 }}>{wo.noOfColors}C ({wo.frontColors}F+{wo.backColors}B)</td>
                        <th style={TH}>Trimming</th>
                        <td style={{ ...TD, textAlign: "center" }}>{wo.trimmingSize ? `${wo.trimmingSize}mm` : "—"}</td>
                        <th style={TH}>Width Shrink</th>
                        <td style={{ ...TD, textAlign: "center" }}>{wo.widthShrinkage ? `${wo.widthShrinkage}mm` : "—"}</td>
                      </tr>
                      <tr>
                        <th style={TH}>Order Qty</th>
                        <td style={{ ...TD, fontWeight: 800 }}>{Number(wo.quantity || 0).toLocaleString("en-IN")} {wo.unit}</td>
                        <th style={TH}>Wastage %</th>
                        <td style={TD}>{wo.wastagePct ?? 3}%</td>
                        <th style={TH}>Total Film Req.</th>
                        <td style={{ ...TD, fontWeight: 700 }}>{totalFilmReq.toLocaleString("en-IN", { maximumFractionDigits: 0 })} {wo.unit}</td>
                        <th style={TH}>Final Roll OD</th>
                        <td style={{ ...TD, textAlign: "center" }}>{wo.finalRollOD ? `${wo.finalRollOD}mm` : "—"}</td>
                        <th style={TH}>Source</th>
                        <td style={TD}>{wo.sourceOrderType || "Direct"}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* ── C · PLY STRUCTURE ── */}
                  {filmLayers.length > 0 && (
                    <>
                      <span style={PH}>C · Film / Ply Structure</span>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "3px", tableLayout: "fixed" as const }}>
                        <colgroup>
                          <col style={{ width: "6%" }} /><col style={{ width: "14%" }} /><col style={{ width: "28%" }} />
                          <col style={{ width: "10%" }} /><col style={{ width: "8%" }} /><col style={{ width: "10%" }} />
                          <col style={{ width: "10%" }} /><col style={{ width: "14%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th style={{ ...TH, textAlign: "center" as const }}>Ply #</th>
                            <th style={TH}>Type</th>
                            <th style={TH}>Film / Material</th>
                            <th style={{ ...TH, textAlign: "center" as const }}>Thickness (μ)</th>
                            <th style={{ ...TH, textAlign: "center" as const }}>GSM</th>
                            <th style={{ ...TH, textAlign: "right" as const }}>Req. SQM</th>
                            <th style={{ ...TH, textAlign: "right" as const }}>Rate (₹/Kg)</th>
                            <th style={{ ...TH, textAlign: "right" as const }}>Req. Wt. (Kg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filmLayers.map((l, li) => {
                            const reqWt = l.gsm > 0 ? ((l.gsm / 1000) * reqSQM * (1 + waste)) : 0;
                            return (
                              <tr key={l.id ?? l.layerNo ?? li} style={{ background: li % 2 === 0 ? "#fff" : "#f5f5f5" }}>
                                <td style={{ ...TD, textAlign: "center", fontWeight: 700 }}>{l.layerNo}</td>
                                <td style={TD}>{l.plyType}</td>
                                <td style={{ ...TD, fontWeight: 700 }}>{l.itemSubGroup || l.itemName || "—"}</td>
                                <td style={{ ...TD, textAlign: "center" }}>{l.thickness || "—"}</td>
                                <td style={{ ...TD, textAlign: "center" }}>{l.gsm || "—"}</td>
                                <td style={{ ...TD, textAlign: "right" }}>{reqSQM > 0 ? reqSQM.toFixed(2) : "—"}</td>
                                <td style={{ ...TD, textAlign: "right" }}>{l.filmRate ? `₹${l.filmRate}` : "—"}</td>
                                <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{reqWt > 0 ? reqWt.toFixed(2) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* ── D · COLOR STATION PLAN (Cylinder + Ink per station) ── */}
                  {colorStations.length > 0 && (
                    <>
                      <span style={PH}>D · Color Station Plan (Cylinder + Ink)</span>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "3px", tableLayout: "fixed" as const }}>
                        <colgroup>
                          <col style={{ width: "5%" }} /><col style={{ width: "13%" }} /><col style={{ width: "12%" }} />
                          <col style={{ width: "9%" }} /><col style={{ width: "9%" }} /><col style={{ width: "9%" }} />
                          <col style={{ width: "20%" }} /><col style={{ width: "7%" }} /><col style={{ width: "8%" }} /><col style={{ width: "8%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th style={{ ...TH, textAlign: "center" as const }}>Clr #</th>
                            <th style={TH}>Color Name</th>
                            <th style={TH}>Cylinder Code</th>
                            <th style={{ ...TH, textAlign: "center" as const }}>Circ. (mm)</th>
                            <th style={TH}>Cyl. Type</th>
                            <th style={TH}>Cyl. Status</th>
                            <th style={TH}>Ink Item</th>
                            <th style={{ ...TH, textAlign: "center" as const }}>Dry GSM</th>
                            <th style={{ ...TH, textAlign: "center" as const }}>Liq. GSM</th>
                            <th style={{ ...TH, textAlign: "right" as const }}>Req. Kg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {colorStations.map((cs, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f5f5f5" }}>
                              <td style={{ ...TD, textAlign: "center", fontWeight: 900, fontSize: "9pt" }}>{cs.colorNo}</td>
                              <td style={{ ...TD, fontWeight: 700 }}>{cs.colorName}</td>
                              <td style={{ ...TD, fontWeight: 800 }}>{cs.cylCode}</td>
                              <td style={{ ...TD, textAlign: "center" }}>{cs.circ}</td>
                              <td style={TD}>{cs.cylType}</td>
                              <td style={TD}>{cs.cylStatus}</td>
                              <td style={{ ...TD, fontSize: "7pt" }}>{cs.inkName}</td>
                              <td style={{ ...TD, textAlign: "center" }}>{cs.dryGSM || "—"}</td>
                              <td style={{ ...TD, textAlign: "center", fontWeight: 700 }}>{cs.liqGSM || "—"}</td>
                              <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{cs.reqWtKg > 0 ? cs.reqWtKg.toFixed(3) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                        {totalInkKg > 0 && (
                          <tfoot>
                            <tr style={{ background: "#efefef" }}>
                              <td colSpan={9} style={{ ...TD, textAlign: "right", fontWeight: 800, background: "#efefef", whiteSpace: "nowrap" as const }}>Total Ink Required →</td>
                              <td style={{ ...TD, textAlign: "right", fontWeight: 900, whiteSpace: "nowrap" as const }}>{totalInkKg.toFixed(3)} Kg</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </>
                  )}

                  {/* ── E · CONSUMABLES PLAN (Adhesive + Solvent) ── */}
                  {(allAdhesives.length > 0 || allSolvents.length > 0) && (
                    <>
                      <span style={PH}>E · Consumables Plan (Adhesive / Hardener / Solvent)</span>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "3px" }}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: "5%", textAlign: "center" as const }}>Ply</th>
                            <th style={{ ...TH, width: "10%" }}>Type</th>
                            <th style={{ ...TH, width: "28%" }}>Item Name</th>
                            <th style={TH}>Sub Group</th>
                            <th style={{ ...TH, textAlign: "center" as const, width: "8%" }}>GSM</th>
                            <th style={{ ...TH, textAlign: "center" as const, width: "12%" }}>% Solid / NCO</th>
                            <th style={{ ...TH, textAlign: "right" as const, width: "12%" }}>Req. Wt. (Kg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...allAdhesives, ...allSolvents].map((ci, i) => {
                            const reqWt = ci.gsm > 0 ? ((ci.gsm / 1000) * reqSQM * (1 + waste)) : 0;
                            const pctLabel = ci.itemGroup === "Hardner" ? `${ci.ncoPct ?? "—"}% NCO` : ci.itemGroup === "Adhesive" ? `${ci.ohPct ?? "—"}% OH` : `${ci.gsm ?? "—"}%`;
                            return (
                              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f5f5f5" }}>
                                <td style={{ ...TD, textAlign: "center" }}>{ci.plyNo}</td>
                                <td style={{ ...TD, fontWeight: 700 }}>{ci.itemGroup}</td>
                                <td style={{ ...TD, fontWeight: 700 }}>{ci.itemName || ci.fieldDisplayName || "—"}</td>
                                <td style={TD}>{ci.itemSubGroup || "—"}</td>
                                <td style={{ ...TD, textAlign: "center" }}>{ci.itemGroup === "Solvent" ? "—" : (ci.gsm || "—")}</td>
                                <td style={{ ...TD, textAlign: "center" }}>{pctLabel}</td>
                                <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{reqWt > 0 ? reqWt.toFixed(3) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#efefef" }}>
                            <td colSpan={6} style={{ ...TD, textAlign: "right", fontWeight: 800, background: "#efefef", fontSize: "7pt", whiteSpace: "nowrap" as const }}>
                              {[totalAdhKg > 0 && `Adhesive: ${totalAdhKg.toFixed(3)} Kg`, totalHrdKg > 0 && `Hardener: ${totalHrdKg.toFixed(3)} Kg`, totalSolvKg > 0 && `Solvent: ${totalSolvKg.toFixed(3)} Kg`].filter(Boolean).join("   |   ")}
                            </td>
                            <td style={{ ...TD, textAlign: "right", fontWeight: 900, whiteSpace: "nowrap" as const }}>{(totalAdhKg + totalHrdKg + totalSolvKg).toFixed(3)} Kg</td>
                          </tr>
                        </tfoot>
                      </table>
                    </>
                  )}

                  {/* ── F · PROCESS ROUTING ── */}
                  {wo.processes.length > 0 && (
                    <>
                      <span style={PH}>F · Process Routing</span>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "3px" }}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: "5%", textAlign: "center" as const }}>Seq</th>
                            <th style={TH}>Process Name</th>
                            <th style={{ ...TH, width: "13%", textAlign: "center" as const }}>Charge Unit</th>
                            <th style={{ ...TH, width: "9%", textAlign: "right" as const }}>Qty</th>
                            <th style={{ ...TH, width: "11%", textAlign: "right" as const }}>Rate (₹)</th>
                            <th style={{ ...TH, width: "11%", textAlign: "right" as const }}>Amount (₹)</th>
                            <th style={{ ...TH, width: "20%", textAlign: "center" as const }}>Operator Sign-off</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wo.processes.map((p, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f5f5f5" }}>
                              <td style={{ ...TD, textAlign: "center", fontWeight: 900 }}>{i + 1}</td>
                              <td style={{ ...TD, fontWeight: 700 }}>{p.processName}</td>
                              <td style={{ ...TD, textAlign: "center", fontSize: "7pt" }}>{p.chargeUnit || "—"}</td>
                              <td style={{ ...TD, textAlign: "right" }}>{p.qty > 0 ? p.qty.toLocaleString("en-IN") : "—"}</td>
                              <td style={{ ...TD, textAlign: "right" }}>{p.rate > 0 ? `₹${Number(p.rate).toFixed(2)}` : "—"}</td>
                              <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{p.amount > 0 ? `₹${Number(p.amount).toFixed(2)}` : "—"}</td>
                              <td style={{ ...TD, textAlign: "center", color: "#bbb", fontSize: "7pt" }}>_______________________</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* ── G · PRODUCTION LOG (shop floor fill-in) ── */}
                  <span style={PH}>G · Production Log</span>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "3px" }}>
                    <tbody>
                      <tr>
                        {["Actual Start Time", "Actual End Time", "Machine Speed (m/min)", "Actual Qty Produced", "Actual Waste (m)", "Roll Wt. (Kg)"].map(label => (
                          <td key={label} style={{ ...TD, width: `${100 / 6}%`, verticalAlign: "top", padding: "4px" }}>
                            <div style={{ fontSize: "6pt", fontWeight: 700, textTransform: "uppercase" as const, color: "#555" }}>{label}</div>
                            <div style={{ borderBottom: "1px solid #bbb", marginTop: "14px" }}></div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>

                  {/* ── H · SPECIAL INSTRUCTIONS ── */}
                  {wo.specialInstructions && (
                    <>
                      <span style={PH}>H · Special Instructions</span>
                      <div style={{ border: "2px solid #000", padding: "5px 8px", marginBottom: "3px", fontSize: "8pt", fontWeight: 600 }}>
                        {wo.specialInstructions}
                      </div>
                    </>
                  )}

                  {/* ── SIGN-OFF ── */}
                  <div style={{ borderTop: "2px solid #000", marginTop: "4px", paddingTop: "4px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        <tr>
                          {["Prepared By", "Approved By / PIC", "Machine Operator", "Quality Inspector"].map((role, idx) => (
                            <td key={idx} style={{ border: "1px solid #999", textAlign: "center", padding: "3px 6px", width: "25%" }}>
                              <div style={{ height: "25px", borderBottom: "1px solid #bbb", marginBottom: "3px" }} />
                              <div style={{ fontSize: "7pt", fontWeight: 800, color: "#000" }}>{role}</div>
                              <div style={{ fontSize: "6pt", color: "#555", marginTop: "1px" }}>Name / Signature / Date</div>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ fontSize: "6pt", color: "#666", textAlign: "center", marginTop: "3px" }}>
                      Generated by AJ Shrink ERP · {today} · {companyName} · This is a system generated Production Work Order
                    </div>
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

      {/* ══ CUSTOM NOTIFICATION POPUP ════════════════════════════ */}
      {notif && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onClick={() => setNotif(null)}>
          <div
            className={`bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border-l-4 ${notif.type === "success" ? "border-green-500" : "border-red-500"}`}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              {notif.type === "success"
                ? <CheckCircle2 className="text-green-500 mt-0.5 flex-shrink-0" size={22} />
                : <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={22} />}
              <div className="flex-1 min-w-0">
                <h3 className={`font-bold text-sm ${notif.type === "success" ? "text-green-700" : "text-red-700"}`}>
                  {notif.title}
                </h3>
                <p className="text-xs text-gray-600 mt-1.5 whitespace-pre-wrap leading-relaxed">{notif.msg}</p>
              </div>
              <button onClick={() => setNotif(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setNotif(null)}
                className={`px-5 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${notif.type === "success" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
