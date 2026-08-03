"use client";

import { RowAction } from "@/components/ui/RowAction";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";
import { DataTable } from "@/components/tables/DataTable";
import { downloadCoa, type CoaReportHeader } from "@/lib/coaReport";

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
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }

// Resolve a category parameter row (from LoadCOAParameters, or a saved COA detail) into the
// UI shape. Two type axes drive the render:
//   Specification         = 'Data Field' (std-spec auto-resolved) | 'Text/Combo Field' (static)
//   ResultDataFieldType   = 'Combo Field' (OK|Not OK dropdown)    | 'Text Field' (free text)
function normParams(v: unknown, isEdit: boolean): ParamRow[] {
  return arr<Record<string, unknown>>(v).map(p => {
    const Specification = String(p.Specification ?? "");
    const SpecificationFieldValue = String(p.SpecificationFieldValue ?? "");
    const SpecificationFieldUnit = String(p.SpecificationFieldUnit ?? "");
    const ResultDataFieldType = String(p.ResultDataFieldType ?? "");
    const rawDefaults = String(p.Defaults ?? "");
    const isData = Specification === "Data Field";
    const isCombo = ResultDataFieldType === "Combo Field";
    // Standard spec: data-field → the live-resolved value; else → the static unit text.
    const stdSpec = isData ? (SpecificationFieldValue || SpecificationFieldUnit) : SpecificationFieldUnit;
    // Result options: pipe-list from Defaults (OK|Not OK); fall back to the common pair.
    const resultOptions = isCombo ? (rawDefaults.includes("|") ? rawDefaults.split("|").map(s => s.trim()).filter(Boolean) : ["OK", "Not OK"]) : [];
    // Result value: on edit Defaults holds the saved result; on create it holds options (combo) or
    // the resolved spec (data-field) → start blank for the operator.
    const result = isEdit ? rawDefaults : (rawDefaults.includes("|") || isData ? "" : rawDefaults);
    return {
      ParameterID: Number(p.ParameterID ?? 0), TestParaMeterName: String(p.TestParaMeterName ?? ""),
      Specification, SpecificationFieldDataFromTable: String(p.SpecificationFieldDataFromTable ?? ""),
      SpecificationFieldValue, SpecificationFieldUnit, ResultDataFieldType,
      isData, isCombo, stdSpec, result, resultOptions,
    };
  });
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface CoaListRow {
  CoaTransactionID: number; CoaNo: string; CoaDate: string; FYear: number;
  JobBookingID: number; JobBookingNo: string; JobName: string; LedgerID: number;
  ClientName: string; CategoryID: number; CategoryName: string; ProductCode: string;
  PONo: string; PODate: string; DNNO: string; DNDate: string; InvoiceNo: string;
  InvoiceDate: string; InvoiceTransactionID: number; FGTransactionID: number;
  Quantity: number; OrderQuantity: number; PackingDetails: string; Remark: string;
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
  SpecificationFieldUnit: string; ResultDataFieldType: string;
  isData: boolean; isCombo: boolean; stdSpec: string; result: string; resultOptions: string[];
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

const fld = "w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white";

export default function CoaTab() {
  const { showToast } = useToast();
  // Wide range → load all; DataTable's search + pagination handle filtering.
  const fromDate = "2000-01-01";
  const toDate = "2100-12-31";
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
    try { setList(arr<CoaListRow>(await apiGet(`${API}/coalist?fromDate=${fromDate}&toDate=${toDate}`))); }
    catch { showToast("error", "Failed to load COA list"); }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { loadList(); }, [loadList]);

  // ── Create ─────────────────────────────────────────────────────────────────
  const openCreate = async () => {
    setEditMode(false); setEditId(0);
    setForm(blankForm()); setParams([]); setDnList([]); setInvList([]);
    setModalOpen(true); setJobs([]); setJobSearch("");
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
    try {
      const [pm, dn, inv] = await Promise.all([
        apiGet(`${API}/parameters/${j.JobBookingID}/${j.CategoryID}`),
        apiGet(`${API}/deliverynotes/${j.JobBookingID}`),
        apiGet(`${API}/invoices/${j.JobBookingID}`),
      ]);
      const np = normParams(pm, false);
      setParams(np); setDnList(arr<DNRow>(dn)); setInvList(arr<InvRow>(inv));
      if (np.length === 0) showToast("info", "No COA parameters configured for this category");
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
      setParams(normParams(det, true)); setDnList(arr<DNRow>(dn)); setInvList(arr<InvRow>(inv));
    } catch { showToast("error", "Failed to load COA detail"); }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.jobBookingID) { showToast("error", "Select a job first"); return; }
    if (params.length === 0) { showToast("error", "No analysis parameters to save"); return; }
    if (params.some(p => !String(p.result).trim())) { showToast("error", "Enter a result for every parameter"); return; }
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
        // SpecificationFieldUnit = the standard specification shown (so the print reads it back);
        // Defaults = the operator's result.
        Details: params.map(p => ({
          ParameterID: String(p.ParameterID ?? ""), TestParaMeterName: p.TestParaMeterName ?? "",
          Specification: p.Specification ?? "", SpecificationFieldDataFromTable: p.SpecificationFieldDataFromTable ?? "",
          SpecificationFieldValue: p.SpecificationFieldValue ?? "", SpecificationFieldUnit: p.stdSpec ?? "",
          ResultDataFieldType: p.ResultDataFieldType ?? "", Defaults: p.result ?? "",
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

  // ── Print (PDF) ──────────────────────────────────────────────────────────────
  const printCoa = async (row: CoaListRow) => {
    try {
      const det = arr<Record<string, unknown>>(await apiGet(`${API}/coadetail/${row.CoaTransactionID}`));
      const header: CoaReportHeader = {
        CoaNo: row.CoaNo, CoaDate: row.CoaDate, ClientName: row.ClientName, JobBookingNo: row.JobBookingNo,
        JobName: row.JobName, CategoryName: row.CategoryName, ProductCode: row.ProductCode, PONo: row.PONo,
        DNNO: row.DNNO, DNDate: row.DNDate, InvoiceNo: row.InvoiceNo, InvoiceDate: row.InvoiceDate,
        OrderQuantity: row.OrderQuantity, Quantity: row.Quantity, PackingDetails: row.PackingDetails,
        MfgDate: row.MfgDate, ExpiryDate: row.ExpiryDate, SpecificationNo: row.SpecificationNo,
        BatchNo: row.JobBookingNo, Remark: row.Remark,
      };
      downloadCoa(header, det.map(p => ({
        TestParaMeterName: String(p.TestParaMeterName ?? ""),
        SpecificationFieldUnit: String(p.SpecificationFieldUnit ?? ""),
        Defaults: String(p.Defaults ?? ""),
      })));
    } catch (e) { showToast("error", (e as Error).message); }
  };

  const setParam = (i: number, patch: Partial<ParamRow>) => setParams(prev => prev.map((x, j) => j === i ? { ...x, ...patch } : x));

  const jobsFiltered = jobs.filter(j => {
    const q = jobSearch.toLowerCase();
    return !q || j.JobBookingNo?.toLowerCase().includes(q) || j.JobName?.toLowerCase().includes(q) || j.ClientName?.toLowerCase().includes(q);
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={openCreate}>Create COA</Button>
      </div>

      <DataTable<CoaListRow>
        data={list}
        loading={loading}
        getRowId={r => String(r.CoaTransactionID)}
        columns={[
          { key: "CoaNo", header: "COA No", render: r => <span className="font-medium text-blue-700">{r.CoaNo}</span> },
          { key: "CoaDate", header: "Date" },
          { key: "JobBookingNo", header: "Job No" },
          { key: "ClientName", header: "Client" },
          { key: "JobName", header: "Job Name" },
          { key: "CategoryName", header: "Category" },
          { key: "DNNO", header: "DN No" },
          { key: "InvoiceNo", header: "Invoice No" },
          { key: "Quantity", header: "Qty", render: r => <span>{Number(r.Quantity || 0).toLocaleString()}</span> },
        ]}
        actions={r => (
          <div className="flex items-center gap-1 justify-end">
            <RowAction.Edit onClick={() => openEdit(r)} />
            <RowAction.Print onClick={() => printCoa(r)} />
            <RowAction.Delete onClick={() => del(r)} />
          </div>
        )}
      />

      {/* create / edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editMode ? `Edit COA — ${form.coaNo}` : "New Certificate of Analysis"} size="xl">
        <div className="space-y-4">
          {!editMode && (
            <Button variant="secondary" size="sm" icon={<Search size={13} />} onClick={openJobPicker}>Select Job</Button>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input label="COA No" value={form.coaNo} readOnly placeholder="(auto)" />
            <Input label="COA Date" type="date" value={form.coaDate} onChange={e => f("coaDate", e.target.value)} />
            <Input label="PWO No" value={form.batchNo} readOnly />
            <Input label="Product Code" value={form.productCode} readOnly />

            <Select label="Delivery Note No" value={form.dnFGID} onChange={e => f("dnFGID", e.target.value)} options={[{ value: "", label: "— Select —" }, ...dnList.map(d => ({ value: String(d.FGTransactionID), label: d.DNNO }))]} />
            <Select label="Invoice No" value={form.invoiceTransactionID} onChange={e => f("invoiceTransactionID", e.target.value)} options={[{ value: "", label: "— Select —" }, ...invList.map(i => ({ value: String(i.InvoiceTransactionID), label: i.InvoiceNo }))]} />
            <Input label="Ref. Invoice No" value={form.refInvoiceNo} onChange={e => f("refInvoiceNo", e.target.value)} />
            <Input label="Ref. Invoice Date" type="date" value={form.refInvoiceDate} onChange={e => f("refInvoiceDate", e.target.value)} />

            <Input label="Manufacturing Date" type="date" value={form.mfgDate} onChange={e => f("mfgDate", e.target.value)} />
            <Input label="Expiry Date" type="date" value={form.expiryDate} onChange={e => f("expiryDate", e.target.value)} />
            <Input label="PO No" value={form.poNo} readOnly />
            <Input label="Category" value={form.category} readOnly />

            <Input label="Client Name" value={form.clientName} readOnly />
            <div className="md:col-span-2"><Input label="Job Name" value={form.jobName} readOnly /></div>
            <Input label="Specification No" value={form.specificationNo} onChange={e => f("specificationNo", e.target.value)} />

            <Input label="Batch No" value={form.batchNo} onChange={e => f("batchNo", e.target.value)} />
            <div className="md:col-span-3"><Input label="Packing Details" value={form.packingDetails} onChange={e => f("packingDetails", e.target.value)} /></div>
          </div>

          {/* parameters grid */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-700 uppercase tracking-wider">Analysis Parameters</div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>{["Test Parameter", "Standard Specification", "Result"].map(h =>
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase border border-gray-200">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {params.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-400 border border-gray-200">No parameters — configure COA parameters for this category in Masters → Categories.</td></tr>
                  ) : params.map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-gray-800 border border-gray-200">
                        {p.TestParaMeterName}
                        {p.isData && <span className="ml-1 text-[10px] text-gray-400">(auto)</span>}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-200">
                        {p.isData ? (
                          <span className="text-gray-600">{p.stdSpec || "—"}</span>
                        ) : p.stdSpec.includes("|") ? (
                          <select className={fld} value={p.stdSpec} onChange={e => setParam(i, { stdSpec: e.target.value })}>
                            {p.stdSpec.split("|").map(o => o.trim()).filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input className={fld} value={p.stdSpec} onChange={e => setParam(i, { stdSpec: e.target.value })} />
                        )}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-200">
                        {p.isCombo && p.resultOptions.length ? (
                          <select className={fld} value={p.result} onChange={e => setParam(i, { result: e.target.value })}>
                            <option value="">— Select —</option>
                            {p.resultOptions.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input className={fld} value={p.result} onChange={e => setParam(i, { result: e.target.value })} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Textarea label="Remark" rows={2} value={form.remark} onChange={e => f("remark", e.target.value)} />

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
            <Input value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder="Search job no / name / client…" className="pl-9" />
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
function parseDate(d: string): string {
  if (!d) return "";
  const months: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const m = String(d).match(/^(\d{2})[ -]([A-Za-z]{3})[ -](\d{4})/);
  if (m) return `${m[3]}-${months[m[2]] ?? "01"}-${m[1]}`;
  const iso = String(d).match(/^\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : "";
}
