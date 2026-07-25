"use client";
import { useState, useEffect, useCallback } from "react";
import TutorialButton from "@/components/ui/TutorialButton";
import { RefreshCw } from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in").replace(/\/$/, "");

function unwrap(v: unknown): unknown {
  let r = v;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

type CylRow = {
  ToolID: string; ToolCode: string; CustomerRefCode: string; CylinderName: string;
  ColorName: string; ColorSeq: string; CylinderType: string; CircumferenceMM: string;
  CylLength: string; PrintWidth: string; RepeatUPS: string; TotalColors: string;
  PurchaseRate: string; EstLifeMeters: string; PrintingArea: string; NonPrintingArea: string;
  VendorName: string; ProductCode: string; ProductMasterID: string; ProductName: string;
  CustomerName: string; CustomerLedgerID: string; CategoryName: string; CategoryID: string;
  CylinderStatus: string; CreatedDate: string;
};

const statusColor = (s: string) => {
  if (s === "Available")    return "bg-green-100 text-green-700";
  if (s === "In Use")       return "bg-blue-100 text-blue-700";
  if (s === "Under Chrome") return "bg-yellow-100 text-yellow-700";
  if (s === "Ordered")      return "bg-purple-100 text-purple-700";
  if (s === "Created")      return "bg-gray-100 text-gray-600";
  return "bg-gray-100 text-gray-500";
};

const columns: Column<CylRow>[] = [
  { key: "ToolCode",        header: "Cyl. Code",    render: r => <span className="font-semibold text-indigo-700 whitespace-nowrap">{r.ToolCode}</span> },
  { key: "CustomerRefCode", header: "Cust. Ref",    render: r => <span className="text-gray-600">{r.CustomerRefCode || "—"}</span> },
  { key: "ProductCode",     header: "Product Code", render: r => <span className="font-medium text-gray-700">{r.ProductCode}</span> },
  { key: "ProductName",     header: "Product Name" },
  { key: "CustomerName",    header: "Customer" },
  {
    key: "CategoryName", header: "Category",
    render: r => <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] font-semibold rounded-full">{r.CategoryName || "—"}</span>,
  },
  {
    key: "ColorName", header: "Color",
    render: r => (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
        style={{ background: `hsl(${Number(r.ColorSeq) * 47 % 360}, 70%, 90%)`, color: `hsl(${Number(r.ColorSeq) * 47 % 360}, 50%, 30%)` }}>
        {r.ColorName || "—"}
      </span>
    ),
  },
  { key: "ColorSeq",          header: "Seq" },
  { key: "CylinderType",      header: "Type" },
  { key: "CircumferenceMM",   header: "Circ (mm)" },
  { key: "CylLength",         header: "Length (mm)" },
  { key: "PrintWidth",        header: "Print W (mm)" },
  { key: "RepeatUPS",         header: "Repeat UPS" },
  { key: "TotalColors",       header: "Colors" },
  {
    key: "PurchaseRate", header: "Rate (₹)",
    render: r => <span className="font-mono">{r.PurchaseRate ? `₹${Number(r.PurchaseRate).toLocaleString("en-IN")}` : "—"}</span>,
  },
  {
    key: "EstLifeMeters", header: "Life (m)",
    render: r => <span className="font-mono">{r.EstLifeMeters ? Number(r.EstLifeMeters).toLocaleString("en-IN") : "—"}</span>,
  },
  { key: "VendorName", header: "Vendor" },
  {
    key: "CylinderStatus", header: "Status",
    render: r => <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(r.CylinderStatus)}`}>{r.CylinderStatus || "—"}</span>,
  },
  { key: "CreatedDate", header: "Date" },
];

export default function CylinderManagementPage() {
  const [cylinders, setCylinders] = useState<CylRow[]>([]);
  const [loading,   setLoading]   = useState(false);

  const loadCylinders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/cylindermasterShrink/getdashboard`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      let raw = await res.json();
      while (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { break; } }
      setCylinders(Array.isArray(raw) ? raw : []);
    } catch { setCylinders([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCylinders(); }, [loadCylinders]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Cylinder Management</h2>
          <p className="text-sm text-gray-500">{cylinders.length} cylinder{cylinders.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <TutorialButton title="Cylinder Management — Tutorial" />
          <Button variant="secondary" size="sm" onClick={loadCylinders}
            icon={<RefreshCw size={13} className={loading ? "animate-spin" : ""} />}>
            Refresh
          </Button>
        </div>
      </div>

      <DataTable
        data={cylinders}
        columns={columns}
        loading={loading}
        title="Cylinders"
      />
    </div>
  );
}
