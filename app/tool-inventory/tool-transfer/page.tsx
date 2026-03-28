"use client";
import { useState } from "react";
import { Wrench, Plus, Pencil, Trash2, X } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import {
  toolTransfers as initData, ToolTransfer, ToolTransferLine,
  toolInventory as toolInventoryData,
} from "@/data/dummyData";

// ─── Constants ───────────────────────────────────────────────
const LOCATIONS = [
  "Rack A-1","Rack A-2","Rack B-1","Rack B-2","Rack C-1","Rack C-2","Rack D-1","Rack D-2",
  "Sleeve Store – Rack A","Sleeve Store – Rack B","Sleeve Store – Rack C","Sleeve Store – Rack D","Sleeve Store – Rack E",
  "Press Room – ROTO-01","Press Room – ROTO-02","Press Room – ROTO-03","Die Store-1","Die Store-2",
];

const todayISO      = () => new Date().toISOString().split("T")[0];
const fmtDate       = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const nextTransferNo = (list: ToolTransfer[]) => `TTR-${String(list.length + 1).padStart(3, "0")}`;

const STATUS_CLS: Record<ToolTransfer["status"], string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Completed: "bg-green-100 text-green-700",
};

const newLine = (): ToolTransferLine => ({
  id: Math.random().toString(36).slice(2),
  inventoryId: "", toolId: "", toolCode: "", toolName: "",
  toolType: "Cylinder", fromLocation: "", toLocation: "", remarks: "",
});

const tblCls = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

// ─── Columns ─────────────────────────────────────────────────
const columns: Column<ToolTransfer>[] = [
  { key: "transferNo",    header: "Transfer No",    render: r => <span className="font-mono text-xs font-semibold text-purple-700">{r.transferNo}</span> },
  { key: "date",          header: "Date",            render: r => fmtDate(r.date) },
  { key: "fromLocation",  header: "From Location",   render: r => <span className="text-xs text-gray-700">{r.fromLocation}</span> },
  { key: "toLocation",    header: "To Location",     render: r => <span className="text-xs text-gray-700">{r.toLocation}</span> },
  { key: "transferredBy", header: "Transferred By",  render: r => r.transferredBy },
  { key: "lines",         header: "Lines",           render: r => <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{r.lines.length}</span> },
  { key: "status",        header: "Status",          render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[r.status]}`}>{r.status}</span> },
];

// ─── Main Component ───────────────────────────────────────────
export default function ToolTransferPage() {
  const [data, setData]       = useState<ToolTransfer[]>(initData);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<ToolTransfer | null>(null);

  const [transferNo, setTransferNo]     = useState("");
  const [date, setDate]                 = useState(todayISO());
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation]     = useState("");
  const [transferredBy, setTransBy]     = useState("");
  const [remarks, setRemarks]           = useState("");
  const [lines, setLines]               = useState<ToolTransferLine[]>([newLine()]);

  const locOptions = [{ value: "", label: "-- Select Location --" }, ...LOCATIONS.map(l => ({ value: l, label: l }))];

  const openNew = () => {
    setEditing(null);
    setTransferNo(nextTransferNo(data)); setDate(todayISO()); setFromLocation(""); setToLocation("");
    setTransBy(""); setRemarks("");
    setLines([newLine()]);
    setModal(true);
  };

  const openEdit = (r: ToolTransfer) => {
    setEditing(r);
    setTransferNo(r.transferNo); setDate(r.date); setFromLocation(r.fromLocation);
    setToLocation(r.toLocation); setTransBy(r.transferredBy); setRemarks(r.remarks);
    setLines(r.lines.map(l => ({ ...l })));
    setModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this Tool Transfer?")) setData(d => d.filter(r => r.id !== id));
  };

  const handleFromLocationChange = (loc: string) => {
    setFromLocation(loc);
    // Pre-fill fromLocation in all lines
    setLines(ls => ls.map(l => ({ ...l, fromLocation: loc })));
  };

  const handleToLocationChange = (loc: string) => {
    setToLocation(loc);
    // Pre-fill toLocation in all lines
    setLines(ls => ls.map(l => ({ ...l, toLocation: loc })));
  };

  const updateLine = (idx: number, field: keyof ToolTransferLine, value: string) => {
    setLines(ls => ls.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      if (field === "inventoryId") {
        const inv = toolInventoryData.find(t => t.id === value);
        if (inv) {
          updated.toolId       = inv.toolId;
          updated.toolCode     = inv.toolCode;
          updated.toolName     = inv.toolName;
          updated.toolType     = inv.toolType;
          updated.fromLocation = fromLocation || inv.location;
          updated.toLocation   = toLocation;
        }
      }
      return updated;
    }));
  };

  const handleSave = () => {
    if (!fromLocation || !toLocation || !transferredBy) { alert("Please fill all required fields."); return; }
    if (fromLocation === toLocation) { alert("From and To locations cannot be the same."); return; }
    const record: ToolTransfer = {
      id: editing?.id ?? Math.random().toString(36).slice(2),
      transferNo, date, fromLocation, toLocation, transferredBy,
      lines, status: editing?.status ?? "Draft", remarks,
    };
    setData(d => editing ? d.map(r => r.id === editing.id ? record : r) : [...d, record]);
    setModal(false);
  };

  const columnsWithActions: Column<ToolTransfer>[] = [
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
            <h1 className="text-xl font-bold text-gray-800">Tool Transfer</h1>
            <p className="text-xs text-gray-500">{data.length} transfer records</p>
          </div>
        </div>
        <Button onClick={openNew} icon={<Plus size={16} />}>New Transfer</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataTable data={data} columns={columnsWithActions} />
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit — ${transferNo}` : "New Tool Transfer"} size="xl">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">Transfer Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Input label="Transfer No" value={transferNo} onChange={e => setTransferNo(e.target.value)} />
              <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              <Input label="Transferred By *" value={transferredBy} onChange={e => setTransBy(e.target.value)} placeholder="Employee name" />
              <Select label="From Location *" value={fromLocation} onChange={e => handleFromLocationChange(e.target.value)} options={locOptions} />
              <Select label="To Location *" value={toLocation} onChange={e => handleToLocationChange(e.target.value)} options={locOptions} />
              <Input label="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Tools to Transfer</p>
              <button
                onClick={() => setLines(ls => [...ls, { ...newLine(), fromLocation, toLocation }])}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold">
                <Plus size={13} /> Add Line
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold">Tool</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-36">Current Location</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold w-36">Destination</th>
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
                          {toolInventoryData.map(t => (
                            <option key={t.id} value={t.id}>{t.toolCode} — {t.toolName} ({t.status})</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 text-xs">{l.fromLocation || fromLocation || "—"}</td>
                      <td className="px-2 py-1.5 text-gray-600 text-xs">{l.toLocation || toLocation || "—"}</td>
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
            <Button onClick={handleSave}>Save Transfer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
