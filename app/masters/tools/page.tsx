"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, Check, List } from "lucide-react";
import { tools as initData, Tool, ToolType } from "@/data/dummyData";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { inputCls } from "@/lib/styles";

// ─── Tool types & their colors ────────────────────────────────

const TOOL_TYPES: ToolType[] = ["Cylinder", "Sleeve", "Die", "Anilox Roll", "Doctor Blade", "Impression Roller", "Slitter Knife"];

const toolColor: Record<ToolType, string> = {
  "Cylinder":         "bg-blue-100 text-blue-700",
  "Sleeve":           "bg-sky-100 text-sky-700",
  "Die":              "bg-rose-100 text-rose-700",
  "Anilox Roll":      "bg-amber-100 text-amber-700",
  "Doctor Blade":     "bg-emerald-100 text-emerald-700",
  "Impression Roller":"bg-purple-100 text-purple-700",
  "Slitter Knife":    "bg-cyan-100 text-cyan-700",
};

const toolDesc: Record<ToolType, string> = {
  "Cylinder":          "Gravure printing cylinder with engraved cells",
  "Sleeve":            "Printing sleeve — mounts on cylinder for sleeve-based gravure",
  "Die":               "Cutting die for pouches, sleeves and labels",
  "Anilox Roll":       "Metering roll for coating / varnish decks",
  "Doctor Blade":      "Blade that wipes excess ink off the cylinder",
  "Impression Roller": "Rubber / PU nip roller pressing web to cylinder",
  "Slitter Knife":     "Upper / lower knife set for slitter-rewinder",
};

const blank: Omit<Tool, "id"> = {
  code: "", name: "", toolType: "Cylinder",
  clientName: "", jobCardNo: "", jobName: "",
  location: "", hsnCode: "", purchaseUnit: "Nos", stockUnit: "Nos",
  category: "", description: "", status: "Active",
  repeatLength: "", printWidth: "", noOfColors: "", colorName: "",
  engravingType: "", screen: "", engravingAngle: "", cellDepth: "",
  cylinderMaterial: "", surfaceFinish: "", chromeStatus: "",
  toolPrefix: "", toolRefCode: "", dieType: "",
  length: "", width: "", height: "", upsL: "", upsW: "", totalUps: "",
  machine: "", deckNo: "", lineCount: "", volume: "",
  rollWidth: "", rollDiameter: "", aniloxEngravingType: "", aniloxMaterial: "",
  material: "", bladeWidth: "", bladeThickness: "", bladeLength: "",
  hardness: "", knifeType: "", knifeDiameter: "", knifeThickness: "",
};

// ─── Helpers ──────────────────────────────────────────────────

const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{title}</h3>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const Sel = ({ value, onChange, options, placeholder = "Select..." }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const SuffixInput = ({ value, onChange, suffix, placeholder, type = "text" }: any) => (
  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none" />
    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-l border-gray-300 font-medium whitespace-nowrap">{suffix}</div>
  </div>
);

// ─── Spec sections per tool type ─────────────────────────────

function CylinderSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle title="Cylinder Dimensions" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Repeat Length (Circumference)">
            <SuffixInput value={form.repeatLength} onChange={(e: any) => f("repeatLength", e.target.value)} suffix="mm" placeholder="e.g. 450" type="number" />
          </Field>
          <Field label="Print Width">
            <SuffixInput value={form.printWidth} onChange={(e: any) => f("printWidth", e.target.value)} suffix="mm" placeholder="e.g. 1100" type="number" />
          </Field>
          <Field label="No. of Colors">
            <Sel value={form.noOfColors} onChange={(v) => f("noOfColors", v)} options={["1","2","3","4","5","6","7","8","9","10","11","12"]} />
          </Field>
          <Field label="Color Name / Station">
            <input type="text" value={form.colorName} onChange={(e) => f("colorName", e.target.value)} placeholder="e.g. Cyan, Black, Spot 1" className={inputCls} />
          </Field>
        </div>
      </div>
      <div>
        <SectionTitle title="Engraving Details" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Engraving Type">
            <Sel value={form.engravingType} onChange={(v) => f("engravingType", v)} options={["Electromechanical", "Laser", "Chemical Etching"]} />
          </Field>
          <Field label="Screen (L/cm)">
            <SuffixInput value={form.screen} onChange={(e: any) => f("screen", e.target.value)} suffix="L/cm" placeholder="e.g. 70" type="number" />
          </Field>
          <Field label="Engraving Angle">
            <SuffixInput value={form.engravingAngle} onChange={(e: any) => f("engravingAngle", e.target.value)} suffix="°" placeholder="e.g. 45" type="number" />
          </Field>
          <Field label="Cell Depth">
            <SuffixInput value={form.cellDepth} onChange={(e: any) => f("cellDepth", e.target.value)} suffix="μ" placeholder="e.g. 32" type="number" />
          </Field>
        </div>
      </div>
      <div>
        <SectionTitle title="Material & Surface" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Cylinder Material">
            <Sel value={form.cylinderMaterial} onChange={(v) => f("cylinderMaterial", v)} options={["Steel", "Aluminium"]} />
          </Field>
          <Field label="Surface Finish">
            <Sel value={form.surfaceFinish} onChange={(v) => f("surfaceFinish", v)} options={["Hard Chrome", "Chrome Plated", "Base (Unplated)", "Copper Base"]} />
          </Field>
          <Field label="Chrome Status">
            <Sel value={form.chromeStatus} onChange={(v) => f("chromeStatus", v)} options={["Plated", "Not Plated", "Needs Re-chrome", "In Plating"]} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function DieSpecs({ form, f }: { form: any; f: any }) {
  const totalUps = form.upsL && form.upsW ? String(Number(form.upsL) * Number(form.upsW)) : form.totalUps;
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle title="Die Identity" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Tool Prefix">
            <Sel value={form.toolPrefix} onChange={(v) => f("toolPrefix", v)} options={["3SS","4SS","SUP","BACK SEAL","ZIP","SLEEVE","LABEL","FLAT","ROTARY"]} />
          </Field>
          <Field label="Tool Ref Code">
            <input type="text" value={form.toolRefCode} onChange={(e) => f("toolRefCode", e.target.value)} placeholder="e.g. DIE-REF-005" className={inputCls} />
          </Field>
          <Field label="Die Type">
            <Sel value={form.dieType} onChange={(v) => f("dieType", v)} options={["Flat Die", "Rotary Die", "Steel Rule Die", "Punch Die"]} />
          </Field>
        </div>
      </div>
      <div>
        <SectionTitle title="Die Dimensions" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Length">
            <SuffixInput value={form.length} onChange={(e: any) => f("length", e.target.value)} suffix="mm" placeholder="e.g. 200" type="number" />
          </Field>
          <Field label="Width">
            <SuffixInput value={form.width} onChange={(e: any) => f("width", e.target.value)} suffix="mm" placeholder="e.g. 130" type="number" />
          </Field>
          <Field label="Height / Thickness">
            <SuffixInput value={form.height} onChange={(e: any) => f("height", e.target.value)} suffix="mm" placeholder="e.g. 25" type="number" />
          </Field>
        </div>
      </div>
      <div>
        <SectionTitle title="Ups Layout" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Ups (Length direction)">
            <input type="number" value={form.upsL} onChange={(e) => { f("upsL", e.target.value); f("totalUps", String(Number(e.target.value) * Number(form.upsW || 1))); }} placeholder="e.g. 4" className={inputCls} />
          </Field>
          <Field label="Ups (Width direction)">
            <input type="number" value={form.upsW} onChange={(e) => { f("upsW", e.target.value); f("totalUps", String(Number(form.upsL || 1) * Number(e.target.value))); }} placeholder="e.g. 2" className={inputCls} />
          </Field>
          <Field label="Total Ups">
            <div className="px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm font-semibold text-blue-700">
              {totalUps || "0"}
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}

function AniloxSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div>
      <SectionTitle title="Anilox Roll Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Assigned Machine">
          <input type="text" value={form.machine} onChange={(e) => f("machine", e.target.value)} placeholder="e.g. ROTO-01" className={inputCls} />
        </Field>
        <Field label="Deck / Color Station">
          <input type="text" value={form.deckNo} onChange={(e) => f("deckNo", e.target.value)} placeholder="e.g. Deck 9 (Coating)" className={inputCls} />
        </Field>
        <Field label="Line Count">
          <SuffixInput value={form.lineCount} onChange={(e: any) => f("lineCount", e.target.value)} suffix="L/cm" placeholder="e.g. 140" type="number" />
        </Field>
        <Field label="Cell Volume">
          <SuffixInput value={form.volume} onChange={(e: any) => f("volume", e.target.value)} suffix="BCM" placeholder="e.g. 4.5" type="number" />
        </Field>
        <Field label="Roll Width">
          <SuffixInput value={form.rollWidth} onChange={(e: any) => f("rollWidth", e.target.value)} suffix="mm" placeholder="e.g. 1400" type="number" />
        </Field>
        <Field label="Roll Diameter">
          <SuffixInput value={form.rollDiameter} onChange={(e: any) => f("rollDiameter", e.target.value)} suffix="mm" placeholder="e.g. 140" type="number" />
        </Field>
        <Field label="Engraving Pattern">
          <Sel value={form.aniloxEngravingType} onChange={(v) => f("aniloxEngravingType", v)} options={["Hexagonal", "Tri-helical", "Quad-helical", "Knurl"]} />
        </Field>
        <Field label="Material">
          <Sel value={form.aniloxMaterial} onChange={(v) => f("aniloxMaterial", v)} options={["Ceramic", "Chrome"]} />
        </Field>
      </div>
    </div>
  );
}

function DoctorBladeSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div>
      <SectionTitle title="Doctor Blade Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Compatible Machine">
          <input type="text" value={form.machine} onChange={(e) => f("machine", e.target.value)} placeholder="e.g. ROTO-01" className={inputCls} />
        </Field>
        <Field label="Blade Material">
          <Sel value={form.material} onChange={(v) => f("material", v)} options={["Steel", "Stainless Steel", "Plastic", "Composite", "Carbon Fiber"]} />
        </Field>
        <Field label="Blade Width">
          <SuffixInput value={form.bladeWidth} onChange={(e: any) => f("bladeWidth", e.target.value)} suffix="mm" placeholder="e.g. 60" type="number" />
        </Field>
        <Field label="Blade Thickness">
          <SuffixInput value={form.bladeThickness} onChange={(e: any) => f("bladeThickness", e.target.value)} suffix="mm" placeholder="e.g. 0.15" type="number" />
        </Field>
        <Field label="Blade Length">
          <SuffixInput value={form.bladeLength} onChange={(e: any) => f("bladeLength", e.target.value)} suffix="mm" placeholder="e.g. 1400" type="number" />
        </Field>
      </div>
    </div>
  );
}

function ImpressionRollerSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div>
      <SectionTitle title="Impression Roller Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Compatible Machine">
          <input type="text" value={form.machine} onChange={(e) => f("machine", e.target.value)} placeholder="e.g. ROTO-01" className={inputCls} />
        </Field>
        <Field label="Roller Material">
          <Sel value={form.material} onChange={(v) => f("material", v)} options={["Rubber", "Polyurethane", "Silicone", "EPDM"]} />
        </Field>
        <Field label="Roller Diameter">
          <SuffixInput value={form.rollDiameter} onChange={(e: any) => f("rollDiameter", e.target.value)} suffix="mm" placeholder="e.g. 220" type="number" />
        </Field>
        <Field label="Roller Width">
          <SuffixInput value={form.rollWidth} onChange={(e: any) => f("rollWidth", e.target.value)} suffix="mm" placeholder="e.g. 1400" type="number" />
        </Field>
        <Field label="Hardness">
          <SuffixInput value={form.hardness} onChange={(e: any) => f("hardness", e.target.value)} suffix="Shore A" placeholder="e.g. 70" type="number" />
        </Field>
      </div>
    </div>
  );
}

function SlitterKnifeSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div>
      <SectionTitle title="Slitter Knife Parameters" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Field label="Compatible Machine">
          <input type="text" value={form.machine} onChange={(e) => f("machine", e.target.value)} placeholder="e.g. SLT-01" className={inputCls} />
        </Field>
        <Field label="Knife Type">
          <Sel value={form.knifeType} onChange={(v) => f("knifeType", v)} options={["Upper Knife", "Lower Knife", "Score Cut", "Razor Blade"]} />
        </Field>
        <Field label="Knife Material">
          <Sel value={form.material} onChange={(v) => f("material", v)} options={["Tungsten Carbide", "HSS (High Speed Steel)", "Ceramic"]} />
        </Field>
        <Field label="Knife Diameter">
          <SuffixInput value={form.knifeDiameter} onChange={(e: any) => f("knifeDiameter", e.target.value)} suffix="mm" placeholder="e.g. 150" type="number" />
        </Field>
        <Field label="Knife Thickness">
          <SuffixInput value={form.knifeThickness} onChange={(e: any) => f("knifeThickness", e.target.value)} suffix="mm" placeholder="e.g. 0.4" type="number" />
        </Field>
      </div>
    </div>
  );
}

function SleeveSpecs({ form, f }: { form: any; f: any }) {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle title="Sleeve Dimensions" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Sleeve Width (Internal)">
            <SuffixInput value={form.printWidth} onChange={(e: any) => f("printWidth", e.target.value)} suffix="mm" placeholder="e.g. 640" type="number" />
          </Field>
          <Field label="Sleeve Length">
            <SuffixInput value={form.repeatLength} onChange={(e: any) => f("repeatLength", e.target.value)} suffix="mm" placeholder="e.g. 500" type="number" />
          </Field>
        </div>
      </div>
      <div>
        <SectionTitle title="Material & Finish" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Field label="Sleeve Material">
            <Sel value={form.cylinderMaterial} onChange={(v: string) => f("cylinderMaterial", v)} options={["PVC", "PETG", "OPS", "PE", "Other"]} />
          </Field>
          <Field label="Surface Finish">
            <Sel value={form.surfaceFinish} onChange={(v: string) => f("surfaceFinish", v)} options={["Glossy", "Semi-Gloss", "Matte"]} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function ToolSpecs({ form, f }: { form: any; f: any }) {
  switch (form.toolType) {
    case "Cylinder":          return <CylinderSpecs form={form} f={f} />;
    case "Sleeve":            return <SleeveSpecs form={form} f={f} />;
    case "Die":               return <DieSpecs form={form} f={f} />;
    case "Anilox Roll":       return <AniloxSpecs form={form} f={f} />;
    case "Doctor Blade":      return <DoctorBladeSpecs form={form} f={f} />;
    case "Impression Roller": return <ImpressionRollerSpecs form={form} f={f} />;
    case "Slitter Knife":     return <SlitterKnifeSpecs form={form} f={f} />;
    default: return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────

export default function ToolMasterPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [data, setData] = useState<Tool[]>(initData);
  const [editing, setEditing] = useState<Tool | null>(null);
  const [form, setForm] = useState<Omit<Tool, "id">>(blank);
  const [activeTab, setActiveTab] = useState<"detail" | "specs">("detail");
  const [filterType, setFilterType] = useState<"All" | ToolType>("All");

  const f = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const onToolTypeChange = (t: ToolType) => setForm((p) => ({ ...blank, toolType: t, code: p.code, name: p.name, clientName: p.clientName, location: p.location, status: p.status }));

  const openAdd = () => { setEditing(null); setForm(blank); setActiveTab("detail"); setView("form"); };
  const openEdit = (row: Tool) => {
    setEditing(row);
    const { id, ...rest } = row;
    setForm(rest);
    setActiveTab("detail");
    setView("form");
  };

  const save = () => {
    if (!form.code || !form.name) return;
    if (editing) {
      setData((d) => d.map((r) => r.id === editing.id ? { ...form, id: editing.id } : r));
    } else {
      const n = data.length + 1;
      setData((d) => [...d, { ...form, id: `T${String(n).padStart(3, "0")}` }]);
    }
    setView("list");
  };

  const deleteRow = (id: string) => {
    if (confirm("Delete this tool?")) setData((d) => d.filter((r) => r.id !== id));
  };

  // ── FORM VIEW ─────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">AJ Shrink Wrap Pvt Ltd</p>
            <h2 className="text-xl font-bold text-gray-800">Tool Master</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <List size={16} /> List ({data.length})
            </button>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
              <Plus size={16} /> New
            </button>
            <button onClick={save} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              <Save size={16} /> Save
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 pt-5 border-b border-gray-200 bg-gray-50/30">
            {form.code && <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-full">{form.code}</span>}
            <div className="flex gap-8">
              {(["detail", "specs"] as const).map((t) => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === t ? "text-blue-600 border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
                  {{ detail: "Tool Details", specs: "Specifications" }[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8">

            {/* ── TOOL DETAILS ── */}
            {activeTab === "detail" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                {/* Tool Type selector */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Tool Type <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {TOOL_TYPES.map((t) => (
                      <button key={t} onClick={() => onToolTypeChange(t)}
                        className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all ${form.toolType === t ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${toolColor[t]}`}>{t}</span>
                        <span className="text-xs text-gray-500 leading-relaxed">{toolDesc[t]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Identity */}
                <div>
                  <SectionTitle title="Tool Identity" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Tool Code" required>
                      <input type="text" value={form.code} onChange={(e) => f("code", e.target.value)} placeholder={form.toolType === "Cylinder" ? "e.g. CYL-P005" : form.toolType === "Die" ? "e.g. DIE-004" : "e.g. TOOL-001"} className={inputCls} />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Tool Name / Description" required>
                        <input type="text" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder={form.toolType === "Cylinder" ? "e.g. Parle-G 100g – Back Print – 8C" : form.toolType === "Die" ? "e.g. 3-Side Seal Pouch Die – Parle 100g" : "e.g. Tool name"} className={inputCls} />
                      </Field>
                    </div>
                  </div>
                </div>

                {/* Job / Client (show for Cylinder & Die) */}
                {(form.toolType === "Cylinder" || form.toolType === "Die") && (
                  <div>
                    <SectionTitle title="Client & Job" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Field label="Client Name">
                        <input type="text" value={form.clientName} onChange={(e) => f("clientName", e.target.value)} placeholder="e.g. Parle Products Pvt Ltd" className={inputCls} />
                      </Field>
                      <Field label="Job Card No">
                        <input type="text" value={form.jobCardNo} onChange={(e) => f("jobCardNo", e.target.value)} placeholder="e.g. JC-2024-050" className={inputCls} />
                      </Field>
                      <Field label="Job Name">
                        <input type="text" value={form.jobName} onChange={(e) => f("jobName", e.target.value)} placeholder="e.g. Parle-G 100g Wrap" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Common fields */}
                <div>
                  <SectionTitle title="Storage & Classification" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Storage Location">
                      <input type="text" value={form.location} onChange={(e) => f("location", e.target.value)} placeholder="e.g. Rack A-1, Die Store-1" className={inputCls} />
                    </Field>
                    <Field label="HSN Code">
                      <input type="text" value={form.hsnCode} onChange={(e) => f("hsnCode", e.target.value)} placeholder="e.g. 8207" className={inputCls} />
                    </Field>
                    <Field label="Category">
                      <input type="text" value={form.category} onChange={(e) => f("category", e.target.value)} placeholder="e.g. Printing Tool" className={inputCls} />
                    </Field>
                    <Field label="Purchase Unit">
                      <Sel value={form.purchaseUnit} onChange={(v) => f("purchaseUnit", v)} options={["Nos", "Set", "Roll", "Box", "Kg"]} />
                    </Field>
                    <Field label="Stock Unit">
                      <Sel value={form.stockUnit} onChange={(v) => f("stockUnit", v)} options={["Nos", "Set", "Roll", "Box", "Kg"]} />
                    </Field>
                    <Field label="Status">
                      <Sel value={form.status} onChange={(v) => f("status", v)} options={["Active", "Inactive", "In Use", "Under Maintenance", "Damaged"]} />
                    </Field>
                  </div>
                </div>

                <Field label="Remarks">
                  <textarea value={form.description} onChange={(e) => f("description", e.target.value)} placeholder="Any notes..." rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
                </Field>

                {/* Footer */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <button onClick={() => setActiveTab("specs")} className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors shadow-sm">
                    Specifications →
                  </button>
                </div>
              </div>
            )}

            {/* ── SPECIFICATIONS ── */}
            {activeTab === "specs" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                {/* Type badge */}
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${toolColor[form.toolType as ToolType]}`}>{form.toolType}</span>

                <ToolSpecs form={form} f={f} />

                {/* Footer */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button onClick={() => setForm(blank)} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab("detail")} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">← Details</button>
                    <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                      <Check size={16} /> Save Tool
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────
  const filteredData = filterType === "All" ? data : data.filter((r) => r.toolType === filterType);

  const columns: Column<Tool>[] = [
    { key: "code", header: "Code", sortable: true },
    { key: "name", header: "Tool Name", sortable: true },
    { key: "toolType", header: "Type", sortable: true, render: (r) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${toolColor[r.toolType]}`}>{r.toolType}</span>
    )},
    { key: "clientName", header: "Client" },
    { key: "location", header: "Location" },
    { key: "status", header: "Status", sortable: true, render: (r) => {
      const c = { Active: "bg-green-100 text-green-700", "In Use": "bg-blue-100 text-blue-700", Inactive: "bg-gray-100 text-gray-500", Damaged: "bg-red-100 text-red-700", "Under Maintenance": "bg-amber-100 text-amber-700" }[r.status] ?? "bg-gray-100 text-gray-500";
      return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c}`}>{r.status}</span>;
    }},
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Tool Master</h2>
          <p className="text-sm text-gray-500">{filteredData.length} of {data.length} tools</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={16} /> Add Tool
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Type</span>
          {(["All", ...TOOL_TYPES] as const).map((t) => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {t === "All" ? "All Types" : t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <DataTable data={filteredData} columns={columns} searchKeys={["name", "code", "clientName", "location", "jobName"]}
          actions={(row) => (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(row)}>Edit</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteRow(row.id)}>Delete</Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
