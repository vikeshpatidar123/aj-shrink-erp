"use client";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { customers as initData, Customer } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

const blank: Omit<Customer, "id"> = {
  code: "", name: "", contact: "", phone: "", email: "",
  city: "", state: "", gst: "", status: "Active", createdAt: new Date().toISOString().slice(0, 10),
};

const stateOptions = [
  { value: "Maharashtra", label: "Maharashtra" },
  { value: "Gujarat", label: "Gujarat" },
  { value: "Karnataka", label: "Karnataka" },
  { value: "Delhi", label: "Delhi" },
  { value: "West Bengal", label: "West Bengal" },
  { value: "Uttar Pradesh", label: "Uttar Pradesh" },
  { value: "Tamil Nadu", label: "Tamil Nadu" },
  { value: "Rajasthan", label: "Rajasthan" },
];

export default function CustomersPage() {
  const [data, setData] = useState<Customer[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Omit<Customer, "id">>(blank);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (row: Customer) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const save = () => {
    if (!form.name || !form.phone) return;
    if (editing) {
      setData((d) => d.map((r) => (r.id === editing.id ? { ...form, id: editing.id } : r)));
    } else {
      const id = `C${String(data.length + 1).padStart(3, "0")}`;
      const code = `CUST${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id, code }]);
    }
    setModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) setData((d) => d.filter((r) => r.id !== deleteId));
    setDeleteId(null);
  };

  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const columns: Column<Customer>[] = [
    { key: "code", header: "Code", sortable: true },
    { key: "name", header: "Customer Name", sortable: true },
    { key: "contact", header: "Contact Person" },
    { key: "phone", header: "Phone" },
    { key: "city", header: "City", sortable: true },
    { key: "state", header: "State", sortable: true },
    { key: "gst", header: "GST No" },
    { key: "status", header: "Status", render: (r) => statusBadge(r.status), sortable: true },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Customer Master</h2>
          <p className="text-sm text-gray-500">{data.length} customers registered</p>
        </div>
        <Button variant="secondary" pill icon={<Plus size={16} />} onClick={openAdd}>Add Customer</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["name", "code", "city", "phone"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <RowAction.Edit onClick={() => openEdit(row)} />
              <RowAction.Delete onClick={() => setDeleteId(row.id)} />
            </div>
          )}
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Customer" : "Add Customer"} size="lg">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input label="Customer Name *" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="Enter name" />
          <Input label="Contact Person" value={form.contact} onChange={(e) => f("contact", e.target.value)} placeholder="Contact name" />
          <Input label="Phone *" value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="10-digit mobile" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => f("email", e.target.value)} placeholder="email@example.com" />
          <Input label="City" value={form.city} onChange={(e) => f("city", e.target.value)} placeholder="City" />
          <Select label="State" value={form.state} onChange={(e) => f("state", e.target.value)} options={stateOptions} />
          <Input label="GST Number" value={form.gst} onChange={(e) => f("gst", e.target.value)} placeholder="15-digit GSTIN" />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => f("status", e.target.value)}
            options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Save"}</Button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Are you sure you want to delete this customer? This action cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
