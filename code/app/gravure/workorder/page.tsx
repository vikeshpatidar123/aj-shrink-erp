"use client";
import { useState, useMemo } from "react";
import {
  Eye, Pencil, Trash2, Printer, CheckCircle2, ClipboardList,
  Clock, RefreshCw, Edit3, Calculator, BookMarked, ChevronRight,
  Layers, AlertCircle, ArrowRight, Plus, X, Check, Save,
} from "lucide-react";
import {
  gravureWorkOrders as initWOs, gravureOrders as initOrders,
  machines, employees, processMasters, items, customers,
  GravureWorkOrder, GravureOrder, GravureEstimationProcess,
  SecondaryLayer, PlyConsumableItem, CATEGORY_GROUP_SUBGROUP,
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
const ROTO_PROCESSES = processMasters.filter(p => p.module === "Rotogravure");
const PRINT_MACHINES = machines.filter(m => m.department === "Printing");
const FILM_ITEMS = items.filter(i => i.group === "Film" && i.active);
const FILM_SUBGROUPS = Array.from(
  new Map(FILM_ITEMS.filter(i => i.subGroup).map(i => [i.subGroup, { subGroup: i.subGroup, density: parseFloat(i.density) || 0, thicknesses: new Set<number>() }])).entries()
).map(([subGroup, data]) => {
  FILM_ITEMS.filter(i => i.subGroup === subGroup).forEach(i => { const t = parseFloat(i.thickness); if (!isNaN(t) && t > 0) data.thicknesses.add(t); });
  return { subGroup, density: data.density, thicknesses: Array.from(data.thicknesses).sort((a, b) => a - b) };
});

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
  const [modalTab,  setModalTab] = useState<"basic" | "planning" | "operator">("basic");
  const [showPlan,      setShowPlan]      = useState(false);
  const [isPlanApplied, setIsPlanApplied] = useState(false);

  // ── View Plan ─────────────────────────────────────────────
  const [viewPlanWO, setViewPlanWO]   = useState<GravureWorkOrder | null>(null);

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
      status: "Active",
      remarks: catSaveWO.specialInstructions || "",
    };
    saveCatalogItem(item);
    setCatSaveWO(null);
    alert(`Saved to Product Catalog as ${item.catalogNo}`);
  };

  const f = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── Ply helpers ─────────────────────────────────────────────
  const getCategoryConsumables = (categoryId: string, plyType: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat?.plyConsumables || !plyType || plyType === "Film") return [];
    return cat.plyConsumables.filter((pc: { plyType: string }) => pc.plyType === plyType);
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

  // ── Toggle process ─────────────────────────────────────────
  const toggleProcess = (pm: typeof ROTO_PROCESSES[0]) =>
    setForm(p => {
      const exists = p.processes.some(x => x.processId === pm.id);
      if (exists) return { ...p, processes: p.processes.filter(x => x.processId !== pm.id) };
      return { ...p, processes: [...p.processes, { processId: pm.id, processName: pm.name, chargeUnit: pm.chargeUnit, rate: parseFloat(pm.rate) || 0, qty: 0, setupCharge: pm.makeSetupCharges ? parseFloat(pm.setupChargeAmount) || 0 : 0, amount: 0 } as GravureEstimationProcess] };
    });

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
    });
    setModalTab("basic");
    setShowPlan(false); setIsPlanApplied(false);
    setModal(true);
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
    setModal(true);
  };

  // ── Save ───────────────────────────────────────────────────
  const save = () => {
    if (!form.customerId || !form.machineId) {
      alert("Customer and Machine are required."); return;
    }
    if (editing) {
      setWOs(d => d.map(r => r.id === editing.id ? { ...form, id: editing.id, workOrderNo: editing.workOrderNo } : r));
    } else {
      const workOrderNo = generateCode(UNIT_CODE.Gravure, MODULE_CODE.WorkOrder, workOrders.map(d => d.workOrderNo));
      const id = `GVWO${String(workOrders.length + 1).padStart(3, "0")}`;
      setWOs(d => [...d, { ...form, id, workOrderNo }]);
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
    { key: "status",       header: "Status",   render: r => statusBadge(r.status), sortable: true },
  ];

  // ── Form Modal inner content ───────────────────────────────
  const formContent = (
    <div className="space-y-4">
      {/* Modal tabs */}
      <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
        {(["basic", "planning"] as const).map(t => (
          <button key={t} onClick={() => setModalTab(t)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all capitalize ${modalTab === t ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "basic" ? "1. Basic Info" : "2. Planning"}
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
              <div className="grid grid-cols-3 gap-2 mb-3">
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                    const cat = categories.find(c => c.id === e.target.value);
                    if (cat) {
                      setForm(p => ({
                        ...p,
                        categoryId: cat.id,
                        categoryName: cat.name,
                        // reset secondaryLayers with 1 empty ply slot (user adjusts count via No. of Plys)
                        secondaryLayers: Array.from({ length: 1 }, (_, i) => ({
                          id: Math.random().toString(),
                          layerNo: i + 1,
                          plyType: "",
                          itemSubGroup: "",
                          density: 0, thickness: 0, gsm: 0,
                          consumableItems: [],
                        } as SecondaryLayer)),
                      }));
                    } else {
                      setForm(p => ({ ...p, categoryId: "", categoryName: "", secondaryLayers: [] }));
                    }
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
              <Input label="No. of Colors" type="number" value={form.noOfColors} onChange={e => f("noOfColors", Number(e.target.value))} min={1} max={12} />
              <Select label="Print Type" value={form.printType} onChange={e => f("printType", e.target.value as typeof form.printType)}
                options={[{ value: "Surface Print", label: "Surface Print" }, { value: "Reverse Print", label: "Reverse Print" }, { value: "Combination", label: "Combination" }]} />
              <Input label="Quantity" type="number" value={form.quantity || ""} onChange={e => f("quantity", Number(e.target.value))} />
              <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)}
                options={[{ value: "Meter", label: "Meter" }, { value: "Kg", label: "Kg" }]} />
              <Input label="Cylinder Set" value={form.cylinderSet} onChange={e => f("cylinderSet", e.target.value)} placeholder="e.g. CYL-P001" />
              <Input label="Planned Date" type="date" value={form.plannedDate} onChange={e => f("plannedDate", e.target.value)} />
              <Select label="Status" value={form.status} onChange={e => f("status", e.target.value as typeof form.status)}
                options={[{ value: "Open", label: "Open" }, { value: "In Progress", label: "In Progress" }, { value: "Completed", label: "Completed" }, { value: "On Hold", label: "On Hold" }]} />
            </div>
          </div>

          {form.totalAmount > 0 && (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-50 border rounded-xl p-3"><p className="text-xs text-gray-400">Total Amount</p><p className="font-bold">₹{form.totalAmount.toLocaleString()}</p></div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3"><p className="text-xs text-gray-400">₹/Meter Rate</p><p className="font-bold text-blue-700">₹{form.perMeterRate.toFixed(2)}</p></div>
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

          {/* Machine & Cost */}
          <div>
            <SH label="Machine & Cost" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Select label="Printing Machine *" value={form.machineId}
                onChange={e => { const m = PRINT_MACHINES.find(x => x.id === e.target.value); if (m) { f("machineId", m.id); f("machineName", m.name); } }}
                options={[{ value: "", label: "-- Select Machine --" }, ...PRINT_MACHINES.map(m => ({ value: m.id, label: `${m.name} (${m.status})` }))]}
              />
              <Input label="Cylinder Cost/Color (₹)" type="number" value={form.cylinderCostPerColor || ""} onChange={e => f("cylinderCostPerColor", Number(e.target.value))} />
              <Input label="Total Amount (₹)" type="number" value={form.totalAmount || ""} onChange={e => f("totalAmount", Number(e.target.value))} />
              <Input label="₹/Meter Rate" type="number" value={form.perMeterRate || ""} onChange={e => f("perMeterRate", Number(e.target.value))} />
            </div>
          </div>

          {/* Process Planning */}
          <div>
            <SH label={`Process Planning (${form.processes.length} selected)`} />
            <div className="flex flex-wrap gap-2">
              {ROTO_PROCESSES.map(pm => {
                const selected = form.processes.some(p => p.processId === pm.id);
                return (
                  <button key={pm.id} onClick={() => toggleProcess(pm)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${selected ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700"}`}>
                    {selected && <CheckCircle2 size={11} />}
                    {pm.name}
                    <span className={`text-[10px] ${selected ? "text-purple-200" : "text-gray-400"}`}>₹{pm.rate}/{pm.chargeUnit}</span>
                  </button>
                );
              })}
            </div>
            {form.processes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {form.processes.map((p, i) => (
                  <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium flex items-center gap-1">
                    <Layers size={10} />{p.processName}
                  </span>
                ))}
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
                          {l.plyType && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              l.plyType === "Printing" ? "bg-blue-50 text-blue-700 border-blue-200" :
                              l.plyType === "Lamination" ? "bg-orange-50 text-orange-700 border-orange-200" :
                              l.plyType === "Coating" ? "bg-green-50 text-green-700 border-green-200" :
                              "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>{l.plyType}</span>
                          )}
                          <button onClick={() => f("secondaryLayers", form.secondaryLayers.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                        </div>
                      </div>
                      <div className="p-3 space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Ply Type *</label>
                          <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-purple-400"
                            value={l.plyType} onChange={e => onPlyTypeChange(index, e.target.value)}>
                            <option value="">-- Select Ply Type --</option>
                            <option value="Film">1st Ply (Film / Substrate)</option>
                            <option value="Printing">2nd Ply (Printing)</option>
                            <option value="Lamination">3rd Ply (Lamination)</option>
                            <option value="Coating">4th Ply (Coating)</option>
                          </select>
                        </div>
                        {l.plyType && (
                          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Film / Substrate</p>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Sub Group</label>
                              <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                value={l.itemSubGroup}
                                onChange={e => {
                                  const subGroup = e.target.value;
                                  const sg = FILM_SUBGROUPS.find(s => s.subGroup === subGroup);
                                  const density = sg ? sg.density : 0;
                                  const layers = [...form.secondaryLayers];
                                  layers[index] = { ...l, itemSubGroup: subGroup, density, thickness: 0, gsm: 0 };
                                  f("secondaryLayers", layers);
                                }}>
                                <option value="">Select Film Sub Group</option>
                                {FILM_SUBGROUPS.map(opt => <option key={opt.subGroup} value={opt.subGroup}>{opt.subGroup}</option>)}
                              </select>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
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
                                  <div className="grid grid-cols-3 gap-2">
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
                <button onClick={() => setShowPlan(!showPlan)}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200">
                  <Eye size={12} /> {showPlan ? "Hide Plan" : "View Plan"}
                </button>
              </div>
              {form.selectedPlanId && !showPlan && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle2 size={14} className="text-green-600" />
                  Plan applied: <strong>{form.selectedPlanId}</strong> — UPS: {form.ups}
                </div>
              )}
              {showPlan && !isPlanApplied && (
                <div className="border-2 border-indigo-100 rounded-2xl overflow-hidden shadow-lg">
                  <div className="bg-gradient-to-r from-indigo-800 to-purple-800 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-xs uppercase tracking-wide">Select Production Plan</p>
                      <p className="text-indigo-200 text-[10px] mt-0.5">{form.machineName}</p>
                    </div>
                    {form.selectedPlanId && (
                      <button onClick={() => { setIsPlanApplied(true); setShowPlan(false); }} className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg">Apply Plan</button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-[10px] whitespace-nowrap border-collapse">
                      <thead className="bg-slate-800 text-slate-300">
                        <tr>
                          {["Select","Machine","Cyl. Circ.","Roll Name","Roll Width","Ac Ups","Repeat UPS","Total UPS","Req RMT","Total RMT","Total Wt","Time","Plan Cost","Grand Total","Unit Price"].map(h => (
                            <th key={h} className="p-2 border border-slate-700 text-center whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {[1,2,3,4,5,6,7].map((_, i) => {
                          const planId = `PLAN-${form.machineId}-${i}`;
                          const repeat = form.jobHeight ? form.jobHeight + (i * 12) : 600 + (i * 12);
                          const upsCount = 10 + i;
                          const isSelected = form.selectedPlanId === planId;
                          return (
                            <tr key={planId} onClick={() => { f("selectedPlanId", planId); f("ups", upsCount); }}
                              className={`cursor-pointer transition-colors ${isSelected ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                              <td className="p-2 border border-gray-100 text-center">
                                <div className={`w-4 h-4 rounded-full border-2 mx-auto flex items-center justify-center ${isSelected ? "border-indigo-600 bg-indigo-600" : "border-gray-300 bg-white"}`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </td>
                              <td className="p-2 border border-gray-100 font-medium text-gray-700">{form.machineName}</td>
                              <td className="p-2 border border-gray-100 text-center font-mono">{repeat}</td>
                              <td className="p-2 border border-gray-100 text-gray-500 max-w-[120px] truncate">W={form.jobWidth}mm</td>
                              <td className="p-2 border border-gray-100 text-center">{form.jobWidth}</td>
                              <td className="p-2 border border-gray-100 text-center">10</td>
                              <td className="p-2 border border-gray-100 text-center">{upsCount}</td>
                              <td className="p-2 border border-gray-100 text-center font-bold">{10 * upsCount}</td>
                              <td className="p-2 border border-gray-100 text-center">1</td>
                              <td className="p-2 border border-gray-100 text-center">101</td>
                              <td className="p-2 border border-gray-100 text-center text-blue-600 font-semibold">0.07</td>
                              <td className="p-2 border border-gray-100 text-center">1</td>
                              <td className="p-2 border border-gray-100 text-center">3.85</td>
                              <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700">₹89.6</td>
                              <td className="p-2 border border-gray-100 text-center text-indigo-600">0.09</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {form.selectedPlanId && (
                    <div className="bg-indigo-900 text-indigo-100 px-4 py-2.5 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-2"><Check size={12} className="text-green-400" /> Plan <strong>{form.selectedPlanId}</strong> selected</span>
                      <button onClick={() => { setIsPlanApplied(true); setShowPlan(false); }} className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-lg">Apply</button>
                    </div>
                  )}
                </div>
              )}
              {isPlanApplied && form.secondaryLayers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-indigo-900">Ply / Layer Calculation — Plan: {form.selectedPlanId}</p>
                    <button onClick={() => { setIsPlanApplied(false); setShowPlan(true); }} className="text-xs text-indigo-600 hover:underline">Change Plan</button>
                  </div>
                  <div className="border-2 border-indigo-50 rounded-2xl overflow-hidden shadow-lg">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[10px] border-collapse">
                        <thead className="bg-indigo-700 text-white uppercase tracking-wider font-bold">
                          <tr>
                            {["Layer","Item Code","Item Group","Item Name","Thick","Dens","GSM","Size W","Ratio","Req.Mtr","Req.SQM","Req.Wt","Wast.Mtr","Wast.SQM","Wast.Wt","Total Mtr","Total SQM","Total Wt"].map(h => (
                              <th key={h} className="p-2 border border-indigo-600/30 text-center whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {form.secondaryLayers.map((l, idx) => (
                            <tr key={l.id} className="hover:bg-indigo-50/30">
                              <td className="p-2 border border-gray-100 text-center font-black text-indigo-900 bg-indigo-50/20">{idx + 1}</td>
                              <td className="p-2 border border-gray-100 text-gray-500">RR000{idx + 2}</td>
                              <td className="p-2 border border-gray-100 text-gray-500">Gravure Roll</td>
                              <td className="p-2 border border-gray-100 font-medium text-gray-700 min-w-[150px] whitespace-normal">{l.itemSubGroup || "—"}</td>
                              <td className="p-2 border border-gray-100 text-center font-mono">{l.thickness}</td>
                              <td className="p-2 border border-gray-100 text-center font-mono">{l.density}</td>
                              <td className="p-2 border border-gray-100 text-center font-bold text-indigo-700">{l.gsm}</td>
                              <td className="p-2 border border-gray-100 text-center font-mono">{form.jobWidth}</td>
                              <td className="p-2 border border-gray-100 text-center text-gray-600">9.74</td>
                              <td className="p-2 border border-gray-100 text-center font-mono">1</td>
                              <td className="p-2 border border-gray-100 text-center">0.23</td>
                              <td className="p-2 border border-gray-100 text-center font-bold text-blue-600">0.001</td>
                              <td className="p-2 border border-gray-100 text-center text-gray-500">100</td>
                              <td className="p-2 border border-gray-100 text-center text-gray-500">23</td>
                              <td className="p-2 border border-gray-100 text-center text-gray-500">0.069</td>
                              <td className="p-2 border border-gray-100 text-center text-gray-600">101</td>
                              <td className="p-2 border border-gray-100 text-center text-gray-600">23.23</td>
                              <td className="p-2 border border-gray-100 text-center font-black text-gray-900 bg-gray-50">0.07</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2 border-indigo-200">
                          <tr className="font-bold">
                            <td colSpan={17} className="p-3 text-right text-indigo-900 uppercase text-[10px]">Total Weight (Kg)</td>
                            <td className="p-3 text-center bg-indigo-100 text-indigo-900 text-xs">{(form.secondaryLayers.length * 0.07).toFixed(3)}</td>
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
            <Button icon={<Printer size={14} />} onClick={save}>{editing ? "Update Work Order" : "Create Work Order"}</Button>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
      <div className="flex bg-gray-100 p-1.5 rounded-xl gap-1.5">
        <button onClick={() => setPageTab("pending")}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${pageTab === "pending" ? "bg-white shadow text-orange-600" : "text-gray-500 hover:text-gray-700"}`}>
          <Clock size={15} />
          Pending Orders
          {stats.pending > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white">{stats.pending}</span>
          )}
        </button>
        <button onClick={() => setPageTab("workorders")}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${pageTab === "workorders" ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
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
                      {order.perMeterRate > 0 && <p className="text-xs text-green-600">₹{order.perMeterRate.toFixed(2)}/m</p>}
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
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <RefreshCw size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            <strong>Replan Mode:</strong> The original planning from {editing?.sourceOrderType === "Estimation" ? "Order Booking" : "Direct Entry"} is shown.
            Add/remove processes and change machine as needed. Other fields remain locked.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <SH label="Machine" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Select label="Printing Machine" value={form.machineId}
                onChange={e => { const m = PRINT_MACHINES.find(x => x.id === e.target.value); if (m) { f("machineId", m.id); f("machineName", m.name); } }}
                options={[{ value: "", label: "-- Select Machine --" }, ...PRINT_MACHINES.map(m => ({ value: m.id, label: `${m.name} (${m.status})` }))]}
              />
              <Input label="₹/Meter Rate" type="number" value={form.perMeterRate || ""} onChange={e => f("perMeterRate", Number(e.target.value))} />
              <Input label="Total Amount (₹)" type="number" value={form.totalAmount || ""} onChange={e => f("totalAmount", Number(e.target.value))} />
            </div>
          </div>

          <div>
            <SH label={`Process Planning (${form.processes.length} selected)`} />
            <div className="flex flex-wrap gap-2">
              {ROTO_PROCESSES.map(pm => {
                const selected = form.processes.some(p => p.processId === pm.id);
                return (
                  <button key={pm.id} onClick={() => toggleProcess(pm)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${selected ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700"}`}>
                    {selected && <CheckCircle2 size={11} />}
                    {pm.name}
                  </button>
                );
              })}
            </div>
            {form.processes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {form.processes.map((p, i) => <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs">{p.processName}</span>)}
              </div>
            )}
          </div>

          <Textarea label="Special Instructions" value={form.specialInstructions} onChange={e => f("specialInstructions", e.target.value)} placeholder="Notes for this replan…" />
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="secondary" onClick={() => setReplan(false)}>Cancel</Button>
          <Button icon={<RefreshCw size={14} />} onClick={save}>Save Replan</Button>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

      {/* ══ SAVE TO CATALOG MODAL ═════════════════════════════════ */}
      {catSaveWO && (
        <Modal open={!!catSaveWO} onClose={() => setCatSaveWO(null)} title="Save Work Order as Product Catalog Template" size="sm">
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-700">
              <p className="font-bold mb-1">Work Order: {catSaveWO.workOrderNo}</p>
              <p>Customer: {catSaveWO.customerName} · {catSaveWO.noOfColors}C · {catSaveWO.substrate || "—"}</p>
              <p className="mt-1">{catSaveWO.processes.length} processes · {catSaveWO.secondaryLayers.length} plys · ₹{catSaveWO.perMeterRate.toFixed(2)}/m</p>
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
