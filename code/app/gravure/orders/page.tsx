"use client";
import { useState, useMemo } from "react";
import {
  Plus, Eye, Pencil, Trash2, ShoppingCart, BookMarked,
  Calculator, Edit3, User, CheckCircle2, AlertCircle,
  Package, ChevronDown, ChevronUp, Layers, X, Save,
  FileText, Truck, CreditCard,
} from "lucide-react";
import {
  customers, gravureOrders as initData, GravureOrder, GravureOrderLine,
  GravureProductCatalog, SecondaryLayer, GravureEstimationProcess,
  gravureEstimations, employees, ledgers,
} from "@/data/dummyData";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge }       from "@/components/ui/Badge";
import Button   from "@/components/ui/Button";
import Modal    from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";

// ─── Constants ────────────────────────────────────────────────
const FILM_TYPES  = ["BOPP", "PET", "LDPE", "LLDPE", "CPP", "PVC", "Metallised PET", "Other"];
const CURRENCIES  = ["INR", "USD", "EUR"];
const SALES_TYPES = ["Local", "Inter-State", "Export"];
const SALES_LEDGERS = ledgers.filter(l => l.ledgerType === "Sales A/C").map(l => l.name);
const SALES_PERSONS = employees.filter(e => e.status === "Active").map(e => e.name);

const STATUS_COLORS: Record<string, string> = {
  Confirmed:       "bg-blue-50 text-blue-700 border-blue-200",
  "In Production": "bg-amber-50 text-amber-700 border-amber-200",
  Ready:           "bg-purple-50 text-purple-700 border-purple-200",
  Dispatched:      "bg-green-50 text-green-700 border-green-200",
};

// ─── Blank line ───────────────────────────────────────────────
const blankLine = (): GravureOrderLine => ({
  id: Math.random().toString(36).slice(2),
  lineNo: 1,
  sourceType: "Direct",
  estimationId: "", estimationNo: "",
  catalogId: "", catalogNo: "",
  productCode: "", productName: "",
  categoryId: "", categoryName: "",
  substrate: "",
  jobWidth: 0, jobHeight: 0,
  noOfColors: 6,
  printType: "Surface Print",
  cylinderStatus: "New", cylinderCount: 0,
  filmType: "BOPP", laminationRequired: false,
  orderQty: 0, unit: "Meter",
  rate: 0, currency: "INR", amount: 0,
  deliveryDate: "",
  remarks: "",
});

// ─── Blank order header ───────────────────────────────────────
const blankHeader: Omit<GravureOrder, "id" | "orderNo"> = {
  date: new Date().toISOString().slice(0, 10),
  customerId: "", customerName: "",
  salesPerson: "", salesType: "Local", salesLedger: "",
  poNo: "", poDate: "",
  directDispatch: false,
  orderLines: [blankLine()],
  totalAmount: 0, advancePaid: 0,
  remarks: "", status: "Confirmed",
  // Legacy
  sourceType: "Direct", enquiryId: "", estimationId: "", catalogId: "", catalogNo: "",
  jobName: "", substrate: "", structure: "", categoryId: "", categoryName: "", content: "",
  jobWidth: 0, jobHeight: 0, width: 0, noOfColors: 6, printType: "Surface Print",
  quantity: 0, unit: "Meter", deliveryDate: "", cylinderSet: "", perMeterRate: 0,
  machineId: "", machineName: "", secondaryLayers: [], processes: [], overheadPct: 12, profitPct: 15,
};

// ─── Source badge ─────────────────────────────────────────────
function SourceBadge({ src }: { src: string }) {
  const cfg = src === "Estimation"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : src === "Catalog"
    ? "bg-purple-50 text-purple-700 border-purple-200"
    : "bg-gray-100 text-gray-600 border-gray-200";
  const Icon = src === "Estimation" ? Calculator : src === "Catalog" ? BookMarked : Edit3;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg}`}>
      <Icon size={10} />{src}
    </span>
  );
}

// ─── Inline editable line row (desktop) ───────────────────────

function LineRow({
  line, idx, onUpdate, onRemove, custEstimations, custCatalog, onCatalogLoad,
}: {
  line: GravureOrderLine;
  idx: number;
  onUpdate: (l: GravureOrderLine) => void;
  onRemove: () => void;
  custEstimations: ReturnType<typeof gravureEstimations.filter>;
  custCatalog: GravureProductCatalog[];
  onCatalogLoad: (secondaryLayers: SecondaryLayer[], processes: GravureEstimationProcess[], machineId: string, machineName: string, perMeterRate: number, overheadPct: number, profitPct: number) => void;
}) {
  const u = <K extends keyof GravureOrderLine>(k: K, v: GravureOrderLine[K]) =>
    onUpdate({ ...line, [k]: v });

  const loadFromEst = (estId: string) => {
    const est = gravureEstimations.find(e => e.id === estId);
    if (!est) return;
    // Derive filmType from first ply's subGroup (e.g. "BOPP", "PET", "CPP")
    const filmType = est.secondaryLayers[0]?.itemSubGroup || "BOPP";
    // Derive laminationRequired: any ply has plyType "Lamination"
    const laminationRequired = est.secondaryLayers.some(l => l.plyType === "Lamination");
    onUpdate({
      ...line,
      sourceType:    "Estimation",
      estimationId:  est.id,
      estimationNo:  est.estimationNo,
      productCode:   est.estimationNo,          // use estimation no as product code ref
      productName:   est.jobName,
      categoryId:    est.categoryId   || "",
      categoryName:  est.categoryName || "",
      substrate:     est.substrateName || "",
      jobWidth:      est.jobWidth,
      jobHeight:     est.jobHeight,
      noOfColors:    est.noOfColors,
      printType:     est.printType,
      filmType,
      laminationRequired,
      orderQty:      est.quantity,
      unit:          est.unit,
      rate:          est.perMeterRate,
      amount:        Math.round(est.quantity * est.perMeterRate),
      cylinderStatus: "New",
      cylinderCount:  est.noOfColors,
    });
  };

  const loadFromCat = (catId: string) => {
    const cat = custCatalog.find(c => c.id === catId);
    if (!cat) return;
    onUpdate({
      ...line,
      sourceType: "Catalog",
      catalogId:    cat.id, catalogNo: cat.catalogNo,
      productName:  cat.productName,
      categoryId:   cat.categoryId, categoryName: cat.categoryName,
      substrate:    cat.substrate,
      jobWidth:     cat.jobWidth, jobHeight: cat.jobHeight,
      noOfColors:   cat.noOfColors, printType: cat.printType,
      orderQty:     cat.standardQty, unit: cat.standardUnit,
      rate:         cat.perMeterRate,
      amount:       Math.round(cat.standardQty * cat.perMeterRate),
      cylinderStatus: "Existing",
    });
    // Load full planning into parent order
    onCatalogLoad(cat.secondaryLayers, cat.processes, cat.machineId, cat.machineName, cat.perMeterRate, cat.overheadPct, cat.profitPct);
  };

  const srcColor = line.sourceType === "Estimation" ? "border-l-blue-400"
    : line.sourceType === "Catalog"    ? "border-l-purple-400"
    : "border-l-gray-300";

  return (
    <div className={`border border-gray-200 rounded-xl bg-white mb-3 border-l-4 ${srcColor} shadow-sm`}>
      {/* Line header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-t-xl border-b border-gray-100">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Line {idx + 1}</span>
        <div className="flex items-center gap-2">
          <SourceBadge src={line.sourceType} />
          <button onClick={onRemove} className="p-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Source picker */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Source"
            value={line.sourceType}
            onChange={e => onUpdate({ ...blankLine(), id: line.id, lineNo: line.lineNo, sourceType: e.target.value as GravureOrderLine["sourceType"] })}
            options={[
              { value: "Estimation", label: "From Estimation" },
              { value: "Catalog",    label: "From Product Catalog" },
              { value: "Direct",     label: "Direct Entry" },
            ]}
          />
          {line.sourceType === "Estimation" && (
            <div className="sm:col-span-2">
              <Select
                label="Select Estimation"
                value={line.estimationId}
                onChange={e => loadFromEst(e.target.value)}
                options={[
                  { value: "", label: "-- Select Estimation --" },
                  ...custEstimations.map(e => ({ value: e.id, label: `${e.estimationNo} — ${e.jobName}` })),
                ]}
              />
            </div>
          )}
          {line.sourceType === "Catalog" && (
            <div className="sm:col-span-2">
              <Select
                label="Select from Catalog"
                value={line.catalogId}
                onChange={e => loadFromCat(e.target.value)}
                options={[
                  { value: "", label: "-- Select Product --" },
                  ...custCatalog.map(c => ({ value: c.id, label: `${c.catalogNo} — ${c.productName}` })),
                ]}
              />
            </div>
          )}
        </div>

        {/* Product fields */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Input label="Product Code"  value={line.productCode}  onChange={e => u("productCode",  e.target.value)} placeholder="e.g. PARLE-100G" />
          <div className="sm:col-span-2">
            <Input label="Product Name *" value={line.productName} onChange={e => u("productName", e.target.value)} placeholder="e.g. Parle-G Biscuit Wrap" />
          </div>
          <Input label="Substrate" value={line.substrate} onChange={e => u("substrate", e.target.value)} placeholder="e.g. BOPP 20μ" />
        </div>

        {/* Gravure-specific */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <Select label="Film Type" value={line.filmType}
            onChange={e => u("filmType", e.target.value)}
            options={FILM_TYPES.map(f => ({ value: f, label: f }))} />
          <Input label="No. of Colors" type="number" value={line.noOfColors || ""} min={1} max={12}
            onChange={e => u("noOfColors", Number(e.target.value))} />
          <Select label="Cyl. Status" value={line.cylinderStatus}
            onChange={e => u("cylinderStatus", e.target.value as GravureOrderLine["cylinderStatus"])}
            options={[{ value: "New", label: "New" }, { value: "Existing", label: "Existing" }]} />
          <Input label="Cyl. Count" type="number" value={line.cylinderCount || ""}
            onChange={e => u("cylinderCount", Number(e.target.value))} />
          <Select label="Print Type" value={line.printType}
            onChange={e => u("printType", e.target.value as GravureOrderLine["printType"])}
            options={[{ value: "Surface Print", label: "Surface" }, { value: "Reverse Print", label: "Reverse" }, { value: "Combination", label: "Combination" }]} />
          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={line.laminationRequired}
                onChange={e => u("laminationRequired", e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-teal-600 accent-teal-600" />
              <span className="text-xs font-medium text-gray-700">Lamination</span>
            </label>
          </div>
        </div>

        {/* Size */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Input label="Job Width (mm)"  type="number" value={line.jobWidth  || ""} onChange={e => u("jobWidth",  Number(e.target.value))} />
          <Input label="Job Height (mm)" type="number" value={line.jobHeight || ""} onChange={e => u("jobHeight", Number(e.target.value))} />
        </div>

        {/* Qty / Rate / Amount */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-teal-50 border border-teal-100 rounded-xl p-3">
          <Input label="Order Qty *" type="number" value={line.orderQty || ""}
            onChange={e => {
              const qty = Number(e.target.value);
              u("orderQty", qty);
              onUpdate({ ...line, orderQty: qty, amount: Math.round(qty * line.rate) });
            }} />
          <Select label="Unit" value={line.unit}
            onChange={e => u("unit", e.target.value)}
            options={[{ value: "Meter", label: "Meter" }, { value: "Kg", label: "Kg" }, { value: "Nos", label: "Nos" }]} />
          <Input label="Rate (₹)" type="number" value={line.rate || ""}
            onChange={e => {
              const rate = Number(e.target.value);
              onUpdate({ ...line, rate, amount: Math.round(line.orderQty * rate) });
            }} />
          <Select label="Currency" value={line.currency}
            onChange={e => u("currency", e.target.value)}
            options={CURRENCIES.map(c => ({ value: c, label: c }))} />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-500 mb-1">Amount</span>
            <div className="flex-1 flex items-center px-3 py-2 bg-white border border-teal-200 rounded-lg font-bold text-teal-800 text-sm">
              ₹{line.amount.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Delivery & Remarks */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Delivery Date" type="date" value={line.deliveryDate}
            onChange={e => u("deliveryDate", e.target.value)} />
          <Input label="Line Remarks" value={line.remarks}
            onChange={e => u("remarks", e.target.value)} placeholder="Optional note for this line" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function GravureOrdersPage() {
  const { catalog } = useProductCatalog();

  const [data,      setData]    = useState<GravureOrder[]>(initData);
  const [modal,     setModal]   = useState(false);
  const [viewRow,   setViewRow] = useState<GravureOrder | null>(null);
  const [editing,   setEditing] = useState<GravureOrder | null>(null);
  const [form,      setForm]    = useState<Omit<GravureOrder, "id" | "orderNo">>(blankHeader);
  const [deleteId,  setDelId]   = useState<string | null>(null);
  const [expandedView, setExpandedView] = useState<string | null>(null);

  const f = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── Customer's existing records ─────────────────────────────
  const custEstimations = useMemo(() =>
    gravureEstimations.filter(e => e.customerId === form.customerId),
    [form.customerId]
  );
  const custCatalog = useMemo(() =>
    catalog.filter(c => c.customerId === form.customerId && c.status === "Active"),
    [form.customerId, catalog]
  );

  // ── Computed total from lines ───────────────────────────────
  const linesTotal = useMemo(() =>
    form.orderLines.reduce((s, l) => s + l.amount, 0),
    [form.orderLines]
  );

  // ── Line helpers ────────────────────────────────────────────
  const updateLine = (idx: number, line: GravureOrderLine) =>
    setForm(p => ({ ...p, orderLines: p.orderLines.map((l, i) => i === idx ? line : l) }));

  const removeLine = (idx: number) =>
    setForm(p => ({ ...p, orderLines: p.orderLines.filter((_, i) => i !== idx) }));

  const addLine = () =>
    setForm(p => ({
      ...p,
      orderLines: [
        ...p.orderLines,
        { ...blankLine(), lineNo: p.orderLines.length + 1 },
      ],
    }));

  // ── Open / close ────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm(blankHeader);
    setModal(true);
  };

  const openEdit = (row: GravureOrder) => {
    setEditing(row);
    setForm({ ...row });
    setModal(true);
  };

  // ── Save ────────────────────────────────────────────────────
  const save = () => {
    if (!form.customerId) { alert("Please select a customer."); return; }
    if (form.orderLines.some(l => !l.productName || !l.orderQty)) {
      alert("Each line must have a Product Name and Order Qty."); return;
    }
    const firstLine = form.orderLines[0];
    const payload: Omit<GravureOrder, "id" | "orderNo"> = {
      ...form,
      totalAmount: linesTotal,
      // sync legacy fields from first line
      sourceType:   firstLine.sourceType,
      jobName:      firstLine.productName,
      substrate:    firstLine.substrate,
      structure:    firstLine.substrate,
      categoryId:   firstLine.categoryId,
      categoryName: firstLine.categoryName,
      jobWidth:     firstLine.jobWidth,
      jobHeight:    firstLine.jobHeight,
      noOfColors:   firstLine.noOfColors,
      printType:    firstLine.printType,
      quantity:     firstLine.orderQty,
      unit:         firstLine.unit,
      deliveryDate: firstLine.deliveryDate,
      perMeterRate: firstLine.rate,
    };
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...payload, id: editing.id, orderNo: editing.orderNo } : r));
    } else {
      const orderNo = generateCode(UNIT_CODE.Gravure, MODULE_CODE.Order, data.map(d => d.orderNo));
      const id = `GO${String(data.length + 1).padStart(3, "0")}`;
      setData(d => [...d, { ...payload, id, orderNo }]);
    }
    setModal(false);
  };

  // ── Stats ───────────────────────────────────────────────────
  const totalRevenue = data.reduce((s, o) => s + o.totalAmount, 0);
  const pending      = data.reduce((s, o) => s + Math.max(0, o.totalAmount - o.advancePaid), 0);

  // ── Table columns ────────────────────────────────────────────
  const columns: Column<GravureOrder>[] = [
    { key: "orderNo",      header: "Order No",  sortable: true },
    { key: "date",         header: "Date",      sortable: true },
    { key: "customerName", header: "Customer",  sortable: true },
    {
      key: "orderLines", header: "Lines / Products",
      render: r => (
        <div className="flex flex-wrap gap-1">
          {(r.orderLines || []).slice(0, 2).map((l, i) => (
            <span key={i} className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-100 rounded-full text-xs font-medium">{l.productName || "—"}</span>
          ))}
          {(r.orderLines || []).length > 2 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">+{r.orderLines.length - 2}</span>
          )}
        </div>
      ),
    },
    {
      key: "salesPerson", header: "Sales Person",
      render: r => <span className="text-sm text-gray-700">{r.salesPerson || "—"}</span>,
    },
    { key: "poNo", header: "PO No", render: r => <span className="text-xs text-gray-500 font-mono">{r.poNo || "—"}</span> },
    {
      key: "directDispatch", header: "Direct Dispatch",
      render: r => r.directDispatch
        ? <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold"><Truck size={10} className="inline mr-0.5" />Yes</span>
        : <span className="px-2 py-0.5 bg-gray-50 text-gray-400 rounded-full text-xs">No</span>,
    },
    { key: "totalAmount", header: "Amount (₹)", render: r => <span className="font-semibold text-gray-800">₹{r.totalAmount.toLocaleString()}</span> },
    { key: "status",      header: "Status",     render: r => statusBadge(r.status), sortable: true },
  ];

  const balance = form.totalAmount - form.advancePaid;

  return (
    <div className="space-y-5">
      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ShoppingCart size={18} className="text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Order Booking</h2>
          </div>
          <p className="text-sm text-gray-500">
            {data.length} orders · ₹{totalRevenue.toLocaleString()} revenue · ₹{pending.toLocaleString()} pending
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Order</Button>
      </div>

      {/* ── Stat cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["Confirmed", "In Production", "Ready", "Dispatched"] as const).map(s => (
          <div key={s} className={`rounded-xl border p-4 ${STATUS_COLORS[s]}`}>
            <p className="text-xs font-semibold">{s}</p>
            <p className="text-2xl font-bold mt-1">{data.filter(o => o.status === s).length}</p>
            <p className="text-xs mt-1 opacity-70">₹{data.filter(o => o.status === s).reduce((a, o) => a + o.totalAmount, 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["orderNo", "customerName", "poNo", "salesPerson"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDelId(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* ══ CREATE / EDIT MODAL ══════════════════════════════════ */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? `Edit Order — ${editing.orderNo}` : "New Order"}
        size="xl"
      >
        <div className="max-h-[80vh] overflow-y-auto pr-1 space-y-4">

          {/* ── Client + Availability ── */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-teal-700 uppercase tracking-widest flex items-center gap-1.5">
              <User size={12} />Client Information
            </p>
            <Select
              label="Client Name *"
              value={form.customerId}
              onChange={e => {
                const c = customers.find(x => x.id === e.target.value);
                setForm(p => ({ ...blankHeader, customerId: e.target.value, customerName: c?.name || "", date: p.date }));
              }}
              options={[{ value: "", label: "-- Select Customer --" }, ...customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))]}
            />
            {form.customerId && (
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl border p-3 flex items-center gap-3 ${custEstimations.length ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                  <Calculator size={18} className={custEstimations.length ? "text-blue-600" : "text-gray-300"} />
                  <div>
                    <p className={`text-xs font-semibold ${custEstimations.length ? "text-blue-700" : "text-gray-400"}`}>Estimations</p>
                    <p className={`text-xs ${custEstimations.length ? "text-blue-500" : "text-gray-400"}`}>
                      {custEstimations.length ? `${custEstimations.length} available` : "None"}
                    </p>
                  </div>
                  {custEstimations.length ? <CheckCircle2 size={14} className="ml-auto text-blue-500" /> : <AlertCircle size={14} className="ml-auto text-gray-300" />}
                </div>
                <div className={`rounded-xl border p-3 flex items-center gap-3 ${custCatalog.length ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-200"}`}>
                  <BookMarked size={18} className={custCatalog.length ? "text-purple-600" : "text-gray-300"} />
                  <div>
                    <p className={`text-xs font-semibold ${custCatalog.length ? "text-purple-700" : "text-gray-400"}`}>Product Catalog</p>
                    <p className={`text-xs ${custCatalog.length ? "text-purple-500" : "text-gray-400"}`}>
                      {custCatalog.length ? `${custCatalog.length} products` : "None"}
                    </p>
                  </div>
                  {custCatalog.length ? <CheckCircle2 size={14} className="ml-auto text-purple-500" /> : <AlertCircle size={14} className="ml-auto text-gray-300" />}
                </div>
              </div>
            )}
          </div>

          {/* ── Order Details ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <FileText size={12} />Order Details
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Input label="Order Date *" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
              <Select label="Sales Person" value={form.salesPerson}
                onChange={e => f("salesPerson", e.target.value)}
                options={[{ value: "", label: "-- Select --" }, ...SALES_PERSONS.map(s => ({ value: s, label: s }))]} />
              <Select label="Sales Type" value={form.salesType}
                onChange={e => f("salesType", e.target.value)}
                options={SALES_TYPES.map(s => ({ value: s, label: s }))} />
              <Select label="Sales Ledger" value={form.salesLedger}
                onChange={e => f("salesLedger", e.target.value)}
                options={[{ value: "", label: "-- Select Ledger --" }, ...SALES_LEDGERS.map(s => ({ value: s, label: s }))]} />
              <Input label="PO No" value={form.poNo} onChange={e => f("poNo", e.target.value)} placeholder="e.g. PO-PARLE-2024-031" />
              <Input label="PO Date" type="date" value={form.poDate} onChange={e => f("poDate", e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.directDispatch}
                  onChange={e => f("directDispatch", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-teal-600" />
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Truck size={14} className="text-teal-600" />Direct Dispatch
                </span>
              </label>
              {form.directDispatch && (
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
                  Order will be dispatched directly without separate dispatch note
                </span>
              )}
            </div>
          </div>

          {/* ── Product Lines ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Package size={12} />Product Lines
              </p>
              {form.orderLines.length > 0 && (
                <span className="text-xs text-teal-700 font-bold">
                  {form.orderLines.length} line{form.orderLines.length !== 1 ? "s" : ""} · Total: ₹{linesTotal.toLocaleString()}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {form.orderLines.map((line, idx) => (
                <LineRow
                  key={line.id}
                  line={line}
                  idx={idx}
                  onUpdate={l => updateLine(idx, l)}
                  onRemove={() => removeLine(idx)}
                  custEstimations={custEstimations}
                  custCatalog={custCatalog}
                  onCatalogLoad={(sl, pr, machineId, machineName, rate, oh, pf) =>
                    setForm(p => ({
                      ...p,
                      secondaryLayers: sl,
                      processes: pr,
                      machineId,
                      machineName,
                      perMeterRate: rate,
                      overheadPct: oh,
                      profitPct: pf,
                      sourceType: "Catalog",
                    }))
                  }
                />
              ))}
            </div>

            <button
              onClick={addLine}
              className="w-full py-3 border-2 border-dashed border-teal-300 rounded-xl text-teal-600 font-semibold text-sm hover:bg-teal-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />Add Product Line
            </button>
          </div>

          {/* ── Payment ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <CreditCard size={12} />Payment
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Select label="Status" value={form.status}
                onChange={e => f("status", e.target.value as typeof form.status)}
                options={[{ value: "Confirmed", label: "Confirmed" }, { value: "In Production", label: "In Production" }, { value: "Ready", label: "Ready" }, { value: "Dispatched", label: "Dispatched" }]} />
              <Input label="Advance Paid (₹)" type="number" value={form.advancePaid || ""}
                onChange={e => f("advancePaid", Number(e.target.value))} />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-500 mb-1">Order Total (₹)</span>
                <div className="flex-1 flex items-center px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg font-bold text-teal-800 text-sm">
                  ₹{linesTotal.toLocaleString()}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-500 mb-1">Balance Pending (₹)</span>
                <div className={`flex-1 flex items-center px-3 py-2 border rounded-lg font-bold text-sm
                  ${balance > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
                  ₹{Math.max(0, linesTotal - form.advancePaid).toLocaleString()}
                </div>
              </div>
            </div>
            <Textarea label="Order Remarks" value={form.remarks} onChange={e => f("remarks", e.target.value)} placeholder="Special instructions…" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button icon={editing ? <Save size={14} /> : <ShoppingCart size={14} />} onClick={save} disabled={!form.customerId}>
            {editing ? "Update Order" : "Book Order"}
          </Button>
        </div>
      </Modal>

      {/* ══ VIEW MODAL ════════════════════════════════════════════ */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Order — ${viewRow.orderNo}`} size="xl">
          <div className="space-y-4 text-sm">
            {/* Status + source */}
            <div className="flex items-center gap-3 flex-wrap">
              {statusBadge(viewRow.status)}
              {viewRow.directDispatch && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                  <Truck size={11} />Direct Dispatch
                </span>
              )}
            </div>

            {/* Header grid */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Order Header</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  ["Customer",     viewRow.customerName],
                  ["Order Date",   viewRow.date],
                  ["Sales Person", viewRow.salesPerson || "—"],
                  ["Sales Type",   viewRow.salesType   || "—"],
                  ["Sales Ledger", viewRow.salesLedger || "—"],
                  ["PO No",        viewRow.poNo        || "—"],
                  ["PO Date",      viewRow.poDate      || "—"],
                  ["Status",       viewRow.status],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">{k}</p>
                    <p className="font-medium text-gray-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Lines */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Product Lines ({viewRow.orderLines?.length || 0})
              </p>
              {(viewRow.orderLines || []).map((line, i) => (
                <div key={line.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    onClick={() => setExpandedView(expandedView === line.id ? null : line.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                      <span className="font-semibold text-gray-800 text-sm">{line.productName}</span>
                      <SourceBadge src={line.sourceType} />
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">{line.orderQty.toLocaleString()} {line.unit}</span>
                      <span className="font-bold text-teal-700">₹{line.amount.toLocaleString()}</span>
                      {expandedView === line.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>
                  {expandedView === line.id && (
                    <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      {([
                        ["Product Code",  line.productCode  || "—"],
                        ["Substrate",     line.substrate    || "—"],
                        ["Film Type",     line.filmType     || "—"],
                        ["Size (W×H)",    `${line.jobWidth}×${line.jobHeight} mm`],
                        ["Colors",        `${line.noOfColors}C`],
                        ["Print Type",    line.printType],
                        ["Cyl. Status",   line.cylinderStatus],
                        ["Cyl. Count",    String(line.cylinderCount || "—")],
                        ["Lamination",    line.laminationRequired ? "Yes" : "No"],
                        ["Rate",          `₹${line.rate}/m`],
                        ["Currency",      line.currency],
                        ["Delivery",      line.deliveryDate || "—"],
                      ] as [string, string][]).map(([k, v]) => (
                        <div key={k}>
                          <p className="text-[10px] text-gray-400 uppercase font-semibold">{k}</p>
                          <p className="font-medium text-gray-700 mt-0.5">{v}</p>
                        </div>
                      ))}
                      {line.remarks && (
                        <div className="col-span-2 sm:col-span-4">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold">Remarks</p>
                          <p className="text-gray-700 mt-0.5">{line.remarks}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Payment summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 border rounded-xl p-3">
                <p className="text-xs text-gray-500">Order Total</p>
                <p className="font-bold text-gray-800 text-lg">₹{viewRow.totalAmount.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Advance Paid</p>
                <p className="font-bold text-green-700 text-lg">₹{viewRow.advancePaid.toLocaleString()}</p>
              </div>
              <div className={`border rounded-xl p-3 ${viewRow.totalAmount > viewRow.advancePaid ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                <p className="text-xs text-gray-500">Balance Pending</p>
                <p className={`font-bold text-lg ${viewRow.totalAmount > viewRow.advancePaid ? "text-red-600" : "text-green-700"}`}>
                  ₹{Math.max(0, viewRow.totalAmount - viewRow.advancePaid).toLocaleString()}
                </p>
              </div>
            </div>

            {viewRow.remarks && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-amber-600 uppercase mb-1">Remarks</p>
                <p className="text-sm text-amber-800">{viewRow.remarks}</p>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-5">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <div className="flex gap-3">
              <Button variant="ghost" icon={<Pencil size={14} />} onClick={() => { setViewRow(null); openEdit(viewRow); }}>Edit</Button>
              <Button icon={<Layers size={14} />} onClick={() => { setViewRow(null); window.location.href = "/gravure/workorder"; }}>Create Work Order</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ DELETE CONFIRM ════════════════════════════════════════ */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDelId(null)} title="Delete Order" size="sm">
          <p className="text-sm text-gray-600 mb-5">This order and all its product lines will be permanently deleted.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDelId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { setData(d => d.filter(r => r.id !== deleteId)); setDelId(null); }}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
