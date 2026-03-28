"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, ArrowRight } from "lucide-react";
import {
  orders as extOrders, gravureOrders as grvOrders,
  enquiries, gravureEnquiries,
  customers, recipes, rollMasters,
  gravureEstimations,
  Order, GravureOrder,
} from "@/data/dummyData";
import { useUnit } from "@/context/UnitContext";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

// ─── Combined type ──────────────────────────────────────────────────────────
type CombinedOrder = {
  id: string; orderNo: string;
  businessUnit: "Extrusion" | "Gravure";
  date: string;
  enquiryId: string; estimationId: string;
  customerId: string; customerName: string;
  jobName: string; productName: string;
  // EXT-only
  recipeId: string; recipeName: string;
  rollMasterId: string; rollName: string;
  // GRV-only
  substrate: string; structure: string;
  width: number; noOfColors: number; cylinderSet: string;
  // common
  quantity: number; unit: string;
  deliveryDate: string;
  totalAmount: number; advancePaid: number;
  status: "Confirmed" | "In Production" | "Ready" | "Dispatched";
};

// ─── Converters ──────────────────────────────────────────────────────────────
const fromExt = (o: Order): CombinedOrder => ({
  ...o,
  businessUnit: "Extrusion",
  productName: o.productName ?? "",
  substrate: "", structure: "", width: 0, noOfColors: 0, cylinderSet: "",
});

const fromGrv = (o: GravureOrder): CombinedOrder => ({
  ...o,
  businessUnit: "Gravure",
  productName: o.jobName,
  recipeId: "", recipeName: "", rollMasterId: "", rollName: "",
});

const blankExt = (): Omit<CombinedOrder, "id" | "orderNo"> => ({
  businessUnit: "Extrusion",
  date: new Date().toISOString().slice(0, 10),
  enquiryId: "", estimationId: "",
  customerId: "", customerName: "",
  jobName: "", productName: "",
  recipeId: "", recipeName: "", rollMasterId: "", rollName: "",
  substrate: "", structure: "", width: 0, noOfColors: 0, cylinderSet: "",
  quantity: 0, unit: "Kg",
  deliveryDate: "", totalAmount: 0, advancePaid: 0, status: "Confirmed",
});

const blankGrv = (): Omit<CombinedOrder, "id" | "orderNo"> => ({
  ...blankExt(),
  businessUnit: "Gravure",
  unit: "Meter",
  noOfColors: 6,
});

// ─── Unit badge ──────────────────────────────────────────────────────────────
const UnitBadge = ({ unit }: { unit: "Extrusion" | "Gravure" }) =>
  unit === "Extrusion"
    ? <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700">EXT</span>
    : <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-700">GRV</span>;

// ─── Page ────────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { unit: globalUnit } = useUnit();
  const [data, setData] = useState<CombinedOrder[]>([
    ...extOrders.map(fromExt),
    ...grvOrders.map(fromGrv),
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow]     = useState<CombinedOrder | null>(null);
  const [editing, setEditing]     = useState<CombinedOrder | null>(null);
  const [form, setForm]           = useState<Omit<CombinedOrder, "id" | "orderNo">>(blankExt());

  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const switchUnit = (u: "Extrusion" | "Gravure") =>
    setForm(u === "Extrusion" ? blankExt() : blankGrv());

  const displayData = globalUnit === "Both" ? data : data.filter(o => o.businessUnit === globalUnit);

  const openAdd = () => {
    const u = globalUnit === "Both" ? "Extrusion" : globalUnit;
    setEditing(null);
    setForm(u === "Extrusion" ? blankExt() : blankGrv());
    setModalOpen(true);
  };
  const openEdit = (row: CombinedOrder) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const save = () => {
    if (!form.customerName || !form.jobName) return;
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...form, id: editing.id, orderNo: editing.orderNo } : r));
    } else {
      const unitCode = UNIT_CODE[form.businessUnit];
      const orderNo = generateCode(unitCode, MODULE_CODE.Order, data.map(d => d.orderNo));
      const id = `${unitCode}OB${String(data.length + 1).padStart(3, "0")}`;
      setData(d => [...d, { ...form, id, orderNo }]);
    }
    setModalOpen(false);
  };

  const pending = Math.max(0, form.totalAmount - form.advancePaid);

  const extData = data.filter(o => o.businessUnit === "Extrusion");
  const grvData = data.filter(o => o.businessUnit === "Gravure");
  const totalRevenue = displayData.reduce((s, o) => s + o.totalAmount, 0);

  const columns: Column<CombinedOrder>[] = [
    { key: "orderNo",      header: "Order No",  sortable: true },
    { key: "date",         header: "Date",       sortable: true },
    { key: "businessUnit", header: "Unit",       render: r => <UnitBadge unit={r.businessUnit} /> },
    { key: "customerName", header: "Customer",   sortable: true },
    { key: "jobName",      header: "Job Name" },
    {
      key: "quantity", header: "Qty",
      render: r => <span>{r.quantity.toLocaleString()} {r.unit}</span>,
    },
    { key: "deliveryDate", header: "Delivery" },
    {
      key: "totalAmount", header: "Amount (₹)",
      render: r => <span className="font-semibold">₹{r.totalAmount.toLocaleString()}</span>,
    },
    { key: "status", header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Order Booking</h2>
          <p className="text-sm text-gray-500">
            {data.length} orders · ₹{totalRevenue.toLocaleString()} total
            &nbsp;·&nbsp;
            <span className="text-blue-600 font-medium">{extData.length} EXT</span>
            &nbsp;·&nbsp;
            <span className="text-purple-600 font-medium">{grvData.length} GRV</span>
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Order</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(["Confirmed", "In Production", "Ready", "Dispatched"] as const).map(s => {
          const colors: Record<string, string> = {
            Confirmed:       "bg-blue-50 text-blue-700 border-blue-200",
            "In Production": "bg-yellow-50 text-yellow-700 border-yellow-200",
            Ready:           "bg-purple-50 text-purple-700 border-purple-200",
            Dispatched:      "bg-green-50 text-green-700 border-green-200",
          };
          return (
            <div key={s} className={`rounded-xl border p-4 ${colors[s]}`}>
              <p className="text-xs font-medium">{s}</p>
              <p className="text-2xl font-bold mt-1">{displayData.filter(o => o.status === s).length}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={displayData}
          columns={columns}
          searchKeys={["orderNo", "customerName", "jobName"]}
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
        title={editing ? `Edit – ${editing.orderNo}` : "New Order"} size="xl">

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
          <Input label="Order Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />

          {/* Enquiry link — EXT uses enquiries, GRV uses gravureEnquiries */}
          {form.businessUnit === "Extrusion" ? (
            <Select label="From Enquiry" value={form.enquiryId}
              onChange={e => {
                const enq = enquiries.find(x => x.id === e.target.value);
                if (enq) {
                  f("enquiryId", enq.id); f("customerId", enq.customerId);
                  f("customerName", enq.customerName); f("productName", enq.productName);
                  f("quantity", enq.quantity); f("unit", enq.unit);
                } else { f("enquiryId", ""); }
              }}
              options={[{ value: "", label: "-- Direct Order --" },
                ...enquiries.filter(e => e.status !== "Rejected").map(e => ({ value: e.id, label: `${e.enquiryNo} – ${e.customerName}` }))]}
            />
          ) : (
            <Select label="From Enquiry (GRV)" value={form.enquiryId}
              onChange={e => {
                const enq = gravureEnquiries.find(x => x.id === e.target.value);
                if (enq) {
                  f("enquiryId", enq.id); f("customerId", enq.customerId);
                  f("customerName", enq.customerName); f("jobName", enq.jobName);
                  f("substrate", enq.substrate); f("width", enq.width);
                  f("noOfColors", enq.noOfColors); f("quantity", enq.quantity); f("unit", enq.unit);
                } else { f("enquiryId", ""); }
              }}
              options={[{ value: "", label: "-- Direct Order --" },
                ...gravureEnquiries.filter(e => e.status !== "Rejected").map(e => ({ value: e.id, label: `${e.enquiryNo} – ${e.customerName}` }))]}
            />
          )}

          {/* From Estimation — GRV only */}
          {form.businessUnit === "Gravure" && (
            <Select label="From Estimation (GRV)" value={form.estimationId}
              onChange={e => {
                const est = gravureEstimations.find(x => x.id === e.target.value);
                if (est) {
                  f("estimationId", est.id); f("customerId", est.customerId);
                  f("customerName", est.customerName); f("jobName", est.jobName);
                  f("substrate", est.substrateName); f("width", est.width);
                  f("noOfColors", est.noOfColors); f("quantity", est.quantity); f("unit", est.unit);
                  f("totalAmount", est.totalAmount);
                } else { f("estimationId", ""); }
              }}
              options={[{ value: "", label: "-- No Estimation --" },
                ...gravureEstimations.filter(e => e.status === "Approved" || e.status === "Accepted")
                  .map(e => ({ value: e.id, label: `${e.estimationNo} – ${e.customerName}` }))]}
            />
          )}

          <Select label="Customer *" value={form.customerId}
            onChange={e => { const c = customers.find(x => x.id === e.target.value); f("customerId", e.target.value); if (c) f("customerName", c.name); }}
            options={customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))}
          />
          <Input label="Job Name *" value={form.jobName} onChange={e => f("jobName", e.target.value)} placeholder="e.g. Parle Shrink Wrap Batch-1" />

          {/* EXT-specific */}
          {form.businessUnit === "Extrusion" && (
            <>
              <Select label="Recipe" value={form.recipeId}
                onChange={e => { const r = recipes.find(x => x.id === e.target.value); f("recipeId", e.target.value); if (r) f("recipeName", r.name); }}
                options={[{ value: "", label: "-- Select Recipe --" }, ...recipes.filter(r => r.status === "Active").map(r => ({ value: r.id, label: r.name }))]}
              />
              <Select label="Roll Master" value={form.rollMasterId}
                onChange={e => { const r = rollMasters.find(x => x.id === e.target.value); f("rollMasterId", e.target.value); if (r) f("rollName", r.name); }}
                options={[{ value: "", label: "-- Select Roll --" }, ...rollMasters.filter(r => r.status === "Active").map(r => ({ value: r.id, label: `${r.name} – ${r.width}mm/${r.micron}μ` }))]}
              />
            </>
          )}

          {/* GRV-specific */}
          {form.businessUnit === "Gravure" && (
            <>
              <Input label="Substrate" value={form.substrate} onChange={e => f("substrate", e.target.value)} placeholder="e.g. BOPP 20μ" />
              <Input label="Lamination Structure" value={form.structure} onChange={e => f("structure", e.target.value)} placeholder="e.g. BOPP 20μ + Dry Lam + CPP 30μ" />
              <Input label="Print Width (mm)" type="number" value={form.width} onChange={e => f("width", Number(e.target.value))} />
              <Input label="No. of Colors" type="number" value={form.noOfColors} onChange={e => f("noOfColors", Number(e.target.value))} />
              <Input label="Cylinder Set" value={form.cylinderSet} onChange={e => f("cylinderSet", e.target.value)} placeholder="e.g. CYL-P001" />
            </>
          )}

          <Input label="Quantity" type="number" value={form.quantity} onChange={e => f("quantity", Number(e.target.value))} />
          <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)}
            options={[{ value: "Kg", label: "Kg" }, { value: "Pcs", label: "Pcs" }, { value: "Roll", label: "Roll" }]} />
          <Input label="Delivery Date" type="date" value={form.deliveryDate} onChange={e => f("deliveryDate", e.target.value)} />
          <Select label="Status" value={form.status} onChange={e => f("status", e.target.value)}
            options={[
              { value: "Confirmed",     label: "Confirmed" },
              { value: "In Production", label: "In Production" },
              { value: "Ready",         label: "Ready for Dispatch" },
              { value: "Dispatched",    label: "Dispatched" },
            ]} />
          <Input label="Total Amount (₹)" type="number" value={form.totalAmount} onChange={e => f("totalAmount", Number(e.target.value))} />
          <Input label="Advance Paid (₹)" type="number" value={form.advancePaid} onChange={e => f("advancePaid", Number(e.target.value))} />
        </div>

        {form.totalAmount > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-gray-50 border rounded-xl p-3">
              <p className="text-xs text-gray-500">Total Amount</p>
              <p className="font-bold text-gray-800">₹{form.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">Advance Paid</p>
              <p className="font-bold text-green-700">₹{form.advancePaid.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">Balance Pending</p>
              <p className="font-bold text-red-600">₹{pending.toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Book Order"}</Button>
        </div>
      </Modal>

      {/* ── View Modal ─────────────────────────────────────────────────────── */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)}
          title={`Order – ${viewRow.orderNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <UnitBadge unit={viewRow.businessUnit} />
              <span className="text-xs text-gray-500">{viewRow.businessUnit} Unit</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ["Customer",      viewRow.customerName],
                ["Job Name",      viewRow.jobName],
                ["Quantity",      `${viewRow.quantity.toLocaleString()} ${viewRow.unit}`],
                ["Delivery Date", viewRow.deliveryDate || "—"],
                ["Status",        viewRow.status],
                ...(viewRow.businessUnit === "Extrusion"
                  ? [
                      ["Recipe",  viewRow.recipeName || "—"],
                      ["Roll",    viewRow.rollName   || "—"],
                    ]
                  : [
                      ["Substrate",  viewRow.substrate   || "—"],
                      ["Structure",  viewRow.structure   || "—"],
                      ["Width",      `${viewRow.width} mm`],
                      ["Colors",     `${viewRow.noOfColors} Colors`],
                      ["Cylinder",   viewRow.cylinderSet || "—"],
                    ]
                ),
              ].map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="bg-gray-50 border rounded-xl p-3">
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="font-bold">₹{viewRow.totalAmount.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Advance Paid</p>
                <p className="font-bold text-green-700">₹{viewRow.advancePaid.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Balance</p>
                <p className="font-bold text-red-600">₹{(viewRow.totalAmount - viewRow.advancePaid).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <Button icon={<ArrowRight size={14} />}>
              {viewRow.businessUnit === "Extrusion" ? "Generate Job Card" : "Create Work Order"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
