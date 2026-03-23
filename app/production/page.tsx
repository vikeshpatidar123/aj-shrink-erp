"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { productionEntries as initData, jobCards, machines, ProductionEntry } from "@/data/dummyData";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

const blank: Omit<ProductionEntry, "id" | "entryNo" | "netQty"> = {
  date: new Date().toISOString().slice(0, 10),
  jobCardId: "", jobCardNo: "", machineId: "", machineName: "",
  shift: "A", rollNo: "", producedQty: 0, wastageQty: 0,
  machineRuntime: 8, remarks: "",
};

export default function ProductionPage() {
  const [data, setData] = useState<ProductionEntry[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow] = useState<ProductionEntry | null>(null);
  const [editing, setEditing] = useState<ProductionEntry | null>(null);
  const [form, setForm] = useState<Omit<ProductionEntry, "id" | "entryNo" | "netQty">>(blank);

  const f = (k: keyof typeof form, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  const netQty = form.producedQty - form.wastageQty;
  const wastePct = form.producedQty > 0 ? ((form.wastageQty / form.producedQty) * 100).toFixed(1) : "0";

  const openAdd = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (row: ProductionEntry) => {
    setEditing(row);
    setForm({ date: row.date, jobCardId: row.jobCardId, jobCardNo: row.jobCardNo, machineId: row.machineId, machineName: row.machineName, shift: row.shift, rollNo: row.rollNo, producedQty: row.producedQty, wastageQty: row.wastageQty, machineRuntime: row.machineRuntime, remarks: row.remarks });
    setModalOpen(true);
  };

  const save = () => {
    if (!form.jobCardId || !form.rollNo) return;
    const record = { ...form, netQty: form.producedQty - form.wastageQty };
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...record, id: editing.id, entryNo: editing.entryNo } : r));
    } else {
      const entryNo = generateCode(UNIT_CODE.Extrusion, MODULE_CODE.Production, data.map(d => d.entryNo));
      const id = `EXPN${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...record, id, entryNo }]);
    }
    setModalOpen(false);
  };

  const totalProduced = data.reduce((s, d) => s + d.producedQty, 0);
  const totalWastage = data.reduce((s, d) => s + d.wastageQty, 0);
  const totalNet = data.reduce((s, d) => s + d.netQty, 0);

  const columns: Column<ProductionEntry>[] = [
    { key: "entryNo", header: "Entry No", sortable: true },
    { key: "date", header: "Date", sortable: true },
    { key: "jobCardNo", header: "Job Card No" },
    { key: "machineName", header: "Machine" },
    { key: "shift", header: "Shift", render: (r) => statusBadge(r.shift) },
    { key: "rollNo", header: "Roll No" },
    { key: "producedQty", header: "Produced (Kg)", render: (r) => <span>{r.producedQty}</span> },
    { key: "wastageQty", header: "Wastage (Kg)", render: (r) => <span className="text-red-500">{r.wastageQty}</span> },
    { key: "netQty", header: "Net Qty (Kg)", render: (r) => <span className="font-semibold text-green-700">{r.netQty}</span> },
    { key: "machineRuntime", header: "Runtime (hr)" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Production Entry</h2>
          <p className="text-sm text-gray-500">{data.length} entries recorded</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Entry</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Produced", val: `${totalProduced.toLocaleString()} Kg`, cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Total Wastage", val: `${totalWastage.toLocaleString()} Kg`, cls: "bg-red-50 text-red-700 border-red-200" },
          { label: "Net Production", val: `${totalNet.toLocaleString()} Kg`, cls: "bg-green-50 text-green-700 border-green-200" },
          { label: "Avg Wastage %", val: `${totalProduced > 0 ? ((totalWastage / totalProduced) * 100).toFixed(1) : 0}%`, cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["entryNo", "jobCardNo", "machineName", "rollNo"]}
          actions={(row) => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />}
                onClick={() => setData((d) => d.filter(r => r.id !== row.id))}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Entry" : "New Production Entry"} size="xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <Input label="Date" type="date" value={form.date} onChange={(e) => f("date", e.target.value)} />
          <Select
            label="Job Card *"
            value={form.jobCardId}
            onChange={(e) => {
              const jc = jobCards.find(x => x.id === e.target.value);
              if (jc) { f("jobCardId", jc.id); f("jobCardNo", jc.jobCardNo); f("machineId", jc.machineId); f("machineName", jc.machineName); }
            }}
            options={jobCards.map(jc => ({ value: jc.id, label: `${jc.jobCardNo} – ${jc.customerName}` }))}
          />
          <Input label="Machine" value={form.machineName} readOnly className="bg-gray-50" />
          <Select
            label="Shift"
            value={form.shift}
            onChange={(e) => f("shift", e.target.value)}
            options={[{ value: "A", label: "Shift A" }, { value: "B", label: "Shift B" }, { value: "C", label: "Shift C" }]}
          />
          <Input label="Roll / Batch No *" value={form.rollNo} onChange={(e) => f("rollNo", e.target.value)} placeholder="e.g. ROLL-001" />
          <Input label="Machine Runtime (hr)" type="number" value={form.machineRuntime} onChange={(e) => f("machineRuntime", Number(e.target.value))} step={0.5} />
          <Input label="Produced Qty (Kg)" type="number" value={form.producedQty} onChange={(e) => f("producedQty", Number(e.target.value))} />
          <Input label="Wastage Qty (Kg)" type="number" value={form.wastageQty} onChange={(e) => f("wastageQty", Number(e.target.value))} />
        </div>

        {/* Live calculation */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-gray-500">Net Qty</p>
            <p className="text-lg font-bold text-green-700">{netQty} Kg</p>
          </div>
          <div className={`rounded-lg p-3 border ${Number(wastePct) > 5 ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
            <p className="text-xs text-gray-500">Wastage %</p>
            <p className={`text-lg font-bold ${Number(wastePct) > 5 ? "text-red-600" : "text-yellow-700"}`}>{wastePct}%</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-gray-500">Runtime</p>
            <p className="text-lg font-bold text-blue-700">{form.machineRuntime} hr</p>
          </div>
        </div>

        <div className="mt-4">
          <Textarea label="Remarks" value={form.remarks} onChange={(e) => f("remarks", e.target.value)} placeholder="Any observations..." />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Save Entry"}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Production Entry – ${viewRow.entryNo}`} size="lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {[
              ["Date", viewRow.date],
              ["Job Card", viewRow.jobCardNo],
              ["Machine", viewRow.machineName],
              ["Shift", viewRow.shift],
              ["Roll No", viewRow.rollNo],
              ["Runtime", `${viewRow.machineRuntime} hr`],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-gray-500">{k}</p>
                <p className="font-medium text-gray-900">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs text-gray-500">Produced</p>
              <p className="font-bold text-blue-700">{viewRow.producedQty} Kg</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
              <p className="text-xs text-gray-500">Wastage</p>
              <p className="font-bold text-red-600">{viewRow.wastageQty} Kg</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <p className="text-xs text-gray-500">Net Qty</p>
              <p className="font-bold text-green-700">{viewRow.netQty} Kg</p>
            </div>
          </div>
          {viewRow.remarks && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              <p className="text-xs text-gray-500 mb-1">Remarks</p>
              {viewRow.remarks}
            </div>
          )}
          <div className="flex justify-end mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
