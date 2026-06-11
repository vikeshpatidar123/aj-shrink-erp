"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Search } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { DataTable, Column } from "@/components/tables/DataTable";
import { Input, Select, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

// ─── Types ────────────────────────────────────────────────────────────────────
type Artwork = {
  ArtworkID: string; ArtworkNo: string; ClientArtWorkNo: string;
  ArtWorkName: string; ArtWorkDescription: string; ArtWorkCost: number;
  ProductCode: string; JobQty: string; JobSize: string;
  PaperDetails: string; MachineName: string; DesignSide: string;
  LedgerID: string; ClientName: string; MobileNo: string; ClientEmail: string;
  SalesEmployeeID: string; SalesEmployee: string;
  CategoryID: string; CategoryName: string;
  ReceivedDate: string; ExpectedCompletionDate: string;
  DocumentNo: string; DocumentType: string; DocumentDate: string;
  BookingID: string; JobBookingID: string; ProductMasterID: string;
  ArtWorkType: "Direct" | "Pending Job";
  CreatedDate: string;
};
type Attachment = { AttachedFileName: string; AttachedFileRemark: string };
type Drop = {
  clients:   { LedgerID: string; LedgerName: string; MobileNo: string; Email: string }[];
  employees: { SalesEmployeeID: string; LedgerName: string }[];
  categories:{ CategoryID: string; CategoryName: string }[];
};
type PendingJob = {
  DocumentID: string; DocumentType: string; LedgerName: string; LedgerID: string;
  CategoryID: string; CategoryName: string; JobName: string; ProductCode: string;
  DocumentNo: string; DocumentDate: string; SalesEmployeeID: string;
};

const BLANK: Record<string, string> = {
  ArtworkID: "", ArtworkNo: "", ClientArtWorkNo: "", JobName: "", ArtWorkDescription: "",
  ArtWorkCost: "", ProductCode: "", JobQty: "", JobSize: "", PaperDetails: "", MachineName: "",
  DesignSide: "", LedgerID: "", SalesEmployeeID: "", CategoryID: "",
  ReceivedDate: new Date().toISOString().slice(0, 10),
  ExpectedCompletionDate: new Date().toISOString().slice(0, 10),
  DocumentNo: "", DocumentType: "", DocumentDate: new Date().toISOString().slice(0, 10),
  BookingID: "0", JobBookingID: "0", ProductMasterID: "0", ArtWorkType: "Direct",
};

// ─── Columns definition ───────────────────────────────────────────────────────
const columns: Column<Artwork>[] = [
  { key: "ArtworkNo",             header: "Artwork No",      sortable: true },
  { key: "CreatedDate",           header: "Date",            sortable: true },
  { key: "ClientName",            header: "Client",          sortable: true },
  { key: "ArtWorkName",           header: "Artwork Name",    sortable: true },
  { key: "ClientArtWorkNo",       header: "Client Art No" },
  { key: "CategoryName",          header: "Category" },
  {
    key: "ArtWorkType", header: "Type",
    render: r => (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.ArtWorkType === "Pending Job" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
        {r.ArtWorkType}
      </span>
    ),
  },
  {
    key: "ArtWorkCost", header: "Cost (₹)", sortable: true,
    render: r => <span className="font-semibold">₹{Number(r.ArtWorkCost).toLocaleString()}</span>,
  },
  { key: "SalesEmployee",         header: "Sales Rep" },
  { key: "ReceivedDate",          header: "Received" },
  { key: "ExpectedCompletionDate",header: "Due Date" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ArtworkLibraryPage() {
  const [drops, setDrops]       = useState<Drop>({ clients: [], employees: [], categories: [] });
  const [rows, setRows]         = useState<Artwork[]>([]);
  const [loading, setLoading]   = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState<Artwork | null>(null);
  const [form, setForm]         = useState({ ...BLANK });
  const [atts, setAtts]         = useState<Attachment[]>([]);
  const [saving, setSaving]     = useState(false);
  const [pendingJobs, setPendingJobs]       = useState<PendingJob[]>([]);
  const [showPicker, setShowPicker]         = useState(false);
  const [pickerSearch, setPickerSearch]     = useState("");

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const loadDrops = useCallback(async () => {
    try {
      const d = await apiGet<Record<string, string>>("api/artworkManagement/dropdowns");
      const parse = (key: string) => { try { return Array.isArray(JSON.parse(d[key])) ? JSON.parse(d[key]) : []; } catch { return []; } };
      setDrops({ clients: parse("clients"), employees: parse("employees"), categories: parse("categories") });
    } catch { /* offline */ }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<Artwork[]>("api/artworkManagement/list");
      setRows(Array.isArray(r) ? r : []);
    } catch { /* offline */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDrops(); loadRows(); }, [loadDrops, loadRows]);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openAdd = () => { setEditing(null); setForm({ ...BLANK }); setAtts([]); setModalOpen(true); };

  const openEdit = async (row: Artwork) => {
    setEditing(row);
    setForm({
      ArtworkID: row.ArtworkID, ArtworkNo: row.ArtworkNo, ClientArtWorkNo: row.ClientArtWorkNo,
      JobName: row.ArtWorkName, ArtWorkDescription: row.ArtWorkDescription,
      ArtWorkCost: String(row.ArtWorkCost ?? ""), ProductCode: row.ProductCode,
      JobQty: row.JobQty, JobSize: row.JobSize, PaperDetails: row.PaperDetails,
      MachineName: row.MachineName, DesignSide: row.DesignSide,
      LedgerID: row.LedgerID, SalesEmployeeID: row.SalesEmployeeID, CategoryID: row.CategoryID,
      ReceivedDate: row.ReceivedDate || new Date().toISOString().slice(0, 10),
      ExpectedCompletionDate: row.ExpectedCompletionDate || new Date().toISOString().slice(0, 10),
      DocumentNo: row.DocumentNo, DocumentType: row.DocumentType,
      DocumentDate: row.DocumentDate || new Date().toISOString().slice(0, 10),
      BookingID: String(row.BookingID || "0"), JobBookingID: String(row.JobBookingID || "0"),
      ProductMasterID: String(row.ProductMasterID || "0"), ArtWorkType: row.ArtWorkType || "Direct",
    });
    try {
      const a = await apiGet<Attachment[]>(`api/artworkManagement/attachments/${row.ArtworkID}`);
      setAtts(Array.isArray(a) ? a : []);
    } catch { setAtts([]); }
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.LedgerID)        { alert("Select Client"); return; }
    if (!form.JobName)         { alert("Enter Artwork Name"); return; }
    if (!form.ClientArtWorkNo) { alert("Enter Client Artwork No"); return; }
    if (!form.CategoryID)      { alert("Select Category"); return; }
    setSaving(true);
    try {
      const res = await apiPost<Record<string, string>>("api/artworkManagement/" + (editing ? "update" : "save"), {
        ...form, ArtworkCost: form.ArtWorkCost, Attachments: atts,
      });
      const parsed = typeof res === "object" ? res : (typeof res === "string" ? JSON.parse(res) : res);
      if (parsed?.Status !== "success") { alert("Save failed: " + JSON.stringify(parsed)); return; }
      setModalOpen(false);
      await loadRows();
    } catch (e: unknown) { alert("Error: " + (e instanceof Error ? e.message : e)); }
    finally { setSaving(false); }
  };

  const del = async (row: Artwork) => {
    if (!confirm(`Delete "${row.ArtworkNo} — ${row.ArtWorkName}"?`)) return;
    try {
      const res = await apiPost<string>("api/artworkManagement/delete", { ArtworkID: row.ArtworkID });
      if (typeof res === "string" && res.includes("Error")) { alert(res); return; }
      await loadRows();
    } catch (e: unknown) { alert("Error: " + (e instanceof Error ? e.message : e)); }
  };

  // ── Pending job picker ─────────────────────────────────────────────────────
  const loadPendingJobs = async () => {
    try { const r = await apiGet<PendingJob[]>("api/artworkManagement/pendingJobs"); setPendingJobs(Array.isArray(r) ? r : []); }
    catch { setPendingJobs([]); }
    setShowPicker(true);
  };
  const applyJob = (j: PendingJob) => {
    f("LedgerID", j.LedgerID); f("SalesEmployeeID", j.SalesEmployeeID || ""); f("CategoryID", j.CategoryID);
    f("JobName", j.JobName); f("ProductCode", j.ProductCode || ""); f("DocumentNo", j.DocumentNo);
    f("DocumentType", j.DocumentType); f("DocumentDate", j.DocumentDate || new Date().toISOString().slice(0, 10));
    if (j.DocumentType === "ProductionWorkOrder") f("JobBookingID", j.DocumentID);
    else f("BookingID", j.DocumentID);
    f("ArtWorkType", "Pending Job");
    setShowPicker(false);
  };

  const selectedClient = drops.clients.find(c => c.LedgerID === form.LedgerID);
  const filteredPending = pendingJobs.filter(j =>
    [j.LedgerName, j.JobName, j.DocumentNo, j.CategoryName]
      .some(v => (v || "").toLowerCase().includes(pickerSearch.toLowerCase()))
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Artwork Library</h1>
          <p className="text-xs text-gray-400 mt-0.5">Create and manage artwork records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadRows} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
          <Button icon={<Plus size={15} />} onClick={openAdd}>New Artwork</Button>
        </div>
      </div>

      {/* Data table */}
      <DataTable
        data={rows}
        columns={columns}
        searchKeys={["ArtworkNo", "ClientName", "ArtWorkName", "ClientArtWorkNo", "CategoryName", "SalesEmployee"] as (keyof Artwork)[]}
        actions={row => (
          <div className="flex items-center gap-1 justify-end">
            <button onClick={() => openEdit(row)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors" title="Edit">
              <Pencil size={13} />
            </button>
            <button onClick={() => del(row)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors" title="Delete">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      />

      {/* ══ Add / Edit Modal ══════════════════════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit Artwork — ${editing.ArtworkNo}` : "New Artwork Entry"} size="xl">
        <div className="flex flex-col gap-4">

          {/* Mode selector */}
          {!editing && (
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
              <span className="font-semibold text-gray-600 text-xs">Type:</span>
              {(["Direct", "Pending Job"] as const).map(m => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input type="radio" name="artworkMode" checked={form.ArtWorkType === m}
                    onChange={() => f("ArtWorkType", m)} className="accent-blue-600" /> {m}
                </label>
              ))}
              {form.ArtWorkType === "Pending Job" && (
                <Button variant="secondary" icon={<Search size={12} />} onClick={loadPendingJobs}>
                  Pick Pending Job
                </Button>
              )}
            </div>
          )}
          {editing && (
            <div className="text-xs text-gray-500">
              Artwork No: <span className="font-bold text-blue-700 text-sm ml-1">{form.ArtworkNo}</span>
            </div>
          )}

          {/* Fields grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select label="Client *" value={form.LedgerID} onChange={e => f("LedgerID", e.target.value)}
              disabled={form.ArtWorkType === "Pending Job" && !editing}
              options={[{ value: "", label: "— Select Client —" }, ...drops.clients.map(c => ({ value: c.LedgerID, label: c.LedgerName }))]} />
            <Input label="Mobile" value={selectedClient?.MobileNo ?? ""} readOnly />
            <Input label="Email"  value={selectedClient?.Email ?? ""}    readOnly />
            <Select label="Sales Rep *" value={form.SalesEmployeeID} onChange={e => f("SalesEmployeeID", e.target.value)}
              disabled={form.ArtWorkType === "Pending Job" && !editing}
              options={[{ value: "", label: "— Select —" }, ...drops.employees.map(e => ({ value: String(e.SalesEmployeeID), label: e.LedgerName }))]} />

            <Input label="Artwork Name *" value={form.JobName} onChange={e => f("JobName", e.target.value)}
              readOnly={form.ArtWorkType === "Pending Job" && !editing} />
            <Input label="Client Artwork No *" value={form.ClientArtWorkNo} onChange={e => f("ClientArtWorkNo", e.target.value)} />
            <Input label="Product Code" value={form.ProductCode} onChange={e => f("ProductCode", e.target.value)}
              readOnly={form.ArtWorkType === "Pending Job" && !editing} />
            <Select label="Category *" value={form.CategoryID} onChange={e => f("CategoryID", e.target.value)}
              disabled={form.ArtWorkType === "Pending Job" && !editing}
              options={[{ value: "", label: "— Select —" }, ...drops.categories.map(c => ({ value: String(c.CategoryID), label: c.CategoryName }))]} />

            <Input label="Design Cost (₹)" type="number" value={form.ArtWorkCost} onChange={e => f("ArtWorkCost", e.target.value)} />
            <Input label="Received Date"   type="date"   value={form.ReceivedDate} onChange={e => f("ReceivedDate", e.target.value)} />
            <Input label="Expected Date"   type="date"   value={form.ExpectedCompletionDate} onChange={e => f("ExpectedCompletionDate", e.target.value)} />
            <Input label="Job Qty"    value={form.JobQty}      onChange={e => f("JobQty", e.target.value)} />
            <Input label="Job Size"   value={form.JobSize}     onChange={e => f("JobSize", e.target.value)} />
            <Input label="Paper Details" value={form.PaperDetails} onChange={e => f("PaperDetails", e.target.value)} />
            <Input label="Machine Name"  value={form.MachineName}  onChange={e => f("MachineName", e.target.value)} />
            <Input label="Design Side"   value={form.DesignSide}   onChange={e => f("DesignSide", e.target.value)} />

            <Input label="Document No" value={form.DocumentNo} onChange={e => f("DocumentNo", e.target.value)}
              readOnly={form.ArtWorkType === "Pending Job" && !editing} />
            <Input label="Document Type" value={form.DocumentType} onChange={e => f("DocumentType", e.target.value)}
              readOnly={form.ArtWorkType === "Pending Job" && !editing} />
            <Input label="Document Date" type="date" value={form.DocumentDate} onChange={e => f("DocumentDate", e.target.value)}
              readOnly={form.ArtWorkType === "Pending Job" && !editing} />
          </div>

          <Textarea label="Artwork Description" value={form.ArtWorkDescription}
            onChange={e => f("ArtWorkDescription", e.target.value)} rows={2} />

          {/* Attachments */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Attachments</p>
            <div className="flex flex-col gap-2">
              {atts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border text-xs">
                  <span className="flex-1 font-medium truncate">{a.AttachedFileName}</span>
                  <input className="flex-1 border rounded px-2 py-1 text-xs" placeholder="Remark"
                    value={a.AttachedFileRemark}
                    onChange={e => setAtts(prev => prev.map((x, j) => j === i ? { ...x, AttachedFileRemark: e.target.value } : x))} />
                  <button onClick={() => setAtts(prev => prev.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 p-1"><X size={12} /></button>
                </div>
              ))}
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
                <Plus size={12} /> Add Attachment
                <input type="file" multiple className="hidden" onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  setAtts(prev => [...prev, ...files.filter(f => !prev.some(a => a.AttachedFileName === f.name)).map(f => ({ AttachedFileName: f.name, AttachedFileRemark: "" }))]);
                  e.target.value = "";
                }} />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ══ Pending Job Picker ════════════════════════════════════════════════ */}
      <Modal open={showPicker} onClose={() => setShowPicker(false)} title="Select Pending Job" size="xl">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
              placeholder="Search client, job name, document..."
              value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} />
          </div>
          <div className="overflow-auto rounded-lg border border-gray-200" style={{ maxHeight: "55vh" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--erp-primary)" }}>
                  {["Type", "Date", "Client", "Category", "Job Name", "Doc No"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white/90">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredPending.map((j, i) => (
                  <tr key={`${j.DocumentType}_${j.DocumentID}`} onDoubleClick={() => applyJob(j)}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/60"}`}>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-100 text-blue-700">{j.DocumentType}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{j.DocumentDate}</td>
                    <td className="px-3 py-2.5 font-medium">{j.LedgerName}</td>
                    <td className="px-3 py-2.5 text-gray-500">{j.CategoryName}</td>
                    <td className="px-3 py-2.5">{j.JobName}</td>
                    <td className="px-3 py-2.5 text-gray-500">{j.DocumentNo}</td>
                  </tr>
                ))}
                {filteredPending.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">No pending jobs found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-center text-gray-400">Double-click a row to select</p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowPicker(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
