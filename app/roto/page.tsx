"use client";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, Printer, CheckCircle2 } from "lucide-react";
import {
  rotoJobs as initData, orders, rollMasters, hsnMasters,
  processMasters, customers, RotoJob
} from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

type SelectedProcess = { processId: string; processName: string; processType: string };

const blank = {
  date: new Date().toISOString().slice(0, 10),
  orderId: "", orderNo: "", customerId: "", customerName: "", jobName: "",
  extrusionRollId: "", extrusionRollName: "",
  artworkDescription: "", hsnId: "", hsnCode: "",
  quantity: 0, unit: "Kg",
  noOfColors: 0, remarks: "", status: "Open" as RotoJob["status"],
};

export default function RotoPage() {
  const [data, setData] = useState<RotoJob[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow] = useState<RotoJob | null>(null);
  const [editing, setEditing] = useState<RotoJob | null>(null);
  const [form, setForm] = useState(blank);
  const [selectedProcesses, setSelectedProcesses] = useState<SelectedProcess[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => {
    setEditing(null); setForm(blank); setSelectedProcesses([]); setModalOpen(true);
  };
  const openEdit = (row: RotoJob) => {
    setEditing(row);
    setForm({ date: row.date, orderId: row.orderId, orderNo: row.orderNo, customerId: row.customerId, customerName: row.customerName, jobName: row.jobName, extrusionRollId: row.extrusionRollId, extrusionRollName: row.extrusionRollName, artworkDescription: row.artworkDescription, hsnId: row.hsnId, hsnCode: row.hsnCode, quantity: row.quantity, unit: row.unit, noOfColors: row.noOfColors, remarks: row.remarks, status: row.status });
    setSelectedProcesses(row.processes);
    setModalOpen(true);
  };

  const toggleProcess = (proc: typeof processMasters[0]) => {
    setSelectedProcesses(prev => {
      const exists = prev.find(p => p.processId === proc.id);
      if (exists) return prev.filter(p => p.processId !== proc.id);
      return [...prev, { processId: proc.id, processName: proc.name, processType: proc.processCategory }];
    });
  };

  const save = () => {
    if (!form.extrusionRollId) return;
    const record: Omit<RotoJob, "id" | "rotoJobNo"> = { ...form, processes: selectedProcesses };
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...record, id: editing.id, rotoJobNo: editing.rotoJobNo } : r));
    } else {
      const n = data.length + 1;
      setData(d => [...d, { ...record, id: `RJ${String(n).padStart(3, "0")}`, rotoJobNo: `ROTO-2024-${String(n).padStart(3, "0")}` }]);
    }
    setModalOpen(false);
  };

  const processTypeColors: Record<string, string> = {
    Printing: "bg-blue-100 text-blue-700 border-blue-200",
    Lamination: "bg-purple-100 text-purple-700 border-purple-200",
    Coating: "bg-green-100 text-green-700 border-green-200",
    Slitting: "bg-orange-100 text-orange-700 border-orange-200",
    Other: "bg-gray-100 text-gray-600 border-gray-200",
  };

  const columns: Column<RotoJob>[] = [
    { key: "rotoJobNo", header: "Roto Job No", sortable: true },
    { key: "date", header: "Date", sortable: true },
    { key: "customerName", header: "Customer", sortable: true },
    { key: "jobName", header: "Job Name" },
    { key: "extrusionRollName", header: "Extrusion Roll (Ply)" },
    { key: "noOfColors", header: "Colors", render: r => (
      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors} Colors</span>
    )},
    { key: "quantity", header: "Qty", render: r => <span>{r.quantity.toLocaleString()} {r.unit}</span> },
    { key: "hsnCode", header: "HSN" },
    { key: "status", header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  const stats = {
    total: data.length,
    inProgress: data.filter(r => r.status === "In Progress").length,
    open: data.filter(r => r.status === "Open").length,
    completed: data.filter(r => r.status === "Completed").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Rotogravure (Roto) Jobs</h2>
          <p className="text-sm text-gray-500">Gravure printing jobs from extrusion ply rolls</p>
        </div>
        <Button variant="secondary" pill icon={<Plus size={16} />} onClick={openAdd}>New Roto Job</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Jobs", val: stats.total, cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Open", val: stats.open, cls: "bg-gray-50 text-gray-600 border-gray-200" },
          { label: "In Progress", val: stats.inProgress, cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { label: "Completed", val: stats.completed, cls: "bg-green-50 text-green-700 border-green-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["rotoJobNo", "customerName", "jobName"]}
          actions={(row) => (
            <div className="flex items-center gap-1.5 justify-end">
              <RowAction.View onClick={() => setViewRow(row)} />
              <RowAction.Edit onClick={() => openEdit(row)} />
              <RowAction.Delete onClick={() => setDeleteId(row.id)} />
            </div>
          )}
        />
      </div>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit – ${editing.rotoJobNo}` : "New Roto Job"} size="xl">
        <div className="space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input label="Date" type="date" value={form.date} onChange={(e) => f("date", e.target.value)} />
            <Select
              label="Order (Link to Order)"
              value={form.orderId}
              onChange={(e) => {
                const o = orders.find(x => x.id === e.target.value);
                if (o) { f("orderId", o.id); f("orderNo", o.orderNo); f("customerId", o.customerId); f("customerName", o.customerName); f("jobName", o.jobName); f("quantity", o.quantity); f("unit", o.unit); }
              }}
              options={orders.map(o => ({ value: o.id, label: `${o.orderNo} – ${o.customerName}` }))}
            />
            <Input label="Job Name" value={form.jobName} onChange={(e) => f("jobName", e.target.value)} placeholder="e.g. Britannia Biscuit Pack-Feb" />
            <Input label="Customer" value={form.customerName} readOnly className="bg-gray-50" />
          </div>

          {/* Extrusion Roll (Ply) Selection */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Extrusion Roll / Ply</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Select
                label="Select Extrusion Roll (Ply) *"
                value={form.extrusionRollId}
                onChange={(e) => {
                  const r = rollMasters.find(x => x.id === e.target.value);
                  f("extrusionRollId", e.target.value);
                  if (r) f("extrusionRollName", r.name);
                }}
                options={rollMasters.filter(r => r.status === "Active").map(r => ({ value: r.id, label: `${r.name} – ${r.width}mm / ${r.micron}μ` }))}
              />
              {form.extrusionRollId && (() => {
                const roll = rollMasters.find(r => r.id === form.extrusionRollId);
                return roll ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                    <p><strong>Width:</strong> {roll.width} mm &nbsp;|&nbsp; <strong>Micron:</strong> {roll.micron} μ</p>
                    <p><strong>GSM:</strong> {(roll.micron * roll.density).toFixed(2)} g/m² &nbsp;|&nbsp; <strong>Density:</strong> {roll.density}</p>
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Artwork + HSN */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Textarea label="Artwork / Content Description" value={form.artworkDescription} onChange={(e) => f("artworkDescription", e.target.value)} placeholder="Describe artwork, colors, content..." />
            </div>
            <div className="space-y-3">
              <Select
                label="HSN Code"
                value={form.hsnId}
                onChange={(e) => { const h = hsnMasters.find(x => x.id === e.target.value); f("hsnId", e.target.value); if (h) f("hsnCode", h.hsnCode); }}
                options={hsnMasters.map(h => ({ value: h.id, label: `${h.hsnCode} – ${h.description.slice(0, 40)}...` }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Quantity" type="number" value={form.quantity} onChange={(e) => f("quantity", Number(e.target.value))} />
                <Input label="No. of Colors" type="number" value={form.noOfColors} onChange={(e) => f("noOfColors", Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Process Selection */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Select Processes (from Process Master)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {processMasters.filter(p => p.status === "Active").map((proc) => {
                const selected = selectedProcesses.some(p => p.processId === proc.id);
                return (
                  <button
                    key={proc.id}
                    onClick={() => toggleProcess(proc)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-all ${selected ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-200 hover:border-gray-300 text-gray-700"}`}
                  >
                    <span className="flex items-center gap-2">
                      {selected && <CheckCircle2 size={14} className="text-blue-600" />}
                      {proc.name}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${processTypeColors[proc.processCategory]}`}>{proc.processCategory}</span>
                  </button>
                );
              })}
            </div>
            {selectedProcesses.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedProcesses.map(p => (
                  <span key={p.processId} className={`text-xs px-3 py-1 rounded-full border font-medium ${processTypeColors[p.processType]}`}>
                    {p.processName}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Status" value={form.status} onChange={(e) => f("status", e.target.value)}
              options={[{ value: "Open", label: "Open" }, { value: "In Progress", label: "In Progress" }, { value: "Completed", label: "Completed" }, { value: "On Hold", label: "On Hold" }]} />
            <Textarea label="Remarks" value={form.remarks} onChange={(e) => f("remarks", e.target.value)} placeholder="Special instructions..." />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button icon={<Printer size={14} />} onClick={save}>{editing ? "Update" : "Create Roto Job"}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Roto Job – ${viewRow.rotoJobNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Customer", viewRow.customerName],
                ["Job Name", viewRow.jobName],
                ["Extrusion Roll (Ply)", viewRow.extrusionRollName],
                ["HSN Code", viewRow.hsnCode],
                ["Quantity", `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
                ["No. of Colors", viewRow.noOfColors],
              ].map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
              ))}
            </div>

            {viewRow.artworkDescription && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Artwork / Content</p>
                <p className="text-gray-700">{viewRow.artworkDescription}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 mb-2">Processes</p>
              <div className="flex flex-wrap gap-2">
                {viewRow.processes.map((p) => (
                  <span key={p.processId} className={`text-xs px-3 py-1 rounded-full border font-medium ${processTypeColors[p.processType] ?? "bg-gray-100"}`}>
                    {p.processName}
                  </span>
                ))}
              </div>
            </div>

            {viewRow.remarks && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
                <strong>Remarks:</strong> {viewRow.remarks}
              </div>
            )}
          </div>
          <div className="flex justify-end mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
          </div>
        </Modal>
      )}

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Delete this Roto Job?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setData(d => d.filter(r => r.id !== deleteId)); setDeleteId(null); }}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
