"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List, ChevronRight } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/toolmaster`;

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
const ic = (err: boolean) => err ? inputCls.replace("border-gray-300", "border-red-400 bg-red-50/50") : inputCls;

// ── Types ──────────────────────────────────────────────────────────────────────
type ToolGroup = { ToolGroupID: string; ToolGroupName: string; };

type ToolRow = {
  id: string;
  ToolID: string;
  ToolCode: string;
  ToolGroupID: string;
  [key: string]: any;
};

type GridColDef = { key: string; header: string; };

type FieldDef = {
  ToolGroupFieldID: string;
  FieldName: string;
  FieldType: string;
  FieldDisplayName: string;
  IsDisplay: any;
  IsRequiredFieldValidator: any;
  SelectBoxQueryDB: string | null;
  SelectBoxDefault: string | null;
  FieldDrawSequence: string;
  FieldDataType: string;
};

// SelectBox can be simple string list OR value+display object list
type SimpleSelectOpt = { type: "simple"; items: string[] };
type ObjectSelectOpt = { type: "object"; valueExpr: string; displayExpr: string; descriptionExpr?: string; items: Record<string, any>[] };
type SelectOptConfig = SimpleSelectOpt | ObjectSelectOpt;

type FormValues = Record<string, any>;

function isTruthy(v: any): boolean {
  return v === true || v === "True" || v === "true" || v === 1 || v === "1";
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ToolMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [activeTab, setActiveTab] = useState<"detail" | "specs">("detail");

  // Groups
  const [toolGroups, setToolGroups] = useState<ToolGroup[]>([]);
  const [selectedGroupID, setSelectedGroupID] = useState("");

  // List
  const [listData, setListData] = useState<ToolRow[]>([]);
  const [gridCols, setGridCols] = useState<GridColDef[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Form
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [selectOptions, setSelectOptions] = useState<Record<string, SelectOptConfig>>({});
  const [formValues, setFormValues] = useState<FormValues>({});
  const [prefixOptions, setPrefixOptions] = useState<string[]>([]);
  const [toolNumber, setToolNumber] = useState(""); // auto-generated tool code for new tool
  const [editing, setEditing] = useState<ToolRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);

  const [companyName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("companyName") || "Tool Master" : "Tool Master"
  );

  const fv = (key: string, value: any) => setFormValues(p => ({ ...p, [key]: value }));

  // ── Load tool groups on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BASE}/gettoolgroups`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        if (Array.isArray(raw) && raw.length > 0) {
          setToolGroups(raw);
          setSelectedGroupID(String(raw[0].ToolGroupID));
        }
      })
      .catch(() => {});
  }, []);

  // ── Load list when group changes ───────────────────────────────────────────────
  const loadList = useCallback((groupID: string) => {
    if (!groupID) return;
    setLoadingList(true);
    setListData([]);
    setGridCols([]);

    Promise.all([
      fetch(`${BASE}/mastergridcolumn/${groupID}`, { headers: authHeaders() })
        .then(r => r.text()).then(unwrap),
      fetch(`${BASE}/mastergrid/${groupID}`, { headers: authHeaders() })
        .then(r => r.text()).then(unwrap),
    ]).then(([colRaw, dataRaw]) => {
      if (Array.isArray(colRaw) && colRaw.length > 0 && colRaw[0]?.GridColumnName) {
        const cols: GridColDef[] = String(colRaw[0].GridColumnName)
          .split(",")
          .map((s: string) => {
            const parts = s.trim().split(/ as /i);
            return { key: parts[0].trim(), header: (parts[1] || parts[0]).trim() };
          })
          .filter(c => c.key);
        setGridCols(cols);
      }
      if (Array.isArray(dataRaw)) {
        setListData(dataRaw.map((r: any) => ({ ...r, id: String(r.ToolID) })));
      }
    }).catch(() => {})
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    if (selectedGroupID) loadList(selectedGroupID);
  }, [selectedGroupID, loadList]);

  // ── Auto-generate tool number from prefix ────────────────────────────────────
  const generateToolNo = useCallback(async (prefix: string, groupID: string) => {
    if (!prefix || !groupID) return;
    try {
      const res = await fetch(`${BASE}/getgeneratetoolno/${encodeURIComponent(prefix)}/${groupID}`, { headers: authHeaders() });
      const raw = unwrap(await res.text());
      setToolNumber(typeof raw === "string" ? raw.trim() : String(raw));
    } catch {
      setToolNumber("");
    }
  }, []);

  // ── Load field definitions + select options ────────────────────────────────────
  const loadFormSetup = useCallback(async (groupID: string) => {
    const res = await fetch(`${BASE}/gettoolgroupfields/${groupID}`, { headers: authHeaders() });
    const raw = unwrap(await res.text());
    const defs: FieldDef[] = Array.isArray(raw) ? raw : [];
    setFieldDefs(defs);

    const opts: Record<string, SelectOptConfig> = {};

    // Static options from SelectBoxDefault (no DB query)
    defs.forEach(f => {
      if (f.SelectBoxDefault && f.SelectBoxDefault !== "null" && !f.SelectBoxQueryDB) {
        const items = f.SelectBoxDefault.split(",").map((s: string) => s.trim()).filter(Boolean);
        opts[f.FieldName] = { type: "simple", items };
      }
    });

    // DB-backed options via selectboxload
    const dbFields = defs.filter(f => f.SelectBoxQueryDB && f.SelectBoxQueryDB !== "null");
    if (dbFields.length > 0) {
      const fieldIDs = dbFields.map(f => f.ToolGroupFieldID).join(",");
      try {
        const r2 = await fetch(`${BASE}/selectboxload/${fieldIDs}`, { headers: authHeaders() });
        const ds = unwrap(await r2.text());
        if (ds && typeof ds === "object" && !Array.isArray(ds)) {
          for (const [tableName, rows] of Object.entries(ds)) {
            if (!Array.isArray(rows) || rows.length === 0) continue;
            const cols = Object.keys(rows[0] as object);

            if (cols.length >= 3) {
              // 3-column: col[0]=ID, col[1]=code/name (shown in dropdown), col[2]=description (auto-fill)
              // Sentinel at index 0 — skip it
              const actualRows = (rows as Record<string, any>[]).slice(1);
              opts[tableName] = { type: "object", valueExpr: cols[0], displayExpr: cols[1], descriptionExpr: cols[2], items: actualRows };
            } else if (cols.length >= 2) {
              // 2-column: col[0]=ID, col[1]=display; sentinel at index 0 — skip
              const actualRows = (rows as Record<string, any>[]).slice(1);
              opts[tableName] = { type: "object", valueExpr: cols[0], displayExpr: cols[1], items: actualRows };
            } else if (cols.length === 1) {
              // 1-column result: sentinel row appended at end by controller
              // Skip last row (sentinel = FieldName)
              const actualRows = (rows as Record<string, any>[]).slice(0, -1);
              opts[tableName] = { type: "simple", items: actualRows.map(r => String(r[cols[0]])) };
            }
          }
        }
      } catch {}
    }

    setSelectOptions(opts);
    return { defs, opts };
  }, []);

  // ── Open Add ───────────────────────────────────────────────────────────────────
  const openAdd = async () => {
    setEditing(null);
    setError("");
    setSubmitAttempted(false);
    setActiveTab("detail");
    setLoadingForm(true);
    setToolNumber("");
    setPrefixOptions([]);
    setView("form");

    try {
      const [setup, defaultsRaw] = await Promise.all([
        loadFormSetup(selectedGroupID),
        fetch(`${BASE}/mastergridloadeddata/${selectedGroupID}/0`, { headers: authHeaders() })
          .then(r => r.text())
          .then(unwrap),
      ]);

      if (Array.isArray(defaultsRaw) && defaultsRaw.length > 0) {
        const row = defaultsRaw[0];

        // Extract prefix options from ToolGroupPrefix (comma-separated)
        const prefixes = String(row.Prefix || "")
          .split(",").map((s: string) => s.trim()).filter(Boolean);
        setPrefixOptions(prefixes);

        const defaults: FormValues = { IsToolActive: true, ToolName: "", ToolRefCode: "", ToolLocation: "" };
        Object.entries(row).forEach(([k, v]) => {
          if (k !== "ToolID" && k !== "ToolCode") {
            defaults[k] = v != null ? String(v) : "";
          }
        });
        // Ensure these are blank for a new record
        defaults.IsToolActive = true;
        defaults.ToolName = "";
        defaults.ToolRefCode = "";
        defaults.ToolLocation = "";
        defaults.ToolID = "0";

        setFormValues(defaults);

        // Auto-generate tool no for first prefix
        if (prefixes.length > 0) {
          defaults.Prefix = prefixes[0];
          setFormValues({ ...defaults });
          await generateToolNo(prefixes[0], selectedGroupID);
        }
      }
    } catch {
      setError("Failed to load form data.");
    } finally {
      setLoadingForm(false);
    }
  };

  // ── Open Edit ──────────────────────────────────────────────────────────────────
  const openEdit = async (row: ToolRow) => {
    setEditing(row);
    setError("");
    setSubmitAttempted(false);
    setActiveTab("detail");
    setLoadingForm(true);
    setToolNumber("");
    setView("form");

    try {
      const [setup, toolRaw] = await Promise.all([
        loadFormSetup(selectedGroupID),
        fetch(`${BASE}/mastergridloadeddata/${selectedGroupID}/${row.ToolID}`, { headers: authHeaders() })
          .then(r => r.text())
          .then(unwrap),
      ]);

      if (Array.isArray(toolRaw) && toolRaw.length > 0) {
        const vals: FormValues = {};
        Object.entries(toolRaw[0]).forEach(([k, v]) => {
          vals[k] = v != null ? String(v) : "";
        });
        vals.IsToolActive = isTruthy(toolRaw[0].IsToolActive);

        // SP may return ToolDescription instead of ToolName — use fallback chain
        if (!vals.ToolName) {
          vals.ToolName = vals.ToolDescription || String(row.ToolName ?? "") || "";
        }

        // Prefix for edit: show current value, build options from it
        const currentPrefix = String(toolRaw[0].Prefix || "");
        const prefixes = currentPrefix.split(",").map((s: string) => s.trim()).filter(Boolean);
        setPrefixOptions(prefixes);
        if (!vals.Prefix && prefixes.length > 0) vals.Prefix = prefixes[0];

        // Auto-fill HSN Description (DisplayName) from selectbox opts — edit data only stores ProductHSNID
        const loadedOpts = setup?.opts ?? {};
        const hsnIDVal = String(vals.ProductHSNID ?? "");
        if (hsnIDVal && hsnIDVal !== "0") {
          const hsnCfg = loadedOpts["ProductHSNID"] as ObjectSelectOpt | undefined;
          if (hsnCfg?.type === "object") {
            const match = hsnCfg.items.find(item => String(item[hsnCfg.valueExpr]) === hsnIDVal);
            if (match) {
              vals.ProductHSNName = hsnCfg.descriptionExpr ? String(match[hsnCfg.descriptionExpr] ?? "") : "";
            }
          }
        }

        setFormValues(vals);
      }
    } catch {
      setError("Failed to load tool data.");
    } finally {
      setLoadingForm(false);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────────
  const saveTool = async () => {
    setSubmitAttempted(true);
    if (!String(formValues.ToolName ?? "").trim()) {
      setError("Tool Name is required.");
      setActiveTab("detail");
      return;
    }
    if (!String(formValues.Prefix ?? "").trim()) {
      setError("Prefix is required.");
      setActiveTab("detail");
      return;
    }

    // Validate required dynamic fields
    const displayed = fieldDefs.filter(f => isTruthy(f.IsDisplay));
    for (const fd of displayed) {
      if (isTruthy(fd.IsRequiredFieldValidator)) {
        const val = String(formValues[fd.FieldName] ?? "").trim();
        if (!val || val === "null" || val === "0") {
          setError(`${fd.FieldDisplayName} is required.`);
          setActiveTab("specs");
          return;
        }
      }
    }

    setSaving(true);
    setError("");

    try {
      // Known valid ToolMaster table columns (whitelist — anything not here is either
      // a dynamic spec field for ToolMasterDetails, or a display-only field to skip)
      const TOOL_MASTER_COLS = new Set([
        'ToolGroupID', 'ToolName', 'ToolDescription', 'ToolRefCode', 'ToolLocation',
        'ProductHSNID', 'SizeH', 'SizeL', 'SizeW', 'TotalUps',
        'IsToolActive', 'PurchaseRate', 'EstimationRate', 'StockUnit', 'EstimationUnit',
        'Prefix', 'PurchaseUnit',
      ]);

      const dynamicFieldNames = new Set(fieldDefs.map(f => f.FieldName));

      const obj: Record<string, any> = {};
      const dynamicFields: Array<{ FieldName: string; FieldValue: string }> = [];

      Object.entries(formValues).forEach(([k, v]) => {
        if (k === 'id') return;
        if (dynamicFieldNames.has(k)) {
          // Configured spec field → ToolMasterDetails
          dynamicFields.push({ FieldName: k, FieldValue: String(v ?? "") });
        } else if (TOOL_MASTER_COLS.has(k)) {
          // Known static ToolMaster column
          obj[k] = v;
        }
        // Anything else (defaults-query artifacts like JobCardNo, UpsAcross etc.) → skip
      });

      obj.ToolName = String(formValues.ToolName ?? "").trim();
      obj.ToolDescription = obj.ToolName;
      obj.ToolRefCode = String(formValues.ToolRefCode ?? "").trim();
      obj.ToolLocation = String(formValues.ToolLocation ?? "").trim();
      obj.ToolGroupID = selectedGroupID;
      obj.IsToolActive = isTruthy(formValues.IsToolActive);
      obj.EstimationUnit = String(formValues.PurchaseUnit ?? formValues.EstimationUnit ?? "");
      obj.EstimationRate = String(formValues.PurchaseRate ?? formValues.EstimationRate ?? "");
      obj.Prefix = String(formValues.Prefix ?? "").trim();

      let res: Response;
      if (editing) {
        res = await fetch(`${BASE}/updatetoolmasterdata`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            JsonArrObjMainData: [obj],
            ToolID: String(editing.ToolID),
            ToolGroupID: selectedGroupID,
            DynamicFields: dynamicFields,
            FilejsonObjectsTransactionMain: null,
          }),
        });
      } else {
        res = await fetch(`${BASE}/savetoolmaster`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            JsonArrObjMainData: [obj],
            ToolGroupID: selectedGroupID,
            DynamicFields: dynamicFields,
            FilejsonObjectsTransactionMain: null,
          }),
        });
      }

      const result = unwrap(await res.text());
      if (typeof result === "string" && result.includes("Success")) {
        loadList(selectedGroupID);
        setView("list");
      } else {
        setError("Save failed: " + result);
      }
    } catch (e: any) {
      setError("Error: " + e.message);
    }
    setSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────────
  const deleteTool = async (row: ToolRow) => {
    if (!confirm("Delete this tool?")) return;
    try {
      const permRes = await fetch(`${BASE}/checkpermission/${row.ToolID}`, { headers: authHeaders() });
      const permResult = unwrap(await permRes.text());
      if (permResult === "Exist") {
        alert("This tool is used in another process and cannot be deleted.");
        return;
      }
      const groupID = row.ToolGroupID || selectedGroupID;
      const delRes = await fetch(`${BASE}/deletetoolmasterdata/${row.ToolID}/${groupID}`, { headers: authHeaders() });
      const result = unwrap(await delRes.text());
      if (typeof result === "string" && result.includes("Success")) {
        loadList(selectedGroupID);
      } else {
        alert(result || "Delete failed.");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // ── For 2-column selectbox: resolve stored ID → display text for showing in input ──
  const resolveDisplay = (fieldName: string, optConfig: ObjectSelectOpt): string => {
    const stored = String(formValues[fieldName] ?? "");
    if (!stored) return "";
    // If stored value matches a valueExpr, show the corresponding displayExpr
    const match = optConfig.items.find(item => String(item[optConfig.valueExpr]) === stored);
    return match ? String(match[optConfig.displayExpr]) : stored;
  };

  // ── Render a single dynamic field ──────────────────────────────────────────────
  const renderDynField = (fd: FieldDef) => {
    if (!isTruthy(fd.IsDisplay)) return null;

    const required = isTruthy(fd.IsRequiredFieldValidator);
    const val = formValues[fd.FieldName];
    const optConfig = selectOptions[fd.FieldName];
    const listId = `dl-${fd.FieldName}`;

    switch ((fd.FieldType || "").toLowerCase()) {
      case "number":
        return (
          <Field key={fd.FieldName} label={fd.FieldDisplayName} required={required}>
            <input type="number" value={String(val ?? "")}
              onChange={e => fv(fd.FieldName, e.target.value)} className={inputCls} min="0" />
          </Field>
        );

      case "textarea":
        return (
          <Field key={fd.FieldName} label={fd.FieldDisplayName} required={required}>
            <textarea value={String(val ?? "")}
              onChange={e => fv(fd.FieldName, e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" />
          </Field>
        );

      case "checkbox":
        return (
          <Field key={fd.FieldName} label={fd.FieldDisplayName}>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox"
                checked={isTruthy(val)}
                onChange={e => fv(fd.FieldName, e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">{fd.FieldDisplayName}</span>
            </label>
          </Field>
        );

      case "datebox":
        return (
          <Field key={fd.FieldName} label={fd.FieldDisplayName} required={required}>
            <input type="date" value={String(val ?? "").split("T")[0]}
              onChange={e => fv(fd.FieldName, e.target.value)} className={inputCls} />
          </Field>
        );

      case "selectbox":
        if (optConfig?.type === "object") {
          // DB-backed 2-column: combobox — shows display name, stores ID
          // If user picks a suggestion: maps displayExpr → valueExpr (stores ID)
          // If user types custom text: stores the typed text as-is
          // HSN pattern: ProductHSNID → also auto-fills ProductHSNName with display text
          const isHSNSelect = /ProductHSN.*ID$/i.test(fd.FieldName);
          return (
            <Field key={fd.FieldName} label={fd.FieldDisplayName} required={required}>
              <input
                type="text"
                list={listId}
                value={resolveDisplay(fd.FieldName, optConfig)}
                onChange={e => {
                  const typed = e.target.value;
                  const match = optConfig.items.find(
                    item => String(item[optConfig.displayExpr]) === typed
                  );
                  const storedVal = match ? String(match[optConfig.valueExpr]) : typed;
                  setFormValues(prev => {
                    const updates: FormValues = { ...prev, [fd.FieldName]: storedVal };
                    // Auto-fill HSN Description (DisplayName) from descriptionExpr column
                    if (isHSNSelect) {
                      const nameKey = fd.FieldName.replace(/ID$/i, "Name");
                      updates[nameKey] = (match && optConfig.descriptionExpr)
                        ? String(match[optConfig.descriptionExpr] ?? "")
                        : "";
                    }
                    return updates;
                  });
                }}
                placeholder={`Select or type…`}
                className={inputCls}
                autoComplete="off"
              />
              <datalist id={listId}>
                {optConfig.items.map((item, idx) => (
                  <option key={idx} value={String(item[optConfig.displayExpr])} />
                ))}
              </datalist>
            </Field>
          );
        } else {
          // Simple string list — combobox: pick from suggestions or type freely
          const items: string[] = optConfig?.type === "simple" ? optConfig.items : [];
          return (
            <Field key={fd.FieldName} label={fd.FieldDisplayName} required={required}>
              <input
                type="text"
                list={listId}
                value={String(val ?? "")}
                onChange={e => fv(fd.FieldName, e.target.value)}
                placeholder={`Select or type…`}
                className={inputCls}
                autoComplete="off"
              />
              <datalist id={listId}>
                {items.map(o => <option key={o} value={o} />)}
              </datalist>
            </Field>
          );
        }

      default: // text
        return (
          <Field key={fd.FieldName} label={fd.FieldDisplayName} required={required}>
            <input type="text" value={String(val ?? "")}
              onChange={e => fv(fd.FieldName, e.target.value)} className={inputCls} />
          </Field>
        );
    }
  };

  const selectedGroup = toolGroups.find(g => String(g.ToolGroupID) === selectedGroupID);
  const displayedDynFields = fieldDefs.filter(f => isTruthy(f.IsDisplay));
  const hasSpecs = displayedDynFields.length > 0;

  const columns: Column<ToolRow>[] = (
    gridCols.length > 0
      ? gridCols.slice(0, 6).map(col => ({
          key: col.key as keyof ToolRow,
          header: col.header,
          sortable: true,
          render: (r: ToolRow) => <span className="text-sm text-gray-800">{r[col.key] != null ? String(r[col.key]) : "—"}</span>,
        }))
      : [
          { key: "ToolCode" as keyof ToolRow, header: "Tool Code", sortable: true },
          { key: "ToolName" as keyof ToolRow, header: "Tool Name", sortable: true },
        ]
  );

  // ── FORM VIEW ──────────────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{companyName}</p>
            <h2 className="text-xl font-bold text-gray-800">
              {editing ? "Edit Tool" : "New Tool"}
              {selectedGroup && (
                <span className="ml-2 text-sm font-normal text-gray-500">— {selectedGroup.ToolGroupName}</span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <List size={16} /> Back to List
            </button>
            <button onClick={saveTool} disabled={saving || loadingForm}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save Tool
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {loadingForm ? (
          <div className="flex items-center justify-center h-48 bg-white rounded-xl border border-gray-200">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Tab bar */}
            <div className="px-6 pt-5 pb-0 border-b border-gray-200 bg-gray-50/30">
              {editing && (
                <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                  ID: {editing.ToolID} &nbsp;·&nbsp; Code: {editing.ToolCode}
                </span>
              )}
              <div className="flex gap-8">
                <button onClick={() => setActiveTab("detail")}
                  className={`pb-3 text-sm font-medium border-b-2 ${
                    activeTab === "detail" ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"
                  }`}>
                  Tool Details
                </button>
                {hasSpecs && (
                  <button onClick={() => setActiveTab("specs")}
                    className={`pb-3 text-sm font-medium border-b-2 ${
                      activeTab === "specs" ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"
                    }`}>
                    Specifications
                  </button>
                )}
              </div>
            </div>

            <div className="p-8 space-y-8">
              {/* ── TOOL DETAILS TAB ── */}
              {activeTab === "detail" && (
                <>
                  <div>
                    <SectionTitle title="Tool Identity" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <Field label="Tool Name / Description" required>
                          <input type="text" value={String(formValues.ToolName ?? "")}
                            onChange={e => fv("ToolName", e.target.value)}
                            placeholder="e.g. Cylinder Set A — Client Name"
                            className={ic(submitAttempted && !String(formValues.ToolName ?? "").trim())} />
                        </Field>
                      </div>
                      <Field label="Tool Ref Code">
                        <input type="text" value={String(formValues.ToolRefCode ?? "")}
                          onChange={e => fv("ToolRefCode", e.target.value)}
                          placeholder="e.g. REF-001" className={inputCls} />
                      </Field>

                      {/* Prefix — dropdown from ToolGroupPrefix, triggers tool no generation */}
                      <Field label="Prefix" required>
                        {prefixOptions.length > 0 ? (
                          <select
                            value={String(formValues.Prefix ?? "")}
                            onChange={async e => {
                              fv("Prefix", e.target.value);
                              if (!editing) await generateToolNo(e.target.value, selectedGroupID);
                            }}
                            disabled={!!editing}
                            className={ic(submitAttempted && !String(formValues.Prefix ?? "").trim()) + (editing ? " bg-gray-50 cursor-not-allowed" : "")}>
                            <option value="">— Select Prefix —</option>
                            {prefixOptions.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        ) : (
                          <input type="text" value={String(formValues.Prefix ?? "")}
                            onChange={async e => {
                              fv("Prefix", e.target.value);
                              if (!editing && e.target.value) await generateToolNo(e.target.value, selectedGroupID);
                            }}
                            readOnly={!!editing}
                            placeholder="e.g. CYL"
                            className={ic(submitAttempted && !String(formValues.Prefix ?? "").trim()) + (editing ? " bg-gray-50 cursor-not-allowed" : "")} />
                        )}
                      </Field>

                      {/* Auto-generated Tool No — shown for new tools only */}
                      {!editing && (
                        <Field label="Tool No (Auto Generated)">
                          <input type="text" value={toolNumber}
                            readOnly
                            placeholder="Will be generated on save"
                            className={inputCls + " bg-gray-50 text-gray-600 cursor-not-allowed"} />
                        </Field>
                      )}
                    </div>
                  </div>

                  <div>
                    <SectionTitle title="Storage & Status" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <Field label="Storage Location">
                          <input type="text" value={String(formValues.ToolLocation ?? "")}
                            onChange={e => fv("ToolLocation", e.target.value)}
                            placeholder="e.g. Rack A-1, Die Store" className={inputCls} />
                        </Field>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox"
                            checked={isTruthy(formValues.IsToolActive)}
                            onChange={e => fv("IsToolActive", e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                          <span className="text-sm font-semibold text-gray-700">Active Tool</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {hasSpecs && (
                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      <button onClick={() => setActiveTab("specs")}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 shadow-sm">
                        Specifications <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── SPECIFICATIONS TAB ── */}
              {activeTab === "specs" && hasSpecs && (
                <>
                  <div>
                    <SectionTitle title={`${selectedGroup?.ToolGroupName ?? "Tool"} Specifications`} />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {displayedDynFields.map(fd => renderDynField(fd))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <button onClick={() => setActiveTab("detail")}
                      className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                      ← Details
                    </button>
                    <button onClick={saveTool} disabled={saving}
                      className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-60">
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Save Tool
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

  // ── LIST VIEW ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Tool Master</h2>
          <p className="text-sm text-gray-500">
            {loadingList
              ? "Loading..."
              : `${listData.length} tool${listData.length !== 1 ? "s" : ""}${selectedGroup ? ` — ${selectedGroup.ToolGroupName}` : ""}`}
          </p>
        </div>
        <button onClick={openAdd} disabled={!selectedGroupID}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
          <Plus size={16} /> Add Tool
        </button>
      </div>

      {/* Tool Group filter pills */}
      {toolGroups.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Tool Group</span>
            {toolGroups.map(g => (
              <button key={g.ToolGroupID} onClick={() => setSelectedGroupID(String(g.ToolGroupID))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedGroupID === String(g.ToolGroupID)
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {g.ToolGroupName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={listData}
          columns={columns}
          searchKeys={["ToolCode", "ToolName", "ToolLocation", "ToolRefCode"]}
          actions={row => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteTool(row)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
