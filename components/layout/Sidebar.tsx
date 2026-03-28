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
} from "lucide-react";
import { useState } from "react";
import { useUnit } from "@/context/UnitContext";

// ─── Badge helpers ─────────────────────────────────────────────────────────────
const ExtBadge = () => (
  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded leading-none tracking-wide"
    style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>EXT</span>
);
const GrvBadge = () => (
  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded leading-none tracking-wide"
    style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>GRV</span>
);

type NavBadge = "EXT" | "GRV" | null;
type FlatItem  = { label: string; href: string; icon: React.ElementType; badge?: NavBadge };
type GroupItem = { label: string; icon: React.ElementType; children: { label: string; href: string; icon: React.ElementType }[] };
type NavItem   = FlatItem | GroupItem;

const navItems: NavItem[] = [
  { label: "Dashboard",     href: "/dashboard",          icon: LayoutDashboard },
  { label: "Enquiry",        href: "/extrusion/enquiry",  icon: ClipboardList,  badge: "EXT" },
  { label: "Enquiry",        href: "/enquiry",            icon: ClipboardList,  badge: "GRV" },
  { label: "Estimation",    href: "/cost-estimation",    icon: Calculator,     badge: "EXT" },
  { label: "Estimation",       href: "/gravure/estimation",    icon: Calculator,   badge: "GRV" },
  { label: "Product Catalog",  href: "/extrusion/product-catalog", icon: BookMarked, badge: "EXT" },
  { label: "Product Catalog",  href: "/gravure/product-catalog",   icon: BookMarked, badge: "GRV" },
  { label: "Order Booking",    href: "/gravure/orders",        icon: ShoppingCart,   badge: "GRV" },
  { label: "Work Order",    href: "/extrusion/workorder",  icon: Printer,       badge: "EXT" },
  { label: "Work Order",    href: "/gravure/workorder",    icon: Printer,       badge: "GRV" },
  { label: "Production",    href: "/production",         icon: PlayCircle,     badge: "EXT" },
  { label: "Production",    href: "/gravure/production", icon: PlayCircle,     badge: "GRV" },
  { label: "Dispatch",      href: "/dispatch",           icon: Truck,          badge: null },
  {
    label: "Masters", icon: Settings2, children: [
      { label: "Category Master",    href: "/masters/categories",   icon: Boxes },
      { label: "Item Master",        href: "/masters/items",        icon: FlaskConical },
      { label: "Ledger Master",      href: "/masters/employees",    icon: UserCheck },
      { label: "Tool Master",        href: "/masters/tools",        icon: Wrench },
      { label: "Process Master",     href: "/masters/processes",    icon: Workflow },
      { label: "Machine Master",     href: "/masters/machines",     icon: Factory },
      { label: "Item Group Master",  href: "/masters/item-groups",  icon: Boxes },
      { label: "SubGroup Master",    href: "/masters/subgroups",    icon: Tag },
      { label: "Department Master",  href: "/masters/departments",  icon: Building2 },
      { label: "Recipe Master",      href: "/masters/recipes",      icon: BookOpen },
      { label: "HSN Master",         href: "/masters/hsn",          icon: Barcode },
      { label: "Unit Master",        href: "/masters/units",        icon: Factory },
    ],
  },
  {
    label: "Inventory", icon: Warehouse, children: [
      { label: "Purchase Requisition",  href: "/inventory/purchase-requisition",  icon: ShoppingBag },
      { label: "Purchase Order",        href: "/inventory/purchase-order",        icon: ReceiptText },
      { label: "Purchase GRN",          href: "/inventory/purchase-grn",          icon: PackageCheck },
      { label: "Item Issue (Ext)",      href: "/inventory/item-issue",            icon: PackageMinus },
      { label: "Item Issue (Grv)",      href: "/gravure/item-issue",              icon: PackageMinus },
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

interface SidebarProps { mobileOpen: boolean; desktopOpen: boolean; onClose: () => void; }

export default function Sidebar({ mobileOpen, desktopOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { unit } = useUnit();
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggle = (label: string) => setExpanded(p => p === label ? null : label);

  const visibleItems = navItems.filter(item => {
    if ("children" in item) return true;
    const badge = (item as FlatItem).badge;
    if (badge === null || badge === undefined) return true;
    if (unit === "Both") return true;
    if (unit === "Extrusion" && badge === "EXT") return true;
    if (unit === "Gravure"   && badge === "GRV") return true;
    return false;
  });

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed top-0 left-0 z-30 h-full w-[220px] flex flex-col transition-transform duration-300 select-none
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:z-auto
          ${!desktopOpen ? "lg:hidden" : ""}`}
        style={{ background: "var(--erp-sidebar-bg)" }}
      >
        {/* ── Logo ── */}
        <div
          className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--erp-primary)" }}
            >
              <Package size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest leading-none mb-0.5"
                style={{ color: "rgba(255,255,255,0.35)" }}>
                Flexible Packaging ERP
              </p>
              <h1 className="text-sm font-bold text-white leading-none">AJ Shrink</h1>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden hover:text-white transition-colors"
            style={{ color: "rgba(255,255,255,0.35)" }}>
            <X size={17} />
          </button>
        </div>

        {/* ── Unit label strip ── */}
        <div
          className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}
        >
          Navigation
        </div>

        {/* ── Nav ── */}
        <nav className="erp-sidebar-scroll flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {visibleItems.map((item, idx) => {
            const children = "children" in item ? item.children : undefined;

            if (children) {
              const key        = item.label + idx;
              const isExpanded = expanded === key;
              const isActive   = children.some(c => pathname.startsWith(c.href));

              return (
                <div key={key}>
                  <button
                    onClick={() => toggle(key)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                    style={{
                      color:      isActive ? "#fff" : "rgba(255,255,255,0.55)",
                      background: isActive ? "rgba(44,93,138,0.55)" : "transparent",
                    }}
                    onMouseEnter={e => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                    }}
                    onMouseLeave={e => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon size={15} />
                      <span className="text-[13px]">{item.label}</span>
                    </span>
                    {isExpanded
                      ? <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                      : <ChevronRight size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                    }
                  </button>

                  {isExpanded && (
                    <div
                      className="mt-0.5 ml-3 pl-3 space-y-0.5"
                      style={{ borderLeft: "1px solid rgba(44,93,138,0.4)" }}
                    >
                      {children.map(child => {
                        const active = pathname === child.href;
                        return (
                          <Link
                            key={child.href} href={child.href} onClick={onClose}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors"
                            style={{
                              color:      active ? "#fff" : "rgba(255,255,255,0.45)",
                              background: active ? "var(--erp-primary)" : "transparent",
                            }}
                            onMouseEnter={e => {
                              if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(44,93,138,0.3)";
                            }}
                            onMouseLeave={e => {
                              if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                            }}
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
                key={href + idx} href={href} onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium transition-colors"
                style={{
                  color:      isActive ? "#ffffff" : "rgba(255,255,255,0.55)",
                  background: isActive ? "var(--erp-primary)" : "transparent",
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <item.icon size={15} className="flex-shrink-0" />
                <span className="flex-1 leading-none">{item.label}</span>
                {badge === "EXT" && <ExtBadge />}
                {badge === "GRV" && <GrvBadge />}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>
            v1.2024 AJ Shrink ERP
          </span>
          <Settings2 size={13} className="cursor-pointer transition-colors"
            style={{ color: "rgba(255,255,255,0.25)" }}
            onMouseEnter={e => { (e.currentTarget as SVGElement).style.color = "rgba(255,255,255,0.7)"; }}
            onMouseLeave={e => { (e.currentTarget as SVGElement).style.color = "rgba(255,255,255,0.25)"; }}
          />
        </div>
      </aside>
    </>
  );
}
