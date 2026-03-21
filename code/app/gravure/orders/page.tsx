"use client";
import { useState, useMemo } from "react";
import {
  Plus, Eye, Pencil, Trash2, ShoppingCart, BookMarked,
  Calculator, Edit3, User, CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  customers, gravureOrders as initData, GravureOrder,
  gravureEstimations,
} from "@/data/dummyData";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { DataTable, Column }  from "@/components/tables/DataTable";
import { statusBadge }        from "@/components/ui/Badge";
import Button    from "@/components/ui/Button";
import Modal     from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";

const blank: Omit<GravureOrder, "id" | "orderNo"> = {
  date: new Date().toISOString().slice(0, 10),
  customerId: "", customerName: "",
  salesPerson: "", salesType: "Local", salesLedger: "",
  poNo: "", poDate: "", directDispatch: false,
  orderLines: [],
  totalAmount: 0, advancePaid: 0, remarks: "", status: "Confirmed",
  sourceType: "Direct", enquiryId: "", estimationId: "",
  catalogId: "", catalogNo: "",
  jobName: "", substrate: "", structure: "",
  categoryId: "", categoryName: "", content: "",
  jobWidth: 0, jobHeight: 0, width: 0, noOfColors: 6,
  printType: "Surface Print",
  quantity: 0, unit: "Meter",
  deliveryDate: "", cylinderSet: "", perMeterRate: 0,
  machineId: "", machineName: "",
  secondaryLayers: [], processes: [],
  overheadPct: 12, profitPct: 15,
};

const STATUS_COLORS: Record<string, string> = {
  Confirmed:       "bg-blue-50 text-blue-700 border-blue-200",
  "In Production": "bg-yellow-50 text-yellow-700 border-yellow-200",
  Ready:           "bg-purple-50 text-purple-700 border-purple-200",
  Dispatched:      "bg-green-50 text-green-700 border-green-200",
};

export default function GravureOrdersPage() {
  const { catalog } = useProductCatalog();

  const [data,      setData]     = useState<GravureOrder[]>(initData);
  const [modalOpen, setModal]    = useState(false);
  const [viewRow,   setViewRow]  = useState<GravureOrder | null>(null);
  const [editing,   setEditing]  = useState<GravureOrder | null>(null);
  const [form,      setForm]     = useState<Omit<GravureOrder, "id" | "orderNo">>(blank);
  const [deleteId,  setDeleteId] = useState<string | null>(null);
  const [step,      setStep]     = useState<"customer" | "source" | "details">("customer");

  const f = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── What exists for selected customer ──────────────────────
  const custEstimations = useMemo(() =>
    gravureEstimations.filter(e => e.customerId === form.customerId && (e.status === "Approved" || e.status === "Accepted" || e.status === "Draft")),
    [form.customerId]
  );
  const custCatalog = useMemo(() =>
    catalog.filter(c => c.customerId === form.customerId && c.status === "Active"),
    [form.customerId, catalog]
  );
  const hasEstimation = custEstimations.length > 0;
  const hasCatalog    = custCatalog.length > 0;

  // ── Open / close ───────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm(blank);
    setStep("customer");
    setModal(true);
  };
  const openEdit = (row: GravureOrder) => {
    setEditing(row);
    setForm({ ...row });
    setStep("details");
    setModal(true);
  };

  // ── Load from estimation ───────────────────────────────────
  const loadFromEstimation = (estId: string) => {
    const est = gravureEstimations.find(e => e.id === estId);
    if (!est) return;
    setForm(p => ({
      ...p,
      estimationId:  est.id,
      jobName:       est.jobName,
      substrate:     est.substrateName || "",
      structure:     est.secondaryLayers.map(l => l.itemSubGroup).filter(Boolean).join(" + "),
      categoryId:    est.categoryId   || "",
      categoryName:  est.categoryName || "",
      content:       est.content      || "",
      jobWidth:      est.jobWidth,
      jobHeight:     est.jobHeight,
      width:         est.width,
      noOfColors:    est.noOfColors,
      printType:     est.printType,
      quantity:      est.quantity,
      unit:          est.unit,
      totalAmount:   est.totalAmount,
      perMeterRate:  est.perMeterRate,
      machineId:     est.machineId,
      machineName:   est.machineName,
      overheadPct:   est.overheadPct,
      profitPct:     est.profitPct,
      secondaryLayers: est.secondaryLayers,
      processes:       est.processes,
    }));
  };

  // ── Load from catalog ──────────────────────────────────────
  const loadFromCatalog = (catId: string) => {
    const cat = catalog.find(c => c.id === catId);
    if (!cat) return;
    setForm(p => ({
      ...p,
      catalogId:    cat.id,
      catalogNo:    cat.catalogNo,
      jobName:      cat.productName,
      substrate:    cat.substrate,
      structure:    cat.substrate,
      categoryId:   cat.categoryId,
      categoryName: cat.categoryName,
      content:      cat.content,
      jobWidth:     cat.jobWidth,
      jobHeight:    cat.jobHeight,
      width:        cat.jobWidth,
      noOfColors:   cat.noOfColors,
      printType:    cat.printType,
      quantity:     cat.standardQty,
      unit:         cat.standardUnit,
      machineId:    cat.machineId,
      machineName:  cat.machineName,
      perMeterRate: cat.perMeterRate,
      overheadPct:  cat.overheadPct,
      profitPct:    cat.profitPct,
      secondaryLayers: cat.secondaryLayers,
      processes:       cat.processes,
    }));
  };

  // ── Save ───────────────────────────────────────────────────
  const save = () => {
    if (!form.customerId || !form.jobName) {
      alert("Customer and Job Name are required."); return;
    }
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...form, id: editing.id, orderNo: editing.orderNo } : r));
    } else {
      const orderNo = generateCode(UNIT_CODE.Gravure, MODULE_CODE.Order, data.map(d => d.orderNo));
      const id = `GO${String(data.length + 1).padStart(3, "0")}`;
      setData(d => [...d, { ...form, id, orderNo }]);
    }
    setModal(false);
  };

  const pending = Math.max(0, form.totalAmount - form.advancePaid);
  const totalRevenue = data.reduce((s, o) => s + o.totalAmount, 0);

  const columns: Column<GravureOrder>[] = [
    { key: "orderNo",      header: "Order No",   sortable: true },
    { key: "date",         header: "Date",        sortable: true },
    { key: "sourceType",   header: "Source",
      render: r => {
        const cfg = r.sourceType === "Estimation" ? "bg-blue-50 text-blue-700 border-blue-200"
          : r.sourceType === "Catalog"    ? "bg-purple-50 text-purple-700 border-purple-200"
          : "bg-gray-100 text-gray-600 border-gray-200";
        return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg}`}>{r.sourceType || "Direct"}</span>;
      }
    },
    { key: "customerName", header: "Customer",   sortable: true },
    { key: "jobName",      header: "Job Name" },
    { key: "substrate",    header: "Substrate",  render: r => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">{r.substrate || "—"}</span> },
    { key: "noOfColors",   header: "Colors",     render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "quantity",     header: "Qty",        render: r => <span>{r.quantity.toLocaleString()} {r.unit}</span> },
    { key: "deliveryDate", header: "Delivery" },
    { key: "totalAmount",  header: "Amount (₹)", render: r => <span className="font-semibold">₹{r.totalAmount.toLocaleString()}</span> },
    { key: "status",       header: "Status",     render: r => statusBadge(r.status), sortable: true },
  ];

  // ── Modal title ────────────────────────────────────────────
  const modalTitle = editing ? `Edit Order — ${editing.orderNo}`
    : step === "customer" ? "New Order — Select Customer"
    : step === "source"   ? "New Order — Choose Source"
    : "New Order — Order Details";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ShoppingCart size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Order Booking</h2>
          </div>
          <p className="text-sm text-gray-500">{data.length} orders · ₹{totalRevenue.toLocaleString()} total revenue</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Order</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["Confirmed", "In Production", "Ready", "Dispatched"] as const).map(s => (
          <div key={s} className={`rounded-xl border p-4 ${STATUS_COLORS[s]}`}>
            <p className="text-xs font-medium">{s}</p>
            <p className="text-2xl font-bold mt-1">{data.filter(o => o.status === s).length}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data} columns={columns}
          searchKeys={["orderNo", "customerName", "jobName", "substrate"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleteId(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* ══ MULTI-STEP MODAL ═══════════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => setModal(false)} title={modalTitle} size="xl">

        {/* ── STEP 1: Customer ── */}
        {step === "customer" && (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <User size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Who is this order for?</p>
                <p className="text-sm text-gray-500">Select the customer first — we'll then show you the best way to book this order based on their history.</p>
              </div>
            </div>

            <Select
              label="Select Customer *"
              value={form.customerId}
              onChange={e => {
                const c = customers.find(x => x.id === e.target.value);
                setForm(p => ({ ...blank, customerId: e.target.value, customerName: c?.name || "", date: p.date }));
              }}
              options={[{ value: "", label: "-- Select Customer --" }, ...customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))]}
            />

            {form.customerId && (
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl border p-4 flex items-center gap-3 ${hasEstimation ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                  <Calculator size={20} className={hasEstimation ? "text-blue-600" : "text-gray-300"} />
                  <div>
                    <p className={`text-sm font-semibold ${hasEstimation ? "text-blue-700" : "text-gray-400"}`}>Estimations</p>
                    <p className={`text-xs ${hasEstimation ? "text-blue-500" : "text-gray-400"}`}>
                      {hasEstimation ? `${custEstimations.length} available` : "None found"}
                    </p>
                  </div>
                  {hasEstimation ? <CheckCircle2 size={16} className="ml-auto text-blue-500" /> : <AlertCircle size={16} className="ml-auto text-gray-300" />}
                </div>
                <div className={`rounded-xl border p-4 flex items-center gap-3 ${hasCatalog ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-200"}`}>
                  <BookMarked size={20} className={hasCatalog ? "text-purple-600" : "text-gray-300"} />
                  <div>
                    <p className={`text-sm font-semibold ${hasCatalog ? "text-purple-700" : "text-gray-400"}`}>Product Catalog</p>
                    <p className={`text-xs ${hasCatalog ? "text-purple-500" : "text-gray-400"}`}>
                      {hasCatalog ? `${custCatalog.length} products` : "None found"}
                    </p>
                  </div>
                  {hasCatalog ? <CheckCircle2 size={16} className="ml-auto text-purple-500" /> : <AlertCircle size={16} className="ml-auto text-gray-300" />}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
              <Button
                disabled={!form.customerId}
                onClick={() => {
                  if (!hasEstimation && !hasCatalog) {
                    setForm(p => ({ ...p, sourceType: "Direct" }));
                    setStep("details");
                  } else {
                    setStep("source");
                  }
                }}
              >
                {!form.customerId ? "Select Customer First" : !hasEstimation && !hasCatalog ? "Continue as Direct Order →" : "Next: Choose Source →"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Source selection ── */}
        {step === "source" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <strong>{form.customerName}</strong> has existing records. Choose how you want to create this order:
            </p>

            <div className="grid grid-cols-1 gap-3">
              {hasEstimation && (
                <button
                  onClick={() => { setForm(p => ({ ...p, sourceType: "Estimation" })); setStep("details"); }}
                  className={`flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all hover:shadow-md
                    ${form.sourceType === "Estimation" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Calculator size={22} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">From Estimation</p>
                    <p className="text-sm text-gray-500 mt-0.5">Load all planning, substrate, processes & cost from an approved estimation. Best for first-time orders.</p>
                    <p className="text-xs text-blue-600 font-semibold mt-1">{custEstimations.length} estimation{custEstimations.length > 1 ? "s" : ""} available</p>
                  </div>
                </button>
              )}

              {hasCatalog && (
                <button
                  onClick={() => { setForm(p => ({ ...p, sourceType: "Catalog" })); setStep("details"); }}
                  className={`flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all hover:shadow-md
                    ${form.sourceType === "Catalog" ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-purple-300"}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <BookMarked size={22} className="text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">From Product Catalog</p>
                    <p className="text-sm text-gray-500 mt-0.5">Reorder using a saved product template. Just change quantity & delivery date. No re-planning needed.</p>
                    <p className="text-xs text-purple-600 font-semibold mt-1">{custCatalog.length} product{custCatalog.length > 1 ? "s" : ""} in catalog</p>
                  </div>
                </button>
              )}

              <button
                onClick={() => { setForm(p => ({ ...p, sourceType: "Direct", estimationId: "", catalogId: "", catalogNo: "" })); setStep("details"); }}
                className={`flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all hover:shadow-md
                  ${form.sourceType === "Direct" ? "border-gray-600 bg-gray-50" : "border-gray-200 hover:border-gray-400"}`}
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Edit3 size={22} className="text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">Direct Order</p>
                  <p className="text-sm text-gray-500 mt-0.5">Enter all order details manually. Planning will be done on the Work Order.</p>
                </div>
              </button>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep("customer")}>← Back</Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Order Details ── */}
        {step === "details" && (
          <div className="space-y-4">
            {/* Source quick-picker if Estimation or Catalog */}
            {form.sourceType === "Estimation" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">
                  <Calculator size={12} className="inline mr-1" />Select Estimation
                </p>
                <Select
                  label="Estimation"
                  value={form.estimationId}
                  onChange={e => loadFromEstimation(e.target.value)}
                  options={[
                    { value: "", label: "-- Select Estimation --" },
                    ...custEstimations.map(e => ({ value: e.id, label: `${e.estimationNo} — ${e.jobName} (${e.status})` })),
                  ]}
                />
                {form.estimationId && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 bg-white border border-blue-200 rounded-lg text-blue-700">{form.noOfColors}C · {form.printType}</span>
                    <span className="px-2 py-1 bg-white border border-blue-200 rounded-lg text-blue-700">{form.jobWidth}×{form.jobHeight} mm</span>
                    <span className="px-2 py-1 bg-white border border-blue-200 rounded-lg text-blue-700">₹{form.perMeterRate}/m</span>
                    <span className="px-2 py-1 bg-white border border-blue-200 rounded-lg text-blue-700">{form.processes.length} processes</span>
                  </div>
                )}
              </div>
            )}

            {form.sourceType === "Catalog" && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2">
                  <BookMarked size={12} className="inline mr-1" />Select Product from Catalog
                </p>
                <Select
                  label="Product Catalog"
                  value={form.catalogId}
                  onChange={e => loadFromCatalog(e.target.value)}
                  options={[
                    { value: "", label: "-- Select Product --" },
                    ...custCatalog.map(c => ({ value: c.id, label: `${c.catalogNo} — ${c.productName}` })),
                  ]}
                />
                {form.catalogId && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 bg-white border border-purple-200 rounded-lg text-purple-700">{form.substrate}</span>
                    <span className="px-2 py-1 bg-white border border-purple-200 rounded-lg text-purple-700">{form.noOfColors}C</span>
                    <span className="px-2 py-1 bg-white border border-purple-200 rounded-lg text-purple-700">₹{form.perMeterRate}/m</span>
                    <span className="px-2 py-1 bg-white border border-purple-200 rounded-lg text-purple-700 font-bold">Just update Qty & Delivery!</span>
                  </div>
                )}
              </div>
            )}

            {form.sourceType === "Direct" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <Edit3 size={14} className="text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">Direct order — fill all details manually. Full planning will be done on the Work Order page.</p>
              </div>
            )}

            {/* Core order fields */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Input label="Order Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
              <Input label="Job Name *" value={form.jobName} onChange={e => f("jobName", e.target.value)} placeholder="e.g. Parle-G 100g Wrap" />
              <Input label="No. of Colors" type="number" value={form.noOfColors} onChange={e => f("noOfColors", Number(e.target.value))} min={1} max={12} />
              <Input label="Substrate" value={form.substrate} onChange={e => f("substrate", e.target.value)} placeholder="e.g. BOPP 20μ" />
              <Input label="Lamination Structure" value={form.structure} onChange={e => f("structure", e.target.value)} placeholder="e.g. BOPP 20μ + Dry Lam + CPP 30μ" />
              <Select label="Print Type" value={form.printType} onChange={e => f("printType", e.target.value as typeof form.printType)}
                options={[{ value: "Surface Print", label: "Surface Print" }, { value: "Reverse Print", label: "Reverse Print" }, { value: "Combination", label: "Combination" }]} />
              <Input label="Job Width (mm)" type="number" value={form.jobWidth || ""} onChange={e => f("jobWidth", Number(e.target.value))} />
              <Input label="Job Height (mm)" type="number" value={form.jobHeight || ""} onChange={e => f("jobHeight", Number(e.target.value))} />
              <Input label="Quantity" type="number" value={form.quantity || ""} onChange={e => f("quantity", Number(e.target.value))} />
              <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)}
                options={[{ value: "Meter", label: "Meter" }, { value: "Kg", label: "Kg" }]} />
              <Input label="Delivery Date" type="date" value={form.deliveryDate} onChange={e => f("deliveryDate", e.target.value)} />
              <Input label="Cylinder Set" value={form.cylinderSet} onChange={e => f("cylinderSet", e.target.value)} placeholder="e.g. CYL-P001" />
              <Input label="Total Amount (₹)" type="number" value={form.totalAmount || ""} onChange={e => f("totalAmount", Number(e.target.value))} />
              <Input label="Advance Paid (₹)" type="number" value={form.advancePaid || ""} onChange={e => f("advancePaid", Number(e.target.value))} />
              <Select label="Status" value={form.status} onChange={e => f("status", e.target.value as typeof form.status)}
                options={[{ value: "Confirmed", label: "Confirmed" }, { value: "In Production", label: "In Production" }, { value: "Ready", label: "Ready for Dispatch" }, { value: "Dispatched", label: "Dispatched" }]} />
            </div>

            {/* Processes from estimation/catalog */}
            {form.processes.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-2">Processes ({form.processes.length})</p>
                <div className="flex flex-wrap gap-2">
                  {form.processes.map((p, i) => (
                    <span key={i} className="px-2.5 py-1 bg-white text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium">{p.processName}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Amount summary */}
            {form.totalAmount > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 border rounded-xl p-3"><p className="text-xs text-gray-500">Total Amount</p><p className="font-bold text-gray-800">₹{form.totalAmount.toLocaleString()}</p></div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3"><p className="text-xs text-gray-500">Advance Paid</p><p className="font-bold text-green-700">₹{form.advancePaid.toLocaleString()}</p></div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-xs text-gray-500">Balance Pending</p><p className="font-bold text-red-600">₹{pending.toLocaleString()}</p></div>
              </div>
            )}

            <Textarea label="Remarks" value={form.remarks} onChange={e => f("remarks", e.target.value)} placeholder="Special instructions…" />

            <div className="flex justify-between pt-2">
              {!editing && <Button variant="secondary" onClick={() => setStep(hasEstimation || hasCatalog ? "source" : "customer")}>← Back</Button>}
              <div className="flex gap-3 ml-auto">
                <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
                <Button icon={<ShoppingCart size={14} />} onClick={save}>{editing ? "Update Order" : "Book Order"}</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ══ VIEW MODAL ══════════════════════════════════════════════ */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Order — ${viewRow.orderNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border
              ${viewRow.sourceType === "Estimation" ? "bg-blue-50 text-blue-700 border-blue-200"
              : viewRow.sourceType === "Catalog" ? "bg-purple-50 text-purple-700 border-purple-200"
              : "bg-gray-100 text-gray-600 border-gray-200"}`}>
              {viewRow.sourceType === "Estimation" ? <Calculator size={12}/> : viewRow.sourceType === "Catalog" ? <BookMarked size={12}/> : <Edit3 size={12}/>}
              {viewRow.sourceType} Order {viewRow.catalogNo ? `— ${viewRow.catalogNo}` : ""}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {([
                ["Customer",      viewRow.customerName],
                ["Job Name",      viewRow.jobName],
                ["Substrate",     viewRow.substrate || "—"],
                ["Category",      viewRow.categoryName || "—"],
                ["Size (W×H)",    `${viewRow.jobWidth}×${viewRow.jobHeight} mm`],
                ["Colors",        `${viewRow.noOfColors}C`],
                ["Print Type",    viewRow.printType],
                ["Quantity",      `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
                ["Delivery Date", viewRow.deliveryDate || "—"],
                ["Cylinder Set",  viewRow.cylinderSet || "—"],
                ["₹/Meter",       viewRow.perMeterRate ? `₹${viewRow.perMeterRate.toFixed(2)}` : "—"],
                ["Status",        viewRow.status],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}><p className="text-[10px] text-gray-400 uppercase font-semibold">{k}</p><p className="font-medium text-gray-800">{v}</p></div>
              ))}
            </div>
            {viewRow.processes.length > 0 && (
              <div><p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Processes</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewRow.processes.map((p, i) => <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs">{p.processName}</span>)}
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 border rounded-xl p-3"><p className="text-xs text-gray-500">Total</p><p className="font-bold">₹{viewRow.totalAmount.toLocaleString()}</p></div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3"><p className="text-xs text-gray-500">Advance</p><p className="font-bold text-green-700">₹{viewRow.advancePaid.toLocaleString()}</p></div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-xs text-gray-500">Balance</p><p className="font-bold text-red-600">₹{(viewRow.totalAmount - viewRow.advancePaid).toLocaleString()}</p></div>
            </div>
          </div>
          <div className="flex justify-between mt-5">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <Button onClick={() => { setViewRow(null); window.location.href = "/gravure/workorder"; }}>→ Create Work Order</Button>
          </div>
        </Modal>
      )}

      {/* ══ DELETE CONFIRM ══════════════════════════════════════════ */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Order" size="sm">
          <p className="text-sm text-gray-600 mb-5">This order will be permanently deleted.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { setData(d => d.filter(r => r.id !== deleteId)); setDeleteId(null); }}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
