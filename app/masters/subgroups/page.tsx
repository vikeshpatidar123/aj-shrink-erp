"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/itemmaster`;

function unwrap(v: any): any {
  let r = v;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

// ── Shared UI ──────────────────────────────────────────────────────────────────
const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{title}</h3>
);
const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";
const ic = (err?: boolean) => err ? inputCls.replace("border-gray-300", "border-red-400 bg-red-50/50") : inputCls;

// ── Types ──────────────────────────────────────────────────────────────────────
type SubGroupRow = {
  id: string;
  ItemSubGroupUniqueID: string;
  ItemSubGroupID: string;
  ItemSubGroupName: string;
  ItemSubGroupDisplayName: string;
  UnderSubGroupID: string;
  ItemSubGroupLevel: string;
  GroupName: string;
};

type UnderGroup = {
  ItemGroupID: string;
  ItemGroupName: string;
};

type FormState = {
  ItemSubGroupName: string;
  ItemSubGroupDisplayName: string;
  UnderSubGroupID: string;
};

const blank = (): FormState => ({
  ItemSubGroupName: "",
  ItemSubGroupDisplayName: "",
  UnderSubGroupID: "",
});

// ── Page ───────────────────────────────────────────────────────────────────────
export default function SubGroupPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<SubGroupRow[]>([]);
  const [underGroups, setUnderGroups] = useState<UnderGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<SubGroupRow | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [filterGroup, setFilterGroup] = useState("All");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [companyName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("companyName") || "Sub Group Master" : "Sub Group Master"
  );

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  // ── Loaders ───────────────────────────────────────────────────────────────────
  const loadList = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}/group`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setData(Array.isArray(raw) ? raw.map((r: any) => ({ ...r, id: String(r.ItemSubGroupUniqueID) })) : []);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadList();
    // Load parent groups dropdown from ItemGroupMaster
    fetch(`${BASE_URL}/api/itemgroupmaster/list`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setUnderGroups(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setUnderGroups([]));
  }, [loadList]);

  // ── Open add ──────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setError("");
    setForm(blank());
    setView("form");
  };

  // ── Open edit ─────────────────────────────────────────────────────────────────
  const openEdit = (row: SubGroupRow) => {
    setEditing(row);
    setError("");
    setForm({
      ItemSubGroupName: String(row.ItemSubGroupName ?? ""),
      ItemSubGroupDisplayName: String(row.ItemSubGroupDisplayName ?? ""),
      UnderSubGroupID: String(row.UnderSubGroupID ?? ""),
    });
    setView("form");
  };

  // ── Save ──────────────────────────────────────────────────────────────────────
  const saveGroup = async () => {
    setSubmitAttempted(true);
    if (!String(form.ItemSubGroupName ?? "").trim()) { setError("Sub Group Name is required."); return; }
    if (!String(form.ItemSubGroupDisplayName ?? "").trim()) { setError("Display Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      let res: Response;
      if (editing) {
        res = await fetch(`${BASE}/update-group`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            CostingDataGroupMaster: [{
              ItemSubGroupName: form.ItemSubGroupName,
              ItemSubGroupDisplayName: form.ItemSubGroupDisplayName,
              UnderSubGroupID: form.UnderSubGroupID || null,
            }],
            ItemSubGroupUniqueID: String(editing.ItemSubGroupUniqueID),
            ItemSubGroupLevel: String(editing.ItemSubGroupLevel ?? "1"),
            GroupName: form.ItemSubGroupName,
          }),
        });
      } else {
        res = await fetch(`${BASE}/save-group`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            CostingDataGroupMaster: [{
              ItemSubGroupName: form.ItemSubGroupName,
              ItemSubGroupDisplayName: form.ItemSubGroupDisplayName,
              UnderSubGroupID: form.UnderSubGroupID || null,
            }],
            GroupName: form.ItemSubGroupName,
            UnderGroupID: "",
            ItemGroupID: form.UnderSubGroupID || "",
          }),
        });
      }
      const result = unwrap(await res.text());
      if (result === "Success") {
        loadList();
        // Refresh under-groups dropdown too
        fetch(`${BASE_URL}/api/itemgroupmaster/list`, { headers: authHeaders() })
          .then(r => r.text())
          .then(text => { const raw = unwrap(text); setUnderGroups(Array.isArray(raw) ? raw : []); })
          .catch(() => {});
        setView("list");
      } else if (result === "Exist") {
        setError("A sub group with this name already exists.");
      } else {
        setError("Save failed: " + result);
      }
    } catch (e: any) {
      setError("Error: " + e.message);
    }
    setSaving(false);
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleteGroup = async (row: SubGroupRow) => {
    if (!confirm("Delete this sub group?")) return;
    try {
      const res = await fetch(`${BASE}/delete-group`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ItemSubGroupUniqueID: String(row.ItemSubGroupUniqueID) }),
      });
      const result = unwrap(await res.text());
      if (result === "Success") loadList();
      else alert(result || "Delete failed.");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const getGroupName = (r: SubGroupRow) => {
    const grp = underGroups.find(g => String(g.ItemGroupID) === String(r.UnderSubGroupID));
    return grp?.ItemGroupName || r.GroupName || "";
  };

  const uniqueGroups = useMemo(() =>
    ["All", ...new Set(data.map(r => getGroupName(r)).filter(Boolean))],
    [data, underGroups]);

  const filtered = useMemo(() =>
    filterGroup === "All" ? data : data.filter(r => getGroupName(r) === filterGroup),
    [data, filterGroup, underGroups]);

  // ── FORM VIEW ─────────────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{companyName}</p>
            <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit Sub Group" : "New Sub Group"}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <List size={16} /> Back to List
            </button>
            <button onClick={saveGroup} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save Sub Group
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tab bar */}
          <div className="px-6 pt-5 pb-0 border-b border-gray-200 bg-gray-50/30">
            {editing && (
              <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                ID: {editing.ItemSubGroupUniqueID} &nbsp;·&nbsp; Level: {editing.ItemSubGroupLevel}
              </span>
            )}
            <div className="flex gap-8">
              <button className="pb-3 text-sm font-medium border-b-2 text-blue-600 border-blue-600">
                Sub Group Details
              </button>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div>
              <SectionTitle title="Sub Group Identity" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Sub Group Name" required>
                  <input type="text" value={form.ItemSubGroupName}
                    onChange={e => {
                      f("ItemSubGroupName", e.target.value);
                      // Auto-fill display name if not manually set
                      if (!editing) f("ItemSubGroupDisplayName", e.target.value);
                    }}
                    placeholder="e.g. PET Film Plain" className={ic(submitAttempted && !form.ItemSubGroupName.trim())} />
                </Field>
                <Field label="Display Name" required>
                  <input type="text" value={form.ItemSubGroupDisplayName}
                    onChange={e => f("ItemSubGroupDisplayName", e.target.value)}
                    placeholder="e.g. PET Film (Plain / Treated)" className={ic(submitAttempted && !form.ItemSubGroupDisplayName.trim())} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Under Group (Parent)">
                    <select value={form.UnderSubGroupID}
                      onChange={e => f("UnderSubGroupID", e.target.value)}
                      className={inputCls}>
                      <option value="">— Select Group —</option>
                      {underGroups.map(g => (
                        <option key={g.ItemGroupID} value={String(g.ItemGroupID)}>
                          {g.ItemGroupName}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  const columns: Column<SubGroupRow>[] = [
    { key: "ItemSubGroupID", header: "Group ID", sortable: true },
    { key: "ItemSubGroupName", header: "Sub Group Name", sortable: true },
    { key: "ItemSubGroupDisplayName", header: "Display Name" },
    {
      key: "GroupName", header: "Under Group",
      render: r => {
        const grp = underGroups.find(g => String(g.ItemGroupID) === String(r.UnderSubGroupID));
        const name = grp?.ItemGroupName || r.GroupName;
        return name
          ? <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{name}</span>
          : <span className="text-gray-400">— Top Level —</span>;
      },
    },
    {
      key: "ItemSubGroupLevel", header: "Level",
      render: r => <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-600">{r.ItemSubGroupLevel || "—"}</span>,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Sub Group Master</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${filtered.length} of ${data.length} sub groups`}
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Sub Group
        </button>
      </div>

      {/* Parent group filter pills */}
      {uniqueGroups.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Under Group</span>
            {uniqueGroups.map(g => (
              <button key={g} onClick={() => setFilterGroup(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterGroup === g ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {g === "All" ? "All Groups" : g}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={filtered}
          columns={columns}
          searchKeys={["ItemSubGroupName", "ItemSubGroupDisplayName", "GroupName"]}
          actions={row => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteGroup(row)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
