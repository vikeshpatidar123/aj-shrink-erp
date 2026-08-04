"use client";
/**
 * AttachmentsAccordion — the "Attachments" grouping for the Gravure Costing
 * Estimation rewrite. Copied verbatim (JSX unchanged) from the legacy
 * `app/gravure/costing-estimation/page.tsx` (the `{/* ── Attachments ── *}`
 * block, just before "Machine & Cylinder Cost").
 *
 * Drag-drop attachment grid, file input, inline label editing, and preview
 * trigger (actual preview modal lives in the parent panel via
 * `previewAttachment` / `setPreviewAttachment`).
 */
import { Plus, Archive, X, Eye as EyeIcon } from "lucide-react";
import { EstAttachment } from "@/hooks/useEstimationInstance";

export interface AttachmentsAccordionProps {
  attachments: EstAttachment[];
  addAttachments: (files: FileList | null) => void;
  removeAttachment: (id: string) => void;
  editingAttachLabel: string | null;
  setEditingAttachLabel: React.Dispatch<React.SetStateAction<string | null>>;
  previewAttachment: { name: string; url: string; mimeType: string } | null;
  setPreviewAttachment: React.Dispatch<React.SetStateAction<{ name: string; url: string; mimeType: string } | null>>;
  setAttachments: React.Dispatch<React.SetStateAction<EstAttachment[]>>;
}

export default function AttachmentsAccordion({
  attachments, addAttachments, removeAttachment,
  editingAttachLabel, setEditingAttachLabel,
  previewAttachment, setPreviewAttachment,
  setAttachments,
}: AttachmentsAccordionProps) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </span>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-lg cursor-pointer transition">
          <Plus size={11} /> Add Files
          <input type="file" multiple accept="*" className="hidden"
            onChange={e => addAttachments(e.target.files)} />
        </label>
      </div>
      {attachments.length === 0 && (
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-orange-200 rounded-xl py-6 cursor-pointer bg-orange-50/40 hover:bg-orange-50 transition"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); addAttachments(e.dataTransfer.files); }}>
          <Archive size={22} className="text-orange-300" />
          <span className="text-xs text-orange-400 font-medium">Drag &amp; drop any file — JPG, PDF, AI, PSD, PNG, etc.</span>
          <span className="text-[10px] text-orange-300">or click <strong>Add Files</strong> above</span>
          <input type="file" multiple accept="*" className="hidden"
            onChange={e => addAttachments(e.target.files)} />
        </label>
      )}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); addAttachments(e.dataTransfer.files); }}>
          {attachments.map((att, attIdx) => {
            const isImg  = att.mimeType.startsWith("image/");
            const ext    = att.name.split(".").pop()?.toUpperCase() ?? "FILE";
            const sizeKb = (att.size / 1024).toFixed(0);
            const isMaster = attIdx === 0;
            const label  = att.label ?? (isMaster ? "Master File" : "");
            const badgeColor = isMaster
              ? "bg-amber-400 text-white border-amber-500"
              : "bg-indigo-100 text-indigo-700 border-indigo-300";
            const isEditingLabel = editingAttachLabel === att.id;
            return (
              <div key={att.id} className={`relative group rounded-xl overflow-hidden bg-white shadow-sm ${isMaster ? "border-2 border-amber-400 ring-1 ring-amber-300" : label ? "border-2 border-indigo-300" : "border border-gray-200"}`}>
                {isEditingLabel ? (
                  <div className="absolute top-1.5 left-1.5 z-20 flex items-center gap-1">
                    <input autoFocus
                      className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-indigo-400 bg-white text-indigo-700 outline-none w-28 shadow"
                      defaultValue={label}
                      onBlur={e => { const v = e.target.value.trim(); setAttachments(p => p.map(a => a.id === att.id ? { ...a, label: v || undefined } : a)); setEditingAttachLabel(null); }}
                      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingAttachLabel(null); }}
                    />
                  </div>
                ) : label ? (
                  <button onClick={() => setEditingAttachLabel(att.id)} title="Click to rename"
                    className={`absolute top-1.5 left-1.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border shadow hover:opacity-80 transition ${badgeColor}`}>
                    {isMaster && "★ "}{label}
                  </button>
                ) : (
                  <button onClick={() => setEditingAttachLabel(att.id)} title="Add label"
                    className="absolute top-1.5 left-1.5 z-10 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border border-dashed border-gray-400 text-gray-500 bg-white/90 shadow transition">
                    + Name
                  </button>
                )}
                {isImg ? (
                  <img src={att.url} alt={att.name} className="w-full h-20 object-cover" />
                ) : (
                  <div className="w-full h-20 flex flex-col items-center justify-center bg-gray-50 gap-1">
                    <span className="text-2xl font-black text-gray-300">{ext}</span>
                  </div>
                )}
                <div className="px-2 py-1.5 border-t border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-700 truncate" title={att.name}>{att.name}</p>
                  <p className="text-[9px] text-gray-400">{sizeKb} KB</p>
                </div>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setPreviewAttachment({ name: att.name, url: att.url, mimeType: att.mimeType })}
                    className="p-1 rounded-md bg-white/90 text-indigo-600 hover:bg-indigo-50 shadow" title="Preview">
                    <EyeIcon size={11} />
                  </button>
                  <a href={att.url} download={att.name} target="_blank" rel="noreferrer"
                    className="p-1 rounded-md bg-white/90 text-blue-600 hover:bg-blue-50 shadow text-[10px]" title="Download">↓</a>
                  <button onClick={() => removeAttachment(att.id)}
                    className="p-1 rounded-md bg-white/90 text-red-500 hover:bg-red-50 shadow" title="Remove">
                    <X size={10} />
                  </button>
                </div>
              </div>
            );
          })}
          <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-200 rounded-xl h-full min-h-[80px] cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition">
            <Plus size={16} className="text-gray-300" />
            <span className="text-[10px] text-gray-300">Add more</span>
            <input type="file" multiple accept="*" className="hidden"
              onChange={e => addAttachments(e.target.files)} />
          </label>
        </div>
      )}
    </div>
  );
}
