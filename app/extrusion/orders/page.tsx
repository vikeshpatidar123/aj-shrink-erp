"use client";
import { useState, useMemo } from "react";
import {
  Plus, Eye, Pencil, Trash2, ShoppingCart, Calculator,
  X, Save, FileText, Truck, Search, Check,
} from "lucide-react";
import {
  customers, orders as initExtData, Order,
  costEstimations, GravureOrder, GravureOrderLine,
  employees, ledgers,
} from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button   from "@/components/ui/Button";
import Modal    from "@/components/ui/Modal";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";

// ─── Convert legacy Order → GravureOrder shape ────────────────
function extOrderToGrv(o: Order): GravureOrder {
  const rate = o.quantity > 0 ? parseFloat((o.totalAmount / o.quantity).toFixed(2)) : 0;
  const line: GravureOrderLine = {
    id: o.id + "-L1", lineNo: 1,
    sourceType: o.estimationId ? "Estimation" : "Direct",
    estimationId: o.estimationId, estimationNo: o.estimationId,
    catalogId: "", catalogNo: "",
    productCode: o.estimationId || o.id,
    productName: o.productName || o.jobName,
    categoryId: "", categoryName: "",
    substrate: o.rollName,
    jobWidth: 0, jobHeight: 0, noOfColors: 0,
    printType: "Surface Print", cylinderStatus: "New", cylinderCount: 0,
    filmType: "BOPP", laminationRequired: false,
    orderQty: o.quantity, unit: o.unit,
    rate, currency: "INR", amount: o.totalAmount,
    deliveryDate: o.deliveryDate, remarks: "",
  };
  return {
    id: o.id, orderNo: o.orderNo, date: o.date,
    customerId: o.customerId, customerName: o.customerName,
    salesPerson: "", salesType: "Local", salesLedger: "",
    poNo: "", poDate: "", directDispatch: false,
    orderLines: [line],
    totalAmount: o.totalAmount, advancePaid: o.advancePaid,
    remarks: "", status: o.status,
    sourceType: o.estimationId ? "Estimation" : "Direct",
    enquiryId: o.enquiryId, estimationId: o.estimationId,
    catalogId: "", catalogNo: "",
    jobName: o.jobName, substrate: o.rollName,
    structure: "", categoryId: "", categoryName: "", content: "",
    jobWidth: 0, jobHeight: 0, width: 0, noOfColors: 0,
    printType: "Surface Print",
    quantity: o.quantity, unit: o.unit,
    deliveryDate: o.deliveryDate, cylinderSet: "", perMeterRate: rate,
    machineId: "", machineName: "",
    secondaryLayers: [], processes: [], overheadPct: 12, profitPct: 15,
  };
}

// ─── Extended line type ───────────────────────────────────────
type OBLine = GravureOrderLine & {
  hsnGroup: string;
  minQuotedQty: number;
  rateType: string;
  approvedCost: number;
  discPct: number;
  discAmt: number;
  gstPct: number;
  cgstPct: number;
  sgstPct: number;
  igstPct: number;
  cgstAmt: number;
  sgstAmt: number;
  igstAmt: number;
  overheadPctLine: number;
  overheadAmtLine: number;
  netAmount: number;
  expectedDeliveryDate: string;
  finalDeliveryDate: string;
  jobType: string;
  jobReference: string;
  jobPriority: string;
  division: string;
  prePressRemark: string;
  productRemark: string;
};

type DeliveryRow = {
  id: string;
  pmCode: string;
  quoteNo: string;
  jobName: string;
  scheduleQty: number;
  deliveryDate: string;
  consignee: string;
  transporter: string;
};

// ─── Constants ────────────────────────────────────────────────
const CURRENCIES  = ["INR", "USD", "EUR"];
const SALES_TYPES = ["Local", "Inter-State", "Export"];
const SALES_LEDGERS = ledgers.filter(l => l.ledgerType === "Sales A/C").map(l => l.name);
const SALES_PERSONS = employees.filter(e => e.status === "Active").map(e => e.name);
const RATE_TYPES  = ["UnitCost", "PerMeter", "PerKg", "PerNos"];
const JOB_TYPES   = ["New", "Repeat", "Revision"];
const REFERENCES  = ["Art Work Approved", "Sample Approved", "Existing Job", "New Development"];
const PRIORITIES  = ["High", "Normal", "Low"];
const DIVISIONS   = ["Extrusion"];

const STATUS_COLORS: Record<string, string> = {
  Confirmed:       "bg-blue-50 text-blue-700 border-blue-200",
  "In Production": "bg-amber-50 text-amber-700 border-amber-200",
  Ready:           "bg-purple-50 text-purple-700 border-purple-200",
  Dispatched:      "bg-green-50 text-green-700 border-green-200",
};

// ─── Compute derived amounts for a line ──────────────────────
function computeLine(l: OBLine): OBLine {
  const base     = l.orderQty * l.rate;
  const discAmt  = parseFloat(((base * l.discPct) / 100).toFixed(2));
  const amount   = parseFloat((base - discAmt).toFixed(2));
  const igsAmt   = l.gstPct > 0 ? parseFloat(((amount * l.igstPct) / 100).toFixed(2)) : 0;
  const cgstAmt  = l.gstPct > 0 ? parseFloat(((amount * l.cgstPct) / 100).toFixed(2)) : 0;
  const sgstAmt  = l.gstPct > 0 ? parseFloat(((amount * l.sgstPct) / 100).toFixed(2)) : 0;
  const ovhAmt   = parseFloat(((amount * l.overheadPctLine) / 100).toFixed(2));
  const netAmount = parseFloat((amount + ovhAmt).toFixed(2));
  return { ...l, discAmt, amount, cgstAmt, sgstAmt, igstAmt: igsAmt, overheadAmtLine: ovhAmt, netAmount };
}

// ─── Blank constructors ────────────────────────────────────────
const blankLine = (): OBLine => ({
  id: Math.random().toString(36).slice(2),
  lineNo: 1,
  sourceType: "Direct",
  estimationId: "", estimationNo: "",
  catalogId: "", catalogNo: "",
  productCode: "", productName: "",
  categoryId: "", categoryName: "",
  substrate: "",
  jobWidth: 0, jobHeight: 0,
  noOfColors: 0,
  printType: "Surface Print",
  cylinderStatus: "New", cylinderCount: 0,
  filmType: "BOPP", laminationRequired: false,
  orderQty: 0, unit: "Kg",
  rate: 0, currency: "INR", amount: 0,
  deliveryDate: "",
  remarks: "",
  hsnGroup: "", minQuotedQty: 0,
  rateType: "PerKg", approvedCost: 0,
  discPct: 0, discAmt: 0,
  gstPct: 18, cgstPct: 9, sgstPct: 9, igstPct: 18,
  cgstAmt: 0, sgstAmt: 0, igstAmt: 0,
  overheadPctLine: 0, overheadAmtLine: 0,
  netAmount: 0,
  expectedDeliveryDate: "", finalDeliveryDate: "",
  jobType: "New", jobReference: "Art Work Approved",
  jobPriority: "Normal", division: "Extrusion",
  prePressRemark: "", productRemark: "",
});

const blankDelivery = (): DeliveryRow => ({
  id: Math.random().toString(36).slice(2),
  pmCode: "", quoteNo: "", jobName: "",
  scheduleQty: 0, deliveryDate: "",
  consignee: "", transporter: "",
});

type FormState = Omit<GravureOrder, "id" | "orderNo"> & {
  obLines: OBLine[];
  deliverySchedule: DeliveryRow[];
  orderPrefix: string;
};

const blankForm = (): FormState => ({
  date: new Date().toISOString().slice(0, 10),
  customerId: "", customerName: "",
  salesPerson: "", salesType: "Local", salesLedger: "",
  poNo: "", poDate: "",
  directDispatch: false,
  orderLines: [],
  obLines: [blankLine()],
  deliverySchedule: [],
  totalAmount: 0, advancePaid: 0,
  remarks: "", status: "Confirmed",
  orderPrefix: "",
  // legacy
  sourceType: "Direct", enquiryId: "", estimationId: "", catalogId: "", catalogNo: "",
  jobName: "", substrate: "", structure: "", categoryId: "", categoryName: "", content: "",
  jobWidth: 0, jobHeight: 0, width: 0, noOfColors: 0, printType: "Surface Print",
  quantity: 0, unit: "Kg", deliveryDate: "", cylinderSet: "", perMeterRate: 0,
  machineId: "", machineName: "", secondaryLayers: [], processes: [], overheadPct: 12, profitPct: 15,
});

// ─── Small cell input ─────────────────────────────────────────
function CI({ value, onChange, type = "text", placeholder = "", min, step, readOnly, cls = "" }: {
  value: string | number; onChange?: (v: string) => void;
  type?: string; placeholder?: string; min?: number; step?: number;
  readOnly?: boolean; cls?: string;
}) {
  return (
    <input
      type={type} value={value} readOnly={readOnly}
      min={min} step={step}
      placeholder={placeholder}
      onChange={e => onChange?.(e.target.value)}
      className={`w-full min-w-[80px] px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white ${readOnly ? "bg-gray-50 text-gray-500" : ""} ${cls}`}
    />
  );
}

function CS({ value, onChange, options, cls = "" }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; cls?: string;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`w-full min-w-[80px] px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white ${cls}`}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function ExtrusionOrdersPage() {
  const [data, setData] = useState<GravureOrder[]>(() => initExtData.map(extOrderToGrv));

  const [formOpen,   setFormOpen]  = useState(false);
  const [editing,    setEditing]   = useState<GravureOrder | null>(null);
  const [form,       setForm]      = useState<FormState>(blankForm());
  const [deleteId,   setDelId]     = useState<string | null>(null);
  const [viewRow,    setViewRow]   = useState<GravureOrder | null>(null);
  const [enquirySearch, setEnquirySearch] = useState("");
  const [addedIds,   setAddedIds]  = useState<Set<string>>(new Set());
  const [dlvInput,   setDlvInput]  = useState<DeliveryRow>(blankDelivery());

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── Customer estimations ────────────────────────────────────
  const custEstimations = useMemo(() =>
    costEstimations.filter(e => e.customerId === form.customerId),
    [form.customerId]
  );

  // ── Enquiry rows = cost estimations for this customer ───────
  const enquiryRows = useMemo(() => {
    const rows = custEstimations.map(e => ({
      id: e.id,
      type: "Estimation" as const,
      productCode: e.estimationNo,
      jobName: `${e.recipeName} / ${e.rollName}`,
      category: "—",
      salesPerson: "—",
      quoteNo: e.estimationNo,
      minQty: 0, orderQty: 0,
      currency: "INR",
      quoteRate: e.totalCostPerKg, apprRate: e.totalCostPerKg,
      unit: "Kg", rateType: "PerKg",
    }));
    const q = enquirySearch.toLowerCase();
    return rows.filter(r => !q || r.jobName.toLowerCase().includes(q) || r.productCode.toLowerCase().includes(q));
  }, [custEstimations, enquirySearch]);

  // ── Computed totals ─────────────────────────────────────────
  const totalOrderQty = useMemo(() => form.obLines.reduce((s, l) => s + l.orderQty, 0), [form.obLines]);
  const totalAmount   = useMemo(() => form.obLines.reduce((s, l) => s + l.amount, 0), [form.obLines]);
  const netAmount     = useMemo(() => form.obLines.reduce((s, l) => s + l.netAmount, 0), [form.obLines]);

  // ── Line helpers ────────────────────────────────────────────
  const updateLine = (idx: number, line: OBLine) =>
    f("obLines", form.obLines.map((l, i) => i === idx ? computeLine(line) : l));
  const removeLine = (idx: number) =>
    f("obLines", form.obLines.filter((_, i) => i !== idx));
  const addLine = () =>
    f("obLines", [...form.obLines, { ...blankLine(), lineNo: form.obLines.length + 1 }]);

  // ── Add from enquiry ────────────────────────────────────────
  const addFromEnquiry = (row: typeof enquiryRows[0]) => {
    const est = costEstimations.find(e => e.id === row.id);
    if (!est) return;
    const newLine = computeLine({
      ...blankLine(), lineNo: form.obLines.length + 1,
      sourceType: "Estimation",
      estimationId: est.id, estimationNo: est.estimationNo,
      productCode: est.estimationNo,
      productName: `${est.recipeName} / ${est.rollName}`,
      substrate: est.rollName,
      orderQty: 0, unit: "Kg",
      minQuotedQty: 0, approvedCost: est.totalCostPerKg,
      rate: est.totalCostPerKg, division: "Extrusion", jobType: "New",
    });
    f("obLines", [...form.obLines, newLine]);
    setAddedIds(prev => new Set([...prev, row.id]));
  };

  // ── Delivery schedule ───────────────────────────────────────
  const addDeliveryRow = () => {
    if (!dlvInput.scheduleQty || !dlvInput.deliveryDate) return;
    const singleLine = form.obLines.length === 1 ? form.obLines[0] : null;
    const row: DeliveryRow = {
      ...dlvInput,
      id: Math.random().toString(36).slice(2),
      pmCode:  dlvInput.pmCode  || singleLine?.productCode  || "",
      quoteNo: dlvInput.quoteNo || singleLine?.estimationNo || "",
      jobName: dlvInput.jobName || singleLine?.productName  || "",
    };
    f("deliverySchedule", [...form.deliverySchedule, row]);
    setDlvInput(blankDelivery());
  };

  // ── Open / close form ───────────────────────────────────────
  const openAdd = () => { setEditing(null); setForm(blankForm()); setFormOpen(true); };

  const openEdit = (row: GravureOrder) => {
    setEditing(row);
    const obLines: OBLine[] = (row.orderLines || []).map(l => computeLine({
      ...blankLine(), ...l,
      hsnGroup: "", minQuotedQty: l.orderQty,
      approvedCost: l.rate, rateType: "PerKg",
      discPct: 0, gstPct: 18, cgstPct: 9, sgstPct: 9, igstPct: 18,
      overheadPctLine: 0, division: "Extrusion",
      jobType: "New", jobReference: "Art Work Approved",
      jobPriority: "Normal", prePressRemark: "", productRemark: "",
      expectedDeliveryDate: l.deliveryDate, finalDeliveryDate: "",
    }));
    setForm({ ...blankForm(), ...row, obLines: obLines.length ? obLines : [blankLine()], deliverySchedule: [], orderPrefix: "" });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  // ── Save ────────────────────────────────────────────────────
  const save = () => {
    if (!form.customerId) { alert("Please select a customer."); return; }
    if (form.obLines.every(l => !l.productName)) { alert("Add at least one product line."); return; }

    const orderLines: GravureOrderLine[] = form.obLines.map(l => ({
      id: l.id, lineNo: l.lineNo,
      sourceType: l.sourceType,
      estimationId: l.estimationId, estimationNo: l.estimationNo,
      catalogId: l.catalogId, catalogNo: l.catalogNo,
      productCode: l.productCode, productName: l.productName,
      categoryId: l.categoryId, categoryName: l.categoryName,
      substrate: l.substrate,
      jobWidth: l.jobWidth, jobHeight: l.jobHeight,
      noOfColors: l.noOfColors, printType: l.printType,
      cylinderStatus: l.cylinderStatus, cylinderCount: l.cylinderCount,
      filmType: l.filmType, laminationRequired: l.laminationRequired,
      orderQty: l.orderQty, unit: l.unit,
      rate: l.rate, currency: l.currency, amount: l.amount,
      deliveryDate: l.expectedDeliveryDate || l.deliveryDate,
      remarks: l.remarks,
    }));

    const firstLine = orderLines[0];
    const payload: Omit<GravureOrder, "id" | "orderNo"> = {
      ...form, orderLines, totalAmount,
      sourceType: firstLine?.sourceType || "Direct",
      jobName: firstLine?.productName || "",
      substrate: firstLine?.substrate || "",
      structure: firstLine?.substrate || "",
      categoryId: firstLine?.categoryId || "",
      categoryName: firstLine?.categoryName || "",
      content: "", jobWidth: firstLine?.jobWidth || 0,
      jobHeight: firstLine?.jobHeight || 0,
      noOfColors: firstLine?.noOfColors || 0,
      printType: firstLine?.printType || "Surface Print",
      quantity: firstLine?.orderQty || 0,
      unit: firstLine?.unit || "Kg",
      deliveryDate: firstLine?.deliveryDate || "",
      perMeterRate: firstLine?.rate || 0,
    };

    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...payload, id: editing.id, orderNo: editing.orderNo } : r));
    } else {
      const orderNo = generateCode(UNIT_CODE.Extrusion, MODULE_CODE.Order, data.map(d => d.orderNo));
      const id = `EO${String(data.length + 1).padStart(3, "0")}`;
      setData(d => [...d, { ...payload, id, orderNo }]);
    }
    closeForm();
  };

  const orderNo = editing
    ? editing.orderNo
    : generateCode(UNIT_CODE.Extrusion, MODULE_CODE.Order, data.map(d => d.orderNo));

  const totalRevenue = data.reduce((s, o) => s + o.totalAmount, 0);

  // ── List columns ─────────────────────────────────────────────
  const columns: Column<GravureOrder>[] = [
    { key: "orderNo",      header: "Order No",    sortable: true },
    { key: "date",         header: "Date",         sortable: true },
    { key: "customerName", header: "Customer",     sortable: true },
    {
      key: "orderLines", header: "Products",
      render: r => (
        <div className="flex flex-wrap gap-1">
          {(r.orderLines || []).slice(0, 2).map((l, i) => (
            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs">{l.productName || "—"}</span>
          ))}
          {(r.orderLines || []).length > 2 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">+{r.orderLines.length - 2}</span>
          )}
        </div>
      ),
    },
    { key: "poNo",        header: "PO No",       render: r => <span className="text-xs font-mono text-gray-500">{r.poNo || "—"}</span> },
    { key: "salesPerson", header: "Sales Person", render: r => <span className="text-sm">{r.salesPerson || "—"}</span> },
    { key: "totalAmount", header: "Amount (₹)",   render: r => <span className="font-semibold">₹{r.totalAmount.toLocaleString()}</span> },
    { key: "status",      header: "Status",        render: r => statusBadge(r.status), sortable: true },
  ];

  // ════════════════════════════════════════════════════════════
  // FORM VIEW (full page)
  // ════════════════════════════════════════════════════════════
  if (formOpen) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* ── Top bar ── */}
        <div className="bg-blue-800 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart size={16} />
            <span className="font-bold text-sm tracking-wide">
              {editing ? `Edit Order — ${editing.orderNo}` : "New Extrusion Order Booking"}
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-blue-600">EXT</span>
          </div>
          <button onClick={closeForm} className="flex items-center gap-1 text-blue-200 hover:text-white text-xs px-3 py-1 rounded hover:bg-blue-700 transition-colors">
            <X size={13} />Back
          </button>
        </div>

        <div className="p-4 space-y-4 max-w-[1600px] mx-auto">

          {/* ── SECTION 1: Header fields ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Order Prefix</label>
                <select value={form.orderPrefix} onChange={e => f("orderPrefix", e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Select...</option>
                  <option value="EXT">EXT</option>
                  <option value="EBO">EBO</option>
                  <option value="EPO">EPO</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Sales Order No.</label>
                <input readOnly value={orderNo}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-blue-100 rounded-lg bg-blue-50 text-blue-700 font-semibold" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Order Date</label>
                <input type="date" value={form.date} onChange={e => f("date", e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Sales Rep.</label>
                <select value={form.salesPerson} onChange={e => f("salesPerson", e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Select...</option>
                  {SALES_PERSONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">PO No.</label>
                <input value={form.poNo} onChange={e => f("poNo", e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Customer PO No." />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">PO Date</label>
                <input type="date" value={form.poDate} onChange={e => f("poDate", e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Client Name *</label>
                <select value={form.customerId}
                  onChange={e => {
                    const c = customers.find(x => x.id === e.target.value);
                    setForm(p => ({ ...blankForm(), customerId: e.target.value, customerName: c?.name || "", date: p.date, orderPrefix: p.orderPrefix }));
                    setAddedIds(new Set());
                    setEnquirySearch("");
                  }}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">-- Select Customer --</option>
                  {customers.filter(c => c.status === "Active").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Sales Type</label>
                <select value={form.salesType} onChange={e => f("salesType", e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {SALES_TYPES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Sales Ledger</label>
                <select value={form.salesLedger} onChange={e => f("salesLedger", e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">-- Select --</option>
                  {SALES_LEDGERS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3 */}
            <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.directDispatch} onChange={e => f("directDispatch", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Truck size={14} className="text-blue-600" />Direct Dispatch
                </span>
              </label>
              <select value={form.status} onChange={e => f("status", e.target.value as FormState["status"])}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                {["Confirmed", "In Production", "Ready", "Dispatched"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* ── PRODUCT REFERENCE — Estimation records for client ── */}
          {form.customerId && enquiryRows.length > 0 && (
            <div className="bg-white border-2 border-amber-300 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <Calculator size={15} className="text-amber-600" />
                  <span className="text-sm font-bold text-amber-800">
                    Product Reference — {form.customerName}
                  </span>
                  <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                    {enquiryRows.length} available
                  </span>
                </div>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={enquirySearch} onChange={e => setEnquirySearch(e.target.value)}
                    placeholder="Search…"
                    className="pl-7 pr-3 py-1 text-xs border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 w-48 bg-white" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-amber-100 text-amber-900 text-[10px] uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left">Job Name</th>
                      <th className="px-3 py-2 text-left">Est. No</th>
                      <th className="px-3 py-2 text-left">Unit</th>
                      <th className="px-3 py-2 text-right">Rate/Kg</th>
                      <th className="px-3 py-2 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enquiryRows.map((row, i) => {
                      const isAdded = addedIds.has(row.id);
                      return (
                        <tr key={row.id}
                          className={`border-t border-amber-100 transition-colors ${
                            isAdded ? "bg-green-50" : i % 2 === 0 ? "bg-white hover:bg-amber-50/60" : "bg-amber-50/30 hover:bg-amber-50/60"
                          }`}>
                          <td className="px-3 py-2 font-semibold text-gray-800">{row.jobName}</td>
                          <td className="px-3 py-2 font-mono text-gray-500 text-[10px]">{row.productCode}</td>
                          <td className="px-3 py-2 text-gray-600">{row.unit}</td>
                          <td className="px-3 py-2 text-right text-blue-700 font-semibold">₹{row.quoteRate}</td>
                          <td className="px-3 py-2 text-center">
                            {isAdded ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-[11px] font-semibold">
                                <Check size={11} />Added
                              </span>
                            ) : (
                              <button onClick={() => addFromEnquiry(row)}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-colors">
                                <Plus size={11} />Add
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SECTION 2: Product Lines Table ── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-blue-700 text-white">
              <span className="text-xs font-bold uppercase tracking-wide">Product Lines</span>
              <div className="flex items-center gap-3">
                <span className="text-blue-200 text-xs">{form.obLines.length} line{form.obLines.length !== 1 ? "s" : ""}</span>
                <button onClick={addLine}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-semibold transition-colors">
                  <Plus size={12} />Add Row
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="text-xs border-separate border-spacing-0 w-auto min-w-full">
                <thead className="bg-blue-800 text-white text-[10px] uppercase tracking-wide">
                  <tr>
                    <th className="px-2 py-2 text-left sticky left-0 z-10 bg-blue-800 min-w-[30px]">#</th>
                    <th className="px-2 py-2 text-left min-w-[90px]">Product Code</th>
                    <th className="px-2 py-2 text-left min-w-[150px]">Product Name</th>
                    <th className="px-2 py-2 text-left min-w-[100px]">Category</th>
                    <th className="px-2 py-2 text-left min-w-[80px]">HSN Group</th>
                    <th className="px-2 py-2 text-right min-w-[80px]">Min Qty</th>
                    <th className="px-2 py-2 text-right min-w-[80px]">Order Qty</th>
                    <th className="px-2 py-2 text-left min-w-[70px]">Unit</th>
                    <th className="px-2 py-2 text-left min-w-[80px]">Rate Type</th>
                    <th className="px-2 py-2 text-right min-w-[80px]">Appr. Cost</th>
                    <th className="px-2 py-2 text-right min-w-[80px]">Rate</th>
                    <th className="px-2 py-2 text-left min-w-[70px]">Currency</th>
                    <th className="px-2 py-2 text-right min-w-[60px]">Disc.%</th>
                    <th className="px-2 py-2 text-right min-w-[80px]">Dis Amt</th>
                    <th className="px-2 py-2 text-right min-w-[90px]">Total Amt</th>
                    <th className="px-2 py-2 text-right min-w-[55px]">GST%</th>
                    <th className="px-2 py-2 text-right min-w-[55px]">CGST%</th>
                    <th className="px-2 py-2 text-right min-w-[55px]">SGST%</th>
                    <th className="px-2 py-2 text-right min-w-[55px]">IGST%</th>
                    <th className="px-2 py-2 text-right min-w-[70px]">CGST</th>
                    <th className="px-2 py-2 text-right min-w-[70px]">SGST</th>
                    <th className="px-2 py-2 text-right min-w-[70px]">IGST</th>
                    <th className="px-2 py-2 text-right min-w-[55px]">OH%</th>
                    <th className="px-2 py-2 text-right min-w-[80px]">OH Amt</th>
                    <th className="px-2 py-2 text-right min-w-[90px]">Net Amount</th>
                    <th className="px-2 py-2 text-left min-w-[110px]">Exp. Del. Date</th>
                    <th className="px-2 py-2 text-left min-w-[110px]">Final Del. Date</th>
                    <th className="px-2 py-2 text-left min-w-[80px]">Job Type</th>
                    <th className="px-2 py-2 text-left min-w-[120px]">Job Reference</th>
                    <th className="px-2 py-2 text-left min-w-[80px]">Priority</th>
                    <th className="px-2 py-2 text-left min-w-[80px]">Division</th>
                    <th className="px-2 py-2 text-left min-w-[100px]">Pre Press Remark</th>
                    <th className="px-2 py-2 text-left min-w-[100px]">Product Remark</th>
                    <th className="px-2 py-2 text-center min-w-[36px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.obLines.map((l, idx) => {
                    const odd = idx % 2 === 0;
                    const srcCls = l.sourceType === "Estimation" ? "border-l-4 border-l-blue-400" : "";
                    return (
                      <tr key={l.id} className={`${odd ? "bg-white" : "bg-gray-50/60"} hover:bg-blue-50/30 ${srcCls}`}>
                        <td className={`px-2 py-1 sticky left-0 z-10 font-bold text-gray-400 ${odd ? "bg-white" : "bg-gray-50"}`}>{idx + 1}</td>
                        <td className="px-2 py-1">
                          {l.productCode
                            ? <span className="text-[10px] font-mono text-gray-600 bg-gray-100 border border-gray-200 px-2 py-1 rounded whitespace-nowrap">{l.productCode}</span>
                            : <span className="text-[10px] text-gray-300">—</span>}
                        </td>
                        <td className="px-1 py-0.5"><CI value={l.productName} onChange={v => updateLine(idx, { ...l, productName: v })} placeholder="Product name" cls="min-w-[145px]" /></td>
                        <td className="px-1 py-0.5"><CI value={l.categoryName} onChange={v => updateLine(idx, { ...l, categoryName: v })} placeholder="Category" /></td>
                        <td className="px-1 py-0.5"><CI value={l.hsnGroup} onChange={v => updateLine(idx, { ...l, hsnGroup: v })} placeholder="HSN" /></td>
                        <td className="px-1 py-0.5"><CI value={l.minQuotedQty || ""} onChange={v => updateLine(idx, { ...l, minQuotedQty: Number(v) })} type="number" min={0} cls="text-right" /></td>
                        <td className="px-1 py-0.5">
                          <CI value={l.orderQty || ""} type="number" min={0}
                            onChange={v => updateLine(idx, { ...l, orderQty: Number(v) })}
                            cls="text-right font-semibold text-blue-700 border-blue-300" />
                        </td>
                        <td className="px-1 py-0.5">
                          <CS value={l.unit} onChange={v => updateLine(idx, { ...l, unit: v })}
                            options={["Kg","Pcs","Nos"].map(u => ({ value: u, label: u }))} />
                        </td>
                        <td className="px-1 py-0.5">
                          <CS value={l.rateType} onChange={v => updateLine(idx, { ...l, rateType: v })}
                            options={RATE_TYPES.map(r => ({ value: r, label: r }))} />
                        </td>
                        <td className="px-1 py-0.5"><CI value={l.approvedCost || ""} type="number" min={0} step={0.01}
                          onChange={v => updateLine(idx, { ...l, approvedCost: Number(v) })} cls="text-right" /></td>
                        <td className="px-1 py-0.5">
                          <CI value={l.rate || ""} type="number" min={0} step={0.01}
                            onChange={v => updateLine(idx, { ...l, rate: Number(v) })}
                            cls="text-right font-semibold text-blue-700 border-blue-300" />
                        </td>
                        <td className="px-1 py-0.5">
                          <CS value={l.currency} onChange={v => updateLine(idx, { ...l, currency: v })}
                            options={CURRENCIES.map(c => ({ value: c, label: c }))} />
                        </td>
                        <td className="px-1 py-0.5"><CI value={l.discPct || ""} type="number" min={0} step={0.5}
                          onChange={v => updateLine(idx, { ...l, discPct: Number(v) })} cls="text-right" /></td>
                        <td className="px-1 py-0.5"><CI value={l.discAmt} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        <td className="px-1 py-0.5"><CI value={l.amount} readOnly cls="text-right font-bold text-blue-700 bg-blue-50" /></td>
                        <td className="px-1 py-0.5"><CI value={l.gstPct} type="number" min={0}
                          onChange={v => {
                            const g = Number(v);
                            updateLine(idx, { ...l, gstPct: g, cgstPct: g / 2, sgstPct: g / 2, igstPct: g });
                          }} cls="text-right" /></td>
                        <td className="px-1 py-0.5"><CI value={l.cgstPct} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        <td className="px-1 py-0.5"><CI value={l.sgstPct} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        <td className="px-1 py-0.5"><CI value={l.igstPct} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        <td className="px-1 py-0.5"><CI value={l.cgstAmt} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        <td className="px-1 py-0.5"><CI value={l.sgstAmt} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        <td className="px-1 py-0.5"><CI value={l.igstAmt} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        <td className="px-1 py-0.5"><CI value={l.overheadPctLine || ""} type="number" min={0} step={0.5}
                          onChange={v => updateLine(idx, { ...l, overheadPctLine: Number(v) })} cls="text-right" /></td>
                        <td className="px-1 py-0.5"><CI value={l.overheadAmtLine} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        <td className="px-1 py-0.5"><CI value={l.netAmount} readOnly cls="text-right font-bold text-purple-700 bg-purple-50" /></td>
                        <td className="px-1 py-0.5"><CI value={l.expectedDeliveryDate} type="date"
                          onChange={v => updateLine(idx, { ...l, expectedDeliveryDate: v })} /></td>
                        <td className="px-1 py-0.5"><CI value={l.finalDeliveryDate} type="date"
                          onChange={v => updateLine(idx, { ...l, finalDeliveryDate: v })} /></td>
                        <td className="px-1 py-0.5">
                          <CS value={l.jobType} onChange={v => updateLine(idx, { ...l, jobType: v })}
                            options={JOB_TYPES.map(j => ({ value: j, label: j }))} />
                        </td>
                        <td className="px-1 py-0.5">
                          <CS value={l.jobReference} onChange={v => updateLine(idx, { ...l, jobReference: v })}
                            options={REFERENCES.map(r => ({ value: r, label: r }))} />
                        </td>
                        <td className="px-1 py-0.5">
                          <CS value={l.jobPriority} onChange={v => updateLine(idx, { ...l, jobPriority: v })}
                            options={PRIORITIES.map(p => ({ value: p, label: p }))} />
                        </td>
                        <td className="px-1 py-0.5">
                          <CS value={l.division} onChange={v => updateLine(idx, { ...l, division: v })}
                            options={DIVISIONS.map(d => ({ value: d, label: d }))} />
                        </td>
                        <td className="px-1 py-0.5"><CI value={l.prePressRemark}
                          onChange={v => updateLine(idx, { ...l, prePressRemark: v })} placeholder="Pre press…" /></td>
                        <td className="px-1 py-0.5"><CI value={l.productRemark}
                          onChange={v => updateLine(idx, { ...l, productRemark: v })} placeholder="Product note…" /></td>
                        <td className="px-1 py-0.5 text-center">
                          <button onClick={() => removeLine(idx)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-blue-700 text-white font-bold text-xs">
                    <td colSpan={6} className="px-3 py-2 text-right text-blue-200 text-[10px] uppercase tracking-wide">Totals</td>
                    <td className="px-2 py-2 text-right">{totalOrderQty.toLocaleString()}</td>
                    <td colSpan={7}></td>
                    <td className="px-2 py-2 text-right">₹{totalAmount.toLocaleString()}</td>
                    <td colSpan={9}></td>
                    <td className="px-2 py-2 text-right">₹{netAmount.toLocaleString()}</td>
                    <td colSpan={8}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SECTION 3: Delivery Schedule ── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-700 text-white">
              <span className="text-xs font-bold uppercase tracking-wide">Delivery Schedule</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3 border-b border-gray-100">
              <div>
                <label className="text-[10px] font-semibold text-gray-500">PM Code</label>
                {form.obLines.length > 1 ? (
                  <select value={dlvInput.pmCode}
                    onChange={e => {
                      const line = form.obLines.find(l => l.productCode === e.target.value);
                      setDlvInput(p => ({
                        ...p, pmCode: e.target.value,
                        quoteNo: line ? (line.estimationNo || "") : p.quoteNo,
                        jobName: line ? (line.productName || p.jobName) : p.jobName,
                      }));
                    }}
                    className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
                    <option value="">-- Select --</option>
                    {form.obLines.filter(l => l.productCode).map(l => (
                      <option key={l.id} value={l.productCode}>{l.productCode} – {l.productName}</option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 min-h-[34px]">
                    {form.obLines[0]?.productCode || <span className="text-gray-300 text-xs">Auto-filled</span>}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Quote No</label>
                <div className="mt-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 min-h-[34px]">
                  {dlvInput.quoteNo || form.obLines[0]?.estimationNo || <span className="text-gray-300 text-xs">Auto-filled</span>}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Job Name</label>
                <input value={dlvInput.jobName} onChange={e => setDlvInput(p => ({ ...p, jobName: e.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Quantity</label>
                <input type="number" value={dlvInput.scheduleQty || ""} onChange={e => setDlvInput(p => ({ ...p, scheduleQty: Number(e.target.value) }))}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Delivery Date</label>
                <input type="date" value={dlvInput.deliveryDate} onChange={e => setDlvInput(p => ({ ...p, deliveryDate: e.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Consignee</label>
                <select value={dlvInput.consignee} onChange={e => setDlvInput(p => ({ ...p, consignee: e.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
                  <option value="">-- Select Consignee --</option>
                  {ledgers.filter(l => l.ledgerType === "Consignee" && l.status === "Active").map(l => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Transporter</label>
                <select value={dlvInput.transporter} onChange={e => setDlvInput(p => ({ ...p, transporter: e.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
                  <option value="">-- Select Transporter --</option>
                  {ledgers.filter(l => l.ledgerType === "Transporter" && l.status === "Active").map(l => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={addDeliveryRow}
                  className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                  + Add
                </button>
              </div>
            </div>

            <table className="min-w-full text-xs">
              <thead className="bg-blue-800 text-white text-[10px] uppercase">
                <tr>
                  {["PM Code", "Approval Code", "Job Name", "Schedule Qty", "Delivery Date", "Consignee Name", "Transporter", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.deliverySchedule.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-sm">No data</td></tr>
                ) : form.deliverySchedule.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2">{row.pmCode || "—"}</td>
                    <td className="px-3 py-2">{row.quoteNo || "—"}</td>
                    <td className="px-3 py-2">{row.jobName || "—"}</td>
                    <td className="px-3 py-2 text-right">{row.scheduleQty.toLocaleString()}</td>
                    <td className="px-3 py-2">{row.deliveryDate}</td>
                    <td className="px-3 py-2">{row.consignee || "—"}</td>
                    <td className="px-3 py-2">{row.transporter || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => f("deliverySchedule", form.deliverySchedule.filter(r => r.id !== row.id))}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <X size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── SECTION 4: Summary + Remarks ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Remark</label>
              <textarea value={form.remarks} onChange={e => f("remarks", e.target.value)}
                rows={4} placeholder="Special instructions, notes…"
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500">Advance Paid (₹)</label>
                  <input type="number" value={form.advancePaid || ""} onChange={e => f("advancePaid", Number(e.target.value))}
                    className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="flex flex-col justify-end">
                  <span className="text-[10px] text-gray-500">Balance Pending</span>
                  <div className={`px-3 py-1.5 rounded-lg font-bold text-sm mt-1 ${totalAmount - form.advancePaid > 0 ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                    ₹{Math.max(0, totalAmount - form.advancePaid).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Total Order Qty</span>
                <span className="text-sm font-bold text-gray-800">{totalOrderQty.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Total Amount</span>
                <span className="text-base font-bold text-blue-700">₹{totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Net Amount</span>
                <span className="text-lg font-black text-purple-700">₹{netAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div className="flex items-center gap-3 pb-6">
            <button onClick={save}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors">
              <Save size={14} />{editing ? "Update" : "Save"}
            </button>
            {editing && (
              <button onClick={() => { setDelId(editing.id); closeForm(); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors">
                <Trash2 size={14} />Delete
              </button>
            )}
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors">
              <FileText size={14} />Print
            </button>
            <button onClick={closeForm}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold rounded-lg transition-colors">
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ShoppingCart size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Extrusion Order Booking</h2>
          </div>
          <p className="text-sm text-gray-500">
            {data.length} orders · ₹{totalRevenue.toLocaleString()} revenue
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Order</Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(["Confirmed", "In Production", "Ready", "Dispatched"] as const).map(s => (
          <div key={s} className={`rounded-xl border p-4 ${STATUS_COLORS[s]}`}>
            <p className="text-xs font-semibold">{s}</p>
            <p className="text-2xl font-bold mt-1">{data.filter(o => o.status === s).length}</p>
            <p className="text-xs mt-1 opacity-70">₹{data.filter(o => o.status === s).reduce((a, o) => a + o.totalAmount, 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Table */}
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

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Order — ${viewRow.orderNo}`} size="xl">
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3 flex-wrap">
              {statusBadge(viewRow.status)}
              {viewRow.directDispatch && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                  <Truck size={11} />Direct Dispatch
                </span>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Order Header</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  ["Customer",     viewRow.customerName],
                  ["Order Date",   viewRow.date],
                  ["Sales Person", viewRow.salesPerson || "—"],
                  ["Sales Type",   viewRow.salesType   || "—"],
                  ["PO No",        viewRow.poNo        || "—"],
                  ["PO Date",      viewRow.poDate      || "—"],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">{k}</p>
                    <p className="font-medium text-gray-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Product Lines ({viewRow.orderLines?.length || 0})</p>
              {(viewRow.orderLines || []).map((line, i) => (
                <div key={line.id} className="border border-gray-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2 sm:col-span-4">
                    <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                    <span className="ml-2 font-semibold text-gray-800">{line.productName}</span>
                  </div>
                  {([
                    ["Code", line.productCode || "—"],
                    ["Qty", `${line.orderQty.toLocaleString()} ${line.unit}`],
                    ["Rate", `₹${line.rate}`],
                    ["Amount", `₹${line.amount.toLocaleString()}`],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] text-gray-400">{k}</p>
                      <p className="font-semibold text-gray-800">{v}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>

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
                <p className="text-xs text-gray-500">Balance</p>
                <p className={`font-bold text-lg ${viewRow.totalAmount > viewRow.advancePaid ? "text-red-600" : "text-green-700"}`}>
                  ₹{Math.max(0, viewRow.totalAmount - viewRow.advancePaid).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-5">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <div className="flex gap-3">
              <Button variant="ghost" icon={<Pencil size={14} />} onClick={() => { setViewRow(null); openEdit(viewRow); }}>Edit</Button>
              <Button icon={<FileText size={14} />} onClick={() => { setViewRow(null); window.location.href = "/extrusion/workorder"; }}>Create Work Order</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDelId(null)} title="Delete Order" size="sm">
          <p className="text-sm text-gray-600 mb-5">This order will be permanently deleted.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDelId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { setData(d => d.filter(r => r.id !== deleteId)); setDelId(null); }}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
