"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Layers, Printer, Factory, Search } from "lucide-react";

type UnitType = "Production" | "Printing" | "Finishing" | "Quality" | "Utility";
type UnitStatus = "Active" | "Inactive";

interface ProductionUnit {
  id: string;
  unitName: string;
  unitType: UnitType;
  description: string;
  status: UnitStatus;
}

const INITIAL_DATA: ProductionUnit[] = [
  { id: "U001", unitName: "Extrusion",    unitType: "Production", description: "Film extrusion unit",           status: "Active"   },
  { id: "U002", unitName: "Rotogravure",  unitType: "Printing",   description: "Printing and finishing unit",   status: "Active"   },
  { id: "U003", unitName: "Slitting",     unitType: "Finishing",  description: "Film slitting and rewinding",   status: "Active"   },
  { id: "U004", unitName: "Quality Lab",  unitType: "Quality",    description: "Quality control and testing",   status: "Active"   },
  { id: "U005", unitName: "Compressor",   unitType: "Utility",    description: "Air and power utility unit",    status: "Inactive" },
];

const TYPE_COLORS: Record<UnitType, string> = {
  Production: "bg-blue-50 text-blue-700 border-blue-200",
  Printing:   "bg-violet-50 text-violet-700 border-violet-200",
  Finishing:  "bg-amber-50 text-amber-700 border-amber-200",
  Quality:    "bg-green-50 text-green-700 border-green-200",
  Utility:    "bg-gray-50 text-gray-600 border-gray-200",
};

const TYPE_ICONS: Record<UnitType, React.ReactNode> = {
  Production: <Layers size={11} />,
  Printing:   <Printer size={11} />,
  Finishing:  <Factory size={11} />,
  Quality:    <Factory size={11} />,
  Utility:    <Factory size={11} />,
};

const UNIT_TYPES: UnitType[] = ["Production", "Printing", "Finishing", "Quality", "Utility"];

const blank: Omit<ProductionUnit, "id"> = {
  unitName: "", unitType: "Production", description: "", status: "Active",
};

export default function UnitMasterPage() {
  const [data, setData]           = useState<ProductionUnit[]>(INITIAL_DATA);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<ProductionUnit | null>(null);
  const [form, setForm]           = useState<Omit<ProductionUnit, "id">>(blank);
  const [deleteTarget, setDeleteTarget] = useState<ProductionUnit | null>(null);
  const [search, setSearch] = useState("");

  const filtered = data.filter((r) =>
    !search ||
    r.unitName.toLowerCase().includes(search.toLowerCase()) ||
    r.unitType.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  );

  const f = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const openAdd = () => {
    setEditing(null);
    setForm(blank);
    setModalOpen(true);
  };
  const openEdit = (row: ProductionUnit) => {
    setEditing(row);
    setForm({ unitName: row.unitName, unitType: row.unitType, description: row.description, status: row.status });
    setModalOpen(true);
  };

  const save = () => {
    if (!form.unitName.trim()) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id } : r));
    } else {
      const id = `U${String(data.length + 1).padStart(3, "0")}`;
      setData((d) => [...d, { ...form, id }]);
    }
    setModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteTarget) setData((d) => d.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const activeCount   = data.filter((u) => u.status === "Active").length;
  const inactiveCount = data.filter((u) => u.status === "Inactive").length;

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Unit Master</h2>
          <p className="text-sm text-gray-500">Manage factory production units</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Plus size={16} /> Add Unit
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-800">{data.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Units</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-green-700">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-red-600">{inactiveCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Inactive</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-blue-700">{UNIT_TYPES.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Unit Types</p>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search units..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm outline-none placeholder-gray-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Description</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {row.id}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-gray-800">{row.unitName}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${TYPE_COLORS[row.unitType]}`}>
                      {TYPE_ICONS[row.unitType]} {row.unitType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs hidden md:table-cell max-w-xs truncate">
                    {row.description}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full
                      ${row.status === "Active"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-gray-100 text-gray-500 border border-gray-200"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${row.status === "Active" ? "bg-green-500" : "bg-gray-400"}`} />
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                    No units found. Click <strong>Add Unit</strong> to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800">
                {editing ? "Edit Unit" : "Add Unit"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Unit Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Unit Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.unitName}
                  onChange={(e) => f("unitName", e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Extrusion"
                />
              </div>
              {/* Unit Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Unit Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.unitType}
                  onChange={(e) => f("unitType", e.target.value as UnitType)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {UNIT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => f("description", e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of this unit"
                />
              </div>
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Status
                </label>
                <div className="flex gap-3">
                  {(["Active", "Inactive"] as UnitStatus[]).map((s) => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={form.status === s}
                        onChange={() => f("status", s)}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-gray-700">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!form.unitName.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {editing ? "Update Unit" : "Save Unit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800">Confirm Delete</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete unit{" "}
                <span className="font-semibold text-gray-800">{deleteTarget.unitName}</span>?
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
