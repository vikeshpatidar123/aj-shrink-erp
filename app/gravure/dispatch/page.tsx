"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, Truck } from "lucide-react";
import { gravureDispatches as initData, gravureOrders, customers, GravureDispatch } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

const blank: Omit<GravureDispatch, "id" | "dispatchNo"> = {
  date: new Date().toISOString().slice(0, 10),
  orderId: "", orderNo: "",
  customerId: "", customerName: "",
  jobName: "", quantity: 0, unit: "Meter",
  noOfRolls: 0, vehicleNo: "", driverName: "", lrNo: "",
  status: "Pending",
};

const statusColors: Record<string, string> = {
  Pending:    "bg-yellow-50 text-yellow-700 border-yellow-200",
  "In Transit":"bg-blue-50 text-blue-700 border-blue-200",
  Delivered:  "bg-green-50 text-green-700 border-green-200",
};

export default function GravureDispatchPage() {
  const [data, setData]         = useState<GravureDispatch[]>(initData);
  const [modalOpen, setModal]   = useState(false);
  const [viewRow, setViewRow]   = useState<GravureDispatch | null>(null);
  const [editing, setEditing]   = useState<GravureDispatch | null>(null);
  const [form, setForm]         = useState<Omit<GravureDispatch, "id" | "dispatchNo">>(blank);

  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const openAdd  = () => { setEditing(null); setForm(blank); setModal(true); };
  const openEdit = (row: GravureDispatch) => { setEditing(row); setForm({ ...row }); setModal(true); };

  const save = () => {
    if (!form.orderId) return;
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...form, id: editing.id, dispatchNo: editing.dispatchNo } : r));
    } else {
      const n = data.length + 1;
      setData(d => [...d, { ...form, id: `GD${String(n + 2).padStart(3, "0")}`, dispatchNo: `GRV-DSP-2024-${String(n + 2).padStart(3, "0")}` }]);
    }
    setModal(false);
  };

  const totalQty    = data.reduce((s, d) => s + d.quantity, 0);
  const totalRolls  = data.reduce((s, d) => s + d.noOfRolls, 0);
  const delivered   = data.filter(d => d.status === "Delivered").length;

  // Customer dispatch summary
  const customerSummary = Array.from(new Set(data.map(d => d.customerName))).map(name => {
    const items = data.filter(d => d.customerName === name);
    return {
      name,
      dispatches: items.length,
      totalQty: items.reduce((s, d) => s + d.quantity, 0),
      totalRolls: items.reduce((s, d) => s + d.noOfRolls, 0),
      lastDate: [...items].sort((a, b) => b.date.localeCompare(a.date))[0]?.date,
    };
  });

  const columns: Column<GravureDispatch>[] = [
    { key: "dispatchNo",   header: "Dispatch No",  sortable: true },
    { key: "date",         header: "Date",          sortable: true },
    { key: "orderNo",      header: "Order No" },
    { key: "customerName", header: "Customer",      sortable: true },
    { key: "jobName",      header: "Job Name" },
    { key: "quantity",     header: "Qty",      render: r => <span>{r.quantity.toLocaleString()} {r.unit}</span> },
    { key: "noOfRolls",    header: "Rolls",    render: r => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">{r.noOfRolls} Rolls</span> },
    { key: "vehicleNo",    header: "Vehicle No", render: r => <span className="font-mono text-xs">{r.vehicleNo || "—"}</span> },
    { key: "lrNo",         header: "LR No",    render: r => <span className="font-mono text-xs">{r.lrNo || "—"}</span> },
    { key: "status",       header: "Status",   render: r => statusBadge(r.status), sortable: true },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Truck size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Dispatch</h2>
          </div>
          <p className="text-sm text-gray-500">{data.length} dispatches · {totalRolls} rolls · {totalQty.toLocaleString()}m total</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Dispatch</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Dispatches", val: data.length,                                     cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "In Transit",       val: data.filter(d => d.status === "In Transit").length, cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { label: "Delivered",        val: delivered,                                        cls: "bg-green-50 text-green-700 border-green-200" },
          { label: "Total Rolls",      val: totalRolls,                                       cls: "bg-purple-50 text-purple-700 border-purple-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Customer Summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Customer Dispatch Summary</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {["Customer", "Dispatches", "Total Qty", "Total Rolls", "Last Dispatch"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customerSummary.map(cs => (
                <tr key={cs.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{cs.name}</td>
                  <td className="px-4 py-3 text-gray-800">{cs.dispatches}</td>
                  <td className="px-4 py-3 text-gray-800">{cs.totalQty.toLocaleString()} m</td>
                  <td className="px-4 py-3 text-gray-800">{cs.totalRolls} rolls</td>
                  <td className="px-4 py-3 text-gray-600">{cs.lastDate || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* All Dispatches */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">All Dispatch Records</h3>
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["dispatchNo", "customerName", "orderNo", "vehicleNo", "lrNo", "jobName"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setData(d => d.filter(r => r.id !== row.id))}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModal(false)} title={editing ? "Edit Dispatch" : "New Gravure Dispatch"} size="xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
          <Select
            label="Order *"
            value={form.orderId}
            onChange={e => {
              const o = gravureOrders.find(x => x.id === e.target.value);
              if (o) {
                f("orderId", o.id); f("orderNo", o.orderNo);
                f("customerId", o.customerId); f("customerName", o.customerName);
                f("jobName", o.jobName); f("quantity", o.quantity); f("unit", o.unit);
              }
            }}
            options={[{ value: "", label: "-- Select Order --" }, ...gravureOrders.filter(o => o.status === "Ready" || o.status === "In Production").map(o => ({ value: o.id, label: `${o.orderNo} – ${o.customerName}` }))]}
          />
          <Input label="Customer" value={form.customerName} readOnly className="bg-gray-50" />
          <Input label="Job Name" value={form.jobName} onChange={e => f("jobName", e.target.value)} placeholder="Job name" />
          <Input label="Dispatch Quantity (m)" type="number" value={form.quantity} onChange={e => f("quantity", Number(e.target.value))} />
          <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)} options={[{ value: "Pcs", label: "Pcs" }, { value: "Kg", label: "Kg" }]} />
          <Input label="No. of Rolls" type="number" value={form.noOfRolls} onChange={e => f("noOfRolls", Number(e.target.value))} />
          <Input label="Vehicle No" value={form.vehicleNo} onChange={e => f("vehicleNo", e.target.value)} placeholder="e.g. MH-01-AB-1234" />
          <Input label="Driver Name" value={form.driverName} onChange={e => f("driverName", e.target.value)} />
          <Input label="LR No (Lorry Receipt)" value={form.lrNo} onChange={e => f("lrNo", e.target.value)} placeholder="e.g. LR-2024-0312" />
          <Select label="Status" value={form.status} onChange={e => f("status", e.target.value)}
            options={[
              { value: "Pending",    label: "Pending" },
              { value: "In Transit", label: "In Transit" },
              { value: "Delivered",  label: "Delivered" },
            ]} />
        </div>

        {/* Dispatch Summary */}
        {form.quantity > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">Total Quantity</p>
              <p className="font-bold text-blue-700">{form.quantity.toLocaleString()} {form.unit}</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">No. of Rolls</p>
              <p className="font-bold text-purple-700">{form.noOfRolls} Rolls</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">Avg per Roll</p>
              <p className="font-bold text-gray-700">{form.noOfRolls > 0 ? Math.round(form.quantity / form.noOfRolls).toLocaleString() : "—"} {form.unit}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button icon={<Truck size={14} />} onClick={save}>{editing ? "Update" : "Dispatch"}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Dispatch – ${viewRow.dispatchNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                ["Date",       viewRow.date],
                ["Order No",   viewRow.orderNo],
                ["Customer",   viewRow.customerName],
                ["Job Name",   viewRow.jobName],
                ["Quantity",   `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
                ["No. of Rolls",`${viewRow.noOfRolls} Rolls`],
                ["Vehicle No", viewRow.vehicleNo || "—"],
                ["Driver",     viewRow.driverName || "—"],
                ["LR No",      viewRow.lrNo || "—"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
              ))}
            </div>

            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusColors[viewRow.status]}`}>
              <Truck size={12} /> {viewRow.status}
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-2 mt-2">
              {(["Pending", "In Transit", "Delivered"] as const).map((step, i) => {
                const stepIndex = ["Pending", "In Transit", "Delivered"].indexOf(viewRow.status);
                const done = i <= stepIndex;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                      {i + 1}
                    </div>
                    <span className={`text-xs font-medium ${done ? "text-green-700" : "text-gray-400"}`}>{step}</span>
                    {i < 2 && <div className={`flex-1 h-0.5 w-8 ${done && i < stepIndex ? "bg-green-400" : "bg-gray-200"}`} />}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
