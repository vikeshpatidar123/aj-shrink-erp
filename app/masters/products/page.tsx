"use client";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { products as initData, Product } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

const blank: Omit<Product, "id"> = {
  code: "", name: "", category: "Extrusion",
  unit: "Kg", width: 0, thickness: 0, gsm: 0, status: "Active",
};

export default function ProductPage() {
  const [data, setData] = useState<Product[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, "id">>(blank);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (row: Product) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const save = () => {
    if (!form.name || !form.code) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id } : r));
    } else {
      const id = `P${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id }]);
    }
    setModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) setData((d) => d.filter((r) => r.id !== deleteId));
    setDeleteId(null);
  };

  const f = (k: keyof typeof form, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  const columns: Column<Product>[] = [
    { key: "code", header: "Code", sortable: true },
    { key: "name", header: "Product Name", sortable: true },
    { key: "category", header: "Category", sortable: true },
    { key: "unit", header: "Unit" },
    { key: "width", header: "Width (mm)" },
    { key: "thickness", header: "Thickness (μ)" },
    { key: "gsm", header: "GSM" },
    { key: "status", header: "Status", sortable: true, render: (r) => statusBadge(r.status) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Product Master</h2>
          <p className="text-sm text-gray-500">{data.length} products registered</p>
        </div>
        <Button variant="secondary" pill icon={<Plus size={16} />} onClick={openAdd}>Add Product</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data} columns={columns}
          searchKeys={["name", "code", "category"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <RowAction.Edit onClick={() => openEdit(row)} />
              <RowAction.Delete onClick={() => setDeleteId(row.id)} />
            </div>
          )}
        />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Product" : "Add Product"} size="md">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input label="Product Code *" value={form.code} onChange={(e) => f("code", e.target.value)} placeholder="e.g. PROD001" />
          <Input label="Product Name *" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="e.g. LLDPE Shrink Film" />
          <Select label="Category" value={form.category} onChange={(e) => f("category", e.target.value)}
            options={[{ value: "Extrusion", label: "Extrusion" }, { value: "Roto Printing", label: "Roto Printing" }, { value: "Both", label: "Both" }]} />
          <Select label="Unit" value={form.unit} onChange={(e) => f("unit", e.target.value)}
            options={[{ value: "Kg", label: "Kg" }, { value: "MT", label: "MT" }, { value: "m²", label: "m²" }]} />
          <Input label="Width (mm)" type="number" value={String(form.width)} onChange={(e) => f("width", Number(e.target.value))} />
          <Input label="Thickness (μ)" type="number" value={String(form.thickness)} onChange={(e) => f("thickness", Number(e.target.value))} />
          <Input label="GSM" type="number" value={String(form.gsm)} onChange={(e) => f("gsm", Number(e.target.value))} />
          <Select label="Status" value={form.status} onChange={(e) => f("status", e.target.value)}
            options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Save"}</Button>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Are you sure you want to delete this product?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
