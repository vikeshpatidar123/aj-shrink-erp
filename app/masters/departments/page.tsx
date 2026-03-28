"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/othermaster`;

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

const PRESS_OPTIONS = ["Pree", "Post"];

const pressColors: Record<string, string> = {
  "Pree": "bg-blue-100 text-blue-700",
  "Post": "bg-orange-100 text-orange-700",
};

// ── Types ──────────────────────────────────────────────────────────────────────
type DeptRow = {
  id: string;
  DepartmentID: string;
  DepartmentName: string;
  Press: string;
  SequenceNo: string;
};

type FormState = {
  DepartmentName: string;
  Press: string;
  SequenceNo: string;
};

const blank = (): FormState => ({
  DepartmentName: "",
  Press: "Pree",
  SequenceNo: "",
});

// ── Page ───────────────────────────────────────────────────────────────────────
export default function DepartmentMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<DeptRow | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [filterPress, setFilterPress] = useState("All");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [companyName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("companyName") || "Department Master" : "Department Master"
  );

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  // ── Load list ─────────────────────────────────────────────────────────────────
  const loadList = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}/department`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setData(Array.isArray(raw) ? raw.map((r: any) => ({ ...r, id: String(r.DepartmentID) })) : []);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Open add ──────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setError("");
    setForm(blank());
    setView("form");
  };

  // ── Open edit ─────────────────────────────────────────────────────────────────
  const openEdit = (row: DeptRow) => {
    setEditing(row);
    setError("");
    setForm({
      DepartmentName: String(row.DepartmentName ?? ""),
      Press: String(row.Press ?? "Pree"),
      SequenceNo: String(row.SequenceNo ?? ""),
    });
    setView("form");
  };

  // ── Save ──────────────────────────────────────────────────────────────────────
  const saveDept = async () => {
    setSubmitAttempted(true);
    if (!String(form.DepartmentName ?? "").trim()) { setError("Department Name is required."); return; }
    if (!String(form.SequenceNo ?? "").trim()) { setError("Sequence No is required."); return; }
    setSaving(true);
    setError("");
    try {
      let res: Response;
      if (editing) {
        // Update — CostingDataGroupMaster is an array
        res = await fetch(`${BASE}/update-department`, {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            CostingDataGroupMaster: [{
              DepartmentName: form.DepartmentName,
              Press: form.Press,
              SequenceNo: form.SequenceNo,
            }],
            TxtDepartmentID: String(editing.DepartmentID),
          }),
        });
      } else {
        // Save — CostingDataGroupMaster is a single object
        res = await fetch(`${BASE}/save-department`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            CostingDataGroupMaster: {
              DepartmentName: form.DepartmentName,
              Press: form.Press,
              SequenceNo: form.SequenceNo,
            },
            DepartmentName: form.DepartmentName,
            SelectBoxPress: form.Press,
          }),
        });
      }
      const result = unwrap(await res.text());
      if (result === "Success") {
        loadList();
        setView("list");
      } else if (typeof result === "string" && result.toLowerCase().includes("duplicate")) {
        setError("A department with this Sequence No already exists.");
      } else {
        setError("Save failed: " + result);
      }
    } catch (e: any) {
      setError("Error: " + e.message);
    }
    setSaving(false);
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleteDept = async (row: DeptRow) => {
    if (!confirm("Delete this department?")) return;
    try {
      const res = await fetch(`${BASE}/delete-department/${row.DepartmentID}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const result = unwrap(await res.text());
      if (result === "Success") loadList();
      else alert(result || "Delete failed.");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const uniquePress = useMemo(() =>
    ["All", ...new Set(data.map(r => r.Press).filter(Boolean))],
    [data]);

  const filtered = useMemo(() =>
    filterPress === "All" ? data : data.filter(r => r.Press === filterPress),
    [data, filterPress]);

  // ── FORM VIEW ─────────────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{companyName}</p>
            <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit Department" : "New Department"}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <List size={16} /> Back to List
            </button>
            <button onClick={saveDept} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save Department
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
                ID: {editing.DepartmentID}
              </span>
            )}
            <div className="flex gap-8">
              <button className="pb-3 text-sm font-medium border-b-2 text-blue-600 border-blue-600">
                Department Details
              </button>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Module / Press selector */}
            <div>
              <SectionTitle title="Module (Press)" />
              <div className="flex gap-3 flex-wrap">
                {PRESS_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => f("Press", opt)}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                      form.Press === opt
                        ? opt === "Pree" ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-orange-500 text-white border-orange-500 shadow-sm"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                    }`}>
                    {opt === "Pree" ? "Pre-Press (Pree)" : "Post-Process (Post)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Identity */}
            <div>
              <SectionTitle title="Department Identity" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <Field label="Department Name" required>
                    <input type="text" value={form.DepartmentName}
                      onChange={e => f("DepartmentName", e.target.value)}
                      placeholder="e.g. Printing, Lamination, Pre-Press..." className={ic(submitAttempted && !form.DepartmentName.trim())} />
                  </Field>
                </div>
                <Field label="Sequence No" required>
                  <input type="text" value={form.SequenceNo}
                    onChange={e => { const v = e.target.value; if (v === "" || /^\d+$/.test(v)) f("SequenceNo", v); }}
                    placeholder="e.g. 1, 2, 3..." className={ic(submitAttempted && !form.SequenceNo.trim())} />
                </Field>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  const columns: Column<DeptRow>[] = [
    { key: "DepartmentID", header: "ID", sortable: true },
    { key: "DepartmentName", header: "Department Name", sortable: true },
    {
      key: "Press", header: "Module",
      render: r => r.Press
        ? <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${pressColors[r.Press] || "bg-gray-100 text-gray-600"}`}>{r.Press}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: "SequenceNo", header: "Sequence No",
      render: r => <span className="text-gray-600 text-sm font-mono">{r.SequenceNo || "—"}</span>,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Department Master</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${filtered.length} of ${data.length} departments`}
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Department
        </button>
      </div>

      {/* Module filter pills */}
      {uniquePress.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Module</span>
            {uniquePress.map(p => (
              <button key={p} onClick={() => setFilterPress(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterPress === p ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {p === "All" ? "All Modules" : p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={filtered}
          columns={columns}
          searchKeys={["DepartmentName", "Press", "SequenceNo"]}
          actions={row => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteDept(row)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
