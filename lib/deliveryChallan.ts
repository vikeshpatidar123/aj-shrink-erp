// Delivery Note / Dispatch Challan — A4 PDF.
// Mirrors the flexo client's printed Delivery Note (DeliveryNotePrintformat):
// letterhead + BILLING | SHIPPING band (name / composite address / GSTIN) + job-wise line table
// (SR | PO No | PO Date | Job Name | Customer Part Code | ERP No. | No. of Boxes | Total Quantity)
// + Total row + Remark + Created By. It is a quantity challan — NO rate / tax / money.
// Source: api/dispatchShrink/challandata/{fgId}.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

const PRIMARY: [number, number, number] = [31, 59, 102];
const INK: [number, number, number] = [30, 40, 55];
const MUTE: [number, number, number] = [110, 120, 132];
const nn = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
const qty = (v: unknown) => { const n = nn(v); return n === 0 ? "" : n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); };

export interface ChallanLine {
  PoNo?: string; PoDate?: string; JobName?: string; PartCode?: string; ErpNo?: string;
  Boxes?: number; Quantity?: number;
}
export interface ChallanData {
  Header: {
    VoucherNo?: string; VoucherDate?: string; CompanyName?: string;
    CustomerName?: string; CustomerAddress?: string; CustomerGstin?: string;
    ConsigneeName?: string; ConsigneeAddress?: string; ConsigneeGstin?: string;
    TransporterName?: string; VehicleNo?: string; ModeOfTransport?: string; PODNo?: string;
    Remark?: string; CreatedBy?: string; TotalBoxes?: number; TotalQuantity?: number;
  };
  Lines: ChallanLine[];
}

export async function downloadDeliveryChallan(d: ChallanData, fgId?: number) {
  const H = d.Header || {};
  const lines = d.Lines || [];
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210, mL = 12, mR = pageW - 12, innerW = mR - mL;
  let y = 14;

  // ── Letterhead ───────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...PRIMARY);
  doc.text(H.CompanyName || "Company", mL, y);
  // Gate QR (top-right) — DN identity, scanned at the gate before the vehicle leaves.
  try {
    const payload = JSON.stringify({ v: 1, t: "dn", id: fgId ?? 0, vno: H.VoucherNo || "" });
    const url = await QRCode.toDataURL(payload, { margin: 0, width: 120 });
    doc.addImage(url, "PNG", mR - 20, y - 9, 20, 20);
  } catch { /* QR is best-effort */ }
  y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
  doc.text("DELIVERY NOTE", mL, y);
  y += 2.5;
  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.6); doc.line(mL, y, mR, y);
  y += 6;

  // ── DN no / date ─────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTE); doc.text("Delivery Note No:", mL, y);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...INK); doc.text(H.VoucherNo || "—", mL + 30, y);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTE); doc.text("Date:", mL + 110, y);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...INK); doc.text(H.VoucherDate || "—", mL + 122, y);
  y += 5;

  // ── BILLING | SHIPPING band ──────────────────────────────────────────────
  const colW = innerW / 2, boxH = 30;
  const party = (x: number, label: string, name?: string, address?: string, gstin?: string) => {
    doc.setDrawColor(200, 208, 218); doc.setLineWidth(0.25); doc.rect(x, y, colW, boxH);
    doc.setFillColor(238, 242, 248); doc.rect(x, y, colW, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...PRIMARY);
    doc.text(label, x + 2.5, y + 4);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...INK);
    doc.text(name || "—", x + 2.5, y + 10.5, { maxWidth: colW - 5 });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(70, 80, 92);
    const addrLines = doc.splitTextToSize(address || "", colW - 5).slice(0, 4);
    doc.text(addrLines, x + 2.5, y + 15, { maxWidth: colW - 5 });
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.8); doc.setTextColor(...INK);
    doc.text("GSTIN: " + (gstin || "—"), x + 2.5, y + boxH - 3);
  };
  party(mL, "BILLING DETAILS", H.CustomerName, H.CustomerAddress, H.CustomerGstin);
  party(mL + colW, "SHIPPING DETAILS", H.ConsigneeName || H.CustomerName, H.ConsigneeAddress || H.CustomerAddress, H.ConsigneeGstin || H.CustomerGstin);
  y += boxH;

  // ── Transport strip ──────────────────────────────────────────────────────
  doc.setDrawColor(200, 208, 218); doc.rect(mL, y, innerW, 7);
  doc.setFontSize(8);
  const tp = (lbl: string, val: string, x: number) => {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTE); doc.text(lbl, x, y + 4.6);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...INK); doc.text(val || "—", x + doc.getTextWidth(lbl) + 1.5, y + 4.6);
  };
  tp("Transporter:", H.TransporterName || "", mL + 2);
  tp("Vehicle No:", H.VehicleNo || "", mL + 78);
  tp("Mode:", H.ModeOfTransport || "", mL + 138);
  y += 7 + 3;

  // ── Job-wise line table ──────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [["SR", "PO No", "PO Date", "Job Name", "Customer Part Code", "ERP No.", "No. of Boxes", "Total Quantity"]],
    body: lines.map((l, i) => [
      i + 1, l.PoNo || "", l.PoDate || "", l.JobName || "", l.PartCode || "", l.ErpNo || "",
      l.Boxes ? String(l.Boxes) : "", qty(l.Quantity),
    ]),
    foot: [[
      { content: "Total", colSpan: 6, styles: { halign: "right", fontStyle: "bold" } },
      { content: String(H.TotalBoxes || lines.reduce((s, l) => s + nn(l.Boxes), 0)), styles: { halign: "right", fontStyle: "bold" } },
      { content: qty(H.TotalQuantity || lines.reduce((s, l) => s + nn(l.Quantity), 0)), styles: { halign: "right", fontStyle: "bold" } },
    ]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, lineColor: [210, 216, 224], lineWidth: 0.15, textColor: [40, 50, 65] },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 8, halign: "center" },
    footStyles: { fillColor: [238, 242, 248], textColor: INK, lineColor: [210, 216, 224], lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" }, 5: { halign: "center" },
      6: { cellWidth: 22, halign: "right" }, 7: { cellWidth: 26, halign: "right" },
    },
    margin: { left: mL, right: mL },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Remark ───────────────────────────────────────────────────────────────
  if (H.Remark) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(70, 80, 92);
    doc.text("Remark: " + H.Remark, mL, y, { maxWidth: innerW });
    y += 6;
  }

  // ── Footer: Created By / signatory ───────────────────────────────────────
  y = Math.max(y, 262);
  doc.setFontSize(8); doc.setTextColor(...MUTE);
  doc.setFont("helvetica", "normal");
  doc.text("Created By: ", mL, y);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
  doc.text(H.CreatedBy || "—", mL + doc.getTextWidth("Created By: "), y);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTE);
  doc.text("For " + (H.CompanyName || "Company"), mR, y, { align: "right" });
  y += 12;
  doc.setDrawColor(180, 188, 198); doc.setLineWidth(0.2);
  doc.line(mR - 55, y, mR, y);
  doc.setFontSize(7.5); doc.text("Authorised Signatory", mR, y + 4, { align: "right" });

  doc.save(`Challan_${H.VoucherNo || "DN"}.pdf`);
}
