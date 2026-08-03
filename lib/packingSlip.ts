// QC & Packing — packing slip (A4) + carton labels (QR) PDF.
// Built from a saved FG voucher (VoucherID -50) header + its CFC lines.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

const PRIMARY: [number, number, number] = [44, 93, 138];
const nn = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
const fmt = (v: unknown) => nn(v).toLocaleString("en-IN");

export interface PackingSlipRow {
  Boxes: number; BundlesPerBox: number; QtyPerPack: string;
  TotalQty: number; QCApproved: number; QCRejected: number; QCHold: number;
  Weight: number; Length: number; Width: number; Height: number;
  CFT: number; TotalCFT: number; Batch: string; Description: string; Pallet?: string;
}
export interface PackingSlipData {
  VoucherNo?: string; VoucherDate?: string; JobBookingNo?: string; JobName?: string;
  Client?: string; PONo?: string; CheckedBy?: string; CompanyName?: string;
  Rows: PackingSlipRow[];
}

/** A4 packing slip: voucher header + per-CFC lines + QC + totals. */
export function downloadPackingSlip(d: PackingSlipData) {
  const rows = d.Rows || [];
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210, mL = 12;
  let y = 16;

  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(30, 40, 55);
  doc.text("QC & Packing Slip", mL, y);
  if (d.CompanyName) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120, 130, 140);
    doc.text(d.CompanyName, pageW - mL, y, { align: "right" });
  }
  y += 3;
  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.5); doc.line(mL, y, pageW - mL, y);
  y += 7;

  const kv: [string, string][] = [
    ["Voucher No", d.VoucherNo || "—"], ["Date", d.VoucherDate || new Date().toLocaleDateString("en-IN")],
    ["Job Card", d.JobBookingNo || "—"], ["Client", d.Client || "—"],
    ["Product / Job", d.JobName || "—"], ["PO No", d.PONo || "—"],
    ["Checked By", d.CheckedBy || "—"], ["", ""],
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
  y += Math.ceil(kv.length / 2) * 6.5 + 3;

  autoTable(doc, {
    startY: y,
    head: [["#", "Pallet", "Batch", "Boxes", "Bdl/Box", "Qty", "Appr", "Rej", "Hold", "Wt/Box", "L×W×H", "Tot CFT"]],
    body: rows.map((r, i) => [
      i + 1, r.Pallet || "—", r.Batch || "—", fmt(r.Boxes), fmt(r.BundlesPerBox), fmt(r.TotalQty),
      fmt(r.QCApproved), fmt(r.QCRejected), fmt(r.QCHold), nn(r.Weight).toFixed(2),
      `${nn(r.Length)}×${nn(r.Width)}×${nn(r.Height)}`, nn(r.TotalCFT).toFixed(3),
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, lineColor: [225, 230, 236], lineWidth: 0.1, textColor: [40, 50, 65] },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 8, halign: "center" },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    columnStyles: { 0: { cellWidth: 8, halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" }, 9: { halign: "right" }, 11: { halign: "right" } },
    margin: { left: mL, right: mL },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  const tBoxes = rows.reduce((s, r) => s + nn(r.Boxes), 0);
  const tQty = rows.reduce((s, r) => s + nn(r.TotalQty), 0);
  const tApp = rows.reduce((s, r) => s + nn(r.QCApproved), 0);
  const tRej = rows.reduce((s, r) => s + nn(r.QCRejected), 0);
  const tHold = rows.reduce((s, r) => s + nn(r.QCHold), 0);
  const tWt = rows.reduce((s, r) => s + nn(r.Weight) * nn(r.Boxes), 0);
  const tCFT = rows.reduce((s, r) => s + nn(r.TotalCFT), 0);
  doc.setDrawColor(225, 230, 236); doc.line(mL, y - 3, pageW - mL, y - 3);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(35, 45, 60);
  doc.text(`Boxes: ${fmt(tBoxes)}    Total Qty: ${fmt(tQty)}    Approved: ${fmt(tApp)}    Rejected: ${fmt(tRej)}    Hold: ${fmt(tHold)}    Wt: ${tWt.toFixed(2)}    CFT: ${tCFT.toFixed(3)}`, mL, y + 1);

  y += 16;
  doc.setFontSize(9); doc.setTextColor(60, 70, 85);
  doc.text("Checked / QC: ______________________", mL, y);
  doc.text("Store / Received: ______________________", pageW - mL, y, { align: "right" });

  doc.save(`PackingSlip_${d.VoucherNo || "slip"}.pdf`);
}

/** Per-carton labels (QR + voucher/job/batch/qty + box sequence n/total). */
export async function downloadCartonLabels(d: PackingSlipData) {
  const rows = d.Rows || [];
  const totalBoxes = rows.reduce((s, r) => s + nn(r.Boxes), 0);
  if (totalBoxes === 0) return;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210, pageH = 297, margin = 8, cols = 2, gap = 4;
  const labelW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const labelH = 52;
  const rowsPerPage = Math.floor((pageH - margin * 2 + gap) / (labelH + gap));
  const perPage = cols * rowsPerPage;

  let idx = 0, seq = 0;
  for (const r of rows) {
    const qtyPerBox = nn(r.Boxes) > 0 ? Math.round(nn(r.TotalQty) / nn(r.Boxes)) : nn(r.TotalQty);
    for (let b = 0; b < nn(r.Boxes); b++) {
      seq++;
      const payload = `{"v":1,"vn":"${d.VoucherNo || ""}","bx":${seq},"of":${totalBoxes},"bt":"${r.Batch || ""}"}`;
      const qrUrl = await QRCode.toDataURL(payload, { margin: 1, width: 220 });
      const pos = idx % perPage;
      if (idx > 0 && pos === 0) pdf.addPage();
      const col = pos % cols, row = Math.floor(pos / cols);
      const x = margin + col * (labelW + gap);
      const yy = margin + row * (labelH + gap);
      idx++;

      pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.4);
      pdf.roundedRect(x, yy, labelW, labelH, 2, 2);
      const qr = 30;
      pdf.addImage(qrUrl, "PNG", x + 3, yy + 3, qr, qr);

      const tx = x + qr + 6;
      let ty = yy + 7;
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(17, 24, 39);
      pdf.text(`CARTON ${seq}/${totalBoxes}`, tx, ty); ty += 6;
      const field = (label: string, val: string) => {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(5.5); pdf.setTextColor(130, 140, 150);
        pdf.text(label.toUpperCase(), tx, ty);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(30, 40, 55);
        pdf.text(val, tx, ty + 3, { maxWidth: labelW - qr - 9 } as never); ty += 6.6;
      };
      field("Voucher", d.VoucherNo || "—");
      field("Job / Client", [d.JobBookingNo, d.Client].filter(Boolean).join(" · ") || "—");
      field("Batch", r.Batch || "—");
      field("Qty / Box", fmt(qtyPerBox));

      pdf.setFont("helvetica", "normal"); pdf.setFontSize(5); pdf.setTextColor(150);
      pdf.text(d.JobName || "", x + labelW - 3, yy + labelH - 2.5, { align: "right" });
    }
  }
  pdf.save(`CartonLabels_${d.VoucherNo || "labels"}.pdf`);
}
