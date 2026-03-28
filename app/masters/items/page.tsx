"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Save, List, Check, Loader2 } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = "https://api.indusanalytics.co.in";

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

// ── Dynamic field renderer ────────────────────────────────────────────────────
// Each selectbox option carries both the DB value (col[0]) and display label (col[1])
// For 1-col tables: value === label; For 2-col tables: value = ID, label = display name
type SelectOpt = { value: string; label: string; description?: string };

// Strip special characters — allow letters, numbers, spaces, dot, hyphen, slash
function stripSpecial(v: string): string {
  return v.replace(/[^a-zA-Z0-9 .\-\/]/g, "");
}

function DynamicField({ field, value, options, onChange, submitAttempted }: {
  field: any;
  value: any;
  options: SelectOpt[];
  onChange: (v: any) => void;
  submitAttempted?: boolean;
}) {
  const inputCls = "w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";

  // HSN fields stay as locked dropdowns — all other selectboxes become free-type combos
  const isHSN = /hsn/i.test(field.FieldName ?? "");

  const inner = () => {
    if (field.FieldType === "selectbox") {
      if (isHSN || !!field.IsLocked) {
        // HSN fields: keep as regular dropdown (read-only / auto-filled)
        return (
          <select
            value={value ?? ""}
            onChange={e => onChange(e.target.value)}
            disabled={!!field.IsLocked}
            className={inputCls}
          >
            <option value="">-- Select --</option>
            {options.map((o, i) => (
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
            disabled={false}
            placeholder={options.length > 0 ? "Type or choose from list..." : (field.FieldDefaultValue ?? "Type here...")}
            className={inputCls}
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
            onClick={() => onChange(checked ? "false" : "true")}
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
          className={inputCls + " resize-none"}
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
          className={inputCls}
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

// ── Helper: unwrap triple-encoded JSON ───────────────────────────────────────
function unwrap(raw: any): any {
  let result = raw;
  while (typeof result === "string") {
    try { result = JSON.parse(result); } catch { break; }
  }
  return result;
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
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [selectOpts, setSelectOpts] = useState<Record<string, SelectOpt[]>>({});
  const [formSaving, setFormSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [itemNameFormula, setItemNameFormula] = useState<string[]>([]);

  // ── Live grid state (real backend data) ────────────────────────────────────
  const [allGroups, setAllGroups] = useState<{ ItemGroupID: string; ItemGroupName: string }[]>([]);
  const [gridData, setGridData] = useState<any[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [activeGroupID, setActiveGroupID] = useState("");

  // Date filter — default: last 30 days
  const todayStr = new Date().toISOString().split("T")[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(thirtyDaysAgoStr);
  const [toDate, setToDate] = useState(todayStr);

  // Common date field names the backend might use
  const DATE_FIELDS = ["CreatedDate", "ModifiedDate", "EntryDate", "ItemDate", "Date", "AddedDate"];

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
        return true; // unparseable date → show row
      }
    });
  }, [gridData, fromDate, toDate]);

  // Load all item groups from backend on mount
  useEffect(() => {
    fetch(`${BASE_URL}/api/itemmaster/items`, { headers: authHeaders() })
      .then(r => r.json())
      .then(raw => {
        try {
          const result = unwrap(raw);
          setAllGroups(Array.isArray(result) ? result : []);
        } catch { setAllGroups([]); }
      })
      .catch(() => setAllGroups([]));
  }, []);

  // Fetch item grid for a specific group
  const loadGridForGroup = useCallback((masterID: string) => {
    if (!masterID) { setGridData([]); return; }
    setGridLoading(true);
    fetch(`${BASE_URL}/api/itemmaster/grid/${masterID}`, { headers: authHeaders() })
      .then(async r => {
        const text = await r.text();
        return text;
      })
      .then(text => {
        try {
          const result = unwrap(text);
          setGridData(Array.isArray(result) ? result.map((r: any) => ({ ...r, id: String(r.ItemID) })) : []);
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
      // Fetch fields + ItemNameFormula in parallel
      const [fieldsRes, formulaRes] = await Promise.all([
        fetch(`${BASE_URL}/api/itemmaster/getmasterfields/${groupID}`, { headers: authHeaders() }),
        fetch(`${BASE_URL}/api/itemmaster/grid-column-hide/${groupID}`, { headers: authHeaders() }),
      ]);

      const raw = await fieldsRes.text();
      const fields = unwrap(raw);

      if (!Array.isArray(fields)) {
        setFormError("Could not load form fields from server.");
        setFormLoading(false);
        return;
      }

      // Extract ItemNameFormula — comma-separated field names e.g. "Type,GroupName,GSM,ItemSize"
      try {
        const formulaRaw = await formulaRes.text();
        const formulaData = unwrap(formulaRaw);
        const formula: string = (Array.isArray(formulaData) ? formulaData[0]?.ItemNameFormula : formulaData?.ItemNameFormula) ?? "";
        setItemNameFormula(formula ? formula.split(",").map((s: string) => s.trim()).filter(Boolean) : []);
      } catch { setItemNameFormula([]); }

      setFormFields(fields);

      // Initialize values: prefill > FieldDefaultValue > ""
      // DB often stores "false"/"null" as FieldDefaultValue for numeric/empty fields — show blank instead
      const defaults: Record<string, any> = { ISItemActive: "true" };
      fields.forEach((f: any) => {
        let dv = prefill?.[f.FieldName] ?? f.FieldDefaultValue ?? "";
        if (f.FieldType !== "checkbox" && (dv === "false" || dv === "null" || dv === null)) {
          dv = "";
        }
        defaults[f.FieldName] = dv;
      });
      // NOTE: setFormValues(defaults) is called AFTER opts are built so HSN auto-fill can use opts

      // Load selectbox options
      // Strategy (mirrors old VB DynamicMasters.js):
      //   1. SelectBoxDefault (comma/semicolon-separated static list) → use immediately
      //   2. SelectBoxQueryDB present but no default → call selectboxload ONE field at a
      //      time to avoid the backend's early-return bug on null queries
      const sbFields = fields.filter((f: any) => f.FieldType === "selectbox");
      const opts: Record<string, SelectOpt[]> = {};

      for (const f of sbFields) {
        // ── Priority 1: static defaults (SelectBoxDefault) — no API call needed ─
        if (f.SelectBoxDefault && f.SelectBoxDefault !== "null") {
          const staticOpts = f.SelectBoxDefault
            .split(/[,;|]/)
            .map((x: string) => x.trim())
            .filter(Boolean);
          if (staticOpts.length > 0) {
            // Static options: value === label (1-col equivalent)
            opts[f.FieldName] = staticOpts.map((s: string) => ({ value: s, label: s }));
            continue;
          }
        }

        // ── Priority 2: DB query via selectboxload ────────────────────────────
        // Guard: skip if no FieldID or no SelectBoxQueryDB (backend returns "" for null query → early-return bug)
        if (!f.ItemGroupFieldID || !f.SelectBoxQueryDB || f.SelectBoxQueryDB === "null") continue;

        try {
          const sbRes = await fetch(`${BASE_URL}/api/itemmaster/selectboxload`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify([{ FieldID: f.ItemGroupFieldID, FieldName: f.FieldName }]),
          });
          const sbRaw = await sbRes.text();
          const sbData = unwrap(sbRaw);

          if (sbData && typeof sbData === "object") {
            const tableKey = "tbl_" + f.FieldName;
            const rows: any[] = sbData[tableKey] ?? [];

            // Backend always appends 1 metadata row at end — strip it if we have more than 1 row
            const dataRows = rows.length > 1 ? rows.slice(0, -1) : rows;

            if (dataRows.length > 0) {
              const cols = Object.keys(dataRows[0]);
              const is3col = cols.length >= 3;
              const is2col = cols.length >= 2;
              // 3-col: col[0]=ID, col[1]=code/name (shown), col[2]=description (auto-fill)
              // 2-col: col[0]=ID, col[1]=display name
              // 1-col: col[0] is both value and label
              opts[f.FieldName] = dataRows
                .map((r: any) => ({
                  value: String(r[cols[0]] ?? ""),
                  label: is2col ? String(r[cols[1]] ?? "") : String(r[cols[0]] ?? ""),
                  description: is3col ? String(r[cols[2]] ?? "") : undefined,
                }))
                .filter(o => o.value !== "");
            }
          }
        } catch { /* silent — field renders as empty select */ }
      }

      // Auto-fill HSN Description when editing — use description field from 3-col selectbox opts
      if (prefill) {
        fields.forEach((f: any) => {
          if (/ProductHSNID$/i.test(f.FieldName) && f.FieldType === "selectbox") {
            const storedID = String(prefill[f.FieldName] ?? "");
            if (storedID && storedID !== "0") {
              const nameKey = f.FieldName.replace(/ID$/i, "Name");
              if (fields.find((ff: any) => ff.FieldName === nameKey)) {
                const hsnOpts = opts[f.FieldName] ?? [];
                const match = hsnOpts.find((o: SelectOpt) => o.value === storedID);
                defaults[nameKey] = match?.description ?? "";
              }
            }
          }
        });
      }

      setSelectOpts(opts);
      setFormValues(defaults);
      setFormStep("fill-form");
    } catch {
      setFormError("Network error loading form fields.");
    }
    setFormLoading(false);
  }, []);

  // Build ItemName from ItemNameFormula (mirrors old DynamicMasters.js logic)
  const buildItemName = (values: Record<string, any>, fields: any[], formula: string[]): string => {
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
  };

  // Save item to backend
  const saveItem = async () => {
    setSubmitAttempted(true);
    // Validate required fields
    const missing = formFields.find(f => f.IsRequiredFieldValidator && !String(formValues[f.FieldName] ?? "").trim());
    if (missing) { setFormError((missing.FieldDisplayName || missing.FieldName) + " is required."); return; }
    setFormSaving(true);
    setFormError("");
    try {
      const masterRecord: Record<string, any> = {
        ItemGroupID: formGroupID,
        ItemType: formGroupName,   // old VB sends group name as ItemType
        ...formValues,
        // Generate ItemName from formula before sanitization (need raw string values)
        ItemName: buildItemName(formValues, formFields, itemNameFormula),
      };

      // Sanitize field values before sending to backend
      // DB columns can be bigint/real/int — "false"/"null"/"" strings cause type conversion errors
      formFields.forEach((f: any) => {
        const v = masterRecord[f.FieldName];

        if (f.FieldType === "checkbox") {
          // Checkbox: always send "true" or "false" string
          const checked = v === true || v === "true" || v === 1 || v === "1";
          masterRecord[f.FieldName] = checked ? "true" : "false";

        } else if (f.FieldType === "number" || String(f.FieldName).endsWith("ID")) {
          // Strictly numeric DB columns — send number or null, never a string
          const n = Number(v);
          masterRecord[f.FieldName] = (v !== "" && v !== null && v !== undefined && !isNaN(n)) ? n : null;

        } else {
          // text / selectbox / textarea / datebox
          // "false", "null", "" are never valid real-column values — convert to null
          // so SQL Server doesn't try to cast the string "false" → real and fail
          if (v === "false" || v === "null" || v === null || v === undefined || v === "") {
            masterRecord[f.FieldName] = null;
          }
          // otherwise keep the string as-is (valid for varchar columns)
        }
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
        // Also pass CostingDataItemDetailMaster as empty array (backend may need it)
        payload.CostingDataItemDetailMaster = [];
      }

      const endpoint = isEdit ? "update" : "save";
      const res = await fetch(`${BASE_URL}/api/itemmaster/${endpoint}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const text = (await res.text()).replace(/^"|"$/g, ""); // unwrap surrounding quotes if any
      if (res.ok && !text.toLowerCase().includes("fail") && !text.toLowerCase().includes("error")) {
        // Go back to list and auto-select the saved item's group so it appears in grid
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

  const openAdd = () => {
    setEditing(null);
    setFormStep("select-group");
    setFormGroupID("");
    setFormGroupName("");
    setFormFields([]);
    setFormValues({});
    setSelectOpts({});
    setFormError("");
    setView("form");
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setFormError("");
    const gid = String(row.ItemGroupID ?? activeGroupID ?? "");
    const gname = allGroups.find(g => g.ItemGroupID === gid)?.ItemGroupName ?? "";
    setFormGroupID(gid);
    setFormGroupName(gname);
    setFormFields([]);
    setFormValues({});
    setSelectOpts({});
    setView("form");
    if (gid) loadFormFields(gid, gname, row);
    else setFormStep("select-group");
  };

  const deleteRow = (itemID: string, itemGroupID: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    fetch(`${BASE_URL}/api/itemmaster/deleteitem?itemID=${itemID}&itemgroupID=${itemGroupID}`, {
      method: "POST",
      headers: authHeaders(),
    })
      .then(r => r.text())
      .then(() => {
        if (activeGroupID) loadGridForGroup(activeGroupID);
      })
      .catch(() => {});
  };

  // Group pill click (list view)
  const onGroupPillClick = (grp: { ItemGroupID: string; ItemGroupName: string } | null) => {
    if (!grp) { setActiveGroupID(""); setGridData([]); return; }
    setActiveGroupID(grp.ItemGroupID);
    loadGridForGroup(grp.ItemGroupID);
  };

  // Derive group name for column logic from backend data
  const activeGroupName = allGroups.find(g => g.ItemGroupID === activeGroupID)?.ItemGroupName ?? "";
  const isInkGridGroup  = activeGroupName.toLowerCase().includes("ink");
  const isFilmGridGroup = activeGroupName.toLowerCase().includes("film") || activeGroupName.toLowerCase().includes("reel");

  // Live grid columns — uses real backend field names
  const liveColumns: Column<any>[] = [
    { key: "ItemCode", header: "Item Code", sortable: true },
    { key: "ItemName", header: "Item Name", sortable: true },
    ...(isInkGridGroup ? [
      { key: "Colour", header: "Colour" },
      { key: "PantoneNo", header: "Pantone No." },
    ] : []),
    ...(isFilmGridGroup ? [
      { key: "WebWidth", header: "Width (mm)" },
      { key: "Thickness", header: "Thickness (μ)" },
    ] : []),
    {
      key: "ISItemActive",
      header: "Status",
      render: (r: any) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          String(r.ISItemActive).toLowerCase() === "true"
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
                {allGroups.map(grp => (
                  <button
                    key={grp.ItemGroupID}
                    onClick={() => {
                      setFormGroupID(grp.ItemGroupID);
                      setFormGroupName(grp.ItemGroupName);
                      loadFormFields(grp.ItemGroupID, grp.ItemGroupName);
                    }}
                    className="px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all text-left"
                  >
                    {grp.ItemGroupName}
                  </button>
                ))}
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

                  {/* Dynamic fields grid */}
                  <div>
                    <SectionTitle title="Item Details" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {formFields
                        .filter(f => f.IsDisplay !== false && f.IsDisplay !== 0 && f.IsDisplay !== "0" && f.IsDisplay !== null)
                        .map(field => (
                          <DynamicField
                            key={field.FieldName}
                            field={field}
                            value={formValues[field.FieldName] ?? ""}
                            options={selectOpts[field.FieldName] ?? []}
                            onChange={(v: any) => {
                              const updates: Record<string, any> = { [field.FieldName]: v };
                              // Auto-fill HSN Description when ProductHSNID is selected
                              if (/ProductHSNID$/i.test(field.FieldName)) {
                                const nameKey = field.FieldName.replace(/ID$/i, "Name");
                                if (formFields.find((ff: any) => ff.FieldName === nameKey)) {
                                  const hsnOpts = selectOpts[field.FieldName] ?? [];
                                  const matched = hsnOpts.find((o: SelectOpt) => o.value === String(v));
                                  updates[nameKey] = matched?.description ?? "";
                                }
                              }
                              setFormValues(prev => ({ ...prev, ...updates }));
                            }}
                            submitAttempted={submitAttempted}
                          />
                        ))}
                    </div>
                  </div>

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
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              !activeGroupID
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            All Groups
          </button>
          {allGroups.map(grp => (
            <button
              key={grp.ItemGroupID}
              onClick={() => onGroupPillClick(grp)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeGroupID === grp.ItemGroupID
                  ? "bg-blue-50 text-blue-700 border-blue-300"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {grp.ItemGroupName}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

        {/* No group selected */}
        {!showGrid && (
          <div className="text-center py-14 text-gray-400 text-sm">
            Select a group above to load live data
          </div>
        )}

        {/* Loading spinner */}
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
