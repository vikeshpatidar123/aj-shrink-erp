"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Cylinder, Save, Loader2, AlertCircle, CheckCircle2,
  ArrowLeft, Trash2, RefreshCw, Plus,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { inputCls, labelCls } from "@/lib/styles";

// ─── Types ────────────────────────────────────────────────────

type ProductInfo = {
  ProductMasterID: string; ProductMasterCode: string; ProductName: string;
  NoOfColors: number; GrvPlanCylCirc: number; GrvPlanCylWidth: number;
  GrvPlanRepeatUPS: number; GrvPlanCylCode: string;
};

type ColorInfo = {
  ColorJobColorID: string; ItemID: string; ItemName: string;
  ColorName: string; SequenceNo: number;
};

type CylRow = {
  tmpId: string;
  colorSeq: number;
  colorName: string;
  cylinderName: string;
  cylinderCode: string;    // user's CUC-001 → ToolRefCode
  circumference: number;
  printWidth: number;
  cylLength: number;
  repeatUPS: number;
  cylType: string;
  vendorLedgerID: string;
  vendorName: string;
  hsnID: string;
  purchaseRate: number;
  remarks: string;
  totalColors: number;
  toolGroupID: string;
  // Read-back after save
  ToolCode?: string;
  ToolID?: string;
};

type Vendor    = { LedgerID: string; LedgerName: string };
type HSN       = { ProductHSNID: string; HSNCode: string; HSNDescription: string };
type ToolGroup = { ToolGroupID: string; ToolGroupName: string; Prefix: string };
type SavedTool = { ToolID: string; ToolCode: string; ColorName: string; ColorSeq: number };

const API_CAT = "api/productcataloggravureShrink";
const API_CYL = "api/cylindermasterShrink";

let _id = 0;
const uid = () => String(++_id);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className={labelCls}>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {children}
  </div>
);

const Num = ({ value, onChange, placeholder, step = "0.01", min = "0" }: {
  value: number; onChange: (n: number) => void; placeholder?: string; step?: string; min?: string;
}) => (
  <input type="number" value={value || ""} step={step} min={min} placeholder={placeholder}
    onChange={e => onChange(parseFloat(e.target.value) || 0)} className={inputCls} />
);

// ─── Inner component that uses useSearchParams ────────────────

function CreateCylindersInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pmid = searchParams.get("pmid") ?? "";

  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [colors, setColors]   = useState<ColorInfo[]>([]);
  const [cylRows, setCylRows] = useState<CylRow[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [hsnList, setHsnList] = useState<HSN[]>([]);
  const [toolGroups, setToolGroups] = useState<ToolGroup[]>([]);

  const [loading, setLoading]     = useState(true);
  const [saving,  setSaving]      = useState(false);
  const [msg,     setMsg]         = useState("");
  const [savedTools, setSavedTools] = useState<SavedTool[]>([]);
  const [existing, setExisting]   = useState<SavedTool[]>([]);

  // ── Load page data ──────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!pmid) { setLoading(false); return; }
    setLoading(true);
    try {
      // 3 datasets in one call: product+plan || colors || existing ToolMaster rows
      const raw = await apiGet<string>(`${API_CYL}/getcreateinfo/${pmid}`);
      const parts = (typeof raw === "string" ? raw : JSON.stringify(raw)).split("||");
      const pm: ProductInfo[]  = parts[0] ? JSON.parse(parts[0]) : [];
      const cl: ColorInfo[]    = parts[1] ? JSON.parse(parts[1]) : [];
      const ex: SavedTool[]    = parts[2] ? JSON.parse(parts[2]) : [];

      const p = pm[0] ?? null;
      setProduct(p);
      setColors(cl);
      setExisting(ex);

      // Pre-populate rows from colors
      setCylRows(cl.map((c, i) => ({
        tmpId: uid(),
        colorSeq: c.SequenceNo || i + 1,
        colorName: c.ColorName || c.ItemName || `Color ${i + 1}`,
        cylinderName: `${p?.ProductMasterCode ?? ""} - ${c.ColorName || c.ItemName || `C${i + 1}`}`,
        cylinderCode: "",
        circumference: p?.GrvPlanCylCirc ?? 0,
        printWidth: p?.GrvPlanCylWidth ?? 0,
        cylLength: p?.GrvPlanCylWidth ?? 0,
        repeatUPS: p?.GrvPlanRepeatUPS ?? 1,
        cylType: "New",
        vendorLedgerID: "", vendorName: "",
        hsnID: "", purchaseRate: 0, remarks: "",
        totalColors: cl.length || (p?.NoOfColors ?? 1),
        toolGroupID: "",
      })));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Load failed");
    } finally { setLoading(false); }
  }, [pmid]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    apiGet<Vendor[]>(`${API_CYL}/getvendorlist`).then(r => setVendors(r ?? [])).catch(() => {});
    apiGet<HSN[]>(`${API_CYL}/gethsnlist`).then(r => setHsnList(r ?? [])).catch(() => {});
    apiGet<ToolGroup[]>(`${API_CYL}/gettoolgroups`).then(r => setToolGroups(r ?? [])).catch(() => {});
  }, []);

  // ── Save all cylinders ──────────────────────────────────────

  const handleSave = async () => {
    if (!pmid) { setMsg("No product selected."); return; }
    if (cylRows.some(r => !r.cylinderCode.trim())) {
      setMsg("Enter Cylinder Code for every row.");
      return;
    }
    setSaving(true); setMsg("");
    try {
      const res = await apiPost<{ Status: string; SavedTools: SavedTool[]; Message?: string }>(
        `${API_CYL}/saveallcylinders`,
        {
          ProductMasterID: pmid,
          ProductMasterCode: product?.ProductMasterCode ?? "",
          ToolGroupID: cylRows[0]?.toolGroupID ?? "",
          Prefix: toolGroups.find(g => g.ToolGroupID === cylRows[0]?.toolGroupID)?.Prefix ?? "PC",
          Cylinders: cylRows.map(r => ({
            colorSequenceNo: r.colorSeq,
            colorName: r.colorName,
            cylinderName: r.cylinderName,
            cylinderCode: r.cylinderCode,
            circumference: r.circumference,
            printWidth: r.printWidth,
            cylLength: r.cylLength,
            repeatUPS: r.repeatUPS,
            cylType: r.cylType,
            totalColors: r.totalColors,
            vendorLedgerID: r.vendorLedgerID,
            vendorName: r.vendorName,
            hsnID: r.hsnID,
            purchaseRate: r.purchaseRate,
            remarks: r.remarks,
            toolGroupID: r.toolGroupID,
          })),
        }
      );

      if (res?.Status === "success" && res.SavedTools?.length) {
        setSavedTools(res.SavedTools);
        // Patch ToolCode back into rows
        setCylRows(prev => prev.map(r => {
          const match = res.SavedTools.find(t => t.ColorSeq === r.colorSeq);
          return match ? { ...r, ToolCode: match.ToolCode, ToolID: match.ToolID } : r;
        }));
        setMsg(`All ${res.SavedTools.length} cylinders created successfully!`);
      } else {
        setMsg(res?.Message ?? "Save failed");
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  // ── Helpers ─────────────────────────────────────────────────

  const updateRow = (tmpId: string, key: keyof CylRow, val: string | number) =>
    setCylRows(p => p.map(r => r.tmpId === tmpId ? { ...r, [key]: val } : r));

  const copyFirstToAll = (key: keyof CylRow) => {
    if (cylRows.length === 0) return;
    const val = cylRows[0][key];
    setCylRows(p => p.map(r => ({ ...r, [key]: val })));
  };

  // ─────────────────────────────────────────────────────────────

  if (!pmid) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <AlertCircle size={40} className="mb-3" />
        <p className="font-semibold text-gray-600">No product selected</p>
        <p className="text-sm mt-1">Open this page from a Product Catalog entry (Cylinders tab → Create Cylinders).</p>
        <button onClick={() => router.push("/gravure/product-catalog")}
          className="mt-5 flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors">
          <ArrowLeft size={14} /> Back to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Cylinder size={18} className="text-blue-600" />
            <h2 className="text-lg font-bold text-gray-800">Create Cylinders in Master</h2>
          </div>
          {product && (
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-purple-700">{product.ProductMasterCode}</span>
              {" "}· {product.ProductName} · {product.NoOfColors} Colors
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/gravure/product-catalog`)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <ArrowLeft size={14} /> Back to Catalog
          </button>
          <button onClick={loadData} title="Reload"
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
            <RefreshCw size={14} />
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save All {cylRows.length} Cylinders
          </button>
        </div>
      </div>

      {/* Status message */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium
          ${msg.includes("success") || msg.includes("created") ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {msg.includes("success") || msg.includes("created") ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {msg}
        </div>
      )}

      {/* Existing cylinders (already saved for this product) */}
      {existing.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">
            Existing Cylinders — will be replaced on Save
          </p>
          <div className="flex flex-wrap gap-2">
            {existing.map(e => (
              <span key={e.ToolID} className="px-3 py-1 bg-white border border-amber-300 rounded-full text-xs font-semibold text-amber-800">
                {e.ToolCode} — {e.ColorName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Saved tools (after save) */}
      {savedTools.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">
            Cylinders Created in ToolMaster — copy these codes back to the catalog
          </p>
          <div className="flex flex-wrap gap-2">
            {savedTools.map(t => (
              <span key={t.ToolID} className="px-3 py-1.5 bg-white border border-green-300 rounded-full text-xs font-mono font-bold text-green-800">
                {t.ToolCode} — {t.ColorName}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
          <Loader2 size={20} className="animate-spin" /> Loading product data…
        </div>
      ) : (
        <>
          {/* Tool Group selector (shared across all rows) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4">Tool Group (applies to all cylinders)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Tool Group" required>
                <select value={cylRows[0]?.toolGroupID ?? ""}
                  onChange={e => setCylRows(p => p.map(r => ({ ...r, toolGroupID: e.target.value })))}
                  className={inputCls}>
                  <option value="">Select tool group…</option>
                  {toolGroups.map(g => (
                    <option key={g.ToolGroupID} value={g.ToolGroupID}>
                      {g.ToolGroupName} (Prefix: {g.Prefix})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Prefix (auto from group)">
                <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm font-mono text-purple-700">
                  {toolGroups.find(g => g.ToolGroupID === (cylRows[0]?.toolGroupID ?? ""))?.Prefix ?? "—"}
                </div>
              </Field>
              <Field label="Vendor (shared)">
                <select value={cylRows[0]?.vendorLedgerID ?? ""}
                  onChange={e => {
                    const v = vendors.find(x => x.LedgerID === e.target.value);
                    setCylRows(p => p.map(r => ({ ...r, vendorLedgerID: e.target.value, vendorName: v?.LedgerName ?? "" })));
                  }}
                  className={inputCls}>
                  <option value="">Select vendor…</option>
                  {vendors.map(v => <option key={v.LedgerID} value={v.LedgerID}>{v.LedgerName}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Cylinder rows */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                {cylRows.length} Cylinder Rows
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyFirstToAll("circumference")}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                  Copy Circ to All
                </button>
                <button
                  onClick={() => copyFirstToAll("repeatUPS")}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                  Copy UPS to All
                </button>
                <button
                  onClick={() => setCylRows(p => [...p, {
                    tmpId: uid(), colorSeq: p.length + 1, colorName: "", cylinderName: "",
                    cylinderCode: "", circumference: product?.GrvPlanCylCirc ?? 0,
                    printWidth: product?.GrvPlanCylWidth ?? 0, cylLength: product?.GrvPlanCylWidth ?? 0,
                    repeatUPS: product?.GrvPlanRepeatUPS ?? 1, cylType: "New",
                    vendorLedgerID: cylRows[0]?.vendorLedgerID ?? "",
                    vendorName: cylRows[0]?.vendorName ?? "",
                    hsnID: "", purchaseRate: 0, remarks: "",
                    totalColors: cylRows.length + 1, toolGroupID: cylRows[0]?.toolGroupID ?? "",
                  }])}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors">
                  <Plus size={12} /> Add Row
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {cylRows.map((row, ri) => (
                <div key={row.tmpId} className="p-5 space-y-4">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {ri + 1}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{row.colorName || `Color ${ri + 1}`}</span>
                    {row.ToolCode && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-mono font-bold">
                        ✓ {row.ToolCode}
                      </span>
                    )}
                    <button onClick={() => setCylRows(p => p.filter(x => x.tmpId !== row.tmpId))}
                      className="ml-auto p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Field label="Color Name" required>
                      <input value={row.colorName} onChange={e => updateRow(row.tmpId, "colorName", e.target.value)}
                        placeholder="e.g. Red, Cyan" className={inputCls} />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Cylinder Name">
                        <input value={row.cylinderName} onChange={e => updateRow(row.tmpId, "cylinderName", e.target.value)}
                          placeholder="e.g. GRV000001 - Red" className={inputCls} />
                      </Field>
                    </div>
                    <Field label="Cyl Code (Ref)" required>
                      <input value={row.cylinderCode} onChange={e => updateRow(row.tmpId, "cylinderCode", e.target.value)}
                        placeholder="e.g. CUC-001" className={inputCls} />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <Field label="Circumference (mm)">
                      <Num value={row.circumference} onChange={v => updateRow(row.tmpId, "circumference", v)} />
                    </Field>
                    <Field label="Print Width (mm)">
                      <Num value={row.printWidth} onChange={v => updateRow(row.tmpId, "printWidth", v)} />
                    </Field>
                    <Field label="Cyl Length (mm)">
                      <Num value={row.cylLength} onChange={v => updateRow(row.tmpId, "cylLength", v)} />
                    </Field>
                    <Field label="Repeat UPS">
                      <Num value={row.repeatUPS} onChange={v => updateRow(row.tmpId, "repeatUPS", v)} step="1" />
                    </Field>
                    <Field label="Type">
                      <select value={row.cylType} onChange={e => updateRow(row.tmpId, "cylType", e.target.value)} className={inputCls}>
                        <option value="New">New</option>
                        <option value="Existing">Existing</option>
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Field label="HSN Code">
                      <select value={row.hsnID} onChange={e => updateRow(row.tmpId, "hsnID", e.target.value)} className={inputCls}>
                        <option value="">Select HSN…</option>
                        {hsnList.map(h => (
                          <option key={h.ProductHSNID} value={h.ProductHSNID}>
                            {h.HSNCode} — {h.HSNDescription}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Purchase Rate (₹)">
                      <Num value={row.purchaseRate} onChange={v => updateRow(row.tmpId, "purchaseRate", v)} step="1" />
                    </Field>
                    <Field label="Total Colors">
                      <Num value={row.totalColors} onChange={v => updateRow(row.tmpId, "totalColors", v)} step="1" />
                    </Field>
                    <Field label="Remarks">
                      <input value={row.remarks} onChange={e => updateRow(row.tmpId, "remarks", e.target.value)}
                        placeholder="Notes…" className={inputCls} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom save bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {cylRows.length} cylinders will be saved to <span className="font-semibold text-blue-700">ToolMaster</span>.
              The allocation rows in the catalog will be updated automatically.
            </p>
            <button onClick={handleSave} disabled={saving || loading}
              className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save All {cylRows.length} Cylinders
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page wrapper (Suspense required for useSearchParams) ─────

export default function CreateCylindersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24 gap-2 text-gray-400">
        <Loader2 size={20} className="animate-spin" /> Loading…
      </div>
    }>
      <CreateCylindersInner />
    </Suspense>
  );
}
