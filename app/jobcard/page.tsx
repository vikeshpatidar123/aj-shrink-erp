"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, Pencil, Trash2, Printer, BookMarked } from "lucide-react";
import {
  jobCards as initData, orders, machines, employees, recipes, rollMasters,
  JobCard, Recipe,
} from "@/data/dummyData";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { useExtrusionCatalog } from "@/context/ExtrusionCatalogContext";
import type { ExtCatalogLayer, ExtCatalogMatLine } from "@/context/ExtrusionCatalogContext";

// ── micron distribution (same as cost-estimation) ────────────────────────────
function distributeByRatio(totalMicron: number, ratioStr: string, layerCount: number): number[] {
  const parts = ratioStr.split(":").map(Number).filter(n => !isNaN(n) && n > 0);
  if (parts.length !== layerCount) {
    const each = parseFloat((totalMicron / layerCount).toFixed(2));
    return Array(layerCount).fill(each);
  }
  const total = parts.reduce((s, p) => s + p, 0);
  return parts.map(p => parseFloat(((p / total) * totalMicron).toFixed(2)));
}

// ── Blank form ───────────────────────────────────────────────────────────────
const blank: Omit<JobCard, "id" | "jobCardNo"> = {
  date: new Date().toISOString().slice(0, 10),
  orderId: "", orderNo: "", customerName: "", productName: "",
  recipeName: "", rollWidth: 0, totalGSM: 0,
  targetQty: 0, unit: "Kg",
  machineId: "", machineName: "", operatorId: "", operatorName: "",
  plannedDate: "", status: "Open",
};

export default function JobCardPage() {
  const router = useRouter();
  const { setPendingFill } = useExtrusionCatalog();
  const [data, setData]           = useState<JobCard[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow]     = useState<JobCard | null>(null);
  const [editing, setEditing]     = useState<JobCard | null>(null);
  const [form, setForm]           = useState<Omit<JobCard, "id" | "jobCardNo">>(blank);

  // ── Recipe / Roll / Layer state (driven independently by dropdowns) ─────────
  const [selRecipeId, setSelRecipeId]     = useState("");
  const [selRollId, setSelRollId]         = useState("");
  const [layerMicrons, setLayerMicrons]   = useState<number[]>([]);
  const [layerMatPcts, setLayerMatPcts]   = useState<number[][]>([]);

  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  // ── derived ───────────────────────────────────────────────────────────────
  const selectedRecipe = useMemo(() => recipes.find(r => r.id === selRecipeId), [selRecipeId]);
  const selectedRoll   = useMemo(() => rollMasters.find(r => r.id === selRollId), [selRollId]);

  const layerCalcs = useMemo(() => {
    if (!selectedRecipe) return [];
    return selectedRecipe.layers.map((layer, i) => {
      const micron = layerMicrons[i] ?? 0;
      const pcts   = layerMatPcts[i] ?? layer.materials.map(m => m.percentage);
      const blendDensity = parseFloat(
        layer.materials.reduce((s, m, j) => s + m.density * ((pcts[j] ?? m.percentage) / 100), 0).toFixed(4)
      );
      const gsm = parseFloat((micron * blendDensity).toFixed(3));
      return { micron, blendDensity, gsm, pcts };
    });
  }, [selectedRecipe, layerMicrons, layerMatPcts]);

  const totalGSM    = layerCalcs.reduce((s, l) => s + l.gsm, 0);
  const totalMicron = layerCalcs.reduce((s, l) => s + l.micron, 0);

  // ── auto-distribute microns (same as cost-estimation) ─────────────────────
  const autoDistribute = (recipe: Recipe, rollId: string) => {
    const roll = rollMasters.find(r => r.id === rollId);
    if (roll && recipe.layerRatio) {
      setLayerMicrons(distributeByRatio(roll.micron, recipe.layerRatio, recipe.layers.length));
    } else {
      setLayerMicrons(recipe.layers.map(() => 0));
    }
    setLayerMatPcts(recipe.layers.map(l => l.materials.map(m => m.percentage)));
  };

  // ── recipe dropdown → auto-select linked roll + distribute ────────────────
  const handleRecipeChange = (recipeId: string) => {
    setSelRecipeId(recipeId);
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) { setLayerMicrons([]); setLayerMatPcts([]); return; }
    f("recipeName", recipe.name);
    const linkedRollId = recipe.rollMasterId ?? "";
    setSelRollId(linkedRollId);
    const roll = rollMasters.find(r => r.id === linkedRollId);
    f("rollWidth", roll ? roll.width : 0);
    autoDistribute(recipe, linkedRollId);
  };

  // ── roll dropdown → redistribute microns if recipe selected ───────────────
  const handleRollChange = (rollId: string) => {
    setSelRollId(rollId);
    const roll = rollMasters.find(r => r.id === rollId);
    f("rollWidth", roll ? roll.width : 0);
    if (selectedRecipe) autoDistribute(selectedRecipe, rollId);
  };

  // ── open handlers ─────────────────────────────────────────────────────────
  const resetLayers = () => {
    setSelRecipeId(""); setSelRollId("");
    setLayerMicrons([]); setLayerMatPcts([]);
  };

  const openAdd = () => {
    setEditing(null); setForm(blank); resetLayers(); setModalOpen(true);
  };

  const openEdit = (row: JobCard) => {
    setEditing(row); setForm({ ...row });
    // restore recipe/roll dropdowns from saved data (find by name)
    const recipe = recipes.find(r => r.name === row.recipeName);
    if (recipe) {
      setSelRecipeId(recipe.id);
      const roll = rollMasters.find(r => r.width === row.rollWidth);
      const rollId = roll?.id ?? recipe.rollMasterId ?? "";
      setSelRollId(rollId);
      autoDistribute(recipe, rollId);
    } else {
      resetLayers();
    }
    setModalOpen(true);
  };

  // ── order change → only fills order-level details, NOT recipe/roll ─────────
  const handleOrderChange = (orderId: string) => {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;
    setForm(p => ({
      ...p,
      orderId: o.id, orderNo: o.orderNo,
      customerName: o.customerName, productName: o.productName,
      targetQty: o.quantity, unit: o.unit,
    }));
    // reset layer section — user must manually select Recipe & Roll Master
    resetLayers();
  };

  // ── material % edits ──────────────────────────────────────────────────────
  const updateMatPct = (li: number, mi: number, val: number) => {
    setLayerMatPcts(prev => {
      const n = prev.map(row => [...row]);
      if (!n[li] && selectedRecipe) n[li] = selectedRecipe.layers[li].materials.map(m => m.percentage);
      n[li][mi] = Math.min(100, Math.max(0, val));
      return n;
    });
  };

  // ── Make Product Catalog from a saved Job Card ────────────────
  const makeCatalog = (jc: JobCard) => {
    const recipe = recipes.find(r => r.name === jc.recipeName);
    const roll   = rollMasters.find(r => r.width === jc.rollWidth);
    let layers: ExtCatalogLayer[] = [];
    if (recipe) {
      const totalMicron = roll?.micron ?? 40;
      const ratios = recipe.layerRatio ? recipe.layerRatio.split(":").map(Number) : recipe.layers.map(() => 1);
      const ratioSum = ratios.reduce((a, b) => a + b, 0) || 1;
      layers = recipe.layers.map((rl, i) => {
        const micron = parseFloat(((ratios[i] / ratioSum) * totalMicron).toFixed(2));
        const mats: ExtCatalogMatLine[] = rl.materials.map(m => ({
          name: m.rawMaterialName, pct: m.percentage, density: m.density, rate: m.rate,
        }));
        const totalPct     = mats.reduce((s, m) => s + m.pct, 0) || 100;
        const blendDensity = parseFloat(mats.reduce((s, m) => s + (m.pct / totalPct) * m.density, 0).toFixed(4));
        const gsm          = parseFloat((micron * blendDensity).toFixed(3));
        const consumptionPerSqM = parseFloat((gsm / 1000).toFixed(6));
        const blendRate    = parseFloat(mats.reduce((s, m) => s + (m.pct / totalPct) * m.rate, 0).toFixed(4));
        const costPerSqM   = parseFloat((consumptionPerSqM * blendRate).toFixed(4));
        return { layerNo: rl.layerNo, layerName: rl.name, micron, materials: mats, blendDensity, gsm, consumptionPerSqM, blendRate, costPerSqM };
      });
    }
    setPendingFill({
      catalogName:     jc.productName,
      customerId:      "",
      customerName:    jc.customerName,
      recipeId:        recipe?.id ?? "",
      recipeName:      jc.recipeName ?? "",
      rollMasterId:    roll?.id ?? "",
      rollWidth:       jc.rollWidth ?? 0,
      layers,
      standardRate:    0,
      sourceJobCardNo: jc.jobCardNo,
    });
    router.push("/extrusion/product-catalog");
  };

  // ── save ──────────────────────────────────────────────────────────────────
  const save = () => {
    if (!form.orderId || !form.machineId) return;
    const saveForm: Omit<JobCard, "id" | "jobCardNo"> = {
      ...form,
      totalGSM:  parseFloat(totalGSM.toFixed(3)),
      rollWidth: form.rollWidth || 0,
    };
    if (editing) {
      setData(d => d.map(r => r.id === editing.id
        ? { ...saveForm, id: editing.id, jobCardNo: editing.jobCardNo } : r));
    } else {
      const jobCardNo = generateCode(UNIT_CODE.Extrusion, MODULE_CODE.JobCard, data.map(d => d.jobCardNo));
      const id = `EXJC${String(data.length + 1).padStart(3, "0")}`;
      setData(d => [...d, { ...saveForm, id, jobCardNo }]);
    }
    setModalOpen(false);
  };

  // ── columns ───────────────────────────────────────────────────────────────
  const columns: Column<JobCard>[] = [
    { key: "jobCardNo",    header: "Job Card No", sortable: true },
    { key: "date",         header: "Date",        sortable: true },
    { key: "orderNo",      header: "Order No" },
    { key: "customerName", header: "Customer",    sortable: true },
    { key: "productName",  header: "Product" },
    { key: "recipeName",   header: "Recipe",      render: r => <span>{r.recipeName || "—"}</span> },
    { key: "targetQty",    header: "Target Qty",  render: r => <span>{r.targetQty.toLocaleString()} {r.unit}</span> },
    { key: "totalGSM",     header: "GSM",         render: r => <span>{r.totalGSM ? r.totalGSM.toFixed(1) : "—"}</span> },
    { key: "machineName",  header: "Machine" },
    { key: "plannedDate",  header: "Planned Date" },
    { key: "status",       header: "Status",      render: r => statusBadge(r.status), sortable: true },
  ];

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Job Card Management</h2>
          <p className="text-sm text-gray-500">
            {data.length} job cards · {data.filter(j => j.status === "In Progress").length} in progress
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>Generate Job Card</Button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {["Open", "In Progress", "Completed", "On Hold"].map(s => {
          const colors: Record<string, string> = {
            Open:          "bg-gray-50 text-gray-600 border-gray-200",
            "In Progress": "bg-yellow-50 text-yellow-700 border-yellow-200",
            Completed:     "bg-green-50 text-green-700 border-green-200",
            "On Hold":     "bg-red-50 text-red-700 border-red-200",
          };
          return (
            <div key={s} className={`rounded-xl border p-4 ${colors[s]}`}>
              <p className="text-xs font-medium">{s}</p>
              <p className="text-2xl font-bold mt-1">{data.filter(j => j.status === s).length}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["jobCardNo", "customerName", "orderNo", "machineName"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              {row.recipeName && (
                <Button variant="ghost" size="sm" icon={<BookMarked size={13} />}
                  onClick={() => makeCatalog(row)}
                  className="text-purple-600 hover:text-purple-800">
                  Make Catalog
                </Button>
              )}
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />}
                onClick={() => setData(d => d.filter(r => r.id !== row.id))}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* ── Form Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? "Edit Job Card" : "Generate Job Card"} size="xl">
        <div className="space-y-4">

          {/* Step 1 — Order & Job Details */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Step 1 – Order & Job Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
              <Select
                label="Order *"
                value={form.orderId}
                onChange={e => handleOrderChange(e.target.value)}
                options={[
                  { value: "", label: "-- Select --" },
                  ...orders.map(o => ({ value: o.id, label: `${o.orderNo} – ${o.customerName}` })),
                ]}
              />
              <Input label="Customer"    value={form.customerName} readOnly className="bg-gray-50" />
              <Input label="Product"     value={form.productName}  readOnly className="bg-gray-50" />
              <Input label="Target Qty"  type="number" value={form.targetQty}
                onChange={e => f("targetQty", Number(e.target.value))} />
              <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)}
                options={[{ value: "Kg", label: "Kg" }, { value: "Pcs", label: "Pcs" }]} />
              <Select
                label="Machine *"
                value={form.machineId}
                onChange={e => {
                  const m = machines.find(x => x.id === e.target.value);
                  if (m) { f("machineId", m.id); f("machineName", m.name); }
                }}
                options={[
                  { value: "", label: "-- Select --" },
                  ...machines.map(m => ({ value: m.id, label: `${m.name} (${m.status})` })),
                ]}
              />
              <Select
                label="Operator"
                value={form.operatorId}
                onChange={e => {
                  const emp = employees.find(x => x.id === e.target.value);
                  if (emp) { f("operatorId", emp.id); f("operatorName", emp.name); }
                }}
                options={[
                  { value: "", label: "-- Select --" },
                  ...employees.filter(e => e.status === "Active").map(e => ({
                    value: e.id, label: `${e.name} (${e.department})`,
                  })),
                ]}
              />
              <Input label="Planned Date" type="date" value={form.plannedDate}
                onChange={e => f("plannedDate", e.target.value)} />
              <Select label="Status" value={form.status} onChange={e => f("status", e.target.value)}
                options={[
                  { value: "Open",        label: "Open" },
                  { value: "In Progress", label: "In Progress" },
                  { value: "Completed",   label: "Completed" },
                  { value: "On Hold",     label: "On Hold" },
                ]} />
            </div>
          </div>

          {/* Step 2 — Recipe & Roll Master */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Step 2 – Recipe & Roll Master</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Recipe *"
                value={selRecipeId}
                onChange={e => handleRecipeChange(e.target.value)}
                options={[
                  { value: "", label: "-- Select --" },
                  ...recipes.filter(r => r.status === "Active").map(r => ({
                    value: r.id, label: `${r.name} (${r.layers.length} layers)`,
                  })),
                ]}
              />
              <Select
                label="Roll Master"
                value={selRollId}
                onChange={e => handleRollChange(e.target.value)}
                options={[
                  { value: "", label: "-- Select --" },
                  ...rollMasters.filter(r => r.status === "Active").map(r => ({
                    value: r.id, label: `${r.name} – ${r.width}mm`,
                  })),
                ]}
              />
            </div>

            {/* Roll info chip — same as cost estimation */}
            {selectedRoll && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <div className="flex flex-wrap gap-x-5 gap-y-0.5">
                  <span><strong>Width:</strong> {selectedRoll.width} mm</span>
                  <span><strong>Micron:</strong> {selectedRoll.micron} μ</span>
                  <span><strong>Density:</strong> {selectedRoll.density} g/cm³</span>
                  {selectedRecipe && <span><strong>Layers:</strong> {selectedRecipe.layers.length}</span>}
                  {selectedRecipe?.layerRatio && <span><strong>Layer Ratio:</strong> {selectedRecipe.layerRatio}</span>}
                </div>
                {selectedRecipe?.layerRatio && (
                  <p className="mt-1.5 text-green-700 font-semibold text-[11px]">
                    ✓ Auto-distributed {selectedRoll.micron}μ across {selectedRecipe.layers.length} layers
                    using ratio {selectedRecipe.layerRatio}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Step 3 — Layer Structure (only when recipe selected) */}
          {selectedRecipe && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
                Step 3 – Layer Microns (μ) & Material %
              </p>
              <div className="space-y-3">
                {selectedRecipe.layers.map((layer, i) => {
                  const calc = layerCalcs[i];
                  const micron       = calc?.micron ?? 0;
                  const blendDensity = calc?.blendDensity ?? 0;
                  const gsm          = calc?.gsm ?? 0;
                  const pcts         = calc?.pcts ?? layer.materials.map(m => m.percentage);
                  const pctTotal     = pcts.reduce((s, p) => s + p, 0);

                  return (
                    <div key={i} className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
                      {/* layer header row */}
                      <div className="flex items-center gap-4">
                        <div className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                          {layer.layerNo}
                        </div>
                        <p className="flex-1 text-sm font-medium text-gray-800">{layer.name}</p>
                        {/* micron input */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" min={0} step={1} placeholder="μ"
                            value={micron}
                            onChange={e => {
                              const v = Number(e.target.value);
                              setLayerMicrons(prev => { const n = [...prev]; n[i] = v; return n; });
                            }}
                            className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-center"
                          />
                          <span className="text-xs text-gray-500 font-medium">μ</span>
                        </div>
                        {micron > 0 && (
                          <div className="flex gap-4 text-xs text-right">
                            <div>
                              <p className="text-gray-500">Density</p>
                              <p className="font-bold text-gray-700">{blendDensity} g/cm³</p>
                            </div>
                            <div>
                              <p className="text-gray-500">GSM</p>
                              <p className="font-bold text-blue-700">{gsm}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* per-material rows — no Rate/Cost columns */}
                      <div className="ml-9 space-y-1">
                        {layer.materials.map((m, j) => {
                          const pct = pcts[j] ?? m.percentage;
                          return (
                            <div key={j} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-100">
                              <span className="flex-1 text-xs font-medium text-gray-700 truncate">{m.rawMaterialName}</span>
                              <span className="text-xs text-gray-400">Density: {m.density}</span>
                              <input
                                type="number" min={0} max={100} step={1}
                                value={pct}
                                onChange={e => updateMatPct(i, j, Number(e.target.value))}
                                className="w-14 text-xs border border-gray-300 rounded-md px-2 py-1 text-center font-semibold focus:ring-1 focus:ring-blue-400 outline-none"
                              />
                              <span className="text-xs text-gray-400">%</span>
                            </div>
                          );
                        })}
                        {pctTotal !== 100 && (
                          <p className="text-[10px] text-amber-600 pl-1">⚠ Total blend % = {pctTotal} (should be 100)</p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* totals bar */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-blue-700 text-white rounded-xl text-xs font-semibold">
                  <span>Total</span>
                  <span className="flex gap-8">
                    <span>{totalMicron.toFixed(2)} μ</span>
                    <span>{totalGSM.toFixed(3)} GSM</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Update" : "Generate"}</Button>
          </div>
        </div>
      </Modal>

      {/* ── View Modal ── */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)}
          title={`Job Card – ${viewRow.jobCardNo}`} size="lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {([
              ["Order No",     viewRow.orderNo],
              ["Customer",     viewRow.customerName],
              ["Product",      viewRow.productName],
              ["Recipe",       viewRow.recipeName || "—"],
              ["Roll Width",   viewRow.rollWidth ? `${viewRow.rollWidth} mm` : "—"],
              ["Total GSM",    viewRow.totalGSM ? `${viewRow.totalGSM.toFixed(2)} GSM` : "—"],
              ["Target Qty",   `${viewRow.targetQty.toLocaleString()} ${viewRow.unit}`],
              ["Machine",      viewRow.machineName],
              ["Operator",     viewRow.operatorName],
              ["Planned Date", viewRow.plannedDate],
              ["Status",       viewRow.status],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-gray-500">{k}</p>
                <p className="font-medium text-gray-900">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            <Button variant="ghost" icon={<Printer size={14} />} onClick={() => window.print()}>Print Job Card</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
