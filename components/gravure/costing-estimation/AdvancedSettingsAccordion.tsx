"use client";
/**
 * AdvancedSettingsAccordion — manual cost-override inputs for the BASE
 * quantity, for the Gravure Costing Estimation rewrite.
 *
 * NOT a direct copy-paste from page.tsx (no single block held these fields
 * together in the source) — assembled from how `calcCosts()` in
 * `hooks/costingCalc.ts` consumes these `form` fields:
 *
 *   - labourCost, transportationCost, interestCost, depreciationCost are
 *     added into the cost `sub`-total directly whenever > 0 (no override
 *     semantics — they're plain additive costs, default 0).
 *   - cylinderCostOverride / setupCostOverride / packingCostOverride follow
 *     the `!== undefined && > 0` override pattern: when set, they REPLACE the
 *     auto-calculated cylinderCost / setupCost / packingCost respectively;
 *     when 0 or unset, the auto-calculated value is used instead.
 *
 * This mirrors the per-qty override fields already exposed in the "Cost
 * Summary — All Quantities" table (qtyOverrides[qi]) but applies to the base
 * quantity's `form` fields directly — per-qty overrides are out of scope here.
 */
import { blank } from "@/hooks/costingCalc";

export interface AdvancedSettingsAccordionProps {
  form: typeof blank;
  f: (k: keyof typeof blank, v: unknown) => void;
}

function OverrideField({
  label, value, onChange, helper,
}: { label: string; value: number; onChange: (v: number) => void; helper: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={e => onChange(Number(e.target.value))}
        className="h-10 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs
          bg-white text-gray-800 placeholder:text-gray-400
          focus:outline-none focus:border-[rgb(var(--color-primary))]
          focus:ring-2 focus:ring-[rgb(var(--color-primary))]/10 transition-all"
      />
      <p className="text-[10px] text-gray-400 leading-snug">{helper}</p>
    </div>
  );
}

export default function AdvancedSettingsAccordion({ form, f }: AdvancedSettingsAccordionProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">
        Advanced Settings — Manual Cost Overrides (Base Quantity)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <OverrideField
          label="Labour Cost (₹)"
          value={form.labourCost ?? 0}
          onChange={v => f("labourCost", v)}
          helper="Added directly to total cost when greater than 0."
        />
        <OverrideField
          label="Transportation Cost (₹)"
          value={form.transportationCost ?? 0}
          onChange={v => f("transportationCost", v)}
          helper="Added directly to total cost when greater than 0."
        />
        <OverrideField
          label="Interest Cost (₹)"
          value={form.interestCost ?? 0}
          onChange={v => f("interestCost", v)}
          helper="Added directly to total cost when greater than 0."
        />
        <OverrideField
          label="Depreciation Cost (₹)"
          value={form.depreciationCost ?? 0}
          onChange={v => f("depreciationCost", v)}
          helper="Added directly to total cost when greater than 0."
        />
        <OverrideField
          label="Cylinder Cost Override (₹)"
          value={form.cylinderCostOverride ?? 0}
          onChange={v => f("cylinderCostOverride", v)}
          helper="Overrides the auto-calculated cylinder cost when greater than 0."
        />
        <OverrideField
          label="Setup Cost Override (₹)"
          value={form.setupCostOverride ?? 0}
          onChange={v => f("setupCostOverride", v)}
          helper="Overrides the auto-calculated machine setup cost when greater than 0."
        />
        <OverrideField
          label="Packing Cost Override (₹)"
          value={form.packingCostOverride ?? 0}
          onChange={v => f("packingCostOverride", v)}
          helper="Overrides the auto-calculated packing cost when greater than 0."
        />
      </div>
    </div>
  );
}
