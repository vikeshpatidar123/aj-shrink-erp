// Certificate of Analysis — A4 PDF. Mirrors the client's COA report:
// company/COA header + job/DN/invoice + PO qty & dispatch qty + Mfg/Expiry/Batch,
// then a Test Parameter | Standard Specification | Result table (RM-QC style).
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const PRIMARY: [number, number, number] = [31, 59, 102];
const INK: [number, number, number] = [30, 40, 55];
const MUTE: [number, number, number] = [110, 120, 132];
const nn = (v: unknown) => (v == null || v === "" ? 0 : Number(v));

export interface CoaReportHeader {
  CoaNo?: string; CoaDate?: string; CompanyName?: string;
  ClientName?: string; JobBookingNo?: string; JobName?: string; CategoryName?: string; ProductCode?: string;
  PONo?: string; PODate?: string; DNNO?: string; DNDate?: string; InvoiceNo?: string; InvoiceDate?: string;
  OrderQuantity?: number; Quantity?: number; PackingDetails?: string;
  MfgDate?: string; ExpiryDate?: string; SpecificationNo?: string; BatchNo?: string; Remark?: string;
}
export interface CoaReportParam {
  TestParaMeterName?: string; SpecificationFieldUnit?: string; Defaults?: string;
}

export function downloadCoa(H: CoaReportHeader, params: CoaReportParam[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210, mL = 12, mR = pageW - 12, innerW = mR - mL;
  let y = 14;

  // ── Title ──────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...INK);
  doc.text("Certificate of Analysis", mL, y);
  if (H.CompanyName) {
    doc.setFontSize(11); doc.setTextColor(...PRIMARY);
    doc.text(H.CompanyName, mR, y, { align: "right" });
  }
  y += 3;
  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.5); doc.line(mL, y, mR, y);
  y += 6;

  // ── Header info grid (2 columns) ───────────────────────────────────────────
  const info: [string, string][] = [
    ["COA No", H.CoaNo || "—"], ["COA Date", H.CoaDate || "—"],
    ["Customer", H.ClientName || "—"], ["Category", H.CategoryName || "—"],
    ["Job No", H.JobBookingNo || "—"], ["Job Name", H.JobName || "—"],
    ["Product Code", H.ProductCode || "—"], ["Batch No", H.BatchNo || H.JobBookingNo || "—"],
    ["DN No", `${H.DNNO || "—"}${H.DNDate ? "  (" + H.DNDate + ")" : ""}`], ["Invoice No", `${H.InvoiceNo || "—"}${H.InvoiceDate ? "  (" + H.InvoiceDate + ")" : ""}`],
    ["PO No", H.PONo || "—"], ["Specification No", H.SpecificationNo || "—"],
    ["PO Quantity", nn(H.OrderQuantity) ? nn(H.OrderQuantity).toLocaleString("en-IN") : "—"],
    ["Dispatch Quantity", nn(H.Quantity) ? nn(H.Quantity).toLocaleString("en-IN") : "—"],
    ["Mfg Date", H.MfgDate || "—"], ["Expiry Date", H.ExpiryDate || "—"],
    ["Packing Details", H.PackingDetails || "—"], ["", ""],
  ];
  doc.setFontSize(8.5);
  const colW = innerW / 2;
  info.forEach((p, i) => {
    if (!p[0]) return;
    const col = i % 2, row = Math.floor(i / 2);
    const x = mL + col * colW, yy = y + row * 5.5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTE); doc.text(p[0] + ":", x, yy);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...INK); doc.text(String(p[1]), x + 32, yy, { maxWidth: colW - 34 });
  });
  y += Math.ceil(info.length / 2) * 5.5 + 3;

  // ── Parameter table ────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [["#", "Test Parameter", "Standard Specification", "Result"]],
    body: params.map((p, i) => [i + 1, p.TestParaMeterName || "—", p.SpecificationFieldUnit || "—", p.Defaults || "—"]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, lineColor: [210, 216, 224], lineWidth: 0.15, textColor: [40, 50, 65] },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 8.5, halign: "left" },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 68 }, 3: { cellWidth: 38 } },
    margin: { left: mL, right: mL },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  if (H.Remark) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(70, 80, 92);
    doc.text("Remark: " + H.Remark, mL, y, { maxWidth: innerW }); y += 8;
  }

  // ── Signatures ─────────────────────────────────────────────────────────────
  y = Math.max(y, 268);
  doc.setDrawColor(180, 188, 198); doc.setLineWidth(0.2);
  doc.line(mL, y, mL + 55, y); doc.line(mR - 55, y, mR, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTE);
  doc.text("Prepared By", mL, y + 4);
  doc.text("Authorised Signatory", mR, y + 4, { align: "right" });
  doc.setFontSize(7); doc.setTextColor(150, 158, 168);
  doc.text("This is a system-generated Certificate of Analysis.", mL, y + 10);

  doc.save(`COA_${H.CoaNo || "COA"}.pdf`);
}
