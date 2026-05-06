"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, Save, List, Check, Loader2 } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:57214").replace(/\/$/, "");

// ── Shared UI components (must be outside main component to avoid focus loss) ──
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

// ── Module-level constants ──────────────────────────────────────────────────────

// Fix 4: Moved to module scope — same string was duplicated inside DynamicField and cascade JSX section
const INPUT_CLS = "w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";

// CASCADE_HANDLED_FIELDS removed — now built dynamically inside component from DB field metadata

// Fix 4: Moved to module scope — was a local const re-created inside the component body each render
const DATE_FIELDS = ["CreatedDate", "ModifiedDate", "EntryDate", "ItemDate", "Date", "AddedDate"];

// ── Dynamic field renderer ──────────────────────────────────────────────────────
// Each selectbox option carries both the DB value (col[0]) and display label (col[1])
// For 1-col tables: value === label; For 2-col tables: value = ID, label = display name
type SelectOpt = { value: string; label: string; description?: string };

// Strip special characters — allow letters, numbers, spaces, dot, hyphen, slash
function stripSpecial(v: string): string {
  return v.replace(/[^a-zA-Z0-9 .\-\/]/g, "");
}

// Fix 1: Single HSN helper — replaces duplicate inline logic in loadFormFields + both onChange handlers.
// Returns { nameKey, description } when fieldName matches ProductHSNID pattern; null otherwise.
function resolveHsnPair(
  fieldName: string,
  selectedID: string,
  opts: SelectOpt[]
): { nameKey: string; description: string } | null {
  if (!/ProductHSNID$/i.test(fieldName)) return null;
  const description = opts.find(o => o.value === String(selectedID))?.description ?? "";
  return { nameKey: fieldName.replace(/ID$/i, "Name"), description };
}

// Fix 4: Moved to module scope — pure function with no dependency on component state
// Builds ItemName from ItemNameFormula (mirrors old DynamicMasters.js logic)
function buildItemName(values: Record<string, any>, fields: any[], formula: string[]): string {
  let name = "";
  for (const fieldName of formula) {
    const field = fields.find((f: any) => f.FieldName === fieldName);
    const raw = values[fieldName];
    const val = raw !== undefined && raw !== null ? String(raw).trim() : "";
    if (!val || val === "0" || val === "-") continue;

    const unit = field?.UnitMeasurement ?? "";
    let part = "";
    if (fieldName === "GSM") part = val + " GSM";
    else if (fieldName === "ItemSize") part = val + " MM";
    else if (unit) part = val + " " + unit;
    else part = val;

    name = name === "" ? part : name + ", " + part;
  }
  return name;
}

// Fix 4: Extracted helper — identical 4-condition visibility check was repeated in two filter() calls
function isFieldVisible(f: any): boolean {
  return f.IsDisplay !== false && f.IsDisplay !== 0 && f.IsDisplay !== "0" && f.IsDisplay !== null;
}

// ── Helper: unwrap triple-encoded JSON ─────────────────────────────────────────
function unwrap(raw: any): any {
  let result = raw;
  while (typeof result === "string") {
    try { result = JSON.parse(result); } catch { break; }
  }
  return result;
}

function DynamicField({ field, value, options, onChange, submitAttempted }: {
  field: any;
  value: any;
  options: SelectOpt[];
  onChange: (v: any) => void;
  submitAttempted?: boolean;
}) {
  const isHSN = /hsn/i.test(field.FieldName ?? "");

  const inner = () => {
    if (field.FieldType === "selectbox") {
      if (isHSN || !!field.IsLocked) {
        // HSN fields and locked cascading fields
        const finalOpts = [...options];
        if (value && !finalOpts.some(o => String(o.value) === String(value))) {
          finalOpts.unshift({ value: value, label: `${value}` });
        }

        return (
          <select
            value={value ?? ""}
            onChange={e => onChange(e.target.value)}
            disabled={!!field.IsLocked}
            className={INPUT_CLS}
          >
            <option value="">-- Select --</option>
            {finalOpts.map((o, i) => (
              <option key={`${i}-${o.value}`} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      }

      // Fields with a fixed controlled list → constrained select (user cannot type custom values)
      const isConstrainedSelect = /^(StockType|StockCategory|PackingType|SupplyType|GSTRegistrationType|PartyType|CustomerType|CustomerCategory|Designation|TaxType|GSTLedgerType)$/i.test(field.FieldName ?? "");

      if (isConstrainedSelect) {
        const finalOpts = [...options];
        if (value && !finalOpts.some(o => String(o.value) === String(value) || o.label === value)) {
          finalOpts.unshift({ value: value, label: value });
        }
        return (
          <select
            value={value ?? ""}
            onChange={e => onChange(e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">-- Select --</option>
            {finalOpts.map((o, i) => (
              <option key={`${i}-${o.value}`} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      }

      // All other selectbox fields: free-type input with dropdown suggestions (datalist)
      const listId = `dl_${field.FieldName}`;
      return (
        <>
          <input
            type="text"
            list={listId}
            value={value ?? ""}
            onChange={e => onChange(stripSpecial(e.target.value))}
            placeholder={options.length > 0 ? "Type or choose from list..." : (field.FieldDefaultValue ?? "Type here...")}
            className={INPUT_CLS}
          />
          {options.length > 0 && (
            <datalist id={listId}>
              {options.map((o, i) => (
                <option key={`${i}-${o.value}`} value={o.label} />
              ))}
            </datalist>
          )}
        </>
      );
    }

    if (field.FieldType === "checkbox") {
      const checked = value === true || value === "true" || value === 1 || value === "1";
      return (
        <label className="flex items-center gap-2.5 cursor-pointer select-none mt-1">
          <div
            onClick={() => onChange(!checked)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}
          >
            {checked && <Check size={12} className="text-white" strokeWidth={3} />}
          </div>
          <span className="text-sm text-gray-700">Yes</span>
        </label>
      );
    }
    if (field.FieldType === "textarea") {
      return (
        <textarea
          value={value ?? ""}
          onChange={e => onChange(stripSpecial(e.target.value))}
          rows={3}
          disabled={!!field.IsLocked}
          placeholder={field.FieldDefaultValue && field.FieldDefaultValue !== "false" && field.FieldDefaultValue !== "null" ? field.FieldDefaultValue : ""}
          className={INPUT_CLS + " resize-none"}
        />
      );
    }
    if (field.FieldType === "datebox") {
      return (
        <input
          type="date"
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          disabled={!!field.IsLocked}
          className={INPUT_CLS}
        />
      );
    }
    // text / number (default)
    return (
      <div className={"flex items-center border rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all " + (submitAttempted && field.IsRequiredFieldValidator && !String(value ?? "").trim() ? "border-red-400 bg-red-50/50" : "border-gray-300")}>
        <input
          type={field.FieldType === "number" ? "number" : "text"}
          value={value ?? ""}
          onChange={e => {
            if (field.FieldType === "number") {
              // Numbers only — reject any non-numeric input
              const v = e.target.value;
              if (v === "" || v === "-" || /^-?\d*\.?\d*$/.test(v)) onChange(v);
            } else {
              // Text — strip special characters
              onChange(stripSpecial(e.target.value));
            }
          }}
          disabled={!!field.IsLocked}
          min={field.MinimumValue ?? 0}
          max={field.MaximumValue > 0 ? field.MaximumValue : undefined}
          placeholder={field.FieldDefaultValue && field.FieldDefaultValue !== "false" && field.FieldDefaultValue !== "null" ? field.FieldDefaultValue : ""}
          className="flex-1 w-full px-4 py-2 text-sm text-gray-800 outline-none disabled:bg-gray-50"
        />
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

export default function ItemMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [companyName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("companyName") || "Item Master" : "Item Master"
  );

  // ── Dynamic form state ──────────────────────────────────────────────────────
  const [editing, setEditing] = useState<any | null>(null);
  const [formStep, setFormStep] = useState<"select-group" | "fill-form">("select-group");
  const [formGroupID, setFormGroupID] = useState("");
  const [formGroupName, setFormGroupName] = useState("");
  const [formFields, setFormFields] = useState<any[]>([]);

  // ── Cascade field detection — driven by DB metadata (FieldName) ────────────
  // Sub Group 1 = ItemSubGroupID (fixed DB column name, always the same)
  const subGroup1Field = useMemo(() => formFields.find(f => f.FieldName === "ItemSubGroupID"), [formFields]);
  // Sub Group 2 = Quality (Film groups) OR ItemType (Ink/other groups) — detected by FieldName
  const subGroup2Field = useMemo(() => formFields.find(f => ["Quality", "ItemType"].includes(f.FieldName)), [formFields]);
  // Sub Group 3 = TypeSpecification / TypeSpacification (spelling varies across groups)
  const subGroup3Field = useMemo(() => formFields.find(f => /typesp[ae]cification/i.test(f.FieldName ?? "")), [formFields]);
  // Supplier = Manufecturer / Manufacturer
  const supplierField = useMemo(() => formFields.find(f => /manufect?urer/i.test(f.FieldName ?? "")), [formFields]);

  // Resolved field names — used when reading/writing formValues
  const sg2FieldName = subGroup2Field?.FieldName ?? "Quality";
  const sg3FieldName = subGroup3Field?.FieldName ?? "TypeSpecification";
  // Alias kept for backward compat with useCallbacks that resolve locally
  const typeSpecFieldName = sg3FieldName;

  // True for any group whose DB config includes an ItemSubGroupID field
  const hasCascadeFields = !!subGroup1Field;

  // Dynamic set of field names rendered by the hardwired cascade section (excluded from DynamicField)
  const cascadeHandledNames = useMemo(() => new Set([
    "itemsubgroupid",
    sg2FieldName.toLowerCase(),
    sg3FieldName.toLowerCase(),
    "manufecturer", "manufacturer",
    "purchaseunit", "estimationunit", "stockunit",
  ]), [sg2FieldName, sg3FieldName]);

  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [selectOpts, setSelectOpts] = useState<Record<string, SelectOpt[]>>({});
  const [formSaving, setFormSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [itemNameFormula, setItemNameFormula] = useState<string[]>([]);

  // Generic cascading sub-group state (used for any group with ItemSubGroupID in formFields)
  const [sgSubGroupOpts, setSgSubGroupOpts] = useState<{ id: string; name: string; displayName: string; subGroupPrefix?: string }[]>([]);
  const [sgTypeOpts, setSgTypeOpts] = useState<{ type: string; prefix: string }[]>([]);
  const [sgTypeSpecOpts, setSgTypeSpecOpts] = useState<{ spec: string; prefix: string }[]>([]);
  const [sgSupplierOpts, setSgSupplierOpts] = useState<{ id: string; name: string }[]>([]);
  const [sgUnitOpts, setSgUnitOpts] = useState<{ id: string; name: string }[]>([]);
  const [sgSubGroupName, setSgSubGroupName] = useState("");
  const [sgSubGroupDisplayName, setSgSubGroupDisplayName] = useState("");
  const [sgSubGroupPrefix, setSgSubGroupPrefix] = useState("");
  const [sgTypePrefix, setSgTypePrefix] = useState("");
  const [sgSpecPrefix, setSgSpecPrefix] = useState("");

  // Fix 5: Ref flag — when openEdit() fully prefetches cascade state upfront, this is set to true.
  // The three useEffects below check this flag and skip if prefetch already handled everything,
  // preventing them from overriding correctly loaded edit values.
  const editPrefetchDone = useRef(false);

  // ── Live grid state (real backend data) ────────────────────────────────────
  const [allGroups, setAllGroups] = useState<{ ItemGroupID: string; ItemGroupName: string; ItemGroupPrefix: string; ItemGroupCategory: string }[]>([]);
  const [gridData, setGridData] = useState<any[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [activeGroupID, setActiveGroupID] = useState("");

  // Date filter — default: last 30 days
  const todayStr = new Date().toISOString().split("T")[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(thirtyDaysAgoStr);
  const [toDate, setToDate] = useState(todayStr);

  const filteredGridData = useMemo(() => {
    if (!gridData.length) return gridData;
    const dateField = DATE_FIELDS.find(f => f in gridData[0]);
    if (!dateField) return gridData;
    return gridData.filter(row => {
      const raw = row[dateField];
      if (!raw) return true;
      try {
        const d = new Date(raw).toISOString().split("T")[0];
        return d >= fromDate && d <= toDate;
      } catch {
        return true;
      }
    });
  }, [gridData, fromDate, toDate]);

  // Load all item groups from backend on mount
  useEffect(() => {
    fetch(`${BASE_URL}/api/itemmasterShrink/items`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        try {
          const result = unwrap(text);
          setAllGroups(Array.isArray(result) ? result : []);
        } catch { setAllGroups([]); }
      })
      .catch(() => setAllGroups([]));
  }, []);

  // Load cascading base data when a cascade-group form is opened (add mode trigger)
  useEffect(() => {
    if (!hasCascadeFields || formStep !== "fill-form" || !formGroupID) return;
    fetch(`${BASE_URL}/api/itemmasterShrink/film-subgroups/${formGroupID}`, { headers: authHeaders() })
      .then(r => r.text()).then(text => {
        const raw = unwrap(text);
        setSgSubGroupOpts(Array.isArray(raw) ? raw.map((r: any) => ({ id: String(r.ItemSubGroupID), name: String(r.ItemSubGroupName), displayName: String(r.ItemSubGroupDisplayName ?? r.ItemSubGroupName ?? ""), subGroupPrefix: String(r.SubGroupPrefix ?? "") })) : []);
      }).catch(() => setSgSubGroupOpts([]));
    fetch(`${BASE_URL}/api/itemmasterShrink/suppliers`, { headers: authHeaders() })
      .then(r => r.text()).then(text => {
        const raw = unwrap(text);
        setSgSupplierOpts(Array.isArray(raw) ? raw.map((r: any) => ({ id: String(r.LedgerID), name: String(r.LedgerName) })) : []);
      }).catch(() => setSgSupplierOpts([]));
    fetch(`${BASE_URL}/api/itemmasterShrink/units`, { headers: authHeaders() })
      .then(r => r.text()).then(text => {
        const raw = unwrap(text);
        setSgUnitOpts(Array.isArray(raw) ? raw.map((r: any) => ({ id: String(r.UnitID), name: String(r.UnitName) })) : []);
      }).catch(() => setSgUnitOpts([]));
  }, [hasCascadeFields, formGroupID, formStep]);

  // All three cascade effects guard on editPrefetchDone.current.
  // In edit mode, openEdit() sets the flag AFTER prefetching — so these effects skip entirely.
  // In add mode, the flag is false and effects run normally when the user selects dropdowns.

  // When subgroup opts load: pre-load types for existing value
  useEffect(() => {
    if (editPrefetchDone.current) return;
    if (!hasCascadeFields || !sgSubGroupOpts.length) return;
    const existingID = String(formValues["ItemSubGroupID"] ?? "");
    if (!existingID) return;
    const found = sgSubGroupOpts.find(o => o.id === existingID);
    if (found && !sgSubGroupName) {
      setSgSubGroupName(found.name);
      setSgSubGroupDisplayName(found.displayName);
      if (found.subGroupPrefix) setSgSubGroupPrefix(found.subGroupPrefix);
    }
    if (!sgTypeOpts.length) loadSgTypes(formGroupID, existingID);
  }, [sgSubGroupOpts]);

  // When type opts load: pre-load type-specs + set type prefix for existing value
  useEffect(() => {
    if (editPrefetchDone.current) return;
    if (!hasCascadeFields || !sgTypeOpts.length) return;
    const existingType = String(formValues[sg2FieldName] ?? "");
    const existingID = String(formValues["ItemSubGroupID"] ?? "");
    if (!existingType) return;
    const found = sgTypeOpts.find(o => o.type === existingType);
    if (found) setSgTypePrefix(found.prefix);
    if (!existingID || sgTypeSpecOpts.length) return;
    loadSgTypeSpecs(formGroupID, existingID, existingType);
  }, [sgTypeOpts]);

  // When type-spec opts load: set spec prefix for existing value
  useEffect(() => {
    if (editPrefetchDone.current) return;
    if (!hasCascadeFields || !sgTypeSpecOpts.length) return;
    const existingSpec = String(formValues[sg3FieldName] ?? "");
    if (!existingSpec) return;
    const found = sgTypeSpecOpts.find(o => o.spec === existingSpec);
    if (found) setSgSpecPrefix(found.prefix);
  }, [sgTypeSpecOpts]);

  // Fetch item grid for a specific group
  const loadGridForGroup = useCallback((masterID: string) => {
    if (!masterID) { setGridData([]); return; }
    setGridLoading(true);
    fetch(`${BASE_URL}/api/itemmasterShrink/grid/${masterID}`, { headers: authHeaders() })
      .then(async r => {
        const text = await r.text();
        return text;
      })
      .then(text => {
        try {
          const result = unwrap(text);
          setGridData(Array.isArray(result)
            ? result
              .filter((r: any, i: number, arr: any[]) => arr.findIndex((x: any) => String(x.ItemID) === String(r.ItemID)) === i)
              .map((r: any) => ({ ...r, id: String(r.ItemID) }))
            : []);
        } catch { setGridData([]); }
      })
      .catch(() => setGridData([]))
      .finally(() => setGridLoading(false));
  }, []);

  // Load form fields for a group from backend
  const loadFormFields = useCallback(async (groupID: string, _groupName: string, prefill?: Record<string, any>) => {
    setFormLoading(true);
    setFormError("");
    try {
      const [fieldsRes, formulaRes] = await Promise.all([
        fetch(`${BASE_URL}/api/itemmasterShrink/getmasterfields/${groupID}`, { headers: authHeaders() }),
        fetch(`${BASE_URL}/api/itemmasterShrink/grid-column-hide/${groupID}`, { headers: authHeaders() }),
      ]);

      const raw = await fieldsRes.text();
      const fields = unwrap(raw);

      if (!Array.isArray(fields)) {
        setFormError("Could not load form fields from server.");
        setFormLoading(false);
        return;
      }

      try {
        const formulaRaw = await formulaRes.text();
        const formulaData = unwrap(formulaRaw);
        const formula: string = (Array.isArray(formulaData) ? formulaData[0]?.ItemNameFormula : formulaData?.ItemNameFormula) ?? "";
        setItemNameFormula(formula ? formula.split(",").map((s: string) => s.trim()).filter(Boolean) : []);
      } catch { setItemNameFormula([]); }

      const seenFields = new Set<string>();
      const uniqueFields = fields.filter((f: any) => {
        const key = (f.FieldName ?? "").toLowerCase();
        if (seenFields.has(key)) return false;
        seenFields.add(key);
        return true;
      });
      uniqueFields.sort((a: any, b: any) => (Number(a.FieldDrawSequence) || 999) - (Number(b.FieldDrawSequence) || 999));
      const hsnIdIdx = uniqueFields.findIndex(f => (f.FieldName || "").toLowerCase() === "producthsnid");
      const hsnNameIdx = uniqueFields.findIndex(f => (f.FieldName || "").toLowerCase() === "producthsnname");

      setFormFields(uniqueFields);

      const tsFieldName = uniqueFields.find((f: any) => /typesp[ae]cification/i.test(f.FieldName ?? ""))?.FieldName ?? "TypeSpecification";

      const defaults: Record<string, any> = { ISItemActive: "true" };

      const prefillLower: Record<string, any> = {};
      if (prefill) {
        Object.keys(prefill).forEach(k => {
          const lowerKey = k.toLowerCase();
          prefillLower[lowerKey] = prefill[k];
          if (lowerKey === "typespacification") prefillLower["typespecification"] = prefill[k];
          if (lowerKey === "typespecification") prefillLower["typespacification"] = prefill[k];
        });
      }

      uniqueFields.forEach((f: any) => {
        let dv = prefillLower[(f.FieldName || "").toLowerCase()] ?? f.FieldDefaultValue ?? "";
        if (typeof dv === "string") dv = dv.trim();
        if (f.FieldType === "checkbox" || f.FieldDataType === "bit") {
          dv = (dv === true || dv === "true" || dv === 1 || dv === "1");
        } else if (dv === "false" || dv === "null" || dv === null) {
          dv = "";
        }
        defaults[f.FieldName] = dv;
      });

      if (!defaults["Quality"]) {
        let q = prefillLower["quality"] ?? "";
        if (typeof q === "string") q = q.trim();
        defaults["Quality"] = q;
      }

      const sbFields = uniqueFields.filter((f: any) => f.FieldType === "selectbox");
      const opts: Record<string, SelectOpt[]> = {};

      for (const f of sbFields) {
        if (f.SelectBoxDefault && f.SelectBoxDefault !== "null") {
          const staticOpts = f.SelectBoxDefault
            .split(/[,;|]/)
            .map((x: string) => x.trim())
            .filter(Boolean);
          if (staticOpts.length > 0) {
            opts[f.FieldName] = staticOpts.map((s: string) => ({ value: s, label: s }));
            continue;
          }
        }

        if (!f.ItemGroupFieldID || !f.SelectBoxQueryDB || f.SelectBoxQueryDB === "null") continue;
        if ((f.FieldName || "").toLowerCase() === "producthsnid") continue;

        try {
          const sbRes = await fetch(`${BASE_URL}/api/itemmasterShrink/selectboxload`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify([{ FieldID: f.ItemGroupFieldID, FieldName: f.FieldName }]),
          });
          const sbRaw = await sbRes.text();
          const sbData = unwrap(sbRaw);

          if (sbData && typeof sbData === "object") {
            const tableKey = "tbl_" + f.FieldName;
            const rows: any[] = sbData[tableKey] ?? [];
            const dataRows = rows.length > 1 ? rows.slice(0, -1) : rows;

            if (dataRows.length > 0) {
              const cols = Object.keys(dataRows[0]);
              const is3col = cols.length >= 3;
              const is2col = cols.length >= 2;
              opts[f.FieldName] = dataRows
                .map((r: any) => ({
                  value: String(r[cols[0]] ?? ""),
                  label: is2col ? String(r[cols[1]] ?? "") : String(r[cols[0]] ?? ""),
                  description: is3col ? String(r[cols[2]] ?? "") : undefined,
                }))
                .filter(o => o.value !== "");
            }
          }
        } catch { /* silent */ }
      }

      if (prefill) {
        uniqueFields.forEach((f: any) => {
          if (f.FieldType !== "selectbox") return;
          const storedID = String(prefill[f.FieldName] ?? "");
          if (!storedID || storedID === "0") return;
          const pair = resolveHsnPair(f.FieldName, storedID, opts[f.FieldName] ?? []);
          if (pair && uniqueFields.find((ff: any) => ff.FieldName === pair.nameKey)) {
            defaults[pair.nameKey] = pair.description;
          }
        });
      }

      if (prefill?.[tsFieldName] !== undefined) {
        defaults[tsFieldName] = prefill[tsFieldName] ?? "";
      }
      if (prefill?.ItemDisplayName !== undefined) {
        defaults["ItemDisplayName"] = prefill["ItemDisplayName"] ?? "";
      }

      if (hsnNameIdx !== -1) {
        const hn = uniqueFields[hsnNameIdx].FieldName;
        opts[hn] = [];
      }

      setSelectOpts(opts);
      setFormValues(defaults);
      setFormStep("fill-form");
    } catch {
      setFormError("Network error loading form fields.");
    }
    setFormLoading(false);
  }, []);

  // Generic cascading loaders (work for any item group)
  const loadSgTypes = useCallback((groupID: string, subGroupID: string) => {
    setSgTypeOpts([]);
    setSgTypeSpecOpts([]);
    setSgTypePrefix("");
    setSgSpecPrefix("");
    if (!subGroupID || !groupID) return;
    fetch(`${BASE_URL}/api/itemmasterShrink/film-types/${groupID}/${subGroupID}`, { headers: authHeaders() })
      .then(r => r.text()).then(text => {
        const raw = unwrap(text);
        setSgTypeOpts(Array.isArray(raw) ? raw.map((r: any) => ({ type: String(r.SubGroupType), prefix: String(r.SubGroupTypePrefix ?? "") })).filter(o => o.type) : []);
      }).catch(() => setSgTypeOpts([]));
  }, []);

  const loadSgTypeSpecs = useCallback((groupID: string, subGroupID: string, type: string) => {
    setSgTypeSpecOpts([]);
    setSgSpecPrefix("");
    if (!subGroupID || !type || !groupID) return;
    fetch(`${BASE_URL}/api/itemmasterShrink/film-type-specs`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ ItemGroupID: groupID, SubGroupID: subGroupID, SubGroupType: type }),
    }).then(r => r.text()).then(text => {
      const raw = unwrap(text);
      setSgTypeSpecOpts(Array.isArray(raw) ? raw.map((r: any) => ({ spec: String(r.TypeSpecification), prefix: String(r.TypeSpacificationPrefix ?? "") })).filter(o => o.spec) : []);
    }).catch(() => setSgTypeSpecOpts([]));
  }, []);

  // Fix 4: Unified group detection — form and grid now use the same regex (was .includes() in grid)
  const isFilmGroup = /film|reel|bopp|poly|laminate/i.test(formGroupName);
  const isInkGroup = /ink/i.test(formGroupName);

  // True when selected group is a consumable category — must be defined before sgItemName/sgDisplayName
  const isConsumableGroup = useMemo(() => {
    const grp = allGroups.find(g => String(g.ItemGroupID) === String(formGroupID));
    if (!grp) return false;
    const cat = (grp.ItemGroupCategory || "").toLowerCase().trim();
    const name = (grp.ItemGroupName || "").toLowerCase().trim();
    return cat === "consumable" || cat === "consumables" || cat === "other material" || /other[\s-]*material/i.test(name);
  }, [formGroupID, allGroups]);

  const sgItemName = useMemo(() => {
    if (!hasCascadeFields) return "";

    const sv = (k: string) => String(formValues[k] ?? "").trim();
    const skip = (v: string) => !v || v === "0";
    const typeSpec = sv(sg3FieldName);
    const sgType = sv(sg2FieldName);

    if (isFilmGroup) {
      const parts: string[] = [];
      if (!skip(sgSubGroupName)) parts.push(sgSubGroupName);
      if (!skip(sgType)) parts.push(sgType);
      if (!skip(typeSpec)) parts.push(typeSpec);
      const density = sv("Density");
      if (!skip(density)) parts.push(`${density} D`);
      const sizeW = sv("SizeW"), thick = sv("Thickness");
      if (sizeW && thick) parts.push(`${sizeW} MM X ${thick} µ`);
      else if (sizeW) parts.push(`${sizeW} MM`);
      else if (thick) parts.push(`${thick} µ`);
      return parts.join("/");
    }

    if (isInkGroup) {
      const parts: string[] = [];
      if (!skip(sgSubGroupName)) parts.push(sgSubGroupName);
      if (!skip(sgType)) parts.push(sgType);
      if (!skip(typeSpec)) parts.push(typeSpec);
      if (!skip(sv("InkColour"))) parts.push(sv("InkColour"));
      return parts.join("/");
    }

    if (isConsumableGroup) {
      const parts: string[] = [];
      if (!skip(sgSubGroupName)) parts.push(sgSubGroupName);
      if (!skip(sgType)) parts.push(sgType);
      if (!skip(typeSpec)) parts.push(typeSpec);
      const sizeW = sv("SizeW");
      if (!skip(sizeW)) parts.push(`${sizeW} MM`);
      return parts.join("/");
    }

    const sizeW = sv("SizeW"), thick = sv("Thickness");
    const sizeThickness = sizeW && thick ? `${sizeW}X${thick}` : sizeW || thick;
    const rawParts = [sgType, sgSubGroupName, formGroupName, typeSpec, sizeThickness || null, sv("Density")];
    return rawParts.filter(v => v && v !== "0").map(v => String(v).trim()).join("/");
  }, [hasCascadeFields, isFilmGroup, isInkGroup, isConsumableGroup, formValues, sgSubGroupName, formGroupName, sg2FieldName, sg3FieldName]);

  const sgDisplayName = useMemo(() => {
    if (!hasCascadeFields) return "";

    const sv = (k: string) => String(formValues[k] ?? "").trim();
    const skip = (v: string) => !v || v === "0";

    if (isFilmGroup) {
      const parts: string[] = [];
      if (!skip(sgSubGroupDisplayName)) parts.push(sgSubGroupDisplayName);
      if (!skip(sgTypePrefix)) parts.push(sgTypePrefix);
      if (!skip(sgSpecPrefix)) parts.push(sgSpecPrefix);
      const density = sv("Density");
      if (!skip(density)) parts.push(`${density}D`);
      const sizeW = sv("SizeW"), thick = sv("Thickness");
      if (sizeW && thick) parts.push(`${sizeW}MM X ${thick}µ`);
      else if (sizeW) parts.push(`${sizeW}MM`);
      else if (thick) parts.push(`${thick}µ`);
      return parts.join("/");
    }

    if (isInkGroup) {
      const parts: string[] = [];
      if (!skip(sgSubGroupDisplayName)) parts.push(sgSubGroupDisplayName);
      if (!skip(sgTypePrefix)) parts.push(sgTypePrefix);
      if (!skip(sgSpecPrefix)) parts.push(sgSpecPrefix);
      if (!skip(sv("InkColour"))) parts.push(sv("InkColour"));
      return parts.join("/");
    }

    if (isConsumableGroup) {
      const parts: string[] = [];
      if (!skip(sgSubGroupDisplayName)) parts.push(sgSubGroupDisplayName);
      if (!skip(sgTypePrefix)) parts.push(sgTypePrefix);
      if (!skip(sgSpecPrefix)) parts.push(sgSpecPrefix);
      return parts.join("/");
    }

    // Default: show prefixes only; if no prefix exists fall back to full item name
    const prefixParts = [sgTypePrefix, sgSpecPrefix].filter(v => v && v !== "0").map(v => String(v).trim());
    return prefixParts.length > 0 ? prefixParts.join("/") : sgItemName;
  }, [hasCascadeFields, isFilmGroup, isInkGroup, isConsumableGroup, formValues, sgSubGroupName, sgSubGroupDisplayName, formGroupName, sgTypePrefix, sgSpecPrefix, sgItemName]);

  // ItemDescription preview: CategoryAbbr-Prefix-???? (number assigned by backend on save)
  // For consumables, prefix comes from the selected SubGroup (e.g. SL for Sleeve)
  const itemDescPreview = useMemo(() => {
    const grp = allGroups.find(g => String(g.ItemGroupID) === String(formGroupID));
    if (!grp) return "";
    const cat_raw = (grp.ItemGroupCategory || "").toLowerCase().trim();
    const name_raw = (grp.ItemGroupName || "").toLowerCase().trim();
    let cat = "RM";
    let prefix = grp.ItemGroupPrefix || formGroupName.substring(0, 2).toUpperCase();
    if (cat_raw === "raw material") {
      cat = "RM";
    } else if (cat_raw === "consumable" || cat_raw === "consumables") {
      cat = "CON";
      prefix = sgSubGroupPrefix || "???";
    } else if (cat_raw === "other material" || /other[\s-]*material/i.test(name_raw)) {
      cat = "CON";
      prefix = sgSubGroupPrefix || "???";
    } else if (cat_raw === "finish goods" || cat_raw === "finished goods") {
      cat = "FG";
    } else if (cat_raw === "capital goods") {
      cat = "CG";
    } else if (cat_raw) {
      cat = cat_raw.substring(0, 2).toUpperCase();
    }
    return `${cat}-${prefix}-????`;
  }, [formGroupID, allGroups, formGroupName, sgSubGroupPrefix]);

  const lastHsnPayload = useRef<string>("");

  // Dynamic HSN Code filtering based on Cascade Selections
  useEffect(() => {
    if (!formGroupID || !hasCascadeFields) return;
    const loadFilteredHSN = async () => {
      const gID = Number(formGroupID);
      const sg1 = Number(formValues[subGroup1Field?.FieldName ?? "ItemSubGroupID"]) || 0;
      const type = formValues[sg2FieldName] || "";
      const spec = formValues[sg3FieldName] || "";

      try {
        const payload = { ItemGroupID: gID, ItemSubGroupID: sg1, SubGroupType: type, TypeSpecification: spec };
        const payloadStr = JSON.stringify(payload);
        if (lastHsnPayload.current === payloadStr) return;
        lastHsnPayload.current = payloadStr;

        const res = await fetch(`${BASE_URL}/api/itemmasterShrink/filtered-hsn`, {
          method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const text = await res.text();
        const raw = unwrap(text);
        const dataRows = Array.isArray(raw) ? raw : [];
        if (dataRows.length > 0) {
          const newOpts = dataRows.map((r: any) => ({
            value: String(r.ProductHSNID),
            label: r.ProductHSNCode,
            description: r.DisplayName
          }));
          if (newOpts.length === 1 && formValues["ProductHSNID"] !== newOpts[0].value) {
            setFormValues(p => ({ ...p, ProductHSNID: newOpts[0].value, ProductHSNName: newOpts[0].description }));
          }
          setSelectOpts(prev => ({ ...prev, "ProductHSNID": newOpts, "ProductHSNName": [] }));
        } else {
          setSelectOpts(prev => ({ ...prev, "ProductHSNID": [], "ProductHSNName": [] }));
          setFormValues(p => ({ ...p, ProductHSNID: "", ProductHSNName: "" }));
        }
      } catch { }
    };

    if (formFields.length > 0) loadFilteredHSN();
  }, [formGroupID, formValues[subGroup1Field?.FieldName ?? "ItemSubGroupID"], formValues[sg2FieldName], formValues[sg3FieldName], hasCascadeFields, formFields.length]);

  // Save item to backend
  const saveItem = async () => {
    setSubmitAttempted(true);
    const missing = formFields.find(f => isFieldVisible(f) && f.IsRequiredFieldValidator && !String(formValues[f.FieldName] ?? "").trim());
    if (missing) { setFormError((missing.FieldDisplayName || missing.FieldName) + " is required."); return; }
    setFormSaving(true);
    setFormError("");
    try {
      const masterRecord: Record<string, any> = {
        ItemGroupID: formGroupID,
        ItemType: formGroupName,
        ...formValues,
        ItemName: hasCascadeFields
          ? sgItemName
          : buildItemName(formValues, formFields, itemNameFormula),
        ...(hasCascadeFields ? { ItemDisplayName: sgDisplayName } : {}),
      };

      formFields.forEach((f: any) => {
        const v = masterRecord[f.FieldName];

        if (f.FieldType === "checkbox" || f.FieldDataType === "bit") {
          const checked = v === true || v === "true" || v === 1 || v === "1";
          masterRecord[f.FieldName] = checked ? 1 : 0;
        } else if (f.FieldType === "number" || String(f.FieldName).endsWith("ID")) {
          const n = Number(v);
          masterRecord[f.FieldName] = (v !== "" && v !== null && v !== undefined && !isNaN(n)) ? n : null;
        } else {
          if (v === "false" || v === "null" || v === null || v === undefined || v === "") {
            masterRecord[f.FieldName] = null;
          }
        }
      });

      Object.keys(masterRecord).forEach(key => {
        const v = masterRecord[key];
        if (v === true || v === "true") masterRecord[key] = 1;
        else if (v === false || v === "false") masterRecord[key] = 0;
      });

      const isEdit = !!editing;
      const payload: Record<string, any> = {
        CostingDataItemMaster: [masterRecord],
        ItemGroupID: formGroupID,
        ActiveItem: formValues["ISItemActive"] ?? "true",
        StockRefCode: formValues["StockRefCode"] ?? "",
      };

      if (isEdit) {
        payload.ItemID = editing.ItemID ?? editing.id;
        payload.UnderGroupID = formGroupID;
        payload.CostingDataItemDetailMaster = [];
      }

      const endpoint = isEdit ? "update" : "save";
      const res = await fetch(`${BASE_URL}/api/itemmasterShrink/${endpoint}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const text = (await res.text()).replace(/^"|"$/g, "");
      if (res.ok && !text.toLowerCase().includes("fail") && !text.toLowerCase().includes("error")) {
        setActiveGroupID(formGroupID);
        setView("list");
        loadGridForGroup(formGroupID);
      } else {
        setFormError(text || `${isEdit ? "Update" : "Save"} failed. Please try again.`);
      }
    } catch {
      setFormError("Network error. Could not save item.");
    }
    setFormSaving(false);
  };

  const resetSgState = () => {
    setSgSubGroupOpts([]); setSgTypeOpts([]); setSgTypeSpecOpts([]);
    setSgSupplierOpts([]); setSgUnitOpts([]);
    setSgSubGroupName(""); setSgSubGroupDisplayName(""); setSgSubGroupPrefix("");
    setSgTypePrefix(""); setSgSpecPrefix("");
  };

  const openAdd = () => {
    editPrefetchDone.current = false;
    setEditing(null);
    setFormStep("select-group");
    setFormGroupID("");
    setFormGroupName("");
    setFormFields([]);
    setFormValues({});
    setSelectOpts({});
    setFormError("");
    resetSgState();
    setView("form");
  };

  // Fix 2: All cascade values (subgroup names, type prefix, spec prefix) are set directly here —
  // edit mode no longer relies on useEffect chain to populate these from saved values.
  const prefetchCascadeForEdit = async (gid: string, fullRow: any) => {
    const rawLower: Record<string, any> = {};
    if (fullRow) {
      Object.keys(fullRow).forEach(k => {
        rawLower[k.toLowerCase()] = fullRow[k];
      });
    }

    const subGroupID = String(rawLower["itemsubgroupid"] ?? "").trim();
    const quality = String(rawLower["quality"] ?? rawLower["itemtype"] ?? "").trim();
    const typeSpec = String(rawLower["typespecification"] ?? rawLower["typespacification"] ?? "").trim();

    if (gid && subGroupID) {
      try {
        const typesText = await fetch(`${BASE_URL}/api/itemmasterShrink/film-types/${gid}/${subGroupID}`, { headers: authHeaders() }).then(r => r.text());
        const rawTypes = unwrap(typesText);
        if (Array.isArray(rawTypes)) {
          const typeOpts = rawTypes.map((r: any) => ({ type: String(r.SubGroupType).trim(), prefix: String(r.SubGroupTypePrefix ?? "").trim() })).filter(o => o.type);
          setSgTypeOpts(typeOpts);
          if (quality) {
            const found = typeOpts.find(o => o.type === quality);
            if (found) setSgTypePrefix(found.prefix);
          }
        }
      } catch { /* non-fatal */ }

      if (quality) {
        try {
          const specsText = await fetch(`${BASE_URL}/api/itemmasterShrink/film-type-specs`, {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ ItemGroupID: gid, SubGroupID: subGroupID, SubGroupType: quality }),
          }).then(r => r.text());
          const rawSpecs = unwrap(specsText);
          if (Array.isArray(rawSpecs)) {
            const specOpts = rawSpecs.map((r: any) => ({ spec: String(r.TypeSpecification).trim(), prefix: String(r.TypeSpacificationPrefix ?? "").trim() })).filter(o => o.spec);
            setSgTypeSpecOpts(specOpts);
            if (typeSpec) {
              const found = specOpts.find(o => o.spec === typeSpec);
              if (found) setSgSpecPrefix(found.prefix);
            }
          }
        } catch { /* non-fatal */ }
      }
    }

    if (gid) {
      try {
        const [subGroupsText, suppliersText, unitsText] = await Promise.all([
          fetch(`${BASE_URL}/api/itemmasterShrink/film-subgroups/${gid}`, { headers: authHeaders() }).then(r => r.text()),
          fetch(`${BASE_URL}/api/itemmasterShrink/suppliers`, { headers: authHeaders() }).then(r => r.text()),
          fetch(`${BASE_URL}/api/itemmasterShrink/units`, { headers: authHeaders() }).then(r => r.text()),
        ]);

        const rawSG = unwrap(subGroupsText);
        if (Array.isArray(rawSG)) {
          const sgOpts = rawSG.map((r: any) => ({
            id: String(r.ItemSubGroupID),
            name: String(r.ItemSubGroupName),
            displayName: String(r.ItemSubGroupDisplayName ?? r.ItemSubGroupName ?? ""),
            subGroupPrefix: String(r.SubGroupPrefix ?? ""),
          }));
          setSgSubGroupOpts(sgOpts);
          if (subGroupID) {
            const found = sgOpts.find(o => o.id === subGroupID);
            if (found) {
              setSgSubGroupName(found.name);
              setSgSubGroupDisplayName(found.displayName);
              if (found.subGroupPrefix) setSgSubGroupPrefix(found.subGroupPrefix);
            }
          }
        }

        const rawSup = unwrap(suppliersText);
        if (Array.isArray(rawSup)) setSgSupplierOpts(rawSup.map((r: any) => ({ id: String(r.LedgerID), name: String(r.LedgerName) })));

        const rawU = unwrap(unitsText);
        if (Array.isArray(rawU)) setSgUnitOpts(rawU.map((r: any) => ({ id: String(r.UnitID), name: String(r.UnitName) })));
      } catch { /* non-fatal */ }
    }
  };

  const openEdit = async (row: any) => {
    editPrefetchDone.current = false;
    setEditing(row);
    setFormError("");
    const gid = String(row.ItemGroupID ?? activeGroupID ?? "");
    const gname = allGroups.find(g => String(g.ItemGroupID) === gid)?.ItemGroupName ?? "";
    setFormGroupID(gid);
    setFormGroupName(gname);
    setFormFields([]);
    setFormValues({});
    setSelectOpts({});
    resetSgState();
    setView("form");

    if (!gid) { setFormStep("select-group"); return; }

    const itemID = String(row.ItemID ?? row.id ?? "");
    let fullRow = row;
    if (itemID) {
      try {
        const res = await fetch(`${BASE_URL}/api/itemmasterShrink/item-for-edit/${itemID}`, { headers: authHeaders() });
        const text = await res.text();
        const parsed = unwrap(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          fullRow = { ...row, ...parsed[0] };
        } else if (parsed && typeof parsed === "object") {
          fullRow = { ...row, ...parsed };
        }
      } catch { /* fallback to grid row */ }
    }

    await prefetchCascadeForEdit(gid, fullRow);
    editPrefetchDone.current = true;

    loadFormFields(gid, gname, fullRow);
  };

  const deleteRow = (itemID: string, itemGroupID: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    fetch(`${BASE_URL}/api/itemmasterShrink/deleteitem?itemID=${itemID}&itemgroupID=${itemGroupID}`, {
      method: "POST",
      headers: authHeaders(),
    })
      .then(r => r.text())
      .then(() => {
        if (activeGroupID) loadGridForGroup(activeGroupID);
      })
      .catch(() => { });
  };

  const onGroupPillClick = (grp: { ItemGroupID: string; ItemGroupName: string; ItemGroupPrefix: string; ItemGroupCategory: string } | null) => {
    if (!grp) { setActiveGroupID(""); setGridData([]); return; }
    setActiveGroupID(grp.ItemGroupID);
    loadGridForGroup(grp.ItemGroupID);
  };

  const activeGroupName = allGroups.find(g => g.ItemGroupID === activeGroupID)?.ItemGroupName ?? "";
  const isInkGridGroup = /ink/i.test(activeGroupName);
  const isFilmGridGroup = /film|reel|bopp|poly|laminate/i.test(activeGroupName);

  // Live grid columns — uses real backend field names
  const liveColumns: Column<any>[] = [
    { key: "ItemDescription", header: "Item Description", sortable: true },
    { key: "ItemName", header: "Item Name", sortable: true },
    ...(isInkGridGroup ? [
      { key: "Colour", header: "Colour" },
      { key: "PantoneNo", header: "Pantone No." },
    ] : []),
    ...(isFilmGridGroup ? [
      { key: "WebWidth", header: "Width (mm)" },
      { key: "Thickness", header: "Thickness (µ)" },
    ] : []),
    {
      key: "ISItemActive",
      header: "Status",
      render: (r: any) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${String(r.ISItemActive).toLowerCase() === "true"
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-500"
          }`}>
          {String(r.ISItemActive).toLowerCase() === "true" ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const showGrid = !!activeGroupID;

  // ── Form View ───────────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">

        {/* Header Ribbon */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{companyName}</p>
            <h2 className="text-xl font-bold text-gray-800">
              {editing ? "Edit Item" : "Add Item"}
              {formGroupName && <span className="text-gray-400 font-normal"> — {formGroupName}</span>}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("list")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <List size={16} /> Back to List
            </button>
            {formStep === "fill-form" && !formLoading && (
              <button
                onClick={saveItem}
                disabled={formSaving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {formSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {formSaving ? "Saving..." : "Save"}
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {formError}
          </div>
        )}

        {/* Step 1: Select Group */}
        {formStep === "select-group" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <SectionTitle title="Select Item Group" />
            <p className="text-sm text-gray-500 mb-5">Choose the group this item belongs to</p>
            {formLoading ? (
              <div className="flex items-center gap-2 text-blue-600 text-sm">
                <Loader2 size={16} className="animate-spin" /> Loading...
              </div>
            ) : allGroups.length === 0 ? (
              <div className="text-sm text-gray-400">No groups found. Make sure you are logged in.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(() => {
                  const isCon = (g: typeof allGroups[0]) => {
                    const cat = (g.ItemGroupCategory || "").toLowerCase();
                    return cat === "consumable" || cat === "consumables";
                  };
                  const rmGroups = allGroups.filter(g => !isCon(g));
                  const conGroups = allGroups.filter(g => isCon(g));
                  const grpBtn = (grp: typeof allGroups[0]) => (
                    <button
                      key={grp.ItemGroupID}
                      onClick={() => {
                        setFormGroupID(String(grp.ItemGroupID));
                        setFormGroupName(grp.ItemGroupName);
                        loadFormFields(String(grp.ItemGroupID), grp.ItemGroupName);
                      }}
                      className="px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all text-left"
                    >
                      {grp.ItemGroupName}
                    </button>
                  );
                  return (
                    <>
                      {rmGroups.length > 0 && (
                        <div className="col-span-2 md:col-span-3">
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Raw Material</p>
                        </div>
                      )}
                      {rmGroups.map(grpBtn)}
                      {conGroups.length > 0 && (
                        <div className="col-span-2 md:col-span-3 mt-2">
                          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Consumables</p>
                        </div>
                      )}
                      {conGroups.map(grpBtn)}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Fill Form */}
        {formStep === "fill-form" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

            {/* Group badge */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-200 bg-gray-50/30">
              <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                {formGroupName}
              </span>
            </div>

            <div className="p-8">
              {formLoading ? (
                <div className="flex items-center justify-center py-14 gap-2 text-blue-600 text-sm">
                  <Loader2 size={18} className="animate-spin" /> Loading fields...
                </div>
              ) : formFields.length === 0 ? (
                <div className="text-center py-14 text-gray-400 text-sm">
                  No fields configured for this group.
                </div>
              ) : (
                <div className="space-y-8">

                  {/* CASCADING SECTION: shown for any group whose DB config includes ItemSubGroupID */}
                  {hasCascadeFields && (() => {
                    const sgid = String(formValues["ItemSubGroupID"] ?? "");
                    const hasSupplier = !!supplierField && isFieldVisible(supplierField);
                    const puField = formFields.find(f => f.FieldName === "PurchaseUnit");
                    const euField = formFields.find(f => f.FieldName === "EstimationUnit");
                    const suField = formFields.find(f => f.FieldName === "StockUnit");
                    const hasUnits = !!(puField || euField || suField);
                    return (
                      <div>
                        <SectionTitle title={`${formGroupName} Details`} />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                          {/* Sub Group 1 — label from DB FieldDisplayName */}
                          <Field label={subGroup1Field?.FieldDisplayName ?? "Sub Group 1"} required={!!subGroup1Field?.IsRequiredFieldValidator}>
                            <select value={sgid} onChange={e => {
                              const id = e.target.value;
                              const sgOpt = sgSubGroupOpts.find(o => o.id === id);
                              setSgSubGroupName(sgOpt?.name ?? "");
                              setSgSubGroupDisplayName(sgOpt?.displayName ?? "");
                              setSgSubGroupPrefix(sgOpt?.subGroupPrefix ?? "");
                              setFormValues(v => ({ ...v, ItemSubGroupID: id, [sg2FieldName]: "", [sg3FieldName]: "" }));
                              loadSgTypes(formGroupID, id);
                            }} className={INPUT_CLS}>
                              <option value="">-- Select --</option>
                              {sgSubGroupOpts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          </Field>

                          {/* Sub Group 2 — label from DB FieldDisplayName */}
                          {subGroup2Field && (
                            <Field label={subGroup2Field.FieldDisplayName ?? "Sub Group 2"} required={!!subGroup2Field.IsRequiredFieldValidator}>
                              <select value={String(formValues[sg2FieldName] ?? "")} onChange={e => {
                                const t = e.target.value;
                                const opt = sgTypeOpts.find(o => o.type === t);
                                setSgTypePrefix(opt?.prefix ?? "");
                                setSgSpecPrefix("");
                                setFormValues(v => ({ ...v, [sg2FieldName]: t, [sg3FieldName]: "" }));
                                setSgTypeSpecOpts([]);
                                if (t && sgid) loadSgTypeSpecs(formGroupID, sgid, t);
                              }} className={INPUT_CLS} disabled={!sgid && !sgTypeOpts.length}>
                                <option value="">-- Select --</option>
                                {sgTypeOpts.map(o => <option key={o.type} value={o.type}>{o.type}</option>)}
                                {formValues[sg2FieldName] && !sgTypeOpts.some(o => o.type === formValues[sg2FieldName]) && (
                                  <option value={formValues[sg2FieldName]}>{formValues[sg2FieldName]}</option>
                                )}
                              </select>
                            </Field>
                          )}

                          {/* Sub Group 3 — label from DB FieldDisplayName */}
                          {subGroup3Field && (
                            <Field label={subGroup3Field.FieldDisplayName ?? "Sub Group 3"}>
                              <select value={String(formValues[sg3FieldName] ?? "")} onChange={e => {
                                const s = e.target.value;
                                const opt = sgTypeSpecOpts.find(o => o.spec === s);
                                setSgSpecPrefix(opt?.prefix ?? "");
                                setFormValues(v => ({ ...v, [sg3FieldName]: s }));
                              }} className={INPUT_CLS}>
                                <option value="">-- Select --</option>
                                {sgTypeSpecOpts.map(o => <option key={o.spec} value={o.spec}>{o.spec}</option>)}
                                {formValues[sg3FieldName] && !sgTypeSpecOpts.some(o => o.spec === formValues[sg3FieldName]) && (
                                  <option value={formValues[sg3FieldName]}>{formValues[sg3FieldName]}</option>
                                )}
                              </select>
                            </Field>
                          )}

                          {/* All other non-cascade fields — sorted by FieldDrawSequence, label from FieldDisplayName */}
                          {formFields
                            .filter(f => isFieldVisible(f) && !cascadeHandledNames.has((f.FieldName ?? "").toLowerCase()))
                            .map(field => (
                              <DynamicField
                                key={field.FieldName}
                                field={field}
                                value={formValues[field.FieldName] ?? ""}
                                options={selectOpts[field.FieldName] ?? []}
                                onChange={(v: any) => {
                                  const updates: Record<string, any> = { [field.FieldName]: v };
                                  const pair = resolveHsnPair(field.FieldName, String(v), selectOpts[field.FieldName] ?? []);
                                  if (pair && formFields.find((ff: any) => ff.FieldName === pair.nameKey)) {
                                    updates[pair.nameKey] = pair.description;
                                  }
                                  setFormValues(prev => ({ ...prev, ...updates }));
                                }}
                                submitAttempted={submitAttempted}
                              />
                            ))}

                          {/* Supplier — label from DB FieldDisplayName */}
                          {hasSupplier && (
                            <Field label={supplierField?.FieldDisplayName ?? "Supplier"} required={!!supplierField?.IsRequiredFieldValidator}>
                              <select value={String(formValues[supplierField?.FieldName ?? "Manufecturer"] ?? "")} onChange={e => {
                                setFormValues(v => ({ ...v, [supplierField?.FieldName ?? "Manufecturer"]: e.target.value }));
                              }} className={INPUT_CLS}>
                                <option value="">-- Select --</option>
                                {sgSupplierOpts.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                              </select>
                            </Field>
                          )}

                          {/* Units — labels from DB FieldDisplayName */}
                          {hasUnits && (
                            <>
                              {puField && (
                                <Field label={puField.FieldDisplayName ?? "Purchase Unit"} required={!!puField.IsRequiredFieldValidator}>
                                  <select value={String(formValues["PurchaseUnit"] ?? "")} onChange={e => setFormValues(v => ({ ...v, PurchaseUnit: e.target.value }))} className={INPUT_CLS}>
                                    <option value="">-- Select --</option>
                                    {sgUnitOpts.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                                  </select>
                                </Field>
                              )}
                              {euField && (
                                <Field label={euField.FieldDisplayName ?? "Estimation Unit"} required={!!euField.IsRequiredFieldValidator}>
                                  <select value={String(formValues["EstimationUnit"] ?? "")} onChange={e => setFormValues(v => ({ ...v, EstimationUnit: e.target.value }))} className={INPUT_CLS}>
                                    <option value="">-- Select --</option>
                                    {sgUnitOpts.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                                  </select>
                                </Field>
                              )}
                              {suField && (
                                <Field label={suField.FieldDisplayName ?? "Stock Unit"} required={!!suField.IsRequiredFieldValidator}>
                                  <select value={String(formValues["StockUnit"] ?? "")} onChange={e => setFormValues(v => ({ ...v, StockUnit: e.target.value }))} className={INPUT_CLS}>
                                    <option value="">-- Select --</option>
                                    {sgUnitOpts.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                                  </select>
                                </Field>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Dynamic fields grid — for non-cascade groups shows all fields */}
                  {!hasCascadeFields && (
                    <div>
                      <SectionTitle title="Item Details" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {formFields
                          .filter(f => isFieldVisible(f))
                          .map(field => (
                            <DynamicField
                              key={field.FieldName}
                              field={field}
                              value={formValues[field.FieldName] ?? ""}
                              options={selectOpts[field.FieldName] ?? []}
                              onChange={(v: any) => {
                                const updates: Record<string, any> = { [field.FieldName]: v };
                                const pair = resolveHsnPair(field.FieldName, String(v), selectOpts[field.FieldName] ?? []);
                                if (pair && formFields.find((ff: any) => ff.FieldName === pair.nameKey)) {
                                  updates[pair.nameKey] = pair.description;
                                }
                                setFormValues(prev => ({ ...prev, ...updates }));
                              }}
                              submitAttempted={submitAttempted}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Cascade groups: Item Name + Item Display Name live preview */}
                  {hasCascadeFields && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Item Name</label>
                          <div className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white min-h-[38px]">
                            {sgItemName || <span className="text-gray-400">Fill in the fields above...</span>}
                          </div>
                        </div>
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Item Display Name</label>
                          <div className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white min-h-[38px]">
                            {sgDisplayName || <span className="text-gray-400">Fill in the fields above...</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Active Item toggle */}
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => setFormValues(v => ({
                        ...v,
                        ISItemActive: v.ISItemActive === "false" ? "true" : "false",
                      }))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${formValues.ISItemActive !== "false" ? "bg-blue-500" : "bg-gray-300"}`}
                    >
                      <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${formValues.ISItemActive !== "false" ? "left-7" : "left-1"}`} />
                    </button>
                    <span className="text-sm font-medium text-gray-700">Active Item</span>
                  </div>

                  {/* Footer buttons */}
                  <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                    <button
                      onClick={() => { setFormStep("select-group"); setFormGroupID(""); setFormGroupName(""); }}
                      className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      ← Change Group
                    </button>
                    <button
                      onClick={saveItem}
                      disabled={formSaving}
                      className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {formSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      {formSaving ? "Saving..." : editing ? "Update Item" : "Save Item"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List View ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Item Master</h2>
          <p className="text-sm text-gray-500">
            {showGrid
              ? gridLoading ? "Loading..." : `${filteredGridData.length} items — ${activeGroupName}`
              : allGroups.length === 0 ? "Loading groups..." : "Select a group to load items"}
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Filter Bar — group pills direct from backend */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Group</span>
          <button
            onClick={() => onGroupPillClick(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!activeGroupID
              ? "bg-blue-50 text-blue-700 border-blue-300"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
              }`}
          >
            All Groups
          </button>
          {(() => {
            const isCon = (g: typeof allGroups[0]) => {
              const cat = (g.ItemGroupCategory || "").toLowerCase();
              return cat === "consumable" || cat === "consumables";
            };
            const rmGroups = allGroups.filter(g => !isCon(g));
            const conGroups = allGroups.filter(g => isCon(g));
            const pillCls = (id: string) => `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${activeGroupID === id
              ? "bg-blue-50 text-blue-700 border-blue-300"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
              }`;
            return (
              <>
                {rmGroups.map(grp => (
                  <button key={grp.ItemGroupID} onClick={() => onGroupPillClick(grp)} className={pillCls(grp.ItemGroupID)}>
                    {grp.ItemGroupName}
                  </button>
                ))}
                {conGroups.length > 0 && (
                  <>
                    <span className="text-xs font-semibold text-orange-500 uppercase tracking-wider ml-1 border-l border-gray-200 pl-2">Consumables</span>
                    {conGroups.map(grp => (
                      <button key={grp.ItemGroupID} onClick={() => onGroupPillClick(grp)} className={pillCls(grp.ItemGroupID)}>
                        {grp.ItemGroupName}
                      </button>
                    ))}
                  </>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Grid Panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

        {!showGrid && (
          <div className="text-center py-14 text-gray-400 text-sm">
            Select a group above to load live data
          </div>
        )}

        {showGrid && gridLoading && (
          <div className="flex items-center justify-center py-14 gap-2 text-blue-600 text-sm">
            <Loader2 size={18} className="animate-spin" />
            Loading {activeGroupName} items from server...
          </div>
        )}

        {/* Date filter bar — shown when a group is selected */}
        {showGrid && !gridLoading && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Date Range</span>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {filteredGridData.length !== gridData.length && (
              <span className="text-xs text-gray-400">{filteredGridData.length} of {gridData.length} shown</span>
            )}
          </div>
        )}

        {/* Live grid — real backend data */}
        {showGrid && !gridLoading && (
          <DataTable
            data={filteredGridData}
            columns={liveColumns}
            searchKeys={["ItemCode", "ItemName"]}
            actions={(row: any) => (
              <div className="flex items-center gap-2 justify-end">
                <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteRow(row.ItemID ?? row.id, row.ItemGroupID ?? activeGroupID)}>Delete</Button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
