"use client";
import {
  createContext, useContext, useState, useCallback,
  useEffect, useRef, ReactNode,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LoaderCtxType {
  showLoader: (message?: string) => void;
  hideLoader: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────
const LoaderCtx = createContext<LoaderCtxType>({
  showLoader: () => {},
  hideLoader: () => {},
});

// ── Gravure Cylinder Overlay ───────────────────────────────────────────────────
function GravureCylinderOverlay({ message }: { message: string }) {
  return (
    <>
      <style>{`
        @keyframes grv-roll {
          from { background-position: 0 0; }
          to   { background-position: -80px 0; }
        }
        @keyframes grv-spin-left {
          from { transform: rotateY(0deg); }
          to   { transform: perspective(120px) rotateY(360deg); }
        }
        @keyframes grv-spin-right {
          from { transform: rotateY(0deg); }
          to   { transform: perspective(120px) rotateY(-360deg); }
        }
        @keyframes grv-ink-slide {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(0%); opacity: 0.7; }
        }
        @keyframes grv-dot-pulse {
          0%, 100% { transform: scale(0.7); opacity: 0.35; }
          50%       { transform: scale(1.1); opacity: 1; }
        }
        @keyframes grv-text-blink {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes grv-shadow-scale {
          0%, 100% { transform: scaleX(0.85); opacity: 0.15; }
          50%       { transform: scaleX(1);    opacity: 0.3; }
        }
      `}</style>

      {/* ── Semi-transparent full-screen overlay ── */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(10, 18, 36, 0.72)",
          backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: "40px 56px 32px",
            textAlign: "center",
            boxShadow: "0 32px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1)",
            minWidth: 300,
            userSelect: "none",
          }}
        >
          {/* ── Title ── */}
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: "#94a3b8", marginBottom: 20, textTransform: "uppercase" }}>
            Gravure ERP
          </p>

          {/* ── Cylinder assembly ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
            {/* Left axle cap */}
            <div style={{
              width: 22, height: 64,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1e3a5f 0%, #0f2040 100%)",
              boxShadow: "inset -3px 0 6px rgba(0,0,0,0.4)",
              flexShrink: 0,
              animation: "grv-spin-left 1.8s linear infinite",
            }} />

            {/* Cylinder body */}
            <div style={{
              width: 180, height: 64, position: "relative", overflow: "hidden",
              background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 45%, #1e3a5f 100%)",
              boxShadow: "inset 0 4px 12px rgba(255,255,255,0.12), inset 0 -4px 12px rgba(0,0,0,0.3)",
              flexShrink: 0,
            }}>
              {/* Gravure cells pattern — scrolls to simulate rotation */}
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: [
                  "radial-gradient(circle, rgba(147,197,253,0.85) 2.5px, transparent 2.5px)",
                ].join(","),
                backgroundSize: "20px 16px",
                backgroundPosition: "0 4px",
                animation: "grv-roll 0.8s linear infinite",
              }} />

              {/* Top specular highlight */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 14,
                background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)",
                pointerEvents: "none",
              }} />

              {/* Bottom shadow */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 10,
                background: "linear-gradient(0deg, rgba(0,0,0,0.35) 0%, transparent 100%)",
                pointerEvents: "none",
              }} />
            </div>

            {/* Right axle cap */}
            <div style={{
              width: 22, height: 64,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              boxShadow: "inset 3px 0 6px rgba(255,255,255,0.2)",
              flexShrink: 0,
              animation: "grv-spin-right 1.8s linear infinite",
            }} />
          </div>

          {/* ── Cylinder ground shadow ── */}
          <div style={{
            width: 220, height: 10, margin: "4px auto 0",
            background: "radial-gradient(ellipse, rgba(30,58,95,0.4) 0%, transparent 70%)",
            animation: "grv-shadow-scale 1.8s ease-in-out infinite",
          }} />

          {/* ── Ink print line ── */}
          <div style={{ margin: "14px auto 0", width: 220, height: 3, overflow: "hidden", borderRadius: 2, background: "#f1f5f9" }}>
            <div style={{
              height: "100%",
              background: "linear-gradient(90deg, #06B6D4 0%, #EC4899 33%, #F59E0B 66%, #1e293b 100%)",
              animation: "grv-ink-slide 1.8s ease-in-out infinite",
            }} />
          </div>

          {/* ── CMYK dots ── */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14 }}>
            {[
              { c: "#06B6D4", l: "C", delay: "0s" },
              { c: "#EC4899", l: "M", delay: "0.18s" },
              { c: "#F59E0B", l: "Y", delay: "0.36s" },
              { c: "#1e293b", l: "K", delay: "0.54s" },
            ].map(({ c, l, delay }) => (
              <div
                key={l}
                style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: c,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.05em",
                  animation: "grv-dot-pulse 1.44s ease-in-out infinite",
                  animationDelay: delay,
                  boxShadow: `0 2px 6px ${c}55`,
                }}
              >
                {l}
              </div>
            ))}
          </div>

          {/* ── Message text ── */}
          <p style={{
            marginTop: 18, fontSize: 13, fontWeight: 600, color: "#334155",
            letterSpacing: "0.04em",
            animation: "grv-text-blink 1.8s ease-in-out infinite",
          }}>
            {message}
          </p>
        </div>
      </div>
    </>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function LoaderProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("Loading...");
  const countRef = useRef(0);  // tracks concurrent in-flight requests

  const showLoader = useCallback((msg?: string) => {
    countRef.current += 1;
    if (msg) setMessage(msg);
    setVisible(true);
  }, []);

  const hideLoader = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    if (countRef.current === 0) setVisible(false);
  }, []);

  // Expose globally so lib/api.ts can call it without a hook
  useEffect(() => {
    (window as any).__loader__ = { show: showLoader, hide: hideLoader };
    return () => { delete (window as any).__loader__; };
  }, [showLoader, hideLoader]);

  return (
    <LoaderCtx.Provider value={{ showLoader, hideLoader }}>
      {children}
      {visible && <GravureCylinderOverlay message={message} />}
    </LoaderCtx.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useLoader = () => useContext(LoaderCtx);
