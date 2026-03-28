"use client";
import { useState, useMemo } from "react";
import { Wrench, Plus, Pencil, Trash2, X } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import {
  toolPRs as initData, ToolPR, ToolPRLine, ToolType,
} from "@/data/dummyData";

// ─── Constants ───────────────────────────────────────────────
const TOOL_TYPES: ToolType[] = ["Cylinder", "Sleeve", "Die", "Anilox Roll", "Doctor Blade", "Impression Roller", "Slitter Knife"];
const DEPARTMENTS = ["Pre-Press", "Printing", "Lamination", "Slitting", "QC"];
const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate  = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const nextPRNo = (list: ToolPR[]) => `TPR-${String(list.length + 1).padStart(3, "0")}`;

const STATUS_CLS: Record<ToolPR["status"], string> = {
  Draft:        "bg-gray-100 text-gray-600",
  Approved:     "bg-green-100 text-green-700",
  "PO Created": "bg-blue-100 text-blue-700",
};

const newLine = (): ToolPRLine => ({
  id: Math.random().toString(36).slice(2),
  toolType: "Cylinder", description: "", qty: 1, purpose: "",
});

const tblCls = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

// ─── Columns ─────────────────────────────────────────────────
const columns: Column<ToolPR>[] = [
  { key: "prNo",         header: "PR No",        render: r => <span className="font-mono text-xs font-semibold text-purple-700">{r.prNo}</span> },
  { key: "date",         header: "Date",          render: r => fmtDate(r.date) },
  { key: "department",   header: "Department",    render: r => r.department },
  { key: "requestedBy",  header: "Requested By",  render: r => r.requestedBy },
  { key: "requiredDate", header: "Required Date", render: r => fmtDate(r.requiredDate) },
  { key: "lines",        header: "Lines",         render: r => <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{r.lines.length}</span> },
  { key: "status",       header: "Status",        render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[r.status]}`}>{r.status}</span> },
];

// ─── Main Component ───────────────────────────────────────────
export default function ToolPRPage() {
  const [data, setData]       = useState<ToolPR[]>(initData);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<ToolPR | null>(null);

  // Form state
  const [prNo, setPrNo]               = useState("");
  const [date, setDate]               = useState(todayISO());
  const [department, setDepartment]   = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [remarks, setRemarks]         = useState("");
  const [lines, setLines]             = useState<ToolPRLine[]>([newLine()]);

  const openNew = () => {
    setEditing(null);
    setPrNo(nextPRNo(data));
    setDate(todayISO()); setDepartment(""); setRequestedBy(""); setRequiredDate(""); setRemarks("");
    setLines([newLine()]);
    setModal(true);
  };

  const openEdit = (pr: ToolPR) => {
    setEditing(pr);
    setPrNo(pr.prNo); setDate(pr.date); setDepartment(pr.department);
    setRequestedBy(pr.requestedBy); setRequiredDate(pr.requiredDate); setRemarks(pr.remarks);
    setLines(pr.lines.map(l => ({ ...l })));
    setModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this Purchase Requisition?")) setData(d => d.filter(r => r.id !== id));
  };

  const updateLine = (idx: number, field: keyof ToolPRLine, value: string | number) => {
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const handleSave = () => {
    if (!department || !requestedBy || !requiredDate) { alert("Please fill all required fields."); return; }
    const record: ToolPR = {
      id: editing?.id ?? Math.random().toString(36).slice(2),
      prNo, date, department, requestedBy, requiredDate,
      lines, status: editing?.status ?? "Draft", remarks,
    };
    setData(d => editing ? d.map(r => r.id === editing.id ? record : r) : [...d, record]);
    setModal(false);
  };

  const columnsWithActions: Column<ToolPR>[] = [
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
            <h1 className="text-xl font-bold text-gray-800">Tool Purchase Requisition</h1>
            <p className="text-xs text-gray-500">{data.length} requisitions</p>
          </div>
        </div>
        <Button onClick={openNew} icon={<Plus size={16} />}>New PR</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataTable data={data} columns={columnsWithActions} />
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit — ${prNo}` : "New Tool Purchase Requisition"} size="xl">
        <div className="space-y-5">
          {/* Header fields */}
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">Requisition Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Input label="PR No" value={prNo} onChange={e => setPrNo(e.target.value)} />
              <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              <Input label="Required Date *" type="date" value={requiredDate} onChange={e => setRequiredDate(e.target.value)} />
              <Select
                label="Department *"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                options={[{ value: "", label: "-- Select --" }, ...DEPARTMENTS.map(d => ({ value: d, label: d }))]}
              />
              <Input label="Requested By *" value={requestedBy} onChange={e => setRequestedBy(e.target.value)} />
              <Input label="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Requisition Lines</p>
              <button onClick={() => setLines(ls => [...ls, newLine()])}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold">
                <Plus size={13} /> Add Line
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-40">Tool Type</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold">Description</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-20">Qty</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold">Purpose</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-2 py-1.5">
                        <select value={l.toolType} onChange={e => updateLine(idx, "toolType", e.target.value as ToolType)} className={tblCls}>
                          {TOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={l.description} onChange={e => updateLine(idx, "description", e.target.value)} className={tblCls} placeholder="Describe the tool required" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={1} value={l.qty} onChange={e => updateLine(idx, "qty", Number(e.target.value))} className={tblCls} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={l.purpose} onChange={e => updateLine(idx, "purpose", e.target.value)} className={tblCls} placeholder="e.g. New Job, Replacement" />
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
            <Button onClick={handleSave}>Save PR</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
