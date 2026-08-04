"use client";
/**
 * QuantityCard — compact per-quantity comparison card (Q1/Q2/Q3...) shown in
 * the Gravure Costing Estimation "quantity clones" row. Displays the computed
 * rate/total for that quantity and lets the user tweak quantity/profit%/
 * overhead%/selling price inline, plus clone/delete/recalculate actions.
 */
import { Copy, Trash2, RefreshCw } from "lucide-react";

export interface QuantityCardProps {
  label: string;
  quantity: number;
  unit: string;
  profitPct: number;
  overheadPct: number;
  sellingPrice?: number;
  rate: number;
  total: number;
  isBase: boolean;
  onChange: (patch: Partial<{ quantity: number; profitPct: number; overheadPct: number; sellingPrice: number }>) => void;
  onClone: () => void;
  onDelete?: () => void;
  onRecalculate?: () => void;
}

function MiniField({
  label, value, onCommit, step,
}: { label: string; value: number; onCommit: (v: number) => void; step?: number }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-gray-500">{label}</span>
      <input
        type="number"
        step={step ?? 1}
        defaultValue={value}
        key={value}
        onBlur={e => onCommit(Number(e.target.value))}
        className="h-7 w-full rounded-md border border-gray-200 px-1.5 text-xs
          bg-white text-gray-800 focus:outline-none focus:border-[rgb(var(--color-primary))]
          focus:ring-2 focus:ring-[rgb(var(--color-primary))]/10 transition-all"
      />
    </label>
  );
}

export default function QuantityCard({
  label, quantity, unit, profitPct, overheadPct, sellingPrice, rate, total, isBase,
  onChange, onClone, onDelete, onRecalculate,
}: QuantityCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 min-w-[220px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-[rgb(var(--color-primary))]">{label}</span>
        {isBase && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[rgb(var(--color-orange))]/10 text-[rgb(var(--color-orange))]">
            Base
          </span>
        )}
      </div>

      {/* Rate / total */}
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-[rgb(var(--color-orange))]">
            ₹{rate.toLocaleString("en-IN")}
          </span>
          <span className="text-xs text-gray-400">/{unit}</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          Total: ₹{total.toLocaleString("en-IN")}
        </div>
      </div>

      {/* Inline editable fields */}
      <div className="grid grid-cols-2 gap-2">
        <MiniField label={`Qty (${unit})`} value={quantity} onCommit={v => onChange({ quantity: v })} />
        <MiniField label="Profit %" value={profitPct} step={0.1} onCommit={v => onChange({ profitPct: v })} />
        <MiniField label="Overhead %" value={overheadPct} step={0.1} onCommit={v => onChange({ overheadPct: v })} />
        <MiniField label="Selling Price" value={sellingPrice ?? 0} onCommit={v => onChange({ sellingPrice: v })} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
        <button
          type="button"
          onClick={onClone}
          title="Clone"
          className="flex items-center justify-center h-7 w-7 rounded-md text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary-subtle))] transition-colors"
        >
          <Copy size={13} />
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isBase}
            title={isBase ? "Base quantity cannot be deleted" : "Delete"}
            className="flex items-center justify-center h-7 w-7 rounded-md text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Trash2 size={13} />
          </button>
        )}
        {onRecalculate && (
          <button
            type="button"
            onClick={onRecalculate}
            title="Recalculate"
            className="flex items-center justify-center h-7 w-7 rounded-md text-gray-500 hover:bg-gray-100 transition-colors ml-auto"
          >
            <RefreshCw size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
