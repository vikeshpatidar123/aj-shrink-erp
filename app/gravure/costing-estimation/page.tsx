"use client";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { useState, useMemo, useEffect, useRef } from "react";
import TutorialButton from "@/components/ui/TutorialButton";
import { useRouter } from "next/navigation";
import {
  ChevronRight, ChevronLeft, ChevronDown, Plus, X, Save, FileText, Settings,
  Trash2, Edit, Search, Eye, Filter, Download, MoreHorizontal, Check,
  Calculator, Pencil, ArrowRight, RefreshCw, Wrench, Archive, Palette,
  Eye as EyeIcon, Printer, ShoppingCart, BookCheck,
} from "lucide-react";
import {
  gravureEstimations as initData, items, machines, processMasters,
  GravureEstimation, GravureEstimationMaterial, GravureEstimationProcess,
  SecondaryLayer, DryWeightRow, PlyConsumableItem,
  CATEGORY_GROUP_SUBGROUP,
  tools as allTools, toolInventory, grnRecords,
} from "@/data/dummyData";
import { useCategories }     from "@/context/CategoriesContext";
import { useEnquiries }      from "@/context/EnquiryContext";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { useMasters }        from "@/context/MastersContext";
import { usePermissions }    from "@/context/PermissionsContext";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { apiGet, apiPost, API_BASE } from "@/lib/api";
import { authHeaders } from "@/lib/auth";
import { DimensionDiagram, DimensionInputPanel, DimValues, CONTENT_TYPE_CONFIG } from "@/components/gravure/DimensionDiagram";
import { calcCosts } from "@/hooks/costingCalc";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { CustomerSelectField } from "@/components/ui/CustomerSelectField";
import { FieldMasterSelectField } from "@/components/ui/FieldMasterSelectField";
import SearchableSelect from "@/components/ui/SearchableSelect";

// ─── Master-filtered lists ────────────────────────────────────
const FILM_ITEMS     = items.filter(i => i.group === "Film"     && i.active);
const INK_ITEMS      = items.filter(i => i.group === "Ink"      && i.active);
const SOLVENT_ITEMS  = items.filter(i => i.group === "Solvent"  && i.active);
const ADHESIVE_ITEMS = items.filter(i => i.group === "Adhesive" && i.active);
const HARDNER_ITEMS  = items.filter(i => i.group === "Hardner"  && i.active);
const ALL_MAT_ITEMS  = [...FILM_ITEMS, ...INK_ITEMS, ...SOLVENT_ITEMS, ...ADHESIVE_ITEMS, ...HARDNER_ITEMS];

const FINISH_GOODS_TYPES = [
  "3 Side Seal Sachet", "Center Seal Pouch", "Stand Up Pouch",
  "Gusset Bag", "Flat Bottom Pouch", "Sleeve — Shrink",
  "In-Mould Labels", "BOPP Label", "CSD", "Shrink Sleeve",
];

// Fallback static data (used when API not yet loaded)
const STATIC_PRINT_MACHINES = machines.filter(m => m.department === "Printing");
const STATIC_ROTO_PROCESSES = processMasters.filter(p => p.module === "Rotogravure");

// Maps any DB ContentMaster.ContentName → a CONTENT_TYPE_CONFIG key.
// Order matters: more-specific checks before general ones.
// If no pattern matches, returns the original string (may already be an exact config key).
function normalizeContentType(content: string): string {
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
const getDisplayContentType = (content: string): string =>
  CONTENT_TYPE_CONFIG[content] ? content : normalizeContentType(content);

// Parses SQL Server datetime strings returned by JavaScriptSerializer.
// Handles: /Date(1716489600000)/, ISO strings ("2024-05-16"), or "16 May 2024" style.
// Always returns a "yyyy-MM-dd" string safe for <input type="date"> and new Date().
function parseApiDate(d: any): string {
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
const CYLINDER_TOOLS_ALL = allTools
  .filter(t => t.toolType === "Cylinder")
  .sort((a, b) => parseFloat(a.printWidth) - parseFloat(b.printWidth));

// ─── Blank form ───────────────────────────────────────────────
const blank: Omit<GravureEstimation, "id" | "estimationNo"> = {
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

const STATUS_COLORS: Record<string, string> = {
  Draft:    "bg-gray-100 text-gray-600 border-gray-200",
  Approved: "bg-green-50 text-green-700 border-green-200",
  Sent:     "bg-blue-50 text-blue-700 border-blue-200",
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-600 border-red-200",
};
const MOD = "/gravure/estimation";

export default function GravureCostingEstimationPage() {
  const { can } = usePermissions();
  const router = useRouter();

  const [data, setData]       = useState<GravureEstimation[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [bookedEstIds, setBookedEstIds] = useState<Set<string>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("grv_booked_est_ids") ?? "[]");
      return new Set<string>(Array.isArray(stored) ? stored : []);
    } catch { return new Set<string>(); }
  });

  const markEstimationBooked = (id: string) => {
    setBookedEstIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem("grv_booked_est_ids", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // ── Load list from API ─────────────────────────────────────
  const loadList = async () => {
    setLoadingData(true);
    // Sync booked IDs from orders API (merge with localStorage set)
    apiGet<any[]>("api/gravureOrderBookingShrink/getorders").then(orders => {
      if (!Array.isArray(orders)) return;
      const ids = new Set<string>();
      orders.forEach((o: any) => {
        const lines: any[] = (() => {
          try { return JSON.parse(o.linesJSON ?? o.lines ?? "[]"); } catch { return []; }
        })();
        lines.forEach((l: any) => {
          const eid = String(l.estimationId ?? l.EnquiryID ?? "");
          if (eid && eid !== "0") ids.add(eid);
        });
      });
      if (ids.size > 0) {
        setBookedEstIds(prev => {
          const merged = new Set([...prev, ...ids]);
          try { localStorage.setItem("grv_booked_est_ids", JSON.stringify([...merged])); } catch {}
          return merged;
        });
      }
    }).catch(() => {});
    try {
      const rows = await apiGet<any[]>("api/gravureestimationShrink/getestimationlist?source=GravureCosting");
      if (!Array.isArray(rows)) return;
      setData(rows.map(r => ({
        ...blank,
        id:            String(r.GrvEstimationID ?? r.BookingID ?? ""),
        estimationNo:  String(r.GrvEstimationCode ?? ""),
        date:          parseApiDate(r.GrvEstimationDate),
        customerId:    String(r.CustomerID ?? ""),
        customerName:  String(r.CustomerName ?? ""),
        categoryId:    String(r.CategoryID ?? ""),
        categoryName:  String(r.CategoryName ?? ""),
        jobName:       String(r.JobName ?? ""),
        content:       String(r.Content ?? ""),
        jobWidth:      Number(r.JobWidth ?? 0),
        jobHeight:     Number(r.JobHeight ?? 0),
        actualWidth:   Number(r.ActualWidth ?? 0),
        actualHeight:  Number(r.ActualHeight ?? 0),
        noOfColors:    Number(r.NoOfColors ?? 0),
        printType:     String(r.PrintType ?? "Surface Print") as any,
        quantity:      Number(r.Quantity ?? 0),
        unit:          String(r.Unit ?? "Kg") as any,
        machineId:     String(r.MachineID ?? ""),
        machineName:   String(r.MachineName ?? ""),
        totalAmount:   Number(r.TotalAmount ?? 0),
        perMeterRate:  Number(r.PerMeterRate ?? 0),
        materialCost:  Number(r.MaterialCost ?? 0),
        processCost:   Number(r.ProcessCost ?? 0),
        sellingPrice:  Number(r.SellingPrice ?? 0),
        status:        String(r.Status ?? "Draft") as any,
        remarks:       String(r.Remarks ?? ""),
        salesPerson:   String(r.SalesPerson ?? ""),
        salesType:     String(r.SalesType ?? "Local") as any,
        plyStructureText: String(r.PlyStructureText ?? ""),
      })));
    } catch {}
    finally { setLoadingData(false); }
  };

  useEffect(() => { loadList(); }, []);
  const [viewRow,   setViewRow]   = useState<GravureEstimation | null>(null);
  const [printRow,  setPrintRow]  = useState<GravureEstimation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Stats ────────────────────────────────────────────────
  const stats = {
    total:    data.length,
    draft:    data.filter(e => e.status === "Draft").length,
    approved: data.filter(e => e.status === "Approved").length,
    sent:     data.filter(e => e.status === "Sent" || e.status === "Accepted").length,
    totalAmt: data.reduce((s, e) => s + e.totalAmount, 0),
  };

  const columns: Column<GravureEstimation>[] = [
    { key: "estimationNo",  header: "Estimation No", sortable: true },
    { key: "date",          header: "Date",           sortable: true },
    { key: "customerName",  header: "Customer",       sortable: true },
    { key: "jobName",       header: "Job Name" },
    {
      key: "plyStructureText" as any, header: "Ply Structure",
      render: r => {
        const txt = (r as any).plyStructureText as string | undefined;
        if (!txt) return <span className="text-gray-300 text-xs">—</span>;
        const plies = txt.split(" / ").filter(Boolean);
        return (
          <div className="flex flex-wrap gap-1">
            {plies.map((p, i) => (
              <span key={i} className="inline-flex items-center px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-[10px] font-semibold whitespace-nowrap">
                {p}
              </span>
            ))}
          </div>
        );
      },
    },
    { key: "noOfColors",    header: "Colors", render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "machineName",   header: "Machine", render: r => <span className="text-xs text-gray-600">{r.machineName}</span> },
    { key: "quantity",      header: "Qty", render: r => <span>{r.quantity.toLocaleString()}</span> },
    { key: "unit",          header: "Unit", render: r => <span className="text-xs text-gray-600">{r.unit}</span> },
    { key: "perMeterRate",  header: "Rate (Rupees)", render: r => <span className="font-semibold">₹{r.perMeterRate}</span> },
    { key: "totalAmount",   header: "Total (₹)", render: r => <span className="font-bold text-gray-800">₹{r.totalAmount.toLocaleString()}</span> },
    {
      key: "status" as any, header: "Status", sortable: true,
      render: r => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusBadge(r.status)}
          {bookedEstIds.has(r.id) && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 border border-green-300 rounded text-[9px] font-bold whitespace-nowrap">
              <BookCheck size={9} /> Order Booked
            </span>
          )}
        </div>
      ),
    },
  ];


  return (
    <div className="h-full overflow-hidden flex flex-col -m-4 md:-m-6 lg:-m-7">

      {/* Page Header */}
      <div className="flex items-center justify-between px-4 md:px-6 lg:px-7 py-3 flex-shrink-0 border-b border-[rgb(var(--bd-default))]">
        <div className="flex items-center gap-2">
          <Calculator size={18} className="text-purple-600" />
          <h2 className="text-lg font-semibold text-[rgb(var(--fg-default))]">Estimation</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: "Draft",    val: stats.draft,    cls: "bg-gray-100 text-gray-600" },
            { label: "Approved", val: stats.approved, cls: "bg-green-100 text-green-700" },
            { label: "Sent",     val: stats.sent,     cls: "bg-purple-100 text-purple-700" },
          ].map(s => (
            <span key={s.label} className={`hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>
              {s.label} {s.val}
            </span>
          ))}
          {loadingData && <RefreshCw size={13} className="animate-spin text-gray-400" />}
          <TutorialButton title="Gravure Estimation — Tutorial" />
          <Button icon={<RefreshCw size={13} />} variant="secondary" onClick={loadList} disabled={loadingData} className="text-xs py-1.5 px-3">Refresh</Button>
          {can(MOD, "CanSave") && <Button variant="action-create" size="sm" icon={<Plus size={15}/>} onClick={() => router.push("/gravure/costing-estimation/new")}>New Estimation</Button>}
        </div>
      </div>

      {/* ══ CONTENT ═══════════════════════════════════════════════ */}
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["estimationNo", "customerName", "jobName"]}
          stickyHeader
          scrollContainerClass="flex-1"
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <RowAction.View onClick={() => setViewRow(row)} />
              <RowAction.Print onClick={() => setPrintRow(row)} />
              {bookedEstIds.has(row.id) ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-green-700 bg-green-100 border border-green-300 rounded-lg whitespace-nowrap cursor-not-allowed">
                  <BookCheck size={11} /> Order Booked
                </span>
              ) : (
                <button
                  title="Book Order"
                  onClick={() => {
                    markEstimationBooked(row.id);
                    localStorage.setItem("ajsw_order_from_estimation", JSON.stringify({
                      estimationId:   row.id,
                      estimationNo:   row.estimationNo,
                      customerId:     row.customerId,
                      customerName:   row.customerName,
                      jobName:        row.jobName,
                      categoryId:     row.categoryId,
                      categoryName:   row.categoryName,
                      content:        row.content,
                      substrate:      row.substrateName,
                      jobWidth:       row.jobWidth,
                      jobHeight:      row.jobHeight,
                      noOfColors:     row.noOfColors,
                      printType:      row.printType,
                      quantity:       row.quantity,
                      unit:           row.unit,
                      perMeterRate:   row.perMeterRate,
                      salesPerson:    row.salesPerson,
                      salesType:      row.salesType,
                    }));
                    router.push("/gravure/orders");
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition whitespace-nowrap"
                >
                  <ShoppingCart size={11} /> Book Order
                </button>
              )}
              {can(MOD, "CanEdit") && <RowAction.Edit onClick={() => router.push(`/gravure/costing-estimation/${row.id}/edit`)} />}
              {can(MOD, "CanDelete") && <RowAction.Delete onClick={() => setDeleteId(row.id)} />}
            </div>
          )}
        />
      </div>



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
                    <tfoot className="bg-purple-50 border-t border-blue-200">
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
                  { label: "Process Cost",    val: `₹${viewRow.processCost.toLocaleString()}`,   cls: "bg-purple-50 border-blue-200" },
                  { label: `Cylinder (${viewRow.noOfColors}C × ₹${viewRow.cylinderCostPerColor})`, val: `₹${viewRow.cylinderCost.toLocaleString()}`, cls: "bg-indigo-50 border-indigo-200" },
                  { label: "Other Cost",       val: `₹${(viewRow.setupCost || 0).toLocaleString()}`, cls: "bg-amber-50 border-amber-200" },
                  { label: "Packing Cost",    val: `₹${(viewRow.packingCost ?? calcCosts(viewRow).packingCost ?? 0).toLocaleString()}`, cls: "bg-orange-50 border-orange-200" },
                  { label: `Overhead (${viewRow.overheadPct}%)`, val: `₹${viewRow.overheadAmt.toLocaleString()}`, cls: "bg-yellow-50 border-yellow-200" },
                  { label: `Profit (${viewRow.profitPct}%)`, val: `₹${viewRow.profitAmt.toLocaleString()}`, cls: "bg-green-50 border-green-200" },
                  { label: "Total (Without Profit)", val: `₹${(viewRow.totalAmount - viewRow.profitAmt).toLocaleString()}`, cls: "bg-blue-50 border-blue-300" },
                  { label: "Total Amount",    val: `₹${viewRow.totalAmount.toLocaleString()}`,   cls: "bg-white border-2 border-purple-400" },
                  { label: `Rate / ${viewRow.unit || "unit"}`, val: `₹${viewRow.perMeterRate}`, cls: "bg-gray-50 border-gray-200" },
                  { label: `Rate / ${viewRow.unit || "unit"} (W/o Profit)`, val: `₹${viewRow.perMeterRateWithoutProfit ?? ((viewRow.totalAmount - viewRow.profitAmt) / (viewRow.quantity || 1)).toFixed(4)}`, cls: "bg-blue-50 border-blue-200" },
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
              <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => { const id = viewRow!.id; setViewRow(null); router.push(`/gravure/costing-estimation/${id}/edit`); }}>Edit</Button>
              {viewRow.status === "Approved" && <Button icon={<ArrowRight size={14} />}>Convert to Order</Button>}
            </div>
          </div>
        </Modal>
      )}

      {/* ══ ESTIMATION PRINT MODAL ═══════════════════════════════ */}
      {printRow && (() => {
        const est = printRow;
        const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        const waste = (est.wastagePct ?? 1) / 100;
        const filmW = (est as any).width || est.jobWidth || 0;
        const reqSQM = (est.unit === "Kg")
          ? (() => {
              const totalGSM = est.secondaryLayers.reduce((s: number, l: any) => s + (l.gsm || 0) + (l.consumableItems || []).reduce((cs: number, ci: any) => cs + (ci.gsm || 0), 0), 0);
              return totalGSM > 0 ? (est.quantity * 1000 / totalGSM) : 0;
            })()
          : est.quantity * (filmW / 1000);
        const companyName = (typeof window !== "undefined" ? localStorage.getItem("companyName") : null) || "Company";
        const rateLabel = est.unit === "Kg" ? `Rate / Kg` : `Rate / Meter`;
        const subTotal = est.materialCost + est.processCost + (est.cylinderCost || 0) + (est.setupCost || 0) + (est.packingCost || 0) + (est.labourCost || 0) + (est.transportationCost || 0) + (est.interestCost || 0) + ((est as any).depreciationCost || 0);

        // Shared styles — pure B&W
        const PH: React.CSSProperties = { background: "#fff", color: "#000", fontWeight: 900, fontSize: "8pt", letterSpacing: "0.5px", padding: "3px 0px", textTransform: "uppercase" as const, borderBottom: "2px solid #000", marginTop: "5px", marginBottom: "2px", display: "block" };
        const TH: React.CSSProperties = { padding: "2px 5px", border: "1px solid #999", background: "#efefef", fontWeight: 700, fontSize: "6.5pt", textTransform: "uppercase" as const, textAlign: "left" as const, whiteSpace: "nowrap" as const, color: "#000" };
        const TD: React.CSSProperties = { padding: "2px 5px", border: "1px solid #bbb", fontSize: "8pt", verticalAlign: "middle" as const, color: "#000" };

        const PRINT_CSS = `*{margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif;}body{padding:10mm;color:#000;background:#fff;font-size:8.5pt;}table{width:100%;border-collapse:collapse;}td,th{border:1px solid #999;padding:2px 5px;vertical-align:middle;color:#000;}th{background:#efefef;font-weight:700;text-align:left;white-space:nowrap;font-size:6.5pt;text-transform:uppercase;}@media print{body{padding:8mm;}@page{margin:7mm;size:A4 portrait;}}`;

        // ── Internal cost sheet print ──
        const handlePrint = () => {
          const el = document.getElementById("est-print-area");
          if (!el) return;
          const w = window.open("", "_blank", "width=1050,height=820");
          if (!w) return;
          w.document.write(`<!DOCTYPE html><html><head><title>Cost Sheet — ${est.estimationNo}</title><style>${PRINT_CSS}</style></head><body>${el.innerHTML}</body></html>`);
          w.document.close();
          w.focus();
          setTimeout(() => { w.print(); }, 400);
        };

        // ── Client-facing Quotation print ──
        const handlePrintQuotation = () => {
          const filmLayers = est.secondaryLayers.filter((l: any) => l.itemSubGroup || l.plyType);
          const totalGSM = filmLayers.reduce((s: number, l: any) => s + (l.gsm || 0), 0);
          const w = window.open("", "_blank", "width=1050,height=820");
          if (!w) return;
          const qty = est.quantity;
          const rate = est.perMeterRate ?? 0;
          const orderValue = qty * rate;
          const qtyRows = Array.isArray((est as any).quantities) && (est as any).quantities.length > 1
            ? (est as any).quantities
            : null;

          const structureRows = filmLayers.map((l: any, i: number) => `
            <tr style="background:${i % 2 === 0 ? "#fff" : "#f5f5f5"}">
              <td class="ctr">${l.layerNo || i + 1}</td>
              <td>${l.plyType || "Film"}</td>
              <td><b>${l.itemSubGroup || "—"}</b></td>
              <td class="ctr">${l.thickness ? `${l.thickness} μ` : "—"}</td>
              <td class="ctr">${l.gsm || "—"} GSM</td>
            </tr>`).join("");

          const qtyTableHtml = qtyRows ? `
            <span style="display:block;font-weight:900;font-size:8pt;border-bottom:2px solid #000;padding:3px 0;margin-top:8px;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;">Quantity-wise Rate</span>
            <table><thead><tr><th>#</th><th>Quantity (${est.unit})</th><th style="text-align:right">Rate / ${est.unit} (₹)</th><th style="text-align:right">Approx. Order Value (₹)</th></tr></thead><tbody>
            ${qtyRows.map((q: any, i: number) => `<tr style="background:${i%2===0?"#fff":"#f5f5f5"}"><td class="ctr">${i+1}</td><td><b>${Number(q.quantity||0).toLocaleString("en-IN")}</b></td><td style="text-align:right;font-weight:700">₹${Number(q.perMeterRate||0).toFixed(4)}</td><td style="text-align:right">₹${Number((q.quantity||0)*(q.perMeterRate||0)).toLocaleString("en-IN",{maximumFractionDigits:0})}</td></tr>`).join("")}
            </tbody></table>` : "";

          w.document.write(`<!DOCTYPE html><html><head><title>Quotation — ${est.estimationNo}</title>
            <style>${PRINT_CSS}
              .big-rate{font-size:18pt;font-weight:900;border:2px solid #000;padding:8px 16px;display:inline-block;margin:4px 0;}
              .terms-row td{border:none;border-bottom:1px solid #ddd;padding:4px 6px;}
              .terms-row td:first-child{font-weight:700;width:38%;font-size:7.5pt;text-transform:uppercase;color:#444;}
            </style></head><body>
            <!-- HEADER -->
            <table style="border:2px solid #000;margin-bottom:5px">
              <tr>
                <td style="border:none;border-right:1px solid #000;padding:6px 8px;width:36%;vertical-align:middle">
                  <div style="font-size:15pt;font-weight:900;white-space:nowrap">${companyName}</div>
                  <div style="font-size:7pt;font-weight:700;letter-spacing:.8px;margin-top:2px">FLEXIBLE PACKAGING · GRAVURE PRINTING</div>
                </td>
                <td style="border:none;border-right:1px solid #000;text-align:center;padding:6px 8px;width:28%;vertical-align:middle">
                  <div style="font-size:16pt;font-weight:900;letter-spacing:1px">QUOTATION</div>
                  <div style="font-size:7pt;color:#444;margin-top:4px;font-weight:600">AJSW / GRVQUOT / R0</div>
                </td>
                <td style="border:none;padding:6px 8px;width:36%;vertical-align:middle">
                  <table style="border:none"><tbody>
                    <tr><td style="border:none;padding:1px 0;font-weight:700;width:42%;font-size:7.5pt">Quot. No</td><td style="border:none;padding:1px 0;font-size:7.5pt">: ${est.estimationNo}</td></tr>
                    <tr><td style="border:none;padding:1px 0;font-weight:700;font-size:7.5pt">Date</td><td style="border:none;padding:1px 0;font-size:7.5pt">: ${today}</td></tr>
                    <tr><td style="border:none;padding:1px 0;font-weight:700;font-size:7.5pt">Valid Until</td><td style="border:none;padding:1px 0;font-size:7.5pt">: ${(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); })()}</td></tr>
                    <tr><td style="border:none;padding:1px 0;font-weight:700;font-size:7.5pt">Enquiry Ref</td><td style="border:none;padding:1px 0;font-size:7.5pt">: ${est.enquiryNo || "—"}</td></tr>
                    <tr><td style="border:none;padding:1px 0;font-weight:700;font-size:7.5pt">Sales Person</td><td style="border:none;padding:1px 0;font-size:7.5pt">: ${est.salesPerson || "—"}</td></tr>
                  </tbody></table>
                </td>
              </tr>
            </table>

            <!-- CUSTOMER -->
            <span style="display:block;font-weight:900;font-size:8pt;border-bottom:2px solid #000;padding:3px 0;margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px">A · Customer Details</span>
            <table style="margin-bottom:5px"><tbody>
              <tr><th>Customer / Party</th><td style="font-weight:800;font-size:10pt">${est.customerName || "—"}</td><th>Job Name</th><td style="font-weight:700">${est.jobName || "—"}</td></tr>
              <tr><th>Category</th><td>${est.categoryName || "—"}</td><th>Brand Name</th><td>${(est as any).brandName || "—"}</td></tr>
              <tr><th>Content / Structure</th><td>${est.content || "—"}</td><th>Pack Size</th><td>${(est as any).packSize || "—"}</td></tr>
            </tbody></table>

            <!-- PRODUCT SPEC -->
            <span style="display:block;font-weight:900;font-size:8pt;border-bottom:2px solid #000;padding:3px 0;margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px">B · Product Specification</span>
            <table style="margin-bottom:5px"><tbody>
              <tr>
                <th>Job Size (W × H)</th><td>${est.jobWidth} × ${est.jobHeight} mm</td>
                <th>Actual Size (W × H)</th><td>${est.actualWidth} × ${est.actualHeight} mm</td>
                <th>Film Width</th><td>${filmW} mm</td>
                <th>Repeat Length</th><td>${est.repeatLength ? est.repeatLength + " mm" : "—"}</td>
              </tr>
              <tr>
                <th>No. of Colors</th><td>${est.noOfColors}C (${est.frontColors ?? "—"}F + ${est.backColors ?? "—"}B)</td>
                <th>Print Type</th><td>${est.printType || "—"}</td>
                <th>No. of Plys</th><td>${filmLayers.length}</td>
                <th>Total GSM</th><td>${totalGSM > 0 ? totalGSM : "—"}</td>
              </tr>
              <tr>
                <th>Quantity</th><td style="font-weight:700">${qty.toLocaleString("en-IN")} ${est.unit}</td>
                <th>Artwork Name</th><td>${(est as any).artworkName || "—"}</td>
                <th>SKU Type</th><td colspan="3">${(est as any).skuType || "—"}</td>
              </tr>
            </tbody></table>

            <!-- LAMINATION STRUCTURE (no rates) -->
            ${filmLayers.length > 0 ? `
            <span style="display:block;font-weight:900;font-size:8pt;border-bottom:2px solid #000;padding:3px 0;margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px">C · Lamination / Ply Structure</span>
            <table style="margin-bottom:5px">
              <thead><tr><th class="ctr" style="width:5%">Ply #</th><th style="width:12%">Ply Type</th><th>Film / Material</th><th class="ctr" style="width:12%">Thickness</th><th class="ctr" style="width:10%">GSM</th></tr></thead>
              <tbody>${structureRows}</tbody>
              <tfoot><tr style="background:#efefef"><td colspan="4" style="text-align:right;font-weight:700;border:1px solid #999">Total GSM</td><td style="text-align:center;font-weight:900;border:1px solid #999">${totalGSM}</td></tr></tfoot>
            </table>` : ""}

            <!-- QUOTED RATE (prominent box) -->
            <span style="display:block;font-weight:900;font-size:8pt;border-bottom:2px solid #000;padding:3px 0;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">D · Quoted Rate</span>
            <table style="margin-bottom:6px;border:2px solid #000"><tbody>
              <tr>
                <td style="padding:10px 14px;text-align:center;width:40%;border-right:2px solid #000">
                  <div style="font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Rate per ${est.unit} (Incl. all charges)</div>
                  <div style="font-size:20pt;font-weight:900">₹${Number(rate).toFixed(4)}</div>
                  <div style="font-size:7.5pt;font-weight:600;margin-top:2px;color:#444">per ${est.unit} (inclusive of all charges)</div>
                </td>
                <td style="padding:10px 14px;text-align:center;width:35%;border-right:2px solid #000">
                  <div style="font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Quantity</div>
                  <div style="font-size:14pt;font-weight:900">${qty.toLocaleString("en-IN")} ${est.unit}</div>
                </td>
                <td style="padding:10px 14px;text-align:center;width:25%">
                  <div style="font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Approx. Order Value</div>
                  <div style="font-size:13pt;font-weight:900">₹${orderValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
                  <div style="font-size:7pt;color:#444;margin-top:2px">+ GST as applicable</div>
                </td>
              </tr>
            </tbody></table>

            ${qtyTableHtml}

            <!-- COMMERCIAL TERMS -->
            <span style="display:block;font-weight:900;font-size:8pt;border-bottom:2px solid #000;padding:3px 0;margin-top:6px;margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px">E · Commercial Terms &amp; Conditions</span>
            <table style="margin-bottom:5px"><tbody class="terms-row">
              <tr class="terms-row"><td>Quotation Validity</td><td>30 days from the date of quotation</td></tr>
              <tr class="terms-row"><td>Payment Terms</td><td>100% advance / As per agreement</td></tr>
              <tr class="terms-row"><td>Freight / Delivery</td><td>Extra at actuals / As per agreement</td></tr>
              <tr class="terms-row"><td>GST</td><td>Extra as applicable</td></tr>
              <tr class="terms-row"><td>Delivery Lead Time</td><td>10–15 working days from receipt of artwork &amp; advance</td></tr>
              <tr class="terms-row"><td>Rate Basis</td><td>Rates quoted are per ${est.unit} of finished printed material</td></tr>
              ${est.remarks ? `<tr class="terms-row"><td>Remarks / Notes</td><td>${est.remarks}</td></tr>` : ""}
              ${(est as any).specialSpecs ? `<tr class="terms-row"><td>Special Specs</td><td>${(est as any).specialSpecs}</td></tr>` : ""}
            </tbody></table>

            <!-- SIGN-OFF -->
            <div style="border-top:2px solid #000;margin-top:8px;padding-top:6px">
              <table><tbody><tr>
                <td style="text-align:center;padding:4px 6px;width:33%;border:1px solid #999"><div style="height:28px;border-bottom:1px solid #999;margin-bottom:4px"></div><div style="font-size:7.5pt;font-weight:800">Authorised Signatory</div><div style="font-size:6.5pt;color:#555;margin-top:2px">${companyName}</div></td>
                <td style="text-align:center;padding:4px 6px;width:33%;border:1px solid #999"><div style="height:28px;border-bottom:1px solid #999;margin-bottom:4px"></div><div style="font-size:7.5pt;font-weight:800">Sales / Marketing</div><div style="font-size:6.5pt;color:#555;margin-top:2px">Name / Date</div></td>
                <td style="text-align:center;padding:4px 6px;width:34%;border:1px solid #999"><div style="height:28px;border-bottom:1px solid #999;margin-bottom:4px"></div><div style="font-size:7.5pt;font-weight:800">Customer Acceptance</div><div style="font-size:6.5pt;color:#555;margin-top:2px">Name / Seal / Date</div></td>
              </tr></tbody></table>
              <div style="font-size:6.5pt;color:#666;text-align:center;margin-top:4px">Generated by AJ Shrink ERP · ${today} · ${companyName} · This is a computer generated quotation</div>
            </div>
            </body></html>`);
          w.document.close();
          w.focus();
          setTimeout(() => { w.print(); }, 400);
        };

        const INR = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        const DEC = (n: number, d = 4) => Number(n || 0).toFixed(d);

        // Build combined material rows: film layers first, then consumables per layer
        type MatRow = { seq: number; plyNo: number; plyLabel: string; group: string; material: string; spec: string; gsm: number; rate: number; reqKg: number; amount: number };
        const matRows: MatRow[] = [];
        let seq = 0;
        est.secondaryLayers.forEach((l: any) => {
          seq++;
          const rate = l.filmRate ?? 0;
          const reqKg = l.gsm > 0 ? parseFloat(((l.gsm / 1000) * reqSQM * (1 + waste)).toFixed(3)) : 0;
          matRows.push({ seq, plyNo: l.layerNo || seq, plyLabel: l.plyType || "Film", group: "Film", material: l.itemSubGroup || "—", spec: l.thickness ? `${l.thickness}μ` : `${l.gsm}GSM`, gsm: l.gsm, rate, reqKg, amount: parseFloat((reqKg * rate).toFixed(2)) });
          (l.consumableItems || []).forEach((ci: any) => {
            seq++;
            const effGsm = ci.gsm * ((ci.coveragePct ?? 100) / 100);
            const reqKgC = effGsm > 0 ? parseFloat(((effGsm / 1000) * reqSQM * (1 + waste)).toFixed(3)) : 0;
            const specLabel = ci.itemGroup === "Ink"
              ? `${ci.gsm}GSM${(ci.coveragePct ?? 100) < 100 ? ` @${ci.coveragePct}%cov` : ""}`
              : ci.itemGroup === "Solvent"
                ? `${ci.gsm ?? ""}% ratio`
                : `${ci.gsm}GSM`;
            matRows.push({ seq, plyNo: l.layerNo || 0, plyLabel: l.plyType || "", group: ci.itemGroup || "Consumable", material: ci.itemName || ci.fieldDisplayName || "—", spec: specLabel, gsm: effGsm, rate: ci.rate || 0, reqKg: reqKgC, amount: parseFloat((reqKgC * (ci.rate || 0)).toFixed(2)) });
          });
        });
        const matTotal = matRows.reduce((s, r) => s + r.amount, 0);

        return (
          <>
            <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={() => setPrintRow(null)} />
            <div className="fixed z-[71] inset-2 sm:inset-6 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Printer size={17} className="text-blue-400" />
                  <span className="font-bold text-sm">Cost Estimation — {est.estimationNo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${est.status === "Approved" ? "bg-green-600" : est.status === "Sent" ? "bg-blue-600" : "bg-gray-600"}`}>{est.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrintQuotation}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-xl transition">
                    <Printer size={14} /> Print Quotation (Client)
                  </button>
                  <button onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-bold rounded-xl transition">
                    <Printer size={14} /> Cost Sheet (Internal)
                  </button>
                  <button onClick={() => setPrintRow(null)} className="p-2 hover:bg-white/10 rounded-lg transition"><X size={16} /></button>
                </div>
              </div>

              {/* A4 preview */}
              <div className="flex-1 overflow-auto bg-slate-200 p-6">
                <div id="est-print-area" className="bg-white mx-auto shadow-xl"
                  style={{ width: "210mm", minHeight: "297mm", padding: "10mm", fontFamily: "Arial, sans-serif", fontSize: "8.5pt", color: "#111" }}>

                  {/* ── HEADER ── */}
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "5px", border: "2px solid #000" }}>
                    <tbody>
                      <tr>
                        <td style={{ border: "none", borderRight: "1px solid #000", padding: "6px 8px", width: "36%", verticalAlign: "middle" }}>
                          <div style={{ fontSize: "15pt", fontWeight: 900, color: "#000", letterSpacing: "0.5px", lineHeight: 1.1, whiteSpace: "nowrap" }}>{companyName}</div>
                          <div style={{ fontSize: "7pt", color: "#000", fontWeight: 700, letterSpacing: "0.8px", marginTop: "2px" }}>FLEXIBLE PACKAGING · GRAVURE PRINTING</div>
                        </td>
                        <td style={{ border: "none", borderRight: "1px solid #000", textAlign: "center", padding: "6px 8px", width: "28%", verticalAlign: "middle" }}>
                          <div style={{ fontSize: "14pt", fontWeight: 900, color: "#000", letterSpacing: "1px", textTransform: "uppercase", lineHeight: 1.1 }}>COST ESTIMATION</div>
                          <div style={{ fontSize: "7pt", color: "#444", marginTop: "4px", fontWeight: 600 }}>AJSW / GRVEST / R0</div>
                        </td>
                        <td style={{ border: "none", padding: "6px 8px", width: "36%", verticalAlign: "middle" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                              {[["Est. No", est.estimationNo], ["Date", today], ["Enquiry Ref", est.enquiryNo || "—"], ["Status", est.status], ["Sales Person", est.salesPerson || "—"]].map(([k, v]) => (
                                <tr key={k}><td style={{ border: "none", padding: "1px 0", fontSize: "7.5pt", fontWeight: 700, width: "42%", color: "#000" }}>{k}</td><td style={{ border: "none", padding: "1px 0", fontSize: "7.5pt", color: "#000" }}>: {v}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* ── CUSTOMER + PRODUCT IDENTITY ── */}
                  <div style={PH}>A · Customer &amp; Product Identity</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px" }}>
                    <tbody>
                      <tr>
                        <th style={{ ...TH, width: "13%" }}>Customer</th>
                        <td style={{ ...TD, width: "28%", fontWeight: 800, fontSize: "9pt" }}>{est.customerName || "—"}</td>
                        <th style={{ ...TH, width: "13%" }}>Job Name</th>
                        <td style={{ ...TD, fontWeight: 700 }}>{est.jobName || "—"}</td>
                        <th style={{ ...TH, width: "11%" }}>Brand Name</th>
                        <td style={TD}>{(est as any).brandName || "—"}</td>
                      </tr>
                      <tr>
                        <th style={TH}>Category</th>
                        <td style={TD}>{est.categoryName || "—"}</td>
                        <th style={TH}>Content / Structure</th>
                        <td style={TD}>{est.content || "—"}</td>
                        <th style={TH}>Pack Size</th>
                        <td style={TD}>{(est as any).packSize || "—"}</td>
                      </tr>
                      <tr>
                        <th style={TH}>SKU Type</th>
                        <td style={TD}>{(est as any).skuType || "—"}</td>
                        <th style={TH}>Artwork Name</th>
                        <td style={TD}>{(est as any).artworkName || "—"}</td>
                        <th style={TH}>Concern Person</th>
                        <td style={TD}>{(est as any).concernPerson || "—"}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* ── JOB SPECIFICATION ── */}
                  <div style={PH}>B · Job Specification</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px" }}>
                    <tbody>
                      <tr>
                        <th style={{ ...TH, width: "13%" }}>Job Size (W×H)</th>
                        <td style={{ ...TD, width: "13%" }}>{est.jobWidth} × {est.jobHeight} mm</td>
                        <th style={{ ...TH, width: "13%" }}>Actual Size (W×H)</th>
                        <td style={{ ...TD, width: "13%" }}>{est.actualWidth} × {est.actualHeight} mm</td>
                        <th style={{ ...TH, width: "11%" }}>Film Width</th>
                        <td style={{ ...TD, width: "11%" }}>{filmW} mm</td>
                        <th style={{ ...TH, width: "11%" }}>Repeat Length</th>
                        <td style={TD}>{est.repeatLength ? `${est.repeatLength} mm` : "—"}</td>
                      </tr>
                      <tr>
                        <th style={TH}>No. of Colors</th>
                        <td style={TD}>{est.noOfColors}C ({est.frontColors ?? "—"}F + {est.backColors ?? "—"}B)</td>
                        <th style={TH}>Print Type</th>
                        <td style={TD}>{est.printType || "—"}</td>
                        <th style={TH}>Machine</th>
                        <td style={TD}>{est.machineName || "—"}</td>
                        <th style={TH}>Wastage %</th>
                        <td style={TD}>{est.wastagePct ?? 1}%</td>
                      </tr>
                      <tr>
                        <th style={TH}>Quantity</th>
                        <td style={{ ...TD, fontWeight: 700 }}>{est.quantity.toLocaleString("en-IN")} {est.unit}</td>
                        <th style={TH}>Req. SQM</th>
                        <td style={TD}>{reqSQM.toFixed(2)} m²</td>
                        <th style={TH}>No. of Plys</th>
                        <td style={TD}>{est.secondaryLayers.length}</td>
                        <th style={TH}>Lamination Plies</th>
                        <td style={TD}>{(est as any).laminationPlies || "—"}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* ── MATERIAL SPECIFICATION (Film + all consumables combined) ── */}
                  {matRows.length > 0 && (
                    <>
                      <div style={PH}>C · Material Specification (Film + Ink + Adhesive + Solvent)</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px" }}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: "3%", textAlign: "center" }}>#</th>
                            <th style={{ ...TH, width: "7%" }}>Ply</th>
                            <th style={{ ...TH, width: "9%" }}>Group</th>
                            <th style={{ ...TH, width: "22%" }}>Material / Item</th>
                            <th style={{ ...TH, width: "11%" }}>Spec</th>
                            <th style={{ ...TH, width: "8%", textAlign: "center" }}>GSM / %</th>
                            <th style={{ ...TH, width: "11%", textAlign: "right" }}>Rate (₹/Kg)</th>
                            <th style={{ ...TH, width: "10%", textAlign: "right" }}>Req. Wt. (Kg)</th>
                            <th style={{ ...TH, width: "10%", textAlign: "right" }}>Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matRows.map((r, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f5f5f5" }}>
                              <td style={{ ...TD, textAlign: "center", fontWeight: 700 }}>{r.seq}</td>
                              <td style={{ ...TD, fontSize: "7.5pt", color: "#555" }}>{r.plyLabel}</td>
                              <td style={{ ...TD, fontSize: "7pt", fontWeight: 700 }}>{r.group}</td>
                              <td style={{ ...TD, fontWeight: r.group === "Film" ? 700 : 400 }}>{r.material}</td>
                              <td style={{ ...TD, fontSize: "7.5pt", color: "#555" }}>{r.spec}</td>
                              <td style={{ ...TD, textAlign: "center" }}>{r.gsm > 0 ? r.gsm.toFixed(2) : "—"}</td>
                              <td style={{ ...TD, textAlign: "right" }}>{r.rate > 0 ? `₹${r.rate}` : "—"}</td>
                              <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{r.reqKg > 0 ? r.reqKg.toFixed(3) : "—"}</td>
                              <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{r.amount > 0 ? INR(r.amount) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#efefef" }}>
                            <td colSpan={8} style={{ ...TD, fontWeight: 800, fontSize: "8pt", textAlign: "right", background: "#efefef" }}>Material Cost Total</td>
                            <td style={{ ...TD, textAlign: "right", fontWeight: 900, fontSize: "9pt" }}>{INR(matTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </>
                  )}

                  {/* ── PROCESS CHARGES ── */}
                  {est.processes.length > 0 && (
                    <>
                      <div style={PH}>D · Process Charges</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px" }}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: "3%", textAlign: "center" }}>#</th>
                            <th style={TH}>Process</th>
                            <th style={{ ...TH, width: "10%" }}>Charge Unit</th>
                            <th style={{ ...TH, width: "11%", textAlign: "right" }}>Rate (₹)</th>
                            <th style={{ ...TH, width: "11%", textAlign: "right" }}>Qty</th>
                            <th style={{ ...TH, width: "11%", textAlign: "right" }}>Setup (₹)</th>
                            <th style={{ ...TH, width: "13%", textAlign: "right" }}>Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {est.processes.map((p: any, i: number) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f5f5f5" }}>
                              <td style={{ ...TD, textAlign: "center" }}>{i + 1}</td>
                              <td style={{ ...TD, fontWeight: 700 }}>{p.processName}</td>
                              <td style={TD}>{p.chargeUnit}</td>
                              <td style={{ ...TD, textAlign: "right" }}>₹{p.rate}</td>
                              <td style={{ ...TD, textAlign: "right" }}>{Number(p.qty || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                              <td style={{ ...TD, textAlign: "right" }}>{p.setupCharge > 0 ? `₹${p.setupCharge}` : "—"}</td>
                              <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{INR(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#efefef" }}>
                            <td colSpan={6} style={{ ...TD, fontWeight: 800, textAlign: "right", background: "#efefef" }}>Process Cost Total</td>
                            <td style={{ ...TD, textAlign: "right", fontWeight: 900, fontSize: "9pt" }}>{INR(est.processCost)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </>
                  )}

                  {/* ── COST SUMMARY (2-panel: left breakdown, right metrics pyramid) ── */}
                  <div style={PH}>E · Cost Summary &amp; Profitability</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px" }}>
                    <tbody>
                      <tr>
                        {/* LEFT: Itemized breakdown */}
                        <td style={{ border: "1px solid #cbd5e1", padding: "0", width: "56%", verticalAlign: "top" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ background: "#f8fafc" }}>
                                <th style={{ ...TH, border: "none", borderBottom: "1px solid #cbd5e1", padding: "3px 7px" }}>Cost Component</th>
                                <th style={{ ...TH, border: "none", borderBottom: "1px solid #cbd5e1", padding: "3px 7px", textAlign: "right" as const }}>Amount (₹)</th>
                                <th style={{ ...TH, border: "none", borderBottom: "1px solid #cbd5e1", padding: "3px 7px", textAlign: "right" as const, width: "18%" }}>% of Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                ["Material Cost",      est.materialCost,       subTotal],
                                ["Process Cost",       est.processCost,        subTotal],
                                ["Cylinder Cost",      est.cylinderCost || 0,  subTotal],
                                ["Setup Cost",         est.setupCost || 0,     subTotal],
                                ["Packing Cost",       (est as any).packingCost || 0, subTotal],
                                ["Labour Cost",        est.labourCost || 0,    subTotal],
                                ["Transportation",     est.transportationCost || 0, subTotal],
                                ["Interest Cost",      est.interestCost || 0,  subTotal],
                                ["Depreciation Cost",  (est as any).depreciationCost || 0, subTotal],
                              ].map(([label, amt, base]) => (amt as number) > 0 ? (
                                <tr key={label as string}>
                                  <td style={{ ...TD, border: "none", borderBottom: "1px solid #ddd", padding: "2px 7px" }}>{label as string}</td>
                                  <td style={{ ...TD, border: "none", borderBottom: "1px solid #ddd", padding: "2px 7px", textAlign: "right", fontWeight: 600 }}>{INR(amt as number)}</td>
                                  <td style={{ ...TD, border: "none", borderBottom: "1px solid #ddd", padding: "2px 7px", textAlign: "right", fontSize: "7.5pt" }}>{(base as number) > 0 ? `${(((amt as number) / (base as number)) * 100).toFixed(1)}%` : "—"}</td>
                                </tr>
                              ) : null)}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: "#efefef" }}>
                                <td style={{ ...TD, border: "none", borderTop: "1.5px solid #888", padding: "3px 7px", fontWeight: 800 }}>Sub Total</td>
                                <td style={{ ...TD, border: "none", borderTop: "1.5px solid #888", padding: "3px 7px", textAlign: "right", fontWeight: 800 }}>{INR(subTotal)}</td>
                                <td style={{ ...TD, border: "none", borderTop: "1.5px solid #888", padding: "3px 7px" }}></td>
                              </tr>
                              <tr>
                                <td style={{ ...TD, border: "none", borderBottom: "1px solid #ddd", padding: "2px 7px" }}>+ Overhead ({est.overheadPct}%)</td>
                                <td style={{ ...TD, border: "none", borderBottom: "1px solid #ddd", padding: "2px 7px", textAlign: "right" }}>{INR(est.overheadAmt)}</td>
                                <td style={{ ...TD, border: "none", padding: "2px 7px" }}></td>
                              </tr>
                              <tr>
                                <td style={{ ...TD, border: "none", borderBottom: "1px solid #ddd", padding: "2px 7px" }}>+ Profit ({est.profitPct}%)</td>
                                <td style={{ ...TD, border: "none", borderBottom: "1px solid #ddd", padding: "2px 7px", textAlign: "right" }}>{INR(est.profitAmt)}</td>
                                <td style={{ ...TD, border: "none", padding: "2px 7px" }}></td>
                              </tr>
                              <tr style={{ background: "#000" }}>
                                <td style={{ border: "none", padding: "5px 7px", color: "#fff", fontWeight: 900, fontSize: "9pt" }}>TOTAL AMOUNT</td>
                                <td style={{ border: "none", padding: "5px 7px", textAlign: "right", color: "#fff", fontWeight: 900, fontSize: "11pt" }}>{INR(est.totalAmount)}</td>
                                <td style={{ border: "none", padding: "5px 7px" }}></td>
                              </tr>
                            </tfoot>
                          </table>
                        </td>

                        {/* RIGHT: Key metrics */}
                        <td style={{ border: "1px solid #cbd5e1", borderLeft: "none", padding: "0", width: "44%", verticalAlign: "top" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                              {[
                                [`${rateLabel} (with profit)`,    `₹${DEC(est.perMeterRate, 4)} / ${est.unit}`,         true],
                                [`${rateLabel} (without profit)`, `₹${DEC((est as any).perMeterRateWithoutProfit ?? ((est.totalAmount - est.profitAmt) / (est.quantity || 1)), 4)}`, false],
                                [`Gross Margin %`,                 `${DEC(est.marginPct ?? 0, 1)}%`,                     false],
                                [`Break-even Qty`,                 est.breakEvenQty > 0 ? `${est.breakEvenQty.toLocaleString("en-IN")} ${est.unit}` : "—", false],
                                [`Contribution / ${est.unit}`,    `₹${DEC(est.contribution ?? 0, 4)}`,                  false],
                                [`Total Qty × Rate Check`,         est.quantity > 0 ? `${est.quantity.toLocaleString("en-IN")} ${est.unit} @ ₹${DEC(est.perMeterRate, 2)}` : "—", false],
                              ].map(([label, value, isBig]) => (
                                <tr key={label as string} style={{ background: isBig ? "#000" : "#fff", borderBottom: "1px solid #ccc" }}>
                                  <td style={{ border: "none", padding: "4px 8px", color: isBig ? "#ccc" : "#444", fontSize: "6.5pt", fontWeight: 700, textTransform: "uppercase" as const }}>{label as string}</td>
                                  <td style={{ border: "none", padding: "4px 8px", color: isBig ? "#fff" : "#000", fontSize: isBig ? "11pt" : "9pt", fontWeight: 800, textAlign: "right" }}>{value as string}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* ── QUANTITY-WISE RATE MATRIX ── */}
                  {Array.isArray((est as any).quantities) && (est as any).quantities.length > 1 && (
                    <>
                      <div style={PH}>F · Quantity-wise Rate Comparison</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px" }}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: "5%", textAlign: "center" }}>#</th>
                            <th style={TH}>Quantity ({est.unit})</th>
                            <th style={{ ...TH, textAlign: "right" }}>{rateLabel} (w/ Profit)</th>
                            <th style={{ ...TH, textAlign: "right" }}>{rateLabel} (w/o Profit)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {((est as any).quantities as any[]).map((q: any, i: number) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                              <td style={{ ...TD, textAlign: "center" }}>{i + 1}</td>
                              <td style={{ ...TD, fontWeight: 700 }}>{Number(q.quantity || 0).toLocaleString("en-IN")}</td>
                              <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{q.perMeterRate ? `₹${DEC(q.perMeterRate, 4)}` : "—"}</td>
                              <td style={{ ...TD, textAlign: "right" }}>{q.perMeterRateWithoutProfit ? `₹${DEC(q.perMeterRateWithoutProfit, 4)}` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* ── COMMERCIAL TERMS & REMARKS ── */}
                  {(est.remarks || (est as any).specialSpecs) && (
                    <>
                      <div style={PH}>G · Terms &amp; Remarks</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px" }}>
                        <tbody>
                          {(est as any).specialSpecs && (
                            <tr><th style={{ ...TH, width: "15%" }}>Special Specs</th><td style={TD}>{(est as any).specialSpecs}</td></tr>
                          )}
                          {est.remarks && (
                            <tr><th style={TH}>Remarks / Notes</th><td style={TD}>{est.remarks}</td></tr>
                          )}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* ── SIGN-OFF ── */}
                  <div style={{ borderTop: "2px solid #000", marginTop: "6px", paddingTop: "5px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        <tr>
                          {["Prepared By", "Reviewed By (Costing)", "Approved By", "Customer Acceptance"].map((role, i) => (
                            <td key={i} style={{ border: "1px solid #999", textAlign: "center", padding: "4px 6px", width: "25%" }}>
                              <div style={{ height: "30px", borderBottom: "1px solid #999", marginBottom: "4px" }} />
                              <div style={{ fontSize: "7.5pt", fontWeight: 800, color: "#000", letterSpacing: "0.3px" }}>{role}</div>
                              <div style={{ fontSize: "6.5pt", color: "#555", marginTop: "2px" }}>Name / Designation / Date</div>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ fontSize: "6.5pt", color: "#666", textAlign: "center", marginTop: "4px", letterSpacing: "0.3px" }}>
                      Generated by AJ Shrink ERP · {today} · {companyName} · This is a computer generated document
                    </div>
                  </div>

                </div>{/* end print area */}
              </div>
            </div>
          </>
        );
      })()}


      {/* Delete Confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Delete this estimation? This cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={async () => {
            if (!deleteId) return;
            try {
              const res: any = await apiGet(`api/gravureestimationShrink/deleteestimation/${deleteId}`);
              const parsed = Array.isArray(res) ? res[0] : res;
              if (parsed?.Status !== "success") {
                alert("Delete failed: " + (parsed?.Message || "Unknown error")); return;
              }
              setDeleteId(null);
              await loadList();
            } catch (err: any) { alert("Delete error: " + (err?.message || String(err))); }
          }}>Delete</Button>
        </div>
      </Modal>



    </div>
  );
}
