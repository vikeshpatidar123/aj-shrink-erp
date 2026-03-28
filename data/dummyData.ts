// ============================================================
// AJ Shrink ERP – Complete Dummy Data (v2)
// Flexible Packaging: Extrusion + Rotogravure
// ============================================================

// ─── UTILITY ────────────────────────────────────────────────
export function calcGSM(micron: number, density: number): number {
  return parseFloat((micron * density).toFixed(3));
}
export function weightedAvg(items: { percentage: number; value: number }[]): number {
  const total = items.reduce((s, m) => s + m.percentage, 0) || 100;
  return parseFloat(items.reduce((s, m) => s + (m.percentage / total) * m.value, 0).toFixed(4));
}

// ─── MASTER TYPES ────────────────────────────────────────────

export type SubGroup = {
  id: string; name: string; category: string; group: string; description: string;
};

export type CategoryPlyConsumable = {
  id: string;
  plyType: string;           // "Film" | "Printing" | "Lamination" | "Coating"
  itemGroup: string;         // "Film" | "Ink" | "Solvent" | "Adhesive" | "Hardner"
  itemSubGroup: string;      // e.g. "Solvent Based Ink", "PU Adhesive"
  fieldDisplayName: string;  // label shown in estimation
  defaultValue: number;
  minValue: number;
  maxValue: number;
  sharePercentageFormula: string;
};

export type PlyConsumableItem = {
  consumableId: string;      // links to CategoryPlyConsumable.id
  fieldDisplayName: string;
  itemGroup: string;
  itemSubGroup: string;
  itemId: string;
  itemName: string;
  gsm: number;
  rate: number;
  coveragePct?: number;      // ink coverage % (0–100), only for Ink items
};

export type CategoryMaster = {
  id: string; name: string; description: string; status: "Active" | "Inactive";
  contents?: string[];
  plyConsumables?: CategoryPlyConsumable[];
};

export const categories: CategoryMaster[] = [
  {
    id: "CAT001",
    name: "Flexible Packaging",
    description: "Sabse common gravure printing — pouches, roll form, center seal",
    status: "Active",
    contents: [
      "Pouch — 3 Side Seal",
      "Pouch — Center Seal",
      "Standup Pouch",
      "Zipper Pouch",
      "Roll Form — Milk",
      "Roll Form — Oil",
      "Roll Form — Snacks",
    ],
    plyConsumables: [
      { id: "PC001", plyType: "Printing",   itemGroup: "Ink",      itemSubGroup: "Solvent Based Ink",   fieldDisplayName: "Ink Wet Weight",      defaultValue: 3.5, minValue: 1,   maxValue: 8,   sharePercentageFormula: "" },
      { id: "PC002", plyType: "Printing",   itemGroup: "Solvent",  itemSubGroup: "Ethyl Acetate (EA)",  fieldDisplayName: "Solvent",             defaultValue: 2.0, minValue: 0.5, maxValue: 5,   sharePercentageFormula: "" },
      { id: "PC003", plyType: "Lamination", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive",         fieldDisplayName: "Adhesive Wet Weight", defaultValue: 3.5, minValue: 2,   maxValue: 6,   sharePercentageFormula: "" },
      { id: "PC004", plyType: "Lamination", itemGroup: "Hardner",  itemSubGroup: "PU Hardener",         fieldDisplayName: "Hardener",            defaultValue: 0.7, minValue: 0.3, maxValue: 1.5, sharePercentageFormula: "" },
    ],
  },
  {
    id: "CAT002",
    name: "Laminates",
    description: "Multi-layer laminate structures — PET, BOPP, MET PET combinations",
    status: "Active",
    contents: [
      "PET + PE",
      "BOPP + CPP",
      "PET + MET PET + PE",
      "BOPP + BOPP",
      "PET + AL Foil + PE",
      "BOPP + MET BOPP",
    ],
    plyConsumables: [
      { id: "PC005", plyType: "Printing",   itemGroup: "Ink",      itemSubGroup: "Solvent Based Ink",   fieldDisplayName: "Ink Wet Weight",      defaultValue: 3.5, minValue: 1,   maxValue: 8,   sharePercentageFormula: "" },
      { id: "PC006", plyType: "Printing",   itemGroup: "Solvent",  itemSubGroup: "Ethyl Acetate (EA)",  fieldDisplayName: "Solvent",             defaultValue: 2.0, minValue: 0.5, maxValue: 5,   sharePercentageFormula: "" },
      { id: "PC007", plyType: "Lamination", itemGroup: "Adhesive", itemSubGroup: "Lamination Adhesive", fieldDisplayName: "Adhesive Wet Weight", defaultValue: 4.0, minValue: 2,   maxValue: 7,   sharePercentageFormula: "" },
      { id: "PC008", plyType: "Lamination", itemGroup: "Hardner",  itemSubGroup: "Adhesive Hardener",   fieldDisplayName: "Hardener",            defaultValue: 0.8, minValue: 0.3, maxValue: 1.5, sharePercentageFormula: "" },
    ],
  },
  {
    id: "CAT003",
    name: "Labels & Stickers",
    description: "Gravure printed labels — shrink sleeves, wrap around labels",
    status: "Active",
    contents: [
      "Shrink Labels",
      "Wrap Around Labels",
      "Cut & Stack Labels",
      "In-Mould Labels",
    ],
    plyConsumables: [
      { id: "PC009", plyType: "Printing", itemGroup: "Ink",     itemSubGroup: "Solvent Based Ink",  fieldDisplayName: "Ink Wet Weight", defaultValue: 3.0, minValue: 1,   maxValue: 7,   sharePercentageFormula: "" },
      { id: "PC010", plyType: "Printing", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", fieldDisplayName: "Solvent",        defaultValue: 1.8, minValue: 0.5, maxValue: 4,   sharePercentageFormula: "" },
    ],
  },
  {
    id: "CAT004",
    name: "Industrial Packaging",
    description: "Heavy duty packaging — fertilizer, cement, chemical",
    status: "Active",
    contents: [
      "Fertilizer Bags",
      "Cement Liner",
      "Chemical Packaging",
      "FIBC / Jumbo Bags",
      "Woven Sack Liner",
    ],
    plyConsumables: [
      { id: "PC011", plyType: "Printing",   itemGroup: "Ink",      itemSubGroup: "Solvent Based Ink",   fieldDisplayName: "Ink Wet Weight",      defaultValue: 4.0, minValue: 2,   maxValue: 9,   sharePercentageFormula: "" },
      { id: "PC012", plyType: "Printing",   itemGroup: "Solvent",  itemSubGroup: "Ethyl Acetate (EA)",  fieldDisplayName: "Solvent",             defaultValue: 2.5, minValue: 1,   maxValue: 6,   sharePercentageFormula: "" },
      { id: "PC013", plyType: "Lamination", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive",         fieldDisplayName: "Adhesive Wet Weight", defaultValue: 4.5, minValue: 3,   maxValue: 8,   sharePercentageFormula: "" },
      { id: "PC014", plyType: "Lamination", itemGroup: "Hardner",  itemSubGroup: "PU Hardener",         fieldDisplayName: "Hardener",            defaultValue: 0.9, minValue: 0.4, maxValue: 2.0, sharePercentageFormula: "" },
    ],
  },
];

export type Customer = {
  id: string; code: string; name: string; contact: string; phone: string;
  email: string; city: string; state: string; gst: string;
  status: "Active" | "Inactive"; createdAt: string;
};

export type RawMaterial = {
  id: string; code: string; name: string; type: string;
  category: "Polymer" | "Ink" | "Chemical" | "Additive" | "Packing Material";
  subGroupId: string; subGroupName: string;
  unit: string; stockUnit: string; purchaseUnit: string;
  density: number; gsm: number;
  currentStock: number; reorderLevel: number; rate: number;
  supplier: string; status: "Active" | "Inactive";
};

export type RollMaster = {
  id: string; code: string; name: string;
  width: number; thickness: number; density: number; micron: number;
  stockUnit: string; purchaseUnit: string; description: string;
  jobName?: string;
  status: "Active" | "Inactive";
};

export type RecipeLayerMaterial = {
  rawMaterialId: string; rawMaterialName: string;
  percentage: number; density: number; rate: number;
};

export type RecipeLayer = {
  layerNo: number; name: string;
  materials: RecipeLayerMaterial[];
  blendDensity: number; blendRate: number;
};

export type Recipe = {
  id: string; code: string; name: string; description: string;
  layers: RecipeLayer[];
  status: "Active" | "Inactive"; createdAt: string;
  itemGroup?: string;
  subGroup?: string;
  clientId?: string;
  micronFrom?: number;
  micronTo?: number;
  layerRatio?: string;
  rollMasterId?: string;
};

// ─── TOOL MASTER ─────────────────────────────────────────────
export type ToolType = "Cylinder" | "Sleeve" | "Die" | "Anilox Roll" | "Doctor Blade" | "Impression Roller" | "Slitter Knife";

export type Tool = {
  id: string; code: string; name: string; toolType: ToolType;
  clientName: string; jobCardNo: string; jobName: string;
  location: string; hsnCode: string; purchaseUnit: string; stockUnit: string;
  category: string; description: string; status: "Active" | "Inactive";
  // Cylinder
  repeatLength: string; printWidth: string; noOfColors: string; colorName: string;
  engravingType: string; screen: string; engravingAngle: string; cellDepth: string;
  cylinderMaterial: string; surfaceFinish: string; chromeStatus: string;
  // Die
  toolPrefix: string; toolRefCode: string; dieType: string;
  length: string; width: string; height: string; upsL: string; upsW: string; totalUps: string;
  // Anilox Roll
  machine: string; deckNo: string; lineCount: string; volume: string;
  rollWidth: string; rollDiameter: string; aniloxEngravingType: string; aniloxMaterial: string;
  // Doctor Blade / Impression Roller / Slitter Knife
  material: string; bladeWidth: string; bladeThickness: string; bladeLength: string;
  hardness: string; knifeType: string; knifeDiameter: string; knifeThickness: string;
};

const bt = { clientName: "", jobCardNo: "", jobName: "", location: "", hsnCode: "", purchaseUnit: "Nos", stockUnit: "Nos", category: "", description: "", status: "Active" as const, repeatLength: "", printWidth: "", noOfColors: "", colorName: "", engravingType: "", screen: "", engravingAngle: "", cellDepth: "", cylinderMaterial: "", surfaceFinish: "", chromeStatus: "", toolPrefix: "", toolRefCode: "", dieType: "", length: "", width: "", height: "", upsL: "", upsW: "", totalUps: "", machine: "", deckNo: "", lineCount: "", volume: "", rollWidth: "", rollDiameter: "", aniloxEngravingType: "", aniloxMaterial: "", material: "", bladeWidth: "", bladeThickness: "", bladeLength: "", hardness: "", knifeType: "", knifeDiameter: "", knifeThickness: "" };

export const tools: Tool[] = [
  // Cylinders
  { id: "T001", code: "CYL-P001", name: "Parle Biscuit – Back Print – 8C", toolType: "Cylinder", ...bt, clientName: "Parle Products Pvt Ltd", jobCardNo: "JC-2024-001", jobName: "Parle-G 100g Wrap", location: "Rack A-1", noOfColors: "8", repeatLength: "450", printWidth: "1100", engravingType: "Electromechanical", screen: "70", engravingAngle: "45", cellDepth: "32", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated" },
  { id: "T002", code: "CYL-B001", name: "Britannia – Surface Print – 6C", toolType: "Cylinder", ...bt, clientName: "Britannia Industries Ltd", jobCardNo: "JC-2024-015", jobName: "Britannia NutriChoice 200g", location: "Rack A-2", noOfColors: "6", repeatLength: "400", printWidth: "1050", engravingType: "Electromechanical", screen: "60", engravingAngle: "45", cellDepth: "28", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated" },
  { id: "T003", code: "CYL-H001", name: "Haldiram – Combo Print – 9C", toolType: "Cylinder", ...bt, clientName: "Haldiram Snacks Pvt Ltd", jobCardNo: "JC-2024-022", jobName: "Haldiram Bhujia 200g Pouch", location: "Rack B-1", noOfColors: "9", repeatLength: "480", printWidth: "1200", engravingType: "Electromechanical", screen: "70", engravingAngle: "45", cellDepth: "30", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Needs Re-chrome" },
  { id: "T004", code: "CYL-A001", name: "Amul – Shrink Sleeve – 6C", toolType: "Cylinder", ...bt, clientName: "Amul Dairy", jobCardNo: "JC-2024-031", jobName: "Amul Butter Shrink Sleeve", location: "Rack B-2", noOfColors: "6", repeatLength: "360", printWidth: "800", engravingType: "Laser", screen: "80", engravingAngle: "45", cellDepth: "25", cylinderMaterial: "Aluminium", surfaceFinish: "Chrome Plated", chromeStatus: "Plated" },
  // Dies
  { id: "T005", code: "DIE-001", name: "3-Side Seal Pouch Die – Parle", toolType: "Die", ...bt, clientName: "Parle Products Pvt Ltd", jobName: "Parle-G 100g", toolPrefix: "3SS", toolRefCode: "DIE-REF-001", dieType: "Flat Die", length: "200", width: "130", height: "25", upsL: "4", upsW: "2", totalUps: "8", location: "Die Store-1", hsnCode: "8207", purchaseUnit: "Nos", stockUnit: "Nos" },
  { id: "T006", code: "DIE-002", name: "Stand-up Pouch Die – Haldiram", toolType: "Die", ...bt, clientName: "Haldiram Snacks Pvt Ltd", jobName: "Bhujia 200g SUP", toolPrefix: "SUP", toolRefCode: "DIE-REF-002", dieType: "Rotary Die", length: "280", width: "180", height: "30", upsL: "2", upsW: "2", totalUps: "4", location: "Die Store-1", hsnCode: "8207", purchaseUnit: "Nos", stockUnit: "Nos" },
  { id: "T007", code: "DIE-003", name: "4-Side Seal Die – ITC", toolType: "Die", ...bt, clientName: "ITC Limited", jobName: "ITC Bingo 50g", toolPrefix: "4SS", toolRefCode: "DIE-REF-003", dieType: "Steel Rule Die", length: "180", width: "120", height: "20", upsL: "3", upsW: "2", totalUps: "6", location: "Die Store-2", hsnCode: "8207", purchaseUnit: "Nos", stockUnit: "Nos" },
  // Anilox Rolls
  { id: "T008", code: "ANX-001", name: "Coating Anilox – ROTO-01 Deck 9", toolType: "Anilox Roll", ...bt, machine: "ROTO-01", deckNo: "Deck 9 (Coating)", lineCount: "140", volume: "4.5", rollWidth: "1400", rollDiameter: "140", aniloxEngravingType: "Hexagonal", aniloxMaterial: "Ceramic", location: "Press Room – ROTO-01" },
  { id: "T009", code: "ANX-002", name: "Varnish Anilox – ROTO-03 Deck 11", toolType: "Anilox Roll", ...bt, machine: "ROTO-03", deckNo: "Deck 11 (OPV)", lineCount: "180", volume: "3.0", rollWidth: "1650", rollDiameter: "160", aniloxEngravingType: "Tri-helical", aniloxMaterial: "Ceramic", location: "Press Room – ROTO-03" },
  // Doctor Blades
  { id: "T010", code: "DB-001", name: "Steel Doctor Blade – ROTO-01", toolType: "Doctor Blade", ...bt, machine: "ROTO-01", material: "Steel", bladeWidth: "60", bladeThickness: "0.15", bladeLength: "1400", location: "Consumables Store" },
  { id: "T011", code: "DB-002", name: "Composite Blade – ROTO-02", toolType: "Doctor Blade", ...bt, machine: "ROTO-02", material: "Composite", bladeWidth: "60", bladeThickness: "0.20", bladeLength: "1500", location: "Consumables Store" },
  // Impression Rollers
  { id: "T012", code: "IR-001", name: "Rubber Impression Roller – ROTO-01", toolType: "Impression Roller", ...bt, machine: "ROTO-01", material: "Rubber", rollDiameter: "220", rollWidth: "1400", hardness: "70", location: "Press Room – ROTO-01" },
  { id: "T013", code: "IR-002", name: "PU Impression Roller – ROTO-03", toolType: "Impression Roller", ...bt, machine: "ROTO-03", material: "Polyurethane", rollDiameter: "240", rollWidth: "1650", hardness: "75", location: "Press Room – ROTO-03" },
  // Slitter Knives
  { id: "T014", code: "SK-001", name: "Upper Knife Set – SLT-01", toolType: "Slitter Knife", ...bt, machine: "SLT-01", knifeType: "Upper Knife", material: "Tungsten Carbide", knifeDiameter: "150", knifeThickness: "0.4", location: "Slitter Store" },
  { id: "T015", code: "SK-002", name: "Lower Knife Set – SLT-02", toolType: "Slitter Knife", ...bt, machine: "SLT-02", knifeType: "Lower Knife", material: "HSS", knifeDiameter: "120", knifeThickness: "1.0", location: "Slitter Store" },
  // Additional Cylinders (various print widths for planning coverage)
  { id: "T016", code: "CYL-NAR-001", name: "Narrow Cylinder 500mm", toolType: "Cylinder", ...bt, printWidth: "500", repeatLength: "350", noOfColors: "4", engravingType: "Electromechanical", screen: "60", engravingAngle: "45", cellDepth: "28", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack C-1" },
  { id: "T017", code: "CYL-MED-001", name: "Medium Cylinder 700mm", toolType: "Cylinder", ...bt, printWidth: "700", repeatLength: "400", noOfColors: "6", engravingType: "Electromechanical", screen: "65", engravingAngle: "45", cellDepth: "30", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack C-2" },
  { id: "T021", code: "CYL-WID-001", name: "Wide Cylinder 1350mm", toolType: "Cylinder", ...bt, printWidth: "1350", repeatLength: "500", noOfColors: "8", engravingType: "Electromechanical", screen: "70", engravingAngle: "45", cellDepth: "32", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack D-1" },
  { id: "T022", code: "CYL-XWD-001", name: "Extra-Wide Cylinder 1500mm", toolType: "Cylinder", ...bt, printWidth: "1500", repeatLength: "550", noOfColors: "10", engravingType: "Laser", screen: "80", engravingAngle: "45", cellDepth: "25", cylinderMaterial: "Aluminium", surfaceFinish: "Chrome Plated", chromeStatus: "Plated", location: "Rack D-2" },
  { id: "T035", code: "CYL-WD2-001", name: "Wide Cylinder 1400mm – Steel", toolType: "Cylinder", ...bt, printWidth: "1400", repeatLength: "480", noOfColors: "8", engravingType: "Electromechanical", screen: "70", engravingAngle: "45", cellDepth: "30", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack D-3" },
  { id: "T036", code: "CYL-WD3-001", name: "Wide Cylinder 1600mm – Aluminium", toolType: "Cylinder", ...bt, printWidth: "1600", repeatLength: "600", noOfColors: "10", engravingType: "Laser", screen: "80", engravingAngle: "45", cellDepth: "25", cylinderMaterial: "Aluminium", surfaceFinish: "Chrome Plated", chromeStatus: "Plated", location: "Rack D-4" },
  { id: "T037", code: "CYL-WD4-001", name: "Wide Cylinder 1700mm – Steel", toolType: "Cylinder", ...bt, printWidth: "1700", repeatLength: "650", noOfColors: "10", engravingType: "Electromechanical", screen: "75", engravingAngle: "45", cellDepth: "32", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack D-5" },
  // Ultra-wide cylinders — no matching sleeve in stock → triggers SPECIAL SLEEVE plans
  { id: "T046", code: "CYL-UWD-001", name: "Ultra-Wide Cylinder 2500mm – Steel", toolType: "Cylinder", ...bt, printWidth: "2500", repeatLength: "700", noOfColors: "10", engravingType: "Electromechanical", screen: "75", engravingAngle: "45", cellDepth: "32", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack E-1" },
  { id: "T047", code: "CYL-UWD-002", name: "Ultra-Wide Cylinder 3200mm – Steel", toolType: "Cylinder", ...bt, printWidth: "3200", repeatLength: "800", noOfColors: "10", engravingType: "Electromechanical", screen: "75", engravingAngle: "45", cellDepth: "34", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack E-2" },
  // Fill gap: 1100–1350mm range
  { id: "T038", code: "CYL-WD5-001", name: "Cylinder 1150mm – Steel", toolType: "Cylinder", ...bt, printWidth: "1150", repeatLength: "460", noOfColors: "8", engravingType: "Electromechanical", screen: "70", engravingAngle: "45", cellDepth: "30", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack C-3" },
  { id: "T039", code: "CYL-WD6-001", name: "Cylinder 1200mm – Steel", toolType: "Cylinder", ...bt, printWidth: "1200", repeatLength: "470", noOfColors: "8", engravingType: "Electromechanical", screen: "70", engravingAngle: "45", cellDepth: "30", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack C-4" },
  { id: "T040", code: "CYL-WD7-001", name: "Cylinder 1250mm – Aluminium", toolType: "Cylinder", ...bt, printWidth: "1250", repeatLength: "475", noOfColors: "8", engravingType: "Laser", screen: "75", engravingAngle: "45", cellDepth: "27", cylinderMaterial: "Aluminium", surfaceFinish: "Chrome Plated", chromeStatus: "Plated", location: "Rack C-5" },
  { id: "T041", code: "CYL-WD8-001", name: "Cylinder 1300mm – Steel", toolType: "Cylinder", ...bt, printWidth: "1300", repeatLength: "490", noOfColors: "8", engravingType: "Electromechanical", screen: "70", engravingAngle: "45", cellDepth: "31", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack C-6" },
  // Fill gap: 800–1050mm range
  { id: "T042", code: "CYL-MED2-001", name: "Cylinder 900mm – Steel", toolType: "Cylinder", ...bt, printWidth: "900", repeatLength: "420", noOfColors: "6", engravingType: "Electromechanical", screen: "65", engravingAngle: "45", cellDepth: "28", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack C-7" },
  { id: "T043", code: "CYL-MED3-001", name: "Cylinder 950mm – Steel", toolType: "Cylinder", ...bt, printWidth: "950", repeatLength: "430", noOfColors: "6", engravingType: "Electromechanical", screen: "65", engravingAngle: "45", cellDepth: "29", cylinderMaterial: "Steel", surfaceFinish: "Hard Chrome", chromeStatus: "Plated", location: "Rack C-8" },
  // Sleeves (printWidth = sleeve internal/usable width in mm)
  { id: "T025", code: "SLV-001", name: "Sleeve 320mm – PVC", toolType: "Sleeve", ...bt, printWidth: "320", cylinderMaterial: "PVC", engravingType: "N/A", surfaceFinish: "Glossy", chromeStatus: "N/A", location: "Sleeve Store – Rack A" },
  { id: "T026", code: "SLV-002", name: "Sleeve 420mm – PVC", toolType: "Sleeve", ...bt, printWidth: "420", cylinderMaterial: "PVC", engravingType: "N/A", surfaceFinish: "Glossy", chromeStatus: "N/A", location: "Sleeve Store – Rack A" },
  { id: "T027", code: "SLV-003", name: "Sleeve 530mm – PETG", toolType: "Sleeve", ...bt, printWidth: "530", cylinderMaterial: "PETG", engravingType: "N/A", surfaceFinish: "Semi-Gloss", chromeStatus: "N/A", location: "Sleeve Store – Rack B" },
  { id: "T028", code: "SLV-004", name: "Sleeve 640mm – PETG", toolType: "Sleeve", ...bt, printWidth: "640", cylinderMaterial: "PETG", engravingType: "N/A", surfaceFinish: "Semi-Gloss", chromeStatus: "N/A", location: "Sleeve Store – Rack B" },
  { id: "T029", code: "SLV-005", name: "Sleeve 740mm – OPS", toolType: "Sleeve", ...bt, printWidth: "740", cylinderMaterial: "OPS", engravingType: "N/A", surfaceFinish: "Glossy", chromeStatus: "N/A", location: "Sleeve Store – Rack C" },
  { id: "T030", code: "SLV-006", name: "Sleeve 880mm – PVC", toolType: "Sleeve", ...bt, printWidth: "880", cylinderMaterial: "PVC", engravingType: "N/A", surfaceFinish: "Glossy", chromeStatus: "N/A", location: "Sleeve Store – Rack C" },
  { id: "T031", code: "SLV-007", name: "Sleeve 1000mm – PETG", toolType: "Sleeve", ...bt, printWidth: "1000", cylinderMaterial: "PETG", engravingType: "N/A", surfaceFinish: "Semi-Gloss", chromeStatus: "N/A", location: "Sleeve Store – Rack D" },
  { id: "T032", code: "SLV-008", name: "Sleeve 1130mm – OPS", toolType: "Sleeve", ...bt, printWidth: "1130", cylinderMaterial: "OPS", engravingType: "N/A", surfaceFinish: "Matte", chromeStatus: "N/A", location: "Sleeve Store – Rack D" },
  { id: "T033", code: "SLV-009", name: "Sleeve 1280mm – PVC", toolType: "Sleeve", ...bt, printWidth: "1280", cylinderMaterial: "PVC", engravingType: "N/A", surfaceFinish: "Glossy", chromeStatus: "N/A", location: "Sleeve Store – Rack E" },
  { id: "T034", code: "SLV-010", name: "Sleeve 1430mm – PETG", toolType: "Sleeve", ...bt, printWidth: "1430", cylinderMaterial: "PETG", engravingType: "N/A", surfaceFinish: "Semi-Gloss", chromeStatus: "N/A", location: "Sleeve Store – Rack E" },
  // Extra-wide sleeves — require Special-Order cylinders (no stock cylinder ≥ 1800mm exists)
  { id: "T044", code: "SLV-011", name: "Sleeve 1800mm – PVC", toolType: "Sleeve", ...bt, printWidth: "1800", cylinderMaterial: "PVC", engravingType: "N/A", surfaceFinish: "Glossy", chromeStatus: "N/A", location: "Sleeve Store – Rack F" },
  { id: "T045", code: "SLV-012", name: "Sleeve 2000mm – PETG", toolType: "Sleeve", ...bt, printWidth: "2000", cylinderMaterial: "PETG", engravingType: "N/A", surfaceFinish: "Semi-Gloss", chromeStatus: "N/A", location: "Sleeve Store – Rack F" },
];

// ─── Tool Inventory ───────────────────────────────────────
export type ToolInventory = {
  id: string; code: string;
  toolId: string; toolCode: string; toolName: string; toolType: ToolType;
  serialNo: string;
  condition: "New" | "Good" | "Fair" | "Worn";
  status: "Available" | "In Use" | "Under Maintenance" | "Retired";
  location: string; remarks: string;
};

export const toolInventory: ToolInventory[] = [
  // Existing Cylinders
  { id: "TI001", code: "INV-T001-A", toolId: "T001", toolCode: "CYL-P001", toolName: "Parle Biscuit – Back Print – 8C", toolType: "Cylinder", serialNo: "SN-CYL-001", condition: "Good", status: "Available", location: "Rack A-1", remarks: "" },
  { id: "TI002", code: "INV-T002-A", toolId: "T002", toolCode: "CYL-B001", toolName: "Britannia – Surface Print – 6C", toolType: "Cylinder", serialNo: "SN-CYL-002", condition: "Good", status: "Available", location: "Rack A-2", remarks: "" },
  { id: "TI003", code: "INV-T003-A", toolId: "T003", toolCode: "CYL-H001", toolName: "Haldiram – Combo Print – 9C", toolType: "Cylinder", serialNo: "SN-CYL-003", condition: "Fair", status: "Under Maintenance", location: "Rack B-1", remarks: "Needs re-chrome" },
  { id: "TI004", code: "INV-T004-A", toolId: "T004", toolCode: "CYL-A001", toolName: "Amul – Shrink Sleeve – 6C", toolType: "Cylinder", serialNo: "SN-CYL-004", condition: "Good", status: "Available", location: "Rack B-2", remarks: "" },
  // New Cylinders
  { id: "TI016", code: "INV-T016-A", toolId: "T016", toolCode: "CYL-NAR-001", toolName: "Narrow Cylinder 500mm", toolType: "Cylinder", serialNo: "SN-CYL-016", condition: "New", status: "Available", location: "Rack C-1", remarks: "" },
  { id: "TI017", code: "INV-T017-A", toolId: "T017", toolCode: "CYL-MED-001", toolName: "Medium Cylinder 700mm", toolType: "Cylinder", serialNo: "SN-CYL-017", condition: "New", status: "Available", location: "Rack C-2", remarks: "" },
  { id: "TI021", code: "INV-T021-A", toolId: "T021", toolCode: "CYL-WID-001", toolName: "Wide Cylinder 1350mm", toolType: "Cylinder", serialNo: "SN-CYL-021", condition: "New", status: "Available", location: "Rack D-1", remarks: "" },
  { id: "TI022", code: "INV-T022-A", toolId: "T022", toolCode: "CYL-XWD-001", toolName: "Extra-Wide Cylinder 1500mm", toolType: "Cylinder", serialNo: "SN-CYL-022", condition: "New", status: "Available", location: "Rack D-2", remarks: "" },
  { id: "TI035", code: "INV-T035-A", toolId: "T035", toolCode: "CYL-WD2-001", toolName: "Wide Cylinder 1400mm – Steel", toolType: "Cylinder", serialNo: "SN-CYL-035", condition: "New", status: "Available", location: "Rack D-3", remarks: "" },
  { id: "TI036", code: "INV-T036-A", toolId: "T036", toolCode: "CYL-WD3-001", toolName: "Wide Cylinder 1600mm – Aluminium", toolType: "Cylinder", serialNo: "SN-CYL-036", condition: "New", status: "Available", location: "Rack D-4", remarks: "" },
  { id: "TI037", code: "INV-T037-A", toolId: "T037", toolCode: "CYL-WD4-001", toolName: "Wide Cylinder 1700mm – Steel", toolType: "Cylinder", serialNo: "SN-CYL-037", condition: "New", status: "Available", location: "Rack D-5", remarks: "" },
  { id: "TI038", code: "INV-T038-A", toolId: "T038", toolCode: "CYL-WD5-001", toolName: "Cylinder 1150mm – Steel", toolType: "Cylinder", serialNo: "SN-CYL-038", condition: "New", status: "Available", location: "Rack C-3", remarks: "" },
  { id: "TI039", code: "INV-T039-A", toolId: "T039", toolCode: "CYL-WD6-001", toolName: "Cylinder 1200mm – Steel", toolType: "Cylinder", serialNo: "SN-CYL-039", condition: "New", status: "Available", location: "Rack C-4", remarks: "" },
  { id: "TI040", code: "INV-T040-A", toolId: "T040", toolCode: "CYL-WD7-001", toolName: "Cylinder 1250mm – Aluminium", toolType: "Cylinder", serialNo: "SN-CYL-040", condition: "New", status: "Available", location: "Rack C-5", remarks: "" },
  { id: "TI041", code: "INV-T041-A", toolId: "T041", toolCode: "CYL-WD8-001", toolName: "Cylinder 1300mm – Steel", toolType: "Cylinder", serialNo: "SN-CYL-041", condition: "New", status: "Available", location: "Rack C-6", remarks: "" },
  { id: "TI042", code: "INV-T042-A", toolId: "T042", toolCode: "CYL-MED2-001", toolName: "Cylinder 900mm – Steel", toolType: "Cylinder", serialNo: "SN-CYL-042", condition: "New", status: "Available", location: "Rack C-7", remarks: "" },
  { id: "TI043", code: "INV-T043-A", toolId: "T043", toolCode: "CYL-MED3-001", toolName: "Cylinder 950mm – Steel", toolType: "Cylinder", serialNo: "SN-CYL-043", condition: "New", status: "Available", location: "Rack C-8", remarks: "" },
  // Sleeves
  { id: "TI025", code: "INV-SLV-001", toolId: "T025", toolCode: "SLV-001", toolName: "Sleeve 320mm – PVC", toolType: "Sleeve", serialNo: "SN-SLV-001", condition: "Good", status: "Available", location: "Sleeve Store – Rack A", remarks: "" },
  { id: "TI026", code: "INV-SLV-002", toolId: "T026", toolCode: "SLV-002", toolName: "Sleeve 420mm – PVC", toolType: "Sleeve", serialNo: "SN-SLV-002", condition: "Good", status: "Available", location: "Sleeve Store – Rack A", remarks: "" },
  { id: "TI027", code: "INV-SLV-003", toolId: "T027", toolCode: "SLV-003", toolName: "Sleeve 530mm – PETG", toolType: "Sleeve", serialNo: "SN-SLV-003", condition: "New", status: "Available", location: "Sleeve Store – Rack B", remarks: "" },
  { id: "TI028", code: "INV-SLV-004", toolId: "T028", toolCode: "SLV-004", toolName: "Sleeve 640mm – PETG", toolType: "Sleeve", serialNo: "SN-SLV-004", condition: "New", status: "Available", location: "Sleeve Store – Rack B", remarks: "" },
  { id: "TI029", code: "INV-SLV-005", toolId: "T029", toolCode: "SLV-005", toolName: "Sleeve 740mm – OPS", toolType: "Sleeve", serialNo: "SN-SLV-005", condition: "Good", status: "Available", location: "Sleeve Store – Rack C", remarks: "" },
  { id: "TI030", code: "INV-SLV-006", toolId: "T030", toolCode: "SLV-006", toolName: "Sleeve 880mm – PVC", toolType: "Sleeve", serialNo: "SN-SLV-006", condition: "Good", status: "In Use", location: "Press Room – ROTO-01", remarks: "Currently on ROTO-01" },
  { id: "TI031", code: "INV-SLV-007", toolId: "T031", toolCode: "SLV-007", toolName: "Sleeve 1000mm – PETG", toolType: "Sleeve", serialNo: "SN-SLV-007", condition: "Good", status: "Available", location: "Sleeve Store – Rack D", remarks: "" },
  { id: "TI032", code: "INV-SLV-008", toolId: "T032", toolCode: "SLV-008", toolName: "Sleeve 1130mm – OPS", toolType: "Sleeve", serialNo: "SN-SLV-008", condition: "Fair", status: "Available", location: "Sleeve Store – Rack D", remarks: "Minor edge wear" },
  { id: "TI033", code: "INV-SLV-009", toolId: "T033", toolCode: "SLV-009", toolName: "Sleeve 1280mm – PVC", toolType: "Sleeve", serialNo: "SN-SLV-009", condition: "New", status: "Available", location: "Sleeve Store – Rack E", remarks: "" },
  { id: "TI034", code: "INV-SLV-010", toolId: "T034", toolCode: "SLV-010", toolName: "Sleeve 1430mm – PETG", toolType: "Sleeve", serialNo: "SN-SLV-010", condition: "New", status: "Available", location: "Sleeve Store – Rack E", remarks: "" },
  { id: "TI046", code: "INV-T046-A", toolId: "T046", toolCode: "CYL-UWD-001", toolName: "Ultra-Wide Cylinder 2500mm – Steel", toolType: "Cylinder", serialNo: "SN-CYL-046", condition: "New", status: "Available", location: "Rack E-1", remarks: "" },
  { id: "TI047", code: "INV-T047-A", toolId: "T047", toolCode: "CYL-UWD-002", toolName: "Ultra-Wide Cylinder 3200mm – Steel", toolType: "Cylinder", serialNo: "SN-CYL-047", condition: "New", status: "Available", location: "Rack E-2", remarks: "" },
  { id: "TI044", code: "INV-SLV-011", toolId: "T044", toolCode: "SLV-011", toolName: "Sleeve 1800mm – PVC", toolType: "Sleeve", serialNo: "SN-SLV-011", condition: "New", status: "Available", location: "Sleeve Store – Rack F", remarks: "" },
  { id: "TI045", code: "INV-SLV-012", toolId: "T045", toolCode: "SLV-012", toolName: "Sleeve 2000mm – PETG", toolType: "Sleeve", serialNo: "SN-SLV-012", condition: "New", status: "Available", location: "Sleeve Store – Rack F", remarks: "" },
];

// ─── Tool Inventory Transaction Types ────────────────────────

export type ToolCondition = "New" | "Good" | "Fair" | "Worn";
export type ToolStatus    = "Available" | "In Use" | "Under Maintenance" | "Retired";

// Purchase Requisition
export type ToolPRLine = { id: string; toolType: ToolType; description: string; qty: number; purpose: string; };
export type ToolPR = {
  id: string; prNo: string; date: string; department: string;
  requestedBy: string; requiredDate: string;
  lines: ToolPRLine[];
  status: "Draft" | "Approved" | "PO Created";
  remarks: string;
};

// Purchase Order
export type ToolPOLine = { id: string; toolType: ToolType; toolId: string; toolCode: string; toolName: string; qty: number; rate: number; amount: number; };
export type ToolPO = {
  id: string; poNo: string; date: string; supplier: string;
  prRef: string; expectedDate: string;
  lines: ToolPOLine[];
  status: "Draft" | "Confirmed" | "Received";
  remarks: string;
};

// Tool Receipt (GRN)
export type ToolReceiptLine = { id: string; toolId: string; toolCode: string; toolName: string; toolType: ToolType; qty: number; condition: ToolCondition; serialNo: string; location: string; remarks: string; };
export type ToolReceipt = {
  id: string; receiptNo: string; date: string;
  supplier: string; poRef: string; supplierRef: string; receivedBy: string;
  lines: ToolReceiptLine[];
  status: "Draft" | "Completed";
  remarks: string;
};

// Tool Issue
export type ToolIssueLine = { id: string; inventoryId: string; toolId: string; toolCode: string; toolName: string; toolType: ToolType; location: string; remarks: string; };
export type ToolIssue = {
  id: string; issueNo: string; date: string;
  workOrderNo: string; jobRef: string; department: string; issuedTo: string;
  lines: ToolIssueLine[];
  status: "Draft" | "Issued";
  remarks: string;
};

// Tool Return
export type ToolReturnLine = { id: string; inventoryId: string; toolId: string; toolCode: string; toolName: string; toolType: ToolType; conditionOnReturn: ToolCondition; remarks: string; };
export type ToolReturn = {
  id: string; returnNo: string; date: string;
  issueRef: string; returnedBy: string; department: string;
  lines: ToolReturnLine[];
  status: "Draft" | "Completed";
  remarks: string;
};

// Tool Transfer
export type ToolTransferLine = { id: string; inventoryId: string; toolId: string; toolCode: string; toolName: string; toolType: ToolType; fromLocation: string; toLocation: string; remarks: string; };
export type ToolTransfer = {
  id: string; transferNo: string; date: string;
  fromLocation: string; toLocation: string; transferredBy: string;
  lines: ToolTransferLine[];
  status: "Draft" | "Completed";
  remarks: string;
};

// Physical Verification
export type ToolPhysVerLine = { id: string; inventoryId: string; toolId: string; toolCode: string; toolName: string; toolType: ToolType; systemCondition: string; systemStatus: string; verifiedCondition: ToolCondition; verifiedStatus: ToolStatus; remarks: string; };
export type ToolPhysVerification = {
  id: string; verificationNo: string; date: string;
  location: string; verifiedBy: string;
  lines: ToolPhysVerLine[];
  status: "Draft" | "Completed";
  remarks: string;
};

// ─── Tool Inventory Dummy Data ────────────────────────────────

export const toolPRs: ToolPR[] = [
  { id: "TPR001", prNo: "TPR-001", date: "2026-03-01", department: "Printing", requestedBy: "Amit Tiwari", requiredDate: "2026-03-15", status: "Approved", remarks: "Urgent — new job requirements",
    lines: [
      { id: "l1", toolType: "Sleeve", description: "Sleeve 640mm PETG for new pack design", qty: 2, purpose: "New Job" },
      { id: "l2", toolType: "Cylinder", description: "Wide cylinder 1350mm for 8C run", qty: 1, purpose: "Replacement" },
    ],
  },
  { id: "TPR002", prNo: "TPR-002", date: "2026-03-10", department: "Pre-Press", requestedBy: "Mahesh Gupta", requiredDate: "2026-03-25", status: "Draft", remarks: "",
    lines: [
      { id: "l1", toolType: "Cylinder", description: "Narrow cylinder 500mm for flexible job", qty: 1, purpose: "New Job" },
    ],
  },
];

export const toolPOs: ToolPO[] = [
  { id: "TPO001", poNo: "TPO-001", date: "2026-03-05", supplier: "Accurate Cylinders Pvt Ltd", prRef: "TPR-001", expectedDate: "2026-03-20", status: "Confirmed", remarks: "",
    lines: [
      { id: "l1", toolType: "Sleeve", toolId: "T028", toolCode: "SLV-004", toolName: "Sleeve 640mm – PETG", qty: 2, rate: 4500, amount: 9000 },
      { id: "l2", toolType: "Cylinder", toolId: "T021", toolCode: "CYL-WID-001", toolName: "Wide Cylinder 1350mm", qty: 1, rate: 18500, amount: 18500 },
    ],
  },
];

export const toolReceipts: ToolReceipt[] = [
  { id: "TR001", receiptNo: "TR-001", date: "2026-02-15", supplier: "Accurate Cylinders Pvt Ltd", poRef: "", supplierRef: "INV-2026-142", receivedBy: "Mahesh Gupta", status: "Completed", remarks: "All items received in good condition",
    lines: [
      { id: "l1", toolId: "T016", toolCode: "CYL-NAR-001", toolName: "Narrow Cylinder 500mm", toolType: "Cylinder", qty: 1, condition: "New", serialNo: "SN-CYL-016", location: "Rack C-1", remarks: "" },
      { id: "l2", toolId: "T017", toolCode: "CYL-MED-001", toolName: "Medium Cylinder 700mm", toolType: "Cylinder", qty: 1, condition: "New", serialNo: "SN-CYL-017", location: "Rack C-2", remarks: "" },
    ],
  },
  { id: "TR002", receiptNo: "TR-002", date: "2026-03-01", supplier: "Sleeve Solutions Ltd", poRef: "TPO-001", supplierRef: "SL-INV-890", receivedBy: "Deepak Verma", status: "Completed", remarks: "",
    lines: [
      { id: "l1", toolId: "T033", toolCode: "SLV-009", toolName: "Sleeve 1280mm – PVC", toolType: "Sleeve", qty: 1, condition: "New", serialNo: "SN-SLV-009", location: "Sleeve Store – Rack E", remarks: "" },
      { id: "l2", toolId: "T034", toolCode: "SLV-010", toolName: "Sleeve 1430mm – PETG", toolType: "Sleeve", qty: 1, condition: "New", serialNo: "SN-SLV-010", location: "Sleeve Store – Rack E", remarks: "" },
    ],
  },
];

export const toolIssues: ToolIssue[] = [
  { id: "TI-ISS001", issueNo: "TISS-001", date: "2026-03-10", workOrderNo: "GWO001", jobRef: "JC-2024-001", department: "Printing", issuedTo: "Amit Tiwari", status: "Issued", remarks: "Issued for Parle-G production run",
    lines: [
      { id: "l1", inventoryId: "TI001", toolId: "T001", toolCode: "CYL-P001", toolName: "Parle Biscuit – Back Print – 8C", toolType: "Cylinder", location: "Rack A-1", remarks: "" },
      { id: "l2", inventoryId: "TI030", toolId: "T030", toolCode: "SLV-006", toolName: "Sleeve 880mm – PVC", toolType: "Sleeve", location: "Sleeve Store – Rack C", remarks: "" },
    ],
  },
  { id: "TI-ISS002", issueNo: "TISS-002", date: "2026-03-15", workOrderNo: "GWO002", jobRef: "JC-2024-015", department: "Printing", issuedTo: "Deepak Verma", status: "Draft", remarks: "",
    lines: [
      { id: "l1", inventoryId: "TI002", toolId: "T002", toolCode: "CYL-B001", toolName: "Britannia – Surface Print – 6C", toolType: "Cylinder", location: "Rack A-2", remarks: "" },
    ],
  },
];

export const toolReturns: ToolReturn[] = [
  { id: "TRN001", returnNo: "TRET-001", date: "2026-03-12", issueRef: "TISS-001", returnedBy: "Amit Tiwari", department: "Printing", status: "Completed", remarks: "Returned after production. Cylinder OK, sleeve needs inspection.",
    lines: [
      { id: "l1", inventoryId: "TI001", toolId: "T001", toolCode: "CYL-P001", toolName: "Parle Biscuit – Back Print – 8C", toolType: "Cylinder", conditionOnReturn: "Good", remarks: "" },
      { id: "l2", inventoryId: "TI030", toolId: "T030", toolCode: "SLV-006", toolName: "Sleeve 880mm – PVC", toolType: "Sleeve", conditionOnReturn: "Fair", remarks: "Minor edge wear noticed" },
    ],
  },
];

export const toolTransfers: ToolTransfer[] = [
  { id: "TTR001", transferNo: "TTRF-001", date: "2026-03-08", fromLocation: "Rack A-1", toLocation: "Press Room – ROTO-01", transferredBy: "Mahesh Gupta", status: "Completed", remarks: "Moved for production setup",
    lines: [
      { id: "l1", inventoryId: "TI001", toolId: "T001", toolCode: "CYL-P001", toolName: "Parle Biscuit – Back Print – 8C", toolType: "Cylinder", fromLocation: "Rack A-1", toLocation: "Press Room – ROTO-01", remarks: "" },
    ],
  },
];

export const toolPhysVerifications: ToolPhysVerification[] = [
  { id: "TPV001", verificationNo: "TPV-001", date: "2026-03-01", location: "Rack A", verifiedBy: "Mahesh Gupta", status: "Completed", remarks: "Quarterly physical verification — Rack A",
    lines: [
      { id: "l1", inventoryId: "TI001", toolId: "T001", toolCode: "CYL-P001", toolName: "Parle Biscuit – Back Print – 8C", toolType: "Cylinder", systemCondition: "Good", systemStatus: "Available", verifiedCondition: "Good", verifiedStatus: "Available", remarks: "" },
      { id: "l2", inventoryId: "TI002", toolId: "T002", toolCode: "CYL-B001", toolName: "Britannia – Surface Print – 6C", toolType: "Cylinder", systemCondition: "Good", systemStatus: "Available", verifiedCondition: "Fair", verifiedStatus: "Available", remarks: "Surface shows slight wear" },
    ],
  },
];

// Rotogravure flexible packaging departments
export type RotoDept = "Pre-Press" | "Printing" | "Lamination" | "Coating" | "Slitting" | "Pouch Making" | "QC" | "Packing";

export type ProcessModule = "Rotogravure" | "Extrusion";

export type ProcessMaster = {
  id: string; code: string; name: string; displayName: string;
  module: ProcessModule;
  department: RotoDept | string;
  processCategory: "Main Process" | "Sub Process";
  // Costing
  chargeType: string; rate: string; chargeUnit: string;
  minimumCharges: string; minQtyToCharge: string;
  makeSetupCharges: boolean; setupChargeAmount: string;
  processWastePct: string; processWasteFlat: string;
  // Flags
  isOnlineProduction: boolean; displayInQuotation: boolean;
  // Machine allocation
  machineIds: string[];
  description: string; status: "Active" | "Inactive";
};

export type HSNMaster = {
  id: string; hsnCode: string; description: string;
  gstRate: number; category: string;
};

export type Product = {
  id: string; code: string; name: string;
  category: "Extrusion" | "Roto Printing" | "Both";
  unit: string; width: number; thickness: number; gsm: number;
  status: "Active" | "Inactive";
};

export type Machine = {
  id: string; code: string; name: string; displayName: string;
  department: string; machineType: string;
  operator: string; branch: string;
  status: "Running" | "Idle" | "Maintenance";
  isPlanningMachine: boolean;
  // Common
  maxWebWidth: string; minWebWidth: string;
  speedMax: string; speedUnit: string;
  electricConsumption: string; costPerHour: string;
  // Printing (Rotogravure)
  noOfColors: string; repeatLengthMin: string; repeatLengthMax: string;
  gripper: string; printingMargin: string;
  makeReadyWastage: string; makeReadyCharges: string;
  makeReadyTime: string; makeReadyTimeMode: string; makeReadyChargesPerHr: string;
  jobChangeOverTime: string;
  minPrintingImpr: string; basicPrintingCharged: string; roundImpWith: string;
  // Lamination
  noOfUnwinds: string; adhesiveCoverage: string;
  // Slitting
  noOfSlitters: string;
  // Pouch Making
  minPouchSize: string; maxPouchSize: string;
  // Pre-Press
  maxCylinderWidth: string; maxCircumference: string;
  // Costing
  chargeType: string; wasteType: string; wasteCalcOn: string;
  perHourCostingParam: string; refMachineCode: string;
};

export type Employee = {
  id: string; code: string; name: string;
  department: string; designation: string;
  shift: "A" | "B" | "C"; phone: string;
  status: "Active" | "Inactive";
};

export type LedgerType = "Employee" | "Client" | "Supplier" | "Consignee" | "Transporter" | "Vendor" | "Sales A/C";

export type Ledger = {
  id: string; code: string; ledgerType: LedgerType; name: string;
  status: "Active" | "Inactive";
  // Contact
  contactPerson: string; phone: string; email: string;
  // Address
  address: string; city: string; state: string; pincode: string;
  // Employee
  department: string; designation: string; shift: string; dateOfJoining: string;
  // Tax / Finance
  gst: string; pan: string; creditLimit: string; paymentTerms: string;
  bankAccount: string; ifsc: string; bankName: string;
  // Sales A/C
  hsn: string; taxRate: string; description: string;
};

// ─── TRANSACTION TYPES ───────────────────────────────────────

export type CostLayerResult = {
  layerNo: number; layerName: string; micron: number; density: number;
  gsm: number; consumptionPerSqM: number; blendRate: number; costPerSqM: number;
};

export type CostEstimation = {
  id: string; estimationNo: string; date: string;
  customerId: string; customerName: string;
  recipeId: string; recipeName: string;
  rollMasterId: string; rollName: string; rollWidth: number;
  totalMicron: number; layerMicrons: number[];
  layerResults: CostLayerResult[];
  totalGSM: number; totalCostPerSqM: number;
  machineCostPerSqM: number; labourCostPerSqM: number; overheadCostPerSqM: number;
  sellingPricePerKg: number; totalCostPerKg: number; marginPct: number;
  estimatedDays: number; deliveryDate: string;
  requiredMaterials: { materialName: string; quantityKg: number; ratePerKg: number; totalCost: number }[];
  status: "Draft" | "Approved" | "Rejected";
};

export type Enquiry = {
  id: string; enquiryNo: string; date: string;
  customerId: string; customerName: string;
  productId: string; productName: string;
  quantity: number; unit: string; width: number; thickness: number;
  printingRequired: boolean; printingColors: number;
  remarks: string; status: "Pending" | "Estimated" | "Converted" | "Rejected";
};

// ─── EXTRUSION ENQUIRY ───────────────────────────────────────
export type ExtrusionEnquiry = {
  id: string;
  enquiryNo: string;
  date: string;
  // Customer
  customerId: string;
  customerName: string;
  // Product
  productName: string;
  application: string;
  // Recipe snapshot
  recipeId: string;
  recipeName: string;
  rollMasterId: string;
  rollName: string;
  rollWidth: number;
  // Layer data
  totalMicron: number;
  layerMicrons: number[];
  layerResults: CostLayerResult[];
  totalGSM: number;
  // Costs
  machineCostPerSqM: number;
  overheadCostPerSqM: number;
  totalCostPerSqM: number;
  totalCostPerKg: number;
  // Pricing
  sellingPricePerKg: number;
  marginPct: number;
  // Order
  orderQty: number;
  unit: string;
  deliveryDate: string;
  // Materials
  requiredMaterials: { materialName: string; quantityKg: number; ratePerKg: number; totalCost: number }[];
  remarks: string;
  status: "Pending" | "Estimated" | "Converted" | "Rejected";
};

export type Order = {
  id: string; orderNo: string; date: string;
  enquiryId: string; estimationId: string;
  customerId: string; customerName: string;
  jobName: string; productName: string;
  recipeId: string; recipeName: string;
  rollMasterId: string; rollName: string;
  quantity: number; unit: string; deliveryDate: string;
  totalAmount: number; advancePaid: number;
  status: "Confirmed" | "In Production" | "Ready" | "Dispatched";
};

export type RotoJob = {
  id: string; rotoJobNo: string; date: string;
  orderId: string; orderNo: string;
  customerId: string; customerName: string; jobName: string;
  extrusionRollId: string; extrusionRollName: string;
  artworkDescription: string;
  hsnId: string; hsnCode: string;
  quantity: number; unit: string;
  processes: { processId: string; processName: string; processType: string }[];
  noOfColors: number; remarks: string;
  status: "Open" | "In Progress" | "Completed" | "On Hold";
};

export type JobCard = {
  id: string; jobCardNo: string; date: string;
  orderId: string; orderNo: string;
  rotoJobId?: string; rotoJobNo?: string;
  customerName: string; jobName?: string;
  productName: string; recipeName?: string;
  targetQty: number; unit: string;
  totalGSM?: number; rollWidth?: number;
  machineId: string; machineName: string;
  operatorId: string; operatorName: string;
  plannedDate: string; processes?: string[];
  status: "Open" | "In Progress" | "Completed" | "On Hold";
};

export type ExtrusionWorkOrder = {
  id: string; workOrderNo: string; date: string;
  orderId: string; orderNo: string;
  estimationId: string; estimationNo: string;
  customerId: string; customerName: string;
  jobName: string; productName: string;
  recipeId: string; recipeName: string;
  rollMasterId: string; rollName: string; rollWidth: number;
  totalMicron: number; layerMicrons: number[];
  layerResults: CostLayerResult[];
  totalGSM: number;
  requiredMaterials: { materialName: string; quantityKg: number; ratePerKg: number; totalCost: number }[];
  totalCostPerKg: number; sellingPricePerKg: number; totalAmount: number;
  machineId: string; machineName: string;
  operatorId: string; operatorName: string;
  quantity: number; unit: string;
  plannedDate: string; deliveryDate: string;
  status: "Pending" | "Completed";
  specialInstructions: string;
};

export const extrusionWorkOrders: ExtrusionWorkOrder[] = [
  {
    id: "EXWO001", workOrderNo: "EXT-WO-2024-001", date: "2024-03-07",
    orderId: "ORD001", orderNo: "ORD-2024-001",
    estimationId: "EST001", estimationNo: "EXT-EST-2024-001",
    customerId: "C001", customerName: "Parle Products Pvt Ltd",
    jobName: "Parle Shrink Wrap Batch-1", productName: "LLDPE Shrink Film 40μ",
    recipeId: "RCP001", recipeName: "3-Layer PE Shrink",
    rollMasterId: "RL001", rollName: "PE Shrink Roll 400mm", rollWidth: 400,
    totalMicron: 40, layerMicrons: [10, 20, 10],
    layerResults: [
      { layerNo: 1, layerName: "Skin Layer (Inner)", micron: 10, density: 0.930, gsm: 9.300, consumptionPerSqM: 0.009300, blendRate: 120, costPerSqM: 1.116 },
      { layerNo: 2, layerName: "Core Layer (Middle)", micron: 20, density: 0.920, gsm: 18.400, consumptionPerSqM: 0.018400, blendRate: 98, costPerSqM: 1.8032 },
      { layerNo: 3, layerName: "Skin Layer (Outer)", micron: 10, density: 0.969, gsm: 9.690, consumptionPerSqM: 0.009690, blendRate: 124.25, costPerSqM: 1.204 },
    ],
    totalGSM: 37.39, requiredMaterials: [
      { materialName: "LLDPE C4 Grade",    quantityKg: 1320, ratePerKg: 95,  totalCost: 125400 },
      { materialName: "LLDPE C6 Grade",    quantityKg: 840,  ratePerKg: 98,  totalCost: 82320  },
      { materialName: "LDPE LD150",        quantityKg: 360,  ratePerKg: 98,  totalCost: 35280  },
      { materialName: "White Masterbatch", quantityKg: 115,  ratePerKg: 185, totalCost: 21275  },
      { materialName: "Slip Additive MB",  quantityKg: 165,  ratePerKg: 220, totalCost: 36300  },
    ],
    totalCostPerKg: 120, sellingPricePerKg: 130, totalAmount: 650000,
    machineId: "M001", machineName: "Extrusion Line 1",
    operatorId: "EMP001", operatorName: "Rajesh Kumar",
    quantity: 5000, unit: "Kg",
    plannedDate: "2024-03-10", deliveryDate: "2024-03-20",
    status: "Completed", specialInstructions: "Use food-grade additives only.",
  },
  {
    id: "EXWO002", workOrderNo: "EXT-WO-2024-002", date: "2024-03-14",
    orderId: "ORD003", orderNo: "ORD-2024-003",
    estimationId: "", estimationNo: "",
    customerId: "C004", customerName: "ITC Limited",
    jobName: "ITC Carry Bag Run-Q1", productName: "HDPE Carry Bag Film 80μ",
    recipeId: "RCP002", recipeName: "2-Layer HDPE Film",
    rollMasterId: "RL003", rollName: "HDPE Carry Roll 500mm", rollWidth: 500,
    totalMicron: 80, layerMicrons: [40, 40],
    layerResults: [
      { layerNo: 1, layerName: "Inner Layer", micron: 40, density: 0.957, gsm: 38.28, consumptionPerSqM: 0.03828, blendRate: 116.5, costPerSqM: 4.460 },
      { layerNo: 2, layerName: "Outer Layer", micron: 40, density: 1.059, gsm: 42.36, consumptionPerSqM: 0.04236, blendRate: 117.5, costPerSqM: 4.977 },
    ],
    totalGSM: 80.64, requiredMaterials: [
      { materialName: "HDPE Film Grade",   quantityKg: 6650, ratePerKg: 105, totalCost: 698250 },
      { materialName: "White Masterbatch", quantityKg: 1100, ratePerKg: 185, totalCost: 203500 },
      { materialName: "Slip Additive MB",  quantityKg: 750,  ratePerKg: 220, totalCost: 165000 },
    ],
    totalCostPerKg: 118, sellingPricePerKg: 130, totalAmount: 1300000,
    machineId: "M001", machineName: "Extrusion Line 1",
    operatorId: "EMP001", operatorName: "Rajesh Kumar",
    quantity: 10000, unit: "Kg",
    plannedDate: "2024-03-20", deliveryDate: "2024-04-05",
    status: "Pending", specialInstructions: "",
  },
  {
    id: "EXWO003", workOrderNo: "EXT-WO-2024-003", date: "2024-03-17",
    orderId: "ORD004", orderNo: "ORD-2024-004",
    estimationId: "", estimationNo: "",
    customerId: "C003", customerName: "Haldiram Snacks Pvt Ltd",
    jobName: "Haldiram Barrier Film-Snacks", productName: "Barrier Film 5-Layer 80μ",
    recipeId: "RCP003", recipeName: "5-Layer Barrier Film",
    rollMasterId: "RL006", rollName: "5-Layer Barrier Roll 400mm", rollWidth: 400,
    totalMicron: 80, layerMicrons: [16, 8, 32, 8, 16],
    layerResults: [
      { layerNo: 1, layerName: "Heat Seal Layer", micron: 16, density: 0.905, gsm: 14.48, consumptionPerSqM: 0.01448, blendRate: 102, costPerSqM: 1.477 },
      { layerNo: 2, layerName: "Tie Layer A",     micron: 8,  density: 0.918, gsm: 7.344, consumptionPerSqM: 0.007344, blendRate: 98, costPerSqM: 0.720 },
      { layerNo: 3, layerName: "Barrier Core",    micron: 32, density: 1.212, gsm: 38.78, consumptionPerSqM: 0.03878, blendRate: 131, costPerSqM: 5.080 },
      { layerNo: 4, layerName: "Tie Layer B",     micron: 8,  density: 0.918, gsm: 7.344, consumptionPerSqM: 0.007344, blendRate: 98, costPerSqM: 0.720 },
      { layerNo: 5, layerName: "Outer Sealant",   micron: 16, density: 0.930, gsm: 14.88, consumptionPerSqM: 0.01488, blendRate: 117, costPerSqM: 1.741 },
    ],
    totalGSM: 82.83, requiredMaterials: [
      { materialName: "PP Copolymer",      quantityKg: 950,  ratePerKg: 102, totalCost: 96900 },
      { materialName: "LLDPE C6 Grade",    quantityKg: 1200, ratePerKg: 98,  totalCost: 117600 },
      { materialName: "LLDPE C4 Grade",    quantityKg: 1100, ratePerKg: 95,  totalCost: 104500 },
      { materialName: "White Masterbatch", quantityKg: 750,  ratePerKg: 185, totalCost: 138750 },
      { materialName: "Slip Additive MB",  quantityKg: 400,  ratePerKg: 220, totalCost: 88000  },
    ],
    totalCostPerKg: 145, sellingPricePerKg: 160, totalAmount: 640000,
    machineId: "M001", machineName: "Extrusion Line 1",
    operatorId: "EMP001", operatorName: "Rajesh Kumar",
    quantity: 4000, unit: "Kg",
    plannedDate: "2024-03-25", deliveryDate: "2024-04-10",
    status: "Pending", specialInstructions: "5-layer barrier — check EVOH layer thickness carefully.",
  },
];

export type ProductionEntry = {
  id: string; entryNo: string; date: string;
  jobCardId: string; jobCardNo: string;
  machineId: string; machineName: string;
  shift: "A" | "B" | "C"; rollNo: string;
  producedQty: number; wastageQty: number; netQty: number;
  machineRuntime: number;
  operatorId?: string; operatorName?: string; remarks: string;
};

export type Dispatch = {
  id: string; dispatchNo: string; date: string;
  orderId: string; orderNo: string;
  customerId: string; customerName: string;
  productName: string; quantity: number; unit: string;
  vehicleNo: string; driverName: string;
  status: "Pending" | "In Transit" | "Delivered";
};

// ─── SUBGROUPS ───────────────────────────────────────────────
export const subGroups: SubGroup[] = [
  { id: "SG001", name: "PET Film (Plain / Treated)",             category: "Raw Material (RM)",   group: "Film",         description: "Plain and corona treated PET films" },
  { id: "SG002", name: "BOPP Film (White / Transparent / Pearlized)", category: "Raw Material (RM)", group: "Film",      description: "BOPP film variants for lamination and printing" },
  { id: "SG003", name: "CPP Film",                              category: "Raw Material (RM)",   group: "Film",         description: "Cast Polypropylene film" },
  { id: "SG004", name: "LDPE Film",                             category: "Raw Material (RM)",   group: "Film",         description: "Low Density Polyethylene film" },
  { id: "SG005", name: "HDPE Film",                             category: "Raw Material (RM)",   group: "Film",         description: "High Density Polyethylene film" },
  { id: "SG006", name: "PVC Shrink Film",                       category: "Raw Material (RM)",   group: "Film",         description: "PVC shrink film for labels" },
  { id: "SG007", name: "OPS Shrink Film",                       category: "Raw Material (RM)",   group: "Film",         description: "Oriented Polystyrene shrink film" },
  { id: "SG008", name: "Met PET Film",                          category: "Raw Material (RM)",   group: "Film",         description: "Metallized PET film" },
  { id: "SG009", name: "Solvent Based Ink",                     category: "Raw Material (RM)",   group: "Ink",          description: "Solvent-based gravure inks" },
  { id: "SG010", name: "Water Based Ink",                       category: "Raw Material (RM)",   group: "Ink",          description: "Water-based gravure inks" },
  { id: "SG011", name: "PU Ink",                                category: "Raw Material (RM)",   group: "Ink",          description: "Polyurethane-based inks" },
  { id: "SG012", name: "NC Ink",                                category: "Raw Material (RM)",   group: "Ink",          description: "Nitrocellulose inks" },
  { id: "SG013", name: "Gravure Ink",                           category: "Raw Material (RM)",   group: "Ink",          description: "General gravure printing inks" },
  { id: "SG014", name: "Ethyl Acetate (EA)",                    category: "Raw Material (RM)",   group: "Solvent",      description: "Ethyl acetate solvent" },
  { id: "SG015", name: "Toluene",                               category: "Raw Material (RM)",   group: "Solvent",      description: "Toluene solvent" },
  { id: "SG016", name: "IPA",                                   category: "Raw Material (RM)",   group: "Solvent",      description: "Isopropyl alcohol" },
  { id: "SG017", name: "MEK",                                   category: "Raw Material (RM)",   group: "Solvent",      description: "Methyl Ethyl Ketone" },
  { id: "SG018", name: "MIBK",                                  category: "Raw Material (RM)",   group: "Solvent",      description: "Methyl Isobutyl Ketone" },
  { id: "SG019", name: "PU Adhesive",                           category: "Raw Material (RM)",   group: "Adhesive",     description: "Polyurethane adhesive" },
  { id: "SG020", name: "Lamination Adhesive",                   category: "Raw Material (RM)",   group: "Adhesive",     description: "Adhesive for lamination process" },
  { id: "SG021", name: "Solvent Based Adhesive",                category: "Raw Material (RM)",   group: "Adhesive",     description: "Solvent-based adhesive" },
  { id: "SG022", name: "Solvent Free Adhesive",                 category: "Raw Material (RM)",   group: "Adhesive",     description: "Solvent-free adhesive" },
  { id: "SG023", name: "PU Hardener",                           category: "Raw Material (RM)",   group: "Hardner",      description: "Polyurethane hardener" },
  { id: "SG024", name: "Adhesive Hardener",                     category: "Raw Material (RM)",   group: "Hardner",      description: "Hardener for adhesives" },
  { id: "SG025", name: "Slip Additive",                         category: "Raw Material (RM)",   group: "Additives",    description: "Slip additive for film processing" },
  { id: "SG026", name: "Anti-block",                            category: "Raw Material (RM)",   group: "Additives",    description: "Anti-block additive" },
  { id: "SG027", name: "Defoamer",                              category: "Raw Material (RM)",   group: "Additives",    description: "Defoaming agent" },
  { id: "SG028", name: "Retarder",                              category: "Raw Material (RM)",   group: "Additives",    description: "Retarder for ink drying" },
  { id: "SG029", name: "Cleaning Chemical",                     category: "Raw Material (RM)",   group: "Additives",    description: "Machine and equipment cleaning chemicals" },
  { id: "SG030", name: "Antistatic Additive",                   category: "Raw Material (RM)",   group: "Additives",    description: "Antistatic agent" },
  { id: "SG031", name: "Processing Aid",                        category: "Raw Material (RM)",   group: "Additives",    description: "Processing aid additive" },
  { id: "SG032", name: "Carbon Steel Doctor Blade",             category: "Consumables",          group: "Doctor Blade", description: "Carbon steel doctor blade" },
  { id: "SG033", name: "Stainless Steel Doctor Blade",          category: "Consumables",          group: "Doctor Blade", description: "Stainless steel doctor blade" },
  { id: "SG034", name: "Coated Doctor Blade",                   category: "Consumables",          group: "Doctor Blade", description: "Coated doctor blade" },
  { id: "SG035", name: "Cylinder Shaft",                        category: "Consumables",          group: "Cylinder",     description: "Gravure cylinder shaft" },
  { id: "SG036", name: "Cylinder Gear",                         category: "Consumables",          group: "Cylinder",     description: "Cylinder drive gear" },
  { id: "SG037", name: "Cylinder Bearing",                      category: "Consumables",          group: "Cylinder",     description: "Cylinder bearing" },
  { id: "SG038", name: "Paper Core 3 Inch",                     category: "Consumables",          group: "Core",         description: "3 inch paper core" },
  { id: "SG039", name: "Paper Core 6 Inch",                     category: "Consumables",          group: "Core",         description: "6 inch paper core" },
  { id: "SG040", name: "Stretch Film",                          category: "Consumables",          group: "Core",         description: "Stretch film for packing" },
  { id: "SG041", name: "Poly Bag",                              category: "Consumables",          group: "Core",         description: "Polythene bag" },
  { id: "SG042", name: "Carton Box",                            category: "Consumables",          group: "Core",         description: "Corrugated carton box" },
  { id: "SG043", name: "Pallet",                                category: "Consumables",          group: "Core",         description: "Wooden/plastic pallet" },
  { id: "SG044", name: "BOPP Tape",                             category: "Consumables",          group: "Tape",         description: "BOPP self-adhesive tape" },
  { id: "SG045", name: "Double Side Tape",                      category: "Consumables",          group: "Tape",         description: "Double sided adhesive tape" },
  { id: "SG046", name: "Masking Tape",                          category: "Consumables",          group: "Tape",         description: "Masking tape" },
  { id: "SG047", name: "Machine Lubricant",                     category: "Consumables",          group: "Lubricant",    description: "General machine lubricant" },
  { id: "SG048", name: "Gear Oil",                              category: "Consumables",          group: "Lubricant",    description: "Gear oil" },
  { id: "SG049", name: "Hydraulic Oil",                         category: "Consumables",          group: "Lubricant",    description: "Hydraulic oil" },
  { id: "SG050", name: "Spindle Oil",                           category: "Consumables",          group: "Lubricant",    description: "Spindle oil" },
  { id: "SG051", name: "BOPP Printed Roll",                     category: "Finished Goods (FG)",  group: "Printed Roll", description: "BOPP printed roll" },
  { id: "SG052", name: "PET Printed Roll",                      category: "Finished Goods (FG)",  group: "Printed Roll", description: "PET printed roll" },
  { id: "SG053", name: "CPP Printed Roll",                      category: "Finished Goods (FG)",  group: "Printed Roll", description: "CPP printed roll" },
  { id: "SG054", name: "LDPE Printed Roll",                     category: "Finished Goods (FG)",  group: "Printed Roll", description: "LDPE printed roll" },
  { id: "SG055", name: "HDPE Printed Roll",                     category: "Finished Goods (FG)",  group: "Printed Roll", description: "HDPE printed roll" },
  { id: "SG056", name: "PET / BOPP Laminate",                   category: "Finished Goods (FG)",  group: "Laminated Roll", description: "PET to BOPP laminated roll" },
  { id: "SG057", name: "BOPP / BOPP Laminate",                  category: "Finished Goods (FG)",  group: "Laminated Roll", description: "BOPP to BOPP laminated roll" },
  { id: "SG058", name: "PET / CPP Laminate",                    category: "Finished Goods (FG)",  group: "Laminated Roll", description: "PET to CPP laminated roll" },
  { id: "SG059", name: "BOPP / CPP Laminate",                   category: "Finished Goods (FG)",  group: "Laminated Roll", description: "BOPP to CPP laminated roll" },
  { id: "SG060", name: "PET / PE Laminate",                     category: "Finished Goods (FG)",  group: "Laminated Roll", description: "PET to PE laminated roll" },
  { id: "SG061", name: "PE Shrink Film",                        category: "Finished Goods (FG)",  group: "Shrink Film",  description: "PE shrink film" },
  { id: "SG062", name: "PVC Shrink Film",                       category: "Finished Goods (FG)",  group: "Shrink Film",  description: "PVC shrink film" },
  { id: "SG063", name: "OPS Shrink Film",                       category: "Finished Goods (FG)",  group: "Shrink Film",  description: "OPS shrink film" },
  { id: "SG064", name: "POF Shrink Film",                       category: "Finished Goods (FG)",  group: "Shrink Film",  description: "POF shrink film" },
  { id: "SG065", name: "PET Shrink Sleeve",                     category: "Finished Goods (FG)",  group: "Shrink Sleeve", description: "PET shrink sleeve label" },
  { id: "SG066", name: "OPS Shrink Sleeve",                     category: "Finished Goods (FG)",  group: "Shrink Sleeve", description: "OPS shrink sleeve label" },
  { id: "SG067", name: "PVC Shrink Sleeve",                     category: "Finished Goods (FG)",  group: "Shrink Sleeve", description: "PVC shrink sleeve label" },
  { id: "SG068", name: "BOPP Wrap Around Label",                category: "Finished Goods (FG)",  group: "Wrap Around Label", description: "BOPP wrap around label" },
  { id: "SG069", name: "PET Wrap Around Label",                 category: "Finished Goods (FG)",  group: "Wrap Around Label", description: "PET wrap around label" },
  { id: "SG070", name: "LDPE Wrap Around Label",                category: "Finished Goods (FG)",  group: "Wrap Around Label", description: "LDPE wrap around label" },
  { id: "SG071", name: "Stand Up Pouch",                        category: "Finished Goods (FG)",  group: "Pouch",        description: "Stand up pouch" },
  { id: "SG072", name: "Flat Pouch",                            category: "Finished Goods (FG)",  group: "Pouch",        description: "Flat pouch" },
  { id: "SG073", name: "Side Seal Pouch",                       category: "Finished Goods (FG)",  group: "Pouch",        description: "Side seal pouch" },
  { id: "SG074", name: "Bottom Seal Pouch",                     category: "Finished Goods (FG)",  group: "Pouch",        description: "Bottom seal pouch" },
  { id: "SG075", name: "3 Side Seal Pouch",                     category: "Finished Goods (FG)",  group: "Pouch",        description: "3 side seal pouch" },
];

// ─── DEPARTMENT MASTER ───────────────────────────────────────
export type DeptType = "Pre-Press" | "Production" | "Post-Process" | "Quality" | "Packing & Dispatch" | "Support";
export type DeptModule = "Rotogravure" | "Extrusion" | "Common";

export type Department = {
  id: string; code: string; name: string;
  deptType: DeptType; module: DeptModule;
  hod: string; costCenter: string;
  description: string; status: "Active" | "Inactive";
};

export const departments: Department[] = [
  // ── Rotogravure ─────────────────────────────────────────────
  { id: "D001", code: "DEPT-PP", name: "Pre-Press", deptType: "Pre-Press", module: "Rotogravure", hod: "Rajesh Kumar", costCenter: "CC-101", description: "Cylinder preparation, engraving, chrome plating and colour separation", status: "Active" },
  { id: "D002", code: "DEPT-PRT", name: "Printing", deptType: "Production", module: "Rotogravure", hod: "Suresh Patel", costCenter: "CC-102", description: "Rotogravure multi-colour surface and reverse printing", status: "Active" },
  { id: "D003", code: "DEPT-LAM", name: "Lamination", deptType: "Production", module: "Rotogravure", hod: "Anil Sharma", costCenter: "CC-103", description: "Dry bond, solventless and extrusion lamination of printed films", status: "Active" },
  { id: "D004", code: "DEPT-COT", name: "Coating", deptType: "Post-Process", module: "Rotogravure", hod: "Suresh Patel", costCenter: "CC-104", description: "OPV (matte/gloss), heat seal and cold seal coating", status: "Active" },
  { id: "D005", code: "DEPT-SLT", name: "Slitting", deptType: "Post-Process", module: "Rotogravure", hod: "Vikram Singh", costCenter: "CC-105", description: "Slitting and rewinding laminated / printed rolls to customer widths", status: "Active" },
  { id: "D006", code: "DEPT-PCH", name: "Pouch Making", deptType: "Post-Process", module: "Rotogravure", hod: "Manoj Gupta", costCenter: "CC-106", description: "3SS, 4SS, back seal, stand-up and zip-lock pouch forming", status: "Active" },
  { id: "D007", code: "DEPT-QC", name: "Quality Control", deptType: "Quality", module: "Rotogravure", hod: "Priya Nair", costCenter: "CC-107", description: "Inline vision inspection, print quality checks and finished goods QC", status: "Active" },
  { id: "D008", code: "DEPT-PCK", name: "Packing & Dispatch", deptType: "Packing & Dispatch", module: "Rotogravure", hod: "Ramesh Yadav", costCenter: "CC-108", description: "Roll packing, carton labelling and dispatch for roto products", status: "Active" },
  // ── Extrusion ────────────────────────────────────────────────
  { id: "D009", code: "DEPT-BFL", name: "Blown Film Line", deptType: "Production", module: "Extrusion", hod: "Harish Mishra", costCenter: "CC-201", description: "Single and multi-layer blown film production – LDPE, LLDPE, HDPE", status: "Active" },
  { id: "D010", code: "DEPT-CFL", name: "Cast Film Line", deptType: "Production", module: "Extrusion", hod: "Deepak Verma", costCenter: "CC-202", description: "Cast CPP and CPE film production for lamination and heat seal", status: "Active" },
  { id: "D011", code: "DEPT-COX", name: "Co-Extrusion", deptType: "Production", module: "Extrusion", hod: "Harish Mishra", costCenter: "CC-203", description: "3-layer and 5-layer co-extrusion for barrier and specialty films", status: "Active" },
  { id: "D012", code: "DEPT-COR", name: "Corona Treatment", deptType: "Post-Process", module: "Extrusion", hod: "Deepak Verma", costCenter: "CC-204", description: "Inline and offline corona surface treatment for print adhesion", status: "Active" },
  { id: "D013", code: "DEPT-EXS", name: "Slitting (Extrusion)", deptType: "Post-Process", module: "Extrusion", hod: "Vikram Singh", costCenter: "CC-205", description: "Film slitting and edge trim recovery post extrusion", status: "Active" },
  { id: "D014", code: "DEPT-EXP", name: "Packing (Extrusion)", deptType: "Packing & Dispatch", module: "Extrusion", hod: "Ramesh Yadav", costCenter: "CC-206", description: "Roll wrapping, core cap and dispatch for extrusion products", status: "Active" },
  // ── Common / Support ─────────────────────────────────────────
  { id: "D015", code: "DEPT-STR", name: "Stores & Warehouse", deptType: "Support", module: "Common", hod: "Sanjay Tiwari", costCenter: "CC-301", description: "Raw material inward, stock management and finished goods storage", status: "Active" },
  { id: "D016", code: "DEPT-MNT", name: "Maintenance", deptType: "Support", module: "Common", hod: "Govind Rao", costCenter: "CC-302", description: "Preventive and breakdown maintenance for all plant machinery", status: "Active" },
  { id: "D017", code: "DEPT-ACC", name: "Accounts", deptType: "Support", module: "Common", hod: "Anita Joshi", costCenter: "CC-401", description: "Finance, billing, vendor payments and cost accounting", status: "Active" },
  { id: "D018", code: "DEPT-HR", name: "HR & Admin", deptType: "Support", module: "Common", hod: "Meena Shah", costCenter: "CC-402", description: "Recruitment, payroll, attendance and general administration", status: "Active" },
];

// ─── ITEM GROUP MASTER ───────────────────────────────────────
export type ItemGroup = {
  id: string; category: string; name: string; description: string;
  status: "Active" | "Inactive";
};

export const itemGroups: ItemGroup[] = [
  // Raw Material (RM)
  { id: "IG001", category: "Raw Material (RM)", name: "Film", description: "All flexible film materials including PET, BOPP, CPP, LDPE, PE, PVC and shrink films", status: "Active" },
  { id: "IG002", category: "Raw Material (RM)", name: "Ink", description: "Solvent based, water based and PU gravure inks for rotogravure printing", status: "Active" },
  { id: "IG003", category: "Raw Material (RM)", name: "Solvent", description: "Solvents used in ink dilution and lamination adhesive preparation", status: "Active" },
  { id: "IG004", category: "Raw Material (RM)", name: "Adhesive", description: "PU adhesives and lamination adhesives for multi-layer lamination", status: "Active" },
  { id: "IG005", category: "Raw Material (RM)", name: "Hardner", description: "Hardeners used as cross-linking agents with PU adhesives", status: "Active" },
  { id: "IG006", category: "Raw Material (RM)", name: "Additives", description: "Slip additives, anti-block agents, defoamers and processing chemicals", status: "Active" },
  // Consumables
  { id: "IG007", category: "Consumables", name: "Doctor Blade", description: "Doctor blades used in rotogravure printing for ink wiping", status: "Active" },
  { id: "IG008", category: "Consumables", name: "Cylinder", description: "Cylinder parts and components – shafts, gears, bearings", status: "Active" },
  { id: "IG009", category: "Consumables", name: "Core", description: "Paper cores and packing materials for roll winding and dispatch", status: "Active" },
  { id: "IG010", category: "Consumables", name: "Tape", description: "BOPP tape, double-sided tape and masking tape for packing and splicing", status: "Active" },
  { id: "IG011", category: "Consumables", name: "Lubricant", description: "Machine lubricants, gear oils and hydraulic oils for machine maintenance", status: "Active" },
  // Finished Goods (FG)
  { id: "IG012", category: "Finished Goods (FG)", name: "Printed Roll", description: "Single-layer printed film rolls delivered on cores", status: "Active" },
  { id: "IG013", category: "Finished Goods (FG)", name: "Laminated Roll", description: "Multi-layer laminated rolls – combination of two or more films", status: "Active" },
  { id: "IG014", category: "Finished Goods (FG)", name: "Shrink Film", description: "Heat shrink films for multi-pack and bottle wrapping", status: "Active" },
  { id: "IG015", category: "Finished Goods (FG)", name: "Shrink Sleeve", description: "Pre-formed shrink sleeves for bottle labelling", status: "Active" },
  { id: "IG016", category: "Finished Goods (FG)", name: "Wrap Around Label", description: "Wrap-around labels for bottles and containers", status: "Active" },
  { id: "IG017", category: "Finished Goods (FG)", name: "Pouch", description: "Stand-up pouches, flat pouches and side-seal pouches", status: "Active" },
];

// ─── CASCADING GROUP / SUB-GROUP MAP ────────────────────────
export const CATEGORY_GROUP_SUBGROUP: Record<string, Record<string, string[]>> = {
  "Raw Material (RM)": {
    "Film": [
      "PET Film (Plain / Treated)",
      "BOPP Film (White / Transparent / Pearlized)",
      "CPP Film",
      "LDPE Film",
      "HDPE Film",
      "PVC Shrink Film",
      "OPS Shrink Film",
      "Met PET Film",
    ],
    "Ink": [
      "Solvent Based Ink",
      "Water Based Ink",
      "PU Ink",
      "NC Ink",
      "Gravure Ink",
    ],
    "Solvent": [
      "Ethyl Acetate (EA)",
      "Toluene",
      "IPA",
      "MEK",
      "MIBK",
    ],
    "Adhesive": [
      "PU Adhesive",
      "Lamination Adhesive",
      "Solvent Based Adhesive",
      "Solvent Free Adhesive",
    ],
    "Hardner": [
      "PU Hardener",
      "Adhesive Hardener",
    ],
    "Additives": [
      "Slip Additive",
      "Anti-block",
      "Defoamer",
      "Retarder",
      "Cleaning Chemical",
      "Antistatic Additive",
      "Processing Aid",
    ],
  },
  "Consumables": {
    "Doctor Blade": [
      "Carbon Steel Doctor Blade",
      "Stainless Steel Doctor Blade",
      "Coated Doctor Blade",
    ],
    "Cylinder": [
      "Cylinder Shaft",
      "Cylinder Gear",
      "Cylinder Bearing",
    ],
    "Core": [
      "Paper Core 3 Inch",
      "Paper Core 6 Inch",
      "Stretch Film",
      "Poly Bag",
      "Carton Box",
      "Pallet",
    ],
    "Tape": [
      "BOPP Tape",
      "Double Side Tape",
      "Masking Tape",
    ],
    "Lubricant": [
      "Machine Lubricant",
      "Gear Oil",
      "Hydraulic Oil",
      "Spindle Oil",
    ],
  },
  "Finished Goods (FG)": {
    "Printed Roll": [
      "BOPP Printed Roll",
      "PET Printed Roll",
      "CPP Printed Roll",
      "LDPE Printed Roll",
      "HDPE Printed Roll",
    ],
    "Laminated Roll": [
      "PET / BOPP Laminate",
      "BOPP / BOPP Laminate",
      "PET / CPP Laminate",
      "BOPP / CPP Laminate",
      "PET / PE Laminate",
    ],
    "Shrink Film": [
      "PE Shrink Film",
      "PVC Shrink Film",
      "OPS Shrink Film",
      "POF Shrink Film",
    ],
    "Shrink Sleeve": [
      "PET Shrink Sleeve",
      "OPS Shrink Sleeve",
      "PVC Shrink Sleeve",
    ],
    "Wrap Around Label": [
      "BOPP Wrap Around Label",
      "PET Wrap Around Label",
      "LDPE Wrap Around Label",
    ],
    "Pouch": [
      "Stand Up Pouch",
      "Flat Pouch",
      "Side Seal Pouch",
      "Bottom Seal Pouch",
      "3 Side Seal Pouch",
    ],
  },
};

// ─── ITEM TYPE (Item Master – all purchasable items) ──────────
export type Item = {
  id: string; category: string; group: string; subGroup: string;
  code: string; name: string;
  hsnCode: string; gstRate: string; stockUom: string;
  active: boolean;
  // Procurement
  supplier: string; supplierRef: string; purchaseUnit: string; estimationUnit: string;
  // Stock Management
  reOrderQty: string; minStockQty: string; shelfLife: string; leadTime: string;
  stockType: string; isStandardItem: boolean; isRegularItem: boolean;
  stockRefCode: string; refItemCode: string; tallyCode: string;
  // Specifications
  substrate: string; webWidth: string; thickness: string; density: string;
  shrinkage: string; purchaseRate: string; estimationRate: string;
  // Ink-specific
  colour: string; pantoneNo: string;
  remarks: string;
};

const ib = { supplier: "", supplierRef: "", purchaseUnit: "Kg", estimationUnit: "Kg", reOrderQty: "", minStockQty: "", shelfLife: "", leadTime: "", stockType: "Moving", isStandardItem: false, isRegularItem: false, stockRefCode: "", refItemCode: "", tallyCode: "", density: "", colour: "", pantoneNo: "" };

export const items: Item[] = [
  { id: "ITM001", code: "RM-FIL-4475", name: "BOPP 90 MICRON 0.2 THICKNESS", category: "Raw Material (RM)", group: "Film", subGroup: "BOPP Film", hsnCode: "3920", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Cosmo Films", supplierRef: "CF-BOPP-90", purchaseUnit: "Kg", estimationUnit: "SqM", density: "0.91", reOrderQty: "500", minStockQty: "200", leadTime: "7", isRegularItem: true, substrate: "BOPP", webWidth: "330", thickness: "90", shrinkage: "0", purchaseRate: "150.00", estimationRate: "155.00", remarks: "Standard BOPP for lamination" },
  { id: "ITM002", code: "RM-FIL-1022", name: "LLDPE C4 GRADE FILM", category: "Raw Material (RM)", group: "Film", subGroup: "LLDPE Grade", hsnCode: "3920", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Reliance Industries", supplierRef: "RIL-LLDPE-C4", density: "0.92", reOrderQty: "1000", minStockQty: "500", leadTime: "10", isRegularItem: true, substrate: "PE", webWidth: "400", thickness: "40", shrinkage: "0", purchaseRate: "95.00", estimationRate: "98.00", remarks: "Food grade LLDPE" },
  { id: "ITM003", code: "RM-FIL-1023", name: "LLDPE C6 GRADE FILM", category: "Raw Material (RM)", group: "Film", subGroup: "LLDPE Grade", hsnCode: "3920", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "GAIL India", density: "0.92", reOrderQty: "500", minStockQty: "200", leadTime: "10", substrate: "PE", webWidth: "400", thickness: "40", shrinkage: "0", purchaseRate: "98.00", estimationRate: "100.00", remarks: "" },
  { id: "ITM004", code: "RM-FIL-2031", name: "HDPE FILM GRADE", category: "Raw Material (RM)", group: "Film", subGroup: "HDPE Grade", hsnCode: "3920", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Reliance Industries", density: "0.95", reOrderQty: "500", minStockQty: "250", leadTime: "7", substrate: "PE", webWidth: "500", thickness: "80", shrinkage: "0", purchaseRate: "105.00", estimationRate: "108.00", remarks: "Carry bag grade" },
  { id: "ITM005", code: "RM-FIL-3011", name: "LDPE LD150", category: "Raw Material (RM)", group: "Film", subGroup: "LDPE Grade", hsnCode: "3920", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Haldia Petrochemicals", density: "0.92", reOrderQty: "500", minStockQty: "200", leadTime: "10", substrate: "PE", webWidth: "400", thickness: "40", shrinkage: "0", purchaseRate: "98.00", estimationRate: "100.00", remarks: "" },
  { id: "ITM006", code: "RM-MB-001", name: "WHITE MASTERBATCH", category: "Raw Material (RM)", group: "Film", subGroup: "Masterbatches", hsnCode: "3920", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Cabot India", supplierRef: "CAB-WMB-40", density: "1.80", reOrderQty: "100", minStockQty: "50", leadTime: "14", isStandardItem: true, substrate: "PE", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "185.00", estimationRate: "190.00", remarks: "TiO2 based white MB" },
  // ── Inks (subGroup aligned with CATEGORY_GROUP_SUBGROUP) ──
  { id: "ITM007", code: "RM-INK-001", name: "YELLOW INK SOLVENT BASED", category: "Raw Material (RM)", group: "Ink", subGroup: "Solvent Based Ink", hsnCode: "3215", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Siegwerk India", supplierRef: "SW-YEL-SB", reOrderQty: "50", minStockQty: "20", shelfLife: "365", leadTime: "14", isRegularItem: true, colour: "Yellow", pantoneNo: "P 10-3 C", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "450.00", estimationRate: "460.00", remarks: "Siegwerk gravure ink" },
  { id: "ITM008", code: "RM-INK-002", name: "CYAN INK SOLVENT BASED", category: "Raw Material (RM)", group: "Ink", subGroup: "Solvent Based Ink", hsnCode: "3215", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Siegwerk India", supplierRef: "SW-CYN-SB", reOrderQty: "50", minStockQty: "20", shelfLife: "365", leadTime: "14", isRegularItem: true, colour: "Cyan", pantoneNo: "P 115-16 C", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "480.00", estimationRate: "490.00", remarks: "" },
  { id: "ITM009", code: "RM-INK-003", name: "MAGENTA INK SOLVENT BASED", category: "Raw Material (RM)", group: "Ink", subGroup: "Solvent Based Ink", hsnCode: "3215", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Huber Group", supplierRef: "HB-MAG-SB", reOrderQty: "50", minStockQty: "20", shelfLife: "365", leadTime: "14", colour: "Magenta", pantoneNo: "P 52-8 C", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "490.00", estimationRate: "500.00", remarks: "" },
  { id: "ITM010", code: "RM-INK-004", name: "BLACK INK SOLVENT BASED", category: "Raw Material (RM)", group: "Ink", subGroup: "Solvent Based Ink", hsnCode: "3215", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Huber Group", supplierRef: "HB-BLK-SB", reOrderQty: "100", minStockQty: "40", shelfLife: "365", leadTime: "14", isRegularItem: true, colour: "Black", pantoneNo: "Process Black C", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "420.00", estimationRate: "430.00", remarks: "Huber Group" },
  { id: "ITM013", code: "RM-INK-005", name: "WHITE INK WATER BASED", category: "Raw Material (RM)", group: "Ink", subGroup: "Water Based Ink", hsnCode: "3215", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Sakata Inx India", reOrderQty: "50", minStockQty: "20", shelfLife: "180", leadTime: "14", colour: "White", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "380.00", estimationRate: "390.00", remarks: "Water based white ink" },
  { id: "ITM014", code: "RM-INK-006", name: "RED INK PU BASED", category: "Raw Material (RM)", group: "Ink", subGroup: "PU Ink", hsnCode: "3215", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Toyo Ink", reOrderQty: "30", minStockQty: "10", shelfLife: "365", leadTime: "14", colour: "Red", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "520.00", estimationRate: "535.00", remarks: "" },
  // ── Solvents ──
  { id: "ITM015", code: "RM-SOL-001", name: "ETHYL ACETATE (EA) GRADE", category: "Raw Material (RM)", group: "Solvent", subGroup: "Ethyl Acetate (EA)", hsnCode: "2915", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Eastman Chemical India", supplierRef: "EC-EA-99", reOrderQty: "500", minStockQty: "200", shelfLife: "365", leadTime: "7", isRegularItem: true, substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "62.00", estimationRate: "65.00", remarks: "99% purity EA solvent" },
  { id: "ITM016", code: "RM-SOL-002", name: "TOLUENE SOLVENT", category: "Raw Material (RM)", group: "Solvent", subGroup: "Toluene", hsnCode: "2902", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Deepak Nitrite", reOrderQty: "500", minStockQty: "200", shelfLife: "365", leadTime: "7", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "55.00", estimationRate: "58.00", remarks: "Industrial grade toluene" },
  { id: "ITM017", code: "RM-SOL-003", name: "IPA SOLVENT 99%", category: "Raw Material (RM)", group: "Solvent", subGroup: "IPA", hsnCode: "2905", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Laxmi Organic Industries", reOrderQty: "200", minStockQty: "100", shelfLife: "365", leadTime: "7", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "75.00", estimationRate: "78.00", remarks: "Isopropyl alcohol 99%" },
  { id: "ITM018", code: "RM-SOL-004", name: "MEK SOLVENT", category: "Raw Material (RM)", group: "Solvent", subGroup: "MEK", hsnCode: "2914", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Eastman Chemical India", reOrderQty: "200", minStockQty: "100", shelfLife: "365", leadTime: "10", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "80.00", estimationRate: "84.00", remarks: "Methyl Ethyl Ketone" },
  // ── Adhesives ──
  { id: "ITM019", code: "RM-ADH-001", name: "PU ADHESIVE 2K (PART A)", category: "Raw Material (RM)", group: "Adhesive", subGroup: "PU Adhesive", hsnCode: "3506", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Henkel India", supplierRef: "HNK-PUDB-2K", reOrderQty: "100", minStockQty: "50", shelfLife: "180", leadTime: "21", isRegularItem: true, substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "320.00", estimationRate: "330.00", remarks: "Henkel 2K PU adhesive Part A" },
  { id: "ITM020", code: "RM-ADH-002", name: "LAMINATION ADHESIVE SOLVENT FREE", category: "Raw Material (RM)", group: "Adhesive", subGroup: "Lamination Adhesive", hsnCode: "3506", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Flint Group India", reOrderQty: "100", minStockQty: "50", shelfLife: "180", leadTime: "21", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "290.00", estimationRate: "300.00", remarks: "Solvent-free lamination adhesive" },
  { id: "ITM021", code: "RM-ADH-003", name: "SOLVENT BASED ADHESIVE", category: "Raw Material (RM)", group: "Adhesive", subGroup: "Solvent Based Adhesive", hsnCode: "3506", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Bostik India", reOrderQty: "100", minStockQty: "50", shelfLife: "365", leadTime: "14", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "275.00", estimationRate: "285.00", remarks: "" },
  // ── Hardners ──
  { id: "ITM022", code: "RM-HDR-001", name: "PU HARDENER (PART B)", category: "Raw Material (RM)", group: "Hardner", subGroup: "PU Hardener", hsnCode: "3506", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Henkel India", supplierRef: "HNK-HDR-B", reOrderQty: "50", minStockQty: "20", shelfLife: "180", leadTime: "21", isRegularItem: true, substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "380.00", estimationRate: "395.00", remarks: "Henkel 2K PU hardener Part B — ratio 10:1 with Part A" },
  { id: "ITM023", code: "RM-HDR-002", name: "ADHESIVE HARDENER STANDARD", category: "Raw Material (RM)", group: "Hardner", subGroup: "Adhesive Hardener", hsnCode: "3506", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Flint Group India", reOrderQty: "30", minStockQty: "10", shelfLife: "180", leadTime: "21", substrate: "", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "350.00", estimationRate: "365.00", remarks: "Standard adhesive hardener" },
  // ── Misc ──
  { id: "ITM012", code: "RM-ADD-001", name: "SLIP ADDITIVE MASTERBATCH", category: "Raw Material (RM)", group: "Film", subGroup: "Slip Agents", hsnCode: "3920", gstRate: "18%", stockUom: "Kg", active: true, ...ib, supplier: "Cabot India", density: "1.0", reOrderQty: "50", minStockQty: "20", leadTime: "14", isStandardItem: true, substrate: "PE", webWidth: "", thickness: "", shrinkage: "0", purchaseRate: "220.00", estimationRate: "225.00", remarks: "Erucamide based slip agent" },
];

// ─── RAW MATERIALS ───────────────────────────────────────────
export const rawMaterials: RawMaterial[] = [
  { id: "RM001", code: "RM001", name: "LLDPE C4 Grade", type: "Polymer", category: "Polymer", subGroupId: "SG001", subGroupName: "LLDPE Grade", unit: "Kg", stockUnit: "Kg", purchaseUnit: "MT", density: 0.920, gsm: 0.920, currentStock: 12500, reorderLevel: 3000, rate: 95, supplier: "Reliance Industries", status: "Active" },
  { id: "RM002", code: "RM002", name: "LLDPE C6 Grade", type: "Polymer", category: "Polymer", subGroupId: "SG001", subGroupName: "LLDPE Grade", unit: "Kg", stockUnit: "Kg", purchaseUnit: "MT", density: 0.918, gsm: 0.918, currentStock: 8500, reorderLevel: 2000, rate: 98, supplier: "GAIL India", status: "Active" },
  { id: "RM003", code: "RM003", name: "HDPE Film Grade", type: "Polymer", category: "Polymer", subGroupId: "SG002", subGroupName: "HDPE Grade", unit: "Kg", stockUnit: "Kg", purchaseUnit: "MT", density: 0.955, gsm: 0.955, currentStock: 8000, reorderLevel: 2000, rate: 105, supplier: "GAIL India", status: "Active" },
  { id: "RM004", code: "RM004", name: "LDPE LD150", type: "Polymer", category: "Polymer", subGroupId: "SG003", subGroupName: "LDPE Grade", unit: "Kg", stockUnit: "Kg", purchaseUnit: "MT", density: 0.924, gsm: 0.924, currentStock: 6500, reorderLevel: 1500, rate: 98, supplier: "Reliance Industries", status: "Active" },
  { id: "RM005", code: "RM005", name: "PP Copolymer", type: "Polymer", category: "Polymer", subGroupId: "SG004", subGroupName: "PP Grade", unit: "Kg", stockUnit: "Kg", purchaseUnit: "MT", density: 0.905, gsm: 0.905, currentStock: 4000, reorderLevel: 1000, rate: 102, supplier: "Haldia Petrochemicals", status: "Active" },
  { id: "RM006", code: "RM006", name: "White Masterbatch", type: "Additive", category: "Additive", subGroupId: "SG010", subGroupName: "Masterbatches", unit: "Kg", stockUnit: "Kg", purchaseUnit: "Kg", density: 1.650, gsm: 1.650, currentStock: 1200, reorderLevel: 300, rate: 185, supplier: "Clariant Chemicals", status: "Active" },
  { id: "RM007", code: "RM007", name: "Slip Additive MB", type: "Additive", category: "Additive", subGroupId: "SG009", subGroupName: "Slip Agents", unit: "Kg", stockUnit: "Kg", purchaseUnit: "Kg", density: 0.970, gsm: 0.970, currentStock: 550, reorderLevel: 150, rate: 220, supplier: "Clariant Chemicals", status: "Active" },
  { id: "RM008", code: "RM008", name: "Yellow Ink (Solvent)", type: "Ink", category: "Ink", subGroupId: "SG006", subGroupName: "Solvent Inks", unit: "Kg", stockUnit: "Kg", purchaseUnit: "Kg", density: 1.050, gsm: 1.050, currentStock: 350, reorderLevel: 100, rate: 450, supplier: "Siegwerk India", status: "Active" },
  { id: "RM009", code: "RM009", name: "Cyan Ink (Solvent)", type: "Ink", category: "Ink", subGroupId: "SG006", subGroupName: "Solvent Inks", unit: "Kg", stockUnit: "Kg", purchaseUnit: "Kg", density: 1.060, gsm: 1.060, currentStock: 280, reorderLevel: 100, rate: 480, supplier: "Siegwerk India", status: "Active" },
  { id: "RM010", code: "RM010", name: "Magenta Ink (Solvent)", type: "Ink", category: "Ink", subGroupId: "SG006", subGroupName: "Solvent Inks", unit: "Kg", stockUnit: "Kg", purchaseUnit: "Kg", density: 1.055, gsm: 1.055, currentStock: 310, reorderLevel: 100, rate: 490, supplier: "Siegwerk India", status: "Active" },
  { id: "RM011", code: "RM011", name: "Black Ink (Solvent)", type: "Ink", category: "Ink", subGroupId: "SG006", subGroupName: "Solvent Inks", unit: "Kg", stockUnit: "Kg", purchaseUnit: "Kg", density: 1.070, gsm: 1.070, currentStock: 420, reorderLevel: 150, rate: 420, supplier: "Huber Group", status: "Active" },
  { id: "RM012", code: "RM012", name: "PU Adhesive (Dry Bond)", type: "Chemical", category: "Chemical", subGroupId: "SG008", subGroupName: "Adhesives", unit: "Kg", stockUnit: "Kg", purchaseUnit: "Kg", density: 1.120, gsm: 1.120, currentStock: 800, reorderLevel: 200, rate: 320, supplier: "Henkel India", status: "Active" },
];

// ─── ROLL MASTER ─────────────────────────────────────────────
export const rollMasters: RollMaster[] = [
  { id: "RL001", code: "RL001", name: "PE Shrink Roll 400mm", width: 400, thickness: 40, density: 0.920, micron: 40, stockUnit: "Kg", purchaseUnit: "Roll", description: "40μ PE shrink film – food grade", jobName: "PE Shrink Wrap – Food Grade", status: "Active" },
  { id: "RL002", code: "RL002", name: "BOPP Lamination Roll 300mm", width: 300, thickness: 20, density: 0.905, micron: 20, stockUnit: "Kg", purchaseUnit: "Roll", description: "20μ BOPP for lamination", jobName: "BOPP Lamination Film", status: "Active" },
  { id: "RL003", code: "RL003", name: "HDPE Carry Roll 500mm", width: 500, thickness: 80, density: 0.955, micron: 80, stockUnit: "Kg", purchaseUnit: "Roll", description: "80μ HDPE carry bag roll", jobName: "HDPE Carry Bag Film", status: "Active" },
  { id: "RL004", code: "RL004", name: "CPP Cast Roll 380mm", width: 380, thickness: 30, density: 0.905, micron: 30, stockUnit: "Kg", purchaseUnit: "Roll", description: "30μ CPP cast film", jobName: "CPP Cast Film Job", status: "Active" },
  { id: "RL005", code: "RL005", name: "PVC Shrink Roll 250mm", width: 250, thickness: 50, density: 1.380, micron: 50, stockUnit: "Kg", purchaseUnit: "Roll", description: "50μ PVC shrink label roll", jobName: "PVC Shrink Label Job", status: "Active" },
  { id: "RL006", code: "RL006", name: "5-Layer Barrier Roll 400mm", width: 400, thickness: 80, density: 0.940, micron: 80, stockUnit: "Kg", purchaseUnit: "Roll", description: "80μ 5-layer barrier film roll", jobName: "Barrier Film – Snack Packaging", status: "Active" },
];

// ─── RECIPES ─────────────────────────────────────────────────
export const recipes: Recipe[] = [
  {
    id: "RCP001", code: "RCP001", name: "3-Layer PE Shrink",
    description: "Standard 3-layer PE shrink film for food packaging",
    status: "Active", createdAt: "2024-01-10",
    layerRatio: "1:2:1", rollMasterId: "RL001", micronFrom: 30, micronTo: 60,
    layers: [
      {
        layerNo: 1, name: "Skin Layer (Inner)",
        materials: [
          { rawMaterialId: "RM001", rawMaterialName: "LLDPE C4 Grade", percentage: 80, density: 0.920, rate: 95 },
          { rawMaterialId: "RM007", rawMaterialName: "Slip Additive MB", percentage: 20, density: 0.970, rate: 220 },
        ],
        blendDensity: 0.930, blendRate: 120,
      },
      {
        layerNo: 2, name: "Core Layer (Middle)",
        materials: [
          { rawMaterialId: "RM002", rawMaterialName: "LLDPE C6 Grade", percentage: 70, density: 0.918, rate: 98 },
          { rawMaterialId: "RM004", rawMaterialName: "LDPE LD150", percentage: 30, density: 0.924, rate: 98 },
        ],
        blendDensity: 0.920, blendRate: 98,
      },
      {
        layerNo: 3, name: "Skin Layer (Outer)",
        materials: [
          { rawMaterialId: "RM001", rawMaterialName: "LLDPE C4 Grade", percentage: 75, density: 0.920, rate: 95 },
          { rawMaterialId: "RM006", rawMaterialName: "White Masterbatch", percentage: 15, density: 1.650, rate: 185 },
          { rawMaterialId: "RM007", rawMaterialName: "Slip Additive MB", percentage: 10, density: 0.970, rate: 220 },
        ],
        blendDensity: 0.969, blendRate: 124.25,
      },
    ],
  },
  {
    id: "RCP002", code: "RCP002", name: "2-Layer HDPE Film",
    description: "High-strength 2-layer HDPE film for carry bags",
    status: "Active", createdAt: "2024-01-20",
    layerRatio: "1:1", rollMasterId: "RL003", micronFrom: 60, micronTo: 100,
    layers: [
      {
        layerNo: 1, name: "Inner Layer",
        materials: [
          { rawMaterialId: "RM003", rawMaterialName: "HDPE Film Grade", percentage: 90, density: 0.955, rate: 105 },
          { rawMaterialId: "RM007", rawMaterialName: "Slip Additive MB", percentage: 10, density: 0.970, rate: 220 },
        ],
        blendDensity: 0.957, blendRate: 116.5,
      },
      {
        layerNo: 2, name: "Outer Layer",
        materials: [
          { rawMaterialId: "RM003", rawMaterialName: "HDPE Film Grade", percentage: 85, density: 0.955, rate: 105 },
          { rawMaterialId: "RM006", rawMaterialName: "White Masterbatch", percentage: 15, density: 1.650, rate: 185 },
        ],
        blendDensity: 1.059, blendRate: 117.5,
      },
    ],
  },
  {
    id: "RCP003", code: "RCP003", name: "5-Layer Barrier Film",
    description: "High-barrier 5-layer film for snack packaging",
    status: "Active", createdAt: "2024-02-05",
    layerRatio: "2:1:2:1:2", rollMasterId: "RL006", micronFrom: 60, micronTo: 100,
    layers: [
      { layerNo: 1, name: "Heat Seal Layer", materials: [{ rawMaterialId: "RM005", rawMaterialName: "PP Copolymer", percentage: 100, density: 0.905, rate: 102 }], blendDensity: 0.905, blendRate: 102 },
      { layerNo: 2, name: "Tie Layer A", materials: [{ rawMaterialId: "RM002", rawMaterialName: "LLDPE C6 Grade", percentage: 100, density: 0.918, rate: 98 }], blendDensity: 0.918, blendRate: 98 },
      {
        layerNo: 3, name: "Barrier Core",
        materials: [
          { rawMaterialId: "RM001", rawMaterialName: "LLDPE C4 Grade", percentage: 60, density: 0.920, rate: 95 },
          { rawMaterialId: "RM006", rawMaterialName: "White Masterbatch", percentage: 40, density: 1.650, rate: 185 },
        ],
        blendDensity: 1.212, blendRate: 131,
      },
      { layerNo: 4, name: "Tie Layer B", materials: [{ rawMaterialId: "RM002", rawMaterialName: "LLDPE C6 Grade", percentage: 100, density: 0.918, rate: 98 }], blendDensity: 0.918, blendRate: 98 },
      {
        layerNo: 5, name: "Outer Sealant",
        materials: [
          { rawMaterialId: "RM001", rawMaterialName: "LLDPE C4 Grade", percentage: 80, density: 0.920, rate: 95 },
          { rawMaterialId: "RM007", rawMaterialName: "Slip Additive MB", percentage: 20, density: 0.970, rate: 220 },
        ],
        blendDensity: 0.930, blendRate: 120,
      },
    ],
  },
];

// ─── PROCESS MASTER ──────────────────────────────────────────
const bp = { processCategory: "Main Process" as const, minimumCharges: "", minQtyToCharge: "", makeSetupCharges: false, setupChargeAmount: "", processWastePct: "", processWasteFlat: "", isOnlineProduction: true, displayInQuotation: true, status: "Active" as const };
export const processMasters: ProcessMaster[] = [
  // ── ROTOGRAVURE ──────────────────────────────────────────
  // Pre-Press
  { id: "PR001", code: "PR001", name: "Cylinder Engraving", displayName: "Cyl Engrave", module: "Rotogravure", department: "Pre-Press", chargeType: "Per Cylinder", rate: "3500", chargeUnit: "Cylinder", machineIds: ["M001"], description: "Electromechanical cylinder engraving per colour separation", ...bp },
  { id: "PR002", code: "PR002", name: "Cylinder Chrome Plating", displayName: "Chrome Plate", module: "Rotogravure", department: "Pre-Press", chargeType: "Per Cylinder", rate: "800", chargeUnit: "Cylinder", machineIds: ["M002"], description: "Hard chrome plating on engraved cylinder for press durability", ...bp },
  // Printing
  { id: "PR003", code: "PR003", name: "6-Color Roto Printing", displayName: "6 Clr Print", module: "Rotogravure", department: "Printing", chargeType: "Per m²", rate: "2.00", chargeUnit: "m²", machineIds: ["M004"], description: "Rotogravure surface/reverse printing – 6 colors", ...bp, makeSetupCharges: true, setupChargeAmount: "1200", processWastePct: "3" },
  { id: "PR004", code: "PR004", name: "8-Color Roto Printing", displayName: "8 Clr Print", module: "Rotogravure", department: "Printing", chargeType: "Per m²", rate: "2.50", chargeUnit: "m²", machineIds: ["M004","M005"], description: "Rotogravure surface/reverse printing – 8 colors", ...bp, makeSetupCharges: true, setupChargeAmount: "1500", processWastePct: "3" },
  { id: "PR005", code: "PR005", name: "9-Color Roto Printing", displayName: "9 Clr Print", module: "Rotogravure", department: "Printing", chargeType: "Per m²", rate: "2.80", chargeUnit: "m²", machineIds: ["M005"], description: "Rotogravure printing – 9 colors", ...bp, makeSetupCharges: true, setupChargeAmount: "1800", processWastePct: "3" },
  { id: "PR006", code: "PR006", name: "10-Color Roto Printing", displayName: "10 Clr Print", module: "Rotogravure", department: "Printing", chargeType: "Per m²", rate: "3.00", chargeUnit: "m²", machineIds: ["M006"], description: "Rotogravure printing – 10 colors with coating deck", ...bp, makeSetupCharges: true, setupChargeAmount: "2000", processWastePct: "3" },
  // Lamination
  { id: "PR007", code: "PR007", name: "Dry Bond Lamination", displayName: "Dry Lam", module: "Rotogravure", department: "Lamination", chargeType: "Per m²", rate: "1.80", chargeUnit: "m²", machineIds: ["M007","M008"], description: "Solvent-based dry bond adhesive lamination", ...bp, processWastePct: "1.5" },
  { id: "PR008", code: "PR008", name: "Solventless Lamination", displayName: "SL Lam", module: "Rotogravure", department: "Lamination", chargeType: "Per m²", rate: "1.60", chargeUnit: "m²", machineIds: ["M009"], description: "Solventless 2-component adhesive lamination", ...bp, processWastePct: "1.5" },
  { id: "PR009", code: "PR009", name: "Extrusion Lamination (PE)", displayName: "Ext Lam", module: "Rotogravure", department: "Lamination", chargeType: "Per m²", rate: "2.20", chargeUnit: "m²", machineIds: ["M010"], description: "PE extrusion coating / lamination", ...bp, processWastePct: "2" },
  // Coating
  { id: "PR010", code: "PR010", name: "Matte OPV Coating", displayName: "Matte OPV", module: "Rotogravure", department: "Coating", chargeType: "Per m²", rate: "1.20", chargeUnit: "m²", machineIds: ["M004","M005"], description: "Matte over-print varnish via roto deck", ...bp, processCategory: "Sub Process" },
  { id: "PR011", code: "PR011", name: "Gloss OPV Coating", displayName: "Gloss OPV", module: "Rotogravure", department: "Coating", chargeType: "Per m²", rate: "1.00", chargeUnit: "m²", machineIds: ["M004","M005"], description: "Gloss OPV coating via roto deck", ...bp, processCategory: "Sub Process" },
  { id: "PR012", code: "PR012", name: "Heat Seal Coating", displayName: "HS Coat", module: "Rotogravure", department: "Coating", chargeType: "Per m²", rate: "0.90", chargeUnit: "m²", machineIds: ["M004","M006"], description: "Heat seal lacquer coating for sealing layer", ...bp, processCategory: "Sub Process" },
  // Slitting
  { id: "PR013", code: "PR013", name: "Slitting & Rewinding", displayName: "Slitting", module: "Rotogravure", department: "Slitting", chargeType: "Per m", rate: "0.60", chargeUnit: "m", machineIds: ["M011","M012"], description: "Slitting to customer specified widths", ...bp, processWastePct: "0.5" },
  { id: "PR014", code: "PR014", name: "Log Slitting", displayName: "Log Slit", module: "Rotogravure", department: "Slitting", chargeType: "Per m", rate: "0.50", chargeUnit: "m", machineIds: ["M013"], description: "Master roll log slitting before lamination", ...bp },
  // Pouch Making
  { id: "PR015", code: "PR015", name: "3-Side Seal Pouch Making", displayName: "3SS Pouch", module: "Rotogravure", department: "Pouch Making", chargeType: "Per 1000 Pcs", rate: "180", chargeUnit: "1000 Pcs", machineIds: ["M014"], description: "3-side seal flat pouch forming and sealing", ...bp, processWastePct: "2" },
  { id: "PR016", code: "PR016", name: "4-Side Seal Pouch Making", displayName: "4SS Pouch", module: "Rotogravure", department: "Pouch Making", chargeType: "Per 1000 Pcs", rate: "220", chargeUnit: "1000 Pcs", machineIds: ["M014"], description: "4-side seal flat pouch", ...bp, processWastePct: "2" },
  { id: "PR017", code: "PR017", name: "Center Seal (Back Seal) Pouch", displayName: "Back Seal", module: "Rotogravure", department: "Pouch Making", chargeType: "Per 1000 Pcs", rate: "160", chargeUnit: "1000 Pcs", machineIds: ["M015"], description: "Tube formed center back-seal pouch", ...bp, processWastePct: "2" },
  { id: "PR018", code: "PR018", name: "Stand-up Pouch (SUP)", displayName: "SUP", module: "Rotogravure", department: "Pouch Making", chargeType: "Per 1000 Pcs", rate: "280", chargeUnit: "1000 Pcs", machineIds: ["M015"], description: "Gusseted stand-up pouch with bottom seal", ...bp, processWastePct: "3" },
  { id: "PR019", code: "PR019", name: "Zip Lock Pouch", displayName: "Zip Pouch", module: "Rotogravure", department: "Pouch Making", chargeType: "Per 1000 Pcs", rate: "320", chargeUnit: "1000 Pcs", machineIds: ["M015"], description: "Reclosable zip-lock pouch", ...bp, processWastePct: "3" },
  // QC
  { id: "PR020", code: "PR020", name: "Inline Vision Inspection", displayName: "Inline QC", module: "Rotogravure", department: "QC", chargeType: "Per m", rate: "0.20", chargeUnit: "m", machineIds: ["M016"], description: "Automated camera-based inline print defect detection", ...bp },
  { id: "PR021", code: "PR021", name: "Final Inspection & Rewinding", displayName: "Final Insp", module: "Rotogravure", department: "QC", chargeType: "Per m", rate: "0.30", chargeUnit: "m", machineIds: ["M017"], description: "Manual + rewinder final inspection before dispatch", ...bp },
  // ── EXTRUSION ────────────────────────────────────────────
  // Blown Film Line
  { id: "EX001", code: "EX001", name: "Blown Film Extrusion", displayName: "Blown Film", module: "Extrusion", department: "Blown Film Line", chargeType: "Per Kg", rate: "8.00", chargeUnit: "Kg", machineIds: [], description: "Single-layer blown film production – LDPE / LLDPE / HDPE", ...bp, makeSetupCharges: true, setupChargeAmount: "500", processWastePct: "2" },
  { id: "EX002", code: "EX002", name: "3-Layer Co-Extrusion Blown Film", displayName: "3L Co-Ex", module: "Extrusion", department: "Blown Film Line", chargeType: "Per Kg", rate: "11.00", chargeUnit: "Kg", machineIds: [], description: "3-layer coextruded blown film – A/B/A or A/B/C structure", ...bp, makeSetupCharges: true, setupChargeAmount: "800", processWastePct: "2.5" },
  { id: "EX003", code: "EX003", name: "5-Layer Co-Extrusion Blown Film", displayName: "5L Co-Ex", module: "Extrusion", department: "Co-Extrusion", chargeType: "Per Kg", rate: "15.00", chargeUnit: "Kg", machineIds: [], description: "5-layer barrier co-extrusion – EVOH / PA / PE structures", ...bp, makeSetupCharges: true, setupChargeAmount: "1200", processWastePct: "3" },
  // Cast Film Line
  { id: "EX004", code: "EX004", name: "Cast Film Extrusion (CPP)", displayName: "Cast CPP", module: "Extrusion", department: "Cast Film Line", chargeType: "Per Kg", rate: "9.00", chargeUnit: "Kg", machineIds: [], description: "Cast polypropylene film (CPP) for heat seal and lamination", ...bp, makeSetupCharges: true, setupChargeAmount: "600", processWastePct: "2" },
  { id: "EX005", code: "EX005", name: "Cast Film Extrusion (CPE)", displayName: "Cast CPE", module: "Extrusion", department: "Cast Film Line", chargeType: "Per Kg", rate: "8.50", chargeUnit: "Kg", machineIds: [], description: "Cast polyethylene film for pouches and liners", ...bp, processWastePct: "2" },
  // Corona Treatment
  { id: "EX006", code: "EX006", name: "Corona Treatment (Online)", displayName: "Corona Treat", module: "Extrusion", department: "Corona Treatment", chargeType: "Per m", rate: "0.10", chargeUnit: "m", machineIds: [], description: "Inline corona surface treatment for improved ink adhesion", ...bp, processCategory: "Sub Process" },
  { id: "EX007", code: "EX007", name: "Corona Treatment (Offline)", displayName: "Corona Off", module: "Extrusion", department: "Corona Treatment", chargeType: "Per m", rate: "0.15", chargeUnit: "m", machineIds: [], description: "Offline corona treatment for pretreated rolls", ...bp, processCategory: "Sub Process" },
  // Slitting (Extrusion)
  { id: "EX008", code: "EX008", name: "Film Slitting & Rewinding", displayName: "Film Slit", module: "Extrusion", department: "Slitting (Extrusion)", chargeType: "Per m", rate: "0.40", chargeUnit: "m", machineIds: [], description: "Slitting master rolls to customer width after extrusion", ...bp, processWastePct: "0.5" },
  { id: "EX009", code: "EX009", name: "Trim & Edge Trim Recovery", displayName: "Edge Trim", module: "Extrusion", department: "Slitting (Extrusion)", chargeType: "Per Kg", rate: "2.00", chargeUnit: "Kg", machineIds: [], description: "Edge trim collection and regranulation", ...bp, processCategory: "Sub Process" },
  // Packing
  { id: "EX010", code: "EX010", name: "Roll Packing & Dispatch", displayName: "Roll Pack", module: "Extrusion", department: "Packing (Extrusion)", chargeType: "Per Job", rate: "150", chargeUnit: "Job", machineIds: [], description: "Packing finished extrusion rolls – poly wrap, core cap, carton labelling", ...bp },
];

// ─── HSN MASTER ──────────────────────────────────────────────
export const hsnMasters: HSNMaster[] = [
  { id: "HSN001", hsnCode: "3920", description: "Other plates, sheets, film, foil and strip of plastics – non-cellular", gstRate: 18, category: "Plastic Film" },
  { id: "HSN002", hsnCode: "3921", description: "Other plates, sheets, film, foil and strip of plastics – cellular", gstRate: 18, category: "Plastic Film" },
  { id: "HSN003", hsnCode: "3923", description: "Articles for conveyance or packing of goods – plastics", gstRate: 18, category: "Packaging" },
  { id: "HSN004", hsnCode: "3926", description: "Other articles of plastics", gstRate: 18, category: "Plastic Articles" },
  { id: "HSN005", hsnCode: "4811", description: "Paper, paperboard, cellulose wadding – coated/covered", gstRate: 12, category: "Paper Products" },
  { id: "HSN006", hsnCode: "3919", description: "Self-adhesive plates, sheets, film, foil, tape – plastics", gstRate: 18, category: "Adhesive Films" },
];

// ─── CUSTOMERS ───────────────────────────────────────────────
export const customers: Customer[] = [
  { id: "C001", code: "CUST001", name: "Parle Products Pvt Ltd", contact: "Ramesh Shah", phone: "9876543210", email: "ramesh@parle.com", city: "Mumbai", state: "Maharashtra", gst: "27AAACP1234A1ZR", status: "Active", createdAt: "2024-01-10" },
  { id: "C002", code: "CUST002", name: "Britannia Industries Ltd", contact: "Suresh Kumar", phone: "9823456781", email: "suresh@britannia.in", city: "Bengaluru", state: "Karnataka", gst: "29AABCB1234B1Z5", status: "Active", createdAt: "2024-01-15" },
  { id: "C003", code: "CUST003", name: "Haldiram Snacks Pvt Ltd", contact: "Manoj Agarwal", phone: "9712345678", email: "manoj@haldiram.com", city: "Delhi", state: "Delhi", gst: "07AABCH1234C1Z3", status: "Active", createdAt: "2024-02-01" },
  { id: "C004", code: "CUST004", name: "ITC Limited", contact: "Priya Nair", phone: "9654321098", email: "priya@itc.in", city: "Kolkata", state: "West Bengal", gst: "19AAACI1234D1Z7", status: "Active", createdAt: "2024-02-10" },
  { id: "C005", code: "CUST005", name: "Amul Dairy", contact: "Kiran Patel", phone: "9543210987", email: "kiran@amul.com", city: "Anand", state: "Gujarat", gst: "24AAACA1234E1Z1", status: "Active", createdAt: "2024-02-15" },
  { id: "C006", code: "CUST006", name: "Nestle India Ltd", contact: "Anita Mehta", phone: "9432109876", email: "anita@nestle.in", city: "Pune", state: "Maharashtra", gst: "27AAACN1234F1Z9", status: "Active", createdAt: "2024-03-01" },
  { id: "C007", code: "CUST007", name: "Dabur India Ltd", contact: "Deepak Sharma", phone: "9210987654", email: "deepak@dabur.com", city: "Ghaziabad", state: "Uttar Pradesh", gst: "09AAACD1234H1ZB", status: "Active", createdAt: "2024-03-15" },
];

// ─── PRODUCTS ────────────────────────────────────────────────
export const products: Product[] = [
  { id: "P001", code: "PROD001", name: "LLDPE Shrink Film 40μ", category: "Extrusion", unit: "Kg", width: 400, thickness: 40, gsm: 37, status: "Active" },
  { id: "P002", code: "PROD002", name: "BOPP Printed Film 20μ", category: "Roto Printing", unit: "Kg", width: 300, thickness: 20, gsm: 18, status: "Active" },
  { id: "P003", code: "PROD003", name: "PVC Shrink Label 50μ", category: "Both", unit: "Kg", width: 250, thickness: 50, gsm: 67, status: "Active" },
  { id: "P004", code: "PROD004", name: "HDPE Carry Bag Film 80μ", category: "Extrusion", unit: "Kg", width: 500, thickness: 80, gsm: 75, status: "Active" },
  { id: "P005", code: "PROD005", name: "Lamination Film 12μ", category: "Roto Printing", unit: "Kg", width: 350, thickness: 12, gsm: 11, status: "Active" },
  { id: "P006", code: "PROD006", name: "Barrier Film 5-Layer 80μ", category: "Both", unit: "Kg", width: 400, thickness: 80, gsm: 74, status: "Active" },
];

// ─── MACHINES ────────────────────────────────────────────────
const bm = { displayName: "", machineType: "", operator: "", branch: "Main Plant", isPlanningMachine: false, maxWebWidth: "", minWebWidth: "", speedMax: "", speedUnit: "m/min", electricConsumption: "", costPerHour: "", noOfColors: "", repeatLengthMin: "", repeatLengthMax: "", gripper: "", printingMargin: "", makeReadyWastage: "", makeReadyCharges: "", makeReadyTime: "", makeReadyTimeMode: "Fixed", makeReadyChargesPerHr: "", jobChangeOverTime: "", minPrintingImpr: "", basicPrintingCharged: "", roundImpWith: "", noOfUnwinds: "", adhesiveCoverage: "", noOfSlitters: "", minPouchSize: "", maxPouchSize: "", maxCylinderWidth: "", maxCircumference: "", chargeType: "Per Hour", wasteType: "", wasteCalcOn: "", perHourCostingParam: "Speed Based", refMachineCode: "" };
export const machines: Machine[] = [
  // Pre-Press
  { id: "M001", code: "CYL-01", name: "Cylinder Engraver 1", department: "Pre-Press", status: "Running", ...bm, displayName: "CYL-ENG-1", machineType: "Electromechanical Engraver", maxCylinderWidth: "1600", maxCircumference: "1200", costPerHour: "450", electricConsumption: "15", operator: "Mahesh Gupta" },
  { id: "M002", code: "CYL-02", name: "Chrome Plating Bath", department: "Pre-Press", status: "Running", ...bm, displayName: "Chrome Bath", machineType: "Chrome Plating", maxCylinderWidth: "1600", costPerHour: "120", operator: "Ramesh Patel" },
  // Printing
  { id: "M004", code: "ROTO-01", name: "Roto Press 1 – 8 Color", department: "Printing", status: "Running", ...bm, displayName: "ROTO-1", machineType: "Rotogravure Press", noOfColors: "8", maxWebWidth: "1300", minWebWidth: "200", speedMax: "150", repeatLengthMin: "300", repeatLengthMax: "1200", gripper: "10", printingMargin: "15", makeReadyWastage: "50", makeReadyCharges: "1500", makeReadyTime: "20", makeReadyTimeMode: "Per Color", makeReadyChargesPerHr: "1200", jobChangeOverTime: "30", minPrintingImpr: "500", basicPrintingCharged: "800", roundImpWith: "100", electricConsumption: "80", costPerHour: "1200", operator: "Amit Tiwari" },
  { id: "M005", code: "ROTO-02", name: "Roto Press 2 – 9 Color", department: "Printing", status: "Running", ...bm, displayName: "ROTO-2", machineType: "Rotogravure Press", noOfColors: "9", maxWebWidth: "1450", minWebWidth: "200", speedMax: "160", repeatLengthMin: "300", repeatLengthMax: "1400", gripper: "10", printingMargin: "15", makeReadyWastage: "55", makeReadyCharges: "1800", makeReadyTime: "20", makeReadyTimeMode: "Per Color", makeReadyChargesPerHr: "1300", jobChangeOverTime: "30", minPrintingImpr: "500", basicPrintingCharged: "900", roundImpWith: "100", electricConsumption: "90", costPerHour: "1350", operator: "Deepak Verma" },
  { id: "M006", code: "ROTO-03", name: "Roto Press 3 – 10 Color", department: "Printing", status: "Maintenance", ...bm, displayName: "ROTO-3", machineType: "Rotogravure Press", noOfColors: "10", maxWebWidth: "3500", minWebWidth: "200", speedMax: "180", repeatLengthMin: "300", repeatLengthMax: "1500", gripper: "10", printingMargin: "15", makeReadyWastage: "60", makeReadyCharges: "2000", makeReadyTime: "22", makeReadyTimeMode: "Per Color", makeReadyChargesPerHr: "1400", jobChangeOverTime: "35", minPrintingImpr: "500", basicPrintingCharged: "1000", roundImpWith: "100", electricConsumption: "95", costPerHour: "1400", operator: "Santosh Rao" },
  { id: "M003", code: "ROTO-04", name: "Roto Press 4 – 6 Color", department: "Printing", status: "Idle", ...bm, displayName: "ROTO-4", machineType: "Rotogravure Press", noOfColors: "6", maxWebWidth: "1100", minWebWidth: "150", speedMax: "120", repeatLengthMin: "250", repeatLengthMax: "1000", gripper: "10", printingMargin: "12", makeReadyWastage: "40", makeReadyCharges: "1200", makeReadyTime: "18", makeReadyTimeMode: "Per Color", makeReadyChargesPerHr: "1000", jobChangeOverTime: "25", minPrintingImpr: "500", basicPrintingCharged: "700", roundImpWith: "100", electricConsumption: "65", costPerHour: "1000", operator: "Vikram Singh" },
  // Lamination
  { id: "M007", code: "LAM-01", name: "Dry Bond Laminator 1", department: "Lamination", status: "Running", ...bm, displayName: "LAM-1", machineType: "Dry Bond", maxWebWidth: "1300", minWebWidth: "150", speedMax: "200", noOfUnwinds: "2", adhesiveCoverage: "2.5–4.5", electricConsumption: "55", costPerHour: "650", operator: "Suresh Bhatia" },
  { id: "M008", code: "LAM-02", name: "Dry Bond Laminator 2", department: "Lamination", status: "Running", ...bm, displayName: "LAM-2", machineType: "Dry Bond", maxWebWidth: "1450", minWebWidth: "150", speedMax: "220", noOfUnwinds: "2", adhesiveCoverage: "2.5–4.5", electricConsumption: "60", costPerHour: "700", operator: "Anil Kumar" },
  { id: "M009", code: "LAM-03", name: "Solventless Laminator", department: "Lamination", status: "Running", ...bm, displayName: "SL-LAM", machineType: "Solventless", maxWebWidth: "1350", minWebWidth: "150", speedMax: "250", noOfUnwinds: "2", adhesiveCoverage: "1.5–3.0", electricConsumption: "40", costPerHour: "600", operator: "Manoj Sharma" },
  { id: "M010", code: "LAM-04", name: "Extrusion Laminator", department: "Lamination", status: "Idle", ...bm, displayName: "EXT-LAM", machineType: "Extrusion Lamination", maxWebWidth: "1200", minWebWidth: "150", speedMax: "120", noOfUnwinds: "3", electricConsumption: "90", costPerHour: "850", operator: "Ravi Yadav" },
  // Slitting
  { id: "M011", code: "SLT-01", name: "Duplex Slitter 1", department: "Slitting", status: "Running", ...bm, displayName: "SLT-1", machineType: "Duplex Slitter", maxWebWidth: "1400", minWebWidth: "30", speedMax: "400", noOfSlitters: "16", electricConsumption: "18", costPerHour: "300", operator: "Naresh Verma" },
  { id: "M012", code: "SLT-02", name: "Duplex Slitter 2", department: "Slitting", status: "Running", ...bm, displayName: "SLT-2", machineType: "Duplex Slitter", maxWebWidth: "1600", minWebWidth: "30", speedMax: "450", noOfSlitters: "18", electricConsumption: "20", costPerHour: "320", operator: "Prakash Singh" },
  { id: "M013", code: "SLT-03", name: "Simplex Rewinder", department: "Slitting", status: "Idle", ...bm, displayName: "REWINDER", machineType: "Simplex Rewinder", maxWebWidth: "1300", minWebWidth: "50", speedMax: "350", electricConsumption: "12", costPerHour: "200", operator: "Dinesh Kumar" },
  // Pouch Making
  { id: "M014", code: "PCH-01", name: "Pouch Machine 1 – 3SS / 4SS", department: "Pouch Making", status: "Running", ...bm, displayName: "PCH-1", machineType: "3-Side Seal / 4-Side Seal", maxWebWidth: "800", minWebWidth: "80", speedMax: "80", speedUnit: "pcs/min", minPouchSize: "80×60", maxPouchSize: "400×500", electricConsumption: "12", costPerHour: "400", operator: "Geeta Rawat" },
  { id: "M015", code: "PCH-02", name: "Pouch Machine 2 – SUP / Back Seal", department: "Pouch Making", status: "Running", ...bm, displayName: "PCH-2", machineType: "Stand-up / Back Seal", maxWebWidth: "600", minWebWidth: "60", speedMax: "60", speedUnit: "pcs/min", minPouchSize: "80×100", maxPouchSize: "300×450", electricConsumption: "10", costPerHour: "380", operator: "Seema Joshi" },
  // QC
  { id: "M016", code: "QC-01", name: "Inline Vision Inspection Camera", department: "QC", status: "Running", ...bm, displayName: "QC-VISION", machineType: "Vision Inspection", maxWebWidth: "1600", speedMax: "200", electricConsumption: "8", costPerHour: "250", operator: "Mohan Das" },
  { id: "M017", code: "QC-02", name: "Rewinder Inspection", department: "QC", status: "Running", ...bm, displayName: "QC-REWINDER", machineType: "Rewinder", maxWebWidth: "1400", speedMax: "200", electricConsumption: "10", costPerHour: "180", operator: "Priya Sharma" },
];

// ─── EMPLOYEES ───────────────────────────────────────────────
export const employees: Employee[] = [
  { id: "E001", code: "EMP001", name: "Rajesh Kumar", department: "Extrusion", designation: "Machine Operator", shift: "A", phone: "9876543210", status: "Active" },
  { id: "E002", code: "EMP002", name: "Sunil Yadav", department: "Extrusion", designation: "Machine Operator", shift: "B", phone: "9765432109", status: "Active" },
  { id: "E003", code: "EMP003", name: "Prakash Joshi", department: "Extrusion", designation: "Senior Operator", shift: "C", phone: "9654321098", status: "Active" },
  { id: "E004", code: "EMP004", name: "Amit Tiwari", department: "Rotogravure", designation: "Press Operator", shift: "A", phone: "9543210987", status: "Active" },
  { id: "E005", code: "EMP005", name: "Deepak Verma", department: "Rotogravure", designation: "Press Operator", shift: "B", phone: "9432109876", status: "Active" },
  { id: "E006", code: "EMP006", name: "Santosh Rao", department: "Rotogravure", designation: "Senior Press Operator", shift: "A", phone: "9321098765", status: "Active" },
  { id: "E007", code: "EMP007", name: "Mohan Das", department: "Quality", designation: "QC Inspector", shift: "A", phone: "9210987654", status: "Active" },
  { id: "E008", code: "EMP008", name: "Priya Sharma", department: "Dispatch", designation: "Dispatch Executive", shift: "A", phone: "9109876543", status: "Active" },
];

// ─── LEDGER MASTER ───────────────────────────────────────────
const emptyLedgerFields = {
  contactPerson: "", phone: "", email: "", address: "", city: "", state: "", pincode: "",
  department: "", designation: "", shift: "", dateOfJoining: "",
  gst: "", pan: "", creditLimit: "", paymentTerms: "", bankAccount: "", ifsc: "", bankName: "",
  hsn: "", taxRate: "", description: "",
};
export const ledgers: Ledger[] = [
  { id: "L001", code: "LED001", ledgerType: "Employee", name: "Rajesh Kumar", status: "Active", ...emptyLedgerFields, phone: "9876543210", email: "rajesh@ajshrink.com", department: "Extrusion", designation: "Machine Operator", shift: "A", dateOfJoining: "2020-01-15" },
  { id: "L002", code: "LED002", ledgerType: "Employee", name: "Priya Sharma", status: "Active", ...emptyLedgerFields, phone: "9109876543", email: "priya@ajshrink.com", department: "Dispatch", designation: "Dispatch Executive", shift: "A", dateOfJoining: "2021-06-01" },
  { id: "L003", code: "LED003", ledgerType: "Client", name: "Parle Products Pvt Ltd", status: "Active", ...emptyLedgerFields, contactPerson: "Vivek Mehta", phone: "9812345678", email: "purchase@parle.com", city: "Mumbai", state: "Maharashtra", gst: "27AABCP1234A1Z5", pan: "AABCP1234A", creditLimit: "500000", paymentTerms: "30 Days" },
  { id: "L004", code: "LED004", ledgerType: "Client", name: "ITC Limited", status: "Active", ...emptyLedgerFields, contactPerson: "Ravi Agarwal", phone: "9823456789", email: "procurement@itc.com", city: "Kolkata", state: "West Bengal", gst: "19AAACI1234B1Z3", pan: "AAACI1234B", creditLimit: "1000000", paymentTerms: "45 Days" },
  { id: "L005", code: "LED005", ledgerType: "Supplier", name: "Cosmo Films Ltd", status: "Active", ...emptyLedgerFields, contactPerson: "Anand Kapoor", phone: "9734567890", email: "sales@cosmofilms.com", city: "Aurangabad", state: "Maharashtra", gst: "27AABCC5678D1Z1", pan: "AABCC5678D", paymentTerms: "30 Days", bankAccount: "123456789012", ifsc: "HDFC0001234", bankName: "HDFC Bank" },
  { id: "L006", code: "LED006", ledgerType: "Supplier", name: "Toyo Ink India Pvt Ltd", status: "Active", ...emptyLedgerFields, contactPerson: "Shyam Verma", phone: "9645678901", email: "inquiry@toyoink.in", city: "Silvassa", state: "Dadra & NH", gst: "26AABCT1111E1Z7", pan: "AABCT1111E", paymentTerms: "45 Days" },
  { id: "L007", code: "LED007", ledgerType: "Consignee", name: "Parle – Neemrana Depot", status: "Active", ...emptyLedgerFields, contactPerson: "Suresh Goyal", phone: "9556789012", email: "neemrana@parle.com", address: "Plot 12, RIICO Industrial Area", city: "Neemrana", state: "Rajasthan", pincode: "301705", gst: "08AABCP1234A1ZX" },
  { id: "L008", code: "LED008", ledgerType: "Transporter", name: "Blue Dart Express Ltd", status: "Active", ...emptyLedgerFields, contactPerson: "Kiran Logistics", phone: "9467890123", email: "ops@bluedart.com", city: "Jaipur", state: "Rajasthan", gst: "08AABCB2345F1Z9", pan: "AABCB2345F" },
  { id: "L009", code: "LED009", ledgerType: "Vendor", name: "Agarwal Traders", status: "Active", ...emptyLedgerFields, contactPerson: "Ramesh Agarwal", phone: "9378901234", email: "agarwal.traders@gmail.com", city: "Bhiwadi", state: "Rajasthan", gst: "08AAAAA1234C1ZP", pan: "AAAAA1234C", paymentTerms: "15 Days" },
  { id: "L010", code: "LED010", ledgerType: "Sales A/C", name: "Domestic Sales – Shrink Film", status: "Active", ...emptyLedgerFields, hsn: "39201019", taxRate: "18", description: "Sales account for domestic shrink film billing" },
];

// ─── COST ESTIMATIONS ────────────────────────────────────────
export const costEstimations: CostEstimation[] = [
  {
    id: "EST001", estimationNo: "EST-2024-001", date: "2024-03-05",
    customerId: "C001", customerName: "Parle Products Pvt Ltd",
    recipeId: "RCP001", recipeName: "3-Layer PE Shrink",
    rollMasterId: "RL001", rollName: "PE Shrink Roll 400mm", rollWidth: 400,
    totalMicron: 40, layerMicrons: [10, 20, 10],
    layerResults: [
      { layerNo: 1, layerName: "Skin Layer (Inner)", micron: 10, density: 0.930, gsm: 9.30, consumptionPerSqM: 0.00930, blendRate: 120, costPerSqM: 1.116 },
      { layerNo: 2, layerName: "Core Layer (Middle)", micron: 20, density: 0.920, gsm: 18.40, consumptionPerSqM: 0.01840, blendRate: 98, costPerSqM: 1.803 },
      { layerNo: 3, layerName: "Skin Layer (Outer)", micron: 10, density: 0.969, gsm: 9.69, consumptionPerSqM: 0.00969, blendRate: 124.25, costPerSqM: 1.204 },
    ],
    totalGSM: 37.39, totalCostPerSqM: 4.123,
    machineCostPerSqM: 0.80, labourCostPerSqM: 0.20, overheadCostPerSqM: 0.40,
    sellingPricePerKg: 130, totalCostPerKg: 113.50, marginPct: 12.7,
    estimatedDays: 7, deliveryDate: "2024-03-20",
    requiredMaterials: [
      { materialName: "LLDPE C4 Grade", quantityKg: 1250, ratePerKg: 95, totalCost: 118750 },
      { materialName: "LLDPE C6 Grade", quantityKg: 840, ratePerKg: 98, totalCost: 82320 },
      { materialName: "LDPE LD150", quantityKg: 360, ratePerKg: 98, totalCost: 35280 },
      { materialName: "White Masterbatch", quantityKg: 225, ratePerKg: 185, totalCost: 41625 },
      { materialName: "Slip Additive MB", quantityKg: 125, ratePerKg: 220, totalCost: 27500 },
    ],
    status: "Approved",
  },
];

// ─── ENQUIRIES ───────────────────────────────────────────────
export const enquiries: Enquiry[] = [
  { id: "ENQ001", enquiryNo: "ENQ-2024-001", date: "2024-03-01", customerId: "C001", customerName: "Parle Products Pvt Ltd", productId: "P001", productName: "LLDPE Shrink Film 40μ", quantity: 5000, unit: "Kg", width: 400, thickness: 40, printingRequired: false, printingColors: 0, remarks: "Standard food grade quality", status: "Converted" },
  { id: "ENQ002", enquiryNo: "ENQ-2024-002", date: "2024-03-05", customerId: "C002", customerName: "Britannia Industries Ltd", productId: "P002", productName: "BOPP Printed Film 20μ", quantity: 3000, unit: "Kg", width: 300, thickness: 20, printingRequired: true, printingColors: 6, remarks: "6-color print, Pantone matching", status: "Estimated" },
  { id: "ENQ003", enquiryNo: "ENQ-2024-003", date: "2024-03-08", customerId: "C003", customerName: "Haldiram Snacks Pvt Ltd", productId: "P006", productName: "Barrier Film 5-Layer 80μ", quantity: 8000, unit: "Kg", width: 400, thickness: 80, printingRequired: true, printingColors: 8, remarks: "High-barrier snack packaging, urgent", status: "Pending" },
  { id: "ENQ004", enquiryNo: "ENQ-2024-004", date: "2024-03-10", customerId: "C004", customerName: "ITC Limited", productId: "P004", productName: "HDPE Carry Bag Film 80μ", quantity: 10000, unit: "Kg", width: 500, thickness: 80, printingRequired: false, printingColors: 0, remarks: "Bulk order", status: "Converted" },
  { id: "ENQ005", enquiryNo: "ENQ-2024-005", date: "2024-03-12", customerId: "C005", customerName: "Amul Dairy", productId: "P005", productName: "Lamination Film 12μ", quantity: 2000, unit: "Kg", width: 350, thickness: 12, printingRequired: true, printingColors: 4, remarks: "Food grade lamination film", status: "Pending" },
];

// ─── ORDERS ──────────────────────────────────────────────────
export const orders: Order[] = [
  { id: "ORD001", orderNo: "ORD-2024-001", date: "2024-03-06", enquiryId: "ENQ001", estimationId: "EST001", customerId: "C001", customerName: "Parle Products Pvt Ltd", jobName: "Parle Shrink Wrap Batch-1", productName: "LLDPE Shrink Film 40μ", recipeId: "RCP001", recipeName: "3-Layer PE Shrink", rollMasterId: "RL001", rollName: "PE Shrink Roll 400mm", quantity: 5000, unit: "Kg", deliveryDate: "2024-03-20", totalAmount: 650000, advancePaid: 200000, status: "Dispatched" },
  { id: "ORD002", orderNo: "ORD-2024-002", date: "2024-03-11", enquiryId: "ENQ002", estimationId: "", customerId: "C002", customerName: "Britannia Industries Ltd", jobName: "Britannia Biscuit Pack-Feb", productName: "LLDPE Shrink Film 40μ", recipeId: "RCP001", recipeName: "3-Layer PE Shrink", rollMasterId: "RL001", rollName: "PE Shrink Roll 400mm", quantity: 3000, unit: "Kg", deliveryDate: "2024-03-25", totalAmount: 390000, advancePaid: 100000, status: "In Production" },
  { id: "ORD003", orderNo: "ORD-2024-003", date: "2024-03-13", enquiryId: "ENQ004", estimationId: "", customerId: "C004", customerName: "ITC Limited", jobName: "ITC Carry Bag Run-Q1", productName: "HDPE Carry Bag Film 80μ", recipeId: "RCP002", recipeName: "2-Layer HDPE Film", rollMasterId: "RL003", rollName: "HDPE Carry Roll 500mm", quantity: 10000, unit: "Kg", deliveryDate: "2024-04-05", totalAmount: 1300000, advancePaid: 400000, status: "In Production" },
  { id: "ORD004", orderNo: "ORD-2024-004", date: "2024-03-16", enquiryId: "", estimationId: "", customerId: "C003", customerName: "Haldiram Snacks Pvt Ltd", jobName: "Haldiram Barrier Film-Snacks", productName: "Barrier Film 5-Layer 80μ", recipeId: "RCP003", recipeName: "5-Layer Barrier Film", rollMasterId: "RL006", rollName: "5-Layer Barrier Roll 400mm", quantity: 4000, unit: "Kg", deliveryDate: "2024-04-10", totalAmount: 640000, advancePaid: 160000, status: "Confirmed" },
];

// ─── ROTO JOBS ───────────────────────────────────────────────
export const rotoJobs: RotoJob[] = [
  {
    id: "RJ001", rotoJobNo: "ROTO-2024-001", date: "2024-03-12",
    orderId: "ORD002", orderNo: "ORD-2024-002",
    customerId: "C002", customerName: "Britannia Industries Ltd",
    jobName: "Britannia Biscuit Pack-Feb",
    extrusionRollId: "RL002", extrusionRollName: "BOPP Lamination Roll 300mm",
    artworkDescription: "Britannia Good Day biscuit front/back with nutritional information panel",
    hsnId: "HSN001", hsnCode: "3920", quantity: 3000, unit: "Kg",
    processes: [
      { processId: "PR002", processName: "6-Color Gravure Printing", processType: "Printing" },
      { processId: "PR004", processName: "Dry Bond Lamination", processType: "Lamination" },
      { processId: "PR007", processName: "Slitting & Rewinding", processType: "Slitting" },
    ],
    noOfColors: 6, remarks: "Pantone matching required. Glossy finish.", status: "In Progress",
  },
  {
    id: "RJ002", rotoJobNo: "ROTO-2024-002", date: "2024-03-16",
    orderId: "ORD004", orderNo: "ORD-2024-004",
    customerId: "C003", customerName: "Haldiram Snacks Pvt Ltd",
    jobName: "Haldiram Barrier Film-Snacks",
    extrusionRollId: "RL006", extrusionRollName: "5-Layer Barrier Roll 400mm",
    artworkDescription: "Haldiram Aloo Bhujia snack pouch – full bleed 8-color print",
    hsnId: "HSN001", hsnCode: "3920", quantity: 4000, unit: "Kg",
    processes: [
      { processId: "PR001", processName: "8-Color Gravure Printing", processType: "Printing" },
      { processId: "PR005", processName: "Extrusion Lamination", processType: "Lamination" },
      { processId: "PR006", processName: "Corona Coating", processType: "Coating" },
      { processId: "PR007", processName: "Slitting & Rewinding", processType: "Slitting" },
    ],
    noOfColors: 8, remarks: "UV resistant inks. Exact color match from approved sample.", status: "Open",
  },
];

// ─── JOB CARDS ───────────────────────────────────────────────
export const jobCards: JobCard[] = [
  { id: "JC001", jobCardNo: "JC-2024-001", date: "2024-03-07", orderId: "ORD001", orderNo: "ORD-2024-001", rotoJobId: "", rotoJobNo: "", customerName: "Parle Products Pvt Ltd", jobName: "Parle Shrink Wrap Batch-1", productName: "LLDPE Shrink Film 40μ", recipeName: "3-Layer PE Shrink", targetQty: 5000, unit: "Kg", totalGSM: 37.39, rollWidth: 400, machineId: "M001", machineName: "Extrusion Line 1 (3-Layer)", operatorId: "E001", operatorName: "Rajesh Kumar", plannedDate: "2024-03-10", processes: ["Extrusion"], status: "Completed" },
  { id: "JC002", jobCardNo: "JC-2024-002", date: "2024-03-12", orderId: "ORD002", orderNo: "ORD-2024-002", rotoJobId: "RJ001", rotoJobNo: "ROTO-2024-001", customerName: "Britannia Industries Ltd", jobName: "Britannia Biscuit Pack-Feb", productName: "BOPP Printed Film 20μ", recipeName: "3-Layer PE Shrink", targetQty: 3000, unit: "Kg", totalGSM: 18.0, rollWidth: 300, machineId: "M004", machineName: "Roto Press 1 – 8 Color", operatorId: "E004", operatorName: "Amit Tiwari", plannedDate: "2024-03-20", processes: ["6-Color Gravure Printing", "Dry Bond Lamination", "Slitting & Rewinding"], status: "In Progress" },
  { id: "JC003", jobCardNo: "JC-2024-003", date: "2024-03-14", orderId: "ORD003", orderNo: "ORD-2024-003", rotoJobId: "", rotoJobNo: "", customerName: "ITC Limited", jobName: "ITC Carry Bag Run-Q1", productName: "HDPE Carry Bag Film 80μ", recipeName: "2-Layer HDPE Film", targetQty: 10000, unit: "Kg", totalGSM: 76.0, rollWidth: 500, machineId: "M003", machineName: "Extrusion Line 3 (2-Layer)", operatorId: "E003", operatorName: "Prakash Joshi", plannedDate: "2024-03-25", processes: ["Extrusion"], status: "In Progress" },
  { id: "JC004", jobCardNo: "JC-2024-004", date: "2024-03-17", orderId: "ORD004", orderNo: "ORD-2024-004", rotoJobId: "RJ002", rotoJobNo: "ROTO-2024-002", customerName: "Haldiram Snacks Pvt Ltd", jobName: "Haldiram Barrier Film-Snacks", productName: "Barrier Film 5-Layer 80μ", recipeName: "5-Layer Barrier Film", targetQty: 4000, unit: "Kg", totalGSM: 74.0, rollWidth: 400, machineId: "M002", machineName: "Extrusion Line 2 (5-Layer)", operatorId: "E002", operatorName: "Sunil Yadav", plannedDate: "2024-03-28", processes: ["Extrusion", "8-Color Gravure Printing", "Extrusion Lamination", "Corona Coating", "Slitting & Rewinding"], status: "Open" },
];

// ─── PRODUCTION ENTRIES ──────────────────────────────────────
export const productionEntries: ProductionEntry[] = [
  { id: "PE001", entryNo: "PROD-2024-001", date: "2024-03-08", jobCardId: "JC001", jobCardNo: "JC-2024-001", machineId: "M001", machineName: "Extrusion Line 1 (3-Layer)", shift: "A", rollNo: "ROLL-001", producedQty: 900, wastageQty: 22, netQty: 878, machineRuntime: 8, operatorId: "E001", operatorName: "Rajesh Kumar", remarks: "" },
  { id: "PE002", entryNo: "PROD-2024-002", date: "2024-03-08", jobCardId: "JC001", jobCardNo: "JC-2024-001", machineId: "M001", machineName: "Extrusion Line 1 (3-Layer)", shift: "B", rollNo: "ROLL-002", producedQty: 870, wastageQty: 18, netQty: 852, machineRuntime: 8, operatorId: "E002", operatorName: "Sunil Yadav", remarks: "" },
  { id: "PE003", entryNo: "PROD-2024-003", date: "2024-03-09", jobCardId: "JC001", jobCardNo: "JC-2024-001", machineId: "M001", machineName: "Extrusion Line 1 (3-Layer)", shift: "A", rollNo: "ROLL-003", producedQty: 950, wastageQty: 25, netQty: 925, machineRuntime: 8, operatorId: "E001", operatorName: "Rajesh Kumar", remarks: "Die set changed" },
  { id: "PE004", entryNo: "PROD-2024-004", date: "2024-03-13", jobCardId: "JC002", jobCardNo: "JC-2024-002", machineId: "M004", machineName: "Roto Press 1 – 8 Color", shift: "A", rollNo: "ROLL-004", producedQty: 700, wastageQty: 48, netQty: 652, machineRuntime: 7.5, operatorId: "E004", operatorName: "Amit Tiwari", remarks: "Colour registration setup time" },
  { id: "PE005", entryNo: "PROD-2024-005", date: "2024-03-14", jobCardId: "JC002", jobCardNo: "JC-2024-002", machineId: "M004", machineName: "Roto Press 1 – 8 Color", shift: "A", rollNo: "ROLL-005", producedQty: 750, wastageQty: 32, netQty: 718, machineRuntime: 8, operatorId: "E004", operatorName: "Amit Tiwari", remarks: "" },
  { id: "PE006", entryNo: "PROD-2024-006", date: "2024-03-15", jobCardId: "JC003", jobCardNo: "JC-2024-003", machineId: "M003", machineName: "Extrusion Line 3 (2-Layer)", shift: "A", rollNo: "ROLL-006", producedQty: 1200, wastageQty: 35, netQty: 1165, machineRuntime: 8, operatorId: "E003", operatorName: "Prakash Joshi", remarks: "" },
];

// ─── DISPATCHES ──────────────────────────────────────────────
export const dispatches: Dispatch[] = [
  { id: "DSP001", dispatchNo: "DSP-2024-001", date: "2024-03-18", orderId: "ORD001", orderNo: "ORD-2024-001", customerId: "C001", customerName: "Parle Products Pvt Ltd", productName: "LLDPE Shrink Film 40μ", quantity: 5000, unit: "Kg", vehicleNo: "MH-01-AB-1234", driverName: "Ram Lal", status: "Delivered" },
  { id: "DSP002", dispatchNo: "DSP-2024-002", date: "2024-03-20", orderId: "ORD002", orderNo: "ORD-2024-002", customerId: "C002", customerName: "Britannia Industries Ltd", productName: "BOPP Printed Film 20μ", quantity: 1200, unit: "Kg", vehicleNo: "MH-04-CD-5678", driverName: "Shyam Lal", status: "In Transit" },
];

// ─── DASHBOARD ───────────────────────────────────────────────
export const dashboardStats = {
  todayProduction: 2850, activeJobCards: 3, pendingEnquiries: 2,
  pendingOrders: 1, monthlyRevenue: 2940000, dispatchedToday: 1,
  machinesRunning: 3, totalCustomers: 7,
  extrusionOutput: 2100, rotoOutput: 750, activeRotoJobs: 2,
};
export const weeklyProductionData = [
  { day: "Mon", extrusion: 2400, roto: 1200 },
  { day: "Tue", extrusion: 2800, roto: 1400 },
  { day: "Wed", extrusion: 2600, roto: 1600 },
  { day: "Thu", extrusion: 3100, roto: 1300 },
  { day: "Fri", extrusion: 2900, roto: 1500 },
  { day: "Sat", extrusion: 2200, roto: 1100 },
  { day: "Sun", extrusion: 1800, roto: 800 },
];
export const orderStatusData = [
  { name: "Confirmed", value: 1, color: "#3B82F6" },
  { name: "In Production", value: 2, color: "#F59E0B" },
  { name: "Ready", value: 0, color: "#10B981" },
  { name: "Dispatched", value: 1, color: "#6366F1" },
];
export const monthlyRevenueData = [
  { month: "Oct", revenue: 1800000 }, { month: "Nov", revenue: 2100000 },
  { month: "Dec", revenue: 1950000 }, { month: "Jan", revenue: 2400000 },
  { month: "Feb", revenue: 2250000 }, { month: "Mar", revenue: 2940000 },
];

// ─── UNITS ───────────────────────────────────────────────────
export type Unit = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  type: "Weight" | "Length" | "Area" | "Thickness" | "Speed" | "Quantity" | "Density" | "Volume";
  productionUnit: "Extrusion" | "Rotogravure" | "Both";
  description: string;
};

export const units: Unit[] = [
  // ── Weight (Both) ──────────────────────────────────────────
  { id: "U001", code: "KG",    name: "Kilogram",        shortName: "Kg",    type: "Weight",    productionUnit: "Both",        description: "Standard weight unit for film rolls and raw materials" },
  { id: "U002", code: "MT",    name: "Metric Tonne",    shortName: "MT",    type: "Weight",    productionUnit: "Both",        description: "1 MT = 1000 Kg — used for bulk raw material purchase" },
  { id: "U003", code: "GM",    name: "Gram",            shortName: "gm",    type: "Weight",    productionUnit: "Both",        description: "1 Kg = 1000 gm — for small quantity measurement" },

  // ── Length / Width (Both) ──────────────────────────────────
  { id: "U004", code: "M",     name: "Meter",           shortName: "m",     type: "Length",    productionUnit: "Both",        description: "Standard length unit for film web length" },
  { id: "U005", code: "MM",    name: "Millimeter",      shortName: "mm",    type: "Length",    productionUnit: "Both",        description: "Roll / web width measurement" },

  // ── Extrusion specific ─────────────────────────────────────
  { id: "U006", code: "MICRON", name: "Micron",         shortName: "μ",     type: "Thickness", productionUnit: "Extrusion",   description: "Film thickness (1 micron = 0.001 mm)" },
  { id: "U007", code: "GSM",   name: "Gram per Sq Mtr", shortName: "gsm",   type: "Area",      productionUnit: "Extrusion",   description: "Grammage — g/m² — calculated from micron × density" },
  { id: "U008", code: "GCC",   name: "Gram per CC",     shortName: "g/cm³", type: "Density",   productionUnit: "Extrusion",   description: "Density of polymer / masterbatch" },
  { id: "U009", code: "SQM",   name: "Square Meter",    shortName: "m²",    type: "Area",      productionUnit: "Extrusion",   description: "Area unit — for cost per m² calculation" },
  { id: "U010", code: "ROLL",  name: "Roll",            shortName: "Roll",  type: "Quantity",  productionUnit: "Extrusion",   description: "Finished extrusion roll / ply" },

  // ── Rotogravure specific ───────────────────────────────────
  { id: "U011", code: "MMIN",  name: "Meter per Minute", shortName: "m/min", type: "Speed",    productionUnit: "Rotogravure", description: "Press speed — Roto printing machine speed" },
  { id: "U012", code: "LTR",   name: "Liter",           shortName: "Ltr",   type: "Volume",    productionUnit: "Rotogravure", description: "Ink / solvent volume measurement" },
  { id: "U013", code: "CLR",   name: "Color",           shortName: "Color", type: "Quantity",  productionUnit: "Rotogravure", description: "Number of print colors in gravure job" },
  { id: "U014", code: "CYL",   name: "Cylinder",        shortName: "Cyl",   type: "Quantity",  productionUnit: "Rotogravure", description: "Gravure printing cylinder count" },

  // ── General / Dispatch ─────────────────────────────────────
  { id: "U015", code: "PCS",   name: "Pieces",          shortName: "Pcs",   type: "Quantity",  productionUnit: "Both",        description: "Count based — pouches, boxes, cartons" },
  { id: "U016", code: "BAG",   name: "Bag",             shortName: "Bag",   type: "Quantity",  productionUnit: "Both",        description: "Packing bag unit for dispatch" },
];

// ─── INVENTORY – PURCHASE REQUISITION ────────────────────────

export type PRLine = {
  lineId: string;
  itemCode: string;
  itemGroup: string;
  subGroup: string;
  itemName: string;
  indentQty: number;
  totalBooked: number;
  allocatedStock: number;
  currentStock: number;
  stockUnit: string;
  currentStockInPU: number;
  purchaseUnit: string;
  orderUnit: string;
  noOfPacksRolls: number;
  qtyPerPackRoll: number;
  poQtyInPU: number;
  poQtyInSU: number;
};

export type PurchaseRequisition = {
  id: string;
  reqNo: string;
  reqDate: string;
  lines: PRLine[];
  remark: string;
  status: "Draft" | "Submitted" | "Approved" | "Rejected" | "Ordered";
};

export const purchaseRequisitions: PurchaseRequisition[] = [
  {
    id: "PR001",
    reqNo: "PREQ00001_25_26",
    reqDate: "2026-03-10",
    remark: "Urgent BOPP requirement for Q4 production",
    status: "Submitted",
    lines: [
      {
        lineId: "L001",
        itemCode: "RM-FIL-4475", itemGroup: "Film", subGroup: "BOPP Film",
        itemName: "BOPP 90 MICRON 0.2 THICKNESS",
        indentQty: 0, totalBooked: 0, allocatedStock: 500, currentStock: 1200,
        stockUnit: "Kg", currentStockInPU: 1200, purchaseUnit: "Kg", orderUnit: "Roll",
        noOfPacksRolls: 10, qtyPerPackRoll: 200, poQtyInPU: 2000, poQtyInSU: 2000,
      },
    ],
  },
  {
    id: "PR002",
    reqNo: "PREQ00002_25_26",
    reqDate: "2026-03-12",
    remark: "Monthly ink restocking",
    status: "Approved",
    lines: [
      {
        lineId: "L002",
        itemCode: "RM-INK-001", itemGroup: "Ink", subGroup: "Solvent Based Ink",
        itemName: "YELLOW INK SOLVENT BASED",
        indentQty: 0, totalBooked: 0, allocatedStock: 20, currentStock: 85,
        stockUnit: "Kg", currentStockInPU: 85, purchaseUnit: "Kg", orderUnit: "Kg",
        noOfPacksRolls: 5, qtyPerPackRoll: 50, poQtyInPU: 250, poQtyInSU: 250,
      },
      {
        lineId: "L003",
        itemCode: "RM-INK-002", itemGroup: "Ink", subGroup: "Solvent Based Ink",
        itemName: "CYAN INK SOLVENT BASED",
        indentQty: 0, totalBooked: 0, allocatedStock: 20, currentStock: 60,
        stockUnit: "Kg", currentStockInPU: 60, purchaseUnit: "Kg", orderUnit: "Kg",
        noOfPacksRolls: 5, qtyPerPackRoll: 50, poQtyInPU: 250, poQtyInSU: 250,
      },
    ],
  },
  {
    id: "PR003",
    reqNo: "PREQ00003_25_26",
    reqDate: "2026-03-15",
    remark: "",
    status: "Draft",
    lines: [
      {
        lineId: "L004",
        itemCode: "RM-CHM-001", itemGroup: "Solvent", subGroup: "Adhesives",
        itemName: "PU ADHESIVE DRY BOND",
        indentQty: 0, totalBooked: 0, allocatedStock: 50, currentStock: 200,
        stockUnit: "Kg", currentStockInPU: 200, purchaseUnit: "Kg", orderUnit: "Kg",
        noOfPacksRolls: 3, qtyPerPackRoll: 50, poQtyInPU: 150, poQtyInSU: 150,
      },
    ],
  },
];

// ─── INVENTORY – PURCHASE ORDER ───────────────────────────────

export const SUPPLIERS = [
  { name: "Cosmo Films Ltd",              state: "Maharashtra", contact: "Rajesh Mehta",   gst: "27AAACC1234A1ZR" },
  { name: "Reliance Industries Ltd",      state: "Gujarat",     contact: "Amit Shah",      gst: "24AAACR1234B1Z5" },
  { name: "GAIL India Ltd",              state: "Delhi",       contact: "Suresh Kumar",   gst: "07AAACG1234C1Z3" },
  { name: "Haldia Petrochemicals Ltd",    state: "West Bengal", contact: "Bimal Roy",      gst: "19AAACH1234D1Z7" },
  { name: "Cabot India Ltd",             state: "Maharashtra", contact: "Priya Nair",     gst: "27AAACC5678A1ZS" },
  { name: "Siegwerk India Pvt Ltd",       state: "Maharashtra", contact: "Thomas Wagner",  gst: "27AAACS1234E1Z1" },
  { name: "Huber Group India Pvt Ltd",   state: "Karnataka",   contact: "David Mueller",  gst: "29AAACH5678B1Z2" },
  { name: "Henkel India Ltd",            state: "Maharashtra", contact: "Ravi Verma",     gst: "27AAACH1234F1Z9" },
];

export type POLine = {
  lineId: string;
  itemCode: string; itemGroup: string; subGroup: string; itemName: string;
  reqQtyInSU: number; stockUnit: string; reqQtyInPU: number;
  noOfPacksRolls: number; qtyPerPackRoll: number;
  poQtyInPU: number; poQtyInSU: number;
  rate: number; purchaseUnit: string;
  hsnName: string; hsnCode: string;
  expectedDelivery: string;
  tolerancePct: number;
  basicAmt: number;
  discPct: number; afterDiscAmt: number;
  gstPct: number;
  cgstAmt: number; sgstAmt: number; igstAmt: number;
  taxableAmt: number; totalAmt: number;
};

export type POCharge = { id: string; name: string; amount: number };

export type PurchaseOrder = {
  id: string; poNo: string; poDate: string; prRef?: string;
  supplier: string; supplierState: string;
  division: string; currency: string; contactPerson: string;
  approvalBy: string; billTo: string;
  lines: POLine[];
  charges: POCharge[];
  paymentTerms: string; modeOfTransport: string;
  deliveryLocation: string; purchaseRef: string; remark: string;
  status: "Draft" | "Approved" | "Sent" | "Closed" | "Cancelled";
};

export const purchaseOrders: PurchaseOrder[] = [
  {
    id: "PO001", poNo: "PO00001_25_26", poDate: "2026-03-11", prRef: "PREQ00001_25_26",
    supplier: "Cosmo Films Ltd", supplierState: "Maharashtra",
    division: "COM", currency: "INR", contactPerson: "Rajesh Mehta",
    approvalBy: "Director", billTo: "AJ Shrink Wrap – Main Warehouse",
    charges: [{ id: "C1", name: "Freight Charges", amount: 2500 }],
    paymentTerms: "Payment in 60 Days", modeOfTransport: "Road", deliveryLocation: "Main Store",
    purchaseRef: "", remark: "Urgent",
    status: "Approved",
    lines: [
      {
        lineId: "PL001",
        itemCode: "RM-FIL-4475", itemGroup: "Film", subGroup: "BOPP Film",
        itemName: "BOPP 90 MICRON 0.2 THICKNESS",
        reqQtyInSU: 2000, stockUnit: "Kg", reqQtyInPU: 2000,
        noOfPacksRolls: 10, qtyPerPackRoll: 200, poQtyInPU: 2000, poQtyInSU: 2000,
        rate: 150, purchaseUnit: "Kg",
        hsnName: "Other plates, sheets, film – plastics", hsnCode: "3920",
        expectedDelivery: "2026-03-25", tolerancePct: 5,
        basicAmt: 300000, discPct: 0, afterDiscAmt: 300000,
        gstPct: 18, cgstAmt: 27000, sgstAmt: 27000, igstAmt: 0,
        taxableAmt: 300000, totalAmt: 354000,
      },
    ],
  },
];

// ─── INVENTORY – GRN ────────────────────────────────────────

export const WAREHOUSES = [
  { id: "WH001", name: "Main Warehouse",         bins: ["BIN-A1","BIN-A2","BIN-A3","BIN-B1","BIN-B2","BIN-C1","BIN-C2"] },
  { id: "WH002", name: "Ink & Chemical Store",   bins: ["CH-A1","CH-A2","CH-B1","CH-B2"] },
  { id: "WH003", name: "Film Store",             bins: ["FL-A1","FL-A2","FL-B1","FL-B2","FL-C1"] },
  { id: "WH004", name: "Consumables Store",      bins: ["CS-A1","CS-A2","CS-B1"] },
];

export type GRNLine = {
  lineId: string; poRef: string;
  itemCode: string; itemGroup: string; subGroup: string; itemName: string;
  orderedQty: number; receivedQty: number;
  stockUnit: string; purchaseUnit: string;
  rate: number; hsnCode: string; gstPct: number;
  batchNo: string; supplierBatchNo: string; expiryDate: string;
  warehouseId: string; warehouseName: string; bin: string;
  basicAmt: number; cgstAmt: number; sgstAmt: number; igstAmt: number; totalAmt: number;
};

export type GRN = {
  id: string; grnNo: string; grnDate: string;
  supplier: string; supplierState: string;
  lines: GRNLine[];
  invoiceNo: string; invoiceDate: string;
  eWayBillNo: string; eWayBillDate: string;
  gateEntryNo: string; gateEntryDate: string;
  lrVehicleNo: string; transporter: string;
  receivedBy: string; remark: string;
  status: "Draft" | "Completed" | "Verified";
};

export const grnRecords: GRN[] = [
  {
    id: "GRN001", grnNo: "GRN00001_25_26", grnDate: "2026-03-12",
    supplier: "Cosmo Films Ltd", supplierState: "Maharashtra",
    invoiceNo: "CF/INV/2603", invoiceDate: "2026-03-11",
    eWayBillNo: "EWB2603001", eWayBillDate: "2026-03-11",
    gateEntryNo: "GE-001", gateEntryDate: "2026-03-12",
    lrVehicleNo: "MH-04-AB-1234", transporter: "Fast Logistics",
    receivedBy: "Ramesh Kumar", remark: "Material in good condition",
    status: "Completed",
    lines: [
      {
        lineId: "GL001", poRef: "PO00001_25_26",
        itemCode: "RM-FIL-4475", itemGroup: "Film", subGroup: "BOPP Film",
        itemName: "BOPP 90 MICRON 0.2 THICKNESS",
        orderedQty: 2000, receivedQty: 2000, stockUnit: "Kg", purchaseUnit: "Kg",
        rate: 150, hsnCode: "3920", gstPct: 18,
        batchNo: "BATCH-RM-FIL-4475-20260312-001",
        supplierBatchNo: "CF-BOPP-2603-01", expiryDate: "",
        warehouseId: "WH003", warehouseName: "Film Store", bin: "FL-A1",
        basicAmt: 300000, cgstAmt: 27000, sgstAmt: 27000, igstAmt: 0, totalAmt: 354000,
      },
    ],
  },
  {
    id: "GRN002", grnNo: "GRN00002_25_26", grnDate: "2026-03-15",
    supplier: "Siegwerk India Pvt Ltd", supplierState: "Maharashtra",
    invoiceNo: "SW/INV/0315", invoiceDate: "2026-03-14",
    eWayBillNo: "EWB0315002", eWayBillDate: "2026-03-14",
    gateEntryNo: "GE-002", gateEntryDate: "2026-03-15",
    lrVehicleNo: "MH-12-CD-5678", transporter: "Speed Cargo",
    receivedBy: "Sunil Patil", remark: "Ink cans — all sealed",
    status: "Verified",
    lines: [
      {
        lineId: "GL002", poRef: "PO00002_25_26",
        itemCode: "INK-YLW-001", itemGroup: "Ink", subGroup: "Gravure Ink",
        itemName: "Yellow Gravure Ink (1 Kg Can)",
        orderedQty: 200, receivedQty: 200, stockUnit: "Kg", purchaseUnit: "Can",
        rate: 480, hsnCode: "3215", gstPct: 18,
        batchNo: "BATCH-INK-YLW-001-20260315-001",
        supplierBatchNo: "SW-YLW-0315-A", expiryDate: "2027-03-15",
        warehouseId: "WH002", warehouseName: "Ink & Chemical Store", bin: "CH-A1",
        basicAmt: 96000, cgstAmt: 8640, sgstAmt: 8640, igstAmt: 0, totalAmt: 113280,
      },
      {
        lineId: "GL003", poRef: "PO00002_25_26",
        itemCode: "INK-CYN-001", itemGroup: "Ink", subGroup: "Gravure Ink",
        itemName: "Cyan Gravure Ink (1 Kg Can)",
        orderedQty: 150, receivedQty: 150, stockUnit: "Kg", purchaseUnit: "Can",
        rate: 510, hsnCode: "3215", gstPct: 18,
        batchNo: "BATCH-INK-CYN-001-20260315-001",
        supplierBatchNo: "SW-CYN-0315-A", expiryDate: "2027-03-15",
        warehouseId: "WH002", warehouseName: "Ink & Chemical Store", bin: "CH-A2",
        basicAmt: 76500, cgstAmt: 6885, sgstAmt: 6885, igstAmt: 0, totalAmt: 90270,
      },
    ],
  },
  {
    id: "GRN003", grnNo: "GRN00003_25_26", grnDate: "2026-03-18",
    supplier: "Reliance Industries Ltd", supplierState: "Gujarat",
    invoiceNo: "RIL/INV/0318", invoiceDate: "2026-03-17",
    eWayBillNo: "EWB0318003", eWayBillDate: "2026-03-17",
    gateEntryNo: "GE-003", gateEntryDate: "2026-03-18",
    lrVehicleNo: "GJ-05-EF-9012", transporter: "National Carriers",
    receivedBy: "Ramesh Kumar", remark: "Granules — 25 Kg bags",
    status: "Completed",
    lines: [
      {
        lineId: "GL004", poRef: "PO00003_25_26",
        itemCode: "RM-GRN-LLDPE", itemGroup: "Granules", subGroup: "LLDPE",
        itemName: "LLDPE Granules (Linear Low Density)",
        orderedQty: 5000, receivedQty: 4975, stockUnit: "Kg", purchaseUnit: "Kg",
        rate: 95, hsnCode: "3901", gstPct: 18,
        batchNo: "BATCH-RM-GRN-LLDPE-20260318-001",
        supplierBatchNo: "RIL-LLDPE-0318-01", expiryDate: "",
        warehouseId: "WH001", warehouseName: "Main Warehouse", bin: "BIN-A1",
        basicAmt: 472625, cgstAmt: 0, sgstAmt: 0, igstAmt: 85072.5, totalAmt: 557697.5,
      },
    ],
  },
  {
    id: "GRN004", grnNo: "GRN00004_25_26", grnDate: "2026-03-20",
    supplier: "Henkel India Ltd", supplierState: "Maharashtra",
    invoiceNo: "HNK/INV/0320", invoiceDate: "2026-03-19",
    eWayBillNo: "EWB0320004", eWayBillDate: "2026-03-19",
    gateEntryNo: "GE-004", gateEntryDate: "2026-03-20",
    lrVehicleNo: "MH-14-GH-3456", transporter: "Rapid Move",
    receivedBy: "Sunil Patil", remark: "Adhesive drums — check for leakage before use",
    status: "Completed",
    lines: [
      {
        lineId: "GL005", poRef: "PO00004_25_26",
        itemCode: "CHM-ADH-PU", itemGroup: "Chemical", subGroup: "Adhesive",
        itemName: "PU Adhesive Lamination Grade (20 Kg Drum)",
        orderedQty: 500, receivedQty: 500, stockUnit: "Kg", purchaseUnit: "Drum",
        rate: 220, hsnCode: "3506", gstPct: 18,
        batchNo: "BATCH-CHM-ADH-PU-20260320-001",
        supplierBatchNo: "HNK-PU-0320-A", expiryDate: "2026-09-20",
        warehouseId: "WH002", warehouseName: "Ink & Chemical Store", bin: "CH-B1",
        basicAmt: 110000, cgstAmt: 9900, sgstAmt: 9900, igstAmt: 0, totalAmt: 129800,
      },
      {
        lineId: "GL006", poRef: "PO00004_25_26",
        itemCode: "CHM-HDI-001", itemGroup: "Chemical", subGroup: "Hardener",
        itemName: "HDI Hardener (5 Kg Can)",
        orderedQty: 100, receivedQty: 100, stockUnit: "Kg", purchaseUnit: "Can",
        rate: 350, hsnCode: "2929", gstPct: 18,
        batchNo: "BATCH-CHM-HDI-001-20260320-001",
        supplierBatchNo: "HNK-HDI-0320-A", expiryDate: "2026-09-20",
        warehouseId: "WH002", warehouseName: "Ink & Chemical Store", bin: "CH-B2",
        basicAmt: 35000, cgstAmt: 3150, sgstAmt: 3150, igstAmt: 0, totalAmt: 41300,
      },
    ],
  },
  {
    id: "GRN005", grnNo: "GRN00005_25_26", grnDate: "2026-03-22",
    supplier: "Cabot India Ltd", supplierState: "Maharashtra",
    invoiceNo: "CAB/INV/0322", invoiceDate: "2026-03-21",
    eWayBillNo: "EWB0322005", eWayBillDate: "2026-03-21",
    gateEntryNo: "GE-005", gateEntryDate: "2026-03-22",
    lrVehicleNo: "MH-09-IJ-7890", transporter: "Fast Logistics",
    receivedBy: "Ramesh Kumar", remark: "Masterbatch — store away from moisture",
    status: "Completed",
    lines: [
      {
        lineId: "GL007", poRef: "PO00005_25_26",
        itemCode: "MB-WHT-001", itemGroup: "Masterbatch", subGroup: "White MB",
        itemName: "White Masterbatch (25 Kg Bag)",
        orderedQty: 1000, receivedQty: 1000, stockUnit: "Kg", purchaseUnit: "Kg",
        rate: 130, hsnCode: "3206", gstPct: 18,
        batchNo: "BATCH-MB-WHT-001-20260322-001",
        supplierBatchNo: "CAB-WHT-0322-01", expiryDate: "",
        warehouseId: "WH004", warehouseName: "Consumables Store", bin: "CS-A1",
        basicAmt: 130000, cgstAmt: 11700, sgstAmt: 11700, igstAmt: 0, totalAmt: 153400,
      },
    ],
  },
];

// ─── INVENTORY – ITEM ISSUE ───────────────────────────────────

export const FLOOR_AREAS = [
  { id: "FA001", name: "Printing Floor",       bins: ["PF-A1","PF-A2","PF-B1","PF-B2"] },
  { id: "FA002", name: "Lamination Floor",     bins: ["LF-A1","LF-A2","LF-B1"] },
  { id: "FA003", name: "Slitting Section",     bins: ["SS-A1","SS-A2"] },
  { id: "FA004", name: "Pouch Making Floor",   bins: ["PM-A1","PM-A2"] },
  { id: "FA005", name: "Pre-Press Room",       bins: ["PP-A1","PP-A2"] },
  { id: "FA006", name: "QC Lab",              bins: ["QC-A1"] },
];

export type JobCardItem = {
  itemCode: string; itemName: string;
  requiredQty: number; issuedQty: number; unit: string;
};

export type IssueJobCard = {
  id: string; jobCardNo: string; jobDate: string;
  product: string; customer: string;
  machine: string; operator: string;
  items: JobCardItem[];
  status: "Open" | "In Progress" | "Completed";
};

export const issueJobCards: IssueJobCard[] = [
  {
    id: "JC001", jobCardNo: "JC-001", jobDate: "2026-03-15",
    product: "BOPP Printed Roll", customer: "Parle Products Pvt Ltd",
    machine: "Roto Press 1", operator: "Suresh Verma",
    status: "Open",
    items: [
      { itemCode: "RM-FIL-4475", itemName: "BOPP 90 MICRON 0.2 THICKNESS", requiredQty: 500, issuedQty: 0, unit: "Kg" },
      { itemCode: "RM-INK-001",  itemName: "YELLOW INK SOLVENT BASED",      requiredQty: 15,  issuedQty: 0, unit: "Kg" },
      { itemCode: "RM-INK-002",  itemName: "CYAN INK SOLVENT BASED",         requiredQty: 12,  issuedQty: 0, unit: "Kg" },
      { itemCode: "RM-INK-003",  itemName: "MAGENTA INK SOLVENT BASED",      requiredQty: 10,  issuedQty: 0, unit: "Kg" },
    ],
  },
  {
    id: "JC002", jobCardNo: "JC-002", jobDate: "2026-03-16",
    product: "PET Laminated Roll", customer: "Britannia Industries Ltd",
    machine: "Lamination Machine 2", operator: "Ravi Sharma",
    status: "Open",
    items: [
      { itemCode: "RM-FIL-4475", itemName: "BOPP 90 MICRON 0.2 THICKNESS", requiredQty: 300, issuedQty: 0, unit: "Kg" },
      { itemCode: "RM-CHM-001",  itemName: "PU ADHESIVE DRY BOND",          requiredQty: 25,  issuedQty: 0, unit: "Kg" },
    ],
  },
  {
    id: "JC003", jobCardNo: "JC-003", jobDate: "2026-03-17",
    product: "Shrink Sleeve Label", customer: "Dabur India Ltd",
    machine: "Roto Press 2", operator: "Ajay Patil",
    status: "Open",
    items: [
      { itemCode: "RM-INK-004",  itemName: "BLACK INK SOLVENT BASED",  requiredQty: 8,  issuedQty: 0, unit: "Kg" },
      { itemCode: "RM-ADD-001",  itemName: "SLIP ADDITIVE MASTERBATCH", requiredQty: 5,  issuedQty: 0, unit: "Kg" },
    ],
  },
];

export type ItemIssueLine = {
  lineId: string;
  itemCode: string; itemName: string; itemGroup: string; subGroup: string;
  requiredQty: number; issueQty: number; stockUnit: string;
  batchNo: string; supplierBatchNo: string; grnNo: string;
  availableQty: number;
  fromWarehouseId: string; fromWarehouseName: string; fromBin: string;
  toFloorId: string; toFloorName: string; toBin: string;
  slipNo: string; slipDate: string;
  batchScanned: boolean;
};

export type ItemIssue = {
  id: string; voucherNo: string; voucherDate: string;
  issueMode: "Job-wise" | "Item-wise";
  jobCardRef: string;
  jobCardData: { product: string; customer: string; machine: string } | null;
  lines: ItemIssueLine[];
  remark: string;
  status: "Draft" | "Issued";
};

export const itemIssues: ItemIssue[] = [];

// ─── Item Consumption ─────────────────────────────────────────
export type ItemConsumptionLine = {
  lineId: string;
  itemCode: string; itemName: string; stockUnit: string;
  batchNo: string; supplierBatchNo: string;
  issuedQty: number;
  consumedQty: number;
  batchScanned: boolean;
};

export type ItemConsumption = {
  id: string; voucherNo: string; consumptionDate: string;
  jobCardRef: string;
  jobCardData: { product: string; customer: string; machine: string } | null;
  lines: ItemConsumptionLine[];
  remark: string;
  status: "Draft" | "Completed";
};

export const itemConsumptions: ItemConsumption[] = [];

// ─── INVENTORY – RETURN TO STOCK ─────────────────────────────

export type ReturnToStockLine = {
  lineId: string;
  itemCode: string; itemName: string; stockUnit: string;
  batchNo: string;
  returnQty: number;
  warehouseId: string; warehouseName: string; bin: string;
  jobCardRef: string;
  remark: string;
};

export type ReturnToStock = {
  id: string; voucherNo: string; returnDate: string;
  returnMode: "Job-wise" | "Item-wise";
  itemGroupId: string; itemGroupName: string;
  itemSubGroupId: string; itemSubGroupName: string;
  jobCardRef: string;
  jobCardData: { product: string; customer: string; machine: string } | null;
  lines: ReturnToStockLine[];
  remark: string;
  status: "Draft" | "Completed";
};

export const returnToStocks: ReturnToStock[] = [];

// ─── INVENTORY – PHYSICAL VERIFICATION ───────────────────────

export type PhysicalVerificationLine = {
  lineId: string;
  batchNo: string; supplierBatchNo: string;
  itemCode: string; itemName: string; stockUnit: string;
  itemGroup: string; itemSubGroup: string;
  warehouseId: string; warehouseName: string; bin: string;
  grnNo: string;
  systemQty: number;
  physicalQty: number;
  difference: number;
  isNewBatch: boolean;
  originalBatchNo: string;
};

export type PhysicalVerification = {
  id: string; voucherNo: string; verificationDate: string;
  lines: PhysicalVerificationLine[];
  remark: string;
  status: "Draft" | "Completed";
};

export const physicalVerifications: PhysicalVerification[] = [];

// ═══════════════════════════════════════════════════════════════
// GRAVURE MODULE – Types & Dummy Data
// ═══════════════════════════════════════════════════════════════

export type SecondaryLayer = {
  id: string;
  layerNo: number;
  plyType: string;               // "Film" | "Printing" | "Lamination" | "Coating"
  itemSubGroup: string;          // film sub group
  density: number;
  thickness: number;
  gsm: number;
  filmRate?: number;
  consumableItems: PlyConsumableItem[];  // consumables selected for this ply
};

export type DryWeightRow = {
  id: string;
  particular: string;
  gramM2: number;
};

export type GravureEnquiry = {
  id: string; enquiryNo: string; date: string;
  customerId: string; customerName: string;
  jobName: string;
  substrate: string;
  width: number;
  repeatLength: number;
  noOfColors: number;
  printType: "Surface Print" | "Reverse Print" | "Combination";
  structureType: string;
  quantity: number; unit: string;
  cylinderStatus: "New" | "Existing" | "To Be Confirmed";
  designRef: string;
  specialFinish: string;
  remarks: string;
  status: "Pending" | "Estimated" | "Converted" | "Rejected";
};

export type GravureEstimationMaterial = {
  itemId: string; itemCode: string; itemName: string;
  group: string; unit: string;
  rate: number; qty: number; amount: number;
};

export type GravureEstimationProcess = {
  processId: string; processName: string;
  chargeUnit: string; rate: number;
  qty: number; setupCharge: number; amount: number;
};

export type GravureEstimation = {
  id: string; estimationNo: string; date: string;
  enquiryId: string; enquiryNo: string;
  customerId: string; customerName: string;
  jobName: string;
  categoryId?: string; categoryName?: string;
  content?: string;
  jobWidth: number; jobHeight: number; ups: number;
  trimmingSize?: number;
  actualWidth: number; actualHeight: number;
  substrateItemId: string; substrateName: string;
  width: number; noOfColors: number; frontColors?: number; backColors?: number;
  printType: "Surface Print" | "Reverse Print" | "Combination";
  quantity: number; quantities: number[]; unit: string;
  machineId: string; machineName: string;
  cylinderCostPerColor: number;
  cylinderRatePerSqInch?: number;          // ₹/sq.inch — area-based cylinder engraving rate
  sleeveWidth?: number;                     // mm — sleeve width (0 = use film size)
  repeatLength: number;                     // mm — cylinder circumference
  wastagePct: number;                       // % — dynamic wastage
  setupTime: number;                        // minutes
  machineCostPerHour: number;               // ₹/hr — machine-specific setup cost
  minimumOrderValue: number;                // ₹ — floor price
  sellingPrice: number;                     // ₹/m — for contribution & break-even
  materials: GravureEstimationMaterial[];
  processes: GravureEstimationProcess[];
  overheadPct: number; profitPct: number;
  labourCost?: number; transportationCost?: number; interestCost?: number;
  materialCost: number; processCost: number; cylinderCost: number;
  setupCost: number;
  overheadAmt: number; profitAmt: number;
  totalAmount: number; perMeterRate: number; marginPct: number;
  contribution: number; breakEvenQty: number;
  secondaryLayers: SecondaryLayer[];
  dryWeightRows: DryWeightRow[];
  dryWeightTotal: number;
  status: "Draft" | "Approved" | "Sent" | "Accepted" | "Rejected";
  remarks: string;
  salesPerson?: string;
  salesType?: string;
  concernPerson?: string;
};

export type GravureOrderLine = {
  id: string;
  lineNo: number;
  sourceType: "Estimation" | "Catalog" | "Direct";
  estimationId: string; estimationNo: string;
  catalogId: string; catalogNo: string;
  productCode: string; productName: string;
  categoryId: string; categoryName: string;
  substrate: string;
  jobWidth: number; jobHeight: number;
  noOfColors: number;
  printType: "Surface Print" | "Reverse Print" | "Combination";
  cylinderStatus: "New" | "Existing";
  cylinderCount: number;
  filmType: string;
  laminationRequired: boolean;
  orderQty: number; unit: string;
  rate: number; currency: string;
  amount: number;
  deliveryDate: string;
  remarks: string;
};

export type GravureOrder = {
  id: string; orderNo: string; date: string;
  // Header
  customerId: string; customerName: string;
  salesPerson: string; salesType: string; salesLedger: string;
  poNo: string; poDate: string;
  directDispatch: boolean;
  // Lines
  orderLines: GravureOrderLine[];
  // Summary
  totalAmount: number; advancePaid: number;
  remarks: string;
  status: "Confirmed" | "In Production" | "Ready" | "Dispatched";
  // Legacy single-product fields (kept for workorder compatibility)
  sourceType: "Estimation" | "Catalog" | "Direct";
  enquiryId: string; estimationId: string;
  catalogId: string; catalogNo: string;
  jobName: string; substrate: string; structure: string;
  categoryId: string; categoryName: string; content: string;
  jobWidth: number; jobHeight: number;
  width: number; noOfColors: number;
  printType: string;
  quantity: number; unit: string;
  deliveryDate: string; cylinderSet: string;
  perMeterRate: number;
  machineId: string; machineName: string;
  secondaryLayers: SecondaryLayer[];
  processes: GravureEstimationProcess[];
  overheadPct: number; profitPct: number;
};

export type GravureProductCatalog = {
  id: string; catalogNo: string; createdDate: string;
  productName: string;
  customerId: string; customerName: string;
  categoryId: string; categoryName: string; content: string;
  jobWidth: number; jobHeight: number;
  actualWidth: number; actualHeight: number;
  noOfColors: number;
  printType: "Surface Print" | "Reverse Print" | "Combination";
  substrate: string;
  secondaryLayers: SecondaryLayer[];
  processes: GravureEstimationProcess[];
  machineId: string; machineName: string;
  cylinderCostPerColor: number;
  overheadPct: number; profitPct: number;
  perMeterRate: number;
  standardQty: number; standardUnit: string;
  sourceEstimationId: string; sourceEstimationNo: string;
  sourceOrderId: string; sourceOrderNo: string;   // order → catalog link
  sourceWorkOrderId: string; sourceWorkOrderNo: string; // WO → catalog link
  trimmingSize?: number;
  frontColors?: number; backColors?: number;
  status: "Active" | "Inactive";
  remarks: string;
};

export type GravureWorkOrder = {
  id: string; workOrderNo: string; date: string;
  // Source — always from an Order
  orderId: string; orderNo: string;
  sourceOrderType: "Estimation" | "Catalog" | "Direct"; // source of the parent order
  customerId: string; customerName: string;
  jobName: string; substrate: string; structure: string;
  categoryId: string; categoryName: string; content: string;
  // Dimensions
  jobWidth: number; jobHeight: number;
  actualWidth: number; actualHeight: number;
  width: number; noOfColors: number;
  printType: "Surface Print" | "Reverse Print" | "Combination";
  // Machine & Cost
  machineId: string; machineName: string;
  cylinderCostPerColor: number;
  overheadPct: number; profitPct: number;
  perMeterRate: number; totalAmount: number;
  // Planning
  processes: GravureEstimationProcess[];
  secondaryLayers: SecondaryLayer[];
  selectedPlanId: string; ups: number;
  trimmingSize?: number;
  frontColors?: number; backColors?: number;
  // Operator & Production
  operatorId: string; operatorName: string;
  cylinderSet: string; inks: string[];
  quantity: number; unit: string;
  plannedDate: string; specialInstructions: string;
  status: "Open" | "In Progress" | "Completed" | "On Hold";
};

export type GravureItemIssueItem = {
  itemId: string; itemName: string;
  itemType: "Substrate" | "Ink" | "Adhesive" | "Solvent" | "Chemical" | "Other";
  requiredQty: number; issuedQty: number; unit: string;
};

export type GravureItemIssue = {
  id: string; issueNo: string; date: string;
  workOrderId: string; workOrderNo: string;
  customerName: string; jobName: string;
  items: GravureItemIssueItem[];
  issuedBy: string;
  status: "Pending" | "Partial" | "Issued";
};

export type MaterialConsumptionLine = {
  itemId: string; itemName: string;
  itemType: "Film" | "Ink" | "Solvent" | "Adhesive" | "Other";
  plannedQty: number; actualQty: number;
  unit: string; variance: number;
};

export type ProductionProcessEntry = {
  id: string; processName: string;
  startTime: string; endTime: string;
  outputQty: number; wastageQty: number; remarks: string;
};

export type GravureProductionEntry = {
  id: string; entryNo: string; date: string;
  // Header
  workOrderId: string; workOrderNo: string;
  customerId: string; customerName: string; jobName: string;
  machineId: string; machineName: string;
  shift: "A" | "B" | "C";
  operatorName: string; supervisorName: string;
  // Machine Control
  machineStatus: "Pending" | "Running" | "On Hold" | "Stopped";
  startTime: string; pauseTime: string; resumeTime: string; stopTime: string;
  pauseReason: "Breakdown" | "Ink Issue" | "Cylinder" | "Power" | "";
  totalRunTime: number; downtime: number;
  // Production Output
  producedQty: number; goodQty: number; rejectedQty: number;
  wastageQty: number; netQty: number;
  efficiencyPct: number; wastagePct: number;
  // Speed & Meters
  speed: number; machineRuntime: number; machineUtilPct: number;
  totalMeterRun: number; wasteMeter: number; netMeter: number;
  // Color / Cylinder
  noOfColors: number; cylinderCode: string; impressionCount: number;
  // Detail grids
  materialLines: MaterialConsumptionLine[];
  processEntries: ProductionProcessEntry[];
  // Legacy / quality
  substrate: string; rollNo: string;
  inkConsumption: number;
  printQuality: "Good" | "Rework" | "Rejected";
  status: "Pending" | "In Progress" | "Completed" | "On Hold";
  remarks: string;
};

export type GravureDispatch = {
  id: string; dispatchNo: string; date: string;
  orderId: string; orderNo: string;
  customerId: string; customerName: string;
  jobName: string; quantity: number; unit: string;
  noOfRolls: number; vehicleNo: string; driverName: string; lrNo: string;
  status: "Pending" | "In Transit" | "Delivered";
};

// ─── GRAVURE ENQUIRIES ────────────────────────────────────────
export const gravureEnquiries: GravureEnquiry[] = [
  { id: "GE001", enquiryNo: "GRV-ENQ-2024-001", date: "2024-03-02", customerId: "C001", customerName: "Parle Products Pvt Ltd", jobName: "Parle-G Biscuit 100g Wrap", substrate: "BOPP 20μ", width: 340, repeatLength: 450, noOfColors: 8, printType: "Surface Print", structureType: "BOPP+CPP", quantity: 200000, unit: "Meter", cylinderStatus: "New", designRef: "PARLE-ART-2024-01", specialFinish: "Gloss OPV", remarks: "Urgent – needed for Feb launch", status: "Converted" },
  { id: "GE002", enquiryNo: "GRV-ENQ-2024-002", date: "2024-03-05", customerId: "C002", customerName: "Britannia Industries Ltd", jobName: "Britannia NutriChoice 200g", substrate: "PET 12μ", width: 420, repeatLength: 400, noOfColors: 6, printType: "Reverse Print", structureType: "PET+Dry Lam+PE", quantity: 150000, unit: "Meter", cylinderStatus: "Existing", designRef: "BRIT-ART-2024-05", specialFinish: "Matte OPV", remarks: "Existing cylinders available", status: "Estimated" },
  { id: "GE003", enquiryNo: "GRV-ENQ-2024-003", date: "2024-03-08", customerId: "C003", customerName: "Haldiram Snacks Pvt Ltd", jobName: "Haldiram Bhujia Pouch 200g", substrate: "BOPP 20μ", width: 380, repeatLength: 480, noOfColors: 9, printType: "Combination", structureType: "BOPP+Met PET+CPP", quantity: 300000, unit: "Meter", cylinderStatus: "New", designRef: "HALD-ART-2024-03", specialFinish: "Gloss OPV", remarks: "High barrier requirement", status: "Pending" },
  { id: "GE004", enquiryNo: "GRV-ENQ-2024-004", date: "2024-03-10", customerId: "C005", customerName: "Amul Dairy", jobName: "Amul Butter Shrink Sleeve", substrate: "PVC 50μ", width: 260, repeatLength: 360, noOfColors: 6, printType: "Surface Print", structureType: "PVC Shrink", quantity: 500000, unit: "Meter", cylinderStatus: "Existing", designRef: "AMUL-ART-2024-01", specialFinish: "None", remarks: "UV ink required", status: "Pending" },
  { id: "GE005", enquiryNo: "GRV-ENQ-2024-005", date: "2024-03-12", customerId: "C006", customerName: "Nestle India Ltd", jobName: "Maggi Noodles 70g Outer Wrap", substrate: "BOPP 20μ", width: 300, repeatLength: 390, noOfColors: 8, printType: "Reverse Print", structureType: "BOPP+PE", quantity: 250000, unit: "Meter", cylinderStatus: "New", designRef: "NEST-ART-2024-02", specialFinish: "Matte OPV", remarks: "Sample approved from design team", status: "Converted" },
];

// ─── GRAVURE ESTIMATIONS ──────────────────────────────────────
export const gravureEstimations: GravureEstimation[] = [
  {
    id: "GEST001", estimationNo: "GRV-EST-2024-001", date: "2024-03-04",
    enquiryId: "GE001", enquiryNo: "GRV-ENQ-2024-001",
    customerId: "C001", customerName: "Parle Products Pvt Ltd",
    jobName: "Parle-G Biscuit 100g Wrap",
    categoryId: "CAT001", categoryName: "Roto - Label", content: "BOPP Label",
    substrateItemId: "ITM001", substrateName: "BOPP 90 MICRON 0.2 THICKNESS",
    jobWidth: 340, jobHeight: 450, ups: 2,
    actualWidth: 340, actualHeight: 450,
    width: 340, noOfColors: 8, printType: "Surface Print",
    quantity: 200000, quantities: [200000], unit: "Meter",
    machineId: "M004", machineName: "Roto Press 1 – 8 Color",
    cylinderCostPerColor: 3500,
    salesPerson: "Rajesh Sharma", salesType: "Local", concernPerson: "Amit Parle",
    materials: [
      { itemId: "ITM001", itemCode: "RM-FIL-4475", itemName: "BOPP 90 MICRON 0.2 THICKNESS", group: "Film",    unit: "Kg", rate: 155, qty: 1200, amount: 186000 },
      { itemId: "ITM007", itemCode: "RM-INK-001",  itemName: "YELLOW INK SOLVENT BASED",    group: "Ink",     unit: "Kg", rate: 460, qty:   38, amount:  17480 },
      { itemId: "ITM008", itemCode: "RM-INK-002",  itemName: "CYAN INK SOLVENT BASED",      group: "Ink",     unit: "Kg", rate: 490, qty:   45, amount:  22050 },
      { itemId: "ITM009", itemCode: "RM-INK-003",  itemName: "MAGENTA INK SOLVENT BASED",   group: "Ink",     unit: "Kg", rate: 500, qty:   38, amount:  19000 },
      { itemId: "ITM010", itemCode: "RM-INK-004",  itemName: "BLACK INK SOLVENT BASED",     group: "Ink",     unit: "Kg", rate: 430, qty:   28, amount:  12040 },
      { itemId: "ITM011", itemCode: "RM-CHM-001",  itemName: "PU ADHESIVE DRY BOND",        group: "Solvent", unit: "Kg", rate: 330, qty:   80, amount:  26400 },
    ],
    processes: [
      { processId: "PR004", processName: "8-Color Roto Printing",  chargeUnit: "m²", rate: 2.50, qty: 68000,  setupCharge: 1500, amount: 171500 },
      { processId: "PR007", processName: "Dry Bond Lamination",    chargeUnit: "m²", rate: 1.80, qty: 68000,  setupCharge: 0,    amount: 122400 },
      { processId: "PR013", processName: "Slitting & Rewinding",   chargeUnit: "m",  rate: 0.60, qty: 200000, setupCharge: 0,    amount: 120000 },
    ],
    overheadPct: 12, profitPct: 15,
    materialCost: 282970, processCost: 413900, cylinderCost: 28000,
    overheadAmt: 86961, profitAmt: 108701,
    totalAmount: 920532, perMeterRate: 4.60, marginPct: 14.7,
    secondaryLayers: [
      {
        id: "SL001", layerNo: 1, plyType: "Film", itemSubGroup: "BOPP FILM", density: 0.91, thickness: 20, gsm: 18.2,
        consumableItems: [],
      },
      {
        id: "SL002", layerNo: 2, plyType: "Printing", itemSubGroup: "BOPP FILM", density: 0.91, thickness: 0, gsm: 0,
        consumableItems: [
          { consumableId: "CI001", fieldDisplayName: "Ink Wet Weight", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM007", itemName: "YELLOW INK SOLVENT BASED", gsm: 3.5, rate: 460 },
          { consumableId: "CI002", fieldDisplayName: "Solvent", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", itemId: "ITM011", itemName: "PU ADHESIVE DRY BOND", gsm: 2.0, rate: 330 },
        ],
      },
      {
        id: "SL003", layerNo: 3, plyType: "Lamination", itemSubGroup: "CPP FILM", density: 0.90, thickness: 30, gsm: 27,
        consumableItems: [
          { consumableId: "CI003", fieldDisplayName: "Adhesive Wet Weight", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive", itemId: "ITM011", itemName: "PU ADHESIVE DRY BOND", gsm: 3.5, rate: 330 },
        ],
      },
    ],
    dryWeightRows: [], dryWeightTotal: 0,
    repeatLength: 450, wastagePct: 1, setupTime: 30, machineCostPerHour: 1350,
    minimumOrderValue: 50000, sellingPrice: 1.5, setupCost: 675, contribution: 0, breakEvenQty: 0,
    status: "Approved", remarks: "Price valid for 30 days",
  },
  {
    id: "GEST002", estimationNo: "GRV-EST-2024-002", date: "2024-03-07",
    enquiryId: "GE002", enquiryNo: "GRV-ENQ-2024-002",
    customerId: "C002", customerName: "Britannia Industries Ltd",
    jobName: "Britannia NutriChoice 200g",
    categoryId: "CAT002", categoryName: "Pouch", content: "3-Side Seal",
    substrateItemId: "ITM002", substrateName: "LLDPE C4 GRADE FILM",
    jobWidth: 420, jobHeight: 400, ups: 2,
    actualWidth: 420, actualHeight: 400,
    width: 420, noOfColors: 6, printType: "Reverse Print",
    quantity: 150000, quantities: [150000], unit: "Meter",
    machineId: "M003", machineName: "Roto Press 4 – 6 Color",
    cylinderCostPerColor: 0,
    salesPerson: "Sanjay Gupta", salesType: "Local", concernPerson: "Priya Britannia",
    materials: [
      { itemId: "ITM002", itemCode: "RM-FIL-1022", itemName: "LLDPE C4 GRADE FILM",       group: "Film", unit: "Kg", rate:  98, qty: 900, amount:  88200 },
      { itemId: "ITM007", itemCode: "RM-INK-001",  itemName: "YELLOW INK SOLVENT BASED",  group: "Ink",  unit: "Kg", rate: 460, qty:  30, amount:  13800 },
      { itemId: "ITM008", itemCode: "RM-INK-002",  itemName: "CYAN INK SOLVENT BASED",    group: "Ink",  unit: "Kg", rate: 490, qty:  28, amount:  13720 },
      { itemId: "ITM010", itemCode: "RM-INK-004",  itemName: "BLACK INK SOLVENT BASED",   group: "Ink",  unit: "Kg", rate: 430, qty:  22, amount:   9460 },
      { itemId: "ITM011", itemCode: "RM-CHM-001",  itemName: "PU ADHESIVE DRY BOND",      group: "Solvent", unit: "Kg", rate: 330, qty: 60, amount: 19800 },
    ],
    processes: [
      { processId: "PR003", processName: "6-Color Roto Printing", chargeUnit: "m²", rate: 2.00, qty: 63000,  setupCharge: 1200, amount: 127200 },
      { processId: "PR007", processName: "Dry Bond Lamination",   chargeUnit: "m²", rate: 1.80, qty: 63000,  setupCharge: 0,    amount: 113400 },
      { processId: "PR013", processName: "Slitting & Rewinding",  chargeUnit: "m",  rate: 0.60, qty: 150000, setupCharge: 0,    amount:  90000 },
    ],
    overheadPct: 12, profitPct: 15,
    materialCost: 144980, processCost: 330600, cylinderCost: 0,
    overheadAmt: 57069, profitAmt: 71336,
    totalAmount: 603985, perMeterRate: 4.03, marginPct: 13.2,
    secondaryLayers: [
      {
        id: "SL004", layerNo: 1, plyType: "Film", itemSubGroup: "PET FILM", density: 1.38, thickness: 12, gsm: 16.56,
        consumableItems: [],
      },
      {
        id: "SL005", layerNo: 2, plyType: "Printing", itemSubGroup: "PET FILM", density: 1.38, thickness: 0, gsm: 0,
        consumableItems: [
          { consumableId: "CI004", fieldDisplayName: "Ink Wet Weight", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM007", itemName: "YELLOW INK SOLVENT BASED", gsm: 3.2, rate: 460 },
        ],
      },
      {
        id: "SL006", layerNo: 3, plyType: "Lamination", itemSubGroup: "LLDPE C4 GRADE", density: 0.92, thickness: 40, gsm: 36.8,
        consumableItems: [
          { consumableId: "CI005", fieldDisplayName: "Adhesive Wet Weight", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive", itemId: "ITM011", itemName: "PU ADHESIVE DRY BOND", gsm: 3.5, rate: 330 },
        ],
      },
    ],
    dryWeightRows: [], dryWeightTotal: 0,
    repeatLength: 400, wastagePct: 1, setupTime: 20, machineCostPerHour: 1350,
    minimumOrderValue: 40000, sellingPrice: 1.6, setupCost: 450, contribution: 0, breakEvenQty: 0,
    status: "Sent", remarks: "Cylinder cost absorbed (existing set)",
  },
  {
    id: "GEST003", estimationNo: "GRV-EST-2024-003", date: "2024-03-14",
    enquiryId: "GE005", enquiryNo: "GRV-ENQ-2024-005",
    customerId: "C006", customerName: "Nestle India Ltd",
    jobName: "Maggi Noodles 70g Outer Wrap",
    categoryId: "CAT001", categoryName: "Roto - Label", content: "BOPP Label",
    substrateItemId: "ITM001", substrateName: "BOPP 90 MICRON 0.2 THICKNESS",
    jobWidth: 300, jobHeight: 390, ups: 2,
    actualWidth: 300, actualHeight: 390,
    width: 300, noOfColors: 8, printType: "Reverse Print",
    quantity: 250000, quantities: [250000], unit: "Meter",
    machineId: "M005", machineName: "Roto Press 2 – 9 Color",
    cylinderCostPerColor: 3500,
    salesPerson: "Anita Desai", salesType: "Inter-State", concernPerson: "Rahul Nestle",
    materials: [
      { itemId: "ITM001", itemCode: "RM-FIL-4475", itemName: "BOPP 90 MICRON 0.2 THICKNESS", group: "Film", unit: "Kg", rate: 155, qty: 1400, amount: 217000 },
      { itemId: "ITM007", itemCode: "RM-INK-001",  itemName: "YELLOW INK SOLVENT BASED",     group: "Ink",  unit: "Kg", rate: 460, qty:   42, amount:  19320 },
      { itemId: "ITM008", itemCode: "RM-INK-002",  itemName: "CYAN INK SOLVENT BASED",       group: "Ink",  unit: "Kg", rate: 490, qty:   50, amount:  24500 },
      { itemId: "ITM009", itemCode: "RM-INK-003",  itemName: "MAGENTA INK SOLVENT BASED",    group: "Ink",  unit: "Kg", rate: 500, qty:   42, amount:  21000 },
      { itemId: "ITM010", itemCode: "RM-INK-004",  itemName: "BLACK INK SOLVENT BASED",      group: "Ink",  unit: "Kg", rate: 430, qty:   35, amount:  15050 },
      { itemId: "ITM011", itemCode: "RM-CHM-001",  itemName: "PU ADHESIVE DRY BOND",         group: "Solvent", unit: "Kg", rate: 330, qty: 100, amount: 33000 },
    ],
    processes: [
      { processId: "PR004", processName: "8-Color Roto Printing", chargeUnit: "m²", rate: 2.50, qty: 75000,  setupCharge: 1500, amount: 188500 },
      { processId: "PR008", processName: "Solventless Lamination", chargeUnit: "m²", rate: 1.60, qty: 75000, setupCharge: 0,    amount: 120000 },
      { processId: "PR013", processName: "Slitting & Rewinding",   chargeUnit: "m",  rate: 0.60, qty: 250000, setupCharge: 0,   amount: 150000 },
    ],
    overheadPct: 12, profitPct: 15,
    materialCost: 329870, processCost: 458500, cylinderCost: 28000,
    overheadAmt: 98124, profitAmt: 122655,
    totalAmount: 1037149, perMeterRate: 4.15, marginPct: 12.9,
    secondaryLayers: [
      {
        id: "SL007", layerNo: 1, plyType: "Film", itemSubGroup: "BOPP FILM", density: 0.91, thickness: 20, gsm: 18.2,
        consumableItems: [],
      },
      {
        id: "SL008", layerNo: 2, plyType: "Printing", itemSubGroup: "BOPP FILM", density: 0.91, thickness: 0, gsm: 0,
        consumableItems: [
          { consumableId: "CI006", fieldDisplayName: "Ink Wet Weight", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM008", itemName: "CYAN INK SOLVENT BASED", gsm: 3.8, rate: 490 },
          { consumableId: "CI007", fieldDisplayName: "Solvent", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", itemId: "ITM011", itemName: "PU ADHESIVE DRY BOND", gsm: 2.2, rate: 330 },
        ],
      },
    ],
    dryWeightRows: [], dryWeightTotal: 0,
    repeatLength: 390, wastagePct: 1.5, setupTime: 25, machineCostPerHour: 1350,
    minimumOrderValue: 60000, sellingPrice: 1.8, setupCost: 562.5, contribution: 0, breakEvenQty: 0,
    status: "Draft", remarks: "Awaiting design confirmation",
  },
];

// ─── GRAVURE ORDERS ───────────────────────────────────────────
export const gravureOrders: GravureOrder[] = [
  {
    id: "GO001", orderNo: "GRV-ORD-2024-001", date: "2024-03-06",
    customerId: "C001", customerName: "Parle Products Pvt Ltd",
    salesPerson: "Rajesh Sharma", salesType: "Local", salesLedger: "Domestic Sales – Shrink Film",
    poNo: "PO-PARLE-2024-031", poDate: "2024-03-05", directDispatch: false,
    orderLines: [
      { id: "GL001-1", lineNo: 1, sourceType: "Estimation", estimationId: "GEST001", estimationNo: "GRV-EST-2024-001", catalogId: "", catalogNo: "", productCode: "PARLE-BISC-100G", productName: "Parle-G Biscuit 100g Wrap", categoryId: "CAT001", categoryName: "Roto - Label", substrate: "BOPP 20μ", jobWidth: 340, jobHeight: 450, noOfColors: 8, printType: "Surface Print", cylinderStatus: "New", cylinderCount: 8, filmType: "BOPP", laminationRequired: true, orderQty: 200000, unit: "Meter", rate: 1.36, currency: "INR", amount: 272000, deliveryDate: "2024-03-28", remarks: "Pantone matching required" },
    ],
    totalAmount: 272000, advancePaid: 80000, remarks: "Urgent – Feb launch",
    status: "In Production",
    // Legacy fields
    sourceType: "Estimation", enquiryId: "GE001", estimationId: "GEST001", catalogId: "", catalogNo: "",
    jobName: "Parle-G Biscuit 100g Wrap", substrate: "BOPP 20μ", structure: "BOPP 20μ + Dry Lam + CPP 30μ",
    categoryId: "CAT001", categoryName: "Roto - Label", content: "BOPP Label",
    jobWidth: 340, jobHeight: 450, width: 340, noOfColors: 8, printType: "Surface Print",
    quantity: 200000, unit: "Meter", deliveryDate: "2024-03-28", cylinderSet: "CYL-P001",
    perMeterRate: 1.36, machineId: "M004", machineName: "Roto Press 1 – 8 Color",
    secondaryLayers: [], processes: [], overheadPct: 12, profitPct: 15,
  },
  {
    id: "GO002", orderNo: "GRV-ORD-2024-002", date: "2024-03-10",
    customerId: "C002", customerName: "Britannia Industries Ltd",
    salesPerson: "Sanjay Gupta", salesType: "Local", salesLedger: "Domestic Sales – Shrink Film",
    poNo: "PO-BRIT-2024-058", poDate: "2024-03-09", directDispatch: false,
    orderLines: [
      { id: "GL002-1", lineNo: 1, sourceType: "Estimation", estimationId: "GEST002", estimationNo: "GRV-EST-2024-002", catalogId: "", catalogNo: "", productCode: "BRIT-NC-200G", productName: "Britannia NutriChoice 200g", categoryId: "CAT002", categoryName: "Pouch", substrate: "PET 12μ", jobWidth: 420, jobHeight: 400, noOfColors: 6, printType: "Reverse Print", cylinderStatus: "Existing", cylinderCount: 6, filmType: "PET", laminationRequired: true, orderQty: 150000, unit: "Meter", rate: 1.52, currency: "INR", amount: 228000, deliveryDate: "2024-04-02", remarks: "Matte OPV required" },
    ],
    totalAmount: 228000, advancePaid: 60000, remarks: "Existing cylinders available",
    status: "Confirmed",
    // Legacy fields
    sourceType: "Estimation", enquiryId: "GE002", estimationId: "GEST002", catalogId: "", catalogNo: "",
    jobName: "Britannia NutriChoice 200g", substrate: "PET 12μ", structure: "PET 12μ + Dry Lam + PE 40μ",
    categoryId: "CAT002", categoryName: "Pouch", content: "3-Side Seal",
    jobWidth: 420, jobHeight: 400, width: 420, noOfColors: 6, printType: "Reverse Print",
    quantity: 150000, unit: "Meter", deliveryDate: "2024-04-02", cylinderSet: "CYL-B001",
    perMeterRate: 1.52, machineId: "M003", machineName: "Roto Press 4 – 6 Color",
    secondaryLayers: [], processes: [], overheadPct: 12, profitPct: 15,
  },
  {
    id: "GO003", orderNo: "GRV-ORD-2024-003", date: "2024-03-14",
    customerId: "C006", customerName: "Nestle India Ltd",
    salesPerson: "Anita Desai", salesType: "Inter-State", salesLedger: "Domestic Sales – Shrink Film",
    poNo: "PO-NEST-2024-021", poDate: "2024-03-13", directDispatch: true,
    orderLines: [
      { id: "GL003-1", lineNo: 1, sourceType: "Direct", estimationId: "", estimationNo: "", catalogId: "", catalogNo: "", productCode: "NEST-MAGGI-70G", productName: "Maggi Noodles 70g Outer Wrap", categoryId: "", categoryName: "", substrate: "BOPP 20μ", jobWidth: 300, jobHeight: 0, noOfColors: 8, printType: "Reverse Print", cylinderStatus: "New", cylinderCount: 8, filmType: "BOPP", laminationRequired: false, orderQty: 250000, unit: "Meter", rate: 1.40, currency: "INR", amount: 350000, deliveryDate: "2024-04-08", remarks: "" },
    ],
    totalAmount: 350000, advancePaid: 100000, remarks: "",
    status: "Confirmed",
    // Legacy fields
    sourceType: "Direct", enquiryId: "GE005", estimationId: "", catalogId: "", catalogNo: "",
    jobName: "Maggi Noodles 70g Outer Wrap", substrate: "BOPP 20μ", structure: "BOPP 20μ + PE 30μ",
    categoryId: "", categoryName: "", content: "",
    jobWidth: 300, jobHeight: 0, width: 300, noOfColors: 8, printType: "Reverse Print",
    quantity: 250000, unit: "Meter", deliveryDate: "2024-04-08", cylinderSet: "",
    perMeterRate: 1.40, machineId: "", machineName: "",
    secondaryLayers: [], processes: [], overheadPct: 12, profitPct: 15,
  },
  {
    id: "GO004", orderNo: "GRV-ORD-2024-004", date: "2024-03-18",
    customerId: "C005", customerName: "Amul Dairy",
    salesPerson: "Rajesh Sharma", salesType: "Local", salesLedger: "Domestic Sales – Shrink Film",
    poNo: "PO-AMUL-2024-009", poDate: "2024-03-17", directDispatch: false,
    orderLines: [
      { id: "GL004-1", lineNo: 1, sourceType: "Direct", estimationId: "", estimationNo: "", catalogId: "", catalogNo: "", productCode: "AMUL-BUT-SLV", productName: "Amul Butter Shrink Sleeve", categoryId: "", categoryName: "", substrate: "PVC 50μ", jobWidth: 260, jobHeight: 360, noOfColors: 6, printType: "Surface Print", cylinderStatus: "Existing", cylinderCount: 6, filmType: "PVC", laminationRequired: false, orderQty: 500000, unit: "Meter", rate: 0.90, currency: "INR", amount: 450000, deliveryDate: "2024-04-15", remarks: "UV ink required" },
    ],
    totalAmount: 450000, advancePaid: 150000, remarks: "UV ink required",
    status: "Ready",
    // Legacy fields
    sourceType: "Direct", enquiryId: "GE004", estimationId: "", catalogId: "", catalogNo: "",
    jobName: "Amul Butter Shrink Sleeve", substrate: "PVC 50μ", structure: "PVC 50μ Shrink",
    categoryId: "", categoryName: "", content: "",
    jobWidth: 260, jobHeight: 360, width: 260, noOfColors: 6, printType: "Surface Print",
    quantity: 500000, unit: "Meter", deliveryDate: "2024-04-15", cylinderSet: "CYL-A001",
    perMeterRate: 0.90, machineId: "", machineName: "",
    secondaryLayers: [{ id: "GO004-L1", layerNo: 1, plyType: "Film", itemSubGroup: "BOPP Film", density: 0.91, thickness: 50, gsm: 45.5, consumableItems: [] }, { id: "GO004-L2", layerNo: 2, plyType: "Printing", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [{ consumableId: "DEF_INK", fieldDisplayName: "Ink", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM009", itemName: "MAGENTA INK SOLVENT BASED", gsm: 3.5, rate: 500 }, { consumableId: "DEF_SOL", fieldDisplayName: "Solvent", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", itemId: "ITM015", itemName: "ETHYL ACETATE (EA) GRADE", gsm: 2.0, rate: 65 }] }], processes: [{ processId: "PR001", processName: "Cylinder Engraving", chargeUnit: "Cylinder", rate: 3500, qty: 6, setupCharge: 0, amount: 21000 }, { processId: "PR003", processName: "6-Color Roto Printing", chargeUnit: "m²", rate: 2.00, qty: 0, setupCharge: 1200, amount: 1200 }], overheadPct: 12, profitPct: 15,
  },
  {
    id: "GO005", orderNo: "GRV-ORD-2024-005", date: "2024-03-20",
    customerId: "C003", customerName: "ITC Limited",
    salesPerson: "Sanjay Gupta", salesType: "Local", salesLedger: "Domestic Sales – Shrink Film",
    poNo: "PO-ITC-2024-042", poDate: "2024-03-19", directDispatch: false,
    orderLines: [
      { id: "GL005-1", lineNo: 1, sourceType: "Estimation", estimationId: "GEST003", estimationNo: "GRV-EST-2024-003", catalogId: "", catalogNo: "", productCode: "ITC-CHIP-100G", productName: "ITC Bingo Chips 100g Pouch", categoryId: "CAT002", categoryName: "Pouch", substrate: "BOPP 20μ", jobWidth: 380, jobHeight: 420, noOfColors: 6, printType: "Reverse Print", cylinderStatus: "New", cylinderCount: 6, filmType: "BOPP", laminationRequired: true, orderQty: 180000, unit: "Meter", rate: 1.45, currency: "INR", amount: 261000, deliveryDate: "2024-04-20", remarks: "Food-grade ink only" },
    ],
    totalAmount: 261000, advancePaid: 75000, remarks: "Food-grade materials mandatory",
    status: "Confirmed",
    sourceType: "Estimation", enquiryId: "GE006", estimationId: "GEST003", catalogId: "", catalogNo: "",
    jobName: "ITC Bingo Chips 100g Pouch", substrate: "BOPP 20μ", structure: "BOPP 20μ + Dry Lam + CPP 25μ",
    categoryId: "CAT002", categoryName: "Pouch", content: "3-Side Seal",
    jobWidth: 380, jobHeight: 420, width: 380, noOfColors: 6, printType: "Reverse Print",
    quantity: 180000, unit: "Meter", deliveryDate: "2024-04-20", cylinderSet: "",
    perMeterRate: 1.45, machineId: "M003", machineName: "Roto Press 4 – 6 Color",
    secondaryLayers: [{ id: "GO005-L1", layerNo: 1, plyType: "Film", itemSubGroup: "BOPP Film", density: 0.91, thickness: 20, gsm: 18.2, consumableItems: [] }, { id: "GO005-L2", layerNo: 2, plyType: "Printing", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [{ consumableId: "DEF_INK", fieldDisplayName: "Ink", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM007", itemName: "YELLOW INK SOLVENT BASED", gsm: 3.5, rate: 460 }, { consumableId: "DEF_SOL", fieldDisplayName: "Solvent", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", itemId: "ITM015", itemName: "ETHYL ACETATE (EA) GRADE", gsm: 2.0, rate: 65 }] }, { id: "GO005-L3", layerNo: 3, plyType: "Lamination", itemSubGroup: "LLDPE Grade", density: 0.92, thickness: 25, gsm: 23.0, consumableItems: [{ consumableId: "DEF_ADH", fieldDisplayName: "Adhesive", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive", itemId: "ITM019", itemName: "PU ADHESIVE 2K (PART A)", gsm: 3.5, rate: 330 }, { consumableId: "DEF_HRD", fieldDisplayName: "Hardener", itemGroup: "Hardner", itemSubGroup: "PU Hardener", itemId: "ITM022", itemName: "PU HARDENER (PART B)", gsm: 0.7, rate: 395 }] }],
    processes: [{ processId: "PR001", processName: "Cylinder Engraving", chargeUnit: "Cylinder", rate: 3500, qty: 6, setupCharge: 0, amount: 21000 }, { processId: "PR003", processName: "6-Color Roto Printing", chargeUnit: "m²", rate: 2.00, qty: 0, setupCharge: 1200, amount: 1200 }, { processId: "PR007", processName: "Dry Bond Lamination", chargeUnit: "m²", rate: 1.80, qty: 0, setupCharge: 0, amount: 0 }],
    overheadPct: 12, profitPct: 15,
  },
  {
    id: "GO006", orderNo: "GRV-ORD-2024-006", date: "2024-03-22",
    customerId: "C001", customerName: "Parle Products Pvt Ltd",
    salesPerson: "Rajesh Sharma", salesType: "Local", salesLedger: "Domestic Sales – Shrink Film",
    poNo: "PO-PARLE-2024-044", poDate: "2024-03-21", directDispatch: false,
    orderLines: [
      { id: "GL006-1", lineNo: 1, sourceType: "Catalog", estimationId: "", estimationNo: "", catalogId: "GPC001", catalogNo: "GRV-CAT-001", productCode: "PARLE-BISC-100G", productName: "Parle-G Biscuit 100g Wrap (Repeat)", categoryId: "CAT001", categoryName: "Roto - Label", substrate: "BOPP 20μ", jobWidth: 340, jobHeight: 450, noOfColors: 8, printType: "Surface Print", cylinderStatus: "Existing", cylinderCount: 8, filmType: "BOPP", laminationRequired: true, orderQty: 200000, unit: "Meter", rate: 1.36, currency: "INR", amount: 272000, deliveryDate: "2024-04-25", remarks: "Repeat order — existing cylinders" },
    ],
    totalAmount: 272000, advancePaid: 80000, remarks: "Repeat order from catalog",
    status: "Confirmed",
    sourceType: "Catalog", enquiryId: "", estimationId: "", catalogId: "GPC001", catalogNo: "GRV-CAT-001",
    jobName: "Parle-G Biscuit 100g Wrap (Repeat)", substrate: "BOPP 20μ", structure: "BOPP 20μ + Dry Lam + CPP 30μ",
    categoryId: "CAT001", categoryName: "Roto - Label", content: "BOPP Label",
    jobWidth: 340, jobHeight: 450, width: 340, noOfColors: 8, printType: "Surface Print",
    quantity: 200000, unit: "Meter", deliveryDate: "2024-04-25", cylinderSet: "CYL-P001",
    perMeterRate: 1.36, machineId: "M004", machineName: "Roto Press 1 – 8 Color",
    secondaryLayers: [{ id: "GO006-L1", layerNo: 1, plyType: "Film", itemSubGroup: "BOPP Film", density: 0.91, thickness: 20, gsm: 18.2, consumableItems: [] }, { id: "GO006-L2", layerNo: 2, plyType: "Printing", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [{ consumableId: "DEF_INK", fieldDisplayName: "Ink", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM007", itemName: "YELLOW INK SOLVENT BASED", gsm: 3.5, rate: 460 }, { consumableId: "DEF_SOL", fieldDisplayName: "Solvent", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", itemId: "ITM015", itemName: "ETHYL ACETATE (EA) GRADE", gsm: 2.0, rate: 65 }] }, { id: "GO006-L3", layerNo: 3, plyType: "Lamination", itemSubGroup: "LLDPE Grade", density: 0.92, thickness: 30, gsm: 27.6, consumableItems: [{ consumableId: "DEF_ADH", fieldDisplayName: "Adhesive", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive", itemId: "ITM019", itemName: "PU ADHESIVE 2K (PART A)", gsm: 3.5, rate: 330 }, { consumableId: "DEF_HRD", fieldDisplayName: "Hardener", itemGroup: "Hardner", itemSubGroup: "PU Hardener", itemId: "ITM022", itemName: "PU HARDENER (PART B)", gsm: 0.7, rate: 395 }] }],
    processes: [{ processId: "PR001", processName: "Cylinder Engraving", chargeUnit: "Cylinder", rate: 3500, qty: 8, setupCharge: 0, amount: 28000 }, { processId: "PR004", processName: "8-Color Roto Printing", chargeUnit: "m²", rate: 2.50, qty: 0, setupCharge: 1500, amount: 1500 }, { processId: "PR007", processName: "Dry Bond Lamination", chargeUnit: "m²", rate: 1.80, qty: 0, setupCharge: 0, amount: 0 }],
    overheadPct: 12, profitPct: 15,
  },
];

// ─── GRAVURE PRODUCT CATALOG ──────────────────────────────────
export const gravureProductCatalog: GravureProductCatalog[] = [
  { id: "GPC001", catalogNo: "GRV-CAT-001", createdDate: "2024-03-05", productName: "Parle-G Biscuit 100g Wrap", customerId: "C001", customerName: "Parle Products Pvt Ltd", categoryId: "CAT001", categoryName: "Roto - Label", content: "BOPP Label", jobWidth: 340, jobHeight: 450, actualWidth: 341, actualHeight: 451, noOfColors: 8, printType: "Surface Print", substrate: "BOPP 20μ", secondaryLayers: [{ id: "GPC001-L1", layerNo: 1, plyType: "Film", itemSubGroup: "BOPP Film", density: 0.91, thickness: 20, gsm: 18.2, consumableItems: [] }, { id: "GPC001-L2", layerNo: 2, plyType: "Printing", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [{ consumableId: "DEF_INK", fieldDisplayName: "Ink", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM007", itemName: "YELLOW INK SOLVENT BASED", gsm: 3.5, rate: 460 }, { consumableId: "DEF_SOL", fieldDisplayName: "Solvent", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", itemId: "ITM015", itemName: "ETHYL ACETATE (EA) GRADE", gsm: 2.0, rate: 65 }] }, { id: "GPC001-L3", layerNo: 3, plyType: "Lamination", itemSubGroup: "LLDPE Grade", density: 0.92, thickness: 30, gsm: 27.6, consumableItems: [{ consumableId: "DEF_ADH", fieldDisplayName: "Adhesive", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive", itemId: "ITM019", itemName: "PU ADHESIVE 2K (PART A)", gsm: 3.5, rate: 330 }, { consumableId: "DEF_HRD", fieldDisplayName: "Hardener", itemGroup: "Hardner", itemSubGroup: "PU Hardener", itemId: "ITM022", itemName: "PU HARDENER (PART B)", gsm: 0.7, rate: 395 }] }], processes: [{ processId: "PR001", processName: "Cylinder Engraving", chargeUnit: "Cylinder", rate: 3500, qty: 8, setupCharge: 0, amount: 28000 }, { processId: "PR004", processName: "8-Color Roto Printing", chargeUnit: "m²", rate: 2.50, qty: 0, setupCharge: 1500, amount: 1500 }, { processId: "PR007", processName: "Dry Bond Lamination", chargeUnit: "m²", rate: 1.80, qty: 0, setupCharge: 0, amount: 0 }], machineId: "M004", machineName: "Roto Press 1 – 8 Color", cylinderCostPerColor: 3500, overheadPct: 12, profitPct: 15, perMeterRate: 1.36, standardQty: 200000, standardUnit: "Meter", sourceEstimationId: "", sourceEstimationNo: "", sourceOrderId: "GO001", sourceOrderNo: "GRV-ORD-2024-001", sourceWorkOrderId: "GWO001", sourceWorkOrderNo: "GRV-WO-2024-001", status: "Active", remarks: "" },
  { id: "GPC002", catalogNo: "GRV-CAT-002", createdDate: "2024-03-08", productName: "Britannia NutriChoice 200g Pouch", customerId: "C002", customerName: "Britannia Industries Ltd", categoryId: "CAT002", categoryName: "Pouch", content: "3-Side Seal", jobWidth: 420, jobHeight: 400, actualWidth: 421, actualHeight: 401, noOfColors: 6, printType: "Reverse Print", substrate: "PET 12μ + PE 40μ", secondaryLayers: [{ id: "GPC002-L1", layerNo: 1, plyType: "Film", itemSubGroup: "BOPP Film", density: 0.91, thickness: 12, gsm: 10.9, consumableItems: [] }, { id: "GPC002-L2", layerNo: 2, plyType: "Printing", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [{ consumableId: "DEF_INK", fieldDisplayName: "Ink", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM008", itemName: "CYAN INK SOLVENT BASED", gsm: 3.5, rate: 490 }, { consumableId: "DEF_SOL", fieldDisplayName: "Solvent", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", itemId: "ITM015", itemName: "ETHYL ACETATE (EA) GRADE", gsm: 2.0, rate: 65 }] }, { id: "GPC002-L3", layerNo: 3, plyType: "Lamination", itemSubGroup: "LLDPE Grade", density: 0.92, thickness: 40, gsm: 36.8, consumableItems: [{ consumableId: "DEF_ADH", fieldDisplayName: "Adhesive", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive", itemId: "ITM019", itemName: "PU ADHESIVE 2K (PART A)", gsm: 3.5, rate: 330 }, { consumableId: "DEF_HRD", fieldDisplayName: "Hardener", itemGroup: "Hardner", itemSubGroup: "PU Hardener", itemId: "ITM022", itemName: "PU HARDENER (PART B)", gsm: 0.7, rate: 395 }] }], processes: [{ processId: "PR001", processName: "Cylinder Engraving", chargeUnit: "Cylinder", rate: 3500, qty: 6, setupCharge: 0, amount: 21000 }, { processId: "PR003", processName: "6-Color Roto Printing", chargeUnit: "m²", rate: 2.00, qty: 0, setupCharge: 1200, amount: 1200 }, { processId: "PR007", processName: "Dry Bond Lamination", chargeUnit: "m²", rate: 1.80, qty: 0, setupCharge: 0, amount: 0 }], machineId: "M003", machineName: "Roto Press 4 – 6 Color", cylinderCostPerColor: 3500, overheadPct: 12, profitPct: 15, perMeterRate: 1.52, standardQty: 150000, standardUnit: "Meter", sourceEstimationId: "", sourceEstimationNo: "", sourceOrderId: "GO002", sourceOrderNo: "GRV-ORD-2024-002", sourceWorkOrderId: "GWO002", sourceWorkOrderNo: "GRV-WO-2024-002", status: "Active", remarks: "" },
  { id: "GPC003", catalogNo: "GRV-CAT-003", createdDate: "2024-03-12", productName: "Amul Butter Shrink Sleeve", customerId: "C005", customerName: "Amul Dairy", categoryId: "CAT001", categoryName: "Roto - Label", content: "Shrink Sleeve", jobWidth: 260, jobHeight: 360, actualWidth: 261, actualHeight: 361, noOfColors: 6, printType: "Surface Print", substrate: "PVC 50μ", secondaryLayers: [{ id: "GPC003-L1", layerNo: 1, plyType: "Film", itemSubGroup: "BOPP Film", density: 0.91, thickness: 50, gsm: 45.5, consumableItems: [] }, { id: "GPC003-L2", layerNo: 2, plyType: "Printing", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [{ consumableId: "DEF_INK", fieldDisplayName: "Ink", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM009", itemName: "MAGENTA INK SOLVENT BASED", gsm: 3.5, rate: 500 }, { consumableId: "DEF_SOL", fieldDisplayName: "Solvent", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", itemId: "ITM015", itemName: "ETHYL ACETATE (EA) GRADE", gsm: 2.0, rate: 65 }] }], processes: [{ processId: "PR001", processName: "Cylinder Engraving", chargeUnit: "Cylinder", rate: 3500, qty: 6, setupCharge: 0, amount: 21000 }, { processId: "PR003", processName: "6-Color Roto Printing", chargeUnit: "m²", rate: 2.00, qty: 0, setupCharge: 1200, amount: 1200 }], machineId: "M003", machineName: "Roto Press 4 – 6 Color", cylinderCostPerColor: 3500, overheadPct: 12, profitPct: 15, perMeterRate: 0.90, standardQty: 500000, standardUnit: "Meter", sourceEstimationId: "", sourceEstimationNo: "", sourceOrderId: "GO004", sourceOrderNo: "GRV-ORD-2024-004", sourceWorkOrderId: "", sourceWorkOrderNo: "", status: "Active", remarks: "" },
];

// ─── GRAVURE WORK ORDERS ──────────────────────────────────────
export const gravureWorkOrders: GravureWorkOrder[] = [
  { id: "GWO001", workOrderNo: "GRV-WO-2024-001", date: "2024-03-07", sourceOrderType: "Estimation", orderId: "GO001", orderNo: "GRV-ORD-2024-001", customerId: "C001", customerName: "Parle Products Pvt Ltd", jobName: "Parle-G Biscuit 100g Wrap", substrate: "BOPP 20μ", structure: "BOPP 20μ + Dry Lam + CPP 30μ", categoryId: "CAT001", categoryName: "Roto - Label", content: "BOPP Label", jobWidth: 340, jobHeight: 450, actualWidth: 341, actualHeight: 451, width: 340, noOfColors: 8, printType: "Surface Print", machineId: "M004", machineName: "Roto Press 1 – 8 Color", operatorId: "E004", operatorName: "Amit Tiwari", cylinderSet: "CYL-P001", inks: ["Cyan", "Magenta", "Yellow", "Black", "White", "Red", "Gold", "Silver"], quantity: 200000, unit: "Meter", plannedDate: "2024-03-18", processes: [{ processId: "PR001", processName: "Cylinder Engraving", chargeUnit: "Cylinder", rate: 3500, qty: 8, setupCharge: 0, amount: 28000 }, { processId: "PR004", processName: "8-Color Roto Printing", chargeUnit: "m²", rate: 2.50, qty: 0, setupCharge: 1500, amount: 1500 }, { processId: "PR007", processName: "Dry Bond Lamination", chargeUnit: "m²", rate: 1.80, qty: 0, setupCharge: 0, amount: 0 }], secondaryLayers: [{ id: "GWO001-L1", layerNo: 1, plyType: "Film", itemSubGroup: "BOPP Film", density: 0.91, thickness: 20, gsm: 18.2, consumableItems: [] }, { id: "GWO001-L2", layerNo: 2, plyType: "Printing", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [{ consumableId: "DEF_INK", fieldDisplayName: "Ink", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM007", itemName: "YELLOW INK SOLVENT BASED", gsm: 3.5, rate: 460 }, { consumableId: "DEF_SOL", fieldDisplayName: "Solvent", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", itemId: "ITM015", itemName: "ETHYL ACETATE (EA) GRADE", gsm: 2.0, rate: 65 }] }, { id: "GWO001-L3", layerNo: 3, plyType: "Lamination", itemSubGroup: "LLDPE Grade", density: 0.92, thickness: 30, gsm: 27.6, consumableItems: [{ consumableId: "DEF_ADH", fieldDisplayName: "Adhesive", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive", itemId: "ITM019", itemName: "PU ADHESIVE 2K (PART A)", gsm: 3.5, rate: 330 }, { consumableId: "DEF_HRD", fieldDisplayName: "Hardener", itemGroup: "Hardner", itemSubGroup: "PU Hardener", itemId: "ITM022", itemName: "PU HARDENER (PART B)", gsm: 0.7, rate: 395 }] }], cylinderCostPerColor: 3500, selectedPlanId: "", ups: 0, overheadPct: 12, profitPct: 15, perMeterRate: 1.36, totalAmount: 272000, specialInstructions: "Pantone matching mandatory. Approved sample attached.", status: "In Progress" },
  { id: "GWO002", workOrderNo: "GRV-WO-2024-002", date: "2024-03-11", sourceOrderType: "Estimation", orderId: "GO002", orderNo: "GRV-ORD-2024-002", customerId: "C002", customerName: "Britannia Industries Ltd", jobName: "Britannia NutriChoice 200g", substrate: "PET 12μ", structure: "PET 12μ + Dry Lam + PE 40μ", categoryId: "CAT002", categoryName: "Pouch", content: "3-Side Seal", jobWidth: 420, jobHeight: 400, actualWidth: 421, actualHeight: 401, width: 420, noOfColors: 6, printType: "Reverse Print", machineId: "M003", machineName: "Roto Press 4 – 6 Color", operatorId: "E005", operatorName: "Deepak Verma", cylinderSet: "CYL-B001", inks: ["Cyan", "Magenta", "Yellow", "Black", "White", "Gold"], quantity: 150000, unit: "Meter", plannedDate: "2024-03-25", processes: [{ processId: "PR001", processName: "Cylinder Engraving", chargeUnit: "Cylinder", rate: 3500, qty: 6, setupCharge: 0, amount: 21000 }, { processId: "PR003", processName: "6-Color Roto Printing", chargeUnit: "m²", rate: 2.00, qty: 0, setupCharge: 1200, amount: 1200 }, { processId: "PR007", processName: "Dry Bond Lamination", chargeUnit: "m²", rate: 1.80, qty: 0, setupCharge: 0, amount: 0 }], secondaryLayers: [{ id: "GWO002-L1", layerNo: 1, plyType: "Film", itemSubGroup: "BOPP Film", density: 0.91, thickness: 12, gsm: 10.9, consumableItems: [] }, { id: "GWO002-L2", layerNo: 2, plyType: "Printing", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [{ consumableId: "DEF_INK", fieldDisplayName: "Ink", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM008", itemName: "CYAN INK SOLVENT BASED", gsm: 3.5, rate: 490 }, { consumableId: "DEF_SOL", fieldDisplayName: "Solvent", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", itemId: "ITM015", itemName: "ETHYL ACETATE (EA) GRADE", gsm: 2.0, rate: 65 }] }, { id: "GWO002-L3", layerNo: 3, plyType: "Lamination", itemSubGroup: "LLDPE Grade", density: 0.92, thickness: 40, gsm: 36.8, consumableItems: [{ consumableId: "DEF_ADH", fieldDisplayName: "Adhesive", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive", itemId: "ITM019", itemName: "PU ADHESIVE 2K (PART A)", gsm: 3.5, rate: 330 }, { consumableId: "DEF_HRD", fieldDisplayName: "Hardener", itemGroup: "Hardner", itemSubGroup: "PU Hardener", itemId: "ITM022", itemName: "PU HARDENER (PART B)", gsm: 0.7, rate: 395 }] }], cylinderCostPerColor: 3500, selectedPlanId: "", ups: 0, overheadPct: 12, profitPct: 15, perMeterRate: 1.52, totalAmount: 228000, specialInstructions: "Matte OPV coating required after printing.", status: "Open" },
  { id: "GWO003", workOrderNo: "GRV-WO-2024-003", date: "2024-03-15", sourceOrderType: "Estimation", orderId: "GO003", orderNo: "GRV-ORD-2024-003", customerId: "C006", customerName: "Nestle India Ltd", jobName: "Maggi Noodles 70g Outer Wrap", substrate: "BOPP 20μ", structure: "BOPP 20μ + PE 30μ", categoryId: "", categoryName: "", content: "", jobWidth: 300, jobHeight: 0, actualWidth: 301, actualHeight: 1, width: 300, noOfColors: 8, printType: "Reverse Print", machineId: "M005", machineName: "Roto Press 2 – 9 Color", operatorId: "E006", operatorName: "Santosh Rao", cylinderSet: "", inks: ["Cyan", "Magenta", "Yellow", "Black", "White", "Red", "Green", "Orange"], quantity: 250000, unit: "Meter", plannedDate: "2024-03-30", processes: [{ processId: "PR001", processName: "Cylinder Engraving", chargeUnit: "Cylinder", rate: 3500, qty: 8, setupCharge: 0, amount: 28000 }, { processId: "PR004", processName: "8-Color Roto Printing", chargeUnit: "m²", rate: 2.50, qty: 0, setupCharge: 1500, amount: 1500 }, { processId: "PR007", processName: "Dry Bond Lamination", chargeUnit: "m²", rate: 1.80, qty: 0, setupCharge: 0, amount: 0 }], secondaryLayers: [{ id: "GWO003-L1", layerNo: 1, plyType: "Film", itemSubGroup: "BOPP Film", density: 0.91, thickness: 20, gsm: 18.2, consumableItems: [] }, { id: "GWO003-L2", layerNo: 2, plyType: "Printing", itemSubGroup: "", density: 0, thickness: 0, gsm: 0, consumableItems: [{ consumableId: "DEF_INK", fieldDisplayName: "Ink", itemGroup: "Ink", itemSubGroup: "Solvent Based Ink", itemId: "ITM010", itemName: "BLACK INK SOLVENT BASED", gsm: 3.5, rate: 430 }, { consumableId: "DEF_SOL", fieldDisplayName: "Solvent", itemGroup: "Solvent", itemSubGroup: "Ethyl Acetate (EA)", itemId: "ITM015", itemName: "ETHYL ACETATE (EA) GRADE", gsm: 2.0, rate: 65 }] }, { id: "GWO003-L3", layerNo: 3, plyType: "Lamination", itemSubGroup: "LLDPE Grade", density: 0.92, thickness: 30, gsm: 27.6, consumableItems: [{ consumableId: "DEF_ADH", fieldDisplayName: "Adhesive", itemGroup: "Adhesive", itemSubGroup: "PU Adhesive", itemId: "ITM019", itemName: "PU ADHESIVE 2K (PART A)", gsm: 3.5, rate: 330 }, { consumableId: "DEF_HRD", fieldDisplayName: "Hardener", itemGroup: "Hardner", itemSubGroup: "PU Hardener", itemId: "ITM022", itemName: "PU HARDENER (PART B)", gsm: 0.7, rate: 395 }] }], cylinderCostPerColor: 3500, selectedPlanId: "", ups: 0, overheadPct: 12, profitPct: 15, perMeterRate: 1.40, totalAmount: 350000, specialInstructions: "Cylinders to be sourced. Proofing required before production.", status: "On Hold" },
];

// ─── GRAVURE ITEM ISSUES ──────────────────────────────────────
export const gravureItemIssues: GravureItemIssue[] = [
  {
    id: "GII001", issueNo: "GRV-ISS-2024-001", date: "2024-03-08",
    workOrderId: "GWO001", workOrderNo: "GRV-WO-2024-001",
    customerName: "Parle Products Pvt Ltd", jobName: "Parle-G Biscuit 100g Wrap",
    items: [
      { itemId: "SUB001", itemName: "BOPP 20μ Plain (Treated)", itemType: "Substrate", requiredQty: 1250, issuedQty: 1250, unit: "Kg" },
      { itemId: "INK001", itemName: "Cyan Gravure Ink (PU)", itemType: "Ink", requiredQty: 45, issuedQty: 45, unit: "Kg" },
      { itemId: "INK002", itemName: "Magenta Gravure Ink (PU)", itemType: "Ink", requiredQty: 38, issuedQty: 38, unit: "Kg" },
      { itemId: "INK003", itemName: "Yellow Gravure Ink (PU)", itemType: "Ink", requiredQty: 35, issuedQty: 35, unit: "Kg" },
      { itemId: "INK004", itemName: "Black Gravure Ink (PU)", itemType: "Ink", requiredQty: 28, issuedQty: 20, unit: "Kg" },
      { itemId: "SOL001", itemName: "Ethyl Acetate (EA)", itemType: "Solvent", requiredQty: 150, issuedQty: 150, unit: "Ltr" },
    ],
    issuedBy: "Amit Tiwari", status: "Partial",
  },
  {
    id: "GII002", issueNo: "GRV-ISS-2024-002", date: "2024-03-11",
    workOrderId: "GWO002", workOrderNo: "GRV-WO-2024-002",
    customerName: "Britannia Industries Ltd", jobName: "Britannia NutriChoice 200g",
    items: [
      { itemId: "SUB002", itemName: "PET 12μ (Corona Treated)", itemType: "Substrate", requiredQty: 900, issuedQty: 900, unit: "Kg" },
      { itemId: "INK001", itemName: "Cyan Gravure Ink (PU)", itemType: "Ink", requiredQty: 32, issuedQty: 32, unit: "Kg" },
      { itemId: "INK002", itemName: "Magenta Gravure Ink (PU)", itemType: "Ink", requiredQty: 28, issuedQty: 28, unit: "Kg" },
      { itemId: "SOL001", itemName: "Ethyl Acetate (EA)", itemType: "Solvent", requiredQty: 120, issuedQty: 0, unit: "Ltr" },
      { itemId: "ADH001", itemName: "PU Adhesive (Part A)", itemType: "Adhesive", requiredQty: 85, issuedQty: 0, unit: "Kg" },
    ],
    issuedBy: "Deepak Verma", status: "Pending",
  },
];

// ─── GRAVURE PRODUCTION ENTRIES ───────────────────────────────
export const gravureProductionEntries: GravureProductionEntry[] = [
  {
    id: "GPE001", entryNo: "GRV-PROD-2024-001", date: "2024-03-09",
    workOrderId: "GWO001", workOrderNo: "GRV-WO-2024-001",
    customerId: "C001", customerName: "Parle Products Pvt Ltd", jobName: "Parle-G Biscuit 100g Wrap",
    machineId: "M004", machineName: "Roto Press 1 – 8 Color", shift: "A",
    operatorName: "Amit Tiwari", supervisorName: "Rajesh Kumar",
    machineStatus: "Stopped", startTime: "07:00", pauseTime: "", resumeTime: "", stopTime: "14:30",
    pauseReason: "", totalRunTime: 450, downtime: 0,
    producedQty: 45000, goodQty: 43200, rejectedQty: 0, wastageQty: 1800, netQty: 43200,
    efficiencyPct: 90.0, wastagePct: 4.0, speed: 120, machineRuntime: 7.5, machineUtilPct: 93.8,
    totalMeterRun: 45000, wasteMeter: 1800, netMeter: 43200,
    noOfColors: 8, cylinderCode: "CYL-P001", impressionCount: 45000,
    inkConsumption: 28, rollNo: "GRV-ROLL-001", substrate: "BOPP 20μ", printQuality: "Good",
    status: "Completed", remarks: "Color registration OK. Pantone match approved.",
    materialLines: [
      { itemId: "SUB001", itemName: "BOPP 20μ Plain (Treated)", itemType: "Film",    plannedQty: 1250, actualQty: 1230, unit: "Kg",  variance: -20 },
      { itemId: "INK001", itemName: "Cyan Gravure Ink (PU)",    itemType: "Ink",     plannedQty: 45,   actualQty: 28,   unit: "Kg",  variance: -17 },
      { itemId: "SOL001", itemName: "Ethyl Acetate (EA)",        itemType: "Solvent", plannedQty: 150,  actualQty: 145,  unit: "Ltr", variance: -5  },
    ],
    processEntries: [
      { id: "P1", processName: "Printing", startTime: "07:00", endTime: "14:30", outputQty: 45000, wastageQty: 1800, remarks: "All 8 colors registered OK" },
    ],
  },
  {
    id: "GPE002", entryNo: "GRV-PROD-2024-002", date: "2024-03-10",
    workOrderId: "GWO001", workOrderNo: "GRV-WO-2024-001",
    customerId: "C001", customerName: "Parle Products Pvt Ltd", jobName: "Parle-G Biscuit 100g Wrap",
    machineId: "M004", machineName: "Roto Press 1 – 8 Color", shift: "A",
    operatorName: "Amit Tiwari", supervisorName: "Rajesh Kumar",
    machineStatus: "Stopped", startTime: "07:00", pauseTime: "", resumeTime: "", stopTime: "15:00",
    pauseReason: "", totalRunTime: 480, downtime: 0,
    producedQty: 48000, goodQty: 46560, rejectedQty: 0, wastageQty: 1440, netQty: 46560,
    efficiencyPct: 92.3, wastagePct: 3.0, speed: 130, machineRuntime: 8, machineUtilPct: 96.2,
    totalMeterRun: 48000, wasteMeter: 1440, netMeter: 46560,
    noOfColors: 8, cylinderCode: "CYL-P001", impressionCount: 48000,
    inkConsumption: 30, rollNo: "GRV-ROLL-002", substrate: "BOPP 20μ", printQuality: "Good",
    status: "Completed", remarks: "",
    materialLines: [
      { itemId: "SUB001", itemName: "BOPP 20μ Plain (Treated)", itemType: "Film",    plannedQty: 1300, actualQty: 1280, unit: "Kg",  variance: -20 },
      { itemId: "INK001", itemName: "Gravure Ink (Mixed)",       itemType: "Ink",     plannedQty: 50,   actualQty: 30,   unit: "Kg",  variance: -20 },
      { itemId: "SOL001", itemName: "Ethyl Acetate (EA)",        itemType: "Solvent", plannedQty: 160,  actualQty: 155,  unit: "Ltr", variance: -5  },
    ],
    processEntries: [
      { id: "P1", processName: "Printing", startTime: "07:00", endTime: "15:00", outputQty: 48000, wastageQty: 1440, remarks: "" },
    ],
  },
  {
    id: "GPE003", entryNo: "GRV-PROD-2024-003", date: "2024-03-11",
    workOrderId: "GWO001", workOrderNo: "GRV-WO-2024-001",
    customerId: "C001", customerName: "Parle Products Pvt Ltd", jobName: "Parle-G Biscuit 100g Wrap",
    machineId: "M004", machineName: "Roto Press 1 – 8 Color", shift: "B",
    operatorName: "Deepak Verma", supervisorName: "Rajesh Kumar",
    machineStatus: "Stopped", startTime: "15:00", pauseTime: "17:30", resumeTime: "17:55", stopTime: "23:00",
    pauseReason: "Ink Issue", totalRunTime: 455, downtime: 25,
    producedQty: 42000, goodQty: 39900, rejectedQty: 0, wastageQty: 2100, netQty: 39900,
    efficiencyPct: 83.5, wastagePct: 5.0, speed: 110, machineRuntime: 8, machineUtilPct: 87.0,
    totalMeterRun: 42000, wasteMeter: 2100, netMeter: 39900,
    noOfColors: 8, cylinderCode: "CYL-P001", impressionCount: 42000,
    inkConsumption: 26, rollNo: "GRV-ROLL-003", substrate: "BOPP 20μ", printQuality: "Rework",
    status: "Completed", remarks: "Yellow shade off. Ink viscosity corrected after 5000m.",
    materialLines: [
      { itemId: "SUB001", itemName: "BOPP 20μ Plain (Treated)", itemType: "Film",    plannedQty: 1200, actualQty: 1195, unit: "Kg",  variance: -5  },
      { itemId: "INK003", itemName: "Yellow Gravure Ink (PU)",  itemType: "Ink",     plannedQty: 35,   actualQty: 38,   unit: "Kg",  variance: 3   },
      { itemId: "SOL001", itemName: "Ethyl Acetate (EA)",        itemType: "Solvent", plannedQty: 140,  actualQty: 142,  unit: "Ltr", variance: 2   },
    ],
    processEntries: [
      { id: "P1", processName: "Printing", startTime: "15:00", endTime: "23:00", outputQty: 42000, wastageQty: 2100, remarks: "Ink pause at 17:30. Viscosity corrected." },
    ],
  },
  {
    id: "GPE004", entryNo: "GRV-PROD-2024-004", date: "2024-03-12",
    workOrderId: "GWO001", workOrderNo: "GRV-WO-2024-001",
    customerId: "C001", customerName: "Parle Products Pvt Ltd", jobName: "Parle-G Biscuit 100g Wrap",
    machineId: "M004", machineName: "Roto Press 1 – 8 Color", shift: "A",
    operatorName: "Amit Tiwari", supervisorName: "Rajesh Kumar",
    machineStatus: "Stopped", startTime: "07:00", pauseTime: "", resumeTime: "", stopTime: "15:00",
    pauseReason: "", totalRunTime: 480, downtime: 0,
    producedQty: 52000, goodQty: 50440, rejectedQty: 0, wastageQty: 1560, netQty: 50440,
    efficiencyPct: 94.5, wastagePct: 3.0, speed: 135, machineRuntime: 8, machineUtilPct: 97.2,
    totalMeterRun: 52000, wasteMeter: 1560, netMeter: 50440,
    noOfColors: 8, cylinderCode: "CYL-P001", impressionCount: 52000,
    inkConsumption: 32, rollNo: "GRV-ROLL-004", substrate: "BOPP 20μ", printQuality: "Good",
    status: "Completed", remarks: "",
    materialLines: [
      { itemId: "SUB001", itemName: "BOPP 20μ Plain (Treated)", itemType: "Film",    plannedQty: 1350, actualQty: 1340, unit: "Kg",  variance: -10 },
      { itemId: "INK001", itemName: "Gravure Ink (Mixed)",       itemType: "Ink",     plannedQty: 55,   actualQty: 32,   unit: "Kg",  variance: -23 },
      { itemId: "SOL001", itemName: "Ethyl Acetate (EA)",        itemType: "Solvent", plannedQty: 170,  actualQty: 165,  unit: "Ltr", variance: -5  },
    ],
    processEntries: [
      { id: "P1", processName: "Printing", startTime: "07:00", endTime: "15:00", outputQty: 52000, wastageQty: 1560, remarks: "Best run of the batch. Speed increased." },
    ],
  },
];

// ─── EXTRUSION ENQUIRIES ─────────────────────────────────────
export const extrusionEnquiries: ExtrusionEnquiry[] = [
  {
    id: "EXEQ001",
    enquiryNo: "EX-EQ-001/03/2024",
    date: "2024-03-08",
    customerId: "C001", customerName: "Parle Products Pvt Ltd",
    productName: "LLDPE Shrink Film 40μ", application: "Food Packaging",
    recipeId: "RCP001", recipeName: "3-Layer PE Shrink",
    rollMasterId: "RL001", rollName: "PE Shrink Roll 400mm", rollWidth: 400,
    totalMicron: 40, layerMicrons: [15, 10, 15],
    layerResults: [
      { layerNo: 1, layerName: "Skin A (LLDPE)", micron: 15, density: 0.92, gsm: 13.8, consumptionPerSqM: 0.0138, blendRate: 95, costPerSqM: 1.311 },
      { layerNo: 2, layerName: "Core (LDPE/EVA)", micron: 10, density: 0.93, gsm: 9.3, consumptionPerSqM: 0.0093, blendRate: 90, costPerSqM: 0.837 },
      { layerNo: 3, layerName: "Skin B (LLDPE)", micron: 15, density: 0.92, gsm: 13.8, consumptionPerSqM: 0.0138, blendRate: 95, costPerSqM: 1.311 },
    ],
    totalGSM: 36.9, machineCostPerSqM: 0.8, overheadCostPerSqM: 0.4,
    totalCostPerSqM: 4.659, totalCostPerKg: 126.26,
    sellingPricePerKg: 145, marginPct: 12.92,
    orderQty: 5000, unit: "Kg", deliveryDate: "2024-03-28",
    requiredMaterials: [
      { materialName: "LLDPE C6 Butene Grade", quantityKg: 138, ratePerKg: 95, totalCost: 13110 },
      { materialName: "LDPE Film Grade", quantityKg: 46.5, ratePerKg: 88, totalCost: 4092 },
    ],
    remarks: "Standard food grade. Urgent.", status: "Converted",
  },
  {
    id: "EXEQ002",
    enquiryNo: "EX-EQ-002/03/2024",
    date: "2024-03-12",
    customerId: "C002", customerName: "Britannia Industries Ltd",
    productName: "BOPP Lamination Film 20μ", application: "Biscuit Packaging",
    recipeId: "RCP001", recipeName: "3-Layer PE Shrink",
    rollMasterId: "RL002", rollName: "BOPP Lamination Roll 300mm", rollWidth: 300,
    totalMicron: 20, layerMicrons: [7, 6, 7],
    layerResults: [
      { layerNo: 1, layerName: "Skin A (LLDPE)", micron: 7, density: 0.92, gsm: 6.44, consumptionPerSqM: 0.00644, blendRate: 95, costPerSqM: 0.6118 },
      { layerNo: 2, layerName: "Core (LDPE/EVA)", micron: 6, density: 0.93, gsm: 5.58, consumptionPerSqM: 0.00558, blendRate: 90, costPerSqM: 0.5022 },
      { layerNo: 3, layerName: "Skin B (LLDPE)", micron: 7, density: 0.92, gsm: 6.44, consumptionPerSqM: 0.00644, blendRate: 95, costPerSqM: 0.6118 },
    ],
    totalGSM: 18.46, machineCostPerSqM: 0.8, overheadCostPerSqM: 0.4,
    totalCostPerSqM: 2.9258, totalCostPerKg: 158.49,
    sellingPricePerKg: 175, marginPct: 9.43,
    orderQty: 3000, unit: "Kg", deliveryDate: "2024-04-05",
    requiredMaterials: [
      { materialName: "LLDPE C6 Butene Grade", quantityKg: 38.64, ratePerKg: 95, totalCost: 3670.8 },
      { materialName: "LDPE Film Grade", quantityKg: 16.74, ratePerKg: 88, totalCost: 1473.12 },
    ],
    remarks: "Margin below target — review pricing.", status: "Estimated",
  },
  {
    id: "EXEQ003",
    enquiryNo: "EX-EQ-003/03/2024",
    date: "2024-03-15",
    customerId: "C003", customerName: "Haldiram Snacks Pvt Ltd",
    productName: "5-Layer Barrier Film 80μ", application: "Snack Packaging",
    recipeId: "RCP003", recipeName: "5-Layer Barrier Film",
    rollMasterId: "RL006", rollName: "5-Layer Barrier Roll 400mm", rollWidth: 400,
    totalMicron: 80, layerMicrons: [15, 10, 30, 10, 15],
    layerResults: [],
    totalGSM: 74, machineCostPerSqM: 0.8, overheadCostPerSqM: 0.4,
    totalCostPerSqM: 9.2, totalCostPerKg: 124.32,
    sellingPricePerKg: 148, marginPct: 16.0,
    orderQty: 8000, unit: "Kg", deliveryDate: "2024-04-15",
    requiredMaterials: [],
    remarks: "High-barrier required. EVOH layer critical.", status: "Pending",
  },
];

// ─── GRAVURE DISPATCHES ───────────────────────────────────────
export const gravureDispatches: GravureDispatch[] = [
  { id: "GD001", dispatchNo: "GRV-DSP-2024-001", date: "2024-03-25", orderId: "GO001", orderNo: "GRV-ORD-2024-001", customerId: "C001", customerName: "Parle Products Pvt Ltd", jobName: "Parle-G Biscuit 100g Wrap", quantity: 200000, unit: "Meter", noOfRolls: 8, vehicleNo: "MH-01-AB-1234", driverName: "Ram Lal", lrNo: "LR-2024-0312", status: "Delivered" },
  { id: "GD002", dispatchNo: "GRV-DSP-2024-002", date: "2024-03-29", orderId: "GO004", orderNo: "GRV-ORD-2024-004", customerId: "C005", customerName: "Amul Dairy", jobName: "Amul Butter Shrink Sleeve", quantity: 500000, unit: "Meter", noOfRolls: 12, vehicleNo: "RJ-14-CD-5678", driverName: "Shyam Lal", lrNo: "LR-2024-0329", status: "In Transit" },
];
