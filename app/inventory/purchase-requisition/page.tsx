"use client";
import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, X, Search, FileText, Check, Save, List } from "lucide-react";
import {
  items as allItems, Item,
  purchaseRequisitions as initData, PurchaseRequisition, PRLine,
} from "@/data/dummyData";

// ─── Helpers ────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split("T")[0];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const nextReqNo = (list: PurchaseRequisition[]) => {
  const yr = new Date().getFullYear();
  const n = list.length + 1;
  return `PREQ${String(n).padStart(5, "0")}_${String(yr - 2000).padStart(2, "0")}_${String(yr - 1999).padStart(2, "0")}`;
};

const newLine = (): PRLine => ({
  lineId: Math.random().toString(36).slice(2),
  itemCode: "", itemGroup: "", subGroup: "", itemName: "",
  indentQty: 0, totalBooked: 0, allocatedStock: 0,
  currentStock: 0, stockUnit: "Kg", currentStockInPU: 0,
  purchaseUnit: "Kg", orderUnit: "Kg",
  noOfPacksRolls: 0, qtyPerPackRoll: 0,
  poQtyInPU: 0, poQtyInSU: 0,
});

const STATUS_STYLE: Record<PurchaseRequisition["status"], string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Submitted: "bg-blue-100 text-blue-700",
  Approved:  "bg-green-100 text-green-700",
  Rejected:  "bg-red-100 text-red-700",
  Ordered:   "bg-purple-100 text-purple-700",
};

// ─── Main Component ───────────────────────────────────────────
export default function PurchaseRequisitionPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<PurchaseRequisition[]>(initData);
  const [editing, setEditing] = useState<PurchaseRequisition | null>(null);
  const [lines, setLines] = useState<PRLine[]>([]);
  const [reqDate, setReqDate] = useState(todayISO());
  const [remark, setRemark] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | PurchaseRequisition["status"]>("All");
  const [listSearch, setListSearch] = useState("");

  // Item picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerGroup, setPickerGroup] = useState("All");

  // Only RM active items
  const rmItems = useMemo(
    () => allItems.filter((i) => i.category === "Raw Material (RM)" && i.active),
    []
  );
  const rmGroups = useMemo(
    () => ["All", ...Array.from(new Set(rmItems.map((i) => i.group)))],
    [rmItems]
  );
  const pickerItems = useMemo(() => {
    const s = pickerSearch.toLowerCase();
    return rmItems.filter((i) => {
      if (pickerGroup !== "All" && i.group !== pickerGroup) return false;
      return !s || i.name.toLowerCase().includes(s) || i.code.toLowerCase().includes(s);
    });
  }, [rmItems, pickerGroup, pickerSearch]);

  // ── Navigation helpers ──
  const openNew = () => {
    setEditing(null);
    setLines([]);
    setReqDate(todayISO());
    setRemark("");
    setView("form");
  };

  const openEdit = (pr: PurchaseRequisition) => {
    setEditing(pr);
    setLines(pr.lines.map((l) => ({ ...l })));
    setReqDate(pr.reqDate);
    setRemark(pr.remark);
    setView("form");
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this requisition?")) setData((d) => d.filter((r) => r.id !== id));
  };

  // ── Line operations ──
  const addItemFromPicker = (item: Item) => {
    const line: PRLine = {
      ...newLine(),
      itemCode: item.code,
      itemGroup: item.group,
      subGroup: item.subGroup,
      itemName: item.name,
      stockUnit: item.stockUom,
      purchaseUnit: item.purchaseUnit,
      orderUnit: item.purchaseUnit,
      allocatedStock: Number(item.minStockQty) || 0,
      currentStock: Number(item.reOrderQty) * 2 || 0,
      currentStockInPU: Number(item.reOrderQty) * 2 || 0,
    };
    setLines((prev) => [...prev, line]);
    setShowPicker(false);
    setPickerSearch("");
    setPickerGroup("All");
  };

  const updateLine = (lineId: string, field: "noOfPacksRolls" | "qtyPerPackRoll", value: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        const packs = field === "noOfPacksRolls" ? value : l.noOfPacksRolls;
        const qty = field === "qtyPerPackRoll" ? value : l.qtyPerPackRoll;
        return { ...l, [field]: value, poQtyInPU: packs * qty, poQtyInSU: packs * qty };
      })
    );
  };

  const removeLine = (lineId: string) =>
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));

  const save = (status: PurchaseRequisition["status"]) => {
    if (lines.length === 0) { alert("Add at least one item."); return; }
    if (editing) {
      setData((d) =>
        d.map((r) => r.id === editing.id ? { ...r, lines, reqDate, remark, status } : r)
      );
    } else {
      setData((d) => [
        ...d,
        {
          id: `PR${String(d.length + 1).padStart(3, "0")}`,
          reqNo: nextReqNo(d),
          reqDate, lines, remark, status,
        },
      ]);
    }
    setView("list");
  };

  const currentReqNo = editing ? editing.reqNo : nextReqNo(data);
  const totalPOQty = lines.reduce((s, l) => s + l.poQtyInPU, 0);
  const filteredData = (filterStatus === "All" ? data : data.filter((r) => r.status === filterStatus))
    .filter((r) => {
      if (!listSearch) return true;
      const s = listSearch.toLowerCase();
      return (
        r.reqNo.toLowerCase().includes(s) ||
        r.remark.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
      );
    });
  const statuses: ("All" | PurchaseRequisition["status"])[] = [
    "All", "Draft", "Submitted", "Approved", "Rejected", "Ordered",
  ];

  // ══════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════
  if (view === "list") {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Page title */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Purchase Requisition</h2>
            <p className="text-sm text-gray-500">
              {filteredData.length} of {data.length} requisitions
            </p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> New Requisition
          </button>
        </div>

        {/* Status filter bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">
              Status
            </span>
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
              placeholder="Search by requisition no, remark..."
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
            />
          </div>
        </div>

        {/* Requisitions table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Req. No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total PO Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Remark</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400 text-sm">
                    No requisitions found
                  </td>
                </tr>
              ) : (
                filteredData.map((pr, i) => (
                  <tr
                    key={pr.id}
                    className={`border-t border-gray-100 hover:bg-blue-50/30 transition-colors ${
                      i % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">
                      {pr.reqNo}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(pr.reqDate)}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700">
                      {pr.lines.length}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">
                      {pr.lines
                        .reduce((s, l) => s + l.poQtyInPU, 0)
                        .toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                      {pr.remark || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[pr.status]}`}
                      >
                        {pr.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(pr)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors"
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(pr.id)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // FORM VIEW
  // ══════════════════════════════════════════════════════════
  return (
    <div className="max-w-5xl mx-auto pb-10">

      {/* ── Header Ribbon ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <h2 className="text-lg font-bold text-gray-800">Purchase Requisition</h2>
            {editing && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[editing.status]}`}>
                {editing.status}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold text-blue-600 bg-blue-100 border border-blue-200">
              {currentReqNo}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setView("list")} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <List size={15} /> <span className="hidden sm:inline">List ({data.length})</span><span className="sm:hidden">List</span>
          </button>
          <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
            <Plus size={15} /> New
          </button>
          <button onClick={() => save("Draft")} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Save size={15} /> Draft
          </button>
          <button onClick={() => save("Submitted")} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Check size={15} /> Submit
          </button>
          {editing && (
            <button onClick={() => { handleDelete(editing.id); }} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Content Card ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Info bar: Req No + Date + Add Item */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/30 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
              Req. No.
            </label>
            <input
              readOnly
              value={currentReqNo}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono font-semibold text-blue-700 bg-blue-50 focus:outline-none w-52"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
              Requisition Date
            </label>
            <input
              type="date"
              value={reqDate}
              onChange={(e) => setReqDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="ml-auto">
            <button
              onClick={() => { setShowPicker(true); setPickerSearch(""); setPickerGroup("All"); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>
        </div>

        {/* Items — Desktop Table (lg+) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-xs border-collapse" style={{ minWidth: 1300 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {[
                  { label: "Item\nCode",              right: false },
                  { label: "Item Group",               right: false },
                  { label: "Sub Group",                right: false },
                  { label: "Item Name",                right: false },
                  { label: "Indent\nQty",              right: true  },
                  { label: "Total\nBooked",            right: true  },
                  { label: "Allocated\nStock",         right: true  },
                  { label: "Current\nStock",           right: true  },
                  { label: "Stock\nUnit",              right: false },
                  { label: "Current Stock\n(In P.U.)", right: true  },
                  { label: "Purchase\nUnit",           right: false },
                  { label: "Order\nUnit",              right: false },
                  { label: "No. Of\nPacks[Rolls]",     right: true  },
                  { label: "Qty /\n(Pack[Roll])",      right: true  },
                  { label: "P.O.Qty\n(In P.U.)",       right: true  },
                  { label: "P.O.Qty\n(In S.U.)",       right: true  },
                  { label: "",                          right: false },
                ].map((col, i) => (
                  <th key={i} className={`px-3 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-pre-line leading-tight ${col.right ? "text-right" : "text-left"}`} style={{ fontSize: 11 }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={17} className="text-center py-24 text-gray-400 text-sm">No data — click &ldquo;+ Add Item&rdquo; to begin</td></tr>
              ) : (
                lines.map((line, idx) => (
                  <tr key={line.lineId} className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                    <td className="px-3 py-2 font-mono text-blue-700 whitespace-nowrap">{line.itemCode}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{line.itemGroup}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{line.subGroup}</td>
                    <td className="px-3 py-2 text-gray-800" style={{ maxWidth: 200 }}>{line.itemName}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{line.indentQty || "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{line.totalBooked || "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{line.allocatedStock.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{line.currentStock.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500">{line.stockUnit}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{line.currentStockInPU.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500">{line.purchaseUnit}</td>
                    <td className="px-3 py-2 text-gray-500">{line.orderUnit}</td>
                    <td className="px-2 py-1">
                      <input type="number" min={0} value={line.noOfPacksRolls || ""} onChange={(e) => updateLine(line.lineId, "noOfPacksRolls", Number(e.target.value))} className="w-20 text-right px-2 py-1 border border-gray-300 rounded text-xs font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" placeholder="0" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min={0} value={line.qtyPerPackRoll || ""} onChange={(e) => updateLine(line.lineId, "qtyPerPackRoll", Number(e.target.value))} className="w-24 text-right px-2 py-1 border border-gray-300 rounded text-xs font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" placeholder="0" />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-blue-700">{line.poQtyInPU.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-700">{line.poQtyInSU.toLocaleString()}</td>
                    <td className="px-2 py-1 text-center">
                      <button onClick={() => removeLine(line.lineId)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td colSpan={14} className="px-3 py-2 text-right text-xs font-bold text-blue-800">Total P.O. Qty (In P.U.)</td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-blue-800">{totalPOQty.toLocaleString()}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Items — Mobile / Tablet Card View (below lg) */}
        <div className="lg:hidden">
          {lines.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              No data — tap &ldquo;+ Add Item&rdquo; to begin
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {lines.map((line) => (
                <div key={line.lineId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Card Header */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-bold text-blue-700">{line.itemCode}</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{line.itemName}</p>
                      <p className="text-xs text-gray-500">{line.itemGroup} {line.subGroup ? `· ${line.subGroup}` : ""}</p>
                    </div>
                    <button onClick={() => removeLine(line.lineId)} className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <X size={16} />
                    </button>
                  </div>

                  {/* Stock Info */}
                  <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                    {[
                      { label: "Current Stock", val: `${line.currentStock} ${line.stockUnit}` },
                      { label: "Allocated", val: line.allocatedStock.toLocaleString() },
                      { label: "Stock (P.U.)", val: line.currentStockInPU.toLocaleString() },
                    ].map(({ label, val }) => (
                      <div key={label} className="px-3 py-2.5 text-center">
                        <p className="text-xs text-gray-400 font-medium">{label}</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Units Row */}
                  <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                    {[
                      { label: "Stock Unit", val: line.stockUnit },
                      { label: "Purchase Unit", val: line.purchaseUnit },
                      { label: "Order Unit", val: line.orderUnit },
                    ].map(({ label, val }) => (
                      <div key={label} className="px-3 py-2 text-center">
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-sm font-medium text-gray-700">{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Editable Inputs */}
                  <div className="grid grid-cols-2 gap-3 px-4 py-3 border-b border-gray-100">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">No. of Packs/Rolls</p>
                      <input
                        type="number" min={0}
                        value={line.noOfPacksRolls || ""}
                        onChange={(e) => updateLine(line.lineId, "noOfPacksRolls", Number(e.target.value))}
                        className="w-full text-right px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Qty / Pack/Roll</p>
                      <input
                        type="number" min={0}
                        value={line.qtyPerPackRoll || ""}
                        onChange={(e) => updateLine(line.lineId, "qtyPerPackRoll", Number(e.target.value))}
                        className="w-full text-right px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* PO Qty Result */}
                  <div className="grid grid-cols-2 divide-x divide-gray-100 bg-blue-50">
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-xs text-blue-600 font-medium">P.O. Qty (P.U.)</p>
                      <p className="text-base font-bold text-blue-700">{line.poQtyInPU.toLocaleString()}</p>
                    </div>
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-xs text-gray-600 font-medium">P.O. Qty (S.U.)</p>
                      <p className="text-base font-bold text-gray-800">{line.poQtyInSU.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Mobile Total */}
              <div className="bg-blue-600 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-100">Total P.O. Qty (P.U.)</span>
                <span className="text-xl font-bold text-white">{totalPOQty.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Remark */}
        <div className="px-6 py-4 border-t border-gray-100">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Remark
          </label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={2}
            placeholder="Optional notes..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ITEM PICKER MODAL
         ══════════════════════════════════════════════════════ */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[720px] max-h-[82vh] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="bg-blue-600 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm tracking-wide">Select Raw Material Item</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="text-blue-200 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search + Group filter */}
            <div className="px-5 py-3 border-b border-gray-100 space-y-2.5 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search by item name or code..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {rmGroups.map((g) => (
                  <button
                    key={g}
                    onClick={() => setPickerGroup(g)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      pickerGroup === g
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Group</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Sub Group</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider">Purch. Unit</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider">Stock UOM</th>
                  </tr>
                </thead>
                <tbody>
                  {pickerItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        No items found
                      </td>
                    </tr>
                  ) : (
                    pickerItems.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => addItemFromPicker(item)}
                        className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-blue-700 font-semibold">
                          {item.code}
                        </td>
                        <td className="px-4 py-2.5 text-gray-800 font-medium">{item.name}</td>
                        <td className="px-4 py-2.5 text-gray-500">{item.group}</td>
                        <td className="px-4 py-2.5 text-gray-500">{item.subGroup}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {item.purchaseUnit}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {item.stockUom}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal footer */}
            <div className="px-5 py-2.5 border-t border-gray-100 text-right shrink-0">
              <p className="text-xs text-gray-400">
                Click any row to add item to requisition
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
