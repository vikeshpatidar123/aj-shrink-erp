"use client";
import { useState, useMemo } from "react";
import { Wrench, Plus, Pencil, Trash2, X } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import {
  toolPOs as initData, ToolPO, ToolPOLine,
  tools, Tool, ToolType,
} from "@/data/dummyData";

// ─── Helpers ─────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate  = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtAmt   = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nextPONo = (list: ToolPO[]) => `TPO-${String(list.length + 1).padStart(3, "0")}`;

const STATUS_CLS: Record<ToolPO["status"], string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Confirmed: "bg-blue-100 text-blue-700",
  Received:  "bg-green-100 text-green-700",
};

const newLine = (): ToolPOLine => ({
  id: Math.random().toString(36).slice(2),
  toolType: "Cylinder", toolId: "", toolCode: "", toolName: "", qty: 1, rate: 0, amount: 0,
});

const tblCls = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

// ─── Columns ─────────────────────────────────────────────────
const columns: Column<ToolPO>[] = [
  { key: "poNo",         header: "PO No",          render: r => <span className="font-mono text-xs font-semibold text-purple-700">{r.poNo}</span> },
  { key: "date",         header: "Date",            render: r => fmtDate(r.date) },
  { key: "supplier",     header: "Supplier",        render: r => r.supplier },
  { key: "prRef",        header: "PR Ref",          render: r => <span className="font-mono text-xs">{r.prRef || "—"}</span> },
  { key: "expectedDate", header: "Expected Date",   render: r => fmtDate(r.expectedDate) },
  { key: "lines",        header: "Total Amt",       render: r => {
    const total = r.lines.reduce((s, l) => s + l.amount, 0);
    return <span className="font-semibold text-gray-800">₹ {fmtAmt(total)}</span>;
  }},
  { key: "status",       header: "Status",          render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[r.status]}`}>{r.status}</span> },
];

// ─── Main Component ───────────────────────────────────────────
export default function ToolPOPage() {
  const [data, setData]       = useState<ToolPO[]>(initData);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<ToolPO | null>(null);

  const [poNo, setPoNo]               = useState("");
  const [date, setDate]               = useState(todayISO());
  const [supplier, setSupplier]       = useState("");
  const [prRef, setPrRef]             = useState("");
  const [expectedDate, setExpected]   = useState("");
  const [remarks, setRemarks]         = useState("");
  const [lines, setLines]             = useState<ToolPOLine[]>([newLine()]);

  const totalAmt = useMemo(() => lines.reduce((s, l) => s + l.amount, 0), [lines]);

  const openNew = () => {
    setEditing(null);
    setPoNo(nextPONo(data)); setDate(todayISO()); setSupplier(""); setPrRef(""); setExpected(""); setRemarks("");
    setLines([newLine()]);
    setModal(true);
  };

  const openEdit = (po: ToolPO) => {
    setEditing(po);
    setPoNo(po.poNo); setDate(po.date); setSupplier(po.supplier); setPrRef(po.prRef);
    setExpected(po.expectedDate); setRemarks(po.remarks);
    setLines(po.lines.map(l => ({ ...l })));
    setModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this Purchase Order?")) setData(d => d.filter(r => r.id !== id));
  };

  const updateLine = (idx: number, field: keyof ToolPOLine, value: string | number) => {
    setLines(ls => ls.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      if (field === "toolId") {
        const tool = tools.find(t => t.id === value);
        if (tool) {
          updated.toolCode = tool.code;
          updated.toolName = tool.name;
          updated.toolType = tool.toolType;
        }
      }
      if (field === "qty" || field === "rate") {
        updated.amount = Number(updated.qty) * Number(updated.rate);
      }
      return updated;
    }));
  };

  const handleSave = () => {
    if (!supplier || !expectedDate) { alert("Please fill all required fields."); return; }
    const record: ToolPO = {
      id: editing?.id ?? Math.random().toString(36).slice(2),
      poNo, date, supplier, prRef, expectedDate,
      lines, status: editing?.status ?? "Draft", remarks,
    };
    setData(d => editing ? d.map(r => r.id === editing.id ? record : r) : [...d, record]);
    setModal(false);
  };

  const columnsWithActions: Column<ToolPO>[] = [
    ...columns,
    {
      key: "id", header: "Actions",
      render: r => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"><Pencil size={14} /></button>
          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shadow">
            <Wrench size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Tool Purchase Order</h1>
            <p className="text-xs text-gray-500">{data.length} purchase orders</p>
          </div>
        </div>
        <Button onClick={openNew} icon={<Plus size={16} />}>New PO</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataTable data={data} columns={columnsWithActions} />
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit — ${poNo}` : "New Tool Purchase Order"} size="xl">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">Order Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Input label="PO No" value={poNo} onChange={e => setPoNo(e.target.value)} />
              <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              <Input label="Supplier *" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier name" />
              <Input label="PR Reference" value={prRef} onChange={e => setPrRef(e.target.value)} placeholder="TPR-001" />
              <Input label="Expected Date *" type="date" value={expectedDate} onChange={e => setExpected(e.target.value)} />
              <Input label="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Order Lines</p>
              <button onClick={() => setLines(ls => [...ls, newLine()])}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold">
                <Plus size={13} /> Add Line
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold">Tool</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-16">Qty</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-24">Rate (₹)</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-24">Amount (₹)</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-2 py-1.5">
                        <select value={l.toolId} onChange={e => updateLine(idx, "toolId", e.target.value)} className={tblCls}>
                          <option value="">-- Select Tool --</option>
                          {tools.filter(t => t.status === "Active").map(t => (
                            <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={1} value={l.qty}
                          onChange={e => updateLine(idx, "qty", Number(e.target.value))} className={tblCls} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={0} value={l.rate}
                          onChange={e => updateLine(idx, "rate", Number(e.target.value))} className={tblCls} />
                      </td>
                      <td className="px-2 py-1.5 font-semibold text-gray-700">
                        ₹ {fmtAmt(l.amount)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {lines.length > 1 && (
                          <button onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">
                            <X size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={3} className="px-3 py-2 text-right text-xs font-bold text-gray-600">Total Amount:</td>
                    <td className="px-2 py-2 font-bold text-purple-700">₹ {fmtAmt(totalAmt)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save PO</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
