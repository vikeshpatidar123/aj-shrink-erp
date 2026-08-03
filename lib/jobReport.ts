// Completed job-card production report (A4 PDF) — per-process actuals
// (schedule/production/wastage/consumed) + material allocated/issued.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { apiGet } from "@/lib/api";

const API = "api/productionModule";
const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
const fmt = (v: unknown) => n(v).toLocaleString("en-IN");
const PRIMARY: [number, number, number] = [44, 93, 138];

interface JobReport {
  Header: {
    JobBookingNo?: string; Client?: string; Product?: string; ContentNo?: string; PlanContName?: string;
    OrderQuantity?: number; JobBookingDate?: string; DeliveryDate?: string;
  };
  Processes: Array<{ SequenceNo: number; ProcessName: string; MachineName: string; OperatorName: string; Status: string; ScheduleQty: number; ProductionQty: number; WastageQty: number; ConsumedQty: number; FromTime: string; ToTime: string; }>;
  Materials: Array<{ ItemName: string; BatchNo: string; RequiredQty: number; IssuedQty: number; StockUnit: string; }>;
  CompanyName?: string;
}

export async function downloadJobReport(contentId: number) {
  const rep = await apiGet<JobReport>(`${API}/jobreport/${contentId}`);
  if (!rep || typeof rep !== "object" || !rep.Header) throw new Error("No report data");
  const H = rep.Header;
  const procs = Array.isArray(rep.Processes) ? rep.Processes : [];
  const mats = Array.isArray(rep.Materials) ? rep.Materials : [];

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210, mL = 14;
  let y = 16;

  // ── Title ────────────────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(30, 40, 55);
  doc.text("Production Report", mL, y);
  if (rep.CompanyName) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120, 130, 140);
    doc.text(rep.CompanyName, pageW - mL, y, { align: "right" });
  }
  y += 3;
  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.5); doc.line(mL, y, pageW - mL, y);
  y += 7;

  // ── Header key/values (2 columns) ────────────────────────
  const kv: [string, string][] = [
    ["Job Card", H.JobBookingNo || "—"], ["Client", H.Client || "—"],
    ["Product", H.Product || "—"], ["Content", `${H.ContentNo || ""}${H.PlanContName ? " · " + H.PlanContName : ""}` || "—"],
    ["Schedule Qty", fmt(H.OrderQuantity)], ["Booking Date", H.JobBookingDate || "—"],
    ["Delivery Date", H.DeliveryDate || "—"], ["Printed", new Date().toLocaleString("en-IN")],
  ];
  doc.setFontSize(9);
  const colW = (pageW - mL * 2) / 2;
  kv.forEach((pair, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = mL + col * colW, yy = y + row * 6.5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(130, 140, 150);
    doc.text(pair[0] + ":", x, yy);
    doc.setFont("helvetica", "bold"); doc.setTextColor(35, 45, 60);
    doc.text(String(pair[1]), x + 30, yy, { maxWidth: colW - 32 });
  });
  y += Math.ceil(kv.length / 2) * 6.5 + 4;

  // ── Process-wise production ──────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...PRIMARY);
  doc.text("Process-wise Production", mL, y);
  autoTable(doc, {
    startY: y + 2,
    head: [["#", "Process", "Machine", "Operator", "Sched Qty", "Production", "Wastage", "Consumed", "Status"]],
    body: procs.map((p) => [
      n(p.SequenceNo), p.ProcessName || "—", p.MachineName || "—", p.OperatorName || "—",
      fmt(p.ScheduleQty), fmt(p.ProductionQty), fmt(p.WastageQty), fmt(p.ConsumedQty), p.Status || "—",
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, lineColor: [225, 230, 236], lineWidth: 0.1, textColor: [40, 50, 65] },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 8, halign: "left" },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    columnStyles: { 0: { cellWidth: 8, halign: "center" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
    margin: { left: mL, right: mL },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 9;

  // ── Material allocated / issued ──────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...PRIMARY);
  doc.text("Material Allocated / Issued", mL, y);
  autoTable(doc, {
    startY: y + 2,
    head: [["Material", "Batch", "Required", "Issued", "Unit"]],
    body: mats.length
      ? mats.map((m) => [m.ItemName || "—", m.BatchNo || "—", fmt(m.RequiredQty), fmt(m.IssuedQty), m.StockUnit || ""])
      : [["No material issued", "", "", "", ""]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, lineColor: [225, 230, 236], lineWidth: 0.1, textColor: [40, 50, 65] },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 8, halign: "left" },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "center", cellWidth: 16 } },
    margin: { left: mL, right: mL },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 9;

  // ── Totals ───────────────────────────────────────────────
  const totProd = procs.reduce((s, p) => s + n(p.ProductionQty), 0);
  const totWaste = procs.reduce((s, p) => s + n(p.WastageQty), 0);
  const totConsumed = procs.reduce((s, p) => s + n(p.ConsumedQty), 0);
  const totIssued = mats.reduce((s, m) => s + n(m.IssuedQty), 0);
  doc.setDrawColor(225, 230, 236); doc.line(mL, y - 3, pageW - mL, y - 3);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(35, 45, 60);
  doc.text(
    `Total Production: ${totProd.toLocaleString("en-IN")}     Total Wastage: ${totWaste.toLocaleString("en-IN")}     Total Consumed: ${totConsumed.toLocaleString("en-IN")}     Total Issued: ${totIssued.toLocaleString("en-IN")}`,
    mL, y + 1,
  );

  doc.save(`ProductionReport_${H.JobBookingNo || contentId}.pdf`);
}
