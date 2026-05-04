"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/itemmasterShrink`;

function unwrap(v: any): any {
  let r = v;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

// â"€â"€ Shared UI â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// â"€â"€ Types â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

type SubGroupSpec = {
  ItemSubGroupUniqueID: string;
  ItemGroupID: string;
  GroupName: string;
  SubGroupName: string;
  SubGroupType: string;
  TypeSpecification: string;
  SubGroupTypePrefix: string;
  TypeSpacificationPrefix: string;
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

// â"€â"€ Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
  const [activeFormTab, setActiveFormTab] = useState<"detail" | "spec">("detail");
  const [specForm, setSpecForm] = useState({ SubGroupType: "", TypeSpecification: "", SubGroupTypePrefix: "", TypeSpacificationPrefix: "" });
  const [specSaving, setSpecSaving] = useState(false);
  const [specLoading, setSpecLoading] = useState(false);
  const [allSpecs, setAllSpecs] = useState<SubGroupSpec[]>([]);
  const [existingSpecs, setExistingSpecs] = useState<SubGroupSpec[]>([]);
  const [filterSubGroupName, setFilterSubGroupName] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [companyName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("companyName") || "Sub Group Master" : "Sub Group Master"
  );

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  // â"€â"€ Loaders â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  const loadAllSpecs = useCallback(() => {
    fetch(`${BASE}/get-all-subgroup-specs`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setAllSpecs(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setAllSpecs([]));
  }, []);

  useEffect(() => {
    loadList();
    loadAllSpecs();
    fetch(`${BASE_URL}/api/itemgroupmaster/list`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setUnderGroups(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setUnderGroups([]));
  }, [loadList, loadAllSpecs]);

  // â"€â"€ Open add â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const openAdd = () => {
    setEditing(null);
    setError("");
    setForm(blank());
    setActiveFormTab("detail");
    setSpecForm({ SubGroupType: "", TypeSpecification: "", SubGroupTypePrefix: "", TypeSpacificationPrefix: "" });
    setExistingSpecs([]);
    setView("form");
  };

  // â"€â"€ Open edit â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const openEdit = (row: SubGroupRow) => {
    setEditing(row);
    setError("");
    setActiveFormTab("detail");
    setSpecForm({ SubGroupType: "", TypeSpecification: "", SubGroupTypePrefix: "", TypeSpacificationPrefix: "" });
    setExistingSpecs([]);
    setForm({
      ItemSubGroupName: String(row.ItemSubGroupName ?? ""),
      ItemSubGroupDisplayName: String(row.ItemSubGroupDisplayName ?? ""),
      UnderSubGroupID: String(row.UnderSubGroupID ?? ""),
    });
    // Load all existing specs for this sub group (for suggestions)
    setSpecLoading(true);
    fetch(`${BASE}/get-subgroup-specs/${row.ItemSubGroupUniqueID}`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setExistingSpecs(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setExistingSpecs([]))
      .finally(() => setSpecLoading(false));
    setView("form");
  };

  // â"€â"€ Save â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  // â"€â"€ Save Specification â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const saveSpec = async () => {
    if (!editing) return;
    if (!specForm.SubGroupType.trim()) { setError("Sub Group 2 is required."); return; }
    if (!specForm.SubGroupTypePrefix.trim()) { setError("Sub Group 2 prefix is required."); return; }

    const typeLower = specForm.SubGroupType.trim().toLowerCase();
    const specLower = specForm.TypeSpecification.trim().toLowerCase();
    const typePrefixLower = specForm.SubGroupTypePrefix.trim().toLowerCase();
    const specPrefixLower = specForm.TypeSpacificationPrefix.trim().toLowerCase();

    // Duplicate row check
    const isDuplicate = existingSpecs.some(s =>
      s.SubGroupType.trim().toLowerCase() === typeLower &&
      s.TypeSpecification.trim().toLowerCase() === specLower
    );
    if (isDuplicate) { setError("This Type and Specification combination already exists."); return; }

    // New Sub Group Type entered — check its prefix is not already used by a different type name
    const typeIsNew = !existingSpecs.some(s => s.SubGroupType.trim().toLowerCase() === typeLower);
    if (typeIsNew && typePrefixLower) {
      const prefixConflict = existingSpecs.find(
        s => s.SubGroupTypePrefix.trim().toLowerCase() === typePrefixLower &&
             s.SubGroupType.trim().toLowerCase() !== typeLower
      );
      if (prefixConflict) {
        setError(`Sub Group Type Prefix "${specForm.SubGroupTypePrefix.trim()}" is already used by "${prefixConflict.SubGroupType}". Use a different prefix.`);
        return;
      }
    }

    // New Type Specification entered — check its prefix is not already used by a different spec name
    const specIsNew = !existingSpecs.some(s => s.TypeSpecification.trim().toLowerCase() === specLower);
    if (specIsNew && specPrefixLower) {
      const specPrefixConflict = existingSpecs.find(
        s => s.TypeSpacificationPrefix.trim().toLowerCase() === specPrefixLower &&
             s.TypeSpecification.trim().toLowerCase() !== specLower
      );
      if (specPrefixConflict) {
        setError(`Type Specification Prefix "${specForm.TypeSpacificationPrefix.trim()}" is already used by "${specPrefixConflict.TypeSpecification}". Use a different prefix.`);
        return;
      }
    }

    setSpecSaving(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/save-subgroup-spec`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ItemGroupID: String(editing.UnderSubGroupID || ""),
          ItemSubGroupID: String(editing.ItemSubGroupUniqueID),
          SubGroupType: specForm.SubGroupType.trim(),
          TypeSpecification: specForm.TypeSpecification.trim(),
          SubGroupTypePrefix: specForm.SubGroupTypePrefix.trim(),
          TypeSpacificationPrefix: specForm.TypeSpacificationPrefix.trim(),
        }),
      });
      const result = unwrap(await res.text());
      if (result === "Success") {
        // Reload specs for this sub group to refresh suggestions
        fetch(`${BASE}/get-subgroup-specs/${editing.ItemSubGroupUniqueID}`, { headers: authHeaders() })
          .then(r => r.text())
          .then(text => { const raw = unwrap(text); setExistingSpecs(Array.isArray(raw) ? raw : []); })
          .catch(() => {});
        loadAllSpecs();
        loadList(); // refresh list to show updated level
        setSpecForm({ SubGroupType: "", TypeSpecification: "", SubGroupTypePrefix: "", TypeSpacificationPrefix: "" });
        setError("");
      } else if (result === "Exist") {
        setError("This Type and Specification combination already exists.");
      } else {
        setError("Specification save failed: " + result);
      }
    } catch (e: any) {
      setError("Error: " + e.message);
    }
    setSpecSaving(false);
  };

  // â"€â"€ Delete â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const deleteGroup = async (row: SubGroupRow) => {
    if (!confirm("Delete this sub group and all its specifications?")) return;
    try {
      const res = await fetch(`${BASE}/delete-group`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ItemSubGroupUniqueID: String(row.ItemSubGroupUniqueID),
          ItemGroupID: String(row.UnderSubGroupID || ""),
        }),
      });
      const result = unwrap(await res.text());
      if (result === "Success") { loadList(); loadAllSpecs(); }
      else alert(result || "Delete failed.");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // ── Delete Specification (soft delete) ──
  const deleteSpec = async (spec: SubGroupSpec) => {
    if (!confirm("Delete this specification?")) return;
    try {
      const res = await fetch(`${BASE}/delete-subgroup-spec`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ItemSubGroupUniqueID: String(spec.ItemSubGroupUniqueID) }),
      });
      const result = unwrap(await res.text());
      if (result === "Success") {
        setExistingSpecs(prev => prev.filter(s => s.ItemSubGroupUniqueID !== spec.ItemSubGroupUniqueID));
        loadAllSpecs();
      } else {
        alert(result || "Delete failed.");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // â"€â"€ Derived â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const getGroupName = (r: SubGroupRow) => {
    const grp = underGroups.find(g => String(g.ItemGroupID) === String(r.UnderSubGroupID));
    return grp?.ItemGroupName || r.GroupName || "";
  };

  const uniqueGroups = useMemo(() =>
    ["All", ...new Set(data.map(r => getGroupName(r)).filter(Boolean))],
    [data, underGroups]);

  const subGroupsInGroup = useMemo(() =>
    filterGroup === "All" ? data : data.filter(r => getGroupName(r) === filterGroup),
    [data, filterGroup, underGroups]);

  const uniqueSubGroupNames = useMemo(() =>
    ["All", ...new Set(subGroupsInGroup.map(r => r.ItemSubGroupName).filter(Boolean))],
    [subGroupsInGroup]);

  // Types available based on current group+subgroup selection
  const typesForSubGroup = useMemo(() => {
    // Start from rows already filtered by group (and sub-group if selected)
    const baseRows = filterSubGroupName === "All" ? subGroupsInGroup : subGroupsInGroup.filter(r => r.ItemSubGroupName === filterSubGroupName);
    const ids = new Set(baseRows.map(r => String(r.ItemSubGroupUniqueID)));
    const types = allSpecs
      .filter(s => ids.has(String(s.ItemSubGroupUniqueID)))
      .map(s => s.SubGroupType)
      .filter(Boolean);
    return ["All", ...new Set(types)];
  }, [subGroupsInGroup, filterSubGroupName, allSpecs]);

  const filtered = useMemo(() => {
    let result = data;
    if (filterGroup !== "All") result = result.filter(r => getGroupName(r) === filterGroup);
    if (filterSubGroupName !== "All") result = result.filter(r => r.ItemSubGroupName === filterSubGroupName);
    if (filterType !== "All") {
      const matchingIDs = new Set(allSpecs.filter(s => s.SubGroupType === filterType).map(s => String(s.ItemSubGroupUniqueID)));
      result = result.filter(r => matchingIDs.has(String(r.ItemSubGroupUniqueID)));
    }
    return result;
  }, [data, filterGroup, filterSubGroupName, filterType, allSpecs, underGroups]);

  // â"€â"€ FORM VIEW â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
            <div className="flex gap-8">
              <button
                onClick={() => setActiveFormTab("detail")}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeFormTab === "detail" ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
                Sub Group Details
              </button>
              {editing && (
                <button
                  onClick={() => setActiveFormTab("spec")}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeFormTab === "spec" ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
                  Sub Group Specification Details
                </button>
              )}
            </div>
          </div>

          {/* Sub Group Details Tab */}
          {activeFormTab === "detail" && (
            <div className="p-8 space-y-8">
              <div>
                <SectionTitle title="Sub Group Identity" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Sub Group Name" required>
                    <input type="text" value={form.ItemSubGroupName}
                      onChange={e => {
                        f("ItemSubGroupName", e.target.value);
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
          )}

          {/* Sub Group Specification Details Tab */}
          {activeFormTab === "spec" && editing && (
            <div className="p-8 space-y-6">
              <SectionTitle title="Sub Group Specification Details" />
              {specLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <Loader2 size={20} className="animate-spin mr-2" /> Loading...
                </div>
              ) : (
                <>
                  {/* datalists for suggestions */}
                  <datalist id="dl-subgroup-type">
                    {[...new Set(existingSpecs.map(s => s.SubGroupType).filter(Boolean))].map(t => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  <datalist id="dl-subgroup-spec">
                    {[...new Set(existingSpecs.map(s => s.TypeSpecification).filter(Boolean))].map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>

                  {/* Read-only identity fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Group Name">
                      <input
                        type="text"
                        value={underGroups.find(g => String(g.ItemGroupID) === String(editing.UnderSubGroupID))?.ItemGroupName || editing.GroupName || ""}
                        readOnly
                        className={inputCls + " bg-gray-50 text-gray-500 cursor-not-allowed"} />
                    </Field>
                    <Field label="Sub Group 1">
                      <input
                        type="text"
                        value={editing.ItemSubGroupName}
                        readOnly
                        className={inputCls + " bg-gray-50 text-gray-500 cursor-not-allowed"} />
                    </Field>
                  </div>

                  {/* Editable spec fields with suggestions */}
                  {(() => {
                    // Check if typed Sub Group Type matches an existing spec — if so, prefix is locked
                    const matchedType = existingSpecs.find(
                      s => s.SubGroupType.trim().toLowerCase() === specForm.SubGroupType.trim().toLowerCase() && s.SubGroupType.trim() !== ""
                    );
                    const typePrefixLocked = !!matchedType;
                    const lockedTypePrefix = matchedType?.SubGroupTypePrefix || "";

                    // Check if typed Type Specification matches any existing spec by name alone — prefix is global per spec name
                    const matchedSpec = existingSpecs.find(
                      s => s.TypeSpecification.trim().toLowerCase() === specForm.TypeSpecification.trim().toLowerCase() &&
                           s.TypeSpecification.trim() !== ""
                    );
                    const specPrefixLocked = !!matchedSpec;
                    const lockedSpecPrefix = matchedSpec?.TypeSpacificationPrefix || "";

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 3. Sub Group Type */}
                        <Field label="Sub Group 2" required>
                          <input
                            type="text"
                            list="dl-subgroup-type"
                            value={specForm.SubGroupType}
                            onChange={e => {
                              const val = e.target.value;
                              const match = existingSpecs.find(s => s.SubGroupType.trim().toLowerCase() === val.trim().toLowerCase() && val.trim() !== "");
                              setSpecForm(p => ({
                                ...p,
                                SubGroupType: val,
                                // if match found use saved prefix, if no match clear it
                                SubGroupTypePrefix: match ? (match.SubGroupTypePrefix || "") : "",
                                // also clear spec prefix since type changed
                                TypeSpacificationPrefix: "",
                              }));
                            }}
                            placeholder=""
                            className={inputCls} />
                        </Field>
                        {/* 4. Sub Group Type Prefix */}
                        <Field label="Sub Group 2 prefix" required>
                          <input
                            type="text"
                            value={typePrefixLocked ? lockedTypePrefix : specForm.SubGroupTypePrefix}
                            onChange={e => !typePrefixLocked && setSpecForm(p => ({ ...p, SubGroupTypePrefix: e.target.value }))}
                            readOnly={typePrefixLocked}
                            placeholder=""
                            className={inputCls + (typePrefixLocked ? " bg-gray-50 text-gray-500 cursor-not-allowed" : "")} />
                        </Field>
                        {/* 5. Type Specification */}
                        <Field label="Sub Group 3">
                          <input
                            type="text"
                            list="dl-subgroup-spec"
                            value={specForm.TypeSpecification}
                            onChange={e => {
                              const val = e.target.value;
                              const match = existingSpecs.find(
                                s => s.TypeSpecification.trim().toLowerCase() === val.trim().toLowerCase() &&
                                     val.trim() !== ""
                              );
                              setSpecForm(p => ({
                                ...p,
                                TypeSpecification: val,
                                // if match found use saved prefix, if no match clear it
                                TypeSpacificationPrefix: match ? (match.TypeSpacificationPrefix || "") : "",
                              }));
                            }}
                            placeholder=""
                            className={inputCls} />
                        </Field>
                        {/* 6. Type Specification Prefix */}
                        <Field label="Sub Group 3 prefix">
                          <input
                            type="text"
                            value={specPrefixLocked ? lockedSpecPrefix : specForm.TypeSpacificationPrefix}
                            onChange={e => !specPrefixLocked && setSpecForm(p => ({ ...p, TypeSpacificationPrefix: e.target.value }))}
                            readOnly={specPrefixLocked}
                            placeholder=""
                            className={inputCls + (specPrefixLocked ? " bg-gray-50 text-gray-500 cursor-not-allowed" : "")} />
                        </Field>
                      </div>
                    );
                  })()}

                  <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button onClick={saveSpec} disabled={specSaving}
                      className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
                      {specSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Save Specification (New Row)
                    </button>
                  </div>

                  {/* Existing specs for this sub group */}
                  {existingSpecs.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-2">Existing Specifications</p>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="grid bg-blue-700 text-white text-xs font-semibold" style={{gridTemplateColumns:"1fr 1fr 1fr 1fr auto"}}>
                          <div className="px-4 py-2">Sub Group 2</div>
                          <div className="px-4 py-2">Sub Group 2 Prefix</div>
                          <div className="px-4 py-2">Sub Group 3</div>
                          <div className="px-4 py-2">Sub Group 3 Prefix</div>
                          <div className="px-4 py-2"></div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {existingSpecs.map((s, i) => (
                            <div key={i} className="grid text-xs hover:bg-gray-50" style={{gridTemplateColumns:"1fr 1fr 1fr 1fr auto"}}>
                              <div className="px-4 py-2.5 text-gray-800 font-medium cursor-pointer"
                                onClick={() => setSpecForm({ SubGroupType: s.SubGroupType, TypeSpecification: s.TypeSpecification, SubGroupTypePrefix: s.SubGroupTypePrefix || "", TypeSpacificationPrefix: s.TypeSpacificationPrefix || "" })}>
                                {s.SubGroupType || "—"}
                              </div>
                              <div className="px-4 py-2.5 text-gray-600 cursor-pointer"
                                onClick={() => setSpecForm({ SubGroupType: s.SubGroupType, TypeSpecification: s.TypeSpecification, SubGroupTypePrefix: s.SubGroupTypePrefix || "", TypeSpacificationPrefix: s.TypeSpacificationPrefix || "" })}>
                                {s.SubGroupTypePrefix || "—"}
                              </div>
                              <div className="px-4 py-2.5 text-gray-600 cursor-pointer"
                                onClick={() => setSpecForm({ SubGroupType: s.SubGroupType, TypeSpecification: s.TypeSpecification, SubGroupTypePrefix: s.SubGroupTypePrefix || "", TypeSpacificationPrefix: s.TypeSpacificationPrefix || "" })}>
                                {s.TypeSpecification || "—"}
                              </div>
                              <div className="px-4 py-2.5 text-gray-600 cursor-pointer"
                                onClick={() => setSpecForm({ SubGroupType: s.SubGroupType, TypeSpecification: s.TypeSpecification, SubGroupTypePrefix: s.SubGroupTypePrefix || "", TypeSpacificationPrefix: s.TypeSpacificationPrefix || "" })}>
                                {s.TypeSpacificationPrefix || "—"}
                              </div>
                              <div className="px-3 py-2 flex items-center">
                                <button onClick={() => deleteSpec(s)} title="Delete" className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                  <Trash2 size={13}/>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Click a row to copy values into fields above.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  // â"€â"€ LIST VIEW â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

      {/* Cascading filter: Group → Sub Group → Type */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
        {/* Level 1: Group */}
        {uniqueGroups.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-24 shrink-0">Group</span>
            {uniqueGroups.map(g => (
              <button key={g} onClick={() => {
                setFilterGroup(g);
                setFilterSubGroupName("All");
                setFilterType("All");
              }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterGroup === g ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {g === "All" ? "All Groups" : g}
              </button>
            ))}
          </div>
        )}

        {/* Level 2: Sub Group (only when a group is selected) */}
        {filterGroup !== "All" && uniqueSubGroupNames.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap pl-1 border-t border-gray-100 pt-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-24 shrink-0">Sub Group</span>
            {uniqueSubGroupNames.map(s => (
              <button key={s} onClick={() => {
                setFilterSubGroupName(s);
                setFilterType("All");
              }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterSubGroupName === s ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {s === "All" ? "All Sub Groups" : s}
              </button>
            ))}
          </div>
        )}

        {/* Level 3: Type — visible as soon as a Group is selected and types exist for it */}
        {filterGroup !== "All" && typesForSubGroup.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap pl-1 border-t border-gray-100 pt-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-24 shrink-0">Type</span>
            {typesForSubGroup.map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? "bg-emerald-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {t === "All" ? "All Types" : t}
              </button>
            ))}
          </div>
        )}

        {/* Active filter summary */}
        {(filterGroup !== "All" || filterSubGroupName !== "All" || filterType !== "All") && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-400">Showing:</span>
            {filterGroup !== "All" && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{filterGroup}</span>}
            {filterSubGroupName !== "All" && <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">{filterSubGroupName}</span>}
            {filterType !== "All" && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">{filterType}</span>}
            <button onClick={() => { setFilterGroup("All"); setFilterSubGroupName("All"); setFilterType("All"); }}
              className="text-xs text-red-500 hover:text-red-700 ml-1 underline">Clear</button>
          </div>
        )}
      </div>

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
