"use client";
import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ChevronRight } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Input, Select, Textarea } from "@/components/ui/Input";

type Artwork = {
  ArtworkID: string; ArtworkNo: string; ClientArtWorkNo: string;
  ArtWorkName: string; ArtWorkDescription: string;
  LedgerID: string; ClientName: string;
  CategoryID: string; CategoryName: string;
  ReceivedDate: string; ExpectedCompletionDate: string;
};
type ArtProcess = {
  ArtworkDetailID: string; ArtworkID: string; ProcessID: string;
  DisplayProcessName: string; Status: string;
};
type Employee = { LedgerID: string; LedgerName: string };

const STATUS_CLS: Record<string, string> = {
  Complete:     "bg-green-100 text-green-700 border-green-200",
  PartComplete: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Hold:         "bg-orange-100 text-orange-700 border-orange-200",
  Running:      "bg-cyan-100 text-cyan-700 border-cyan-200",
  Approve:      "bg-blue-100 text-blue-700 border-blue-200",
};

function timeDiffMins(s: string, e: string) {
  try {
    const diff = (new Date(e).getTime() - new Date(s).getTime()) / 60000;
    return isNaN(diff) || diff < 0 ? "" : String(Math.round(diff));
  } catch { return ""; }
}

export default function DesignerTabPage() {
  const [artworks, setArtworks]   = useState<Artwork[]>([]);
  const [allEmps, setAllEmps]     = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<Artwork | null>(null);
  const [processes, setProcesses] = useState<ArtProcess[]>([]);
  const [selProc, setSelProc]     = useState<ArtProcess | null>(null);
  const [employee, setEmployee]   = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime]     = useState("");
  const [dsInput, setDsInput]     = useState("");
  const [remark, setRemark]       = useState("");
  const [saving, setSaving]       = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [artRes, dropRes] = await Promise.all([
        apiGet<Artwork[]>("api/artworkManagement/list"),
        apiGet<Record<string, string>>("api/artworkManagement/dropdowns"),
      ]);
      setArtworks(Array.isArray(artRes) ? artRes : []);
      try { const e = JSON.parse(dropRes["allEmployees"]); setAllEmps(Array.isArray(e) ? e : []); } catch { /* */ }
    } catch { /* offline */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selectArtwork = async (row: Artwork) => {
    setSelected(row); setSelProc(null);
    setEmployee(""); setStartTime(""); setEndTime(""); setDsInput(""); setRemark("");
    try {
      const r = await apiGet<ArtProcess[]>(`api/artworkManagement/processes/${row.ArtworkID}`);
      setProcesses(Array.isArray(r) ? r : []);
    } catch { setProcesses([]); }
  };

  const selectProcess = (p: ArtProcess) => {
    setSelProc(p);
    setEmployee(""); setStartTime(""); setEndTime(""); setDsInput(""); setRemark("");
  };

  const saveStatus = async (status: string) => {
    if (!selProc) { alert("Please select a process first"); return; }
    setSaving(true);
    try {
      const res = await apiPost<string>("api/artworkManagement/saveProcessStatus", {
        ArtworkDetailID: selProc.ArtworkDetailID, ArtworkID: selProc.ArtworkID,
        ProcessID: selProc.ProcessID, Status: status, LedgerID: employee,
        StartTime: startTime.replace("T", " "), EndTime: endTime.replace("T", " "),
        Remark: [dsInput, remark].filter(Boolean).join(" | "),
      });
      if (typeof res === "string" && res.includes("Error")) { alert(res); return; }
      const r = await apiGet<ArtProcess[]>(`api/artworkManagement/processes/${selProc.ArtworkID}`);
      setProcesses(Array.isArray(r) ? r : []);
      setSelProc(null); setEmployee(""); setStartTime(""); setEndTime(""); setDsInput(""); setRemark("");
    } catch (e: unknown) { alert("Error: " + (e instanceof Error ? e.message : e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex" style={{ height: "calc(100vh - 118px)", overflow: "hidden" }}>

      {/* ═══ LEFT: Artwork list ═══════════════════════════════════════════════ */}
      <div className="flex flex-col bg-white border-r border-gray-200 flex-shrink-0" style={{ width: 300 }}>
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#42909A] text-white flex-shrink-0">
          <div>
            <div className="text-sm font-bold tracking-wide">Designer Tab</div>
            <div className="text-[10px] text-white/60 mt-0.5">Select an artwork to start working</div>
          </div>
          <button onClick={loadData} title="Refresh" className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Artwork list */}
        <div className="flex-1 overflow-y-auto">
          {artworks.map((row, i) => {
            const active = selected?.ArtworkID === row.ArtworkID;
            return (
              <button key={row.ArtworkID} onClick={() => selectArtwork(row)}
                className={`w-full text-left px-3 py-3 border-b border-gray-100 flex items-center gap-2 group transition-colors
                  ${active ? "bg-teal-50 border-l-[3px] border-l-[#42909A]" : i % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/50 hover:bg-gray-100"}`}>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-bold ${active ? "text-[#42909A]" : "text-[#42909A]"}`}>{row.ArtworkNo}</div>
                  <div className="text-xs font-medium text-gray-700 truncate mt-0.5">{row.ArtWorkName}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">{row.ClientName}</div>
                  <div className="text-[10px] text-gray-400">Due: {row.ExpectedCompletionDate}</div>
                </div>
                <ChevronRight size={13} className={`flex-shrink-0 transition-colors ${active ? "text-[#42909A]" : "text-gray-300 group-hover:text-gray-400"}`} />
              </button>
            );
          })}
          {artworks.length === 0 && (
            <div className="px-4 py-10 text-center text-xs text-gray-400">No artworks found</div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT: Detail ════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto bg-gray-50/80">
        {selected ? (
          <div className="flex flex-col gap-0">

            {/* ── Artwork's Description ──────────────────────────────────────── */}
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <SectionTitle title="Artwork's Description" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Artwork No"          value={selected.ArtworkNo} />
                <Field label="Client Artwork No"   value={selected.ClientArtWorkNo} />
                <Field label="Product Name"        value={selected.ArtWorkName} />
                <Field label="Artwork Description" value={selected.ArtWorkDescription} />
                <Field label="Client"              value={selected.ClientName} />
                <Field label="Category"            value={selected.CategoryName} />
                <Field label="Received Date"       value={selected.ReceivedDate} />
                <Field label="Expected Completion" value={selected.ExpectedCompletionDate} />
              </div>
            </div>

            {/* ── Assigned Processes ─────────────────────────────────────────── */}
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <SectionTitle title="Assigned Processes — Click a process to update" />
              {processes.length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  No processes assigned. Ask manager to assign processes from the Manager Tab.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {processes.map(p => {
                    const active = selProc?.ArtworkDetailID === p.ArtworkDetailID;
                    return (
                      <button key={p.ArtworkDetailID} onClick={() => selectProcess(p)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all
                          ${active ? "bg-[#42909A] text-white border-[#42909A] shadow-md scale-[1.02]" : "bg-white text-gray-700 border-gray-200 hover:border-[#42909A] hover:bg-teal-50"}`}>
                        <span>{p.DisplayProcessName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border
                          ${active ? "bg-white/25 text-white border-white/30"
                            : p.Status ? (STATUS_CLS[p.Status] ?? "bg-gray-100 text-gray-500 border-gray-200")
                            : "bg-gray-100 text-gray-400 border-gray-200"}`}>
                          {p.Status || "Pending"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── For Designer ───────────────────────────────────────────────── */}
            {selProc ? (
              <div className="bg-white px-6 py-4">
                <SectionTitle title={`For Designer — ${selProc.DisplayProcessName}`} />

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <Select label="Employee" value={employee} onChange={e => setEmployee(e.target.value)}
                    options={[{ value: "", label: "— Select —" }, ...allEmps.map(e => ({ value: e.LedgerID, label: e.LedgerName }))]} />
                  <Input label="Start Time" type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
                  <Input label="End Time"   type="datetime-local" value={endTime}   onChange={e => setEndTime(e.target.value)} />
                  <Input label="Time Taken (mins)" value={timeDiffMins(startTime, endTime)} readOnly />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <Textarea label="Designer Input" value={dsInput}  onChange={e => setDsInput(e.target.value)}  rows={3} />
                  <Textarea label="Remark"         value={remark}   onChange={e => setRemark(e.target.value)}   rows={3} />
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex flex-wrap gap-2">
                    <Btn color="cyan"   label="Start Working"    onClick={() => saveStatus("Running")}      disabled={saving} />
                    <Btn color="yellow" label="Part Completed"   onClick={() => saveStatus("PartComplete")} disabled={saving} />
                    <Btn color="green"  label="Complete"         onClick={() => saveStatus("Complete")}     disabled={saving} />
                    <Btn color="orange" label="Hold"             onClick={() => saveStatus("Hold")}         disabled={saving} />
                    <Btn color="slate"  label="Send for Approval" onClick={() => saveStatus("Approve")}    disabled={saving} />
                    <Btn color="teal"   label={saving ? "Saving…" : "Save"} onClick={() => saveStatus("Save")} disabled={saving} />
                  </div>
                </div>
              </div>
            ) : processes.length > 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400 bg-white">
                <div className="text-2xl mb-2">☝️</div>
                Click a process button above to record your work
              </div>
            ) : null}

          </div>
        ) : (
          // Empty state
          <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400 py-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <ChevronRight size={28} className="text-gray-300 ml-1" />
            </div>
            <div className="text-sm font-semibold text-gray-500">Select an artwork from the list</div>
            <div className="text-xs text-gray-400">Click any artwork on the left to start working</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="text-[11px] font-extrabold text-[#582222] tracking-widest uppercase whitespace-nowrap">{title}</div>
      <div className="flex-1 h-px bg-[#42909A]/25" />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 text-xs text-gray-800 min-h-[30px]">{value || "—"}</div>
    </div>
  );
}

function Btn({ color, label, onClick, disabled }: { color: string; label: string; onClick: () => void; disabled: boolean }) {
  const cls: Record<string, string> = {
    cyan:   "bg-cyan-500   hover:bg-cyan-600   border-cyan-600   text-white",
    yellow: "bg-yellow-500 hover:bg-yellow-600 border-yellow-600 text-white",
    green:  "bg-green-600  hover:bg-green-700  border-green-700  text-white",
    orange: "bg-orange-500 hover:bg-orange-600 border-orange-600 text-white",
    slate:  "bg-slate-600  hover:bg-slate-700  border-slate-700  text-white",
    teal:   "bg-[#42909A]  hover:bg-[#357a84]  border-[#357a84]  text-white",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-4 py-2 text-xs font-bold rounded-lg border transition-colors disabled:opacity-50 ${cls[color] ?? cls.slate}`}>
      {label}
    </button>
  );
}
