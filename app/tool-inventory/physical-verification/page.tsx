"use client";
import { useState, useMemo } from "react";
import { Wrench, Plus, Pencil, Trash2, X } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import {
  toolPhysVerifications as initData, ToolPhysVerification, ToolPhysVerLine,
  toolInventory as toolInventoryData, ToolCondition, ToolStatus,
} from "@/data/dummyData";

// ─── Constants ───────────────────────────────────────────────
const CONDITIONS: ToolCondition[] = ["New", "Good", "Fair", "Worn"];
const STATUSES: ToolStatus[]      = ["Available", "In Use", "Under Maintenance", "Retired"];
const LOCATIONS = [
  "Rack A-1","Rack A-2","Rack B-1","Rack B-2","Rack C-1","Rack C-2","Rack D-1","Rack D-2",
  "Sleeve Store – Rack A","Sleeve Store – Rack B","Sleeve Store – Rack C","Sleeve Store – Rack D","Sleeve Store – Rack E",
  "Press Room – ROTO-01","Press Room – ROTO-02","Press Room – ROTO-03","Die Store-1","Die Store-2",
];

const todayISO  = () => new Date().toISOString().split("T")[0];
const fmtDate   = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const nextVerNo = (list: ToolPhysVerification[]) => `TPV-${String(list.length + 1).padStart(3, "0")}`;

const STATUS_CLS: Record<ToolPhysVerification["status"], string> = {
  Draft:     "bg-gray-100 text-gray-600",
  Completed: "bg-green-100 text-green-700",
};

const CONDITION_CLS: Record<ToolCondition, string> = {
  New:  "bg-green-100 text-green-700",
  Good: "bg-blue-100 text-blue-700",
  Fair: "bg-amber-100 text-amber-700",
  Worn: "bg-red-100 text-red-700",
};

const newLine = (inv?: (typeof toolInventoryData)[0]): ToolPhysVerLine => ({
  id: Math.random().toString(36).slice(2),
  inventoryId:      inv?.id      ?? "",
  toolId:           inv?.toolId  ?? "",
  toolCode:         inv?.toolCode ?? "",
  toolName:         inv?.toolName ?? "",
  toolType:         inv?.toolType ?? "Cylinder",
  systemCondition:  inv?.condition ?? "",
  systemStatus:     inv?.status   ?? "",
  verifiedCondition: (inv?.condition as ToolCondition) ?? "Good",
  verifiedStatus:   (inv?.status   as ToolStatus)     ?? "Available",
  remarks: "",
});

const tblCls = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

// ─── Columns ─────────────────────────────────────────────────
const columns: Column<ToolPhysVerification>[] = [
  { key: "verificationNo", header: "Verification No", render: r => <span className="font-mono text-xs font-semibold text-purple-700">{r.verificationNo}</span> },
  { key: "date",           header: "Date",             render: r => fmtDate(r.date) },
  { key: "location",       header: "Location",         render: r => <span className="text-xs text-gray-700">{r.location}</span> },
  { key: "verifiedBy",     header: "Verified By",      render: r => r.verifiedBy },
  { key: "lines",          header: "Lines",            render: r => <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{r.lines.length}</span> },
  { key: "status",         header: "Status",           render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLS[r.status]}`}>{r.status}</span> },
];

// ─── Main Component ───────────────────────────────────────────
export default function PhysicalVerificationPage() {
  const [data, setData]       = useState<ToolPhysVerification[]>(initData);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<ToolPhysVerification | null>(null);

  const [verNo, setVerNo]         = useState("");
  const [date, setDate]           = useState(todayISO());
  const [location, setLocation]   = useState("");
  const [verifiedBy, setVerBy]    = useState("");
  const [remarks, setRemarks]     = useState("");
  const [lines, setLines]         = useState<ToolPhysVerLine[]>([]);

  // Tools filtered by selected location for quick-add
  const toolsAtLocation = useMemo(
    () => location ? toolInventoryData.filter(t => t.location === location) : toolInventoryData,
    [location]
  );

  const openNew = () => {
    setEditing(null);
    setVerNo(nextVerNo(data)); setDate(todayISO()); setLocation(""); setVerBy(""); setRemarks("");
    setLines([]);
    setModal(true);
  };

  const openEdit = (r: ToolPhysVerification) => {
    setEditing(r);
    setVerNo(r.verificationNo); setDate(r.date); setLocation(r.location);
    setVerBy(r.verifiedBy); setRemarks(r.remarks);
    setLines(r.lines.map(l => ({ ...l })));
    setModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this Physical Verification?")) setData(d => d.filter(r => r.id !== id));
  };

  const addToolFromInventory = (invId: string) => {
    if (!invId) return;
    if (lines.find(l => l.inventoryId === invId)) return; // already added
    const inv = toolInventoryData.find(t => t.id === invId);
    if (inv) setLines(ls => [...ls, newLine(inv)]);
  };

  const updateLine = (idx: number, field: keyof ToolPhysVerLine, value: string) => {
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const handleSave = () => {
    if (!location || !verifiedBy) { alert("Please fill all required fields."); return; }
    if (lines.length === 0) { alert("Please add at least one tool to verify."); return; }
    const record: ToolPhysVerification = {
      id: editing?.id ?? Math.random().toString(36).slice(2),
      verificationNo: verNo, date, location, verifiedBy,
      lines, status: editing?.status ?? "Draft", remarks,
    };
    setData(d => editing ? d.map(r => r.id === editing.id ? record : r) : [...d, record]);
    setModal(false);
  };

  const columnsWithActions: Column<ToolPhysVerification>[] = [
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
            <h1 className="text-xl font-bold text-gray-800">Physical Verification</h1>
            <p className="text-xs text-gray-500">{data.length} verification records</p>
          </div>
        </div>
        <Button onClick={openNew} icon={<Plus size={16} />}>New Verification</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataTable data={data} columns={columnsWithActions} />
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit — ${verNo}` : "New Physical Verification"} size="xl">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">Verification Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Input label="Verification No" value={verNo} onChange={e => setVerNo(e.target.value)} />
              <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              <Select
                label="Location *"
                value={location}
                onChange={e => setLocation(e.target.value)}
                options={[{ value: "", label: "-- Select Location --" }, ...LOCATIONS.map(l => ({ value: l, label: l }))]}
              />
              <Input label="Verified By *" value={verifiedBy} onChange={e => setVerBy(e.target.value)} placeholder="Employee name" />
              <Input label="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)} className="sm:col-span-2" />
            </div>
          </div>

          {/* Add tools from inventory */}
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">
              Verification Lines
              {location && <span className="ml-2 text-gray-400 normal-case font-normal">— {toolsAtLocation.length} tools at {location}</span>}
            </p>

            {/* Quick-add selector */}
            <div className="flex items-center gap-2 mb-3">
              <select
                className={`flex-1 ${tblCls}`}
                defaultValue=""
                onChange={e => { addToolFromInventory(e.target.value); e.target.value = ""; }}
              >
                <option value="">-- Add tool to verify --</option>
                {toolsAtLocation
                  .filter(t => !lines.find(l => l.inventoryId === t.id))
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      {t.toolCode} — {t.toolName} | {t.condition} | {t.status}
                    </option>
                  ))}
              </select>
              <span className="text-xs text-gray-500 whitespace-nowrap">{lines.length} tool{lines.length !== 1 ? "s" : ""} added</span>
            </div>

            {lines.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Tool</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold w-24">Sys Condition</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold w-24">Sys Status</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold w-28">Verified Condition</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold w-32">Verified Status</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Remarks</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={l.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-1.5">
                          <div className="font-medium text-gray-800">{l.toolCode}</div>
                          <div className="text-gray-500 text-xs truncate max-w-[180px]">{l.toolName}</div>
                        </td>
                        <td className="px-2 py-1.5">
                          {l.systemCondition && (
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${CONDITION_CLS[l.systemCondition as ToolCondition] ?? "bg-gray-100 text-gray-600"}`}>
                              {l.systemCondition}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600">{l.systemStatus || "—"}</td>
                        <td className="px-2 py-1.5">
                          <select value={l.verifiedCondition} onChange={e => updateLine(idx, "verifiedCondition", e.target.value as ToolCondition)} className={tblCls}>
                            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={l.verifiedStatus} onChange={e => updateLine(idx, "verifiedStatus", e.target.value as ToolStatus)} className={tblCls}>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={l.remarks} onChange={e => updateLine(idx, "remarks", e.target.value)} className={tblCls} placeholder="Discrepancy notes…" />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {lines.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
                Select tools from the dropdown above to add them to this verification.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Verification</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
