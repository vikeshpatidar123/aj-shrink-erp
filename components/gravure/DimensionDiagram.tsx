"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DimField = "width" | "height" | "gusset" | "layflatWidth" | "cutHeight" | "sealWidth" | "seamingArea" | "transparentArea" | "topSeal" | "bottomSeal" | "sideSeal" | "centerSealWidth" | "sideGusset";
export type DimValues = Partial<Record<DimField, number>> & { trimming?: number; widthShrinkage?: number };

export type ContentTypeDef = {
  fields: DimField[];
  labels: Partial<Record<DimField, string>>;
  diagramType: "standup" | "threeside" | "centerseal" | "rollform" | "label" | "shrinksleeve" | "sleeve" | "laminateroll" | "bothsidegusset" | "flatbottom";
};

// ─── Config ───────────────────────────────────────────────────────────────────

export const CONTENT_TYPE_CONFIG: Record<string, ContentTypeDef> = {
  "Pouch — 3 Side Seal":  { fields: ["width", "height", "topSeal", "bottomSeal", "sideSeal"],            labels: { width: "Pouch Width (mm)", height: "Pouch Height (mm)", topSeal: "Top Seal (mm)", bottomSeal: "Bottom Seal (mm)", sideSeal: "Side Seal (mm)" },                                 diagramType: "threeside"      },
  "Pouch — Center Seal":  { fields: ["width", "height", "topSeal", "bottomSeal", "centerSealWidth"],     labels: { width: "Panel Width / Face Width (mm)",  height: "Pouch Height (mm)", topSeal: "Top Seal (mm)", bottomSeal: "Bottom Seal (mm)", centerSealWidth: "Center Seal (mm)" },                          diagramType: "centerseal"     },
  "Standup Pouch":        { fields: ["width", "height", "topSeal", "sideSeal", "gusset"],               labels: { width: "Pouch Width (mm)", height: "Pouch Height (mm)", topSeal: "Top Seal (mm)", sideSeal: "Side Seal (mm)", gusset: "Bottom Gusset (mm)" },                                     diagramType: "standup"        },
  "Zipper Pouch":         { fields: ["width", "height", "topSeal", "sideSeal", "gusset"],               labels: { width: "Pouch Width (mm)", height: "Pouch Height (mm)", topSeal: "Top Seal (mm)", sideSeal: "Side Seal (mm)", gusset: "Bottom Gusset (mm)" },                                     diagramType: "standup"        },
  "Both Side Gusset Pouch": { fields: ["width", "height", "topSeal", "bottomSeal", "sideGusset"],       labels: { width: "Pouch Width (mm)", height: "Pouch Height (mm)", topSeal: "Top Seal (mm)", bottomSeal: "Bottom Seal (mm)", sideGusset: "Side Gusset (mm)" },                               diagramType: "bothsidegusset" },
  "3D Pouch / Flat Bottom": { fields: ["width", "height", "topSeal", "sideGusset", "gusset"],           labels: { width: "Pouch Width (mm)", height: "Pouch Height (mm)", topSeal: "Top Seal (mm)", sideGusset: "Side Gusset (mm)", gusset: "Bottom Gusset (mm)" },                                 diagramType: "flatbottom"     },
  "Roll Form — Milk":     { fields: ["width", "height", "sealWidth"], labels: { width: "Film Width (mm)", height: "Repeat Length (mm)", sealWidth: "Seal Width (mm)" },      diagramType: "rollform"     },
  "Roll Form — Oil":      { fields: ["width", "height", "sealWidth"], labels: { width: "Film Width (mm)", height: "Repeat Length (mm)", sealWidth: "Seal Width (mm)" },      diagramType: "rollform"     },
  "Roll Form — Snacks":   { fields: ["width", "height", "sealWidth"], labels: { width: "Film Width (mm)", height: "Repeat Length (mm)", sealWidth: "Seal Width (mm)" },      diagramType: "rollform"     },
  "PET + PE":             { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "BOPP + CPP":           { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "PET + MET PET + PE":   { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "BOPP + BOPP":          { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "PET + AL Foil + PE":   { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "BOPP + MET BOPP":      { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "Shrink Labels":        { fields: ["layflatWidth", "cutHeight"], labels: { layflatWidth: "Layflat Width (mm)", cutHeight: "Cut Repeat Length (mm)" },                        diagramType: "shrinksleeve" },
  "Wrap Around Labels":   { fields: ["width", "height"],           labels: { width: "Label Width (mm)", height: "Repeat Length (mm)" },                                      diagramType: "label"        },
  "Cut & Stack Labels":   { fields: ["width", "height"],           labels: { width: "Label Width (mm)", height: "Repeat Length (mm)" },                                      diagramType: "label"        },
  "In-Mould Labels":      { fields: ["width", "height"],           labels: { width: "Label Width (mm)", height: "Repeat Length (mm)" },                                      diagramType: "label"        },
  "Sleeve — Shrink":  { fields: ["layflatWidth", "cutHeight", "seamingArea", "transparentArea"], labels: { layflatWidth: "Layflat Width (mm)", cutHeight: "Cutting Length (mm)", seamingArea: "Seaming Area (mm)", transparentArea: "Transparent Area (mm)" }, diagramType: "sleeve" },
  "Sleeve — Stretch": { fields: ["layflatWidth", "cutHeight", "seamingArea", "transparentArea"], labels: { layflatWidth: "Layflat Width (mm)", cutHeight: "Cutting Length (mm)", seamingArea: "Seaming Area (mm)", transparentArea: "Transparent Area (mm)" }, diagramType: "sleeve" },
  "Laminate Roll":        { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "laminateroll" },
  "Fertilizer Bags":      { fields: ["width", "height", "gusset"], labels: { width: "Bag Width (mm)",   height: "Bag Repeat Length (mm)", gusset: "Gusset (mm)" },                  diagramType: "threeside"    },
  "Cement Liner":         { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  "Chemical Packaging":   { fields: ["width", "height", "gusset"], labels: { width: "Bag Width (mm)",   height: "Bag Repeat Length (mm)", gusset: "Gusset (mm)" },                  diagramType: "threeside"    },
  "FIBC / Jumbo Bags":    { fields: ["width", "height"],           labels: { width: "Bag Width (mm)",   height: "Bag Repeat Length (mm)" },                                          diagramType: "threeside"    },
  "Woven Sack Liner":     { fields: ["width", "height"],           labels: { width: "Film Width (mm)",  height: "Repeat Length (mm)" },                                       diagramType: "rollform"     },
  // ── Explicit entries for new ContentMaster names (exact match — used by getDisplayContentType) ──
  "Stand Up Pouch - No Zipper":      { fields: ["width","height","topSeal","sideSeal","gusset"],       labels: { width:"Pouch Width (mm)",  height:"Pouch Height (mm)",  topSeal:"Top Seal (mm)",    sideSeal:"Side Seal (mm)",    gusset:"Bottom Gusset (mm)"   }, diagramType:"standup"        },
  "Stand Up Pouch - With Zipper":    { fields: ["width","height","topSeal","sideSeal","gusset"],       labels: { width:"Pouch Width (mm)",  height:"Pouch Height (mm)",  topSeal:"Top Seal (mm)",    sideSeal:"Side Seal (mm)",    gusset:"Bottom Gusset (mm)"   }, diagramType:"standup"        },
  "Stand Up Pouch - With Spout":     { fields: ["width","height","topSeal","sideSeal","gusset"],       labels: { width:"Pouch Width (mm)",  height:"Pouch Height (mm)",  topSeal:"Top Seal (mm)",    sideSeal:"Side Seal (mm)",    gusset:"Bottom Gusset (mm)"   }, diagramType:"standup"        },
  "Flat Bottom Pouch - Standard":    { fields: ["width","height","topSeal","sideGusset","gusset"],     labels: { width:"Pouch Width (mm)",  height:"Pouch Height (mm)",  topSeal:"Top Seal (mm)",    sideGusset:"Side Gusset (mm)", gusset:"Bottom Panel (mm)"   }, diagramType:"flatbottom"     },
  "Flat Bottom Pouch - With Zipper": { fields: ["width","height","topSeal","sideGusset","gusset"],     labels: { width:"Pouch Width (mm)",  height:"Pouch Height (mm)",  topSeal:"Top Seal (mm)",    sideGusset:"Side Gusset (mm)", gusset:"Bottom Panel (mm)"   }, diagramType:"flatbottom"     },
  "Flat Bottom Pouch - With Valve":  { fields: ["width","height","topSeal","sideGusset","gusset"],     labels: { width:"Pouch Width (mm)",  height:"Pouch Height (mm)",  topSeal:"Top Seal (mm)",    sideGusset:"Side Gusset (mm)", gusset:"Bottom Panel (mm)"   }, diagramType:"flatbottom"     },
  "3-Side Seal Sachet - Standard":   { fields: ["width","height","topSeal","bottomSeal","sideSeal"],   labels: { width:"Sachet Width (mm)", height:"Sachet Height (mm)", topSeal:"Top Seal (mm)",    bottomSeal:"Bottom Seal (mm)", sideSeal:"Side Seal (mm)"    }, diagramType:"threeside"      },
  "3-Side Seal Sachet - Tear Notch": { fields: ["width","height","topSeal","bottomSeal","sideSeal"],   labels: { width:"Sachet Width (mm)", height:"Sachet Height (mm)", topSeal:"Top Seal (mm)",    bottomSeal:"Bottom Seal (mm)", sideSeal:"Side Seal (mm)"    }, diagramType:"threeside"      },
  "Gusset Bag - Side Gusset":        { fields: ["width","height","topSeal","bottomSeal","sideGusset"], labels: { width:"Bag Width (mm)",    height:"Bag Height (mm)",    topSeal:"Top Seal (mm)",    bottomSeal:"Bottom Seal (mm)", sideGusset:"Side Gusset (mm)"}, diagramType:"bothsidegusset" },
  "Gusset Bag - Bottom Gusset":      { fields: ["width","height","topSeal","sideSeal","gusset"],       labels: { width:"Bag Width (mm)",    height:"Bag Height (mm)",    topSeal:"Top Seal (mm)",    sideSeal:"Side Seal (mm)",    gusset:"Bottom Gusset (mm)"   }, diagramType:"standup"        },
  "Laminated Pouch - 2 Ply":         { fields: ["width","height","topSeal","bottomSeal","sideSeal"],   labels: { width:"Pouch Width (mm)",  height:"Pouch Height (mm)",  topSeal:"Top Seal (mm)",    bottomSeal:"Bottom Seal (mm)", sideSeal:"Side Seal (mm)"    }, diagramType:"threeside"      },
  "Laminated Pouch - 3 Ply":         { fields: ["width","height","topSeal","bottomSeal","sideSeal"],   labels: { width:"Pouch Width (mm)",  height:"Pouch Height (mm)",  topSeal:"Top Seal (mm)",    bottomSeal:"Bottom Seal (mm)", sideSeal:"Side Seal (mm)"    }, diagramType:"threeside"      },
  "Laminated Pouch - Retort":        { fields: ["width","height","topSeal","bottomSeal","sideSeal"],   labels: { width:"Pouch Width (mm)",  height:"Pouch Height (mm)",  topSeal:"Top Seal (mm)",    bottomSeal:"Bottom Seal (mm)", sideSeal:"Side Seal (mm)"    }, diagramType:"threeside"      },
  // ── Canonical 5-pouch names (post-ContentMaster cleanup) ──────────────────
  "Center Seal Pouch":  { fields: ["width","height","topSeal","bottomSeal","centerSealWidth"], labels: { width:"Panel Width / Face Width (mm)",   height:"Pouch Height (mm)", topSeal:"Top Seal (mm)", bottomSeal:"Bottom Seal (mm)", centerSealWidth:"Center Seal (mm)" }, diagramType:"centerseal"     },
  "Stand Up Pouch":     { fields: ["width","height","topSeal","sideSeal","gusset"],           labels: { width:"Pouch Width (mm)",  height:"Pouch Height (mm)", topSeal:"Top Seal (mm)", sideSeal:"Side Seal (mm)",    gusset:"Bottom Gusset (mm)"        }, diagramType:"standup"        },
  "3 Side Seal Sachet": { fields: ["width","height","topSeal","bottomSeal","sideSeal"],       labels: { width:"Sachet Width (mm)", height:"Sachet Height (mm)",topSeal:"Top Seal (mm)", bottomSeal:"Bottom Seal (mm)",sideSeal:"Side Seal (mm)"            }, diagramType:"threeside"      },
  "Gusset Bag":         { fields: ["width","height","topSeal","bottomSeal","sideGusset"],     labels: { width:"Bag Width (mm)",    height:"Bag Height (mm)",   topSeal:"Top Seal (mm)", bottomSeal:"Bottom Seal (mm)",sideGusset:"Side Gusset (mm)"        }, diagramType:"bothsidegusset" },
  "Flat Bottom Pouch":  { fields: ["width","height","topSeal","sideGusset","gusset"],         labels: { width:"Pouch Width (mm)",  height:"Pouch Height (mm)", topSeal:"Top Seal (mm)", sideGusset:"Side Gusset (mm)",gusset:"Bottom Panel (mm)"           }, diagramType:"flatbottom"     },
};

// ─── Calculation Engine ───────────────────────────────────────────────────────

export type DimCalcResult = {
  repeatLength:  number;
  filmJobWidth:  number;
  filmJobHeight: number;
  areaPerUnit:   number;
  upsAcross:     number;
  filmRollWidth: number;
};

export function calcDimensions(
  contentType: string,
  dims: DimValues,
  machineWidth = 1300,
  trimming = 0,
  gap = 5,
): DimCalcResult {
  const cfg = CONTENT_TYPE_CONFIG[contentType];
  const w           = dims.width ?? dims.layflatWidth ?? 0;
  const h           = dims.height ?? dims.cutHeight ?? 0;
  const gusset      = dims.gusset ?? 0;
  const shrink      = dims.widthShrinkage ?? 0;
  const topSeal     = dims.topSeal ?? 0;
  const bottomSeal  = dims.bottomSeal ?? 0;
  const sideSeal    = dims.sideSeal ?? 0;
  const centerSealW = dims.centerSealWidth ?? 0;
  const sideGusset  = dims.sideGusset ?? 0;

  // ── Repeat length (cylinder circumference direction) ──
  // ── Film job width (across web direction) ──
  let repeatLength = h;
  let filmJobWidth  = w + trimming * 2;

  if (cfg?.diagramType === "sleeve") {
    repeatLength = w * 2 + shrink;
    filmJobWidth = w; // sleeve: no side trim
  } else if (
    contentType === "Pouch — 3 Side Seal" ||
    contentType === "3 Side Seal Sachet" ||
    contentType === "3-Side Seal Sachet - Standard" ||
    contentType === "3-Side Seal Sachet - Tear Notch"
  ) {
    repeatLength = h + topSeal + bottomSeal + shrink;
    filmJobWidth = w + 2 * sideSeal;
  } else if (contentType === "Pouch — Center Seal" || contentType === "Center Seal Pouch") {
    repeatLength = h + topSeal + bottomSeal + shrink;
    filmJobWidth = w * 2 + centerSealW; // w = panel width (one face)
  } else if (
    contentType === "Standup Pouch" || contentType === "Zipper Pouch" ||
    contentType === "Stand Up Pouch" ||
    contentType === "Stand Up Pouch - No Zipper" ||
    contentType === "Stand Up Pouch - With Zipper" ||
    contentType === "Stand Up Pouch - With Spout" ||
    contentType === "Gusset Bag - Bottom Gusset"
  ) {
    repeatLength = h + topSeal + (gusset > 0 ? gusset / 2 : 0) + shrink;
    filmJobWidth = w + 2 * sideSeal;
  } else if (
    contentType === "Both Side Gusset Pouch" ||
    contentType === "Gusset Bag" ||
    contentType === "Gusset Bag - Side Gusset"
  ) {
    repeatLength = h + topSeal + bottomSeal + shrink;
    filmJobWidth = w + 2 * sideGusset;
  } else if (
    contentType === "3D Pouch / Flat Bottom" ||
    contentType === "Flat Bottom Pouch" ||
    contentType === "Flat Bottom Pouch - Standard" ||
    contentType === "Flat Bottom Pouch - With Zipper" ||
    contentType === "Flat Bottom Pouch - With Valve"
  ) {
    repeatLength = h + topSeal + (gusset > 0 ? gusset / 2 : 0) + shrink;
    filmJobWidth = w + 2 * sideGusset;
  }

  const filmJobHeight = repeatLength + gap;

  // Lane width for UPS:
  //   Sleeve → no trimming between lanes
  //   Others → filmJobWidth + trimming (gap between lanes)
  const laneWidth = cfg?.diagramType === "sleeve"
    ? (filmJobWidth > 0 ? filmJobWidth : 1)
    : (filmJobWidth > 0 ? filmJobWidth + trimming : 1);

  const upsAcross     = machineWidth > 0 && laneWidth > 0 ? Math.floor(machineWidth / laneWidth) : 0;
  const filmRollWidth = upsAcross * laneWidth;
  const areaPerUnit   = (w / 1000) * (repeatLength / 1000);

  return { repeatLength, filmJobWidth, filmJobHeight, areaPerUnit, upsAcross, filmRollWidth };
}

// ─── SVG Canvas constants ─────────────────────────────────────────────────────

const VW = 320;
const VH = 260;
const PAD = 36;

// Dimension annotation line
function DimLine({ x1, y1, x2, y2, label, color = "#6366f1" }: {
  x1: number; y1: number; x2: number; y2: number; label: string; color?: string;
}) {
  const isH = Math.abs(y2 - y1) < 2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1} strokeDasharray="4 2" />
      <circle cx={x1} cy={y1} r={2.5} fill={color} />
      <circle cx={x2} cy={y2} r={2.5} fill={color} />
      <text x={mx + (isH ? 0 : -10)} y={my + (isH ? -7 : 0)}
        textAnchor="middle" fontSize={9} fill={color} fontWeight="600">{label}</text>
    </g>
  );
}

// Scale helper
function scaleToCanvas(w: number, h: number) {
  const maxW = VW - PAD * 2;
  const maxH = VH - PAD * 2;
  const s = Math.min(
    w > 0 ? maxW / w : 2,
    h > 0 ? maxH / h : 2,
    w > 0 || h > 0 ? 140 / Math.max(w, h, 1) : 1,
  );
  return {
    dw: w > 0 ? w * s : 110,
    dh: h > 0 ? h * s : 140,
    scale: s,
  };
}

// ── Trimming + Width Shrinkage overlays ──
function DimOverlays({ ox, oy, dw, dh, scale, dims }: {
  ox: number; oy: number; dw: number; dh: number; scale: number; dims: DimValues;
}) {
  const trimPx   = (dims.trimming       ?? 0) * scale;
  // Shrinkage: minimum 10px so it's always visible
  const rawShrink = (dims.widthShrinkage ?? 0);
  const shrinkPx  = rawShrink > 0 ? Math.max(rawShrink * scale, 10) : 0;

  return (
    <>
      {/* Trimming / Bleed — orange dashed rect outside the main shape */}
      {trimPx > 0 && (
        <g>
          <rect
            x={ox - trimPx} y={oy - trimPx}
            width={dw + 2 * trimPx} height={dh + 2 * trimPx}
            fill="#fff7ed" fillOpacity={0.45}
            stroke="#f97316" strokeWidth={1.2} strokeDasharray="5 3"
          />
          <text x={ox + dw / 2} y={oy - trimPx - 3}
            textAnchor="middle" fontSize={7} fill="#f97316" fontWeight="600">
            BLEED +{dims.trimming}mm
          </text>
        </g>
      )}
      {/* Width Shrinkage — vivid magenta/pink band on right with diagonal hatching */}
      {shrinkPx > 0 && (
        <g>
          {/* Solid colored band */}
          <rect
            x={ox + dw} y={oy}
            width={shrinkPx} height={dh}
            fill="#f0abfc" fillOpacity={0.7}
            stroke="#c026d3" strokeWidth={1.5}
          />
          {/* Diagonal hatch lines inside band */}
          {Array.from({ length: Math.ceil((dh + shrinkPx) / 5) }).map((_, i) => {
            const offset = i * 5;
            const x1 = ox + dw + Math.max(0, offset - dh);
            const y1 = oy + Math.min(dh, offset);
            const x2 = ox + dw + Math.min(shrinkPx, offset);
            const y2 = oy + Math.max(0, offset - shrinkPx);
            return x1 < ox + dw + shrinkPx && x2 > ox + dw
              ? <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c026d3" strokeWidth={1} opacity={0.5} />
              : null;
          })}
          {/* Dimension arrow + label */}
          <line x1={ox + dw} y1={oy + dh + 10} x2={ox + dw + shrinkPx} y2={oy + dh + 10}
            stroke="#c026d3" strokeWidth={1.5} markerEnd="url(#arrow-shrink)" />
          <circle cx={ox + dw} cy={oy + dh + 10} r={2.5} fill="#c026d3" />
          <circle cx={ox + dw + shrinkPx} cy={oy + dh + 10} r={2.5} fill="#c026d3" />
          <text x={ox + dw + shrinkPx / 2} y={oy + dh + 22}
            textAnchor="middle" fontSize={8} fill="#86198f" fontWeight="800">
            SHRINK +{rawShrink}mm
          </text>
          {/* Vertical label inside band (rotated) */}
          <text
            x={ox + dw + shrinkPx / 2} y={oy + dh / 2}
            textAnchor="middle" fontSize={7} fill="#86198f" fontWeight="700"
            transform={`rotate(-90,${ox + dw + shrinkPx / 2},${oy + dh / 2})`}>
            +{rawShrink}mm
          </text>
        </g>
      )}
      {/* Arrow marker def */}
      <defs>
        <marker id="arrow-shrink" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#c026d3" />
        </marker>
      </defs>
    </>
  );
}

// ── Standup / Zipper Pouch ──
// Film layout: [sideSeal | W | sideSeal] across, [topSeal | H body | gusset/2] repeat
function StandupDiagram({ dims }: { dims: DimValues }) {
  const w        = dims.width ?? 0;
  const h        = dims.height ?? 0;
  const gus      = dims.gusset ?? 0;
  const topSeal  = dims.topSeal ?? 0;
  const sideSeal = dims.sideSeal ?? 0;

  const totalW = w + 2 * sideSeal;
  const totalH = h + topSeal + (gus > 0 ? gus / 2 : 0);
  const { dw, dh, scale } = scaleToCanvas(totalW || w || 100, totalH || h || 100);
  const ox = (VW - dw) / 2;
  const oy = PAD + 6;

  const ssPx = sideSeal > 0 ? Math.max(sideSeal * scale, 8) : 0;
  const tsPx = topSeal  > 0 ? Math.max(topSeal  * scale, 8) : 0;
  const gusPx = gus > 0 ? Math.max((gus / 2) * scale, 8) : 0;
  const bodyH = dh - tsPx - gusPx;

  return (
    <svg width={VW} height={VH} className="w-full">
      {/* Outer border = full film lane */}
      <rect x={ox} y={oy} width={dw} height={dh} fill="#eef2ff" stroke="#6366f1" strokeWidth={1.5} rx={2} />
      {/* Side seals */}
      {ssPx > 0 && <>
        <rect x={ox} y={oy} width={ssPx} height={dh} fill="#c7d2fe" stroke="#6366f1" strokeWidth={1} opacity={0.7} />
        <rect x={ox+dw-ssPx} y={oy} width={ssPx} height={dh} fill="#c7d2fe" stroke="#6366f1" strokeWidth={1} opacity={0.7} />
        {ssPx > 10 && <>
          <text x={ox+ssPx/2} y={oy+dh/2} textAnchor="middle" fontSize={6} fill="#4338ca" transform={`rotate(-90,${ox+ssPx/2},${oy+dh/2})`}>SIDE {sideSeal}mm</text>
          <text x={ox+dw-ssPx/2} y={oy+dh/2} textAnchor="middle" fontSize={6} fill="#4338ca" transform={`rotate(-90,${ox+dw-ssPx/2},${oy+dh/2})`}>SIDE {sideSeal}mm</text>
        </>}
      </>}
      {/* Top seal */}
      {tsPx > 0 && <>
        <rect x={ox+ssPx} y={oy} width={dw-2*ssPx} height={tsPx} fill="#a5b4fc" stroke="#6366f1" strokeWidth={1} opacity={0.8} />
        <text x={ox+dw/2} y={oy+tsPx-2} textAnchor="middle" fontSize={7} fill="#4338ca">TOP SEAL {topSeal}mm</text>
      </>}
      {/* Body */}
      <rect x={ox+ssPx} y={oy+tsPx} width={dw-2*ssPx} height={bodyH} fill="#e0e7ff" stroke="#6366f1" strokeWidth={0.8} opacity={0.5} />
      <text x={ox+dw/2} y={oy+tsPx+bodyH/2+3} textAnchor="middle" fontSize={8} fill="#3730a3" fontWeight="600">BODY</text>
      {/* Bottom gusset — shows full gusset, only half contributes to repeat */}
      {gusPx > 0 && <>
        <rect x={ox} y={oy+dh-gusPx} width={dw} height={gusPx} fill="#a5f3fc" stroke="#0891b2" strokeWidth={1} opacity={0.6} />
        <text x={ox+dw/2} y={oy+dh-gusPx/2-1} textAnchor="middle" fontSize={6.5} fill="#0e7490" fontWeight="600">GUSSET {gus}mm total</text>
        <text x={ox+dw/2} y={oy+dh-gusPx/2+9} textAnchor="middle" fontSize={6} fill="#0e7490">(½ = {gus/2}mm added to repeat)</text>
      </>}
      {/* Dim lines — width: breakdown formula */}
      {totalW > 0 && sideSeal > 0 && <DimLine x1={ox} y1={oy+dh+14} x2={ox+dw} y2={oy+dh+14}
        label={`${sideSeal} + ${w} + ${sideSeal} = ${totalW}mm`} color="#6366f1" />}
      {totalW > 0 && sideSeal === 0 && <DimLine x1={ox} y1={oy+dh+14} x2={ox+dw} y2={oy+dh+14}
        label={`${totalW}mm`} color="#6366f1" />}
      {ssPx > 0 && <DimLine x1={ox} y1={oy+dh+25} x2={ox+ssPx} y2={oy+dh+25} label={`${sideSeal}`} color="#818cf8" />}
      {w > 0 && <DimLine x1={ox+ssPx} y1={oy+dh+25} x2={ox+dw-ssPx} y2={oy+dh+25} label={`${w}mm`} color="#818cf8" />}
      {ssPx > 0 && <DimLine x1={ox+dw-ssPx} y1={oy+dh+25} x2={ox+dw} y2={oy+dh+25} label={`${sideSeal}`} color="#818cf8" />}
      {/* Dim lines — height */}
      {totalH > 0 && <DimLine x1={ox-20} y1={oy} x2={ox-20} y2={oy+dh} label={`${totalH}mm`} color="#6366f1" />}
      {h > 0 && <DimLine x1={ox-32} y1={oy+tsPx} x2={ox-32} y2={oy+tsPx+bodyH} label={`H:${h}mm`} color="#818cf8" />}
      <text x={VW/2} y={VH-4} textAnchor="middle" fontSize={8} fill="#6b7280">Stand Up Pouch — front &amp; back = separate webs</text>
    </svg>
  );
}

// ── 3-Side Seal ──
// Film layout: [sideSeal | W | sideSeal] across, [topSeal | H body | bottomSeal] repeat
function ThreeSideDiagram({ dims }: { dims: DimValues }) {
  const w          = dims.width ?? 0;
  const h          = dims.height ?? 0;
  const topSeal    = dims.topSeal ?? 0;
  const bottomSeal = dims.bottomSeal ?? 0;
  const sideSeal   = dims.sideSeal ?? 0;

  const totalW = w + 2 * sideSeal;
  const totalH = h + topSeal + bottomSeal;
  const { dw, dh, scale } = scaleToCanvas(totalW || w || 100, totalH || h || 100);
  const ox = (VW - dw) / 2; const oy = PAD + 6;

  const ssPx = sideSeal   > 0 ? Math.max(sideSeal   * scale, 8) : 0;
  const tsPx = topSeal    > 0 ? Math.max(topSeal    * scale, 8) : 0;
  const bsPx = bottomSeal > 0 ? Math.max(bottomSeal * scale, 8) : 0;
  const bodyH = dh - tsPx - bsPx;

  return (
    <svg width={VW} height={VH} className="w-full">
      {/* Full film border */}
      <rect x={ox} y={oy} width={dw} height={dh} fill="#f0fdf4" stroke="#16a34a" strokeWidth={1.5} rx={2} />
      {/* Side seals */}
      {ssPx > 0 && <>
        <rect x={ox} y={oy} width={ssPx} height={dh} fill="#bbf7d0" stroke="#16a34a" strokeWidth={1} opacity={0.8} />
        <rect x={ox+dw-ssPx} y={oy} width={ssPx} height={dh} fill="#bbf7d0" stroke="#16a34a" strokeWidth={1} opacity={0.8} />
        {ssPx > 10 && <>
          <text x={ox+ssPx/2} y={oy+dh/2} textAnchor="middle" fontSize={6} fill="#15803d" transform={`rotate(-90,${ox+ssPx/2},${oy+dh/2})`}>SEAL {sideSeal}mm</text>
          <text x={ox+dw-ssPx/2} y={oy+dh/2} textAnchor="middle" fontSize={6} fill="#15803d" transform={`rotate(-90,${ox+dw-ssPx/2},${oy+dh/2})`}>SEAL {sideSeal}mm</text>
        </>}
      </>}
      {/* Top seal */}
      {tsPx > 0 && <>
        <rect x={ox+ssPx} y={oy} width={dw-2*ssPx} height={tsPx} fill="#86efac" stroke="#16a34a" strokeWidth={1} opacity={0.8} />
        <text x={ox+dw/2} y={oy+tsPx-2} textAnchor="middle" fontSize={7} fill="#15803d">TOP SEAL {topSeal}mm</text>
      </>}
      {/* Body */}
      <rect x={ox+ssPx} y={oy+tsPx} width={dw-2*ssPx} height={bodyH} fill="#dcfce7" stroke="#16a34a" strokeWidth={0.8} opacity={0.6} />
      <text x={ox+dw/2} y={oy+tsPx+bodyH/2+3} textAnchor="middle" fontSize={8} fill="#166534" fontWeight="600">BODY</text>
      {/* Bottom seal */}
      {bsPx > 0 && <>
        <rect x={ox+ssPx} y={oy+tsPx+bodyH} width={dw-2*ssPx} height={bsPx} fill="#86efac" stroke="#16a34a" strokeWidth={1} opacity={0.8} />
        <text x={ox+dw/2} y={oy+dh-3} textAnchor="middle" fontSize={7} fill="#15803d">BTM SEAL {bottomSeal}mm</text>
      </>}
      {/* Dim lines — width: Row 1 = total formula, Row 2 = per-segment */}
      {totalW > 0 && sideSeal > 0 && <DimLine x1={ox} y1={oy+dh+14} x2={ox+dw} y2={oy+dh+14}
        label={`${sideSeal} + ${w} + ${sideSeal} = ${totalW}mm`} color="#16a34a" />}
      {totalW > 0 && sideSeal === 0 && <DimLine x1={ox} y1={oy+dh+14} x2={ox+dw} y2={oy+dh+14}
        label={`${totalW}mm`} color="#16a34a" />}
      {ssPx > 0 && <DimLine x1={ox} y1={oy+dh+25} x2={ox+ssPx} y2={oy+dh+25} label={`${sideSeal}`} color="#4ade80" />}
      {w > 0 && <DimLine x1={ox+ssPx} y1={oy+dh+25} x2={ox+dw-ssPx} y2={oy+dh+25} label={`${w}mm`} color="#4ade80" />}
      {ssPx > 0 && <DimLine x1={ox+dw-ssPx} y1={oy+dh+25} x2={ox+dw} y2={oy+dh+25} label={`${sideSeal}`} color="#4ade80" />}
      {/* Dim lines — height */}
      {totalH > 0 && <DimLine x1={ox-20} y1={oy} x2={ox-20} y2={oy+dh} label={`${totalH}mm`} color="#16a34a" />}
      {h > 0 && <DimLine x1={ox-32} y1={oy+tsPx} x2={ox-32} y2={oy+tsPx+bodyH} label={`H:${h}mm`} color="#4ade80" />}
      <text x={VW/2} y={VH-4} textAnchor="middle" fontSize={8} fill="#6b7280">3-Side Seal Pouch / Sachet</text>
    </svg>
  );
}

// ── Center Seal ──
// Flat film: [FRONT panel = W] [CENTER SEAL = centerSealWidth] [BACK panel = W]
// Repeat = H + topSeal + bottomSeal + shrinkage
// When formed into tube, the center seal folds to the back of the pouch
function CenterSealDiagram({ dims }: { dims: DimValues }) {
  const w           = dims.width ?? 0;        // panel width (one face)
  const h           = dims.height ?? 0;
  const topSeal     = dims.topSeal ?? 0;
  const bottomSeal  = dims.bottomSeal ?? 0;
  const centerSealW = dims.centerSealWidth ?? 0;
  const shrink      = dims.widthShrinkage ?? 0;   // repeat-length shrinkage

  const totalW     = w * 2 + centerSealW;
  const baseRepeat = h + topSeal + bottomSeal;
  const fullRepeat = baseRepeat + shrink;

  const { dw, dh, scale } = scaleToCanvas(totalW || w * 2 || 100, fullRepeat || baseRepeat || h || 100);
  const ox = (VW - dw) / 2;
  const oy = PAD + 2;

  const csPx     = centerSealW > 0 ? Math.max(centerSealW * scale, 8) : 8;
  const tsPx     = topSeal     > 0 ? Math.max(topSeal     * scale, 8) : 0;
  const bsPx     = bottomSeal  > 0 ? Math.max(bottomSeal  * scale, 8) : 0;
  const shrinkPx = shrink      > 0 ? Math.max(shrink      * scale, 6) : 0;
  const bodyH    = dh - tsPx - bsPx - shrinkPx;
  const sideW    = (dw - csPx) / 2;

  // Repeat breakdown string, e.g. "220 + 10 + 8 + 1.5 = 239.5mm"
  const repeatParts = [
    h > 0        ? `${h}`                       : "",
    topSeal > 0  ? `${topSeal}`                 : "",
    bottomSeal > 0 ? `${bottomSeal}`            : "",
    shrink > 0   ? `${shrink}`                  : "",
  ].filter(Boolean).join(" + ");
  const fullRepeatStr = fullRepeat > 0
    ? `${fullRepeat % 1 === 0 ? fullRepeat : fullRepeat.toFixed(1)}mm`
    : "";

  return (
    <svg width={VW} height={VH} className="w-full">
      {/* ── Fold-edge indicators: outer dashed lines show where the tube seam forms ── */}
      <line x1={ox} y1={oy-8} x2={ox} y2={oy+dh-shrinkPx+2}
        stroke="#7c3aed" strokeWidth={1} strokeDasharray="3 2" opacity={0.45} />
      <line x1={ox+dw} y1={oy-8} x2={ox+dw} y2={oy+dh-shrinkPx+2}
        stroke="#7c3aed" strokeWidth={1} strokeDasharray="3 2" opacity={0.45} />
      <text x={ox}    y={oy-10} textAnchor="middle" fontSize={6} fill="#7c3aed" fontWeight="700">FOLD</text>
      <text x={ox+dw} y={oy-10} textAnchor="middle" fontSize={6} fill="#7c3aed" fontWeight="700">FOLD</text>

      {/* ── FRONT Panel ── */}
      <rect x={ox} y={oy} width={sideW} height={dh-shrinkPx} fill="#fdf4ff" stroke="#a855f7" strokeWidth={1.5} rx={2} />
      <rect x={ox} y={oy+tsPx} width={sideW} height={bodyH} fill="#f3e8ff" stroke="none" />
      <text x={ox+sideW/2} y={oy+tsPx+bodyH/2-4} textAnchor="middle" fontSize={8} fill="#7e22ce" fontWeight="700">FRONT</text>
      <text x={ox+sideW/2} y={oy+tsPx+bodyH/2+8} textAnchor="middle" fontSize={6.5} fill="#9333ea">Face Width</text>

      {/* ── CENTER SEAL (back center when tube is formed) ── */}
      <rect x={ox+sideW} y={oy} width={csPx} height={dh-shrinkPx} fill="#7c3aed" stroke="#6d28d9" strokeWidth={1.5} />
      {csPx >= 8 && (
        <text x={ox+sideW+csPx/2} y={oy+(dh-shrinkPx)/2}
          textAnchor="middle" fontSize={5.5} fill="#fff" fontWeight="800"
          transform={`rotate(-90,${ox+sideW+csPx/2},${oy+(dh-shrinkPx)/2})`}>
          BACK CENTER SEAL {centerSealW}mm
        </text>
      )}

      {/* ── BACK Panel ── */}
      <rect x={ox+sideW+csPx} y={oy} width={sideW} height={dh-shrinkPx} fill="#ede9fe" stroke="#a855f7" strokeWidth={1.5} rx={2} />
      <rect x={ox+sideW+csPx} y={oy+tsPx} width={sideW} height={bodyH} fill="#ddd6fe" stroke="none" />
      <text x={ox+sideW+csPx+sideW/2} y={oy+tsPx+bodyH/2-4} textAnchor="middle" fontSize={8} fill="#6d28d9" fontWeight="700">BACK</text>
      <text x={ox+sideW+csPx+sideW/2} y={oy+tsPx+bodyH/2+8} textAnchor="middle" fontSize={6.5} fill="#7c3aed">Face Width</text>

      {/* ── Top Seal ── */}
      {tsPx > 0 && <>
        <rect x={ox} y={oy} width={dw} height={tsPx} fill="#e9d5ff" stroke="#a855f7" strokeWidth={1} opacity={0.8} />
        <text x={ox+dw/2} y={oy+tsPx-2} textAnchor="middle" fontSize={7} fill="#7e22ce">TOP SEAL {topSeal}mm</text>
      </>}

      {/* ── Bottom Seal ── */}
      {bsPx > 0 && <>
        <rect x={ox} y={oy+tsPx+bodyH} width={dw} height={bsPx} fill="#e9d5ff" stroke="#a855f7" strokeWidth={1} opacity={0.8} />
        <text x={ox+dw/2} y={oy+tsPx+bodyH+bsPx-2} textAnchor="middle" fontSize={7} fill="#7e22ce">BTM SEAL {bottomSeal}mm</text>
      </>}

      {/* ── Repeat-length shrinkage band ── */}
      {shrinkPx > 0 && <>
        <rect x={ox} y={oy+dh-shrinkPx} width={dw} height={shrinkPx}
          fill="#f0abfc" fillOpacity={0.7} stroke="#c026d3" strokeWidth={1} />
        <text x={ox+dw/2} y={oy+dh-shrinkPx/2+3}
          textAnchor="middle" fontSize={6} fill="#86198f" fontWeight="700">
          +{shrink}mm REPEAT SHRINK
        </text>
      </>}

      {/* ── Width breakdown dim lines ── */}
      {/* Row 1: total */}
      {totalW > 0 && <DimLine x1={ox} y1={oy+dh+13} x2={ox+dw} y2={oy+dh+13}
        label={`${w} + ${centerSealW} + ${w} = ${totalW}mm`} color="#7c3aed" />}
      {/* Row 2: per-segment */}
      {w > 0 && <DimLine x1={ox} y1={oy+dh+24} x2={ox+sideW} y2={oy+dh+24}
        label={`${w}mm`} color="#c084fc" />}
      {centerSealW > 0 && csPx >= 10 && (
        <DimLine x1={ox+sideW} y1={oy+dh+24} x2={ox+sideW+csPx} y2={oy+dh+24}
          label={`${centerSealW}`} color="#6d28d9" />
      )}
      {w > 0 && <DimLine x1={ox+sideW+csPx} y1={oy+dh+24} x2={ox+dw} y2={oy+dh+24}
        label={`${w}mm`} color="#c084fc" />}

      {/* ── Height dim lines ── */}
      {fullRepeat > 0 && <DimLine x1={ox-20} y1={oy} x2={ox-20} y2={oy+dh}
        label={fullRepeatStr} color="#a855f7" />}
      {h > 0 && <DimLine x1={ox-32} y1={oy+tsPx} x2={ox-32} y2={oy+tsPx+bodyH}
        label={`H:${h}mm`} color="#c084fc" />}

      {/* ── Repeat breakdown formula ── */}
      {fullRepeat > 0 && repeatParts && (
        <text x={VW/2} y={VH-14} textAnchor="middle" fontSize={7.5} fill="#6b21a8" fontWeight="600">
          Repeat: {repeatParts} = {fullRepeatStr}
        </text>
      )}

      <text x={VW/2} y={VH-4} textAnchor="middle" fontSize={7.5} fill="#6b7280">
        Center Seal Pouch — seal folds to back center
      </text>
    </svg>
  );
}

// ── Both Side Gusset Pouch ──
// Film layout: [sideGusset | W | sideGusset] across, [topSeal | H body | bottomSeal] repeat
function BothSideGussetDiagram({ dims }: { dims: DimValues }) {
  const w          = dims.width ?? 0;
  const h          = dims.height ?? 0;
  const topSeal    = dims.topSeal ?? 0;
  const bottomSeal = dims.bottomSeal ?? 0;
  const sideGusset = dims.sideGusset ?? 0;

  const totalW = w + 2 * sideGusset;
  const totalH = h + topSeal + bottomSeal;
  const { dw, dh, scale } = scaleToCanvas(totalW || w || 100, totalH || h || 100);
  const ox = (VW - dw) / 2; const oy = PAD + 6;

  const sgPx = sideGusset > 0 ? Math.max(sideGusset * scale, 10) : 0;
  const tsPx = topSeal    > 0 ? Math.max(topSeal    * scale, 8)  : 0;
  const bsPx = bottomSeal > 0 ? Math.max(bottomSeal * scale, 8)  : 0;
  const bodyH = dh - tsPx - bsPx;

  return (
    <svg width={VW} height={VH} className="w-full">
      {/* Full film border */}
      <rect x={ox} y={oy} width={dw} height={dh} fill="#fff7ed" stroke="#ea580c" strokeWidth={1.5} rx={2} />
      {/* Side gussets */}
      {sgPx > 0 && <>
        <rect x={ox} y={oy} width={sgPx} height={dh} fill="#fed7aa" stroke="#ea580c" strokeWidth={1} opacity={0.8} />
        <rect x={ox+dw-sgPx} y={oy} width={sgPx} height={dh} fill="#fed7aa" stroke="#ea580c" strokeWidth={1} opacity={0.8} />
        {/* Gusset fold lines */}
        <line x1={ox+sgPx/2} y1={oy} x2={ox+sgPx/2} y2={oy+dh} stroke="#ea580c" strokeWidth={0.8} strokeDasharray="3 2" />
        <line x1={ox+dw-sgPx/2} y1={oy} x2={ox+dw-sgPx/2} y2={oy+dh} stroke="#ea580c" strokeWidth={0.8} strokeDasharray="3 2" />
        {sgPx > 12 && <>
          <text x={ox+sgPx/2} y={oy+dh/2} textAnchor="middle" fontSize={6} fill="#c2410c" transform={`rotate(-90,${ox+sgPx/2},${oy+dh/2})`}>SIDE GUSSET {sideGusset}mm</text>
          <text x={ox+dw-sgPx/2} y={oy+dh/2} textAnchor="middle" fontSize={6} fill="#c2410c" transform={`rotate(-90,${ox+dw-sgPx/2},${oy+dh/2})`}>SIDE GUSSET {sideGusset}mm</text>
        </>}
      </>}
      {/* Top seal */}
      {tsPx > 0 && <>
        <rect x={ox+sgPx} y={oy} width={dw-2*sgPx} height={tsPx} fill="#fdba74" stroke="#ea580c" strokeWidth={1} opacity={0.8} />
        <text x={ox+dw/2} y={oy+tsPx-2} textAnchor="middle" fontSize={7} fill="#9a3412">TOP SEAL {topSeal}mm</text>
      </>}
      {/* Body */}
      <rect x={ox+sgPx} y={oy+tsPx} width={dw-2*sgPx} height={bodyH} fill="#ffedd5" stroke="#ea580c" strokeWidth={0.8} opacity={0.5} />
      <text x={ox+dw/2} y={oy+tsPx+bodyH/2+3} textAnchor="middle" fontSize={8} fill="#7c2d12" fontWeight="600">BODY</text>
      {/* Bottom seal */}
      {bsPx > 0 && <>
        <rect x={ox+sgPx} y={oy+tsPx+bodyH} width={dw-2*sgPx} height={bsPx} fill="#fdba74" stroke="#ea580c" strokeWidth={1} opacity={0.8} />
        <text x={ox+dw/2} y={oy+dh-3} textAnchor="middle" fontSize={7} fill="#9a3412">BTM SEAL {bottomSeal}mm</text>
      </>}
      {/* Dim lines — width: breakdown formula */}
      {totalW > 0 && sideGusset > 0 && <DimLine x1={ox} y1={oy+dh+14} x2={ox+dw} y2={oy+dh+14}
        label={`${sideGusset} + ${w} + ${sideGusset} = ${totalW}mm`} color="#ea580c" />}
      {totalW > 0 && sideGusset === 0 && <DimLine x1={ox} y1={oy+dh+14} x2={ox+dw} y2={oy+dh+14}
        label={`${totalW}mm`} color="#ea580c" />}
      {sgPx > 0 && <DimLine x1={ox} y1={oy+dh+25} x2={ox+sgPx} y2={oy+dh+25} label={`${sideGusset}`} color="#fb923c" />}
      {w > 0 && <DimLine x1={ox+sgPx} y1={oy+dh+25} x2={ox+dw-sgPx} y2={oy+dh+25} label={`${w}mm`} color="#fb923c" />}
      {sgPx > 0 && <DimLine x1={ox+dw-sgPx} y1={oy+dh+25} x2={ox+dw} y2={oy+dh+25} label={`${sideGusset}`} color="#fb923c" />}
      {/* Dim lines — height */}
      {totalH > 0 && <DimLine x1={ox-20} y1={oy} x2={ox-20} y2={oy+dh} label={`${totalH}mm`} color="#ea580c" />}
      {h > 0 && <DimLine x1={ox-32} y1={oy+tsPx} x2={ox-32} y2={oy+tsPx+bodyH} label={`H:${h}mm`} color="#fb923c" />}
      <text x={VW/2} y={VH-4} textAnchor="middle" fontSize={8} fill="#6b7280">Gusset Bag — single-web, side gussets folded in</text>
    </svg>
  );
}

// ── 3D / Flat Bottom Pouch ──
// Film layout: [sideGusset | W | sideGusset] across, [topSeal | H body | gusset/2 bottom] repeat
function FlatBottomDiagram({ dims }: { dims: DimValues }) {
  const w          = dims.width ?? 0;
  const h          = dims.height ?? 0;
  const topSeal    = dims.topSeal ?? 0;
  const sideGusset = dims.sideGusset ?? 0;
  const btmGusset  = dims.gusset ?? 0;

  const totalW = w + 2 * sideGusset;
  const totalH = h + topSeal + (btmGusset > 0 ? btmGusset / 2 : 0);
  const { dw, dh, scale } = scaleToCanvas(totalW || w || 100, totalH || h || 100);
  const ox = (VW - dw) / 2; const oy = PAD + 6;

  const sgPx   = sideGusset > 0 ? Math.max(sideGusset * scale, 10) : 0;
  const tsPx   = topSeal    > 0 ? Math.max(topSeal    * scale, 8)  : 0;
  const bgPx   = btmGusset  > 0 ? Math.max((btmGusset / 2) * scale, 8) : 0;
  const bodyH  = dh - tsPx - bgPx;

  return (
    <svg width={VW} height={VH} className="w-full">
      {/* Full film border */}
      <rect x={ox} y={oy} width={dw} height={dh} fill="#f0fdf4" stroke="#059669" strokeWidth={1.5} rx={2} />
      {/* Side gussets */}
      {sgPx > 0 && <>
        <rect x={ox} y={oy} width={sgPx} height={dh} fill="#a7f3d0" stroke="#059669" strokeWidth={1} opacity={0.8} />
        <rect x={ox+dw-sgPx} y={oy} width={sgPx} height={dh} fill="#a7f3d0" stroke="#059669" strokeWidth={1} opacity={0.8} />
        <line x1={ox+sgPx/2} y1={oy} x2={ox+sgPx/2} y2={oy+dh} stroke="#059669" strokeWidth={0.8} strokeDasharray="3 2" />
        <line x1={ox+dw-sgPx/2} y1={oy} x2={ox+dw-sgPx/2} y2={oy+dh} stroke="#059669" strokeWidth={0.8} strokeDasharray="3 2" />
        {sgPx > 12 && <>
          <text x={ox+sgPx/2} y={oy+dh/2} textAnchor="middle" fontSize={6} fill="#065f46" transform={`rotate(-90,${ox+sgPx/2},${oy+dh/2})`}>SIDE GUSSET {sideGusset}mm</text>
          <text x={ox+dw-sgPx/2} y={oy+dh/2} textAnchor="middle" fontSize={6} fill="#065f46" transform={`rotate(-90,${ox+dw-sgPx/2},${oy+dh/2})`}>SIDE GUSSET {sideGusset}mm</text>
        </>}
      </>}
      {/* Top seal */}
      {tsPx > 0 && <>
        <rect x={ox+sgPx} y={oy} width={dw-2*sgPx} height={tsPx} fill="#6ee7b7" stroke="#059669" strokeWidth={1} opacity={0.9} />
        <text x={ox+dw/2} y={oy+tsPx-2} textAnchor="middle" fontSize={7} fill="#065f46">TOP SEAL {topSeal}mm</text>
      </>}
      {/* Body */}
      <rect x={ox+sgPx} y={oy+tsPx} width={dw-2*sgPx} height={bodyH} fill="#d1fae5" stroke="#059669" strokeWidth={0.8} opacity={0.5} />
      <text x={ox+dw/2} y={oy+tsPx+bodyH/2+3} textAnchor="middle" fontSize={8} fill="#064e3b" fontWeight="600">BODY</text>
      {/* Bottom panel (flat bottom fold — full panel, half adds to repeat) */}
      {bgPx > 0 && <>
        <rect x={ox} y={oy+dh-bgPx} width={dw} height={bgPx} fill="#6ee7b7" stroke="#059669" strokeWidth={1} opacity={0.8} />
        <line x1={ox} y1={oy+dh-bgPx/2} x2={ox+dw} y2={oy+dh-bgPx/2} stroke="#059669" strokeWidth={0.8} strokeDasharray="3 2" />
        <text x={ox+dw/2} y={oy+dh-bgPx/2-2} textAnchor="middle" fontSize={6.5} fill="#065f46" fontWeight="600">BTM PANEL/2 = {(btmGusset/2).toFixed(0)}mm</text>
        <text x={ox+dw/2} y={oy+dh-bgPx/2+8} textAnchor="middle" fontSize={6} fill="#065f46">(adds to repeat)</text>
      </>}
      {/* Dim lines — width: breakdown formula */}
      {totalW > 0 && sideGusset > 0 && <DimLine x1={ox} y1={oy+dh+14} x2={ox+dw} y2={oy+dh+14}
        label={`${sideGusset} + ${w} + ${sideGusset} = ${totalW}mm`} color="#059669" />}
      {totalW > 0 && sideGusset === 0 && <DimLine x1={ox} y1={oy+dh+14} x2={ox+dw} y2={oy+dh+14}
        label={`${totalW}mm`} color="#059669" />}
      {sgPx > 0 && <DimLine x1={ox} y1={oy+dh+25} x2={ox+sgPx} y2={oy+dh+25} label={`${sideGusset}`} color="#34d399" />}
      {w > 0 && <DimLine x1={ox+sgPx} y1={oy+dh+25} x2={ox+dw-sgPx} y2={oy+dh+25} label={`${w}mm`} color="#34d399" />}
      {sgPx > 0 && <DimLine x1={ox+dw-sgPx} y1={oy+dh+25} x2={ox+dw} y2={oy+dh+25} label={`${sideGusset}`} color="#34d399" />}
      {/* Dim lines — height */}
      {totalH > 0 && <DimLine x1={ox-20} y1={oy} x2={ox-20} y2={oy+dh} label={`${totalH}mm`} color="#059669" />}
      {h > 0 && <DimLine x1={ox-32} y1={oy+tsPx} x2={ox-32} y2={oy+tsPx+bodyH} label={`H:${h}mm`} color="#34d399" />}
      <text x={VW/2} y={VH-4} textAnchor="middle" fontSize={8} fill="#6b7280">Flat Bottom Pouch — front &amp; back = separate webs</text>
    </svg>
  );
}

// ── Roll Form ──
function RollFormDiagram({ dims }: { dims: DimValues }) {
  const w = dims.width ?? 0; const h = dims.height ?? 0;
  const sw = dims.sealWidth ?? 0;
  const { dw, dh, scale } = scaleToCanvas(w, h);
  const ox = (VW - dw) / 2; const oy = PAD + 20;
  const repeats = 3;
  const sealD = sw > 0 ? Math.max(sw * (dw / Math.max(w, 1)), 8) : 10;
  return (
    <svg width={VW} height={VH} className="w-full">
      <DimOverlays ox={ox} oy={oy} dw={dw} dh={dh} scale={scale} dims={dims} />
      {Array.from({ length: repeats }).map((_, ri) => {
        const ry = oy + ri * (dh + 3);
        return (
          <g key={ri}>
            <rect x={ox} y={ry} width={dw} height={dh} fill={ri % 2 === 0 ? "#fff7ed" : "#fef3c7"} stroke="#d97706" strokeWidth={1.5} rx={1} />
            <rect x={ox} y={ry} width={sealD} height={dh} fill="#fcd34d" stroke="#d97706" strokeWidth={1} opacity={0.6} />
            <rect x={ox+dw-sealD} y={ry} width={sealD} height={dh} fill="#fcd34d" stroke="#d97706" strokeWidth={1} opacity={0.6} />
            {ri < repeats-1 && <line x1={ox} y1={ry+dh+1.5} x2={ox+dw} y2={ry+dh+1.5} stroke="#d97706" strokeWidth={1} strokeDasharray="3 2" />}
          </g>
        );
      })}
      <ellipse cx={ox-18} cy={oy+dh*repeats/2} rx={12} ry={Math.min(dh*repeats*0.4, 40)} fill="#fef9c3" stroke="#ca8a04" strokeWidth={1.5} />
      {w > 0 && <DimLine x1={ox} y1={oy+dh*repeats+16} x2={ox+dw} y2={oy+dh*repeats+16} label={`${w}mm`} color="#d97706" />}
      {h > 0 && <DimLine x1={ox-32} y1={oy} x2={ox-32} y2={oy+dh} label={`${h}mm`} color="#d97706" />}
      <text x={VW/2} y={VH-8} textAnchor="middle" fontSize={8} fill="#6b7280">Roll Form</text>
    </svg>
  );
}

// ── Label ──
function LabelDiagram({ dims }: { dims: DimValues }) {
  const w = dims.width ?? 0; const h = dims.height ?? 0;
  const { dw, dh, scale } = scaleToCanvas(w, h);
  const cols = Math.min(3, Math.max(1, Math.floor((VW - PAD * 2) / (dw + 6))));
  const rows = Math.min(2, Math.max(1, Math.floor((VH - PAD * 2 - 20) / (dh + 6))));
  const gw = cols * dw + (cols-1) * 6;
  const gh = rows * dh + (rows-1) * 6;
  const gox = (VW - gw) / 2; const goy = (VH - gh) / 2 - 10;
  const br = Math.min(dw, dh) * 0.08;
  return (
    <svg width={VW} height={VH} className="w-full">
      <DimOverlays ox={gox} oy={goy} dw={dw} dh={dh} scale={scale} dims={dims} />
      <rect x={gox-8} y={goy-8} width={gw+16} height={gh+16} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 2" rx={4} />
      {Array.from({ length: rows }).map((_, ri) =>
        Array.from({ length: cols }).map((_, ci) => {
          const lx = gox + ci*(dw+6); const ly = goy + ri*(dh+6);
          const isFirst = ri===0 && ci===0;
          return (
            <g key={`${ri}-${ci}`}>
              <rect x={lx} y={ly} width={dw} height={dh}
                fill={isFirst ? "#eff6ff" : "#f8fafc"}
                stroke={isFirst ? "#3b82f6" : "#cbd5e1"}
                strokeWidth={isFirst ? 1.8 : 1} rx={br} />
              {isFirst && <text x={lx+dw/2} y={ly+dh/2+3} textAnchor="middle" fontSize={8} fill="#3b82f6" fontWeight="600">LABEL</text>}
            </g>
          );
        })
      )}
      {w > 0 && <DimLine x1={gox} y1={goy+gh+16} x2={gox+dw} y2={goy+gh+16} label={`${w}mm`} color="#3b82f6" />}
      {h > 0 && <DimLine x1={gox-20} y1={goy} x2={gox-20} y2={goy+dh} label={`${h}mm`} color="#3b82f6" />}
      <text x={VW/2} y={VH-8} textAnchor="middle" fontSize={8} fill="#6b7280">Label</text>
    </svg>
  );
}

// ── Shrink Sleeve ──
function ShrinkSleeveDiagram({ dims }: { dims: DimValues }) {
  const lf = dims.layflatWidth ?? 0; const ch = dims.cutHeight ?? 0;
  const { dw, dh, scale } = scaleToCanvas(lf, ch);
  const ox = (VW - dw) / 2; const oy = (VH - dh) / 2 - 10;
  const ry = Math.max(dw * 0.12, 8); const sh = 10;
  return (
    <svg width={VW} height={VH} className="w-full">
      <DimOverlays ox={ox} oy={oy+ry} dw={dw} dh={dh-ry} scale={scale} dims={dims} />
      <rect x={ox} y={oy+ry} width={dw} height={dh-ry} fill="#fdf2f8" stroke="#ec4899" strokeWidth={1.5} />
      <ellipse cx={ox+dw/2} cy={oy+ry} rx={dw/2} ry={ry} fill="#fce7f3" stroke="#ec4899" strokeWidth={1.5} />
      <ellipse cx={ox+dw/2} cy={oy+dh} rx={dw/2} ry={ry} fill="#fce7f3" stroke="#ec4899" strokeWidth={1} />
      <rect x={ox} y={oy+ry} width={dw} height={sh} fill="#fbcfe8" opacity={0.7} />
      <text x={ox+dw/2} y={oy+ry+sh-2} textAnchor="middle" fontSize={7} fill="#be185d">SEAL</text>
      <line x1={ox} y1={oy+dh*0.3} x2={ox+dw} y2={oy+dh*0.3} stroke="#ec4899" strokeWidth={0.8} strokeDasharray="2 3" />
      <text x={ox+dw/2} y={oy+dh*0.3-3} textAnchor="middle" fontSize={6} fill="#db2777">PERFORATION</text>
      {lf > 0 && <DimLine x1={ox} y1={oy+dh+ry+14} x2={ox+dw} y2={oy+dh+ry+14} label={`LF:${lf}mm`} color="#ec4899" />}
      {ch > 0 && <DimLine x1={ox-22} y1={oy+ry} x2={ox-22} y2={oy+dh} label={`${ch}mm`} color="#ec4899" />}
      <text x={VW/2} y={VH-8} textAnchor="middle" fontSize={8} fill="#6b7280">Shrink Sleeve</text>
    </svg>
  );
}

// ── Sleeve (printed flat, converted to tube) ──
function SleeveDiagram({ dims }: { dims: DimValues }) {
  // ── Flat unrolled sleeve view (width direction) ──
  // Layflat = SINGLE SIDE width (e.g. 130mm)
  // Full unrolled = lf × 2 = 260mm
  // Zones left→right: [TRANSP] [FRONT = lf mm] [FOLD] [BACK = lf mm] [SEAM]
  // Shrinkage is in LENGTH (height) direction — shown as extra band at bottom
  const lf      = dims.layflatWidth ?? dims.width ?? 0;
  const ch      = dims.cutHeight ?? dims.height ?? 0;
  const seam    = dims.seamingArea     ?? 0;
  const transp  = dims.transparentArea ?? 0;
  const shrink  = dims.widthShrinkage  ?? 0;   // field name kept; value = length shrinkage

  // Width = lf×2 + seam + transp (NO shrink — shrink is in height)
  const fullUnrolled = lf * 2 + seam + transp;
  const totalH  = ch + shrink;  // total height including length shrinkage
  const { dw, dh: baseDH, scale } = scaleToCanvas(fullUnrolled || 200, totalH || 80);
  // dh = the finished cut height portion; shrinkPx = extra height band
  const dh       = totalH > 0 ? (ch / totalH) * baseDH : baseDH;
  const shrinkPx = shrink > 0 ? Math.max((shrink / totalH) * baseDH, 8) : 0;

  const ox = PAD + 4;
  const oy = PAD + 12;

  // pixel widths
  const transpPx = transp > 0 ? Math.max(transp * scale, 7) : 0;
  const seamPx   = seam   > 0 ? Math.max(seam   * scale, 8) : 0;
  // FRONT and BACK each = lf (single side)
  const printPx  = lf > 0 ? lf * scale : Math.max((dw - transpPx - seamPx) / 2, 4);
  const foldX    = ox + transpPx + printPx; // fold line at end of FRONT

  // zone x positions
  const xTransL  = ox;                    // Transparent — LEFT (front edge)
  const xFront   = ox + transpPx;         // Front print area (lf mm wide)
  const xBack    = foldX;                 // Back print area (lf mm wide)
  const xSeamR   = foldX + printPx;       // Seam — RIGHT (back edge)
  // shrink band: bottom of the sleeve (length direction)
  const yShrink  = oy + dh;

  return (
    <svg width={VW} height={VH} className="w-full">
      <defs>
        {/* diagonal hatch for transparent zone */}
        <pattern id="transp-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#94a3b8" strokeWidth="1" opacity="0.5"/>
        </pattern>
        {/* seam pattern */}
        <pattern id="seam-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#dc2626" strokeWidth="1.5" opacity="0.5"/>
        </pattern>
        <marker id="arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <path d="M0,0.5 L4,2.5 L0,4.5 Z" fill="#374151"/>
        </marker>
        <marker id="arr-r" markerWidth="5" markerHeight="5" refX="1" refY="2.5" orient="auto-start-reverse">
          <path d="M0,0.5 L4,2.5 L0,4.5 Z" fill="#374151"/>
        </marker>
      </defs>

      {/* ── TRANSPARENT — LEFT ONLY (front side) ── */}
      {transpPx > 0 && (
        <g>
          <rect x={xTransL} y={oy} width={transpPx} height={dh} fill="url(#transp-hatch)" stroke="#94a3b8" strokeWidth={0.8} />
          {transpPx > 10 && (
            <text x={xTransL + transpPx / 2} y={oy + dh / 2}
              textAnchor="middle" fontSize={6} fill="#64748b" fontWeight="600"
              transform={`rotate(-90,${xTransL + transpPx / 2},${oy + dh / 2})`}>
              TRANSP {transp}mm
            </text>
          )}
        </g>
      )}

      {/* ── FRONT PRINT AREA ── */}
      <rect x={xFront} y={oy} width={printPx} height={dh} fill="#dbeafe" stroke="#3b82f6" strokeWidth={1} />
      {printPx > 16 && dh > 14 && (
        <text x={xFront + printPx / 2} y={oy + dh / 2 + 3}
          textAnchor="middle" fontSize={Math.min(8, printPx / 4)} fill="#1d4ed8" fontWeight="700">
          FRONT
        </text>
      )}

      {/* ── FOLD LINE (centre) ── */}
      <line x1={foldX} y1={oy} x2={foldX} y2={oy + dh}
        stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="5 2" />
      <text x={foldX} y={oy - 4} textAnchor="middle" fontSize={6} fill="#7c3aed" fontWeight="700">FOLD</text>

      {/* ── BACK PRINT AREA ── */}
      <rect x={xBack} y={oy} width={printPx} height={dh} fill="#bfdbfe" stroke="#3b82f6" strokeWidth={1} />
      {printPx > 16 && dh > 14 && (
        <text x={xBack + printPx / 2} y={oy + dh / 2 + 3}
          textAnchor="middle" fontSize={Math.min(8, printPx / 4)} fill="#1e40af" fontWeight="700">
          BACK
        </text>
      )}

      {/* ── SEAM — RIGHT ONLY (back side) ── */}
      {seamPx > 0 && (
        <g>
          <rect x={xSeamR} y={oy} width={seamPx} height={dh} fill="url(#seam-hatch)" stroke="#dc2626" strokeWidth={1} />
          {seamPx > 10 && (
            <text x={xSeamR + seamPx / 2} y={oy + dh / 2}
              textAnchor="middle" fontSize={6} fill="#dc2626" fontWeight="700"
              transform={`rotate(-90,${xSeamR + seamPx / 2},${oy + dh / 2})`}>
              SEAM {seam}mm
            </text>
          )}
        </g>
      )}

      {/* outer border = layflat boundary */}
      <rect x={ox} y={oy} width={dw} height={dh} fill="none" stroke="#2563eb" strokeWidth={1.5} />

      {/* ── SHRINKAGE BAND (bottom — length direction) ── */}
      {shrinkPx > 0 && (
        <g>
          <rect x={ox} y={yShrink} width={dw} height={shrinkPx}
            fill="#f0abfc" fillOpacity={0.65} stroke="#c026d3" strokeWidth={1.2} />
          {Array.from({ length: Math.ceil((dw + shrinkPx) / 5) }).map((_, i) => {
            const off = i * 5;
            const x1 = ox + Math.min(dw, off);
            const y1 = yShrink + Math.max(0, off - dw);
            const x2 = ox + Math.max(0, off - shrinkPx);
            const y2 = yShrink + Math.min(shrinkPx, off);
            return x2 < ox + dw && y1 < yShrink + shrinkPx
              ? <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c026d3" strokeWidth={0.8} opacity={0.5} />
              : null;
          })}
          <text x={ox - 16} y={yShrink + shrinkPx / 2 + 3}
            textAnchor="middle" fontSize={7} fill="#86198f" fontWeight="800">
            +{shrink}
          </text>
          <line x1={ox - 10} y1={yShrink} x2={ox - 10} y2={yShrink + shrinkPx}
            stroke="#c026d3" strokeWidth={1} markerStart="url(#arr-r)" markerEnd="url(#arr)" />
        </g>
      )}

      {/* ── CUT LINES (vertical, left & right edges — full height incl. shrink) ── */}
      <line x1={ox}      y1={oy - 6} x2={ox}      y2={oy + dh + shrinkPx + 6} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" />
      <line x1={ox + dw} y1={oy - 6} x2={ox + dw} y2={oy + dh + shrinkPx + 6} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" />

      {/* ── DIMENSION LINES ── */}
      {/* Design Circ (width) label at top */}
      {lf > 0 && (
        <DimLine x1={ox} y1={oy - 14} x2={ox + dw} y2={oy - 14}
          label={`Design Circ = LF×2${transp>0?`+${transp}T`:""}${seam>0?`+${seam}S`:""} = ${lf*2+transp+seam}mm`} color="#1e40af" />
      )}
      {/* Individual FRONT width arrow */}
      {lf > 0 && printPx > 20 && (
        <DimLine x1={xFront} y1={oy - 26} x2={foldX} y2={oy - 26}
          label={`${lf}mm`} color="#1d4ed8" />
      )}
      {/* Individual BACK width arrow */}
      {lf > 0 && printPx > 20 && (
        <DimLine x1={foldX} y1={oy - 26} x2={xSeamR} y2={oy - 26}
          label={`${lf}mm`} color="#1e40af" />
      )}
      {/* Cutting Length (height) arrow — left side */}
      {ch > 0 && (
        <DimLine x1={ox - 18} y1={oy} x2={ox - 18} y2={oy + dh}
          label={`${ch}mm`} color="#2563eb" />
      )}
      {/* LF×2 bottom dimension */}
      {lf > 0 && (
        <DimLine x1={ox} y1={oy + dh + shrinkPx + 14} x2={ox + dw} y2={oy + dh + shrinkPx + 14}
          label={`LF: ${lf}mm`} color="#2563eb" />
      )}

      <text x={VW / 2} y={VH - 4} textAnchor="middle" fontSize={7} fill="#6b7280">Sleeve — Flat Unrolled View</text>
    </svg>
  );
}

// ── Laminate Roll (multi-ply flat) ──
function LaminateRollDiagram({ dims }: { dims: DimValues }) {
  const w = dims.width ?? 0;
  const h = dims.height ?? 0;
  const { dw, dh, scale } = scaleToCanvas(w, h);
  const ox = (VW - dw) / 2;
  const oy = PAD + 20;
  const plies = 3;
  const plyH = Math.max(dh / plies - 2, 8);
  const colors = ["#e0f2fe", "#fef9c3", "#fce7f3"];
  const strokes = ["#0284c7", "#ca8a04", "#db2777"];
  return (
    <svg width={VW} height={VH} className="w-full">
      <DimOverlays ox={ox} oy={oy} dw={dw} dh={dh} scale={scale} dims={dims} />
      {/* show 3 ply layers side by side */}
      {colors.map((fill, i) => (
        <g key={i}>
          <rect x={ox} y={oy + i * (plyH + 2)} width={dw} height={plyH}
            fill={fill} stroke={strokes[i]} strokeWidth={1.2} rx={1} />
          <text x={ox + dw / 2} y={oy + i * (plyH + 2) + plyH / 2 + 3}
            textAnchor="middle" fontSize={7} fill={strokes[i]} fontWeight="600">
            {i === 0 ? "OUTER FILM" : i === 1 ? "ADHESIVE" : "INNER FILM"}
          </text>
        </g>
      ))}
      {/* roll icon */}
      <ellipse cx={ox - 18} cy={oy + dh / 2} rx={12} ry={Math.min(dh * 0.4, 38)} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1.5} />
      {w > 0 && <DimLine x1={ox} y1={oy + dh + 18} x2={ox + dw} y2={oy + dh + 18} label={`${w}mm`} color="#0369a1" />}
      {h > 0 && <DimLine x1={ox - 30} y1={oy} x2={ox - 30} y2={oy + dh} label={`${h}mm`} color="#0369a1" />}
      <text x={VW / 2} y={VH - 8} textAnchor="middle" fontSize={8} fill="#6b7280">Laminate Roll</text>
    </svg>
  );
}

// ─── Main Diagram Component ───────────────────────────────────────────────────

export type DimensionDiagramProps = {
  contentType: string;
  dims: DimValues;
};

export function DimensionDiagram({ contentType, dims }: DimensionDiagramProps) {
  const cfg = CONTENT_TYPE_CONFIG[contentType];
  if (!cfg) return null;

  const DiagramMap = {
    standup:        StandupDiagram,
    threeside:      ThreeSideDiagram,
    centerseal:     CenterSealDiagram,
    rollform:       RollFormDiagram,
    label:          LabelDiagram,
    shrinksleeve:   ShrinkSleeveDiagram,
    sleeve:         SleeveDiagram,
    laminateroll:   LaminateRollDiagram,
    bothsidegusset: BothSideGussetDiagram,
    flatbottom:     FlatBottomDiagram,
  } as const;

  const Diagram = DiagramMap[cfg.diagramType];

  const hasTrim   = (dims.trimming ?? 0) > 0;
  const hasShrink = (dims.widthShrinkage ?? 0) > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-gradient-to-br from-slate-50 to-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center min-h-[220px]">
        <Diagram dims={dims} />
      </div>
      {/* Legend */}
      {(hasTrim || hasShrink) && (
        <div className="flex flex-wrap gap-2 px-2">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-3 rounded border-2 border-dashed border-orange-500 bg-orange-100 flex-shrink-0" />
            <span className="text-[9px] text-orange-700 font-semibold uppercase tracking-wide">
              Trimming Both Side{hasTrim ? ` (+${dims.trimming}mm)` : ""}
            </span>
          </div>
          {hasShrink && (
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-3 rounded border border-fuchsia-500 bg-fuchsia-200 flex-shrink-0"
                style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 2px, #c026d3 2px, #c026d3 3px)" }} />
              <span className="text-[9px] text-fuchsia-700 font-semibold uppercase tracking-wide">
                {cfg.diagramType === "sleeve"
                  ? `Length Shrinkage (+${dims.widthShrinkage}mm — applied to cutting length)`
                  : `Width Shrinkage (+${dims.widthShrinkage}mm)`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-3 rounded border border-indigo-400 bg-indigo-100 flex-shrink-0" />
            <span className="text-[9px] text-indigo-600 font-semibold uppercase tracking-wide">
              Product Area
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dimension Input Panel ────────────────────────────────────────────────────

export function DimensionInputPanel({
  contentType,
  dims,
  onChange,
  colClasses,
}: {
  contentType: string;
  dims: DimValues;
  onChange: (patch: DimValues) => void;
  colClasses?: string;
}) {
  const cfg = CONTENT_TYPE_CONFIG[contentType];
  if (!cfg) return null;

  const meta: Record<DimField, { placeholder: string; min: number }> = {
    width:           { placeholder: "e.g. 150", min: 1 },
    height:          { placeholder: "e.g. 220", min: 1 },
    gusset:          { placeholder: "e.g. 60",  min: 0 },
    layflatWidth:    { placeholder: "e.g. 130", min: 1 },
    cutHeight:       { placeholder: "e.g. 200", min: 1 },
    sealWidth:       { placeholder: "e.g. 12",  min: 1 },
    seamingArea:     { placeholder: "e.g. 8",   min: 0 },
    transparentArea: { placeholder: "e.g. 5",   min: 0 },
    topSeal:         { placeholder: "e.g. 10",  min: 0 },
    bottomSeal:      { placeholder: "e.g. 8",   min: 0 },
    sideSeal:        { placeholder: "e.g. 10",  min: 0 },
    centerSealWidth: { placeholder: "e.g. 12",  min: 0 },
    sideGusset:      { placeholder: "e.g. 30",  min: 0 },
  };

  const gridClass = colClasses ?? "grid-cols-2 sm:grid-cols-3";

  return (
    <div className={`grid ${gridClass} gap-2`}>
      {cfg.fields.map(field => (
        <div key={field}>
          <label className="text-[10px] font-semibold text-indigo-600 uppercase block mb-1">
            {cfg.labels[field] ?? field}
          </label>
          <input
            type="number"
            min={meta[field].min}
            step={1}
            placeholder={meta[field].placeholder}
            value={dims[field] || ""}
            onChange={e => onChange({ [field]: Number(e.target.value) || 0 })}
            className="w-full text-sm border border-indigo-200 rounded-xl px-3 py-2 bg-indigo-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
          />
        </div>
      ))}
    </div>
  );
}
