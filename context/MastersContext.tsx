"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { apiGet } from "@/lib/api";

export type ApiCustomer = { LedgerID: string; CustomerName: string };
export type ApiMachine  = { MachineID: string; MachineName: string; MachineCode: string; DepartmentName: string; MinRollWidth: number; MaxRollWidth: number; MinCircumference: number; MaxCircumference: number; Colors: number; Speed: number };
export type ApiProcess  = { ProcessID: string; ProcessName: string; DisplayProcessName: string; TypeofCharges: string; Rate: number; SetupCharges: number; StartUnit: string; EndUnit: string; ProcessModuleType: string; ProcessWastagePercentage: number; ProcessCategory: string; DepartmentName: string };
export type ApiFilmItem = { ItemID: string; ItemName: string; ItemDisplayName: string; ItemCode: string; ItemGroupID: string; ItemGroupName: string; ItemSubGroupID: string; ItemSubGroupName: string; Density: number; Thickness: number; WebWidth: number };
export type ApiInkItem  = { ItemID: string; ItemName: string; ItemCode: string; ItemGroupID: string; ItemGroupName: string; ItemSubGroupID: string; ItemSubGroupName: string; InkColour: string };
export type ApiVendor   = { LedgerID: string; LedgerName: string; LedgerGroupName: string };
export type ApiCylinder = { CylinderID: string; CylinderCode: string; CylinderName: string; Circumference: number; PrintWidth: number; RepeatUPS: number; CylinderType: string; CylinderStatus: string };

type MastersCtxType = {
  customers:     ApiCustomer[];
  machines:      ApiMachine[];
  processes:     ApiProcess[];
  filmItems:     ApiFilmItem[];
  inkItems:      ApiInkItem[];
  vendorLedgers: ApiVendor[];
  cylinderMaster: ApiCylinder[];
  loading:       boolean;
  refresh:       () => Promise<void>;
};

const MastersCtx = createContext<MastersCtxType>({
  customers: [], machines: [], processes: [],
  filmItems: [], inkItems: [], vendorLedgers: [], cylinderMaster: [],
  loading: false, refresh: async () => {},
});

export function MastersProvider({ children }: { children: ReactNode }) {
  const [customers,     setCustomers]     = useState<ApiCustomer[]>([]);
  const [machines,      setMachines]      = useState<ApiMachine[]>([]);
  const [processes,     setProcesses]     = useState<ApiProcess[]>([]);
  const [filmItems,     setFilmItems]     = useState<ApiFilmItem[]>([]);
  const [inkItems,      setInkItems]      = useState<ApiInkItem[]>([]);
  const [vendorLedgers,  setVendorLedgers]  = useState<ApiVendor[]>([]);
  const [cylinderMaster, setCylinderMaster] = useState<ApiCylinder[]>([]);
  const [loading,        setLoading]        = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<any>("api/productcataloggravureShrink/getdropdowndata");
      console.log("[MastersContext] getdropdowndata response:", data);
      if (data && typeof data === "object") {
        if (Array.isArray(data.customers))     { setCustomers(data.customers);     console.log("[Masters] customers:", data.customers.length); }
        if (Array.isArray(data.machines))      { setMachines(data.machines);       console.log("[Masters] machines:", data.machines.length); }
        if (Array.isArray(data.processes))     { setProcesses(data.processes);     console.log("[Masters] processes:", data.processes.length); }
        if (Array.isArray(data.filmItems))     { setFilmItems(data.filmItems);     console.log("[Masters] filmItems:", data.filmItems.length); }
        if (Array.isArray(data.inkItems))      { setInkItems(data.inkItems);       console.log("[Masters] inkItems:", data.inkItems.length); }
        if (Array.isArray(data.vendorLedgers))  { setVendorLedgers(data.vendorLedgers);   console.log("[Masters] vendorLedgers:", data.vendorLedgers.length); }
        if (Array.isArray(data.cylinderMaster)) { setCylinderMaster(data.cylinderMaster); console.log("[Masters] cylinderMaster:", data.cylinderMaster.length); }
        if (Array.isArray(data._errors) && data._errors.length > 0)
          console.warn("[Masters] partial errors:", data._errors);
      }
    } catch (e: any) {
      console.error("[MastersContext] getdropdowndata FAILED:", e?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <MastersCtx.Provider value={{ customers, machines, processes, filmItems, inkItems, vendorLedgers, cylinderMaster, loading, refresh }}>
      {children}
    </MastersCtx.Provider>
  );
}

export const useMasters = () => useContext(MastersCtx);
