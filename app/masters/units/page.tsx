"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/unitmaster`;

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

// Unit type options for the Type field
const UNIT_TYPES = ["Weight", "Length", "Area", "Volume", "Count", "Time", "Temperature", "Pressure", "Other"];

const typeColors: Record<string, string> = {
  Weight:      "bg-blue-100 text-blue-700",
  Length:      "bg-violet-100 text-violet-700",
  Area:        "bg-amber-100 text-amber-700",
  Volume:      "bg-cyan-100 text-cyan-700",
  Count:       "bg-green-100 text-green-700",
  Time:        "bg-orange-100 text-orange-700",
  Temperature: "bg-red-100 text-red-700",
  Pressure:    "bg-purple-100 text-purple-700",
  Other:       "bg-gray-100 text-gray-600",
};

// ── Types ──────────────────────────────────────────────────────────────────────
type UnitRow = {
  id: string;
  UnitID: string;
  UnitName: string;
  UnitSymbol: string;
  Type: string;
  ConversionValue: string;
  DecimalPlace: string;
};

type FormState = {
  UnitName: string;
  UnitSymbol: string;
  Type: string;
  ConversionValue: string;
  DecimalPlace: string;
};

const blank = (): FormState => ({
  UnitName: "",
  UnitSymbol: "",
  Type: "Count",
  ConversionValue: "0",
  DecimalPlace: "0",
});

// ── Page ───────────────────────────────────────────────────────────────────────
export default function UnitMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<UnitRow | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [filterType, setFilterType] = useState("All");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [companyName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("companyName") || "Unit Master" : "Unit Master"
  );

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  // ── Load list ─────────────────────────────────────────────────────────────────
  const loadList = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}/getunit`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setData(Array.isArray(raw) ? raw.map((r: any) => ({ ...r, id: String(r.UnitID) })) : []);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Open Add ──────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setError("");
    setForm(blank());
    setView("form");
  };

  // ── Open Edit ─────────────────────────────────────────────────────────────────
  const openEdit = (row: UnitRow) => {
    setEditing(row);
    setError("");
    setForm({
      UnitName:        String(row.UnitName ?? ""),
      UnitSymbol:      String(row.UnitSymbol ?? ""),
      Type:            String(row.Type ?? "Count"),
      ConversionValue: String(row.ConversionValue ?? "0"),
      DecimalPlace:    String(row.DecimalPlace ?? "0"),
    });
    setView("form");
  };

  // ── Save ──────────────────────────────────────────────────────────────────────
  const saveUnit = async () => {
    setSubmitAttempted(true);
    if (!form.UnitName.trim()) { setError("Unit Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        UnitName: form.UnitName.trim(),
        UnitSymbol: form.UnitSymbol.trim(),
        Type: form.Type,
        ConversionValue: form.ConversionValue || "0",
        DecimalPlace: form.DecimalPlace || "0",
      };

      let res: Response;
      if (editing) {
        res = await fetch(`${BASE}/updatunitdata`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            CostingDataGroupMaster: [payload],
            TxtUnitID: String(editing.UnitID),
          }),
        });
      } else {
        res = await fetch(`${BASE}/saveunitdata`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            CostingDataGroupMaster: [payload],
            UnitName: form.UnitName.trim(),
            SelectBoxType: form.Type,
          }),
        });
      }

      const result = unwrap(await res.text());
      if (result === "Success") {
        loadList();
        setView("list");
      } else if (result === "Exist") {
        setError("A unit with this name already exists.");
      } else {
        setError("Save failed: " + result);
      }
    } catch (e: any) {
      setError("Error: " + e.message);
    }
    setSaving(false);
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleteUnit = async (row: UnitRow) => {
    if (!confirm(`Delete unit "${row.UnitName}"?`)) return;
    try {
      const res = await fetch(`${BASE}/deleteunitmasterdata/${row.UnitID}`, {
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
  const uniqueTypes = useMemo(() =>
    ["All", ...new Set(data.map(r => r.Type).filter(Boolean))],
    [data]);

  const filtered = useMemo(() =>
    filterType === "All" ? data : data.filter(r => r.Type === filterType),
    [data, filterType]);

  // ── FORM VIEW ─────────────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{companyName}</p>
            <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit Unit" : "New Unit"}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <List size={16} /> Back to List
            </button>
            <button onClick={saveUnit} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save Unit
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
                ID: {editing.UnitID}
              </span>
            )}
            <div className="flex gap-8">
              <button className="pb-3 text-sm font-medium border-b-2 text-blue-600 border-blue-600">
                Unit Details
              </button>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Unit Type selector */}
            <div>
              <SectionTitle title="Unit Category" />
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {UNIT_TYPES.map(t => (
                  <button key={t} onClick={() => f("Type", t)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                      form.Type === t
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Identity */}
            <div>
              <SectionTitle title="Unit Identity" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <Field label="Unit Name" required>
                    <input type="text" value={form.UnitName}
                      onChange={e => f("UnitName", e.target.value)}
                      placeholder="e.g. Kilogram, Meter, Piece" className={ic(submitAttempted && !form.UnitName.trim())} />
                  </Field>
                </div>
                <Field label="Unit Symbol">
                  <input type="text" value={form.UnitSymbol}
                    onChange={e => f("UnitSymbol", e.target.value)}
                    placeholder="e.g. kg, m, pcs" className={inputCls} />
                </Field>
              </div>
            </div>

            {/* Conversion */}
            <div>
              <SectionTitle title="Conversion & Precision" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Conversion Value">
                  <input type="number" value={form.ConversionValue}
                    onChange={e => f("ConversionValue", e.target.value)}
                    placeholder="e.g. 1000 (for g → kg)" min="0" step="any" className={inputCls} />
                </Field>
                <Field label="Decimal Places">
                  <select value={form.DecimalPlace}
                    onChange={e => f("DecimalPlace", e.target.value)}
                    className={inputCls}>
                    {[0, 1, 2, 3, 4].map(n => (
                      <option key={n} value={String(n)}>{n} decimal{n !== 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  const columns: Column<UnitRow>[] = [
    { key: "UnitID", header: "ID", sortable: true },
    { key: "UnitName", header: "Unit Name", sortable: true },
    {
      key: "UnitSymbol", header: "Symbol",
      render: r => r.UnitSymbol
        ? <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono font-bold bg-gray-100 text-gray-700">{r.UnitSymbol}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: "Type", header: "Type",
      render: r => r.Type
        ? <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${typeColors[r.Type] || "bg-gray-100 text-gray-600"}`}>{r.Type}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: "ConversionValue", header: "Conversion",
      render: r => <span className="text-sm font-mono text-gray-700">{r.ConversionValue || "—"}</span>,
    },
    {
      key: "DecimalPlace", header: "Decimals",
      render: r => <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-600">{r.DecimalPlace ?? "—"}</span>,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Unit Master</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${filtered.length} of ${data.length} units`}
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Unit
        </button>
      </div>

      {/* Type filter pills */}
      {uniqueTypes.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Type</span>
            {uniqueTypes.map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === t ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {t === "All" ? "All Types" : t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={filtered}
          columns={columns}
          searchKeys={["UnitName", "UnitSymbol", "Type"]}
          actions={row => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteUnit(row)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
