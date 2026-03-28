"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, Truck } from "lucide-react";
import {
  dispatches as extDispatches, gravureDispatches as grvDispatches,
  orders, gravureOrders,
  customers, Dispatch, GravureDispatch,
} from "@/data/dummyData";
import { useUnit } from "@/context/UnitContext";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

// ─── Combined type ──────────────────────────────────────────────────────────
type CombinedDispatch = {
  id: string; dispatchNo: string;
  businessUnit: "Extrusion" | "Gravure";
  date: string;
  orderId: string; orderNo: string;
  customerId: string; customerName: string;
  productName: string;   // EXT: productName, GRV: jobName
  quantity: number; unit: string;
  // GRV-only
  noOfRolls: number; lrNo: string;
  // common
  vehicleNo: string; driverName: string;
  status: "Pending" | "In Transit" | "Delivered";
};

// ─── Converters ──────────────────────────────────────────────────────────────
const fromExt = (d: Dispatch): CombinedDispatch => ({
  ...d, businessUnit: "Extrusion", noOfRolls: 0, lrNo: "",
});

const fromGrv = (d: GravureDispatch): CombinedDispatch => ({
  ...d, businessUnit: "Gravure", productName: d.jobName,
});

const blankExt = (): Omit<CombinedDispatch, "id" | "dispatchNo"> => ({
  businessUnit: "Extrusion",
  date: new Date().toISOString().slice(0, 10),
  orderId: "", orderNo: "",
  customerId: "", customerName: "",
  productName: "", quantity: 0, unit: "Kg",
  noOfRolls: 0, lrNo: "",
  vehicleNo: "", driverName: "", status: "Pending",
});

const blankGrv = (): Omit<CombinedDispatch, "id" | "dispatchNo"> => ({
  ...blankExt(),
  businessUnit: "Gravure",
  unit: "Meter",
});

// ─── Unit badge ──────────────────────────────────────────────────────────────
const UnitBadge = ({ unit }: { unit: "Extrusion" | "Gravure" }) =>
  unit === "Extrusion"
    ? <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700">EXT</span>
    : <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-700">GRV</span>;

// ─── Page ────────────────────────────────────────────────────────────────────
export default function DispatchPage() {
  const { unit: globalUnit } = useUnit();
  const [data, setData] = useState<CombinedDispatch[]>([
    ...extDispatches.map(fromExt),
    ...grvDispatches.map(fromGrv),
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow]     = useState<CombinedDispatch | null>(null);
  const [editing, setEditing]     = useState<CombinedDispatch | null>(null);
  const [form, setForm]           = useState<Omit<CombinedDispatch, "id" | "dispatchNo">>(blankExt());

  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const switchUnit = (u: "Extrusion" | "Gravure") =>
    setForm(u === "Extrusion" ? blankExt() : blankGrv());

  const displayData = globalUnit === "Both" ? data : data.filter(d => d.businessUnit === globalUnit);

  const openAdd  = () => {
    const u = globalUnit === "Both" ? "Extrusion" : globalUnit;
    setEditing(null);
    setForm(u === "Extrusion" ? blankExt() : blankGrv());
    setModalOpen(true);
  };
  const openEdit = (row: CombinedDispatch) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const save = () => {
    if (!form.orderId) return;
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...form, id: editing.id, dispatchNo: editing.dispatchNo } : r));
    } else {
      const unitCode = UNIT_CODE[form.businessUnit];
      const dispatchNo = generateCode(unitCode, MODULE_CODE.Dispatch, data.map(d => d.dispatchNo));
      const id = `${unitCode}DS${String(data.length + 1).padStart(3, "0")}`;
      setData(d => [...d, { ...form, id, dispatchNo }]);
    }
    setModalOpen(false);
  };

  const extData = data.filter(d => d.businessUnit === "Extrusion");
  const grvData = data.filter(d => d.businessUnit === "Gravure");
  const delivered = displayData.filter(d => d.status === "Delivered").length;
  const inTransit = displayData.filter(d => d.status === "In Transit").length;

  const columns: Column<CombinedDispatch>[] = [
    { key: "dispatchNo",   header: "Dispatch No",  sortable: true },
    { key: "date",         header: "Date",          sortable: true },
    { key: "businessUnit", header: "Unit",          render: r => <UnitBadge unit={r.businessUnit} /> },
    { key: "orderNo",      header: "Order No" },
    { key: "customerName", header: "Customer",      sortable: true },
    { key: "productName",  header: "Product / Job" },
    { key: "quantity",     header: "Qty",           render: r => <span>{r.quantity.toLocaleString()} {r.unit}</span> },
    { key: "vehicleNo",    header: "Vehicle No" },
    { key: "driverName",   header: "Driver" },
    { key: "status",       header: "Status",        render: r => statusBadge(r.status), sortable: true },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Dispatch Management</h2>
          <p className="text-sm text-gray-500">
            {data.length} dispatches
            &nbsp;·&nbsp;
            <span className="text-blue-600 font-medium">{extData.length} EXT</span>
            &nbsp;·&nbsp;
            <span className="text-purple-600 font-medium">{grvData.length} GRV</span>
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Dispatch</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Dispatches", val: displayData.length,  cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "In Transit",       val: inTransit,          cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { label: "Delivered",        val: delivered,          cls: "bg-green-50 text-green-700 border-green-200" },
          { label: "Pending",          val: displayData.filter(d => d.status === "Pending").length, cls: "bg-gray-50 text-gray-600 border-gray-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Customer-wise summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Customer Dispatch Summary</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {["Customer", "Dispatches", "Total Qty", "Last Dispatch"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.from(new Set(displayData.map(d => d.customerName))).map(customer => {
                const cd = displayData.filter(d => d.customerName === customer);
                const totalQty = cd.reduce((s, d) => s + d.quantity, 0);
                const lastDate = [...cd].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
                return (
                  <tr key={customer} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{customer}</td>
                    <td className="px-4 py-3 text-gray-800">{cd.length}</td>
                    <td className="px-4 py-3 text-gray-800">{totalQty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-800">{lastDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* All records */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">All Dispatch Records</h3>
        <DataTable
          data={displayData}
          columns={columns}
          searchKeys={["dispatchNo", "customerName", "orderNo", "vehicleNo"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />}
                onClick={() => setData(d => d.filter(r => r.id !== row.id))}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* ── Form Modal ─────────────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit – ${editing.dispatchNo}` : "New Dispatch"} size="xl">

        {/* Unit Toggle — only when global unit is "Both" and adding new */}
        {!editing && globalUnit === "Both" && (
          <div className="flex gap-2 mb-5">
            {(["Extrusion", "Gravure"] as const).map(u => (
              <button key={u} onClick={() => switchUnit(u)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all
                  ${form.businessUnit === u
                    ? u === "Extrusion"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}>
                {u === "Extrusion" ? "Extrusion (EXT)" : "Gravure (GRV)"}
              </button>
            ))}
          </div>
        )}
        {!editing && globalUnit !== "Both" && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm mb-5
            ${form.businessUnit === "Extrusion" ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-purple-50 border-purple-300 text-purple-800"}`}>
            {form.businessUnit === "Extrusion" ? "⚙️" : "🖨️"} {form.businessUnit} Unit
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />

          {/* Order selector — EXT uses orders, GRV uses gravureOrders */}
          {form.businessUnit === "Extrusion" ? (
            <Select label="Order *" value={form.orderId}
              onChange={e => {
                const o = orders.find(x => x.id === e.target.value);
                if (o) {
                  f("orderId", o.id); f("orderNo", o.orderNo);
                  f("customerId", o.customerId); f("customerName", o.customerName);
                  f("productName", o.productName);
                }
              }}
              options={[{ value: "", label: "-- Select Order --" },
                ...orders.filter(o => o.status !== "Dispatched")
                  .map(o => ({ value: o.id, label: `${o.orderNo} – ${o.customerName}` }))]}
            />
          ) : (
            <Select label="Gravure Order *" value={form.orderId}
              onChange={e => {
                const o = gravureOrders.find(x => x.id === e.target.value);
                if (o) {
                  f("orderId", o.id); f("orderNo", o.orderNo);
                  f("customerId", o.customerId); f("customerName", o.customerName);
                  f("productName", o.jobName);
                }
              }}
              options={[{ value: "", label: "-- Select Order --" },
                ...gravureOrders.filter(o => o.status !== "Dispatched")
                  .map(o => ({ value: o.id, label: `${o.orderNo} – ${o.customerName}` }))]}
            />
          )}

          <Input label="Customer" value={form.customerName} readOnly className="bg-gray-50" />
          <Input label="Product / Job Name" value={form.productName} readOnly className="bg-gray-50" />
          <Input label="Quantity" type="number" value={form.quantity} onChange={e => f("quantity", Number(e.target.value))} />
          <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)}
            options={[{ value: "Kg", label: "Kg" }, { value: "Pcs", label: "Pcs" }, { value: "Roll", label: "Roll" }]} />
          <Input label="Vehicle No" value={form.vehicleNo} onChange={e => f("vehicleNo", e.target.value)} placeholder="e.g. MH-01-AB-1234" />
          <Input label="Driver Name" value={form.driverName} onChange={e => f("driverName", e.target.value)} />

          {/* GRV-only */}
          {form.businessUnit === "Gravure" && (
            <>
              <Input label="No. of Rolls" type="number" value={form.noOfRolls} onChange={e => f("noOfRolls", Number(e.target.value))} />
              <Input label="LR No." value={form.lrNo} onChange={e => f("lrNo", e.target.value)} placeholder="e.g. LR-2024-0312" />
            </>
          )}

          <Select label="Status" value={form.status} onChange={e => f("status", e.target.value)}
            options={[
              { value: "Pending",    label: "Pending" },
              { value: "In Transit", label: "In Transit" },
              { value: "Delivered",  label: "Delivered" },
            ]} />
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button icon={<Truck size={14} />} onClick={save}>{editing ? "Update" : "Dispatch"}</Button>
        </div>
      </Modal>

      {/* ── View Modal ─────────────────────────────────────────────────────── */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)}
          title={`Dispatch – ${viewRow.dispatchNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <UnitBadge unit={viewRow.businessUnit} />
              <span className="text-xs text-gray-500">{viewRow.businessUnit} Unit</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ["Date",            viewRow.date],
                ["Order No",        viewRow.orderNo],
                ["Customer",        viewRow.customerName],
                ["Product / Job",   viewRow.productName],
                ["Quantity",        `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
                ["Vehicle No",      viewRow.vehicleNo],
                ["Driver",          viewRow.driverName],
                ["Status",          viewRow.status],
                ...(viewRow.businessUnit === "Gravure"
                  ? [
                      ["No. of Rolls", String(viewRow.noOfRolls)],
                      ["LR No.",        viewRow.lrNo || "—"],
                    ]
                  : []
                ),
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-gray-500">{k}</p>
                  <p className="font-medium text-gray-900">{v}</p>
                </div>
              ))}
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
