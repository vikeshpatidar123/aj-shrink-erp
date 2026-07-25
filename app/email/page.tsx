"use client";
import { useState, useMemo } from "react";
import {
  Mail, Star, Send, Archive, Trash2, Edit3, Search,
  RefreshCw, Paperclip, ChevronLeft, MoreVertical,
  Reply, Forward, StarOff, Inbox, X, Bold, Italic,
  Underline, Link, AlignLeft, List, AtSign,
} from "lucide-react";
import { Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

// ─── Types ───────────────────────────────────────────────────────────────────
type Folder = "inbox" | "starred" | "sent" | "archive" | "trash";

interface Email {
  id: string;
  from: string;
  fromEmail: string;
  to: string;
  toEmail: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  date: string;
  read: boolean;
  starred: boolean;
  folder: Folder;
  attachments?: { name: string; size: string }[];
  labels?: string[];
}

// ─── Dummy emails ─────────────────────────────────────────────────────────────
const INITIAL_EMAILS: Email[] = [
  {
    id: "E001", folder: "inbox", read: false, starred: true,
    from: "Rajesh Sharma", fromEmail: "rajesh.sharma@parleproducts.com",
    to: "Admin", toEmail: "admin@ajshrink.com",
    subject: "Parle-G Biscuit 100g Wrap — Artwork Approval",
    preview: "Please find the attached artwork for Parle-G Biscuit 100g wrap. Kindly review and confirm...",
    body: `Dear Team,\n\nPlease find the attached artwork for Parle-G Biscuit 100g wrap for your review and approval.\n\nWe need your confirmation by end of this week as we have a production deadline on 15th April 2026.\n\nKey details:\n• Job Width: 340mm\n• Repeat Length: 450mm\n• No. of Colors: 8\n• Substrate: BOPP 20μ\n\nPlease confirm if any revisions are required.\n\nBest regards,\nRajesh Sharma\nParle Products Pvt Ltd`,
    time: "10:32 AM", date: "2026-04-04",
    attachments: [{ name: "Parle-G_Artwork_v3.pdf", size: "2.4 MB" }, { name: "Color_Spec.pdf", size: "840 KB" }],
    labels: ["Urgent", "Artwork"],
  },
  {
    id: "E002", folder: "inbox", read: false, starred: false,
    from: "Sanjay Gupta", fromEmail: "sanjay.gupta@britannia.in",
    to: "Admin", toEmail: "admin@ajshrink.com",
    subject: "Britannia NutriChoice — Cylinder Status Query",
    preview: "Could you please update us on the status of cylinders for Britannia NutriChoice 200g job?",
    body: `Hi,\n\nCould you please provide an update on the cylinder engraving status for Britannia NutriChoice 200g?\n\nOur production team is asking for a tentative delivery date for the cylinders.\n\nJob Reference: GRV-ORD-2024-002\nCylinder Type: Existing (Rechromed)\nNo. of Colors: 6\n\nPlease revert at the earliest.\n\nRegards,\nSanjay Gupta\nBritannia Industries Ltd`,
    time: "9:15 AM", date: "2026-04-04",
    labels: ["Query"],
  },
  {
    id: "E003", folder: "inbox", read: true, starred: false,
    from: "Anita Desai", fromEmail: "anita.desai@haldiram.com",
    to: "Admin", toEmail: "admin@ajshrink.com",
    subject: "Haldiram Bhujia Pouch — Revised Specification",
    preview: "Please note the revised specification for Haldiram Bhujia Pouch 200g. The barrier layer has been changed...",
    body: `Dear AJ Shrink Team,\n\nPlease note the revised specification for Haldiram Bhujia Pouch 200g:\n\nChanges from previous version:\n• Barrier layer changed from Met PET to EVOH 15μ\n• Total structure thickness increased by 5μ\n• Trimming to be 5mm on each side\n\nPlease update the estimation and confirm if this affects the pricing.\n\nThanks,\nAnita Desai\nHaldiram Snacks Pvt Ltd`,
    time: "Yesterday", date: "2026-04-03",
    attachments: [{ name: "Revised_Spec_Haldiram.xlsx", size: "180 KB" }],
    labels: ["Spec Update"],
  },
  {
    id: "E004", folder: "inbox", read: true, starred: true,
    from: "Priya Nair", fromEmail: "priya.nair@nestle.in",
    to: "Admin", toEmail: "admin@ajshrink.com",
    subject: "Maggi Noodles — Order Confirmation #GRV-ORD-2024-005",
    preview: "We confirm our order for Maggi Noodles 70g Outer Wrap. Please proceed with production as discussed.",
    body: `Dear Team,\n\nWe hereby confirm our order for Maggi Noodles 70g Outer Wrap.\n\nOrder Details:\n• Order No: GRV-ORD-2024-005\n• Quantity: 250,000 Meters\n• Substrate: BOPP 20μ + PE\n• No. of Colors: 8\n• Delivery: Before 30th April 2026\n\nPlease acknowledge receipt and send us the production schedule.\n\nRegards,\nPriya Nair\nNestle India Ltd`,
    time: "2 days ago", date: "2026-04-02",
    labels: ["Order Confirmed"],
  },
  {
    id: "E005", folder: "inbox", read: true, starred: false,
    from: "Vikas Mehta", fromEmail: "vikas.mehta@amul.in",
    to: "Admin", toEmail: "admin@ajshrink.com",
    subject: "Amul Butter Shrink Sleeve — Dispatch Update Required",
    preview: "We are yet to receive the dispatched lot for Amul Butter Shrink Sleeve. LR No: LR-2024-0329...",
    body: `Hi,\n\nThis is a follow-up regarding the dispatched consignment for Amul Butter Shrink Sleeve.\n\nDispatch Details:\n• Dispatch No: GRV-DSP-2024-002\n• LR No: LR-2024-0329\n• Vehicle No: RJ-14-CD-5678\n• Status: In Transit\n\nWe have not received the material yet. Could you please check with the transporter and provide an ETA?\n\nThanks,\nVikas Mehta\nAmul Dairy`,
    time: "3 days ago", date: "2026-04-01",
  },
  {
    id: "E006", folder: "sent", read: true, starred: false,
    from: "Admin", fromEmail: "admin@ajshrink.com",
    to: "Rajesh Sharma", toEmail: "rajesh.sharma@parleproducts.com",
    subject: "Re: Parle-G Biscuit 100g Wrap — Quotation GRV-EST-2024-001",
    preview: "Dear Rajesh, Please find attached our quotation for the Parle-G Biscuit 100g Wrap job. Total value: ₹9,20,532...",
    body: `Dear Rajesh,\n\nThank you for your enquiry. Please find our detailed quotation below.\n\nQuotation Reference: GRV-EST-2024-001\nJob: Parle-G Biscuit 100g Wrap\n\nBreakdown:\n• Film Cost: ₹4,18,450\n• Ink & Consumables: ₹72,000\n• Cylinder Cost: ₹28,000\n• Process Cost: ₹3,50,000\n• Overhead + Profit: ₹52,082\n\nTotal: ₹9,20,532\nRate per Meter: ₹4.60\n\nValidity: 30 days from date of quotation.\n\nKindly confirm your acceptance.\n\nBest regards,\nAdmin\nAJ Shrink Pvt Ltd`,
    time: "Yesterday", date: "2026-04-03",
    attachments: [{ name: "Quotation_GRV-EST-2024-001.pdf", size: "1.1 MB" }],
  },
  {
    id: "E007", folder: "sent", read: true, starred: false,
    from: "Admin", fromEmail: "admin@ajshrink.com",
    to: "Sanjay Gupta", toEmail: "sanjay.gupta@britannia.in",
    subject: "Cylinder Status Update — Britannia NutriChoice",
    preview: "Dear Sanjay, The cylinders for Britannia NutriChoice 200g are currently under chrome plating...",
    body: `Dear Sanjay,\n\nThis is to update you on the cylinder status for Britannia NutriChoice 200g.\n\nCurrent Status: Under Chrome Plating\nExpected Completion: 8th April 2026\nEstimated Delivery to Press: 10th April 2026\n\nWe will keep you posted on any changes.\n\nBest regards,\nAdmin\nAJ Shrink Pvt Ltd`,
    time: "2 days ago", date: "2026-04-02",
  },
  {
    id: "E008", folder: "starred", read: true, starred: true,
    from: "ITC Ltd", fromEmail: "procurement@itc.in",
    to: "Admin", toEmail: "admin@ajshrink.com",
    subject: "New Requirement — ITC Sunfeast Dark Fantasy",
    preview: "We have a new requirement for ITC Sunfeast Dark Fantasy packaging. Kindly submit your best quote by...",
    body: `Dear Sir/Madam,\n\nWe have a new packaging requirement for ITC Sunfeast Dark Fantasy range.\n\nRequirement Details:\n• Job: Sunfeast Dark Fantasy Choco Fills 75g\n• Substrate: PET 12μ + Dry Lam + Met PET 12μ + PE 60μ\n• Width: 290mm, Repeat: 420mm\n• No. of Colors: 9\n• Quantity: 5,00,000 Meters\n• Required by: 20th May 2026\n\nKindly submit your best quotation by 10th April 2026.\n\nRegards,\nProcurement Team\nITC Ltd`,
    time: "4 days ago", date: "2026-03-31",
    labels: ["New Lead", "Priority"],
  },
];

// ─── Folder config ─────────────────────────────────────────────────────────────
const FOLDERS: { key: Folder; label: string; icon: React.ElementType }[] = [
  { key: "inbox",   label: "Inbox",   icon: Inbox   },
  { key: "starred", label: "Starred", icon: Star    },
  { key: "sent",    label: "Sent",    icon: Send    },
  { key: "archive", label: "Archive", icon: Archive },
  { key: "trash",   label: "Trash",   icon: Trash2  },
];

const LABEL_COLORS: Record<string, string> = {
  "Urgent":         "bg-red-100 text-red-700",
  "Artwork":        "bg-purple-100 text-purple-700",
  "Query":          "bg-yellow-100 text-yellow-700",
  "Spec Update":    "bg-blue-100 text-blue-700",
  "Order Confirmed":"bg-green-100 text-green-700",
  "New Lead":       "bg-orange-100 text-orange-700",
  "Priority":       "bg-red-100 text-red-700",
};

// ─── Compose Modal ────────────────────────────────────────────────────────────
function ComposeModal({ onClose }: { onClose: () => void }) {
  const [to,      setTo]      = useState("");
  const [subject, setSubject] = useState("");
  const [body,    setBody]    = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
      <div className="pointer-events-auto w-[520px] rounded-2xl shadow-2xl border border-gray-200 bg-white flex flex-col"
        style={{ height: 480 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 rounded-t-2xl"
          style={{ background: "var(--erp-primary)" }}>
          <span className="text-sm font-semibold text-white">New Message</span>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="border-b border-gray-100 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-12 flex-shrink-0">To</span>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com"
              className="flex-1 text-sm outline-none text-gray-800 py-1" />
          </div>
        </div>
        <div className="border-b border-gray-100 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-12 flex-shrink-0">Subject</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
              className="flex-1 text-sm outline-none text-gray-800 py-1" />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col min-h-0 px-1">
          <Textarea
            value={body} onChange={e => setBody(e.target.value)}
            placeholder="Write your message..."
            rows={8}
          />
        </div>

        {/* Toolbar */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100">
          <div className="flex items-center gap-1">
            {[Bold, Italic, Underline, Link, List, AlignLeft, AtSign, Paperclip].map((Icon, i) => (
              <button key={i} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
                <Icon size={13} />
              </button>
            ))}
          </div>
          <Button variant="primary" size="sm">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EmailPage() {
  const [emails,       setEmails]       = useState<Email[]>(INITIAL_EMAILS);
  const [folder,       setFolder]       = useState<Folder>("inbox");
  const [selected,     setSelected]     = useState<Email | null>(null);
  const [search,       setSearch]       = useState("");
  const [composeOpen,  setComposeOpen]  = useState(false);

  const folderEmails = useMemo(() => {
    let list = folder === "starred"
      ? emails.filter(e => e.starred && e.folder !== "trash")
      : emails.filter(e => e.folder === folder);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.subject.toLowerCase().includes(q) ||
        e.from.toLowerCase().includes(q) ||
        e.preview.toLowerCase().includes(q)
      );
    }
    return list;
  }, [emails, folder, search]);

  const unreadCount = (f: Folder) =>
    f === "starred"
      ? emails.filter(e => e.starred && !e.read && e.folder !== "trash").length
      : emails.filter(e => e.folder === f && !e.read).length;

  const openEmail = (e: Email) => {
    setSelected(e);
    setEmails(prev => prev.map(m => m.id === e.id ? { ...m, read: true } : m));
  };

  const toggleStar = (id: string) =>
    setEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e));

  const moveToTrash = (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, folder: "trash" } : e));
    if (selected?.id === id) setSelected(null);
  };

  const moveToArchive = (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, folder: "archive" } : e));
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div className="flex h-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm"
      style={{ minHeight: 0 }}>

      {/* ── Left: Folder sidebar ─────────────────────────────── */}
      <div className="flex flex-col border-r border-gray-100" style={{ width: 220, flexShrink: 0 }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid #f1f5f9" }}>
          <Mail size={16} style={{ color: "var(--erp-primary)" }} />
          <span className="text-[15px] font-bold text-gray-900">Email</span>
        </div>

        {/* Compose */}
        <div className="px-4 py-3">
          <button
            onClick={() => setComposeOpen(true)}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: "var(--erp-primary)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--erp-primary-dark)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--erp-primary)")}
          >
            <Edit3 size={14} />
            Compose
          </button>
        </div>

        {/* Folders */}
        <nav className="flex-1 px-3 space-y-0.5 py-1">
          {FOLDERS.map(f => {
            const active = folder === f.key;
            const count  = unreadCount(f.key);
            return (
              <button key={f.key} onClick={() => { setFolder(f.key); setSelected(null); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: active ? "var(--erp-primary-light)" : "transparent",
                  color:      active ? "var(--erp-primary)" : "#6b7280",
                }}>
                <f.icon size={15} className="flex-shrink-0" />
                <span className="flex-1 text-left">{f.label}</span>
                {count > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--erp-primary)", color: "#fff" }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Middle: Email list ───────────────────────────────── */}
      <div className="flex flex-col border-r border-gray-100" style={{ width: 320, flexShrink: 0 }}>
        {/* Search + refresh */}
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #f1f5f9" }}>
          <div className="flex-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
            <Search size={12} className="text-gray-400 flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emails..."
              className="text-xs bg-transparent outline-none text-gray-600 w-full" />
          </div>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Email rows */}
        <div className="flex-1 overflow-y-auto">
          {folderEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
              <Mail size={32} className="mb-2 opacity-20" />
              <p className="text-sm">No emails</p>
            </div>
          ) : (
            folderEmails.map(email => {
              const active = selected?.id === email.id;
              return (
                <div
                  key={email.id}
                  onClick={() => openEmail(email)}
                  className="px-4 py-3 cursor-pointer border-b border-gray-50 transition-colors"
                  style={{
                    background: active ? "var(--erp-primary-light)" : email.read ? "#fff" : "rgba(44,93,138,0.04)",
                    borderLeft: active ? "3px solid var(--erp-primary)" : "3px solid transparent",
                  }}>
                  {/* From + time */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[13px] truncate max-w-[160px] ${!email.read ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                      {folder === "sent" ? email.to : email.from}
                    </span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">{email.time}</span>
                  </div>
                  {/* Subject */}
                  <p className={`text-xs truncate mb-0.5 ${!email.read ? "font-semibold text-gray-800" : "text-gray-700"}`}>
                    {email.subject}
                  </p>
                  {/* Preview */}
                  <p className="text-[11px] text-gray-400 truncate leading-snug">{email.preview}</p>
                  {/* Labels + star */}
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex gap-1 flex-wrap">
                      {(email.labels || []).map(l => (
                        <span key={l} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${LABEL_COLORS[l] || "bg-gray-100 text-gray-600"}`}>
                          {l}
                        </span>
                      ))}
                      {email.attachments && (
                        <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                          <Paperclip size={9} />{email.attachments.length}
                        </span>
                      )}
                    </div>
                    <button onClick={e => { e.stopPropagation(); toggleStar(email.id); }}
                      className="text-gray-300 hover:text-yellow-400 transition-colors">
                      <Star size={12} fill={email.starred ? "#facc15" : "none"} stroke={email.starred ? "#facc15" : "currentColor"} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Email detail ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Mail size={48} className="mb-3 opacity-15" />
            <p className="text-sm font-medium">No email selected</p>
            <p className="text-xs mt-1">Click an email to read it</p>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div className="px-6 py-4 flex items-start justify-between gap-4"
              style={{ borderBottom: "1px solid #f1f5f9" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 transition-colors lg:hidden">
                    <ChevronLeft size={16} />
                  </button>
                  <h2 className="text-[15px] font-bold text-gray-900 leading-tight">{selected.subject}</h2>
                </div>
                {(selected.labels || []).map(l => (
                  <span key={l} className={`text-[9px] font-bold px-2 py-0.5 rounded mr-1 ${LABEL_COLORS[l] || "bg-gray-100 text-gray-600"}`}>
                    {l}
                  </span>
                ))}
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleStar(selected.id)}
                  className="p-1.5 rounded-lg hover:bg-yellow-50 text-gray-400 hover:text-yellow-500 transition-colors" title="Star">
                  <Star size={15} fill={selected.starred ? "#facc15" : "none"} stroke={selected.starred ? "#facc15" : "currentColor"} />
                </button>
                <button onClick={() => moveToArchive(selected.id)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Archive">
                  <Archive size={15} />
                </button>
                <button onClick={() => moveToTrash(selected.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Trash">
                  <Trash2 size={15} />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="More">
                  <MoreVertical size={15} />
                </button>
              </div>
            </div>

            {/* From / To meta */}
            <div className="px-6 py-3 flex items-start gap-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                style={{ background: "var(--erp-primary)" }}>
                {selected.from.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold text-gray-900">{selected.from}</span>
                  <span className="text-[11px] text-gray-400">&lt;{selected.fromEmail}&gt;</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  To: {selected.to} &lt;{selected.toEmail}&gt; · {selected.date}
                </p>
              </div>
              <span className="text-[11px] text-gray-400 flex-shrink-0">{selected.time}</span>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-w-2xl">
                {selected.body}
              </div>

              {/* Attachments */}
              {selected.attachments && selected.attachments.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Attachments ({selected.attachments.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selected.attachments.map(a => (
                      <div key={a.name}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                        <Paperclip size={13} className="text-gray-400" />
                        <div>
                          <p className="text-xs font-medium text-gray-700">{a.name}</p>
                          <p className="text-[10px] text-gray-400">{a.size}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reply bar */}
            <div className="px-6 py-3 flex items-center gap-2" style={{ borderTop: "1px solid #f1f5f9" }}>
              <button
                onClick={() => setComposeOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50"
                style={{ borderColor: "#dde3ed", color: "var(--erp-primary)" }}>
                <Reply size={14} /> Reply
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                style={{ borderColor: "#dde3ed" }}>
                <Forward size={14} /> Forward
              </button>
            </div>
          </>
        )}
      </div>

      {/* Compose modal */}
      {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}
    </div>
  );
}
