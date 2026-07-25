"use client";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Check, Loader2, Printer } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import TutorialButton from "@/components/ui/TutorialButton";
import { authHeaders } from "@/lib/auth";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in").replace(/\/$/, "");
const API  = `${BASE}/api/gatePassEntryShrink`;

function unwrap(v: unknown): unknown {
  let r = v;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(), ...opts });
  return unwrap(await res.json()) as T;
}

// ─── Types ─────────────────────────────────────────────────────────────────
const GP_TYPES = ["Non-Returnable", "Maintenance(Returnable)", "Job Outsource(Returnable)", "General(Returnable)"] as const;
type GPType = typeof GP_TYPES[number];
const LEDGER_TYPES = ["Client", "Supplier", "Other"] as const;
const PREFIXES: Record<GPType, string> = {
  "Non-Returnable": "GP-NR",
  "Maintenance(Returnable)": "GP-R/M",
  "Job Outsource(Returnable)": "GP-R/O",
  "General(Returnable)": "GP-GR",
};
const VOUCHER_IDS: Record<GPType, string> = {
  "Non-Returnable": "-124",
  "Maintenance(Returnable)": "-125",
  "Job Outsource(Returnable)": "-127",
  "General(Returnable)": "-126",
};

type ListRow = {
  TransactionID: string;
  GatePassType: string;
  LedgerName: string;
  VoucherNo: string;
  VoucherDate: string;
  DocumentNo: string;
  SentThrough: string;
  VehicleNo: string;
};

type DropdownData = {
  Department: { DepartmentID: string; DepartmentName: string }[];
  Unit: { UnitID: string; UnitSymbol: string }[];
  Material: { MaterialSentThrough: string }[];
};

type MWORow = {
  MaintenanceWOID: string;
  TicketNo: string;
  MaintenanceWONo: string;
  MaintenanceWODate: string;
  LedgerID: string;
  LedgerName: string;
  TotalQuantity: string;
  UnitSymbol: string;
};

type ItemRow = {
  _id: string;
  ItemName: string;
  Quantity: string;
  UnitSymbol: string;
  MaintenanceWOID?: string;
  SpareID?: string;
  MWONo?: string;
  MWODate?: string;
  SpareName?: string;
  TicketNo?: string;
};

type FormState = {
  TransactionID: string;
  gpType: GPType;
  ledgerType: string;
  ledgerId: string;
  materialSentTo: string;
  departmentId: string;
  voucherDate: string;
  voucherNo: string;
  documentNo: string;
  vehicleNo: string;
  remark: string;
  materialSentThrough: string;
  sentThroughName: string;
  items: ItemRow[];
};

const blankForm = (): FormState => ({
  TransactionID: "",
  gpType: "Non-Returnable",
  ledgerType: "Client",
  ledgerId: "",
  materialSentTo: "",
  departmentId: "",
  voucherDate: new Date().toISOString().slice(0, 10),
  voucherNo: "",
  documentNo: "",
  vehicleNo: "",
  remark: "",
  materialSentThrough: "",
  sentThroughName: "",
  items: [],
});

const isCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";

// Convert "DD-MMM-YYYY" (SQL format 106 with spaces→dashes) to "YYYY-MM-DD" for <input type="date">
function parseDisplayDate(v: string): string {
  if (!v) return new Date().toISOString().slice(0, 10);
  const months: Record<string, string> = { Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12" };
  const parts = v.split("-");
  if (parts.length === 3 && months[parts[1]]) return `${parts[2]}-${months[parts[1]]}-${parts[0].padStart(2,"0")}`;
  return v;
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function GatePassEntryPage() {
  const [activeTab, setActiveTab] = useState<GPType | "All">("Non-Returnable");
  const [list, setList]           = useState<ListRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState<FormState>(blankForm());
  const [dropdowns, setDropdowns] = useState<DropdownData>({ Department: [], Unit: [], Material: [] });
  const [ledgers, setLedgers]     = useState<{ LedgerID: string; LedgerName: string }[]>([]);
  const [mwoList, setMwoList]     = useState<MWORow[]>([]);
  const [showMWO, setShowMWO]     = useState(false);
  const [mwoLoading, setMwoLoading] = useState(false);
  const [error, setError]         = useState("");

  // ─── Load list ──────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await apiFetch<ListRow[]>(`${API}/getlist?type=${encodeURIComponent(activeTab)}`);
      setList(Array.isArray(data) ? data : []);
    } catch { setList([]); } finally { setListLoading(false); }
  }, [activeTab]);

  useEffect(() => { loadList(); }, [loadList]);

  // ─── Load dropdown data for modal ───────────────────────────────────────
  const loadDropdowns = async () => {
    try {
      const data = await apiFetch<DropdownData>(`${API}/getdropdowndata`);
      if (data) setDropdowns(data as DropdownData);
    } catch {}
  };

  // ─── Load ledgers by type ────────────────────────────────────────────────
  const loadLedgers = async (ledgerType: string) => {
    if (ledgerType === "Other") { setLedgers([]); return; }
    const groupId = ledgerType === "Supplier" ? 2 : 1;
    try {
      const data = await apiFetch<{ LedgerID: string; LedgerName: string }[]>(`${API}/getledgers?ledgerGroupId=${groupId}`);
      setLedgers(Array.isArray(data) ? data : []);
    } catch { setLedgers([]); }
  };

  // ─── Get next voucher number ─────────────────────────────────────────────
  const fetchVoucherNo = async (gpType: GPType) => {
    try {
      const no = await apiFetch<string>(`${API}/getvoucherno?prefix=${encodeURIComponent(PREFIXES[gpType])}`);
      setForm(f => ({ ...f, voucherNo: no || "" }));
    } catch {}
  };

  // ─── Open add modal ──────────────────────────────────────────────────────
  const openAdd = async () => {
    const f = blankForm();
    setForm(f);
    setEditMode(false);
    setError("");
    await loadDropdowns();
    await loadLedgers("Client");
    await fetchVoucherNo("Non-Returnable");
    setShowModal(true);
  };

  // ─── Open edit modal ─────────────────────────────────────────────────────
  const openEdit = async (row: ListRow) => {
    setError("");
    setEditMode(true);
    await loadDropdowns();

    try {
      const data = await apiFetch<{ Main: Record<string, unknown>[]; Detail: Record<string, unknown>[] }>(
        `${API}/loaddata?transactionId=${row.TransactionID}&type=${encodeURIComponent(row.GatePassType)}`
      );
      const m = data?.Main?.[0] ?? {};
      const gpType = (String(m.GatePassType ?? "Non-Returnable")) as GPType;
      const ledgerType = String(m.LedgerType ?? "Client");
      await loadLedgers(ledgerType);

      const items: ItemRow[] = (data?.Detail ?? []).map((d, i) => ({
        _id: String(i),
        ItemName: String(d.ItemName ?? d.SpareName ?? ""),
        Quantity: String(d.Quantity ?? ""),
        UnitSymbol: String(d.UnitSymbol ?? d.Unit ?? ""),
        MaintenanceWOID: String(d.MaintenanceWOID ?? ""),
        SpareID: String(d.SpareID ?? ""),
        MWONo: String(d.MWONo ?? ""),
        MWODate: String(d.MWODate ?? ""),
        SpareName: String(d.SpareName ?? ""),
        TicketNo: String(d.TicketNo ?? ""),
      }));

      setForm({
        TransactionID: row.TransactionID,
        gpType,
        ledgerType,
        ledgerId: String(m.LedgerID ?? ""),
        materialSentTo: String(m.MaterialSentTo ?? ""),
        departmentId: String(m.DepartmentID ?? ""),
        voucherDate: parseDisplayDate(String(m.VoucherDate ?? "")),
        voucherNo: String(m.VoucherNo ?? ""),
        documentNo: String(m.DocumentNo ?? ""),
        vehicleNo: String(m.VehicleNo ?? ""),
        remark: String(m.Remark ?? ""),
        materialSentThrough: String(m.SentThrough ?? ""),
        sentThroughName: String(m.SentThroughDetail ?? ""),
        items,
      });
    } catch (e: unknown) { setError("Load failed: " + String(e)); }
    setShowModal(true);
  };

  // ─── Handle GP type change ──────────────────────────────────────────────
  const handleGPTypeChange = async (gpType: GPType) => {
    const isMaintenance = gpType === "Maintenance(Returnable)";
    setForm(f => ({
      ...f,
      gpType,
      ledgerType: isMaintenance ? "Supplier" : f.ledgerType,
      ledgerId: "",
      items: [],
    }));
    if (isMaintenance) await loadLedgers("Supplier");
    if (!editMode) await fetchVoucherNo(gpType);
  };

  // ─── Handle ledger type change ───────────────────────────────────────────
  const handleLedgerTypeChange = async (ledgerType: string) => {
    setForm(f => ({ ...f, ledgerType, ledgerId: "" }));
    await loadLedgers(ledgerType);
  };

  // ─── MWO popup ───────────────────────────────────────────────────────────
  const openMWO = async () => {
    setMwoLoading(true);
    setShowMWO(true);
    try {
      const data = await apiFetch<MWORow[]>(`${API}/getmwo?type=All&maintenanceWoId=0`);
      setMwoList(Array.isArray(data) ? data : []);
    } catch { setMwoList([]); } finally { setMwoLoading(false); }
  };

  const applyMWO = async (mwo: MWORow) => {
    setForm(f => ({ ...f, ledgerId: mwo.LedgerID }));
    try {
      const rows = await apiFetch<ItemRow[]>(`${API}/getmwo?type=apply&maintenanceWoId=${mwo.MaintenanceWOID}`);
      setForm(f => ({
        ...f,
        items: (Array.isArray(rows) ? rows : []).map((r, i) => ({
          _id: String(Date.now() + i),
          ItemName: String((r as Record<string, unknown>).SpareName ?? ""),
          Quantity: String((r as Record<string, unknown>).Quantity ?? ""),
          UnitSymbol: String((r as Record<string, unknown>).Unit ?? ""),
          MaintenanceWOID: String(mwo.MaintenanceWOID),
          SpareID: String((r as Record<string, unknown>).SpareID ?? ""),
          MWONo: String(mwo.MaintenanceWONo),
          MWODate: String(mwo.MaintenanceWODate),
          SpareName: String((r as Record<string, unknown>).SpareName ?? ""),
          TicketNo: String(mwo.TicketNo ?? ""),
        })),
      }));
    } catch {}
    setShowMWO(false);
  };

  // ─── Item grid helpers ───────────────────────────────────────────────────
  const addItem = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, { _id: String(Date.now()), ItemName: "", Quantity: "", UnitSymbol: "" }],
    }));
  };

  const removeItem = (id: string) => {
    setForm(f => ({ ...f, items: f.items.filter(i => i._id !== id) }));
  };

  const updateItem = (id: string, field: keyof ItemRow, value: string) => {
    setForm(f => ({ ...f, items: f.items.map(i => i._id === id ? { ...i, [field]: value } : i) }));
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.items.length) { setError("Please add at least one item."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        EditMode: editMode,
        TransactionID: form.TransactionID || 0,
        GatePassEntryType: form.gpType,
        LedgerType: form.ledgerType,
        LedgerID: form.ledgerType !== "Other" ? form.ledgerId || null : null,
        MaterialSentTo: form.ledgerType === "Other" ? form.materialSentTo : "",
        DepartmentID: form.departmentId || null,
        DocumentNo: form.documentNo,
        VehicleNo: form.vehicleNo,
        Remark: form.remark,
        VoucherDate: form.voucherDate,
        VoucherNo: form.voucherNo,
        MaterialSentThrough: form.materialSentThrough,
        MaterialSentThroughName: form.sentThroughName,
        Prefix: PREFIXES[form.gpType],
        VoucherID: VOUCHER_IDS[form.gpType],
        Items: form.items.map(i => ({
          ItemName: i.ItemName,
          Quantity: parseFloat(i.Quantity) || 0,
          UnitSymbol: i.UnitSymbol,
          MaintenanceWOID: i.MaintenanceWOID || null,
          SpareID: i.SpareID || null,
        })),
      };
      const res = await fetch(`${API}/savegatepass`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = unwrap(await res.json());
      if (result === "Success") {
        setShowModal(false);
        loadList();
      } else {
        setError(typeof result === "string" ? (result || "Save failed") : JSON.stringify(result) || "Save failed");
      }
    } catch (e: unknown) { setError(String(e)); } finally { setSaving(false); }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const deleteRow = async (row: ListRow) => {
    if (!confirm(`Delete gate pass ${row.VoucherNo}?`)) return;
    try {
      const result = unwrap(await (await fetch(`${API}/deletegatepass/${row.TransactionID}`, { headers: authHeaders() })).json());
      if (result === "Exist") alert("This gate pass is used in another process and cannot be deleted.");
      else if (result === "Success") loadList();
      else alert(String(result || "Delete failed"));
    } catch (e: unknown) { alert(String(e)); }
  };

  const TABS: (GPType | "All")[] = [...GP_TYPES, "All"];

  const columns: Column<ListRow>[] = [
    { key: "VoucherNo",    header: "GP No.",       sortable: true },
    { key: "VoucherDate",  header: "Date",          sortable: true },
    { key: "GatePassType", header: "Type",          sortable: true },
    { key: "LedgerName",   header: "Material Sent To", sortable: true },
    { key: "DocumentNo",   header: "Doc No.",       sortable: true },
    { key: "SentThrough",  header: "Sent Through",  sortable: true },
    { key: "VehicleNo",    header: "Vehicle No.",   sortable: true },
  ];

  const isMaintenance = form.gpType === "Maintenance(Returnable)";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gate Pass Entry</h2>
          <p className="text-sm text-gray-500">{listLoading ? "Loading..." : `${list.length} record${list.length !== 1 ? "s" : ""}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <TutorialButton title="Gate Pass Entry — Tutorial" />
          <Button variant="secondary" pill icon={<Plus size={16} />} onClick={openAdd}>New Gate Pass</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={list.map(r => ({ ...r, id: r.TransactionID }))}
          columns={columns}
          searchKeys={["VoucherNo", "LedgerName", "GatePassType"]}
          actions={row => (
            <div className="flex items-center gap-2 justify-end">
              <RowAction.Edit onClick={() => openEdit(row)} />
              <RowAction.Delete onClick={() => deleteRow(row)} />
            </div>
          )}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto mx-4">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-gray-800">
                {editMode ? "Edit Gate Pass" : "New Gate Pass"}
              </h3>
              <div className="flex items-center gap-3">
                <Button onClick={save} loading={saving} icon={<Check size={15} />}>
                  {editMode ? "Update" : "Save"}
                </Button>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {error && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

              {/* Gate Pass Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Gate Pass Type</label>
                <div className="flex flex-wrap gap-3">
                  {GP_TYPES.map(t => (
                    <label key={t} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                      form.gpType === t ? "bg-blue-50 border-blue-500 text-blue-700" : "border-gray-300 text-gray-700 hover:border-gray-400"
                    }`}>
                      <input type="radio" name="gpType" value={t} checked={form.gpType === t}
                        onChange={() => handleGPTypeChange(t)} className="hidden" />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              {/* GP No + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">GP No.</label>
                  <input value={form.voucherNo} readOnly className={isCls + " bg-gray-50"} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                  <input type="date" value={form.voucherDate}
                    onChange={e => setForm(f => ({ ...f, voucherDate: e.target.value }))} className={isCls} />
                </div>
              </div>

              {/* Material Sent To + Ledger Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Material Sent To</label>
                <div className="flex gap-3 mb-3">
                  {LEDGER_TYPES.map(lt => (
                    <label key={lt} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                      form.ledgerType === lt && !isMaintenance
                        ? "bg-blue-50 border-blue-500 text-blue-700"
                        : form.ledgerType === lt && isMaintenance
                          ? "bg-blue-50 border-blue-500 text-blue-700 opacity-60"
                          : "border-gray-300 text-gray-700 hover:border-gray-400"
                    } ${isMaintenance ? "cursor-not-allowed" : ""}`}>
                      <input type="radio" name="ledgerType" value={lt} checked={form.ledgerType === lt}
                        disabled={isMaintenance}
                        onChange={() => handleLedgerTypeChange(lt)} className="hidden" />
                      {lt}
                    </label>
                  ))}
                </div>
                {form.ledgerType === "Other" ? (
                  <input value={form.materialSentTo}
                    onChange={e => setForm(f => ({ ...f, materialSentTo: e.target.value }))}
                    placeholder="Enter name" className={isCls} />
                ) : (
                  <select value={form.ledgerId} onChange={e => setForm(f => ({ ...f, ledgerId: e.target.value }))}
                    disabled={isMaintenance} className={isCls}>
                    <option value="">-- Select --</option>
                    {ledgers.map(l => (
                      <option key={l.LedgerID} value={l.LedgerID}>{l.LedgerName}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Department + Document No */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Department</label>
                  <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} className={isCls}>
                    <option value="">-- Select --</option>
                    {dropdowns.Department.map(d => (
                      <option key={d.DepartmentID} value={d.DepartmentID}>{d.DepartmentName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Document No.</label>
                  <input value={form.documentNo} onChange={e => setForm(f => ({ ...f, documentNo: e.target.value }))}
                    placeholder="Doc No." className={isCls} />
                </div>
              </div>

              {/* Material Sent Through + Sent Through Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Material Sent Through</label>
                  <select value={form.materialSentThrough}
                    onChange={e => setForm(f => ({ ...f, materialSentThrough: e.target.value }))} className={isCls}>
                    <option value="">-- Select --</option>
                    <option>By Hand</option>
                    <option>Courier</option>
                    <option>Transport</option>
                    {dropdowns.Material.filter(m => m.MaterialSentThrough && !["By Hand","Courier","Transport"].includes(m.MaterialSentThrough))
                      .map((m, i) => <option key={i}>{m.MaterialSentThrough}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Sent Through Name</label>
                  <input value={form.sentThroughName} onChange={e => setForm(f => ({ ...f, sentThroughName: e.target.value }))}
                    placeholder="Courier / Transporter name" className={isCls} />
                </div>
              </div>

              {/* Vehicle No + Remark */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Vehicle / LR No.</label>
                  <input value={form.vehicleNo} onChange={e => setForm(f => ({ ...f, vehicleNo: e.target.value }))}
                    placeholder="Vehicle / LR No." className={isCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Remark</label>
                  <input value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
                    placeholder="Remark" className={isCls} />
                </div>
              </div>

              {/* Item Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {isMaintenance ? "MWO Details" : "Item Details"}
                  </label>
                  {isMaintenance ? (
                    <Button variant="secondary" size="sm" onClick={openMWO}>+ Add MWO</Button>
                  ) : (
                    <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={addItem}>Add Row</Button>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">S.No</th>
                        {isMaintenance ? (
                          <>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Ticket No</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">MWO No</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Spare Name</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Qty</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Unit</th>
                          </>
                        ) : (
                          <>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Item Name</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Qty</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">UOM</th>
                          </>
                        )}
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400 text-sm">
                          {isMaintenance ? "Click \"Add MWO\" to add maintenance work orders" : "No items added yet"}
                        </td></tr>
                      ) : form.items.map((item, idx) => (
                        <tr key={item._id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                          {isMaintenance ? (
                            <>
                              <td className="px-3 py-2">{item.TicketNo || "—"}</td>
                              <td className="px-3 py-2">{item.MWONo || "—"}</td>
                              <td className="px-3 py-2">{item.SpareName || item.ItemName}</td>
                              <td className="px-3 py-2">
                                <input value={item.Quantity} onChange={e => updateItem(item._id, "Quantity", e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm" />
                              </td>
                              <td className="px-3 py-2">{item.UnitSymbol}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2">
                                <input value={item.ItemName} onChange={e => updateItem(item._id, "ItemName", e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm" placeholder="Item name" />
                              </td>
                              <td className="px-3 py-2">
                                <input value={item.Quantity} onChange={e => updateItem(item._id, "Quantity", e.target.value)}
                                  type="number" className="w-24 px-2 py-1 border border-gray-300 rounded text-sm" />
                              </td>
                              <td className="px-3 py-2">
                                <select value={item.UnitSymbol} onChange={e => updateItem(item._id, "UnitSymbol", e.target.value)}
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm">
                                  <option value="">—</option>
                                  {dropdowns.Unit.map(u => <option key={u.UnitID} value={u.UnitSymbol}>{u.UnitSymbol}</option>)}
                                </select>
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2">
                            <button onClick={() => removeItem(item._id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MWO Picker Modal */}
      {showMWO && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden mx-4 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">Select Maintenance Work Order</h3>
              <button onClick={() => setShowMWO(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {mwoLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Ticket No</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">MWO No</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Ledger</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Qty</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mwoList.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-6 text-gray-400">No MWO records found</td></tr>
                    ) : mwoList.map(m => (
                      <tr key={m.MaintenanceWOID} className="border-t border-gray-100 hover:bg-blue-50">
                        <td className="px-3 py-2">{m.TicketNo || "—"}</td>
                        <td className="px-3 py-2">{m.MaintenanceWONo}</td>
                        <td className="px-3 py-2">{m.MaintenanceWODate}</td>
                        <td className="px-3 py-2">{m.LedgerName}</td>
                        <td className="px-3 py-2">{m.TotalQuantity} {m.UnitSymbol}</td>
                        <td className="px-3 py-2">
                          <Button variant="secondary" size="sm" onClick={() => applyMWO(m)}>Apply</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
