"use client";
import { useState, useMemo } from "react";
import { Wrench, Plus, Pencil, Trash2, X } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import {
  toolReturns as initData, ToolReturn, ToolReturnLine,
  toolInventory as toolInventoryData, ToolCondition,
} from "@/data/dummyData";

// ─── Constants ───────────────────────────────────────────────
const CONDITIONS: ToolCondition[] = ["New", "Good", "Fair", "Worn"];
const DEPARTMENTS = ["Pre-Press", "Printing", "Lamination", "Slitting", "QC"];

const todayISO     = () => new Date().toISOString().split("T")[0];
const fmtDate      = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const nextReturnNo = (list: ToolReturn[]) => `TRT-${String(list.length + 1).padStart(3, "0")}`;

const STATUS_CLS: Record<ToolReturn["status"], string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Completed: "bg-green-100 text-green-700",
};

const newLine = (): ToolReturnLine => ({
  id: Math.random().toString(36).slice(2),
  inventoryId: "", toolId: "", toolCode: "", toolName: "",
  toolType: "Cylinder", conditionOnReturn: "Good", remarks: "",
});

const tblCls = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

// ─── Columns ─────────────────────────────────────────────────
const columns: Column<ToolReturn>[] = [
  { key: "returnNo",    header: "Return No",    render: r => <span className="font-mono text-xs font-semibold text-purple-700">{r.returnNo}</span> },
  { key: "date",        header: "Date",          render: r => fmtDate(r.date) },
  { key: "issueRef",    header: "Issue Ref",     render: r => <span className="font-mono text-xs">{r.issueRef || "—"}</span> },
  { key: "department",  header: "Department",    render: r => r.department },
  { key: "returnedBy",  header: "Returned By",   render: r => r.returnedBy },
  { key: "lines",       header: "Lines",         render: r => <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{r.lines.length}</span> },
  { key: "status",      header: "Status",        render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[r.status]}`}>{r.status}</span> },
];

// ─── Main Component ───────────────────────────────────────────
export default function ToolReturnPage() {
  const [data, setData]       = useState<ToolReturn[]>(initData);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<ToolReturn | null>(null);

  const [returnNo, setReturnNo]     = useState("");
  const [date, setDate]             = useState(todayISO());
  const [issueRef, setIssueRef]     = useState("");
  const [department, setDept]       = useState("");
  const [returnedBy, setReturnedBy] = useState("");
  const [remarks, setRemarks]       = useState("");
  const [lines, setLines]           = useState<ToolReturnLine[]>([newLine()]);

  // Only show tools that are "In Use" for returns
  const issuedTools = useMemo(
    () => toolInventoryData.filter(t => t.status === "In Use"),
    []
  );

  const openNew = () => {
    setEditing(null);
    setReturnNo(nextReturnNo(data)); setDate(todayISO()); setIssueRef("");
    setDept(""); setReturnedBy(""); setRemarks("");
    setLines([newLine()]);
    setModal(true);
  };

  const openEdit = (r: ToolReturn) => {
    setEditing(r);
    setReturnNo(r.returnNo); setDate(r.date); setIssueRef(r.issueRef);
    setDept(r.department); setReturnedBy(r.returnedBy); setRemarks(r.remarks);
    setLines(r.lines.map(l => ({ ...l })));
    setModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this Tool Return?")) setData(d => d.filter(r => r.id !== id));
  };

  const updateLine = (idx: number, field: keyof ToolReturnLine, value: string) => {
    setLines(ls => ls.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      if (field === "inventoryId") {
        const inv = toolInventoryData.find(t => t.id === value);
        if (inv) {
          updated.toolId   = inv.toolId;
          updated.toolCode = inv.toolCode;
          updated.toolName = inv.toolName;
          updated.toolType = inv.toolType;
        }
      }
      return updated;
    }));
  };

  const handleSave = () => {
    if (!department || !returnedBy) { alert("Please fill all required fields."); return; }
    const record: ToolReturn = {
      id: editing?.id ?? Math.random().toString(36).slice(2),
      returnNo, date, issueRef, department, returnedBy,
      lines, status: editing?.status ?? "Draft", remarks,
    };
    setData(d => editing ? d.map(r => r.id === editing.id ? record : r) : [...d, record]);
    setModal(false);
  };

  const columnsWithActions: Column<ToolReturn>[] = [
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
            <h1 className="text-xl font-bold text-gray-800">Tool Return</h1>
            <p className="text-xs text-gray-500">{data.length} return records</p>
          </div>
        </div>
        <Button onClick={openNew} icon={<Plus size={16} />}>New Return</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataTable data={data} columns={columnsWithActions} />
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit — ${returnNo}` : "New Tool Return"} size="xl">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">Return Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Input label="Return No" value={returnNo} onChange={e => setReturnNo(e.target.value)} />
              <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              <Input label="Issue Reference" value={issueRef} onChange={e => setIssueRef(e.target.value)} placeholder="TIS-001" />
              <Select
                label="Department *"
                value={department}
                onChange={e => setDept(e.target.value)}
                options={[{ value: "", label: "-- Select --" }, ...DEPARTMENTS.map(d => ({ value: d, label: d }))]}
              />
              <Input label="Returned By *" value={returnedBy} onChange={e => setReturnedBy(e.target.value)} placeholder="Employee name" />
              <Input label="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Returned Tools</p>
              <button onClick={() => setLines(ls => [...ls, newLine()])}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold">
                <Plus size={13} /> Add Line
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold">Tool (In Use)</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-32">Condition on Return</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold">Remarks</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-2 py-1.5">
                        <select value={l.inventoryId} onChange={e => updateLine(idx, "inventoryId", e.target.value)} className={tblCls}>
                          <option value="">-- Select Tool --</option>
                          {issuedTools.map(t => (
                            <option key={t.id} value={t.id}>{t.toolCode} — {t.toolName} ({t.location})</option>
                          ))}
                          {/* Also allow selecting from all tools when editing */}
                          {l.inventoryId && !issuedTools.find(t => t.id === l.inventoryId) &&
                            (() => {
                              const inv = toolInventoryData.find(t => t.id === l.inventoryId);
                              return inv ? <option value={inv.id}>{inv.toolCode} — {inv.toolName}</option> : null;
                            })()
                          }
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={l.conditionOnReturn} onChange={e => updateLine(idx, "conditionOnReturn", e.target.value as ToolCondition)} className={tblCls}>
                          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={l.remarks} onChange={e => updateLine(idx, "remarks", e.target.value)} className={tblCls} placeholder="Optional remarks" />
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
            <Button onClick={handleSave}>Save Return</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
