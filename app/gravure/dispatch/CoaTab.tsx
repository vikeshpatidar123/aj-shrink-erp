"use client";

import { RowAction, RowActions } from "@/components/ui/RowAction";
import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Plus, Pencil, Trash2, Printer, Search, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const API = "api/certificateOfAnalysisShrink";

function unwrap(raw: unknown): unknown {
  let r = raw;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}
async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, { headers: authHeaders() });
  return unwrap(await res.text()) as T;
}
async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  return unwrap(await res.text()) as T;
}
function today() { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400000).toISOString().split("T")[0]; }
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }
function normParams(v: unknown): ParamRow[] {
  return arr<Record<string, unknown>>(v).map(p => ({
    ParameterID: Number(p.ParameterID ?? 0),
    TestParaMeterName: String(p.TestParaMeterName ?? ""),
    Specification: String(p.Specification ?? ""),
    SpecificationFieldDataFromTable: String(p.SpecificationFieldDataFromTable ?? ""),
    SpecificationFieldValue: String(p.SpecificationFieldValue ?? ""),
    SpecificationFieldUnit: String(p.SpecificationFieldUnit ?? ""),
    ResultDataFieldType: String(p.ResultDataFieldType ?? ""),
    Defaults: String(p.Defaults ?? ""),
  }));
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface CoaListRow {
  CoaTransactionID: number; CoaNo: string; CoaDate: string; FYear: number;
  JobBookingID: number; JobBookingNo: string; JobName: string; LedgerID: number;
  ClientName: string; CategoryID: number; CategoryName: string; ProductCode: string;
  PONo: string; PODate: string; DNNO: string; DNDate: string; InvoiceNo: string;
  InvoiceDate: string; InvoiceTransactionID: number; FGTransactionID: number;
  Quantity: number; PackingDetails: string; Remark: string;
  ExpiryDate: string; MfgDate: string; RefInvoiceNo: string; RefInvoiceDate: string; SpecificationNo: string;
}
interface JobRow {
  JobBookingID: number; ClientName: string; JobBookingNo: string; JobName: string;
  CategoryName: string; CategoryID: number; Remark: string; ProductCode: string;
  LedgerID: number; OrderQuantity: number; PONo: string; PODate: string;
}
interface ParamRow {
  ParameterID: number; TestParaMeterName: string; Specification: string;
  SpecificationFieldDataFromTable: string; SpecificationFieldValue: string;
  SpecificationFieldUnit: string; ResultDataFieldType: string; Defaults: string;
}
interface DNRow { FGTransactionID: number; DNNO: string; InvoiceTransactionID: number; }
interface InvRow { InvoiceTransactionID: number; InvoiceNo: string; Quantity: number; }

const blankForm = () => ({
  jobBookingID: 0, ledgerID: 0, categoryID: 0,
  coaNo: "", coaDate: today(),
  dnFGID: "", invoiceTransactionID: "",
  refInvoiceNo: "", refInvoiceDate: "", mfgDate: "", poNo: "", poDate: "",
  category: "", clientName: "", jobName: "", productCode: "",
  packingDetails: "", batchNo: "", expiryDate: "", specificationNo: "", remark: "",
});

const inputCls = "w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white";
const roCls = inputCls + " bg-gray-50 text-gray-600";
const lbl = "text-[11px] font-semibold text-gray-500 uppercase tracking-wider";

export default function CoaTab() {
  const { showToast } = useToast();
  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(today());
  const [list, setList] = useState<CoaListRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [params, setParams] = useState<ParamRow[]>([]);
  const [dnList, setDnList] = useState<DNRow[]>([]);
  const [invList, setInvList] = useState<InvRow[]>([]);

  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [jobLoading, setJobLoading] = useState(false);

  const f = <K extends keyof ReturnType<typeof blankForm>>(k: K, v: ReturnType<typeof blankForm>[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── List ───────────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`${API}/coalist?fromDate=${fromDate}&toDate=${toDate}`);
      setList(arr<CoaListRow>(data));
    } catch { showToast("error", "Failed to load COA list"); }
    setLoading(false);
  }, [fromDate, toDate, showToast]);
  useEffect(() => { loadList(); }, [loadList]);

  // ── Create ─────────────────────────────────────────────────────────────────
  const openCreate = async () => {
    setEditMode(false); setEditId(0);
    setForm(blankForm()); setParams([]); setDnList([]); setInvList([]);
    setModalOpen(true);
    setJobs([]); setJobSearch("");
    await openJobPicker();
  };

  const openJobPicker = async () => {
    setJobModalOpen(true); setJobLoading(true);
    try { setJobs(arr<JobRow>(await apiGet(`${API}/selectjobs`))); }
    catch { showToast("error", "Failed to load jobs"); }
    setJobLoading(false);
  };

  const pickJob = async (j: JobRow) => {
    setJobModalOpen(false);
    setForm(p => ({
      ...p,
      jobBookingID: j.JobBookingID ?? 0, ledgerID: j.LedgerID ?? 0, categoryID: j.CategoryID ?? 0,
      category: j.CategoryName ?? "", clientName: j.ClientName ?? "", jobName: j.JobName ?? "",
      productCode: j.ProductCode ?? "", poNo: j.PONo ?? "", poDate: parseDate(j.PODate),
      batchNo: j.JobBookingNo ?? "",
    }));
    // Load parameters template + cascading dropdowns
    try {
      const [pm, dn, inv] = await Promise.all([
        apiGet(`${API}/parameters/${j.JobBookingID}/${j.CategoryID}`),
        apiGet(`${API}/deliverynotes/${j.JobBookingID}`),
        apiGet(`${API}/invoices/${j.JobBookingID}`),
      ]);
      const np = normParams(pm);
      setParams(np);
      setDnList(arr<DNRow>(dn));
      setInvList(arr<InvRow>(inv));
      if (np.length === 0)
        showToast("info", "No COA parameters configured for this category");
    } catch { showToast("error", "Failed to load job COA data"); }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const openEdit = async (row: CoaListRow) => {
    setEditMode(true); setEditId(row.CoaTransactionID);
    setForm({
      jobBookingID: row.JobBookingID, ledgerID: row.LedgerID, categoryID: row.CategoryID,
      coaNo: row.CoaNo || "", coaDate: parseDate(row.CoaDate),
      dnFGID: String(row.FGTransactionID || ""), invoiceTransactionID: String(row.InvoiceTransactionID || ""),
      refInvoiceNo: row.RefInvoiceNo || "", refInvoiceDate: parseDate(row.RefInvoiceDate),
      mfgDate: parseDate(row.MfgDate), poNo: row.PONo || "", poDate: parseDate(row.PODate),
      category: row.CategoryName || "", clientName: row.ClientName || "", jobName: row.JobName || "",
      productCode: row.ProductCode || "", packingDetails: row.PackingDetails || "",
      batchNo: row.JobBookingNo || "", expiryDate: parseDate(row.ExpiryDate),
      specificationNo: row.SpecificationNo || "", remark: row.Remark || "",
    });
    setModalOpen(true);
    try {
      const [det, dn, inv] = await Promise.all([
        apiGet(`${API}/coadetail/${row.CoaTransactionID}`),
        apiGet(`${API}/deliverynotes/${row.JobBookingID}`),
        apiGet(`${API}/invoicesall/${row.JobBookingID}`),
      ]);
      setParams(normParams(det));
      setDnList(arr<DNRow>(dn));
      setInvList(arr<InvRow>(inv));
    } catch { showToast("error", "Failed to load COA detail"); }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.jobBookingID) { showToast("error", "Select a job first"); return; }
    if (params.length === 0) { showToast("error", "No analysis parameters to save"); return; }
    setSaving(true);
    try {
      const payload = {
        Editflag: editMode,
        CoaTransactionID: editMode ? String(editId) : "",
        Main: {
          JobBookingID: String(form.jobBookingID), LedgerID: String(form.ledgerID), CategoryID: String(form.categoryID),
          InvoiceTransactionID: form.invoiceTransactionID || "0", DNTransactionID: form.dnFGID || "0",
          CoaDate: form.coaDate, BatchNo: form.batchNo, PackingDetails: form.packingDetails,
          ExpiryDate: form.expiryDate, MfgDate: form.mfgDate, SpecificationNo: form.specificationNo,
          RefInvoiceNo: form.refInvoiceNo, RefInvoiceDate: form.refInvoiceDate, Remark: form.remark,
        },
        Details: params.map(p => ({
          ParameterID: String(p.ParameterID ?? ""), TestParaMeterName: p.TestParaMeterName ?? "",
          Specification: p.Specification ?? "", SpecificationFieldDataFromTable: p.SpecificationFieldDataFromTable ?? "",
          SpecificationFieldValue: p.SpecificationFieldValue ?? "", SpecificationFieldUnit: p.SpecificationFieldUnit ?? "",
          ResultDataFieldType: p.ResultDataFieldType ?? "", Defaults: p.Defaults ?? "",
        })),
      };
      const res = await apiPost<string>(`${API}/save`, payload);
      if (String(res) === "Success") {
        showToast("success", editMode ? "COA updated" : "COA created");
        setModalOpen(false); loadList();
      } else { showToast("error", "Save failed: " + res); }
    } catch (e) { showToast("error", "Error: " + (e as Error).message); }
    setSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const del = async (row: CoaListRow) => {
    if (!confirm(`Delete COA ${row.CoaNo}? This cannot be undone.`)) return;
    try {
      const res = await apiPost<string>(`${API}/delete`, {
        CoaTransactionID: String(row.CoaTransactionID), InvoiceTransactionID: String(row.InvoiceTransactionID || ""),
      });
      if (String(res) === "Success") { showToast("success", "COA deleted"); loadList(); }
      else showToast("error", "Delete failed: " + res);
    } catch (e) { showToast("error", "Error: " + (e as Error).message); }
  };

  // ── Print (client-side) ──────────────────────────────────────────────────────
  const printCoa = (row: CoaListRow) => {
    apiGet<unknown>(`${API}/coadetail/${row.CoaTransactionID}`).then(d => {
      const det = arr<ParamRow>(d);
      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) return;
      const rows = det.map(p => `<tr><td>${esc(p.TestParaMeterName)}</td><td>${esc(p.SpecificationFieldUnit)}</td><td>${esc(p.Defaults)}</td></tr>`).join("");
      w.document.write(`<html><head><title>COA ${esc(row.CoaNo)}</title>
        <style>body{font-family:Arial;padding:24px;color:#222}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #888;padding:6px 8px;font-size:13px;text-align:left}th{background:#eef}.g{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:13px;margin-top:8px}</style></head>
        <body><h2>Certificate of Analysis</h2><div><b>${esc(row.CoaNo)}</b> &nbsp; ${esc(row.CoaDate)}</div>
        <div class="g"><div><b>Client:</b> ${esc(row.ClientName)}</div><div><b>Job:</b> ${esc(row.JobBookingNo)} — ${esc(row.JobName)}</div>
        <div><b>Product:</b> ${esc(row.ProductCode)}</div><div><b>Category:</b> ${esc(row.CategoryName)}</div>
        <div><b>Batch No:</b> ${esc(row.JobBookingNo)}</div><div><b>Invoice:</b> ${esc(row.InvoiceNo)}</div>
        <div><b>Mfg Date:</b> ${esc(row.MfgDate)}</div><div><b>Expiry:</b> ${esc(row.ExpiryDate)}</div></div>
        <table><thead><tr><th>Test Parameter</th><th>Standard Specification Result</th><th>Result Status</th></tr></thead><tbody>${rows}</tbody></table>
        <p style="margin-top:14px;font-size:13px"><b>Remark:</b> ${esc(row.Remark)}</p>
        <script>window.onload=function(){window.print()}</script></body></html>`);
      w.document.close();
    });
  };

  const jobsFiltered = jobs.filter(j => {
    const q = jobSearch.toLowerCase();
    return !q || j.JobBookingNo?.toLowerCase().includes(q) || j.JobName?.toLowerCase().includes(q) || j.ClientName?.toLowerCase().includes(q);
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex items-end gap-3">
          <div><div className={lbl}>From</div><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputCls} /></div>
          <div><div className={lbl}>To</div><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputCls} /></div>
          <Button variant="secondary" size="md" icon={<RefreshCw size={14} />} onClick={loadList}>Refresh</Button>
        </div>
        <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={openCreate}>Create COA</Button>
      </div>

      {/* list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>{["COA No", "Date", "Job No", "Client", "Job Name", "Category", "DN No", "Invoice No", "Qty", ""].map(h =>
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-gray-400"><Loader2 className="animate-spin inline" size={18} /> Loading…</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-gray-400">No COA records in the selected date range</td></tr>
            ) : list.map(r => (
              <tr key={r.CoaTransactionID} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm font-semibold text-blue-700">{r.CoaNo}</td>
                <td className="px-3 py-2 text-sm">{r.CoaDate}</td>
                <td className="px-3 py-2 text-sm">{r.JobBookingNo}</td>
                <td className="px-3 py-2 text-sm">{r.ClientName}</td>
                <td className="px-3 py-2 text-sm">{r.JobName}</td>
                <td className="px-3 py-2 text-sm">{r.CategoryName}</td>
                <td className="px-3 py-2 text-sm">{r.DNNO}</td>
                <td className="px-3 py-2 text-sm">{r.InvoiceNo}</td>
                <td className="px-3 py-2 text-sm text-right">{r.Quantity}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center gap-1 justify-end">
                    <RowAction.Edit onClick={() => openEdit(r)} />
                    <RowAction.Print onClick={() => printCoa(r)} />
                    <RowAction.Delete onClick={() => del(r)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* create / edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editMode ? `Edit COA — ${form.coaNo}` : "New Certificate of Analysis"} size="lg">
        <div className="space-y-4">
          {!editMode && (
            <Button variant="secondary" size="sm" icon={<Search size={13} />} onClick={openJobPicker}>Select Job</Button>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><div className={lbl}>COA No</div><input value={form.coaNo} readOnly className={roCls} placeholder="(auto)" /></div>
            <div><div className={lbl}>COA Date</div><input type="date" value={form.coaDate} onChange={e => f("coaDate", e.target.value)} className={inputCls} /></div>
            <div><div className={lbl}>PWO No</div><input value={form.batchNo} readOnly className={roCls} /></div>
            <div><div className={lbl}>Product Code</div><input value={form.productCode} readOnly className={roCls} /></div>

            <div><div className={lbl}>Delivery Note No</div>
              <select value={form.dnFGID} onChange={e => f("dnFGID", e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {dnList.map(d => <option key={d.FGTransactionID} value={d.FGTransactionID}>{d.DNNO}</option>)}
              </select></div>
            <div><div className={lbl}>Invoice No</div>
              <select value={form.invoiceTransactionID} onChange={e => f("invoiceTransactionID", e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {invList.map(i => <option key={i.InvoiceTransactionID} value={i.InvoiceTransactionID}>{i.InvoiceNo}</option>)}
              </select></div>
            <div><div className={lbl}>Ref. Invoice No</div><input value={form.refInvoiceNo} onChange={e => f("refInvoiceNo", e.target.value)} className={inputCls} /></div>
            <div><div className={lbl}>Ref. Invoice Date</div><input type="date" value={form.refInvoiceDate} onChange={e => f("refInvoiceDate", e.target.value)} className={inputCls} /></div>

            <div><div className={lbl}>Manufacturing Date</div><input type="date" value={form.mfgDate} onChange={e => f("mfgDate", e.target.value)} className={inputCls} /></div>
            <div><div className={lbl}>Expiry Date</div><input type="date" value={form.expiryDate} onChange={e => f("expiryDate", e.target.value)} className={inputCls} /></div>
            <div><div className={lbl}>PO No</div><input value={form.poNo} readOnly className={roCls} /></div>
            <div><div className={lbl}>Category</div><input value={form.category} readOnly className={roCls} /></div>

            <div><div className={lbl}>Client Name</div><input value={form.clientName} readOnly className={roCls} /></div>
            <div className="md:col-span-2"><div className={lbl}>Job Name</div><input value={form.jobName} readOnly className={roCls} /></div>
            <div><div className={lbl}>Specification No</div><input value={form.specificationNo} onChange={e => f("specificationNo", e.target.value)} className={inputCls} /></div>

            <div><div className={lbl}>Batch No</div><input value={form.batchNo} onChange={e => f("batchNo", e.target.value)} className={inputCls} /></div>
            <div className="md:col-span-3"><div className={lbl}>Packing Details</div><input value={form.packingDetails} onChange={e => f("packingDetails", e.target.value)} className={inputCls} /></div>
          </div>

          {/* parameters grid */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-700 uppercase tracking-wider">Analysis Parameters</div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>{["Test Parameter Name", "Standard Specification Result", "Result Status"].map(h =>
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {params.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-400">No parameters — configure COA parameters for this category in Masters.</td></tr>
                  ) : params.map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-gray-800">{p.TestParaMeterName}</td>
                      <td className="px-3 py-1.5">
                        <input value={p.SpecificationFieldUnit ?? ""} className={inputCls}
                          onChange={e => setParams(prev => prev.map((x, j) => j === i ? { ...x, SpecificationFieldUnit: e.target.value } : x))} />
                      </td>
                      <td className="px-3 py-1.5">
                        <input value={p.Defaults ?? ""} className={inputCls}
                          onChange={e => setParams(prev => prev.map((x, j) => j === i ? { ...x, Defaults: e.target.value } : x))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div><div className={lbl}>Remark</div><textarea rows={2} value={form.remark} onChange={e => f("remark", e.target.value)} className={inputCls} /></div>

          <div className="flex gap-2 pt-1 justify-end">
            <Button variant="secondary" size="md" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="md" loading={saving} onClick={save}>{editMode ? "Update COA" : "Save COA"}</Button>
          </div>
        </div>
      </Modal>

      {/* select-job modal */}
      <Modal open={jobModalOpen} onClose={() => setJobModalOpen(false)} title="Select Job" size="lg">
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
            <input value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder="Search job no / name / client…"
              className={inputCls + " pl-9"} />
          </div>
          <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>{["Client", "Job No", "Job Name", "Category", "Product Code", "PO No", ""].map(h =>
                  <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobLoading ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400"><Loader2 className="animate-spin inline" size={16} /> Loading…</td></tr>
                ) : jobsFiltered.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No jobs found</td></tr>
                ) : jobsFiltered.slice(0, 200).map(j => (
                  <tr key={j.JobBookingID} className="hover:bg-blue-50 cursor-pointer" onClick={() => pickJob(j)}>
                    <td className="px-3 py-1.5">{j.ClientName}</td>
                    <td className="px-3 py-1.5 font-semibold text-blue-700">{j.JobBookingNo}</td>
                    <td className="px-3 py-1.5">{j.JobName}</td>
                    <td className="px-3 py-1.5">{j.CategoryName}</td>
                    <td className="px-3 py-1.5">{j.ProductCode}</td>
                    <td className="px-3 py-1.5">{j.PONo}</td>
                    <td className="px-3 py-1.5 text-right"><span className="text-blue-600 text-xs font-semibold">Select →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────────
function esc(s: unknown) { return String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c)); }
function parseDate(d: string): string {
  if (!d) return "";
  const months: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const m = String(d).match(/^(\d{2})[ -]([A-Za-z]{3})[ -](\d{4})/);
  if (m) return `${m[3]}-${months[m[2]] ?? "01"}-${m[1]}`;
  const iso = String(d).match(/^\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : "";
}
