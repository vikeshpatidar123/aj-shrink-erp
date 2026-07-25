"use client";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { rollMasters as initData, RollMaster } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

const blank: Omit<RollMaster, "id"> = {
  code: "", name: "", width: 0, thickness: 0,
  density: 0, micron: 0, stockUnit: "Kg",
  purchaseUnit: "Roll", description: "", status: "Active",
};

export default function RollPage() {
  const [data, setData] = useState<RollMaster[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RollMaster | null>(null);
  const [form, setForm] = useState<Omit<RollMaster, "id">>(blank);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (row: RollMaster) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const save = () => {
    if (!form.name || !form.code) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id } : r));
    } else {
      const id = `RL${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id }]);
    }
    setModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) setData((d) => d.filter((r) => r.id !== deleteId));
    setDeleteId(null);
  };

  const f = (k: keyof typeof form, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  const columns: Column<RollMaster>[] = [
    { key: "code", header: "Code", sortable: true },
    { key: "name", header: "Roll Name", sortable: true },
    { key: "width", header: "Width (mm)" },
    { key: "micron", header: "Micron (μ)" },
    { key: "thickness", header: "Thickness" },
    { key: "density", header: "Density" },
    { key: "stockUnit", header: "Stock Unit" },
    { key: "status", header: "Status", sortable: true, render: (r) => statusBadge(r.status) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Roll Master</h2>
          <p className="text-sm text-gray-500">{data.length} rolls registered</p>
        </div>
        <Button variant="secondary" pill icon={<Plus size={16} />} onClick={openAdd}>Add Roll</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data} columns={columns}
          searchKeys={["name", "code"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <RowAction.Edit onClick={() => openEdit(row)} />
              <RowAction.Delete onClick={() => setDeleteId(row.id)} />
            </div>
          )}
        />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Roll" : "Add Roll"} size="md">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input label="Code *" value={form.code} onChange={(e) => f("code", e.target.value)} placeholder="e.g. RL001" />
          <Input label="Roll Name *" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="e.g. PE Shrink Roll 400mm" />
          <Input label="Width (mm)" type="number" value={String(form.width)} onChange={(e) => f("width", Number(e.target.value))} />
          <Input label="Micron (μ)" type="number" value={String(form.micron)} onChange={(e) => f("micron", Number(e.target.value))} />
          <Input label="Thickness" type="number" value={String(form.thickness)} onChange={(e) => f("thickness", Number(e.target.value))} />
          <Input label="Density" type="number" value={String(form.density)} onChange={(e) => f("density", Number(e.target.value))} />
          <Select label="Stock Unit" value={form.stockUnit} onChange={(e) => f("stockUnit", e.target.value)}
            options={[{ value: "Kg", label: "Kg" }, { value: "Roll", label: "Roll" }]} />
          <Select label="Purchase Unit" value={form.purchaseUnit} onChange={(e) => f("purchaseUnit", e.target.value)}
            options={[{ value: "Roll", label: "Roll" }, { value: "Kg", label: "Kg" }]} />
          <div className="sm:col-span-2">
            <Input label="Description" value={form.description} onChange={(e) => f("description", e.target.value)} placeholder="Brief description" />
          </div>
          <Select label="Status" value={form.status} onChange={(e) => f("status", e.target.value)}
            options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Save"}</Button>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Are you sure you want to delete this roll?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
