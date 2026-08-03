"use client";
// ───────────────────────────────────────────────────────────────────────────
// Reusable QR / Barcode scanner modal.
// Supports: Camera scanner (getUserMedia + jsQR), hardware barcode/QR reader
// (keyboard-wedge into the manual field), and manual entry fallback.
// Lifted from the inventory ScannerModal pattern into a shared component so the
// production module (and others) can reuse a single implementation.
// ───────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback } from "react";
import jsQR from "jsqr";
import { X, QrCode, Camera, Keyboard } from "lucide-react";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

export interface QrScannerProps {
  title?: string;
  hint?: string;
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function QrScanner({
  title = "Scan QR / Barcode",
  hint = "Point the camera at the code, or type it manually",
  onScan,
  onClose,
}: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wedgeRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manual, setManual] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const scan = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) { stopCamera(); onScan(code.data); }
  }, [onScan, stopCamera]);

  useEffect(() => {
    let active = true;
    if (mode === "camera") {
      (async () => {
        setCameraError("");
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setScanning(true);
            intervalRef.current = setInterval(scan, 150);
          }
        } catch {
          if (active) { setCameraError("Camera unavailable. Use manual entry / hardware reader."); setMode("manual"); }
        }
      })();
    } else {
      // hardware barcode/QR readers act as keyboard wedges — focus the field
      wedgeRef.current?.focus();
    }
    return () => { active = false; stopCamera(); };
  }, [mode, scan, stopCamera]);

  const submitManual = () => { if (manual.trim()) onScan(manual.trim()); };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[700px] overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between text-white" style={{ background: "var(--erp-primary)" }}>
          <div className="flex items-center gap-2">
            <QrCode size={16} />
            <div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-xs opacity-80">{hint}</p>
            </div>
          </div>
          <button onClick={onClose} className="opacity-80 hover:opacity-100"><X size={18} /></button>
        </div>

        <div className="flex border-b border-gray-100">
          {([
            { m: "camera" as const, icon: Camera, label: "Camera Scan" },
            { m: "manual" as const, icon: Keyboard, label: "Manual / Reader" },
          ]).map(({ m, icon: Icon, label }) => (
            <button
              key={m}
              onClick={() => { setMode(m); if (m !== "camera") stopCamera(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors"
              style={{
                color: mode === m ? "var(--erp-primary)" : "#6b7280",
                borderBottom: mode === m ? "2px solid var(--erp-primary)" : "2px solid transparent",
                background: mode === m ? "var(--erp-primary-light)" : "transparent",
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {mode === "camera" && (
          <div className="p-4">
            {cameraError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600 text-center">{cameraError}</div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 rounded-lg relative" style={{ borderColor: "var(--erp-primary)" }}>
                    {["top-0 left-0 border-t-4 border-l-4 rounded-tl", "top-0 right-0 border-t-4 border-r-4 rounded-tr",
                      "bottom-0 left-0 border-b-4 border-l-4 rounded-bl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br",
                    ].map((cls, i) => <div key={i} className={`absolute w-6 h-6 ${cls}`} style={{ borderColor: "var(--erp-primary)" }} />)}
                    {scanning && <div className="absolute inset-x-0 top-0 h-0.5 animate-bounce" style={{ background: "var(--erp-primary)", animationDuration: "1.5s" }} />}
                  </div>
                </div>
                <div className="absolute bottom-3 inset-x-0 text-center">
                  <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">Point at QR / Barcode</span>
                </div>
              </div>
            )}
            <p className="text-center text-xs text-gray-400 mt-2">Scan will auto-process</p>
          </div>
        )}

        {mode === "manual" && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Barcode / QR Reader input</label>
              <input
                ref={wedgeRef}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitManual(); } }}
                placeholder="Scan with hardware reader or type the code…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ ["--tw-ring-color" as string]: "var(--erp-primary)" }}
              />
              <p className="text-[11px] text-gray-400 mt-1">Hardware readers submit automatically on Enter.</p>
            </div>
            <Textarea label="Or paste value" value={manual} onChange={(e) => setManual(e.target.value)} rows={2} placeholder="Paste QR data…" />
            <Button className="w-full" onClick={submitManual} disabled={!manual.trim()}>Use This Value</Button>
          </div>
        )}
      </div>
    </div>
  );
}
