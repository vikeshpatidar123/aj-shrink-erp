"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/othermaster`;

function unwrap(v: any): any {
  let r = v;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

// â”€â”€ Shared UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type DeptRow = {
  id: string;
  DepartmentID: string;
  DepartmentName: string;
  Press: string;
  SequenceNo: string;
};

type FormState = {
  DepartmentName: string;
};

const blank = (): FormState => ({ DepartmentName: "" });

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function DepartmentMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<DeptRow | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [companyName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("companyName") || "Department Master" : "Department Master"
  );

  // â”€â”€ Load list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Open add â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openAdd = () => {
    setEditing(null);
    setError("");
    setForm(blank());
    setSubmitAttempted(false);
    setView("form");
  };

  // â”€â”€ Open edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openEdit = (row: DeptRow) => {
    setEditing(row);
    setError("");
    setSubmitAttempted(false);
    setForm({ DepartmentName: String(row.DepartmentName ?? "") });
    setView("form");
  };

  // â”€â”€ Save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saveDept = async () => {
    setSubmitAttempted(true);
    if (!String(form.DepartmentName ?? "").trim()) { setError("Department Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      let res: Response;
      if (editing) {
        res = await fetch(`${BASE}/update-department`, {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            CostingDataGroupMaster: [{
              DepartmentName: form.DepartmentName,
              Press: editing.Press || "Pree",
              SequenceNo: editing.SequenceNo || "1",
            }],
            TxtDepartmentID: String(editing.DepartmentID),
          }),
        });
      } else {
        res = await fetch(`${BASE}/save-department`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            CostingDataGroupMaster: {
              DepartmentName: form.DepartmentName,
              Press: "Pree",
              SequenceNo: "1",
            },
            DepartmentName: form.DepartmentName,
            SelectBoxPress: "Pree",
          }),
        });
      }
      const result = unwrap(await res.text());
      if (result === "Success") {
        loadList();
        setView("list");
      } else if (typeof result === "string" && result.toLowerCase().includes("duplicate")) {
        setError("A department with this name already exists.");
      } else {
        setError("Save failed: " + result);
      }
    } catch (e: any) {
      setError("Error: " + e.message);
    }
    setSaving(false);
  };

  // â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ FORM VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (view === "form") {
    return (
      <div className="max-w-2xl mx-auto pb-10">
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

          <div className="p-8">
            <Field label="Department Name" required>
              <input type="text" value={form.DepartmentName}
                onChange={e => setForm({ DepartmentName: e.target.value })}
                placeholder="e.g. Printing, Lamination, Pre-Press..."
                className={ic(submitAttempted && !form.DepartmentName.trim())} />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  // â”€â”€ LIST VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const columns: Column<DeptRow>[] = [
    { key: "DepartmentID", header: "ID", sortable: true },
    { key: "DepartmentName", header: "Department Name", sortable: true },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Department Master</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${data.length} department${data.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Department
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["DepartmentName"]}
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
