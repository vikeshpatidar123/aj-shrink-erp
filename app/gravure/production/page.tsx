"use client";
import { useState, useMemo } from "react";
import {
  Plus, Eye, Pencil, Trash2, PlayCircle,
  Play, Pause, Square, RotateCcw,
  Gauge, BarChart2, Package, Layers, FileText, Clock,
} from "lucide-react";
import {
  gravureProductionEntries as initData,
  gravureWorkOrders,
  gravureItemIssues,
  GravureProductionEntry,
  MaterialConsumptionLine,
  ProductionProcessEntry,
} from "@/data/dummyData";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

// ─── HELPERS ─────────────────────────────────────────────────
const nowTime = () => new Date().toTimeString().slice(0, 5);

const STATUS_COLOR: Record<string, string> = {
  "Pending":     "bg-gray-100 text-gray-600 border-gray-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  "Completed":   "bg-green-100 text-green-700 border-green-200",
  "On Hold":     "bg-amber-100 text-amber-700 border-amber-200",
};
const MACHINE_COLOR: Record<string, string> = {
  "Pending":  "bg-gray-100 text-gray-600",
  "Running":  "bg-green-100 text-green-700",
  "On Hold":  "bg-amber-100 text-amber-700",
  "Stopped":  "bg-red-100 text-red-600",
};
const QUALITY_COLOR: Record<string, string> = {
  "Good":     "bg-green-50 text-green-700 border-green-200",
  "Rework":   "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Rejected": "bg-red-50 text-red-600 border-red-200",
};

// ─── TABS ─────────────────────────────────────────────────────
const TABS = [
  { id: "machine",  label: "Machine Control",      icon: Gauge },
  { id: "output",   label: "Production Output",    icon: BarChart2 },
  { id: "material", label: "Material Consumption", icon: Package },
  { id: "process",  label: "Process Entry",        icon: Layers },
  { id: "summary",  label: "Summary",              icon: FileText },
] as const;
type TabId = typeof TABS[number]["id"];

// ─── BLANK FORM ───────────────────────────────────────────────
type FormState = Omit<GravureProductionEntry, "id" | "entryNo">;

const blankForm = (): FormState => ({
  date: new Date().toISOString().slice(0, 10),
  shift: "A",
  workOrderId: "", workOrderNo: "",
  customerId: "", customerName: "", jobName: "",
  machineId: "", machineName: "",
  operatorName: "", supervisorName: "",
  machineStatus: "Pending",
  startTime: "", pauseTime: "", resumeTime: "", stopTime: "",
  pauseReason: "",
  totalRunTime: 0, downtime: 0,
  producedQty: 0, goodQty: 0, rejectedQty: 0, wastageQty: 0, netQty: 0,
  efficiencyPct: 0, wastagePct: 0,
  speed: 0, machineRuntime: 0, machineUtilPct: 0,
  totalMeterRun: 0, wasteMeter: 0, netMeter: 0,
  noOfColors: 0, cylinderCode: "", impressionCount: 0,
  materialLines: [],
  processEntries: [],
  substrate: "", rollNo: "",
  inkConsumption: 0,
  printQuality: "Good",
  status: "Pending",
  remarks: "",
});

// ─── COMPONENT ────────────────────────────────────────────────
export default function GravureProductionPage() {
  const [data, setData]         = useState<GravureProductionEntry[]>(initData);
  const [modalOpen, setModal]   = useState(false);
  const [viewRow, setViewRow]   = useState<GravureProductionEntry | null>(null);
  const [editing, setEditing]   = useState<GravureProductionEntry | null>(null);
  const [form, setForm]         = useState<FormState>(blankForm());
  const [activeTab, setActiveTab] = useState<TabId>("machine");

  const f = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── live derived values
  const netQty     = form.producedQty - form.wastageQty;
  const wastagePct = form.producedQty > 0
    ? parseFloat((form.wastageQty / form.producedQty * 100).toFixed(1)) : 0;
  const netMeter   = form.totalMeterRun - form.wasteMeter;
  const prodSpeed  = form.machineRuntime > 0
    ? parseFloat((form.totalMeterRun / (form.machineRuntime * 60)).toFixed(1)) : 0;
  const utilPct    = form.machineRuntime > 0 && form.totalRunTime > 0
    ? parseFloat(((form.totalRunTime - form.downtime) / (form.machineRuntime * 60) * 100).toFixed(1))
    : 0;
  const consPerMeter = netMeter > 0
    ? form.materialLines.map(m => ({ name: m.itemName, val: (m.actualQty / netMeter).toFixed(4), unit: m.unit }))
    : [];

  // ── WO auto-fill
  const loadFromWO = (woId: string) => {
    const wo = gravureWorkOrders.find(w => w.id === woId);
    if (!wo) { f("workOrderId", ""); return; }
    const issue = gravureItemIssues.find(i => i.workOrderId === woId);
    const mats: MaterialConsumptionLine[] = issue
      ? issue.items.map(it => ({
          itemId: it.itemId, itemName: it.itemName,
          itemType: it.itemType as MaterialConsumptionLine["itemType"],
          plannedQty: it.requiredQty, actualQty: 0, unit: it.unit, variance: -it.requiredQty,
        }))
      : [
          { itemId: "", itemName: "Film / Substrate", itemType: "Film",    plannedQty: 0, actualQty: 0, unit: "Kg",  variance: 0 },
          { itemId: "", itemName: "Ink",              itemType: "Ink",     plannedQty: 0, actualQty: 0, unit: "Kg",  variance: 0 },
          { itemId: "", itemName: "Solvent",           itemType: "Solvent", plannedQty: 0, actualQty: 0, unit: "Ltr", variance: 0 },
          { itemId: "", itemName: "Adhesive",          itemType: "Adhesive",plannedQty: 0, actualQty: 0, unit: "Kg",  variance: 0 },
        ];
    const procs: ProductionProcessEntry[] = wo.processes.length > 0
      ? wo.processes.map((p, i) => ({
          id: String(i + 1), processName: p.processName,
          startTime: "", endTime: "", outputQty: 0, wastageQty: 0, remarks: "",
        }))
      : [{ id: "1", processName: "Printing", startTime: "", endTime: "", outputQty: 0, wastageQty: 0, remarks: "" }];
    setForm(p => ({
      ...p,
      workOrderId: wo.id, workOrderNo: wo.workOrderNo,
      customerId: wo.customerId, customerName: wo.customerName, jobName: wo.jobName,
      machineId: wo.machineId, machineName: wo.machineName,
      operatorName: wo.operatorName, substrate: wo.substrate,
      noOfColors: wo.noOfColors, cylinderCode: wo.cylinderSet || "",
      totalMeterRun: wo.quantity,
      materialLines: mats, processEntries: procs,
    }));
  };

  // ── machine control
  const startMachine  = () => setForm(p => ({ ...p, startTime: nowTime(),  machineStatus: "Running",  status: "In Progress" }));
  const pauseMachine  = () => setForm(p => ({ ...p, pauseTime: nowTime(),  machineStatus: "On Hold" }));
  const resumeMachine = () => setForm(p => ({ ...p, resumeTime: nowTime(), machineStatus: "Running" }));
  const stopMachine   = () => setForm(p => ({ ...p, stopTime: nowTime(),   machineStatus: "Stopped",  status: "Completed" }));

  // ── material helpers
  const updateMat = (i: number, k: keyof MaterialConsumptionLine, v: string | number) =>
    setForm(p => {
      const lines = [...p.materialLines];
      lines[i] = { ...lines[i], [k]: v };
      if (k === "actualQty" || k === "plannedQty")
        lines[i].variance = Number(lines[i].actualQty) - Number(lines[i].plannedQty);
      return { ...p, materialLines: lines };
    });
  const addMat    = () => setForm(p => ({ ...p, materialLines: [...p.materialLines, { itemId: "", itemName: "", itemType: "Other", plannedQty: 0, actualQty: 0, unit: "Kg", variance: 0 }] }));
  const removeMat = (i: number) => setForm(p => ({ ...p, materialLines: p.materialLines.filter((_, x) => x !== i) }));

  // ── process helpers
  const updateProc = (i: number, k: keyof ProductionProcessEntry, v: string | number) =>
    setForm(p => { const e = [...p.processEntries]; e[i] = { ...e[i], [k]: v }; return { ...p, processEntries: e }; });
  const addProc    = () => setForm(p => ({ ...p, processEntries: [...p.processEntries, { id: String(Date.now()), processName: "", startTime: "", endTime: "", outputQty: 0, wastageQty: 0, remarks: "" }] }));
  const removeProc = (i: number) => setForm(p => ({ ...p, processEntries: p.processEntries.filter((_, x) => x !== i) }));

  // ── open / save
  const openAdd = () => { setEditing(null); setForm(blankForm()); setActiveTab("machine"); setModal(true); };
  const openEdit = (row: GravureProductionEntry) => {
    setEditing(row);
    const { id, entryNo, ...rest } = row;
    setForm(rest as FormState);
    setActiveTab("machine");
    setModal(true);
  };
  const save = () => {
    if (!form.workOrderId) return;
    const record = { ...form, netQty, wastagePct, netMeter, goodQty: netQty - form.rejectedQty };
    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...record, id: editing.id, entryNo: editing.entryNo } : r));
    } else {
      const entryNo = generateCode(UNIT_CODE.Gravure, MODULE_CODE.Production, data.map(d => d.entryNo));
      const id = `GPE${String(data.length + 1).padStart(3, "0")}`;
      setData(d => [...d, { ...record, id, entryNo }]);
    }
    setModal(false);
  };

  // ── navigation helpers
  const goTab = (dir: 1 | -1) => {
    const idx = TABS.findIndex(t => t.id === activeTab);
    const next = TABS[idx + dir];
    if (next) setActiveTab(next.id);
  };

  // ── summary stats
  const totalProduced = useMemo(() => data.reduce((s, d) => s + d.producedQty, 0), [data]);
  const totalWastage  = useMemo(() => data.reduce((s, d) => s + d.wastageQty, 0), [data]);
  const totalNet      = useMemo(() => data.reduce((s, d) => s + d.netQty, 0), [data]);
  const avgWaste      = totalProduced > 0 ? (totalWastage / totalProduced * 100).toFixed(1) : "0";
  const statusCounts  = useMemo(() => {
    const c = { Pending: 0, "In Progress": 0, Completed: 0, "On Hold": 0 };
    data.forEach(d => { if (d.status in c) c[d.status as keyof typeof c]++; });
    return c;
  }, [data]);

  // ── columns
  const columns: Column<GravureProductionEntry>[] = [
    { key: "entryNo",      header: "Entry No",   sortable: true },
    { key: "date",         header: "Date",        sortable: true },
    { key: "workOrderNo",  header: "Work Order" },
    { key: "customerName", header: "Customer",    render: r => <span className="text-xs text-gray-600">{r.customerName}</span> },
    { key: "machineName",  header: "Machine",     render: r => <span className="text-xs">{r.machineName}</span> },
    { key: "shift",        header: "Shift",       render: r => <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-purple-50 text-purple-700 border-purple-200">Shift {r.shift}</span> },
    { key: "status",       header: "Status",      render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[r.status]}`}>{r.status}</span> },
    { key: "producedQty",  header: "Produced",    render: r => <span>{r.producedQty.toLocaleString()} m</span> },
    { key: "wastageQty",   header: "Wastage",     render: r => <span className="text-red-500 font-medium">{r.wastageQty.toLocaleString()} m</span> },
    { key: "netQty",       header: "Net (m)",     render: r => <span className="font-semibold text-green-700">{r.netQty.toLocaleString()} m</span> },
    { key: "printQuality", header: "Quality",     render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${QUALITY_COLOR[r.printQuality]}`}>{r.printQuality}</span> },
  ];

  // ── reusable stat card
  const StatCard = ({ label, val, cls }: { label: string; val: string; cls: string }) => (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-xl font-bold mt-1">{val}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <PlayCircle size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Production Entry</h2>
          </div>
          <p className="text-sm text-gray-500">{data.length} entries · {totalNet.toLocaleString()} m net produced</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Entry</Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Produced"  val={`${totalProduced.toLocaleString()} m`} cls="bg-blue-50 text-blue-700 border-blue-200" />
        <StatCard label="Total Wastage"   val={`${totalWastage.toLocaleString()} m`}  cls="bg-red-50 text-red-700 border-red-200" />
        <StatCard label="Net Production"  val={`${totalNet.toLocaleString()} m`}       cls="bg-green-50 text-green-700 border-green-200" />
        <StatCard label="Avg Wastage %"   val={`${avgWaste}%`}                         cls="bg-yellow-50 text-yellow-700 border-yellow-200" />
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(["Pending", "In Progress", "Completed", "On Hold"] as const).map(s => (
          <div key={s} className={`rounded-xl border p-4 ${STATUS_COLOR[s]}`}>
            <p className="text-xs font-medium">{s}</p>
            <p className="text-2xl font-bold mt-1">{statusCounts[s]}</p>
          </div>
        ))}
      </div>

      {/* DataTable */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["entryNo", "workOrderNo", "machineName", "customerName"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setData(d => d.filter(r => r.id !== row.id))}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* ═══════════════════ FORM MODAL ═══════════════════ */}
      <Modal
        open={modalOpen}
        onClose={() => setModal(false)}
        title={editing ? "Edit Production Entry" : "New Gravure Production Entry"}
        size="xl"
      >
        {/* Tab Bar */}
        <div className="flex border-b border-gray-200 mb-5 -mt-1 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon size={14} />{t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: Machine Control ── */}
        {activeTab === "machine" && (
          <div className="space-y-5">
            {/* Header Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
              <Select
                label="Work Order *"
                value={form.workOrderId}
                onChange={e => loadFromWO(e.target.value)}
                options={[
                  { value: "", label: "-- Select Work Order --" },
                  ...gravureWorkOrders
                    .filter(w => w.status !== "Completed")
                    .map(w => ({ value: w.id, label: `${w.workOrderNo} – ${w.customerName}` })),
                ]}
              />
              <Select
                label="Shift"
                value={form.shift}
                onChange={e => f("shift", e.target.value as "A" | "B" | "C")}
                options={[{ value: "A", label: "Shift A (07:00–15:00)" }, { value: "B", label: "Shift B (15:00–23:00)" }, { value: "C", label: "Shift C (23:00–07:00)" }]}
              />
              <Input label="Machine" value={form.machineName} readOnly className="bg-gray-50" placeholder="Auto-filled from WO" />
              <Input label="Operator Name" value={form.operatorName} onChange={e => f("operatorName", e.target.value)} placeholder="Operator" />
              <Input label="Supervisor Name" value={form.supervisorName} onChange={e => f("supervisorName", e.target.value)} placeholder="Supervisor" />
              <Input label="Roll No" value={form.rollNo} onChange={e => f("rollNo", e.target.value)} placeholder="e.g. GRV-ROLL-005" />
              <Input label="Substrate" value={form.substrate} readOnly className="bg-gray-50" placeholder="Auto-filled from WO" />
            </div>

            {/* Machine Status Panel */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Machine Status:</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${MACHINE_COLOR[form.machineStatus]}`}>
                    {form.machineStatus === "Running" && (
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    )}
                    {form.machineStatus}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {form.machineStatus === "Pending" && (
                    <Button onClick={startMachine} icon={<Play size={14} />} className="!bg-green-600 hover:!bg-green-700">
                      Start Machine
                    </Button>
                  )}
                  {form.machineStatus === "Running" && (<>
                    <Button variant="secondary" onClick={pauseMachine} icon={<Pause size={14} />}>Pause / Hold</Button>
                    <Button variant="danger" onClick={stopMachine} icon={<Square size={14} />}>Stop Machine</Button>
                  </>)}
                  {form.machineStatus === "On Hold" && (<>
                    <Button onClick={resumeMachine} icon={<RotateCcw size={14} />}>Resume</Button>
                    <Button variant="danger" onClick={stopMachine} icon={<Square size={14} />}>Stop Machine</Button>
                  </>)}
                  {form.machineStatus === "Stopped" && (
                    <span className="text-sm text-gray-500 italic px-2">Production Stopped</span>
                  )}
                </div>
              </div>

              {/* Time Capture */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Input label="Start Time" type="time" value={form.startTime} onChange={e => f("startTime", e.target.value)} />
                <Input label="Pause Time" type="time" value={form.pauseTime} onChange={e => f("pauseTime", e.target.value)} />
                <Input label="Resume Time" type="time" value={form.resumeTime} onChange={e => f("resumeTime", e.target.value)} />
                <Input label="Stop Time" type="time" value={form.stopTime} onChange={e => f("stopTime", e.target.value)} />
              </div>

              {/* Pause Reason */}
              {(form.machineStatus === "On Hold" || !!form.pauseTime) && (
                <Select
                  label="Pause / Hold Reason"
                  value={form.pauseReason}
                  onChange={e => f("pauseReason", e.target.value as FormState["pauseReason"])}
                  options={[
                    { value: "",          label: "-- Select Reason --" },
                    { value: "Breakdown", label: "Machine Breakdown" },
                    { value: "Ink Issue", label: "Ink Issue" },
                    { value: "Cylinder",  label: "Cylinder Problem" },
                    { value: "Power",     label: "Power Cut" },
                  ]}
                />
              )}

              {/* Run Time & Downtime */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Total Run Time (min)" type="number" value={form.totalRunTime} onChange={e => f("totalRunTime", Number(e.target.value))} />
                <Input label="Downtime (min)" type="number" value={form.downtime} onChange={e => f("downtime", Number(e.target.value))} />
              </div>
            </div>

            {/* Status Override */}
            <Select
              label="Entry Status"
              value={form.status}
              onChange={e => f("status", e.target.value as FormState["status"])}
              options={[
                { value: "Pending",     label: "Pending" },
                { value: "In Progress", label: "In Progress" },
                { value: "Completed",   label: "Completed" },
                { value: "On Hold",     label: "On Hold" },
              ]}
            />
          </div>
        )}

        {/* ── TAB 2: Production Output ── */}
        {activeTab === "output" && (
          <div className="space-y-5">
            {/* Quantity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input label="Produced Qty (m)" type="number" value={form.producedQty} onChange={e => f("producedQty", Number(e.target.value))} />
              <Input label="Good Qty (m)" type="number" value={form.goodQty} onChange={e => f("goodQty", Number(e.target.value))} />
              <Input label="Rejected Qty (m)" type="number" value={form.rejectedQty} onChange={e => f("rejectedQty", Number(e.target.value))} />
              <Input label="Wastage Qty (m)" type="number" value={form.wastageQty} onChange={e => f("wastageQty", Number(e.target.value))} />
            </div>

            {/* Auto-calc cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Net Qty</p>
                <p className="text-xl font-bold text-green-700">{netQty.toLocaleString()} m</p>
              </div>
              <div className={`rounded-xl border p-3 ${wastagePct > 4 ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
                <p className="text-xs text-gray-500">Wastage %</p>
                <p className={`text-xl font-bold ${wastagePct > 4 ? "text-red-600" : "text-yellow-700"}`}>{wastagePct.toFixed(1)}%</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Calc Speed</p>
                <p className="text-xl font-bold text-blue-700">{prodSpeed} m/min</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">Utilization</p>
                <p className="text-xl font-bold text-purple-700">{utilPct}%</p>
              </div>
            </div>

            {/* Speed / Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input label="Machine Speed (m/min)" type="number" value={form.speed} onChange={e => f("speed", Number(e.target.value))} />
              <Input label="Machine Runtime (hr)" type="number" value={form.machineRuntime} step={0.5} onChange={e => f("machineRuntime", Number(e.target.value))} />
              <Input label="Ink Consumption (Kg)" type="number" value={form.inkConsumption} step={0.1} onChange={e => f("inkConsumption", Number(e.target.value))} />
              <Select
                label="Print Quality"
                value={form.printQuality}
                onChange={e => f("printQuality", e.target.value as FormState["printQuality"])}
                options={[
                  { value: "Good",     label: "Good – Approved" },
                  { value: "Rework",   label: "Rework Required" },
                  { value: "Rejected", label: "Rejected" },
                ]}
              />
            </div>

            {/* Running Meter Tracking */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Gauge size={14} className="text-purple-500" /> Running Meter Tracking
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input label="Total Meter Run (m)" type="number" value={form.totalMeterRun} onChange={e => f("totalMeterRun", Number(e.target.value))} />
                <Input label="Waste Meter (m)" type="number" value={form.wasteMeter} onChange={e => f("wasteMeter", Number(e.target.value))} />
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex flex-col justify-center">
                  <p className="text-xs text-gray-500">Net Meter</p>
                  <p className="text-xl font-bold text-green-700">{netMeter.toLocaleString()} m</p>
                </div>
              </div>
            </div>

            {/* Color / Cylinder */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Color / Cylinder Tracking</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input label="No. of Colors Used" type="number" value={form.noOfColors} onChange={e => f("noOfColors", Number(e.target.value))} />
                <Input label="Cylinder Code" value={form.cylinderCode} onChange={e => f("cylinderCode", e.target.value)} placeholder="CYL-001" />
                <Input label="Impression Count" type="number" value={form.impressionCount} onChange={e => f("impressionCount", Number(e.target.value))} />
              </div>
            </div>

            <Textarea label="Remarks / Observations" value={form.remarks} onChange={e => f("remarks", e.target.value)} placeholder="Color issues, machine stoppages, quality notes..." />
          </div>
        )}

        {/* ── TAB 3: Material Consumption ── */}
        {activeTab === "material" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">Material Consumption — Planned vs Actual</h4>
              <Button size="sm" icon={<Plus size={13} />} onClick={addMat}>Add Item</Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium text-gray-600 border-b">
                    <th className="text-left p-2.5">Item Name</th>
                    <th className="text-left p-2.5">Type</th>
                    <th className="text-right p-2.5">Planned</th>
                    <th className="text-right p-2.5">Actual</th>
                    <th className="text-left p-2.5">Unit</th>
                    <th className="text-right p-2.5">Variance</th>
                    <th className="p-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.materialLines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-gray-400 py-8 text-xs">
                        No materials. Select a Work Order to auto-load, or add manually.
                      </td>
                    </tr>
                  )}
                  {form.materialLines.map((m, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-1.5">
                        <input
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
                          value={m.itemName} onChange={e => updateMat(i, "itemName", e.target.value)} placeholder="Item name"
                        />
                      </td>
                      <td className="p-1.5">
                        <select
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-full focus:outline-none"
                          value={m.itemType} onChange={e => updateMat(i, "itemType", e.target.value)}
                        >
                          {["Film", "Ink", "Solvent", "Adhesive", "Other"].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1.5">
                        <input type="number" className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none"
                          value={m.plannedQty} onChange={e => updateMat(i, "plannedQty", Number(e.target.value))} />
                      </td>
                      <td className="p-1.5">
                        <input type="number" className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none"
                          value={m.actualQty} onChange={e => updateMat(i, "actualQty", Number(e.target.value))} />
                      </td>
                      <td className="p-1.5">
                        <input className="w-14 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                          value={m.unit} onChange={e => updateMat(i, "unit", e.target.value)} />
                      </td>
                      <td className="p-1.5 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          m.variance > 0 ? "bg-red-50 text-red-600" : m.variance < 0 ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                        }`}>
                          {m.variance > 0 ? "+" : ""}{m.variance.toFixed(1)}
                        </span>
                      </td>
                      <td className="p-1.5 text-center">
                        <button onClick={() => removeMat(i)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Consumption per meter */}
            {consPerMeter.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-blue-700 mb-2">Material Consumption per Net Meter</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {consPerMeter.map((c, i) => (
                    <div key={i} className="bg-white rounded-lg border border-blue-100 p-2">
                      <p className="text-xs text-gray-500 truncate">{c.name || `Item ${i + 1}`}</p>
                      <p className="text-sm font-bold text-blue-700">{c.val} {c.unit}/m</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: Process Entry ── */}
        {activeTab === "process" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">Process-wise Entry</h4>
              <Button size="sm" icon={<Plus size={13} />} onClick={addProc}>Add Process</Button>
            </div>

            {form.processEntries.length === 0 && (
              <div className="text-center text-gray-400 py-10 text-xs border border-dashed border-gray-200 rounded-xl">
                No processes added. Select a Work Order or click "Add Process".
              </div>
            )}

            <div className="space-y-3">
              {form.processEntries.map((p, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                      Process {i + 1}
                    </span>
                    <button onClick={() => removeProc(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Process Name</label>
                      <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                        value={p.processName} onChange={e => updateProc(i, "processName", e.target.value)}
                        placeholder="e.g. Printing, Lamination"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Start Time</label>
                      <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                        value={p.startTime} onChange={e => updateProc(i, "startTime", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">End Time</label>
                      <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                        value={p.endTime} onChange={e => updateProc(i, "endTime", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Output Qty (m)</label>
                      <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                        value={p.outputQty} onChange={e => updateProc(i, "outputQty", Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Wastage (m)</label>
                      <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                        value={p.wastageQty} onChange={e => updateProc(i, "wastageQty", Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Remarks</label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                        value={p.remarks} onChange={e => updateProc(i, "remarks", e.target.value)} placeholder="Notes..." />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 5: Summary ── */}
        {activeTab === "summary" && (
          <div className="space-y-4 text-sm">
            {/* Entry Details */}
            <div className="bg-gray-50 rounded-xl border p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Entry Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  ["Date", form.date], ["Work Order", form.workOrderNo || "—"], ["Customer", form.customerName || "—"],
                  ["Job Name", form.jobName || "—"], ["Machine", form.machineName || "—"], ["Shift", `Shift ${form.shift}`],
                  ["Operator", form.operatorName || "—"], ["Supervisor", form.supervisorName || "—"],
                  ["Roll No", form.rollNo || "—"], ["Substrate", form.substrate || "—"],
                  ["Status", form.status], ["Machine Status", form.machineStatus],
                ].map(([k, v]) => (
                  <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-800">{v}</p></div>
                ))}
              </div>
            </div>

            {/* Machine Control */}
            <div className="bg-gray-50 rounded-xl border p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Machine Control</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  ["Start Time", form.startTime || "—"], ["Pause Time", form.pauseTime || "—"],
                  ["Resume Time", form.resumeTime || "—"], ["Stop Time", form.stopTime || "—"],
                  ["Run Time (min)", String(form.totalRunTime)], ["Downtime (min)", String(form.downtime)],
                  ["Pause Reason", form.pauseReason || "—"],
                ].map(([k, v]) => (
                  <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-800">{v}</p></div>
                ))}
              </div>
            </div>

            {/* Production Output */}
            <div className="bg-gray-50 rounded-xl border p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Production Output</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { l: "Produced",     v: `${form.producedQty.toLocaleString()} m`,   c: "bg-blue-50 text-blue-700 border-blue-200" },
                  { l: "Good Qty",     v: `${(netQty - form.rejectedQty).toLocaleString()} m`, c: "bg-green-50 text-green-700 border-green-200" },
                  { l: "Wastage",      v: `${form.wastageQty.toLocaleString()} m (${wastagePct.toFixed(1)}%)`, c: `${wastagePct > 4 ? "bg-red-50 text-red-600 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}` },
                  { l: "Rejected",     v: `${form.rejectedQty.toLocaleString()} m`,   c: "bg-orange-50 text-orange-700 border-orange-200" },
                  { l: "Speed",        v: `${form.speed} m/min`,                       c: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                  { l: "Runtime",      v: `${form.machineRuntime} hr`,                 c: "bg-purple-50 text-purple-700 border-purple-200" },
                  { l: "Total Meter",  v: `${form.totalMeterRun.toLocaleString()} m`, c: "bg-teal-50 text-teal-700 border-teal-200" },
                  { l: "Net Meter",    v: `${netMeter.toLocaleString()} m`,            c: "bg-green-50 text-green-700 border-green-200" },
                ].map(s => (
                  <div key={s.l} className={`rounded-xl border p-3 ${s.c}`}>
                    <p className="text-xs opacity-70">{s.l}</p>
                    <p className="font-bold text-sm">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Material */}
            {form.materialLines.length > 0 && (
              <div className="bg-gray-50 rounded-xl border p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Material Consumption</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b">
                      <th className="text-left pb-2">Item</th>
                      <th className="text-right pb-2">Planned</th>
                      <th className="text-right pb-2">Actual</th>
                      <th className="text-right pb-2">Variance</th>
                      <th className="text-left pb-2 pl-2">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.materialLines.map((m, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1.5">{m.itemName}</td>
                        <td className="text-right">{m.plannedQty}</td>
                        <td className="text-right">{m.actualQty}</td>
                        <td className={`text-right font-semibold ${m.variance > 0 ? "text-red-600" : "text-green-700"}`}>
                          {m.variance > 0 ? "+" : ""}{m.variance.toFixed(1)}
                        </td>
                        <td className="pl-2 text-gray-500">{m.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Processes */}
            {form.processEntries.length > 0 && (
              <div className="bg-gray-50 rounded-xl border p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Process Entries</p>
                <div className="space-y-2">
                  {form.processEntries.map((p, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-lg p-3">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-800">{p.processName || `Process ${i + 1}`}</span>
                        <span className="text-xs text-gray-400">{p.startTime || "—"} – {p.endTime || "—"}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                        <span>Output: <b>{p.outputQty} m</b></span>
                        <span>Waste: <b className="text-red-600">{p.wastageQty} m</b></span>
                        <span className="text-gray-500 truncate">{p.remarks}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {form.remarks && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Remarks:</strong> {form.remarks}
              </div>
            )}
          </div>
        )}

        {/* Footer Nav */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => goTab(-1)}
            className={activeTab === "machine" ? "invisible" : ""}
          >
            ← Previous
          </Button>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            {activeTab !== "summary" ? (
              <Button onClick={() => goTab(1)}>Next →</Button>
            ) : (
              <Button onClick={save}>{editing ? "Update Entry" : "Save Entry"}</Button>
            )}
          </div>
        </div>
      </Modal>

      {/* ═══════════════════ VIEW MODAL ═══════════════════ */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Production Entry – ${viewRow.entryNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["Date", viewRow.date], ["Work Order", viewRow.workOrderNo],
                ["Customer", viewRow.customerName], ["Job", viewRow.jobName],
                ["Machine", viewRow.machineName], ["Shift", `Shift ${viewRow.shift}`],
                ["Operator", viewRow.operatorName || "—"], ["Supervisor", viewRow.supervisorName || "—"],
                ["Roll No", viewRow.rollNo], ["Substrate", viewRow.substrate],
              ].map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { l: "Produced", v: `${viewRow.producedQty.toLocaleString()} m`, c: "bg-blue-50 text-blue-700 border-blue-200" },
                { l: "Net Qty",  v: `${viewRow.netQty.toLocaleString()} m`,       c: "bg-green-50 text-green-700 border-green-200" },
                { l: "Wastage",  v: `${viewRow.wastageQty.toLocaleString()} m`,   c: "bg-red-50 text-red-600 border-red-200" },
                { l: "Ink Used", v: `${viewRow.inkConsumption} Kg`,               c: "bg-indigo-50 text-indigo-700 border-indigo-200" },
              ].map(s => (
                <div key={s.l} className={`rounded-xl border p-3 ${s.c}`}>
                  <p className="text-xs opacity-70">{s.l}</p>
                  <p className="font-bold">{s.v}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${QUALITY_COLOR[viewRow.printQuality]}`}>
                Quality: {viewRow.printQuality}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLOR[viewRow.status]}`}>
                {viewRow.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${MACHINE_COLOR[viewRow.machineStatus]}`}>
                Machine: {viewRow.machineStatus}
              </span>
            </div>

            {viewRow.materialLines && viewRow.materialLines.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Material Consumption</p>
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-500 border-b">
                    <th className="text-left pb-1.5">Item</th>
                    <th className="text-right pb-1.5">Planned</th>
                    <th className="text-right pb-1.5">Actual</th>
                    <th className="text-right pb-1.5">Variance</th>
                    <th className="text-left pb-1.5 pl-2">Unit</th>
                  </tr></thead>
                  <tbody>
                    {viewRow.materialLines.map((m, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1.5">{m.itemName}</td>
                        <td className="text-right">{m.plannedQty}</td>
                        <td className="text-right">{m.actualQty}</td>
                        <td className={`text-right font-semibold ${m.variance > 0 ? "text-red-600" : "text-green-700"}`}>
                          {m.variance > 0 ? "+" : ""}{m.variance.toFixed(1)}
                        </td>
                        <td className="pl-2 text-gray-500">{m.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {viewRow.processEntries && viewRow.processEntries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Process Entries</p>
                <div className="space-y-2">
                  {viewRow.processEntries.map((p, i) => (
                    <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                      <div className="flex justify-between mb-1">
                        <span className="font-semibold text-gray-800">{p.processName}</span>
                        <span className="text-gray-400">{p.startTime} – {p.endTime}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                        <span>Output: <b>{p.outputQty} m</b></span>
                        <span>Waste: <b className="text-red-600">{p.wastageQty} m</b></span>
                        <span className="text-gray-500">{p.remarks}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewRow.remarks && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Remarks:</strong> {viewRow.remarks}
              </div>
            )}
          </div>
          <div className="flex justify-end mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
