"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";
import { usePermissions } from "@/context/PermissionsContext";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/producthsnmasterShrink`;

// ── Unwrap triple-encoded JSON ───────────────────────────────────────────────
function unwrap(raw: any): any {
  let r = raw;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
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
const ic = (err: boolean | string | undefined) => err ? inputCls.replace("border-gray-300", "border-red-400 bg-red-50/50") : inputCls;

// ── Types ──────────────────────────────────────────────────────────────────────
type HSNRow = {
  id: string;
  ProductHSNID: string;
  ProductHSNName: string;
  HSNCode: string;
  DisplayName: string;
  TariffNo: string;
  ProductCategory: string;
  GSTTaxPercentage: number;
  VATTaxPercentage: number;
  ExciseTaxPercentage: number;
  CGSTTaxPercentage: number;
  SGSTTaxPercentage: number;
  IGSTTaxPercentage: number;
  ItemGroupID: string;
  ItemSubGroupID: string;
  SubGroupType: string;
  TypeSpecification: string;
  CreatedBy: string;
  CreatedDate: string;
  IsServiceHSN: boolean | number;
  IsExciseApplicable: boolean | number;
};

// ItemGroupCategory/ClassificationMode come straight from Item Group Master --
// no hardcoded "Product Type" list here anymore. A group's ClassificationMode
// decides whether the Sub Group 1/2/3 cascade applies; Category is just carried
// through onto the HSN row for the list-view filter pills.
type ItemGroup = { ItemGroupID: string; ItemGroupName: string; ItemGroupCategory: string; ClassificationMode: string };

type FormState = {
  ProductHSNName: string;
  DisplayName: string;
  HSNCode: string;
  TariffNo: string;
  ItemGroupID: string;
  ItemSubGroupID: string;
  SubGroupType: string;
  TypeSpecification: string;
  IsServiceHSN: boolean;
  GSTTaxPercentage: string;
  VATTaxPercentage: string;
  ExciseTaxPercentage: string;
  MinimumExciseAmount: string;
  IsExciseApplicable: boolean;
  CGSTTaxPercentage: string;
  SGSTTaxPercentage: string;
  IGSTTaxPercentage: string;
};

const blank = (): FormState => ({
  ProductHSNName: "", DisplayName: "", HSNCode: "", TariffNo: "",
  ItemGroupID: "", ItemSubGroupID: "", SubGroupType: "", TypeSpecification: "",
  IsServiceHSN: false,
  GSTTaxPercentage: "0", VATTaxPercentage: "0",
  ExciseTaxPercentage: "0", MinimumExciseAmount: "0",
  IsExciseApplicable: false,
  CGSTTaxPercentage: "0", SGSTTaxPercentage: "0", IGSTTaxPercentage: "0",
});

const toBool = (v: any) => v === true || v === 1 || v === "True" || v === "true";

// ── Page ───────────────────────────────────────────────────────────────────────
export default function HSNPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<HSNRow[]>([]);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [isVatMode, setIsVatMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<HSNRow | null>(null);
  const { can } = usePermissions();
  const [form, setForm] = useState<FormState>(blank());
  const [filterCategory, setFilterCategory] = useState("All");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [companyName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("companyName") || "HSN Master" : "HSN Master"
  );

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  // ── Load list ─────────────────────────────────────────────────────────────────
  const loadList = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}/showlist`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        setData(Array.isArray(raw) ? raw.map((r: any) => ({ ...r, id: String(r.ProductHSNID) })) : []);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadList();
    // Item groups dropdown
    fetch(`${BASE}/selitemgroupname`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => { const raw = unwrap(text); setItemGroups(Array.isArray(raw) ? raw : []); })
      .catch(() => setItemGroups([]));
    // Tax type (GST vs VAT)
    fetch(`${BASE}/checktaxtype`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        const arr = Array.isArray(raw) ? raw : [];
        if (arr.length > 0) setIsVatMode(toBool(arr[0].IsVatApplicable));
      })
      .catch(() => {});
  }, [loadList]);

  const selectedItemGroup = useMemo(
    () => itemGroups.find(g => String(g.ItemGroupID) === form.ItemGroupID),
    [itemGroups, form.ItemGroupID]
  );
  // Sub Group 1/2/3 cascade only applies to "Hierarchical" item groups (Raw Material
  // types like Ink/Film). "Flat" groups (Sleeve, Capital Goods...) skip straight to
  // HSN Code -- there's nothing under them to drill into.
  const isHierarchical = selectedItemGroup?.ClassificationMode === "Hierarchical";
  // Category isn't a separate hardcoded pick anymore -- it's carried straight through
  // from the selected Item Group (or "Service" when this row isn't tied to an item at all).
  const computedProductCategory = form.IsServiceHSN ? "Service" : (selectedItemGroup?.ItemGroupCategory || "");

  const [sgSubGroupOpts, setSgSubGroupOpts] = useState<{id: string; name: string}[]>([]);
  const [sgTypeOpts, setSgTypeOpts] = useState<{type: string; prefix: string}[]>([]);
  const [sgTypeSpecOpts, setSgTypeSpecOpts] = useState<{spec: string; prefix: string}[]>([]);

  // ── Auto-computed DisplayName ──────────────────────────────────────────────────
  const autoDisplayName = useMemo(() => {
    if (form.IsServiceHSN) return form.HSNCode.trim() ? `Service — ${form.HSNCode.trim()}` : "Service";
    if (!selectedItemGroup) return "";
    if (isHierarchical) {
      const sg1 = sgSubGroupOpts.find(o => o.id === form.ItemSubGroupID)?.name ?? "";
      const parts = [sg1, form.SubGroupType, form.TypeSpecification].filter(Boolean).join(" ").trim();
      if (parts) return parts;
    }
    return selectedItemGroup.ItemGroupName;
  }, [form.IsServiceHSN, form.HSNCode, selectedItemGroup, isHierarchical,
      form.ItemSubGroupID, form.SubGroupType, form.TypeSpecification, sgSubGroupOpts]);

  const prevAutoRef = useRef("");
  useEffect(() => {
    if (!editing) {
      if (form.DisplayName === "" || form.DisplayName === prevAutoRef.current) {
        setForm(p => ({ ...p, DisplayName: autoDisplayName }));
        prevAutoRef.current = autoDisplayName;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDisplayName, editing]);

  const loadSgSubGroups = async (groupID: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/itemmasterShrink/film-subgroups/${groupID}`, { headers: authHeaders() });
      const raw = unwrap(await res.text());
      setSgSubGroupOpts(Array.isArray(raw) ? raw.map((x: any) => ({ id: String(x.ItemSubGroupID), name: x.ItemSubGroupName })) : []);
    } catch { setSgSubGroupOpts([]); }
  };

  const loadSgTypes = async (groupID: string, subGroupID: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/itemmasterShrink/film-types/${groupID}/${subGroupID}`, { headers: authHeaders() });
      const raw = unwrap(await res.text());
      setSgTypeOpts(Array.isArray(raw) ? raw.map((x: any) => ({ type: x.SubGroupType, prefix: x.SubGroupTypePrefix })) : []);
    } catch { setSgTypeOpts([]); }
  };

  const loadSgTypeSpecs = async (groupID: string, subGroupID: string, type: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/itemmasterShrink/film-type-specs`, {
        method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ItemGroupID: groupID, SubGroupID: subGroupID, SubGroupType: type })
      });
      const raw = unwrap(await res.text());
      setSgTypeSpecOpts(Array.isArray(raw) ? raw.map((x: any) => ({ spec: x.TypeSpecification, prefix: x.TypeSpacificationPrefix })) : []);
    } catch { setSgTypeSpecOpts([]); }
  };

  // ── Open add ──────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setError("");
    setForm(blank());
    setSgSubGroupOpts([]);
    setSgTypeOpts([]);
    setSgTypeSpecOpts([]);
    prevAutoRef.current = "";
    setView("form");
  };

  // ── Open edit ─────────────────────────────────────────────────────────────────
  const openEdit = (row: HSNRow) => {
    setEditing(row);
    setError("");
    setForm({
      ProductHSNName: row.ProductHSNName ?? "",
      DisplayName: row.DisplayName ?? "",
      HSNCode: row.HSNCode ?? "",
      TariffNo: row.TariffNo ?? "",
      ItemGroupID: String(row.ItemGroupID ?? ""),
      ItemSubGroupID: String(row.ItemSubGroupID ?? ""),
      SubGroupType: row.SubGroupType ?? "",
      TypeSpecification: row.TypeSpecification ?? "",
      IsServiceHSN: toBool(row.IsServiceHSN),
      GSTTaxPercentage: String(row.GSTTaxPercentage ?? "0"),
      VATTaxPercentage: String(row.VATTaxPercentage ?? "0"),
      ExciseTaxPercentage: String(row.ExciseTaxPercentage ?? "0"),
      MinimumExciseAmount: "0",
      IsExciseApplicable: toBool(row.IsExciseApplicable),
      CGSTTaxPercentage: String(row.CGSTTaxPercentage ?? "0"),
      SGSTTaxPercentage: String(row.SGSTTaxPercentage ?? "0"),
      IGSTTaxPercentage: String(row.IGSTTaxPercentage ?? "0"),
    });

    // Restore the Sub Group cascade if this row has one
    const gID = String(row.ItemGroupID ?? "");
    const sgID = String(row.ItemSubGroupID ?? "");
    const type = row.SubGroupType ?? "";

    if (gID) loadSgSubGroups(gID);
    if (gID && sgID) loadSgTypes(gID, sgID);
    if (gID && sgID && type) loadSgTypeSpecs(gID, sgID, type);

    setView("form");
  };

  // ── Save ──────────────────────────────────────────────────────────────────────
  const saveHSN = async () => {
    if (!can("/masters/hsn", editing ? "CanEdit" : "CanSave")) {
      alert(editing ? "You are not authorized to edit HSN Master." : "You are not authorized to save HSN Master.");
      return;
    }
    setSubmitAttempted(true);
    if (!form.IsServiceHSN && !form.ItemGroupID) {
      setError("Item Group is required (or mark this as a Service HSN)."); return;
    }
    if (!form.HSNCode.trim()) { setError("HSN Code is required."); return; }

    const finalDisplayName = form.DisplayName.trim() || autoDisplayName || ("HSN " + form.HSNCode);

    setSaving(true);
    setError("");
    try {
      const record: Record<string, any> = {
        ProductHSNName: autoDisplayName || finalDisplayName,
        HSNCode: form.HSNCode,
        DisplayName: finalDisplayName,
        TariffNo: form.TariffNo || null,
        ProductCategory: computedProductCategory,
        ItemGroupID: form.IsServiceHSN ? null : (form.ItemGroupID ? Number(form.ItemGroupID) : null),
        ItemSubGroupID: (!form.IsServiceHSN && isHierarchical && form.ItemSubGroupID) ? Number(form.ItemSubGroupID) : null,
        SubGroupType: (!form.IsServiceHSN && isHierarchical) ? (form.SubGroupType || null) : null,
        TypeSpecification: (!form.IsServiceHSN && isHierarchical) ? (form.TypeSpecification || null) : null,
        CGSTTaxPercentage: Number(form.CGSTTaxPercentage),
        SGSTTaxPercentage: Number(form.SGSTTaxPercentage),
        IsServiceHSN: form.IsServiceHSN,
      };

      if (isVatMode) {
        record.GSTTaxPercentage = Number(form.VATTaxPercentage);
        record.IGSTTaxPercentage = Number(form.VATTaxPercentage);
        record.ExciseTaxPercentage = Number(form.ExciseTaxPercentage);
        record.MinimumExciseAmount = Number(form.MinimumExciseAmount);
        record.IsExciseApplicable = form.IsExciseApplicable;
      } else {
        record.GSTTaxPercentage = Number(form.GSTTaxPercentage);
        record.IGSTTaxPercentage = Number(form.IGSTTaxPercentage);
      }

      let res: Response;
      if (editing) {
        res = await fetch(`${BASE}/update/${editing.ProductHSNID}`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify([record]),
        });
      } else {
        res = await fetch(
          `${BASE}/save?TxtGroupName=${encodeURIComponent(finalDisplayName)}`,
          {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify([record]),
          }
        );
      }

      const result = unwrap(await res.text());
      if (result === "Success") {
        loadList();
        setView("list");
      } else if (result === "Exist") {
        setError("An HSN with this combination/Display Name already exists.");
      } else {
        setError("Save failed: " + result);
      }
    } catch (e: any) {
      setError("Error: " + e.message);
    }
    setSaving(false);
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleteHSN = async (id: string) => {
    if (!can("/masters/hsn", "CanDelete")) { alert("You are not authorized to delete HSN Master."); return; }
    // Check if HSN is used in other modules first
    try {
      const chk = await fetch(`${BASE}/checkpermission/${id}`, { headers: authHeaders() });
      const chkResult = unwrap(await chk.text());
      if (chkResult === "Exist") {
        alert("This HSN is used in another process. Record cannot be deleted.");
        return;
      }
    } catch { /* proceed */ }

    if (!confirm("Delete this HSN code?")) return;
    try {
      const res = await fetch(`${BASE}/delete/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const result = unwrap(await res.text());
      if (result === "Success") loadList();
      else alert("Delete failed: " + result);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // ── List derived ──────────────────────────────────────────────────────────────
  const uniqueCategories = useMemo(() =>
    ["All", ...new Set(data.map(r => r.ProductCategory).filter(Boolean))],
    [data]);

  const filtered = useMemo(() =>
    filterCategory === "All" ? data : data.filter(r => r.ProductCategory === filterCategory),
    [data, filterCategory]);

  // ── FORM VIEW ─────────────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{companyName}</p>
            <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit HSN Code" : "New HSN Code"}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <List size={16} /> Back to List
            </button>
            <button onClick={saveHSN} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save HSN
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
                ID: {editing.ProductHSNID}
              </span>
            )}
            <div className="flex gap-8">
              <button className="pb-3 text-sm font-medium border-b-2 text-blue-600 border-blue-600">
                HSN Details
              </button>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Identity */}
            <div>
              <SectionTitle title="HSN Identity" />

              <label className="flex items-center gap-2 cursor-pointer mb-6 w-fit">
                <input type="checkbox" checked={form.IsServiceHSN}
                  onChange={e => {
                    const checked = e.target.checked;
                    setForm(p => ({ ...p, IsServiceHSN: checked, ItemGroupID: "", ItemSubGroupID: "", SubGroupType: "", TypeSpecification: "" }));
                    setSgSubGroupOpts([]); setSgTypeOpts([]); setSgTypeSpecOpts([]);
                  }}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                <span className="text-sm font-medium text-gray-700">This is a Service HSN (not tied to any item)</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {!form.IsServiceHSN && (
                  <>
                    <Field label="Item Group" required>
                      <select value={form.ItemGroupID}
                        onChange={e => {
                          const v = e.target.value;
                          setForm(p => ({ ...p, ItemGroupID: v, ItemSubGroupID: "", SubGroupType: "", TypeSpecification: "" }));
                          setSgSubGroupOpts([]); setSgTypeOpts([]); setSgTypeSpecOpts([]);
                          const grp = itemGroups.find(g => String(g.ItemGroupID) === v);
                          if (v && grp?.ClassificationMode === "Hierarchical") loadSgSubGroups(v);
                        }} className={ic(submitAttempted && !form.IsServiceHSN && !form.ItemGroupID)}>
                        <option value="">Select Group...</option>
                        {itemGroups.map(g => (
                          <option key={g.ItemGroupID} value={String(g.ItemGroupID)}>{g.ItemGroupName}</option>
                        ))}
                      </select>
                    </Field>

                    {isHierarchical && (
                      <>
                        <Field label="Sub Group 1">
                          <select value={form.ItemSubGroupID}
                            onChange={e => {
                              const v = e.target.value;
                              setForm(p => ({ ...p, ItemSubGroupID: v, SubGroupType: "", TypeSpecification: "" }));
                              setSgTypeOpts([]); setSgTypeSpecOpts([]);
                              if (form.ItemGroupID && v) loadSgTypes(form.ItemGroupID, v);
                            }} className={inputCls} disabled={!form.ItemGroupID}>
                            <option value="">Select Sub Group 1...</option>
                            {sgSubGroupOpts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </Field>

                        <Field label="Sub Group 2">
                          <select value={form.SubGroupType}
                            onChange={e => {
                              const v = e.target.value;
                              setForm(p => ({ ...p, SubGroupType: v, TypeSpecification: "" }));
                              setSgTypeSpecOpts([]);
                              if (form.ItemGroupID && form.ItemSubGroupID && v) loadSgTypeSpecs(form.ItemGroupID, form.ItemSubGroupID, v);
                            }} className={inputCls} disabled={!form.ItemSubGroupID || sgTypeOpts.length === 0}>
                            <option value="">Select Sub Group 2...</option>
                            {sgTypeOpts.map(o => <option key={o.type} value={o.type}>{o.type}</option>)}
                          </select>
                        </Field>

                        <Field label="Sub Group 3">
                          <select value={form.TypeSpecification}
                            onChange={e => f("TypeSpecification", e.target.value)}
                            className={inputCls} disabled={!form.SubGroupType || sgTypeSpecOpts.length === 0}>
                            <option value="">Select Sub Group 3...</option>
                            {sgTypeSpecOpts.map(o => <option key={o.spec} value={o.spec}>{o.spec}</option>)}
                          </select>
                        </Field>
                      </>
                    )}
                  </>
                )}

                <Field label="HSN Code" required>
                  <input type="text" value={form.HSNCode}
                    onChange={e => f("HSNCode", e.target.value)}
                    placeholder="e.g. 3920" className={ic(submitAttempted && !form.HSNCode.trim())} />
                </Field>
                <Field label="Tariff No">
                  <input type="text" value={form.TariffNo}
                    onChange={e => f("TariffNo", e.target.value)}
                    placeholder="Tariff number" className={inputCls} />
                </Field>
                <Field label="Display Name / Description">
                  <input type="text" value={form.DisplayName}
                    onChange={e => {
                      prevAutoRef.current = "";
                      f("DisplayName", e.target.value);
                    }}
                    placeholder={autoDisplayName || "e.g. GST 18% on Services"}
                    className={inputCls} />
                </Field>
                {computedProductCategory && (
                  <Field label="Product Category">
                    <input type="text" value={computedProductCategory} readOnly
                      className={inputCls + " bg-gray-50 text-gray-500 cursor-not-allowed"} />
                  </Field>
                )}
              </div>
            </div>

            {/* GST mode tax rates */}
            {!isVatMode && (
              <div>
                <SectionTitle title="GST Tax Rates (%)" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <Field label="GST %">
                    <input type="number" step="0.01" min="0" value={form.GSTTaxPercentage}
                      onChange={e => f("GSTTaxPercentage", e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="CGST %">
                    <input type="number" step="0.01" min="0" value={form.CGSTTaxPercentage}
                      onChange={e => f("CGSTTaxPercentage", e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="SGST %">
                    <input type="number" step="0.01" min="0" value={form.SGSTTaxPercentage}
                      onChange={e => f("SGSTTaxPercentage", e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="IGST %">
                    <input type="number" step="0.01" min="0" value={form.IGSTTaxPercentage}
                      onChange={e => f("IGSTTaxPercentage", e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <p className="text-xs text-gray-400 mt-2">CGST + SGST must add up to GST. IGST must be 0 or equal to GST.</p>
              </div>
            )}

            {/* VAT mode tax rates */}
            {isVatMode && (
              <div>
                <SectionTitle title="VAT / Excise Tax Rates (%)" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <Field label="VAT %">
                    <input type="number" step="0.01" min="0" value={form.VATTaxPercentage}
                      onChange={e => f("VATTaxPercentage", e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="CGST %">
                    <input type="number" step="0.01" min="0" value={form.CGSTTaxPercentage}
                      onChange={e => f("CGSTTaxPercentage", e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="SGST %">
                    <input type="number" step="0.01" min="0" value={form.SGSTTaxPercentage}
                      onChange={e => f("SGSTTaxPercentage", e.target.value)} className={inputCls} />
                  </Field>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.IsExciseApplicable}
                        onChange={e => f("IsExciseApplicable", e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                      <span className="text-sm font-medium text-gray-700">Excise Applicable</span>
                    </label>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">CGST + SGST must add up to VAT. IGST must be 0 or equal to VAT.</p>
                {form.IsExciseApplicable && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
                    <Field label="Excise %">
                      <input type="number" step="0.01" min="0" value={form.ExciseTaxPercentage}
                        onChange={e => f("ExciseTaxPercentage", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Min Excise Amount">
                      <input type="number" step="0.01" min="0" value={form.MinimumExciseAmount}
                        onChange={e => f("MinimumExciseAmount", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  const columns: Column<HSNRow>[] = [
    { key: "ProductHSNID", header: "ID", sortable: true },
    { key: "ProductHSNName", header: "Group Name", sortable: true },
    { key: "HSNCode", header: "HSN Code", sortable: true },
    { key: "DisplayName", header: "Display Name" },
    {
      key: "ProductCategory", header: "Category",
      render: r => r.ProductCategory
        ? <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{r.ProductCategory}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: "GSTTaxPercentage", header: "GST %",
      render: r => <span className="text-gray-700">{r.GSTTaxPercentage ?? 0}%</span>,
    },
    {
      key: "CGSTTaxPercentage", header: "CGST %",
      render: r => <span className="text-gray-600 text-xs">{r.CGSTTaxPercentage ?? 0}%</span>,
    },
    {
      key: "SGSTTaxPercentage", header: "SGST %",
      render: r => <span className="text-gray-600 text-xs">{r.SGSTTaxPercentage ?? 0}%</span>,
    },
    {
      key: "IGSTTaxPercentage", header: "IGST %",
      render: r => <span className="text-gray-600 text-xs">{r.IGSTTaxPercentage ?? 0}%</span>,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">HSN Master</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${filtered.length} of ${data.length} HSN codes`}
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add HSN
        </button>
      </div>

      {/* Category filter pills */}
      {uniqueCategories.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Category</span>
            {uniqueCategories.map(c => (
              <button key={c} onClick={() => setFilterCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCategory === c ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {c === "All" ? "All Categories" : c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={filtered}
          columns={columns}
          searchKeys={["ProductHSNName", "HSNCode", "DisplayName", "ProductCategory"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteHSN(row.ProductHSNID)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
