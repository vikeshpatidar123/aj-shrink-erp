"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, Check, List, X } from "lucide-react";
import { getCompanyName } from "@/lib/useCompanyName";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { inputCls } from "@/lib/styles";
import { authHeaders } from "@/lib/auth";
import { usePermissions } from "@/context/PermissionsContext";

// --- Types ------------------------------------------------------------------
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
  ToolRequired: any;
  IsEditToBeProduceQty: any;
  ProcessPurpose: string;
  SizeToBeConsidered: string;
  ChargeApplyOnSheets: string;
  PrePress: string;
  UnitConversion: string;
  ProductionTolerancePercentage: string;
  DryingTime: string;
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

type SlabRow = {
  FromQty: string;
  ToQty: string;
  StartUnit: string;
  RateFactor: string;
  Rate: string;
  MinimumCharges: string;
};

type ParamRow = {
  ParameterName: string;
  StandardValue: string;
  DefaultValue: string;
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
  IsEditToBeProduceQty: boolean;
  ProcessCategory: string;
  ProcessWastagePercentage: string;
  ProcessFlatWastageValue: string;
  ProductionTolerancePercentage: string;
  DryingTime: string;
  MinimumQuantityToBeCharged: string;
  PerHourCostingParameter: string;
  ProcessModuleType: string;
  ProcessProductionType: string;
  ProcessPurpose: string;
  SizeToBeConsidered: string;
  ChargeApplyOnSheets: string;
  PrePress: string;
  UnitConversion: string;
  selectedMachineIds: string[];
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const BASE = `${BASE_URL}/api/processmasterShrink`;

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
  IsEditToBeProduceQty: false,
  ProcessCategory: "Main Process",
  ProcessWastagePercentage: "",
  ProcessFlatWastageValue: "",
  ProductionTolerancePercentage: "",
  DryingTime: "",
  MinimumQuantityToBeCharged: "",
  PerHourCostingParameter: "",
  ProcessModuleType: "Rotogravure",
  ProcessProductionType: "None",
  ProcessPurpose: "",
  SizeToBeConsidered: "",
  ChargeApplyOnSheets: "",
  PrePress: "",
  UnitConversion: "",
  selectedMachineIds: [],
};

// --- Helper components --------------------------------------------------------
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

const ToggleField = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3 cursor-pointer">
    <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? "bg-blue-500" : "bg-gray-300"}`}>
      <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`} />
    </div>
    <span className="text-sm font-medium text-gray-700">{label}</span>
  </button>
);

function toBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || v === "true" || v === "True") return true;
  return false;
}

const blankSlab: SlabRow = { FromQty: "", ToQty: "", StartUnit: "", RateFactor: "", Rate: "", MinimumCharges: "" };
const blankParam: ParamRow = { ParameterName: "", StandardValue: "", DefaultValue: "" };

// --- Page ----------------------------------------------------------------------
export default function ProcessMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<ProcessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingID, setEditingID] = useState<string | null>(null);
  const { can } = usePermissions();
  const [form, setForm] = useState<FormState>(blank);
  const [activeTab, setActiveTab] = useState<"detail" | "machines" | "slabs" | "inspection" | "lineclearance">("detail");
  const [filterDept, setFilterDept] = useState("All");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Reference data
  const [departments, setDepartments] = useState<SelectOpt[]>([]);
  const [chargeTypes, setChargeTypes] = useState<SelectOpt[]>([]);
  const [units, setUnits] = useState<SelectOpt[]>([]);
  const [allMachines, setAllMachines] = useState<MachineRow[]>([]);

  // Child data — round-tripped on edit so save/update never wipes them out
  const [slabs, setSlabs] = useState<SlabRow[]>([]);
  const [inspectionParams, setInspectionParams] = useState<ParamRow[]>([]);
  const [lineClearanceParams, setLineClearanceParams] = useState<ParamRow[]>([]);

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
      const depts: any[] = unwrap(await dRes.json()) ?? [];
      const charges: any[] = unwrap(await cRes.json()) ?? [];
      const unitList: any[] = unwrap(await uRes.json()) ?? [];
      const machines: any[] = unwrap(await mRes.json()) ?? [];
      setDepartments(depts.map(d => ({ value: String(d.DepartmentID), label: d.DepartmentName })));
      setChargeTypes(charges.map(c => ({ value: c.TypeOfCharges, label: c.TypeOfCharges })));
      setUnits(unitList.map(u => ({ value: u.UnitSymbol, label: u.UnitName || u.UnitSymbol })));
      setAllMachines(machines);
    } catch {}
  }, []);

  useEffect(() => { loadData(); loadRefData(); }, [loadData, loadRefData]);

  const resetChildData = () => {
    setSlabs([]);
    setInspectionParams([]);
    setLineClearanceParams([]);
  };

  const openAdd = () => {
    setEditingID(null);
    setForm(blank);
    resetChildData();
    setActiveTab("detail");
    setSubmitAttempted(false);
    setError("");
    setView("form");
  };

  const openEdit = async (row: ProcessRow) => {
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
      IsEditToBeProduceQty: toBool(row.IsEditToBeProduceQty),
      ProcessCategory: row.ProcessCategory ?? "Main Process",
      ProcessWastagePercentage: row.ProcessWastagePercentage ? String(row.ProcessWastagePercentage) : "",
      ProcessFlatWastageValue: row.ProcessFlatWastageValue ? String(row.ProcessFlatWastageValue) : "",
      ProductionTolerancePercentage: row.ProductionTolerancePercentage ? String(row.ProductionTolerancePercentage) : "",
      DryingTime: row.DryingTime ? String(row.DryingTime) : "",
      MinimumQuantityToBeCharged: row.MinimumQuantityToBeCharged ? String(row.MinimumQuantityToBeCharged) : "",
      PerHourCostingParameter: row.PerHourCostingParameter ?? "",
      ProcessModuleType: row.ProcessModuleType ?? "Rotogravure",
      ProcessProductionType: row.ProcessProductionType ?? "None",
      ProcessPurpose: row.ProcessPurpose ?? "",
      SizeToBeConsidered: row.SizeToBeConsidered ?? "",
      ChargeApplyOnSheets: row.ChargeApplyOnSheets ?? "",
      PrePress: row.PrePress ?? "",
      UnitConversion: row.UnitConversion ?? "",
      selectedMachineIds: machineIds,
    });
    resetChildData();
    setActiveTab("detail");
    setView("form");
    setFormLoading(true);
    try {
      const [slabRes, inspRes, lineRes] = await Promise.all([
        fetch(`${BASE}/existslab/${row.ProcessID}`, { headers: authHeaders() }),
        fetch(`${BASE}/loadprocessinspectionparameter?ProcessID=${row.ProcessID}`, { headers: authHeaders() }),
        fetch(`${BASE}/loadlineclearanceparameter?ProcessID=${row.ProcessID}`, { headers: authHeaders() }),
      ]);
      const slabData: any[] = unwrap(await slabRes.json()) ?? [];
      const inspData: any[] = unwrap(await inspRes.json()) ?? [];
      const lineData: any[] = unwrap(await lineRes.json()) ?? [];

      setSlabs((Array.isArray(slabData) ? slabData : []).map((s: any) => ({
        FromQty: s.FromQty != null ? String(s.FromQty) : "",
        ToQty: s.ToQty != null ? String(s.ToQty) : "",
        StartUnit: s.StartUnit ?? "",
        RateFactor: s.RateFactor ?? "",
        Rate: s.Rate != null ? String(s.Rate) : "",
        MinimumCharges: s.MinimumCharges != null ? String(s.MinimumCharges) : "",
      })));
      setInspectionParams((Array.isArray(inspData) ? inspData : []).map((p: any) => ({
        ParameterName: p.ParameterName ?? "", StandardValue: p.StandardValue ?? "", DefaultValue: p.DefaultValue ?? "",
      })));
      setLineClearanceParams((Array.isArray(lineData) ? lineData : []).map((p: any) => ({
        ParameterName: p.ParameterName ?? "", StandardValue: p.StandardValue ?? "", DefaultValue: p.DefaultValue ?? "",
      })));
    } catch { /* leave child data empty rather than block editing */ }
    setFormLoading(false);
  };

  const toggleMachine = (id: string) =>
    setForm((p) => ({
      ...p,
      selectedMachineIds: p.selectedMachineIds.includes(id)
        ? p.selectedMachineIds.filter(m => m !== id)
        : [...p.selectedMachineIds, id],
    }));

  const addSlab = () => setSlabs((p) => [...p, { ...blankSlab }]);
  const updateSlab = (i: number, k: keyof SlabRow, v: string) =>
    setSlabs((p) => p.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const removeSlab = (i: number) => setSlabs((p) => p.filter((_, idx) => idx !== i));

  const addParam = (list: "inspection" | "lineclearance") => {
    if (list === "inspection") setInspectionParams((p) => [...p, { ...blankParam }]);
    else setLineClearanceParams((p) => [...p, { ...blankParam }]);
  };
  const updateParam = (list: "inspection" | "lineclearance", i: number, k: keyof ParamRow, v: string) => {
    const setter = list === "inspection" ? setInspectionParams : setLineClearanceParams;
    setter((p) => p.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  };
  const removeParam = (list: "inspection" | "lineclearance", i: number) => {
    const setter = list === "inspection" ? setInspectionParams : setLineClearanceParams;
    setter((p) => p.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!can("/master/process", editingID ? "CanEdit" : "CanSave")) {
      alert(editingID ? "You are not authorized to edit Process Master." : "You are not authorized to save Process Master.");
      return;
    }
    setSubmitAttempted(true);
    setError("");
    if (!form.ProcessName.trim()) { setError("Process Name is required."); return; }
    if (!form.DepartmentID) { setError("Department is required."); return; }
    setSaving(true);
    try {
      const { selectedMachineIds, ...fields } = form;

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
        IsEditToBeProduceQty: fields.IsEditToBeProduceQty ? 1 : 0,
        // Tool (cylinder) allocation is always relevant for a rotogravure-only shop -- no longer
        // a per-process toggle.
        ToolRequired: 1,
        ProcessCategory: fields.ProcessCategory || null,
        ProcessWastagePercentage: fields.ProcessWastagePercentage !== "" ? Number(fields.ProcessWastagePercentage) : null,
        ProcessFlatWastageValue: fields.ProcessFlatWastageValue !== "" ? Number(fields.ProcessFlatWastageValue) : null,
        ProductionTolerancePercentage: fields.ProductionTolerancePercentage !== "" ? Number(fields.ProductionTolerancePercentage) : null,
        DryingTime: fields.DryingTime !== "" ? Number(fields.DryingTime) : null,
        MinimumQuantityToBeCharged: fields.MinimumQuantityToBeCharged !== "" ? Number(fields.MinimumQuantityToBeCharged) : null,
        PerHourCostingParameter: fields.PerHourCostingParameter || null,
        ProcessModuleType: fields.ProcessModuleType || null,
        ProcessProductionType: fields.ProcessProductionType || null,
        ProcessPurpose: fields.ProcessPurpose || null,
        SizeToBeConsidered: fields.SizeToBeConsidered || null,
        ChargeApplyOnSheets: fields.ChargeApplyOnSheets || null,
        PrePress: fields.PrePress || null,
        UnitConversion: fields.UnitConversion || null,
      };

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

      // Only send well-formed slab rows -- an in-progress blank row a user added but never
      // filled in should be dropped silently rather than saved as garbage/zeros.
      const slabData = slabs
        .filter(s => s.FromQty !== "" || s.ToQty !== "" || s.Rate !== "")
        .map(s => ({
          FromQty: s.FromQty !== "" ? Number(s.FromQty) : 0,
          ToQty: s.ToQty !== "" ? Number(s.ToQty) : 0,
          StartUnit: s.StartUnit || null,
          RateFactor: s.RateFactor || null,
          Rate: s.Rate !== "" ? Number(s.Rate) : 0,
          MinimumCharges: s.MinimumCharges !== "" ? Number(s.MinimumCharges) : 0,
        }));

      const inspectionData = inspectionParams
        .filter(p => p.ParameterName.trim() !== "")
        .map(p => ({ ParameterName: p.ParameterName, StandardValue: p.StandardValue || null, DefaultValue: p.DefaultValue || null }));
      const lineClearanceData = lineClearanceParams
        .filter(p => p.ParameterName.trim() !== "")
        .map(p => ({ ParameterName: p.ParameterName, StandardValue: p.StandardValue || null, DefaultValue: p.DefaultValue || null }));

      const payload: any = {
        CostingDataProcessDetailMaster: [detail],
        CostingDataMachinAllocation: machineAllocData,
        CostingDataSlab: slabData,
        ProcessName: form.ProcessName,
        AllocattedMachineID: selectedMachineIds.join(","),
        ObjMachineSlab: [],
        CoatingRates: [],
        finalStringContent: "",
        CostingProcessInspectionParameter: inspectionData,
        CostingLineClearanceParameter: lineClearanceData,
        // Tool Group Allocation and Material Allocation removed from this form -- backend no
        // longer touches either table on save/update, so empty arrays here are a no-op, not data loss.
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
    if (!can("/master/process", "CanDelete")) { alert("You are not authorized to delete Process Master."); return; }
    if (!confirm("Delete this process?")) return;
    try {
      const res = await fetch(`${BASE}/deleteprocessmasterdata/${ProcessID}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const result = unwrap(await res.json());
      if (result === "Success") await loadData();
      else alert(result);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const deptMachines = allMachines.filter(m => String(m.DepartmentID) === form.DepartmentID);
  const selectedDeptName = departments.find(d => d.value === form.DepartmentID)?.label ?? "";

  type TabKey = "detail" | "machines" | "slabs" | "inspection" | "lineclearance";
  const tabs: { key: TabKey; label: string }[] = [
    { key: "detail", label: "Process Detail" },
    { key: "machines", label: "Machine Allocation" },
    { key: "slabs", label: "Slabs" },
    { key: "inspection", label: "Inspection Parameters" },
    { key: "lineclearance", label: "Line Clearance" },
  ];

  // -- FORM VIEW ------------------------------------------------------------
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{getCompanyName("Company")}</p>
            <h2 className="text-xl font-bold text-gray-800">Process Master</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <List size={16} /> List ({data.length})
            </button>

            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60">
              <Save size={16} /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 pt-5 border-b border-gray-200 bg-gray-50/30">
            {editingID && (
              <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">
                ID: {editingID}
              </span>
            )}
            <div className="flex gap-8 flex-wrap">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === t.key ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8">
            {formLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading process data...</div>
            ) : (
              <>
                {/* -- PROCESS DETAIL TAB -- */}
                {activeTab === "detail" && (
                  <div className="space-y-8">
                    <div>
                      <SectionTitle title="Process Identity" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Field label="Process Name" required>
                          <input type="text" value={form.ProcessName} onChange={(e) => f("ProcessName", e.target.value)}
                            placeholder="e.g. 8-Color Roto Printing"
                            className={submitAttempted && !form.ProcessName.trim() ? inputCls.replace("border-gray-300", "border-red-400 bg-red-50/50") : inputCls} />
                        </Field>
                        <Field label="Display Name">
                          <input type="text" value={form.DisplayProcessName} onChange={(e) => f("DisplayProcessName", e.target.value)} className={inputCls} />
                        </Field>
                      </div>
                    </div>

                    <div className="max-w-sm">
                      <Field label="Department" required>
                        <select value={form.DepartmentID} onChange={(e) => f("DepartmentID", e.target.value)}
                          className={submitAttempted && !form.DepartmentID ? inputCls.replace("border-gray-300", "border-red-400 bg-red-50/50") : inputCls}>
                          <option value="">{departments.length === 0 ? "Loading departments..." : "Select..."}</option>
                          {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                      </Field>
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
                      </div>
                    </div>

                    <div>
                      <SectionTitle title="Waste &amp; Tolerance" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Field label="Process Waste %">
                          <SuffixInput value={form.ProcessWastagePercentage} onChange={(e: any) => f("ProcessWastagePercentage", e.target.value)} suffix="%" placeholder="e.g. 3" type="number" />
                        </Field>
                        <Field label="Process Waste Flat (₹)">
                          <PrefixInput value={form.ProcessFlatWastageValue} onChange={(e: any) => f("ProcessFlatWastageValue", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
                        </Field>
                        <Field label="Production Tolerance %">
                          <SuffixInput value={form.ProductionTolerancePercentage} onChange={(e: any) => f("ProductionTolerancePercentage", e.target.value)} suffix="%" placeholder="e.g. 2" type="number" />
                        </Field>
                        <Field label="Drying / Curing Time (min)">
                          <input type="number" value={form.DryingTime} onChange={(e) => f("DryingTime", e.target.value)} className={inputCls} />
                        </Field>
                      </div>
                    </div>

                    <div>
                      <SectionTitle title="Flags" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ToggleField label="Is Online Production Process" checked={form.IsOnlineProcess} onChange={(v) => f("IsOnlineProcess", v)} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                      <button onClick={() => { setForm(blank); resetChildData(); }} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                      <button onClick={() => setActiveTab("machines")} className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Machine Allocation →</button>
                    </div>
                  </div>
                )}

                {/* -- MACHINE ALLOCATION TAB -- */}
                {activeTab === "machines" && (
                  <div className="space-y-8">
                    <div>
                      <SectionTitle title={`Machines — ${selectedDeptName || "Select Department First"}`} />
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
                  </div>
                )}

                {/* -- SLABS TAB -- */}
                {activeTab === "slabs" && (
                  <div className="space-y-6">
                    <SectionTitle title="Quantity Slabs" />
                    <p className="text-xs text-gray-500 -mt-4">Rate tiers by quantity range — e.g. 0–1000 units at one rate, 1000+ at another.</p>
                    <div className="space-y-3">
                      {slabs.map((s, i) => (
                        <div key={i} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end bg-gray-50/60 border border-gray-200 rounded-xl p-3">
                          <Field label="From Qty">
                            <input type="number" value={s.FromQty} onChange={(e) => updateSlab(i, "FromQty", e.target.value)} className={inputCls} />
                          </Field>
                          <Field label="To Qty">
                            <input type="number" value={s.ToQty} onChange={(e) => updateSlab(i, "ToQty", e.target.value)} className={inputCls} />
                          </Field>
                          <Field label="Unit">
                            <select value={s.StartUnit} onChange={(e) => updateSlab(i, "StartUnit", e.target.value)} className={inputCls}>
                              <option value="">Select...</option>
                              {units.map((u, ui) => <option key={`${ui}-${u.value}`} value={u.value}>{u.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Factor">
                            <input type="text" value={s.RateFactor} onChange={(e) => updateSlab(i, "RateFactor", e.target.value)} className={inputCls} />
                          </Field>
                          <Field label="Rate (₹)">
                            <input type="number" value={s.Rate} onChange={(e) => updateSlab(i, "Rate", e.target.value)} className={inputCls} />
                          </Field>
                          <div className="flex items-end gap-2">
                            <Field label="Min. Charge (₹)">
                              <input type="number" value={s.MinimumCharges} onChange={(e) => updateSlab(i, "MinimumCharges", e.target.value)} className={inputCls} />
                            </Field>
                            <button onClick={() => removeSlab(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"><X size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={addSlab} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                      <Plus size={14} /> Add Slab
                    </button>
                  </div>
                )}

                {/* -- INSPECTION PARAMETERS TAB -- */}
                {activeTab === "inspection" && (
                  <div className="space-y-6">
                    <SectionTitle title="Process Inspection Parameters" />
                    <p className="text-xs text-gray-500 -mt-4">QC checks to perform for this process (e.g. Print Registration, Colour Density).</p>
                    <div className="space-y-3">
                      {inspectionParams.map((p, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-gray-50/60 border border-gray-200 rounded-xl p-3">
                          <Field label="Parameter Name">
                            <input type="text" value={p.ParameterName} onChange={(e) => updateParam("inspection", i, "ParameterName", e.target.value)} className={inputCls} />
                          </Field>
                          <Field label="Standard Value">
                            <input type="text" value={p.StandardValue} onChange={(e) => updateParam("inspection", i, "StandardValue", e.target.value)} className={inputCls} />
                          </Field>
                          <div className="flex items-end gap-2">
                            <Field label="Default Value">
                              <input type="text" value={p.DefaultValue} onChange={(e) => updateParam("inspection", i, "DefaultValue", e.target.value)} className={inputCls} />
                            </Field>
                            <button onClick={() => removeParam("inspection", i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"><X size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => addParam("inspection")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                      <Plus size={14} /> Add Parameter
                    </button>
                  </div>
                )}

                {/* -- LINE CLEARANCE TAB -- */}
                {activeTab === "lineclearance" && (
                  <div className="space-y-6">
                    <SectionTitle title="Line Clearance Parameters" />
                    <p className="text-xs text-gray-500 -mt-4">Checks required before this process's line can start a new job.</p>
                    <div className="space-y-3">
                      {lineClearanceParams.map((p, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-gray-50/60 border border-gray-200 rounded-xl p-3">
                          <Field label="Parameter Name">
                            <input type="text" value={p.ParameterName} onChange={(e) => updateParam("lineclearance", i, "ParameterName", e.target.value)} className={inputCls} />
                          </Field>
                          <Field label="Standard Value">
                            <input type="text" value={p.StandardValue} onChange={(e) => updateParam("lineclearance", i, "StandardValue", e.target.value)} className={inputCls} />
                          </Field>
                          <div className="flex items-end gap-2">
                            <Field label="Default Value">
                              <input type="text" value={p.DefaultValue} onChange={(e) => updateParam("lineclearance", i, "DefaultValue", e.target.value)} className={inputCls} />
                            </Field>
                            <button onClick={() => removeParam("lineclearance", i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"><X size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => addParam("lineclearance")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                      <Plus size={14} /> Add Parameter
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between pt-6 mt-8 border-t border-gray-200">
                  <button onClick={() => { setForm(blank); resetChildData(); }} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60">
                    <Check size={16} /> {saving ? "Saving..." : "Save Process"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -- LIST VIEW ------------------------------------------------------------
  const deptNames = Array.from(new Set(data.map(r => r.DepartmentName).filter(Boolean)));
  const filteredData = filterDept === "All" ? data : data.filter(r => r.DepartmentName === filterDept);

  const columns: Column<ProcessRow>[] = [
    { key: "ProcessName", header: "Process Name", sortable: true },
    { key: "DisplayProcessName", header: "Display Name", render: (r) => r.DisplayProcessName || <span className="text-gray-400">—</span> },
    {
      key: "DepartmentName", header: "Department", sortable: true,
      render: (r) => r.DepartmentName
        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{r.DepartmentName}</span>
        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-500">No department</span>,
    },
    { key: "TypeofCharges", header: "Charge Type", render: (r) => r.TypeofCharges || <span className="text-gray-400">—</span> },
    { key: "Rate", header: "Rate", render: (r) => r.Rate ? `₹ ${r.Rate}` : "—" },
    { key: "ProcessWastagePercentage", header: "Waste %", render: (r) => r.ProcessWastagePercentage ? `${r.ProcessWastagePercentage}%` : "—" },
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
