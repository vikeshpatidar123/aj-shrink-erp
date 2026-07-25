"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Search, Trash2, RotateCcw, Save, ListChecks, Pencil, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const API = "api/jobStatusModificationShrink";
const STATUSES = ["In Queue", "Running", "Hold", "Shift Change", "Part Complete", "Complete"];

function unwrap(raw: unknown): unknown { let r = raw; while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } } return r; }
async function apiGet<T = unknown>(p: string): Promise<T> { const r = await fetch(`${BASE_URL}/${p}`, { headers: authHeaders() }); return unwrap(await r.text()) as T; }
async function apiPost<T = unknown>(p: string, b: unknown): Promise<T> { const r = await fetch(`${BASE_URL}/${p}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(b) }); return unwrap(await r.text()) as T; }
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }
function s(v: unknown) { return String(v ?? ""); }

interface JobCard { JobBookingJobCardContentsID: number; JobCardContentNo: string; JobBookingID: number; JobBookingNo: string; JobName: string; ClientName: string; }
interface JobData {
  JobBookingID: number; JobBookingJobCardContentsID: number; JobCardContentNo: string; JobBookingNo: string; JobName: string;
  ClientName: string; ContentName: string; OrderQuantity: number; PONo: string; PODate: string; ProductCode: string;
  OrderBookingNo: string; CategoryID: number; CategoryName: string; PlanContQty: number; JobSize: string; TotalColors: number; SpecialInstructions: string;
}
interface OpRow {
  JobBookingJobCardProcessID: number; SN: number; ProcessID: number; ProcessName: string; MachineName: string; ScheduledMachine: string;
  RateFactor: string; JobCardFormNo: string; ScheduleQty: number; ProductionQuantity: number; ReadyQuantity: number; WastageQuantity: number;
  SuspenseQuantity: number; Status: string; ScheduleSequenceID: number; JobBookingID: number; JobBookingJobCardContentsID: number;
}
interface ProdRow {
  SN: number; ProcessID: number; ProcessName: string; RateFactor: string; JobCardFormNo: string; MachineName: string; LedgerName: string;
  FromTime: string; ToTime: string; ProductionQuantity: number; ReadyQuantity: number; WastageQuantity: number; SuspenseQuantity: number;
  Status: string; ProductionID: number; JobBookingID: number; OutsourceProductionID: number;
}
interface Category { CategoryID: number; CategoryName: string; }

const lbl = "text-[11px] font-semibold text-gray-500 uppercase tracking-wider";
const ro = "text-sm font-semibold text-gray-800";

export default function JobStatusModificationPage() {
  const { showToast } = useToast();
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [search, setSearch] = useState("");
  const [picker, setPicker] = useState(false);
  const [job, setJob] = useState<JobData | null>(null);
  const [ops, setOps] = useState<OpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catEdit, setCatEdit] = useState("");

  const [prodOpen, setProdOpen] = useState(false);
  const [prodRows, setProdRows] = useState<ProdRow[]>([]);
  const [editTime, setEditTime] = useState<{ id: number; from: string; to: string } | null>(null);

  const [schedEdit, setSchedEdit] = useState<{ op: OpRow; qty: string } | null>(null);

  // ── load job cards + categories ────────────────────────────────────────────
  useEffect(() => {
    apiGet(`${API}/jobcards`).then(d => setJobCards(arr<JobCard>(d))).catch(() => {});
    apiGet(`${API}/categories`).then(d => setCategories(arr<Category>(d))).catch(() => {});
  }, []);

  const selectJob = async (jc: JobCard) => {
    setPicker(false); setLoading(true); setJob(null); setOps([]);
    try {
      const [jd, op] = await Promise.all([
        apiGet(`${API}/jobcarddata/${jc.JobBookingID}`),
        apiGet(`${API}/operations/${jc.JobBookingJobCardContentsID}`),
      ]);
      const jrows = arr<JobData>(jd);
      const j = jrows.find(x => x.JobBookingJobCardContentsID === jc.JobBookingJobCardContentsID) ?? jrows[0] ?? null;
      setJob(j); setCatEdit(j ? String(j.CategoryID) : "");
      setOps(arr<OpRow>(op));
    } catch { showToast("error", "Failed to load job"); }
    setLoading(false);
  };

  const loadOps = async () => {
    if (!job) return;
    try { setOps(arr<OpRow>(await apiGet(`${API}/operations/${job.JobBookingJobCardContentsID}`))); } catch {}
  };

  const post = async (path: string, body: unknown, okMsg: string) => {
    const res = await apiPost<string>(path, body);
    if (String(res) === "Success") { showToast("success", okMsg); return true; }
    showToast("error", String(res)); return false;
  };

  // ── operations actions ──────────────────────────────────────────────────────
  const changeStatus = async (op: OpRow, st: string) => {
    if (!job) return;
    await post(`${API}/savestatus`, {
      JobBookingJobCardContentsID: String(job.JobBookingJobCardContentsID), ProcessID: String(op.ProcessID),
      ScheduleSequenceID: String(op.ScheduleSequenceID), RateFactor: op.RateFactor, SelStatus: st,
    }, "Status updated");
    loadOps();
  };
  const resetStatus = async (op: OpRow) => {
    if (!job) return;
    if (!confirm(`Reset "${op.ProcessName}" to In Queue? This removes its production entries.`)) return;
    await post(`${API}/resetstatus`, {
      JobBookingID: String(job.JobBookingID), JobBookingJobCardContentsID: String(job.JobBookingJobCardContentsID),
      ProcessID: String(op.ProcessID), ScheduleSequenceID: String(op.ScheduleSequenceID), RateFactor: op.RateFactor,
    }, "Reset to In Queue");
    loadOps();
  };
  const deleteOp = async (op: OpRow) => {
    if (!job) return;
    if (!confirm(`Delete process "${op.ProcessName}" from this job? This cannot be undone.`)) return;
    await post(`${API}/deleteoperation`, {
      JobBookingJobCardContentsID: String(job.JobBookingJobCardContentsID), ProcessID: String(op.ProcessID), RateFactor: op.RateFactor,
    }, "Process deleted");
    loadOps();
  };

  const saveCategory = async () => {
    if (!job || !catEdit) return;
    if (await post(`${API}/updatecategory`, { CategoryID: catEdit, JobBookingID: String(job.JobBookingID) }, "Category updated"))
      setJob(j => j ? { ...j, CategoryID: Number(catEdit), CategoryName: categories.find(c => String(c.CategoryID) === catEdit)?.CategoryName ?? j.CategoryName } : j);
  };

  const saveSchedQty = async () => {
    if (!job || !schedEdit) return;
    if (await post(`${API}/updateschedqty`, {
      JobBookingJobCardContentsID: String(job.JobBookingJobCardContentsID), ProcessID: String(schedEdit.op.ProcessID), NewQty: schedEdit.qty,
    }, "Schedule qty updated")) { setSchedEdit(null); loadOps(); }
  };

  // ── production detail ───────────────────────────────────────────────────────
  const openProd = async () => {
    if (!job) return;
    setProdOpen(true); setEditTime(null);
    try { setProdRows(arr<ProdRow>(await apiGet(`${API}/productiondetail/${job.JobBookingJobCardContentsID}`))); }
    catch { setProdRows([]); }
  };
  const saveTime = async () => {
    if (!editTime) return;
    const res = await apiPost<string>(`${API}/updatedatetime`, { ProductionID: String(editTime.id), FromTime: editTime.from, ToTime: editTime.to });
    if (String(res) === "Save" || String(res) === "Success") { showToast("success", "Time updated"); setEditTime(null); openProd(); }
    else showToast("error", String(res));
  };
  const deleteProd = async (p: ProdRow) => {
    if (!job) return;
    if (!confirm(`Delete this production entry (${p.ProcessName}, qty ${p.ProductionQuantity})? This reverses consumption & resets status.`)) return;
    const res = await apiPost<string>(`${API}/deleteproductiondetail`, {
      JobBookingJobCardContentsID: String(job.JobBookingJobCardContentsID), ProductionID: String(p.ProductionID), ProcessID: String(p.ProcessID),
      RateFactor: p.RateFactor, JobCardFormNo: p.JobCardFormNo, OutsourceProductionID: String(p.OutsourceProductionID ?? 0), JobBookingID: String(p.JobBookingID ?? job.JobBookingID),
    });
    if (String(res) === "Success") { showToast("success", "Production entry deleted"); openProd(); loadOps(); }
    else showToast("error", String(res));
  };

  const filtered = jobCards.filter(j => {
    const q = search.toLowerCase();
    return !q || j.JobCardContentNo?.toLowerCase().includes(q) || j.JobName?.toLowerCase().includes(q) || j.ClientName?.toLowerCase().includes(q) || j.JobBookingNo?.toLowerCase().includes(q);
  });

  const statusCls = (st: string) => st === "Complete" ? "bg-emerald-50 text-emerald-700" : st === "Part Complete" ? "bg-amber-50 text-amber-700" : st === "Running" ? "bg-blue-50 text-blue-700" : st === "Hold" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600";

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Job Status Modification</h2>
          <p className="text-sm text-gray-500">Modify process statuses, schedule qty, category & production entries</p>
        </div>
        <Button variant="primary" size="md" icon={<Search size={16} />} onClick={() => setPicker(true)}>Select Job Card</Button>
      </div>

      {!job ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
          Select a job card to begin.
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><div className={lbl}>Job Card No</div><div className={ro}>{job.JobCardContentNo}</div></div>
              <div><div className={lbl}>Job Name</div><div className={ro}>{job.JobName}</div></div>
              <div><div className={lbl}>Client</div><div className={ro}>{job.ClientName}</div></div>
              <div><div className={lbl}>Content</div><div className={ro}>{job.ContentName || "—"}</div></div>
              <div><div className={lbl}>Order Qty</div><div className={ro}>{job.OrderQuantity}</div></div>
              <div><div className={lbl}>PO No</div><div className={ro}>{job.PONo || "—"}</div></div>
              <div><div className={lbl}>Sales Order</div><div className={ro}>{job.OrderBookingNo || "—"}</div></div>
              <div>
                <Select label="Category" value={catEdit} onChange={e => setCatEdit(e.target.value)} options={categories.map(c => ({ value: String(c.CategoryID), label: c.CategoryName }))} />
                {String(job.CategoryID) !== catEdit && (
                  <Button variant="primary" size="sm" icon={<Save size={12} />} onClick={saveCategory}>Save</Button>
                )}
              </div>
            </div>
          </div>

          {/* Operations */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Process Operations</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={<ListChecks size={13} />} onClick={openProd}>Production Details</Button>
                <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={loadOps}>Refresh</Button>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin text-blue-500" size={22} /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>
                    {["#", "Process", "Machine", "Sched Qty", "Production", "Ready", "Wastage", "Suspense", "Status", "Actions"].map(h =>
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {ops.length === 0 ? (
                      <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">No operations</td></tr>
                    ) : ops.map(op => (
                      <tr key={op.JobBookingJobCardProcessID} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{op.SN}</td>
                        <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">{op.ProcessName}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{op.MachineName || op.ScheduledMachine || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => setSchedEdit({ op, qty: String(op.ScheduleQty || 0) })} className="text-blue-600 hover:underline">{op.ScheduleQty}</button>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">{op.ProductionQuantity}</td>
                        <td className="px-3 py-2 text-right">{op.ReadyQuantity}</td>
                        <td className="px-3 py-2 text-right text-red-600">{op.WastageQuantity}</td>
                        <td className="px-3 py-2 text-right text-amber-600">{op.SuspenseQuantity}</td>
                        <td className="px-3 py-2">
                          <Select value={op.Status || "In Queue"} onChange={e => changeStatus(op, e.target.value)} options={STATUSES.map(st => ({ value: st, label: st }))} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button onClick={() => resetStatus(op)} title="Reset to In Queue" className="p-1 rounded hover:bg-amber-100 text-amber-600"><RotateCcw size={13} /></button>
                            <button onClick={() => deleteOp(op)} title="Delete process" className="p-1 rounded hover:bg-red-100 text-red-500"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Job picker modal ── */}
      <Modal open={picker} onClose={() => setPicker(false)} title="Select Job Card" size="lg">
        <div className="space-y-3">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search job card / name / client…" />
          <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0"><tr>
                {["Job Card No", "Job No", "Job Name", "Client", ""].map(h => <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.slice(0, 300).map(jc => (
                  <tr key={jc.JobBookingJobCardContentsID} className="hover:bg-blue-50 cursor-pointer" onClick={() => selectJob(jc)}>
                    <td className="px-3 py-1.5 font-semibold text-blue-700">{jc.JobCardContentNo}</td>
                    <td className="px-3 py-1.5">{jc.JobBookingNo}</td>
                    <td className="px-3 py-1.5">{jc.JobName}</td>
                    <td className="px-3 py-1.5">{jc.ClientName}</td>
                    <td className="px-3 py-1.5 text-right text-blue-600 text-xs font-semibold">Select →</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No job cards</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* ── Production detail modal ── */}
      <Modal open={prodOpen} onClose={() => setProdOpen(false)} title="Production Details" size="lg">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50"><tr>
              {["#", "Process", "Machine", "Operator", "From", "To", "Prod", "Ready", "Wastage", "Status", ""].map(h =>
                <th key={h} className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {prodRows.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">No production entries</td></tr>
              ) : prodRows.map((p, i) => (
                <tr key={`${p.ProductionID}-${i}`} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1.5 font-semibold text-gray-700 whitespace-nowrap">{p.ProcessName}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{p.MachineName || "—"}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{p.LedgerName || "—"}</td>
                  {editTime?.id === p.ProductionID ? (
                    <>
                      <td className="px-2 py-1.5"><Input type="datetime-local" value={editTime.from} onChange={e => setEditTime(t => t ? { ...t, from: e.target.value } : t)} /></td>
                      <td className="px-2 py-1.5"><Input type="datetime-local" value={editTime.to} onChange={e => setEditTime(t => t ? { ...t, to: e.target.value } : t)} /></td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{p.FromTime || "—"}</td>
                      <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{p.ToTime || "—"}</td>
                    </>
                  )}
                  <td className="px-2 py-1.5 text-right font-semibold">{p.ProductionQuantity}</td>
                  <td className="px-2 py-1.5 text-right">{p.ReadyQuantity}</td>
                  <td className="px-2 py-1.5 text-right text-red-600">{p.WastageQuantity}</td>
                  <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusCls(p.Status)}`}>{p.Status}</span></td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end">
                      {editTime?.id === p.ProductionID ? (
                        <>
                          <button onClick={saveTime} className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">Save</button>
                          <button onClick={() => setEditTime(null)} className="p-1 text-gray-400"><X size={13} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditTime({ id: p.ProductionID, from: toLocal(p.FromTime), to: toLocal(p.ToTime) })} title="Edit time" className="p-1 rounded hover:bg-blue-100 text-blue-600"><Pencil size={13} /></button>
                          <button onClick={() => deleteProd(p)} title="Delete entry" className="p-1 rounded hover:bg-red-100 text-red-500"><Trash2 size={13} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* ── Schedule qty modal ── */}
      <Modal open={!!schedEdit} onClose={() => setSchedEdit(null)} title="Update Schedule Qty" size="sm">
        {schedEdit && (
          <div className="space-y-4">
            <div><div className={lbl}>Process</div><div className={ro}>{schedEdit.op.ProcessName}</div></div>
            <Input type="number" value={schedEdit.qty} onChange={e => setSchedEdit(x => x ? { ...x, qty: e.target.value } : x)} label="New Schedule Qty" />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="md" onClick={() => setSchedEdit(null)}>Cancel</Button>
              <Button variant="primary" size="md" onClick={saveSchedQty}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function toLocal(d: string): string {
  if (!d) return "";
  // server returns "dd-Mon-yyyy hh:mm" or "yyyy-mm-dd hh:mm:ss"
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  const months: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const m2 = String(d).match(/^(\d{2})-([A-Za-z]{3})-(\d{4})[ T]?(\d{2})?:?(\d{2})?/);
  if (m2) return `${m2[3]}-${months[m2[2]] ?? "01"}-${m2[1]}T${m2[4] ?? "00"}:${m2[5] ?? "00"}`;
  return "";
}
