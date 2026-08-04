"use client";
/**
 * MaterialCostAccordion — "Ply Configuration" + "Material Cost Breakdown" +
 * "Ink & Solvent Solid Content Report" grouping for the Gravure Costing
 * Estimation rewrite. Copied verbatim (JSX unchanged) from the legacy
 * `app/gravure/costing-estimation/page.tsx`:
 *   1. Ply Configuration — `{/* ── Section: Ply Configuration ── *}` block
 *      (form.secondaryLayers rows: ply type, film item, thickness/GSM,
 *      per-ply consumable rows with the inline dryGSM/solid/liquidGSM/
 *      hardenerGSM IIFEs kept intact).
 *   2. Material Cost Breakdown table + the "Extra Materials (Optional)"
 *      table (kept exactly as in source, still wrapped in `{false && ...}`
 *      — it was already dead/disabled code there) + the Process Cost
 *      Breakdown table (procLines) that sits between Extra Materials and
 *      the Loan & Labour Cost Calculator in the source.
 *   3. Ink & Solvent — Solid Content Report (informational only).
 *
 * NOT included here (already covered elsewhere in the new architecture):
 *   - "Trimming" input and "Section 3: Multiple Quantity Costing" table
 *     that sit between blocks 1 and 2 in the source — quantity comparison
 *     is now handled by `components/gravure/costing-estimation/QuantityCard.tsx`.
 *   - Process List table + Loan & Labour Cost Calculator table — those are
 *     `ProcessCostAccordion.tsx`.
 *
 * The "Lots" stock-picker buttons (film / consumable) toggle
 * `filmLotPickerOpen` / `ciLotPickerOpen` state — LIFTED to the parent
 * `EstimationInstancePanel` (passed down as props) so the actual popup
 * modals (ported into the panel from page.tsx's "FILM LOT PICKER MODAL" /
 * "CONSUMABLE ITEM LOT PICKER MODAL" blocks) can read/control them from
 * outside this accordion.
 */
import { Plus, X, Archive } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  items, grnRecords, CATEGORY_GROUP_SUBGROUP,
  SecondaryLayer, PlyConsumableItem, GravureEstimationMaterial,
} from "@/data/dummyData";
import { blank, resolveQuantities, calcCosts, getCostBreakdown } from "@/hooks/costingCalc";
import { CostingMasters, ALL_MAT_ITEMS } from "@/components/gravure/costing-estimation/CostingMastersContext";

// ─── Local copies of small helpers used only by this JSX ───────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">{label}</p>
  );
}

const cellInput = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

const GROUP_COLORS: Record<string, string> = {
  Film:     "bg-indigo-50 text-indigo-700 border-indigo-200",
  Ink:      "bg-blue-50  text-blue-700  border-blue-200",
  Adhesive: "bg-orange-50 text-orange-700 border-orange-200",
  Solvent:  "bg-purple-50 text-purple-700 border-blue-200",
  Hardner:  "bg-pink-50  text-pink-700  border-pink-200",
};

export interface MaterialCostAccordionProps {
  form: typeof blank;
  setForm: React.Dispatch<React.SetStateAction<typeof blank>>;
  f: (k: keyof typeof blank, v: unknown) => void;
  masters: CostingMasters;
  breakdown: ReturnType<typeof getCostBreakdown>;
  activeQty: number;
  activeCosts: ReturnType<typeof calcCosts>;

  onPlyTypeChange: (index: number, plyType: string) => void;
  addPlyConsumable: (layerIdx: number) => void;
  removePlyConsumable: (layerIdx: number, ciIdx: number) => void;
  updatePlyConsumable: (layerIdx: number, ciIdx: number, patch: Partial<PlyConsumableItem>) => void;

  addMaterial: () => void;
  removeMaterial: (i: number) => void;
  updateMaterial: (i: number, patch: Partial<GravureEstimationMaterial>) => void;
  selectMaterialItem: (i: number, itemId: string) => void;

  /** Lot-picker popup state — owned by the parent panel, which renders the actual popups. */
  filmLotPickerOpen: number | null;
  setFilmLotPickerOpen: React.Dispatch<React.SetStateAction<number | null>>;
  ciLotPickerOpen: { plyIdx: number; ciIdx: number } | null;
  setCiLotPickerOpen: React.Dispatch<React.SetStateAction<{ plyIdx: number; ciIdx: number } | null>>;
}

export default function MaterialCostAccordion({
  form, setForm, f, masters, breakdown, activeQty, activeCosts,
  onPlyTypeChange, addPlyConsumable, removePlyConsumable, updatePlyConsumable,
  addMaterial, removeMaterial, updateMaterial, selectMaterialItem,
  filmLotPickerOpen, setFilmLotPickerOpen, ciLotPickerOpen, setCiLotPickerOpen,
}: MaterialCostAccordionProps) {
  const { apiFilmSubGroups, apiFilmItems, apiInkItems, apiConsumableSubGroups, normalizeConsumableGroup } = masters;

  return (
    <div className="space-y-6">
      {/* ── Section: Ply Configuration ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader label={`Ply Configuration (${form.secondaryLayers.length} plys)`} />
          <div className="flex items-center gap-2">
            {/* Bulk add */}
            {(() => {
              let inputRef: HTMLInputElement | null = null;
              const addBulk = (el: HTMLInputElement | null) => {
                const n = Math.min(10, Math.max(1, parseInt(el?.value ?? "1") || 1));
                const layers = [...form.secondaryLayers];
                for (let k = 0; k < n; k++) layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
                f("secondaryLayers", layers);
                if (el) el.value = "";
              };
              return (
                <div className="flex items-center gap-0 border border-purple-300 rounded-lg overflow-hidden bg-white">
                  <span className="text-[10px] font-semibold text-purple-600 px-2 bg-purple-50 whitespace-nowrap border-r border-blue-200 py-1.5">Add</span>
                  <input type="number" min={1} max={10} placeholder="1" ref={el => { inputRef = el; }}
                    className="w-12 text-xs font-mono text-center border-none outline-none px-1 py-1.5 bg-white"
                    onKeyDown={e => { if (e.key === "Enter") addBulk(e.target as HTMLInputElement); }} />
                  <button onClick={() => addBulk(inputRef)}
                    className="text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-2 py-1.5 whitespace-nowrap transition">+ Plys</button>
                </div>
              );
            })()}
            <button onClick={() => {
              const layers = [...form.secondaryLayers];
              layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
              f("secondaryLayers", layers);
            }} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-blue-200">
              <Plus size={12} /> Add Ply
            </button>
          </div>
        </div>

        {form.secondaryLayers.length > 0 && (
          <div className="space-y-3">
            {form.secondaryLayers.map((l, index) => {
              const thicknesses = apiFilmSubGroups.find(s => s.subGroup === l.itemSubGroup)?.thicknesses || [];
              return (
                <div key={l.id} className="bg-white border-2 border-purple-50 rounded-2xl shadow-sm relative overflow-hidden">
                  {/* Ply header */}
                  <div className="flex items-center justify-between bg-purple-50 px-4 py-2 border-b border-purple-100">
                    <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                      {l.layerNo === 1 ? "1st" : l.layerNo === 2 ? "2nd" : l.layerNo === 3 ? "3rd" : `${l.layerNo}th`} Ply
                    </span>
                    <button onClick={() => f("secondaryLayers", form.secondaryLayers.filter((_, i) => i !== index))}
                      className="text-red-400 hover:text-red-600"><X size={14} /></button>
                  </div>

                  <div className="p-3 space-y-3">
                    {/* Ply Type */}
                    <Select
                      label="Ply Type *"
                      value={l.plyType}
                      onChange={e => { const val = e.target.value; onPlyTypeChange(index, val); }}
                      options={[
                        { value: "", label: "-- Select Ply Type --" },
                        { value: "Film", label: "Ply 1" },
                        { value: "Printing", label: "Ply 2" },
                        { value: "Lamination", label: "Ply 3" },
                        { value: "Coating", label: "Ply 4" },
                      ]}
                    />

                    {/* Film substrate */}
                    {l.plyType && (
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
                        <Select
                          label="Film Item"
                          value={l.itemId || ""}
                          onChange={e => {
                            const val = e.target.value;
                            const fi = apiFilmItems.find(f2 => String(f2.ItemID) === val);
                            const density  = fi?.Density    || 0;
                            const thickness = fi?.Thickness  || 0;
                            const gsm = thickness > 0 && density > 0 ? parseFloat((thickness * density).toFixed(3)) : 0;
                            const layers = [...form.secondaryLayers];
                            layers[index] = {
                              ...l,
                              itemId:       val,
                              itemName:     fi ? (fi.ItemDisplayName || fi.ItemName) : "",
                              itemSubGroup: fi?.ItemSubGroupName || "",
                              density, thickness, gsm,
                              filmRate: fi?.EstimationRate || l.filmRate || 0,
                            };
                            f("secondaryLayers", layers);
                          }}
                          options={[
                            { value: "", label: "-- Select Film Item --" },
                            ...apiFilmItems
                              .filter((fi, idx, arr) => arr.findIndex(x => String(x.ItemID) === String(fi.ItemID)) === idx)
                              .map(fi => ({ value: String(fi.ItemID), label: fi.ItemDisplayName || fi.ItemName })),
                          ]}
                        />
                        <div className="grid grid-cols-4 gap-2">
                          <Input label="Density" type="number" value={l.density || ""} readOnly className="bg-gray-50 text-gray-400 text-xs" />
                          <Select
                            label="Thickness (μ)"
                            value={l.thickness === 0 ? "" : String(l.thickness)}
                            onChange={e => {
                              const val = e.target.value;
                              const t = Number(val);
                              const layers = [...form.secondaryLayers];
                              layers[index] = { ...l, thickness: t, gsm: parseFloat((t * l.density).toFixed(3)) };
                              f("secondaryLayers", layers);
                            }}
                            options={[
                              { value: "", label: "Select" },
                              ...(l.thickness && !thicknesses.includes(l.thickness)
                                ? [...thicknesses, l.thickness].sort((a, b) => a - b)
                                : thicknesses
                              ).map(t => ({ value: String(t), label: String(t) })),
                            ]}
                          />
                          <Input label="Film GSM" type="number" value={l.gsm || ""} readOnly className="font-bold bg-purple-50 text-purple-800 border-blue-200 text-xs" />
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Rate (₹/Kg)</label>
                            <div className="flex gap-1 items-stretch">
                              <input type="number" step={0.01} min={0} placeholder="₹/Kg"
                                className="flex-1 min-w-0 text-xs border border-orange-200 bg-orange-50 rounded-xl px-2 py-2 font-mono outline-none focus:ring-2 focus:ring-orange-400"
                                value={l.filmRate !== undefined ? l.filmRate : ""}
                                onChange={e => { const layers = [...form.secondaryLayers]; layers[index] = { ...l, filmRate: Number(e.target.value) }; f("secondaryLayers", layers); }} />
                              {/* Stock lots picker button — only if lots exist for this film */}
                              {(() => {
                                const lots = grnRecords.flatMap(g => g.lines
                                  .filter(line => line.itemGroup === "Film" && line.subGroup === l.itemSubGroup)
                                  .map(line => ({ grnNo: g.grnNo, grnDate: g.grnDate, supplier: g.supplier, batchNo: line.batchNo, rate: line.rate, qty: line.receivedQty, unit: line.stockUnit }))
                                );
                                if (lots.length === 0) return null;
                                return (
                                  <button type="button"
                                    onClick={() => setFilmLotPickerOpen(filmLotPickerOpen === index ? null : index)}
                                    className={`px-2.5 rounded-xl border text-[10px] font-bold transition whitespace-nowrap flex items-center gap-1 ${filmLotPickerOpen === index ? "bg-orange-600 text-white border-orange-600" : "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"}`}>
                                    <Archive size={11} /> Lots ({lots.length})
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Consumable Items */}
                    {l.plyType && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Consumable Items ({l.consumableItems.length})</span>
                          <button onClick={() => addPlyConsumable(index)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 transition">
                            <Plus size={10} /> Add Consumable
                          </button>
                        </div>

                        {(() => {
                          // per-group serial numbers
                          const groupSerials: number[] = [];
                          const groupCounter: Record<string, number> = {};
                          l.consumableItems.forEach(ci => {
                            const g = ci.itemGroup || "Consumable";
                            groupCounter[g] = (groupCounter[g] || 0) + 1;
                            groupSerials.push(groupCounter[g]);
                          });
                          return l.consumableItems.map((ci, ciIdx) => {
                            const CONSUMABLE_GROUPS = ["Ink", "Solvent", "Adhesive", "Hardner"];
                            const subGroups = ci.itemGroup
                              ? (apiConsumableSubGroups[ci.itemGroup]?.length
                                  ? apiConsumableSubGroups[ci.itemGroup]
                                  : CATEGORY_GROUP_SUBGROUP["Raw Material (RM)"]?.[ci.itemGroup] ?? [])
                              : [];
                            const filteredApiItems = apiInkItems
                              .filter(it => normalizeConsumableGroup(it.ItemGroupName) === ci.itemGroup && (!ci.itemSubGroup || it.ItemSubGroupName === ci.itemSubGroup))
                              .filter((it, idx, arr) => arr.findIndex(x => String(x.ItemID) === String(it.ItemID)) === idx);
                            const filteredStaticItems = items.filter(it => it.group === ci.itemGroup && it.active && (!ci.itemSubGroup || it.subGroup === ci.itemSubGroup));
                            const filteredItems = filteredStaticItems; // kept for legacy rate/solidPct lookups below
                            const ciLabel = ci.itemGroup || "Consumable";
                            const ciSerial = groupSerials[ciIdx] ?? 1;

                            // Ink-specific calculations
                            const dryGSM   = ci.itemGroup === "Ink" ? (ci.gsm || 0) : 0;
                            const solid    = ci.itemGroup === "Ink" ? (ci.solidPct ?? ((items.find(x => x.id === ci.itemId) as any)?.solidPct ?? 40)) : 40;
                            const liquidGSM = dryGSM > 0 && solid > 0 ? parseFloat((dryGSM / (solid / 100)).toFixed(2)) : 0;

                            // Adhesive OH% — used for hardener auto-calc
                            const adhesiveCI  = l.consumableItems.find(x => x.itemGroup === "Adhesive");
                            const adhesiveGSM = adhesiveCI?.gsm ?? 0;
                            const adhesiveOH  = adhesiveCI?.ohPct ?? 0;

                            // Hardener GSM auto (same formula as product catalog)
                            const hardenerGSM = ci.itemGroup === "Hardner" && (ci.ncoPct ?? 0) > 0
                              ? parseFloat(((adhesiveGSM * adhesiveOH) / ci.ncoPct!).toFixed(3))
                              : null;

                            return (
                              <div key={ci.consumableId} className="bg-teal-50/40 border border-teal-100 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-bold text-teal-700 uppercase">{ciLabel} {ciSerial}</span>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => {
                                      const layers = [...form.secondaryLayers];
                                      const layer = { ...layers[index] };
                                      const clone = { ...layer.consumableItems[ciIdx], consumableId: Math.random().toString(), isClone: true };
                                      layer.consumableItems = [...layer.consumableItems.slice(0, ciIdx + 1), clone, ...layer.consumableItems.slice(ciIdx + 1)];
                                      layers[index] = layer;
                                      f("secondaryLayers", layers);
                                    }} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition">
                                      Clone
                                    </button>
                                    <button onClick={() => removePlyConsumable(index, ciIdx)}
                                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><X size={12} /></button>
                                  </div>
                                </div>

                                {/* Row 1: Group / SubGroup / Item / Rate */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                                  <Select
                                    label="Item Group"
                                    value={ci.itemGroup}
                                    onChange={e => { const val = e.target.value; updatePlyConsumable(index, ciIdx, { itemGroup: val, itemSubGroup: "", itemId: "", itemName: "", gsm: 0, coveragePct: undefined, ohPct: undefined, ncoPct: undefined }); }}
                                    options={[
                                      { value: "", label: "-- Group --" },
                                      ...CONSUMABLE_GROUPS.map(g => ({ value: g, label: g })),
                                    ]}
                                  />
                                  <Select
                                    label="Sub Group"
                                    value={ci.itemSubGroup}
                                    onChange={e => { const val = e.target.value; updatePlyConsumable(index, ciIdx, { itemSubGroup: val, itemId: "", itemName: "" }); }}
                                    disabled={!ci.itemGroup}
                                    options={[
                                      { value: "", label: "-- Sub Group --" },
                                      ...subGroups.map(sg => ({ value: sg, label: sg })),
                                    ]}
                                  />
                                  <Select
                                    label="Item (Master)"
                                    value={ci.itemId}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const apiIt  = filteredApiItems.find(x => String(x.ItemID) === val);
                                      const staticIt = filteredItems.find(x => x.id === val);
                                      // Rate comes from Item Master EstimationRate (API first, static fallback)
                                      const masterRate = apiIt?.EstimationRate
                                        ?? parseFloat(staticIt?.estimationRate ?? "0")
                                        ?? 0;
                                      const masterUnit = apiIt?.EstimationUnit || staticIt?.estimationUnit || "Kg";
                                      const patch: Partial<PlyConsumableItem> = {
                                        itemId:   val,
                                        itemName: apiIt?.ItemName ?? staticIt?.name ?? "",
                                        rate:     masterRate,
                                        rateUnit: masterUnit,
                                      };
                                      // For Ink: auto-fill DryGsM + SolidPerc from ItemMaster
                                      if (ci.itemGroup === "Ink" && apiIt) {
                                        patch.gsm = parseFloat(String(apiIt.DryGsM ?? 0)) || 0;
                                        patch.solidPct = parseFloat(String(apiIt.SolidPerc ?? 40)) || 40;
                                      }
                                      updatePlyConsumable(index, ciIdx, patch);
                                    }}
                                    disabled={!ci.itemGroup}
                                    options={[
                                      { value: "", label: "-- Select Item --" },
                                      ...(filteredApiItems.length > 0
                                        ? filteredApiItems
                                            .filter((it, idx, arr) => arr.findIndex(x => String(x.ItemID) === String(it.ItemID)) === idx)
                                            .map(it => ({ value: String(it.ItemID), label: `${it.ItemName}${it.EstimationRate > 0 ? ` — ₹${it.EstimationRate}/${it.EstimationUnit || "Kg"}` : ""}` }))
                                        : filteredItems.map(it => ({ value: it.id, label: `${it.name}${it.estimationRate ? ` — ₹${it.estimationRate}/Kg` : ""}` }))),
                                    ]}
                                  />
                                  <div>
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                                      Rate (₹/{ci.rateUnit || "Kg"})
                                    </label>
                                    <div className="flex gap-1 items-stretch">
                                      <input type="number" step={0.01} min={0}
                                        placeholder={`₹/${ci.rateUnit || "Kg"}`}
                                        className="flex-1 min-w-0 text-xs border border-orange-200 bg-orange-50 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                                        value={ci.rate || ""}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { rate: Number(e.target.value) })} />
                                      {(() => {
                                        const ciLots = grnRecords.flatMap(g => g.lines
                                          .filter(line => line.itemGroup === ci.itemGroup && line.subGroup === ci.itemSubGroup)
                                          .map(line => ({ grnNo: g.grnNo, grnDate: g.grnDate, supplier: g.supplier, batchNo: line.batchNo, rate: line.rate, qty: line.receivedQty, unit: line.stockUnit, itemName: line.itemName }))
                                        );
                                        if (ciLots.length === 0) return null;
                                        const isOpen = ciLotPickerOpen?.plyIdx === index && ciLotPickerOpen?.ciIdx === ciIdx;
                                        return (
                                          <button type="button"
                                            onClick={() => setCiLotPickerOpen(isOpen ? null : { plyIdx: index, ciIdx })}
                                            className={`px-2 rounded-lg border text-[10px] font-bold transition whitespace-nowrap flex items-center gap-1 ${isOpen ? "bg-orange-600 text-white border-orange-600" : "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"}`}>
                                            <Archive size={10} /> Lots ({ciLots.length})
                                          </button>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>

                                {/* Row 2: Group-specific fields */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                  {ci.itemGroup === "Ink" && (<>
                                    <div>
                                      <label className="text-[10px] font-semibold text-blue-600 uppercase block mb-1">Dry Ink GSM</label>
                                      <input type="number" step="any" min={0} placeholder="GSM"
                                        className="w-full text-xs border border-blue-200 bg-blue-50 rounded-lg px-2 py-1.5 font-mono outline-none focus:ring-2 focus:ring-blue-400"
                                        value={ci.gsm || ""}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { gsm: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">% Solid</label>
                                      <input type="number" step={1} min={1} max={100}
                                        className="w-full text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                                        value={solid}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { solidPct: Number(e.target.value) || 40 })}
                                        placeholder="40" />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-indigo-600 uppercase block mb-1">Liquid GSM</label>
                                      <input type="number" readOnly value={liquidGSM || ""}
                                        className="w-full text-xs border border-indigo-200 bg-indigo-50 rounded-lg px-2 py-1.5 font-mono font-bold text-indigo-700" />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Coverage %</label>
                                      <input type="number" step={1} min={1} max={100} placeholder="100"
                                        className="w-full text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-blue-50 outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                                        value={ci.coveragePct ?? 100}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { coveragePct: Math.min(100, Math.max(1, Number(e.target.value))) })} />
                                    </div>
                                  </>)}

                                  {ci.itemGroup === "Solvent" && (<>
                                    <div>
                                      <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Ratio (%)</label>
                                      <input type="number" step={0.1} min={0} max={100} placeholder="%"
                                        className="w-full text-xs border border-teal-200 bg-teal-50 rounded-lg px-2 py-1.5 font-mono outline-none focus:ring-2 focus:ring-teal-400"
                                        value={ci.gsm || ""}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                    </div>
                                  </>)}

                                  {ci.itemGroup === "Adhesive" && (<>
                                    <div>
                                      <label className="text-[10px] font-semibold text-violet-600 uppercase block mb-1">Adhesive GSM</label>
                                      <input type="number" step={0.1} min={0} placeholder="e.g. 4.5"
                                        className="w-full text-xs border border-violet-200 bg-violet-50 rounded-lg px-2 py-1.5 font-mono outline-none focus:ring-2 focus:ring-violet-400"
                                        value={ci.gsm || ""}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-orange-500 uppercase block mb-1">OH %</label>
                                      <input type="number" step={0.1} min={0} max={100} placeholder="e.g. 2.5"
                                        className="w-full text-xs border border-orange-200 bg-orange-50 rounded-lg px-2 py-1.5 font-mono outline-none focus:ring-2 focus:ring-orange-400"
                                        value={ci.ohPct ?? ""}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { ohPct: Number(e.target.value) })} />
                                    </div>
                                  </>)}

                                  {ci.itemGroup === "Hardner" && (<>
                                    <div>
                                      <label className="text-[10px] font-semibold text-rose-600 uppercase block mb-1">NCO %</label>
                                      <input type="number" step={0.1} min={0} max={100} placeholder="e.g. 12.5"
                                        className="w-full text-xs border border-rose-200 bg-rose-50 rounded-lg px-2 py-1.5 font-mono outline-none focus:ring-2 focus:ring-rose-400"
                                        value={ci.ncoPct ?? ""}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { ncoPct: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-teal-600 uppercase block mb-1">Hardener GSM (Auto)</label>
                                      <div className="w-full text-xs border border-teal-200 rounded-lg px-2 py-1.5 bg-teal-50 font-mono font-bold text-teal-700 min-h-[30px]">
                                        {hardenerGSM !== null ? hardenerGSM : <span className="text-gray-400 font-normal text-[10px]">Set Adhesive GSM + OH% + NCO%</span>}
                                      </div>
                                    </div>
                                  </>)}

                                  {!["Ink","Solvent","Adhesive","Hardner"].includes(ci.itemGroup) && (
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">GSM / Wt.</label>
                                      <input type="number" step={0.1} min={0}
                                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                        value={ci.gsm || ""}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}

                        {l.consumableItems.length === 0 && (
                          <p className="text-[10px] text-gray-400 italic text-center py-2">Click "+ Add Consumable" to add ink, solvent, adhesive, etc.</p>
                        )}

                        {/* Ply Summary Strip */}
                        {l.consumableItems.length > 0 && (() => {
                          const groupCount: Record<string, number> = {};
                          l.consumableItems.forEach(ci => { const g = ci.itemGroup || "Other"; groupCount[g] = (groupCount[g] || 0) + 1; });
                          const inks = l.consumableItems.filter(ci => ci.itemGroup === "Ink");
                          const totalDryGSM = inks.reduce((s, ci) => s + (parseFloat(String(ci.gsm)) || 0), 0);
                          const avgSolid = inks.length > 0 ? inks.reduce((s, ci) => { const it = items.find(x => x.id === ci.itemId); return s + (ci.solidPct ?? (it as any)?.solidPct ?? 35); }, 0) / inks.length : 0;
                          const GROUP_COLOR: Record<string, string> = { Ink: "bg-blue-100 text-blue-700 border-blue-200", Solvent: "bg-teal-100 text-teal-700 border-teal-200", Adhesive: "bg-violet-100 text-violet-700 border-violet-200", Hardner: "bg-orange-100 text-orange-700 border-orange-200", Other: "bg-gray-100 text-gray-600 border-gray-200" };
                          return (
                            <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl mt-2">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ply Summary:</span>
                              {Object.entries(groupCount).map(([g, cnt]) => (
                                <span key={g} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${GROUP_COLOR[g] ?? GROUP_COLOR.Other}`}>{g}: <strong>{cnt}</strong></span>
                              ))}
                              {inks.length > 0 && (<>
                                <span className="w-px h-3 bg-slate-300 mx-1" />
                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Total Dry GSM: <strong>{totalDryGSM.toFixed(1)}</strong></span>
                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Avg Solid: <strong>{avgSolid.toFixed(1)}%</strong></span>
                              </>)}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Material Cost Breakdown ──────────────────────── */}
      <div>
        <SectionHeader label={`Material Cost Breakdown — Area: ${(activeQty * (form.jobWidth / 1000)).toLocaleString()} m² · Qty: ${activeQty.toLocaleString()} ${form.unit}`} />
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full text-xs whitespace-nowrap">
            <thead style={{ background: "var(--erp-primary)" }} className="text-white">
              <tr>
                {["Ply", "Type", "Material / Item", "Group", "GSM / Wet Wt.", "Req. Mtr", "Req. SQM", "Req. Wt (Kg)", "Waste Mtr", "Waste SQM", "Waste Wt (Kg)", "Total Mtr", "Total SQM", "Total Wt (Kg)", "Rate (₹/Kg)", "Amount (₹)"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {breakdown.matLines.length === 0 ? (
                <tr><td colSpan={16} className="px-4 py-6 text-center text-gray-400">No materials — select items in Ply Information (Tab 1)</td></tr>
              ) : breakdown.matLines.map((m, i) => {
                const sizeW = form.jobWidth || 340;
                // Running meter: activeQty directly (manual entry — no production plan)
                const basePlanRMT = activeQty;
                const reqMtr   = m.plyNo > 0 ? parseFloat(basePlanRMT.toFixed(2)) : 0;
                const reqSQM   = m.plyNo > 0 ? parseFloat((reqMtr * sizeW / 1000).toFixed(3)) : 0;
                const reqWt    = m.plyNo > 0 && m.gsm > 0 ? parseFloat((reqSQM * m.gsm / 1000).toFixed(4)) : 0;
                const wasteFrac = (form.wastagePct || 1) / 100;
                const wasteMtr = m.plyNo > 0 ? parseFloat((reqMtr * wasteFrac).toFixed(2)) : 0;
                const wasteSQM = m.plyNo > 0 ? parseFloat((wasteMtr * sizeW / 1000).toFixed(3)) : 0;
                const wasteWt  = m.plyNo > 0 && m.gsm > 0 ? parseFloat((wasteSQM * m.gsm / 1000).toFixed(4)) : 0;
                const totalMtr = m.plyNo > 0 ? parseFloat((reqMtr + wasteMtr).toFixed(2)) : 0;
                const totalSQM = m.plyNo > 0 ? parseFloat((reqSQM + wasteSQM).toFixed(3)) : 0;
                const totalWt  = m.plyNo > 0 ? parseFloat((reqWt + wasteWt).toFixed(4)) : 0;
                const isExtra  = m.plyNo === 0;

                return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold text-purple-700">{m.plyNo > 0 ? `P${m.plyNo}` : "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      m.plyType === "Printing" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      m.plyType === "Lamination" ? "bg-orange-50 text-orange-700 border-orange-200" :
                      m.plyType === "Extra" ? "bg-gray-100 text-gray-600 border-gray-300" :
                      "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>{m.plyType}</span>
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800">{m.name}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${GROUP_COLORS[m.group] || "bg-gray-100 text-gray-600"}`}>{m.group}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-700">{m.gsm > 0 ? `${m.gsm} g/m²` : "—"}</td>
                  {/* Running Meter columns — only for ply materials, not Extra */}
                  <td className="px-3 py-2 font-mono text-gray-700">{isExtra ? "—" : reqMtr.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{isExtra ? "—" : reqSQM.toLocaleString()}</td>
                  <td className="px-3 py-2 font-semibold text-blue-700">{isExtra ? m.kg.toFixed(3) : reqWt.toFixed(4)}</td>
                  <td className="px-3 py-2 font-mono text-amber-600">{isExtra ? "—" : wasteMtr.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-amber-600">{isExtra ? "—" : wasteSQM.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-amber-600">{isExtra ? "—" : wasteWt.toFixed(4)}</td>
                  <td className="px-3 py-2 font-bold text-gray-800">{isExtra ? "—" : totalMtr.toLocaleString()}</td>
                  <td className="px-3 py-2 font-bold text-gray-800">{isExtra ? "—" : totalSQM.toLocaleString()}</td>
                  <td className="px-3 py-2 font-bold text-purple-700 bg-purple-50/40">{isExtra ? m.kg.toFixed(3) : totalWt.toFixed(4)}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{m.rate > 0 ? `₹${m.rate}` : <span className="text-amber-600 font-semibold">— select item</span>}</td>
                  <td className="px-3 py-2 font-bold text-gray-900">{m.amount > 0 ? `₹${m.amount.toLocaleString()}` : "₹0"}</td>
                </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-purple-50 border-t-2 border-blue-200">
              <tr>
                <td colSpan={15} className="px-3 py-2.5 text-xs font-bold text-purple-700 uppercase text-right">Total Material Cost</td>
                <td className="px-3 py-2.5 text-sm font-black text-purple-800">₹{activeCosts.materialCost.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      </div>

      {/* ── Extra Materials — hidden ──────────────────────── */}
      {false && <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader label="Extra Materials (Optional)" />
          <button
            type="button"
            onClick={addMaterial}
            className="text-xs px-3 py-1.5 rounded-lg border border-purple-300 text-purple-700 bg-white hover:bg-purple-50 font-semibold"
          >+ Add Material</button>
        </div>
        {form.materials.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center text-xs text-gray-400">
            No extra materials. Click "+ Add Material" to add items not in the ply structure (e.g. carton, tape, special consumable).
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="min-w-full text-xs">
              <thead style={{ background: "var(--erp-primary)" }} className="text-white">
                <tr>
                  {["Item", "Group", "Unit", "Rate (₹)", "Qty", "Amount (₹)", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {form.materials.map((m, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5 min-w-[180px]">
                      <SearchableSelect
                        value={m.itemId || ""}
                        onChange={val => {
                          if (val) selectMaterialItem(i, val);
                          else updateMaterial(i, { itemId: "", itemCode: "", itemName: "", rate: 0 });
                        }}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                        placeholder="— select item —"
                        options={(ALL_MAT_ITEMS as any[]).map((it: any) => ({ value: it.id, label: `${it.name} (${it.group})` }))}
                      />
                      {!m.itemId && (
                        <input
                          type="text"
                          value={m.itemName}
                          onChange={e => updateMaterial(i, { itemName: e.target.value })}
                          placeholder="or type item name"
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1 mt-1 bg-gray-50"
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={m.group}
                        onChange={e => updateMaterial(i, { group: e.target.value })}
                        className="w-24 text-xs border border-gray-200 rounded px-2 py-1 bg-white" placeholder="Group" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={m.unit}
                        onChange={e => updateMaterial(i, { unit: e.target.value })}
                        className="w-16 text-xs border border-gray-200 rounded px-2 py-1 bg-white" placeholder="Unit" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} value={m.rate || ""}
                        onChange={e => updateMaterial(i, { rate: Number(e.target.value) })}
                        className="w-24 text-xs border border-gray-200 rounded px-2 py-1 bg-white text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} step={0.001} value={m.qty || ""}
                        onChange={e => updateMaterial(i, { qty: Number(e.target.value) })}
                        className="w-20 text-xs border border-gray-200 rounded px-2 py-1 bg-white text-right" />
                    </td>
                    <td className="px-2 py-1.5 font-bold text-gray-900">₹{m.amount.toLocaleString()}</td>
                    <td className="px-2 py-1.5">
                      <button type="button" onClick={() => removeMaterial(i)}
                        className="text-red-400 hover:text-red-600 font-bold text-base leading-none">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-xs font-bold text-gray-600 text-right">Total Extra Materials</td>
                  <td className="px-3 py-2 text-sm font-black text-gray-900">₹{form.materials.reduce((s, m) => s + m.amount, 0).toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>}

      {/* ── Process Cost Breakdown ────────────────────────── */}
      {breakdown.procLines.length > 0 && (
      <div>
        <SectionHeader label="Process Cost Breakdown (from Process Master)" />
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full text-xs">
            <thead style={{ background: "var(--erp-primary)" }} className="text-white">
              <tr>
                {["Process Name", "Charge Unit", "Qty", "Rate (₹)", "Setup (₹)", "Amount (₹)"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {breakdown.procLines.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{p.name}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-mono text-[10px]">{p.chargeUnit}</span></td>
                  <td className="px-3 py-2 font-mono text-gray-700">{p.qty.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">₹{p.rate}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{p.setupCharge > 0 ? `₹${p.setupCharge}` : "—"}</td>
                  <td className="px-3 py-2 font-bold text-gray-900">₹{p.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-indigo-700 uppercase text-right">Total Process Cost</td>
                <td className="px-3 py-2.5 text-sm font-black text-indigo-800">₹{activeCosts.processCost.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}

      {/* ── Ink & Solvent — Solid Content Report (informational only) ── */}
      <div>
        <SectionHeader label="Ink & Solvent — Solid Content Report" />
        <div className="border border-teal-200 rounded-xl overflow-hidden bg-white">
          <div className="px-4 py-2 bg-teal-50 border-b border-teal-100 flex items-center justify-between flex-wrap gap-1">
            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Liquid vs Solid Cost Efficiency</p>
            <span className="text-[10px] text-teal-500">Informational — does not change Material Cost</span>
          </div>
          {(() => {
            const { areaM2 } = resolveQuantities(form);
            type SolidRow = { name: string; liquidKg: number; rate: number; solidPct: number; solidKg: number; solidRate: number; cost: number };
            const inkRows: SolidRow[] = [];
            const solventRows: SolidRow[] = [];
            form.secondaryLayers.forEach(l => {
              l.consumableItems.forEach(ci => {
                const grp = normalizeConsumableGroup(ci.itemGroup);
                if (grp !== "Ink" && grp !== "Solvent") return;
                if (!(ci.gsm > 0) || !(ci.rate > 0)) return;
                const effectiveGsm = (ci.coveragePct ?? 100) < 100
                  ? ci.gsm * ((ci.coveragePct ?? 100) / 100)
                  : ci.gsm;
                const liquidKg = parseFloat((effectiveGsm * areaM2 / 1000).toFixed(3));
                const cost = parseFloat((liquidKg * ci.rate).toFixed(2));
                if (grp === "Ink") {
                  const solidPct  = ci.solidPct || 0;
                  const solidKg   = parseFloat((liquidKg * solidPct / 100).toFixed(3));
                  const solidRate = solidPct > 0 ? parseFloat((ci.rate / (solidPct / 100)).toFixed(2)) : 0;
                  inkRows.push({ name: ci.itemName || ci.fieldDisplayName || "Ink", liquidKg, rate: ci.rate, solidPct, solidKg, solidRate, cost });
                } else {
                  solventRows.push({ name: ci.itemName || ci.fieldDisplayName || "Solvent", liquidKg, rate: ci.rate, solidPct: 0, solidKg: 0, solidRate: 0, cost });
                }
              });
            });

            const inkTotals = inkRows.reduce((a, r) => ({
              liquidKg: a.liquidKg + r.liquidKg, solidKg: a.solidKg + r.solidKg, cost: a.cost + r.cost,
            }), { liquidKg: 0, solidKg: 0, cost: 0 });
            const inkAvgSolidPct  = inkTotals.liquidKg > 0 ? (inkTotals.solidKg / inkTotals.liquidKg) * 100 : 0;
            const inkAvgLiqRate   = inkTotals.liquidKg > 0 ? inkTotals.cost / inkTotals.liquidKg : 0;
            const inkAvgSolidRate = inkTotals.solidKg > 0 ? inkAvgLiqRate / (inkAvgSolidPct / 100) : 0;

            const solvTotals = solventRows.reduce((a, r) => ({
              liquidKg: a.liquidKg + r.liquidKg, cost: a.cost + r.cost,
            }), { liquidKg: 0, cost: 0 });

            if (inkRows.length === 0 && solventRows.length === 0) {
              return <div className="p-4 text-center text-xs text-gray-400">No Ink/Solvent consumables in the current ply structure.</div>;
            }

            return (
              <>
                {inkRows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {["Ink Item", "Liquid Kg", "Rate ₹/kg", "Solid %", "Solid Kg", "Eff. ₹/kg-solid", "Cost ₹"].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {inkRows.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap max-w-[160px] truncate">{r.name}</td>
                            <td className="px-3 py-2 font-mono text-gray-600">{r.liquidKg.toFixed(3)}</td>
                            <td className="px-3 py-2 font-mono text-gray-600">₹{r.rate.toLocaleString()}</td>
                            <td className="px-3 py-2 font-mono text-blue-700 font-semibold">{r.solidPct > 0 ? `${r.solidPct}%` : <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 font-mono text-gray-600">{r.solidKg > 0 ? r.solidKg.toFixed(3) : <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 font-mono text-teal-700 font-semibold">{r.solidRate > 0 ? `₹${r.solidRate.toLocaleString()}` : <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 font-bold text-gray-900">₹{r.cost.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                        <tr>
                          <td className="px-3 py-2 text-xs font-bold text-blue-700 uppercase whitespace-nowrap">Weighted Avg / Total</td>
                          <td className="px-3 py-2 font-mono font-bold text-blue-800">{inkTotals.liquidKg.toFixed(3)}</td>
                          <td className="px-3 py-2 font-mono font-bold text-blue-800">₹{inkAvgLiqRate.toFixed(2)}</td>
                          <td className="px-3 py-2 font-mono font-bold text-blue-800">{inkAvgSolidPct > 0 ? `${inkAvgSolidPct.toFixed(1)}%` : "—"}</td>
                          <td className="px-3 py-2 font-mono font-bold text-blue-800">{inkTotals.solidKg.toFixed(3)}</td>
                          <td className="px-3 py-2 font-mono font-bold text-blue-800">{inkAvgSolidRate > 0 ? `₹${inkAvgSolidRate.toFixed(2)}` : "—"}</td>
                          <td className="px-3 py-2 font-mono font-bold text-blue-800">₹{inkTotals.cost.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                {solventRows.length > 0 && (
                  <div className="overflow-x-auto border-t border-gray-100">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {["Solvent Item", "Liquid Kg", "Rate ₹/kg", "Cost ₹"].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {solventRows.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap max-w-[160px] truncate">{r.name}</td>
                            <td className="px-3 py-2 font-mono text-gray-600">{r.liquidKg.toFixed(3)}</td>
                            <td className="px-3 py-2 font-mono text-gray-600">₹{r.rate.toLocaleString()}</td>
                            <td className="px-3 py-2 font-bold text-gray-900">₹{r.cost.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-purple-50 border-t-2 border-purple-200">
                        <tr>
                          <td className="px-3 py-2 text-xs font-bold text-purple-700 uppercase whitespace-nowrap">Total</td>
                          <td className="px-3 py-2 font-mono font-bold text-purple-800">{solvTotals.liquidKg.toFixed(3)}</td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2 font-mono font-bold text-purple-800">₹{solvTotals.cost.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
