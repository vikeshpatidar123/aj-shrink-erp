"use client";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, PackageMinus } from "lucide-react";
import { gravureItemIssues as initData, gravureWorkOrders, GravureItemIssue, GravureItemIssueItem } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

const ITEM_TYPES = ["Substrate", "Ink", "Adhesive", "Solvent", "Chemical", "Other"] as const;
const COMMON_UNITS = ["Kg", "Ltr", "Meter", "Pcs", "Nos"];

const blankItem: GravureItemIssueItem = {
  itemId: "", itemName: "", itemType: "Substrate",
  requiredQty: 0, issuedQty: 0, unit: "Kg",
};

const blank: Omit<GravureItemIssue, "id" | "issueNo"> = {
  date: new Date().toISOString().slice(0, 10),
  workOrderId: "", workOrderNo: "",
  customerName: "", jobName: "",
  items: [],
  issuedBy: "",
  status: "Pending",
};

const typeColors: Record<string, string> = {
  Substrate: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Ink:       "bg-blue-50 text-blue-700 border-blue-200",
  Adhesive:  "bg-orange-50 text-orange-700 border-orange-200",
  Solvent:   "bg-purple-50 text-purple-700 border-purple-200",
  Chemical:  "bg-red-50 text-red-600 border-red-200",
  Other:     "bg-gray-100 text-gray-600 border-gray-200",
};

const issueStatusColors: Record<string, string> = {
  Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Partial: "bg-orange-50 text-orange-700 border-orange-200",
  Issued:  "bg-green-50 text-green-700 border-green-200",
};

export default function GravureItemIssuePage() {
  const [data, setData]         = useState<GravureItemIssue[]>(initData);
  const [modalOpen, setModal]   = useState(false);
  const [viewRow, setViewRow]   = useState<GravureItemIssue | null>(null);
  const [editing, setEditing]   = useState<GravureItemIssue | null>(null);
  const [form, setForm]         = useState<Omit<GravureItemIssue, "id" | "issueNo">>(blank);

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const openAdd  = () => { setEditing(null); setForm({ ...blank, items: [] }); setModal(true); };
  const openEdit = (row: GravureItemIssue) => { setEditing(row); setForm({ ...row }); setModal(true); };

  const addItem    = () => setForm(p => ({ ...p, items: [...p.items, { ...blankItem }] }));
  const removeItem = (i: number) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, key: keyof GravureItemIssueItem, val: string | number) =>
    setForm(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { ...item, [key]: val } : item) }));

  const save = () => {
    if (!form.workOrderId || form.items.length === 0) return;
    const allIssued  = form.items.every(i => i.issuedQty >= i.requiredQty);
    const anyIssued  = form.items.some(i => i.issuedQty > 0);
    const status: GravureItemIssue["status"] = allIssued ? "Issued" : anyIssued ? "Partial" : "Pending";
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...form, status, id: editing.id, issueNo: editing.issueNo } : r));
    } else {
      const n = data.length + 1;
      setData(d => [...d, { ...form, status, id: `GII${String(n + 2).padStart(3, "0")}`, issueNo: `GRV-ISS-2024-${String(n + 2).padStart(3, "0")}` }]);
    }
    setModal(false);
  };

  const columns: Column<GravureItemIssue>[] = [
    { key: "issueNo",      header: "Issue No",   sortable: true },
    { key: "date",         header: "Date",        sortable: true },
    { key: "workOrderNo",  header: "Work Order" },
    { key: "customerName", header: "Customer",    sortable: true },
    { key: "jobName",      header: "Job Name" },
    { key: "items", header: "Items", render: r => (
      <div className="flex flex-wrap gap-1">
        {[...new Set(r.items.map(i => i.itemType))].map(t => (
          <span key={t} className={`px-2 py-0.5 rounded-full text-xs font-medium border ${typeColors[t]}`}>{t}</span>
        ))}
      </div>
    )},
    { key: "issuedBy", header: "Issued By" },
    { key: "status",   header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <PackageMinus size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Item Issue</h2>
          </div>
          <p className="text-sm text-gray-500">Issue substrates, inks, adhesives & solvents for gravure work orders</p>
        </div>
        <Button variant="secondary" pill icon={<Plus size={16} />} onClick={openAdd}>New Issue</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Issues", val: data.length,                                    cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Pending",      val: data.filter(d => d.status === "Pending").length, cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { label: "Partial",      val: data.filter(d => d.status === "Partial").length, cls: "bg-orange-50 text-orange-700 border-orange-200" },
          { label: "Issued",       val: data.filter(d => d.status === "Issued").length,  cls: "bg-green-50 text-green-700 border-green-200" },
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
          searchKeys={["issueNo", "customerName", "jobName", "workOrderNo"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <RowAction.View onClick={() => setViewRow(row)} />
              <RowAction.Edit onClick={() => openEdit(row)} />
              <RowAction.Delete onClick={() => setData(d => d.filter(r => r.id !== row.id))} />
            </div>
          )}
        />
      </div>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModal(false)} title={editing ? "Edit Item Issue" : "New Item Issue"} size="xl">
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
            <Select
              label="Work Order *"
              value={form.workOrderId}
              onChange={e => {
                const wo = gravureWorkOrders.find(x => x.id === e.target.value);
                if (wo) {
                  f("workOrderId", wo.id); f("workOrderNo", wo.workOrderNo);
                  f("customerName", wo.customerName); f("jobName", wo.jobName);
                }
              }}
              options={[{ value: "", label: "-- Select Work Order --" }, ...gravureWorkOrders.filter(w => w.status !== "Completed").map(w => ({ value: w.id, label: `${w.workOrderNo} – ${w.customerName}` }))]}
            />
            <Input label="Customer" value={form.customerName} readOnly className="bg-gray-50" />
            <Input label="Job Name"  value={form.jobName}      readOnly className="bg-gray-50" />
            <Input label="Issued By" value={form.issuedBy} onChange={e => f("issuedBy", e.target.value)} placeholder="Operator / Store Keeper name" />
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Items to Issue</p>
              <button onClick={addItem} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <Plus size={12} /> Add Item
              </button>
            </div>

            {form.items.length > 0 ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase">
                    <tr>
                      {["Item Name", "Type", "Req Qty", "Issued Qty", "Unit", ""].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.items.map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <input value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} className="w-full text-xs text-gray-900 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400 min-w-[150px]" placeholder="Item name" />
                        </td>
                        <td className="px-3 py-2 w-32">
                          <select value={item.itemType} onChange={e => updateItem(i, "itemType", e.target.value)} className="w-full text-xs text-gray-900 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400">
                            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 w-24">
                          <input type="number" value={item.requiredQty} onChange={e => updateItem(i, "requiredQty", Number(e.target.value))} className="w-full text-xs text-gray-900 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400 text-right" />
                        </td>
                        <td className="px-3 py-2 w-24">
                          <input type="number" value={item.issuedQty} onChange={e => updateItem(i, "issuedQty", Number(e.target.value))} className={`w-full text-xs border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400 text-right ${item.issuedQty >= item.requiredQty ? "text-green-700 font-semibold" : item.issuedQty > 0 ? "text-orange-600 font-semibold" : "text-gray-900"}`} />
                        </td>
                        <td className="px-3 py-2 w-20">
                          <select value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="w-full text-xs text-gray-900 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400">
                            {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 w-10 text-center">
                          <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-base">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-8 text-center text-sm text-gray-400">
                Click "Add Item" to add substrates, inks, adhesives or solvents to issue.
              </div>
            )}
          </div>

          {/* Live Status */}
          {form.items.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Total Items</p>
                <p className="text-lg font-bold text-blue-700">{form.items.length}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Fully Issued</p>
                <p className="text-lg font-bold text-green-700">{form.items.filter(i => i.issuedQty >= i.requiredQty && i.requiredQty > 0).length}</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Pending</p>
                <p className="text-lg font-bold text-orange-600">{form.items.filter(i => i.issuedQty < i.requiredQty).length}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Save Issue"}</Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Item Issue – ${viewRow.issueNo}`} size="xl">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              {([
                ["Date",       viewRow.date],
                ["Work Order", viewRow.workOrderNo],
                ["Customer",   viewRow.customerName],
                ["Job Name",   viewRow.jobName],
                ["Issued By",  viewRow.issuedBy || "—"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
              ))}
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${issueStatusColors[viewRow.status]}`}>{viewRow.status}</span>
              </div>
            </div>

            {/* Items */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <p className="text-xs font-bold text-gray-600 uppercase">Items</p>
              </div>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    {["Item Name", "Type", "Required", "Issued", "Status"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {viewRow.items.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{item.itemName}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${typeColors[item.itemType]}`}>{item.itemType}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{item.requiredQty} {item.unit}</td>
                      <td className={`px-4 py-2.5 font-semibold ${item.issuedQty >= item.requiredQty ? "text-green-600" : item.issuedQty > 0 ? "text-orange-600" : "text-red-500"}`}>
                        {item.issuedQty} {item.unit}
                      </td>
                      <td className="px-4 py-2.5">
                        {item.issuedQty >= item.requiredQty ? (
                          <span className="text-xs text-green-600 font-semibold">✓ Issued</span>
                        ) : item.issuedQty > 0 ? (
                          <span className="text-xs text-orange-600 font-semibold">Partial</span>
                        ) : (
                          <span className="text-xs text-red-500">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
