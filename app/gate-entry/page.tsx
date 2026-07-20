"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Check, Loader2, Search } from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import TutorialButton from "@/components/ui/TutorialButton";
import { authHeaders } from "@/lib/auth";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in").replace(/\/$/, "");
const API  = `${BASE}/api/gateEntryShrink`;

function unwrap(v: unknown): unknown {
  let r = v;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(), ...opts });
  return unwrap(await res.json()) as T;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const ENTRY_TYPES_OUTWARD = [
  "Finish Goods Delivery",
  "General Returnable Gate Pass",
  "Job Outsource Returnable Gate Pass",
  "Maintenance Returnable Gate Pass",
  "Non-Returnable Gate Pass",
] as const;

const ENTRY_TYPES_INWARD = [
  "General Returnable Gate Pass",
  "Item",
  "Job Outsource Returnable Gate Pass",
  "Maintenance Returnable Gate Pass",
  "Other",
  "Spare",
  "Tool",
] as const;

type EntryDirection = "Outward" | "Inward";

// Types that require a Gate Pass picker (not manual entry)
const GP_PICKER_TYPES = new Set([
  "General Returnable Gate Pass",
  "Job Outsource Returnable Gate Pass",
  "Maintenance Returnable Gate Pass",
  "Non-Returnable Gate Pass",
  "Finish Goods Delivery",
]);

// Types that require PO selection (Inward only)
const PO_TYPES = new Set(["Item", "Tool", "Spare", "Other"]);

// ─── Types ──────────────────────────────────────────────────────────────────
type ListRow = {
  TransactionID: string;
  VoucherNo: string;
  VoucherDate: string;
  GateEntryType: string;
  DCNo: string;
  MaterialSentTo: string;
  SendThrough: string;
  SendThroughName: string;
  DocumentNo: string;
  VehicleNo: string;
  Remark: string;
  GatePassTransactionID: string;
  LedgerID: string;
  Prefix: string;
  VoucherID: string;
};

type ItemRow = {
  _id: string;
  ItemName: string;
  Quantity: string;
  UnitSymbol: string;
  Description?: string;
  POTransactionID?: string;
  ItemID?: string;
  VoucherNo?: string;
  VoucherDate?: string;
  ItemCode?: string;
  _selected?: boolean;
};

type GPRow = {
  TransactionID: string;
  VoucherNo: string;
  VoucherDate: string;
  GatePassType: string;
  LedgerID: string;
  LedgerName: string;
  DocumentNo: string;
  SentThroughName: string;
  VehicleNo: string;
  SentThrough: string;
};

type POItem = {
  SNo: string;
  TransactionID: string;
  VoucherNo: string;
  VoucherDate: string;
  ItemID: string;
  Description: string;
  ItemCode: string;
  UnitSymbol: string;
  Quantity: string;
};

type SendThroughData = {
  Send: { MaterialSentThrough: string }[];
  UOM: { UnitID: string; UnitSymbol: string }[];
  Supplier: { LedgerID: string; LedgerName: string }[];
};

type FormState = {
  TransactionID: string;
  entryDirection: EntryDirection;
  gateEntryType: string;
  dcNo: string;
  voucherDate: string;
  voucherNo: string;
  goodsSendTo: string;
  ledgerId: string;
  selectedPoIds: string[];
  sendThrough: string;
  sendThroughName: string;
  documentNo: string;
  vehicleNo: string;
  remark: string;
  gatePassTransactionId: string;
  items: ItemRow[];
};

const blankForm = (): FormState => ({
  TransactionID: "",
  entryDirection: "Outward",
  gateEntryType: "",
  dcNo: "",
  voucherDate: new Date().toISOString().slice(0, 10),
  voucherNo: "",
  goodsSendTo: "",
  ledgerId: "",
  selectedPoIds: [],
  sendThrough: "",
  sendThroughName: "",
  documentNo: "",
  vehicleNo: "",
  remark: "",
  gatePassTransactionId: "",
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

// ─── Page ───────────────────────────────────────────────────────────────────
export default function GateEntryPage() {
  const [activeTab, setActiveTab]   = useState<EntryDirection>("Outward");
  const [list, setList]             = useState<ListRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [editMode, setEditMode]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState<FormState>(blankForm());
  const [sendThroughData, setSendThroughData] = useState<SendThroughData>({ Send: [], UOM: [], Supplier: [] });
  const [gpList, setGpList]         = useState<GPRow[]>([]);
  const [gpLoading, setGpLoading]   = useState(false);
  const [showGPModal, setShowGPModal] = useState(false);
  const [poList, setPoList]         = useState<{ LedgerID: string; LedgerName: string }[]>([]);
  const [poNos, setPoNos]           = useState<{ POTransactionID: string; VoucherNo: string }[]>([]);
  const [error, setError]           = useState("");

  // ─── Load list ────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await apiFetch<ListRow[]>(`${API}/getlist?type=${activeTab}`);
      setList(Array.isArray(data) ? data : []);
    } catch { setList([]); } finally { setListLoading(false); }
  }, [activeTab]);

  useEffect(() => { loadList(); }, [loadList]);

  // ─── Load send-through dropdown data ─────────────────────────────────────
  const loadSendThrough = async () => {
    try {
      const data = await apiFetch<SendThroughData>(`${API}/getsendthrough`);
      if (data) {
        setSendThroughData(data as SendThroughData);
        setPoList((data as SendThroughData).Supplier ?? []);
      }
    } catch {}
  };

  // ─── Fetch next voucher number ────────────────────────────────────────────
  const fetchVoucherNo = async (direction: EntryDirection) => {
    const prefix = direction === "Outward" ? "GE-OW" : "GE-IW";
    try {
      const no = await apiFetch<string>(`${API}/getvoucherno?prefix=${prefix}`);
      setForm(f => ({ ...f, voucherNo: no || "" }));
    } catch {}
  };

  // ─── Open add modal ───────────────────────────────────────────────────────
  const openAdd = async () => {
    const f = blankForm();
    f.entryDirection = activeTab;
    setForm(f);
    setEditMode(false);
    setError("");
    await loadSendThrough();
    await fetchVoucherNo(activeTab);
    setShowModal(true);
  };

  // ─── Open edit modal ──────────────────────────────────────────────────────
  const openEdit = async (row: ListRow) => {
    setError("");
    setEditMode(true);
    await loadSendThrough();

    const direction: EntryDirection = row.Prefix?.startsWith("GE-IW") ? "Inward" : "Outward";

    if (direction === "Inward")
    {
      try {
        const items = await apiFetch<ItemRow[]>(`${API}/getinwarddata/${row.TransactionID}`);
        const poTIDs = Array.isArray(items)
          ? [...new Set(items.filter(i => i.POTransactionID && i.POTransactionID !== "0").map(i => i.POTransactionID!))]
          : [];

        setForm({
          TransactionID: row.TransactionID,
          entryDirection: direction,
          gateEntryType: row.GateEntryType,
          dcNo: row.DCNo,
          voucherDate: parseDisplayDate(row.VoucherDate),
          voucherNo: row.VoucherNo,
          goodsSendTo: "",
          ledgerId: row.LedgerID,
          selectedPoIds: poTIDs,
          sendThrough: row.SendThrough,
          sendThroughName: row.SendThroughName,
          documentNo: row.DocumentNo ?? "",
          vehicleNo: row.VehicleNo ?? "",
          remark: row.Remark ?? "",
          gatePassTransactionId: row.GatePassTransactionID,
          items: Array.isArray(items) ? items.map((i, idx) => ({
            _id: String(idx),
            ItemName: String(i.Description ?? i.ItemName ?? ""),
            Quantity: String(i.Quantity ?? ""),
            UnitSymbol: String(i.UnitSymbol ?? ""),
            Description: String(i.Description ?? ""),
            POTransactionID: String(i.POTransactionID ?? ""),
            ItemID: String(i.ItemID ?? ""),
            VoucherNo: String(i.VoucherNo ?? ""),
            VoucherDate: String(i.VoucherDate ?? ""),
            ItemCode: String(i.ItemCode ?? ""),
            _selected: true,
          })) : [],
        });
      } catch (e: unknown) { setError(String(e)); }
    } else {
      setForm({
        TransactionID: row.TransactionID,
        entryDirection: direction,
        gateEntryType: row.GateEntryType,
        dcNo: row.DCNo,
        voucherDate: parseDisplayDate(row.VoucherDate),
        voucherNo: row.VoucherNo,
        goodsSendTo: row.MaterialSentTo,
        ledgerId: row.LedgerID,
        selectedPoIds: [],
        sendThrough: row.SendThrough,
        sendThroughName: row.SendThroughName,
        documentNo: row.DocumentNo ?? "",
        vehicleNo: row.VehicleNo ?? "",
        remark: row.Remark ?? "",
        gatePassTransactionId: row.GatePassTransactionID,
        items: [],
      });
    }
    setShowModal(true);
  };

  // ─── Entry direction toggle ────────────────────────────────────────────────
  const handleDirectionChange = async (dir: EntryDirection) => {
    setForm(f => ({ ...f, entryDirection: dir, gateEntryType: "", dcNo: "", items: [], gatePassTransactionId: "" }));
    if (!editMode) await fetchVoucherNo(dir);
  };

  // ─── Entry type change ────────────────────────────────────────────────────
  const handleEntryTypeChange = (type: string) => {
    setForm(f => ({ ...f, gateEntryType: type, dcNo: "", items: [], gatePassTransactionId: "" }));
    setPoNos([]);
  };

  // ─── GP picker ────────────────────────────────────────────────────────────
  const openGPPicker = async () => {
    if (!form.gateEntryType) { setError("Please select a Type first."); return; }
    setError("");
    setGpLoading(true);
    setShowGPModal(true);
    try {
      const data = await apiFetch<GPRow[]>(
        `${API}/getgatepass?type=${encodeURIComponent(form.gateEntryType)}&radioGroupValue=${form.entryDirection}`
      );
      setGpList(Array.isArray(data) ? data : []);
    } catch { setGpList([]); } finally { setGpLoading(false); }
  };

  const applyGP = async (gp: GPRow) => {
    setForm(f => ({
      ...f,
      dcNo: gp.VoucherNo,
      documentNo: gp.DocumentNo ?? f.documentNo,
      sendThroughName: gp.SentThroughName ?? "",
      sendThrough: gp.SentThrough ?? f.sendThrough,
      vehicleNo: gp.VehicleNo ?? f.vehicleNo,
      goodsSendTo: gp.LedgerName ?? f.goodsSendTo,
      ledgerId: gp.LedgerID ?? f.ledgerId,
      gatePassTransactionId: gp.TransactionID,
    }));

    // For Inward: auto-load items from the gate pass
    if (form.entryDirection === "Inward") {
      try {
        const items = await apiFetch<{ SNo: string; Description: string; Quantity: string; UnitSymbol: string }[]>(
          `${API}/getinwardforgrid?transactionId=${gp.TransactionID}&type=${encodeURIComponent(form.gateEntryType)}`
        );
        setForm(f => ({
          ...f,
          items: (Array.isArray(items) ? items : []).map((i, idx) => ({
            _id: String(idx),
            ItemName: String(i.Description ?? ""),
            Quantity: String(i.Quantity ?? ""),
            UnitSymbol: String(i.UnitSymbol ?? ""),
          })),
        }));
      } catch {}
    }
    setShowGPModal(false);
  };

  // ─── Supplier change → load PO numbers ───────────────────────────────────
  const handleSupplierChange = async (ledgerId: string) => {
    setForm(f => ({ ...f, ledgerId, selectedPoIds: [], items: [] }));
    setPoNos([]);
    if (!ledgerId) return;
    try {
      const data = await apiFetch<{ POTransactionID: string; VoucherNo: string }[]>(
        `${API}/getpono?ledgerId=${ledgerId}&type=${encodeURIComponent(form.gateEntryType)}`
      );
      setPoNos(Array.isArray(data) ? data : []);
    } catch { setPoNos([]); }
  };

  // ─── PO selection → load PO items ────────────────────────────────────────
  const handlePOSelect = async (poId: string, checked: boolean) => {
    const newIds = checked
      ? [...form.selectedPoIds, poId]
      : form.selectedPoIds.filter(id => id !== poId);
    setForm(f => ({ ...f, selectedPoIds: newIds }));
    if (newIds.length === 0) { setForm(f => ({ ...f, items: [] })); return; }

    try {
      const data = await apiFetch<POItem[]>(
        `${API}/getpoitemdetails?transactionId=${newIds.join(",")}&type=${encodeURIComponent(form.gateEntryType)}`
      );
      setForm(f => ({
        ...f,
        items: (Array.isArray(data) ? data : []).map((i, idx) => ({
          _id: String(idx),
          ItemName: String(i.Description ?? ""),
          Quantity: String(i.Quantity ?? ""),
          UnitSymbol: String(i.UnitSymbol ?? ""),
          Description: String(i.Description ?? ""),
          POTransactionID: String(i.TransactionID ?? ""),
          ItemID: String(i.ItemID ?? ""),
          VoucherNo: String(i.VoucherNo ?? ""),
          VoucherDate: String(i.VoucherDate ?? ""),
          ItemCode: String(i.ItemCode ?? ""),
          _selected: true,
        })),
      }));
    } catch {}
  };

  // ─── Manual item row helpers ──────────────────────────────────────────────
  const addItem = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, { _id: String(Date.now()), ItemName: "", Quantity: "", UnitSymbol: "" }],
    }));
  };

  const removeItem = (id: string) => setForm(f => ({ ...f, items: f.items.filter(i => i._id !== id) }));

  const updateItem = (id: string, field: keyof ItemRow, value: string) => {
    setForm(f => ({ ...f, items: f.items.map(i => i._id === id ? { ...i, [field]: value } : i) }));
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const save = async () => {
    const isInward = form.entryDirection === "Inward";
    if (!form.gateEntryType) { setError("Please select a Type."); return; }
    if (isInward && form.items.length === 0) { setError("Please add or select items."); return; }
    if (isInward && !form.sendThroughName?.trim()) { setError("Received by name is required."); return; }
    if (!form.documentNo?.trim()) { setError("Document No. is required."); return; }

    setSaving(true); setError("");
    try {
      const selectedItems = isInward
        ? form.items.filter(i => i._selected !== false)
        : [];

      const payload = {
        EditMode: editMode,
        TransactionID: form.TransactionID || 0,
        EntryType: form.entryDirection,
        GatePassEntryType: form.gateEntryType,
        LedgerID: form.ledgerId || null,
        GatePassTransactionID: form.gatePassTransactionId || null,
        MaterialSentTo: form.goodsSendTo,
        MaterialSentThrough: form.sendThrough,
        MaterialSentThroughName: form.sendThroughName,
        DocumentNo: form.documentNo,
        VehicleNo: form.vehicleNo,
        Remark: form.remark,
        VoucherDate: form.voucherDate,
        VoucherNo: form.voucherNo,
        Prefix: form.entryDirection === "Outward" ? "GE-OW" : "GE-IW",
        VoucherID: form.entryDirection === "Outward" ? "-128" : "-129",
        Items: (isInward ? (form.selectedPoIds.length > 0 ? selectedItems : form.items) : []).map(i => ({
          ItemName: i.ItemName || i.Description || "",
          Quantity: parseFloat(i.Quantity) || 0,
          UnitSymbol: i.UnitSymbol || "",
          POTransactionID: i.POTransactionID || null,
          ItemID: i.ItemID || null,
        })),
      };
      const res = await fetch(`${API}/savegateentry`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = unwrap(await res.json());
      if (result === "Success") { setShowModal(false); loadList(); }
      else setError(typeof result === "string" ? (result || "Save failed") : JSON.stringify(result) || "Save failed");
    } catch (e: unknown) { setError(String(e)); } finally { setSaving(false); }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const deleteRow = async (row: ListRow) => {
    if (!confirm(`Delete gate entry ${row.VoucherNo}?`)) return;
    const dir = row.Prefix?.startsWith("GE-IW") ? "Inward" : "Outward";
    try {
      const result = unwrap(await (await fetch(
        `${API}/deletegateentry/${row.TransactionID}?gateEntryType=${dir}`,
        { headers: authHeaders() }
      )).json());
      if (result === "Exist") alert("This entry is used in another process and cannot be deleted.");
      else if (result === "Success") loadList();
      else alert(String(result || "Delete failed"));
    } catch (e: unknown) { alert(String(e)); }
  };

  const entryTypes = form.entryDirection === "Outward" ? ENTRY_TYPES_OUTWARD : ENTRY_TYPES_INWARD;
  const showGPPicker = GP_PICKER_TYPES.has(form.gateEntryType);
  const showPO = form.entryDirection === "Inward" && PO_TYPES.has(form.gateEntryType);
  const showManualItems = form.entryDirection === "Inward" && !showPO && !showGPPicker;

  const columns: Column<ListRow>[] = [
    { key: "VoucherNo",     header: "Gate Entry No.", sortable: true },
    { key: "VoucherDate",   header: "Date",           sortable: true },
    { key: "GateEntryType", header: "Type",           sortable: true },
    { key: "DCNo",          header: "GP No.",         sortable: true },
    { key: "MaterialSentTo",header: activeTab === "Inward" ? "Received From" : "Goods Send To", sortable: true },
    { key: "SendThrough",   header: activeTab === "Inward" ? "Received Via"  : "Send Through",  sortable: true },
    { key: "VehicleNo",     header: "Vehicle No.",    sortable: true },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gate Entry</h2>
          <p className="text-sm text-gray-500">{listLoading ? "Loading..." : `${list.length} record${list.length !== 1 ? "s" : ""}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <TutorialButton title="Gate Entry — Tutorial" />
          <Button icon={<Plus size={16} />} onClick={openAdd}>New Gate Entry</Button>
        </div>
      </div>

      {/* Outward / Inward tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["Outward", "Inward"] as EntryDirection[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
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
          searchKeys={["VoucherNo", "GateEntryType", "MaterialSentTo"]}
          actions={row => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteRow(row)}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[93vh] overflow-y-auto mx-4">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-gray-800">
                {editMode ? "Edit Gate Entry" : "New Gate Entry"}
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

            <div className="p-6 space-y-5">
              {error && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

              {/* Outward / Inward selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Entry Type</label>
                <div className="flex gap-3">
                  {(["Outward", "Inward"] as EntryDirection[]).map(dir => (
                    <label key={dir} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                      form.entryDirection === dir
                        ? "bg-blue-50 border-blue-500 text-blue-700"
                        : "border-gray-300 text-gray-700 hover:border-gray-400"
                    } ${editMode ? "opacity-60 cursor-not-allowed" : ""}`}>
                      <input type="radio" name="entryDirection" value={dir} checked={form.entryDirection === dir}
                        disabled={editMode} onChange={() => handleDirectionChange(dir)} className="hidden" />
                      {dir} Gate Entry
                    </label>
                  ))}
                </div>
              </div>

              {/* Gate Entry No + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Gate Entry No.</label>
                  <input value={form.voucherNo} readOnly className={isCls + " bg-gray-50"} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                  <input type="date" value={form.voucherDate}
                    onChange={e => setForm(f => ({ ...f, voucherDate: e.target.value }))} className={isCls} />
                </div>
              </div>

              {/* Type + GP No */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Type</label>
                  <select value={form.gateEntryType} onChange={e => handleEntryTypeChange(e.target.value)}
                    disabled={editMode} className={isCls}>
                    <option value="">-- Select Type --</option>
                    {entryTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    {form.gateEntryType === "Finish Goods Delivery" ? "DC No." : "Gate Pass No."}
                  </label>
                  <div className="flex gap-2">
                    <input value={form.dcNo} readOnly className={isCls + " bg-gray-50 flex-1"} />
                    {showGPPicker && (
                      <button onClick={openGPPicker}
                        className="px-3 py-2 border border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 text-sm flex items-center gap-1">
                        <Search size={14} /> Select
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Goods Send To / Supplier */}
              <div className="grid grid-cols-2 gap-4">
                {form.entryDirection === "Outward" ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Goods Send To</label>
                    <input value={form.goodsSendTo} onChange={e => setForm(f => ({ ...f, goodsSendTo: e.target.value }))}
                      placeholder="Party / destination name" className={isCls} />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Supplier Name</label>
                    <select value={form.ledgerId} onChange={e => handleSupplierChange(e.target.value)} className={isCls}>
                      <option value="">-- Select Supplier --</option>
                      {sendThroughData.Supplier.map((s, i) => (
                        <option key={s.LedgerID ?? i} value={s.LedgerID}>{s.LedgerName}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Send Through */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    {form.entryDirection === "Inward" ? "Received Via" : "Send Via"}
                  </label>
                  <select value={form.sendThrough} onChange={e => setForm(f => ({ ...f, sendThrough: e.target.value }))} className={isCls}>
                    <option value="">-- Select --</option>
                    {sendThroughData.Send.map((s, i) => <option key={i} value={s.MaterialSentThrough}>{s.MaterialSentThrough}</option>)}
                  </select>
                </div>
              </div>

              {/* PO Selection (Inward + PO types) */}
              {showPO && poNos.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">PO No. (Select multiple)</label>
                  <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
                    {poNos.map((p, i) => (
                      <label key={p.POTransactionID ?? i} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="checkbox"
                          checked={form.selectedPoIds.includes(p.POTransactionID)}
                          onChange={e => handlePOSelect(p.POTransactionID, e.target.checked)}
                          className="rounded border-gray-300" />
                        {p.VoucherNo}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Send Through Name + Document No */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    {form.entryDirection === "Inward" ? "Received by" : "Send by"}
                  </label>
                  <input value={form.sendThroughName} onChange={e => setForm(f => ({ ...f, sendThroughName: e.target.value }))}
                    placeholder={form.entryDirection === "Inward" ? "Received by name" : "Driver / courier name"} className={isCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Document No.</label>
                  <input value={form.documentNo} onChange={e => setForm(f => ({ ...f, documentNo: e.target.value }))}
                    placeholder="Document No." className={isCls} />
                </div>
              </div>

              {/* Vehicle No + Remark */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">LR / Vehicle No.</label>
                  <input value={form.vehicleNo} onChange={e => setForm(f => ({ ...f, vehicleNo: e.target.value }))}
                    placeholder="LR / Vehicle No." className={isCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Remark</label>
                  <input value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
                    placeholder="Remark" className={isCls} />
                </div>
              </div>

              {/* Item Grid (for Inward with PO or manual) */}
              {form.entryDirection === "Inward" && form.items.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Items {showPO ? "(from selected POs — check to include)" : ""}
                    </label>
                    {!showPO && (
                      <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={addItem}>Add Row</Button>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {showPO && <th className="px-3 py-2 w-10"></th>}
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">S.No</th>
                          {showPO && <>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">PO No.</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Item Code</th>
                          </>}
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Qty</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">UOM</th>
                          {!showPO && <th className="px-3 py-2 w-10"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((item, idx) => (
                          <tr key={item._id} className="border-t border-gray-100 hover:bg-gray-50">
                            {showPO && (
                              <td className="px-3 py-2">
                                <input type="checkbox" checked={item._selected !== false}
                                  onChange={e => updateItem(item._id, "_selected" as keyof ItemRow, e.target.checked ? "true" : "")}
                                  className="rounded border-gray-300" />
                              </td>
                            )}
                            <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                            {showPO && <>
                              <td className="px-3 py-2 text-gray-600">{item.VoucherNo}</td>
                              <td className="px-3 py-2 text-gray-600">{item.ItemCode}</td>
                            </>}
                            <td className="px-3 py-2">
                              {showPO ? (
                                <span>{item.ItemName || item.Description}</span>
                              ) : (
                                <input value={item.ItemName} onChange={e => updateItem(item._id, "ItemName", e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {showPO ? (
                                <span>{item.Quantity}</span>
                              ) : (
                                <input value={item.Quantity} type="number"
                                  onChange={e => updateItem(item._id, "Quantity", e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm" />
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {showPO ? (
                                <span>{item.UnitSymbol}</span>
                              ) : (
                                <select value={item.UnitSymbol} onChange={e => updateItem(item._id, "UnitSymbol", e.target.value)}
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm">
                                  <option value="">—</option>
                                  {sendThroughData.UOM.map(u => <option key={u.UnitID} value={u.UnitSymbol}>{u.UnitSymbol}</option>)}
                                </select>
                              )}
                            </td>
                            {!showPO && (
                              <td className="px-3 py-2">
                                <button onClick={() => removeItem(item._id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                  <X size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Manual item add for Inward non-PO, non-GP types */}
              {showManualItems && form.items.length === 0 && (
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={addItem}>Add Item Row</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gate Pass Picker Modal */}
      {showGPModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden mx-4 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">Select Gate Pass — {form.gateEntryType}</h3>
              <button onClick={() => setShowGPModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {gpLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">GP No.</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Ledger Name</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Document No.</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Vehicle No.</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gpList.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-6 text-gray-400">No gate passes found</td></tr>
                    ) : gpList.map((gp, i) => (
                      <tr key={gp.TransactionID ?? i} className="border-t border-gray-100 hover:bg-blue-50">
                        <td className="px-3 py-2 font-medium text-blue-700">{gp.VoucherNo}</td>
                        <td className="px-3 py-2">{gp.VoucherDate}</td>
                        <td className="px-3 py-2">{gp.LedgerName}</td>
                        <td className="px-3 py-2">{gp.DocumentNo || "—"}</td>
                        <td className="px-3 py-2">{gp.VehicleNo || "—"}</td>
                        <td className="px-3 py-2">
                          <Button variant="secondary" size="sm" onClick={() => applyGP(gp)}>Apply</Button>
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
