"use client";
/**
 * OverheadProfitAccordion — "Overhead, Profit & Pricing" grouping for the
 * Gravure Costing Estimation rewrite. Copied verbatim (JSX unchanged) from
 * the legacy `app/gravure/costing-estimation/page.tsx` Section 4.
 */
import { Input } from "@/components/ui/Input";
import { blank } from "@/hooks/costingCalc";

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold text-purple-700 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">{label}</p>
  );
}

export interface OverheadProfitAccordionProps {
  form: typeof blank;
  f: (k: keyof typeof blank, v: unknown) => void;
}

export default function OverheadProfitAccordion({ form, f }: OverheadProfitAccordionProps) {
  return (
    <div>
      <SectionHeader label="Overhead, Profit & Pricing" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Input label="Overhead (%)" type="number" value={form.overheadPct} onChange={e => f("overheadPct", Number(e.target.value))} />
        <Input label="Profit (%)" type="number" value={form.profitPct} onChange={e => f("profitPct", Number(e.target.value))} />
        <Input label="Wastage %" type="number" step={0.1} value={form.wastagePct}
          onChange={e => f("wastagePct", Number(e.target.value))}
          placeholder="Default 1%" />
        <Input label={`Min. Order Qty (${form.unit || "Kg"})`} type="number" value={form.minimumOrderValue || ""}
          onChange={e => f("minimumOrderValue", Number(e.target.value))}
          placeholder={`e.g. 500 ${form.unit || "Kg"}`} />
      </div>
    </div>
  );
}
