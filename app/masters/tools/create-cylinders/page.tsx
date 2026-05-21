"use client";
import { useState, useEffect } from "react";
import {
  Check, ChevronLeft, Save, AlertCircle, CheckCircle2,
  RefreshCw, Wrench,
} from "lucide-react";
import { useMasters } from "@/context/MastersContext";
import { apiPost, apiGet } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────
type ColorTab = {
  colorNo:         number;
  colorName:       string;
  cylinderCode:    string;
  cylinderName:    string;
  vendor:          string;
  vendorLedgerID:  string;
  hsnCode:         string;
  hsnId:           string;
  hsnDesc:         string;
  purchaseRate:    string;
  purchaseUnitId:  string;
  purchaseUnit:    string;
  numOfRepeat:     string;
  estLife:         string;
  remarks:         string;
  status:          "Pending" | "Ordered" | "Available";
};

type PrefillData = {
  productMasterId?: string;
  productCode:    string;
  productName:    string;
  customerName:   string;
  noOfColors:     number;
  circumference:  string;
  printWidth:     string;
  repeatUPS:      number;
  colors:         string[];
  colorNos?:      number[];
  // plan details
  totalUPS?:      number;
  filmSize?:      string;
  totalWaste?:    string;
  sleeveCode?:    string;
  sleeveWidth?:   string;
  acUps?:         number;
  printingWidth?: string;
  isSpecial?:     boolean;
  categoryName?:  string;
  jobWidth?:      string;
  jobHeight?:     string;
};


// ── Styles ───────────────────────────────────────────────────────────────────
const inp  = "w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-purple-400 outline-none focus:ring-2 focus:ring-purple-200 transition-all text-gray-800";
const inpE = "w-full px-3 py-2 border border-red-300 rounded-xl text-sm bg-red-50 focus:bg-white focus:border-red-400 outline-none focus:ring-2 focus:ring-red-200 transition-all text-gray-800";
const readBox = "px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700";

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
    {children}{required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

const SH = ({ label, sub }: { label: string; sub?: string }) => (
  <p className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-1.5 border-b border-gray-100 text-purple-700 flex items-center gap-2">
    {label}
    {sub && <span className="normal-case font-normal text-gray-400">{sub}</span>}
  </p>
);

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CreateCylindersPage() {
  const { vendorLedgers } = useMasters();
  const VENDOR_LEDGERS = vendorLedgers.filter(v =>
    v.LedgerGroupName?.toLowerCase().includes("sundry creditor") ||
    v.LedgerGroupName?.toLowerCase().includes("vendor") ||
    v.LedgerGroupName?.toLowerCase().includes("supplier")
  );

  const [prefill, setPrefill]         = useState<PrefillData | null>(null);
  const [tabs, setTabs]               = useState<ColorTab[]>([]);
  const [activeTab, setActiveTab]     = useState(0);
  const [saved, setSaved]             = useState(false);
  const [saving, setSaving]           = useState(false);
  const [submitAttempted, setSubmit]  = useState(false);
  const [errors, setErrors]           = useState<Record<number, string[]>>({});
  const [hsnList,  setHsnList]  = useState<{ id: string; hsnCode: string; description: string; gstRate: number }[]>([]);
  const [unitList, setUnitList] = useState<{ id: string; symbol: string; name: string }[]>([]);

  useEffect(() => {
    apiGet<any[]>("api/productcataloggravureShrink/gethsnlist").then(rows => {
      const arr = Array.isArray(rows) ? rows : [];
      setHsnList(arr.map((h: any) => ({
        id:          String(h.ProductHSNID ?? ""),
        hsnCode:     String(h.HSNCode ?? ""),
        description: h.DisplayName || h.ProductHSNName || "",
        gstRate:     Number(h.GSTTaxPercentage ?? 0),
      })));
    }).catch(() => {});

    apiGet<any[]>("api/unitmasterShrink/getunit").then(rows => {
      const arr = Array.isArray(rows) ? rows : [];
      setUnitList(arr.map((u: any) => ({
        id:     String(u.UnitID ?? ""),
        symbol: String(u.UnitSymbol ?? ""),
        name:   String(u.UnitName ?? ""),
      })));
    }).catch(() => {});
  }, []);

  // ── Read localStorage on mount + fetch next unique cylinder code ─────────
  useEffect(() => {
    const raw = localStorage.getItem("ajsw_cylinder_prefill");
    if (!raw) return;
    let parsedData: PrefillData | null = null;
    try { parsedData = JSON.parse(raw); } catch { return; }
    if (!parsedData) return;
    setPrefill(parsedData);

    // Fetch the next unique CUC-NNN code from ToolMaster before building rows
    apiGet<any>("api/productcataloggravureShrink/getnextcylindercode").then(resp => {
      const arr = Array.isArray(resp) ? resp : [resp];
      const nextNo: number = arr[0]?.NextNo ?? 1;

      const initial: ColorTab[] = Array.from({ length: parsedData!.noOfColors }, (_, i) => {
        const colorName = parsedData!.colors?.[i] || `Color ${i + 1}`;
        return {
          colorNo:        i + 1,
          colorName,
          cylinderCode:   `CUC-${String(nextNo + i).padStart(3, "0")}`,
          cylinderName:   `${parsedData!.productName} — ${colorName}`,
          vendor:         "",
          vendorLedgerID: "",
          hsnCode:        "",
          hsnId:          "",
          hsnDesc:        "",
          purchaseRate:    "",
          purchaseUnitId:  "",
          purchaseUnit:    "",
          numOfRepeat:    String(parsedData!.repeatUPS),
          estLife:        "25000",
          remarks:        "",
          status:         "Pending",
        };
      });
      setTabs(initial);
    }).catch(() => {
      // Fallback: use sequential codes if API fails
      const initial: ColorTab[] = Array.from({ length: parsedData!.noOfColors }, (_, i) => {
        const colorName = parsedData!.colors?.[i] || `Color ${i + 1}`;
        return {
          colorNo:        i + 1,
          colorName,
          cylinderCode:   `CUC-${String(i + 1).padStart(3, "0")}`,
          cylinderName:   `${parsedData!.productName} — ${colorName}`,
          vendor:         "",
          vendorLedgerID: "",
          hsnCode:        "",
          hsnId:          "",
          hsnDesc:        "",
          purchaseRate:    "",
          purchaseUnitId:  "",
          purchaseUnit:    "",
          numOfRepeat:    String(parsedData!.repeatUPS),
          estLife:        "25000",
          remarks:        "",
          status:         "Pending",
        };
      });
      setTabs(initial);
    });
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const updateTab = (idx: number, patch: Partial<ColorTab>) =>
    setTabs(p => p.map((t, i) => (i === idx ? { ...t, ...patch } : t)));

  // Apply vendor / HSN to ALL tabs at once
  const applyToAll = (patch: Partial<ColorTab>) =>
    setTabs(p => p.map(t => ({ ...t, ...patch })));

  const validate = (): boolean => {
    const errs: Record<number, string[]> = {};
    tabs.forEach((t, i) => {
      const e: string[] = [];
      if (!t.cylinderName.trim()) e.push("Cylinder Name required");
      if (!t.vendor.trim())       e.push("Vendor/Engraver required");
      if (!t.hsnCode.trim())      e.push("HSN Code required");
      if (!t.purchaseRate.trim() || isNaN(Number(t.purchaseRate)))
        e.push("Valid Purchase Rate required");
      if (!t.purchaseUnitId) e.push("Purchase Unit required");
      if (e.length) errs[i] = e;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveAll = async () => {
    setSubmit(true);
    if (!validate() || !prefill) return;
    setSaving(true);
    try {
      const circ   = parseFloat(prefill.circumference) || 0;
      const printW = parseFloat(prefill.printWidth) || 0;

      const payload = {
        ProductMasterID:         prefill.productMasterId || "",
        ProductMasterCode:       prefill.productCode || "",
        ProductMasterContentsID: "",
        ToolGroupID:             "",
        Prefix:                  "CYL",
        CylinderType:            "New",
        Circumference:           circ,
        CylinderLength:          printW,
        PrintWidth:              printW,
        RepeatUPS:               prefill.repeatUPS,
        TotalNoOfColors:         tabs.length,
        CylinderPrintingArea:    0,
        TotalNonPrintingArea:    0,
        EstimatedLifeMeters:     parseFloat(tabs[0]?.estLife || "25000") || 25000,
        PlanCylCode:             "",
        Cylinders: tabs.map((t, i) => ({
          colorSequenceNo: prefill.colorNos?.[i] ?? (i + 1),
          colorName:       t.colorName,
          cylinderCode:    t.cylinderCode,
          cylinderName:    t.cylinderName,
          vendorLedgerID:  t.vendorLedgerID || "",
          vendorName:      t.vendor || "",
          hsnID:           t.hsnId || "0",
          purchaseRate:    parseFloat(t.purchaseRate) || 0,
          purchaseUnitId:  t.purchaseUnitId || "",
          purchaseUnit:    t.purchaseUnit || "",
          remarks:         t.remarks || "",
        })),
      };

      const resp = await apiPost<any>("api/productcataloggravureShrink/saveallcylinders", payload);
      const r = Array.isArray(resp) ? resp[0] : resp;

      if (r?.Status === "success") {
        const savedTools: { ToolID: string; ToolCode: string; ColorSeq: number }[] = r.SavedTools ?? [];
        const results = savedTools.map(st => ({
          colorNo:      st.ColorSeq,
          CylinderID:   String(st.ToolID),
          CylinderCode: st.ToolCode,
        }));
        localStorage.setItem("ajsw_cylinders_created_api", JSON.stringify(results));
        setSaved(true);
      } else {
        const errDetail = r?.Message || (typeof r === "string" ? r.slice(0, 300) : JSON.stringify(r));
        alert("Save failed: " + (errDetail || "No error detail — check browser Network tab"));
      }
    } catch (e: any) {
      alert("Error saving cylinders: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  const readyCnt = tabs.filter(
    t => t.vendor && t.hsnCode && t.purchaseRate && t.purchaseUnitId,
  ).length;

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!prefill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertCircle size={44} className="text-amber-400" />
        <p className="text-base font-bold text-gray-700">No cylinder data found</p>
        <p className="text-sm text-gray-400 max-w-xs">
          Use the <strong>"Create Cylinder in Master"</strong> button inside the
          Product Catalog → Replan → Production Prep → Cylinder Master tab.
        </p>
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition">
          <ChevronLeft size={14} /> Close Tab
        </button>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
        <CheckCircle2 size={56} className="text-green-500" />
        <div>
          <p className="text-2xl font-black text-green-700">
            {tabs.length} Cylinder{tabs.length > 1 ? "s" : ""} Saved!
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {prefill.productName} &nbsp;·&nbsp; {prefill.productCode}
          </p>
        </div>
        {/* Summary */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm max-w-2xl w-full text-left">
          <table className="min-w-full text-xs">
            <thead className="bg-green-700 text-white">
              <tr>
                {["#", "Color", "Cylinder Code", "Vendor", "HSN", "Rate", "Unit", "Status"].map(h => (
                  <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {tabs.map((t, i) => (
                <tr key={i} className="hover:bg-green-50/40">
                  <td className="px-3 py-2 font-bold text-green-700">{t.colorNo}</td>
                  <td className="px-3 py-2 font-semibold">{t.colorName}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{t.cylinderCode}</td>
                  <td className="px-3 py-2 text-gray-600 truncate max-w-[140px]">{t.vendor}</td>
                  <td className="px-3 py-2 font-mono">{t.hsnCode}</td>
                  <td className="px-3 py-2 font-mono">₹{t.purchaseRate}</td>
                  <td className="px-3 py-2 font-mono">{t.purchaseUnit || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      t.status === "Available" ? "bg-green-50 text-green-700 border-green-200"
                      : t.status === "Ordered" ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { localStorage.removeItem("ajsw_cylinder_prefill"); window.close(); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition">
            ← Close & Return to Catalog
          </button>
          <button
            onClick={() => setSaved(false)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition">
            <RefreshCw size={13} /> Edit Again
          </button>
        </div>
      </div>
    );
  }

  const tab = tabs[activeTab];

  // ── Main form ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => window.close()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
          <ChevronLeft size={14} /> Back to Catalog
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-purple-600" />
            <h2 className="text-base font-bold text-gray-800">Create Cylinders in Master</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {prefill.productName} &nbsp;·&nbsp; {prefill.productCode} &nbsp;·&nbsp; {prefill.customerName}
          </p>
        </div>
      </div>

      {/* ── Shared Specs Banner ── */}
      <div className="space-y-2">
        {/* Product / Customer info row */}
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs">
          {[
            { l: "Customer",      v: prefill.customerName },
            { l: "Category",      v: prefill.categoryName || "—" },
            { l: "No. of Colours",v: String(prefill.noOfColors) },
            { l: "Job Width",     v: prefill.jobWidth ? `${prefill.jobWidth} mm` : "—" },
            { l: "Job Height (Repeat)", v: prefill.jobHeight ? `${prefill.jobHeight} mm` : "—" },
          ].filter(s => s.v && s.v !== "—").map(s => (
            <div key={s.l} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5">
              <span className="text-[9px] text-gray-400 font-bold uppercase block">{s.l}</span>
              <span className="font-bold text-gray-800">{s.v}</span>
            </div>
          ))}
        </div>

        {/* Cylinder / Plan specs row */}
        <div className="flex flex-wrap gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs">
          {[
            { l: "Circumference",   v: prefill.circumference ? `${prefill.circumference} mm` : "—" },
            { l: "Cylinder Width",  v: prefill.printWidth    ? `${prefill.printWidth} mm`    : "—" },
            { l: "Repeat UPS",      v: `${prefill.repeatUPS}×` },
            prefill.totalUPS   ? { l: "Total UPS",    v: String(prefill.totalUPS) }   : null,
            prefill.acUps      ? { l: "Across UPS",   v: String(prefill.acUps) }      : null,
            prefill.filmSize   ? { l: "Film Size",    v: `${prefill.filmSize} mm` }   : null,
            prefill.totalWaste ? { l: "Total Waste",  v: `${prefill.totalWaste} mm` } : null,
            prefill.sleeveCode ? { l: "Sleeve Code",  v: prefill.sleeveCode }         : null,
            prefill.sleeveWidth? { l: "Sleeve Width", v: `${prefill.sleeveWidth} mm` }: null,
          ].filter(Boolean).map(s => s && (
            <div key={s.l} className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5">
              <span className="text-[9px] text-indigo-400 font-bold uppercase block">{s.l}</span>
              <span className="font-bold text-indigo-800">{s.v}</span>
            </div>
          ))}
          {prefill.isSpecial && (
            <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1.5 rounded-lg text-[10px] font-bold">
              ★ Special Order Cylinder
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5 bg-indigo-100 text-indigo-700 border border-indigo-300 px-3 py-1.5 rounded-lg text-[10px] font-semibold">
            ⓘ All cylinders share the same dimensions
          </div>
        </div>
      </div>

      {/* ── Apply to All row ── */}
      <div className="flex flex-wrap items-end gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
        <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest self-center">
          Apply to all colors at once:
        </span>
        {/* Vendor */}
        <div className="flex-1 min-w-[180px]">
          <Label>Vendor / Engraver</Label>
          <select className={inp} defaultValue=""
            onChange={e => {
              const v = VENDOR_LEDGERS.find(l => l.LedgerID === e.target.value);
              if (v) applyToAll({ vendor: v.LedgerName, vendorLedgerID: v.LedgerID });
            }}>
            <option value="">-- Select to apply all --</option>
            {VENDOR_LEDGERS.map(l => (
              <option key={l.LedgerID} value={l.LedgerID}>{l.LedgerName}</option>
            ))}
          </select>
        </div>
        {/* HSN */}
        <div className="flex-1 min-w-[220px]">
          <Label>HSN Code</Label>
          <select className={inp} defaultValue=""
            onChange={e => {
              if (!e.target.value) return;
              const h = hsnList.find(x => x.hsnCode === e.target.value);
              applyToAll({ hsnCode: e.target.value, hsnId: String(h?.id ?? "0"), hsnDesc: h?.description || "" });
            }}>
            <option value="">-- Select to apply all --</option>
            {hsnList.map(h => (
              <option key={h.id} value={h.hsnCode}>{h.hsnCode} — {h.description}</option>
            ))}
          </select>
        </div>
        {/* Rate */}
        <div className="w-36">
          <Label>Purchase Rate (₹)</Label>
          <input type="number" min={0} step={0.01} className={inp}
            placeholder="e.g. 3500"
            onBlur={e => {
              if (e.target.value) applyToAll({ purchaseRate: e.target.value });
            }} />
        </div>
        {/* Unit */}
        <div className="w-36">
          <Label>Purchase Unit</Label>
          <select className={inp} defaultValue=""
            onChange={e => {
              const u = unitList.find(x => x.id === e.target.value);
              if (u) applyToAll({ purchaseUnitId: u.id, purchaseUnit: u.symbol });
            }}>
            <option value="">-- Unit --</option>
            {unitList.map(u => (
              <option key={u.id} value={u.id}>{u.symbol} — {u.name}</option>
            ))}
          </select>
        </div>
        <div className="text-[10px] text-teal-600 font-medium self-center">
          ↑ Fill once, applies to every color tab
        </div>
      </div>

      {/* ── Per-Color Tabs ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Tab headers */}
        <div className="flex overflow-x-auto bg-gray-50 border-b border-gray-200">
          {tabs.map((t, i) => {
            const hasErr = submitAttempted && (errors[i]?.length ?? 0) > 0;
            const complete = !!(t.vendor && t.hsnCode && t.purchaseRate);
            return (
              <button key={i} onClick={() => setActiveTab(i)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold whitespace-nowrap border-r border-gray-200 transition-all ${
                  activeTab === i
                    ? "bg-white text-purple-700 shadow-[inset_0_-2px_0_0_#7c3aed]"
                    : hasErr
                    ? "text-red-600 bg-red-50 hover:bg-red-100"
                    : "text-gray-500 hover:bg-white hover:text-gray-800"
                }`}>
                {hasErr
                  ? <AlertCircle size={10} className="text-red-500" />
                  : complete
                  ? <Check size={10} className="text-green-500" />
                  : null}
                {t.colorName} <span className="opacity-50">#{t.colorNo}</span>
              </button>
            );
          })}
        </div>

        {/* Tab body */}
        {tab && (
          <div className="p-5 space-y-5">

            {/* Error banner */}
            {submitAttempted && (errors[activeTab]?.length ?? 0) > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
                <AlertCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-red-700">
                  <p className="font-bold">Please fill required fields:</p>
                  <ul className="list-disc list-inside mt-0.5">
                    {errors[activeTab].map(e => <li key={e}>{e}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* ── Section A: Identity ── */}
            <div>
              <SH label="Identity & Base Details" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Cylinder Code</Label>
                  <input className={inp} value={tab.cylinderCode}
                    onChange={e => updateTab(activeTab, { cylinderCode: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label required>Cylinder Name</Label>
                  <input
                    className={submitAttempted && !tab.cylinderName.trim() ? inpE : inp}
                    value={tab.cylinderName}
                    onChange={e => updateTab(activeTab, { cylinderName: e.target.value })} />
                </div>
                <div>
                  <Label>Color</Label>
                  <div className={readBox}>{tab.colorName}</div>
                </div>
                <div>
                  <Label>Cylinder Type</Label>
                  <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-700">
                    Printing Cylinder
                  </div>
                </div>
                <div>
                  <Label>Product Code</Label>
                  <div className={`${readBox} font-mono`}>{prefill.productCode}</div>
                </div>
                <div>
                  <Label>Total No. of Colours</Label>
                  <div className={readBox}>{prefill.noOfColors}</div>
                </div>
              </div>
            </div>

            {/* ── Section B: Dimensions ── */}
            <div>
              <SH label="Dimensions & Specs" sub="(shared across all colors — auto filled)" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { l: "Cylinder Circumference (MM)", v: prefill.circumference },
                  { l: "Cylinder Length (MM)",        v: "1100" },
                  { l: "Print Width (MM)",             v: prefill.printWidth },
                  { l: "Repeat UPS",                  v: String(prefill.repeatUPS) },
                ].map(f => (
                  <div key={f.l}>
                    <Label>{f.l}</Label>
                    <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-700 font-mono">{f.v}</div>
                  </div>
                ))}
                <div>
                  <Label>Number of Repeat</Label>
                  <input type="number" min={1} className={inp}
                    value={tab.numOfRepeat}
                    onChange={e => updateTab(activeTab, { numOfRepeat: e.target.value })} />
                </div>
                <div>
                  <Label>Est. Life (Mtr)</Label>
                  <input type="number" min={0} className={inp}
                    value={tab.estLife}
                    onChange={e => updateTab(activeTab, { estLife: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ── Section C: Vendor & Commercial ── */}
            <div>
              <SH label="Vendor / Engraver & Commercial" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label required>Vendor / Engraver Name</Label>
                  <select
                    className={submitAttempted && !tab.vendor ? inpE : inp}
                    value={tab.vendorLedgerID}
                    onChange={e => {
                      const v = VENDOR_LEDGERS.find(l => l.LedgerID === e.target.value);
                      if (v) updateTab(activeTab, { vendor: v.LedgerName, vendorLedgerID: v.LedgerID });
                    }}>
                    <option value="">-- Select Vendor --</option>
                    {VENDOR_LEDGERS.map(l => (
                      <option key={l.LedgerID} value={l.LedgerID}>{l.LedgerName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label required>HSN Description</Label>
                  <select
                    className={submitAttempted && !tab.hsnCode ? inpE : inp}
                    value={tab.hsnCode}
                    onChange={e => {
                      const h = hsnList.find(x => x.hsnCode === e.target.value);
                      updateTab(activeTab, { hsnCode: e.target.value, hsnId: String(h?.id ?? "0"), hsnDesc: h?.description || "" });
                    }}>
                    <option value="">-- Select HSN --</option>
                    {hsnList.map(h => (
                      <option key={h.id} value={h.hsnCode}>{h.hsnCode} — {h.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>HSN Code</Label>
                  <div className={`${readBox} font-mono`}>{tab.hsnCode || "—"}</div>
                </div>
                <div>
                  <Label required>Purchase Rate (₹)</Label>
                  <input type="number" min={0} step={0.01} placeholder="e.g. 3500"
                    className={submitAttempted && (!tab.purchaseRate || isNaN(Number(tab.purchaseRate))) ? inpE : inp}
                    value={tab.purchaseRate}
                    onChange={e => updateTab(activeTab, { purchaseRate: e.target.value })} />
                </div>
                <div>
                  <Label required>Purchase Unit</Label>
                  <select
                    className={submitAttempted && !tab.purchaseUnitId ? inpE : inp}
                    value={tab.purchaseUnitId}
                    onChange={e => {
                      const u = unitList.find(x => x.id === e.target.value);
                      if (u) updateTab(activeTab, { purchaseUnitId: u.id, purchaseUnit: u.symbol });
                    }}>
                    <option value="">-- Select Unit --</option>
                    {unitList.map(u => (
                      <option key={u.id} value={u.id}>{u.symbol} — {u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select className={inp} value={tab.status}
                    onChange={e => updateTab(activeTab, { status: e.target.value as ColorTab["status"] })}>
                    <option value="Pending">Pending</option>
                    <option value="Ordered">Ordered</option>
                    <option value="Available">Available</option>
                  </select>
                </div>
                <div>
                  <Label>Remarks</Label>
                  <input className={inp} value={tab.remarks} placeholder="Optional notes…"
                    onChange={e => updateTab(activeTab, { remarks: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ── Tab navigation ── */}
            <div className="flex justify-between pt-3 border-t border-gray-100">
              <button disabled={activeTab === 0}
                onClick={() => setActiveTab(p => p - 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-40">
                ← Previous
              </button>
              {activeTab < tabs.length - 1 ? (
                <button onClick={() => setActiveTab(p => p + 1)}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition">
                  Next Color →
                </button>
              ) : (
                <button onClick={handleSaveAll} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow transition disabled:opacity-60">
                  <Save size={14} /> {saving ? "Saving…" : `Save All ${tabs.length} Cylinders`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom sticky bar ── */}
      <div className="sticky bottom-4 flex items-center justify-between p-4 bg-white/95 backdrop-blur rounded-2xl border border-gray-200 shadow-lg">
        <div className="text-xs text-gray-500">
          <span className="font-bold text-green-700">{readyCnt}</span> of {tabs.length} colors ready &nbsp;·&nbsp;
          {tabs.length - readyCnt > 0 && (
            <span className="text-amber-600">
              {tabs.length - readyCnt} still need vendor / HSN / rate
            </span>
          )}
        </div>
        <button onClick={handleSaveAll} disabled={saving}
          className="flex items-center gap-2 px-7 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow transition disabled:opacity-60">
          <Save size={15} /> {saving ? "Saving…" : `Save All ${tabs.length} Cylinders`}
        </button>
      </div>
    </div>
  );
}
