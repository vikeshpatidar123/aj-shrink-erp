"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, List, Check } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = "https://api.indusanalytics.co.in";
const CATEGORIES = ["Raw Material (RM)", "Consumables", "Finished Goods (FG)"];

function unwrap(r: unknown): unknown {
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

interface ItemGroup {
  id: string;
  ItemGroupID: number;
  ItemGroupName: string;
  TabName: string;
  Description: string;
  ItemGroupPrefix: string;
  GridColumnName: string;
  GridColumnHide: string;
  ItemNameFormula: string;
  ItemDescriptionFormula: string;
  ItemConsumptionFormula: string;
  AllowIssueExtraQuantity: number;
  SelectQuery: string;
  Status: string;
}

const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">
    {title}
  </h3>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";

const blank = {
  TabName: "Raw Material (RM)",
  ItemGroupName: "",
  Description: "",
  ItemGroupPrefix: "",
  Status: "Active",
};

export default function ItemGroupPage() {
  const [view, setView]               = useState<"list" | "form">("list");
  const [data, setData]               = useState<ItemGroup[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [editing, setEditing]         = useState<ItemGroup | null>(null);
  const [form, setForm]               = useState(blank);
  const [filterCategory, setFilterCategory] = useState<string>("All");

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/itemgroupmaster/list`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      const parsed = unwrap(await res.text()) as Omit<ItemGroup, "id">[];
      setData(parsed.map((item) => ({ ...item, id: String(item.ItemGroupID) })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openAdd = () => { setEditing(null); setForm(blank); setView("form"); };

  const openEdit = (row: ItemGroup) => {
    setEditing(row);
    setForm({
      TabName:         row.TabName,
      ItemGroupName:   row.ItemGroupName,
      Description:     row.Description,
      ItemGroupPrefix: row.ItemGroupPrefix,
      Status:          row.Status,
    });
    setView("form");
  };

  const save = async () => {
    if (!form.ItemGroupName.trim() || !form.TabName) return;
    setSaving(true);
    try {
      const url  = editing ? `${BASE_URL}/api/itemgroupmaster/update` : `${BASE_URL}/api/itemgroupmaster/save`;
      const body = {
        ...(editing ? { ItemGroupID: editing.ItemGroupID } : {}),
        ItemGroupName:   form.ItemGroupName,
        TabName:         form.TabName,
        Description:     form.Description,
        ItemGroupPrefix: form.ItemGroupPrefix,
        IsActive:        form.Status === "Active" ? "1" : "0",
      };

      const res = await fetch(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const result = unwrap(await res.text());
      if (!res.ok || result !== "Success") throw new Error("Save failed");
      await fetchList();
      setView("list");
    } catch (e) {
      console.error(e);
      alert("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (row: ItemGroup) => {
    if (!confirm(`Delete "${row.ItemGroupName}"?`)) return;
    try {
      const res = await fetch(`${BASE_URL}/api/itemgroupmaster/delete`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ ItemGroupID: row.ItemGroupID }),
      });
      const result = unwrap(await res.text());
      if (!res.ok || result !== "Success") throw new Error("Delete failed");
      await fetchList();
    } catch (e) {
      console.error(e);
      alert("Delete failed. Please try again.");
    }
  };

  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const columns: Column<ItemGroup>[] = [
    { key: "ItemGroupName", header: "Group Name", sortable: true },
    { key: "ItemGroupPrefix", header: "Prefix", render: (r) => (
      <span className="font-mono font-bold text-blue-600 text-sm">{r.ItemGroupPrefix || "—"}</span>
    )},
    { key: "TabName", header: "Category", sortable: true, render: (r) => (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
        r.TabName === "Raw Material (RM)" ? "bg-blue-50 text-blue-700" :
        r.TabName === "Consumables"       ? "bg-amber-50 text-amber-700" :
        "bg-emerald-50 text-emerald-700"
      }`}>{r.TabName}</span>
    )},
    { key: "Description", header: "Description", render: (r) => (
      <span className="text-gray-500 text-xs">{r.Description || "—"}</span>
    )},
    { key: "Status", header: "Status", render: (r) => (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${r.Status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        {r.Status}
      </span>
    )},
  ];

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-2xl mx-auto pb-10">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
            <h2 className="text-xl font-bold text-gray-800">Item Group Master</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <List size={16} /> List ({data.length})
            </button>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
              <Plus size={16} /> New
            </button>
            <button onClick={save} disabled={saving || !form.ItemGroupName.trim()} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60">
              <Save size={16} /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Category Pills */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-200 bg-gray-50/30">
            {editing && (
              <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                Editing: {editing.ItemGroupName}
              </span>
            )}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => f("TabName", cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    form.TabName === cat
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div>
              <SectionTitle title="Group Details" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <Field label="Group Name" required>
                    <input
                      type="text"
                      value={form.ItemGroupName}
                      onChange={(e) => f("ItemGroupName", e.target.value)}
                      placeholder="e.g. Ink, Varnish, Film, Adhesive..."
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="Prefix">
                  <input
                    type="text"
                    value={form.ItemGroupPrefix}
                    onChange={(e) => f("ItemGroupPrefix", e.target.value.toUpperCase().slice(0, 5))}
                    placeholder="e.g. I"
                    maxLength={5}
                    className={`${inputCls} font-mono uppercase tracking-widest`}
                  />
                </Field>
              </div>
              <div className="mt-6">
                <Field label="Description">
                  <textarea
                    value={form.Description}
                    onChange={(e) => f("Description", e.target.value)}
                    placeholder="What type of items belong to this group..."
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </Field>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => f("Status", form.Status === "Active" ? "Inactive" : "Active")}
                className={`w-12 h-6 rounded-full transition-colors relative ${form.Status === "Active" ? "bg-blue-500" : "bg-gray-300"}`}
              >
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${form.Status === "Active" ? "left-7" : "left-1"}`} />
              </button>
              <span className="text-sm font-medium text-gray-700">Active Group</span>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Clear
              </button>
              <button onClick={save} disabled={saving || !form.ItemGroupName.trim()} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60">
                <Check size={16} /> {saving ? "Saving..." : "Save Group"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  const filterCategories = ["All", ...CATEGORIES];
  const filteredData = filterCategory === "All" ? data : data.filter((r) => r.TabName === filterCategory);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Item Group Master</h2>
          <p className="text-sm text-gray-500">{filteredData.length} of {data.length} groups</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Group
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Category</span>
          {filterCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterCategory === cat
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat === "All" ? "All Categories" : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        {loading ? (
          <div className="text-center py-10 text-sm text-gray-400">Loading...</div>
        ) : (
          <DataTable
            data={filteredData}
            columns={columns}
            searchKeys={["ItemGroupName", "TabName", "Description", "ItemGroupPrefix"]}
            actions={(row) => (
              <div className="flex items-center gap-2 justify-end">
                <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteRow(row)}>Delete</Button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
