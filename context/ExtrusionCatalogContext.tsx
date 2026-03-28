"use client";
import { createContext, useContext, useState, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────
export type ExtCatalogMatLine = {
  name: string;
  pct: number;
  density: number;
  rate: number;
};

export type ExtCatalogLayer = {
  layerNo: number;
  layerName: string;
  micron: number;
  materials: ExtCatalogMatLine[];
  blendDensity: number;
  gsm: number;
  consumptionPerSqM: number;
  blendRate: number;
  costPerSqM: number;
};

export type ExtrusionCatalogItem = {
  id: string;
  catalogNo: string;
  catalogName: string;
  customerId: string;
  customerName: string;
  recipeId: string;
  recipeName: string;
  rollMasterId: string;
  rollWidth: number;
  layers: ExtCatalogLayer[];
  totalMicron: number;
  totalGSM: number;
  standardRate: number;
  unit: string;
  status: "Active" | "Inactive";
  createdFrom: "Work Order" | "Manual" | "Job Card";
  sourceWONo: string;
  sourceOrderId: string;
  sourceJobCardNo: string;
  createdDate: string;
  remarks: string;
};

// Partial pre-fill transferred from Job Card
export type CatalogPrefill = {
  catalogName: string;
  customerId: string;
  customerName: string;
  recipeId: string;
  recipeName: string;
  rollMasterId: string;
  rollWidth: number;
  layers: ExtCatalogLayer[];
  standardRate: number;
  sourceJobCardNo: string;
};

// ─── Context ──────────────────────────────────────────────────
type CtxType = {
  catalog: ExtrusionCatalogItem[];
  saveCatalogItem: (item: ExtrusionCatalogItem) => void;
  deleteCatalogItem: (id: string) => void;
  pendingFill: CatalogPrefill | null;
  setPendingFill: (fill: CatalogPrefill | null) => void;
};

const Ctx = createContext<CtxType>({
  catalog: [],
  saveCatalogItem: () => {},
  deleteCatalogItem: () => {},
  pendingFill: null,
  setPendingFill: () => {},
});

export function ExtrusionCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog]       = useState<ExtrusionCatalogItem[]>([]);
  const [pendingFill, setPendingFill] = useState<CatalogPrefill | null>(null);

  const saveCatalogItem = (item: ExtrusionCatalogItem) => {
    setCatalog(prev => {
      const exists = prev.find(c => c.id === item.id);
      return exists ? prev.map(c => c.id === item.id ? item : c) : [...prev, item];
    });
  };

  const deleteCatalogItem = (id: string) => {
    setCatalog(prev => prev.filter(c => c.id !== id));
  };

  return (
    <Ctx.Provider value={{ catalog, saveCatalogItem, deleteCatalogItem, pendingFill, setPendingFill }}>
      {children}
    </Ctx.Provider>
  );
}

export const useExtrusionCatalog = () => useContext(Ctx);
