"use client";
import { useState } from "react";
import { Menu, Bell, Search, User, LogOut, ChevronDown, Settings } from "lucide-react";
import { useUnit, BusinessUnit } from "@/context/UnitContext";
import { useRouter } from "next/navigation";

interface TopbarProps {
  onMenuClick: () => void;
  title: string;
}

const UNITS: { value: BusinessUnit; label: string }[] = [
  { value: "Extrusion", label: "Extrusion" },
  { value: "Gravure",   label: "Gravure"   },
  { value: "Both",      label: "Both"      },
];

export default function Topbar({ onMenuClick, title }: TopbarProps) {
  const { unit, setUnit } = useUnit();
  const router = useRouter();
  const [dropOpen, setDropOpen] = useState(false);

  const handleLogout = () => {
    setDropOpen(false);
    router.push("/login");
  };

  return (
    <header
      className="bg-white px-3 md:px-4 py-0 flex items-center justify-between sticky top-0 z-10 gap-2"
      style={{ borderBottom: "1px solid #dde3ed", minHeight: "52px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >

      {/* ── Left: hamburger + title ── */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={onMenuClick}
          className="p-2 rounded text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <Menu size={19} />
        </button>
        <h2 className="text-[13px] sm:text-[14px] font-semibold text-gray-800 truncate"
          style={{ letterSpacing: "0.01em" }}>
          {title}
        </h2>
      </div>

      {/* ── Centre: Unit switcher — icon-only on mobile, full label on sm+ ── */}
      <div
        className="flex items-center gap-px rounded-md overflow-hidden border flex-shrink-0"
        style={{ borderColor: "#dde3ed" }}
      >
        {UNITS.map(u => {
          const active = unit === u.value;
          return (
            <button
              key={u.value}
              onClick={() => setUnit(u.value)}
              className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-semibold tracking-wide transition-all"
              style={
                active
                  ? { background: "var(--erp-primary)", color: "#fff", borderColor: "transparent" }
                  : { background: "#fff", color: "#6b7280" }
              }
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "var(--erp-primary-light)";
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "#fff";
              }}
            >
              <span className="hidden sm:inline">{u.label}</span>
              <span className="sm:hidden">{u.label.slice(0, 3)}</span>
            </button>
          );
        })}
      </div>

      {/* ── Right ── */}
      <div className="flex items-center gap-1 flex-shrink-0">

        {/* Search — md+ only */}
        <div className="hidden md:flex items-center gap-2 rounded-md px-3 py-1.5 border border-gray-200 bg-gray-50 focus-within:bg-white transition-all"
          style={{ minWidth: "160px" }}>
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm text-gray-600 outline-none w-full"
          />
        </div>

        {/* Bell */}
        <button className="relative p-2 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* Settings — md+ only */}
        <button className="p-2 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors hidden md:flex">
          <Settings size={16} />
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropOpen(p => !p)}
            className="flex items-center gap-1.5 cursor-pointer rounded hover:bg-gray-100 px-1.5 sm:px-2 py-1.5 transition-colors"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--erp-primary)" }}
            >
              <User size={13} className="text-white" />
            </div>
            <span className="hidden sm:block text-xs font-medium text-gray-600">Admin</span>
            <ChevronDown size={12} className="text-gray-400 hidden sm:block" />
          </button>

          {dropOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropOpen(false)} />
              <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                <div className="px-4 py-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <p className="text-xs font-semibold text-gray-800">Admin User</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">admin@ajshrink.com</p>
                </div>
                <button
                  onClick={handleLogout}
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
