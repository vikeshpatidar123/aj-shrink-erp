"use client";
/**
 * CylinderAccordion — the "Cylinder" grouping for the Gravure Costing
 * Estimation rewrite. Combines three pieces extracted verbatim (JSX unchanged)
 * from the legacy `app/gravure/costing-estimation/page.tsx`:
 *   1. The Cylinder Rate (₹/sq.inch) input (was inside "Machine & Cylinder Cost").
 *   2. The Cylinder Allocation table (was gated on `prepTab === "cylinder"`).
 *   3. The Color Shade / LAB table (was gated on `{false && (...)}` — dead code
 *      in the source, now rendered unconditionally here).
 *
 * Local copies of small helpers used only by this JSX (SearchableSelect stays
 * imported; COLOR_LAB / PROCESS_COLOURS / INK_ITEMS lookups are copied locally
 * per the source's own inline re-declarations inside the colorShades.map()).
 */
import { Check, RefreshCw, Wrench, Palette } from "lucide-react";
import { Input } from "@/components/ui/Input";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { EstCylAlloc, EstColorShade } from "@/hooks/useEstimationInstance";
import { blank } from "@/hooks/costingCalc";
import { items } from "@/data/dummyData";

// ─── Local copies (module-level constants used by the shade table) ─────────
const INK_ITEMS = items.filter(i => i.group === "Ink" && i.active);

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">{label}</p>
  );
}

export interface CylinderAccordionProps {
  form: typeof blank;
  f: (k: keyof typeof blank, v: unknown) => void;

  cylAllocs: EstCylAlloc[];
  setCylAllocs: React.Dispatch<React.SetStateAction<EstCylAlloc[]>>;
  cylCostBreakdown: { colorName: string; cylinderNo: string; pw: string; circ: string; area: number; rate: number; unit: string; cost: number; repeatUse: boolean }[];
  openEstCylinderMaster: () => void;
  refreshEstFromCylinderMaster: () => void;
  loadedFromCatalog: string;
  masters: { CYLINDER_TOOLS_LIVE: any[] };

  colorShades: EstColorShade[];
  setColorShades: React.Dispatch<React.SetStateAction<EstColorShade[]>>;
  initEstPrepData: () => void;
}

export default function CylinderAccordion({
  form, f,
  cylAllocs, setCylAllocs, cylCostBreakdown, openEstCylinderMaster, refreshEstFromCylinderMaster, loadedFromCatalog, masters,
  colorShades, setColorShades, initEstPrepData,
}: CylinderAccordionProps) {
  const { CYLINDER_TOOLS_LIVE } = masters;

  const pCode = (() => {
    const _m = loadedFromCatalog.match(/(\d+)$/);
    return _m ? `P${_m[1].padStart(4, "0")}` : "";
  })();
  const statusCounts = cylAllocs.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const createdCount = cylAllocs.filter(c => c.createdInMaster).length;

  return (
    <div className="space-y-6">
      {/* ── Cylinder Rate input ── */}
      <div>
        <SectionHeader label="Cylinder Rate" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Input label="Cylinder Rate (₹/sq.inch)" type="number"
            value={form.cylinderRatePerSqInch ?? ""}
            onChange={e => f("cylinderRatePerSqInch", Number(e.target.value))}
            placeholder="e.g. 2.5" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(form.cylinderRatePerSqInch ?? 0) > 0 && (
            <span className="text-xs px-3 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-full font-semibold">
              Cylinder costing: area × ₹{form.cylinderRatePerSqInch}/sq.in × {form.noOfColors} colors — per unit area
            </span>
          )}
        </div>
      </div>

      {/* ── Color Shade / LAB table ── */}
      <div className="space-y-3">
        <SectionHeader label="Color Shade & LAB Standard" />
        <div className="bg-purple-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <Palette size={14} className="text-purple-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-purple-800">Color Shade &amp; LAB Standard</p>
            <p className="text-xs text-purple-700 mt-0.5">Enter client-approved color standards with CIE LAB values for production color matching.</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-[11px] border-collapse">
            <thead className="bg-purple-700 text-white uppercase tracking-wider">
              <tr>
                {["#", "Ink Item (Master)", "Color Name", "Type", "Pantone Ref"].map(h => (
                  <th key={h} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold">{h}</th>
                ))}
                <th colSpan={3} className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold bg-indigo-700">Standard L* A* B*</th>
                <th className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold">Remarks</th>
                <th className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold bg-green-800">Ink GSM</th>
                <th className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold bg-green-800">Rate ₹/Kg</th>
                <th className="px-2 py-2 border border-purple-600/30 text-center whitespace-nowrap font-semibold bg-green-800">Ink Cost ₹</th>
              </tr>
              <tr className="bg-purple-800 text-purple-200 text-[9px]">
                {["", "", "", "", ""].map((_, i) => <th key={i} className="border border-purple-700/30" />)}
                {["L*", "A*", "B*"].map(h => <th key={`s-${h}`} className="px-2 py-1 border border-purple-700/30 text-center bg-indigo-800/60">{h}</th>)}
                <th className="border border-purple-700/30" />
                <th className="px-2 py-1 border border-purple-700/30 text-center bg-green-900/40">gsm</th>
                <th className="px-2 py-1 border border-purple-700/30 text-center bg-green-900/40">₹</th>
                <th className="px-2 py-1 border border-purple-700/30 text-center bg-green-900/40">total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {colorShades.map((cs, i) => {
                const COLOR_LAB: Record<string, { l: string; a: string; b: string }> = {
                  "Red":     { l: "41.0",  a: "54.2",  b: "38.1"  },
                  "Yellow":  { l: "89.3",  a: "-6.1",  b: "80.4"  },
                  "Blue":    { l: "25.1",  a: "23.4",  b: "-52.8" },
                  "Black":   { l: "16.0",  a: "0.1",   b: "0.0"   },
                  "White":   { l: "95.2",  a: "-1.0",  b: "2.3"   },
                  "Green":   { l: "46.3",  a: "-50.2", b: "30.1"  },
                  "Cyan":    { l: "60.1",  a: "-38.2", b: "-31.4" },
                  "Magenta": { l: "48.2",  a: "72.1",  b: "-10.3" },
                  "Orange":  { l: "65.4",  a: "43.1",  b: "65.2"  },
                  "Violet":  { l: "30.2",  a: "40.1",  b: "-42.3" },
                };
                const PROCESS_COLOURS = new Set(["Cyan","Magenta","Yellow","Black"]);
                return (
                  <tr key={i} className="hover:bg-purple-50/20">
                    <td className="px-2 py-1.5 text-center font-black text-purple-700">{cs.colorNo}</td>
                    <td className="px-2 py-1.5 min-w-[160px]">
                      <SearchableSelect
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none"
                        value={cs.inkItemId ?? ""}
                        onChange={val => {
                          const ink = INK_ITEMS.find(x => x.id === val);
                          const lab = ink?.colour ? (COLOR_LAB[ink.colour] ?? null) : null;
                          const autoType: EstColorShade["inkType"] = ink?.colour && PROCESS_COLOURS.has(ink.colour) ? "Process" : "Spot";
                          setColorShades(p => p.map((c, ci) => ci === i ? {
                            ...c,
                            inkItemId: ink?.id ?? "",
                            colorName: ink?.colour || ink?.name || c.colorName,
                            pantoneRef: (ink as any)?.pantoneNo || c.pantoneRef,
                            inkType: ink ? autoType : c.inkType,
                            ...(lab ? { labL: lab.l, labA: lab.a, labB: lab.b } : {}),
                          } : c));
                        }}
                        placeholder="-- Select Ink --"
                        options={INK_ITEMS.map(ink => ({ value: ink.id, label: `${ink.name}${(ink as any).colour ? ` (${(ink as any).colour})` : ""}` }))}
                      />
                    </td>
                    <td className="px-2 py-1.5"><input className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.colorName} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, colorName: e.target.value } : c))} /></td>
                    <td className="px-2 py-1.5">
                      <SearchableSelect
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none"
                        value={cs.inkType}
                        onChange={val => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, inkType: val as EstColorShade["inkType"] } : c))}
                        allowEmpty={false}
                        options={[
                          { value: "Spot", label: "Spot" },
                          { value: "Process", label: "Process" },
                          { value: "Special", label: "Special" },
                        ]}
                      />
                    </td>
                    <td className="px-2 py-1.5"><input placeholder="PMS 485 C" className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.pantoneRef} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, pantoneRef: e.target.value } : c))} /></td>
                    <td className="px-2 py-1.5 bg-indigo-50/40"><input type="number" step={0.01} placeholder="L*" className="w-20 text-xs border border-indigo-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-indigo-400 bg-white" value={cs.labL} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, labL: e.target.value } : c))} /></td>
                    <td className="px-2 py-1.5 bg-indigo-50/40"><input type="number" step={0.01} placeholder="a*" className="w-20 text-xs border border-indigo-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-indigo-400 bg-white" value={cs.labA} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, labA: e.target.value } : c))} /></td>
                    <td className="px-2 py-1.5 bg-indigo-50/40"><input type="number" step={0.01} placeholder="b*" className="w-20 text-xs border border-indigo-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-indigo-400 bg-white" value={cs.labB} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, labB: e.target.value } : c))} /></td>
                    <td className="px-2 py-1.5"><input placeholder="Notes…" className="w-32 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-purple-400" value={cs.remarks} onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} /></td>
                    {/* ── Cost columns ── */}
                    {(() => {
                      const ink = cs.inkItemId ? INK_ITEMS.find(x => x.id === cs.inkItemId) : null;
                      const inkRate = ink ? parseFloat(ink.estimationRate) || 0 : 0;
                      const gsm = cs.inkGsm ?? 0;
                      const areaM2 = form.quantity > 0 && form.jobWidth > 0 ? parseFloat((form.quantity * (form.jobWidth / 1000)).toFixed(2)) : 0;
                      const inkCost = gsm > 0 && inkRate > 0 && areaM2 > 0 ? parseFloat((gsm * areaM2 / 1000 * inkRate).toFixed(2)) : 0;
                      return (
                        <>
                          <td className="px-2 py-1.5 bg-green-50/40">
                            <input type="number" min={0} step={0.1} placeholder="2.0"
                              className="w-16 text-xs border border-green-200 rounded-lg px-2 py-1 font-mono outline-none focus:ring-2 focus:ring-green-400 text-center bg-white"
                              value={cs.inkGsm ?? ""}
                              onChange={e => setColorShades(p => p.map((c, ci) => ci === i ? { ...c, inkGsm: parseFloat(e.target.value) || 0 } : c))} />
                          </td>
                          <td className="px-2 py-1.5 bg-green-50/40 text-center font-mono text-[11px] text-green-800">
                            {inkRate > 0 ? `₹${inkRate.toLocaleString("en-IN")}` : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-2 py-1.5 bg-green-50/60 text-center">
                            {inkCost > 0
                              ? <span className="px-2 py-0.5 bg-green-100 text-green-800 border border-green-300 rounded-lg text-[11px] font-bold font-mono whitespace-nowrap">₹{inkCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                              : <span className="text-gray-300 text-[10px]">—</span>}
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                );
              })}
              {colorShades.length === 0 && (
                <tr><td colSpan={12} className="p-6 text-center text-gray-400 text-xs">No colors. Set No. of Colors in Basic Info tab first, then come back here.</td></tr>
              )}
              {colorShades.length > 0 && (() => {
                const areaM2 = form.quantity > 0 && form.jobWidth > 0 ? parseFloat((form.quantity * (form.jobWidth / 1000)).toFixed(2)) : 0;
                const totalInkCost = colorShades.reduce((sum, cs) => {
                  const ink = cs.inkItemId ? INK_ITEMS.find(x => x.id === cs.inkItemId) : null;
                  const inkRate = ink ? parseFloat(ink.estimationRate) || 0 : 0;
                  const gsm = cs.inkGsm ?? 0;
                  return sum + (gsm > 0 && inkRate > 0 && areaM2 > 0 ? gsm * areaM2 / 1000 * inkRate : 0);
                }, 0);
                if (totalInkCost <= 0) return null;
                return (
                  <tr className="bg-green-700 text-white font-bold text-[11px]">
                    <td colSpan={9} className="px-3 py-2 text-right uppercase tracking-wider">Total Ink Cost</td>
                    <td className="px-2 py-2" /><td className="px-2 py-2" />
                    <td className="px-2 py-2 text-center">
                      <span className="px-2 py-0.5 bg-white/20 rounded-lg font-mono">₹{totalInkCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
        {colorShades.length > 0 && (() => {
          const areaM2 = form.quantity > 0 && form.jobWidth > 0 ? parseFloat((form.quantity * (form.jobWidth / 1000)).toFixed(2)) : 0;
          const totalInkCost = colorShades.reduce((sum, cs) => {
            const ink = cs.inkItemId ? INK_ITEMS.find(x => x.id === cs.inkItemId) : null;
            const inkRate = ink ? parseFloat(ink.estimationRate) || 0 : 0;
            const gsm = cs.inkGsm ?? 0;
            return sum + (gsm > 0 && inkRate > 0 && areaM2 > 0 ? gsm * areaM2 / 1000 * inkRate : 0);
          }, 0);
          const costedColors = colorShades.filter(cs => {
            const ink = cs.inkItemId ? INK_ITEMS.find(x => x.id === cs.inkItemId) : null;
            return ink && (cs.inkGsm ?? 0) > 0;
          }).length;
          return (
            <div className="flex gap-3 flex-wrap items-center">
              {totalInkCost > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs">
                  <span className="text-green-600 font-semibold">Total Ink Cost:</span>
                  <span className="font-black text-green-800 font-mono text-sm">₹{totalInkCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                  <span className="text-green-500 text-[10px]">({costedColors}/{colorShades.length} colors costed)</span>
                </div>
              )}
              {(["Pending", "Standard Received", "Approved", "Rejected"] as const).map(s => {
                const cnt = colorShades.filter(c => c.status === s).length;
                return cnt > 0 ? (
                  <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${s === "Approved" ? "bg-green-50 text-green-700 border-green-200" : s === "Standard Received" ? "bg-blue-50 text-blue-700 border-blue-200" : s === "Rejected" ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                    {cnt} {s}
                  </span>
                ) : null;
              })}
            </div>
          );
        })()}
        {form.noOfColors > 0 && colorShades.length === 0 && (
          <button onClick={initEstPrepData}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition">
            + Initialize {form.noOfColors} Color Shades
          </button>
        )}
      </div>

      {/* ── Cylinder Allocation table ── */}
      <div className="space-y-3">
        <SectionHeader label="Cylinder Planning" />
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Cylinder Planning</p>
          {cylAllocs.length > 0 && (
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 text-[11px] font-bold rounded-lg transition"
                onClick={refreshEstFromCylinderMaster}>
                <RefreshCw size={11} /> Refresh from Master
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition"
                onClick={() => openEstCylinderMaster()}>
                <Wrench size={11} /> Create Cylinder in Master
              </button>
            </div>
          )}
        </div>
        {cylAllocs.length === 0 && form.noOfColors > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
            <span className="text-amber-700">Initialize cylinders to plan allocation.</span>
            <button className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition"
              onClick={() => {
                const n = form.noOfColors || 0;
                setCylAllocs(Array.from({ length: n }, (_, i) => ({
                  colorNo: i + 1, colorName: `Color ${i + 1}`,
                  cylinderNo: "", circumference: String(form.jobHeight || ""),
                  printWidth: String(form.actualWidth || form.jobWidth || ""),
                  repeatUPS: 1,
                  cylinderType: "New" as const, status: "Pending" as const,
                  remarks: "", createdInMaster: false, repeatUse: false,
                })));
              }}>
              + Initialize {form.noOfColors} Color Cylinders
            </button>
          </div>
        )}
        {cylAllocs.length > 0 && (
          <>
            <div className="mb-2 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-[11px] text-blue-800">
              <Wrench size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <span>All colors share <strong>same cylinder</strong> — same Circ, Width &amp; Repeat UPS. Check <strong>Repeat?</strong> for colors reusing an existing cylinder.</span>
            </div>
            <div className="flex items-center gap-2 mb-2 flex-wrap text-[11px]">
              <span className="font-semibold text-gray-500 uppercase text-[10px]">Status:</span>
              {Object.entries(statusCounts).map(([st, cnt]) => (
                <span key={st} className={`px-2 py-0.5 rounded-full border font-bold ${st === "Available" ? "bg-green-50 text-green-700 border-green-200" : st === "Ordered" ? "bg-purple-50 text-purple-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                  {cnt} {st}
                </span>
              ))}
              {createdCount > 0 && <span className="ml-auto text-green-600 font-bold text-[10px]">✓ {createdCount} cylinder{createdCount > 1 ? "s" : ""} created in master</span>}
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-[11px] border-collapse">
                <thead className="bg-amber-700 text-white uppercase tracking-wider">
                  <tr>{["#", "Repeat?", "Product Code", "Color Name", "Cylinder Code", "Width (mm)", "Circ. (mm)", "Repeat UPS", "Type", "Status", "Remarks", "Cyl. Cost ₹", "Action"].map(h => (
                    <th key={h} className={`px-2 py-2 border border-amber-600/30 text-center whitespace-nowrap font-semibold ${h === "Cyl. Cost ₹" ? "bg-green-800" : ""}`}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cylAllocs.map((ca, i) => (
                    <tr key={i} className={`hover:bg-amber-50/20 ${ca.repeatUse ? "bg-gray-50 opacity-60" : ca.createdInMaster ? "bg-green-50/30" : ""}`}>
                      <td className="px-2 py-1.5 text-center font-black text-amber-700">{ca.colorNo}</td>
                      <td className="px-2 py-1.5 text-center">
                        <label className="flex flex-col items-center gap-0.5 cursor-pointer select-none">
                          <input type="checkbox" checked={!!ca.repeatUse}
                            onChange={e => setCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, repeatUse: e.target.checked } : c))}
                            className="w-4 h-4 accent-orange-500 cursor-pointer" />
                          {ca.repeatUse && <span className="text-[9px] text-orange-600 font-bold leading-none">Skip</span>}
                        </label>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {pCode ? <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold font-mono whitespace-nowrap">{pCode}</span> : <span className="text-gray-400 text-[10px]">Direct</span>}
                      </td>
                      <td className="px-2 py-1.5"><input className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" value={ca.colorName} onChange={e => setCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, colorName: e.target.value } : c))} /></td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect
                          className="w-36 text-xs border border-amber-300 rounded-lg px-2 py-1 font-mono outline-none bg-white"
                          value={ca.cylinderMasterID || ""}
                          onChange={val => {
                            const cyl = CYLINDER_TOOLS_LIVE.find(t => t.id === val);
                            setCylAllocs(p => p.map((c, ci) => ci === i ? {
                              ...c,
                              cylinderMasterID: cyl?.id ?? "",
                              cylinderNo:  cyl?.code ?? "",
                              printWidth:  cyl ? String(cyl.printWidth) : c.printWidth,
                              circumference: cyl ? String(cyl.repeatLength) : c.circumference,
                              purchaseRate: cyl?.purchaseRate ?? 0,
                              purchaseUnit: cyl?.purchaseUnit ?? "SQM",
                            } : c));
                          }}
                          placeholder="-- Select Cylinder --"
                          options={CYLINDER_TOOLS_LIVE.map(t => ({ value: t.id, label: `${t.code} — ${t.name}` }))}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="block text-[10px] font-mono text-gray-500 text-center">{ca.printWidth || "—"}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="block text-[10px] font-mono text-indigo-600 text-center">{ca.circumference || "—"}</span>
                      </td>
                      <td className="px-2 py-1.5 text-center"><span className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-[10px] font-bold">{ca.repeatUPS}×</span></td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none"
                          value={ca.cylinderType}
                          onChange={val => setCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, cylinderType: val as EstCylAlloc["cylinderType"] } : c))}
                          allowEmpty={false}
                          options={[
                            { value: "New", label: "New" },
                            { value: "Existing", label: "Existing" },
                            { value: "Repeat", label: "Repeat Cylinder" },
                            { value: "Rechromed", label: "Rechromed" },
                          ]}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none"
                          value={ca.status}
                          onChange={val => setCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, status: val as EstCylAlloc["status"] } : c))}
                          allowEmpty={false}
                          options={[
                            { value: "Pending", label: "Pending" },
                            { value: "Ordered", label: "Ordered" },
                            { value: "Available", label: "Available" },
                            { value: "In Use", label: "In Use" },
                            { value: "Under Chrome", label: "Under Chrome" },
                          ]}
                        />
                      </td>
                      <td className="px-2 py-1.5"><input placeholder="Notes…" className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-amber-400" value={ca.remarks} onChange={e => setCylAllocs(p => p.map((c, ci) => ci === i ? { ...c, remarks: e.target.value } : c))} /></td>
                      <td className="px-2 py-1.5 text-center bg-green-50/40">
                        {ca.repeatUse
                          ? <span className="text-gray-400 text-[10px]">Skip</span>
                          : (() => {
                              const bd = cylCostBreakdown.find(b => b.cylinderNo === ca.cylinderNo || (ca.cylinderMasterID && b.cylinderNo === ca.cylinderNo));
                              return bd
                                ? <span className="px-2 py-0.5 bg-green-100 text-green-800 border border-green-200 rounded-lg text-[10px] font-bold font-mono whitespace-nowrap" title={`${bd.pw}×${bd.circ}mm = ${bd.area} SQM × ₹${bd.rate}/${bd.unit}`}>₹{bd.cost.toLocaleString("en-IN")}</span>
                                : <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-mono whitespace-nowrap">Select cylinder</span>;
                            })()}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {ca.createdInMaster
                          ? <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 border border-green-300 rounded-full text-[10px] font-bold whitespace-nowrap"><Check size={10}/> Created</span>
                          : <button onClick={() => openEstCylinderMaster()} className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition whitespace-nowrap">+ Create</button>}
                      </td>
                    </tr>
                  ))}
                  {cylAllocs.length === 0 && <tr><td colSpan={13} className="p-6 text-center text-gray-400 text-xs">No cylinders configured yet.</td></tr>}
                  {cylAllocs.length > 0 && (() => {
                    const billableCyls = cylAllocs.filter(c => !c.repeatUse).length;
                    const totalCylCost = billableCyls * (form.cylinderCostPerColor || 0);
                    return (
                      <tr className="bg-green-700 text-white font-bold text-[11px]">
                        <td colSpan={11} className="px-3 py-2 text-right uppercase tracking-wider">
                          Total Cylinder Cost ({billableCyls} new × ₹{(form.cylinderCostPerColor || 0).toLocaleString("en-IN")})
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="px-2 py-0.5 bg-white/20 rounded-lg font-mono">₹{totalCylCost.toLocaleString("en-IN")}</span>
                        </td>
                        <td className="px-2 py-2" />
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            {/* Cylinder cost summary card */}
            {(() => {
              const billableCyls = cylAllocs.filter(c => !c.repeatUse).length;
              const repeatCyls   = cylAllocs.filter(c => !!c.repeatUse).length;
              const totalCylCost = billableCyls * (form.cylinderCostPerColor || 0);
              const createdCount2 = cylAllocs.filter(c => c.createdInMaster).length;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-[10px] text-amber-500 uppercase font-semibold">New Cylinders</p>
                    <p className="text-lg font-black text-amber-800">{billableCyls}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Repeat (Skip)</p>
                    <p className="text-lg font-black text-gray-500">{repeatCyls}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-[10px] text-green-500 uppercase font-semibold">Created in Master</p>
                    <p className="text-lg font-black text-green-700">{createdCount2}</p>
                  </div>
                  <div className="bg-green-100 border border-green-300 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-[10px] text-green-600 uppercase font-semibold">Total Cylinder Cost</p>
                    <p className="text-lg font-black text-green-900 font-mono">₹{totalCylCost.toLocaleString("en-IN")}</p>
                    <p className="text-[9px] text-green-600">@ ₹{(form.cylinderCostPerColor || 0).toLocaleString("en-IN")}/color</p>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
