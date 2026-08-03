"use client";
// ───────────────────────────────────────────────────────────────────────────
// QR Tracking — production roll genealogy (traceability).
// Roll grid → open "Roll History" → auto genealogy tree (root material →
// process rolls → fan-out), hover details, zoom / fit / full-screen, and
// PNG / SVG / PDF / Copy / Print export. Ported from IndasEstimoFlexo roll-tracking.
// ───────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  History, ScanLine, Search, Minus, Plus, Maximize2, X, Factory, User, Clock, Download, Copy, Printer,
} from "lucide-react";
import { toPng, toSvg, toBlob } from "html-to-image";
import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";
import { DataTable, Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/Button";
import { statusBadge, Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import QrScanner from "@/components/ui/QrScanner";
import { downloadRollLabels } from "@/lib/rollLabel";
import { apiGet } from "@/lib/api";

const API = "api/productionModule";
const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v));

interface RollRow {
  RollID: number; BatchNo: string; ProcessName: string; ContentNo: string; JobName: string;
  Quantity: number; RemainingQuantity: number; Status: string; SpoolID: string; QRCode: string; CreatedDate: string;
}
interface GNode {
  RollID: number; BatchNo: string; ParentRollID: number; ParentTransactionID: number; ProductionID: number;
  ProcessID: number; ProcessName: string; SourceBatchNo: string; LotNo: string; SupplierBatchNo: string;
  Quantity: number; RemainingQuantity: number; Status: string; MachineName: string; OperatorName: string;
  FromTime: string; ToTime: string; CreatedDate: string; MergedFromIds: string; SpoolID: string; Level: number;
}
interface Genealogy {
  RollID: number; BatchNo: string; JobName: string; ContentNo: string;
  ContentRolls: GNode[]; Chain: GNode[]; Descendants: GNode[];
  SourceItemName: string; SourceBatchNo: string; SourceLotNo: string; SourceSupplierBatchNo: string; SourceVoucherNo: string;
  Consumption: Array<{ ItemName: string; BatchNo: string; ConsumeQuantity: number; WasteQuantity: number }>;
}
interface TreeNode { key: string; title: string; sub: string; status?: string; tone: "raw" | "chain" | "current"; meta?: GNode | Genealogy | null; children: TreeNode[]; }

const toneColor = (t: string) => t === "raw" ? "#94a3b8" : t === "current" ? "#16a34a" : "var(--erp-primary)";

export default function QrTrackingPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<RollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [genealogy, setGenealogy] = useState<Genealogy | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  const loadRolls = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const d = await apiGet<RollRow[]>(`${API}/rolls${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setRows(Array.isArray(d) ? d : []);
    } catch (e) { showToast("error", "Failed to load rolls", (e as Error).message); }
    finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { loadRolls(); }, [loadRolls]);

  const openHistory = useCallback(async (rollId: number, batchNo?: string) => {
    setGenLoading(true);
    try {
      const q = rollId > 0 ? `rollId=${rollId}` : `batchNo=${encodeURIComponent(batchNo || "")}`;
      const d = await apiGet<Genealogy>(`${API}/rollgenealogy?${q}`);
      if (d && typeof d === "object" && (d as Genealogy).RollID) setGenealogy(d as Genealogy);
      else showToast("error", "Not found", "No genealogy for this roll.");
    } catch (e) { showToast("error", "Failed", (e as Error).message); }
    finally { setGenLoading(false); }
  }, [showToast]);

  const handleScan = (raw: string) => {
    setScanOpen(false);
    let rid = 0, bn = raw.trim();
    try { const p = JSON.parse(raw); rid = Number(p.rid ?? p.RollID ?? 0); bn = p.bn ?? p.batchNo ?? bn; } catch { /* plain */ }
    if (rid > 0) openHistory(rid);
    else if (bn) openHistory(0, bn);
  };

  const columns: Column<RollRow>[] = [
    { key: "BatchNo", header: "Roll Batch (QR)", sortable: true, render: (r) => <span className="font-mono text-gray-700">{r.BatchNo}</span> },
    { key: "ProcessName", header: "Process", sortable: true },
    { key: "ContentNo", header: "PWO / Content" },
    { key: "JobName", header: "Job", sortable: true },
    { key: "Quantity", header: "Qty", render: (r) => num(r.Quantity).toLocaleString("en-IN") },
    { key: "RemainingQuantity", header: "Remaining", render: (r) => num(r.RemainingQuantity).toLocaleString("en-IN") },
    { key: "Status", header: "Status", render: (r) => statusBadge(r.Status) },
    { key: "CreatedDate", header: "Created", render: (r) => r.CreatedDate || "—" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 flex-wrap"
        style={{ background: "var(--erp-primary)", minHeight: 44 }}>
        <div className="flex items-center gap-2 text-white">
          <History size={16} />
          <h1 className="text-sm font-semibold">QR Tracking</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-md bg-white overflow-hidden">
            <Search size={13} className="text-gray-400 ml-2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") loadRolls(query); }}
              placeholder="Search batch / job / process…"
              className="px-2 py-1.5 text-xs outline-none w-56" />
          </div>
          <Button variant="secondary" size="sm" onClick={() => loadRolls(query)}>Search</Button>
          <Button variant="primary" size="sm" icon={<ScanLine size={14} />} onClick={() => setScanOpen(true)}
            style={{ background: "#fff", color: "var(--erp-primary)" }}>Scan Roll QR</Button>
        </div>
      </div>

      {/* Roll grid */}
      <div className="flex-1 overflow-auto bg-white">
        <DataTable data={rows} columns={columns} loading={loading} pageSize={25} enableRowSelection={false}
          searchKeys={["BatchNo", "ProcessName", "JobName", "ContentNo"]}
          actions={(r) => (
            <>
              <Button size="xs" variant="secondary" icon={<History size={12} />} onClick={() => openHistory(r.RollID, r.BatchNo)}>History</Button>
              <Button size="xs" variant="secondary" icon={<Download size={12} />}
                onClick={() => downloadRollLabels([{ BatchNo: r.BatchNo, JobName: r.JobName, ContentNo: r.ContentNo, ProcessName: r.ProcessName, Quantity: r.Quantity, SpoolID: r.SpoolID, QRCode: r.QRCode }])}>
                Label
              </Button>
            </>
          )} />
      </div>

      <div className="flex-shrink-0 px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-500">
        {loading ? "Loading…" : `${rows.length} production roll${rows.length === 1 ? "" : "s"}`}
      </div>

      {scanOpen && (
        <QrScanner title="Scan Roll QR" hint="Scan a production roll label to trace it"
          onScan={handleScan} onClose={() => setScanOpen(false)} />
      )}

      {(genLoading || genealogy) && (
        <RollHistory genealogy={genealogy} loading={genLoading} onClose={() => setGenealogy(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  ROLL HISTORY — genealogy tree + zoom/fit/fullscreen + export
// ═══════════════════════════════════════════════════════════════════════════
function RollHistory({ genealogy, loading, onClose }: { genealogy: Genealogy | null; loading: boolean; onClose: () => void; }) {
  const [zoom, setZoom] = useState(0.9);
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const fsRef = useRef<HTMLDivElement>(null);

  const tree = useMemo<TreeNode | null>(() => {
    if (!genealogy) return null;
    const rolls = Array.isArray(genealogy.ContentRolls) ? genealogy.ContentRolls : [];
    if (!rolls.length) return null;
    const idSet = new Set(rolls.map((r) => Number(r.RollID)));
    const byParent = new Map<number, GNode[]>();
    rolls.forEach((r) => {
      const p = Number(r.ParentRollID) || 0;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(r);
    });
    const roots = rolls.filter((r) => { const p = Number(r.ParentRollID) || 0; return !p || !idSet.has(p); });
    const rollToNode = (r: GNode): TreeNode => ({
      key: "r" + r.RollID,
      title: r.ProcessName || "Process",
      sub: `${r.BatchNo} · ${num(r.Quantity).toLocaleString("en-IN")}${r.MachineName ? " · " + r.MachineName : ""}`,
      status: r.Status,
      tone: Number(r.RollID) === Number(genealogy.RollID) ? "current" : "chain",
      meta: r,
      children: (byParent.get(Number(r.RollID)) || []).map(rollToNode),
    });
    return {
      key: "raw",
      title: genealogy.SourceItemName || "Raw Material",
      sub: `Batch ${genealogy.SourceBatchNo || "—"}${genealogy.SourceSupplierBatchNo ? " · Sup " + genealogy.SourceSupplierBatchNo : ""}`,
      tone: "raw",
      meta: genealogy,
      children: roots.map(rollToNode),
    };
  }, [genealogy]);

  const fit = useCallback(() => {
    const w = wrapRef.current, inner = innerRef.current;
    if (!w || !inner) return;
    const sw = inner.scrollWidth, sh = inner.scrollHeight;
    if (!sw || !sh) return;
    const z = Math.min(w.clientWidth / (sw + 40), w.clientHeight / (sh + 40), 1.5);
    setZoom(Math.max(0.2, z));
  }, []);
  useEffect(() => { if (tree) requestAnimationFrame(fit); }, [tree, fit]);

  const captureOpts = { backgroundColor: "#ffffff", pixelRatio: 2, cacheBust: true, skipFonts: true, style: { zoom: "1" } };
  const fileBase = () => `RollHistory_${genealogy?.BatchNo || "tree"}`;
  const exportPng = async () => { if (captureRef.current) try { saveAs(await toPng(captureRef.current, captureOpts), `${fileBase()}.png`); } catch { } };
  const exportSvg = async () => { if (captureRef.current) try { saveAs(await toSvg(captureRef.current, captureOpts), `${fileBase()}.svg`); } catch { } };
  const exportPdf = async () => {
    if (!captureRef.current) return;
    try {
      const url = await toPng(captureRef.current, captureOpts);
      const img = new Image(); img.src = url; await img.decode();
      const pdf = new jsPDF({ orientation: img.width >= img.height ? "landscape" : "portrait", unit: "px", format: [img.width, img.height] });
      pdf.addImage(url, "PNG", 0, 0, img.width, img.height); pdf.save(`${fileBase()}.pdf`);
    } catch { }
  };
  const copyTree = async () => {
    if (!captureRef.current) return;
    try { const blob = await toBlob(captureRef.current, captureOpts); if (blob) await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); } catch { }
  };
  const printTree = async () => {
    if (!captureRef.current) return;
    try {
      const url = await toPng(captureRef.current, captureOpts);
      const w = window.open("", "_blank");
      if (w) { w.document.write(`<img src="${url}" style="max-width:100%" onload="setTimeout(()=>{window.print();window.close()},150)"/>`); w.document.close(); }
    } catch { }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white" ref={fsRef}>
      <style>{ORG_CSS}</style>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-gray-200" style={{ background: "#f5f9fc" }}>
        <History size={16} style={{ color: "var(--erp-primary)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--erp-primary)" }}>Roll History</p>
          <p className="text-[11px] font-mono text-gray-500">{genealogy?.BatchNo}</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))} className="p-1.5 rounded hover:bg-gray-100"><Minus size={14} /></button>
          <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="p-1.5 rounded hover:bg-gray-100"><Plus size={14} /></button>
          <button onClick={fit} className="px-2 py-1 text-xs rounded hover:bg-gray-100">Fit</button>
          <button onClick={() => fsRef.current?.requestFullscreen?.()} className="p-1.5 rounded hover:bg-gray-100" title="Full screen"><Maximize2 size={14} /></button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X size={16} /></button>
        </div>
      </div>

      {/* Job / content line */}
      {genealogy && (
        <div className="flex-shrink-0 flex items-center gap-6 px-4 py-2 text-xs text-gray-600 border-b border-gray-100">
          <span>Job: <b className="text-gray-800">{genealogy.JobName || "—"}</b></span>
          <span>Content: <b className="text-gray-800">{genealogy.ContentNo || "—"}</b></span>
          {genealogy.SourceVoucherNo && <span>Source Voucher: <b className="text-gray-800">{genealogy.SourceVoucherNo}</b></span>}
        </div>
      )}

      {/* Tree */}
      <div ref={wrapRef} className="flex-1 overflow-auto" style={{ background: "#fbfcfe" }}>
        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading genealogy…</div>
        ) : !tree ? (
          <div className="text-center text-gray-400 py-20">No roll genealogy captured for this job yet.</div>
        ) : (
          <div ref={captureRef} className="inline-block p-8" style={{ zoom }}>
            <div ref={innerRef} className="rt-tree">
              <ul><TreeLi node={tree} /></ul>
            </div>
          </div>
        )}
      </div>

      {/* Consumption + export footer */}
      {genealogy && genealogy.Consumption?.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-gray-100 text-xs text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
          <span className="font-semibold text-gray-500">Material Consumed:</span>
          {genealogy.Consumption.map((c, i) => (
            <span key={i}>{c.ItemName} · {c.BatchNo} · {num(c.ConsumeQuantity).toLocaleString("en-IN")}</span>
          ))}
        </div>
      )}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-t border-gray-200 bg-white">
        <span className="text-xs text-gray-400 mr-1">Export:</span>
        <Button size="xs" variant="secondary" icon={<Download size={12} />} onClick={exportPng}>PNG</Button>
        <Button size="xs" variant="secondary" icon={<Download size={12} />} onClick={exportSvg}>SVG</Button>
        <Button size="xs" variant="secondary" icon={<Download size={12} />} onClick={exportPdf}>PDF</Button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <Button size="xs" variant="secondary" icon={<Printer size={12} />}
          onClick={() => downloadRollLabels((genealogy?.ContentRolls || []).map((r) => ({ BatchNo: r.BatchNo, JobName: genealogy?.JobName, ContentNo: genealogy?.ContentNo, ProcessName: r.ProcessName, MachineName: r.MachineName, OperatorName: r.OperatorName, Quantity: r.Quantity, SpoolID: r.SpoolID })), { fileName: `RollLabels_${genealogy?.ContentNo || "job"}.pdf` })}>
          All Roll Labels
        </Button>
        <div className="ml-auto flex gap-2">
          <Button size="xs" variant="secondary" icon={<Copy size={12} />} onClick={copyTree}>Copy</Button>
          <Button size="xs" variant="secondary" icon={<Printer size={12} />} onClick={printTree}>Print</Button>
        </div>
      </div>
    </div>
  );
}

// ── recursive org-chart node ─────────────────────────────────────────────
function TreeLi({ node }: { node: TreeNode }) {
  const color = toneColor(node.tone);
  const m = node.meta as GNode | undefined;
  const isRoll = m && "RollID" in m && node.tone !== "raw";
  return (
    <li>
      <div className="rt-node">
        <div className="rt-box" style={{ borderColor: color }}>
          {isRoll && (
            <button className="rt-dl" title="Download QR label"
              onClick={(e) => { e.stopPropagation(); downloadRollLabels([{ BatchNo: (m as GNode).BatchNo, ProcessName: (m as GNode).ProcessName, MachineName: (m as GNode).MachineName, OperatorName: (m as GNode).OperatorName, Quantity: (m as GNode).Quantity, SpoolID: (m as GNode).SpoolID }]); }}>
              <Download size={11} />
            </button>
          )}
          <p className="rt-title" style={{ color }}>{node.title}</p>
          <p className="rt-sub">{node.sub}</p>
          {node.status && <div className="mt-1">{statusBadge(node.status)}</div>}
        </div>
        {/* hover detail */}
        <div className="rt-tip">
          {isRoll ? (
            <>
              <p className="font-mono font-semibold text-gray-800 break-all">{(m as GNode).BatchNo}</p>
              <p className="text-gray-500">{(m as GNode).ProcessName}</p>
              <div className="mt-1 space-y-0.5 text-gray-600">
                <div>Qty: <b>{num((m as GNode).Quantity).toLocaleString("en-IN")}</b> · Rem: {num((m as GNode).RemainingQuantity).toLocaleString("en-IN")}</div>
                <div>Status: {(m as GNode).Status}</div>
                <div><Factory size={10} className="inline mr-1" />{(m as GNode).MachineName || "—"}</div>
                <div><User size={10} className="inline mr-1" />{(m as GNode).OperatorName || "—"}</div>
                {(m as GNode).SourceBatchNo && <div>Source: {(m as GNode).SourceBatchNo}</div>}
                {(m as GNode).SpoolID && <div>Spool: {(m as GNode).SpoolID}</div>}
                {(m as GNode).FromTime && <div><Clock size={10} className="inline mr-1" />{(m as GNode).FromTime}{(m as GNode).ToTime ? " → " + (m as GNode).ToTime : ""}</div>}
                <div className="text-gray-400">Roll ID: {(m as GNode).RollID}</div>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold text-gray-800">{(node.meta as Genealogy)?.SourceItemName || "Raw Material"}</p>
              <div className="mt-1 space-y-0.5 text-gray-600">
                <div>Batch: {(node.meta as Genealogy)?.SourceBatchNo || "—"}</div>
                {(node.meta as Genealogy)?.SourceSupplierBatchNo && <div>Supplier Batch: {(node.meta as Genealogy)?.SourceSupplierBatchNo}</div>}
                {(node.meta as Genealogy)?.SourceVoucherNo && <div>Voucher: {(node.meta as Genealogy)?.SourceVoucherNo}</div>}
              </div>
            </>
          )}
        </div>
      </div>
      {node.children.length > 0 && (
        <ul>{node.children.map((c) => <TreeLi key={c.key} node={c} />)}</ul>
      )}
    </li>
  );
}

// classic CSS org-chart (nested ul/li connectors)
const ORG_CSS = `
.rt-tree, .rt-tree ul { margin:0; padding:0; }
.rt-tree ul { display:flex; padding-top:22px; position:relative; }
.rt-tree li { list-style:none; text-align:center; position:relative; padding:22px 10px 0; }
.rt-tree li::before, .rt-tree li::after { content:''; position:absolute; top:0; right:50%; border-top:1px solid #cbd5e1; width:50%; height:22px; }
.rt-tree li::after { right:auto; left:50%; border-left:1px solid #cbd5e1; }
.rt-tree li:only-child::after, .rt-tree li:only-child::before { display:none; }
.rt-tree li:only-child { padding-top:0; }
.rt-tree li:first-child::before, .rt-tree li:last-child::after { border:0 none; }
.rt-tree li:last-child::before { border-right:1px solid #cbd5e1; border-radius:0 6px 0 0; }
.rt-tree li:first-child::after { border-radius:6px 0 0 0; }
.rt-tree ul ul::before { content:''; position:absolute; top:0; left:50%; border-left:1px solid #cbd5e1; width:0; height:22px; }
.rt-tree > ul { padding-top:0; }
.rt-tree > ul > li::before, .rt-tree > ul > li::after { display:none; }
.rt-node { position:relative; display:inline-block; }
.rt-box { position:relative; display:inline-block; min-width:150px; max-width:220px; border:1.5px solid; border-radius:8px; background:#fff; padding:8px 10px; box-shadow:0 1px 2px rgba(0,0,0,.05); }
.rt-dl { position:absolute; top:4px; right:4px; color:#cbd5e1; cursor:pointer; }
.rt-dl:hover { color:var(--erp-primary); }
.rt-title { font-size:11px; font-weight:700; margin:0; }
.rt-sub { font-size:10px; color:#64748b; font-family:ui-monospace,monospace; margin:2px 0 0; word-break:break-all; }
.rt-tip { display:none; position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%); z-index:50; width:230px; text-align:left; background:#fff; border:1px solid #e2e8f0; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.14); padding:10px; font-size:11px; }
.rt-node:hover .rt-tip { display:block; }
`;
