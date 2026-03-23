"use client";
import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, X, Search, FileText, ClipboardList, List, Save, Check } from "lucide-react";
import {
  items as allItems, Item,
  purchaseRequisitions as allPRs, PurchaseRequisition,
  purchaseOrders as initData, PurchaseOrder, POLine, POCharge,
  SUPPLIERS, hsnMasters,
} from "@/data/dummyData";
import { inputCls } from "@/lib/styles";

// ─── Constants ───────────────────────────────────────────────
const COMPANY_STATE = "Maharashtra";
const DIVISIONS = ["COM", "RTO", "EXT"];
const CURRENCIES = ["INR", "USD", "EUR"];
const TRANSPORT_MODES = ["Road", "Rail", "Air", "Sea", "Courier"];
const PAYMENT_TERMS = ["Advance", "30 Days", "45 Days", "60 Days", "90 Days", "LC 30 Days", "LC 60 Days"];
const CHARGE_TYPES = ["Freight Charges", "Insurance", "Loading / Unloading", "Round Off", "TCS", "Discount", "IGST Payable", "Other Charges"];
const APPROVAL_BY = ["Director", "Purchase Manager", "GM Operations", "CFO"];

// ─── Helpers ────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtAmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const nextPONo = (list: PurchaseOrder[]) => {
  const yr = new Date().getFullYear();
  return `PO${String(list.length + 1).padStart(5, "0")}_${String(yr - 2000).padStart(2, "0")}_${String(yr - 1999).padStart(2, "0")}`;
};

const recalcLine = (line: POLine, sameState: boolean): POLine => {
  const basicAmt = line.poQtyInPU * line.rate;
  const discAmt = basicAmt * line.discPct / 100;
  const afterDiscAmt = basicAmt - discAmt;
  const cgstAmt = sameState ? afterDiscAmt * line.gstPct / 2 / 100 : 0;
  const sgstAmt = sameState ? afterDiscAmt * line.gstPct / 2 / 100 : 0;
  const igstAmt = !sameState ? afterDiscAmt * line.gstPct / 100 : 0;
  const totalAmt = afterDiscAmt + cgstAmt + sgstAmt + igstAmt;
  return { ...line, basicAmt, afterDiscAmt, cgstAmt, sgstAmt, igstAmt, taxableAmt: afterDiscAmt, totalAmt };
};

const STATUS_STYLE: Record<PurchaseOrder["status"], string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Approved:  "bg-green-100 text-green-700",
  Sent:      "bg-blue-100 text-blue-700",
  Closed:    "bg-purple-100 text-purple-700",
  Cancelled: "bg-red-100 text-red-700",
};

const PR_STATUS_STYLE: Record<PurchaseRequisition["status"], string> = {
  Draft:     "bg-gray-100 text-gray-500",
  Submitted: "bg-blue-100 text-blue-700",
  Approved:  "bg-green-100 text-green-700",
  Rejected:  "bg-red-100 text-red-600",
  Ordered:   "bg-purple-100 text-purple-700",
};

// ─── Shared UI helpers ───────────────────────────────────────
const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">
    {title}
  </h3>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const selectCls = "w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white";
const tableInputCls = "text-right px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";

// ─── Main ────────────────────────────────────────────────────
export default function PurchaseOrderPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<PurchaseOrder[]>(initData);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "items" | "terms" | "summary">("basic");

  // Form state
  const [poDate, setPoDate] = useState(todayISO());
  const [prRef, setPrRef] = useState("");
  const [supplier, setSupplier] = useState("");
  const [division, setDivision] = useState("COM");
  const [currency, setCurrency] = useState("INR");
  const [contactPerson, setContactPerson] = useState("");
  const [approvalBy, setApprovalBy] = useState("");
  const [billTo, setBillTo] = useState("");
  const [lines, setLines] = useState<POLine[]>([]);
  const [charges, setCharges] = useState<POCharge[]>([]);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [modeOfTransport, setModeOfTransport] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [purchaseRef, setPurchaseRef] = useState("");
  const [remark, setRemark] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | PurchaseOrder["status"]>("All");
  const [listSearch, setListSearch] = useState("");

  // Picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerGroup, setPickerGroup] = useState("All");
  const [showChargeMenu, setShowChargeMenu] = useState(false);

  // Derived
  const supplierInfo = useMemo(() =>
    SUPPLIERS.find((s) => s.name === supplier) ?? null, [supplier]);
  const sameState = supplierInfo?.state === COMPANY_STATE;

  const rmItems = useMemo(
    () => allItems.filter((i) => i.category === "Raw Material (RM)" && i.active), []
  );
  const rmGroups = useMemo(
    () => ["All", ...Array.from(new Set(rmItems.map((i) => i.group)))], [rmItems]
  );
  const pickerItems = useMemo(() => {
    const s = pickerSearch.toLowerCase();
    return rmItems.filter((i) => {
      if (pickerGroup !== "All" && i.group !== pickerGroup) return false;
      return !s || i.name.toLowerCase().includes(s) || i.code.toLowerCase().includes(s);
    });
  }, [rmItems, pickerGroup, pickerSearch]);

  // Totals
  const basicAmount   = lines.reduce((s, l) => s + l.basicAmt, 0);
  const discAmount    = lines.reduce((s, l) => s + (l.basicAmt - l.afterDiscAmt), 0);
  const totalTax      = lines.reduce((s, l) => s + l.cgstAmt + l.sgstAmt + l.igstAmt, 0);
  const otherCharges  = charges.filter(c => !c.name.toLowerCase().includes("discount"))
                                .reduce((s, c) => s + c.amount, 0);
  const chargeDisc    = charges.filter(c => c.name.toLowerCase().includes("discount"))
                                .reduce((s, c) => s + c.amount, 0);
  const grossAmount   = basicAmount - discAmount + totalTax + otherCharges - chargeDisc;

  // ── open helpers ──
  const resetForm = () => {
    setPoDate(todayISO()); setPrRef(""); setSupplier(""); setDivision("COM");
    setCurrency("INR"); setContactPerson(""); setApprovalBy(""); setBillTo("");
    setLines([]); setCharges([]); setPaymentTerms(""); setModeOfTransport("");
    setDeliveryLocation(""); setPurchaseRef(""); setRemark("");
    setActiveTab("basic");
  };

  const openNew = () => { setEditing(null); resetForm(); setView("form"); };

  const openFromPR = (pr: PurchaseRequisition) => {
    setEditing(null);
    resetForm();
    setPrRef(pr.reqNo);
    // Convert PR lines → PO lines
    const newLines: POLine[] = pr.lines.map((l) => {
      const item = allItems.find((i) => i.code === l.itemCode);
      const gstPct = item ? parseInt(item.gstRate) : 18;
      const hsnCode = item?.hsnCode ?? "";
      const hsnEntry = hsnMasters.find((h) => h.hsnCode === hsnCode);
      const line: POLine = {
        lineId: Math.random().toString(36).slice(2),
        itemCode: l.itemCode, itemGroup: l.itemGroup, subGroup: l.subGroup, itemName: l.itemName,
        reqQtyInSU: l.poQtyInSU, stockUnit: l.stockUnit, reqQtyInPU: l.poQtyInPU,
        noOfPacksRolls: l.noOfPacksRolls, qtyPerPackRoll: l.qtyPerPackRoll,
        poQtyInPU: l.poQtyInPU, poQtyInSU: l.poQtyInSU,
        rate: 0, purchaseUnit: l.purchaseUnit,
        hsnName: hsnEntry?.description ?? "", hsnCode,
        expectedDelivery: "", tolerancePct: 0,
        basicAmt: 0, discPct: 0, afterDiscAmt: 0,
        gstPct, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, taxableAmt: 0, totalAmt: 0,
      };
      return line;
    });
    setLines(newLines);
    setActiveTab("items");
    setView("form");
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditing(po);
    setPoDate(po.poDate); setPrRef(po.prRef ?? "");
    setSupplier(po.supplier); setDivision(po.division);
    setCurrency(po.currency); setContactPerson(po.contactPerson);
    setApprovalBy(po.approvalBy); setBillTo(po.billTo);
    setLines(po.lines.map((l) => ({ ...l })));
    setCharges(po.charges.map((c) => ({ ...c })));
    setPaymentTerms(po.paymentTerms); setModeOfTransport(po.modeOfTransport);
    setDeliveryLocation(po.deliveryLocation); setPurchaseRef(po.purchaseRef);
    setRemark(po.remark);
    setActiveTab("basic");
    setView("form");
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this Purchase Order?")) setData((d) => d.filter((r) => r.id !== id));
  };

  // ── Line ops ──
  const addItemFromPicker = (item: Item) => {
    const gstPct = parseInt(item.gstRate) || 18;
    const hsnEntry = hsnMasters.find((h) => h.hsnCode === item.hsnCode);
    const line: POLine = {
      lineId: Math.random().toString(36).slice(2),
      itemCode: item.code, itemGroup: item.group, subGroup: item.subGroup, itemName: item.name,
      reqQtyInSU: 0, stockUnit: item.stockUom, reqQtyInPU: 0,
      noOfPacksRolls: 0, qtyPerPackRoll: 0, poQtyInPU: 0, poQtyInSU: 0,
      rate: parseFloat(item.purchaseRate) || 0, purchaseUnit: item.purchaseUnit,
      hsnName: hsnEntry?.description ?? "", hsnCode: item.hsnCode,
      expectedDelivery: "", tolerancePct: 0,
      basicAmt: 0, discPct: 0, afterDiscAmt: 0,
      gstPct, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, taxableAmt: 0, totalAmt: 0,
    };
    setLines((prev) => [...prev, recalcLine(line, sameState)]);
    setShowPicker(false); setPickerSearch(""); setPickerGroup("All");
  };

  const updateLineNum = (lineId: string, field: keyof POLine, value: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        const updated = { ...l, [field]: value };
        // Recalc packs → qty
        if (field === "noOfPacksRolls" || field === "qtyPerPackRoll") {
          const packs = field === "noOfPacksRolls" ? value : l.noOfPacksRolls;
          const qty = field === "qtyPerPackRoll" ? value : l.qtyPerPackRoll;
          updated.poQtyInPU = packs * qty;
          updated.poQtyInSU = packs * qty;
        }
        return recalcLine(updated, sameState);
      })
    );
  };

  const updateLineStr = (lineId: string, field: keyof POLine, value: string) => {
    setLines((prev) => prev.map((l) => l.lineId !== lineId ? l : { ...l, [field]: value }));
  };

  const removeLine = (lineId: string) => setLines((prev) => prev.filter((l) => l.lineId !== lineId));

  // ── Charge ops ──
  const addCharge = (name: string) => {
    setCharges((prev) => [...prev, { id: Math.random().toString(36).slice(2), name, amount: 0 }]);
    setShowChargeMenu(false);
  };
  const updateCharge = (id: string, amount: number) =>
    setCharges((prev) => prev.map((c) => c.id === id ? { ...c, amount } : c));
  const removeCharge = (id: string) =>
    setCharges((prev) => prev.filter((c) => c.id !== id));

  // ── Save ──
  const save = (status: PurchaseOrder["status"]) => {
    if (!supplier) { alert("Select a supplier."); return; }
    if (lines.length === 0) { alert("Add at least one item."); return; }
    const po: PurchaseOrder = {
      id: editing ? editing.id : `PO${String(data.length + 1).padStart(3, "0")}`,
      poNo: editing ? editing.poNo : nextPONo(data),
      poDate, prRef, supplier, supplierState: supplierInfo?.state ?? "",
      division, currency, contactPerson, approvalBy, billTo,
      lines, charges, paymentTerms, modeOfTransport,
      deliveryLocation, purchaseRef, remark, status,
    };
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? po : r));
    } else {
      setData((d) => [...d, po]);
    }
    setView("list");
  };

  const currentPONo = editing ? editing.poNo : nextPONo(data);
  const filteredData = (filterStatus === "All" ? data : data.filter((r) => r.status === filterStatus))
    .filter((r) => {
      if (!listSearch) return true;
      const s = listSearch.toLowerCase();
      return (
        r.poNo.toLowerCase().includes(s) ||
        r.supplier.toLowerCase().includes(s) ||
        (r.prRef ?? "").toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
      );
    });
  const statuses: ("All" | PurchaseOrder["status"])[] = ["All", "Draft", "Approved", "Sent", "Closed", "Cancelled"];

  // Pending PRs (submitted or approved, not yet ordered)
  const pendingPRs = allPRs.filter((p) => p.status === "Submitted" || p.status === "Approved");

  // ══════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════
  if (view === "list") {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Page title + New button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Purchase Orders</h2>
            <p className="text-sm text-gray-500">{filteredData.length} of {data.length} orders</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> New Purchase Order
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Status</span>
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by PO no, supplier, PR ref..."
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
            />
          </div>
        </div>

        {/* Purchase Orders table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PO No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PR Ref.</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Basic Amt (₹)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">GST (₹)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Amt (₹)</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-14 text-gray-400 text-sm">No purchase orders found</td>
                </tr>
              ) : (
                filteredData.map((po, i) => {
                  const poBasic = po.lines.reduce((s, l) => s + l.basicAmt, 0);
                  const poTax   = po.lines.reduce((s, l) => s + l.cgstAmt + l.sgstAmt + l.igstAmt, 0);
                  const poGross = poBasic + poTax + po.charges.reduce((s, c) => s + c.amount, 0);
                  return (
                    <tr key={po.id} className={`border-t border-gray-100 hover:bg-blue-50/20 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{po.poNo}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(po.poDate)}</td>
                      <td className="px-4 py-3 text-gray-800 text-xs font-medium">{po.supplier}</td>
                      <td className="px-4 py-3 text-gray-700 text-xs font-mono">{po.prRef || "—"}</td>
                      <td className="px-4 py-3 text-center font-medium text-gray-700">{po.lines.length}</td>
                      <td className="px-4 py-3 text-right text-gray-700 text-xs font-semibold">₹{fmtAmt(poBasic)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">₹{fmtAmt(poTax)}</td>
                      <td className="px-4 py-3 text-right text-blue-700 text-xs font-bold">₹{fmtAmt(poGross)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[po.status]}`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(po)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors">
                            <Pencil size={11} /> Edit
                          </button>
                          <button onClick={() => handleDelete(po.id)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors">
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pending Requisitions section */}
        {pendingPRs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
              <ClipboardList size={15} className="text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">
                Pending Requisitions — click to create Purchase Order
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Req. No.</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Req. Qty</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Remark</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingPRs.map((pr, i) => (
                  <tr
                    key={pr.id}
                    className={`border-t border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                  >
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-700">{pr.reqNo}</td>
                    <td className="px-4 py-2.5 text-gray-600">{fmtDate(pr.reqDate)}</td>
                    <td className="px-4 py-2.5 text-center font-medium text-gray-700">{pr.lines.length}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-700">
                      {pr.lines.reduce((s, l) => s + l.poQtyInPU, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 max-w-[180px] truncate">{pr.remark || "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PR_STATUS_STYLE[pr.status]}`}>
                        {pr.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => openFromPR(pr)}
                        className="flex items-center gap-1 mx-auto px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus size={11} /> Create PO
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // FORM VIEW
  // ══════════════════════════════════════════════════════════
  const tabs: { key: "basic" | "items" | "terms" | "summary"; label: string }[] = [
    { key: "basic", label: "Basic" },
    { key: "items", label: "Items" },
    { key: "terms", label: "Terms" },
    { key: "summary", label: "Summary" },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-10">
      {/* Header Ribbon */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
          <h2 className="text-xl font-bold text-gray-800">Purchase Order</h2>
          <div className="flex items-center gap-2 mt-1">
            {editing && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[editing.status]}`}>
                {editing.status}
              </span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
              {currentPONo}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <List size={16} /> List ({data.length})
          </button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
            <Plus size={16} /> New
          </button>
          <button onClick={() => save("Draft")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Save size={16} /> Draft
          </button>
          <button onClick={() => save("Approved")} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Check size={16} /> {editing ? "Save" : "Approve & Save"}
          </button>
          {editing && (
            <button onClick={() => handleDelete(editing.id)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-400 transition-colors">
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Tab Header */}
        <div className="px-6 pt-5 border-b border-gray-200 bg-gray-50/30">
          <div className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? "text-blue-600 border-blue-600"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-8">

          {/* ─── BASIC TAB ─── */}
          {activeTab === "basic" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <SectionTitle title="Order Details" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Field label="PO No.">
                    <input readOnly value={currentPONo} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-blue-50 text-blue-700 font-mono font-semibold focus:outline-none" />
                  </Field>
                  <Field label="PO Date">
                    <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Division">
                    <select value={division} onChange={(e) => setDivision(e.target.value)} className={selectCls}>
                      {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Currency">
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectCls}>
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              <div>
                <SectionTitle title="Supplier & Contact" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <Field label="Supplier Name" required>
                      <select
                        value={supplier}
                        onChange={(e) => {
                          setSupplier(e.target.value);
                          const s = SUPPLIERS.find((x) => x.name === e.target.value);
                          setContactPerson(s?.contact ?? "");
                        }}
                        className={selectCls}
                      >
                        <option value="">Select Supplier…</option>
                        {SUPPLIERS.map((s) => (
                          <option key={s.name} value={s.name}>{s.name} — {s.state}</option>
                        ))}
                      </select>
                      {supplierInfo && (
                        <p className="text-xs text-gray-500 mt-1">
                          State: {supplierInfo.state} —{" "}
                          {sameState
                            ? <span className="text-green-600 font-semibold">CGST + SGST applicable</span>
                            : <span className="text-orange-600 font-semibold">IGST applicable</span>}
                        </p>
                      )}
                    </Field>
                  </div>
                  <Field label="Contact Person">
                    <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Contact name" className={inputCls} />
                  </Field>
                  <Field label="Bill To">
                    <input value={billTo} onChange={(e) => setBillTo(e.target.value)} placeholder="Billing address / location" className={inputCls} />
                  </Field>
                  <Field label="PR Reference">
                    <input value={prRef} onChange={(e) => setPrRef(e.target.value)} placeholder="Requisition reference" className={`${inputCls} ${prRef ? "bg-blue-50 text-blue-700 font-mono" : ""}`} />
                  </Field>
                  <Field label="Approval By">
                    <select value={approvalBy} onChange={(e) => setApprovalBy(e.target.value)} className={selectCls}>
                      <option value="">Select…</option>
                      {APPROVAL_BY.map((a) => <option key={a}>{a}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button onClick={() => setActiveTab("items")} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  Items →
                </button>
              </div>
            </div>
          )}

          {/* ─── ITEMS TAB ─── */}
          {activeTab === "items" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <SectionTitle title="Purchase Order Lines" />
                <button
                  onClick={() => { setShowPicker(true); setPickerSearch(""); setPickerGroup("All"); }}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus size={13} /> Add Item
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs border-collapse" style={{ minWidth: 1800 }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {[
                        { label: "Group", right: false },
                        { label: "Item Code", right: false },
                        { label: "Item Name", right: false },
                        { label: "Req.Qty\n(S.U.)", right: true },
                        { label: "Stock\nUnit", right: false },
                        { label: "Req.Qty\n(P.U.)", right: true },
                        { label: "No. Of\nPacks/Rolls", right: true },
                        { label: "Qty/\nPack/Roll", right: true },
                        { label: "PO Qty\n(P.U.)", right: true },
                        { label: "PO Qty\n(S.U.)", right: true },
                        { label: "Rate", right: true },
                        { label: "Purch.\nUnit", right: false },
                        { label: "HSN Code", right: false },
                        { label: "Exp.\nDelivery", right: false },
                        { label: "Tol.\n%", right: true },
                        { label: "Basic\nAmt", right: true },
                        { label: "Disc\n%", right: true },
                        { label: "After Disc\nAmt", right: true },
                        { label: "GST\n%", right: true },
                        { label: "CGST\nAmt", right: true },
                        { label: "SGST\nAmt", right: true },
                        { label: "IGST\nAmt", right: true },
                        { label: "Taxable\nAmt", right: true },
                        { label: "Total\nAmt", right: true },
                        { label: "", right: false },
                      ].map((col, i) => (
                        <th
                          key={i}
                          className={`px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0 whitespace-pre-line leading-tight ${col.right ? "text-right" : "text-left"}`}
                          style={{ fontSize: 10 }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={25} className="text-center py-16 text-gray-400 text-sm">
                          No items — click &ldquo;Add Item&rdquo; to begin
                        </td>
                      </tr>
                    ) : (
                      lines.map((line, idx) => (
                        <tr key={line.lineId} className={`border-b border-gray-100 hover:bg-blue-50/20 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                          <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{line.itemGroup}</td>
                          <td className="px-2 py-1.5 font-mono text-blue-700 whitespace-nowrap">{line.itemCode}</td>
                          <td className="px-2 py-1.5 text-gray-800" style={{ maxWidth: 160 }}>{line.itemName}</td>
                          <td className="px-2 py-1.5 text-right text-gray-700">{line.reqQtyInSU || "—"}</td>
                          <td className="px-2 py-1.5 text-gray-700">{line.stockUnit}</td>
                          <td className="px-2 py-1.5 text-right text-gray-700">{line.reqQtyInPU || "—"}</td>

                          {/* Editable: Packs */}
                          <td className="px-1 py-1">
                            <input type="number" min={0} value={line.noOfPacksRolls || ""} placeholder="0"
                              onChange={(e) => updateLineNum(line.lineId, "noOfPacksRolls", Number(e.target.value))}
                              className={`w-16 ${tableInputCls}`} />
                          </td>

                          {/* Editable: Qty/pack */}
                          <td className="px-1 py-1">
                            <input type="number" min={0} value={line.qtyPerPackRoll || ""} placeholder="0"
                              onChange={(e) => updateLineNum(line.lineId, "qtyPerPackRoll", Number(e.target.value))}
                              className={`w-20 ${tableInputCls}`} />
                          </td>

                          <td className="px-2 py-1.5 text-right font-semibold text-blue-700">{line.poQtyInPU.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right text-gray-700">{line.poQtyInSU.toLocaleString()}</td>

                          {/* Editable: Rate */}
                          <td className="px-1 py-1">
                            <input type="number" min={0} step={0.01} value={line.rate || ""} placeholder="0.00"
                              onChange={(e) => updateLineNum(line.lineId, "rate", Number(e.target.value))}
                              className={`w-20 ${tableInputCls}`} />
                          </td>
                          <td className="px-2 py-1.5 text-gray-700">{line.purchaseUnit}</td>

                          {/* HSN */}
                          <td className="px-1 py-1">
                            <select value={line.hsnCode}
                              onChange={(e) => {
                                const h = hsnMasters.find(x => x.hsnCode === e.target.value);
                                updateLineStr(line.lineId, "hsnCode", e.target.value);
                                updateLineStr(line.lineId, "hsnName", h?.description ?? "");
                                if (h) updateLineNum(line.lineId, "gstPct", h.gstRate);
                              }}
                              className="w-20 px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                              <option value="">—</option>
                              {hsnMasters.map((h) => <option key={h.id} value={h.hsnCode}>{h.hsnCode}</option>)}
                            </select>
                          </td>

                          {/* Expected delivery date */}
                          <td className="px-1 py-1">
                            <input type="date" value={line.expectedDelivery}
                              onChange={(e) => updateLineStr(line.lineId, "expectedDelivery", e.target.value)}
                              className="w-32 px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                          </td>

                          {/* Editable: Tolerance % */}
                          <td className="px-1 py-1">
                            <input type="number" min={0} max={100} value={line.tolerancePct || ""} placeholder="0"
                              onChange={(e) => updateLineNum(line.lineId, "tolerancePct", Number(e.target.value))}
                              className={`w-12 ${tableInputCls}`} />
                          </td>

                          <td className="px-2 py-1.5 text-right font-semibold text-gray-700">{fmtAmt(line.basicAmt)}</td>

                          {/* Editable: Disc % */}
                          <td className="px-1 py-1">
                            <input type="number" min={0} max={100} step={0.01} value={line.discPct || ""} placeholder="0"
                              onChange={(e) => updateLineNum(line.lineId, "discPct", Number(e.target.value))}
                              className={`w-12 ${tableInputCls}`} />
                          </td>

                          <td className="px-2 py-1.5 text-right text-gray-700">{fmtAmt(line.afterDiscAmt)}</td>
                          <td className="px-2 py-1.5 text-right text-gray-700">{line.gstPct}%</td>
                          <td className="px-2 py-1.5 text-right text-blue-700">{fmtAmt(line.cgstAmt)}</td>
                          <td className="px-2 py-1.5 text-right text-blue-700">{fmtAmt(line.sgstAmt)}</td>
                          <td className="px-2 py-1.5 text-right text-orange-700">{fmtAmt(line.igstAmt)}</td>
                          <td className="px-2 py-1.5 text-right text-gray-700">{fmtAmt(line.taxableAmt)}</td>
                          <td className="px-2 py-1.5 text-right font-bold text-blue-800">{fmtAmt(line.totalAmt)}</td>
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => removeLine(line.lineId)} className="text-gray-300 hover:text-red-500 transition-colors">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {lines.length > 0 && (
                    <tfoot>
                      <tr className="bg-blue-50 border-t-2 border-blue-200 text-xs font-bold">
                        <td colSpan={15} className="px-3 py-2 text-right text-blue-800">Totals</td>
                        <td className="px-2 py-2 text-right text-blue-800">{fmtAmt(basicAmount)}</td>
                        <td />
                        <td className="px-2 py-2 text-right text-blue-800">{fmtAmt(lines.reduce((s, l) => s + l.afterDiscAmt, 0))}</td>
                        <td />
                        <td className="px-2 py-2 text-right text-blue-700">{fmtAmt(lines.reduce((s, l) => s + l.cgstAmt, 0))}</td>
                        <td className="px-2 py-2 text-right text-blue-700">{fmtAmt(lines.reduce((s, l) => s + l.sgstAmt, 0))}</td>
                        <td className="px-2 py-2 text-right text-orange-700">{fmtAmt(lines.reduce((s, l) => s + l.igstAmt, 0))}</td>
                        <td className="px-2 py-2 text-right text-blue-800">{fmtAmt(lines.reduce((s, l) => s + l.taxableAmt, 0))}</td>
                        <td className="px-2 py-2 text-right text-blue-900">{fmtAmt(lines.reduce((s, l) => s + l.totalAmt, 0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button onClick={() => setActiveTab("basic")} className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  ← Basic
                </button>
                <button onClick={() => setActiveTab("terms")} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  Terms →
                </button>
              </div>
            </div>
          )}

          {/* ─── TERMS TAB ─── */}
          {activeTab === "terms" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <SectionTitle title="Payment & Delivery" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Terms of Payment">
                    <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={selectCls}>
                      <option value="">Select payment term…</option>
                      {PAYMENT_TERMS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Mode of Transport">
                    <select value={modeOfTransport} onChange={(e) => setModeOfTransport(e.target.value)} className={selectCls}>
                      <option value="">Select…</option>
                      {TRANSPORT_MODES.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Delivery Location">
                    <input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="e.g. Main Store, Gate 2…" className={inputCls} />
                  </Field>
                  <Field label="Purchase Ref">
                    <input value={purchaseRef} onChange={(e) => setPurchaseRef(e.target.value)}
                      placeholder="Internal purchase reference" className={inputCls} />
                  </Field>
                </div>
              </div>

              <div>
                <SectionTitle title="Remarks" />
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3}
                  placeholder="Any additional notes or instructions…"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle title="Additional Charges" />
                  <div className="relative">
                    <button
                      onClick={() => setShowChargeMenu((p) => !p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Plus size={12} /> Add Charge
                    </button>
                    {showChargeMenu && (
                      <div className="absolute right-0 top-9 z-30 bg-white border border-gray-200 rounded-lg shadow-lg w-52 py-1">
                        {CHARGE_TYPES.map((ct) => (
                          <button key={ct} onClick={() => addCharge(ct)}
                            className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                            {ct}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {charges.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No additional charges added</p>
                ) : (
                  <div className="space-y-2">
                    {charges.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-sm text-gray-700 flex-1">{c.name}</span>
                        <input type="number" value={c.amount || ""} placeholder="0.00"
                          onChange={(e) => updateCharge(c.id, Number(e.target.value))}
                          className="w-32 text-right px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        <button onClick={() => removeCharge(c.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button onClick={() => setActiveTab("items")} className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  ← Items
                </button>
                <button onClick={() => setActiveTab("summary")} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  Summary →
                </button>
              </div>
            </div>
          )}

          {/* ─── SUMMARY TAB ─── */}
          {activeTab === "summary" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

              {/* Amount Breakdown */}
              <div>
                <SectionTitle title="Amount Summary" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 space-y-3">
                    {[
                      { label: "Basic Amount",      value: basicAmount,           cls: "text-gray-800" },
                      { label: "Discount Amount",   value: discAmount + chargeDisc, cls: "text-red-600" },
                      { label: "Total GST",         value: totalTax,              cls: "text-blue-700" },
                      { label: "Other Charges",     value: otherCharges,          cls: "text-gray-700" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                        <span className="text-sm text-gray-500">{row.label}</span>
                        <span className={`text-sm font-semibold font-mono ${row.cls}`}>₹{fmtAmt(row.value)}</span>
                      </div>
                    ))}
                    <div className="pt-3 flex items-center justify-between border-t-2 border-blue-200">
                      <span className="text-base font-bold text-blue-800">Gross Amount</span>
                      <span className="text-base font-bold text-blue-800 font-mono">₹{fmtAmt(grossAmount)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 space-y-2">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Order Info</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <span className="text-gray-500">PO Number</span>
                        <span className="font-mono font-semibold text-blue-700">{currentPONo}</span>
                        <span className="text-gray-500">PO Date</span>
                        <span className="text-gray-700">{fmtDate(poDate)}</span>
                        <span className="text-gray-500">Supplier</span>
                        <span className="text-gray-800 font-medium">{supplier || "—"}</span>
                        <span className="text-gray-500">Division</span>
                        <span className="text-gray-700">{division}</span>
                        <span className="text-gray-500">Currency</span>
                        <span className="text-gray-700">{currency}</span>
                        <span className="text-gray-500">Approval By</span>
                        <span className="text-gray-700">{approvalBy || "—"}</span>
                        <span className="text-gray-500">Line Items</span>
                        <span className="text-gray-700 font-semibold">{lines.length}</span>
                        <span className="text-gray-500">GST Type</span>
                        <span className={sameState ? "text-green-700 font-semibold" : "text-orange-600 font-semibold"}>
                          {supplierInfo ? (sameState ? "CGST + SGST" : "IGST") : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending PRs in Summary */}
              {pendingPRs.length > 0 && (
                <div>
                  <SectionTitle title="Pending Requisitions" />
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Req. No.</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Remark</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingPRs.map((pr, i) => (
                          <tr key={pr.id} className={`border-t border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                            <td className="px-4 py-2.5 font-mono font-semibold text-blue-700">{pr.reqNo}</td>
                            <td className="px-4 py-2.5 text-gray-600">{fmtDate(pr.reqDate)}</td>
                            <td className="px-4 py-2.5 text-center font-medium text-gray-700">{pr.lines.length}</td>
                            <td className="px-4 py-2.5 text-gray-700 max-w-[200px] truncate">{pr.remark || "—"}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PR_STATUS_STYLE[pr.status]}`}>
                                {pr.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => openFromPR(pr)}
                                className="flex items-center gap-1 mx-auto px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                <Plus size={11} /> Load PR
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button onClick={() => setActiveTab("terms")} className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  ← Terms
                </button>
                <div className="flex items-center gap-3">
                  <button onClick={() => save("Draft")} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Save size={16} /> Save as Draft
                  </button>
                  <button onClick={() => save("Approved")} className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                    <Check size={16} /> Approve & Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ITEM PICKER MODAL
         ══════════════════════════════════════════════════════ */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[720px] max-h-[82vh] flex flex-col overflow-hidden">
            <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm tracking-wide">Select Raw Material Item</h3>
              <button onClick={() => setShowPicker(false)} className="text-blue-200 hover:text-white"><X size={18} /></button>
            </div>
            <div className="px-5 py-3 border-b border-gray-100 space-y-2.5 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input autoFocus value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search by item name or code…"
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {rmGroups.map((g) => (
                  <button key={g} onClick={() => setPickerGroup(g)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      pickerGroup === g
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                    }`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Code</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Item Name</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Group</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-500">Purchase Rate</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-500">GST</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-500">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {pickerItems.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">No items found</td></tr>
                  ) : (
                    pickerItems.map((item) => (
                      <tr key={item.id} onClick={() => addItemFromPicker(item)}
                        className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 font-mono text-blue-700 font-semibold">{item.code}</td>
                        <td className="px-4 py-2.5 text-gray-800 font-medium">{item.name}</td>
                        <td className="px-4 py-2.5 text-gray-700">{item.group}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700 font-semibold">₹{item.purchaseRate}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{item.gstRate}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{item.stockUom}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2.5 border-t border-gray-100 text-right shrink-0">
              <p className="text-xs text-gray-400">Click any row to add item to Purchase Order</p>
            </div>
          </div>
        </div>
      )}

      {/* Close charge menu on outside click */}
      {showChargeMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowChargeMenu(false)} />
      )}
    </div>
  );
}
