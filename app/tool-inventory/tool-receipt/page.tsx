"use client";
import { useState } from "react";
import { Wrench, Plus, Pencil, Trash2, X } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import {
  toolReceipts as initData, ToolReceipt, ToolReceiptLine,
  tools, ToolType, ToolCondition,
} from "@/data/dummyData";

// ─── Constants ───────────────────────────────────────────────
const CONDITIONS: ToolCondition[] = ["New", "Good", "Fair", "Worn"];
const LOCATIONS = [
  "Rack A-1","Rack A-2","Rack B-1","Rack B-2","Rack C-1","Rack C-2","Rack D-1","Rack D-2",
  "Sleeve Store – Rack A","Sleeve Store – Rack B","Sleeve Store – Rack C","Sleeve Store – Rack D","Sleeve Store – Rack E",
  "Press Room – ROTO-01","Press Room – ROTO-02","Press Room – ROTO-03","Die Store-1","Die Store-2",
];

const todayISO  = () => new Date().toISOString().split("T")[0];
const fmtDate   = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const nextRcptNo = (list: ToolReceipt[]) => `TRC-${String(list.length + 1).padStart(3, "0")}`;

const STATUS_CLS: Record<ToolReceipt["status"], string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Completed: "bg-green-100 text-green-700",
};

const newLine = (): ToolReceiptLine => ({
  id: Math.random().toString(36).slice(2),
  toolId: "", toolCode: "", toolName: "", toolType: "Cylinder",
  qty: 1, condition: "New", serialNo: "", location: "", remarks: "",
});

const tblCls = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

// ─── Columns ─────────────────────────────────────────────────
const columns: Column<ToolReceipt>[] = [
  { key: "receiptNo",   header: "Receipt No",   render: r => <span className="font-mono text-xs font-semibold text-purple-700">{r.receiptNo}</span> },
  { key: "date",        header: "Date",          render: r => fmtDate(r.date) },
  { key: "supplier",    header: "Supplier",      render: r => r.supplier },
  { key: "poRef",       header: "PO Ref",        render: r => <span className="font-mono text-xs">{r.poRef || "—"}</span> },
  { key: "receivedBy",  header: "Received By",   render: r => r.receivedBy },
  { key: "lines",       header: "Lines",         render: r => <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{r.lines.length}</span> },
  { key: "status",      header: "Status",        render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[r.status]}`}>{r.status}</span> },
];

// ─── Main Component ───────────────────────────────────────────
export default function ToolReceiptPage() {
  const [data, setData]       = useState<ToolReceipt[]>(initData);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<ToolReceipt | null>(null);

  const [receiptNo, setReceiptNo]   = useState("");
  const [date, setDate]             = useState(todayISO());
  const [supplier, setSupplier]     = useState("");
  const [poRef, setPoRef]           = useState("");
  const [supplierRef, setSupRef]    = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks]       = useState("");
  const [lines, setLines]           = useState<ToolReceiptLine[]>([newLine()]);

  const openNew = () => {
    setEditing(null);
    setReceiptNo(nextRcptNo(data)); setDate(todayISO()); setSupplier(""); setPoRef("");
    setSupRef(""); setReceivedBy(""); setRemarks("");
    setLines([newLine()]);
    setModal(true);
  };

  const openEdit = (r: ToolReceipt) => {
    setEditing(r);
    setReceiptNo(r.receiptNo); setDate(r.date); setSupplier(r.supplier); setPoRef(r.poRef);
    setSupRef(r.supplierRef); setReceivedBy(r.receivedBy); setRemarks(r.remarks);
    setLines(r.lines.map(l => ({ ...l })));
    setModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this Tool Receipt?")) setData(d => d.filter(r => r.id !== id));
  };

  const updateLine = (idx: number, field: keyof ToolReceiptLine, value: string | number) => {
    setLines(ls => ls.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      if (field === "toolId") {
        const t = tools.find(x => x.id === value);
        if (t) { updated.toolCode = t.code; updated.toolName = t.name; updated.toolType = t.toolType; }
      }
      return updated;
    }));
  };

  const handleSave = () => {
    if (!supplier || !receivedBy) { alert("Please fill all required fields."); return; }
    const record: ToolReceipt = {
      id: editing?.id ?? Math.random().toString(36).slice(2),
      receiptNo, date, supplier, poRef, supplierRef, receivedBy,
      lines, status: editing?.status ?? "Draft", remarks,
    };
    setData(d => editing ? d.map(r => r.id === editing.id ? record : r) : [...d, record]);
    setModal(false);
  };

  const columnsWithActions: Column<ToolReceipt>[] = [
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
            <h1 className="text-xl font-bold text-gray-800">Tool Receipt</h1>
            <p className="text-xs text-gray-500">{data.length} receipts</p>
          </div>
        </div>
        <Button onClick={openNew} icon={<Plus size={16} />}>New Receipt</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataTable data={data} columns={columnsWithActions} />
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit — ${receiptNo}` : "New Tool Receipt"} size="xl">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">Receipt Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Input label="Receipt No" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} />
              <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              <Input label="Supplier *" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier name" />
              <Input label="PO Reference" value={poRef} onChange={e => setPoRef(e.target.value)} placeholder="TPO-001" />
              <Input label="Supplier Ref / DC No" value={supplierRef} onChange={e => setSupRef(e.target.value)} placeholder="DC-12345" />
              <Input label="Received By *" value={receivedBy} onChange={e => setReceivedBy(e.target.value)} />
              <Input label="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)} className="col-span-2 sm:col-span-3" />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Received Tools</p>
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
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-28">Condition</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-28">Serial No</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-40">Location</th>
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
                        <select value={l.condition} onChange={e => updateLine(idx, "condition", e.target.value as ToolCondition)} className={tblCls}>
                          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={l.serialNo} onChange={e => updateLine(idx, "serialNo", e.target.value)} className={tblCls} placeholder="SN-XXX" />
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={l.location} onChange={e => updateLine(idx, "location", e.target.value)} className={tblCls}>
                          <option value="">-- Select --</option>
                          {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
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
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Receipt</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
