"use client";
import { useState, useMemo } from "react";
import {
  BookMarked, Eye, Trash2, RefreshCw, Clock, CheckCircle2,
  ShoppingCart, Layers, CheckCircle, AlertCircle, Plus, X,
} from "lucide-react";
import {
  machines, processMasters, gravureOrders, gravureWorkOrders as initWOs,
  GravureProductCatalog, GravureOrder, GravureWorkOrder,
  SecondaryLayer, GravureEstimationProcess,
} from "@/data/dummyData";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { PlanViewer, PlanInput } from "@/components/gravure/PlanViewer";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button   from "@/components/ui/Button";
import Modal    from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

// ─── Constants ────────────────────────────────────────────────
const ROTO_PROCESSES = processMasters.filter(p => p.module === "Rotogravure");
const PRINT_MACHINES = machines.filter(m => m.department === "Printing");

// ─── Section Header ───────────────────────────────────────────
const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3 pb-2 border-b border-purple-100">{label}</p>
);

// ─── Blank planning form ──────────────────────────────────────
const blankPlan = {
  productName:          "",
  substrate:            "",
  machineId:            "",
  machineName:          "",
  cylinderCostPerColor: 3500,
  noOfColors:           6,
  printType:            "Surface Print" as "Surface Print" | "Reverse Print" | "Combination",
  jobWidth:             0,
  jobHeight:            0,
  standardQty:          0,
  standardUnit:         "Meter",
  overheadPct:          12,
  profitPct:            15,
  perMeterRate:         0,
  processes:            [] as GravureEstimationProcess[],
  secondaryLayers:      [] as SecondaryLayer[],
  remarks:              "",
};

// ─── Main Page ────────────────────────────────────────────────
export default function ProductCatalogPage() {
  const { catalog, saveCatalogItem, deleteCatalogItem } = useProductCatalog();
  const [workOrders] = useState<GravureWorkOrder[]>(initWOs);

  // ── Tabs ─────────────────────────────────────────────────────
  const [catalogTab, setCatalogTab] = useState<"pending" | "processed">("pending");

  // ── View Plan ────────────────────────────────────────────────
  const [viewPlanRow, setViewPlanRow] = useState<GravureProductCatalog | null>(null);

  // ── Create Catalog modal ──────────────────────────────────────
  const [createOpen,  setCreateOpen]  = useState(false);
  const [sourceOrder, setSourceOrder] = useState<GravureOrder | null>(null);
  const [sourceWO,    setSourceWO]    = useState<GravureWorkOrder | null>(null);
  const [planForm,    setPlanForm]    = useState({ ...blankPlan });

  // ── Replan modal ──────────────────────────────────────────────
  const [replanRow,  setReplanRow]  = useState<GravureProductCatalog | null>(null);
  const [replanForm, setReplanForm] = useState({ ...blankPlan });

  // ── Delete ────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Field helpers ─────────────────────────────────────────────
  const fp = <K extends keyof typeof blankPlan>(k: K, v: (typeof blankPlan)[K]) =>
    setPlanForm(p => ({ ...p, [k]: v }));
  const fr = <K extends keyof typeof blankPlan>(k: K, v: (typeof blankPlan)[K]) =>
    setReplanForm(p => ({ ...p, [k]: v }));

  // ── Which orders already have a catalog entry ─────────────────
  const catalogedOrderIds = useMemo(() => {
    const ids = new Set<string>();
    catalog.forEach(c => { if (c.sourceOrderId) ids.add(c.sourceOrderId); });
    return ids;
  }, [catalog]);

  // ── Pending = orders NOT yet converted ───────────────────────
  const pendingOrders = useMemo(() =>
    gravureOrders.filter(o => !catalogedOrderIds.has(o.id)),
    [catalogedOrderIds]
  );

  // ── Processed = catalog entries from orders ───────────────────
  const processedCatalog = useMemo(() =>
    catalog.filter(c => !!c.sourceOrderId),
    [catalog]
  );

  // ── Open Create flow ──────────────────────────────────────────
  const openCreate = (order: GravureOrder) => {
    setSourceOrder(order);
    const wo = workOrders.find(w => w.orderId === order.id) || null;
    setSourceWO(wo);
    const line = order.orderLines?.[0];

    if (wo) {
      setPlanForm({
        productName:          wo.jobName || line?.productName || "",
        substrate:            wo.substrate || line?.substrate || "",
        machineId:            wo.machineId,
        machineName:          wo.machineName,
        cylinderCostPerColor: wo.cylinderCostPerColor || 3500,
        noOfColors:           wo.noOfColors || line?.noOfColors || 6,
        printType:            wo.printType || "Surface Print",
        jobWidth:             wo.jobWidth  || line?.jobWidth  || 0,
        jobHeight:            wo.jobHeight || line?.jobHeight || 0,
        standardQty:          wo.quantity  || line?.orderQty  || 0,
        standardUnit:         wo.unit      || line?.unit      || "Meter",
        overheadPct:          wo.overheadPct || 12,
        profitPct:            wo.profitPct   || 15,
        perMeterRate:         wo.perMeterRate || line?.rate || 0,
        processes:            [...(wo.processes || [])],
        secondaryLayers:      [...(wo.secondaryLayers || [])],
        remarks:              wo.specialInstructions || "",
      });
    } else {
      setPlanForm({
        ...blankPlan,
        productName:  line?.productName || order.jobName || "",
        substrate:    line?.substrate   || order.substrate || "",
        noOfColors:   line?.noOfColors  || order.noOfColors || 6,
        printType:    (line?.printType  as typeof blankPlan.printType) || "Surface Print",
        jobWidth:     line?.jobWidth    || order.jobWidth  || 0,
        jobHeight:    line?.jobHeight   || order.jobHeight || 0,
        standardQty:  line?.orderQty   || order.quantity  || 0,
        standardUnit: line?.unit       || order.unit      || "Meter",
        perMeterRate: line?.rate       || order.perMeterRate || 0,
        processes:    [...(order.processes || [])],
        secondaryLayers: [...(order.secondaryLayers || [])],
      });
    }
    setCreateOpen(true);
  };

  // ── Save new catalog from pending order ───────────────────────
  const saveCatalog = () => {
    if (!sourceOrder || !planForm.productName.trim()) {
      alert("Product Name is required."); return;
    }
    const n = catalog.length + 1;
    const item: GravureProductCatalog = {
      id:        `GPC${String(n).padStart(3, "0")}`,
      catalogNo: `GRV-CAT-${String(n).padStart(3, "0")}`,
      createdDate: new Date().toISOString().slice(0, 10),
      productName:  planForm.productName,
      customerId:   sourceOrder.customerId,
      customerName: sourceOrder.customerName,
      categoryId: "", categoryName: "", content: "",
      jobWidth:    planForm.jobWidth,
      jobHeight:   planForm.jobHeight,
      actualWidth:  planForm.jobWidth,
      actualHeight: planForm.jobHeight,
      noOfColors:  planForm.noOfColors,
      printType:   planForm.printType,
      substrate:   planForm.substrate,
      secondaryLayers:      planForm.secondaryLayers,
      processes:            planForm.processes,
      machineId:   planForm.machineId,
      machineName: planForm.machineName,
      cylinderCostPerColor: planForm.cylinderCostPerColor,
      overheadPct: planForm.overheadPct,
      profitPct:   planForm.profitPct,
      perMeterRate: planForm.perMeterRate,
      standardQty:  planForm.standardQty,
      standardUnit: planForm.standardUnit,
      sourceEstimationId: "", sourceEstimationNo: "",
      sourceOrderId:   sourceOrder.id,
      sourceOrderNo:   sourceOrder.orderNo,
      sourceWorkOrderId:  sourceWO?.id   || "",
      sourceWorkOrderNo:  sourceWO?.workOrderNo || "",
      status: "Active",
      remarks: planForm.remarks,
    };
    saveCatalogItem(item);
    setCreateOpen(false);
    setSourceOrder(null);
    setSourceWO(null);
    setCatalogTab("processed");
  };

  // ── Open Replan ───────────────────────────────────────────────
  const openReplan = (row: GravureProductCatalog) => {
    setReplanRow(row);
    setReplanForm({
      productName:          row.productName,
      substrate:            row.substrate,
      machineId:            row.machineId,
      machineName:          row.machineName,
      cylinderCostPerColor: row.cylinderCostPerColor,
      noOfColors:           row.noOfColors,
      printType:            row.printType,
      jobWidth:             row.jobWidth,
      jobHeight:            row.jobHeight,
      standardQty:          row.standardQty,
      standardUnit:         row.standardUnit,
      overheadPct:          row.overheadPct,
      profitPct:            row.profitPct,
      perMeterRate:         row.perMeterRate,
      processes:            [...row.processes],
      secondaryLayers:      [...row.secondaryLayers],
      remarks:              row.remarks,
    });
  };

  // ── Save Replan ───────────────────────────────────────────────
  const saveReplan = () => {
    if (!replanRow) return;
    saveCatalogItem({
      ...replanRow,
      productName:          replanForm.productName,
      substrate:            replanForm.substrate,
      machineId:            replanForm.machineId,
      machineName:          replanForm.machineName,
      cylinderCostPerColor: replanForm.cylinderCostPerColor,
      noOfColors:           replanForm.noOfColors,
      printType:            replanForm.printType,
      jobWidth:             replanForm.jobWidth,
      jobHeight:            replanForm.jobHeight,
      standardQty:          replanForm.standardQty,
      standardUnit:         replanForm.standardUnit,
      overheadPct:          replanForm.overheadPct,
      profitPct:            replanForm.profitPct,
      perMeterRate:         replanForm.perMeterRate,
      processes:            replanForm.processes,
      secondaryLayers:      replanForm.secondaryLayers,
      remarks:              replanForm.remarks,
    });
    setReplanRow(null);
  };

  // ── Process toggles ───────────────────────────────────────────
  const togglePlanProc = (pm: typeof ROTO_PROCESSES[0]) => {
    const exists = planForm.processes.some(p => p.processId === pm.id);
    fp("processes", exists
      ? planForm.processes.filter(p => p.processId !== pm.id)
      : [...planForm.processes, { processId: pm.id, processName: pm.name, chargeUnit: pm.chargeUnit, rate: parseFloat(pm.rate) || 0, qty: 0, setupCharge: pm.makeSetupCharges ? parseFloat(pm.setupChargeAmount) || 0 : 0, amount: 0 } as GravureEstimationProcess]
    );
  };

  const toggleReplanProc = (pm: typeof ROTO_PROCESSES[0]) => {
    const exists = replanForm.processes.some(p => p.processId === pm.id);
    fr("processes", exists
      ? replanForm.processes.filter(p => p.processId !== pm.id)
      : [...replanForm.processes, { processId: pm.id, processName: pm.name, chargeUnit: pm.chargeUnit, rate: parseFloat(pm.rate) || 0, qty: 0, setupCharge: pm.makeSetupCharges ? parseFloat(pm.setupChargeAmount) || 0 : 0, amount: 0 } as GravureEstimationProcess]
    );
  };

  // ── Stats ──────────────────────────────────────────────────────
  const stats = { pending: pendingOrders.length, processed: processedCatalog.length };

  // ── Processed table columns ────────────────────────────────────
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
    { key: "noOfColors",  header: "Colors",
      render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "perMeterRate", header: "₹/Meter",
      render: r => <span className="font-semibold">₹{r.perMeterRate.toFixed(2)}</span> },
    { key: "status", header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  // ── Shared planning form JSX (used in Create + Replan modals) ──
  const PlanningFields = ({
    form, machineChg, cylChg, procToggle, ohChg, pfChg, qtyChg, unitChg, rateChg, remChg,
  }: {
    form: typeof blankPlan;
    machineChg: (id: string, name: string) => void;
    cylChg: (v: number) => void;
    procToggle: (pm: typeof ROTO_PROCESSES[0]) => void;
    ohChg: (v: number) => void;
    pfChg: (v: number) => void;
    qtyChg: (v: number) => void;
    unitChg: (v: string) => void;
    rateChg: (v: number) => void;
    remChg: (v: string) => void;
  }) => (
    <div className="space-y-4">
      {/* Machine & Cost */}
      <div>
        <SH label="Machine & Cost" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Select label="Printing Machine" value={form.machineId}
            onChange={e => { const m = PRINT_MACHINES.find(x => x.id === e.target.value); machineChg(e.target.value, m?.name || ""); }}
            options={[{ value: "", label: "-- Select Machine --" }, ...PRINT_MACHINES.map(m => ({ value: m.id, label: `${m.name} (${m.status})` }))]}
          />
          <Input label="Cylinder Cost/Color (₹)" type="number" value={form.cylinderCostPerColor || ""} onChange={e => cylChg(Number(e.target.value))} />
          <Input label="Overhead %" type="number" value={form.overheadPct || ""} onChange={e => ohChg(Number(e.target.value))} />
          <Input label="Profit %"   type="number" value={form.profitPct   || ""} onChange={e => pfChg(Number(e.target.value))} />
          <Input label="Standard Qty" type="number" value={form.standardQty || ""} onChange={e => qtyChg(Number(e.target.value))} />
          <Select label="Unit" value={form.standardUnit} onChange={e => unitChg(e.target.value)}
            options={[{ value: "Meter", label: "Meter" }, { value: "Kg", label: "Kg" }]} />
          <Input label="₹/Meter Rate" type="number" value={form.perMeterRate || ""} onChange={e => rateChg(Number(e.target.value))} />
        </div>
      </div>

      {/* Processes */}
      <div>
        <SH label={`Processes (${form.processes.length} selected)`} />
        <div className="flex flex-wrap gap-2">
          {ROTO_PROCESSES.map(pm => {
            const sel = form.processes.some(p => p.processId === pm.id);
            return (
              <button key={pm.id} onClick={() => procToggle(pm)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all
                  ${sel ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700"}`}>
                {sel && <CheckCircle size={11} />}
                {pm.name}
                <span className={`text-[10px] ${sel ? "text-purple-200" : "text-gray-400"}`}>₹{pm.rate}/{pm.chargeUnit}</span>
              </button>
            );
          })}
        </div>
        {form.processes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {form.processes.map((p, i) => (
              <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium flex items-center gap-1">
                <Layers size={10} />{p.processName}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Ply summary (read-only if pre-filled) */}
      {form.secondaryLayers.length > 0 && (
        <div>
          <SH label={`Ply Structure (${form.secondaryLayers.length} plys — from Work Order)`} />
          <div className="flex flex-wrap gap-2">
            {form.secondaryLayers.map((l, i) => (
              <span key={i} className="px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-xs font-medium">
                P{i + 1}: {l.plyType || "Film"} {l.itemSubGroup ? `— ${l.itemSubGroup}` : ""} {l.gsm > 0 ? `${l.gsm}gsm` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      <Textarea label="Remarks" value={form.remarks} onChange={e => remChg(e.target.value)} placeholder="Special notes for this catalog template…" />
    </div>
  );

  // ─────────────────────────────────────────────────────────────
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
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Pending (Orders)",   val: stats.pending,   cls: "bg-amber-50 text-amber-700 border-amber-200"   },
          { label: "Processed (Catalog)",val: stats.processed, cls: "bg-green-50 text-green-700 border-green-200"   },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-gray-100 p-1 rounded-xl gap-1 w-fit">
        {([
          { key: "pending",   label: "Pending",   Icon: Clock,         count: stats.pending   },
          { key: "processed", label: "Processed", Icon: CheckCircle2,  count: stats.processed },
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
                const wo = workOrders.find(w => w.orderId === order.id);
                const line = order.orderLines?.[0];
                return (
                  <div key={order.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">

                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                        <ShoppingCart size={18} className="text-teal-600" />
                      </div>
                    </div>

                    {/* Order Info */}
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
                        <span>{line?.noOfColors || order.noOfColors || 6}C · {line?.printType || order.printType || "Surface Print"}</span>
                        <span>{(line?.orderQty || order.quantity || 0).toLocaleString()} {line?.unit || order.unit || "Meter"}</span>
                        <span className="text-gray-400">{order.date}</span>
                      </div>

                      {/* WO badge */}
                      <div className="mt-1.5">
                        {wo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold">
                            <CheckCircle2 size={10} />Work Order: {wo.workOrderNo} — Planning ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs">
                            <AlertCircle size={10} />No Work Order — Manual planning required
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    {order.totalAmount > 0 && (
                      <div className="flex-shrink-0 text-right">
                        <p className="text-[10px] text-gray-400">Order Total</p>
                        <p className="font-bold text-gray-800 text-sm">₹{order.totalAmount.toLocaleString()}</p>
                        {(line?.rate || order.perMeterRate) > 0 && (
                          <p className="text-xs text-green-600">₹{(line?.rate || order.perMeterRate).toFixed(2)}/m</p>
                        )}
                      </div>
                    )}

                    {/* Action */}
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
                  <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewPlanRow(row)}>View Plan</Button>
                  <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={() => openReplan(row)}>Replan</Button>
                  <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleteId(row.id)}>Delete</Button>
                </div>
              )}
            />
          )}
        </div>
      )}

      {/* ══ CREATE CATALOG MODAL ══════════════════════════════════ */}
      {createOpen && sourceOrder && (
        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Product Catalog" size="xl">

          {/* Order context bar */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-4 flex flex-wrap gap-3 text-xs">
            <div>
              <p className="text-[10px] text-teal-500 uppercase font-semibold">From Order</p>
              <p className="font-bold text-teal-800">{sourceOrder.orderNo}</p>
            </div>
            <div>
              <p className="text-[10px] text-teal-500 uppercase font-semibold">Customer</p>
              <p className="font-bold text-teal-800">{sourceOrder.customerName}</p>
            </div>
            <div>
              <p className="text-[10px] text-teal-500 uppercase font-semibold">Date</p>
              <p className="font-bold text-teal-800">{sourceOrder.date}</p>
            </div>
            {sourceWO ? (
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 size={13} className="text-green-600" />
                <span className="text-green-700 font-semibold">Planning from WO: {sourceWO.workOrderNo}</span>
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle size={13} className="text-amber-600" />
                <span className="text-amber-700 font-semibold">No Work Order — enter planning manually</span>
              </div>
            )}
          </div>

          <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4">

            {/* Product identity */}
            <div>
              <SH label="Product Identity" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Input label="Product Name *" value={planForm.productName}
                  onChange={e => fp("productName", e.target.value)} placeholder="e.g. Parle-G 100g Wrap" />
                <Input label="Substrate / Structure" value={planForm.substrate}
                  onChange={e => fp("substrate", e.target.value)} placeholder="e.g. BOPP 20μ + Dry Lam + CPP 30μ" />
                <Select label="Print Type" value={planForm.printType}
                  onChange={e => fp("printType", e.target.value as typeof blankPlan.printType)}
                  options={[
                    { value: "Surface Print", label: "Surface Print" },
                    { value: "Reverse Print", label: "Reverse Print" },
                    { value: "Combination",   label: "Combination"   },
                  ]} />
                <Input label="Job Width (mm)"  type="number" value={planForm.jobWidth  || ""} onChange={e => fp("jobWidth",  Number(e.target.value))} />
                <Input label="Job Height (mm)" type="number" value={planForm.jobHeight || ""} onChange={e => fp("jobHeight", Number(e.target.value))} />
                <Input label="No. of Colors"   type="number" value={planForm.noOfColors} onChange={e => fp("noOfColors", Number(e.target.value))} min={1} max={12} />
              </div>
            </div>

            {/* Planning fields */}
            <PlanningFields
              form={planForm}
              machineChg={(id, name) => { fp("machineId", id); fp("machineName", name); }}
              cylChg={v => fp("cylinderCostPerColor", v)}
              procToggle={togglePlanProc}
              ohChg={v => fp("overheadPct", v)}
              pfChg={v => fp("profitPct", v)}
              qtyChg={v => fp("standardQty", v)}
              unitChg={v => fp("standardUnit", v)}
              rateChg={v => fp("perMeterRate", v)}
              remChg={v => fp("remarks", v)}
            />
          </div>

          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button icon={<BookMarked size={14} />} onClick={saveCatalog}>Save to Catalog</Button>
          </div>
        </Modal>
      )}

      {/* ══ REPLAN MODAL ══════════════════════════════════════════ */}
      {replanRow && (
        <Modal open={!!replanRow} onClose={() => setReplanRow(null)}
          title={`Replan — ${replanRow.catalogNo}`} size="xl">

          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-wrap gap-3 text-xs items-center">
            <RefreshCw size={13} className="text-amber-600" />
            <span className="text-amber-700 font-semibold">Replan: {replanRow.productName}</span>
            <span className="text-amber-600">Order: {replanRow.sourceOrderNo}</span>
            {replanRow.sourceWorkOrderNo && (
              <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full font-semibold">
                WO: {replanRow.sourceWorkOrderNo}
              </span>
            )}
          </div>

          <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4">

            {/* Basic fields */}
            <div>
              <SH label="Product Identity" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Input label="Product Name" value={replanForm.productName}
                  onChange={e => fr("productName", e.target.value)} />
                <Input label="Substrate" value={replanForm.substrate}
                  onChange={e => fr("substrate", e.target.value)} />
                <Select label="Print Type" value={replanForm.printType}
                  onChange={e => fr("printType", e.target.value as typeof blankPlan.printType)}
                  options={[
                    { value: "Surface Print", label: "Surface Print" },
                    { value: "Reverse Print", label: "Reverse Print" },
                    { value: "Combination",   label: "Combination"   },
                  ]} />
                <Input label="Job Width (mm)"  type="number" value={replanForm.jobWidth  || ""} onChange={e => fr("jobWidth",  Number(e.target.value))} />
                <Input label="Job Height (mm)" type="number" value={replanForm.jobHeight || ""} onChange={e => fr("jobHeight", Number(e.target.value))} />
                <Input label="No. of Colors"   type="number" value={replanForm.noOfColors} onChange={e => fr("noOfColors", Number(e.target.value))} min={1} max={12} />
              </div>
            </div>

            {/* Planning fields */}
            <PlanningFields
              form={replanForm}
              machineChg={(id, name) => { fr("machineId", id); fr("machineName", name); }}
              cylChg={v => fr("cylinderCostPerColor", v)}
              procToggle={toggleReplanProc}
              ohChg={v => fr("overheadPct", v)}
              pfChg={v => fr("profitPct", v)}
              qtyChg={v => fr("standardQty", v)}
              unitChg={v => fr("standardUnit", v)}
              rateChg={v => fr("perMeterRate", v)}
              remChg={v => fr("remarks", v)}
            />
          </div>

          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setReplanRow(null)}>Cancel</Button>
            <Button icon={<RefreshCw size={14} />} onClick={saveReplan}>Save Replan</Button>
          </div>
        </Modal>
      )}

      {/* ══ VIEW PLAN MODAL ═══════════════════════════════════════ */}
      {viewPlanRow && (
        <Modal open={!!viewPlanRow} onClose={() => setViewPlanRow(null)}
          title={`Planning Template — ${viewPlanRow.catalogNo}`} size="xl">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-full font-semibold">Product Catalog</span>
            <span className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-full">{viewPlanRow.customerName}</span>
            <span className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-full">{viewPlanRow.productName}</span>
            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full font-semibold">{viewPlanRow.noOfColors}C · {viewPlanRow.printType}</span>
            {viewPlanRow.machineName && <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full">{viewPlanRow.machineName}</span>}
            {viewPlanRow.sourceOrderNo && <span className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-full">Order: {viewPlanRow.sourceOrderNo}</span>}
            {viewPlanRow.sourceWorkOrderNo && <span className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full">WO: {viewPlanRow.sourceWorkOrderNo}</span>}
          </div>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <PlanViewer plan={{
              title:   "Product Catalog",
              refNo:   viewPlanRow.catalogNo,
              jobWidth:   viewPlanRow.jobWidth,
              jobHeight:  viewPlanRow.jobHeight,
              quantity:   viewPlanRow.standardQty || 1000,
              unit:       viewPlanRow.standardUnit,
              noOfColors: viewPlanRow.noOfColors,
              secondaryLayers:      viewPlanRow.secondaryLayers,
              processes:            viewPlanRow.processes,
              cylinderCostPerColor: viewPlanRow.cylinderCostPerColor,
              overheadPct: viewPlanRow.overheadPct,
              profitPct:   viewPlanRow.profitPct,
            } satisfies PlanInput} />
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="secondary" onClick={() => setViewPlanRow(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {/* ══ DELETE CONFIRM ════════════════════════════════════════ */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Catalog Item" size="sm">
          <p className="text-sm text-gray-600 mb-5">This catalog entry will be permanently deleted. The source order will move back to Pending.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteCatalogItem(deleteId); setDeleteId(null); }}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
