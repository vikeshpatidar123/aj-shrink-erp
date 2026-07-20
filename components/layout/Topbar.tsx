"use client";
import { useState } from "react";
import {
  Menu, Search, User, LogOut, ChevronDown, Settings, Mail, Building2,
} from "lucide-react";
import { useUnit, BusinessUnit } from "@/context/UnitContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NotificationPanel from "./NotificationPanel";
import { useCompanyName } from "@/lib/useCompanyName";

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

        {/* Search — md+ only */}
        <div
          className="hidden md:flex items-center gap-2 rounded-md px-3 py-1.5 mr-1"
          style={{
            minWidth: "150px",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Search size={13} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent outline-none w-full text-xs erp-topbar-input"
          />
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
