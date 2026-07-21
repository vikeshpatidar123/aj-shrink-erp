"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";
import { usePermissions } from "@/context/PermissionsContext";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/ledgermasterShrink`;

// Sales Person is not its own ledger type — it's an "Employees" ledger (LedgerGroupID = 3
// in this DB's LedgerGroupMaster; matched by the well-known LedgerGroupNameID = 27 so this
// still resolves correctly on any other company) carrying the sentinel DepartmentID = -50.
// Every other place "Sales Person" shows up in the ERP (Clients' Sales Person dropdown, sales
// target setting, Zoho sync) already reads this exact same convention — so a record created
// here shows up everywhere else automatically, with zero other code needing to change.
// There was previously no UI that could set DepartmentID = -50 at all (the Employee form's own
// "Department Name" field only offers real DepartmentMaster rows, none of which is -50), so this
// page exists purely to fill that one gap: create/manage Employees with that flag pre-set.
const SALES_PERSON_LEDGER_GROUP_NAME_ID = 27;
const SALES_PERSON_DEPARTMENT_ID = -50;
// The "Designation" field's dropdown isn't a real designation list at all — it's every distinct
// free-text value anyone has ever typed into any Employee's Designation across the whole
// company (Designer, Operator, Inventory, "tester", blank...), pulled from a legacy details
// table. None of that is sales-specific, so it makes no sense to ask the user to pick one here —
// every record on this page already IS a sales person, so it's set to this fixed value instead.
const SALES_PERSON_DESIGNATION = "Sales Person";

function unwrap(raw: any): any {
  let result = raw;
  while (typeof result === "string") {
    try { result = JSON.parse(result); } catch { break; }
  }
  return result;
}

function isFieldVisible(f: any): boolean {
  return f.IsDisplay !== false && f.IsDisplay !== 0 && f.IsDisplay !== "0" && f.IsDisplay !== null;
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

type SelectOpt = { value: string; label: string };

function DynamicField({ field, value, options, onChange, submitAttempted }: {
  field: any; value: any; options: SelectOpt[]; onChange: (v: any) => void; submitAttempted?: boolean;
}) {
  const inputCls = "w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";

  const inner = () => {
    if (field.FieldType === "selectbox") {
      return (
        <select value={value ?? ""} onChange={e => onChange(e.target.value)} disabled={!!field.IsLocked} className={inputCls}>
          <option value="">-- Select --</option>
          {options.map((o, i) => <option key={`${i}-${o.value}`} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (field.FieldType === "checkbox") {
      const checked = value === true || value === "true" || value === 1 || value === "1";
      return (
        <label className="flex items-center gap-2.5 cursor-pointer select-none mt-1">
          <div onClick={() => onChange(checked ? "false" : "true")}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}>
            {checked && <Check size={12} className="text-white" strokeWidth={3} />}
          </div>
          <span className="text-sm text-gray-700">Yes</span>
        </label>
      );
    }
    if (field.FieldType === "textarea") {
      return (
        <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} rows={3}
          disabled={!!field.IsLocked} placeholder={field.FieldDefaultValue ?? ""}
          className={inputCls + " resize-none"} />
      );
    }
    if (field.FieldType === "datebox") {
      return (
        <input type="date" value={value ?? ""} onChange={e => onChange(e.target.value)}
          disabled={!!field.IsLocked} className={inputCls} />
      );
    }
    return (
      <input type={field.FieldType === "number" ? "number" : "text"} value={value ?? ""}
        onChange={e => onChange(e.target.value)} disabled={!!field.IsLocked}
        placeholder={field.FieldDefaultValue && field.FieldDefaultValue !== "false" && field.FieldDefaultValue !== "null" ? field.FieldDefaultValue : ""}
        className={inputCls} />
    );
  };

  return (
    <Field label={field.FieldDisplayName ?? field.FieldName} required={!!field.IsRequiredFieldValidator}>
      {inner()}
    </Field>
  );
}

export default function SalesPersonPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [ledgerGroupID, setLedgerGroupID] = useState<string>("");

  const [editing, setEditing] = useState<any | null>(null);
  const { can } = usePermissions();
  const [formFields, setFormFields] = useState<any[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [selectOpts, setSelectOpts] = useState<Record<string, SelectOpt[]>>({});
  const [formSaving, setFormSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [gridData, setGridData] = useState<any[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  // Resolve the real LedgerGroupID for "Employees" in this company (via the well-known
  // LedgerGroupNameID, not a hardcoded literal — LedgerGroupID itself is per-company).
  useEffect(() => {
    fetch(`${BASE}/masterlist`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const result = unwrap(text);
        const arr = Array.isArray(result) ? result : [];
        const employeesGroup = arr.find((g: any) => Number(g.LedgerGroupNameID) === SALES_PERSON_LEDGER_GROUP_NAME_ID);
        if (employeesGroup) setLedgerGroupID(String(employeesGroup.LedgerGroupID));
      })
      .catch(() => {});
  }, []);

  const loadGrid = useCallback((groupID: string) => {
    if (!groupID) return;
    setGridLoading(true);
    fetch(`${BASE}/grid/${groupID}`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const result = unwrap(text);
        const all = Array.isArray(result) ? result : [];
        // The only thing that actually distinguishes a Sales Person from any other Employee.
        setGridData(all.filter((r: any) => String(r.DepartmentID) === String(SALES_PERSON_DEPARTMENT_ID)));
      })
      .catch(() => setGridData([]))
      .finally(() => setGridLoading(false));
  }, []);

  useEffect(() => { if (ledgerGroupID) loadGrid(ledgerGroupID); }, [ledgerGroupID, loadGrid]);

  const loadFormFields = useCallback(async (prefill?: Record<string, any>) => {
    if (!ledgerGroupID) return;
    setFormLoading(true);
    setFormError("");
    try {
      const res = await fetch(`${BASE}/getmasterfields/${ledgerGroupID}`, { headers: authHeaders() });
      const raw = await res.text();
      const fields = unwrap(raw);
      if (!Array.isArray(fields)) {
        setFormError("Could not load form fields from server.");
        setFormLoading(false);
        return;
      }

      // DepartmentID and Designation are never shown — both are always forced to a fixed
      // sales-person value behind the scenes (see saveSalesPerson).
      const visibleFields = fields.filter((f: any) => f.FieldName !== "DepartmentID" && f.FieldName !== "Designation");
      setFormFields(visibleFields);

      const defaults: Record<string, any> = { ISLedgerActive: "true" };
      visibleFields.forEach((f: any) => {
        let dv = prefill?.[f.FieldName] ?? f.FieldDefaultValue ?? "";
        const dvLower = typeof dv === "string" ? dv.toLowerCase() : dv;
        if (f.FieldType !== "checkbox" && (dvLower === "false" || dvLower === "null" || dv === null)) dv = "";
        defaults[f.FieldName] = dv;
      });
      setFormValues(defaults);

      const sbFields = visibleFields.filter((f: any) => f.FieldType === "selectbox");
      const opts: Record<string, SelectOpt[]> = {};
      for (const f of sbFields) {
        if (f.SelectBoxDefault && f.SelectBoxDefault !== "null") {
          const staticOpts = f.SelectBoxDefault.split(/[,;|]/).map((x: string) => x.trim()).filter(Boolean);
          if (staticOpts.length > 0) {
            opts[f.FieldName] = staticOpts.map((s: string) => ({ value: s, label: s }));
            continue;
          }
        }
        if (!f.LedgerGroupFieldID || !f.SelectBoxQueryDB || f.SelectBoxQueryDB === "null") continue;
        try {
          const sbRes = await fetch(`${BASE}/selectboxload`, {
            method: "POST", headers: authHeaders(),
            body: JSON.stringify([{ FieldID: f.LedgerGroupFieldID, FieldName: f.FieldName }]),
          });
          const sbData = unwrap(await sbRes.text());
          if (sbData && typeof sbData === "object") {
            const allRows: any[] = sbData["tbl_" + f.FieldName] ?? [];
            if (allRows.length > 0) {
              const cols = Object.keys(allRows[0]);
              const is2col = cols.length >= 2;
              const dataRows = is2col && allRows.length > 1 ? allRows.slice(0, -1) : allRows;
              opts[f.FieldName] = dataRows
                .map((r: any) => ({ value: String(r[cols[0]] ?? ""), label: is2col ? String(r[cols[1]] ?? "") : String(r[cols[0]] ?? "") }))
                .filter(o => o.value !== "");
            }
          }
        } catch { /* silent */ }
      }
      setSelectOpts(opts);
      setView("form");
    } catch {
      setFormError("Network error loading form fields.");
    }
    setFormLoading(false);
  }, [ledgerGroupID]);

  const openAdd = () => {
    setEditing(null);
    setSubmitAttempted(false);
    loadFormFields();
  };

  const openEdit = async (row: any) => {
    setEditing(row);
    setSubmitAttempted(false);
    let full: any = row;
    try {
      const res = await fetch(`${BASE}/master-grid-loaded-data/${ledgerGroupID}/${row.LedgerID}`, { headers: authHeaders() });
      const data = unwrap(await res.text());
      if (Array.isArray(data) && data.length > 0) full = { ...full, ...data[0] };
    } catch { /* fall back to grid row */ }
    try {
      const res2 = await fetch(`${BASE}/ledger-date-fields/${row.LedgerID}`, { headers: authHeaders() });
      const dates = unwrap(await res2.text());
      if (Array.isArray(dates) && dates.length > 0) full = { ...full, ...dates[0] };
    } catch { /* ignore */ }
    setEditing(full);
    loadFormFields(full);
  };

  const saveSalesPerson = async () => {
    if (!can("/master/ledger", editing ? "CanEdit" : "CanSave")) {
      alert(editing ? "You are not authorized to edit Sales Person Master." : "You are not authorized to save Sales Person Master.");
      return;
    }
    setSubmitAttempted(true);
    const missing = formFields.find(f => isFieldVisible(f) && f.IsRequiredFieldValidator && !String(formValues[f.FieldName] ?? "").trim());
    if (missing) { setFormError((missing.FieldDisplayName || missing.FieldName) + " is required."); return; }
    setFormSaving(true);
    setFormError("");
    try {
      const masterRecord: Record<string, any> = {
        ...formValues,
        DepartmentID: SALES_PERSON_DEPARTMENT_ID,
        Designation: SALES_PERSON_DESIGNATION,
      };

      formFields.forEach((f: any) => {
        const v = masterRecord[f.FieldName];
        if (f.FieldType === "checkbox") {
          const checked = v === true || v === "true" || v === 1 || v === "1";
          masterRecord[f.FieldName] = checked ? "true" : "false";
        } else if (f.FieldType === "number" || String(f.FieldName).endsWith("ID")) {
          const n = Number(v);
          masterRecord[f.FieldName] = (v !== "" && v !== null && v !== undefined && !isNaN(n)) ? n : null;
        } else {
          const vLower = typeof v === "string" ? v.toLowerCase() : v;
          if (vLower === "false" || vLower === "null" || v === null || v === undefined || v === "") {
            masterRecord[f.FieldName] = null;
          }
        }
      });

      const isEdit = !!editing;
      const payload: Record<string, any> = {
        CostingDataLedgerMaster: [masterRecord],
        LedgerGroupID: Number(ledgerGroupID),
        LedgerRefCode: formValues["LedgerRefCode"] ?? "",
        ActiveLedger: formValues["ISLedgerActive"] ?? "true",
      };
      if (isEdit) {
        payload.LedgerID = editing.LedgerID ?? editing.id;
        payload.UnderGroupID = ledgerGroupID;
      }

      const endpoint = isEdit ? "update" : "save";
      const res = await fetch(`${BASE}/${endpoint}`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(payload),
      });
      const text = (await res.text()).replace(/^"|"$/g, "");
      if (res.ok && !text.toLowerCase().includes("fail") && !text.toLowerCase().includes("error") && !text.toLowerCase().includes("not authorized")) {
        loadGrid(ledgerGroupID);
        setView("list");
      } else {
        setFormError(text || "Save failed. Check console for details.");
      }
    } catch (e: any) {
      setFormError("Network error: " + e.message);
    }
    setFormSaving(false);
  };

  const deleteSalesPerson = async (row: any) => {
    if (!can("/master/ledger", "CanDelete")) { alert("You are not authorized to delete Sales Person Master."); return; }
    if (!confirm(`Delete "${row.LedgerName ?? "this sales person"}"?`)) return;
    await fetch(`${BASE}/deleteledger?ledgerID=${row.LedgerID}&ledgergroupID=${ledgerGroupID}`, {
      method: "POST", headers: authHeaders(),
    });
    loadGrid(ledgerGroupID);
  };

  const columns: Column<any>[] = [
    { key: "LedgerName", header: "Sales Person Name", sortable: true },
    { key: "MailingName", header: "Mailing Name", sortable: true },
    { key: "MobileNo", header: "Mobile" },
    { key: "Email", header: "Email" },
    { key: "ISLedgerActive", header: "Active", render: (r) => (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${String(r.ISLedgerActive) === "true" || r.ISLedgerActive === true ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        {String(r.ISLedgerActive) === "true" || r.ISLedgerActive === true ? "Active" : "Inactive"}
      </span>
    )},
  ];

  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">Sales Person Master</p>
            <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit Sales Person" : "Add Sales Person"}</h2>
          </div>
          <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <List size={16} /> Back to List
          </button>
        </div>

        {formError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {formLoading ? (
            <div className="flex items-center justify-center py-16 text-blue-600">
              <Loader2 size={24} className="animate-spin mr-2" /> Loading fields...
            </div>
          ) : (
            <>
              <SectionTitle title="Sales Person Details" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {formFields.filter(f => isFieldVisible(f)).map(field => (
                  <DynamicField key={field.FieldName} field={field}
                    value={formValues[field.FieldName] ?? ""}
                    options={selectOpts[field.FieldName] ?? []}
                    onChange={(v: any) => setFormValues(prev => ({ ...prev, [field.FieldName]: v }))}
                    submitAttempted={submitAttempted} />
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <button onClick={() => setFormValues(prev => ({ ...prev, ISLedgerActive: prev.ISLedgerActive === "false" ? "true" : "false" }))}
                  className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-12 h-6 rounded-full transition-colors relative ${formValues.ISLedgerActive !== "false" ? "bg-blue-500" : "bg-gray-300"}`}>
                    <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${formValues.ISLedgerActive !== "false" ? "left-7" : "left-1"}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </button>
              </div>

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                <button onClick={() => setView("list")} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={saveSalesPerson} disabled={formSaving}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60">
                  {formSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Save Sales Person
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Sales Person Master</h2>
          <p className="text-sm text-gray-500">{gridData.length} sales persons</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Sales Person
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        {gridLoading ? (
          <div className="flex items-center justify-center py-16 text-blue-600">
            <Loader2 size={24} className="animate-spin mr-2" /> Loading data...
          </div>
        ) : (
          <DataTable
            data={gridData.map((r, i) => ({ ...r, id: r.LedgerID ?? String(i) }))}
            columns={columns}
            searchKeys={["LedgerName", "MailingName", "MobileNo", "Email"]}
            actions={(row) => (
              <div className="flex items-center gap-2 justify-end">
                <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteSalesPerson(row)}>Delete</Button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
