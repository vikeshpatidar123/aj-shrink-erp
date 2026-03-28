"use client";
import { useState, useMemo } from "react";
import { Wrench, Plus, Pencil, Trash2, X } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import {
  toolIssues as initData, ToolIssue, ToolIssueLine,
  toolInventory as toolInventoryData, ToolInventory, ToolType,
} from "@/data/dummyData";

// ─── Constants ───────────────────────────────────────────────
const DEPARTMENTS = ["Pre-Press", "Printing", "Lamination", "Slitting", "QC"];

const todayISO   = () => new Date().toISOString().split("T")[0];
const fmtDate    = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const nextIssueNo = (list: ToolIssue[]) => `TIS-${String(list.length + 1).padStart(3, "0")}`;

const STATUS_CLS: Record<ToolIssue["status"], string> = {
  Draft:  "bg-gray-100 text-gray-600",
  Issued: "bg-blue-100 text-blue-700",
};

const newLine = (): ToolIssueLine => ({
  id: Math.random().toString(36).slice(2),
  inventoryId: "", toolId: "", toolCode: "", toolName: "",
  toolType: "Cylinder", location: "", remarks: "",
});

const tblCls = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

// ─── Columns ─────────────────────────────────────────────────
const columns: Column<ToolIssue>[] = [
  { key: "issueNo",     header: "Issue No",      render: r => <span className="font-mono text-xs font-semibold text-purple-700">{r.issueNo}</span> },
  { key: "date",        header: "Date",           render: r => fmtDate(r.date) },
  { key: "workOrderNo", header: "Work Order",     render: r => <span className="font-mono text-xs">{r.workOrderNo || "—"}</span> },
  { key: "department",  header: "Department",     render: r => r.department },
  { key: "issuedTo",    header: "Issued To",      render: r => r.issuedTo },
  { key: "lines",       header: "Lines",          render: r => <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{r.lines.length}</span> },
  { key: "status",      header: "Status",         render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[r.status]}`}>{r.status}</span> },
];

// ─── Main Component ───────────────────────────────────────────
export default function ToolIssuePage() {
  const [data, setData]       = useState<ToolIssue[]>(initData);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<ToolIssue | null>(null);

  const [issueNo, setIssueNo]       = useState("");
  const [date, setDate]             = useState(todayISO());
  const [workOrderNo, setWONo]      = useState("");
  const [jobRef, setJobRef]         = useState("");
  const [department, setDept]       = useState("");
  const [issuedTo, setIssuedTo]     = useState("");
  const [remarks, setRemarks]       = useState("");
  const [lines, setLines]           = useState<ToolIssueLine[]>([newLine()]);

  const availableTools = useMemo(
    () => toolInventoryData.filter(t => t.status === "Available"),
    []
  );

  const openNew = () => {
    setEditing(null);
    setIssueNo(nextIssueNo(data)); setDate(todayISO()); setWONo(""); setJobRef("");
    setDept(""); setIssuedTo(""); setRemarks("");
    setLines([newLine()]);
    setModal(true);
  };

  const openEdit = (r: ToolIssue) => {
    setEditing(r);
    setIssueNo(r.issueNo); setDate(r.date); setWONo(r.workOrderNo); setJobRef(r.jobRef);
    setDept(r.department); setIssuedTo(r.issuedTo); setRemarks(r.remarks);
    setLines(r.lines.map(l => ({ ...l })));
    setModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this Tool Issue?")) setData(d => d.filter(r => r.id !== id));
  };

  const updateLine = (idx: number, field: keyof ToolIssueLine, value: string) => {
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
          updated.location = inv.location;
        }
      }
      return updated;
    }));
  };

  const handleSave = () => {
    if (!department || !issuedTo) { alert("Please fill all required fields."); return; }
    const record: ToolIssue = {
      id: editing?.id ?? Math.random().toString(36).slice(2),
      issueNo, date, workOrderNo, jobRef, department, issuedTo,
      lines, status: editing?.status ?? "Draft", remarks,
    };
    setData(d => editing ? d.map(r => r.id === editing.id ? record : r) : [...d, record]);
    setModal(false);
  };

  const columnsWithActions: Column<ToolIssue>[] = [
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
            <h1 className="text-xl font-bold text-gray-800">Tool Issue</h1>
            <p className="text-xs text-gray-500">{data.length} issue records</p>
          </div>
        </div>
        <Button onClick={openNew} icon={<Plus size={16} />}>New Issue</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataTable data={data} columns={columnsWithActions} />
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit — ${issueNo}` : "New Tool Issue"} size="xl">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">Issue Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Input label="Issue No" value={issueNo} onChange={e => setIssueNo(e.target.value)} />
              <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              <Input label="Work Order No" value={workOrderNo} onChange={e => setWONo(e.target.value)} placeholder="WO-001" />
              <Input label="Job Reference" value={jobRef} onChange={e => setJobRef(e.target.value)} placeholder="JOB-001" />
              <Select
                label="Department *"
                value={department}
                onChange={e => setDept(e.target.value)}
                options={[{ value: "", label: "-- Select --" }, ...DEPARTMENTS.map(d => ({ value: d, label: d }))]}
              />
              <Input label="Issued To *" value={issuedTo} onChange={e => setIssuedTo(e.target.value)} placeholder="Employee name" />
              <Input label="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)} className="col-span-2 sm:col-span-3" />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Tools to Issue</p>
              <button onClick={() => setLines(ls => [...ls, newLine()])}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold">
                <Plus size={13} /> Add Line
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold">Tool (Available Only)</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-36">Current Location</th>
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
                          {availableTools.map(t => (
                            <option key={t.id} value={t.id}>{t.toolCode} — {t.toolName} ({t.location})</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-gray-600">{l.location || "—"}</td>
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
            <Button onClick={handleSave}>Save Issue</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
