"use client";
/**
 * StickySummaryPanel — cost summary + Save action card for the Gravure
 * Costing Estimation rewrite. Renders at the bottom of the center working
 * column (not a separate sticky rail). Shows the big total + per-unit rate,
 * a line-item cost breakdown, and the primary/secondary action buttons.
 */
import Button from "@/components/ui/Button";

export interface StickySummaryPanelCosts {
  materialCost: number;
  processCost: number;
  cylinderCost: number;
  packingCost: number;
  transportationCost: number;
  interestCost: number;
  overheadAmt: number;
  profitAmt: number;
  totalAmount: number;
  perMeterRate: number;
  perMeterRateWithoutProfit?: number;
  contribution: number;
  marginPct: number;
  breakEvenQty: number;
  setupCost?: number;
  labourCost?: number;
  depreciationCost?: number;
}

export interface StickySummaryPanelProps {
  costs: StickySummaryPanelCosts;
  unit: string;
  onSaveDraft?: () => void;
  onSave: () => void;
  onGenerateQuotation?: () => void;
  onCloneQuantity?: () => void;
  onPrint?: () => void;
  onExportPdf?: () => void;
  onCloneEstimation?: () => void;
  saving: boolean;
}

function LineRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-b-0">
      <span className={`text-xs ${strong ? "font-semibold text-gray-700" : "text-gray-500"}`}>{label}</span>
      <span className={`text-xs ${strong ? "font-bold text-gray-900" : "text-gray-700"}`}>{value}</span>
    </div>
  );
}

const inr = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

export default function StickySummaryPanel({
  costs, unit, onSaveDraft, onSave, onGenerateQuotation, onCloneQuantity,
  onPrint, onExportPdf, onCloneEstimation, saving,
}: StickySummaryPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      {/* Big total */}
      <div>
        <div className="text-3xl font-black text-[#003366]">
          {inr(costs.totalAmount)}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {inr(costs.perMeterRate)}/{unit}
        </div>
      </div>

      {/* Line items */}
      <div>
        <LineRow label="Material" value={inr(costs.materialCost)} />
        <LineRow label="Process" value={inr(costs.processCost)} />
        <LineRow label="Cylinder" value={inr(costs.cylinderCost)} />
        {costs.labourCost !== undefined && <LineRow label="Labour" value={inr(costs.labourCost)} />}
        <LineRow label="Packing" value={inr(costs.packingCost)} />
        <LineRow label="Transport" value={inr(costs.transportationCost)} />
        <LineRow label="Interest" value={inr(costs.interestCost)} />
        {costs.depreciationCost !== undefined && <LineRow label="Depreciation" value={inr(costs.depreciationCost)} />}
        <LineRow label="Overhead" value={inr(costs.overheadAmt)} />
        <LineRow label="Profit" value={inr(costs.profitAmt)} />
        <LineRow label="Total" value={inr(costs.totalAmount)} strong />
        <LineRow label={`Rate per ${unit}`} value={inr(costs.perMeterRate)} />
        <LineRow label="Contribution" value={inr(costs.contribution)} />
        <LineRow label="Margin %" value={`${(costs.marginPct ?? 0).toFixed(1)}%`} />
        <LineRow label="Break-even Qty" value={`${(costs.breakEvenQty ?? 0).toLocaleString("en-IN")} ${unit}`} />
      </div>

      {/* Divider */}
      <div className="border-t-2 border-gray-100 -mx-5 my-1" />

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1">
        <Button variant="action-save" size="md" onClick={onSave} loading={saving} className="w-full justify-center">
          Save
        </Button>
        {onSaveDraft && (
          <Button variant="action-secondary" size="sm" onClick={onSaveDraft} className="w-full justify-center">
            Save Draft
          </Button>
        )}
        {onGenerateQuotation && (
          <Button variant="action-send" size="sm" onClick={onGenerateQuotation} className="w-full justify-center">
            Generate Quotation
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          {onCloneQuantity && (
            <Button variant="action-apply" size="sm" onClick={onCloneQuantity} className="justify-center">
              Clone Qty
            </Button>
          )}
          {onCloneEstimation && (
            <Button variant="action-apply" size="sm" onClick={onCloneEstimation} className="justify-center">
              Clone Estimation
            </Button>
          )}
          {onPrint && (
            <Button variant="action-print" size="sm" onClick={onPrint} className="justify-center">
              Print
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
