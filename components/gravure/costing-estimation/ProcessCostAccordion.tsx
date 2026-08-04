"use client";
/**
 * ProcessCostAccordion — "Process List" + "Loan & Labour Cost Calculator"
 * grouping for the Gravure Costing Estimation rewrite. Copied verbatim (JSX
 * unchanged) from the legacy `app/gravure/costing-estimation/page.tsx`:
 *   1. Process List — `{/* ── Process List ── *}` table (form.processes rows:
 *      process picker from masters.ROTO_PROCESSES, machine picker from
 *      masters.PRINT_MACHINES, rate/setupCharge inputs, add/remove).
 *   2. Loan & Labour Cost Calculator — the machine depreciation / interest /
 *      labour-cost-per-process table with the "Apply All to Cost" button.
 *      All columns kept intact exactly as built (recently-added functionality).
 */
import { Plus, X } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { GravureEstimationProcess } from "@/data/dummyData";
import { blank, resolveQuantities, autoProcessQty, calcCosts } from "@/hooks/costingCalc";
import { CostingMasters } from "@/components/gravure/costing-estimation/CostingMastersContext";

// ─── Local copies of small helpers used only by this JSX ───────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">{label}</p>
  );
}

const cellInput = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-400 bg-white";

export interface ProcessCostAccordionProps {
  form: typeof blank;
  setForm: React.Dispatch<React.SetStateAction<typeof blank>>;
  masters: CostingMasters;
  processMinChargeMap: Record<string, number>;
  costs: ReturnType<typeof calcCosts>;

  addProcess: () => void;
  removeProcess: (i: number) => void;
  updateProcess: (i: number, patch: Partial<GravureEstimationProcess>) => void;
  selectProcess: (i: number, processId: string) => void;
  updateProcessMachine: (i: number, machineId: string) => void;
}

export default function ProcessCostAccordion({
  form, setForm, masters, processMinChargeMap, costs,
  addProcess, removeProcess, updateProcess, selectProcess, updateProcessMachine,
}: ProcessCostAccordionProps) {
  const { PRINT_MACHINES, ROTO_PROCESSES } = masters;

  return (
    <div className="space-y-6">
      {/* ── Process List ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-600">Process List (from Process Master)</p>
          <button onClick={addProcess} className="flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-blue-200 transition">
            <Plus size={12} /> Add Process
          </button>
        </div>
        {form.processes.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Process (Master)", "Machine (Auto)", "Charge Unit", "Rate (₹)", "Setup (₹)", "Amount (₹)", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.processes.map((pr, i) => {
                  // Match by ID first, then by name (handles static-ID mismatch when API loads after useEffect)
                  const pm = (ROTO_PROCESSES.find((x: any) => x.id === pr.processId)
                    || ROTO_PROCESSES.find((x: any) => x.name === pr.processName)) as any;
                  // Use live machineIds from ROTO_PROCESSES if form doesn't have them (timing: API loaded after useEffect)
                  const liveMachineIds: string[] = (pr.machineIds && pr.machineIds.length > 0)
                    ? pr.machineIds
                    : pm?.machineIds || [];
                  // Machine lookup: by machineId → by machineName → by process master machineId → by process master machineName
                  const resolvedMach = PRINT_MACHINES.find((m: any) => m.id === pr.machineId)
                    || (pr.machineName ? PRINT_MACHINES.find((m: any) => m.name === pr.machineName) : undefined)
                    || (pm?.machineId ? PRINT_MACHINES.find((m: any) => m.id === pm.machineId) : undefined);
                  const displayMachineName = resolvedMach?.name
                    || pr.machineName
                    || pm?.machineMasterName
                    || "";
                  return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 min-w-[220px]">
                      <SearchableSelect
                        value={pm ? pm.id : ""}
                        onChange={val => selectProcess(i, val)}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white"
                        placeholder="-- Select Process --"
                        options={[
                          ...(!pm && (pr.processName || pr.processId)
                            ? [{ value: pr.processId || pr.processName, label: pr.processName || `Process ${pr.processId}` }]
                            : []),
                          ...ROTO_PROCESSES.map((p: any) => ({ value: p.id, label: p.displayName || p.name })),
                        ]}
                      />
                    </td>
                    <td className="px-3 py-2 min-w-[170px]">
                      {liveMachineIds.length > 1 ? (
                        // Multiple machines allocated — pick one
                        <SearchableSelect
                          value={pr.machineId || ""}
                          onChange={val => updateProcessMachine(i, val)}
                          className="border border-indigo-300 bg-indigo-50 rounded px-2 py-1 text-[10px] text-indigo-700 w-full"
                          placeholder="— select machine —"
                          options={liveMachineIds.map(mid => {
                            const m = PRINT_MACHINES.find((x: any) => x.id === mid);
                            return { value: mid, label: m?.name || mid };
                          })}
                        />
                      ) : displayMachineName ? (
                        // Single machine auto-filled — show badge
                        <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-[10px] font-medium">{displayMachineName}</span>
                      ) : (
                        // No machine in Process Master — allow manual assignment
                        <SearchableSelect
                          value={pr.machineId || ""}
                          onChange={val => updateProcessMachine(i, val)}
                          className="border border-gray-300 bg-gray-50 rounded px-2 py-1 text-[10px] text-gray-500 w-full"
                          placeholder="— assign machine —"
                          options={PRINT_MACHINES.map((m: any) => ({ value: m.id, label: m.name }))}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2"><span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-600 font-mono text-[10px]">{pr.chargeUnit || "—"}</span></td>
                    <td className="px-3 py-2 w-24"><input type="number" value={pr.rate} onChange={e => updateProcess(i, { rate: Number(e.target.value) })} className={`${cellInput} text-right`} step={0.01} /></td>
                    <td className="px-3 py-2 w-28"><input type="number" value={pr.setupCharge} onChange={e => updateProcess(i, { setupCharge: Number(e.target.value) })} className={`${cellInput} text-right`} /></td>
                    <td className="px-3 py-2 w-32 text-right font-semibold text-gray-800">
                      {(() => {
                        const { lengthM: lm, areaM2: am, weightKg: wk } = resolveQuantities(form);
                        const aq2 = autoProcessQty(pr.chargeUnit, lm, am, wk, form.noOfColors);
                        const lq  = aq2 > 0 ? aq2 : (pr.qty || 0);
                        const rawAmt = lq * pr.rate + (pr.setupCharge || 0);
                        const minC   = processMinChargeMap[String(pr.processId)] ?? 0;
                        return `₹${Math.max(rawAmt, minC).toLocaleString()}`;
                      })()}
                    </td>
                    <td className="px-3 py-2 w-8 text-center"><button onClick={() => removeProcess(i)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><X size={13} /></button></td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-purple-50 border-t border-blue-200">
                <tr>
                  <td colSpan={6} className="px-3 py-2.5 text-xs font-bold text-purple-700 uppercase">Process Cost</td>
                  <td className="px-3 py-2.5 text-sm font-bold text-purple-800 text-right">₹{costs.processCost.toLocaleString()}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-200 rounded-xl py-5 text-center text-xs text-gray-400">
            No processes added yet. Click "+ Add Process" to add.
          </div>
        )}
      </div>

      {/* ── Loan & Labour Cost Calculator ──────────────────── */}
      <div>
        <SectionHeader label="Loan & Labour Cost" />
        <div className="border border-blue-200 rounded-xl overflow-hidden bg-white">

          {/* ── Machine-Wise Per-Process Section ── */}
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between flex-wrap gap-1">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Machine-Wise (Per Process)</p>
            <span className="text-[10px] text-blue-400">
              {form.unit === "Kg"
                ? `Kg→m: Qty×10⁶ ÷ (GSM×Width) | Run hrs = Meters ÷ (Speed×60)${form.ups > 1 ? ` ÷ UPS(${form.ups})` : ""}`
                : `Run hrs = Qty ÷ (Speed×60)${form.ups > 1 ? ` ÷ UPS(${form.ups})` : ""}`
              } &nbsp;|&nbsp; Loan &amp; Labour from Machine Master
            </span>
          </div>
          {(() => {
            // ── Convert quantity to LINEAR METERS for run-hour calculation ──
            // If unit = "Kg": need total GSM + job width to convert Kg → meters
            //   meters = (Qty_Kg × 1,000,000) / (totalGSM_g_per_m2 × jobWidth_mm)
            // If unit = "m" or "m²": use quantity directly as meters
            const totalGSM = form.dryWeightTotal > 0
              ? form.dryWeightTotal
              : form.secondaryLayers.reduce((s, l) =>
                  s + (l.gsm || 0) + l.consumableItems.reduce((cs, ci) => cs + (ci.gsm || 0), 0), 0);

            const qtyInMeters = form.unit === "Kg" && totalGSM > 0 && form.jobWidth > 0
              ? (form.quantity * 1_000_000) / (totalGSM * form.jobWidth)
              : form.quantity;

            // UPS considered: with UPS > 1 each web-repeat yields more pieces → fewer web-meters needed
            const ups = form.ups && form.ups > 1 ? form.ups : 1;
            const effectiveQty = qtyInMeters > 0 ? qtyInMeters / ups : 0;

            // Build per-process rows
            const rows = form.processes.map((pr, i) => {
              // Match process: by ID → by name → by displayName
              const pm3 = (ROTO_PROCESSES.find((p: any) => p.id === pr.processId)
                || ROTO_PROCESSES.find((p: any) => p.name === pr.processName)
                || ROTO_PROCESSES.find((p: any) => p.displayName === pr.processName)) as any;
              // Find machine: by ID → by name → by process master's machineId → by process master's machineName
              const mach = PRINT_MACHINES.find((m: any) => m.id === pr.machineId)
                || (pr.machineName ? PRINT_MACHINES.find((m: any) => m.name === pr.machineName) : undefined)
                || (pm3?.machineId ? PRINT_MACHINES.find((m: any) => m.id === pm3.machineId) : undefined)
                || (pm3?.machineMasterName ? PRINT_MACHINES.find((m: any) => m.name === pm3.machineMasterName) : undefined);
              const loan    = Number(mach?.loanAmount        ?? 0);
              const rate    = Number(mach?.loanInterestRatePct ?? 0);
              const salary  = Number(mach?.monthlyLabourSalary ?? 0); // monthly (from AvgLaborSalaryPerYear)
              const directLabHr  = Number(mach?.directLabourPerHr ?? 0); // LabourCharges (already per-hour)
              const directCostHr = Number(mach?.directCostPerHr  ?? 0); // PerHourCost (machine cost/hr)
              const days    = Number(mach?.workingDaysPerMonth  ?? 25);
              const shift   = Number(mach?.shiftHours           ?? 8);
              // Interest per hour:
              //   Primary  → PurchaseCost × AnnualInterestRate% ÷ (12 mo × days × shift)
              //   Fallback → PerHourCost used as machine capital cost/hr when PurchaseCost=0
              const annInt   = loan > 0 && rate > 0 ? (loan * rate) / 100 : 0;
              const intPerHr = annInt > 0
                ? parseFloat((annInt / (12 * days * shift)).toFixed(4))
                : (loan === 0 && directCostHr > 0 ? directCostHr : 0);
              // Labour per hour:
              //   Primary  → AvgLaborSalaryPerYear × Operators ÷ 12 mo ÷ (days × shift) = salary / (days×shift)
              //   Fallback → LabourCharges (direct per-hour field)
              const labPerHr = salary > 0
                ? parseFloat((salary / (days * shift)).toFixed(4))
                : (directLabHr > 0 ? directLabHr : 0);
              // Auto run hours from machine speed; manual pr.runHours overrides
              const machSpeed = Number(mach?.speedMax ?? 0);
              const autoHrs   = machSpeed > 0 && effectiveQty > 0
                ? parseFloat((effectiveQty / (machSpeed * 60)).toFixed(2))
                : 0;
              const runHrs  = (pr.runHours && pr.runHours > 0) ? pr.runHours : autoHrs;
              const isAutoHrs = !(pr.runHours && pr.runHours > 0);
              const intCost = parseFloat((intPerHr * runHrs).toFixed(2));
              const labCost = parseFloat((labPerHr * runHrs).toFixed(2));
              const isDirectCost  = loan === 0 && directCostHr > 0;
              const isDirectLabHr = salary === 0 && directLabHr > 0;
              // Depreciation per hour (straight-line): PurchaseCost ÷ (Lifespan_yrs × WorkingDaysPerYear × WorkingHrsPerDay)
              const purchaseCost = Number(mach?.purchaseCost ?? 0);
              const lifespan     = Number(mach?.machineLifespan ?? 0);
              const whpd         = Number(mach?.workingHoursPerDay ?? 8);
              const wdpy         = Number(mach?.workingDaysPerYear ?? 300);
              const depPerHr = (purchaseCost > 0 && lifespan > 0)
                ? parseFloat((purchaseCost / (lifespan * wdpy * whpd)).toFixed(4))
                : 0;
              const depCost = parseFloat((depPerHr * runHrs).toFixed(2));
              return { i, pr, pm3, mach, loan, rate, salary, directLabHr, directCostHr, days, shift, annInt, intPerHr, labPerHr, runHrs, autoHrs, isAutoHrs, intCost, labCost, isDirectCost, isDirectLabHr, depPerHr, depCost };
            });
            const hasAnyMachine = rows.some(r => r.mach);
            const totalInterest = parseFloat(rows.reduce((s, r) => s + r.intCost, 0).toFixed(2));
            const totalLabour   = parseFloat(rows.reduce((s, r) => s + r.labCost, 0).toFixed(2));
            const totalDepreciation = parseFloat(rows.reduce((s, r) => s + r.depCost, 0).toFixed(2));

            return (
              <>
                {form.processes.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">No processes added. Add processes above and assign machines to calculate costs.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {["Process", "Machine", "Loan (₹)", "Int%", "Int/hr", "Salary ₹/mo", "Labour/hr", "Depreciation/hr", "Run Hrs (auto)", "→ Interest (₹)", "→ Labour (₹)", "→ Depreciation (₹)"].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map(({ i, pr, pm3, mach, loan, rate, salary, directLabHr, directCostHr, intPerHr, labPerHr, runHrs, autoHrs, isAutoHrs, intCost, labCost, isDirectCost, isDirectLabHr, depPerHr, depCost }) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap max-w-[160px] truncate">
                              {pm3?.displayName || pr.processName || <span className="text-gray-400 italic">—</span>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap min-w-[160px]">
                              {mach ? (
                                <div>
                                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-indigo-700 font-medium text-[10px]">
                                    {mach.displayName || mach.name}
                                  </span>
                                  {mach.speedMax && (
                                    <div className="text-[9px] text-gray-400 mt-0.5">{mach.speedMax} m/min</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-amber-500 text-[10px] italic">← assign in Tab 2</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-gray-600">
                              {loan > 0
                                ? `₹${loan.toLocaleString("en-IN")}`
                                : isDirectCost
                                  ? <span className="text-amber-600 text-[9px]">Per-Hr rate</span>
                                  : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 font-mono text-gray-600">
                              {rate > 0 ? `${rate}%` : isDirectCost ? <span className="text-amber-600 text-[9px]">—</span> : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 font-mono text-blue-700 font-semibold">
                              {intPerHr > 0
                                ? <span title={isDirectCost ? "Using PerHourCost from Machine Master (PurchaseCost not set)" : ""}>
                                    {isDirectCost && <span className="text-[8px] text-amber-500 mr-0.5">*</span>}
                                    ₹{intPerHr.toFixed(2)}
                                  </span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 font-mono text-gray-600">
                              {salary > 0
                                ? `₹${salary.toLocaleString("en-IN")}/mo`
                                : directLabHr > 0
                                  ? <span className="text-amber-600 text-[9px]">₹{directLabHr}/hr</span>
                                  : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 font-mono text-green-700 font-semibold">
                              {labPerHr > 0
                                ? <span title={isDirectLabHr ? "Using LabourCharges from Machine Master (AvgLaborSalaryPerYear not set)" : ""}>
                                    {isDirectLabHr && <span className="text-[8px] text-amber-500 mr-0.5">*</span>}
                                    ₹{labPerHr.toFixed(2)}
                                  </span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 font-mono text-purple-700 font-semibold">
                              {depPerHr > 0
                                ? <span title="PurchaseCost ÷ (Lifespan × WorkingDaysPerYear × WorkingHoursPerDay)">
                                    ₹{depPerHr.toFixed(2)}
                                  </span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 w-28">
                              <div className="relative">
                                <input
                                  type="number" min={0} step={0.25}
                                  placeholder={autoHrs > 0 ? `${autoHrs}` : "hrs"}
                                  value={pr.runHours || ""}
                                  onChange={e => updateProcess(i, { runHours: e.target.value === "" ? 0 : Number(e.target.value) })}
                                  className={`w-full border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400 ${isAutoHrs ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-300"}`}
                                />
                                {isAutoHrs && autoHrs > 0 && (
                                  <div className="text-center text-[9px] text-blue-500 mt-0.5 font-semibold">
                                    AUTO: {autoHrs}h
                                  </div>
                                )}
                                {isAutoHrs && autoHrs === 0 && !mach?.speedMax && (
                                  <div className="text-center text-[9px] text-amber-500 mt-0.5">
                                    No speed data
                                  </div>
                                )}
                                {!isAutoHrs && (
                                  <button
                                    onClick={() => updateProcess(i, { runHours: 0 })}
                                    className="text-[9px] text-gray-400 hover:text-blue-500 block w-full text-center mt-0.5"
                                    title="Reset to auto"
                                  >↺ reset auto</button>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className={`px-2 py-1 rounded text-xs font-bold font-mono text-center ${intCost > 0 ? "bg-rose-50 border border-rose-200 text-rose-700" : "bg-gray-50 text-gray-400"}`}>
                                {intCost > 0 ? `₹${intCost.toLocaleString()}` : "—"}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className={`px-2 py-1 rounded text-xs font-bold font-mono text-center ${labCost > 0 ? "bg-lime-50 border border-lime-200 text-lime-700" : "bg-gray-50 text-gray-400"}`}>
                                {labCost > 0 ? `₹${labCost.toLocaleString()}` : "—"}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className={`px-2 py-1 rounded text-xs font-bold font-mono text-center ${depCost > 0 ? "bg-purple-50 border border-purple-200 text-purple-700" : "bg-gray-50 text-gray-400"}`}>
                                {depCost > 0 ? `₹${depCost.toLocaleString()}` : "—"}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {hasAnyMachine && (
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                          <tr>
                            <td colSpan={9} className="px-3 py-2 text-xs font-bold text-gray-600 uppercase text-right">Total</td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-1 bg-rose-100 border border-rose-300 rounded text-xs font-bold text-rose-800 font-mono block text-center">
                                ₹{totalInterest.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-1 bg-lime-100 border border-lime-300 rounded text-xs font-bold text-lime-800 font-mono block text-center">
                                ₹{totalLabour.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-1 bg-purple-100 border border-purple-300 rounded text-xs font-bold text-purple-800 font-mono block text-center">
                                ₹{totalDepreciation.toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}

                {/* Apply Machine-Wise button */}
                {hasAnyMachine && (
                  <div className="p-3 bg-amber-50 border-t border-amber-100 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {(form.interestCost || 0) > 0 && (
                        <span className="px-2 py-1 bg-rose-50 border border-rose-200 rounded-full text-rose-700 font-semibold">
                          Applied Interest: ₹{(form.interestCost || 0).toLocaleString()}
                        </span>
                      )}
                      {(form.labourCost || 0) > 0 && (
                        <span className="px-2 py-1 bg-lime-50 border border-lime-200 rounded-full text-lime-700 font-semibold">
                          Applied Labour: ₹{(form.labourCost || 0).toLocaleString()}
                        </span>
                      )}
                      {(form.depreciationCost || 0) > 0 && (
                        <span className="px-2 py-1 bg-purple-50 border border-purple-200 rounded-full text-purple-700 font-semibold">
                          Applied Depreciation: ₹{(form.depreciationCost || 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={totalInterest === 0 && totalLabour === 0 && totalDepreciation === 0}
                      onClick={() => setForm(p => ({ ...p, interestCost: totalInterest, labourCost: totalLabour, depreciationCost: totalDepreciation }))}
                      className="py-2 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      Apply All to Cost
                    </button>
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
