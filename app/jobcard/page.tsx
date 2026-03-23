"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, Printer } from "lucide-react";
import { jobCards as initData, orders, machines, employees, JobCard } from "@/data/dummyData";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

const blank: Omit<JobCard, "id" | "jobCardNo"> = {
  date: new Date().toISOString().slice(0, 10),
  orderId: "", orderNo: "", customerName: "", productName: "",
  targetQty: 0, unit: "Kg",
  machineId: "", machineName: "", operatorId: "", operatorName: "",
  plannedDate: "", status: "Open",
};

export default function JobCardPage() {
  const [data, setData] = useState<JobCard[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow] = useState<JobCard | null>(null);
  const [editing, setEditing] = useState<JobCard | null>(null);
  const [form, setForm] = useState<Omit<JobCard, "id" | "jobCardNo">>(blank);

  const f = (k: keyof typeof form, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (row: JobCard) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const save = () => {
    if (!form.orderId || !form.machineId) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id, jobCardNo: editing.jobCardNo } : r));
    } else {
      const jobCardNo = generateCode(UNIT_CODE.Extrusion, MODULE_CODE.JobCard, data.map(d => d.jobCardNo));
      const id = `EXJC${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id, jobCardNo }]);
    }
    setModalOpen(false);
  };

  const columns: Column<JobCard>[] = [
    { key: "jobCardNo", header: "Job Card No", sortable: true },
    { key: "date", header: "Date", sortable: true },
    { key: "orderNo", header: "Order No" },
    { key: "customerName", header: "Customer", sortable: true },
    { key: "productName", header: "Product" },
    { key: "targetQty", header: "Target Qty", render: (r) => <span>{r.targetQty.toLocaleString()} {r.unit}</span> },
    { key: "machineName", header: "Machine" },
    { key: "operatorName", header: "Operator" },
    { key: "plannedDate", header: "Planned Date" },
    { key: "status", header: "Status", render: (r) => statusBadge(r.status), sortable: true },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Job Card Management</h2>
          <p className="text-sm text-gray-500">{data.length} job cards · {data.filter(j => j.status === "In Progress").length} in progress</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>Generate Job Card</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {["Open", "In Progress", "Completed", "On Hold"].map((s) => {
          const colors: Record<string, string> = {
            Open: "bg-gray-50 text-gray-600 border-gray-200",
            "In Progress": "bg-yellow-50 text-yellow-700 border-yellow-200",
            Completed: "bg-green-50 text-green-700 border-green-200",
            "On Hold": "bg-red-50 text-red-700 border-red-200",
          };
          return (
            <div key={s} className={`rounded-xl border p-4 ${colors[s]}`}>
              <p className="text-xs font-medium">{s}</p>
              <p className="text-2xl font-bold mt-1">{data.filter(j => j.status === s).length}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["jobCardNo", "customerName", "orderNo", "machineName"]}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Job Card" : "Generate Job Card"} size="xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Input label="Date" type="date" value={form.date} onChange={(e) => f("date", e.target.value)} />
          <Select
            label="Order *"
            value={form.orderId}
            onChange={(e) => {
              const o = orders.find(x => x.id === e.target.value);
              if (o) { f("orderId", o.id); f("orderNo", o.orderNo); f("customerName", o.customerName); f("productName", o.productName); f("targetQty", o.quantity); f("unit", o.unit); }
            }}
            options={orders.map(o => ({ value: o.id, label: `${o.orderNo} – ${o.customerName}` }))}
          />
          <Input label="Customer" value={form.customerName} readOnly className="bg-gray-50" />
          <Input label="Product" value={form.productName} readOnly className="bg-gray-50" />
          <Input label="Target Quantity" type="number" value={form.targetQty} onChange={(e) => f("targetQty", Number(e.target.value))} />
          <Select label="Unit" value={form.unit} onChange={(e) => f("unit", e.target.value)}
            options={[{ value: "Kg", label: "Kg" }, { value: "Meter", label: "Meter" }]} />
          <Select
            label="Machine *"
            value={form.machineId}
            onChange={(e) => {
              const m = machines.find(x => x.id === e.target.value);
              if (m) { f("machineId", m.id); f("machineName", m.name); }
            }}
            options={machines.map(m => ({ value: m.id, label: `${m.name} (${m.status})` }))}
          />
          <Select
            label="Operator *"
            value={form.operatorId}
            onChange={(e) => {
              const emp = employees.find(x => x.id === e.target.value);
              if (emp) { f("operatorId", emp.id); f("operatorName", emp.name); }
            }}
            options={employees.filter(e => e.status === "Active").map(e => ({ value: e.id, label: `${e.name} (${e.department})` }))}
          />
          <Input label="Planned Date" type="date" value={form.plannedDate} onChange={(e) => f("plannedDate", e.target.value)} />
          <Select label="Status" value={form.status} onChange={(e) => f("status", e.target.value)}
            options={[
              { value: "Open", label: "Open" },
              { value: "In Progress", label: "In Progress" },
              { value: "Completed", label: "Completed" },
              { value: "On Hold", label: "On Hold" },
            ]} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Generate"}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Job Card – ${viewRow.jobCardNo}`} size="lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {[
              ["Order No", viewRow.orderNo],
              ["Customer", viewRow.customerName],
              ["Product", viewRow.productName],
              ["Target Qty", `${viewRow.targetQty.toLocaleString()} ${viewRow.unit}`],
              ["Machine", viewRow.machineName],
              ["Operator", viewRow.operatorName],
              ["Planned Date", viewRow.plannedDate],
              ["Status", viewRow.status],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-gray-500">{k}</p>
                <p className="font-medium text-gray-900">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <Button variant="ghost" icon={<Printer size={14} />} onClick={() => window.print()}>Print Job Card</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
