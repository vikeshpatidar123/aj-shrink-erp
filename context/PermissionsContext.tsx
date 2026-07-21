"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { apiGet } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

export type CanAction = "CanView" | "CanSave" | "CanEdit" | "CanDelete" | "CanPrint" | "CanExport";

type ModuleRights = Record<CanAction, boolean>;

type PermissionsCtxType = {
  loaded: boolean;
  hasModule: (moduleName: string) => boolean;
  can: (moduleName: string, action: CanAction) => boolean;
  refresh: () => Promise<void>;
};

const PermissionsCtx = createContext<PermissionsCtxType>({
  loaded: false,
  hasModule: () => true,   // fail-open until the first real fetch resolves, so the sidebar isn't empty during load
  can: () => true,
  refresh: async () => {},
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [rights, setRights] = useState<Record<string, ModuleRights>>({});
  const [loaded, setLoaded] = useState(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!isLoggedIn()) return;

    try {
      const data = await apiGet<any>("api/othermasterShrink/checkrights");
      const rows = Array.isArray(data) ? data : [];
      const map: Record<string, ModuleRights> = {};
      rows.forEach((r: any) => {
        const name = r.ModuleName;
        if (!name) return;
        map[name] = {
          CanView: !!Number(r.CanView), CanSave: !!Number(r.CanSave), CanEdit: !!Number(r.CanEdit),
          CanDelete: !!Number(r.CanDelete), CanPrint: !!Number(r.CanPrint), CanExport: !!Number(r.CanExport),
        };
      });
      setRights(map);
      setLoaded(true);
    } catch {
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(() => { if (isLoggedIn()) refresh(); }, 10000);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [refresh]);

  const hasModule = (moduleName: string) => !loaded || !!rights[moduleName]?.CanView;
  const can = (moduleName: string, action: CanAction) => !loaded || !!rights[moduleName]?.[action];

  return (
    <PermissionsCtx.Provider value={{ loaded, hasModule, can, refresh }}>
      {children}
    </PermissionsCtx.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsCtx);
