"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";
import {
  extrusionEnquiries as initData, customers,
  ExtrusionEnquiry,
} from "@/data/dummyData";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

// ─── Constants ───────────────────────────────────────────────
const ENQ_STATUS_CLS: Record<string, string> = {
  Pending:   "bg-amber-50  text-amber-700  border-amber-200",
  Estimated: "bg-blue-50   text-blue-700   border-blue-200",
  Converted: "bg-green-50  text-green-700  border-green-200",
  Rejected:  "bg-red-50    text-red-700    border-red-200",
};

const APPLICATIONS = [
  "Food Packaging", "Beverage Packaging", "Pharmaceutical",
  "Industrial", "Agriculture", "Retail / FMCG", "Other",
];

const FILM_TYPES = [
  "LLDPE Shrink Film", "LDPE Film", "HDPE Film", "BOPP Film",
  "CPP Film", "Barrier Film (EVOH)", "PE Lamination Film",
  "POF Shrink Film", "Stretch Film", "Other",
];

// ─── Page ────────────────────────────────────────────────────
export default function ExtrusionEnquiryPage() {
  const [data,      setData]      = useState<ExtrusionEnquiry[]>(initData);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow,   setViewRow]   = useState<ExtrusionEnquiry | null>(null);
  const [editing,   setEditing]   = useState<ExtrusionEnquiry | null>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);

  // ── Form fields ──────────────────────────────────────────────
  const [fCustomerId,   setFCustomerId]   = useState("");
  const [fCustomerName, setFCustomerName] = useState("");
  const [fFilmType,     setFFilmType]     = useState("LLDPE Shrink Film");
  const [fProductName,  setFProductName]  = useState("");
  const [fApplication,  setFApplication]  = useState("Food Packaging");
  const [fRollWidth,    setFRollWidth]    = useState<number | "">("");
  const [fThickness,    setFThickness]    = useState<number | "">("");
  const [fOrderQty,     setFOrderQty]     = useState<number | "">("");
  const [fUnit,         setFUnit]         = useState("Kg");
  const [fDeliveryDate, setFDeliveryDate] = useState("");
  const [fPrinting,     setFPrinting]     = useState(false);
  const [fPrintColors,  setFPrintColors]  = useState<number | "">("");
  const [fRemarks,      setFRemarks]      = useState("");
  const [fStatus,       setFStatus]       = useState<ExtrusionEnquiry["status"]>("Pending");

  const resetForm = () => {
    setFCustomerId(""); setFCustomerName(""); setFFilmType("LLDPE Shrink Film");
    setFProductName(""); setFApplication("Food Packaging");
    setFRollWidth(""); setFThickness(""); setFOrderQty(""); setFUnit("Kg");
    setFDeliveryDate(""); setFPrinting(false); setFPrintColors("");
    setFRemarks(""); setFStatus("Pending");
  };

  const openAdd = () => { setEditing(null); resetForm(); setModalOpen(true); };

  const openEdit = (row: ExtrusionEnquiry) => {
    setEditing(row);
    setFCustomerId(row.customerId);   setFCustomerName(row.customerName);
    setFFilmType(row.productName);    setFProductName(row.productName);
    setFApplication(row.application); setFRollWidth(row.rollWidth || "");
    setFThickness(row.totalMicron || ""); setFOrderQty(row.orderQty || "");
    setFUnit(row.unit); setFDeliveryDate(row.deliveryDate);
    setFPrinting(false); setFPrintColors("");
    setFRemarks(row.remarks); setFStatus(row.status);
    setModalOpen(true);
  };

  const save = () => {
    if (!fCustomerId || !fProductName) return;

    const blank: ExtrusionEnquiry = {
      id: "", enquiryNo: "",
      date: new Date().toISOString().slice(0, 10),
      customerId: fCustomerId, customerName: fCustomerName,
      productName: fProductName, application: fApplication,
      recipeId: "", recipeName: "",
      rollMasterId: "", rollName: "", rollWidth: Number(fRollWidth) || 0,
      totalMicron: Number(fThickness) || 0,
      layerMicrons: [], layerResults: [], totalGSM: 0,
      machineCostPerSqM: 0, overheadCostPerSqM: 0,
      totalCostPerSqM: 0, totalCostPerKg: 0,
      sellingPricePerKg: 0, marginPct: 0,
      orderQty: Number(fOrderQty) || 0, unit: fUnit,
      deliveryDate: fDeliveryDate,
      requiredMaterials: [],
      remarks: fRemarks, status: fStatus,
    };

    if (editing) {
      setData(d => d.map(r => r.id === editing.id ? { ...blank, id: editing.id, enquiryNo: editing.enquiryNo } : r));
    } else {
      const enquiryNo = generateCode(UNIT_CODE.Extrusion, MODULE_CODE.Enquiry, data.map(d => d.enquiryNo));
      const id = `EXEQ${String(data.length + 1).padStart(3, "0")}`;
      setData(d => [...d, { ...blank, id, enquiryNo }]);
    }
    setModalOpen(false);
  };

  // ── Table columns ─────────────────────────────────────────────
  const columns: Column<ExtrusionEnquiry>[] = [
    { key: "enquiryNo",    header: "Enquiry No",   sortable: true },
    { key: "date",         header: "Date",          sortable: true },
    { key: "customerName", header: "Customer",      sortable: true },
    { key: "productName",  header: "Film / Roll",   sortable: true },
    { key: "application",  header: "Application"    },
    { key: "rollWidth",    header: "Width (mm)",    render: r => <span>{r.rollWidth ? `${r.rollWidth} mm` : "—"}</span> },
    { key: "totalMicron",  header: "Thickness (μ)", render: r => <span>{r.totalMicron ? `${r.totalMicron} μ` : "—"}</span> },
    { key: "orderQty",     header: "Qty",           render: r => <span className="font-semibold">{r.orderQty ? `${r.orderQty.toLocaleString()} ${r.unit}` : "—"}</span> },
    { key: "deliveryDate", header: "Delivery",      render: r => <span>{r.deliveryDate || "—"}</span> },
    { key: "status",       header: "Status",        render: r => (
      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${ENQ_STATUS_CLS[r.status]}`}>{r.status}</span>
    )},
  ];

  const stats = [
    { label: "Total",     val: data.length,                                       cls: "bg-blue-50   border-blue-200   text-blue-700"   },
    { label: "Pending",   val: data.filter(d => d.status === "Pending").length,   cls: "bg-amber-50  border-amber-200  text-amber-700"  },
    { label: "Estimated", val: data.filter(d => d.status === "Estimated").length, cls: "bg-purple-50 border-purple-200 text-purple-700" },
    { label: "Converted", val: data.filter(d => d.status === "Converted").length, cls: "bg-green-50  border-green-200  text-green-700"  },
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Extrusion Enquiry</h2>
          <p className="text-sm text-gray-500">Capture customer film requirements · Roll width · Quantity · Delivery</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Enquiry</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={data}
          columns={columns}
          searchKeys={["enquiryNo", "customerName", "productName"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />}    onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleteId(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* ─── Create / Edit Modal ─────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Enquiry — ${editing.enquiryNo}` : "New Extrusion Enquiry"}
        size="lg"
      >
        <div className="space-y-4">

          {/* Customer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Customer *"
              value={fCustomerId}
              onChange={e => {
                const c = customers.find(x => x.id === e.target.value);
                setFCustomerId(e.target.value);
                if (c) setFCustomerName(c.name);
              }}
              options={customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))}
            />
            <Select
              label="Application"
              value={fApplication}
              onChange={e => setFApplication(e.target.value)}
              options={APPLICATIONS.map(a => ({ value: a, label: a }))}
            />
          </div>

          {/* Film / Roll details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Film Type *"
              value={fFilmType}
              onChange={e => { setFFilmType(e.target.value); setFProductName(e.target.value); }}
              options={FILM_TYPES.map(f => ({ value: f, label: f }))}
            />
            <Input
              label="Product / Job Name"
              placeholder="e.g. Parle Shrink Wrap 40μ"
              value={fProductName}
              onChange={e => setFProductName(e.target.value)}
            />
          </div>

          {/* Roll specs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input
              label="Roll Width (mm)"
              type="number"
              placeholder="e.g. 400"
              value={fRollWidth}
              onChange={e => setFRollWidth(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <Input
              label="Thickness (μ)"
              type="number"
              placeholder="e.g. 40"
              value={fThickness}
              onChange={e => setFThickness(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Printing Required</label>
              <div className="flex gap-3 mt-2">
                {[true, false].map(v => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => { setFPrinting(v); if (!v) setFPrintColors(""); }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                      ${fPrinting === v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}
                  >
                    {v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
            {fPrinting && (
              <Input
                label="No. of Colors"
                type="number"
                min={1} max={12}
                placeholder="e.g. 6"
                value={fPrintColors}
                onChange={e => setFPrintColors(e.target.value === "" ? "" : Number(e.target.value))}
              />
            )}
          </div>

          {/* Quantity & Delivery */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              label="Order Qty *"
              type="number"
              placeholder="e.g. 5000"
              value={fOrderQty}
              onChange={e => setFOrderQty(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <Select
              label="Unit"
              value={fUnit}
              onChange={e => setFUnit(e.target.value)}
              options={[{ value: "Kg", label: "Kg" }, { value: "Meter", label: "Meter" }, { value: "Nos", label: "Nos" }]}
            />
            <Input
              label="Delivery Date"
              type="date"
              value={fDeliveryDate}
              onChange={e => setFDeliveryDate(e.target.value)}
            />
            <Select
              label="Status"
              value={fStatus}
              onChange={e => setFStatus(e.target.value as ExtrusionEnquiry["status"])}
              options={[
                { value: "Pending",   label: "Pending"   },
                { value: "Estimated", label: "Estimated" },
                { value: "Converted", label: "Converted" },
                { value: "Rejected",  label: "Rejected"  },
              ]}
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Remarks</label>
            <textarea
              rows={2}
              placeholder="Special instructions, quality requirements, notes…"
              value={fRemarks}
              onChange={e => setFRemarks(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

        </div>

        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button
            icon={<Plus size={14} />}
            onClick={save}
            disabled={!fCustomerId || !fProductName}
          >
            {editing ? "Update Enquiry" : "Save Enquiry"}
          </Button>
        </div>
      </Modal>

      {/* ─── View Modal ───────────────────────────────────────── */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Enquiry — ${viewRow.enquiryNo}`} size="md">
          <div className="space-y-4 text-sm">

            <div className="grid grid-cols-2 gap-3">
              {([
                ["Customer",    viewRow.customerName],
                ["Application", viewRow.application],
                ["Film / Roll", viewRow.productName],
                ["Date",        viewRow.date],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-gray-400 font-medium">{k}</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{v}</p>
                </div>
              ))}
            </div>

            {/* Key specs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <p className="text-[10px] text-blue-600 font-semibold uppercase">Roll Width</p>
                <p className="text-xl font-bold text-blue-800 mt-0.5">{viewRow.rollWidth ? `${viewRow.rollWidth} mm` : "—"}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                <p className="text-[10px] text-purple-600 font-semibold uppercase">Thickness</p>
                <p className="text-xl font-bold text-purple-800 mt-0.5">{viewRow.totalMicron ? `${viewRow.totalMicron} μ` : "—"}</p>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
                <p className="text-[10px] text-teal-600 font-semibold uppercase">Order Qty</p>
                <p className="text-xl font-bold text-teal-800 mt-0.5">{viewRow.orderQty ? `${viewRow.orderQty.toLocaleString()} ${viewRow.unit}` : "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 font-medium">Delivery Date</p>
                <p className="font-semibold text-gray-800 mt-0.5">{viewRow.deliveryDate || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Status</p>
                <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${ENQ_STATUS_CLS[viewRow.status]}`}>{viewRow.status}</span>
              </div>
            </div>

            {viewRow.remarks && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
                <span className="font-semibold">Remarks: </span>{viewRow.remarks}
              </div>
            )}

          </div>
          <div className="flex justify-between mt-5 pt-4 border-t border-gray-100">
            <Button variant="secondary" icon={<Pencil size={13} />} onClick={() => { setViewRow(null); openEdit(viewRow); }}>Edit</Button>
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {/* ─── Delete confirm ──────────────────────────────────── */}
      {deleteId && (
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Enquiry" size="sm">
          <p className="text-sm text-gray-600">Are you sure you want to delete this enquiry?</p>
          <div className="flex justify-end gap-3 mt-5">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button onClick={() => { setData(d => d.filter(r => r.id !== deleteId)); setDeleteId(null); }}>Delete</Button>
          </div>
        </Modal>
      )}

    </div>
  );
}
