"use client";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { subGroups as initData, SubGroup } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

const blank: Omit<SubGroup, "id"> = { name: "", category: "Polymer", group: "", description: "" };

const categoryOptions = [
  { value: "Polymer", label: "Polymer" },
  { value: "Ink", label: "Ink" },
  { value: "Chemical", label: "Chemical" },
  { value: "Additive", label: "Additive" },
  { value: "Packing Material", label: "Packing Material" },
];

export default function GroupPage() {
  const [data, setData] = useState<SubGroup[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubGroup | null>(null);
  const [form, setForm] = useState<Omit<SubGroup, "id">>(blank);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (row: SubGroup) => { setEditing(row); setForm({ ...row }); setModalOpen(true); };

  const save = () => {
    if (!form.name) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id } : r));
    } else {
      const id = `SG${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id }]);
    }
    setModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) setData((d) => d.filter((r) => r.id !== deleteId));
    setDeleteId(null);
  };

  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const columns: Column<SubGroup>[] = [
    { key: "id", header: "Code", sortable: true },
    { key: "name", header: "SubGroup Name", sortable: true },
    { key: "category", header: "Category", sortable: true },
    { key: "description", header: "Description" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">SubGroup Master</h2>
          <p className="text-sm text-gray-500">{data.length} subgroups registered</p>
        </div>
        <Button variant="secondary" pill icon={<Plus size={16} />} onClick={openAdd}>Add SubGroup</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data} columns={columns}
          searchKeys={["name", "category"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <RowAction.Edit onClick={() => openEdit(row)} />
              <RowAction.Delete onClick={() => setDeleteId(row.id)} />
            </div>
          )}
        />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit SubGroup" : "Add SubGroup"} size="md">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input label="SubGroup Name *" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="e.g. LLDPE Grade" />
          <Select label="Category" value={form.category} onChange={(e) => f("category", e.target.value)} options={categoryOptions} />
          <div className="sm:col-span-2">
            <Input label="Description" value={form.description} onChange={(e) => f("description", e.target.value)} placeholder="Optional description" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Save"}</Button>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Are you sure you want to delete this subgroup?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
