"use client";
/**
 * PackingAccordion — "Packing Cost Breakup" grouping for the Gravure Costing
 * Estimation rewrite. Copied verbatim (JSX unchanged) from the legacy
 * `app/gravure/costing-estimation/page.tsx`, where this whole block was
 * wrapped in `{false && <div>...</div>}` (disabled/dead code in the source —
 * never actually rendered). Here it's rendered unconditionally.
 */
import { Input } from "@/components/ui/Input";
import { blank } from "@/hooks/costingCalc";

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">{label}</p>
  );
}

export interface PackingAccordionProps {
  form: typeof blank;
  f: (k: keyof typeof blank, v: unknown) => void;
}

export default function PackingAccordion({ form, f }: PackingAccordionProps) {
  return (
    <div>
      <SectionHeader label="Packing Cost Breakup" />
      <div className="border border-orange-200 rounded-xl overflow-hidden bg-white">
        {/* Box */}
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Box</p>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-gray-100">
          <Input label="Box Rate (₹/box)" type="number" value={form.packingBoxRate ?? 80}
            onChange={e => f("packingBoxRate", Number(e.target.value))} />
          <Input label="Coils / Box" type="number" value={form.packingCoilsPerBox ?? 6}
            onChange={e => f("packingCoilsPerBox", Number(e.target.value))} />
          <Input label="Weight / Coil (kg)" type="number" step={0.1} value={form.packingCoilWt ?? 15}
            onChange={e => f("packingCoilWt", Number(e.target.value))} />
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Weight / Box</p>
            <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm font-bold text-orange-700 font-mono">
              {((form.packingCoilsPerBox ?? 6) * (form.packingCoilWt ?? 15)).toFixed(1)} kg
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">BOX COST / BOX</p>
            <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm font-bold text-orange-700 font-mono">
              ₹{(form.packingBoxRate ?? 80).toFixed(2)}
            </div>
          </div>
        </div>
        {/* Core Plug */}
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Core Plug</p>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-gray-100">
          <Input label="Plugs / Box" type="number" value={form.packingPlugsPerBox ?? 12}
            onChange={e => f("packingPlugsPerBox", Number(e.target.value))} />
          <Input label="Plug Rate (₹/pcs)" type="number" step={0.1} value={form.packingPlugRate ?? 2}
            onChange={e => f("packingPlugRate", Number(e.target.value))} />
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Plug Cost / Box</p>
            <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm font-mono font-bold text-orange-700">
              ₹{((form.packingPlugsPerBox ?? 12) * (form.packingPlugRate ?? 2)).toFixed(2)}
            </div>
          </div>
        </div>
        {/* Tape */}
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Tape</p>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-gray-100">
          <Input label="Tape Rate (₹/roll)" type="number" value={form.packingTapeRate ?? 40}
            onChange={e => f("packingTapeRate", Number(e.target.value))} />
          <Input label="Tape Used / Box (m)" type="number" value={form.packingTapeMetres ?? 10}
            onChange={e => f("packingTapeMetres", Number(e.target.value))} />
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Rolls Used / Box</p>
            <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm font-mono font-bold text-orange-700">
              {((form.packingTapeMetres ?? 10) / 130).toFixed(3)} rolls
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Tape Cost / Box</p>
            <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm font-mono font-bold text-orange-700">
              ₹{(((form.packingTapeMetres ?? 10) / 130) * (form.packingTapeRate ?? 40)).toFixed(2)}
            </div>
          </div>
        </div>
        {/* Stretch Film */}
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Stretch Film</p>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-gray-100">
          <Input label="Stretch Film / Box (gm)" type="number" value={form.packingStretchFilmGm ?? 200}
            onChange={e => f("packingStretchFilmGm", Number(e.target.value))} />
          <Input label="Stretch Film Rate (₹/kg)" type="number" value={form.packingStretchFilmRate ?? 90}
            onChange={e => f("packingStretchFilmRate", Number(e.target.value))} />
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">SF Cost / Box</p>
            <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm font-mono font-bold text-orange-700">
              ₹{(((form.packingStretchFilmGm ?? 200) / 1000) * (form.packingStretchFilmRate ?? 90)).toFixed(2)}
            </div>
          </div>
        </div>
        {/* Summary */}
        {(() => {
          const boxWt = (form.packingCoilsPerBox ?? 6) * (form.packingCoilWt ?? 15);
          const plugC = (form.packingPlugsPerBox ?? 12) * (form.packingPlugRate ?? 2);
          const tapeC = ((form.packingTapeMetres ?? 10) / 130) * (form.packingTapeRate ?? 40);
          const sfC   = ((form.packingStretchFilmGm ?? 200) / 1000) * (form.packingStretchFilmRate ?? 90);
          const total = (form.packingBoxRate ?? 80) + plugC + tapeC + sfC;
          const perKg = boxWt > 0 ? total / boxWt : 0;
          return (
            <div className="p-4 grid grid-cols-2 gap-3 bg-orange-50/60">
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Packing Cost / Box</p>
                <div className="px-3 py-2.5 bg-white border-2 border-orange-300 rounded-xl text-base font-black text-orange-700 font-mono">
                  ₹{total.toFixed(2)}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Packing Cost / kg</p>
                <div className="px-3 py-2.5 bg-white border-2 border-orange-400 rounded-xl text-base font-black text-orange-800 font-mono">
                  ₹{perKg.toFixed(4)} / kg
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
