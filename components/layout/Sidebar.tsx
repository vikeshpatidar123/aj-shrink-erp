"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FlaskConical, Settings2,
  Factory, UserCheck, ClipboardList, Calculator, ShoppingCart,
  FileText, PlayCircle, Truck, ChevronDown, ChevronRight, X,
  Printer, BookOpen, Barcode, Tag, Workflow, Wrench, Boxes, Building2,
  Warehouse, ShoppingBag, ReceiptText, PackageCheck, ArrowLeftRight, ClipboardCheck, PackageMinus, ArrowRightLeft,
  Package, BookMarked, Layers, RotateCcw, Shuffle, ScanSearch, PackagePlus, ClipboardSignature,
  ChevronLeft, Beaker, ImageIcon, Palette, Calendar, ShieldCheck, BarChart2, ListChecks, DoorOpen, LogIn, Cylinder,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useUnit } from "@/context/UnitContext";
import { useCompanyName } from "@/lib/useCompanyName";

// ─── Badge helpers ─────────────────────────────────────────────────────────────
const ExtBadge = () => (
  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded leading-none tracking-wide flex-shrink-0"
    style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}>EXT</span>
);
const GrvBadge = () => (
  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded leading-none tracking-wide flex-shrink-0"
    style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}>GRV</span>
);

// ─── Active indicator pill ─────────────────────────────────────────────────────
const ActivePill = () => (
  <span
    className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full leading-none flex-shrink-0"
    style={{ background: "var(--erp-primary)", color: "#fff", letterSpacing: "0.02em" }}
  >
    Active
  </span>
);

type NavBadge = "EXT" | "GRV" | null;
type FlatItem  = { label: string; href: string; icon: React.ElementType; badge?: NavBadge };
type GroupItem = { label: string; icon: React.ElementType; badge?: NavBadge; children: { label: string; href: string; icon: React.ElementType }[] };
type NavItem   = FlatItem | GroupItem;

const navItems: NavItem[] = [
  { label: "Dashboard",          href: "/dashboard",                 icon: LayoutDashboard },
  { label: "Gravure Dashboard", href: "/gravure/dashboard",         icon: BarChart2,      badge: "GRV" },
  { label: "Enquiry",          href: "/extrusion/enquiry",         icon: ClipboardList,  badge: "EXT" },
  { label: "Enquiry",          href: "/enquiry",                   icon: ClipboardList,  badge: "GRV" },
  { label: "Estimation",       href: "/cost-estimation",           icon: Calculator,     badge: "EXT" },
  { label: "Estimation",       href: "/gravure/estimation",        icon: Calculator,     badge: "GRV" },
  { label: "Product Catalog",  href: "/extrusion/product-catalog", icon: BookMarked,     badge: "EXT" },
  { label: "Product Catalog",  href: "/gravure/product-catalog",   icon: BookMarked,     badge: "GRV" },
  { label: "Order Booking",    href: "/gravure/orders",            icon: ShoppingCart,   badge: "GRV" },
  { label: "Work Order",       href: "/extrusion/workorder",       icon: Printer,        badge: "EXT" },
  { label: "Work Order",       href: "/gravure/workorder",         icon: Printer,        badge: "GRV" },
  { label: "Job Schedule Release", href: "/gravure/job-schedule-release", icon: Calendar, badge: "GRV" },
  {
    label: "Production", icon: PlayCircle, badge: "GRV" as NavBadge,
    children: [
      { label: "Job Production",          href: "/gravure/production/job-production",          icon: PlayCircle },
      { label: "QC & Packing",            href: "/gravure/production/qc-packing",              icon: ShieldCheck },
      { label: "Job Status Modification", href: "/gravure/production/job-status-modification", icon: ListChecks },
    ],
  },
  { label: "Ink Kitchen",   href: "/gravure/ink-kitchen",       icon: Beaker,         badge: "GRV" },
  { label: "Content Gang",  href: "/gravure/content-gang",      icon: Layers,         badge: "GRV" },
  { label: "Artwork Mgmt",  href: "/gravure/artwork-management", icon: ImageIcon,      badge: "GRV" },
  { label: "Cylinder Mgmt", href: "/gravure/cylinder-management", icon: Cylinder,     badge: "GRV" },
  { label: "Outsource",     href: "/gravure/outsource",          icon: ArrowRightLeft, badge: "GRV" },
  { label: "Dispatch",      href: "/gravure/dispatch",           icon: Truck,          badge: "GRV" },
  {
    label: "Gate Management", icon: DoorOpen, children: [
      { label: "Gate Pass Entry", href: "/gate-pass-entry", icon: DoorOpen },
      { label: "Gate Entry",      href: "/gate-entry",      icon: LogIn },
    ],
  },
  {
    label: "Masters", icon: Settings2, children: [
      { label: "Finish Goods Category Master", href: "/masters/categories",  icon: Boxes },
      { label: "Item Master",             href: "/masters/items",        icon: FlaskConical },
      { label: "Ledger Master",           href: "/masters/employees",    icon: UserCheck },
      { label: "Process Master",          href: "/masters/processes",    icon: Workflow },
      { label: "Machine Master",          href: "/masters/machines",     icon: Factory },
      { label: "SubGroup Master",         href: "/masters/subgroups",    icon: Tag },
      { label: "Department Master",       href: "/masters/departments",  icon: Building2 },
      { label: "HSN Master",              href: "/masters/hsn",          icon: Barcode },
      { label: "Unit Master",             href: "/masters/units",        icon: Factory },
      { label: "Warehouse Master",        href: "/masters/warehouses",   icon: Warehouse },
      { label: "User Master",             href: "/masters/users",        icon: UserCheck },
      { label: "Field Master",            href: "/masters/field-master", icon: Layers },
    ],
  },
  {
    label: "Inventory", icon: Warehouse, children: [
      { label: "Purchase Requisition",  href: "/inventory/purchase-requisition",  icon: ShoppingBag },
      { label: "Purchase Order",        href: "/inventory/purchase-order",        icon: ReceiptText },
      { label: "Purchase GRN",          href: "/inventory/purchase-grn",          icon: PackageCheck },
      { label: "Item Issue",            href: "/inventory/item-issue",            icon: PackageMinus },
      { label: "Item Consumption",      href: "/inventory/item-consumption",      icon: ArrowRightLeft },
      { label: "Return to Stock",       href: "/inventory/return-to-stock",       icon: ArrowLeftRight },
      { label: "Stock Transfer",        href: "/inventory/stock-transfer",        icon: Truck },
      { label: "Physical Verification", href: "/inventory/physical-verification", icon: ClipboardCheck },
    ],
  },
  {
    label: "Tool Inventory", icon: Wrench, children: [
      { label: "Stock Summary",         href: "/tool-inventory/stock-summary",         icon: Layers },
      { label: "Purchase Requisition",  href: "/tool-inventory/purchase-requisition",  icon: ClipboardSignature },
      { label: "Purchase Order",        href: "/tool-inventory/purchase-order",        icon: ReceiptText },
      { label: "Tool Receipt",          href: "/tool-inventory/tool-receipt",          icon: PackagePlus },
      { label: "Tool Issue",            href: "/tool-inventory/tool-issue",            icon: PackageMinus },
      { label: "Tool Return",           href: "/tool-inventory/tool-return",           icon: RotateCcw },
      { label: "Tool Transfer",         href: "/tool-inventory/tool-transfer",         icon: Shuffle },
      { label: "Physical Verification", href: "/tool-inventory/physical-verification", icon: ScanSearch },
    ],
  },
];

// ─── Flyout panel (collapsed mode only) ────────────────────────────────────────
interface FlyoutProps {
  group: GroupItem;
  anchorY: number;
  pathname: string;
  onClose: () => void;
  onNavigate: () => void;
  onNavClick?: () => void;
}

function Flyout({ group, anchorY, pathname, onClose, onNavigate, onNavClick }: FlyoutProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const panelHeight = group.children.length * 36 + 44;
  const maxTop = typeof window !== "undefined" ? window.innerHeight - panelHeight - 8 : anchorY;
  const top = Math.min(anchorY, maxTop);

  return (
    <div
      ref={panelRef}
      className="fixed z-50 rounded-xl shadow-2xl py-2 overflow-hidden"
      style={{
        left: 66,
        top: Math.max(8, top),
        minWidth: 210,
        background: "var(--erp-sidebar-bg)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div
        className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 4 }}
      >
        {group.label}
      </div>

      {group.children.map(child => {
        const active = pathname === child.href;
        return (
          <Link
            key={child.href}
            href={child.href}
            onClick={() => { onNavigate(); onClose(); onNavClick?.(); }}
            className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium transition-colors"
            style={{
              color:      active ? "#fff" : "rgba(255,255,255,0.6)",
              background: active ? "rgba(44,93,138,0.55)" : "transparent",
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(44,93,138,0.35)"; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <child.icon size={14} className="flex-shrink-0" />
            <span className="whitespace-nowrap flex-1">{child.label}</span>
            {active && <ActivePill />}
          </Link>
        );
      })}
    </div>
  );
}

interface SidebarProps { mobileOpen: boolean; desktopOpen: boolean; onClose: () => void; onDesktopToggle?: () => void; onNavClick?: () => void; }

export default function Sidebar({ mobileOpen, desktopOpen, onClose, onDesktopToggle, onNavClick }: SidebarProps) {
  const pathname = usePathname();
  const { unit } = useUnit();
  const companyName = useCompanyName("ERP");
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggle = (label: string) => setExpanded(p => p === label ? null : label);

  const [flyout, setFlyout] = useState<{ key: string; group: GroupItem; anchorY: number } | null>(null);

  const collapsed = !desktopOpen;

  // Auto-expand group containing the active route on mount
  useEffect(() => {
    navItems.forEach((item, idx) => {
      if ("children" in item) {
        const key = item.label + idx;
        if (item.children.some(c => pathname.startsWith(c.href))) {
          setExpanded(key);
        }
      }
    });
  }, [pathname]);

  const visibleItems = navItems.filter(item => {
    const badge = (item as FlatItem | GroupItem).badge;
    if ("children" in item) {
      if (!badge) return true;
      if (unit === "Extrusion" && badge === "EXT") return true;
      if (unit === "Gravure"   && badge === "GRV") return true;
      return false;
    }
    if (badge === null || badge === undefined) return true;
    if (unit === "Extrusion" && badge === "EXT") return true;
    if (unit === "Gravure"   && badge === "GRV") return true;
    return false;
  });

  const openFlyout = (key: string, group: GroupItem, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFlyout({ key, group, anchorY: rect.top });
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-30 h-full flex flex-col select-none
          transition-all duration-300
          ${mobileOpen ? "translate-x-0 w-[230px]" : "-translate-x-full w-[230px]"}
          lg:translate-x-0 lg:static lg:z-auto
          ${collapsed ? "lg:w-[60px]" : "lg:w-[230px]"}
        `}
        style={{ background: "var(--erp-sidebar-bg)" }}
      >
        {/* ── Logo / Toggle — Desktop Expanded ── */}
        <div
          className={`flex-shrink-0 hidden lg:flex items-center px-3 py-3.5 gap-2 ${collapsed ? "justify-center" : ""}`}
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", minHeight: 56 }}
        >
          {collapsed ? (
            /* Collapsed desktop: only the panel-open icon */
            <button
              onClick={onDesktopToggle}
              title="Expand sidebar"
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--erp-primary)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)"; }}
            >
              <PanelLeftOpen size={17} strokeWidth={1.75} />
            </button>
          ) : (
            /* Expanded desktop: logo + name + collapse button */
            <>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--erp-primary)" }}
              >
                <Package size={15} className="text-white" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-[9px] font-semibold uppercase tracking-widest leading-none mb-0.5 whitespace-nowrap"
                  style={{ color: "rgba(255,255,255,0.35)" }}>
                  Indus Analytics ERP
                </p>
                <h1 className="text-[13px] font-bold text-white leading-none truncate">{companyName}</h1>
              </div>
              <button
                onClick={onDesktopToggle}
                title="Collapse sidebar"
                className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-all"
                style={{ color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
              >
                <PanelLeftClose size={16} strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>

        {/* ── Logo — Mobile ── */}
        <div
          className="flex-shrink-0 flex lg:hidden items-center px-3 py-3.5 gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", minHeight: 56 }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--erp-primary)" }}
          >
            <Package size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-[9px] font-semibold uppercase tracking-widest leading-none mb-0.5 whitespace-nowrap"
              style={{ color: "rgba(255,255,255,0.35)" }}>
              Indus Analytics ERP
            </p>
            <h1 className="text-[13px] font-bold text-white leading-none truncate">{companyName}</h1>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-all"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Section label ── */}
        {!collapsed && (
          <div
            className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest hidden lg:block"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}
          >
            Navigation
          </div>
        )}

        {/* ── Nav ── */}
        <nav className="erp-sidebar-scroll flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
          {visibleItems.map((item, idx) => {
            const children = "children" in item ? item.children : undefined;

            if (children) {
              const key          = item.label + idx;
              const isExpanded   = expanded === key && !collapsed;
              const hasActive    = children.some(c => pathname.startsWith(c.href));
              const isFlyoutOpen = flyout?.key === key;

              return (
                <div key={key}>
                  <button
                    onClick={e => {
                      if (collapsed) {
                        if (isFlyoutOpen) { setFlyout(null); } else { openFlyout(key, item as GroupItem, e); }
                      } else {
                        toggle(key);
                      }
                    }}
                    title={collapsed ? item.label : undefined}
                    className="w-full flex items-center px-2.5 py-2.5 rounded-md text-sm font-medium transition-colors"
                    style={{
                      color:      (hasActive || isFlyoutOpen) ? "#fff" : "rgba(255,255,255,0.55)",
                      background: (hasActive || isFlyoutOpen) ? "rgba(44,93,138,0.45)" : "transparent",
                      justifyContent: collapsed ? "center" : "space-between",
                    }}
                    onMouseEnter={e => { if (!hasActive && !isFlyoutOpen) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                    onMouseLeave={e => { if (!hasActive && !isFlyoutOpen) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon size={15} className="flex-shrink-0" />
                      {!collapsed && <span className="text-[13px] whitespace-nowrap">{item.label}</span>}
                    </span>
                    {!collapsed && (
                      isExpanded
                        ? <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
                        : <ChevronRight size={12} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
                    )}
                  </button>

                  {isExpanded && !collapsed && (
                    <div
                      className="mt-0.5 ml-3 pl-3 space-y-0.5"
                      style={{ borderLeft: "1px solid rgba(44,93,138,0.4)" }}
                    >
                      {children.map(child => {
                        const active = pathname === child.href || pathname.startsWith(child.href + "/");
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => { onClose(); onNavClick?.(); }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors"
                            style={{
                              color:      active ? "#fff" : "rgba(255,255,255,0.5)",
                              background: active ? "rgba(44,93,138,0.55)" : "transparent",
                            }}
                            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(44,93,138,0.25)"; }}
                            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                          >
                            <child.icon size={13} className="flex-shrink-0" />
                            <span className="flex-1 whitespace-nowrap">{child.label}</span>
                            {active && <ActivePill />}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // ── Flat item ──
            const href     = (item as FlatItem).href;
            const badge    = (item as FlatItem).badge;
            const isActive = pathname === href;

            return (
              <Link
                key={href + idx}
                href={href}
                onClick={() => { onClose(); onNavClick?.(); }}
                title={collapsed ? (item as FlatItem).label : undefined}
                className="flex items-center px-2.5 py-2.5 rounded-md text-[13px] font-medium transition-colors"
                style={{
                  color:      isActive ? "#ffffff" : "rgba(255,255,255,0.55)",
                  background: isActive ? "var(--erp-primary)" : "transparent",
                  gap: collapsed ? 0 : "10px",
                  justifyContent: collapsed ? "center" : "flex-start",
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <item.icon size={15} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 leading-none whitespace-nowrap">{(item as FlatItem).label}</span>
                    {isActive
                      ? <ActivePill />
                      : badge === "EXT" ? <ExtBadge /> : badge === "GRV" ? <GrvBadge /> : null
                    }
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div
          className="px-3 py-3 flex items-center"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            justifyContent: collapsed ? "center" : "space-between",
          }}
        >
          {!collapsed && (
            <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>
              v1.2024 {companyName}
            </span>
          )}
          <Settings2
            size={13}
            className="cursor-pointer transition-colors"
            style={{ color: "rgba(255,255,255,0.25)" }}
            onMouseEnter={e => { (e.currentTarget as SVGElement).style.color = "rgba(255,255,255,0.7)"; }}
            onMouseLeave={e => { (e.currentTarget as SVGElement).style.color = "rgba(255,255,255,0.25)"; }}
          />
        </div>
      </aside>

      {/* ── Flyout panel (collapsed desktop mode only) ── */}
      {collapsed && flyout && (
        <Flyout
          group={flyout.group}
          anchorY={flyout.anchorY}
          pathname={pathname}
          onClose={() => setFlyout(null)}
          onNavigate={onClose}
          onNavClick={onNavClick}
        />
      )}
    </>
  );
}
