"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { apiGet } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

export type ApiCustomer = { LedgerID: string; CustomerName: string };
export type ApiMachine  = {
  MachineID: string; MachineName: string; MachineCode: string; DepartmentName: string;
  MinRollWidth: number; MaxRollWidth: number; MinCircumference: number; MaxCircumference: number;
  Colors: number; Speed: number; SpeedUnit: string;
  PerHourCost: number; LabourCharges: number;
  IsOnLoan: number; AnnualInterestRate: number; LoanDuration: number;
  NumberOfOperators: number; AvgLaborSalaryPerYear: number;
  WorkingHoursPerDay: number; WorkingDaysPerYear: number;
  PurchaseCost: number; MachineLifespan: number;
};
export type ApiProcess  = { ProcessID: string; ProcessName: string; DisplayProcessName: string; TypeofCharges: string; Rate: number; SetupCharges: number; StartUnit: string; EndUnit: string; ProcessModuleType: string; ProcessWastagePercentage: number; ProcessCategory: string; DepartmentName: string; MinimumCharges: number; MinimumQuantityToBeCharged: number; PerHourCostingParameter: number; MachineID: string; MachineMasterName: string; AllocattedMachineID: string };
export type ApiFilmItem = { ItemID: string; ItemName: string; ItemDisplayName: string; ItemCode: string; ItemGroupID: string; ItemGroupName: string; ItemSubGroupID: string; ItemSubGroupName: string; Density: number; Thickness: number; WebWidth: number; EstimationRate: number; EstimationUnit: string };
export type ApiInkItem  = { ItemID: string; ItemName: string; ItemCode: string; ItemGroupID: string; ItemGroupName: string; ItemSubGroupID: string; ItemSubGroupName: string; InkColour: string; EstimationRate: number; EstimationUnit: string };
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
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    // Only fetch if running in browser and user is logged in
    if (typeof window === "undefined") return;
    if (!isLoggedIn()) return;

    setLoading(true);
    try {
      const data = await apiGet<any>("api/productcataloggravureShrink/getdropdowndata");
      if (data && typeof data === "object") {
        if (Array.isArray(data.customers))      setCustomers(data.customers);
        if (Array.isArray(data.machines))       setMachines(data.machines);
        if (Array.isArray(data.processes))      setProcesses(data.processes);
        if (Array.isArray(data.filmItems))      setFilmItems(data.filmItems);
        if (Array.isArray(data.inkItems))       setInkItems(data.inkItems);
        if (Array.isArray(data.vendorLedgers))  setVendorLedgers(data.vendorLedgers);
        if (Array.isArray(data.cylinderMaster)) setCylinderMaster(data.cylinderMaster);
      }
    } catch {
      // Silently retry after 10 seconds — server may not be ready yet
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(() => {
        if (isLoggedIn()) refresh();
      }, 10000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [refresh]);

  return (
    <MastersCtx.Provider value={{ customers, machines, processes, filmItems, inkItems, vendorLedgers, cylinderMaster, loading, refresh }}>
      {children}
    </MastersCtx.Provider>
  );
}

export const useMasters = () => useContext(MastersCtx);
