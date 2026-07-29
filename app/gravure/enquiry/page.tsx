"use client";
import { RowAction, RowActions } from "@/components/ui/RowAction";
import { useState, useEffect, useCallback } from "react";
import { Plus, Eye, Pencil, Trash2, ArrowRight, Layers, RefreshCw } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import TutorialButton from "@/components/ui/TutorialButton";
import { useToast } from "@/components/ui/Toast";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { usePermissions } from "@/context/PermissionsContext";

const API = "api/gravureEnquiryShrink";
const CUST_API = "api/gravureestimationShrink/getcustomerlist";

const SUBSTRATES = ["BOPP 20μ", "BOPP 15μ", "PET 12μ", "PET 15μ", "CPP 30μ", "CPP 40μ", "PVC 50μ", "OPS 40μ", "Met PET 12μ", "LDPE 40μ"];
const FINISHES   = ["None", "Gloss OPV", "Matte OPV", "Heat Seal Coating", "Gloss Lamination", "Matte Lamination"];
const STRUCTURES = ["BOPP+CPP", "BOPP+PE", "PET+PE", "PET+Dry Lam+CPP", "PET+Dry Lam+PE", "BOPP+Met PET+CPP", "PVC Shrink", "BOPP+Al Foil+PE", "PET+Al Foil+CPP"];

type GravureEnquiry = {
  id: string;
  enquiryNo: string;
  date: string;
  customerId: string;
  customerName: string;
  jobName: string;
  substrate: string;
  width: number;
  repeatLength: number;
  noOfColors: number;
  printType: string;
  structureType: string;
  quantity: number;
  unit: string;
  cylinderStatus: string;
  designRef: string;
  specialFinish: string;
  remarks: string;
  status: string;
};

type ApiCustomer = { LedgerID: number; CustomerName: string };

const blank: Omit<GravureEnquiry, "id" | "enquiryNo"> = {
  date: new Date().toISOString().slice(0, 10),
  customerId: "", customerName: "",
  jobName: "",
  substrate: "BOPP 20μ",
  width: 0, repeatLength: 0, noOfColors: 6,
  printType: "Surface Print",
  structureType: "BOPP+CPP",
  quantity: 0, unit: "Meter",
  cylinderStatus: "New",
  designRef: "", specialFinish: "None",
  remarks: "", status: "Pending",
};

const statusColor: Record<string, string> = {
  Pending:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  Estimated: "bg-purple-50 text-purple-700 border-purple-200",
  Converted: "bg-green-50 text-green-700 border-green-200",
  Rejected:  "bg-red-50 text-red-600 border-red-200",
};

const MOD = "/enquiry";

export default function GravureEnquiryPage() {
  const { can } = usePermissions();
  const { showToast } = useToast();

  const [data, setData]           = useState<GravureEnquiry[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [modalOpen, setModal]     = useState(false);
  const [viewRow, setViewRow]     = useState<GravureEnquiry | null>(null);
  const [editing, setEditing]     = useState<GravureEnquiry | null>(null);
  const [form, setForm]           = useState<Omit<GravureEnquiry, "id" | "enquiryNo">>(blank);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const mapRow = (r: any): GravureEnquiry => ({
    id:             String(r.EnquiryID ?? ""),
    enquiryNo:      String(r.EnquiryNo ?? ""),
    date:           String(r.EnquiryDate ?? "").slice(0, 10),
    customerId:     String(r.LedgerID ?? ""),
    customerName:   String(r.CustomerName ?? ""),
    jobName:        String(r.JobName ?? ""),
    substrate:      String(r.GrvSubstrate ?? ""),
    width:          Number(r.GrvWidth ?? 0),
    repeatLength:   Number(r.GrvRepeatLength ?? 0),
    noOfColors:     Number(r.GrvNoOfColors ?? 0),
    printType:      String(r.GrvPrintType ?? "Surface Print"),
    structureType:  String(r.GrvStructureType ?? ""),
    quantity:       Number(r.Quantity ?? 0),
    unit:           String(r.EstimationUnit ?? "Meter"),
    cylinderStatus: String(r.GrvCylinderStatus ?? "New"),
    designRef:      String(r.DesignRef ?? ""),
    specialFinish:  String(r.GrvSpecialFinish ?? "None"),
    remarks:        String(r.Remark ?? ""),
    status:         String(r.Status ?? "Pending"),
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, custs] = await Promise.all([
        apiGet<any[]>(`${API}/getenquirylist`),
        apiGet<ApiCustomer[]>(CUST_API),
      ]);
      if (Array.isArray(rows)) setData(rows.map(mapRow));
      if (Array.isArray(custs)) setCustomers(custs);
    } catch (err: any) {
      showToast("error", "Load Failed", err?.message ?? "Could not load enquiries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setEditing(null);
    setForm(blank);
    setModal(true);
  };

  const openEdit = (row: GravureEnquiry) => {
    setEditing(row);
    setForm({
      date: row.date, customerId: row.customerId, customerName: row.customerName,
      jobName: row.jobName, substrate: row.substrate, width: row.width,
      repeatLength: row.repeatLength, noOfColors: row.noOfColors,
      printType: row.printType, structureType: row.structureType,
      quantity: row.quantity, unit: row.unit, cylinderStatus: row.cylinderStatus,
      designRef: row.designRef, specialFinish: row.specialFinish,
      remarks: row.remarks, status: row.status,
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.customerId || !form.jobName.trim() || !form.quantity) {
      showToast("error", "Validation Error", "Customer, Job Name, and Quantity are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        Date:             form.date,
        CustomerID:       form.customerId,
        JobName:          form.jobName,
        Quantity:         String(form.quantity),
        Unit:             form.unit,
        Remarks:          form.remarks,
        Status:           form.status,
        GrvSubstrate:     form.substrate,
        GrvCylinderStatus: form.cylinderStatus,
        GrvSpecialFinish: form.specialFinish,
        GrvNoOfColors:    form.noOfColors,
        GrvWidth:         form.width,
        GrvRepeatLength:  form.repeatLength,
        GrvStructureType: form.structureType,
        GrvPrintType:     form.printType,
        DesignRef:        form.designRef,
        ...(editing && { EnquiryID: editing.id }),
      };

      const endpoint = editing ? `${API}/updateenquiry` : `${API}/saveenquiry`;
      const res: any = await apiPost(endpoint, payload);
      if (res?.Status === "success" || res?.status === "success") {
        showToast("success", editing ? "Enquiry Updated" : "Enquiry Saved",
          `${editing ? editing.enquiryNo : res.EnquiryNo} saved successfully.`);
        setModal(false);
        fetchData();
      } else {
        showToast("error", "Save Failed", res?.Message ?? res?.message ?? "Unknown error");
      }
    } catch (err: any) {
      showToast("error", "Save Error", err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res: any = await apiGet(`${API}/deleteenquiry/${deleteId}`);
      if (res?.Status === "success" || res?.status === "success") {
        showToast("success", "Deleted", "Enquiry deleted successfully.");
        setDeleteId(null);
        fetchData();
      } else {
        showToast("error", "Delete Failed", res?.Message ?? "Could not delete.");
      }
    } catch (err: any) {
      showToast("error", "Delete Error", err?.message ?? String(err));
    } finally {
      setDeleting(false);
    }
  };

  const stats = {
    total:     data.length,
    pending:   data.filter(e => e.status === "Pending").length,
    estimated: data.filter(e => e.status === "Estimated").length,
    converted: data.filter(e => e.status === "Converted").length,
  };

  const columns: Column<GravureEnquiry>[] = [
    { key: "enquiryNo",   header: "Enquiry No",  sortable: true },
    { key: "date",        header: "Date",         sortable: true },
    { key: "customerName",header: "Customer",     sortable: true },
    { key: "jobName",     header: "Job Name" },
    { key: "substrate",   header: "Substrate",
      render: r => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{r.substrate || "—"}</span> },
    { key: "noOfColors",  header: "Colors",
      render: r => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{r.noOfColors}C</span> },
    { key: "quantity",    header: "Qty",
      render: r => <span>{Number(r.quantity).toLocaleString()} {r.unit}</span> },
    { key: "cylinderStatus", header: "Cylinders",
      render: r => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          r.cylinderStatus === "New" ? "bg-orange-50 text-orange-700" :
          r.cylinderStatus === "Existing" ? "bg-green-50 text-green-700" :
          "bg-gray-100 text-gray-600"}`}>
          {r.cylinderStatus}
        </span>
      )},
    { key: "status", header: "Status", render: r => statusBadge(r.status), sortable: true },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Layers size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Gravure Enquiry</h2>
          </div>
          <p className="text-sm text-gray-500">
            {stats.total} total · {stats.pending} pending · {stats.converted} converted
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TutorialButton title="Gravure Enquiry — Tutorial" />
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />} onClick={fetchData}>
            Refresh
          </Button>
          {can(MOD, "CanSave") && <Button variant="secondary" pill icon={<Plus size={16} />} onClick={openAdd}>New Enquiry</Button>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total",     val: stats.total,     cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Pending",   val: stats.pending,   cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { label: "Estimated", val: stats.estimated, cls: "bg-purple-50 text-purple-700 border-purple-200" },
          { label: "Converted", val: stats.converted, cls: "bg-green-50 text-green-700 border-green-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading enquiries...</div>
        ) : (
          <DataTable
            data={data}
            columns={columns}
            searchKeys={["enquiryNo", "customerName", "jobName", "substrate"]}
            actions={row => (
              <div className="flex items-center gap-1.5 justify-end">
                <RowAction.View onClick={() => setViewRow(row)} />
                {can(MOD, "CanEdit") && <RowAction.Edit onClick={() => openEdit(row)} />}
                {can(MOD, "CanDelete") && <RowAction.Delete onClick={() => setDeleteId(row.id)} />}
              </div>
            )}
          />
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModal(false)} title={editing ? "Edit Enquiry" : "New Gravure Enquiry"} size="xl">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Enquiry No</p>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-blue-700 text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-1">
                {editing ? editing.enquiryNo : "Auto-generated on save"}
              </span>
              {!editing && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full uppercase">AUTO</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />

          <Select
            label="Customer *"
            value={form.customerId}
            onChange={e => {
              const c = customers.find(x => String(x.LedgerID) === e.target.value);
              f("customerId", e.target.value);
              if (c) f("customerName", c.CustomerName);
            }}
            options={customers.map(c => ({ value: String(c.LedgerID), label: c.CustomerName }))}
          />

          <Input label="Job Name *" value={form.jobName} onChange={e => f("jobName", e.target.value)} placeholder="e.g. Parle-G Biscuit 100g Wrap" />
          <Input label="Design Reference" value={form.designRef} onChange={e => f("designRef", e.target.value)} placeholder="e.g. PARLE-ART-2024-01" />

          <Select label="Substrate *" value={form.substrate} onChange={e => f("substrate", e.target.value)}
            options={SUBSTRATES.map(s => ({ value: s, label: s }))} />
          <Select label="Lamination Structure" value={form.structureType} onChange={e => f("structureType", e.target.value)}
            options={STRUCTURES.map(s => ({ value: s, label: s }))} />

          <Input label="Print Width (mm)" type="number" value={form.width} onChange={e => f("width", Number(e.target.value))} />
          <Input label="Repeat / Cylinder Length (mm)" type="number" value={form.repeatLength} onChange={e => f("repeatLength", Number(e.target.value))} />

          <Input label="No. of Colors" type="number" value={form.noOfColors} onChange={e => f("noOfColors", Number(e.target.value))} min={1} max={12} />
          <Select label="Print Type" value={form.printType} onChange={e => f("printType", e.target.value)}
            options={[
              { value: "Surface Print", label: "Surface Print" },
              { value: "Reverse Print", label: "Reverse Print" },
              { value: "Combination",   label: "Combination" },
            ]} />

          <Input label="Quantity *" type="number" value={form.quantity} onChange={e => f("quantity", Number(e.target.value))} />
          <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)}
            options={[
              { value: "Meter", label: "Meter" },
              { value: "Pcs",   label: "Pcs" },
              { value: "Kg",    label: "Kg" },
            ]} />

          <Select label="Cylinder Status" value={form.cylinderStatus} onChange={e => f("cylinderStatus", e.target.value)}
            options={[
              { value: "New",              label: "New (To be made)" },
              { value: "Existing",         label: "Existing (Available)" },
              { value: "To Be Confirmed",  label: "To Be Confirmed" },
            ]} />
          <Select label="Special Finish" value={form.specialFinish} onChange={e => f("specialFinish", e.target.value)}
            options={FINISHES.map(f => ({ value: f, label: f }))} />

          <Select label="Status" value={form.status} onChange={e => f("status", e.target.value)}
            options={[
              { value: "Pending",   label: "Pending" },
              { value: "Estimated", label: "Estimated" },
              { value: "Converted", label: "Converted to Order" },
              { value: "Rejected",  label: "Rejected" },
            ]} />
        </div>

        <div className="mt-4">
          <Textarea label="Remarks" value={form.remarks} onChange={e => f("remarks", e.target.value)} placeholder="Special instructions, requirements..." />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : editing ? "Update Enquiry" : "Save Enquiry"}
          </Button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={`Enquiry – ${viewRow.enquiryNo}`} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {([
                ["Customer",       viewRow.customerName],
                ["Job Name",       viewRow.jobName],
                ["Date",           viewRow.date],
                ["Substrate",      viewRow.substrate],
                ["Structure",      viewRow.structureType],
                ["Print Width",    `${viewRow.width} mm`],
                ["Repeat Length",  `${viewRow.repeatLength} mm`],
                ["No. of Colors",  `${viewRow.noOfColors} Colors`],
                ["Print Type",     viewRow.printType],
                ["Quantity",       `${Number(viewRow.quantity).toLocaleString()} ${viewRow.unit}`],
                ["Cylinder Status",viewRow.cylinderStatus],
                ["Special Finish", viewRow.specialFinish],
                ["Design Ref",     viewRow.designRef || "—"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-gray-500 font-medium">{k}</p>
                  <p className="text-gray-800 font-medium">{v}</p>
                </div>
              ))}
            </div>

            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusColor[viewRow.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
              {viewRow.status}
            </div>

            {viewRow.remarks && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <p className="text-xs font-semibold mb-1">Remarks</p>
                {viewRow.remarks}
              </div>
            )}
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            {viewRow.status === "Pending" && (
              <Button icon={<ArrowRight size={14} />}>Create Estimation</Button>
            )}
            {viewRow.status === "Estimated" && (
              <Button icon={<ArrowRight size={14} />}>Convert to Order</Button>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Are you sure you want to delete this enquiry? This action cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
