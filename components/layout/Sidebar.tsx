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
  Users,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useUnit } from "@/context/UnitContext";
import { usePermissions } from "@/context/PermissionsContext";
import { useCompanyName } from "@/lib/useCompanyName";

// ─── Badge helpers ─────────────────────────────────────────────────────────────
const ExtBadge = () => (
  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded leading-none tracking-wide flex-shrink-0"
    style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>EXT</span>
);
const GrvBadge = () => (
  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded leading-none tracking-wide flex-shrink-0"
    style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>GRV</span>
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
  { label: "Job Schedule Release", href: "/gravure/job-schedule-release", icon: Calendar,  badge: "GRV" },
  {
    label: "Production", icon: PlayCircle, badge: "GRV" as NavBadge,
    children: [
      { label: "Job Production",        href: "/gravure/production/job-production",        icon: PlayCircle },
      { label: "QC & Packing",          href: "/gravure/production/qc-packing",            icon: ShieldCheck },
      { label: "Job Status Modification", href: "/gravure/production/job-status-modification", icon: ListChecks },
    ],
  },
  { label: "Ink Kitchen",       href: "/gravure/ink-kitchen",       icon: Beaker,         badge: "GRV" },
  { label: "Content Gang",     href: "/gravure/content-gang",      icon: Layers,         badge: "GRV" },
  { label: "Artwork Mgmt",    href: "/gravure/artwork-management",    icon: ImageIcon,  badge: "GRV" },
  { label: "Cylinder Mgmt",  href: "/gravure/cylinder-management",  icon: Cylinder,   badge: "GRV" },
  { label: "Dispatch",        href: "/gravure/dispatch",             icon: Truck,      badge: "GRV" },
  {
    label: "Gate Management", icon: DoorOpen, children: [
      { label: "Gate Pass Entry", href: "/gate-pass-entry", icon: DoorOpen },
      { label: "Gate Entry",      href: "/gate-entry",      icon: LogIn },
    ],
  },
  {
    label: "Masters", icon: Settings2, children: [
      { label: "Product Category Master", href: "/masters/categories",  icon: Boxes },
      { label: "Item Master",             href: "/masters/items",        icon: FlaskConical },
      { label: "Ledger Master",           href: "/masters/employees",    icon: UserCheck },
      { label: "Sales Person Master",     href: "/masters/sales-persons", icon: Users },
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
      { label: "Item Issue",             href: "/inventory/item-issue",            icon: PackageMinus },
      { label: "Item Consumption",      href: "/inventory/item-consumption",      icon: ArrowRightLeft },
      { label: "Return to Stock",       href: "/inventory/return-to-stock",       icon: ArrowLeftRight },
      { label: "Stock Transfer",        href: "/inventory/stock-transfer",        icon: Truck },
      { label: "Physical Verification", href: "/inventory/physical-verification", icon: ClipboardCheck },
    ],
  },
  {
    label: "Tool Inventory", icon: Wrench, children: [
      { label: "Stock Summary",         href: "/tool-inventory/stock-summary",          icon: Layers },
      { label: "Purchase Requisition",  href: "/tool-inventory/purchase-requisition",   icon: ClipboardSignature },
      { label: "Purchase Order",        href: "/tool-inventory/purchase-order",         icon: ReceiptText },
      { label: "Tool Receipt",          href: "/tool-inventory/tool-receipt",           icon: PackagePlus },
      { label: "Tool Issue",            href: "/tool-inventory/tool-issue",             icon: PackageMinus },
      { label: "Tool Return",           href: "/tool-inventory/tool-return",            icon: RotateCcw },
      { label: "Tool Transfer",         href: "/tool-inventory/tool-transfer",          icon: Shuffle },
      { label: "Physical Verification", href: "/tool-inventory/physical-verification",  icon: ScanSearch },
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

  // Clamp so panel doesn't overflow bottom of viewport
  const panelHeight = group.children.length * 36 + 44; // approx
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
      {/* Group label */}
      <div
        className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
        style={{
          color: "rgba(255,255,255,0.35)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          marginBottom: 4,
        }}
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
              color: active ? "#fff" : "rgba(255,255,255,0.6)",
              background: active ? "var(--erp-primary)" : "transparent",
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(44,93,138,0.45)"; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <child.icon size={14} className="flex-shrink-0" />
            <span className="whitespace-nowrap">{child.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

// A handful of masters predate the "/masters/xxx" route convention and are still
// checked server-side (CheckAuthories) under their original legacy ModuleMaster name —
// renaming those live, already-verified checks is out of scope here, so map around it.
const MODULE_NAME_OVERRIDES: Record<string, string> = {
  "/masters/items": "/master/item",
  "/masters/employees": "/master/ledger",
  "/masters/processes": "/master/process",
  "/masters/machines": "/master/machine",
  "/masters/categories": "/master/category",
  "/masters/users": "/master/user",
  "/masters/tools": "ToolMaster.aspx",
};
const moduleNameFor = (href: string) => MODULE_NAME_OVERRIDES[href] ?? href;

interface SidebarProps { mobileOpen: boolean; desktopOpen: boolean; onClose: () => void; onNavClick?: () => void; }

export default function Sidebar({ mobileOpen, desktopOpen, onClose, onNavClick }: SidebarProps) {
  const pathname = usePathname();
  const { unit } = useUnit();
  const { hasModule } = usePermissions();
  const companyName = useCompanyName("ERP");
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggle = (label: string) => setExpanded(p => p === label ? null : label);

  // Flyout state for collapsed mode
  const [flyout, setFlyout] = useState<{ key: string; group: GroupItem; anchorY: number } | null>(null);

  // collapsed = icon-only narrow sidebar on desktop
  const collapsed = !desktopOpen;

  const badgeAllowed = (badge: NavBadge | undefined) => {
    if (badge === null || badge === undefined) return true;
    if (unit === "Extrusion" && badge === "EXT") return true;
    if (unit === "Gravure" && badge === "GRV") return true;
    return false;
  };

  // Module Master + this user's authority (via `checkrights`) decide what's visible here —
  // labels/icons/grouping stay curated in navItems, but visibility is authority-driven.
  const visibleItems: NavItem[] = navItems
    .map(item => {
      if ("children" in item) {
        if (!badgeAllowed(item.badge)) return null;
        const children = item.children.filter(c => hasModule(moduleNameFor(c.href)));
        if (children.length === 0) return null;
        return { ...item, children } as GroupItem;
      }
      if (!badgeAllowed(item.badge)) return null;
      if (!hasModule(moduleNameFor(item.href))) return null;
      return item;
    })
    .filter((item): item is NavItem => item !== null);

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
          ${mobileOpen ? "translate-x-0 w-[220px]" : "-translate-x-full w-[220px]"}
          lg:translate-x-0 lg:static lg:z-auto
          ${collapsed ? "lg:w-[60px]" : "lg:w-[220px]"}
        `}
        style={{ background: "var(--erp-sidebar-bg)" }}
      >
        {/* ── Logo ── */}
        <div
          className="flex items-center px-3 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--erp-primary)" }}
          >
            <Package size={16} className="text-white" />
          </div>

          {/* Text — hidden when collapsed */}
          <div className={`ml-2.5 overflow-hidden transition-all duration-300 ${collapsed ? "lg:w-0 lg:opacity-0" : "lg:w-auto lg:opacity-100"} w-auto opacity-100`}>
            <p className="text-[9px] font-semibold uppercase tracking-widest leading-none mb-0.5 whitespace-nowrap"
              style={{ color: "rgba(255,255,255,0.35)" }}>
              Indus Analytics ERP
            </p>
            <h1 className="text-sm font-bold text-white leading-none whitespace-nowrap">{companyName}</h1>
          </div>

          {/* Mobile close */}
          <button onClick={onClose} className="ml-auto lg:hidden hover:text-white transition-colors"
            style={{ color: "rgba(255,255,255,0.35)" }}>
            <X size={17} />
          </button>
        </div>

        {/* ── Section label — hidden when collapsed ── */}
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
              const key        = item.label + idx;
              const isExpanded = expanded === key && !collapsed;
              const isActive   = children.some(c => pathname.startsWith(c.href));
              const isFlyoutOpen = flyout?.key === key;

              return (
                <div key={key}>
                  <button
                    onClick={e => {
                      if (collapsed) {
                        // Toggle flyout
                        if (isFlyoutOpen) {
                          setFlyout(null);
                        } else {
                          openFlyout(key, item as GroupItem, e);
                        }
                      } else {
                        toggle(key);
                      }
                    }}
                    title={collapsed ? item.label : undefined}
                    className="w-full flex items-center px-2.5 py-2.5 rounded-md text-sm font-medium transition-colors"
                    style={{
                      color:      (isActive || isFlyoutOpen) ? "#fff" : "rgba(255,255,255,0.55)",
                      background: (isActive || isFlyoutOpen) ? "rgba(44,93,138,0.55)" : "transparent",
                      justifyContent: collapsed ? "center" : "space-between",
                    }}
                    onMouseEnter={e => { if (!isActive && !isFlyoutOpen) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                    onMouseLeave={e => { if (!isActive && !isFlyoutOpen) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon size={15} className="flex-shrink-0" />
                      {!collapsed && <span className="text-[13px] whitespace-nowrap">{item.label}</span>}
                    </span>
                    {!collapsed && (
                      isExpanded
                        ? <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                        : <ChevronRight size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                    )}
                  </button>

                  {isExpanded && !collapsed && (
                    <div
                      className="mt-0.5 ml-3 pl-3 space-y-0.5"
                      style={{ borderLeft: "1px solid rgba(44,93,138,0.4)" }}
                    >
                      {children.map(child => {
                        const active = pathname === child.href;
                        return (
                          <Link
                            key={child.href} href={child.href} onClick={() => { onClose(); onNavClick?.(); }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors"
                            style={{
                              color:      active ? "#fff" : "rgba(255,255,255,0.45)",
                              background: active ? "var(--erp-primary)" : "transparent",
                            }}
                            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(44,93,138,0.3)"; }}
                            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                          >
                            <child.icon size={13} />
                            {child.label}
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
                key={href + idx} href={href} onClick={() => { onClose(); onNavClick?.(); }}
                title={collapsed ? (item as FlatItem).label : undefined}
                className="flex items-center px-2.5 py-2.5 rounded-md text-[13px] font-medium transition-colors"
                style={{
                  color:      isActive ? "#ffffff" : "rgba(255,255,255,0.55)",
                  background: isActive ? "var(--erp-primary)" : "transparent",
                  gap: collapsed ? 0 : "12px",
                  justifyContent: collapsed ? "center" : "flex-start",
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <item.icon size={15} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 leading-none whitespace-nowrap">{(item as FlatItem).label}</span>
                    {badge === "EXT" && <ExtBadge />}
                    {badge === "GRV" && <GrvBadge />}
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
          <Settings2 size={13} className="cursor-pointer transition-colors"
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
