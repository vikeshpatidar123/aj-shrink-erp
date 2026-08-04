"use client";
/**
 * EstimationInstancePanel — the 3-column layout for ONE Gravure Costing
 * Estimation instance (base record, or a sibling produced via "Clone
 * Estimation"). This is the main orchestration component for the full-page
 * rewrite described in the approved plan (calm-enchanting-kahan.md):
 *
 *   LEFT   — collapsible master-info panel (Customer / Category / Product
 *            Identity fields). Auto-collapses to a summary chip row once a
 *            customer is selected (matches "once customer is selected user
 *            never needs to see it again"); user can re-expand via pencil icon.
 *   CENTER — "Quick Setup" card (always visible) → large orange
 *            "Calculate Cost" button gating first reveal → 7 cost accordions
 *            (single-open-at-a-time) → Quantity Clone comparison cards row →
 *            "Cost Summary — All Quantities" comparison table with
 *            cheapest-total / best-margin column highlighting.
 *   RIGHT  — <StickySummaryPanel> (big total + line items + action buttons).
 *
 * Internally calls `useEstimationInstance()` exactly once — each mounted
 * panel owns one independent instance's state (form, costs, quantity clones,
 * cylinder/color/attachment rows, save()).
 *
 * ── Loose ends fixed here (flagged by the previous extraction pass) ────────
 * 1. "Lots" stock-picker popups: `MaterialCostAccordion` used to own
 *    `filmLotPickerOpen`/`ciLotPickerOpen` as local state with no popup
 *    rendering it. That state is now LIFTED to this panel (passed down as
 *    props — see the edited `MaterialCostAccordionProps`), and the two popup
 *    blocks from the legacy `page.tsx` ("FILM LOT PICKER MODAL" /
 *    "CONSUMABLE ITEM LOT PICKER MODAL", ~lines 5493-5742) are ported
 *    verbatim into this panel below the 3-column grid.
 * 2. "Process Cost Breakdown" table: confirmed it lives inside
 *    `MaterialCostAccordion.tsx` (ported from the source's literal line
 *    range, sitting between "Extra Materials" and the Loan & Labour Cost
 *    Calculator). Left as-is per the task brief — functionally harmless,
 *    and NOT duplicated in `ProcessCostAccordion.tsx`.
 *
 * Trimming Size — flagged as missing a home by the previous pass — lives in
 * the "Quick Setup" card below (dimension-tier data, alongside Job Width/
 * Job Height/Repeat Length).
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown, Check, X, RefreshCw, Wrench, Archive, Plus, Calculator,
  FileText, Eye, ArrowRight, Search,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { CustomerSelectField } from "@/components/ui/CustomerSelectField";
import { FieldMasterSelectField } from "@/components/ui/FieldMasterSelectField";
import { DataTable, Column } from "@/components/tables/DataTable";
import { useMasters } from "@/context/MastersContext";
import { useEnquiries } from "@/context/EnquiryContext";
import type { CombinedEnquiry } from "@/context/EnquiryContext";
import { GravureEstimation, grnRecords } from "@/data/dummyData";
import {
  useCostingMasters, FINISH_GOODS_TYPES, FILM_ITEMS, ALL_MAT_ITEMS,
} from "@/components/gravure/costing-estimation/CostingMastersContext";
import { useEstimationInstance, QtyOverride } from "@/hooks/useEstimationInstance";
import AccordionSection from "@/components/gravure/costing-estimation/AccordionSection";
import QuantityCard from "@/components/gravure/costing-estimation/QuantityCard";
import MaterialCostAccordion from "@/components/gravure/costing-estimation/MaterialCostAccordion";
import ProcessCostAccordion from "@/components/gravure/costing-estimation/ProcessCostAccordion";
import CylinderAccordion from "@/components/gravure/costing-estimation/CylinderAccordion";
import PackingAccordion from "@/components/gravure/costing-estimation/PackingAccordion";
import OverheadProfitAccordion from "@/components/gravure/costing-estimation/OverheadProfitAccordion";
import AttachmentsAccordion from "@/components/gravure/costing-estimation/AttachmentsAccordion";
import AdvancedSettingsAccordion from "@/components/gravure/costing-estimation/AdvancedSettingsAccordion";
import EnquiryDetailViewModal from "@/components/gravure/costing-estimation/EnquiryDetailViewModal";

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">{label}</p>
  );
}

const inr = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

const QTY_OVERRIDE_FIELDS: (keyof QtyOverride)[] = [
  "labourCost", "transportationCost", "interestCost", "overheadPct", "profitPct",
  "cylinderCostOverride", "setupCostOverride", "packingCostOverride",
];

export interface EstimationInstancePanelProps {
  instanceId: string;
  initialData?: Partial<GravureEstimation>;
  estimationId?: string;
  mode: "new" | "edit";
  onCloneEstimation: (snapshot: Partial<GravureEstimation>) => void;
  onRemoveInstance?: () => void;
  onSavedNavigateBack: () => void;
  /** true for instances added via "Clone Estimation" — shows a "Remove" affordance. */
  isCloneChild?: boolean;
}

export default function EstimationInstancePanel({
  instanceId, initialData, estimationId, mode,
  onCloneEstimation, onRemoveInstance, onSavedNavigateBack, isCloneChild,
}: EstimationInstancePanelProps) {
  const router = useRouter();
  const masters = useCostingMasters();
  const { customers: apiCustomers, refresh: refreshMasters } = useMasters();
  const { categories, refreshCategories, PRINT_MACHINES } = masters;
  const { enquiries: allEnquiries } = useEnquiries();
  const instance = useEstimationInstance({ initialData, estimationId, masters });
  const { form, setForm, f } = instance;

  // ── Load from Enquiry: picker grid (pending, not-yet-estimated only) + a
  //    read-only View popup (same fields as the Enquiry module's own View
  //    modal, no Edit affordance — "only view ke liye") ──
  const [enquiryPickerOpen, setEnquiryPickerOpen] = useState(false);
  const [enquiryViewRow, setEnquiryViewRow] = useState<CombinedEnquiry | null>(null);
  const [loadedEnquiry, setLoadedEnquiry] = useState<CombinedEnquiry | null>(null);
  const pendingGravureEnquiries = allEnquiries.filter(
    e => e.businessUnit === "Gravure" && e.status === "Pending"
  );
  const enquiryStatusColor: Record<string, string> = {
    Pending:   "bg-yellow-50 text-yellow-700 border-yellow-200",
    Estimated: "bg-purple-50 text-purple-700 border-blue-200",
    Converted: "bg-green-50 text-green-700 border-green-200",
    Rejected:  "bg-red-50 text-red-600 border-red-200",
  };

  // ── "Calculate Cost" gate — only gates first reveal; live recalculation after ──
  const [calculated, setCalculated] = useState(mode === "edit");

  // ── Accordion stack — single-open-at-a-time ──
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggleSection = (key: string) => setOpenSection(o => (o === key ? null : key));

  // ── "Lots" stock-picker popup state — lifted out of MaterialCostAccordion ──
  const [filmLotPickerOpen, setFilmLotPickerOpen] = useState<number | null>(null);
  const [ciLotPickerOpen, setCiLotPickerOpen] = useState<{ plyIdx: number; ciIdx: number } | null>(null);

  // ── Quantity-clone helpers ───────────────────────────────────────────────
  /** Clone a quantity card's current qty + overrides into a brand-new card at the end of the row. */
  const cloneQtyCard = (allQtysIdx: number) => {
    const sourceQty = instance.allQtys[allQtysIdx] ?? 0;
    const sourceOverride = instance.qtyOverrides[allQtysIdx] ?? {};
    const newIdx = instance.allQtys.length; // index the new entry will occupy once appended
    instance.setExtraQtys(prev => [...prev, sourceQty]);
    QTY_OVERRIDE_FIELDS.forEach(k => {
      if (sourceOverride[k] !== undefined) instance.setQtyOverride(newIdx, k, sourceOverride[k]);
    });
  };

  /** Remove a cloned quantity card (base/Q1 cannot be removed), shifting qtyOverrides down to stay aligned. */
  const removeQtyCard = (extraIdx: number) => {
    const removeIdx = extraIdx + 1; // index within allQtys/qtyOverrides
    const overrides = instance.qtyOverrides;
    for (let idx = removeIdx; idx < overrides.length - 1; idx++) {
      const nextOv = overrides[idx + 1] ?? {};
      QTY_OVERRIDE_FIELDS.forEach(k => instance.setQtyOverride(idx, k, nextOv[k]));
    }
    const lastIdx = overrides.length - 1;
    if (lastIdx >= removeIdx) {
      QTY_OVERRIDE_FIELDS.forEach(k => instance.setQtyOverride(lastIdx, k, undefined));
    }
    instance.setExtraQtys(prev => prev.filter((_, idx) => idx !== extraIdx));
  };

  // ── Comparison table highlight — cheapest total / best margin column ──────
  const qtyIsUsed = instance.allQtys.map(q => q > 0);
  const hasMultipleQtys = qtyIsUsed.filter(Boolean).length > 1;
  const totalsForHighlight = instance.allQtys.map((q, qi) => (q > 0 ? instance.allCosts[qi]?.totalAmount ?? Infinity : Infinity));
  const minTotal = Math.min(...totalsForHighlight);
  const marginsForHighlight = instance.allQtys.map((q, qi) => (q > 0 ? instance.allCosts[qi]?.marginPct ?? -Infinity : -Infinity));
  const maxMargin = Math.max(...marginsForHighlight);

  const estimationLabel = mode === "edit"
    ? `Edit — ${instance.editingMeta?.estimationNo || estimationId || ""}`
    : "New";

  return (
    <div>
      {/* ══ Header row — breadcrumb + actions ══════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Link href="/dashboard" className="hover:text-[rgb(var(--color-primary))] transition-colors">Dashboard</Link>
          <span className="text-gray-300">/</span>
          <Link href="/gravure/costing-estimation" className="hover:text-[rgb(var(--color-primary))] transition-colors">Estimations</Link>
          <span className="text-gray-300">/</span>
          <span className="text-[rgb(var(--color-primary))] font-semibold">{estimationLabel}</span>
        </nav>
        <div className="flex items-center gap-2">
          {isCloneChild && (
            <Button variant="danger" size="sm" onClick={() => onRemoveInstance?.()}>Remove this estimation</Button>
          )}
          {mode === "edit" && (
            <Button variant="action-print" size="sm" onClick={() => window.print()}>Print</Button>
          )}
          <Button variant="action-cancel" size="sm" onClick={() => router.push("/gravure/costing-estimation")}>Cancel</Button>
        </div>
      </div>

      {/* ══ Full-width stack ════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">

        {/* ── Customer & Product Identity + Quick Setup — one combined full-width card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader label="Customer &amp; Product Identity" />
            <div className="flex items-center gap-2 -mt-6">
              {loadedEnquiry && (
                <button
                  type="button"
                  title={`View loaded enquiry — ${loadedEnquiry.enquiryNo}`}
                  onClick={() => setEnquiryViewRow(loadedEnquiry)}
                  className="p-2 rounded-lg text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
                >
                  <Eye size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setEnquiryPickerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition shadow-sm whitespace-nowrap"
              >
                <FileText size={13} /> Load from Enquiry
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-5">
            <Input label="Job Name *" value={form.jobName} onChange={e => f("jobName", e.target.value)} placeholder="Job / carton description" />

            <CustomerSelectField
              label="Customer *"
              value={form.customerId}
              onChange={e => {
                const c = apiCustomers.find(x => String(x.LedgerID) === e.target.value);
                f("customerId", e.target.value);
                if (c) f("customerName", c.CustomerName);
              }}
              options={[
                { value: "", label: apiCustomers.length === 0 ? "Loading customers..." : "-- Select Customer --" },
                ...apiCustomers.map(c => ({ value: String(c.LedgerID), label: c.CustomerName })),
              ]}
              onRefresh={refreshMasters}
            />

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-xs font-medium text-[rgb(var(--fg-default))]">Finish Goods Category</label>
                <div className="flex items-center gap-1">
                  <a href="/masters/categories" target="_blank" rel="noopener noreferrer" title="Add new category"
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors select-none">
                    <Plus size={10} strokeWidth={2.5} /> New
                  </a>
                  <button type="button" title="Refresh categories" onClick={() => refreshCategories()}
                    className="p-1 rounded border border-gray-200 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                    <RefreshCw size={11} />
                  </button>
                </div>
              </div>
              <Select
                value={form.categoryId || ""}
                onChange={e => {
                  const hasPlys = form.secondaryLayers.some(l => l.plyType || l.consumableItems.length > 0);
                  if (hasPlys && e.target.value) {
                    if (window.confirm("Changing category resets Ply Configuration. Continue?")) instance.applyCategory(e.target.value);
                  } else {
                    instance.applyCategory(e.target.value);
                  }
                }}
                options={[
                  { value: "", label: "-- Select Finish Goods Category --" },
                  ...categories.map(c => ({ value: c.id, label: c.name })),
                  ...(form.categoryId && form.categoryName && !categories.find(c => c.id === form.categoryId)
                    ? [{ value: form.categoryId, label: form.categoryName }]
                    : []),
                ]}
              />
            </div>

            <FieldMasterSelectField
              label="Product Type"
              value={(form as any).productType ?? ""}
              onChange={e => f("productType" as any, e.target.value)}
              onRefresh={refreshMasters}
              options={[
                { value: "", label: "-- Select --" },
                ...[...FINISH_GOODS_TYPES, ...((form as any).productType && !FINISH_GOODS_TYPES.includes((form as any).productType) ? [(form as any).productType] : [])].map(v => ({ value: v, label: v })),
              ]}
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

            <Input label="Concern Person" value={form.concernPerson} onChange={e => f("concernPerson", e.target.value)} placeholder="Name of concern person" />

            <Select
              label="Sales Type *"
              value={form.salesType}
              onChange={e => f("salesType", e.target.value)}
              options={[
                { value: "Local",       label: "Local" },
                { value: "Inter-State", label: "Inter-State" },
                { value: "Export",      label: "Export" },
              ]}
            />

            <Input
              label="Artwork Name"
              placeholder="e.g. Parle-G 100g Front Artwork v3"
              value={(form as any).artworkName ?? ""}
              onChange={e => f("artworkName" as any, e.target.value)}
            />
          </div>

          <SectionHeader label="Quick Setup" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-1">
                <label className="block text-xs font-semibold text-[rgb(var(--color-primary))] mb-1">Quantity (Q1) *</label>
                <input
                  type="number"
                  value={form.quantity || ""}
                  onChange={e => { f("quantity", Number(e.target.value)); instance.setActiveQtyIdx(0); }}
                  placeholder="e.g. 200000"
                  className="w-full h-14 rounded-xl border-2 border-[rgb(var(--color-primary))]/30 px-4 text-2xl font-black text-[rgb(var(--color-primary))]
                    bg-[rgb(var(--color-primary-subtle))]/40 focus:outline-none focus:border-[rgb(var(--color-primary))] focus:ring-2 focus:ring-[rgb(var(--color-primary))]/20 transition-all"
                />
              </div>
              <Select
                label="Unit"
                value={form.unit}
                onChange={e => f("unit", e.target.value)}
                options={[
                  { value: "Meter", label: "Meter" },
                  { value: "Kg",    label: "Kg" },
                  { value: "Pcs",   label: "Pcs" },
                ]}
              />
              <Input label="No. of Plys *" type="number"
                value={form.secondaryLayers.length || ""}
                onChange={e => {
                  const n = Math.max(0, parseInt(e.target.value) || 0);
                  let layers = [...form.secondaryLayers];
                  if (n > layers.length) {
                    while (layers.length < n) {
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
                onChange={e => { const v = Number(e.target.value); setForm(p => ({ ...p, jobWidth: v, width: v, actualWidth: v })); }}
              />
              <Input label="Job Height (mm)" type="number"
                value={form.jobHeight || ""}
                onChange={e => { const v = Number(e.target.value); setForm(p => ({ ...p, jobHeight: v, actualHeight: v })); }}
              />
              <Input label="Front Colors" type="number"
                value={form.frontColors ?? ""}
                onChange={e => { const fc = Number(e.target.value) || 0; setForm(p => ({ ...p, frontColors: fc, noOfColors: fc + (p.backColors ?? 0) })); }}
                min={0} max={12}
              />
              <Input label="Back Colors" type="number"
                value={form.backColors ?? ""}
                onChange={e => { const bc = Number(e.target.value) || 0; setForm(p => ({ ...p, backColors: bc, noOfColors: (p.frontColors ?? 0) + bc })); }}
                min={0} max={12}
              />
              <Input label="Repeat Length (mm)" type="number"
                value={form.repeatLength || ""}
                onChange={e => f("repeatLength", Number(e.target.value))}
                placeholder="cylinder circumference"
              />
              <Input label="Trimming Size (mm)" type="number"
                value={form.trimmingSize || ""}
                onChange={e => f("trimmingSize", parseFloat(e.target.value) || 0)}
                placeholder="e.g. 5"
              />
              <div className="lg:col-span-2 sm:col-span-2">
                <label className="block text-xs font-medium text-[rgb(var(--fg-default))] mb-1">Printing Machine (Machine Master)</label>
                <Select
                  value={form.machineId}
                  onChange={e => {
                    const m = PRINT_MACHINES.find((x: any) => x.id === e.target.value);
                    const baseRate = parseFloat(m?.costPerHour as string) || 1350;
                    setForm(p => {
                      const shiftHrs = p.machineShiftHours || 8;
                      return {
                        ...p,
                        machineId: e.target.value,
                        machineName: m?.name || "",
                        machineBaseCostPerHour: baseRate,
                        machineCostPerHour: parseFloat(((baseRate * 8) / shiftHrs).toFixed(2)),
                      };
                    });
                  }}
                  options={[{ value: "", label: "-- All Machines --" }, ...PRINT_MACHINES.map((m: any) => ({ value: m.id, label: `${m.name} (${m.status}) – ₹${m.costPerHour}/hr` }))]}
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Shift:</span>
                  {[8, 12, 24].map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        const base = form.machineBaseCostPerHour || form.machineCostPerHour || 1350;
                        const effective = parseFloat(((base * 8) / h).toFixed(2));
                        setForm(p => ({ ...p, machineShiftHours: h, machineCostPerHour: effective }));
                      }}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                        (form.machineShiftHours || 8) === h
                          ? "bg-indigo-600 border-indigo-600 text-white shadow"
                          : "bg-white border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600"
                      }`}
                    >
                      {h}hr
                    </button>
                  ))}
                  <span className="text-[10px] text-indigo-600 font-bold ml-1">Eff: ₹{form.machineCostPerHour.toLocaleString()}/hr</span>
                </div>
              </div>
            </div>
          </div>

          {/* Calculate Cost — orange CTA, gates first reveal */}
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={() => setCalculated(true)}
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-base font-black text-white shadow-lg hover:shadow-xl hover:brightness-110 active:scale-[0.98] transition-all"
              style={{ background: "rgb(var(--color-orange))" }}
            >
              <Calculator size={20} /> {calculated ? "Recalculate Cost" : "Calculate Cost"}
            </button>
          </div>

          {!calculated ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center text-sm text-gray-400">
              Fill in Quick Setup and click <strong>Calculate Cost</strong> to see the full estimation.
            </div>
          ) : (
            <div className="flex flex-col gap-4">

              {/* ── Accordion stack ── */}
              <div className="flex flex-col gap-3">
                <AccordionSection title="Material Cost" isOpen={openSection === "material"} onToggle={() => toggleSection("material")} amountLabel={inr(instance.costs.materialCost)}>
                  <MaterialCostAccordion
                    form={form} setForm={setForm} f={f} masters={masters}
                    breakdown={instance.breakdown} activeQty={instance.activeQty} activeCosts={instance.activeCosts}
                    onPlyTypeChange={instance.onPlyTypeChange}
                    addPlyConsumable={instance.addPlyConsumable}
                    removePlyConsumable={instance.removePlyConsumable}
                    updatePlyConsumable={instance.updatePlyConsumable}
                    addMaterial={instance.addMaterial}
                    removeMaterial={instance.removeMaterial}
                    updateMaterial={instance.updateMaterial}
                    selectMaterialItem={instance.selectMaterialItem}
                    filmLotPickerOpen={filmLotPickerOpen}
                    setFilmLotPickerOpen={setFilmLotPickerOpen}
                    ciLotPickerOpen={ciLotPickerOpen}
                    setCiLotPickerOpen={setCiLotPickerOpen}
                  />
                </AccordionSection>

                <AccordionSection title="Process Cost" isOpen={openSection === "process"} onToggle={() => toggleSection("process")} amountLabel={inr(instance.costs.processCost)}>
                  <ProcessCostAccordion
                    form={form} setForm={setForm} masters={masters}
                    processMinChargeMap={instance.processMinChargeMap}
                    costs={instance.costs}
                    addProcess={instance.addProcess}
                    removeProcess={instance.removeProcess}
                    updateProcess={instance.updateProcess}
                    selectProcess={instance.selectProcess}
                    updateProcessMachine={instance.updateProcessMachine}
                  />
                </AccordionSection>

                <AccordionSection title="Cylinder" isOpen={openSection === "cylinder"} onToggle={() => toggleSection("cylinder")} amountLabel={inr(instance.costs.cylinderCost)}>
                  <CylinderAccordion
                    form={form} f={f}
                    cylAllocs={instance.cylAllocs} setCylAllocs={instance.setCylAllocs}
                    cylCostBreakdown={instance.cylCostBreakdown}
                    openEstCylinderMaster={instance.openEstCylinderMaster}
                    refreshEstFromCylinderMaster={instance.refreshEstFromCylinderMaster}
                    loadedFromCatalog={instance.loadedFromCatalog}
                    masters={masters}
                    colorShades={instance.colorShades}
                    setColorShades={instance.setColorShades}
                    initEstPrepData={instance.initEstPrepData}
                  />
                </AccordionSection>

                <AccordionSection title="Packing" isOpen={openSection === "packing"} onToggle={() => toggleSection("packing")} amountLabel={inr(instance.costs.packingCost)}>
                  <PackingAccordion form={form} f={f} />
                </AccordionSection>

                <AccordionSection title="Overhead & Profit" isOpen={openSection === "overhead"} onToggle={() => toggleSection("overhead")} amountLabel={`${form.overheadPct}% / ${form.profitPct}%`}>
                  <OverheadProfitAccordion form={form} f={f} />
                </AccordionSection>

                <AccordionSection
                  title="Attachments"
                  isOpen={openSection === "attachments"}
                  onToggle={() => toggleSection("attachments")}
                  defaultOpen={false}
                  amountLabel={instance.attachments.length > 0 ? String(instance.attachments.length) : undefined}
                >
                  <AttachmentsAccordion
                    attachments={instance.attachments}
                    addAttachments={instance.addAttachments}
                    removeAttachment={instance.removeAttachment}
                    editingAttachLabel={instance.editingAttachLabel}
                    setEditingAttachLabel={instance.setEditingAttachLabel}
                    previewAttachment={instance.previewAttachment}
                    setPreviewAttachment={instance.setPreviewAttachment}
                    setAttachments={instance.setAttachments}
                  />
                </AccordionSection>

                <AccordionSection title="Advanced Cost Settings" isOpen={openSection === "advanced"} onToggle={() => toggleSection("advanced")} defaultOpen={false}>
                  <AdvancedSettingsAccordion form={form} f={f} />
                </AccordionSection>
              </div>

              {/* ── Quantity Comparison — clone cards row ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <SectionHeader label="Quantity Comparison" />
                </div>
                <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
                  <QuantityCard
                    label="Q1 — Base"
                    quantity={form.quantity}
                    unit={form.unit}
                    profitPct={form.profitPct}
                    overheadPct={form.overheadPct}
                    sellingPrice={form.sellingPrice}
                    rate={instance.costs.perMeterRate}
                    total={instance.costs.totalAmount}
                    isBase
                    onChange={patch => {
                      if (patch.quantity !== undefined) { f("quantity", patch.quantity); instance.setActiveQtyIdx(0); }
                      if (patch.profitPct !== undefined) f("profitPct", patch.profitPct);
                      if (patch.overheadPct !== undefined) f("overheadPct", patch.overheadPct);
                      if (patch.sellingPrice !== undefined) f("sellingPrice", patch.sellingPrice);
                    }}
                    onClone={() => cloneQtyCard(0)}
                  />
                  {instance.extraQtys.map((qty, i) => {
                    const allIdx = i + 1;
                    const ov = instance.qtyOverrides[allIdx] ?? {};
                    const c = instance.allCosts[allIdx];
                    return (
                      <QuantityCard
                        key={i}
                        label={`Q${i + 2}`}
                        quantity={qty}
                        unit={form.unit}
                        profitPct={ov.profitPct ?? form.profitPct}
                        overheadPct={ov.overheadPct ?? form.overheadPct}
                        sellingPrice={form.sellingPrice}
                        rate={c?.perMeterRate ?? 0}
                        total={c?.totalAmount ?? 0}
                        isBase={false}
                        onChange={patch => {
                          if (patch.quantity !== undefined) {
                            instance.setExtraQtys(prev => prev.map((q, idx) => (idx === i ? patch.quantity! : q)));
                          }
                          if (patch.profitPct !== undefined) instance.setQtyOverride(allIdx, "profitPct", patch.profitPct);
                          if (patch.overheadPct !== undefined) instance.setQtyOverride(allIdx, "overheadPct", patch.overheadPct);
                          if (patch.sellingPrice !== undefined) f("sellingPrice", patch.sellingPrice);
                        }}
                        onClone={() => cloneQtyCard(allIdx)}
                        onDelete={() => removeQtyCard(i)}
                        onRecalculate={() => {}}
                      />
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => instance.setExtraQtys(p => [...p, 0])}
                    className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 min-w-[140px] rounded-xl border-2 border-dashed border-purple-200 text-purple-500 hover:border-purple-400 hover:bg-purple-50/40 transition-colors"
                  >
                    <Plus size={18} />
                    <span className="text-xs font-semibold">Clone Quantity</span>
                  </button>
                </div>
              </div>

              {/* ── Cost Summary — All Quantities (comparison table) ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <SectionHeader label="Cost Summary — All Quantities" />
                <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                  <table className="w-auto text-xs border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-20 bg-gray-100 border-b-2 border-r-2 border-gray-300 px-3 py-2.5 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide w-[150px] min-w-[150px]">
                          Cost Item
                        </th>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
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
                      {/* Material rows */}
                      {(instance.allBreakdowns[0]?.matLines ?? []).map((m, mi) => (
                        <tr key={`mat-${mi}`} className="hover:bg-blue-50/40">
                          <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5">
                            <p className="font-semibold text-gray-800 truncate max-w-[140px]" title={m.name}>{m.name}</p>
                            {m.plyType && <p className="text-[9px] text-gray-400">{m.plyType}</p>}
                          </td>
                          {instance.allQtys.map((qty, qi) => qty > 0 ? (
                            <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-blue-700 font-semibold">
                              ₹{(instance.allBreakdowns[qi]?.matLines[mi]?.amount ?? 0).toLocaleString()}
                            </td>
                          ) : null)}
                        </tr>
                      ))}

                      <tr className="bg-blue-50">
                        <td className="sticky left-0 z-10 bg-blue-50 border-b-2 border-r-2 border-blue-200 px-3 py-2 text-[10px] font-black text-blue-700 uppercase tracking-wide">
                          Total Material
                        </td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b-2 border-r border-blue-100 px-3 py-2 text-right font-black text-blue-700">
                            ₹{(instance.allCosts[qi]?.materialCost ?? 0).toLocaleString()}
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="hover:bg-purple-50/30">
                        <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-gray-700">Process Cost</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-purple-700 font-semibold">
                            ₹{(instance.allCosts[qi]?.processCost ?? 0).toLocaleString()}
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="bg-indigo-50/50">
                        <td className="sticky left-0 z-10 bg-indigo-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-indigo-800">
                          Cylinder ({form.noOfColors}C) (₹)
                        </td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                            <input
                              type="number" min={0} step={1}
                              placeholder={(() => {
                                if (instance.cylCostFromAllocs !== null) return `₹${instance.cylCostFromAllocs.toLocaleString()}`;
                                const rate = form.cylinderRatePerSqInch ?? 0;
                                if (rate > 0) {
                                  const w = form.actualWidth || form.jobWidth || 0;
                                  const circ = form.repeatLength || form.jobHeight || 0;
                                  const areaSqIn = w > 0 && circ > 0 ? parseFloat(((w * circ) / 645.16).toFixed(4)) : 0;
                                  const areaCost = areaSqIn > 0 ? parseFloat((areaSqIn * rate * form.noOfColors).toFixed(2)) : 0;
                                  if (areaCost > 0) return `₹${areaCost.toLocaleString()}`;
                                }
                                return `₹${(form.cylinderCostPerColor * form.noOfColors).toLocaleString()}`;
                              })()}
                              className="w-full text-right text-xs font-semibold text-indigo-800 bg-white border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              value={instance.qtyOverrides[qi]?.cylinderCostOverride || ""}
                              onChange={e => instance.setQtyOverride(qi, "cylinderCostOverride", !e.target.value || Number(e.target.value) === 0 ? undefined : Number(e.target.value))}
                            />
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="bg-amber-50/50">
                        <td className="sticky left-0 z-10 bg-amber-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-amber-800">Other Cost (₹)</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                            {(() => {
                              const autoSetup = form.setupTime > 0 ? parseFloat(((form.setupTime / 60) * form.machineCostPerHour).toFixed(0)) : 0;
                              return (
                                <input
                                  type="number" min={0} step={1}
                                  placeholder={autoSetup > 0 ? `₹${autoSetup.toLocaleString()}` : "enter other cost →"}
                                  className="w-full text-right text-xs font-semibold text-amber-800 bg-white border border-amber-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                  value={instance.qtyOverrides[qi]?.setupCostOverride || ""}
                                  onChange={e => instance.setQtyOverride(qi, "setupCostOverride", !e.target.value || Number(e.target.value) === 0 ? undefined : Number(e.target.value))}
                                />
                              );
                            })()}
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="bg-lime-50/50">
                        <td className="sticky left-0 z-10 bg-lime-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-lime-800">Labour Cost (₹)</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                            <input
                              type="number" min={0} step={1} placeholder="0"
                              className="w-full text-right text-xs font-semibold text-lime-800 bg-white border border-lime-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-lime-400"
                              value={(instance.qtyOverrides[qi]?.labourCost ?? form.labourCost) || ""}
                              onChange={e => instance.setQtyOverride(qi, "labourCost", Number(e.target.value))}
                            />
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="bg-cyan-50/50">
                        <td className="sticky left-0 z-10 bg-cyan-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-cyan-800">Transport Cost (₹)</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                            <input
                              type="number" min={0} step={1} placeholder="0"
                              className="w-full text-right text-xs font-semibold text-cyan-800 bg-white border border-cyan-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                              value={(instance.qtyOverrides[qi]?.transportationCost ?? form.transportationCost) || ""}
                              onChange={e => instance.setQtyOverride(qi, "transportationCost", Number(e.target.value))}
                            />
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="bg-orange-50/50">
                        <td className="sticky left-0 z-10 bg-orange-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-orange-800">Packing Cost (₹)</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                            {(() => {
                              const computed = instance.allCosts[qi]?.packingCost ?? 0;
                              const hasOverride = instance.qtyOverrides[qi]?.packingCostOverride !== undefined && (instance.qtyOverrides[qi]?.packingCostOverride ?? 0) > 0;
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <input
                                    type="number" min={0} step={1}
                                    placeholder={computed > 0 ? `${computed.toLocaleString()}` : "fill packing details"}
                                    className="w-full text-right text-xs font-semibold text-orange-800 bg-white border border-orange-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400"
                                    value={instance.qtyOverrides[qi]?.packingCostOverride || ""}
                                    onChange={e => instance.setQtyOverride(qi, "packingCostOverride", !e.target.value || Number(e.target.value) === 0 ? undefined : Number(e.target.value))}
                                  />
                                  <span className={`text-[9px] text-right font-bold ${hasOverride ? "text-amber-600" : "text-orange-500"}`}>
                                    {hasOverride ? `auto: ₹${computed.toLocaleString()}` : `₹${computed.toLocaleString()} ✓`}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="bg-rose-50/50">
                        <td className="sticky left-0 z-10 bg-rose-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-rose-800">Interest Cost (₹)</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                            <input
                              type="number" min={0} step={1} placeholder="0"
                              className="w-full text-right text-xs font-semibold text-rose-800 bg-white border border-rose-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-rose-400"
                              value={(instance.qtyOverrides[qi]?.interestCost ?? form.interestCost) || ""}
                              onChange={e => instance.setQtyOverride(qi, "interestCost", Number(e.target.value))}
                            />
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="bg-yellow-50/50">
                        <td className="sticky left-0 z-10 bg-yellow-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-yellow-800">Overhead %</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="number" min={0} step={0.5}
                                className="w-full text-right text-xs font-semibold text-yellow-800 bg-white border border-yellow-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                value={instance.qtyOverrides[qi]?.overheadPct ?? form.overheadPct}
                                onChange={e => instance.setQtyOverride(qi, "overheadPct", Number(e.target.value))}
                              />
                              <span className="text-[10px] text-yellow-700 font-bold flex-shrink-0">%</span>
                            </div>
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="bg-yellow-50">
                        <td className="sticky left-0 z-10 bg-yellow-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-semibold text-yellow-800 pl-5 text-[11px]">↳ Overhead Amt</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-yellow-100 px-3 py-1.5 text-right text-yellow-700 font-bold">
                            ₹{(instance.allCosts[qi]?.overheadAmt ?? 0).toLocaleString()}
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="bg-green-50/50">
                        <td className="sticky left-0 z-10 bg-green-50 border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-green-800">Profit %</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-2 py-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="number" min={0} step={0.5}
                                className="w-full text-right text-xs font-semibold text-green-800 bg-white border border-green-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
                                value={instance.qtyOverrides[qi]?.profitPct ?? form.profitPct}
                                onChange={e => instance.setQtyOverride(qi, "profitPct", Number(e.target.value))}
                              />
                              <span className="text-[10px] text-green-700 font-bold flex-shrink-0">%</span>
                            </div>
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="bg-green-50">
                        <td className="sticky left-0 z-10 bg-green-50 border-b-2 border-r-2 border-gray-200 px-3 py-1.5 font-semibold text-green-800 pl-5 text-[11px]">↳ Profit Amt</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b-2 border-r border-green-100 px-3 py-1.5 text-right text-green-700 font-bold">
                            ₹{(instance.allCosts[qi]?.profitAmt ?? 0).toLocaleString()}
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="bg-blue-50">
                        <td className="sticky left-0 z-10 bg-blue-50 border-b border-r-2 border-gray-200 px-3 py-2 font-bold text-blue-700 text-[11px] uppercase tracking-wide">
                          Total (Without Profit)
                        </td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-blue-100 px-3 py-2 text-right font-bold text-blue-800 text-sm">
                            ₹{((instance.allCosts[qi]?.totalAmount ?? 0) - (instance.allCosts[qi]?.profitAmt ?? 0)).toLocaleString()}
                          </td>
                        ) : null)}
                      </tr>

                      {/* TOTAL AMOUNT — highlight cheapest column */}
                      <tr className="bg-purple-100">
                        <td className="sticky left-0 z-10 bg-purple-100 border-b-2 border-r-2 border-purple-300 px-3 py-2.5 font-black text-purple-800 uppercase text-[11px] tracking-wide">
                          Total Amount
                        </td>
                        {instance.allQtys.map((qty, qi) => {
                          if (qty <= 0) return null;
                          const cheapest = hasMultipleQtys && (instance.allCosts[qi]?.totalAmount ?? Infinity) === minTotal;
                          return (
                            <td key={qi} className={`border-b-2 border-r border-blue-200 px-3 py-2.5 text-right font-black text-lg ${qi === 0 ? "text-purple-800" : "text-blue-800"} ${cheapest ? "bg-green-50 ring-2 ring-inset ring-green-400" : ""}`}>
                              ₹{(instance.allCosts[qi]?.totalAmount ?? 0).toLocaleString()}
                              {cheapest && <span className="block text-[9px] text-green-700 font-bold normal-case">✓ Cheapest</span>}
                              {form.minimumOrderValue > 0 && instance.allQtys[qi] > 0 && instance.allQtys[qi] < form.minimumOrderValue && (
                                <span className="block text-[9px] text-amber-700 font-bold">Min.Qty: {form.minimumOrderValue} {form.unit}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-gray-700">Rate / {form.unit}</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-gray-800 font-bold">
                            ₹{instance.allCosts[qi]?.perMeterRate ?? "—"}
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="hover:bg-blue-50/30">
                        <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-blue-700">Rate / {form.unit} (W/o Profit)</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-blue-700 font-bold">
                            ₹{instance.allCosts[qi]?.perMeterRateWithoutProfit ?? "—"}
                          </td>
                        ) : null)}
                      </tr>

                      {/* Margin % — new row, highlights best-margin column */}
                      <tr className="hover:bg-emerald-50/30">
                        <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-emerald-700">Margin %</td>
                        {instance.allQtys.map((qty, qi) => {
                          if (qty <= 0) return null;
                          const bestMargin = hasMultipleQtys && (instance.allCosts[qi]?.marginPct ?? -Infinity) === maxMargin;
                          return (
                            <td key={qi} className={`border-b border-r border-gray-100 px-3 py-1.5 text-right font-bold text-emerald-700 ${bestMargin ? "bg-green-50 ring-2 ring-inset ring-green-400" : ""}`}>
                              {(instance.allCosts[qi]?.marginPct ?? 0).toFixed(1)}%
                              {bestMargin && <span className="block text-[9px] text-green-700 font-bold">✓ Best Margin</span>}
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="hover:bg-teal-50/30">
                        <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-teal-700">Contribution</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-teal-700 font-semibold">
                            {(instance.allCosts[qi]?.contribution ?? 0) > 0 ? `₹${instance.allCosts[qi]?.contribution}` : "—"}
                          </td>
                        ) : null)}
                      </tr>

                      <tr className="hover:bg-orange-50/30">
                        <td className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-200 px-3 py-1.5 font-medium text-orange-700">Break-even Qty</td>
                        {instance.allQtys.map((qty, qi) => qty > 0 ? (
                          <td key={qi} className="border-b border-r border-gray-100 px-3 py-1.5 text-right text-orange-700 font-semibold">
                            {(instance.allCosts[qi]?.breakEvenQty ?? 0) > 0 ? `${instance.allCosts[qi]?.breakEvenQty?.toLocaleString()} ${form.unit}` : "—"}
                          </td>
                        ) : null)}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ── Save actions — right at the bottom of the comparison table (all cost figures already shown above, no duplicate summary) ── */}
                <div className="border-t-2 border-gray-100 mt-4 pt-4 flex flex-col gap-2">
                  <Button variant="action-save" size="md" onClick={async () => { const ok = await instance.save(); if (ok) onSavedNavigateBack(); }} loading={instance.saving} className="w-full justify-center">
                    Save
                  </Button>
                  <Button variant="action-secondary" size="sm" onClick={async () => { await instance.save(); }} className="w-full justify-center">
                    Save Draft
                  </Button>
                  <Button variant="action-send" size="sm" onClick={() => alert("Generate Quotation — coming soon")} className="w-full justify-center">
                    Generate Quotation
                  </Button>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="action-apply" size="sm" onClick={() => instance.setExtraQtys(p => [...p, 0])} className="justify-center">
                      Clone Qty
                    </Button>
                    <Button variant="action-apply" size="sm" onClick={() => onCloneEstimation(form)} className="justify-center">
                      Clone Estimation
                    </Button>
                    <Button variant="action-print" size="sm" onClick={() => window.print()} className="justify-center">
                      Print
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <Textarea label="Remarks / Notes" value={form.remarks} onChange={e => f("remarks", e.target.value)} placeholder="Price validity, special terms, notes..." />
              </div>
            </div>
          )}
      </div>

      {/* ══ ENQUIRY PICKER MODAL — pending, not-yet-estimated Gravure enquiries ══ */}
      <Modal open={enquiryPickerOpen} onClose={() => setEnquiryPickerOpen(false)} title="Load from Enquiry — Pending" size="xl">
        <div className="min-h-[50vh]">
          <DataTable<CombinedEnquiry>
            data={pendingGravureEnquiries}
            searchKeys={["enquiryNo", "customerName", "jobName"]}
            stickyHeader
            columns={[
              { key: "enquiryNo",   header: "Enquiry No", sortable: true, render: r => <span className="font-mono font-bold text-purple-700 text-xs">{r.enquiryNo}</span> },
              { key: "date",        header: "Date" },
              { key: "customerName",header: "Customer", sortable: true },
              { key: "jobName",     header: "Job Name" },
              { key: "noOfColors",  header: "Colors", render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
              { key: "quantity",    header: "Qty", render: r => <span className="font-mono text-xs">{Number(r.quantity).toLocaleString()} {r.uom}</span> },
              {
                key: "status", header: "Status",
                render: r => (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${enquiryStatusColor[r.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>{r.status}</span>
                ),
              },
            ] as Column<CombinedEnquiry>[]}
            actions={row => (
              <div className="flex items-center gap-1.5 justify-end">
                <button
                  title="View"
                  onClick={() => setEnquiryViewRow(row)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => { instance.applyEnquiry(row); setLoadedEnquiry(row); setEnquiryPickerOpen(false); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition whitespace-nowrap"
                >
                  <ArrowRight size={11} /> Load
                </button>
              </div>
            )}
          />
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">{pendingGravureEnquiries.length} pending enquiries without an estimation yet</span>
          <Button variant="secondary" onClick={() => setEnquiryPickerOpen(false)}>Cancel</Button>
        </div>
      </Modal>

      {/* ══ ENQUIRY VIEW MODAL — full read-only replica of /enquiry's Edit modal ══ */}
      <EnquiryDetailViewModal
        open={!!enquiryViewRow}
        onClose={() => setEnquiryViewRow(null)}
        enquiryId={enquiryViewRow?.id ?? null}
      />

      {/* ══ FILM LOT PICKER MODAL ═══════════════════════════════════════ */}
      {filmLotPickerOpen !== null && (() => {
        const plyIndex = filmLotPickerOpen;
        const l = form.secondaryLayers[plyIndex];
        if (!l) return null;
        const masterRate = parseFloat(FILM_ITEMS.find(fi => fi.subGroup === l.itemSubGroup)?.estimationRate || "0");
        const currentRate = l.filmRate !== undefined ? l.filmRate : masterRate;
        const lots = grnRecords.flatMap(g => g.lines
          .filter(line => line.itemGroup === "Film" && line.subGroup === l.itemSubGroup)
          .map(line => ({ grnNo: g.grnNo, grnDate: g.grnDate, supplier: g.supplier, batchNo: line.batchNo, rate: line.rate, qty: line.receivedQty, unit: line.stockUnit }))
        );
        const totalFilmQty = lots.reduce((s, lt) => s + lt.qty, 0);
        const filmAvgRate = lots.length > 0
          ? parseFloat((totalFilmQty > 0
              ? lots.reduce((s, lt) => s + lt.rate * lt.qty, 0) / totalFilmQty
              : lots.reduce((s, lt) => s + lt.rate, 0) / lots.length
            ).toFixed(2))
          : 0;
        const filmAvgDiff = masterRate > 0 ? parseFloat((filmAvgRate - masterRate).toFixed(2)) : 0;
        const filmAvgDiffPct = masterRate > 0 ? parseFloat(((filmAvgDiff / masterRate) * 100).toFixed(1)) : 0;
        return (
          <>
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => setFilmLotPickerOpen(null)} />
            <div className="fixed z-[61] inset-x-4 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[560px] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden">
              <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="text-white font-black text-sm uppercase tracking-wide">{l.itemSubGroup}</p>
                  <p className="text-orange-100 text-[10px] mt-0.5">Select a lot or apply weighted average of all {lots.length} lots in stock</p>
                </div>
                <button onClick={() => setFilmLotPickerOpen(null)} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"><X size={16}/></button>
              </div>
              <div className="grid grid-cols-3 gap-px bg-gray-200 flex-shrink-0">
                <div className="bg-blue-50 px-3 py-2.5 text-center">
                  <p className="text-[9px] text-blue-400 uppercase font-bold tracking-wider">Master Rate</p>
                  <p className="text-lg font-black text-blue-700 font-mono">₹{masterRate.toLocaleString("en-IN")}<span className="text-xs font-semibold text-blue-400">/Kg</span></p>
                </div>
                <div className="bg-green-50 px-3 py-2.5 text-center">
                  <p className="text-[9px] text-green-500 uppercase font-bold tracking-wider">Avg. Rate (Wtd.)</p>
                  <p className="text-lg font-black text-green-700 font-mono">₹{filmAvgRate.toLocaleString("en-IN")}<span className="text-xs font-semibold text-green-400">/Kg</span></p>
                  {filmAvgDiff !== 0 && masterRate > 0 && (
                    <p className={`text-[9px] font-bold mt-0.5 ${filmAvgDiff < 0 ? "text-green-600" : "text-red-500"}`}>
                      {filmAvgDiff < 0 ? "▼" : "▲"} ₹{Math.abs(filmAvgDiff)}/Kg ({filmAvgDiffPct > 0 ? "+" : ""}{filmAvgDiffPct}% vs master)
                    </p>
                  )}
                </div>
                <div className="bg-orange-50 px-3 py-2.5 text-center">
                  <p className="text-[9px] text-orange-400 uppercase font-bold tracking-wider">Applied Rate</p>
                  <p className="text-lg font-black text-orange-700 font-mono">₹{currentRate.toLocaleString("en-IN")}<span className="text-xs font-semibold text-orange-400">/Kg</span></p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {lots.map((lot, li) => {
                  const diff = masterRate > 0 ? lot.rate - masterRate : 0;
                  const diffPct = masterRate > 0 ? ((diff / masterRate) * 100) : 0;
                  const isSelected = currentRate === lot.rate;
                  const cheaper = diff < 0;
                  return (
                    <div key={li} className={`flex items-stretch gap-0 transition ${isSelected ? "bg-orange-50 ring-2 ring-inset ring-orange-400" : "hover:bg-gray-50"}`}>
                      <div className={`w-1 flex-shrink-0 ${cheaper ? "bg-green-400" : diff > 0 ? "bg-red-400" : "bg-gray-300"}`} />
                      <div className="flex-1 px-4 py-3 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-black text-gray-900 font-mono text-base">₹{lot.rate.toLocaleString("en-IN")}/Kg</span>
                          {diff !== 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cheaper ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
                              {cheaper ? "▼" : "▲"} ₹{Math.abs(diff).toLocaleString("en-IN")}/Kg ({diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}% vs master)
                            </span>
                          )}
                          {diff === 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">= Same as master</span>}
                          {isSelected && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-200 text-orange-800 border border-orange-300">✓ Applied</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-gray-500">
                          <span><span className="text-gray-400">GRN:</span> <span className="font-semibold text-gray-700">{lot.grnNo}</span> · {lot.grnDate}</span>
                          <span><span className="text-gray-400">Supplier:</span> <span className="font-semibold text-gray-700 truncate">{lot.supplier}</span></span>
                          <span className="truncate"><span className="text-gray-400">Batch:</span> <span className="font-mono text-gray-600">{lot.batchNo}</span></span>
                          <span><span className="text-gray-400">In Stock:</span> <span className="font-semibold text-gray-700">{lot.qty.toLocaleString("en-IN")} {lot.unit}</span></span>
                        </div>
                      </div>
                      <div className="flex items-center pr-3">
                        <button type="button"
                          onClick={() => { const layers = [...form.secondaryLayers]; layers[plyIndex] = { ...l, filmRate: lot.rate }; f("secondaryLayers", layers); setFilmLotPickerOpen(null); }}
                          className={`px-3 py-2 rounded-xl text-[11px] font-bold transition ${isSelected ? "bg-orange-100 text-orange-700 border border-orange-300 cursor-default" : "bg-orange-600 hover:bg-orange-700 text-white shadow-sm"}`}>
                          {isSelected ? "Applied" : "Apply"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {lots.length === 0 && (
                  <div className="p-8 text-center text-gray-400 text-sm">No stock lots found for {l.itemSubGroup}</div>
                )}
              </div>
              <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 flex-wrap">
                <button type="button"
                  onClick={() => { const layers = [...form.secondaryLayers]; layers[plyIndex] = { ...l, filmRate: masterRate }; f("secondaryLayers", layers); setFilmLotPickerOpen(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-bold transition">
                  <RefreshCw size={11} /> Reset to Master (₹{masterRate.toLocaleString("en-IN")})
                </button>
                {lots.length > 0 && (
                  <button type="button"
                    onClick={() => { const layers = [...form.secondaryLayers]; layers[plyIndex] = { ...l, filmRate: filmAvgRate }; f("secondaryLayers", layers); setFilmLotPickerOpen(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[11px] font-bold shadow-sm transition">
                    ✓ Apply Avg. Rate (₹{filmAvgRate.toLocaleString("en-IN")})
                  </button>
                )}
                <button onClick={() => setFilmLotPickerOpen(null)}
                  className="ml-auto px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-[11px] font-bold transition">Close</button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ══ CONSUMABLE ITEM LOT PICKER MODAL ════════════════════════════ */}
      {ciLotPickerOpen !== null && (() => {
        const { plyIdx, ciIdx } = ciLotPickerOpen;
        const l = form.secondaryLayers[plyIdx];
        const ci = l?.consumableItems[ciIdx];
        if (!ci) return null;
        const masterItem = ALL_MAT_ITEMS.find(x => x.id === ci.itemId);
        const masterRate = parseFloat(masterItem?.estimationRate ?? "0") || 0;
        const currentRate = ci.rate || 0;
        const lots = grnRecords.flatMap(g => g.lines
          .filter(line => line.itemGroup === ci.itemGroup && line.subGroup === ci.itemSubGroup)
          .map(line => ({ grnNo: g.grnNo, grnDate: g.grnDate, supplier: g.supplier, batchNo: line.batchNo, rate: line.rate, qty: line.receivedQty, unit: line.stockUnit, itemName: line.itemName }))
        );
        const totalCiQty = lots.reduce((s, lt) => s + lt.qty, 0);
        const ciAvgRate = lots.length > 0
          ? parseFloat((totalCiQty > 0
              ? lots.reduce((s, lt) => s + lt.rate * lt.qty, 0) / totalCiQty
              : lots.reduce((s, lt) => s + lt.rate, 0) / lots.length
            ).toFixed(2))
          : 0;
        const ciAvgDiff = masterRate > 0 ? parseFloat((ciAvgRate - masterRate).toFixed(2)) : 0;
        const ciAvgDiffPct = masterRate > 0 ? parseFloat(((ciAvgDiff / masterRate) * 100).toFixed(1)) : 0;
        const groupColor: Record<string, string> = { Ink: "from-blue-600 to-blue-500", Solvent: "from-purple-600 to-purple-500", Adhesive: "from-violet-600 to-violet-500", Hardner: "from-pink-600 to-pink-500" };
        const gradClass = groupColor[ci.itemGroup] ?? "from-orange-600 to-orange-500";
        return (
          <>
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => setCiLotPickerOpen(null)} />
            <div className="fixed z-[61] inset-x-4 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[580px] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden">
              <div className={`bg-gradient-to-r ${gradClass} px-4 py-3 flex items-center justify-between flex-shrink-0`}>
                <div>
                  <p className="text-white font-black text-sm">{ci.itemSubGroup || ci.itemGroup} — Stock Lots</p>
                  <p className="text-white/80 text-[10px] mt-0.5">{ci.itemName || "Select an item first"} · {ci.itemGroup}</p>
                </div>
                <button onClick={() => setCiLotPickerOpen(null)} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"><X size={16}/></button>
              </div>
              <div className="grid grid-cols-3 gap-px bg-gray-200 flex-shrink-0">
                <div className="bg-blue-50 px-3 py-2.5 text-center">
                  <p className="text-[9px] text-blue-400 uppercase font-bold tracking-wider">Master Rate</p>
                  <p className="text-lg font-black text-blue-700 font-mono">{masterRate > 0 ? <>₹{masterRate.toLocaleString("en-IN")}<span className="text-xs font-semibold text-blue-400">/Kg</span></> : <span className="text-sm text-blue-300">—</span>}</p>
                </div>
                <div className="bg-green-50 px-3 py-2.5 text-center">
                  <p className="text-[9px] text-green-500 uppercase font-bold tracking-wider">Avg. Rate (Wtd.)</p>
                  <p className="text-lg font-black text-green-700 font-mono">{ciAvgRate > 0 ? <>₹{ciAvgRate.toLocaleString("en-IN")}<span className="text-xs font-semibold text-green-400">/Kg</span></> : <span className="text-sm text-green-300">—</span>}</p>
                  {ciAvgDiff !== 0 && masterRate > 0 && (
                    <p className={`text-[9px] font-bold mt-0.5 ${ciAvgDiff < 0 ? "text-green-600" : "text-red-500"}`}>
                      {ciAvgDiff < 0 ? "▼" : "▲"} ₹{Math.abs(ciAvgDiff)}/Kg ({ciAvgDiffPct > 0 ? "+" : ""}{ciAvgDiffPct}% vs master)
                    </p>
                  )}
                </div>
                <div className="bg-orange-50 px-3 py-2.5 text-center">
                  <p className="text-[9px] text-orange-400 uppercase font-bold tracking-wider">Applied Rate</p>
                  <p className="text-lg font-black text-orange-700 font-mono">{currentRate > 0 ? <>₹{currentRate.toLocaleString("en-IN")}<span className="text-xs font-semibold text-orange-400">/Kg</span></> : <span className="text-sm text-orange-300">—</span>}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {lots.map((lot, li) => {
                  const diff = masterRate > 0 ? lot.rate - masterRate : 0;
                  const diffPct = masterRate > 0 ? ((diff / masterRate) * 100) : 0;
                  const isSelected = currentRate === lot.rate;
                  const cheaper = diff < 0;
                  return (
                    <div key={li} className={`flex items-stretch gap-0 transition ${isSelected ? "bg-orange-50 ring-2 ring-inset ring-orange-400" : "hover:bg-gray-50"}`}>
                      <div className={`w-1 flex-shrink-0 ${cheaper ? "bg-green-400" : diff > 0 ? "bg-red-400" : "bg-gray-300"}`} />
                      <div className="flex-1 px-4 py-3 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-black text-gray-900 font-mono text-base">₹{lot.rate.toLocaleString("en-IN")}/Kg</span>
                          {diff !== 0 && masterRate > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cheaper ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
                              {cheaper ? "▼" : "▲"} ₹{Math.abs(diff).toLocaleString("en-IN")}/Kg ({diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}% vs master)
                            </span>
                          )}
                          {masterRate > 0 && diff === 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">= Same as master</span>}
                          {isSelected && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-200 text-orange-800 border border-orange-300">✓ Applied</span>}
                        </div>
                        <div className="text-[10px] text-gray-500 mb-0.5 font-medium truncate">{lot.itemName}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-gray-500">
                          <span><span className="text-gray-400">GRN:</span> <span className="font-semibold text-gray-700">{lot.grnNo}</span> · {lot.grnDate}</span>
                          <span><span className="text-gray-400">Supplier:</span> <span className="font-semibold text-gray-700 truncate">{lot.supplier}</span></span>
                          <span className="truncate"><span className="text-gray-400">Batch:</span> <span className="font-mono text-gray-600">{lot.batchNo}</span></span>
                          <span><span className="text-gray-400">In Stock:</span> <span className="font-semibold text-gray-700">{lot.qty.toLocaleString("en-IN")} {lot.unit}</span></span>
                        </div>
                      </div>
                      <div className="flex items-center pr-3">
                        <button type="button"
                          onClick={() => { instance.updatePlyConsumable(plyIdx, ciIdx, { rate: lot.rate }); setCiLotPickerOpen(null); }}
                          className={`px-3 py-2 rounded-xl text-[11px] font-bold transition ${isSelected ? "bg-orange-100 text-orange-700 border border-orange-300 cursor-default" : "bg-orange-600 hover:bg-orange-700 text-white shadow-sm"}`}>
                          {isSelected ? "Applied" : "Apply"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {lots.length === 0 && (
                  <div className="p-8 text-center text-gray-400 text-sm">No stock lots found for {ci.itemSubGroup || ci.itemGroup}</div>
                )}
              </div>
              <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 flex-wrap">
                {masterRate > 0 && (
                  <button type="button"
                    onClick={() => { instance.updatePlyConsumable(plyIdx, ciIdx, { rate: masterRate }); setCiLotPickerOpen(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-bold transition">
                    <RefreshCw size={11} /> Reset to Master (₹{masterRate.toLocaleString("en-IN")})
                  </button>
                )}
                {lots.length > 0 && ciAvgRate > 0 && (
                  <button type="button"
                    onClick={() => { instance.updatePlyConsumable(plyIdx, ciIdx, { rate: ciAvgRate }); setCiLotPickerOpen(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[11px] font-bold shadow-sm transition">
                    ✓ Apply Avg. Rate (₹{ciAvgRate.toLocaleString("en-IN")})
                  </button>
                )}
                <button onClick={() => setCiLotPickerOpen(null)}
                  className="ml-auto px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-[11px] font-bold transition">Close</button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ══ ATTACHMENT PREVIEW MODAL ═════════════════════════════════════ */}
      {instance.previewAttachment && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => instance.setPreviewAttachment(null)} />
          <div className="fixed z-[61] inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[80vw] sm:max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <p className="text-sm font-bold text-gray-800 truncate">{instance.previewAttachment.name}</p>
              <button onClick={() => instance.setPreviewAttachment(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              {instance.previewAttachment.mimeType.startsWith("image/") ? (
                <img src={instance.previewAttachment.url} alt={instance.previewAttachment.name} className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg" />
              ) : instance.previewAttachment.mimeType === "application/pdf" ? (
                <iframe src={instance.previewAttachment.url} title={instance.previewAttachment.name} className="w-full rounded-xl border border-gray-200 shadow" style={{ height: "70vh" }} />
              ) : (
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <span className="text-2xl font-black text-gray-400">
                      {instance.previewAttachment.name.split(".").pop()?.toUpperCase() ?? "FILE"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 max-w-xs">Preview is not available for this file type. Use the download button to open it.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
