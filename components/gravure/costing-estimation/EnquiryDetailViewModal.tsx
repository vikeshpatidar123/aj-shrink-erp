"use client";
/**
 * EnquiryDetailViewModal — read-only replica of the "Edit Enquiry" modal from
 * app/enquiry/page.tsx (lines 453-1001), used by the eye icon in
 * EstimationInstancePanel.tsx (header "View loaded enquiry" button + the
 * Enquiry Picker modal's per-row View action).
 *
 * Unlike the source modal, this component:
 *   - never mutates anything (no onChange handlers touch state elsewhere)
 *   - renders every field as plain read-only text (via <ROField>), not live
 *     <Input>/<Select> controls
 *   - has no Save/Update button, only Close
 *   - fetches its own data given just an `enquiryId`:
 *       1. base fields (customer, job, category, plan window, seal/gusset
 *          dims, etc.) come from the SAME EnquiryContext (`useEnquiries()`)
 *          the /enquiry page and EstimationInstancePanel already use — the
 *          picker's `CombinedEnquiry` rows live there.
 *       2. Processes + Ply/Consumable detail are NOT present on the list rows
 *          (confirmed by reading /enquiry page's `openEdit`) — those come
 *          from `api/gravureEnquiryShrink/getenquirybyid/{id}`, mirroring
 *          exactly what `openEdit` does before showing its own modal.
 *       3. The full process master list (`api/productcataloggravureShrink
 *          /getprocesslist`) is fetched too, so the process checklist can be
 *          shown fully (all processes, checked/unchecked) instead of just
 *          the selected subset.
 *
 * Packaging Dimensions: the live `DimensionInputPanel` (editable) is NOT
 * reused — it requires an `onChange` and has no read-only mode. Instead the
 * same `CONTENT_TYPE_CONFIG[contentType].fields`/`.labels` metadata drives a
 * grid of read-only `<ROField>`s showing the dimension VALUES, right next to
 * the reused (already pure-display) `<DimensionDiagram>`. For content types
 * with no config entry, the source's own "Fallback: plain H/W inputs" branch
 * is mirrored with read-only Height/Width fields.
 *
 * Process allocation: rendered as a static checklist (all master processes,
 * teal check swatch for allocated ones) — no interactive checkboxes.
 */
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { statusBadge } from "@/components/ui/Badge";
import { useEnquiries, CombinedEnquiry } from "@/context/EnquiryContext";
import { apiGetSafe } from "@/lib/api";
import { DimensionDiagram, CONTENT_TYPE_CONFIG, DimValues, DimField } from "@/components/gravure/DimensionDiagram";
import type { SecondaryLayer } from "@/data/dummyData";

type MasterProcess = { ProcessID: string; ProcessName: string };
type ProcessRef = { id: string; name: string };

type FullEnquiryDetail = {
  Processes?: { ProcessID: string; ProcessName: string }[];
  Plys?: {
    PlyID: string; LayerNo: number; PlyType: string; FilmSubGroup: string;
    Density: number; Thickness: number; FilmGSM: number; ItemID: string; ItemName: string;
    Consumables?: {
      ItemGroup: string; ItemSubGroup: string; ItemID: string; ItemName: string;
      FieldDisplayName: string; GSM: number; Rate: number; CoveragePct: number;
      SolidPct?: number; OhPct?: number; NcoPct?: number;
    }[];
  }[];
};

const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100 pb-1.5 mb-3">{label}</p>
);

/** Plain read-only field — same visual footprint as <Input>/<Select>, but non-interactive. */
function ROField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className="flex flex-col gap-1">
      <label className="block text-xs font-medium text-[rgb(var(--fg-default))]">{label}</label>
      <div
        className={`min-h-10 w-full rounded-md border px-3 py-2 flex items-center text-xs
          bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] border-[rgb(var(--bd-default))]
          ${mono ? "font-mono" : ""}`}
      >
        {empty ? <span className="text-[rgb(var(--fg-subtle))]">—</span> : value}
      </div>
    </div>
  );
}

export interface EnquiryDetailViewModalProps {
  open: boolean;
  onClose: () => void;
  enquiryId: string | null;
}

export default function EnquiryDetailViewModal({ open, onClose, enquiryId }: EnquiryDetailViewModalProps) {
  const { enquiries } = useEnquiries();
  const enquiry: CombinedEnquiry | null = enquiryId ? enquiries.find(e => e.id === enquiryId) ?? null : null;

  const [loading, setLoading] = useState(false);
  const [allProcesses, setAllProcesses] = useState<MasterProcess[]>([]);
  const [processes, setProcesses] = useState<ProcessRef[]>([]);
  const [plys, setPlys] = useState<SecondaryLayer[]>([]);

  useEffect(() => {
    if (!open || !enquiryId) return;
    let cancelled = false;
    setLoading(true);
    setProcesses([]);
    setPlys([]);

    Promise.all([
      apiGetSafe<MasterProcess[]>("api/productcataloggravureShrink/getprocesslist"),
      apiGetSafe<FullEnquiryDetail>(`api/gravureEnquiryShrink/getenquirybyid/${enquiryId}`),
    ])
      .then(([procList, full]) => {
        if (cancelled) return;
        setAllProcesses(Array.isArray(procList) ? procList : []);
        if (full?.Processes?.length) {
          setProcesses(full.Processes.map(p => ({ id: String(p.ProcessID), name: p.ProcessName })));
        }
        if (full?.Plys?.length) {
          setPlys(full.Plys.map(p => ({
            id: String(p.PlyID ?? Math.random()),
            layerNo: Number(p.LayerNo ?? 1),
            plyType: String(p.PlyType ?? ""),
            itemSubGroup: String(p.FilmSubGroup ?? ""),
            density: parseFloat(String(p.Density ?? "0")) || 0,
            thickness: parseFloat(String(p.Thickness ?? "0")) || 0,
            gsm: parseFloat(String(p.FilmGSM ?? "0")) || 0,
            itemId: String(p.ItemID ?? ""),
            itemName: String(p.ItemName ?? ""),
            consumableItems: (p.Consumables ?? []).map(c => ({
              consumableId: String(Math.random()),
              fieldDisplayName: String(c.FieldDisplayName ?? ""),
              itemGroup: String(c.ItemGroup ?? ""),
              itemSubGroup: String(c.ItemSubGroup ?? ""),
              itemId: String(c.ItemID ?? ""),
              itemName: String(c.ItemName ?? ""),
              gsm: parseFloat(String(c.GSM ?? "0")) || 0,
              rate: parseFloat(String(c.Rate ?? "0")) || 0,
              coveragePct: parseFloat(String(c.CoveragePct ?? "100")) || 100,
              solidPct: c.SolidPct != null ? parseFloat(String(c.SolidPct)) || undefined : undefined,
              ohPct: c.OhPct != null ? parseFloat(String(c.OhPct)) || undefined : undefined,
              ncoPct: c.NcoPct != null ? parseFloat(String(c.NcoPct)) || undefined : undefined,
            })),
          })));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, enquiryId]);

  if (!open) return null;

  const dimValues: DimValues = enquiry ? {
    width: enquiry.planWidth || 0,
    layflatWidth: enquiry.planWidth || 0,
    height: enquiry.planHeight || 0,
    cutHeight: enquiry.planHeight || 0,
    topSeal: enquiry.topSeal || 0,
    bottomSeal: enquiry.bottomSeal || 0,
    sideSeal: enquiry.sideSeal || 0,
    centerSealWidth: enquiry.centerSeal || 0,
    gusset: enquiry.gusset || 0,
    sideGusset: enquiry.sideGusset || 0,
    sealWidth: enquiry.sealWidth || 0,
    seamingArea: enquiry.seamingArea || 0,
    transparentArea: enquiry.transparentArea || 0,
  } : {};

  const contentType = enquiry?.selectedContent || "";
  const contentSelected = !!contentType;
  const dimCfg = contentType ? CONTENT_TYPE_CONFIG[contentType] : undefined;

  return (
    <Modal open={open} onClose={onClose} title={enquiry ? `Enquiry – ${enquiry.enquiryNo}` : "Enquiry"} size="xl">
      {!enquiry ? (
        <div className="py-10 text-center text-sm text-gray-400">
          {enquiryId ? "Loading enquiry details…" : "No enquiry selected."}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold border bg-purple-50 text-purple-700 border-purple-200">
              {enquiry.businessUnit}
            </span>
            {statusBadge(enquiry.status)}
          </div>

          {/* ── 3 Section Cards ──────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-[rgb(var(--bd-default))] rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-bold text-[rgb(var(--fg-subtle))] uppercase tracking-widest">Enquiry Info</p>
              <ROField label="Enquiry No" value={enquiry.enquiryNo} mono />
              <ROField label="Enquiry Date" value={enquiry.date} />
              <ROField label="Sales Type" value={enquiry.salesType} />
            </div>

            <div className="border border-[rgb(var(--bd-default))] rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-bold text-[rgb(var(--fg-subtle))] uppercase tracking-widest">Customer Info</p>
              <ROField label="Lead / Customer Name" value={enquiry.customerName} />
              <ROField label="Concern Person" value={enquiry.concernPerson} />
              <ROField label="Category" value={enquiry.categoryName} />
            </div>

            <div className="border border-[rgb(var(--bd-default))] rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-bold text-[rgb(var(--fg-subtle))] uppercase tracking-widest">Job Details</p>
              <ROField label="Job Name" value={enquiry.jobName} />
              <div className="grid grid-cols-2 gap-2">
                <ROField label="Quantity" value={enquiry.quantity?.toLocaleString()} mono />
                <ROField label="UOM" value={enquiry.uom} />
              </div>
              <ROField label="Sales Person" value={enquiry.salesPersonName} />
            </div>
          </div>

          {/* ── Remark ──────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-medium text-[rgb(var(--fg-default))] mb-1">Remark</label>
            <div className="w-full rounded-md border px-3 py-2 text-xs min-h-[60px] whitespace-pre-wrap
              bg-[rgb(var(--bg-subtle))] text-[rgb(var(--fg-default))] border-[rgb(var(--bd-default))]">
              {enquiry.remarks || <span className="text-[rgb(var(--fg-subtle))]">—</span>}
            </div>
          </div>

          {/* Selected Content */}
          {enquiry.categoryId && (
            <div>
              <SH label={`Select Content — ${enquiry.categoryName}`} />
              {contentSelected ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-teal-500 bg-teal-50 shadow-sm max-w-md">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold leading-tight text-center bg-teal-600 text-white">
                    {contentType.slice(0, 4)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-tight truncate text-teal-700">{contentType}</p>
                    <p className="text-[11px] text-teal-600 mt-0.5 flex items-center gap-1"><Check size={11} /> Selected</p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400 italic py-3 text-center">No content selected for this enquiry.</div>
              )}
            </div>
          )}

          {/* Plan Window Details & Allocation */}
          {contentSelected && (
            <div className="pt-4 mt-2 border-t border-gray-100">
              <div className="flex items-start sm:items-center flex-wrap gap-2 mb-3">
                <SH label="Plan Window Details & Allocation" />
                <span className="sm:ml-auto px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-semibold rounded-full">
                  {contentType}
                </span>
              </div>
              <div className="flex flex-col xl:flex-row gap-6">

                {/* Left: Plan Window Details */}
                <div className="flex-1 space-y-4">
                  {dimCfg ? (
                    <div className="border border-blue-200 rounded-2xl overflow-hidden">
                      <div className="bg-[#f5f9fc] border-b border-[#e2e8f0] px-4 py-2.5 flex items-center gap-2 flex-wrap">
                        <span className="text-[#003366] text-xs font-semibold">Packaging Dimensions</span>
                        <span className="ml-auto text-gray-500 text-[10px] truncate max-w-[200px]">{contentType}</span>
                      </div>
                      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-2">Dimensions (mm)</p>
                          <div className="grid grid-cols-2 gap-2">
                            {dimCfg.fields.map((field: DimField) => (
                              <ROField key={field} label={dimCfg.labels[field] ?? field} value={dimValues[field] || ""} mono />
                            ))}
                          </div>
                        </div>
                        <DimensionDiagram contentType={contentType} dims={dimValues} />
                      </div>
                    </div>
                  ) : (
                    /* Fallback: plain read-only H/W for unrecognized content types (mirrors source's own fallback branch) */
                    <div className="grid grid-cols-2 gap-3">
                      <ROField label="HEIGHT (MM)" value={enquiry.planHeight || ""} mono />
                      <ROField label="WIDTH (MM)" value={enquiry.planWidth || ""} mono />
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <ROField label="FRONT COLORS" value={enquiry.frontColors || ""} mono />
                    <ROField label="BACK COLORS" value={enquiry.backColors || ""} mono />
                    <ROField label="LABEL/ROLL" value={enquiry.labelRoll || ""} mono />
                    <ROField label="Wastage Type" value={enquiry.wastageType || "Machine Default"} />
                    <ROField label="Finished Format" value={enquiry.finishedFormat || "Roll Form"} />
                  </div>
                </div>

                {/* Middle: Process Checklist (read-only) */}
                <div className="w-full xl:w-1/3 space-y-4">
                  <div className="flex bg-teal-700 text-white text-xs font-semibold rounded-t-lg mx-[1px]">
                    <div className="w-10 px-3 py-2 border-r border-teal-600 flex justify-center"><Check size={14} className="opacity-50" /></div>
                    <div className="flex-1 px-3 py-2">Process Name</div>
                  </div>
                  <div className="text-sm border border-gray-200 rounded-b-lg -mt-4 bg-white overflow-y-auto max-h-[350px] divide-y divide-gray-100">
                    {loading && allProcesses.length === 0 ? (
                      <div className="text-xs text-gray-400 italic text-center py-4">Loading processes…</div>
                    ) : allProcesses.length === 0 ? (
                      <div className="text-xs text-gray-400 italic text-center py-4">No processes configured.</div>
                    ) : (
                      allProcesses.map(proc => {
                        const checked = processes.some(p => String(p.id) === String(proc.ProcessID));
                        return (
                          <div key={proc.ProcessID} className="flex items-center">
                            <div className="w-10 px-3 py-2 border-r border-gray-200 flex justify-center">
                              {checked ? (
                                <span className="w-3.5 h-3.5 rounded bg-teal-600 flex items-center justify-center flex-shrink-0">
                                  <Check size={10} className="text-white" strokeWidth={3} />
                                </span>
                              ) : (
                                <span className="w-3.5 h-3.5 rounded border border-gray-300 bg-white flex-shrink-0" />
                              )}
                            </div>
                            <div className={`flex-1 px-3 py-2 text-xs select-none ${checked ? "text-gray-800 font-medium" : "text-gray-400"}`}>
                              {proc.ProcessName}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Ply Structure & Consumables — read-only */}
              <div className="mt-6">
                <SH label="Ply Structure & Consumables" />
                {plys.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    {loading ? "Loading ply structure…" : "No ply structure recorded for this enquiry."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {plys.map((l, index) => {
                      const ordinal = index === 0 ? "1st" : index === 1 ? "2nd" : index === 2 ? "3rd" : `${index + 1}th`;
                      return (
                        <div key={l.id} className="bg-white border-2 border-purple-50 rounded-2xl shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between bg-purple-50 px-4 py-2 border-b border-purple-100">
                            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">{ordinal} Ply — {l.plyType || "—"}</span>
                          </div>
                          <div className="p-3 space-y-3">
                            {(l.itemName || l.gsm > 0) && (
                              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  <ROField label="Film Item" value={l.itemName || "—"} />
                                  <ROField label="Density" value={l.density || ""} mono />
                                  <ROField label="Thickness (μ)" value={l.thickness || ""} mono />
                                  <ROField label="Film GSM" value={l.gsm || ""} mono />
                                </div>
                              </div>
                            )}
                            {l.consumableItems.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">
                                  Consumable Items ({l.consumableItems.length})
                                </span>
                                {l.consumableItems.map((ci, ciIdx) => (
                                  <div key={ci.consumableId ?? ciIdx} className="bg-teal-50/40 border border-teal-100 rounded-xl p-3">
                                    <p className="text-[10px] font-bold text-teal-700 uppercase mb-2">{ci.itemGroup || "Consumable"}</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      <ROField label="Sub Group" value={ci.itemSubGroup || "—"} />
                                      <ROField label="Item" value={ci.itemName || "—"} />
                                      <ROField label="GSM" value={ci.gsm || ""} mono />
                                      {ci.itemGroup === "Ink" && <ROField label="% Solid" value={ci.solidPct ?? ""} mono />}
                                      {ci.itemGroup === "Adhesive" && <ROField label="OH %" value={ci.ohPct ?? ""} mono />}
                                      {ci.itemGroup === "Hardner" && <ROField label="NCO %" value={ci.ncoPct ?? ""} mono />}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {!l.itemName && l.consumableItems.length === 0 && (
                              <p className="text-[10px] text-gray-400 italic text-center py-2">No film/consumable detail recorded for this ply.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end mt-6 pt-4 border-t border-[rgb(var(--bd-default))]">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
