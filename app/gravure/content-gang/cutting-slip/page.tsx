"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";

type DetailRow = {
  GangWorkOrderNo: string; PrimaryJobBookingNo: string;
  PrimaryJobBookingJobCardContentsNo: string;
  ClientName: string; JobName: string; PlanContName: string;
  SalesOrderNo: string; OrderQuantity: number;
  GangUps: number; ExpectedJCQty: number; ExpectedReqFullSheets: number;
  TotalRequiredRunningMeter: number; TotalRequiredSquareMeter: number;
  TotalRollWeightInKg: number; TotalUps: number; PrimaryJobUps: number;
  ProductMasterCode: string; PCodeAWCode: string; TransID: number;
  JobBookingNo: string;
};

type GangPlan = {
  GangWorkOrderNo: string; Quality: string; TotalGSM: number;
  PrimaryJobName: string; PrimaryClientName: string;
  UpsL: number; UpsW: number; TotalUps: number; PrimaryJobUps: number;
  CylinderCircumferenceInch: number; CylinderCircumferenceMM: number;
  GangDate: string; CreatedBy: string; SecondaryJobCount: number;
  PrimaryJobBookingNo: string; PrimaryJobBookingJobCardContentsNo: string;
};

function CuttingSlipContent() {
  const searchParams = useSearchParams();
  const gangNo = searchParams.get("gangNo") ?? "";

  const [plan, setPlan]       = useState<GangPlan | null>(null);
  const [rows, setRows]       = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!gangNo) { setError("Gang No. not provided."); setLoading(false); return; }
    (async () => {
      try {
        const [plans, detail] = await Promise.all([
          apiGet<GangPlan[]>("api/gravure/contentGang/gang-list"),
          apiGet<DetailRow[]>(`api/gravure/contentGang/gang-detail/${encodeURIComponent(gangNo)}`),
        ]);
        const found = Array.isArray(plans) ? plans.find(p => p.GangWorkOrderNo === gangNo) : null;
        if (!found) { setError("Gang plan not found."); setLoading(false); return; }
        setPlan(found);
        setRows(Array.isArray(detail) ? detail : []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
  }, [gangNo]);

  // Auto print once loaded
  useEffect(() => {
    if (!loading && plan && rows.length > 0) {
      setTimeout(() => window.print(), 400);
    }
  }, [loading, plan, rows]);

  const totalGangUps    = rows.reduce((s, r) => s + r.GangUps, 0);
  const totalQty        = rows.reduce((s, r) => s + r.OrderQuantity, 0);
  const totalRunMtr     = rows.reduce((s, r) => s + (r.TotalRequiredRunningMeter || 0), 0);
  const totalReqSheets  = rows.reduce((s, r) => s + r.ExpectedReqFullSheets, 0);

  if (loading) return (
    <div style={{ fontFamily: "Arial, sans-serif", textAlign: "center", padding: "60px", color: "#555" }}>
      Loading cutting slip…
    </div>
  );
  if (error || !plan) return (
    <div style={{ fontFamily: "Arial, sans-serif", textAlign: "center", padding: "60px", color: "red" }}>
      {error || "Unable to load cutting slip."}
    </div>
  );

  const now = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .no-print { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 4px 6px; }
        th { background: #1a3a6b; color: #fff; font-size: 10px; text-align: center; }
        td { text-align: center; vertical-align: middle; }
        td.left { text-align: left; }
        .header-box { border: 2px solid #1a3a6b; padding: 8px 12px; margin-bottom: 6px; }
        .slip-title { font-size: 16px; font-weight: bold; color: #1a3a6b; text-align: center; letter-spacing: 1px; }
        .sub-title { font-size: 11px; text-align: center; color: #555; margin-bottom: 8px; }
        .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px; }
        .info-item { border: 1px solid #ccc; padding: 4px 8px; border-radius: 3px; }
        .info-label { font-size: 9px; color: #666; text-transform: uppercase; font-weight: bold; }
        .info-value { font-size: 12px; font-weight: bold; color: #1a3a6b; }
        .primary-box { background: #eef3fb; border: 1px solid #1a3a6b; border-radius: 4px; padding: 6px 10px; margin-bottom: 6px; }
        .footer-row td { background: #f0f0f0; font-weight: bold; }
        .sign-section { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 20px; }
        .sign-box { border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 10px; }
      `}</style>

      {/* Print button — hidden on print */}
      <div className="no-print" style={{ background: "#1a3a6b", padding: "10px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>Cutting Slip Preview</span>
        <button onClick={() => window.print()}
          style={{ background: "#fff", color: "#1a3a6b", border: "none", borderRadius: 6,
            padding: "6px 20px", fontWeight: "bold", cursor: "pointer", fontSize: 13 }}>
          🖨 Print
        </button>
        <button onClick={() => window.close()}
          style={{ background: "transparent", color: "#fff", border: "1px solid #fff",
            borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 12 }}>
          Close
        </button>
      </div>

      <div style={{ padding: "12px 16px", maxWidth: 1050, margin: "0 auto" }}>

        {/* Company header */}
        <div className="header-box">
          <div className="slip-title">AJ SHRINK PVT LTD</div>
          <div className="sub-title">Roto Gravure Content Gang Cutting Slip</div>
        </div>

        {/* Gang info grid */}
        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">Gang No.</div>
            <div className="info-value">{plan.GangWorkOrderNo}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Gang Date</div>
            <div className="info-value">{plan.GangDate}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Print Date</div>
            <div className="info-value">{now}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Created By</div>
            <div className="info-value">{plan.CreatedBy}</div>
          </div>
        </div>

        {/* Primary job box */}
        <div className="primary-box">
          <table style={{ width: "100%", border: "none" }}>
            <tbody>
              <tr>
                <td style={{ border: "none", width: "33%" }}>
                  <span style={{ color: "#666", fontSize: 9, fontWeight: "bold" }}>PRIMARY JOB CARD: </span>
                  <span style={{ fontSize: 12, fontWeight: "bold", color: "#1a3a6b" }}>
                    {plan.PrimaryJobBookingJobCardContentsNo}
                  </span>
                </td>
                <td style={{ border: "none", width: "33%" }}>
                  <span style={{ color: "#666", fontSize: 9, fontWeight: "bold" }}>JOB NAME: </span>
                  <span style={{ fontSize: 11, fontWeight: "bold" }}>{plan.PrimaryJobName}</span>
                </td>
                <td style={{ border: "none", width: "34%" }}>
                  <span style={{ color: "#666", fontSize: 9, fontWeight: "bold" }}>CLIENT: </span>
                  <span style={{ fontSize: 11, fontWeight: "bold" }}>{plan.PrimaryClientName}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Film + Ups info */}
        <div className="info-grid" style={{ gridTemplateColumns: "repeat(6,1fr)", marginBottom: 8 }}>
          <div className="info-item">
            <div className="info-label">Film Quality</div>
            <div className="info-value">{plan.Quality}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Total GSM</div>
            <div className="info-value">{plan.TotalGSM}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Across Ups</div>
            <div className="info-value">{plan.UpsL}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Around Ups</div>
            <div className="info-value">{plan.UpsW}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Total Ups</div>
            <div className="info-value">{plan.TotalUps}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Primary Job Ups</div>
            <div className="info-value">{plan.PrimaryJobUps}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Cyl. Circum. (in)</div>
            <div className="info-value">{plan.CylinderCircumferenceInch}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Cyl. Circum. (mm)</div>
            <div className="info-value">{plan.CylinderCircumferenceMM}</div>
          </div>
          <div className="info-item" style={{ gridColumn: "span 2" }}>
            <div className="info-label">Booking No (Primary)</div>
            <div className="info-value">{plan.PrimaryJobBookingNo}</div>
          </div>
          <div className="info-item" style={{ gridColumn: "span 2" }}>
            <div className="info-label">Secondary Jobs</div>
            <div className="info-value">{plan.SecondaryJobCount}</div>
          </div>
        </div>

        {/* Gang details table */}
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th style={{ width: 110 }}>JC No. / Booking No</th>
              <th>Client</th>
              <th>Job Name</th>
              <th>Content</th>
              <th style={{ width: 90 }}>SO No.</th>
              <th style={{ width: 65 }}>Order Qty</th>
              <th style={{ width: 55 }}>Gang Ups</th>
              <th style={{ width: 65 }}>Exp. JC Qty</th>
              <th style={{ width: 70 }}>Req. Sheets</th>
              <th style={{ width: 70 }}>Run. Mtr</th>
              <th style={{ width: 65 }}>Sq. Mtr</th>
              <th style={{ width: 65 }}>Roll Wt (kg)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.TransID}>
                <td>{i + 1}</td>
                <td className="left" style={{ fontWeight: "bold", color: "#1a3a6b" }}>
                  {r.JobBookingNo}
                </td>
                <td className="left">{r.ClientName}</td>
                <td className="left">{r.JobName}</td>
                <td className="left">{r.PlanContName}</td>
                <td className="left">{r.SalesOrderNo}</td>
                <td style={{ textAlign: "right" }}>{r.OrderQuantity?.toLocaleString()}</td>
                <td style={{ textAlign: "right", fontWeight: "bold", color: "#1a3a6b" }}>{r.GangUps}</td>
                <td style={{ textAlign: "right" }}>{r.ExpectedJCQty?.toLocaleString()}</td>
                <td style={{ textAlign: "right" }}>{r.ExpectedReqFullSheets}</td>
                <td style={{ textAlign: "right" }}>{r.TotalRequiredRunningMeter?.toFixed(2)}</td>
                <td style={{ textAlign: "right" }}>{r.TotalRequiredSquareMeter?.toFixed(2)}</td>
                <td style={{ textAlign: "right" }}>{r.TotalRollWeightInKg?.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="footer-row">
              <td colSpan={5} style={{ textAlign: "right", fontWeight: "bold" }}>TOTAL</td>
              <td></td>
              <td style={{ textAlign: "right" }}>{totalQty.toLocaleString()}</td>
              <td style={{ textAlign: "right" }}>{totalGangUps}</td>
              <td></td>
              <td style={{ textAlign: "right" }}>{totalReqSheets}</td>
              <td style={{ textAlign: "right" }}>{totalRunMtr.toFixed(2)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>

        {/* Ups summary */}
        <div style={{ marginTop: 10, border: "1px solid #ccc", borderRadius: 4, padding: "6px 12px",
          background: "#f9f9f9", display: "flex", gap: 40, fontSize: 11 }}>
          <span><b>Primary Job Ups:</b> {plan.PrimaryJobUps}</span>
          <span><b>Gang Ups Total:</b> {totalGangUps}</span>
          <span><b>Total Ups:</b> {plan.TotalUps}</span>
          <span style={{ color: plan.PrimaryJobUps + totalGangUps === plan.TotalUps ? "green" : "red", fontWeight: "bold" }}>
            {plan.PrimaryJobUps + totalGangUps === plan.TotalUps ? "✓ Ups Balanced" : "✗ Ups Mismatch!"}
          </span>
        </div>

        {/* Signature section */}
        <div className="sign-section">
          <div className="sign-box">Prepared By</div>
          <div className="sign-box">Production Supervisor</div>
          <div className="sign-box">QC</div>
          <div className="sign-box">Manager</div>
        </div>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 9, color: "#888" }}>
          Printed on {now} · AJ Shrink Pvt Ltd · Gravure Roto Content Gang Planning System
        </div>
      </div>
    </>
  );
}

export default function CuttingSlipPage() {
  return (
    <Suspense fallback={
      <div style={{ fontFamily: "Arial, sans-serif", textAlign: "center", padding: "60px", color: "#555" }}>
        Loading…
      </div>
    }>
      <CuttingSlipContent />
    </Suspense>
  );
}
