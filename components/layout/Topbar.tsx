"use client";
import { useState, useRef, useEffect } from "react";
import {
  Menu, Search, User, LogOut, ChevronDown, Settings, Mail, Building2,
} from "lucide-react";
import { useUnit, BusinessUnit } from "@/context/UnitContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NotificationPanel from "./NotificationPanel";
import { useCompanyName } from "@/lib/useCompanyName";

// ── All navigable modules (flat list for search) ──────────────────────────────
const ALL_MODULES = [
  { label: "Dashboard",                   href: "/dashboard",                                  badge: null },
  { label: "Gravure Dashboard",           href: "/gravure/dashboard",                          badge: "GRV" },
  { label: "Enquiry (Extrusion)",         href: "/extrusion/enquiry",                          badge: "EXT" },
  { label: "Enquiry",                     href: "/enquiry",                                    badge: "GRV" },
  { label: "Estimation (Extrusion)",      href: "/cost-estimation",                            badge: "EXT" },
  { label: "Estimation",                  href: "/gravure/estimation",                         badge: "GRV" },
  { label: "Product Catalog (Extrusion)", href: "/extrusion/product-catalog",                  badge: "EXT" },
  { label: "Product Catalog",             href: "/gravure/product-catalog",                    badge: "GRV" },
  { label: "Order Booking",               href: "/gravure/orders",                             badge: "GRV" },
  { label: "Work Order (Extrusion)",      href: "/extrusion/workorder",                        badge: "EXT" },
  { label: "Work Order",                  href: "/gravure/workorder",                          badge: "GRV" },
  { label: "Job Schedule Release",        href: "/gravure/job-schedule-release",               badge: "GRV" },
  { label: "Job Production",              href: "/gravure/production/job-production",          badge: "GRV" },
  { label: "QC & Packing",               href: "/gravure/production/qc-packing",              badge: "GRV" },
  { label: "Job Status Modification",     href: "/gravure/production/job-status-modification", badge: "GRV" },
  { label: "Ink Kitchen",                 href: "/gravure/ink-kitchen",                        badge: "GRV" },
  { label: "Content Gang",               href: "/gravure/content-gang",                       badge: "GRV" },
  { label: "Artwork Management",          href: "/gravure/artwork-management",                 badge: "GRV" },
  { label: "Cylinder Management",         href: "/gravure/cylinder-management",                badge: "GRV" },
  { label: "Dispatch",                    href: "/gravure/dispatch",                           badge: "GRV" },
  { label: "Gate Pass Entry",             href: "/gate-pass-entry",                            badge: null },
  { label: "Gate Entry",                  href: "/gate-entry",                                 badge: null },
  { label: "Finish Goods Category Master", href: "/masters/categories",                         badge: null },
  { label: "Item Master",                 href: "/masters/items",                              badge: null },
  { label: "Ledger Master",               href: "/masters/employees",                          badge: null },
  { label: "Sales Person Master",         href: "/masters/sales-persons",                      badge: null },
  { label: "Process Master",              href: "/masters/processes",                          badge: null },
  { label: "Machine Master",              href: "/masters/machines",                           badge: null },
  { label: "SubGroup Master",             href: "/masters/subgroups",                          badge: null },
  { label: "Department Master",           href: "/masters/departments",                        badge: null },
  { label: "HSN Master",                  href: "/masters/hsn",                               badge: null },
  { label: "Unit Master",                 href: "/masters/units",                              badge: null },
  { label: "Warehouse Master",            href: "/masters/warehouses",                         badge: null },
  { label: "User Master",                 href: "/masters/users",                              badge: null },
  { label: "Field Master",                href: "/masters/field-master",                       badge: null },
  { label: "Purchase Requisition",        href: "/inventory/purchase-requisition",             badge: null },
  { label: "Purchase Order",              href: "/inventory/purchase-order",                   badge: null },
  { label: "Purchase GRN",               href: "/inventory/purchase-grn",                     badge: null },
  { label: "Item Issue",                  href: "/inventory/item-issue",                       badge: null },
  { label: "Item Consumption",            href: "/inventory/item-consumption",                 badge: null },
  { label: "Return to Stock",             href: "/inventory/return-to-stock",                  badge: null },
  { label: "Stock Transfer",              href: "/inventory/stock-transfer",                   badge: null },
  { label: "Physical Verification",       href: "/inventory/physical-verification",            badge: null },
  { label: "Tool Stock Summary",          href: "/tool-inventory/stock-summary",               badge: null },
  { label: "Tool Purchase Requisition",   href: "/tool-inventory/purchase-requisition",        badge: null },
  { label: "Tool Purchase Order",         href: "/tool-inventory/purchase-order",              badge: null },
  { label: "Tool Receipt",                href: "/tool-inventory/tool-receipt",                badge: null },
  { label: "Tool Issue",                  href: "/tool-inventory/tool-issue",                  badge: null },
  { label: "Tool Return",                 href: "/tool-inventory/tool-return",                 badge: null },
  { label: "Tool Transfer",               href: "/tool-inventory/tool-transfer",               badge: null },
  { label: "Tool Physical Verification",  href: "/tool-inventory/physical-verification",       badge: null },
] as const;

interface TopbarProps {
  onMenuClick: () => void;
  title: string;
}

const UNITS: { value: BusinessUnit; label: string }[] = [
  { value: "Extrusion", label: "Extrusion" },
  { value: "Gravure",   label: "Gravure"   },
];

function getFinancialYear() {
  const now = new Date();
  const y = now.getFullYear();
  return (now.getMonth() + 1) >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { unit, setUnit } = useUnit();
  const companyName = useCompanyName("ERP");
  const router = useRouter();
  const [dropOpen, setDropOpen]         = useState(false);
  const [unitDropOpen, setUnitDropOpen] = useState(false);

  // ── Module search ─────────────────────────────────────────────────────────
  const [searchQ, setSearchQ]         = useState("");
  const [searchOpen, setSearchOpen]   = useState(false);
  const searchRef                     = useRef<HTMLDivElement>(null);

  const searchResults = searchQ.trim().length > 0
    ? ALL_MODULES.filter(m =>
        m.label.toLowerCase().includes(searchQ.toLowerCase()) ||
        m.href.toLowerCase().includes(searchQ.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goTo = (href: string) => {
    setSearchQ("");
    setSearchOpen(false);
    router.push(href);
  };

  return (
    <header
      className="px-3 md:px-4 flex items-center justify-between sticky top-0 z-50 gap-2"
      style={{
        background: "var(--erp-sidebar-bg)",
        minHeight: "52px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
      }}
    >

      {/* ── Left: hamburger + brand icon + company name + unit dropdown + FY badge ── */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Hamburger — mobile only; desktop uses the sidebar's own toggle button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded flex-shrink-0 transition-colors"
          style={{ color: "rgba(255,255,255,0.6)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
        >
          <Menu size={19} />
        </button>

        {/* Brand icon */}
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--erp-primary)" }}
        >
          <Building2 size={13} className="text-white" />
        </div>

        {/* Company name */}
        <span
          className="font-semibold text-[13px] truncate hidden sm:block"
          style={{ color: "#fff", maxWidth: 220, letterSpacing: "0.01em" }}
        >
          {companyName}
        </span>

        {/* Unit dropdown */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setUnitDropOpen(p => !p)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
          >
            {unit}
            <ChevronDown size={10} />
          </button>

          {unitDropOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setUnitDropOpen(false)} />
              <div
                className="absolute left-0 mt-1.5 w-36 rounded-lg shadow-xl z-[60] overflow-hidden py-1"
                style={{
                  background: "var(--erp-sidebar-bg)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {UNITS.map(u => (
                  <button
                    key={u.value}
                    onClick={() => { setUnit(u.value); setUnitDropOpen(false); }}
                    className="w-full flex items-center px-3 py-2 text-xs font-medium transition-colors"
                    style={{
                      color:      unit === u.value ? "#fff" : "rgba(255,255,255,0.6)",
                      background: unit === u.value ? "var(--erp-primary)" : "transparent",
                    }}
                    onMouseEnter={e => {
                      if (unit !== u.value) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                    }}
                    onMouseLeave={e => {
                      if (unit !== u.value) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Financial Year badge */}
        <span
          className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
          style={{
            background: "rgba(20,184,166,0.18)",
            color: "#2dd4bf",
            border: "1px solid rgba(45,212,191,0.25)",
          }}
        >
          {getFinancialYear()}
        </span>
      </div>

      {/* ── Right ── */}
      <div className="flex items-center gap-0.5 flex-shrink-0">

        {/* Hello Admin */}
        <span
          className="hidden lg:block text-[11px] font-medium px-2"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Hello Admin
        </span>

        {/* Module search — md+ only */}
        <div ref={searchRef} className="hidden md:block relative mr-2">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 cursor-text"
            style={{
              width: "220px",
              background: "rgba(255,255,255,0.13)",
              border: `1.5px solid ${searchOpen ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)"}`,
              transition: "border-color 0.15s, background 0.15s",
              boxShadow: searchOpen ? "0 0 0 2px rgba(255,255,255,0.08)" : "none",
            }}
          >
            <Search size={13} style={{ color: "rgba(255,255,255,0.65)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search modules..."
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              className="bg-transparent outline-none w-full text-xs font-medium erp-topbar-input"
              style={{ caretColor: "#fff" }}
            />
            {searchQ && (
              <button onClick={() => { setSearchQ(""); setSearchOpen(false); }}
                className="text-sm leading-none flex-shrink-0"
                style={{ color: "rgba(255,255,255,0.5)" }}>
                ×
              </button>
            )}
          </div>

          {/* Results dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div
              className="absolute top-full mt-1.5 left-0 rounded-xl shadow-2xl overflow-hidden z-[200]"
              style={{
                minWidth: 260,
                background: "var(--erp-sidebar-bg)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {searchResults.map(m => (
                <button
                  key={m.href}
                  onClick={() => goTo(m.href)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors"
                  style={{ color: "rgba(255,255,255,0.8)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span className="text-xs font-medium">{m.label}</span>
                  {m.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-2 flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                      {m.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {searchOpen && searchQ.trim().length > 0 && searchResults.length === 0 && (
            <div
              className="absolute top-full mt-1.5 left-0 rounded-xl shadow-xl px-4 py-3 z-[200]"
              style={{
                minWidth: 220,
                background: "var(--erp-sidebar-bg)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
              }}
            >
              No modules found for "{searchQ}"
            </div>
          )}
        </div>

        {/* Notification bell */}
        <NotificationPanel dark />

        {/* Email */}
        <Link
          href="/email"
          className="p-2 rounded transition-colors hidden md:flex"
          style={{ color: "rgba(255,255,255,0.6)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
        >
          <Mail size={16} />
        </Link>

        {/* Settings */}
        <button
          className="p-2 rounded transition-colors hidden md:flex"
          style={{ color: "rgba(255,255,255,0.6)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
        >
          <Settings size={16} />
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropOpen(p => !p)}
            className="flex items-center gap-1.5 cursor-pointer rounded px-1.5 sm:px-2 py-1.5 transition-colors"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--erp-primary)", border: "2px solid rgba(255,255,255,0.2)" }}
            >
              <User size={13} className="text-white" />
            </div>
            <span
              className="hidden sm:block text-xs font-medium"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              Admin
            </span>
            <ChevronDown size={12} className="hidden sm:block" style={{ color: "rgba(255,255,255,0.4)" }} />
          </button>

          {dropOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setDropOpen(false)} />
              <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-[60] overflow-hidden">
                <div className="px-4 py-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <p className="text-xs font-semibold text-gray-800">Admin User</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">admin@ajshrink.com</p>
                </div>
                <button
                  onClick={() => { setDropOpen(false); router.push("/login"); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={13} /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
