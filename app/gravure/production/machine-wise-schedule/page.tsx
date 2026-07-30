"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2, RefreshCw, Plus, Shuffle, Trash2,
  CheckCircle2, ArrowUp, ArrowDown, Clock, Factory, ListOrdered, AlertCircle,
} from "lucide-react";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";
const API = "api/GravureMachineSchedule";

function unwrap(raw: any): any {
  let result = raw;
  while (typeof result === "string") {
    try { result = JSON.parse(result); } catch { break; }
  }
  return result;
}

async function apiFetch<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, { headers: authHeaders() });
  return unwrap(await res.text()) as T;
}

async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return unwrap(await res.text()) as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeqRow {
  ScheduleSequenceID: number;
  ScheduleID: number;
  SequenceNo: number;
  IsScheduled: boolean;
  JobBookingID: number;
  JobBookingJobCardContentsID: number;
  ProcessID: number;
  ProcessName: string;
  MachineID: number;
  MachineName: string;
  JobName: string;
  ContentName: string;
  JobCardContentNo: string;
  JobBookingNo: string;
  ScheduleQty: number;
  ScheduleQtyRMT: number;
  TotalTimeToBeTaken: number;
  RateFactor: string;
  DeliveryDate: string;
  JobPriority: string;
  OrderQuantity: number;
  LedgerName: string;
}

interface Machine {
  MachineID: number;
  MachineName: string;
}

interface UnscheduledJob {
  ScheduleID: number;
  JobBookingID: number;
  JobBookingJobCardContentsID: number;
  JobName: string;
  ContentName: string;
  JobCardContentNo: string;
  JobBookingNo: string;
  DeliveryDate: string;
  JobPriority: string;
  OrderQuantity: number;
  LedgerName: string;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiTile({ label, value, icon: Icon, color, loading }: {
  label: string; value: string | number; icon: React.ElementType; color: string; loading: boolean;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}18` }}>
        <Icon size={20} style={{ color }} strokeWidth={1.8} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        {loading
          ? <div className="h-7 w-12 bg-gray-100 rounded animate-pulse mt-1" />
          : <p className="text-2xl font-bold tabular-nums mt-0.5" style={{ color }}>{value}</p>
        }
      </div>
    </div>
  );
}

// ── Priority badge ─────────────────────────────────────────────────────────────
function PriBadge({ p }: { p: string }) {
  const cls = p === "High" ? "bg-red-100 text-red-700" : p === "Medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{p || "—"}</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MachineWiseSchedulePage() {
  const { showToast } = useToast();

  const [sequences, setSequences] = useState<SeqRow[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [unscheduled, setUnscheduled] = useState<UnscheduledJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(0);

  // Add Unscheduled modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedUnscheduled, setSelectedUnscheduled] = useState<Set<number>>(new Set());
  const [unschLoading, setUnschLoading] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  // Reorder modal
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderList, setReorderList] = useState<SeqRow[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);

  // Delete confirm
  const [deletingRow, setDeletingRow] = useState<SeqRow | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // ── Load sequence data ─────────────────────────────────────────────────────
  const loadSequences = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<SeqRow[]>(`${API}/sequence?machineId=${selectedMachine}`);
      setSequences(Array.isArray(data) ? data : []);
    } catch {
      showToast("error", "Error", "Failed to load schedule sequence");
    }
    setLoading(false);
  }, [selectedMachine]);

  // ── Load machines ──────────────────────────────────────────────────────────
  const loadMachines = useCallback(async () => {
    try {
      const data = await apiFetch<Machine[]>(`${API}/machines`);
      setMachines(Array.isArray(data) ? data : []);
    } catch { }
  }, []);

  // ── Load unscheduled ───────────────────────────────────────────────────────
  const loadUnscheduled = useCallback(async () => {
    setUnschLoading(true);
    try {
      const data = await apiFetch<UnscheduledJob[]>(`${API}/unscheduled`);
      setUnscheduled(Array.isArray(data) ? data : []);
    } catch {
      showToast("error", "Error", "Failed to load unscheduled jobs");
    }
    setUnschLoading(false);
  }, []);

  useEffect(() => {
    loadSequences();
    loadMachines();
    loadUnscheduled();
  }, []);

  useEffect(() => { loadSequences(); }, [selectedMachine]);

  // ── Filtered sequences for client-side machine filter ─────────────────────
  const filtered = useMemo(() =>
    selectedMachine === 0 ? sequences : sequences.filter(r => r.MachineID === selectedMachine),
    [sequences, selectedMachine]
  );

  // ── KPI values ────────────────────────────────────────────────────────────
  const totalJobs = useMemo(() => new Set(filtered.map(r => r.ScheduleSequenceID)).size, [filtered]);
  const activeMachines = useMemo(() => new Set(filtered.map(r => r.MachineID)).size, [filtered]);
  const totalHours = useMemo(() => filtered.reduce((s, r) => s + Number(r.TotalTimeToBeTaken || 0), 0), [filtered]);

  // ── DataTable columns ──────────────────────────────────────────────────────
  const columns = useMemo((): Column<SeqRow>[] => [
    { key: "SequenceNo", header: "Seq #", sortable: true },
    { key: "JobBookingNo", header: "JC No", sortable: true },
    { key: "JobName", header: "Job Name", sortable: true },
    { key: "ContentName", header: "Content", sortable: true },
    { key: "LedgerName", header: "Client", sortable: true },
    { key: "MachineName", header: "Machine", sortable: true },
    { key: "ProcessName", header: "Process", sortable: true },
    { key: "RateFactor", header: "Rate" },
    {
      key: "ScheduleQty", header: "Sch. Qty",
      render: (r) => <span className="font-semibold text-blue-700">{Number(r.ScheduleQty).toFixed(0)}</span>
    },
    {
      key: "TotalTimeToBeTaken", header: "Time (hr)",
      render: (r) => <span className="tabular-nums">{Number(r.TotalTimeToBeTaken).toFixed(2)}</span>
    },
    {
      key: "JobPriority", header: "Priority",
      render: (r) => <PriBadge p={String(r.JobPriority)} />
    },
    { key: "DeliveryDate", header: "Delivery", sortable: true },
    {
      key: "IsScheduled", header: "Timed",
      render: (r) => r.IsScheduled
        ? <CheckCircle2 size={15} className="text-green-500" />
        : <span className="text-gray-300 text-xs">—</span>
    },
  ], []);

  // ── Add unscheduled: toggle selection ────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelectedUnscheduled(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openAddModal = async () => {
    setSelectedUnscheduled(new Set());
    setAddModalOpen(true);
    await loadUnscheduled();
  };

  const saveAddToSchedule = async () => {
    if (selectedUnscheduled.size === 0) { showToast("warning", "Select jobs to add"); return; }
    setAddSaving(true);
    try {
      const items = unscheduled
        .filter(j => selectedUnscheduled.has(j.ScheduleID))
        .map(j => ({ ScheduleID: j.ScheduleID, JobBookingJobCardContentsID: j.JobBookingJobCardContentsID }));

      const res = await apiPost<string>(`${API}/addtoschedule`, { Items: items });
      if (String(res).toLowerCase().startsWith("error")) {
        showToast("error", "Failed", String(res));
      } else {
        showToast("success", "Success", `${items.length} job(s) added to schedule queue`);
        setAddModalOpen(false);
        await Promise.all([loadSequences(), loadMachines(), loadUnscheduled()]);
      }
    } catch {
      showToast("error", "Error", "Failed to add jobs to schedule");
    }
    setAddSaving(false);
  };

  // ── Reorder ────────────────────────────────────────────────────────────────
  const openReorder = () => {
    // Deduplicate by ScheduleSequenceID and show one row per sequence slot
    const unique = filtered.filter((r, i, arr) => arr.findIndex(x => x.ScheduleSequenceID === r.ScheduleSequenceID) === i);
    setReorderList([...unique].sort((a, b) => a.SequenceNo - b.SequenceNo));
    setReorderOpen(true);
  };

  const moveRow = (idx: number, dir: -1 | 1) => {
    setReorderList(prev => {
      const arr = [...prev];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= arr.length) return arr;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return arr;
    });
  };

  const saveReorder = async () => {
    setReorderSaving(true);
    try {
      const items = reorderList.map((r, i) => ({
        ScheduleSequenceID: r.ScheduleSequenceID,
        NewSequenceNo: i + 1,
      }));
      const res = await apiPost<string>(`${API}/rearrange`, { Items: items });
      if (String(res).toLowerCase().startsWith("error")) {
        showToast("error", "Failed", String(res));
      } else {
        showToast("success", "Success", "Sequence updated");
        setReorderOpen(false);
        await loadSequences();
      }
    } catch {
      showToast("error", "Error", "Failed to save sequence");
    }
    setReorderSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = (row: SeqRow) => {
    setDeletingRow(row);
    setDeleteConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!deletingRow) return;
    setDeleteSaving(true);
    try {
      const res = await apiPost<string>(`${API}/delete`, {
        ScheduleSequenceID: deletingRow.ScheduleSequenceID,
        ScheduleID: deletingRow.ScheduleID,
      });
      if (String(res).toLowerCase().startsWith("error")) {
        showToast("error", "Failed", String(res));
      } else {
        showToast("success", "Removed", "Job removed from schedule queue");
        setDeleteConfirmOpen(false);
        setDeletingRow(null);
        await Promise.all([loadSequences(), loadUnscheduled()]);
      }
    } catch {
      showToast("error", "Error", "Failed to remove job");
    }
    setDeleteSaving(false);
  };

  // ── Unscheduled columns ────────────────────────────────────────────────────
  const unschCols = useMemo((): Column<UnscheduledJob>[] => [
    { key: "JobBookingNo", header: "JC No", sortable: true },
    { key: "JobName", header: "Job Name", sortable: true },
    { key: "ContentName", header: "Content", sortable: true },
    { key: "LedgerName", header: "Client", sortable: true },
    { key: "DeliveryDate", header: "Delivery", sortable: true },
    {
      key: "JobPriority", header: "Priority",
      render: (r) => <PriBadge p={String(r.JobPriority)} />
    },
    { key: "OrderQuantity", header: "Order Qty" },
  ], []);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Machine Wise Schedule</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Loading…" : `${totalJobs} job(s) · ${activeMachines} machine(s) · ${totalHours.toFixed(1)} hrs total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />}
            onClick={() => { loadSequences(); loadMachines(); loadUnscheduled(); }} loading={loading}>
            Refresh
          </Button>
          <Button variant="secondary" size="sm" icon={<Shuffle size={14} />} onClick={openReorder}>
            Change Sequence
          </Button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openAddModal}>
            Add Unscheduled
          </Button>
        </div>
      </div>

      {/* ── Machine filter ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3">
        <div className="flex items-center gap-3">
          <Factory size={16} className="text-gray-400" />
          <label className="text-xs font-semibold text-gray-600">Filter by Machine</label>
          <div className="w-64">
            <Select
              value={String(selectedMachine)}
              onChange={e => setSelectedMachine(Number(e.target.value))}
              options={[
                { value: "0", label: "All Machines" },
                ...machines.map(m => ({ value: String(m.MachineID), label: m.MachineName }))
              ]}
            />
          </div>
          {selectedMachine > 0 && (
            <button onClick={() => setSelectedMachine(0)} className="text-xs text-blue-600 hover:underline">
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile label="Scheduled Jobs" value={loading ? "…" : totalJobs} icon={ListOrdered} color="#4F46E5" loading={loading} />
        <KpiTile label="Machines Active" value={loading ? "…" : activeMachines} icon={Factory} color="#0891B2" loading={loading} />
        <KpiTile label="Total Hours" value={loading ? "…" : totalHours.toFixed(1)} icon={Clock} color="#059669" loading={loading} />
        <KpiTile label="Unscheduled" value={unschLoading ? "…" : unscheduled.length} icon={AlertCircle} color="#D97706" loading={unschLoading} />
      </div>

      {/* ── Main Schedule Grid ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-blue-600">
            <Loader2 size={24} className="animate-spin mr-2" /> Loading schedule…
          </div>
        ) : (
          <DataTable
            data={filtered.map(r => ({ ...r, id: `${r.ScheduleSequenceID}_${r.ProcessID}` }))}
            columns={columns}
            searchKeys={["JobBookingNo", "JobName", "MachineName", "ProcessName", "LedgerName", "ContentName"]}
            actions={(row) => (
              <button
                onClick={() => confirmDelete(row as unknown as SeqRow)}
                className="text-red-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                title="Remove from queue"
              >
                <Trash2 size={14} />
              </button>
            )}
          />
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Add Unscheduled Jobs Modal ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Unscheduled Jobs to Queue"
        size="xl"
      >
        <div className="space-y-4">
          {unschLoading ? (
            <div className="flex items-center justify-center py-12 text-blue-600">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading unscheduled jobs…
            </div>
          ) : unscheduled.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-green-400" />
              <p className="font-medium">All released jobs are already in the schedule queue.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                {selectedUnscheduled.size} of {unscheduled.length} jobs selected
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#42909A] text-white">
                      <th className="px-3 py-2 w-8">
                        <input type="checkbox"
                          checked={selectedUnscheduled.size === unscheduled.length && unscheduled.length > 0}
                          onChange={e => setSelectedUnscheduled(
                            e.target.checked ? new Set(unscheduled.map(j => j.ScheduleID)) : new Set()
                          )}
                          className="w-3.5 h-3.5 accent-white" />
                      </th>
                      {["JC No", "Job Name", "Content", "Client", "Priority", "Delivery", "Order Qty"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unscheduled.map((j, i) => {
                      const sel = selectedUnscheduled.has(j.ScheduleID);
                      return (
                        <tr key={i}
                          onClick={() => toggleSelect(j.ScheduleID)}
                          className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors
                            ${sel ? "bg-blue-50" : ""}`}>
                          <td className="px-3 py-1.5 text-center">
                            <input type="checkbox" readOnly checked={sel}
                              className="w-3.5 h-3.5 accent-blue-600 pointer-events-none" />
                          </td>
                          <td className="px-3 py-1.5 font-medium text-blue-700">{j.JobBookingNo}</td>
                          <td className="px-3 py-1.5">{j.JobName}</td>
                          <td className="px-3 py-1.5">{j.ContentName}</td>
                          <td className="px-3 py-1.5">{j.LedgerName}</td>
                          <td className="px-3 py-1.5"><PriBadge p={j.JobPriority} /></td>
                          <td className="px-3 py-1.5">{j.DeliveryDate}</td>
                          <td className="px-3 py-1.5 text-right">{j.OrderQuantity}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <Button variant="secondary" size="sm" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            {unscheduled.length > 0 && (
              <Button variant="primary" size="sm" loading={addSaving} onClick={saveAddToSchedule}
                disabled={selectedUnscheduled.size === 0}>
                Add {selectedUnscheduled.size > 0 ? `${selectedUnscheduled.size} Job(s)` : "Selected Jobs"}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Change Sequence Modal ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={reorderOpen}
        onClose={() => setReorderOpen(false)}
        title="Change Schedule Sequence"
        size="lg"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Use the arrows to reorder. Changes apply when you click Save.
          </p>

          {reorderList.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">No jobs in the sequence queue.</div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Seq", "JC No", "Job Name", "Content", "Machine", "Move"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reorderList.map((r, i) => (
                    <tr key={r.ScheduleSequenceID} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-bold text-gray-500 w-10">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-blue-700 whitespace-nowrap">{r.JobBookingNo}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate" title={r.JobName}>{r.JobName}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">{r.ContentName}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.MachineName}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            disabled={i === 0}
                            onClick={() => moveRow(i, -1)}
                            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowUp size={13} className="text-gray-600" />
                          </button>
                          <button
                            disabled={i === reorderList.length - 1}
                            onClick={() => moveRow(i, 1)}
                            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowDown size={13} className="text-gray-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <Button variant="secondary" size="sm" onClick={() => setReorderOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={reorderSaving} onClick={saveReorder}
              disabled={reorderList.length === 0}>
              Save Sequence
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirm ── */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => { setDeleteConfirmOpen(false); setDeletingRow(null); }}
        title="Remove from Schedule Queue"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Remove <span className="font-semibold text-gray-800">
              {deletingRow?.JobBookingNo} — {deletingRow?.ProcessName}
            </span> from the schedule queue?
          </p>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            This will also remove any computed machine-wise time slots for this job.
          </p>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" size="sm" onClick={() => { setDeleteConfirmOpen(false); setDeletingRow(null); }}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={deleteSaving} icon={<Trash2 size={14} />} onClick={executeDelete}>
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
