"use client";
import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckSquare, Square } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Input, Select } from "@/components/ui/Input";

type Artwork = {
  ArtworkID: string; ArtworkNo: string; ClientArtWorkNo: string;
  ArtWorkName: string; ArtWorkDescription: string; ArtWorkCost: number;
  LedgerID: string; ClientName: string; SalesEmployee: string;
  CategoryID: string; CategoryName: string;
  ReceivedDate: string; ExpectedCompletionDate: string;
  ArtWorkType: string;
};
type ArtProcess = {
  ArtworkDetailID: string; ArtworkID: string; ProcessID: string;
  DisplayProcessName: string; Status: string;
};
type ProcessMaster = { ProcessID: string; ProcessName: string };
type Employee = { LedgerID: string; LedgerName: string };

const STATUS_CLS: Record<string, string> = {
  Complete:     "bg-green-100 text-green-700 border-green-200",
  PartComplete: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Hold:         "bg-orange-100 text-orange-700 border-orange-200",
  Approved:     "bg-blue-100 text-blue-700 border-blue-200",
  Rejected:     "bg-red-100 text-red-700 border-red-200",
  Rework:       "bg-purple-100 text-purple-700 border-purple-200",
  Running:      "bg-cyan-100 text-cyan-700 border-cyan-200",
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
    <div className="bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 text-xs text-gray-700 min-h-[30px]">{value || "—"}</div>
  </div>
);

const SectionTitle = ({ title }: { title: string }) => (
  <div className="text-[10px] font-bold text-[#582222] tracking-widest uppercase mb-3 flex items-center gap-2">
    <div className="h-px flex-1 bg-[#42909A]/30" />
    {title}
    <div className="h-px flex-1 bg-[#42909A]/30" />
  </div>
);

export default function ManagerTabPage() {
  const [artworks, setArtworks]   = useState<Artwork[]>([]);
  const [processes, setProcesses] = useState<ProcessMaster[]>([]);
  const [allEmps, setAllEmps]     = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(false);

  const [selected, setSelected]   = useState<Artwork | null>(null);
  const [artProcs, setArtProcs]   = useState<ArtProcess[]>([]);
  const [selPIDs, setSelPIDs]     = useState<Set<string>>(new Set());
  const [savingProc, setSavingProc] = useState(false);

  const [selProc, setSelProc]     = useState<ArtProcess | null>(null);
  const [mgStatus, setMgStatus]   = useState("");
  const [mgEmp, setMgEmp]         = useState("");
  const [mgStart, setMgStart]     = useState("");
  const [mgEnd, setMgEnd]         = useState("");
  const [mgRemark, setMgRemark]   = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [artRes, dropRes] = await Promise.all([
        apiGet<Artwork[]>("api/artworkManagement/list"),
        apiGet<Record<string, string>>("api/artworkManagement/dropdowns"),
      ]);
      setArtworks(Array.isArray(artRes) ? artRes : []);
      try { const p = JSON.parse(dropRes["processes"]); setProcesses(Array.isArray(p) ? p : []); } catch { /* */ }
      try { const e = JSON.parse(dropRes["allEmployees"]); setAllEmps(Array.isArray(e) ? e : []); } catch { /* */ }
    } catch { /* offline */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selectArtwork = async (row: Artwork) => {
    setSelected(row); setSelProc(null);
    setMgStatus(""); setMgEmp(""); setMgStart(""); setMgEnd(""); setMgRemark("");
    try {
      const r = await apiGet<ArtProcess[]>(`api/artworkManagement/processes/${row.ArtworkID}`);
      if (!Array.isArray(r)) { setArtProcs([]); setSelPIDs(new Set()); return; }
      setArtProcs(r);
      setSelPIDs(new Set(r.map(p => p.ProcessID)));
    } catch { setArtProcs([]); setSelPIDs(new Set()); }
  };

  const togglePID = (pid: string) =>
    setSelPIDs(prev => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });

  const assignProcesses = async () => {
    if (!selected) return;
    setSavingProc(true);
    try {
      const res = await apiPost<string>("api/artworkManagement/saveProcesses", { ArtworkID: selected.ArtworkID, ProcessIDs: Array.from(selPIDs) });
      if (typeof res === "string" && res.includes("Error")) { alert(res); return; }
      const r = await apiGet<ArtProcess[]>(`api/artworkManagement/processes/${selected.ArtworkID}`);
      setArtProcs(Array.isArray(r) ? r : []);
      alert("Processes assigned successfully.");
    } catch (e: unknown) { alert("Error: " + (e instanceof Error ? e.message : e)); }
    finally { setSavingProc(false); }
  };

  const saveStatus = async (statusOverride: string) => {
    if (!selProc) { alert("Select a process row"); return; }
    setSavingStatus(true);
    try {
      const res = await apiPost<string>("api/artworkManagement/saveProcessStatus", {
        ArtworkDetailID: selProc.ArtworkDetailID, ArtworkID: selProc.ArtworkID,
        ProcessID: selProc.ProcessID, Status: statusOverride, LedgerID: mgEmp,
        StartTime: mgStart.replace("T", " "), EndTime: mgEnd.replace("T", " "), Remark: mgRemark,
      });
      if (typeof res === "string" && res.includes("Error")) { alert(res); return; }
      const r = await apiGet<ArtProcess[]>(`api/artworkManagement/processes/${selProc.ArtworkID}`);
      setArtProcs(Array.isArray(r) ? r : []);
      setSelProc(null); setMgStatus(""); setMgEmp(""); setMgStart(""); setMgEnd(""); setMgRemark("");
    } catch (e: unknown) { alert("Error: " + (e instanceof Error ? e.message : e)); }
    finally { setSavingStatus(false); }
  };

  return (
    <div className="flex gap-0" style={{ height: "calc(100vh - 120px)", minHeight: 0 }}>
      {/* ── Left: Artwork List ─────────────────────────────────────────────── */}
      <div className="flex flex-col border-r border-gray-200" style={{ width: 320, minWidth: 0 }}>
        <div className="flex items-center justify-between px-4 py-3 bg-[#42909A] text-white flex-shrink-0">
          <div>
            <div className="font-bold text-sm">Manager Tab</div>
            <div className="text-[10px] text-white/70">Select artwork to manage</div>
          </div>
          <button onClick={loadData} className="p-1 rounded hover:bg-white/20 transition-colors">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {artworks.map((row, i) => (
            <button key={row.ArtworkID} onClick={() => selectArtwork(row)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${selected?.ArtworkID === row.ArtworkID ? "bg-teal-50 border-l-4 border-l-[#42909A]" : i % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/60 hover:bg-gray-100"}`}>
              <div className="font-bold text-xs text-[#42909A]">{row.ArtworkNo}</div>
              <div className="text-xs font-medium text-gray-700 mt-0.5 truncate">{row.ArtWorkName}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{row.ClientName} · {row.CategoryName}</div>
            </button>
          ))}
          {artworks.length === 0 && <div className="px-4 py-8 text-center text-xs text-gray-400">No artworks found</div>}
        </div>
      </div>

      {/* ── Right: Detail Panel ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {selected ? (
          <div className="flex flex-col gap-0">
            {/* Artwork's Description */}
            <div className="bg-white border-b border-gray-200 p-4">
              <SectionTitle title="Artwork's Description" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoRow label="Artwork No"          value={selected.ArtworkNo} />
                <InfoRow label="Client Artwork No"   value={selected.ClientArtWorkNo} />
                <InfoRow label="Product Name"        value={selected.ArtWorkName} />
                <InfoRow label="Artwork Description" value={selected.ArtWorkDescription} />
                <InfoRow label="Client"              value={selected.ClientName} />
                <InfoRow label="Category"            value={selected.CategoryName} />
                <InfoRow label="Design Cost"         value={`₹${Number(selected.ArtWorkCost).toLocaleString()}`} />
                <InfoRow label="Sales Rep"           value={selected.SalesEmployee} />
                <InfoRow label="Received"            value={selected.ReceivedDate} />
                <InfoRow label="Due Date"            value={selected.ExpectedCompletionDate} />
              </div>
            </div>

            <div className="flex gap-0 flex-1">
              {/* For Task Allocation */}
              <div className="flex flex-col bg-white border-r border-gray-200 p-4" style={{ width: "50%" }}>
                <SectionTitle title="For Task Allocation — Assign Processes" />
                <div className="flex-1 overflow-y-auto flex flex-col gap-1 mb-3" style={{ maxHeight: "35vh" }}>
                  {processes.map(p => {
                    const assigned = artProcs.find(ap => ap.ProcessID === p.ProcessID);
                    const checked  = selPIDs.has(p.ProcessID);
                    return (
                      <button key={p.ProcessID} onClick={() => togglePID(p.ProcessID)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-xs transition-all ${checked ? "bg-teal-50 border-[#42909A] text-[#42909A]" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                        {checked ? <CheckSquare size={14} className="text-[#42909A] flex-shrink-0" /> : <Square size={14} className="text-gray-300 flex-shrink-0" />}
                        <span className="flex-1 text-left font-medium">{p.ProcessName}</span>
                        {assigned?.Status && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${STATUS_CLS[assigned.Status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>{assigned.Status}</span>
                        )}
                      </button>
                    );
                  })}
                  {processes.length === 0 && <div className="text-xs text-gray-400 py-4 text-center">No processes in master</div>}
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button onClick={assignProcesses} disabled={savingProc}
                    className="flex-1 py-2 text-xs font-bold rounded-lg bg-[#42909A] text-white hover:bg-[#357a84] disabled:opacity-50 transition-colors">
                    {savingProc ? "Assigning…" : "Assign Processes"}
                  </button>
                  <button onClick={() => setSelPIDs(new Set())}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                    Clear
                  </button>
                </div>
              </div>

              {/* For Designer — Status Update */}
              <div className="flex flex-col bg-white p-4" style={{ width: "50%" }}>
                <SectionTitle title="For Designer — Status Update" />
                {/* Process list */}
                <div className="flex flex-col gap-1 mb-3" style={{ maxHeight: "18vh", overflowY: "auto" }}>
                  {artProcs.map(p => (
                    <button key={p.ArtworkDetailID} onClick={() => { setSelProc(p); setMgStatus(""); setMgEmp(""); setMgStart(""); setMgEnd(""); setMgRemark(""); }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${selProc?.ArtworkDetailID === p.ArtworkDetailID ? "bg-[#42909A] text-white border-[#42909A]" : "bg-white border-gray-200 hover:border-[#42909A] hover:bg-teal-50 text-gray-700"}`}>
                      <span className="font-medium">{p.DisplayProcessName}</span>
                      {p.Status
                        ? <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${selProc?.ArtworkDetailID === p.ArtworkDetailID ? "bg-white/20 text-white border-white/30" : STATUS_CLS[p.Status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>{p.Status}</span>
                        : <span className={`text-[9px] ${selProc?.ArtworkDetailID === p.ArtworkDetailID ? "text-white/50" : "text-gray-300"}`}>Pending</span>}
                    </button>
                  ))}
                  {artProcs.length === 0 && <div className="text-xs text-gray-400 py-2 text-center">No processes assigned yet — use Task Allocation first</div>}
                </div>

                {/* Status form */}
                {selProc ? (
                  <>
                    <div className="flex flex-col gap-2 mb-3">
                      <Select label="Employee" value={mgEmp} onChange={e => setMgEmp(e.target.value)}
                        options={[{ value: "", label: "— Select —" }, ...allEmps.map(e => ({ value: e.LedgerID, label: e.LedgerName }))]} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="Start Time" type="datetime-local" value={mgStart} onChange={e => setMgStart(e.target.value)} />
                        <Input label="End Time"   type="datetime-local" value={mgEnd}   onChange={e => setMgEnd(e.target.value)} />
                      </div>
                      <Input label="Remark" value={mgRemark} onChange={e => setMgRemark(e.target.value)} />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      {[
                        { label: "Approve", status: "Approved", cls: "bg-slate-600  hover:bg-slate-700  text-white border border-slate-700" },
                        { label: "Reject",  status: "Rejected", cls: "bg-red-500    hover:bg-red-600    text-white border border-red-600" },
                        { label: "Hold",    status: "Hold",     cls: "bg-orange-500 hover:bg-orange-600 text-white border border-orange-600" },
                        { label: "Rework",  status: "Rework",   cls: "bg-purple-600 hover:bg-purple-700 text-white border border-purple-700" },
                        { label: savingStatus ? "Saving…" : "Save", status: mgStatus || "Complete", cls: "bg-[#42909A] hover:bg-[#357a84] text-white border border-[#357a84]" },
                      ].map(b => (
                        <button key={b.status} onClick={() => saveStatus(b.status)} disabled={savingStatus}
                          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${b.cls}`}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-gray-400 border border-dashed rounded-lg py-8">
                    Click a process to update status
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 h-full">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <RefreshCw size={24} className="text-gray-300" />
            </div>
            <div className="text-sm font-medium">Select an artwork from the list</div>
            <div className="text-xs">Click any artwork to assign processes or update status</div>
          </div>
        )}
      </div>
    </div>
  );
}
