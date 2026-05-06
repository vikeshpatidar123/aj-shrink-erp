"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List, X } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/WarehouseMasterShrink`;

function unwrap(v: any): any {
  let r = v;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

// â”€â”€â”€ Shared UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all";
const ic = (err?: boolean) => err ? inputCls.replace("border-gray-300", "border-red-400 bg-red-50/50") : inputCls;

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type WarehouseRow = {
  id: string;
  WarehouseID: string;
  WarehouseName: string;
  WarehouseCode: string;
  RefWarehouseCode: string;
  BinName: string;
  City: string;
  Address: string;
  ProductionUnitID: string;
  BranchID: string;
  IsFloorWarehouse: boolean;
};

type BinRow = {
  WarehouseID?: string;
  BinName: string;
};

type FormState = {
  WarehouseName: string;
  RefWarehouseCode: string;
  Address: string;
  City: string;
  ProductionUnitID: string;
  BranchID: string;
  IsFloorWarehouse: boolean;
  Bins: BinRow[];
};

const blank = (): FormState => ({
  WarehouseName: "",
  RefWarehouseCode: "",
  Address: "",
  City: "",
  ProductionUnitID: "",
  BranchID: "",
  IsFloorWarehouse: false,
  Bins: [{ BinName: "Default" }],
});

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function WarehouseMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [binInput, setBinInput] = useState("");
  const [companyName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("companyName") || "Warehouse Master" : "Warehouse Master"
  );
  
  // Lookups
  const [branches, setBranches] = useState<any[]>([]);
  const [productionUnits, setProductionUnits] = useState<any[]>([]);

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  // â”€â”€â”€ Load Lookups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    // Attempt to load lookups if they exist (graceful fallback)
    fetch(`${BASE_URL}/api/othermaster/getbranch`, { headers: authHeaders() })
      .then(r => r.text()).then(unwrap).then(r => Array.isArray(r) && setBranches(r)).catch(() => {});
    fetch(`${BASE_URL}/api/othermaster/getproductionunitlist`, { headers: authHeaders() })
      .then(r => r.text()).then(unwrap).then(r => Array.isArray(r) && setProductionUnits(r)).catch(() => {});
  }, []);

  // â”€â”€â”€ Load list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadList = useCallback(() => {
    setLoading(true);
    // Assuming backend might implement a standard GET endpoint soon:
    fetch(`${BASE}/GetAll`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const raw = unwrap(text);
        if (Array.isArray(raw)) setData(raw.map((r: any) => ({ ...r, id: String(r.WarehouseID) })));
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // â”€â”€â”€ Open Add â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openAdd = () => {
    setEditing(null);
    setError("");
    setSubmitAttempted(false);
    setBinInput("");
    setForm(blank());
    setView("form");
  };

  // â”€â”€â”€ Open Edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openEdit = (row: WarehouseRow) => {
    // Group all bins for this WarehouseName/RefWarehouseCode from the data array
    const siblingBins = data.filter(r => r.RefWarehouseCode === row.RefWarehouseCode);
    
    setEditing(row);
    setError("");
    setSubmitAttempted(false);
    setBinInput("");
    setForm({
      WarehouseName:    String(row.WarehouseName ?? ""),
      RefWarehouseCode: String(row.RefWarehouseCode ?? ""),
      Address:          String(row.Address ?? ""),
      City:             String(row.City ?? ""),
      ProductionUnitID: String(row.ProductionUnitID ?? ""),
      BranchID:         String(row.BranchID ?? ""),
      IsFloorWarehouse: Boolean(row.IsFloorWarehouse),
      Bins: siblingBins.length > 0 
            ? siblingBins.map(b => ({ WarehouseID: b.WarehouseID, BinName: b.BinName }))
            : [{ WarehouseID: row.WarehouseID, BinName: row.BinName ?? "Default" }],
    });
    setView("form");
  };

  // â”€â”€â”€ Save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saveWarehouse = async () => {
    setSubmitAttempted(true);
    if (!form.WarehouseName.trim() || !form.RefWarehouseCode.trim() || form.Bins.length === 0) {
      setError("Please fill all required fields and ensure at least one Bin exists.");
      return;
    }
    
    setSaving(true);
    setError("");
    try {
      const payloads = form.Bins.map(b => ({
        WarehouseID: b.WarehouseID ? Number(b.WarehouseID) : undefined,
        WarehouseName: form.WarehouseName.trim(),
        RefWarehouseCode: form.RefWarehouseCode.trim(),
        BinName: b.BinName.trim(),
        Address: form.Address.trim(),
        City: form.City.trim(),
        ProductionUnitID: Number(form.ProductionUnitID) || 0,
        BranchID: Number(form.BranchID) || 0,
        IsFloorWarehouse: form.IsFloorWarehouse
      }));

      const endpoint = editing ? "Update" : "Create";
      const res = await fetch(`${BASE}/${endpoint}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payloads),
      });

      const result = unwrap(await res.text());
      if (res.ok && String(result).includes("Success")) {
        loadList();
        setView("list");
      } else {
        setError("Save failed: " + result);
      }
    } catch (e: any) {
      setError("Error: " + e.message);
    }
    setSaving(false);
  };

  // â”€â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const deleteWarehouse = async (row: WarehouseRow) => {
    if (!confirm(`Are you sure you want to delete warehouse "${row.WarehouseName}" and all its bins?`)) return;
    try {
      const res = await fetch(`${BASE}/Delete`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        // Backend Delete uses array with RefWarehouseCode
        body: JSON.stringify([{ RefWarehouseCode: row.RefWarehouseCode }]), 
      });
      const result = unwrap(await res.text());
      if (res.ok && String(result).includes("Success")) {
        loadList();
      } else {
        alert(result || "Delete failed.");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // â”€â”€â”€ Bin Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addBin = () => {
    const val = binInput.trim();
    if (!val) return;
    if (form.Bins.some(b => b.BinName.toLowerCase() === val.toLowerCase())) {
        setError(`Bin "${val}" already exists!`);
        return;
    }
    setError("");
    setForm(p => ({ ...p, Bins: [...p.Bins, { BinName: val }] }));
    setBinInput("");
  };

  const removeBin = (idx: number) => {
    setForm(p => {
        const newBins = [...p.Bins];
        newBins.splice(idx, 1);
        return { ...p, Bins: newBins };
    });
  };

  // â”€â”€â”€ FORM VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{companyName}</p>
            <h2 className="text-xl font-bold text-gray-800">{editing ? "Edit Warehouse" : "New Warehouse"}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <List size={16} /> Back to List
            </button>
            <button onClick={saveWarehouse} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save Warehouse
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8 space-y-8">
            {/* Identity */}
            <div>
              <SectionTitle title="Warehouse Identity" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <Field label="Warehouse Name" required>
                  <input type="text" value={form.WarehouseName}
                    onChange={e => f("WarehouseName", e.target.value)}
                    placeholder="Enter Warehouse Name" className={ic(submitAttempted && !form.WarehouseName.trim())} />
                </Field>
                <Field label="Reference / ER Code" required>
                  <input type="text" value={form.RefWarehouseCode}
                    onChange={e => f("RefWarehouseCode", e.target.value)}
                    placeholder="e.g. WH-101" className={ic(submitAttempted && !form.RefWarehouseCode.trim())} />
                </Field>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="floorwarehouse" className="w-4 h-4 text-blue-600 rounded" 
                  checked={form.IsFloorWarehouse} onChange={(e) => f("IsFloorWarehouse", e.target.checked)} />
                <label htmlFor="floorwarehouse" className="text-sm font-semibold text-gray-700 select-none cursor-pointer">
                  Is Floor Warehouse?
                </label>
              </div>
            </div>

            {/* Location */}
            <div>
              <SectionTitle title="Location & Linkage" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                 <div className="lg:col-span-2">
                    <Field label="Address">
                        <textarea rows={2} value={form.Address}
                            onChange={e => f("Address", e.target.value)}
                            placeholder="Full address..." className={inputCls} />
                    </Field>
                 </div>
                 <Field label="City">
                    <input type="text" value={form.City}
                            onChange={e => f("City", e.target.value)}
                            placeholder="e.g. Mumbai" className={inputCls} />
                 </Field>
              </div>
            </div>

            {/* Sub-table: Bins */}
            <div>
              <SectionTitle title="Storage Bins" />
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                 
                 <div className="flex items-center gap-3 mb-4 max-w-sm">
                    <input type="text" value={binInput} onChange={e => setBinInput(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && addBin()}
                         placeholder="Enter bin name..." className={inputCls} />
                    <Button variant="secondary" size="sm" onClick={addBin} icon={<Plus size={15}/>}>Add Bin</Button>
                 </div>

                 {form.Bins.length === 0 ? (
                     <div className="text-sm text-gray-500 italic">No bins added. At least one bin is required.</div>
                 ) : (
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                         {form.Bins.map((bin, idx) => (
                             <div key={idx} className="bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 flex items-center justify-between group">
                                 <span className="text-sm font-semibold text-gray-700 truncate">{bin.BinName}</span>
                                 <button onClick={() => removeBin(idx)} className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                     <X size={15} />
                                 </button>
                             </div>
                         ))}
                     </div>
                 )}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // â”€â”€â”€ LIST VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const columns: Column<WarehouseRow>[] = [
    { key: "RefWarehouseCode", header: "Ref Code", sortable: true,
      render: r => <span className="font-mono text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{r.RefWarehouseCode}</span> },
    { key: "WarehouseName", header: "Warehouse", sortable: true, 
      render: r => <span className="font-semibold text-gray-800">{r.WarehouseName}</span>},
    { key: "BinName", header: "Bin Name", sortable: true,
      render: r => r.BinName ? <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-100">{r.BinName}</span> : "â€”" },
    { key: "City", header: "City", render: r => <span className="text-sm">{r.City || "â€”"}</span> },
    { key: "IsFloorWarehouse", header: "Is Floor?", 
      render: r => r.IsFloorWarehouse 
        ? <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">Yes</span> 
        : <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">No</span> },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Warehouse Master</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${data.length} records`}
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Warehouse
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["WarehouseName", "RefWarehouseCode", "BinName", "City"]}
          actions={row => (
            <div className="flex items-center gap-2 justify-end">
              {/* Group records with same RefWarehouseCode for edit so we edit once */}
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteWarehouse(row)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
