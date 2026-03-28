"use client";
import { useState, useMemo } from "react";
import { Plus, Eye, Pencil, Calculator, ChevronDown, ChevronUp } from "lucide-react";
import {
  costEstimations as initData, recipes, rollMasters, customers,
  CostEstimation, CostLayerResult, Recipe
} from "@/data/dummyData";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

// ─── Utility: distribute roll micron by recipe layerRatio ───
function distributeByRatio(totalMicron: number, ratioStr: string, layerCount: number): number[] {
  const parts = ratioStr.split(":").map(Number).filter(n => !isNaN(n) && n > 0);
  if (parts.length !== layerCount) {
    const each = parseFloat((totalMicron / layerCount).toFixed(2));
    return Array(layerCount).fill(each);
  }
  const totalParts = parts.reduce((s, p) => s + p, 0);
  return parts.map(p => parseFloat(((p / totalParts) * totalMicron).toFixed(2)));
}

// ─── Auto-calculation engine ────────────────────────────────
function computeLayerResults(recipe: Recipe, layerMicrons: number[]): CostLayerResult[] {
  return recipe.layers.map((layer, i) => {
    const micron = layerMicrons[i] ?? 0;
    const density = layer.blendDensity;
    const gsm = parseFloat((micron * density).toFixed(4));          // g/m²
    const consumptionPerSqM = parseFloat((gsm / 1000).toFixed(6));  // kg/m²
    const costPerSqM = parseFloat((consumptionPerSqM * layer.blendRate).toFixed(4));
    return {
      layerNo: layer.layerNo, layerName: layer.name,
      micron, density, gsm, consumptionPerSqM,
      blendRate: layer.blendRate, costPerSqM,
    };
  });
}

function computeRequiredMaterials(recipe: Recipe, layerResults: CostLayerResult[], orderQtyKg: number) {
  const matMap: Record<string, { materialName: string; quantityKg: number; ratePerKg: number }> = {};
  recipe.layers.forEach((layer, i) => {
    const consumptionPerSqM = layerResults[i]?.consumptionPerSqM ?? 0;
    const totalKgPerSqM = consumptionPerSqM;
    // Distribute to materials by percentage
    layer.materials.forEach((m) => {
      const qty = parseFloat((totalKgPerSqM * (m.percentage / 100) * orderQtyKg).toFixed(2));
      if (!matMap[m.rawMaterialId]) {
        matMap[m.rawMaterialId] = { materialName: m.rawMaterialName, quantityKg: 0, ratePerKg: m.rate };
      }
      matMap[m.rawMaterialId].quantityKg += qty;
    });
  });
  return Object.values(matMap).map(m => ({
    ...m,
    quantityKg: parseFloat(m.quantityKg.toFixed(2)),
    totalCost: parseFloat((m.quantityKg * m.ratePerKg).toFixed(2)),
  }));
}

export default function CostEstimationPage() {
  const [data, setData] = useState<CostEstimation[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow] = useState<CostEstimation | null>(null);
  const [editing, setEditing] = useState<CostEstimation | null>(null);

  // Form fields
  const [fCustomerId, setFCustomerId] = useState("");
  const [fCustomerName, setFCustomerName] = useState("");
  const [fRecipeId, setFRecipeId] = useState("");
  const [fRollId, setFRollId] = useState("");
  const [fLayerMicrons, setFLayerMicrons] = useState<number[]>([]);
  const [fMachineCost, setFMachineCost] = useState(0.80);
  const [fOverheadCost, setFOverheadCost] = useState(0.40);
  const [fSellingPricePerKg, setFSellingPricePerKg] = useState(0);
  const [fDeliveryDate, setFDeliveryDate] = useState("");
  const [fEstDays, setFEstDays] = useState(7);
  const [fStatus, setFStatus] = useState<"Draft" | "Approved" | "Rejected">("Draft");
  const [fOrderQty, setFOrderQty] = useState(5000);

  const selectedRecipe = useMemo(() => recipes.find(r => r.id === fRecipeId), [fRecipeId]);
  const selectedRoll = useMemo(() => rollMasters.find(r => r.id === fRollId), [fRollId]);

  const layerResults = useMemo(() => {
    if (!selectedRecipe || fLayerMicrons.length === 0) return [];
    return computeLayerResults(selectedRecipe, fLayerMicrons);
  }, [selectedRecipe, fLayerMicrons]);

  const totalGSM = layerResults.reduce((s, r) => s + r.gsm, 0);
  const totalMaterialCostPerSqM = layerResults.reduce((s, r) => s + r.costPerSqM, 0);
  const totalCostPerSqM = totalMaterialCostPerSqM + fMachineCost + fOverheadCost;
  // Cost per kg = totalCostPerSqM / (totalGSM/1000)
  const totalCostPerKg = totalGSM > 0 ? parseFloat((totalCostPerSqM / (totalGSM / 1000)).toFixed(2)) : 0;
  const marginPct = fSellingPricePerKg > 0
    ? parseFloat((((fSellingPricePerKg - totalCostPerKg) / fSellingPricePerKg) * 100).toFixed(2))
    : 0;

  const requiredMaterials = useMemo(() => {
    if (!selectedRecipe || layerResults.length === 0) return [];
    return computeRequiredMaterials(selectedRecipe, layerResults, fOrderQty);
  }, [selectedRecipe, layerResults, fOrderQty]);

  const openAdd = () => {
    setEditing(null);
    setFCustomerId(""); setFCustomerName(""); setFRecipeId(""); setFRollId("");
    setFLayerMicrons([]); setFMachineCost(0.80); setFOverheadCost(0.40);
    setFSellingPricePerKg(0); setFDeliveryDate(""); setFEstDays(7); setFStatus("Draft");
    setFOrderQty(5000);
    setModalOpen(true);
  };


  const openEdit = (row: CostEstimation) => {
    setEditing(row);
    setFCustomerId(row.customerId); setFCustomerName(row.customerName);
    setFRecipeId(row.recipeId); setFRollId(row.rollMasterId);
    setFLayerMicrons(row.layerMicrons); setFMachineCost(row.machineCostPerSqM);
    setFOverheadCost(row.overheadCostPerSqM); setFSellingPricePerKg(row.sellingPricePerKg);
    setFDeliveryDate(row.deliveryDate); setFEstDays(row.estimatedDays); setFStatus(row.status);
    setFOrderQty(5000);
    setModalOpen(true);
  };

  const autoDistributeMicrons = (recipe: Recipe, rollId: string) => {
    const roll = rollMasters.find(r => r.id === rollId);
    if (roll && recipe.layerRatio) {
      setFLayerMicrons(distributeByRatio(roll.micron, recipe.layerRatio, recipe.layers.length));
    } else {
      setFLayerMicrons(recipe.layers.map(() => 0));
    }
  };

  const handleRecipeSelect = (recipeId: string) => {
    setFRecipeId(recipeId);
    const r = recipes.find(x => x.id === recipeId);
    if (!r) return;
    // Auto-select linked roll master
    const linkedRollId = r.rollMasterId ?? "";
    setFRollId(linkedRollId);
    autoDistributeMicrons(r, linkedRollId);
  };

  const handleRollSelect = (rollId: string) => {
    setFRollId(rollId);
    if (selectedRecipe) {
      autoDistributeMicrons(selectedRecipe, rollId);
    }
  };

  const save = () => {
    if (!fRecipeId || !fCustomerId) return;
    const roll = selectedRoll;
    const rec = selectedRecipe;
    if (!rec || !roll) return;

    const record: Omit<CostEstimation, "id" | "estimationNo"> = {
      date: new Date().toISOString().slice(0, 10),
      customerId: fCustomerId, customerName: fCustomerName,
      recipeId: fRecipeId, recipeName: rec.name,
      rollMasterId: fRollId, rollName: roll.name, rollWidth: roll.width,
      totalMicron: fLayerMicrons.reduce((s, v) => s + v, 0),
      layerMicrons: fLayerMicrons, layerResults,
      totalGSM: parseFloat(totalGSM.toFixed(3)),
      totalCostPerSqM: parseFloat(totalCostPerSqM.toFixed(4)),
      machineCostPerSqM: fMachineCost,
      labourCostPerSqM: 0,
      overheadCostPerSqM: fOverheadCost,
      sellingPricePerKg: fSellingPricePerKg,
      totalCostPerKg, marginPct,
      estimatedDays: fEstDays,
      deliveryDate: fDeliveryDate,
      requiredMaterials,
      status: fStatus,
    };

    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...record, id: editing.id, estimationNo: editing.estimationNo } : r));
    } else {
      const estimationNo = generateCode(UNIT_CODE.Extrusion, MODULE_CODE.Estimation, data.map(d => d.estimationNo));
      const id = `EXES${String(data.length + 1).padStart(3, "0")}`;
      setData(d => [...d, { ...record, id, estimationNo }]);
    }
    setModalOpen(false);
  };

  const columns: Column<CostEstimation>[] = [
    { key: "estimationNo", header: "Est. No", sortable: true },
    { key: "date", header: "Date", sortable: true },
    { key: "customerName", header: "Customer", sortable: true },
    { key: "recipeName", header: "Recipe" },
    { key: "totalMicron", header: "Total μ", render: r => <span>{r.totalMicron} μ</span> },
    { key: "totalGSM", header: "Total GSM", render: r => <span className="font-semibold text-blue-700">{r.totalGSM.toFixed(2)}</span> },
    { key: "totalCostPerKg", header: "Cost/Kg (₹)", render: r => <span>₹{r.totalCostPerKg}</span> },
    { key: "sellingPricePerKg", header: "Sell/Kg (₹)", render: r => <span className="font-semibold">₹{r.sellingPricePerKg}</span> },
    { key: "marginPct", header: "Margin %", render: r => (
      <span className={`font-bold ${r.marginPct >= 10 ? "text-green-600" : "text-red-500"}`}>{r.marginPct}%</span>
    )},
    { key: "status", header: "Status", render: r => statusBadge(r.status) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Cost Estimation & Planning</h2>
          <p className="text-sm text-gray-500">Recipe-based auto cost calculation · Layer GSM · Material planning</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Estimation</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Estimations", val: data.length, cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Approved", val: data.filter(d => d.status === "Approved").length, cls: "bg-green-50 text-green-700 border-green-200" },
          { label: "Avg Margin", val: `${data.length ? (data.reduce((s, d) => s + d.marginPct, 0) / data.length).toFixed(1) : 0}%`, cls: "bg-purple-50 text-purple-700 border-purple-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["estimationNo", "customerName", "recipeName"]}
          actions={(row) => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
            </div>
          )}
        />
      </div>

      {/* ─── Create / Edit Modal ──────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Estimation" : "New Cost Estimation"} size="xl">
        <div className="space-y-4">
          {/* Step 1: Setup */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2"><Calculator size={13} /> Step 1 – Setup</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Select
                label="Customer *"
                value={fCustomerId}
                onChange={(e) => { const c = customers.find(x => x.id === e.target.value); setFCustomerId(e.target.value); if (c) setFCustomerName(c.name); }}
                options={customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))}
              />
              <Select
                label="Recipe *"
                value={fRecipeId}
                onChange={(e) => handleRecipeSelect(e.target.value)}
                options={recipes.filter(r => r.status === "Active").map(r => ({ value: r.id, label: `${r.name} (${r.layers.length} layers)` }))}
              />
              <Select
                label="Roll Master"
                value={fRollId}
                onChange={(e) => handleRollSelect(e.target.value)}
                options={rollMasters.filter(r => r.status === "Active").map(r => ({ value: r.id, label: `${r.name} – ${r.width}mm` }))}
              />
              {selectedRoll && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 col-span-1">
                  <p className="font-semibold text-blue-900 mb-1">📋 Job Name: {selectedRoll.jobName ?? selectedRoll.name}</p>
                  <p><strong>Width:</strong> {selectedRoll.width} mm &nbsp;|&nbsp; <strong>Micron:</strong> {selectedRoll.micron} μ &nbsp;|&nbsp; <strong>Density:</strong> {selectedRoll.density} g/cm³</p>
                  <p><strong>Stock Unit:</strong> {selectedRoll.stockUnit} &nbsp;|&nbsp; <strong>Purchase Unit:</strong> {selectedRoll.purchaseUnit}</p>
                  {selectedRecipe?.layerRatio && <p className="mt-1 text-green-700 font-medium">✓ Layer Ratio: {selectedRecipe.layerRatio} → Auto-distributed {selectedRoll.micron}μ across {selectedRecipe.layers.length} layers</p>}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Layer Microns */}
          {selectedRecipe && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Step 2 – Enter Layer Microns (μ)</p>
              <div className="space-y-3">
                {selectedRecipe.layers.map((layer, i) => {
                  const micron = fLayerMicrons[i] ?? 0;
                  const gsm = parseFloat((micron * layer.blendDensity).toFixed(3));
                  const costPerSqM = parseFloat((gsm / 1000 * layer.blendRate).toFixed(4));
                  return (
                    <div key={i} className="flex items-center gap-4 bg-gray-50 rounded-xl px-4 py-3">
                      <div className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">{layer.layerNo}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{layer.name}</p>
                        <p className="text-xs text-gray-600">
                          {layer.materials.map(m => `${m.rawMaterialName} ${m.percentage}%`).join(" + ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0} step={1}
                          value={micron}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setFLayerMicrons(prev => { const n = [...prev]; n[i] = v; return n; });
                          }}
                          className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-center"
                          placeholder="μ"
                        />
                        <span className="text-xs text-gray-600 font-medium w-4">μ</span>
                      </div>
                      {micron > 0 && (
                        <div className="flex gap-4 text-xs text-right min-w-0">
                          <div>
                            <p className="text-gray-600 font-medium">GSM</p>
                            <p className="font-bold text-blue-700">{gsm}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 font-medium">Cost/m²</p>
                            <p className="font-bold text-purple-700">₹{costPerSqM}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Auto-calc totals */}
              {fLayerMicrons.some(m => m > 0) && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Micron", val: `${fLayerMicrons.reduce((s, v) => s + v, 0)} μ`, cls: "bg-gray-50 border-gray-200", valCls: "text-gray-900" },
                    { label: "Total GSM", val: `${totalGSM.toFixed(3)} g/m²`, cls: "bg-blue-50 border-blue-200", valCls: "text-blue-800" },
                    { label: "Material Cost/m²", val: `₹${totalMaterialCostPerSqM.toFixed(4)}`, cls: "bg-purple-50 border-purple-200", valCls: "text-purple-800" },
                    { label: "Cost/Kg (material)", val: `₹${totalGSM > 0 ? (totalMaterialCostPerSqM / (totalGSM / 1000)).toFixed(2) : 0}`, cls: "bg-orange-50 border-orange-200", valCls: "text-orange-800" },
                  ].map(c => (
                    <div key={c.label} className={`rounded-lg border p-3 ${c.cls}`}>
                      <p className="text-xs font-medium text-gray-600">{c.label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${c.valCls}`}>{c.val}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Additional Costs + Pricing */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Step 3 – Additional Costs & Pricing</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="Machine Cost (₹/m²)" type="number" step={0.01} value={fMachineCost} onChange={(e) => setFMachineCost(Number(e.target.value))} />
              <Input label="Overhead (₹/m²)" type="number" step={0.01} value={fOverheadCost} onChange={(e) => setFOverheadCost(Number(e.target.value))} />
              <Input label="Selling Price (₹/Kg)" type="number" value={fSellingPricePerKg} onChange={(e) => setFSellingPricePerKg(Number(e.target.value))} />
              <Input label="Order Qty (Kg)" type="number" value={fOrderQty} onChange={(e) => setFOrderQty(Number(e.target.value))} />
            </div>

            {totalGSM > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="bg-gray-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-600">Total Cost/Kg</p>
                  <p className="text-2xl font-bold text-gray-900">₹{totalCostPerKg}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-600">Selling Price/Kg</p>
                  <p className="text-2xl font-bold text-blue-700">₹{fSellingPricePerKg}</p>
                </div>
                <div className={`rounded-xl p-4 border ${marginPct >= 10 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <p className="text-xs font-semibold text-gray-600">Margin</p>
                  <p className={`text-2xl font-bold ${marginPct >= 10 ? "text-green-700" : "text-red-600"}`}>{marginPct}%</p>
                  {marginPct < 10 && <p className="text-xs text-red-600 font-medium mt-1">Below target (10%)</p>}
                </div>
              </div>
            )}
          </div>

          {/* Required Materials Preview */}
          {requiredMaterials.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Required Materials (for {fOrderQty} Kg order)</p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-xs text-gray-700 uppercase">
                    <tr>
                      {["Material", "Qty (Kg)", "Rate (₹/Kg)", "Total Cost (₹)"].map(h => (
                        <th key={h} className="px-4 py-2 text-left font-bold tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requiredMaterials.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-semibold text-gray-900">{m.materialName}</td>
                        <td className="px-4 py-2 text-gray-800 font-medium">{m.quantityKg.toLocaleString()}</td>
                        <td className="px-4 py-2 text-gray-800 font-medium">₹{m.ratePerKg}</td>
                        <td className="px-4 py-2 font-semibold text-gray-900">₹{m.totalCost.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-semibold">
                      <td className="px-4 py-2 text-gray-900 font-bold">Total</td>
                      <td className="px-4 py-2 text-gray-900 font-bold">{requiredMaterials.reduce((s, m) => s + m.quantityKg, 0).toFixed(0)}</td>
                      <td></td>
                      <td className="px-4 py-2 font-bold text-blue-700">₹{requiredMaterials.reduce((s, m) => s + m.totalCost, 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Delivery + Status */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input label="Estimated Days" type="number" value={fEstDays} onChange={(e) => setFEstDays(Number(e.target.value))} />
            <Input label="Delivery Date" type="date" value={fDeliveryDate} onChange={(e) => setFDeliveryDate(e.target.value)} />
            <Select label="Status" value={fStatus} onChange={(e) => setFStatus(e.target.value as "Draft" | "Approved" | "Rejected")}
              options={[{ value: "Draft", label: "Draft" }, { value: "Approved", label: "Approved" }, { value: "Rejected", label: "Rejected" }]} />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button icon={<Calculator size={14} />} onClick={save}>{editing ? "Update" : "Save Estimation"}</Button>
        </div>
      </Modal>

      {/* View Detail Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Estimation – ${viewRow.estimationNo}`} size="xl">
          <div className="space-y-5 text-gray-700">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {[["Customer", viewRow.customerName], ["Recipe", viewRow.recipeName], ["Roll", viewRow.rollName], ["Status", viewRow.status]].map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-400">{k}</p><p className="font-semibold text-gray-800">{v}</p></div>
              ))}
            </div>

            {/* Layer results */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Layer-wise Calculation</p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      {["Layer", "Micron", "Density", "GSM (g/m²)", "Consumption (kg/m²)", "Rate (₹/kg)", "Cost/m²"].map(h => (
                        <th key={h} className="px-3 py-2 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {viewRow.layerResults.map((lr) => (
                      <tr key={lr.layerNo} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{lr.layerName}</td>
                        <td className="px-3 py-2">{lr.micron} μ</td>
                        <td className="px-3 py-2">{lr.density}</td>
                        <td className="px-3 py-2 font-semibold text-blue-700">{lr.gsm}</td>
                        <td className="px-3 py-2">{lr.consumptionPerSqM}</td>
                        <td className="px-3 py-2">₹{lr.blendRate}</td>
                        <td className="px-3 py-2 font-semibold">₹{lr.costPerSqM}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold text-sm">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2">{viewRow.totalMicron} μ</td>
                      <td></td>
                      <td className="px-3 py-2 text-blue-700">{viewRow.totalGSM}</td>
                      <td></td><td></td>
                      <td className="px-3 py-2 text-purple-700">₹{viewRow.totalCostPerSqM}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-4 border">
                <p className="text-xs text-gray-500">Total Cost/Kg</p>
                <p className="text-xl font-bold">₹{viewRow.totalCostPerKg}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-xs text-gray-500">Selling Price/Kg</p>
                <p className="text-xl font-bold text-blue-700">₹{viewRow.sellingPricePerKg}</p>
              </div>
              <div className={`rounded-xl p-4 border ${viewRow.marginPct >= 10 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <p className="text-xs text-gray-500">Margin</p>
                <p className={`text-xl font-bold ${viewRow.marginPct >= 10 ? "text-green-700" : "text-red-600"}`}>{viewRow.marginPct}%</p>
              </div>
            </div>

            {/* Required materials */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Required Materials</p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>{["Material", "Qty (Kg)", "Rate", "Total"].map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {viewRow.requiredMaterials.map((m, i) => (
                      <tr key={i}><td className="px-4 py-2 font-medium text-gray-800">{m.materialName}</td><td className="px-4 py-2">{m.quantityKg.toLocaleString()}</td><td className="px-4 py-2">₹{m.ratePerKg}</td><td className="px-4 py-2 font-semibold">₹{m.totalCost.toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
