"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders } from "@/lib/auth";

const BASE_URL = "https://api.indusanalytics.co.in";

// ── Unwrap triple-encoded JSON ────────────────────────────────────────────────
function unwrap(raw: any): any {
  let r = raw;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
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
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";
const ic = (err: boolean | string | undefined) => err ? inputCls.replace("border-gray-300", "border-red-400 bg-red-50/50") : inputCls;
const Sel = ({ value, onChange, options, placeholder = "Select...", cls }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; cls?: string }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className={cls ?? inputCls}>
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);
const SuffixInput = ({ value, onChange, suffix, placeholder, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
    <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder} className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none" />
    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-l border-gray-300 font-medium whitespace-nowrap">{suffix}</div>
  </div>
);
const PrefixInput = ({ value, onChange, prefix, placeholder, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-r border-gray-300 font-medium whitespace-nowrap">{prefix}</div>
    <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder} className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none" />
  </div>
);

// ── Blank machine form (uses DB column names) ─────────────────────────────────
const blank = () => ({
  MachineName: "", MachineType: "", DepartmentID: "", BranchID: "", ProductionUnitID: "",
  RefMachineCode: "", SpeedUnit: "m/min", IsPlanningMachine: "false",
  // Dimensions / speed
  MinWidth: "", MaxWidth: "", MinRollWidth: "", MaxRollWidth: "",
  MinCircumference: "", MaxCircumference: "", MachineSpeed: "",
  // Printing specific
  Colors: "", Gripper: "", PrintingMargin: "",
  MakeReadyWastageSheet: "", MakeReadyWastageRunningMeter: "",
  MakeReadyCharges: "", MakeReadyTime: "", MakeReadyTimeMode: "Per Color",
  MakeReadyPerHourCost: "", JobChangeOverTime: "",
  MinimumSheet: "", BasicPrintingCharges: "", RoundofImpressionsWith: "",
  MinLength: "", MaxLength: "",
  // Costing
  PerHourCost: "", ChargesType: "Per Hour", WastageType: "",
  WastageCalculationOn: "", PerHourCostingParameter: "",
  PlateCharges: "", PlateChargesType: "",
  ElectricConsumption: "", OtherCharges: "",
});

type MachineForm = ReturnType<typeof blank>;

// ── Department-specific spec sub-components ───────────────────────────────────
function PrintingSpecs({ form, f }: { form: MachineForm; f: (k: keyof MachineForm, v: string) => void }) {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle title="Press Parameters" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="No. of Colors">
            <Sel value={form.Colors} onChange={v => f("Colors", v)} options={["4","5","6","7","8","9","10","11","12"].map(x=>({value:x,label:x}))} />
          </Field>
          <Field label="Min Web Width">
            <SuffixInput value={form.MinWidth} onChange={(e:any)=>f("MinWidth",e.target.value)} suffix="mm" placeholder="e.g. 150" type="number"/>
          </Field>
          <Field label="Max Web Width">
            <SuffixInput value={form.MaxWidth} onChange={(e:any)=>f("MaxWidth",e.target.value)} suffix="mm" placeholder="e.g. 1600" type="number"/>
          </Field>
          <Field label="Max Speed">
            <SuffixInput value={form.MachineSpeed} onChange={(e:any)=>f("MachineSpeed",e.target.value)} suffix="m/min" placeholder="e.g. 150" type="number"/>
          </Field>
          <Field label="Repeat Length Min">
            <SuffixInput value={form.MinLength} onChange={(e:any)=>f("MinLength",e.target.value)} suffix="mm" placeholder="e.g. 300" type="number"/>
          </Field>
          <Field label="Repeat Length Max">
            <SuffixInput value={form.MaxLength} onChange={(e:any)=>f("MaxLength",e.target.value)} suffix="mm" placeholder="e.g. 1500" type="number"/>
          </Field>
          <Field label="Gripper">
            <SuffixInput value={form.Gripper} onChange={(e:any)=>f("Gripper",e.target.value)} suffix="mm" placeholder="e.g. 10" type="number"/>
          </Field>
          <Field label="Printing Margin">
            <SuffixInput value={form.PrintingMargin} onChange={(e:any)=>f("PrintingMargin",e.target.value)} suffix="mm" placeholder="e.g. 15" type="number"/>
          </Field>
        </div>
      </div>
      <div>
        <SectionTitle title="Make Ready" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Make Ready Wastage">
            <SuffixInput value={form.MakeReadyWastageRunningMeter} onChange={(e:any)=>f("MakeReadyWastageRunningMeter",e.target.value)} suffix="m/run" placeholder="e.g. 50" type="number"/>
          </Field>
          <Field label="Make Ready Charges">
            <PrefixInput value={form.MakeReadyCharges} onChange={(e:any)=>f("MakeReadyCharges",e.target.value)} prefix="₹" placeholder="e.g. 1500" type="number"/>
          </Field>
          <Field label="Make Ready Time">
            <SuffixInput value={form.MakeReadyTime} onChange={(e:any)=>f("MakeReadyTime",e.target.value)} suffix="min" placeholder="e.g. 20" type="number"/>
          </Field>
          <Field label="Make Ready Time Mode">
            <Sel value={form.MakeReadyTimeMode} onChange={v=>f("MakeReadyTimeMode",v)} options={["Per Color","Per Job","Flat"].map(x=>({value:x,label:x}))}/>
          </Field>
          <Field label="Make Ready Charges/Hr">
            <PrefixInput value={form.MakeReadyPerHourCost} onChange={(e:any)=>f("MakeReadyPerHourCost",e.target.value)} prefix="₹" placeholder="0.00" type="number"/>
          </Field>
          <Field label="Job Change Over Time">
            <SuffixInput value={form.JobChangeOverTime} onChange={(e:any)=>f("JobChangeOverTime",e.target.value)} suffix="min" placeholder="e.g. 30" type="number"/>
          </Field>
          <Field label="Min Printing Impr. To Charge">
            <input type="number" value={form.MinimumSheet ?? ""} onChange={e=>f("MinimumSheet",e.target.value)} placeholder="e.g. 500" className={inputCls}/>
          </Field>
          <Field label="Basic Printing Charges">
            <PrefixInput value={form.BasicPrintingCharges} onChange={(e:any)=>f("BasicPrintingCharges",e.target.value)} prefix="₹" placeholder="0.00" type="number"/>
          </Field>
          <Field label="Round Impressions With">
            <input type="number" value={form.RoundofImpressionsWith ?? ""} onChange={e=>f("RoundofImpressionsWith",e.target.value)} placeholder="e.g. 100" className={inputCls}/>
          </Field>
        </div>
      </div>
    </div>
  );
}

function PrePressSpecs({ form, f }: { form: MachineForm; f: (k: keyof MachineForm, v: string) => void }) {
  return (
    <div>
      <SectionTitle title="Cylinder / Engraving Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Max Cylinder Width"><SuffixInput value={form.MaxWidth} onChange={(e:any)=>f("MaxWidth",e.target.value)} suffix="mm" placeholder="e.g. 1600" type="number"/></Field>
        <Field label="Max Circumference"><SuffixInput value={form.MaxCircumference} onChange={(e:any)=>f("MaxCircumference",e.target.value)} suffix="mm" placeholder="e.g. 1200" type="number"/></Field>
        <Field label="Speed Max"><SuffixInput value={form.MachineSpeed} onChange={(e:any)=>f("MachineSpeed",e.target.value)} suffix="cyl/hr" placeholder="e.g. 4" type="number"/></Field>
        <Field label="Electric Consumption"><SuffixInput value={form.ElectricConsumption} onChange={(e:any)=>f("ElectricConsumption",e.target.value)} suffix="kW" placeholder="e.g. 15" type="number"/></Field>
      </div>
    </div>
  );
}

function LaminationSpecs({ form, f }: { form: MachineForm; f: (k: keyof MachineForm, v: string) => void }) {
  return (
    <div>
      <SectionTitle title="Lamination Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Min Web Width"><SuffixInput value={form.MinRollWidth} onChange={(e:any)=>f("MinRollWidth",e.target.value)} suffix="mm" placeholder="e.g. 150" type="number"/></Field>
        <Field label="Max Web Width"><SuffixInput value={form.MaxRollWidth} onChange={(e:any)=>f("MaxRollWidth",e.target.value)} suffix="mm" placeholder="e.g. 1450" type="number"/></Field>
        <Field label="Max Speed"><SuffixInput value={form.MachineSpeed} onChange={(e:any)=>f("MachineSpeed",e.target.value)} suffix="m/min" placeholder="e.g. 200" type="number"/></Field>
        <Field label="Electric Consumption"><SuffixInput value={form.ElectricConsumption} onChange={(e:any)=>f("ElectricConsumption",e.target.value)} suffix="kW" placeholder="e.g. 30" type="number"/></Field>
      </div>
    </div>
  );
}

function SlittingSpecs({ form, f }: { form: MachineForm; f: (k: keyof MachineForm, v: string) => void }) {
  return (
    <div>
      <SectionTitle title="Slitting Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Min Web Width"><SuffixInput value={form.MinRollWidth} onChange={(e:any)=>f("MinRollWidth",e.target.value)} suffix="mm" placeholder="e.g. 100" type="number"/></Field>
        <Field label="Max Web Width"><SuffixInput value={form.MaxRollWidth} onChange={(e:any)=>f("MaxRollWidth",e.target.value)} suffix="mm" placeholder="e.g. 1450" type="number"/></Field>
        <Field label="Max Speed"><SuffixInput value={form.MachineSpeed} onChange={(e:any)=>f("MachineSpeed",e.target.value)} suffix="m/min" placeholder="e.g. 600" type="number"/></Field>
        <Field label="Electric Consumption"><SuffixInput value={form.ElectricConsumption} onChange={(e:any)=>f("ElectricConsumption",e.target.value)} suffix="kW" placeholder="e.g. 15" type="number"/></Field>
      </div>
    </div>
  );
}

function PouchSpecs({ form, f }: { form: MachineForm; f: (k: keyof MachineForm, v: string) => void }) {
  return (
    <div>
      <SectionTitle title="Pouch Making Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Min Web Width"><SuffixInput value={form.MinRollWidth} onChange={(e:any)=>f("MinRollWidth",e.target.value)} suffix="mm" placeholder="e.g. 50" type="number"/></Field>
        <Field label="Max Web Width"><SuffixInput value={form.MaxRollWidth} onChange={(e:any)=>f("MaxRollWidth",e.target.value)} suffix="mm" placeholder="e.g. 600" type="number"/></Field>
        <Field label="Max Speed"><SuffixInput value={form.MachineSpeed} onChange={(e:any)=>f("MachineSpeed",e.target.value)} suffix="pcs/min" placeholder="e.g. 120" type="number"/></Field>
        <Field label="Electric Consumption"><SuffixInput value={form.ElectricConsumption} onChange={(e:any)=>f("ElectricConsumption",e.target.value)} suffix="kW" placeholder="e.g. 12" type="number"/></Field>
      </div>
    </div>
  );
}

function QCSpecs({ form, f }: { form: MachineForm; f: (k: keyof MachineForm, v: string) => void }) {
  return (
    <div>
      <SectionTitle title="QC Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Max Web Width"><SuffixInput value={form.MaxRollWidth} onChange={(e:any)=>f("MaxRollWidth",e.target.value)} suffix="mm" placeholder="e.g. 1450" type="number"/></Field>
        <Field label="Max Speed"><SuffixInput value={form.MachineSpeed} onChange={(e:any)=>f("MachineSpeed",e.target.value)} suffix="m/min" placeholder="e.g. 400" type="number"/></Field>
        <Field label="Electric Consumption"><SuffixInput value={form.ElectricConsumption} onChange={(e:any)=>f("ElectricConsumption",e.target.value)} suffix="kW" placeholder="e.g. 8" type="number"/></Field>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MachineMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [activeTab, setActiveTab] = useState<"detail" | "specs" | "costing">("detail");

  // ── Backend data ────────────────────────────────────────────────────────────
  const [machines, setMachines] = useState<any[]>([]);
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);
  const [machineTypes, setMachineTypes] = useState<{ MachineTypeName: string; MachineMasterDisplayFieldsName: string }[]>([]);
  const [productionUnits, setProductionUnits] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<MachineForm>(blank());
  const f = (k: keyof MachineForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  // ── Derived: machine types for selected dept ─────────────────────────────────
  const currentDeptName = departments.find(d => d.value === form.DepartmentID)?.label ?? "";
  const filteredMachineTypes = machineTypes
    .filter(mt => !form.DepartmentID || mt.MachineMasterDisplayFieldsName?.toLowerCase().includes(currentDeptName.toLowerCase()) || true)
    .map(mt => ({ value: mt.MachineTypeName, label: mt.MachineTypeName }));

  // ── Load reference data on mount ─────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      const [deptRes, typeRes, puRes] = await Promise.all([
        fetch(`${BASE_URL}/api/machinemaster/getselectdepartment`, { headers: authHeaders() }),
        fetch(`${BASE_URL}/api/machinemaster/getmachinetype`, { headers: authHeaders() }),
        fetch(`${BASE_URL}/api/machinemaster/getmachineproductionunitlist`, { headers: authHeaders() }),
      ]);
      try {
        const depts = unwrap(await deptRes.text());
        if (Array.isArray(depts)) setDepartments(depts.map((d:any) => ({ value: String(d.DepartmentID), label: d.DepartmentName })));
      } catch {}
      try {
        const types = unwrap(await typeRes.text());
        if (Array.isArray(types)) setMachineTypes(types);
      } catch {}
      try {
        const pus = unwrap(await puRes.text());
        if (Array.isArray(pus)) setProductionUnits(pus.map((p:any) => ({ value: String(p.ProductionUnitID), label: p.ProductionUnitName })));
      } catch {}
    };
    fetchAll();
  }, []);

  // ── Load machine list ─────────────────────────────────────────────────────────
  const loadMachines = useCallback(() => {
    setLoading(true);
    fetch(`${BASE_URL}/api/machinemaster/machinemaster`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const result = unwrap(text);
        setMachines(Array.isArray(result) ? result : []);
      })
      .catch(() => setMachines([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadMachines(); }, [loadMachines]);

  // ── Department filter for list ────────────────────────────────────────────────
  const [filterDept, setFilterDept] = useState("All");
  const filteredMachines = useMemo(() =>
    filterDept === "All" ? machines : machines.filter(m => m.DepartmentName === filterDept || m.DepartmentID === filterDept),
    [machines, filterDept]);

  // ── Open add form ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm(blank());
    setActiveTab("detail");
    setError("");
    setSubmitAttempted(false);
    setView("form");
  };

  // ── Open edit form ────────────────────────────────────────────────────────────
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      MachineName: row.MachineName ?? "",
      MachineType: row.MachineType ?? "",
      DepartmentID: String(row.DepartmentID ?? ""),
      BranchID: String(row.BranchID ?? ""),
      ProductionUnitID: String(row.ProductionUnitID ?? ""),
      RefMachineCode: row.RefMachineCode ?? "",
      SpeedUnit: row.SpeedUnit ?? "m/min",
      IsPlanningMachine: row.IsPlanningMachine === "True" || row.IsPlanningMachine === "1" ? "true" : "false",
      MinWidth: row.MinWidth ?? "", MaxWidth: row.MaxWidth ?? "",
      MinRollWidth: row.MinRollWidth ?? "", MaxRollWidth: row.MaxRollWidth ?? "",
      MinCircumference: row.MinCircumference ?? "", MaxCircumference: row.MaxCircumference ?? "",
      MachineSpeed: row.MachineSpeed ?? "",
      Colors: row.Colors ?? "", Gripper: row.Gripper ?? "", PrintingMargin: row.PrintingMargin ?? "",
      MakeReadyWastageSheet: row.MakeReadyWastageSheet ?? "",
      MakeReadyWastageRunningMeter: row.MakeReadyWastageRunningMeter ?? "",
      MakeReadyCharges: row.MakeReadyCharges ?? "", MakeReadyTime: row.MakeReadyTime ?? "",
      MakeReadyTimeMode: row.MakeReadyTimeMode ?? "Per Color",
      MakeReadyPerHourCost: row.MakeReadyPerHourCost ?? "",
      JobChangeOverTime: row.JobChangeOverTime ?? "",
      MinimumSheet: row.MinimumSheet ?? "", BasicPrintingCharges: row.BasicPrintingCharges ?? "",
      RoundofImpressionsWith: row.RoundofImpressionsWith ?? "",
      MinLength: row.MinLength ?? "", MaxLength: row.MaxLength ?? "",
      PerHourCost: row.PerHourCost ?? "", ChargesType: row.ChargesType ?? "Per Hour",
      WastageType: row.WastageType ?? "", WastageCalculationOn: row.WastageCalculationOn ?? "",
      PerHourCostingParameter: row.PerHourCostingParameter ?? "",
      PlateCharges: String(row.PlateCharges ?? ""), PlateChargesType: row.PlateChargesType ?? "",
      ElectricConsumption: row.ElectricConsumption ?? "", OtherCharges: row.OtherCharges ?? "",
    });
    setActiveTab("detail");
    setError("");
    setView("form");
  };

  // ── Save ──────────────────────────────────────────────────────────────────────
  const saveMachine = async () => {
    setSubmitAttempted(true);
    if (!form.MachineName) { setError("Machine Name is required."); return; }
    if (!form.DepartmentID) { setError("Department is required."); return; }
    setSaving(true);
    setError("");
    try {
      // Build CostingMachineData — exclude backend-managed columns (AddColName)
      // NOT included: ModifiedDate, CreatedDate, UserID, CompanyID, FYear, CreatedBy, ModifiedBy, MaxMachineNo, MachineCode
      const { ...machineData } = form;
      // Convert numeric fields — avoid varchar→numeric type errors
      const numericFields = ["Colors","Gripper","PrintingMargin","MakeReadyWastageSheet","MakeReadyWastageRunningMeter",
        "MakeReadyCharges","MakeReadyTime","MakeReadyPerHourCost","JobChangeOverTime","MinimumSheet",
        "BasicPrintingCharges","RoundofImpressionsWith","MinWidth","MaxWidth","MinRollWidth","MaxRollWidth",
        "MinLength","MaxLength","MinCircumference","MaxCircumference","MachineSpeed","PerHourCost",
        "PlateCharges","ElectricConsumption","OtherCharges"];
      const record: Record<string, any> = { ...machineData };
      numericFields.forEach(k => {
        const v = record[k];
        const n = Number(v);
        record[k] = (v !== "" && v !== null && !isNaN(n)) ? n : null;
      });
      // Boolean
      record.IsPlanningMachine = record.IsPlanningMachine === "true" ? "true" : "false";

      const isEdit = !!editing;
      const payload: Record<string, any> = {
        CostingMachineData: [record],
        ObjMachineSlab: [],
        CoatingRates: [],
        MachineName: form.MachineName,
      };
      if (isEdit) payload.MachineID = String(editing.MachineId ?? editing.MachineID ?? "");

      const endpoint = isEdit ? "updatemachinemaster" : "savemachinemasterdata";
      const res = await fetch(`${BASE_URL}/api/machinemaster/${endpoint}`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(payload),
      });
      const text = (await res.text()).replace(/^"|"$/g, "");
      if (text === "Success" || text === "success") {
        loadMachines();
        setView("list");
      } else if (text === "Exist") {
        setError("Machine name already exists.");
      } else {
        setError(text || "Save failed.");
      }
    } catch (e: any) {
      setError("Network error: " + e.message);
    }
    setSaving(false);
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleteMachine = async (row: any) => {
    const mid = String(row.MachineId ?? row.MachineID ?? "");
    if (!confirm("Delete this machine?")) return;
    await fetch(`${BASE_URL}/api/machinemaster/deletemachinemaster`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ VMachineID: mid }),
    });
    loadMachines();
  };

  // ── Grid columns ──────────────────────────────────────────────────────────────
  const columns = useMemo((): Column<any>[] => [
    { key: "MachineCode", header: "Code", sortable: true },
    { key: "MachineName", header: "Machine Name", sortable: true },
    { key: "DepartmentName", header: "Department", sortable: true,
      render: (r) => {
        const colors: Record<string,string> = {"Printing":"bg-blue-100 text-blue-700","Lamination":"bg-amber-100 text-amber-700","Slitting":"bg-emerald-100 text-emerald-700","Pre-Press":"bg-purple-100 text-purple-700","Pouch Making":"bg-rose-100 text-rose-700","QC":"bg-gray-100 text-gray-700"};
        const cls = colors[r.DepartmentName] ?? "bg-gray-100 text-gray-600";
        return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{r.DepartmentName}</span>;
      }
    },
    { key: "MachineType", header: "Type", sortable: true },
    { key: "ProductionUnitName", header: "Production Unit" },
    { key: "MachineSpeed", header: "Speed" },
  ], []);

  const uniqueDepts = useMemo(() => ["All", ...new Set(machines.map(m => m.DepartmentName).filter(Boolean))], [machines]);

  // ── FORM VIEW ─────────────────────────────────────────────────────────────────
  if (view === "form") {
    const isEdit = !!editing;
    const tabs = [
      { key: "detail", label: "Details" },
      { key: "specs", label: "Specifications" },
      { key: "costing", label: "Costing" },
    ] as const;

    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">Machine Master</p>
            <h2 className="text-xl font-bold text-gray-800">{isEdit ? "Edit Machine" : "New Machine"}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <List size={16}/> Back to List
            </button>
            <button onClick={saveMachine} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
              Save Machine
            </button>
          </div>
        </div>

        {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="px-6 pt-5 pb-0 border-b border-gray-200 bg-gray-50/30">
            <div className="flex gap-8">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === t.key ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8">

            {/* ── DETAILS TAB ── */}
            {activeTab === "detail" && (
              <div className="space-y-8">
                <div>
                  <SectionTitle title="Machine Identity"/>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <Field label="Machine Name" required>
                        <input type="text" value={form.MachineName} onChange={e=>f("MachineName",e.target.value)} placeholder="e.g. Rotogravure Press #1" className={ic(submitAttempted && !form.MachineName.trim())}/>
                      </Field>
                    </div>
                    <Field label="Department" required>
                      <Sel value={form.DepartmentID} onChange={v=>f("DepartmentID",v)} options={departments} cls={ic(submitAttempted && !form.DepartmentID)}/>
                    </Field>
                    <Field label="Machine Type">
                      <Sel value={form.MachineType} onChange={v=>f("MachineType",v)} options={filteredMachineTypes}/>
                    </Field>
                    <Field label="Production Unit">
                      <Sel value={form.ProductionUnitID} onChange={v=>f("ProductionUnitID",v)} options={productionUnits}/>
                    </Field>
                    <Field label="Ref. Machine Code">
                      <input type="text" value={form.RefMachineCode} onChange={e=>f("RefMachineCode",e.target.value)} placeholder="e.g. REF-001" className={inputCls}/>
                    </Field>
                    <Field label="Speed Unit">
                      <Sel value={form.SpeedUnit} onChange={v=>f("SpeedUnit",v)}
                        options={["m/min","IMPRESSION","kg/hr","pcs/min","pcs/hr"].map(x=>({value:x,label:x}))}/>
                    </Field>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => f("IsPlanningMachine", form.IsPlanningMachine === "true" ? "false" : "true")} className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-12 h-6 rounded-full transition-colors relative ${form.IsPlanningMachine === "true" ? "bg-blue-500" : "bg-gray-300"}`}>
                      <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${form.IsPlanningMachine === "true" ? "left-7" : "left-1"}`}/>
                    </div>
                    <span className="text-sm font-medium text-gray-700">Planning Machine</span>
                  </button>
                </div>
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button onClick={() => setActiveTab("specs")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900">
                    Specifications →
                  </button>
                </div>
              </div>
            )}

            {/* ── SPECIFICATIONS TAB ── */}
            {activeTab === "specs" && (
              <div className="space-y-8">
                {currentDeptName.includes("Printing") && <PrintingSpecs form={form} f={f}/>}
                {currentDeptName.includes("Pre-Press") && <PrePressSpecs form={form} f={f}/>}
                {currentDeptName.includes("Lamination") && <LaminationSpecs form={form} f={f}/>}
                {currentDeptName.includes("Slitting") && <SlittingSpecs form={form} f={f}/>}
                {currentDeptName.includes("Pouch") && <PouchSpecs form={form} f={f}/>}
                {currentDeptName.includes("QC") && <QCSpecs form={form} f={f}/>}
                {!currentDeptName && (
                  <div className="text-center py-10 text-gray-400 text-sm">Select a department to see specifications</div>
                )}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button onClick={() => setActiveTab("detail")} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    ← Details
                  </button>
                  <button onClick={() => setActiveTab("costing")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900">
                    Costing →
                  </button>
                </div>
              </div>
            )}

            {/* ── COSTING TAB ── */}
            {activeTab === "costing" && (
              <div className="space-y-8">
                <div>
                  <SectionTitle title="Costing Parameters"/>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Per Hour Cost">
                      <PrefixInput value={form.PerHourCost} onChange={(e:any)=>f("PerHourCost",e.target.value)} prefix="₹" placeholder="0.00" type="number"/>
                    </Field>
                    <Field label="Charges Type">
                      <Sel value={form.ChargesType} onChange={v=>f("ChargesType",v)}
                        options={["Per Hour","Per Meter","Per m²","Per 1000 Pcs","Per Job","Fixed"].map(x=>({value:x,label:x}))}/>
                    </Field>
                    <Field label="Per Hour Costing Parameter">
                      <Sel value={form.PerHourCostingParameter} onChange={v=>f("PerHourCostingParameter",v)}
                        options={["Actual Running Meter","Actual Running Meter + Make Ready Running Meter","Actual Running Meter + Wastage Running Meter","Actual Running Meter + Make Ready Running Meter + Wastage Running Meter","Actual Sheets","Actual Sheets + Make Ready Sheets","Actual Sheets + Wastage Sheets","Order Quantity","Final Qty","Printing Impresions"].map(x=>({value:x,label:x}))}/>
                    </Field>
                    <Field label="Wastage Type">
                      <Sel value={form.WastageType} onChange={v=>f("WastageType",v)}
                        options={["Percentage","Flat Meter","Fixed Weight"].map(x=>({value:x,label:x}))}/>
                    </Field>
                    <Field label="Wastage Calc. On">
                      <Sel value={form.WastageCalculationOn} onChange={v=>f("WastageCalculationOn",v)}
                        options={["Input","Output","Both"].map(x=>({value:x,label:x}))}/>
                    </Field>
                    <Field label="Plate Charges">
                      <PrefixInput value={form.PlateCharges} onChange={(e:any)=>f("PlateCharges",e.target.value)} prefix="₹" placeholder="0.00" type="number"/>
                    </Field>
                    <Field label="Plate Charges Type">
                      <Sel value={form.PlateChargesType} onChange={v=>f("PlateChargesType",v)}
                        options={["Per Job","Per Color","Fixed"].map(x=>({value:x,label:x}))}/>
                    </Field>
                    <Field label="Other Charges">
                      <PrefixInput value={form.OtherCharges} onChange={(e:any)=>f("OtherCharges",e.target.value)} prefix="₹" placeholder="0.00" type="number"/>
                    </Field>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button onClick={() => setActiveTab("specs")} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    ← Specifications
                  </button>
                  <button onClick={saveMachine} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
                    {saving ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
                    Save Machine
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Machine Master</h2>
          <p className="text-sm text-gray-500">{filteredMachines.length} of {machines.length} machines</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">
          <Plus size={16}/> Add Machine
        </button>
      </div>

      {/* Department filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Dept</span>
          {uniqueDepts.map(d => (
            <button key={d} onClick={() => setFilterDept(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterDept === d ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {d === "All" ? "All Departments" : d}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-blue-600">
            <Loader2 size={24} className="animate-spin mr-2"/> Loading machines...
          </div>
        ) : (
          <DataTable
            data={filteredMachines.map((m, i) => ({ ...m, id: String(m.MachineId ?? m.MachineID ?? i) }))}
            columns={columns}
            searchKeys={["MachineName","MachineCode","MachineType","DepartmentName","ProductionUnitName"]}
            actions={(row) => (
              <div className="flex items-center gap-2 justify-end">
                <Button variant="ghost" size="sm" icon={<Pencil size={13}/>} onClick={() => openEdit(row)}>Edit</Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={13}/>} onClick={() => deleteMachine(row)}>Delete</Button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
