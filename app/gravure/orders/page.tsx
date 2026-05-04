"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Eye, Pencil, Trash2, ShoppingCart, Calculator, BookMarked,
  X, Save, FileText, Truck, Search, ChevronDown, ChevronUp,
  Check, Layers, Printer, List, Paperclip, PauseCircle, AlertTriangle,
  ClipboardList,
} from "lucide-react";
import {
  GravureOrder, GravureOrderLine,
  gravureEstimations, employees, ledgers,
} from "@/data/dummyData";
import { apiGet, apiPost } from "@/lib/api";
import { useProductCatalog } from "@/context/ProductCatalogContext";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button   from "@/components/ui/Button";
import Modal    from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";

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
const DIVISIONS   = ["Gravure"];

const STATUS_COLORS: Record<string, string> = {
  Confirmed:       "bg-blue-50 text-blue-700 border-blue-200",
  "In Production": "bg-amber-50 text-amber-700 border-amber-200",
  Ready:           "bg-purple-50 text-purple-700 border-purple-200",
  Dispatched:      "bg-green-50 text-green-700 border-green-200",
  Hold:            "bg-orange-50 text-orange-700 border-orange-300",
};

type AttachmentMeta = { id: string; name: string; size: number; fileType: string };

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
  noOfColors: 6,
  printType: "Surface Print",
  cylinderStatus: "New", cylinderCount: 0,
  filmType: "BOPP", laminationRequired: false,
  orderQty: 0, unit: "Kg",
  rate: 0, currency: "INR", amount: 0,
  deliveryDate: "",
  remarks: "",
  hsnGroup: "", minQuotedQty: 0,
  rateType: "UnitCost", approvedCost: 0,
  discPct: 0, discAmt: 0,
  gstPct: 18, cgstPct: 9, sgstPct: 9, igstPct: 18,
  cgstAmt: 0, sgstAmt: 0, igstAmt: 0,
  overheadPctLine: 0, overheadAmtLine: 0,
  netAmount: 0,
  expectedDeliveryDate: "", finalDeliveryDate: "",
  jobType: "New", jobReference: "Art Work Approved",
  jobPriority: "Normal", division: "Gravure",
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
  attachments: AttachmentMeta[];
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
  attachments: [],
  // legacy
  sourceType: "Direct", enquiryId: "", estimationId: "", catalogId: "", catalogNo: "",
  jobName: "", substrate: "", structure: "", categoryId: "", categoryName: "", content: "",
  jobWidth: 0, jobHeight: 0, width: 0, noOfColors: 6, printType: "Surface Print",
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
      className={`w-full min-w-[80px] px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white ${readOnly ? "bg-gray-50 text-gray-500" : ""} ${cls}`}
    />
  );
}

function CS({ value, onChange, options, cls = "" }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; cls?: string;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`w-full min-w-[80px] px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white ${cls}`}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function GravureOrdersPage() {
  const { catalog } = useProductCatalog();
  const router = useRouter();

  const [data, setData] = useState<GravureOrder[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [formOpen,   setFormOpen]  = useState(false);
  const [editing,    setEditing]   = useState<GravureOrder | null>(null);
  const [form,       setForm]      = useState<FormState>(blankForm());
  const [deleteId,   setDelId]     = useState<string | null>(null);
  const [viewRow,    setViewRow]   = useState<GravureOrder | null>(null);
  const [showList,   setShowList]  = useState(false);
  const [apiCustomers, setApiCustomers] = useState<{id: string; name: string}[]>([]);
  const [apiSalesLedgers, setApiSalesLedgers] = useState<string[]>([]);
  const [apiSalesPersons, setApiSalesPersons] = useState<string[]>([]);
  const [apiConsignees, setApiConsignees] = useState<{id: string; name: string}[]>([]);
  const [apiTransporters, setApiTransporters] = useState<{id: string; name: string}[]>([]);
  const [apiHsnList, setApiHsnList] = useState<{id: string; hsnCode: string; description: string}[]>([]);
  const [saving, setSaving] = useState(false);

  const mapApiLines = (raw: any): GravureOrderLine[] => {
    // linesJSON is a raw JSON string from the backend (FOR JSON PATH result)
    let arr: any[] = [];
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === "string" && raw) {
      try { arr = JSON.parse(raw); } catch { arr = []; }
    }
    return arr.map((l: any, i: number) => ({
      id:                 String(l.id                  ?? l.OrderBookingDetailsID ?? i),
      lineNo:             Number(l.lineNo              ?? i + 1),
      sourceType:         (l.sourceType                ?? "Direct")          as GravureOrderLine["sourceType"],
      estimationId:       String(l.estimationId        ?? ""),
      estimationNo:       String(l.estimationNo        ?? ""),
      catalogId:          String(l.catalogId           ?? ""),
      catalogNo:          String(l.catalogNo           ?? ""),
      productCode:        String(l.productCode         ?? ""),
      productName:        String(l.productName         ?? ""),
      categoryId:         String(l.categoryId          ?? ""),
      categoryName:       String(l.categoryName        ?? ""),
      substrate:          String(l.substrate           ?? ""),
      jobWidth:           Number(l.jobWidth            ?? 0),
      jobHeight:          Number(l.jobHeight           ?? 0),
      noOfColors:         Number(l.noOfColors          ?? 0),
      printType:          (l.printType                 ?? "Surface Print")   as GravureOrderLine["printType"],
      cylinderStatus:     (l.cylinderStatus            ?? "New")             as GravureOrderLine["cylinderStatus"],
      cylinderCount:      Number(l.cylinderCount       ?? 0),
      filmType:           String(l.filmType            ?? ""),
      laminationRequired: false,
      orderQty:           Number(l.orderQty            ?? 0),
      unit:               String(l.unit               ?? "Kg"),
      rate:               Number(l.rate               ?? 0),
      currency:           "INR",
      amount:             Number(l.amount             ?? 0),
      deliveryDate:       String(l.deliveryDate       ?? l.expectedDeliveryDate ?? ""),
      remarks:            String(l.remarks            ?? ""),
    }));
  };

  const loadOrders = () => {
    setLoadingList(true);
    apiGet<any>("api/gravureOrderBookingShrink/getorders").then(res => {
      const rows: GravureOrder[] = (Array.isArray(res) ? res : []).map((r: any) => {
        const orderLines = mapApiLines(r.linesJSON ?? r.lines ?? []);
        const firstLine  = orderLines[0];
        return {
          id:             String(r.OrderBookingID  ?? ""),
          orderNo:        String(r.SalesOrderNo    ?? ""),
          date:           String(r.OrderBookingDate ?? ""),
          customerId:     String(r.LedgerID        ?? ""),
          customerName:   String(r.CustomerName    ?? ""),
          salesPerson:    String(r.SalesPerson     ?? ""),
          salesType:      String(r.SalesType       ?? "Local"),
          salesLedger:    String(r.SalesLedger     ?? ""),
          poNo:           String(r.PONo            ?? ""),
          poDate:         String(r.PODate          ?? ""),
          directDispatch: Number(r.DirectDispatch  ?? 0) === 1,
          totalAmount:    Number(r.TotalAmount     ?? 0),
          advancePaid:    Number(r.AdvancePaid     ?? 0),
          remarks:        String(r.Remark          ?? ""),
          status:         (r.Status               ?? "Confirmed") as GravureOrder["status"],
          orderLines,
          // legacy fields
          sourceType:     "Direct" as const,
          enquiryId: "", estimationId: "", catalogId: "", catalogNo: "",
          jobName:    firstLine?.productName   ?? "",
          substrate:  firstLine?.substrate     ?? "",
          structure:  "", categoryId: "", categoryName: "", content: "",
          jobWidth:   firstLine?.jobWidth      ?? 0,
          jobHeight:  firstLine?.jobHeight     ?? 0,
          width: 0,
          noOfColors: firstLine?.noOfColors    ?? 0,
          printType:  "Surface Print" as const,
          quantity:   firstLine?.orderQty      ?? 0,
          unit:       firstLine?.unit          ?? "Kg",
          deliveryDate: firstLine?.deliveryDate ?? "",
          cylinderSet: "", perMeterRate: firstLine?.rate ?? 0,
          machineId: "", machineName: "", secondaryLayers: [], processes: [],
          overheadPct: 0, profitPct: 0, attachments: [],
        };
      });
      setData(rows);
    }).catch(() => {}).finally(() => setLoadingList(false));
  };

  useEffect(() => {
    loadOrders();
    apiGet<any>("api/gravureOrderBookingShrink/getdropdowns").then(res => {
      if (res?.customers) {
        const apiList: {id: string; name: string}[] = res.customers.map((c: any) => ({ id: String(c.id ?? ""), name: String(c.name ?? "") }));
        // Merge: keep any pre-injected customer that's not already in the API list
        setApiCustomers(prev => {
          const ids = new Set(apiList.map(c => c.id));
          const extras = prev.filter(c => !ids.has(c.id));
          return [...extras, ...apiList];
        });
      }
      if (res?.salesLedgers)  setApiSalesLedgers(res.salesLedgers.map((l: any) => String(l.name ?? l)));
      if (res?.salesPersons)  setApiSalesPersons(res.salesPersons.map((p: any) => String(p.name ?? p)));
      if (res?.consignees)    setApiConsignees(res.consignees.map((c: any) => ({ id: String(c.id ?? ""), name: String(c.name ?? "") })));
      if (res?.transporters)  setApiTransporters(res.transporters.map((t: any) => ({ id: String(t.id ?? ""), name: String(t.name ?? "") })));
      if (res?.hsnList)       setApiHsnList(res.hsnList.map((h: any) => ({ id: String(h.id ?? ""), hsnCode: String(h.hsnCode ?? ""), description: String(h.description ?? "") })));
    }).catch(() => {});

    const raw = localStorage.getItem("ajsw_order_from_catalog");
    if (raw) {
      try {
        const cat = JSON.parse(raw);
        localStorage.removeItem("ajsw_order_from_catalog");
        // Inject the pre-filled customer immediately so dropdown shows it
        // (API may not have loaded yet)
        if (cat.customerId && cat.customerName) {
          setApiCustomers(prev =>
            prev.some(c => c.id === String(cat.customerId))
              ? prev
              : [{ id: String(cat.customerId), name: cat.customerName }, ...prev]
          );
        }
        const prefillLine = computeLine({
          ...blankLine(),
          lineNo: 1,
          sourceType: "Catalog",
          catalogId:    cat.catalogId    || "",
          catalogNo:    cat.catalogNo    || "",
          productCode:  cat.catalogNo    || "",
          productName:  cat.productName  || "",
          categoryId:   cat.categoryId   || "",
          categoryName: cat.categoryName || "",
          substrate:    cat.substrate    || "",
          jobWidth:     cat.jobWidth     || 0,
          jobHeight:    cat.jobHeight    || 0,
          noOfColors:   cat.noOfColors   || 6,
          orderQty:     cat.standardQty  || 0,
          unit:         cat.standardUnit || "Kg",
          minQuotedQty: cat.standardQty  || 0,
          approvedCost: cat.perMeterRate || 0,
          rate:         cat.perMeterRate || 0,
          cylinderStatus: "Existing",
          division: "Gravure", jobType: "Repeat",
        });
        setForm(p => ({
          ...blankForm(),
          customerId:   cat.customerId   || "",
          customerName: cat.customerName || "",
          date: p.date,
          obLines: [prefillLine],
        }));
        setFormOpen(true);
      } catch {}
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [printOrder, setPrintOrder] = useState<GravureOrder | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [enquirySearch, setEnquirySearch] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Hold modal state
  const [holdTarget, setHoldTarget] = useState<GravureOrder | null>(null);
  const [holdReasonInput, setHoldReasonInput] = useState("");

  // Delivery schedule input state
  const [dlvInput, setDlvInput] = useState<DeliveryRow>(blankDelivery());

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── Customer records ────────────────────────────────────────
  const custGrvEstimations = useMemo(() =>
    gravureEstimations.filter(e => e.customerId === form.customerId),
    [form.customerId]
  );
  const custCatalog = useMemo(() =>
    catalog.filter(c => c.customerId === form.customerId && c.status === "Active"),
    [form.customerId, catalog]
  );

  // Enquiry rows = estimations + catalog
  const enquiryRows = useMemo(() => {
    const est = custGrvEstimations.map(e => ({
      id: e.id, type: "Estimation" as const,
      productCode: e.estimationNo, jobName: e.jobName,
      category: e.categoryName || "—",
      division: "Gravure",
      salesPerson: e.salesPerson || "—",
      quoteNo: e.estimationNo,
      minQty: e.quantity, orderQty: e.quantity,
      currency: "INR",
      quoteRate: e.perMeterRate, apprRate: e.perMeterRate,
      unit: e.unit, rateType: "UnitCost",
    }));
    const cat = custCatalog.map(c => ({
      id: c.id, type: "Catalog" as const,
      productCode: c.catalogNo, jobName: c.productName,
      category: c.categoryName || "—",
      division: "Gravure",
      salesPerson: "—",
      quoteNo: c.catalogNo,
      minQty: c.standardQty, orderQty: c.standardQty,
      currency: "INR",
      quoteRate: c.perMeterRate, apprRate: c.perMeterRate,
      unit: c.standardUnit, rateType: "UnitCost",
    }));
    const q = enquirySearch.toLowerCase();
    return [...est, ...cat].filter(r =>
      !q || r.jobName.toLowerCase().includes(q) || r.productCode.toLowerCase().includes(q)
    );
  }, [custGrvEstimations, custCatalog, enquirySearch]);

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
    if (row.type === "Estimation") {
      const est = gravureEstimations.find(e => e.id === row.id);
      if (!est) return;
      const newLine = computeLine({
        ...blankLine(),
        lineNo: form.obLines.length + 1,
        sourceType: "Estimation",
        estimationId: est.id, estimationNo: est.estimationNo,
        productCode: est.estimationNo,
        productName: est.jobName,
        categoryId: est.categoryId || "", categoryName: est.categoryName || "",
        substrate: est.substrateName || "",
        jobWidth: est.jobWidth, jobHeight: est.jobHeight,
        noOfColors: est.noOfColors,
        orderQty: est.quantity, unit: est.unit,
        minQuotedQty: est.quantity,
        approvedCost: est.perMeterRate,
        rate: est.perMeterRate,
        cylinderStatus: "New", cylinderCount: est.noOfColors,
        division: "Gravure", jobType: "New",
        expectedDeliveryDate: "", finalDeliveryDate: "",
      });
      f("obLines", [...form.obLines, newLine]);
      setAddedIds(prev => new Set([...prev, row.id]));
    } else {
      const cat = custCatalog.find(c => c.id === row.id);
      if (!cat) return;
      const newLine = computeLine({
        ...blankLine(),
        lineNo: form.obLines.length + 1,
        sourceType: "Catalog",
        catalogId: cat.id, catalogNo: cat.catalogNo,
        productCode: cat.catalogNo,
        productName: cat.productName,
        categoryId: cat.categoryId, categoryName: cat.categoryName,
        substrate: cat.substrate || "",
        jobWidth: cat.jobWidth, jobHeight: cat.jobHeight,
        noOfColors: cat.noOfColors,
        orderQty: cat.standardQty, unit: cat.standardUnit,
        minQuotedQty: cat.standardQty,
        approvedCost: cat.perMeterRate,
        rate: cat.perMeterRate,
        cylinderStatus: "Existing",
        division: "Gravure", jobType: "Repeat",
      });
      f("obLines", [...form.obLines, newLine]);
      setAddedIds(prev => new Set([...prev, row.id]));
    }
  };

  // ── Delivery schedule ───────────────────────────────────────
  const addDeliveryRow = () => {
    if (!dlvInput.scheduleQty || !dlvInput.deliveryDate) return;
    const singleLine = form.obLines.length === 1 ? form.obLines[0] : null;
    const row: DeliveryRow = {
      ...dlvInput,
      id: Math.random().toString(36).slice(2),
      pmCode:  dlvInput.pmCode  || singleLine?.productCode  || "",
      quoteNo: dlvInput.quoteNo || singleLine?.estimationNo || singleLine?.catalogNo || "",
      jobName: dlvInput.jobName || singleLine?.productName  || "",
    };
    f("deliverySchedule", [...form.deliverySchedule, row]);
    setDlvInput(blankDelivery());
  };

  // ── Open / close form ───────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm(blankForm());
    setFormOpen(true);
  };

  const openEdit = (row: GravureOrder) => {
    setEditing(row);
    const obLines: OBLine[] = (row.orderLines || []).map((l, i) => computeLine({
      ...blankLine(),
      id:                  l.id || String(i),
      lineNo:              l.lineNo || i + 1,
      sourceType:          l.sourceType    || "Direct",
      estimationId:        l.estimationId  || "",
      estimationNo:        l.estimationNo  || "",
      catalogId:           l.catalogId     || "",
      catalogNo:           l.catalogNo     || "",
      productCode:         l.productCode   || l.catalogNo || "",
      productName:         l.productName   || "",
      categoryId:          l.categoryId    || "",
      categoryName:        l.categoryName  || "",
      substrate:           l.substrate     || "",
      jobWidth:            l.jobWidth      || 0,
      jobHeight:           l.jobHeight     || 0,
      noOfColors:          l.noOfColors    || 0,
      printType:           l.printType     || "Surface Print",
      cylinderStatus:      l.cylinderStatus|| "Existing",
      cylinderCount:       l.cylinderCount || 0,
      orderQty:            l.orderQty      || 0,
      unit:                l.unit          || "Kg",
      rate:                l.rate          || 0,
      currency:            "INR",
      amount:              l.amount        || 0,
      approvedCost:        l.rate          || 0,
      rateType:            "UnitCost",
      discPct: 0, gstPct: 18, cgstPct: 9, sgstPct: 9, igstPct: 18,
      overheadPctLine: 0,
      division: "Gravure",
      jobType:             "Repeat",
      jobReference:        "Art Work Approved",
      jobPriority:         "Normal",
      prePressRemark:      "",
      productRemark:       "",
      expectedDeliveryDate:l.deliveryDate  || "",
      finalDeliveryDate:   "",
      deliveryDate:        l.deliveryDate  || "",
      remarks:             l.remarks       || "",
    }));
    setForm({
      ...blankForm(),
      date:          row.date          || new Date().toISOString().slice(0, 10),
      customerId:    row.customerId    || "",
      customerName:  row.customerName  || "",
      salesPerson:   row.salesPerson   || "",
      salesType:     row.salesType     || "Local",
      salesLedger:   row.salesLedger   || "",
      poNo:          row.poNo          || "",
      poDate:        row.poDate        || "",
      directDispatch:row.directDispatch|| false,
      totalAmount:   row.totalAmount   || 0,
      advancePaid:   row.advancePaid   || 0,
      remarks:       row.remarks       || "",
      status:        row.status        || "Confirmed",
      orderPrefix:   (row.orderNo || "").split(/\d/)[0] || "GRV",
      obLines:       obLines.length ? obLines : [blankLine()],
      deliverySchedule: [],
      attachments:   row.attachments   || [],
      // legacy
      orderLines: row.orderLines || [],
      sourceType: "Direct", enquiryId: "", estimationId: "", catalogId: "", catalogNo: "",
      jobName: "", substrate: "", structure: "", categoryId: "", categoryName: "", content: "",
      jobWidth: 0, jobHeight: 0, width: 0, noOfColors: 6, printType: "Surface Print",
      quantity: 0, unit: "Kg", deliveryDate: "", cylinderSet: "", perMeterRate: 0,
      machineId: "", machineName: "", secondaryLayers: [], processes: [], overheadPct: 12, profitPct: 15,
    });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  // ── Save ────────────────────────────────────────────────────
  const save = async () => {
    if (!form.customerId) { alert("Please select a customer."); return; }
    if (form.obLines.every(l => !l.productName)) { alert("Add at least one product line."); return; }

    const lines = form.obLines.map((l, i) => ({
      lineNo:       i + 1,
      sourceType:   l.sourceType,
      catalogId:    l.catalogId    || "",
      catalogNo:    l.catalogNo    || "",
      estimationId: l.estimationId || "",
      estimationNo: l.estimationNo || "",
      productCode:  l.productCode  || l.catalogNo || "",
      productName:  l.productName  || "",
      categoryId:   l.categoryId   || "",
      categoryName: l.categoryName || "",
      substrate:    l.substrate    || "",
      jobWidth:     l.jobWidth,
      jobHeight:    l.jobHeight,
      noOfColors:   l.noOfColors,
      printType:    l.printType    || "Surface Print",
      cylinderStatus: l.cylinderStatus || "New",
      cylinderCount:  l.cylinderCount  || 0,
      orderQty:     l.orderQty,
      unit:         l.unit         || "Kg",
      rate:         l.rate,
      amount:       l.amount,
      discPct:      l.discPct      || 0,
      discAmt:      l.discAmt      || 0,
      gstPct:       l.gstPct       || 0,
      cgstPct:      l.cgstPct      || 0,
      sgstPct:      l.sgstPct      || 0,
      igstPct:      l.igstPct      || 0,
      cgstAmt:      l.cgstAmt      || 0,
      sgstAmt:      l.sgstAmt      || 0,
      igstAmt:      l.igstAmt      || 0,
      deliveryDate: l.expectedDeliveryDate || l.deliveryDate || "",
      jobType:      l.jobType      || "New",
      jobPriority:  l.jobPriority  || "Normal",
      division:     l.division     || "Gravure",
      remarks:      l.remarks      || "",
    }));

    const delivery = form.deliverySchedule.map((d, i) => ({
      lineNo:       i + 1,
      deliveryDate: d.deliveryDate,
      scheduleQty:  d.scheduleQty,
      jobName:      d.jobName      || "",
      pmCode:       d.pmCode       || "",
      consignee:    d.consignee    || "",
      transporter:  d.transporter  || "",
    }));

    const apiPayload = {
      FlagEdit:        !!editing,
      OrderBookingID:  editing ? (editing.id || 0) : 0,
      Prefix:          form.orderPrefix || "GRV",
      Header: {
        LedgerID:         form.customerId,
        OrderBookingDate: form.date,
        SalesType:        form.salesType || "Local",
        PONo:             form.poNo      || "",
        PODate:           form.poDate    || "",
        SalesLedger:      form.salesLedger || "",
        SalesPerson:      form.salesPerson  || "",
        TotalAmount:      totalAmount,
        AdvancePaid:      form.advancePaid  || 0,
        DirectDispatch:   form.directDispatch ? 1 : 0,
        Remarks:          form.remarks       || "",
        Status:           form.status        || "Confirmed",
      },
      Lines:           lines,
      DeliverySchedule:delivery,
      OneTimeCharges:  [],
      BatchDetails:    [],
    };

    setSaving(true);
    try {
      const res = await apiPost<any>("api/gravureOrderBookingShrink/saveorder", apiPayload);
      if (res?.success === false || res?.Success === false) {
        alert(res?.message || res?.Message || "Save failed.");
        return;
      }
      closeForm();
      loadOrders(); // refresh list from API
    } catch (e: any) {
      alert(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const orderNo = editing
    ? editing.orderNo
    : generateCode(form.orderPrefix || UNIT_CODE.Gravure, MODULE_CODE.Order, data.map(d => d.orderNo));

  // ── Stats ───────────────────────────────────────────────────
  const totalRevenue = data.reduce((s, o) => s + o.totalAmount, 0);

  // ── List columns ─────────────────────────────────────────────
  const columns: Column<GravureOrder>[] = [
    { key: "orderNo",      header: "Order No",   sortable: true },
    { key: "date",         header: "Date",        sortable: true },
    { key: "customerName", header: "Customer",    sortable: true },
    {
      key: "orderLines", header: "Products",
      render: r => (
        <div className="flex flex-wrap gap-1">
          {(r.orderLines || []).slice(0, 2).map((l, i) => (
            <span key={i} className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-100 rounded-full text-xs">{l.productName || "—"}</span>
          ))}
          {(r.orderLines || []).length > 2 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">+{r.orderLines.length - 2}</span>
          )}
        </div>
      ),
    },
    { key: "poNo",         header: "PO No",       render: r => <span className="text-xs font-mono text-gray-500">{r.poNo || "—"}</span> },
    { key: "salesPerson",  header: "Sales Person", render: r => <span className="text-sm">{r.salesPerson || "—"}</span> },
    { key: "totalAmount",  header: "Amount (₹)",  render: r => <span className="font-semibold">₹{r.totalAmount.toLocaleString()}</span> },
    { key: "status",       header: "Status",       render: r => statusBadge(r.status), sortable: true },
  ];

  // ════════════════════════════════════════════════════════════
  // FORM VIEW (full page)
  // ════════════════════════════════════════════════════════════
  if (formOpen) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* ── Top bar ── */}
        <div className="bg-teal-800 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart size={16} />
            <span className="font-bold text-sm tracking-wide">
              {editing ? `Edit Order — ${editing.orderNo}` : "New Gravure Order Booking"}
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-purple-500">GRV</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={closeForm} className="flex items-center gap-1 text-teal-200 hover:text-white text-xs px-3 py-1 rounded hover:bg-teal-700 transition-colors">
              <X size={13} />Back
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-[1600px] mx-auto">

          {/* ── SECTION 1: Header fields ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Order Prefix</label>
                <select value={form.orderPrefix} onChange={e => f("orderPrefix", e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400">
                  <option value="">Select...</option>
                  <option value="GRV">GRV</option>
                  <option value="EXP">EXP</option>
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
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">PO No.</label>
                <input value={form.poNo} onChange={e => f("poNo", e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Customer PO No." />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">PO Date</label>
                <input type="date" value={form.poDate} onChange={e => f("poDate", e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Sales Type</label>
                <select value={form.salesType} onChange={e => f("salesType", e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400">
                  {SALES_TYPES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Client Name *</label>
                <select value={form.customerId}
                  onChange={e => {
                    const c = apiCustomers.find(x => x.id === e.target.value);
                    setForm(p => ({ ...blankForm(), customerId: e.target.value, customerName: c?.name || "", date: p.date, orderPrefix: p.orderPrefix }));
                    setAddedIds(new Set());
                    setEnquirySearch("");
                  }}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400">
                  <option value="">-- Select Customer --</option>
                  {apiCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3: Direct Dispatch + status */}
            <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.directDispatch} onChange={e => f("directDispatch", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-teal-600" />
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Truck size={14} className="text-teal-600" />Direct Dispatch
                </span>
              </label>
              <select value={form.status} onChange={e => f("status", e.target.value as FormState["status"])}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400">
                {["Confirmed", "In Production", "Ready", "Dispatched", "Hold"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* ── PRODUCT REFERENCE — Estimation & Catalog records for client ── */}
          {form.customerId && enquiryRows.length > 0 && (
            <div className="bg-white border-2 border-amber-300 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <Layers size={15} className="text-amber-600" />
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
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Job Name</th>
                      <th className="px-3 py-2 text-left">Product Code</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">Division</th>
                      <th className="px-3 py-2 text-left">Sales Person</th>
                      <th className="px-3 py-2 text-left">Quote No</th>
                      <th className="px-3 py-2 text-right">Min Qty</th>
                      <th className="px-3 py-2 text-right">Order Qty</th>
                      <th className="px-3 py-2 text-left">Unit</th>
                      <th className="px-3 py-2 text-right">Quote Rate</th>
                      <th className="px-3 py-2 text-right">Appr. Rate</th>
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
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              row.type === "Estimation" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
                              {row.type === "Estimation" ? <Calculator size={9} /> : <BookMarked size={9} />}
                              {row.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-semibold text-gray-800 max-w-[180px] truncate" title={row.jobName}>{row.jobName}</td>
                          <td className="px-3 py-2 font-mono text-gray-500 text-[10px]">{row.productCode}</td>
                          <td className="px-3 py-2 text-gray-600">{row.category}</td>
                          <td className="px-3 py-2 text-gray-600">{row.division}</td>
                          <td className="px-3 py-2 text-gray-600">{row.salesPerson}</td>
                          <td className="px-3 py-2 font-mono text-gray-500 text-[10px]">{row.quoteNo}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{row.minQty.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{row.orderQty.toLocaleString()}</td>
                          <td className="px-3 py-2 text-gray-600">{row.unit}</td>
                          <td className="px-3 py-2 text-right text-teal-700 font-semibold">₹{row.quoteRate}</td>
                          <td className="px-3 py-2 text-right text-blue-700 font-semibold">₹{row.apprRate}</td>
                          <td className="px-3 py-2 text-center">
                            {isAdded ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-[11px] font-semibold">
                                <Check size={11} />Added
                              </span>
                            ) : (
                              <button onClick={() => addFromEnquiry(row)}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-semibold transition-colors">
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
            <div className="flex items-center justify-between px-4 py-2.5 bg-teal-700 text-white">
              <span className="text-xs font-bold uppercase tracking-wide">Product Lines</span>
              <div className="flex items-center gap-3">
                <span className="text-teal-200 text-xs">{form.obLines.length} line{form.obLines.length !== 1 ? "s" : ""}</span>
                <button onClick={addLine}
                  className="flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-500 rounded text-xs font-semibold transition-colors">
                  <Plus size={12} />Add Row
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="text-xs border-separate border-spacing-0 w-auto min-w-full">
                <thead className="bg-teal-800 text-white text-[10px] uppercase tracking-wide">
                  <tr>
                    <th className="px-2 py-2 text-left sticky left-0 z-10 bg-teal-800 min-w-[30px]">#</th>
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
                    const srcCls = l.sourceType === "Estimation" ? "border-l-4 border-l-blue-400"
                      : l.sourceType === "Catalog" ? "border-l-4 border-l-purple-400"
                      : "";
                    return (
                      <tr key={l.id} className={`${odd ? "bg-white" : "bg-gray-50/60"} hover:bg-teal-50/30 ${srcCls}`}>
                        <td className={`px-2 py-1 sticky left-0 z-10 font-bold text-gray-400 ${odd ? "bg-white" : "bg-gray-50"}`}>{idx + 1}</td>
                        {/* Product Code - read only, auto-filled */}
                        <td className="px-2 py-1">
                          {l.productCode
                            ? <span className="text-[10px] font-mono text-gray-600 bg-gray-100 border border-gray-200 px-2 py-1 rounded whitespace-nowrap">{l.productCode}</span>
                            : <span className="text-[10px] text-gray-300">—</span>}
                        </td>
                        {/* Product Name */}
                        <td className="px-1 py-0.5"><CI value={l.productName} onChange={v => updateLine(idx, { ...l, productName: v })} placeholder="Product name" cls="min-w-[145px]" /></td>
                        {/* Category */}
                        <td className="px-1 py-0.5"><CI value={l.categoryName} onChange={v => updateLine(idx, { ...l, categoryName: v })} placeholder="Category" /></td>
                        {/* HSN */}
                        <td className="px-1 py-0.5">
                          <select value={l.hsnGroup} onChange={e => updateLine(idx, { ...l, hsnGroup: e.target.value })}
                            className="text-xs border border-gray-200 rounded px-1 py-1 bg-white min-w-[110px] focus:border-purple-400 outline-none">
                            <option value="">-- HSN --</option>
                            {apiHsnList.map(h => <option key={h.id} value={h.hsnCode}>{h.hsnCode} — {h.description}</option>)}
                          </select>
                        </td>
                        {/* Min Qty */}
                        <td className="px-1 py-0.5"><CI value={l.minQuotedQty || ""} onChange={v => updateLine(idx, { ...l, minQuotedQty: Number(v) })} type="number" min={0} cls="text-right" /></td>
                        {/* Order Qty */}
                        <td className="px-1 py-0.5">
                          <CI value={l.orderQty || ""} type="number" min={0}
                            onChange={v => updateLine(idx, { ...l, orderQty: Number(v) })}
                            cls="text-right font-semibold text-teal-700 border-teal-300" />
                        </td>
                        {/* Unit */}
                        <td className="px-1 py-0.5">
                          <CS value={l.unit} onChange={v => updateLine(idx, { ...l, unit: v })}
                            options={["Kg","Pcs","Nos"].map(u => ({ value: u, label: u }))} />
                        </td>
                        {/* Rate Type */}
                        <td className="px-1 py-0.5">
                          <CS value={l.rateType} onChange={v => updateLine(idx, { ...l, rateType: v })}
                            options={RATE_TYPES.map(r => ({ value: r, label: r }))} />
                        </td>
                        {/* Appr Cost */}
                        <td className="px-1 py-0.5"><CI value={l.approvedCost || ""} type="number" min={0} step={0.01}
                          onChange={v => updateLine(idx, { ...l, approvedCost: Number(v) })} cls="text-right" /></td>
                        {/* Rate */}
                        <td className="px-1 py-0.5">
                          <CI value={l.rate || ""} type="number" min={0} step={0.01}
                            onChange={v => updateLine(idx, { ...l, rate: Number(v) })}
                            cls="text-right font-semibold text-blue-700 border-blue-300" />
                        </td>
                        {/* Currency */}
                        <td className="px-1 py-0.5">
                          <CS value={l.currency} onChange={v => updateLine(idx, { ...l, currency: v })}
                            options={CURRENCIES.map(c => ({ value: c, label: c }))} />
                        </td>
                        {/* Disc% */}
                        <td className="px-1 py-0.5"><CI value={l.discPct || ""} type="number" min={0} step={0.5}
                          onChange={v => updateLine(idx, { ...l, discPct: Number(v) })} cls="text-right" /></td>
                        {/* Dis Amt (readonly) */}
                        <td className="px-1 py-0.5"><CI value={l.discAmt} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        {/* Total Amt (readonly) */}
                        <td className="px-1 py-0.5"><CI value={l.amount} readOnly cls="text-right font-bold text-teal-700 bg-teal-50" /></td>
                        {/* GST% */}
                        <td className="px-1 py-0.5"><CI value={l.gstPct} type="number" min={0}
                          onChange={v => {
                            const g = Number(v);
                            updateLine(idx, { ...l, gstPct: g, cgstPct: g / 2, sgstPct: g / 2, igstPct: g });
                          }} cls="text-right" /></td>
                        {/* CGST% */}
                        <td className="px-1 py-0.5"><CI value={l.cgstPct} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        {/* SGST% */}
                        <td className="px-1 py-0.5"><CI value={l.sgstPct} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        {/* IGST% */}
                        <td className="px-1 py-0.5"><CI value={l.igstPct} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        {/* CGST Amt */}
                        <td className="px-1 py-0.5"><CI value={l.cgstAmt} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        {/* SGST Amt */}
                        <td className="px-1 py-0.5"><CI value={l.sgstAmt} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        {/* IGST Amt */}
                        <td className="px-1 py-0.5"><CI value={l.igstAmt} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        {/* OH% */}
                        <td className="px-1 py-0.5"><CI value={l.overheadPctLine || ""} type="number" min={0} step={0.5}
                          onChange={v => updateLine(idx, { ...l, overheadPctLine: Number(v) })} cls="text-right" /></td>
                        {/* OH Amt */}
                        <td className="px-1 py-0.5"><CI value={l.overheadAmtLine} readOnly cls="text-right bg-gray-50 text-gray-500" /></td>
                        {/* Net Amount */}
                        <td className="px-1 py-0.5"><CI value={l.netAmount} readOnly cls="text-right font-bold text-purple-700 bg-purple-50" /></td>
                        {/* Expected Del */}
                        <td className="px-1 py-0.5"><CI value={l.expectedDeliveryDate} type="date"
                          onChange={v => updateLine(idx, { ...l, expectedDeliveryDate: v })} /></td>
                        {/* Final Del */}
                        <td className="px-1 py-0.5"><CI value={l.finalDeliveryDate} type="date"
                          onChange={v => updateLine(idx, { ...l, finalDeliveryDate: v })} /></td>
                        {/* Job Type */}
                        <td className="px-1 py-0.5">
                          <CS value={l.jobType} onChange={v => updateLine(idx, { ...l, jobType: v })}
                            options={JOB_TYPES.map(j => ({ value: j, label: j }))} />
                        </td>
                        {/* Job Reference */}
                        <td className="px-1 py-0.5">
                          <CS value={l.jobReference} onChange={v => updateLine(idx, { ...l, jobReference: v })}
                            options={REFERENCES.map(r => ({ value: r, label: r }))} />
                        </td>
                        {/* Priority */}
                        <td className="px-1 py-0.5">
                          <CS value={l.jobPriority} onChange={v => updateLine(idx, { ...l, jobPriority: v })}
                            options={PRIORITIES.map(p => ({ value: p, label: p }))} />
                        </td>
                        {/* Division */}
                        <td className="px-1 py-0.5">
                          <CS value={l.division} onChange={v => updateLine(idx, { ...l, division: v })}
                            options={DIVISIONS.map(d => ({ value: d, label: d }))} />
                        </td>
                        {/* Pre Press Remark */}
                        <td className="px-1 py-0.5"><CI value={l.prePressRemark}
                          onChange={v => updateLine(idx, { ...l, prePressRemark: v })} placeholder="Pre press…" /></td>
                        {/* Product Remark */}
                        <td className="px-1 py-0.5"><CI value={l.productRemark}
                          onChange={v => updateLine(idx, { ...l, productRemark: v })} placeholder="Product note…" /></td>
                        {/* Delete */}
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
                  <tr className="bg-teal-700 text-white font-bold text-xs">
                    <td colSpan={6} className="px-3 py-2 text-right text-teal-200 text-[10px] uppercase tracking-wide">Totals</td>
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
            {/* Input row */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3 border-b border-gray-100">
              <div>
                <label className="text-[10px] font-semibold text-gray-500">PM Code</label>
                {form.obLines.length > 1 ? (
                  <select
                    value={dlvInput.pmCode}
                    onChange={e => {
                      const line = form.obLines.find(l => l.productCode === e.target.value);
                      setDlvInput(p => ({
                        ...p,
                        pmCode: e.target.value,
                        quoteNo: line ? (line.estimationNo || line.catalogNo || "") : p.quoteNo,
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
                  {dlvInput.quoteNo || form.obLines[0]?.estimationNo || form.obLines[0]?.catalogNo || <span className="text-gray-300 text-xs">Auto-filled</span>}
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
                  {apiConsignees.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Transporter</label>
                <select value={dlvInput.transporter} onChange={e => setDlvInput(p => ({ ...p, transporter: e.target.value }))}
                  className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
                  <option value="">-- Select Transporter --</option>
                  {apiTransporters.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={addDeliveryRow}
                  className="w-full px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors">
                  + Add
                </button>
              </div>
            </div>

            {/* Schedule table */}
            <table className="min-w-full text-xs">
              <thead className="bg-teal-800 text-white text-[10px] uppercase">
                <tr>
                  {["PM Code", "Approval Code", "Job Name", "Schedule Qty", "Delivery Date", "Consignee Name", "Transporter", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.deliverySchedule.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-sm">No data</td>
                  </tr>
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

          {/* ── SECTION 4: Attachments ── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-700 text-white">
              <div className="flex items-center gap-2">
                <Paperclip size={14} className="text-gray-300" />
                <span className="text-xs font-bold uppercase tracking-wide">Attachments</span>
                {form.attachments.length > 0 && (
                  <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">{form.attachments.length} file{form.attachments.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 border-dashed rounded-lg text-sm text-gray-600 font-medium transition-colors">
                  <Paperclip size={14} className="text-gray-500" />
                  Attach Sample / File
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ai,.cdr,.eps,.psd"
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      const newMeta: AttachmentMeta[] = files.map(file => ({
                        id: Math.random().toString(36).slice(2),
                        name: file.name,
                        size: file.size,
                        fileType: file.type || "application/octet-stream",
                      }));
                      f("attachments", [...form.attachments, ...newMeta]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-gray-400">Images, PDF, AI, CDR, PSD, Office files supported</span>
              </div>

              {form.attachments.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {form.attachments.map(att => {
                    const isImage = att.fileType.startsWith("image/");
                    const isPdf = att.fileType === "application/pdf";
                    const sizeKB = (att.size / 1024).toFixed(1);
                    return (
                      <div key={att.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                          isImage ? "bg-blue-100 text-blue-700" : isPdf ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-600"
                        }`}>
                          {isImage ? "IMG" : isPdf ? "PDF" : "FILE"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{att.name}</p>
                          <p className="text-[10px] text-gray-400">{sizeKB} KB</p>
                        </div>
                        <button
                          onClick={() => f("attachments", form.attachments.filter(a => a.id !== att.id))}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {form.attachments.length === 0 && (
                <p className="mt-2 text-xs text-gray-400">No attachments yet. Attach order samples, art files, or reference documents.</p>
              )}
            </div>
          </div>

          {/* ── SECTION 5: Summary + Remarks ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Remark</label>
              <textarea value={form.remarks} onChange={e => f("remarks", e.target.value)}
                rows={4} placeholder="Special instructions, notes…"
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500">Advance Paid (₹)</label>
                  <input type="number" value={form.advancePaid || ""} onChange={e => f("advancePaid", Number(e.target.value))}
                    className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
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
                <span className="text-base font-bold text-teal-700">₹{totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Net Amount</span>
                <span className="text-lg font-black text-purple-700">₹{netAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-medium text-gray-600">INR</span>
                <span className="text-xs text-gray-400">1</span>
              </div>
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div className="flex items-center gap-3 pb-6">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors">
              <Save size={14} />{saving ? "Saving…" : editing ? "Update" : "Save"}
            </button>
            {editing && (
              <button onClick={() => { setDelId(editing.id); closeForm(); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors">
                <Trash2 size={14} />Delete
              </button>
            )}
            {editing && (
              <button onClick={() => setPrintOrder(editing)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors">
                <Printer size={14} />Print
              </button>
            )}
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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ShoppingCart size={18} className="text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Order Booking</h2>
          </div>
          <p className="text-sm text-gray-500">
            {data.length} orders · ₹{totalRevenue.toLocaleString()} revenue
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Order</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        {loadingList && (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Loading orders…
          </div>
        )}
        {!loadingList && <DataTable
          data={data}
          columns={columns}
          searchKeys={["orderNo", "customerName", "poNo", "salesPerson"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Printer size={13} />} onClick={() => setPrintOrder(row)}>Print</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              {row.status !== "Hold" ? (
                <button
                  onClick={() => { setHoldTarget(row); setHoldReasonInput(""); }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                >
                  <PauseCircle size={12} />Hold
                </button>
              ) : (
                <button
                  onClick={() => setData(d => d.map(r => r.id === row.id ? { ...r, status: "Confirmed", holdReason: undefined } : r))}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                >
                  <Check size={12} />Unhold
                </button>
              )}
              <button
                onClick={() => {
                  sessionStorage.setItem("createPWOFromOrder", JSON.stringify({
                    orderId:      row.id,
                    orderNo:      row.orderNo,
                    customerId:   row.customerId,
                    customerName: row.customerName,
                    salesType:    row.salesType ?? "",
                    lines:        row.orderLines ?? [],
                  }));
                  router.push("/gravure/workorder");
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
              >
                <ClipboardList size={12} />Create PWO
              </button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDelId(row.id)}>Delete</Button>
            </div>
          )}
        />}
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
              {viewRow.attachments && viewRow.attachments.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold">
                  <Paperclip size={11} />{viewRow.attachments.length} attachment{viewRow.attachments.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {viewRow.status === "Hold" && viewRow.holdReason && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm">
                <AlertTriangle size={14} className="text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-orange-800">Hold Reason: </span>
                  <span className="text-orange-700">{viewRow.holdReason}</span>
                </div>
              </div>
            )}

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
                    <span className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      line.sourceType === "Estimation" ? "bg-blue-50 text-blue-700" :
                      line.sourceType === "Catalog" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                      {line.sourceType}
                    </span>
                  </div>
                  {([
                    ["Code", line.productCode || "—"],
                    ["Qty", `${line.orderQty.toLocaleString()} ${line.unit}`],
                    ["Rate", `₹${line.rate}`],
                    ["Amount", `₹${line.amount.toLocaleString()}`],
                  ] as [string,string][]).map(([k,v]) => (
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
              <Button icon={<Layers size={14} />} onClick={() => { setViewRow(null); window.location.href = "/gravure/workorder"; }}>Create Work Order</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ SHOW LIST POPUP ═══════════════════════════════════════ */}
      {showList && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => setShowList(false)} />
          <div className="fixed z-[61] inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[800px] top-12 bottom-8 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-teal-800 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <List size={16} className="text-teal-300" />
                <span className="font-bold text-sm">Booked Orders ({data.length})</span>
              </div>
              <button onClick={() => setShowList(false)} className="p-1.5 hover:bg-teal-700 rounded-lg transition"><X size={16} /></button>
            </div>
            {/* Search */}
            <div className="px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={listSearch} onChange={e => setListSearch(e.target.value)}
                  placeholder="Search by order no, customer, PO..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
            </div>
            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {data
                .filter(o => {
                  const q = listSearch.toLowerCase();
                  return !q || o.orderNo.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || (o.poNo || "").toLowerCase().includes(q);
                })
                .map(o => (
                  <div key={o.id} className="px-4 py-3 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-3">
                      {/* Left info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-black text-sm text-teal-800 font-mono">{o.orderNo}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[o.status]}`}>{o.status}</span>
                          {o.directDispatch && <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">Direct Dispatch</span>}
                          {o.attachments && o.attachments.length > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full flex items-center gap-1"><Paperclip size={9} />{o.attachments.length}</span>}
                        </div>
                        <div className="text-sm font-semibold text-gray-800 truncate">{o.customerName}</div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                          <span>{o.date}</span>
                          {o.poNo && <span>PO: <strong className="text-gray-700">{o.poNo}</strong></span>}
                          {o.salesPerson && <span>Sales: <strong className="text-gray-700">{o.salesPerson}</strong></span>}
                          <span className="text-[10px] font-bold text-gray-700">{o.orderLines?.length || 0} product{(o.orderLines?.length || 0) !== 1 ? "s" : ""}</span>
                          <span className="font-bold text-green-700">₹{o.totalAmount.toLocaleString("en-IN")}</span>
                        </div>
                        {/* Product tags */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(o.orderLines || []).slice(0, 3).map((l, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-100 rounded-full">{l.productName || l.productCode || "—"}</span>
                          ))}
                          {(o.orderLines || []).length > 3 && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">+{o.orderLines.length - 3} more</span>}
                        </div>
                        {o.status === "Hold" && o.holdReason && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1">
                            <AlertTriangle size={9} className="flex-shrink-0" />
                            <span><strong>Hold:</strong> {o.holdReason}</span>
                          </div>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button onClick={() => { setPrintOrder(o); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition">
                          <Printer size={11} /> Print
                        </button>
                        <button onClick={() => { setShowList(false); openEdit(o); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold rounded-lg transition">
                          <Pencil size={11} /> Edit
                        </button>
                        {o.status !== "Hold" ? (
                          <button onClick={() => { setHoldTarget(o); setHoldReasonInput(""); setShowList(false); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-300 text-[11px] font-bold rounded-lg transition">
                            <PauseCircle size={11} /> Hold
                          </button>
                        ) : (
                          <button onClick={() => setData(d => d.map(r => r.id === o.id ? { ...r, status: "Confirmed", holdReason: undefined } : r))}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-300 text-[11px] font-bold rounded-lg transition">
                            <Check size={11} /> Unhold
                          </button>
                        )}
                        <button onClick={() => { setDelId(o.id); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold rounded-lg transition">
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              {data.length === 0 && (
                <div className="p-12 text-center text-gray-400 text-sm">No orders booked yet.</div>
              )}
            </div>
            {/* Footer */}
            <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
              <span>{data.length} orders · ₹{data.reduce((s, o) => s + o.totalAmount, 0).toLocaleString("en-IN")} total</span>
              <button onClick={() => setShowList(false)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg text-xs transition">Close</button>
            </div>
          </div>
        </>
      )}

      {/* ══ ORDER PRINT MODAL ════════════════════════════════════ */}
      {printOrder && (() => {
        const o = printOrder;
        const balance = Math.max(0, o.totalAmount - o.advancePaid);
        const handlePrint = () => {
          const el = document.getElementById("order-print-area");
          if (!el) return;
          const orig = document.body.innerHTML;
          document.body.innerHTML = el.innerHTML;
          window.print();
          document.body.innerHTML = orig;
          window.location.reload();
        };
        const S = (n: number) => `₹${n.toLocaleString("en-IN")}`;
        return (
          <>
            <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={() => setPrintOrder(null)} />
            <div className="fixed z-[71] inset-4 sm:inset-8 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 bg-teal-900 text-white flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Printer size={18} className="text-teal-300" />
                  <span className="font-bold text-sm">Order Confirmation Print — {o.orderNo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition">
                    <Printer size={14} /> Print
                  </button>
                  <button onClick={() => setPrintOrder(null)} className="p-2 hover:bg-white/10 rounded-lg transition"><X size={16} /></button>
                </div>
              </div>
              {/* Scrollable preview */}
              <div className="flex-1 overflow-auto bg-gray-100 p-4 sm:p-8">
                <div id="order-print-area" className="bg-white mx-auto shadow-lg" style={{ width: "210mm", minHeight: "297mm", padding: "12mm", fontFamily: "Arial, sans-serif", fontSize: "9pt", color: "#111" }}>

                  {/* ── HEADER ── */}
                  <div style={{ borderBottom: "3px solid #0f766e", paddingBottom: "6px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "16pt", fontWeight: "900", color: "#0f766e", letterSpacing: "1px" }}>AJ SHRINK INDUSTRIES</div>
                        <div style={{ fontSize: "7.5pt", color: "#555", marginTop: "2px" }}>Gravure Printing &amp; Flexible Packaging</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "13pt", fontWeight: "800", color: "#1e3a8a", letterSpacing: "2px" }}>ORDER CONFIRMATION</div>
                        <div style={{ fontSize: "7.5pt", color: "#555", marginTop: "2px" }}>Gravure Sales Order</div>
                      </div>
                    </div>
                  </div>

                  {/* ── ORDER IDENTITY STRIP ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0", border: "2px solid #0f766e", marginBottom: "8px" }}>
                    {[
                      ["Order No",    o.orderNo],
                      ["Order Date",  o.date],
                      ["Status",      o.status],
                      ["PO No",       o.poNo || "—"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ padding: "5px 8px", borderRight: "1px solid #99f6e4" }}>
                        <div style={{ fontSize: "6.5pt", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>{k}</div>
                        <div style={{ fontSize: "9pt", fontWeight: "800", color: "#0f766e" }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── CUSTOMER INFO ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px", marginBottom: "8px" }}>
                    {[
                      ["Customer Name",  o.customerName],
                      ["Sales Person",   o.salesPerson   || "—"],
                      ["Sales Type",     o.salesType     || "—"],
                      ["PO Date",        o.poDate        || "—"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ border: "1px solid #d1d5db", borderRadius: "4px", padding: "5px 8px", background: "#f0fdfa" }}>
                        <div style={{ fontSize: "6.5pt", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>{k}</div>
                        <div style={{ fontSize: "9pt", fontWeight: "800", color: "#111" }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── PRODUCT LINES TABLE ── */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ background: "#0f766e", color: "white", padding: "3px 8px", fontSize: "7.5pt", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Product / Order Lines</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d1d5db" }}>
                      <thead>
                        <tr style={{ background: "#f0fdfa" }}>
                          {["#", "Product / Job Name", "Category", "Size (mm)", "Colors", "Cyl.", "Qty", "Unit", "Rate (₹)", "Disc%", "Amount (₹)", "Delivery"].map(h => (
                            <th key={h} style={{ padding: "3px 5px", border: "1px solid #d1d5db", fontSize: "6.5pt", fontWeight: "700", textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(o.orderLines || []).map((l, i) => (
                          <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#f0fdfa" }}>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "center", fontWeight: "700" }}>{i + 1}</td>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", fontWeight: "700" }}>
                              <div>{l.productName || "—"}</div>
                              {l.productCode && <div style={{ fontSize: "6.5pt", color: "#6b7280" }}>{l.productCode}</div>}
                              <span style={{ fontSize: "6.5pt", padding: "1px 5px", borderRadius: "8px", background: l.sourceType === "Estimation" ? "#dbeafe" : l.sourceType === "Catalog" ? "#ede9fe" : "#f3f4f6", color: l.sourceType === "Estimation" ? "#1d4ed8" : l.sourceType === "Catalog" ? "#6d28d9" : "#374151", fontWeight: "700" }}>{l.sourceType}</span>
                            </td>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", fontSize: "7.5pt" }}>{l.categoryName || "—"}</td>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "center" }}>{l.jobWidth && l.jobHeight ? `${l.jobWidth}×${l.jobHeight}` : "—"}</td>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "center" }}>{l.noOfColors}C</td>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "center", fontSize: "7.5pt" }}>{l.cylinderStatus}</td>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: "700" }}>{l.orderQty.toLocaleString("en-IN")}</td>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "center" }}>{l.unit}</td>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "right" }}>₹{l.rate}</td>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "center" }}>—</td>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: "700" }}>{S(l.amount)}</td>
                            <td style={{ padding: "3px 5px", border: "1px solid #e5e7eb", fontSize: "7.5pt" }}>{l.deliveryDate || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#f0fdfa", borderTop: "2px solid #0f766e" }}>
                          <td colSpan={11} style={{ padding: "4px 8px", border: "1px solid #d1d5db", fontWeight: "700", textAlign: "right", fontSize: "8.5pt" }}>Order Total</td>
                          <td style={{ padding: "4px 8px", border: "2px solid #0f766e", textAlign: "right", fontWeight: "900", fontSize: "10pt", color: "#0f766e" }}>{S(o.totalAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* ── FINANCIAL SUMMARY ── */}
                  <div style={{ marginBottom: "8px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                    {[
                      { label: "Order Total",   val: S(o.totalAmount),  bg: "#f0fdfa", border: "#0f766e", color: "#0f766e" },
                      { label: "Advance Paid",  val: S(o.advancePaid),  bg: "#f0fdf4", border: "#16a34a", color: "#16a34a" },
                      { label: "Balance Due",   val: S(balance),        bg: balance > 0 ? "#fef2f2" : "#f0fdf4", border: balance > 0 ? "#dc2626" : "#16a34a", color: balance > 0 ? "#dc2626" : "#16a34a" },
                    ].map(s => (
                      <div key={s.label} style={{ border: `2px solid ${s.border}`, borderRadius: "4px", padding: "8px 12px", background: s.bg, textAlign: "center" }}>
                        <div style={{ fontSize: "7pt", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>{s.label}</div>
                        <div style={{ fontSize: "14pt", fontWeight: "900", color: s.color, marginTop: "2px" }}>{s.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── REMARKS ── */}
                  {o.remarks && (
                    <div style={{ marginBottom: "8px", border: "1px solid #d1d5db", borderRadius: "4px", padding: "6px 10px", background: "#fffbeb" }}>
                      <div style={{ fontSize: "7pt", fontWeight: "800", color: "#b45309", textTransform: "uppercase", marginBottom: "3px" }}>Remarks / Terms</div>
                      <div style={{ fontSize: "8.5pt" }}>{o.remarks}</div>
                    </div>
                  )}

                  {/* ── TERMS BOX ── */}
                  <div style={{ marginBottom: "8px", border: "1px solid #d1d5db", borderRadius: "4px", padding: "6px 10px", background: "#f9fafb" }}>
                    <div style={{ fontSize: "7pt", fontWeight: "800", color: "#374151", textTransform: "uppercase", marginBottom: "4px" }}>Standard Terms &amp; Conditions</div>
                    <div style={{ fontSize: "7pt", color: "#6b7280", lineHeight: "1.6" }}>
                      1. Goods once dispatched cannot be returned without prior approval. &nbsp;|&nbsp;
                      2. Payment as per agreed credit terms. &nbsp;|&nbsp;
                      3. Disputes subject to local jurisdiction. &nbsp;|&nbsp;
                      4. Prices valid for 30 days from order date.
                    </div>
                  </div>

                  {/* ── SIGN-OFF ── */}
                  <div style={{ marginTop: "10px", borderTop: "2px solid #0f766e", paddingTop: "8px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        <tr>
                          {["Prepared By", "Authorized Signatory", "Customer Signature", "Accounts"].map(role => (
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
                    <span>AJ Shrink Industries — Gravure Order Confirmation</span>
                    <span>{o.orderNo}</span>
                  </div>

                </div>{/* end print area */}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── HOLD REASON MODAL ── */}
      {holdTarget && (
        <Modal open={!!holdTarget} onClose={() => setHoldTarget(null)} title="Put Order on Hold" size="sm">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <AlertTriangle size={16} className="text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800">{holdTarget.orderNo} — {holdTarget.customerName}</p>
                <p className="text-xs text-orange-600 mt-0.5">This order will be marked as <strong>Hold</strong> and paused from production.</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Reason for Hold *</label>
              <textarea
                value={holdReasonInput}
                onChange={e => setHoldReasonInput(e.target.value)}
                rows={3}
                placeholder="e.g. Awaiting customer approval, Payment pending, Design revision required…"
                className="mt-1.5 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setHoldTarget(null)}>Cancel</Button>
              <button
                disabled={!holdReasonInput.trim()}
                onClick={() => {
                  if (!holdReasonInput.trim()) return;
                  setData(d => d.map(r => r.id === holdTarget!.id
                    ? { ...r, status: "Hold" as const, holdReason: holdReasonInput.trim() }
                    : r
                  ));
                  setHoldTarget(null);
                  setHoldReasonInput("");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors"
              >
                <PauseCircle size={14} />Confirm Hold
              </button>
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
            <Button variant="danger" onClick={() => {
              apiPost("api/gravureOrderBookingShrink/deleteorder", { OrderBookingID: deleteId })
                .catch(() => {})
                .finally(() => { setDelId(null); loadOrders(); });
            }}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
