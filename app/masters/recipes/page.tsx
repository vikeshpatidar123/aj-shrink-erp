"use client";
import { useState, useMemo } from "react";
import {
  Plus, Trash2, ArrowLeft, Save, List,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Layers
} from "lucide-react";
import { recipes as initData, Recipe, RecipeLayer, rawMaterials, weightedAvg, subGroups, customers } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

// ─── Local form types ─────────────────────────────────────────
type FormMaterial = {
  uid: number;
  rawMaterialId: string;
  rawMaterialName: string;
  percentage: number;
  density: number;
  rate: number;
};

type FormLayer = {
  uid: number;
  layerNo: number;
  name: string;
  materials: FormMaterial[];
  collapsed: boolean;
};

type RecipeForm = {
  name: string;
  code: string;
  description: string;
  status: "Active" | "Inactive";
  itemGroup: string;
  subGroup: string;
  clientId: string;
  micronFrom: number;
  micronTo: number;
  layerRatio: string;
};

const blankForm: RecipeForm = {
  name: "", code: "", description: "", status: "Active",
  itemGroup: "Film", subGroup: "", clientId: "", micronFrom: 0, micronTo: 0, layerRatio: "1:2:1"
};

const newMaterial = (): FormMaterial => ({
  uid: Date.now() + Math.random(),
  rawMaterialId: "", rawMaterialName: "", percentage: 0, density: 0.920, rate: 0,
});

const newLayer = (layerNo: number, name?: string): FormLayer => ({
  uid: Date.now() + Math.random(),
  layerNo,
  name: name || `Layer ${layerNo}`,
  materials: [newMaterial()],
  collapsed: false,
});

// ─── Per-layer calculations ───────────────────────────────────
function calcLayer(materials: FormMaterial[]) {
  const filled = materials.filter(m => m.rawMaterialId && m.percentage > 0);
  const totalPct = filled.reduce((s, m) => s + m.percentage, 0);
  const blendDensity = filled.length
    ? weightedAvg(filled.map(m => ({ percentage: m.percentage, value: m.density })))
    : 0;
  const blendRate = filled.length
    ? weightedAvg(filled.map(m => ({ percentage: m.percentage, value: m.rate })))
    : 0;
  return { totalPct, blendDensity, blendRate };
}

// ─── Component ───────────────────────────────────────────────
export default function RecipePage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<Recipe[]>(initData);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<RecipeForm>(blankForm);
  const [layers, setLayers] = useState<FormLayer[]>([newLayer(1)]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Form helpers ──────────────────────────────────────────
  const f = (k: keyof RecipeForm, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => {
    setEditId(null);
    setForm(blankForm);
    setLayers([
      newLayer(1, "Inner Layer"),
      newLayer(2, "Middle Layer"),
      newLayer(3, "Outer Layer")
    ]);
    setView("form");
  };

  const openEdit = (row: Recipe) => {
    setEditId(row.id);
    setForm({
      name: row.name, code: row.code, description: row.description,
      status: row.status,
      itemGroup: row.itemGroup || "Film",
      subGroup: row.subGroup || "",
      clientId: row.clientId || "",
      micronFrom: row.micronFrom || 0,
      micronTo: row.micronTo || 0,
      layerRatio: row.layerRatio || "1:2:1"
    });
    // Convert Recipe layers → FormLayers (each layer has multiple materials)
    setLayers(
      row.layers.map((l, idx) => ({
        uid: idx,
        layerNo: l.layerNo,
        name: l.name,
        collapsed: false,
        materials: l.materials.map((m, midx) => ({
          uid: midx,
          rawMaterialId: m.rawMaterialId,
          rawMaterialName: m.rawMaterialName,
          percentage: m.percentage,
          density: m.density,
          rate: m.rate,
        })),
      }))
    );
    setView("form");
  };

  const save = () => {
    if (!form.name.trim()) return;
    const built: RecipeLayer[] = layers.map(l => {
      const { blendDensity, blendRate } = calcLayer(l.materials);
      return {
        layerNo: l.layerNo,
        name: l.name,
        materials: l.materials.filter(m => m.rawMaterialId).map(m => ({
          rawMaterialId: m.rawMaterialId,
          rawMaterialName: m.rawMaterialName,
          percentage: m.percentage,
          density: m.density,
          rate: m.rate,
        })),
        blendDensity,
        blendRate,
      };
    });

    if (editId) {
      setData(d => d.map(r => r.id === editId ? { ...r, ...form, layers: built } : r));
    } else {
      const id = `RCP${String(data.length + 1).padStart(3, "0")}`;
      setData(d => [...d, {
        id, code: form.code || id, name: form.name,
        description: form.description,
        status: form.status, createdAt: new Date().toISOString().slice(0, 10),
        layers: built,
        itemGroup: form.itemGroup,
        subGroup: form.subGroup,
        clientId: form.clientId,
        micronFrom: form.micronFrom,
        micronTo: form.micronTo,
        layerRatio: form.layerRatio
      }]);
    }
    setView("list");
  };

  // ── Layer operations ──────────────────────────────────────
  const addLayer = () =>
    setLayers(prev => [...prev, newLayer(prev.length + 1)]);

  const removeLayer = (uid: number) =>
    setLayers(prev => prev.filter(l => l.uid !== uid).map((l, i) => ({ ...l, layerNo: i + 1 })));

  const updateLayerName = (uid: number, name: string) =>
    setLayers(prev => prev.map(l => l.uid === uid ? { ...l, name } : l));

  const toggleCollapse = (uid: number) =>
    setLayers(prev => prev.map(l => l.uid === uid ? { ...l, collapsed: !l.collapsed } : l));

  // ── Material operations ───────────────────────────────────
  const addMaterial = (layerUid: number) =>
    setLayers(prev => prev.map(l =>
      l.uid === layerUid ? { ...l, materials: [...l.materials, newMaterial()] } : l
    ));

  const removeMaterial = (layerUid: number, matUid: number) =>
    setLayers(prev => prev.map(l =>
      l.uid === layerUid ? { ...l, materials: l.materials.filter(m => m.uid !== matUid) } : l
    ));

  const updateMaterial = (layerUid: number, matUid: number, field: keyof FormMaterial, value: any) => {
    setLayers(prev => prev.map(l => {
      if (l.uid !== layerUid) return l;
      return {
        ...l,
        materials: l.materials.map(m => {
          if (m.uid !== matUid) return m;
          if (field === "rawMaterialId") {
            const rm = rawMaterials.find(r => r.id === value);
            return { ...m, rawMaterialId: value, rawMaterialName: rm?.name ?? "", density: rm?.density ?? m.density, rate: rm?.rate ?? m.rate };
          }
          return { ...m, [field]: value };
        }),
      };
    }));
  };

  // ── Summary ───────────────────────────────────────────────
  const totalBlendDensity = useMemo(() => {
    if (!layers.length) return 0;
    const avg = layers.reduce((s, l) => s + calcLayer(l.materials).blendDensity, 0) / layers.length;
    return parseFloat(avg.toFixed(4));
  }, [layers]);

  // ── List columns ──────────────────────────────────────────
  const columns: Column<Recipe>[] = [
    { key: "code", header: "Code", sortable: true },
    { key: "name", header: "Recipe Name", sortable: true },
    { key: "subGroup", header: "Sub Film Group", sortable: true, render: r => subGroups.find(sg => sg.id === r.subGroup)?.name || "—" },
    {
      key: "layers", header: "Layers", sortable: false,
      render: r => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
          <Layers size={11} /> {r.layers.length}
        </span>
      ),
    },
    { key: "description", header: "Description" },
    { key: "status", header: "Status", sortable: true, render: r => statusBadge(r.status) },
  ];

  // ══════════════════════════════════════════════════════════
  // FORM VIEW
  // ══════════════════════════════════════════════════════════
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-12 space-y-5">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors">
              <ArrowLeft size={16} /> List ({data.length})
            </button>
            <span className="text-gray-300">|</span>
            <div>
              <h2 className="text-lg font-bold text-gray-800">{editId ? "Edit Recipe" : "New Recipe"}</h2>
              <p className="text-xs text-gray-500">Extrusion – Multi-layer film recipe</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openAdd}
              className="flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors font-medium">
              <Plus size={15} /> New
            </button>
            <button onClick={save}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium">
              <Save size={15} /> Save Recipe
            </button>
          </div>
        </div>

        {/* ── Recipe Header ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-5 pb-2 border-b border-gray-100">
            Recipe Details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { label: "Recipe Name *", key: "name" as const, placeholder: "e.g. 3-Layer PE Shrink" },
              { label: "Recipe Code", key: "code" as const, placeholder: "Auto-generated if blank" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
                <input
                  type="text"
                  value={String(form[key])}
                  onChange={e => f(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            ))}
            
            {/* New Added Fields */}
            <div className="hidden">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Item Group</label>
              <input
                type="text"
                value="Film" // Hardcoded to Film since requirement says "film sirf 1 he itemgroup hoga"
                disabled
                className="w-full px-3 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Sub Film Group</label>
              <select
                value={form.subGroup}
                onChange={e => f("subGroup", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">— Select Subgroup —</option>
                {subGroups.filter(sg => sg.group === "Film").map(sg => (
                  <option key={sg.id} value={sg.id}>{sg.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Client</label>
              <select
                value={form.clientId}
                onChange={e => f("clientId", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">— Select Client —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Micron From</label>
                <input
                  type="number" min="0"
                  value={form.micronFrom || ""}
                  onChange={e => f("micronFrom", Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Micron To</label>
                <input
                  type="number" min="0"
                  value={form.micronTo || ""}
                  onChange={e => f("micronTo", Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Layer Ratio</label>
              <input
                type="text"
                placeholder="e.g. 1:2:1"
                value={form.layerRatio}
                onChange={e => f("layerRatio", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={e => f("status", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => f("description", e.target.value)}
                placeholder="Brief description of this recipe"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* ── Summary Strip ── */}
        <div className="flex items-center gap-6 px-5 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 font-medium">
          <span className="flex items-center gap-1.5"><Layers size={15} /> {layers.length} Layer{layers.length !== 1 ? "s" : ""}</span>
          <span className="text-blue-300">|</span>
          <span>Avg Blend Density: <strong>{totalBlendDensity || "—"} g/cm³</strong></span>
        </div>

        {/* ── Layers ── */}
        <div className="space-y-4">
          {layers.map((layer) => {
            const { totalPct, blendDensity, blendRate } = calcLayer(layer.materials);
            const pctOk = Math.abs(totalPct - 100) < 0.01 || totalPct === 0;

            return (
              <div key={layer.uid}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

                {/* Layer header bar */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800 text-white">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/20 text-xs font-bold shrink-0">
                      {layer.layerNo}
                    </span>
                    <input
                      type="text"
                      value={layer.name}
                      onChange={e => updateLayerName(layer.uid, e.target.value)}
                      className="bg-transparent text-sm font-semibold text-white placeholder-white/50 focus:outline-none border-b border-white/30 focus:border-white pb-0.5 w-52"
                      placeholder="Layer name…"
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/70">
                    {blendDensity > 0 && (
                      <>
                        <span>Blend Density: <strong className="text-white">{blendDensity}</strong></span>
                        <span>Blend Rate: <strong className="text-white">₹{blendRate.toFixed(2)}/kg</strong></span>
                      </>
                    )}
                    <span className={`flex items-center gap-1 font-semibold ${pctOk ? "text-green-300" : "text-red-400"}`}>
                      {pctOk ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {totalPct.toFixed(1)}%
                    </span>
                    <button onClick={() => toggleCollapse(layer.uid)} className="p-1 hover:bg-white/10 rounded transition-colors">
                      {layer.collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                  </div>
                </div>

                {/* Layer body */}
                {!layer.collapsed && (
                  <div>
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                          <th className="px-5 py-3 font-semibold w-8">#</th>
                          <th className="px-5 py-3 font-semibold">Raw Material</th>
                          <th className="px-5 py-3 font-semibold text-right w-36">Percentage %</th>
                          <th className="px-5 py-3 font-semibold text-right w-36">Density (g/cm³)</th>
                          <th className="px-5 py-3 font-semibold text-right w-36">Rate (₹/kg)</th>
                          <th className="px-5 py-3 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {layer.materials.map((mat, midx) => (
                          <tr key={mat.uid} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-5 py-3 text-xs text-gray-600 font-medium">{midx + 1}</td>
                            <td className="px-5 py-3">
                              <select
                                value={mat.rawMaterialId}
                                onChange={e => updateMaterial(layer.uid, mat.uid, "rawMaterialId", e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                <option value="">— Select Material —</option>
                                {rawMaterials.map(rm => (
                                  <option key={rm.id} value={rm.id}>
                                    {rm.name} [{rm.code}]
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-5 py-3">
                              <div className="relative">
                                <input
                                  type="number" min="0" max="100" step="0.1"
                                  value={mat.percentage}
                                  onChange={e => updateMaterial(layer.uid, mat.uid, "percentage", Number(e.target.value))}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-7"
                                />
                                <span className="absolute right-2.5 top-2.5 text-xs text-gray-400">%</span>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <input
                                type="number" step="0.001"
                                value={mat.density}
                                onChange={e => updateMaterial(layer.uid, mat.uid, "density", Number(e.target.value))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-5 py-3">
                              <input
                                type="number" step="0.01"
                                value={mat.rate}
                                onChange={e => updateMaterial(layer.uid, mat.uid, "rate", Number(e.target.value))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-5 py-3 text-center">
                              {layer.materials.length > 1 && (
                                <button
                                  onClick={() => removeMaterial(layer.uid, mat.uid)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Layer footer */}
                    <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100">
                      <button
                        onClick={() => addMaterial(layer.uid)}
                        className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold hover:text-blue-800 transition-colors"
                      >
                        <Plus size={13} /> Add Material to this Layer
                      </button>
                      <div className="flex items-center gap-6 text-xs text-gray-500">
                        {blendDensity > 0 && (
                          <>
                            <span>GSM @ 1μ = <span className="font-semibold text-gray-700">{blendDensity.toFixed(3)}</span></span>
                            <span>Blend Rate = <span className="font-semibold text-gray-700">₹{blendRate.toFixed(2)}/kg</span></span>
                          </>
                        )}
                        {!pctOk && totalPct > 0 && (
                          <span className="flex items-center gap-1 text-red-500 font-semibold">
                            <AlertCircle size={12} /> Percentage must total 100% (currently {totalPct.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>


        {/* ── Save footer ── */}
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => setView("list")}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={save}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Save size={16} /> Save Recipe
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Recipe Master</h2>
          <p className="text-sm text-gray-500">{data.length} extrusion recipes</p>
        </div>
        <Button variant="secondary" pill icon={<Plus size={16} />} onClick={openAdd}>New Recipe</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["name", "code", "subGroup"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => openEdit(row)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <List size={12} /> View / Edit
              </button>
              <button
                onClick={() => setDeleteId(row.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        />
      </div>

      {/* Recipe detail preview cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.slice(0, 4).map(recipe => (
          <div key={recipe.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => openEdit(recipe)}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-xs text-gray-600 font-medium">{recipe.code}</span>
                <h3 className="text-sm font-bold text-gray-800 mt-0.5">{recipe.name}</h3>
                <p className="text-xs text-gray-500">{subGroups.find(sg => sg.id === recipe.subGroup)?.name || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                  <Layers size={10} /> {recipe.layers.length} Layer{recipe.layers.length !== 1 ? "s" : ""}
                </span>
                {statusBadge(recipe.status)}
              </div>
            </div>
            <div className="space-y-2">
              {recipe.layers.map(layer => (
                <div key={layer.layerNo}
                  className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-700 text-white text-xs font-bold shrink-0">
                    {layer.layerNo}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">{layer.name}</p>
                    <p className="text-xs text-gray-600 truncate">
                      {layer.materials.map(m => `${m.rawMaterialName} ${m.percentage}%`).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-gray-700">{layer.blendDensity} g/cm³</p>
                    <p className="text-xs text-gray-600">₹{layer.blendRate}/kg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-semibold text-gray-800 mb-2">Delete Recipe?</h3>
            <p className="text-sm text-gray-500 mb-5">This will permanently remove the recipe. This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => { setData(d => d.filter(r => r.id !== deleteId)); setDeleteId(null); }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
