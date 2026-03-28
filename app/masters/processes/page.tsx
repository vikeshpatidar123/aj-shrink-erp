"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, Check, List } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { inputCls } from "@/lib/styles";
import { authHeaders } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────
type SelectOpt = { value: string; label: string };

type ProcessRow = {
  id: string;
  ProcessID: string;
  ProcessName: string;
  DisplayProcessName: string;
  DepartmentID: string;
  DepartmentName: string;
  TypeofCharges: string;
  Rate: string;
  MinimumCharges: string;
  SetupCharges: string;
  StartUnit: string;
  EndUnit: string;
  IsDisplay: any;
  IsOnlineProcess: any;
  ProcessCategory: string;
  ProcessWastagePercentage: string;
  ProcessFlatWastageValue: string;
  MinimumQuantityToBeCharged: string;
  PerHourCostingParameter: string;
  ProcessModuleType: string;
  ProcessProductionType: string;
  AllocattedMachineID: string;
};

type MachineRow = {
  MachineID: string;
  MachineName: string;
  DepartmentID: string;
  DepartmentName: string;
  MachineSpeed: number;
  MakeReadyTime: number;
  JobChangeOverTime: number;
  IsDefaultMachine: number;
};

type FormState = {
  ProcessName: string;
  DisplayProcessName: string;
  DepartmentID: string;
  TypeofCharges: string;
  StartUnit: string;
  EndUnit: string;
  Rate: string;
  MinimumCharges: string;
  SetupCharges: string;
  IsDisplay: boolean;
  IsOnlineProcess: boolean;
  ProcessCategory: string;
  ProcessWastagePercentage: string;
  ProcessFlatWastageValue: string;
  MinimumQuantityToBeCharged: string;
  PerHourCostingParameter: string;
  ProcessModuleType: string;
  ProcessProductionType: string;
  selectedMachineIds: string[];
};

const BASE_URL = "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/processmaster`;

function unwrap(v: any): any {
  if (typeof v === "string") { try { return unwrap(JSON.parse(v)); } catch { return v; } }
  return v;
}

const blank: FormState = {
  ProcessName: "",
  DisplayProcessName: "",
  DepartmentID: "",
  TypeofCharges: "",
  StartUnit: "",
  EndUnit: "",
  Rate: "",
  MinimumCharges: "",
  SetupCharges: "",
  IsDisplay: true,
  IsOnlineProcess: true,
  ProcessCategory: "Main Process",
  ProcessWastagePercentage: "",
  ProcessFlatWastageValue: "",
  MinimumQuantityToBeCharged: "",
  PerHourCostingParameter: "",
  ProcessModuleType: "",
  ProcessProductionType: "",
  selectedMachineIds: [],
};

// ─── Helper components ─────────────────────────────────────────
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

const PrefixInput = ({ value, onChange, prefix, placeholder, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-r border-gray-300 font-medium whitespace-nowrap">{prefix}</div>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none" />
  </div>
);

const SuffixInput = ({ value, onChange, suffix, placeholder, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none" />
    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-l border-gray-300 font-medium whitespace-nowrap">{suffix}</div>
  </div>
);

const Checkbox = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
  <label className="flex items-center gap-2.5 cursor-pointer select-none">
    <div onClick={onChange} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}>
      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
    </div>
    <span className="text-sm text-gray-700">{label}</span>
  </label>
);

function toBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || v === "true" || v === "True") return true;
  return false;
}

// ─── Page ──────────────────────────────────────────────────────
export default function ProcessMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<ProcessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingID, setEditingID] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [activeTab, setActiveTab] = useState<"detail" | "costing" | "machines">("detail");
  const [filterDept, setFilterDept] = useState("All");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError] = useState("");

  // Reference data
  const [departments, setDepartments] = useState<SelectOpt[]>([]);
  const [chargeTypes, setChargeTypes] = useState<SelectOpt[]>([]);
  const [units, setUnits] = useState<SelectOpt[]>([]);
  const [allMachines, setAllMachines] = useState<MachineRow[]>([]);

  const f = (k: keyof FormState, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/processmaster`, { headers: authHeaders() });
      const rows: ProcessRow[] = unwrap(await res.json()) ?? [];
      setData(rows);
    } catch { setData([]); }
    setLoading(false);
  }, []);

  const loadRefData = useCallback(async () => {
    try {
      const [dRes, cRes, uRes, mRes] = await Promise.all([
        fetch(`${BASE}/getselectdepartment`, { headers: authHeaders() }),
        fetch(`${BASE}/gettypeofcharges`, { headers: authHeaders() }),
        fetch(`${BASE}/startunit`, { headers: authHeaders() }),
        fetch(`${BASE}/machigrid`, { headers: authHeaders() }),
      ]);
      const depts: any[]  = unwrap(await dRes.json()) ?? [];
      const charges: any[] = unwrap(await cRes.json()) ?? [];
      const unitList: any[] = unwrap(await uRes.json()) ?? [];
      const machines: any[] = unwrap(await mRes.json()) ?? [];
      setDepartments(depts.map(d => ({ value: String(d.DepartmentID), label: d.DepartmentName })));
      // TypeofCharges in DB stores the text value, not the ID
      setChargeTypes(charges.map(c => ({ value: c.TypeOfCharges, label: c.TypeOfCharges })));
      setUnits(unitList.map(u => ({ value: u.UnitSymbol, label: u.UnitName || u.UnitSymbol })));
      setAllMachines(machines);
    } catch {}
  }, []);

  useEffect(() => { loadData(); loadRefData(); }, [loadData, loadRefData]);

  const openAdd = () => {
    setEditingID(null);
    setForm(blank);
    setActiveTab("detail");
    setSubmitAttempted(false);
    setError("");
    setView("form");
  };

  const openEdit = (row: ProcessRow) => {
    setEditingID(row.ProcessID);
    const machineIds = row.AllocattedMachineID
      ? row.AllocattedMachineID.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    setForm({
      ProcessName: row.ProcessName ?? "",
      DisplayProcessName: row.DisplayProcessName ?? "",
      DepartmentID: String(row.DepartmentID ?? ""),
      TypeofCharges: row.TypeofCharges ?? "",
      StartUnit: row.StartUnit ?? "",
      EndUnit: row.EndUnit ?? "",
      Rate: row.Rate ? String(row.Rate) : "",
      MinimumCharges: row.MinimumCharges ? String(row.MinimumCharges) : "",
      SetupCharges: row.SetupCharges ? String(row.SetupCharges) : "",
      IsDisplay: toBool(row.IsDisplay),
      IsOnlineProcess: toBool(row.IsOnlineProcess),
      ProcessCategory: row.ProcessCategory ?? "Main Process",
      ProcessWastagePercentage: row.ProcessWastagePercentage ? String(row.ProcessWastagePercentage) : "",
      ProcessFlatWastageValue: row.ProcessFlatWastageValue ? String(row.ProcessFlatWastageValue) : "",
      MinimumQuantityToBeCharged: row.MinimumQuantityToBeCharged ? String(row.MinimumQuantityToBeCharged) : "",
      PerHourCostingParameter: row.PerHourCostingParameter ?? "",
      ProcessModuleType: row.ProcessModuleType ?? "",
      ProcessProductionType: row.ProcessProductionType ?? "",
      selectedMachineIds: machineIds,
    });
    setActiveTab("detail");
    setView("form");
  };

  const toggleMachine = (id: string) =>
    setForm((p) => ({
      ...p,
      selectedMachineIds: p.selectedMachineIds.includes(id)
        ? p.selectedMachineIds.filter(m => m !== id)
        : [...p.selectedMachineIds, id],
    }));

  const save = async () => {
    setSubmitAttempted(true);
    setError("");
    if (!form.ProcessName.trim()) { setError("Process Name is required."); return; }
    setSaving(true);
    try {
      const { selectedMachineIds, ...fields } = form;

      // CostingDataProcessDetailMaster — exclude AddColName fields:
      // ModifiedDate, CreatedDate, UserID, CompanyID, FYear, CreatedBy, ModifiedBy,
      // AllocatedContentID, AllocattedMachineID, ProductionUnitID
      const detail: Record<string, any> = {
        ProcessName: fields.ProcessName || null,
        DisplayProcessName: fields.DisplayProcessName || null,
        DepartmentID: fields.DepartmentID ? Number(fields.DepartmentID) : null,
        TypeofCharges: fields.TypeofCharges || null,
        StartUnit: fields.StartUnit || null,
        EndUnit: fields.EndUnit || null,
        Rate: fields.Rate !== "" ? Number(fields.Rate) : null,
        MinimumCharges: fields.MinimumCharges !== "" ? Number(fields.MinimumCharges) : null,
        SetupCharges: fields.SetupCharges !== "" ? Number(fields.SetupCharges) : null,
        IsDisplay: fields.IsDisplay ? 1 : 0,
        IsOnlineProcess: fields.IsOnlineProcess ? 1 : 0,
        ProcessCategory: fields.ProcessCategory || null,
        ProcessWastagePercentage: fields.ProcessWastagePercentage !== "" ? Number(fields.ProcessWastagePercentage) : null,
        ProcessFlatWastageValue: fields.ProcessFlatWastageValue !== "" ? Number(fields.ProcessFlatWastageValue) : null,
        MinimumQuantityToBeCharged: fields.MinimumQuantityToBeCharged !== "" ? Number(fields.MinimumQuantityToBeCharged) : null,
        PerHourCostingParameter: fields.PerHourCostingParameter || null,
        ProcessModuleType: fields.ProcessModuleType || null,
        ProcessProductionType: fields.ProcessProductionType || null,
      };

      // Build machine allocation rows from selected machines
      const machineAllocData = selectedMachineIds.map(id => {
        const m = allMachines.find(x => String(x.MachineID) === id);
        return {
          MachineID: id,
          MachineSpeed: m?.MachineSpeed ?? 0,
          MakeReadyTime: m?.MakeReadyTime ?? 0,
          JobChangeOverTime: m?.JobChangeOverTime ?? 0,
          IsDefaultMachine: m?.IsDefaultMachine ?? 0,
        };
      });

      const payload: any = {
        CostingDataProcessDetailMaster: [detail],
        CostingDataMachinAllocation: machineAllocData,
        CostingDataSlab: [],
        ProcessName: form.ProcessName,
        AllocattedMachineID: selectedMachineIds.join(","),
        ObjMachineSlab: [],
        CoatingRates: [],
        finalStringContent: "",
        CostingProcessInspectionParameter: [],
        CostingLineClearanceParameter: [],
        ProcessToolGroupData: [],
        CostingDataMaterialAllocation: [],
      };

      const url = editingID
        ? `${BASE}/updateprocessmasterdata`
        : `${BASE}/saveprocessmasterdata`;
      if (editingID) payload.ProcessID = editingID;

      const res = await fetch(url, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = unwrap(await res.json());
      if (result === "Success") {
        await loadData();
        setView("list");
      } else if (result === "Exist") {
        setError("A process with this name already exists.");
      } else {
        setError("Save failed: " + result);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setSaving(false);
  };

  const deleteRow = async (ProcessID: string) => {
    if (!confirm("Delete this process?")) return;
    try {
      const res = await fetch(`${BASE}/deleteprocessmasterdata/${ProcessID}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const result = unwrap(await res.json());
      if (result === "Success") await loadData();
      else alert("Delete failed: " + result);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // Machines filtered by selected department
  const deptMachines = allMachines.filter(m => String(m.DepartmentID) === form.DepartmentID);
  const selectedDeptName = departments.find(d => d.value === form.DepartmentID)?.label ?? "";

  // ── FORM VIEW ───────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
            <h2 className="text-xl font-bold text-gray-800">Process Master</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <List size={16} /> List ({data.length})
            </button>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
              <Plus size={16} /> New
            </button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60">
              <Save size={16} /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 pt-5 border-b border-gray-200 bg-gray-50/30">
            {editingID && (
              <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                ID: {editingID}
              </span>
            )}
            <div className="flex gap-8">
              {(["detail", "costing", "machines"] as const).map((t) => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === t ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
                  {{ detail: "Process Detail", costing: "Costing", machines: "Machine Allocation" }[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8">

            {/* ── PROCESS DETAIL TAB ── */}
            {activeTab === "detail" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                <div>
                  <SectionTitle title="Process Identity" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Process Name" required>
                      <input type="text" value={form.ProcessName} onChange={(e) => f("ProcessName", e.target.value)} placeholder="e.g. 8-Color Roto Printing" className={submitAttempted && !form.ProcessName.trim() ? inputCls.replace("border-gray-300", "border-red-400 bg-red-50/50") : inputCls} />
                    </Field>
                    <Field label="Display Name">
                      <input type="text" value={form.DisplayProcessName} onChange={(e) => f("DisplayProcessName", e.target.value)} placeholder="Short display name" className={inputCls} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Classification" />
                  <div className="space-y-5">

                    {/* Module toggle */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Module</label>
                      <div className="flex gap-3 flex-wrap">
                        {(["Rotogravure", "Extrusion", ""] as const).map((mod, i) => (
                          <button key={i} onClick={() => f("ProcessModuleType", mod)}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                              form.ProcessModuleType === mod
                                ? mod === "Rotogravure" ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                  : mod === "Extrusion" ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                                  : "bg-gray-600 text-white border-gray-600 shadow-sm"
                                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}>
                            {mod || "None"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Department pills */}
                    <div>
                      <label className={"text-xs font-semibold uppercase tracking-wider mb-3 block " + (submitAttempted && !form.DepartmentID ? "text-red-500" : "text-gray-500")}>
                        Department <span className="text-red-500">*</span>
                      </label>
                      {departments.length === 0 ? (
                        <p className="text-sm text-gray-400">Loading departments...</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {departments.map((d) => (
                            <button key={d.value} onClick={() => f("DepartmentID", d.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                form.DepartmentID === d.value
                                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"}`}>
                              {d.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="Process Category">
                        <select value={form.ProcessCategory} onChange={(e) => f("ProcessCategory", e.target.value)} className={inputCls}>
                          <option value="">Select...</option>
                          {["Main Process", "Sub Process"].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </Field>
                      <Field label="Production Type">
                        <select value={form.ProcessProductionType} onChange={(e) => f("ProcessProductionType", e.target.value)} className={inputCls}>
                          <option value="">Select...</option>
                          {["None", "Printing", "Lamination", "Extrusion", "Slitting", "Pouch"].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Settings" />
                  <div className="flex flex-wrap gap-8">
                    <Checkbox checked={form.IsOnlineProcess} onChange={() => f("IsOnlineProcess", !form.IsOnlineProcess)} label="Online Production Process" />
                    <Checkbox checked={form.IsDisplay} onChange={() => f("IsDisplay", !form.IsDisplay)} label="Display in Quotation" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <button onClick={() => setActiveTab("costing")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors shadow-sm">Costing →</button>
                </div>
              </div>
            )}

            {/* ── COSTING TAB ── */}
            {activeTab === "costing" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                <div className="flex gap-2 flex-wrap">
                  {form.ProcessModuleType && (
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${form.ProcessModuleType === "Rotogravure" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                      {form.ProcessModuleType}
                    </span>
                  )}
                  {selectedDeptName && (
                    <span className="px-3 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-full">{selectedDeptName}</span>
                  )}
                  {form.ProcessCategory && (
                    <span className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full">{form.ProcessCategory}</span>
                  )}
                </div>

                <div>
                  <SectionTitle title="Rate Setup" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Type of Charges">
                      <select value={form.TypeofCharges} onChange={(e) => f("TypeofCharges", e.target.value)} className={inputCls}>
                        <option value="">Select...</option>
                        {chargeTypes.map((c, i) => <option key={`${i}-${c.value}`} value={c.value}>{c.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Start Unit">
                      <select value={form.StartUnit} onChange={(e) => f("StartUnit", e.target.value)} className={inputCls}>
                        <option value="">Select...</option>
                        {units.map((u, i) => <option key={`${i}-${u.value}`} value={u.value}>{u.label}</option>)}
                      </select>
                    </Field>
                    <Field label="End Unit">
                      <select value={form.EndUnit} onChange={(e) => f("EndUnit", e.target.value)} className={inputCls}>
                        <option value="">Select...</option>
                        {units.map((u, i) => <option key={`${i}-${u.value}`} value={u.value}>{u.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Rate (₹)">
                      <PrefixInput value={form.Rate} onChange={(e: any) => f("Rate", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
                    </Field>
                    <Field label="Minimum Charges (₹)">
                      <PrefixInput value={form.MinimumCharges} onChange={(e: any) => f("MinimumCharges", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
                    </Field>
                    <Field label="Setup Charges (₹)">
                      <PrefixInput value={form.SetupCharges} onChange={(e: any) => f("SetupCharges", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
                    </Field>
                    <Field label="Min. Qty To Be Charged">
                      <input type="number" value={form.MinimumQuantityToBeCharged} onChange={(e) => f("MinimumQuantityToBeCharged", e.target.value)} placeholder="e.g. 100" className={inputCls} />
                    </Field>
                    <Field label="Per Hour Costing Parameter">
                      <input type="text" value={form.PerHourCostingParameter} onChange={(e) => f("PerHourCostingParameter", e.target.value)} placeholder="" className={inputCls} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Waste" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Process Waste %">
                      <SuffixInput value={form.ProcessWastagePercentage} onChange={(e: any) => f("ProcessWastagePercentage", e.target.value)} suffix="%" placeholder="e.g. 3" type="number" />
                    </Field>
                    <Field label="Process Waste Flat (₹)">
                      <PrefixInput value={form.ProcessFlatWastageValue} onChange={(e: any) => f("ProcessFlatWastageValue", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
                    </Field>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab("detail")} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">← Detail</button>
                    <button onClick={() => setActiveTab("machines")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors shadow-sm">Machines →</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── MACHINE ALLOCATION TAB ── */}
            {activeTab === "machines" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <SectionTitle title={`Machines – ${selectedDeptName || "Select Department First"}`} />
                  {!form.DepartmentID ? (
                    <div className="flex items-center justify-center py-12 text-sm text-gray-400 italic border-2 border-dashed border-gray-200 rounded-xl">
                      Please select a department in the Process Detail tab first.
                    </div>
                  ) : deptMachines.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-sm text-gray-400 italic border-2 border-dashed border-gray-200 rounded-xl">
                      No machines registered under &quot;{selectedDeptName}&quot;. Add machines in Machine Master first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {deptMachines.map((m) => {
                        const selected = form.selectedMachineIds.includes(String(m.MachineID));
                        return (
                          <div key={m.MachineID} onClick={() => toggleMachine(String(m.MachineID))}
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}>
                              {selected && <Check size={11} className="text-white" strokeWidth={3} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800">{m.MachineName}</p>
                              <p className="text-xs text-gray-500">
                                Speed: {m.MachineSpeed} · Make-Ready: {m.MakeReadyTime}min · Job Changeover: {m.JobChangeOverTime}min
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {form.selectedMachineIds.length > 0 && (
                    <p className="text-xs text-blue-600 font-medium mt-4">
                      {form.selectedMachineIds.length} machine{form.selectedMachineIds.length > 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab("costing")} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">← Costing</button>
                    <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60">
                      <Check size={16} /> {saving ? "Saving..." : "Save Process"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────
  // Dept filter pills built from actual data (deduplicated)
  const deptNames = Array.from(new Set(data.map(r => r.DepartmentName).filter(Boolean)));

  const filteredData = filterDept === "All" ? data : data.filter(r => r.DepartmentName === filterDept);

  const columns: Column<ProcessRow>[] = [
    { key: "ProcessName", header: "Process Name", sortable: true },
    { key: "DisplayProcessName", header: "Display Name", render: (r) => r.DisplayProcessName || <span className="text-gray-400">—</span> },
    {
      key: "DepartmentName", header: "Department", sortable: true,
      render: (r) => <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{r.DepartmentName}</span>,
    },
    {
      key: "ProcessModuleType", header: "Module",
      render: (r) => r.ProcessModuleType
        ? <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${r.ProcessModuleType === "Rotogravure" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>{r.ProcessModuleType === "Rotogravure" ? "Roto" : r.ProcessModuleType}</span>
        : <span className="text-gray-400">—</span>,
    },
    { key: "TypeofCharges", header: "Charge Type", render: (r) => r.TypeofCharges || <span className="text-gray-400">—</span> },
    { key: "Rate", header: "Rate", render: (r) => r.Rate ? `₹ ${r.Rate}` : "—" },
    { key: "ProcessWastagePercentage", header: "Waste %", render: (r) => r.ProcessWastagePercentage ? `${r.ProcessWastagePercentage}%` : "—" },
    {
      key: "IsDisplay", header: "In Quotation",
      render: (r) => <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${toBool(r.IsDisplay) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{toBool(r.IsDisplay) ? "Yes" : "No"}</span>,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Process Master</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${filteredData.length} of ${data.length} processes`}
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Process
        </button>
      </div>

      {/* Department filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Dept</span>
          <button onClick={() => setFilterDept("All")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterDept === "All" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            All
          </button>
          {deptNames.map((d) => (
            <button key={d} onClick={() => setFilterDept(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterDept === d ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={filteredData}
          columns={columns}
          searchKeys={["ProcessName", "DisplayProcessName", "DepartmentName"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteRow(row.ProcessID)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
