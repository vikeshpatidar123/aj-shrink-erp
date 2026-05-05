"use client";
import { useState, useEffect, useCallback } from "react";
import {
  BookMarked, Plus, Pencil, Trash2, Eye, RefreshCw, ChevronRight,
  Layers, Palette, Cylinder, FileText, CheckCircle2, AlertCircle,
  Loader2, Save, X, ExternalLink,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { inputCls, labelCls } from "@/lib/styles";

// ─── Types ───────────────────────────────────────────────────

type CatalogRow = {
  ProductMasterID: string; ProductMasterCode: string; PCDate: string;
  ProductName: string; CustomerName: string; CategoryName: string;
  NoOfColors: number; PrintType: string; Substrate: string;
  JobWidth: number; JobHeight: number; PerMeterRate: number;
  StandardQty: number; StandardUnit: string; Remarks: string;
  SavedColorShadesJSON: string; SavedCylAllocsJSON: string;
  GrvPlanFilmWidth: number; GrvPlanCylCode: string; GrvPlanRepeatUPS: number;
};

type ColorShade = {
  id: string; itemId: string; itemName: string;
  ColorName: string; ColorType: string; inkType: string;
  labL: number; labA: number; labB: number;
  pantoneRef: string; remarks: string;
};

type CylAlloc = {
  id: string; colorName: string; cylinderCode: string;
  cylinderWidth: number; circumference: number; repeatUPS: number;
  cylinderType: string; cylinderStatus: string; cylinderMasterID: string;
  remarks: string; MasterCylinderCode?: string; MasterStatus?: string;
};

type Layer = {
  tmpId: string; layerNo: number; ItemID: string; ItemName: string; PlyType: string;
  FilmGSM: number; FilmRate: number;
  Consumables: Consumable[];
};

type Consumable = {
  tmpId: string; consumableType: string;
  itemId: string; itemGroupId: string; itemGroupName: string;
  itemSubGroupId: string; itemSubGroupName: string; itemName: string;
  dryGSM: number; solidPercentage: number; liquidGSM: number; ratioPct: number;
};

type FormState = {
  ProductName: string; StructureType: string; CustomerID: string; CustomerName: string;
  CategoryID: string; CategoryName: string; Content: string;
  JobWidth: number; JobHeight: number; ActualWidth: number; ActualHeight: number;
  NoOfColors: number; FrontColors: number; BackColors: number;
  PrintType: string; Substrate: string; MachineID: string; MachineName: string;
  CylinderCostPerColor: number; OverheadPct: number; ProfitPct: number;
  PerMeterRate: number; StandardQty: number; StandardUnit: string; Remarks: string;
  UnwindDirection: number; FinalRollOD: number; RollQtyUnit: string;
  PackSize: string; BrandName: string; ArtworkName: string;
  PlanFilmWidth: number; PlanTotalWaste: number; PlanCylCode: string;
  PlanCylName: string; PlanCylCirc: number; PlanRepeatUPS: number;
  PlanTotalPieces: number;
};

const blankForm: FormState = {
  ProductName: "", StructureType: "Sleeve", CustomerID: "", CustomerName: "",
  CategoryID: "", CategoryName: "", Content: "",
  JobWidth: 0, JobHeight: 0, ActualWidth: 0, ActualHeight: 0,
  NoOfColors: 0, FrontColors: 0, BackColors: 0,
  PrintType: "Reverse Print", Substrate: "OPS", MachineID: "", MachineName: "",
  CylinderCostPerColor: 3500, OverheadPct: 12, ProfitPct: 15,
  PerMeterRate: 0, StandardQty: 0, StandardUnit: "Meter", Remarks: "",
  UnwindDirection: 1, FinalRollOD: 0, RollQtyUnit: "Meter",
  PackSize: "", BrandName: "", ArtworkName: "",
  PlanFilmWidth: 0, PlanTotalWaste: 0, PlanCylCode: "",
  PlanCylName: "", PlanCylCirc: 0, PlanRepeatUPS: 0, PlanTotalPieces: 0,
};

// ─── Helpers ─────────────────────────────────────────────────

let _tmpId = 0;
const uid = () => String(++_tmpId);

const API = "api/productcataloggravureShrink";

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className={labelCls}>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {children}
  </div>
);

const Num = ({
  value, onChange, placeholder, step = "0.01", min = "0",
}: { value: number; onChange: (n: number) => void; placeholder?: string; step?: string; min?: string }) => (
  <input
    type="number" value={value || ""} step={step} min={min}
    onChange={e => onChange(parseFloat(e.target.value) || 0)}
    placeholder={placeholder}
    className={inputCls}
  />
);

const Sel = ({ value, onChange, options, placeholder = "Select…" }: {
  value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; placeholder?: string;
}) => (
  <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

// Tab button
const Tab = ({ label, icon: Icon, active, onClick, count }: {
  label: string; icon: React.ComponentType<{ size?: number }>; active: boolean; onClick: () => void; count?: number;
}) => (
  <button onClick={onClick}
    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap
      ${active ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>
    <Icon size={13} />
    {label}
    {count !== undefined && (
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
        ${active ? "bg-purple-100 text-purple-700" : "bg-gray-200 text-gray-600"}`}>{count}</span>
    )}
  </button>
);

// ─── Main Page ────────────────────────────────────────────────

export default function GravureProductCatalogPage() {
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [editingID, setEditingID] = useState<string | null>(null); // null = new
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"basic" | "ply" | "plan" | "shades" | "cyl">("basic");

  // Form fields
  const [form, setForm] = useState<FormState>(blankForm);
  const f = (k: keyof FormState, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  // Dropdown options
  const [customers, setCustomers] = useState<{ v: string; l: string }[]>([]);
  const [categories, setCategories] = useState<{ v: string; l: string }[]>([]);
  const [machines, setMachines] = useState<{ v: string; l: string; code: string }[]>([]);
  const [filmItems, setFilmItems] = useState<{ v: string; l: string }[]>([]);
  const [inkItems, setInkItems] = useState<{ v: string; l: string }[]>([]);

  // PLY layers
  const [layers, setLayers] = useState<Layer[]>([]);

  // Color shades
  const [shades, setShades] = useState<ColorShade[]>([]);
  const [shadesLoading, setShadesLoading] = useState(false);

  // Cylinder allocation
  const [cylAllocs, setCylAllocs] = useState<CylAlloc[]>([]);
  const [cylLoading, setCylLoading] = useState(false);

  // Delete
  const [deleteID, setDeleteID] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // View modal
  const [viewRow, setViewRow] = useState<CatalogRow | null>(null);

  // ── Fetch catalog list ──────────────────────────────────────

  const fetchCatalog = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await apiGet<CatalogRow[]>(`${API}/getcataloglist`);
      setCatalog(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  // ── Load dropdowns ──────────────────────────────────────────

  useEffect(() => {
    apiGet<{ LedgerID: string; LedgerName: string }[]>(`${API}/getcustomerlist`)
      .then(r => setCustomers((r ?? []).map(x => ({ v: x.LedgerID, l: x.LedgerName }))));
    apiGet<{ CategoryID: string; CategoryName: string }[]>(`${API}/getcategorylist`)
      .then(r => setCategories((r ?? []).map(x => ({ v: x.CategoryID, l: x.CategoryName }))));
    apiGet<{ MachineID: string; MachineName: string; MachineCode: string }[]>(`${API}/getmachinelist`)
      .then(r => setMachines((r ?? []).map(x => ({ v: x.MachineID, l: x.MachineName, code: x.MachineCode }))));
    apiGet<{ ItemID: string; ItemName: string }[]>(`${API}/getfilmitemlist`)
      .then(r => setFilmItems((r ?? []).map(x => ({ v: x.ItemID, l: x.ItemName }))));
    apiGet<{ ItemID: string; ItemName: string }[]>(`${API}/getinkinventory`)
      .then(r => setInkItems((r ?? []).map(x => ({ v: x.ItemID, l: x.ItemName }))));
  }, []);

  // ── Open create ─────────────────────────────────────────────

  const openCreate = () => {
    setEditingID(null);
    setForm(blankForm);
    setLayers([]);
    setShades([]);
    setCylAllocs([]);
    setActiveTab("basic");
    setSaveMsg("");
    setModalOpen(true);
  };

  // ── Open edit ───────────────────────────────────────────────

  const openEdit = async (row: CatalogRow) => {
    setEditingID(row.ProductMasterID);
    setForm(blankForm);
    setLayers([]);
    setShades([]);
    setCylAllocs([]);
    setActiveTab("basic");
    setSaveMsg("");
    setModalOpen(true);

    // Fetch full detail
    type Detail = Record<string, string | number>;
    try {
      const details = await apiGet<Detail[]>(`${API}/getcatalogbyid/${row.ProductMasterID}`);
      const d = Array.isArray(details) && details.length > 0 ? details[0] : ({} as Detail);
      const n = (k: string) => Number(d[k] ?? 0);
      const s = (k: string) => String(d[k] ?? "");
      setForm({
        ProductName:           s("JobName"),
        StructureType:         s("GrvStructureType") || "Sleeve",
        CustomerID:            s("LedgerID"),
        CustomerName:          s("CustomerName"),
        CategoryID:            s("CategoryID"),
        CategoryName:          s("CategoryName"),
        Content:               s("Content") || s("GrvContent"),
        JobWidth:              n("GrvJobWidth"),
        JobHeight:             n("GrvJobHeight"),
        ActualWidth:           n("GrvActualWidth"),
        ActualHeight:          n("GrvActualHeight"),
        NoOfColors:            n("GrvNoOfColors"),
        FrontColors:           n("GrvFrontColors"),
        BackColors:            n("GrvBackColors"),
        PrintType:             s("GrvPrintType") || "Reverse Print",
        Substrate:             s("GrvSubstrate"),
        MachineID:             s("GrvMachineID"),
        MachineName:           s("GrvMachineName"),
        CylinderCostPerColor:  n("GrvCylinderCostPerColor") || 3500,
        OverheadPct:           n("GrvOverheadPct") || 12,
        ProfitPct:             n("GrvProfitPct") || 15,
        PerMeterRate:          n("GrvPerMeterRate"),
        StandardQty:           n("StandardQty"),
        StandardUnit:          s("EstimationUnit") || "Meter",
        Remarks:               s("Remark"),
        UnwindDirection:       n("GrvUnwindDirection") || 1,
        FinalRollOD:           n("GrvFinalRollOD"),
        RollQtyUnit:           s("GrvRollQtyUnit") || "Meter",
        PackSize:              s("GrvPackSize"),
        BrandName:             s("GrvBrandName"),
        ArtworkName:           s("GrvArtworkName"),
        PlanFilmWidth:         n("GrvPlanFilmWidth"),
        PlanTotalWaste:        n("GrvPlanTotalWaste"),
        PlanCylCode:           s("GrvPlanCylCode"),
        PlanCylName:           s("GrvPlanCylName"),
        PlanCylCirc:           n("GrvPlanCylCirc"),
        PlanRepeatUPS:         n("GrvPlanRepeatUPS"),
        PlanTotalPieces:       n("GrvPlanTotalPieces"),
      });

      // Load layers via contentsID
      const contentsID = s("ProductMasterContentsID");
      if (contentsID) {
        type LayerRow = { ProductMasterContentsLayerDetailID: string; LayerNo: number; PlyType: string; ItemID: string; ItemName: string; FilmGSM: number; FilmRate: number };
        type ConsRow = { ConsumableType: string; ItemGroupID: string; ItemGroupName: string; ItemSubGroupID: string; ItemSubGroupName: string; ItemID: string; ItemName: string; DryGSM: number; SolidPercentage: number; LiquidGSM: number; RatioPct: number };
        try {
          const lrs = await apiGet<LayerRow[]>(`${API}/getlayersbycontentid/${contentsID}`);
          if (Array.isArray(lrs) && lrs.length > 0) {
            const builtLayers: Layer[] = await Promise.all(lrs.map(async lr => {
              let cons: Consumable[] = [];
              try {
                const crs = await apiGet<ConsRow[]>(`${API}/getconsumablesbylayer/${lr.ProductMasterContentsLayerDetailID}`);
                cons = (Array.isArray(crs) ? crs : []).map(c => ({
                  tmpId: uid(), consumableType: c.ConsumableType,
                  itemId: String(c.ItemID ?? ""), itemGroupId: String(c.ItemGroupID ?? ""), itemGroupName: c.ItemGroupName ?? "",
                  itemSubGroupId: String(c.ItemSubGroupID ?? ""), itemSubGroupName: c.ItemSubGroupName ?? "",
                  itemName: c.ItemName ?? "",
                  dryGSM: Number(c.DryGSM ?? 0), solidPercentage: Number(c.SolidPercentage ?? 0),
                  liquidGSM: Number(c.LiquidGSM ?? 0), ratioPct: Number(c.RatioPct ?? 0),
                }));
              } catch { /* no consumables */ }
              return {
                tmpId: uid(), layerNo: lr.LayerNo,
                ItemID: String(lr.ItemID ?? ""), ItemName: lr.ItemName ?? "",
                PlyType: lr.PlyType ?? "Film",
                FilmGSM: Number(lr.FilmGSM ?? 0), FilmRate: Number(lr.FilmRate ?? 0),
                Consumables: cons,
              };
            }));
            setLayers(builtLayers);
          }
        } catch { /* layers failed silently */ }
      }
    } catch { /* detail fetch failed, form stays at defaults */ }

    // Load color shades
    setShadesLoading(true);
    try {
      type ShadeRow = { ItemID: string; ItemName: string; ColorName: string; ColorType: string; InkType: string; PantoneRef: string; LabL: number; LabA: number; LabB: number; Remarks: string };
      const sd = await apiGet<ShadeRow[]>(`${API}/getcolorshadelab/${row.ProductMasterID}`);
      setShades(Array.isArray(sd) ? sd.map(sr => ({
        id: uid(),
        itemId: String(sr.ItemID ?? ""), itemName: sr.ItemName ?? "",
        ColorName: sr.ColorName ?? "", ColorType: sr.ColorType ?? "Spot",
        inkType: sr.InkType ?? "",
        labL: Number(sr.LabL ?? 0), labA: Number(sr.LabA ?? 0), labB: Number(sr.LabB ?? 0),
        pantoneRef: sr.PantoneRef ?? "", remarks: sr.Remarks ?? "",
      })) : []);
    } catch { setShades([]); } finally { setShadesLoading(false); }

    // Load cylinder allocations
    setCylLoading(true);
    try {
      const ca = await apiGet<CylAlloc[]>(`${API}/getcylinderallocation/${row.ProductMasterID}`);
      setCylAllocs(Array.isArray(ca) ? ca.map(c => ({ ...c, id: uid() })) : []);
    } catch { setCylAllocs([]); } finally { setCylLoading(false); }
  };

  // ── Save ────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.ProductName.trim()) { setSaveMsg("Product Name is required."); return; }
    setSaving(true); setSaveMsg("");
    try {
      const payload = {
        ...form,
        SecondaryLayers: layers.map((l, li) => ({
          layerNo: l.layerNo || li + 1,
          itemId: l.ItemID, plyType: l.PlyType,
          filmGSM: l.FilmGSM, filmRate: l.FilmRate,
          Consumables: l.Consumables.map(c => ({
            consumableType: c.consumableType,
            itemId: c.itemId, itemGroupId: c.itemGroupId, itemGroupName: c.itemGroupName,
            itemSubGroupId: c.itemSubGroupId, itemSubGroupName: c.itemSubGroupName,
            itemName: c.itemName,
            dryGSM: c.dryGSM, solidPercentage: c.solidPercentage, liquidGSM: c.liquidGSM, ratioPct: c.ratioPct,
          })),
        })),
        SavedColorShades: shades.map(s => ({
          itemId: s.itemId, itemName: s.itemName,
          colorName: s.ColorName, colorType: s.ColorType, inkType: s.inkType,
          labL: s.labL, labA: s.labA, labB: s.labB,
          pantoneRef: s.pantoneRef, remarks: s.remarks,
        })),
      };

      if (editingID) {
        await apiPost(`${API}/updatecatalogdata`, { ...payload, ProductMasterID: editingID });
      } else {
        await apiPost(`${API}/savecatalogdata`, payload);
      }

      setSaveMsg("Saved successfully!");
      await fetchCatalog();
      setTimeout(() => { setModalOpen(false); setSaveMsg(""); }, 1200);
    } catch (e: unknown) {
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  // ── Save color shades (Production Prep tab) ─────────────────

  const saveShades = async () => {
    if (!editingID) return;
    setSaving(true);
    try {
      await apiPost(`${API}/savecolorshadelab`, {
        ProductMasterID: editingID,
        ColorShades: shades.map(s => ({
          itemId: s.itemId, itemName: s.itemName,
          colorName: s.ColorName, colorType: s.ColorType, inkType: s.inkType,
          labL: s.labL, labA: s.labA, labB: s.labB,
          pantoneRef: s.pantoneRef, remarks: s.remarks,
        })),
      });
      setSaveMsg("Color shades saved!");
    } catch (e: unknown) {
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  // ── Save cylinder allocation ────────────────────────────────

  const saveCylAllocs = async () => {
    if (!editingID) return;
    setSaving(true);
    try {
      await apiPost(`${API}/savecylinderallocation`, {
        ProductMasterID: editingID,
        Allocations: cylAllocs.map(c => ({
          colorName: c.colorName, cylinderCode: c.cylinderCode,
          cylinderWidth: c.cylinderWidth, circumference: c.circumference,
          repeatUPS: c.repeatUPS, cylinderType: c.cylinderType,
          cylinderStatus: c.cylinderStatus, cylinderMasterID: c.cylinderMasterID,
          remarks: c.remarks,
        })),
      });
      setSaveMsg("Cylinder allocation saved!");
    } catch (e: unknown) {
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  // ── Refresh cylinder allocation from ToolMaster ─────────────

  const refreshCylFromMaster = async () => {
    if (!editingID) return;
    setCylLoading(true);
    try {
      const ca = await apiGet<CylAlloc[]>(`${API}/refreshcylinderfrommaster/${editingID}`);
      setCylAllocs(Array.isArray(ca) ? ca.map(c => ({ ...c, id: uid() })) : []);
      setSaveMsg("Refreshed from master!");
    } catch { setSaveMsg("Refresh failed"); } finally { setCylLoading(false); }
  };

  // ── Delete ──────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteID) return;
    setDeleting(true);
    try {
      await apiGet(`${API}/deletecatalogdata/${deleteID}`);
      setDeleteID(null);
      await fetchCatalog();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally { setDeleting(false); }
  };

  // ─────────────────────────────────────────────────────────────
  // LIST VIEW
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <BookMarked size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Product Catalog — Gravure</h2>
          </div>
          <p className="text-sm text-gray-500">
            {catalog.length} catalog entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchCatalog}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
            <RefreshCw size={14} />
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
            <Plus size={14} /> New Catalog Entry
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={14} />
          {error}
          <button onClick={fetchCatalog} className="ml-auto underline text-xs">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : catalog.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <BookMarked size={36} className="text-gray-300 mb-3" />
            <p className="font-semibold text-gray-600">No catalog entries yet</p>
            <p className="text-sm mt-1">Click New Catalog Entry to create the first one.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Code","Product Name","Customer","Category","Colors","Width×Height","₹/m","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {catalog.map(row => (
                <tr key={row.ProductMasterID} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-purple-700 font-semibold">{row.ProductMasterCode}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px] truncate">{row.ProductName}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{row.CustomerName || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{row.CategoryName || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-semibold">{row.NoOfColors}C</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.JobWidth}×{row.JobHeight} mm</td>
                  <td className="px-4 py-3 font-semibold text-green-700">₹{(row.PerMeterRate ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewRow(row)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="View">
                        <Eye size={13} />
                      </button>
                      <button onClick={() => openEdit(row)}
                        className="p-1.5 rounded hover:bg-purple-50 text-purple-600 transition-colors" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteID(row.ProductMasterID)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── CREATE / EDIT MODAL ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-200 my-4">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  {editingID ? "Edit Catalog Entry" : "New Catalog Entry"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Fill all tabs, then Save.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Tab strip */}
            <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 border-b border-gray-200 overflow-x-auto">
              <Tab label="Basic Info"  icon={FileText}  active={activeTab === "basic"}  onClick={() => setActiveTab("basic")} />
              <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
              <Tab label="PLY Layers"  icon={Layers}    active={activeTab === "ply"}    onClick={() => setActiveTab("ply")}   count={layers.length} />
              <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
              <Tab label="Plan Info"   icon={FileText}  active={activeTab === "plan"}   onClick={() => setActiveTab("plan")} />
              <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
              <Tab label="Color Shades & LAB" icon={Palette}  active={activeTab === "shades"} onClick={() => setActiveTab("shades")} count={shades.length} />
              <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
              <Tab label="Cylinders"   icon={Cylinder}  active={activeTab === "cyl"}    onClick={() => setActiveTab("cyl")}   count={cylAllocs.length} />
            </div>

            {/* Tab body */}
            <div className="p-6 max-h-[65vh] overflow-y-auto">

              {/* ── BASIC INFO ── */}
              {activeTab === "basic" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <Field label="Product Name" required>
                        <input value={form.ProductName} onChange={e => f("ProductName", e.target.value)}
                          placeholder="e.g. Parle-G 100g Shrink Sleeve" className={inputCls} />
                      </Field>
                    </div>
                    <Field label="Structure Type">
                      <Sel value={form.StructureType} onChange={v => f("StructureType", v)}
                        options={[
                          { v: "Label", l: "Wrap Around Label" },
                          { v: "Sleeve", l: "Shrink Sleeve" },
                          { v: "LLDPE Shrink Film", l: "LLDPE Shrink Film" },
                        ]} />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="Customer">
                      <Sel value={form.CustomerID} onChange={v => f("CustomerID", v)}
                        options={customers} placeholder="Select customer…" />
                    </Field>
                    <Field label="Category">
                      <Sel value={form.CategoryID} onChange={v => f("CategoryID", v)}
                        options={categories} placeholder="Select category…" />
                    </Field>
                    <Field label="Machine">
                      <Sel value={form.MachineID}
                        onChange={v => {
                          const m = machines.find(x => x.v === v);
                          f("MachineID", v);
                          f("MachineName", m?.l ?? "");
                        }}
                        options={machines} placeholder="Select machine…" />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Field label="Job Width (mm)"><Num value={form.JobWidth} onChange={v => f("JobWidth", v)} placeholder="e.g. 150" /></Field>
                    <Field label="Job Height (mm)"><Num value={form.JobHeight} onChange={v => f("JobHeight", v)} placeholder="e.g. 300" /></Field>
                    <Field label="Actual Width (mm)"><Num value={form.ActualWidth} onChange={v => f("ActualWidth", v)} /></Field>
                    <Field label="Actual Height (mm)"><Num value={form.ActualHeight} onChange={v => f("ActualHeight", v)} /></Field>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Field label="No. of Colors">
                      <input type="number" value={form.NoOfColors || ""} min={0} max={12}
                        onChange={e => f("NoOfColors", parseInt(e.target.value) || 0)} className={inputCls} />
                    </Field>
                    <Field label="Front Colors">
                      <input type="number" value={form.FrontColors || ""} min={0}
                        onChange={e => f("FrontColors", parseInt(e.target.value) || 0)} className={inputCls} />
                    </Field>
                    <Field label="Back Colors">
                      <input type="number" value={form.BackColors || ""} min={0}
                        onChange={e => f("BackColors", parseInt(e.target.value) || 0)} className={inputCls} />
                    </Field>
                    <Field label="Print Type">
                      <Sel value={form.PrintType} onChange={v => f("PrintType", v)}
                        options={[
                          { v: "Surface Print", l: "Surface Print" },
                          { v: "Reverse Print", l: "Reverse Print" },
                          { v: "Combination", l: "Combination" },
                        ]} />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Field label="Substrate">
                      <input value={form.Substrate} onChange={e => f("Substrate", e.target.value)}
                        placeholder="e.g. OPS, PVC, PET" className={inputCls} />
                    </Field>
                    <Field label="Brand Name">
                      <input value={form.BrandName} onChange={e => f("BrandName", e.target.value)}
                        placeholder="e.g. Parle" className={inputCls} />
                    </Field>
                    <Field label="Pack Size">
                      <input value={form.PackSize} onChange={e => f("PackSize", e.target.value)}
                        placeholder="e.g. 100g" className={inputCls} />
                    </Field>
                    <Field label="Artwork Name">
                      <input value={form.ArtworkName} onChange={e => f("ArtworkName", e.target.value)}
                        placeholder="Artwork ref" className={inputCls} />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Field label="Cyl. Cost/Color (₹)"><Num value={form.CylinderCostPerColor} onChange={v => f("CylinderCostPerColor", v)} step="1" /></Field>
                    <Field label="Overhead %"><Num value={form.OverheadPct} onChange={v => f("OverheadPct", v)} placeholder="12" /></Field>
                    <Field label="Profit %"><Num value={form.ProfitPct} onChange={v => f("ProfitPct", v)} placeholder="15" /></Field>
                    <Field label="₹/Meter Rate"><Num value={form.PerMeterRate} onChange={v => f("PerMeterRate", v)} /></Field>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field label="Standard Qty"><Num value={form.StandardQty} onChange={v => f("StandardQty", v)} step="1" /></Field>
                    <Field label="Unit">
                      <Sel value={form.StandardUnit} onChange={v => f("StandardUnit", v)}
                        options={[{ v: "Meter", l: "Meter" }, { v: "KG", l: "KG" }, { v: "Nos", l: "Nos" }]} />
                    </Field>
                    <Field label="Unwind Direction">
                      <input type="number" value={form.UnwindDirection || ""} min={1} max={8}
                        onChange={e => f("UnwindDirection", parseInt(e.target.value) || 1)} className={inputCls} />
                    </Field>
                  </div>

                  <Field label="Remarks">
                    <textarea value={form.Remarks} onChange={e => f("Remarks", e.target.value)}
                      rows={2} placeholder="Special notes…"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none" />
                  </Field>
                </div>
              )}

              {/* ── PLY LAYERS ── */}
              {activeTab === "ply" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Film PLY Layers</p>
                    <button
                      onClick={() => setLayers(p => [...p, {
                        tmpId: uid(), layerNo: p.length + 1, ItemID: "", ItemName: "", PlyType: "Film",
                        FilmGSM: 0, FilmRate: 0, Consumables: [],
                      }])}
                      className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold hover:bg-purple-100 transition-colors">
                      <Plus size={12} /> Add Layer
                    </button>
                  </div>

                  {layers.length === 0 && (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      No layers added. Click "Add Layer" to start.
                    </div>
                  )}

                  {layers.map((layer, li) => (
                    <div key={layer.tmpId} className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-600">PLY {li + 1}</span>
                        <button onClick={() => setLayers(p => p.filter(x => x.tmpId !== layer.tmpId))}
                          className="p-1 rounded hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={12} /></button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2">
                          <Field label="Film Item">
                            <Sel value={layer.ItemID}
                              onChange={v => {
                                const it = filmItems.find(x => x.v === v);
                                setLayers(p => p.map(l => l.tmpId === layer.tmpId ? { ...l, ItemID: v, ItemName: it?.l ?? "" } : l));
                              }}
                              options={filmItems} placeholder="Select film…" />
                          </Field>
                        </div>
                        <Field label="PLY Type">
                          <Sel value={layer.PlyType}
                            onChange={v => setLayers(p => p.map(l => l.tmpId === layer.tmpId ? { ...l, PlyType: v } : l))}
                            options={[
                              { v: "Film", l: "Film" }, { v: "Printing", l: "Printing" },
                              { v: "Lamination", l: "Lamination" }, { v: "Coating", l: "Coating" },
                            ]} />
                        </Field>
                        <Field label="GSM">
                          <Num value={layer.FilmGSM}
                            onChange={v => setLayers(p => p.map(l => l.tmpId === layer.tmpId ? { ...l, FilmGSM: v } : l))} />
                        </Field>
                        <Field label="Rate (₹/KG)">
                          <Num value={layer.FilmRate}
                            onChange={v => setLayers(p => p.map(l => l.tmpId === layer.tmpId ? { ...l, FilmRate: v } : l))} />
                        </Field>
                      </div>

                      {/* Consumables per layer */}
                      <div className="pl-2 border-l-2 border-purple-100 mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Consumables (Ink / Solvent)</p>
                          <button
                            onClick={() => setLayers(p => p.map(l => l.tmpId === layer.tmpId
                              ? { ...l, Consumables: [...l.Consumables, { tmpId: uid(), consumableType: "Ink", itemId: "", itemGroupId: "", itemGroupName: "Ink", itemSubGroupId: "", itemSubGroupName: "", itemName: "", dryGSM: 0, solidPercentage: 40, liquidGSM: 0, ratioPct: 0 }] }
                              : l))}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded text-[10px] font-semibold hover:bg-blue-100 transition-colors">
                            <Plus size={10} /> Add
                          </button>
                        </div>
                        {layer.Consumables.map(c => (
                          <div key={c.tmpId} className="flex items-center gap-2 text-xs">
                            <select value={c.consumableType}
                              onChange={e => setLayers(p => p.map(l => l.tmpId === layer.tmpId
                                ? { ...l, Consumables: l.Consumables.map(x => x.tmpId === c.tmpId ? { ...x, consumableType: e.target.value } : x) }
                                : l))}
                              className="px-2 py-1.5 border border-gray-300 rounded text-xs text-gray-700 outline-none focus:ring-1 focus:ring-purple-400">
                              <option value="Ink">Ink</option>
                              <option value="Solvent">Solvent</option>
                              <option value="Adhesive">Adhesive</option>
                            </select>
                            <input value={c.itemName}
                              onChange={e => setLayers(p => p.map(l => l.tmpId === layer.tmpId
                                ? { ...l, Consumables: l.Consumables.map(x => x.tmpId === c.tmpId ? { ...x, itemName: e.target.value } : x) }
                                : l))}
                              placeholder="Item name / code" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" />
                            {c.consumableType === "Solvent" ? (
                              <span className="flex items-center gap-1">
                                <input type="number" value={c.ratioPct || ""} step="0.1" min="0" max="100"
                                  onChange={e => setLayers(p => p.map(l => l.tmpId === layer.tmpId
                                    ? { ...l, Consumables: l.Consumables.map(x => x.tmpId === c.tmpId ? { ...x, ratioPct: parseFloat(e.target.value) || 0 } : x) }
                                    : l))}
                                  className="w-16 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" placeholder="%" />
                                <span className="text-gray-400 text-[10px]">Ratio%</span>
                              </span>
                            ) : (
                              <>
                                <input type="number" value={c.dryGSM || ""} step="0.01"
                                  onChange={e => setLayers(p => p.map(l => l.tmpId === layer.tmpId
                                    ? { ...l, Consumables: l.Consumables.map(x => x.tmpId === c.tmpId ? { ...x, dryGSM: parseFloat(e.target.value) || 0 } : x) }
                                    : l))}
                                  className="w-14 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" placeholder="Dry GSM" />
                                <input type="number" value={c.solidPercentage || ""} step="1" min="0" max="100"
                                  onChange={e => setLayers(p => p.map(l => l.tmpId === layer.tmpId
                                    ? { ...l, Consumables: l.Consumables.map(x => x.tmpId === c.tmpId ? { ...x, solidPercentage: parseFloat(e.target.value) || 0 } : x) }
                                    : l))}
                                  className="w-14 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" placeholder="Solid%" />
                              </>
                            )}
                            <button onClick={() => setLayers(p => p.map(l => l.tmpId === layer.tmpId
                              ? { ...l, Consumables: l.Consumables.filter(x => x.tmpId !== c.tmpId) } : l))}
                              className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── PLAN INFO ── */}
              {activeTab === "plan" && (
                <div className="space-y-5">
                  <p className="text-xs text-gray-500">Enter the selected production plan details here, or update them after running the plan engine.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field label="Film Width (mm)"><Num value={form.PlanFilmWidth} onChange={v => f("PlanFilmWidth", v)} /></Field>
                    <Field label="Total Waste (mm)"><Num value={form.PlanTotalWaste} onChange={v => f("PlanTotalWaste", v)} /></Field>
                    <Field label="Cyl Code"><input value={form.PlanCylCode} onChange={e => f("PlanCylCode", e.target.value)} className={inputCls} placeholder="e.g. CYL-P001" /></Field>
                    <Field label="Cyl Name"><input value={form.PlanCylName} onChange={e => f("PlanCylName", e.target.value)} className={inputCls} /></Field>
                    <Field label="Circumference (mm)"><Num value={form.PlanCylCirc} onChange={v => f("PlanCylCirc", v)} /></Field>
                    <Field label="Repeat UPS"><Num value={form.PlanRepeatUPS} onChange={v => f("PlanRepeatUPS", v)} step="1" /></Field>
                    <Field label="Total Pieces"><Num value={form.PlanTotalPieces} onChange={v => f("PlanTotalPieces", v)} step="1" /></Field>
                  </div>
                </div>
              )}

              {/* ── COLOR SHADES & LAB ── */}
              {activeTab === "shades" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Color Shades & CIE LAB Values</p>
                    <div className="flex items-center gap-2">
                      {editingID && (
                        <button onClick={saveShades} disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors">
                          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save Shades
                        </button>
                      )}
                      <button
                        onClick={() => setShades(p => [...p, {
                          id: uid(), itemId: "", itemName: "",
                          ColorName: "", ColorType: "Spot", inkType: "",
                          labL: 0, labA: 0, labB: 0, pantoneRef: "", remarks: "",
                        }])}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors">
                        <Plus size={12} /> Add Color
                      </button>
                    </div>
                  </div>

                  {shadesLoading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>}

                  {shades.length === 0 && !shadesLoading && (
                    <div className="text-center py-10 text-gray-400 text-sm">No color shades. Click "Add Color" to start.</div>
                  )}

                  {shades.map((s, si) => (
                    <div key={s.id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-gray-600">Color {si + 1}</span>
                        <button onClick={() => setShades(p => p.filter(x => x.id !== s.id))}
                          className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={12} /></button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Field label="Color Name">
                          <input value={s.ColorName} onChange={e => setShades(p => p.map(x => x.id === s.id ? { ...x, ColorName: e.target.value } : x))}
                            placeholder="e.g. Red, Cyan, Spot 1" className={inputCls} />
                        </Field>
                        <Field label="Color Type">
                          <select value={s.ColorType} onChange={e => setShades(p => p.map(x => x.id === s.id ? { ...x, ColorType: e.target.value } : x))}
                            className={inputCls}>
                            <option value="Spot">Spot</option>
                            <option value="Process">Process</option>
                          </select>
                        </Field>
                        <Field label="Pantone Ref">
                          <input value={s.pantoneRef} onChange={e => setShades(p => p.map(x => x.id === s.id ? { ...x, pantoneRef: e.target.value } : x))}
                            placeholder="e.g. PMS 485 C" className={inputCls} />
                        </Field>
                        <div />
                        <Field label="CIE L*">
                          <Num value={s.labL} onChange={v => setShades(p => p.map(x => x.id === s.id ? { ...x, labL: v } : x))} />
                        </Field>
                        <Field label="CIE a*">
                          <Num value={s.labA} onChange={v => setShades(p => p.map(x => x.id === s.id ? { ...x, labA: v } : x))} min="-128" />
                        </Field>
                        <Field label="CIE b*">
                          <Num value={s.labB} onChange={v => setShades(p => p.map(x => x.id === s.id ? { ...x, labB: v } : x))} min="-128" />
                        </Field>
                        <Field label="Remarks">
                          <input value={s.remarks} onChange={e => setShades(p => p.map(x => x.id === s.id ? { ...x, remarks: e.target.value } : x))}
                            placeholder="Notes…" className={inputCls} />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── CYLINDER ALLOCATION ── */}
              {activeTab === "cyl" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Cylinder Allocation per Color</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {editingID && (
                        <>
                          <button onClick={saveCylAllocs} disabled={saving}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors">
                            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save Allocation
                          </button>
                          <button onClick={refreshCylFromMaster} disabled={cylLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-xs font-semibold hover:bg-teal-100 transition-colors">
                            {cylLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Refresh from Master
                          </button>
                          <a href={`/masters/tools/create-cylinders?pmid=${editingID}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors">
                            <ExternalLink size={11} /> Create Cylinders in Master
                          </a>
                        </>
                      )}
                      <button
                        onClick={() => setCylAllocs(p => [...p, {
                          id: uid(), colorName: "", cylinderCode: "", cylinderWidth: 0,
                          circumference: 0, repeatUPS: 1, cylinderType: "New",
                          cylinderStatus: "Pending", cylinderMasterID: "", remarks: "",
                        }])}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors">
                        <Plus size={12} /> Add Row
                      </button>
                    </div>
                  </div>

                  {cylLoading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>}

                  {cylAllocs.length === 0 && !cylLoading && (
                    <div className="text-center py-10 text-gray-400 text-sm">No cylinder rows. Click "Add Row" or fill Color Shades first.</div>
                  )}

                  <div className="overflow-x-auto">
                    {cylAllocs.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-y border-gray-200">
                            {["Color Name","Cyl Code","Width (mm)","Circ (mm)","Repeat","Type","Status","Master Code",""].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {cylAllocs.map(c => (
                            <tr key={c.id}>
                              <td className="px-2 py-1.5">
                                <input value={c.colorName} onChange={e => setCylAllocs(p => p.map(x => x.id === c.id ? { ...x, colorName: e.target.value } : x))}
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input value={c.cylinderCode} onChange={e => setCylAllocs(p => p.map(x => x.id === c.id ? { ...x, cylinderCode: e.target.value } : x))}
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" placeholder="CUC-001" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" value={c.cylinderWidth || ""} onChange={e => setCylAllocs(p => p.map(x => x.id === c.id ? { ...x, cylinderWidth: parseFloat(e.target.value) || 0 } : x))}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" value={c.circumference || ""} onChange={e => setCylAllocs(p => p.map(x => x.id === c.id ? { ...x, circumference: parseFloat(e.target.value) || 0 } : x))}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" value={c.repeatUPS || ""} onChange={e => setCylAllocs(p => p.map(x => x.id === c.id ? { ...x, repeatUPS: parseInt(e.target.value) || 1 } : x))}
                                  className="w-14 px-2 py-1 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400" />
                              </td>
                              <td className="px-2 py-1.5">
                                <select value={c.cylinderType} onChange={e => setCylAllocs(p => p.map(x => x.id === c.id ? { ...x, cylinderType: e.target.value } : x))}
                                  className="px-2 py-1 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400">
                                  <option value="New">New</option>
                                  <option value="Existing">Existing</option>
                                </select>
                              </td>
                              <td className="px-2 py-1.5">
                                <span className={`px-2 py-0.5 rounded-full font-semibold ${c.cylinderStatus === "Created" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                  {c.cylinderStatus}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-purple-700 font-mono font-semibold">
                                {c.MasterCylinderCode || c.cylinderMasterID || "—"}
                              </td>
                              <td className="px-2 py-1.5">
                                <button onClick={() => setCylAllocs(p => p.filter(x => x.id !== c.id))}
                                  className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <div>
                {saveMsg && (
                  <span className={`text-xs font-semibold ${saveMsg.includes("fail") || saveMsg.includes("required") ? "text-red-600" : "text-green-600"}`}>
                    {saveMsg.includes("fail") || saveMsg.includes("required") ? <AlertCircle size={12} className="inline mr-1" /> : <CheckCircle2 size={12} className="inline mr-1" />}
                    {saveMsg}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setModalOpen(false)}
                  className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-sm disabled:opacity-60">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {editingID ? "Update" : "Save to Catalog"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW MODAL ── */}
      {viewRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">{viewRow.ProductMasterCode} — {viewRow.ProductName}</h3>
              <button onClick={() => setViewRow(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X size={15} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ["Customer", viewRow.CustomerName],
                ["Category", viewRow.CategoryName],
                ["Colors", `${viewRow.NoOfColors}C`],
                ["Print Type", viewRow.PrintType],
                ["Substrate", viewRow.Substrate],
                ["Dimensions", `${viewRow.JobWidth}×${viewRow.JobHeight} mm`],
                ["Rate", `₹${viewRow.PerMeterRate?.toFixed(2)}/m`],
                ["Std Qty", `${viewRow.StandardQty} ${viewRow.StandardUnit}`],
                ["Plan Film Width", viewRow.GrvPlanFilmWidth ? `${viewRow.GrvPlanFilmWidth} mm` : "—"],
                ["Plan Repeat UPS", viewRow.GrvPlanRepeatUPS ? String(viewRow.GrvPlanRepeatUPS) : "—"],
              ].map(([l, v]) => (
                <div key={l} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">{l}</p>
                  <p className="font-semibold text-gray-700 mt-0.5">{v || "—"}</p>
                </div>
              ))}
            </div>
            {viewRow.Remarks && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800">
                <strong>Remarks:</strong> {viewRow.Remarks}
              </div>
            )}
            <div className="flex justify-end mt-5 gap-2">
              <button onClick={() => { setViewRow(null); openEdit(viewRow); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                <Pencil size={13} /> Edit
              </button>
              <button onClick={() => setViewRow(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteID && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-2">Delete Catalog Entry?</h3>
            <p className="text-sm text-gray-600 mb-5">This will soft-delete the product and all related data.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteID(null)} disabled={deleting}
                className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-60">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
