"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, List } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { authHeaders, getSession } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";

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
const SuffixInput = ({ value, onChange, suffix, placeholder, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden">
    <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder} className="flex-1 min-w-0 px-3 py-2 text-sm text-gray-800 outline-none" />
    <div className="bg-gray-100 px-3 py-2 text-xs text-gray-700 border-l border-gray-300 font-semibold whitespace-nowrap shrink-0 min-w-[40px] text-center">{suffix}</div>
  </div>
);
const PrefixInput = ({ value, onChange, prefix, placeholder, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-r border-gray-300 font-medium whitespace-nowrap">{prefix}</div>
    <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder} className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none" />
  </div>
);

function SearchSel({ value, onChange, options, placeholder = "Select...", cls }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; cls?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find(o => o.value === value)?.label ?? "";
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const filtered = query ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())) : options;
  return (
    <div ref={ref} className="relative">
      <div className={(cls ?? inputCls) + " cursor-pointer flex items-center justify-between"} onClick={() => { setOpen(o => !o); setQuery(""); }}>
        <span className={value ? "text-gray-900 text-sm" : "text-gray-400 text-sm"}>{selectedLabel || placeholder}</span>
        <svg className="w-4 h-4 text-gray-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <div className="px-3 py-2 text-sm text-gray-400 cursor-pointer hover:bg-gray-50" onClick={() => { onChange(""); setOpen(false); }}>{placeholder}</div>
            {filtered.map(o => (
              <div key={o.value} className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 ${o.value === value ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"}`}
                onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}>
                {o.label}
              </div>
            ))}
            {filtered.length === 0 && <div className="px-3 py-3 text-sm text-gray-400 text-center">No results</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Blank machine form (uses DB column names) ─────────────────────────────────
const blank = () => ({
  MachineName: "", MachineType: "", DepartmentID: "", BranchID: "", ProductionUnitID: "",
  RefMachineCode: "", SpeedUnit: "m/min", IsPlanningMachine: "false",
  IsPerfectaMachine: "false", IsVariableCutOff: "false", IsSpecialMachine: "false",
  // Purchase & depreciation
  PurchaseCost: "", MachineLifespan: "", WorkingHoursPerDay: "8", WorkingDaysPerYear: "300",
  IsOnLoan: "false", AnnualInterestRate: "", LoanDuration: "",
  // Labor
  NumberOfOperators: "", AvgLaborSalaryPerYear: "",
  // Dimensions / speed (common)
  MinWidth: "", MaxWidth: "", MinLength: "", MaxLength: "",
  MinRollWidth: "", MaxRollWidth: "", MinCircumference: "", MaxCircumference: "",
  MachineSpeed: "", ElectricConsumption: "",
  // Make ready (common)
  MakeReadyWastageSheet: "", MakeReadyWastageRunningMeter: "",
  MakeReadyCharges: "", MakeReadyTime: "", MakeReadyTimeMode: "Per Color",
  MakeReadyPerHourCost: "", JobChangeOverTime: "",
  // Charges & wastage (common)
  ChargesType: "Per Hour", PerHourCost: "", WastageType: "",
  WastageCalculationOn: "", PerHourCostingParameter: "", OtherCharges: "",
  // Printing specific
  Colors: "", Gripper: "", PrintingMargin: "",
  MinPrintW: "", MaxPrintW: "", MinPrintL: "", MaxPrintL: "",
  MinimumSheet: "", BasicPrintingCharges: "", RoundofImpressionsWith: "",
  PlateCharges: "", PlateChargesType: "",
  // Roll / Flexo / Roto (printing)
  MachineWidth: "", AverageRollLength: "", AverageRollChangeWastage: "", RollChangeTime: "",
  AvgBreakDownRunningMeters: "", AvgBreakDownTime: "",
});

type MachineForm = ReturnType<typeof blank>;

// ── CommonSpecs — shown for ALL departments ───────────────────────────────────
function CommonSpecs({ form, f }: { form: MachineForm; f: (k: keyof MachineForm, v: string) => void }) {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle title="Machine Dimensions" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Min Width">
            <SuffixInput value={form.MinWidth} onChange={(e: any) => f("MinWidth", e.target.value)} suffix="mm" placeholder="e.g. 500" type="number" />
          </Field>
          <Field label="Max Width">
            <SuffixInput value={form.MaxWidth} onChange={(e: any) => f("MaxWidth", e.target.value)} suffix="mm" placeholder="e.g. 1600" type="number" />
          </Field>
          <Field label="Min Length">
            <SuffixInput value={form.MinLength} onChange={(e: any) => f("MinLength", e.target.value)} suffix="mm" placeholder="e.g. 250" type="number" />
          </Field>
          <Field label="Max Length">
            <SuffixInput value={form.MaxLength} onChange={(e: any) => f("MaxLength", e.target.value)} suffix="mm" placeholder="e.g. 2000" type="number" />
          </Field>
          <Field label="Machine Speed">
            <SuffixInput value={form.MachineSpeed} onChange={(e: any) => f("MachineSpeed", e.target.value)} suffix={form.SpeedUnit || "m/min"} placeholder="e.g. 500" type="number" />
          </Field>
          <Field label="Electric Consumption">
            <SuffixInput value={form.ElectricConsumption} onChange={(e: any) => f("ElectricConsumption", e.target.value)} suffix="kW" placeholder="e.g. 30" type="number" />
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle title="Make Ready" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Make Ready Wastage">
            <SuffixInput value={form.MakeReadyWastageRunningMeter} onChange={(e: any) => f("MakeReadyWastageRunningMeter", e.target.value)} suffix="mtr" placeholder="e.g. 50" type="number" />
          </Field>
          <Field label="Make Ready Charges">
            <PrefixInput value={form.MakeReadyCharges} onChange={(e: any) => f("MakeReadyCharges", e.target.value)} prefix="₹" placeholder="e.g. 1500" type="number" />
          </Field>
          <Field label="Make Ready Time">
            <SuffixInput value={form.MakeReadyTime} onChange={(e: any) => f("MakeReadyTime", e.target.value)} suffix="min" placeholder="e.g. 20" type="number" />
          </Field>
          <Field label="Make Ready Time Mode">
            <SearchSel value={form.MakeReadyTimeMode} onChange={v => f("MakeReadyTimeMode", v)} options={["Per Color", "Per Job", "Flat"].map(x => ({ value: x, label: x }))} />
          </Field>
          <Field label="Make Ready Charges / Hr">
            <PrefixInput value={form.MakeReadyPerHourCost} onChange={(e: any) => f("MakeReadyPerHourCost", e.target.value)} prefix="₹" placeholder="0.00" type="number" />
          </Field>
          <Field label="Job Change Over Time">
            <SuffixInput value={form.JobChangeOverTime} onChange={(e: any) => f("JobChangeOverTime", e.target.value)} suffix="min" placeholder="e.g. 30" type="number" />
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle title="Wastage" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <Field label="Wastage Type">
            <SearchSel value={form.WastageType} onChange={v => f("WastageType", v)}
              options={["Percentage", "Flat Meter", "Fixed Weight"].map(x => ({ value: x, label: x }))} placeholder="Select..." />
          </Field>
          <Field label="Wastage Calculation On">
            <SearchSel value={form.WastageCalculationOn} onChange={v => f("WastageCalculationOn", v)}
              options={["Actual Running Meter", "Actual Running Meter + Make Ready Running Meter + Wastage Running Meter"].map(x => ({ value: x, label: x }))} placeholder="Select..." />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ── PrintingExtras — shown only when Printing dept is selected ────────────────
function PrintingExtras({ form, f }: { form: MachineForm; f: (k: keyof MachineForm, v: string) => void }) {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle title="Press Parameters" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="No. of Colors">
            <input type="number" value={form.Colors} onChange={e => f("Colors", e.target.value)} className={inputCls} placeholder="e.g. 4" min="1" />
          </Field>
          <Field label="Printing Margin">
            <SuffixInput value={form.PrintingMargin} onChange={(e: any) => f("PrintingMargin", e.target.value)} suffix="mm" placeholder="e.g. 15" type="number" />
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle title="Printing Area (MM)" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Min Print Width">
            <SuffixInput value={form.MinPrintW} onChange={(e: any) => f("MinPrintW", e.target.value)} suffix="mm" placeholder="e.g. 100" type="number" />
          </Field>
          <Field label="Max Print Width">
            <SuffixInput value={form.MaxPrintW} onChange={(e: any) => f("MaxPrintW", e.target.value)} suffix="mm" placeholder="e.g. 1500" type="number" />
          </Field>
          <Field label="Min Print Length">
            <SuffixInput value={form.MinPrintL} onChange={(e: any) => f("MinPrintL", e.target.value)} suffix="mm" placeholder="e.g. 100" type="number" />
          </Field>
          <Field label="Max Print Length">
            <SuffixInput value={form.MaxPrintL} onChange={(e: any) => f("MaxPrintL", e.target.value)} suffix="mm" placeholder="e.g. 1200" type="number" />
          </Field>
        </div>
      </div>

    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MachineMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [activeTab, setActiveTab] = useState<"detail" | "specs">("detail");

  // ── Backend data ──────────────────────────────────────────────────────────
  const [machines, setMachines] = useState<any[]>([]);
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);
  const [machineTypes, setMachineTypes] = useState<{ MachineTypeName: string; MachineMasterDisplayFieldsName: string }[]>([]);
  const [productionUnits, setProductionUnits] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<MachineForm>(blank());
  const f = (k: keyof MachineForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  // ── Auto-calculated Per Hour Labor Cost ───────────────────────────────────
  const calcPerHourLaborCost = useMemo(() => {
    const ops = parseFloat(form.NumberOfOperators);
    const sal = parseFloat(form.AvgLaborSalaryPerYear);
    const hpd = parseFloat(form.WorkingHoursPerDay);
    const dpy = parseFloat(form.WorkingDaysPerYear);
    if (!ops || !sal || !hpd || !dpy) return "";
    return ((ops * sal) / (dpy * hpd)).toFixed(2);
  }, [form.NumberOfOperators, form.AvgLaborSalaryPerYear, form.WorkingHoursPerDay, form.WorkingDaysPerYear]);

  // ── Auto-calculated Machine Cost Per Hour ─────────────────────────────────
  const calcPerHourCost = useMemo(() => {
    const cost = parseFloat(form.PurchaseCost);
    const life = parseFloat(form.MachineLifespan);
    const hpd = parseFloat(form.WorkingHoursPerDay);
    const dpy = parseFloat(form.WorkingDaysPerYear);
    if (!cost || !life || !hpd || !dpy) return "";
    const totalHours = life * dpy * hpd;
    const basePerHour = cost / totalHours;
    if (form.IsOnLoan === "true") {
      const rate = parseFloat(form.AnnualInterestRate);
      if (!rate) return basePerHour.toFixed(2);
      const yearlyInterest = cost * (rate / 100);
      const hourlyInterest = yearlyInterest / (dpy * hpd);
      return (basePerHour + hourlyInterest).toFixed(2);
    }
    return basePerHour.toFixed(2);
  }, [form.PurchaseCost, form.MachineLifespan, form.WorkingHoursPerDay, form.WorkingDaysPerYear, form.IsOnLoan, form.AnnualInterestRate]);

  // ── Derived: current department name ─────────────────────────────────────
  const currentDeptName = departments.find(d => d.value === form.DepartmentID)?.label ?? "";

  // ── Load reference data on mount ─────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      const [deptRes, typeRes, puRes] = await Promise.all([
        fetch(`${BASE_URL}/api/machinemasterShrink/getselectdepartment`, { headers: authHeaders() }),
        fetch(`${BASE_URL}/api/machinemasterShrink/getmachinetype`, { headers: authHeaders() }),
        fetch(`${BASE_URL}/api/machinemasterShrink/getmachineproductionunitlist`, { headers: authHeaders() }),
      ]);
      try {
        const depts = unwrap(await deptRes.text());
        if (Array.isArray(depts)) setDepartments(depts.map((d: any) => ({ value: String(d.DepartmentID), label: d.DepartmentName })));
      } catch { }
      try {
        const types = unwrap(await typeRes.text());
        if (Array.isArray(types)) setMachineTypes(types);
      } catch { }
      try {
        const pus = unwrap(await puRes.text());
        if (Array.isArray(pus)) setProductionUnits(pus.map((p: any) => ({ value: String(p.ProductionUnitID), label: p.ProductionUnitName })));
      } catch { }
    };
    fetchAll();
  }, []);

  // suppress unused-variable lint for state setters used only via API
  void machineTypes; void productionUnits;

  // ── Load machine list ─────────────────────────────────────────────────────
  const loadMachines = useCallback(() => {
    setLoading(true);
    fetch(`${BASE_URL}/api/machinemasterShrink/machinemaster`, { headers: authHeaders() })
      .then(r => r.text())
      .then(text => {
        const result = unwrap(text);
        setMachines(Array.isArray(result) ? result : []);
      })
      .catch(() => setMachines([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadMachines(); }, [loadMachines]);

  // ── Department filter for list ────────────────────────────────────────────
  const [filterDept, setFilterDept] = useState("All");
  const filteredMachines = useMemo(() =>
    filterDept === "All" ? machines : machines.filter(m => m.DepartmentName === filterDept || m.DepartmentID === filterDept),
    [machines, filterDept]);

  // ── Open add form ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    const session = getSession();
    setForm({ ...blank(), ProductionUnitID: session?.productionUnitID ?? "" });
    setActiveTab("detail");
    setError("");
    setSubmitAttempted(false);
    setView("form");
  };

  // ── Open edit form ────────────────────────────────────────────────────────
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
      IsPlanningMachine: (row.IsPlanningMachine === "True" || row.IsPlanningMachine === "1" || row.IsPlanningMachine === true) ? "true" : "false",
      IsPerfectaMachine: (row.IsPerfectaMachine === "True" || row.IsPerfectaMachine === "1" || row.IsPerfectaMachine === true) ? "true" : "false",
      IsVariableCutOff: (row.IsVariableCutOff === "True" || row.IsVariableCutOff === "1" || row.IsVariableCutOff === true) ? "true" : "false",
      IsSpecialMachine: (row.IsSpecialMachine === "True" || row.IsSpecialMachine === "1" || row.IsSpecialMachine === true) ? "true" : "false",
      PurchaseCost: row.PurchaseCost != null ? String(row.PurchaseCost) : "",
      MachineLifespan: row.MachineLifespan != null ? String(row.MachineLifespan) : "",
      WorkingHoursPerDay: row.WorkingHoursPerDay != null ? String(row.WorkingHoursPerDay) : "8",
      WorkingDaysPerYear: row.WorkingDaysPerYear != null ? String(row.WorkingDaysPerYear) : "300",
      IsOnLoan: (row.IsOnLoan === 1 || row.IsOnLoan === true || row.IsOnLoan === "True" || row.IsOnLoan === "true" || row.IsOnLoan === "1") ? "true" : "false",
      AnnualInterestRate: row.AnnualInterestRate != null ? String(row.AnnualInterestRate) : "",
      LoanDuration: row.LoanDuration != null ? String(row.LoanDuration) : "",
      NumberOfOperators: row.NumberOfOperators != null ? String(row.NumberOfOperators) : "",
      AvgLaborSalaryPerYear: row.AvgLaborSalaryPerYear != null ? String(row.AvgLaborSalaryPerYear) : "",
      MinWidth: row.MinWidth != null ? String(row.MinWidth) : "",
      MaxWidth: row.MaxWidth != null ? String(row.MaxWidth) : "",
      MinLength: row.MinLength != null ? String(row.MinLength) : "",
      MaxLength: row.MaxLength != null ? String(row.MaxLength) : "",
      MinRollWidth: row.MinRollWidth != null ? String(row.MinRollWidth) : "",
      MaxRollWidth: row.MaxRollWidth != null ? String(row.MaxRollWidth) : "",
      MinCircumference: row.MinCircumference != null ? String(row.MinCircumference) : "",
      MaxCircumference: row.MaxCircumference != null ? String(row.MaxCircumference) : "",
      MachineSpeed: row.MachineSpeed != null ? String(row.MachineSpeed) : "",
      ElectricConsumption: row.ElectricConsumption != null ? String(row.ElectricConsumption) : "",
      MakeReadyWastageSheet: row.MakeReadyWastageSheet != null ? String(row.MakeReadyWastageSheet) : "",
      MakeReadyWastageRunningMeter: row.MakeReadyWastageRunningMeter != null ? String(row.MakeReadyWastageRunningMeter) : "",
      MakeReadyCharges: row.MakeReadyCharges != null ? String(row.MakeReadyCharges) : "",
      MakeReadyTime: row.MakeReadyTime != null ? String(row.MakeReadyTime) : "",
      MakeReadyTimeMode: row.MakeReadyTimeMode ?? "Per Color",
      MakeReadyPerHourCost: row.MakeReadyPerHourCost != null ? String(row.MakeReadyPerHourCost) : "",
      JobChangeOverTime: row.JobChangeOverTime != null ? String(row.JobChangeOverTime) : "",
      ChargesType: row.ChargesType ?? "Per Hour",
      PerHourCost: row.PerHourCost != null ? String(row.PerHourCost) : "",
      WastageType: row.WastageType ?? "",
      WastageCalculationOn: row.WastageCalculationOn ?? "",
      PerHourCostingParameter: row.PerHourCostingParameter ?? "",
      OtherCharges: row.OtherCharges != null ? String(row.OtherCharges) : "",
      Colors: row.Colors != null ? String(row.Colors) : "",
      Gripper: row.Gripper != null ? String(row.Gripper) : "",
      PrintingMargin: row.PrintingMargin != null ? String(row.PrintingMargin) : "",
      MinPrintW: row.MinPrintW != null ? String(row.MinPrintW) : "",
      MaxPrintW: row.MaxPrintW != null ? String(row.MaxPrintW) : "",
      MinPrintL: row.MinPrintL != null ? String(row.MinPrintL) : "",
      MaxPrintL: row.MaxPrintL != null ? String(row.MaxPrintL) : "",
      MinimumSheet: row.MinimumSheet != null ? String(row.MinimumSheet) : "",
      BasicPrintingCharges: row.BasicPrintingCharges != null ? String(row.BasicPrintingCharges) : "",
      RoundofImpressionsWith: row.RoundofImpressionsWith != null ? String(row.RoundofImpressionsWith) : "",
      PlateCharges: row.PlateCharges != null ? String(row.PlateCharges) : "",
      PlateChargesType: row.PlateChargesType ?? "",
      MachineWidth: row.MachineWidth != null ? String(row.MachineWidth) : "",
      AverageRollLength: row.AverageRollLength != null ? String(row.AverageRollLength) : "",
      AverageRollChangeWastage: row.AverageRollChangeWastage != null ? String(row.AverageRollChangeWastage) : "",
      RollChangeTime: row.RollChangeTime != null ? String(row.RollChangeTime) : "",
      AvgBreakDownRunningMeters: row.AvgBreakDownRunningMeters != null ? String(row.AvgBreakDownRunningMeters) : "",
      AvgBreakDownTime: row.AvgBreakDownTime != null ? String(row.AvgBreakDownTime) : "",
    });
    setActiveTab("detail");
    setError("");
    setView("form");
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveMachine = async () => {
    setSubmitAttempted(true);
    if (!form.MachineName) { setError("Machine Name is required."); return; }
    if (!form.DepartmentID) { setError("Department is required."); return; }
    setSaving(true);
    setError("");
    try {
      const { ...machineData } = form;
      const numericFields = [
        "Colors", "Gripper", "PrintingMargin", "MakeReadyWastageSheet", "MakeReadyWastageRunningMeter",
        "MakeReadyCharges", "MakeReadyTime", "MakeReadyPerHourCost", "JobChangeOverTime",
        "MinimumSheet", "BasicPrintingCharges", "RoundofImpressionsWith",
        "MinWidth", "MaxWidth", "MinLength", "MaxLength",
        "MinRollWidth", "MaxRollWidth", "MinCircumference", "MaxCircumference",
        "MachineSpeed", "ElectricConsumption", "PerHourCost", "OtherCharges",
        "PlateCharges", "MinPrintW", "MaxPrintW", "MinPrintL", "MaxPrintL",
        "MachineWidth", "AverageRollLength", "AverageRollChangeWastage", "RollChangeTime",
        "AvgBreakDownRunningMeters", "AvgBreakDownTime",
        "PurchaseCost", "MachineLifespan", "WorkingHoursPerDay", "WorkingDaysPerYear",
        "AnnualInterestRate", "LoanDuration", "NumberOfOperators", "AvgLaborSalaryPerYear",
      ];
      const record: Record<string, any> = { ...machineData };
      numericFields.forEach(k => {
        const v = record[k];
        const n = Number(v);
        record[k] = (v !== "" && v !== null && !isNaN(n)) ? n : null;
      });
      record.IsPlanningMachine = record.IsPlanningMachine === "true" ? "true" : "false";
      record.IsPerfectaMachine = record.IsPerfectaMachine === "true" ? "true" : "false";
      record.IsVariableCutOff = record.IsVariableCutOff === "true" ? "true" : "false";
      record.IsSpecialMachine = record.IsSpecialMachine === "true" ? "true" : "false";
      record.IsOnLoan = record.IsOnLoan === "true" ? 1 : 0;

      const isEdit = !!editing;
      const payload: Record<string, any> = {
        CostingMachineData: [record],
        ObjMachineSlab: [],
        CoatingRates: [],
        MachineName: form.MachineName,
      };
      if (isEdit) payload.MachineID = String(editing.MachineId ?? editing.MachineID ?? "");

      const endpoint = isEdit ? "updatemachinemaster" : "savemachinemasterdata";
      const res = await fetch(`${BASE_URL}/api/machinemasterShrink/${endpoint}`, {
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

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteMachine = async (row: any) => {
    const mid = String(row.MachineId ?? row.MachineID ?? "");
    if (!confirm("Delete this machine?")) return;
    await fetch(`${BASE_URL}/api/machinemasterShrink/deletemachinemaster`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ VMachineID: mid }),
    });
    loadMachines();
  };

  // ── Grid columns ──────────────────────────────────────────────────────────
  const columns = useMemo((): Column<any>[] => [
    { key: "MachineCode", header: "Code", sortable: true },
    { key: "MachineName", header: "Machine Name", sortable: true },
    {
      key: "DepartmentName", header: "Department", sortable: true,
      render: (r) => {
        const colors: Record<string, string> = { "Printing": "bg-blue-100 text-blue-700", "Lamination": "bg-amber-100 text-amber-700", "Slitting": "bg-emerald-100 text-emerald-700", "Pre-Press": "bg-purple-100 text-purple-700", "Pouch Making": "bg-rose-100 text-rose-700", "QC": "bg-gray-100 text-gray-700" };
        const cls = colors[r.DepartmentName] ?? "bg-gray-100 text-gray-600";
        return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{r.DepartmentName}</span>;
      }
    },
    { key: "MachineType", header: "Type", sortable: true },
    { key: "ProductionUnitName", header: "Production Unit" },
    { key: "MachineSpeed", header: "Speed" },
  ], []);

  const uniqueDepts = useMemo(() => ["All", ...new Set(machines.map(m => m.DepartmentName).filter(Boolean))], [machines]);

  // ── FORM VIEW ─────────────────────────────────────────────────────────────
  if (view === "form") {
    const isEdit = !!editing;
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
              <List size={16} /> Back to List
            </button>
            <button onClick={saveMachine} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save Machine
            </button>
          </div>
        </div>

        {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 pt-5 pb-0 border-b border-gray-200 bg-gray-50/30">
            <div className="flex gap-8">
              {([
                { key: "detail" as const, label: "Details" },
                { key: "specs" as const, label: "Specifications & Costing" },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* DETAILS TAB */}
            {activeTab === "detail" && (
              <div className="space-y-8">
                <div>
                  <SectionTitle title="Basic Information" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Machine Name" required>
                      <input value={form.MachineName} onChange={e => f("MachineName", e.target.value)}
                        className={ic(submitAttempted && !form.MachineName)} placeholder="e.g. Rotogravure Press 01" />
                    </Field>
                    <Field label="Department" required>
                      <SearchSel value={form.DepartmentID} onChange={v => f("DepartmentID", v)}
                        options={departments} placeholder="Select Department..."
                        cls={ic(submitAttempted && !form.DepartmentID)} />
                    </Field>
                    <Field label="Speed Unit">
                      <SearchSel value={form.SpeedUnit} onChange={v => f("SpeedUnit", v)}
                        options={["m/min", "mtr/min", "cyl/hr", "pcs/min", "sheets/hr"].map(x => ({ value: x, label: x }))} />
                    </Field>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button onClick={() => setActiveTab("specs")}
                    className="px-5 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                    Specifications &amp; Costing &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* SPECIFICATIONS & COSTING TAB */}
            {activeTab === "specs" && (
              <div className="space-y-10">

                {/* Common specs — always shown when a department is selected */}
                {currentDeptName ? (
                  <CommonSpecs form={form} f={f} />
                ) : (
                  <div className="text-center py-10 text-gray-400 text-sm">Select a department on the Details tab to see specifications</div>
                )}

                {/* Printing extras — only for DepartmentID 100 (Printing) */}
                {form.DepartmentID === "100" && (
                  <>
                    <div className="border-t-2 border-blue-100" />
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-6">Printing Department — Additional Parameters</p>
                      <PrintingExtras form={form} f={f} />
                    </div>
                  </>
                )}

                <div className="border-t border-gray-200" />

                {/* Costing Parameters — always shown */}
                <div>
                  <SectionTitle title="Costing Parameters" />

                  {/* Purchase & Depreciation */}
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Purchase &amp; Depreciation</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Field label="Purchase Cost">
                        <PrefixInput value={form.PurchaseCost} onChange={(e: any) => f("PurchaseCost", e.target.value)} prefix="₹" placeholder="e.g. 5000000" type="number" />
                      </Field>
                      <Field label="Machine Lifespan">
                        <SuffixInput value={form.MachineLifespan} onChange={(e: any) => f("MachineLifespan", e.target.value)} suffix="yrs" placeholder="e.g. 10" type="number" />
                      </Field>
                      <Field label="Working Hours / Day">
                        <SuffixInput value={form.WorkingHoursPerDay} onChange={(e: any) => f("WorkingHoursPerDay", e.target.value)} suffix="hrs" placeholder="e.g. 8" type="number" />
                      </Field>
                      <Field label="Working Days / Year">
                        <SuffixInput value={form.WorkingDaysPerYear} onChange={(e: any) => f("WorkingDaysPerYear", e.target.value)} suffix="days" placeholder="e.g. 300" type="number" />
                      </Field>
                    </div>
                  </div>

                  {/* Loan Details */}
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Loan Details</p>
                    <div className="flex items-center gap-3 mb-4">
                      <button type="button"
                        onClick={() => f("IsOnLoan", form.IsOnLoan === "true" ? "false" : "true")}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.IsOnLoan === "true" ? "bg-blue-600" : "bg-gray-300"}`}>
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.IsOnLoan === "true" ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                      <span className="text-sm font-medium text-gray-700">Machine is on Loan / Financed</span>
                    </div>
                    {form.IsOnLoan === "true" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Field label="Annual Interest Rate">
                          <SuffixInput value={form.AnnualInterestRate} onChange={(e: any) => f("AnnualInterestRate", e.target.value)} suffix="% p.a." placeholder="e.g. 9" type="number" />
                        </Field>
                        <Field label="Loan Duration">
                          <SuffixInput value={form.LoanDuration} onChange={(e: any) => f("LoanDuration", e.target.value)} suffix="yrs" placeholder="e.g. 5" type="number" />
                        </Field>
                      </div>
                    )}
                  </div>

                  {/* Labor */}
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Labor</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Field label="Number of Operators">
                        <SuffixInput value={form.NumberOfOperators} onChange={(e: any) => f("NumberOfOperators", e.target.value)} suffix="operators" placeholder="e.g. 4" type="number" />
                      </Field>
                      <Field label="Avg. Salary per Operator / Year">
                        <PrefixInput value={form.AvgLaborSalaryPerYear} onChange={(e: any) => f("AvgLaborSalaryPerYear", e.target.value)} prefix="₹" placeholder="e.g. 300000" type="number" />
                      </Field>
                    </div>
                  </div>

                  {/* Auto-calculated: Per Hour Labor Cost */}
                  <div className="mb-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50/60">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Per Hour Labor Cost (Auto-Calculated)</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-emerald-800">
                        {calcPerHourLaborCost ? `₹ ${calcPerHourLaborCost}` : "—"}
                      </span>
                      {calcPerHourLaborCost && <span className="text-xs text-emerald-500">per hour</span>}
                    </div>
                    {!calcPerHourLaborCost && (
                      <p className="text-xs text-emerald-400 mt-1">Fill Operators, Avg Salary, Working Hours &amp; Days above to calculate.</p>
                    )}
                    {calcPerHourLaborCost && (
                      <p className="text-xs text-emerald-600 mt-1">{form.NumberOfOperators} operator{parseFloat(form.NumberOfOperators) !== 1 ? "s" : ""} × ₹{parseFloat(form.AvgLaborSalaryPerYear).toLocaleString("en-IN")}/yr ÷ ({form.WorkingDaysPerYear} days × {form.WorkingHoursPerDay} hrs)</p>
                    )}
                  </div>

                  {/* Auto-calculated: Machine Cost Per Hour */}
                  <div className="mb-6 p-4 rounded-xl border border-blue-200 bg-blue-50/60">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Machine Cost Per Hour (Auto-Calculated)</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-blue-800">
                        {calcPerHourCost ? `₹ ${calcPerHourCost}` : "—"}
                      </span>
                      {calcPerHourCost && <span className="text-xs text-blue-500">per hour</span>}
                    </div>
                    {!calcPerHourCost && (
                      <p className="text-xs text-blue-400 mt-1">Fill Purchase Cost, Lifespan, and Working Hours above to calculate.</p>
                    )}
                    {calcPerHourCost && form.IsOnLoan === "true" && (
                      <p className="text-xs text-amber-600 mt-1 font-medium">Includes interest at {form.AnnualInterestRate}% p.a.</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button onClick={() => setActiveTab("detail")} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    &larr; Details
                  </button>
                  <button onClick={saveMachine} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 shadow-sm">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
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

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Machine Master</h2>
          <p className="text-sm text-gray-500">{filteredMachines.length} of {machines.length} machines</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">
          <Plus size={16} /> Add Machine
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
            <Loader2 size={24} className="animate-spin mr-2" /> Loading machines...
          </div>
        ) : (
          <DataTable
            data={filteredMachines.map((m, i) => ({ ...m, id: String(m.MachineId ?? m.MachineID ?? i) }))}
            columns={columns}
            searchKeys={["MachineName", "MachineCode", "MachineType", "DepartmentName", "ProductionUnitName"]}
            actions={(row) => (
              <div className="flex items-center gap-2 justify-end">
                <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteMachine(row)}>Delete</Button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
