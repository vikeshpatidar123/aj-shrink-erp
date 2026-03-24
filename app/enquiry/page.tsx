"use client";
import { useState } from "react";
import { Plus, Eye, Pencil, Trash2, ClipboardList, ArrowRight, Check, X } from "lucide-react";
import { customers, products, categories, items, CATEGORY_GROUP_SUBGROUP, SecondaryLayer, PlyConsumableItem } from "@/data/dummyData";
import { useUnit } from "@/context/UnitContext";
import { useEnquiries, CombinedEnquiry } from "@/context/EnquiryContext";
import { generateCode, UNIT_CODE, MODULE_CODE } from "@/lib/generateCode";
import { DataTable, Column } from "@/components/tables/DataTable";
import { statusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";

type BU = "Extrusion" | "Gravure";

const FILM_ITEMS = items.filter(i => i.group === "Film" && i.active);
const FILM_SUBGROUPS = Array.from(
  new Map(FILM_ITEMS.filter(i => i.subGroup).map(i => [i.subGroup, { subGroup: i.subGroup, density: parseFloat(i.density) || 0, thicknesses: new Set<number>() }])).entries()
).map(([subGroup, data]) => {
  FILM_ITEMS.filter(i => i.subGroup === subGroup).forEach(i => { const t = parseFloat(i.thickness); if (!isNaN(t) && t > 0) data.thicknesses.add(t); });
  return { subGroup, density: data.density, thicknesses: Array.from(data.thicknesses).sort((a, b) => a - b) };
});

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
  planHeight: 0, planWidth: 0, frontColors: 4, backColors: 2,
  wastageType: "Machine Default", finishedFormat: "Roll Form", labelRoll: 0,
  processes: [], plys: [], secondaryLayers: [],
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

  // ── Ply helpers ──────────────────────────────────────────────
  const addPly = () => {
    const layers = [...(form.secondaryLayers || [])];
    layers.push({ id: Math.random().toString(), layerNo: layers.length + 1, plyType: "", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [] });
    f("secondaryLayers", layers);
  };
  const removePly = (idx: number) => {
    f("secondaryLayers", (form.secondaryLayers || []).filter((_, i) => i !== idx));
  };
  const onPlyTypeChange = (idx: number, plyType: string) => {
    const layers = [...(form.secondaryLayers || [])];
    layers[idx] = { ...layers[idx], plyType, itemSubGroup: "", density: 0, thickness: 0, gsm: 0 };
    f("secondaryLayers", layers);
  };
  const addPlyConsumable = (idx: number) => {
    const layers = [...(form.secondaryLayers || [])];
    layers[idx].consumableItems = [...layers[idx].consumableItems, { consumableId: Math.random().toString(), fieldDisplayName: "", itemGroup: "", itemSubGroup: "", itemId: "", itemName: "", gsm: 0, rate: 0, coveragePct: 100 }];
    f("secondaryLayers", layers);
  };
  const removePlyConsumable = (plyIdx: number, ciIdx: number) => {
    const layers = [...(form.secondaryLayers || [])];
    layers[plyIdx].consumableItems = layers[plyIdx].consumableItems.filter((_, i) => i !== ciIdx);
    f("secondaryLayers", layers);
  };
  const updatePlyConsumable = (plyIdx: number, ciIdx: number, patch: Partial<PlyConsumableItem>) => {
    const layers = [...(form.secondaryLayers || [])];
    const ci = [...layers[plyIdx].consumableItems];
    ci[ciIdx] = { ...ci[ciIdx], ...patch };
    layers[plyIdx].consumableItems = ci;
    f("secondaryLayers", layers);
  };

  // Derive available contents from selected category (from categories master)
  const availableContents = form.categoryId
    ? (categories.find(c => c.id === form.categoryId)?.contents || [])
    : [];
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
      <div className="flex items-center justify-between flex-wrap gap-y-3">
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
            <div className="flex items-center gap-1.5 justify-end flex-wrap">
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
                value={editing ? editing.enquiryNo : generateCode(UNIT_CODE[form.businessUnit as BU], MODULE_CODE.Enquiry, data.map(d => d.enquiryNo))}
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
            <div className="flex items-start sm:items-center flex-wrap gap-2 mb-3">
              <SH label="Plan Window Details & Allocation" />
              <span className="sm:ml-auto px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-semibold rounded-full">
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
                    { label: "Front Colors", key: "frontColors" as keyof typeof form, type: "number" },
                    { label: "Back Colors", key: "backColors" as keyof typeof form, type: "number" },
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

            {/* Bottom Section: Ply Structure with Consumables */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <SH label="Ply Structure & Consumables" />
                <button onClick={addPly}
                  className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition">
                  <Plus size={12} /> Add Ply
                </button>
              </div>
              <div className="space-y-3">
                {(form.secondaryLayers || []).map((l, index) => {
                  const thicknesses = FILM_SUBGROUPS.find(s => s.subGroup === l.itemSubGroup)?.thicknesses || [];
                  return (
                    <div key={l.id} className="border border-purple-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between bg-purple-700 text-white px-3 py-2">
                        <span className="text-xs font-bold">Ply {index + 1}{l.plyType ? ` — ${l.plyType}` : ""}</span>
                        <button onClick={() => removePly(index)} className="p-1 hover:bg-white/20 rounded transition">
                          <X size={13} />
                        </button>
                      </div>
                      <div className="p-3 space-y-3">
                        {/* Ply Type */}
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Ply Type *</label>
                          <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 outline-none focus:ring-2 focus:ring-purple-400"
                            value={l.plyType} onChange={e => onPlyTypeChange(index, e.target.value)}>
                            <option value="">-- Select Ply Type --</option>
                            <option value="Film">1st Ply (Film / Substrate)</option>
                            <option value="Printing">2nd Ply (Printing)</option>
                            <option value="Lamination">3rd Ply (Lamination)</option>
                            <option value="Coating">4th Ply (Coating)</option>
                          </select>
                        </div>
                        {/* Film section */}
                        {l.plyType && (
                          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                              {l.plyType === "Film" ? "Film / Substrate" : l.plyType === "Lamination" ? "Laminating Film" : "Print Film"}
                            </p>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film Type</label>
                              <select className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                value={l.itemSubGroup}
                                onChange={e => {
                                  const sg = FILM_SUBGROUPS.find(s => s.subGroup === e.target.value);
                                  const layers = [...(form.secondaryLayers || [])];
                                  layers[index] = { ...l, itemSubGroup: e.target.value, density: sg?.density || 0, thickness: 0, gsm: 0 };
                                  f("secondaryLayers", layers);
                                }}>
                                <option value="">Select Film Type</option>
                                {FILM_SUBGROUPS.map(opt => <option key={opt.subGroup} value={opt.subGroup}>{opt.subGroup}</option>)}
                              </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Density</label>
                                <input readOnly value={l.density || ""} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-400" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Thickness (μ)</label>
                                <select className="w-full text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white outline-none focus:ring-2 focus:ring-purple-400"
                                  value={l.thickness}
                                  onChange={e => {
                                    const thickness = Number(e.target.value);
                                    const layers = [...(form.secondaryLayers || [])];
                                    layers[index] = { ...l, thickness, gsm: parseFloat((thickness * l.density).toFixed(3)) };
                                    f("secondaryLayers", layers);
                                  }}>
                                  <option value={0}>Select</option>
                                  {thicknesses.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Film GSM</label>
                                <input readOnly value={l.gsm || ""} className="w-full text-xs border border-purple-200 rounded-lg px-2 py-1.5 bg-purple-50 text-purple-800 font-bold" />
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Consumables */}
                        {l.plyType && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Consumable Items ({l.consumableItems.length})</span>
                              <button onClick={() => addPlyConsumable(index)}
                                className="flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 transition">
                                <Plus size={10} /> Add Consumable
                              </button>
                            </div>
                            {l.consumableItems.map((ci, ciIdx) => {
                              const CONSUMABLE_GROUPS = ["Ink", "Solvent", "Adhesive", "Hardner"];
                              const subGroups = ci.itemGroup ? (CATEGORY_GROUP_SUBGROUP["Raw Material (RM)"]?.[ci.itemGroup] ?? []) : [];
                              const filteredItems = items.filter(it => it.group === ci.itemGroup && it.active && (!ci.itemSubGroup || it.subGroup === ci.itemSubGroup));
                              return (
                                <div key={ci.consumableId} className="bg-teal-50/40 border border-teal-100 rounded-xl p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-teal-700 uppercase">Consumable {ciIdx + 1}</span>
                                    <button onClick={() => removePlyConsumable(index, ciIdx)}
                                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                      <X size={12} />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item Group</label>
                                      <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                        value={ci.itemGroup}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { itemGroup: e.target.value, itemSubGroup: "", itemId: "", itemName: "", coveragePct: undefined })}>
                                        <option value="">-- Group --</option>
                                        {CONSUMABLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Sub Group</label>
                                      <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                        value={ci.itemSubGroup}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { itemSubGroup: e.target.value, itemId: "", itemName: "" })}
                                        disabled={!ci.itemGroup}>
                                        <option value="">-- Sub Group --</option>
                                        {subGroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Item (Master)</label>
                                      <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400"
                                        value={ci.itemId}
                                        onChange={e => {
                                          const it = filteredItems.find(x => x.id === e.target.value);
                                          updatePlyConsumable(index, ciIdx, { itemId: it?.id ?? "", itemName: it?.name ?? "", rate: parseFloat(it?.estimationRate ?? "0") || 0 });
                                        }}
                                        disabled={!ci.itemGroup}>
                                        <option value="">-- Select Item --</option>
                                        {filteredItems.map(it => <option key={it.id} value={it.id}>{it.name}{it.estimationRate ? ` — ₹${it.estimationRate}/Kg` : ""}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">GSM / Wet Wt.</label>
                                      <input type="number" step={0.1} min={0}
                                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                                        value={ci.gsm || ""}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { gsm: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Coverage %</label>
                                      <input type="number" step={1} min={1} max={100}
                                        className="w-full text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-blue-50 outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                                        value={ci.coveragePct ?? 100}
                                        onChange={e => updatePlyConsumable(index, ciIdx, { coveragePct: Math.min(100, Math.max(1, Number(e.target.value))) })} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {l.consumableItems.length === 0 && (
                              <p className="text-[10px] text-gray-400 italic text-center py-2">Click "+ Add Consumable" to add ink, solvent, adhesive, etc.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!form.secondaryLayers || form.secondaryLayers.length === 0) && (
                  <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">No ply added. Click &quot;Add Ply&quot; to define the structure.</div>
                )}
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
