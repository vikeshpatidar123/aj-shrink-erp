"use client";
import { useMemo } from "react";
import { items as allItems, SecondaryLayer, GravureEstimationProcess } from "@/data/dummyData";

const FILM_ITEMS = allItems.filter(i => i.group === "Film" && i.active);

// ─── Input type ───────────────────────────────────────────────
export type PlanInput = {
  title:  string;   // "Work Order" | "Product Catalog"
  refNo:  string;   // workOrderNo | catalogNo
  jobWidth:  number;
  jobHeight: number;
  quantity:  number;
  unit:      string;
  noOfColors: number;
  secondaryLayers: SecondaryLayer[];
  processes: GravureEstimationProcess[];
  cylinderCostPerColor: number;
  overheadPct: number;
  profitPct:   number;
  wastagePct?: number;  // default 1
  trimmingSize?: number;
  frontColors?: number;
  backColors?:  number;
};

// ─── Internal line types ──────────────────────────────────────
type MatLine  = { plyNo: number; plyType: string; name: string; group: string; thickness: number; gsm: number; effGsm: number; kg: number; rate: number; amount: number };

const GROUP_BADGE: Record<string, string> = {
  Film:     "bg-blue-50   text-blue-700   border-blue-200",
  Ink:      "bg-purple-50 text-purple-700 border-purple-200",
  Adhesive: "bg-green-50  text-green-700  border-green-200",
  Solvent:  "bg-orange-50 text-orange-700 border-orange-200",
  Hardner:  "bg-pink-50   text-pink-700   border-pink-200",
};

const PLY_BADGE: Record<string, string> = {
  Film:       "bg-sky-50     text-sky-700     border-sky-200",
  Printing:   "bg-indigo-50  text-indigo-700  border-indigo-200",
  Lamination: "bg-teal-50    text-teal-700    border-teal-200",
  Coating:    "bg-amber-50   text-amber-700   border-amber-200",
};

const SH = ({ icon, label }: { icon: string; label: string }) => (
  <div className="flex items-center gap-2 mb-3 mt-1">
    <span className="text-base">{icon}</span>
    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">{label}</p>
    <div className="flex-1 h-px bg-purple-100" />
  </div>
);

// ─── Main component ───────────────────────────────────────────
export function PlanViewer({ plan }: { plan: PlanInput }) {
  const {
    jobWidth, jobHeight, quantity, unit,
    secondaryLayers,
    wastagePct = 1,
    trimmingSize = 0, frontColors, backColors,
  } = plan;

  const areaM2 = useMemo(() =>
    parseFloat((quantity * (jobWidth / 1000)).toFixed(3)),
    [quantity, jobWidth]
  );

  // ── Material lines ──────────────────────────────────────────
  const matLines = useMemo<MatLine[]>(() => {
    const lines: MatLine[] = [];
    secondaryLayers.forEach((l, idx) => {
      if (l.gsm > 0) {
        const filmItem = FILM_ITEMS.find(i => i.subGroup === l.itemSubGroup);
        const rate = parseFloat(filmItem?.estimationRate || "0");
        const kg   = parseFloat((l.gsm * areaM2 / 1000).toFixed(3));
        lines.push({
          plyNo: idx + 1, plyType: l.plyType || "Film",
          name: l.itemSubGroup || "Film Substrate", group: "Film",
          thickness: l.thickness, gsm: l.gsm, effGsm: l.gsm,
          kg, rate, amount: parseFloat((kg * rate).toFixed(2)),
        });
      }
      l.consumableItems.forEach(ci => {
        const effGsm = (ci.coveragePct ?? 100) < 100
          ? parseFloat((ci.gsm * ((ci.coveragePct ?? 100) / 100)).toFixed(3))
          : ci.gsm;
        const kg     = parseFloat((effGsm * areaM2 / 1000).toFixed(3));
        const label  = (ci.coveragePct ?? 100) < 100
          ? `${ci.itemName || ci.fieldDisplayName} (${ci.coveragePct}% cov.)`
          : (ci.itemName || ci.fieldDisplayName);
        lines.push({
          plyNo: idx + 1, plyType: l.plyType || "",
          name: label, group: ci.itemGroup,
          thickness: 0, gsm: ci.gsm, effGsm,
          kg, rate: ci.rate, amount: parseFloat((kg * ci.rate).toFixed(2)),
        });
      });
    });
    return lines;
  }, [secondaryLayers, areaM2]);

  // ── Running meter / weight ──────────────────────────────────
  const reqMtr      = quantity;
  const wasteMtr    = parseFloat((reqMtr * wastagePct / 100).toFixed(2));
  const totalMtr    = parseFloat((reqMtr + wasteMtr).toFixed(2));
  const totalGSM    = secondaryLayers.reduce((s, l) => {
    let g = l.gsm;
    l.consumableItems.forEach(ci => { g += ci.gsm; });
    return s + g;
  }, 0);
  const totalWeightKg = parseFloat((areaM2 * totalGSM / 1000).toFixed(3));

  const noData = secondaryLayers.length === 0;

  return (
    <div className="space-y-5 text-sm">

      {noData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center">
          <p className="text-amber-700 font-semibold text-sm">No planning data available.</p>
          <p className="text-xs text-amber-600 mt-1">Add ply layers and processes to see the full plan breakdown.</p>
        </div>
      )}

      {/* ── 1. PLY DETAILS ───────────────────────────────────────── */}
      {secondaryLayers.length > 0 && (
        <div>
          <SH icon="📦" label="1. Ply Details" />
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-widest text-[10px]">
                  <th className="text-left px-3 py-2.5 font-semibold">Ply</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Film / Material</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Thickness (μ)</th>
                  <th className="text-right px-3 py-2.5 font-semibold">GSM</th>
                </tr>
              </thead>
              <tbody>
                {secondaryLayers.map((l, i) => (
                  <tr key={i} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="px-3 py-2.5 font-bold text-purple-700">P{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${PLY_BADGE[l.plyType] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {l.plyType || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{l.itemSubGroup || "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">{l.thickness > 0 ? l.thickness : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-800">{l.gsm > 0 ? l.gsm : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 2. CONSUMABLE DETAILS ────────────────────────────────── */}
      {matLines.length > 0 && (
        <div>
          <SH icon="🧪" label="2. Consumable Details" />
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-widest text-[10px]">
                  <th className="text-left px-3 py-2.5 font-semibold">Ply</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Item / Material</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Group</th>
                  <th className="text-right px-3 py-2.5 font-semibold">GSM</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Wt (Kg)</th>
                </tr>
              </thead>
              <tbody>
                {matLines.map((l, i) => (
                  <tr key={i} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="px-3 py-2.5 font-bold text-purple-700">{l.plyNo > 0 ? `P${l.plyNo}` : "—"}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[160px]">{l.name}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${GROUP_BADGE[l.group] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {l.group}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">{l.effGsm > 0 ? l.effGsm : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-700">{l.kg > 0 ? l.kg : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 3. RUNNING METER CALCULATION ─────────────────────────── */}
      <div>
        <SH icon="📏" label="3. Running Meter Calculation" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { label: "Required Meters",     val: `${reqMtr.toLocaleString()} ${unit}`,  cls: "bg-blue-50   border-blue-200   text-blue-700"   },
            { label: `Waste (${wastagePct}%)`, val: `${wasteMtr.toLocaleString()} ${unit}`, cls: "bg-orange-50 border-orange-200 text-orange-700" },
            { label: "Total Meters",        val: `${totalMtr.toLocaleString()} ${unit}`, cls: "bg-purple-50  border-purple-200  text-purple-700"  },
            { label: "Area (SQM)",          val: `${areaM2.toFixed(2)} m²`,             cls: "bg-indigo-50  border-indigo-200  text-indigo-700"  },
            { label: "Job Width",           val: `${jobWidth} mm`,                       cls: "bg-gray-50   border-gray-200   text-gray-700"    },
            { label: "Job Height",          val: `${jobHeight} mm`,                      cls: "bg-gray-50   border-gray-200   text-gray-700"    },
            { label: "Total GSM",           val: `${totalGSM.toFixed(1)} g/m²`,          cls: "bg-green-50  border-green-200  text-green-700"   },
            { label: "Total Weight",        val: `${totalWeightKg} Kg`,                  cls: "bg-teal-50   border-teal-200   text-teal-700"    },
            ...(trimmingSize > 0 ? [{ label: "Trimming Size", val: `${trimmingSize} mm`, cls: "bg-purple-50 border-purple-200 text-purple-700" }] : []),
            ...(frontColors !== undefined ? [{ label: "Front Colors", val: `${frontColors}`, cls: "bg-blue-50 border-blue-200 text-blue-700" }] : []),
            ...(backColors !== undefined  ? [{ label: "Back Colors",  val: `${backColors}`,  cls: "bg-teal-50  border-teal-200  text-teal-700"  }] : []),
          ] as { label: string; val: string; cls: string }[]).map(c => (
            <div key={c.label} className={`rounded-xl border p-3 ${c.cls}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{c.label}</p>
              <p className="font-bold text-sm mt-0.5">{c.val}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
