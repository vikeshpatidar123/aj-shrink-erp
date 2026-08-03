// GST Tax Invoice — A4 PDF. Mirrors a standard Indian tax invoice:
// company letterhead + GSTIN/PAN, Bill-To | Ship-To (with GSTIN), line table with per-line
// CGST/SGST/IGST, additional-charge rows, HSN-wise tax summary, totals, amount-in-words,
// bank details + terms (+ export ports). Source: api/invoiceShrink/printdata/{id}.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const PRIMARY: [number, number, number] = [31, 59, 102];
const INK: [number, number, number] = [30, 40, 55];
const MUTE: [number, number, number] = [110, 120, 132];
const nn = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
const m2 = (v: unknown) => nn(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const q0 = (v: unknown) => { const n = nn(v); return n === 0 ? "" : n.toLocaleString("en-IN", { maximumFractionDigits: 3 }); };

export interface TaxInvoiceLine {
  ProductCode?: string; JobName?: string; HSNCode?: string; Quantity?: number; RateType?: string; Rate?: number;
  DiscountAmount?: number; BasicAmount?: number; GSTPercentage?: number;
  CGSTAmount?: number; SGSTAmount?: number; IGSTAmount?: number; NetAmount?: number;
}
export interface TaxInvoiceCharge {
  LedgerName?: string; HSNCode?: string; Amount?: number; GSTPercentage?: number;
  CGSTAmount?: number; SGSTAmount?: number; IGSTAmount?: number; TotalAmount?: number;
}
export interface TaxInvoiceHsn {
  HSNCode?: string; Taxable?: number; CGST?: number; SGST?: number; IGST?: number; TaxTotal?: number;
}
export interface TaxInvoiceData {
  Header: {
    VoucherNo?: string; VoucherDate?: string; InvoiceType?: string; ReverseCharge?: string; IsExport?: string;
    CurrencyCode?: string; AmountInWords?: string; Narration?: string; OtherRemarks?: string;
    VehicleNo?: string; TransporterName?: string; EWayBillNumber?: string; Destination?: string;
    DeliveryTerms?: string; PaymentTerms?: string; LoadingPort?: string; DischargePort?: string; BankerName?: string;
    TotalBasicAmount?: number; TotalCGST?: number; TotalSGST?: number; TotalIGST?: number; TotalTax?: number;
    RoundOffTax?: number; NetAmount?: number; TotalQuantity?: number;
    CompanyName?: string; CompanyGstin?: string; CompanyPan?: string; CompanyState?: string;
    CompanyAddress?: string; CompanyPincode?: string; CompanyBank?: string;
    CustomerName?: string; CustomerAddress?: string; CustomerGstin?: string;
    ConsigneeName?: string; ConsigneeAddress?: string; ConsigneeGstin?: string;
  };
  Lines: TaxInvoiceLine[];
  Charges: TaxInvoiceCharge[];
  HsnSummary: TaxInvoiceHsn[];
}

export function downloadTaxInvoice(d: TaxInvoiceData) {
  const H = d.Header || {};
  const lines = d.Lines || [];
  const charges = d.Charges || [];
  const hsn = d.HsnSummary || [];
  const isInter = nn(H.TotalIGST) > 0;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210, mL = 10, mR = pageW - 10, innerW = mR - mL;
  let y = 12;

  // ── Company letterhead ─────────────────────────────────────────────────────
  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.3); doc.rect(mL, y, innerW, 22);
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...PRIMARY);
  doc.text(H.CompanyName || "Company", mL + 3, y + 6);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...INK);
  const cAddr = [H.CompanyAddress, H.CompanyPincode].filter(Boolean).join(" - ");
  doc.text(doc.splitTextToSize(cAddr || "", innerW * 0.6), mL + 3, y + 11);
  doc.setFont("helvetica", "bold");
  doc.text(`GSTIN: ${H.CompanyGstin || "—"}    PAN: ${H.CompanyPan || "—"}    State: ${H.CompanyState || "—"}`, mL + 3, y + 19);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...PRIMARY);
  doc.text("TAX INVOICE", mR - 3, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTE);
  doc.text(H.InvoiceType || "", mR - 3, y + 10.5, { align: "right" });
  doc.text(`Reverse Charge: ${H.ReverseCharge === "Y" ? "Yes" : "No"}`, mR - 3, y + 14.5, { align: "right" });
  y += 22;

  // ── Invoice meta strip ─────────────────────────────────────────────────────
  doc.setDrawColor(...PRIMARY); doc.rect(mL, y, innerW, 8);
  doc.setFontSize(8);
  const strip = (lbl: string, val: string, x: number) => {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTE); doc.text(lbl, x, y + 5.2);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...INK); doc.text(val || "—", x + doc.getTextWidth(lbl) + 1.5, y + 5.2);
  };
  strip("Invoice No:", H.VoucherNo || "", mL + 3);
  strip("Date:", H.VoucherDate || "", mL + 62);
  strip("E-Way:", H.EWayBillNumber || "—", mL + 105);
  strip("Vehicle:", H.VehicleNo || "—", mL + 150);
  y += 8;

  // ── Bill-To | Ship-To ──────────────────────────────────────────────────────
  const colW = innerW / 2, boxH = 26;
  const party = (x: number, label: string, name?: string, address?: string, gstin?: string) => {
    doc.setDrawColor(...PRIMARY); doc.rect(x, y, colW, boxH);
    doc.setFillColor(238, 242, 248); doc.rect(x, y, colW, 5.5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...PRIMARY);
    doc.text(label, x + 2.5, y + 3.8);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
    doc.text(name || "—", x + 2.5, y + 9.5, { maxWidth: colW - 5 });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(70, 80, 92);
    doc.text(doc.splitTextToSize(address || "", colW - 5).slice(0, 3), x + 2.5, y + 14, { maxWidth: colW - 5 });
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...INK);
    doc.text("GSTIN: " + (gstin || "—"), x + 2.5, y + boxH - 2.5);
  };
  party(mL, "BILL TO (Buyer)", H.CustomerName, H.CustomerAddress, H.CustomerGstin);
  party(mL + colW, "SHIP TO (Consignee)", H.ConsigneeName || H.CustomerName, H.ConsigneeAddress || H.CustomerAddress, H.ConsigneeGstin || H.CustomerGstin);
  y += boxH + 2;

  // ── Line + charge table ────────────────────────────────────────────────────
  const taxHead = isInter ? ["IGST"] : ["CGST", "SGST"];
  const head = ["#", "Particulars", "HSN", "Qty", "Rate", "Disc", "Taxable", ...taxHead, "Amount"];
  const body: (string | number)[][] = lines.map((l, i) => {
    const taxCells = isInter ? [m2(l.IGSTAmount)] : [m2(l.CGSTAmount), m2(l.SGSTAmount)];
    return [i + 1, l.ProductCode || l.JobName || "—", l.HSNCode || "", q0(l.Quantity), m2(l.Rate), m2(l.DiscountAmount), m2(l.BasicAmount), ...taxCells, m2(l.NetAmount)];
  });
  charges.forEach((c) => {
    const taxCells = isInter ? [m2(c.IGSTAmount)] : [m2(c.CGSTAmount), m2(c.SGSTAmount)];
    body.push(["", (c.LedgerName || "Charge") + " (charge)", c.HSNCode || "", "", "", "", m2(c.Amount), ...taxCells, m2(c.TotalAmount)]);
  });
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.4, lineColor: [210, 216, 224], lineWidth: 0.12, textColor: [40, 50, 65] },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "center" },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" }, 1: { cellWidth: isInter ? 52 : 42 }, 2: { cellWidth: 16, halign: "center" },
      3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" },
      [head.length - 2]: { halign: "right" }, [head.length - 1]: { halign: "right" },
    },
    margin: { left: mL, right: mL },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 3;

  // ── HSN tax summary + totals (side by side) ────────────────────────────────
  const halfW = innerW / 2 - 2;
  const summaryStartY = y;
  autoTable(doc, {
    startY: y,
    head: [isInter ? ["HSN", "Taxable", "IGST"] : ["HSN", "Taxable", "CGST", "SGST"]],
    body: hsn.map(h => isInter
      ? [h.HSNCode || "—", m2(h.Taxable), m2(h.IGST)]
      : [h.HSNCode || "—", m2(h.Taxable), m2(h.CGST), m2(h.SGST)]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.2, lineColor: [210, 216, 224], lineWidth: 0.12 },
    headStyles: { fillColor: [238, 242, 248], textColor: INK, fontStyle: "bold", fontSize: 7 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    tableWidth: halfW, margin: { left: mL },
  });

  // Totals box (right half)
  const tx = mL + innerW / 2 + 2, tw = halfW;
  let ty = summaryStartY;
  const totRow = (lbl: string, val: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(bold ? 9 : 8);
    doc.setTextColor(bold ? PRIMARY[0] : MUTE[0], bold ? PRIMARY[1] : MUTE[1], bold ? PRIMARY[2] : MUTE[2]);
    doc.text(lbl, tx + 2, ty + 4);
    doc.setTextColor(...INK); doc.text(val, tx + tw - 2, ty + 4, { align: "right" });
    ty += bold ? 6 : 5;
  };
  doc.setDrawColor(...PRIMARY); doc.rect(tx, summaryStartY, tw, 40);
  totRow("Taxable Value", m2(H.TotalBasicAmount));
  if (isInter) totRow("IGST", m2(H.TotalIGST));
  else { totRow("CGST", m2(H.TotalCGST)); totRow("SGST", m2(H.TotalSGST)); }
  totRow("Total Tax", m2(H.TotalTax));
  if (nn(H.RoundOffTax) !== 0) totRow("Round Off", m2(H.RoundOffTax));
  ty += 1; doc.setDrawColor(210, 216, 224); doc.line(tx, ty, tx + tw, ty); ty += 1;
  totRow("NET AMOUNT", "Rs. " + m2(H.NetAmount), true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = Math.max((doc as any).lastAutoTable.finalY, summaryStartY + 40) + 4;

  // ── Amount in words ────────────────────────────────────────────────────────
  doc.setDrawColor(210, 216, 224); doc.rect(mL, y, innerW, 8);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTE);
  doc.text("Amount in words:", mL + 2, y + 5);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
  doc.text(H.AmountInWords || "—", mL + 32, y + 5, { maxWidth: innerW - 34 });
  y += 10;

  // ── Bank + terms + export ──────────────────────────────────────────────────
  doc.setFontSize(7.5);
  const note = (lbl: string, val?: string) => {
    if (!val) return;
    doc.setFont("helvetica", "bold"); doc.setTextColor(...MUTE); doc.text(lbl, mL + 2, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(val, innerW - 40), mL + 2 + doc.getTextWidth(lbl) + 1.5, y);
    y += 4.5;
  };
  note("Bank: ", H.CompanyBank);
  note("Delivery Terms: ", H.DeliveryTerms);
  note("Payment Terms: ", H.PaymentTerms);
  if (H.IsExport === "Y") note("Ports: ", [H.LoadingPort, H.DischargePort].filter(Boolean).join(" → "));
  note("Remark: ", H.Narration || H.OtherRemarks);

  // ── Signature ──────────────────────────────────────────────────────────────
  y = Math.max(y, 275);
  doc.setDrawColor(180, 188, 198); doc.setLineWidth(0.2); doc.line(mR - 55, y, mR, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTE);
  doc.text("For " + (H.CompanyName || "Company"), mR, y - 1, { align: "right" });
  doc.setFontSize(7.5); doc.text("Authorised Signatory", mR, y + 4, { align: "right" });
  doc.text("E. & O.E. — Subject to jurisdiction.", mL, y + 4);

  doc.save(`Invoice_${H.VoucherNo || "INV"}.pdf`);
}

// ── Indian-system amount in words (INR) ──────────────────────────────────────
export function amountInWords(amount: number): string {
  const num = Math.round(amount);
  if (num === 0) return "Rupees Zero Only";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number): string => n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
  const three = (n: number): string => {
    const h = Math.floor(n / 100), r = n % 100;
    return (h ? a[h] + " Hundred" + (r ? " " : "") : "") + (r ? two(r) : "");
  };
  let n = num, out = "";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) out += three(crore) + " Crore ";
  if (lakh) out += three(lakh) + " Lakh ";
  if (thousand) out += three(thousand) + " Thousand ";
  if (n) out += three(n);
  return "Rupees " + out.trim().replace(/\s+/g, " ") + " Only";
}
