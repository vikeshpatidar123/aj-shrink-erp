"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Bell, X, Settings, Search, CheckCheck, Trash2, Check,
  ClipboardList, ShoppingCart, Printer, PlayCircle, Truck,
  ShoppingBag, PackageCheck, AlertTriangle, BookMarked, RotateCcw,
} from "lucide-react";
import {
  gravureEnquiries, gravureOrders, gravureWorkOrders,
  gravureProductionEntries, purchaseRequisitions, purchaseOrders,
} from "@/data/dummyData";

// ─── Types ──────────────────────────────────────────────────────────────────
type NotifCategory = "pending" | "escalation" | "update";

interface Notif {
  id: string;
  category: NotifCategory;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

// ─── Time helper ─────────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const now  = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffD  = Math.floor(diffMs / 86400000);
  if (diffD === 0) return "Today";
  if (diffD === 1) return "1 day ago";
  if (diffD < 7)  return `${diffD} days ago`;
  if (diffD < 30) return `${Math.floor(diffD / 7)} week${Math.floor(diffD / 7) > 1 ? "s" : ""} ago`;
  return `${Math.floor(diffD / 30)} month${Math.floor(diffD / 30) > 1 ? "s" : ""} ago`;
}

// ─── Generate static notifications from real data ────────────────────────────
function buildNotifications(): Notif[] {
  const list: Notif[] = [];

  // 1. Pending enquiries → Pending
  gravureEnquiries
    .filter(e => e.status === "Pending")
    .forEach(e => {
      list.push({
        id: `enq-${e.id}`,
        category: "pending",
        icon: ClipboardList,
        iconColor: "#2563eb",
        iconBg: "#dbeafe",
        title: `New Enquiry — ${e.enquiryNo}`,
        description: `${e.customerName} · ${e.jobName} · ${e.noOfColors} colors`,
        time: timeAgo(e.date),
        read: false,
      });
    });

  // 2. Estimated enquiries → Update
  gravureEnquiries
    .filter(e => e.status === "Estimated")
    .forEach(e => {
      list.push({
        id: `enq-est-${e.id}`,
        category: "update",
        icon: ClipboardList,
        iconColor: "#7c3aed",
        iconBg: "#ede9fe",
        title: `Enquiry Estimated — ${e.enquiryNo}`,
        description: `${e.customerName} · ${e.jobName}`,
        time: timeAgo(e.date),
        read: true,
      });
    });

  // 3. Converted enquiries → Update
  gravureEnquiries
    .filter(e => e.status === "Converted")
    .forEach(e => {
      list.push({
        id: `enq-conv-${e.id}`,
        category: "update",
        icon: CheckCheck,
        iconColor: "#059669",
        iconBg: "#d1fae5",
        title: `Enquiry Converted — ${e.enquiryNo}`,
        description: `${e.customerName} · ${e.jobName}`,
        time: timeAgo(e.date),
        read: true,
      });
    });

  // 4. Gravure orders → Update
  gravureOrders.slice(0, 5).forEach(o => {
    list.push({
      id: `ord-${o.id}`,
      category: "update",
      icon: ShoppingCart,
      iconColor: "#0891b2",
      iconBg: "#cffafe",
      title: `Order Booked — ${o.orderNo}`,
      description: `${o.customerName} · ${o.jobName} · ${o.quantity.toLocaleString()} ${o.unit}`,
      time: timeAgo(o.date),
      read: true,
    });
  });

  // 5. Work orders → Pending (no matching production entry = not started)
  const startedOrderIds = new Set(gravureWorkOrders.map(w => w.orderId));
  gravureOrders
    .filter(o => !startedOrderIds.has(o.id))
    .slice(0, 3)
    .forEach(o => {
      list.push({
        id: `wo-pend-${o.id}`,
        category: "pending",
        icon: Printer,
        iconColor: "#d97706",
        iconBg: "#fef3c7",
        title: `Work Order Pending — ${o.orderNo}`,
        description: `${o.customerName} · ${o.jobName} · Work order not yet created`,
        time: timeAgo(o.date),
        read: false,
      });
    });

  // 6. Work orders created → Update
  gravureWorkOrders.slice(0, 3).forEach(w => {
    list.push({
      id: `wo-${w.id}`,
      category: "update",
      icon: Printer,
      iconColor: "#2C5D8A",
      iconBg: "#dbeafe",
      title: `Work Order Created — ${w.workOrderNo}`,
      description: `${w.customerName} · ${w.jobName}`,
      time: timeAgo(w.date || "2024-03-10"),
      read: true,
    });
  });

  // 7. Production entries → Update
  gravureProductionEntries.slice(0, 3).forEach(p => {
    list.push({
      id: `prod-${p.id}`,
      category: "update",
      icon: PlayCircle,
      iconColor: "#059669",
      iconBg: "#d1fae5",
      title: `Production Entry — ${p.entryNo}`,
      description: `${p.machineName} · ${p.jobName} · ${(p.goodQty ?? p.producedQty ?? 0).toLocaleString()} m produced`,
      time: timeAgo(p.date || "2024-03-15"),
      read: true,
    });
  });

  // 8. Purchase requisitions submitted/draft → Pending / Escalation
  purchaseRequisitions
    .filter(pr => pr.status === "Submitted" || pr.status === "Draft")
    .slice(0, 4)
    .forEach((pr, i) => {
      list.push({
        id: `pr-${pr.id}`,
        category: i < 2 ? "escalation" : "pending",
        icon: ShoppingBag,
        iconColor: i < 2 ? "#dc2626" : "#d97706",
        iconBg: i < 2 ? "#fee2e2" : "#fef3c7",
        title: `PR Awaiting Approval — ${pr.reqNo}`,
        description: `${pr.lines?.length ?? 1} item(s) · ${pr.status}`,
        time: timeAgo(pr.reqDate || "2024-03-05"),
        read: false,
      });
    });

  // 9. Purchase orders placed → Update
  purchaseOrders.slice(0, 3).forEach(po => {
    list.push({
      id: `po-${po.id}`,
      category: "update",
      icon: PackageCheck,
      iconColor: "#2C5D8A",
      iconBg: "#dbeafe",
      title: `Purchase Order Placed — ${po.poNo}`,
      description: `${po.supplier} · ${po.lines?.length ?? 0} line(s)`,
      time: timeAgo(po.poDate || "2024-03-08"),
      read: true,
    });
  });

  // 10. Overdue: old pending enquiries (older than 7 days, still Pending) → Escalation
  gravureEnquiries
    .filter(e => e.status === "Pending")
    .forEach(e => {
      const daysOld = Math.floor((Date.now() - new Date(e.date).getTime()) / 86400000);
      if (daysOld > 7) {
        list.push({
          id: `esc-enq-${e.id}`,
          category: "escalation",
          icon: AlertTriangle,
          iconColor: "#dc2626",
          iconBg: "#fee2e2",
          title: `Enquiry Overdue — ${e.enquiryNo}`,
          description: `${e.customerName} · No action taken in ${daysOld} days`,
          time: timeAgo(e.date),
          read: false,
        });
      }
    });

  // Sort: unread first, then by recency
  return list.sort((a, b) => {
    if (!a.read && b.read) return -1;
    if (a.read && !b.read) return 1;
    return 0;
  });
}

// ─── Icon circle ─────────────────────────────────────────────────────────────
function NotifIcon({ Icon, color, bg }: { Icon: React.ElementType; color: string; bg: string }) {
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: bg }}>
      <Icon size={16} style={{ color }} />
    </div>
  );
}

// ─── Single notification row ──────────────────────────────────────────────────
function NotifRow({ n, onRead, onDelete }: { n: Notif; onRead: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors relative"
      style={{ background: hovered ? "rgba(44,93,138,0.05)" : n.read ? "transparent" : "rgba(44,93,138,0.04)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NotifIcon Icon={n.icon} color={n.iconColor} bg={n.iconBg} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[13px] leading-tight ${n.read ? "font-medium text-gray-700" : "font-semibold text-gray-900"}`}>
            {n.title}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-gray-400 whitespace-nowrap">{n.time}</span>
            {!n.read && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--erp-primary)" }} />
            )}
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug truncate">{n.description}</p>
      </div>

      {/* Hover actions */}
      {hovered && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {!n.read && (
            <button
              onClick={e => { e.stopPropagation(); onRead(); }}
              title="Mark as read"
              className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-blue-50 shadow-sm transition-colors">
              <Check size={12} className="text-blue-600" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            title="Dismiss"
            className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-red-50 shadow-sm transition-colors">
            <Trash2 size={12} className="text-red-500" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────
export default function NotificationPanel({ dark }: { dark?: boolean }) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState("");
  const [tab,     setTab]     = useState<"all" | NotifCategory>("all");
  const [notifs,  setNotifs]  = useState<Notif[]>(() => buildNotifications());
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = useMemo(() => {
    let list = tab === "all" ? notifs : notifs.filter(n => n.category === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.description.toLowerCase().includes(q));
    }
    return list;
  }, [notifs, tab, search]);

  const unread = notifs.filter(n => !n.read).length;
  const counts = {
    all:        notifs.length,
    pending:    notifs.filter(n => n.category === "pending").length,
    escalation: notifs.filter(n => n.category === "escalation").length,
    update:     notifs.filter(n => n.category === "update").length,
  };

  const markRead    = (id: string) => setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
  const dismiss     = (id: string) => setNotifs(p => p.filter(n => n.id !== id));
  const markAllRead = () => setNotifs(p => p.map(n => ({ ...n, read: true })));

  const TAB_LABELS: { key: "all" | NotifCategory; label: string }[] = [
    { key: "all",        label: "All"         },
    { key: "pending",    label: "Pending"     },
    { key: "escalation", label: "Escalations" },
    { key: "update",     label: "Updates"     },
  ];

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(p => !p)}
        className={`relative p-2 rounded transition-colors ${dark ? "" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
        style={dark ? { color: "rgba(255,255,255,0.65)" } : undefined}
        onMouseEnter={dark ? e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; } : undefined}
        onMouseLeave={dark ? e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)"; (e.currentTarget as HTMLElement).style.background = "transparent"; } : undefined}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1"
            style={{ background: "#dc2626" }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-2 rounded-2xl shadow-2xl border border-gray-200 bg-white flex flex-col z-[60]"
            style={{ width: 400, maxHeight: "82vh" }}
          >
          {/* Header */}
          <div className="px-5 pt-4 pb-3 flex items-center gap-3"
            style={{ borderBottom: "1px solid #f1f5f9" }}>
            <span className="text-[15px] font-bold text-gray-900 flex-1">Notifications</span>
            <div className="flex items-center gap-1.5 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
              <Search size={12} className="text-gray-400 flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="text-xs bg-transparent outline-none text-gray-600 w-full"
              />
            </div>
            <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <Settings size={14} />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-4 py-2 flex gap-1.5 flex-wrap"
            style={{ borderBottom: "1px solid #f1f5f9" }}>
            {TAB_LABELS.map(t => {
              const count = counts[t.key];
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={{
                    background: active ? "var(--erp-primary)" : "#f1f5f9",
                    color: active ? "#fff" : "#6b7280",
                  }}>
                  {t.label}
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                    style={{
                      background: active ? "rgba(255,255,255,0.25)" : "#dde3ed",
                      color: active ? "#fff" : "#374151",
                    }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell size={28} className="mb-2 opacity-30" />
                <p className="text-sm font-medium">No notifications</p>
              </div>
            ) : (
              filtered.map(n => (
                <NotifRow
                  key={n.id}
                  n={n}
                  onRead={() => markRead(n.id)}
                  onDelete={() => dismiss(n.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderTop: "1px solid #f1f5f9" }}>
            <button
              onClick={markAllRead}
              className="text-[12px] font-semibold transition-colors"
              style={{ color: "var(--erp-primary)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--erp-primary-dark)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--erp-primary)")}>
              Mark all as read
            </button>
            <button className="text-[12px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
              View History
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
