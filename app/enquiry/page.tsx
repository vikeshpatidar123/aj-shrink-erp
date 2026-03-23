"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, ClipboardList, ArrowRight, Check } from "lucide-react";
import { customers, products, categories } from "@/data/dummyData";
import { useUnit } from "@/context/UnitContext";
import { useEnquiries, CombinedEnquiry } from "@/context/EnquiryContext";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

type BU = "Extrusion" | "Gravure";

// ─── Blank form ───────────────────────────────────────────────
const blank: Omit<CombinedEnquiry, "id" | "enquiryNo"> = {
  date: new Date().toISOString().slice(0, 10),
  businessUnit: "Extrusion",
  customerId: "", customerName: "",
  jobName: "", quantity: 0, uom: "Kg",
  status: "Pending", remarks: "",
  productId: "", productName: "", width: 0, thickness: 0,
  printingRequired: false, printingColors: 0,
  substrate: "", repeatLength: 0, noOfColors: 6,
  printType: "Surface Print", structureType: "",
  cylinderStatus: "New", designRef: "", specialFinish: "",
  categoryId: "", categoryName: "", selectedContent: "",
  salesPersonId: "", salesPersonName: "", salesType: "Domestic", concernPerson: "",
  planHeight: 0, planWidth: 0, planFColor: 0, planBColor: 0, planSFColor: 0, planSBColor: 0,
  wastageType: "Machine Default", finishedFormat: "Roll Form", labelRoll: 0,
  processes: [], plys: [],
};

const BU_BADGE: Record<BU, string> = {
  Extrusion: "bg-blue-50 text-blue-700 border-blue-200",
  Gravure: "bg-purple-50 text-purple-700 border-purple-200",
};

// ─── Section header ───────────────────────────────────────────
const SH = ({ label }: { label: string }) => (
  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100 pb-1.5 mb-3">{label}</p>
);

// ─── Substrates list (Gravure) ────────────────────────────────
const SUBSTRATES = ["BOPP 20μ", "BOPP 15μ", "PET 12μ", "CPP 30μ", "PVC 50μ", "Met PET 12μ", "OPS 40μ", "LDPE 40μ"];
const STRUCTURES = ["BOPP+CPP", "PET+Dry Lam+PE", "BOPP+Met PET+CPP", "PVC Shrink", "BOPP+PE", "PET+CPP", "BOPP+BOPP"];
const FINISHES = ["None", "Gloss OPV", "Matte OPV", "Heat Seal Coat", "Cold Seal", "UV Varnish"];
// Must match processMasters[].name (module="Rotogravure") so estimation can find them by name
const ALL_PROCESSES = [
  "Cylinder Engraving", "Cylinder Chrome Plating",
  "6-Color Roto Printing", "8-Color Roto Printing", "9-Color Roto Printing", "10-Color Roto Printing",
  "Dry Bond Lamination", "Solventless Lamination", "Extrusion Lamination (PE)",
  "Matte OPV Coating", "Gloss OPV Coating", "Heat Seal Coating",
  "Slitting & Rewinding", "Log Slitting",
  "3-Side Seal Pouch Making", "4-Side Seal Pouch Making", "Center Seal (Back Seal) Pouch", "Stand-up Pouch (SUP)", "Zip Lock Pouch",
  "Inline Vision Inspection", "Final Inspection & Rewinding",
];


export default function EnquiryPage() {
  const { unit: globalUnit } = useUnit();
  const { enquiries: data, saveEnquiry, deleteEnquiry } = useEnquiries();
  const [modalOpen, setModal] = useState(false);
  const [viewRow, setViewRow] = useState<CombinedEnquiry | null>(null);
  const [editing, setEditing] = useState<CombinedEnquiry | null>(null);
  const [form, setForm] = useState<Omit<CombinedEnquiry, "id" | "enquiryNo">>({ ...blank });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const SALES_PERSONS = [
    { id: "S1", name: "Rahul Sharma" },
    { id: "S2", name: "Anil Verma" },
    { id: "S3", name: "Priya Singh" },
  ];
  const SALES_TYPES = ["Domestic", "Exporter", "Service", "Direct"];

  const f = (k: keyof typeof blank, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const isGrv = form.businessUnit === "Gravure";

  // Category master state — local (in real app would come from a shared store/API)
  const GRAVURE_CONTENTS = [
    "Roto - Label", "Roto - Center Seal Pouch", "Roto - Zipper Pouch",
    "Roto - 3 Side Seal Pouch", "Roto - 4 Side Seal Pouch", "Roto - Stand Up Pouch",
    "Roto - Back Seal Pouch", "Roto - Laminated Roll", "Roto - Shrink Film",
    "Roto - Shrink Sleeve", "Roto - Wrap Around Label", "Roto - Flat Pouch",
  ];

  // Derive available contents from selected category
  const availableContents = form.categoryId ? GRAVURE_CONTENTS : [];
  const contentSelected = !!form.selectedContent;

  // Filter table by global unit
  const displayData = globalUnit === "Both" ? data : data.filter(d => d.businessUnit === globalUnit);

  const openAdd = () => {
    const defaultUnit: BU = globalUnit === "Both" ? "Extrusion" : globalUnit;
    setEditing(null);
    setForm({ ...blank, businessUnit: defaultUnit, uom: defaultUnit === "Gravure" ? "Meter" : "Kg" });
    setModal(true);
  };
  const openEdit = (row: CombinedEnquiry) => {
    setEditing(row);
    const { id, enquiryNo, ...rest } = row;
    setForm(rest);
    setModal(true);
  };

  const save = () => {
    if (!form.customerId || !form.jobName || form.quantity <= 0) return;
    if (editing) {
      saveEnquiry({ ...form, id: editing.id, enquiryNo: editing.enquiryNo });
    } else {
      const unitCode = UNIT_CODE[form.businessUnit];
      const enquiryNo = generateCode(unitCode, MODULE_CODE.Enquiry, data.map(d => d.enquiryNo));
      const id = `${unitCode}EQ${String(data.length + 1).padStart(3, "0")}`;
      saveEnquiry({ ...form, id, enquiryNo });
    }
    setModal(false);
  };

  // Stats
  const total = data.length;
  const extCount = data.filter(d => d.businessUnit === "Extrusion").length;
  const grvCount = data.filter(d => d.businessUnit === "Gravure").length;
  const pending = data.filter(d => d.status === "Pending").length;
  const converted = data.filter(d => d.status === "Converted").length;

  const columns: Column<CombinedEnquiry>[] = [
    { key: "enquiryNo", header: "Enquiry No", sortable: true },
    { key: "date", header: "Date", sortable: true },
    {
      key: "businessUnit", header: "Unit", render: r => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${BU_BADGE[r.businessUnit]}`}>{r.businessUnit}</span>
      )
    },
    { key: "customerName", header: "Customer", sortable: true },
    { key: "jobName", header: "Job / Product" },
    { key: "salesPersonName", header: "Sales Person" },
    { key: "salesType", header: "Sales Type" },
    { key: "quantity", header: "Qty", render: r => <span>{r.quantity.toLocaleString()} {r.uom}</span> },
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ClipboardList size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Enquiry</h2>
          </div>
          <p className="text-sm text-gray-500">{total} enquiries — {extCount} Extrusion · {grvCount} Gravure</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>New Enquiry</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total", val: total, cls: "bg-gray-50 text-gray-700 border-gray-200" },
          { label: "Extrusion", val: extCount, cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Gravure", val: grvCount, cls: "bg-purple-50 text-purple-700 border-purple-200" },
          { label: "Pending", val: pending, cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { label: "Converted", val: converted, cls: "bg-green-50 text-green-700 border-green-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable
          data={displayData}
          columns={columns}
          searchKeys={["enquiryNo", "customerName", "jobName"]}
          actions={row => (
            <div className="flex items-center gap-1.5 justify-end">
              <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={() => setViewRow(row)}>View</Button>
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleteId(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>

      {/* ══ FORM MODAL ══════════════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => setModal(false)}
        title={editing ? "Edit Enquiry" : "New Enquiry"} size="xl">
        <div className="space-y-5">

          {/* Unit Selector — only when global unit is "Both" */}
          {globalUnit === "Both" ? (
            <div className="flex gap-3">
              {(["Extrusion", "Gravure"] as BU[]).map(bu => (
                <button key={bu} onClick={() => f("businessUnit", bu)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all
                    ${form.businessUnit === bu
                      ? bu === "Extrusion" ? "border-blue-500 bg-blue-50 text-blue-800" : "border-purple-500 bg-purple-50 text-purple-800"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                  {bu === "Extrusion" ? "⚙️" : "🖨️"} {bu}
                </button>
              ))}
            </div>
          ) : (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm
              ${form.businessUnit === "Extrusion" ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-purple-50 border-purple-300 text-purple-800"}`}>
              {form.businessUnit === "Extrusion" ? "⚙️" : "🖨️"} {form.businessUnit} Unit
            </div>
          )}

          {/* Common fields */}
          <div>
            <SH label="Basic Information" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input
                label="Enquiry No."
                value={editing ? editing.enquiryNo : "Auto Generated"}
                readOnly
                className="bg-gray-50 font-semibold text-teal-700 border-teal-100"
              />
              <Input label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
              <Select
                label="Customer *"
                value={form.customerId}
                onChange={e => {
                  const c = customers.find(x => x.id === e.target.value);
                  f("customerId", e.target.value);
                  if (c) f("customerName", c.name);
                }}
                options={[{ value: "", label: "-- Select Customer --" }, ...customers.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))]}
              />
              <Input label="Job / Product Name *" value={form.jobName}
                onChange={e => f("jobName", e.target.value)} placeholder="Describe the job" />
              <Input label="Quantity *" type="number" value={form.quantity}
                onChange={e => f("quantity", Number(e.target.value))} />
              <Select label="Unit" value={form.uom} onChange={e => f("uom", e.target.value)}
                options={[{ value: "Kg", label: "Kg" }, { value: "Nos", label: "Nos" }]} />
              
              {/* Sales Person */}
              <Select
                label="Sales Person"
                value={form.salesPersonId}
                onChange={e => {
                  const s = SALES_PERSONS.find(x => x.id === e.target.value);
                  f("salesPersonId", e.target.value);
                  if (s) f("salesPersonName", s.name);
                }}
                options={[{ value: "", label: "-- Select Sales Person --" }, ...SALES_PERSONS.map(s => ({ value: s.id, label: s.name }))]}
              />

              {/* Sales Type */}
              <Select
                label="Sales Type"
                value={form.salesType}
                onChange={e => f("salesType", e.target.value)}
                options={SALES_TYPES.map(t => ({ value: t, label: t }))}
              />

              {/* Concern Person */}
              <Input
                label="Concern Person"
                value={form.concernPerson}
                onChange={e => f("concernPerson", e.target.value)}
                placeholder="Name of contact person"
              />

              <Select
                label="Category"
                value={form.categoryId}
                onChange={e => {
                  const cat = categories.find(x => x.id === e.target.value);
                  f("categoryId", e.target.value);
                  f("categoryName", cat?.name || "");
                  f("selectedContent", ""); // reset content on category change
                }}
                options={[
                  { value: "", label: "-- Select Category --" },
                  ...categories.filter(c => c.status === "Active").map(c => ({ value: c.id, label: c.name }))
                ]}
              />
            </div>
          </div>

          {/* ── Content Cards (shown after category is selected) ── */}
          {form.categoryId && (
            <div>
              <SH label={`Select Content — ${form.categoryName}`} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableContents.map(content => {
                  const isSelected = form.selectedContent === content;
                  return (
                    <button
                      key={content}
                      type="button"
                      onClick={() => f("selectedContent", isSelected ? "" : content)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
                        ${isSelected
                          ? "border-teal-500 bg-teal-50 shadow-md"
                          : "border-gray-200 bg-white hover:border-teal-300 hover:bg-gray-50"}`}
                    >
                      {/* Mini icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold leading-tight text-center
                        ${isSelected ? "bg-teal-600 text-white" : "bg-yellow-300 text-yellow-800"}`}>
                        {content.split(" - ")[1]?.split(" ").slice(0, 2).join("\n") || content.slice(0, 4)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold leading-tight truncate ${isSelected ? "text-teal-700" : "text-blue-700"}`}>
                          {content}
                        </p>
                        {isSelected && (
                          <p className="text-[11px] text-teal-600 mt-0.5 flex items-center gap-1">
                            <Check size={11} /> Selected
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unit-specific fields */}
          {!isGrv ? (
            /* ── Extrusion fields ── */
            <div>
              <SH label="Extrusion Specifications" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Select
                  label="Product"
                  value={form.productId}
                  onChange={e => {
                    const p = products.find(x => x.id === e.target.value);
                    f("productId", e.target.value);
                    if (p) { f("productName", p.name); f("width", p.width); f("thickness", p.thickness); }
                  }}
                  options={[{ value: "", label: "-- Select Product --" }, ...products.filter(p => p.status === "Active" && (p.category === "Extrusion" || p.category === "Both")).map(p => ({ value: p.id, label: p.name }))]}
                />
                <Input label="Width (mm)" type="number" value={form.width} onChange={e => f("width", Number(e.target.value))} />
                <Input label="Thickness (μ)" type="number" value={form.thickness} onChange={e => f("thickness", Number(e.target.value))} />
                <Input label="Printing Colors" type="number" value={form.printingColors} onChange={e => f("printingColors", Number(e.target.value))} />
                <div className="flex items-center gap-3 mt-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Printing Required</label>
                  <button onClick={() => f("printingRequired", !form.printingRequired)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${form.printingRequired ? "bg-blue-500" : "bg-gray-200"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.printingRequired ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <Textarea label="Remarks" value={form.remarks} onChange={e => f("remarks", e.target.value)}
            placeholder="Special requirements, urgency, other notes..." />

          {/* ── Plan Window & Allocation — only shown after content is selected ── */}
          {contentSelected ? (
          <div className="pt-4 mt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <SH label="Plan Window Details & Allocation" />
              <span className="ml-auto px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-semibold rounded-full">
                {form.selectedContent}
              </span>
            </div>
            <div className="flex flex-col xl:flex-row gap-6">

              {/* Left Column: Plan Window Details */}
              <div className="flex-1 space-y-4">
                <div className="flex bg-blue-700 text-white text-xs font-semibold rounded-t-lg mx-[1px]">
                  <div className="w-1/2 px-3 py-2 border-r border-blue-600">Caption</div>
                  <div className="w-1/2 px-3 py-2">Value</div>
                </div>
                <div className="text-sm border border-gray-200 rounded-b-lg -mt-4 bg-white divide-y divide-gray-100">
                  {[
                    { label: "Height (MM)", key: "planHeight" as keyof typeof form, type: "number" },
                    { label: "Width (MM)", key: "planWidth" as keyof typeof form, type: "number" },
                    { label: "F. Color", key: "planFColor" as keyof typeof form, type: "number" },
                    { label: "B. Color", key: "planBColor" as keyof typeof form, type: "number" },
                    { label: "S.F. Color", key: "planSFColor" as keyof typeof form, type: "number" },
                    { label: "S.B. Color", key: "planSBColor" as keyof typeof form, type: "number" },
                    { label: "Wastage Type", key: "wastageType" as keyof typeof form, type: "text", options: ["Machine Default", "Manual"] },
                    { label: "Finished Format", key: "finishedFormat" as keyof typeof form, type: "text", options: ["Roll Form", "Pouch Form"] },
                    { label: "Label/Roll", key: "labelRoll" as keyof typeof form, type: "number" },
                  ].map(field => (
                    <div key={field.label} className="flex hover:bg-gray-50 transition-colors">
                      <div className="w-1/2 px-3 py-2 bg-slate-50 border-r border-gray-200 text-slate-700 font-medium">{field.label}</div>
                      <div className="w-1/2 px-1 py-1">
                        {field.options ? (
                          <select className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 h-full"
                            value={String(form[field.key] || "")} onChange={e => f(field.key, e.target.value)}>
                            {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={field.type} className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 h-full py-1"
                            value={Number(form[field.key]) || 0} onChange={e => f(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Middle Column: Process Grid */}
              <div className="w-full xl:w-1/3 space-y-4">
                <div className="flex bg-teal-700 text-white text-xs font-semibold rounded-t-lg mx-[1px]">
                  <div className="w-10 px-3 py-2 border-r border-teal-600 flex justify-center"><Check size={14} className="opacity-50" /></div>
                  <div className="flex-1 px-3 py-2">Process Name</div>
                </div>
                <div className="text-sm border border-gray-200 rounded-b-lg -mt-4 bg-white overflow-y-auto max-h-[350px] divide-y divide-gray-100">
                  <div className="flex bg-gray-50 border-b border-gray-200">
                    <div className="w-10 px-3 py-1.5 border-r border-gray-200" />
                    <div className="flex-1 px-2 py-1.5"><input type="text" placeholder="..." className="w-full text-xs bg-white border border-gray-200 rounded px-2 shadow-inner h-6 outline-none" /></div>
                  </div>
                  {ALL_PROCESSES.map(p => {
                    const checked = form.processes?.includes(p);
                    return (
                      <label key={p} className="flex items-center cursor-pointer hover:bg-teal-50/50 transition-colors">
                        <div className="w-10 px-3 py-2 border-r border-gray-200 flex justify-center">
                          <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            checked={checked}
                            onChange={(e) => {
                              const pList = form.processes || [];
                              if (e.target.checked) f("processes", [...pList, p]);
                              else f("processes", pList.filter(x => x !== p));
                            }} />
                        </div>
                        <div className="flex-1 px-3 py-2 text-xs text-gray-700 select-none">{p}</div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Section: Item Quality / Plys */}
            <div className="mt-6">
              <SH label="Grid Allocate Process / Plys" />
              <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col mt-2">
                <div className="flex bg-blue-800 text-white text-xs font-semibold">
                  <div className="flex-1 px-3 py-2 border-r border-blue-700">Item Quality</div>
                  <div className="w-24 px-3 py-2 border-r border-blue-700 text-center">Thickness</div>
                  <div className="w-32 px-3 py-2 border-r border-blue-700 text-center">GSM</div>
                  <div className="w-32 px-3 py-2 border-r border-blue-700 text-center">MIL</div>
                  <div className="w-12 px-3 py-2 text-center flex items-center justify-center">
                    <button className="bg-white/20 hover:bg-white/30 rounded p-0.5 transition-colors"
                      onClick={() => f("plys", [...(form.plys || []), { id: Math.random().toString(), itemQuality: "film", thickness: 0, gsm: 0, mil: 0 }])}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="bg-white divide-y divide-gray-100 min-h-[100px]">
                  {(form.plys || []).map((ply, i) => (
                    <div key={ply.id} className="flex items-center text-xs">
                      <div className="flex-1 px-2 py-1.5 border-r border-gray-200">
                        <select className="w-full bg-transparent outline-none h-6 cursor-pointer"
                          value={ply.itemQuality} onChange={e => {
                            const newP = [...(form.plys || [])]; newP[i].itemQuality = e.target.value; f("plys", newP);
                          }}>
                          <option value="film">film</option>
                          <option value="ink">ink</option>
                          <option value="adhesive">adhesive</option>
                        </select>
                      </div>
                      <div className="w-24 px-2 py-1.5 border-r border-gray-200 text-center">
                        <input type="number" className="w-full text-center bg-transparent outline-none h-6"
                          value={ply.thickness || ""} onChange={e => {
                            const newP = [...(form.plys || [])]; newP[i].thickness = Number(e.target.value); f("plys", newP);
                          }} />
                      </div>
                      <div className="w-32 px-2 py-1.5 border-r border-gray-200 text-center">
                        <select className="w-full bg-transparent outline-none h-6 cursor-pointer"
                          value={ply.gsm || ""} onChange={e => {
                            const newP = [...(form.plys || [])]; newP[i].gsm = Number(e.target.value); f("plys", newP);
                          }}>
                          <option value="0">Select GSM</option>
                          <option value="50">50 GSM</option>
                          <option value="100">100 GSM</option>
                        </select>
                      </div>
                      <div className="w-32 px-2 py-1.5 border-r border-gray-200 text-center">
                        <select className="w-full bg-transparent outline-none h-6 cursor-pointer"
                          value={ply.mil || ""} onChange={e => {
                            const newP = [...(form.plys || [])]; newP[i].mil = Number(e.target.value); f("plys", newP);
                          }}>
                          <option value="0">Select MIL</option>
                          <option value="1">1 MIL</option>
                          <option value="2">2 MIL</option>
                        </select>
                      </div>
                      <div className="w-12 px-2 py-1.5 flex justify-center items-center">
                        <button className="text-red-500 hover:text-red-700 opacity-60 hover:opacity-100 transition-all p-1"
                          onClick={() => f("plys", (form.plys || []).filter(x => x.id !== ply.id))}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!form.plys || form.plys.length === 0) && (
                    <div className="p-4 text-center text-xs text-gray-400 font-medium">No ply allocated. Click '+' to add ply.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          ) : form.categoryId ? (
            <div className="pt-4 mt-2 border-t border-gray-100">
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-xl">☝️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Content Select Karo</p>
                  <p className="text-xs text-amber-600 mt-0.5">Upar se ek content type choose karo — phir Plan Window Details aur Allocation yahan dikhengi.</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update" : "Save Enquiry"}</Button>
        </div>
      </Modal>

      {/* ══ VIEW MODAL ════════════════════════════════════════ */}
      {viewRow && (
        <Modal open={!!viewRow} onClose={() => setViewRow(null)}
          title={`Enquiry – ${viewRow.enquiryNo}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${BU_BADGE[viewRow.businessUnit]}`}>
                {viewRow.businessUnit}
              </span>
              {statusBadge(viewRow.status)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                ["Customer", viewRow.customerName],
                ["Job Name", viewRow.jobName],
                ["Quantity", `${viewRow.quantity.toLocaleString()} ${viewRow.uom}`],
                ["Date", viewRow.date],
                ...(viewRow.businessUnit === "Extrusion" ? [
                  ["Product", viewRow.productName],
                  ["Width", `${viewRow.width} mm`],
                  ["Thickness", `${viewRow.thickness} μ`],
                  ["Printing", viewRow.printingRequired ? `Yes – ${viewRow.printingColors} Colors` : "No"],
                ] : []),
                ["Sales Person", viewRow.salesPersonName],
                ["Sales Type", viewRow.salesType],
                ["Concern Person", viewRow.concernPerson],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium text-gray-900">{v}</p></div>
              ))}
            </div>
            {viewRow.remarks && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Remarks:</strong> {viewRow.remarks}
              </div>
            )}
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            {viewRow.status === "Pending" && (
              <Button icon={<ArrowRight size={14} />}>Create Estimation</Button>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <p className="text-sm text-gray-600">Delete this enquiry?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { deleteEnquiry(deleteId!); setDeleteId(null); }}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
