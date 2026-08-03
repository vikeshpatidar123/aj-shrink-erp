// Spool slip PDF (slitting only). One slip per slit roll showing the LANE letter
// (A, B, C…) large and prominent — the operator just needs to know which spool this
// is — plus a QR + batch + qty. Modeled on reference ProductionSpoolSlipsPDF (44pt lane).
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export interface SpoolSlipData {
  BatchNo: string;
  Quantity?: number;
  RollUnit?: string;
  SpoolID?: string;   // "{base}/{lane}" — slip shows only the lane letter
  QRCode?: string;
}

const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v));

// SpoolID is "{base}/{lane}"; show only the trailing lane letter (A/B/C…).
export const spoolLane = (spoolId?: string | null) => {
  const id = String(spoolId ?? "").trim();
  if (!id) return "";
  return id.split("/").pop() || "";
};

/** Generate an A4 spool-slip PDF (2×2 grid, big lane letter) and download it. */
export async function downloadSpoolSlips(
  rolls: SpoolSlipData[],
  opts?: { companyName?: string; fileName?: string },
) {
  const slips = (rolls || []).filter((r) => r.SpoolID);
  if (slips.length === 0) return;
  const companyName = opts?.companyName ?? "";
  const fileName = opts?.fileName ?? "SpoolSlips.pdf";

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210, pageH = 297, margin = 10, cols = 2, gap = 6;
  const slipW = (pageW - margin * 2 - gap * (cols - 1)) / cols; // ~89mm
  const slipH = 128;
  const rowsPerPage = Math.floor((pageH - margin * 2 + gap) / (slipH + gap));
  const perPage = cols * rowsPerPage;

  for (let i = 0; i < slips.length; i++) {
    const r = slips[i];
    const lane = spoolLane(r.SpoolID);
    const qrUrl = await QRCode.toDataURL(r.QRCode || r.SpoolID || r.BatchNo, { margin: 1, width: 256 });
    const pos = i % perPage;
    if (i > 0 && pos === 0) pdf.addPage();
    const col = pos % cols;
    const row = Math.floor(pos / cols);
    const x = margin + col * (slipW + gap);
    const y = margin + row * (slipH + gap);

    // frame
    pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.5);
    pdf.roundedRect(x, y, slipW, slipH, 3, 3);

    // header band
    pdf.setFillColor(30, 41, 59);
    pdf.roundedRect(x, y, slipW, 12, 3, 3, "F");
    pdf.rect(x, y + 6, slipW, 6, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(255, 255, 255);
    pdf.text("SPOOL", x + slipW / 2, y + 8, { align: "center" });

    // BIG lane letter
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(72); pdf.setTextColor(17, 24, 39);
    pdf.text(lane || "—", x + slipW / 2, y + 46, { align: "center" });

    // QR
    const qr = 30;
    pdf.addImage(qrUrl, "PNG", x + (slipW - qr) / 2, y + 54, qr, qr);

    // batch + qty
    let ty = y + 54 + qr + 7;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(30, 40, 55);
    const batchLines = pdf.splitTextToSize(r.BatchNo, slipW - 8);
    pdf.text(batchLines, x + slipW / 2, ty, { align: "center" });
    ty += batchLines.length * 3.6 + 2;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(60, 70, 85);
    pdf.text(`${n(r.Quantity).toLocaleString("en-IN")} ${r.RollUnit || ""}`.trim(), x + slipW / 2, ty, { align: "center" });

    if (companyName) {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(6); pdf.setTextColor(150);
      pdf.text(companyName, x + slipW / 2, y + slipH - 3, { align: "center" });
    }
  }

  pdf.save(fileName);
}
