// Roll QR label PDF generator (client-side).
// Uses qrcode (data URL) + jspdf. One label per roll, laid out as a grid on A4
// so a single roll OR all rolls of a job can be printed/downloaded together.
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export interface RollLabelData {
  BatchNo: string;
  JobName?: string;
  ContentNo?: string;
  ProcessName?: string;
  MachineName?: string;
  OperatorName?: string;
  Quantity?: number;
  RollUnit?: string;
  SpoolID?: string;
  QRCode?: string;
}

const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v));

/** Generate a multi-label A4 PDF and download it directly. */
export async function downloadRollLabels(
  rolls: RollLabelData[],
  opts?: { companyName?: string; fileName?: string },
) {
  if (!rolls || rolls.length === 0) return;
  const companyName = opts?.companyName ?? "";
  const fileName = opts?.fileName ?? (rolls.length === 1 ? `RollQR_${safe(rolls[0].BatchNo)}.pdf` : "RollLabels.pdf");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210, pageH = 297, margin = 8, cols = 2, gap = 4;
  const labelW = (pageW - margin * 2 - gap * (cols - 1)) / cols; // ~93mm
  const labelH = 48;
  const rowsPerPage = Math.floor((pageH - margin * 2 + gap) / (labelH + gap));
  const perPage = cols * rowsPerPage;

  for (let i = 0; i < rolls.length; i++) {
    const r = rolls[i];
    const qrUrl = await QRCode.toDataURL(r.QRCode || r.BatchNo, { margin: 1, width: 256 });
    const pos = i % perPage;
    if (i > 0 && pos === 0) pdf.addPage();
    const col = pos % cols;
    const row = Math.floor(pos / cols);
    const x = margin + col * (labelW + gap);
    const y = margin + row * (labelH + gap);

    // border
    pdf.setDrawColor(200, 200, 200);
    pdf.roundedRect(x, y, labelW, labelH, 2, 2);

    // QR (left)
    const qr = 34;
    pdf.addImage(qrUrl, "PNG", x + 3, y + 3, qr, qr);
    pdf.setFontSize(5.5); pdf.setTextColor(150);
    pdf.text("Scan", x + 3 + qr / 2, y + qr + 5.5, { align: "center" });

    // text (right)
    const tx = x + qr + 7;
    const tw = labelW - qr - 10;
    let ty = y + 6;

    pdf.setTextColor(20, 30, 50);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8);
    const batchLines = pdf.splitTextToSize(r.BatchNo, tw);
    pdf.text(batchLines, tx, ty);
    ty += batchLines.length * 3.3 + 1.5;

    const field = (label: string, val?: string) => {
      if (!val) return;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(5.5); pdf.setTextColor(130, 140, 150);
      pdf.text(label.toUpperCase(), tx, ty);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(30, 40, 55);
      const vl = pdf.splitTextToSize(val, tw);
      pdf.text(vl[0], tx, ty + 3);
      ty += 6.4;
    };
    field("Process", r.ProcessName);
    field("Job / PWO", [r.JobName, r.ContentNo].filter(Boolean).join(" · "));
    field("Qty", `${n(r.Quantity).toLocaleString("en-IN")} ${r.RollUnit || ""}`.trim());
    if (r.MachineName || r.OperatorName) field("Machine / Operator", [r.MachineName, r.OperatorName].filter(Boolean).join(" · "));
    if (r.SpoolID) field("Spool", r.SpoolID);

    if (companyName) {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(5); pdf.setTextColor(150);
      pdf.text(companyName, x + labelW - 3, y + labelH - 2.5, { align: "right" });
    }
  }

  pdf.save(fileName);
}

function safe(s: string) { return (s || "roll").replace(/[^\w.-]+/g, "_"); }
