"use client";
import { useState, useEffect, useCallback } from "react";
import { Cylinder, Loader2, RefreshCw } from "lucide-react";
import { authHeaders } from "@/lib/auth";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in").replace(/\/$/, "");

function unwrap(v: unknown): unknown {
  let r = v;
  while (typeof r === "string") { try { r = JSON.parse(r); } catch { break; } }
  return r;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return unwrap(await res.json()) as T;
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

export default function CylinderManagementPage() {
  const [cylinders,      setCylinders]      = useState<CylRow[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [cylSearch,      setCylSearch]      = useState("");
  const [cylCustFilter,  setCylCustFilter]  = useState("");
  const [cylCatFilter,   setCylCatFilter]   = useState("");
  const [cylTypeFilter,  setCylTypeFilter]  = useState("");
  const [cylStatusFilter,setCylStatusFilter]= useState("");

  const loadCylinders = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await apiFetch<CylRow[]>(`${BASE}/api/cylindermasterShrink/getdashboard`);
      setCylinders(Array.isArray(raw) ? raw : []);
    } catch { setCylinders([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCylinders(); }, [loadCylinders]);

  // Unique filter options
  const uniqueCusts    = [...new Set(cylinders.map(r => r.CustomerName).filter(Boolean))].sort();
  const uniqueCats     = [...new Set(cylinders.map(r => r.CategoryName).filter(Boolean))].sort();
  const uniqueTypes    = [...new Set(cylinders.map(r => r.CylinderType).filter(Boolean))].sort();
  const uniqueStatuses = [...new Set(cylinders.map(r => r.CylinderStatus).filter(Boolean))].sort();

  const filtered = cylinders.filter(r => {
    const q = cylSearch.toLowerCase();
    const matchSearch = !q ||
      r.ToolCode?.toLowerCase().includes(q) ||
      r.CustomerRefCode?.toLowerCase().includes(q) ||
      r.ProductCode?.toLowerCase().includes(q) ||
      r.ProductName?.toLowerCase().includes(q) ||
      r.ColorName?.toLowerCase().includes(q) ||
      r.VendorName?.toLowerCase().includes(q);
    return matchSearch &&
      (!cylCustFilter    || r.CustomerName  === cylCustFilter) &&
      (!cylCatFilter     || r.CategoryName  === cylCatFilter) &&
      (!cylTypeFilter    || r.CylinderType  === cylTypeFilter) &&
      (!cylStatusFilter  || r.CylinderStatus=== cylStatusFilter);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Cylinder Management</h2>
          <p className="text-sm text-gray-500">{cylinders.length} cylinder{cylinders.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={loadCylinders}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <input value={cylSearch} onChange={e => setCylSearch(e.target.value)}
            placeholder="Search code, product, color…"
            className="col-span-2 md:col-span-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
          <select value={cylCustFilter} onChange={e => setCylCustFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
            <option value="">All Customers</option>
            {uniqueCusts.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={cylCatFilter} onChange={e => setCylCatFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
            <option value="">All Categories</option>
            {uniqueCats.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={cylTypeFilter} onChange={e => setCylTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
            <option value="">All Types</option>
            {uniqueTypes.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={cylStatusFilter} onChange={e => setCylStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
            <option value="">All Statuses</option>
            {uniqueStatuses.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-400 mt-2">{filtered.length} cylinder{filtered.length !== 1 ? "s" : ""} found</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Cylinder size={36} className="mb-3 text-gray-300" />
            <p className="text-sm">No cylinders found.</p>
          </div>
        ) : (
          <table className="w-full text-sm min-w-[1200px]">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                {["Cyl. Code","Cust. Ref","Product Code","Product Name","Customer","Category",
                  "Color","Seq","Type","Circ (mm)","Length (mm)","Print W (mm)",
                  "Repeat UPS","Colors","Rate (₹)","Life (m)","Vendor","Status","Date"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.ToolID} className={`border-t border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/40"}`}>
                  <td className="px-3 py-2.5 font-semibold text-indigo-700 whitespace-nowrap">{r.ToolCode}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.CustomerRefCode || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-700 font-medium whitespace-nowrap">{r.ProductCode}</td>
                  <td className="px-3 py-2.5 text-gray-800 max-w-[160px] truncate" title={r.ProductName}>{r.ProductName || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.CustomerName || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] font-semibold rounded-full">{r.CategoryName || "—"}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: `hsl(${Number(r.ColorSeq) * 47 % 360}, 70%, 90%)`, color: `hsl(${Number(r.ColorSeq) * 47 % 360}, 50%, 30%)` }}>
                      {r.ColorName || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-500">{r.ColorSeq}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">{r.CylinderType || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">{r.CircumferenceMM}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">{r.CylLength}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">{r.PrintWidth}</td>
                  <td className="px-3 py-2.5 text-center text-gray-700">{r.RepeatUPS}</td>
                  <td className="px-3 py-2.5 text-center text-gray-700">{r.TotalColors}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                    {r.PurchaseRate ? `₹${Number(r.PurchaseRate).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                    {r.EstLifeMeters ? `${Number(r.EstLifeMeters).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">{r.VendorName || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(r.CylinderStatus)}`}>
                      {r.CylinderStatus || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{r.CreatedDate || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
