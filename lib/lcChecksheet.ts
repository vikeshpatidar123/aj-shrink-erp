// Line Clearance checksheet (A4 PDF). The saved LC parameters + their filled Result
// for one production/process, plus header fields (Job/Content/Machine/Operator/Process/
// LC No/Date). Built client-side from the LC form data. jspdf + jspdf-autotable.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const PRIMARY: [number, number, number] = [44, 93, 138];

export interface LcChecksheet {
  Title?: string;
  VoucherLabel?: string;
  JobCardNo?: string;
  ContentNo?: string;
  ProcessName?: string;
  MachineName?: string;
  OperatorName?: string;
  LcNo?: string;
  CompanyName?: string;
  Params: Array<{ ParameterName: string; StandardValue: string; Result: string }>;
}

export function downloadLcChecksheet(d: LcChecksheet) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210, mL = 14;
  let y = 16;

  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(30, 40, 55);
  doc.text(d.Title || "Line Clearance Checksheet", mL, y);
  if (d.CompanyName) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120, 130, 140);
    doc.text(d.CompanyName, pageW - mL, y, { align: "right" });
  }
  y += 3;
  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.5); doc.line(mL, y, pageW - mL, y);
  y += 7;

  const kv: [string, string][] = [
    [d.VoucherLabel || "LC No", d.LcNo || "—"], ["Date", new Date().toLocaleString("en-IN")],
    ["Job Card", d.JobCardNo || "—"], ["Content", d.ContentNo || "—"],
    ["Process", d.ProcessName || "—"], ["Machine", d.MachineName || "—"],
    ["Operator", d.OperatorName || "—"], ["", ""],
  ];
  doc.setFontSize(9);
  const colW = (pageW - mL * 2) / 2;
  kv.forEach((pair, i) => {
    if (!pair[0]) return;
    const col = i % 2, row = Math.floor(i / 2);
    const x = mL + col * colW, yy = y + row * 6.5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(130, 140, 150);
    doc.text(pair[0] + ":", x, yy);
    doc.setFont("helvetica", "bold"); doc.setTextColor(35, 45, 60);
    doc.text(String(pair[1]), x + 26, yy, { maxWidth: colW - 28 });
  });
  y += Math.ceil(kv.length / 2) * 6.5 + 4;

  autoTable(doc, {
    startY: y,
    head: [["#", "Parameter", "Standard", "Result"]],
    body: (d.Params || []).map((p, i) => [i + 1, p.ParameterName || "—", p.StandardValue || "—", p.Result || "—"]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, lineColor: [225, 230, 236], lineWidth: 0.1, textColor: [40, 50, 65] },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 8.5, halign: "left" },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    columnStyles: { 0: { cellWidth: 10, halign: "center" }, 3: { cellWidth: 40 } },
    margin: { left: mL, right: mL },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 18;

  // signatures
  doc.setFontSize(9); doc.setTextColor(60, 70, 85);
  doc.text("Operator: ______________________", mL, y);
  doc.text("QC / Supervisor: ______________________", pageW - mL, y, { align: "right" });

  doc.save(`LineClearance_${d.LcNo || d.JobCardNo || "checksheet"}.pdf`);
}
