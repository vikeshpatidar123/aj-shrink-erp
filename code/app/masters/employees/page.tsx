"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = "https://api.indusanalytics.co.in";

// â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function unwrap(raw: any): any {
  let result = raw;
  while (typeof result === "string") {
    try { result = JSON.parse(result); } catch { break; }
  }
  return result;
}

// â"€â"€ Shared UI â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// â"€â"€ SelectOpt type (mirrors ItemMaster pattern) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
type SelectOpt = { value: string; label: string };

// â"€â"€ Dynamic field renderer â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
    if (field.FieldType === "tagbox") {
      const selectedTags: string[] = value && value !== ""
        ? String(value).split(",").map((v: string) => v.trim()).filter(Boolean)
        : [];
      const toggle = (tag: string) => {
        const updated = selectedTags.includes(tag)
          ? selectedTags.filter(t => t !== tag)
          : [...selectedTags, tag];
        onChange(updated.join(","));
      };
      return (
        <div className="flex flex-col gap-2">
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                  {t}
                  <button type="button" onClick={() => toggle(t)}
                    className="text-blue-400 hover:text-blue-700 leading-none font-bold ml-0.5">×</button>
                </span>
              ))}
            </div>
          )}
          <div className="border border-gray-300 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">No options available</div>
            )}
            {options.map(opt => {
              const isSelected = selectedTags.includes(opt.value);
              return (
                <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors ${isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                    {isSelected && <Check size={10} className="text-white" />}
                  </div>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    // text / number
    return (
      <div className={"flex items-center border rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all " + (submitAttempted && field.IsRequiredFieldValidator && !String(value ?? "").trim() ? "border-red-400 bg-red-50/50" : "border-gray-300")}>
        <input type={field.FieldType === "number" ? "number" : "text"} value={value ?? ""}
          onChange={e => {
            if (field.FieldType === "number") {
              const v = e.target.value;
              if (v === "" || v === "-" || /^-?d*.?d*$/.test(v)) onChange(v);
            } else { onChange(e.target.value); }
          }} disabled={!!field.IsLocked}
          min={field.MinimumValue ?? 0} max={field.MaximumValue > 0 ? field.MaximumValue : undefined}
          placeholder={field.FieldDefaultValue && field.FieldDefaultValue !== "false" && field.FieldDefaultValue !== "null" ? field.FieldDefaultValue : ""}
          className="flex-1 w-full px-4 py-2 text-sm text-gray-800 outline-none disabled:bg-gray-50" />
        {field.UnitMeasurement && (
          <div className="bg-gray-50 px-4 py-2 text-sm text-gray-500 border-l border-gray-300 font-medium whitespace-nowrap">
            {field.UnitMeasurement}
          </div>
        )}
      </div>
    );
  };

  return (
    <Field label={field.FieldDisplayName ?? field.FieldName} required={!!field.IsRequiredFieldValidator}>
      {inner()}
    </Field>
  );
}

// â"€â"€ Date helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const todayStr = new Date().toISOString().split("T")[0];
const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

// â"€â"€ Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
export default function LedgerMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");

  // â"€â"€ Form state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [editing, setEditing] = useState<any | null>(null);
  const [formStep, setFormStep] = useState<"select-group" | "fill-form">("select-group");
  const [formGroupID, setFormGroupID] = useState("");
  const [formGroupName, setFormGroupName] = useState("");
  const [formFields, setFormFields] = useState<any[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [selectOpts, setSelectOpts] = useState<Record<string, SelectOpt[]>>({});
  const [formSaving, setFormSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // â"€â"€ Grid state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [allGroups, setAllGroups] = useState<{ LedgerGroupID: string; LedgerGroupName: string; LedgerGroupNameDisplay: string }[]>([]);
  const [taxHsnList, setTaxHsnList] = useState<{ id: string; code: string; name: string; gst: string }[]>([]);
  const [gridData, setGridData] = useState<any[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [activeGroupID, setActiveGroupID] = useState("");

  // â"€â"€ Date filter â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [fromDate, setFromDate] = useState(thirtyDaysAgoStr);
  const [toDate, setToDate] = useState(todayStr);

  // â"€â"€ Load group list on mount â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  useEffect(() => {
    fetch(`${BASE_URL}/api/ledgermasterShrink/masterlist`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        try {
          const result = unwrap(text);
          const arr = Array.isArray(result) ? result : [];
          setAllGroups(arr);
          if (arr.length > 0) setActiveGroupID(arr[0].LedgerGroupID);
        } catch { setAllGroups([]); }
      })
      .catch(() => setAllGroups([]));
  }, []);

  // â"€â"€ Load grid data when group changes â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const loadGrid = useCallback((groupID: string) => {
    if (!groupID) return;
    setGridLoading(true);
    setGridData([]);
    fetch(`${BASE_URL}/api/ledgermasterShrink/grid/${groupID}`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        try {
          const result = unwrap(text);
          setGridData(Array.isArray(result) ? result : []);
        } catch { setGridData([]); }
      })
      .catch(() => setGridData([]))
      .finally(() => setGridLoading(false));
  }, []);

  useEffect(() => { if (activeGroupID) loadGrid(activeGroupID); }, [activeGroupID, loadGrid]);

  // â"€â"€ Date-filtered grid data â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const filteredGridData = useMemo(() => {
    const dateField = Object.keys(gridData[0] ?? {}).find(k =>
      k.toLowerCase().includes("date") || k.toLowerCase().includes("createdon")
    ) ?? "";
    return gridData.filter(row => {
      const raw = row[dateField];
      if (!raw) return true;
      try {
        const d = new Date(raw).toISOString().split("T")[0];
        return d >= fromDate && d <= toDate;
      } catch { return true; }
    });
  }, [gridData, fromDate, toDate]);

  // â"€â"€ Load form fields for selected group â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const loadFormFields = useCallback(async (groupID: string, _groupName: string, prefill?: Record<string, any>) => {
    setFormLoading(true);
    setFormError("");
    try {
      const res = await fetch(`${BASE_URL}/api/ledgermasterShrink/getmasterfields/${groupID}`, { headers: authHeaders() });
      const raw = await res.text();
      const fields = unwrap(raw);

      if (!Array.isArray(fields)) {
        setFormError("Could not load form fields from server.");
        setFormLoading(false);
        return;
      }

      setFormFields(fields);

      // Initialize values — "false"/"null" bad defaults â†' "" for non-checkbox fields
      const defaults: Record<string, any> = { ISLedgerActive: "true" };
      fields.forEach((f: any) => {
        let dv = prefill?.[f.FieldName] ?? f.FieldDefaultValue ?? "";
        if (f.FieldType !== "checkbox" && (dv === "false" || dv === "null" || dv === null)) dv = "";
        defaults[f.FieldName] = dv;
      });
      setFormValues(defaults);

      // Load selectbox + tagbox options
      const sbFields = fields.filter((f: any) => f.FieldType === "selectbox" || f.FieldType === "tagbox");
      const opts: Record<string, SelectOpt[]> = {};

      for (const f of sbFields) {
        // Priority 1: SelectBoxDefault (static, no API call)
        if (f.SelectBoxDefault && f.SelectBoxDefault !== "null") {
          const staticOpts = f.SelectBoxDefault.split(/[,;|]/).map((x: string) => x.trim()).filter(Boolean);
          if (staticOpts.length > 0) {
            opts[f.FieldName] = staticOpts.map((s: string) => ({ value: s, label: s }));
            continue;
          }
        }

        // Priority 2: DB query via selectboxload (one field at a time — avoids early-return bug)
        if (!f.LedgerGroupFieldID || !f.SelectBoxQueryDB || f.SelectBoxQueryDB === "null") continue;

        try {
          const sbRes = await fetch(`${BASE_URL}/api/ledgermasterShrink/selectboxload`, {
            method: "POST", headers: authHeaders(),
            body: JSON.stringify([{ FieldID: f.LedgerGroupFieldID, FieldName: f.FieldName }]),
          });
          const sbRaw = await sbRes.text();
          const sbData = unwrap(sbRaw);

          if (sbData && typeof sbData === "object") {
            const tableKey = "tbl_" + f.FieldName;
            const rows: any[] = sbData[tableKey] ?? [];
            // Backend appends 1 metadata row only for queries containing ## placeholder
            const queryHasPlaceholder = (f.SelectBoxQueryDB || "").includes("##");
            const dataRows = queryHasPlaceholder && rows.length > 1 ? rows.slice(0, -1) : rows;
            if (dataRows.length > 0) {
              const cols = Object.keys(dataRows[0]);
              const is2col = cols.length >= 2;
              // 2-col: col[0]=ID (DB value), col[1]=display; 1-col: value===label
              opts[f.FieldName] = dataRows
                .map((r: any) => ({
                  value: String(r[cols[0]] ?? ""),
                  label: is2col ? String(r[cols[1]] ?? "") : String(r[cols[0]] ?? ""),
                }))
                .filter(o => o.value !== "");
            }
          }
        } catch { /* silent */ }
      }

      setSelectOpts(opts);

      // If this group has ProductHSNName field, load Tax/Service HSNs
      const needsTaxHsn = fields.some((fld: any) => fld.FieldName === "ProductHSNName" || fld.FieldName === "ProductHSNID");
      if (needsTaxHsn) {
        fetch(`${BASE_URL}/api/producthsnmasterShrink/showlist`, { headers: authHeaders() })
          .then(r => r.text())
          .then(text => {
            const raw = unwrap(text);
            const arr = Array.isArray(raw) ? raw : [];
            setTaxHsnList(arr
              .filter((h: any) => h.ProductCategory === "Tax / Service")
              .map((h: any) => ({
                id: String(h.ProductHSNID),
                code: h.HSNCode ?? "",
                name: h.DisplayName || h.ProductHSNName || h.HSNCode || "",
                gst: String(h.GSTTaxPercentage ?? "0"),
              })));
          })
          .catch(() => {});
      }

      setFormStep("fill-form");
    } catch {
      setFormError("Network error loading form fields.");
    }
    setFormLoading(false);
  }, []);

  // â"€â"€ Save ledger â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const saveLedger = async () => {
    setSubmitAttempted(true);
    const missing = formFields.find(f => f.IsRequiredFieldValidator && !String(formValues[f.FieldName] ?? "").trim());
    if (missing) { setFormError((missing.FieldDisplayName || missing.FieldName) + " is required."); return; }
    setFormSaving(true);
    setFormError("");
    try {
      // LedgerGroupID must NOT be in CostingDataLedgerMaster — backend adds it via AddColName/AddColValue
      // Sending it here causes "column specified more than once" SQL error
      const { LedgerGroupID: _lgid, ...formValuesWithoutGroupID } = formValues;
      const masterRecord: Record<string, any> = { ...formValuesWithoutGroupID };

      // Sanitize — same pattern as ItemMaster to avoid varcharâ†'bigint/real errors
      formFields.forEach((f: any) => {
        const v = masterRecord[f.FieldName];
        if (f.FieldType === "checkbox") {
          const checked = v === true || v === "true" || v === 1 || v === "1";
          masterRecord[f.FieldName] = checked ? "true" : "false";
        } else if (f.FieldType === "number" || String(f.FieldName).endsWith("ID")) {
          const n = Number(v);
          masterRecord[f.FieldName] = (v !== "" && v !== null && v !== undefined && !isNaN(n)) ? n : null;
        } else {
          if (v === "false" || v === "null" || v === null || v === undefined || v === "") {
            masterRecord[f.FieldName] = null;
          }
        }
      });

      const isEdit = !!editing;
      const payload: Record<string, any> = {
        CostingDataLedgerMaster: [masterRecord],
        LedgerGroupID: Number(formGroupID),
        LedgerRefCode: formValues["LedgerRefCode"] ?? formValues["StockRefCode"] ?? "",
        ActiveLedger: formValues["ISLedgerActive"] ?? "true",
      };

      if (isEdit) {
        payload.LedgerID = editing.LedgerID ?? editing.id;
        payload.UnderGroupID = formGroupID;
      }

      const endpoint = isEdit ? "update" : "save";
      const res = await fetch(`${BASE_URL}/api/ledgermasterShrink/${endpoint}`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(payload),
      });

      const text = (await res.text()).replace(/^"|"$/g, "");
      if (res.ok && !text.toLowerCase().includes("fail") && !text.toLowerCase().includes("error") && !text.toLowerCase().includes("not authorized")) {
        setActiveGroupID(formGroupID);
        setView("list");
      } else {
        setFormError(text || "Save failed. Check console for details.");
      }
    } catch (e: any) {
      setFormError("Network error: " + e.message);
    }
    setFormSaving(false);
  };

  // â"€â"€ Delete ledger â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const deleteLedger = async (row: any) => {
    const ledgerID = row.LedgerID ?? row.id;
    if (!confirm("Delete this ledger?")) return;
    await fetch(`${BASE_URL}/api/ledgermasterShrink/deleteledger?ledgerID=${ledgerID}&ledgergroupID=${activeGroupID}`, {
      method: "POST", headers: authHeaders(),
    });
    loadGrid(activeGroupID);
  };

  // â"€â"€ Open edit form â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const openEdit = (row: any) => {
    setEditing(row);
    setFormGroupID(activeGroupID);
    const grp = allGroups.find(g => g.LedgerGroupID === activeGroupID);
    setFormGroupName(grp?.LedgerGroupNameDisplay || grp?.LedgerGroupName || "");
    setFormStep("select-group");
    setView("form");
    loadFormFields(activeGroupID, grp?.LedgerGroupNameDisplay || "", row);
  };

  // â"€â"€ Grid columns — dynamic from backend data â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const liveColumns = useMemo((): Column<any>[] => {
    if (filteredGridData.length === 0) return [];
    const skip = new Set(["CompanyID", "FYear", "UserID", "CreatedBy", "ModifiedBy",
      "IsDeletedTransaction", "DeletedBy", "DeletedDate", "ModifiedDate", "IsLocked"]);
    return Object.keys(filteredGridData[0])
      .filter(k => !skip.has(k))
      .slice(0, 7)
      .map(k => ({ key: k, header: k.replace(/([A-Z])/g, " $1").trim(), sortable: true }));
  }, [filteredGridData]);

  // â"€â"€ FORM VIEW â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">Ledger Master</p>
            <h2 className="text-xl font-bold text-gray-800">
              {formStep === "fill-form" ? formGroupName : "Select Group"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setView("list"); setEditing(null); setFormStep("select-group"); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <List size={16} /> Back to List
            </button>
            {formStep === "fill-form" && (
              <button onClick={saveLedger} disabled={formSaving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60">
                {formSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Save Ledger
              </button>
            )}
          </div>
        </div>

        {formError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
        )}

        {/* Step 1: Select Group */}
        {formStep === "select-group" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <SectionTitle title="Select Ledger Group" />
            {formLoading ? (
              <div className="flex items-center justify-center py-16 text-blue-600">
                <Loader2 size={24} className="animate-spin mr-2" /> Loading fields...
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {allGroups.map(grp => (
                  <button key={grp.LedgerGroupID}
                    onClick={() => {
                      setFormGroupID(grp.LedgerGroupID);
                      setFormGroupName(grp.LedgerGroupNameDisplay || grp.LedgerGroupName);
                      loadFormFields(grp.LedgerGroupID, grp.LedgerGroupNameDisplay || grp.LedgerGroupName, editing ?? undefined);
                    }}
                    className="px-4 py-3 text-sm font-medium text-left border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all">
                    {grp.LedgerGroupNameDisplay || grp.LedgerGroupName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Fill Form */}
        {formStep === "fill-form" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Group pill */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center gap-3">
              <span className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg">
                {formGroupName}
              </span>
              <button onClick={() => setFormStep("select-group")}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                â† Change Group
              </button>
            </div>

            <div className="p-8">
              {formLoading ? (
                <div className="flex items-center justify-center py-16 text-blue-600">
                  <Loader2 size={24} className="animate-spin mr-2" /> Loading fields...
                </div>
              ) : (
                <>
                  <SectionTitle title="Ledger Details" />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {formFields
                      .filter(f => f.IsDisplay !== false && f.IsDisplay !== 0 && f.IsDisplay !== "0" && f.IsDisplay !== null
                        && f.FieldName !== "ProductHSNID" && f.FieldName !== "ProductHSNName")
                      .map(field => (
                        <DynamicField key={field.FieldName} field={field}
                          value={formValues[field.FieldName] ?? ""}
                          options={selectOpts[field.FieldName] ?? []}
                          onChange={(v: any) => setFormValues(prev => ({ ...prev, [field.FieldName]: v }))}
                          submitAttempted={submitAttempted} />
                      ))}

                    {/* Custom HSN/SAC picker — replaces old ProductHSNName selectbox */}
                    {formFields.some(f => f.FieldName === "ProductHSNName" || f.FieldName === "ProductHSNID") && (
                      <Field label="HSN / SAC Code">
                        {taxHsnList.length === 0 ? (
                          <div className="w-full px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-xs text-amber-700">
                            No &quot;Tax / Service&quot; HSN codes found. Add them in HSN Master first.
                          </div>
                        ) : (
                          <select
                            value={String(formValues.ProductHSNName ?? "")}
                            onChange={e => {
                              const selected = taxHsnList.find(h => h.id === e.target.value);
                              setFormValues(prev => ({
                                ...prev,
                                ProductHSNName: e.target.value ? Number(e.target.value) : null,
                                ...(selected ? { TaxPercentage: selected.gst } : {}),
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          >
                            <option value="">-- Select HSN / SAC --</option>
                            {taxHsnList.map(h => (
                              <option key={h.id} value={h.id}>{h.code}{h.name ? ` — ${h.name}` : ""}</option>
                            ))}
                          </select>
                        )}
                        {formValues.ProductHSNName && (() => {
                          const sel = taxHsnList.find(h => h.id === String(formValues.ProductHSNName));
                          return sel ? (
                            <p className="text-xs text-blue-600 mt-1 font-medium">GST {sel.gst}% auto-filled in Tax Percentage</p>
                          ) : null;
                        })()}
                      </Field>
                    )}
                  </div>

                  {/* Active Ledger toggle */}
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <button onClick={() => setFormValues(prev => ({ ...prev, ISLedgerActive: prev.ISLedgerActive === "false" ? "true" : "false" }))}
                      className="flex items-center gap-3 cursor-pointer">
                      <div className={`w-12 h-6 rounded-full transition-colors relative ${formValues.ISLedgerActive !== "false" ? "bg-blue-500" : "bg-gray-300"}`}>
                        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${formValues.ISLedgerActive !== "false" ? "left-7" : "left-1"}`} />
                      </div>
                      <span className="text-sm font-medium text-gray-700">Active Ledger</span>
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                    <button onClick={() => setFormStep("select-group")}
                      className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      â† Change Group
                    </button>
                    <button onClick={saveLedger} disabled={formSaving}
                      className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60">
                      {formSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Save Ledger
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // â"€â"€ LIST VIEW â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Ledger Master</h2>
          <p className="text-sm text-gray-500">{filteredGridData.length} records</p>
        </div>
        <button onClick={() => { setEditing(null); setFormStep("select-group"); setFormValues({}); setFormFields([]); setSelectOpts({}); setView("form"); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Ledger
        </button>
      </div>

      {/* Group pills */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Group</span>
          {allGroups.map(grp => (
            <button key={grp.LedgerGroupID} onClick={() => setActiveGroupID(grp.LedgerGroupID)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeGroupID === grp.LedgerGroupID ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {grp.LedgerGroupNameDisplay || grp.LedgerGroupName}
            </button>
          ))}
        </div>
      </div>

      {/* Date filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4 flex-wrap">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Date Filter</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <span className="text-xs text-gray-400">{filteredGridData.length} of {gridData.length}</span>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        {gridLoading ? (
          <div className="flex items-center justify-center py-16 text-blue-600">
            <Loader2 size={24} className="animate-spin mr-2" /> Loading data...
          </div>
        ) : (
          <DataTable
            data={filteredGridData.map((r, i) => ({ ...r, id: r.LedgerID ?? String(i) }))}
            columns={liveColumns}
            searchKeys={liveColumns.map(c => c.key as string)}
            actions={(row) => (
              <div className="flex items-center gap-2 justify-end">
                <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteLedger(row)}>Delete</Button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
