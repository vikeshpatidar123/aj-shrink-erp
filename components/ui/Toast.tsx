"use client";
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastCtxType {
  showToast: (type: ToastType, title: string, message?: string) => void;
}

const ToastCtx = createContext<ToastCtxType>({ showToast: () => {} });

const TOAST_CONFIG: Record<ToastType, {
  Icon: any;
  bar: string;
  iconColor: string;
  titleColor: string;
  bg: string;
}> = {
  success: {
    Icon: CheckCircle2,
    bar: "bg-green-500",
    iconColor: "text-green-500",
    titleColor: "text-green-800",
    bg: "bg-green-50 border-green-200",
  },
  error: {
    Icon: XCircle,
    bar: "bg-red-500",
    iconColor: "text-red-500",
    titleColor: "text-red-800",
    bg: "bg-red-50 border-red-200",
  },
  warning: {
    Icon: AlertTriangle,
    bar: "bg-amber-500",
    iconColor: "text-amber-600",
    titleColor: "text-amber-800",
    bg: "bg-amber-50 border-amber-200",
  },
  info: {
    Icon: Info,
    bar: "bg-blue-500",
    iconColor: "text-blue-500",
    titleColor: "text-blue-800",
    bg: "bg-blue-50 border-blue-200",
  },
};

const AUTO_DISMISS_MS = 5000;

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const cfg = TOAST_CONFIG[item.type];

  // Slide-in on mount
  useEffect(() => {
    const enter = setTimeout(() => setVisible(true), 15);
    return () => clearTimeout(enter);
  }, []);

  // Progress bar countdown
  useEffect(() => {
    const step = 50;
    const decrement = (100 / AUTO_DISMISS_MS) * step;
    const timer = setInterval(() => {
      setProgress(p => {
        if (p <= 0) { clearInterval(timer); return 0; }
        return p - decrement;
      });
    }, step);
    return () => clearInterval(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 280);
  };

  return (
    <div
      className={`
        pointer-events-auto w-[360px] max-w-[90vw]
        border rounded-2xl shadow-xl overflow-hidden
        transition-all duration-300 ease-out
        ${cfg.bg}
        ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}
      `}
    >
      {/* Top colour bar */}
      <div className={`h-[3px] w-full ${cfg.bar}`} />

      <div className="flex items-start gap-3 px-4 py-3">
        {/* Icon */}
        <cfg.Icon size={20} className={`${cfg.iconColor} mt-0.5 flex-shrink-0`} />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${cfg.titleColor} leading-tight`}>{item.title}</p>
          {item.message && (
            <p className="text-xs text-gray-600 mt-1 leading-relaxed break-words">{item.message}</p>
          )}
        </div>

        {/* Close */}
        <button
          onClick={dismiss}
          className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 mt-0.5 rounded-full hover:bg-white/60 p-0.5"
        >
          <X size={15} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] w-full bg-black/5">
        <div
          className={`h-full ${cfg.bar} opacity-50 transition-all ease-linear`}
          style={{ width: `${progress}%`, transitionDuration: "50ms" }}
        />
      </div>
    </div>
  );
}

let _toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Date.now() * 1000 + (++_toastCounter % 1000);
    setToasts(p => [...p, { id, type, title, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), AUTO_DISMISS_MS + 400);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(p => p.filter(t => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      {/* Portal-style fixed overlay */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
